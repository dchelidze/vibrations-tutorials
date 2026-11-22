/**
 * app.js
 * Central reactive controller for Module 04:
 * Modal Decoupling, Forced 2-DOF Response, and Antiresonance.
 */
(function () {
  'use strict';

  const M = window.VibLab.MathModal2DOF;

  const KATEX_DELIMITERS = [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
    { left: '\\(', right: '\\)', display: false },
    { left: '\\[', right: '\\]', display: true }
  ];

  const app = {
    presetKey: 'asymmetric',
    params: Object.assign({}, M.PRESETS.asymmetric),
    sys: null,
    icPreset: 'pluck1',
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

  /* ------------------------------------------------------------------
   * Recompute 2-DOF System & Sync All Views
   * ---------------------------------------------------------------- */
  function recompute(keepPreset) {
    app.sys = M.analyzeSystem(app.params);

    syncSliders();
    updateHeroReadout();
    updateSection1Readouts();
    updateSection2Readouts();
    updateSection3Readouts();
    updateSection4Readouts();
    updateSection5Readouts();
    updateCodeSnippet();

    if (app.viz.ortho) app.viz.ortho.setSystem(app.sys);
    if (app.viz.free) {
      applyICPreset(app.icPreset, true);
      app.viz.free.setSystem(app.sys);
    }
    if (app.viz.force) app.viz.force.setSystem(app.sys);
    if (app.viz.anti) {
      app.viz.anti.setSystem(app.sys);
      const wSlider = document.getElementById('slider-anti-omega');
      if (wSlider) {
        wSlider.max = M.fmt(app.sys.wMax, 2);
        wSlider.value = M.fmt(app.viz.anti.getState().omega, 2);
      }
    }
    if (app.viz.damp) app.viz.damp.setSystem(app.sys);

    if (!keepPreset) {
      syncPresetButtons();
    }
  }

  function syncSliders() {
    const p = app.params;
    const map = [
      ['m1', p.m1, ' kg', 2],
      ['m2', p.m2, ' kg', 2],
      ['k1', p.k1, ' N/m', 1],
      ['k2', p.k2, ' N/m', 1],
      ['k3', p.k3, ' N/m', 1],
      ['alpha', p.alpha, ' s⁻¹', 3],
      ['beta', p.beta, ' s', 3],
      ['cloc', p.cLoc, ' N·s/m', 2]
    ];
    for (const [key, val, unit, dec] of map) {
      const s = document.getElementById('slider-' + key);
      const v = document.getElementById('val-' + key);
      if (s) s.value = val;
      if (v) v.textContent = M.fmt(val, dec) + unit;
    }

    const sec5Slider = document.getElementById('slider-sec5-cloc');
    const sec5Val = document.getElementById('val-sec5-cloc');
    if (sec5Slider) sec5Slider.value = p.cLoc;
    if (sec5Val) sec5Val.textContent = 'c_loc = ' + M.fmt(p.cLoc, 2) + ' N·s/m';

    document.querySelectorAll('#damp-site-pills .pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.site === p.locSite);
    });
  }

  function syncPresetButtons() {
    document.querySelectorAll('#preset-selector .pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.preset === app.presetKey);
    });
  }

  function updateHeroReadout() {
    const descEl = document.getElementById('preset-desc-text');
    if (!descEl) return;
    const preset = M.PRESETS[app.presetKey];
    if (preset) {
      descEl.textContent = preset.description;
    } else {
      const s = app.sys;
      descEl.textContent =
        'Custom 2-DOF system: $\\omega_1 = ' +
        M.fmt(s.w1, 2) +
        '\\;\\text{rad/s}$, $\\omega_2 = ' +
        M.fmt(s.w2, 2) +
        '\\;\\text{rad/s}$, driving-point antiresonance $\\omega_{\\mathrm{a},11} = ' +
        M.fmt(s.wa11, 2) +
        '\\;\\text{rad/s}$, modal damping coupling $\\tilde{c}_{12} = ' +
        M.fmt(s.Ctilde[0][1], 3) +
        '$.';
    }
    typesetElement(descEl);
  }

  /* ------------------------------------------------------------------
   * Section 1: Orthogonality & Probe Readouts
   * ---------------------------------------------------------------- */
  function updateSection1Readouts() {
    const s = app.sys;
    const x0 = app.viz.ortho ? app.viz.ortho.getProbe() : [1.05, 0.25];
    const r = M.physToModal(s, x0);

    const kpiW1 = document.getElementById('kpi-w1');
    const kpiW2 = document.getElementById('kpi-w2');
    const kpiAngle = document.getElementById('kpi-phys-angle');
    const kpiProj = document.getElementById('kpi-modal-proj');

    if (kpiW1) renderTex(kpiW1, '\\omega_1 = ' + M.fmt(s.w1, 2) + '\\;\\text{rad/s}', false);
    if (kpiW2) renderTex(kpiW2, '\\omega_2 = ' + M.fmt(s.w2, 2) + '\\;\\text{rad/s}', false);
    if (kpiAngle) {
      kpiAngle.textContent = M.fmt(s.physAngleDeg, 1) + '° vs. 90.0°';
    }
    if (kpiProj) {
      renderTex(kpiProj, 'r_1 = ' + M.fmt(r[0], 2) + ',\\; r_2 = ' + M.fmt(r[1], 2), false);
    }

    const eqStack = document.getElementById('sec1-matrix-eqs');
    if (eqStack) {
      eqStack.innerHTML = '<div class="c-blue"></div><div class="c-teal"></div><div class="c-orange"></div>';
      renderTex(
        eqStack.children[0],
        '\\mathbf{P} = [\\mathbf{u}_1\\;\\;\\mathbf{u}_2] = \\begin{bmatrix} ' +
          M.fmt(s.u1[0], 3) +
          ' & ' +
          M.fmt(s.u2[0], 3) +
          ' \\\\ ' +
          M.fmt(s.u1[1], 3) +
          ' & ' +
          M.fmt(s.u2[1], 3) +
          ' \\end{bmatrix}',
        false
      );
      renderTex(
        eqStack.children[1],
        '\\mathbf{u}_1^{\\mathsf{T}}\\mathbf{M}\\mathbf{u}_2 = ' +
          M.fmt(s.mInner12, 4) +
          ', \\qquad \\mathbf{P}^{\\mathsf{T}}\\mathbf{M}\\mathbf{P} = \\mathbf{I}, \\qquad \\mathbf{P}^{\\mathsf{T}}\\mathbf{K}\\mathbf{P} = \\operatorname{diag}(' +
          M.fmt(s.lam1, 2) +
          ',\\,' +
          M.fmt(s.lam2, 2) +
          ')',
        false
      );
      renderTex(
        eqStack.children[2],
        '\\mathbf{x}_0 = [' +
          M.fmt(x0[0], 2) +
          ',\\,' +
          M.fmt(x0[1], 2) +
          ']^{\\mathsf{T}} \\;\\Longrightarrow\\; \\mathbf{r}_0 = \\mathbf{P}^{\\mathsf{T}}\\mathbf{M}\\mathbf{x}_0 = [' +
          M.fmt(r[0], 2) +
          ',\\,' +
          M.fmt(r[1], 2) +
          ']^{\\mathsf{T}}',
        false
      );
    }

    const readoutEl = document.getElementById('ortho-probe-readout');
    if (readoutEl) {
      readoutEl.textContent = 'x₀ = [' + M.fmt(x0[0], 2) + ', ' + M.fmt(x0[1], 2) + ']ᵀ';
    }
  }

  /* ------------------------------------------------------------------
   * Section 2: Free Modal Superposition
   * ---------------------------------------------------------------- */
  function applyICPreset(preset, skipRender) {
    app.icPreset = preset;
    const s = app.sys;
    let x0 = [1.0, 0.0];
    if (preset === 'pluck1') {
      x0 = [1.0, 0.0];
    } else if (preset === 'pluck2') {
      x0 = [0.0, 1.0];
    } else if (preset === 'mode1') {
      const sc = 1.0 / Math.max(Math.abs(s.u1[0]), Math.abs(s.u1[1]));
      x0 = [s.u1[0] * sc, s.u1[1] * sc];
    } else if (preset === 'mode2') {
      const sc = 1.0 / Math.max(Math.abs(s.u2[0]), Math.abs(s.u2[1]));
      x0 = [s.u2[0] * sc, s.u2[1] * sc];
    } else if (preset === 'equal_mix') {
      const sc1 = 0.65 / Math.max(Math.abs(s.u1[0]), Math.abs(s.u1[1]));
      const sc2 = 0.65 / Math.max(Math.abs(s.u2[0]), Math.abs(s.u2[1]));
      x0 = [s.u1[0] * sc1 + s.u2[0] * sc2, s.u1[1] * sc1 + s.u2[1] * sc2];
    }

    document.querySelectorAll('#ic-preset-pills .pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.ic === preset);
    });

    if (app.viz.free && !skipRender) {
      app.viz.free.setIC(x0, [0, 0]);
    } else if (app.viz.free) {
      app.viz.free.setIC(x0, [0, 0]);
    }
    updateSection2Readouts(x0);
  }

  function updateSection2Readouts(x0Override) {
    const s = app.sys;
    let x0 = x0Override;
    if (!x0) {
      if (app.icPreset === 'pluck2') x0 = [0, 1];
      else if (app.icPreset === 'mode1') {
        const sc = 1 / Math.max(Math.abs(s.u1[0]), Math.abs(s.u1[1]));
        x0 = [s.u1[0] * sc, s.u1[1] * sc];
      } else if (app.icPreset === 'mode2') {
        const sc = 1 / Math.max(Math.abs(s.u2[0]), Math.abs(s.u2[1]));
        x0 = [s.u2[0] * sc, s.u2[1] * sc];
      } else {
        x0 = [1, 0];
      }
    }
    const r0 = M.physToModal(s, x0);
    const E1 = 0.5 * s.lam1 * r0[0] * r0[0];
    const E2 = 0.5 * s.lam2 * r0[1] * r0[1];
    const Etot = Math.max(1e-9, E1 + E2);

    const k1 = document.getElementById('sec2-r0');
    const k2 = document.getElementById('sec2-esplit');
    const k3 = document.getElementById('sec2-damping');

    if (k1) renderTex(k1, 'r_1(0) = ' + M.fmt(r0[0], 2) + ',\\; r_2(0) = ' + M.fmt(r0[1], 2), false);
    if (k2) {
      k2.textContent = M.fmt((E1 / Etot) * 100, 1) + '% Mode 1 / ' + M.fmt((E2 / Etot) * 100, 1) + '% Mode 2';
    }
    if (k3) {
      renderTex(k3, '\\zeta_1 = ' + M.fmt(s.zeta1, 3) + ',\\; \\zeta_2 = ' + M.fmt(s.zeta2, 3), false);
    }
  }

  /* ------------------------------------------------------------------
   * Section 3: Selective Modal Forcing Readouts
   * ---------------------------------------------------------------- */
  function updateSection3Readouts() {
    const s = app.sys;
    const f0 = app.viz.force ? app.viz.force.getForce() : [1.0, 0.0];
    const Q = M.forceToModal(s, f0);
    const qNorm = Math.hypot(Q[0], Q[1]);
    const frac1 = qNorm > 1e-9 ? (Q[0] * Q[0]) / (qNorm * qNorm) : 0;
    const frac2 = qNorm > 1e-9 ? (Q[1] * Q[1]) / (qNorm * qNorm) : 0;

    const fRead = document.getElementById('force-vec-readout');
    if (fRead) fRead.textContent = 'f₀ = [' + M.fmt(f0[0], 2) + ', ' + M.fmt(f0[1], 2) + ']ᵀ N';

    const kQ1 = document.getElementById('sec3-q1');
    const kQ2 = document.getElementById('sec3-q2');
    const kShare = document.getElementById('sec3-share');

    if (kQ1) renderTex(kQ1, 'Q_1 = \\mathbf{u}_1^{\\mathsf{T}}\\mathbf{f}_0 = ' + M.fmt(Q[0], 3), false);
    if (kQ2) renderTex(kQ2, 'Q_2 = \\mathbf{u}_2^{\\mathsf{T}}\\mathbf{f}_0 = ' + M.fmt(Q[1], 3), false);
    if (kShare) {
      kShare.textContent = M.fmt(frac1 * 100, 1) + '% Mode 1 / ' + M.fmt(frac2 * 100, 1) + '% Mode 2';
    }

    const callout = document.getElementById('sec3-callout');
    if (callout) {
      if (frac1 < 0.005) {
        callout.className = 'callout callout-teal';
        callout.innerHTML =
          '<strong>Mode 1 completely unexcited ($Q_1 \\approx 0$):</strong> Because $\\mathbf{f}_0 \\perp \\mathbf{u}_1$ in the Euclidean force inner product, Mode 1 receives zero virtual work and the $\\omega_1$ resonance peak disappears.';
      } else if (frac2 < 0.005) {
        callout.className = 'callout callout-crimson';
        callout.innerHTML =
          '<strong>Mode 2 completely unexcited ($Q_2 \\approx 0$):</strong> Because $\\mathbf{f}_0 \\perp \\mathbf{u}_2$, the force does zero virtual work on Mode 2 and the $\\omega_2$ resonance peak vanishes cleanly.';
      } else {
        callout.className = 'callout callout-blue';
        callout.innerHTML =
          '<strong>Dual-mode excitation:</strong> Both $Q_1$ and $Q_2$ are nonzero, so both natural frequencies appear in the steady-state spectrum. Drag $\\mathbf{f}_0$ onto either dashed line ($Q_1=0$ or $Q_2=0$) to silence a mode geometrically.';
      }
      typesetElement(callout);
    }
  }

  /* ------------------------------------------------------------------
   * Section 4: Antiresonance & Modal Phasor Cancellation Readouts
   * ---------------------------------------------------------------- */
  function updateSection4Readouts() {
    const s = app.sys;
    const st = app.viz.anti ? app.viz.anti.getState() : { entry: 'H11', omega: s.wa11 };
    const frf = M.evalFRF(s, st.omega);
    const idx = st.entry === 'H21' ? [1, 0] : st.entry === 'H22' ? [1, 1] : [0, 0];
    const mp = frf.modal[idx[0]][idx[1]];
    const hex = frf.exact[idx[0]][idx[1]];

    const wVal = document.getElementById('val-anti-omega');
    if (wVal) wVal.textContent = 'ω = ' + M.fmt(st.omega, 2) + ' rad/s';

    const wSlider = document.getElementById('slider-anti-omega');
    if (wSlider) wSlider.value = M.fmt(st.omega, 2);

    const kRes = document.getElementById('sec4-residues');
    const kWa = document.getElementById('sec4-wa');
    const kHval = document.getElementById('sec4-hval');

    if (kRes) {
      renderTex(
        kRes,
        'R_1 = ' + M.fmt(mp.res1, 3) + ',\\; R_2 = ' + M.fmt(mp.res2, 3),
        false
      );
    }
    if (kWa) {
      if (st.entry === 'H11') {
        renderTex(kWa, '\\omega_{\\mathrm{a},11} = \\sqrt{\\frac{k_2+k_3}{m_2}} = ' + M.fmt(s.wa11, 2) + '\\;\\text{rad/s}', false);
      } else if (st.entry === 'H22') {
        renderTex(kWa, '\\omega_{\\mathrm{a},22} = \\sqrt{\\frac{k_1+k_2}{m_1}} = ' + M.fmt(s.wa22, 2) + '\\;\\text{rad/s}', false);
      } else {
        renderTex(kWa, '\\text{No antiresonance zero } (R_1 R_2 < 0)', false);
      }
    }
    if (kHval) {
      const phDeg = (M.cArg(hex) * 180) / Math.PI;
      renderTex(kHval, '|' + st.entry + '| = ' + M.fmt(M.cAbs(hex), 4) + ',\\; \\angle = ' + M.fmt(phDeg, 1) + '^\\circ', false);
    }

    const callout = document.getElementById('sec4-callout');
    if (callout) {
      if (st.entry === 'H21') {
        callout.className = 'callout callout-blue';
        callout.innerHTML =
          '<strong>Cross-point (transfer) FRF $H_{21} = H_{12}$ (Maxwell–Betti reciprocity):</strong> Because Mode 1 moves $m_1, m_2$ in phase ($u_{21}u_{11} > 0$) while Mode 2 moves them out of phase ($u_{22}u_{12} < 0$), the modal residues have <em>opposite signs</em>. Between $\\omega_1$ and $\\omega_2$, Mode 1 has already flipped by $-180^\\circ$, so the two phasors align in the <em>same</em> direction and reinforce rather than cancel—producing no antiresonance zero and a full $-360^\\circ$ phase roll-off.';
      } else {
        const wa = st.entry === 'H11' ? s.wa11 : s.wa22;
        const nearZero = Math.abs(st.omega - wa) < 0.14 * (s.w2 - s.w1);
        callout.className = nearZero ? 'callout callout-amber' : 'callout callout-teal';
        callout.innerHTML =
          '<strong>Driving-point FRF $' +
          st.entry +
          '$ (same-sign residues $u_{j1}^2 > 0, u_{j2}^2 > 0$):</strong> Every driving-point FRF obeys Cauchy interlacing ($\\omega_1 < \\omega_{\\mathrm{a}} < \\omega_2$). Between $\\omega_1$ and $\\omega_2$, Mode 1 lags by $\\approx 180^\\circ$ while Mode 2 is still near $0^\\circ$, so $\\mathbf{h}^{(1)}$ and $\\mathbf{h}^{(2)}$ point in opposite directions and cancel at $\\omega_{\\mathrm{a}} = ' +
          M.fmt(wa, 2) +
          '\\;\\text{rad/s}$—giving a sharp notch and a $+180^\\circ$ phase recovery back toward $0^\\circ$.';
      }
      typesetElement(callout);
    }
  }

  /* ------------------------------------------------------------------
   * Section 5: Proportional vs. Non-Proportional Damping Readouts
   * ---------------------------------------------------------------- */
  function updateSection5Readouts() {
    const s = app.sys;
    const eqEl = document.getElementById('sec5-ctilde-eq');
    if (eqEl) {
      renderTex(
        eqEl,
        '\\tilde{\\mathbf{C}} = \\mathbf{P}^{\\mathsf{T}}\\mathbf{C}\\mathbf{P} = \\begin{bmatrix} ' +
          M.fmt(s.Ctilde[0][0], 3) +
          ' & ' +
          M.fmt(s.Ctilde[0][1], 3) +
          ' \\\\ ' +
          M.fmt(s.Ctilde[1][0], 3) +
          ' & ' +
          M.fmt(s.Ctilde[1][1], 3) +
          ' \\end{bmatrix}',
        true
      );
    }

    const kC12 = document.getElementById('sec5-c12');
    const kAngle = document.getElementById('sec5-angle');
    const kComm = document.getElementById('sec5-comm');
    if (kC12) renderTex(kC12, '\\tilde{c}_{12} = ' + M.fmt(s.Ctilde[0][1], 3) + '\\;(\\eta_{\\mathrm{np}} = ' + M.fmt(s.npIndex, 2) + ')', false);
    if (kAngle) kAngle.textContent = M.fmt(s.dampMisalignDeg, 1) + '°';
    if (kComm) {
      renderTex(
        kComm,
        '\\|\\mathbf{C}\\mathbf{M}^{-1}\\mathbf{K} - \\mathbf{K}\\mathbf{M}^{-1}\\mathbf{C}\\| = ' +
          M.fmt(s.commutatorNorm, 2),
        false
      );
    }
  }

  /* ------------------------------------------------------------------
   * Section 6: Dynamic MATLAB & Python Verification Code
   * ---------------------------------------------------------------- */
  function updateCodeSnippet() {
    const el = document.getElementById('live-code-block');
    if (!el) return;
    const p = app.params;
    const elocMatM =
      p.locSite === 'm2' ? '[0 0; 0 1]' : p.locSite === 'couple' ? '[1 -1; -1 1]' : '[1 0; 0 0]';
    const elocMatP =
      p.locSite === 'm2'
        ? '[[0, 0], [0, 1]]'
        : p.locSite === 'couple'
          ? '[[1, -1], [-1, 1]]'
          : '[[1, 0], [0, 0]]';

    if (app.codeLang === 'matlab') {
      el.textContent =
        '% Verify current 2-DOF modal decoupling, FRF, and antiresonance (MATLAB)\n' +
        'm1 = ' + M.fmt(p.m1, 2) + '; m2 = ' + M.fmt(p.m2, 2) + ';\n' +
        'k1 = ' + M.fmt(p.k1, 2) + '; k2 = ' + M.fmt(p.k2, 2) + '; k3 = ' + M.fmt(p.k3, 2) + ';\n' +
        'alpha = ' + M.fmt(p.alpha, 3) + '; beta = ' + M.fmt(p.beta, 3) + '; cLoc = ' + M.fmt(p.cLoc, 2) + ';\n\n' +
        'M = diag([m1, m2]);\n' +
        'K = [k1 + k2, -k2; -k2, k2 + k3];\n' +
        'C = alpha*M + beta*K + cLoc*' + elocMatM + ';\n\n' +
        '% Mass-normalized generalized eigenproblem K*P = M*P*Lambda\n' +
        '[V, D] = eig(M^(-1/2) * K * M^(-1/2));\n' +
        '[lam, idx] = sort(diag(D));\n' +
        'V = V(:, idx); P = M^(-1/2) * V; wn = sqrt(lam);\n' +
        'Ctilde = P.\' * C * P;   % Diagonal iff proportional damping\n\n' +
        'fprintf("w1 = %.3f, w2 = %.3f, wa11 = %.3f rad/s\\n", wn(1), wn(2), sqrt((k2+k3)/m2));\n' +
        'fprintf("Modal coupling ctilde_12 = %.4f\\n", Ctilde(1,2));\n\n' +
        '% Exact receptance matrix H(i*w) = (K - w^2*M + i*w*C)^(-1)\n' +
        'w = linspace(0.05, ' + M.fmt(app.sys.wMax, 2) + ', 400);\n' +
        'H11 = zeros(size(w)); H21 = zeros(size(w));\n' +
        'for j = 1:numel(w)\n' +
        '  H = (K - w(j)^2*M + 1i*w(j)*C) \\ eye(2);\n' +
        '  H11(j) = H(1,1); H21(j) = H(2,1);\n' +
        'end\n' +
        'semilogy(w, abs(H11), w, abs(H21)); grid on; legend("|H_{11}|", "|H_{21}|");';
    } else {
      el.textContent =
        '# Verify current 2-DOF modal decoupling, FRF, and antiresonance (Python)\n' +
        'import numpy as np\n\n' +
        'm1, m2 = ' + M.fmt(p.m1, 2) + ', ' + M.fmt(p.m2, 2) + '\n' +
        'k1, k2, k3 = ' + M.fmt(p.k1, 2) + ', ' + M.fmt(p.k2, 2) + ', ' + M.fmt(p.k3, 2) + '\n' +
        'alpha, beta, c_loc = ' + M.fmt(p.alpha, 3) + ', ' + M.fmt(p.beta, 3) + ', ' + M.fmt(p.cLoc, 2) + '\n\n' +
        'M = np.diag([m1, m2])\n' +
        'K = np.array([[k1 + k2, -k2], [-k2, k2 + k3]], dtype=float)\n' +
        'C = alpha * M + beta * K + c_loc * np.array(' + elocMatP + ', dtype=float)\n\n' +
        'Minv_sqrt = np.diag([m1**-0.5, m2**-0.5])\n' +
        'lam, V = np.linalg.eigh(Minv_sqrt @ K @ Minv_sqrt)\n' +
        'P = Minv_sqrt @ V              # P.T @ M @ P == I, P.T @ K @ P == diag(lam)\n' +
        'wn = np.sqrt(lam)\n' +
        'Ctilde = P.T @ C @ P           # Diagonal iff proportional damping\n' +
        'print(f"w1={wn[0]:.3f}, w2={wn[1]:.3f}, wa11={np.sqrt((k2+k3)/m2):.3f} rad/s")\n' +
        'print(f"ctilde_12={Ctilde[0, 1]:.4f}")\n\n' +
        'w = np.linspace(0.05, ' + M.fmt(app.sys.wMax, 2) + ', 400)\n' +
        'H = np.array([np.linalg.inv(K - ww**2 * M + 1j * ww * C) for ww in w])\n' +
        'H11, H21 = H[:, 0, 0], H[:, 1, 0]';
    }
  }

  /* ------------------------------------------------------------------
   * Citation Widget
   * ---------------------------------------------------------------- */
  function updateCitation() {
    const el = document.getElementById('cite-text-block');
    if (!el) return;
    const url = 'https://dchelidze.github.io/vibrations-tutorials/2dof-modal-response/';
    if (app.citeFormat === 'apa') {
      el.textContent =
        'Chelidze, D. (2026). Modal decoupling, forced 2-DOF response, and antiresonance [Interactive tutorial]. Nonlinear Dynamics Laboratory, University of Rhode Island. ' +
        url;
    } else if (app.citeFormat === 'ieee') {
      el.textContent =
        'D. Chelidze, "Modal decoupling, forced 2-DOF response, and antiresonance," Nonlinear Dynamics Laboratory, Univ. of Rhode Island, Kingston, RI, USA, 2026. [Online]. Available: ' +
        url;
    } else {
      el.textContent =
        '@misc{chelidze2026modal2dof,\n' +
        '  author       = {Chelidze, David},\n' +
        '  title        = {Modal decoupling, forced 2-DOF response, and antiresonance},\n' +
        '  howpublished = {Interactive Vibrations Tutorial, Nonlinear Dynamics Laboratory, University of Rhode Island},\n' +
        '  year         = {2026},\n' +
        '  url          = {' + url + '}\n' +
        '}';
    }
  }

  /* ------------------------------------------------------------------
   * Initialization & Event Binding
   * ---------------------------------------------------------------- */
  function init() {
    app.sys = M.analyzeSystem(app.params);

    // Create all 5 interactive visualization controllers
    app.viz.ortho = window.VibLab.VizOrthogonality.create({
      physCanvasId: 'ortho-phys-canvas',
      massCanvasId: 'ortho-mass-canvas',
      sys: app.sys,
      onProbeChange: function () {
        updateSection1Readouts();
      }
    });

    app.viz.free = window.VibLab.VizFreeModal.create({
      rigCanvasId: 'free-rig-canvas',
      waveCanvasId: 'free-wave-canvas',
      sys: app.sys
    });

    app.viz.force = window.VibLab.VizForcing.create({
      projCanvasId: 'force-proj-canvas',
      respCanvasId: 'force-resp-canvas',
      sys: app.sys,
      onForceChange: function () {
        updateSection3Readouts();
      }
    });

    app.viz.anti = window.VibLab.VizAntiresonance.create({
      bodeCanvasId: 'frf-bode-canvas',
      phasorCanvasId: 'frf-phasor-canvas',
      miniRigCanvasId: 'frf-mini-rig-canvas',
      sys: app.sys,
      onStateChange: function () {
        updateSection4Readouts();
      }
    });

    app.viz.damp = window.VibLab.VizDamping.create({
      ellipseCanvasId: 'damp-ellipse-canvas',
      compareCanvasId: 'damp-compare-canvas',
      sys: app.sys
    });

    // Presets (Hero + Drawer)
    function loadPreset(key) {
      const p = M.PRESETS[key];
      if (!p) return;
      app.presetKey = key;
      app.params = Object.assign({}, p);
      recompute(false);
      if (app.viz.anti) app.viz.anti.snapToAntiresonance();
    }

    document.querySelectorAll('#preset-selector .pill, #drawer-presets button').forEach((btn) => {
      btn.addEventListener('click', () => loadPreset(btn.dataset.preset));
    });

    // Drawer toggle & sliders
    const drawer = document.getElementById('param-drawer');
    const toggleDrawer = () => drawer && drawer.classList.toggle('open');
    const btnParams = document.getElementById('btn-params');
    const btnClose = document.getElementById('btn-close-drawer');
    if (btnParams) btnParams.addEventListener('click', toggleDrawer);
    if (btnClose) btnClose.addEventListener('click', () => drawer.classList.remove('open'));

    const sliderKeys = [
      ['slider-m1', 'm1'],
      ['slider-m2', 'm2'],
      ['slider-k1', 'k1'],
      ['slider-k2', 'k2'],
      ['slider-k3', 'k3'],
      ['slider-alpha', 'alpha'],
      ['slider-beta', 'beta'],
      ['slider-cloc', 'cLoc']
    ];
    for (const [id, prop] of sliderKeys) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('input', () => {
        app.presetKey = null;
        app.params[prop] = parseFloat(el.value);
        recompute(false);
      });
    }

    // Section 1 checkboxes & reset
    const chkEuc = document.getElementById('chk-ortho-euc');
    const chkStiff = document.getElementById('chk-ortho-stiff');
    if (chkEuc) chkEuc.addEventListener('change', () => app.viz.ortho.setOptions({ showEuclidean: chkEuc.checked }));
    if (chkStiff) chkStiff.addEventListener('change', () => app.viz.ortho.setOptions({ showStiffness: chkStiff.checked }));
    const btnResetProbe = document.getElementById('btn-reset-probe');
    if (btnResetProbe) btnResetProbe.addEventListener('click', () => app.viz.ortho.setProbe([1.05, 0.25]));

    // Section 2 controls
    document.querySelectorAll('#ic-preset-pills .pill').forEach((btn) => {
      btn.addEventListener('click', () => applyICPreset(btn.dataset.ic));
    });
    const btnFreePlay = document.getElementById('btn-free-play');
    if (btnFreePlay) {
      btnFreePlay.addEventListener('click', () => {
        const next = !app.viz.free.isPlaying();
        app.viz.free.setPlaying(next);
        btnFreePlay.textContent = next ? 'Pause' : 'Play';
      });
    }
    const btnFreeReset = document.getElementById('btn-free-reset');
    if (btnFreeReset) btnFreeReset.addEventListener('click', () => app.viz.free.resetTime());
    const chkEnergy = document.getElementById('chk-show-energy');
    if (chkEnergy) chkEnergy.addEventListener('change', () => app.viz.free.setShowEnergy(chkEnergy.checked));

    // Section 3 forcing preset buttons
    document.querySelectorAll('#force-preset-btns button').forEach((btn) => {
      btn.addEventListener('click', () => app.viz.force.setPresetForce(btn.dataset.fpreset));
    });

    // Section 4 FRF entry pills, omega slider, and snap buttons
    document.querySelectorAll('#frf-entry-pills .pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#frf-entry-pills .pill').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        app.viz.anti.setEntry(btn.dataset.entry);
      });
    });
    const wSlider = document.getElementById('slider-anti-omega');
    if (wSlider) {
      wSlider.addEventListener('input', () => app.viz.anti.setOmega(parseFloat(wSlider.value)));
    }
    const btnSnapWa = document.getElementById('btn-snap-wa');
    if (btnSnapWa) btnSnapWa.addEventListener('click', () => app.viz.anti.snapToAntiresonance());
    const btnSnapW1 = document.getElementById('btn-snap-w1');
    if (btnSnapW1) btnSnapW1.addEventListener('click', () => app.viz.anti.setOmega(app.sys.w1));
    const btnSnapW2 = document.getElementById('btn-snap-w2');
    if (btnSnapW2) btnSnapW2.addEventListener('click', () => app.viz.anti.setOmega(app.sys.w2));

    // Section 5 localized damper controls
    const sec5Slider = document.getElementById('slider-sec5-cloc');
    if (sec5Slider) {
      sec5Slider.addEventListener('input', () => {
        app.presetKey = null;
        app.params.cLoc = parseFloat(sec5Slider.value);
        recompute(false);
      });
    }
    document.querySelectorAll('#damp-site-pills .pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        app.presetKey = null;
        app.params.locSite = btn.dataset.site;
        recompute(false);
      });
    });
    const btnZeroCloc = document.getElementById('btn-zero-cloc');
    if (btnZeroCloc) {
      btnZeroCloc.addEventListener('click', () => {
        app.presetKey = null;
        app.params.cLoc = 0;
        recompute(false);
      });
    }

    // Section 6 code tabs & copy
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

    // Citation tabs & copy
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

    // Scroll spy for chapter nav
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

    // Resize listener
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderAll, 60);
    });

    // Initial KaTeX typeset + render
    typesetElement(document.body);
    recompute(false);
    updateCitation();
    updateScrollSpy();

    // 60fps animation loop for Section 2 rig & Section 4 steady-state mini-rig
    let lastTs = performance.now();
    function tick(now) {
      const dt = Math.min(0.04, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      if (app.viz.free) app.viz.free.step(dt);
      if (app.viz.anti) app.viz.anti.step(dt);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderAll() {
    if (app.viz.ortho) app.viz.ortho.render();
    if (app.viz.free) app.viz.free.render();
    if (app.viz.force) app.viz.force.render();
    if (app.viz.anti) app.viz.anti.render();
    if (app.viz.damp) app.viz.damp.render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
