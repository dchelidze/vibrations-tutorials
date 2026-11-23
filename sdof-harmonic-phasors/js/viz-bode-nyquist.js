/**
 * viz-bode-nyquist.js
 * Section 2 visualization for Module 03 (sdof-harmonic-phasors):
 * - Left canvas: Interactive Bode magnitude M(r, zeta) and phase lag phi(r, zeta)
 *                across a damping family with draggable frequency ratio r cursor.
 * - Right canvas: Complex receptance Nyquist locus k H(i w) = 1 / ((1 - r^2) + i 2 zeta r),
 *                 highlighting the exact imaginary-axis crossing at r = 1 (phase resonance)
 *                 versus the maximum radius point at r_peak = sqrt(1 - 2 zeta^2)!
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathHarmonic;
  const Theme = window.VibLab.Theme;

  function createBodeNyquistViz(opts) {
    const bodeCanvas = document.getElementById(opts.bodeCanvasId);
    const nyqCanvas = document.getElementById(opts.nyqCanvasId);
    let sys = opts.sys;
    let dragging = false;
    const bodeView = { padL: 54, plotW: 320, rMax: 3.0 };

    function setSystem(newSys) {
      sys = newSys;
      render();
    }

    function drawBode() {
      if (!bodeCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(bodeCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 52;
      const padR = 16;
      const padT = 24;
      const padB = 36;
      const gap = 24;
      const plotW = w - padL - padR;
      const magH = (h - padT - padB - gap) * 0.56;
      const phH = (h - padT - padB - gap) * 0.44;
      const phTop = padT + magH + gap;
      const rMax = 3.0;
      bodeView.padL = padL;
      bodeView.plotW = plotW;

      const yMax = Math.max(5.5, Math.min(14, Math.ceil(Math.min(14, sys.MPeak) * 1.25)));
      const toX = (r) => padL + (r / rMax) * plotW;
      const toYMag = (m) => padT + magH - (Math.min(yMax * 1.15, m) / yMax) * magH;
      const toYPh = (deg) => phTop + phH - (deg / 180) * phH;

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, magH);
      ctx.fillRect(padL, phTop, plotW, phH);

      // Grid lines
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      const yStep = yMax > 9 ? 2 : 1;
      for (let y = 0; y <= yMax; y += yStep) {
        const py = toYMag(y);
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

      [0, 45, 90, 135, 180].forEach((deg) => {
        const py = toYPh(deg);
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();
        ctx.fillStyle = C.textMuted;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(deg + '°', padL - 6, py);
      });

      // Reference vertical r = 1 (phase resonance!)
      const x1 = toX(1.0);
      ctx.save();
      ctx.strokeStyle = C.teal;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(x1, padT);
      ctx.lineTo(x1, padT + magH);
      ctx.moveTo(x1, phTop);
      ctx.lineTo(x1, phTop + phH);
      ctx.stroke();
      ctx.restore();

      // Family of curves
      const N = 300;
      function plotPair(z, color, width, dash, alpha) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(padL, padT, plotW, magH);
        ctx.clip();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.globalAlpha = alpha;
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath();
        let down = false;
        for (let i = 0; i <= N; i++) {
          const r = (rMax * i) / N;
          const ev = M.evalHarmonic(r, z);
          if (!Number.isFinite(ev.M) || ev.M > yMax * 1.12) {
            down = false;
            continue;
          }
          const px = toX(r);
          const py = toYMag(ev.M);
          if (!down) { ctx.moveTo(px, py); down = true; }
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.globalAlpha = alpha;
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const r = (rMax * i) / N;
          const ev = M.evalHarmonic(r, z);
          const px = toX(r);
          const py = toYPh(ev.phiDeg);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }

      plotPair(0.08, C.ref, 1.2, [4, 3], 0.55);
      plotPair(0.30, C.ref, 1.2, null, 0.45);
      plotPair(0.707, C.ref, 1.2, [6, 3], 0.55);
      plotPair(sys.zeta, C.blue, 2.6, null, 1.0);

      // Phase-resonance pivot dot (r=1, phi=90 deg)
      ctx.fillStyle = C.teal;
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x1, toYPh(90), 5.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Active cursor
      const curX = toX(sys.r);
      ctx.save();
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(curX, padT);
      ctx.lineTo(curX, padT + magH);
      ctx.moveTo(curX, phTop);
      ctx.lineTo(curX, phTop + phH);
      ctx.stroke();
      ctx.restore();

      if (sys.M <= yMax) {
        ctx.fillStyle = C.copper;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(curX, toYMag(sys.M), 5.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = C.copper;
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(curX, toYPh(sys.phiDeg), 5.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Borders
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, magH);
      ctx.strokeRect(padL, phTop, plotW, phH);

      Theme.drawMath(ctx, [{ t: 'Magnification ', bold: true }, { t: 'M', i: true, bold: true }, { t: '(r, ζ) = |', bold: true }, { t: 'X', i: true, bold: true }, { t: '|/', bold: true }, { t: 'X', i: true, bold: true }, { t: 'st', sub: true, bold: true }], padL, padT - 11, {
        size: 11,
        color: C.text,
        align: 'left'
      });
      Theme.drawMath(ctx, [{ t: 'Phase lag φ(r, ζ)  — all curves cross (1, 90°)', bold: true }], padL, phTop - 11, {
        size: 11,
        color: C.text,
        align: 'left'
      });

      // X ticks
      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let r = 0; r <= rMax + 1e-6; r += 0.5) {
        ctx.fillText(M.fmt(r, 1), toX(r), phTop + phH + 5);
      }
      Theme.drawMath(ctx, [{ t: 'Frequency ratio ', bold: true }, { t: 'r', i: true, bold: true }, { t: ' = ω / ω', bold: true }, { t: 'n', sub: true, bold: true }, { t: ' (drag)', bold: true }], padL + plotW * 0.5, h - 10, {
        size: 11,
        color: C.text,
        align: 'center'
      });
    }

    function drawNyquist() {
      if (!nyqCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(nyqCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      // Compute full Nyquist locus k H(i r) in lower half-plane (Im <= 0)
      const N = 360;
      const pts = [];
      let minRe = -0.5, maxRe = 1.2, minIm = -1.2, maxIm = 0.25;
      for (let i = 0; i <= N; i++) {
        const r = (4.5 * i) / N;
        const ev = M.evalHarmonic(r, sys.zeta);
        if (!Number.isFinite(ev.H.re) || !Number.isFinite(ev.H.im)) continue;
        pts.push(ev.H);
        if (ev.H.re < minRe) minRe = ev.H.re;
        if (ev.H.re > maxRe) maxRe = ev.H.re;
        if (ev.H.im < minIm) minIm = ev.H.im;
      }

      const spanRe = (maxRe - minRe) * 1.26;
      const spanIm = (maxIm - minIm) * 1.26;
      const pad = 38;
      const scale = Math.min((w - 2 * pad) / spanRe, (h - 2 * pad - 24) / spanIm);
      const midRe = 0.5 * (minRe + maxRe);
      const midIm = 0.5 * (minIm + maxIm);
      const cx = w * 0.5 - midRe * scale;
      const cy = h * 0.52 + midIm * scale;
      const toX = (re) => cx + re * scale;
      const toY = (im) => cy - im * scale;

      // Axes
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(14, cy);
      ctx.lineTo(w - 14, cy);
      ctx.moveTo(cx, 28);
      ctx.lineTo(cx, h - 22);
      ctx.stroke();

      // Locus curve
      ctx.save();
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      pts.forEach((p, idx) => {
        const px = toX(p.re);
        const py = toY(p.im);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.restore();

      // Phase-resonance crossing (r = 1: Re = 0, Im = -1/(2 zeta)) — label on LEFT of Im axis
      const hRes = M.evalHarmonic(1.0, sys.zeta).H;
      ctx.fillStyle = C.teal;
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(toX(hRes.re), toY(hRes.im), 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      Theme.drawMath(ctx, [{ t: 'r', i: true, bold: true }, { t: ' = 1 (φ = 90°)', bold: true }], toX(hRes.re) - 10, toY(hRes.im) + 6, {
        size: 11,
        color: C.teal,
        align: 'right'
      });

      // Amplitude peak dot (r_peak = sqrt(1 - 2 zeta^2), always Re > 0) — label on RIGHT
      if (sys.hasPeak && Math.abs(sys.rPeak - 1.0) > 0.015) {
        const hPk = M.evalHarmonic(sys.rPeak, sys.zeta).H;
        ctx.fillStyle = C.crimson;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(toX(hPk.re), toY(hPk.im), 5.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        Theme.drawMath(
          ctx,
          [{ t: 'r', i: true, bold: true }, { t: 'peak', sub: true, bold: true }, { t: ' = ' + M.fmt(sys.rPeak, 2), bold: true }],
          toX(hPk.re) + 10,
          toY(hPk.im) + 2,
          { size: 10.5, color: C.crimson, align: 'left' }
        );
      }

      // Active vector k H(i r)
      Theme.drawArrow(ctx, cx, cy, toX(sys.H.re), toY(sys.H.im), C.copper, 2.8, 10);
      ctx.fillStyle = C.copper;
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(toX(sys.H.re), toY(sys.H.im), 5.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Axis labels & header
      Theme.drawMath(ctx, [{ t: 'Re(', bold: true }, { t: 'kH', i: true, bold: true }, { t: ')', bold: true }], w - 16, cy - 10, {
        size: 11,
        color: C.textMuted,
        align: 'right'
      });
      Theme.drawMath(ctx, [{ t: 'Im(', bold: true }, { t: 'kH', i: true, bold: true }, { t: ')', bold: true }], cx + 8, 36, {
        size: 11,
        color: C.textMuted,
        align: 'left'
      });

      Theme.drawMath(
        ctx,
        [
          { t: 'Nyquist locus ', bold: true },
          { t: 'kH', i: true, bold: true },
          { t: '(iω) — length = ', bold: true },
          { t: 'M', i: true, bold: true },
          { t: '(r), angle = −φ(r)', bold: true }
        ],
        12,
        15,
        { size: 11.5, color: C.text, align: 'left' }
      );
    }

    function render() {
      drawBode();
      drawNyquist();
    }

    if (bodeCanvas) {
      function updateFromPointer(e) {
        const rect = bodeCanvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const frac = Math.max(0.02, Math.min(0.99, (px - bodeView.padL) / bodeView.plotW));
        if (opts.onRChange) opts.onRChange(frac * bodeView.rMax);
      }
      bodeCanvas.addEventListener('pointerdown', (e) => {
        dragging = true;
        bodeCanvas.setPointerCapture(e.pointerId);
        updateFromPointer(e);
      });
      bodeCanvas.addEventListener('pointermove', (e) => { if (dragging) updateFromPointer(e); });
      bodeCanvas.addEventListener('pointerup', () => { dragging = false; });
      bodeCanvas.addEventListener('pointercancel', () => { dragging = false; });
    }

    return { setSystem, render };
  }

  window.VibLab.VizBodeNyquist = { create: createBodeNyquistViz };
})();
