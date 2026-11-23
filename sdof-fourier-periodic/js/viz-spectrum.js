/**
 * viz-spectrum.js
 * Section 2 & 3 visualizations for Module 10 (sdof-fourier-periodic):
 * - Section 2 left canvas: Input harmonic spectrum c_n overlaid with SDOF FRF envelope |H(i r)|.
 * - Section 2 right canvas: Filtered output harmonic spectrum c_n |H(i n r_0)| highlighting dominant harmonic.
 * - Section 3 full-width canvas: Total RMS output X_rms(r_0) vs. fundamental ratio r_0 showing
 *   the forest of subharmonic resonance peaks at r_0 = 1/5, 1/4, 1/3, 1/2, 1!
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathFourier;
  const Theme = window.VibLab.Theme;

  function createSpectrumViz(opts) {
    const inCanvas = document.getElementById(opts.inCanvasId);
    const outCanvas = document.getElementById(opts.outCanvasId);
    const sweepCanvas = document.getElementById(opts.sweepCanvasId);
    let sys = opts.sys;

    function setSystem(newSys) { sys = newSys; render(); }

    function drawInputFRF() {
      if (!inCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(inCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 48, padR = 18, padT = 28, padB = 38;
      const plotW = w - padL - padR, plotH = h - padT - padB;
      const rMax = Math.max(2.6, Math.min(6.0, sys.r0 * Math.min(sys.N, 7) + 0.5));
      const frfPeak = Math.min(10, 1 / (2 * sys.zeta));
      const yMax = Math.max(1.5, frfPeak * 0.25 + 1.1);
      const toX = (r) => padL + (r / rMax) * plotW;
      const toY = (v) => padT + plotH - (Math.min(yMax * 1.05, v) / yMax) * plotH;

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      // Resonance vertical marker r = 1
      ctx.save();
      ctx.strokeStyle = C.copper;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(toX(1), padT);
      ctx.lineTo(toX(1), padT + plotH);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      // SDOF FRF envelope (scaled visually so peak sits at 85% of plot height)
      const frfScale = (yMax * 0.85) / Math.max(1.2, 1 / (2 * sys.zeta));
      ctx.fillStyle = C.dark ? 'rgba(38,181,166,0.14)' : 'rgba(0,137,123,0.10)';
      ctx.strokeStyle = C.teal;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(toX(0), padT + plotH);
      const Npts = 260;
      for (let i = 0; i <= Npts; i++) {
        const r = (rMax * i) / Npts;
        const val = M.evalFRF(r, sys.zeta).mag * frfScale;
        ctx.lineTo(toX(r), toY(val));
      }
      ctx.lineTo(toX(rMax), padT + plotH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Input harmonic stems at r_n = n r_0
      if (sys.a0Half > 1e-4) {
        const px = toX(0);
        ctx.strokeStyle = C.teal;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px + 2, padT + plotH);
        ctx.lineTo(px + 2, toY(sys.a0Half));
        ctx.stroke();
      }

      sys.harmonics.forEach((hm) => {
        if (hm.c < 1e-4 || hm.rn > rMax) return;
        const px = toX(hm.rn);
        const py = toY(hm.c);
        const nearRes = Math.abs(hm.rn - 1) < 0.14;
        const col = nearRes ? C.crimson : C.blue;
        ctx.strokeStyle = col;
        ctx.lineWidth = nearRes ? 3.2 : 2.3;
        ctx.beginPath();
        ctx.moveTo(px, padT + plotH);
        ctx.lineTo(px, py);
        ctx.stroke();

        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(px, py, nearRes ? 4.8 : 3.8, 0, 2 * Math.PI);
        ctx.fill();

        if (hm.n <= 7 || nearRes) {
          Theme.drawMath(ctx, [{ t: 'n=' + hm.n, bold: nearRes }], px, Math.max(padT + 12, py - 11), {
            size: 9.5, color: col, align: 'center'
          });
        }
      });

      Theme.drawMath(ctx, [{ t: 'FRF |', bold: true }, { t: 'H', i: true, bold: true }, { t: '| peak at ', bold: true }, { t: 'r', i: true, bold: true }, { t: ' = 1', bold: true }], toX(1) + 6, padT + 14, {
        size: 10, color: C.teal, align: 'left'
      });

      ctx.restore();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      // Ticks
      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const stepR = rMax > 4 ? 1.0 : 0.5;
      for (let r = 0; r <= rMax + 1e-6; r += stepR) ctx.fillText(M.fmt(r, 1), toX(r), padT + plotH + 5);

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      [0, 0.5, 1.0, 1.5].forEach((yv) => {
        if (yv > yMax) return;
        ctx.fillText(M.fmt(yv, 1), padL - 6, toY(yv));
      });

      Theme.drawMath(ctx, [{ t: 'Harmonic frequency ratio ', bold: true }, { t: 'r', i: true, bold: true }, { t: 'n', sub: true, bold: true }, { t: ' = ', bold: true }, { t: 'n r', i: true, bold: true }, { t: '0', sub: true, bold: true }], padL + plotW * 0.5, h - 10, {
        size: 10.5, color: C.text, align: 'center'
      });
      Theme.drawMath(ctx, [{ t: 'Input lines ', bold: true }, { t: 'c', i: true, bold: true }, { t: 'n', sub: true, bold: true }, { t: ' overlaid with SDOF filter |', bold: true }, { t: 'H', i: true, bold: true }, { t: '(i', bold: true }, { t: 'r', i: true, bold: true }, { t: ')|', bold: true }], padL, 14, {
        size: 10.5, color: C.text, align: 'left'
      });
    }

    function drawOutputSpectrum() {
      if (!outCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(outCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 48, padR = 18, padT = 28, padB = 38;
      const plotW = w - padL - padR, plotH = h - padT - padB;
      const nCount = sys.N;
      const maxBar = Math.max(0.8, sys.a0Half, ...sys.harmonics.map((hm) => hm.outAmp)) * 1.18;
      const toX = (n) => padL + ((n + 0.5) / (nCount + 1)) * plotW;
      const toY = (v) => padT + plotH - (v / maxBar) * plotH;

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      // Horizontal grid
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      const ticks = 4;
      for (let i = 0; i <= ticks; i++) {
        const yv = (maxBar * i) / ticks;
        const py = toY(yv);
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();
        ctx.fillStyle = C.textMuted;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(M.fmt(yv, 1), padL - 6, py);
      }

      const barW = Math.max(8, Math.min(26, (plotW / (nCount + 1)) * 0.58));

      // DC bar (n=0)
      if (sys.a0Half > 1e-4) {
        const bx = toX(0) - barW * 0.5;
        const by = toY(sys.a0Half);
        ctx.fillStyle = C.teal;
        ctx.fillRect(bx, by, barW, padT + plotH - by);
      }

      sys.harmonics.forEach((hm) => {
        const bx = toX(hm.n) - barW * 0.5;
        const by = toY(hm.outAmp);
        const isDom = hm.n === sys.domN;
        ctx.fillStyle = isDom ? C.crimson : C.blue;
        ctx.globalAlpha = isDom ? 0.95 : 0.72;
        ctx.fillRect(bx, by, barW, Math.max(0, padT + plotH - by));
        ctx.globalAlpha = 1;

        if (isDom && hm.outAmp > 0.05) {
          Theme.drawMath(ctx, [{ t: M.fmt(hm.outAmp, 2), bold: true }], toX(hm.n), Math.max(padT + 12, by - 10), {
            size: 10, color: C.crimson, align: 'center', family: '"IBM Plex Mono", monospace'
          });
        }
      });

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('DC', toX(0), padT + plotH + 5);
      for (let n = 1; n <= nCount; n++) {
        if (nCount <= 11 || n % 2 === 1) ctx.fillText(String(n), toX(n), padT + plotH + 5);
      }

      Theme.drawMath(ctx, [{ t: 'Harmonic index ', bold: true }, { t: 'n', i: true, bold: true }], padL + plotW * 0.5, h - 10, {
        size: 10.5, color: C.text, align: 'center'
      });
      Theme.drawMath(ctx, [{ t: 'Filtered output amplitudes ', bold: true }, { t: 'c', i: true, bold: true }, { t: 'n', sub: true, bold: true }, { t: '|', bold: true }, { t: 'H', i: true, bold: true }, { t: '(i', bold: true }, { t: 'nr', i: true, bold: true }, { t: '0', sub: true, bold: true }, { t: ')|', bold: true }], padL, 14, {
        size: 10.5, color: C.text, align: 'left'
      });
    }

    function drawSubharmonicSweep() {
      if (!sweepCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(sweepCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 54, padR = 22, padT = 30, padB = 38;
      const plotW = w - padL - padR, plotH = h - padT - padB;
      const rMin = 0.14, rMax = 1.80;
      const Npts = 400;

      const pts = [];
      let yPeak = 1.2;
      for (let i = 0; i <= Npts; i++) {
        const r = rMin + ((rMax - rMin) * i) / Npts;
        const ev = M.evalPeriodicSystem(sys.waveKey, r, sys.zeta, sys.N);
        pts.push({ r, y: ev.xRms });
        if (ev.xRms > yPeak) yPeak = ev.xRms;
      }
      const yMax = Math.max(1.5, Math.min(yPeak * 1.15, 16));
      const toX = (r) => padL + ((r - rMin) / (rMax - rMin)) * plotW;
      const toY = (v) => padT + plotH - (Math.min(yMax * 1.04, v) / yMax) * plotH;

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      // Subharmonic resonance vertical guides at r_0 = 1/5, 1/4, 1/3, 1/2, 1
      [
        { n: 5, lbl: '1/5' },
        { n: 4, lbl: '1/4' },
        { n: 3, lbl: '1/3' },
        { n: 2, lbl: '1/2' },
        { n: 1, lbl: '1' }
      ].forEach((mk) => {
        const rVal = 1 / mk.n;
        if (rVal < rMin || rVal > rMax) return;
        const activeHarm = sys.harmonics.find((h) => h.n === mk.n);
        const hasHarm = activeHarm && activeHarm.c > 1e-4;
        const px = toX(rVal);
        ctx.save();
        ctx.strokeStyle = hasHarm ? C.teal : C.grid;
        ctx.setLineDash(hasHarm ? [4, 3] : [2, 3]);
        ctx.lineWidth = hasHarm ? 1.3 : 1.0;
        ctx.beginPath();
        ctx.moveTo(px, padT);
        ctx.lineTo(px, padT + plotH);
        ctx.stroke();
        ctx.restore();

        Theme.drawMath(ctx, [{ t: mk.lbl, bold: hasHarm }], px, padT + 12, {
          size: 10, color: hasHarm ? C.teal : C.textMuted, align: 'center', family: '"IBM Plex Mono", monospace'
        });
      });

      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      // Fill & curve of X_rms(r_0)
      ctx.fillStyle = C.dark ? 'rgba(77,190,238,0.14)' : 'rgba(0,114,189,0.10)';
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(toX(pts[0].r), padT + plotH);
      pts.forEach((p) => ctx.lineTo(toX(p.r), toY(p.y)));
      ctx.lineTo(toX(pts[pts.length - 1].r), padT + plotH);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      pts.forEach((p, idx) => {
        const px = toX(p.r), py = toY(p.y);
        if (idx === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.stroke();

      // Active r_0 cursor + dot
      if (sys.r0 >= rMin && sys.r0 <= rMax) {
        const curX = toX(sys.r0);
        const curY = toY(sys.xRms);
        ctx.strokeStyle = C.copper;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(curX, padT);
        ctx.lineTo(curX, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = C.crimson;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(curX, curY, 5.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      // Y ticks
      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let i = 0; i <= 4; i++) {
        const yv = (yMax * i) / 4;
        ctx.fillText(M.fmt(yv, 1), padL - 6, toY(yv));
      }

      // X ticks
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8].forEach((r) => {
        ctx.fillText(M.fmt(r, 1), toX(r), padT + plotH + 5);
      });

      Theme.drawMath(ctx, [{ t: 'Fundamental drive ratio ', bold: true }, { t: 'r', i: true, bold: true }, { t: '0', sub: true, bold: true }, { t: ' = ω', bold: true }, { t: '0', sub: true, bold: true }, { t: ' / ω', bold: true }, { t: 'n', sub: true, bold: true }], padL + plotW * 0.5, h - 10, {
        size: 11, color: C.text, align: 'center'
      });
      Theme.drawMath(ctx, [{ t: 'Total steady-state RMS response ', bold: true }, { t: 'X', i: true, bold: true }, { t: 'rms', sub: true, bold: true }, { t: '(', bold: true }, { t: 'r', i: true, bold: true }, { t: '0', sub: true, bold: true }, { t: ') — teal guides mark active subharmonic peaks 1/', bold: true }, { t: 'n', i: true, bold: true }], padL, 14, {
        size: 11, color: C.text, align: 'left'
      });
    }

    function render() {
      drawInputFRF();
      drawOutputSpectrum();
      drawSubharmonicSweep();
    }

    return { setSystem, render };
  }

  window.VibLab.VizSpectrum = { create: createSpectrumViz };
})();
