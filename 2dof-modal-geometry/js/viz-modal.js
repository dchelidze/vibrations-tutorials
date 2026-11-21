/**
 * viz-modal.js
 * Section 5: Modal Superposition Studio.
 * Synchronizes 3 live physical animations (Mode 1, Mode 2, Combined)
 * with dual trajectory plots: skewed physical (q1, q2) parallelogram vs axis-aligned modal (eta1, eta2) box.
 */
window.VibLab = window.VibLab || {};

window.VibLab.ModalViz = (function () {
  'use strict';

  const M2 = window.VibLab.Math2D;
  const Theme = window.VibLab.Theme;
  const Sys = window.VibLab.Systems;

  function create(opts) {
    const cMode1 = opts.mode1Canvas;
    const cMode2 = opts.mode2Canvas;
    const cTotal = opts.totalCanvas;
    const cPhysTraj = opts.physTrajCanvas;
    const cModTraj = opts.modTrajCanvas;

    const state = {
      sysKey: opts.sysKey,
      params: opts.params,
      eigen: opts.eigen,
      A1: 0.65,
      A2: 0.55,
      phi2: 0, // phase offset of mode 2 in radians
      t: 0,
      playing: true,
      trail: [],
      visible: true
    };

    function setSystem(sysKey, params, eigen) {
      state.sysKey = sysKey;
      state.params = params;
      state.eigen = eigen;
      state.trail = [];
      state.t = 0;
    }

    function setAmplitudes(A1, A2, phi2) {
      if (A1 !== undefined) state.A1 = A1;
      if (A2 !== undefined) state.A2 = A2;
      if (phi2 !== undefined) state.phi2 = phi2;
      state.trail = [];
    }

    function setPreset(name) {
      const eig = state.eigen;
      if (name === 'mode1') {
        state.A1 = 0.85;
        state.A2 = 0.0;
        state.phi2 = 0;
      } else if (name === 'mode2') {
        state.A1 = 0.0;
        state.A2 = 0.85;
        state.phi2 = 0;
      } else if (name === 'pluck1') {
        // Compute modal amplitudes that produce q(0) = [0.75, 0]
        const eta0 = M2.matVec(eig.PhiInv, [0.75, 0]);
        const maxE = Math.max(Math.abs(eta0[0]), Math.abs(eta0[1]), 0.01);
        const normScale = 0.85 / maxE;
        state.A1 = Math.min(1.0, Math.abs(eta0[0] * normScale));
        state.A2 = Math.min(1.0, Math.abs(eta0[1] * normScale));
        state.phi2 = eta0[0] * eta0[1] < 0 ? Math.PI : 0;
      } else {
        state.A1 = 0.65;
        state.A2 = 0.55;
        state.phi2 = 0;
      }
      state.trail = [];
      state.t = 0;
      state.playing = true;
      if (opts.onParamsSync) opts.onParamsSync(state.A1, state.A2, state.phi2);
    }

    function togglePlay() {
      state.playing = !state.playing;
      return state.playing;
    }

    function step(dt) {
      if (!state.visible) return;
      if (state.playing) {
        state.t += dt;
      }

      const eig = state.eigen;
      const w1 = eig.omegas[0];
      const w2 = eig.omegas[1];

      // Normalize display scale so unit amplitude corresponds to crisp physical motion
      const n1 = Math.max(1e-6, M2.norm(eig.u1));
      const n2 = Math.max(1e-6, M2.norm(eig.u2));
      const u1Unit = [eig.u1[0] / n1, eig.u1[1] / n1];
      const u2Unit = [eig.u2[0] / n2, eig.u2[1] / n2];

      const e1 = state.A1 * Math.cos(w1 * state.t);
      const e2 = state.A2 * Math.cos(w2 * state.t + state.phi2);

      const qMode1 = [e1 * u1Unit[0], e1 * u1Unit[1]];
      const qMode2 = [e2 * u2Unit[0], e2 * u2Unit[1]];
      const qTotal = [qMode1[0] + qMode2[0], qMode1[1] + qMode2[1]];

      if (state.playing) {
        state.trail.push({ q: qTotal, eta: [e1, e2] });
        if (state.trail.length > 260) state.trail.shift();
      }

      const C = Theme.colors();

      // Draw 3 physical mini-simulators
      drawMini(cMode1, qMode1, C.mode1, 'Mode 1  (ω₁ = ' + M2.fmt(w1, 2) + ' rad/s)');
      drawMini(cMode2, qMode2, C.mode2, 'Mode 2  (ω₂ = ' + M2.fmt(w2, 2) + ' rad/s)');
      drawMini(cTotal, qTotal, C.accent, 'Combined  q(t) = η₁u₁ + η₂u₂');

      // Draw dual trajectory canvases
      renderPhysTraj(u1Unit, u2Unit, qTotal);
      renderModTraj([e1, e2]);
    }

    function drawMini(canvas, q, accentColor, label) {
      const { ctx, w, h } = Theme.setupHiDPI(canvas);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      Sys.drawSystem(ctx, state.sysKey, state.params, q, w, h, {
        compact: true,
        accentColor: accentColor,
        showLabels: false,
        scaleAmp: 0.85
      });

      ctx.save();
      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = accentColor;
      ctx.textAlign = 'center';
      ctx.fillText(label, w * 0.5, h - 8);
      ctx.restore();
    }

    function renderPhysTraj(u1, u2, qNow) {
      const { ctx, w, h } = Theme.setupHiDPI(cPhysTraj);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.5;
      const cy = h * 0.53;
      const maxR = Math.max(0.8, state.A1 + state.A2) * 1.15;
      const scale = (Math.min(w, h) * 0.4) / maxR;
      const toPx = (v) => [cx + v[0] * scale, cy - v[1] * scale];

      // Axes
      Theme.drawArrow(ctx, 14, cy, w - 14, cy, C.axis, 1.2, 6);
      Theme.drawArrow(ctx, cx, h - 14, cx, 24, C.axis, 1.2, 6);
      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = C.textMuted;
      ctx.textAlign = 'right';
      ctx.fillText('q₁', w - 16, cy - 6);
      ctx.textAlign = 'left';
      ctx.fillText('q₂', cx + 6, 32);

      // Skewed bounding parallelogram ±A1*u1 ± A2*u2
      const a1 = [u1[0] * state.A1, u1[1] * state.A1];
      const a2 = [u2[0] * state.A2, u2[1] * state.A2];
      const corners = [
        toPx([a1[0] + a2[0], a1[1] + a2[1]]),
        toPx([-a1[0] + a2[0], -a1[1] + a2[1]]),
        toPx([-a1[0] - a2[0], -a1[1] - a2[1]]),
        toPx([a1[0] - a2[0], a1[1] - a2[1]])
      ];
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = C.gridBold;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Mode direction basis arrows
      const pO = toPx([0, 0]);
      if (state.A1 > 0.02) {
        const p1 = toPx(a1);
        Theme.drawArrow(ctx, pO[0], pO[1], p1[0], p1[1], C.mode1, 1.8, 7);
      }
      if (state.A2 > 0.02) {
        const p2 = toPx(a2);
        Theme.drawArrow(ctx, pO[0], pO[1], p2[0], p2[1], C.mode2, 1.8, 7);
      }

      // Trajectory trail
      if (state.trail.length > 1) {
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = C.trajectory;
        ctx.beginPath();
        state.trail.forEach((pt, i) => {
          const p = toPx(pt.q);
          if (i === 0) ctx.moveTo(p[0], p[1]);
          else ctx.lineTo(p[0], p[1]);
        });
        ctx.stroke();
        ctx.restore();
      }

      // Live state point
      const pNow = toPx(qNow);
      ctx.fillStyle = C.trajectory;
      ctx.beginPath();
      ctx.arc(pNow[0], pNow[1], 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = C.text;
      ctx.textAlign = 'left';
      ctx.fillText('Physical Space (q₁, q₂) — Skewed Parallelogram', 10, 17);
    }

    function renderModTraj(etaNow) {
      const { ctx, w, h } = Theme.setupHiDPI(cModTraj);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.5;
      const cy = h * 0.53;
      const maxR = Math.max(0.8, Math.hypot(state.A1, state.A2)) * 1.15;
      const scale = (Math.min(w, h) * 0.4) / maxR;
      const toPx = (v) => [cx + v[0] * scale, cy - v[1] * scale];

      // Axes
      Theme.drawArrow(ctx, 14, cy, w - 14, cy, C.mode1, 1.4, 6);
      Theme.drawArrow(ctx, cx, h - 14, cx, 24, C.mode2, 1.4, 6);
      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = C.mode1;
      ctx.textAlign = 'right';
      ctx.fillText('η₁', w - 16, cy - 6);
      ctx.fillStyle = C.mode2;
      ctx.textAlign = 'left';
      ctx.fillText('η₂', cx + 6, 32);

      // Clean axis-aligned bounding rectangle [-A1, A1] x [-A2, A2]
      const tl = toPx([-state.A1, state.A2]);
      const br = toPx([state.A1, -state.A2]);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = C.gridBold;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]);
      ctx.restore();

      // Trajectory trail
      if (state.trail.length > 1) {
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = C.trajectory;
        ctx.beginPath();
        state.trail.forEach((pt, i) => {
          const p = toPx(pt.eta);
          if (i === 0) ctx.moveTo(p[0], p[1]);
          else ctx.lineTo(p[0], p[1]);
        });
        ctx.stroke();
        ctx.restore();
      }

      // Live projections onto modal axes
      const pNow = toPx(etaNow);
      const pE1 = toPx([etaNow[0], 0]);
      const pE2 = toPx([0, etaNow[1]]);

      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = C.mode1;
      ctx.beginPath();
      ctx.moveTo(pNow[0], pNow[1]);
      ctx.lineTo(pE1[0], pE1[1]);
      ctx.stroke();
      ctx.strokeStyle = C.mode2;
      ctx.beginPath();
      ctx.moveTo(pNow[0], pNow[1]);
      ctx.lineTo(pE2[0], pE2[1]);
      ctx.stroke();
      ctx.restore();

      // Axis oscillator beads
      ctx.fillStyle = C.mode1;
      ctx.beginPath();
      ctx.arc(pE1[0], pE1[1], 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.mode2;
      ctx.beginPath();
      ctx.arc(pE2[0], pE2[1], 4, 0, Math.PI * 2);
      ctx.fill();

      // Main dot
      ctx.fillStyle = C.trajectory;
      ctx.beginPath();
      ctx.arc(pNow[0], pNow[1], 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = C.text;
      ctx.textAlign = 'left';
      ctx.fillText('Modal Space (η₁, η₂) — Orthogonal Decoupled Box', 10, 17);
    }

    return {
      step,
      setSystem,
      setAmplitudes,
      setPreset,
      togglePlay,
      setVisible: (v) => (state.visible = v),
      getState: () => state
    };
  }

  return { create };
})();
