/**
 * viz-loops.js
 * Section 1 visualization for Module 05 (sdof-damping-hysteresis):
 * - Left canvas: Pure damping hysteresis loops in the (x, f_d) plane:
 *                Viscous ellipse (blue, scales with r), Structural ellipse (teal, flat in r),
 *                and Coulomb rectangle (crimson, flat in r, height = +/- Fc).
 * - Right canvas: Total spring + damper force f_tot(x) = kx + f_d showing tilted ellipses
 *                 vs. tilted Coulomb parallelogram around dashed spring line f = kx.
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathDamping;
  const Theme = window.VibLab.Theme;

  function createLoopsViz(opts) {
    const pureCanvas = document.getElementById(opts.pureCanvasId);
    const totalCanvas = document.getElementById(opts.totalCanvasId);
    let params = opts.params;

    function setParams(p) {
      params = p;
      render();
    }

    function drawLoopCanvas(canvas, includeSpring) {
      if (!canvas) return;
      const { ctx, w, h } = Theme.setupCanvas(canvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 52;
      const padR = 20;
      const padT = 28;
      const padB = 38;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const X = params.X;
      const r = params.r;
      const fV = 2 * params.zeta * r * X;
      const fS = params.eta * X;
      const fC = params.Fc;

      const xRange = Math.max(1.25, X * 1.35);
      const yMaxPure = Math.max(0.8, fV, fS, fC) * 1.30;
      const yMaxTot = Math.max(1.5, X + Math.max(fV, fS, fC)) * 1.22;
      const yRange = includeSpring ? yMaxTot : yMaxPure;

      const cx = padL + plotW * 0.5;
      const cy = padT + plotH * 0.5;
      const toX = (x) => cx + (x / xRange) * (plotW * 0.46);
      const toY = (f) => cy - (f / yRange) * (plotH * 0.45);

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      // Axes
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, cy);
      ctx.lineTo(padL + plotW, cy);
      ctx.moveTo(cx, padT);
      ctx.lineTo(cx, padT + plotH);
      ctx.stroke();

      // Dashed spring reference line f = kx in total-force panel
      if (includeSpring) {
        ctx.save();
        ctx.strokeStyle = C.ref;
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(toX(-xRange * 0.95), toY(-xRange * 0.95));
        ctx.lineTo(toX(xRange * 0.95), toY(xRange * 0.95));
        ctx.stroke();
        ctx.restore();
      }

      const N = 160;
      // 1. Viscous loop (blue)
      ctx.save();
      ctx.strokeStyle = C.blue;
      ctx.fillStyle = C.dark ? 'rgba(77,190,238,0.11)' : 'rgba(0,114,189,0.08)';
      ctx.lineWidth = 2.3;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const th = (2 * Math.PI * i) / N;
        const x = X * Math.sin(th);
        const f = (includeSpring ? x : 0) + fV * Math.cos(th);
        const px = toX(x);
        const py = toY(f);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 2. Structural loop (teal)
      ctx.save();
      ctx.strokeStyle = C.teal;
      ctx.fillStyle = C.dark ? 'rgba(38,181,166,0.11)' : 'rgba(0,137,123,0.08)';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const th = (2 * Math.PI * i) / N;
        const x = X * Math.sin(th);
        const f = (includeSpring ? x : 0) + fS * Math.cos(th);
        const px = toX(x);
        const py = toY(f);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 3. Coulomb loop (crimson rectangle / tilted parallelogram)
      const kOff = includeSpring ? X : 0;
      ctx.save();
      ctx.strokeStyle = C.crimson;
      ctx.fillStyle = C.dark ? 'rgba(240,101,127,0.10)' : 'rgba(162,20,47,0.07)';
      ctx.lineWidth = 2.3;
      ctx.beginPath();
      ctx.moveTo(toX(-X), toY(-kOff + fC));
      ctx.lineTo(toX(X), toY(kOff + fC));
      ctx.lineTo(toX(X), toY(kOff - fC));
      ctx.lineTo(toX(-X), toY(-kOff - fC));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      // Axis labels
      Theme.drawMath(ctx, [{ t: 'Displacement ', bold: true }, { t: 'x', i: true, bold: true }], padL + plotW * 0.5, h - 10, {
        size: 11.5,
        color: C.text,
        align: 'center'
      });
      Theme.drawMath(
        ctx,
        includeSpring
          ? [{ t: 'Total force ', bold: true }, { t: 'kx', i: true, bold: true }, { t: ' + ', bold: true }, { t: 'f', i: true, bold: true }, { t: 'd', sub: true, bold: true }, { t: '  (area = Δ', bold: true }, { t: 'E', i: true, bold: true }, { t: 'd', sub: true, bold: true }, { t: ')', bold: true }]
          : [{ t: 'Damping force ', bold: true }, { t: 'f', i: true, bold: true }, { t: 'd', sub: true, bold: true }, { t: '  (Blue: viscous · Teal: structural · Crimson: Coulomb)', bold: true }],
        padL,
        padT - 12,
        { size: 10.5, color: C.textMuted, align: 'left' }
      );
    }

    function render() {
      drawLoopCanvas(pureCanvas, false);
      drawLoopCanvas(totalCanvas, true);
    }

    return { setParams, render };
  }

  window.VibLab.VizLoops = { create: createLoopsViz };
})();
