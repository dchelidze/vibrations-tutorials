/**
 * app.js
 * Central reactive controller for Module 07 (Fourier & Laplace Transforms in Vibration Analysis).
 * Coordinates KaTeX typesetting, physical parameter state, all five interactive visualizations,
 * live six-FRF dimensionality table, MATLAB/Python verification scripts, citation widget,
 * theme toggle, scroll-spy, and 60fps animation loop.
 */
(function () {
  'use strict';

  const M1 = window.VibLab.Math1D;
  const Theme = window.VibLab.Theme;

  const KATEX_DELIMITERS = [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
    { left: '\\(', right: '\\)', display: false },
    { left: '\\[', right: '\\]', display: true }
  ];

  const app = {
    presetKey: 'light',
    params: { m: 1.0, k: 100.0, zeta: 0.08 },
    probeR: 1.0,
    sigmaSlice: 0.0,
    selectedFrfKey: 'mobility',
    codeLang: 'matlab',
    citeFormat: 'apa',
    sys: null,
    viz: {}
  };

  /* -----------------------------------------------------------
   * KaTeX Helpers
   * --------------------------------------------------------- */
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

  /* -----------------------------------------------------------
   * Recompute 1-DOF Model & Sync All Views
   * --------------------------------------------------------- */
  function recompute() {
    app.sys = M1.computeSystem(app.params);

    syncDrawerReadouts();
    updateSection1Readouts();
    updateSPlaneReadouts();
    updateIrfFormula();
    updateFrfAnatomyReadouts();
    updateFrfTypesTable();
    updateCodeSnippet();

    if (app.viz.sdof) app.viz.sdof.setSystem(app.sys, app.probeR * app.sys.wn);
    if (app.viz.splane) app.viz.splane.setSystem(app.sys);
    if (app.viz.conv) app.viz.conv.setSystem(app.sys);
    if (app.viz.frf) app.viz.frf.setSystem(app.sys);
    if (app.viz.types) app.viz.types.setSystem(app.sys);
  }

  function syncDrawerReadouts() {
    const sys = app.sys;
    document.getElementById('slider-m').value = app.params.m;
    document.getElementById('slider-k').value = app.params.k;
    document.getElementById('slider-zeta').value = app.params.zeta;
    document.getElementById('slider-r').value = Math.min(3.0, Math.max(0.1, app.probeR));

    document.getElementById('val-m').textContent = M1.fmt(sys.m, 2) + ' kg';
    document.getElementById('val-k').textContent = M1.fmt(sys.k, 0) + ' N/m';
    document.getElementById('val-zeta').textContent =
      M1.fmt(sys.zeta, 2) + ' (c = ' + M1.fmt(sys.c, 2) + ' N·s/m)';
    document.getElementById('val-r').textContent =
      M1.fmt(app.probeR, 2) + ' (' + M1.fmt(app.probeR * sys.wn, 2) + ' rad/s)';
  }

  function updateSection1Readouts() {
    const sys = app.sys;
    const preset = M1.PRESETS[app.presetKey];
    const descEl = document.getElementById('preset-desc-text');
    if (preset) {
      descEl.textContent = preset.description;
    } else {
      descEl.textContent =
        'Custom 1-DOF system: $m = ' +
        M1.fmt(sys.m, 2) +
        '\\;\\text{kg}$, $k = ' +
        M1.fmt(sys.k, 0) +
        '\\;\\text{N/m}$, $\\zeta = ' +
        M1.fmt(sys.zeta, 2) +
        '$ ($' +
        sys.regime +
        '$).';
    }
    typesetElement(descEl);

    // Live Triad Equations
    const triadEl = document.getElementById('live-triad-eqs');
    triadEl.innerHTML =
      '<div class="c-orange"></div><div class="c-teal"></div><div class="c-blue"></div>';
    renderTex(
      triadEl.children[0],
      'H(s) = \\frac{X(s)}{F(s)} = \\frac{1}{' +
        M1.fmt(sys.m, 2) +
        's^2 + ' +
        M1.fmt(sys.c, 2) +
        's + ' +
        M1.fmt(sys.k, 0) +
        '}',
      false
    );
    renderTex(
      triadEl.children[1],
      'H(\\mathrm{i}\\omega) = \\left.H(s)\\right|_{s=\\mathrm{i}\\omega} = \\frac{1}{(' +
        M1.fmt(sys.k, 0) +
        ' - ' +
        M1.fmt(sys.m, 2) +
        '\\omega^2) + \\mathrm{i}\\,' +
        M1.fmt(sys.c, 2) +
        '\\omega}',
      false
    );
    renderTex(
      triadEl.children[2],
      'h(t) = \\mathcal{L}^{-1}\\{H(s)\\}' +
        (sys.includesImagAxis
          ? ' = \\mathcal{F}^{-1}\\{H(\\mathrm{i}\\omega)\\}'
          : '\\;\\;(\\sigma = 0\\text{ on ROC boundary})'),
      false
    );

    // KPI tiles
    renderTex(
      document.getElementById('kpi-wn'),
      '\\omega_{\\mathrm{n}} = ' + M1.fmt(sys.wn, 2) + '\\;\\text{rad/s}',
      false
    );
    renderTex(
      document.getElementById('kpi-fn'),
      'f_{\\mathrm{n}} = ' + M1.fmt(sys.fn, 2) + '\\;\\text{Hz},\\; T_{\\mathrm{n}} = ' + M1.fmt(1 / sys.fn, 2) + '\\;\\text{s}',
      false
    );

    renderTex(
      document.getElementById('kpi-zeta'),
      '\\zeta = ' + M1.fmt(sys.zeta, 2) + ',\\; Q = ' + (Number.isFinite(sys.Q) ? M1.fmt(sys.Q, 2) : '\\infty'),
      false
    );
    if (sys.regime === 'underdamped' || sys.regime === 'undamped') {
      renderTex(
        document.getElementById('kpi-wd'),
        '\\omega_{\\mathrm{d}} = ' + M1.fmt(sys.wd, 2) + '\\;\\text{rad/s}\\;(' + sys.regime + ')',
        false
      );
    } else {
      renderTex(
        document.getElementById('kpi-wd'),
        '\\text{Non-oscillatory } (' + sys.regime + ')',
        false
      );
    }

    if (sys.regime === 'underdamped') {
      renderTex(
        document.getElementById('kpi-poles'),
        'p_{1,2} = ' + M1.fmt(sys.p1.re, 2) + ' \\pm ' + M1.fmt(Math.abs(sys.p1.im), 2) + '\\mathrm{i}',
        false
      );
    } else if (sys.regime === 'undamped') {
      renderTex(
        document.getElementById('kpi-poles'),
        'p_{1,2} = \\pm ' + M1.fmt(sys.wn, 2) + '\\mathrm{i}',
        false
      );
    } else if (sys.regime === 'critical') {
      renderTex(
        document.getElementById('kpi-poles'),
        'p_{1,2} = ' + M1.fmt(sys.p1.re, 2) + '\\;(\\text{double})',
        false
      );
    } else {
      renderTex(
        document.getElementById('kpi-poles'),
        'p_1 = ' + M1.fmt(sys.p1.re, 2) + ',\\; p_2 = ' + M1.fmt(sys.p2.re, 2),
        false
      );
    }

    renderTex(
      document.getElementById('kpi-roc'),
      '\\text{ROC: } \\operatorname{Re}(s) > ' + M1.fmt(sys.sigma0, 2) + '\\;\\text{s}^{-1}',
      false
    );

    renderTex(
      document.getElementById('kpi-static'),
      '1/k = ' + M1.fmtSci(sys.staticCompliance, 2) + '\\;\\text{m/N}',
      false
    );
    if (sys.zeta < 1e-5) {
      renderTex(
        document.getElementById('kpi-peak'),
        '|\\alpha(\\mathrm{i}\\omega_{\\mathrm{n}})| \\to \\infty\\;(\\text{undamped})',
        false
      );
    } else if (sys.hasPeak) {
      renderTex(
        document.getElementById('kpi-peak'),
        '\\omega_{\\mathrm{r}} = ' + M1.fmt(sys.wrRecept, 2) + '\\;\\text{rad/s},\\; k|\\alpha|_{\\max} = ' + M1.fmt(sys.k * sys.peakRecept, 2),
        false
      );
    } else {
      renderTex(
        document.getElementById('kpi-peak'),
        '\\text{No resonant peak } (\\zeta \\ge 1/\\sqrt{2})',
        false
      );
    }
  }

  function updateSPlaneReadouts() {
    const sys = app.sys;
    const sigPhys = app.sigmaSlice * sys.wn;
    const inRoc = sigPhys > sys.sigma0 + 1e-4;
    const isFourier = Math.abs(app.sigmaSlice) < 0.025;

    const valEl = document.getElementById('val-sigma');
    valEl.textContent = 'σ = ' + M1.fmt(app.sigmaSlice, 2) + ' ωₙ (' + M1.fmt(sigPhys, 2) + ' s⁻¹)';

    const badge = document.getElementById('badge-roc');
    if (!inRoc) {
      badge.className = 'status-badge warn';
      badge.textContent = 'Outside ROC (diverges)';
    } else if (isFourier) {
      badge.className = 'status-badge ok';
      badge.textContent = 'Imaginary axis: exact Fourier FRF';
    } else {
      badge.className = 'status-badge ok';
      badge.textContent = 'Inside ROC (converges)';
    }

    const callout = document.getElementById('splane-callout');
    if (isFourier && sys.includesImagAxis) {
      callout.className = 'callout callout-teal';
      callout.innerHTML =
        '<strong>Exact Fourier–Laplace identity at $\\sigma = 0$.</strong> Because all poles lie strictly in the left half-plane ($\\sigma_0 = ' +
        M1.fmt(sys.sigma0, 2) +
        '\\;\\text{s}^{-1} < 0$), the imaginary axis $s = \\mathrm{i}\\omega$ sits inside the ROC. The vertical slice along $\\sigma = 0$ is identically the Frequency Response Function $H(\\mathrm{i}\\omega)$.';
    } else if (isFourier && !sys.includesImagAxis) {
      callout.className = 'callout callout-crimson';
      callout.innerHTML =
        '<strong>Why Laplace generalizes Fourier when $\\zeta = 0$.</strong> The undamped poles lie directly on the imaginary axis ($\\sigma_0 = 0$), so $h(t) = \\frac{1}{m\\omega_{\\mathrm{n}}}\\sin(\\omega_{\\mathrm{n}}t)u(t)$ does not decay and its classical Fourier integral diverges. Slide $\\sigma > 0$ right to add exponential damping $\\mathrm{e}^{-\\sigma t}$ and enter the ROC.';
    } else if (!inRoc) {
      callout.className = 'callout callout-crimson';
      callout.innerHTML =
        '<strong>Outside the Region of Convergence ($\\sigma \\le \\sigma_0$).</strong> Although the rational formula $H(s) = (ms^2+cs+k)^{-1}$ still evaluates numerically by analytic continuation, the defining integral $\\int_0^\\infty h(t)\\mathrm{e}^{-(\\sigma+\\mathrm{i}\\omega)t}\\,\\mathrm{d}t$ diverges because $h(t)\\mathrm{e}^{-\\sigma t}$ grows exponentially in time. Toggle <em>Weighted kernel</em> above to see the divergence.';
    } else if (sigPhys > 0) {
      callout.className = 'callout';
      callout.innerHTML =
        '<strong>Positive real shift $\\sigma > 0$ acts as an exponential damping window.</strong> Multiplying $h(t)$ by $\\mathrm{e}^{-\\sigma t}$ moves the slice further right from the poles, broadening and lowering the peak—the exact mechanism of an exponential window in experimental impact-hammer modal testing.';
    } else {
      callout.className = 'callout callout-blue';
      callout.innerHTML =
        '<strong>Approaching the poles inside the ROC ($\\sigma_0 < \\sigma < 0$).</strong> Moving the slice leftward toward $\\sigma_0 = ' +
        M1.fmt(sys.sigma0, 2) +
        '\\;\\text{s}^{-1}$ sharpens the peak because the slice passes closer to the poles $p_{1,2}$ where $|H(s)| \\to \\infty$.';
    }
    typesetElement(callout);
  }

  function updateIrfFormula() {
    const sys = app.sys;
    const el = document.getElementById('live-irf-formula');
    el.innerHTML = '<div></div>';
    let tex = '';
    if (sys.regime === 'undamped') {
      tex =
        'h(t) = \\frac{1}{m\\omega_{\\mathrm{n}}}\\sin(\\omega_{\\mathrm{n}} t)\\,u(t) = ' +
        M1.fmtSci(1 / (sys.m * sys.wn), 2) +
        '\\sin(' +
        M1.fmt(sys.wn, 2) +
        't)\\,u(t)\\;\\;\\text{[undamped]}';
    } else if (sys.regime === 'underdamped') {
      tex =
        'h(t) = \\frac{1}{m\\omega_{\\mathrm{d}}}\\mathrm{e}^{-\\zeta\\omega_{\\mathrm{n}} t}\\sin(\\omega_{\\mathrm{d}} t)\\,u(t) = ' +
        M1.fmtSci(1 / (sys.m * sys.wd), 2) +
        '\\,\\mathrm{e}^{-' +
        M1.fmt(-sys.sigma, 2) +
        't}\\sin(' +
        M1.fmt(sys.wd, 2) +
        't)\\,u(t)\\;\\;\\text{[underdamped]}';
    } else if (sys.regime === 'critical') {
      tex =
        'h(t) = \\frac{t}{m}\\mathrm{e}^{-\\omega_{\\mathrm{n}} t}\\,u(t) = ' +
        M1.fmt(1 / sys.m, 2) +
        '\\,t\\,\\mathrm{e}^{-' +
        M1.fmt(sys.wn, 2) +
        't}\\,u(t)\\;\\;\\text{[critically damped]}';
    } else {
      tex =
        'h(t) = \\frac{\\mathrm{e}^{p_1 t} - \\mathrm{e}^{p_2 t}}{m(p_1 - p_2)}\\,u(t) = ' +
        M1.fmtSci(1 / (sys.m * (sys.p1.re - sys.p2.re)), 2) +
        '\\!\\left(\\mathrm{e}^{' +
        M1.fmt(sys.p1.re, 2) +
        't} - \\mathrm{e}^{' +
        M1.fmt(sys.p2.re, 2) +
        't}\\right)u(t)\\;\\;\\text{[overdamped]}';
    }
    renderTex(el.children[0], tex, true);
  }

  function updateFrfAnatomyReadouts() {
    const sys = app.sys;
    const w = app.probeR * sys.wn;
    const H = M1.evalFRF(sys, 'receptance', w);
    const mag = M1.cAbs(H);
    const ph = M1.evalFRFPhaseDeg(sys, 'receptance', w);

    renderTex(
      document.getElementById('kpi-probe-w'),
      '\\omega = ' + M1.fmt(w, 2) + '\\;\\text{rad/s}\\; (r = ' + M1.fmt(app.probeR, 2) + ')',
      false
    );

    let regText = 'Damping-controlled (resonance band)';
    if (app.probeR < 0.6) regText = 'Stiffness-controlled (α ≈ 1/k, in phase)';
    else if (app.probeR > 1.5) regText = 'Mass-controlled (α ≈ −1/(mω²), out of phase)';
    document.getElementById('kpi-probe-regime').textContent = regText;

    renderTex(
      document.getElementById('kpi-probe-mag'),
      '|\\alpha| = ' + M1.fmtSci(mag, 2) + '\\;\\text{m/N},\\; \\phi = ' + M1.fmt(ph, 1) + '^\\circ',
      false
    );
    renderTex(
      document.getElementById('kpi-probe-reim'),
      '\\operatorname{Re} = ' + M1.fmtSci(H.re, 2) + ',\\; \\operatorname{Im} = ' + M1.fmtSci(H.im, 2),
      false
    );

    if (sys.wHalfLow && sys.wHalfHigh) {
      const dw = sys.wHalfHigh - sys.wHalfLow;
      const zetaEst = dw / (2 * sys.wn);
      renderTex(
        document.getElementById('kpi-halfpower'),
        '\\Delta\\omega = ' + M1.fmt(dw, 2) + '\\;\\text{rad/s}',
        false
      );
      renderTex(
        document.getElementById('kpi-halfpower-sub'),
        '\\Delta\\omega / (2\\omega_{\\mathrm{n}}) = ' + M1.fmt(zetaEst, 3) + '\\;(\\text{exact }\\zeta = ' + M1.fmt(sys.zeta, 2) + ')',
        false
      );
    } else if (sys.zeta < 1e-5) {
      document.getElementById('kpi-halfpower').textContent = 'Δω = 0 rad/s';
      document.getElementById('kpi-halfpower-sub').textContent = 'Undamped pole (infinite Q)';
    } else {
      document.getElementById('kpi-halfpower').textContent = 'No −3 dB peak band';
      document.getElementById('kpi-halfpower-sub').textContent = 'Requires ζ < 1/√2 ≈ 0.707';
    }
  }

  function updateFrfTypesTable() {
    const sys = app.sys;
    const w = app.probeR * sys.wn;
    const C = Theme.colors();
    const tbody = document.getElementById('frf-types-tbody');
    tbody.innerHTML = '';

    M1.FRF_META.forEach(function (meta) {
      const val = M1.evalFRF(sys, meta.key, w);
      const mag = M1.cAbs(val);
      const ph = M1.evalFRFPhaseDeg(sys, meta.key, w);

      const tr = document.createElement('tr');
      tr.className = 'clickable-row' + (meta.key === app.selectedFrfKey ? ' selected-row' : '');
      tr.setAttribute('data-frf-key', meta.key);

      const swatchColor = C[meta.colorKey] || C.blue;
      tr.innerHTML =
        '<td><span class="swatch" style="background:' +
        swatchColor +
        '"></span><strong>' +
        meta.name +
        '</strong><br><span style="font-size:11.5px;color:var(--text-muted)">' +
        meta.alt +
        ' · ' +
        meta.sensor +
        '</span></td>' +
        '<td class="tex-cell-def"></td>' +
        '<td class="tex-cell-form"></td>' +
        '<td><span class="unit-pill">' +
        meta.units +
        '</span></td>' +
        '<td style="font-size:12px;font-family:var(--font-mono)">' +
        meta.lowSlope +
        '<br>' +
        meta.highSlope +
        '</td>' +
        '<td style="font-family:var(--font-mono);font-size:12px;white-space:nowrap">' +
        M1.fmtSci(mag, 2) +
        ' ' +
        meta.units +
        '<br><span style="color:var(--text-muted)">∠ ' +
        M1.fmt(ph, 1) +
        '°</span></td>';

      tr.addEventListener('click', function () {
        app.selectedFrfKey = meta.key;
        if (app.viz.types) app.viz.types.setSelectedKey(meta.key);
        // Sync top group pills
        const grp = meta.group;
        document.querySelectorAll('#types-group-pills .pill').forEach(function (p) {
          p.classList.toggle('active', p.getAttribute('data-group') === grp);
        });
        updateFrfTypesTable();
      });

      tbody.appendChild(tr);

      renderTex(tr.querySelector('.tex-cell-def'), meta.symbol + ' = ' + meta.ratioTex, false);
      renderTex(tr.querySelector('.tex-cell-form'), meta.formulaTex, false);
    });
  }

  /* -----------------------------------------------------------
   * Live MATLAB & Python (SciPy) Verification Code
   * --------------------------------------------------------- */
  function updateCodeSnippet() {
    const sys = app.sys;
    const f = (v) => M1.fmt(v, 3);
    let code = '';

    if (app.codeLang === 'matlab') {
      code = [
        '% 1-DOF Laplace transfer function, impulse response, and 6 FRFs',
        'm = ' + f(sys.m) + ';  k = ' + f(sys.k) + ';  zeta = ' + f(sys.zeta) + ';',
        'wn = sqrt(k / m);                  % Natural frequency [rad/s]',
        'c  = 2 * zeta * sqrt(m * k);       % Viscous damping [N*s/m]',
        '',
        '% Laplace transfer function H(s) = X(s) / F(s) and poles',
        's = tf("s");',
        'H = 1 / (m*s^2 + c*s + k);',
        'p = pole(H);                       % Poles p1, p2 (ROC: Re(s) > max(Re(p)))',
        '',
        '% Frequency grid and all six dimensional FRFs at s = 1i * w',
        'w = logspace(log10(0.1*wn), log10(10*wn), 600);',
        'alpha = 1 ./ ((k - m*w.^2) + 1i*c*w);   % Receptance       [m/N]',
        'Y     = (1i * w) .* alpha;              % Mobility         [m/(N*s)]',
        'A     = (-w.^2)  .* alpha;              % Accelerance      [1/kg]',
        'Zk    = 1 ./ alpha;                     % Dynamic stiffness [N/m]',
        'Z     = 1 ./ Y;                         % Impedance        [N*s/m]',
        'Mapp  = 1 ./ A;                         % Apparent mass    [kg]',
        '',
        '% Impulse response h(t) = L^{-1}{H(s)}',
        '[h, t] = impulse(H);',
        'fprintf("wn = %.3f rad/s, poles = %.3f %+.3fi\\n", wn, real(p(1)), imag(p(1)));'
      ].join('\n');
    } else {
      code = [
        'import numpy as np',
        'from scipy import signal',
        '',
        '# 1-DOF physical parameters',
        'm, k, zeta = ' + f(sys.m) + ', ' + f(sys.k) + ', ' + f(sys.zeta),
        'wn = np.sqrt(k / m)                # Natural frequency [rad/s]',
        'c  = 2.0 * zeta * np.sqrt(m * k)   # Viscous damping [N*s/m]',
        '',
        '# Laplace transfer function H(s) = 1 / (m s^2 + c s + k)',
        'sys = signal.TransferFunction([1.0], [m, c, k])',
        'poles = sys.poles                  # ROC: Re(s) > max(Re(poles))',
        't, h = signal.impulse(sys)         # Impulse response h(t)',
        '',
        '# Six dimensional FRFs along imaginary axis s = 1j * w',
        'w = np.logspace(np.log10(0.1 * wn), np.log10(10.0 * wn), 600)',
        'alpha = 1.0 / ((k - m * w**2) + 1j * c * w)   # Receptance [m/N]',
        'Y     = 1j * w * alpha                        # Mobility   [m/(N*s)]',
        'A     = -(w**2) * alpha                       # Accelerance [1/kg]',
        'Zk, Z, Mapp = 1.0 / alpha, 1.0 / Y, 1.0 / A   # Reciprocal family',
        '',
        'print(f"wn = {wn:.3f} rad/s, poles = {poles}")'
      ].join('\n');
    }

    document.getElementById('live-code-block').textContent = code;
  }

  /* -----------------------------------------------------------
   * Citation Widget (APA / IEEE / BibTeX)
   * --------------------------------------------------------- */
  function updateCitation() {
    const year = new Date().getFullYear();
    const url = 'https://dchelidze.github.io/vibrations-tutorials/sdof-fourier-laplace/';
    let text = '';
    if (app.citeFormat === 'apa') {
      text =
        'Chelidze, D. (' +
        year +
        '). Fourier and Laplace transforms in vibration analysis [Interactive web tutorial]. Nonlinear Dynamics Laboratory, University of Rhode Island. ' +
        url;
    } else if (app.citeFormat === 'ieee') {
      text =
        'D. Chelidze, "Fourier and Laplace transforms in vibration analysis," Nonlinear Dynamics Laboratory, University of Rhode Island, ' +
        year +
        '. [Online]. Available: ' +
        url;
    } else {
      text = [
        '@misc{chelidze' + year + 'fourierlaplace,',
        '  author       = {Chelidze, David},',
        '  title        = {Fourier and Laplace Transforms in Vibration Analysis},',
        '  year         = {' + year + '},',
        '  howpublished = {Interactive web tutorial, Nonlinear Dynamics Laboratory, University of Rhode Island},',
        '  url          = {' + url + '}',
        '}'
      ].join('\n');
    }
    document.getElementById('cite-text-block').textContent = text;
  }

  /* -----------------------------------------------------------
   * Initialization & Event Wiring
   * --------------------------------------------------------- */
  function init() {
    typesetElement(document.body);
    app.sys = M1.computeSystem(app.params);

    // Instantiate all 5 visualizations
    app.viz.sdof = window.VibLab.SdofViz.create({
      simCanvas: document.getElementById('sdof-sim-canvas'),
      waveCanvas: document.getElementById('sdof-wave-canvas'),
      sys: app.sys,
      omegaDrive: app.probeR * app.sys.wn
    });

    app.viz.splane = window.VibLab.SPlaneViz.create({
      canvas3d: document.getElementById('splane-3d-canvas'),
      canvas2d: document.getElementById('splane-2d-canvas'),
      sys: app.sys,
      onOrbitChange: function () {
        document.getElementById('btn-splane-orbit').textContent = 'Auto-orbit 3D';
      }
    });

    app.viz.conv = window.VibLab.ConvolutionViz.create({
      timeCanvas: document.getElementById('conv-time-canvas'),
      freqCanvas: document.getElementById('conv-freq-canvas'),
      sys: app.sys,
      onTimeChange: function (frac, tPhys) {
        document.getElementById('slider-conv-t').value = frac;
        document.getElementById('val-conv-t').textContent = 't = ' + M1.fmt(tPhys, 2) + ' s';
      }
    });

    app.viz.frf = window.VibLab.FrfAnatomyViz.create({
      bodeCanvas: document.getElementById('frf-bode-canvas'),
      complexCanvas: document.getElementById('frf-complex-canvas'),
      sys: app.sys,
      onProbeChange: function (r) {
        setProbeRatio(r, 'frf');
      }
    });

    app.viz.types = window.VibLab.FrfTypesViz.create({
      mainCanvas: document.getElementById('types-bode-canvas'),
      nyqCanvas: document.getElementById('types-nyq-canvas'),
      sys: app.sys,
      onProbeChange: function (r) {
        setProbeRatio(r, 'types');
      }
    });

    bindControls();
    recompute();
    setupVisibilityAndScrollSpy();
    startLoop();
  }

  function setProbeRatio(r, source) {
    app.probeR = Math.max(0.1, Math.min(3.5, r));
    syncDrawerReadouts();
    updateFrfAnatomyReadouts();
    updateFrfTypesTable();
    if (source !== 'frf' && app.viz.frf) app.viz.frf.setProbeR(app.probeR);
    if (source !== 'types' && app.viz.types) app.viz.types.setProbeR(app.probeR);
    if (app.viz.sdof) app.viz.sdof.setDriveFreq(app.probeR * app.sys.wn);
  }

  function applyPreset(key) {
    const p = M1.PRESETS[key];
    if (!p) return;
    app.presetKey = key;
    app.params.m = p.m;
    app.params.k = p.k;
    app.params.zeta = p.zeta;
    document.querySelectorAll('#preset-selector .pill').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-preset') === key);
    });
    recompute();
  }

  function bindControls() {
    // Hero preset selector & drawer preset chips
    document.querySelectorAll('[data-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyPreset(this.getAttribute('data-preset'));
      });
    });

    // Parameter drawer open/close
    const drawer = document.getElementById('param-drawer');
    document.getElementById('btn-params').addEventListener('click', function () {
      drawer.classList.toggle('open');
    });
    document.getElementById('btn-sdof-params').addEventListener('click', function () {
      drawer.classList.add('open');
    });
    document.getElementById('btn-close-drawer').addEventListener('click', function () {
      drawer.classList.remove('open');
    });

    // Parameter sliders
    document.getElementById('slider-m').addEventListener('input', function () {
      app.presetKey = null;
      app.params.m = parseFloat(this.value);
      clearHeroPresetActive();
      recompute();
    });
    document.getElementById('slider-k').addEventListener('input', function () {
      app.presetKey = null;
      app.params.k = parseFloat(this.value);
      clearHeroPresetActive();
      recompute();
    });
    document.getElementById('slider-zeta').addEventListener('input', function () {
      app.presetKey = null;
      app.params.zeta = parseFloat(this.value);
      clearHeroPresetActive();
      recompute();
    });
    document.getElementById('slider-r').addEventListener('input', function () {
      setProbeRatio(parseFloat(this.value), 'slider');
    });

    // Theme toggle
    document.getElementById('btn-theme').addEventListener('click', function () {
      const dark = Theme.isDark();
      document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
      document.getElementById('btn-theme-label').textContent = dark ? 'Dark' : 'Light';
      updateFrfTypesTable();
      renderAllCanvases();
    });

    // Section 1: 1-DOF modes & playback
    document.querySelectorAll('#sdof-mode-btns button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#sdof-mode-btns button').forEach((b) => b.classList.remove('is-active'));
        this.classList.add('is-active');
        app.viz.sdof.setMode(this.getAttribute('data-mode'));
      });
    });

    let sdofPlaying = true;
    document.getElementById('btn-sdof-play').addEventListener('click', function () {
      sdofPlaying = !sdofPlaying;
      app.viz.sdof.setPlaying(sdofPlaying);
      this.textContent = sdofPlaying ? 'Pause' : 'Play';
    });
    document.getElementById('btn-sdof-reset').addEventListener('click', function () {
      app.viz.sdof.resetTime();
    });

    // Section 2: s-plane slice & 3D controls
    const sliderSigma = document.getElementById('slider-sigma');
    sliderSigma.addEventListener('input', function () {
      app.sigmaSlice = parseFloat(this.value);
      app.viz.splane.setSigmaSlice(app.sigmaSlice);
      updateSPlaneReadouts();
    });

    document.getElementById('btn-slice-zero').addEventListener('click', function () {
      app.sigmaSlice = 0.0;
      sliderSigma.value = '0';
      app.viz.splane.setSigmaSlice(0.0);
      updateSPlaneReadouts();
    });

    document.querySelectorAll('#splane-bottom-pills .pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#splane-bottom-pills .pill').forEach((b) => b.classList.remove('active'));
        this.classList.add('active');
        app.viz.splane.setBottomMode(this.getAttribute('data-bmode'));
      });
    });

    document.getElementById('btn-splane-orbit').addEventListener('click', function () {
      const on = app.viz.splane.toggleAutoRotate();
      this.textContent = on ? 'Pause orbit' : 'Auto-orbit 3D';
    });
    document.getElementById('btn-splane-reset').addEventListener('click', function () {
      app.viz.splane.resetCamera();
    });

    // Section 3: Convolution controls
    document.querySelectorAll('#conv-signal-pills .pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#conv-signal-pills .pill').forEach((b) => b.classList.remove('active'));
        this.classList.add('active');
        app.viz.conv.setSignalType(this.getAttribute('data-sig'));
      });
    });

    let convPlaying = false;
    document.getElementById('btn-conv-play').addEventListener('click', function () {
      convPlaying = !convPlaying;
      app.viz.conv.setPlaying(convPlaying);
      this.textContent = convPlaying ? 'Pause sweep' : 'Sweep t';
    });

    document.getElementById('slider-conv-t').addEventListener('input', function () {
      const frac = parseFloat(this.value);
      app.viz.conv.setTimeFrac(frac);
      const tMax = (5.5 * 2 * Math.PI) / app.sys.wn;
      document.getElementById('val-conv-t').textContent = 't = ' + M1.fmt(frac * tMax, 2) + ' s';
    });

    // Section 4: FRF anatomy controls
    document.querySelectorAll('#frf-scale-pills .pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#frf-scale-pills .pill').forEach((b) => b.classList.remove('active'));
        this.classList.add('active');
        app.viz.frf.setLogScale(this.getAttribute('data-scale') === 'log');
      });
    });
    document.querySelectorAll('#frf-right-pills .pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#frf-right-pills .pill').forEach((b) => b.classList.remove('active'));
        this.classList.add('active');
        app.viz.frf.setRightMode(this.getAttribute('data-rmode'));
      });
    });
    document.getElementById('chk-frf-asym').addEventListener('change', function () {
      app.viz.frf.setShowAsymptotes(this.checked);
    });

    // Section 5: Six FRFs controls
    document.querySelectorAll('#types-group-pills .pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#types-group-pills .pill').forEach((b) => b.classList.remove('active'));
        this.classList.add('active');
        const grp = this.getAttribute('data-group');
        app.viz.types.setViewGroup(grp);
        if (grp === 'direct') app.selectedFrfKey = 'mobility';
        else if (grp === 'reciprocal') app.selectedFrfKey = 'impedance';
        else app.selectedFrfKey = 'transmissibility';
        updateFrfTypesTable();
      });
    });
    document.getElementById('chk-types-asym').addEventListener('change', function () {
      app.viz.types.setShowAsymptotes(this.checked);
    });

    // Section 6: Code & citation tabs
    document.querySelectorAll('#code-lang-tabs [data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#code-lang-tabs [data-lang]').forEach((b) => b.classList.remove('is-active'));
        this.classList.add('is-active');
        app.codeLang = this.getAttribute('data-lang');
        updateCodeSnippet();
      });
    });

    document.getElementById('btn-copy-code').addEventListener('click', function () {
      copyText(document.getElementById('live-code-block').textContent, this, 'Copy');
    });

    document.querySelectorAll('#cite-format-tabs [data-cite]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#cite-format-tabs [data-cite]').forEach((b) => b.classList.remove('is-active'));
        this.classList.add('is-active');
        app.citeFormat = this.getAttribute('data-cite');
        updateCitation();
      });
    });
    document.getElementById('btn-copy-cite').addEventListener('click', function () {
      copyText(document.getElementById('cite-text-block').textContent, this, 'Copy citation');
    });
    updateCitation();

    // Window resize redraw
    let resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderAllCanvases, 60);
    });
  }

  function clearHeroPresetActive() {
    document.querySelectorAll('#preset-selector .pill').forEach((b) => b.classList.remove('active'));
  }

  function copyText(text, btn, defaultLabel) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        btn.textContent = 'Copied';
        setTimeout(() => (btn.textContent = defaultLabel), 1400);
      });
    }
  }

  function renderAllCanvases() {
    if (app.viz.sdof) app.viz.sdof.render();
    if (app.viz.splane) app.viz.splane.render();
    if (app.viz.conv) app.viz.conv.render();
    if (app.viz.frf) app.viz.frf.render();
    if (app.viz.types) app.viz.types.render();
  }

  function setupVisibilityAndScrollSpy() {
    const navLinks = document.querySelectorAll('.chapter-nav a');
    const allIds = ['sec-sdof', 'sec-splane', 'sec-conv', 'sec-frf', 'sec-types', 'sec-summary'];

    function updateNav() {
      const ref = window.scrollY + 130;
      let cur = allIds[0];
      for (let i = 0; i < allIds.length; i++) {
        const el = document.getElementById(allIds[i]);
        if (el && el.offsetTop <= ref) cur = allIds[i];
      }
      navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + cur));
    }

    let raf = null;
    window.addEventListener(
      'scroll',
      function () {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = null;
          updateNav();
        });
      },
      { passive: true }
    );
    updateNav();

    if (!('IntersectionObserver' in window)) return;
    const map = [
      { id: 'sec-sdof', viz: app.viz.sdof },
      { id: 'sec-splane', viz: app.viz.splane },
      { id: 'sec-conv', viz: app.viz.conv }
    ];
    const obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          const item = map.find((m) => m.id === entry.target.id);
          if (item && item.viz) item.viz.setVisible(entry.isIntersecting);
        });
      },
      { rootMargin: '120px 0px 120px 0px', threshold: 0.05 }
    );
    map.forEach(function (m) {
      const el = document.getElementById(m.id);
      if (el) obs.observe(el);
    });
  }

  function startLoop() {
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      if (app.viz.sdof) app.viz.sdof.step(dt);
      if (app.viz.splane) app.viz.splane.step(dt);
      if (app.viz.conv) app.viz.conv.step(dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
