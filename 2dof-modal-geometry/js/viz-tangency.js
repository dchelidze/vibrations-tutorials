/**
 * viz-tangency.js
 * Section 3: Visualizes how the M and K energy ellipses combine via:
 *   1. Tangency Principle: expanding u^T K u = lambda kisses u^T M u = 1 at omega_1^2 and omega_2^2.
 *   2. Rayleigh Quotient & Force-Inertia Alignment: sweeping direction u(alpha) shows Ku || Mu only at normal modes.
 */
window.VibLab = window.VibLab || {};

window.VibLab.TangencyViz = (function () {
  'use strict';

  const M2 = window.VibLab.Math2D;
  const Theme = window.VibLab.Theme;

  function create(opts) {
    const tangCanvas = opts.tangCanvas;
    const rayCanvas = opts.rayCanvas;

    const state = {
      eigen: opts.eigen,
      // Tangency sweep: normalized s in [0, 1] maps to lambda in [0.45*lam1, 1.35*lam2]
      lambdaNorm: 0,
      lambdaVal: opts.eigen.lambdas[0],
      sweepPlaying: false,
      sweepDir: 1,
      // Direction sweeper angle alpha in [0, 2*pi)
      alpha: 0.45,
      anglePlaying: true,
      draggingAngle: false,
      visible: true
    };

    function lambdaRange() {
      const l1 = state.eigen.lambdas[0];
      const l2 = state.eigen.lambdas[1];
      const lMin = Math.max(0.1, l1 * 0.45);
      const lMax = l2 * 1.32;
      return { lMin, lMax };
    }

    function setLambda(val) {
      const { lMin, lMax } = lambdaRange();
      state.lambdaVal = Math.max(lMin, Math.min(lMax, val));
      state.lambdaNorm = (state.lambdaVal - lMin) / Math.max(1e-6, lMax - lMin);
      if (opts.onLambdaChange) opts.onLambdaChange(state.lambdaVal, state.lambdaNorm);
      renderTangency();
    }

    function setLambdaNorm(normVal) {
      const { lMin, lMax } = lambdaRange();
      state.lambdaNorm = Math.max(0, Math.min(1, normVal));
      state.lambdaVal = lMin + state.lambdaNorm * (lMax - lMin);
      if (opts.onLambdaChange) opts.onLambdaChange(state.lambdaVal, state.lambdaNorm);
      renderTangency();
    }

    function snapToMode(modeIdx) {
      state.sweepPlaying = false;
      const target = state.eigen.lambdas[modeIdx];
      setLambda(target);
      // Also align the direction sweeper to that mode!
      const u = modeIdx === 0 ? state.eigen.u1 : state.eigen.u2;
      state.alpha = Math.atan2(u[1], u[0]);
      if (state.alpha < 0) state.alpha += Math.PI * 2;
      state.anglePlaying = false;
      if (opts.onPlayStateChange) opts.onPlayStateChange();
      render();
    }

    function setEigen(eigen) {
      const oldFrac = state.lambdaNorm;
      state.eigen = eigen;
      setLambdaNorm(oldFrac);
      render();
    }

    function toggleSweep() {
      state.sweepPlaying = !state.sweepPlaying;
      if (opts.onPlayStateChange) opts.onPlayStateChange();
      return state.sweepPlaying;
    }

    function toggleAnglePlay() {
      state.anglePlaying = !state.anglePlaying;
      if (opts.onPlayStateChange) opts.onPlayStateChange();
      return state.anglePlaying;
    }

    // Pointer interaction on Rayleigh compass (top portion of rayCanvas)
    function updateAngleFromPointer(evt) {
      const rect = rayCanvas.getBoundingClientRect();
      const px = evt.clientX - rect.left;
      const py = evt.clientY - rect.top;
      const cx = rect.width * 0.5;
      const cy = rect.height * 0.34;
      // Check if clicking in bottom chart (maps x to alpha in [0, pi])
      if (py > rect.height * 0.64) {
        const padL = 44;
        const padR = 16;
        const frac = Math.max(0, Math.min(1, (px - padL) / Math.max(10, rect.width - padL - padR)));
        state.alpha = frac * Math.PI;
      } else {
        let ang = Math.atan2(-(py - cy), px - cx);
        if (ang < 0) ang += Math.PI * 2;
        state.alpha = ang;
      }
      renderRayleigh();
    }

    rayCanvas.addEventListener('pointerdown', function (evt) {
      state.draggingAngle = true;
      state.anglePlaying = false;
      rayCanvas.setPointerCapture(evt.pointerId);
      updateAngleFromPointer(evt);
      if (opts.onPlayStateChange) opts.onPlayStateChange();
    });

    rayCanvas.addEventListener('pointermove', function (evt) {
      if (!state.draggingAngle) return;
      updateAngleFromPointer(evt);
    });

    function endDrag(evt) {
      if (!state.draggingAngle) return;
      state.draggingAngle = false;
      if (evt && evt.pointerId !== undefined) {
        try {
          rayCanvas.releasePointerCapture(evt.pointerId);
        } catch (e) {}
      }
    }
    rayCanvas.addEventListener('pointerup', endDrag);
    rayCanvas.addEventListener('pointercancel', endDrag);

    function step(dt) {
      if (!state.visible) return;
      if (state.sweepPlaying) {
        // Gentle slow-down near exact eigenvalues so tangency moments linger visually!
        const l1 = state.eigen.lambdas[0];
        const l2 = state.eigen.lambdas[1];
        const d1 = Math.abs(state.lambdaVal - l1) / l1;
        const d2 = Math.abs(state.lambdaVal - l2) / l2;
        const near = Math.min(d1, d2);
        const speedFactor = near < 0.04 ? 0.25 : 1.0;

        let next = state.lambdaNorm + state.sweepDir * dt * 0.16 * speedFactor;
        if (next >= 1) {
          next = 1;
          state.sweepDir = -1;
        } else if (next <= 0) {
          next = 0;
          state.sweepDir = 1;
        }
        setLambdaNorm(next);
      }

      if (state.anglePlaying && !state.draggingAngle) {
        // Slightly slow down near eigen-directions for clarity
        const eig = state.eigen;
        const a1 = Math.atan2(eig.u1[1], eig.u1[0]);
        const a2 = Math.atan2(eig.u2[1], eig.u2[0]);
        const diff1 = Math.abs(Math.sin(state.alpha - a1));
        const diff2 = Math.abs(Math.sin(state.alpha - a2));
        const slow = Math.min(diff1, diff2) < 0.06 ? 0.35 : 1.0;
        state.alpha = (state.alpha + dt * 0.55 * slow) % (Math.PI * 2);
        renderRayleigh();
      }
    }

    function render() {
      renderTangency();
      renderRayleigh();
    }

    function renderTangency() {
      const { ctx, w, h } = Theme.setupHiDPI(tangCanvas);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const eig = state.eigen;
      const lam = state.lambdaVal;
      const l1 = eig.lambdas[0];
      const l2 = eig.lambdas[1];
      const { lMax } = lambdaRange();

      // Sample fixed M-ellipse (u^T M u = 1) and maximum K-ellipse to keep viewport rock-steady
      const ellM = M2.sampleEllipse(eig.M, 1.0, 120);
      const ellKMax = M2.sampleEllipse(eig.K, lMax, 60);
      const ellK = M2.sampleEllipse(eig.K, lam, 120);

      const maxR = Math.max(ellM.semiAxes[0], ellM.semiAxes[1], ellKMax.semiAxes[0], ellKMax.semiAxes[1], 0.5);
      const cx = w * 0.5;
      const cy = h * 0.52;
      const scale = (Math.min(w, h) * 0.39) / maxR;
      const toPx = (u) => [cx + u[0] * scale, cy - u[1] * scale];

      // Grid
      ctx.save();
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      const gStep = maxR > 1.8 ? 0.5 : 0.25;
      const nG = Math.ceil((maxR * 1.4) / gStep);
      for (let i = -nG; i <= nG; i++) {
        const v = i * gStep;
        const p1 = toPx([v, -nG * gStep]);
        const p2 = toPx([v, nG * gStep]);
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();

        const q1 = toPx([-nG * gStep, v]);
        const q2 = toPx([nG * gStep, v]);
        ctx.beginPath();
        ctx.moveTo(q1[0], q1[1]);
        ctx.lineTo(q2[0], q2[1]);
        ctx.stroke();
      }
      ctx.restore();

      // Axes
      Theme.drawArrow(ctx, 16, cy, w - 16, cy, C.axis, 1.3, 6);
      Theme.drawArrow(ctx, cx, h - 16, cx, 26, C.axis, 1.3, 6);
      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = C.textMuted;
      ctx.textAlign = 'right';
      ctx.fillText('q₁', w - 18, cy - 7);
      ctx.textAlign = 'left';
      ctx.fillText('q₂', cx + 7, 34);

      // Faint normal mode reference lines through origin
      [
        { u: eig.u1, color: C.mode1, label: 'u₁' },
        { u: eig.u2, color: C.mode2, label: 'u₂' }
      ].forEach(function (m) {
        const ext = 1.25;
        const pA = toPx([-m.u[0] * ext, -m.u[1] * ext]);
        const pB = toPx([m.u[0] * ext, m.u[1] * ext]);
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = m.color;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(pA[0], pA[1]);
        ctx.lineTo(pB[0], pB[1]);
        ctx.stroke();
        ctx.restore();
      });

      // Draw Fixed Mass Ellipse u^T M u = 1
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
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.restore();

      // Draw Expanding Stiffness Ellipse u^T K u = lambda
      const nearMode1 = Math.abs(lam - l1) / l1 < 0.032;
      const nearMode2 = Math.abs(lam - l2) / l2 < 0.032;

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
      ctx.lineWidth = nearMode1 || nearMode2 ? 3.2 : 2.5;
      ctx.stroke();
      ctx.restore();

      // Highlight Tangency OR Intersections!
      let statusText = '';
      let statusColor = C.textMuted;

      if (nearMode1 || nearMode2) {
        const isM1 = nearMode1;
        const uMode = isM1 ? eig.u1 : eig.u2;
        const modeColor = isM1 ? C.mode1 : C.mode2;
        const modeLabel = isM1 ? 'Mode 1 (u₁)' : 'Mode 2 (u₂)';
        statusText = isM1
          ? 'Internal tangency:  λ = ω₁² = ' + M2.fmt(l1, 2) + '  →  Ku₁ = ω₁²Mu₁'
          : 'External tangency:  λ = ω₂² = ' + M2.fmt(l2, 2) + '  →  Ku₂ = ω₂²Mu₂';
        statusColor = modeColor;

        // Draw mode vector from origin to +uMode and -uMode
        const pO = toPx([0, 0]);
        const pPos = toPx(uMode);
        const pNeg = toPx([-uMode[0], -uMode[1]]);
        Theme.drawArrow(ctx, pO[0], pO[1], pPos[0], pPos[1], modeColor, 2.8, 9);

        // Shared tangent line at +uMode and -uMode: normal is g = M uMode
        const grad = M2.matVec(eig.M, uMode);
        const gLen = Math.max(1e-6, M2.norm(grad));
        const nx = grad[0] / gLen;
        const ny = grad[1] / gLen;
        const tx = -ny;
        const ty = nx;
        const tSpan = maxR * 0.55;

        [uMode, [-uMode[0], -uMode[1]]].forEach(function (pt, idx) {
          const tA = toPx([pt[0] - tx * tSpan, pt[1] - ty * tSpan]);
          const tB = toPx([pt[0] + tx * tSpan, pt[1] + ty * tSpan]);
          ctx.save();
          ctx.strokeStyle = modeColor;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(tA[0], tA[1]);
          ctx.lineTo(tB[0], tB[1]);
          ctx.stroke();
          ctx.restore();

          // Glowing tangency contact point
          const pPt = toPx(pt);
          ctx.save();
          ctx.fillStyle = modeColor;
          ctx.globalAlpha = 0.28;
          ctx.beginPath();
          ctx.arc(pPt[0], pPt[1], 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(pPt[0], pPt[1], 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = C.bg;
          ctx.lineWidth = 1.8;
          ctx.stroke();
          ctx.restore();

          // At +uMode, show parallel normal gradients Mu and Ku!
          if (idx === 0) {
            const gWorldLen = maxR * 0.34;
            const gM = toPx([pt[0] + nx * gWorldLen * 0.72, pt[1] + ny * gWorldLen * 0.72]);
            const gK = toPx([pt[0] + nx * gWorldLen * 1.15, pt[1] + ny * gWorldLen * 1.15]);
            Theme.drawArrow(ctx, pPt[0], pPt[1], gK[0], gK[1], C.stiff, 2.2, 8);
            Theme.drawArrow(ctx, pPt[0], pPt[1], gM[0], gM[1], C.mass, 2.6, 8);

            ctx.font = '700 11px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = modeColor;
            ctx.textAlign = 'left';
            ctx.fillText(modeLabel, pPt[0] + 10, pPt[1] - 10);
          }
        });
      } else if (lam < l1) {
        statusText = 'λ < ω₁² :  Stiffness ellipse lies strictly inside M-ellipse (no contact)';
      } else if (lam > l2) {
        statusText = 'λ > ω₂² :  Stiffness ellipse completely encloses M-ellipse (no contact)';
      } else {
        // Compute 4 exact intersection points!
        const denom = Math.max(1e-9, l2 - l1);
        const e2 = Math.sqrt(Math.max(0, (lam - l1) / denom));
        const e1 = Math.sqrt(Math.max(0, (l2 - lam) / denom));
        const pts = [
          [e1 * eig.u1[0] + e2 * eig.u2[0], e1 * eig.u1[1] + e2 * eig.u2[1]],
          [e1 * eig.u1[0] - e2 * eig.u2[0], e1 * eig.u1[1] - e2 * eig.u2[1]],
          [-e1 * eig.u1[0] + e2 * eig.u2[0], -e1 * eig.u1[1] + e2 * eig.u2[1]],
          [-e1 * eig.u1[0] - e2 * eig.u2[0], -e1 * eig.u1[1] - e2 * eig.u2[1]]
        ];

        pts.forEach(function (pt, idx) {
          const p = toPx(pt);
          ctx.save();
          ctx.fillStyle = C.accent;
          ctx.beginPath();
          ctx.arc(p[0], p[1], 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = C.bg;
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.restore();

          // At first intersection, draw misaligned gradient normals Mu vs Ku!
          if (idx === 0) {
            const gM = M2.matVec(eig.M, pt);
            const gK = M2.matVec(eig.K, pt);
            const nm = Math.max(1e-6, M2.norm(gM));
            const nk = Math.max(1e-6, M2.norm(gK));
            const arrowWorld = maxR * 0.3;
            const endM = toPx([pt[0] + (gM[0] / nm) * arrowWorld, pt[1] + (gM[1] / nm) * arrowWorld]);
            const endK = toPx([pt[0] + (gK[0] / nk) * arrowWorld, pt[1] + (gK[1] / nk) * arrowWorld]);
            Theme.drawArrow(ctx, p[0], p[1], endM[0], endM[1], C.mass, 2.2, 7);
            Theme.drawArrow(ctx, p[0], p[1], endK[0], endK[1], C.stiff, 2.2, 7);
          }
        });

        statusText = 'ω₁² < λ < ω₂² :  4 crossings — gradients Ku and Mu are NOT parallel';
        statusColor = C.accent;
      }

      // Top legend
      ctx.save();
      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = C.mass;
      ctx.fillText('● Fixed: uᵀMu = 1', 12, 18);
      ctx.textAlign = 'right';
      ctx.fillStyle = C.stiff;
      ctx.fillText('● Scaled: uᵀKu = λ (' + M2.fmt(lam, 2) + ')', w - 12, 18);

      // Bottom status banner
      ctx.textAlign = 'center';
      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = statusColor;
      ctx.fillText(statusText, w * 0.5, h - 10);
      ctx.restore();
    }

    function renderRayleigh() {
      const { ctx, w, h } = Theme.setupHiDPI(rayCanvas);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const eig = state.eigen;
      const w0Sq = Math.sqrt(eig.lambdas[0] * eig.lambdas[1]);

      // === TOP COMPASS: Direction u(alpha), Mu arrow vs Ku arrow ===
      const cx = w * 0.5;
      const cy = h * 0.34;
      const compassR = Math.min(w * 0.36, h * 0.25);

      const dir = [Math.cos(state.alpha), Math.sin(state.alpha)];
      // Scale u so it lies on u^T M u = 1
      const mNorm = Math.sqrt(Math.max(1e-9, M2.quadForm(dir, eig.M)));
      const u = [dir[0] / mNorm, dir[1] / mNorm];
      const Mu = M2.matVec(eig.M, u);
      const Ku = M2.matVec(eig.K, u);
      const Rval = M2.rayleigh(dir, eig.M, eig.K);

      // Angle between Mu and Ku
      const cosMis = M2.dot(Mu, Ku) / Math.max(1e-9, M2.norm(Mu) * M2.norm(Ku));
      const misDeg = (Math.acos(Math.max(-1, Math.min(1, cosMis))) * 180) / Math.PI;
      const isAligned = misDeg < 2.2;

      // Subtle compass ring
      ctx.save();
      ctx.strokeStyle = C.gridBold;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, compassR, 0, Math.PI * 2);
      ctx.stroke();

      // Mode direction lines
      [
        { v: eig.u1, col: C.mode1, lbl: 'u₁' },
        { v: eig.u2, col: C.mode2, lbl: 'u₂' }
      ].forEach(function (m) {
        const mn = Math.max(1e-6, M2.norm(m.v));
        const ux = m.v[0] / mn;
        const uy = m.v[1] / mn;
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = m.col;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cx - ux * compassR * 1.15, cy + uy * compassR * 1.15);
        ctx.lineTo(cx + ux * compassR * 1.15, cy - uy * compassR * 1.15);
        ctx.stroke();
        ctx.globalAlpha = 0.9;
        ctx.font = '700 11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = m.col;
        ctx.textAlign = 'center';
        ctx.fillText(m.lbl, cx + ux * (compassR + 14), cy - uy * (compassR + 14) + 4);
        ctx.restore();
      });

      // Draw test direction vector u (grey/dark handle on compass ring)
      const uEndX = cx + dir[0] * compassR;
      const uEndY = cy - dir[1] * compassR;
      Theme.drawArrow(ctx, cx, cy, uEndX, uEndY, C.textMuted, 1.8, 7);

      // Draggable handle on u
      ctx.fillStyle = isAligned ? C.accent : C.text;
      ctx.beginPath();
      ctx.arc(uEndX, uEndY, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Draw Mu (blue) and Ku / w0Sq (vermilion) from center, normalized cleanly for comparison
      const muLen = Math.max(1e-6, M2.norm(Mu));
      const kuLen = Math.max(1e-6, M2.norm(Ku));
      const scaleArrow = compassR * 0.78;
      // Show true relative scaling of Ku / (w0Sq * |Mu|) clamped nicely
      const relRatio = Math.max(0.45, Math.min(1.45, kuLen / (w0Sq * muLen)));

      const muX = cx + (Mu[0] / muLen) * scaleArrow * 0.85;
      const muY = cy - (Mu[1] / muLen) * scaleArrow * 0.85;
      const kuX = cx + (Ku[0] / kuLen) * scaleArrow * relRatio;
      const kuY = cy - (Ku[1] / kuLen) * scaleArrow * relRatio;

      Theme.drawArrow(ctx, cx, cy, kuX, kuY, C.stiff, 2.8, 9);
      Theme.drawArrow(ctx, cx, cy, muX, muY, C.mass, 2.8, 9);

      // Labels for Ku, Mu (offset perpendicularly when aligned so they never collide)
      const muDirX = Mu[0] / muLen;
      const muDirY = -Mu[1] / muLen;
      const perpX = -muDirY;
      const perpY = muDirX;
      const sep = isAligned ? 14 : 0;

      ctx.font = '700 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = C.mass;
      ctx.fillText('Mu', muX + muDirX * 14 + perpX * sep, muY + muDirY * 14 + perpY * sep + 3);
      ctx.fillStyle = C.stiff;
      ctx.fillText(
        'Ku',
        kuX + (Ku[0] / kuLen) * 16 - perpX * sep,
        kuY - (Ku[1] / kuLen) * 16 - perpY * sep + 3
      );

      // Top status labels
      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = C.textMuted;
      ctx.fillText('Drag vector u to test alignment', 12, 18);

      ctx.textAlign = 'right';
      ctx.fillStyle = isAligned ? C.mode1 : C.text;
      ctx.fillText(
        isAligned ? 'Aligned: Ku ∥ Mu (normal mode)' : '∠(Ku, Mu) = ' + misDeg.toFixed(1) + '°',
        w - 12,
        18
      );
      ctx.restore();

      // === BOTTOM PLOT: Rayleigh Quotient R(alpha) for alpha in [0, 180 deg] ===
      const plotX = 44;
      const plotW = w - 60;
      const plotY = h * 0.66;
      const plotH = h * 0.27;

      const l1 = eig.lambdas[0];
      const l2 = eig.lambdas[1];
      const yMin = Math.max(0, l1 * 0.72);
      const yMax = l2 * 1.16;

      const mapX = (aRad) => plotX + (((aRad % Math.PI) + Math.PI) % Math.PI) / Math.PI * plotW;
      const mapY = (val) => plotY + plotH - ((val - yMin) / Math.max(1e-6, yMax - yMin)) * plotH;

      ctx.save();
      ctx.fillStyle = C.bgSubtle;
      ctx.strokeStyle = C.gridBold;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(plotX, plotY, plotW, plotH, 6) : ctx.rect(plotX, plotY, plotW, plotH);
      ctx.fill();
      ctx.stroke();

      // Horizontal reference lines for omega_1^2 and omega_2^2
      [
        { val: l1, col: C.mode1, lbl: 'ω₁²' },
        { val: l2, col: C.mode2, lbl: 'ω₂²' }
      ].forEach(function (ref) {
        const ry = mapY(ref.val);
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = ref.col;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(plotX, ry);
        ctx.lineTo(plotX + plotW, ry);
        ctx.stroke();
        ctx.font = '700 10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = ref.col;
        ctx.textAlign = 'right';
        ctx.fillText(ref.lbl, plotX - 5, ry + 3);
        ctx.restore();
      });

      // Rayleigh curve R(alpha)
      ctx.beginPath();
      ctx.strokeStyle = C.text;
      ctx.lineWidth = 2;
      const steps = 120;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI;
        const r = M2.rayleigh([Math.cos(a), Math.sin(a)], eig.M, eig.K);
        const px = plotX + (i / steps) * plotW;
        const py = mapY(r);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Current marker dot
      const curX = mapX(state.alpha);
      const curY = mapY(Rval);
      ctx.fillStyle = isAligned ? C.mode1 : C.stiff;
      ctx.beginPath();
      ctx.arc(curX, curY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Caption
      ctx.font = '600 10.5px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = C.textMuted;
      ctx.textAlign = 'left';
      ctx.fillText('Rayleigh Quotient  R(u) = uᵀKu / uᵀMu', plotX, plotY - 6);
      ctx.textAlign = 'right';
      ctx.fillStyle = C.text;
      ctx.fillText('R = ' + M2.fmt(Rval, 2) + ' (ω = ' + M2.fmt(Math.sqrt(Rval), 2) + ')', plotX + plotW, plotY - 6);
      ctx.restore();
    }

    // Initialize at Mode 1 tangency so students see the wow moment immediately (or slightly animated)
    setLambda(opts.eigen.lambdas[0]);
    render();

    return {
      step,
      render,
      setEigen,
      setLambda,
      setLambdaNorm,
      snapToMode,
      toggleSweep,
      toggleAnglePlay,
      setVisible: (v) => (state.visible = v),
      getState: () => state
    };
  }

  return { create };
})();
