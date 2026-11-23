/**
 * viz-unbalance.js
 * Section 4 visualization for Module 09 (sdof-base-sensors):
 * Animated rotating-unbalance machine M with eccentric mass m_0 at radius e spinning at rate w:
 * - Left panel: Physical housing on spring-damper mount with spinning rotor, heavy spot, and
 *               combined center-of-mass indicator showing the 180-deg phase flip across r = 1.
 * - Right panel: Synchronous waveforms of eccentric vertical offset cos(wt), housing response
 *                M x(t)/(m_0 e) = |H_rel| cos(wt + phi_rel), and center of mass
 *                M x_CM(t)/(m_0 e) = |H_abs| cos(wt + phi_abs).
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathSensors;
  const Theme = window.VibLab.Theme;

  function createUnbalanceViz(opts) {
    const canvas = document.getElementById(opts.canvasId);
    let sys = opts.sys;
    let phase = 0;

    function setSystem(newSys) { sys = newSys; }
    function setPhase(p) { phase = p; }

    function render() {
      if (!canvas) return;
      const { ctx, w, h } = Theme.setupCanvas(canvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const splitX = Math.round(w * 0.42);

      // Divider
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(splitX, 14);
      ctx.lineTo(splitX, h - 14);
      ctx.stroke();

      // ===== LEFT PANEL: SPINNING ECCENTRIC ROTOR ON SPRING-MOUNTED MACHINE =====
      const cx = splitX * 0.47;
      const floorY = h - 42;
      const eqY = h * 0.45;

      // Normalized harmonic quantities:
      // Eccentric mass vertical offset: e cos(phase) -> top of circle at phase = 0
      const eccNorm = Math.cos(phase);
      const eccX = Math.sin(phase);
      // Housing motion: (M / (m_0 e)) x(t) = Rrel * cos(phase + phRel)
      const houseNorm = sys.Rrel * Math.cos(phase + sys.phRel);
      // Center of mass: (M / (m_0 e)) x_CM(t) = cos(phase) + houseNorm === Td * cos(phase + phAbs)
      const cmNorm = sys.Td * Math.cos(phase + sys.phAbs);

      // Visual amplitude scaling (clamped so large resonance stays comfortably inside panel)
      const ampScale = Math.min(24, 34 / Math.max(1.2, sys.Rrel));
      const yHouse = eqY - houseNorm * ampScale;

      // Fixed floor
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 86, floorY);
      ctx.lineTo(cx + 86, floorY);
      ctx.stroke();
      ctx.lineWidth = 1;
      for (let hx = cx - 80; hx <= cx + 80; hx += 10) {
        ctx.beginPath();
        ctx.moveTo(hx, floorY);
        ctx.lineTo(hx - 6, floorY + 8);
        ctx.stroke();
      }

      // Equilibrium reference line
      ctx.save();
      ctx.strokeStyle = C.gridStrong;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(22, eqY);
      ctx.lineTo(splitX - 16, eqY);
      ctx.stroke();
      ctx.restore();
      Theme.drawMath(ctx, [{ t: 'x', i: true }, { t: ' = 0' }], 24, eqY - 10, { size: 10, color: C.textMuted, align: 'left' });

      // Housing geometry (auto-sized generously)
      const boxW = Math.min(138, splitX * 0.56);
      const boxH = 88;
      const boxLeft = cx - boxW * 0.5;
      const boxTop = yHouse - boxH * 0.5;
      const boxBot = yHouse + boxH * 0.5;

      // Spring (left) and Damper (right)
      Theme.drawSpring(ctx, cx - boxW * 0.28, floorY, cx - boxW * 0.28, boxBot, 6, 8, C.blue, 1.9);
      Theme.drawDamper(ctx, cx + boxW * 0.28, floorY, cx + boxW * 0.28, boxBot, C.orange, 1.7);

      // Machine housing box
      ctx.fillStyle = C.dark ? 'rgba(240,101,127,0.14)' : 'rgba(162,20,47,0.08)';
      ctx.strokeStyle = C.crimson;
      ctx.lineWidth = 2.2;
      ctx.fillRect(boxLeft, boxTop, boxW, boxH);
      ctx.strokeRect(boxLeft, boxTop, boxW, boxH);

      // Rotor disc inside housing
      const rotorR = 28;
      ctx.fillStyle = C.bgSubtle;
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, yHouse, rotorR, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Rotor spoke to eccentric mass m_0
      const eccR = rotorR - 5;
      const mx = cx + eccX * eccR;
      const my = yHouse - eccNorm * eccR; // phase=0 => top
      ctx.strokeStyle = C.orange;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(cx, yHouse);
      ctx.lineTo(mx, my);
      ctx.stroke();

      // Hub center
      ctx.fillStyle = C.axis;
      ctx.beginPath();
      ctx.arc(cx, yHouse, 3, 0, 2 * Math.PI);
      ctx.fill();

      // Heavy spot m_0
      ctx.fillStyle = C.orange;
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(mx, my, 6.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Combined center of mass marker on right edge of housing
      const yCM = eqY - cmNorm * ampScale;
      ctx.fillStyle = C.teal;
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(boxLeft + boxW + 10, yCM);
      ctx.lineTo(boxLeft + boxW + 18, yCM - 5);
      ctx.lineTo(boxLeft + boxW + 18, yCM + 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      Theme.drawMath(ctx, [{ t: 'CM', bold: true }], boxLeft + boxW + 22, yCM, { size: 10, color: C.teal, align: 'left' });

      // Labels for M, k, c
      Theme.drawMath(ctx, [{ t: 'M', i: true, bold: true }], boxLeft + 8, boxTop + 13, { size: 11.5, color: C.crimson, align: 'left' });
      Theme.drawMath(ctx, [{ t: 'm', i: true, bold: true }, { t: '0', sub: true, bold: true }], boxLeft + boxW - 8, boxTop + 13, { size: 10.5, color: C.orange, align: 'right' });
      Theme.drawMath(ctx, [{ t: 'k', i: true }], cx - boxW * 0.28 - 14, (floorY + boxBot) * 0.5, { size: 11, color: C.blue, align: 'right' });
      Theme.drawMath(ctx, [{ t: 'c', i: true }], cx + boxW * 0.28 + 14, (floorY + boxBot) * 0.5, { size: 11, color: C.orange, align: 'left' });

      // Panel title & regime tag
      Theme.drawMath(ctx, [{ t: 'Rotating unbalance (', bold: true }, { t: 'm', i: true, bold: true }, { t: '0', sub: true, bold: true }, { t: 'e', i: true, bold: true }, { t: ')', bold: true }], 16, 18, { size: 11.5, color: C.text, align: 'left' });
      const regimeTxt = sys.r < 0.85
        ? 'Subcritical: heavy spot & housing in phase'
        : sys.r <= 1.18
        ? 'Resonance: housing lags rotor by ~90°'
        : 'Supercritical: 180° flip stabilizes CM';
      Theme.drawMath(ctx, [{ t: regimeTxt, bold: true }], cx, h - 13, {
        size: 10.5,
        color: sys.r > 1.18 ? C.teal : sys.r >= 0.85 ? C.copper : C.blue,
        align: 'center'
      });

      // ===== RIGHT PANEL: SYNCHRONOUS WAVEFORMS =====
      const padL = splitX + 44, padR = 18, padT = 32, padB = 34;
      const plotW = w - padL - padR, plotH = h - padT - padB;
      const cycles = 2.0;
      const yLim = Math.max(1.8, Math.min(4.5, Math.max(sys.Rrel, sys.Td) * 1.18));
      const toX = (theta) => padL + (theta / (cycles * 2 * Math.PI)) * plotW;
      const toY = (v) => padT + plotH * 0.5 - (v / yLim) * (plotH * 0.45);

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, plotH);

      // Zero axis
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, toY(0));
      ctx.lineTo(padL + plotW, toY(0));
      ctx.stroke();

      // Y ticks
      [-1, 0, 1].forEach((yv) => {
        const py = toY(yv);
        ctx.fillStyle = C.textMuted;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(yv), padL - 6, py);
      });

      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      const N = 220;
      const phMod = ((phase % (cycles * 2 * Math.PI)) + cycles * 2 * Math.PI) % (cycles * 2 * Math.PI);

      // 1. Eccentric vertical offset cos(theta)
      ctx.strokeStyle = C.orange;
      ctx.setLineDash([5, 3]);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const th = (cycles * 2 * Math.PI * i) / N;
        const px = toX(th), py = toY(Math.cos(th));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Housing response M x / (m_0 e)
      ctx.strokeStyle = C.crimson;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const th = (cycles * 2 * Math.PI * i) / N;
        const px = toX(th), py = toY(sys.Rrel * Math.cos(th + sys.phRel));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // 3. Combined center of mass M x_CM / (m_0 e) = H_abs
      ctx.strokeStyle = C.teal;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const th = (cycles * 2 * Math.PI * i) / N;
        const px = toX(th), py = toY(sys.Td * Math.cos(th + sys.phAbs));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Live vertical time cursor + dots
      const curX = toX(phMod);
      ctx.strokeStyle = C.copper;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(curX, padT);
      ctx.lineTo(curX, padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      [
        { v: Math.cos(phMod), col: C.orange },
        { v: sys.Rrel * Math.cos(phMod + sys.phRel), col: C.crimson },
        { v: sys.Td * Math.cos(phMod + sys.phAbs), col: C.teal }
      ].forEach((pt) => {
        ctx.fillStyle = pt.col;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(curX, toY(pt.v), 4.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      });

      ctx.restore();

      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, plotH);

      // Legend header
      Theme.drawMath(
        ctx,
        [
          { t: 'Orange: ', bold: true }, { t: 'm', i: true }, { t: '0', sub: true },
          { t: '   Crimson: ', bold: true }, { t: 'Mx', i: true }, { t: '/(', bold: true }, { t: 'm', i: true }, { t: '0', sub: true }, { t: 'e', i: true }, { t: ')', bold: true },
          { t: '   Teal: ', bold: true }, { t: 'CM', bold: true }
        ],
        padL,
        padT - 13,
        { size: 10.5, color: C.text, align: 'left' }
      );

      Theme.drawMath(ctx, [{ t: 'Rotor phase ω', bold: true }, { t: 't', i: true, bold: true }, { t: ' (two drive cycles)', bold: true }], padL + plotW * 0.5, h - 13, {
        size: 10.5, color: C.text, align: 'center'
      });
    }

    return { setSystem, setPhase, render };
  }

  window.VibLab.VizUnbalance = { create: createUnbalanceViz };
})();
