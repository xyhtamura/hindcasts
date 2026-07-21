import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { Worker } from "node:worker_threads";

const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
assert.match(html, /<title>Metachamber — gap-aware acausal reverb<\/title>/, "product title names the acausal reverb");
const h1Inner = html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1];
assert.equal(h1Inner?.replace(/<[^>]+>/g, ""), "Metachamber", "product heading reads Metachamber (display glyphs may be wrapped)");
assert.match(html, /<h2>Caesura \/ [^<]+<\/h2>/, "Caesura remains the mechanic name");
assert.doesNotMatch(html, /renderCaesura|__caesura|CAESURA_DSP/, "old product API symbols are gone");
const sharedSource = fs.readFileSync(new URL("../shared/gap-map.js", import.meta.url), "utf8");
const sharedScope = {};
new Function("globalThis", "module", sharedSource)(sharedScope, undefined);
const sharedAnalyzeGapMap = sharedScope.HindcastsGapMap.analyzeGapMap;
const dspSource = html.match(/\/\* METACHAMBER_DSP_START \*\/([\s\S]*?)\/\* METACHAMBER_DSP_END \*\//)?.[1];
assert.ok(dspSource, "DSP source block is present");

const { analyzeGapMap, solveGapMap, renderMetachamber } = new Function(
  "globalThis",
  `${dspSource}; return { analyzeGapMap, solveGapMap, renderMetachamber };`
)(sharedScope);
assert.equal(analyzeGapMap, sharedAnalyzeGapMap, "Metachamber consumes the canonical shared analyzer");
const encodeSource = html.match(/function encodeWav\([\s\S]*?(?=function safeStem)/)?.[0];
assert.ok(encodeSource, "WAV encoder is present");
const encodeWav = new Function(`${encodeSource}; return encodeWav;`)();
const foldSource = html.match(/function foldDisplayEnergy\([\s\S]*?(?=function bucketPeaks)/)?.[0];
assert.ok(foldSource, "display energy fold is present");
const foldDisplayEnergy = new Function(`${foldSource}; return foldDisplayEnergy;`)();

const sampleRate = 12000;
const seconds = 4;
const length = sampleRate * seconds;
const onsetTimes = [0.15, 0.45, 1.55, 1.95, 3.5];
const amplitudes = [0.5, 0.35, 0.8, 0.4, 0.7];

function impulseTrain(sign = 1) {
  const out = new Float32Array(length);
  onsetTimes.forEach((time, event) => {
    const onset = Math.round(time * sampleRate);
    for (let i = 0; i < 90; i++) {
      out[onset + i] += sign * amplitudes[event] * Math.exp(-i / 22) * (i & 1 ? -1 : 1);
    }
  });
  return out;
}

const mono = impulseTrain();
const map = analyzeGapMap({ channels: [mono], sampleRate });
assert.equal(map.schema, "hindcasts.gap-map");
assert.equal(map.version, 1);
assert.equal(map.sampleRate, sampleRate);
assert.equal(map.durationSamples, length);
assert.equal(map.events.length, onsetTimes.length, "all irregular impulses are detected");
map.events.forEach((event, index) => {
  const error = Math.abs(event.onsetSample / sampleRate - onsetTimes[index]);
  assert.ok(error <= map.analysis.hopSamples / sampleRate, `event ${index + 1} is within one hop`);
  assert.ok(Number.isFinite(event.eventRmsPeakDbfs));
  if (index < map.events.length - 1) {
    assert.ok(event.releaseSample <= event.nextOnsetSample);
    assert.equal(event.silenceGapSamples, event.nextOnsetSample - event.releaseSample);
  }
});

const antiPhase = analyzeGapMap({ channels: [mono, impulseTrain(-1)], sampleRate });
assert.equal(antiPhase.events.length, onsetTimes.length, "channel-energy analysis survives anti-phase stereo");
const antiDisplay = foldDisplayEnergy({ length, numberOfChannels: 2, getChannelData: channel => channel ? impulseTrain(-1) : mono });
assert.ok(antiDisplay.some(sample => Math.abs(sample) > 0.1), "anti-phase stereo remains visible in the waveform");
const silence = analyzeGapMap({ channels: [new Float32Array(length)], sampleRate });
assert.equal(silence.events.length, 0, "digital silence does not fabricate an event");

const baseParams = {
  spill: -42,
  maskingCredit: 0,
  rtMin: 0.25,
  rtMax: 1.4,
  preDelay: 0.005,
  damping: 0.45,
  mix: 1,
  stance: "fit"
};
const events = solveGapMap(map, baseParams);
assert.equal(events.length, map.events.length);
events.slice(0, -1).forEach(event => {
  assert.ok(event.targetRT >= baseParams.rtMin && event.targetRT <= baseParams.rtMax);
  assert.ok(event.allowedRel <= 0);
  assert.ok(event.availableGap <= event.gapToNext);
});

const manualMap = {
  schema: "hindcasts.gap-map",
  version: 1,
  sampleRate,
  durationSamples: sampleRate * 2,
  floorDbfs: -84,
  analysis: { windowSamples: 512, hopSamples: 120, releaseDropDb: 24, releaseHoldMs: 80 },
  events: [
    { onsetSample: 0, releaseSample: 1200, eventRmsPeakDbfs: -20, nextOnsetSample: 13200, nextOnsetRmsDbfs: -5, interOnsetSamples: 13200, silenceGapSamples: 12000, confidence: 1 },
    { onsetSample: 13200, releaseSample: 14400, eventRmsPeakDbfs: -5, nextOnsetSample: null, nextOnsetRmsDbfs: null, interOnsetSamples: null, silenceGapSamples: null, confidence: 1 }
  ]
};
const noCredit = solveGapMap(manualMap, { ...baseParams, maskingCredit: 0 })[0];
const fullCredit = solveGapMap(manualMap, { ...baseParams, maskingCredit: 1 })[0];
assert.ok(fullCredit.allowedRel >= noCredit.allowedRel, "masking credit only relaxes the allowance");
assert.ok(fullCredit.targetRT >= noCredit.targetRT, "masking credit never shortens the fitted room");
const ordinary = solveGapMap(manualMap, { ...baseParams, spill: 0 })[0];
assert.equal(ordinary.targetRT, baseParams.rtMax, "0 dB Spill selects the ordinary long room");
const morePredelay = solveGapMap(manualMap, { ...baseParams, preDelay: 0.25 })[0];
assert.ok(morePredelay.availableGap < noCredit.availableGap, "pre-delay consumes the tail's gap budget");

const first = renderMetachamber({ sourceChannels: [mono], sampleRate, events, params: baseParams });
const second = renderMetachamber({ sourceChannels: [mono], sampleRate, events, params: baseParams });
assert.equal(first.channels.length, 1);
assert.equal(first.channels[0].length, length + Math.ceil((baseParams.preDelay + baseParams.rtMax * 1.5) * sampleRate));
assert.equal(first.meta.nonFinite, 0);
assert.equal(first.meta.checks.passed, first.meta.checks.total, "wet-only pre-onset tails meet their solved budgets");
assert.deepEqual(first.channels[0], second.channels[0], "identical FIT renders are sample-identical");
let wetEnergy = 0;
for (const sample of first.channels[0]) wetEnergy += sample * sample;
assert.ok(wetEnergy > 1e-6, "FIT produces nonzero wet energy");

const roomSamples = Math.ceil((baseParams.preDelay + baseParams.rtMax * 1.5) * sampleRate);
events.slice(1).forEach(event => {
  assert.ok(event.preTargetRT >= baseParams.rtMin && event.preTargetRT <= baseParams.rtMax, "reverse room fits the preceding gap");
  assert.ok(event.preAvailableGap <= event.gapToPrevious, "pre-delay consumes the preceding gap budget");
});
const anticipationParams = { ...baseParams, temporal: "anticipation", temporalBalance: 0.5 };
const anticipation = renderMetachamber({ sourceChannels: [mono], sampleRate, events, params: anticipationParams });
assert.equal(anticipation.channels[0].length, length + roomSamples, "anticipation adds head room only");
assert.equal(anticipation.meta.sourceOffsetSamples, roomSamples, "dry body is shifted behind the precursor room");
assert.equal(anticipation.meta.checks.passed, anticipation.meta.checks.total, "anticipatory tails meet preceding-gap budgets");
let precursorEnergy = 0;
for (let i = 0; i < anticipation.meta.sourceOffsetSamples; i++) precursorEnergy += anticipation.channels[0][i] ** 2;
assert.ok(precursorEnergy > 1e-8, "anticipation produces wet energy before the dry body");

const symmetricParams = { ...baseParams, temporal: "symmetric", temporalBalance: 0.5 };
const symmetric = renderMetachamber({ sourceChannels: [mono], sampleRate, events, params: symmetricParams });
assert.equal(symmetric.channels[0].length, length + roomSamples * 2, "symmetric reverb adds equal head and tail rooms");
assert.equal(symmetric.meta.sourceOffsetSamples, roomSamples);
assert.equal(symmetric.meta.checks.total, (events.length - 1) * 2, "symmetric render verifies both temporal horizons");
assert.equal(symmetric.meta.checks.passed, symmetric.meta.checks.total, "both horizons meet their budgets");
let symmetricHead = 0, symmetricTail = 0;
for (let i = 0; i < roomSamples; i++) symmetricHead += symmetric.channels[0][i] ** 2;
for (let i = roomSamples + length; i < symmetric.channels[0].length; i++) symmetricTail += symmetric.channels[0][i] ** 2;
assert.ok(symmetricHead > 1e-8 && symmetricTail > 1e-8, "symmetric reverb blooms before and after the source");
const dryOnly = renderMetachamber({ sourceChannels: [mono], sampleRate, events, params: { ...symmetricParams, mix: 0 } });
assert.equal(dryOnly.channels[0][roomSamples + Math.round(onsetTimes[0] * sampleRate)], mono[Math.round(onsetTimes[0] * sampleRate)], "dry source remains sample-aligned after head extension");

const duckParams = { ...baseParams, stance: "duck" };
const duckEvents = solveGapMap(map, duckParams);
const duck = renderMetachamber({ sourceChannels: [mono], sampleRate, events: duckEvents, params: duckParams });
assert.equal(duck.meta.nonFinite, 0);
assert.equal(duck.meta.checks.passed, duck.meta.checks.total, "DUCK pins every constrained onset at or below its allowance");
const symmetricDuck = renderMetachamber({ sourceChannels: [mono], sampleRate, events: duckEvents, params: { ...duckParams, temporal: "symmetric", temporalBalance: 0.5 } });
assert.equal(symmetricDuck.meta.nonFinite, 0);
assert.equal(symmetricDuck.meta.checks.passed, symmetricDuck.meta.checks.total, "DUCK protects both horizons in symmetric mode");

const stereo = renderMetachamber({ sourceChannels: [mono, impulseTrain(-1)], sampleRate, events, params: baseParams });
assert.equal(stereo.channels.length, 2);
assert.equal(stereo.meta.nonFinite, 0);

const routedSource = new Float32Array(sampleRate);
routedSource[Math.round(sampleRate * 0.5)] = 0.7;
const routeEvents = [
  { tOnset: 0, tRelease: 0.1, peak: -20, gapToNext: 0.4, nextOnsetLevel: -3, allowedRel: -42, budget: -62, availableGap: 0.395, targetRT: baseParams.rtMin },
  { tOnset: 0.5, tRelease: 0.51, peak: -3, gapToNext: null, nextOnsetLevel: null, allowedRel: -70, budget: -73, availableGap: null, targetRT: baseParams.rtMax }
];
const routeA = renderMetachamber({ sourceChannels: [routedSource], sampleRate, events: routeEvents, params: baseParams });
const routeB = renderMetachamber({ sourceChannels: [routedSource], sampleRate, events: [{ ...routeEvents[0], targetRT: baseParams.rtMax }, routeEvents[1]], params: baseParams });
assert.deepEqual(routeA.channels[0], routeB.channels[0], "a transient on the new onset is routed wholly into its own room");

const decaySource = new Float32Array(sampleRate * 2);
decaySource[Math.round(sampleRate * 0.1)] = 0.8;
const decayEvent = { tOnset: 0.1, tRelease: 0.101, peak: -2, gapToNext: null, nextOnsetLevel: null, allowedRel: -80, budget: -82, availableGap: null };
const shortDecay = renderMetachamber({ sourceChannels: [decaySource], sampleRate, events: [{ ...decayEvent, targetRT: baseParams.rtMin }], params: baseParams });
const longDecay = renderMetachamber({ sourceChannels: [decaySource], sampleRate, events: [{ ...decayEvent, targetRT: baseParams.rtMax }], params: baseParams });
const bandEnergy = (channel, start, end) => { let sum = 0; for (let i = Math.round(start * sampleRate); i < Math.round(end * sampleRate); i++) sum += channel[i] * channel[i]; return sum; };
const shortLate = bandEnergy(shortDecay.channels[0], 0.75, 1.05), longLate = bandEnergy(longDecay.channels[0], 0.75, 1.05);
assert.ok(longLate > 1e-9 && longLate > shortLate * 10, "the RT-max anchor retains materially more late energy than RT-min");

const wavA = encodeWav(first.channels, sampleRate);
const wavB = encodeWav(second.channels, sampleRate);
const view = new DataView(wavA);
assert.equal(view.getUint16(20, true), 3, "WAV uses IEEE float samples");
assert.equal(view.getUint16(34, true), 32, "WAV is 32-bit float");
const representative = first.channels[0].findIndex(sample => Math.abs(sample) > 1e-6);
assert.ok(representative >= 0);
assert.equal(view.getFloat32(44 + representative * 4, true), first.channels[0][representative], "WAV payload matches a nonzero preview sample exactly");
const stereoWav = new DataView(encodeWav(stereo.channels, sampleRate));
let stereoIndex = -1, stereoChannel = -1;
for (let i = 0; i < stereo.channels[0].length && stereoIndex < 0; i++) for (let channel = 0; channel < 2; channel++) if (Math.abs(stereo.channels[channel][i]) > 1e-6) { stereoIndex = i; stereoChannel = channel; break; }
assert.ok(stereoIndex >= 0);
assert.equal(stereoWav.getFloat32(44 + (stereoIndex * 2 + stereoChannel) * 4, true), stereo.channels[stereoChannel][stereoIndex], "stereo WAV interleaving matches preview PCM");
const hash = value => crypto.createHash("sha256").update(new Uint8Array(value)).digest("hex");
assert.equal(hash(wavA), hash(wavB), "identical bounces have identical SHA-256 hashes");

const workerProgram = `
const { parentPort } = require("node:worker_threads");
const analyzeGapMap = ${analyzeGapMap.toString()};
const renderMetachamber = ${renderMetachamber.toString()};
const self = { postMessage: (message, transfer) => parentPort.postMessage(message, transfer) };
self.onmessage = event => {
  const { id, kind, payload } = event.data;
  const report = (phase, value) => self.postMessage({ id, progress: true, phase, value });
  try {
    if (kind === "analyze") self.postMessage({ id, ok: true, result: analyzeGapMap(payload, report) });
    else if (kind === "render") {
      const result = renderMetachamber(payload, report);
      self.postMessage({ id, ok: true, result }, result.channels.map(channel => channel.buffer));
    } else throw new Error("Unknown engine job");
  } catch (error) { self.postMessage({ id, ok: false, error: error && error.stack || String(error) }); }
};
parentPort.on("message", data => self.onmessage({ data }));`;
const engineWorker = new Worker(workerProgram, { eval: true });
let workerId = 0;
const workerJob = (kind, payload, transfer = []) => new Promise((resolve, reject) => {
  const id = ++workerId;
  const listener = message => {
    if (message.id !== id || message.progress) return;
    engineWorker.off("message", listener);
    message.ok ? resolve(message.result) : reject(new Error(message.error));
  };
  engineWorker.on("message", listener);
  engineWorker.postMessage({ id, kind, payload }, transfer);
});
const workerInput = new Float32Array(mono);
const workerMap = await workerJob("analyze", { channels: [workerInput], sampleRate }, [workerInput.buffer]);
assert.equal(workerInput.byteLength, 0, "analysis input is transferred, not cloned");
assert.equal(workerMap.events.length, onsetTimes.length);
const workerEvents = solveGapMap(workerMap, baseParams);
const workerSourcePcm = new Float32Array(mono);
const workerRender = await workerJob("render", { sourceChannels: [workerSourcePcm], sampleRate, events: workerEvents, params: baseParams }, [workerSourcePcm.buffer]);
assert.equal(workerSourcePcm.byteLength, 0, "render input is transferred, not cloned");
assert.equal(workerRender.meta.nonFinite, 0);
assert.equal(workerRender.meta.checks.passed, workerRender.meta.checks.total);
assert.ok(workerRender.channels[0] instanceof Float32Array && workerRender.channels[0].byteLength > 0, "worker returns transferred Float32 PCM");
await engineWorker.terminate();

for (const id of ["gap-canvas", "stance-fit", "stance-duck", "time-wake", "time-anticipation", "time-symmetric", "balance", "render", "play", "bounce", "export-map"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `UI includes #${id}`);
}
assert.match(html, /the MVP accepts mono or stereo/, "unsupported multichannel input is rejected explicitly");
assert.match(html, /revision!==S\.revision\|\|input!==S\.input/, "stale render generations are discarded");

console.log(JSON.stringify({
  ok: true,
  detectedEvents: map.events.length,
  onsetErrorMs: map.events.map((event, index) => Math.round((event.onsetSample / sampleRate - onsetTimes[index]) * 1000)),
  fitChecks: first.meta.checks,
  duckChecks: duck.meta.checks,
  silenceEvents: silence.events.length,
  workerTransfer: "pass",
  lateDecayEnergyRatio: +(longLate / Math.max(shortLate, 1e-20)).toFixed(1),
  deterministicSha256: hash(wavA),
  outputSamples: first.channels[0].length
}, null, 2));
