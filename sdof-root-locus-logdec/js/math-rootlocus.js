/**
 * math-rootlocus.js
 * Exact analytical mathematics engine for Module 11:
 * Viscous Free-Response Root Locus (s-Plane Geometry) and Logarithmic Decrement Identification.
 *
 * Dimensionless free SDOF oscillator (omega_n > 0):
 *   x'' + 2 zeta w_n x' + w_n^2 x = 0,  x(0) = x0,  x'(0) = v0
 *
 * Characteristic roots of s^2 + 2 zeta w_n s + w_n^2 = 0:
 *   0 <= zeta < 1 (underdamped):  s_{1,2} = -zeta w_n +/- i w_n sqrt(1 - zeta^2), |s| === w_n!
 *   zeta === 1 (critical):        s_{1,2} = -w_n (double pole)
 *   zeta > 1 (overdamped):        s_{1,2} = w_n (-zeta +/- sqrt(zeta^2 - 1)), s_1 * s_2 === w_n^2!
 *
 * Logarithmic decrement (0 < zeta < 1):
 *   delta = 2 pi zeta / sqrt(1 - zeta^2)  <=>  zeta = delta / sqrt(4 pi^2 + delta^2)
 *   Small-damping approximation: zeta_approx = delta / (2 pi)
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};

  const PRESETS = {
    light_under: {
      key: 'light_under',
      zeta: 0.08,
      wn: 2.0,
      noise: 0.00,
      description:
        'Lightly damped ($\\zeta = 0.08$): poles sit high on the semicircle of radius $\\omega_{\\mathrm{n}}$ near the imaginary axis; $\\delta/(2\\pi)$ agrees with exact $\\zeta$ to within $0.3\\%$.'
    },
    noisy_lab: {
      key: 'noisy_lab',
      zeta: 0.12,
      wn: 2.0,
      noise: 0.05,
      description:
        'Noisy ring-down measurement ($\\sigma = 5\\%$): a single peak pair $\\ln(x_0/x_1)$ suffers large scatter, while multi-cycle semilog linear regression cleanly recovers $\\zeta$.'
    },
    heavy_under: {
      key: 'heavy_under',
      zeta: 0.45,
      wn: 2.0,
      noise: 0.00,
      description:
        'Moderately heavy underdamping ($\\zeta = 0.45$): the small-damping approximation $\\delta/(2\\pi)$ overestimates $\\zeta$ by more than $12\\%$ — exact $\\delta/\\sqrt{4\\pi^2+\\delta^2}$ is required.'
    },
    critical: {
      key: 'critical',
      zeta: 1.00,
      wn: 2.0,
      noise: 0.00,
      description:
        'Critically damped ($\\zeta = 1.00$): complex conjugate poles collide at the double pole $s = -\\omega_{\\mathrm{n}}$, giving the fastest non-oscillatory return to equilibrium.'
    },
    overdamped: {
      key: 'overdamped',
      zeta: 1.60,
      wn: 2.0,
      noise: 0.00,
      description:
        'Overdamped ($\\zeta = 1.60$): poles split along the negative real axis while preserving $s_1 s_2 = \\omega_{\\mathrm{n}}^2$; the slow pole near $0^-$ makes settling sluggish.'
    }
  };

  // Deterministic pseudo-random zero-mean relative peak offsets for reproducible noise demo
  const NOISE_TABLE = [0.0, 1.45, -1.10, 0.85, -0.90, 0.65, -0.55, 0.45];

  function evalRoots(zeta, wn) {
    const w = wn > 0 ? wn : 1.0;
    const z = Math.max(0, zeta);
    if (Math.abs(z - 1) < 1e-4) {
      return {
        regime: 'critical',
        s1: { re: -w, im: 0 },
        s2: { re: -w, im: 0 },
        wd: 0,
        Td: Infinity,
        thetaDeg: 0,
        delta: Infinity,
        zetaApprox: Infinity
      };
    }
    if (z < 1) {
      const wd = w * Math.sqrt(1 - z * z);
      const delta = (2 * Math.PI * z) / Math.sqrt(1 - z * z);
      return {
        regime: 'underdamped',
        s1: { re: -z * w, im: wd },
        s2: { re: -z * w, im: -wd },
        wd,
        Td: (2 * Math.PI) / wd,
        thetaDeg: (Math.acos(z) * 180) / Math.PI,
        delta,
        zetaApprox: delta / (2 * Math.PI)
      };
    }
    const sq = Math.sqrt(z * z - 1);
    // s1 = slow (closer to 0), s2 = fast (more negative)
    const s1Re = w * (-z + sq);
    const s2Re = w * (-z - sq);
    return {
      regime: 'overdamped',
      s1: { re: s1Re, im: 0 },
      s2: { re: s2Re, im: 0 },
      wd: 0,
      Td: Infinity,
      thetaDeg: 0,
      delta: Infinity,
      zetaApprox: Infinity
    };
  }

  function evalFreeResponse(t, zeta, wn, x0, v0) {
    const r = evalRoots(zeta, wn);
    const xInit = x0 === undefined ? 1.0 : x0;
    const vInit = v0 === undefined ? 0.0 : v0;
    if (r.regime === 'underdamped') {
      const dec = Math.exp(-zeta * wn * t);
      const A = xInit;
      const B = (vInit + zeta * wn * xInit) / r.wd;
      return dec * (A * Math.cos(r.wd * t) + B * Math.sin(r.wd * t));
    }
    if (r.regime === 'critical') {
      return (xInit + (vInit + wn * xInit) * t) * Math.exp(-wn * t);
    }
    const s1 = r.s1.re, s2 = r.s2.re;
    const c1 = (vInit - s2 * xInit) / (s1 - s2);
    const c2 = (s1 * xInit - vInit) / (s1 - s2);
    return c1 * Math.exp(s1 * t) + c2 * Math.exp(s2 * t);
  }

  function computeSettlingTime(zeta, wn, band) {
    // Exact numerical 2% settling time t_s (last time |x(t)| > band for x0 = 1, v0 = 0)
    const tol = band || 0.02;
    const tMax = Math.max(25 / wn, (8 * Math.max(1, zeta)) / wn);
    const N = 2400;
    let lastExceed = 0;
    for (let i = 0; i <= N; i++) {
      const t = (tMax * i) / N;
      if (Math.abs(evalFreeResponse(t, zeta, wn, 1, 0)) > tol) lastExceed = t;
    }
    return lastExceed;
  }

  function analyzeLogDec(zeta, wn, noiseAmp) {
    const r = evalRoots(zeta, wn);
    if (r.regime !== 'underdamped' || zeta <= 1e-4) {
      return { valid: false, peaks: [], delta1: NaN, deltaOLS: NaN, zeta1: NaN, zetaOLS: NaN, zetaApprox: NaN };
    }
    const peaks = [];
    const maxCycles = 7;
    // Exact positive peak times for x0 = 1, v0 = 0 are t_k = k * Td!
    // Check: x'(t) = -e^{-z w t} (w_n^2 / w_d) sin(w_d t) === 0 at w_d t = k * 2 pi => t_k = k * Td!
    for (let k = 0; k <= maxCycles; k++) {
      const tk = k * r.Td;
      const xExact = Math.exp(-zeta * wn * tk); // exact peak height for x0=1, v0=0!
      if (xExact < 0.05 && k >= 2) break;
      const relPert = k === 0 ? 0 : (noiseAmp || 0) * NOISE_TABLE[k % NOISE_TABLE.length];
      const xMeas = Math.max(0.015, xExact * (1 + relPert));
      peaks.push({ k, t: tk, xExact, xMeas, lnExact: Math.log(xExact), lnMeas: Math.log(xMeas) });
    }

    const n = peaks.length;
    if (n < 2) {
      return { valid: false, peaks, delta1: NaN, deltaOLS: NaN, zeta1: NaN, zetaOLS: NaN, zetaApprox: NaN };
    }

    const delta1 = Math.log(peaks[0].xMeas / peaks[1].xMeas);

    // OLS linear fit of y_k = ln(xMeas_k) = a - delta * k
    let sumK = 0, sumY = 0, sumKK = 0, sumKY = 0;
    for (const p of peaks) {
      sumK += p.k;
      sumY += p.lnMeas;
      sumKK += p.k * p.k;
      sumKY += p.k * p.lnMeas;
    }
    const denom = n * sumKK - sumK * sumK;
    const slope = denom > 1e-12 ? (n * sumKY - sumK * sumY) / denom : -delta1;
    const intercept = (sumY - slope * sumK) / n;
    const deltaOLS = Math.max(0, -slope);

    const invert = (d) => (d > 0 ? d / Math.sqrt(4 * Math.PI * Math.PI + d * d) : 0);

    return {
      valid: true,
      peaks,
      deltaExact: r.delta,
      delta1,
      deltaOLS,
      intercept,
      zeta1: invert(delta1),
      zetaOLS: invert(deltaOLS),
      zetaApprox: deltaOLS / (2 * Math.PI)
    };
  }

  function evalSystem(zeta, wn, noiseAmp) {
    const roots = evalRoots(zeta, wn);
    const logdec = analyzeLogDec(zeta, wn, noiseAmp);
    const ts = computeSettlingTime(zeta, wn, 0.02);
    return {
      zeta,
      wn,
      noiseAmp,
      roots,
      logdec,
      ts,
      wnTs: wn * ts
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
          dark: true, bg: '#132433', bgSubtle: '#192e40', grid: 'rgba(169,182,191,0.14)', gridStrong: 'rgba(169,182,191,0.30)',
          axis: '#c8d4de', text: '#f2f4f6', textMuted: '#a9b6bf', blue: '#4dbeee', orange: '#f0834f',
          teal: '#26b5a6', purple: '#c584d6', crimson: '#f0657f', amber: '#edb120', copper: '#d98a52', ref: '#8f9ba6'
        }
      : {
          dark: false, bg: '#ffffff', bgSubtle: '#f7f6f2', grid: 'rgba(19,36,51,0.08)', gridStrong: 'rgba(19,36,51,0.22)',
          axis: '#132433', text: '#132433', textMuted: '#5b6168', blue: '#0072bd', orange: '#d95319',
          teal: '#00897b', purple: '#7e2f8e', crimson: '#a2142f', amber: '#c78f00', copper: '#b4622a', ref: '#8a8578'
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
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 1.5) return;
    const hl = Math.min(headLen || 8, len * 0.45);
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

  window.VibLab.MathRootLocus = {
    PRESETS,
    evalRoots,
    evalFreeResponse,
    computeSettlingTime,
    analyzeLogDec,
    evalSystem,
    fmt,
    fmtTex
  };

  window.VibLab.Theme = {
    get: getThemeColors,
    setupCanvas,
    drawArrow,
    measureMathRuns,
    drawMath
  };
})();
