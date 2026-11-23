/**
 * app.js
 * Central reactive controller for Module 08:
 * Damping Mechanisms in the Force-Displacement Plane (Viscous, Coulomb, Structural)
 * and Coulomb Stick-Slip Free Decay.
 */
(function () {
  'use strict';

  const M = window.VibLab.MathDamping;

  const KATEX_DELIMITERS = [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
    { left: '\\(', right: '\\)', display: false },
    { left: '\\[', right: '\\]', display: true }
  ];

  const app = {
    presetKey: 'matched_r1',
    params: Object.assign({}, M.PRESETS.matched_r1),
    codeLang: 'matlab',
    citeFormat: 'apa',
    viz: {}
  };

  function typesetElement(el) {
    if (!el || typeof window.renderMathInElement !== 'function') return;
    window.renderMathInElement(el, {
      delimiters: KATEX_DELIMITERS,
      throwOnError: false
    });
  }

  function renderTex(el, tex, displayMode) {
    if (!el) return;
    if (typeof window.katex !== 'undefined' && typeof window.katex.render === 'function') {
      window.katex.render(tex, el, {
        displayMode: !!displayMode,
        throwOnError: false,
        strict: false
      });
    } else {
      el.textContent = tex;
    }
  }

  function recompute(keepPreset) {
    const p = app.params;
    const d = M.evalDissipation(p);

    const pairs = [
      ['slider-r', 'val-r', p.r, 'r = ', 2, false],
      ['slider-x', 'val-x', p.X, 'X = ', 2, false],
      ['slider-u0', 'val-u0', p.u0, '<i>u</i><sub>0</sub> = ', 2, true],
      ['slider-delta', 'val-delta', p.delta, 'δ = ', 2, false],
      ['slider-fc', 'val-fc', p.Fc, '<i>F</i><sub>c</sub>/<i>F</i><sub>0</sub> = ', 2, true]
    ];
    for (const [sid, vid, val, pref, dec, isHtml] of pairs) {
      const sl = document.getElementById(sid);
      const vl = document.getElementById(vid);
      if (sl) sl.value = val;
      if (vl) {
        if (isHtml) vl.innerHTML = pref + M.fmt(val, dec);
        else vl.textContent = pref + M.fmt(val, dec);
      }
    }

    if (!keepPreset) {
      document.querySelectorAll('#preset-selector .pill').forEach((b) => {
        b.classList.toggle('active', b.dataset.preset === app.presetKey);
      });
    }

    // Hero description
    const descEl = document.getElementById('preset-desc-text');
    if (descEl) {
      const pr = M.PRESETS[app.presetKey];
      descEl.textContent = pr
        ? pr.description
        : 'Custom point: $r = ' + M.fmtTex(p.r, 2) + '$, $X = ' + M.fmtTex(p.X, 2) + '$, dead-zone half-width $\\delta = ' + M.fmtTex(p.delta, 2) + '$.';
      typesetElement(descEl);
    }

    // Section 1 KPIs: hysteresis areas & equivalent damping
    const kV = document.getElementById('sec1-visc');
    const kS = document.getElementById('sec1-struct');
    const kC = document.getElementById('sec1-coul');
    if (kV) renderTex(kV, '\\Delta E = ' + M.fmtTex(d.dE_visc, 3) + ',\\; \\zeta_{\\mathrm{eq}} = ' + M.fmtTex(d.zEq_visc, 3), false);
    if (kS) renderTex(kS, '\\Delta E = ' + M.fmtTex(d.dE_struct, 3) + ',\\; \\zeta_{\\mathrm{eq}} = ' + M.fmtTex(d.zEq_struct, 3), false);
    if (kC) renderTex(kC, '\\Delta E = ' + M.fmtTex(d.dE_coul, 3) + ',\\; \\zeta_{\\mathrm{eq}} = ' + M.fmtTex(d.zEq_coul, 3), false);

    // Update visualizations
    if (app.viz.loops) app.viz.loops.setParams(p);
    if (app.viz.scale) app.viz.scale.setParams(p);
    if (app.viz.stick) {
      app.viz.stick.setParams(p);
      const sim = app.viz.stick.getSim();
      const kDrop = document.getElementById('sec3-drop');
      const kStop = document.getElementById('sec3-stop');
      const kOff = document.getElementById('sec3-offset');
      if (kDrop) renderTex(kDrop, '\\Delta u_{\\mathrm{cycle}} = 4\\delta = ' + M.fmtTex(4 * p.delta, 2), false);
      if (kStop) renderTex(kStop, '\\tau_{\\mathrm{stop}} = ' + sim.nHalfCycles + '\\pi = ' + M.fmtTex(sim.tStop, 2), false);
      if (kOff) renderTex(kOff, 'u_{\\mathrm{stop}} = ' + M.fmtTex(sim.uStop, 3) + ' \\in [-' + M.fmtTex(p.delta, 2) + ', +' + M.fmtTex(p.delta, 2) + ']', false);
    }
    if (app.viz.frf) app.viz.frf.setParams(p);

    updateCodeSnippet();
  }

  function updateCodeSnippet() {
    const el = document.getElementById('live-code-block');
    if (!el) return;
    const p = app.params;
    if (app.codeLang === 'matlab') {
      el.textContent =
        '% Verify damping hysteresis energies, zeta_eq & Coulomb stick-slip (MATLAB)\n' +
        'zeta = ' + M.fmt(p.zeta, 3) + '; eta = ' + M.fmt(p.eta, 3) + '; Fc = ' + M.fmt(p.Fc, 3) + ';\n' +
        'r = ' + M.fmt(p.r, 2) + '; X = ' + M.fmt(p.X, 2) + ';\n\n' +
        'dE_visc   = 2*pi*zeta*r*X^2;\n' +
        'dE_struct = pi*eta*X^2;\n' +
        'dE_coul   = 4*Fc*X;\n' +
        'fprintf("Delta E: visc=%.3f, struct=%.3f, coul=%.3f\\n", dE_visc, dE_struct, dE_coul);\n\n' +
        '% Exact Coulomb free-decay turning points (u0 = ' + M.fmt(p.u0, 2) + ', delta = ' + M.fmt(p.delta, 2) + ')\n' +
        'u0 = ' + M.fmt(p.u0, 2) + '; delta = ' + M.fmt(p.delta, 2) + ';\n' +
        'n_half = floor((u0 - delta) / (2 * delta)) + 1;\n' +
        'u_stop = (-1)^n_half * (u0 - 2*n_half*delta);\n' +
        'fprintf("Halts after %d half-cycles (tau=%.2f) at u_stop=%.3f\\n", n_half, n_half*pi, u_stop);';
    } else {
      el.textContent =
        '# Verify damping hysteresis energies, zeta_eq & Coulomb stick-slip (Python)\n' +
        'import numpy as np\n\n' +
        'zeta, eta, Fc = ' + M.fmt(p.zeta, 3) + ', ' + M.fmt(p.eta, 3) + ', ' + M.fmt(p.Fc, 3) + '\n' +
        'r, X = ' + M.fmt(p.r, 2) + ', ' + M.fmt(p.X, 2) + '\n\n' +
        'dE_visc   = 2 * np.pi * zeta * r * X**2\n' +
        'dE_struct = np.pi * eta * X**2\n' +
        'dE_coul   = 4 * Fc * X\n' +
        'print(f"Delta E: visc={dE_visc:.3f}, struct={dE_struct:.3f}, coul={dE_coul:.3f}")\n\n' +
        'u0, delta = ' + M.fmt(p.u0, 2) + ', ' + M.fmt(p.delta, 2) + '\n' +
        'n_half = int(np.floor((u0 - delta) / (2 * delta))) + 1\n' +
        'u_stop = ((-1) ** n_half) * (u0 - 2 * n_half * delta)\n' +
        'print(f"Halts after {n_half} half-cycles (tau={n_half*np.pi:.2f}) at u_stop={u_stop:.3f}")';
    }
  }

  function updateCitation() {
    const el = document.getElementById('cite-text-block');
    if (!el) return;
    const url = 'https://dchelidze.github.io/vibrations-tutorials/sdof-damping-hysteresis/';
    if (app.citeFormat === 'apa') {
      el.textContent =
        'Chelidze, D. (2026). Damping mechanisms in the force–displacement plane: Hysteresis loops and Coulomb stick-slip [Interactive tutorial]. Nonlinear Dynamics Laboratory, University of Rhode Island. ' +
        url;
    } else if (app.citeFormat === 'ieee') {
      el.textContent =
        'D. Chelidze, "Damping mechanisms in the force–displacement plane: Hysteresis loops and Coulomb stick-slip," Nonlinear Dynamics Laboratory, Univ. of Rhode Island, Kingston, RI, USA, 2026. [Online]. Available: ' +
        url;
    } else {
      el.textContent =
        '@misc{chelidze2026damping,\n' +
        '  author       = {Chelidze, David},\n' +
        '  title        = {Damping mechanisms in the force--displacement plane: Hysteresis loops and Coulomb stick-slip},\n' +
        '  howpublished = {Interactive Vibrations Tutorial, Nonlinear Dynamics Laboratory, University of Rhode Island},\n' +
        '  year         = {2026},\n' +
        '  url          = {' + url + '}\n' +
        '}';
    }
  }

  function init() {
    app.viz.loops = window.VibLab.VizLoops.create({
      pureCanvasId: 'damp-pure-canvas',
      totalCanvasId: 'damp-total-canvas',
      params: app.params
    });

    app.viz.scale = window.VibLab.VizScaling.create({
      freqCanvasId: 'damp-freq-canvas',
      ampCanvasId: 'damp-amp-canvas',
      params: app.params
    });

    app.viz.stick = window.VibLab.VizStickSlip.create({
      phaseCanvasId: 'damp-phase-canvas',
      decayCanvasId: 'damp-decay-canvas',
      params: app.params
    });

    app.viz.frf = window.VibLab.VizFRF.create({
      canvasId: 'damp-frf-canvas',
      params: app.params
    });

    document.querySelectorAll('#preset-selector .pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pr = M.PRESETS[btn.dataset.preset];
        if (!pr) return;
        app.presetKey = pr.key;
        app.params = Object.assign({}, pr);
        recompute(false);
      });
    });

    function bind(id, prop) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        app.presetKey = null;
        app.params[prop] = parseFloat(el.value);
        recompute(false);
      });
    }
    bind('slider-r', 'r');
    bind('slider-x', 'X');
    bind('slider-u0', 'u0');
    bind('slider-delta', 'delta');
    bind('slider-fc', 'Fc');

    document.querySelectorAll('#code-lang-tabs button[data-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#code-lang-tabs button[data-lang]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        app.codeLang = btn.dataset.lang;
        updateCodeSnippet();
      });
    });
    const btnCopyCode = document.getElementById('btn-copy-code');
    if (btnCopyCode) {
      btnCopyCode.addEventListener('click', () => {
        const text = document.getElementById('live-code-block').textContent;
        if (navigator.clipboard) navigator.clipboard.writeText(text);
        btnCopyCode.textContent = 'Copied';
        setTimeout(() => { btnCopyCode.textContent = 'Copy'; }, 1400);
      });
    }

    document.querySelectorAll('#cite-format-tabs button[data-cite]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#cite-format-tabs button[data-cite]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        app.citeFormat = btn.dataset.cite;
        updateCitation();
      });
    });
    const btnCopyCite = document.getElementById('btn-copy-cite');
    if (btnCopyCite) {
      btnCopyCite.addEventListener('click', () => {
        const text = document.getElementById('cite-text-block').textContent;
        if (navigator.clipboard) navigator.clipboard.writeText(text);
        btnCopyCite.textContent = 'Copied';
        setTimeout(() => { btnCopyCite.textContent = 'Copy citation'; }, 1400);
      });
    }

    const btnTheme = document.getElementById('btn-theme');
    const lblTheme = document.getElementById('btn-theme-label');
    if (btnTheme) {
      btnTheme.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
        if (lblTheme) lblTheme.textContent = isDark ? 'Dark' : 'Light';
        renderAll();
      });
    }

    const navLinks = Array.from(document.querySelectorAll('.chapter-nav a'));
    const sections = navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    function updateScrollSpy() {
      const y = window.scrollY + 110;
      let activeIdx = 0;
      for (let i = 0; i < sections.length; i++) if (sections[i].offsetTop <= y) activeIdx = i;
      navLinks.forEach((a, idx) => a.classList.toggle('active', idx === activeIdx));
    }
    window.addEventListener('scroll', updateScrollSpy, { passive: true });

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderAll, 60);
    });

    typesetElement(document.body);
    recompute(false);
    updateCitation();
    updateScrollSpy();
  }

  function renderAll() {
    if (app.viz.loops) app.viz.loops.render();
    if (app.viz.scale) app.viz.scale.render();
    if (app.viz.stick) app.viz.stick.render();
    if (app.viz.frf) app.viz.frf.render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
