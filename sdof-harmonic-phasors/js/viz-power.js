/**
 * viz-power.js
 * Section 4 visualization for Module 07 (sdof-harmonic-phasors):
 * - Left canvas: Normalized average input power P_bar(r) = 2 zeta r^2 / ((1-r^2)^2 + (2 zeta r)^2)
 *                with shaded exact half-power band [r1, r2] where r2 - r1 === 2 zeta identically!
 * - Right canvas: Force-velocity Lissajous / work loop (x'(t) vs F0(t)) showing why input power
 *                 P_bar = 0.5 F0 w |X| sin(phi) peaks at phase resonance (phi = 90 deg, closed ellipse
 *                 collapsing to a straight positive-slope line when F0 is purely in phase with velocity!).
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathHarmonic;
  const Theme = window.VibLab.Theme;

  function createPowerViz(opts) {
    const powerCanvas = document.getElementById(opts.powerCanvasId);
    const workCanvas = document.getElementById(opts.workCanvasId);
    let sys = opts.sys;

    function setSystem(newSys) {
      sys = newSys;
      render();
    }

    function drawPower() {
      if (!powerCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(powerCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 52;
      const padR = 18;
      const padT = 26;
      const padB = 38;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const rMax = 2.6;

      // Normalize power curve by P_max = 1/(2 zeta) so peak is always 1.0 cleanly!
      const pMax = Math.max(1e-6, sys.powerMax);
      const toX = (r) => padL + (r / rMax) * plotW;
      const toY = (v) => padT + plotH - v * (plotH * 0.90);

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      // Shade exact half-power band [rHP1, rHP2]
      const xHP1 = toX(Math.min(rMax, sys.rHP1));
      const xHP2 = toX(Math.min(rMax, sys.rHP2));
      ctx.fillStyle = C.dark ? 'rgba(38,181,166,0.16)' : 'rgba(0,137,123,0.12)';
      ctx.fillRect(xHP1, padT, Math.max(2, xHP2 - xHP1), plotH);

      // Horizontal ticks 0, 0.5, 1.0
      [0, 0.5, 1.0].forEach((yv) => {
        const py = toY(yv);
        ctx.strokeStyle = yv === 0.5 ? C.teal : C.grid;
        ctx.lineWidth = yv === 0.5 ? 1.2 : 1;
        if (yv === 0.5) ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = C.textMuted;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(M.fmt(yv, 1), padL - 6, py);
      });

      // Plot normalized power P(r)/P_max
      const N = 320;
      ctx.save();
      ctx.strokeStyle = C.teal;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const r = (rMax * i) / N;
        const pNorm = M.evalHarmonic(r, sys.zeta).powerNorm / pMax;
        const px = toX(r);
        const py = toY(pNorm);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // Half-power bandwidth double-arrow at y = 0.5
      const yHalf = toY(0.5);
      ctx.fillStyle = C.teal;
      [xHP1, xHP2].forEach((xpt) => {
        ctx.beginPath();
        ctx.arc(xpt, yHalf, 4.5, 0, 2 * Math.PI);
        ctx.fill();
      });
      Theme.drawMath(
        ctx,
        [{ t: 'Δ', bold: true }, { t: 'r', i: true, bold: true }, { t: ' = 2ζ = ' + M.fmt(sys.bandwidth, 2), bold: true }],
        0.5 * (xHP1 + xHP2),
        yHalf - 13,
        { size: 11, color: C.teal, align: 'center', family: '"IBM Plex Mono", monospace' }
      );

      // Active r marker
      if (sys.r <= rMax) {
        const curX = toX(sys.r);
        const curY = toY(sys.powerNorm / pMax);
        ctx.save();
        ctx.strokeStyle = C.copper;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(curX, padT);
        ctx.lineTo(curX, padT + plotH);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = C.copper;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(curX, curY, 5.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }

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

      Theme.drawMath(
        ctx,
        [{ t: 'Normalized power ', bold: true }, { t: 'P̄', i: true, bold: true }, { t: '(r) / ', bold: true }, { t: 'P̄', i: true, bold: true }, { t: 'max', sub: true, bold: true }, { t: '  — peaks strictly at ', bold: true }, { t: 'r', i: true, bold: true }, { t: ' = 1', bold: true }],
        padL,
        padT - 11,
        { size: 11, color: C.text, align: 'left' }
      );
    }

    function drawWork() {
      if (!workCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(workCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      // Force-velocity phase alignment:
      // F(th) = cos(th)
      // v(th) = -sin(th - phi) = sin(phi) cos(th) - cos(phi) sin(th)   (normalized by peak velocity w|X|)
      // Notice: when phi = 90 deg, v(th) === +cos(th) === F(th) -> straight line with slope +1 (100% power factor)!
      const cx = w * 0.5;
      const cy = h * 0.53;
      const R = Math.min(w, h) * 0.33;

      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - R, cy - R, 2 * R, 2 * R);

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - R - 14, cy);
      ctx.lineTo(cx + R + 14, cy);
      ctx.moveTo(cx, cy - R - 14);
      ctx.lineTo(cx, cy + R + 14);
      ctx.stroke();

      // Shaded power quadrants (Q1 & Q3: F*v > 0 positive work injected!)
      ctx.fillStyle = C.dark ? 'rgba(38,181,166,0.08)' : 'rgba(0,137,123,0.06)';
      ctx.fillRect(cx, cy - R, R, R);
      ctx.fillRect(cx - R, cy, R, R);

      // Force-velocity Lissajous ellipse (v/v_max vs F/F0)
      const N = 180;
      ctx.save();
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const th = (2 * Math.PI * i) / N;
        const F = Math.cos(th);
        const V = -Math.sin(th - sys.phi);
        const px = cx + V * R;
        const py = cy - F * R;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Axis labels
      Theme.drawMath(ctx, [{ t: 'v', i: true, bold: true }, { t: ' / ', bold: true }, { t: 'v', i: true, bold: true }, { t: 'max', sub: true, bold: true }], cx + R + 12, cy - 10, {
        size: 11,
        color: C.textMuted,
        align: 'right'
      });
      Theme.drawMath(ctx, [{ t: 'F', i: true, bold: true }, { t: ' / ', bold: true }, { t: 'F', i: true, bold: true }, { t: '0', sub: true, bold: true }], cx + 8, cy - R - 12, {
        size: 11,
        color: C.textMuted,
        align: 'left'
      });

      const pf = Math.sin(sys.phi);
      Theme.drawMath(
        ctx,
        [{ t: 'Power factor sin(φ) = ' + M.fmt(pf, 3) + '  (' + (pf > 0.995 ? '100% aligned at φ = 90°' : 'shaded Q1/Q3: F·v > 0') + ')', bold: true }],
        12,
        15,
        { size: 11.5, color: pf > 0.995 ? C.teal : C.text, align: 'left' }
      );
    }

    function render() {
      drawPower();
      drawWork();
    }

    return { setSystem, render };
  }

  window.VibLab.VizPower = { create: createPowerViz };
})();
