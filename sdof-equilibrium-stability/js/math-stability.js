/**
 * math-stability.js
 * Exact linear state-space algebra, eigenvalue/eigenvector analysis,
 * closed-form matrix exponential exp(A*t) for all 1-DOF companion regimes,
 * Poincaré (trace, determinant) classification, Liouville phase-area evolution,
 * and nonlinear 1-DOF RK4 models (damped pendulum, double-well Duffing, nonlinear damping).
 */
window.VibLab = window.VibLab || {};

window.VibLab.Theme = (function () {
  'use strict';

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function colors() {
    if (isDark()) {
      return {
        bg: '#132433',
        panelBg: '#0e1b27',
        grid: 'rgba(169, 182, 191, 0.14)',
        axis: 'rgba(242, 244, 246, 0.56)',
        text: '#f2f4f6',
        muted: '#a9b6bf',
        navy: '#f2f4f6',
        copper: '#d98a52',
        blue: '#4dbeee',
        orange: '#f0834f',
        teal: '#26b5a6',
        purple: '#c584d6',
        crimson: '#f0657f',
        amber: '#edb120',
        ref: '#8f9ba6',
        stableFill: 'rgba(38, 181, 166, 0.12)',
        unstableFill: 'rgba(240, 101, 127, 0.11)',
        saddleFill: 'rgba(197, 132, 214, 0.11)',
        nodeFill: 'rgba(77, 190, 238, 0.11)',
        patchFill: 'rgba(217, 138, 82, 0.24)'
      };
    }
    return {
      bg: '#ffffff',
      panelBg: '#f7f6f2',
      grid: 'rgba(19, 36, 51, 0.09)',
      axis: 'rgba(19, 36, 51, 0.54)',
      text: '#132433',
      muted: '#5b6168',
      navy: '#132433',
      copper: '#b4622a',
      blue: '#0072bd',
      orange: '#d95319',
      teal: '#00897b',
      purple: '#7e2f8e',
      crimson: '#a2142f',
      amber: '#c78f00',
      ref: '#8a8578',
      stableFill: 'rgba(0, 137, 123, 0.08)',
      unstableFill: 'rgba(162, 20, 47, 0.07)',
      saddleFill: 'rgba(126, 47, 142, 0.07)',
      nodeFill: 'rgba(0, 114, 189, 0.08)',
      patchFill: 'rgba(180, 98, 42, 0.20)'
    };
  }

  function setupHiDPI(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(10, Math.round(rect.width));
    const h = Math.max(10, Math.round(rect.height));
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h, dpr };
  }

  return { isDark, colors, setupHiDPI };
})();

window.VibLab.MathStab = (function () {
  'use strict';

  const EPS = 1e-3;

  function fmt(v, digits) {
    if (!Number.isFinite(v)) return '∞';
    const d = digits === undefined ? 2 : digits;
    const clean = Math.abs(v) < Math.pow(10, -(d + 2)) ? 0 : v;
    return clean.toFixed(d);
  }

  function fmtSigned(v, digits) {
    const d = digits === undefined ? 2 : digits;
    const clean = Math.abs(v) < Math.pow(10, -(d + 2)) ? 0 : v;
    return (clean >= 0 ? '+' : '−') + Math.abs(clean).toFixed(d);
  }

  function fmtTexSigned(v, digits) {
    const d = digits === undefined ? 2 : digits;
    const clean = Math.abs(v) < Math.pow(10, -(d + 2)) ? 0 : v;
    return (clean >= 0 ? '+ ' : '- ') + Math.abs(clean).toFixed(d);
  }

  /**
   * Canonical presets spanning every distinct region and boundary of the
   * Poincaré trace-determinant plane (tau = -c/m, delta = k/m) with m = 1 kg.
   */
  const PRESETS = {
    stable_spiral: {
      key: 'stable_spiral',
      label: 'Stable spiral',
      shortLabel: 'Underdamped',
      tau: -0.8,
      delta: 2.25,
      description:
        'Positive restoring stiffness ($\\Delta > 0$) and positive damping ($\\tau < 0$) with $\\tau^2 < 4\\Delta$: complex-conjugate eigenvalues in the left half-plane produce inward spirals.'
    },
    stable_node: {
      key: 'stable_node',
      label: 'Stable node',
      shortLabel: 'Overdamped',
      tau: -3.2,
      delta: 1.75,
      description:
        'Strong damping ($\\tau < 0$, $0 < \\Delta < \\tau^2/4$): two distinct negative real eigenvalues yield non-oscillatory decay tangent to the slower eigendirection.'
    },
    degenerate_stable: {
      key: 'degenerate_stable',
      label: 'Critically damped',
      shortLabel: 'Improper stable',
      tau: -3.0,
      delta: 2.25,
      star: false,
      description:
        'On the discriminant parabola ($\\Delta = \\tau^2/4$, $\\tau < 0$, mechanical $A_{12}=1$): geometric multiplicity is $1 < 2$, so eigendirections coalesce into one invariant line with Jordan shear.'
    },
    degenerate_unstable: {
      key: 'degenerate_unstable',
      label: 'Improper unstable',
      shortLabel: 'Improper unstable',
      tau: 3.0,
      delta: 2.25,
      star: false,
      description:
        'Unstable improper (degenerate) node ($\\Delta = \\tau^2/4$, $\\tau > 0$, $A_{12} = 1$): single invariant eigendirection $[1, \\tau/2]^{\\mathsf{T}}$ with outward Jordan shear $t\\mathrm{e}^{(\\tau/2)t}$.'
    },
    star_stable: {
      key: 'star_stable',
      label: 'Stable star',
      shortLabel: 'Proper node',
      tau: -3.0,
      delta: 2.25,
      star: true,
      description:
        'Stable star (proper) node ($\\Delta = \\tau^2/4$, $\\tau < 0$, AND $\\mathbf{A} = \\lambda\\mathbf{I}$): geometric multiplicity $2$ means every direction is an eigenvector, producing pure inward radial rays. Requires a non-companion system ($A_{12} = 0$).'
    },
    star_unstable: {
      key: 'star_unstable',
      label: 'Unstable star',
      shortLabel: 'Proper node',
      tau: 3.0,
      delta: 2.25,
      star: true,
      description:
        'Unstable star (proper) node ($\\Delta = \\tau^2/4$, $\\tau > 0$, AND $\\mathbf{A} = \\lambda\\mathbf{I}$): geometric multiplicity $2$ gives pure outward radial rays along every direction. Requires a non-companion system ($A_{12} = 0$).'
    },
    center: {
      key: 'center',
      label: 'Center',
      shortLabel: 'Undamped',
      tau: 0.0,
      delta: 2.25,
      description:
        'Conservative potential bowl ($\\tau = 0$, $\\Delta > 0$): purely imaginary eigenvalues $\\pm\\mathrm{i}\\sqrt{\\Delta}$ produce closed ellipses. Lyapunov stable, but non-hyperbolic and structurally unstable.'
    },
    saddle: {
      key: 'saddle',
      label: 'Saddle',
      shortLabel: 'Inverted potential',
      tau: -0.5,
      delta: -2.0,
      description:
        'Negative effective stiffness ($\\Delta < 0$, potential hilltop): eigenvalues have opposite signs for every damping value $\\tau$. One stable manifold $E^{\\mathrm{s}}$ and one unstable manifold $E^{\\mathrm{u}}$.'
    },
    unstable_spiral: {
      key: 'unstable_spiral',
      label: 'Unstable spiral',
      shortLabel: 'Negative damping',
      tau: 0.8,
      delta: 2.25,
      description:
        'Positive stiffness ($\\Delta > 0$) with negative damping ($\\tau > 0$, e.g. flutter or self-excitation): complex eigenvalues in the right half-plane drive expanding spirals.'
    },
    unstable_node: {
      key: 'unstable_node',
      label: 'Unstable node',
      shortLabel: 'Strong injection',
      tau: 3.2,
      delta: 1.75,
      description:
        'Strong energy injection ($\\tau > 0$, $0 < \\Delta < \\tau^2/4$): two distinct positive real eigenvalues push trajectories away from the origin along the faster eigendirection.'
    },
    zero_det: {
      key: 'zero_det',
      label: 'Non-isolated ($\u0394=0$)',
      shortLabel: 'Zero stiffness',
      tau: -1.4,
      delta: 0.0,
      description:
        'Zero stiffness ($\\Delta = 0$, $\\tau < 0$): one eigenvalue is $\\lambda_1 = 0$, so the entire $x$-axis ($v = 0$) is a line of equilibria approached along parallel lines of slope $\\tau$.'
    }
  };

  /**
   * Analyze the linearized 2D system matrix:
   * - Mechanical 1-DOF companion matrix (default): A = [[0, 1], [-delta, tau]]
   * - Star (proper) node when options.star === true on the discriminant parabola
   *   Delta = tau^2/4 (tau != 0): A = [[lambda, 0], [0, lambda]] with lambda = tau/2.
   */
  function analyzeLinear(tau, delta, options) {
    const reqStar = !!(options && options.star);
    const disc = tau * tau - 4 * delta;
    const isZeroTau = Math.abs(tau) < EPS;
    const isZeroDelta = Math.abs(delta) < EPS;
    const isZeroDisc = Math.abs(disc) < 0.025;
    const isStar = reqStar && isZeroDisc && !isZeroTau && delta > EPS;

    let regime = '';
    let regimeName = '';
    let stability = ''; // 'asymptotic' | 'lyapunov' | 'unstable'
    let stabilityLabel = '';
    let hyperbolic = true;
    let eigType = 'real_distinct'; // 'real_distinct' | 'real_repeated' | 'real_star' | 'complex'

    let l1 = { re: 0, im: 0 };
    let l2 = { re: 0, im: 0 };

    if (isZeroDelta && isZeroTau) {
      regime = 'nilpotent';
      regimeName = 'Nilpotent shear (free particle)';
      stability = 'unstable';
      stabilityLabel = 'Unstable (linear drift)';
      hyperbolic = false;
      eigType = 'real_repeated';
      l1 = { re: 0, im: 0 };
      l2 = { re: 0, im: 0 };
    } else if (isZeroDelta) {
      regime = tau < 0 ? 'line_stable' : 'line_unstable';
      regimeName = tau < 0 ? 'Line of stable equilibria' : 'Line of unstable equilibria';
      stability = tau < 0 ? 'lyapunov' : 'unstable';
      stabilityLabel = tau < 0 ? 'Lyapunov stable (non-isolated)' : 'Unstable (non-isolated)';
      hyperbolic = false;
      eigType = 'real_distinct';
      l1 = { re: 0, im: 0 };
      l2 = { re: tau, im: 0 };
    } else if (delta < -EPS) {
      const s = Math.sqrt(disc);
      regime = 'saddle';
      regimeName = 'Saddle point';
      stability = 'unstable';
      stabilityLabel = 'Unstable (hyperbolic saddle)';
      hyperbolic = true;
      eigType = 'real_distinct';
      l1 = { re: 0.5 * (tau - s), im: 0 }; // negative (stable)
      l2 = { re: 0.5 * (tau + s), im: 0 }; // positive (unstable)
    } else if (isZeroTau && delta > EPS) {
      const w = Math.sqrt(delta);
      regime = 'center';
      regimeName = 'Center (conservative)';
      stability = 'lyapunov';
      stabilityLabel = 'Lyapunov stable (not asymptotic)';
      hyperbolic = false;
      eigType = 'complex';
      l1 = { re: 0, im: w };
      l2 = { re: 0, im: -w };
    } else if (isStar) {
      const r = 0.5 * tau;
      regime = tau < 0 ? 'star_stable' : 'star_unstable';
      regimeName = tau < 0 ? 'Stable star node (proper)' : 'Unstable star node (proper)';
      stability = tau < 0 ? 'asymptotic' : 'unstable';
      stabilityLabel = tau < 0 ? 'Asymptotically stable' : 'Unstable';
      hyperbolic = true;
      eigType = 'real_star';
      l1 = { re: r, im: 0 };
      l2 = { re: r, im: 0 };
    } else if (isZeroDisc && delta > EPS) {
      const r = 0.5 * tau;
      regime = tau < 0 ? 'degenerate_stable' : 'degenerate_unstable';
      regimeName = tau < 0 ? 'Degenerate stable node (improper)' : 'Degenerate unstable node (improper)';
      stability = tau < 0 ? 'asymptotic' : 'unstable';
      stabilityLabel = tau < 0 ? 'Asymptotically stable' : 'Unstable';
      hyperbolic = true;
      eigType = 'real_repeated';
      l1 = { re: r, im: 0 };
      l2 = { re: r, im: 0 };
    } else if (disc < 0) {
      const re = 0.5 * tau;
      const im = 0.5 * Math.sqrt(Math.max(0, -disc));
      regime = tau < 0 ? 'stable_spiral' : 'unstable_spiral';
      regimeName = tau < 0 ? 'Stable spiral (focus)' : 'Unstable spiral (focus)';
      stability = tau < 0 ? 'asymptotic' : 'unstable';
      stabilityLabel = tau < 0 ? 'Asymptotically stable' : 'Unstable';
      hyperbolic = true;
      eigType = 'complex';
      l1 = { re: re, im: im };
      l2 = { re: re, im: -im };
    } else {
      const s = Math.sqrt(Math.max(0, disc));
      const rA = 0.5 * (tau + s);
      const rB = 0.5 * (tau - s);
      // Order so l1 is the slower (smaller |lambda|) eigenvalue, l2 is the faster
      if (Math.abs(rA) <= Math.abs(rB)) {
        l1 = { re: rA, im: 0 };
        l2 = { re: rB, im: 0 };
      } else {
        l1 = { re: rB, im: 0 };
        l2 = { re: rA, im: 0 };
      }
      regime = tau < 0 ? 'stable_node' : 'unstable_node';
      regimeName = tau < 0 ? 'Stable node' : 'Unstable node';
      stability = tau < 0 ? 'asymptotic' : 'unstable';
      stabilityLabel = tau < 0 ? 'Asymptotically stable' : 'Unstable';
      hyperbolic = true;
      eigType = 'real_distinct';
    }

    // Matrix A
    const A = isStar
      ? [
          [0.5 * tau, 0],
          [0, 0.5 * tau]
        ]
      : [
          [0, 1],
          [-delta, tau]
        ];

    // Eigenvectors
    const eigenvectors = [];
    if (eigType === 'real_distinct') {
      const n1 = Math.hypot(1, l1.re);
      const n2 = Math.hypot(1, l2.re);
      eigenvectors.push({
        lambda: l1.re,
        x: 1 / n1,
        v: l1.re / n1,
        raw: [1, l1.re],
        role:
          regime === 'saddle'
            ? 'stable'
            : regime === 'line_stable' || regime === 'line_unstable'
              ? 'zero'
              : 'slow'
      });
      eigenvectors.push({
        lambda: l2.re,
        x: 1 / n2,
        v: l2.re / n2,
        raw: [1, l2.re],
        role:
          regime === 'saddle'
            ? 'unstable'
            : regime === 'line_stable' || regime === 'line_unstable'
              ? 'nonzero'
              : 'fast'
      });
    } else if (eigType === 'real_repeated') {
      const r = l1.re;
      const n1 = Math.hypot(1, r);
      eigenvectors.push({
        lambda: r,
        x: 1 / n1,
        v: r / n1,
        raw: [1, r],
        role: 'repeated'
      });
    } else if (eigType === 'real_star') {
      const r = l1.re;
      eigenvectors.push({ lambda: r, x: 1, v: 0, raw: [1, 0], role: 'star' });
      eigenvectors.push({ lambda: r, x: 0, v: 1, raw: [0, 1], role: 'star' });
    }

    // Effective damping ratio when delta > 0
    const wn = delta > EPS ? Math.sqrt(delta) : null;
    const zeta = wn ? -tau / (2 * wn) : null;

    return {
      tau,
      delta,
      disc,
      A,
      isStar,
      onParabola: isZeroDisc && !isZeroTau && delta > EPS,
      regime,
      regimeName,
      stability,
      stabilityLabel,
      hyperbolic,
      eigType,
      l1,
      l2,
      eigenvectors,
      wn,
      zeta
    };
  }

  /**
   * Exact closed-form state transition z(t) = exp(A*t) * z0.
   * Handles both the 1-DOF companion matrix and scalar star matrix A = (tau/2) I.
   */
  function evalFlow(sys, z0, t) {
    const x0 = z0[0];
    const v0 = z0[1];
    const tau = sys.tau;
    const delta = sys.delta;
    const disc = tau * tau - 4 * delta;

    // Guard against overflow for large positive growth
    const maxExp = 40;

    if (sys.isStar) {
      const r = 0.5 * tau;
      const rt = Math.max(-maxExp, Math.min(maxExp, r * t));
      const e = Math.exp(rt);
      return [e * x0, e * v0];
    }

    if (Math.abs(disc) < 1e-7) {
      // Repeated root r = tau / 2
      const r = 0.5 * tau;
      const rt = Math.max(-maxExp, Math.min(maxExp, r * t));
      const e = Math.exp(rt);
      // exp(A t) = e^(r t) * [ 1 - r t,       t     ]
      //                      [ -r^2 t,      1 + r t ]
      const x = e * ((1 - r * t) * x0 + t * v0);
      const v = e * (-r * r * t * x0 + (1 + r * t) * v0);
      return [x, v];
    }

    if (disc > 0) {
      // Two distinct real roots r1, r2
      const s = Math.sqrt(disc);
      const r1 = 0.5 * (tau - s);
      const r2 = 0.5 * (tau + s);
      const e1 = Math.exp(Math.max(-maxExp, Math.min(maxExp, r1 * t)));
      const e2 = Math.exp(Math.max(-maxExp, Math.min(maxExp, r2 * t)));
      const invDiff = 1 / (r2 - r1);
      // exp(A t) = (1/(r2-r1)) * [ r2 e1 - r1 e2,         e2 - e1       ]
      //                          [ r1 r2 (e1 - e2),   r2 e2 - r1 e1     ]
      // Note r1*r2 = delta, so lower-left is -delta*(e2 - e1) = r1*r2*(e1 - e2)
      const m11 = (r2 * e1 - r1 * e2) * invDiff;
      const m12 = (e2 - e1) * invDiff;
      const m21 = -delta * m12;
      const m22 = (r2 * e2 - r1 * e1) * invDiff;
      return [m11 * x0 + m12 * v0, m21 * x0 + m22 * v0];
    }

    // Complex conjugate roots sigma +/- i*omega
    const sigma = 0.5 * tau;
    const omega = 0.5 * Math.sqrt(-disc);
    const e = Math.exp(Math.max(-maxExp, Math.min(maxExp, sigma * t)));
    const ct = Math.cos(omega * t);
    const st = Math.sin(omega * t);
    const sOverW = st / omega;
    // exp(A t) = e^(sigma t) * [ cos(wt) - (sigma/w) sin(wt),    (1/w) sin(wt)               ]
    //                          [ -(delta/w) sin(wt),             cos(wt) + (sigma/w) sin(wt) ]
    const m11 = e * (ct - sigma * sOverW);
    const m12 = e * sOverW;
    const m21 = -e * delta * sOverW;
    const m22 = e * (ct + sigma * sOverW);
    return [m11 * x0 + m12 * v0, m21 * x0 + m22 * v0];
  }

  /**
   * Canonical modal coordinate transformation y = P^{-1} z and inverse z = P y.
   */
  function canonicalBasis(sys) {
    if (sys.isStar) {
      return {
        kind: 'star',
        label: 'Isotropic star basis (A = λI)',
        P: [
          [1, 0],
          [0, 1]
        ],
        toModal: function (z) {
          return [z[0], z[1]];
        },
        toPhys: function (y) {
          return [y[0], y[1]];
        }
      };
    }

    if (sys.eigType === 'complex') {
      const sigma = sys.l1.re;
      const omega = Math.max(1e-4, Math.abs(sys.l1.im));
      // P = [[1, 0], [sigma, omega]] -> det(P) = omega
      return {
        kind: 'rotation_scaling',
        label: 'Invariant rotation–scaling basis',
        P: [
          [1, 0],
          [sigma, omega]
        ],
        toModal: function (z) {
          return [z[0], (z[1] - sigma * z[0]) / omega];
        },
        toPhys: function (y) {
          return [y[0], sigma * y[0] + omega * y[1]];
        }
      };
    }

    if (sys.eigType === 'real_repeated') {
      const r = sys.l1.re;
      // P = [[1, 0], [r, 1]] -> P^{-1} A P = [[r, 1], [0, r]]
      return {
        kind: 'jordan',
        label: 'Jordan canonical basis (shear)',
        P: [
          [1, 0],
          [r, 1]
        ],
        toModal: function (z) {
          return [z[0], z[1] - r * z[0]];
        },
        toPhys: function (y) {
          return [y[0], r * y[0] + y[1]];
        }
      };
    }

    // Real distinct: use normalized eigenvectors v1, v2
    const v1 = sys.eigenvectors[0];
    const v2 = sys.eigenvectors[1];
    const detP = v1.x * v2.v - v2.x * v1.v;
    const safeDet = Math.abs(detP) < 1e-6 ? 1e-6 : detP;
    return {
      kind: 'diagonal',
      label: 'Eigenvector diagonal basis',
      P: [
        [v1.x, v2.x],
        [v1.v, v2.v]
      ],
      toModal: function (z) {
        return [
          (v2.v * z[0] - v2.x * z[1]) / safeDet,
          (-v1.v * z[0] + v1.x * z[1]) / safeDet
        ];
      },
      toPhys: function (y) {
        return [v1.x * y[0] + v2.x * y[1], v1.v * y[0] + v2.v * y[1]];
      }
    };
  }

  /**
   * Signed polygon area using the shoelace formula (to verify Liouville's S(t) = S(0) e^(tau*t)).
   */
  function polygonArea(pts) {
    let sum = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      sum += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
    }
    return 0.5 * Math.abs(sum);
  }

  /* ========================================================================
   * Nonlinear 1-DOF Models for Section 5 (Hartman-Grobman & Global Phase Plane)
   * ======================================================================== */
  const NONLINEAR_MODELS = {
    pendulum: {
      key: 'pendulum',
      name: 'Damped pendulum',
      eqTex: '\\ddot{\\theta} + \\gamma\\dot{\\theta} + \\omega_0^2 \\sin\\theta = 0',
      potTex: 'V(\\theta) = \\omega_0^2 (1 - \\cos\\theta)',
      xLabel: 'θ [rad]',
      vLabel: 'θ̇ [rad/s]',
      xMin: -4.4,
      xMax: 4.4,
      vMin: -3.2,
      vMax: 3.2,
      paramName: 'Damping γ',
      paramMin: -0.6,
      paramMax: 1.8,
      paramStep: 0.05,
      defaultParam: 0.25,
      rhs: function (x, v, gamma) {
        const w0sq = 1.44; // omega_0 = 1.2 rad/s
        return [v, -w0sq * Math.sin(x) - gamma * v];
      },
      potential: function (x) {
        const w0sq = 1.44;
        return w0sq * (1 - Math.cos(x));
      },
      equilibria: function (gamma) {
        const w0sq = 1.44;
        return [
          {
            id: 'down',
            label: 'Downward well (θ* = 0)',
            x: 0,
            v: 0,
            tau: -gamma,
            delta: w0sq,
            note:
              Math.abs(gamma) < 1e-3
                ? 'Non-hyperbolic center: conserved energy H = ½θ̇² + ω₀²(1 − cosθ) preserves closed orbits in the nonlinear system.'
                : 'Hyperbolic equilibrium: Hartman–Grobman guarantees the local nonlinear flow matches the linearized spiral or node.'
          },
          {
            id: 'up_pos',
            label: 'Inverted hilltop (θ* = +π)',
            x: Math.PI,
            v: 0,
            tau: -gamma,
            delta: -w0sq,
            note:
              'Hyperbolic saddle for every γ: negative potential curvature V″(π) = −ω₀² < 0 produces one stable and one unstable manifold.'
          },
          {
            id: 'up_neg',
            label: 'Inverted hilltop (θ* = −π)',
            x: -Math.PI,
            v: 0,
            tau: -gamma,
            delta: -w0sq,
            note:
              'Hyperbolic saddle for every γ: symmetric inverted equilibrium whose stable manifold separates swings from full rotations.'
          }
        ];
      }
    },
    duffing: {
      key: 'duffing',
      name: 'Double-well Duffing',
      eqTex: '\\ddot{x} + \\gamma\\dot{x} - x + x^3 = 0',
      potTex: 'V(x) = -\\tfrac{1}{2}x^2 + \\tfrac{1}{4}x^4',
      xLabel: 'x [m]',
      vLabel: 'v [m/s]',
      xMin: -2.2,
      xMax: 2.2,
      vMin: -1.9,
      vMax: 1.9,
      paramName: 'Damping γ',
      paramMin: -0.4,
      paramMax: 1.8,
      paramStep: 0.05,
      defaultParam: 0.3,
      rhs: function (x, v, gamma) {
        return [v, x - x * x * x - gamma * v];
      },
      potential: function (x) {
        return -0.5 * x * x + 0.25 * x * x * x * x + 0.25;
      },
      equilibria: function (gamma) {
        return [
          {
            id: 'well_left',
            label: 'Left well (x* = −1)',
            x: -1,
            v: 0,
            tau: -gamma,
            delta: 2.0,
            note:
              Math.abs(gamma) < 1e-3
                ? 'Non-hyperbolic center inside the left potential well (V″(−1) = +2).'
                : 'Hyperbolic well attractor (γ > 0) or repeller (γ < 0); local stiffness is V″(−1) = +2.'
          },
          {
            id: 'hilltop',
            label: 'Central hilltop (x* = 0)',
            x: 0,
            v: 0,
            tau: -gamma,
            delta: -1.0,
            note:
              'Hyperbolic saddle at the potential maximum (V″(0) = −1). When γ > 0, its stable manifold divides the phase plane into the left and right basins of attraction.'
          },
          {
            id: 'well_right',
            label: 'Right well (x* = +1)',
            x: 1,
            v: 0,
            tau: -gamma,
            delta: 2.0,
            note:
              Math.abs(gamma) < 1e-3
                ? 'Non-hyperbolic center inside the right potential well (V″(+1) = +2).'
                : 'Hyperbolic well attractor (γ > 0) or repeller (γ < 0); local stiffness is V″(+1) = +2.'
          }
        ];
      }
    },
    nl_center: {
      key: 'nl_center',
      name: 'Non-hyperbolic center test',
      eqTex: '\\ddot{x} + \\beta x^2 \\dot{x} + x = 0',
      potTex: 'V(x) = \\tfrac{1}{2}x^2 \\;\\;(\\text{nonlinear damping } \\beta x^2\\dot{x})',
      xLabel: 'x [m]',
      vLabel: 'v [m/s]',
      xMin: -2.2,
      xMax: 2.2,
      vMin: -2.2,
      vMax: 2.2,
      paramName: 'Nonlinear damping β',
      paramMin: -1.2,
      paramMax: 1.2,
      paramStep: 0.05,
      defaultParam: 0.65,
      rhs: function (x, v, beta) {
        return [v, -x - beta * x * x * v];
      },
      potential: function (x) {
        return 0.5 * x * x;
      },
      equilibria: function (beta) {
        let verdict =
          'For β = 0 the system is strictly linear and the origin is a true center.';
        if (beta > 0.02) {
          verdict =
            'Linearization has τ = 0, Δ = 1 (predicts a center), yet Ė = −βx²v² ≤ 0 makes the true nonlinear origin asymptotically stable. Hartman–Grobman fails at a center.';
        } else if (beta < -0.02) {
          verdict =
            'Linearization has τ = 0, Δ = 1 (predicts a center), yet Ė = −βx²v² ≥ 0 injects energy and makes the true nonlinear origin unstable. Hartman–Grobman fails at a center.';
        }
        return [
          {
            id: 'origin',
            label: 'Origin (x* = 0, linear center)',
            x: 0,
            v: 0,
            tau: 0,
            delta: 1.0,
            note: verdict
          }
        ];
      }
    }
  };

  /**
   * 4th-order Runge-Kutta trajectory integrator for nonlinear 1-DOF systems.
   */
  function integrateNonlinear(model, param, x0, v0, dt, steps, bounds) {
    const pts = [[x0, v0]];
    let x = x0;
    let v = v0;
    const xLim = bounds ? bounds.xLim : 8;
    const vLim = bounds ? bounds.vLim : 8;

    for (let i = 0; i < steps; i++) {
      const k1 = model.rhs(x, v, param);
      const k2 = model.rhs(x + 0.5 * dt * k1[0], v + 0.5 * dt * k1[1], param);
      const k3 = model.rhs(x + 0.5 * dt * k2[0], v + 0.5 * dt * k2[1], param);
      const k4 = model.rhs(x + dt * k3[0], v + dt * k3[1], param);
      x += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      v += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      if (!Number.isFinite(x) || !Number.isFinite(v)) break;
      if (Math.abs(x) > xLim || Math.abs(v) > vLim) {
        pts.push([x, v]);
        break;
      }
      pts.push([x, v]);
    }
    return pts;
  }

  return {
    EPS,
    fmt,
    fmtSigned,
    fmtTexSigned,
    PRESETS,
    analyzeLinear,
    evalFlow,
    canonicalBasis,
    polygonArea,
    NONLINEAR_MODELS,
    integrateNonlinear
  };
})();
