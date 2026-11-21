/**
 * viz-frf-types.js
 * Section 5: Six Dimensional FRFs (Direct family: Receptance, Mobility, Accelerance;
 * Reciprocal family: Dynamic Stiffness, Mechanical Impedance, Apparent Mass) plus
 * Dimensionless ratios (DAF vs. Base/Force Transmissibility).
 * - Left canvas: Log-Log Bode Magnitude & Phase comparison with optional asymptotes.
 * - Right canvas: Focused Nyquist / Phasor view (showing exact circle for Mobility Y(iw))
 *   or slope-rotation diagram explaining how multiplying by (i*omega) adds +20 dB/dec & +90 deg.
 */
window.VibLab = window.VibLab || {};

window.VibLab.FrfTypesViz = (function () {
  'use strict';

  const M1 = window.VibLab.Math1D;
  const Theme = window.VibLab.Theme;

  function create(opts) {
    const mainCanvas = opts.mainCanvas;
    const nyqCanvas = opts.nyqCanvas;

    const state = {
      sys: opts.sys,
      viewGroup: 'direct', // 'direct', 'reciprocal', 'dimensionless'
      selectedKey: 'mobility', // focused FRF for Nyquist panel & highlight
      probeR: 1.0,
      showAsymptotes: true,
      dragging: false
    };

    function updateProbeFromPointer(evt) {
      const rect = mainCanvas.getBoundingClientRect();
      const padL = 62;
      const padR = 18;
      const pw = Math.max(40, rect.width - padL - padR);
      const frac = Math.max(0, Math.min(1, (evt.clientX - rect.left - padL) / pw));
      const logMin = Math.log10(0.1);
      const logMax = Math.log10(10.0);
      state.probeR = Math.pow(10, logMin + frac * (logMax - logMin));
      if (opts.onProbeChange) opts.onProbeChange(state.probeR);
      render();
    }

    mainCanvas.addEventListener('pointerdown', function (evt) {
      state.dragging = true;
      mainCanvas.setPointerCapture(evt.pointerId);
      updateProbeFromPointer(evt);
    });
    mainCanvas.addEventListener('pointermove', function (evt) {
      if (!state.dragging) return;
      updateProbeFromPointer(evt);
    });
    function endDrag(evt) {
      if (!state.dragging) return;
      state.dragging = false;
      try {
        mainCanvas.releasePointerCapture(evt.pointerId);
      } catch (e) {}
    }
    mainCanvas.addEventListener('pointerup', endDrag);
    mainCanvas.addEventListener('pointercancel', endDrag);

    function setSystem(sys) {
      state.sys = sys;
      render();
    }

    function setViewGroup(group) {
      state.viewGroup = group;
      if (group === 'direct' && !['receptance', 'mobility', 'accelerance'].includes(state.selectedKey)) {
        state.selectedKey = 'mobility';
      } else if (
        group === 'reciprocal' &&
        !['dynStiffness', 'impedance', 'apparentMass'].includes(state.selectedKey)
      ) {
        state.selectedKey = 'impedance';
      } else if (group === 'dimensionless') {
        state.selectedKey = 'transmissibility';
      }
      render();
    }

    function setSelectedKey(key) {
      state.selectedKey = key;
      if (['receptance', 'mobility', 'accelerance'].includes(key)) {
        state.viewGroup = 'direct';
      } else if (['dynStiffness', 'impedance', 'apparentMass'].includes(key)) {
        state.viewGroup = 'reciprocal';
      } else {
        state.viewGroup = 'dimensionless';
      }
      render();
    }

    function setProbeR(r) {
      state.probeR = Math.max(0.1, Math.min(10.0, r));
      render();
    }

    function setShowAsymptotes(flag) {
      state.showAsymptotes = !!flag;
      render();
    }

    function getActiveSeries(C) {
      if (state.viewGroup === 'direct') {
        return [
          { key: 'receptance', label: 'α(iω) [m/N]', color: C.blue, dash: [] },
          { key: 'mobility', label: 'Y(iω) [m/(N·s)]', color: C.teal, dash: [] },
          { key: 'accelerance', label: 'A(iω) [kg⁻¹]', color: C.orange, dash: [] }
        ];
      }
      if (state.viewGroup === 'reciprocal') {
        return [
          { key: 'dynStiffness', label: 'Z_k(iω) [N/m]', color: C.blue, dash: [] },
          { key: 'impedance', label: 'Z(iω) [N·s/m]', color: C.teal, dash: [] },
          { key: 'apparentMass', label: 'M_app(iω) [kg]', color: C.orange, dash: [] }
        ];
      }
      return [
        { key: 'daf', label: 'DAF = k·α(iω) [—]', color: C.blue, dash: [] },
        { key: 'transmissibility', label: 'Transmissibility T(iω) [—]', color: C.purple, dash: [] }
      ];
    }

    function renderMain() {
      const { ctx, w, h } = Theme.setupHiDPI(mainCanvas);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const sys = state.sys;
      const series = getActiveSeries(C);

      const padL = 62;
      const padR = 18;
      const pw = Math.max(40, w - padL - padR);
      const splitY = Math.round(h * 0.58);

      const rMin = 0.1;
      const rMax = 10.0;
      const logRMin = Math.log10(rMin);
      const logRMax = Math.log10(rMax);

      function rx(r) {
        return padL + ((Math.log10(Math.max(rMin, r)) - logRMin) / (logRMax - logRMin)) * pw;
      }

      /* -------- Determine clean log10 magnitude range across active family -------- */
      const N = 260;
      const rVals = new Array(N + 1);
      for (let i = 0; i <= N; i++) {
        rVals[i] = Math.pow(10, logRMin + ((logRMax - logRMin) * i) / N);
      }

      let logYMin = Infinity;
      let logYMax = -Infinity;
      const magData = series.map(function (s) {
        const arr = new Array(N + 1);
        for (let i = 0; i <= N; i++) {
          const val = M1.cAbs(M1.evalFRF(sys, s.key, rVals[i] * sys.wn));
          const lv = Math.log10(Math.max(1e-8, Math.min(1e8, val)));
          arr[i] = lv;
          if (lv < logYMin) logYMin = lv;
          if (lv > logYMax) logYMax = lv;
        }
        return arr;
      });

      // Clamp extreme undamped spikes to keep axis readable
      logYMin = Math.floor(logYMin);
      logYMax = Math.min(logYMin + 7, Math.ceil(logYMax));
      if (logYMax - logYMin < 3) logYMax = logYMin + 3;

      const magT = 30;
      const magB = splitY - 14;
      const magH = Math.max(40, magB - magT);

      function my(logVal) {
        const clamped = Math.max(logYMin, Math.min(logYMax, logVal));
        return magB - ((clamped - logYMin) / (logYMax - logYMin)) * magH;
      }

      // Grid lines (decades)
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      [0.1, 0.2, 0.5, 1, 2, 5, 10].forEach(function (rv) {
        const x = rx(rv);
        ctx.beginPath();
        ctx.moveTo(x, magT);
        ctx.lineTo(x, h - 26);
        ctx.stroke();
      });

      for (let p = logYMin; p <= logYMax; p += 1) {
        const y = my(p);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + pw, y);
        ctx.stroke();
      }

      // Axes
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, magT);
      ctx.lineTo(padL, magB);
      ctx.lineTo(padL + pw, magB);
      ctx.stroke();

      // Natural frequency line r = 1 & Isolation crossover r = sqrt(2) for dimensionless view
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = C.ref;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(rx(1), magT);
      ctx.lineTo(rx(1), h - 26);
      ctx.stroke();

      if (state.viewGroup === 'dimensionless') {
        const xIso = rx(Math.SQRT2);
        ctx.strokeStyle = C.purple;
        ctx.beginPath();
        ctx.moveTo(xIso, magT);
        ctx.lineTo(xIso, magB);
        ctx.stroke();
        ctx.fillStyle = C.purple;
        ctx.font = '600 10px "IBM Plex Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('r = √2 (T = 1)', xIso + 4, magT + 12);
      }
      ctx.restore();

      // Optional physical stiffness/mass/damping asymptotes for selected FRF
      if (state.showAsymptotes && state.viewGroup !== 'dimensionless') {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = C.ref;
        ctx.lineWidth = 1.3;
        const sel = state.selectedKey;
        // Draw low-frequency stiffness asymptote (r in [0.1, 1]) and high-frequency mass asymptote (r in [1, 10])
        const drawAsym = function (rA, rB, fn) {
          ctx.beginPath();
          for (let i = 0; i <= 40; i++) {
            const r = Math.pow(10, Math.log10(rA) + ((Math.log10(rB) - Math.log10(rA)) * i) / 40);
            const wRad = r * sys.wn;
            const lv = Math.log10(Math.max(1e-8, fn(wRad)));
            const px = rx(r);
            const py = my(lv);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        };

        if (sel === 'receptance') {
          drawAsym(0.1, 1.2, () => 1 / sys.k);
          drawAsym(0.8, 10, (wRad) => 1 / (sys.m * wRad * wRad));
        } else if (sel === 'mobility') {
          drawAsym(0.1, 1.2, (wRad) => wRad / sys.k);
          drawAsym(0.8, 10, (wRad) => 1 / (sys.m * wRad));
        } else if (sel === 'accelerance') {
          drawAsym(0.1, 1.2, (wRad) => (wRad * wRad) / sys.k);
          drawAsym(0.8, 10, () => 1 / sys.m);
        } else if (sel === 'dynStiffness') {
          drawAsym(0.1, 1.2, () => sys.k);
          drawAsym(0.8, 10, (wRad) => sys.m * wRad * wRad);
        } else if (sel === 'impedance') {
          drawAsym(0.1, 1.2, (wRad) => sys.k / wRad);
          drawAsym(0.8, 10, (wRad) => sys.m * wRad);
        } else if (sel === 'apparentMass') {
          drawAsym(0.1, 1.2, (wRad) => sys.k / (wRad * wRad));
          drawAsym(0.8, 10, () => sys.m);
        }
        ctx.restore();
      }

      // Plot Magnitude Curves
      series.forEach(function (s, idx) {
        const isSel = s.key === state.selectedKey;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = isSel ? 2.8 : 1.7;
        ctx.globalAlpha = isSel ? 1.0 : 0.72;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const px = rx(rVals[i]);
          const py = my(magData[idx][i]);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      });
      ctx.globalAlpha = 1.0;

      /* -------- BOTTOM: PHASE COMPARISON ([-180, +180] deg) -------- */
      const phT = splitY + 18;
      const phB = h - 26;
      const phH = Math.max(40, phB - phT);

      function phY(deg) {
        return phT + ((180 - deg) / 360) * phH;
      }

      [-180, -90, 0, 90, 180].forEach(function (deg) {
        const y = phY(deg);
        ctx.strokeStyle = deg === 0 ? C.axis : C.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + pw, y);
        ctx.stroke();
      });

      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, phT);
      ctx.lineTo(padL, phB);
      ctx.lineTo(padL + pw, phB);
      ctx.stroke();

      series.forEach(function (s) {
        const isSel = s.key === state.selectedKey;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = isSel ? 2.6 : 1.6;
        ctx.globalAlpha = isSel ? 1.0 : 0.72;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const deg = M1.evalFRFPhaseDeg(sys, s.key, rVals[i] * sys.wn);
          const px = rx(rVals[i]);
          const py = phY(deg);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      });
      ctx.globalAlpha = 1.0;

      // Probe cursor line
      const pX = rx(state.probeR);
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(pX, magT);
      ctx.lineTo(pX, phB);
      ctx.stroke();

      // Probe dots on active series
      series.forEach(function (s) {
        const wProbe = state.probeR * sys.wn;
        const val = M1.cAbs(M1.evalFRF(sys, s.key, wProbe));
        const deg = M1.evalFRFPhaseDeg(sys, s.key, wProbe);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(pX, my(Math.log10(Math.max(1e-8, val))), s.key === state.selectedKey ? 4.8 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pX, phY(deg), s.key === state.selectedKey ? 4.8 : 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Legend across top
      ctx.font = '600 11px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      let lx = 14;
      series.forEach(function (s) {
        ctx.fillStyle = s.color;
        const prefix = s.key === state.selectedKey ? '━ ' : '— ';
        ctx.fillText(prefix + s.label, lx, 16);
        lx += ctx.measureText(prefix + s.label).width + 16;
      });

      // Axis tick labels
      ctx.font = '500 9.5px "IBM Plex Mono", monospace';
      ctx.fillStyle = C.muted;
      ctx.textAlign = 'right';
      const stepPow = logYMax - logYMin > 5 ? 2 : 1;
      for (let p = logYMin; p <= logYMax; p += stepPow) {
        ctx.fillText('10^' + p, padL - 6, my(p) + 3);
      }
      ctx.fillText('+180°', padL - 6, phY(180) + 4);
      ctx.fillText('0°', padL - 6, phY(0) + 4);
      ctx.fillText('−180°', padL - 6, phY(-180) + 4);

      ctx.textAlign = 'center';
      [0.1, 0.2, 0.5, 1, 2, 5, 10].forEach(function (rv) {
        ctx.fillText(rv === 1 ? 'ωₙ' : rv + 'ωₙ', rx(rv), phB + 15);
      });
    }

    function renderNyquist() {
      const { ctx, w, h } = Theme.setupHiDPI(nyqCanvas);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const sys = state.sys;
      const key = state.selectedKey;
      const meta = M1.FRF_META.find((m) => m.key === key) || {
        name: key === 'daf' ? 'Dynamic amplification factor' : 'Transmissibility',
        units: 'dimensionless',
        colorKey: key === 'daf' ? 'blue' : 'purple'
      };
      const color = C[meta.colorKey] || C.blue;

      // Evaluate curve with dense sampling around resonance r = 1 so low-damping Nyquist circles stay smooth
      const rLow = ['dynStiffness', 'impedance', 'apparentMass'].includes(key) ? 0.35 : 0.02;
      const rHigh = ['dynStiffness', 'impedance', 'apparentMass'].includes(key) ? 2.1 : 5.0;
      const rSamples = [];
      const NLog = 260;
      for (let i = 0; i <= NLog; i++) {
        rSamples.push(rLow * Math.pow(rHigh / rLow, i / NLog));
      }
      // Extra dense angular samples across the resonance band around r = 1
      const zEff = Math.max(0.02, Math.min(0.6, sys.zeta));
      for (let i = -80; i <= 80; i++) {
        const rr = 1.0 + zEff * Math.tan((i / 82) * (Math.PI * 0.48));
        if (rr >= rLow && rr <= rHigh) rSamples.push(rr);
      }
      rSamples.sort((a, b) => a - b);

      const pts = [];
      for (let i = 0; i < rSamples.length; i++) {
        const r = rSamples[i];
        const val = M1.evalFRF(sys, key, r * sys.wn);
        const mag = M1.cAbs(val);
        if (!Number.isFinite(mag) || mag > 1e6) continue;
        pts.push({ r, re: val.re, im: val.im });
      }

      // Only cap extreme singularities in the undamped limit (zeta ~ 0); otherwise include 100% of the curve
      const isUndamped = sys.zeta <= 1e-4;
      let cap = Infinity;
      if (isUndamped && pts.length) {
        const mags = pts.map((p) => Math.hypot(p.re, p.im)).sort((a, b) => a - b);
        cap = Math.max(1e-9, mags[Math.min(mags.length - 1, Math.floor(mags.length * 0.9))]);
      }

      let minRe = 0;
      let maxRe = 0;
      let minIm = 0;
      let maxIm = 0;
      pts.forEach(function (p) {
        if (Math.hypot(p.re, p.im) <= cap) {
          if (p.re < minRe) minRe = p.re;
          if (p.re > maxRe) maxRe = p.re;
          if (p.im < minIm) minIm = p.im;
          if (p.im > maxIm) maxIm = p.im;
        }
      });

      // Exact plot bounds inside the visible area (leaving room for 2-line header and bottom readout)
      const clipL = 12;
      const clipR = w - 12;
      const clipT = 44;
      const clipB = h - 30;
      const padX = 24;
      const padT = 22;
      const padB = 20;
      const plotW = Math.max(60, clipR - clipL - 2 * padX);
      const plotH = Math.max(60, clipB - clipT - padT - padB);
      const spanRe = Math.max(1e-9, maxRe - minRe) * 1.18;
      const spanIm = Math.max(1e-9, maxIm - minIm) * 1.18;
      const scale = Math.min(plotW / spanRe, plotH / spanIm);
      const midRe = 0.5 * (minRe + maxRe);
      const midIm = 0.5 * (minIm + maxIm);
      const cx = 0.5 * (clipL + clipR);
      const cy = clipT + padT + plotH * 0.5;

      function px(re) {
        return cx + (re - midRe) * scale;
      }
      function py(im) {
        return cy - (im - midIm) * scale;
      }

      // Clip plotting area
      ctx.save();
      ctx.beginPath();
      ctx.rect(clipL, clipT, clipR - clipL, clipB - clipT);
      ctx.clip();

      // Origin axes
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(clipL, py(0));
      ctx.lineTo(clipR, py(0));
      ctx.moveTo(px(0), clipT);
      ctx.lineTo(px(0), clipB);
      ctx.stroke();

      // If Mobility Y(iw), draw dashed exact theoretical circle centered at (1/(2c), 0) of radius 1/(2c)!
      if (key === 'mobility' && sys.c > 1e-4) {
        const diam = 1 / sys.c;
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = C.ref;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(px(diam * 0.5), py(0), diam * 0.5 * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Curve
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (Math.hypot(p.re, p.im) > cap * 1.15) {
          started = false;
          continue;
        }
        const x = px(p.re);
        const y = py(p.im);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Marker at omega = wn
      const valWn = M1.evalFRF(sys, key, sys.wn);
      if (M1.cAbs(valWn) <= cap * 1.15) {
        const wx = px(valWn.re);
        const wy = py(valWn.im);
        ctx.fillStyle = C.teal;
        ctx.beginPath();
        ctx.arc(wx, wy, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '600 10.5px "IBM Plex Sans", sans-serif';
        ctx.textAlign = 'left';
        const dyOff = valWn.im > 0 ? -8 : 13;
        ctx.fillText('ω = ωₙ', wx + 8, wy + dyOff);
      }

      // Live probe phasor
      const valP = M1.evalFRF(sys, key, state.probeR * sys.wn);
      if (M1.cAbs(valP) <= cap * 1.15) {
        ctx.strokeStyle = C.copper;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(px(0), py(0));
        ctx.lineTo(px(valP.re), py(valP.im));
        ctx.stroke();

        ctx.fillStyle = C.copper;
        ctx.beginPath();
        ctx.arc(px(valP.re), py(valP.im), 5.2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Header & footer annotation
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.text;
      ctx.textAlign = 'left';
      ctx.fillText('Complex plane (Nyquist): ' + meta.name + ' [' + meta.units + ']', 14, 18);

      ctx.font = '500 11px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.muted;
      let note = 'Click any row in the table below to focus its Nyquist geometry.';
      if (key === 'mobility') {
        note = 'For viscous damping, Mobility Y(iω) traces an exact circle of diameter 1/c in Re > 0.';
      } else if (key === 'impedance') {
        note = 'Mechanical impedance Z(iω) = c + i(mω − k/ω) is a vertical line at Re(Z) = c.';
      } else if (key === 'dynStiffness') {
        note = 'Dynamic stiffness Z_k(iω) opens leftward as a parabola; crosses Im-axis at ω = ωₙ.';
      } else if (key === 'accelerance') {
        note = 'Accelerance rotates Receptance by +180° and weights high frequencies by ω².';
      } else if (key === 'apparentMass') {
        note = 'Apparent mass approaches the physical mass m on the positive real axis as ω → ∞.';
      } else if (key === 'transmissibility') {
        note = 'Transmissibility starts at (1, 0) and enters the isolation disk |T| < 1 for r > √2.';
      }
      ctx.fillText(note, 14, 35);

      ctx.font = '500 10.5px "IBM Plex Mono", monospace';
      ctx.fillStyle = C.copper;
      ctx.textAlign = 'left';
      const valNow = M1.evalFRF(sys, key, state.probeR * sys.wn);
      ctx.fillText(
        'At ω = ' +
          M1.fmt(state.probeR * sys.wn, 2) +
          ' rad/s:  Re = ' +
          M1.fmtSci(valNow.re, 2) +
          ',  Im = ' +
          M1.fmtSci(valNow.im, 2) +
          ' ' +
          meta.units,
        14,
        h - 10
      );
    }

    function render() {
      renderMain();
      renderNyquist();
    }

    return {
      setSystem,
      setViewGroup,
      setSelectedKey,
      setProbeR,
      setShowAsymptotes,
      render
    };
  }

  return { create };
})();
