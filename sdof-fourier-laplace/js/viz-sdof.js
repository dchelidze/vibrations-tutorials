/**
 * viz-sdof.js
 * Section 1: Animated physical 1-DOF mass-spring-damper schematic synchronized with
 * time-domain waveforms for Impulse h(t), Harmonic f(t)=F0 cos(wt), Step, and Free IC.
 */
window.VibLab = window.VibLab || {};

window.VibLab.SdofViz = (function () {
  'use strict';

  const M1 = window.VibLab.Math1D;
  const Theme = window.VibLab.Theme;

  function create(opts) {
    const simCanvas = opts.simCanvas;
    const waveCanvas = opts.waveCanvas;

    const state = {
      sys: opts.sys,
      omegaDrive: opts.omegaDrive || opts.sys.wn,
      mode: 'impulse', // 'impulse', 'harmonic', 'step', 'free'
      playing: true,
      t: 0,
      tMax: 4.5,
      visible: true
    };

    function updateTimeWindow() {
      // Roughly 6 natural periods so every frequency scales cleanly
      const T0 = (2 * Math.PI) / Math.max(0.5, state.sys.wn);
      state.tMax = Math.max(2.0, Math.min(12.0, 6.5 * T0));
    }
    updateTimeWindow();

    function setSystem(sys, omegaDrive) {
      state.sys = sys;
      if (omegaDrive !== undefined) state.omegaDrive = omegaDrive;
      updateTimeWindow();
      if (state.t > state.tMax) state.t = 0;
      render();
    }

    function setDriveFreq(w) {
      state.omegaDrive = w;
      render();
    }

    function setMode(mode) {
      state.mode = mode;
      state.t = 0;
      render();
    }

    function setPlaying(p) {
      state.playing = !!p;
    }

    function resetTime() {
      state.t = 0;
      render();
    }

    function setVisible(v) {
      state.visible = !!v;
    }

    function step(dt) {
      if (!state.visible || !state.playing) return;
      state.t += dt * 0.85;
      if (state.t > state.tMax) state.t = 0;
      render();
    }

    function evalCurrent(t) {
      const sys = state.sys;
      if (state.mode === 'impulse') {
        const x = M1.impulseResponse(sys, t);
        const normScale = 1 / (sys.m * sys.wn);
        return {
          x,
          xSteady: null,
          f: t < 0.04 ? 1 : 0,
          xScale: Math.max(1e-6, normScale * 1.15),
          fLabel: 'δ(t) [N·s]',
          xLabel: 'h(t) [m/(N·s)]'
        };
      }
      if (state.mode === 'harmonic') {
        const F0 = sys.k * 0.01; // unit static deflection = 0.01 m -> normalized nicely
        const res = M1.harmonicResponse(sys, t, F0, state.omegaDrive);
        const ampEst = Math.min(
          0.08,
          Math.max(0.014, F0 * (Number.isFinite(res.mag) ? res.mag : 4 / sys.k) * 1.65)
        );
        return {
          x: res.total,
          xSteady: res.steady,
          f: F0 * Math.cos(state.omegaDrive * t),
          fMax: F0,
          xScale: ampEst,
          fLabel: 'f(t) = F₀ cos(ωt)',
          xLabel: 'x(t) [m]'
        };
      }
      if (state.mode === 'step') {
        const F0 = sys.k * 0.01;
        const x = M1.stepResponse(sys, t, F0);
        return {
          x,
          xSteady: F0 / sys.k,
          f: F0,
          fMax: F0,
          xScale: 0.022,
          fLabel: 'f(t) = F₀ u(t)',
          xLabel: 'x_step(t) [m]'
        };
      }
      // Free release from x0 = 0.01 m, v0 = 0
      const x0 = 0.01;
      const x = M1.freeResponse(sys, t, x0, 0);
      return {
        x,
        xSteady: null,
        f: 0,
        fMax: 1,
        xScale: 0.013,
        fLabel: 'f(t) = 0',
        xLabel: 'x_free(t) [m]'
      };
    }

    function drawSpring(ctx, x1, x2, y, coils, amp) {
      const len = x2 - x1;
      const lead = Math.min(18, len * 0.14);
      const body = Math.max(10, len - 2 * lead);
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x1 + lead, y);
      const steps = coils * 2;
      for (let i = 1; i <= steps; i++) {
        const px = x1 + lead + (body * (i - 0.5)) / steps;
        const py = y + (i % 2 === 1 ? -amp : amp);
        ctx.lineTo(px, py);
      }
      ctx.lineTo(x2 - lead, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    }

    function drawDamper(ctx, x1, x2, y, cylH) {
      const mid = (x1 + x2) * 0.5;
      const cylW = Math.min(46, (x2 - x1) * 0.36);
      // Left rod to cylinder housing
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(mid - cylW * 0.45, y);
      ctx.stroke();

      // Cylinder open-right U-shape
      const leftC = mid - cylW * 0.45;
      const rightC = mid + cylW * 0.55;
      ctx.beginPath();
      ctx.moveTo(rightC, y - cylH * 0.5);
      ctx.lineTo(leftC, y - cylH * 0.5);
      ctx.lineTo(leftC, y + cylH * 0.5);
      ctx.lineTo(rightC, y + cylH * 0.5);
      ctx.stroke();

      // Piston head moving inside cylinder
      const pistonX = Math.max(leftC + 6, Math.min(rightC - 4, mid + (x2 - x1 - 150) * 0.18));
      ctx.beginPath();
      ctx.moveTo(pistonX, y - cylH * 0.34);
      ctx.lineTo(pistonX, y + cylH * 0.34);
      ctx.moveTo(pistonX, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    }

    function drawArrow(ctx, x1, y1, x2, y2, color) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 3) return;
      const ux = dx / len;
      const uy = dy / len;
      const head = Math.min(9, len * 0.35);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - head * ux - head * 0.45 * uy, y2 - head * uy + head * 0.45 * ux);
      ctx.lineTo(x2 - head * ux + head * 0.45 * uy, y2 - head * uy - head * 0.45 * ux);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function renderSim() {
      const { ctx, w, h } = Theme.setupHiDPI(simCanvas);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const cur = evalCurrent(state.t);
      const normX = Math.max(-1.25, Math.min(1.25, cur.x / cur.xScale));
      const maxDispPx = Math.min(72, w * 0.13);

      const wallX = Math.max(54, w * 0.12);
      const eqCenterX = w * 0.56;
      const massW = 78;
      const massH = 68;
      const centerY = h * 0.54;
      const massX = eqCenterX + normX * maxDispPx;
      const massLeft = massX - massW * 0.5;
      const massRight = massX + massW * 0.5;

      // Ground floor line
      const floorY = centerY + massH * 0.5 + 14;
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(wallX - 10, floorY);
      ctx.lineTo(w - 28, floorY);
      ctx.stroke();

      // Fixed wall with hatching
      ctx.beginPath();
      ctx.moveTo(wallX, centerY - 58);
      ctx.lineTo(wallX, floorY);
      ctx.stroke();
      ctx.strokeStyle = C.muted;
      ctx.lineWidth = 1;
      for (let y = centerY - 52; y <= floorY - 4; y += 10) {
        ctx.beginPath();
        ctx.moveTo(wallX, y);
        ctx.lineTo(wallX - 10, y + 7);
        ctx.stroke();
      }

      // Equilibrium reference dashed line
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = C.ref;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(eqCenterX, centerY - 64);
      ctx.lineTo(eqCenterX, floorY + 12);
      ctx.stroke();
      ctx.restore();

      // Spring (upper branch)
      const springY = centerY - 17;
      ctx.strokeStyle = C.orange;
      ctx.lineWidth = 2;
      drawSpring(ctx, wallX, massLeft, springY, 7, 10);

      // Damper (lower branch)
      const damperY = centerY + 18;
      ctx.strokeStyle = state.sys.zeta > 1e-4 ? C.teal : C.ref;
      ctx.lineWidth = 2;
      if (state.sys.zeta < 1e-4) {
        ctx.save();
        ctx.setLineDash([3, 4]);
        drawDamper(ctx, wallX, massLeft, damperY, 18);
        ctx.restore();
      } else {
        drawDamper(ctx, wallX, massLeft, damperY, 18);
      }

      // Labels for k and c
      ctx.font = '600 12px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.orange;
      ctx.textAlign = 'center';
      ctx.fillText('k = ' + M1.fmt(state.sys.k, 0) + ' N/m', (wallX + massLeft) * 0.5, springY - 16);

      ctx.fillStyle = state.sys.zeta > 1e-4 ? C.teal : C.ref;
      ctx.fillText('c = ' + M1.fmt(state.sys.c, 2) + ' N·s/m', (wallX + massLeft) * 0.5, damperY + 26);

      // Rollers under mass
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.5;
      [-20, 20].forEach(function (dx) {
        ctx.beginPath();
        ctx.arc(massX + dx, floorY - 7, 6.5, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Mass block
      ctx.fillStyle = Theme.isDark() ? '#1b344a' : '#edf2f7';
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2.2;
      ctx.fillRect(massLeft, centerY - massH * 0.5, massW, massH);
      ctx.strokeRect(massLeft, centerY - massH * 0.5, massW, massH);

      ctx.fillStyle = C.text;
      ctx.font = '600 14px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('m', massX, centerY - 2);
      ctx.font = '500 11.5px "IBM Plex Mono", monospace';
      ctx.fillStyle = C.muted;
      ctx.fillText(M1.fmt(state.sys.m, 2) + ' kg', massX, centerY + 15);

      // Displacement arrow x(t) from equilibrium
      ctx.font = '600 12px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.muted;
      ctx.textAlign = 'center';
      ctx.fillText('x = 0', eqCenterX, centerY - 68);
      if (Math.abs(massX - eqCenterX) > 6) {
        drawArrow(ctx, eqCenterX, centerY - 50, massX, centerY - 50, C.blue);
      }

      // Applied force arrow on right face of mass
      if (state.mode === 'impulse') {
        const flash = Math.max(0, 1 - state.t / 0.16);
        if (flash > 0.02) {
          const arrowLen = 28 + 38 * flash;
          drawArrow(ctx, massRight + 6, centerY, massRight + 6 + arrowLen, centerY, C.copper);
          ctx.fillStyle = C.copper;
          ctx.font = '600 12px "IBM Plex Sans", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('δ(t) impulse', massRight + 10, centerY - 12);
        }
      } else if (state.mode === 'harmonic' || state.mode === 'step') {
        const fNorm = cur.f / (cur.fMax || 1);
        const arrowLen = fNorm * 58;
        if (Math.abs(arrowLen) > 4) {
          drawArrow(ctx, massRight + 8, centerY, massRight + 8 + arrowLen, centerY, C.copper);
        }
        ctx.fillStyle = C.copper;
        ctx.font = '600 12px "IBM Plex Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(
          state.mode === 'harmonic' ? 'F₀ cos(ωt)' : 'F₀ u(t)',
          massRight + 12,
          centerY - 16
        );
      }

      // Top-left status bar
      ctx.textAlign = 'left';
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.muted;
      const modeNames = {
        impulse: 'IMPULSE EXCITATION · h(t)',
        harmonic: 'HARMONIC FORCE · ω = ' + M1.fmt(state.omegaDrive, 2) + ' rad/s (r = ' + M1.fmt(state.omegaDrive / state.sys.wn, 2) + ')',
        step: 'STEP EXCITATION · f(t) = F₀ u(t)',
        free: 'FREE RELEASE · x(0) = x₀, v(0) = 0'
      };
      ctx.fillText(modeNames[state.mode], 14, 20);

      ctx.textAlign = 'right';
      ctx.font = '500 11.5px "IBM Plex Mono", monospace';
      ctx.fillStyle = C.copper;
      ctx.fillText('t = ' + M1.fmt(state.t, 2) + ' s', w - 14, 20);
    }

    function renderWave() {
      const { ctx, w, h } = Theme.setupHiDPI(waveCanvas);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 56;
      const padR = 18;
      const padT = 26;
      const padB = 30;
      const pw = Math.max(40, w - padL - padR);
      const ph = Math.max(40, h - padT - padB);
      const midY = padT + ph * 0.5;

      const curSample = evalCurrent(0);
      const xScale = curSample.xScale;

      function xToPx(t) {
        return padL + (t / state.tMax) * pw;
      }
      function yToPx(val) {
        return midY - (val / xScale) * (ph * 0.44);
      }

      // Grid lines
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 5; i++) {
        const gx = padL + (i / 5) * pw;
        ctx.beginPath();
        ctx.moveTo(gx, padT);
        ctx.lineTo(gx, padT + ph);
        ctx.stroke();
      }
      [-1, -0.5, 0, 0.5, 1].forEach(function (frac) {
        const gy = midY - frac * ph * 0.44;
        ctx.beginPath();
        ctx.moveTo(padL, gy);
        ctx.lineTo(padL + pw, gy);
        ctx.stroke();
      });

      // Zero axis
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, midY);
      ctx.lineTo(padL + pw, midY);
      ctx.moveTo(padL, padT);
      ctx.lineTo(padL, padT + ph);
      ctx.stroke();

      const N = 320;

      // Envelope for underdamped impulse or free response
      if (state.mode === 'impulse' && state.sys.regime === 'underdamped') {
        const amp0 = 1 / (state.sys.m * state.sys.wd);
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = C.ref;
        ctx.lineWidth = 1.2;
        [1, -1].forEach(function (sgn) {
          ctx.beginPath();
          for (let i = 0; i <= N; i++) {
            const tt = (i / N) * state.tMax;
            const env = sgn * amp0 * Math.exp(state.sys.sigma * tt);
            const px = xToPx(tt);
            const py = Math.max(padT, Math.min(padT + ph, yToPx(env)));
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        });
        ctx.restore();
      }

      // Steady-state harmonic or step target reference
      if (state.mode === 'harmonic' || state.mode === 'step') {
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = C.teal;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const tt = (i / N) * state.tMax;
          const val = evalCurrent(tt).xSteady;
          const px = xToPx(tt);
          const py = Math.max(padT, Math.min(padT + ph, yToPx(val)));
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Input force indicator
      if (state.mode === 'impulse') {
        // Dirac delta spike at t = 0
        drawArrow(ctx, padL + 1, midY, padL + 1, padT + 8, C.copper);
      } else if (state.mode === 'harmonic') {
        ctx.save();
        ctx.strokeStyle = C.copper;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const tt = (i / N) * state.tMax;
          const fNorm = Math.cos(state.omegaDrive * tt) * xScale * 0.55;
          const px = xToPx(tt);
          const py = yToPx(fNorm);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Primary response curve x(t) or h(t)
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const tt = (i / N) * state.tMax;
        const val = evalCurrent(tt).x;
        const px = xToPx(tt);
        const py = Math.max(padT, Math.min(padT + ph, yToPx(val)));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Current time marker cursor
      const curPx = xToPx(state.t);
      const curVal = evalCurrent(state.t).x;
      const curPy = Math.max(padT, Math.min(padT + ph, yToPx(curVal)));
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(curPx, padT);
      ctx.lineTo(curPx, padT + ph);
      ctx.stroke();

      ctx.fillStyle = C.copper;
      ctx.beginPath();
      ctx.arc(curPx, curPy, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Axis ticks & labels
      ctx.fillStyle = C.muted;
      ctx.font = '500 10.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      for (let i = 0; i <= 5; i++) {
        const tt = (i / 5) * state.tMax;
        ctx.fillText(M1.fmt(tt, 1) + 's', xToPx(tt), padT + ph + 16);
      }

      ctx.textAlign = 'right';
      ctx.fillText(M1.fmtSci(xScale, 1), padL - 6, padT + 8);
      ctx.fillText('0', padL - 6, midY + 4);
      ctx.fillText('-' + M1.fmtSci(xScale, 1), padL - 6, padT + ph);

      // Legend
      ctx.textAlign = 'left';
      ctx.font = '600 11px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.blue;
      ctx.fillText('— ' + curSample.xLabel, padL + 6, 15);

      if (state.mode === 'impulse' && state.sys.regime === 'underdamped') {
        ctx.fillStyle = C.ref;
        ctx.fillText('--- ±exp(−ζωₙt) / (mωd)', padL + 145, 15);
      } else if (state.mode === 'harmonic') {
        ctx.fillStyle = C.teal;
        ctx.fillText('--- Steady state (Fourier)', padL + 100, 15);
        ctx.fillStyle = C.copper;
        ctx.fillText('— f(t) scaled', padL + 265, 15);
      } else if (state.mode === 'step') {
        ctx.fillStyle = C.teal;
        ctx.fillText('--- Static limit F₀/k', padL + 115, 15);
      }
    }

    function render() {
      renderSim();
      renderWave();
    }

    return {
      setSystem,
      setDriveFreq,
      setMode,
      setPlaying,
      resetTime,
      setVisible,
      step,
      render
    };
  }

  return { create };
})();
