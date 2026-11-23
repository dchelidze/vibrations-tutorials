/**
 * app.js
 * Main controller for Module 10 (sdof-fourier-periodic):
 * Periodic Forcing, Fourier Epicycles, Harmonic Filtering, and Subharmonic Resonance.
 */
(function () {
  'use strict';

  const M = window.VibLab.MathFourier;
  const VizEpi = window.VibLab.VizEpicycles;
  const VizSpec = window.VibLab.VizSpectrum;

  const state = {
    wave: 'square',
    r0: 1 / 3,
    zeta: 0.06,
    N: 9,
    presetKey: 'square_third',
    playing: true,
    lastTime: null,
    sys: null
  };

  let epiViz, specViz;

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
    state.sys = M.evalPeriodicSystem(state.wave, state.r0, state.zeta, state.N);
    if (epiViz) epiViz.setSystem(state.sys);
    if (specViz) specViz.setSystem(state.sys);
    updateReadouts();
    updateEquations();
    updateTable();
    updateInsight();
    updateCodeSnippet();
  }

  function updateReadouts() {
    const s = state.sys;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('val-r0', 'r₀ = ' + M.fmt(state.r0, 3));
    set('val-zeta', 'ζ = ' + M.fmt(state.zeta, 2));
    set('val-n', 'N = ' + state.N);
    set('stat-frms', M.fmt(s.fRms, 3));
    set('stat-xrms', M.fmt(s.xRms, 3));
    set('stat-gain', M.fmt(s.rmsGain, 2) + '×');
    set('stat-dom', s.domN > 0 ? 'n = ' + s.domN + ' (rₙ = ' + M.fmt(s.domN * state.r0, 2) + ')' : 'DC (n = 0)');
  }

  function updateEquations() {
    const s = state.sys;
    renderKatex(
      document.getElementById('eq-fourier'),
      'x_{\\mathrm{ss}}(t) = \\frac{a_0}{2} + \\sum_{n=1}^{' + s.N + '} c_n |H(\\mathrm{i} n r_0)|\\cos(n\\omega_0 t + \\psi_n + \\phi_n), \\qquad X_{\\mathrm{rms}} = ' +
        M.fmtTex(s.xRms, 3),
      true
    );

    renderKatex(
      document.getElementById('eq-parseval'),
      'X_{\\mathrm{rms}}^2 = \\left(\\frac{a_0}{2}\\right)^2 + \\frac{1}{2}\\sum_{n=1}^{' + s.N + '} \\left(c_n |H(\\mathrm{i}nr_0)|\\right)^2 = ' +
        M.fmtTex(s.xRms * s.xRms, 3) + ', \\qquad \\frac{X_{\\mathrm{rms}}}{F_{\\mathrm{rms}}} = ' + M.fmtTex(s.rmsGain, 2),
      true
    );
  }

  function updateTable() {
    const tbody = document.getElementById('harm-tbody');
    if (!tbody) return;
    const s = state.sys;
    const rows = [];
    if (s.a0Half > 1e-4) {
      rows.push(
        `<tr><td>0 (DC)</td><td>0.00</td><td>${M.fmt(s.a0Half, 3)}</td><td>1.000</td><td>0.0°</td><td>${M.fmt(s.a0Half, 3)}</td><td>${M.fmt(s.dcEnergyFrac * 100, 1)}%</td></tr>`
      );
    }
    const showMax = Math.min(s.harmonics.length, 9);
    for (let i = 0; i < showMax; i++) {
      const hm = s.harmonics[i];
      if (hm.c < 1e-5 && hm.n > 5) continue;
      const isDom = hm.n === s.domN;
      rows.push(
        `<tr${isDom ? ' style="background: var(--c-crimson-bg); font-weight: 600;"' : ''}>` +
        `<td>${hm.n}${isDom ? ' ★' : ''}</td>` +
        `<td>${M.fmt(hm.rn, 2)}</td>` +
        `<td>${M.fmt(hm.c, 3)}</td>` +
        `<td>${M.fmt(hm.mag, 3)}</td>` +
        `<td>${M.fmt(hm.phiDeg, 1)}°</td>` +
        `<td>${M.fmt(hm.outAmp, 3)}</td>` +
        `<td>${M.fmt(hm.energyFrac * 100, 1)}%</td></tr>`
      );
    }
    tbody.innerHTML = rows.join('');
  }

  function updateInsight() {
    const el = document.getElementById('regime-insight');
    if (!el) return;
    const s = state.sys;
    let html = '';
    if (s.domN > 1 && Math.abs(s.domN * state.r0 - 1) < 0.14) {
      html =
        '<strong>Subharmonic resonance lock ($n = ' + s.domN + '$):</strong> Although the periodic input repeats slowly at $r_0 = ' +
        M.fmt(state.r0, 3) + '$, its $n=' + s.domN + '$ harmonic lands near $r_{' + s.domN + '} = ' +
        M.fmt(s.domN * state.r0, 2) + ' \\approx 1$ and carries <strong>' +
        M.fmt(s.harmonics[s.domN - 1].energyFrac * 100, 1) + '%</strong> of the output RMS energy.';
    } else if (Math.abs(state.r0 - 1) < 0.14 && s.domN === 1) {
      html =
        '<strong>Fundamental filtering ($r_0 \\approx 1$):</strong> The fundamental harmonic hits resonance while higher harmonics fall into the $1/r^2$ roll-off tail, turning the jagged periodic forcing into a clean sinusoid.';
    } else if (state.r0 > 1.25) {
      html =
        '<strong>Supercritical attenuation ($r_0 > 1.25$):</strong> Every harmonic lies above resonance ($nr_0 > 1$), so the SDOF system strongly attenuates all AC harmonics ($X_{\\mathrm{rms}}/F_{\\mathrm{rms}} = ' +
        M.fmt(s.rmsGain, 2) + '$).';
    } else {
      html =
        '<strong>Off-resonance periodic response:</strong> No active input harmonic lands directly on $r = 1$. Watch the RMS sweep below—peaks occur only at $r_0 = 1/n$ where the waveform actually contains a nonzero $n$-th harmonic.';
    }
    el.innerHTML = html;
    renderMathIn(el);
  }

  function updateCodeSnippet() {
    const el = document.getElementById('code-snippet');
    if (!el) return;
    el.textContent =
`% Module 10: Fourier-Series Steady-State SDOF Response (Inman Ch. 3)
r0 = ${M.fmt(state.r0, 4)};   zeta = ${M.fmt(state.zeta, 3)};   N = ${state.N};
theta = linspace(0, 4*pi, 800);
n = (1:N).';
% Square-wave odd harmonics (swap c_n, psi_n for sawtooth/half-rectified/triangle)
c = zeros(N, 1);  psi = zeros(N, 1);
odd = mod(n, 2) == 1;
c(odd) = 4 ./ (pi * n(odd));
psi(odd) = -pi/2;

rn = n * r0;
H = 1 ./ ((1 - rn.^2) + 1i*(2*zeta*rn));
x_ss = sum((c .* abs(H)) .* cos(n * theta + psi + angle(H)), 1);
X_rms = sqrt(0.5 * sum((c .* abs(H)).^2));
fprintf('r0 = %.3f, zeta = %.3f => X_rms = %.3f\\n', r0, zeta, X_rms);`;
  }

  function syncControls() {
    const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setV('slider-r0', state.r0);
    setV('slider-zeta', state.zeta);
    setV('slider-n', state.N);
    document.querySelectorAll('#wave-selector .pill').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-wave') === state.wave);
    });
  }

  function applyPreset(key) {
    const p = M.PRESETS[key];
    if (!p) return;
    state.presetKey = key;
    state.wave = p.wave;
    state.r0 = p.r0;
    state.zeta = p.zeta;
    state.N = p.N;
    syncControls();
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
    bindSlider('slider-r0', (v) => { state.r0 = v; });
    bindSlider('slider-zeta', (v) => { state.zeta = v; });
    bindSlider('slider-n', (v) => { state.N = Math.round(v); });

    document.querySelectorAll('#preset-selector .pill').forEach((b) => {
      b.addEventListener('click', () => applyPreset(b.getAttribute('data-preset')));
    });

    document.querySelectorAll('#wave-selector .pill').forEach((b) => {
      b.addEventListener('click', () => {
        state.wave = b.getAttribute('data-wave');
        clearPreset();
        syncControls();
        recompute();
      });
    });

    document.querySelectorAll('[data-jump-r0]').forEach((b) => {
      b.addEventListener('click', () => {
        state.r0 = parseFloat(b.getAttribute('data-jump-r0'));
        clearPreset();
        syncControls();
        recompute();
      });
    });

    const playBtn = document.getElementById('btn-play');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        state.playing = !state.playing;
        if (epiViz) epiViz.setPlaying(state.playing);
        playBtn.textContent = state.playing ? 'Pause epicycles' : 'Play epicycles';
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
        if (epiViz) epiViz.render();
        if (specViz) specViz.render();
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
    const sections = ['sec-epicycles', 'sec-spectrum', 'sec-subharm', 'sec-table', 'sec-summary']
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
    if (state.playing && epiViz) epiViz.step(dt);
    requestAnimationFrame(tick);
  }

  function init() {
    state.sys = M.evalPeriodicSystem(state.wave, state.r0, state.zeta, state.N);
    epiViz = VizEpi.create({ epiCanvasId: 'epi-canvas', waveCanvasId: 'wave-canvas', sys: state.sys });
    specViz = VizSpec.create({
      inCanvasId: 'spec-in-canvas',
      outCanvasId: 'spec-out-canvas',
      sweepCanvasId: 'sweep-canvas',
      sys: state.sys
    });

    bindControls();
    applyPreset('square_third');
    renderMathIn(document.body);

    window.addEventListener('resize', () => {
      if (epiViz) epiViz.render();
      if (specViz) specViz.render();
    });

    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
