/**
 * remanence/engine.js - Pure DSP & video processing for Remanence
 *
 * Implements acausal magnetic print-through simulation for audio and video:
 * - Archimedean spiral reel geometry with configurable wrap period and growth
 * - Pre-echo (anticipation) and post-echo (wake) multi-tap coupling
 * - Non-local reel-fold mirror cross-print
 * - Whole-signal occupancy/recurrence wear map (HF self-erasure & oxide shed dropout)
 * - Liquid wow/flutter transport flow map
 * - VHS head-switch tracking seam ducking and cadence whoosh / row tearing
 * - Spatial low-pass tilt filtering on video ghost buffers
 * - Toroidal circular loop option across the reel seam
 *
 * Zero DOM, Web Audio API, or canvas requirements in the core processing engine.
 */

(function (root, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory();
  } else if (typeof define === "function" && define.amd) {
    define([], factory);
  } else {
    root.RemanenceDSP = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const defaultParams = Object.freeze({
    print: 0.6,     // ghost level (linear amplitude scale, 0..2)
    wraps: 6,       // bleed depth (# neighbour wraps, integer >= 1)
    wind: -0.45,    // time arrow: -1 pre (anticipation) .. 0 symmetric .. +1 post (wake)
    wrap: 0.060,    // hub period in seconds (base echo spacing, 0.01..0.5 s)
    grow: 0.120,    // hub->rim drift in seconds (spiral slope)
    fold: 0.0,      // mirror across the reel (0..1)
    wear: 0.0,      // occupancy wear map (0..1)
    flow: 0.0,      // wow/flutter transport warp (0..1)
    track: 0.0,     // VHS head-switch failure (0..1)
    fall: 0.70,     // per-wrap decay (0..1)
    tilt: 1800,     // audio LP cutoff Hz / video ghost blur bias
    dry: 1.0,       // dry blend (0..1)
    loop: 0         // toroidal splice: 0 open tape (silence at ends) / 1 circle loop (wrap)
  });

  const PRESETS = Object.freeze({
    faithful:  Object.freeze({ print: 0.18, wraps: 2,  wind: 0.20,  wrap: 0.045, grow: 0.040, fold: 0.0,  wear: 0.06, flow: 0.03, track: 0.0,  fall: 0.55, tilt: 900,   dry: 1.00, loop: 0 }),
    haunt:     Object.freeze({ print: 0.55, wraps: 5,  wind: -0.40, wrap: 0.070, grow: 0.110, fold: 0.0,  wear: 0.14, flow: 0.14, track: 0.05, fall: 0.70, tilt: 1800,  dry: 1.00, loop: 0 }),
    tailout:   Object.freeze({ print: 0.36, wraps: 4,  wind: 0.75,  wrap: 0.090, grow: 0.080, fold: 0.0,  wear: 0.10, flow: 0.08, track: 0.07, fall: 0.64, tilt: 1300,  dry: 1.00, loop: 0 }),
    zero:      Object.freeze({ print: 0.45, wraps: 8,  wind: 0.00,  wrap: 0.055, grow: 0.000, fold: 0.0,  wear: 0.00, flow: 0.00, track: 0.00, fall: 0.76, tilt: 3000,  dry: 1.00, loop: 0 }),
    fold:      Object.freeze({ print: 0.95, wraps: 16, wind: -0.10, wrap: 0.120, grow: 0.360, fold: 0.75, wear: 0.30, flow: 0.20, track: 0.12, fall: 0.82, tilt: 6000,  dry: 0.90, loop: 0 }),
    dub:       Object.freeze({ print: 0.78, wraps: 10, wind: 0.35,  wrap: 0.130, grow: 0.210, fold: 0.20, wear: 0.52, flow: 0.35, track: 0.42, fall: 0.74, tilt: 700,   dry: 0.82, loop: 0 }),
    longfold:  Object.freeze({ print: 1.05, wraps: 18, wind: -0.55, wrap: 0.210, grow: 0.500, fold: 0.90, wear: 0.58, flow: 0.42, track: 0.24, fall: 0.90, tilt: 12000, dry: 0.85, loop: 0 }),
    swarm:     Object.freeze({ print: 1.10, wraps: 22, wind: -0.85, wrap: 0.038, grow: 0.180, fold: 0.35, wear: 0.36, flow: 0.28, track: 0.16, fall: 0.88, tilt: 9000,  dry: 0.95, loop: 0 }),
    cartridge: Object.freeze({ print: 0.70, wraps: 8,  wind: 0.10,  wrap: 0.090, grow: 0.060, fold: 0.0,  wear: 0.24, flow: 0.30, track: 0.14, fall: 0.78, tilt: 1400,  dry: 1.00, loop: 1 }),
    melt:      Object.freeze({ print: 1.35, wraps: 24, wind: -0.20, wrap: 0.300, grow: 0.500, fold: 0.60, wear: 0.92, flow: 0.86, track: 0.78, fall: 0.96, tilt: 350,   dry: 0.75, loop: 0 })
  });

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function validateParams(raw = {}) {
    const P = { ...defaultParams, ...raw };

    // Support percentage/integer input forms if supplied from sliders
    if (typeof raw.print === "number" && raw.print > 2.0) P.print = raw.print / 100;
    if (typeof raw.wrap === "number" && raw.wrap >= 1.0) P.wrap = raw.wrap / 1000;
    if (typeof raw.grow === "number" && raw.grow >= 1.0) P.grow = raw.grow / 1000;
    if (typeof raw.fold === "number" && raw.fold > 1.0) P.fold = raw.fold / 100;
    if (typeof raw.wear === "number" && raw.wear > 1.0) P.wear = raw.wear / 100;
    if (typeof raw.flow === "number" && raw.flow > 1.0) P.flow = raw.flow / 100;
    if (typeof raw.track === "number" && raw.track > 1.0) P.track = raw.track / 100;
    if (typeof raw.fall === "number" && raw.fall > 1.0) P.fall = raw.fall / 100;
    if (typeof raw.dry === "number" && raw.dry > 1.0) P.dry = raw.dry / 100;

    return {
      print: Math.max(0, P.print),
      wraps: Math.max(1, Math.round(P.wraps)),
      wind: clamp(P.wind, -1, 1),
      wrap: Math.max(0.001, P.wrap),
      grow: Math.max(0, P.grow),
      fold: clamp(P.fold, 0, 1),
      wear: clamp(P.wear, 0, 1),
      flow: clamp(P.flow, 0, 1),
      track: clamp(P.track, 0, 1),
      fall: clamp(P.fall, 0, 1),
      tilt: Math.max(20, P.tilt),
      dry: clamp(P.dry, 0, 2),
      loop: P.loop ? 1 : 0
    };
  }

  function toChannels(source) {
    if (!source) throw new TypeError("Remanence: source must not be empty");
    if (typeof source.numberOfChannels === "number" && typeof source.getChannelData === "function") {
      const ch = source.numberOfChannels;
      const res = new Array(ch);
      for (let c = 0; c < ch; c++) res[c] = source.getChannelData(c);
      return res;
    }
    if (Array.isArray(source)) {
      if (!source.length) throw new TypeError("Remanence: source array must not be empty");
      if (source[0] instanceof Float32Array || Array.isArray(source[0])) {
        return source.map(c => (c instanceof Float32Array ? c : new Float32Array(c)));
      }
      return [new Float32Array(source)];
    }
    if (source instanceof Float32Array) {
      return [source];
    }
    throw new TypeError("Remanence: source format unrecognized");
  }

  function sampleAt(x, pos, loop = 0) {
    const N = x.length;
    if (pos >= 0 && pos <= N - 1) {
      const i = pos | 0, f = pos - i;
      return i >= N - 1 ? x[N - 1] : x[i] * (1 - f) + x[i + 1] * f;
    }
    if (!loop) return 0; // open tape: silence past ends
    const wp = ((pos % N) + N) % N, i = wp | 0, f = wp - i, j = (i + 1) % N;
    return x[i] * (1 - f) + x[j] * f;
  }

  function flowSample(x, pos, flowMap, loop = 0) {
    return sampleAt(x, pos + (flowMap ? sampleAt(flowMap, pos, loop) : 0), loop);
  }

  function boxBlur1(src, r, passes = 1) {
    const N = src.length;
    if (r < 1 || N < 2) return src.slice();
    let a = src, b = new Float32Array(N), win = 2 * r + 1;
    for (let p = 0; p < passes; p++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += a[Math.min(N - 1, Math.max(0, i))];
      for (let i = 0; i < N; i++) {
        b[i] = s / win;
        const add = Math.min(N - 1, i + r + 1), sub = Math.max(0, i - r);
        s += a[add] - a[sub];
      }
      const t = a; a = b; b = t;
    }
    return a;
  }

  function normalizeMap(map, pow = 0.72) {
    let peak = 0;
    for (let i = 0; i < map.length; i++) if (map[i] > peak) peak = map[i];
    if (peak < 1e-9) return map;
    const scale = 1 / peak;
    for (let i = 0; i < map.length; i++) map[i] = Math.pow(clamp01(map[i] * scale), pow);
    return map;
  }

  // separable box blur, 3-channel interleaved Float32 (stride 3) - video spatial LF (print tilt)
  function boxBlur3(buf, W, H, r) {
    if (r < 1) return;
    const tmp = new Float32Array(buf.length), win = 2 * r + 1;
    for (let ch = 0; ch < 3; ch++) {
      for (let y = 0; y < H; y++) {
        let s = 0; const row = y * W;
        for (let x = -r; x <= r; x++) s += buf[(row + Math.min(W - 1, Math.max(0, x))) * 3 + ch];
        for (let x = 0; x < W; x++) {
          tmp[(row + x) * 3 + ch] = s / win;
          const add = Math.min(W - 1, x + r + 1), sub = Math.max(0, x - r);
          s += buf[(row + add) * 3 + ch] - buf[(row + sub) * 3 + ch];
        }
      }
    }
    for (let ch = 0; ch < 3; ch++) {
      for (let x = 0; x < W; x++) {
        let s = 0;
        for (let y = -r; y <= r; y++) s += tmp[(Math.min(H - 1, Math.max(0, y)) * W + x) * 3 + ch];
        for (let y = 0; y < H; y++) {
          buf[(y * W + x) * 3 + ch] = s / win;
          const add = Math.min(H - 1, y + r + 1), sub = Math.max(0, y - r);
          s += tmp[(add * W + x) * 3 + ch] - tmp[(sub * W + x) * 3 + ch];
        }
      }
    }
  }

  function shedLoss(n, wear) {
    if (wear <= 0) return 0;
    const phase = 0.5 + 0.5 * Math.sin(n * 0.00083 + Math.sin(n * 0.000091) * 6.283);
    const scar = Math.max(0, phase + wear * 1.12 - 1.08);
    return Math.min(0.92, 0.22 * Math.pow(wear, 1.7) + 0.78 * scar * wear);
  }

  function buildAudioWearMap(channels, sr, N, depth, fall, wrap0, growS, fold, slope, lin, O0s, ek, Etot, wearAmount, loop = 0) {
    if (wearAmount <= 0) return null;
    const amp = new Float32Array(N), ch = channels.length;
    for (let n = 0; n < N; n++) {
      let s = 0;
      for (let c = 0; c < ch; c++) s += Math.abs(channels[c][n] || 0);
      amp[n] = s / ch;
    }
    const env = boxBlur1(amp, Math.max(1, (sr * 0.012) | 0), 2);
    const g = new Float32Array(depth + 1), map = new Float32Array(N);
    for (let k = 1; k <= depth; k++) g[k] = Math.pow(fall, k - 1);
    for (let n = 0; n < N; n++) {
      const E = 1 + slope * n / wrap0, Ef = Etot / E, m = N - n;
      let s = env[n], w = 1;
      for (let k = 1; k <= depth; k++) {
        let outP, inP;
        if (lin) {
          const off = wrap0 * k; outP = n + off; inP = n - off;
        } else {
          outP = O0s * (E * ek[k] - 1); inP = O0s * (E / ek[k] - 1);
        }
        s += 0.5 * g[k] * (sampleAt(env, outP, loop) + sampleAt(env, inP, loop));
        w += g[k];
        if (fold > 0) {
          let foP, fiP;
          if (lin) {
            const off = wrap0 * k; foP = m + off; fiP = m - off;
          } else {
            foP = O0s * (Ef * ek[k] - 1); fiP = O0s * (Ef / ek[k] - 1);
          }
          s += 0.5 * fold * g[k] * (sampleAt(env, foP, loop) + sampleAt(env, fiP, loop));
          w += fold * g[k];
        }
      }
      map[n] = s / w;
    }
    return normalizeMap(boxBlur1(map, Math.max(1, (sr * 0.006) | 0), 1), 0.65);
  }

  function buildVideoWearMap(frames, vW, vH, vN, depth, fall, wrap0, growF, fold, wearAmount, loop = 0) {
    if (wearAmount <= 0 || !frames || vN < 1) return null;
    const occ = new Float32Array(vN), step = 16;
    for (let n = 0; n < vN; n++) {
      const f = frames[n], prev = n ? frames[n - 1] : null;
      let lum = 0, motion = 0, count = 0;
      for (let p = 0; p < f.length; p += step) {
        const y = (0.2126 * f[p] + 0.7152 * f[p + 1] + 0.0722 * f[p + 2]) / 255;
        lum += y;
        if (prev) motion += Math.abs(y - (0.2126 * prev[p] + 0.7152 * prev[p + 1] + 0.0722 * prev[p + 2]) / 255);
        count++;
      }
      occ[n] = 0.78 * (lum / count) + 0.22 * (motion / count) * 3;
    }
    const env = boxBlur1(occ, 1, 2);
    const slope = growF / Math.max(1, vN), lin = slope < 1e-9, O0s = lin ? 0 : wrap0 / slope;
    const ek = new Float64Array(depth + 1), g = new Float32Array(depth + 1);
    for (let k = 1; k <= depth; k++) {
      ek[k] = Math.exp(slope * k);
      g[k] = Math.pow(fall, k - 1);
    }
    const Etot = 1 + slope * vN / wrap0, map = new Float32Array(vN);
    for (let n = 0; n < vN; n++) {
      const E = 1 + slope * n / wrap0, Ef = Etot / E, m = vN - n;
      let s = env[n], w = 1;
      for (let k = 1; k <= depth; k++) {
        let outP, inP;
        if (lin) {
          const off = wrap0 * k; outP = n + off; inP = n - off;
        } else {
          outP = O0s * (E * ek[k] - 1); inP = O0s * (E / ek[k] - 1);
        }
        s += 0.5 * g[k] * (sampleAt(env, outP, loop) + sampleAt(env, inP, loop));
        w += g[k];
        if (fold > 0) {
          let foP, fiP;
          if (lin) {
            const off = wrap0 * k; foP = m + off; fiP = m - off;
          } else {
            foP = O0s * (Ef * ek[k] - 1); fiP = O0s * (Ef / ek[k] - 1);
          }
          s += 0.5 * fold * g[k] * (sampleAt(env, foP, loop) + sampleAt(env, fiP, loop));
          w += fold * g[k];
        }
      }
      map[n] = s / w;
    }
    return normalizeMap(boxBlur1(map, 1, 1), 0.72);
  }

  function buildFlowMap(N, rate, amount, wearMap, kind, wearFactor = 1.0, loop = 0) {
    if (amount <= 0 || N < 2) return null;
    const map = new Float32Array(N);
    const audio = kind === "audio";
    const slowAmp = audio ? rate * (0.002 + 0.010 * amount) * amount : (0.18 + 1.8 * amount) * amount;
    const fastAmp = audio ? rate * 0.0007 * amount : 0.16 * amount;
    for (let n = 0; n < N; n++) {
      const t = n / rate, wear = wearMap ? sampleAt(wearMap, n, loop) * wearFactor : 0, swell = 1 + 0.8 * wear;
      const slow = 0.58 * Math.sin(2 * Math.PI * 0.19 * t + 0.9 * Math.sin(2 * Math.PI * 0.031 * t))
        + 0.30 * Math.sin(2 * Math.PI * 0.071 * t + 1.7)
        + 0.12 * Math.sin(2 * Math.PI * 0.43 * t + 0.6 * Math.sin(2 * Math.PI * 0.047 * t));
      const flutter = Math.sin(2 * Math.PI * 6.2 * t + 0.55 * Math.sin(2 * Math.PI * 0.37 * t))
        + 0.45 * Math.sin(2 * Math.PI * 11.7 * t + 1.9);
      map[n] = swell * (slowAmp * slow + fastAmp * flutter);
    }
    return boxBlur1(map, audio ? Math.max(1, (rate * 0.001) | 0) : 1, 1);
  }

  /**
   * Authoritative audio processing entry point
   */
  async function renderAudio(source, sampleRate, userParams = {}, onProgress = null) {
    const channels = toChannels(source);
    const ch = channels.length;
    const N = channels[0].length;
    const sr = sampleRate || 44100;
    const P = validateParams(userParams);

    const wrap0 = P.wrap * sr, growS = P.grow * sr, depth = P.wraps;
    const fall = P.fall, tilt = P.tilt, print = P.print, dry = P.dry;
    const a = (1 - P.wind) / 2, b = (1 + P.wind) / 2, fold = P.fold;
    const loop = P.loop;
    const alpha = 1 - Math.exp(-2 * Math.PI * tilt / sr);

    const slope = growS / Math.max(1, N), lin = slope < 1e-9, O0s = lin ? 0 : wrap0 / slope;
    const ek = new Float64Array(depth + 1);
    for (let k = 1; k <= depth; k++) ek[k] = Math.exp(slope * k);
    const Etot = 1 + slope * N / wrap0;

    const wearMap = buildAudioWearMap(channels, sr, N, depth, fall, wrap0, growS, fold, slope, lin, O0s, ek, Etot, P.wear, loop);
    const flowMap = buildFlowMap(N, sr, P.flow, wearMap, "audio", P.wear, loop);

    const outChannels = new Array(ch);
    const g = new Float32Array(depth + 1);
    for (let k = 1; k <= depth; k++) g[k] = Math.pow(fall, k - 1);

    for (let c = 0; c < ch; c++) {
      const x = channels[c];
      const y = new Float32Array(N);
      const wet = new Float32Array(N);

      for (let n = 0; n < N; n++) {
        const E = 1 + slope * n / wrap0, Ef = Etot / E;
        let s = 0;
        for (let k = 1; k <= depth; k++) {
          let outP, inP;
          if (lin) {
            const off = wrap0 * k; outP = n + off; inP = n - off;
          } else {
            outP = O0s * (E * ek[k] - 1); inP = O0s * (E / ek[k] - 1);
          }
          let tap = a * flowSample(x, outP, flowMap, loop) + b * flowSample(x, inP, flowMap, loop);
          if (fold > 0) {
            let foP, fiP; const m = N - n;
            if (lin) {
              const off = wrap0 * k; foP = m + off; fiP = m - off;
            } else {
              foP = O0s * (Ef * ek[k] - 1); fiP = O0s * (Ef / ek[k] - 1);
            }
            tap += fold * (a * flowSample(x, foP, flowMap, loop) + b * flowSample(x, fiP, flowMap, loop));
          }
          s += g[k] * tap;
        }
        wet[n] = s;

        if (onProgress && (n & 0x3FFFF) === 0) {
          onProgress((c * N + n) / (ch * N));
          await new Promise(r => setTimeout(r, 0));
        }
      }

      let lp = 0;
      for (let n = 0; n < N; n++) {
        lp += alpha * (wet[n] - lp);
        wet[n] = lp;
      }

      const eraseAlpha = 1 - Math.exp(-2 * Math.PI * (900 + (1 - P.wear) * 7200) / sr);
      let selfLp = 0, lossLp = 0;
      for (let n = 0; n < N; n++) {
        const wear = wearMap ? wearMap[n] * P.wear : 0;
        const dryRead = flowSample(x, n, flowMap, loop);
        selfLp += eraseAlpha * (dryRead - selfLp);
        const erase = Math.min(0.9, wear * 0.85), dull = dryRead * (1 - erase) + selfLp * erase;
        const targetLoss = P.wear * shedLoss(n, wearMap ? wearMap[n] : 0);
        lossLp += 0.025 * (targetLoss - lossLp);
        const track = P.track * (0.22 + 0.78 * wear), t = n / sr;
        const seam = Math.max(0, Math.sin(2 * Math.PI * 29.97 * t + 0.9 * Math.sin(2 * Math.PI * 0.11 * t)) - (1.04 - 0.72 * track));
        const whoosh = track * seam * (0.018 * Math.sin(2 * Math.PI * (860 + 210 * Math.sin(2 * Math.PI * 0.07 * t)) * t)
          + 0.010 * Math.sin(2 * Math.PI * 1720 * t + 0.8 * Math.sin(2 * Math.PI * 0.33 * t)));
        const duck = Math.min(0.55, track * seam * 0.38);
        let v = dry * dull * Math.max(0, 1 - lossLp - duck) + print * wet[n] * (1 + 0.65 * wear) + whoosh;
        y[n] = (v > 1.2 || v < -1.2) ? Math.tanh(v) : v;
      }

      outChannels[c] = y;
    }

    if (onProgress) onProgress(1.0);

    return {
      channels: outChannels,
      sampleRate: sr,
      length: N,
      duration: N / sr,
      wearMap,
      flowMap,
      params: P
    };
  }

  /**
   * Authoritative video processing entry point
   *
   * @param {Array<Uint8ClampedArray|Uint8Array>} frames RGBA byte arrays
   * @param {number} width frame width in pixels
   * @param {number} height frame height in pixels
   * @param {number} fps frame rate
   * @param {object} userParams
   * @param {Function} onProgress
   */
  async function renderVideo(frames, width, height, fps = 15, userParams = {}, onProgress = null) {
    if (!frames || !frames.length) throw new TypeError("Remanence: video frames must not be empty");
    const vN = frames.length;
    const vW = width, vH = height, vFps = fps;
    const P = validateParams(userParams);

    const depth = P.wraps, fall = P.fall, print = P.print, dry = P.dry;
    const a = (1 - P.wind) / 2, b = (1 + P.wind) / 2;
    const wrap0 = P.wrap * vFps, growF = P.grow * vFps, fold = P.fold;
    const loop = P.loop;

    const g = new Float32Array(depth + 1);
    for (let k = 1; k <= depth; k++) g[k] = Math.pow(fall, k - 1);

    const blurR = Math.round((1 - (P.tilt - 200) / 19800) * 5);
    const px = vW * vH * 4, gpx = vW * vH * 3;

    const slope = growF / Math.max(1, vN), lin = slope < 1e-9, O0s = lin ? 0 : wrap0 / slope;
    const ek = new Float64Array(depth + 1);
    for (let k = 1; k <= depth; k++) ek[k] = Math.exp(slope * k);
    const Etot = 1 + slope * vN / wrap0;

    const wearMap = buildVideoWearMap(frames, vW, vH, vN, depth, fall, wrap0, growF, fold, P.wear, loop);
    const flowMap = buildFlowMap(vN, vFps, P.flow, wearMap, "video", P.wear, loop);

    const vOut = new Array(vN);

    const frameAt = n => {
      n = Math.round(n + (flowMap ? sampleAt(flowMap, n, loop) : 0));
      if (n >= 0 && n < vN) return frames[n];
      if (loop > 0) return frames[((n % vN) + vN) % vN];
      return null;
    };

    for (let n = 0; n < vN; n++) {
      const src = frameAt(n) || frames[n];
      const o = new Uint8ClampedArray(px);
      const gh = new Float32Array(gpx);
      const wearFrame = wearMap ? wearMap[n] * P.wear : 0;
      const E = 1 + slope * n / wrap0, Ef = Etot / E, m = vN - n;

      for (let k = 1; k <= depth; k++) {
        const gk = g[k];
        let outP, inP;
        if (lin) {
          const off = wrap0 * k; outP = n + off; inP = n - off;
        } else {
          outP = O0s * (E * ek[k] - 1); inP = O0s * (E / ek[k] - 1);
        }
        const fp = frameAt(outP), fq = frameAt(inP);
        let ff = null, fg = null;
        if (fold > 0) {
          let foP, fiP;
          if (lin) {
            const off = wrap0 * k; foP = m + off; fiP = m - off;
          } else {
            foP = O0s * (Ef * ek[k] - 1); fiP = O0s * (Ef / ek[k] - 1);
          }
          ff = frameAt(foP); fg = frameAt(fiP);
        }
        if (!fp && !fq && !ff && !fg) continue;
        for (let q = 0, pp = 0; q < gpx; q += 3, pp += 4) {
          let c0 = a * (fp ? fp[pp] : 0) + b * (fq ? fq[pp] : 0);
          let c1 = a * (fp ? fp[pp + 1] : 0) + b * (fq ? fq[pp + 1] : 0);
          let c2 = a * (fp ? fp[pp + 2] : 0) + b * (fq ? fq[pp + 2] : 0);
          if (fold > 0) {
            c0 += fold * (a * (ff ? ff[pp] : 0) + b * (fg ? fg[pp] : 0));
            c1 += fold * (a * (ff ? ff[pp + 1] : 0) + b * (fg ? fg[pp + 1] : 0));
            c2 += fold * (a * (ff ? ff[pp + 2] : 0) + b * (fg ? fg[pp + 2] : 0));
          }
          gh[q] += gk * c0;
          gh[q + 1] += gk * c1;
          gh[q + 2] += gk * c2;
        }
      }

      boxBlur3(gh, vW, vH, blurR);

      let dryBlur = null;
      if (wearFrame > 0.001) {
        dryBlur = new Float32Array(gpx);
        for (let q = 0, pp = 0; q < gpx; q += 3, pp += 4) {
          dryBlur[q] = src[pp];
          dryBlur[q + 1] = src[pp + 1];
          dryBlur[q + 2] = src[pp + 2];
        }
        boxBlur3(dryBlur, vW, vH, Math.max(1, Math.min(5, blurR + 1)));
      }

      const ghostBoost = 1 + 0.55 * wearFrame;
      const trackFrame = P.track * (0.25 + 0.75 * wearFrame);

      if (wearFrame <= 0.001 && trackFrame <= 0.001) {
        // fast path: clean reel
        for (let q = 0, pp = 0; q < gpx; q += 3, pp += 4) {
          let v0 = dry * src[pp] + print * gh[q];
          let v1 = dry * src[pp + 1] + print * gh[q + 1];
          let v2 = dry * src[pp + 2] + print * gh[q + 2];
          o[pp] = v0 > 255 ? 255 : (v0 < 0 ? 0 : v0);
          o[pp + 1] = v1 > 255 ? 255 : (v1 < 0 ? 0 : v1);
          o[pp + 2] = v2 > 255 ? 255 : (v2 < 0 ? 0 : v2);
          o[pp + 3] = 255;
        }
      } else {
        const seamY = vH * (0.84 + 0.055 * Math.sin(n * 0.31 + Math.sin(n * 0.047) * 2.1));
        const stripePh = n * 1.7;
        for (let yy = 0, pp = 0; yy < vH; yy++) {
          const seam = trackFrame ? Math.exp(-Math.abs(yy - seamY) / (1.6 + trackFrame * 13)) : 0;
          const drift = trackFrame * (Math.sin(yy * 0.073 + n * 0.41) * 3 + Math.sin(yy * 0.017 + n * 0.13) * 8) + seam * trackFrame * 44;
          const head = Math.min(0.85, seam * trackFrame * 1.35);
          for (let xx = 0; xx < vW; xx++, pp += 4) {
            const sx = Math.max(0, Math.min(vW - 1, Math.round(xx + drift)));
            const sp = (yy * vW + sx) * 4, sq = (yy * vW + sx) * 3;
            const lum = (src[sp] + src[sp + 1] + src[sp + 2]) / 765;
            const local = wearFrame * (0.35 + 0.65 * lum);
            const erode = Math.min(0.85, local * 0.78);
            let r = src[sp], gr = src[sp + 1], bl = src[sp + 2];
            if (dryBlur) {
              r = r * (1 - erode) + dryBlur[sq] * erode;
              gr = gr * (1 - erode) + dryBlur[sq + 1] * erode;
              bl = bl * (1 - erode) + dryBlur[sq + 2] * erode;
            }
            const gray = (r + gr + bl) / 3, bleach = erode * 0.45;
            r = r * (1 - bleach) + gray * bleach;
            gr = gr * (1 - bleach) + gray * bleach;
            bl = bl * (1 - bleach) + gray * bleach;
            let loss = 0;
            if (local > 0.001) {
              const stripe = 0.5 + 0.5 * Math.sin((yy + stripePh) * 0.65 + Math.sin(xx * 0.061 + n * 0.19));
              const oxide = Math.max(0, stripe + local * 1.4 - 1.18);
              loss = Math.min(0.9, local * (0.12 + 0.28 * lum) + oxide * 0.62);
            }
            let v0 = dry * r * (1 - loss) + print * gh[sq] * ghostBoost;
            let v1 = dry * gr * (1 - loss) + print * gh[sq + 1] * ghostBoost;
            let v2 = dry * bl * (1 - loss) + print * gh[sq + 2] * ghostBoost;
            if (head > 0) {
              v0 = v0 * (1 - head * 0.34) + head * 26;
              v1 = v1 * (1 - head * 0.48) + head * 8;
              v2 = v2 * (1 - head * 0.18) + head * 40;
            }
            o[pp] = v0 > 255 ? 255 : (v0 < 0 ? 0 : v0);
            o[pp + 1] = v1 > 255 ? 255 : (v1 < 0 ? 0 : v1);
            o[pp + 2] = v2 > 255 ? 255 : (v2 < 0 ? 0 : v2);
            o[pp + 3] = 255;
          }
        }
      }

      vOut[n] = o;

      if (onProgress && (n & 3) === 0) {
        onProgress((n + 1) / vN);
        await new Promise(r => setTimeout(r, 0));
      }
    }

    if (onProgress) onProgress(1.0);

    return {
      frames: vOut,
      width: vW,
      height: vH,
      fps: vFps,
      duration: vN / vFps,
      wearMap,
      flowMap,
      params: P
    };
  }

  function encodeWav(source, sampleRate) {
    let channels, sr, N, ch;
    if (source && typeof source.numberOfChannels === "number" && typeof source.getChannelData === "function") {
      ch = source.numberOfChannels;
      sr = source.sampleRate;
      N = source.length;
      channels = Array.from({ length: ch }, (_, i) => source.getChannelData(i));
    } else if (Array.isArray(source)) {
      channels = source;
      ch = channels.length;
      sr = sampleRate || 44100;
      N = channels[0].length;
    } else if (source instanceof Float32Array) {
      channels = [source];
      ch = 1;
      sr = sampleRate || 44100;
      N = source.length;
    } else {
      throw new TypeError("Remanence: invalid audio source for encodeWav");
    }

    const ab = new ArrayBuffer(44 + N * ch * 2);
    const data = new DataView(ab);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); data.setUint32(4, 36 + N * ch * 2, true);
    w(8, "WAVE"); w(12, "fmt "); data.setUint32(16, 16, true);
    data.setUint16(20, 1, true); data.setUint16(22, ch, true);
    data.setUint32(24, sr, true); data.setUint32(28, sr * ch * 2, true);
    data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
    w(36, "data"); data.setUint32(40, N * ch * 2, true);
    let o = 44;
    for (let n = 0; n < N; n++) {
      for (let c = 0; c < ch; c++) {
        let s = Math.max(-1, Math.min(1, channels[c][n]));
        data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        o += 2;
      }
    }
    return ab;
  }

  const RemanenceDSP = Object.freeze({
    defaultParams,
    validateParams,
    PRESETS,
    toChannels,
    renderAudio,
    render: renderAudio,
    renderVideo,
    buildAudioWearMap,
    buildVideoWearMap,
    buildFlowMap,
    boxBlur1,
    boxBlur3,
    normalizeMap,
    sampleAt,
    flowSample,
    shedLoss,
    encodeWav
  });

  return RemanenceDSP;
});
