/**
 * app.js
 * Central reactive controller wiring all 5 visualizations, KaTeX LaTeX typesetting
 * for all static prose & live dynamic matrices, floating parameter drawer,
 * theme toggle, code generator, and animation loop.
 */
(function () {
  'use strict';

  const M2 = window.VibLab.Math2D;
  const Sys = window.VibLab.Systems;
  const Theme = window.VibLab.Theme;

  const KATEX_DELIMITERS = [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
    { left: '\\(', right: '\\)', display: false },
    { left: '\\[', right: '\\]', display: true }
  ];

  // Global Application State
  const app = {
    sysKey: 'spring-pendulum',
    params: Object.assign({}, Sys.DEFINITIONS['spring-pendulum'].defaults),
    eigen: null,
    codeLang: 'matlab',
    lastMorphStage: -1,
    viz: {}
  };

  /* -----------------------------------------------------------
   * KaTeX Rendering Helpers (with graceful offline fallback)
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

  function bmatrixTex(mat, opts) {
    const o = opts || {};
    const digits = o.digits === undefined ? 2 : o.digits;
    const C = Theme.colors();
    const offColor = o.offColor || null;
    const zeroColor = o.zeroColor || null;

    function fmtCell(v, isOff) {
      const s = M2.fmt(v, digits);
      if (!isOff) return s;
      const isZero = Math.abs(v) < 0.015;
      if (zeroColor && isZero) return '\\textcolor{' + zeroColor + '}{\\mathbf{' + s + '}}';
      if (offColor && !isZero) return '\\textcolor{' + offColor + '}{\\mathbf{' + s + '}}';
      return s;
    }

    return (
      '\\begin{bmatrix} ' +
      fmtCell(mat[0][0], false) +
      ' & ' +
      fmtCell(mat[0][1], true) +
      ' \\\\ ' +
      fmtCell(mat[1][0], true) +
      ' & ' +
      fmtCell(mat[1][1], false) +
      ' \\end{bmatrix}'
    );
  }

  /* -----------------------------------------------------------
   * Recompute Eigenproblem & Sync Every UI Element
   * --------------------------------------------------------- */
  function recompute(keepHeroPreset) {
    const def = Sys.DEFINITIONS[app.sysKey];
    const { M, K } = def.buildMatrices(app.params);
    app.eigen = M2.solveGeneralizedEigen(M, K);

    updateTextAndMatrices();

    if (app.viz.hero) app.viz.hero.setSystem(app.sysKey, app.params, app.eigen, keepHeroPreset !== false);
    if (app.viz.energy) app.viz.energy.setEigen(app.eigen);
    if (app.viz.tang) app.viz.tang.setEigen(app.eigen);
    if (app.viz.morph) app.viz.morph.setEigen(app.eigen);
    if (app.viz.modal) app.viz.modal.setSystem(app.sysKey, app.params, app.eigen);
  }

  function updateTextAndMatrices() {
    const def = Sys.DEFINITIONS[app.sysKey];
    const eig = app.eigen;
    const C = Theme.colors();

    // System description with LaTeX
    const descEl = document.getElementById('system-desc-text');
    descEl.textContent = def.description;
    typesetElement(descEl);

    document.getElementById('drawer-sys-title').textContent = def.name + ' Parameters';

    // Kinetic & Potential Energy LaTeX lines
    const energyEl = document.getElementById('energy-formulas-live');
    energyEl.innerHTML = '<div class="c-mass"></div><div class="c-stiff"></div>';
    renderTex(energyEl.children[0], def.energyTexT, false);
    renderTex(energyEl.children[1], def.energyTexV, false);

    // Live Section 1 Matrices: M, K, and M^-1 K
    renderTex(
      document.getElementById('live-mat-M'),
      '\\mathbf{M} = ' + bmatrixTex(eig.M, { digits: 2, offColor: C.mass }),
      false
    );
    renderTex(
      document.getElementById('live-mat-K'),
      '\\mathbf{K} = ' + bmatrixTex(eig.K, { digits: 2, offColor: C.stiff }),
      false
    );
    renderTex(
      document.getElementById('live-mat-MK'),
      '\\mathbf{M}^{-1}\\mathbf{K} = ' + bmatrixTex(eig.A, { digits: 2 }),
      false
    );

    // Coupling callout explanation (typeset with KaTeX!)
    const mCoupled = Math.abs(eig.M[0][1]) > 1e-4;
    const kCoupled = Math.abs(eig.K[0][1]) > 1e-4;
    const isAsym = Math.abs(eig.A[0][1] - eig.A[1][0]) > 0.05;
    let msg = '';
    if (mCoupled && kCoupled) {
      msg =
        '<strong>Full dynamic and static coupling.</strong> Both <span class="c-mass">$\\mathbf{M}$</span> and <span class="c-stiff">$\\mathbf{K}$</span> have non-zero off-diagonal entries. ';
    } else if (mCoupled) {
      msg =
        '<strong>Inertial (dynamic) coupling.</strong> <span class="c-mass">$\\mathbf{M}$</span> is non-diagonal while <span class="c-stiff">$\\mathbf{K}$</span> is diagonal. ';
    } else if (kCoupled) {
      msg =
        '<strong>Elastic (static) coupling.</strong> <span class="c-mass">$\\mathbf{M}$</span> is diagonal while <span class="c-stiff">$\\mathbf{K}$</span> has off-diagonal spring coupling. ';
    } else {
      msg = '<strong>Uncoupled system.</strong> Both $\\mathbf{M}$ and $\\mathbf{K}$ are diagonal. ';
    }
    if (isAsym) {
      msg +=
        'Because $\\mathbf{M}^{-1}\\mathbf{K}$ is not symmetric ($' +
        M2.fmt(eig.A[0][1], 2) +
        ' \\neq ' +
        M2.fmt(eig.A[1][0], 2) +
        '$), its eigenvectors meet at <strong>$' +
        eig.modeAngleDeg.toFixed(1) +
        '^\\circ$</strong> rather than $90^\\circ$.';
    } else {
      msg += 'Mode angle $\\angle(\\mathbf{u}_1, \\mathbf{u}_2) = ' + eig.modeAngleDeg.toFixed(1) + '^\\circ$.';
    }
    const calloutEl = document.getElementById('coupling-callout');
    calloutEl.innerHTML = msg;
    typesetElement(calloutEl);

    // Mode KPIs rendered in LaTeX (using upright sans-serif transpose)
    renderTex(document.getElementById('kpi-w1'), '\\omega_1 = ' + M2.fmt(eig.omegas[0], 2) + '\\;\\text{rad/s}', false);
    renderTex(
      document.getElementById('kpi-f1'),
      'f_1 = ' + M2.fmt(eig.freqsHz[0], 2) + '\\;\\text{Hz},\\; \\lambda_1 = ' + M2.fmt(eig.lambdas[0], 2),
      false
    );
    renderTex(
      document.getElementById('kpi-u1'),
      '\\mathbf{u}_1 = [' + M2.fmt(eig.u1[0], 2) + ',\\; ' + M2.fmt(eig.u1[1], 2) + ']^{\\mathsf{T}}',
      false
    );

    renderTex(document.getElementById('kpi-w2'), '\\omega_2 = ' + M2.fmt(eig.omegas[1], 2) + '\\;\\text{rad/s}', false);
    renderTex(
      document.getElementById('kpi-f2'),
      'f_2 = ' + M2.fmt(eig.freqsHz[1], 2) + '\\;\\text{Hz},\\; \\lambda_2 = ' + M2.fmt(eig.lambdas[1], 2),
      false
    );
    renderTex(
      document.getElementById('kpi-u2'),
      '\\mathbf{u}_2 = [' + M2.fmt(eig.u2[0], 2) + ',\\; ' + M2.fmt(eig.u2[1], 2) + ']^{\\mathsf{T}}',
      false
    );

    // Section 4: K_tilde = M^(-1/2) K M^(-1/2) and Modal Factorization Phi = M^(-1/2) P
    document.getElementById('morph-m-ortho').textContent = M2.fmt(eig.mOrtho, 3);
    document.getElementById('morph-k-ortho').textContent = M2.fmt(eig.kOrtho, 3);

    renderTex(
      document.getElementById('live-mat-KTilde'),
      '\\tilde{\\mathbf{K}} = \\mathbf{M}^{-1/2}\\mathbf{K}\\mathbf{M}^{-1/2} = ' +
        bmatrixTex(eig.KTilde, { digits: 2, offColor: C.stiff }),
      false
    );

    renderTex(
      document.getElementById('live-mat-PhiFactor'),
      '\\mathbf{\\Phi} = ' +
        bmatrixTex(eig.Phi, { digits: 2 }) +
        ' = \\underbrace{' +
        bmatrixTex(eig.MInvHalf, { digits: 2 }) +
        '}_{\\mathbf{M}^{-1/2}} \\underbrace{' +
        bmatrixTex(eig.P, { digits: 2 }) +
        '}_{\\mathbf{P}}',
      false
    );

    // Section 6 Summary Matrices
    renderTex(
      document.getElementById('summary-mat-Phi'),
      '\\mathbf{\\Phi} = [\\mathbf{u}_1\\;\\mathbf{u}_2] = ' + bmatrixTex(eig.Phi, { digits: 3 }),
      false
    );
    renderTex(
      document.getElementById('summary-mat-Lam'),
      '\\mathbf{\\Lambda} = \\mathbf{\\Phi}^{\\mathsf{T}}\\mathbf{K}\\mathbf{\\Phi} = ' +
        bmatrixTex(
          [
            [eig.lambdas[0], 0],
            [0, eig.lambdas[1]]
          ],
          { digits: 2, zeroColor: C.mode1 }
        ),
      false
    );

    updateCodeSnippet();
  }

  /* -----------------------------------------------------------
   * Live MATLAB & Python (SciPy) Verification Snippet
   * --------------------------------------------------------- */
  function updateCodeSnippet() {
    const eig = app.eigen;
    const f = (v) => M2.fmt(v, 3);
    const M = eig.M;
    const K = eig.K;
    let code = '';

    if (app.codeLang === 'matlab') {
      code = [
        '% Current 2-DOF System (' + Sys.DEFINITIONS[app.sysKey].name + ')',
        'M = [' + f(M[0][0]) + ', ' + f(M[0][1]) + '; ' + f(M[1][0]) + ', ' + f(M[1][1]) + '];',
        'K = [' + f(K[0][0]) + ', ' + f(K[0][1]) + '; ' + f(K[1][0]) + ', ' + f(K[1][1]) + '];',
        '',
        '% Symmetric mass-weighted stiffness K_tilde = M^(-1/2) * K * M^(-1/2)',
        'M_inv_half = inv(sqrtm(M));',
        'K_tilde = M_inv_half * K * M_inv_half;   % symmetric!',
        '[P, Lambda] = eig(K_tilde);              % orthogonal P (P\'*P = I)',
        '[lam, idx] = sort(diag(Lambda));',
        'P = P(:, idx);',
        'omega = sqrt(lam);                       % [' + M2.fmt(eig.omegas[0], 3) + '; ' + M2.fmt(eig.omegas[1], 3) + '] rad/s',
        '',
        '% Modal matrix relating q = Phi * eta to K_tilde:',
        'Phi = M_inv_half * P;                    % equals mass-normalized eig(K, M)',
        'M_modal = Phi\' * M * Phi                % -> eye(2)',
        'K_modal = Phi\' * K * Phi                % -> diag([' + M2.fmt(eig.lambdas[0], 2) + ', ' + M2.fmt(eig.lambdas[1], 2) + '])'
      ].join('\n');
    } else {
      code = [
        '# Current 2-DOF System (' + Sys.DEFINITIONS[app.sysKey].name + ')',
        'import numpy as np',
        'from scipy.linalg import eigh, fractional_matrix_power',
        '',
        'M = np.array([[' + f(M[0][0]) + ', ' + f(M[0][1]) + '], [' + f(M[1][0]) + ', ' + f(M[1][1]) + ']])',
        'K = np.array([[' + f(K[0][0]) + ', ' + f(K[0][1]) + '], [' + f(K[1][0]) + ', ' + f(K[1][1]) + ']])',
        '',
        '# Symmetric mass-weighted stiffness K_tilde = M^(-1/2) K M^(-1/2)',
        'M_inv_half = fractional_matrix_power(M, -0.5)',
        'K_tilde = M_inv_half @ K @ M_inv_half',
        'lam, P = eigh(K_tilde)       # orthogonal P: P.T @ P = I',
        'omega = np.sqrt(lam)         # [' + M2.fmt(eig.omegas[0], 3) + ', ' + M2.fmt(eig.omegas[1], 3) + '] rad/s',
        '',
        '# Exact modal matrix Phi = M^(-1/2) @ P (matches eigh(K, M))',
        'Phi = M_inv_half @ P',
        'print("Phi.T @ M @ Phi =\\n", np.round(Phi.T @ M @ Phi, 4))  # Identity I',
        'print("Phi.T @ K @ Phi =\\n", np.round(Phi.T @ K @ Phi, 4))  # diag(w1^2, w2^2)'
      ].join('\n');
    }

    document.getElementById('live-code-block').textContent = code;
  }

  /* -----------------------------------------------------------
   * Build Parameter Sliders Drawer for Active System
   * --------------------------------------------------------- */
  function buildParamDrawer() {
    const def = Sys.DEFINITIONS[app.sysKey];
    const container = document.getElementById('param-sliders-container');
    const presetsEl = document.getElementById('param-presets-container');
    container.innerHTML = '';
    presetsEl.innerHTML = '';

    def.params.forEach(function (p) {
      const row = document.createElement('div');
      row.className = 'param-row';
      const head = document.createElement('div');
      head.className = 'param-row-head';
      const lbl = document.createElement('span');
      lbl.textContent = p.label;
      const valSpan = document.createElement('span');
      valSpan.className = 'param-val';
      valSpan.textContent = app.params[p.key] + ' ' + p.unit;

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = p.min;
      slider.max = p.max;
      slider.step = p.step;
      slider.value = app.params[p.key];
      if (p.key.startsWith('k')) slider.className = 'range-stiff';

      slider.addEventListener('input', function () {
        app.params[p.key] = parseFloat(slider.value);
        valSpan.textContent = app.params[p.key] + ' ' + p.unit;
        recompute(true);
      });

      head.appendChild(lbl);
      head.appendChild(valSpan);
      row.appendChild(head);
      row.appendChild(slider);
      container.appendChild(row);
    });

    def.presets.forEach(function (pr) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm';
      btn.textContent = pr.label;
      btn.addEventListener('click', function () {
        app.params = Object.assign({}, pr.values);
        buildParamDrawer();
        recompute(true);
      });
      presetsEl.appendChild(btn);
    });

    typesetElement(container);
    typesetElement(presetsEl);
  }

  /* -----------------------------------------------------------
   * Morph Narration & Live LaTeX Matrix Updater
   * --------------------------------------------------------- */
  const STAGE_NARRATION = [
    {
      title: 'Stage 0: Coupled physical space $(q_1, q_2)$',
      body:
        'The mass ellipse (blue) and stiffness ellipse (orange) sit in physical space $\\mathbf{q}$. Because $\\mathbf{M}$ is non-diagonal or unequal, the physical normal modes $\\mathbf{u}_1$ and $\\mathbf{u}_2$ are not perpendicular in Euclidean angles; instead, they are $\\mathbf{M}$-orthogonal ($\\mathbf{u}_1^{\\mathsf{T}}\\mathbf{M}\\mathbf{u}_2 = 0$) and $\\mathbf{K}$-orthogonal ($\\mathbf{u}_1^{\\mathsf{T}}\\mathbf{K}\\mathbf{u}_2 = 0$).'
    },
    {
      title: 'Stage 1: Mass-weighted space $\\mathbf{z} = \\mathbf{M}^{1/2}\\mathbf{q}$ (exact $\\tilde{\\mathbf{K}}$)',
      body:
        'Applying the symmetric square root $\\mathbf{M}^{1/2}$ stretches space along the principal axes of $\\mathbf{M}$ until the mass ellipse becomes a unit circle ($\\mathbf{M} \\to \\mathbf{I}$). Simultaneously, $\\mathbf{K}$ transforms into the symmetric matrix $\\tilde{\\mathbf{K}} = \\mathbf{M}^{-1/2}\\mathbf{K}\\mathbf{M}^{-1/2}$, and $\\mathbf{u}_1, \\mathbf{u}_2$ map onto its perpendicular eigenvectors $\\mathbf{p}_1 \\perp \\mathbf{p}_2$ ($90.0^\\circ$).'
    },
    {
      title: 'Stage 2: Modal space $\\boldsymbol{\\eta} = \\mathbf{P}^{\\mathsf{T}}\\mathbf{z} = \\mathbf{\\Phi}^{-1}\\mathbf{q}$',
      body:
        'Because the mass surface is now a circle ($\\mathbf{I}$), rotating by $\\mathbf{P}^{\\mathsf{T}}$ leaves $\\mathbf{I}$ unchanged while aligning the axes of $\\tilde{\\mathbf{K}}$ onto $(\\eta_1, \\eta_2)$. The combined coordinate change is $\\mathbf{q} = \\mathbf{M}^{-1/2}\\mathbf{P}\\boldsymbol{\\eta} = \\mathbf{\\Phi}\\boldsymbol{\\eta}$, giving $\\mathbf{\\Phi}^{\\mathsf{T}}\\mathbf{M}\\mathbf{\\Phi} = \\mathbf{I}$ and $\\mathbf{\\Phi}^{\\mathsf{T}}\\mathbf{K}\\mathbf{\\Phi} = \\operatorname{diag}(\\omega_1^2, \\omega_2^2)$.'
    }
  ];

  function updateMorphUI(ms, t) {
    const C = Theme.colors();
    renderTex(
      document.getElementById('morph-mat-M'),
      '\\mathbf{M}(t) = ' + bmatrixTex(ms.Mt, { digits: 2, offColor: C.mass, zeroColor: C.mode1 }),
      false
    );
    renderTex(
      document.getElementById('morph-mat-K'),
      '\\mathbf{K}(t) = ' + bmatrixTex(ms.Kt, { digits: 2, offColor: C.stiff, zeroColor: C.mode1 }),
      false
    );

    document.getElementById('morph-angle-now').textContent = ms.angleDeg.toFixed(1) + '°';
    document.getElementById('morph-t-readout').textContent = t.toFixed(2);

    const scrubber = document.getElementById('morph-scrubber');
    if (document.activeElement !== scrubber) {
      scrubber.value = t.toFixed(3);
    }

    const activeIdx = t < 0.5 ? 0 : t < 1.5 ? 1 : 2;
    if (activeIdx !== app.lastMorphStage) {
      app.lastMorphStage = activeIdx;
      document.querySelectorAll('#morph-stage-stepper .stage-btn').forEach(function (btn) {
        btn.classList.toggle('active', parseInt(btn.dataset.stage, 10) === activeIdx);
      });
      const titleEl = document.getElementById('morph-narration-title');
      const bodyEl = document.getElementById('morph-narration-body');
      titleEl.innerHTML = STAGE_NARRATION[activeIdx].title;
      bodyEl.innerHTML = STAGE_NARRATION[activeIdx].body;
      typesetElement(titleEl);
      typesetElement(bodyEl);
    }
  }

  /* -----------------------------------------------------------
   * Initialize All Visualizations & Controls
   * --------------------------------------------------------- */
  function init() {
    // Typeset all static LaTeX across the document first
    typesetElement(document.body);

    const initDef = Sys.DEFINITIONS[app.sysKey];
    const { M, K } = initDef.buildMatrices(app.params);
    app.eigen = M2.solveGeneralizedEigen(M, K);

    // 1. Hero Viz
    app.viz.hero = window.VibLab.HeroViz.create({
      simCanvas: document.getElementById('hero-sim-canvas'),
      waveCanvas: document.getElementById('hero-wave-canvas'),
      sysKey: app.sysKey,
      params: app.params,
      eigen: app.eigen,
      onPresetChange: function (p) {
        document.querySelectorAll('#hero-preset-btns [data-hero-preset]').forEach(function (b) {
          b.classList.toggle('is-active', b.dataset.heroPreset === p);
        });
      }
    });

    // 2. 3D + 2D Energy Surfaces Viz
    app.viz.energy = window.VibLab.Energy3DViz.create({
      canvas3d: document.getElementById('energy-3d-canvas'),
      canvas2d: document.getElementById('energy-2d-canvas'),
      eigen: app.eigen,
      onOrbitChange: function () {
        document.getElementById('btn-energy-orbit').textContent = 'Orbit';
      }
    });

    // 3. Tangency & Rayleigh Quotient Viz
    const lamSlider = document.getElementById('lambda-slider');
    const lamReadout = document.getElementById('lambda-readout');
    const btnTangSweep = document.getElementById('btn-tang-sweep');
    const btnRayPlay = document.getElementById('btn-ray-play');

    function updateTangButtons() {
      const st = app.viz.tang.getState();
      btnTangSweep.innerHTML = st.sweepPlaying ? 'Stop sweep' : 'Sweep $\\lambda$';
      btnRayPlay.innerHTML = st.anglePlaying ? 'Pause sweep' : 'Sweep $\\mathbf{u}$';
      typesetElement(btnTangSweep);
      typesetElement(btnRayPlay);
    }

    app.viz.tang = window.VibLab.TangencyViz.create({
      tangCanvas: document.getElementById('tangency-canvas'),
      rayCanvas: document.getElementById('rayleigh-canvas'),
      eigen: app.eigen,
      onLambdaChange: function (val, norm) {
        lamReadout.textContent = M2.fmt(val, 2);
        if (document.activeElement !== lamSlider) {
          lamSlider.value = norm.toFixed(3);
        }
      },
      onPlayStateChange: updateTangButtons
    });

    // 4. Simultaneous Diagonalization Morph & K_tilde Ellipse Viz
    app.viz.morph = window.VibLab.MorphViz.create({
      canvas: document.getElementById('morph-canvas'),
      kTildeCanvas: document.getElementById('ktilde-canvas'),
      eigen: app.eigen,
      onFrame: updateMorphUI,
      onPlayChange: function (isPlaying) {
        document.getElementById('btn-morph-play').textContent = isPlaying ? 'Pause' : 'Play morph';
      }
    });

    // 5. Modal Superposition Viz
    app.viz.modal = window.VibLab.ModalViz.create({
      mode1Canvas: document.getElementById('modal-m1-canvas'),
      mode2Canvas: document.getElementById('modal-m2-canvas'),
      totalCanvas: document.getElementById('modal-total-canvas'),
      physTrajCanvas: document.getElementById('modal-phys-traj'),
      modTrajCanvas: document.getElementById('modal-mod-traj'),
      sysKey: app.sysKey,
      params: app.params,
      eigen: app.eigen,
      onParamsSync: function (A1, A2, phi2) {
        document.getElementById('slider-A1').value = A1.toFixed(2);
        document.getElementById('val-A1').textContent = A1.toFixed(2);
        document.getElementById('slider-A2').value = A2.toFixed(2);
        document.getElementById('val-A2').textContent = A2.toFixed(2);
        const deg = Math.round(((phi2 * 180) / Math.PI + 360) % 360);
        document.getElementById('slider-phi2').value = deg;
        document.getElementById('val-phi2').textContent = deg + '°';
      }
    });

    buildParamDrawer();
    updateTextAndMatrices();
    wireEvents();
    setupVisibilityObserver();
    startLoop();
  }

  /* -----------------------------------------------------------
   * Wire All Interactive Controls
   * --------------------------------------------------------- */
  function wireEvents() {
    // System Selector Pills
    document.querySelectorAll('#system-selector .pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const key = btn.dataset.sys;
        if (key === app.sysKey) return;
        app.sysKey = key;
        app.params = Object.assign({}, Sys.DEFINITIONS[key].defaults);
        document.querySelectorAll('#system-selector .pill').forEach(function (b) {
          b.classList.toggle('active', b.dataset.sys === key);
        });
        buildParamDrawer();
        recompute(true);
      });
    });

    // Floating Parameter Drawer
    const drawer = document.getElementById('param-drawer');
    function toggleDrawer(force) {
      const open = force !== undefined ? force : !drawer.classList.contains('open');
      drawer.classList.toggle('open', open);
    }
    document.getElementById('btn-params').addEventListener('click', () => toggleDrawer());
    document.getElementById('btn-hero-open-params').addEventListener('click', () => toggleDrawer(true));
    document.getElementById('btn-close-drawer').addEventListener('click', () => toggleDrawer(false));

    // Theme Toggle (re-renders canvases AND color-coded LaTeX matrices)
    const btnTheme = document.getElementById('btn-theme');
    const btnThemeLbl = document.getElementById('btn-theme-label');
    btnTheme.addEventListener('click', function () {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
      if (btnThemeLbl) btnThemeLbl.textContent = isDark ? 'Dark' : 'Light';
      updateTextAndMatrices();
      app.viz.energy.render();
      app.viz.tang.render();
      app.viz.morph.render();
    });

    // Hero Preset & Play Controls
    document.querySelectorAll('#hero-preset-btns [data-hero-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const p = btn.dataset.heroPreset;
        app.viz.hero.setPreset(p);
        document.querySelectorAll('#hero-preset-btns [data-hero-preset]').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        document.getElementById('btn-hero-play').textContent = 'Pause';
      });
    });

    document.getElementById('btn-hero-play').addEventListener('click', function () {
      const playing = app.viz.hero.togglePlaying();
      this.textContent = playing ? 'Pause' : 'Play';
    });

    // Section 2: Energy 3D/2D Controls
    document.querySelectorAll('#energy-view-pills .pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#energy-view-pills .pill').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        app.viz.energy.setViewMode(btn.dataset.eview);
      });
    });

    document.getElementById('energy-slice-slider').addEventListener('input', function () {
      app.viz.energy.setEnergyLevel(parseFloat(this.value));
    });

    document.getElementById('btn-energy-orbit').addEventListener('click', function () {
      const rotating = app.viz.energy.toggleAutoRotate();
      this.textContent = rotating ? 'Pause orbit' : 'Orbit';
    });

    // Section 3: Tangency & Rayleigh Controls
    document.getElementById('lambda-slider').addEventListener('input', function () {
      app.viz.tang.setLambdaNorm(parseFloat(this.value));
    });
    document.getElementById('btn-tang-sweep').addEventListener('click', function () {
      app.viz.tang.toggleSweep();
    });
    document.getElementById('btn-snap-m1').addEventListener('click', () => app.viz.tang.snapToMode(0));
    document.getElementById('btn-snap-m2').addEventListener('click', () => app.viz.tang.snapToMode(1));
    document.getElementById('btn-ray-play').addEventListener('click', () => app.viz.tang.toggleAnglePlay());
    document.getElementById('btn-ray-m1').addEventListener('click', () => app.viz.tang.snapToMode(0));
    document.getElementById('btn-ray-m2').addEventListener('click', () => app.viz.tang.snapToMode(1));

    // Section 4: Simultaneous Diagonalization Morph Controls
    document.querySelectorAll('#morph-stage-stepper .stage-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        app.viz.morph.animateToStage(parseInt(btn.dataset.stage, 10));
      });
    });

    document.getElementById('morph-scrubber').addEventListener('input', function () {
      app.viz.morph.setT(parseFloat(this.value), true);
    });

    document.getElementById('btn-morph-play').addEventListener('click', function () {
      app.viz.morph.togglePlay();
    });

    document.getElementById('btn-morph-reverse').addEventListener('click', function () {
      app.viz.morph.playReverse();
    });

    document.getElementById('btn-morph-reset').addEventListener('click', function () {
      app.viz.morph.setT(0, true);
    });

    document.getElementById('chk-morph-grid').addEventListener('change', function () {
      app.viz.morph.setOptions({ showDeformedGrid: this.checked });
    });

    document.getElementById('chk-morph-para').addEventListener('change', function () {
      app.viz.morph.setOptions({ showParallelogram: this.checked });
    });

    // Section 5: Modal Superposition Controls
    const sA1 = document.getElementById('slider-A1');
    const sA2 = document.getElementById('slider-A2');
    const sPhi = document.getElementById('slider-phi2');

    sA1.addEventListener('input', function () {
      const v = parseFloat(this.value);
      document.getElementById('val-A1').textContent = v.toFixed(2);
      app.viz.modal.setAmplitudes(v, undefined, undefined);
    });
    sA2.addEventListener('input', function () {
      const v = parseFloat(this.value);
      document.getElementById('val-A2').textContent = v.toFixed(2);
      app.viz.modal.setAmplitudes(undefined, v, undefined);
    });
    sPhi.addEventListener('input', function () {
      const deg = parseFloat(this.value);
      document.getElementById('val-phi2').textContent = deg + '°';
      app.viz.modal.setAmplitudes(undefined, undefined, (deg * Math.PI) / 180);
    });

    document.querySelectorAll('[data-modal-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        app.viz.modal.setPreset(btn.dataset.modalPreset);
        document.getElementById('btn-modal-play').textContent = 'Pause';
      });
    });

    document.getElementById('btn-modal-play').addEventListener('click', function () {
      const playing = app.viz.modal.togglePlay();
      this.textContent = playing ? 'Pause' : 'Play';
    });

    // Section 6: Code Tabs & Copy
    document.querySelectorAll('#code-lang-tabs [data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        app.codeLang = btn.dataset.lang;
        document.querySelectorAll('#code-lang-tabs [data-lang]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        updateCodeSnippet();
      });
    });

    document.getElementById('btn-copy-code').addEventListener('click', function () {
      const text = document.getElementById('live-code-block').textContent;
      const btn = this;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = 'Copied';
          setTimeout(() => (btn.textContent = 'Copy'), 1500);
        });
      }
    });

    // Citation & Copyright block
    const citeState = { format: 'apa' };
    const nowYear = new Date().getFullYear();
    const yearEl = document.getElementById('copyright-year');
    if (yearEl) yearEl.textContent = String(nowYear);

    function getPublicUrl() {
      const href = window.location && window.location.href ? window.location.href : '';
      if (href.startsWith('http') && !href.includes('127.0.0.1') && !href.includes('localhost')) {
        return href.split('#')[0];
      }
      return '';
    }

    function updateCitation() {
      const url = getPublicUrl();
      const title =
        '2-DOF Oscillations & Modal Geometry: From Coupled Energy Ellipses to Linear Normal Modes';
      const titleBib =
        '2-DOF Oscillations and Modal Geometry: From Coupled Energy Ellipses to Linear Normal Modes';
      const el = document.getElementById('cite-text-block');
      if (!el) return;

      let txt = '';
      if (citeState.format === 'apa') {
        txt =
          'Chelidze, D. (' +
          nowYear +
          '). ' +
          title +
          ' [Interactive web tutorial]. Nonlinear Dynamics Laboratory, University of Rhode Island.' +
          (url ? ' ' + url : '');
      } else if (citeState.format === 'ieee') {
        txt =
          'D. Chelidze, "' +
          title +
          '," Interactive Web Tutorial, Nonlinear Dynamics Laboratory, University of Rhode Island, ' +
          nowYear +
          '.' +
          (url ? ' [Online]. Available: ' + url : '');
      } else {
        const lines = [
          '@misc{chelidze' + nowYear + '_2dof_modal_geometry,',
          '  author       = {Chelidze, David},',
          '  title        = {' + titleBib + '},',
          '  howpublished = {Interactive Web Tutorial, Nonlinear Dynamics Laboratory, University of Rhode Island},',
          '  year         = {' + nowYear + '},'
        ];
        if (url) lines.push('  url          = {' + url + '},');
        lines.push('  note         = {Vibrations and Dynamics Course Material}');
        lines.push('}');
        txt = lines.join('\n');
      }
      el.textContent = txt;
    }

    document.querySelectorAll('#cite-format-tabs [data-cite]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        citeState.format = btn.dataset.cite;
        document.querySelectorAll('#cite-format-tabs [data-cite]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        updateCitation();
      });
    });

    const btnCopyCite = document.getElementById('btn-copy-cite');
    if (btnCopyCite) {
      btnCopyCite.addEventListener('click', function () {
        const text = document.getElementById('cite-text-block').textContent;
        const btn = this;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            btn.textContent = 'Copied';
            setTimeout(() => (btn.textContent = 'Copy citation'), 1500);
          });
        }
      });
    }
    updateCitation();

    // Re-render canvases cleanly on window resize
    let resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        app.viz.energy.render();
        app.viz.tang.render();
        app.viz.morph.render();
      }, 60);
    });
  }

  /* -----------------------------------------------------------
   * Visibility Observer & Accurate Scroll-Spy
   * --------------------------------------------------------- */
  function setupVisibilityObserver() {
    if (!('IntersectionObserver' in window)) return;
    const map = [
      { id: 'sec-system', viz: app.viz.hero },
      { id: 'sec-energy', viz: app.viz.energy },
      { id: 'sec-tangency', viz: app.viz.tang },
      { id: 'sec-morph', viz: app.viz.morph },
      { id: 'sec-modal', viz: app.viz.modal }
    ];

    const navLinks = document.querySelectorAll('.chapter-nav a');
    const allSectionIds = ['sec-system', 'sec-energy', 'sec-tangency', 'sec-morph', 'sec-modal', 'sec-summary'];

    function updateActiveNav() {
      const scrollRef = window.scrollY + 130;
      let currentId = allSectionIds[0];
      for (let i = 0; i < allSectionIds.length; i++) {
        const el = document.getElementById(allSectionIds[i]);
        if (el && el.offsetTop <= scrollRef) {
          currentId = allSectionIds[i];
        }
      }
      navLinks.forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('href') === '#' + currentId);
      });
    }

    let scrollRaf = null;
    window.addEventListener(
      'scroll',
      function () {
        if (scrollRaf) return;
        scrollRaf = requestAnimationFrame(function () {
          scrollRaf = null;
          updateActiveNav();
        });
      },
      { passive: true }
    );
    updateActiveNav();

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          const item = map.find((m) => m.id === entry.target.id);
          if (item && item.viz) {
            item.viz.setVisible(entry.isIntersecting);
          }
        });
      },
      { rootMargin: '120px 0px 120px 0px', threshold: 0.05 }
    );

    map.forEach(function (m) {
      const el = document.getElementById(m.id);
      if (el) observer.observe(el);
    });
  }

  /* -----------------------------------------------------------
   * Unified 60fps Animation Loop
   * --------------------------------------------------------- */
  function startLoop() {
    let lastTime = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      app.viz.hero.step(dt);
      app.viz.energy.step(dt);
      app.viz.tang.step(dt);
      app.viz.morph.step(dt);
      app.viz.modal.step(dt);

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
