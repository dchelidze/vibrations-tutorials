/**
 * app.js
 * Central reactive controller for Module 05:
 * Tuned Vibration Absorbers, Den Hartog Fixed Points, and Passive Isolation.
 */
(function () {
  'use strict';

  const M = window.VibLab.MathTVA;

  const KATEX_DELIMITERS = [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
    { left: '\\(', right: '\\)', display: false },
    { left: '\\[', right: '\\]', display: true }
  ];

  const app = {
    presetKey: 'den_hartog_opt',
    params: Object.assign({}, M.PRESETS.den_hartog_opt),
    sys: null,
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
    app.sys = M.analyzeTVA(app.params);

    syncControls();
    updateHeroReadout();
    updateSection1Readouts();
    updateSection2Readouts();
    updateSection3Readouts();
    updateSection4Readouts();
    updateCodeSnippet();

    if (app.viz.rig) app.viz.rig.setSystem(app.sys);
    if (app.viz.dh) app.viz.dh.setSystem(app.sys);
    if (app.viz.split) app.viz.split.setSystem(app.sys);

    if (!keepPreset) {
      document.querySelectorAll('#preset-selector .pill').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.preset === app.presetKey);
      });
    }
  }

  function syncControls() {
    const s = app.sys;
    const pairs = [
      ['slider-mu', 'val-mu', s.mu, '', 2, false],
      ['slider-beta', 'val-beta', s.beta, '', 3, false],
      ['slider-zeta', 'val-zeta', s.zetaA, '', 3, false],
      ['slider-rdrive', 'val-rdrive', s.rDrive, '', 2, false],
      ['slider-sec1-r', 'val-sec1-r', s.rDrive, 'r = ', 2, false],
      ['slider-sec2-beta', 'val-sec2-beta', s.beta, 'β = ', 3, false],
      ['slider-sec2-zeta', 'val-sec2-zeta', s.zetaA, '&zeta;<sub>a</sub> = ', 3, true],
      ['slider-sec3-mu', 'val-sec3-mu', s.mu, 'μ = ', 2, false]
    ];
    for (const [sid, vid, val, prefix, dec, isHtml] of pairs) {
      const sl = document.getElementById(sid);
      const vl = document.getElementById(vid);
      if (sl) sl.value = val;
      if (vl) {
        if (isHtml) vl.innerHTML = prefix + M.fmt(val, dec);
        else vl.textContent = prefix + M.fmt(val, dec);
      }
    }
  }

  function updateHeroReadout() {
    const el = document.getElementById('preset-desc-text');
    if (!el) return;
    const p = M.PRESETS[app.presetKey];
    if (p) {
      el.textContent = p.description;
    } else {
      const s = app.sys;
      el.textContent =
        'Custom TVA: $\\mu = ' +
        M.fmt(s.mu, 2) +
        '$, $\\beta = ' +
        M.fmt(s.beta, 3) +
        '$ ($\\beta_{\\mathrm{opt}} = ' +
        M.fmt(s.opt.betaOpt, 3) +
        '$), $\\zeta_a = ' +
        M.fmt(s.zetaA, 3) +
        '$ ($\\zeta_{a,\\mathrm{opt}} = ' +
        M.fmt(s.opt.zetaAOpt, 3) +
        '$).';
    }
    typesetElement(el);
  }

  function updateSection1Readouts() {
    const s = app.sys;
    const res = M.evalTVA(s.mu, s.beta, s.zetaA, s.rDrive);

    const k1 = document.getElementById('sec1-m1');
    const k2 = document.getElementById('sec1-fa');
    const k3 = document.getElementById('sec1-split');

    if (k1) renderTex(k1, '|X_1|/X_{\\mathrm{st}} = ' + M.fmtTex(res.M1, 3), false);
    if (k2) {
      const ang = (M.cArg(res.Fa) * 180) / Math.PI;
      renderTex(k2, '|F_{a\\to 1}|/F_0 = ' + M.fmtTex(M.cAbs(res.Fa), 2) + ',\\; \\angle = ' + M.fmtTex(ang, 0) + '^\\circ', false);
    }
    if (k3) {
      renderTex(k3, 'r_1 = ' + M.fmtTex(s.split.r1, 3) + ',\\; r_2 = ' + M.fmtTex(s.split.r2, 3), false);
    }
  }

  function updateSection2Readouts() {
    const s = app.sys;
    const kP = document.getElementById('sec2-fp-p');
    const kQ = document.getElementById('sec2-fp-q');
    const kOpt = document.getElementById('sec2-opt');
    const kPeak = document.getElementById('sec2-peak');

    if (kP) renderTex(kP, 'r_P = ' + M.fmtTex(s.fp.rP, 3) + ',\\; M_P = ' + M.fmtTex(s.fp.MP, 2), false);
    if (kQ) renderTex(kQ, 'r_Q = ' + M.fmtTex(s.fp.rQ, 3) + ',\\; M_Q = ' + M.fmtTex(s.fp.MQ, 2), false);
    if (kOpt) {
      renderTex(
        kOpt,
        '\\beta_{\\mathrm{opt}} = ' + M.fmtTex(s.opt.betaOpt, 3) + ',\\; \\zeta_{a,\\mathrm{opt}} = ' + M.fmtTex(s.opt.zetaAOpt, 3),
        false
      );
    }
    if (kPeak) {
      renderTex(
        kPeak,
        'M_{\\max} = ' + M.fmtTex(s.peakInfo.peak, 2) + '\\;(\\text{floor } ' + M.fmtTex(s.opt.MOpt, 2) + ')',
        false
      );
    }

    const callout = document.getElementById('sec2-callout');
    if (callout) {
      const betaErr = Math.abs(s.beta - s.opt.betaOpt);
      const zetaErr = Math.abs(s.zetaA - s.opt.zetaAOpt);
      if (s.zetaA < 0.01) {
        callout.className = 'callout callout-crimson';
        callout.innerHTML =
          '<strong>Undamped Frahm limit ($\\zeta_a \\approx 0$):</strong> The notch at $r = \\beta$ hits zero, but the two split resonances at $r_1$ and $r_2$ shoot to infinity—making the absorber fragile to drive-frequency drift.';
      } else if (s.zetaA > 0.55) {
        callout.className = 'callout callout-amber';
        callout.innerHTML =
          '<strong>Overdamped lock-up ($\\zeta_a \\gg \\zeta_{a,\\mathrm{opt}}$):</strong> Heavy damping locks $m_a$ onto $m_1$, merging the two peaks into a single tall locked-mass resonance near $r_{\\mathrm{lock}} = 1/\\sqrt{1+\\mu} = ' +
          M.fmt(s.rLock, 3) +
          '$ between $P$ and $Q$.';
      } else if (betaErr < 0.015 && zetaErr < 0.025) {
        callout.className = 'callout callout-teal';
        callout.innerHTML =
          '<strong>Den Hartog minimax optimum achieved:</strong> Fixed points $P$ and $Q$ sit at equal height $M_{\\mathrm{opt}} = \\sqrt{1 + 2/\\mu} = ' +
          M.fmt(s.opt.MOpt, 2) +
          '$, and $\\zeta_a \\approx \\zeta_{a,\\mathrm{opt}}$ threads nearly horizontal tangents through both pivots.';
      } else {
        callout.className = 'callout callout-blue';
        callout.innerHTML =
          '<strong>Two-stage optimization geometry:</strong> First adjust $\\beta$ toward $\\beta_{\\mathrm{opt}} = 1/(1+\\mu) = ' +
          M.fmt(s.opt.betaOpt, 3) +
          '$ to level $M(P) = M(Q)$; then tune $\\zeta_a$ toward $\\zeta_{a,\\mathrm{opt}} = ' +
          M.fmt(s.opt.zetaAOpt, 3) +
          '$ to flatten the peaks at $P$ and $Q$.';
      }
      typesetElement(callout);
    }
  }

  function updateSection3Readouts() {
    const s = app.sys;
    const sp1 = M.undampedSplitFreqs(s.mu, 1.0);
    const notchStroke = 1 / (s.mu * s.beta * s.beta);
    const bw = ((sp1.r2 - sp1.r1) * 100);

    const kBw = document.getElementById('sec3-bw');
    const kBound = document.getElementById('sec3-bound');
    const kStroke = document.getElementById('sec3-stroke');

    if (kBw) {
      renderTex(
        kBw,
        M.fmtTex(bw, 1) + '\\%\\text{ of }\\omega_1\\;(r_1=' + M.fmtTex(sp1.r1, 2) + ',\\,r_2=' + M.fmtTex(sp1.r2, 2) + ')',
        false
      );
    }
    if (kBound) renderTex(kBound, 'M_{\\mathrm{opt}} = \\sqrt{1 + 2/\\mu} = ' + M.fmtTex(s.opt.MOpt, 2), false);
    if (kStroke) renderTex(kStroke, '|X_a(r=\\beta)| / X_{\\mathrm{st}} = \\frac{1}{\\mu\\beta^2} = ' + M.fmtTex(notchStroke, 2), false);
  }

  function updateSection4Readouts() {
    if (!app.viz.iso) return;
    const st = app.viz.iso.getState();
    const res = M.evalTransmissibility(st.r, st.zeta);

    const slR = document.getElementById('slider-iso-r');
    const vlR = document.getElementById('val-iso-r');
    const slZ = document.getElementById('slider-iso-zeta');
    const vlZ = document.getElementById('val-iso-zeta');
    if (slR) slR.value = st.r;
    if (vlR) vlR.textContent = 'r = ' + M.fmt(st.r, 2);
    if (slZ) slZ.value = st.zeta;
    if (vlZ) vlZ.textContent = 'ζ = ' + M.fmt(st.zeta, 2);

    const kT = document.getElementById('sec4-t');
    const kIso = document.getElementById('sec4-iso');
    const kSlope = document.getElementById('sec4-slope');

    if (kT) renderTex(kT, 'T = ' + M.fmtTex(res.T, 3) + '\\;(' + M.fmtTex(20 * Math.log10(Math.max(1e-4, res.T)), 1) + '\\;\\text{dB})', false);
    if (kIso) {
      kIso.textContent =
        res.T < 1
          ? M.fmt(res.isolationPct, 1) + '% force reduction'
          : M.fmt((res.T - 1) * 100, 1) + '% amplification';
    }
    if (kSlope) {
      const Tundamp = Math.abs(1 - st.r * st.r) < 1e-6 ? Infinity : Math.abs(1 / (1 - st.r * st.r));
      renderTex(kSlope, 'T_{\\zeta=0} = ' + M.fmtTex(Tundamp, 3) + '\\;\\text{vs.}\\; T_{\\zeta} = ' + M.fmtTex(res.T, 3), false);
    }
  }

  function updateCodeSnippet() {
    const el = document.getElementById('live-code-block');
    if (!el) return;
    const s = app.sys;
    const iso = app.viz.iso ? app.viz.iso.getState() : { r: 2.2, zeta: 0.15 };

    if (app.codeLang === 'matlab') {
      el.textContent =
        '% Verify current Den Hartog TVA & passive isolator (MATLAB)\n' +
        'mu = ' + M.fmt(s.mu, 3) + '; beta = ' + M.fmt(s.beta, 4) + '; zetaA = ' + M.fmt(s.zetaA, 4) + ';\n' +
        'beta_opt = 1 / (1 + mu);\n' +
        'M_opt    = sqrt(1 + 2 / mu);\n' +
        'zeta_opt = sqrt(3 * mu / (8 * (1 + mu)));\n\n' +
        '% Fixed-point frequencies r_P, r_Q (invariant to zetaA)\n' +
        'uPQ = roots([1, -2*(1 + beta^2*(1 + mu))/(2 + mu), 2*beta^2/(2 + mu)]);\n' +
        'rPQ = sort(sqrt(uPQ));\n' +
        'MPQ = abs(1 ./ (1 - rPQ.^2 * (1 + mu)));\n' +
        'fprintf("P=(%.3f, %.2f), Q=(%.3f, %.2f), M_opt=%.2f\\n", rPQ(1), MPQ(1), rPQ(2), MPQ(2), M_opt);\n\n' +
        '% Primary-mass FRF |X1| / Xst\n' +
        'r = linspace(0, 1.8, 500);\n' +
        'num = (beta^2 - r.^2) + 1i*(2*beta*zetaA*r);\n' +
        'den = ((1 - r.^2).*(beta^2 - r.^2) - mu*beta^2*r.^2) + 1i*(2*beta*zetaA*r).*(1 - r.^2*(1 + mu));\n' +
        'M1 = abs(num ./ den);\n' +
        'plot(r, M1, rPQ, MPQ, "ro"); grid on; xlabel("r = \\omega/\\omega_1"); ylabel("|X_1|/X_{st}");\n\n' +
        '% Passive isolator transmissibility at r = ' + M.fmt(iso.r, 2) + ', zeta = ' + M.fmt(iso.zeta, 2) + '\n' +
        'r_iso = ' + M.fmt(iso.r, 2) + '; z_iso = ' + M.fmt(iso.zeta, 2) + ';\n' +
        'T_iso = sqrt((1 + (2*z_iso*r_iso)^2) / ((1 - r_iso^2)^2 + (2*z_iso*r_iso)^2));';
    } else {
      el.textContent =
        '# Verify current Den Hartog TVA & passive isolator (Python)\n' +
        'import numpy as np\n\n' +
        'mu, beta, zetaA = ' + M.fmt(s.mu, 3) + ', ' + M.fmt(s.beta, 4) + ', ' + M.fmt(s.zetaA, 4) + '\n' +
        'beta_opt = 1.0 / (1.0 + mu)\n' +
        'M_opt = np.sqrt(1.0 + 2.0 / mu)\n' +
        'zeta_opt = np.sqrt(3.0 * mu / (8.0 * (1.0 + mu)))\n\n' +
        '# Fixed points P and Q (exact roots of quadratic in r^2)\n' +
        'uPQ = np.roots([1.0, -2.0*(1.0 + beta**2*(1.0 + mu))/(2.0 + mu), 2.0*beta**2/(2.0 + mu)])\n' +
        'rPQ = np.sort(np.sqrt(uPQ))\n' +
        'MPQ = np.abs(1.0 / (1.0 - rPQ**2 * (1.0 + mu)))\n' +
        'print(f"P=({rPQ[0]:.3f}, {MPQ[0]:.2f}), Q=({rPQ[1]:.3f}, {MPQ[1]:.2f}), M_opt={M_opt:.2f}")\n\n' +
        'r = np.linspace(0.0, 1.8, 500)\n' +
        'num = (beta**2 - r**2) + 1j * (2*beta*zetaA*r)\n' +
        'den = ((1 - r**2)*(beta**2 - r**2) - mu*beta**2*r**2) + 1j*(2*beta*zetaA*r)*(1 - r**2*(1 + mu))\n' +
        'M1 = np.abs(num / den)\n\n' +
        'r_iso, z_iso = ' + M.fmt(iso.r, 2) + ', ' + M.fmt(iso.zeta, 2) + '\n' +
        'T_iso = np.sqrt((1 + (2*z_iso*r_iso)**2) / ((1 - r_iso**2)**2 + (2*z_iso*r_iso)**2))';
    }
  }

  function updateCitation() {
    const el = document.getElementById('cite-text-block');
    if (!el) return;
    const url = 'https://dchelidze.github.io/vibrations-tutorials/tuned-vibration-absorber/';
    if (app.citeFormat === 'apa') {
      el.textContent =
        'Chelidze, D. (2026). Tuned vibration absorbers, Den Hartog fixed points, and vibration isolation [Interactive tutorial]. Nonlinear Dynamics Laboratory, University of Rhode Island. ' +
        url;
    } else if (app.citeFormat === 'ieee') {
      el.textContent =
        'D. Chelidze, "Tuned vibration absorbers, Den Hartog fixed points, and vibration isolation," Nonlinear Dynamics Laboratory, Univ. of Rhode Island, Kingston, RI, USA, 2026. [Online]. Available: ' +
        url;
    } else {
      el.textContent =
        '@misc{chelidze2026tva,\n' +
        '  author       = {Chelidze, David},\n' +
        '  title        = {Tuned vibration absorbers, Den Hartog fixed points, and vibration isolation},\n' +
        '  howpublished = {Interactive Vibrations Tutorial, Nonlinear Dynamics Laboratory, University of Rhode Island},\n' +
        '  year         = {2026},\n' +
        '  url          = {' + url + '}\n' +
        '}';
    }
  }

  function init() {
    app.sys = M.analyzeTVA(app.params);

    app.viz.rig = window.VibLab.VizTVARig.create({
      rigCanvasId: 'tva-rig-canvas',
      phasorCanvasId: 'tva-phasor-canvas',
      sys: app.sys
    });

    app.viz.dh = window.VibLab.VizDenHartog.create({
      canvasId: 'tva-fixedpt-canvas',
      sys: app.sys,
      onDriveChange: (r) => {
        app.params.rDrive = r;
        recompute(true);
      }
    });

    app.viz.split = window.VibLab.VizSplitting.create({
      splitCanvasId: 'tva-split-canvas',
      strokeCanvasId: 'tva-stroke-canvas',
      sys: app.sys
    });

    app.viz.iso = window.VibLab.VizIsolation.create({
      transCanvasId: 'tva-trans-canvas',
      phasorCanvasId: 'tva-iso-phasor-canvas',
      onChange: () => {
        updateSection4Readouts();
        updateCodeSnippet();
      }
    });

    // Presets
    function loadPreset(key) {
      const p = M.PRESETS[key];
      if (!p) return;
      app.presetKey = key;
      app.params = Object.assign({}, p);
      recompute(false);
    }

    document.querySelectorAll('#preset-selector .pill, #drawer-presets button').forEach((btn) => {
      btn.addEventListener('click', () => loadPreset(btn.dataset.preset));
    });

    // Drawer
    const drawer = document.getElementById('param-drawer');
    const btnParams = document.getElementById('btn-params');
    const btnClose = document.getElementById('btn-close-drawer');
    if (btnParams) btnParams.addEventListener('click', () => drawer && drawer.classList.toggle('open'));
    if (btnClose) btnClose.addEventListener('click', () => drawer && drawer.classList.remove('open'));

    // Bind sliders
    function bindSlider(id, prop, keepPreset) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        if (!keepPreset) app.presetKey = null;
        app.params[prop] = parseFloat(el.value);
        recompute(!!keepPreset);
      });
    }
    bindSlider('slider-mu', 'mu', false);
    bindSlider('slider-beta', 'beta', false);
    bindSlider('slider-zeta', 'zetaA', false);
    bindSlider('slider-rdrive', 'rDrive', true);
    bindSlider('slider-sec1-r', 'rDrive', true);
    bindSlider('slider-sec2-beta', 'beta', false);
    bindSlider('slider-sec2-zeta', 'zetaA', false);
    bindSlider('slider-sec3-mu', 'mu', false);

    // Section 1 buttons
    const btnPlay = document.getElementById('btn-rig-play');
    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        const next = !app.viz.rig.isPlaying();
        app.viz.rig.setPlaying(next);
        btnPlay.textContent = next ? 'Pause' : 'Play';
      });
    }
    const btnSnapNotch = document.getElementById('btn-snap-notch');
    if (btnSnapNotch) btnSnapNotch.addEventListener('click', () => { app.params.rDrive = app.sys.beta; recompute(true); });
    const btnSnapR1 = document.getElementById('btn-snap-r1');
    if (btnSnapR1) btnSnapR1.addEventListener('click', () => { app.params.rDrive = app.sys.split.r1; recompute(true); });
    const btnSnapR2 = document.getElementById('btn-snap-r2');
    if (btnSnapR2) btnSnapR2.addEventListener('click', () => { app.params.rDrive = app.sys.split.r2; recompute(true); });
    const btnZeroZeta = document.getElementById('btn-zero-zeta');
    if (btnZeroZeta) btnZeroZeta.addEventListener('click', () => { app.presetKey = null; app.params.zetaA = 0; app.params.rDrive = app.sys.beta; recompute(false); });

    // Section 2 controls
    const btnSnapOpt = document.getElementById('btn-snap-dh-opt');
    if (btnSnapOpt) {
      btnSnapOpt.addEventListener('click', () => {
        const opt = M.denHartogOptimum(app.params.mu);
        app.presetKey = null;
        app.params.beta = opt.betaOpt;
        app.params.zetaA = opt.zetaAOpt;
        recompute(false);
      });
    }
    const chkFam = document.getElementById('chk-dh-family');
    const chkLock = document.getElementById('chk-dh-locked');
    if (chkFam) chkFam.addEventListener('change', () => app.viz.dh.setOptions({ showFamily: chkFam.checked }));
    if (chkLock) chkLock.addEventListener('change', () => app.viz.dh.setOptions({ showLocked: chkLock.checked }));

    // Section 4 isolation controls
    const slIsoR = document.getElementById('slider-iso-r');
    const slIsoZ = document.getElementById('slider-iso-zeta');
    if (slIsoR) slIsoR.addEventListener('input', () => app.viz.iso.setParams({ r: parseFloat(slIsoR.value) }));
    if (slIsoZ) slIsoZ.addEventListener('input', () => app.viz.iso.setParams({ zeta: parseFloat(slIsoZ.value) }));
    const btnIsoCross = document.getElementById('btn-iso-cross');
    if (btnIsoCross) btnIsoCross.addEventListener('click', () => app.viz.iso.setParams({ r: Math.SQRT2 }));
    const btnIsoRes = document.getElementById('btn-iso-res');
    if (btnIsoRes) btnIsoRes.addEventListener('click', () => app.viz.iso.setParams({ r: 1.0 }));
    const btnIsoHigh = document.getElementById('btn-iso-high');
    if (btnIsoHigh) btnIsoHigh.addEventListener('click', () => app.viz.iso.setParams({ r: 2.5 }));

    // Code & Citation
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
    recompute(false);
    updateSection4Readouts();
    updateCitation();
    updateScrollSpy();
    renderAll();

    let lastTs = performance.now();
    function tick(now) {
      const dt = Math.min(0.04, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      if (app.viz.rig) app.viz.rig.step(dt);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderAll() {
    if (app.viz.rig) app.viz.rig.render();
    if (app.viz.dh) app.viz.dh.render();
    if (app.viz.split) app.viz.split.render();
    if (app.viz.iso) app.viz.iso.render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
