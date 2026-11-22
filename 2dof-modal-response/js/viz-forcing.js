/**
 * viz-forcing.js
 * Section 3 visualization for Module 04 (2dof-modal-response):
 * - Left canvas: Interactive physical forcing plane (F1, F2) with draggable harmonic force
 *                amplitude vector f0 = [F1, F2]^T, mode shapes u1, u2, zero-excitation lines
 *                u1^T f0 = 0 and u2^T f0 = 0, and modal generalized force projections Q1, Q2.
 * - Right canvas: Steady-state forced amplitude spectrum |X1(w)|, |X2(w)| (log scale)
 *                 demonstrating selective excitation and complete peak suppression when
 *                 f0 is orthogonal to a mode shape (Q_j = u_j^T f0 = 0).
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathModal2DOF;
  const Theme = window.VibLab.Theme;

  function createForcingViz(opts) {
    const projCanvas = document.getElementById(opts.projCanvasId);
    const respCanvas = document.getElementById(opts.respCanvasId);
    let sys = opts.sys;

    const state = {
      f0: [1.0, 0.0],
      dragging: false
    };

    const view = { cx: 0, cy: 0, scale: 1 };

    function setSystem(newSys) {
      sys = newSys;
      render();
    }

    function setForce(f0) {
      state.f0 = [f0[0], f0[1]];
      if (opts.onForceChange) opts.onForceChange(state.f0);
      render();
    }

    function setPresetForce(kind) {
      if (kind === 'm1') {
        setForce([1.0, 0.0]);
      } else if (kind === 'm2') {
        setForce([0.0, 1.0]);
      } else if (kind === 'orth1') {
        // u1^T f0 = 0 -> f0 proportional to [-u1_2, u1_1]
        const n = Math.hypot(sys.u1[0], sys.u1[1]);
        setForce([-sys.u1[1] / n, sys.u1[0] / n]);
      } else if (kind === 'orth2') {
        // u2^T f0 = 0 -> f0 proportional to [u2_2, -u2_1] (or [-u2_2, u2_1])
        const n = Math.hypot(sys.u2[0], sys.u2[1]);
        let fx = -sys.u2[1] / n;
        let fy = sys.u2[0] / n;
        if (fx < 0) {
          fx = -fx;
          fy = -fy;
        }
        setForce([fx, fy]);
      } else if (kind === 'inphase') {
        setForce([0.7071, 0.7071]);
      } else if (kind === 'outphase') {
        setForce([0.7071, -0.7071]);
      }
    }

    function drawProjCanvas() {
      if (!projCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(projCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const range = 1.65;
      const pad = 32;
      const scale = Math.min((w - 2 * pad) / (2 * range), (h - 2 * pad) / (2 * range));
      const cx = w * 0.5;
      const cy = h * 0.52;
      view.cx = cx;
      view.cy = cy;
      view.scale = scale;

      const toX = (x) => cx + x * scale;
      const toY = (y) => cy - y * scale;

      // Grid
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

      // Axes
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(14, cy);
      ctx.lineTo(w - 14, cy);
      ctx.moveTo(cx, 14);
      ctx.lineTo(cx, h - 14);
      ctx.stroke();

      // Unit force circle ||f0|| = 1
      ctx.save();
      ctx.strokeStyle = C.ref;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(cx, cy, scale, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();

      // Zero-excitation lines: u1^T f0 = 0 (suppresses Mode 1) and u2^T f0 = 0 (suppresses Mode 2)
      const u1 = sys.u1;
      const u2 = sys.u2;
      const n1 = Math.hypot(u1[0], u1[1]);
      const n2 = Math.hypot(u2[0], u2[1]);
      const u1Hat = [u1[0] / n1, u1[1] / n1];
      const u2Hat = [u2[0] / n2, u2[1] / n2];

      function drawZeroLine(uHat, color, label) {
        // Perpendicular to uHat
        const px = -uHat[1];
        const py = uHat[0];
        const L = range * 1.15;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(toX(-px * L), toY(-py * L));
        ctx.lineTo(toX(px * L), toY(py * L));
        ctx.stroke();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = color;
        ctx.font = '600 10.5px "IBM Plex Mono", monospace';
        const lx = toX(px * 1.24);
        const ly = toY(py * 1.24);
        ctx.textAlign = px >= 0 ? 'left' : 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, lx + (px >= 0 ? 4 : -4), ly);
        ctx.restore();
      }

      drawZeroLine(u1Hat, C.teal, 'Q₁=0 (no Mode 1)');
      drawZeroLine(u2Hat, C.crimson, 'Q₂=0 (no Mode 2)');

      // Mode direction rays u1, u2 (scaled to 1.05 for clear visual reference)
      Theme.drawArrow(ctx, cx, cy, toX(u1Hat[0] * 1.05), toY(u1Hat[1] * 1.05), C.teal, 2.0, 8);
      Theme.drawArrow(ctx, cx, cy, toX(u2Hat[0] * 1.05), toY(u2Hat[1] * 1.05), C.crimson, 2.0, 8);

      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.teal;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('u₁ dir', toX(u1Hat[0] * 1.08) + 4, toY(u1Hat[1] * 1.08));
      ctx.fillStyle = C.crimson;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('u₂ dir', toX(u2Hat[0] * 1.08) - 4, toY(u2Hat[1] * 1.08));

      // Orthogonal drops from f0 onto u1Hat and u2Hat (geometric meaning of Euclidean dot product Q_j = u_j^T f0!)
      const f0 = state.f0;
      const p1 = f0[0] * u1Hat[0] + f0[1] * u1Hat[1];
      const p2 = f0[0] * u2Hat[0] + f0[1] * u2Hat[1];

      ctx.save();
      ctx.strokeStyle = C.teal;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(toX(f0[0]), toY(f0[1]));
      ctx.lineTo(toX(p1 * u1Hat[0]), toY(p1 * u1Hat[1]));
      ctx.stroke();

      ctx.strokeStyle = C.crimson;
      ctx.beginPath();
      ctx.moveTo(toX(f0[0]), toY(f0[1]));
      ctx.lineTo(toX(p2 * u2Hat[0]), toY(p2 * u2Hat[1]));
      ctx.stroke();
      ctx.restore();

      // Highlighted projection lengths
      ctx.save();
      ctx.strokeStyle = C.teal;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(toX(p1 * u1Hat[0]), toY(p1 * u1Hat[1]));
      ctx.stroke();

      ctx.strokeStyle = C.crimson;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(toX(p2 * u2Hat[0]), toY(p2 * u2Hat[1]));
      ctx.stroke();
      ctx.restore();

      // Force vector f0
      Theme.drawArrow(ctx, cx, cy, toX(f0[0]), toY(f0[1]), C.copper, 2.6, 10);
      ctx.fillStyle = C.copper;
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(toX(f0[0]), toY(f0[1]), 6.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = C.copper;
      ctx.font = '600 12px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('f₀ (drag)', toX(f0[0]) + 10, toY(f0[1]) - 4);

      // Axis labels
      ctx.fillStyle = C.textMuted;
      ctx.font = '600 12px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('F₁ (N)', w - 16, cy - 6);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('F₂ (N)', cx + 8, 18);
    }

    function drawRespCanvas() {
      if (!respCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(respCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 56;
      const padR = 20;
      const padT = 26;
      const padB = 44;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const N = 320;
      const wMax = sys.wMax;
      const ws = new Array(N + 1);
      const x1Mag = new Array(N + 1);
      const x2Mag = new Array(N + 1);

      let maxVal = 1e-4;
      for (let i = 0; i <= N; i++) {
        const ww = (wMax * i) / N;
        ws[i] = ww;
        const res = M.evalForcedHarmonic(sys, state.f0, ww);
        const a1 = M.cAbs(res.X1);
        const a2 = M.cAbs(res.X2);
        x1Mag[i] = a1;
        x2Mag[i] = a2;
        if (a1 > maxVal) maxVal = a1;
        if (a2 > maxVal) maxVal = a2;
      }

      // Log10 y-axis spanning 4 decades below top decade
      const logMax = Math.ceil(Math.log10(Math.max(0.2, maxVal * 1.4)));
      const logMin = logMax - 4;

      const toX = (ww) => padL + (ww / wMax) * plotW;
      const toY = (val) => {
        const lv = Math.max(logMin, Math.min(logMax, Math.log10(Math.max(1e-8, val))));
        return padT + ((logMax - lv) / (logMax - logMin)) * plotH;
      };

      // Grid
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

        ctx.fillStyle = C.textMuted;
        ctx.font = '500 10.5px "IBM Plex Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('10' + (d === 0 ? '⁰' : d === 1 ? '¹' : d === -1 ? '⁻¹' : d === -2 ? '⁻²' : d === -3 ? '⁻³' : d === -4 ? '⁻⁴' : '^' + d), padL - 7, py);
      }

      // Natural frequency reference lines
      function drawFreqLine(wf, label, color) {
        const px = toX(wf);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(px, padT);
        ctx.lineTo(px, padT + plotH);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = '600 11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, px, padT - 4);
        ctx.restore();
      }

      drawFreqLine(sys.w1, 'ω₁=' + M.fmt(sys.w1, 2), C.teal);
      drawFreqLine(sys.w2, 'ω₂=' + M.fmt(sys.w2, 2), C.crimson);

      // Plot |X1(w)| and |X2(w)|
      function drawCurve(arr, color, width) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const px = toX(ws[i]);
          const py = toY(arr[i]);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }

      drawCurve(x1Mag, C.blue, 2.2);
      drawCurve(x2Mag, C.orange, 2.0);

      // Border
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      // X-axis ticks & label
      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const stepW = wMax > 10 ? 2 : 1;
      for (let ww = 0; ww <= wMax + 1e-6; ww += stepW) {
        const px = toX(ww);
        ctx.fillText(M.fmt(ww, 0), px, padT + plotH + 6);
      }
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.fillText('Forcing frequency ω (rad/s)', padL + plotW * 0.5, h - 14);

      // Modal suppression badge if Q1 or Q2 is near zero
      const Q = M.forceToModal(sys, state.f0);
      const qNorm = Math.hypot(Q[0], Q[1]);
      if (qNorm > 1e-6) {
        const ratio1 = Math.abs(Q[0]) / qNorm;
        const ratio2 = Math.abs(Q[1]) / qNorm;
        let badge = null;
        let badgeCol = C.teal;
        if (ratio1 < 0.04) {
          badge = 'Mode 1 suppressed (Q₁ ≈ 0)';
          badgeCol = C.teal;
        } else if (ratio2 < 0.04) {
          badge = 'Mode 2 suppressed (Q₂ ≈ 0)';
          badgeCol = C.crimson;
        }
        if (badge) {
          ctx.save();
          ctx.fillStyle = C.bg;
          ctx.strokeStyle = badgeCol;
          ctx.lineWidth = 1.5;
          const bw = 205;
          const bx = padL + plotW - bw - 10;
          const by = padT + 10;
          ctx.fillRect(bx, by, bw, 24);
          ctx.strokeRect(bx, by, bw, 24);
          ctx.fillStyle = badgeCol;
          ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badge, bx + bw * 0.5, by + 12);
          ctx.restore();
        }
      }
    }

    function render() {
      drawProjCanvas();
      drawRespCanvas();
    }

    if (projCanvas) {
      function updateFromPointer(e) {
        const rect = projCanvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const fx = Math.max(-1.45, Math.min(1.45, (px - view.cx) / view.scale));
        const fy = Math.max(-1.45, Math.min(1.45, (view.cy - py) / view.scale));
        setForce([fx, fy]);
      }

      projCanvas.addEventListener('pointerdown', function (e) {
        state.dragging = true;
        projCanvas.setPointerCapture(e.pointerId);
        updateFromPointer(e);
      });
      projCanvas.addEventListener('pointermove', function (e) {
        if (!state.dragging) return;
        updateFromPointer(e);
      });
      projCanvas.addEventListener('pointerup', function () {
        state.dragging = false;
      });
      projCanvas.addEventListener('pointercancel', function () {
        state.dragging = false;
      });
    }

    return {
      setSystem,
      setForce,
      getForce: () => state.f0.slice(),
      setPresetForce,
      render
    };
  }

  window.VibLab.VizForcing = { create: createForcingViz };
})();
