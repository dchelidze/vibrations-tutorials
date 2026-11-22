/**
 * viz-free-modal.js
 * Section 2 visualization for Module 04 (2dof-modal-response):
 * - Top canvas: Live animated coupled 2-DOF mass-spring-damper chain (left)
 *               side by side with the two decoupled 1-DOF modal oscillators r1(t), r2(t) (right).
 * - Bottom canvas: Synchronized time waveforms showing modal coordinates r1(t), r2(t)
 *                  combining via x(t) = r1(t) u1 + r2(t) u2 to form physical motion x1(t), x2(t),
 *                  with an optional modal-energy view E1(t), E2(t).
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathModal2DOF;
  const Theme = window.VibLab.Theme;

  function createFreeModalViz(opts) {
    const rigCanvas = document.getElementById(opts.rigCanvasId);
    const waveCanvas = document.getElementById(opts.waveCanvasId);
    let sys = opts.sys;

    const state = {
      x0: [1.0, 0.0],
      v0: [0.0, 0.0],
      t: 0,
      tMax: 14.0,
      playing: true,
      showEnergy: false,
      traj: null
    };

    function recomputeTrajectory() {
      // Choose time horizon ~ 4 cycles of mode 1
      const T1 = (2 * Math.PI) / Math.max(0.4, sys.w1);
      state.tMax = Math.max(8.0, Math.min(22.0, T1 * 4.5));
      state.traj = M.simulateFreeResponse(sys, state.x0, state.v0, state.tMax, 520);
      if (state.t > state.tMax) state.t = 0;
    }

    function setSystem(newSys) {
      sys = newSys;
      recomputeTrajectory();
      render();
    }

    function setIC(x0, v0) {
      state.x0 = [x0[0], x0[1]];
      state.v0 = v0 ? [v0[0], v0[1]] : [0, 0];
      state.t = 0;
      recomputeTrajectory();
      render();
    }

    function setPlaying(p) {
      state.playing = !!p;
    }

    function setShowEnergy(flag) {
      state.showEnergy = !!flag;
      render();
    }

    function resetTime() {
      state.t = 0;
      render();
    }

    function sampleAt(t) {
      const tr = state.traj;
      if (!tr) return { x1: 0, x2: 0, r1: 0, r2: 0, E1: 0, E2: 0 };
      const N = tr.t.length - 1;
      const frac = Math.max(0, Math.min(1, t / state.tMax)) * N;
      const idx = Math.min(N - 1, Math.floor(frac));
      const a = frac - idx;
      const lerp = (arr) => arr[idx] * (1 - a) + arr[idx + 1] * a;
      return {
        x1: lerp(tr.x1),
        x2: lerp(tr.x2),
        r1: lerp(tr.r1),
        r2: lerp(tr.r2),
        E1: lerp(tr.E1),
        E2: lerp(tr.E2)
      };
    }

    function step(dt) {
      if (!state.playing) return;
      state.t += dt;
      if (state.t > state.tMax) state.t -= state.tMax;
      render();
    }

    function drawWall(ctx, x, yTop, yBot, rightSide, C) {
      ctx.save();
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x, yBot);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = C.textMuted;
      const dir = rightSide ? 1 : -1;
      for (let y = yTop + 4; y < yBot - 2; y += 8) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + dir * 7, y + 5);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawRigCanvas() {
      if (!rigCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(rigCanvas);
      const C = Theme.get();
      const s = sampleAt(state.t);

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const splitX = Math.round(w * 0.56);

      // Divider line
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(splitX, 12);
      ctx.lineTo(splitX, h - 12);
      ctx.stroke();

      // ---- LEFT HALF: Coupled Physical 2-DOF Chain ----
      ctx.fillStyle = C.text;
      ctx.font = '600 12px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('Coupled physical coordinates (x₁, x₂)', 14, 10);

      const leftWall = 26;
      const rightWall = splitX - 24;
      const hasK3 = sys.params.k3 > 1e-4;
      const span = rightWall - leftWall;
      const trackY = h * 0.56;
      const boxW = Math.min(54, Math.max(38, span * 0.14));
      const boxH = 44;

      // Normalize displacement visually so boxes never collide
      const maxX = Math.max(0.8, ...state.traj.x1.map(Math.abs), ...state.traj.x2.map(Math.abs));
      const dispScale = Math.min(28, (span - 2 * boxW) * 0.12) / maxX;

      const x1Rest = leftWall + span * (hasK3 ? 0.33 : 0.38);
      const x2Rest = leftWall + span * (hasK3 ? 0.67 : 0.74);
      const x1Pos = x1Rest + s.x1 * dispScale;
      const x2Pos = x2Rest + s.x2 * dispScale;

      // Floor track
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(leftWall, trackY + boxH * 0.5 + 4);
      ctx.lineTo(rightWall, trackY + boxH * 0.5 + 4);
      ctx.stroke();

      // Rest markers
      ctx.save();
      ctx.strokeStyle = C.ref;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      [x1Rest, x2Rest].forEach((xr) => {
        ctx.beginPath();
        ctx.moveTo(xr, trackY - boxH * 0.5 - 16);
        ctx.lineTo(xr, trackY + boxH * 0.5 + 14);
        ctx.stroke();
      });
      ctx.restore();

      // Left wall
      drawWall(ctx, leftWall, trackY - 30, trackY + 30, false, C);
      if (hasK3) {
        drawWall(ctx, rightWall, trackY - 30, trackY + 30, true, C);
      }

      // Springs k1, k2, (k3)
      const springY = sys.C[0][0] > 0.01 ? trackY - 7 : trackY;
      Theme.drawSpring(ctx, leftWall, springY, x1Pos - boxW * 0.5, springY, 6, 7, C.blue, 1.7);
      Theme.drawSpring(ctx, x1Pos + boxW * 0.5, springY, x2Pos - boxW * 0.5, springY, 6, 7, C.orange, 1.7);
      if (hasK3) {
        Theme.drawSpring(ctx, x2Pos + boxW * 0.5, springY, rightWall, springY, 6, 7, C.blue, 1.7);
      }

      // Dampers if present
      if (sys.C[0][0] > 0.01) {
        Theme.drawDamper(
          ctx,
          leftWall,
          trackY + 11,
          x1Pos - boxW * 0.5,
          trackY + 11,
          sys.params.cLoc > 0 && sys.params.locSite === 'm1' ? C.crimson : C.textMuted,
          1.4
        );
      }
      if (Math.abs(sys.C[0][1]) > 0.005) {
        Theme.drawDamper(
          ctx,
          x1Pos + boxW * 0.5,
          trackY + 11,
          x2Pos - boxW * 0.5,
          trackY + 11,
          sys.params.cLoc > 0 && sys.params.locSite === 'couple' ? C.crimson : C.textMuted,
          1.4
        );
      }
      if (hasK3 && sys.C[1][1] > 0.01) {
        Theme.drawDamper(
          ctx,
          x2Pos + boxW * 0.5,
          trackY + 11,
          rightWall,
          trackY + 11,
          sys.params.cLoc > 0 && sys.params.locSite === 'm2' ? C.crimson : C.textMuted,
          1.4
        );
      }

      // Spring labels
      ctx.font = '500 11px "IBM Plex Mono", monospace';
      ctx.fillStyle = C.textMuted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('k₁', 0.5 * (leftWall + x1Pos - boxW * 0.5), springY - 10);
      ctx.fillText('k₂', 0.5 * (x1Pos + x2Pos), springY - 10);
      if (hasK3) {
        ctx.fillText('k₃', 0.5 * (x2Pos + boxW * 0.5 + rightWall), springY - 10);
      }

      // Mass blocks m1, m2
      function drawMass(xc, label, sub, color) {
        ctx.fillStyle = C.surface || C.bgSubtle;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;
        ctx.fillRect(xc - boxW * 0.5, trackY - boxH * 0.5, boxW, boxH);
        ctx.strokeRect(xc - boxW * 0.5, trackY - boxH * 0.5, boxW, boxH);
        ctx.fillStyle = color;
        ctx.font = '600 13px "IBM Plex Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, xc, trackY - 5);
        ctx.fillStyle = C.textMuted;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.fillText(sub, xc, trackY + 11);
      }
      drawMass(x1Pos, 'm₁', M.fmt(sys.params.m1, 1) + ' kg', C.blue);
      drawMass(x2Pos, 'm₂', M.fmt(sys.params.m2, 1) + ' kg', C.orange);

      // Displacement arrows above masses
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillStyle = C.blue;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('x₁=' + M.fmt(s.x1, 2), x1Rest, trackY - boxH * 0.5 - 19);
      ctx.fillStyle = C.orange;
      ctx.fillText('x₂=' + M.fmt(s.x2, 2), x2Rest, trackY - boxH * 0.5 - 19);

      // ---- RIGHT HALF: Two Decoupled 1-DOF Modal Oscillators ----
      ctx.fillStyle = C.text;
      ctx.font = '600 12px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(
        sys.isProportional
          ? 'Uncoupled modal oscillators (r₁, r₂)'
          : 'Modal coordinates (coupled via c̃₁₂ ≠ 0)',
        splitX + 14,
        10
      );

      const mLeft = splitX + 26;
      const mRight = w - 20;
      const mSpan = mRight - mLeft;
      const mBoxW = 42;
      const mBoxH = 30;
      const maxR = Math.max(0.8, ...state.traj.r1.map(Math.abs), ...state.traj.r2.map(Math.abs));
      const rScale = Math.min(34, mSpan * 0.16) / maxR;

      function drawModalLane(yCenter, val, wn, zeta, label, color) {
        const restX = mLeft + mSpan * 0.54;
        const posX = restX + val * rScale;

        drawWall(ctx, mLeft, yCenter - 18, yCenter + 18, false, C);
        ctx.save();
        ctx.strokeStyle = C.ref;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(restX, yCenter - 22);
        ctx.lineTo(restX, yCenter + 22);
        ctx.stroke();
        ctx.restore();

        Theme.drawSpring(ctx, mLeft, yCenter - 5, posX - mBoxW * 0.5, yCenter - 5, 5, 5, color, 1.6);
        Theme.drawDamper(ctx, mLeft, yCenter + 7, posX - mBoxW * 0.5, yCenter + 7, C.textMuted, 1.3);

        ctx.fillStyle = C.bgSubtle;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.fillRect(posX - mBoxW * 0.5, yCenter - mBoxH * 0.5, mBoxW, mBoxH);
        ctx.strokeRect(posX - mBoxW * 0.5, yCenter - mBoxH * 0.5, mBoxW, mBoxH);

        ctx.fillStyle = color;
        ctx.font = '600 12px "IBM Plex Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, posX, yCenter);

        ctx.fillStyle = C.textMuted;
        ctx.font = '500 10.5px "IBM Plex Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('ω=' + M.fmt(wn, 2) + '  ζ=' + M.fmt(zeta, 3), mLeft + mSpan * 0.72, yCenter - 8);
        ctx.fillStyle = color;
        ctx.fillText(label + '=' + M.fmt(val, 2), mLeft + mSpan * 0.72, yCenter + 8);
      }

      drawModalLane(h * 0.38, s.r1, sys.w1, sys.zeta1, 'r₁', C.teal);
      drawModalLane(h * 0.74, s.r2, sys.w2, sys.zeta2, 'r₂', C.crimson);
    }

    function drawWaveCanvas() {
      if (!waveCanvas || !state.traj) return;
      const { ctx, w, h } = Theme.setupCanvas(waveCanvas);
      const C = Theme.get();
      const tr = state.traj;

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 48;
      const padR = 28;
      const padT = 18;
      const padB = 28;
      const gap = 22;
      const plotW = w - padL - padR;
      const subH = (h - padT - padB - gap) / 2;

      const toX = (t) => padL + (t / state.tMax) * plotW;

      function drawSubPlot(topY, title, seriesList, symmetric) {
        let maxV = 1e-4;
        for (const s of seriesList) {
          for (let i = 0; i < s.data.length; i++) {
            const av = Math.abs(s.data[i]);
            if (av > maxV) maxV = av;
          }
        }
        maxV *= 1.15;

        const zeroY = symmetric ? topY + subH * 0.5 : topY + subH;
        const toY = symmetric
          ? (v) => zeroY - (v / maxV) * (subH * 0.45)
          : (v) => topY + subH - (v / maxV) * (subH * 0.9);

        // Background subtle band
        ctx.fillStyle = C.bgSubtle;
        ctx.fillRect(padL, topY, plotW, subH);
        ctx.strokeStyle = C.gridStrong;
        ctx.lineWidth = 1;
        ctx.strokeRect(padL, topY, plotW, subH);

        // Zero line
        ctx.strokeStyle = C.gridStrong;
        ctx.beginPath();
        ctx.moveTo(padL, zeroY);
        ctx.lineTo(padL + plotW, zeroY);
        ctx.stroke();

        // Series curves
        for (const s of seriesList) {
          ctx.save();
          ctx.strokeStyle = s.color;
          ctx.lineWidth = s.width || 1.9;
          if (s.dash) ctx.setLineDash(s.dash);
          ctx.beginPath();
          for (let i = 0; i < tr.t.length; i++) {
            const px = toX(tr.t[i]);
            const py = toY(s.data[i]);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
          ctx.restore();
        }

        // Playhead vertical line
        const curX = toX(state.t);
        ctx.save();
        ctx.strokeStyle = C.copper;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(curX, topY);
        ctx.lineTo(curX, topY + subH);
        ctx.stroke();
        ctx.restore();

        // Title & y-scale label
        ctx.fillStyle = C.text;
        ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(title, padL + 2, topY - 3);

        ctx.fillStyle = C.textMuted;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('+' + M.fmt(maxV, 2), padL - 6, topY + 2);
        if (symmetric) {
          ctx.textBaseline = 'bottom';
          ctx.fillText('-' + M.fmt(maxV, 2), padL - 6, topY + subH - 2);
        } else {
          ctx.textBaseline = 'bottom';
          ctx.fillText('0', padL - 6, topY + subH - 2);
        }
      }

      // Top subplot: Physical x1(t), x2(t)
      drawSubPlot(
        padT,
        'Physical response: x₁(t) [blue], x₂(t) [orange]',
        [
          { data: tr.x1, color: C.blue, width: 2.0 },
          { data: tr.x2, color: C.orange, width: 1.9 }
        ],
        true
      );

      // Bottom subplot: Modal coordinates r1(t), r2(t) OR modal energies E1(t), E2(t)
      if (state.showEnergy) {
        drawSubPlot(
          padT + subH + gap,
          'Modal energies: E₁(t) [teal], E₂(t) [crimson]',
          [
            { data: tr.E1, color: C.teal, width: 2.0 },
            { data: tr.E2, color: C.crimson, width: 2.0 }
          ],
          false
        );
      } else {
        drawSubPlot(
          padT + subH + gap,
          'Modal coordinates: r₁(t) [teal], r₂(t) [crimson]',
          [
            { data: tr.r1, color: C.teal, width: 2.0 },
            { data: tr.r2, color: C.crimson, width: 1.9 }
          ],
          true
        );
      }

      // Time axis ticks
      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const nTicks = 5;
      for (let i = 0; i <= nTicks; i++) {
        const tv = (state.tMax * i) / nTicks;
        ctx.fillText(M.fmt(tv, 1) + ' s', toX(tv), h - padB + 6);
      }
    }

    function render() {
      drawRigCanvas();
      drawWaveCanvas();
    }

    recomputeTrajectory();

    return {
      setSystem,
      setIC,
      setPlaying,
      isPlaying: () => state.playing,
      setShowEnergy,
      resetTime,
      step,
      render
    };
  }

  window.VibLab.VizFreeModal = { create: createFreeModalViz };
})();
