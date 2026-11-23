/**
 * app.js
 * Central reactive controller for Module 02:
 * Equilibrium Stability, Eigenvalues, and Phase Portraits of 1-DOF Systems.
 * Coordinates KaTeX typesetting, (tau, Delta) state synchronization across all five
 * interactive visualizations, classification table, MATLAB/Python verification scripts,
 * citation widget, theme toggle, scroll-spy, and 60fps animation loop.
 */
(function () {
  'use strict';

  const M = window.VibLab.MathStab;
  const Theme = window.VibLab.Theme;

  const KATEX_DELIMITERS = [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
    { left: '\\(', right: '\\)', display: false },
    { left: '\\[', right: '\\]', display: true }
  ];

  const app = {
    presetKey: 'stable_spiral',
    tau: -0.8,
    delta: 2.25,
    starMode: false,
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
   * Formatting Eigenvalue & Matrix TeX
   * --------------------------------------------------------- */
  function formatEigenTex(sys) {
    if (sys.eigType === 'complex') {
      if (Math.abs(sys.l1.re) < M.EPS) {
        return '\\lambda_{1,2} = \\pm ' + M.fmt(Math.abs(sys.l1.im), 2) + '\\mathrm{i}';
      }
      return (
        '\\lambda_{1,2} = ' +
        M.fmt(sys.l1.re, 2) +
        ' \\pm ' +
        M.fmt(Math.abs(sys.l1.im), 2) +
        '\\mathrm{i}'
      );
    }
    if (sys.eigType === 'real_repeated') {
      return '\\lambda_{1,2} = ' + M.fmt(sys.l1.re, 2) + '\\;(\\text{repeated})';
    }
    return '\\lambda_1 = ' + M.fmt(sys.l1.re, 2) + ',\\; \\lambda_2 = ' + M.fmt(sys.l2.re, 2);
  }

  function formatCharPolyTex(sys) {
    const tSign = sys.tau >= 0 ? '- ' + M.fmt(sys.tau, 2) : '+ ' + M.fmt(-sys.tau, 2);
    const dSign = sys.delta >= 0 ? '+ ' + M.fmt(sys.delta, 2) : '- ' + M.fmt(-sys.delta, 2);
    return '\\lambda^2 ' + tSign + '\\lambda ' + dSign + ' = 0';
  }

  /* -----------------------------------------------------------
   * Recompute Linear State & Sync All Views
   * --------------------------------------------------------- */
  function recompute(fromSweep) {
    app.sys = M.analyzeLinear(app.tau, app.delta, { star: app.starMode });
    if (!app.sys.isStar) {
      app.starMode = false;
    }

    syncSliders();
    updateHeroReadout();
    updateSection1Readouts();
    updateSection2Readouts();
    updateSection3Readouts();
    updateClassificationHighlight();
    updateCodeSnippet();

    if (app.viz.mech) app.viz.mech.setSystem(app.sys);
    if (app.viz.eigen) app.viz.eigen.setSystem(app.sys);
    if (app.viz.trdet) app.viz.trdet.setSystem(app.sys);
    if (app.viz.geom) {
      app.viz.geom.setSystem(app.sys);
      const tSlider = document.getElementById('slider-geom-t');
      if (tSlider) tSlider.max = String(app.viz.geom.getTimeCap());
    }

    if (!fromSweep) {
      syncPresetButtons();
    }
  }

  function syncSliders() {
    const sTau = document.getElementById('slider-tau');
    const sDel = document.getElementById('slider-delta');
    if (sTau) sTau.value = app.tau;
    if (sDel) sDel.value = app.delta;

    const vTau = document.getElementById('val-tau');
    const vDel = document.getElementById('val-delta');
    if (vTau) {
      vTau.textContent =
        M.fmt(app.tau, 2) + ' s⁻¹ (c/m = ' + M.fmt(-app.tau, 2) + ')';
    }
    if (vDel) {
      vDel.textContent =
        M.fmt(app.delta, 2) + ' s⁻² (k/m = ' + M.fmt(app.delta, 2) + ')';
    }
  }

  function syncPresetButtons() {
    document.querySelectorAll('#preset-selector .pill').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.preset === app.presetKey);
    });
  }

  function updateHeroReadout() {
    const sys = app.sys;
    const preset = M.PRESETS[app.presetKey];
    const descEl = document.getElementById('preset-desc-text');
    if (!descEl) return;
    if (preset) {
      descEl.textContent = preset.description;
    } else {
      descEl.textContent =
        'Custom operating point: $\\tau = ' +
        M.fmt(sys.tau, 2) +
        '\\;\\text{s}^{-1}$, $\\Delta = ' +
        M.fmt(sys.delta, 2) +
        '\\;\\text{s}^{-2}$, discriminant $D = \\tau^2 - 4\\Delta = ' +
        M.fmt(sys.disc, 2) +
        '$ (' +
        sys.regimeName +
        ').';
    }
    typesetElement(descEl);
  }

  function updateSection1Readouts() {
    const sys = app.sys;
    const eqStack = document.getElementById('live-matrix-eqs');
    if (eqStack) {
      eqStack.innerHTML =
        '<div class="c-blue"></div><div class="c-orange"></div><div class="c-teal"></div>';
      const A = sys.A;
      renderTex(
        eqStack.children[0],
        '\\dot{\\mathbf{z}} = \\mathbf{A}\\mathbf{z}, \\quad \\mathbf{A} = \\begin{bmatrix} ' +
          M.fmt(A[0][0], 2) +
          ' & ' +
          M.fmt(A[0][1], 2) +
          ' \\\\ ' +
          M.fmt(A[1][0], 2) +
          ' & ' +
          M.fmt(A[1][1], 2) +
          ' \\end{bmatrix}' +
          (sys.isStar ? ' = \\lambda\\mathbf{I}' : ''),
        false
      );
      renderTex(
        eqStack.children[1],
        '\\tau = ' +
          M.fmt(sys.tau, 2) +
          ', \\quad \\Delta = ' +
          M.fmt(sys.delta, 2) +
          ', \\quad D = \\tau^2 - 4\\Delta = ' +
          M.fmt(sys.disc, 2),
        false
      );
      if (sys.isStar) {
        renderTex(
          eqStack.children[2],
          '\\operatorname{rank}(\\mathbf{A} - \\lambda\\mathbf{I}) = 0 \\implies m_{\\mathrm{g}} = m_{\\mathrm{a}} = 2 \\;\\;(\\text{star node condition})',
          false
        );
      } else {
        renderTex(
          eqStack.children[2],
          '\\dot{E} = \\frac{\\mathrm{d}}{\\mathrm{d}t}\\!\\left(\\tfrac{1}{2}v^2 + \\tfrac{1}{2}\\Delta x^2\\right) = \\tau v^2 = (' +
            M.fmt(sys.tau, 2) +
            ')\\,v^2',
          false
        );
      }
    }

    // KPI tiles
    const kpiStab = document.getElementById('kpi-stability');
    const kpiStabSub = document.getElementById('kpi-stability-sub');
    const kpiStabBox = document.getElementById('kpi-stability-box');
    if (kpiStab) {
      kpiStab.textContent = sys.stabilityLabel;
      kpiStab.className =
        'kpi-val ' +
        (sys.stability === 'asymptotic'
          ? 'c-teal'
          : sys.stability === 'lyapunov'
            ? 'c-amber'
            : 'c-crimson');
    }
    if (kpiStabBox) {
      kpiStabBox.className =
        'kpi ' +
        (sys.stability === 'asymptotic'
          ? 'kpi-teal'
          : sys.stability === 'lyapunov'
            ? 'kpi-amber'
            : 'kpi-crimson');
    }
    if (kpiStabSub) {
      kpiStabSub.textContent = sys.hyperbolic
        ? 'Hyperbolic equilibrium (structurally stable)'
        : 'Non-hyperbolic (boundary case: structurally unstable)';
    }

    const kpiReg = document.getElementById('kpi-regime');
    const kpiRegSub = document.getElementById('kpi-regime-sub');
    if (kpiReg) kpiReg.textContent = sys.regimeName;
    if (kpiRegSub) {
      if (sys.wn !== null && sys.zeta !== null) {
        renderTex(
          kpiRegSub,
          '\\omega_{\\mathrm{n}} = ' + M.fmt(sys.wn, 2) + '\\;\\text{rad/s},\\; \\zeta = ' + M.fmt(sys.zeta, 2),
          false
        );
      } else {
        renderTex(
          kpiRegSub,
          '\\Delta \\le 0\\;\\text{(no real }\\omega_{\\mathrm{n}}\\text{)}',
          false
        );
      }
    }

    renderTex(document.getElementById('kpi-eigs'), formatEigenTex(sys), false);
    renderTex(
      document.getElementById('kpi-vieta'),
      '\\lambda_1 + \\lambda_2 = ' + M.fmt(sys.tau, 2) + ',\\; \\lambda_1\\lambda_2 = ' + M.fmt(sys.delta, 2),
      false
    );

    const kpiMech = document.getElementById('kpi-mech');
    const kpiMechSub = document.getElementById('kpi-mech-sub');
    if (kpiMech && kpiMechSub) {
      if (sys.isStar) {
        kpiMech.textContent = 'Scalar matrix A = λI';
        kpiMechSub.textContent = 'Non-companion (A₁₂ = 0, mg = 2)';
      } else {
        const potTxt =
          sys.delta > M.EPS ? 'Potential well (k > 0)' : sys.delta < -M.EPS ? 'Potential hilltop (k < 0)' : 'Flat potential (k = 0)';
        const dampTxt =
          sys.tau < -M.EPS ? 'Dissipation (c > 0)' : sys.tau > M.EPS ? 'Energy injection (c < 0)' : 'Conservative (c = 0)';
        kpiMech.textContent = potTxt;
        kpiMechSub.textContent = dampTxt;
      }
    }
  }

  function updateSection2Readouts() {
    const sys = app.sys;
    renderTex(document.getElementById('sec2-char-eq'), formatCharPolyTex(sys), false);
    renderTex(document.getElementById('sec2-roots'), formatEigenTex(sys), false);

    const eigVecEl = document.getElementById('sec2-eigvecs');
    if (eigVecEl) {
      if (sys.eigType === 'real_distinct') {
        renderTex(
          eigVecEl,
          '\\mathbf{v}_1 = \\begin{bmatrix} 1 \\\\ ' +
            M.fmt(sys.l1.re, 2) +
            ' \\end{bmatrix}, \\quad \\mathbf{v}_2 = \\begin{bmatrix} 1 \\\\ ' +
            M.fmt(sys.l2.re, 2) +
            ' \\end{bmatrix}',
          false
        );
      } else if (sys.eigType === 'real_star') {
        renderTex(
          eigVecEl,
          '\\text{Every }\\mathbf{v} \\ne \\mathbf{0}\\;(\\mathbf{A} - \\lambda\\mathbf{I} = \\mathbf{0},\\; m_{\\mathrm{g}} = 2)',
          false
        );
      } else if (sys.eigType === 'real_repeated') {
        renderTex(
          eigVecEl,
          '\\mathbf{v}_1 = \\begin{bmatrix} 1 \\\\ ' +
            M.fmt(sys.l1.re, 2) +
            ' \\end{bmatrix}\\;(\\text{1D eigenspace}),\\; \\mathbf{w} = \\begin{bmatrix} 0 \\\\ 1 \\end{bmatrix}',
          false
        );
      } else {
        renderTex(
          eigVecEl,
          '\\mathbf{v} = \\begin{bmatrix} 1 \\\\ ' +
            M.fmt(sys.l1.re, 2) +
            ' \\end{bmatrix} + \\mathrm{i}\\begin{bmatrix} 0 \\\\ ' +
            M.fmt(Math.abs(sys.l1.im), 2) +
            ' \\end{bmatrix}\\;(\\text{no real invariant lines})',
          false
        );
      }
    }

    const callout = document.getElementById('sec2-callout');
    if (callout) {
      let cls = 'callout callout-blue';
      let html = '';
      if (sys.regime === 'saddle') {
        cls = 'callout callout-crimson';
        html =
          '<strong>Saddle geometry ($\\Delta < 0$).</strong> Because $\\lambda_1 < 0 < \\lambda_2$, the line $v = \\lambda_1 x$ is the stable manifold $E^{\\mathrm{s}}$ (inward flow) and $v = \\lambda_2 x$ is the unstable manifold $E^{\\mathrm{u}}$ (outward flow). Every trajectory off $E^{\\mathrm{s}}$ swings along a hyperbola asymptotic to $E^{\\mathrm{u}}$.';
      } else if (sys.regime === 'stable_node') {
        cls = 'callout callout-teal';
        html =
          '<strong>Slow-eigenvector tangency in a stable node.</strong> Both roots are negative ($\\lambda_2 < \\lambda_1 < 0$), so the fast mode $\\mathrm{e}^{\\lambda_2 t}$ dies out first. Nearly every trajectory enters the origin tangent to the slower eigendirection $\\mathbf{v}_1 = [1, \\lambda_1]^{\\mathsf{T}}$.';
      } else if (sys.regime === 'unstable_node') {
        cls = 'callout callout-crimson';
        html =
          '<strong>Fast-eigenvector dominance in an unstable node.</strong> Both roots are positive ($0 < \\lambda_1 < \\lambda_2$). Trajectories leave the origin tangent to the slow eigenvector $\\mathbf{v}_1$ and bend asymptotically parallel to the fast eigenvector $\\mathbf{v}_2 = [1, \\lambda_2]^{\\mathsf{T}}$.';
      } else if (sys.regime === 'star_stable' || sys.regime === 'star_unstable') {
        cls = sys.tau < 0 ? 'callout callout-teal' : 'callout callout-crimson';
        html =
          '<strong>' +
          (sys.tau < 0 ? 'Stable star node' : 'Unstable star node') +
          ' ($\\Delta = \\tau^2/4$, $\\tau ' +
          (sys.tau < 0 ? '< 0' : '> 0') +
          '$, and $\\mathbf{A} = \\lambda\\mathbf{I}$).</strong> Because $\\operatorname{rank}(\\mathbf{A} - \\lambda\\mathbf{I}) = 0$, the geometric multiplicity is $m_{\\mathrm{g}} = 2 = m_{\\mathrm{a}}$: every nonzero vector is an eigenvector and all trajectories are straight radial rays $\\mathbf{z}(t) = \\mathrm{e}^{\\lambda t}\\mathbf{z}_0$. Note that a mechanical 1-DOF companion matrix ($A_{12} = 1$) cannot satisfy $\\mathbf{A} = \\lambda\\mathbf{I}$ and therefore produces an improper Jordan node instead.';
      } else if (sys.regime === 'degenerate_stable' || sys.regime === 'degenerate_unstable') {
        cls = 'callout';
        html =
          '<strong>Improper (degenerate) node on $\\Delta = \\tau^2/4$.</strong> Although $\\lambda_1 = \\lambda_2 = \\tau/2$ repeats just like a star node, the mechanical entry $A_{12} = 1 \\ne 0$ forces $\\operatorname{rank}(\\mathbf{A} - \\lambda\\mathbf{I}) = 1$ ($m_{\\mathrm{g}} = 1 < 2$). Only one invariant line $v = (\\tau/2)x$ survives, and trajectories shear across it via $t\\mathrm{e}^{(\\tau/2)t}$.';
      } else if (sys.regime === 'center') {
        cls = 'callout callout-amber';
        html =
          '<strong>Purely imaginary eigenvalues ($\\tau = 0, \\Delta > 0$).</strong> No real invariant lines exist. Trajectories form nested ellipses $\\Delta x^2 + v^2 = \\text{const}$ of aspect ratio $v_{\\max}/x_{\\max} = \\sqrt{\\Delta} = \\omega_{\\mathrm{n}}$, rotating clockwise in the $(x, v)$ plane.';
      } else if (sys.regime === 'stable_spiral' || sys.regime === 'unstable_spiral') {
        cls = sys.tau < 0 ? 'callout callout-teal' : 'callout callout-crimson';
        html =
          '<strong>Complex conjugate eigenvalues ($\\tau^2 < 4\\Delta$).</strong> The real part $\\sigma = \\tau/2$ sets the exponential radial growth or decay rate while the imaginary part $\\omega = \\frac{1}{2}\\sqrt{4\\Delta - \\tau^2}$ sets the clockwise angular frequency. The basis $[\\operatorname{Re}\\mathbf{v}, \\operatorname{Im}\\mathbf{v}]$ shears circular spirals into elliptical spirals.';
      } else {
        cls = 'callout callout-amber';
        html =
          '<strong>Zero determinant ($\\Delta = 0$).</strong> The matrix $\\mathbf{A}$ is singular ($\\det\\mathbf{A} = 0$), so $\\lambda_1 = 0$ and the entire $x$-axis ($v = 0$) is a continuum of equilibria. When $\\tau \\ne 0$, trajectories move along straight lines of slope $\\tau$ toward ($\\tau < 0$) or away from ($\\tau > 0$) the $x$-axis.';
      }
      callout.className = cls;
      callout.innerHTML = html;
      typesetElement(callout);
    }
  }

  function updateSection3Readouts() {
    const sys = app.sys;
    const badge = document.getElementById('trdet-badge');
    if (badge) {
      badge.className =
        'status-badge ' +
        (sys.stability === 'asymptotic' ? 'ok' : sys.stability === 'lyapunov' ? 'neutral' : 'warn');
      badge.textContent = sys.regimeName + ' · ' + sys.stabilityLabel;
    }

    const eqEl = document.getElementById('trdet-live-coords');
    if (eqEl) {
      renderTex(
        eqEl,
        '(\\tau,\\,\\Delta) = (' +
          M.fmt(sys.tau, 2) +
          ',\\,' +
          M.fmt(sys.delta, 2) +
          '), \\quad \\Delta - \\tfrac{1}{4}\\tau^2 = ' +
          M.fmt(sys.delta - 0.25 * sys.tau * sys.tau, 2),
        false
      );
    }

    const btnImp = document.getElementById('btn-parabola-improper');
    const btnStar = document.getElementById('btn-parabola-star');
    if (btnImp && btnStar) {
      btnImp.classList.toggle('is-active', sys.onParabola && !sys.isStar);
      btnStar.classList.toggle('is-active', sys.isStar);
    }
  }

  function updateClassificationHighlight() {
    const regime = app.sys.regime;
    document.querySelectorAll('#class-table tbody tr').forEach(function (tr) {
      const match = tr.dataset.regime === regime;
      tr.classList.toggle('selected-row', match);
    });
  }

  function updateGeomReadout(info) {
    const valT = document.getElementById('val-geom-t');
    const sSlider = document.getElementById('slider-geom-t');
    if (valT) valT.textContent = 't = ' + M.fmt(info.t, 2) + ' s';
    if (sSlider) sSlider.value = info.t;

    const kpiArea = document.getElementById('kpi-liouville');
    const kpiAreaSub = document.getElementById('kpi-liouville-sub');
    if (kpiArea && kpiAreaSub) {
      renderTex(
        kpiArea,
        'S(t)/S(0) = \\mathrm{e}^{\\tau t} = ' + M.fmt(info.ratio, 3),
        false
      );
      kpiAreaSub.textContent =
        'Polygon area: ' +
        M.fmt(info.stNum, 3) +
        ' vs. exact ' +
        M.fmt(info.stExact, 3) +
        ' (div f = τ = ' +
        M.fmt(app.sys.tau, 2) +
        ')';
    }
  }

  /* -----------------------------------------------------------
   * Nonlinear Bridge Readouts (Section 5)
   * --------------------------------------------------------- */
  function updateNonlinearReadouts(model, param, eq, lin, selectedIdx) {
    renderTex(document.getElementById('nl-eq-box'), model.eqTex + ', \\qquad ' + model.potTex, false);

    const lbl = document.getElementById('nl-param-label');
    const val = document.getElementById('nl-param-val');
    const sld = document.getElementById('slider-nl-param');
    if (lbl) lbl.textContent = model.paramName;
    if (val) val.textContent = M.fmt(param, 2);
    if (sld) {
      sld.min = model.paramMin;
      sld.max = model.paramMax;
      sld.step = model.paramStep;
      sld.value = param;
    }

    // Populate equilibrium selector pills
    const eqGroup = document.getElementById('nl-eq-buttons');
    if (eqGroup) {
      const eqs = model.equilibria(param);
      eqGroup.innerHTML = '';
      eqs.forEach(function (item, i) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-sm' + (i === selectedIdx ? ' is-active' : '');
        b.textContent = item.label;
        b.addEventListener('click', function () {
          app.viz.nonlinear.selectEq(i);
        });
        eqGroup.appendChild(b);
      });
    }

    // Local Jacobian & eigenvalues
    renderTex(
      document.getElementById('nl-jacobian-tex'),
      '\\mathbf{J}(x^*) = \\begin{bmatrix} 0 & 1 \\\\ ' +
        M.fmt(-eq.delta, 2) +
        ' & ' +
        M.fmt(eq.tau, 2) +
        ' \\end{bmatrix}, \\quad ' +
        formatEigenTex(lin),
      false
    );

    const hgBadge = document.getElementById('nl-hg-badge');
    if (hgBadge) {
      if (lin.hyperbolic) {
        hgBadge.className = 'status-badge ok';
        hgBadge.textContent = 'Hyperbolic · Hartman–Grobman applies';
      } else {
        hgBadge.className = 'status-badge warn';
        hgBadge.textContent = 'Non-hyperbolic · Higher-order terms govern stability';
      }
    }

    const noteEl = document.getElementById('nl-eq-note');
    if (noteEl) {
      noteEl.className = 'callout ' + (lin.hyperbolic ? 'callout-teal' : 'callout-crimson');
      noteEl.innerHTML =
        '<strong>' + eq.label + ' (' + lin.regimeName + ').</strong> ' + eq.note;
    }

    const hasSaddle = model.key !== 'nl_center';
    document.querySelectorAll('.nl-saddle-legend').forEach(function (el) {
      el.style.display = hasSaddle ? 'inline-flex' : 'none';
    });
  }

  /* -----------------------------------------------------------
   * Live Reproducible Code Export (MATLAB & Python)
   * --------------------------------------------------------- */
  function updateCodeSnippet() {
    const block = document.getElementById('live-code-block');
    if (!block) return;
    const sys = app.sys;
    const tau = M.fmt(app.tau, 3);
    const delta = M.fmt(app.delta, 3);
    const lam = M.fmt(0.5 * app.tau, 3);

    if (app.codeLang === 'matlab') {
      if (sys.isStar) {
        block.textContent =
          '% Star (Proper) Node: Delta = tau^2/4 and A = lambda*I\n' +
          '% Geometric multiplicity mg = 2 (requires off-diagonal = 0)\n' +
          'lambda = ' + lam + ';   % tau = 2*lambda, Delta = lambda^2\n' +
          'A = [lambda, 0; 0, lambda];\n\n' +
          '[V, D] = eig(A);\n' +
          'fprintf("tr=%.3f, det=%.3f, rank(A-l*I)=%d\\n", ...\n' +
          '        trace(A), det(A), rank(A - lambda*eye(2)));\n\n' +
          '% Vectorized radial flow and ode45 trajectory\n' +
          '[X, Y] = meshgrid(linspace(-2.5, 2.5, 17));\n' +
          'U = lambda*X;  W = lambda*Y;\n' +
          'N = hypot(U, W) + eps;\n' +
          'figure; quiver(X, Y, U./N, W./N, 0.55); hold on;\n' +
          '[~, Z] = ode45(@(t, z) A * z, [0, 3], [1.4; 0.5]);\n' +
          'plot(Z(:,1), Z(:,2), "LineWidth", 2); axis equal;\n' +
          'xlabel("z_1"); ylabel("z_2"); grid on;';
      } else {
        block.textContent =
          '% 1-DOF Linearized Equilibrium Stability & Phase Portrait\n' +
          '% State: z = [x; v], dz/dt = A*z, A = [0, 1; -Delta, tau]\n' +
          'tau   = ' + tau + ';   % trace = -c/m [1/s]\n' +
          'Delta = ' + delta + ';   % determinant = k/m [1/s^2]\n\n' +
          'A = [0, 1; -Delta, tau];  % Jacobian at z* = [0; 0]\n' +
          '[V, D] = eig(A);          % eigenvectors & eigenvalues\n' +
          'lambda = diag(D);\n' +
          'fprintf("tr=%.3f, det=%.3f, disc=%.3f\\n", ...\n' +
          '        trace(A), det(A), trace(A)^2 - 4*det(A));\n' +
          'disp("Eigenvalues:"); disp(lambda);\n\n' +
          '% Vectorized direction field and ode45 trajectory\n' +
          '[X, Y] = meshgrid(linspace(-2.5, 2.5, 17));\n' +
          'U = Y;  W = -Delta*X + tau*Y;\n' +
          'N = hypot(U, W) + eps;\n' +
          'figure; quiver(X, Y, U./N, W./N, 0.55); hold on;\n' +
          '[~, Z] = ode45(@(t, z) A * z, [0, 6], [1.4; 0.5]);\n' +
          'plot(Z(:,1), Z(:,2), "LineWidth", 2); axis equal;\n' +
          'xlabel("x"); ylabel("v = dx/dt"); grid on;';
      }
    } else {
      if (sys.isStar) {
        block.textContent =
          '# Star (Proper) Node: Delta = tau^2/4 and A = lambda*I\n' +
          'import numpy as np\n' +
          'from scipy.integrate import solve_ivp\n' +
          'import matplotlib.pyplot as plt\n\n' +
          'lam = ' + lam + '   # tau = 2*lam, Delta = lam**2\n' +
          'A = np.array([[lam, 0.0], [0.0, lam]])\n' +
          'rank_def = np.linalg.matrix_rank(A - lam * np.eye(2))\n' +
          'print(f"tr={np.trace(A):.3f}, det={np.linalg.det(A):.3f}, "\n' +
          '      f"rank(A - lam*I)={rank_def}")\n\n' +
          'sol = solve_ivp(lambda t, z: A @ z, [0, 3], [1.4, 0.5],\n' +
          '                max_step=0.02)\n' +
          'g = np.linspace(-2.5, 2.5, 17)\n' +
          'x, y = np.meshgrid(g, g)\n' +
          'u, w = lam * x, lam * y\n' +
          'mag = np.hypot(u, w) + 1e-9\n' +
          'plt.quiver(x, y, u / mag, w / mag, alpha=0.45)\n' +
          'plt.plot(sol.y[0], sol.y[1], lw=2)\n' +
          'plt.xlabel("z1"); plt.ylabel("z2")\n' +
          'plt.axis("equal"); plt.grid(True); plt.show()';
      } else {
        block.textContent =
          '# 1-DOF Linearized Equilibrium Stability (SciPy)\n' +
          'import numpy as np\n' +
          'from scipy.integrate import solve_ivp\n' +
          'import matplotlib.pyplot as plt\n\n' +
          '# State vector z = [x, v]^T, dz/dt = A @ z\n' +
          'tau   = ' + tau + '   # trace = -c/m [1/s]\n' +
          'Delta = ' + delta + '   # determinant = k/m [1/s^2]\n' +
          'A = np.array([[0.0, 1.0], [-Delta, tau]])\n\n' +
          'eigvals, eigvecs = np.linalg.eig(A)\n' +
          'print(f"tr={np.trace(A):.3f}, det={np.linalg.det(A):.3f}, "\n' +
          '      f"disc={tau**2 - 4*Delta:.3f}")\n' +
          'print("Eigenvalues:", eigvals)\n\n' +
          'sol = solve_ivp(lambda t, z: A @ z, [0, 6], [1.4, 0.5],\n' +
          '                max_step=0.02)\n' +
          'g = np.linspace(-2.5, 2.5, 17)\n' +
          'x, v = np.meshgrid(g, g)\n' +
          'u, w = v, -Delta * x + tau * v\n' +
          'mag = np.hypot(u, w) + 1e-9\n' +
          'plt.quiver(x, v, u / mag, w / mag, alpha=0.45)\n' +
          'plt.plot(sol.y[0], sol.y[1], lw=2)\n' +
          'plt.xlabel("x"); plt.ylabel("v = dx/dt")\n' +
          'plt.axis("equal"); plt.grid(True); plt.show()';
      }
    }
  }

  /* -----------------------------------------------------------
   * Citation Box
   * --------------------------------------------------------- */
  function updateCitation() {
    const box = document.getElementById('cite-text-block');
    if (!box) return;
    const year = new Date().getFullYear();
    const url = 'https://dchelidze.github.io/vibrations-tutorials/sdof-equilibrium-stability/';
    if (app.citeFormat === 'apa') {
      box.textContent =
        'Chelidze, D. (' +
        year +
        '). Equilibrium stability, eigenvalues, and phase portraits of 1-DOF systems [Interactive tutorial]. Nonlinear Dynamics Laboratory, University of Rhode Island. ' +
        url;
    } else if (app.citeFormat === 'ieee') {
      box.textContent =
        'D. Chelidze, "Equilibrium stability, eigenvalues, and phase portraits of 1-DOF systems," Nonlinear Dynamics Laboratory, University of Rhode Island, ' +
        year +
        '. [Online]. Available: ' +
        url;
    } else {
      box.textContent =
        '@misc{chelidze' +
        year +
        'sdofstability,\n' +
        '  author       = {Chelidze, David},\n' +
        '  title        = {Equilibrium Stability, Eigenvalues, and Phase Portraits of 1-DOF Systems},\n' +
        '  year         = {' +
        year +
        '},\n' +
        '  howpublished = {Interactive Tutorial, Nonlinear Dynamics Laboratory, University of Rhode Island},\n' +
        '  url          = {' +
        url +
        '}\n' +
        '}';
    }
  }

  /* -----------------------------------------------------------
   * Initialization & Wiring
   * --------------------------------------------------------- */
  function applyPreset(key) {
    const p = M.PRESETS[key];
    if (!p) return;
    app.presetKey = key;
    app.tau = p.tau;
    app.delta = p.delta;
    app.starMode = !!p.star;
    if (app.viz.trdet) app.viz.trdet.stopSweep();
    clearSweepButtons();
    recompute(false);
  }

  function clearSweepButtons() {
    document.querySelectorAll('#sweep-btns button').forEach(function (b) {
      b.classList.remove('is-active');
    });
  }

  function init() {
    const yearEl = document.getElementById('copyright-year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    // Initial typeset of static page math
    typesetElement(document.body);

    app.sys = M.analyzeLinear(app.tau, app.delta);

    // Instantiate all interactive visualizers
    app.viz.mech = window.VibLab.MechPotentialViz.create({
      potCanvas: document.getElementById('mech-pot-canvas'),
      waveCanvas: document.getElementById('mech-wave-canvas'),
      sys: app.sys
    });

    app.viz.eigen = window.VibLab.EigenPhaseViz.create({
      eigCanvas: document.getElementById('eigen-plane-canvas'),
      phaseCanvas: document.getElementById('phase-portrait-canvas'),
      sys: app.sys,
      onProbeChange: function (z0) {
        const el = document.getElementById('probe-ic-readout');
        if (el) {
          el.textContent = 'z₀ = [' + M.fmt(z0[0], 2) + ', ' + M.fmt(z0[1], 2) + ']ᵀ';
        }
      }
    });

    app.viz.trdet = window.VibLab.TrDetViz.create({
      trdetCanvas: document.getElementById('trdet-plane-canvas'),
      phaseCanvas: document.getElementById('trdet-phase-canvas'),
      sys: app.sys,
      onChange: function (tau, delta, fromSweep) {
        app.tau = tau;
        app.delta = delta;
        app.presetKey = null;
        recompute(fromSweep);
      }
    });

    app.viz.geom = window.VibLab.GeometryViz.create({
      areaCanvas: document.getElementById('geom-area-canvas'),
      modalCanvas: document.getElementById('geom-modal-canvas'),
      sys: app.sys,
      onTimeUpdate: updateGeomReadout
    });

    app.viz.nonlinear = window.VibLab.NonlinearViz.create({
      potCanvas: document.getElementById('nl-pot-canvas'),
      phaseCanvas: document.getElementById('nl-phase-canvas'),
      localCanvas: document.getElementById('nl-local-canvas'),
      onSelectEq: updateNonlinearReadouts
    });

    // Topbar drawer & theme controls
    const drawer = document.getElementById('param-drawer');
    document.getElementById('btn-params').addEventListener('click', function () {
      drawer.classList.toggle('open');
    });
    document.getElementById('btn-close-drawer').addEventListener('click', function () {
      drawer.classList.remove('open');
    });
    document.getElementById('btn-open-params-sec1').addEventListener('click', function () {
      drawer.classList.add('open');
    });

    const themeBtn = document.getElementById('btn-theme');
    const themeLbl = document.getElementById('btn-theme-label');
    themeBtn.addEventListener('click', function () {
      const dark = !Theme.isDark();
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      themeLbl.textContent = dark ? 'Light' : 'Dark';
      Object.keys(app.viz).forEach(function (k) {
        if (app.viz[k] && app.viz[k].render) app.viz[k].render();
      });
    });

    // Hero preset selector & drawer preset chips
    document.querySelectorAll('#preset-selector .pill, #drawer-presets button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyPreset(btn.dataset.preset);
      });
    });

    // Parameter sliders in drawer
    document.getElementById('slider-tau').addEventListener('input', function (e) {
      app.tau = parseFloat(e.target.value);
      app.presetKey = null;
      app.viz.trdet.stopSweep();
      clearSweepButtons();
      recompute(false);
    });
    document.getElementById('slider-delta').addEventListener('input', function (e) {
      app.delta = parseFloat(e.target.value);
      app.presetKey = null;
      app.viz.trdet.stopSweep();
      clearSweepButtons();
      recompute(false);
    });

    // Section 1 playback controls
    const btnMechPlay = document.getElementById('btn-mech-play');
    let mechPlaying = true;
    btnMechPlay.addEventListener('click', function () {
      mechPlaying = !mechPlaying;
      app.viz.mech.setPlaying(mechPlaying);
      btnMechPlay.textContent = mechPlaying ? 'Pause' : 'Play';
    });
    document.getElementById('btn-mech-reset').addEventListener('click', function () {
      app.viz.mech.setIC(1.0, 0.0);
    });

    // Section 2 toggles
    document.getElementById('chk-eigen').addEventListener('change', function (e) {
      app.viz.eigen.setOptions({ showEigen: e.target.checked });
    });
    document.getElementById('chk-nullclines').addEventListener('change', function (e) {
      app.viz.eigen.setOptions({ showNullclines: e.target.checked });
    });
    document.getElementById('chk-field').addEventListener('change', function (e) {
      app.viz.eigen.setOptions({ showField: e.target.checked });
    });
    document.getElementById('btn-reset-probe').addEventListener('click', function () {
      app.viz.eigen.setProbe([1.45, 0.55]);
    });

    // Section 3 sweep buttons & parabola Improper vs Star comparator
    document.querySelectorAll('#sweep-btns button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        app.starMode = false;
        const active = app.viz.trdet.startSweep(btn.dataset.sweep);
        clearSweepButtons();
        if (active) btn.classList.add('is-active');
      });
    });

    function snapToParabola(asStar) {
      app.viz.trdet.stopSweep();
      clearSweepButtons();
      let tauUse = app.tau;
      if (Math.abs(tauUse) < 0.6) tauUse = -3.0;
      app.tau = Math.max(-4.0, Math.min(4.0, tauUse));
      app.delta = 0.25 * app.tau * app.tau;
      app.starMode = !!asStar;
      app.presetKey = asStar
        ? app.tau < 0
          ? 'star_stable'
          : 'star_unstable'
        : app.tau < 0
          ? 'degenerate_stable'
          : 'degenerate_unstable';
      recompute(false);
    }

    document.getElementById('btn-parabola-improper').addEventListener('click', function () {
      snapToParabola(false);
    });
    document.getElementById('btn-parabola-star').addEventListener('click', function () {
      snapToParabola(true);
    });

    // Section 4 geometry scrubber & shape buttons
    const geomSlider = document.getElementById('slider-geom-t');
    let geomPlaying = false;
    const btnGeomPlay = document.getElementById('btn-geom-play');
    geomSlider.addEventListener('input', function (e) {
      geomPlaying = false;
      app.viz.geom.setPlaying(false);
      btnGeomPlay.textContent = 'Animate flow';
      app.viz.geom.setTime(parseFloat(e.target.value));
    });
    btnGeomPlay.addEventListener('click', function () {
      geomPlaying = !geomPlaying;
      app.viz.geom.setPlaying(geomPlaying);
      btnGeomPlay.textContent = geomPlaying ? 'Pause flow' : 'Animate flow';
    });
    document.querySelectorAll('#geom-shape-btns button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#geom-shape-btns button').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        app.viz.geom.setShape(btn.dataset.shape);
      });
    });

    // Section 5 nonlinear selector & slider
    document.querySelectorAll('#nl-model-pills .pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#nl-model-pills .pill').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        app.viz.nonlinear.setModel(btn.dataset.model);
      });
    });
    document.getElementById('slider-nl-param').addEventListener('input', function (e) {
      app.viz.nonlinear.setParam(parseFloat(e.target.value));
    });
    document.getElementById('btn-nl-clear').addEventListener('click', function () {
      app.viz.nonlinear.clearCustom();
    });

    // Section 6 clickable classification table
    document.querySelectorAll('#class-table tbody tr.clickable-row').forEach(function (row) {
      row.addEventListener('click', function () {
        const preset = row.dataset.preset;
        if (preset && M.PRESETS[preset]) {
          applyPreset(preset);
          document.getElementById('sec-trdet').scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    // Code export tabs & copy
    document.querySelectorAll('#code-lang-tabs button[data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        app.codeLang = btn.dataset.lang;
        document.querySelectorAll('#code-lang-tabs button[data-lang]').forEach((b) =>
          b.classList.toggle('is-active', b.dataset.lang === app.codeLang)
        );
        updateCodeSnippet();
      });
    });
    document.getElementById('btn-copy-code').addEventListener('click', function () {
      const txt = document.getElementById('live-code-block').textContent;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(txt).then(function () {
          const b = document.getElementById('btn-copy-code');
          b.textContent = 'Copied';
          setTimeout(() => (b.textContent = 'Copy'), 1400);
        });
      }
    });

    // Citation tabs & copy
    document.querySelectorAll('#cite-format-tabs button[data-cite]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        app.citeFormat = btn.dataset.cite;
        document.querySelectorAll('#cite-format-tabs button[data-cite]').forEach((b) =>
          b.classList.toggle('is-active', b.dataset.cite === app.citeFormat)
        );
        updateCitation();
      });
    });
    document.getElementById('btn-copy-cite').addEventListener('click', function () {
      const txt = document.getElementById('cite-text-block').textContent;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(txt).then(function () {
          const b = document.getElementById('btn-copy-cite');
          b.textContent = 'Copied';
          setTimeout(() => (b.textContent = 'Copy citation'), 1400);
        });
      }
    });

    // Scroll spy for sticky nav
    const sections = Array.from(document.querySelectorAll('.lesson-section[id]'));
    const navLinks = Array.from(document.querySelectorAll('.chapter-nav a'));
    const obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            navLinks.forEach((a) =>
              a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id)
            );
          }
        });
      },
      { rootMargin: '-25% 0px -65% 0px' }
    );
    sections.forEach((s) => obs.observe(s));

    // Resize re-render
    window.addEventListener('resize', function () {
      Object.keys(app.viz).forEach(function (k) {
        if (app.viz[k] && app.viz[k].render) app.viz[k].render();
      });
    });

    // Initial full sync
    recompute(false);
    updateCitation();

    // Master 60fps animation loop
    let lastTs = performance.now();
    function tick(now) {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      if (app.viz.mech) app.viz.mech.step(dt);
      if (app.viz.eigen) app.viz.eigen.step(dt);
      if (app.viz.trdet) app.viz.trdet.step(dt);
      if (app.viz.geom) app.viz.geom.step(dt);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener('DOMContentLoaded', init);
})();
