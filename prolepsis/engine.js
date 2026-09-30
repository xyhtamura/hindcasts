/**
 * prolepsis/engine.js - Pure feedback-field & video anticipation processing for Prolepsis
 *
 * Implements acausal video feedback field with three temporal stances:
 * - wake: causal forward feedback trail
 * - anticipation: reversed backward feedback (precursor swarm)
 * - symmetric: bi-directional zero-phase blending (wake + anticipation)
 *
 * Includes transient-aware lookahead scaling, whole-clip exposure normalization,
 * Sobel edge and light persistence inscription mask, affine feedback advection
 * (zoom, rotation, flow X/Y, oscillation), strobe gating, hue drift, and chroma split.
 */

(function (root, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory();
  } else if (typeof define === "function" && define.amd) {
    define([], factory);
  } else {
    root.ProlepsisDSP = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const defaultParams = Object.freeze({
    mode: "symmetric",        // 'wake' | 'anticipation' | 'symmetric'
    balance: 0.5,             // 0 = anticipation, 1 = wake
    transientAware: false,    // scale precursor deposit by upcoming frame change
    exposureNorm: false,      // normalize brightness toward whole-clip mean

    memoryDecay: 0.985,       // feedback retention (0.85 .. 0.999)
    deposit: 0.06,            // new frame opacity (0.005 .. 0.6)
    flowX: 0,                 // flow drift X (-8 .. 8)
    flowY: -1.2,              // flow drift Y (-8 .. 8)
    zoom: 1.002,              // feedback zoom (0.96 .. 1.04)
    rotation: 0,              // feedback rotation °/frame (-2 .. 2)
    oscillate: 0,             // flow oscillation depth (0 .. 12)
    oscRate: 1,               // flow oscillation rate (0.1 .. 5)
    strobe: 0,                // strobe gate depth (0 .. 1)
    strobeSpeed: 2,           // strobe rate (0.5 .. 10)
    hueShift: 0,              // hue drift °/frame (-5 .. 5)
    chromaSplit: 6.5,         // chromatic aberration split (0 .. 28)
    edgeInscription: 0.95,    // edge inscription sensitivity (0 .. 2)
    lightPersistence: 0.65,   // light persistence sensitivity (0 .. 2)
    blur: 1.4                 // softening blur px (0 .. 8)
  });

  const PRESETS = Object.freeze({
    preverb:    Object.freeze({ mode: "symmetric",    balance: 0.42, memoryDecay: 0.99,  deposit: 0.04,  flowX: 0,   flowY: 0,    zoom: 1.004, rotation: 0,    oscillate: 0,   oscRate: 1,    strobe: 0,    strobeSpeed: 2,   hueShift: 0,    chromaSplit: 8,   edgeInscription: 0.6,  lightPersistence: 1.1,  blur: 2.2 }),
    precursor:  Object.freeze({ mode: "anticipation", balance: 0,    memoryDecay: 0.986, deposit: 0.05,  flowX: 0,   flowY: -2.4, zoom: 1.001, rotation: 0,    oscillate: 0,   oscRate: 1,    strobe: 0,    strobeSpeed: 2,   hueShift: 0,    chromaSplit: 10,  edgeInscription: 1.1,  lightPersistence: 0.8,  blur: 1.2 }),
    foreshadow: Object.freeze({ mode: "anticipation", balance: 0,    memoryDecay: 0.993, deposit: 0.028, flowX: 0,   flowY: 0,    zoom: 0.994, rotation: 0.18, oscillate: 1.6, oscRate: 0.5,  strobe: 0,    strobeSpeed: 2,   hueShift: 1.2,  chromaSplit: 14,  edgeInscription: 0.5,  lightPersistence: 1.4,  blur: 2.6 }),
    oilFlow:    Object.freeze({ mode: "wake",         balance: 1,    memoryDecay: 0.985, deposit: 0.06,  flowX: 0,   flowY: -1.2, zoom: 1.002, rotation: 0,    oscillate: 0,   oscRate: 1,    strobe: 0,    strobeSpeed: 2,   hueShift: 0,    chromaSplit: 6.5, edgeInscription: 0.95, lightPersistence: 0.65, blur: 1.4 }),
    ghostPush:  Object.freeze({ mode: "wake",         balance: 1,    memoryDecay: 0.995, deposit: 0.03,  flowX: 3.5, flowY: 0,    zoom: 1.000, rotation: 0,    oscillate: 0,   oscRate: 1,    strobe: 0,    strobeSpeed: 2,   hueShift: 0,    chromaSplit: 12,  edgeInscription: 0.5,  lightPersistence: 1.2,  blur: 3.5 }),
    inkBleed:   Object.freeze({ mode: "wake",         balance: 1,    memoryDecay: 0.96,  deposit: 0.15,  flowX: 0,   flowY: 2.5,  zoom: 0.995, rotation: 0,    oscillate: 0,   oscRate: 1,    strobe: 0,    strobeSpeed: 2,   hueShift: 0,    chromaSplit: 0,   edgeInscription: 1.8,  lightPersistence: 0.3,  blur: 0.5 }),
    vortex:     Object.freeze({ mode: "wake",         balance: 1,    memoryDecay: 0.99,  deposit: 0.04,  flowX: 0,   flowY: 0,    zoom: 1.015, rotation: 0,    oscillate: 0,   oscRate: 1,    strobe: 0,    strobeSpeed: 2,   hueShift: 0,    chromaSplit: 4,   edgeInscription: 1.2,  lightPersistence: 0.8,  blur: 1.0 }),
    aurora:     Object.freeze({ mode: "symmetric",    balance: 0.55, memoryDecay: 0.994, deposit: 0.022, flowX: 0.3, flowY: -0.4, zoom: 1.001, rotation: 0,    oscillate: 2.5, oscRate: 0.35, strobe: 0,    strobeSpeed: 2,   hueShift: 1.4,  chromaSplit: 9,   edgeInscription: 0.35, lightPersistence: 1.8,  blur: 2.8 }),
    prismatic:  Object.freeze({ mode: "symmetric",    balance: 0.5,  memoryDecay: 0.993, deposit: 0.032, flowX: 0,   flowY: -0.8, zoom: 1.001, rotation: 0.14, oscillate: 1.8, oscRate: 0.85, strobe: 0,    strobeSpeed: 2,   hueShift: 2.8,  chromaSplit: 24,  edgeInscription: 0.65, lightPersistence: 1.2,  blur: 1.6 }),
    spiral:     Object.freeze({ mode: "wake",         balance: 1,    memoryDecay: 0.991, deposit: 0.042, flowX: 0,   flowY: 0,    zoom: 1.003, rotation: 0.38, oscillate: 0,   oscRate: 1,    strobe: 0,    strobeSpeed: 2,   hueShift: 0.25, chromaSplit: 5,   edgeInscription: 1.0,  lightPersistence: 0.75, blur: 1.2 }),
    tapeWow:    Object.freeze({ mode: "wake",         balance: 1,    memoryDecay: 0.988, deposit: 0.052, flowX: 1.8, flowY: -0.6, zoom: 1.001, rotation: 0,    oscillate: 5.8, oscRate: 1.7,  strobe: 0,    strobeSpeed: 2,   hueShift: 0,    chromaSplit: 7,   edgeInscription: 0.85, lightPersistence: 0.7,  blur: 1.5 }),
    strobeEcho: Object.freeze({ mode: "symmetric",    balance: 0.5,  memoryDecay: 0.978, deposit: 0.09,  flowX: 1.8, flowY: -0.8, zoom: 1.000, rotation: 0,    oscillate: 0,   oscRate: 1,    strobe: 0.74, strobeSpeed: 3.8, hueShift: 0,    chromaSplit: 16,  edgeInscription: 1.15, lightPersistence: 0.85, blur: 0.7 }),
    fogField:   Object.freeze({ mode: "symmetric",    balance: 0.5,  memoryDecay: 0.997, deposit: 0.01,  flowX: 0,   flowY: 0,    zoom: 1.000, rotation: 0,    oscillate: 3.5, oscRate: 0.28, strobe: 0,    strobeSpeed: 2,   hueShift: 0,    chromaSplit: 2,   edgeInscription: 0.25, lightPersistence: 2.0,  blur: 6.0 })
  });

  function validateParams(raw = {}) {
    const p = { ...defaultParams, ...raw };
    // Zero is a valid control value. Use the default only for missing/invalid input.
    const finite = key => {
      const value = p[key];
      if (value === null || value === undefined || value === "") return defaultParams[key];
      const n = Number(value);
      return Number.isFinite(n) ? n : defaultParams[key];
    };
    const validModes = ["wake", "anticipation", "symmetric"];
    return {
      mode: validModes.includes(p.mode) ? p.mode : "symmetric",
      balance: clamp(finite("balance"), 0, 1),
      transientAware: Boolean(p.transientAware),
      exposureNorm: Boolean(p.exposureNorm),
      memoryDecay: clamp(finite("memoryDecay"), 0.85, 0.999),
      deposit: clamp(finite("deposit"), 0.005, 0.6),
      flowX: clamp(finite("flowX"), -8, 8),
      flowY: clamp(finite("flowY"), -8, 8),
      zoom: clamp(finite("zoom"), 0.96, 1.04),
      rotation: clamp(finite("rotation"), -2, 2),
      oscillate: clamp(finite("oscillate"), 0, 12),
      oscRate: clamp(finite("oscRate"), 0.1, 5),
      strobe: clamp(finite("strobe"), 0, 1),
      strobeSpeed: clamp(finite("strobeSpeed"), 0.5, 10),
      hueShift: clamp(finite("hueShift"), -5, 5),
      chromaSplit: clamp(finite("chromaSplit"), 0, 28),
      edgeInscription: clamp(finite("edgeInscription"), 0, 2),
      lightPersistence: clamp(finite("lightPersistence"), 0, 2),
      blur: clamp(finite("blur"), 0, 8)
    };
  }

  /**
   * Pure algorithm for Sobel edge detection & luminance persistence inscription mask
   */
  function buildMaskData(frameData, width, height, params, outData = null) {
    const w = width, h = height;
    const data = frameData instanceof Uint8ClampedArray || frameData instanceof Uint8Array ? frameData : frameData.data;
    const out = outData || new Uint8ClampedArray(w * h * 4);
    const gray = new Float32Array(w * h);

    const deposit = params.deposit;
    const edgeInscription = params.edgeInscription;
    const lightPersistence = params.lightPersistence;

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      gray[p] = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
    }

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x, p = i * 4;
        const gx = -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1] + gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
        const gy = -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
        const edge = clamp(Math.hypot(gx, gy) / 760, 0, 1);
        const lum = gray[i] / 255;
        const light = Math.pow(lum, 3.1);
        const alpha = clamp(deposit + edge * edgeInscription * 0.4 + light * lightPersistence * 0.35, 0, 1);
        out[p] = 255;
        out[p + 1] = 255;
        out[p + 2] = 255;
        out[p + 3] = Math.round(alpha * 255);
      }
    }
    return out;
  }

  function computeTransientsFromData(pixelBuffers, width, height) {
    const N = pixelBuffers.length;
    const curve = new Float32Array(N);
    let prev = null;
    const stepN = 4 * 13;

    for (let i = 0; i < N; i++) {
      const d = pixelBuffers[i] instanceof Uint8ClampedArray || pixelBuffers[i] instanceof Uint8Array
        ? pixelBuffers[i]
        : pixelBuffers[i].data;
      if (!prev) {
        curve[i] = 0;
        prev = d.slice(0);
        continue;
      }
      let acc = 0;
      for (let p = 0; p < d.length; p += stepN) {
        acc += Math.abs(d[p] - prev[p]) + Math.abs(d[p + 1] - prev[p + 1]) + Math.abs(d[p + 2] - prev[p + 2]);
      }
      curve[i] = acc;
      prev = d.slice(0);
    }

    let mx = 0;
    for (let i = 0; i < N; i++) mx = Math.max(mx, curve[i]);
    if (mx > 0) {
      for (let i = 0; i < N; i++) curve[i] /= mx;
    }
    return curve;
  }

  function meanLumaFromData(pixelBuffer) {
    const d = pixelBuffer instanceof Uint8ClampedArray || pixelBuffer instanceof Uint8Array
      ? pixelBuffer
      : pixelBuffer.data;
    let s = 0, n = 0;
    for (let p = 0; p < d.length; p += 4 * 20) {
      s += d[p] * 0.2126 + d[p + 1] * 0.7152 + d[p + 2] * 0.0722;
      n++;
    }
    return s / Math.max(1, n);
  }

  function defaultCanvasFactory(w, h) {
    if (typeof OffscreenCanvas !== "undefined") {
      return new OffscreenCanvas(w, h);
    }
    if (typeof document !== "undefined" && typeof document.createElement === "function") {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      return c;
    }
    throw new Error("Prolepsis: No canvas implementation available in environment");
  }

  function createCanvases(width, height, factory = defaultCanvasFactory) {
    const names = ["work", "current", "memory", "temp", "mask", "compose", "bake"];
    const obj = {};
    for (const name of names) {
      const c = factory(width, height);
      c.width = width;
      c.height = height;
      obj[name] = c;
      const ctxOptions = (name === "work" || name === "current" || name === "mask")
        ? { willReadFrequently: true }
        : { alpha: false };
      obj[name + "Ctx"] = c.getContext("2d", ctxOptions);
    }
    return obj;
  }

  /**
   * Execute single feedback step into `memory` canvas
   */
  function feedbackStep(srcBitmap, t, geomSign, hueRef, depositScale, canvases, width, height, params) {
    const w = width, h = height;
    const { work, workCtx, current, curCtx, memory, memCtx, temp, tmpCtx, mask, maskCtx } = canvases;
    const P = params;

    const decay = P.memoryDecay;
    const blur = P.blur;
    let zoom = P.zoom;
    let rotation = P.rotation;
    const hueShift = P.hueShift;
    const oscillate = P.oscillate;
    const oscRate = P.oscRate;
    const strobe = P.strobe;
    const strobeSpeed = P.strobeSpeed;

    let flowX = P.flowX;
    let flowY = P.flowY;
    if (oscillate > 0) {
      const osc = t * oscRate;
      flowX += Math.sin(osc) * oscillate;
      flowY += Math.cos(osc * 0.73) * oscillate * 0.6;
    }
    if (geomSign < 0) {
      flowX = -flowX; flowY = -flowY; rotation = -rotation; zoom = 1 / zoom;
    }

    let effectiveDecay = decay;
    if (strobe > 0) {
      const gPhase = (t * strobeSpeed * 2) % (2 * Math.PI);
      const gate = Math.pow(Math.max(0, Math.sin(gPhase)), 10);
      const hiDecay = Math.min(0.999, decay + (0.999 - decay) * strobe);
      const loDecay = Math.max(0.05, decay * (1 - strobe * 0.8));
      effectiveDecay = loDecay + (hiDecay - loDecay) * gate;
    }

    if (Math.abs(hueShift) > 0.01) hueRef.angle = (hueRef.angle + hueShift) % 360;

    const filters = [];
    if (blur > 0) filters.push(`blur(${blur}px)`);
    if (Math.abs(hueShift) > 0.01) filters.push(`hue-rotate(${hueRef.angle}deg)`);
    const filterStr = filters.join(" ");

    // 1) decayed + transformed copy of memory -> temp
    tmpCtx.clearRect(0, 0, w, h);
    tmpCtx.save();
    tmpCtx.globalAlpha = effectiveDecay;
    if (filterStr) tmpCtx.filter = filterStr;
    tmpCtx.translate(w / 2 + flowX, h / 2 + flowY);
    if (rotation !== 0) tmpCtx.rotate(rotation * Math.PI / 180);
    tmpCtx.scale(zoom, zoom);
    tmpCtx.translate(-w / 2, -h / 2);
    tmpCtx.drawImage(memory, 0, 0);
    tmpCtx.restore();

    // 2) inscribe the masked current frame into memory
    workCtx.clearRect(0, 0, w, h);
    workCtx.drawImage(srcBitmap, 0, 0, w, h);
    const fdata = workCtx.getImageData(0, 0, w, h);

    const mImg = maskCtx.createImageData(w, h);
    buildMaskData(fdata, w, h, P, mImg.data);
    maskCtx.putImageData(mImg, 0, 0);

    curCtx.clearRect(0, 0, w, h);
    curCtx.drawImage(work, 0, 0);

    memCtx.save();
    memCtx.clearRect(0, 0, w, h);
    if (depositScale !== 1) memCtx.globalAlpha = clamp(depositScale, 0, 1);
    memCtx.drawImage(current, 0, 0);
    memCtx.globalAlpha = 1;
    memCtx.globalCompositeOperation = "destination-in";
    memCtx.drawImage(mask, 0, 0);
    memCtx.restore();

    // 3) lay decayed history on top
    tmpCtx.save();
    tmpCtx.globalCompositeOperation = "source-over";
    tmpCtx.drawImage(memory, 0, 0);
    tmpCtx.restore();

    // 4) result -> memory
    memCtx.save();
    memCtx.globalCompositeOperation = "copy";
    memCtx.drawImage(temp, 0, 0);
    memCtx.restore();
  }

  async function snapshot(canvas) {
    if (typeof createImageBitmap === "function") {
      return createImageBitmap(canvas);
    }
    // Fallback if createImageBitmap is unavailable: return canvas copy
    return canvas;
  }

  async function bakeFinal(sourceCanvasOrBitmap, frameT, chromaSplit, width, height, bakeCtx, bakeCanvas) {
    const w = width, h = height;
    const c = chromaSplit;
    bakeCtx.save();
    bakeCtx.clearRect(0, 0, w, h);
    bakeCtx.filter = "contrast(115%) saturate(110%) brightness(105%)";
    bakeCtx.drawImage(sourceCanvasOrBitmap, 0, 0);
    bakeCtx.restore();

    if (c > 0.01) {
      bakeCtx.save();
      bakeCtx.globalAlpha = clamp(0.08 + c * 0.01, 0.05, 0.3);
      bakeCtx.globalCompositeOperation = "screen";
      bakeCtx.filter = `blur(${0.5 + c * 0.1}px)`;
      bakeCtx.drawImage(sourceCanvasOrBitmap, c, Math.sin(frameT) * c * 0.2);
      bakeCtx.globalCompositeOperation = "multiply";
      bakeCtx.drawImage(sourceCanvasOrBitmap, -c, Math.cos(frameT * 0.8) * c * 0.15);
      bakeCtx.restore();
    }
    return snapshot(bakeCanvas);
  }

  /**
   * Authoritative full rendering entry point for Prolepsis
   *
   * @param {Array} srcFrames array of ImageBitmap / HTMLCanvasElement / OffscreenCanvas
   * @param {number} width frame width
   * @param {number} height frame height
   * @param {object} userParams feedback & temporal stance parameters
   * @param {object} options { onProgress, isCancelled, canvases, canvasFactory }
   */
  async function render(srcFrames, width, height, userParams = {}, options = {}) {
    if (!srcFrames || !srcFrames.length) throw new TypeError("Prolepsis: srcFrames must not be empty");
    const N = srcFrames.length;
    const w = width, h = height;
    const P = validateParams(userParams);
    const { onProgress, isCancelled, canvasFactory } = options;

    const canvases = options.canvases || createCanvases(w, h, canvasFactory);
    const { workCtx, memCtx, compose, cmpCtx, bake, bakeCtx } = canvases;

    // 1. Transient-aware pre-pass
    let transients = null;
    if (P.transientAware && P.mode !== "wake") {
      if (onProgress) onProgress(0.05, "scanning for transients");
      const buffers = [];
      for (let i = 0; i < N; i++) {
        workCtx.clearRect(0, 0, w, h);
        workCtx.drawImage(srcFrames[i], 0, 0);
        buffers.push(workCtx.getImageData(0, 0, w, h));
      }
      transients = computeTransientsFromData(buffers, w, h);
    }

    // 2. Exposure normalization pre-pass
    let exposure = null;
    if (P.exposureNorm) {
      if (onProgress) onProgress(0.10, "measuring exposure");
      let totalLuma = 0;
      for (let i = 0; i < N; i++) {
        workCtx.clearRect(0, 0, w, h);
        workCtx.drawImage(srcFrames[i], 0, 0);
        totalLuma += meanLumaFromData(workCtx.getImageData(0, 0, w, h));
      }
      exposure = { mean: totalLuma / N };
    }

    const outFrames = new Array(N).fill(null);
    const fwdOrder = Array.from({ length: N }, (_, i) => i);
    const bwdOrder = Array.from({ length: N }, (_, i) => N - 1 - i);

    async function runPass(order, geomSign, progBase, progSpan, writeTarget) {
      memCtx.clearRect(0, 0, w, h);
      workCtx.clearRect(0, 0, w, h);
      workCtx.drawImage(srcFrames[order[0]], 0, 0);
      memCtx.drawImage(canvases.work, 0, 0);

      const hueRef = { angle: 0 };
      const M = order.length;

      for (let s = 0; s < M; s++) {
        if (isCancelled && isCancelled()) throw new Error("cancelled");
        const idx = order[s];
        let depositScale = 1;
        if (transients) {
          const look = geomSign < 0 ? transients[Math.min(N - 1, idx + 1)] : transients[idx];
          depositScale = 0.35 + 0.65 * look;
        }

        feedbackStep(srcFrames[idx], s * 0.035, geomSign, hueRef, depositScale, canvases, w, h, P);

        if (exposure) {
          workCtx.clearRect(0, 0, w, h);
          workCtx.drawImage(canvases.memory, 0, 0);
          const cur = meanLumaFromData(workCtx.getImageData(0, 0, w, h));
          const k = clamp(exposure.mean / Math.max(1, cur), 0.7, 1.4);
          if (Math.abs(k - 1) > 0.02) {
            memCtx.save();
            memCtx.filter = `brightness(${k})`;
            memCtx.drawImage(canvases.memory, 0, 0);
            memCtx.restore();
          }
        }

        const snap = await snapshot(canvases.memory);
        await writeTarget(idx, snap);

        if (onProgress && s % 2 === 0) {
          onProgress(progBase + (s / M) * progSpan, `${geomSign < 0 ? "anticipating" : "tracing"} ${s + 1}/${M}`);
        }
      }
    }

    const mode = P.mode;
    const wakeW = clamp(P.balance, 0, 1);
    const antW = clamp(1 - P.balance, 0, 1);

    if (mode === "wake") {
      await runPass(fwdOrder, +1, 0.15, 0.85, async (idx, snap) => {
        const baked = await bakeFinal(snap, idx * 0.035, P.chromaSplit, w, h, bakeCtx, bake);
        if (snap.close) snap.close();
        outFrames[idx] = baked;
      });
    } else if (mode === "anticipation") {
      await runPass(bwdOrder, -1, 0.15, 0.85, async (idx, snap) => {
        const baked = await bakeFinal(snap, idx * 0.035, P.chromaSplit, w, h, bakeCtx, bake);
        if (snap.close) snap.close();
        outFrames[idx] = baked;
      });
    } else { // symmetric
      const fwdRaw = new Array(N).fill(null);
      await runPass(fwdOrder, +1, 0.15, 0.40, async (idx, snap) => {
        fwdRaw[idx] = snap;
      });
      if (isCancelled && isCancelled()) throw new Error("cancelled");

      await runPass(bwdOrder, -1, 0.55, 0.45, async (idx, snap) => {
        cmpCtx.clearRect(0, 0, w, h);
        cmpCtx.globalCompositeOperation = "source-over";
        cmpCtx.globalAlpha = wakeW;
        cmpCtx.drawImage(fwdRaw[idx], 0, 0);
        cmpCtx.globalCompositeOperation = "lighten";
        cmpCtx.globalAlpha = antW;
        cmpCtx.drawImage(snap, 0, 0);
        cmpCtx.globalAlpha = 1;
        cmpCtx.globalCompositeOperation = "source-over";

        const baked = await bakeFinal(compose, idx * 0.035, P.chromaSplit, w, h, bakeCtx, bake);
        outFrames[idx] = baked;
        if (fwdRaw[idx] && fwdRaw[idx].close) fwdRaw[idx].close();
        fwdRaw[idx] = null;
        if (snap.close) snap.close();
      });
    }

    if (onProgress) onProgress(1.0, "done");

    return {
      frames: outFrames,
      width: w,
      height: h,
      length: N,
      params: P,
      transients,
      exposure
    };
  }

  const ProlepsisDSP = Object.freeze({
    defaultParams,
    PRESETS,
    validateParams,
    buildMaskData,
    computeTransientsFromData,
    meanLumaFromData,
    createCanvases,
    feedbackStep,
    bakeFinal,
    render
  });

  return ProlepsisDSP;
});
