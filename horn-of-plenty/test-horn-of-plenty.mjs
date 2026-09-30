// Unit and regression tests for Horn of Plenty DSP engine.
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const HornOfPlentyDSP = require("./engine.js");

const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
assert.match(html, /<script src="engine\.js"><\/script>/, "index.html loads engine.js module");

const {
  PRESETS,
  defaultParams,
  validateParams,
  toMono,
  analyzeGrains,
  suggestFiber,
  sowAndFlatten,
  render,
  encodeWav,
  mulberry32
} = HornOfPlentyDSP;

const sampleRate = 44100;
const seconds = 2;
const length = sampleRate * seconds;

// Synthetic bursty scrap: pulses with decreasing amplitude (scrap running out)
function createScrap() {
  const buf = new Float32Array(length);
  for (let n = 0; n < length; n++) {
    const t = n / sampleRate;
    // Decaying envelope with irregular bursts
    const decay = Math.exp(-t * 2);
    const burst = Math.sin(2 * Math.PI * 440 * t) * Math.sin(2 * Math.PI * 3.5 * t) ** 4;
    buf[n] = burst * decay * 0.7;
  }
  return buf;
}

const scrap = createScrap();

// 1. Grain analysis
const analysis = analyzeGrains(scrap, sampleRate, { fiber: 60 });
assert.ok(analysis.grains.length > 5, `expected grains, got ${analysis.grains.length}`);
for (const g of analysis.grains) {
  assert.ok(g.start >= 0 && g.start + analysis.gLen <= scrap.length);
  assert.ok(g.power > 0);
  assert.ok(g.bn >= 0 && g.bn <= 1);
}

// 2. Suggest fiber
const suggested = suggestFiber(scrap, sampleRate);
assert.ok(suggested >= 15 && suggested <= 300, `suggested fiber ${suggested} out of range`);

// 3. Determinism with seeded PRNG
const params = { fiber: 60, white: 50, len: 1.0, dens: 4, even: 80, pitch: 2, rev: 25, spread: 40, lvlOwn: true };
const out1 = sowAndFlatten(scrap, sampleRate, analysis.grains, params, 12345);
const out2 = sowAndFlatten(scrap, sampleRate, analysis.grains, params, 12345);
const out3 = sowAndFlatten(scrap, sampleRate, analysis.grains, params, 54321);

assert.equal(out1.channels.length, 2);
assert.equal(out1.channels[0].length, Math.round(params.len * sampleRate));
assert.deepEqual(out1.channels[0], out2.channels[0], "same seed produces identical left channel");
assert.deepEqual(out1.channels[1], out2.channels[1], "same seed produces identical right channel");
assert.notDeepEqual(out1.channels[0], out3.channels[0], "different seeds produce distinct left channel");

// 4. Output duration behavior
for (const dur of [0.25, 0.5, 1.2]) {
  const res = sowAndFlatten(scrap, sampleRate, analysis.grains, { ...params, len: dur }, 42);
  const expectedLen = Math.round(dur * sampleRate);
  assert.equal(res.channels[0].length, expectedLen, `expected length ${expectedLen} for dur ${dur}`);
  assert.equal(res.channels[1].length, expectedLen);
  assert.ok(res.channels[0].every(Number.isFinite), "all left samples must be finite");
  assert.ok(res.channels[1].every(Number.isFinite), "all right samples must be finite");
}

// 5. Level normalization contracts
// 5a. lvlOwn: peak scaled to -1 dBFS (10^(-1/20) ~ 0.89125)
assert.ok(Math.abs(out1.peak - Math.pow(10, -1 / 20)) < 1e-3, `expected peak ~-1 dBFS, got ${out1.peak}`);

// 5b. Fixed loudness target with 0 dBFS hard ceiling
const hotLoudness = sowAndFlatten(scrap, sampleRate, analysis.grains, { ...params, lvlOwn: false, level: 0 }, 12345);
assert.ok(hotLoudness.peak <= 1.00001, `peak must not exceed 1.0 ceiling, got ${hotLoudness.peak}`);

// 6. Convenience render() method
const rendered = render([scrap, scrap], sampleRate, { fiber: 50, len: 0.5 }, 9999);
assert.equal(rendered.channels.length, 2);
assert.equal(rendered.channels[0].length, Math.round(0.5 * sampleRate));
assert.ok(rendered.channels[0].every(Number.isFinite));

// 7. WAV encoder
const wavBytes = encodeWav(out1.channels[0], out1.channels[1], sampleRate);
const view = new DataView(wavBytes);
assert.equal(view.getUint16(20, true), 1, "WAV audio format 1 (PCM)");
assert.equal(view.getUint16(22, true), 2, "2 channels (stereo)");
assert.equal(view.getUint32(24, true), sampleRate, "sample rate");
assert.equal(view.getUint16(34, true), 16, "16-bit PCM");
assert.equal(view.getUint32(40, true), out1.channels[0].length * 2 * 2, "PCM data byte length");

console.log("PASS: grain analysis, autocorrelation suggestion, deterministic seeded scatter, duration contract, level/ceiling, WAV encoding");
console.log(JSON.stringify({
  ok: true,
  grains: analysis.grains.length,
  suggestedFiberMs: suggested,
  outputSamples: out1.channels[0].length,
  outPeak: out1.peak,
  ceilingProtectedPeak: hotLoudness.peak
}, null, 2));
