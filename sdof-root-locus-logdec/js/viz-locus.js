/**
 * viz-locus.js
 * Section 1 visualization for Module 01 (sdof-root-locus-logdec):
 * - Left canvas: Complex s-plane root locus showing the semicircular arc of radius w_n
 *                for 0 <= zeta <= 1, polar damping angle cos(theta) = zeta, collision at -w_n,
 *                and fast/slow split along the negative real axis for zeta > 1.
 * - Right canvas: Free-response waveform x(t) (x0 = 1, v0 = 0) with +/- A exp(-zeta w_n t)
 *                 envelope, damped period T_d marker, and critically damped reference (dashed teal).
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathRootLocus;
  const Theme = window.VibLab.Theme;

  function createLocusViz(opts) {
    const locusCanvas = document.getElementById(opts.locusCanvasId);
    const waveCanvas = document.getElementById(opts.waveCanvasId);
    let sys = opts.sys;

    function setSystem(newSys) { sys = newSys; render(); }

    function drawPoleCross(ctx, x, y, color, sz) {
      const s = sz || 6.5;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - s, y - s);
      ctx.lineTo(x + s, y + s);
      ctx.moveTo(x + s, y - s);
      ctx.lineTo(x - s, y + s);
      ctx.stroke();
      ctx.restore();
    }

    function drawLocus() {
      if (!locusCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(locusCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 32, padR = 30, padT = 30, padB = 28;
      const plotW = w - padL - padR, plotH = h - padT - padB;
      const wn = sys.wn;
      // Show Re in [-3.4 * wn, +0.45 * wn], Im in [-1.45 * wn, +1.45 * wn] with isotropic aspect!
      const reMin = -3.35 * wn, reMax = 0.45 * wn;
      const imMax = 1.40 * wn;
      const scale = Math.min(plotW / (reMax - reMin), plotH / (2 * imMax));
      const ox = padL + (-reMin) * scale;
      const oy = padT + plotH * 0.5;
      const toX = (re) => ox + re * scale;
      const toY = (im) => oy - im * scale;

      // Subtle shaded stable left half-plane
      ctx.fillStyle = C.dark ? 'rgba(38,181,166,0.06)' : 'rgba(0,137,123,0.04)';
      ctx.fillRect(padL, padT, ox - padL, plotH);

      // Axes
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, oy);
      ctx.lineTo(padL + plotW, oy);
      ctx.moveTo(ox, padT);
      ctx.lineTo(ox, padT + plotH);
      ctx.stroke();

      // Semicircular underdamped root locus of radius w_n in LHP
      const radPx = wn * scale;
      ctx.save();
      ctx.strokeStyle = C.blue;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2.0;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.arc(ox, oy, radPx, Math.PI * 0.5, Math.PI * 1.5);
      ctx.stroke();
      ctx.restore();

      // Overdamped real-axis locus line from 0^- to -inf
      ctx.save();
      ctx.strokeStyle = C.orange;
      ctx.globalAlpha = 0.38;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(padL + 6, oy);
      ctx.lineTo(ox - 2, oy);
      ctx.stroke();
      ctx.restore();

      // Critical double-pole tick at -w_n
      const xCrit = toX(-wn);
      ctx.fillStyle = C.teal;
      ctx.beginPath();
      ctx.arc(xCrit, oy, 3.8, 0, 2 * Math.PI);
      ctx.fill();
      Theme.drawMath(ctx, [{ t: '−ω', bold: true }, { t: 'n', sub: true, bold: true }], xCrit, oy + 16, {
        size: 10.5, color: C.teal, align: 'center'
      });

      const rt = sys.roots;
      if (rt.regime === 'underdamped') {
        const px1 = toX(rt.s1.re), py1 = toY(rt.s1.im);
        const px2 = toX(rt.s2.re), py2 = toY(rt.s2.im);

        // Radius vector & damping angle arc theta from negative real axis
        ctx.strokeStyle = C.copper;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(px1, py1);
        ctx.stroke();

        // Projection dashed lines onto Re and Im axes
        ctx.save();
        ctx.strokeStyle = C.ref;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(px1, py1);
        ctx.lineTo(px1, oy);
        ctx.moveTo(px1, py1);
        ctx.lineTo(ox, py1);
        ctx.stroke();
        ctx.restore();

        // Angle wedge theta = acos(zeta) between negative real axis (pi) and pole ray (pi - theta)
        const thetaRad = Math.acos(sys.zeta);
        const arcR = Math.min(34, radPx * 0.42);
        ctx.fillStyle = C.dark ? 'rgba(217,138,82,0.22)' : 'rgba(180,98,42,0.16)';
        ctx.strokeStyle = C.copper;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.arc(ox, oy, arcR, Math.PI, Math.PI + thetaRad, false);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (thetaRad > 0.25) {
          const midA = Math.PI + thetaRad * 0.5;
          Theme.drawMath(ctx, [{ t: 'θ', i: true, bold: true }], ox + Math.cos(midA) * (arcR + 11), oy + Math.sin(midA) * (arcR + 11), {
            size: 11, color: C.copper, align: 'center'
          });
        }

        drawPoleCross(ctx, px1, py1, C.crimson, 6.5);
        drawPoleCross(ctx, px2, py2, C.crimson, 6.5);

        Theme.drawMath(ctx, [{ t: 's', i: true, bold: true }, { t: '1', sub: true, bold: true }], px1 - 12, py1 - 10, {
          size: 11, color: C.crimson, align: 'right'
        });
        Theme.drawMath(ctx, [{ t: 's', i: true, bold: true }, { t: '2', sub: true, bold: true }], px2 - 12, py2 + 12, {
          size: 11, color: C.crimson, align: 'right'
        });
      } else if (rt.regime === 'critical') {
        drawPoleCross(ctx, xCrit, oy, C.teal, 7.5);
        ctx.strokeStyle = C.teal;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(xCrit, oy, 11, 0, 2 * Math.PI);
        ctx.stroke();
        Theme.drawMath(ctx, [{ t: 'Double pole ', bold: true }, { t: 's', i: true, bold: true }, { t: '1,2', sub: true, bold: true }, { t: ' = −ω', bold: true }, { t: 'n', sub: true, bold: true }], xCrit, oy - 22, {
          size: 10.5, color: C.teal, align: 'center'
        });
      } else {
        const pxSlow = toX(rt.s1.re);
        const pxFast = Math.max(padL + 12, toX(rt.s2.re));
        drawPoleCross(ctx, pxSlow, oy, C.crimson, 6.5);
        drawPoleCross(ctx, pxFast, oy, C.orange, 6.5);
        Theme.drawMath(ctx, [{ t: 'Slow ', bold: true }, { t: 's', i: true, bold: true }, { t: '1', sub: true, bold: true }], pxSlow, oy - 16, {
          size: 10.5, color: C.crimson, align: 'center'
        });
        Theme.drawMath(ctx, [{ t: 'Fast ', bold: true }, { t: 's', i: true, bold: true }, { t: '2', sub: true, bold: true }], pxFast, oy - 16, {
          size: 10.5, color: C.orange, align: 'center'
        });
      }

      // Axis labels
      Theme.drawMath(ctx, [{ t: 'Re(', bold: true }, { t: 's', i: true, bold: true }, { t: ')', bold: true }], padL + plotW - 2, oy - 12, { size: 10.5, color: C.textMuted, align: 'right' });
      Theme.drawMath(ctx, [{ t: 'Im(', bold: true }, { t: 's', i: true, bold: true }, { t: ')', bold: true }], ox + 6, padT + 10, { size: 10.5, color: C.textMuted, align: 'left' });

      Theme.drawMath(
        ctx,
        rt.regime === 'underdamped'
          ? [{ t: 'Semicircle |', bold: true }, { t: 's', i: true, bold: true }, { t: '| = ω', bold: true }, { t: 'n', sub: true, bold: true }, { t: ' = ' + M.fmt(wn, 1) + '  (cos θ = ζ = ' + M.fmt(sys.zeta, 2) + ')', bold: true }]
          : rt.regime === 'critical'
          ? [{ t: 'Critical collision: ', bold: true }, { t: 's', i: true, bold: true }, { t: '1', sub: true, bold: true }, { t: ' = ', bold: true }, { t: 's', i: true, bold: true }, { t: '2', sub: true, bold: true }, { t: ' = −' + M.fmt(wn, 2), bold: true }]
          : [{ t: 'Overdamped split: ', bold: true }, { t: 's', i: true, bold: true }, { t: '1', sub: true, bold: true }, { t: 's', i: true, bold: true }, { t: '2', sub: true, bold: true }, { t: ' = ω', bold: true }, { t: 'n', sub: true, bold: true }, { t: '2', sup: true, bold: true }, { t: ' = ' + M.fmt(wn * wn, 2), bold: true }],
        12,
        15,
        { size: 11, color: C.text, align: 'left' }
      );
    }

    function drawWaveform() {
      if (!waveCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(waveCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 46, padR = 16, padT = 30, padB = 34;
      const plotW = w - padL - padR, plotH = h - padT - padB;
      const tMax = Math.max(12 / sys.wn, 6.0);
      const toX = (t) => padL + (t / tMax) * plotW;
      const midY = padT + plotH * 0.5;
      const toY = (x) => midY - (x / 1.18) * (plotH * 0.45);

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      // +/-2% settling band
      ctx.fillStyle = C.dark ? 'rgba(38,181,166,0.16)' : 'rgba(0,137,123,0.12)';
      ctx.fillRect(padL, toY(0.02), plotW, toY(-0.02) - toY(0.02));

      // Horizontal grid
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      [-1, -0.5, 0, 0.5, 1].forEach((yv) => {
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
      });

      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      const N = 320;
      // Critically damped reference (dashed teal)
      ctx.save();
      ctx.strokeStyle = C.teal;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const t = (tMax * i) / N;
        const px = toX(t), py = toY(M.evalFreeResponse(t, 1.0, sys.wn, 1, 0));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // Exponential envelope for underdamped case
      if (sys.roots.regime === 'underdamped') {
        const envAmp = 1 / Math.sqrt(Math.max(1e-6, 1 - sys.zeta * sys.zeta));
        [1, -1].forEach((sgn) => {
          ctx.save();
          ctx.strokeStyle = C.copper;
          ctx.setLineDash([4, 3]);
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          for (let i = 0; i <= N; i++) {
            const t = (tMax * i) / N;
            const v = sgn * envAmp * Math.exp(-sys.zeta * sys.wn * t);
            const px = toX(t), py = toY(v);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
          ctx.restore();
        });
      }

      // Active free-response waveform x(t)
      ctx.strokeStyle = sys.roots.regime === 'critical' ? C.teal : sys.roots.regime === 'overdamped' ? C.orange : C.crimson;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const t = (tMax * i) / N;
        const px = toX(t), py = toY(M.evalFreeResponse(t, sys.zeta, sys.wn, 1, 0));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Settling time vertical marker
      if (sys.ts > 0 && sys.ts < tMax) {
        const sx = toX(sys.ts);
        ctx.save();
        ctx.strokeStyle = C.blue;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(sx, padT);
        ctx.lineTo(sx, padT + plotH);
        ctx.stroke();
        ctx.restore();
        Theme.drawMath(ctx, [{ t: 't', i: true, bold: true }, { t: 's', sub: true, bold: true }, { t: ' = ' + M.fmt(sys.ts, 2) + ' s', bold: true }], Math.min(padL + plotW - 68, sx + 5), padT + plotH - 14, {
          size: 10, color: C.blue, align: 'left', family: '"IBM Plex Mono", monospace'
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
      for (let i = 0; i <= 5; i++) {
        const tv = (tMax * i) / 5;
        ctx.fillText(M.fmt(tv, 1), toX(tv), padT + plotH + 5);
      }

      Theme.drawMath(ctx, [{ t: 'Time ', bold: true }, { t: 't', i: true, bold: true }, { t: ' (s)', bold: true }], padL + plotW * 0.5, h - 10, {
        size: 10.5, color: C.text, align: 'center'
      });
      Theme.drawMath(ctx, [{ t: 'Free response ', bold: true }, { t: 'x', i: true, bold: true }, { t: '(', bold: true }, { t: 't', i: true, bold: true }, { t: ')/', bold: true }, { t: 'x', i: true, bold: true }, { t: '0', sub: true, bold: true }, { t: ' (dashed teal: critical ζ = 1)', bold: true }], padL, 14, {
        size: 10.5, color: C.text, align: 'left'
      });
    }

    function render() {
      drawLocus();
      drawWaveform();
    }

    return { setSystem, render };
  }

  window.VibLab.VizLocus = { create: createLocusViz };
})();
