/**
 * viz-isolation.js
 * Section 4 visualization for Module 05 (tuned-vibration-absorber):
 * Passive Vibration Isolation & the Invariant r = sqrt(2) Crossover:
 * - Left canvas: Transmissibility T(r, zeta) for a family of damping ratios plus
 *                active user zeta, highlighting the exact crossover (sqrt(2), 1),
 *                amplification region (r < sqrt(2)), and isolation region (r > sqrt(2)).
 * - Right canvas: Transmitted force phasor triangle F_T = kX + i c w X = (1 + i 2 zeta r) X,
 *                 showing geometrically why damping helps at resonance (r = 1) yet
 *                 degrades high-frequency isolation (r > sqrt(2))!
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathTVA;
  const Theme = window.VibLab.Theme;

  function createIsolationViz(opts) {
    const transCanvas = document.getElementById(opts.transCanvasId);
    const phasorCanvas = document.getElementById(opts.phasorCanvasId);

    const state = {
      zeta: 0.15,
      r: 2.2,
      dragging: false
    };
    const view = { padL: 54, plotW: 320, rMax: 4.0 };

    function setParams(p) {
      if (p.zeta !== undefined) state.zeta = Math.max(0.02, Math.min(1.0, p.zeta));
      if (p.r !== undefined) state.r = Math.max(0.1, Math.min(4.0, p.r));
      if (opts.onChange) opts.onChange(state);
      render();
    }

    function drawTransCanvas() {
      if (!transCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(transCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 54;
      const padR = 16;
      const padT = 26;
      const padB = 38;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const rMax = 4.0;
      const logMin = -2.0; // T = 0.01
      const logMax = 1.2;  // T ~ 15.8

      view.padL = padL;
      view.plotW = plotW;
      view.rMax = rMax;

      const toX = (r) => padL + (r / rMax) * plotW;
      const toY = (T) => {
        const lt = Math.max(logMin, Math.min(logMax, Math.log10(Math.max(1e-4, T))));
        return padT + ((logMax - lt) / (logMax - logMin)) * plotH;
      };

      // Shaded amplification vs isolation zones split at r = sqrt(2)
      const xCross = toX(Math.SQRT2);
      const yOne = toY(1.0);
      ctx.fillStyle = C.dark ? 'rgba(240,101,127,0.09)' : 'rgba(162,20,47,0.06)';
      ctx.fillRect(padL, padT, xCross - padL, yOne - padT);
      ctx.fillStyle = C.dark ? 'rgba(38,181,166,0.09)' : 'rgba(0,137,123,0.06)';
      ctx.fillRect(xCross, yOne, padL + plotW - xCross, padT + plotH - yOne);

      // Horizontal log ticks
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      [0.01, 0.1, 1, 10].forEach((val) => {
        const py = toY(val);
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();

        ctx.fillStyle = C.textMuted;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(val), padL - 6, py);
      });

      // T = 1 strong reference line & r = sqrt(2) vertical line
      ctx.save();
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(padL, yOne);
      ctx.lineTo(padL + plotW, yOne);
      ctx.stroke();

      ctx.strokeStyle = C.crimson;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(xCross, padT);
      ctx.lineTo(xCross, padT + plotH);
      ctx.stroke();
      ctx.restore();

      // Family of transmissibility curves
      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      const N = 340;
      function plotT(zetaVal, color, width, dash, alpha) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const r = (rMax * i) / N;
          const T = M.evalTransmissibility(r, zetaVal).T;
          const px = toX(r);
          const py = toY(T);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }

      plotT(0.05, C.blue, 1.4, [4, 3], 0.65);
      plotT(0.25, C.teal, 1.3, null, 0.55);
      plotT(0.70, C.purple, 1.4, [6, 3], 0.65);
      // Active curve
      plotT(state.zeta, C.copper, 2.7, null, 1.0);

      // Invariant crossover dot (sqrt(2), 1)
      ctx.fillStyle = C.crimson;
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(xCross, yOne, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = C.crimson;
      ctx.font = '700 11px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('(√2, 1) crossover', xCross + 8, yOne - 6);

      // Operating point cursor
      const curT = M.evalTransmissibility(state.r, state.zeta).T;
      const curX = toX(state.r);
      const curY = toY(curT);
      ctx.strokeStyle = C.copper;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(curX, padT);
      ctx.lineTo(curX, padT + plotH);
      ctx.stroke();

      ctx.fillStyle = C.copper;
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(curX, curY, 5.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Zone labels
      ctx.fillStyle = C.crimson;
      ctx.font = '600 10.5px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('Amplification (T > 1)', padL + 6, padT + 6);

      ctx.fillStyle = C.teal;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Isolation zone (T < 1)', padL + plotW - 8, padT + plotH - 8);

      ctx.restore();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      // X ticks
      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let r = 0; r <= rMax + 1e-6; r += 0.5) {
        ctx.fillText(M.fmt(r, 1), toX(r), padT + plotH + 6);
      }
      ctx.font = '600 11px "IBM Plex Sans", sans-serif';
      ctx.fillText('Frequency ratio r = ω / ωₙ (drag horizontally)', padL + plotW * 0.5, h - 14);
    }

    function drawPhasorCanvas() {
      if (!phasorCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(phasorCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const res = M.evalTransmissibility(state.r, state.zeta);
      const Fs = res.Fspring;
      const Fd = res.Fdamp;
      const Ft = res.Tcomplex;

      const maxMag = Math.max(1.15, res.T, M.cAbs(Fs), M.cAbs(Fd));
      const range = maxMag * 1.28;
      const pad = 34;
      const scale = Math.min((w - 2 * pad) / (2 * range), (h - 2 * pad - 24) / (2 * range));
      const cx = w * 0.5;
      const cy = h * 0.53;
      const toX = (re) => cx + re * scale;
      const toY = (im) => cy - im * scale;

      // Unit circle |F_T / F_0| = 1 (isolation boundary!)
      ctx.save();
      ctx.strokeStyle = C.teal;
      ctx.fillStyle = C.dark ? 'rgba(38,181,166,0.08)' : 'rgba(0,137,123,0.06)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, scale, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Axes
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(16, cy);
      ctx.lineTo(w - 16, cy);
      ctx.moveTo(cx, 28);
      ctx.lineTo(cx, h - 22);
      ctx.stroke();

      // Right-angle square marker at vertex Fs between kX and i c*w*X
      const fsPixX = toX(Fs.re);
      const fsPixY = toY(Fs.im);
      const ftPixX = toX(Ft.re);
      const ftPixY = toY(Ft.im);

      const e1x = fsPixX - cx;
      const e1y = fsPixY - cy;
      const e1L = Math.hypot(e1x, e1y);
      const e2x = ftPixX - fsPixX;
      const e2y = ftPixY - fsPixY;
      const e2L = Math.hypot(e2x, e2y);
      const e3x = ftPixX - cx;
      const e3y = ftPixY - cy;
      const e3L = Math.hypot(e3x, e3y);

      if (e1L > 22 && e2L > 22) {
        const sq = Math.min(10, e1L * 0.22, e2L * 0.22);
        const u1x = -e1x / e1L;
        const u1y = -e1y / e1L;
        const u2x = e2x / e2L;
        const u2y = e2y / e2L;
        ctx.save();
        ctx.strokeStyle = C.textMuted;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(fsPixX + u1x * sq, fsPixY + u1y * sq);
        ctx.lineTo(fsPixX + (u1x + u2x) * sq, fsPixY + (u1y + u2y) * sq);
        ctx.lineTo(fsPixX + u2x * sq, fsPixY + u2y * sq);
        ctx.stroke();
        ctx.restore();
      }

      // Right-angle transmitted force triangle: F_T = kX + i c w X
      Theme.drawArrow(ctx, cx, cy, fsPixX, fsPixY, C.blue, 2.5, 9);
      Theme.drawArrow(ctx, fsPixX, fsPixY, ftPixX, ftPixY, C.teal, 2.5, 9);
      Theme.drawArrow(ctx, cx, cy, ftPixX, ftPixY, C.copper, 3.0, 10);

      // Reference drive F_0 = 1 along +Re
      ctx.save();
      ctx.strokeStyle = C.ref;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(toX(1), cy);
      ctx.stroke();
      ctx.restore();
      Theme.drawMath(
        ctx,
        [{ t: 'F', i: true }, { t: '0', sub: true }, { t: ' = 1' }],
        toX(1),
        cy + 12,
        { size: 10.5, color: C.ref, align: 'center', family: '"IBM Plex Mono", monospace' }
      );

      // Midpoint vector labels strictly OUTSIDE the right triangle O -> Fs -> Ft -> O!
      // Because Fd = +i (2*zeta*r) Fs is always +90 deg CCW from Fs in math coords,
      // the outward normal of directed edge (dx, dy) in canvas coords is (-dy/L, +dx/L)
      // for O->Fs and Fs->Ft, and (+dy/L, -dx/L) for the hypotenuse O->Ft!
      if (e1L > 14) {
        const mx = 0.5 * (cx + fsPixX);
        const my = 0.5 * (cy + fsPixY);
        const off = 16;
        Theme.drawMath(
          ctx,
          [{ t: 'kX', i: true, bold: true }],
          mx + (-e1y / e1L) * off,
          my + (e1x / e1L) * off,
          { size: 12, color: C.blue, align: 'center' }
        );
      }

      if (e2L > 14) {
        const mx = 0.5 * (fsPixX + ftPixX);
        const my = 0.5 * (fsPixY + ftPixY);
        const off = 22;
        Theme.drawMath(
          ctx,
          [{ t: 'i', bold: true }, { t: ' cωX', i: true, bold: true }],
          mx + (-e2y / e2L) * off,
          my + (e2x / e2L) * off,
          { size: 11.5, color: C.teal, align: 'center' }
        );
      }

      if (e3L > 14) {
        const mx = 0.5 * (cx + ftPixX);
        const my = 0.5 * (cy + ftPixY);
        const off = 16;
        Theme.drawMath(
          ctx,
          [{ t: 'F', i: true, bold: true }, { t: 'T', sub: true, bold: true }],
          mx + (e3y / e3L) * off,
          my + (-e3x / e3L) * off,
          { size: 12, color: C.copper, align: 'center' }
        );
      }

      // Header & footer cleanly typeset
      ctx.fillStyle = res.T < 1 ? C.teal : C.crimson;
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(
        res.T < 1
          ? 'Inside unit circle (T < 1): isolation = ' + M.fmt(res.isolationPct, 1) + '% reduction'
          : 'Outside unit circle (T ≥ 1): transmitted force amplified',
        12,
        10
      );

      Theme.drawMath(
        ctx,
        [
          { t: '|' },
          { t: 'kX', i: true },
          { t: '|/' },
          { t: 'F', i: true },
          { t: '0', sub: true },
          { t: ' = ' + M.fmt(M.cAbs(Fs), 2) + '   |' },
          { t: 'cωX', i: true },
          { t: '|/' },
          { t: 'F', i: true },
          { t: '0', sub: true },
          { t: ' = ' + M.fmt(M.cAbs(Fd), 2) + '   ' },
          { t: 'T', i: true },
          { t: ' = |' },
          { t: 'F', i: true },
          { t: 'T', sub: true },
          { t: '|/' },
          { t: 'F', i: true },
          { t: '0', sub: true },
          { t: ' = ' + M.fmt(res.T, 3) }
        ],
        12,
        h - 12,
        { size: 10.5, color: C.textMuted, align: 'left', family: '"IBM Plex Mono", monospace' }
      );
    }

    function render() {
      drawTransCanvas();
      drawPhasorCanvas();
    }

    if (transCanvas) {
      function updateFromPointer(e) {
        const rect = transCanvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const frac = Math.max(0.03, Math.min(0.99, (px - view.padL) / view.plotW));
        setParams({ r: frac * view.rMax });
      }
      transCanvas.addEventListener('pointerdown', (e) => {
        state.dragging = true;
        transCanvas.setPointerCapture(e.pointerId);
        updateFromPointer(e);
      });
      transCanvas.addEventListener('pointermove', (e) => {
        if (!state.dragging) return;
        updateFromPointer(e);
      });
      transCanvas.addEventListener('pointerup', () => { state.dragging = false; });
      transCanvas.addEventListener('pointercancel', () => { state.dragging = false; });
    }

    return {
      setParams,
      getState: () => Object.assign({}, state),
      render
    };
  }

  window.VibLab.VizIsolation = { create: createIsolationViz };
})();
