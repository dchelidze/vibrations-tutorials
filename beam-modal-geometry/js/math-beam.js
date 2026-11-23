/**
 * math-beam.js
 * Exact analytical & cancellation-free Euler-Bernoulli beam eigenproblem engine for Module 11:
 * Continuous Beams as Infinite-DOF Modal Geometry.
 *
 * Dimensionless spatial coordinate: xi = x / L in [0, 1]
 * Dimensionless wavenumber:         lam_n = beta_n * L
 * Natural frequencies:              w_n = lam_n^2 * sqrt(EI / (rho A L^4))
 *
 * Boundary conditions supported:
 *   'CF' (Clamped-Free cantilever):   cos(lam) cosh(lam) = -1
 *   'SS' (Pinned-Pinned / Simply S.): sin(lam) = 0
 *   'CC' (Clamped-Clamped):           cos(lam) cosh(lam) = +1
 *   'CP' (Clamped-Pinned):            tan(lam) = tanh(lam)
 *   'FF' (Free-Free elastic modes):   cos(lam) cosh(lam) = +1
 *
 * All mode shapes use exact cancellation-free exponential forms (all exp <= 1)
 * and L^2 normalization: int_0^1 phi_n(xi)^2 dxi = 1.
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};

  const N_MODES = 5;

  const BC_INFO = {
    CF: {
      key: 'CF',
      name: 'Cantilever (clamped–free)',
      short: 'Clamped–Free',
      leftEnd: 'clamped',
      rightEnd: 'free',
      charEqTex: '\\cos(\\beta L)\\cosh(\\beta L) = -1',
      bcTex: 'w(0)=w\'(0)=0,\\quad w\'\'(L)=w\'\'\'(L)=0',
      description:
        'A cantilever beam has its lowest fundamental wavenumber ($\\beta_1 L = 1.875$) and the widest jump to the second mode ($\\omega_2/\\omega_1 = 6.27$). Every mode $n$ has $n - 1$ interior nodes.'
    },
    SS: {
      key: 'SS',
      name: 'Simply supported (pinned–pinned)',
      short: 'Pinned–Pinned',
      leftEnd: 'pinned',
      rightEnd: 'pinned',
      charEqTex: '\\sin(\\beta L) = 0 \\implies \\beta_n L = n\\pi',
      bcTex: 'w(0)=w\'\'(0)=0,\\quad w(L)=w\'\'(L)=0',
      description:
        'Pinned ends produce pure sinusoidal normal modes $\\phi_n(\\xi) = \\sqrt{2}\\sin(n\\pi\\xi)$ and exact integer-squared frequency ratios $\\omega_n / \\omega_1 = n^2 = 1, 4, 9, 16, 25$.'
    },
    CC: {
      key: 'CC',
      name: 'Clamped–clamped (fixed–fixed)',
      short: 'Clamped–Clamped',
      leftEnd: 'clamped',
      rightEnd: 'clamped',
      charEqTex: '\\cos(\\beta L)\\cosh(\\beta L) = 1',
      bcTex: 'w(0)=w\'(0)=0,\\quad w(L)=w\'(L)=0',
      description:
        'Fixing both slopes raises $\\beta_1 L$ to $4.730$—making the fundamental frequency $2.27\\times$ higher than a pinned beam of identical length and compressing $\\omega_2/\\omega_1$ to $2.76$.'
    },
    CP: {
      key: 'CP',
      name: 'Clamped–pinned (propped cantilever)',
      short: 'Clamped–Pinned',
      leftEnd: 'clamped',
      rightEnd: 'pinned',
      charEqTex: '\\tan(\\beta L) = \\tanh(\\beta L)',
      bcTex: 'w(0)=w\'(0)=0,\\quad w(L)=w\'\'(L)=0',
      description:
        'Adding a pin support to a cantilever tip shifts the first root from $1.875$ to $3.927$—quadrupling $\\omega_1$—and breaks left–right symmetry of every mode shape.'
    },
    FF: {
      key: 'FF',
      name: 'Free–free (elastic modes)',
      short: 'Free–Free',
      leftEnd: 'free',
      rightEnd: 'free',
      charEqTex: '\\cos(\\beta L)\\cosh(\\beta L) = 1\\;\\;(\\text{plus }\\omega=0\\text{ rigid modes})',
      bcTex: 'w\'\'(0)=w\'\'\'(0)=0,\\quad w\'\'(L)=w\'\'\'(L)=0',
      description:
        'A free–free beam shares the exact same nonzero wavenumbers $\\beta_n L$ as a clamped–clamped beam, but its modes have non-zero tip displacements and $n + 1$ interior nodes (like a xylophone bar).'
    }
  };

  /* ------------------------------------------------------------------
   * Exact Root Solver (Bisection + Newton Polish to < 1e-13)
   * ---------------------------------------------------------------- */
  function charFunc(bc, lam) {
    if (bc === 'SS') return Math.sin(lam);
    if (bc === 'CF') return Math.cos(lam) + 1 / Math.cosh(lam);
    if (bc === 'CC' || bc === 'FF') return Math.cos(lam) - 1 / Math.cosh(lam);
    // CP: sin(lam) - cos(lam) tanh(lam) = 0 (bounded everywhere, no poles!)
    return Math.sin(lam) - Math.cos(lam) * Math.tanh(lam);
  }

  function solveRoot(bc, a, b) {
    let lo = a;
    let hi = b;
    let flo = charFunc(bc, lo);
    for (let it = 0; it < 70; it++) {
      const mid = 0.5 * (lo + hi);
      const fm = charFunc(bc, mid);
      if (Math.abs(fm) < 1e-14 || hi - lo < 1e-14) return mid;
      if ((flo <= 0 && fm <= 0) || (flo >= 0 && fm >= 0)) {
        lo = mid;
        flo = fm;
      } else {
        hi = mid;
      }
    }
    return 0.5 * (lo + hi);
  }

  function computeRoots(bc) {
    const roots = [];
    if (bc === 'SS') {
      for (let n = 1; n <= N_MODES; n++) roots.push(n * Math.PI);
      return roots;
    }
    if (bc === 'CF') {
      // Brackets around (n - 0.5)*pi
      roots.push(solveRoot('CF', 1.2, 2.5));
      for (let n = 2; n <= N_MODES; n++) {
        const approx = (n - 0.5) * Math.PI;
        roots.push(solveRoot('CF', approx - 0.5, approx + 0.5));
      }
      return roots;
    }
    if (bc === 'CC' || bc === 'FF') {
      // Brackets around (n + 0.5)*pi
      for (let n = 1; n <= N_MODES; n++) {
        const approx = (n + 0.5) * Math.PI;
        roots.push(solveRoot(bc, approx - 0.5, approx + 0.5));
      }
      return roots;
    }
    // CP: brackets around (n + 0.25)*pi
    for (let n = 1; n <= N_MODES; n++) {
      const approx = (n + 0.25) * Math.PI;
      roots.push(solveRoot('CP', approx - 0.4, approx + 0.4));
    }
    return roots;
  }

  /* ------------------------------------------------------------------
   * Cancellation-Free Mode Shape Evaluation on xi in [0, 1]
   * ---------------------------------------------------------------- */
  function rawModeShape(bc, lam, xi) {
    if (bc === 'SS') {
      return Math.SQRT2 * Math.sin(lam * xi);
    }
    const eNeg = Math.exp(-lam);
    const e2Neg = eNeg * eNeg;
    const eLxi = Math.exp(-lam * xi);
    const eL1m = Math.exp(-lam * (1 - xi));
    const sL = Math.sin(lam);
    const cL = Math.cos(lam);
    const sX = Math.sin(lam * xi);
    const cX = Math.cos(lam * xi);

    if (bc === 'CF') {
      // sigma = (cosh L + cos L) / (sinh L + sin L)
      // 0.5*(1 - sigma)*exp(L*xi) = (sin L - cos L - e^-L) * e^(-L(1-xi)) / (1 - e^-2L + 2 e^-L sin L)
      // 0.5*(1 + sigma)*exp(-L*xi) = (1 + e^-L (cos L + sin L)) * e^(-L*xi) / (1 - e^-2L + 2 e^-L sin L)
      const den = 1 - e2Neg + 2 * eNeg * sL;
      const sigma = (1 + e2Neg + 2 * eNeg * cL) / den;
      const hypTerm =
        ((sL - cL - eNeg) * eL1m + (1 + eNeg * (cL + sL)) * eLxi) / den;
      return hypTerm - cX + sigma * sX;
    }

    // CC, CP, and FF share sigma = (cosh L - cos L) / (sinh L - sin L)
    const den = 1 - e2Neg - 2 * eNeg * sL;
    const sigma = (1 + e2Neg - 2 * eNeg * cL) / den;
    const hypTerm =
      ((cL - sL - eNeg) * eL1m + (1 - eNeg * (cL + sL)) * eLxi) / den;

    if (bc === 'FF') {
      return hypTerm + cX - sigma * sX;
    }
    // CC and CP
    return hypTerm - cX + sigma * sX;
  }

  // Simpson's rule integration on [0, 1] with M_SUB even panels
  function integrateSimpson(fn, M_SUB) {
    const N = M_SUB || 400;
    const h = 1 / N;
    let sum = fn(0) + fn(1);
    for (let i = 1; i < N; i++) {
      sum += (i % 2 === 0 ? 2 : 4) * fn(i * h);
    }
    return (sum * h) / 3;
  }

  function findInteriorNodes(phiFn) {
    const nodes = [];
    const M = 400;
    let prevX = 0.005;
    let prevY = phiFn(prevX);
    for (let i = 1; i <= M; i++) {
      const x = 0.005 + (0.99 * i) / M;
      const y = phiFn(x);
      if (prevY * y < 0) {
        // Bisect root cleanly
        let a = prevX;
        let b = x;
        let fa = prevY;
        for (let k = 0; k < 35; k++) {
          const m = 0.5 * (a + b);
          const fm = phiFn(m);
          if (fa * fm <= 0) b = m;
          else {
            a = m;
            fa = fm;
          }
        }
        nodes.push(0.5 * (a + b));
      }
      prevX = x;
      prevY = y;
    }
    return nodes;
  }

  /* ------------------------------------------------------------------
   * Precompute Complete Normalized Basis for Any Boundary Condition
   * ---------------------------------------------------------------- */
  const cache = {};
  function getBeamSystem(bc) {
    if (cache[bc]) return cache[bc];
    const info = BC_INFO[bc] || BC_INFO.CF;
    const roots = computeRoots(bc);
    const modes = roots.map((lam, idx) => {
      const normSq = integrateSimpson((xi) => {
        const v = rawModeShape(bc, lam, xi);
        return v * v;
      }, 400);
      const invNorm = 1 / Math.sqrt(normSq);
      // Canonical sign: positive near left-most interior peak
      let sign = 1;
      const testXi = bc === 'FF' ? 0.0 : 0.15 / (idx + 1);
      if (rawModeShape(bc, lam, testXi) < 0) sign = -1;

      const evalFn = (xi) => sign * invNorm * rawModeShape(bc, lam, xi);
      const nodes = findInteriorNodes(evalFn);
      // Max absolute value on [0, 1] for clean canvas scaling
      let maxAbs = 0;
      for (let i = 0; i <= 200; i++) {
        const av = Math.abs(evalFn(i / 200));
        if (av > maxAbs) maxAbs = av;
      }
      return {
        n: idx + 1,
        lam,
        omegaRel: (lam * lam) / (roots[0] * roots[0]),
        lamSq: lam * lam,
        eval: evalFn,
        nodes,
        maxAbs
      };
    });

    const sys = {
      bc,
      info,
      modes
    };
    cache[bc] = sys;
    return sys;
  }

  /* ------------------------------------------------------------------
   * Initial Deflection Shapes & Modal Expansion Coefficients
   * ---------------------------------------------------------------- */
  function evalInitialShape(bc, kind, xi0, xi) {
    const x0 = Math.max(0.12, Math.min(0.88, xi0));
    if (kind === 'pluck') {
      if (bc === 'CF') {
        // Cantilever bent smoothly to tip / pluck point: static-like cubic up to x0, linear beyond
        if (xi <= x0) {
          const u = xi / x0;
          return 0.5 * u * u * (3 - u);
        }
        return 1.0 + 1.5 * ((xi - x0) / x0);
      }
      if (bc === 'FF') {
        // Localized bump minus rigid-body mean and tilt so it excites pure elastic modes!
        const s = 0.14;
        return Math.exp(-Math.pow((xi - x0) / s, 2));
      }
      // Tent / triangular pluck vanishing at both ends
      return xi <= x0 ? xi / x0 : (1 - xi) / (1 - x0);
    }
    if (kind === 'bump') {
      const s = 0.095;
      const g = Math.exp(-Math.pow((xi - x0) / s, 2));
      // Smoothly taper at clamped/pinned ends
      let env = 1;
      if (bc === 'SS' || bc === 'CC' || bc === 'CP') env *= Math.sin(Math.PI * xi);
      else if (bc === 'CF') env *= xi * xi;
      return g * env;
    }
    if (kind === 'uniform') {
      if (bc === 'CF') return (xi * xi * (6 - 4 * xi + xi * xi)) / 3;
      if (bc === 'CC') return 16 * xi * xi * (1 - xi) * (1 - xi);
      if (bc === 'CP') return (xi * xi * (1 - xi) * (3 - 2 * xi)) * 5.2;
      if (bc === 'FF') return Math.cos(2 * Math.PI * xi);
      return Math.sin(Math.PI * xi);
    }
    return Math.sin(Math.PI * xi);
  }

  function computeModalProjection(sys, kind, xi0) {
    // Normalize target initial shape to max amplitude 1 for clean comparison
    let rawMax = 1e-6;
    for (let i = 0; i <= 200; i++) {
      const v = Math.abs(evalInitialShape(sys.bc, kind, xi0, i / 200));
      if (v > rawMax) rawMax = v;
    }
    const targetFn = (xi) => evalInitialShape(sys.bc, kind, xi0, xi) / rawMax;

    const q0 = sys.modes.map((m) =>
      integrateSimpson((xi) => targetFn(xi) * m.eval(xi), 320)
    );
    const energies = sys.modes.map((m, i) => 0.5 * Math.pow(m.lam, 4) * q0[i] * q0[i]);
    const eTot = Math.max(1e-12, energies.reduce((a, b) => a + b, 0));
    const energyShares = energies.map((e) => e / eTot);

    return { targetFn, q0, energies, energyShares };
  }

  function innerProduct(sys, i, j) {
    const fi = sys.modes[i].eval;
    const fj = sys.modes[j].eval;
    return integrateSimpson((xi) => fi(xi) * fj(xi), 400);
  }

  /* ------------------------------------------------------------------
   * Formatting & Canvas Theme Helpers (including Typographic Math)
   * ---------------------------------------------------------------- */
  function fmt(val, dec) {
    const d = dec === undefined ? 2 : dec;
    if (!Number.isFinite(val)) return '∞';
    const v = Math.abs(val) < 0.5 * Math.pow(10, -d) ? 0 : val;
    return v.toFixed(d);
  }

  function fmtTex(val, dec) {
    if (!Number.isFinite(val)) return '\\infty';
    return fmt(val, dec);
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
          ref: '#8f9ba6'
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
          ref: '#8a8578'
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

  function measureMathRuns(ctx, runs, size, family) {
    const fam = family || '"IBM Plex Sans", sans-serif';
    const subSize = Math.max(8.5, size * 0.72);
    let totalW = 0;
    for (const r of runs) {
      const sz = r.sub || r.sup ? subSize : size;
      const wt = r.bold ? '600 ' : '500 ';
      const st = r.i ? 'italic ' : '';
      ctx.font = st + wt + sz + 'px ' + fam;
      totalW += ctx.measureText(r.t).width;
    }
    return totalW;
  }

  function drawMath(ctx, runs, x, y, opts) {
    const o = opts || {};
    const size = o.size || 12;
    const fam = o.family || '"IBM Plex Sans", sans-serif';
    const align = o.align || 'left';
    const baseline = o.baseline || 'middle';
    const color = o.color || '#132433';
    const subSize = Math.max(8.5, size * 0.72);

    ctx.save();
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = baseline;

    const totalW = measureMathRuns(ctx, runs, size, fam);
    let cx = align === 'center' ? x - totalW * 0.5 : align === 'right' ? x - totalW : x;

    for (const r of runs) {
      const sz = r.sub || r.sup ? subSize : size;
      const wt = r.bold ? '600 ' : '500 ';
      const st = r.i ? 'italic ' : '';
      const dy = r.sub ? size * 0.28 : r.sup ? -size * 0.30 : 0;
      ctx.font = st + wt + sz + 'px ' + fam;
      ctx.fillText(r.t, cx, y + dy);
      cx += ctx.measureText(r.t).width;
    }
    ctx.restore();
    return totalW;
  }

  // Draw mechanical support icons at left (side=-1) or right (side=+1) end of beam
  function drawSupport(ctx, x, y, type, side, C) {
    ctx.save();
    ctx.strokeStyle = C.axis;
    ctx.fillStyle = C.bgSubtle;
    ctx.lineWidth = 2;
    if (type === 'clamped') {
      ctx.beginPath();
      ctx.moveTo(x, y - 28);
      ctx.lineTo(x, y + 28);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = C.textMuted;
      for (let yy = y - 24; yy <= y + 24; yy += 8) {
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.lineTo(x + side * 8, yy + 5);
        ctx.stroke();
      }
    } else if (type === 'pinned') {
      ctx.beginPath();
      ctx.moveTo(x, y + 2);
      ctx.lineTo(x - 10, y + 18);
      ctx.lineTo(x + 10, y + 18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    } else if (type === 'free') {
      ctx.fillStyle = C.copper;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.restore();
  }

  window.VibLab.MathBeam = {
    N_MODES,
    BC_INFO,
    charFunc,
    getBeamSystem,
    computeModalProjection,
    innerProduct,
    integrateSimpson,
    fmt,
    fmtTex
  };

  window.VibLab.Theme = {
    get: getThemeColors,
    setupCanvas,
    measureMathRuns,
    drawMath,
    drawSupport
  };
})();
