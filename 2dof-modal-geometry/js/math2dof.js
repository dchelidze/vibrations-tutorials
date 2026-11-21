/**
 * math2dof.js
 * Exact 2x2 linear algebra, symmetric matrix square root M^(1/2) & M^(-1/2),
 * symmetric dynamic stiffness matrix K_tilde = M^(-1/2) K M^(-1/2),
 * generalized eigenvalue solver (Phi = M^(-1/2) P), Rayleigh quotient,
 * and continuous 2-stage simultaneous diagonalization transforms for 2-DOF systems.
 */
window.VibLab = window.VibLab || {};

window.VibLab.Math2D = (function () {
  'use strict';

  function matVec(A, v) {
    return [
      A[0][0] * v[0] + A[0][1] * v[1],
      A[1][0] * v[0] + A[1][1] * v[1]
    ];
  }

  function matMul(A, B) {
    return [
      [
        A[0][0] * B[0][0] + A[0][1] * B[1][0],
        A[0][0] * B[0][1] + A[0][1] * B[1][1]
      ],
      [
        A[1][0] * B[0][0] + A[1][1] * B[1][0],
        A[1][0] * B[0][1] + A[1][1] * B[1][1]
      ]
    ];
  }

  function matTranspose(A) {
    return [
      [A[0][0], A[1][0]],
      [A[0][1], A[1][1]]
    ];
  }

  function matDet(A) {
    return A[0][0] * A[1][1] - A[0][1] * A[1][0];
  }

  function matInv(A) {
    const det = matDet(A);
    const safeDet = Math.abs(det) < 1e-12 ? (det >= 0 ? 1e-12 : -1e-12) : det;
    return [
      [A[1][1] / safeDet, -A[0][1] / safeDet],
      [-A[1][0] / safeDet, A[0][0] / safeDet]
    ];
  }

  function rotMat(theta) {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    return [
      [c, -s],
      [s, c]
    ];
  }

  function dot(u, v) {
    return u[0] * v[0] + u[1] * v[1];
  }

  function norm(u) {
    return Math.hypot(u[0], u[1]);
  }

  function quadForm(u, A) {
    return (
      u[0] * (A[0][0] * u[0] + A[0][1] * u[1]) +
      u[1] * (A[1][0] * u[0] + A[1][1] * u[1])
    );
  }

  function congruence(A, T) {
    // Returns T^T * A * T
    return matMul(matTranspose(T), matMul(A, T));
  }

  /**
   * Eigen-decomposition of a 2x2 real symmetric matrix A = [[a, b], [b, d]].
   * Returns sorted eigenvalues lam1 <= lam2 and proper rotation matrix P = [v1, v2] (det = +1)
   * with rotation angle phi1 in (-pi/2, pi/2].
   */
  function symEigSorted(A) {
    const a = A[0][0];
    const b = 0.5 * (A[0][1] + A[1][0]);
    const d = A[1][1];
    const tr = a + d;
    const diff = a - d;
    const disc = Math.hypot(diff, 2 * b);
    const lam1 = 0.5 * (tr - disc);
    const lam2 = 0.5 * (tr + disc);

    let phi1;
    if (disc < 1e-12) {
      phi1 = 0;
    } else {
      // phi2 maximizes v^T A v (corresponds to lam2)
      const phi2 = 0.5 * Math.atan2(2 * b, diff);
      phi1 = phi2 - Math.PI / 2;
    }
    while (phi1 <= -Math.PI / 2) phi1 += Math.PI;
    while (phi1 > Math.PI / 2) phi1 -= Math.PI;

    const c = Math.cos(phi1);
    const s = Math.sin(phi1);
    const v1 = [c, s];
    const v2 = [-s, c];
    return {
      values: [lam1, lam2],
      vectors: [v1, v2],
      angle: phi1,
      P: [
        [v1[0], v2[0]],
        [v1[1], v2[1]]
      ]
    };
  }

  /**
   * Computes symmetric fractional matrix power M^p = P_M * diag(d1^p, d2^p) * P_M^T
   * for a 2x2 symmetric positive-definite matrix M.
   */
  function symMatPower(mEig, p) {
    const P = mEig.P;
    const d1p = Math.pow(Math.max(mEig.values[0], 1e-12), p);
    const d2p = Math.pow(Math.max(mEig.values[1], 1e-12), p);
    const Dp = [
      [d1p, 0],
      [0, d2p]
    ];
    return matMul(P, matMul(Dp, matTranspose(P)));
  }

  /**
   * Solves the generalized eigenvalue problem K u = omega^2 M u
   * via the exact symmetric dynamic stiffness matrix:
   *   1. M^(1/2) = P_M * Lambda_M^(1/2) * P_M^T,  M^(-1/2) = P_M * Lambda_M^(-1/2) * P_M^T
   *   2. K_tilde = M^(-1/2) * K * M^(-1/2)   (symmetric!)
   *   3. K_tilde * P = P * Lambda            (orthogonal P = [p1, p2], det(P) = +1)
   *   4. Phi = M^(-1/2) * P = [u1, u2]       (mass-normalized modal matrix: Phi^T M Phi = I, Phi^T K Phi = Lambda)
   */
  function solveGeneralizedEigen(M, K) {
    const mEig = symEigSorted(M);
    const kOrigEig = symEigSorted(K);

    // Exact symmetric square root M^(1/2) and inverse square root M^(-1/2)
    const MHalf = symMatPower(mEig, 0.5);
    const MInvHalf = symMatPower(mEig, -0.5);

    // Exact symmetric mass-weighted stiffness matrix K_tilde = M^(-1/2) K M^(-1/2)
    const KTilde = matMul(MInvHalf, matMul(K, MInvHalf));
    // Enforce exact symmetry against floating point roundoff
    const kOff = 0.5 * (KTilde[0][1] + KTilde[1][0]);
    KTilde[0][1] = kOff;
    KTilde[1][0] = kOff;

    // Orthogonal eigendecomposition of K_tilde: K_tilde = P * Lambda * P^T
    const kTildeEig = symEigSorted(KTilde);
    const lam1 = Math.max(kTildeEig.values[0], 1e-10);
    const lam2 = Math.max(kTildeEig.values[1], 1e-10);
    const omega1 = Math.sqrt(lam1);
    const omega2 = Math.sqrt(lam2);

    const P = kTildeEig.P; // columns are p1, p2 (orthogonal unit eigenvectors of K_tilde)
    const p1 = kTildeEig.vectors[0];
    const p2 = kTildeEig.vectors[1];
    const betaP = kTildeEig.angle;

    // Exact mass-normalized modal matrix: Phi = M^(-1/2) * P
    const Phi = matMul(MInvHalf, P);
    const u1 = [Phi[0][0], Phi[1][0]];
    const u2 = [Phi[0][1], Phi[1][1]];
    // Inverse modal matrix: Phi^(-1) = P^T * M^(1/2) = Phi^T * M
    const PhiInv = matMul(matTranspose(P), MHalf);

    // Non-symmetric dynamic matrix A = M^(-1) K (MATLAB M\K)
    const MInv = matInv(M);
    const A = matMul(MInv, K);

    // Angle between physical mode vectors u1 and u2
    const cosAngle = dot(u1, u2) / (norm(u1) * norm(u2));
    const modeAngleDeg = (Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180) / Math.PI;

    // Mass-orthogonality and Stiffness-orthogonality check values
    const mOrtho = dot(u1, matVec(M, u2));
    const kOrtho = dot(u1, matVec(K, u2));

    return {
      M,
      K,
      MInv,
      MHalf,
      MInvHalf,
      A, // M\K
      KTilde, // M^(-1/2) K M^(-1/2)
      P, // Orthogonal eigenvectors of K_tilde
      p1,
      p2,
      betaP,
      // Eigenvalues & frequencies
      lambdas: [lam1, lam2],
      omegas: [omega1, omega2],
      freqsHz: [omega1 / (2 * Math.PI), omega2 / (2 * Math.PI)],
      periods: [(2 * Math.PI) / omega1, (2 * Math.PI) / omega2],
      // Mass-normalized eigenvectors (Phi = M^(-1/2) P)
      u1,
      u2,
      Phi,
      PhiInv,
      // Diagnostics
      modeAngleDeg,
      mOrtho,
      kOrtho,
      mEig,
      kOrigEig,
      kTildeEig
    };
  }

  function smoothstep(s) {
    const x = Math.max(0, Math.min(1, s));
    return x * x * (3 - 2 * x);
  }

  /**
   * Computes the continuous 2-stage textbook simultaneous diagonalization at t in [0, 2]:
   *   Stage 0 -> 1 (t in [0, 1]): Symmetric mass-whitening  L(t) = M^(s/2)
   *       At t = 1: M(1) = I (unit circle), K(1) = K_tilde = M^(-1/2) K M^(-1/2)
   *       Mode vectors: u_i -> p_i (exact orthogonal eigenvectors of K_tilde!)
   *   Stage 1 -> 2 (t in [1, 2]): Orthogonal rotation  L(t) = R(-s * betaP) * M^(1/2)
   *       At t = 2: L(2) = P^T M^(1/2) = Phi^(-1)
   *       M(2) = Phi^T M Phi = I,  K(2) = Phi^T K Phi = Lambda = diag(omega1^2, omega2^2)
   */
  function morphStateAt(eigen, t) {
    const tc = Math.max(0, Math.min(2, t));
    const s1 = tc <= 1 ? smoothstep(tc) : 1;
    const s2 = tc <= 1 ? 0 : smoothstep(tc - 1);

    const MsHalf = symMatPower(eigen.mEig, 0.5 * s1);
    const R = rotMat(-s2 * eigen.betaP);
    const L = matMul(R, MsHalf);
    const LInv = matInv(L);

    const Mt = congruence(eigen.M, LInv);
    const Kt = congruence(eigen.K, LInv);

    const u1t = matVec(L, eigen.u1);
    const u2t = matVec(L, eigen.u2);
    const cosAng = dot(u1t, u2t) / Math.max(1e-9, norm(u1t) * norm(u2t));
    const angleDeg = (Math.acos(Math.max(-1, Math.min(1, cosAng))) * 180) / Math.PI;

    return {
      t: tc,
      L,
      LInv,
      Mt,
      Kt,
      u1t,
      u2t,
      angleDeg
    };
  }

  function rayleigh(u, M, K) {
    const denom = quadForm(u, M);
    if (denom <= 1e-12) return 0;
    return quadForm(u, K) / denom;
  }

  function sampleEllipse(A, level, numPoints) {
    const n = numPoints || 120;
    const eig = symEigSorted(A);
    const a = Math.sqrt(Math.max(level, 1e-12) / Math.max(eig.values[0], 1e-12));
    const b = Math.sqrt(Math.max(level, 1e-12) / Math.max(eig.values[1], 1e-12));
    const c = Math.cos(eig.angle);
    const s = Math.sin(eig.angle);
    const pts = new Array(n + 1);
    for (let i = 0; i <= n; i++) {
      const th = (i / n) * Math.PI * 2;
      const lx = a * Math.cos(th);
      const ly = b * Math.sin(th);
      pts[i] = [c * lx - s * ly, s * lx + c * ly];
    }
    return {
      pts,
      semiAxes: [a, b],
      angle: eig.angle,
      v1: eig.vectors[0],
      v2: eig.vectors[1]
    };
  }

  function modalSolutionFromIC(eigen, q0, v0) {
    const eta0 = matVec(eigen.PhiInv, q0);
    const etad0 = matVec(eigen.PhiInv, v0);
    const w1 = eigen.omegas[0];
    const w2 = eigen.omegas[1];

    const A1 = Math.hypot(eta0[0], etad0[0] / w1);
    const A2 = Math.hypot(eta0[1], etad0[1] / w2);
    const phi1 = Math.atan2(-etad0[0] / w1, eta0[0]);
    const phi2 = Math.atan2(-etad0[1] / w2, eta0[1]);

    return {
      eta0,
      etad0,
      A1,
      A2,
      phi1,
      phi2,
      evalAt: function (t) {
        const e1 = A1 * Math.cos(w1 * t + phi1);
        const e2 = A2 * Math.cos(w2 * t + phi2);
        const ed1 = -A1 * w1 * Math.sin(w1 * t + phi1);
        const ed2 = -A2 * w2 * Math.sin(w2 * t + phi2);
        const q = matVec(eigen.Phi, [e1, e2]);
        const v = matVec(eigen.Phi, [ed1, ed2]);
        return { q, v, eta: [e1, e2], etad: [ed1, ed2] };
      }
    };
  }

  function fmt(val, digits) {
    const d = digits === undefined ? 2 : digits;
    if (Math.abs(val) < 5e-4 && d <= 2) return (0).toFixed(d);
    if (Math.abs(val) < 5e-5 && d === 3) return (0).toFixed(d);
    return val.toFixed(d);
  }

  return {
    matVec,
    matMul,
    matTranspose,
    matDet,
    matInv,
    rotMat,
    dot,
    norm,
    quadForm,
    congruence,
    symEigSorted,
    symMatPower,
    solveGeneralizedEigen,
    morphStateAt,
    rayleigh,
    sampleEllipse,
    modalSolutionFromIC,
    fmt
  };
})();
