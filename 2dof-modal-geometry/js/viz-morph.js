/**
 * viz-morph.js
 * Section 4:
 *   1. Dedicated plot of the symmetric mass-weighted stiffness ellipse:
 *        z^T (M^(-1/2) K M^(-1/2)) z = 1
 *      showing orthogonal eigenvectors p1 ⊥ p2, exact semi-axes 1/omega_1 and 1/omega_2,
 *      and the rotation angle theta_P to modal coordinates eta = P^T z.
 *   2. Continuous 2-stage Simultaneous Diagonalization Motion Graphic (t in [0, 2]):
 *        Stage 0 -> 1: z = M^(1/2) q   (M -> I unit circle, K -> K_tilde = M^(-1/2) K M^(-1/2), u_i -> p_i)
 *        Stage 1 -> 2: eta = P^T z     (I stays I, K_tilde -> Lambda = diag(w1^2, w2^2), Phi = M^(-1/2) P)
 */
window.VibLab = window.VibLab || {};

window.VibLab.MorphViz = (function () {
  'use strict';

  const M2 = window.VibLab.Math2D;
  const Theme = window.VibLab.Theme;

  function create(opts) {
    const canvas = opts.canvas;
    const kTildeCanvas = opts.kTildeCanvas;

    const state = {
      eigen: opts.eigen,
      t: 0, // continuous in [0, 2]
      targetT: null,
      playing: false,
      direction: 1,
      pauseTimer: 0,
      showDeformedGrid: true,
      showParallelogram: true,
      visible: true
    };

    function setEigen(eigen) {
      state.eigen = eigen;
      render();
    }

    function setT(tVal, stopAnim) {
      state.t = Math.max(0, Math.min(2, tVal));
      if (stopAnim) {
        state.playing = false;
        state.targetT = null;
        if (opts.onPlayChange) opts.onPlayChange(false);
      }
      renderMorph();
    }

    function animateToStage(stageIdx) {
      state.playing = false;
      state.targetT = Math.max(0, Math.min(2, stageIdx));
      if (opts.onPlayChange) opts.onPlayChange(false);
    }

    function playForward() {
      state.targetT = null;
      if (state.t >= 1.99) state.t = 0;
      state.direction = 1;
      state.playing = true;
      state.pauseTimer = 0;
      if (opts.onPlayChange) opts.onPlayChange(true);
    }

    function playReverse() {
      state.targetT = null;
      if (state.t <= 0.01) state.t = 2;
      state.direction = -1;
      state.playing = true;
      state.pauseTimer = 0;
      if (opts.onPlayChange) opts.onPlayChange(true);
    }

    function togglePlay() {
      if (state.playing) {
        state.playing = false;
        state.targetT = null;
      } else {
        if (state.t >= 1.99) {
          state.t = 0;
          state.direction = 1;
        }
        state.playing = true;
        state.pauseTimer = 0;
      }
      if (opts.onPlayChange) opts.onPlayChange(state.playing);
      return state.playing;
    }

    function setOptions(o) {
      if (o.showDeformedGrid !== undefined) state.showDeformedGrid = o.showDeformedGrid;
      if (o.showParallelogram !== undefined) state.showParallelogram = o.showParallelogram;
      renderMorph();
    }

    function step(dt) {
      if (!state.visible) return;
      let dirty = false;

      if (state.targetT !== null) {
        const diff = state.targetT - state.t;
        const speed = 1.45;
        if (Math.abs(diff) <= speed * dt) {
          state.t = state.targetT;
          state.targetT = null;
        } else {
          state.t += Math.sign(diff) * speed * dt;
        }
        dirty = true;
      } else if (state.playing) {
        if (state.pauseTimer > 0) {
          state.pauseTimer -= dt;
        } else {
          const prevT = state.t;
          const speed = 0.48;
          let nextT = prevT + state.direction * speed * dt;

          if (state.direction > 0) {
            if (prevT < 1 && nextT >= 1) {
              nextT = 1;
              state.pauseTimer = 0.95; // linger on exact K_tilde = M^(-1/2) K M^(-1/2)!
            } else if (nextT >= 2) {
              nextT = 2;
              state.playing = false;
              if (opts.onPlayChange) opts.onPlayChange(false);
            }
          } else {
            if (prevT > 1 && nextT <= 1) {
              nextT = 1;
              state.pauseTimer = 0.75;
            } else if (nextT <= 0) {
              nextT = 0;
              state.playing = false;
              if (opts.onPlayChange) opts.onPlayChange(false);
            }
          }
          state.t = nextT;
          dirty = true;
        }
      }

      if (dirty) renderMorph();
    }

    function render() {
      renderKTilde();
      renderMorph();
    }

    /* ---------------------------------------------------------------
     * Dedicated Plot of the Exact Ellipse z^T (M^(-1/2) K M^(-1/2)) z = 1
     * ------------------------------------------------------------- */
    function renderKTilde() {
      if (!kTildeCanvas) return;
      const { ctx, w, h } = Theme.setupHiDPI(kTildeCanvas);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const eig = state.eigen;
      const w1 = eig.omegas[0];
      const w2 = eig.omegas[1];
      const a = 1 / w1; // semi-major axis = 1 / omega_1
      const b = 1 / w2; // semi-minor axis = 1 / omega_2
      const p1 = eig.p1;
      const p2 = eig.p2;

      const ell = M2.sampleEllipse(eig.KTilde, 1.0, 140);
      const maxR = Math.max(a * 1.28, 0.12);
      const cx = w * 0.5;
      const cy = h * 0.53;
      const scale = (Math.min(w, h) * 0.37) / maxR;
      const toPx = (u) => [cx + u[0] * scale, cy - u[1] * scale];

      // Subtle grid
      ctx.save();
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      const stepG = a > 0.45 ? 0.2 : 0.1;
      const nG = Math.ceil((maxR * 1.5) / stepG);
      for (let i = -nG; i <= nG; i++) {
        const v = i * stepG;
        const pA = toPx([v, -nG * stepG]);
        const pB = toPx([v, nG * stepG]);
        ctx.beginPath();
        ctx.moveTo(pA[0], pA[1]);
        ctx.lineTo(pB[0], pB[1]);
        ctx.stroke();

        const qA = toPx([-nG * stepG, v]);
        const qB = toPx([nG * stepG, v]);
        ctx.beginPath();
        ctx.moveTo(qA[0], qA[1]);
        ctx.lineTo(qB[0], qB[1]);
        ctx.stroke();
      }
      ctx.restore();

      // Concentric reference circles r = 1/w1 (outer) and r = 1/w2 (inner)
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = C.mode1;
      ctx.globalAlpha = 0.32;
      ctx.beginPath();
      ctx.arc(cx, cy, a * scale, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = C.mode2;
      ctx.beginPath();
      ctx.arc(cx, cy, b * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Coordinate axes (z1, z2)
      Theme.drawArrow(ctx, 16, cy, w - 16, cy, C.axis, 1.3, 6);
      Theme.drawArrow(ctx, cx, h - 16, cx, 26, C.axis, 1.3, 6);
      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = C.textMuted;
      ctx.textAlign = 'right';
      ctx.fillText('z₁', w - 18, cy - 7);
      ctx.textAlign = 'left';
      ctx.fillText('z₂', cx + 7, 34);

      // Exact K_tilde ellipse: z^T K_tilde z = 1
      ctx.save();
      ctx.beginPath();
      ell.pts.forEach((pt, i) => {
        const p = toPx(pt);
        if (i === 0) ctx.moveTo(p[0], p[1]);
        else ctx.lineTo(p[0], p[1]);
      });
      ctx.closePath();
      ctx.fillStyle = C.stiffFill;
      ctx.fill();
      ctx.strokeStyle = C.stiff;
      ctx.lineWidth = 2.8;
      ctx.stroke();
      ctx.restore();

      // Rotation angle arc theta_P from z1-axis to p1
      const betaDeg = ((eig.betaP * 180) / Math.PI).toFixed(1);
      if (Math.abs(eig.betaP) > 0.03) {
        ctx.save();
        ctx.strokeStyle = C.accent;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        const rArc = Math.min(36, a * scale * 0.42);
        ctx.arc(cx, cy, rArc, 0, -eig.betaP, eig.betaP > 0);
        ctx.stroke();

        const midA = -eig.betaP * 0.5;
        ctx.font = '700 10.5px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = C.accent;
        ctx.textAlign = 'center';
        ctx.fillText('θ_P=' + betaDeg + '°', cx + (rArc + 24) * Math.cos(midA), cy + (rArc + 14) * Math.sin(midA) + 3);
        ctx.restore();
      }

      // Right-angle square between p1 and p2 (always exact 90 deg!)
      const sq = 13;
      const pSqA = [cx + p1[0] * sq, cy - p1[1] * sq];
      const pSqB = [cx + (p1[0] + p2[0]) * sq, cy - (p1[1] + p2[1]) * sq];
      const pSqC = [cx + p2[0] * sq, cy - p2[1] * sq];
      ctx.save();
      ctx.strokeStyle = C.mode1;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(pSqA[0], pSqA[1]);
      ctx.lineTo(pSqB[0], pSqB[1]);
      ctx.lineTo(pSqC[0], pSqC[1]);
      ctx.stroke();
      ctx.restore();

      // Principal axis full dashed lines & semi-axis vectors a*p1 and b*p2
      const p1Tip = toPx([p1[0] * a, p1[1] * a]);
      const p1Neg = toPx([-p1[0] * a, -p1[1] * a]);
      const p2Tip = toPx([p2[0] * b, p2[1] * b]);
      const p2Neg = toPx([-p2[0] * b, -p2[1] * b]);

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.3;
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = C.mode1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(p1Neg[0], p1Neg[1]);
      ctx.stroke();
      ctx.strokeStyle = C.mode2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(p2Neg[0], p2Neg[1]);
      ctx.stroke();
      ctx.restore();

      Theme.drawArrow(ctx, cx, cy, p1Tip[0], p1Tip[1], C.mode1, 2.8, 9);
      Theme.drawArrow(ctx, cx, cy, p2Tip[0], p2Tip[1], C.mode2, 2.8, 9);

      // Semi-axis labels directly at tips
      ctx.font = '700 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = C.mode1;
      ctx.fillText(
        'p₁  (1/ω₁ = ' + M2.fmt(a, 2) + ')',
        p1Tip[0] + p1[0] * 24,
        p1Tip[1] - p1[1] * 22 + (p1[1] >= 0 ? -4 : 12)
      );
      ctx.fillStyle = C.mode2;
      ctx.fillText(
        'p₂  (1/ω₂ = ' + M2.fmt(b, 2) + ')',
        p2Tip[0] + p2[0] * 26,
        p2Tip[1] - p2[1] * 22 + (p2[1] >= 0 ? -6 : 12)
      );

      // Top & bottom captions
      ctx.font = '600 11.5px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = C.stiff;
      ctx.fillText('● Exact Ellipse: zᵀ(M⁻¹ᐟ²KM⁻¹ᐟ²)z = 1', 12, 18);

      ctx.font = '500 11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = C.textMuted;
      ctx.fillText(
        'p₁ ⊥ p₂ (90.0°)  |  Aspect ratio a/b = ω₂/ω₁ = ' + M2.fmt(w2 / w1, 2),
        w * 0.5,
        h - 10
      );
    }

    /* ---------------------------------------------------------------
     * Continuous 2-Stage Morph Canvas (t in [0, 2])
     * ------------------------------------------------------------- */
    function renderMorph() {
      const { ctx, w, h } = Theme.setupHiDPI(canvas);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const eig = state.eigen;
      const ms = M2.morphStateAt(eig, state.t);

      // Visual normalization for Stiffness Ellipse: divide K(t) by w0Sq = sqrt(lam1 * lam2)
      // so both M(t) and K(t) share the same visual scale throughout the morph
      const w0Sq = Math.sqrt(eig.lambdas[0] * eig.lambdas[1]);
      const KtVis = [
        [ms.Kt[0][0] / w0Sq, ms.Kt[0][1] / w0Sq],
        [ms.Kt[1][0] / w0Sq, ms.Kt[1][1] / w0Sq]
      ];

      const ellM = M2.sampleEllipse(ms.Mt, 1.0, 128);
      const ellK = M2.sampleEllipse(KtVis, 1.0, 128);

      // Compute stable viewport scale across t in {0, 1, 2}
      const ms0 = M2.morphStateAt(eig, 0);
      const ms2 = M2.morphStateAt(eig, 2);
      const eM0 = M2.sampleEllipse(ms0.Mt, 1.0, 16);
      const eK0 = M2.sampleEllipse(
        [
          [ms0.Kt[0][0] / w0Sq, ms0.Kt[0][1] / w0Sq],
          [ms0.Kt[1][0] / w0Sq, ms0.Kt[1][1] / w0Sq]
        ],
        1.0,
        16
      );
      const eK2 = M2.sampleEllipse(
        [
          [ms2.Kt[0][0] / w0Sq, ms2.Kt[0][1] / w0Sq],
          [ms2.Kt[1][0] / w0Sq, ms2.Kt[1][1] / w0Sq]
        ],
        1.0,
        16
      );
      const maxExtent = Math.max(
        1.15,
        eM0.semiAxes[0],
        eK0.semiAxes[0],
        eK2.semiAxes[0],
        M2.norm(ms.u1t),
        M2.norm(ms.u2t)
      );

      const cx = w * 0.5;
      const cy = h * 0.52;
      const scale = (Math.min(w, h) * 0.355) / maxExtent;
      const toPx = (u) => [cx + u[0] * scale, cy - u[1] * scale];

      // 1. Faint fixed background screen grid
      ctx.save();
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      const bgLim = Math.ceil(maxExtent * 2);
      for (let i = -bgLim; i <= bgLim; i++) {
        const a = toPx([i * 0.5, -bgLim * 0.5]);
        const b = toPx([i * 0.5, bgLim * 0.5]);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();

        const c = toPx([-bgLim * 0.5, i * 0.5]);
        const d = toPx([bgLim * 0.5, i * 0.5]);
        ctx.beginPath();
        ctx.moveTo(c[0], c[1]);
        ctx.lineTo(d[0], d[1]);
        ctx.stroke();
      }
      ctx.restore();

      // 2. Deforming Physical Coordinate Grid L(t) * Z^2
      if (state.showDeformedGrid) {
        ctx.save();
        ctx.strokeStyle = Theme.isDark() ? 'rgba(96, 165, 250, 0.14)' : 'rgba(37, 99, 235, 0.11)';
        ctx.lineWidth = 1.1;
        const gRange = 3.5;
        const gStep = 0.5;
        for (let v = -gRange; v <= gRange + 1e-6; v += gStep) {
          const p1 = toPx(M2.matVec(ms.L, [v, -gRange]));
          const p2 = toPx(M2.matVec(ms.L, [v, gRange]));
          ctx.beginPath();
          ctx.moveTo(p1[0], p1[1]);
          ctx.lineTo(p2[0], p2[1]);
          ctx.stroke();

          const q1 = toPx(M2.matVec(ms.L, [-gRange, v]));
          const q2 = toPx(M2.matVec(ms.L, [gRange, v]));
          ctx.beginPath();
          ctx.moveTo(q1[0], q1[1]);
          ctx.lineTo(q2[0], q2[1]);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 3. Coordinate Axes
      Theme.drawArrow(ctx, 18, cy, w - 18, cy, C.axis, 1.5, 7);
      Theme.drawArrow(ctx, cx, h - 18, cx, 28, C.axis, 1.5, 7);

      let ax1Lbl = 'q₁';
      let ax2Lbl = 'q₂';
      if (state.t >= 1.7) {
        ax1Lbl = 'η₁ (Mode 1)';
        ax2Lbl = 'η₂ (Mode 2)';
      } else if (state.t >= 0.7) {
        ax1Lbl = 'z₁ = (M¹ᐟ²q)₁';
        ax2Lbl = 'z₂ = (M¹ᐟ²q)₂';
      }
      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = C.textMuted;
      ctx.textAlign = 'right';
      ctx.fillText(ax1Lbl, w - 20, cy - 8);
      ctx.textAlign = 'left';
      ctx.fillText(ax2Lbl, cx + 8, 38);

      // 4. Optional Conjugate Tangent Box (±u1(t) ± u2(t))
      if (state.showParallelogram) {
        const u1 = ms.u1t;
        const u2 = ms.u2t;
        const c1 = toPx([u1[0] + u2[0], u1[1] + u2[1]]);
        const c2 = toPx([-u1[0] + u2[0], -u1[1] + u2[1]]);
        const c3 = toPx([-u1[0] - u2[0], -u1[1] - u2[1]]);
        const c4 = toPx([u1[0] - u2[0], u1[1] - u2[1]]);
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = Theme.isDark() ? 'rgba(251, 191, 36, 0.45)' : 'rgba(217, 119, 6, 0.42)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(c1[0], c1[1]);
        ctx.lineTo(c2[0], c2[1]);
        ctx.lineTo(c3[0], c3[1]);
        ctx.lineTo(c4[0], c4[1]);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      // 5. Morphing Mass Ellipse M(t)
      const isUnitCircle = state.t >= 0.96;
      ctx.save();
      ctx.beginPath();
      ellM.pts.forEach((pt, i) => {
        const p = toPx(pt);
        if (i === 0) ctx.moveTo(p[0], p[1]);
        else ctx.lineTo(p[0], p[1]);
      });
      ctx.closePath();
      ctx.fillStyle = C.massFill;
      ctx.fill();
      ctx.strokeStyle = C.mass;
      ctx.lineWidth = isUnitCircle ? 3.2 : 2.6;
      if (isUnitCircle) {
        ctx.shadowColor = C.massGlow;
        ctx.shadowBlur = 12;
      }
      ctx.stroke();
      ctx.restore();

      // 6. Morphing Stiffness Ellipse K(t)/w0^2
      const isModal = state.t >= 1.96;
      ctx.save();
      ctx.beginPath();
      ellK.pts.forEach((pt, i) => {
        const p = toPx(pt);
        if (i === 0) ctx.moveTo(p[0], p[1]);
        else ctx.lineTo(p[0], p[1]);
      });
      ctx.closePath();
      ctx.fillStyle = C.stiffFill;
      ctx.fill();
      ctx.strokeStyle = C.stiff;
      ctx.lineWidth = isModal || (state.t > 0.96 && state.t < 1.04) ? 3.2 : 2.6;
      if (isModal) {
        ctx.shadowColor = C.stiffGlow;
        ctx.shadowBlur = 12;
      }
      ctx.stroke();
      ctx.restore();

      // 7. Angle indicator between u1(t) and u2(t)
      const pO = toPx([0, 0]);
      const u1 = ms.u1t;
      const u2 = ms.u2t;
      const n1 = Math.max(1e-6, M2.norm(u1));
      const n2 = Math.max(1e-6, M2.norm(u2));
      const e1 = [u1[0] / n1, u1[1] / n1];
      const e2 = [u2[0] / n2, u2[1] / n2];
      const isRightAngle = Math.abs(ms.angleDeg - 90) < 0.8;

      ctx.save();
      if (isRightAngle) {
        const sq = 16;
        const pA = [pO[0] + e1[0] * sq, pO[1] - e1[1] * sq];
        const pB = [pO[0] + (e1[0] + e2[0]) * sq, pO[1] - (e1[1] + e2[1]) * sq];
        const pC = [pO[0] + e2[0] * sq, pO[1] - e2[1] * sq];
        ctx.strokeStyle = C.mode1;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pA[0], pA[1]);
        ctx.lineTo(pB[0], pB[1]);
        ctx.lineTo(pC[0], pC[1]);
        ctx.stroke();
      } else {
        const a1 = Math.atan2(-e1[1], e1[0]);
        const a2 = Math.atan2(-e2[1], e2[0]);
        let dAng = a2 - a1;
        while (dAng > Math.PI) dAng -= 2 * Math.PI;
        while (dAng < -Math.PI) dAng += 2 * Math.PI;
        ctx.strokeStyle = C.accent;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(pO[0], pO[1], 24, a1, a1 + dAng, dAng < 0);
        ctx.stroke();
      }
      ctx.restore();

      // 8. Morphing Mode Vectors u1(t) and u2(t)
      const pU1 = toPx(u1);
      const pU2 = toPx(u2);
      const pU1Neg = toPx([-u1[0], -u1[1]]);
      const pU2Neg = toPx([-u2[0], -u2[1]]);

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = C.mode1;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(pO[0], pO[1]);
      ctx.lineTo(pU1Neg[0], pU1Neg[1]);
      ctx.stroke();
      ctx.strokeStyle = C.mode2;
      ctx.beginPath();
      ctx.moveTo(pO[0], pO[1]);
      ctx.lineTo(pU2Neg[0], pU2Neg[1]);
      ctx.stroke();
      ctx.restore();

      Theme.drawArrow(ctx, pO[0], pO[1], pU1[0], pU1[1], C.mode1, 3.0, 10);
      Theme.drawArrow(ctx, pO[0], pO[1], pU2[0], pU2[1], C.mode2, 3.0, 10);

      const lbl1 = state.t < 0.55 ? 'u₁' : state.t < 1.55 ? 'p₁' : 'e₁ (ω₁)';
      const lbl2 = state.t < 0.55 ? 'u₂' : state.t < 1.55 ? 'p₂' : 'e₂ (ω₂)';
      ctx.font = '700 12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = C.mode1;
      const l1Offset = state.t >= 1.55 ? 28 : 20;
      const l1Vert = state.t >= 1.55 ? -10 : 4;
      ctx.fillText(lbl1, pU1[0] + e1[0] * l1Offset, pU1[1] - e1[1] * l1Offset + l1Vert);
      ctx.fillStyle = C.mode2;
      ctx.fillText(lbl2, pU2[0] + e2[0] * 22, pU2[1] - e2[1] * 22 + 4);

      // 9. Stage callout badges
      ctx.save();
      ctx.font = '600 11.5px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = C.mass;
      ctx.fillText(
        isUnitCircle ? '● Mass surface = unit circle (I)' : '● Mass ellipse  xᵀM(t)x = 1',
        12,
        19
      );

      ctx.textAlign = 'right';
      ctx.fillStyle = C.stiff;
      const kLabel = isModal
        ? '● Modal stiffness Λ = diag(ω₁², ω₂²)'
        : state.t >= 0.96 && state.t <= 1.04
        ? '● Exact K̃ = M⁻¹ᐟ²KM⁻¹ᐟ² ellipse'
        : '● Stiffness ellipse  xᵀK(t)x = ω₀²';
      ctx.fillText(kLabel, w - 12, 19);

      ctx.textAlign = 'center';
      ctx.font = '600 11.5px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = isRightAngle ? C.mode1 : C.accent;
      ctx.fillText(
        isRightAngle
          ? 'Mode angle = 90.0° (orthogonal eigenvectors p₁ ⊥ p₂)'
          : 'Mode angle ∠(u₁, u₂) = ' + ms.angleDeg.toFixed(1) + '°  (not 90°, but u₁ᵀMu₂ = 0)',
        w * 0.5,
        h - 10
      );
      ctx.restore();

      if (opts.onFrame) opts.onFrame(ms, state.t);
    }

    render();

    return {
      step,
      render,
      setEigen,
      setT,
      animateToStage,
      playForward,
      playReverse,
      togglePlay,
      setOptions,
      setVisible: (v) => (state.visible = v),
      getState: () => state
    };
  }

  return { create };
})();
