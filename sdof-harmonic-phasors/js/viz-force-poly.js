/**
 * viz-force-poly.js
 * Section 1 centerpiece visualization for Module 03 (sdof-harmonic-phasors):
 * - Left canvas: Live animated 1-DOF forced mass-spring-damper rig with auto-sized mass block
 *                and synchronized drive F0(t) vs. displacement x(t) mini-waveform showing phase lag phi.
 * - Right canvas: Complex force-balance polygon (optionally rotating at w or locked to X-axis):
 *                 kX (0 deg) + i c w X (+90 deg) - m w^2 X (+180 deg) = F0 (+phi ahead of X).
 *                 All vector labels sit cleanly at vector midpoints pushed strictly outward!
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathHarmonic;
  const Theme = window.VibLab.Theme;

  function createForcePolyViz(opts) {
    const rigCanvas = document.getElementById(opts.rigCanvasId);
    const polyCanvas = document.getElementById(opts.polyCanvasId);
    let sys = opts.sys;

    const state = {
      phase: 0,
      playing: true,
      rotateFrame: false // false = displacement-locked polygon (classic textbook), true = rotating phasors
    };

    function setSystem(newSys) {
      sys = newSys;
      render();
    }

    function setPlaying(p) {
      state.playing = !!p;
    }

    function setRotateFrame(flag) {
      state.rotateFrame = !!flag;
      render();
    }

    function step(dt) {
      if (!state.playing) return;
      const visRate = Math.min(7.5, Math.max(1.8, sys.r * 3.0));
      state.phase += dt * visRate;
      render();
    }

    function drawRig() {
      if (!rigCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(rigCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      // Top 56%: Mechanical oscillator; Bottom 44%: live F0(t) vs x(t) phase-lag traces
      const splitY = Math.round(h * 0.56);
      const trackY = Math.round(splitY * 0.56);
      const leftWall = 26;
      const rightEdge = w - 24;
      const restX = leftWall + (rightEdge - leftWall) * 0.50;

      // Auto-sized mass block containing m and |X|/X_st cleanly
      const titleRuns = [{ t: 'Mass ', bold: true }, { t: 'm', i: true, bold: true }];
      const subRuns = [
        { t: '|' },
        { t: 'X', i: true },
        { t: '|/' },
        { t: 'X', i: true },
        { t: 'st', sub: true },
        { t: ' = ' + M.fmt(sys.M, 2) }
      ];
      const wT = Theme.measureMathRuns(ctx, titleRuns, 13, '"IBM Plex Sans", sans-serif');
      const wS = Theme.measureMathRuns(ctx, subRuns, 11, '"IBM Plex Mono", monospace');
      const boxW = Math.max(134, Math.ceil(Math.max(wT, wS)) + 30);
      const boxH = 54;

      const visAmp = Math.min(48, (rightEdge - leftWall - boxW) * 0.24) * Math.min(1, sys.M / Math.max(1.5, Math.min(sys.M, 6)));
      const xDisp = visAmp * Math.cos(state.phase - sys.phi);
      const fVal = Math.cos(state.phase);
      const boxX = restX + xDisp;

      // Wall & floor
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(leftWall, trackY - 34);
      ctx.lineTo(leftWall, trackY + 34);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = C.textMuted;
      for (let yy = trackY - 30; yy <= trackY + 30; yy += 9) {
        ctx.beginPath();
        ctx.moveTo(leftWall, yy);
        ctx.lineTo(leftWall - 8, yy + 5);
        ctx.stroke();
      }

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(leftWall, trackY + boxH * 0.5 + 4);
      ctx.lineTo(rightEdge, trackY + boxH * 0.5 + 4);
      ctx.stroke();

      // Rest marker
      ctx.save();
      ctx.strokeStyle = C.ref;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(restX, trackY - boxH * 0.5 - 16);
      ctx.lineTo(restX, trackY + boxH * 0.5 + 14);
      ctx.stroke();
      ctx.restore();

      // Spring k & damper c
      Theme.drawSpring(ctx, leftWall, trackY - 10, boxX - boxW * 0.5, trackY - 10, 7, 7, C.blue, 1.9);
      Theme.drawDamper(ctx, leftWall, trackY + 12, boxX - boxW * 0.5, trackY + 12, C.teal, 1.6);
      Theme.drawMath(ctx, [{ t: 'k', i: true, bold: true }], 0.5 * (leftWall + boxX - boxW * 0.5), trackY - 24, {
        size: 11.5,
        color: C.blue,
        align: 'center'
      });
      Theme.drawMath(ctx, [{ t: 'c', i: true, bold: true }], 0.5 * (leftWall + boxX - boxW * 0.5), trackY + 26, {
        size: 11.5,
        color: C.teal,
        align: 'center'
      });

      // Mass block
      ctx.fillStyle = C.bgSubtle;
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2.4;
      ctx.fillRect(boxX - boxW * 0.5, trackY - boxH * 0.5, boxW, boxH);
      ctx.strokeRect(boxX - boxW * 0.5, trackY - boxH * 0.5, boxW, boxH);
      Theme.drawMath(ctx, titleRuns, boxX, trackY - 9, { size: 13, color: C.blue, align: 'center' });
      Theme.drawMath(ctx, subRuns, boxX, trackY + 11, {
        size: 11,
        color: C.textMuted,
        align: 'center',
        family: '"IBM Plex Mono", monospace'
      });

      // Live external force arrow F0(t) on right face
      const fLen = fVal * 44;
      if (Math.abs(fLen) > 3) {
        Theme.drawArrow(ctx, boxX + boxW * 0.5 + 6, trackY, boxX + boxW * 0.5 + 6 + fLen, trackY, C.copper, 2.6, 9);
      }
      Theme.drawMath(
        ctx,
        [{ t: 'F', i: true, bold: true }, { t: '0', sub: true, bold: true }, { t: ' cos(ω', bold: true }, { t: 't', i: true, bold: true }, { t: ')', bold: true }],
        rightEdge,
        trackY - 24,
        { size: 11, color: C.copper, align: 'right' }
      );

      // Divider
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(14, splitY);
      ctx.lineTo(w - 14, splitY);
      ctx.stroke();

      // ---- BOTTOM 44%: Synchronized F0(t) [copper dashed] and x(t) [blue solid] ----
      const padL = 44;
      const padR = 16;
      const wTop = splitY + 22;
      const wBot = h - 18;
      const wH = wBot - wTop;
      const wW = w - padL - padR;
      const midY = wTop + wH * 0.5;

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, wTop, wW, wH);
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, midY);
      ctx.lineTo(padL + wW, midY);
      ctx.stroke();

      const N = 220;
      const cycles = 2.5 * 2 * Math.PI;
      // Drive cos(theta)
      ctx.save();
      ctx.strokeStyle = C.copper;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const th = state.phase - cycles * (1 - i / N);
        const px = padL + (i / N) * wW;
        const py = midY - Math.cos(th) * (wH * 0.36);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // Displacement cos(theta - phi)
      ctx.save();
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2.3;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const th = state.phase - cycles * (1 - i / N);
        const px = padL + (i / N) * wW;
        const py = midY - Math.cos(th - sys.phi) * (wH * 0.40);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1;
      ctx.strokeRect(padL, wTop, wW, wH);

      Theme.drawMath(
        ctx,
        [
          { t: 'Dashed copper: ', bold: true },
          { t: 'F', i: true, bold: true },
          { t: '0', sub: true, bold: true },
          { t: '(t)   ·   Solid blue: ', bold: true },
          { t: 'x', i: true, bold: true },
          { t: '(t) lags by φ = ' + M.fmt(sys.phiDeg, 1) + '°', bold: true }
        ],
        padL,
        wTop - 10,
        { size: 11, color: C.textMuted, align: 'left' }
      );
    }

    function drawPolygon() {
      if (!polyCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(polyCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      // Force-balance polygon normalized by F0:
      // Starting at origin O:
      //   p0 = (0, 0)
      //   p1 = p0 + F_spring  = (M, 0)
      //   p2 = p1 + F_damp    = (M, 2*zeta*r*M)
      //   p3 = p2 + F_inert   = ((1 - r^2)M, 2*zeta*r*M) === (cos phi, sin phi) == F0!
      const rot = state.rotateFrame ? state.phase - sys.phi : 0;
      const cR = Math.cos(rot);
      const sR = Math.sin(rot);
      const rotPt = (x, y) => [x * cR - y * sR, x * sR + y * cR];

      const p0m = [0, 0];
      const p1m = [sys.fSpring, 0];
      const p2m = [sys.fSpring, sys.fDamp];
      const p3m = [sys.fSpring - sys.fInert, sys.fDamp]; // exact (cos phi, sin phi)!

      const pts = [p0m, p1m, p2m, p3m].map(([x, y]) => rotPt(x, y));

      // Compute smart bounding box so entire polygon & unit circle stay cleanly centered!
      let minX = -1.15, maxX = 1.15, minY = -1.15, maxY = 1.15;
      for (const [x, y] of pts) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const spanX = (maxX - minX) * 1.28;
      const spanY = (maxY - minY) * 1.28;
      const midMx = 0.5 * (minX + maxX);
      const midMy = 0.5 * (minY + maxY);

      const pad = 42;
      const scale = Math.min((w - 2 * pad) / spanX, (h - 2 * pad - 24) / spanY);
      const cx = w * 0.5 - midMx * scale;
      const cy = h * 0.53 + midMy * scale;
      const toX = (x) => cx + x * scale;
      const toY = (y) => cy - y * scale;

      // Unit circle |F/F0| = 1
      ctx.save();
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, scale, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();

      // Subtle axes through origin
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(14, cy);
      ctx.lineTo(w - 14, cy);
      ctx.moveTo(cx, 30);
      ctx.lineTo(cx, h - 24);
      ctx.stroke();

      // Convert polygon vertices to pixels
      const P = pts.map(([x, y]) => [toX(x), toY(y)]);
      // Polygon centroid in pixels (so every midpoint label pushes strictly AWAY from centroid!)
      const centX = (P[0][0] + P[1][0] + P[2][0] + P[3][0]) * 0.25;
      const centY = (P[0][1] + P[1][1] + P[2][1] + P[3][1]) * 0.25;

      function labelMidOutward(A, B, runs, color, dist) {
        const dx = B[0] - A[0];
        const dy = B[1] - A[1];
        const L = Math.hypot(dx, dy);
        if (L < 14) return;
        const mx = 0.5 * (A[0] + B[0]);
        const my = 0.5 * (A[1] + B[1]);
        let nx = -dy / L;
        let ny = dx / L;
        // Ensure (nx, ny) points AWAY from polygon centroid!
        if (nx * (centX - mx) + ny * (centY - my) > 0) {
          nx = -nx;
          ny = -ny;
        }
        Theme.drawMath(ctx, runs, mx + nx * (dist || 18), my + ny * (dist || 18), {
          size: 11.5,
          color,
          align: 'center'
        });
      }

      // Draw displacement reference direction ray along X
      const xDir = rotPt(1.15, 0);
      ctx.save();
      ctx.strokeStyle = C.ref;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(P[0][0], P[0][1]);
      ctx.lineTo(toX(xDir[0]), toY(xDir[1]));
      ctx.stroke();
      ctx.restore();

      // Phase lag arc phi between X direction and F0!
      const angX = -rot;
      const angF = -(rot + sys.phi);
      ctx.save();
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 1.5;
      const arcR = Math.min(30, scale * 0.45);
      ctx.beginPath();
      ctx.arc(P[0][0], P[0][1], arcR, angF, angX, false);
      ctx.stroke();
      const midA = 0.5 * (angF + angX);
      Theme.drawMath(
        ctx,
        [{ t: 'φ', bold: true }],
        P[0][0] + (arcR + 12) * Math.cos(midA),
        P[0][1] + (arcR + 12) * Math.sin(midA),
        { size: 11.5, color: C.copper, align: 'center' }
      );
      ctx.restore();

      // 1. Stiffness kX (blue)
      Theme.drawArrow(ctx, P[0][0], P[0][1], P[1][0], P[1][1], C.blue, 2.6, 9);
      labelMidOutward(P[0], P[1], [{ t: 'kX', i: true, bold: true }], C.blue, 16);

      // 2. Damping i c w X (teal)
      Theme.drawArrow(ctx, P[1][0], P[1][1], P[2][0], P[2][1], C.teal, 2.6, 9);
      labelMidOutward(P[1], P[2], [{ t: 'i', bold: true }, { t: ' cωX', i: true, bold: true }], C.teal, 22);

      // 3. Inertia -m w^2 X (crimson)
      Theme.drawArrow(ctx, P[2][0], P[2][1], P[3][0], P[3][1], C.crimson, 2.6, 9);
      labelMidOutward(
        P[2],
        P[3],
        [{ t: '−', bold: true }, { t: 'm', i: true, bold: true }, { t: 'ω', bold: true }, { t: '2', sup: true, bold: true }, { t: 'X', i: true, bold: true }],
        C.crimson,
        18
      );

      // 4. Closing drive vector F0 (copper)
      Theme.drawArrow(ctx, P[0][0], P[0][1], P[3][0], P[3][1], C.copper, 3.0, 10);
      labelMidOutward(P[0], P[3], [{ t: 'F', i: true, bold: true }, { t: '0', sub: true, bold: true }], C.copper, 16);

      // Top status callout
      const atPhaseRes = Math.abs(sys.r - 1.0) < 0.03;
      Theme.drawMath(
        ctx,
        atPhaseRes
          ? [
              { t: 'Phase resonance (', bold: true },
              { t: 'r', i: true, bold: true },
              { t: ' = 1): ', bold: true },
              { t: 'kX', i: true, bold: true },
              { t: ' and −', bold: true },
              { t: 'm', i: true, bold: true },
              { t: 'ω', bold: true },
              { t: '2', sup: true, bold: true },
              { t: 'X', i: true, bold: true },
              { t: ' cancel — ', bold: true },
              { t: 'cωX', i: true, bold: true },
              { t: ' = ', bold: true },
              { t: 'F', i: true, bold: true },
              { t: '0', sub: true, bold: true },
              { t: ', φ = 90°', bold: true }
            ]
          : [
              { t: 'Force closure: ', bold: true },
              { t: 'kX', i: true, bold: true },
              { t: ' + i', bold: true },
              { t: 'cωX', i: true, bold: true },
              { t: ' − ', bold: true },
              { t: 'm', i: true, bold: true },
              { t: 'ω', bold: true },
              { t: '2', sup: true, bold: true },
              { t: 'X', i: true, bold: true },
              { t: ' = ', bold: true },
              { t: 'F', i: true, bold: true },
              { t: '0', sub: true, bold: true }
            ],
        12,
        16,
        { size: 11.5, color: atPhaseRes ? C.teal : C.text, align: 'left' }
      );

      // Footer readout
      Theme.drawMath(
        ctx,
        [
          { t: 'kX/F' },
          { t: '0', sub: true },
          { t: ' = ' + M.fmt(sys.fSpring, 2) + '   cωX/F' },
          { t: '0', sub: true },
          { t: ' = ' + M.fmt(sys.fDamp, 2) + '   mω' },
          { t: '2', sup: true },
          { t: 'X/F' },
          { t: '0', sub: true },
          { t: ' = ' + M.fmt(sys.fInert, 2) }
        ],
        12,
        h - 12,
        { size: 10.5, color: C.textMuted, align: 'left', family: '"IBM Plex Mono", monospace' }
      );
    }

    function render() {
      drawRig();
      drawPolygon();
    }

    return {
      setSystem,
      setPlaying,
      isPlaying: () => state.playing,
      setRotateFrame,
      step,
      render
    };
  }

  window.VibLab.VizForcePoly = { create: createForcePolyViz };
})();
