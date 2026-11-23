/**
 * math-harmonic.js
 * Exact analytical mathematics engine for Module 03:
 * Harmonic Forcing, Rotating Force-Polygon Geometry, Beating, and Phase Resonance.
 *
 * Dimensionless SDOF equation:
 *   x'' + 2 zeta x' + x = cos(r tau),   where tau = w_n t, r = w / w_n, X_st = F_0 / k.
 *
 * Steady-state complex receptance (dimensionless):
 *   H_dim(i r) = X / X_st = 1 / ((1 - r^2) + i 2 zeta r)
 *   M(r, zeta) = |H_dim| = 1 / sqrt((1 - r^2)^2 + (2 zeta r)^2)
 *   phi(r, zeta) = atan2(2 zeta r, 1 - r^2) in [0, pi]   (lag of x behind F_0)
 *
 * Force-balance closure in displacement-aligned rotating frame (X along +Re):
 *   F_spring / F_0  =  M(r)                      (along 0 deg)
 *   F_damp   / F_0  =  i (2 zeta r) M(r)         (along +90 deg)
 *   F_inert  / F_0  =  -r^2 M(r)                 (along +180 deg)
 *   F_spring + F_damp + F_inert === e^{+i phi}   (exact closure onto unit drive vector F_0!)
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};

  const PRESETS = {
    phase_res: {
      key: 'phase_res',
      label: 'Phase resonance (r = 1)',
      r: 1.0,
      zeta: 0.15,
      rBeat: 0.90,
      description:
        'At $r = 1$, inertia $-m\\omega^2 X$ exactly cancels stiffness $kX$ head-to-tail. Damping alone balances $F_0$, locking the phase lag at $\\phi = 90^\\circ$ and injecting maximum average power.'
    },
    stiffness_dom: {
      key: 'stiffness_dom',
      label: 'Stiffness-controlled (r = 0.35)',
      r: 0.35,
      zeta: 0.15,
      rBeat: 0.90,
      description:
        'Well below $\\omega_{\\mathrm{n}}$, inertia and damping are tiny: the spring balances $F_0$ nearly statically ($M \\approx 1.13$, $\\phi \\approx 6.9^\\circ$ in phase).'
    },
    mass_dom: {
      key: 'mass_dom',
      label: 'Mass-controlled (r = 2.20)',
      r: 2.20,
      zeta: 0.15,
      rBeat: 0.90,
      description:
        'Well above $\\omega_{\\mathrm{n}}$, inertia dominates the polygon ($m\\omega^2 X \\gg kX$), forcing displacement $180^\\circ$ out of phase with $F_0$ and attenuating amplitude as $1/r^2$.'
    },
    heavy_damp: {
      key: 'heavy_damp',
      label: 'Heavy damping (ζ = 0.50)',
      r: 0.707,
      zeta: 0.50,
      rBeat: 0.90,
      description:
        'With $\\zeta = 0.50$, the amplitude peak shifts visibly left to $r_{\\mathrm{peak}} = \\sqrt{1 - 2\\zeta^2} = 0.707$, separating amplitude resonance from phase resonance ($r = 1$).'
    },
    light_damp: {
      key: 'light_damp',
      label: 'Sharp resonance (ζ = 0.05)',
      r: 1.0,
      zeta: 0.05,
      rBeat: 0.94,
      description:
        'Light damping produces a tall quality factor $Q = 1/(2\\zeta) = 10$, a razor-narrow half-power bandwidth $\\Delta r \\approx 2\\zeta = 0.10$, and an abrupt $180^\\circ$ phase flip across $r = 1$.'
    }
  };

  function evalHarmonic(r, zeta) {
    const r2 = r * r;
    const reDen = 1 - r2;
    const imDen = 2 * zeta * r;
    const denSq = reDen * reDen + imDen * imDen;
    const M = denSq < 1e-24 ? Infinity : 1 / Math.sqrt(denSq);
    const phi = Math.atan2(imDen, reDen); // lag in [0, pi]
    const phiDeg = (phi * 180) / Math.PI;

    // Dimensionless receptance H_dim = X / X_st = ((1-r^2) - i 2 zeta r) / denSq
    const H = denSq < 1e-24 ? { re: 0, im: -Infinity } : { re: reDen / denSq, im: -imDen / denSq };

    // Normalized force polygon components in the X-aligned frame (F_0 = e^{+i phi}):
    // F_spring = M, F_damp = i * 2*zeta*r*M, F_inert = -r^2 * M
    const fSpring = Number.isFinite(M) ? M : 0;
    const fDamp = Number.isFinite(M) ? 2 * zeta * r * M : 0;
    const fInert = Number.isFinite(M) ? r2 * M : 0;

    // Dimensionless average input power P_bar / (F_0^2 w_n / (2 k)) = r * M * sin(phi) = 2 zeta r^2 / denSq
    const powerNorm = denSq < 1e-24 ? 0 : (2 * zeta * r2) / denSq;

    // Exact amplitude peak frequency & peak value
    const hasPeak = zeta < Math.SQRT1_2;
    const rPeak = hasPeak ? Math.sqrt(Math.max(0, 1 - 2 * zeta * zeta)) : 0;
    const MPeak = hasPeak ? 1 / (2 * zeta * Math.sqrt(1 - zeta * zeta)) : 1.0;

    // Exact half-power frequencies where M(r) = MPeak / sqrt(2) (for MPeak > sqrt(2))
    // Equivalent to (1 - r^2)^2 + (2 zeta r)^2 = 2 / MPeak^2 = 8 zeta^2 (1 - zeta^2)
    // Wait: simpler exact half-power of POWER curve P_bar(r) = 2 zeta r^2 / ((1-r^2)^2 + 4 zeta^2 r^2):
    // Peak power occurs EXACTLY at r = 1 with P_max = 1 / (2 zeta)!
    // Half-power P_bar(r) = 0.5 * P_max = 1 / (4 zeta)  <=>  (1 - r^2)^2 = 4 zeta^2 r^2  <=>  |1 - r^2| = 2 zeta r!
    // Exact positive roots: r1 = sqrt(1 + zeta^2) - zeta, r2 = sqrt(1 + zeta^2) + zeta!
    // THEREFORE r2 - r1 === 2 * zeta EXACTLY FOR ALL zeta > 0!!
    const sqZ = Math.sqrt(1 + zeta * zeta);
    const rHP1 = Math.max(0, sqZ - zeta);
    const rHP2 = sqZ + zeta;
    const bandwidth = rHP2 - rHP1; // identically 2*zeta!
    const Q = zeta > 1e-6 ? 1 / (2 * zeta) : Infinity;

    return {
      r,
      zeta,
      M,
      phi,
      phiDeg,
      H,
      fSpring,
      fDamp,
      fInert,
      powerNorm,
      powerMax: zeta > 1e-6 ? 1 / (2 * zeta) : Infinity,
      hasPeak,
      rPeak,
      MPeak,
      rHP1,
      rHP2,
      bandwidth,
      Q
    };
  }

  // Exact undamped forced response from rest: x(0)=0, x'(0)=0 under cos(r * tau)
  function evalUndampedBeating(r, tau) {
    if (Math.abs(1 - r) < 1e-6) {
      // Exact secular resonance limit: x(tau)/X_st = 0.5 * tau * sin(tau)
      return {
        x: 0.5 * tau * Math.sin(tau),
        env: 0.5 * tau,
        isResonant: true
      };
    }
    const denom = 1 - r * r;
    const x = (Math.cos(r * tau) - Math.cos(tau)) / denom;
    const env = Math.abs((2 / denom) * Math.sin(0.5 * (1 - r) * tau));
    return { x, env, isResonant: false };
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
    ctx.lineWidth = lw || 1.8;
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

  window.VibLab.MathHarmonic = {
    PRESETS,
    evalHarmonic,
    evalUndampedBeating,
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
