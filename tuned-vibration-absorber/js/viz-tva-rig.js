/**
 * viz-tva-rig.js
 * Section 1 visualization for Module 10 (tuned-vibration-absorber):
 * - Left canvas: Live animated primary mass m1 + absorber mass ma driven harmonically
 *                by F0 cos(w t), showing live opposing reaction force arrow F_{a->1}(t) vs F0(t).
 *                Uses typographic canvas subscripts and auto-sized mass boxes so text always fits cleanly.
 * - Right canvas: Complex force-balance phasor diagram on m1:
 *                 F_0 + F_{a->1} = (k_1 - w^2 m_1) X_1
 *                 showing F_{a->1} rotating into exact 180-deg opposition to F_0 at r = beta.
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
      const dispScale = Math.min(32, h * 0.105) / Math.min(maxAmp, 14);
      const x1 = Math.max(-42, Math.min(42, res.M1 * Math.cos(state.phaseTime + res.ph1) * dispScale));
      const xa = Math.max(-48, Math.min(48, res.Ma * Math.cos(state.phaseTime + res.phA) * dispScale));

      const cx = w * 0.5;
      const baseY = h - 30;
      const m1RestY = h * 0.61;
      const maRestY = h * 0.25;
      const m1Y = m1RestY - x1;
      const maY = maRestY - xa;

      // Measure typographic runs so both mass boxes ALWAYS contain their text with generous margin
      const m1TitleRuns = [
        { t: 'Primary ', bold: true },
        { t: 'm', i: true, bold: true },
        { t: '1', sub: true, bold: true }
      ];
      const m1SubRuns = [
        { t: '|' },
        { t: 'X', i: true },
        { t: '1', sub: true },
        { t: '|/' },
        { t: 'X', i: true },
        { t: 'st', sub: true },
        { t: ' = ' + M.fmt(res.M1, 2) }
      ];

      const maTitleRuns = [
        { t: 'm', i: true, bold: true },
        { t: 'a', sub: true, bold: true },
        { t: ' (μ = ' + M.fmt(sys.mu, 2) + ')', bold: true }
      ];
      const maSubRuns = [
        { t: '|' },
        { t: 'X', i: true },
        { t: 'a', sub: true },
        { t: '|/' },
        { t: 'X', i: true },
        { t: 'st', sub: true },
        { t: ' = ' + M.fmt(res.Ma, 2) }
      ];

      const m1TitleW = Theme.measureMathRuns(ctx, m1TitleRuns, 13, '"IBM Plex Sans", sans-serif');
      const m1SubW = Theme.measureMathRuns(ctx, m1SubRuns, 11, '"IBM Plex Mono", monospace');
      const m1W = Math.max(150, Math.ceil(Math.max(m1TitleW, m1SubW)) + 34);
      const m1H = 56;

      const maTitleW = Theme.measureMathRuns(ctx, maTitleRuns, 12.5, '"IBM Plex Sans", sans-serif');
      const maSubW = Theme.measureMathRuns(ctx, maSubRuns, 11, '"IBM Plex Mono", monospace');
      const maW = Math.max(142, Math.ceil(Math.max(maTitleW, maSubW)) + 34);
      const maH = 52;

      // Ground base with hatching
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(cx - 102, baseY);
      ctx.lineTo(cx + 102, baseY);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = C.textMuted;
      for (let gx = cx - 96; gx <= cx + 96; gx += 12) {
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
      ctx.moveTo(cx - m1W * 0.5 - 16, m1RestY);
      ctx.lineTo(cx + m1W * 0.5 + 16, m1RestY);
      ctx.moveTo(cx - maW * 0.5 - 14, maRestY);
      ctx.lineTo(cx + maW * 0.5 + 14, maRestY);
      ctx.stroke();
      ctx.restore();

      // Primary spring k_1 (ground to m_1)
      Theme.drawSpring(ctx, cx, baseY, cx, m1Y + m1H * 0.5, 7, 11, C.blue, 2.0);
      Theme.drawMath(
        ctx,
        [{ t: 'k', i: true, bold: true }, { t: '1', sub: true, bold: true }],
        cx + 18,
        0.5 * (baseY + m1Y + m1H * 0.5),
        { size: 12, color: C.blue, align: 'left' }
      );

      // Absorber spring k_a + optional damper c_a (m_1 to m_a)
      const hasDamper = sys.zetaA > 1e-4;
      const spX = hasDamper ? cx - 22 : cx;
      const dpX = cx + 22;
      const midSpringY = 0.5 * (m1Y - m1H * 0.5 + maY + maH * 0.5);
      Theme.drawSpring(ctx, spX, m1Y - m1H * 0.5, spX, maY + maH * 0.5, 6, 8, C.orange, 1.9);
      if (hasDamper) {
        Theme.drawDamper(ctx, dpX, m1Y - m1H * 0.5, dpX, maY + maH * 0.5, C.teal, 1.6);
      }

      Theme.drawMath(
        ctx,
        [{ t: 'k', i: true, bold: true }, { t: 'a', sub: true, bold: true }],
        spX - 14,
        midSpringY,
        { size: 11.5, color: C.orange, align: 'right' }
      );
      if (hasDamper) {
        Theme.drawMath(
          ctx,
          [{ t: 'c', i: true, bold: true }, { t: 'a', sub: true, bold: true }],
          dpX + 14,
          midSpringY,
          { size: 11.5, color: C.teal, align: 'left' }
        );
      }

      // Primary mass block m_1
      ctx.fillStyle = C.bgSubtle;
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2.4;
      ctx.fillRect(cx - m1W * 0.5, m1Y - m1H * 0.5, m1W, m1H);
      ctx.strokeRect(cx - m1W * 0.5, m1Y - m1H * 0.5, m1W, m1H);
      Theme.drawMath(ctx, m1TitleRuns, cx, m1Y - 10, { size: 13, color: C.blue, align: 'center' });
      Theme.drawMath(ctx, m1SubRuns, cx, m1Y + 11, {
        size: 11,
        color: C.textMuted,
        align: 'center',
        family: '"IBM Plex Mono", monospace'
      });

      // Absorber mass block m_a
      ctx.fillStyle = C.bgSubtle;
      ctx.strokeStyle = C.orange;
      ctx.lineWidth = 2.4;
      ctx.fillRect(cx - maW * 0.5, maY - maH * 0.5, maW, maH);
      ctx.strokeRect(cx - maW * 0.5, maY - maH * 0.5, maW, maH);
      Theme.drawMath(ctx, maTitleRuns, cx, maY - 9, { size: 12.5, color: C.orange, align: 'center' });
      Theme.drawMath(ctx, maSubRuns, cx, maY + 10, {
        size: 11,
        color: C.textMuted,
        align: 'center',
        family: '"IBM Plex Mono", monospace'
      });

      // Live vertical harmonic force arrows on m_1: external F_0(t) (left) vs absorber reaction F_{a->1}(t) (right)
      const f0Inst = Math.cos(state.phaseTime);
      const faMag = M.cAbs(res.Fa);
      const faPh = M.cArg(res.Fa);
      const faInst = Math.max(-2.5, Math.min(2.5, faMag * Math.cos(state.phaseTime + faPh)));

      const fScale = 36;
      const f0X = cx - m1W * 0.5 - 22;
      const faX = cx + m1W * 0.5 + 22;

      if (Math.abs(f0Inst) > 0.06) {
        Theme.drawArrow(ctx, f0X, m1Y, f0X, m1Y - f0Inst * fScale, C.copper, 2.5, 9);
      }
      Theme.drawMath(
        ctx,
        [
          { t: 'F', i: true, bold: true },
          { t: '0', sub: true, bold: true },
          { t: '(', bold: true },
          { t: 't', i: true, bold: true },
          { t: ')', bold: true }
        ],
        f0X - 9,
        m1Y,
        { size: 12, color: C.copper, align: 'right' }
      );

      if (Math.abs(faInst) > 0.06) {
        Theme.drawArrow(ctx, faX, m1Y, faX, m1Y - faInst * fScale, C.crimson, 2.5, 9);
      }
      Theme.drawMath(
        ctx,
        [
          { t: 'F', i: true, bold: true },
          { t: 'a→1', sub: true, bold: true },
          { t: '(', bold: true },
          { t: 't', i: true, bold: true },
          { t: ')', bold: true }
        ],
        faX + 9,
        m1Y,
        { size: 12, color: C.crimson, align: 'left' }
      );

      // Top status bar
      const isCancelled = res.M1 < 0.08 && Math.abs(sys.rDrive - sys.beta) < 0.08;
      if (isCancelled) {
        Theme.drawMath(
          ctx,
          [
            { t: 'Exact cancellation: ', bold: true },
            { t: 'F', i: true, bold: true },
            { t: 'a→1', sub: true, bold: true },
            { t: '(t) = −', bold: true },
            { t: 'F', i: true, bold: true },
            { t: '0', sub: true, bold: true },
            { t: '(t) locks ', bold: true },
            { t: 'm', i: true, bold: true },
            { t: '1', sub: true, bold: true },
            { t: ' motionless', bold: true }
          ],
          12,
          16,
          { size: 11.5, color: C.teal, align: 'left' }
        );
      } else {
        Theme.drawMath(
          ctx,
          [
            { t: 'Drive ratio ', bold: true },
            { t: 'r', i: true, bold: true },
            { t: ' = ω/ω', bold: true },
            { t: '1', sub: true, bold: true },
            { t: ' = ' + M.fmt(sys.rDrive, 2) + '   |   Tuning β = ' + M.fmt(sys.beta, 3), bold: true }
          ],
          12,
          16,
          { size: 11.5, color: C.textMuted, align: 'left' }
        );
      }
    }

    function drawPhasor() {
      if (!phasorCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(phasorCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const res = M.evalTVA(sys.mu, sys.beta, sys.zetaA, sys.rDrive);
      const F0 = { re: 1, im: 0 };
      const Fa = res.Fa;
      const Fprim = res.Fprim;

      const maxF = Math.min(8.0, Math.max(1.4, M.cAbs(Fa), M.cAbs(Fprim)));
      const range = maxF * 1.28;
      const pad = 36;
      const scale = Math.min((w - 2 * pad) / (2 * range), (h - 2 * pad - 28) / (2 * range));
      const cx = w * 0.5;
      const cy = h * 0.53;
      const toX = (re) => cx + re * scale;
      const toY = (im) => cy - im * scale;

      // Unit reference circle |F/F_0| = 1
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
      ctx.moveTo(cx, 32);
      ctx.lineTo(cx, h - 26);
      ctx.stroke();

      Theme.drawMath(
        ctx,
        [{ t: 'Re (', bold: true }, { t: 'F', i: true, bold: true }, { t: '/', bold: true }, { t: 'F', i: true, bold: true }, { t: '0', sub: true, bold: true }, { t: ')', bold: true }],
        w - 18,
        cy - 10,
        { size: 11, color: C.textMuted, align: 'right' }
      );
      Theme.drawMath(
        ctx,
        [{ t: 'Im (', bold: true }, { t: 'F', i: true, bold: true }, { t: '/', bold: true }, { t: 'F', i: true, bold: true }, { t: '0', sub: true, bold: true }, { t: ')', bold: true }],
        cx + 8,
        38,
        { size: 11, color: C.textMuted, align: 'left' }
      );

      const clampVec = (v) => {
        const m = M.cAbs(v);
        if (m <= range * 0.92) return v;
        const s = (range * 0.92) / m;
        return { re: v.re * s, im: v.im * s };
      };

      const FaC = clampVec(Fa);
      const FpC = clampVec(Fprim);

      // F_0 arrow from origin to (1, 0)
      Theme.drawArrow(ctx, cx, cy, toX(F0.re), toY(F0.im), C.copper, 2.8, 10);

      // F_{a->1} head-to-tail from tip of F_0 to F_0 + F_{a->1} = F_prim
      Theme.drawArrow(ctx, toX(F0.re), toY(F0.im), toX(FpC.re), toY(FpC.im), C.crimson, 2.6, 10);

      // Ghost copy of F_{a->1} from origin
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

      // Resultant primary restoring force F_prim = (1 - r^2) X_1 / X_st
      if (M.cAbs(Fprim) > 0.03) {
        Theme.drawArrow(ctx, cx, cy, toX(FpC.re), toY(FpC.im), C.blue, 2.8, 10);
      } else {
        ctx.fillStyle = C.teal;
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Vector midpoint labels cleanly offset
      Theme.drawMath(
        ctx,
        [{ t: 'F', i: true, bold: true }, { t: '0', sub: true, bold: true }, { t: ' (= 1)', bold: true }],
        toX(0.5),
        cy + 15,
        { size: 11.5, color: C.copper, align: 'center' }
      );

      // Midpoint of F_{a->1} arrow (from (1,0) to FpC)
      const faDx = toX(FpC.re) - toX(F0.re);
      const faDy = toY(FpC.im) - toY(F0.im);
      const faLen = Math.max(1, Math.hypot(faDx, faDy));
      const faMidX = 0.5 * (toX(F0.re) + toX(FpC.re));
      const faMidY = 0.5 * (toY(F0.im) + toY(FpC.im));
      // Push perpendicular upward/away from F_0
      let fnx = -faDy / faLen;
      let fny = faDx / faLen;
      if (fny > 0) {
        fnx = -fnx;
        fny = -fny;
      }
      Theme.drawMath(
        ctx,
        [{ t: 'F', i: true, bold: true }, { t: 'a→1', sub: true, bold: true }],
        faMidX + fnx * 16,
        faMidY + fny * 16,
        { size: 12, color: C.crimson, align: 'center' }
      );

      if (M.cAbs(Fprim) > 0.14) {
        const fpDx = toX(FpC.re) - cx;
        const fpDy = toY(FpC.im) - cy;
        const fpLen = Math.max(1, Math.hypot(fpDx, fpDy));
        const fpMidX = 0.5 * (cx + toX(FpC.re));
        const fpMidY = 0.5 * (cy + toY(FpC.im));
        // Push away from F_0 tip (1, 0)
        let pnx = -fpDy / fpLen;
        let pny = fpDx / fpLen;
        const toTipX = toX(F0.re) - fpMidX;
        const toTipY = toY(F0.im) - fpMidY;
        if (pnx * toTipX + pny * toTipY > 0) {
          pnx = -pnx;
          pny = -pny;
        }
        Theme.drawMath(
          ctx,
          [
            { t: '(1 − ', bold: true },
            { t: 'r', i: true, bold: true },
            { t: '2', sup: true, bold: true },
            { t: ')', bold: true },
            { t: 'X', i: true, bold: true },
            { t: '1', sub: true, bold: true }
          ],
          fpMidX + pnx * 22,
          fpMidY + pny * 22,
          { size: 11.5, color: C.blue, align: 'center' }
        );
      }

      // Header equation cleanly typeset
      Theme.drawMath(
        ctx,
        [
          { t: 'Force balance on ', bold: true },
          { t: 'm', i: true, bold: true },
          { t: '1', sub: true, bold: true },
          { t: ':  ', bold: true },
          { t: 'F', i: true, bold: true },
          { t: '0', sub: true, bold: true },
          { t: ' + ', bold: true },
          { t: 'F', i: true, bold: true },
          { t: 'a→1', sub: true, bold: true },
          { t: ' = (', bold: true },
          { t: 'k', i: true, bold: true },
          { t: '1', sub: true, bold: true },
          { t: ' − ω', bold: true },
          { t: '2', sup: true, bold: true },
          { t: 'm', i: true, bold: true },
          { t: '1', sub: true, bold: true },
          { t: ')', bold: true },
          { t: 'X', i: true, bold: true },
          { t: '1', sub: true, bold: true }
        ],
        12,
        16,
        { size: 11.5, color: C.text, align: 'left' }
      );

      // Footer numeric readout cleanly typeset
      Theme.drawMath(
        ctx,
        [
          { t: '|' },
          { t: 'F', i: true },
          { t: 'a→1', sub: true },
          { t: '|/' },
          { t: 'F', i: true },
          { t: '0', sub: true },
          { t: ' = ' + M.fmt(M.cAbs(Fa), 2) + '    ∠ = ' + M.fmt((M.cArg(Fa) * 180) / Math.PI, 1) + '°    |' },
          { t: 'X', i: true },
          { t: '1', sub: true },
          { t: '|/' },
          { t: 'X', i: true },
          { t: 'st', sub: true },
          { t: ' = ' + M.fmt(res.M1, 3) }
        ],
        12,
        h - 13,
        { size: 10.5, color: C.textMuted, align: 'left', family: '"IBM Plex Mono", monospace' }
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
