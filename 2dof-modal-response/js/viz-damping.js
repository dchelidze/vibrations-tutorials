/**
 * viz-damping.js
 * Section 5 visualization for Module 04 (2dof-modal-response):
 * - Left canvas: Geometric comparison in mass-normalized q-space of the stiffness ellipse
 *                (q^T Ktilde q = const, aligned with normal modes v1, v2) and the Rayleigh
 *                dissipation ellipse (dq^T Cq dq = const). Under proportional damping
 *                C = alpha M + beta K, both ellipses share exact principal axes; adding a
 *                localized damper c_loc rotates the dissipation ellipse off the modal axes!
 * - Right canvas: Exact coupled FRF |H11(iw)| (computed via (K - w^2 M + iw C)^{-1}) vs.
 *                 the diagonal-modal approximation (dropping off-diagonal ctilde_12), plus
 *                 relative phase lag between m1 and m2 near resonance.
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathModal2DOF;
  const Theme = window.VibLab.Theme;

  function createDampingViz(opts) {
    const ellipseCanvas = document.getElementById(opts.ellipseCanvasId);
    const compareCanvas = document.getElementById(opts.compareCanvasId);
    let sys = opts.sys;

    function setSystem(newSys) {
      sys = newSys;
      render();
    }

    function drawEllipseCanvas() {
      if (!ellipseCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(ellipseCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const range = 1.65;
      const pad = 32;
      const scale = Math.min((w - 2 * pad) / (2 * range), (h - 2 * pad) / (2 * range));
      const cx = w * 0.5;
      const cy = h * 0.52;
      const toX = (x) => cx + x * scale;
      const toY = (y) => cy - y * scale;

      // Grid & axes
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let v = -1.5; v <= 1.51; v += 0.5) {
        if (Math.abs(v) < 1e-5) continue;
        ctx.beginPath();
        ctx.moveTo(toX(v), 14);
        ctx.lineTo(toX(v), h - 14);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(14, toY(v));
        ctx.lineTo(w - 14, toY(v));
        ctx.stroke();
      }
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(14, cy);
      ctx.lineTo(w - 14, cy);
      ctx.moveTo(cx, 14);
      ctx.lineTo(cx, h - 14);
      ctx.stroke();

      // Unit circle reference
      ctx.save();
      ctx.strokeStyle = C.ref;
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, scale, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();

      // 1. Stiffness ellipse q^T Ktilde q = geometric mean(lam1, lam2)
      const kRef = Math.sqrt(sys.lam1 * sys.lam2);
      const ka1 = Math.min(1.45, Math.sqrt(kRef / sys.lam1));
      const ka2 = Math.min(1.45, Math.sqrt(kRef / sys.lam2));
      const kRot = -Math.atan2(sys.v1[1], sys.v1[0]);

      ctx.save();
      ctx.strokeStyle = C.blue;
      ctx.fillStyle = C.dark ? 'rgba(77,190,238,0.08)' : 'rgba(0,114,189,0.07)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, ka1 * scale, ka2 * scale, kRot, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Stiffness principal axes (normal modes v1, v2)
      function drawAxisPair(v1, v2, a1, a2, color, dashed) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        if (dashed) ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(toX(-v1[0] * a1), toY(-v1[1] * a1));
        ctx.lineTo(toX(v1[0] * a1), toY(v1[1] * a1));
        ctx.moveTo(toX(-v2[0] * a2), toY(-v2[1] * a2));
        ctx.lineTo(toX(v2[0] * a2), toY(v2[1] * a2));
        ctx.stroke();
        ctx.restore();
      }
      drawAxisPair(sys.v1, sys.v2, ka1, ka2, C.blue, false);

      // 2. Rayleigh Dissipation ellipse qdot^T Cq qdot = const
      const eigC = sys.eigCq;
      const c1 = Math.max(1e-5, eigC.lam1);
      const c2 = Math.max(1e-5, eigC.lam2);
      // Scale smoothly so ellipse stays visible even when c1 << c2
      const ratioC = Math.min(6.0, Math.sqrt(c2 / c1));
      const ca1 = Math.min(1.38, 0.78 * Math.sqrt(ratioC));
      const ca2 = Math.max(0.24, 0.78 / Math.sqrt(ratioC));
      const cRot = -Math.atan2(eigC.v1[1], eigC.v1[0]);

      ctx.save();
      ctx.strokeStyle = sys.isProportional ? C.teal : C.crimson;
      ctx.fillStyle = sys.isProportional
        ? C.dark
          ? 'rgba(38,181,166,0.10)'
          : 'rgba(0,137,123,0.08)'
        : C.dark
          ? 'rgba(240,101,127,0.12)'
          : 'rgba(162,20,47,0.09)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, ca1 * scale, ca2 * scale, cRot, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      drawAxisPair(eigC.v1, eigC.v2, ca1, ca2, sys.isProportional ? C.teal : C.crimson, true);

      // Mode axis labels
      Theme.drawMath(
        ctx,
        [{ t: 'v', bold: true }, { t: '1', sub: true, bold: true }, { t: ' (', bold: true }, { t: 'K̃', bold: true }, { t: ' axis)', bold: true }],
        toX(sys.v1[0] * ka1) + 6,
        toY(sys.v1[1] * ka1) - 8,
        { size: 11.5, color: C.blue, align: 'left' }
      );

      // Status badge in top-left cleanly typeset
      if (sys.isProportional) {
        Theme.drawMath(
          ctx,
          [
            { t: 'Axes aligned: Δθ = 0.0° (', bold: true },
            { t: 'c̃', i: true, bold: true },
            { t: '12', sub: true, bold: true },
            { t: ' = 0, classical modes)', bold: true }
          ],
          12,
          16,
          { size: 11.5, color: C.teal, align: 'left' }
        );
      } else {
        Theme.drawMath(
          ctx,
          [
            { t: 'Axes misaligned: Δθ = ' + M.fmt(sys.dampMisalignDeg, 1) + '° (', bold: true },
            { t: 'c̃', i: true, bold: true },
            { t: '12', sub: true, bold: true },
            { t: ' ≠ 0, complex modes)', bold: true }
          ],
          12,
          16,
          { size: 11.5, color: C.crimson, align: 'left' }
        );
      }

      // Axis names
      Theme.drawMath(ctx, [{ t: 'q', i: true, bold: true }, { t: '1', sub: true, bold: true }], w - 16, cy - 10, {
        size: 11.5,
        color: C.textMuted,
        align: 'right'
      });
      Theme.drawMath(ctx, [{ t: 'q', i: true, bold: true }, { t: '2', sub: true, bold: true }], cx + 8, 34, {
        size: 11.5,
        color: C.textMuted,
        align: 'left'
      });
    }

    function drawCompareCanvas() {
      if (!compareCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(compareCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 56;
      const padR = 16;
      const padT = 28;
      const padB = 38;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const N = 320;
      const wMax = sys.wMax;
      const ws = new Array(N + 1);
      const exactM = new Array(N + 1);
      const approxM = new Array(N + 1);

      let maxVal = 1e-4;
      let maxRelErr = 0;
      for (let i = 0; i <= N; i++) {
        const ww = (wMax * i) / N;
        ws[i] = ww;
        const frf = M.evalFRF(sys, ww);
        const ex = M.cAbs(frf.exact[0][0]);
        const ap = M.cAbs(frf.modal[0][0].sum);
        exactM[i] = ex;
        approxM[i] = ap;
        if (ex > maxVal) maxVal = ex;
        if (ap > maxVal) maxVal = ap;
        if (ex > 1e-4) {
          const rel = Math.abs(ex - ap) / ex;
          if (rel > maxRelErr) maxRelErr = rel;
        }
      }

      const logMax = Math.ceil(Math.log10(Math.max(0.2, maxVal * 1.4)));
      const logMin = logMax - 4;
      const toX = (ww) => padL + (ww / wMax) * plotW;
      const toY = (val) => {
        const lv = Math.max(logMin, Math.min(logMax, Math.log10(Math.max(1e-8, val))));
        return padT + ((logMax - lv) / (logMax - logMin)) * plotH;
      };

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let d = logMin; d <= logMax; d++) {
        const py = padT + ((logMax - d) / (logMax - logMin)) * plotH;
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();

        Theme.drawMath(ctx, [{ t: '10' }, { t: String(d), sup: true }], padL - 7, py, {
          size: 10.5,
          color: C.textMuted,
          align: 'right',
          family: '"IBM Plex Mono", monospace'
        });
      }

      // Vertical reference lines w1, w2
      [
        [sys.w1, '1', C.teal],
        [sys.w2, '2', C.crimson]
      ].forEach(([wf, idxStr, col]) => {
        const px = toX(wf);
        ctx.save();
        ctx.strokeStyle = col;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px, padT);
        ctx.lineTo(px, padT + plotH);
        ctx.stroke();
        ctx.restore();
        Theme.drawMath(ctx, [{ t: 'ω', bold: true }, { t: idxStr, sub: true, bold: true }], px, padT - 11, {
          size: 11,
          color: col,
          align: 'center'
        });
      });

      // Exact coupled FRF (solid blue)
      ctx.save();
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const px = toX(ws[i]);
        const py = toY(exactM[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // Diagonal-modal approximation (dashed orange/crimson)
      ctx.save();
      ctx.strokeStyle = C.crimson;
      ctx.lineWidth = 2.0;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const px = toX(ws[i]);
        const py = toY(approxM[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      // X ticks
      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const stepW = wMax > 10 ? 2 : 1;
      for (let ww = 0; ww <= wMax + 1e-6; ww += stepW) {
        ctx.fillText(M.fmt(ww, 0), toX(ww), padT + plotH + 6);
      }
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.fillText('Frequency ω (rad/s)', padL + plotW * 0.5, h - 14);

      // Corner readout
      ctx.fillStyle = sys.isProportional ? C.teal : C.crimson;
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(
        sys.isProportional
          ? 'Exact match (0.0% error)'
          : 'Max diagonal-modal discrepancy: ' + M.fmt(maxRelErr * 100, 1) + '%',
        padL + plotW - 8,
        padT + 8
      );
    }

    function render() {
      drawEllipseCanvas();
      drawCompareCanvas();
    }

    return { setSystem, render };
  }

  window.VibLab.VizDamping = { create: createDampingViz };
})();
