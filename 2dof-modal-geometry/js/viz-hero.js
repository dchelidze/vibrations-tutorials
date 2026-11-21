/**
 * viz-hero.js
 * Live interactive 2-DOF physical simulator with drag-to-pluck,
 * preset mode excitations, and real-time coupled (q1, q2) vs modal (eta1, eta2) waveforms.
 */
window.VibLab = window.VibLab || {};

window.VibLab.HeroViz = (function () {
  'use strict';

  const M2 = window.VibLab.Math2D;
  const Theme = window.VibLab.Theme;
  const Sys = window.VibLab.Systems;

  function create(opts) {
    const simCanvas = opts.simCanvas;
    const waveCanvas = opts.waveCanvas;
    const state = {
      sysKey: opts.sysKey,
      params: opts.params,
      eigen: opts.eigen,
      playing: true,
      t: 0,
      speed: 1.0,
      presetMode: 'superposition', // 'mode1', 'mode2', 'superposition', 'pluck1'
      q0: [0.65, -0.25],
      v0: [0, 0],
      sol: null,
      history: [],
      dragging: null, // 1 or 2
      handles: null,
      visible: true
    };

    function computeICForPreset(preset) {
      const eig = state.eigen;
      const u1 = eig.u1;
      const u2 = eig.u2;
      const n1 = Math.max(1e-6, M2.norm(u1));
      const n2 = Math.max(1e-6, M2.norm(u2));
      if (preset === 'mode1') {
        const s = 0.78 / n1;
        state.q0 = [u1[0] * s, u1[1] * s];
        state.v0 = [0, 0];
      } else if (preset === 'mode2') {
        const s = 0.78 / n2;
        state.q0 = [u2[0] * s, u2[1] * s];
        state.v0 = [0, 0];
      } else if (preset === 'pluck1') {
        state.q0 = [0.75, 0];
        state.v0 = [0, 0];
      } else {
        // Rich superposition of both modes
        const s1 = 0.52 / n1;
        const s2 = 0.48 / n2;
        state.q0 = [u1[0] * s1 + u2[0] * s2, u1[1] * s1 + u2[1] * s2];
        state.v0 = [0, 0];
      }
      state.t = 0;
      state.history = [];
      rebuildSolution();
    }

    function rebuildSolution() {
      state.sol = M2.modalSolutionFromIC(state.eigen, state.q0, state.v0);
    }

    function setSystem(sysKey, params, eigen, keepPreset) {
      state.sysKey = sysKey;
      state.params = params;
      state.eigen = eigen;
      if (keepPreset && state.presetMode !== 'custom') {
        computeICForPreset(state.presetMode);
      } else {
        rebuildSolution();
        state.history = [];
      }
    }

    function setPreset(preset) {
      state.presetMode = preset;
      computeICForPreset(preset);
      state.playing = true;
    }

    function setPlaying(p) {
      state.playing = p;
    }

    function togglePlaying() {
      state.playing = !state.playing;
      return state.playing;
    }

    // Pointer interaction for dragging masses directly
    function getPointerPos(evt) {
      const rect = simCanvas.getBoundingClientRect();
      return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
      };
    }

    simCanvas.addEventListener('pointerdown', function (evt) {
      if (!state.handles) return;
      const p = getPointerPos(evt);
      const d1 = Math.hypot(p.x - state.handles.h1.x, p.y - state.handles.h1.y);
      const d2 = Math.hypot(p.x - state.handles.h2.x, p.y - state.handles.h2.y);
      if (d2 <= state.handles.h2.r + 12 && d2 <= d1 + 6) {
        state.dragging = 2;
      } else if (d1 <= state.handles.h1.r + 12) {
        state.dragging = 1;
      } else {
        return;
      }
      const cur = state.sol.evalAt(state.t);
      state.q0 = [cur.q[0], cur.q[1]];
      state.v0 = [0, 0];
      state.t = 0;
      state.presetMode = 'custom';
      simCanvas.setPointerCapture(evt.pointerId);
      if (opts.onPresetChange) opts.onPresetChange('custom');
    });

    simCanvas.addEventListener('pointermove', function (evt) {
      if (!state.dragging || !state.handles) return;
      const p = getPointerPos(evt);
      const h = state.handles;
      if (state.sysKey === 'spring-pendulum') {
        if (state.dragging === 1) {
          state.q0[0] = Math.max(-1.0, Math.min(1.0, (p.x - h.cx0) / h.pxPerMeter));
        } else {
          const cartX = h.cx0 + state.q0[0] * h.pxPerMeter;
          const dx = p.x - cartX;
          const dy = Math.max(15, p.y - h.h1.y);
          const th = Math.max(-0.95, Math.min(0.95, Math.atan2(dx, dy)));
          state.q0[1] = (th / 0.88) * state.params.L;
        }
      } else if (state.sysKey === 'double-pendulum') {
        if (state.dragging === 1) {
          const dx = p.x - h.pivotX;
          const dy = Math.max(15, p.y - h.pivotY);
          const th1 = Math.max(-0.95, Math.min(0.95, Math.atan2(dx, dy)));
          state.q0[0] = (th1 / 0.82) * state.params.L1;
        } else {
          const dx = p.x - h.h1.x;
          const dy = Math.max(15, p.y - h.h1.y);
          const th2 = Math.max(-1.0, Math.min(1.0, Math.atan2(dx, dy)));
          state.q0[1] = (th2 / 0.82) * state.params.L2;
        }
      } else {
        if (state.dragging === 1) {
          state.q0[0] = Math.max(-1.0, Math.min(1.0, (p.x - h.x1Eq) / h.maxShift));
        } else {
          state.q0[1] = Math.max(-1.0, Math.min(1.0, (p.x - h.x2Eq) / h.maxShift));
        }
      }
      state.v0 = [0, 0];
      state.history = [];
      rebuildSolution();
    });

    function endDrag(evt) {
      if (!state.dragging) return;
      state.dragging = null;
      state.t = 0;
      state.playing = true;
      if (evt && evt.pointerId !== undefined) {
        try {
          simCanvas.releasePointerCapture(evt.pointerId);
        } catch (e) {}
      }
    }
    simCanvas.addEventListener('pointerup', endDrag);
    simCanvas.addEventListener('pointercancel', endDrag);

    function step(dt) {
      if (!state.visible) return;
      if (state.playing && !state.dragging) {
        state.t += dt * state.speed;
      }
      const cur = state.sol.evalAt(state.t);
      if (state.playing && !state.dragging) {
        state.history.push({ t: state.t, q: cur.q, eta: cur.eta });
        const maxSpan = 8.0; // seconds shown
        while (state.history.length > 2 && state.t - state.history[0].t > maxSpan) {
          state.history.shift();
        }
      }
      renderSim(cur);
      renderWaves(cur);
    }

    function renderSim(cur) {
      const { ctx, w, h } = Theme.setupHiDPI(simCanvas);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);

      // Subtle background gradient
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      // Highlight color if pure mode
      let accent = null;
      if (state.presetMode === 'mode1') accent = C.mode1;
      else if (state.presetMode === 'mode2') accent = C.mode2;

      state.handles = Sys.drawSystem(ctx, state.sysKey, state.params, cur.q, w, h, {
        accentColor: accent,
        showLabels: true
      });

      // Top-left interactive hint badge
      ctx.save();
      ctx.font = '500 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = C.textMuted;
      ctx.textAlign = 'left';
      ctx.fillText(
        state.dragging ? 'Release to oscillate' : 'Drag masses directly to set initial state',
        12,
        18
      );

      // Live energy conservation badge top-right
      const T = 0.5 * M2.quadForm(cur.v, state.eigen.M);
      const V = 0.5 * M2.quadForm(cur.q, state.eigen.K);
      const E = T + V;
      ctx.textAlign = 'right';
      ctx.font = '500 11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = C.mass;
      ctx.fillText('T = ' + M2.fmt(T, 2) + ' J', w - 156, 18);
      ctx.fillStyle = C.stiff;
      ctx.fillText('V = ' + M2.fmt(V, 2) + ' J', w - 84, 18);
      ctx.fillStyle = C.text;
      ctx.fillText('E = ' + M2.fmt(E, 2) + ' J', w - 12, 18);
      ctx.restore();
    }

    function renderWaves(cur) {
      const { ctx, w, h } = Theme.setupHiDPI(waveCanvas);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 12;
      const padR = 12;
      const midGap = 14;
      const topH = (h - midGap - 18) * 0.5;
      const y1Top = 8;
      const y2Top = y1Top + topH + midGap;

      // Draw two strip charts: Top = Physical q1, q2 (coupled); Bottom = Modal eta1, eta2 (uncoupled)
      drawStrip(ctx, padL, y1Top, w - padL - padR, topH, {
        title: 'Physical Coordinates (Coupled)',
        series: [
          { label: 'q₁(t)', color: C.mass, get: (pt) => pt.q[0] },
          { label: 'q₂(t)', color: C.stiff, get: (pt) => pt.q[1] }
        ],
        history: state.history,
        tNow: state.t,
        span: 8.0,
        C
      });

      drawStrip(ctx, padL, y2Top, w - padL - padR, topH, {
        title: 'Modal Coordinates (Uncoupled Pure Sine Waves)',
        series: [
          { label: 'η₁(t) [ω₁]', color: C.mode1, get: (pt) => pt.eta[0] },
          { label: 'η₂(t) [ω₂]', color: C.mode2, get: (pt) => pt.eta[1] }
        ],
        history: state.history,
        tNow: state.t,
        span: 8.0,
        C
      });
    }

    function drawStrip(ctx, x, y, w, h, cfg) {
      const C = cfg.C;
      ctx.save();
      // Subtle frame
      ctx.fillStyle = C.bgSubtle;
      ctx.strokeStyle = C.gridBold;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, w, h, 8) : ctx.rect(x, y, w, h);
      ctx.fill();
      ctx.stroke();

      // Header row
      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = C.text;
      ctx.textAlign = 'left';
      ctx.fillText(cfg.title, x + 10, y + 15);

      // Legend right
      let lx = x + w - 10;
      ctx.textAlign = 'right';
      for (let i = cfg.series.length - 1; i >= 0; i--) {
        const s = cfg.series[i];
        ctx.fillStyle = s.color;
        ctx.fillText('● ' + s.label, lx, y + 15);
        lx -= ctx.measureText('● ' + s.label).width + 12;
      }

      const plotTop = y + 22;
      const plotH = h - 28;
      const midY = plotTop + plotH * 0.5;

      // Zero line
      ctx.strokeStyle = C.gridBold;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 8, midY);
      ctx.lineTo(x + w - 8, midY);
      ctx.stroke();

      // Auto-scale nicely based on current amplitude
      let maxVal = 0.6;
      for (let i = 0; i < cfg.history.length; i++) {
        const pt = cfg.history[i];
        for (let j = 0; j < cfg.series.length; j++) {
          const av = Math.abs(cfg.series[j].get(pt));
          if (av > maxVal) maxVal = av;
        }
      }
      const ampPx = (plotH * 0.42) / maxVal;
      const plotW = w - 16;

      if (cfg.history.length > 1) {
        const tEnd = cfg.tNow;
        const tStart = tEnd - cfg.span;
        cfg.series.forEach(function (s) {
          ctx.beginPath();
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 2;
          let started = false;
          for (let i = 0; i < cfg.history.length; i++) {
            const pt = cfg.history[i];
            const px = x + 8 + ((pt.t - tStart) / cfg.span) * plotW;
            const py = midY - s.get(pt) * ampPx;
            if (!started) {
              ctx.moveTo(px, py);
              started = true;
            } else {
              ctx.lineTo(px, py);
            }
          }
          ctx.stroke();

          // Live dot at right edge
          const last = cfg.history[cfg.history.length - 1];
          const lxDot = x + 8 + ((last.t - tStart) / cfg.span) * plotW;
          const lyDot = midY - s.get(last) * ampPx;
          ctx.fillStyle = s.color;
          ctx.beginPath();
          ctx.arc(lxDot, lyDot, 3.2, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.restore();
    }

    computeICForPreset(state.presetMode);

    return {
      step,
      setSystem,
      setPreset,
      setPlaying,
      togglePlaying,
      setVisible: (v) => (state.visible = v),
      getState: () => state
    };
  }

  return { create };
})();
