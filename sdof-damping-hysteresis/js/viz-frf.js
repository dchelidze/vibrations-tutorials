/**
 * viz-frf.js
 * Section 4 visualization for Module 05 (sdof-damping-hysteresis):
 * Compares forced frequency response |X| / (F0/k) across Viscous, Structural (k(1+i eta)),
 * and Harmonic-Balance Coulomb dry friction (demonstrating unbounded resonance whenever Fc/F0 < pi/4!).
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathDamping;
  const Theme = window.VibLab.Theme;

  function createFRFViz(opts) {
    const canvas = document.getElementById(opts.canvasId);
    let params = opts.params;

    function setParams(p) {
      params = p;
      render();
    }

    function render() {
      if (!canvas) return;
      const { ctx, w, h } = Theme.setupCanvas(canvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 54;
      const padR = 20;
      const padT = 28;
      const padB = 40;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const rMax = 2.6;
      const yMax = 8.0;
      const toX = (r) => padL + (r / rMax) * plotW;
      const toY = (m) => padT + plotH - (Math.min(yMax * 1.15, m) / yMax) * plotH;

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let y = 0; y <= yMax; y += 2) {
        const py = toY(y);
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();
        ctx.fillStyle = C.textMuted;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(y), padL - 6, py);
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      const N = 420;
      function plotKey(key, color, width, dash) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath();
        let down = false;
        for (let i = 0; i <= N; i++) {
          const r = (rMax * i) / N;
          const ev = M.evalForcedModels(r, params.zeta, params.eta, params.Fc);
          const v = ev[key];
          if (!Number.isFinite(v) || v > yMax * 1.12) {
            down = false;
            continue;
          }
          const px = toX(r);
          const py = toY(v);
          if (!down) { ctx.moveTo(px, py); down = true; }
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }

      plotKey('mVisc', C.blue, 2.5, null);
      plotKey('mStruct', C.teal, 2.3, [6, 3]);
      plotKey('mCoul', C.crimson, 2.3, null);

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
        size: 11.5,
        color: C.text,
        align: 'center'
      });

      Theme.drawMath(
        ctx,
        [
          { t: 'Blue: Viscous   ·   Teal dashed: Structural (', bold: true },
          { t: 'k', i: true, bold: true },
          { t: '(1+iη))   ·   Crimson: Coulomb (', bold: true },
          { t: 'F', i: true, bold: true },
          { t: 'c', sub: true, bold: true },
          { t: '/', bold: true },
          { t: 'F', i: true, bold: true },
          { t: '0', sub: true, bold: true },
          { t: ' = ' + M.fmt(params.Fc, 2) + ', unbounded at ', bold: true },
          { t: 'r', i: true, bold: true },
          { t: '=1 if < π/4)', bold: true }
        ],
        padL,
        padT - 12,
        { size: 10.5, color: C.textMuted, align: 'left' }
      );
    }

    return { setParams, render };
  }

  window.VibLab.VizFRF = { create: createFRFViz };
})();
