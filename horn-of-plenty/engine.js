// Horn of Plenty DSP engine: audio texture stationarizer.
// Pure calculation module: no DOM, AudioContext, or UI dependencies.
(function(root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HornOfPlentyDSP = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  "use strict";

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  const PRESETS = Object.freeze({
    mist: { fiber: 25, white: 85, dens: 8, even: 95, pitch: 1.5, rev: 20, spread: 55 },
    sand: { fiber: 45, white: 70, dens: 6.5, even: 90, pitch: 0.5, rev: 15, spread: 40 },
    orchard: { fiber: 90, white: 50, dens: 5, even: 80, pitch: 3, rev: 35, spread: 50 },
    husk: { fiber: 160, white: 25, dens: 4, even: 65, pitch: 0, rev: 10, spread: 25 }
  });

  function defaultParams() {
    return {
      fiber: 80, // ms (15..300)
      white: 55, // % (0..100)
      len: 20, // seconds (1..60)
      dens: 5, // overlap density (1..12)
      even: 85, // % flattening evenness (0..100)
      pitch: 0, // semitones jitter (0..12)
      rev: 0, // % reverse chance (0..100)
      spread: 35, // % stereo width (0..100)
      lvlOwn: true, // match own average (-1 dBFS peak)
      level: -14 // fixed loudness target in dB (-36..0)
    };
  }

  function validateParams(params = {}) {
    const d = defaultParams();
    const p = { ...d, ...params };
    return {
      fiber: Number.isFinite(p.fiber) ? clamp(p.fiber, 15, 300) : d.fiber,
      white: Number.isFinite(p.white) ? clamp(p.white, 0, 100) : d.white,
      len: Number.isFinite(p.len) ? Math.max(0.1, p.len) : d.len,
      dens: Number.isFinite(p.dens) ? clamp(p.dens, 1, 12) : d.dens,
      even: Number.isFinite(p.even) ? clamp(p.even, 0, 100) : d.even,
      pitch: Number.isFinite(p.pitch) ? clamp(p.pitch, 0, 12) : d.pitch,
      rev: Number.isFinite(p.rev) ? clamp(p.rev, 0, 100) : d.rev,
      spread: Number.isFinite(p.spread) ? clamp(p.spread, 0, 100) : d.spread,
      lvlOwn: typeof p.lvlOwn === "boolean" ? p.lvlOwn : d.lvlOwn,
      level: Number.isFinite(p.level) ? clamp(p.level, -36, 0) : d.level
    };
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function toMono(input) {
    if (!input) return new Float32Array(0);
    if (typeof input.getChannelData === "function") {
      const ch = input.numberOfChannels, n = input.length, out = new Float32Array(n);
      for (let c = 0; c < ch; c++) {
        const d = input.getChannelData(c);
        for (let i = 0; i < n; i++) out[i] += d[i] / ch;
      }
      return out;
    }
    if (Array.isArray(input)) {
      if (input.length === 1) return input[0];
      const ch = input.length, n = input[0].length, out = new Float32Array(n);
      for (let c = 0; c < ch; c++) {
        const d = input[c];
        for (let i = 0; i < n; i++) out[i] += d[i] / ch;
      }
      return out;
    }
    return input;
  }

  function analyzeGrains(source, sampleRate, params = {}) {
    const src = toMono(source);
    const p = validateParams(params);
    const sr = sampleRate;
    const gLen = Math.max(64, Math.round((p.fiber / 1000) * sr));
    const hop = Math.max(1, Math.round(gLen / 2));
    const cand = [];

    for (let s = 0; s + gLen <= src.length; s += hop) {
      let e = 0, zc = 0, prev = src[s];
      for (let i = 0; i < gLen; i++) {
        const v = src[s + i];
        e += v * v;
        if ((v >= 0) !== (prev >= 0)) zc++;
        prev = v;
      }
      cand.push({ start: s, power: e / gLen, bright: zc / gLen }); // bright = zero-crossing rate proxy
    }

    if (!cand.length) return { grains: [], gLen, hop, fiber: p.fiber };

    const ps = cand.map(c => c.power).sort((a, b) => a - b);
    const loudRef = ps[Math.floor(ps.length * 0.90)] || ps[ps.length - 1];
    let kept = cand.filter(c => c.power >= loudRef * 0.016 && c.power > 0);
    if (kept.length < Math.min(24, cand.length)) {
      kept = cand.filter(c => c.power > 0).sort((a, b) => b.power - a.power).slice(0, Math.min(48, cand.length));
    }

    let bmin = Infinity, bmax = -Infinity;
    kept.forEach(g => {
      if (g.bright < bmin) bmin = g.bright;
      if (g.bright > bmax) bmax = g.bright;
    });
    const span = (bmax - bmin) || 1;
    kept.forEach(g => { g.bn = (g.bright - bmin) / span; });

    return { grains: kept, gLen, hop, fiber: p.fiber };
  }

  function suggestFiber(source, sampleRate) {
    const src = toMono(source);
    const sr = sampleRate;
    const fh = Math.max(1, Math.round(sr * 0.005)), nf = Math.floor(src.length / fh);
    if (nf < 2) return 80;
    const env = new Float32Array(nf);
    for (let f = 0; f < nf; f++) {
      let e = 0;
      for (let i = 0; i < fh; i++) {
        const v = src[f * fh + i];
        e += v * v;
      }
      env[f] = Math.sqrt(e / fh);
    }
    let mean = 0;
    for (let f = 0; f < nf; f++) mean += env[f];
    mean /= nf;
    for (let f = 0; f < nf; f++) env[f] -= mean;
    let r0 = 0;
    for (let f = 0; f < nf; f++) r0 += env[f] * env[f];
    if (r0 <= 0) return 80;
    const maxLag = Math.min(nf - 1, 60);
    let lag = 16;
    for (let L = 1; L <= maxLag; L++) {
      let r = 0;
      for (let f = 0; f + L < nf; f++) r += env[f] * env[f + L];
      if (r < r0 * 0.3678) { lag = L; break; }
    }
    return clamp(Math.round(lag * 5), 15, 300);
  }

  function movRMSpow(pow, len, win) {
    const ps = new Float64Array(len + 1);
    for (let i = 0; i < len; i++) ps[i + 1] = ps[i] + pow[i];
    const half = win >> 1, out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const a = Math.max(0, i - half), b = Math.min(len, i + half + 1);
      out[i] = Math.sqrt((ps[b] - ps[a]) / (b - a));
    }
    return out;
  }

  function sowAndFlatten(source, sampleRate, grains, userParams = {}, randomSource = Math.random) {
    const src = toMono(source);
    const sr = sampleRate;
    const P = validateParams(userParams);

    if (!grains || !grains.length) {
      throw new Error("No grains available to sow. Provide grains or run analyzeGrains first.");
    }

    const gLen = Math.max(64, Math.round((P.fiber / 1000) * sr));
    const outLen = Math.round(P.len * sr);
    const total = outLen + gLen;
    const L = new Float32Array(total), R = new Float32Array(total);
    const win = new Float32Array(gLen);
    for (let i = 0; i < gLen; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (gLen - 1));

    const hopOut = Math.max(1, Math.round(gLen / P.dens));
    const nOn = Math.ceil(outLen / hopOut) + 1;
    const w = P.white / 100;
    const jit = hopOut * (0.22 + 0.5 * w);
    const maxRecent = clamp(Math.round(grains.length * (0.12 + 0.6 * w)), 1, Math.max(1, grains.length - 1));
    const recent = [];
    const pjit = P.pitch;
    const revP = P.rev / 100;
    const spread = P.spread / 100;

    const prng = typeof randomSource === "number" ? mulberry32(randomSource) :
      (typeof randomSource === "function" ? randomSource : Math.random);
    const rnd = (a, b) => a + prng() * (b - a);

    function pick() {
      for (let t = 0; t < 14; t++) {
        const i = (prng() * grains.length) | 0;
        if (recent.indexOf(i) === -1) {
          recent.push(i);
          if (recent.length > maxRecent) recent.shift();
          return i;
        }
      }
      const i = (prng() * grains.length) | 0;
      recent.push(i);
      if (recent.length > maxRecent) recent.shift();
      return i;
    }

    for (let k = 0; k < nOn; k++) {
      let pos = Math.round(k * hopOut + rnd(-jit, jit));
      if (pos < 0) pos = 0;
      if (pos >= outLen) continue;
      const g = grains[pick()], base = g.start;
      const rev = revP > 0 && prng() < revP;
      const ratio = pjit > 0 ? Math.pow(2, rnd(-pjit, pjit) / 12) : 1;
      const pan = (prng() * 2 - 1) * spread, ang = (pan + 1) * Math.PI / 4;
      const gL = Math.cos(ang), gR = Math.sin(ang);
      for (let i = 0; i < gLen; i++) {
        const oi = pos + i;
        if (oi >= total) break;
        const sp = rev ? base + (gLen - 1 - i) * ratio : base + i * ratio;
        const i0 = sp | 0, fr = sp - i0;
        if (i0 < 0 || i0 + 1 >= src.length) continue;
        const s = (src[i0] * (1 - fr) + src[i0 + 1] * fr) * win[i];
        L[oi] += s * gL;
        R[oi] += s * gR;
      }
    }

    // loudness envelope on total cross-channel power
    const pow = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) pow[i] = L[i] * L[i] + R[i] * R[i];
    const sm = Math.max(gLen * 3, Math.round(sr * 0.05));
    const env = movRMSpow(pow, outLen, sm);
    let acc = 0;
    for (let i = 0; i < outLen; i++) acc += pow[i];
    const target = Math.sqrt(acc / outLen) || 1e-6;
    const evenness = P.even / 100, mb = Math.pow(10, 9 / 20);
    for (let i = 0; i < outLen; i++) {
      let g = target / Math.max(env[i], 1e-6);
      g = clamp(g, 1 / mb, mb);
      g = Math.pow(g, evenness);
      L[i] *= g;
      R[i] *= g;
    }

    const fz = Math.min(Math.round(sr * 0.004), outLen >> 1);
    for (let i = 0; i < fz; i++) {
      const a = i / fz;
      L[i] *= a;
      R[i] *= a;
      L[outLen - 1 - i] *= a;
      R[outLen - 1 - i] *= a;
    }

    let pk = 0, rms2 = 0;
    for (let i = 0; i < outLen; i++) {
      pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
      rms2 += L[i] * L[i] + R[i] * R[i];
    }
    rms2 = Math.sqrt(rms2 / (2 * outLen)) || 1e-9;
    let norm;
    if (P.lvlOwn) {
      norm = pk > 0 ? Math.pow(10, -1 / 20) / pk : 1; // own average: safe -1 dBFS peak
    } else {
      const tgt = Math.pow(10, P.level / 20); // fixed loudness target (RMS)
      norm = tgt / rms2;
      if (pk * norm > 1) norm = pk > 0 ? 1 / pk : 1; // 0 dBFS hard ceiling guardian
    }

    const outL = new Float32Array(outLen);
    const outR = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      outL[i] = L[i] * norm;
      outR[i] = R[i] * norm;
    }

    const pow2 = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) pow2[i] = outL[i] * outL[i] + outR[i] * outR[i];
    const postEnv = movRMSpow(pow2, outLen, sm);

    return {
      channels: [outL, outR],
      sampleRate: sr,
      outLen,
      duration: outLen / sr,
      peak: pk * norm,
      preNormPeak: pk,
      rms: rms2 * norm,
      norm,
      nPlacements: nOn,
      preEnv: env,
      postEnv,
      params: P
    };
  }

  function render(source, sampleRate, userParams = {}, randomSource) {
    const mono = toMono(source);
    let grains = userParams.grains;
    if (!grains || !grains.length) {
      const analysis = analyzeGrains(mono, sampleRate, userParams);
      grains = analysis.grains;
    }
    return sowAndFlatten(mono, sampleRate, grains, userParams, randomSource);
  }

  function encodeWav(leftChannel, rightChannel, sampleRate) {
    const len = leftChannel.length, ch = 2;
    const ab = new ArrayBuffer(44 + len * ch * 2), v = new DataView(ab);
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, "RIFF");
    v.setUint32(4, 36 + len * ch * 2, true);
    ws(8, "WAVE");
    ws(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, ch, true);
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, sampleRate * ch * 2, true);
    v.setUint16(32, ch * 2, true);
    v.setUint16(34, 16, true);
    ws(36, "data");
    v.setUint32(40, len * ch * 2, true);
    let o = 44;
    for (let i = 0; i < len; i++) {
      let sl = clamp(leftChannel[i], -1, 1);
      let sr = clamp(rightChannel[i], -1, 1);
      v.setInt16(o, sl < 0 ? sl * 32768 : sl * 32767, true);
      v.setInt16(o + 2, sr < 0 ? sr * 32768 : sr * 32767, true);
      o += 4;
    }
    return ab;
  }

  const HornOfPlentyDSP = Object.freeze({
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
  });

  return HornOfPlentyDSP;
});
