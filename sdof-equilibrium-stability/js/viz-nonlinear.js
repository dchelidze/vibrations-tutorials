/**
 * viz-nonlinear.js
 * Section 5: Nonlinear 1-DOF bridge (damped pendulum, double-well Duffing,
 * and non-hyperbolic center test). Aligns potential energy V(x) directly above
 * the global phase portrait and pairs it with a magnified local linearization comparator.
 */
window.VibLab = window.VibLab || {};

window.VibLab.NonlinearViz = (function () {
  'use strict';

  const M = window.VibLab.MathStab;
  const Theme = window.VibLab.Theme;

  function create(opts) {
    const potCanvas = opts.potCanvas;
    const phaseCanvas = opts.phaseCanvas;
    const localCanvas = opts.localCanvas;
    const onSelectEq = opts.onSelectEq;

    const state = {
      modelKey: 'duffing',
      param: M.NONLINEAR_MODELS.duffing.defaultParam,
      selectedEqIdx: 1, // hilltop saddle by default for Duffing
      customSeeds: [],
      visible: true
    };

    function getModel() {
      return M.NONLINEAR_MODELS[state.modelKey];
    }

    function getEquilibria() {
      return getModel().equilibria(state.param);
    }

    function getSelectedEq() {
      const eqs = getEquilibria();
      const idx = Math.max(0, Math.min(eqs.length - 1, state.selectedEqIdx));
      return eqs[idx];
    }

    function setModel(key) {
      if (!M.NONLINEAR_MODELS[key]) return;
      state.modelKey = key;
      state.param = M.NONLINEAR_MODELS[key].defaultParam;
      state.selectedEqIdx = key === 'duffing' ? 1 : 0;
      state.customSeeds = [];
      render();
      notifyEq();
    }

    function setParam(val) {
      state.param = val;
      render();
      notifyEq();
    }

    function selectEq(idx) {
      const eqs = getEquilibria();
      state.selectedEqIdx = Math.max(0, Math.min(eqs.length - 1, idx));
      render();
      notifyEq();
    }

    function clearCustom() {
      state.customSeeds = [];
      render();
    }

    function notifyEq() {
      if (typeof onSelectEq === 'function') {
        const eq = getSelectedEq();
        const lin = M.analyzeLinear(eq.tau, eq.delta);
        onSelectEq(getModel(), state.param, eq, lin, state.selectedEqIdx);
      }
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

    function sharedXGeom(w, model) {
      const padL = 48;
      const padR = 18;
      const plotW = w - padL - padR;
      return {
        padL,
        padR,
        plotW,
        toX: (x) => padL + ((x - model.xMin) / (model.xMax - model.xMin)) * plotW,
        fromX: (px) => model.xMin + ((px - padL) / plotW) * (model.xMax - model.xMin)
      };
    }

    /* ---------------- Top Left: Potential Energy V(x) ---------------- */
    function renderPotential() {
      const { ctx, w, h } = Theme.setupHiDPI(potCanvas);
      const C = Theme.colors();
      const model = getModel();
      const gx = sharedXGeom(w, model);
      const padT = 24;
      const padB = 14;
      const plotH = h - padT - padB;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      // Compute V range
      const N = 160;
      let vMin = Infinity;
      let vMax = -Infinity;
      const vals = [];
      for (let i = 0; i <= N; i++) {
        const x = model.xMin + ((model.xMax - model.xMin) * i) / N;
        const V = model.potential(x);
        vals.push([x, V]);
        if (V < vMin) vMin = V;
        if (V > vMax) vMax = V;
      }
      const span = Math.max(0.4, vMax - vMin);
      const toY = (V) => padT + plotH - ((V - vMin) / span) * (plotH * 0.82) - plotH * 0.08;

      // Vertical equilibrium drop-lines aligned with phase portrait below
      const eqs = getEquilibria();
      eqs.forEach(function (eq, idx) {
        const ex = gx.toX(eq.x);
        const lin = M.analyzeLinear(eq.tau, eq.delta);
        const col =
          lin.stability === 'asymptotic' ? C.teal : lin.stability === 'lyapunov' ? C.amber : C.crimson;
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = idx === state.selectedEqIdx ? C.copper : col;
        ctx.lineWidth = idx === state.selectedEqIdx ? 1.8 : 1.0;
        ctx.beginPath();
        ctx.moveTo(ex, padT);
        ctx.lineTo(ex, h);
        ctx.stroke();
        ctx.restore();
      });

      // Potential curve
      ctx.beginPath();
      vals.forEach(function (pt, i) {
        const px = gx.toX(pt[0]);
        const py = toY(pt[1]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = C.navy;
      ctx.lineWidth = 2.3;
      ctx.stroke();

      // Equilibrium beads on V(x)
      eqs.forEach(function (eq, idx) {
        const ex = gx.toX(eq.x);
        const ey = toY(model.potential(eq.x));
        const lin = M.analyzeLinear(eq.tau, eq.delta);
        const col =
          lin.stability === 'asymptotic' ? C.teal : lin.stability === 'lyapunov' ? C.amber : C.crimson;
        if (idx === state.selectedEqIdx) {
          ctx.strokeStyle = C.copper;
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(ex, ey, 9.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = lin.stability === 'asymptotic' ? col : C.bg;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(ex, ey, 5.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      ctx.fillStyle = C.text;
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Potential energy V(x) — aligned with phase plane below', gx.padL, 15);
    }

    /* ---------------- Bottom Left: Global Nonlinear Phase Portrait ---------------- */
    function globalPhaseGeom(w, h, model) {
      const gx = sharedXGeom(w, model);
      const padT = 16;
      const padB = 30;
      const plotH = h - padT - padB;
      return {
        padL: gx.padL,
        padR: gx.padR,
        padT,
        padB,
        plotW: gx.plotW,
        plotH,
        toX: gx.toX,
        fromX: gx.fromX,
        toY: (v) => padT + ((model.vMax - v) / (model.vMax - model.vMin)) * plotH,
        fromY: (py) => model.vMax - ((py - padT) / plotH) * (model.vMax - model.vMin)
      };
    }

    function renderGlobalPhase() {
      const { ctx, w, h } = Theme.setupHiDPI(phaseCanvas);
      const C = Theme.colors();
      const model = getModel();
      const g = globalPhaseGeom(w, h, model);

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.beginPath();
      ctx.rect(g.padL, g.padT, g.plotW, g.plotH);
      ctx.clip();

      // Grid & axes
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let x = Math.ceil(model.xMin); x <= Math.floor(model.xMax); x++) {
        ctx.beginPath();
        ctx.moveTo(g.toX(x), g.padT);
        ctx.lineTo(g.toX(x), g.padT + g.plotH);
        ctx.stroke();
      }
      for (let v = Math.ceil(model.vMin); v <= Math.floor(model.vMax); v++) {
        ctx.beginPath();
        ctx.moveTo(g.padL, g.toY(v));
        ctx.lineTo(g.padL + g.plotW, g.toY(v));
        ctx.stroke();
      }

      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(g.padL, g.toY(0));
      ctx.lineTo(g.padL + g.plotW, g.toY(0));
      ctx.moveTo(g.toX(0), g.padT);
      ctx.lineTo(g.toX(0), g.padT + g.plotH);
      ctx.stroke();

      // Background direction field
      const nx = 15;
      const nv = 11;
      ctx.strokeStyle = Theme.isDark() ? 'rgba(169,182,191,0.30)' : 'rgba(19,36,51,0.22)';
      ctx.lineWidth = 1.0;
      for (let ix = 1; ix <= nx; ix++) {
        const x = model.xMin + ((model.xMax - model.xMin) * ix) / (nx + 1);
        for (let iv = 1; iv <= nv; iv++) {
          const v = model.vMin + ((model.vMax - model.vMin) * iv) / (nv + 1);
          const f = model.rhs(x, v, state.param);
          const mag = Math.hypot(f[0], f[1]);
          if (mag < 1e-4) continue;
          const px = g.toX(x);
          const py = g.toY(v);
          const len = Math.min(12, 4.5 + 2.8 * Math.log1p(mag));
          const ux = f[0] / mag;
          const uy = -f[1] / mag;
          ctx.beginPath();
          ctx.moveTo(px - 0.45 * len * ux, py - 0.45 * len * uy);
          ctx.lineTo(px + 0.55 * len * ux, py + 0.55 * len * uy);
          ctx.stroke();
          drawArrowHead(
            ctx,
            px + 0.55 * len * ux,
            py + 0.55 * len * uy,
            ux,
            uy,
            3.6,
            Theme.isDark() ? 'rgba(169,182,191,0.40)' : 'rgba(19,36,51,0.30)'
          );
        }
      }

      const bounds = { xLim: Math.max(Math.abs(model.xMax), Math.abs(model.xMin)) * 1.4, vLim: model.vMax * 1.6 };

      function drawCurve(pts, col, lw, withArrow) {
        if (pts.length < 2) return;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const px = g.toX(pts[i][0]);
          const py = g.toY(pts[i][1]);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.stroke();

        if (withArrow && pts.length > 24) {
          const k = Math.floor(pts.length * 0.28);
          const dx = g.toX(pts[k + 1][0]) - g.toX(pts[k - 1][0]);
          const dy = g.toY(pts[k + 1][1]) - g.toY(pts[k - 1][1]);
          const len = Math.hypot(dx, dy);
          if (len > 1.5) drawArrowHead(ctx, g.toX(pts[k + 1][0]), g.toY(pts[k + 1][1]), dx / len, dy / len, 6.0, col);
        }
      }

      // Pre-seeded global trajectories per model
      const trajCol = Theme.isDark() ? 'rgba(77, 190, 238, 0.72)' : 'rgba(0, 114, 189, 0.70)';
      let seeds = [];
      if (model.key === 'pendulum') {
        seeds = [
          [0.9, 0],
          [2.0, 0],
          [2.75, 0],
          [-2.6, 1.3],
          [-4.0, 2.3],
          [-4.0, 1.4],
          [4.0, -2.3],
          [4.0, -1.4]
        ];
      } else if (model.key === 'duffing') {
        seeds = [
          [-1.75, 0.85],
          [-1.5, -0.7],
          [-0.45, 0.4],
          [0.45, -0.4],
          [1.75, -0.85],
          [1.5, 0.7],
          [-0.2, 1.35],
          [0.2, -1.35]
        ];
      } else {
        seeds = [
          [1.55, 0],
          [0.95, 0],
          [0.45, 0],
          [-1.3, 0.8]
        ];
      }

      seeds.forEach(function (s) {
        const pts = M.integrateNonlinear(model, state.param, s[0], s[1], 0.035, 360, bounds);
        drawCurve(pts, trajCol, 1.45, true);
      });

      // Saddle invariant manifolds (separatrices) computed backward/forward from saddle eigendirections
      const eqs = getEquilibria();
      eqs.forEach(function (eq) {
        const lin = M.analyzeLinear(eq.tau, eq.delta);
        if (lin.regime !== 'saddle') return;
        const eps = 0.03;
        const evS = lin.eigenvectors[0]; // stable (integrate backward!)
        const evU = lin.eigenvectors[1]; // unstable (integrate forward!)
        [1, -1].forEach(function (sign) {
          const ptsS = M.integrateNonlinear(
            model,
            state.param,
            eq.x + sign * eps * evS.x,
            eq.v + sign * eps * evS.v,
            -0.03,
            280,
            bounds
          );
          drawCurve(ptsS, C.teal, 2.0, false);

          const ptsU = M.integrateNonlinear(
            model,
            state.param,
            eq.x + sign * eps * evU.x,
            eq.v + sign * eps * evU.v,
            0.03,
            280,
            bounds
          );
          drawCurve(ptsU, C.crimson, 1.8, false);
        });
      });

      // User-clicked custom trajectories
      state.customSeeds.forEach(function (s) {
        const pts = M.integrateNonlinear(model, state.param, s[0], s[1], 0.03, 460, bounds);
        drawCurve(pts, C.copper, 2.3, true);
        ctx.fillStyle = C.bg;
        ctx.strokeStyle = C.copper;
        ctx.lineWidth = 2.0;
        ctx.fillRect(g.toX(s[0]) - 4, g.toY(s[1]) - 4, 8, 8);
        ctx.strokeRect(g.toX(s[0]) - 4, g.toY(s[1]) - 4, 8, 8);
      });

      // Highlight selected equilibrium zoom box
      const selEq = getSelectedEq();
      const boxR = model.key === 'pendulum' ? 0.85 : 0.58;
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 1.6;
      const bx1 = g.toX(selEq.x - boxR);
      const bx2 = g.toX(selEq.x + boxR);
      const by1 = g.toY(selEq.v + boxR);
      const by2 = g.toY(selEq.v - boxR);
      ctx.strokeRect(bx1, by1, bx2 - bx1, by2 - by1);
      ctx.restore();

      // Equilibrium markers
      eqs.forEach(function (eq, idx) {
        const ex = g.toX(eq.x);
        const ey = g.toY(eq.v);
        const lin = M.analyzeLinear(eq.tau, eq.delta);
        const col =
          lin.stability === 'asymptotic' ? C.teal : lin.stability === 'lyapunov' ? C.amber : C.crimson;
        if (idx === state.selectedEqIdx) {
          ctx.strokeStyle = C.copper;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(ex, ey, 10, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = lin.stability === 'asymptotic' ? col : C.bg;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(ex, ey, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      ctx.restore();

      // Axis ticks & labels
      ctx.fillStyle = C.muted;
      ctx.font = '500 10.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      for (let x = Math.ceil(model.xMin); x <= Math.floor(model.xMax); x++) {
        ctx.fillText(String(x), g.toX(x), g.padT + g.plotH + 14);
      }
      ctx.textAlign = 'right';
      for (let v = Math.ceil(model.vMin); v <= Math.floor(model.vMax); v++) {
        ctx.fillText(String(v), g.padL - 6, g.toY(v) + 4);
      }

      ctx.fillStyle = C.text;
      ctx.font = '600 11px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(model.xLabel, g.padL + g.plotW, h - 4);
      ctx.textAlign = 'left';
      ctx.fillText(model.vLabel, 6, g.padT + 10);
    }

    /* ---------------- Right: Local Linearization Comparator ---------------- */
    function renderLocalZoom() {
      const { ctx, w, h } = Theme.setupHiDPI(localCanvas);
      const C = Theme.colors();
      const model = getModel();
      const eq = getSelectedEq();
      const lin = M.analyzeLinear(eq.tau, eq.delta);

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 44;
      const padR = 16;
      const padT = 30;
      const padB = 30;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const lim = model.key === 'nl_center' ? 1.45 : 0.85;
      const scale = Math.min(plotW, plotH) / (2 * lim);
      const cx = padL + plotW * 0.5;
      const cy = padT + plotH * 0.5;
      const toX = (dx) => cx + dx * scale;
      const toY = (dv) => cy - dv * scale;

      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      // Grid & local axes
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      const step = lim > 1 ? 0.5 : 0.4;
      for (let u = -2; u <= 2; u++) {
        ctx.beginPath();
        ctx.moveTo(toX(u * step), padT);
        ctx.lineTo(toX(u * step), padT + plotH);
        ctx.moveTo(padL, toY(u * step));
        ctx.lineTo(padL + plotW, toY(u * step));
        ctx.stroke();
      }
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(padL, cy);
      ctx.lineTo(padL + plotW, cy);
      ctx.moveTo(cx, padT);
      ctx.lineTo(cx, padT + plotH);
      ctx.stroke();

      // Linearized eigendirections
      lin.eigenvectors.forEach(function (ev) {
        const col =
          ev.role === 'stable' || ev.role === 'slow' ? C.teal : ev.role === 'unstable' || ev.role === 'fast' ? C.crimson : C.purple;
        const R = lim * 2.2;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(toX(-ev.x * R), toY(-ev.v * R));
        ctx.lineTo(toX(ev.x * R), toY(ev.v * R));
        ctx.stroke();
        ctx.restore();
      });

      // Local perturbation seeds: compare exact nonlinear (solid blue) vs linear J(x*) (dashed orange)
      const rSeed = model.key === 'nl_center' ? 1.05 : 0.48;
      const localSeeds =
        model.key === 'nl_center'
          ? [[rSeed, 0]]
          : [
              [rSeed, 0],
              [-rSeed, 0],
              [0, rSeed],
              [0, -rSeed],
              [0.72 * rSeed, 0.72 * rSeed],
              [-0.72 * rSeed, -0.72 * rSeed]
            ];

      const nSteps = model.key === 'nl_center' ? 900 : 220;
      const dt = 0.025;
      const bnd = { xLim: Math.abs(eq.x) + lim * 3.5, vLim: lim * 3.5 };

      localSeeds.forEach(function (dz0) {
        // 1. Linearized trajectory (dashed orange)
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = C.orange;
        ctx.lineWidth = 1.9;
        ctx.beginPath();
        let started = false;
        const tTotal = nSteps * dt;
        const samples = 180;
        for (let i = 0; i <= samples; i++) {
          const ti = (tTotal * i) / samples;
          const dz = M.evalFlow(lin, dz0, ti);
          if (Math.abs(dz[0]) > lim * 1.9 || Math.abs(dz[1]) > lim * 1.9) {
            if (started) break;
            continue;
          }
          const px = toX(dz[0]);
          const py = toY(dz[1]);
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
        ctx.restore();

        // 2. True nonlinear trajectory (solid blue)
        const nlPts = M.integrateNonlinear(model, state.param, eq.x + dz0[0], eq.v + dz0[1], dt, nSteps, bnd);
        ctx.beginPath();
        let startedNl = false;
        for (let i = 0; i < nlPts.length; i++) {
          const dx = nlPts[i][0] - eq.x;
          const dv = nlPts[i][1] - eq.v;
          if (Math.abs(dx) > lim * 1.9 || Math.abs(dv) > lim * 1.9) {
            if (startedNl) break;
            continue;
          }
          const px = toX(dx);
          const py = toY(dv);
          if (!startedNl) {
            ctx.moveTo(px, py);
            startedNl = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.strokeStyle = C.blue;
        ctx.lineWidth = 2.0;
        ctx.stroke();

        // Seed dot
        ctx.fillStyle = C.copper;
        ctx.beginPath();
        ctx.arc(toX(dz0[0]), toY(dz0[1]), 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Equilibrium center marker
      const eqCol =
        lin.stability === 'asymptotic' ? C.teal : lin.stability === 'lyapunov' ? C.amber : C.crimson;
      ctx.fillStyle = lin.stability === 'asymptotic' ? eqCol : C.bg;
      ctx.strokeStyle = eqCol;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(cx, cy, 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();

      // Header & axes
      ctx.fillStyle = C.text;
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Local zoom: ' + eq.label, padL, 18);

      ctx.textAlign = 'right';
      ctx.font = '600 11px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.blue;
      ctx.fillText('— Nonlinear', padL + plotW - 92, 18);
      ctx.fillStyle = C.orange;
      ctx.fillText('-- Linear J(x*)', padL + plotW, 18);

      ctx.fillStyle = C.text;
      ctx.font = '600 11px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('δx = x − x*', padL + plotW, h - 8);
      ctx.textAlign = 'left';
      ctx.fillText('δv', 10, padT + 12);
    }

    function render() {
      renderPotential();
      renderGlobalPhase();
      renderLocalZoom();
    }

    // Click on global phase portrait: if near an equilibrium, select it; otherwise launch trajectory
    phaseCanvas.style.cursor = 'crosshair';
    phaseCanvas.addEventListener('pointerdown', function (e) {
      const rect = phaseCanvas.getBoundingClientRect();
      const model = getModel();
      const g = globalPhaseGeom(rect.width, rect.height, model);
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      // Check proximity to equilibrium markers first
      const eqs = getEquilibria();
      for (let i = 0; i < eqs.length; i++) {
        const d = Math.hypot(px - g.toX(eqs[i].x), py - g.toY(eqs[i].v));
        if (d < 16) {
          selectEq(i);
          return;
        }
      }

      const x = g.fromX(px);
      const v = g.fromY(py);
      if (x >= model.xMin && x <= model.xMax && v >= model.vMin && v <= model.vMax) {
        state.customSeeds.push([x, v]);
        if (state.customSeeds.length > 6) state.customSeeds.shift();
        render();
      }
    });

    render();
    notifyEq();

    return {
      setModel,
      setParam,
      selectEq,
      clearCustom,
      render,
      getModel,
      getParam: () => state.param,
      getSelectedEq
    };
  }

  return { create };
})();
