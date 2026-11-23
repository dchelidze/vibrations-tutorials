/**
 * viz-denhartog.js
 * Section 2 centerpiece visualization for Module 10 (tuned-vibration-absorber):
 * Den Hartog's Fixed-Point Theorem!
 * Plots a family of primary-mass FRF curves |X1(r)| / Xst across multiple damping ratios
 * (zetaA = 0, 0.08, zetaA_opt, 0.45, and zetaA -> infinity locked-mass curve) plus the
 * active user curve in bold copper. Every single curve pivots cleanly through the two
 * invariant fixed points P(rP, MP) and Q(rQ, MQ)!
 * Supports direct horizontal pointer dragging to adjust operating frequency rDrive.
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathTVA;
  const Theme = window.VibLab.Theme;

  function createDenHartogViz(opts) {
    const canvas = document.getElementById(opts.canvasId);
    let sys = opts.sys;
    const state = {
      showFamily: true,
      showLocked: true,
      dragging: false
    };
    const view = { padL: 58, plotW: 400, rMax: 1.8 };

    function setSystem(newSys) {
      sys = newSys;
      render();
    }

    function setOptions(o) {
      if (o.showFamily !== undefined) state.showFamily = o.showFamily;
      if (o.showLocked !== undefined) state.showLocked = o.showLocked;
      render();
    }

    function render() {
      if (!canvas) return;
      const { ctx, w, h } = Theme.setupCanvas(canvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 56;
      const padR = 22;
      const padT = 28;
      const padB = 42;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const rMax = 1.8;
      view.padL = padL;
      view.plotW = plotW;
      view.rMax = rMax;

      const yMax = Math.max(8, Math.min(18, Math.ceil(Math.max(sys.fp.MP, sys.fp.MQ, sys.opt.MOpt) * 1.95)));
      const toX = (r) => padL + (r / rMax) * plotW;
      const toY = (m) => padT + plotH - (Math.min(yMax * 1.15, m) / yMax) * plotH;

      // Plot background
      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      // Grid lines
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      const yStep = yMax > 12 ? 2 : 1;
      for (let y = 0; y <= yMax; y += yStep) {
        const py = toY(y);
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();

        ctx.fillStyle = C.textMuted;
        ctx.font = '500 10.5px "IBM Plex Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(y), padL - 7, py);
      }

      for (let r = 0; r <= rMax + 1e-6; r += 0.2) {
        const px = toX(r);
        ctx.beginPath();
        ctx.moveTo(px, padT);
        ctx.lineTo(px, padT + plotH);
        ctx.stroke();

        ctx.fillStyle = C.textMuted;
        ctx.font = '500 10.5px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(M.fmt(r, 1), px, padT + plotH + 6);
      }

      // Clip curves strictly inside plot box
      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      const N = 460;
      function drawFRF(zetaVal, color, width, dash, alpha) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.globalAlpha = alpha === undefined ? 1.0 : alpha;
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath();
        let penDown = false;
        for (let i = 0; i <= N; i++) {
          const r = (rMax * i) / N;
          const m = zetaVal === Infinity ? M.evalLockedLimit(sys.mu, r) : M.evalTVA(sys.mu, sys.beta, zetaVal, r).M1;
          if (!Number.isFinite(m) || m > yMax * 1.12) {
            penDown = false;
            continue;
          }
          const px = toX(r);
          const py = toY(m);
          if (!penDown) {
            ctx.moveTo(px, py);
            penDown = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
        ctx.restore();
      }

      // Optimal equal-height horizontal ceiling line M_opt = sqrt(1 + 2/mu)
      ctx.save();
      ctx.strokeStyle = C.teal;
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.2;
      const yOpt = toY(sys.opt.MOpt);
      ctx.beginPath();
      ctx.moveTo(padL, yOpt);
      ctx.lineTo(padL + plotW, yOpt);
      ctx.stroke();
      ctx.restore();

      // Family of curves showing all damping levels pivoting through P & Q!
      if (state.showFamily) {
        drawFRF(0.0, C.blue, 1.5, [4, 3], 0.72);
        drawFRF(0.07, C.teal, 1.25, null, 0.42);
        drawFRF(sys.opt.zetaAOpt, C.teal, 1.8, null, 0.72);
        drawFRF(0.45, C.purple, 1.35, null, 0.48);
      }
      if (state.showLocked) {
        drawFRF(Infinity, C.ref, 1.5, [6, 4], 0.85);
      }

      // Active user curve (bold copper)
      drawFRF(sys.zetaA, C.copper, 2.8, null, 1.0);

      // Active operating point rDrive vertical cursor + dot
      const curM = M.evalTVA(sys.mu, sys.beta, sys.zetaA, sys.rDrive).M1;
      const curX = toX(sys.rDrive);
      ctx.save();
      ctx.strokeStyle = C.copper;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(curX, padT);
      ctx.lineTo(curX, padT + plotH);
      ctx.stroke();
      ctx.restore();

      if (Number.isFinite(curM) && curM <= yMax) {
        ctx.fillStyle = C.copper;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(curX, toY(curM), 5.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }

      // Highlight the two invariant fixed points P and Q!
      function drawFixedDot(rVal, mVal, label, alignLeft) {
        if (mVal > yMax * 1.02) return;
        const px = toX(rVal);
        const py = toY(mVal);
        ctx.save();
        ctx.fillStyle = C.crimson;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(px, py, 6.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = C.crimson;
        ctx.font = '700 12px "IBM Plex Sans", sans-serif';
        ctx.textAlign = alignLeft ? 'left' : 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(
          label + ' (' + M.fmt(rVal, 2) + ', ' + M.fmt(mVal, 2) + ')',
          px + (alignLeft ? 9 : -9),
          py - 7
        );
        ctx.restore();
      }

      drawFixedDot(sys.fp.rP, sys.fp.MP, 'P', false);
      drawFixedDot(sys.fp.rQ, sys.fp.MQ, 'Q', true);

      // Label M_opt horizontal ceiling
      Theme.drawMath(
        ctx,
        [
          { t: 'M', i: true, bold: true },
          { t: 'opt', sub: true, bold: true },
          { t: ' = √(1 + 2/μ) = ' + M.fmt(sys.opt.MOpt, 2), bold: true }
        ],
        padL + plotW - 8,
        yOpt - 10,
        { size: 10.5, color: C.teal, align: 'right', family: '"IBM Plex Mono", monospace' }
      );

      ctx.restore(); // end clip

      // Plot border
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(padL, padT, plotW, plotH);

      // Axis titles
      Theme.drawMath(
        ctx,
        [
          { t: 'Forcing frequency ratio ', bold: true },
          { t: 'r', i: true, bold: true },
          { t: ' = ω / ω', bold: true },
          { t: '1', sub: true, bold: true },
          { t: '  (drag horizontally to inspect ', bold: true },
          { t: 'r', i: true, bold: true },
          { t: ')', bold: true }
        ],
        padL + plotW * 0.5,
        h - 11,
        { size: 11.5, color: C.text, align: 'center' }
      );

      ctx.save();
      ctx.translate(16, padT + plotH * 0.5);
      ctx.rotate(-Math.PI / 2);
      Theme.drawMath(
        ctx,
        [
          { t: 'Primary amplification |', bold: true },
          { t: 'X', i: true, bold: true },
          { t: '1', sub: true, bold: true },
          { t: '| / (', bold: true },
          { t: 'F', i: true, bold: true },
          { t: '0', sub: true, bold: true },
          { t: '/', bold: true },
          { t: 'k', i: true, bold: true },
          { t: '1', sub: true, bold: true },
          { t: ')', bold: true }
        ],
        0,
        0,
        { size: 11.5, color: C.text, align: 'center' }
      );
      ctx.restore();

      // Top tuning status
      const leveled = Math.abs(sys.fp.MP - sys.fp.MQ) < 0.12;
      if (leveled) {
        Theme.drawMath(
          ctx,
          [
            { t: 'Fixed points ', bold: true },
            { t: 'P', i: true, bold: true },
            { t: ' and ', bold: true },
            { t: 'Q', i: true, bold: true },
            { t: ' leveled at β ≈ β', bold: true },
            { t: 'opt', sub: true, bold: true },
            { t: ' = ' + M.fmt(sys.opt.betaOpt, 3), bold: true }
          ],
          padL,
          padT - 13,
          { size: 11.5, color: C.teal, align: 'left' }
        );
      } else {
        Theme.drawMath(
          ctx,
          [
            { t: 'Fixed points tilted: ', bold: true },
            { t: 'M', i: true, bold: true },
            { t: '(', bold: true },
            { t: 'P', i: true, bold: true },
            { t: ') = ' + M.fmt(sys.fp.MP, 2) + ' vs. ', bold: true },
            { t: 'M', i: true, bold: true },
            { t: '(', bold: true },
            { t: 'Q', i: true, bold: true },
            { t: ') = ' + M.fmt(sys.fp.MQ, 2) + ' — tune β toward ' + M.fmt(sys.opt.betaOpt, 3), bold: true }
          ],
          padL,
          padT - 13,
          { size: 11.5, color: C.amber, align: 'left' }
        );
      }
    }

    if (canvas) {
      function updateFromEvent(e) {
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const frac = Math.max(0.05, Math.min(0.99, (px - view.padL) / view.plotW));
        const r = frac * view.rMax;
        if (opts.onDriveChange) opts.onDriveChange(r);
      }
      canvas.addEventListener('pointerdown', (e) => {
        state.dragging = true;
        canvas.setPointerCapture(e.pointerId);
        updateFromEvent(e);
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!state.dragging) return;
        updateFromEvent(e);
      });
      canvas.addEventListener('pointerup', () => { state.dragging = false; });
      canvas.addEventListener('pointercancel', () => { state.dragging = false; });
    }

    return { setSystem, setOptions, render };
  }

  window.VibLab.VizDenHartog = { create: createDenHartogViz };
})();
