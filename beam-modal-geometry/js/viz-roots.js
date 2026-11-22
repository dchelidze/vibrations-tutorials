/**
 * viz-roots.js
 * Section 1 visualization for Module 06 (beam-modal-geometry):
 * - Left canvas: Graphical root-finding of the transcendental characteristic equation
 *                over beta*L in [0, 18.5], with clickable root markers for Modes 1..5.
 * - Right canvas: Live animated vibrating Euler-Bernoulli mode shape phi_n(x/L) cos(w_n t),
 *                 boundary support icons, and interior nodal dots (phi_n = 0).
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathBeam;
  const Theme = window.VibLab.Theme;

  function createRootsViz(opts) {
    const rootsCanvas = document.getElementById(opts.rootsCanvasId);
    const modeCanvas = document.getElementById(opts.modeCanvasId);
    let sys = opts.sys;
    let activeMode = 0; // 0..4
    let phase = 0;
    let playing = true;

    const rootPixels = [];

    function setSystem(newSys) {
      sys = newSys;
      render();
    }

    function setActiveMode(idx) {
      activeMode = Math.max(0, Math.min(M.N_MODES - 1, idx));
      render();
    }

    function setPlaying(p) {
      playing = !!p;
    }

    function step(dt) {
      if (!playing) return;
      // Scale visual speed mildly with mode number so higher modes vibrate noticeably faster
      const m = sys.modes[activeMode];
      const visRate = Math.min(8.5, 2.4 + 0.9 * Math.sqrt(m.omegaRel));
      phase += dt * visRate;
      drawModeCanvas();
    }

    function drawRootsCanvas() {
      if (!rootsCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(rootsCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 52;
      const padR = 18;
      const padT = 28;
      const padB = 40;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const xMax = 18.5;
      const yMin = -1.35;
      const yMax = 1.35;
      const toX = (lam) => padL + (lam / xMax) * plotW;
      const toY = (v) => padT + ((yMax - v) / (yMax - yMin)) * plotH;

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      // Grid & zero line
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      [-1, -0.5, 0, 0.5, 1].forEach((yv) => {
        const py = toY(yv);
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();

        ctx.fillStyle = C.textMuted;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(M.fmt(yv, 1), padL - 6, py);
      });

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, toY(0));
      ctx.lineTo(padL + plotW, toY(0));
      ctx.stroke();

      // Plot the two intersecting curves cleanly (all bounded in [-1.3, 1.3]!)
      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      const N = 420;
      function plotFn(fn, color, width, dash) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const lam = (xMax * i) / N;
          const val = fn(lam);
          const px = toX(lam);
          const py = toY(val);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }

      if (sys.bc === 'SS') {
        plotFn((l) => Math.sin(l), C.blue, 2.2, null);
        plotFn(() => 0, C.orange, 1.6, [5, 4]);
      } else if (sys.bc === 'CF') {
        plotFn((l) => Math.cos(l), C.blue, 2.2, null);
        plotFn((l) => -1 / Math.cosh(l), C.orange, 2.2, null);
      } else if (sys.bc === 'CC' || sys.bc === 'FF') {
        plotFn((l) => Math.cos(l), C.blue, 2.2, null);
        plotFn((l) => 1 / Math.cosh(l), C.orange, 2.2, null);
      } else {
        // CP: sin(lam) = cos(lam) tanh(lam)
        plotFn((l) => Math.sin(l), C.blue, 2.2, null);
        plotFn((l) => Math.cos(l) * Math.tanh(l), C.orange, 2.2, null);
      }

      // Draw clickable intersection roots
      rootPixels.length = 0;
      sys.modes.forEach((m, idx) => {
        const rx = toX(m.lam);
        let ryVal = 0;
        if (sys.bc === 'CF') ryVal = -1 / Math.cosh(m.lam);
        else if (sys.bc === 'CC' || sys.bc === 'FF') ryVal = 1 / Math.cosh(m.lam);
        else if (sys.bc === 'CP') ryVal = Math.sin(m.lam);
        const ry = toY(ryVal);
        rootPixels.push({ idx, x: rx, y: ry });

        const isSel = idx === activeMode;
        if (isSel) {
          ctx.save();
          ctx.strokeStyle = C.copper;
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(rx, padT);
          ctx.lineTo(rx, padT + plotH);
          ctx.stroke();
          ctx.restore();
        }

        ctx.fillStyle = isSel ? C.copper : C.teal;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rx, ry, isSel ? 7 : 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        Theme.drawMath(
          ctx,
          [{ t: 'n', i: true, bold: isSel }, { t: '=' + m.n, bold: isSel }],
          rx,
          ry + (idx % 2 === 0 ? -16 : 16),
          { size: 10.5, color: isSel ? C.copper : C.textMuted, align: 'center', family: '"IBM Plex Mono", monospace' }
        );
      });

      ctx.restore();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      // X ticks in multiples of pi
      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let k = 0; k <= 5; k++) {
        const px = toX(k * Math.PI);
        ctx.fillText(k === 0 ? '0' : k === 1 ? 'π' : k + 'π', px, padT + plotH + 6);
      }
      Theme.drawMath(
        ctx,
        [{ t: 'Dimensionless wavenumber β', bold: true }, { t: 'L', i: true, bold: true }, { t: '  (click any root)', bold: true }],
        padL + plotW * 0.5,
        h - 11,
        { size: 11.5, color: C.text, align: 'center' }
      );

      // Legend header
      let legRuns;
      if (sys.bc === 'SS') {
        legRuns = [{ t: 'Blue: sin(β', bold: true }, { t: 'L', i: true, bold: true }, { t: ')   ·   Orange: 0', bold: true }];
      } else if (sys.bc === 'CF') {
        legRuns = [{ t: 'Blue: cos(β', bold: true }, { t: 'L', i: true, bold: true }, { t: ')   ·   Orange: −1/cosh(β', bold: true }, { t: 'L', i: true, bold: true }, { t: ')', bold: true }];
      } else if (sys.bc === 'CC' || sys.bc === 'FF') {
        legRuns = [{ t: 'Blue: cos(β', bold: true }, { t: 'L', i: true, bold: true }, { t: ')   ·   Orange: +1/cosh(β', bold: true }, { t: 'L', i: true, bold: true }, { t: ')', bold: true }];
      } else {
        legRuns = [{ t: 'Blue: sin(β', bold: true }, { t: 'L', i: true, bold: true }, { t: ')   ·   Orange: cos(β', bold: true }, { t: 'L', i: true, bold: true }, { t: ')tanh(β', bold: true }, { t: 'L', i: true, bold: true }, { t: ')', bold: true }];
      }
      Theme.drawMath(ctx, legRuns, padL, padT - 13, { size: 11, color: C.textMuted, align: 'left' });
    }

    function drawModeCanvas() {
      if (!modeCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(modeCanvas);
      const C = Theme.get();
      const m = sys.modes[activeMode];

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 38;
      const padR = 38;
      const beamW = w - padL - padR;
      const midY = h * 0.52;
      const ampPx = h * 0.28;
      const cosT = Math.cos(phase);

      const toX = (xi) => padL + xi * beamW;
      const toY = (val) => midY - (val / m.maxAbs) * ampPx;

      // Dashed undeformed neutral axis
      ctx.save();
      ctx.strokeStyle = C.ref;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, midY);
      ctx.lineTo(padL + beamW, midY);
      ctx.stroke();
      ctx.restore();

      // Ghost envelope +-phi_n(xi)
      const N = 220;
      [1, -1].forEach((sgn) => {
        ctx.save();
        ctx.strokeStyle = C.blue;
        ctx.globalAlpha = 0.24;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const xi = i / N;
          const px = toX(xi);
          const py = toY(sgn * m.eval(xi));
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      });

      // Live animated deflected beam curve
      ctx.save();
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const xi = i / N;
        const px = toX(xi);
        const py = toY(cosT * m.eval(xi));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // Draw boundary supports (follow free tips when free!)
      const leftY = sys.info.leftEnd === 'free' ? toY(cosT * m.eval(0)) : midY;
      const rightY = sys.info.rightEnd === 'free' ? toY(cosT * m.eval(1)) : midY;
      Theme.drawSupport(ctx, padL, leftY, sys.info.leftEnd, -1, C);
      Theme.drawSupport(ctx, padL + beamW, rightY, sys.info.rightEnd, +1, C);

      // Interior nodal points (stationary points phi_n = 0!)
      m.nodes.forEach((nx) => {
        const px = toX(nx);
        ctx.fillStyle = C.crimson;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, midY, 5.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = C.crimson;
        ctx.font = '600 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(M.fmt(nx, 2) + 'L', px, midY + 10);
      });

      // Top & bottom annotations
      Theme.drawMath(
        ctx,
        [
          { t: 'Mode ' + m.n + ':  β', bold: true },
          { t: String(m.n), sub: true, bold: true },
          { t: 'L', i: true, bold: true },
          { t: ' = ' + M.fmt(m.lam, 3) + '   ·   ω', bold: true },
          { t: String(m.n), sub: true, bold: true },
          { t: '/ω', bold: true },
          { t: '1', sub: true, bold: true },
          { t: ' = ' + M.fmt(m.omegaRel, 2), bold: true }
        ],
        14,
        16,
        { size: 12, color: C.text, align: 'left' }
      );

      ctx.fillStyle = C.textMuted;
      ctx.font = '500 11px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(
        m.nodes.length === 0
          ? 'Zero interior nodes (fundamental flexing mode)'
          : 'Crimson dots: ' + m.nodes.length + ' stationary interior node' + (m.nodes.length > 1 ? 's' : '') + ' (φ = 0)',
        14,
        h - 10
      );
    }

    function render() {
      drawRootsCanvas();
      drawModeCanvas();
    }

    if (rootsCanvas) {
      rootsCanvas.addEventListener('pointerdown', (e) => {
        const rect = rootsCanvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        let best = -1;
        let bestD = 32;
        for (const rp of rootPixels) {
          const d = Math.hypot(px - rp.x, py - rp.y);
          if (d < bestD) {
            bestD = d;
            best = rp.idx;
          }
        }
        if (best >= 0) {
          activeMode = best;
          if (opts.onModeSelect) opts.onModeSelect(best);
          render();
        }
      });
    }

    return {
      setSystem,
      setActiveMode,
      setPlaying,
      isPlaying: () => playing,
      step,
      render
    };
  }

  window.VibLab.VizRoots = { create: createRootsViz };
})();
