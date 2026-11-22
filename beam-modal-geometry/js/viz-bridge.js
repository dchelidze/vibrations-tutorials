/**
 * viz-bridge.js
 * Section 4 visualization for Module 06 (beam-modal-geometry):
 * Compares the quadratic Euler-Bernoulli frequency progression w_n = (beta_n L)^2 w_0
 * across all five classical boundary conditions (CF, SS, CP, CC, FF) against the
 * linear harmonic progression (w_n / w_1 = n) of a taut string / axial bar.
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathBeam;
  const Theme = window.VibLab.Theme;

  function createBridgeViz(opts) {
    const canvas = document.getElementById(opts.canvasId);
    let activeBC = opts.bc || 'CF';

    function setBC(bc) {
      activeBC = bc;
      render();
    }

    function render() {
      if (!canvas) return;
      const { ctx, w, h } = Theme.setupCanvas(canvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 62;
      const padR = 138;
      const padT = 28;
      const padB = 42;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const yMax = 40; // covers CF w_4/w_1 = 34.4 cleanly
      const toX = (n) => padL + ((n - 1) / 3.2) * plotW; // Modes 1..4 clearly spaced
      const toY = (r) => padT + plotH - (Math.min(yMax, r) / yMax) * plotH;

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      // Grid
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      [1, 10, 20, 30, 40].forEach((yv) => {
        const py = toY(yv);
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();

        ctx.fillStyle = C.textMuted;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(yv + '×', padL - 7, py);
      });

      // Reference linear string/bar progression: w_n / w_1 = n (dashed gray)
      ctx.save();
      ctx.strokeStyle = C.ref;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let n = 1; n <= 4; n++) {
        const px = toX(n);
        const py = toY(n);
        if (n === 1) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = C.ref;
      ctx.font = '500 10.5px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('String/bar (ωₙ/ω₁ = n)', toX(4) + 10, toY(4));

      // Plot beam BCs (Modes 1..4)
      const list = [
        ['CF', 'Cantilever (CF)', C.orange],
        ['SS', 'Pinned–Pinned (SS)', C.blue],
        ['CP', 'Clamped–Pinned (CP)', C.teal],
        ['CC', 'Clamped–Clamped / FF', C.purple]
      ];

      list.forEach(([bcKey, label, color]) => {
        const sys = M.getBeamSystem(bcKey);
        const isSel = activeBC === bcKey || (bcKey === 'CC' && activeBC === 'FF');
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = isSel ? 3.2 : 1.7;
        ctx.globalAlpha = isSel ? 1.0 : 0.6;
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const px = toX(k + 1);
          const py = toY(sys.modes[k].omegaRel);
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        for (let k = 0; k < 4; k++) {
          const px = toX(k + 1);
          const py = toY(sys.modes[k].omegaRel);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(px, py, isSel ? 5 : 3.5, 0, 2 * Math.PI);
          ctx.fill();
        }
        ctx.restore();

        // Right-side label cleanly positioned
        const yEnd = toY(sys.modes[3].omegaRel);
        ctx.fillStyle = color;
        ctx.font = (isSel ? '700' : '500') + ' 10.5px "IBM Plex Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, toX(4) + 10, yEnd);
      });

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      // X ticks
      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let n = 1; n <= 4; n++) {
        ctx.fillText('Mode ' + n, toX(n), padT + plotH + 7);
      }

      Theme.drawMath(
        ctx,
        [
          { t: 'Frequency ratio ω', bold: true },
          { t: 'n', sub: true, bold: true },
          { t: ' / ω', bold: true },
          { t: '1', sub: true, bold: true },
          { t: ' = (β', bold: true },
          { t: 'n', sub: true, bold: true },
          { t: 'L / β', i: true, bold: true },
          { t: '1', sub: true, bold: true },
          { t: 'L', i: true, bold: true },
          { t: ')', bold: true },
          { t: '2', sup: true, bold: true },
          { t: '  — quadratic dispersion vs. linear string harmonics', bold: true }
        ],
        padL,
        padT - 13,
        { size: 11.5, color: C.text, align: 'left' }
      );
    }

    return { setBC, render };
  }

  window.VibLab.VizBridge = { create: createBridgeViz };
})();
