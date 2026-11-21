/**
 * systems.js
 * Physical 2-DOF system definitions, matrix builders, theme helpers,
 * and shared crisp mechanical canvas renderer.
 */
window.VibLab = window.VibLab || {};

window.VibLab.Theme = (function () {
  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function colors() {
    if (isDark()) {
      return {
        bg: '#132433',
        bgSubtle: '#192E40',
        grid: 'rgba(255, 255, 255, 0.07)',
        gridBold: 'rgba(255, 255, 255, 0.16)',
        axis: 'rgba(169, 182, 191, 0.6)',
        ref: '#8A8578',
        text: '#F2F4F6',
        textMuted: '#A9B6BF',
        // 28 Oct 2026 NLD Figure Palette (dark surface adaptations)
        mass: '#4DBEEE',
        massFill: 'rgba(77, 190, 238, 0.14)',
        massGlow: 'rgba(77, 190, 238, 0.32)',
        stiff: '#E87A46',
        stiffFill: 'rgba(232, 122, 70, 0.14)',
        stiffGlow: 'rgba(232, 122, 70, 0.32)',
        mode1: '#26B5A6',
        mode1Fill: 'rgba(38, 181, 166, 0.16)',
        mode2: '#C584D6',
        mode2Fill: 'rgba(197, 132, 214, 0.16)',
        accent: '#D98A52',
        wall: '#6E8191',
        wallHatch: '#395064',
        metal: '#CBD5E1',
        rod: '#A9B6BF',
        spring: '#E2E8F0',
        springAccent: '#E87A46',
        cartFill: '#192E40',
        cartStroke: '#4DBEEE',
        bobFill: '#192E40',
        bobStroke: '#26B5A6',
        trajectory: '#EDB120'
      };
    }
    return {
      bg: '#FFFFFF',
      bgSubtle: '#F7F6F2',
      grid: 'rgba(19, 36, 51, 0.06)',
      gridBold: 'rgba(19, 36, 51, 0.15)',
      axis: 'rgba(19, 36, 51, 0.55)',
      ref: '#8A8578',
      text: '#132433',
      textMuted: '#5B6168',
      // Exact 28 Oct 2026 NLD Figure Palette on white panel
      mass: '#0072BD',
      massFill: 'rgba(0, 114, 189, 0.10)',
      massGlow: 'rgba(0, 114, 189, 0.25)',
      stiff: '#D95319',
      stiffFill: 'rgba(217, 83, 25, 0.10)',
      stiffGlow: 'rgba(217, 83, 25, 0.25)',
      mode1: '#00897B',
      mode1Fill: 'rgba(0, 137, 123, 0.14)',
      mode2: '#7E2F8E',
      mode2Fill: 'rgba(126, 47, 142, 0.14)',
      accent: '#B4622A',
      wall: '#5B6168',
      wallHatch: '#DCD9D2',
      metal: '#132433',
      rod: '#132433',
      spring: '#132433',
      springAccent: '#D95319',
      cartFill: '#F2F7FB',
      cartStroke: '#0072BD',
      bobFill: '#F1F9F8',
      bobStroke: '#00897B',
      trajectory: '#B4622A'
    };
  }

  function setupHiDPI(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h, dpr };
  }

  function drawArrow(ctx, x1, y1, x2, y2, color, lineWidth, headSize) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) return;
    const hs = Math.min(headSize || 9, len * 0.45);
    const ang = Math.atan2(dy, dx);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - Math.cos(ang) * (hs * 0.72), y2 - Math.sin(ang) * (hs * 0.72));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - hs * Math.cos(ang - 0.42), y2 - hs * Math.sin(ang - 0.42));
    ctx.lineTo(x2 - hs * Math.cos(ang + 0.42), y2 - hs * Math.sin(ang + 0.42));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  return { isDark, colors, setupHiDPI, drawArrow };
})();

window.VibLab.Systems = (function () {
  'use strict';

  const G = 9.81;

  const DEFINITIONS = {
    'spring-pendulum': {
      id: 'spring-pendulum',
      name: 'Spring-Mass + Pendulum',
      shortName: 'Cart + Pendulum',
      badge: 'Inertial M Coupling',
      coordLabels: ['q₁ = x', 'q₂ = Lθ'],
      coordShort: ['q₁', 'q₂'],
      coordUnits: ['m', 'm'],
      description:
        'A sliding mass $m_1$ attached to a wall via spring $k_1$, with a pendulum $(m_2, L)$ hanging from its pivot and an optional torsional spring $k_\\theta$ at the pivot. Because the pendulum rides on the cart, $\\mathbf{M}$ is non-diagonal (inertial coupling), producing a tilted $\\mathbf{M}^{-1/2}\\mathbf{K}\\mathbf{M}^{-1/2}$ ellipse even when $\\mathbf{K}$ is diagonal.',
      energyTexT: 'T = \\tfrac{1}{2} m_1 \\dot{q}_1^2 + \\tfrac{1}{2} m_2 (\\dot{q}_1 + \\dot{q}_2)^2',
      energyTexV: 'V = \\tfrac{1}{2} k_1 q_1^2 + \\tfrac{1}{2}\\!\\left(\\frac{m_2 g}{L} + \\frac{k_\\theta}{L^2}\\right) q_2^2',
      defaults: {
        m1: 1.2,
        m2: 1.0,
        k1: 18,
        kt: 2.0,
        L: 1.0
      },
      params: [
        { key: 'm1', label: 'Cart mass $m_1$', unit: 'kg', min: 0.4, max: 4.0, step: 0.1 },
        { key: 'm2', label: 'Bob mass $m_2$', unit: 'kg', min: 0.3, max: 3.5, step: 0.1 },
        { key: 'k1', label: 'Cart spring $k_1$', unit: 'N/m', min: 4, max: 45, step: 1 },
        { key: 'kt', label: 'Pivot spring $k_\\theta$', unit: 'N·m/rad', min: 0, max: 18, step: 0.5 },
        { key: 'L', label: 'Rod length $L$', unit: 'm', min: 0.4, max: 2.2, step: 0.05 }
      ],
      presets: [
        { label: 'Pivot Spring ($k_\\theta = 2$)', values: { m1: 1.2, m2: 1.0, k1: 18, kt: 2.0, L: 1.0 } },
        { label: 'Pure Gravity ($k_\\theta = 0$)', values: { m1: 1.2, m2: 1.0, k1: 18, kt: 0, L: 1.0 } },
        { label: 'Heavy Bob (Strong $\\mathbf{M}$ Coupling)', values: { m1: 0.7, m2: 2.2, k1: 22, kt: 3.0, L: 0.9 } }
      ],
      buildMatrices: function (p) {
        const M = [
          [p.m1 + p.m2, p.m2],
          [p.m2, p.m2]
        ];
        const kPend = (p.m2 * G) / p.L + p.kt / (p.L * p.L);
        const K = [
          [p.k1, 0],
          [0, kPend]
        ];
        return { M, K };
      }
    },

    'double-pendulum': {
      id: 'double-pendulum',
      name: 'Double Pendulum',
      shortName: 'Double Pendulum',
      badge: 'Inertial + Joint Coupling',
      coordLabels: ['q₁ = L₁θ₁', 'q₂ = L₂θ₂'],
      coordShort: ['q₁', 'q₂'],
      coordUnits: ['m', 'm'],
      description:
        'Two linked pendulums swinging under gravity with small-angle coordinates $q_1 = L_1\\theta_1$ and $q_2 = L_2\\theta_2$, plus an optional hinge torsional spring $k_\\theta$. Because the lower bob rides on the upper link, $\\mathbf{M}$ is strongly non-diagonal (and with $k_\\theta > 0$, both $\\mathbf{M}$ and $\\mathbf{K}$ are coupled).',
      energyTexT: 'T = \\tfrac{1}{2} m_1 \\dot{q}_1^2 + \\tfrac{1}{2} m_2 (\\dot{q}_1 + \\dot{q}_2)^2',
      energyTexV: 'V = \\tfrac{1}{2}(m_1+m_2)\\frac{g}{L_1}q_1^2 + \\tfrac{1}{2}m_2\\frac{g}{L_2}q_2^2 + \\tfrac{1}{2}k_\\theta(\\theta_2 - \\theta_1)^2',
      defaults: {
        m1: 1.5,
        m2: 1.0,
        L1: 1.0,
        L2: 1.0,
        kt: 3.0
      },
      params: [
        { key: 'm1', label: 'Upper mass $m_1$', unit: 'kg', min: 0.4, max: 4.0, step: 0.1 },
        { key: 'm2', label: 'Lower mass $m_2$', unit: 'kg', min: 0.3, max: 3.5, step: 0.1 },
        { key: 'L1', label: 'Upper rod $L_1$', unit: 'm', min: 0.5, max: 2.0, step: 0.05 },
        { key: 'L2', label: 'Lower rod $L_2$', unit: 'm', min: 0.5, max: 2.0, step: 0.05 },
        { key: 'kt', label: 'Hinge spring $k_\\theta$', unit: 'N·m/rad', min: 0, max: 16, step: 0.5 }
      ],
      presets: [
        { label: 'With Hinge Spring (Both $\\mathbf{M},\\mathbf{K}$)', values: { m1: 1.5, m2: 1.0, L1: 1.0, L2: 1.0, kt: 3.0 } },
        { label: 'Pure Gravity ($k_\\theta = 0$)', values: { m1: 1.5, m2: 1.0, L1: 1.0, L2: 1.0, kt: 0 } },
        { label: 'Equal Masses & Lengths', values: { m1: 1.0, m2: 1.0, L1: 1.0, L2: 1.0, kt: 0 } }
      ],
      buildMatrices: function (p) {
        const M = [
          [p.m1 + p.m2, p.m2],
          [p.m2, p.m2]
        ];
        const k11 = ((p.m1 + p.m2) * G) / p.L1 + p.kt / (p.L1 * p.L1);
        const k22 = (p.m2 * G) / p.L2 + p.kt / (p.L2 * p.L2);
        const k12 = -p.kt / (p.L1 * p.L2);
        const K = [
          [k11, k12],
          [k12, k22]
        ];
        return { M, K };
      }
    },

    'coupled-masses': {
      id: 'coupled-masses',
      name: 'Coupled Spring-Mass Pair',
      shortName: '2-Mass Springs',
      badge: 'Diagonal M, Coupled K',
      coordLabels: ['q₁ = x₁', 'q₂ = x₂'],
      coordShort: ['q₁', 'q₂'],
      coordUnits: ['m', 'm'],
      description:
        'Two sliding blocks $m_1$ and $m_2$ connected to fixed walls ($k_1, k_2$) and to each other by a coupling spring $k_c$. Even though $\\mathbf{M}$ is diagonal, unequal masses ($m_1 \\neq m_2$) stretch the mass ellipse so the modes are non-orthogonal in $(x_1, x_2)$.',
      energyTexT: 'T = \\tfrac{1}{2} m_1 \\dot{x}_1^2 + \\tfrac{1}{2} m_2 \\dot{x}_2^2',
      energyTexV: 'V = \\tfrac{1}{2} k_1 x_1^2 + \\tfrac{1}{2} k_c (x_2 - x_1)^2 + \\tfrac{1}{2} k_2 x_2^2',
      defaults: {
        m1: 1.0,
        m2: 2.2,
        k1: 10,
        kc: 14,
        k2: 14
      },
      params: [
        { key: 'm1', label: 'Left mass $m_1$', unit: 'kg', min: 0.4, max: 4.0, step: 0.1 },
        { key: 'm2', label: 'Right mass $m_2$', unit: 'kg', min: 0.4, max: 4.0, step: 0.1 },
        { key: 'k1', label: 'Left spring $k_1$', unit: 'N/m', min: 2, max: 40, step: 1 },
        { key: 'kc', label: 'Coupling spring $k_c$', unit: 'N/m', min: 1, max: 40, step: 1 },
        { key: 'k2', label: 'Right spring $k_2$', unit: 'N/m', min: 2, max: 40, step: 1 }
      ],
      presets: [
        { label: 'Unequal Masses ($m_1 \\neq m_2$)', values: { m1: 1.0, m2: 2.2, k1: 10, kc: 14, k2: 14 } },
        { label: 'Symmetric ($m_1 = m_2$)', values: { m1: 1.5, m2: 1.5, k1: 12, kc: 12, k2: 12 } },
        { label: 'Weak Coupling (Beating)', values: { m1: 1.2, m2: 1.2, k1: 20, kc: 2, k2: 20 } }
      ],
      buildMatrices: function (p) {
        const M = [
          [p.m1, 0],
          [0, p.m2]
        ];
        const K = [
          [p.k1 + p.kc, -p.kc],
          [-p.kc, p.k2 + p.kc]
        ];
        return { M, K };
      }
    }
  };

  /* -----------------------------------------------------------
   * Shared Mechanical Drawing Primitives
   * --------------------------------------------------------- */
  function drawSpring(ctx, x1, y1, x2, y2, coils, amp, color, lineWidth) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 4) return;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const lead = Math.min(12, len * 0.14);
    const body = Math.max(2, len - 2 * lead);
    const nCoils = coils || 8;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth || 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + ux * lead, y1 + uy * lead);
    const steps = nCoils * 2;
    for (let i = 1; i <= steps; i++) {
      const frac = (i - 0.5) / steps;
      const dist = lead + frac * body;
      const side = i % 2 === 1 ? amp : -amp;
      ctx.lineTo(x1 + ux * dist + nx * side, y1 + uy * dist + ny * side);
    }
    ctx.lineTo(x2 - ux * lead, y2 - uy * lead);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawWall(ctx, x, yTop, yBot, side, C) {
    // side: 'left' means hatches go left; 'right' means hatches go right; 'top' horizontal ceiling
    ctx.save();
    ctx.strokeStyle = C.wall;
    ctx.lineWidth = 2.5;
    if (side === 'top') {
      const w = yBot - yTop; // here x is yCeiling, yTop is xLeft, yBot is xRight
      ctx.beginPath();
      ctx.moveTo(yTop, x);
      ctx.lineTo(yBot, x);
      ctx.stroke();
      ctx.strokeStyle = C.wallHatch;
      ctx.lineWidth = 1.4;
      for (let px = yTop + 6; px <= yBot; px += 10) {
        ctx.beginPath();
        ctx.moveTo(px, x);
        ctx.lineTo(px - 6, x - 8);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x, yBot);
      ctx.stroke();
      ctx.strokeStyle = C.wallHatch;
      ctx.lineWidth = 1.4;
      const dir = side === 'left' ? -1 : 1;
      for (let py = yTop + 4; py <= yBot - 2; py += 9) {
        ctx.beginPath();
        ctx.moveTo(x, py);
        ctx.lineTo(x + dir * 8, py + 6);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /**
   * Renders the selected physical 2-DOF system on a canvas box (0..w, 0..h).
   * Returns interactive handle coordinates { h1: {x,y,r}, h2: {x,y,r}, pxScale } for dragging.
   */
  function drawSystem(ctx, sysKey, params, q, w, h, opts) {
    const options = opts || {};
    const compact = !!options.compact;
    const C = window.VibLab.Theme.colors();
    const accentColor = options.accentColor || null;
    const showLabels = options.showLabels !== false;
    const scaleAmp = options.scaleAmp || 1.0;

    ctx.save();

    if (sysKey === 'spring-pendulum') {
      const wallL = compact ? 18 : 34;
      const wallR = w - (compact ? 18 : 34);
      const trackY = h * (compact ? 0.28 : 0.26);
      const cx0 = w * 0.5;
      const maxDisp = Math.min(w * 0.24, compact ? 42 : 76);
      const pxPerMeter = maxDisp * scaleAmp;

      const cartW = compact ? 38 : 56;
      const cartH = compact ? 24 : 34;
      const rodPx = Math.min(h * 0.48, compact ? 58 : 98) * (0.65 + 0.35 * Math.min(params.L, 1.8));
      const q1 = q[0];
      const q2 = q[1];

      const cartX = Math.max(wallL + cartW * 0.7, Math.min(wallR - cartW * 0.7, cx0 + q1 * pxPerMeter));
      const cartY = trackY;

      // Angle theta = q2 / L (visual clamping for readability)
      const theta = Math.max(-1.05, Math.min(1.05, (q2 / Math.max(0.35, params.L)) * (compact ? 0.72 : 0.88)));
      const bobX = cartX + rodPx * Math.sin(theta);
      const bobY = cartY + rodPx * Math.cos(theta);
      const bobR = compact ? 10 : Math.max(12, Math.min(20, 10 + params.m2 * 3.2));

      // Rail track
      ctx.strokeStyle = C.gridBold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wallL, trackY + cartH * 0.5 + 5);
      ctx.lineTo(wallR, trackY + cartH * 0.5 + 5);
      ctx.stroke();

      // Equilibrium dashed guides
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = C.gridBold;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx0, trackY - cartH * 0.75);
      ctx.lineTo(cx0, trackY + rodPx + bobR + 6);
      ctx.stroke();
      ctx.restore();

      // Left Wall & Spring k1
      drawWall(ctx, wallL, trackY - 22, trackY + 24, 'left', C);
      drawSpring(
        ctx,
        wallL,
        cartY,
        cartX - cartW * 0.5,
        cartY,
        compact ? 6 : 8,
        compact ? 5.5 : 8,
        C.spring,
        compact ? 1.6 : 2.1
      );

      // Pendulum rod
      ctx.strokeStyle = C.rod;
      ctx.lineWidth = compact ? 2.2 : 3;
      ctx.beginPath();
      ctx.moveTo(cartX, cartY);
      ctx.lineTo(bobX, bobY);
      ctx.stroke();

      // Cart body
      drawRoundedRect(ctx, cartX - cartW * 0.5, cartY - cartH * 0.5, cartW, cartH, 6);
      ctx.fillStyle = C.cartFill;
      ctx.fill();
      ctx.strokeStyle = accentColor || C.cartStroke;
      ctx.lineWidth = compact ? 2 : 2.5;
      ctx.stroke();

      // Optional torsional spiral spring k_theta right at the pivot
      if (params.kt > 0.01) {
        ctx.save();
        ctx.strokeStyle = C.stiff;
        ctx.lineWidth = compact ? 1.5 : 1.9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const turns = 2.25;
        const rStart = compact ? 3.5 : 5;
        const rEnd = compact ? 10 : 14.5;
        const steps = 48;
        // Wind/unwind slightly with theta for realistic visual feedback
        const baseAngle = Math.PI * 0.5 - theta;
        for (let i = 0; i <= steps; i++) {
          const frac = i / steps;
          const ang = baseAngle + frac * turns * Math.PI * 2;
          const r = rStart + frac * (rEnd - rStart);
          const sx = cartX + r * Math.cos(ang);
          const sy = cartY + r * Math.sin(ang);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Cart wheels
      const wheelR = compact ? 3.5 : 4.8;
      ctx.fillStyle = C.metal;
      ctx.beginPath();
      ctx.arc(cartX - cartW * 0.28, cartY + cartH * 0.5 + 1.5, wheelR, 0, Math.PI * 2);
      ctx.arc(cartX + cartW * 0.28, cartY + cartH * 0.5 + 1.5, wheelR, 0, Math.PI * 2);
      ctx.fill();

      // Pivot pin
      ctx.fillStyle = C.bg;
      ctx.strokeStyle = C.metal;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cartX, cartY, compact ? 3 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Pendulum bob
      ctx.beginPath();
      ctx.arc(bobX, bobY, bobR, 0, Math.PI * 2);
      ctx.fillStyle = C.bobFill;
      ctx.fill();
      ctx.strokeStyle = accentColor || C.bobStroke;
      ctx.lineWidth = compact ? 2 : 2.6;
      ctx.stroke();

      if (showLabels && !compact) {
        ctx.font = '600 12px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = C.text;
        ctx.fillText('m₁', cartX, cartY - cartH * 0.5 - 7);
        ctx.fillText('m₂', bobX, bobY + 4);

        ctx.font = '500 11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = C.textMuted;
        ctx.fillText('k₁', (wallL + cartX - cartW * 0.5) * 0.5, cartY - 13);
        if (params.kt > 0.01) {
          ctx.fillStyle = C.stiff;
          ctx.textAlign = 'left';
          ctx.fillText('k_θ', cartX + cartW * 0.5 + 8, cartY + 4);
        }
        // Coordinate indicator
        ctx.fillStyle = C.mass;
        ctx.fillText('q₁ = x', cx0 + 30, trackY - cartH * 0.5 - 20);
        window.VibLab.Theme.drawArrow(ctx, cx0, trackY - cartH * 0.5 - 16, cx0 + 26, trackY - cartH * 0.5 - 16, C.mass, 1.5, 6);
      }

      ctx.restore();
      return {
        h1: { x: cartX, y: cartY, r: cartW * 0.55 },
        h2: { x: bobX, y: bobY, r: bobR + 10 },
        cx0,
        rodPx,
        pxPerMeter
      };
    }

    if (sysKey === 'double-pendulum') {
      const pivotX = w * 0.5;
      const pivotY = compact ? 22 : 34;
      const totalAvail = h - pivotY - (compact ? 24 : 36);
      const sumL = params.L1 + params.L2;
      const L1px = totalAvail * (params.L1 / sumL) * 0.86;
      const L2px = totalAvail * (params.L2 / sumL) * 0.86;

      const ampScale = compact ? 0.68 : 0.82;
      const th1 = Math.max(-1.05, Math.min(1.05, (q[0] / Math.max(0.35, params.L1)) * ampScale));
      const th2 = Math.max(-1.15, Math.min(1.15, (q[1] / Math.max(0.35, params.L2)) * ampScale));

      const x1 = pivotX + L1px * Math.sin(th1);
      const y1 = pivotY + L1px * Math.cos(th1);
      const x2 = x1 + L2px * Math.sin(th2);
      const y2 = y1 + L2px * Math.cos(th2);

      const r1 = compact ? 9 : Math.max(11, Math.min(19, 9 + params.m1 * 3.0));
      const r2 = compact ? 9 : Math.max(11, Math.min(19, 9 + params.m2 * 3.0));

      // Ceiling support
      drawWall(ctx, pivotY, pivotX - (compact ? 30 : 52), pivotX + (compact ? 30 : 52), 'top', C);

      // Vertical reference line
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = C.gridBold;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(pivotX, pivotY + L1px + L2px + 10);
      ctx.stroke();
      ctx.restore();

      // Rods
      ctx.strokeStyle = C.rod;
      ctx.lineWidth = compact ? 2.4 : 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Torsional hinge spring arc if kt > 0
      if (params.kt > 0.01) {
        ctx.save();
        ctx.strokeStyle = C.stiff;
        ctx.lineWidth = compact ? 1.6 : 2.1;
        ctx.beginPath();
        const rArc = r1 + (compact ? 5 : 8);
        for (let i = 0; i <= 24; i++) {
          const a = Math.PI * 0.5 - th1 + ((i / 24) * 1.4 - 0.7) * Math.PI;
          const rr = rArc + (i % 2 === 0 ? -2.2 : 2.2);
          const px = x1 + rr * Math.cos(a);
          const py = y1 + rr * Math.sin(a);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Top pivot
      ctx.fillStyle = C.metal;
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, compact ? 3.5 : 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Bob 1
      ctx.beginPath();
      ctx.arc(x1, y1, r1, 0, Math.PI * 2);
      ctx.fillStyle = C.cartFill;
      ctx.fill();
      ctx.strokeStyle = accentColor || C.cartStroke;
      ctx.lineWidth = compact ? 2 : 2.6;
      ctx.stroke();

      // Bob 2
      ctx.beginPath();
      ctx.arc(x2, y2, r2, 0, Math.PI * 2);
      ctx.fillStyle = C.bobFill;
      ctx.fill();
      ctx.strokeStyle = accentColor || C.bobStroke;
      ctx.lineWidth = compact ? 2 : 2.6;
      ctx.stroke();

      if (showLabels && !compact) {
        ctx.font = '600 12px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = C.text;
        ctx.fillText('m₁', x1, y1 + 4);
        ctx.fillText('m₂', x2, y2 + 4);
        if (params.kt > 0.01) {
          ctx.font = '500 11px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = C.stiff;
          ctx.fillText('k_θ', x1 + r1 + 26, y1 + 4);
        }
      }

      ctx.restore();
      return {
        h1: { x: x1, y: y1, r: r1 + 10 },
        h2: { x: x2, y: y2, r: r2 + 10 },
        pivotX,
        pivotY,
        L1px,
        L2px
      };
    }

    // Default: 'coupled-masses'
    const wallL = compact ? 18 : 34;
    const wallR = w - (compact ? 18 : 34);
    const cy = h * 0.54;
    const span = wallR - wallL;
    const x1Eq = wallL + span * 0.34;
    const x2Eq = wallL + span * 0.66;
    const boxW = compact ? 30 : 48;
    const boxH = compact ? 28 : 44;
    const maxShift = span * 0.14 * scaleAmp;

    const x1 = Math.max(wallL + boxW * 0.7, Math.min(x2Eq - boxW * 0.55, x1Eq + q[0] * maxShift));
    const x2 = Math.max(x1 + boxW * 1.15, Math.min(wallR - boxW * 0.7, x2Eq + q[1] * maxShift));

    // Floor line
    ctx.strokeStyle = C.gridBold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wallL, cy + boxH * 0.5 + 5);
    ctx.lineTo(wallR, cy + boxH * 0.5 + 5);
    ctx.stroke();

    // Equilibrium markers
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = C.gridBold;
    ctx.lineWidth = 1.2;
    [x1Eq, x2Eq].forEach(function (xe) {
      ctx.beginPath();
      ctx.moveTo(xe, cy - boxH * 0.85);
      ctx.lineTo(xe, cy + boxH * 0.5 + 5);
      ctx.stroke();
    });
    ctx.restore();

    // Walls
    drawWall(ctx, wallL, cy - 28, cy + boxH * 0.5 + 6, 'left', C);
    drawWall(ctx, wallR, cy - 28, cy + boxH * 0.5 + 6, 'right', C);

    // Three springs
    const cAmp = compact ? 5 : 8;
    drawSpring(ctx, wallL, cy, x1 - boxW * 0.5, cy, compact ? 5 : 7, cAmp, C.spring, compact ? 1.6 : 2.1);
    drawSpring(ctx, x1 + boxW * 0.5, cy, x2 - boxW * 0.5, cy, compact ? 5 : 7, cAmp, C.stiff, compact ? 1.8 : 2.3);
    drawSpring(ctx, x2 + boxW * 0.5, cy, wallR, cy, compact ? 5 : 7, cAmp, C.spring, compact ? 1.6 : 2.1);

    // Masses
    [
      { x: x1, label: 'm₁', fill: C.cartFill, stroke: accentColor || C.cartStroke },
      { x: x2, label: 'm₂', fill: C.bobFill, stroke: accentColor || C.bobStroke }
    ].forEach(function (b) {
      drawRoundedRect(ctx, b.x - boxW * 0.5, cy - boxH * 0.5, boxW, boxH, 7);
      ctx.fillStyle = b.fill;
      ctx.fill();
      ctx.strokeStyle = b.stroke;
      ctx.lineWidth = compact ? 2 : 2.6;
      ctx.stroke();

      // Rollers
      const wr = compact ? 3 : 4.2;
      ctx.fillStyle = C.metal;
      ctx.beginPath();
      ctx.arc(b.x - boxW * 0.26, cy + boxH * 0.5 + 1.5, wr, 0, Math.PI * 2);
      ctx.arc(b.x + boxW * 0.26, cy + boxH * 0.5 + 1.5, wr, 0, Math.PI * 2);
      ctx.fill();

      if (showLabels && !compact) {
        ctx.font = '600 13px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = C.text;
        ctx.fillText(b.label, b.x, cy + 5);
      }
    });

    if (showLabels && !compact) {
      ctx.font = '500 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = C.textMuted;
      ctx.fillText('k₁', (wallL + x1 - boxW * 0.5) * 0.5, cy - 14);
      ctx.fillStyle = C.stiff;
      ctx.fillText('k_c', (x1 + x2) * 0.5, cy - 14);
      ctx.fillStyle = C.textMuted;
      ctx.fillText('k₂', (x2 + boxW * 0.5 + wallR) * 0.5, cy - 14);
    }

    ctx.restore();
    return {
      h1: { x: x1, y: cy, r: boxW * 0.6 },
      h2: { x: x2, y: cy, r: boxW * 0.6 },
      x1Eq,
      x2Eq,
      maxShift
    };
  }

  return {
    DEFINITIONS,
    drawSystem,
    drawSpring
  };
})();
