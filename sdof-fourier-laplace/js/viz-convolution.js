/**
 * viz-convolution.js
 * Section 3: Time-domain Duhamel convolution x(t) = \int_0^t h(t - tau) f(tau) dtau
 * side-by-side with frequency-domain multiplication |X(iw)| = |H(iw)| * |F(iw)|.
 */
window.VibLab = window.VibLab || {};

window.VibLab.ConvolutionViz = (function () {
  'use strict';

  const M1 = window.VibLab.Math1D;
  const Theme = window.VibLab.Theme;

  function create(opts) {
    const timeCanvas = opts.timeCanvas;
    const freqCanvas = opts.freqCanvas;

    const state = {
      sys: opts.sys,
      signalType: 'hammer', // 'hammer', 'rect', 'twotone', 'chirp'
      tFrac: 0.38, // cursor position in [0, 1] of Tmax
      playing: false,
      visible: true,
      cache: null
    };

    function rebuildCache() {
      const sys = state.sys;
      const T0 = (2 * Math.PI) / sys.wn;
      const tMax = 5.5 * T0;
      const N = 260;
      const dt = tMax / N;
      const tArr = new Array(N + 1);
      const fArr = new Array(N + 1);
      const hArr = new Array(N + 1);
      const xArr = new Array(N + 1);

      for (let i = 0; i <= N; i++) {
        const t = i * dt;
        tArr[i] = t;
        fArr[i] = M1.evalInputSignal(state.signalType, t, sys.wn);
        hArr[i] = M1.impulseResponse(sys, t);
      }

      // Causal discrete convolution (trapezoidal)
      let xPeak = 1e-9;
      for (let i = 0; i <= N; i++) {
        let sum = 0;
        for (let j = 0; j <= i; j++) {
          const w = j === 0 || j === i ? 0.5 : 1.0;
          sum += w * fArr[j] * hArr[i - j];
        }
        xArr[i] = sum * dt;
        if (Math.abs(xArr[i]) > xPeak) xPeak = Math.abs(xArr[i]);
      }

      // Frequency grid omega in [0.02*wn, 3.0*wn]
      const nW = 160;
      const wMax = 3.0 * sys.wn;
      const wArr = new Array(nW + 1);
      for (let k = 0; k <= nW; k++) {
        wArr[k] = 0.02 * sys.wn + ((wMax - 0.02 * sys.wn) * k) / nW;
      }

      const FSpec = M1.computeSpectrum(tArr, fArr, wArr);
      const HMag = new Array(nW + 1);
      const FMag = new Array(nW + 1);
      const XMag = new Array(nW + 1);
      let fSpecMax = 1e-9;
      let hMax = 1e-9;
      let xSpecMax = 1e-9;

      for (let k = 0; k <= nW; k++) {
        const fm = M1.cAbs(FSpec[k]);
        const hm = M1.cAbs(M1.evalFRF(sys, 'receptance', wArr[k]));
        const hmClip = Math.min(hm, 15 / sys.k);
        const xm = fm * hmClip;
        FMag[k] = fm;
        HMag[k] = hmClip;
        XMag[k] = xm;
        if (fm > fSpecMax) fSpecMax = fm;
        if (hmClip > hMax) hMax = hmClip;
        if (xm > xSpecMax) xSpecMax = xm;
      }

      state.cache = {
        tMax,
        dt,
        tArr,
        fArr,
        hArr,
        xArr,
        xPeak,
        wMax,
        wArr,
        FMag,
        HMag,
        XMag,
        fSpecMax,
        hMax,
        xSpecMax
      };
    }

    rebuildCache();

    function setSystem(sys) {
      state.sys = sys;
      rebuildCache();
      render();
    }

    function setSignalType(sig) {
      state.signalType = sig;
      rebuildCache();
      render();
    }

    function setTimeFrac(frac) {
      state.tFrac = Math.max(0, Math.min(1, frac));
      renderTime();
    }

    function setPlaying(p) {
      state.playing = !!p;
    }

    function setVisible(v) {
      state.visible = !!v;
    }

    function step(dt) {
      if (!state.visible || !state.playing) return;
      state.tFrac += dt * 0.16;
      if (state.tFrac > 1) state.tFrac = 0;
      if (opts.onTimeChange) opts.onTimeChange(state.tFrac, state.tFrac * state.cache.tMax);
      renderTime();
    }

    function renderTime() {
      const { ctx, w, h } = Theme.setupHiDPI(timeCanvas);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const d = state.cache;
      const tCur = state.tFrac * d.tMax;
      const idxCur = Math.min(d.tArr.length - 1, Math.round(state.tFrac * (d.tArr.length - 1)));

      const padL = 52;
      const padR = 16;
      const splitY = Math.round(h * 0.5);
      const pw = Math.max(40, w - padL - padR);

      function tx(t) {
        return padL + (t / d.tMax) * pw;
      }

      // Divider
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, splitY);
      ctx.lineTo(w, splitY);
      ctx.stroke();

      /* -------- TOP HALF: f(tau), flipped kernel h(t - tau), shaded product -------- */
      const topT = 26;
      const topB = splitY - 18;
      const topMid = (topT + topB) * 0.5;
      const topAmp = (topB - topT) * 0.42;
      const hNormScale = Math.max(1e-6, 1.15 / (state.sys.m * state.sys.wn));

      // Zero axis
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(padL, topMid);
      ctx.lineTo(padL + pw, topMid);
      ctx.moveTo(padL, topT);
      ctx.lineTo(padL, topB);
      ctx.stroke();

      // Shaded integrand product f(tau) * h(t - tau) for 0 <= tau <= tCur
      ctx.save();
      ctx.fillStyle = C.teal;
      ctx.globalAlpha = 0.24;
      ctx.beginPath();
      ctx.moveTo(tx(0), topMid);
      for (let j = 0; j <= idxCur; j++) {
        const prod = (d.fArr[j] * d.hArr[idxCur - j]) / hNormScale;
        const py = topMid - Math.max(-1.15, Math.min(1.15, prod)) * topAmp;
        ctx.lineTo(tx(d.tArr[j]), py);
      }
      ctx.lineTo(tx(d.tArr[idxCur]), topMid);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Input force f(tau)
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      for (let j = 0; j < d.tArr.length; j++) {
        const py = topMid - d.fArr[j] * topAmp * 0.9;
        if (j === 0) ctx.moveTo(tx(d.tArr[j]), py);
        else ctx.lineTo(tx(d.tArr[j]), py);
      }
      ctx.stroke();

      // Flipped & shifted impulse response h(t - tau) for tau <= tCur
      ctx.save();
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      for (let j = 0; j <= idxCur; j++) {
        const val = d.hArr[idxCur - j] / hNormScale;
        const py = topMid - Math.max(-1.15, Math.min(1.15, val)) * topAmp;
        if (j === 0) ctx.moveTo(tx(d.tArr[j]), py);
        else ctx.lineTo(tx(d.tArr[j]), py);
      }
      ctx.stroke();
      ctx.restore();

      // Cursor vertical line at tau = tCur
      const curPx = tx(tCur);
      ctx.strokeStyle = C.text;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(curPx, topT);
      ctx.lineTo(curPx, h - 26);
      ctx.stroke();

      ctx.font = '600 11px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = C.copper;
      ctx.fillText('— f(τ)', 14, 16);
      ctx.fillStyle = C.blue;
      ctx.fillText('--- h(t − τ)', 68, 16);
      ctx.fillStyle = C.teal;
      ctx.fillText('■ shaded area = x(t)', 152, 16);

      /* -------- BOTTOM HALF: Resulting output x(t) = (h * f)(t) -------- */
      const botT = splitY + 24;
      const botB = h - 26;
      const botMid = (botT + botB) * 0.5;
      const botAmp = (botB - botT) * 0.43;

      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(padL, botMid);
      ctx.lineTo(padL + pw, botMid);
      ctx.moveTo(padL, botT);
      ctx.lineTo(padL, botB);
      ctx.stroke();

      // Full x(t) lightly in background
      ctx.save();
      ctx.strokeStyle = C.ref;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < d.tArr.length; i++) {
        const py = botMid - (d.xArr[i] / d.xPeak) * botAmp;
        if (i === 0) ctx.moveTo(tx(d.tArr[i]), py);
        else ctx.lineTo(tx(d.tArr[i]), py);
      }
      ctx.stroke();
      ctx.restore();

      // Traced x(t) up to tCur
      ctx.strokeStyle = C.teal;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let i = 0; i <= idxCur; i++) {
        const py = botMid - (d.xArr[i] / d.xPeak) * botAmp;
        if (i === 0) ctx.moveTo(tx(d.tArr[i]), py);
        else ctx.lineTo(tx(d.tArr[i]), py);
      }
      ctx.stroke();

      // Dot at current x(t)
      const curY = botMid - (d.xArr[idxCur] / d.xPeak) * botAmp;
      ctx.fillStyle = C.teal;
      ctx.beginPath();
      ctx.arc(curPx, curY, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '600 11px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.text;
      ctx.textAlign = 'left';
      ctx.fillText('Time-domain convolution output x(t) = (h * f)(t)', 14, splitY + 15);

      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.fillStyle = C.muted;
      ctx.textAlign = 'center';
      for (let i = 0; i <= 5; i++) {
        const tt = (i / 5) * d.tMax;
        ctx.fillText(M1.fmt(tt, 1) + 's', tx(tt), botB + 15);
      }
      ctx.textAlign = 'right';
      ctx.fillText(M1.fmtSci(d.xPeak, 1), padL - 6, botT + 6);
      ctx.fillText('0', padL - 6, botMid + 4);
    }

    function renderFreq() {
      const { ctx, w, h } = Theme.setupHiDPI(freqCanvas);
      const C = Theme.colors();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const d = state.cache;
      const padL = 52;
      const padR = 16;
      const pw = Math.max(40, w - padL - padR);

      function wx(omega) {
        return padL + (omega / d.wMax) * pw;
      }

      // Three stacked frequency strips: |F(iw)|, |H(iw)|, and |X(iw)| = |H(iw)|*|F(iw)|
      const bands = [
        {
          title: 'Input spectrum |F(iω)|',
          arr: d.FMag,
          maxVal: d.fSpecMax,
          color: C.copper
        },
        {
          title: '× System FRF |H(iω)|',
          arr: d.HMag,
          maxVal: d.hMax,
          color: C.blue
        },
        {
          title: '= Output spectrum |X(iω)| = |H(iω)| · |F(iω)|',
          arr: d.XMag,
          maxVal: d.xSpecMax,
          color: C.teal
        }
      ];

      const rowH = (h - 24) / 3;
      const wnX = wx(state.sys.wn);

      // Vertical natural frequency reference line across all 3 bands
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = C.ref;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(wnX, 18);
      ctx.lineTo(wnX, h - 24);
      ctx.stroke();
      ctx.restore();

      bands.forEach(function (band, idx) {
        const yTop = idx * rowH + 22;
        const yBot = (idx + 1) * rowH - 8;
        const bh = Math.max(24, yBot - yTop);

        if (idx > 0) {
          ctx.strokeStyle = C.grid;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, idx * rowH + 2);
          ctx.lineTo(w, idx * rowH + 2);
          ctx.stroke();
        }

        // Axes
        ctx.strokeStyle = C.axis;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(padL, yTop);
        ctx.lineTo(padL, yBot);
        ctx.lineTo(padL + pw, yBot);
        ctx.stroke();

        // Fill under spectrum
        ctx.save();
        ctx.fillStyle = band.color;
        ctx.globalAlpha = 0.14;
        ctx.beginPath();
        ctx.moveTo(wx(d.wArr[0]), yBot);
        for (let k = 0; k < d.wArr.length; k++) {
          const py = yBot - (band.arr[k] / band.maxVal) * bh * 0.92;
          ctx.lineTo(wx(d.wArr[k]), py);
        }
        ctx.lineTo(wx(d.wArr[d.wArr.length - 1]), yBot);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Curve
        ctx.strokeStyle = band.color;
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        for (let k = 0; k < d.wArr.length; k++) {
          const py = yBot - (band.arr[k] / band.maxVal) * bh * 0.92;
          if (k === 0) ctx.moveTo(wx(d.wArr[k]), py);
          else ctx.lineTo(wx(d.wArr[k]), py);
        }
        ctx.stroke();

        // Title & y-max
        ctx.font = '600 11px "IBM Plex Sans", sans-serif';
        ctx.fillStyle = band.color;
        ctx.textAlign = 'left';
        ctx.fillText(band.title, 14, idx * rowH + 15);

        ctx.font = '500 9.5px "IBM Plex Mono", monospace';
        ctx.fillStyle = C.muted;
        ctx.textAlign = 'right';
        ctx.fillText(M1.fmtSci(band.maxVal, 1), padL - 6, yTop + 6);
        ctx.fillText('0', padL - 6, yBot + 2);
      });

      // Bottom frequency axis ticks
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.fillStyle = C.muted;
      ctx.textAlign = 'center';
      [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0].forEach(function (r) {
        const x = wx(r * state.sys.wn);
        ctx.fillText(r === 1 ? 'ωₙ' : r + 'ωₙ', x, h - 8);
      });
    }

    function render() {
      renderTime();
      renderFreq();
    }

    return {
      setSystem,
      setSignalType,
      setTimeFrac,
      setPlaying,
      setVisible,
      step,
      render
    };
  }

  return { create };
})();
