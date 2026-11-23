/**
 * viz-ortho.js
 * Section 2 visualization for Module 11 (beam-modal-geometry):
 * Function-space L^2 orthogonality as cancelling positive/negative area lobes!
 * - Left canvas: Overlay of phi_i(xi) (teal) and phi_j(xi) (crimson) on xi in [0, 1].
 * - Right canvas: Product phi_i(xi) * phi_j(xi) with positive lobes shaded teal and
 *                 negative lobes shaded crimson, proving int_0^1 phi_i phi_j dxi = delta_ij.
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathBeam;
  const Theme = window.VibLab.Theme;

  function createOrthoViz(opts) {
    const pairCanvas = document.getElementById(opts.pairCanvasId);
    const prodCanvas = document.getElementById(opts.prodCanvasId);
    let sys = opts.sys;
    let modeI = 0; // 0..4
    let modeJ = 1; // 0..4

    function setSystem(newSys) {
      sys = newSys;
      render();
    }

    function setPair(i, j) {
      modeI = Math.max(0, Math.min(M.N_MODES - 1, i));
      modeJ = Math.max(0, Math.min(M.N_MODES - 1, j));
      render();
    }

    function drawPairCanvas() {
      if (!pairCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(pairCanvas);
      const C = Theme.get();
      const mi = sys.modes[modeI];
      const mj = sys.modes[modeJ];

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 48;
      const padR = 18;
      const padT = 26;
      const padB = 36;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const yMax = Math.max(mi.maxAbs, mj.maxAbs) * 1.18;
      const toX = (xi) => padL + xi * plotW;
      const toY = (v) => padT + plotH * 0.5 - (v / yMax) * (plotH * 0.46);

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, toY(0));
      ctx.lineTo(padL + plotW, toY(0));
      ctx.stroke();

      const N = 240;
      function plotMode(fn, color, width, dash) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath();
        for (let k = 0; k <= N; k++) {
          const xi = k / N;
          const px = toX(xi);
          const py = toY(fn(xi));
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }

      plotMode(mi.eval, C.teal, 2.4, null);
      plotMode(mj.eval, C.crimson, 2.2, modeI === modeJ ? [6, 4] : null);

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      // X ticks
      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      [0, 0.25, 0.5, 0.75, 1].forEach((xv) => {
        ctx.fillText(M.fmt(xv, 2), toX(xv), padT + plotH + 5);
      });
      Theme.drawMath(ctx, [{ t: 'Normalized position ', bold: true }, { t: 'x', i: true, bold: true }, { t: ' / ', bold: true }, { t: 'L', i: true, bold: true }], padL + plotW * 0.5, h - 10, {
        size: 11,
        color: C.text,
        align: 'center'
      });

      Theme.drawMath(
        ctx,
        [
          { t: 'Teal: φ', bold: true },
          { t: String(modeI + 1), sub: true, bold: true },
          { t: '   ·   Crimson: φ', bold: true },
          { t: String(modeJ + 1), sub: true, bold: true }
        ],
        padL,
        padT - 12,
        { size: 11, color: C.textMuted, align: 'left' }
      );
    }

    function drawProdCanvas() {
      if (!prodCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(prodCanvas);
      const C = Theme.get();
      const mi = sys.modes[modeI];
      const mj = sys.modes[modeJ];

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 48;
      const padR = 18;
      const padT = 26;
      const padB = 36;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const N = 260;
      const xs = new Array(N + 1);
      const ps = new Array(N + 1);
      let maxP = 1.0;
      let posArea = 0;
      let negArea = 0;
      const dx = 1 / N;
      for (let k = 0; k <= N; k++) {
        const xi = k * dx;
        xs[k] = xi;
        const p = mi.eval(xi) * mj.eval(xi);
        ps[k] = p;
        if (Math.abs(p) > maxP) maxP = Math.abs(p);
        if (k > 0) {
          const avg = 0.5 * (ps[k - 1] + p);
          if (avg >= 0) posArea += avg * dx;
          else negArea += -avg * dx;
        }
      }
      maxP *= 1.18;

      const toX = (xi) => padL + xi * plotW;
      const zeroY = modeI === modeJ ? padT + plotH * 0.88 : padT + plotH * 0.5;
      const scaleY = modeI === modeJ ? (plotH * 0.80) / maxP : (plotH * 0.44) / maxP;
      const toY = (v) => zeroY - v * scaleY;

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      // Shade positive lobes (teal) and negative lobes (crimson)
      for (let k = 0; k < N; k++) {
        const pMid = 0.5 * (ps[k] + ps[k + 1]);
        const x0 = toX(xs[k]);
        const x1 = toX(xs[k + 1]);
        const y0 = toY(ps[k]);
        const y1 = toY(ps[k + 1]);
        ctx.fillStyle =
          pMid >= 0
            ? C.dark
              ? 'rgba(38,181,166,0.34)'
              : 'rgba(0,137,123,0.24)'
            : C.dark
              ? 'rgba(240,101,127,0.34)'
              : 'rgba(162,20,47,0.24)';
        ctx.beginPath();
        ctx.moveTo(x0, zeroY);
        ctx.lineTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x1, zeroY);
        ctx.closePath();
        ctx.fill();
      }

      // Zero axis
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, zeroY);
      ctx.lineTo(padL + plotW, zeroY);
      ctx.stroke();

      // Product curve outline
      ctx.strokeStyle = C.text;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      for (let k = 0; k <= N; k++) {
        const px = toX(xs[k]);
        const py = toY(ps[k]);
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      // X ticks
      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      [0, 0.25, 0.5, 0.75, 1].forEach((xv) => {
        ctx.fillText(M.fmt(xv, 2), toX(xv), padT + plotH + 5);
      });
      Theme.drawMath(ctx, [{ t: 'Normalized position ', bold: true }, { t: 'x', i: true, bold: true }, { t: ' / ', bold: true }, { t: 'L', i: true, bold: true }], padL + plotW * 0.5, h - 10, {
        size: 11,
        color: C.text,
        align: 'center'
      });

      const net = M.innerProduct(sys, modeI, modeJ);
      Theme.drawMath(
        ctx,
        [
          { t: 'Area(+) = +' + M.fmt(posArea, 3) + '   Area(−) = −' + M.fmt(negArea, 3) + '   Net = ' + M.fmt(net, 4), bold: true }
        ],
        padL,
        padT - 12,
        { size: 10.5, color: Math.abs(net) < 0.01 ? C.teal : C.copper, align: 'left', family: '"IBM Plex Mono", monospace' }
      );
    }

    function render() {
      drawPairCanvas();
      drawProdCanvas();
    }

    return {
      setSystem,
      setPair,
      getPair: () => [modeI, modeJ],
      render
    };
  }

  window.VibLab.VizOrtho = { create: createOrthoViz };
})();
