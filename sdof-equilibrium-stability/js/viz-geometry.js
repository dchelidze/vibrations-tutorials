/**
 * viz-geometry.js
 * Section 4: Geometric insights — Liouville phase-space area evolution
 * S(t) = S(0) * exp(tau * t) paired with Canonical Modal Coordinates y = P^{-1} z.
 */
window.VibLab = window.VibLab || {};

window.VibLab.GeometryViz = (function () {
  'use strict';

  const M = window.VibLab.MathStab;
  const Theme = window.VibLab.Theme;

  function create(opts) {
    const areaCanvas = opts.areaCanvas;
    const modalCanvas = opts.modalCanvas;
    const onTimeUpdate = opts.onTimeUpdate;

    const state = {
      sys: opts.sys,
      t: 0.65,
      tMax: 2.2,
      playing: false,
      visible: true,
      patchShape: 'square' // 'square' | 'circle'
    };

    function buildBasePatch() {
      const cx = 0.95;
      const cy = 0.35;
      const r = 0.38;
      const pts = [];
      if (state.patchShape === 'square') {
        const seg = 10;
        const corners = [
          [cx - r, cy - r],
          [cx + r, cy - r],
          [cx + r, cy + r],
          [cx - r, cy + r]
        ];
        for (let c = 0; c < 4; c++) {
          const a = corners[c];
          const b = corners[(c + 1) % 4];
          for (let i = 0; i < seg; i++) {
            const u = i / seg;
            pts.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
          }
        }
      } else {
        const N = 48;
        for (let i = 0; i < N; i++) {
          const ang = (2 * Math.PI * i) / N;
          pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
        }
      }
      return pts;
    }

    function updateTimeCap() {
      const sys = state.sys;
      const maxPos = Math.max(sys.l1.re, sys.l2.re, 0);
      if (maxPos > 0.25) {
        state.tMax = Math.max(0.8, Math.min(2.4, 1.35 / maxPos));
      } else {
        state.tMax = 2.6;
      }
      if (state.t > state.tMax) state.t = state.tMax * 0.45;
    }
    updateTimeCap();

    function setSystem(sys) {
      state.sys = sys;
      updateTimeCap();
      render();
      notifyReadout();
    }

    function setTime(t) {
      state.t = Math.max(0, Math.min(state.tMax, t));
      render();
      notifyReadout();
    }

    function setShape(shape) {
      state.patchShape = shape;
      render();
      notifyReadout();
    }

    function setPlaying(p) {
      state.playing = !!p;
    }

    function setVisible(v) {
      state.visible = !!v;
    }

    function step(dt) {
      if (!state.visible || !state.playing) return;
      state.t += dt * 0.48;
      if (state.t > state.tMax) state.t = 0;
      render();
      notifyReadout();
    }

    function notifyReadout() {
      if (typeof onTimeUpdate !== 'function') return;
      const base = buildBasePatch();
      const s0 = M.polygonArea(base);
      const moved = base.map((p) => M.evalFlow(state.sys, p, state.t));
      const stNum = M.polygonArea(moved);
      const stExact = s0 * Math.exp(state.sys.tau * state.t);
      onTimeUpdate({
        t: state.t,
        tMax: state.tMax,
        s0: s0,
        stNum: stNum,
        stExact: stExact,
        ratio: stExact / Math.max(1e-9, s0)
      });
    }

    function drawCoordPlane(ctx, w, h, lim, xLabel, yLabel, titleText, subText) {
      const C = Theme.colors();
      const padL = 42;
      const padR = 16;
      const padT = 30;
      const padB = 30;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const scale = Math.min(plotW, plotH) / (2 * lim);
      const cx = padL + plotW * 0.5;
      const cy = padT + plotH * 0.5;
      const toX = (x) => cx + x * scale;
      const toY = (y) => cy - y * scale;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      const tickStep = lim > 3.5 ? 2 : 1;
      for (let v = -Math.floor(lim); v <= Math.floor(lim); v += tickStep) {
        ctx.beginPath();
        ctx.moveTo(toX(v), padT);
        ctx.lineTo(toX(v), padT + plotH);
        ctx.moveTo(padL, toY(v));
        ctx.lineTo(padL + plotW, toY(v));
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

      ctx.restore();

      ctx.fillStyle = C.text;
      ctx.font = '600 12px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(titleText, padL, 18);

      ctx.fillStyle = C.muted;
      ctx.font = '500 11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(subText, padL + plotW, 18);

      ctx.font = '600 11px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.text;
      ctx.textAlign = 'right';
      ctx.fillText(xLabel, padL + plotW, h - 8);
      ctx.textAlign = 'left';
      ctx.fillText(yLabel, 6, padT + 12);

      return { padL, padR, padT, padB, plotW, plotH, cx, cy, scale, toX, toY };
    }

    function renderAreaCanvas() {
      const { ctx, w, h } = Theme.setupHiDPI(areaCanvas);
      const C = Theme.colors();
      const sys = state.sys;
      const base = buildBasePatch();
      const moved = base.map((p) => M.evalFlow(sys, p, state.t));

      let maxCoord = 2.4;
      moved.forEach(function (p) {
        if (Number.isFinite(p[0]) && Number.isFinite(p[1])) {
          maxCoord = Math.max(maxCoord, Math.min(7.5, Math.abs(p[0]) * 1.15), Math.min(7.5, Math.abs(p[1]) * 1.15));
        }
      });

      const s0 = M.polygonArea(base);
      const ratio = Math.exp(sys.tau * state.t);
      const g = drawCoordPlane(
        ctx,
        w,
        h,
        maxCoord,
        'x',
        'v',
        'Physical phase space (x, v)',
        'S(t)/S(0) = e^(τt) = ' + M.fmt(ratio, 2)
      );

      ctx.save();
      ctx.beginPath();
      ctx.rect(g.padL, g.padT, g.plotW, g.plotH);
      ctx.clip();

      // Eigendirections softly in background
      sys.eigenvectors.forEach(function (ev) {
        const col =
          ev.role === 'stable' || ev.role === 'slow' || ev.role === 'zero'
            ? C.teal
            : ev.role === 'unstable' || ev.role === 'fast' || ev.role === 'nonzero'
              ? C.crimson
              : C.purple;
        const R = maxCoord * 2.2;
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(g.toX(-ev.x * R), g.toY(-ev.v * R));
        ctx.lineTo(g.toX(ev.x * R), g.toY(ev.v * R));
        ctx.stroke();
        ctx.restore();
      });

      // Trails of 4 reference vertices from 0 to t
      const trailIdx = [0, Math.floor(base.length * 0.25), Math.floor(base.length * 0.5), Math.floor(base.length * 0.75)];
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 1.2;
      trailIdx.forEach(function (idx) {
        ctx.beginPath();
        const steps = 45;
        for (let k = 0; k <= steps; k++) {
          const tk = (state.t * k) / steps;
          const z = M.evalFlow(sys, base[idx], tk);
          const px = g.toX(z[0]);
          const py = g.toY(z[1]);
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      });

      // Initial patch S(0) dashed
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = C.ref;
      ctx.fillStyle = Theme.isDark() ? 'rgba(143,155,166,0.12)' : 'rgba(138,133,120,0.11)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      base.forEach(function (p, i) {
        if (i === 0) ctx.moveTo(g.toX(p[0]), g.toY(p[1]));
        else ctx.lineTo(g.toX(p[0]), g.toY(p[1]));
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Evolved patch S(t)
      ctx.fillStyle = C.patchFill;
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      moved.forEach(function (p, i) {
        if (i === 0) ctx.moveTo(g.toX(p[0]), g.toY(p[1]));
        else ctx.lineTo(g.toX(p[0]), g.toY(p[1]));
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Label S(0) and S(t)
      ctx.fillStyle = C.muted;
      ctx.font = '600 11px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('S(0) = ' + M.fmt(s0, 2), g.toX(0.95), g.toY(0.84));

      const centroid = M.evalFlow(sys, [0.95, 0.35], state.t);
      if (Math.abs(centroid[0]) < maxCoord * 0.9 && Math.abs(centroid[1]) < maxCoord * 0.9) {
        ctx.fillStyle = C.copper;
        ctx.fillText('S(t)', g.toX(centroid[0]), g.toY(centroid[1]) + 4);
      }

      ctx.restore();
    }

    function renderModalCanvas() {
      const { ctx, w, h } = Theme.setupHiDPI(modalCanvas);
      const C = Theme.colors();
      const sys = state.sys;
      const basis = M.canonicalBasis(sys);

      const basePhys = buildBasePatch();
      const baseModal = basePhys.map((p) => basis.toModal(p));
      const movedModal = basePhys.map((p) => basis.toModal(M.evalFlow(sys, p, state.t)));

      let maxM = 2.4;
      baseModal.concat(movedModal).forEach(function (p) {
        if (Number.isFinite(p[0]) && Number.isFinite(p[1])) {
          maxM = Math.max(maxM, Math.min(8.5, Math.abs(p[0]) * 1.2), Math.min(8.5, Math.abs(p[1]) * 1.2));
        }
      });

      const subMap = {
        diagonal: 'A_can = diag(λ₁, λ₂)',
        rotation_scaling: 'A_can = [[σ, ω], [−ω, σ]]',
        jordan: 'A_can = [[λ, 1], [0, λ]]',
        star: 'A_can = λI (isotropic)'
      };

      const g = drawCoordPlane(
        ctx,
        w,
        h,
        maxM,
        'y₁',
        'y₂',
        basis.label,
        subMap[basis.kind] || ''
      );

      ctx.save();
      ctx.beginPath();
      ctx.rect(g.padL, g.padT, g.plotW, g.plotH);
      ctx.clip();

      // Highlight canonical axes as decoupled modal directions
      if (basis.kind === 'diagonal') {
        ctx.strokeStyle = C.teal;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(g.padL, g.cy);
        ctx.lineTo(g.padL + g.plotW, g.cy);
        ctx.stroke();

        ctx.strokeStyle = C.crimson;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(g.cx, g.padT);
        ctx.lineTo(g.cx, g.padT + g.plotH);
        ctx.stroke();
      } else if (basis.kind === 'rotation_scaling') {
        // Concentric reference circles to show pure rotation+scaling
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = C.ref;
        ctx.lineWidth = 1.2;
        [0.8, 1.6, 2.4].forEach(function (r) {
          if (r < maxM) {
            ctx.beginPath();
            ctx.arc(g.cx, g.cy, r * g.scale, 0, Math.PI * 2);
            ctx.stroke();
          }
        });
        ctx.restore();
      }

      // Family of modal trajectories
      const trajCol = Theme.isDark() ? 'rgba(77, 190, 238, 0.72)' : 'rgba(0, 114, 189, 0.70)';
      const nSeeds = 8;
      for (let i = 0; i < nSeeds; i++) {
        const ang = (2 * Math.PI * i) / nSeeds + 0.32;
        const y0 = [1.55 * Math.cos(ang), 1.55 * Math.sin(ang)];
        const z0 = basis.toPhys(y0);
        const tB = sys.regime === 'saddle' ? -1.8 : sys.tau < 0 ? -0.4 : -3.5;
        const tF = sys.regime === 'center' ? (2 * Math.PI) / Math.max(0.25, Math.sqrt(sys.delta)) : sys.regime === 'saddle' ? 1.8 : sys.tau < 0 ? 3.8 : 0.6;
        ctx.beginPath();
        let started = false;
        const steps = 90;
        for (let k = 0; k <= steps; k++) {
          const tk = tB + ((tF - tB) * k) / steps;
          const yk = basis.toModal(M.evalFlow(sys, z0, tk));
          if (!Number.isFinite(yk[0]) || !Number.isFinite(yk[1])) continue;
          if (Math.abs(yk[0]) > maxM * 1.8 || Math.abs(yk[1]) > maxM * 1.8) {
            if (started && tk > 0) break;
            continue;
          }
          const px = g.toX(yk[0]);
          const py = g.toY(yk[1]);
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.strokeStyle = trajCol;
        ctx.lineWidth = 1.45;
        ctx.stroke();
      }

      // Initial patch in modal coordinates (dashed)
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = C.ref;
      ctx.fillStyle = Theme.isDark() ? 'rgba(143,155,166,0.12)' : 'rgba(138,133,120,0.11)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      baseModal.forEach(function (p, i) {
        if (i === 0) ctx.moveTo(g.toX(p[0]), g.toY(p[1]));
        else ctx.lineTo(g.toX(p[0]), g.toY(p[1]));
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Evolved patch in modal coordinates
      ctx.fillStyle = C.patchFill;
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      movedModal.forEach(function (p, i) {
        if (i === 0) ctx.moveTo(g.toX(p[0]), g.toY(p[1]));
        else ctx.lineTo(g.toX(p[0]), g.toY(p[1]));
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    function render() {
      renderAreaCanvas();
      renderModalCanvas();
    }

    render();
    notifyReadout();

    return {
      setSystem,
      setTime,
      setShape,
      setPlaying,
      setVisible,
      step,
      render,
      getTimeCap: () => state.tMax
    };
  }

  return { create };
})();
