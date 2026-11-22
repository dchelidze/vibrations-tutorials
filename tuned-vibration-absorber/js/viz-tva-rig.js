/**
 * viz-tva-rig.js
 * Section 1 visualization for Module 05 (tuned-vibration-absorber):
 * - Left canvas: Live animated primary mass m1 + absorber mass ma driven harmonically
 *                by F0 cos(w t), showing live opposing reaction force arrow Fa vs drive F0.
 *                Right at r = beta (with zetaA = 0), m1 freezes completely still!
 * - Right canvas: Complex force-balance phasor diagram on m1:
 *                 F_prim = (1 - r^2) X1/Xst  =  F0 + Fa
 *                 showing Fa rotating into exact 180-deg opposition to F0 at r = beta!
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathTVA;
  const Theme = window.VibLab.Theme;

  function createTVARigViz(opts) {
    const rigCanvas = document.getElementById(opts.rigCanvasId);
    const phasorCanvas = document.getElementById(opts.phasorCanvasId);
    let sys = opts.sys;

    const state = {
      phaseTime: 0,
      playing: true
    };

    function setSystem(newSys) {
      sys = newSys;
      render();
    }

    function setPlaying(p) {
      state.playing = !!p;
    }

    function step(dt) {
      if (!state.playing) return;
      const visSpeed = Math.min(7.5, Math.max(2.0, sys.rDrive * 3.4));
      state.phaseTime += dt * visSpeed;
      render();
    }

    function drawRig() {
      if (!rigCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(rigCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const res = M.evalTVA(sys.mu, sys.beta, sys.zetaA, sys.rDrive);
      const maxAmp = Math.max(res.M1, res.Ma, 1.5);
      // Compress large near-resonant amplitudes smoothly so rig never leaves canvas
      const dispScale = Math.min(34, h * 0.11) / Math.min(maxAmp, 14);
      const x1 = Math.max(-44, Math.min(44, res.M1 * Math.cos(state.phaseTime + res.ph1) * dispScale));
      const xa = Math.max(-52, Math.min(52, res.Ma * Math.cos(state.phaseTime + res.phA) * dispScale));

      const cx = w * 0.5;
      const baseY = h - 32;
      const m1RestY = h * 0.60;
      const maRestY = h * 0.25;
      const m1Y = m1RestY - x1;
      const maY = maRestY - xa;

      const m1W = 122;
      const m1H = 54;
      const maW = Math.max(92, Math.min(116, 86 + sys.mu * 80));
      const maH = 44;

      // Ground base with hatching
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(cx - 95, baseY);
      ctx.lineTo(cx + 95, baseY);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = C.textMuted;
      for (let gx = cx - 90; gx <= cx + 88; gx += 12) {
        ctx.beginPath();
        ctx.moveTo(gx, baseY);
        ctx.lineTo(gx - 7, baseY + 9);
        ctx.stroke();
      }

      // Dashed equilibrium reference lines
      ctx.save();
      ctx.strokeStyle = C.ref;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 120, m1RestY);
      ctx.lineTo(cx + 120, m1RestY);
      ctx.moveTo(cx - 105, maRestY);
      ctx.lineTo(cx + 105, maRestY);
      ctx.stroke();
      ctx.restore();

      // Primary spring k1 (ground to m1)
      Theme.drawSpring(ctx, cx, baseY, cx, m1Y + m1H * 0.5, 7, 11, C.blue, 2.0);
      ctx.fillStyle = C.blue;
      ctx.font = '600 11.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('k₁', cx + 18, 0.5 * (baseY + m1Y + m1H * 0.5));

      // Absorber spring ka + optional damper ca (m1 to ma)
      const hasDamper = sys.zetaA > 1e-4;
      const spX = hasDamper ? cx - 18 : cx;
      Theme.drawSpring(ctx, spX, m1Y - m1H * 0.5, spX, maY + maH * 0.5, 6, 8, C.orange, 1.9);
      if (hasDamper) {
        Theme.drawDamper(ctx, cx + 18, m1Y - m1H * 0.5, cx + 18, maY + maH * 0.5, C.teal, 1.6);
      }

      ctx.fillStyle = C.orange;
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('kₐ', spX - 13, 0.5 * (m1Y - m1H * 0.5 + maY + maH * 0.5));
      if (hasDamper) {
        ctx.fillStyle = C.teal;
        ctx.textAlign = 'left';
        ctx.fillText('cₐ', cx + 30, 0.5 * (m1Y - m1H * 0.5 + maY + maH * 0.5));
      }

      // Primary mass block m1
      ctx.fillStyle = C.bgSubtle;
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2.4;
      ctx.fillRect(cx - m1W * 0.5, m1Y - m1H * 0.5, m1W, m1H);
      ctx.strokeRect(cx - m1W * 0.5, m1Y - m1H * 0.5, m1W, m1H);
      ctx.fillStyle = C.blue;
      ctx.font = '600 13.5px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Primary m₁', cx, m1Y - 7);
      ctx.fillStyle = C.textMuted;
      ctx.font = '500 11px "IBM Plex Mono", monospace';
      ctx.fillText('|X₁|/Xst = ' + M.fmt(res.M1, 2), cx, m1Y + 11);

      // Absorber mass block ma
      ctx.fillStyle = C.bgSubtle;
      ctx.strokeStyle = C.orange;
      ctx.lineWidth = 2.4;
      ctx.fillRect(cx - maW * 0.5, maY - maH * 0.5, maW, maH);
      ctx.strokeRect(cx - maW * 0.5, maY - maH * 0.5, maW, maH);
      ctx.fillStyle = C.orange;
      ctx.font = '600 12.5px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('mₐ (μ=' + M.fmt(sys.mu, 2) + ')', cx, maY - 5);
      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10.5px "IBM Plex Mono", monospace';
      ctx.fillText('|Xₐ|/Xst=' + M.fmt(res.Ma, 2), cx, maY + 9);

      // Live vertical harmonic force arrows on m1: external F0 (left) vs absorber reaction Fa (right)
      const f0Inst = Math.cos(state.phaseTime);
      const faMag = M.cAbs(res.Fa);
      const faPh = M.cArg(res.Fa);
      const faInst = Math.max(-2.5, Math.min(2.5, faMag * Math.cos(state.phaseTime + faPh)));

      const fScale = 36;
      const f0X = cx - m1W * 0.5 - 24;
      const faX = cx + m1W * 0.5 + 24;

      if (Math.abs(f0Inst) > 0.06) {
        Theme.drawArrow(ctx, f0X, m1Y, f0X, m1Y - f0Inst * fScale, C.copper, 2.5, 9);
      }
      ctx.fillStyle = C.copper;
      ctx.font = '600 11px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('F₀(t)', f0X - 7, m1Y);

      if (Math.abs(faInst) > 0.06) {
        // Reaction force transmitted onto m1 is -Fa (since Fprim - Fa = F0 -> Fprim = F0 + Fa? Wait:
        // Check sign! On m1: m1 x1'' + k1 x1 = F0 + F_from_absorber.
        // On ma: ma xa'' = -F_from_absorber -> F_from_absorber = -ma xa'' = +w^2 ma Xa = +mu r^2 Xa/Xst = +Fa!
        // WAIT: verify! At r=beta, zetaA=0: Xa/Xst = -1/(mu beta^2), so +Fa = mu beta^2 * (-1/(mu beta^2)) = -1 = -F0!
        // YES! So the reaction force exerted BY the absorber ON m1 is literally +Fa (which equals -F0 at antiresonance)!
        Theme.drawArrow(ctx, faX, m1Y, faX, m1Y - faInst * fScale, C.crimson, 2.5, 9);
      }
      ctx.fillStyle = C.crimson;
      ctx.font = '600 11px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('Fₐ→₁(t)', faX + 7, m1Y);

      // Top status text
      const isCancelled = res.M1 < 0.08 && Math.abs(sys.rDrive - sys.beta) < 0.08;
      ctx.fillStyle = isCancelled ? C.teal : C.textMuted;
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(
        isCancelled
          ? 'Exact force cancellation: Fₐ→₁(t) = −F₀(t) locks m₁ nearly motionless'
          : 'Drive ratio r = ω/ω₁ = ' + M.fmt(sys.rDrive, 2) + '  |  Tuning β = ' + M.fmt(sys.beta, 3),
        12,
        10
      );
    }

    function drawPhasor() {
      if (!phasorCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(phasorCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const res = M.evalTVA(sys.mu, sys.beta, sys.zetaA, sys.rDrive);
      // Force balance on m1: F0 + F_{a->1} = (k1 - w^2 m1) X1
      // Normalized by F0: 1 + Fa = Fprim
      const F0 = { re: 1, im: 0 };
      const Fa = res.Fa;
      const Fprim = res.Fprim;

      const maxF = Math.min(8.0, Math.max(1.4, M.cAbs(Fa), M.cAbs(Fprim)));
      const range = maxF * 1.28;
      const pad = 34;
      const scale = Math.min((w - 2 * pad) / (2 * range), (h - 2 * pad - 24) / (2 * range));
      const cx = w * 0.5;
      const cy = h * 0.53;
      const toX = (re) => cx + re * scale;
      const toY = (im) => cy - im * scale;

      // Unit reference circle |F/F0| = 1
      ctx.save();
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, scale, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();

      // Axes
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(16, cy);
      ctx.lineTo(w - 16, cy);
      ctx.moveTo(cx, 28);
      ctx.lineTo(cx, h - 22);
      ctx.stroke();

      ctx.fillStyle = C.textMuted;
      ctx.font = '600 11px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Re (F / F₀)', w - 18, cy - 5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('Im (F / F₀)', cx + 7, 28);

      // Clip extreme near-resonant vectors gracefully
      const clampVec = (v) => {
        const m = M.cAbs(v);
        if (m <= range * 0.94) return v;
        const s = (range * 0.94) / m;
        return { re: v.re * s, im: v.im * s };
      };

      const FaC = clampVec(Fa);
      const FpC = clampVec(Fprim);

      // Draw F0 from origin to (1, 0)
      Theme.drawArrow(ctx, cx, cy, toX(F0.re), toY(F0.im), C.copper, 2.8, 10);

      // Draw Fa head-to-tail from tip of F0 to F0 + Fa = Fprim!
      Theme.drawArrow(ctx, toX(F0.re), toY(F0.im), toX(FpC.re), toY(FpC.im), C.crimson, 2.6, 10);

      // Ghost copy of Fa from origin
      ctx.save();
      ctx.strokeStyle = C.crimson;
      ctx.globalAlpha = 0.28;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(toX(FaC.re), toY(FaC.im));
      ctx.stroke();
      ctx.restore();

      // Resultant primary restoring force Fprim = (1 - r^2) X1 / Xst
      if (M.cAbs(Fprim) > 0.03) {
        Theme.drawArrow(ctx, cx, cy, toX(FpC.re), toY(FpC.im), C.blue, 2.8, 10);
      } else {
        ctx.fillStyle = C.teal;
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Labels
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.copper;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('F₀ (drive = 1)', toX(0.5), cy + 8);

      ctx.fillStyle = C.crimson;
      ctx.textBaseline = 'bottom';
      ctx.fillText('Fₐ→₁', toX(0.5 * (F0.re + FpC.re)), toY(0.5 * (F0.im + FpC.im)) - 8);

      if (M.cAbs(Fprim) > 0.12) {
        ctx.fillStyle = C.blue;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('(1−r²)X₁', toX(FpC.re) + 7, toY(FpC.im));
      }

      // Header & footer info
      ctx.fillStyle = C.text;
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('Force-balance closure on m₁:  F₀ + Fₐ→₁ = (k₁ − ω²m₁)X₁', 12, 10);

      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(
        '|Fₐ→₁|/F₀ = ' + M.fmt(M.cAbs(Fa), 2) + '   ∠(Fₐ→₁) = ' + M.fmt((M.cArg(Fa) * 180) / Math.PI, 1) + '°   |X₁|/Xst = ' + M.fmt(res.M1, 3),
        12,
        h - 8
      );
    }

    function render() {
      drawRig();
      drawPhasor();
    }

    return {
      setSystem,
      setPlaying,
      isPlaying: () => state.playing,
      step,
      render
    };
  }

  window.VibLab.VizTVARig = { create: createTVARigViz };
})();
