/**
 * viz-triangle.js
 * Section 1 visualization for Module 09 (sdof-base-sensors):
 * - Left canvas: Live animated moving-base oscillator showing base motion y(t),
 *                auto-sized seismic mass m at absolute position x(t), and relative stroke z = x - y.
 * - Right canvas: Exact complex phasor triangle X = Y + Z (normalized by Y = 1)
 *                 showing unit circle |X|/Y = 1 (isosceles triangle right at r = sqrt(2)!),
 *                 with all three vector labels cleanly placed at outward midpoints!
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathSensors;
  const Theme = window.VibLab.Theme;

  function createTriangleViz(opts) {
    const rigCanvas = document.getElementById(opts.rigCanvasId);
    const triCanvas = document.getElementById(opts.triCanvasId);
    let sys = opts.sys;
    let phase = 0;
    let playing = true;

    function setSystem(newSys) { sys = newSys; render(); }
    function setPlaying(p) { playing = !!p; }
    function step(dt) {
      if (!playing) return;
      phase += dt * Math.min(7.5, Math.max(2.0, sys.r * 2.8));
      drawRig();
    }

    function drawRig() {
      if (!rigCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(rigCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.5;
      const baseRestY = h * 0.78;
      const massRestY = h * 0.34;
      const ampBase = 24;
      const yDisp = ampBase * Math.cos(phase);
      const xAmpVis = Math.min(54, ampBase * sys.Td);
      const xDisp = xAmpVis * Math.cos(phase + sys.phAbs);

      const baseY = baseRestY - yDisp;
      const massY = massRestY - xDisp;

      // Auto-sized mass block
      const mTitle = [{ t: 'Seismic mass ', bold: true }, { t: 'm', i: true, bold: true }];
      const mSub = [{ t: '|' }, { t: 'X', i: true }, { t: '|/' }, { t: 'Y', i: true }, { t: ' = ' + M.fmt(sys.Td, 2) }];
      const mW = Math.max(146, Math.ceil(Math.max(
        Theme.measureMathRuns(ctx, mTitle, 12.5, '"IBM Plex Sans", sans-serif'),
        Theme.measureMathRuns(ctx, mSub, 11, '"IBM Plex Mono", monospace')
      )) + 32);
      const mH = 54;
      const bW = Math.max(mW + 24, 176);
      const bH = 26;

      // Fixed inertial reference lines (dashed)
      ctx.save();
      ctx.strokeStyle = C.ref;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - bW * 0.5 - 16, massRestY);
      ctx.lineTo(cx + bW * 0.5 + 16, massRestY);
      ctx.moveTo(cx - bW * 0.5 - 16, baseRestY);
      ctx.lineTo(cx + bW * 0.5 + 16, baseRestY);
      ctx.stroke();
      ctx.restore();

      // Spring k & damper c between moving base and mass
      Theme.drawSpring(ctx, cx - 26, baseY - bH * 0.5, cx - 26, massY + mH * 0.5, 6, 8, C.blue, 1.9);
      Theme.drawDamper(ctx, cx + 26, baseY - bH * 0.5, cx + 26, massY + mH * 0.5, C.teal, 1.6);

      // Moving base platform
      ctx.fillStyle = C.bgSubtle;
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 2.4;
      ctx.fillRect(cx - bW * 0.5, baseY - bH * 0.5, bW, bH);
      ctx.strokeRect(cx - bW * 0.5, baseY - bH * 0.5, bW, bH);
      Theme.drawMath(ctx, [{ t: 'Moving base ', bold: true }, { t: 'y', i: true, bold: true }, { t: '(t) = ', bold: true }, { t: 'Y', i: true, bold: true }, { t: ' cos(ωt)', bold: true }], cx, baseY, {
        size: 11.5,
        color: C.copper,
        align: 'center'
      });

      // Seismic mass block
      ctx.fillStyle = C.bgSubtle;
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2.4;
      ctx.fillRect(cx - mW * 0.5, massY - mH * 0.5, mW, mH);
      ctx.strokeRect(cx - mW * 0.5, massY - mH * 0.5, mW, mH);
      Theme.drawMath(ctx, mTitle, cx, massY - 9, { size: 12.5, color: C.blue, align: 'center' });
      Theme.drawMath(ctx, mSub, cx, massY + 11, { size: 11, color: C.textMuted, align: 'center', family: '"IBM Plex Mono", monospace' });

      // Relative stroke gauge on right side: z = x - y
      const gx = cx + bW * 0.5 + 22;
      Theme.drawArrow(ctx, gx, baseY, gx, massY, C.crimson, 2.0, 8);
      Theme.drawMath(ctx, [{ t: 'z', i: true, bold: true }, { t: ' = ', bold: true }, { t: 'x', i: true, bold: true }, { t: '−', bold: true }, { t: 'y', i: true, bold: true }], gx + 8, 0.5 * (baseY + massY), {
        size: 11,
        color: C.crimson,
        align: 'left'
      });

      // Top status
      Theme.drawMath(
        ctx,
        [
          { t: sys.r > 2.0 ? 'Vibrometer regime: mass nearly stationary in space (z ≈ −y)' : sys.r < 0.6 ? 'Accelerometer regime: mass rides closely with base (x ≈ y)' : 'Transition / resonance regime (r = ' + M.fmt(sys.r, 2) + ')', bold: true }
        ],
        12,
        15,
        { size: 11, color: sys.r > 2.0 || sys.r < 0.6 ? C.teal : C.textMuted, align: 'left' }
      );
    }

    function drawTriangle() {
      if (!triCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(triCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      // Triangle vertices normalized by Y = 1:
      // O = (0, 0), Y = (1, 0), X = Habs = (1 + Hrel.re, Hrel.im)
      const Y = [1, 0];
      const X = [sys.Habs.re, sys.Habs.im];

      const maxCoord = Math.max(1.25, sys.Td, sys.Rrel, Math.abs(X[0]), Math.abs(X[1]));
      const range = maxCoord * 1.28;
      const pad = 38;
      const scale = Math.min((w - 2 * pad) / (2 * range), (h - 2 * pad - 24) / (2 * range));
      const cx = w * 0.5;
      const cy = h * 0.53;
      const toX = (re) => cx + re * scale;
      const toY = (im) => cy - im * scale;

      // Unit circle |X|/Y = 1 (isolation boundary — X lands ON circle at r = sqrt(2)!)
      ctx.save();
      ctx.strokeStyle = C.teal;
      ctx.fillStyle = C.dark ? 'rgba(38,181,166,0.08)' : 'rgba(0,137,123,0.06)';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, scale, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(14, cy);
      ctx.lineTo(w - 14, cy);
      ctx.moveTo(cx, 28);
      ctx.lineTo(cx, h - 24);
      ctx.stroke();

      const P0 = [cx, cy];
      const PY = [toX(Y[0]), toY(Y[1])];
      const PX = [toX(X[0]), toY(X[1])];
      const centX = (P0[0] + PY[0] + PX[0]) / 3;
      const centY = (P0[1] + PY[1] + PX[1]) / 3;

      function labelMidOutward(A, B, runs, color, dist) {
        const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
        if (L < 14) return;
        const mx = 0.5 * (A[0] + B[0]), my = 0.5 * (A[1] + B[1]);
        let nx = -dy / L, ny = dx / L;
        if (nx * (centX - mx) + ny * (centY - my) > 0) { nx = -nx; ny = -ny; }
        Theme.drawMath(ctx, runs, mx + nx * (dist || 17), my + ny * (dist || 17), { size: 12, color, align: 'center' });
      }

      // Draw Y (copper), Z = X - Y (crimson), X (blue)
      Theme.drawArrow(ctx, P0[0], P0[1], PY[0], PY[1], C.copper, 2.7, 9);
      Theme.drawArrow(ctx, PY[0], PY[1], PX[0], PX[1], C.crimson, 2.7, 9);
      Theme.drawArrow(ctx, P0[0], P0[1], PX[0], PX[1], C.blue, 2.9, 10);

      labelMidOutward(P0, PY, [{ t: 'Y', i: true, bold: true }, { t: ' (= 1)', bold: true }], C.copper, 16);
      labelMidOutward(PY, PX, [{ t: 'Z', i: true, bold: true }], C.crimson, 16);
      labelMidOutward(P0, PX, [{ t: 'X', i: true, bold: true }], C.blue, 16);

      const isCross = Math.abs(sys.r - Math.SQRT2) < 0.04;
      Theme.drawMath(
        ctx,
        isCross
          ? [{ t: 'Exact crossover (', bold: true }, { t: 'r', i: true, bold: true }, { t: ' = √2): isosceles triangle |', bold: true }, { t: 'X', i: true, bold: true }, { t: '| = |', bold: true }, { t: 'Y', i: true, bold: true }, { t: '| = 1', bold: true }]
          : [{ t: 'Displacement phasor closure: ', bold: true }, { t: 'X', i: true, bold: true }, { t: ' = ', bold: true }, { t: 'Y', i: true, bold: true }, { t: ' + ', bold: true }, { t: 'Z', i: true, bold: true }],
        12,
        15,
        { size: 11.5, color: isCross ? C.teal : C.text, align: 'left' }
      );

      Theme.drawMath(
        ctx,
        [{ t: '|X|/Y = ' + M.fmt(sys.Td, 3) + '   |Z|/Y = ' + M.fmt(sys.Rrel, 3) + '   (inside unit circle: isolation)' }],
        12,
        h - 12,
        { size: 10.5, color: C.textMuted, align: 'left', family: '"IBM Plex Mono", monospace' }
      );
    }

    function render() { drawRig(); drawTriangle(); }
    return { setSystem, setPlaying, isPlaying: () => playing, step, render };
  }

  window.VibLab.VizTriangle = { create: createTriangleViz };
})();
