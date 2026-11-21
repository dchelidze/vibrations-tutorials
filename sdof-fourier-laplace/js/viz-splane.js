/**
 * viz-splane.js
 * Section 2: The Geometric Bridge Between Laplace and Fourier Transforms.
 * - Left canvas: Interactive drag-to-orbit 3D surface |H(s)| = |H(sigma + i*omega)|
 *   showing the two poles in the left half-plane and a live movable vertical slice plane
 *   at Re(s) = sigma_slice (default sigma_slice = 0, the imaginary axis = FRF |H(iw)|).
 * - Right canvas: Synchronized 2D s-plane pole-zero & ROC map (top) +
 *   2D slice curve |H(sigma_slice + i*omega)| vs. FRF |H(iw)| (bottom, toggleable with
 *   exponentially weighted signal h(t) e^{-sigma_slice t}).
 */
window.VibLab = window.VibLab || {};

window.VibLab.SPlaneViz = (function () {
  'use strict';

  const M1 = window.VibLab.Math1D;
  const Theme = window.VibLab.Theme;

  function create(opts) {
    const canvas3d = opts.canvas3d;
    const canvas2d = opts.canvas2d;

    const state = {
      sys: opts.sys,
      sigmaSlice: 0.0, // Re(s) slice in normalized units of wn (so physical sigma = sigmaSlice * wn)
      bottomMode: 'slice', // 'slice' (|H(sigma + iw)|) or 'weighted' (h(t) e^{-sigma t})
      yaw: 0.68,
      pitch: 0.56,
      autoRotate: false,
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
      state.pitch = Math.max(0.18, Math.min(1.3, state.pitch + dy * 0.007));
      render3D();
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

    function setSystem(sys) {
      state.sys = sys;
      render();
    }

    function setSigmaSlice(normSigma) {
      state.sigmaSlice = normSigma;
      render();
    }

    function setBottomMode(mode) {
      state.bottomMode = mode;
      render2D();
    }

    function toggleAutoRotate() {
      state.autoRotate = !state.autoRotate;
      return state.autoRotate;
    }

    function resetCamera() {
      state.yaw = 0.68;
      state.pitch = 0.56;
      render3D();
    }

    function setVisible(v) {
      state.visible = !!v;
    }

    function step(dt) {
      if (!state.visible) return;
      if (state.autoRotate && !state.dragging) {
        state.yaw += dt * 0.25;
        render3D();
      }
    }

    // Normalized height z in [0, zCap] representing k * |H(s)| on a smooth compressed scale
    function surfaceHeight(sigNorm, wNorm) {
      const wn = state.sys.wn;
      const s = M1.C(sigNorm * wn, wNorm * wn);
      const H = M1.transferH(state.sys, s);
      const dimlessMag = state.sys.k * M1.cAbs(H); // k * |H(s)| -> 1 at s = 0
      // Smooth log compression so poles stand tall while the shelf & FRF ridge remain crisp
      const hVal = Math.log1p(dimlessMag * 1.35) / Math.log1p(14.0);
      return Math.min(1.55, hVal * 1.25);
    }

    function render3D() {
      const { ctx, w, h } = Theme.setupHiDPI(canvas3d);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.5;
      const cy = h * 0.66;
      const scale = Math.min(w, h) * 0.27;

      const cyaw = Math.cos(state.yaw);
      const syaw = Math.sin(state.yaw);
      const cp = Math.cos(state.pitch);
      const sp = Math.sin(state.pitch);

      function project(x, y, z) {
        const xr = x * cyaw - y * syaw;
        const yr = x * syaw + y * cyaw;
        const yp = yr * sp - z * cp;
        const depth = yr * cp + z * sp;
        return { x: cx + xr * scale, y: cy + yp * scale, depth };
      }

      // Domain in normalized coordinates: sigma/wn in [-1.8, 0.8], omega/wn in [-2.0, 2.0]
      const sigMin = -1.75;
      const sigMax = 0.75;
      const wMin = -2.0;
      const wMax = 2.0;

      // Map (sigNorm, wNorm) into centered 3D box coordinates
      function toBox(sigN, wN, z) {
        return {
          bx: (sigN + 0.5) * 1.15,
          by: wN * 0.85,
          bz: z
        };
      }

      function projSW(sigN, wN, z) {
        const b = toBox(sigN, wN, z);
        return project(b.bx, b.by, b.bz);
      }

      // Base s-plane rectangle & ROC shading on z = 0
      const sigma0N = state.sys.sigma0 / state.sys.wn;
      const rocLeft = Math.max(sigMin, Math.min(sigMax, sigma0N));

      // Non-ROC region (left of sigma0)
      if (rocLeft > sigMin + 0.01) {
        const c1 = projSW(sigMin, wMin, 0);
        const c2 = projSW(rocLeft, wMin, 0);
        const c3 = projSW(rocLeft, wMax, 0);
        const c4 = projSW(sigMin, wMax, 0);
        ctx.fillStyle = C.nonRocFill;
        ctx.beginPath();
        ctx.moveTo(c1.x, c1.y);
        ctx.lineTo(c2.x, c2.y);
        ctx.lineTo(c3.x, c3.y);
        ctx.lineTo(c4.x, c4.y);
        ctx.closePath();
        ctx.fill();
      }

      // ROC region (right of sigma0)
      if (rocLeft < sigMax - 0.01) {
        const c1 = projSW(rocLeft, wMin, 0);
        const c2 = projSW(sigMax, wMin, 0);
        const c3 = projSW(sigMax, wMax, 0);
        const c4 = projSW(rocLeft, wMax, 0);
        ctx.fillStyle = C.rocFill;
        ctx.beginPath();
        ctx.moveTo(c1.x, c1.y);
        ctx.lineTo(c2.x, c2.y);
        ctx.lineTo(c3.x, c3.y);
        ctx.lineTo(c4.x, c4.y);
        ctx.closePath();
        ctx.fill();
      }

      // Base grid lines on z = 0
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let s = -1.5; s <= 0.51; s += 0.5) {
        const a = projSW(s, wMin, 0);
        const b = projSW(s, wMax, 0);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      for (let om = -2.0; om <= 2.01; om += 0.5) {
        const a = projSW(sigMin, om, 0);
        const b = projSW(sigMax, om, 0);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Real axis (omega = 0) and Imaginary axis (sigma = 0) on base plane
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.4;
      const rA = projSW(sigMin, 0, 0);
      const rB = projSW(sigMax, 0, 0);
      ctx.beginPath();
      ctx.moveTo(rA.x, rA.y);
      ctx.lineTo(rB.x, rB.y);
      ctx.stroke();

      const iA = projSW(0, wMin, 0);
      const iB = projSW(0, wMax, 0);
      ctx.strokeStyle = C.teal;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(iA.x, iA.y);
      ctx.lineTo(iB.x, iB.y);
      ctx.stroke();

      // Surface mesh quads (painter's algorithm sorted back-to-front)
      const nS = 26;
      const nW = 42;
      const quads = [];
      const gridPts = [];

      for (let i = 0; i <= nS; i++) {
        const row = [];
        const sigN = sigMin + ((sigMax - sigMin) * i) / nS;
        for (let j = 0; j <= nW; j++) {
          const wN = wMin + ((wMax - wMin) * j) / nW;
          const z = surfaceHeight(sigN, wN);
          const p = projSW(sigN, wN, z);
          row.push({ p, z, sigN, wN });
        }
        gridPts.push(row);
      }

      for (let i = 0; i < nS; i++) {
        for (let j = 0; j < nW; j++) {
          const p00 = gridPts[i][j];
          const p10 = gridPts[i + 1][j];
          const p11 = gridPts[i + 1][j + 1];
          const p01 = gridPts[i][j + 1];
          const avgDepth = 0.25 * (p00.p.depth + p10.p.depth + p11.p.depth + p01.p.depth);
          const avgZ = 0.25 * (p00.z + p10.z + p11.z + p01.z);
          const avgSig = 0.25 * (p00.sigN + p10.sigN + p11.sigN + p01.sigN);
          quads.push({ p00, p10, p11, p01, avgDepth, avgZ, avgSig });
        }
      }

      quads.sort((a, b) => b.avgDepth - a.avgDepth);

      const dark = Theme.isDark();
      for (let q = 0; q < quads.length; q++) {
        const item = quads[q];
        const inRoc = item.avgSig >= sigma0N - 1e-4;
        const tH = Math.min(1, item.avgZ / 1.45);
        // Subtle blue-to-copper elevation ramp, slightly dimmed left of ROC boundary
        let fill;
        if (inRoc) {
          const r = Math.round((dark ? 35 : 0) + tH * (dark ? 185 : 180));
          const g = Math.round((dark ? 115 : 114) + tH * (dark ? 35 : -16));
          const b = Math.round((dark ? 180 : 189) - tH * (dark ? 105 : 147));
          fill = 'rgba(' + r + ',' + g + ',' + b + ',' + (0.28 + 0.34 * tH).toFixed(2) + ')';
        } else {
          fill = dark
            ? 'rgba(143, 155, 166, ' + (0.14 + 0.16 * tH).toFixed(2) + ')'
            : 'rgba(138, 133, 120, ' + (0.15 + 0.18 * tH).toFixed(2) + ')';
        }

        ctx.fillStyle = fill;
        ctx.strokeStyle = dark ? 'rgba(242,244,246,0.12)' : 'rgba(19,36,51,0.11)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(item.p00.p.x, item.p00.p.y);
        ctx.lineTo(item.p10.p.x, item.p10.p.y);
        ctx.lineTo(item.p11.p.x, item.p11.p.y);
        ctx.lineTo(item.p01.p.x, item.p01.p.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Vertical translucent slice wall at Re(s) = sigmaSlice
      const sliceSig = Math.max(sigMin, Math.min(sigMax, state.sigmaSlice));
      const sliceInRoc = sliceSig > sigma0N + 1e-4;
      const wallColor = sliceInRoc
        ? Math.abs(sliceSig) < 0.025
          ? C.teal
          : C.copper
        : C.crimson;

      const slicePtsTop = [];
      const slicePtsBot = [];
      const nSlice = 96;
      for (let j = 0; j <= nSlice; j++) {
        const wN = wMin + ((wMax - wMin) * j) / nSlice;
        const z = surfaceHeight(sliceSig, wN);
        slicePtsTop.push(projSW(sliceSig, wN, z));
        slicePtsBot.push(projSW(sliceSig, wN, 0));
      }

      // Fill slice curtain under the curve
      ctx.save();
      ctx.fillStyle = wallColor;
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.moveTo(slicePtsBot[0].x, slicePtsBot[0].y);
      for (let j = 0; j <= nSlice; j++) ctx.lineTo(slicePtsTop[j].x, slicePtsTop[j].y);
      for (let j = nSlice; j >= 0; j--) ctx.lineTo(slicePtsBot[j].x, slicePtsBot[j].y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Highlighted slice curve |H(sigma_slice + i*omega)|
      ctx.strokeStyle = wallColor;
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      for (let j = 0; j <= nSlice; j++) {
        if (j === 0) ctx.moveTo(slicePtsTop[j].x, slicePtsTop[j].y);
        else ctx.lineTo(slicePtsTop[j].x, slicePtsTop[j].y);
      }
      ctx.stroke();

      // Also draw the dashed imaginary-axis FRF curve if slice != 0
      if (Math.abs(sliceSig) >= 0.025) {
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = C.teal;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        for (let j = 0; j <= nSlice; j++) {
          const wN = wMin + ((wMax - wMin) * j) / nSlice;
          const pt = projSW(0, wN, surfaceHeight(0, wN));
          if (j === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Draw poles as bold crimson X markers on z = 0 with vertical stems
      const poles = [state.sys.p1, state.sys.p2];
      poles.forEach(function (pole) {
        const pSigN = pole.re / state.sys.wn;
        const pWN = pole.im / state.sys.wn;
        if (pSigN < sigMin - 0.1 || pSigN > sigMax + 0.1) return;
        const base = projSW(pSigN, pWN, 0);
        const top = projSW(pSigN, pWN, 1.55);
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = C.crimson;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();
        ctx.restore();

        // X marker on s-plane
        ctx.strokeStyle = C.crimson;
        ctx.lineWidth = 2.4;
        const r = 5.5;
        ctx.beginPath();
        ctx.moveTo(base.x - r, base.y - r);
        ctx.lineTo(base.x + r, base.y + r);
        ctx.moveTo(base.x + r, base.y - r);
        ctx.lineTo(base.x - r, base.y + r);
        ctx.stroke();
      });

      // Axis labels in 3D space
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      const lblSig = projSW(sigMax + 0.18, 0, 0);
      ctx.fillStyle = C.text;
      ctx.textAlign = 'center';
      ctx.fillText('Re(s) = σ', lblSig.x, lblSig.y);

      const lblW = projSW(0, wMax + 0.25, 0);
      ctx.fillStyle = C.teal;
      ctx.fillText('Im(s) = iω', lblW.x, lblW.y);

      const lblZ = projSW(sigMin, wMin, 1.5);
      ctx.fillStyle = C.muted;
      ctx.fillText('|H(s)|', lblZ.x, lblZ.y - 6);

      // Header badge
      ctx.textAlign = 'left';
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.text;
      ctx.fillText('3D Laplace surface |H(σ + iω)| — drag to orbit', 14, 20);

      ctx.font = '500 11px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = wallColor;
      const sliceText =
        Math.abs(sliceSig) < 0.025
          ? 'Slice at σ = 0: exact Fourier FRF |H(iω)|'
          : sliceInRoc
            ? 'Slice at σ = ' + M1.fmt(sliceSig * state.sys.wn, 2) + ' s⁻¹ (inside ROC)'
            : 'Slice at σ = ' + M1.fmt(sliceSig * state.sys.wn, 2) + ' s⁻¹ (outside ROC: integral diverges)';
      ctx.fillText(sliceText, 14, 37);
    }

    function render2D() {
      const { ctx, w, h } = Theme.setupHiDPI(canvas2d);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      // Split vertically into two panels: Top = 2D s-plane pole-zero/ROC map; Bottom = slice curve or weighted h(t)
      const splitY = Math.round(h * 0.5);

      // Divider
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, splitY);
      ctx.lineTo(w, splitY);
      ctx.stroke();

      /* -------- TOP PANEL: 2D s-plane -------- */
      const padL = 52;
      const padR = 18;
      const topT = 26;
      const topB = splitY - 22;
      const topW = Math.max(40, w - padL - padR);
      const topH = Math.max(40, topB - topT);

      const sigMin = -2.0;
      const sigMax = 0.8;
      const wMax = 2.0;

      function sX(sigN) {
        return padL + ((sigN - sigMin) / (sigMax - sigMin)) * topW;
      }
      function sY(wN) {
        return topT + ((wMax - wN) / (2 * wMax)) * topH;
      }

      const sigma0N = state.sys.sigma0 / state.sys.wn;
      const rocX = Math.max(padL, Math.min(padL + topW, sX(sigma0N)));

      // Non-ROC & ROC shading
      ctx.fillStyle = C.nonRocFill;
      ctx.fillRect(padL, topT, Math.max(0, rocX - padL), topH);
      ctx.fillStyle = C.rocFill;
      ctx.fillRect(rocX, topT, Math.max(0, padL + topW - rocX), topH);

      // Grid
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let s = -2.0; s <= 0.51; s += 0.5) {
        const x = sX(s);
        ctx.beginPath();
        ctx.moveTo(x, topT);
        ctx.lineTo(x, topB);
        ctx.stroke();
      }
      for (let om = -2; om <= 2; om += 1) {
        const y = sY(om);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + topW, y);
        ctx.stroke();
      }

      // Constant-|s| = wn semicircle in LHP (exact locus of underdamped poles as zeta goes 0 -> 1!)
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = C.ref;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const ang = Math.PI / 2 + (Math.PI * i) / 60;
        const px = sX(Math.cos(ang));
        const py = sY(Math.sin(ang));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // Real axis & Imaginary axis (sigma = 0)
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, sY(0));
      ctx.lineTo(padL + topW, sY(0));
      ctx.stroke();

      ctx.strokeStyle = C.teal;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(sX(0), topT);
      ctx.lineTo(sX(0), topB);
      ctx.stroke();

      // ROC boundary vertical dashed line at sigma = sigma0
      ctx.save();
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = C.crimson;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(rocX, topT);
      ctx.lineTo(rocX, topB);
      ctx.stroke();
      ctx.restore();

      // Active slice line Re(s) = sigmaSlice
      const sliceSig = Math.max(sigMin, Math.min(sigMax, state.sigmaSlice));
      const sliceInRoc = sliceSig > sigma0N + 1e-4;
      const sliceColor = sliceInRoc
        ? Math.abs(sliceSig) < 0.025
          ? C.teal
          : C.copper
        : C.crimson;
      const slicePx = sX(sliceSig);
      ctx.strokeStyle = sliceColor;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(slicePx, topT);
      ctx.lineTo(slicePx, topB);
      ctx.stroke();

      // Poles as crisp crimson X
      [state.sys.p1, state.sys.p2].forEach(function (pole) {
        const px = sX(pole.re / state.sys.wn);
        const py = sY(pole.im / state.sys.wn);
        if (px < padL - 6 || px > padL + topW + 6) return;
        ctx.strokeStyle = C.crimson;
        ctx.lineWidth = 2.4;
        const r = 5.5;
        ctx.beginPath();
        ctx.moveTo(px - r, py - r);
        ctx.lineTo(px + r, py + r);
        ctx.moveTo(px + r, py - r);
        ctx.lineTo(px - r, py + r);
        ctx.stroke();
      });

      // Labels for top panel
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.text;
      ctx.textAlign = 'left';
      ctx.fillText('2D Complex s-plane: poles & Region of Convergence (ROC)', 14, 17);

      ctx.font = '600 10.5px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.teal;
      ctx.textAlign = 'right';
      ctx.fillText('ROC: Re(s) > ' + M1.fmt(state.sys.sigma0, 2), padL + topW - 6, topT + 14);

      ctx.fillStyle = C.muted;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      [-1.5, -1.0, -0.5, 0, 0.5].forEach(function (sv) {
        ctx.fillText(sv === 0 ? '0' : sv + 'ωₙ', sX(sv), topB + 13);
      });
      ctx.textAlign = 'right';
      ctx.fillText('+2ωₙ', padL - 6, sY(2) + 4);
      ctx.fillText('0', padL - 6, sY(0) + 4);
      ctx.fillText('-2ωₙ', padL - 6, sY(-2) + 4);

      /* -------- BOTTOM PANEL: Slice Magnitude OR Weighted h(t) e^{-sigma t} -------- */
      const botT = splitY + 28;
      const botB = h - 28;
      const botW = topW;
      const botH = Math.max(40, botB - botT);

      if (state.bottomMode === 'slice') {
        // Plot k * |H(sigmaSlice + i*omega)| vs. omega/wn in [0, 2.5]
        const rMax = 2.5;
        const yMax = Math.min(12.0, Math.max(2.5, state.sys.includesImagAxis ? Math.min(10, 1 / Math.max(0.08, 2 * state.sys.zeta) * 1.25) : 6.0));

        function rx(r) {
          return padL + (r / rMax) * botW;
        }
        function ry(val) {
          return botB - (Math.min(yMax, val) / yMax) * botH;
        }

        // Grid
        ctx.strokeStyle = C.grid;
        ctx.lineWidth = 1;
        for (let r = 0; r <= 2.5; r += 0.5) {
          ctx.beginPath();
          ctx.moveTo(rx(r), botT);
          ctx.lineTo(rx(r), botB);
          ctx.stroke();
        }
        for (let i = 0; i <= 4; i++) {
          const y = botT + (i / 4) * botH;
          ctx.beginPath();
          ctx.moveTo(padL, y);
          ctx.lineTo(padL + botW, y);
          ctx.stroke();
        }

        // Axes
        ctx.strokeStyle = C.axis;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(padL, botT);
        ctx.lineTo(padL, botB);
        ctx.lineTo(padL + botW, botB);
        ctx.stroke();

        // Reference FRF curve at sigma = 0 (dashed teal)
        const N = 220;
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = C.teal;
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const r = (i / N) * rMax;
          const H0 = M1.transferH(state.sys, M1.C(0, r * state.sys.wn));
          const mag = state.sys.k * M1.cAbs(H0);
          const px = rx(r);
          const py = ry(mag);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();

        // Active slice curve k * |H(sigmaSlice + i*omega)|
        ctx.strokeStyle = sliceColor;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const r = (i / N) * rMax;
          const Hs = M1.transferH(state.sys, M1.C(sliceSig * state.sys.wn, r * state.sys.wn));
          const mag = state.sys.k * M1.cAbs(Hs);
          const px = rx(r);
          const py = ry(mag);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Ticks & labels
        ctx.fillStyle = C.text;
        ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Cross-section k·|H(σ + iω)| vs. Fourier FRF k·|H(iω)|', 14, splitY + 17);

        ctx.fillStyle = C.muted;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        [0, 0.5, 1.0, 1.5, 2.0, 2.5].forEach(function (rv) {
          ctx.fillText(rv === 1 ? 'ωₙ' : rv + 'ωₙ', rx(rv), botB + 14);
        });
        ctx.textAlign = 'right';
        ctx.fillText(M1.fmt(yMax, 1), padL - 6, botT + 6);
        ctx.fillText(M1.fmt(yMax * 0.5, 1), padL - 6, botT + botH * 0.5 + 4);
        ctx.fillText('0', padL - 6, botB + 3);
      } else {
        // Weighted impulse response h(t) * e^{-sigmaSlice * wn * t} — shows CONVERGENCE vs DIVERGENCE!
        const T0 = (2 * Math.PI) / state.sys.wn;
        const tMax = 4.5 * T0;
        const midY = botT + botH * 0.5;
        const baseScale = 1.35 / (state.sys.m * state.sys.wn);

        function tx(t) {
          return padL + (t / tMax) * botW;
        }
        function ty(val) {
          return midY - Math.max(-1.25, Math.min(1.25, val / baseScale)) * (botH * 0.43);
        }

        // Grid & zero axis
        ctx.strokeStyle = C.grid;
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
          const x = padL + (i / 4) * botW;
          ctx.beginPath();
          ctx.moveTo(x, botT);
          ctx.lineTo(x, botB);
          ctx.stroke();
        }
        ctx.strokeStyle = C.axis;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(padL, midY);
        ctx.lineTo(padL + botW, midY);
        ctx.moveTo(padL, botT);
        ctx.lineTo(padL, botB);
        ctx.stroke();

        // Unweighted h(t) dashed reference
        const N = 260;
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = C.ref;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const tt = (i / N) * tMax;
          const val = M1.impulseResponse(state.sys, tt);
          if (i === 0) ctx.moveTo(tx(tt), ty(val));
          else ctx.lineTo(tx(tt), ty(val));
        }
        ctx.stroke();
        ctx.restore();

        // Weighted signal h(t) e^{-sigma t}
        const sigPhys = sliceSig * state.sys.wn;
        ctx.strokeStyle = sliceColor;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const tt = (i / N) * tMax;
          const wFactor = Math.exp(Math.max(-20, Math.min(10, -sigPhys * tt)));
          const val = M1.impulseResponse(state.sys, tt) * wFactor;
          if (i === 0) ctx.moveTo(tx(tt), ty(val));
          else ctx.lineTo(tx(tt), ty(val));
        }
        ctx.stroke();

        ctx.fillStyle = C.text;
        ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(
          'Exponentially weighted kernel h(t)·e^(−σt) — ' +
            (sliceInRoc ? 'decays (Fourier integral converges)' : 'grows (integral diverges)'),
          14,
          splitY + 17
        );

        ctx.fillStyle = C.muted;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        for (let i = 0; i <= 4; i++) {
          ctx.fillText(M1.fmt((i / 4) * tMax, 1) + 's', padL + (i / 4) * botW, botB + 14);
        }
        ctx.textAlign = 'right';
        ctx.fillText('0', padL - 6, midY + 4);
      }
    }

    function render() {
      render3D();
      render2D();
    }

    return {
      setSystem,
      setSigmaSlice,
      setBottomMode,
      toggleAutoRotate,
      resetCamera,
      setVisible,
      step,
      render
    };
  }

  return { create };
})();
