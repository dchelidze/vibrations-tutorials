/**
 * math-fourier.js
 * Exact analytical mathematics engine for Module 10:
 * Periodic Forcing, Fourier Epicycles, Harmonic Filtering, and Subharmonic Resonance.
 *
 * Dimensionless SDOF oscillator (k = 1, w_n = 1):
 *   x'' + 2 zeta x' + x = f(tau),  tau = w_n t,  period T_0 = 2 pi / r_0,  r_0 = w_0 / w_n.
 *
 * Periodic input expansion (in terms of phase theta = w_0 t):
 *   f(theta) = a0Half + sum_{n=1}^{N} c_n cos(n theta + psi_n)
 * Exact steady-state output:
 *   x_ss(theta) = a0Half + sum_{n=1}^{N} (c_n M_n) cos(n theta + psi_n + phi_n)
 * where H(i r_n) = 1 / ((1 - r_n^2) + i 2 zeta r_n),  r_n = n r_0,
 *   M_n = |H(i r_n)|,  phi_n = arg(H(i r_n)) in (-pi, 0].
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};

  const WAVEFORMS = {
    square: {
      key: 'square',
      name: 'Square wave (odd harmonics)',
      short: 'Square',
      a0Half: 0,
      exact: (th) => {
        const s = Math.sin(th);
        return s >= 0 ? 1 : -1;
      },
      harmonic: (n) => {
        if (n % 2 === 0) return { c: 0, psi: 0 };
        // (4 / (n pi)) sin(n th) = (4 / (n pi)) cos(n th - pi/2)
        return { c: 4 / (n * Math.PI), psi: -Math.PI / 2 };
      }
    },
    sawtooth: {
      key: 'sawtooth',
      name: 'Sawtooth wave (all harmonics)',
      short: 'Sawtooth',
      a0Half: 0,
      exact: (th) => {
        // Sawtooth normalized to [-1, 1] on (-pi, pi) matching (2/pi) sum (-1)^(n+1)/n sin(n th)
        const m = ((((th + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
        return m / Math.PI;
      },
      harmonic: (n) => {
        // (2 / (n pi)) (-1)^(n+1) sin(n th)
        const c = 2 / (n * Math.PI);
        const psi = n % 2 === 1 ? -Math.PI / 2 : Math.PI / 2;
        return { c, psi };
      }
    },
    halfrect: {
      key: 'halfrect',
      name: 'Half-rectified pulse (DC + n=1 + even)',
      short: 'Half-rectified',
      a0Half: 1 / Math.PI,
      exact: (th) => Math.max(0, Math.cos(th)),
      harmonic: (n) => {
        if (n === 1) return { c: 0.5, psi: 0 };
        if (n % 2 === 1) return { c: 0, psi: 0 };
        // 2 * (-1)^(n/2 - 1) / (pi * (n^2 - 1)) * cos(n th)
        const sgn = ((n / 2) % 2 === 1) ? 1 : -1;
        const c = 2 / (Math.PI * (n * n - 1));
        return { c, psi: sgn > 0 ? 0 : Math.PI };
      }
    },
    triangle: {
      key: 'triangle',
      name: 'Triangle wave (odd, 1/n² decay)',
      short: 'Triangle',
      a0Half: 0,
      exact: (th) => {
        const m = ((((th + Math.PI / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI / 2;
        if (m <= Math.PI / 2) return (2 / Math.PI) * m;
        return 2 - (2 / Math.PI) * m;
      },
      harmonic: (n) => {
        if (n % 2 === 0) return { c: 0, psi: 0 };
        const sgn = (((n - 1) / 2) % 2 === 0) ? 1 : -1;
        const c = 8 / (Math.PI * Math.PI * n * n);
        // sgn * c * sin(n th) = c * cos(n th - sgn*pi/2)
        return { c, psi: sgn > 0 ? -Math.PI / 2 : Math.PI / 2 };
      }
    }
  };

  const PRESETS = {
    square_third: {
      key: 'square_third',
      wave: 'square',
      r0: 1 / 3,
      zeta: 0.06,
      N: 9,
      description:
        'Square wave driven at one-third of natural frequency ($r_0 = 1/3$): the $n=3$ harmonic hits exact resonance ($3r_0 = 1$), so the oscillator locks onto a large 3× faster oscillation!'
    },
    saw_half: {
      key: 'saw_half',
      wave: 'sawtooth',
      r0: 0.50,
      zeta: 0.06,
      N: 9,
      description:
        'Sawtooth wave driven at $r_0 = 1/2$: unlike a square wave, the sawtooth carries even harmonics, so $n = 2$ lands squarely on $2r_0 = 1$ and dominates the response.'
    },
    halfrect_half: {
      key: 'halfrect_half',
      wave: 'halfrect',
      r0: 0.50,
      zeta: 0.06,
      N: 10,
      description:
        'Half-wave rectified pulse at $r_0 = 1/2$: combines a static DC offset ($1/\\pi$) with strong 2nd-harmonic resonance ($2r_0 = 1$), while $r_0 = 1/3$ remains quiet.'
    },
    square_fund: {
      key: 'square_fund',
      wave: 'square',
      r0: 1.00,
      zeta: 0.12,
      N: 11,
      description:
        'Square wave at fundamental resonance ($r_0 = 1$): the SDOF oscillator acts as a sharp low-pass mechanical filter, turning a jagged square input into a nearly pure sinusoid.'
    }
  };

  function evalFRF(r, zeta) {
    const reDen = 1 - r * r;
    const imDen = 2 * zeta * r;
    const mag = 1 / Math.hypot(reDen, imDen);
    const phi = -Math.atan2(imDen, reDen); // in (-pi, 0] for r >= 0
    return { mag, phi, phiDeg: (phi * 180) / Math.PI };
  }

  function evalPeriodicSystem(waveKey, r0, zeta, N) {
    const wf = WAVEFORMS[waveKey] || WAVEFORMS.square;
    const nMax = Math.max(1, Math.min(15, Math.round(N || 9)));
    const a0Half = wf.a0Half;
    const harmonics = [];
    let fMeanSq = a0Half * a0Half;
    let xMeanSq = a0Half * a0Half;
    let domN = 0;
    let domAmp = Math.abs(a0Half);

    for (let n = 1; n <= nMax; n++) {
      const hIn = wf.harmonic(n);
      const rn = n * r0;
      const frf = evalFRF(rn, zeta);
      const outAmp = hIn.c * frf.mag;
      const outPsi = hIn.psi + frf.phi;
      fMeanSq += 0.5 * hIn.c * hIn.c;
      xMeanSq += 0.5 * outAmp * outAmp;
      if (outAmp > domAmp) {
        domAmp = outAmp;
        domN = n;
      }
      harmonics.push({
        n,
        rn,
        c: hIn.c,
        psi: hIn.psi,
        mag: frf.mag,
        phi: frf.phi,
        phiDeg: frf.phiDeg,
        outAmp,
        outPsi,
        energyFrac: 0
      });
    }

    const fRms = Math.sqrt(fMeanSq);
    const xRms = Math.sqrt(xMeanSq);
    const dcEnergyFrac = xMeanSq > 1e-18 ? (a0Half * a0Half) / xMeanSq : 0;
    harmonics.forEach((h) => {
      h.energyFrac = xMeanSq > 1e-18 ? (0.5 * h.outAmp * h.outAmp) / xMeanSq : 0;
    });

    function evalInput(theta) {
      let s = a0Half;
      for (let i = 0; i < harmonics.length; i++) {
        const h = harmonics[i];
        if (h.c > 0) s += h.c * Math.cos(h.n * theta + h.psi);
      }
      return s;
    }

    function evalOutput(theta) {
      let s = a0Half;
      for (let i = 0; i < harmonics.length; i++) {
        const h = harmonics[i];
        if (h.outAmp > 0) s += h.outAmp * Math.cos(h.n * theta + h.outPsi);
      }
      return s;
    }

    return {
      waveKey: wf.key,
      waveName: wf.name,
      waveShort: wf.short,
      r0,
      zeta,
      N: nMax,
      a0Half,
      harmonics,
      fRms,
      xRms,
      rmsGain: fRms > 1e-12 ? xRms / fRms : 0,
      dcEnergyFrac,
      domN,
      domAmp,
      exactInput: wf.exact,
      evalInput,
      evalOutput
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

  window.VibLab.MathFourier = {
    WAVEFORMS,
    PRESETS,
    evalFRF,
    evalPeriodicSystem,
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
