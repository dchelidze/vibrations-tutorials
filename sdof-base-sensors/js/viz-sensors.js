/**
 * viz-sensors.js
 * Section 3 visualization for Module 04 (sdof-base-sensors):
 * - Left canvas: Accelerometer calibration gain w_n^2 |Z| / |Y''| = 1 / sqrt((1 - r^2)^2 + (2 zeta r)^2)
 *                with shaded +/-5% flat-response band and Butterworth optimal zeta = 0.70.
 * - Right canvas: Vibrometer calibration gain |Z| / Y = r^2 / sqrt((1 - r^2)^2 + (2 zeta r)^2)
 *                with shaded +/-5% flat-response band and minimum usable frequency ratio r_min.
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathSensors;
  const Theme = window.VibLab.Theme;

  function findAccelCutoff(zeta, tol) {
    // Largest r_max such that |accelGain(r, zeta) - 1| <= tol for all r in [0, r_max]
    const N = 800;
    const rLimit = 2.0;
    let rMax = 0;
    for (let i = 1; i <= N; i++) {
      const r = (rLimit * i) / N;
      const g = M.evalBaseSensor(r, zeta).accelGain;
      if (Math.abs(g - 1) <= tol) rMax = r;
      else break;
    }
    return rMax;
  }

  function findVibroCutoff(zeta, tol) {
    // Smallest r_min such that |Rrel(r, zeta) - 1| <= tol for all r in [r_min, 8.0]
    const N = 1600;
    const rLimit = 8.0;
    let rMin = rLimit;
    for (let i = N; i >= 1; i--) {
      const r = (rLimit * i) / N;
      const g = M.evalBaseSensor(r, zeta).Rrel;
      if (Math.abs(g - 1) <= tol) rMin = r;
      else break;
    }
    return rMin;
  }

  function createSensorsViz(opts) {
    const accelCanvas = document.getElementById(opts.accelCanvasId);
    const vibroCanvas = document.getElementById(opts.vibroCanvasId);
    let sys = opts.sys;

    function setSystem(newSys) { sys = newSys; render(); }

    function drawSensorPlot(canvas, isVibro) {
      if (!canvas) return;
      const { ctx, w, h } = Theme.setupCanvas(canvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 50, padR = 18, padT = 26, padB = 38;
      const plotW = w - padL - padR, plotH = h - padT - padB;
      const rMax = isVibro ? 4.0 : 2.0;
      const yMax = 2.0;
      const toX = (r) => padL + (r / rMax) * plotW;
      const toY = (v) => padT + plotH - (Math.min(yMax * 1.08, v) / yMax) * plotH;

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      // +/-5% flat-response band [0.95, 1.05]
      const yTopBand = toY(1.05);
      const yBotBand = toY(0.95);
      ctx.fillStyle = C.dark ? 'rgba(38,181,166,0.18)' : 'rgba(0,137,123,0.13)';
      ctx.fillRect(padL, yTopBand, plotW, yBotBand - yTopBand);

      // Grid lines
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      [0, 0.5, 1.0, 1.5, 2.0].forEach((yv) => {
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

      // Unity dashed line
      ctx.save();
      ctx.strokeStyle = C.teal;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(padL, toY(1.0));
      ctx.lineTo(padL + plotW, toY(1.0));
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      // Usable bandwidth shading along bottom edge for active zeta
      const cutoff = isVibro ? findVibroCutoff(sys.zeta, 0.05) : findAccelCutoff(sys.zeta, 0.05);
      ctx.fillStyle = C.dark ? 'rgba(38,181,166,0.28)' : 'rgba(0,137,123,0.18)';
      if (!isVibro && cutoff > 0.01) {
        const cx = toX(Math.min(rMax, cutoff));
        ctx.fillRect(padL, padT + plotH - 8, cx - padL, 8);
      } else if (isVibro && cutoff < rMax) {
        const cx = toX(cutoff);
        ctx.fillRect(cx, padT + plotH - 8, padL + plotW - cx, 8);
      }

      const N = 320;
      function plotCurve(z, color, width, dash, alpha) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.globalAlpha = alpha;
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const r = (rMax * i) / N;
          const ev = M.evalBaseSensor(r, z);
          const val = isVibro ? ev.Rrel : ev.accelGain;
          const px = toX(r);
          const py = toY(val);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }

      plotCurve(0.20, C.ref, 1.2, [4, 3], 0.55);
      plotCurve(0.45, C.ref, 1.2, null, 0.45);
      plotCurve(0.70, C.teal, 1.7, [6, 3], 0.85);
      plotCurve(sys.zeta, isVibro ? C.crimson : C.blue, 2.6, null, 1.0);

      // Cutoff marker dot & non-overlapping label placed near bottom usable-band bar
      if (!isVibro && cutoff > 0.02 && cutoff <= rMax) {
        const gCut = M.evalBaseSensor(cutoff, sys.zeta).accelGain;
        const cx = toX(cutoff), cy = toY(gCut);
        ctx.fillStyle = C.teal;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 4.8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        Theme.drawMath(ctx, [{ t: 'r', i: true, bold: true }, { t: 'max', sub: true, bold: true }, { t: ' = ' + M.fmt(cutoff, 2), bold: true }], padL + 8, padT + plotH - 18, {
          size: 10.5, color: C.teal, align: 'left'
        });
      } else if (isVibro && cutoff < rMax) {
        const gCut = M.evalBaseSensor(cutoff, sys.zeta).Rrel;
        const cx = toX(cutoff), cy = toY(gCut);
        ctx.fillStyle = C.teal;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 4.8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        Theme.drawMath(ctx, [{ t: 'r', i: true, bold: true }, { t: 'min', sub: true, bold: true }, { t: ' = ' + M.fmt(cutoff, 2), bold: true }], padL + plotW - 8, padT + plotH - 18, {
          size: 10.5, color: C.teal, align: 'right'
        });
      }

      // +/-5% band label placed in open space away from active curve
      Theme.drawMath(
        ctx,
        [{ t: '±5% flat band', bold: true }],
        isVibro ? padL + 10 : padL + plotW - 10,
        toY(1.09),
        { size: 10, color: C.teal, align: isVibro ? 'left' : 'right' }
      );

      // Active r cursor
      if (sys.r <= rMax) {
        const curX = toX(sys.r);
        const curV = isVibro ? sys.Rrel : sys.accelGain;
        ctx.strokeStyle = C.copper;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(curX, padT);
        ctx.lineTo(curX, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        if (curV <= yMax) {
          ctx.fillStyle = C.copper;
          ctx.strokeStyle = C.bg;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(curX, toY(curV), 5.5, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const rStep = isVibro ? 0.5 : 0.4;
      for (let r = 0; r <= rMax + 1e-6; r += rStep) ctx.fillText(M.fmt(r, 1), toX(r), padT + plotH + 6);

      Theme.drawMath(ctx, [{ t: 'Frequency ratio ', bold: true }, { t: 'r', i: true, bold: true }, { t: ' = ω / ω', bold: true }, { t: 'n', sub: true, bold: true }], padL + plotW * 0.5, h - 10, {
        size: 11, color: C.text, align: 'center'
      });
      Theme.drawMath(
        ctx,
        isVibro
          ? [{ t: 'Vibrometer gain |', bold: true }, { t: 'Z', i: true, bold: true }, { t: '|/', bold: true }, { t: 'Y', i: true, bold: true }, { t: '  (operate at ', bold: true }, { t: 'r', i: true, bold: true }, { t: ' ≫ 1)', bold: true }]
          : [{ t: 'Accelerometer gain ω', bold: true }, { t: 'n', sub: true, bold: true }, { t: '2', sup: true, bold: true }, { t: '|', bold: true }, { t: 'Z', i: true, bold: true }, { t: '|/|', bold: true }, { t: 'Ÿ', i: true, bold: true }, { t: '|  (operate at ', bold: true }, { t: 'r', i: true, bold: true }, { t: ' ≪ 1)', bold: true }],
        padL,
        padT - 11,
        { size: 11, color: C.text, align: 'left' }
      );
    }

    function render() {
      drawSensorPlot(accelCanvas, false);
      drawSensorPlot(vibroCanvas, true);
    }

    return { setSystem, render, findAccelCutoff, findVibroCutoff };
  }

  window.VibLab.VizSensors = {
    create: createSensorsViz,
    findAccelCutoff,
    findVibroCutoff
  };
})();
