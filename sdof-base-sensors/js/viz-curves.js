/**
 * viz-curves.js
 * Section 2 visualization for Module 09 (sdof-base-sensors):
 * - Left canvas: Absolute displacement transmissibility |X|/Y with invariant (sqrt(2), 1) crossover.
 * - Right canvas: Relative displacement |Z|/Y === M X / (m_0 e) (rotating unbalance!)
 *                 approaching unity as r -> infinity.
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathSensors;
  const Theme = window.VibLab.Theme;

  function createCurvesViz(opts) {
    const transCanvas = document.getElementById(opts.transCanvasId);
    const relCanvas = document.getElementById(opts.relCanvasId);
    let sys = opts.sys;

    function setSystem(newSys) { sys = newSys; render(); }

    function drawPlot(canvas, isRel) {
      if (!canvas) return;
      const { ctx, w, h } = Theme.setupCanvas(canvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 50, padR = 18, padT = 26, padB = 38;
      const plotW = w - padL - padR, plotH = h - padT - padB;
      const rMax = 4.0, yMax = 4.5;
      const toX = (r) => padL + (r / rMax) * plotW;
      const toY = (v) => padT + plotH - (Math.min(yMax * 1.12, v) / yMax) * plotH;

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      // Horizontal grid & unity reference y = 1
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      [0, 1, 2, 3, 4].forEach((yv) => {
        const py = toY(yv);
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();
        ctx.fillStyle = C.textMuted;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(yv), padL - 6, py);
      });

      ctx.save();
      ctx.strokeStyle = C.gridStrong;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, toY(1));
      ctx.lineTo(padL + plotW, toY(1));
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      const N = 320;
      function plotCurve(z, color, width, dash, alpha) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.globalAlpha = alpha;
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const r = (rMax * i) / N;
          const ev = M.evalBaseSensor(r, z);
          const val = isRel ? ev.Rrel : ev.Td;
          const px = toX(r);
          const py = toY(val);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }

      plotCurve(0.10, C.ref, 1.3, [4, 3], 0.6);
      plotCurve(0.35, C.ref, 1.2, null, 0.5);
      plotCurve(0.70, C.teal, 1.6, [6, 3], 0.8);
      plotCurve(sys.zeta, isRel ? C.crimson : C.blue, 2.6, null, 1.0);

      if (!isRel) {
        // Crossover dot (sqrt(2), 1)
        const cx = toX(Math.SQRT2), cy = toY(1);
        ctx.fillStyle = C.crimson;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 5.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        Theme.drawMath(ctx, [{ t: '(√2, 1)', bold: true }], cx + 8, cy - 10, { size: 10.5, color: C.crimson, align: 'left' });
      } else {
        Theme.drawMath(ctx, [{ t: 'Asymptote → 1', bold: true }], padL + plotW - 8, toY(1) - 10, { size: 10.5, color: C.teal, align: 'right' });
      }

      // Active r cursor
      const curX = toX(Math.min(rMax, sys.r));
      const curV = isRel ? sys.Rrel : sys.Td;
      ctx.strokeStyle = C.copper;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(curX, padT);
      ctx.lineTo(curX, padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      if (curV <= yMax) {
        ctx.fillStyle = C.copper;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(curX, toY(curV), 5.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let r = 0; r <= rMax + 1e-6; r += 0.5) ctx.fillText(M.fmt(r, 1), toX(r), padT + plotH + 6);

      Theme.drawMath(ctx, [{ t: 'Frequency ratio ', bold: true }, { t: 'r', i: true, bold: true }, { t: ' = ω / ω', bold: true }, { t: 'n', sub: true, bold: true }], padL + plotW * 0.5, h - 10, {
        size: 11, color: C.text, align: 'center'
      });
      Theme.drawMath(
        ctx,
        isRel
          ? [{ t: 'Relative motion |', bold: true }, { t: 'Z', i: true, bold: true }, { t: '|/', bold: true }, { t: 'Y', i: true, bold: true }, { t: ' ≡ ', bold: true }, { t: 'MX', i: true, bold: true }, { t: '/(', bold: true }, { t: 'm', i: true, bold: true }, { t: '0', sub: true, bold: true }, { t: 'e', i: true, bold: true }, { t: ')', bold: true }]
          : [{ t: 'Absolute transmissibility |', bold: true }, { t: 'X', i: true, bold: true }, { t: '|/', bold: true }, { t: 'Y', i: true, bold: true }, { t: ' (dashed teal: ζ = 0.70)', bold: true }],
        padL,
        padT - 11,
        { size: 11, color: C.text, align: 'left' }
      );
    }

    function render() { drawPlot(transCanvas, false); drawPlot(relCanvas, true); }
    return { setSystem, render };
  }

  window.VibLab.VizCurves = { create: createCurvesViz };
})();
