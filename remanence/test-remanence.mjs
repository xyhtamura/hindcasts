import assert from "node:assert/strict";
import crypto from "node:crypto";
import RemanenceDSP from "./engine.js";

const {
  defaultParams,
  validateParams,
  PRESETS,
  renderAudio,
  renderVideo,
  encodeWav
} = RemanenceDSP;

function sha256(data) {
  const hash = crypto.createHash("sha256");
  if (data instanceof ArrayBuffer) {
    hash.update(Buffer.from(data));
  } else if (ArrayBuffer.isView(data)) {
    hash.update(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
  } else if (Array.isArray(data)) {
    for (const item of data) {
      if (ArrayBuffer.isView(item)) {
        hash.update(Buffer.from(item.buffer, item.byteOffset, item.byteLength));
      }
    }
  }
  return hash.digest("hex");
}

console.log("Starting Remanence engine tests...");

// --- 1. Audio Processing Tests ---
const sr = 22050;
const dur = 0.5; // 0.5s = 11025 samples
const N = Math.round(sr * dur);
const ch0 = new Float32Array(N);
const ch1 = new Float32Array(N);

for (let i = 0; i < N; i++) {
  const t = i / sr;
  // Transient clicks plus tone burst
  const pulse = (i % 2205 === 0) ? 0.8 : 0;
  const tone = Math.sin(2 * Math.PI * 440 * t) * Math.exp(-((t % 0.1) * 30));
  ch0[i] = pulse + tone * 0.5;
  ch1[i] = (pulse ? -0.7 : 0) + tone * 0.4;
}

// 1.1 Default audio render
const audioRes1 = await renderAudio([ch0, ch1], sr);
assert.equal(audioRes1.channels.length, 2, "stereo channels preserved");
assert.equal(audioRes1.channels[0].length, N, "output sample count matches input");
assert.equal(audioRes1.channels[1].length, N, "output sample count matches input");
assert.equal(audioRes1.sampleRate, sr, "sample rate preserved");

// Verify all samples are finite
for (let c = 0; c < 2; c++) {
  for (let i = 0; i < N; i++) {
    assert.ok(Number.isFinite(audioRes1.channels[c][i]), `sample ${i} in ch ${c} must be finite`);
  }
}

// 1.2 Determinism check
const audioRes2 = await renderAudio([ch0, ch1], sr);
const hash1 = sha256(audioRes1.channels);
const hash2 = sha256(audioRes2.channels);
assert.equal(hash1, hash2, "Audio processing must be 100% bit-exact deterministic");

// 1.3 Audio with complex fold, wear, flow, and tracking (Cartridge preset with loop)
const cartridgeRes = await renderAudio([ch0, ch1], sr, PRESETS.cartridge);
assert.equal(cartridgeRes.channels[0].length, N);
assert.ok(cartridgeRes.wearMap !== null, "wearMap should be computed when wear > 0");
assert.ok(cartridgeRes.flowMap !== null, "flowMap should be computed when flow > 0");
assert.equal(cartridgeRes.params.loop, 1, "cartridge preset uses loop: 1");

// 1.4 Audio WAV encoding
const wavBuffer = encodeWav(audioRes1.channels, sr);
assert.equal(wavBuffer.byteLength, 44 + N * 2 * 2, "WAV buffer byte length matches 16-bit stereo");
const wavView = new DataView(wavBuffer);
const riff = String.fromCharCode(wavView.getUint8(0), wavView.getUint8(1), wavView.getUint8(2), wavView.getUint8(3));
assert.equal(riff, "RIFF", "RIFF identifier present");
const wave = String.fromCharCode(wavView.getUint8(8), wavView.getUint8(9), wavView.getUint8(10), wavView.getUint8(11));
assert.equal(wave, "WAVE", "WAVE identifier present");
assert.equal(wavView.getUint32(24, true), sr, "sample rate matches in header");

// --- 2. Video Processing Tests ---
const vW = 32, vH = 24, vFps = 15, vN = 10;
const frames = new Array(vN);

for (let n = 0; n < vN; n++) {
  const f = new Uint8ClampedArray(vW * vH * 4);
  for (let y = 0; y < vH; y++) {
    for (let x = 0; x < vW; x++) {
      const idx = (y * vW + x) * 4;
      // Moving dot + gradient
      const isDot = (Math.abs(x - (n * 3) % vW) < 2 && Math.abs(y - 12) < 2);
      f[idx] = isDot ? 240 : (x * 7) & 0xff;     // R
      f[idx + 1] = isDot ? 50 : (y * 9) & 0xff; // G
      f[idx + 2] = isDot ? 180 : 100;           // B
      f[idx + 3] = 255;                         // A
    }
  }
  frames[n] = f;
}

// 2.1 Default video render
const videoRes1 = await renderVideo(frames, vW, vH, vFps);
assert.equal(videoRes1.frames.length, vN, "video frame count preserved");
assert.equal(videoRes1.width, vW, "frame width matches");
assert.equal(videoRes1.height, vH, "frame height matches");
assert.equal(videoRes1.fps, vFps, "fps matches");
assert.equal(videoRes1.frames[0].length, vW * vH * 4, "frame buffer size matches RGBA");

// Alpha channel must be 255 on all pixels
for (let n = 0; n < vN; n++) {
  const outF = videoRes1.frames[n];
  for (let p = 3; p < outF.length; p += 4) {
    assert.equal(outF[p], 255, `alpha channel must remain 255 at pixel index ${p}`);
  }
}

// 2.2 Video determinism
const videoRes2 = await renderVideo(frames, vW, vH, vFps);
const vHash1 = sha256(videoRes1.frames);
const vHash2 = sha256(videoRes2.frames);
assert.equal(vHash1, vHash2, "Video processing must be 100% bit-exact deterministic");

// 2.3 Video with wear, tracking seam, fold, and circle loop
const videoFoldRes = await renderVideo(frames, vW, vH, vFps, PRESETS.fold);
assert.equal(videoFoldRes.frames.length, vN);
assert.ok(videoFoldRes.wearMap !== null, "video wear map generated");
assert.ok(videoFoldRes.flowMap !== null, "video flow map generated");

console.log("PASS: Remanence audio and video engine tests succeeded.");
console.log(JSON.stringify({
  audioSamples: N,
  audioHash: hash1,
  wavBytes: wavBuffer.byteLength,
  videoFrames: vN,
  videoHash: vHash1,
  presetsChecked: Object.keys(PRESETS).length
}, null, 2));
