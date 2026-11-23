/**
 * app.js
 * Central reactive controller for Module 03:
 * Harmonic Forcing, Rotating Force-Polygon Geometry, Beating, and Phase Resonance.
 */
(function () {
  'use strict';

  const M = window.VibLab.MathHarmonic;

  const KATEX_DELIMITERS = [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
    { left: '\\(', right: '\\)', display: false },
    { left: '\\[', right: '\\]', display: true }
  ];

  const app = {
    presetKey: 'phase_res',
    r: 1.0,
    zeta: 0.15,
    rBeat: 0.90,
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

  function recompute(keepPreset) {
    app.sys = M.evalHarmonic(app.r, app.zeta);

    const pairs = [
      ['slider-r', 'val-r', app.r, 'r = ', 2],
      ['slider-zeta', 'val-zeta', app.zeta, 'ζ = ', 2],
      ['slider-rbeat', 'val-rbeat', app.rBeat, 'r = ', 2]
    ];
    for (const [sid, vid, val, pref, dec] of pairs) {
      const sl = document.getElementById(sid);
      const vl = document.getElementById(vid);
      if (sl) sl.value = val;
      if (vl) vl.textContent = pref + M.fmt(val, dec);
    }

    if (!keepPreset) {
      document.querySelectorAll('#preset-selector .pill').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.preset === app.presetKey);
      });
    }

    updateHero();
    updateSection1Readouts();
    updateSection2Readouts();
    updateSection3Readouts();
    updateSection4Readouts();
    updateCodeSnippet();

    if (app.viz.poly) app.viz.poly.setSystem(app.sys);
    if (app.viz.bode) app.viz.bode.setSystem(app.sys);
    if (app.viz.power) app.viz.power.setSystem(app.sys);
  }

  function updateHero() {
    const el = document.getElementById('preset-desc-text');
    if (!el) return;
    const p = M.PRESETS[app.presetKey];
    if (p) {
      el.textContent = p.description;
    } else {
      const s = app.sys;
      el.textContent =
        'Custom operating point: $r = ' +
        M.fmtTex(s.r, 2) +
        '$, $\\zeta = ' +
        M.fmtTex(s.zeta, 2) +
        '$, magnification $M = ' +
        M.fmtTex(s.M, 2) +
        '$, phase lag $\\phi = ' +
        M.fmtTex(s.phiDeg, 1) +
        '^\\circ$.';
    }
    typesetElement(el);
  }

  function updateSection1Readouts() {
    const s = app.sys;
    const kM = document.getElementById('sec1-mag');
    const kPhi = document.getElementById('sec1-phi');
    const kRatio = document.getElementById('sec1-ratio');

    if (kM) renderTex(kM, 'M = |X|/X_{\\mathrm{st}} = ' + M.fmtTex(s.M, 3), false);
    if (kPhi) renderTex(kPhi, '\\phi = ' + M.fmtTex(s.phiDeg, 1) + '^\\circ', false);
    if (kRatio) {
      renderTex(
        kRatio,
        '\\frac{m\\omega^2 X}{kX} = r^2 = ' + M.fmtTex(s.r * s.r, 2),
        false
      );
    }

    const callout = document.getElementById('sec1-callout');
    if (callout) {
      if (Math.abs(s.r - 1.0) < 0.03) {
        callout.className = 'callout callout-teal';
        callout.innerHTML =
          '<strong>Exact phase resonance ($r = 1$, $\\phi = 90^\\circ$):</strong> Spring force $kX$ and inertia $-m\\omega^2 X$ have equal length and opposite direction, cancelling identically. The external drive $F_0$ fights damping $c\\omega X$ alone.';
      } else if (s.r < 0.7) {
        callout.className = 'callout callout-blue';
        callout.innerHTML =
          '<strong>Stiffness-controlled regime ($r &lt; 1$):</strong> The spring vector $kX$ dominates inertia $m\\omega^2 X$, keeping displacement nearly in phase with the drive ($\\phi &lt; 90^\\circ$).';
      } else if (s.r > 1.35) {
        callout.className = 'callout callout-amber';
        callout.innerHTML =
          '<strong>Mass-controlled regime ($r &gt; 1$):</strong> Inertia $-m\\omega^2 X$ overwhelms stiffness $kX$, flipping displacement nearly out of phase with $F_0$ ($\\phi \\to 180^\\circ$) and shrinking $M \\sim 1/r^2$.';
      } else {
        callout.className = 'callout callout-blue';
        callout.innerHTML =
          '<strong>Damping-controlled resonance transition ($r \\approx 1$):</strong> Small changes in $r$ swing the phase lag rapidly through $90^\\circ$ as inertia overtakes stiffness.';
      }
      typesetElement(callout);
    }
  }

  function updateSection2Readouts() {
    const s = app.sys;
    const kPk = document.getElementById('sec2-peak');
    const kQ = document.getElementById('sec2-q');
    const kH = document.getElementById('sec2-h');

    if (kPk) {
      renderTex(
        kPk,
        s.hasPeak
          ? 'r_{\\mathrm{peak}} = ' + M.fmtTex(s.rPeak, 3) + ',\\; M_{\\max} = ' + M.fmtTex(s.MPeak, 2)
          : '\\text{No interior peak } (\\zeta \\ge 1/\\sqrt{2})',
        false
      );
    }
    if (kQ) {
      renderTex(kQ, 'Q = M(1) = \\frac{1}{2\\zeta} = ' + M.fmtTex(s.Q, 2), false);
    }
    if (kH) {
      renderTex(
        kH,
        'kH(\\mathrm{i}\\omega) = ' + M.fmtTex(s.H.re, 2) + (s.H.im >= 0 ? ' + ' : ' - ') + M.fmtTex(Math.abs(s.H.im), 2) + '\\mathrm{i}',
        false
      );
    }
  }

  function updateSection3Readouts() {
    const diff = Math.abs(1 - app.rBeat);
    const kFreq = document.getElementById('sec3-fbeat');
    const kAmp = document.getElementById('sec3-amp');
    if (kFreq) {
      renderTex(
        kFreq,
        diff < 1e-4
          ? '\\omega_{\\mathrm{beat}} = 0\\;(\\text{secular growth})'
          : '\\omega_{\\mathrm{beat}}/\\omega_{\\mathrm{n}} = |1 - r| = ' + M.fmtTex(diff, 2),
        false
      );
    }
    if (kAmp) {
      const peak = diff < 1e-4 ? Infinity : 2 / Math.abs(1 - app.rBeat * app.rBeat);
      renderTex(
        kAmp,
        diff < 1e-4
          ? 'x_{\\max}(\\tau)/X_{\\mathrm{st}} = \\tfrac{1}{2}\\tau \\to \\infty'
          : 'x_{\\max}/X_{\\mathrm{st}} = \\frac{2}{|1 - r^2|} = ' + M.fmtTex(peak, 2),
        false
      );
    }
  }

  function updateSection4Readouts() {
    const s = app.sys;
    const kBw = document.getElementById('sec4-bw');
    const kPf = document.getElementById('sec4-pf');
    const kP = document.getElementById('sec4-pnorm');

    if (kBw) {
      renderTex(
        kBw,
        '\\Delta r = r_2 - r_1 = 2\\zeta = ' + M.fmtTex(s.bandwidth, 3),
        false
      );
    }
    if (kPf) {
      renderTex(kPf, '\\sin\\phi = ' + M.fmtTex(Math.sin(s.phi), 3), false);
    }
    if (kP) {
      renderTex(kP, '\\bar{P}/\\bar{P}_{\\max} = ' + M.fmtTex(s.powerNorm / Math.max(1e-6, s.powerMax), 3), false);
    }
  }

  function updateCodeSnippet() {
    const el = document.getElementById('live-code-block');
    if (!el) return;
    const s = app.sys;
    if (app.codeLang === 'matlab') {
      el.textContent =
        '% Verify SDOF harmonic force polygon, phase resonance & bandwidth (MATLAB)\n' +
        'r = ' + M.fmt(s.r, 3) + '; zeta = ' + M.fmt(s.zeta, 3) + ';\n' +
        'H = 1 / ((1 - r^2) + 1i * 2 * zeta * r);\n' +
        'Mag = abs(H); phi_deg = -angle(H) * 180 / pi;\n' +
        'fprintf("M = %.3f, phi = %.2f deg, Q = %.2f\\n", Mag, phi_deg, 1/(2*zeta));\n\n' +
        '% Verify complex force-balance closure: kX + i*c*w*X - m*w^2*X == F0 * exp(i*phi)\n' +
        'closure_err = abs((1 - r^2 + 1i*2*zeta*r)*Mag - exp(1i * phi_deg * pi / 180));\n' +
        'fprintf("Polygon closure residual = %.2e\\n", closure_err);\n\n' +
        '% Exact half-power frequencies & bandwidth Delta_r = 2*zeta\n' +
        'r1 = sqrt(1 + zeta^2) - zeta; r2 = sqrt(1 + zeta^2) + zeta;\n' +
        'fprintf("Half-power band: [%.3f, %.3f], Delta_r = %.3f\\n", r1, r2, r2 - r1);';
    } else {
      el.textContent =
        '# Verify SDOF harmonic force polygon, phase resonance & bandwidth (Python)\n' +
        'import numpy as np\n\n' +
        'r, zeta = ' + M.fmt(s.r, 3) + ', ' + M.fmt(s.zeta, 3) + '\n' +
        'H = 1.0 / ((1.0 - r**2) + 1j * 2.0 * zeta * r)\n' +
        'Mag, phi = np.abs(H), -np.angle(H)\n' +
        'print(f"M = {Mag:.3f}, phi = {np.degrees(phi):.2f} deg, Q = {1/(2*zeta):.2f}")\n\n' +
        '# Force-polygon closure check in displacement-aligned frame\n' +
        'closure_err = abs((1 - r**2 + 1j*2*zeta*r)*Mag - np.exp(1j*phi))\n' +
        'print(f"Polygon closure residual = {closure_err:.2e}")\n\n' +
        '# Exact half-power bandwidth Delta_r === 2 * zeta\n' +
        'r1, r2 = np.sqrt(1 + zeta**2) - zeta, np.sqrt(1 + zeta**2) + zeta\n' +
        'print(f"Half-power band: [{r1:.3f}, {r2:.3f}], Delta_r = {r2 - r1:.3f}")';
    }
  }

  function updateCitation() {
    const el = document.getElementById('cite-text-block');
    if (!el) return;
    const url = 'https://dchelidze.github.io/vibrations-tutorials/sdof-harmonic-phasors/';
    if (app.citeFormat === 'apa') {
      el.textContent =
        'Chelidze, D. (2026). Harmonic forcing, rotating force-polygon geometry, and phase resonance [Interactive tutorial]. Nonlinear Dynamics Laboratory, University of Rhode Island. ' +
        url;
    } else if (app.citeFormat === 'ieee') {
      el.textContent =
        'D. Chelidze, "Harmonic forcing, rotating force-polygon geometry, and phase resonance," Nonlinear Dynamics Laboratory, Univ. of Rhode Island, Kingston, RI, USA, 2026. [Online]. Available: ' +
        url;
    } else {
      el.textContent =
        '@misc{chelidze2026harmonic,\n' +
        '  author       = {Chelidze, David},\n' +
        '  title        = {Harmonic forcing, rotating force-polygon geometry, and phase resonance},\n' +
        '  howpublished = {Interactive Vibrations Tutorial, Nonlinear Dynamics Laboratory, University of Rhode Island},\n' +
        '  year         = {2026},\n' +
        '  url          = {' + url + '}\n' +
        '}';
    }
  }

  function init() {
    app.sys = M.evalHarmonic(app.r, app.zeta);

    app.viz.poly = window.VibLab.VizForcePoly.create({
      rigCanvasId: 'harm-rig-canvas',
      polyCanvasId: 'harm-poly-canvas',
      sys: app.sys
    });

    app.viz.bode = window.VibLab.VizBodeNyquist.create({
      bodeCanvasId: 'harm-bode-canvas',
      nyqCanvasId: 'harm-nyquist-canvas',
      sys: app.sys,
      onRChange: (rVal) => {
        app.presetKey = null;
        app.r = Math.max(0.05, Math.min(3.0, rVal));
        recompute(false);
      }
    });

    app.viz.beat = window.VibLab.VizBeating.create({
      phasorCanvasId: 'harm-beat-phasor-canvas',
      waveCanvasId: 'harm-beat-wave-canvas'
    });

    app.viz.power = window.VibLab.VizPower.create({
      powerCanvasId: 'harm-power-canvas',
      workCanvasId: 'harm-work-canvas',
      sys: app.sys
    });

    // Presets
    document.querySelectorAll('#preset-selector .pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = M.PRESETS[btn.dataset.preset];
        if (!p) return;
        app.presetKey = p.key;
        app.r = p.r;
        app.zeta = p.zeta;
        app.rBeat = p.rBeat;
        app.viz.beat.setRBeat(app.rBeat);
        recompute(false);
      });
    });

    // Sliders
    const slR = document.getElementById('slider-r');
    const slZ = document.getElementById('slider-zeta');
    const slB = document.getElementById('slider-rbeat');
    if (slR) slR.addEventListener('input', () => { app.presetKey = null; app.r = parseFloat(slR.value); recompute(false); });
    if (slZ) slZ.addEventListener('input', () => { app.presetKey = null; app.zeta = parseFloat(slZ.value); recompute(false); });
    if (slB) {
      slB.addEventListener('input', () => {
        app.rBeat = parseFloat(slB.value);
        app.viz.beat.setRBeat(app.rBeat);
        const vb = document.getElementById('val-rbeat');
        if (vb) vb.textContent = 'r = ' + M.fmt(app.rBeat, 2);
        updateSection3Readouts();
      });
    }

    // Section 1 buttons
    const btnPlay = document.getElementById('btn-poly-play');
    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        const next = !app.viz.poly.isPlaying();
        app.viz.poly.setPlaying(next);
        btnPlay.textContent = next ? 'Pause' : 'Play';
      });
    }
    const chkRot = document.getElementById('chk-rotate-poly');
    if (chkRot) chkRot.addEventListener('change', () => app.viz.poly.setRotateFrame(chkRot.checked));

    const btnSnapStiff = document.getElementById('btn-snap-stiff');
    const btnSnapPhase = document.getElementById('btn-snap-phase');
    const btnSnapPeak = document.getElementById('btn-snap-peak');
    const btnSnapMass = document.getElementById('btn-snap-mass');
    if (btnSnapStiff) btnSnapStiff.addEventListener('click', () => { app.presetKey = null; app.r = 0.35; recompute(false); });
    if (btnSnapPhase) btnSnapPhase.addEventListener('click', () => { app.presetKey = null; app.r = 1.00; recompute(false); });
    if (btnSnapPeak) btnSnapPeak.addEventListener('click', () => { app.presetKey = null; app.r = app.sys.hasPeak ? app.sys.rPeak : 0.05; recompute(false); });
    if (btnSnapMass) btnSnapMass.addEventListener('click', () => { app.presetKey = null; app.r = 2.20; recompute(false); });

    // Section 3 beating buttons
    const btnBeatPlay = document.getElementById('btn-beat-play');
    if (btnBeatPlay) {
      btnBeatPlay.addEventListener('click', () => {
        const next = !app.viz.beat.isPlaying();
        app.viz.beat.setPlaying(next);
        btnBeatPlay.textContent = next ? 'Pause' : 'Play';
      });
    }
    const btnBeatRes = document.getElementById('btn-beat-res');
    const btnBeatNear = document.getElementById('btn-beat-near');
    if (btnBeatRes) {
      btnBeatRes.addEventListener('click', () => {
        app.rBeat = 1.00;
        app.viz.beat.setRBeat(1.00);
        app.viz.beat.resetTime();
        recompute(true);
      });
    }
    if (btnBeatNear) {
      btnBeatNear.addEventListener('click', () => {
        app.rBeat = 0.90;
        app.viz.beat.setRBeat(0.90);
        app.viz.beat.resetTime();
        recompute(true);
      });
    }

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
    app.viz.beat.setRBeat(app.rBeat);
    recompute(false);
    updateCitation();
    updateScrollSpy();

    let lastTs = performance.now();
    function tick(now) {
      const dt = Math.min(0.04, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      if (app.viz.poly) app.viz.poly.step(dt);
      if (app.viz.beat) app.viz.beat.step(dt);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderAll() {
    if (app.viz.poly) app.viz.poly.render();
    if (app.viz.bode) app.viz.bode.render();
    if (app.viz.beat) app.viz.beat.render();
    if (app.viz.power) app.viz.power.render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
