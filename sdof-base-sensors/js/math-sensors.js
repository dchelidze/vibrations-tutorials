/**
 * math-sensors.js
 * Exact analytical mathematics engine for Module 04:
 * Base Excitation, Rotating Unbalance, and Seismic Sensor Regimes (Accelerometer vs. Vibrometer).
 *
 * Exact complex transfer functions (r = w / w_n):
 *   Absolute transmissibility: H_abs(i r) = X / Y = (1 + i 2 zeta r) / ((1 - r^2) + i 2 zeta r)
 *   Relative transfer func:    H_rel(i r) = Z / Y = r^2 / ((1 - r^2) + i 2 zeta r)
 *   Exact vector identity:     H_abs(i r) === 1 + H_rel(i r)   <=>   X === Y + Z!
 *   Rotating unbalance:        (M X) / (m_0 e) === |H_rel(i r)|
 *   Accelerometer gain:        (w_n^2 |Z|) / |Y''| === 1 / sqrt((1 - r^2)^2 + (2 zeta r)^2)
 *   Vibrometer gain:           |Z| / Y === |H_rel(i r)|
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};

  const PRESETS = {
    crossover: {
      key: 'crossover',
      label: 'Crossover (r = √2)',
      r: Math.SQRT2,
      zeta: 0.20,
      description:
        'At $r = \\sqrt{2} \\approx 1.414$, $|X| = |Y|$ for every damping ratio $\\zeta \\ge 0$: the displacement triangle $X = Y + Z$ becomes strictly isosceles.'
    },
    accelerometer: {
      key: 'accelerometer',
      label: 'Accelerometer (r = 0.40, ζ = 0.70)',
      r: 0.40,
      zeta: 0.70,
      description:
        'Stiff spring ($r \\ll 1$) with near-Butterworth damping $\\zeta = 0.70$: $|Z| \\approx |\\ddot{Y}|/\\omega_{\\mathrm{n}}^2$ stays flat within $\\pm 5\\%$ up to $r \\approx 0.59$.'
    },
    vibrometer: {
      key: 'vibrometer',
      label: 'Vibrometer (r = 2.80, ζ = 0.70)',
      r: 2.80,
      zeta: 0.70,
      description:
        'Soft spring ($r \\gg 1$): the inertial mass stays nearly stationary in space ($X \\to 0$), so relative spring deflection $Z \\approx -Y$ directly measures base displacement.'
    },
    unbalance_super: {
      key: 'unbalance_super',
      label: 'Supercritical rotor (r = 2.40, ζ = 0.15)',
      r: 2.40,
      zeta: 0.15,
      description:
        'Above resonance ($r > 1$), a rotating-unbalance machine flips $180^\\circ$ out of phase with the eccentric mass so the heavy spot swings inward and $MX/(m_0 e) \\to 1$.'
    }
  };

  function cDiv(a, b) {
    const d = b.re * b.re + b.im * b.im;
    if (d < 1e-30) return { re: 0, im: 0 };
    return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
  }
  function cAbs(a) { return Math.hypot(a.re, a.im); }
  function cArg(a) { return Math.atan2(a.im, a.re); }

  function evalBaseSensor(r, zeta) {
    const r2 = r * r;
    const den = { re: 1 - r2, im: 2 * zeta * r };
    const Habs = cDiv({ re: 1, im: 2 * zeta * r }, den);
    const Hrel = cDiv({ re: r2, im: 0 }, den); // note: X = Y + Z => Z = X - Y = (r^2 / den) Y!
    // Wait: check sign!
    // m x'' + c (x' - y') + k (x - y) = 0 -> m z'' + c z' + k z = -m y'' = +m w^2 Y e^{i w t}!
    // Dividing by k: (-r^2 + 1 + i 2 zeta r) Z = +r^2 Y  =>  Z / Y = +r^2 / ((1 - r^2) + i 2 zeta r)!
    // Check X / Y = 1 + Z / Y = ((1 - r^2) + i 2 zeta r + r^2) / den = (1 + i 2 zeta r) / den! EXACT!!

    const Td = cAbs(Habs);
    const Rrel = cAbs(Hrel);
    const accelGain = cAbs(cDiv({ re: 1, im: 0 }, den));
    const phAbs = cArg(Habs);
    const phRel = cArg(Hrel);

    const hasRelPeak = zeta < Math.SQRT1_2;
    const rRelPeak = hasRelPeak ? 1 / Math.sqrt(1 - 2 * zeta * zeta) : Infinity;

    return {
      r,
      zeta,
      Habs,
      Hrel,
      Td,
      Rrel,
      accelGain,
      phAbs,
      phRel,
      phAbsDeg: (phAbs * 180) / Math.PI,
      phRelDeg: (phRel * 180) / Math.PI,
      hasRelPeak,
      rRelPeak
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
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const lead = Math.min(10, L * 0.16);
    const body = L - 2 * lead;
    const n = coils || 6;
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
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
    if (L < 12) return;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const mid = L * 0.5, boxHalf = Math.min(9, L * 0.18), h = 6;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw || 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + ux * mid, y1 + uy * mid);
    ctx.moveTo(x1 + ux * mid - nx * (h - 2), y1 + uy * mid - ny * (h - 2));
    ctx.lineTo(x1 + ux * mid + nx * (h - 2), y1 + uy * mid + ny * (h - 2));
    ctx.stroke();
    const cStart = mid - boxHalf * 0.5, cEnd = mid + boxHalf;
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

  window.VibLab.MathSensors = {
    PRESETS,
    evalBaseSensor,
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
