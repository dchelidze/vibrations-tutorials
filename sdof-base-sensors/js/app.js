/**
 * app.js
 * Main controller for Module 04:
 * Base Excitation, Rotating Unbalance, and Seismic Sensor Regimes.
 */
(function () {
  'use strict';

  const M = window.VibLab.MathSensors;
  const VizTri = window.VibLab.VizTriangle;
  const VizCurves = window.VibLab.VizCurves;
  const VizSensors = window.VibLab.VizSensors;
  const VizUnbal = window.VibLab.VizUnbalance;

  const state = {
    r: Math.SQRT2,
    zeta: 0.20,
    presetKey: 'crossover',
    playing: true,
    phase: 0,
    lastTime: null,
    sys: null
  };

  let triViz, curvesViz, sensorsViz, unbalViz;

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
    state.sys = M.evalBaseSensor(state.r, state.zeta);
    if (triViz) triViz.setSystem(state.sys);
    if (curvesViz) curvesViz.setSystem(state.sys);
    if (sensorsViz) sensorsViz.setSystem(state.sys);
    if (unbalViz) { unbalViz.setSystem(state.sys); unbalViz.render(); }
    updateReadouts();
    updateEquations();
    updateRegimeInsight();
    updateCodeSnippet();
  }

  function updateReadouts() {
    const s = state.sys;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('val-r', 'r = ' + M.fmt(state.r, 2));
    set('val-zeta', 'ζ = ' + M.fmt(state.zeta, 2));
    set('stat-td', M.fmt(s.Td, 3));
    set('stat-rrel', M.fmt(s.Rrel, 3));
    set('stat-accel', M.fmt(s.accelGain, 3));
    set('stat-phrel', M.fmt(s.phRelDeg, 1) + '°');
    set('stat-rpeak', s.hasRelPeak ? M.fmt(s.rRelPeak, 2) : 'None');

    const accCut = VizSensors.findAccelCutoff(state.zeta, 0.05);
    const vibCut = VizSensors.findVibroCutoff(state.zeta, 0.05);
    set('stat-acccut', accCut > 0.01 ? 'r ≤ ' + M.fmt(accCut, 2) : 'None');
    set('stat-vibcut', vibCut < 7.9 ? 'r ≥ ' + M.fmt(vibCut, 2) : '> 8.0');
  }

  function updateEquations() {
    const s = state.sys;
    const tdTex = M.fmtTex(s.Td, 3);
    const relTex = M.fmtTex(s.Rrel, 3);
    const accTex = M.fmtTex(s.accelGain, 3);
    const rTex = M.fmtTex(state.r, 2);
    const zTex = M.fmtTex(state.zeta, 2);

    renderKatex(
      document.getElementById('eq-triangle'),
      'X = Y + Z \\;\\Longleftrightarrow\\; H_{\\mathrm{abs}}(\\mathrm{i}r) = 1 + H_{\\mathrm{rel}}(\\mathrm{i}r), \\qquad |H_{\\mathrm{abs}}| = ' +
        tdTex + ', \\quad |H_{\\mathrm{rel}}| = ' + relTex,
      true
    );

    renderKatex(
      document.getElementById('eq-trans'),
      'T_{\\mathrm{d}}(r,\\zeta) = \\frac{|X|}{Y} = \\sqrt{\\frac{1 + (2\\zeta r)^2}{(1 - r^2)^2 + (2\\zeta r)^2}} = ' +
        tdTex + ', \\qquad \\frac{|Z|}{Y} = \\frac{M X}{m_0 e} = \\frac{r^2}{\\sqrt{(1-r^2)^2 + (2\\zeta r)^2}} = ' + relTex,
      true
    );

    renderKatex(
      document.getElementById('eq-sensors'),
      '\\text{Accelerometer }(r\\ll 1):\\; \\frac{\\omega_{\\mathrm{n}}^2 |Z|}{|\\ddot{Y}|} = \\frac{1}{\\sqrt{(1-r^2)^2+(2\\zeta r)^2}} = ' +
        accTex + '; \\qquad \\text{Vibrometer }(r\\gg 1):\\; \\frac{|Z|}{Y} = ' + relTex,
      true
    );

    renderKatex(
      document.getElementById('eq-unbalance'),
      '\\frac{M X_{\\mathrm{CM}}}{m_0 e} = 1 + H_{\\mathrm{rel}}(\\mathrm{i}r) = H_{\\mathrm{abs}}(\\mathrm{i}r) \\;\\;\\Longrightarrow\\;\\; \\left|\\frac{M X_{\\mathrm{CM}}}{m_0 e}\\right|_{r=' +
        rTex + ',\\,\\zeta=' + zTex + '} = ' + tdTex,
      true
    );
  }

  function updateRegimeInsight() {
    const el = document.getElementById('regime-insight');
    if (!el) return;
    const s = state.sys;
    let html = '';
    if (Math.abs(state.r - Math.SQRT2) < 0.03) {
      html =
        '<strong>Crossover identity ($r = \\sqrt{2}$):</strong> The displacement triangle is strictly isosceles ($|X| = Y = 1$), independent of $\\zeta$. Isolation begins strictly above $r = \\sqrt{2}$, where extra damping increases $|X|/Y$.';
    } else if (state.r < 0.60) {
      html =
        '<strong>Accelerometer regime ($r < 0.60$):</strong> The seismic mass tracks the base closely ($X \\approx Y$) while the small spring deflection $Z \\approx -\\ddot{Y}/\\omega_{\\mathrm{n}}^2$ measures base acceleration. Near $\\zeta = 0.70$, the gain stays flat within $\\pm 5\\%$ up to $r \\approx 0.59$.';
    } else if (state.r > 2.0) {
      html =
        '<strong>Isolation &amp; vibrometer regime ($r > 2$):</strong> Inertia holds the seismic mass nearly stationary ($|X|/Y = ' +
        M.fmt(s.Td, 2) +
        '$), so $Z \\approx -Y$ reads base displacement directly. In a rotating-unbalance machine, the $180^\\circ$ phase flip keeps the combined center of mass nearly still.';
    } else {
      html =
        '<strong>Resonant amplification band ($0.60 \\le r \\le 2.0$):</strong> Base motion is amplified ($|X|/Y = ' +
        M.fmt(s.Td, 2) +
        '$). Adding damping reduces the resonant peak dramatically here, at the cost of shallower roll-off above $r = \\sqrt{2}$.';
    }
    el.innerHTML = html;
    renderMathIn(el);
  }

  function updateCodeSnippet() {
    const el = document.getElementById('code-snippet');
    if (!el) return;
    const rStr = M.fmt(state.r, 3);
    const zStr = M.fmt(state.zeta, 3);
    el.textContent =
`% Module 04: Base Excitation, Rotating Unbalance, and Seismic Sensors (Inman Ch. 2)
zeta = ${zStr};
r = linspace(0, 4, 800);
den = (1 - r.^2) + 1i*(2*zeta*r);

H_abs = (1 + 1i*2*zeta*r) ./ den;     % Base transmissibility X / Y
H_rel = (r.^2) ./ den;                % Relative Z / Y === M*X / (m0*e)
H_acc = 1 ./ den;                     % Accelerometer gain w_n^2*Z / (-Y'')

% Exact vector identity: H_abs == 1 + H_rel (and M*X_CM/(m0*e) == H_abs)
assert(max(abs(H_abs - (1 + H_rel))) < 1e-13);

% Evaluate at current operating point r0 = ${rStr}
r0 = ${rStr};
Td0 = abs((1 + 1i*2*zeta*r0) / ((1 - r0^2) + 1i*2*zeta*r0));
fprintf('At r = %.3f, zeta = %.3f: |X|/Y = %.3f, |Z|/Y = %.3f\\n', ...
    r0, zeta, Td0, abs(r0^2 / ((1 - r0^2) + 1i*2*zeta*r0)));`;
  }

  function applyPreset(key) {
    const p = M.PRESETS[key];
    if (!p) return;
    state.presetKey = key;
    state.r = p.r;
    state.zeta = p.zeta;
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

  function syncSliders() {
    const sr = document.getElementById('slider-r');
    const sz = document.getElementById('slider-zeta');
    if (sr) sr.value = state.r;
    if (sz) sz.value = state.zeta;
  }

  function clearPresetActive() {
    state.presetKey = null;
    document.querySelectorAll('#preset-selector .pill').forEach((b) => b.classList.remove('active'));
  }

  function bindControls() {
    const sr = document.getElementById('slider-r');
    const sz = document.getElementById('slider-zeta');
    if (sr) {
      sr.addEventListener('input', () => {
        state.r = parseFloat(sr.value);
        clearPresetActive();
        recompute();
      });
    }
    if (sz) {
      sz.addEventListener('input', () => {
        state.zeta = parseFloat(sz.value);
        clearPresetActive();
        recompute();
      });
    }

    document.querySelectorAll('#preset-selector .pill').forEach((btn) => {
      btn.addEventListener('click', () => applyPreset(btn.getAttribute('data-preset')));
    });

    const playBtn = document.getElementById('btn-play');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        state.playing = !state.playing;
        if (triViz) triViz.setPlaying(state.playing);
        playBtn.textContent = state.playing ? 'Pause motion' : 'Play motion';
      });
    }

    const themeBtn = document.getElementById('btn-theme');
    const themeLabel = document.getElementById('btn-theme-label');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme');
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        if (themeLabel) themeLabel.textContent = next === 'dark' ? 'Light' : 'Dark';
        if (curvesViz) curvesViz.render();
        if (sensorsViz) sensorsViz.render();
        if (triViz) triViz.render();
        if (unbalViz) unbalViz.render();
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

    // Active nav highlighting
    const navLinks = document.querySelectorAll('.chapter-nav a');
    const sections = ['sec-triangle', 'sec-curves', 'sec-sensors', 'sec-unbalance', 'sec-summary']
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

  function tick(ts) {
    if (state.lastTime === null) state.lastTime = ts;
    const dt = Math.min(0.05, (ts - state.lastTime) / 1000);
    state.lastTime = ts;
    if (state.playing) {
      state.phase += dt * Math.min(7.5, Math.max(2.0, state.r * 2.8));
      if (triViz) triViz.step(dt);
      if (unbalViz) { unbalViz.setPhase(state.phase); unbalViz.render(); }
    }
    requestAnimationFrame(tick);
  }

  function init() {
    state.sys = M.evalBaseSensor(state.r, state.zeta);
    triViz = VizTri.create({
      rigCanvasId: 'rig-canvas',
      triCanvasId: 'tri-canvas',
      sys: state.sys
    });
    curvesViz = VizCurves.create({
      transCanvasId: 'canvas-trans',
      relCanvasId: 'canvas-rel',
      sys: state.sys
    });
    sensorsViz = VizSensors.create({
      accelCanvasId: 'canvas-accel',
      vibroCanvasId: 'canvas-vibro',
      sys: state.sys
    });
    unbalViz = VizUnbal.create({ canvasId: 'canvas-unbalance', sys: state.sys });

    bindControls();
    applyPreset('crossover');
    renderMathIn(document.body);

    window.addEventListener('resize', () => {
      if (triViz) triViz.render();
      if (curvesViz) curvesViz.render();
      if (sensorsViz) sensorsViz.render();
      if (unbalViz) unbalViz.render();
    });

    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
