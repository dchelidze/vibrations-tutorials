/**
 * viz-splitting.js
 * Section 3 visualization for Module 05 (tuned-vibration-absorber):
 * - Left canvas: Bifurcation-style plot of split natural frequencies r1(mu), r2(mu),
 *                optimal fixed points rP(mu), rQ(mu), and optimal peak bound M_opt(mu) vs. mass ratio mu.
 * - Right canvas: Absorber relative stroke |Xa - X1| / Xst vs. driving frequency ratio r,
 *                 showing the physical clearance cost of vibration suppression.
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathTVA;
  const Theme = window.VibLab.Theme;

  function createSplittingViz(opts) {
    const splitCanvas = document.getElementById(opts.splitCanvasId);
    const strokeCanvas = document.getElementById(opts.strokeCanvasId);
    let sys = opts.sys;

    function setSystem(newSys) {
      sys = newSys;
      render();
    }

    function drawSplitCanvas() {
      if (!splitCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(splitCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 52;
      const padR = 54;
      const padT = 26;
      const padB = 38;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const muMax = 0.40;
      const rMin = 0.5;
      const rMax = 1.5;
      const mMax = 12.0;

      const toX = (mu) => padL + (mu / muMax) * plotW;
      const toYR = (r) => padT + plotH - ((r - rMin) / (rMax - rMin)) * plotH;
      const toYM = (m) => padT + plotH - (Math.min(mMax, m) / mMax) * plotH;

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      // Grid
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let r = 0.6; r <= 1.41; r += 0.2) {
        const py = toYR(r);
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();

        ctx.fillStyle = C.textMuted;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(M.fmt(r, 1), padL - 6, py);
      }

      // Right axis ticks for M_opt
      for (let mv = 2; mv <= 12; mv += 2) {
        const py = toYM(mv);
        ctx.fillStyle = C.teal;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(mv), padL + plotW + 6, py);
      }

      // Curves vs mu in [0.02, 0.40]
      const N = 160;
      const mus = [];
      const r1s = [];
      const r2s = [];
      const bOpts = [];
      const mOpts = [];
      for (let i = 0; i <= N; i++) {
        const mu = 0.02 + ((muMax - 0.02) * i) / N;
        mus.push(mu);
        const sp = M.undampedSplitFreqs(mu, 1.0); // classic beta=1 split
        const op = M.denHartogOptimum(mu);
        r1s.push(sp.r1);
        r2s.push(sp.r2);
        bOpts.push(op.betaOpt);
        mOpts.push(op.MOpt);
      }

      // Shaded notch band between r1 and r2
      ctx.save();
      ctx.fillStyle = C.dark ? 'rgba(77,190,238,0.10)' : 'rgba(0,114,189,0.07)';
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const px = toX(mus[i]);
        const py = toYR(r2s[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      for (let i = N; i >= 0; i--) {
        ctx.lineTo(toX(mus[i]), toYR(r1s[i]));
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      function plotSeries(arr, mapY, color, width, dash) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const px = toX(mus[i]);
          const py = mapY(arr[i]);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }

      plotSeries(r1s, toYR, C.blue, 2.2, null);
      plotSeries(r2s, toYR, C.crimson, 2.2, null);
      plotSeries(bOpts, toYR, C.orange, 1.8, [5, 4]);
      plotSeries(mOpts, toYM, C.teal, 2.2, null);

      // Active mu vertical marker
      const curX = toX(sys.mu);
      ctx.save();
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(curX, padT);
      ctx.lineTo(curX, padT + plotH);
      ctx.stroke();
      ctx.restore();

      // Active dots
      const curSplit = M.undampedSplitFreqs(sys.mu, 1.0);
      [
        [curSplit.r1, toYR, C.blue],
        [curSplit.r2, toYR, C.crimson],
        [sys.opt.MOpt, toYM, C.teal]
      ].forEach(([val, fn, col]) => {
        ctx.fillStyle = col;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(curX, fn(val), 4.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      });

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      // X ticks
      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let mu = 0; mu <= muMax + 1e-6; mu += 0.1) {
        ctx.fillText(M.fmt(mu, 1), toX(mu), padT + plotH + 6);
      }
      Theme.drawMath(
        ctx,
        [
          { t: 'Mass ratio μ = ', bold: true },
          { t: 'm', i: true, bold: true },
          { t: 'a', sub: true, bold: true },
          { t: ' / ', bold: true },
          { t: 'm', i: true, bold: true },
          { t: '1', sub: true, bold: true }
        ],
        padL + plotW * 0.5,
        h - 10,
        { size: 11, color: C.text, align: 'center' }
      );

      // Curve annotations
      Theme.drawMath(
        ctx,
        [{ t: 'r', i: true, bold: true }, { t: '2', sub: true, bold: true }, { t: ' (upper split)', bold: true }],
        padL + plotW - 6,
        toYR(r2s[N]) - 12,
        { size: 10.5, color: C.crimson, align: 'right' }
      );
      Theme.drawMath(
        ctx,
        [{ t: 'r', i: true, bold: true }, { t: '1', sub: true, bold: true }, { t: ' (lower split)', bold: true }],
        padL + plotW - 6,
        toYR(r1s[N]) + 14,
        { size: 10.5, color: C.blue, align: 'right' }
      );
      Theme.drawMath(
        ctx,
        [{ t: 'M', i: true, bold: true }, { t: 'opt', sub: true, bold: true }, { t: '(μ) [right axis]', bold: true }],
        padL + 8,
        padT + 14,
        { size: 10.5, color: C.teal, align: 'left' }
      );
    }

    function drawStrokeCanvas() {
      if (!strokeCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(strokeCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 54;
      const padR = 18;
      const padT = 26;
      const padB = 38;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const rMax = 1.8;

      const N = 360;
      const rs = new Array(N + 1);
      const relCur = new Array(N + 1);
      const relOpt = new Array(N + 1);
      let maxS = 4.0;
      for (let i = 0; i <= N; i++) {
        const r = (rMax * i) / N;
        rs[i] = r;
        const sc = M.evalTVA(sys.mu, sys.beta, sys.zetaA, r).Mrel;
        const so = M.evalTVA(sys.mu, sys.opt.betaOpt, sys.opt.zetaAOpt, r).Mrel;
        relCur[i] = sc;
        relOpt[i] = so;
        if (Number.isFinite(so) && so > maxS) maxS = so;
      }
      const yMax = Math.max(12, Math.min(35, Math.ceil(maxS * 1.65)));

      const toX = (r) => padL + (r / rMax) * plotW;
      const toY = (v) => padT + plotH - (Math.min(yMax * 1.15, v) / yMax) * plotH;

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      // Grid
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      const yStep = yMax > 20 ? 5 : 4;
      for (let y = 0; y <= yMax; y += yStep) {
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

      function plotArr(arr, color, width, dash) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath();
        let down = false;
        for (let i = 0; i <= N; i++) {
          const v = arr[i];
          if (!Number.isFinite(v) || v > yMax * 1.12) {
            down = false;
            continue;
          }
          const px = toX(rs[i]);
          const py = toY(v);
          if (!down) {
            ctx.moveTo(px, py);
            down = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
        ctx.restore();
      }

      // Optimal damped absorber stroke (dashed teal reference)
      plotArr(relOpt, C.teal, 1.8, [5, 4]);
      // Current absorber relative stroke (bold orange)
      plotArr(relCur, C.orange, 2.5, null);

      // Exact undamped notch stroke reference 1/(mu * beta^2)
      const notchStroke = 1 / (sys.mu * sys.beta * sys.beta);
      if (notchStroke <= yMax) {
        const px = toX(sys.beta);
        const py = toY(notchStroke);
        ctx.fillStyle = C.crimson;
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.font = '600 10.5px "IBM Plex Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('1/(μβ²) = ' + M.fmt(notchStroke, 1), px + 6, py - 4);
      }

      ctx.restore();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let r = 0; r <= rMax + 1e-6; r += 0.3) {
        ctx.fillText(M.fmt(r, 1), toX(r), padT + plotH + 6);
      }
      Theme.drawMath(
        ctx,
        [
          { t: 'Forcing frequency ratio ', bold: true },
          { t: 'r', i: true, bold: true },
          { t: ' = ω / ω', bold: true },
          { t: '1', sub: true, bold: true }
        ],
        padL + plotW * 0.5,
        h - 10,
        { size: 11, color: C.text, align: 'center' }
      );

      Theme.drawMath(
        ctx,
        [
          { t: 'Orange: current |', bold: true },
          { t: 'X', i: true, bold: true },
          { t: 'a', sub: true, bold: true },
          { t: ' − ', bold: true },
          { t: 'X', i: true, bold: true },
          { t: '1', sub: true, bold: true },
          { t: '|/', bold: true },
          { t: 'X', i: true, bold: true },
          { t: 'st', sub: true, bold: true },
          { t: ' · Dashed teal: Den Hartog optimum', bold: true }
        ],
        padL,
        padT - 12,
        { size: 10.5, color: C.textMuted, align: 'left' }
      );
    }

    function render() {
      drawSplitCanvas();
      drawStrokeCanvas();
    }

    return { setSystem, render };
  }

  window.VibLab.VizSplitting = { create: createSplittingViz };
})();
