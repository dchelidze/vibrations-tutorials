/**
 * viz-stickslip.js
 * Section 3 visualization for Module 08 (sdof-damping-hysteresis):
 * Exact piecewise-analytical Coulomb free-decay phase portrait & linear ring-down!
 * - Left canvas: Phase plane (u, u') showing exact alternating semicircular arcs centered
 *                at +delta (lower half, v < 0) and -delta (upper half, v > 0), terminating
 *                dead inside the shaded sticking dead zone [-delta, +delta]!
 * - Right canvas: Time history u(tau) showing straight-line Coulomb envelope (dropping by
 *                 4*delta per cycle and halting at finite time t_stop) vs. dashed exponential viscous decay!
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathDamping;
  const Theme = window.VibLab.Theme;

  function createStickSlipViz(opts) {
    const phaseCanvas = document.getElementById(opts.phaseCanvasId);
    const decayCanvas = document.getElementById(opts.decayCanvasId);
    let params = opts.params;
    let sim = null;

    function setParams(p) {
      params = p;
      sim = M.simulateCoulombFree(params.u0, params.delta);
      render();
    }

    function drawPhase() {
      if (!phaseCanvas || !sim) return;
      const { ctx, w, h } = Theme.setupCanvas(phaseCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const range = Math.max(1.4, params.u0 * 1.18);
      const pad = 34;
      const scale = Math.min((w - 2 * pad) / (2 * range), (h - 2 * pad - 20) / (2 * range));
      const cx = w * 0.5;
      const cy = h * 0.53;
      const toX = (u) => cx + u * scale;
      const toY = (v) => cy - v * scale;

      // Shaded sticking dead zone [-delta, +delta] along v = 0
      const d = params.delta;
      ctx.fillStyle = C.dark ? 'rgba(237,177,32,0.16)' : 'rgba(237,177,32,0.18)';
      ctx.fillRect(toX(-d), 28, toX(d) - toX(-d), h - 50);

      // Axes
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(16, cy);
      ctx.lineTo(w - 16, cy);
      ctx.moveTo(cx, 28);
      ctx.lineTo(cx, h - 22);
      ctx.stroke();

      // Thick dead-zone segment on v = 0
      ctx.strokeStyle = C.amber;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(toX(-d), cy);
      ctx.lineTo(toX(d), cy);
      ctx.stroke();

      // Mark shifted centers +delta and -delta cleanly above the band so they never collide with u_stop
      [d, -d].forEach((cVal, idx) => {
        ctx.fillStyle = C.amber;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(toX(cVal), cy, 4.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        Theme.drawMath(ctx, [{ t: idx === 0 ? '+δ' : '−δ', bold: true }], toX(cVal) + (idx === 0 ? 5 : -5), 39, {
          size: 10.5,
          color: C.amber,
          align: idx === 0 ? 'left' : 'right'
        });
      });

      // Reference viscous spiral (dashed blue) with matched initial energy loss
      const zMatch = (2 * d) / (Math.PI * Math.max(0.5, params.u0));
      const wd = Math.sqrt(Math.max(0.05, 1 - zMatch * zMatch));
      ctx.save();
      ctx.strokeStyle = C.blue;
      ctx.globalAlpha = 0.45;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i <= 260; i++) {
        const t = (sim.tEnd * i) / 260;
        const dec = Math.exp(-zMatch * t);
        const u = params.u0 * dec * (Math.cos(wd * t) + (zMatch / wd) * Math.sin(wd * t));
        const v = -params.u0 * dec * (Math.sin(wd * t) / wd);
        const px = toX(u);
        const py = toY(v);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // Exact piecewise semicircular Coulomb trajectory (crimson)
      ctx.save();
      ctx.strokeStyle = C.crimson;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      sim.samples.forEach((pt, idx) => {
        const px = toX(pt.u);
        const py = toY(pt.v);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.restore();

      // Start dot (u0, 0) & terminal stuck point (uStop, 0)
      ctx.fillStyle = C.teal;
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(toX(params.u0), cy, 5.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = C.crimson;
      ctx.beginPath();
      ctx.arc(toX(sim.uStop), cy, 6.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      Theme.drawMath(ctx, [{ t: 'u', i: true, bold: true }], w - 18, cy - 10, { size: 11.5, color: C.textMuted, align: 'right' });
      Theme.drawMath(ctx, [{ t: 'u̇', i: true, bold: true }], cx + 8, 34, { size: 11.5, color: C.textMuted, align: 'left' });

      Theme.drawMath(
        ctx,
        [{ t: 'Shifted semicircles halt in dead zone [−δ, +δ] at ', bold: true }, { t: 'u', i: true, bold: true }, { t: 'stop', sub: true, bold: true }, { t: ' = ' + M.fmt(sim.uStop, 2), bold: true }],
        12,
        15,
        { size: 11, color: C.crimson, align: 'left' }
      );
    }

    function drawDecay() {
      if (!decayCanvas || !sim) return;
      const { ctx, w, h } = Theme.setupCanvas(decayCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 48;
      const padR = 20;
      const padT = 26;
      const padB = 36;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const uMax = params.u0 * 1.15;
      const tEnd = sim.tEnd;
      const toX = (t) => padL + (t / tEnd) * plotW;
      const midY = padT + plotH * 0.5;
      const toY = (u) => midY - (u / uMax) * (plotH * 0.45);

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      // Shaded dead-zone band [-delta, +delta]
      ctx.fillStyle = C.dark ? 'rgba(237,177,32,0.14)' : 'rgba(237,177,32,0.16)';
      ctx.fillRect(padL, toY(params.delta), plotW, toY(-params.delta) - toY(params.delta));

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, midY);
      ctx.lineTo(padL + plotW, midY);
      ctx.stroke();

      // Straight-line Coulomb envelope u0 - (2 delta / pi) * tau
      const slope = (2 * params.delta) / Math.PI;
      const tZero = params.u0 / Math.max(1e-6, slope);
      [1, -1].forEach((sgn) => {
        ctx.save();
        ctx.strokeStyle = C.amber;
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(toX(0), toY(sgn * params.u0));
        ctx.lineTo(toX(Math.min(tEnd, tZero)), toY(sgn * Math.max(0, params.u0 - slope * Math.min(tEnd, tZero))));
        ctx.stroke();
        ctx.restore();
      });

      // Viscous comparison waveform (dashed blue)
      const zMatch = (2 * params.delta) / (Math.PI * Math.max(0.5, params.u0));
      const wd = Math.sqrt(Math.max(0.05, 1 - zMatch * zMatch));
      ctx.save();
      ctx.strokeStyle = C.blue;
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= 260; i++) {
        const t = (tEnd * i) / 260;
        const dec = Math.exp(-zMatch * t);
        const u = params.u0 * dec * (Math.cos(wd * t) + (zMatch / wd) * Math.sin(wd * t));
        const px = toX(t);
        const py = toY(u);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // Exact Coulomb response (crimson)
      ctx.strokeStyle = C.crimson;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      sim.samples.forEach((pt, idx) => {
        const px = toX(pt.t);
        const py = toY(pt.u);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      // Vertical stop-time line
      const xStop = toX(sim.tStop);
      ctx.save();
      ctx.strokeStyle = C.crimson;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(xStop, padT);
      ctx.lineTo(xStop, padT + plotH);
      ctx.stroke();
      ctx.restore();
      Theme.drawMath(ctx, [{ t: 'τ', bold: true }, { t: 'stop', sub: true, bold: true }, { t: ' = ' + M.fmt(sim.tStop, 1), bold: true }], xStop + 5, padT + 14, {
        size: 10.5,
        color: C.crimson,
        align: 'left',
        family: '"IBM Plex Mono", monospace'
      });

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      Theme.drawMath(ctx, [{ t: 'Dimensionless time τ = ω', bold: true }, { t: 'n', sub: true, bold: true }, { t: 't', i: true, bold: true }], padL + plotW * 0.5, h - 10, {
        size: 11,
        color: C.text,
        align: 'center'
      });
      Theme.drawMath(ctx, [{ t: 'Linear Coulomb decay (crimson, −4δ/cycle) vs. viscous (dashed blue)', bold: true }], padL, padT - 11, {
        size: 10.5,
        color: C.textMuted,
        align: 'left'
      });
    }

    function render() {
      drawPhase();
      drawDecay();
    }

    setParams(params);
    return { setParams, getSim: () => sim, render };
  }

  window.VibLab.VizStickSlip = { create: createStickSlipViz };
})();
