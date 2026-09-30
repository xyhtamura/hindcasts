// Proteus DSP engine: spectral morphing with peak-region transport and waveform crossfade.
// Pure calculation module: no DOM, AudioContext, or UI dependencies.
(function(root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ProteusDSP = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  "use strict";

  const TAU = 2 * Math.PI;

  function fft(re, im, inverse) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (inverse ? 2 : -2) * Math.PI / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      const half = len >> 1;
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < half; k++) {
          const a = i + k, b = i + k + half;
          const vr = re[b] * cr - im[b] * ci, vi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - vr; im[b] = im[a] - vi;
          re[a] += vr; im[a] += vi;
          const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
    if (inverse) {
      for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
    }
  }

  const princ = a => a - TAU * Math.round(a / TAU);

  function hann(N) {
    const w = new Float32Array(N);
    for (let n = 0; n < N; n++) w[n] = 0.5 - 0.5 * Math.cos(TAU * n / N);
    return w;
  }

  function stft(x, N, hop, win) {
    // Pre-roll and zero-padding keep every real sample inside full overlap.
    const pad = N - hop;
    const F = Math.max(1, Math.ceil((x.length + pad) / hop));
    const K = N / 2 + 1;
    const mag = [], phase = [];
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let f = 0; f < F; f++) {
      const off = f * hop - pad;
      for (let n = 0; n < N; n++) { re[n] = (x[off + n] ?? 0) * win[n]; im[n] = 0; }
      fft(re, im, false);
      const m = new Float32Array(K), p = new Float32Array(K);
      for (let k = 0; k < K; k++) { m[k] = Math.hypot(re[k], im[k]); p[k] = Math.atan2(im[k], re[k]); }
      mag.push(m); phase.push(p);
    }
    const adv = [];
    for (let f = 0; f < F; f++) {
      const a = new Float32Array(K);
      for (let k = 0; k < K; k++) {
        const omega = TAU * k / N * hop;
        a[k] = f === 0 ? omega : omega + princ(phase[f][k] - phase[f - 1][k] - omega);
      }
      adv.push(a);
    }
    return { mag, phase, adv, F, K, N, hop, pad };
  }

  function otMag(a, b, t, out) {
    const K = a.length;
    out.fill(0);
    let Ea = 0, Eb = 0;
    for (let k = 0; k < K; k++) { Ea += a[k]; Eb += b[k]; }
    const Et = (1 - t) * Ea + t * Eb;
    if (Ea <= 1e-12 && Eb <= 1e-12) return out;
    if (Eb <= 1e-12) { const s = Et / Ea; for (let k = 0; k < K; k++) out[k] = a[k] * s; return out; }
    if (Ea <= 1e-12) { const s = Et / Eb; for (let k = 0; k < K; k++) out[k] = b[k] * s; return out; }
    let i = 0, j = 0, ra = a[0] / Ea, rb = b[0] / Eb; const eps = 1e-12;
    while (i < K && j < K) {
      const m = Math.min(ra, rb);
      out[Math.round((1 - t) * i + t * j)] += m;
      ra -= m; rb -= m;
      if (ra <= eps) { i++; if (i < K) ra = a[i] / Ea; }
      if (rb <= eps) { j++; if (j < K) rb = b[j] / Eb; }
    }
    for (let k = 0; k < K; k++) out[k] *= Et;
    return out;
  }

  // Valley-bounded peak regions retain each peak's spectral lobe and relative phase.
  function peakRegions(mag) {
    let total = 0, max = 0;
    for (const v of mag) { total += v; max = Math.max(max, v); }
    if (total <= 1e-12) return { regions: [], total };
    const peaks = [];
    for (let k = 0; k < mag.length; k++) {
      if (mag[k] > max * 1e-5 && (k === 0 || mag[k] > mag[k - 1]) &&
        (k === mag.length - 1 || mag[k] >= mag[k + 1])) peaks.push(k);
    }
    const regions = []; let start = 0;
    for (let p = 0; p < peaks.length; p++) {
      let end = mag.length;
      if (p + 1 < peaks.length) {
        let valley = peaks[p] + 1;
        for (let k = valley + 1; k < peaks[p + 1]; k++) if (mag[k] < mag[valley]) valley = k;
        end = valley;
      }
      let mass = 0; for (let k = start; k < end; k++) mass += mag[k];
      regions.push({ peak: peaks[p], start, end, mass }); start = end;
    }
    return { regions, total };
  }

  function peakTransport(A, B, f, bf, t, previous, re, im) {
    const a = peakRegions(A.mag[f]), b = peakRegions(B.mag[bf]);
    re.fill(0); im.fill(0);
    if (!a.regions.length || !b.regions.length) {
      // Silence has no peak correspondence: attenuate the available complex spectrum.
      const X = a.regions.length ? A : B, frame = a.regions.length ? f : bf, g = a.regions.length ? 1 - t : t;
      for (let k = 0; k < A.K; k++) { re[k] = g * X.mag[frame][k] * Math.cos(X.phase[frame][k]); im[k] = g * X.mag[frame][k] * Math.sin(X.phase[frame][k]); }
      return [];
    }
    const tracks = [], total = (1 - t) * a.total + t * b.total;
    let i = 0, j = 0, ra = a.regions[0].mass / a.total, rb = b.regions[0].mass / b.total, prevIndex = 0;
    while (i < a.regions.length && j < b.regions.length) {
      const ar = a.regions[i], br = b.regions[j], mass = Math.min(ra, rb);
      const omega = (1 - t) * A.adv[f][ar.peak] + t * B.adv[bf][br.peak];
      const dest = Math.round((1 - t) * ar.peak + t * br.peak);
      const distance = p => Math.abs(p.a - ar.peak) + Math.abs(p.b - br.peak);
      while (prevIndex + 1 < previous.length && distance(previous[prevIndex + 1]) < distance(previous[prevIndex])) prevIndex++;
      const old = previous[prevIndex];
      const phase = old && distance(old) <= 4 ? old.phase + omega :
        A.phase[f][ar.peak] + t * princ(B.phase[bf][br.peak] - A.phase[f][ar.peak]);
      tracks.push({ a: ar.peak, b: br.peak, phase: princ(phase), omega });
      const deposit = (X, frame, r, weight) => {
        const g = total * mass * weight / r.mass;
        for (let k = r.start; k < r.end; k++) {
          const target = dest + k - r.peak;
          if (target < 0 || target >= A.K) continue;
          const phi = phase + princ(X.phase[frame][k] - X.phase[frame][r.peak]);
          const amplitude = g * X.mag[frame][k];
          re[target] += amplitude * Math.cos(phi); im[target] += amplitude * Math.sin(phi);
        }
      };
      if (mass > 0) { deposit(A, f, ar, 1 - t); deposit(B, bf, br, t); }
      ra -= mass; rb -= mass;
      if (ra <= 1e-12) { i++; if (i < a.regions.length) ra = a.regions[i].mass / a.total; }
      if (rb <= 1e-12) { j++; if (j < b.regions.length) rb = b.regions[j].mass / b.total; }
    }
    return tracks;
  }

  function morphChannel(aData, bData, opts) {
    const { N, hop, win, curveAt, bOffsetSamples, tf, edgeFadeSamples = 0 } = opts;
    const amountAt = n => {
      const bn = n - bOffsetSamples;
      if (bn < 0 || bn >= bData.length) return 0;
      let m = Math.min(1, Math.max(0, curveAt(aData.length > 1 ? n / (aData.length - 1) : 0)));
      const fade = Math.min(edgeFadeSamples, (bData.length - 1) / 2);
      if (fade > 0) m *= Math.sin(Math.min(1, bn / fade, (bData.length - 1 - bn) / fade) * Math.PI / 2);
      return m;
    };
    const out = new Float32Array(aData.length);
    // Fade is a sample-aligned waveform crossfade, including exact offsets.
    for (let n = 0; n < out.length; n++) {
      const m = amountAt(n), b = bData[n - bOffsetSamples] ?? 0;
      out[n] = (1 - m) * aData[n] + m * b;
    }
    if (tf === 0 || !out.length) return out;
    const A = stft(aData, N, hop, win);
    const B = stft(bData, N, hop, win);
    const K = A.K, F = A.F;
    const bOffFrames = bOffsetSamples / hop;
    const outLen = (F - 1) * hop + N;
    const outAcc = new Float64Array(outLen), winAcc = new Float64Array(outLen);
    const re = new Float64Array(N), im = new Float64Array(N);
    let tracks = [];

    for (let f = 0; f < F; f++) {
      const center = Math.max(0, Math.min(aData.length - 1, f * hop - A.pad + N / 2));
      const bf = Math.round(f - bOffFrames);
      const bIn = bf >= 0 && bf < B.F;
      const m_eff = bIn ? amountAt(center) : 0;
      if (m_eff === 0 || m_eff === 1) {
        const X = m_eff === 1 ? B : A, frame = m_eff === 1 ? bf : f;
        re.fill(0); im.fill(0); tracks = [];
        for (let k = 0; k < K; k++) { re[k] = X.mag[frame][k] * Math.cos(X.phase[frame][k]); im[k] = X.mag[frame][k] * Math.sin(X.phase[frame][k]); }
      } else {
        tracks = peakTransport(A, B, f, bf, m_eff, tracks, re, im);
      }
      im[0] = 0; im[K - 1] = 0;
      for (let k = 1; k < K - 1; k++) { re[N - k] = re[k]; im[N - k] = -im[k]; }
      fft(re, im, true);
      const off = f * hop;
      for (let n = 0; n < N; n++) { const w = win[n]; outAcc[off + n] += re[n] * w; winAcc[off + n] += w * w; }
    }
    // Real samples have full overlap after pre-roll, so normalization is safe.
    for (let n = 0; n < out.length; n++) {
      const m = amountAt(n);
      if (m === 0 || m === 1) continue; // Preserve the exact input waveform at endpoints.
      const i = n + A.pad;
      out[n] = (1 - tf) * out[n] + tf * outAcc[i] / winAcc[i];
    }
    return out;
  }

  function curveFromPoints(points) {
    if (!points || !points.length) return () => 0.5;
    const p = points.slice().sort((a, b) => a.t - b.t);
    return function(x01) {
      if (x01 <= p[0].t) return p[0].m;
      if (x01 >= p[p.length - 1].t) return p[p.length - 1].m;
      for (let i = 1; i < p.length; i++) {
        if (x01 <= p[i].t) {
          const a = p[i - 1], b = p[i], f = (x01 - a.t) / (b.t - a.t || 1);
          return a.m + (b.m - a.m) * f;
        }
      }
      return p[p.length - 1].m;
    };
  }

  function defaultParams() {
    return {
      fftSize: 2048,
      tf: 1.0,
      bOffset: 0, // in seconds
      bOffsetSamples: 0,
      edgeFade: 0.1, // in seconds
      edgeFadeSamples: 0,
      stereoMode: "perch", // "perch" | "mono"
      curve: [{ t: 0, m: 0 }, { t: 0.5, m: 0.5 }, { t: 1, m: 1 }]
    };
  }

  function validateParams(params = {}, sampleRate = 44100) {
    const d = defaultParams();
    const p = { ...d, ...params };
    const fftSize = [1024, 2048, 4096, 8192].includes(p.fftSize) ? p.fftSize : d.fftSize;
    const tf = Number.isFinite(p.tf) ? Math.max(0, Math.min(1, p.tf)) : d.tf;
    const bOffset = Number.isFinite(p.bOffset) ? p.bOffset : 0;
    const bOffsetSamples = Number.isFinite(p.bOffsetSamples) ? Math.round(p.bOffsetSamples) : Math.round(bOffset * sampleRate);
    const edgeFade = Number.isFinite(p.edgeFade) ? Math.max(0, p.edgeFade) : d.edgeFade;
    const edgeFadeSamples = Number.isFinite(p.edgeFadeSamples) ? Math.round(p.edgeFadeSamples) : Math.round(edgeFade * sampleRate);
    const stereoMode = ["perch", "mono"].includes(p.stereoMode) ? p.stereoMode : "perch";
    let curveAt;
    if (typeof p.curveAt === "function") {
      curveAt = p.curveAt;
    } else if (Array.isArray(p.curve)) {
      curveAt = curveFromPoints(p.curve);
    } else {
      curveAt = curveFromPoints(d.curve);
    }
    return {
      fftSize,
      tf,
      bOffset,
      bOffsetSamples,
      edgeFade,
      edgeFadeSamples,
      stereoMode,
      curveAt,
      curve: Array.isArray(p.curve) ? p.curve : d.curve
    };
  }

  function toMono(input) {
    if (!input) return new Float32Array(0);
    if (typeof input.getChannelData === "function") {
      if (input.numberOfChannels === 1) return input.getChannelData(0);
      const L = input.getChannelData(0), R = input.getChannelData(1), o = new Float32Array(L.length);
      for (let n = 0; n < L.length; n++) o[n] = 0.5 * (L[n] + R[n]);
      return o;
    }
    if (Array.isArray(input)) {
      if (input.length === 1) return input[0];
      const L = input[0], R = input[1], o = new Float32Array(L.length);
      for (let n = 0; n < L.length; n++) o[n] = 0.5 * (L[n] + R[n]);
      return o;
    }
    return input;
  }

  function render(channelsA, channelsB, sampleRate, userOpts = {}) {
    const opts = validateParams(userOpts, sampleRate);
    const N = opts.fftSize, hop = N / 4, win = hann(N);
    const channelOpts = {
      N,
      hop,
      win,
      curveAt: opts.curveAt,
      bOffsetSamples: opts.bOffsetSamples,
      tf: opts.tf,
      edgeFadeSamples: opts.edgeFadeSamples
    };
    const perch = opts.stereoMode === "perch" && channelsA.length > 1 && channelsB.length > 1;
    let chans;
    if (perch) {
      chans = [
        morphChannel(channelsA[0], channelsB[0], channelOpts),
        morphChannel(channelsA[1], channelsB[1], channelOpts)
      ];
    } else {
      chans = [
        morphChannel(toMono(channelsA), toMono(channelsB), channelOpts)
      ];
    }
    let peak = 0;
    chans.forEach(c => {
      for (let n = 0; n < c.length; n++) {
        const a = Math.abs(c[n]);
        if (a > peak) peak = a;
      }
    });
    const g = peak > 1e-6 ? Math.min(1, 0.891 / peak) : 1;
    if (g < 1) {
      chans.forEach(c => {
        for (let n = 0; n < c.length; n++) c[n] *= g;
      });
    }
    return {
      channels: chans,
      sampleRate,
      peak,
      gain: g,
      opts
    };
  }

  function bucketPeaks(data, res) {
    const mn = new Float32Array(res), mx = new Float32Array(res), step = data.length / res;
    for (let i = 0; i < res; i++) {
      let a = 1, b = -1; const s0 = Math.floor(i * step), s1 = Math.max(s0 + 1, Math.floor((i + 1) * step));
      for (let n = s0; n < s1; n++) { const v = data[n]; if (v < a) a = v; if (v > b) b = v; }
      mn[i] = a; mx[i] = b;
    }
    return { mn, mx, res };
  }

  const ProteusDSP = Object.freeze({
    TAU,
    fft,
    princ,
    hann,
    stft,
    otMag,
    peakRegions,
    peakTransport,
    morphChannel,
    curveFromPoints,
    defaultParams,
    validateParams,
    toMono,
    render,
    bucketPeaks
  });

  return ProteusDSP;
});
