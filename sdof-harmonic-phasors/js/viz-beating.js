/**
 * viz-beating.js
 * Section 3 visualization for Module 07 (sdof-harmonic-phasors):
 * Undamped near-resonance beating and secular resonance growth (zeta = 0, from rest):
 * - Left canvas: Two equal-length rotating phasors (angular speeds r and 1) drifting in and
 *                out of phase, pulsing their difference vector from 0 to 2A at beat frequency |1 - r|.
 * - Right canvas: Live time-domain waveform x(tau)/X_st with dashed slow beat envelope,
 *                 collapsing into linear secular growth 0.5 * tau * sin(tau) at r = 1!
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathHarmonic;
  const Theme = window.VibLab.Theme;

  function createBeatingViz(opts) {
    const phasorCanvas = document.getElementById(opts.phasorCanvasId);
    const waveCanvas = document.getElementById(opts.waveCanvasId);

    const state = {
      rBeat: 0.90,
      tau: 0,
      tauMax: 90,
      playing: true
    };

    function setRBeat(r) {
      state.rBeat = Math.max(0.70, Math.min(1.30, r));
      const diff = Math.abs(1 - state.rBeat);
      state.tauMax = diff < 1e-4 ? 50 : Math.max(55, Math.min(150, (2 * Math.PI) / diff * 1.55));
      if (state.tau > state.tauMax) state.tau = 0;
      render();
    }

    function setPlaying(p) {
      state.playing = !!p;
    }

    function resetTime() {
      state.tau = 0;
      render();
    }

    function step(dt) {
      if (!state.playing) return;
      state.tau += dt * 4.8;
      if (state.tau > state.tauMax) state.tau -= state.tauMax;
      render();
    }

    function drawPhasor() {
      if (!phasorCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(phasorCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.5;
      const cy = h * 0.54;
      const R = Math.min(w, h) * 0.24;

      const isRes = Math.abs(1 - state.rBeat) < 1e-4;

      // Axes & circle
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 2 * R, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(16, cy);
      ctx.lineTo(w - 16, cy);
      ctx.moveTo(cx, 28);
      ctx.lineTo(cx, h - 22);
      ctx.stroke();

      if (isRes) {
        // Linearly growing spiral vector at exact resonance r = 1!
        const frac = Math.min(1, state.tau / state.tauMax);
        const rad = frac * 1.95 * R;
        const ang = state.tau - Math.PI * 0.5; // sin(tau) = Re(e^{i(tau - pi/2)})
        // Draw growing spiral trail
        ctx.save();
        ctx.strokeStyle = C.crimson;
        ctx.lineWidth = 1.6;
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        const steps = 220;
        for (let i = 0; i <= steps; i++) {
          const tt = (state.tau * i) / steps;
          const rr = (tt / state.tauMax) * 1.95 * R;
          const aa = tt - Math.PI * 0.5;
          const px = cx + rr * Math.cos(aa);
          const py = cy - rr * Math.sin(aa);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();

        const tx = cx + rad * Math.cos(ang);
        const ty = cy - rad * Math.sin(ang);
        Theme.drawArrow(ctx, cx, cy, tx, ty, C.copper, 2.8, 10);

        Theme.drawMath(ctx, [{ t: 'Exact resonance (', bold: true }, { t: 'r', i: true, bold: true }, { t: ' = 1): secular spiral growth', bold: true }], 12, 16, {
          size: 11.5,
          color: C.crimson,
          align: 'left'
        });
      } else {
        // Two unit phasors: v1 = e^{i r tau} (forced) and v2 = -e^{i tau} (free homogeneous)
        // Their sum v1 + v2 has Re = cos(r tau) - cos(tau), pulsing between 0 and 2!
        const a1 = state.rBeat * state.tau;
        const a2 = state.tau + Math.PI;
        const p1 = [cx + R * Math.cos(a1), cy - R * Math.sin(a1)];
        const pSum = [p1[0] + R * Math.cos(a2), p1[1] - R * Math.sin(a2)];

        Theme.drawArrow(ctx, cx, cy, p1[0], p1[1], C.blue, 2.5, 9);
        Theme.drawArrow(ctx, p1[0], p1[1], pSum[0], pSum[1], C.teal, 2.5, 9);
        Theme.drawArrow(ctx, cx, cy, pSum[0], pSum[1], C.copper, 2.9, 10);

        // Projection onto Real axis = instantaneous x(tau)
        ctx.save();
        ctx.strokeStyle = C.copper;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(pSum[0], pSum[1]);
        ctx.lineTo(pSum[0], cy);
        ctx.stroke();
        ctx.fillStyle = C.copper;
        ctx.beginPath();
        ctx.arc(pSum[0], cy, 4.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();

        Theme.drawMath(
          ctx,
          [
            { t: 'Blue: ', bold: true },
            { t: 'e', i: true, bold: true },
            { t: 'iωt', sup: true, bold: true },
            { t: '  +  Teal: −', bold: true },
            { t: 'e', i: true, bold: true },
            { t: 'iωₙt', sup: true, bold: true },
            { t: '  →  beat at |ω − ω', bold: true },
            { t: 'n', sub: true, bold: true },
            { t: '|', bold: true }
          ],
          12,
          16,
          { size: 11, color: C.text, align: 'left' }
        );
      }

      const beatPeriod = Math.abs(1 - state.rBeat) < 1e-4 ? Infinity : (2 * Math.PI) / Math.abs(1 - state.rBeat);
      Theme.drawMath(
        ctx,
        [
          { t: 'Beat period ω' },
          { t: 'n', sub: true },
          { t: 'T', i: true },
          { t: 'b', sub: true },
          { t: ' = ' + (Number.isFinite(beatPeriod) ? M.fmt(beatPeriod, 1) + ' rad' : '∞ (secular)') }
        ],
        12,
        h - 12,
        { size: 10.5, color: C.textMuted, align: 'left', family: '"IBM Plex Mono", monospace' }
      );
    }

    function drawWave() {
      if (!waveCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(waveCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 48;
      const padR = 18;
      const padT = 26;
      const padB = 34;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const N = 460;
      let maxA = 1;
      const ts = new Array(N + 1);
      const xs = new Array(N + 1);
      const envs = new Array(N + 1);
      for (let i = 0; i <= N; i++) {
        const tau = (state.tauMax * i) / N;
        ts[i] = tau;
        const ev = M.evalUndampedBeating(state.rBeat, tau);
        xs[i] = ev.x;
        envs[i] = ev.env;
        if (ev.env > maxA) maxA = ev.env;
      }
      maxA *= 1.12;

      const toX = (t) => padL + (t / state.tauMax) * plotW;
      const midY = padT + plotH * 0.5;
      const toY = (v) => midY - (v / maxA) * (plotH * 0.45);

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, midY);
      ctx.lineTo(padL + plotW, midY);
      ctx.stroke();

      // Dashed envelope +-env
      [1, -1].forEach((sgn) => {
        ctx.save();
        ctx.strokeStyle = C.crimson;
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const px = toX(ts[i]);
          const py = toY(sgn * envs[i]);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      });

      // Waveform x(tau)
      ctx.save();
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const px = toX(ts[i]);
        const py = toY(xs[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // Playhead
      const curX = toX(state.tau);
      ctx.save();
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(curX, padT);
      ctx.lineTo(curX, padT + plotH);
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('+' + M.fmt(maxA, 1), padL - 6, padT + 2);
      ctx.textBaseline = 'bottom';
      ctx.fillText('−' + M.fmt(maxA, 1), padL - 6, padT + plotH - 2);

      Theme.drawMath(
        ctx,
        [{ t: 'Dimensionless time τ = ω', bold: true }, { t: 'n', sub: true, bold: true }, { t: 't', i: true, bold: true }],
        padL + plotW * 0.5,
        h - 10,
        { size: 11, color: C.text, align: 'center' }
      );
      Theme.drawMath(
        ctx,
        [
          { t: 'Undamped response ', bold: true },
          { t: 'x', i: true, bold: true },
          { t: '(τ)/', bold: true },
          { t: 'X', i: true, bold: true },
          { t: 'st', sub: true, bold: true },
          { t: ' (blue) & envelope (crimson)', bold: true }
        ],
        padL,
        padT - 11,
        { size: 11, color: C.text, align: 'left' }
      );
    }

    function render() {
      drawPhasor();
      drawWave();
    }

    return {
      setRBeat,
      getRBeat: () => state.rBeat,
      setPlaying,
      isPlaying: () => state.playing,
      resetTime,
      step,
      render
    };
  }

  window.VibLab.VizBeating = { create: createBeatingViz };
})();
