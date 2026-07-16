"use strict";

/* Canonical hindcasts.gap-map v1 analyzer. Keep the wire shape documented in DEPENDENCIES.md. */
function analyzeGapMap(payload, report) {
  const channels = payload.channels || [payload.mono];
  const mono = channels[0];
  const sampleRate = payload.sampleRate;
  const duration = mono.length / sampleRate;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const db = v => 20 * Math.log10(Math.max(1e-12, v));
  const median = values => {
    if (!values.length) return 0;
    values.sort((a, b) => a - b);
    const m = values.length >> 1;
    return values.length & 1 ? values[m] : (values[m - 1] + values[m]) * 0.5;
  };
  const percentile = (values, p) => {
    if (!values.length) return 0;
    const a = values.slice().sort((x, y) => x - y);
    const pos = clamp(p, 0, 1) * (a.length - 1);
    const i = Math.floor(pos), f = pos - i;
    return a[i] + (a[Math.min(a.length - 1, i + 1)] - a[i]) * f;
  };
  const fft = (re, im) => {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr0 = Math.cos(ang), wi0 = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let wr = 1, wi = 0;
        for (let j = 0; j < (len >> 1); j++) {
          const k = i + j, l = k + (len >> 1);
          const tr = wr * re[l] - wi * im[l], ti = wr * im[l] + wi * re[l];
          const ur = re[k], ui = im[k];
          re[k] = ur + tr; im[k] = ui + ti; re[l] = ur - tr; im[l] = ui - ti;
          const nwr = wr * wr0 - wi * wi0; wi = wr * wi0 + wi * wr0; wr = nwr;
        }
      }
    }
  };

  const frameSize = clamp(Math.pow(2, Math.round(Math.log2(sampleRate * 0.046))), 512, 4096);
  const hopSamples = Math.max(64, Math.round(sampleRate * 0.01));
  const frameCount = Math.max(1, Math.ceil(Math.max(0, mono.length - frameSize) / hopSamples) + 1);
  const rms = new Float32Array(frameCount), rmsDb = new Float32Array(frameCount), flux = new Float32Array(frameCount);
  const re = new Float64Array(frameSize), im = new Float64Array(frameSize), prev = new Float64Array(frameSize >> 1), power = new Float64Array(frameSize >> 1);
  const win = new Float64Array(frameSize);
  for (let i = 0; i < frameSize; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / Math.max(1, frameSize - 1));

  for (let f = 0; f < frameCount; f++) {
    const start = f * hopSamples, end = Math.min(mono.length, start + frameSize);
    let ss = 0;
    power.fill(0);
    for (let ch = 0; ch < channels.length; ch++) {
      re.fill(0); im.fill(0);
      const channel = channels[ch];
      for (let i = start, j = 0; i < end; i++, j++) { const x = channel[i] || 0; ss += x * x; re[j] = x * win[j]; }
      fft(re, im);
      for (let k = 1; k < (frameSize >> 1); k++) power[k] += re[k] * re[k] + im[k] * im[k];
    }
    rms[f] = Math.sqrt(ss / Math.max(1, (end - start) * channels.length));
    rmsDb[f] = db(rms[f]);
    let rise = 0;
    const loBin = Math.max(1, Math.ceil(80 * frameSize / sampleRate));
    const hiBin = Math.min((frameSize >> 1) - 1, Math.floor(Math.min(12000, sampleRate * 0.48) * frameSize / sampleRate));
    for (let k = loBin; k <= hiBin; k++) {
      const mag = Math.log1p(Math.sqrt(power[k] / channels.length));
      const d = mag - prev[k]; if (d > 0) rise += d;
      prev[k] = mag;
    }
    flux[f] = rise / Math.max(1, hiBin - loBin + 1);
    if (report && (f & 255) === 0) report("reading spectral change", f / frameCount);
  }

  const finiteDb = Array.from(rmsDb, x => Number.isFinite(x) ? x : -120);
  const floorDb = clamp(percentile(finiteDb, 0.10) - 6, -90, -48);
  let loudestDb = -120;
  for (let i = 0; i < rmsDb.length; i++) if (rmsDb[i] > loudestDb) loudestDb = rmsDb[i];
  if (loudestDb < floorDb + 6) {
    if (report) report("gap map complete", 1);
    return {
      schema: "hindcasts.gap-map",
      version: 1,
      sampleRate,
      durationSamples: mono.length,
      floorDbfs: +floorDb.toFixed(3),
      analysis: { windowSamples: frameSize, hopSamples, releaseDropDb: 24, releaseHoldMs: 80 },
      events: []
    };
  }
  const candidate = [];
  const localRadius = Math.max(8, Math.round(0.50 * sampleRate / hopSamples));
  for (let i = 2; i < frameCount - 2; i++) {
    if (!(flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1])) continue;
    if (rmsDb[i] < floorDb + 6) continue;
    const local = [];
    for (let j = Math.max(0, i - localRadius); j <= Math.min(frameCount - 1, i + localRadius); j++) if (j !== i) local.push(flux[j]);
    const med = median(local);
    const mad = median(local.map(x => Math.abs(x - med)));
    const threshold = med + Math.max(0.00035, mad * 3.2);
    const energyRise = rmsDb[i] - rmsDb[Math.max(0, i - 3)];
    if (flux[i] > threshold || energyRise > 8) {
      candidate.push({ frame: i, score: (flux[i] - med) / Math.max(0.00035, mad) + Math.max(0, energyRise) * 0.08 });
    }
  }

  let activeStart = 0;
  while (activeStart < frameCount - 1 && rmsDb[activeStart] < floorDb + 8) activeStart++;
  const minSep = Math.max(3, Math.round(0.075 * sampleRate / hopSamples));
  const nearActive = candidate.some(x => Math.abs(x.frame - activeStart) < minSep);
  if (!nearActive) candidate.push({ frame: activeStart, score: 1e6 });
  candidate.sort((a, b) => a.frame - b.frame || b.score - a.score);
  const onsetFrames = [];
  for (const c of candidate) {
    const last = onsetFrames[onsetFrames.length - 1];
    if (last == null || c.frame - last.frame >= minSep) onsetFrames.push(c);
    else if (c.score > last.score) onsetFrames[onsetFrames.length - 1] = c;
  }
  onsetFrames.sort((a, b) => a.frame - b.frame);

  const refineOnset = frame => {
    const coarse = frame * hopSamples;
    const lo = Math.max(0, coarse), hi = Math.min(mono.length - 1, coarse + frameSize);
    const short = Math.max(8, Math.round(sampleRate * 0.004));
    const step = Math.max(1, Math.round(sampleRate * 0.001));
    let best = clamp(coarse + (frameSize >> 1), 0, mono.length - 1), bestScore = -Infinity;
    for (let pos = lo + short; pos + short < hi; pos += step) {
      let before = 0, after = 0;
      for (let ch = 0; ch < channels.length; ch++) {
        const x = channels[ch];
        for (let n = pos - short; n < pos; n++) before += (x[n] || 0) * (x[n] || 0);
        for (let n = pos; n < pos + short; n++) after += (x[n] || 0) * (x[n] || 0);
      }
      const score = 10 * Math.log10((after + 1e-14) / (before + 1e-14));
      if (score > bestScore) { bestScore = score; best = pos; }
    }
    return best;
  };
  const refinedOnsets = onsetFrames.map(o => refineOnset(o.frame));

  const draft = onsetFrames.map((o, index) => {
    const nextFrame = index + 1 < onsetFrames.length ? onsetFrames[index + 1].frame : frameCount;
    const uncontaminatedEnd = index + 1 < refinedOnsets.length ? Math.floor((refinedOnsets[index + 1] - frameSize) / hopSamples) + 1 : frameCount;
    const peakEnd = Math.max(o.frame + 1, Math.min(nextFrame, uncontaminatedEnd));
    let peakFrame = o.frame, peakDb = rmsDb[o.frame];
    for (let f = o.frame + 1; f < peakEnd; f++) if (rmsDb[f] > peakDb) { peakDb = rmsDb[f]; peakFrame = f; }
    let onsetLevel = rmsDb[o.frame];
    const onsetEnd = Math.min(nextFrame, o.frame + Math.max(2, Math.round(0.05 * sampleRate / hopSamples)));
    for (let f = o.frame + 1; f < onsetEnd; f++) if (rmsDb[f] > onsetLevel) onsetLevel = rmsDb[f];
    const releaseThreshold = Math.max(floorDb + 6, peakDb - 24);
    const hold = Math.max(3, Math.round(0.08 * sampleRate / hopSamples));
    let releaseFrame = nextFrame;
    for (let f = peakFrame + 2; f + hold <= nextFrame; f++) {
      let quiet = true;
      for (let q = 0; q < hold; q++) if (rmsDb[f + q] > releaseThreshold) { quiet = false; break; }
      if (quiet) { releaseFrame = f; break; }
    }
    const onsetSample = refinedOnsets[index];
    const nextOnsetSample = index + 1 < refinedOnsets.length ? refinedOnsets[index + 1] : mono.length;
    const releaseSample = Math.max(onsetSample, Math.min(nextOnsetSample, mono.length, releaseFrame * hopSamples + frameSize));
    return {
      onsetSample,
      releaseSample,
      peakDbfs: Number.isFinite(peakDb) ? peakDb : floorDb,
      onsetDbfs: Number.isFinite(onsetLevel) ? onsetLevel : floorDb,
      confidence: clamp(o.score / 12, 0, 1)
    };
  });

  const events = draft.map((e, i) => {
    const next = draft[i + 1] || null;
    return {
      onsetSample: e.onsetSample,
      releaseSample: e.releaseSample,
      eventRmsPeakDbfs: +e.peakDbfs.toFixed(3),
      nextOnsetSample: next ? next.onsetSample : null,
      nextOnsetRmsDbfs: next ? +next.onsetDbfs.toFixed(3) : null,
      interOnsetSamples: next ? Math.max(0, next.onsetSample - e.onsetSample) : null,
      silenceGapSamples: next ? Math.max(0, next.onsetSample - e.releaseSample) : null,
      confidence: +e.confidence.toFixed(3)
    };
  });
  if (report) report("gap map complete", 1);
  return {
    schema: "hindcasts.gap-map",
    version: 1,
    sampleRate,
    durationSamples: mono.length,
    floorDbfs: +floorDb.toFixed(3),
    analysis: { windowSamples: frameSize, hopSamples, releaseDropDb: 24, releaseHoldMs: 80 },
    events
  };
}

const HindcastsGapMap = Object.freeze({ analyzeGapMap });
if (typeof globalThis !== "undefined") globalThis.HindcastsGapMap = HindcastsGapMap;
if (typeof module !== "undefined" && module.exports) module.exports = HindcastsGapMap;

