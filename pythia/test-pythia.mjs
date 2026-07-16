import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
for (const id of ["gap-fit-checkbox", "max-ring", "gap-spill", "masking-credit", "gap-fit-status"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `${id} control is wired into the page`);
}
assert.ok(
  html.indexOf("../shared/gap-map.js") < html.indexOf("pythia.js"),
  "the shared analyzer loads before the Pythia controller"
);

const workerSource = fs.readFileSync(new URL("./pythia-worker.js", import.meta.url), "utf8");
const performBounceRender = new Function(
  "window",
  `${workerSource}; return performBounceRender;`
)({});

const sampleRate = 1000;
const length = sampleRate * 2;
const source = new Float32Array(length);
source[100] = 1;
const control = new Float32Array(length);
const gapMap = {
  schema: "hindcasts.gap-map",
  version: 1,
  sampleRate,
  durationSamples: length,
  floorDbfs: -84,
  analysis: { windowSamples: 64, hopSamples: 10, releaseDropDb: 24, releaseHoldMs: 80 },
  events: [
    { onsetSample: 100, releaseSample: 120, eventRmsPeakDbfs: 0, nextOnsetSample: 500, nextOnsetRmsDbfs: 0, interOnsetSamples: 400, silenceGapSamples: 380, confidence: 1 },
    { onsetSample: 500, releaseSample: 520, eventRmsPeakDbfs: 0, nextOnsetSample: null, nextOnsetRmsDbfs: null, interOnsetSamples: null, silenceGapSamples: null, confidence: 1 },
  ],
};

const params = {
  sidechainLookahead: 0, threshold: 0.1, polarity: 0,
  grainSize: 100, grainDensity: 20, time: 0.1, bpm: 120,
  mix: 1, scatter: 0, pitch: 0, pitchSpray: 0, panSpray: 0,
  feedback: 0.8, maxRing: 2, gapSpill: -60, maskingCredit: 0,
  damping: 0, feedbackGrain: 0, densityJitter: 0, envelopeShape: 0.5,
};

const base = {
  controlChannels: [control], controlSampleRate: sampleRate,
  sourceChannels: [source], sourceSampleRate: sampleRate,
  params, gateEnabled: false, loopClip: false, windowType: "linear",
  pingPong: false, sourceDry: false, monitorControl: false,
  controlRmsEnvelope: [], gapMap,
};

const ordinary = performBounceRender({ ...base, gapFitEnabled: false });
const fitted = performBounceRender({ ...base, gapFitEnabled: true });
assert.equal(fitted.gapFitEvents, 2, "Gap Fit consumes both map events");
assert.equal(ordinary.gapFitEvents, 0, "ordinary feedback remains on the legacy renderer");

const sample = (result, time, channel = 0) => {
  const channels = 2;
  const frame = Math.round((time - result.start) * sampleRate);
  return new DataView(result.wavBuffer).getFloat32(44 + (frame * channels + channel) * 4, true);
};
const ordinaryCollision = Math.abs(sample(ordinary, 0.5));
const fittedCollision = Math.abs(sample(fitted, 0.5));
assert.ok(ordinaryCollision > 0.2, "ordinary repeat is still loud at the protected onset");
assert.ok(fittedCollision < ordinaryCollision * 0.02, "Gap Fit steepens the event train before the protected onset");

const noRing = performBounceRender({
  ...base,
  gapFitEnabled: true,
  params: { ...params, maxRing: 0 },
});
assert.ok(Math.abs(sample(noRing, 0.3)) < 1e-8, "Maximum Ring zero removes regenerated passes");

const negativeSource = new Float32Array(length);
negativeSource[900] = 1;
const negativeMap = {
  ...gapMap,
  events: [
    { onsetSample: 500, releaseSample: 520, eventRmsPeakDbfs: 0, nextOnsetSample: 900, nextOnsetRmsDbfs: 0, interOnsetSamples: 400, silenceGapSamples: 380, confidence: 1 },
    { onsetSample: 900, releaseSample: 920, eventRmsPeakDbfs: 0, nextOnsetSample: null, nextOnsetRmsDbfs: null, interOnsetSamples: null, silenceGapSamples: null, confidence: 1 },
  ],
};
const negativeBase = {
  ...base,
  sourceChannels: [negativeSource],
  gapMap: negativeMap,
  params: { ...params, time: -0.1 },
};
const ordinaryNegative = performBounceRender({ ...negativeBase, gapFitEnabled: false });
const fittedNegative = performBounceRender({ ...negativeBase, gapFitEnabled: true });
assert.ok(Math.abs(sample(ordinaryNegative, 0.5)) > 0.2, "ordinary anticipatory train crosses the preceding event");
assert.ok(
  Math.abs(sample(fittedNegative, 0.5)) < Math.abs(sample(ordinaryNegative, 0.5)) * 0.02,
  "negative Gap Fit uses the preceding gap"
);

console.log("Pythia Gap Fit tests passed");
