/**
 * viz-superpos.js
 * Section 3 visualization for Module 06 (beam-modal-geometry):
 * - Top canvas: Live animated N-mode superposition w(xi, t) = sum_{n=1}^N q_n(0) cos(w_n t) phi_n(xi)
 *               against the dashed initial shape w_0(xi), with interactive pluck point xi_0!
 * - Bottom canvas: Modal participation bar chart |q_n(0)| and modal energy share E_n / E_tot,
 *                  demonstrating nodal-point suppression (plucking at a node of Mode n zeroes q_n).
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathBeam;
  const Theme = window.VibLab.Theme;

  function createSuperposViz(opts) {
    const superCanvas = document.getElementById(opts.superCanvasId);
    const specCanvas = document.getElementById(opts.specCanvasId);
    let sys = opts.sys;

    const state = {
      kind: 'pluck', // 'pluck' | 'bump' | 'uniform'
      xi0: 0.5,
      nTerms: 5,
      t: 0,
      playing: true,
      proj: null
    };

    function recompute() {
      state.proj = M.computeModalProjection(sys, state.kind, state.xi0);
      if (opts.onProjectionChange) opts.onProjectionChange(state.proj, state);
      render();
    }

    function setSystem(newSys) {
      sys = newSys;
      state.t = 0;
      recompute();
    }

    function setParams(p) {
      if (p.kind !== undefined) state.kind = p.kind;
      if (p.xi0 !== undefined) state.xi0 = Math.max(0.12, Math.min(0.88, p.xi0));
      if (p.nTerms !== undefined) state.nTerms = Math.max(1, Math.min(M.N_MODES, p.nTerms));
      recompute();
    }

    function setPlaying(p) {
      state.playing = !!p;
    }

    function resetTime() {
      state.t = 0;
      render();
    }

    function step(dt) {
      if (!state.playing) return;
      // Base speed scaled so fundamental mode oscillates smoothly (~0.45 Hz visual)
      state.t += dt * 2.8;
      drawSuperCanvas();
    }

    function drawSuperCanvas() {
      if (!superCanvas || !state.proj) return;
      const { ctx, w, h } = Theme.setupCanvas(superCanvas);
      const C = Theme.get();
      const proj = state.proj;

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 38;
      const padR = 38;
      const beamW = w - padL - padR;
      const midY = h * 0.54;
      const ampPx = h * 0.30;

      const toX = (xi) => padL + xi * beamW;
      const toY = (v) => midY - v * ampPx;

      // Neutral axis
      ctx.save();
      ctx.strokeStyle = C.ref;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(padL, midY);
      ctx.lineTo(padL + beamW, midY);
      ctx.stroke();
      ctx.restore();

      const N = 220;

      // Dashed target initial shape w_0(xi)
      ctx.save();
      ctx.strokeStyle = C.ref;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const xi = i / N;
        const px = toX(xi);
        const py = toY(proj.targetFn(xi));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // Modal superposition w_N(xi, t)
      const evalSum = (xi) => {
        let sum = 0;
        for (let k = 0; k < state.nTerms; k++) {
          const m = sys.modes[k];
          sum += proj.q0[k] * Math.cos(m.omegaRel * state.t) * m.eval(xi);
        }
        return sum;
      };

      ctx.save();
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 3.0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const xi = i / N;
        const px = toX(xi);
        const py = toY(evalSum(xi));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // Pluck/excitation marker at xi0
      if (state.kind !== 'uniform') {
        const px0 = toX(state.xi0);
        ctx.save();
        ctx.strokeStyle = C.teal;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(px0, 26);
        ctx.lineTo(px0, h - 18);
        ctx.stroke();
        ctx.restore();
        Theme.drawMath(
          ctx,
          [{ t: 'ξ', i: true, bold: true }, { t: '0', sub: true, bold: true }, { t: ' = ' + M.fmt(state.xi0, 2), bold: true }],
          px0 + 6,
          34,
          { size: 11, color: C.teal, align: 'left', family: '"IBM Plex Mono", monospace' }
        );
      }

      // Supports
      const leftY = sys.info.leftEnd === 'free' ? toY(evalSum(0)) : midY;
      const rightY = sys.info.rightEnd === 'free' ? toY(evalSum(1)) : midY;
      Theme.drawSupport(ctx, padL, leftY, sys.info.leftEnd, -1, C);
      Theme.drawSupport(ctx, padL + beamW, rightY, sys.info.rightEnd, +1, C);

      // Header
      Theme.drawMath(
        ctx,
        [
          { t: 'Superposition of first ' + state.nTerms + ' mode' + (state.nTerms > 1 ? 's' : '') + ' (copper) vs. initial shape ', bold: true },
          { t: 'w', i: true, bold: true },
          { t: '0', sub: true, bold: true },
          { t: ' (dashed)', bold: true }
        ],
        14,
        15,
        { size: 11.5, color: C.text, align: 'left' }
      );
    }

    function drawSpecCanvas() {
      if (!specCanvas || !state.proj) return;
      const { ctx, w, h } = Theme.setupCanvas(specCanvas);
      const C = Theme.get();
      const proj = state.proj;

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 52;
      const padR = 20;
      const padT = 26;
      const padB = 34;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      const maxQ = Math.max(0.5, ...proj.q0.map(Math.abs)) * 1.15;
      const groupW = plotW / M.N_MODES;

      for (let k = 0; k < M.N_MODES; k++) {
        const gx = padL + k * groupW;
        const barW = Math.min(34, groupW * 0.28);
        const included = k < state.nTerms;

        // Bar 1: |q_n(0)| normalized to maxQ
        const qAbs = Math.abs(proj.q0[k]);
        const h1 = (qAbs / maxQ) * (plotH * 0.86);
        ctx.fillStyle = included ? C.blue : C.ref;
        ctx.globalAlpha = included ? 0.9 : 0.35;
        ctx.fillRect(gx + groupW * 0.5 - barW - 3, padT + plotH - h1, barW, h1);

        // Bar 2: Energy share E_n / E_tot
        const eShare = proj.energyShares[k];
        const h2 = eShare * (plotH * 0.86);
        ctx.fillStyle = included ? C.orange : C.ref;
        ctx.fillRect(gx + groupW * 0.5 + 3, padT + plotH - h2, barW, h2);
        ctx.globalAlpha = 1.0;

        // Value labels above bars
        ctx.fillStyle = C.textMuted;
        ctx.font = '500 9.5px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(M.fmt(qAbs, 2), gx + groupW * 0.5 - barW * 0.5 - 3, padT + plotH - h1 - 3);
        ctx.fillText(M.fmt(eShare * 100, 0) + '%', gx + groupW * 0.5 + barW * 0.5 + 3, padT + plotH - h2 - 3);

        // Mode label underneath
        Theme.drawMath(
          ctx,
          [{ t: 'Mode ' + (k + 1), bold: included }],
          gx + groupW * 0.5,
          padT + plotH + 14,
          { size: 11, color: included ? C.text : C.textMuted, align: 'center' }
        );
      }

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      Theme.drawMath(
        ctx,
        [
          { t: 'Blue: modal amplitude |', bold: true },
          { t: 'q', i: true, bold: true },
          { t: 'n', sub: true, bold: true },
          { t: '(0)|   ·   Orange: modal strain energy share ', bold: true },
          { t: 'E', i: true, bold: true },
          { t: 'n', sub: true, bold: true },
          { t: ' / ', bold: true },
          { t: 'E', i: true, bold: true },
          { t: 'tot', sub: true, bold: true }
        ],
        padL,
        padT - 12,
        { size: 11, color: C.textMuted, align: 'left' }
      );
    }

    function render() {
      drawSuperCanvas();
      drawSpecCanvas();
    }

    recompute();

    return {
      setSystem,
      setParams,
      setPlaying,
      isPlaying: () => state.playing,
      resetTime,
      step,
      render
    };
  }

  window.VibLab.VizSuperpos = { create: createSuperposViz };
})();
