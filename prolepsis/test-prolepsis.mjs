import assert from "node:assert/strict";
import ProlepsisDSP from "./engine.js";

const {
  defaultParams,
  PRESETS,
  validateParams,
  buildMaskData,
  computeTransientsFromData,
  meanLumaFromData
} = ProlepsisDSP;

console.log("Starting Prolepsis engine unit tests...");

// --- 1. Parameter Validation & Presets ---
const defaultP = validateParams();
assert.equal(defaultP.mode, "symmetric");
assert.equal(defaultP.balance, 0.5);
assert.equal(defaultP.memoryDecay, 0.985);
assert.equal(defaultP.deposit, 0.06);

// Presets check
assert.equal(Object.keys(PRESETS).length, 13);
for (const [name, p] of Object.entries(PRESETS)) {
  const validated = validateParams(p);
  assert.ok(["wake", "anticipation", "symmetric"].includes(validated.mode), `preset ${name} has valid mode`);
  assert.ok(validated.memoryDecay >= 0.85 && validated.memoryDecay <= 0.999);
  assert.ok(validated.zoom >= 0.96 && validated.zoom <= 1.04);
}

// --- 2. Inscription Mask Mathematics ---
const w = 16, h = 16;
const rawPixels = new Uint8ClampedArray(w * h * 4);
// Make left half dark, right half bright -> strong vertical edge down the center
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const idx = (y * w + x) * 4;
    const isBright = x >= 8;
    rawPixels[idx] = isBright ? 240 : 10;
    rawPixels[idx + 1] = isBright ? 240 : 10;
    rawPixels[idx + 2] = isBright ? 240 : 10;
    rawPixels[idx + 3] = 255;
  }
}

const maskOutput = buildMaskData(rawPixels, w, h, defaultParams);
assert.equal(maskOutput.length, w * h * 4);

// Check that center edge (x=7, x=8) has higher alpha than flat areas (x=2, x=13)
const edgeAlpha = maskOutput[(8 * w + 8) * 4 + 3];
const flatDarkAlpha = maskOutput[(8 * w + 2) * 4 + 3];
const flatBrightAlpha = maskOutput[(8 * w + 14) * 4 + 3];

assert.ok(edgeAlpha > flatDarkAlpha, "Edge pixels must have higher inscription alpha than dark flat pixels");
// Check RGB channels in inner mask are 255
for (let y = 1; y < h - 1; y++) {
  for (let x = 1; x < w - 1; x++) {
    const idx = (y * w + x) * 4;
    assert.equal(maskOutput[idx], 255);
    assert.equal(maskOutput[idx + 1], 255);
    assert.equal(maskOutput[idx + 2], 255);
  }
}

// --- 3. Transient Curve Analysis ---
const N = 6;
const seq = [];
for (let i = 0; i < N; i++) {
  const f = new Uint8ClampedArray(w * h * 4);
  // Frame 3 has a high-energy flash
  const val = (i === 3) ? 255 : 20;
  f.fill(val);
  seq.push(f);
}

const transients = computeTransientsFromData(seq, w, h);
assert.equal(transients.length, N);
assert.equal(transients[0], 0, "first frame has 0 delta");
// Frame 3 is the flash onset, so it must be peak 1.0
assert.equal(transients[3], 1.0, "frame 3 must be normalized peak 1.0");

// --- 4. Mean Luminance Measurement ---
const pureRed = new Uint8ClampedArray(4 * 4 * 4);
for (let i = 0; i < pureRed.length; i += 4) {
  pureRed[i] = 255;   // R
  pureRed[i + 1] = 0; // G
  pureRed[i + 2] = 0; // B
  pureRed[i + 3] = 255;
}
const redLuma = meanLumaFromData(pureRed);
// Expected: 255 * 0.2126 = 54.213
assert.ok(Math.abs(redLuma - 54.213) < 0.1, "Luminance calculation matches ITU-R BT.709 weights");

console.log("PASS: Prolepsis engine unit tests succeeded.");
console.log(JSON.stringify({
  presets: Object.keys(PRESETS).length,
  maskAlphaAtEdge: edgeAlpha,
  maskAlphaFlatDark: flatDarkAlpha,
  transientPeakFrame: 3,
  redLuma
}, null, 2));
