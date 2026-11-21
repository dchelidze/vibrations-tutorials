/**
 * math1dof.js
 * Exact complex arithmetic, 1-DOF damped harmonic oscillator model,
 * poles & ROC, closed-form impulse/step/harmonic/free responses,
 * transfer function H(s), all six dimensional FRFs plus dimensionless ratios,
 * half-power bandwidth solver, convolution & DFT helpers, and NLD theme utilities.
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
        axis: 'rgba(242, 244, 246, 0.55)',
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
        rocFill: 'rgba(38, 181, 166, 0.12)',
        nonRocFill: 'rgba(240, 101, 127, 0.10)'
      };
    }
    return {
      bg: '#ffffff',
      panelBg: '#f7f6f2',
      grid: 'rgba(19, 36, 51, 0.09)',
      axis: 'rgba(19, 36, 51, 0.52)',
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
      rocFill: 'rgba(0, 137, 123, 0.09)',
      nonRocFill: 'rgba(162, 20, 47, 0.07)'
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

window.VibLab.Math1D = (function () {
  'use strict';

  /* ---------------- Complex Arithmetic ---------------- */
  function C(re, im) {
    return { re: re, im: im || 0 };
  }
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
    const safe = den < 1e-24 ? 1e-24 : den;
    return {
      re: (a.re * b.re + a.im * b.im) / safe,
      im: (a.im * b.re - a.re * b.im) / safe
    };
  }
  function cAbs(a) {
    return Math.hypot(a.re, a.im);
  }
  function cArgDeg(a) {
    return (Math.atan2(a.im, a.re) * 180) / Math.PI;
  }

  /* ---------------- Formatting Helpers ---------------- */
  function fmt(v, digits) {
    if (!Number.isFinite(v)) return '∞';
    const d = digits === undefined ? 2 : digits;
    const clean = Math.abs(v) < Math.pow(10, -(d + 2)) ? 0 : v;
    return clean.toFixed(d);
  }

  function fmtSci(v, digits) {
    if (!Number.isFinite(v)) return '∞';
    const d = digits === undefined ? 2 : digits;
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 0.01 && a < 1000) return v.toFixed(d);
    return v.toExponential(d);
  }

  /* ---------------- System Presets ---------------- */
  const PRESETS = {
    light: {
      key: 'light',
      label: 'Lightly damped',
      m: 1.0,
      k: 100.0,
      zeta: 0.08,
      description:
        'Light viscous damping ($\\zeta = 0.08$): sharp resonance near $\\omega_{\\mathrm{n}}$, complex-conjugate poles close to the $\\mathrm{i}\\omega$-axis, and slow exponential decay.'
    },
    moderate: {
      key: 'moderate',
      label: 'Moderately damped',
      m: 1.0,
      k: 100.0,
      zeta: 0.25,
      description:
        'Moderate damping ($\\zeta = 0.25$): broader resonance peak visibly shifted below $\\omega_{\\mathrm{n}}$ for receptance ($\\omega_{\\mathrm{r}} = \\omega_{\\mathrm{n}}\\sqrt{1 - 2\\zeta^2}$) and above $\\omega_{\\mathrm{n}}$ for accelerance.'
    },
    critical: {
      key: 'critical',
      label: 'Critically damped',
      m: 1.0,
      k: 100.0,
      zeta: 1.0,
      description:
        'Critical damping ($\\zeta = 1.00$): the two poles coalesce into a double real pole at $s = -\\omega_{\\mathrm{n}}$. Fastest non-oscillatory return to equilibrium; no resonant peak in receptance.'
    },
    overdamped: {
      key: 'overdamped',
      label: 'Overdamped',
      m: 1.0,
      k: 100.0,
      zeta: 1.4,
      description:
        'Overdamped regime ($\\zeta = 1.40$): two distinct negative real poles $p_1, p_2 < 0$. The impulse response is a difference of two real decaying exponentials with no oscillation.'
    },
    undamped: {
      key: 'undamped',
      label: 'Undamped limit',
      m: 1.0,
      k: 100.0,
      zeta: 0.0,
      description:
        'Undamped limit ($\\zeta = 0$): poles sit directly on the imaginary axis $s = \\pm\\mathrm{i}\\omega_{\\mathrm{n}}$. The ROC is $\\operatorname{Re}(s) > 0$, so the classical Fourier integral of $h(t)$ diverges unless weighted by $\\mathrm{e}^{-\\sigma t}$ ($\\sigma > 0$).'
    }
  };

  /* ---------------- Derived 1-DOF Properties ---------------- */
  function computeSystem(params) {
    const m = Math.max(0.05, params.m);
    const k = Math.max(1.0, params.k);
    const zeta = Math.max(0, params.zeta);
    const wn = Math.sqrt(k / m);
    const fn = wn / (2 * Math.PI);
    const c = 2 * zeta * Math.sqrt(m * k);
    const sigma = -zeta * wn;

    let regime = 'underdamped';
    let wd = 0;
    let p1, p2;

    if (zeta < 1e-6) {
      regime = 'undamped';
      wd = wn;
      p1 = C(0, wn);
      p2 = C(0, -wn);
    } else if (zeta < 1 - 1e-4) {
      regime = 'underdamped';
      wd = wn * Math.sqrt(1 - zeta * zeta);
      p1 = C(sigma, wd);
      p2 = C(sigma, -wd);
    } else if (Math.abs(zeta - 1) <= 1e-4) {
      regime = 'critical';
      wd = 0;
      p1 = C(-wn, 0);
      p2 = C(-wn, 0);
    } else {
      regime = 'overdamped';
      const beta = wn * Math.sqrt(zeta * zeta - 1);
      wd = 0;
      p1 = C(sigma + beta, 0); // slower (closer to imaginary axis)
      p2 = C(sigma - beta, 0); // faster
    }

    // ROC abscissa of convergence sigma_0 = max(Re(p1), Re(p2))
    const sigma0 = Math.max(p1.re, p2.re);
    const includesImagAxis = sigma0 < -1e-6;

    // Receptance resonance peak frequency & value
    const hasPeak = zeta < Math.SQRT1_2 - 1e-6;
    const wrRecept = hasPeak ? wn * Math.sqrt(1 - 2 * zeta * zeta) : 0;
    const peakRecept =
      zeta < 1e-6
        ? Infinity
        : hasPeak
          ? 1 / (2 * k * zeta * Math.sqrt(1 - zeta * zeta))
          : 1 / k;

    // Half-power frequencies for receptance (exact roots of |alpha(iw)|^2 = peak^2 / 2)
    let wHalfLow = null;
    let wHalfHigh = null;
    if (zeta > 1e-5 && hasPeak) {
      const targetDen2 = 2 * Math.pow(2 * zeta * Math.sqrt(1 - zeta * zeta), 2);
      // (1 - r^2)^2 + (2*zeta*r)^2 = targetDen2
      // r^4 - 2*(1 - 2*zeta^2)*r^2 + (1 - targetDen2) = 0
      const b = 1 - 2 * zeta * zeta;
      const disc = b * b - (1 - targetDen2);
      if (disc >= 0) {
        const sDisc = Math.sqrt(disc);
        const r2High = b + sDisc;
        const r2Low = b - sDisc;
        if (r2High > 0) wHalfHigh = wn * Math.sqrt(r2High);
        if (r2Low > 0) wHalfLow = wn * Math.sqrt(r2Low);
      }
    }

    const Q = zeta > 1e-6 ? 1 / (2 * zeta) : Infinity;

    return {
      m,
      k,
      c,
      zeta,
      wn,
      fn,
      wd,
      sigma,
      sigma0,
      includesImagAxis,
      regime,
      p1,
      p2,
      staticCompliance: 1 / k,
      hasPeak,
      wrRecept,
      peakRecept,
      wHalfLow,
      wHalfHigh,
      Q
    };
  }

  /* ---------------- Transfer Function H(s) = 1 / (m s^2 + c s + k) ---------------- */
  function transferH(sys, s) {
    const s2 = cMul(s, s);
    const den = C(
      sys.m * s2.re + sys.c * s.re + sys.k,
      sys.m * s2.im + sys.c * s.im
    );
    return cDiv(C(1, 0), den);
  }

  /* ---------------- Six Dimensional FRFs + Dimensionless Ratios ---------------- */
  const FRF_META = [
    {
      key: 'receptance',
      group: 'direct',
      name: 'Receptance',
      alt: 'Compliance / Dynamic flexibility',
      symbol: '\\alpha(\\mathrm{i}\\omega)',
      ratioTex: 'X(\\mathrm{i}\\omega) / F(\\mathrm{i}\\omega)',
      formulaTex: '\\dfrac{1}{(k - m\\omega^2) + \\mathrm{i}c\\omega}',
      units: 'm/N',
      unitsTex: '\\text{m/N}',
      lowSlope: '0 dB/dec (1/k)',
      highSlope: '−40 dB/dec (1/mω²)',
      phaseRange: '0° → −90° → −180°',
      sensor: 'Displacement probe / LVDT',
      colorKey: 'blue'
    },
    {
      key: 'mobility',
      group: 'direct',
      name: 'Mobility',
      alt: 'Mechanical admittance',
      symbol: 'Y(\\mathrm{i}\\omega)',
      ratioTex: 'V(\\mathrm{i}\\omega) / F(\\mathrm{i}\\omega)',
      formulaTex: '\\mathrm{i}\\omega\\,\\alpha(\\mathrm{i}\\omega)',
      units: 'm/(N·s)',
      unitsTex: '\\text{m/(N}\\cdot\\text{s)}',
      lowSlope: '+20 dB/dec (ω/k)',
      highSlope: '−20 dB/dec (1/mω)',
      phaseRange: '+90° → 0° → −90°',
      sensor: 'Laser Doppler vibrometer',
      colorKey: 'teal'
    },
    {
      key: 'accelerance',
      group: 'direct',
      name: 'Accelerance',
      alt: 'Inertance',
      symbol: 'A(\\mathrm{i}\\omega)',
      ratioTex: '\\ddot{X}(\\mathrm{i}\\omega) / F(\\mathrm{i}\\omega)',
      formulaTex: '-\\omega^2\\,\\alpha(\\mathrm{i}\\omega)',
      units: 'kg⁻¹',
      unitsTex: '\\text{m/(s}^2\\cdot\\text{N)} = \\text{kg}^{-1}',
      lowSlope: '+40 dB/dec (ω²/k)',
      highSlope: '0 dB/dec (1/m)',
      phaseRange: '+180° → +90° → 0°',
      sensor: 'Piezoelectric accelerometer',
      colorKey: 'orange'
    },
    {
      key: 'dynStiffness',
      group: 'reciprocal',
      name: 'Dynamic stiffness',
      alt: 'Reciprocal of receptance',
      symbol: 'Z_k(\\mathrm{i}\\omega)',
      ratioTex: 'F(\\mathrm{i}\\omega) / X(\\mathrm{i}\\omega)',
      formulaTex: '(k - m\\omega^2) + \\mathrm{i}c\\omega',
      units: 'N/m',
      unitsTex: '\\text{N/m}',
      lowSlope: '0 dB/dec (k)',
      highSlope: '+40 dB/dec (mω²)',
      phaseRange: '0° → +90° → +180°',
      sensor: 'Stiffness / isolator sizing',
      colorKey: 'blue'
    },
    {
      key: 'impedance',
      group: 'reciprocal',
      name: 'Mechanical impedance',
      alt: 'Reciprocal of mobility',
      symbol: 'Z(\\mathrm{i}\\omega)',
      ratioTex: 'F(\\mathrm{i}\\omega) / V(\\mathrm{i}\\omega)',
      formulaTex: 'c + \\mathrm{i}\\!\\left(m\\omega - k/\\omega\\right)',
      units: 'N·s/m',
      unitsTex: '\\text{N}\\cdot\\text{s/m}',
      lowSlope: '−20 dB/dec (k/ω)',
      highSlope: '+20 dB/dec (mω)',
      phaseRange: '−90° → 0° → +90°',
      sensor: 'Power flow & damping (min = c)',
      colorKey: 'teal'
    },
    {
      key: 'apparentMass',
      group: 'reciprocal',
      name: 'Apparent mass',
      alt: 'Dynamic mass (reciprocal of accelerance)',
      symbol: 'M_{\\mathrm{app}}(\\mathrm{i}\\omega)',
      ratioTex: 'F(\\mathrm{i}\\omega) / \\ddot{X}(\\mathrm{i}\\omega)',
      formulaTex: 'm - \\dfrac{k}{\\omega^2} - \\mathrm{i}\\dfrac{c}{\\omega}',
      units: 'kg',
      unitsTex: '\\text{kg} = \\text{N}\\cdot\\text{s}^2\\text{/m}',
      lowSlope: '−40 dB/dec (k/ω²)',
      highSlope: '0 dB/dec (m)',
      phaseRange: '−180° → −90° → 0°',
      sensor: 'Base-force / shaker load cell',
      colorKey: 'orange'
    }
  ];

  function evalFRF(sys, key, w) {
    const ww = Math.max(1e-6, w);
    const den = C(sys.k - sys.m * ww * ww, sys.c * ww);
    const alpha = cDiv(C(1, 0), den);

    switch (key) {
      case 'receptance':
        return alpha;
      case 'mobility':
        return cMul(C(0, ww), alpha);
      case 'accelerance':
        return C(-ww * ww * alpha.re, -ww * ww * alpha.im);
      case 'dynStiffness':
        return den;
      case 'impedance':
        return C(sys.c, sys.m * ww - sys.k / ww);
      case 'apparentMass':
        return C(sys.m - sys.k / (ww * ww), -sys.c / ww);
      case 'daf':
        return C(sys.k * alpha.re, sys.k * alpha.im);
      case 'transmissibility': {
        const num = C(sys.k, sys.c * ww);
        return cDiv(num, den);
      }
      default:
        return alpha;
    }
  }

  /**
   * Unwrapped / continuous physical phase in degrees tailored to each FRF so plots
   * do not have spurious +/-180 deg branch jumps.
   */
  function evalFRFPhaseDeg(sys, key, w) {
    const ww = Math.max(1e-6, w);
    // Base receptance phase in [-180, 0]
    const denomPhase = (Math.atan2(sys.c * ww, sys.k - sys.m * ww * ww) * 180) / Math.PI; // in [0, 180]
    const alphaPhase = -denomPhase; // 0 -> -90 -> -180

    switch (key) {
      case 'receptance':
      case 'daf':
        return alphaPhase;
      case 'mobility':
        return alphaPhase + 90; // +90 -> 0 -> -90
      case 'accelerance':
        return alphaPhase + 180; // +180 -> +90 -> 0
      case 'dynStiffness':
        return denomPhase; // 0 -> +90 -> +180
      case 'impedance':
        return denomPhase - 90; // -90 -> 0 -> +90
      case 'apparentMass':
        return denomPhase - 180; // -180 -> -90 -> 0
      case 'transmissibility': {
        const numPhase = (Math.atan2(sys.c * ww, sys.k) * 180) / Math.PI;
        return numPhase - denomPhase;
      }
      default:
        return alphaPhase;
    }
  }

  /* ---------------- Closed-Form Time-Domain Responses ---------------- */
  function impulseResponse(sys, t) {
    if (t < 0) return 0;
    const { m, wn, wd, zeta, sigma, regime, p1, p2 } = sys;
    if (regime === 'undamped') {
      return Math.sin(wn * t) / (m * wn);
    }
    if (regime === 'underdamped') {
      return (Math.exp(sigma * t) * Math.sin(wd * t)) / (m * wd);
    }
    if (regime === 'critical') {
      return (t * Math.exp(-wn * t)) / m;
    }
    // Overdamped: (e^{p1 t} - e^{p2 t}) / (m (p1 - p2))
    return (Math.exp(p1.re * t) - Math.exp(p2.re * t)) / (m * (p1.re - p2.re));
  }

  function stepResponse(sys, t, F0) {
    if (t < 0) return 0;
    const amp = F0 === undefined ? 1 : F0;
    const { k, wn, wd, zeta, sigma, regime, p1, p2 } = sys;
    if (regime === 'undamped') {
      return (amp / k) * (1 - Math.cos(wn * t));
    }
    if (regime === 'underdamped') {
      return (
        (amp / k) *
        (1 - Math.exp(sigma * t) * (Math.cos(wd * t) + (zeta * wn / wd) * Math.sin(wd * t)))
      );
    }
    if (regime === 'critical') {
      return (amp / k) * (1 - Math.exp(-wn * t) * (1 + wn * t));
    }
    // Overdamped
    const r1 = p1.re;
    const r2 = p2.re;
    const term = (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
    return (amp / k) * (1 - term);
  }

  function freeResponse(sys, t, x0, v0) {
    if (t < 0) return 0;
    const { wn, wd, zeta, sigma, regime, p1, p2 } = sys;
    if (regime === 'undamped') {
      return x0 * Math.cos(wn * t) + (v0 / wn) * Math.sin(wn * t);
    }
    if (regime === 'underdamped') {
      return (
        Math.exp(sigma * t) *
        (x0 * Math.cos(wd * t) + ((v0 + zeta * wn * x0) / wd) * Math.sin(wd * t))
      );
    }
    if (regime === 'critical') {
      return Math.exp(-wn * t) * (x0 + (v0 + wn * x0) * t);
    }
    // Overdamped: A e^{r1 t} + B e^{r2 t}
    const r1 = p1.re;
    const r2 = p2.re;
    const A = (v0 - r2 * x0) / (r1 - r2);
    const B = x0 - A;
    return A * Math.exp(r1 * t) + B * Math.exp(r2 * t);
  }

  /**
   * Total response to f(t) = F0 * cos(w t) u(t) from zero initial conditions (x(0)=0, v(0)=0),
   * decomposed into steady-state + transient so students see the Laplace transient decay
   * into the Fourier steady state.
   */
  function harmonicResponse(sys, t, F0, w) {
    const H = evalFRF(sys, 'receptance', w);
    const mag = cAbs(H);
    const phi = Math.atan2(H.im, H.re); // radians
    const xss = F0 * mag * Math.cos(w * t + phi);
    const xss0 = F0 * mag * Math.cos(phi);
    const vss0 = -F0 * mag * w * Math.sin(phi);
    // Transient cancels xss(0) and vss(0) so total starts at rest
    const xtr = freeResponse(sys, t, -xss0, -vss0);
    return {
      total: xss + xtr,
      steady: xss,
      transient: xtr,
      mag,
      phiDeg: evalFRFPhaseDeg(sys, 'receptance', w)
    };
  }

  /* ---------------- Input Signals & Numerical Convolution / Spectrum ---------------- */
  function evalInputSignal(type, t, wn) {
    if (t < 0) return 0;
    const T0 = (2 * Math.PI) / wn; // 1 natural period
    switch (type) {
      case 'hammer': {
        // Half-sine impact hammer pulse of duration 0.35 * T0
        const tau = 0.35 * T0;
        if (t > tau) return 0;
        return Math.sin((Math.PI * t) / tau);
      }
      case 'rect': {
        // Rectangular pulse of duration 0.6 * T0
        const tau = 0.6 * T0;
        return t <= tau ? 1.0 : 0;
      }
      case 'twotone': {
        // Windowed two-tone burst: one near wn, one at 2.1*wn
        const dur = 3.2 * T0;
        if (t > dur) return 0;
        const win = Math.sin((Math.PI * t) / dur);
        return win * (0.65 * Math.cos(0.95 * wn * t) + 0.65 * Math.cos(2.15 * wn * t));
      }
      case 'chirp': {
        // Smooth linear frequency sweep from 0.2*wn to 2.2*wn
        const dur = 3.2 * T0;
        if (t > dur) return 0;
        const wStart = 0.2 * wn;
        const wEnd = 2.2 * wn;
        const phase = wStart * t + ((wEnd - wStart) / (2 * dur)) * t * t;
        const win = Math.pow(Math.sin((Math.PI * t) / dur), 0.35);
        return win * Math.sin(phase);
      }
      default:
        return 0;
    }
  }

  /**
   * Computes discrete Fourier integral F(iw) = \int_0^{Tmax} f(t) e^{-i w t} dt
   * on a uniform frequency grid using trapezoidal quadrature.
   */
  function computeSpectrum(tArr, fArr, wArr) {
    const dt = tArr.length > 1 ? tArr[1] - tArr[0] : 0.01;
    const nT = tArr.length;
    const out = new Array(wArr.length);
    for (let k = 0; k < wArr.length; k++) {
      const w = wArr[k];
      let re = 0;
      let im = 0;
      for (let n = 0; n < nT; n++) {
        const wt = w * tArr[n];
        const weight = n === 0 || n === nT - 1 ? 0.5 : 1.0;
        const fw = fArr[n] * weight;
        re += fw * Math.cos(wt);
        im -= fw * Math.sin(wt);
      }
      out[k] = C(re * dt, im * dt);
    }
    return out;
  }

  return {
    C,
    cAdd,
    cSub,
    cMul,
    cDiv,
    cAbs,
    cArgDeg,
    fmt,
    fmtSci,
    PRESETS,
    FRF_META,
    computeSystem,
    transferH,
    evalFRF,
    evalFRFPhaseDeg,
    impulseResponse,
    stepResponse,
    freeResponse,
    harmonicResponse,
    evalInputSignal,
    computeSpectrum
  };
})();
