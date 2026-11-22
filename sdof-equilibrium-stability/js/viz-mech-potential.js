/**
 * viz-mech-potential.js
 * Section 1: Quadratic potential energy V(x) = 0.5 * Delta * x^2 with rolling bead,
 * restoring/damping force vectors, energy level line, and synchronized x(t), v(t) waveforms.
 */
window.VibLab = window.VibLab || {};

window.VibLab.MechPotentialViz = (function () {
  'use strict';

  const M = window.VibLab.MathStab;
  const Theme = window.VibLab.Theme;

  function create(opts) {
    const potCanvas = opts.potCanvas;
    const waveCanvas = opts.waveCanvas;

    const state = {
      sys: opts.sys,
      x0: 1.0,
      v0: 0.0,
      t: 0,
      tMax: 8.0,
      playing: true,
      visible: true,
      dragging: false
    };

    function setSystem(sys) {
      state.sys = sys;
      // Pick clean time window depending on stability
      if (sys.stability === 'unstable' && sys.regime !== 'nilpotent') {
        const maxRe = Math.max(Math.abs(sys.l1.re), Math.abs(sys.l2.re), 0.35);
        state.tMax = Math.max(2.2, Math.min(7.5, 2.8 / maxRe));
      } else {
        state.tMax = 8.5;
      }
      if (state.t > state.tMax) state.t = 0;
      render();
    }

    function setIC(x0, v0) {
      state.x0 = Math.max(-1.8, Math.min(1.8, x0));
      state.v0 = Math.max(-2.0, Math.min(2.0, v0));
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
      if (!state.visible || !state.playing || state.dragging) return;
      state.t += dt * 0.9;
      if (state.t > state.tMax) state.t = 0;
      render();
    }

    function drawArrow(ctx, x1, y1, x2, y2, color, lw) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 4) return;
      const ux = dx / len;
      const uy = dy / len;
      const head = Math.min(8.5, len * 0.38);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = lw || 2.0;
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

    function potCoordHelpers(w, h) {
      const padL = 46;
      const padR = 22;
      const padT = 28;
      const padB = 30;
      const xLim = 2.4;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const yMid = padT + plotH * 0.56;
      const vScale = plotH * 0.14; // pixels per unit V
      return {
        padL,
        padR,
        padT,
        padB,
        xLim,
        plotW,
        plotH,
        yMid,
        vScale,
        toPxX: (x) => padL + ((x + xLim) / (2 * xLim)) * plotW,
        toWorldX: (px) => ((px - padL) / plotW) * (2 * xLim) - xLim,
        toPxY: (val) => yMid - val * vScale
      };
    }

    function renderPotential() {
      const { ctx, w, h } = Theme.setupHiDPI(potCanvas);
      const C = Theme.colors();
      const sys = state.sys;
      const g = potCoordHelpers(w, h);

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      // Subtle vertical grid
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let xv = -2; xv <= 2; xv += 1) {
        const px = g.toPxX(xv);
        ctx.beginPath();
        ctx.moveTo(px, g.padT);
        ctx.lineTo(px, h - g.padB);
        ctx.stroke();
      }

      // Baseline V = 0
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(g.padL, g.yMid);
      ctx.lineTo(w - g.padR, g.yMid);
      ctx.stroke();

      // Vertical x = 0 equilibrium axis
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = C.ref;
      ctx.beginPath();
      ctx.moveTo(g.toPxX(0), g.padT);
      ctx.lineTo(g.toPxX(0), h - g.padB);
      ctx.stroke();
      ctx.restore();

      // Potential curve V(x) = 0.5 * delta * x^2 (softly scaled for large |delta| so it always fits cleanly)
      const deltaVis = Math.max(-2.6, Math.min(2.6, sys.delta * 0.55));
      ctx.save();
      ctx.beginPath();
      ctx.rect(g.padL, g.padT, g.plotW, g.plotH);
      ctx.clip();

      // Subtle fill under potential curve
      ctx.beginPath();
      const N = 120;
      for (let i = 0; i <= N; i++) {
        const x = -g.xLim + (2 * g.xLim * i) / N;
        const V = 0.5 * deltaVis * x * x;
        const px = g.toPxX(x);
        const py = g.toPxY(V);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = C.navy;
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Equilibrium point marker at x = 0
      const eqColor =
        sys.stability === 'asymptotic'
          ? C.teal
          : sys.stability === 'lyapunov'
            ? C.amber
            : C.crimson;
      ctx.fillStyle = C.bg;
      ctx.strokeStyle = eqColor;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(g.toPxX(0), g.yMid, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Current bead state
      const z = M.evalFlow(sys, [state.x0, state.v0], state.t);
      const xRaw = z[0];
      const vRaw = z[1];
      const clipped = Math.abs(xRaw) > g.xLim - 0.12;
      const xDraw = Math.max(-g.xLim + 0.12, Math.min(g.xLim - 0.12, xRaw));
      const Vdraw = 0.5 * deltaVis * xDraw * xDraw;
      const bx = g.toPxX(xDraw);
      const by = g.toPxY(Vdraw);

      // Total mechanical energy horizontal bar (when delta > 0 and mechanical companion)
      if (!sys.isStar && sys.delta > M.EPS && !clipped) {
        const E = 0.5 * vRaw * vRaw + 0.5 * sys.delta * xRaw * xRaw;
        const Evis = E * (deltaVis / Math.max(0.1, sys.delta));
        const ey = g.toPxY(Evis);
        if (ey > g.padT + 4 && ey < h - g.padB - 4) {
          ctx.save();
          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = C.teal;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(g.padL + 8, ey);
          ctx.lineTo(w - g.padR - 8, ey);
          ctx.stroke();
          ctx.restore();

          ctx.fillStyle = C.teal;
          ctx.font = '600 11px "IBM Plex Sans", sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText('E(t) = ' + M.fmt(E, 2), w - g.padR - 10, ey - 5);
        }
      }

      if (sys.isStar) {
        // Isotropic first-order relaxation: dz1/dt = lambda * z1
        const fStar = sys.l1.re * xDraw;
        const fStarPx = Math.max(-68, Math.min(68, fStar * 22));
        drawArrow(ctx, bx, by - 18, bx + fStarPx, by - 18, sys.l1.re < 0 ? C.teal : C.crimson, 2.2);
      } else {
        // Restoring force arrow F_rest = -delta * x (blue)
        const fRest = -sys.delta * xDraw;
        const fRestPx = Math.max(-68, Math.min(68, fRest * 18));
        drawArrow(ctx, bx, by - 16, bx + fRestPx, by - 16, C.blue, 2.2);

        // Damping / injection force arrow F_damp = tau * v (orange)
        const fDamp = sys.tau * vRaw;
        const fDampPx = Math.max(-68, Math.min(68, fDamp * 18));
        drawArrow(ctx, bx, by - 28, bx + fDampPx, by - 28, C.orange, 2.0);
      }

      // Bead circle
      ctx.fillStyle = C.copper;
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (clipped) {
        ctx.fillStyle = C.crimson;
        ctx.font = '600 11px "IBM Plex Sans", sans-serif';
        ctx.textAlign = xRaw > 0 ? 'right' : 'left';
        ctx.fillText('Escaping (unstable)', xRaw > 0 ? w - g.padR - 8 : g.padL + 8, g.padT + 18);
      }
      ctx.restore();

      // Axis labels & HUD
      ctx.fillStyle = C.muted;
      ctx.font = '500 11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      for (let xv = -2; xv <= 2; xv += 1) {
        ctx.fillText(xv === 0 ? '0' : String(xv), g.toPxX(xv), h - 10);
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = C.text;
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      const curvText = sys.isStar
        ? 'Isotropic star system (A = λI, decoupled first-order flow)'
        : sys.delta > M.EPS
          ? 'Convex potential bowl (Δ = V″(0)/m > 0)'
          : sys.delta < -M.EPS
            ? 'Concave potential hilltop (Δ = V″(0)/m < 0)'
            : 'Flat potential (Δ = 0, zero restoring stiffness)';
      ctx.fillText(curvText, g.padL + 6, 17);

      ctx.textAlign = 'right';
      ctx.fillStyle = C.muted;
      ctx.font = '500 11px "IBM Plex Sans", sans-serif';
      ctx.fillText('Drag bead to set x₀ · Blue: −Δx · Orange: τv', w - g.padR, 17);
    }

    function renderWave() {
      const { ctx, w, h } = Theme.setupHiDPI(waveCanvas);
      const C = Theme.colors();
      const sys = state.sys;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 46;
      const padR = 18;
      const padT = 26;
      const padB = 28;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const yMid = padT + plotH * 0.5;

      // Sample trajectory over [0, tMax]
      const N = 220;
      const xs = new Array(N + 1);
      const vs = new Array(N + 1);
      let maxAbs = Math.max(1.2, Math.abs(state.x0), Math.abs(state.v0));
      for (let i = 0; i <= N; i++) {
        const ti = (state.tMax * i) / N;
        const z = M.evalFlow(sys, [state.x0, state.v0], ti);
        xs[i] = z[0];
        vs[i] = z[1];
        if (Number.isFinite(z[0])) maxAbs = Math.max(maxAbs, Math.min(6.0, Math.abs(z[0])));
        if (Number.isFinite(z[1])) maxAbs = Math.max(maxAbs, Math.min(6.0, Math.abs(z[1])));
      }
      const yLim = Math.max(1.5, Math.min(6.0, maxAbs * 1.15));

      const toX = (t) => padL + (t / state.tMax) * plotW;
      const toY = (val) => yMid - (Math.max(-yLim * 1.15, Math.min(yLim * 1.15, val)) / yLim) * (plotH * 0.45);

      // Grid
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const tx = padL + (plotW * i) / 4;
        ctx.beginPath();
        ctx.moveTo(tx, padT);
        ctx.lineTo(tx, h - padB);
        ctx.stroke();
      }
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, yMid);
      ctx.lineTo(w - padR, yMid);
      ctx.moveTo(padL, padT);
      ctx.lineTo(padL, h - padB);
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      // Velocity v(t) dashed orange
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const px = toX((state.tMax * i) / N);
        const py = toY(vs[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = C.orange;
      ctx.lineWidth = 1.7;
      ctx.stroke();
      ctx.restore();

      // Displacement x(t) solid blue
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const px = toX((state.tMax * i) / N);
        const py = toY(xs[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2.3;
      ctx.stroke();

      // Playhead cursor
      const curX = toX(state.t);
      const zCur = M.evalFlow(sys, [state.x0, state.v0], state.t);
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(curX, padT);
      ctx.lineTo(curX, h - padB);
      ctx.stroke();

      ctx.fillStyle = C.blue;
      ctx.beginPath();
      ctx.arc(curX, toY(zCur[0]), 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.orange;
      ctx.beginPath();
      ctx.arc(curX, toY(zCur[1]), 3.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Labels
      ctx.fillStyle = C.muted;
      ctx.font = '500 10.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      for (let i = 0; i <= 4; i++) {
        const tv = (state.tMax * i) / 4;
        ctx.fillText(M.fmt(tv, 1) + 's', padL + (plotW * i) / 4, h - 9);
      }
      ctx.textAlign = 'right';
      ctx.fillText('+' + M.fmt(yLim, 1), padL - 6, padT + 8);
      ctx.fillText('0', padL - 6, yMid + 4);
      ctx.fillText('−' + M.fmt(yLim, 1), padL - 6, h - padB - 2);

      ctx.textAlign = 'left';
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.blue;
      ctx.fillText('— x(t) displacement', padL + 6, 16);
      ctx.fillStyle = C.orange;
      ctx.fillText('-- v(t) = ẋ(t) velocity', padL + 150, 16);
      ctx.textAlign = 'right';
      ctx.fillStyle = C.muted;
      ctx.font = '500 11px "IBM Plex Mono", monospace';
      ctx.fillText('t = ' + M.fmt(state.t, 2) + ' s', w - padR, 16);
    }

    function render() {
      renderPotential();
      renderWave();
    }

    // Pointer interaction on potential canvas to set x0
    function updateFromPointer(e) {
      const rect = potCanvas.getBoundingClientRect();
      const g = potCoordHelpers(rect.width, rect.height);
      const px = e.clientX - rect.left;
      const xNew = Math.max(-1.8, Math.min(1.8, g.toWorldX(px)));
      state.x0 = xNew;
      state.v0 = 0;
      state.t = 0;
      render();
    }

    potCanvas.style.cursor = 'ew-resize';
    potCanvas.addEventListener('pointerdown', function (e) {
      state.dragging = true;
      potCanvas.setPointerCapture(e.pointerId);
      updateFromPointer(e);
    });
    potCanvas.addEventListener('pointermove', function (e) {
      if (!state.dragging) return;
      updateFromPointer(e);
    });
    potCanvas.addEventListener('pointerup', function (e) {
      state.dragging = false;
      try {
        potCanvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
    });

    render();

    return {
      setSystem,
      setIC,
      setPlaying,
      resetTime,
      setVisible,
      step,
      render
    };
  }

  return { create };
})();
