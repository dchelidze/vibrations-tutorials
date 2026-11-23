/**
 * app.js
 * Main controller for Module 01 (sdof-root-locus-logdec):
 * Viscous Free-Response Root Locus and Logarithmic Decrement Identification.
 */
(function () {
  'use strict';

  const M = window.VibLab.MathRootLocus;
  const VizLocus = window.VibLab.VizLocus;
  const VizLogDec = window.VibLab.VizLogDec;

  const state = {
    zeta: 0.08,
    wn: 2.0,
    noise: 0.00,
    presetKey: 'light_under',
    sys: null
  };

  let locusViz, logdecViz;

  function renderMathIn(el) {
    if (!el || typeof renderMathInElement !== 'function') return;
    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false }
      ],
      throwOnError: false
    });
  }

  function renderKatex(el, tex, displayMode) {
    if (!el) return;
    if (typeof katex !== 'undefined') {
      katex.render(tex, el, { displayMode: !!displayMode, throwOnError: false });
    } else {
      el.textContent = tex;
    }
  }

  function recompute() {
    state.sys = M.evalSystem(state.zeta, state.wn, state.noise);
    if (locusViz) locusViz.setSystem(state.sys);
    if (logdecViz) logdecViz.setSystem(state.sys);
    updateReadouts();
    updateEquations();
    updateInsight();
    updateCodeSnippet();
  }

  function updateReadouts() {
    const s = state.sys;
    const rt = s.roots;
    const ld = s.logdec;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    set('val-zeta', 'ζ = ' + M.fmt(state.zeta, 2));
    set('val-wn', 'ωₙ = ' + M.fmt(state.wn, 1) + ' rad/s');
    set('val-noise', 'σ = ' + M.fmt(state.noise * 100, 0) + '%');

    if (rt.regime === 'underdamped') {
      set('stat-poles', M.fmt(rt.s1.re, 2) + ' ± ' + M.fmt(rt.s1.im, 2) + 'i');
      set('stat-regime', 'Underdamped (θ = ' + M.fmt(rt.thetaDeg, 1) + '°)');
    } else if (rt.regime === 'critical') {
      set('stat-poles', M.fmt(-state.wn, 2) + ' (double)');
      set('stat-regime', 'Critically damped (ζ = 1)');
    } else {
      set('stat-poles', M.fmt(rt.s1.re, 2) + ', ' + M.fmt(rt.s2.re, 2));
      set('stat-regime', 'Overdamped (s₁s₂ = ωₙ²)');
    }

    set('stat-ts', M.fmt(s.ts, 2) + ' s (ωₙtₛ = ' + M.fmt(s.wnTs, 2) + ')');

    if (ld.valid) {
      set('stat-delta', M.fmt(ld.deltaExact, 3));
      set('stat-zols', M.fmt(ld.zetaOLS, 3));
      set('stat-z1', M.fmt(ld.zeta1, 3));
      set('stat-zapprox', M.fmt(ld.zetaApprox, 3));
    } else {
      set('stat-delta', 'N/A (ζ ≥ 1)');
      set('stat-zols', 'N/A');
      set('stat-z1', 'N/A');
      set('stat-zapprox', 'N/A');
    }
  }

  function updateEquations() {
    const s = state.sys;
    const rt = s.roots;
    const ld = s.logdec;

    if (rt.regime === 'underdamped') {
      renderKatex(
        document.getElementById('eq-roots'),
        's_{1,2} = -\\zeta\\omega_{\\mathrm{n}} \\pm \\mathrm{i}\\omega_{\\mathrm{d}} = ' +
          M.fmtTex(rt.s1.re, 2) + ' \\pm ' + M.fmtTex(rt.s1.im, 2) + '\\mathrm{i}, \\qquad |s_{1,2}| = \\omega_{\\mathrm{n}} = ' + M.fmtTex(state.wn, 2),
        true
      );
    } else if (rt.regime === 'critical') {
      renderKatex(
        document.getElementById('eq-roots'),
        's_{1,2} = -\\omega_{\\mathrm{n}} = ' + M.fmtTex(-state.wn, 2) + '\\;\\text{(double real pole)}, \\qquad x(t) = (1 + \\omega_{\\mathrm{n}} t)\\,e^{-\\omega_{\\mathrm{n}} t}',
        true
      );
    } else {
      renderKatex(
        document.getElementById('eq-roots'),
        's_{1,2} = \\omega_{\\mathrm{n}}\\bigl(-\\zeta \\pm \\sqrt{\\zeta^2 - 1}\\bigr) = \\{' +
          M.fmtTex(rt.s1.re, 2) + ',\\,' + M.fmtTex(rt.s2.re, 2) + '\\}, \\qquad s_1 s_2 = \\omega_{\\mathrm{n}}^2 = ' + M.fmtTex(state.wn * state.wn, 2),
        true
      );
    }

    if (ld.valid) {
      renderKatex(
        document.getElementById('eq-logdec'),
        '\\delta = \\ln\\frac{x_k}{x_{k+1}} = \\frac{2\\pi\\zeta}{\\sqrt{1-\\zeta^2}} = ' +
          M.fmtTex(ld.deltaExact, 3) +
          ' \\;\\Longleftrightarrow\\; \\hat{\\zeta}_{\\mathrm{OLS}} = \\frac{\\delta_{\\mathrm{fit}}}{\\sqrt{4\\pi^2 + \\delta_{\\mathrm{fit}}^2}} = ' +
          M.fmtTex(ld.zetaOLS, 3),
        true
      );
    } else {
      renderKatex(
        document.getElementById('eq-logdec'),
        '\\zeta = ' + M.fmtTex(state.zeta, 2) + ' \\ge 1:\\; \\text{non-oscillatory decay (logarithmic decrement applies to } 0 < \\zeta < 1 \\text{)}',
        true
      );
    }
  }

  function updateInsight() {
    const el = document.getElementById('regime-insight');
    if (!el) return;
    const s = state.sys;
    const rt = s.roots;
    let html = '';
    if (rt.regime === 'critical') {
      html =
        '<strong>Critical damping boundary ($\\zeta = 1$):</strong> Both roots meet at $-\\omega_{\\mathrm{n}}$. Any further increase in damping pushes one pole toward $0^-$ and slows the return to equilibrium.';
    } else if (rt.regime === 'overdamped') {
      html =
        '<strong>Overdamped slow-pole penalty ($\\zeta = ' + M.fmt(state.zeta, 2) + '$):</strong> Although $s_2 = ' +
        M.fmt(rt.s2.re, 2) + '$ decays rapidly, the slow pole $s_1 = ' + M.fmt(rt.s1.re, 2) +
        '$ governs the tail, stretching 2% settling time to $\\omega_{\\mathrm{n}} t_s = ' + M.fmt(s.wnTs, 2) + '$.';
    } else if (state.noise > 0.005) {
      html =
        '<strong>Noise rejection by multi-cycle regression:</strong> With $\\sigma = ' + M.fmt(state.noise * 100, 0) +
        '\\%$ peak noise, a single peak pair yields $\\hat{\\zeta}_1 = ' + M.fmt(s.logdec.zeta1, 3) +
        '$ whereas OLS semilog regression across all peaks gives $\\hat{\\zeta}_{\\mathrm{OLS}} = ' +
        M.fmt(s.logdec.zetaOLS, 3) + '$ (true $\\zeta = ' + M.fmt(state.zeta, 3) + '$).';
    } else if (state.zeta > 0.30) {
      const errPct = ((s.roots.zetaApprox - state.zeta) / state.zeta) * 100;
      html =
        '<strong>Small-damping approximation breakdown ($\\zeta = ' + M.fmt(state.zeta, 2) + '$):</strong> Here $\\delta/(2\\pi) = ' +
        M.fmt(s.roots.zetaApprox, 3) + '$ overestimates true $\\zeta$ by <strong>+' + M.fmt(errPct, 1) +
        '%</strong>. Always use the exact formula $\\zeta = \\delta/\\sqrt{4\\pi^2 + \\delta^2}$ once $\\zeta > 0.30$.';
    } else {
      html =
        '<strong>Underdamped semicircle ($|s| = \\omega_{\\mathrm{n}}$):</strong> The pole angle $\\theta = \\arccos(\\zeta) = ' +
        M.fmt(rt.thetaDeg, 1) + '^\\circ$ controls both overshoot and logarithmic decrement $\\delta = 2\\pi\\cot\\theta = ' +
        M.fmt(rt.delta, 3) + '$.';
    }
    el.innerHTML = html;
    renderMathIn(el);
  }

  function updateCodeSnippet() {
    const el = document.getElementById('code-snippet');
    if (!el) return;
    el.textContent =
`% Module 01: Viscous Free-Response Root Locus & Logarithmic Decrement (Inman Ch. 1)
zeta = ${M.fmt(state.zeta, 3)};   wn = ${M.fmt(state.wn, 2)};
s = roots([1, 2*zeta*wn, wn^2]);      % Exact characteristic poles
fprintf('Poles: %.3f %+.3fi,  %.3f %+.3fi\\n', real(s(1)), imag(s(1)), real(s(2)), imag(s(2)));

if zeta > 0 && zeta < 1
    wd = wn * sqrt(1 - zeta^2);
    Td = 2*pi / wd;
    k = (0:5).';
    xk = exp(-zeta * wn * k * Td);    % Exact positive peaks for x(0)=1, v(0)=0
    p = polyfit(k, log(xk), 1);       % Semilog OLS fit: ln(x_k) = a - delta*k
    delta_fit = -p(1);
    zeta_exact = delta_fit / sqrt(4*pi^2 + delta_fit^2);
    zeta_approx = delta_fit / (2*pi);
    fprintf('delta = %.4f | zeta_exact = %.4f | delta/(2pi) = %.4f\\n', ...
        delta_fit, zeta_exact, zeta_approx);
end`;
  }

  function syncSliders() {
    const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setV('slider-zeta', state.zeta);
    setV('slider-wn', state.wn);
    setV('slider-noise', state.noise);
  }

  function applyPreset(key) {
    const p = M.PRESETS[key];
    if (!p) return;
    state.presetKey = key;
    state.zeta = p.zeta;
    state.wn = p.wn;
    state.noise = p.noise;
    syncSliders();
    document.querySelectorAll('#preset-selector .pill').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-preset') === key);
    });
    const desc = document.getElementById('preset-desc');
    if (desc) {
      desc.innerHTML = p.description;
      renderMathIn(desc);
    }
    recompute();
  }

  function clearPreset() {
    state.presetKey = null;
    document.querySelectorAll('#preset-selector .pill').forEach((b) => b.classList.remove('active'));
  }

  function bindControls() {
    const bindSlider = (id, fn) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => { fn(parseFloat(el.value)); clearPreset(); recompute(); });
    };
    bindSlider('slider-zeta', (v) => { state.zeta = v; });
    bindSlider('slider-wn', (v) => { state.wn = v; });
    bindSlider('slider-noise', (v) => { state.noise = v; });

    document.querySelectorAll('#preset-selector .pill').forEach((b) => {
      b.addEventListener('click', () => applyPreset(b.getAttribute('data-preset')));
    });

    const themeBtn = document.getElementById('btn-theme');
    const themeLabel = document.getElementById('btn-theme-label');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme');
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        if (themeLabel) themeLabel.textContent = next === 'dark' ? 'Light' : 'Dark';
        if (locusViz) locusViz.render();
        if (logdecViz) logdecViz.render();
      });
    }

    const copyBtn = document.getElementById('btn-copy-code');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const pre = document.getElementById('code-snippet');
        if (!pre) return;
        navigator.clipboard.writeText(pre.textContent).then(() => {
          copyBtn.textContent = 'Copied';
          setTimeout(() => { copyBtn.textContent = 'Copy MATLAB'; }, 1600);
        });
      });
    }

    const navLinks = document.querySelectorAll('.chapter-nav a');
    const sections = ['sec-locus', 'sec-logdec', 'sec-approx', 'sec-summary']
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    window.addEventListener('scroll', () => {
      let curId = sections[0] ? sections[0].id : '';
      for (const sec of sections) {
        if (sec.getBoundingClientRect().top <= 130) curId = sec.id;
      }
      navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + curId));
    });
  }

  function init() {
    state.sys = M.evalSystem(state.zeta, state.wn, state.noise);
    locusViz = VizLocus.create({ locusCanvasId: 'locus-canvas', waveCanvasId: 'wave-canvas', sys: state.sys });
    logdecViz = VizLogDec.create({
      peaksCanvasId: 'peaks-canvas',
      regCanvasId: 'reg-canvas',
      approxCanvasId: 'approx-canvas',
      settleCanvasId: 'settle-canvas',
      sys: state.sys
    });

    bindControls();
    applyPreset('light_under');
    renderMathIn(document.body);

    window.addEventListener('resize', () => {
      if (locusViz) locusViz.render();
      if (logdecViz) logdecViz.render();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
