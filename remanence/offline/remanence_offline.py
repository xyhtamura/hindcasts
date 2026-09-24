#!/usr/bin/env python3
"""
Offline Remanence: video + audio print-through reel, for any source file.

Generalised from ephemeralrenders/open4-cut/remanence_offline.py (2026-08-05),
which was fixed to one 426x240 cut. The processing is unchanged; the source,
reel folder, frame size, frame rate, damage ramp, and FFmpeg path are now
arguments instead of constants.

Differences from the browser app (all deliberate; see ../remanence.md field notes):
  * frames live in a disk memmap, not RAM, so any length works
  * damage parameters RAMP along the reel; the reel geometry stays fixed
  * ghost taps are normalised by their weight sum, so `print` is a mix level
    rather than an additive pile that white-outs at depth

The Fold tap reads the reel mirror (frame n needs frame N-n), so the whole
source must be extracted before anything renders. That is the `reel` step.

Usage:
  python remanence_offline.py reel  --in master.mkv --reel REELDIR
  python remanence_offline.py video --reel REELDIR --out degraded.mkv
  python remanence_offline.py audio --reel REELDIR --out degraded.wav
  python remanence_offline.py mux   --video degraded.mkv --audio degraded.wav --out final.mkv

  --ramp ramp.json overrides entries of RAMP, e.g. {"print": [0, 0.85, 1.5]}
  --start/--count render a frame range (for probes).
  .mkv video output is lossless FFV1; any other extension is H.264 at --crf.
  REELDIR is disposable: raw frames take width*height*3 bytes each (a 106 s
  960x720 film at 30 fps is 6.6 GB). Delete it when the renders are done.
"""
import numpy as np, math, os, sys, subprocess, argparse, json
from scipy.signal import lfilter
from scipy.ndimage import uniform_filter

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Set from the reel's meta.json by configure(); the functions below read these.
H, W, FPS, SR = 240, 426, 30, 48000
REEL = None
FFMPEG = "ffmpeg"

# ---- fixed reel geometry (app maxima: wrap 400 ms, grow 500 ms) ----
WRAP_S, GROW_S = 0.400, 0.500

# ---- damage ramp: name -> (start, end, curve) ; value = a+(b-a)*u**curve ----
RAMP = {
    'print': (0.00,   0.85, 1.5),
    'depth': (1.00,  18.00, 1.4),
    'wind':  (0.30,  -0.50, 1.2),
    'fold':  (0.00,   0.88, 1.6),
    'wear':  (0.00,   0.72, 2.0),
    'flow':  (0.00,   0.40, 2.0),
    'track': (0.00,   0.55, 2.4),
    'fall':  (0.55,   0.84, 1.0),
    'tilt':  (20000,   700, 1.3),
    'dry':   (1.00,   0.50, 1.8),
}

def par(u):
    return {k: a + (b - a) * (u ** c) for k, (a, b, c) in RAMP.items()}

def par_arr(u):
    return {k: a + (b - a) * (u ** c) for k, (a, b, c) in RAMP.items()}

# ---------------------------------------------------------------- helpers
def box1(src, r, passes=1):
    if r < 1 or src.size < 2: return src.copy()
    a = src.astype(np.float32)
    for _ in range(passes):
        a = uniform_filter(a, size=2 * r + 1, mode='nearest')
    return a

def normalize_map(m, pow_=0.72):
    peak = float(m.max())
    if peak < 1e-9: return m
    return np.clip(m / peak, 0, 1) ** pow_

def geom(N, wrap0, grow):
    slope = grow / max(1, N)
    lin = slope < 1e-9
    O0s = 0.0 if lin else wrap0 / slope
    Etot = 1 + slope * N / wrap0
    return slope, lin, O0s, Etot

def varying_onepole(sig, alpha_arr, chunks=512):
    """one-pole y+=a*(x-y) with a ramping coefficient: lfilter per chunk, state carried.
    lfilter needs constant coefficients, so the ramp is applied stepwise — at 512 chunks
    over 14:35 that is one step per ~1.7 s, well below audibility for a smoothing filter."""
    N = len(sig)
    out = np.empty(N, np.float32)
    zi = np.zeros(1, np.float64)
    edges = np.linspace(0, N, chunks + 1).astype(np.int64)
    for i in range(chunks):
        s, e = edges[i], edges[i + 1]
        if e <= s: continue
        if callable(alpha_arr):      a = float(alpha_arr(s, e))
        elif np.ndim(alpha_arr):     a = float(np.mean(alpha_arr[s:e]))
        else:                        a = float(alpha_arr)
        seg, zi = lfilter([a], [1, -(1 - a)], sig[s:e], zi=zi)
        out[s:e] = seg
    return out

def sample_at(x, pos):
    """linear interp, circle-loop (LOOP>0) — matches app sampleAt with loop on"""
    N = len(x)
    wp = np.mod(pos, N)
    i = wp.astype(np.int64); f = (wp - i).astype(np.float32)
    j = (i + 1) % N
    return x[i] * (1 - f) + x[j] * f

# ---------------------------------------------------------------- video
def video_wear_map(frames, N, depth, fall, wrap0, grow, fold):
    """occupancy (luma+motion) folded through the reel — structural, unramped"""
    cache = os.path.join(REEL, "wearmap.npy")
    if os.path.exists(cache): return np.load(cache)
    occ = np.zeros(N, np.float32)
    prev = None
    for n in range(N):
        f = frames[n, ::4, ::4, :].astype(np.float32)
        y = (0.2126 * f[..., 0] + 0.7152 * f[..., 1] + 0.0722 * f[..., 2]) / 255.0
        lum = float(y.mean())
        motion = float(np.abs(y - prev).mean()) if prev is not None else 0.0
        occ[n] = 0.78 * lum + 0.22 * motion * 3
        prev = y
        if n % 2000 == 0: print(f"  wear {n}/{N}", flush=True)
    env = box1(occ, 1, 2)
    slope, lin, O0s, Etot = geom(N, wrap0, grow)
    ek = np.exp(slope * np.arange(depth + 1))
    g = np.array([0.0] + [fall ** (k - 1) for k in range(1, depth + 1)], np.float32)
    n = np.arange(N, dtype=np.float64)
    E = 1 + slope * n / wrap0; Ef = Etot / E
    s = env.copy().astype(np.float64); w = np.ones(N)
    for k in range(1, depth + 1):
        outP = O0s * (E * ek[k] - 1); inP = O0s * (E / ek[k] - 1)
        s += 0.5 * g[k] * (sample_at(env, outP) + sample_at(env, inP)); w += g[k]
        if fold > 0:
            foP = O0s * (Ef * ek[k] - 1); fiP = O0s * (Ef / ek[k] - 1)
            s += 0.5 * fold * g[k] * (sample_at(env, foP) + sample_at(env, fiP)); w += fold * g[k]
    m = normalize_map(box1((s / w).astype(np.float32), 1, 1), 0.72)
    np.save(cache, m)
    return m

def flow_map(N, rate, amount_arr, wear_arr, kind):
    t = np.arange(N, dtype=np.float64) / rate
    audio = kind == 'audio'
    if audio:
        slowAmp = rate * (0.002 + 0.010 * amount_arr) * amount_arr
        fastAmp = rate * 0.0007 * amount_arr
    else:
        slowAmp = (0.18 + 1.8 * amount_arr) * amount_arr
        fastAmp = 0.16 * amount_arr
    swell = 1 + 0.8 * wear_arr
    slow = (0.58 * np.sin(2 * np.pi * 0.19 * t + 0.9 * np.sin(2 * np.pi * 0.031 * t))
            + 0.30 * np.sin(2 * np.pi * 0.071 * t + 1.7)
            + 0.12 * np.sin(2 * np.pi * 0.43 * t + 0.6 * np.sin(2 * np.pi * 0.047 * t)))
    flutter = (np.sin(2 * np.pi * 6.2 * t + 0.55 * np.sin(2 * np.pi * 0.37 * t))
               + 0.45 * np.sin(2 * np.pi * 11.7 * t + 1.9))
    m = (swell * (slowAmp * slow + fastAmp * flutter)).astype(np.float32)
    return box1(m, max(1, int(rate * 0.001)) if audio else 1, 1)

def video_codec(outfile, crf):
    if outfile.lower().endswith(".mkv"):
        return ["-c:v", "ffv1", "-level", "3", "-pix_fmt", "rgb24"]
    return ["-c:v", "libx264", "-crf", str(crf), "-preset", "medium", "-pix_fmt", "yuv420p"]

def render_video(n0, count, outfile, crf=16):
    N = os.path.getsize(os.path.join(REEL, "frames.raw")) // (H * W * 3)
    frames = np.memmap(os.path.join(REEL, "frames.raw"), np.uint8, 'r', shape=(N, H, W, 3))
    wrap0, grow = WRAP_S * FPS, GROW_S * FPS
    slope, lin, O0s, Etot = geom(N, wrap0, grow)
    endp = par(1.0)
    maxd = int(math.ceil(RAMP['depth'][1]))
    ek = np.exp(slope * np.arange(maxd + 2))

    print("building wear map…", flush=True)
    wmap = video_wear_map(frames, N, maxd, endp['fall'], wrap0, grow, endp['fold'])
    uall = (np.arange(N) / (N - 1.0))
    pall = par_arr(uall)
    fmap = flow_map(N, FPS, pall['flow'], wmap * pall['wear'], 'video')

    yy = np.arange(H, dtype=np.float32)[:, None]
    xx = np.arange(W, dtype=np.float32)[None, :]

    def F(p):
        q = np.round(p + fmap[int(round(p)) % N]).astype(np.int64) % N
        return frames[q]

    ff = subprocess.Popen(
        [FFMPEG, "-hide_banner", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an", *video_codec(outfile, crf), outfile],
        stdin=subprocess.PIPE)

    for i in range(count):
        n = n0 + i
        u = n / (N - 1.0)
        p = par(u)
        a, b = (1 - p['wind']) / 2, (1 + p['wind']) / 2
        fold, dep = p['fold'], p['depth']
        E = 1 + slope * n / wrap0; Ef = Etot / E
        blurR = int(round((1 - (p['tilt'] - 200) / 19800) * 5))
        gh = np.zeros((H, W, 3), np.float32); Wsum = 0.0
        for k in range(1, maxd + 1):
            gate = min(1.0, max(0.0, dep - (k - 1)))
            if gate <= 0: break
            gk = (p['fall'] ** (k - 1)) * gate
            outP = O0s * (E * ek[k] - 1); inP = O0s * (E / ek[k] - 1)
            gh += np.float32(gk * a) * F(outP); gh += np.float32(gk * b) * F(inP)
            Wsum += gk
            if fold > 0:
                foP = O0s * (Ef * ek[k] - 1); fiP = O0s * (Ef / ek[k] - 1)
                gh += np.float32(gk * fold * a) * F(foP); gh += np.float32(gk * fold * b) * F(fiP)
                Wsum += gk * fold
        if Wsum > 1e-6: gh /= np.float32(Wsum)
        if blurR >= 1: gh = uniform_filter(gh, size=(2 * blurR + 1, 2 * blurR + 1, 1), mode='nearest')

        src = F(n).astype(np.float32)
        wearF = float(wmap[n]) * p['wear']
        trackF = p['track'] * (0.25 + 0.75 * wearF)
        ghostBoost = 1 + 0.55 * wearF
        dry, pr = p['dry'], p['print']

        if wearF <= 0.001 and trackF <= 0.001:
            out = dry * src + pr * gh
        else:
            seamY = H * (0.84 + 0.055 * math.sin(n * 0.31 + math.sin(n * 0.047) * 2.1))
            seam = np.exp(-np.abs(yy - seamY) / (1.6 + trackF * 13)) if trackF else np.zeros((H, 1), np.float32)
            drift = trackF * (np.sin(yy * 0.073 + n * 0.41) * 3 + np.sin(yy * 0.017 + n * 0.13) * 8) + seam * trackF * 44
            head = np.minimum(0.85, seam * trackF * 1.35)
            sx = np.clip(np.round(xx + drift), 0, W - 1).astype(np.int64)
            idx = sx[..., None]
            s2 = np.take_along_axis(src, idx, axis=1)
            g2 = np.take_along_axis(gh, idx, axis=1)
            lum = s2.sum(axis=2, keepdims=True) / 765.0
            local = wearF * (0.35 + 0.65 * lum)
            erode = np.minimum(0.85, local * 0.78)
            db = uniform_filter(src, size=(2 * max(1, min(5, blurR + 1)) + 1,) * 2 + (1,), mode='nearest')
            db = np.take_along_axis(db, idx, axis=1)
            rgb = s2 * (1 - erode) + db * erode
            gray = rgb.mean(axis=2, keepdims=True); bleach = erode * 0.45
            rgb = rgb * (1 - bleach) + gray * bleach
            stripe = 0.5 + 0.5 * np.sin((yy + n * 1.7) * 0.65 + np.sin(xx * 0.061 + n * 0.19))
            oxide = np.maximum(0, stripe[..., None] + local * 1.4 - 1.18)
            loss = np.minimum(0.9, local * (0.12 + 0.28 * lum) + oxide * 0.62)
            out = dry * rgb * (1 - loss) + pr * g2 * ghostBoost
            hd = head[..., None]
            out = out * (1 - hd * np.array([0.34, 0.48, 0.18], np.float32)) + hd * np.array([26., 8., 40.], np.float32)

        ff.stdin.write(np.clip(out, 0, 255).astype(np.uint8).tobytes())
        if i % 300 == 0:
            print(f"  frame {i}/{count} (n={n}, u={u:.3f}) depth={dep:.1f} print={pr:.2f} fold={fold:.2f} wear={p['wear']:.2f}", flush=True)
    ff.stdin.close(); ff.wait()
    print("video done ->", outfile, flush=True)

# ---------------------------------------------------------------- audio
def par_slice(n0, n1, N):
    """ramp parameters for samples [n0,n1) as float32 — full-length float64 copies of
    all ten parameters is several GB at 42 M samples, which thrashes."""
    u = np.arange(n0, n1, dtype=np.float64) / (N - 1.0)
    return {k: (a + (b - a) * (u ** c)).astype(np.float32) for k, (a, b, c) in RAMP.items()}

def render_audio(outfile, chunk=1 << 20):
    raw = np.fromfile(os.path.join(REEL, "audio.raw"), np.float32)
    x = raw.reshape(-1, 2).T.copy(); del raw
    N = x.shape[1]
    wrap0, grow = WRAP_S * SR, GROW_S * SR
    slope, lin, O0s, Etot = geom(N, wrap0, grow)
    maxd = int(math.ceil(RAMP['depth'][1]))
    ek = np.exp(slope * np.arange(maxd + 2))
    bounds = [(i, min(i + chunk, N)) for i in range(0, N, chunk)]
    nb = len(bounds)

    def geo(n0, n1):
        nch = np.arange(n0, n1, dtype=np.float64)
        E = 1 + slope * nch / wrap0
        return nch, E, Etot / E

    # ---- wear map (cached — the fold loop is 72 gathers over the whole reel) ----
    cache = os.path.join(REEL, "audio_wearmap.npy")
    if os.path.exists(cache):
        wmap = np.load(cache)
    else:
        print("audio wear map…", flush=True)
        env = box1(np.abs(x).mean(axis=0), max(1, int(SR * 0.012)), 2)
        endfall, endfold = RAMP['fall'][1], RAMP['fold'][1]
        acc = np.empty(N, np.float32)
        for j, (n0, n1) in enumerate(bounds):
            _, E, Ef = geo(n0, n1)
            s = env[n0:n1].astype(np.float64); w = 1.0
            for k in range(1, maxd + 1):
                gk = endfall ** (k - 1)
                s += 0.5 * gk * (sample_at(env, O0s * (E * ek[k] - 1)) + sample_at(env, O0s * (E / ek[k] - 1))); w += gk
                s += 0.5 * endfold * gk * (sample_at(env, O0s * (Ef * ek[k] - 1)) + sample_at(env, O0s * (Ef / ek[k] - 1))); w += endfold * gk
            acc[n0:n1] = s / w
            print(f"  wear chunk {j+1}/{nb}", flush=True)
        wmap = normalize_map(box1(acc, max(1, int(SR * 0.006)), 1), 0.65)
        np.save(cache, wmap); del env, acc

    # ---- wear scaled by the ramp, and the transport flow map ----
    wear_f = np.empty(N, np.float32)
    fmap = np.empty(N, np.float32)
    for (n0, n1) in bounds:
        p = par_slice(n0, n1, N)
        wr = wmap[n0:n1] * p['wear']; wear_f[n0:n1] = wr
        t = np.arange(n0, n1, dtype=np.float64) / SR
        amt = p['flow']
        slowAmp = SR * (0.002 + 0.010 * amt) * amt
        fastAmp = SR * 0.0007 * amt
        slow = (0.58 * np.sin(2 * np.pi * 0.19 * t + 0.9 * np.sin(2 * np.pi * 0.031 * t))
                + 0.30 * np.sin(2 * np.pi * 0.071 * t + 1.7)
                + 0.12 * np.sin(2 * np.pi * 0.43 * t + 0.6 * np.sin(2 * np.pi * 0.047 * t)))
        flutter = (np.sin(2 * np.pi * 6.2 * t + 0.55 * np.sin(2 * np.pi * 0.37 * t))
                   + 0.45 * np.sin(2 * np.pi * 11.7 * t + 1.9))
        fmap[n0:n1] = (1 + 0.8 * wr) * (slowAmp * slow + fastAmp * flutter)
    fmap = box1(fmap, max(1, int(SR * 0.001)), 1)

    # ---- oxide shed, one sequential pass ----
    shed_in = np.empty(N, np.float32)
    for (n0, n1) in bounds:
        p = par_slice(n0, n1, N); nch = np.arange(n0, n1, dtype=np.float64)
        phase = 0.5 + 0.5 * np.sin(nch * 0.00083 + np.sin(nch * 0.000091) * 6.283)
        wm = wmap[n0:n1]
        scar = np.maximum(0, phase + wm * 1.12 - 1.08)
        shed_in[n0:n1] = p['wear'] * np.minimum(0.92, 0.22 * wm ** 1.7 + 0.78 * scar * wm)
    lossLp = lfilter([0.025], [1, -0.975], shed_in).astype(np.float32); del shed_in

    def a_tilt(s, e):
        u = ((s + e) / 2) / (N - 1.0); lo, hi, c = RAMP['tilt']
        return 1 - np.exp(-2 * np.pi * (lo + (hi - lo) * u ** c) / SR)

    def a_erase(s, e):
        u = ((s + e) / 2) / (N - 1.0); lo, hi, c = RAMP['wear']
        return 1 - np.exp(-2 * np.pi * (900 + (1 - (lo + (hi - lo) * u ** c)) * 7200) / SR)

    print("winding the reel (audio)…", flush=True)
    y = np.zeros_like(x)
    Wsum = np.empty(N, np.float32)
    for c in range(2):
        wet = np.empty(N, np.float32)
        for j, (n0, n1) in enumerate(bounds):
            p = par_slice(n0, n1, N)
            _, E, Ef = geo(n0, n1)
            a, b = (1 - p['wind']) / 2, (1 + p['wind']) / 2
            acc = np.zeros(n1 - n0, np.float32); ws = np.zeros(n1 - n0, np.float32)
            for k in range(1, maxd + 1):
                gate = np.clip(p['depth'] - (k - 1), 0, 1)
                if not gate.any(): break
                gk = (p['fall'] ** (k - 1)) * gate
                for pos, coef in ((O0s * (E * ek[k] - 1), a * gk), (O0s * (E / ek[k] - 1), b * gk),
                                  (O0s * (Ef * ek[k] - 1), a * gk * p['fold']), (O0s * (Ef / ek[k] - 1), b * gk * p['fold'])):
                    acc += (coef * sample_at(x[c], pos + sample_at(fmap, pos))).astype(np.float32)
                ws += gk * (1 + p['fold'])
            wet[n0:n1] = acc
            if c == 0: Wsum[n0:n1] = ws
            print(f"  ch{c} chunk {j+1}/{nb}", flush=True)
        wet /= np.sqrt(np.maximum(Wsum, 1e-6))   # incoherent sum -> sqrt holds level as depth ramps
        wet = varying_onepole(wet, a_tilt)       # ghost dulls as the tape degrades
        dryRead = np.empty(N, np.float32)
        for (n0, n1) in bounds:
            nch = np.arange(n0, n1, dtype=np.float64)
            dryRead[n0:n1] = sample_at(x[c], nch + sample_at(fmap, nch))
        selfLp = varying_onepole(dryRead, a_erase)
        for (n0, n1) in bounds:
            p = par_slice(n0, n1, N); nch = np.arange(n0, n1, dtype=np.float64)
            wr = wear_f[n0:n1]
            erase = np.minimum(0.9, wr * 0.85)
            dull = dryRead[n0:n1] * (1 - erase) + selfLp[n0:n1] * erase
            t = nch / SR
            track = p['track'] * (0.22 + 0.78 * wr)
            seam = np.maximum(0, np.sin(2 * np.pi * 29.97 * t + 0.9 * np.sin(2 * np.pi * 0.11 * t)) - (1.04 - 0.72 * track))
            whoosh = track * seam * (0.018 * np.sin(2 * np.pi * (860 + 210 * np.sin(2 * np.pi * 0.07 * t)) * t)
                                     + 0.010 * np.sin(2 * np.pi * 1720 * t + 0.8 * np.sin(2 * np.pi * 0.33 * t)))
            duck = np.minimum(0.55, track * seam * 0.38)
            v = (p['dry'] * dull * np.maximum(0, 1 - lossLp[n0:n1] - duck)
                 + p['print'] * wet[n0:n1] * (1 + 0.65 * wr) + whoosh)
            y[c, n0:n1] = np.where(np.abs(v) > 1.2, np.tanh(v), v)
        del wet, dryRead, selfLp
    if outfile.lower().endswith(".wav"):
        ff = subprocess.Popen([FFMPEG, "-hide_banner", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR),
                               "-ac", "2", "-i", "-", "-c:a", "pcm_f32le", outfile], stdin=subprocess.PIPE)
        ff.stdin.write(y.T.astype(np.float32).tobytes()); ff.stdin.close(); ff.wait()
    else:
        y.T.astype(np.float32).tofile(outfile)
    print("audio done ->", outfile, flush=True)

# ---------------------------------------------------------------- reel and CLI
def probe(path, ffprobe):
    out = subprocess.run([ffprobe, "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height,r_frame_rate", "-of", "json", path],
                         capture_output=True, text=True, check=True).stdout
    s = json.loads(out)["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return int(s["width"]), int(s["height"]), float(num) / float(den)

def build_reel(src_path, reel, ffprobe):
    """Extract every frame (RGB24) and the audio (f32le stereo, 48 kHz) to disk."""
    os.makedirs(reel, exist_ok=True)
    w, h, fps = probe(src_path, ffprobe)
    frames_path, audio_path = os.path.join(reel, "frames.raw"), os.path.join(reel, "audio.raw")
    subprocess.run([FFMPEG, "-hide_banner", "-v", "error", "-y", "-i", src_path, "-an",
                    "-f", "rawvideo", "-pix_fmt", "rgb24", frames_path], check=True)
    subprocess.run([FFMPEG, "-hide_banner", "-v", "error", "-y", "-i", src_path, "-vn",
                    "-f", "f32le", "-ac", "2", "-ar", str(SR), audio_path], check=True)
    n = os.path.getsize(frames_path) // (w * h * 3)
    meta = {"source": os.path.abspath(src_path), "width": w, "height": h, "fps": fps, "frames": n,
            "sampleRate": SR, "audioSamples": os.path.getsize(audio_path) // 8}
    with open(os.path.join(reel, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    # Wear maps depend on the source, so a rebuilt reel invalidates them.
    for cache in ("wearmap.npy", "audio_wearmap.npy"):
        p = os.path.join(reel, cache)
        if os.path.exists(p): os.remove(p)
    print(f"reel: {n} frames {w}x{h} @ {fps:g} fps, {meta['audioSamples'] / SR:.2f} s audio -> {reel}", flush=True)

def configure(reel, ramp_file, wrap, grow):
    global H, W, FPS, REEL, WRAP_S, GROW_S
    with open(os.path.join(reel, "meta.json"), encoding="utf-8") as f:
        meta = json.load(f)
    W, H, FPS, REEL = meta["width"], meta["height"], meta["fps"], reel
    WRAP_S, GROW_S = wrap, grow
    if ramp_file:
        with open(ramp_file, encoding="utf-8") as f:
            for k, v in json.load(f).items():
                if k not in RAMP: raise SystemExit(f"unknown ramp parameter {k!r}; known: {', '.join(RAMP)}")
                RAMP[k] = tuple(float(x) for x in v)

def below_normal_priority():
    if os.name == "nt":
        import ctypes
        ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x4000)

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mode", choices=["reel", "video", "audio", "mux"])
    ap.add_argument("--in", dest="src", help="reel: source video with audio")
    ap.add_argument("--reel", help="folder holding frames.raw, audio.raw, meta.json, and wear caches")
    ap.add_argument("--out", help="video, audio, mux: output file")
    ap.add_argument("--video", help="mux: degraded video")
    ap.add_argument("--audio", help="mux: degraded audio")
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--count", type=int, default=0)
    ap.add_argument("--crf", type=int, default=16)
    ap.add_argument("--ramp", help="JSON file overriding RAMP entries")
    ap.add_argument("--wrap", type=float, default=0.400, help="reel wrap period in seconds (app maximum 0.4)")
    ap.add_argument("--grow", type=float, default=0.500, help="wrap growth over the reel in seconds (app maximum 0.5)")
    ap.add_argument("--ffmpeg", default="ffmpeg")
    ap.add_argument("--ffprobe", default="ffprobe")
    A = ap.parse_args()
    FFMPEG = A.ffmpeg
    below_normal_priority()
    if A.mode == "reel":
        if not (A.src and A.reel): ap.error("reel needs --in and --reel")
        build_reel(A.src, A.reel, A.ffprobe)
    elif A.mode == "mux":
        if not (A.video and A.audio and A.out): ap.error("mux needs --video, --audio, and --out")
        codec = ["-c:a", "pcm_f32le"] if A.out.lower().endswith(".mkv") else ["-c:a", "aac", "-b:a", "192k"]
        subprocess.run([FFMPEG, "-hide_banner", "-v", "error", "-y", "-i", A.video, "-i", A.audio,
                        "-map", "0:v", "-map", "1:a", "-c:v", "copy", *codec, A.out], check=True)
        print("mux done ->", A.out, flush=True)
    else:
        if not (A.reel and A.out): ap.error(f"{A.mode} needs --reel and --out")
        configure(A.reel, A.ramp, A.wrap, A.grow)
        if A.mode == "video":
            N = os.path.getsize(os.path.join(REEL, "frames.raw")) // (H * W * 3)
            render_video(A.start, A.count or N, A.out, A.crf)
        else:
            render_audio(A.out)
