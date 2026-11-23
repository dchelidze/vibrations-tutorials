/**
 * app.js
 * Central reactive controller for Module 11:
 * Continuous Beams as Infinite-DOF Modal Geometry.
 */
(function () {
  'use strict';

  const M = window.VibLab.MathBeam;

  const KATEX_DELIMITERS = [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
    { left: '\\(', right: '\\)', display: false },
    { left: '\\[', right: '\\]', display: true }
  ];

  const app = {
    bc: 'CF',
    activeMode: 0,
    orthoI: 0,
    orthoJ: 1,
    superKind: 'pluck',
    xi0: 0.5,
    nTerms: 5,
    codeLang: 'matlab',
    citeFormat: 'apa',
    sys: null,
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

  function recompute() {
    app.sys = M.getBeamSystem(app.bc);

    document.querySelectorAll('#bc-selector .pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.bc === app.bc);
    });
    document.querySelectorAll('#mode-pills .pill').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.mode) === app.activeMode);
    });
    document.querySelectorAll('#bc-ref-table tbody tr').forEach((tr) => {
      tr.classList.toggle('selected-row', tr.dataset.bc === app.bc);
    });

    updateHero();
    updateSection1Readouts();
    updateSection2Readouts();
    updateCodeSnippet();

    if (app.viz.roots) {
      app.viz.roots.setSystem(app.sys);
      app.viz.roots.setActiveMode(app.activeMode);
    }
    if (app.viz.ortho) {
      app.viz.ortho.setSystem(app.sys);
      app.viz.ortho.setPair(app.orthoI, app.orthoJ);
    }
    if (app.viz.superpos) {
      app.viz.superpos.setSystem(app.sys);
    }
    if (app.viz.bridge) {
      app.viz.bridge.setBC(app.bc);
    }
  }

  function updateHero() {
    const el = document.getElementById('bc-desc-text');
    if (el) {
      el.textContent = app.sys.info.description;
      typesetElement(el);
    }
  }

  function updateSection1Readouts() {
    const s = app.sys;
    const m = s.modes[app.activeMode];

    const eqEl = document.getElementById('sec1-chareq');
    if (eqEl) {
      renderTex(eqEl, s.info.charEqTex + ', \\qquad ' + s.info.bcTex, true);
    }

    const kLam = document.getElementById('sec1-lam');
    const kFreq = document.getElementById('sec1-freq');
    const kNodes = document.getElementById('sec1-nodes');

    if (kLam) renderTex(kLam, '\\beta_' + m.n + ' L = ' + M.fmtTex(m.lam, 4), false);
    if (kFreq) renderTex(kFreq, '\\omega_' + m.n + '/\\omega_1 = ' + M.fmtTex(m.omegaRel, 2) + ',\\; (\\beta_' + m.n + 'L)^2 = ' + M.fmtTex(m.lamSq, 2), false);
    if (kNodes) {
      if (m.nodes.length === 0) {
        kNodes.textContent = '0 interior nodes';
      } else {
        kNodes.textContent =
          m.nodes.length + ' (' + m.nodes.map((x) => M.fmt(x, 2) + 'L').join(', ') + ')';
      }
    }
  }

  function updateSection2Readouts() {
    const val = M.innerProduct(app.sys, app.orthoI, app.orthoJ);
    const same = app.orthoI === app.orthoJ;

    document.querySelectorAll('#ortho-i-pills .pill').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.idx) === app.orthoI);
    });
    document.querySelectorAll('#ortho-j-pills .pill').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.idx) === app.orthoJ);
    });

    const kInner = document.getElementById('sec2-inner');
    const kStiff = document.getElementById('sec2-stiff');
    if (kInner) {
      renderTex(
        kInner,
        '\\int_0^1 \\phi_' + (app.orthoI + 1) + '(\\xi)\\phi_' + (app.orthoJ + 1) + '(\\xi)\\,\\mathrm{d}\\xi = ' + M.fmtTex(val, 4),
        false
      );
    }
    if (kStiff) {
      const m = app.sys.modes[app.orthoI];
      renderTex(
        kStiff,
        same
          ? '\\int_0^1 \\phi_' + m.n + '\'\'(\\xi)^2\\,\\mathrm{d}\\xi = (\\beta_' + m.n + 'L)^4 = ' + M.fmtTex(Math.pow(m.lam, 4), 1)
          : '\\int_0^1 \\phi_' + (app.orthoI + 1) + '\'\'(\\xi)\\phi_' + (app.orthoJ + 1) + '\'\'(\\xi)\\,\\mathrm{d}\\xi = 0',
        false
      );
    }
  }

  function updateSection3Readouts(proj, st) {
    const vXi = document.getElementById('val-super-xi0');
    const vN = document.getElementById('val-super-n');
    if (vXi) vXi.innerHTML = '&xi;<sub>0</sub> = ' + M.fmt(st.xi0, 2) + ' <i>L</i>';
    if (vN) vN.textContent = 'N = ' + st.nTerms + ' mode' + (st.nTerms > 1 ? 's' : '');

    // Check if pluck sits close to a node of any mode 2..5
    const noteEl = document.getElementById('sec3-nodal-note');
    if (noteEl && proj) {
      let silentModes = [];
      for (let k = 0; k < M.N_MODES; k++) {
        if (Math.abs(proj.q0[k]) < 0.035) silentModes.push(k + 1);
      }
      if (silentModes.length > 0) {
        noteEl.className = 'callout callout-teal';
        noteEl.innerHTML =
          '<strong>Nodal suppression active:</strong> At the current excitation profile, Mode' +
          (silentModes.length > 1 ? 's ' : ' ') +
          silentModes.join(', ') +
          ' receive essentially zero projection ($|q_n(0)| &lt; 0.035$) because the excitation sits on a nodal symmetry point.';
      } else {
        noteEl.className = 'callout callout-blue';
        noteEl.innerHTML =
          '<strong>Multi-mode participation:</strong> Because $\\omega_n \\propto (\\beta_n L)^2$ grows quadratically, higher modes vibrate much faster than Mode 1 and carry disproportionately high bending energy $E_n \\propto (\\beta_n L)^4 q_n^2$. Try sliding $\\xi_0$ onto a nodal point (such as $0.50\\,L$ on a symmetric beam) to watch even modes vanish.';
      }
      typesetElement(noteEl);
    }
  }

  function updateCodeSnippet() {
    const el = document.getElementById('live-code-block');
    if (!el) return;
    const s = app.sys;
    const rootsStr = s.modes.map((m) => M.fmt(m.lam, 6)).join(', ');

    if (app.codeLang === 'matlab') {
      el.textContent =
        '% Verify Euler-Bernoulli beam roots & frequency ratios (' + s.info.name + ') — MATLAB\n' +
        'betaL = [' + rootsStr + '];\n' +
        'omega_ratio = (betaL ./ betaL(1)).^2;\n' +
        'disp(table((1:5).\', betaL.\', omega_ratio.\', ...\n' +
        '  "VariableNames", {"Mode", "betaL", "omega_n_over_omega_1"}));\n\n' +
        '% Physical natural frequencies for given EI, rhoA, L:\n' +
        'E = 210e9; I = 8.33e-8; rho = 7850; A = 1e-4; L = 1.0;\n' +
        'omega_n = (betaL.^2) * sqrt(E * I / (rho * A * L^4));\n' +
        'fprintf("f1 = %.2f Hz, f2 = %.2f Hz, f3 = %.2f Hz\\n", omega_n(1:3)/(2*pi));';
    } else {
      el.textContent =
        '# Verify Euler-Bernoulli beam roots & frequency ratios (' + s.info.name + ') — Python\n' +
        'import numpy as np\n\n' +
        'betaL = np.array([' + rootsStr + '])\n' +
        'omega_ratio = (betaL / betaL[0]) ** 2\n' +
        'for n, (b, r) in enumerate(zip(betaL, omega_ratio), start=1):\n' +
        '    print(f"Mode {n}: beta*L = {b:.5f}, omega_{n}/omega_1 = {r:.3f}")\n\n' +
        '# Example steel beam (10 mm x 10 mm, L = 1 m)\n' +
        'E, I, rho, A, L = 210e9, 8.33e-8, 7850.0, 1e-4, 1.0\n' +
        'f_hz = (betaL**2) * np.sqrt(E * I / (rho * A * L**4)) / (2 * np.pi)\n' +
        'print("Natural frequencies (Hz):", np.round(f_hz, 2))';
    }
  }

  function updateCitation() {
    const el = document.getElementById('cite-text-block');
    if (!el) return;
    const url = 'https://dchelidze.github.io/vibrations-tutorials/beam-modal-geometry/';
    if (app.citeFormat === 'apa') {
      el.textContent =
        'Chelidze, D. (2026). Continuous beams as infinite-DOF modal geometry [Interactive tutorial]. Nonlinear Dynamics Laboratory, University of Rhode Island. ' +
        url;
    } else if (app.citeFormat === 'ieee') {
      el.textContent =
        'D. Chelidze, "Continuous beams as infinite-DOF modal geometry," Nonlinear Dynamics Laboratory, Univ. of Rhode Island, Kingston, RI, USA, 2026. [Online]. Available: ' +
        url;
    } else {
      el.textContent =
        '@misc{chelidze2026beams,\n' +
        '  author       = {Chelidze, David},\n' +
        '  title        = {Continuous beams as infinite-DOF modal geometry},\n' +
        '  howpublished = {Interactive Vibrations Tutorial, Nonlinear Dynamics Laboratory, University of Rhode Island},\n' +
        '  year         = {2026},\n' +
        '  url          = {' + url + '}\n' +
        '}';
    }
  }

  function init() {
    app.sys = M.getBeamSystem(app.bc);

    app.viz.roots = window.VibLab.VizRoots.create({
      rootsCanvasId: 'beam-roots-canvas',
      modeCanvasId: 'beam-mode-canvas',
      sys: app.sys,
      onModeSelect: (idx) => {
        app.activeMode = idx;
        document.querySelectorAll('#mode-pills .pill').forEach((b) => {
          b.classList.toggle('active', Number(b.dataset.mode) === idx);
        });
        updateSection1Readouts();
      }
    });

    app.viz.ortho = window.VibLab.VizOrtho.create({
      pairCanvasId: 'beam-pair-canvas',
      prodCanvasId: 'beam-prod-canvas',
      sys: app.sys
    });

    app.viz.superpos = window.VibLab.VizSuperpos.create({
      superCanvasId: 'beam-super-canvas',
      specCanvasId: 'beam-spec-canvas',
      sys: app.sys,
      onProjectionChange: updateSection3Readouts
    });

    app.viz.bridge = window.VibLab.VizBridge.create({
      canvasId: 'beam-bridge-canvas',
      bc: app.bc
    });

    // BC Selector
    document.querySelectorAll('#bc-selector .pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        app.bc = btn.dataset.bc;
        recompute();
      });
    });

    // Section 1 mode pills & play/pause
    document.querySelectorAll('#mode-pills .pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        app.activeMode = Number(btn.dataset.mode);
        recompute();
      });
    });
    const btnModePlay = document.getElementById('btn-mode-play');
    if (btnModePlay) {
      btnModePlay.addEventListener('click', () => {
        const next = !app.viz.roots.isPlaying();
        app.viz.roots.setPlaying(next);
        btnModePlay.textContent = next ? 'Pause' : 'Play';
      });
    }

    // Section 2 orthogonality pair selectors
    document.querySelectorAll('#ortho-i-pills .pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        app.orthoI = Number(btn.dataset.idx);
        app.viz.ortho.setPair(app.orthoI, app.orthoJ);
        updateSection2Readouts();
      });
    });
    document.querySelectorAll('#ortho-j-pills .pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        app.orthoJ = Number(btn.dataset.idx);
        app.viz.ortho.setPair(app.orthoI, app.orthoJ);
        updateSection2Readouts();
      });
    });

    // Section 3 superposition controls
    document.querySelectorAll('#super-shape-pills .pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#super-shape-pills .pill').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        app.superKind = btn.dataset.kind;
        app.viz.superpos.setParams({ kind: app.superKind });
      });
    });
    const slXi0 = document.getElementById('slider-super-xi0');
    const slN = document.getElementById('slider-super-n');
    if (slXi0) slXi0.addEventListener('input', () => { app.xi0 = parseFloat(slXi0.value); app.viz.superpos.setParams({ xi0: app.xi0 }); });
    if (slN) slN.addEventListener('input', () => { app.nTerms = parseInt(slN.value, 10); app.viz.superpos.setParams({ nTerms: app.nTerms }); });
    const btnSuperPlay = document.getElementById('btn-super-play');
    if (btnSuperPlay) {
      btnSuperPlay.addEventListener('click', () => {
        const next = !app.viz.superpos.isPlaying();
        app.viz.superpos.setPlaying(next);
        btnSuperPlay.textContent = next ? 'Pause' : 'Play';
      });
    }
    const btnSuperReset = document.getElementById('btn-super-reset');
    if (btnSuperReset) btnSuperReset.addEventListener('click', () => app.viz.superpos.resetTime());

    // Code & citation tabs
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

    // Theme toggle
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

    // Scroll spy
    const navLinks = Array.from(document.querySelectorAll('.chapter-nav a'));
    const sections = navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    function updateScrollSpy() {
      const y = window.scrollY + 110;
      let activeIdx = 0;
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].offsetTop <= y) activeIdx = i;
      }
      navLinks.forEach((a, idx) => a.classList.toggle('active', idx === activeIdx));
    }
    window.addEventListener('scroll', updateScrollSpy, { passive: true });

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderAll, 60);
    });

    typesetElement(document.body);
    recompute();
    updateCitation();
    updateScrollSpy();

    let lastTs = performance.now();
    function tick(now) {
      const dt = Math.min(0.04, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      if (app.viz.roots) app.viz.roots.step(dt);
      if (app.viz.superpos) app.viz.superpos.step(dt);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderAll() {
    if (app.viz.roots) app.viz.roots.render();
    if (app.viz.ortho) app.viz.ortho.render();
    if (app.viz.superpos) app.viz.superpos.render();
    if (app.viz.bridge) app.viz.bridge.render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
