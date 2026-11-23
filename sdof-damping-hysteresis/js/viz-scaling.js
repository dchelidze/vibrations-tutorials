/**
 * viz-scaling.js
 * Section 2 visualization for Module 05 (sdof-damping-hysteresis):
 * - Left canvas: Energy dissipated per cycle Delta E_d vs. frequency ratio r = w / w_n
 *                (viscous grows linearly with r; Coulomb & structural remain strictly flat!).
 * - Right canvas: Equivalent viscous damping ratio zeta_eq vs. amplitude X
 *                 (viscous & structural constant in X; Coulomb diverges as 1/X at small X!).
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathDamping;
  const Theme = window.VibLab.Theme;

  function createScalingViz(opts) {
    const freqCanvas = document.getElementById(opts.freqCanvasId);
    const ampCanvas = document.getElementById(opts.ampCanvasId);
    let params = opts.params;

    function setParams(p) {
      params = p;
      render();
    }

    function drawFreqCanvas() {
      if (!freqCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(freqCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 52;
      const padR = 18;
      const padT = 26;
      const padB = 38;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const rMax = 3.0;
      const X = params.X;
      const maxE = Math.max(
        2 * Math.PI * params.zeta * rMax * X * X,
        Math.PI * params.eta * X * X,
        4 * params.Fc * X,
        1.0
      ) * 1.15;

      const toX = (r) => padL + (r / rMax) * plotW;
      const toY = (e) => padT + plotH - (e / maxE) * plotH;

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      // Grid
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const v = (maxE * i) / 4;
        const py = toY(v);
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();
        ctx.fillStyle = C.textMuted;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(M.fmt(v, 1), padL - 6, py);
      }

      // Viscous: linear in r
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(0));
      ctx.lineTo(toX(rMax), toY(2 * Math.PI * params.zeta * rMax * X * X));
      ctx.stroke();

      // Structural: flat in r
      const eS = Math.PI * params.eta * X * X;
      ctx.save();
      ctx.strokeStyle = C.teal;
      ctx.setLineDash([6, 3]);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(eS));
      ctx.lineTo(toX(rMax), toY(eS));
      ctx.stroke();
      ctx.restore();

      // Coulomb: flat in r
      const eC = 4 * params.Fc * X;
      ctx.strokeStyle = C.crimson;
      ctx.lineWidth = 2.3;
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(eC));
      ctx.lineTo(toX(rMax), toY(eC));
      ctx.stroke();

      // Active r cursor
      const curX = toX(Math.min(rMax, params.r));
      ctx.save();
      ctx.strokeStyle = C.copper;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(curX, padT);
      ctx.lineTo(curX, padT + plotH);
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let r = 0; r <= rMax + 1e-6; r += 0.5) {
        ctx.fillText(M.fmt(r, 1), toX(r), padT + plotH + 6);
      }
      Theme.drawMath(ctx, [{ t: 'Frequency ratio ', bold: true }, { t: 'r', i: true, bold: true }, { t: ' = ω / ω', bold: true }, { t: 'n', sub: true, bold: true }], padL + plotW * 0.5, h - 10, {
        size: 11,
        color: C.text,
        align: 'center'
      });
      Theme.drawMath(ctx, [{ t: 'Energy per cycle Δ', bold: true }, { t: 'E', i: true, bold: true }, { t: 'd', sub: true, bold: true }, { t: '(r) at current ', bold: true }, { t: 'X', i: true, bold: true }, { t: ' = ' + M.fmt(X, 2), bold: true }], padL, padT - 11, {
        size: 11,
        color: C.text,
        align: 'left'
      });
    }

    function drawAmpCanvas() {
      if (!ampCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(ampCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 52;
      const padR = 18;
      const padT = 26;
      const padB = 38;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const xMin = 0.2;
      const xMax = 2.0;
      const zMax = 0.85;
      const toX = (x) => padL + ((x - xMin) / (xMax - xMin)) * plotW;
      const toY = (z) => padT + plotH - (Math.min(zMax * 1.1, z) / zMax) * plotH;

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let z = 0; z <= 0.81; z += 0.2) {
        const py = toY(z);
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();
        ctx.fillStyle = C.textMuted;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(M.fmt(z, 1), padL - 6, py);
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      // Viscous: constant zeta
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2.3;
      ctx.beginPath();
      ctx.moveTo(toX(xMin), toY(params.zeta));
      ctx.lineTo(toX(xMax), toY(params.zeta));
      ctx.stroke();

      // Structural: constant eta/(2r)
      const zS = params.eta / (2 * params.r);
      ctx.save();
      ctx.strokeStyle = C.teal;
      ctx.setLineDash([6, 3]);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(toX(xMin), toY(zS));
      ctx.lineTo(toX(xMax), toY(zS));
      ctx.stroke();
      ctx.restore();

      // Coulomb: 2 Fc / (pi r X) ~ 1/X hyperbola!
      ctx.strokeStyle = C.crimson;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const N = 160;
      for (let i = 0; i <= N; i++) {
        const x = xMin + ((xMax - xMin) * i) / N;
        const zC = (2 * params.Fc) / (Math.PI * params.r * x);
        const px = toX(x);
        const py = toY(zC);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Active X cursor
      const curX = toX(Math.max(xMin, Math.min(xMax, params.X)));
      ctx.strokeStyle = C.copper;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(curX, padT);
      ctx.lineTo(curX, padT + plotH);
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      [0.2, 0.6, 1.0, 1.4, 1.8].forEach((xv) => {
        ctx.fillText(M.fmt(xv, 1), toX(xv), padT + plotH + 6);
      });
      Theme.drawMath(ctx, [{ t: 'Harmonic amplitude ', bold: true }, { t: 'X', i: true, bold: true }], padL + plotW * 0.5, h - 10, {
        size: 11,
        color: C.text,
        align: 'center'
      });
      Theme.drawMath(ctx, [{ t: 'Equivalent damping ζ', bold: true }, { t: 'eq', sub: true, bold: true }, { t: '(X) — Coulomb scales as 1/', bold: true }, { t: 'X', i: true, bold: true }], padL, padT - 11, {
        size: 11,
        color: C.text,
        align: 'left'
      });
    }

    function render() {
      drawFreqCanvas();
      drawAmpCanvas();
    }

    return { setParams, render };
  }

  window.VibLab.VizScaling = { create: createScalingViz };
})();
