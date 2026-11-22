/**
 * viz-orthogonality.js
 * Section 1 visualization for Module 04 (2dof-modal-response):
 * Side-by-side geometric comparison of:
 *   Left  canvas: Physical (x1, x2) plane with kinetic-energy ellipse x^T M x = 1,
 *                 skewed eigenvectors u1, u2, conjugate-diameter tangent line,
 *                 and draggable initial displacement probe x0 with M-orthogonal vs Euclidean projection.
 *   Right canvas: Mass-normalized q = M^{1/2} x plane where the kinetic ellipse becomes
 *                 the unit circle q^T q = 1, v1 and v2 snap to an exact 90-degree orthonormal
 *                 frame, and the stiffness ellipse q^T Ktilde q = 1 aligns with v1, v2.
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathModal2DOF;
  const Theme = window.VibLab.Theme;

  function createOrthogonalityViz(opts) {
    const physCanvas = document.getElementById(opts.physCanvasId);
    const massCanvas = document.getElementById(opts.massCanvasId);
    let sys = opts.sys;

    const state = {
      x0: [1.05, 0.25],
      showEuclidean: true,
      showStiffness: true,
      dragging: null // 'phys' | 'mass' | null
    };

    const view = {
      physScale: 1,
      physCx: 0,
      physCy: 0,
      massScale: 1,
      massCx: 0,
      massCy: 0
    };

    function setSystem(newSys) {
      sys = newSys;
      render();
    }

    function setProbe(x0) {
      state.x0 = [x0[0], x0[1]];
      if (opts.onProbeChange) opts.onProbeChange(state.x0);
      render();
    }

    function setOptions(o) {
      if (o.showEuclidean !== undefined) state.showEuclidean = o.showEuclidean;
      if (o.showStiffness !== undefined) state.showStiffness = o.showStiffness;
      render();
    }

    function drawGridAndAxes(ctx, w, h, cx, cy, scale, range, labelX, labelY, C) {
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      const step = range > 2.6 ? 1.0 : 0.5;
      for (let v = -Math.ceil(range); v <= Math.ceil(range); v += step) {
        if (Math.abs(v) < 1e-6) continue;
        const px = cx + v * scale;
        const py = cy - v * scale;
        ctx.beginPath();
        ctx.moveTo(px, 14);
        ctx.lineTo(px, h - 14);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(14, py);
        ctx.lineTo(w - 14, py);
        ctx.stroke();
      }

      // Axes
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(14, cy);
      ctx.lineTo(w - 14, cy);
      ctx.moveTo(cx, 14);
      ctx.lineTo(cx, h - 14);
      ctx.stroke();

      // Axis labels (typeset math)
      Theme.drawMath(ctx, labelX, w - 16, cy - 11, { size: 12, color: C.textMuted, align: 'right' });
      Theme.drawMath(ctx, labelY, cx + 8, 20, { size: 12, color: C.textMuted, align: 'left' });
    }

    function drawPhysicalCanvas() {
      if (!physCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(physCanvas);
      const C = Theme.get();

      const ax1 = 1 / sys.sm1;
      const ax2 = 1 / sys.sm2;
      const maxExtent = Math.max(ax1, ax2, Math.abs(state.x0[0]), Math.abs(state.x0[1]), 1.35) * 1.28;
      const pad = 28;
      const scale = Math.min((w - 2 * pad) / (2 * maxExtent), (h - 2 * pad) / (2 * maxExtent));
      const cx = w * 0.5;
      const cy = h * 0.52;
      view.physScale = scale;
      view.physCx = cx;
      view.physCy = cy;

      const toX = (x) => cx + x * scale;
      const toY = (y) => cy - y * scale;

      drawGridAndAxes(
        ctx,
        w,
        h,
        cx,
        cy,
        scale,
        maxExtent,
        [{ t: 'x', i: true, bold: true }, { t: '1', sub: true, bold: true }],
        [{ t: 'x', i: true, bold: true }, { t: '2', sub: true, bold: true }],
        C
      );

      // Optional stiffness ellipse x^T K x = w1^2 (scaled for clean visual reference)
      if (state.showStiffness) {
        const refVal = Math.sqrt(sys.lam1 * sys.lam2);
        ctx.save();
        ctx.strokeStyle = C.orange;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        const N = 160;
        for (let i = 0; i <= N; i++) {
          const th = (2 * Math.PI * i) / N;
          const dirX = Math.cos(th);
          const dirY = Math.sin(th);
          const qK =
            sys.K[0][0] * dirX * dirX + 2 * sys.K[0][1] * dirX * dirY + sys.K[1][1] * dirY * dirY;
          const r = Math.sqrt(refVal / Math.max(1e-9, qK));
          const px = toX(r * dirX);
          const py = toY(r * dirY);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      // Unit kinetic-energy ellipse: m1 x1^2 + m2 x2^2 = 1
      ctx.save();
      ctx.strokeStyle = C.blue;
      ctx.fillStyle = C.dark ? 'rgba(77,190,238,0.08)' : 'rgba(0,114,189,0.06)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, ax1 * scale, ax2 * scale, 0, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Modal axes (extended dashed lines along u1 and u2)
      const u1 = sys.u1;
      const u2 = sys.u2;
      const ext = maxExtent * 1.15;

      function drawModalAxis(u, color) {
        const nrm = Math.hypot(u[0], u[1]);
        const ux = (u[0] / nrm) * ext;
        const uy = (u[1] / nrm) * ext;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.32;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(toX(-ux), toY(-uy));
        ctx.lineTo(toX(ux), toY(uy));
        ctx.stroke();
        ctx.restore();
      }
      drawModalAxis(u1, C.teal);
      drawModalAxis(u2, C.crimson);

      // Conjugate-diameter tangent line at u1 (parallel to u2!)
      const u2n = Math.hypot(u2[0], u2[1]);
      const tLen = 0.55 * Math.min(ax1, ax2);
      const tx = (u2[0] / u2n) * tLen;
      const ty = (u2[1] / u2n) * tLen;
      ctx.save();
      ctx.strokeStyle = C.crimson;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(toX(u1[0] - tx), toY(u1[1] - ty));
      ctx.lineTo(toX(u1[0] + tx), toY(u1[1] + ty));
      ctx.stroke();
      ctx.restore();

      // Angle arc between u1 and u2
      const a1 = Math.atan2(-u1[1], u1[0]);
      const a2 = Math.atan2(-u2[1], u2[0]);
      ctx.save();
      ctx.strokeStyle = C.textMuted;
      ctx.lineWidth = 1.3;
      const arcR = 26;
      ctx.beginPath();
      ctx.arc(cx, cy, arcR, a2, a1, false);
      ctx.stroke();
      const midA = 0.5 * (a1 + a2);
      ctx.fillStyle = C.text;
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(M.fmt(sys.physAngleDeg, 1) + '°', cx + (arcR + 18) * Math.cos(midA), cy + (arcR + 18) * Math.sin(midA));
      ctx.restore();

      // Mode vectors u1, u2 (lie exactly on the unit M-ellipse!)
      Theme.drawArrow(ctx, cx, cy, toX(u1[0]), toY(u1[1]), C.teal, 2.4, 9);
      Theme.drawArrow(ctx, cx, cy, toX(u2[0]), toY(u2[1]), C.crimson, 2.4, 9);

      Theme.drawMath(ctx, [{ t: 'u', bold: true }, { t: '1', sub: true, bold: true }], toX(u1[0]) + 7, toY(u1[1]) - 8, {
        size: 12.5,
        color: C.teal,
        align: 'left'
      });
      Theme.drawMath(ctx, [{ t: 'u', bold: true }, { t: '2', sub: true, bold: true }], toX(u2[0]) - 7, toY(u2[1]) - 8, {
        size: 12.5,
        color: C.crimson,
        align: 'right'
      });

      // Probe vector x0 and its M-orthogonal parallelogram decomposition: x0 = r1 u1 + r2 u2
      const x0 = state.x0;
      const r = M.physToModal(sys, x0);
      const comp1 = [r[0] * u1[0], r[0] * u1[1]];
      const comp2 = [r[1] * u2[0], r[1] * u2[1]];

      // M-orthogonal parallelogram (skewed parallel projection!)
      ctx.save();
      ctx.strokeStyle = C.teal;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(toX(comp1[0]), toY(comp1[1]));
      ctx.lineTo(toX(x0[0]), toY(x0[1]));
      ctx.stroke();

      ctx.strokeStyle = C.crimson;
      ctx.beginPath();
      ctx.moveTo(toX(comp2[0]), toY(comp2[1]));
      ctx.lineTo(toX(x0[0]), toY(x0[1]));
      ctx.stroke();
      ctx.restore();

      // Solid component segments along u1 and u2
      ctx.save();
      ctx.strokeStyle = C.teal;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(toX(comp1[0]), toY(comp1[1]));
      ctx.stroke();

      ctx.strokeStyle = C.crimson;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(toX(comp2[0]), toY(comp2[1]));
      ctx.stroke();
      ctx.restore();

      // Optional naive Euclidean perpendicular drop onto u1 (shows why Euclidean projection fails!)
      if (state.showEuclidean && Math.abs(sys.physAngleDeg - 90) > 1.0) {
        const u1Norm2 = u1[0] * u1[0] + u1[1] * u1[1];
        const sEuc = (x0[0] * u1[0] + x0[1] * u1[1]) / u1Norm2;
        const ePt = [sEuc * u1[0], sEuc * u1[1]];
        ctx.save();
        ctx.strokeStyle = C.ref;
        ctx.lineWidth = 1.25;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(toX(x0[0]), toY(x0[1]));
        ctx.lineTo(toX(ePt[0]), toY(ePt[1]));
        ctx.stroke();
        ctx.fillStyle = C.ref;
        ctx.beginPath();
        ctx.arc(toX(ePt[0]), toY(ePt[1]), 3.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
      }

      // Probe vector x0 arrow & handle
      Theme.drawArrow(ctx, cx, cy, toX(x0[0]), toY(x0[1]), C.copper, 2.5, 9);
      ctx.fillStyle = C.copper;
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(toX(x0[0]), toY(x0[1]), 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      Theme.drawMath(
        ctx,
        [{ t: 'x', bold: true }, { t: '0', sub: true, bold: true }, { t: ' (drag)', bold: true }],
        toX(x0[0]) + 10,
        toY(x0[1]) - 6,
        { size: 12, color: C.copper, align: 'left' }
      );

      // Corner badge (NLD upright sans-serif transpose T)
      Theme.drawMath(
        ctx,
        [
          { t: 'x', bold: true },
          { t: 'T', sup: true, bold: true },
          { t: 'Mx', bold: true },
          { t: ' = 1 (ellipse)' }
        ],
        12,
        h - 14,
        { size: 11, color: C.textMuted, align: 'left' }
      );
    }

    function drawMassNormCanvas() {
      if (!massCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(massCanvas);
      const C = Theme.get();

      const q0 = M.physToMassNorm(sys, state.x0);
      const maxExtent = Math.max(1.25, Math.abs(q0[0]), Math.abs(q0[1])) * 1.28;
      const pad = 28;
      const scale = Math.min((w - 2 * pad) / (2 * maxExtent), (h - 2 * pad) / (2 * maxExtent));
      const cx = w * 0.5;
      const cy = h * 0.52;
      view.massScale = scale;
      view.massCx = cx;
      view.massCy = cy;

      const toX = (x) => cx + x * scale;
      const toY = (y) => cy - y * scale;

      drawGridAndAxes(
        ctx,
        w,
        h,
        cx,
        cy,
        scale,
        maxExtent,
        [
          { t: 'q', i: true, bold: true },
          { t: '1', sub: true, bold: true },
          { t: ' = √', bold: true },
          { t: 'm', i: true, bold: true },
          { t: '1', sub: true, bold: true },
          { t: ' x', i: true, bold: true },
          { t: '1', sub: true, bold: true }
        ],
        [
          { t: 'q', i: true, bold: true },
          { t: '2', sub: true, bold: true },
          { t: ' = √', bold: true },
          { t: 'm', i: true, bold: true },
          { t: '2', sub: true, bold: true },
          { t: ' x', i: true, bold: true },
          { t: '2', sub: true, bold: true }
        ],
        C
      );

      // Stiffness ellipse q^T Ktilde q = sqrt(lam1*lam2) aligned with v1, v2
      if (state.showStiffness) {
        const refVal = Math.sqrt(sys.lam1 * sys.lam2);
        const a1 = Math.sqrt(refVal / sys.lam1);
        const a2 = Math.sqrt(refVal / sys.lam2);
        const rot = -Math.atan2(sys.v1[1], sys.v1[0]);
        ctx.save();
        ctx.strokeStyle = C.orange;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, a1 * scale, a2 * scale, rot, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();
      }

      // Unit circle q^T q = 1 (kinetic-energy sphere!)
      ctx.save();
      ctx.strokeStyle = C.blue;
      ctx.fillStyle = C.dark ? 'rgba(77,190,238,0.08)' : 'rgba(0,114,189,0.06)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, scale, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const v1 = sys.v1;
      const v2 = sys.v2;
      const ext = maxExtent * 1.15;

      function drawAxis(v, color) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.32;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(toX(-v[0] * ext), toY(-v[1] * ext));
        ctx.lineTo(toX(v[0] * ext), toY(v[1] * ext));
        ctx.stroke();
        ctx.restore();
      }
      drawAxis(v1, C.teal);
      drawAxis(v2, C.crimson);

      // Right-angle square marker between v1 and v2 (90.0 deg!)
      const sq = 13 / scale;
      const pA = [v1[0] * sq, v1[1] * sq];
      const pB = [(v1[0] + v2[0]) * sq, (v1[1] + v2[1]) * sq];
      const pC = [v2[0] * sq, v2[1] * sq];
      ctx.save();
      ctx.strokeStyle = C.text;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(toX(pA[0]), toY(pA[1]));
      ctx.lineTo(toX(pB[0]), toY(pB[1]));
      ctx.lineTo(toX(pC[0]), toY(pC[1]));
      ctx.stroke();
      ctx.fillStyle = C.text;
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('90.0°', toX((v1[0] + v2[0]) * (sq * 1.9)), toY((v1[1] + v2[1]) * (sq * 1.9)));
      ctx.restore();

      // Unit orthonormal vectors v1, v2
      Theme.drawArrow(ctx, cx, cy, toX(v1[0]), toY(v1[1]), C.teal, 2.4, 9);
      Theme.drawArrow(ctx, cx, cy, toX(v2[0]), toY(v2[1]), C.crimson, 2.4, 9);

      Theme.drawMath(ctx, [{ t: 'v', bold: true }, { t: '1', sub: true, bold: true }], toX(v1[0]) + 7, toY(v1[1]) - 8, {
        size: 12.5,
        color: C.teal,
        align: 'left'
      });
      Theme.drawMath(ctx, [{ t: 'v', bold: true }, { t: '2', sub: true, bold: true }], toX(v2[0]) - 7, toY(v2[1]) - 8, {
        size: 12.5,
        color: C.crimson,
        align: 'right'
      });

      // Exact orthogonal projection in q-space: r_j = v_j^T q0
      const r = M.physToModal(sys, state.x0);
      const qComp1 = [r[0] * v1[0], r[0] * v1[1]];
      const qComp2 = [r[1] * v2[0], r[1] * v2[1]];

      ctx.save();
      ctx.strokeStyle = C.teal;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(toX(qComp1[0]), toY(qComp1[1]));
      ctx.lineTo(toX(q0[0]), toY(q0[1]));
      ctx.stroke();

      ctx.strokeStyle = C.crimson;
      ctx.beginPath();
      ctx.moveTo(toX(qComp2[0]), toY(qComp2[1]));
      ctx.lineTo(toX(q0[0]), toY(q0[1]));
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = C.teal;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(toX(qComp1[0]), toY(qComp1[1]));
      ctx.stroke();
      ctx.strokeStyle = C.crimson;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(toX(qComp2[0]), toY(qComp2[1]));
      ctx.stroke();
      ctx.restore();

      // q0 arrow & handle
      Theme.drawArrow(ctx, cx, cy, toX(q0[0]), toY(q0[1]), C.copper, 2.5, 9);
      ctx.fillStyle = C.copper;
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(toX(q0[0]), toY(q0[1]), 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      Theme.drawMath(
        ctx,
        [
          { t: 'q', bold: true },
          { t: '0', sub: true, bold: true },
          { t: ' = ', bold: true },
          { t: 'M', bold: true },
          { t: '1/2', sup: true, bold: true },
          { t: 'x', bold: true },
          { t: '0', sub: true, bold: true }
        ],
        toX(q0[0]) + 10,
        toY(q0[1]) - 6,
        { size: 12, color: C.copper, align: 'left' }
      );

      Theme.drawMath(
        ctx,
        [
          { t: 'q', bold: true },
          { t: 'T', sup: true, bold: true },
          { t: 'q', bold: true },
          { t: ' = 1 (circle) · ' },
          { t: 'v', bold: true },
          { t: '1', sub: true, bold: true },
          { t: 'T', sup: true, bold: true },
          { t: 'v', bold: true },
          { t: '2', sub: true, bold: true },
          { t: ' = 0' }
        ],
        12,
        h - 14,
        { size: 11, color: C.textMuted, align: 'left' }
      );
    }

    function render() {
      drawPhysicalCanvas();
      drawMassNormCanvas();
    }

    // Pointer drag interaction on both canvases
    function attachDrag(canvas, kind) {
      if (!canvas) return;
      function updateFromEvent(e) {
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        if (kind === 'phys') {
          const x1 = Math.max(-2.2, Math.min(2.2, (px - view.physCx) / view.physScale));
          const x2 = Math.max(-2.2, Math.min(2.2, (view.physCy - py) / view.physScale));
          setProbe([x1, x2]);
        } else {
          const q1 = Math.max(-2.5, Math.min(2.5, (px - view.massCx) / view.massScale));
          const q2 = Math.max(-2.5, Math.min(2.5, (view.massCy - py) / view.massScale));
          const x = M.massNormToPhys(sys, [q1, q2]);
          setProbe([Math.max(-2.2, Math.min(2.2, x[0])), Math.max(-2.2, Math.min(2.2, x[1]))]);
        }
      }

      canvas.addEventListener('pointerdown', function (e) {
        state.dragging = kind;
        canvas.setPointerCapture(e.pointerId);
        updateFromEvent(e);
      });
      canvas.addEventListener('pointermove', function (e) {
        if (state.dragging !== kind) return;
        updateFromEvent(e);
      });
      canvas.addEventListener('pointerup', function () {
        state.dragging = null;
      });
      canvas.addEventListener('pointercancel', function () {
        state.dragging = null;
      });
    }

    attachDrag(physCanvas, 'phys');
    attachDrag(massCanvas, 'mass');

    return {
      setSystem,
      setProbe,
      getProbe: () => state.x0.slice(),
      setOptions,
      render
    };
  }

  window.VibLab.VizOrthogonality = { create: createOrthogonalityViz };
})();
