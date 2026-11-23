/**
 * viz-epicycles.js
 * Section 1 visualization for Module 10 (sdof-fourier-periodic):
 * - Left canvas: Live rotating Fourier epicycle chain for the filtered SDOF output x_ss(t),
 *                projecting horizontally onto the live waveform cursor.
 * - Right canvas: Two full drive cycles comparing exact periodic forcing f(t) (dashed gray),
 *                 N-term Fourier input f_N(t) (blue), and steady-state SDOF output x_ss(t) (crimson).
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathFourier;
  const Theme = window.VibLab.Theme;

  function createEpicyclesViz(opts) {
    const epiCanvas = document.getElementById(opts.epiCanvasId);
    const waveCanvas = document.getElementById(opts.waveCanvasId);
    let sys = opts.sys;
    let theta = 0.65;
    let playing = true;

    function setSystem(newSys) { sys = newSys; render(); }
    function setPlaying(p) { playing = !!p; }
    function step(dt) {
      if (!playing) return;
      theta = (theta + dt * 1.45) % (4 * Math.PI);
      render();
    }

    function computeYScale() {
      // Find max amplitude of output over one period so epicycles & waveform stay nicely framed
      let maxOut = 1.25;
      for (let i = 0; i <= 120; i++) {
        const th = (2 * Math.PI * i) / 120;
        maxOut = Math.max(maxOut, Math.abs(sys.evalOutput(th)));
      }
      return maxOut * 1.18;
    }

    function drawEpicycles() {
      if (!epiCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(epiCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const yLim = computeYScale();
      const padT = 30, padB = 28;
      const availH = h - padT - padB;
      const midY = padT + availH * 0.5;
      const scale = (availH * 0.44) / yLim;
      const cx = w * 0.44;

      // Crosshair axes
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(16, midY);
      ctx.lineTo(w - 16, midY);
      ctx.moveTo(cx, padT);
      ctx.lineTo(cx, h - padB);
      ctx.stroke();

      // Build epicycle chain for output:
      // Each harmonic contributes outAmp * cos(n*theta + outPsi) vertically ->
      // represent phasor as angle alpha = n*theta + outPsi, where vertical projection = cos(alpha), horizontal = sin(alpha)
      // Wait: to keep standard counter-clockwise rotation with vertical projection = cos(alpha):
      // x_k = -R sin(alpha), y_k = +R cos(alpha) (vertical upward on canvas is -y!)
      let px = cx;
      let py = midY - sys.a0Half * scale;

      if (Math.abs(sys.a0Half) > 1e-4) {
        Theme.drawArrow(ctx, cx, midY, px, py, C.teal, 2.0, 7);
      }

      const palette = [C.blue, C.crimson, C.teal, C.orange, C.purple, C.copper];
      for (let i = 0; i < sys.harmonics.length; i++) {
        const hm = sys.harmonics[i];
        if (hm.outAmp < 1e-4) continue;
        const rad = hm.outAmp * scale;
        const alpha = hm.n * theta + hm.outPsi;
        const nx = px - rad * Math.sin(alpha);
        const ny = py - rad * Math.cos(alpha);
        const isDom = hm.n === sys.domN;
        const col = isDom ? C.crimson : palette[(hm.n - 1) % palette.length];

        // Circle
        if (rad >= 2.2) {
          ctx.save();
          ctx.strokeStyle = col;
          ctx.globalAlpha = isDom ? 0.55 : 0.28;
          ctx.lineWidth = isDom ? 1.5 : 1.0;
          ctx.beginPath();
          ctx.arc(px, py, rad, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.restore();
        }

        // Rotating arm
        if (rad >= 6) {
          Theme.drawArrow(ctx, px, py, nx, ny, col, isDom ? 2.4 : 1.6, isDom ? 8 : 6);
        } else {
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(nx, ny);
          ctx.stroke();
        }

        // Label dominant harmonic circle cleanly outside
        if (isDom && rad > 18) {
          const lx = px + rad * 0.72 + 6;
          const ly = py - rad * 0.72;
          Theme.drawMath(ctx, [{ t: 'n', i: true, bold: true }, { t: ' = ' + hm.n + ' (dom.)', bold: true }], Math.min(w - 88, Math.max(14, lx)), Math.max(padT + 14, ly), {
            size: 10.5, color: C.crimson, align: 'left'
          });
        }

        px = nx;
        py = ny;
      }

      // Horizontal projection guide from epicycle tip to right edge
      ctx.save();
      ctx.strokeStyle = C.copper;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(w - 14, py);
      ctx.stroke();
      ctx.restore();

      // Tip dot
      ctx.fillStyle = C.crimson;
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 5.2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      Theme.drawMath(
        ctx,
        [{ t: 'Output Fourier epicycles (', bold: true }, { t: 'N', i: true, bold: true }, { t: ' = ' + sys.N + ', dominant ', bold: true }, { t: 'n', i: true, bold: true }, { t: ' = ' + (sys.domN || 'DC') + ')', bold: true }],
        12,
        15,
        { size: 11, color: C.text, align: 'left' }
      );
      Theme.drawMath(
        ctx,
        [{ t: 'x', i: true }, { t: 'ss', sub: true }, { t: '(θ) = ' + M.fmt(sys.evalOutput(theta), 2) + '   f', i: false }, { t: 'N', sub: true }, { t: '(θ) = ' + M.fmt(sys.evalInput(theta), 2) }],
        12,
        h - 12,
        { size: 10.5, color: C.textMuted, align: 'left', family: '"IBM Plex Mono", monospace' }
      );
    }

    function drawWaveforms() {
      if (!waveCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(waveCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 46, padR = 16, padT = 30, padB = 34;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const yLim = computeYScale();
      const cycles = 2;
      const thMax = cycles * 2 * Math.PI;
      const toX = (th) => padL + (th / thMax) * plotW;
      const midY = padT + plotH * 0.5;
      const toY = (v) => midY - (v / yLim) * (plotH * 0.44);

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      // Horizontal zero & +/-1 reference lines
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      [-1, 0, 1].forEach((yv) => {
        if (Math.abs(yv) > yLim) return;
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

      ctx.strokeStyle = C.gridStrong;
      ctx.beginPath();
      ctx.moveTo(padL, midY);
      ctx.lineTo(padL + plotW, midY);
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      const steps = 320;
      // 1. Exact periodic forcing (dashed gray)
      ctx.save();
      ctx.strokeStyle = C.ref;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const th = (thMax * i) / steps;
        const px = toX(th), py = toY(sys.exactInput(th));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // 2. N-term Fourier input f_N(theta) (solid blue)
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const th = (thMax * i) / steps;
        const px = toX(th), py = toY(sys.evalInput(th));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // 3. Steady-state SDOF output x_ss(theta) (thick crimson)
      ctx.strokeStyle = C.crimson;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const th = (thMax * i) / steps;
        const px = toX(th), py = toY(sys.evalOutput(th));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Live vertical phase cursor
      const thMod = ((theta % thMax) + thMax) % thMax;
      const curX = toX(thMod);
      ctx.save();
      ctx.strokeStyle = C.copper;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(curX, padT);
      ctx.lineTo(curX, padT + plotH);
      ctx.stroke();
      ctx.restore();

      const curOutY = toY(sys.evalOutput(thMod));
      ctx.fillStyle = C.crimson;
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(curX, curOutY, 5.2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      ctx.restore();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      // X ticks: 0, pi, 2pi, 3pi, 4pi
      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ['0', 'π', '2π', '3π', '4π'].forEach((lbl, idx) => {
        ctx.fillText(lbl, toX(idx * Math.PI), padT + plotH + 5);
      });

      Theme.drawMath(ctx, [{ t: 'Drive phase θ = ω', bold: true }, { t: '0', sub: true, bold: true }, { t: 't', i: true, bold: true }, { t: ' (two input cycles)', bold: true }], padL + plotW * 0.5, h - 10, {
        size: 10.5, color: C.text, align: 'center'
      });
      Theme.drawMath(
        ctx,
        [{ t: 'Blue: ', bold: true }, { t: 'f', i: true, bold: true }, { t: 'N', sub: true, bold: true }, { t: '(θ)   Crimson: ', bold: true }, { t: 'x', i: true, bold: true }, { t: 'ss', sub: true, bold: true }, { t: '(θ)   Dashed: exact ', bold: true }, { t: 'f', i: true, bold: true }],
        padL,
        15,
        { size: 10.5, color: C.text, align: 'left' }
      );
    }

    function render() {
      drawEpicycles();
      drawWaveforms();
    }

    return { setSystem, setPlaying, isPlaying: () => playing, step, render };
  }

  window.VibLab.VizEpicycles = { create: createEpicyclesViz };
})();
