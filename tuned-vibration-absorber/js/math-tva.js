/**
 * math-tva.js
 * Exact analytical mathematics engine for Module 10:
 * Tuned Vibration Absorbers (TVA / Den Hartog) & Passive Vibration Isolation.
 *
 * Dimensionless TVA parameters:
 *   mu     = m_a / m_1             (absorber-to-primary mass ratio)
 *   beta   = w_a / w_1             (tuning frequency ratio, w_a = sqrt(k_a/m_a), w_1 = sqrt(k_1/m_1))
 *   zetaA  = c_a / (2 m_a w_a)     (absorber internal damping ratio; Den Hartog zeta_DH = beta * zetaA)
 *   r      = w / w_1               (forcing frequency ratio)
 *
 * Exact primary-mass dynamic amplification (for undamped primary system, zeta1 = 0):
 *   X1 / Xst = [ (beta^2 - r^2) + i (2 beta zetaA r) ] /
 *              [ ((1 - r^2)(beta^2 - r^2) - mu beta^2 r^2) + i (2 beta zetaA r)(1 - r^2 (1 + mu)) ]
 *
 * Exact Den Hartog fixed points P and Q (independent of zetaA):
 *   r^4 - 2 [1 + beta^2 (1 + mu)] / (2 + mu) * r^2 + 2 beta^2 / (2 + mu) = 0
 *   M(r_P) = |1 / (1 - r_P^2 (1 + mu))|,   M(r_Q) = |1 / (1 - r_Q^2 (1 + mu))|
 *
 * Exact Den Hartog optimal tuning & damping:
 *   beta_opt  = 1 / (1 + mu)
 *   M_opt     = sqrt(1 + 2 / mu)
 *   zetaA_opt = sqrt(3 mu / (8 (1 + mu)))   (equiv. zeta_DH_opt = sqrt(3 mu / (8 (1 + mu)^3)))
 *
 * Exact passive isolator transmissibility:
 *   T(r, zeta) = sqrt((1 + (2 zeta r)^2) / ((1 - r^2)^2 + (2 zeta r)^2))
 *   Crossover T(sqrt(2), zeta) === 1 for ALL zeta >= 0.
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};

  const PRESETS = {
    den_hartog_opt: {
      key: 'den_hartog_opt',
      label: 'Den Hartog optimum (μ = 0.10)',
      mu: 0.10,
      beta: 1 / 1.1,
      zetaA: Math.sqrt((3 * 0.10) / (8 * 1.1)),
      rDrive: 1.0,
      description:
        'Minimax-optimal damped absorber for $\\mu = 0.10$: $\\beta_{\\mathrm{opt}} = 1/(1+\\mu) = 0.909$ levels fixed points $P$ and $Q$ at $M = \\sqrt{1 + 2/\\mu} = 4.58$, while $\\zeta_{a,\\mathrm{opt}} = 0.185$ flattens both peaks.'
    },
    undamped_frahm: {
      key: 'undamped_frahm',
      label: 'Undamped Frahm (ζₐ = 0)',
      mu: 0.10,
      beta: 1.0,
      zetaA: 0.0,
      rDrive: 1.0,
      description:
        'Classic Frahm undamped absorber tuned to $\\omega_a = \\omega_1$ ($\\beta = 1$, $\\zeta_a = 0$): completely zeroes $X_1$ at $r = 1$, but splits the single resonance into two unbounded side peaks at $r_1 = 0.854$ and $r_2 = 1.171$.'
    },
    detuned_high: {
      key: 'detuned_high',
      label: 'Detuned absorber (β = 1.05)',
      mu: 0.10,
      beta: 1.05,
      zetaA: 0.18,
      rDrive: 1.0,
      description:
        'Tuning too stiff ($\\beta > \\beta_{\\mathrm{opt}}$) tilts the fixed points so $Q$ rises far above $P$, showing why naive tuning $\\beta = 1$ is suboptimal once damping is present.'
    },
    heavy_absorber: {
      key: 'heavy_absorber',
      label: 'Heavy absorber (μ = 0.25)',
      mu: 0.25,
      beta: 1 / 1.25,
      zetaA: Math.sqrt((3 * 0.25) / (8 * 1.25)),
      rDrive: 1.0,
      description:
        'Increasing mass ratio to $\\mu = 0.25$ widens the frequency split, pulls $\\beta_{\\mathrm{opt}}$ down to $0.800$, and caps primary amplification at $M_{\\mathrm{opt}} = \\sqrt{1 + 2/0.25} = 3.00$.'
    },
    overdamped_lock: {
      key: 'overdamped_lock',
      label: 'Overdamped lock-up (ζₐ = 0.70)',
      mu: 0.10,
      beta: 1 / 1.1,
      zetaA: 0.70,
      rDrive: 1.0,
      description:
        'Excessive absorber damping locks $m_a$ rigidly onto $m_1$, collapsing the 2-DOF system toward a single undamped mass $(m_1 + m_a)$ with a tall peak right between $P$ and $Q$ at $r = 1/\\sqrt{1+\\mu}$.'
    }
  };

  function cDiv(a, b) {
    const d = b.re * b.re + b.im * b.im;
    if (d < 1e-30) return { re: 0, im: 0 };
    return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
  }
  function cAbs(a) {
    return Math.hypot(a.re, a.im);
  }
  function cArg(a) {
    return Math.atan2(a.im, a.re);
  }

  /* ------------------------------------------------------------------
   * Optimal Den Hartog Formulas & Fixed Points P, Q
   * ---------------------------------------------------------------- */
  function denHartogOptimum(mu) {
    const betaOpt = 1 / (1 + mu);
    const MOpt = Math.sqrt(1 + 2 / mu);
    const zetaAOpt = Math.sqrt((3 * mu) / (8 * (1 + mu)));
    const zetaDHOpt = zetaAOpt * betaOpt;
    return { betaOpt, MOpt, zetaAOpt, zetaDHOpt };
  }

  function fixedPoints(mu, beta) {
    // Quadratic in u = r^2: u^2 - S u + P = 0
    const S = (2 * (1 + beta * beta * (1 + mu))) / (2 + mu);
    const P = (2 * beta * beta) / (2 + mu);
    const disc = Math.max(0, S * S - 4 * P);
    const sq = Math.sqrt(disc);
    const uP = Math.max(1e-12, 0.5 * (S - sq));
    const uQ = Math.max(1e-12, 0.5 * (S + sq));
    const rP = Math.sqrt(uP);
    const rQ = Math.sqrt(uQ);
    const MP = Math.abs(1 / (1 - uP * (1 + mu)));
    const MQ = Math.abs(1 / (1 - uQ * (1 + mu)));
    return { rP, rQ, MP, MQ };
  }

  // Undamped 2-DOF split natural frequencies r1 < beta < r2 (zetaA = 0)
  function undampedSplitFreqs(mu, beta) {
    // (1 - u)(beta^2 - u) - mu beta^2 u = 0 -> u^2 - [1 + beta^2(1+mu)] u + beta^2 = 0
    const S = 1 + beta * beta * (1 + mu);
    const P = beta * beta;
    const disc = Math.max(0, S * S - 4 * P);
    const sq = Math.sqrt(disc);
    const r1 = Math.sqrt(Math.max(1e-12, 0.5 * (S - sq)));
    const r2 = Math.sqrt(Math.max(1e-12, 0.5 * (S + sq)));
    return { r1, r2 };
  }

  /* ------------------------------------------------------------------
   * Exact Complex Steady-State TVA Response at Driving Ratio r = w / w1
   * Normalized by static deflection Xst = F0 / k1.
   * ---------------------------------------------------------------- */
  function evalTVA(mu, beta, zetaA, r) {
    const r2 = r * r;
    const b2 = beta * beta;
    const twoBZr = 2 * beta * zetaA * r;

    const num1 = { re: b2 - r2, im: twoBZr };
    const den = {
      re: (1 - r2) * (b2 - r2) - mu * b2 * r2,
      im: twoBZr * (1 - r2 * (1 + mu))
    };

    const X1 = cDiv(num1, den);
    // Absorber absolute displacement: Xa / Xst = (b2 + i 2 b z r) / den
    const numA = { re: b2, im: twoBZr };
    const Xa = cDiv(numA, den);
    // Absorber relative stroke: (Xa - X1) / Xst = r^2 / den
    const Xrel = cDiv({ re: r2, im: 0 }, den);

    // Absorber reaction force on m1 normalized by F0:
    // Fa / F0 = (ka + i w ca)(Xa - X1) / F0 = mu (b2 + i 2 b z r) * (Xa - X1)/Xst
    // Wait: check force balance on m1: (1 - r^2) X1/Xst - Fa/F0 = 1 => Fa/F0 = (1 - r^2) X1/Xst - 1
    // Equivalently, since ma xa'' = -Fa => Fa/F0 = mu r^2 Xa/Xst!
    const Fa = { re: mu * r2 * Xa.re, im: mu * r2 * Xa.im };
    // Primary spring + inertia net restoring force: (1 - r^2) X1/Xst
    const Fprim = { re: (1 - r2) * X1.re, im: (1 - r2) * X1.im };
    // Check balance: Fprim - Fa == {re: 1, im: 0} (exact!)

    return {
      X1,
      Xa,
      Xrel,
      Fa,
      Fprim,
      M1: cAbs(X1),
      Ma: cAbs(Xa),
      Mrel: cAbs(Xrel),
      ph1: cArg(X1),
      phA: cArg(Xa)
    };
  }

  // Locked-mass limit (zetaA -> infinity): single mass (1 + mu) m1 on spring k1
  function evalLockedLimit(mu, r) {
    return Math.abs(1 / (1 - r * r * (1 + mu)));
  }

  // Numerical peak primary amplification over r in [0.02, 2.2]
  function findPeakM1(mu, beta, zetaA) {
    let peak = 0;
    let rPeak = 1;
    const N = 600;
    for (let i = 1; i <= N; i++) {
      const r = (2.2 * i) / N;
      const m = evalTVA(mu, beta, zetaA, r).M1;
      if (Number.isFinite(m) && m > peak) {
        peak = m;
        rPeak = r;
      }
    }
    return { peak, rPeak };
  }

  /* ------------------------------------------------------------------
   * Passive Isolator Transmissibility & Force Phasor Geometry
   * ---------------------------------------------------------------- */
  function evalTransmissibility(r, zeta) {
    const r2 = r * r;
    const d2 = 2 * zeta * r;
    const num = { re: 1, im: d2 };
    const den = { re: 1 - r2, im: d2 };
    const Tcomplex = cDiv(num, den);
    const T = cAbs(Tcomplex);
    const phase = cArg(Tcomplex);
    // Relative displacement X / (F0/k) = 1 / ((1 - r^2) + i 2 zeta r)
    const X = cDiv({ re: 1, im: 0 }, den);
    // Transmitted spring force kX/F0 = X, transmitted damper force i c w X / F0 = i (2 zeta r) X
    const Fspring = X;
    const Fdamp = { re: -d2 * X.im, im: d2 * X.re };
    return {
      T,
      phase,
      Tcomplex,
      X,
      Fspring,
      Fdamp,
      isolationPct: (1 - T) * 100
    };
  }

  function analyzeTVA(params) {
    const mu = Math.max(0.02, Math.min(0.45, Number(params.mu)));
    const beta = Math.max(0.45, Math.min(1.45, Number(params.beta)));
    const zetaA = Math.max(0.0, Math.min(0.95, Number(params.zetaA)));
    const rDrive = Math.max(0.1, Math.min(2.0, Number(params.rDrive || 1.0)));

    const opt = denHartogOptimum(mu);
    const fp = fixedPoints(mu, beta);
    const split = undampedSplitFreqs(mu, beta);
    const rLock = 1 / Math.sqrt(1 + mu);
    const peakInfo = zetaA < 1e-5 ? { peak: Infinity, rPeak: split.r1 } : findPeakM1(mu, beta, zetaA);

    return {
      mu,
      beta,
      zetaA,
      zetaDH: beta * zetaA,
      rDrive,
      opt,
      fp,
      split,
      rLock,
      peakInfo
    };
  }

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
    const lead = Math.min(11, L * 0.16);
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
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + ux * mid, y1 + uy * mid);
    ctx.moveTo(x1 + ux * mid - nx * (h - 2), y1 + uy * mid - ny * (h - 2));
    ctx.lineTo(x1 + ux * mid + nx * (h - 2), y1 + uy * mid + ny * (h - 2));
    ctx.stroke();
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

  /* ------------------------------------------------------------------
   * Typographic Math Text Helper for Canvas (clean subscripts & superscripts)
   * runs: array of { t: string, sub?: boolean, sup?: boolean, i?: boolean, bold?: boolean }
   * ---------------------------------------------------------------- */
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

  window.VibLab.MathTVA = {
    PRESETS,
    cDiv,
    cAbs,
    cArg,
    denHartogOptimum,
    fixedPoints,
    undampedSplitFreqs,
    evalTVA,
    evalLockedLimit,
    findPeakM1,
    evalTransmissibility,
    analyzeTVA,
    fmt,
    fmtTex
  };

  window.VibLab.Theme = {
    get: getThemeColors,
    setupCanvas,
    drawArrow,
    drawSpring,
    drawDamper,
    measureMathRuns,
    drawMath
  };
})();
