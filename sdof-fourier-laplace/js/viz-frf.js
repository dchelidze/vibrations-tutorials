/**
 * viz-frf.js
 * Section 4: Anatomy of the Frequency Response Function (Receptance alpha(iw)).
 * - Left canvas: Synchronized Bode Magnitude (Linear or Log-Log dB) + Phase, with
 *   stiffness/mass asymptotes, -3 dB half-power bandwidth markers, and draggable frequency probe.
 * - Right canvas: Toggleable Real/Imaginary parts OR Nyquist (Argand) modal circle
 *   showing rotating phasor at the active probe frequency omega.
 */
window.VibLab = window.VibLab || {};

window.VibLab.FrfAnatomyViz = (function () {
  'use strict';

  const M1 = window.VibLab.Math1D;
  const Theme = window.VibLab.Theme;

  function create(opts) {
    const bodeCanvas = opts.bodeCanvas;
    const complexCanvas = opts.complexCanvas;

    const state = {
      sys: opts.sys,
      probeR: 1.0, // omega / wn in [0.1, 3.0]
      logScale: true,
      showAsymptotes: true,
      rightMode: 'reim', // 'reim' or 'nyquist'
      dragging: false
    };

    // Drag frequency probe directly on the Bode canvas
    function updateProbeFromPointer(evt) {
      const rect = bodeCanvas.getBoundingClientRect();
      const padL = 56;
      const padR = 18;
      const pw = Math.max(40, rect.width - padL - padR);
      const frac = Math.max(0, Math.min(1, (evt.clientX - rect.left - padL) / pw));
      let r;
      if (state.logScale) {
        const logMin = Math.log10(0.1);
        const logMax = Math.log10(5.0);
        r = Math.pow(10, logMin + frac * (logMax - logMin));
      } else {
        r = 0.05 + frac * 2.95;
      }
      state.probeR = Math.max(0.1, Math.min(3.5, r));
      if (opts.onProbeChange) opts.onProbeChange(state.probeR);
      render();
    }

    bodeCanvas.addEventListener('pointerdown', function (evt) {
      state.dragging = true;
      bodeCanvas.setPointerCapture(evt.pointerId);
      updateProbeFromPointer(evt);
    });
    bodeCanvas.addEventListener('pointermove', function (evt) {
      if (!state.dragging) return;
      updateProbeFromPointer(evt);
    });
    function endDrag(evt) {
      if (!state.dragging) return;
      state.dragging = false;
      try {
        bodeCanvas.releasePointerCapture(evt.pointerId);
      } catch (e) {}
    }
    bodeCanvas.addEventListener('pointerup', endDrag);
    bodeCanvas.addEventListener('pointercancel', endDrag);

    function setSystem(sys) {
      state.sys = sys;
      render();
    }

    function setProbeR(r) {
      state.probeR = Math.max(0.1, Math.min(3.5, r));
      render();
    }

    function setLogScale(flag) {
      state.logScale = !!flag;
      render();
    }

    function setShowAsymptotes(flag) {
      state.showAsymptotes = !!flag;
      render();
    }

    function setRightMode(mode) {
      state.rightMode = mode;
      render();
    }

    function renderBode() {
      const { ctx, w, h } = Theme.setupHiDPI(bodeCanvas);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const sys = state.sys;
      const padL = 56;
      const padR = 18;
      const pw = Math.max(40, w - padL - padR);
      const splitY = Math.round(h * 0.56);

      const rMin = state.logScale ? 0.1 : 0.05;
      const rMax = state.logScale ? 5.0 : 3.0;
      const logMin = Math.log10(rMin);
      const logMax = Math.log10(rMax);

      function rx(r) {
        if (state.logScale) {
          return padL + ((Math.log10(Math.max(rMin, r)) - logMin) / (logMax - logMin)) * pw;
        }
        return padL + ((r - rMin) / (rMax - rMin)) * pw;
      }

      /* -------- TOP: MAGNITUDE |alpha(iw)| -------- */
      const magT = 26;
      const magB = splitY - 14;
      const magH = Math.max(40, magB - magT);

      // Normalized relative to static compliance 1/k so dB range is clean across all k
      const dbMin = -45;
      const dbMax = 28;
      const linMax = Math.min(10.0, Math.max(2.5, sys.zeta > 0.04 ? Math.min(9.5, 1.25 / (2 * sys.zeta)) : 8.0));

      function magY(val) {
        const norm = val * sys.k; // k * |alpha|
        if (state.logScale) {
          const db = 20 * Math.log10(Math.max(1e-4, norm));
          return magB - ((Math.max(dbMin, Math.min(dbMax, db)) - dbMin) / (dbMax - dbMin)) * magH;
        }
        return magB - (Math.min(linMax, norm) / linMax) * magH;
      }

      // Grid
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      const xTicks = state.logScale ? [0.1, 0.2, 0.5, 1, 2, 5] : [0.5, 1, 1.5, 2, 2.5, 3];
      xTicks.forEach(function (rv) {
        const gx = rx(rv);
        ctx.beginPath();
        ctx.moveTo(gx, magT);
        ctx.lineTo(gx, h - 26);
        ctx.stroke();
      });

      if (state.logScale) {
        [-40, -20, 0, 20].forEach(function (db) {
          const gy = magB - ((db - dbMin) / (dbMax - dbMin)) * magH;
          ctx.beginPath();
          ctx.moveTo(padL, gy);
          ctx.lineTo(padL + pw, gy);
          ctx.stroke();
        });
      } else {
        for (let i = 0; i <= 4; i++) {
          const gy = magT + (i / 4) * magH;
          ctx.beginPath();
          ctx.moveTo(padL, gy);
          ctx.lineTo(padL + pw, gy);
          ctx.stroke();
        }
      }

      // Axes
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, magT);
      ctx.lineTo(padL, magB);
      ctx.lineTo(padL + pw, magB);
      ctx.stroke();

      // Natural frequency line r = 1
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = C.ref;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(rx(1), magT);
      ctx.lineTo(rx(1), h - 26);
      ctx.stroke();
      ctx.restore();

      // Stiffness & Mass asymptotes
      if (state.showAsymptotes) {
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = C.orange;
        ctx.lineWidth = 1.4;
        // Stiffness line: k * |alpha| = 1 (0 dB)
        const yStiff = magY(1 / sys.k);
        ctx.beginPath();
        ctx.moveTo(rx(rMin), yStiff);
        ctx.lineTo(rx(1.0), yStiff);
        ctx.stroke();

        // Mass line: k * |alpha| = 1 / r^2
        ctx.strokeStyle = C.purple;
        ctx.beginPath();
        const nAsym = 80;
        for (let i = 0; i <= nAsym; i++) {
          const r = 0.7 + ((rMax - 0.7) * i) / nAsym;
          const py = magY(1 / (sys.k * r * r));
          if (i === 0) ctx.moveTo(rx(r), py);
          else ctx.lineTo(rx(r), py);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Half-power (-3 dB) shaded band if peak exists
      if (state.showAsymptotes && sys.wHalfLow && sys.wHalfHigh && Number.isFinite(sys.peakRecept)) {
        const rL = sys.wHalfLow / sys.wn;
        const rH = sys.wHalfHigh / sys.wn;
        const yHalf = magY(sys.peakRecept / Math.SQRT2);
        const yPeak = magY(sys.peakRecept);
        ctx.save();
        ctx.fillStyle = C.teal;
        ctx.globalAlpha = 0.14;
        ctx.fillRect(rx(rL), yPeak, Math.max(2, rx(rH) - rx(rL)), Math.max(2, yHalf - yPeak));
        ctx.globalAlpha = 1;
        ctx.strokeStyle = C.teal;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx(rL), yHalf);
        ctx.lineTo(rx(rH), yHalf);
        ctx.stroke();
        ctx.restore();
      }

      // Magnitude curve
      const N = 260;
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const r = state.logScale
          ? Math.pow(10, logMin + ((logMax - logMin) * i) / N)
          : rMin + ((rMax - rMin) * i) / N;
        const val = M1.cAbs(M1.evalFRF(sys, 'receptance', r * sys.wn));
        const px = rx(r);
        const py = magY(val);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      /* -------- BOTTOM: PHASE angle(alpha(iw)) in [-180, 0] deg -------- */
      const phT = splitY + 20;
      const phB = h - 26;
      const phH = Math.max(40, phB - phT);

      function phY(deg) {
        return phT + ((-deg) / 180) * phH;
      }

      [-180, -90, 0].forEach(function (deg) {
        const gy = phY(deg);
        ctx.strokeStyle = deg === -90 ? C.axis : C.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, gy);
        ctx.lineTo(padL + pw, gy);
        ctx.stroke();
      });

      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, phT);
      ctx.lineTo(padL, phB);
      ctx.lineTo(padL + pw, phB);
      ctx.stroke();

      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const r = state.logScale
          ? Math.pow(10, logMin + ((logMax - logMin) * i) / N)
          : rMin + ((rMax - rMin) * i) / N;
        const deg = M1.evalFRFPhaseDeg(sys, 'receptance', r * sys.wn);
        const px = rx(r);
        const py = phY(deg);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Active frequency probe line & dots
      const pX = rx(state.probeR);
      const pVal = M1.cAbs(M1.evalFRF(sys, 'receptance', state.probeR * sys.wn));
      const pDeg = M1.evalFRFPhaseDeg(sys, 'receptance', state.probeR * sys.wn);
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pX, magT);
      ctx.lineTo(pX, phB);
      ctx.stroke();

      ctx.fillStyle = C.copper;
      ctx.beginPath();
      ctx.arc(pX, magY(pVal), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pX, phY(pDeg), 5, 0, Math.PI * 2);
      ctx.fill();

      // Labels & Ticks
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.text;
      ctx.textAlign = 'left';
      ctx.fillText(
        state.logScale
          ? 'Bode magnitude 20 log₁₀(k|α(iω)|) [dB] — drag probe'
          : 'Linear magnitude k|α(iω)| — drag probe',
        14,
        16
      );
      ctx.fillText('Phase ∠α(iω) [deg]', 14, splitY + 12);

      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.fillStyle = C.muted;
      ctx.textAlign = 'right';
      if (state.logScale) {
        [20, 0, -20, -40].forEach(function (db) {
          const gy = magB - ((db - dbMin) / (dbMax - dbMin)) * magH;
          ctx.fillText(db + ' dB', padL - 6, gy + 3);
        });
      } else {
        ctx.fillText(M1.fmt(linMax, 1), padL - 6, magT + 6);
        ctx.fillText(M1.fmt(linMax * 0.5, 1), padL - 6, magT + magH * 0.5 + 3);
        ctx.fillText('0', padL - 6, magB + 3);
      }

      ctx.fillText('0°', padL - 6, phY(0) + 4);
      ctx.fillText('−90°', padL - 6, phY(-90) + 4);
      ctx.fillText('−180°', padL - 6, phY(-180) + 4);

      ctx.textAlign = 'center';
      xTicks.forEach(function (rv) {
        ctx.fillText(rv === 1 ? 'ωₙ' : rv + 'ωₙ', rx(rv), phB + 15);
      });
    }

    function renderComplex() {
      const { ctx, w, h } = Theme.setupHiDPI(complexCanvas);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const sys = state.sys;
      const probeW = state.probeR * sys.wn;
      const Hprobe = M1.evalFRF(sys, 'receptance', probeW);
      const kScale = sys.k; // work in dimensionless k * alpha(iw)

      if (state.rightMode === 'reim') {
        const padL = 54;
        const padR = 18;
        const padT = 32;
        const padB = 30;
        const pw = Math.max(40, w - padL - padR);
        const ph = Math.max(40, h - padT - padB);
        const rMax = 2.6;

        // Compute nice symmetric vertical range
        const peakIm = sys.zeta > 0.04 ? 1 / (2 * sys.zeta) : 8.0;
        const yRange = Math.min(10.0, Math.max(2.0, peakIm * 1.18));

        function rx(r) {
          return padL + (r / rMax) * pw;
        }
        function ry(v) {
          return padT + ph * 0.44 - (Math.max(-yRange * 1.1, Math.min(yRange * 0.85, v)) / yRange) * (ph * 0.44);
        }

        // Grid
        ctx.strokeStyle = C.grid;
        ctx.lineWidth = 1;
        [0.5, 1.0, 1.5, 2.0, 2.5].forEach(function (rv) {
          ctx.beginPath();
          ctx.moveTo(rx(rv), padT);
          ctx.lineTo(rx(rv), padT + ph);
          ctx.stroke();
        });

        const zeroY = ry(0);
        ctx.strokeStyle = C.axis;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(padL, zeroY);
        ctx.lineTo(padL + pw, zeroY);
        ctx.moveTo(padL, padT);
        ctx.lineTo(padL, padT + ph);
        ctx.stroke();

        // Natural frequency vertical dashed line
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = C.ref;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(rx(1), padT);
        ctx.lineTo(rx(1), padT + ph);
        ctx.stroke();
        ctx.restore();

        const N = 240;
        // Real part Re[k*alpha(iw)]
        ctx.strokeStyle = C.blue;
        ctx.lineWidth = 2.3;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const r = (i / N) * rMax;
          const H = M1.evalFRF(sys, 'receptance', r * sys.wn);
          const px = rx(r);
          const py = ry(kScale * H.re);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Imaginary part Im[k*alpha(iw)]
        ctx.strokeStyle = C.orange;
        ctx.lineWidth = 2.3;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const r = (i / N) * rMax;
          const H = M1.evalFRF(sys, 'receptance', r * sys.wn);
          const px = rx(r);
          const py = ry(kScale * H.im);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Probe line & points
        if (state.probeR <= rMax) {
          const pX = rx(state.probeR);
          ctx.strokeStyle = C.copper;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(pX, padT);
          ctx.lineTo(pX, padT + ph);
          ctx.stroke();

          ctx.fillStyle = C.blue;
          ctx.beginPath();
          ctx.arc(pX, ry(kScale * Hprobe.re), 4.8, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = C.orange;
          ctx.beginPath();
          ctx.arc(pX, ry(kScale * Hprobe.im), 4.8, 0, Math.PI * 2);
          ctx.fill();
        }

        // Labels
        ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = C.blue;
        ctx.fillText('— Re[k·α(iω)] (crosses 0 at ωₙ)', 14, 18);
        ctx.fillStyle = C.orange;
        ctx.fillText('— Im[k·α(iω)] (quadrature peak at ωₙ)', 210, 18);

        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.fillStyle = C.muted;
        ctx.textAlign = 'center';
        [0, 0.5, 1.0, 1.5, 2.0, 2.5].forEach(function (rv) {
          ctx.fillText(rv === 1 ? 'ωₙ' : rv + 'ωₙ', rx(rv), padT + ph + 16);
        });
        ctx.textAlign = 'right';
        ctx.fillText('0', padL - 6, zeroY + 4);
        ctx.fillText('−' + M1.fmt(yRange, 1), padL - 6, padT + ph);
      } else {
        // Nyquist (Argand) Plot: Im[k*alpha(iw)] vs. Re[k*alpha(iw)]
        const pad = 42;
        const availW = Math.max(60, w - 2 * pad);
        const availH = Math.max(60, h - 2 * pad - 12);

        const peakIm = sys.zeta > 0.01 ? 1 / (2 * sys.zeta) : 12.0;
        const R = Math.max(1.35, peakIm * 1.18);
        const scale = Math.min(availW / (R * 1.35), availH / (R * 1.28));
        const ox = w * 0.5;
        const oy = pad + 26 + R * 0.14 * scale;

        function nx(re) {
          return ox + re * scale;
        }
        function ny(im) {
          return oy - im * scale;
        }

        // Grid circles centered at origin
        ctx.strokeStyle = C.grid;
        ctx.lineWidth = 1;
        [0.5, 1.0].forEach(function (f) {
          ctx.beginPath();
          ctx.arc(ox, oy, f * R * 0.5 * scale, 0, Math.PI * 2);
          ctx.stroke();
        });

        // Axes
        ctx.strokeStyle = C.axis;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(pad, oy);
        ctx.lineTo(w - pad, oy);
        ctx.moveTo(ox, pad + 14);
        ctx.lineTo(ox, h - pad + 10);
        ctx.stroke();

        // Nyquist loop for r from 0 to 8
        ctx.strokeStyle = C.blue;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        const N = 320;
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          // Concentrate samples near r = 1
          const r = 0.01 + 6.0 * Math.pow(u, 1.8);
          const H = M1.evalFRF(sys, 'receptance', r * sys.wn);
          const px = nx(kScale * H.re);
          const py = ny(kScale * H.im);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Mark r = 0 (static point (1, 0)) and r = 1 (quadrature point (0, -1/(2*zeta)))
        ctx.fillStyle = C.teal;
        ctx.beginPath();
        ctx.arc(nx(1), ny(0), 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '600 10.5px "IBM Plex Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('ω = 0 (1, 0)', nx(1) + 7, ny(0) - 6);

        if (sys.zeta > 0.04) {
          const imWn = -1 / (2 * sys.zeta);
          ctx.fillStyle = C.orange;
          ctx.beginPath();
          ctx.arc(nx(0), ny(imWn), 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillText('ω = ωₙ (φ = −90°)', nx(0) + 8, ny(imWn) + 4);
        }

        // Rotating phasor vector to current probe frequency
        const pRe = kScale * Hprobe.re;
        const pIm = kScale * Hprobe.im;
        const px = nx(pRe);
        const py = ny(pIm);
        ctx.strokeStyle = C.copper;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.fillStyle = C.copper;
        ctx.beginPath();
        ctx.arc(px, py, 5.2, 0, Math.PI * 2);
        ctx.fill();

        // Labels
        ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
        ctx.fillStyle = C.text;
        ctx.textAlign = 'left';
        ctx.fillText('Nyquist (Argand) plot of k·α(iω) with live phasor', 14, 18);

        ctx.font = '500 10.5px "IBM Plex Sans", sans-serif';
        ctx.fillStyle = C.muted;
        ctx.textAlign = 'right';
        ctx.fillText('Re[k·α]', w - pad, oy - 6);
        ctx.textAlign = 'left';
        ctx.fillText('Im[k·α]', ox + 6, pad + 24);
      }
    }

    function render() {
      renderBode();
      renderComplex();
    }

    return {
      setSystem,
      setProbeR,
      setLogScale,
      setShowAsymptotes,
      setRightMode,
      render
    };
  }

  return { create };
})();
