/**
 * viz-antiresonance.js
 * Section 4 visualization for Module 09 (2dof-modal-response):
 * - Left canvas: Interactive Bode magnitude (log) and phase (-360..0 deg) plot for
 *                selected receptance FRF entry H11, H21 (=H12), or H22, with draggable
 *                vertical frequency cursor w and marked w1, w2, and antiresonance wa.
 * - Right canvas: Complex modal-sum phasor cancellation diagram showing
 *                 H_jk(iw) = h^(1)_jk(iw) + h^(2)_jk(iw) drawn head-to-tail in the complex plane.
 *                 For driving-point H11/H22, residues share the same sign -> opposite-phase
 *                 destructive cancellation at w = wa. For cross-point H21, residues have opposite
 *                 signs -> constructive addition between w1 and w2, no antiresonance zero!
 * - Mini rig canvas: Live steady-state harmonic motion of m1 and m2 driven at frequency w
 *                    (watch m1 freeze nearly motionless right at w = wa11!).
 */
(function () {
  'use strict';

  window.VibLab = window.VibLab || {};
  const M = window.VibLab.MathModal2DOF;
  const Theme = window.VibLab.Theme;

  function createAntiresonanceViz(opts) {
    const bodeCanvas = document.getElementById(opts.bodeCanvasId);
    const phasorCanvas = document.getElementById(opts.phasorCanvasId);
    const miniRigCanvas = document.getElementById(opts.miniRigCanvasId);
    let sys = opts.sys;

    const state = {
      entry: 'H11', // 'H11' | 'H21' | 'H22'
      omega: sys.wa11,
      phaseTime: 0,
      draggingFreq: false
    };

    const bodeView = { padL: 58, plotW: 200 };

    function getIndices(entry) {
      if (entry === 'H21') return [1, 0];
      if (entry === 'H22') return [1, 1];
      return [0, 0];
    }

    function setSystem(newSys) {
      sys = newSys;
      state.omega = Math.min(sys.wMax * 0.98, Math.max(0.1, state.omega));
      render();
    }

    function setEntry(entry) {
      state.entry = entry;
      if (opts.onStateChange) opts.onStateChange(state);
      render();
    }

    function setOmega(w) {
      state.omega = Math.max(0.05, Math.min(sys.wMax, w));
      if (opts.onStateChange) opts.onStateChange(state);
      render();
    }

    function snapToAntiresonance() {
      if (state.entry === 'H22') {
        setOmega(sys.wa22);
      } else {
        setOmega(sys.wa11);
      }
    }

    function step(dt) {
      // Visual oscillation frequency capped nicely for readability
      const visOmega = Math.min(9.0, Math.max(2.2, state.omega * 1.4));
      state.phaseTime += dt * visOmega;
      drawMiniRig();
    }

    // Unwrap phase smoothly starting near 0 deg at w=0
    function computeBodeCurves() {
      const N = 340;
      const [j, k] = getIndices(state.entry);
      const ws = new Array(N + 1);
      const mags = new Array(N + 1);
      const phases = new Array(N + 1);

      let prevPh = 0;
      for (let i = 0; i <= N; i++) {
        const ww = (sys.wMax * i) / N;
        ws[i] = ww;
        const frf = M.evalFRF(sys, ww);
        const H = frf.exact[j][k];
        mags[i] = M.cAbs(H);
        let ph = (M.cArg(H) * 180) / Math.PI;
        if (i === 0) {
          // At w=0, real positive -> 0 deg
          ph = H.re >= 0 ? 0 : -180;
          prevPh = ph;
        } else {
          // Unwrap to minimize jumps (except genuine +180 antiresonance jump!)
          while (ph - prevPh > 180) ph -= 360;
          while (ph - prevPh < -180) ph += 360;
          prevPh = ph;
        }
        phases[i] = ph;
      }
      return { ws, mags, phases };
    }

    function drawBodeCanvas() {
      if (!bodeCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(bodeCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 56;
      const padR = 16;
      const padT = 24;
      const padB = 34;
      const gap = 24;
      const plotW = w - padL - padR;
      const magH = (h - padT - padB - gap) * 0.58;
      const phH = (h - padT - padB - gap) * 0.42;
      const phTop = padT + magH + gap;

      bodeView.padL = padL;
      bodeView.plotW = plotW;

      const { ws, mags, phases } = computeBodeCurves();
      const wMax = sys.wMax;
      const toX = (ww) => padL + (ww / wMax) * plotW;

      // ---- TOP SUBPLOT: Magnitude |H_jk(iw)| (log10) ----
      let maxM = 1e-4;
      for (let i = 0; i < mags.length; i++) if (mags[i] > maxM) maxM = mags[i];
      const logMax = Math.ceil(Math.log10(Math.max(0.2, maxM * 1.4)));
      const logMin = logMax - 4;
      const toYMag = (val) => {
        const lv = Math.max(logMin, Math.min(logMax, Math.log10(Math.max(1e-8, val))));
        return padT + ((logMax - lv) / (logMax - logMin)) * magH;
      };

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, padT, plotW, magH);

      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let d = logMin; d <= logMax; d++) {
        const py = padT + ((logMax - d) / (logMax - logMin)) * magH;
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();

        Theme.drawMath(ctx, [{ t: '10' }, { t: String(d), sup: true }], padL - 7, py, {
          size: 10.5,
          color: C.textMuted,
          align: 'right',
          family: '"IBM Plex Mono", monospace'
        });
      }

      // ---- BOTTOM SUBPLOT: Phase (deg) ----
      let minP = -360;
      let maxP = 20;
      const phMinObs = Math.min(...phases);
      if (phMinObs > -200) {
        minP = -200;
        maxP = 20;
      }
      const toYPh = (deg) => phTop + ((maxP - deg) / (maxP - minP)) * phH;

      ctx.fillStyle = C.bgSubtle;
      ctx.fillRect(padL, phTop, plotW, phH);

      const phTicks = minP < -220 ? [0, -90, -180, -270, -360] : [0, -90, -180];
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (const pt of phTicks) {
        const py = toYPh(pt);
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();

        ctx.fillStyle = C.textMuted;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(pt + '°', padL - 6, py);
      }

      // Vertical reference lines: w1, w2, and antiresonance wa (for H11/H22)
      function drawRefFreq(wf, runs, color) {
        if (wf <= 0 || wf > wMax) return;
        const px = toX(wf);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(px, padT);
        ctx.lineTo(px, padT + magH);
        ctx.moveTo(px, phTop);
        ctx.lineTo(px, phTop + phH);
        ctx.stroke();
        ctx.restore();
        Theme.drawMath(ctx, runs, px, padT - 11, { size: 11, color, align: 'center' });
      }

      drawRefFreq(sys.w1, [{ t: 'ω', bold: true }, { t: '1', sub: true, bold: true }], C.teal);
      drawRefFreq(sys.w2, [{ t: 'ω', bold: true }, { t: '2', sub: true, bold: true }], C.crimson);
      if (state.entry === 'H11') {
        drawRefFreq(sys.wa11, [{ t: 'ω', bold: true }, { t: 'a', sub: true, bold: true }], C.amber);
      } else if (state.entry === 'H22') {
        drawRefFreq(sys.wa22, [{ t: 'ω', bold: true }, { t: 'a', sub: true, bold: true }], C.amber);
      }

      // Draw magnitude curve
      const curveColor = state.entry === 'H21' ? C.purple : C.blue;
      ctx.save();
      ctx.strokeStyle = curveColor;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i < ws.length; i++) {
        const px = toX(ws[i]);
        const py = toYMag(mags[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // Draw phase curve
      ctx.save();
      ctx.strokeStyle = curveColor;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      for (let i = 0; i < ws.length; i++) {
        const px = toX(ws[i]);
        const py = toYPh(phases[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // Borders
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(padL, padT, plotW, magH);
      ctx.strokeRect(padL, phTop, plotW, phH);

      // Draggable frequency cursor
      const curX = toX(state.omega);
      const [j, k] = getIndices(state.entry);
      const curFrf = M.evalFRF(sys, state.omega).exact[j][k];
      const curMag = M.cAbs(curFrf);
      const curYMag = toYMag(curMag);

      ctx.save();
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(curX, padT);
      ctx.lineTo(curX, padT + magH);
      ctx.moveTo(curX, phTop);
      ctx.lineTo(curX, phTop + phH);
      ctx.stroke();

      ctx.fillStyle = C.copper;
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(curX, curYMag, 5.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Subplot headers
      const entrySub = state.entry.slice(1);
      Theme.drawMath(
        ctx,
        [
          { t: '|', bold: true },
          { t: 'H', i: true, bold: true },
          { t: entrySub, sub: true, bold: true },
          { t: '(iω)|  (m/N)', bold: true }
        ],
        padL + 2,
        padT - 11,
        { size: 11.5, color: C.text, align: 'left' }
      );
      Theme.drawMath(
        ctx,
        [
          { t: 'Phase ∠', bold: true },
          { t: 'H', i: true, bold: true },
          { t: entrySub, sub: true, bold: true },
          { t: '(iω)', bold: true }
        ],
        padL + 2,
        phTop - 11,
        { size: 11.5, color: C.text, align: 'left' }
      );

      // X-axis ticks
      ctx.fillStyle = C.textMuted;
      ctx.font = '500 10.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const stepW = wMax > 10 ? 2 : 1;
      for (let ww = 0; ww <= wMax + 1e-6; ww += stepW) {
        ctx.fillText(M.fmt(ww, 0), toX(ww), phTop + phH + 5);
      }
      ctx.font = '600 11px "IBM Plex Sans", sans-serif';
      ctx.fillText('Drag cursor: ω = ' + M.fmt(state.omega, 2) + ' rad/s', padL + plotW * 0.5, h - 13);
    }

    function drawPhasorCanvas() {
      if (!phasorCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(phasorCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const [j, k] = getIndices(state.entry);
      const frf = M.evalFRF(sys, state.omega);
      const mp = frf.modal[j][k];
      const h1 = mp.h1;
      const h2 = mp.h2;
      const hSum = mp.sum;
      const hExact = frf.exact[j][k];

      // Determine smart scale so h1, h2, and hSum all fit clearly with comfortable margin
      const m1 = M.cAbs(h1);
      const m2 = M.cAbs(h2);
      const ms = M.cAbs(hSum);
      const maxCoord = Math.max(
        Math.abs(h1.re),
        Math.abs(h1.im),
        Math.abs(hSum.re),
        Math.abs(hSum.im),
        Math.abs(h2.re),
        Math.abs(h2.im),
        m1,
        m2,
        ms,
        0.04
      );
      const range = maxCoord * 1.32;
      const pad = 34;
      const scale = Math.min((w - 2 * pad) / (2 * range), (h - 2 * pad - 24) / (2 * range));
      const cx = w * 0.5;
      const cy = h * 0.52;

      const toX = (re) => cx + re * scale;
      const toY = (im) => cy - im * scale;

      // Reference circles
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      [0.33, 0.66, 1.0].forEach((f) => {
        ctx.beginPath();
        ctx.arc(cx, cy, f * range * 0.88 * scale, 0, 2 * Math.PI);
        ctx.stroke();
      });

      // Real / Imag axes
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(16, cy);
      ctx.lineTo(w - 16, cy);
      ctx.moveTo(cx, 28);
      ctx.lineTo(cx, h - 22);
      ctx.stroke();

      ctx.fillStyle = C.textMuted;
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Re', w - 18, cy - 5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('Im', cx + 7, 28);

      // Ghost copy of h2 from origin (dashed) so student sees individual modal phases clearly
      ctx.save();
      ctx.strokeStyle = C.crimson;
      ctx.globalAlpha = 0.32;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(toX(h2.re), toY(h2.im));
      ctx.stroke();
      ctx.restore();

      // Mode 1 phasor h^(1) from origin
      Theme.drawArrow(ctx, cx, cy, toX(h1.re), toY(h1.im), C.teal, 2.6, 10);

      // Mode 2 phasor h^(2) head-to-tail starting at tip of h1!
      Theme.drawArrow(ctx, toX(h1.re), toY(h1.im), toX(hSum.re), toY(hSum.im), C.crimson, 2.6, 10);

      // Resultant sum H_jk = h^(1) + h^(2)
      Theme.drawArrow(ctx, cx, cy, toX(hSum.re), toY(hSum.im), C.copper, 3.0, 11);

      // If non-proportional damping causes exact H to differ visibly from modal sum, plot marker
      if (!sys.isProportional && M.cAbs(M.cSub(hExact, hSum)) > 0.02 * Math.max(m1, m2)) {
        ctx.save();
        ctx.fillStyle = C.blue;
        ctx.beginPath();
        ctx.arc(toX(hExact.re), toY(hExact.im), 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.font = '600 10.5px "IBM Plex Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('exact', toX(hExact.re) + 8, toY(hExact.im));
        ctx.restore();
      }

      // Labels for h^(1), h^(2), H_jk cleanly typeset
      const entrySub = state.entry.slice(1);
      Theme.drawMath(
        ctx,
        [{ t: 'h', bold: true }, { t: '(1)', sup: true, bold: true }],
        toX(h1.re * 0.55),
        toY(h1.im * 0.55) - 12,
        { size: 12, color: C.teal, align: 'center' }
      );
      Theme.drawMath(
        ctx,
        [{ t: 'h', bold: true }, { t: '(2)', sup: true, bold: true }],
        toX(h1.re + h2.re * 0.55),
        toY(h1.im + h2.im * 0.55) + 12,
        { size: 12, color: C.crimson, align: 'center' }
      );
      Theme.drawMath(
        ctx,
        [{ t: 'H', i: true, bold: true }, { t: entrySub, sub: true, bold: true }],
        toX(hSum.re) + 9,
        toY(hSum.im),
        { size: 12, color: C.copper, align: 'left' }
      );

      // Top summary strip inside canvas
      const dotSign = mp.res1 * mp.res2 >= 0 ? 'Same-sign residues (+,+)' : 'Opposite-sign residues (+,−)';
      const cancelRatio = ms / Math.max(1e-9, m1 + m2);
      const isCancel = cancelRatio < 0.22 && state.omega > sys.w1 && state.omega < sys.w2;

      ctx.fillStyle = isCancel ? C.amber : C.textMuted;
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(
        isCancel ? 'Destructive interference: phasors nearly cancel (antiresonance)' : dotSign,
        14,
        8
      );

      // Bottom numeric magnitude readout cleanly typeset
      Theme.drawMath(
        ctx,
        [
          { t: '|' },
          { t: 'h', bold: true },
          { t: '(1)', sup: true },
          { t: '| = ' + M.fmt(m1, 3) + '   |' },
          { t: 'h', bold: true },
          { t: '(2)', sup: true },
          { t: '| = ' + M.fmt(m2, 3) + '   |' },
          { t: 'H', i: true },
          { t: '| = ' + M.fmt(ms, 3) + ' m/N' }
        ],
        14,
        h - 12,
        { size: 10.5, color: C.textMuted, align: 'left', family: '"IBM Plex Mono", monospace' }
      );
    }

    function drawMiniRig() {
      if (!miniRigCanvas) return;
      const { ctx, w, h } = Theme.setupCanvas(miniRigCanvas);
      const C = Theme.get();

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      // Force applied at input DOF k (column of H_jk)
      const [, k] = getIndices(state.entry);
      const f0 = k === 0 ? [1.0, 0.0] : [0.0, 1.0];
      const res = M.evalForcedHarmonic(sys, f0, state.omega);
      const a1 = M.cAbs(res.X1);
      const p1 = M.cArg(res.X1);
      const a2 = M.cAbs(res.X2);
      const p2 = M.cArg(res.X2);

      // Auto-size mass blocks so m_j and |X_j| = ... always fit cleanly inside!
      const b1SubRuns = [
        { t: '|' },
        { t: 'X', i: true },
        { t: '1', sub: true },
        { t: '| = ' + M.fmt(a1, 3) }
      ];
      const b2SubRuns = [
        { t: '|' },
        { t: 'X', i: true },
        { t: '2', sub: true },
        { t: '| = ' + M.fmt(a2, 3) }
      ];
      const wSub1 = Theme.measureMathRuns(ctx, b1SubRuns, 10.5, '"IBM Plex Mono", monospace');
      const wSub2 = Theme.measureMathRuns(ctx, b2SubRuns, 10.5, '"IBM Plex Mono", monospace');
      const boxW = Math.min(130, Math.max(96, Math.ceil(Math.max(wSub1, wSub2)) + 26));
      const boxH = 44;

      const maxA = Math.max(a1, a2, 1e-6);
      const dispScale = Math.min(30, w * 0.055) / maxA;
      const x1 = a1 * Math.cos(state.phaseTime + p1) * dispScale;
      const x2 = a2 * Math.cos(state.phaseTime + p2) * dispScale;

      const leftWall = 26;
      const rightWall = w - 26;
      const hasK3 = sys.params.k3 > 1e-4;
      const span = rightWall - leftWall;
      const trackY = h * 0.60;

      const x1Rest = leftWall + span * (hasK3 ? 0.34 : 0.38);
      const x2Rest = leftWall + span * (hasK3 ? 0.66 : 0.72);
      const x1Pos = x1Rest + x1;
      const x2Pos = x2Rest + x2;

      // Floor + rest lines
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(leftWall, trackY + boxH * 0.5 + 4);
      ctx.lineTo(rightWall, trackY + boxH * 0.5 + 4);
      ctx.stroke();

      ctx.save();
      ctx.strokeStyle = C.ref;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      [x1Rest, x2Rest].forEach((xr) => {
        ctx.beginPath();
        ctx.moveTo(xr, trackY - 26);
        ctx.lineTo(xr, trackY + 26);
        ctx.stroke();
      });
      ctx.restore();

      // Walls
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(leftWall, trackY - 24);
      ctx.lineTo(leftWall, trackY + 24);
      if (hasK3) {
        ctx.moveTo(rightWall, trackY - 24);
        ctx.lineTo(rightWall, trackY + 24);
      }
      ctx.stroke();

      // Springs
      Theme.drawSpring(ctx, leftWall, trackY, x1Pos - boxW * 0.5, trackY, 6, 6, C.blue, 1.6);
      Theme.drawSpring(ctx, x1Pos + boxW * 0.5, trackY, x2Pos - boxW * 0.5, trackY, 6, 6, C.orange, 1.6);
      if (hasK3) {
        Theme.drawSpring(ctx, x2Pos + boxW * 0.5, trackY, rightWall, trackY, 6, 6, C.blue, 1.6);
      }

      // Auto-sized Masses
      function drawBlock(xc, idxStr, subRuns, color) {
        ctx.fillStyle = C.bgSubtle;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.fillRect(xc - boxW * 0.5, trackY - boxH * 0.5, boxW, boxH);
        ctx.strokeRect(xc - boxW * 0.5, trackY - boxH * 0.5, boxW, boxH);
        Theme.drawMath(ctx, [{ t: 'm', i: true, bold: true }, { t: idxStr, sub: true, bold: true }], xc, trackY - 8, {
          size: 12.5,
          color,
          align: 'center'
        });
        Theme.drawMath(ctx, subRuns, xc, trackY + 10, {
          size: 10.5,
          color: C.textMuted,
          align: 'center',
          family: '"IBM Plex Mono", monospace'
        });
      }
      drawBlock(x1Pos, '1', b1SubRuns, C.blue);
      drawBlock(x2Pos, '2', b2SubRuns, C.orange);

      // Oscillating force arrow on driven mass
      const fVal = Math.cos(state.phaseTime);
      const drivenX = k === 0 ? x1Pos : x2Pos;
      if (Math.abs(fVal) > 0.08) {
        Theme.drawArrow(
          ctx,
          drivenX,
          trackY - boxH * 0.5 - 11,
          drivenX + fVal * 32,
          trackY - boxH * 0.5 - 11,
          C.copper,
          2.2,
          8
        );
      }

      Theme.drawMath(
        ctx,
        [
          { t: 'Steady-state motion driven on ', bold: true },
          { t: 'm', i: true, bold: true },
          { t: String(k + 1), sub: true, bold: true },
          { t: ' at ω = ' + M.fmt(state.omega, 2) + ' rad/s   (|', bold: true },
          { t: 'X', i: true, bold: true },
          { t: '1', sub: true, bold: true },
          { t: '|/|', bold: true },
          { t: 'X', i: true, bold: true },
          { t: '2', sub: true, bold: true },
          { t: '| = ' + M.fmt(a1 / Math.max(1e-6, a2), 2) + ')', bold: true }
        ],
        14,
        13,
        { size: 11.5, color: C.text, align: 'left' }
      );
    }

    function render() {
      drawBodeCanvas();
      drawPhasorCanvas();
      drawMiniRig();
    }

    // Drag frequency cursor directly on Bode canvas
    if (bodeCanvas) {
      function updateFreqFromPointer(e) {
        const rect = bodeCanvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const frac = Math.max(0.01, Math.min(0.995, (px - bodeView.padL) / bodeView.plotW));
        setOmega(frac * sys.wMax);
      }
      bodeCanvas.addEventListener('pointerdown', function (e) {
        state.draggingFreq = true;
        bodeCanvas.setPointerCapture(e.pointerId);
        updateFreqFromPointer(e);
      });
      bodeCanvas.addEventListener('pointermove', function (e) {
        if (!state.draggingFreq) return;
        updateFreqFromPointer(e);
      });
      bodeCanvas.addEventListener('pointerup', function () {
        state.draggingFreq = false;
      });
      bodeCanvas.addEventListener('pointercancel', function () {
        state.draggingFreq = false;
      });
    }

    return {
      setSystem,
      setEntry,
      setOmega,
      snapToAntiresonance,
      getState: () => ({ entry: state.entry, omega: state.omega }),
      step,
      render
    };
  }

  window.VibLab.VizAntiresonance = { create: createAntiresonanceViz };
})();
