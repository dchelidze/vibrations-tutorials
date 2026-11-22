/**
 * math-modal2dof.js
 * Exact analytical & numerical mathematics engine for Module 04:
 * Modal Decoupling, Forced 2-DOF Response, and Antiresonance.
 *
 * Physical system:
 *   m1 * x1'' + c11 * x1' + c12 * x2' + (k1 + k2) * x1 - k2 * x2 = f1(t)
 *   m2 * x2'' + c12 * x1' + c22 * x2' - k2 * x1 + (k2 + k3) * x2 = f2(t)
 *
 * Damping matrix:
 *   C = alpha * M + beta * K + cLoc * E_loc
 *   where E_loc is [[1,0],[0,0]] ('m1'), [[0,0],[0,1]] ('m2'), or [[1,-1],[-1,1]] ('couple').
 *
 * Provides:
 * - Exact symmetric mass-normalized eigenproblem Ktilde = M^{-1/2} K M^{-1/2}
 * - Mass-normalized modal matrix P = M^{-1/2} V satisfying P^T M P = I, P^T K P = diag(w1^2, w2^2)
 * - Exact modal damping matrix Ctilde = P^T C P, Caughey-O'Kelly commutator, & dissipation ellipse
 * - Exact coupled receptance matrix H(i*w) = (K - w^2 M + i w C)^{-1}
 * - Modal residue decomposition H_jk(i*w) = h1_jk(i*w) + h2_jk(i*w)
 * - Exact undamped driving-point antiresonance frequencies w_a11, w_a22
 * - Exact closed-form free modal response (proportional) & RK4 free response (general C)
 * - NLD 2026 theme palette helper for canvas rendering
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};

  const EPS = 1e-10;

  /* ------------------------------------------------------------------
   * Presets
   * ---------------------------------------------------------------- */
  const PRESETS = {
    asymmetric: {
      key: 'asymmetric',
      label: 'Asymmetric chain',
      m1: 1.0,
      m2: 1.8,
      k1: 10.0,
      k2: 8.0,
      k3: 4.0,
      alpha: 0.10,
      beta: 0.015,
      cLoc: 0.0,
      locSite: 'm1',
      description:
        'Unequal masses ($m_1 \\ne m_2$) skew the physical mode shapes away from $90^\\circ$, yet $\\mathbf{u}_1^{\\mathsf{T}}\\mathbf{M}\\mathbf{u}_2 = 0$ holds identically. Driving-point $H_{11}$ exhibits a sharp antiresonance zero between $\\omega_1$ and $\\omega_2$.'
    },
    symmetric: {
      key: 'symmetric',
      label: 'Symmetric chain',
      m1: 1.0,
      m2: 1.0,
      k1: 10.0,
      k2: 6.0,
      k3: 10.0,
      alpha: 0.08,
      beta: 0.012,
      cLoc: 0.0,
      locSite: 'm1',
      description:
        'Equal masses and end springs give pure in-phase $[1,1]^{\\mathsf{T}}$ and out-of-phase $[1,-1]^{\\mathsf{T}}$ modes that are orthogonal in both physical and mass-normalized coordinates.'
    },
    weak_coupling: {
      key: 'weak_coupling',
      label: 'Weak coupling (beating)',
      m1: 1.0,
      m2: 1.0,
      k1: 12.0,
      k2: 1.2,
      k3: 12.0,
      alpha: 0.04,
      beta: 0.004,
      cLoc: 0.0,
      locSite: 'm1',
      description:
        'A soft coupling spring $k_2 \\ll k_1$ places $\\omega_1$ and $\\omega_2$ close together, causing slow periodic energy transfer (beating) between $m_1$ and $m_2$ while modal coordinates oscillate cleanly.'
    },
    heavy_base: {
      key: 'heavy_base',
      label: 'Heavy base + light secondary',
      m1: 3.0,
      m2: 0.6,
      k1: 18.0,
      k2: 5.0,
      k3: 0.0,
      alpha: 0.06,
      beta: 0.008,
      cLoc: 0.0,
      locSite: 'm1',
      description:
        'Free-end chain ($k_3 = 0$) with $m_1 = 5m_2$: strong mass asymmetry severely skews the physical eigenvectors, and the antiresonance $\\omega_{\\mathrm{a},11} = \\sqrt{k_2/m_2}$ anticipates the tuned vibration absorber.'
    },
    nonproportional: {
      key: 'nonproportional',
      label: 'Localized damper (non-proportional)',
      m1: 1.0,
      m2: 1.8,
      k1: 10.0,
      k2: 8.0,
      k3: 4.0,
      alpha: 0.02,
      beta: 0.002,
      cLoc: 2.6,
      locSite: 'm1',
      description:
        'A concentrated damper $c_{\\mathrm{loc}}$ on $m_1$ breaks Rayleigh proportionality: $\\tilde{\\mathbf{C}} = \\mathbf{P}^{\\mathsf{T}}\\mathbf{C}\\mathbf{P}$ acquires off-diagonal coupling $\\tilde{c}_{12} \\ne 0$, rotating the dissipation ellipse off the modal axes.'
    }
  };

  /* ------------------------------------------------------------------
   * Complex Arithmetic Helpers
   * ---------------------------------------------------------------- */
  function cAdd(a, b) {
    return { re: a.re + b.re, im: a.im + b.im };
  }
  function cSub(a, b) {
    return { re: a.re - b.re, im: a.im - b.im };
  }
  function cMul(a, b) {
    return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
  }
  function cDiv(a, b) {
    const den = b.re * b.re + b.im * b.im;
    if (den < 1e-30) return { re: 0, im: 0 };
    return { re: (a.re * b.re + a.im * b.im) / den, im: (a.im * b.re - a.re * b.im) / den };
  }
  function cAbs(a) {
    return Math.hypot(a.re, a.im);
  }
  function cArg(a) {
    return Math.atan2(a.im, a.re);
  }

  /* ------------------------------------------------------------------
   * Exact 2x2 Symmetric Eigenproblem Helper
   * Returns sorted eigenvalues lam1 <= lam2 and proper orthonormal
   * eigenvectors v1, v2 with det([v1, v2]) = +1.
   * ---------------------------------------------------------------- */
  function eigSym2x2(a, b, d) {
    const halfSum = 0.5 * (a + d);
    const halfDiff = 0.5 * (a - d);
    const R = Math.hypot(halfDiff, b);
    const lam1 = halfSum - R;
    const lam2 = halfSum + R;

    let v1x, v1y;
    if (R < 1e-13) {
      v1x = 1;
      v1y = 0;
    } else {
      // (a - lam1) v1x + b v1y = 0, b v1x + (d - lam1) v1y = 0
      const p1 = a - lam1;
      const p2 = d - lam1;
      if (Math.abs(p1) >= Math.abs(p2)) {
        v1x = -b;
        v1y = p1;
      } else {
        v1x = p2;
        v1y = -b;
      }
      const nrm = Math.hypot(v1x, v1y);
      v1x /= nrm;
      v1y /= nrm;
      // Canonical sign: prefer v1x > 0 (so mode 1 has positive first component)
      if (v1x < -1e-12 || (Math.abs(v1x) <= 1e-12 && v1y < 0)) {
        v1x = -v1x;
        v1y = -v1y;
      }
    }
    const v2x = -v1y;
    const v2y = v1x;

    return {
      lam1,
      lam2,
      v1: [v1x, v1y],
      v2: [v2x, v2y],
      angle: Math.atan2(v1y, v1x)
    };
  }

  /* ------------------------------------------------------------------
   * Analyze Full 2-DOF System
   * ---------------------------------------------------------------- */
  function analyzeSystem(params) {
    const m1 = Math.max(0.2, Number(params.m1));
    const m2 = Math.max(0.2, Number(params.m2));
    const k1 = Math.max(0.5, Number(params.k1));
    const k2 = Math.max(0.2, Number(params.k2));
    const k3 = Math.max(0.0, Number(params.k3));
    const alpha = Math.max(0.0, Number(params.alpha));
    const beta = Math.max(0.0, Number(params.beta));
    const cLoc = Math.max(0.0, Number(params.cLoc || 0));
    const locSite = params.locSite || 'm1';

    const M = [
      [m1, 0],
      [0, m2]
    ];
    const K = [
      [k1 + k2, -k2],
      [-k2, k2 + k3]
    ];

    // Localized damping matrix E_loc
    let Eloc;
    if (locSite === 'm2') {
      Eloc = [
        [0, 0],
        [0, 1]
      ];
    } else if (locSite === 'couple') {
      Eloc = [
        [1, -1],
        [-1, 1]
      ];
    } else {
      Eloc = [
        [1, 0],
        [0, 0]
      ];
    }

    const C = [
      [alpha * M[0][0] + beta * K[0][0] + cLoc * Eloc[0][0], alpha * M[0][1] + beta * K[0][1] + cLoc * Eloc[0][1]],
      [alpha * M[1][0] + beta * K[1][0] + cLoc * Eloc[1][0], alpha * M[1][1] + beta * K[1][1] + cLoc * Eloc[1][1]]
    ];

    const sm1 = Math.sqrt(m1);
    const sm2 = Math.sqrt(m2);
    const ism1 = 1 / sm1;
    const ism2 = 1 / sm2;

    // Mass-normalized stiffness Ktilde = M^{-1/2} K M^{-1/2}
    const Ktilde = [
      [K[0][0] / m1, K[0][1] / (sm1 * sm2)],
      [K[1][0] / (sm1 * sm2), K[1][1] / m2]
    ];

    const eig = eigSym2x2(Ktilde[0][0], Ktilde[0][1], Ktilde[1][1]);
    const w1 = Math.sqrt(Math.max(1e-12, eig.lam1));
    const w2 = Math.sqrt(Math.max(1e-12, eig.lam2));

    // Mass-normalized mode shapes in q-space (orthonormal)
    const v1 = eig.v1;
    const v2 = eig.v2;
    const V = [
      [v1[0], v2[0]],
      [v1[1], v2[1]]
    ];

    // Mass-normalized mode shapes in physical x-space: u_j = M^{-1/2} v_j
    const u1 = [v1[0] * ism1, v1[1] * ism2];
    const u2 = [v2[0] * ism1, v2[1] * ism2];
    const P = [
      [u1[0], u2[0]],
      [u1[1], u2[1]]
    ];

    // Euclidean angle between u1 and u2 in physical coordinates (degrees)
    const dotPhys = u1[0] * u2[0] + u1[1] * u2[1];
    const normU1 = Math.hypot(u1[0], u1[1]);
    const normU2 = Math.hypot(u2[0], u2[1]);
    const cosPhys = Math.max(-1, Math.min(1, dotPhys / (normU1 * normU2)));
    const physAngleDeg = (Math.acos(cosPhys) * 180) / Math.PI;

    // M-weighted inner product u1^T M u2 (should be ~0)
    const mInner12 = u1[0] * m1 * u2[0] + u1[1] * m2 * u2[1];

    // Mass-normalized damping Cq = M^{-1/2} C M^{-1/2}
    const Cq = [
      [C[0][0] / m1, C[0][1] / (sm1 * sm2)],
      [C[1][0] / (sm1 * sm2), C[1][1] / m2]
    ];

    // Modal damping matrix Ctilde = P^T C P = V^T Cq V
    const Ctilde = [
      [
        u1[0] * (C[0][0] * u1[0] + C[0][1] * u1[1]) + u1[1] * (C[1][0] * u1[0] + C[1][1] * u1[1]),
        u1[0] * (C[0][0] * u2[0] + C[0][1] * u2[1]) + u1[1] * (C[1][0] * u2[0] + C[1][1] * u2[1])
      ],
      [
        u2[0] * (C[0][0] * u1[0] + C[0][1] * u1[1]) + u2[1] * (C[1][0] * u1[0] + C[1][1] * u1[1]),
        u2[0] * (C[0][0] * u2[0] + C[0][1] * u2[1]) + u2[1] * (C[1][0] * u2[0] + C[1][1] * u2[1])
      ]
    ];

    const zeta1 = Ctilde[0][0] / (2 * w1);
    const zeta2 = Ctilde[1][1] / (2 * w2);
    const denomNP = Math.sqrt(Math.max(1e-18, Ctilde[0][0] * Ctilde[1][1]));
    const npIndex = Math.abs(Ctilde[0][1]) / denomNP;
    const isProportional = Math.abs(Ctilde[0][1]) < 1e-8;

    // Caughey-O'Kelly commutator: C M^{-1} K - K M^{-1} C
    // Entry (0,1) of skew-symmetric commutator (for symmetric M, K, C, it is skew-symmetric!)
    const cmk01 = (C[0][0] / m1) * K[0][1] + (C[0][1] / m2) * K[1][1];
    const kmc01 = (K[0][0] / m1) * C[0][1] + (K[0][1] / m2) * C[1][1];
    const commutatorNorm = Math.abs(cmk01 - kmc01);

    // Eigenstructure of Cq (dissipation ellipse orientation in q-space)
    const eigCq = eigSym2x2(Cq[0][0], Cq[0][1], Cq[1][1]);
    let dampMisalignDeg = 0;
    if (eigCq.lam2 - eigCq.lam1 < 1e-10 * Math.max(1, eigCq.lam2)) {
      // Isotropic dissipation (e.g. C = alpha M or C = 0): every orthogonal basis aligns
      eigCq.v1 = v1.slice();
      eigCq.v2 = v2.slice();
      dampMisalignDeg = 0;
    } else {
      // Smallest angle between principal axes of Ktilde and Cq via atan2 (machine-precision near 0)
      const s1 = Math.abs(v1[0] * eigCq.v1[1] - v1[1] * eigCq.v1[0]);
      const c1 = Math.abs(v1[0] * eigCq.v1[0] + v1[1] * eigCq.v1[1]);
      const s2 = Math.abs(v1[0] * eigCq.v2[1] - v1[1] * eigCq.v2[0]);
      const c2 = Math.abs(v1[0] * eigCq.v2[0] + v1[1] * eigCq.v2[1]);
      dampMisalignDeg = (Math.min(Math.atan2(s1, c1), Math.atan2(s2, c2)) * 180) / Math.PI;
    }

    // Exact undamped driving-point antiresonance frequencies
    const wa11 = Math.sqrt((k2 + k3) / m2);
    const wa22 = Math.sqrt((k1 + k2) / m1);

    // Suggested frequency sweep ceiling
    const wMax = Math.max(w2 * 1.65, w2 + 3.0);

    return {
      params: { m1, m2, k1, k2, k3, alpha, beta, cLoc, locSite },
      M,
      K,
      C,
      Ktilde,
      Cq,
      Ctilde,
      P,
      V,
      u1,
      u2,
      v1,
      v2,
      w1,
      w2,
      lam1: eig.lam1,
      lam2: eig.lam2,
      zeta1,
      zeta2,
      npIndex,
      isProportional,
      commutatorNorm,
      eigCq,
      dampMisalignDeg,
      physAngleDeg,
      mInner12,
      wa11,
      wa22,
      wMax,
      sm1,
      sm2
    };
  }

  /* ------------------------------------------------------------------
   * Coordinate Projections
   * ---------------------------------------------------------------- */
  function physToMassNorm(sys, x) {
    return [sys.sm1 * x[0], sys.sm2 * x[1]];
  }

  function massNormToPhys(sys, q) {
    return [q[0] / sys.sm1, q[1] / sys.sm2];
  }

  // Exact M-orthogonal modal coordinates r = P^T M x
  function physToModal(sys, x) {
    const m1 = sys.params.m1;
    const m2 = sys.params.m2;
    return [
      sys.u1[0] * m1 * x[0] + sys.u1[1] * m2 * x[1],
      sys.u2[0] * m1 * x[0] + sys.u2[1] * m2 * x[1]
    ];
  }

  // Physical reconstruction x = P r = r1 * u1 + r2 * u2
  function modalToPhys(sys, r) {
    return [
      r[0] * sys.u1[0] + r[1] * sys.u2[0],
      r[0] * sys.u1[1] + r[1] * sys.u2[1]
    ];
  }

  // Modal generalized force vector Q = P^T f0
  function forceToModal(sys, f0) {
    return [
      sys.u1[0] * f0[0] + sys.u1[1] * f0[1],
      sys.u2[0] * f0[0] + sys.u2[1] * f0[1]
    ];
  }

  /* ------------------------------------------------------------------
   * Exact Receptance Matrix H(i*w) & Modal-Sum Decomposition
   * ---------------------------------------------------------------- */
  function evalFRF(sys, w) {
    const M = sys.M;
    const K = sys.K;
    const C = sys.C;
    const w2 = w * w;

    // Dynamic stiffness Z(iw) = K - w^2 M + i w C
    const Z11 = { re: K[0][0] - w2 * M[0][0], im: w * C[0][0] };
    const Z12 = { re: K[0][1] - w2 * M[0][1], im: w * C[0][1] };
    const Z22 = { re: K[1][1] - w2 * M[1][1], im: w * C[1][1] };

    const detZ = cSub(cMul(Z11, Z22), cMul(Z12, Z12));
    const H11 = cDiv(Z22, detZ);
    const H12 = cDiv({ re: -Z12.re, im: -Z12.im }, detZ);
    const H21 = H12;
    const H22 = cDiv(Z11, detZ);

    // Diagonal modal-sum approximation (exact when Ctilde is diagonal)
    const D1 = { re: sys.lam1 - w2, im: w * sys.Ctilde[0][0] };
    const D2 = { re: sys.lam2 - w2, im: w * sys.Ctilde[1][1] };

    function modalPair(j, k) {
      const num1 = sys.u1[j] * sys.u1[k];
      const num2 = sys.u2[j] * sys.u2[k];
      const h1 = cDiv({ re: num1, im: 0 }, D1);
      const h2 = cDiv({ re: num2, im: 0 }, D2);
      return { h1, h2, sum: cAdd(h1, h2), res1: num1, res2: num2 };
    }

    return {
      exact: [
        [H11, H12],
        [H21, H22]
      ],
      modal: [
        [modalPair(0, 0), modalPair(0, 1)],
        [modalPair(1, 0), modalPair(1, 1)]
      ],
      D1,
      D2
    };
  }

  // Steady-state harmonic displacement vector X(iw) = H(iw) f0
  function evalForcedHarmonic(sys, f0, w) {
    const frf = evalFRF(sys, w);
    const H = frf.exact;
    const X1 = {
      re: H[0][0].re * f0[0] + H[0][1].re * f0[1],
      im: H[0][0].im * f0[0] + H[0][1].im * f0[1]
    };
    const X2 = {
      re: H[1][0].re * f0[0] + H[1][1].re * f0[1],
      im: H[1][0].im * f0[0] + H[1][1].im * f0[1]
    };
    // Modal steady-state coordinates R1, R2 under diagonal modal approximation
    const Q = forceToModal(sys, f0);
    const R1 = cDiv({ re: Q[0], im: 0 }, frf.D1);
    const R2 = cDiv({ re: Q[1], im: 0 }, frf.D2);
    return { X1, X2, R1, R2, Q };
  }

  /* ------------------------------------------------------------------
   * Free Response Trajectory (Closed-Form Modal or RK4 Coupled)
   * ---------------------------------------------------------------- */
  function eval1DOFModal(wn, zeta, r0, dr0, t) {
    if (zeta < 1 - 1e-6) {
      const wd = wn * Math.sqrt(1 - zeta * zeta);
      const decay = Math.exp(-zeta * wn * t);
      const A = r0;
      const B = (dr0 + zeta * wn * r0) / wd;
      const c = Math.cos(wd * t);
      const s = Math.sin(wd * t);
      const r = decay * (A * c + B * s);
      const dr = decay * ((-zeta * wn * A + wd * B) * c + (-zeta * wn * B - wd * A) * s);
      return [r, dr];
    } else if (Math.abs(zeta - 1) <= 1e-6) {
      const decay = Math.exp(-wn * t);
      const A = r0;
      const B = dr0 + wn * r0;
      const r = decay * (A + B * t);
      const dr = decay * (B - wn * (A + B * t));
      return [r, dr];
    } else {
      const sq = wn * Math.sqrt(zeta * zeta - 1);
      const s1 = -zeta * wn + sq;
      const s2 = -zeta * wn - sq;
      const c1 = (dr0 - s2 * r0) / (s1 - s2);
      const c2 = (s1 * r0 - dr0) / (s1 - s2);
      const e1 = Math.exp(s1 * t);
      const e2 = Math.exp(s2 * t);
      return [c1 * e1 + c2 * e2, c1 * s1 * e1 + c2 * s2 * e2];
    }
  }

  function simulateFreeResponse(sys, x0, v0, tMax, nSteps) {
    const N = nSteps || 450;
    const dt = tMax / N;
    const out = {
      t: new Array(N + 1),
      x1: new Array(N + 1),
      x2: new Array(N + 1),
      r1: new Array(N + 1),
      r2: new Array(N + 1),
      E1: new Array(N + 1),
      E2: new Array(N + 1)
    };

    if (sys.isProportional) {
      const r0 = physToModal(sys, x0);
      const dr0 = physToModal(sys, v0);
      for (let i = 0; i <= N; i++) {
        const t = i * dt;
        const m1s = eval1DOFModal(sys.w1, sys.zeta1, r0[0], dr0[0], t);
        const m2s = eval1DOFModal(sys.w2, sys.zeta2, r0[1], dr0[1], t);
        const x = modalToPhys(sys, [m1s[0], m2s[0]]);
        out.t[i] = t;
        out.r1[i] = m1s[0];
        out.r2[i] = m2s[0];
        out.x1[i] = x[0];
        out.x2[i] = x[1];
        out.E1[i] = 0.5 * (m1s[1] * m1s[1] + sys.lam1 * m1s[0] * m1s[0]);
        out.E2[i] = 0.5 * (m2s[1] * m2s[1] + sys.lam2 * m2s[0] * m2s[0]);
      }
      return out;
    }

    // Coupled RK4 in physical state [x1, x2, v1, v2]
    const im1 = 1 / sys.params.m1;
    const im2 = 1 / sys.params.m2;
    const K = sys.K;
    const C = sys.C;

    function deriv(s) {
      const a1 = -im1 * (C[0][0] * s[2] + C[0][1] * s[3] + K[0][0] * s[0] + K[0][1] * s[1]);
      const a2 = -im2 * (C[1][0] * s[2] + C[1][1] * s[3] + K[1][0] * s[0] + K[1][1] * s[1]);
      return [s[2], s[3], a1, a2];
    }

    let state = [x0[0], x0[1], v0[0], v0[1]];
    const sub = 4;
    const h = dt / sub;

    for (let i = 0; i <= N; i++) {
      const t = i * dt;
      const r = physToModal(sys, [state[0], state[1]]);
      const dr = physToModal(sys, [state[2], state[3]]);
      out.t[i] = t;
      out.x1[i] = state[0];
      out.x2[i] = state[1];
      out.r1[i] = r[0];
      out.r2[i] = r[1];
      out.E1[i] = 0.5 * (dr[0] * dr[0] + sys.lam1 * r[0] * r[0]);
      out.E2[i] = 0.5 * (dr[1] * dr[1] + sys.lam2 * r[1] * r[1]);

      if (i < N) {
        for (let s = 0; s < sub; s++) {
          const k1 = deriv(state);
          const s2 = state.map((val, idx) => val + 0.5 * h * k1[idx]);
          const k2 = deriv(s2);
          const s3 = state.map((val, idx) => val + 0.5 * h * k2[idx]);
          const k3 = deriv(s3);
          const s4 = state.map((val, idx) => val + h * k3[idx]);
          const k4 = deriv(s4);
          state = state.map((val, idx) => val + (h / 6) * (k1[idx] + 2 * k2[idx] + 2 * k3[idx] + k4[idx]));
        }
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------
   * Formatting & Canvas Theme Helpers
   * ---------------------------------------------------------------- */
  function fmt(val, dec) {
    const d = dec === undefined ? 2 : dec;
    if (!Number.isFinite(val)) return '0';
    const v = Math.abs(val) < 0.5 * Math.pow(10, -d) ? 0 : val;
    return v.toFixed(d);
  }

  function getThemeColors() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return dark
      ? {
          dark: true,
          bg: '#132433',
          bgSubtle: '#192e40',
          grid: 'rgba(169, 182, 191, 0.14)',
          gridStrong: 'rgba(169, 182, 191, 0.30)',
          axis: '#c8d4de',
          text: '#f2f4f6',
          textMuted: '#a9b6bf',
          blue: '#4dbeee',
          orange: '#f0834f',
          teal: '#26b5a6',
          purple: '#c584d6',
          crimson: '#f0657f',
          amber: '#edb120',
          copper: '#d98a52',
          ref: '#8f9ba6',
          navy: '#e6edf3'
        }
      : {
          dark: false,
          bg: '#ffffff',
          bgSubtle: '#f7f6f2',
          grid: 'rgba(19, 36, 51, 0.08)',
          gridStrong: 'rgba(19, 36, 51, 0.22)',
          axis: '#132433',
          text: '#132433',
          textMuted: '#5b6168',
          blue: '#0072bd',
          orange: '#d95319',
          teal: '#00897b',
          purple: '#7e2f8e',
          crimson: '#a2142f',
          amber: '#c78f00',
          copper: '#b4622a',
          ref: '#8a8578',
          navy: '#132433'
        };
  }

  function setupCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(10, Math.round(rect.width));
    const h = Math.max(10, Math.round(rect.height));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function drawArrow(ctx, x1, y1, x2, y2, color, width, headLen) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1.5) return;
    const hl = Math.min(headLen || 9, len * 0.45);
    const ang = Math.atan2(dy, dx);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width || 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - Math.cos(ang) * (hl * 0.65), y2 - Math.sin(ang) * (hl * 0.65));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - hl * Math.cos(ang - 0.38), y2 - hl * Math.sin(ang - 0.38));
    ctx.lineTo(x2 - hl * Math.cos(ang + 0.38), y2 - hl * Math.sin(ang + 0.38));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawSpring(ctx, x1, y1, x2, y2, coils, amp, color, lw) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const L = Math.hypot(dx, dy);
    if (L < 4) return;
    const ux = dx / L;
    const uy = dy / L;
    const nx = -uy;
    const ny = ux;
    const lead = Math.min(12, L * 0.16);
    const body = L - 2 * lead;
    const n = coils || 7;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw || 1.7;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + ux * lead, y1 + uy * lead);
    for (let i = 0; i < n; i++) {
      const f1 = lead + ((i + 0.25) / n) * body;
      const f2 = lead + ((i + 0.75) / n) * body;
      ctx.lineTo(x1 + ux * f1 + nx * amp, y1 + uy * f1 + ny * amp);
      ctx.lineTo(x1 + ux * f2 - nx * amp, y1 + uy * f2 - ny * amp);
    }
    ctx.lineTo(x2 - ux * lead, y2 - uy * lead);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawDamper(ctx, x1, y1, x2, y2, color, lw) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const L = Math.hypot(dx, dy);
    if (L < 12) return;
    const ux = dx / L;
    const uy = dy / L;
    const nx = -uy;
    const ny = ux;
    const mid = L * 0.5;
    const boxHalf = Math.min(10, L * 0.18);
    const h = 6;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw || 1.5;
    // Left rod + piston
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + ux * mid, y1 + uy * mid);
    ctx.moveTo(x1 + ux * mid - nx * (h - 2), y1 + uy * mid - ny * (h - 2));
    ctx.lineTo(x1 + ux * mid + nx * (h - 2), y1 + uy * mid + ny * (h - 2));
    ctx.stroke();

    // Right cylinder housing
    const cStart = mid - boxHalf * 0.5;
    const cEnd = mid + boxHalf;
    ctx.beginPath();
    ctx.moveTo(x1 + ux * cStart + nx * h, y1 + uy * cStart + ny * h);
    ctx.lineTo(x1 + ux * cEnd + nx * h, y1 + uy * cEnd + ny * h);
    ctx.lineTo(x1 + ux * cEnd - nx * h, y1 + uy * cEnd - ny * h);
    ctx.lineTo(x1 + ux * cStart - nx * h, y1 + uy * cStart - ny * h);
    ctx.moveTo(x1 + ux * cEnd, y1 + uy * cEnd);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  window.VibLab.MathModal2DOF = {
    EPS,
    PRESETS,
    cAdd,
    cSub,
    cMul,
    cDiv,
    cAbs,
    cArg,
    eigSym2x2,
    analyzeSystem,
    physToMassNorm,
    massNormToPhys,
    physToModal,
    modalToPhys,
    forceToModal,
    evalFRF,
    evalForcedHarmonic,
    eval1DOFModal,
    simulateFreeResponse,
    fmt
  };

  window.VibLab.Theme = {
    get: getThemeColors,
    setupCanvas,
    drawArrow,
    drawSpring,
    drawDamper
  };
})();
