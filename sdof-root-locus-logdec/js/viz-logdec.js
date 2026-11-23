/**
 * viz-logdec.js
 * Section 2 & 3 visualizations for Module 11 (sdof-root-locus-logdec):
 * - Section 2 left canvas: Underdamped ring-down with numbered peaks x_0, x_1, ..., x_k (with optional noise).
 * - Section 2 right canvas: Semilog linear regression ln(x_k) vs. cycle k comparing exact slope -delta,
 *                           OLS fitted line, and single-cycle (k=0 -> k=1) secant.
 * - Section 3 left canvas: Exact delta(zeta) vs. small-damping 2*pi*zeta (highlighting 5% divergence).
 * - Section 3 right canvas: Dimensionless 2% settling time w_n t_s(zeta) across zeta in [0.05, 2.0].
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathRootLocus;
  const Theme = window.VibLab.Theme;

  function createLogDecViz(opts) {
    const peaksCanvas = document.getElementById(opts.peaksCanvasId);
    const regCanvas = document.getElementById(opts.regCanvasId);
    const approxCanvas = document.getElementById(opts.approxCanvasId);
    const settleCanvas = document.getElementById(opts.settleCanvasId);
    let sys = opts.sys;

    // Precompute settling time curve once (dimensionless w_n * t_s depends ONLY on zeta!)
    const settlePts = [];
    for (let i = 0; i <= 110; i++) {
      const z = 0.08 + (1.92 * i) / 110;
      settlePts.push({ z, wnTs: M.computeSettlingTime(z, 1.0, 0.02) });
    }

    function setSystem(newSys) { sys = newSys; render(); }

    function drawPeaks() {
      if (!peaksCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(peaksCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 46, padR = 16, padT = 28, padB = 34;
      const plotW = w - padL - padR, plotH = h - padT - padB;
      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      const ld = sys.logdec;
      if (!ld.valid) {
        ctx.strokeStyle = C.gridStrong;
        ctx.strokeRect(padL, padT, plotW, plotH);
        Theme.drawMath(ctx, [{ t: 'Logarithmic decrement requires underdamped oscillation (0 < ζ < 1)', bold: true }], padL + plotW * 0.5, padT + plotH * 0.5, {
          size: 11.5, color: C.textMuted, align: 'center'
        });
        return;
      }

      const lastT = Math.max(ld.peaks[ld.peaks.length - 1].t * 1.12, 3 * sys.roots.Td);
      const toX = (t) => padL + (t / lastT) * plotW;
      const midY = padT + plotH * 0.52;
      const toY = (v) => midY - (v / 1.18) * (plotH * 0.44);

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, midY);
      ctx.lineTo(padL + plotW, midY);
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      // Exact clean ring-down
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      const N = 320;
      for (let i = 0; i <= N; i++) {
        const t = (lastT * i) / N;
        const px = toX(t), py = toY(M.evalFreeResponse(t, sys.zeta, sys.wn, 1, 0));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Upper decay envelope exp(-zeta w_n t)
      ctx.save();
      ctx.strokeStyle = C.copper;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const t = (lastT * i) / N;
        const px = toX(t), py = toY(Math.exp(-sys.zeta * sys.wn * t));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // Measured peak dots (crimson) + cycle labels
      ld.peaks.forEach((p) => {
        const px = toX(p.t), py = toY(p.xMeas);
        ctx.fillStyle = C.crimson;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(px, py, 4.8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        Theme.drawMath(ctx, [{ t: 'x', i: true, bold: true }, { t: String(p.k), sub: true, bold: true }], p.k === 0 ? px + 8 : px, Math.max(padT + 11, py - 12), {
          size: 10, color: C.crimson, align: p.k === 0 ? 'left' : 'center'
        });
      });

      ctx.restore();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      [-1, 0, 1].forEach((yv) => ctx.fillText(String(yv), padL - 6, toY(yv)));

      Theme.drawMath(ctx, [{ t: 'Time ', bold: true }, { t: 't', i: true, bold: true }, { t: ' (peak spacing = ', bold: true }, { t: 'T', i: true, bold: true }, { t: 'd', sub: true, bold: true }, { t: ' = ' + M.fmt(sys.roots.Td, 2) + ' s)', bold: true }], padL + plotW * 0.5, h - 10, {
        size: 10.5, color: C.text, align: 'center'
      });
      Theme.drawMath(ctx, [{ t: 'Sampled ring-down peaks ', bold: true }, { t: 'x', i: true, bold: true }, { t: 'k', sub: true, bold: true }, { t: ' (noise σ = ' + M.fmt(sys.noiseAmp * 100, 0) + '%)', bold: true }], padL, 14, {
        size: 10.5, color: C.text, align: 'left'
      });
    }

    function drawRegression() {
      if (!regCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(regCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 50, padR = 18, padT = 28, padB = 34;
      const plotW = w - padL - padR, plotH = h - padT - padB;
      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      const ld = sys.logdec;
      if (!ld.valid) {
        ctx.strokeStyle = C.gridStrong;
        ctx.strokeRect(padL, padT, plotW, plotH);
        Theme.drawMath(ctx, [{ t: 'No oscillatory peaks when ζ ≥ 1', bold: true }], padL + plotW * 0.5, padT + plotH * 0.5, {
          size: 11.5, color: C.textMuted, align: 'center'
        });
        return;
      }

      const kMax = Math.max(2, ld.peaks[ld.peaks.length - 1].k);
      const yMin = Math.min(-0.5, ...ld.peaks.map((p) => Math.min(p.lnExact, p.lnMeas))) * 1.15;
      const yMax = 0.25;
      const toX = (k) => padL + (k / kMax) * plotW;
      const toY = (v) => padT + ((yMax - v) / (yMax - yMin)) * plotH;

      // Horizontal grid
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const yv = yMin + ((yMax - yMin) * i) / 4;
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

      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      // Exact theoretical line y = -deltaExact * k (dashed blue)
      ctx.save();
      ctx.strokeStyle = C.blue;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(0));
      ctx.lineTo(toX(kMax), toY(-ld.deltaExact * kMax));
      ctx.stroke();
      ctx.restore();

      // Single-cycle secant through k=0, k=1 (thin amber dashed if noise > 0)
      if (sys.noiseAmp > 0.001) {
        ctx.save();
        ctx.strokeStyle = C.amber;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(toX(0), toY(ld.peaks[0].lnMeas));
        ctx.lineTo(toX(kMax), toY(ld.peaks[0].lnMeas - ld.delta1 * kMax));
        ctx.stroke();
        ctx.restore();
      }

      // Multi-cycle OLS regression line (solid teal)
      ctx.strokeStyle = C.teal;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(ld.intercept));
      ctx.lineTo(toX(kMax), toY(ld.intercept - ld.deltaOLS * kMax));
      ctx.stroke();

      // Measured points
      ld.peaks.forEach((p) => {
        ctx.fillStyle = C.crimson;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(toX(p.k), toY(p.lnMeas), 5.0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      });

      Theme.drawMath(ctx, [{ t: 'OLS slope = −δ', bold: true }, { t: 'fit', sub: true, bold: true }, { t: ' = −' + M.fmt(ld.deltaOLS, 3), bold: true }], padL + plotW - 10, padT + 16, {
        size: 10.5, color: C.teal, align: 'right', family: '"IBM Plex Mono", monospace'
      });
      if (sys.noiseAmp > 0.001) {
        Theme.drawMath(ctx, [{ t: 'Single-pair −δ', bold: true }, { t: '1', sub: true, bold: true }, { t: ' = −' + M.fmt(ld.delta1, 3), bold: true }], padL + plotW - 10, padT + 34, {
          size: 10, color: C.amber, align: 'right', family: '"IBM Plex Mono", monospace'
        });
      }

      ctx.restore();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let k = 0; k <= kMax; k++) ctx.fillText(String(k), toX(k), padT + plotH + 5);

      Theme.drawMath(ctx, [{ t: 'Cycle index ', bold: true }, { t: 'k', i: true, bold: true }], padL + plotW * 0.5, h - 10, {
        size: 10.5, color: C.text, align: 'center'
      });
      Theme.drawMath(ctx, [{ t: 'Semilog regression ln(', bold: true }, { t: 'x', i: true, bold: true }, { t: 'k', sub: true, bold: true }, { t: ' / ', bold: true }, { t: 'x', i: true, bold: true }, { t: '0', sub: true, bold: true }, { t: ') vs. ', bold: true }, { t: 'k', i: true, bold: true }], padL, 14, {
        size: 10.5, color: C.text, align: 'left'
      });
    }

    function drawApprox() {
      if (!approxCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(approxCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 48, padR = 18, padT = 28, padB = 36;
      const plotW = w - padL - padR, plotH = h - padT - padB;
      const zMax = 0.85, yMax = 10.0;
      const toX = (z) => padL + (z / zMax) * plotW;
      const toY = (d) => padT + plotH - (Math.min(yMax * 1.05, d) / yMax) * plotH;

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      // 5% error zone highlight: 1/sqrt(1-z^2) > 1.05 => z > 0.305
      const z5 = Math.sqrt(1 - 1 / (1.05 * 1.05));
      ctx.fillStyle = C.dark ? 'rgba(38,181,166,0.12)' : 'rgba(0,137,123,0.09)';
      ctx.fillRect(padL, padT, toX(z5) - padL, plotH);

      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      [0, 2, 4, 6, 8, 10].forEach((yv) => {
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
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      // Linear small-damping approximation delta = 2 pi zeta
      ctx.save();
      ctx.strokeStyle = C.orange;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(0));
      ctx.lineTo(toX(zMax), toY(2 * Math.PI * zMax));
      ctx.stroke();
      ctx.restore();

      // Exact delta = 2 pi zeta / sqrt(1 - zeta^2)
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const z = (zMax * i) / 200;
        const d = (2 * Math.PI * z) / Math.sqrt(1 - z * z);
        const px = toX(z), py = toY(d);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      Theme.drawMath(ctx, [{ t: '<5% error (ζ ≤ 0.30)', bold: true }], padL + 6, padT + 14, {
        size: 9.8, color: C.teal, align: 'left'
      });

      if (sys.zeta < zMax && sys.roots.regime === 'underdamped') {
        const cx = toX(sys.zeta);
        const cy = toY(sys.roots.delta);
        ctx.fillStyle = C.crimson;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 5.2, 0, 2 * Math.PI);
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
      [0, 0.2, 0.4, 0.6, 0.8].forEach((zv) => ctx.fillText(M.fmt(zv, 1), toX(zv), padT + plotH + 5));

      Theme.drawMath(ctx, [{ t: 'True damping ratio ζ', bold: true }], padL + plotW * 0.5, h - 10, {
        size: 10.5, color: C.text, align: 'center'
      });
      Theme.drawMath(ctx, [{ t: 'Exact δ(ζ) (blue) vs. small-damping 2πζ (dashed orange)', bold: true }], padL, 14, {
        size: 10.5, color: C.text, align: 'left'
      });
    }

    function drawSettling() {
      if (!settleCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(settleCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 48, padR = 18, padT = 28, padB = 36;
      const plotW = w - padL - padR, plotH = h - padT - padB;
      const zMax = 2.0, yMax = 22.0;
      const toX = (z) => padL + (z / zMax) * plotW;
      const toY = (v) => padT + plotH - (Math.min(yMax * 1.05, v) / yMax) * plotH;

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      [0, 5, 10, 15, 20].forEach((yv) => {
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

      // Vertical critical guide zeta = 1
      ctx.save();
      ctx.strokeStyle = C.teal;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(toX(1.0), padT);
      ctx.lineTo(toX(1.0), padT + plotH);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      ctx.strokeStyle = C.teal;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      settlePts.forEach((p, idx) => {
        const px = toX(p.z), py = toY(p.wnTs);
        if (idx === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.stroke();

      Theme.drawMath(ctx, [{ t: 'Critical ζ = 1', bold: true }], toX(1.0) + 6, padT + 14, {
        size: 10, color: C.teal, align: 'left'
      });
      Theme.drawMath(ctx, [{ t: 'Overdamped slow pole →', bold: true }], padL + plotW - 8, toY(15.5), {
        size: 10, color: C.orange, align: 'right'
      });

      // Active cursor
      if (sys.zeta >= 0.05 && sys.zeta <= zMax) {
        const cx = toX(sys.zeta);
        const cy = toY(sys.wnTs);
        ctx.fillStyle = C.crimson;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 5.5, 0, 2 * Math.PI);
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
      [0, 0.5, 1.0, 1.5, 2.0].forEach((zv) => ctx.fillText(M.fmt(zv, 1), toX(zv), padT + plotH + 5));

      Theme.drawMath(ctx, [{ t: 'Damping ratio ζ', bold: true }], padL + plotW * 0.5, h - 10, {
        size: 10.5, color: C.text, align: 'center'
      });
      Theme.drawMath(ctx, [{ t: 'Dimensionless 2% settling time ω', bold: true }, { t: 'n', sub: true, bold: true }, { t: 't', i: true, bold: true }, { t: 's', sub: true, bold: true }, { t: '(ζ)', bold: true }], padL, 14, {
        size: 10.5, color: C.text, align: 'left'
      });
    }

    function render() {
      drawPeaks();
      drawRegression();
      drawApprox();
      drawSettling();
    }

    return { setSystem, render };
  }

  window.VibLab.VizLogDec = { create: createLogDecViz };
})();
