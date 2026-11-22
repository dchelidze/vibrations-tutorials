/**
 * viz-trdet.js
 * Section 3: Direct-manipulation Poincaré trace-determinant (tau, Delta) plane
 * coupled live to a morphing phase portrait and 1-parameter bifurcation sweeps.
 */
window.VibLab = window.VibLab || {};

window.VibLab.TrDetViz = (function () {
  'use strict';

  const M = window.VibLab.MathStab;
  const Theme = window.VibLab.Theme;

  function create(opts) {
    const trdetCanvas = opts.trdetCanvas;
    const phaseCanvas = opts.phaseCanvas;
    const onChange = opts.onChange;

    const state = {
      sys: opts.sys,
      dragging: false,
      sweep: null, // { kind, phase }
      visible: true
    };

    const TAU_MIN = -4.4;
    const TAU_MAX = 4.4;
    const DEL_MIN = -3.2;
    const DEL_MAX = 5.4;

    function setSystem(sys) {
      state.sys = sys;
      render();
    }

    function startSweep(kind) {
      if (state.sweep && state.sweep.kind === kind) {
        state.sweep = null;
        return false;
      }
      state.sweep = { kind: kind, phase: 0 };
      return true;
    }

    function stopSweep() {
      state.sweep = null;
    }

    function setVisible(v) {
      state.visible = !!v;
    }

    function step(dt) {
      if (!state.visible || !state.sweep) return;
      state.sweep.phase += dt * 0.36;
      const u = 0.5 - 0.5 * Math.cos(state.sweep.phase * Math.PI); // smooth 0..1..0
      let tau = state.sys.tau;
      let delta = state.sys.delta;

      if (state.sweep.kind === 'tau_fixed_delta') {
        delta = 2.25;
        tau = -3.8 + 7.6 * u;
      } else if (state.sweep.kind === 'delta_fixed_tau') {
        tau = -2.2;
        delta = -2.4 + 6.4 * u;
      } else if (state.sweep.kind === 'conservative') {
        tau = 0.0;
        delta = -2.4 + 6.4 * u;
      }
      if (typeof onChange === 'function') {
        onChange(tau, delta, true);
      }
    }

    function trdetGeom(w, h) {
      const padL = 50;
      const padR = 20;
      const padT = 26;
      const padB = 38;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      return {
        padL,
        padR,
        padT,
        padB,
        plotW,
        plotH,
        toX: (tau) => padL + ((tau - TAU_MIN) / (TAU_MAX - TAU_MIN)) * plotW,
        toY: (del) => padT + ((DEL_MAX - del) / (DEL_MAX - DEL_MIN)) * plotH,
        fromPx: (px, py) => [
          TAU_MIN + ((px - padL) / plotW) * (TAU_MAX - TAU_MIN),
          DEL_MAX - ((py - padT) / plotH) * (DEL_MAX - DEL_MIN)
        ]
      };
    }

    function renderTrDet() {
      const { ctx, w, h } = Theme.setupHiDPI(trdetCanvas);
      const C = Theme.colors();
      const sys = state.sys;
      const g = trdetGeom(w, h);

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.beginPath();
      ctx.rect(g.padL, g.padT, g.plotW, g.plotH);
      ctx.clip();

      const x0 = g.toX(0);
      const y0 = g.toY(0);

      // 1. Saddle region (Delta < 0)
      ctx.fillStyle = C.saddleFill;
      ctx.fillRect(g.padL, y0, g.plotW, g.padT + g.plotH - y0);

      // 2. Stable spirals (tau < 0, Delta > tau^2/4)
      ctx.fillStyle = C.stableFill;
      ctx.beginPath();
      ctx.moveTo(x0, g.padT);
      ctx.lineTo(x0, y0);
      for (let i = 0; i <= 80; i++) {
        const tau = (TAU_MIN * i) / 80;
        const del = 0.25 * tau * tau;
        ctx.lineTo(g.toX(tau), g.toY(del));
      }
      ctx.lineTo(g.padL, g.padT);
      ctx.closePath();
      ctx.fill();

      // 3. Stable nodes (tau < 0, 0 < Delta < tau^2/4)
      ctx.fillStyle = C.nodeFill;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      for (let i = 0; i <= 80; i++) {
        const tau = (TAU_MIN * i) / 80;
        const del = 0.25 * tau * tau;
        ctx.lineTo(g.toX(tau), g.toY(del));
      }
      ctx.lineTo(g.padL, y0);
      ctx.closePath();
      ctx.fill();

      // 4. Unstable upper right (tau > 0, Delta > 0)
      ctx.fillStyle = C.unstableFill;
      ctx.fillRect(x0, g.padT, g.padL + g.plotW - x0, y0 - g.padT);

      // Grid lines
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let t = -4; t <= 4; t++) {
        ctx.beginPath();
        ctx.moveTo(g.toX(t), g.padT);
        ctx.lineTo(g.toX(t), g.padT + g.plotH);
        ctx.stroke();
      }
      for (let d = -3; d <= 5; d++) {
        ctx.beginPath();
        ctx.moveTo(g.padL, g.toY(d));
        ctx.lineTo(g.padL + g.plotW, g.toY(d));
        ctx.stroke();
      }

      // Active sweep track preview
      if (state.sweep) {
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = C.blue;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        if (state.sweep.kind === 'tau_fixed_delta') {
          ctx.moveTo(g.toX(-3.8), g.toY(2.25));
          ctx.lineTo(g.toX(3.8), g.toY(2.25));
        } else if (state.sweep.kind === 'delta_fixed_tau') {
          ctx.moveTo(g.toX(-2.2), g.toY(-2.4));
          ctx.lineTo(g.toX(-2.2), g.toY(4.0));
        } else if (state.sweep.kind === 'conservative') {
          ctx.moveTo(g.toX(0), g.toY(-2.4));
          ctx.lineTo(g.toX(0), g.toY(4.0));
        }
        ctx.stroke();
        ctx.restore();
      }

      // Main axes: Delta = 0 (static buckling / zero eigenvalue) and tau = 0
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0, g.padT + g.plotH);
      ctx.stroke();

      // Delta = 0 line highlighted
      ctx.strokeStyle = C.purple;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(g.padL, y0);
      ctx.lineTo(g.padL + g.plotW, y0);
      ctx.stroke();

      // Centers ray: tau = 0, Delta > 0
      ctx.strokeStyle = C.amber;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0, g.padT);
      ctx.stroke();

      // Discriminant parabola Delta = tau^2 / 4
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const N = 160;
      for (let i = 0; i <= N; i++) {
        const tau = TAU_MIN + ((TAU_MAX - TAU_MIN) * i) / N;
        const del = 0.25 * tau * tau;
        const px = g.toX(tau);
        const py = g.toY(del);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Region text labels
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = C.teal;
      ctx.fillText('Stable spirals', g.toX(-1.55), g.toY(3.55));
      ctx.font = '500 10.5px "IBM Plex Sans", sans-serif';
      ctx.fillText('(underdamped)', g.toX(-1.55), g.toY(3.12));

      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.blue;
      ctx.fillText('Stable nodes', g.toX(-3.15), g.toY(0.88));
      ctx.font = '500 10.5px "IBM Plex Sans", sans-serif';
      ctx.fillText('(overdamped)', g.toX(-3.15), g.toY(0.45));

      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.crimson;
      ctx.fillText('Unstable spirals', g.toX(1.55), g.toY(3.55));
      ctx.font = '500 10.5px "IBM Plex Sans", sans-serif';
      ctx.fillText('(negative damping)', g.toX(1.55), g.toY(3.12));

      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.crimson;
      ctx.fillText('Unstable nodes', g.toX(3.15), g.toY(0.88));

      ctx.font = '600 12px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.purple;
      ctx.fillText('Saddle points (Δ < 0 · unstable for all τ)', g.toX(0), g.toY(-1.55));

      // Boundary annotations
      ctx.fillStyle = C.amber;
      ctx.font = '600 10.5px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Centers (τ=0)', x0 + 6, g.toY(4.78));

      ctx.fillStyle = C.copper;
      ctx.textAlign = 'right';
      ctx.fillText('Δ = τ²/4 (critical)', g.toX(3.85), g.toY(4.62));

      ctx.fillStyle = C.purple;
      ctx.textAlign = 'right';
      ctx.fillText('Δ = 0 (non-isolated)', g.padL + g.plotW - 8, y0 - 6);

      // Crosshairs to active operating point (tau, delta)
      const hx = g.toX(Math.max(TAU_MIN, Math.min(TAU_MAX, sys.tau)));
      const hy = g.toY(Math.max(DEL_MIN, Math.min(DEL_MAX, sys.delta)));
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = C.navy;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(hx, g.padT + g.plotH);
      ctx.lineTo(hx, hy);
      ctx.lineTo(g.padL, hy);
      ctx.stroke();
      ctx.restore();

      // Draggable operating handle
      ctx.fillStyle = C.copper;
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(hx, hy, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = C.navy;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(hx, hy, 12.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();

      // Axis ticks & labels
      ctx.fillStyle = C.muted;
      ctx.font = '500 10.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      for (let t = -4; t <= 4; t += 2) {
        ctx.fillText(String(t), g.toX(t), g.padT + g.plotH + 15);
      }
      ctx.textAlign = 'right';
      for (let d = -3; d <= 5; d += 1) {
        ctx.fillText(String(d), g.padL - 7, g.toY(d) + 4);
      }

      ctx.fillStyle = C.text;
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Trace  τ = tr(A) = −c/m  [s⁻¹]', g.padL + g.plotW * 0.5, h - 6);

      ctx.save();
      ctx.translate(15, g.padT + g.plotH * 0.5);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Determinant  Δ = det(A) = k/m  [s⁻²]', 0, 0);
      ctx.restore();

      ctx.textAlign = 'right';
      ctx.fillStyle = C.muted;
      ctx.font = '500 11px "IBM Plex Sans", sans-serif';
      ctx.fillText('Click or drag (τ, Δ) anywhere', g.padL + g.plotW, 17);
    }

    function drawArrowHead(ctx, x, y, ux, uy, size, color) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - size * ux - size * 0.48 * uy, y - size * uy + size * 0.48 * ux);
      ctx.lineTo(x - size * ux + size * 0.48 * uy, y - size * uy - size * 0.48 * ux);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function renderMiniPhase() {
      const { ctx, w, h } = Theme.setupHiDPI(phaseCanvas);
      const C = Theme.colors();
      const sys = state.sys;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 36;
      const padR = 16;
      const padT = 32;
      const padB = 30;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const lim = 2.4;
      const scale = Math.min(plotW, plotH) / (2 * lim);
      const cx = padL + plotW * 0.5;
      const cy = padT + plotH * 0.5;
      const toX = (x) => cx + x * scale;
      const toY = (v) => cy - v * scale;

      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      // Grid & axes
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(toX(i), padT);
        ctx.lineTo(toX(i), padT + plotH);
        ctx.moveTo(padL, toY(i));
        ctx.lineTo(padL + plotW, toY(i));
        ctx.stroke();
      }
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, cy);
      ctx.lineTo(padL + plotW, cy);
      ctx.moveTo(cx, padT);
      ctx.lineTo(cx, padT + plotH);
      ctx.stroke();

      // Trajectories
      const trajCol =
        sys.stability === 'asymptotic'
          ? C.teal
          : sys.stability === 'lyapunov'
            ? C.blue
            : C.crimson;

      function plotCurve(z0, tB, tF, lw) {
        const steps = 100;
        const pts = [];
        for (let i = 0; i <= steps; i++) {
          const t = tB + ((tF - tB) * i) / steps;
          const z = M.evalFlow(sys, z0, t);
          if (!Number.isFinite(z[0]) || !Number.isFinite(z[1])) continue;
          if (Math.abs(z[0]) <= lim * 1.9 && Math.abs(z[1]) <= lim * 1.9) {
            pts.push(z);
          } else if (pts.length > 0 && t > 0) {
            break;
          }
        }
        if (pts.length < 2) return;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const px = toX(pts[i][0]);
          const py = toY(pts[i][1]);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = trajCol;
        ctx.lineWidth = lw;
        ctx.stroke();

        if (pts.length > 10) {
          const mid = Math.floor(pts.length * 0.5);
          const dx = toX(pts[mid + 1][0]) - toX(pts[mid - 1][0]);
          const dy = toY(pts[mid + 1][1]) - toY(pts[mid - 1][1]);
          const len = Math.hypot(dx, dy);
          if (len > 1.5) {
            drawArrowHead(ctx, toX(pts[mid + 1][0]), toY(pts[mid + 1][1]), dx / len, dy / len, 6.2, trajCol);
          }
        }
      }

      if (sys.regime === 'center') {
        const T = (2 * Math.PI) / Math.max(0.25, Math.sqrt(sys.delta));
        [0.55, 1.15, 1.75].forEach((r) => plotCurve([r, 0], 0, T, 1.8));
      } else if (sys.isStar) {
        const starCol = sys.l1.re < 0 ? C.teal : C.crimson;
        const dir = sys.l1.re > 0 ? 1 : -1;
        const nRays = 8;
        const R = lim * 1.4;
        ctx.strokeStyle = starCol;
        ctx.lineWidth = 2.0;
        for (let i = 0; i < nRays; i++) {
          const ang = (Math.PI * i) / nRays;
          const ex = Math.cos(ang);
          const ev = Math.sin(ang);
          ctx.beginPath();
          ctx.moveTo(toX(-ex * R), toY(-ev * R));
          ctx.lineTo(toX(ex * R), toY(ev * R));
          ctx.stroke();
          [1.25, -1.25].forEach(function (s) {
            const ux = (s > 0 ? 1 : -1) * dir * ex;
            const uy = -(s > 0 ? 1 : -1) * dir * ev;
            drawArrowHead(ctx, toX(ex * s), toY(ev * s), ux, uy, 7.2, starCol);
          });
        }
      } else if (sys.regime === 'nilpotent') {
        [-1.6, -1.0, -0.45, 0.45, 1.0, 1.6].forEach((v0) => plotCurve([0, v0], -3, 3, 1.6));
      } else {
        const nS = 10;
        const tB = sys.regime === 'saddle' ? -2.2 : sys.tau < 0 ? -0.6 : -4.8;
        const tF = sys.regime === 'saddle' ? 2.2 : sys.tau < 0 ? 4.8 : 0.6;
        for (let i = 0; i < nS; i++) {
          const a = (2 * Math.PI * i) / nS + 0.2;
          plotCurve([1.65 * Math.cos(a), 1.65 * Math.sin(a)], tB, tF, 1.55);
        }
      }

      // Eigendirections (for non-star real regimes)
      if (!sys.isStar) {
        sys.eigenvectors.forEach(function (ev) {
          const col =
            ev.role === 'stable' || ev.role === 'slow' || ev.role === 'zero'
              ? C.teal
              : ev.role === 'unstable' || ev.role === 'fast' || ev.role === 'nonzero'
                ? C.crimson
                : C.purple;
          const R = lim * 2.1;
          ctx.strokeStyle = col;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(toX(-ev.x * R), toY(-ev.v * R));
          ctx.lineTo(toX(ev.x * R), toY(ev.v * R));
          ctx.stroke();

          if (Math.abs(ev.lambda) > M.EPS) {
            const dir = ev.lambda > 0 ? 1 : -1;
            [1.15, -1.15].forEach(function (s) {
              const ux = (s > 0 ? 1 : -1) * dir * ev.x;
              const uy = -(s > 0 ? 1 : -1) * dir * ev.v;
              drawArrowHead(ctx, toX(ev.x * s), toY(ev.v * s), ux, uy, 7.5, col);
            });
          }
        });
      }

      // Origin equilibrium marker
      const eqCol =
        sys.stability === 'asymptotic' ? C.teal : sys.stability === 'lyapunov' ? C.amber : C.crimson;
      ctx.fillStyle = sys.stability === 'asymptotic' ? eqCol : C.bg;
      ctx.strokeStyle = eqCol;
      ctx.lineWidth = 2.3;
      ctx.beginPath();
      ctx.arc(cx, cy, 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();

      // Top header badge inside canvas
      ctx.fillStyle = C.text;
      ctx.font = '600 12px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(sys.regimeName, padL, 19);

      ctx.fillStyle = C.muted;
      ctx.font = '500 11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('τ = ' + M.fmt(sys.tau, 2) + ', Δ = ' + M.fmt(sys.delta, 2), padL + plotW, 19);

      ctx.textAlign = 'center';
      ctx.fillText('x', cx, h - 8);
      ctx.textAlign = 'left';
      ctx.fillText('v', 10, cy + 4);
    }

    function render() {
      renderTrDet();
      renderMiniPhase();
    }

    // Pointer interaction on (tau, Delta) canvas
    function pickPoint(e) {
      const rect = trdetCanvas.getBoundingClientRect();
      const g = trdetGeom(rect.width, rect.height);
      let [tau, delta] = g.fromPx(e.clientX - rect.left, e.clientY - rect.top);
      tau = Math.max(TAU_MIN, Math.min(TAU_MAX, tau));
      delta = Math.max(DEL_MIN, Math.min(DEL_MAX, delta));

      // Gentle magnetic snap near key boundaries (tau=0, delta=0, delta=tau^2/4) for clean teaching
      if (Math.abs(tau) < 0.14) tau = 0;
      if (Math.abs(delta) < 0.14) delta = 0;
      const para = 0.25 * tau * tau;
      if (Math.abs(delta - para) < 0.14 && delta > 0.15) delta = para;

      state.sweep = null;
      if (typeof onChange === 'function') onChange(tau, delta, false);
    }

    trdetCanvas.style.cursor = 'grab';
    trdetCanvas.addEventListener('pointerdown', function (e) {
      state.dragging = true;
      trdetCanvas.style.cursor = 'grabbing';
      trdetCanvas.setPointerCapture(e.pointerId);
      pickPoint(e);
    });
    trdetCanvas.addEventListener('pointermove', function (e) {
      if (!state.dragging) return;
      pickPoint(e);
    });
    trdetCanvas.addEventListener('pointerup', function (e) {
      state.dragging = false;
      trdetCanvas.style.cursor = 'grab';
      try {
        trdetCanvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
    });

    render();

    return {
      setSystem,
      startSweep,
      stopSweep,
      setVisible,
      step,
      render
    };
  }

  return { create };
})();
