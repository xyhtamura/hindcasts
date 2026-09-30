// Metachamber DSP engine: gap-aware acausal reverb.
// Pure calculation module: no DOM, AudioContext, or UI dependencies.
(function(root, factory) {
  if (typeof module === "object" && module.exports) {
    const HindcastsGapMap = require("../shared/gap-map.js");
    module.exports = factory(HindcastsGapMap);
  } else {
    root.MetachamberDSP = factory(root.HindcastsGapMap);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function(HindcastsGapMap) {
  "use strict";

  const analyzeGapMap = (HindcastsGapMap && HindcastsGapMap.analyzeGapMap) ||
    (typeof globalThis !== "undefined" && globalThis.HindcastsGapMap && globalThis.HindcastsGapMap.analyzeGapMap);

  function defaultParams() {
    return {
      spill: -36,
      maskingCredit: 0.35,
      rtMin: 0.35,
      rtMax: 4.0,
      preDelay: 0.018,
      damping: 0.55,
      mix: 0.40,
      stance: "fit", // "off" | "fit" | "duck"
      temporal: "symmetric", // "wake" | "anticipation" | "symmetric"
      temporalBalance: 0.5
    };
  }

  function validateParams(params = {}) {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const defaults = defaultParams();
    const p = { ...defaults, ...params };
    const stance = ["off", "fit", "duck"].includes(p.stance) ? p.stance : "fit";
    const temporal = ["wake", "anticipation", "symmetric"].includes(p.temporal) ? p.temporal : "symmetric";
    return {
      spill: Number.isFinite(p.spill) ? clamp(p.spill, -120, 0) : defaults.spill,
      maskingCredit: Number.isFinite(p.maskingCredit) ? clamp(p.maskingCredit, 0, 1) : defaults.maskingCredit,
      rtMin: Number.isFinite(p.rtMin) ? Math.max(0.05, p.rtMin) : defaults.rtMin,
      rtMax: Number.isFinite(p.rtMax) ? Math.max(p.rtMin || defaults.rtMin, p.rtMax) : defaults.rtMax,
      preDelay: Number.isFinite(p.preDelay) ? Math.max(0, p.preDelay) : defaults.preDelay,
      damping: Number.isFinite(p.damping) ? clamp(p.damping, 0, 1) : defaults.damping,
      mix: Number.isFinite(p.mix) ? clamp(p.mix, 0, 1) : defaults.mix,
      stance,
      temporal,
      temporalBalance: Number.isFinite(p.temporalBalance) ? clamp(p.temporalBalance, 0, 1) : defaults.temporalBalance
    };
  }

  function solveGapMap(gapMap, params) {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const credit = clamp(params.maskingCredit, 0, 1);
    const solveBudget = (peak, maskingPeak, gapSeconds) => {
      const floorRel = gapMap.floorDbfs - peak;
      const baseRel = params.spill <= -71.5 ? floorRel : Math.max(params.spill, floorRel);
      const maskingRel = maskingPeak - peak - 12;
      const allowedRel = clamp(baseRel + credit * Math.max(0, maskingRel - baseRel), -120, 0);
      const availableGap = Math.max(0, gapSeconds - params.preDelay);
      const dropDb = Math.max(0, -allowedRel);
      const rawRT = dropDb < 1e-6 ? params.rtMax : 60 * availableGap / dropDb;
      return {
        maskingAllowance: +maskingRel.toFixed(3),
        allowedRel: +allowedRel.toFixed(3),
        budget: +(peak + allowedRel).toFixed(3),
        availableGap: +availableGap.toFixed(6),
        rawRT: +rawRT.toFixed(6),
        targetRT: +clamp(rawRT, params.rtMin, params.rtMax).toFixed(6),
        infeasible: rawRT < params.rtMin - 1e-9
      };
    };
    const solved = gapMap.events.map((event, index) => {
      const tOnset = event.onsetSample / gapMap.sampleRate;
      const tRelease = event.releaseSample / gapMap.sampleRate;
      const peak = event.eventRmsPeakDbfs;
      if (index === gapMap.events.length - 1 || event.silenceGapSamples == null) {
        const allowedRel = gapMap.floorDbfs - peak;
        return { ...event, tOnset, tRelease, peak, gapToNext: null, nextOnsetLevel: null, maskingAllowance: allowedRel, allowedRel, budget: gapMap.floorDbfs, availableGap: null, rawRT: params.rtMax, targetRT: params.rtMax, infeasible: false };
      }
      const gapToNext = event.silenceGapSamples / gapMap.sampleRate;
      const budget = solveBudget(peak, event.nextOnsetRmsDbfs, gapToNext);
      return {
        ...event,
        tOnset, tRelease, peak, gapToNext, nextOnsetLevel: event.nextOnsetRmsDbfs,
        ...budget
      };
    });
    return solved.map((event, index) => {
      if (index === 0) {
        const preAllowedRel = gapMap.floorDbfs - event.peak;
        return { ...event, gapToPrevious: null, previousOnsetLevel: null, preMaskingAllowance: preAllowedRel, preAllowedRel, preBudget: gapMap.floorDbfs, preAvailableGap: null, preRawRT: params.rtMax, preTargetRT: params.rtMax, preInfeasible: false };
      }
      const previous = solved[index - 1];
      const gapToPrevious = Math.max(0, event.tOnset - previous.tRelease);
      const budget = solveBudget(event.peak, previous.peak, gapToPrevious);
      return {
        ...event,
        gapToPrevious,
        previousOnsetLevel: previous.peak,
        preMaskingAllowance: budget.maskingAllowance,
        preAllowedRel: budget.allowedRel,
        preBudget: budget.budget,
        preAvailableGap: budget.availableGap,
        preRawRT: budget.rawRT,
        preTargetRT: budget.targetRT,
        preInfeasible: budget.infeasible
      };
    });
  }

  function renderMetachamber(payload, report) {
    const source = payload.sourceChannels;
    const sampleRate = payload.sampleRate;
    const events = payload.events || [];
    const p = payload.params;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const lin = d => Math.pow(10, d / 20);
    const channels = Math.max(1, Math.min(2, source.length));
    const sourceLength = source[0].length;
    const temporal = ["wake", "anticipation", "symmetric"].includes(p.temporal) ? p.temporal : "wake";
    const temporalBalance = clamp(p.temporalBalance == null ? 0.5 : p.temporalBalance, 0, 1);
    const roomSamples = Math.ceil((p.preDelay + p.rtMax * 1.5) * sampleRate);
    const hasAnticipation = temporal !== "wake";
    const hasWake = temporal !== "anticipation";
    const headSamples = hasAnticipation ? roomSamples : 0;
    const tailSamples = hasWake ? roomSamples : 0;
    const length = Math.max(1, headSamples + sourceLength + tailSamples);
    const roomMid = Math.sqrt(p.rtMin * p.rtMax);
    const anchors = [p.rtMin, roomMid, p.rtMax];
    const logAnchors = anchors.map(Math.log);
    const fadeSamples = Math.max(1, Math.round(sampleRate * 0.008));
    const preSamples = Math.round(p.preDelay * sampleRate);

    const weightsFor = (rt, availableGap) => {
      const x = Math.log(clamp(rt, p.rtMin, p.rtMax));
      if (x <= logAnchors[1]) {
        let u;
        const lo = Math.pow(10, -3 * availableGap / anchors[0]), hi = Math.pow(10, -3 * availableGap / anchors[1]), target = Math.pow(10, -3 * availableGap / clamp(rt, p.rtMin, p.rtMax));
        if (availableGap < 1e-5 || Math.abs(hi - lo) < 1e-9) u = (x - logAnchors[0]) / Math.max(1e-9, logAnchors[1] - logAnchors[0]);
        else u = (target - lo) / (hi - lo);
        u = clamp(u, 0, 1);
        return [1 - u, u, 0];
      }
      let u;
      const lo = Math.pow(10, -3 * availableGap / anchors[1]), hi = Math.pow(10, -3 * availableGap / anchors[2]), target = Math.pow(10, -3 * availableGap / clamp(rt, p.rtMin, p.rtMax));
      if (availableGap < 1e-5 || Math.abs(hi - lo) < 1e-9) u = (x - logAnchors[1]) / Math.max(1e-9, logAnchors[2] - logAnchors[1]);
      else u = (target - lo) / (hi - lo);
      u = clamp(u, 0, 1);
      return [0, 1 - u, u];
    };
    const onsetSamples = events.length ? events.map(e => Math.round(e.tOnset * sampleRate)) : [0];
    const eventWeightsFor = direction => events.length ? events.map(e => direction === "wake"
      ? weightsFor(e.targetRT, e.availableGap == null ? p.rtMax : e.availableGap)
      : weightsFor(e.preTargetRT == null ? e.targetRT : e.preTargetRT, e.preAvailableGap == null ? p.rtMax : e.preAvailableGap)) : [[0, 0, 1]];
    const routeWeight = (room, sourceIndex, eventIndex, eventWeights) => {
      if (p.stance !== "fit") return room === 2 ? 1 : 0;
      const current = eventWeights[Math.max(0, Math.min(eventWeights.length - 1, eventIndex))];
      if (eventIndex + 1 >= eventWeights.length) return current[room];
      const nextBoundary = onsetSamples[eventIndex + 1];
      if (sourceIndex <= nextBoundary - fadeSamples || sourceIndex >= nextBoundary) return current[room];
      const a = current, b = eventWeights[eventIndex + 1];
      const u = clamp((sourceIndex - (nextBoundary - fadeSamples)) / fadeSamples, 0, 1);
      const s = 0.5 - 0.5 * Math.cos(Math.PI * u);
      const x0 = a[0] * (1 - s) + b[0] * s, x1 = a[1] * (1 - s) + b[1] * s, x2 = a[2] * (1 - s) + b[2] * s;
      const norm = Math.max(1e-9, x0 + x1 + x2);
      return (room === 0 ? x0 : room === 1 ? x1 : x2) / norm;
    };
    const mulberry32 = seed => {
      let a = seed >>> 0;
      return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    };
    const hadamard8 = v => {
      for (let stride = 1; stride < 8; stride <<= 1) {
        for (let base = 0; base < 8; base += stride << 1) {
          for (let j = 0; j < stride; j++) { const i = base + j, k = i + stride, a = v[i], b = v[k]; v[i] = a + b; v[k] = a - b; }
        }
      }
      const n = 1 / Math.sqrt(8); for (let i = 0; i < 8; i++) v[i] *= n;
    };

    const zeroPhaseSmooth = (data, seconds) => {
      const a = 1 - Math.exp(-1 / Math.max(1, seconds * sampleRate));
      let z = data[0]; for (let i = 0; i < data.length; i++) { z += a * (data[i] - z); data[i] = z; }
      z = data[data.length - 1]; for (let i = data.length - 1; i >= 0; i--) { z += a * (data[i] - z); data[i] = z; }
    };
    const directions = [];
    if (hasAnticipation) directions.push("anticipation");
    if (hasWake) directions.push("wake");

    const renderDirection = (direction, directionNo) => {
      const wet = Array.from({ length: channels }, () => new Float32Array(length));
      const eventWeights = eventWeightsFor(direction);
      const passes = p.stance === "fit" ? [0, 1, 2] : [2];
      for (let passNo = 0; passNo < passes.length; passNo++) {
        const room = passes[passNo], rt = anchors[room];
        const rand = mulberry32(0xCAE50001);
        const baseMs = [29.7, 34.9, 41.1, 46.7, 53.3, 61.1, 68.9, 79.7];
        const delayLength = baseMs.map(ms => Math.max(17, Math.round(sampleRate * ms * (0.96 + rand() * 0.08) / 1000) | 1));
        const delay = delayLength.map(n => new Float32Array(n));
        const index = new Int32Array(8), filtered = new Float64Array(8), read = new Float64Array(8), mixed = new Float64Array(8);
        const feedback = delayLength.map(n => Math.pow(10, -3 * (n / sampleRate) / Math.max(0.08, rt)));
        const cutoff = 18000 * Math.pow(1800 / 18000, clamp(p.damping, 0, 1));
        const dampAlpha = 1 - Math.exp(-2 * Math.PI * cutoff / sampleRate);
        const injectSign = Array.from({ length: 8 }, () => rand() < 0.5 ? -1 : 1);
        let eventIndex = direction === "wake" ? 0 : Math.max(0, onsetSamples.length - 1);
        for (let step = 0; step < length; step++) {
          const n = direction === "wake" ? step : length - 1 - step;
          const srcIndex = direction === "wake" ? n - headSamples - preSamples : n - headSamples + preSamples;
          if (direction === "wake") while (eventIndex + 1 < onsetSamples.length && srcIndex >= onsetSamples[eventIndex + 1]) eventIndex++;
          else while (eventIndex > 0 && srcIndex < onsetSamples[eventIndex]) eventIndex--;
          const route = srcIndex >= 0 && srcIndex < sourceLength ? routeWeight(room, srcIndex, eventIndex, eventWeights) : 0;
          const inL = route ? source[0][srcIndex] * route : 0;
          const inR = channels > 1 && route ? source[1][srcIndex] * route : inL;
          for (let i = 0; i < 8; i++) {
            const y = delay[i][index[i]];
            read[i] = y;
            filtered[i] += dampAlpha * (y - filtered[i]);
            mixed[i] = filtered[i];
          }
          hadamard8(mixed);
          for (let i = 0; i < 8; i++) {
            const input = ((i & 1) ? inR : inL) * injectSign[i] * 0.27;
            delay[i][index[i]] = input + mixed[i] * feedback[i];
            index[i]++; if (index[i] === delayLength[i]) index[i] = 0;
          }
          wet[0][n] += (read[0] - read[1] + read[2] - read[3] + read[4] - read[5] + read[6] - read[7]) * 0.255;
          if (channels > 1) wet[1][n] += (read[0] + read[1] - read[2] - read[3] - read[4] - read[5] + read[6] + read[7]) * 0.255;
          if (report && (step & 32767) === 0) report(direction === "wake" ? "tracing the wake" : "building the precursor", (directionNo + (passNo + step / length) / passes.length) / directions.length);
        }
      }
      return wet;
    };

    const boundaryWindow = (direction, index) => {
      if (direction === "wake") {
        const center = clamp(headSamples + Math.round(events[index].tOnset * sampleRate), 0, length - 1);
        const end = clamp(center - Math.round(0.002 * sampleRate), 1, length);
        return { center, start: clamp(end - Math.max(4, Math.round(0.010 * sampleRate)), 0, end - 1), end };
      }
      const center = clamp(headSamples + Math.round(events[index - 1].tRelease * sampleRate), 0, length - 1);
      const start = clamp(center + Math.round(0.002 * sampleRate), 0, length - 1);
      return { center, start, end: clamp(start + Math.max(4, Math.round(0.010 * sampleRate)), start + 1, length) };
    };
    const tailRms = (wet, window, env) => {
      let ss = 0, count = 0;
      for (let ch = 0; ch < channels; ch++) for (let n = window.start; n < window.end; n++) { const x = wet[ch][n] * env[n]; ss += x * x; count++; }
      return Math.sqrt(ss / Math.max(1, count));
    };
    const constrainDirection = (wet, direction) => {
      if (p.stance === "off") return { guards: 0, passed: 0, checked: 0, maxOvershootDb: -Infinity };
      const envelope = new Float32Array(length); envelope.fill(1);
      if (p.stance === "duck") {
        for (let i = 1; i < events.length; i++) {
          const previous = events[i - 1], current = events[i];
          const available = direction === "wake" ? previous.availableGap : current.preAvailableGap;
          const allowedRel = direction === "wake" ? previous.allowedRel : current.preAllowedRel;
          const predictedRel = -60 * Math.max(0, available || 0) / Math.max(0.08, p.rtMax);
          const gain = lin(Math.min(0, allowedRel - predictedRel));
          const event = direction === "wake" ? current : previous;
          const a = clamp(headSamples + Math.round(event.tOnset * sampleRate), 0, length - 1);
          const b = clamp(headSamples + Math.round(Math.max(event.tRelease, event.tOnset + 0.045) * sampleRate), a + 1, length);
          for (let n = a; n < b; n++) if (gain < envelope[n]) envelope[n] = gain;
        }
        zeroPhaseSmooth(envelope, 0.045);
      }
      let guards = 0;
      for (let i = 1; i < events.length; i++) {
        const window = boundaryWindow(direction, i);
        const budget = direction === "wake" ? events[i - 1].budget : events[i].preBudget;
        const measured = tailRms(wet, window, envelope), allowed = lin(budget);
        if (measured > allowed * 1.00001) {
          guards++;
          const ratio = clamp(allowed / Math.max(1e-12, measured), 0, 1);
          const plateau = Math.max(2, Math.round(0.014 * sampleRate));
          const gap = direction === "wake" ? events[i - 1].gapToNext : events[i].gapToPrevious;
          const skirt = Math.max(4, Math.round(Math.min(0.065, Math.max(0.025, (gap || 0.05) * 0.35)) * sampleRate));
          const lo = Math.max(0, window.center - plateau - skirt), hi = Math.min(length - 1, window.center + plateau + skirt);
          for (let n = lo; n <= hi; n++) {
            const d = Math.max(0, Math.abs(n - window.center) - plateau);
            const u = clamp(d / skirt, 0, 1);
            envelope[n] *= ratio + (1 - ratio) * (0.5 - 0.5 * Math.cos(Math.PI * u));
          }
        }
      }
      for (let ch = 0; ch < channels; ch++) for (let n = 0; n < length; n++) wet[ch][n] *= envelope[n];
      let passed = 0, checked = 0, maxOvershootDb = -Infinity;
      const unity = new Float32Array(length); unity.fill(1);
      for (let i = 1; i < events.length; i++) {
        const window = boundaryWindow(direction, i);
        const budget = direction === "wake" ? events[i - 1].budget : events[i].preBudget;
        const measured = tailRms(wet, window, unity), allowed = lin(budget);
        const over = 20 * Math.log10(Math.max(1e-12, measured) / Math.max(1e-12, allowed));
        maxOvershootDb = Math.max(maxOvershootDb, over); checked++; if (over <= 0.05) passed++;
      }
      return { guards, passed, checked, maxOvershootDb };
    };

    const rendered = {}, stats = [];
    directions.forEach((direction, index) => { rendered[direction] = renderDirection(direction, index); stats.push(constrainDirection(rendered[direction], direction)); });
    const wet = Array.from({ length: channels }, () => new Float32Array(length));
    const antGain = temporal === "symmetric" ? Math.cos(temporalBalance * Math.PI * 0.5) : hasAnticipation ? 1 : 0;
    const wakeGain = temporal === "symmetric" ? Math.sin(temporalBalance * Math.PI * 0.5) : hasWake ? 1 : 0;
    for (let ch = 0; ch < channels; ch++) for (let n = 0; n < length; n++) wet[ch][n] = (rendered.anticipation ? rendered.anticipation[ch][n] * antGain : 0) + (rendered.wake ? rendered.wake[ch][n] * wakeGain : 0);
    const guards = stats.reduce((sum, x) => sum + x.guards, 0);
    const passed = stats.reduce((sum, x) => sum + x.passed, 0);
    const checked = stats.reduce((sum, x) => sum + x.checked, 0);
    const maxOvershootDb = stats.reduce((max, x) => Math.max(max, x.maxOvershootDb), -Infinity);

    const dryGain = Math.cos(clamp(p.mix, 0, 1) * Math.PI * 0.5), wetGain = Math.sin(clamp(p.mix, 0, 1) * Math.PI * 0.5);
    const out = Array.from({ length: channels }, () => new Float32Array(length));
    let peak = 0, nonFinite = 0;
    for (let ch = 0; ch < channels; ch++) {
      const dry = source[ch];
      for (let n = 0; n < length; n++) {
        const srcIndex = n - headSamples;
        let x = (srcIndex >= 0 && srcIndex < sourceLength ? dry[srcIndex] * dryGain : 0) + wet[ch][n] * wetGain;
        if (!Number.isFinite(x)) { x = 0; nonFinite++; }
        out[ch][n] = x; const a = Math.abs(x); if (a > peak) peak = a;
      }
    }
    const ceiling = 0.977, scale = peak > ceiling ? ceiling / peak : 1;
    if (scale < 1) for (const channel of out) for (let n = 0; n < length; n++) channel[n] *= scale;
    if (report) report("mixing the known future", 1);
    return {
      channels: out,
      sampleRate,
      meta: {
        duration: length / sampleRate,
        peak,
        scale,
        nonFinite,
        guards,
        checks: { passed, total: checked, maxOvershootDb: checked ? maxOvershootDb : null },
        roomRT: anchors,
        stance: p.stance,
        temporal,
        temporalBalance,
        sourceOffset: headSamples / sampleRate,
        sourceOffsetSamples: headSamples,
        headSeconds: headSamples / sampleRate,
        tailSeconds: tailSamples / sampleRate
      }
    };
  }

  function render(sourceChannels, sampleRate, userParams = {}, report) {
    const p = validateParams(userParams);
    let events = userParams.events;
    let gapMap = userParams.gapMap;
    if (!events && p.stance !== "off") {
      if (!gapMap) {
        gapMap = analyzeGapMap({ channels: sourceChannels, sampleRate }, report);
      }
      events = solveGapMap(gapMap, p);
    } else if (!events) {
      events = [];
    }
    return renderMetachamber({ sourceChannels, sampleRate, events, params: p }, report);
  }

  function createWorkerSource() {
    return `"use strict";
const analyzeGapMap = ${analyzeGapMap.toString()};
const solveGapMap = ${solveGapMap.toString()};
const renderMetachamber = ${renderMetachamber.toString()};
self.onmessage = e => {
  const { id, kind, payload } = e.data;
  const report = (phase, value) => self.postMessage({ id, progress: true, phase, value });
  try {
    if (kind === "analyze") {
      const result = analyzeGapMap(payload, report);
      self.postMessage({ id, ok: true, result });
    } else if (kind === "render") {
      const result = renderMetachamber(payload, report);
      const transfer = result.channels.map(x => x.buffer);
      self.postMessage({ id, ok: true, result }, transfer);
    } else throw new Error("Unknown engine job");
  } catch (error) {
    self.postMessage({ id, ok: false, error: error && error.stack || String(error) });
  }
};`;
  }

  const MetachamberDSP = Object.freeze({
    analyzeGapMap,
    solveGapMap,
    renderMetachamber,
    render,
    defaultParams,
    validateParams,
    createWorkerSource
  });

  return MetachamberDSP;
});
