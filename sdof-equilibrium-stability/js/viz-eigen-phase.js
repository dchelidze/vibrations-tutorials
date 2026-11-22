/**
 * viz-eigen-phase.js
 * Section 2: Synchronized Complex Eigenvalue Plane (lambda1, lambda2 + root loci)
 * and Interactive Phase Portrait (vector field, eigendirections, nullclines,
 * click-to-launch probe trajectory).
 */
window.VibLab = window.VibLab || {};

window.VibLab.EigenPhaseViz = (function () {
  'use strict';

  const M = window.VibLab.MathStab;
  const Theme = window.VibLab.Theme;

  function create(opts) {
    const eigCanvas = opts.eigCanvas;
    const phaseCanvas = opts.phaseCanvas;

    const state = {
      sys: opts.sys,
      showEigen: true,
      showNullclines: true,
      showField: true,
      probeZ0: [1.45, 0.55],
      probeT: 0,
      playing: true,
      visible: true
    };

    function setSystem(sys) {
      state.sys = sys;
      state.probeT = 0;
      render();
    }

    function setOptions(o) {
      if (o.showEigen !== undefined) state.showEigen = o.showEigen;
      if (o.showNullclines !== undefined) state.showNullclines = o.showNullclines;
      if (o.showField !== undefined) state.showField = o.showField;
      render();
    }

    function setProbe(z0) {
      state.probeZ0 = [z0[0], z0[1]];
      state.probeT = 0;
      if (typeof opts.onProbeChange === 'function') opts.onProbeChange(state.probeZ0);
      render();
    }

    function setPlaying(p) {
      state.playing = !!p;
    }

    function setVisible(v) {
      state.visible = !!v;
    }

    function step(dt) {
      if (!state.visible || !state.playing) return;
      const sys = state.sys;
      const tLoop = sys.stability === 'unstable' ? 3.2 : 7.5;
      state.probeT += dt * 0.85;
      if (state.probeT > tLoop) state.probeT = 0;
      renderPhase();
    }

    function drawArrowHead(ctx, x, y, ux, uy, size, color) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - size * ux - size * 0.48 * uy, y - size * uy + size * 0.48 * ux);
      ctx.lineTo(x - size * ux + size * 0.48 * uy, y - size * uy - size * 0.48 * ux);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    /* ---------------- Left Canvas: Complex Eigenvalue Plane ---------------- */
    function renderEigenPlane() {
      const { ctx, w, h } = Theme.setupHiDPI(eigCanvas);
      const C = Theme.colors();
      const sys = state.sys;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      const padL = 44;
      const padR = 20;
      const padT = 30;
      const padB = 34;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const lim = 3.4;

      const scale = Math.min(plotW, plotH) / (2 * lim);
      const cx = padL + plotW * 0.5;
      const cy = padT + plotH * 0.5;
      const toX = (re) => cx + re * scale;
      const toY = (im) => cy - im * scale;

      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      // Stable LHP and Unstable RHP shading
      ctx.fillStyle = C.stableFill;
      ctx.fillRect(padL, padT, cx - padL, plotH);
      ctx.fillStyle = C.unstableFill;
      ctx.fillRect(cx, padT, padL + plotW - cx, plotH);

      // Grid lines
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let v = -3; v <= 3; v++) {
        ctx.beginPath();
        ctx.moveTo(toX(v), padT);
        ctx.lineTo(toX(v), padT + plotH);
        ctx.moveTo(padL, toY(v));
        ctx.lineTo(padL + plotW, toY(v));
        ctx.stroke();
      }

      // Root locus for varying tau at fixed delta > 0: circle |lambda| = sqrt(delta)
      if (sys.delta > M.EPS) {
        const rad = Math.sqrt(sys.delta);
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = C.ref;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(cx, cy, rad * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = C.muted;
        ctx.font = '500 10.5px "IBM Plex Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('|λ| = √Δ = ' + M.fmt(rad, 2), cx + rad * scale * 0.72 + 5, cy - rad * scale * 0.72 - 4);
      }

      // Vertical midpoint line Re(lambda) = tau / 2
      const sigX = toX(0.5 * sys.tau);
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(sigX, padT);
      ctx.lineTo(sigX, padT + plotH);
      ctx.stroke();
      ctx.restore();

      // Axes
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(padL, cy);
      ctx.lineTo(padL + plotW, cy);
      ctx.stroke();

      // Stability boundary Im-axis
      ctx.strokeStyle = C.amber;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(cx, padT);
      ctx.lineTo(cx, padT + plotH);
      ctx.stroke();

      // Midpoint marker (tau / 2, 0)
      ctx.fillStyle = C.copper;
      ctx.beginPath();
      ctx.arc(sigX, cy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Plot eigenvalues lambda_1 and lambda_2
      const pts = [
        { l: sys.l1, label: 'λ₁', color: sys.l1.re < -M.EPS ? C.teal : sys.l1.re > M.EPS ? C.crimson : C.amber },
        { l: sys.l2, label: 'λ₂', color: sys.l2.re < -M.EPS ? C.blue : sys.l2.re > M.EPS ? C.orange : C.amber }
      ];

      // Connecting segment between lambda1 and lambda2
      ctx.strokeStyle = C.navy;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(toX(sys.l1.re), toY(sys.l1.im));
      ctx.lineTo(toX(sys.l2.re), toY(sys.l2.im));
      ctx.stroke();

      pts.forEach(function (item, idx) {
        const px = toX(item.l.re);
        const py = toY(item.l.im);
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 2.5;
        const r = 6.5;
        ctx.beginPath();
        ctx.moveTo(px - r, py - r);
        ctx.lineTo(px + r, py + r);
        ctx.moveTo(px - r, py + r);
        ctx.lineTo(px + r, py - r);
        ctx.stroke();

        ctx.fillStyle = item.color;
        ctx.font = '600 12px "IBM Plex Sans", sans-serif';
        ctx.textAlign = 'left';
        const dy = sys.eigType === 'real_repeated' ? (idx === 0 ? -12 : 18) : idx === 0 ? -10 : 16;
        ctx.fillText(item.label, px + 10, py + dy);
      });

      // Region captions inside plot
      ctx.font = '600 11px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = C.teal;
      ctx.textAlign = 'left';
      ctx.fillText('Re(λ) < 0 · Decaying', padL + 8, padT + 16);
      ctx.fillStyle = C.crimson;
      ctx.textAlign = 'right';
      ctx.fillText('Re(λ) > 0 · Growing', padL + plotW - 8, padT + 16);

      ctx.restore();

      // Axis ticks & labels
      ctx.fillStyle = C.muted;
      ctx.font = '500 10.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      for (let v = -3; v <= 3; v++) {
        if (v === 0) continue;
        const px = toX(v);
        if (px > padL + 8 && px < padL + plotW - 8) {
          ctx.fillText(String(v), px, padT + plotH + 15);
        }
      }
      ctx.textAlign = 'right';
      for (let v = -3; v <= 3; v++) {
        if (v === 0) continue;
        const py = toY(v);
        if (py > padT + 8 && py < padT + plotH - 8) {
          ctx.fillText(v + 'i', padL - 6, py + 4);
        }
      }

      ctx.fillStyle = C.text;
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Re(λ)', padL + plotW, padT + plotH + 28);
      ctx.textAlign = 'left';
      ctx.fillText('Im(λ)', padL + 4, padT - 10);

      ctx.textAlign = 'right';
      ctx.fillStyle = C.copper;
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillText('midpoint τ/2 = ' + M.fmt(0.5 * sys.tau, 2), padL + plotW, padT - 10);
    }

    /* ---------------- Right Canvas: Interactive Phase Portrait ---------------- */
    function phaseHelpers(w, h) {
      const padL = 44;
      const padR = 18;
      const padT = 28;
      const padB = 34;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const lim = 2.6;
      const scale = Math.min(plotW, plotH) / (2 * lim);
      const cx = padL + plotW * 0.5;
      const cy = padT + plotH * 0.5;
      return {
        padL,
        padR,
        padT,
        padB,
        plotW,
        plotH,
        lim,
        scale,
        cx,
        cy,
        toX: (x) => cx + x * scale,
        toY: (v) => cy - v * scale,
        fromPx: (px, py) => [(px - cx) / scale, (cy - py) / scale]
      };
    }

    function drawTrajectory(ctx, g, sys, z0, tBack, tFwd, color, lw, withArrow) {
      const steps = 110;
      const bound = g.lim * 1.85;
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const t = tBack + ((tFwd - tBack) * i) / steps;
        const z = M.evalFlow(sys, z0, t);
        if (!Number.isFinite(z[0]) || !Number.isFinite(z[1])) continue;
        if (Math.abs(z[0]) <= bound && Math.abs(z[1]) <= bound) {
          pts.push(z);
        } else if (pts.length > 0 && t > 0) {
          break;
        }
      }
      if (pts.length < 2) return;

      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const px = g.toX(pts[i][0]);
        const py = g.toY(pts[i][1]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.stroke();

      if (withArrow && pts.length > 10) {
        const mid = Math.floor(pts.length * 0.52);
        const pA = pts[mid - 1];
        const pB = pts[mid + 1];
        const dx = g.toX(pB[0]) - g.toX(pA[0]);
        const dy = g.toY(pB[1]) - g.toY(pA[1]);
        const len = Math.hypot(dx, dy);
        if (len > 1.5) {
          drawArrowHead(ctx, g.toX(pB[0]), g.toY(pB[1]), dx / len, dy / len, 6.5, color);
        }
      }
    }

    function renderPhase() {
      const { ctx, w, h } = Theme.setupHiDPI(phaseCanvas);
      const C = Theme.colors();
      const sys = state.sys;
      const g = phaseHelpers(w, h);

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.beginPath();
      ctx.rect(g.padL, g.padT, g.plotW, g.plotH);
      ctx.clip();

      // Grid
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let v = -2; v <= 2; v++) {
        ctx.beginPath();
        ctx.moveTo(g.toX(v), g.padT);
        ctx.lineTo(g.toX(v), g.padT + g.plotH);
        ctx.moveTo(g.padL, g.toY(v));
        ctx.lineTo(g.padL + g.plotW, g.toY(v));
        ctx.stroke();
      }

      // Coordinate axes
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(g.padL, g.cy);
      ctx.lineTo(g.padL + g.plotW, g.cy);
      ctx.moveTo(g.cx, g.padT);
      ctx.lineTo(g.cx, g.padT + g.plotH);
      ctx.stroke();

      // Vector field arrows (uses general sys.A so star A = lambda*I works seamlessly)
      if (state.showField) {
        const nGrid = 13;
        const stepVal = (2 * g.lim) / (nGrid + 1);
        ctx.strokeStyle = Theme.isDark() ? 'rgba(169,182,191,0.34)' : 'rgba(19,36,51,0.24)';
        ctx.lineWidth = 1.05;
        for (let ix = 1; ix <= nGrid; ix++) {
          const x = -g.lim + ix * stepVal;
          for (let iv = 1; iv <= nGrid; iv++) {
            const v = -g.lim + iv * stepVal;
            const dx = sys.A[0][0] * x + sys.A[0][1] * v;
            const dv = sys.A[1][0] * x + sys.A[1][1] * v;
            const mag = Math.hypot(dx, dv);
            if (mag < 1e-4) continue;
            const px = g.toX(x);
            const py = g.toY(v);
            const len = Math.min(13, 5 + 3.2 * Math.log1p(mag));
            const ux = dx / mag;
            const uy = -dv / mag; // canvas y inverted
            ctx.beginPath();
            ctx.moveTo(px - 0.45 * len * ux, py - 0.45 * len * uy);
            ctx.lineTo(px + 0.55 * len * ux, py + 0.55 * len * uy);
            ctx.stroke();
            drawArrowHead(
              ctx,
              px + 0.55 * len * ux,
              py + 0.55 * len * uy,
              ux,
              uy,
              4.0,
              Theme.isDark() ? 'rgba(169,182,191,0.45)' : 'rgba(19,36,51,0.34)'
            );
          }
        }
      }

      // Nullclines
      if (state.showNullclines) {
        ctx.save();
        ctx.setLineDash([6, 4]);
        if (sys.isStar) {
          // For A = lambda I: z1_dot = 0 on x = 0, z2_dot = 0 on v = 0
          ctx.strokeStyle = C.ref;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(g.cx, g.padT);
          ctx.lineTo(g.cx, g.padT + g.plotH);
          ctx.stroke();

          ctx.strokeStyle = C.amber;
          ctx.lineWidth = 1.7;
          ctx.beginPath();
          ctx.moveTo(g.padL, g.cy);
          ctx.lineTo(g.padL + g.plotW, g.cy);
          ctx.stroke();
        } else {
          // v = 0 nullcline (vertical tangents)
          ctx.strokeStyle = C.ref;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(g.padL, g.cy);
          ctx.lineTo(g.padL + g.plotW, g.cy);
          ctx.stroke();

          // -delta*x + tau*v = 0 nullcline (horizontal tangents)
          ctx.strokeStyle = C.amber;
          ctx.lineWidth = 1.7;
          ctx.beginPath();
          if (Math.abs(sys.tau) < M.EPS) {
            if (Math.abs(sys.delta) >= M.EPS) {
              ctx.moveTo(g.cx, g.padT);
              ctx.lineTo(g.cx, g.padT + g.plotH);
            }
          } else {
            const slope = sys.delta / sys.tau;
            const R = g.lim * 2.2;
            ctx.moveTo(g.toX(-R), g.toY(-slope * R));
            ctx.lineTo(g.toX(R), g.toY(slope * R));
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      // Reference family of trajectories
      const trajColor = Theme.isDark() ? 'rgba(77, 190, 238, 0.74)' : 'rgba(0, 114, 189, 0.72)';
      const ringSeeds = [];
      const nSeeds = 12;
      for (let i = 0; i < nSeeds; i++) {
        const ang = (2 * Math.PI * i) / nSeeds + 0.14;
        ringSeeds.push([1.75 * Math.cos(ang), 1.75 * Math.sin(ang)]);
      }

      if (sys.regime === 'center') {
        const radii = [0.65, 1.25, 1.85];
        const w0 = Math.sqrt(sys.delta);
        const T = (2 * Math.PI) / Math.max(0.25, w0);
        radii.forEach(function (r) {
          drawTrajectory(ctx, g, sys, [r, 0], 0, T, trajColor, 1.6, true);
        });
      } else if (sys.regime === 'saddle') {
        ringSeeds.forEach(function (s) {
          drawTrajectory(ctx, g, sys, s, -2.4, 2.4, trajColor, 1.45, true);
        });
      } else if (sys.regime === 'line_stable' || sys.regime === 'line_unstable') {
        const lineSeeds = [
          [-1.8, 1.6],
          [-0.8, 1.6],
          [0.2, 1.6],
          [1.2, 1.6],
          [-1.2, -1.6],
          [-0.2, -1.6],
          [0.8, -1.6],
          [1.8, -1.6]
        ];
        lineSeeds.forEach(function (s) {
          drawTrajectory(
            ctx,
            g,
            sys,
            s,
            sys.tau < 0 ? -0.4 : -3.2,
            sys.tau < 0 ? 3.5 : 0.4,
            trajColor,
            1.5,
            true
          );
        });
      } else if (sys.regime === 'nilpotent') {
        [-1.8, -1.1, -0.5, 0.5, 1.1, 1.8].forEach(function (v0) {
          drawTrajectory(ctx, g, sys, [0, v0], -3.0, 3.0, trajColor, 1.5, true);
        });
      } else {
        const tB = sys.tau < 0 ? -0.7 : -5.5;
        const tF = sys.tau < 0 ? 5.5 : 0.7;
        ringSeeds.forEach(function (s) {
          drawTrajectory(ctx, g, sys, s, tB, tF, trajColor, 1.45, true);
        });
      }

      // Eigendirections overlay
      if (state.showEigen) {
        if (sys.isStar) {
          const starCol = sys.l1.re < 0 ? C.teal : C.crimson;
          const dir = sys.l1.re > 0 ? 1 : -1;
          const nRays = 8;
          const R = g.lim * 1.5;
          ctx.save();
          ctx.strokeStyle = starCol;
          ctx.lineWidth = 2.0;
          for (let i = 0; i < nRays; i++) {
            const ang = (Math.PI * i) / nRays;
            const ex = Math.cos(ang);
            const ev = Math.sin(ang);
            ctx.beginPath();
            ctx.moveTo(g.toX(-ex * R), g.toY(-ev * R));
            ctx.lineTo(g.toX(ex * R), g.toY(ev * R));
            ctx.stroke();
            [1.35, -1.35].forEach(function (s) {
              const ux = (s > 0 ? 1 : -1) * dir * ex;
              const uy = -(s > 0 ? 1 : -1) * dir * ev;
              drawArrowHead(ctx, g.toX(ex * s), g.toY(ev * s), ux, uy, 7.5, starCol);
            });
          }
          ctx.fillStyle = starCol;
          ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('Every ray is an eigendirection (A = λI)', g.padL + 8, g.padT + 16);
          ctx.restore();
        } else if (sys.eigenvectors.length > 0) {
          sys.eigenvectors.forEach(function (ev, idx) {
            const color =
              ev.role === 'stable' || ev.role === 'slow' || ev.role === 'zero'
                ? C.teal
                : ev.role === 'unstable' || ev.role === 'fast' || ev.role === 'nonzero'
                  ? C.crimson
                  : C.purple;
            const R = g.lim * 2.2;
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.3;
            ctx.beginPath();
            ctx.moveTo(g.toX(-ev.x * R), g.toY(-ev.v * R));
            ctx.lineTo(g.toX(ev.x * R), g.toY(ev.v * R));
            ctx.stroke();

            // Flow arrows along the invariant eigenspace
            if (Math.abs(ev.lambda) > M.EPS) {
              const dir = ev.lambda > 0 ? 1 : -1;
              [1.25, -1.25].forEach(function (s) {
                const px = g.toX(ev.x * s);
                const py = g.toY(ev.v * s);
                const ux = (s > 0 ? 1 : -1) * dir * ev.x;
                const uy = -(s > 0 ? 1 : -1) * dir * ev.v;
                drawArrowHead(ctx, px, py, ux, uy, 8.0, color);
              });
            }

            // Label near edge
            const lx = g.toX(ev.x * 1.95);
            const ly = g.toY(ev.v * 1.95);
            ctx.fillStyle = color;
            ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
            ctx.textAlign = 'left';
            const tag =
              ev.role === 'stable'
                ? 'Eˢ (λ₁=' + M.fmt(ev.lambda, 2) + ')'
                : ev.role === 'unstable'
                  ? 'Eᵘ (λ₂=' + M.fmt(ev.lambda, 2) + ')'
                  : ev.role === 'slow'
                    ? 'v₁ slow (λ₁=' + M.fmt(ev.lambda, 2) + ')'
                    : ev.role === 'fast'
                      ? 'v₂ fast (λ₂=' + M.fmt(ev.lambda, 2) + ')'
                      : ev.role === 'repeated'
                        ? 'v (double λ=' + M.fmt(ev.lambda, 2) + ')'
                        : 'v' + (idx + 1) + ' (λ=' + M.fmt(ev.lambda, 2) + ')';
            const clampedX = Math.max(g.padL + 6, Math.min(g.padL + g.plotW - 110, lx + 6));
            const clampedY = Math.max(g.padT + 16, Math.min(g.padT + g.plotH - 10, ly - 6));
            ctx.fillText(tag, clampedX, clampedY);
            ctx.restore();
          });
        } else if (sys.eigType === 'complex') {
          // Draw canonical invariant basis u = [1, sigma]^T, w = [0, omega]^T
          const sigma = sys.l1.re;
          const omega = Math.abs(sys.l1.im);
          const uLen = Math.hypot(1, sigma);
          const ux = 1 / uLen;
          const uv = sigma / uLen;
          const scaleVec = 1.1;

          // Vector u
          ctx.strokeStyle = C.purple;
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(g.cx, g.cy);
          ctx.lineTo(g.toX(ux * scaleVec), g.toY(uv * scaleVec));
          ctx.stroke();
          drawArrowHead(ctx, g.toX(ux * scaleVec), g.toY(uv * scaleVec), ux, -uv, 7.5, C.purple);

          // Vector w (vertical)
          ctx.beginPath();
          ctx.moveTo(g.cx, g.cy);
          ctx.lineTo(g.toX(0), g.toY(Math.min(1.6, omega * 0.7)));
          ctx.stroke();
          drawArrowHead(ctx, g.toX(0), g.toY(Math.min(1.6, omega * 0.7)), 0, -1, 7.5, C.purple);

          ctx.fillStyle = C.purple;
          ctx.font = '600 11px "IBM Plex Sans", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('Re(v)', g.toX(ux * scaleVec) + 5, g.toY(uv * scaleVec) + 4);
          ctx.fillText('Im(v)', g.cx + 6, g.toY(Math.min(1.6, omega * 0.7)) + 4);
        }
      }

      // Interactive copper probe trajectory from probeZ0
      const probeTBack = sys.tau > M.EPS ? -2.2 : -0.35;
      const probeTFwd = sys.regime === 'center' ? (2 * Math.PI) / Math.max(0.25, Math.sqrt(sys.delta)) : 6.0;
      drawTrajectory(ctx, g, sys, state.probeZ0, probeTBack, probeTFwd, C.copper, 2.6, false);

      // Initial condition square marker
      ctx.fillStyle = C.bg;
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 2.2;
      ctx.fillRect(g.toX(state.probeZ0[0]) - 4.5, g.toY(state.probeZ0[1]) - 4.5, 9, 9);
      ctx.strokeRect(g.toX(state.probeZ0[0]) - 4.5, g.toY(state.probeZ0[1]) - 4.5, 9, 9);

      // Animated particle along probe trajectory
      const zNow = M.evalFlow(sys, state.probeZ0, state.probeT);
      if (Math.abs(zNow[0]) < g.lim * 1.4 && Math.abs(zNow[1]) < g.lim * 1.4) {
        ctx.fillStyle = C.copper;
        ctx.strokeStyle = C.bg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(g.toX(zNow[0]), g.toY(zNow[1]), 6.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Equilibrium point at origin (or whole x-axis if delta = 0)
      if (sys.regime === 'line_stable' || sys.regime === 'line_unstable' || sys.regime === 'nilpotent') {
        ctx.strokeStyle = sys.regime === 'line_stable' ? C.teal : C.crimson;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(g.padL, g.cy);
        ctx.lineTo(g.padL + g.plotW, g.cy);
        ctx.stroke();
      } else {
        const eqCol =
          sys.stability === 'asymptotic' ? C.teal : sys.stability === 'lyapunov' ? C.amber : C.crimson;
        ctx.fillStyle = sys.stability === 'asymptotic' ? eqCol : C.bg;
        ctx.strokeStyle = eqCol;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(g.cx, g.cy, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();

      // Axis labels & ticks
      ctx.fillStyle = C.muted;
      ctx.font = '500 10.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      for (let v = -2; v <= 2; v++) {
        if (v === 0) continue;
        ctx.fillText(String(v), g.toX(v), g.padT + g.plotH + 15);
      }
      ctx.textAlign = 'right';
      for (let v = -2; v <= 2; v++) {
        if (v === 0) continue;
        ctx.fillText(String(v), g.padL - 6, g.toY(v) + 4);
      }

      ctx.fillStyle = C.text;
      ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('x (displacement)', g.padL + g.plotW, g.padT + g.plotH + 28);
      ctx.textAlign = 'left';
      ctx.fillText('v = ẋ (velocity)', g.padL + 4, g.padT - 10);

      ctx.textAlign = 'right';
      ctx.fillStyle = C.muted;
      ctx.font = '500 11px "IBM Plex Sans", sans-serif';
      ctx.fillText('Click anywhere to launch z₀ = [x₀, v₀]ᵀ', g.padL + g.plotW, g.padT - 10);
    }

    function render() {
      renderEigenPlane();
      renderPhase();
    }

    // Click to place probe IC
    phaseCanvas.style.cursor = 'crosshair';
    phaseCanvas.addEventListener('pointerdown', function (e) {
      const rect = phaseCanvas.getBoundingClientRect();
      const g = phaseHelpers(rect.width, rect.height);
      const z = g.fromPx(e.clientX - rect.left, e.clientY - rect.top);
      const x = Math.max(-2.4, Math.min(2.4, z[0]));
      const v = Math.max(-2.4, Math.min(2.4, z[1]));
      setProbe([x, v]);
    });

    render();

    return {
      setSystem,
      setOptions,
      setProbe,
      setPlaying,
      setVisible,
      step,
      render
    };
  }

  return { create };
})();
