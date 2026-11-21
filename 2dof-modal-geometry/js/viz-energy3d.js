/**
 * viz-energy3d.js
 * Interactive 3D Energy Paraboloid Surfaces (Kinetic T and Potential V)
 * with horizontal energy slice plane and synchronized 2D Energy Ellipses view.
 */
window.VibLab = window.VibLab || {};

window.VibLab.Energy3DViz = (function () {
  'use strict';

  const M2 = window.VibLab.Math2D;
  const Theme = window.VibLab.Theme;

  function create(opts) {
    const canvas3d = opts.canvas3d;
    const canvas2d = opts.canvas2d;

    const state = {
      eigen: opts.eigen,
      viewMode: 'both', // 'both', 'mass', 'stiff'
      energyLevel: 1.0, // E0 in [0.35, 1.8]
      yaw: 0.62,
      pitch: 0.52,
      autoRotate: true,
      dragging: false,
      lastPtr: null,
      visible: true
    };

    // Drag-to-orbit on 3D canvas
    canvas3d.addEventListener('pointerdown', function (evt) {
      state.dragging = true;
      state.autoRotate = false;
      state.lastPtr = { x: evt.clientX, y: evt.clientY };
      canvas3d.setPointerCapture(evt.pointerId);
      if (opts.onOrbitChange) opts.onOrbitChange();
    });

    canvas3d.addEventListener('pointermove', function (evt) {
      if (!state.dragging || !state.lastPtr) return;
      const dx = evt.clientX - state.lastPtr.x;
      const dy = evt.clientY - state.lastPtr.y;
      state.lastPtr = { x: evt.clientX, y: evt.clientY };
      state.yaw += dx * 0.008;
      state.pitch = Math.max(0.18, Math.min(1.28, state.pitch + dy * 0.007));
      render();
    });

    function endDrag(evt) {
      if (!state.dragging) return;
      state.dragging = false;
      if (evt && evt.pointerId !== undefined) {
        try {
          canvas3d.releasePointerCapture(evt.pointerId);
        } catch (e) {}
      }
    }
    canvas3d.addEventListener('pointerup', endDrag);
    canvas3d.addEventListener('pointercancel', endDrag);

    function setEigen(eigen) {
      state.eigen = eigen;
      render();
    }

    function setViewMode(mode) {
      state.viewMode = mode;
      render();
    }

    function setEnergyLevel(val) {
      state.energyLevel = val;
      render();
    }

    function toggleAutoRotate() {
      state.autoRotate = !state.autoRotate;
      return state.autoRotate;
    }

    function step(dt) {
      if (!state.visible) return;
      if (state.autoRotate && !state.dragging) {
        state.yaw += dt * 0.22;
        render3D();
      }
    }

    function render() {
      render3D();
      render2D();
    }

    function getDisplayMatrices() {
      const eig = state.eigen;
      // Geometric mean omega^2 brings K into comparable visual scale with M
      const w0Sq = Math.sqrt(eig.lambdas[0] * eig.lambdas[1]);
      const KScaled = [
        [eig.K[0][0] / w0Sq, eig.K[0][1] / w0Sq],
        [eig.K[1][0] / w0Sq, eig.K[1][1] / w0Sq]
      ];
      return { M: eig.M, KScaled, w0Sq };
    }

    function render3D() {
      const { ctx, w, h } = Theme.setupHiDPI(canvas3d);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const { M, KScaled } = getDisplayMatrices();
      const cx = w * 0.5;
      const cy = h * 0.64;
      const scale = Math.min(w, h) * 0.27;

      const cyaw = Math.cos(state.yaw);
      const syaw = Math.sin(state.yaw);
      const cp = Math.cos(state.pitch);
      const sp = Math.sin(state.pitch);

      function project(x, y, z) {
        // Rotate around vertical z axis by yaw, then tilt by pitch
        const xr = x * cyaw - y * syaw;
        const yr = x * syaw + y * cyaw;
        const yp = yr * sp - z * cp;
        const depth = yr * cp + z * sp;
        return {
          x: cx + xr * scale,
          y: cy + yp * scale,
          depth
        };
      }

      // Base reference grid on z = 0
      ctx.save();
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      const gExt = 1.6;
      for (let v = -1.5; v <= 1.51; v += 0.5) {
        const a1 = project(v, -gExt, 0);
        const a2 = project(v, gExt, 0);
        ctx.beginPath();
        ctx.moveTo(a1.x, a1.y);
        ctx.lineTo(a2.x, a2.y);
        ctx.stroke();

        const b1 = project(-gExt, v, 0);
        const b2 = project(gExt, v, 0);
        ctx.beginPath();
        ctx.moveTo(b1.x, b1.y);
        ctx.lineTo(b2.x, b2.y);
        ctx.stroke();
      }
      ctx.restore();

      // 3D Coordinate Axes
      const o = project(0, 0, 0);
      const ax1 = project(1.75, 0, 0);
      const ax2 = project(0, 1.75, 0);
      const axZ = project(0, 0, 2.05);
      Theme.drawArrow(ctx, o.x, o.y, ax1.x, ax1.y, C.axis, 1.6, 7);
      Theme.drawArrow(ctx, o.x, o.y, ax2.x, ax2.y, C.axis, 1.6, 7);
      Theme.drawArrow(ctx, o.x, o.y, axZ.x, axZ.y, C.axis, 1.6, 7);

      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = C.textMuted;
      ctx.textAlign = 'center';
      ctx.fillText(state.viewMode === 'mass' ? 'q̇₁' : 'q₁', ax1.x + 8, ax1.y + 4);
      ctx.fillText(state.viewMode === 'mass' ? 'q̇₂' : 'q₂', ax2.x + 8, ax2.y + 4);
      ctx.fillText(
        state.viewMode === 'mass' ? 'T (Kinetic)' : state.viewMode === 'stiff' ? 'V (Potential)' : 'Energy E',
        axZ.x,
        axZ.y - 8
      );

      const zSlice = state.energyLevel;
      const zMax = 1.85;

      // Helper to render a paraboloid bowl z = 0.5 * u^T A u up to zMax
      function drawBowl(A, strokeColor, fillRgba, sliceColor) {
        const rings = 7;
        const segs = 48;

        // Draw projected shadow ellipse on z = 0
        const baseEll = M2.sampleEllipse(A, 2 * zSlice, 64);
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = strokeColor;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i < baseEll.pts.length; i++) {
          const p = project(baseEll.pts[i][0], baseEll.pts[i][1], 0);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.restore();

        // Draw meridians
        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = 1;
        const rim = M2.sampleEllipse(A, 2 * zMax, 16);
        for (let m = 0; m < 16; m++) {
          const rx = rim.pts[m][0];
          const ry = rim.pts[m][1];
          ctx.beginPath();
          for (let k = 0; k <= 14; k++) {
            const s = k / 14; // radial fraction
            const x = rx * s;
            const y = ry * s;
            const z = zMax * s * s;
            const p = project(x, y, z);
            if (k === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        }
        ctx.restore();

        // Draw horizontal contour rings
        for (let r = 1; r <= rings; r++) {
          const zVal = (r / rings) * zMax;
          const ell = M2.sampleEllipse(A, 2 * zVal, segs);
          ctx.save();
          ctx.strokeStyle = strokeColor;
          ctx.globalAlpha = r === rings ? 0.5 : 0.28;
          ctx.lineWidth = r === rings ? 1.4 : 1.0;
          ctx.beginPath();
          for (let i = 0; i < ell.pts.length; i++) {
            const p = project(ell.pts[i][0], ell.pts[i][1], zVal);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
          ctx.restore();
        }

        // Draw glowing slice ellipse at z = zSlice
        const sliceEll = M2.sampleEllipse(A, 2 * zSlice, 72);
        ctx.save();
        ctx.fillStyle = fillRgba;
        ctx.strokeStyle = sliceColor;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        for (let i = 0; i < sliceEll.pts.length; i++) {
          const p = project(sliceEll.pts[i][0], sliceEll.pts[i][1], zSlice);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Semi-transparent horizontal energy slice plane at z = zSlice
      const pe = 1.48;
      const c1 = project(-pe, -pe, zSlice);
      const c2 = project(pe, -pe, zSlice);
      const c3 = project(pe, pe, zSlice);
      const c4 = project(-pe, pe, zSlice);

      // Draw bowls
      if (state.viewMode === 'both' || state.viewMode === 'mass') {
        drawBowl(M, C.mass, C.massFill, C.mass);
      }
      if (state.viewMode === 'both' || state.viewMode === 'stiff') {
        drawBowl(KScaled, C.stiff, C.stiffFill, C.stiff);
      }

      // Draw cut-plane boundary lightly on top so slice height is unmistakable
      ctx.save();
      ctx.fillStyle = Theme.isDark() ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.035)';
      ctx.strokeStyle = Theme.isDark() ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.18)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.lineTo(c3.x, c3.y);
      ctx.lineTo(c4.x, c4.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Re-stroke slice ellipses cleanly above cut plane
      if (state.viewMode === 'both' || state.viewMode === 'mass') {
        const sEll = M2.sampleEllipse(M, 2 * zSlice, 72);
        ctx.save();
        ctx.strokeStyle = C.mass;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        sEll.pts.forEach((pt, i) => {
          const p = project(pt[0], pt[1], zSlice);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.restore();
      }
      if (state.viewMode === 'both' || state.viewMode === 'stiff') {
        const sEll = M2.sampleEllipse(KScaled, 2 * zSlice, 72);
        ctx.save();
        ctx.strokeStyle = C.stiff;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        sEll.pts.forEach((pt, i) => {
          const p = project(pt[0], pt[1], zSlice);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.restore();
      }

      // Hint text
      ctx.save();
      ctx.font = '500 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = C.textMuted;
      ctx.textAlign = 'left';
      ctx.fillText('Drag to orbit 3D energy bowls', 12, 18);
      ctx.textAlign = 'right';
      ctx.fillText('Slice E₀ = ' + M2.fmt(zSlice, 2), w - 12, 18);
      ctx.restore();
    }

    function render2D() {
      const { ctx, w, h } = Theme.setupHiDPI(canvas2d);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const { M, KScaled } = getDisplayMatrices();
      const level = 2 * state.energyLevel;
      const ellM = M2.sampleEllipse(M, level, 120);
      const ellK = M2.sampleEllipse(KScaled, level, 120);

      // Compute clean viewport scale so both ellipses fit comfortably
      const maxSemi = Math.max(
        ellM.semiAxes[0],
        ellM.semiAxes[1],
        ellK.semiAxes[0],
        ellK.semiAxes[1],
        0.5
      );
      const cx = w * 0.5;
      const cy = h * 0.52;
      const scale = (Math.min(w, h) * 0.37) / maxSemi;

      const toPx = (u) => [cx + u[0] * scale, cy - u[1] * scale];

      // Subtle Cartesian grid
      ctx.save();
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      const stepWorld = maxSemi > 1.8 ? 0.5 : 0.25;
      const nSteps = Math.ceil((maxSemi * 1.6) / stepWorld);
      for (let i = -nSteps; i <= nSteps; i++) {
        const v = i * stepWorld;
        const pA = toPx([v, -nSteps * stepWorld]);
        const pB = toPx([v, nSteps * stepWorld]);
        ctx.beginPath();
        ctx.moveTo(pA[0], pA[1]);
        ctx.lineTo(pB[0], pB[1]);
        ctx.stroke();

        const qA = toPx([-nSteps * stepWorld, v]);
        const qB = toPx([nSteps * stepWorld, v]);
        ctx.beginPath();
        ctx.moveTo(qA[0], qA[1]);
        ctx.lineTo(qB[0], qB[1]);
        ctx.stroke();
      }
      ctx.restore();

      // Coordinate axes
      Theme.drawArrow(ctx, 18, cy, w - 18, cy, C.axis, 1.5, 7);
      Theme.drawArrow(ctx, cx, h - 18, cx, 24, C.axis, 1.5, 7);
      ctx.font = '600 12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = C.textMuted;
      ctx.textAlign = 'right';
      ctx.fillText('q₁', w - 20, cy - 8);
      ctx.textAlign = 'left';
      ctx.fillText('q₂', cx + 8, 34);

      // Draw Mass Ellipse + its own principal axes (dashed)
      if (state.viewMode === 'both' || state.viewMode === 'mass') {
        drawEllipse2D(ctx, ellM, toPx, C.mass, C.massFill, true);
      }

      // Draw Stiffness Ellipse + its own principal axes (dashed)
      if (state.viewMode === 'both' || state.viewMode === 'stiff') {
        drawEllipse2D(ctx, ellK, toPx, C.stiff, C.stiffFill, true);
      }

      // Legend at top
      ctx.save();
      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = C.mass;
      ctx.fillText('● Mass Ellipse  uᵀMu = 2E₀', 12, 18);
      ctx.textAlign = 'right';
      ctx.fillStyle = C.stiff;
      ctx.fillText('● Stiffness Ellipse  uᵀ(K/ω₀²)u = 2E₀', w - 12, 18);
      ctx.restore();

      // Bottom note on tilt angles
      const angM = ((ellM.angle * 180) / Math.PI).toFixed(1);
      const angK = ((ellK.angle * 180) / Math.PI).toFixed(1);
      ctx.save();
      ctx.font = '500 11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = C.textMuted;
      ctx.textAlign = 'center';
      ctx.fillText(
        'M principal tilt: ' + angM + '°   |   K principal tilt: ' + angK + '°',
        w * 0.5,
        h - 10
      );
      ctx.restore();
    }

    function drawEllipse2D(ctx, ell, toPx, stroke, fill, showAxes) {
      ctx.save();
      ctx.beginPath();
      ell.pts.forEach(function (pt, idx) {
        const p = toPx(pt);
        if (idx === 0) ctx.moveTo(p[0], p[1]);
        else ctx.lineTo(p[0], p[1]);
      });
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.6;
      ctx.stroke();

      if (showAxes) {
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.25;
        ctx.globalAlpha = 0.7;
        // Major & minor axes
        const a1 = [ell.v1[0] * ell.semiAxes[0], ell.v1[1] * ell.semiAxes[0]];
        const a2 = [ell.v2[0] * ell.semiAxes[1], ell.v2[1] * ell.semiAxes[1]];
        const p1A = toPx([-a1[0], -a1[1]]);
        const p1B = toPx(a1);
        const p2A = toPx([-a2[0], -a2[1]]);
        const p2B = toPx(a2);
        ctx.beginPath();
        ctx.moveTo(p1A[0], p1A[1]);
        ctx.lineTo(p1B[0], p1B[1]);
        ctx.moveTo(p2A[0], p2A[1]);
        ctx.lineTo(p2B[0], p2B[1]);
        ctx.stroke();
      }
      ctx.restore();
    }

    render();

    return {
      step,
      render,
      setEigen,
      setViewMode,
      setEnergyLevel,
      toggleAutoRotate,
      setVisible: (v) => (state.visible = v),
      getState: () => state
    };
  }

  return { create };
})();
