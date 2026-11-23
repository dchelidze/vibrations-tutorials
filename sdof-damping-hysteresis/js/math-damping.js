/**
 * math-damping.js
 * Exact analytical mathematics engine for Module 08:
 * Damping Mechanisms in the Force-Displacement Plane (Viscous, Coulomb, Structural)
 * and Exact Piecewise Coulomb Stick-Slip Free Decay.
 *
 * Normalized units: k = 1, m = 1, w_n = 1.
 *   Viscous:    f_d = 2 zeta x',     Delta E = 2 pi zeta r X^2,     zeta_eq = zeta
 *   Structural: f_d = (eta/r) x',    Delta E = pi eta X^2,          zeta_eq = eta / (2 r)
 *   Coulomb:    f_d = Fc sgn(x'),    Delta E = 4 Fc X,              zeta_eq = 2 Fc / (pi r X)
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};

  const PRESETS = {
    matched_r1: {
      key: 'matched_r1',
      label: 'Matched energy at r = 1, X = 1',
      zeta: 0.15,
      eta: 0.30, // pi * 0.30 == 2 * pi * 0.15
      Fc: (Math.PI * 0.30) / 4, // 4 * Fc == pi * eta
      r: 1.0,
      X: 1.0,
      u0: 2.0,
      delta: 0.18,
      description:
        'All three models are calibrated to enclose the exact same hysteresis area $\\Delta E_d = 0.942$ at $r = 1, X = 1$—then sweep $r$ or $X$ to watch their areas diverge immediately.'
    },
    high_freq: {
      key: 'high_freq',
      label: 'High frequency (r = 2.2)',
      zeta: 0.15,
      eta: 0.30,
      Fc: 0.24,
      r: 2.2,
      X: 1.0,
      u0: 2.0,
      delta: 0.18,
      description:
        'At $r = 2.2$, the viscous ellipse swells by $2.2\\times$ while both the structural ellipse and Coulomb rectangle retain their exact $r = 1$ area.'
    },
    small_amp: {
      key: 'small_amp',
      label: 'Small amplitude (X = 0.35)',
      zeta: 0.15,
      eta: 0.30,
      Fc: 0.24,
      r: 1.0,
      X: 0.35,
      u0: 1.2,
      delta: 0.22,
      description:
        'At small amplitude $X$, dry friction dominates ($\zeta_{\\mathrm{eq}} \\propto 1/X$) because $\\Delta E_{\\mathrm{coul}} \\propto X$ shrinks slower than $X^2$.'
    },
    strong_stick: {
      key: 'strong_stick',
      label: 'Strong Coulomb stick-slip (δ = 0.32)',
      zeta: 0.15,
      eta: 0.30,
      Fc: 0.32,
      r: 1.0,
      X: 1.0,
      u0: 2.2,
      delta: 0.32,
      description:
        'Wide sticking dead zone $[-\\delta, +\\delta]$: trajectories jump between shifted centers $\\pm\\delta$ and halt completely after just a few half-cycles at a nonzero offset.'
    }
  };

  function evalDissipation(params) {
    const zeta = params.zeta;
    const eta = params.eta;
    const Fc = params.Fc;
    const r = Math.max(0.05, params.r);
    const X = Math.max(0.1, params.X);

    const dE_visc = 2 * Math.PI * zeta * r * X * X;
    const dE_struct = Math.PI * eta * X * X;
    const dE_coul = 4 * Fc * X;

    const zEq_visc = zeta;
    const zEq_struct = eta / (2 * r);
    const zEq_coul = (2 * Fc) / (Math.PI * r * X);

    return {
      dE_visc,
      dE_struct,
      dE_coul,
      zEq_visc,
      zEq_struct,
      zEq_coul
    };
  }

  /* ------------------------------------------------------------------
   * Exact Piecewise-Analytical Coulomb Free Decay:
   *   u'' + u + delta * sgn(u') = 0,   u(0) = u0 > 0, u'(0) = 0
   * Returns half-cycle arcs, turning points, stop time, residual offset,
   * and sampled trajectory (t, u, v).
   * ---------------------------------------------------------------- */
  function simulateCoulombFree(u0, delta) {
    const arcs = [];
    let uCurr = Math.abs(u0);
    let sign = 1; // +1 at right turning point, -1 at left turning point
    let tCurr = 0;

    let guard = 0;
    while (Math.abs(uCurr) > delta + 1e-10 && guard < 40) {
      // Moving from sign * |uCurr| toward opposite side:
      // If sign == +1 (moving left, v < 0): center is +delta, radius R = uCurr - delta
      // If sign == -1 (moving right, v > 0): center is -delta, radius R = |uCurr| - delta
      const center = sign * delta;
      const R = Math.abs(uCurr) - delta;
      arcs.push({
        tStart: tCurr,
        tEnd: tCurr + Math.PI,
        center,
        R,
        dir: -sign // -1 moving left (lower semicircle), +1 moving right (upper semicircle)
      });
      // Landing position after half-period pi: center - sign * R
      uCurr = center - sign * R;
      sign = -sign;
      tCurr += Math.PI;
      guard++;
    }

    const uStop = uCurr;
    const tStop = tCurr;
    const tEnd = Math.max(tStop + 5.0, 24.0);

    // Sample cleanly for phase portrait & time series
    const samples = [];
    const nPerArc = 48;
    for (const a of arcs) {
      for (let i = 0; i <= nPerArc; i++) {
        const th = (Math.PI * i) / nPerArc; // 0 .. pi
        const t = a.tStart + th;
        const sgnStart = -a.dir; // +1 if dir=-1 (starting at right), -1 if dir=+1 (starting at left)
        const u = a.center + sgnStart * a.R * Math.cos(th);
        const v = a.dir * a.R * Math.sin(th);
        samples.push({ t, u, v });
      }
    }
    // Flat stuck tail
    const nTail = 40;
    for (let i = 1; i <= nTail; i++) {
      const t = tStop + ((tEnd - tStop) * i) / nTail;
      samples.push({ t, u: uStop, v: 0 });
    }

    return {
      arcs,
      nHalfCycles: arcs.length,
      tStop,
      uStop,
      tEnd,
      samples
    };
  }

  // Forced harmonic response comparison across the three models (normalized by F0/k = 1)
  function evalForcedModels(r, zeta, eta, FcOverF0) {
    const r2 = r * r;
    const mVisc = 1 / Math.sqrt((1 - r2) * (1 - r2) + Math.pow(2 * zeta * r, 2));
    const mStruct = 1 / Math.sqrt((1 - r2) * (1 - r2) + eta * eta);

    // Den Hartog / harmonic-balance Coulomb amplitude (valid for Fc/F0 < pi/4 = 0.7854)
    const ratio = (4 * FcOverF0) / Math.PI;
    let mCoul = 0;
    if (ratio >= 1) {
      mCoul = 0; // stuck completely
    } else if (Math.abs(1 - r2) < 1e-6) {
      mCoul = Infinity; // unbounded at exact resonance for pure dry friction!
    } else {
      mCoul = Math.sqrt(1 - ratio * ratio) / Math.abs(1 - r2);
    }
    return { mVisc, mStruct, mCoul };
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

  window.VibLab.MathDamping = {
    PRESETS,
    evalDissipation,
    simulateCoulombFree,
    evalForcedModels,
    fmt,
    fmtTex
  };

  window.VibLab.Theme = {
    get: getThemeColors,
    setupCanvas,
    measureMathRuns,
    drawMath
  };
})();
