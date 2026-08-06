# REMANENCE

*magnetic print-through as an acausal effect — audio + video* · ✅ **SHIPPED (prototype)**

`hindcasts/remanence/` · the suite's **first true audio+video member**

---

## micro-statement

A wound reel of tape imprints itself. Loud moments on one wrap magnetise the layers pressed
against them, so a faint copy of every transient prints onto its neighbours — heard as **pre-echo**
(the ghost that arrives *before* the sound) and post-echo (the ghost that lingers after). **Remanence**
is that defect made an instrument: a print-through effect that has read the tape before it plays.

Physical settings give a credible tape haunting. Overdriven, the reel folds and distant moments
cross-print — an anticipation comb, the future bleeding backward into the present. One engine, the
whole span from *faithful* to *hyperreal* (realer than the physics allows), on the same knobs.

---

## thesis — why acausal is *forced*, not decorative

Wear is a **dose integrated over the whole life of the material.** Groove wear ∝ amplitude ×
play-count, accumulated; photo fade ∝ cumulative exposure; print-through ∝ the signal on the
adjacent wrap, deposited over storage time. Damage at time *t* is a **path integral over the
material's entire history** — and print-through's pre-echo needs a *future* sample to exist at all.
A live effect cannot integrate a path it has not finished. So an honest tape sim is acausal by
construction, not by preference. This is the Hindcasts spine (*read to the end of the score before
you begin*) handed over by physics rather than argued.

Print-through is literally **pre-verb / anticipatory-dust as a real defect** — except the grains
are not synthetic noise, they are the actual future signal, placed by reel geometry.

---

## the reel model (the star, exposed)

Tape wound on a hub radius r₀, thickness d. Wrap N sits at radius r₀+Nd; its period is
**T_N = 2π(r₀+Nd)/v**. Clip-time maps to tape length x = v·t, which spirals onto the reel — two
moments print on each other when they land on **adjacent wraps at the same angle**, i.e. their
clip-time separation is one wrap period. So:

- **coupling:** sample at *t* couples to *t ± k·T(t)* for k = 1…depth (successive wraps).
- **drift:** T grows hub→rim, so the echo spacing **drifts across the clip** — tight at the hub,
  long at the rim. A delay-time envelope that comes from geometry, not an LFO. (Prototype uses a
  linear T(n) = wrap + grow·(n/N); the true spiral is the refinement.)
- **wind direction = time arrow.** Which layer sits *outside* decides pre- vs post-echo dominance
  (tail-out storage favours post — real archival advice). The **Wind** knob is that choice, and it
  is exactly Prolepsis's wake / anticipation / symmetric stance, physically motivated.
- **non-local cross-print — the fold (SHIPPED).** The reel is a true Archimedean spiral now, not a
  linear ramp: sample *n* winds onto the spiral and its k-th neighbour is the sample at the *same
  angular phase, k wraps out* — cumulative across growing-circumference wraps, so taps **spread**
  outward and **bunch** inward (asymmetric, inharmonic — the geometry the ramp couldn't make). The
  **Fold** control adds coupling across the reel *mirror* (wrap W ↔ W_total−W): clip-distant moments
  that are reel-adjacent bleed into each other — the two ends of the clip cross-print, coupling set by
  winding not clip-time. Cheap: with offset growing linearly in tape-position, e^{s·W(n)} = 1 +
  s·n/O₀ closed-form, no per-sample log/exp.

**Superpowers used:** precognition (pre-echo), bidirectionality (Wind), global statistics
(wear/dropout placed by whole-clip occupancy/recurrence), continuous transport warp.

---

## construction

**Audio.** Whole clip decoded, then a **position-varying multi-tap delay with negative taps
allowed** (the acausal license): for each output sample,
`out[n] = dry·x[n] + Print · LPtilt( Σ_k fall^(k-1) ( a·x[n+kT(n)] + b·x[n−kT(n)] ) )`,
T(n) = (wrap + grow·n/N)·sr, a=(1−wind)/2 pre, b=(1+wind)/2 post. Fractional taps read by linear
interpolation. Ghost bus gets a one-pole low-pass (print favours LF). Soft-clip safety on the mix.
Offline → no causality budget. Per channel.

**Video.** Same reel, period in **frames** (T = (wrap+grow·n/N)·fps). Frames captured downscaled
(≤360 px, ≤240 frames, 15 fps for the prototype), composited: accumulate the neighbour-wrap ghost
(additive light bleed), **box-blur it by a radius set from Tilt** (print's *spatial* LF bias),
add to the dry frame, clamp. Export via `MediaRecorder` → WebM. Preview always renders clean.

**Flow / tracking.** The next layer is shared transport failure. A continuous wow/flutter map warps
the tape-position lookup before dry reads and print-through taps, so pitch wobble and frame-time
jitter come from one slipping transport rather than separate garnish. The VHS head-switch seam is the
one admitted grid: a video-cadence scar that also injects audio whoosh, because the substrate is
shared.

---

## controls — audio / video / both

Every control affects **both** media. Only **Tilt** changes mechanism between them.

| control | what it does | audio | video |
|---|---|---|---|
| **Print** | ghost level (dB) | ✓ | ✓ |
| **Wraps** | bleed depth (# neighbour wraps) | ✓ | ✓ |
| **Wind** | time arrow: pre-echo ↔ post-echo | ✓ | ✓ |
| **Wrap** | hub period (base echo spacing) | ✓ | ✓ |
| **Reel growth** | hub→rim drift (spiral slope) | ✓ | ✓ |
| **Fold** | mirror across the reel — clip-distant / reel-adjacent cross-print | ✓ | ✓ |
| **Wear** | occupancy damage map (audio = ‖amp‖ envelope, video = luma+motion), folded through the reel: HF self-erasure + dropout. *Recurrence/self-similarity map = roadmap.* | ✓ | ✓ |
| **Flow** | wow/flutter transport warp | pitch wobble / read-head slip | frame-time jitter / row swim |
| **Tracking** | VHS head-switch failure | cadence whoosh / ducking | unstable lower seam / tearing |
| **Falloff** | per-wrap decay | ✓ | ✓ |
| **Tilt** | print LF bias | temporal low-pass | **ghost box-blur** |
| **Dry** | dry blend | ✓ | ✓ |

Presets walk the continuum: **FAITHFUL** (subtle real remanence) → **HAUNTING** → **TAIL-OUT** →
**ZERO-PHASE** → **REEL-FOLD** (overdriven, long drift) → **DUB-LOSS** → **LONG-FOLD** → **PRE-SWARM**
(dense anticipation comb) → **MELT**. No mode switch — faithful and hyperreal are the same engine at
different ranges.

**MELT — the Sgueltch crossover (future zone, not a new home).** The far end of the continuum tips
into Sgueltch territory, but *louder print-through ≠ melt* — a dense comb is still analog-nostalgic /
Hindcasts. Real tape-melt needs the substrate to go organic/fluid, which is the **wear/transport
cranked**: occupancy erasure + dropout bloom, wow/flutter → liquid pitch-warp,
head-switch whoosh, sticky-shed squeal. So MELT is a preset at the end of the slider riding the garnish — the kin
relationship made *dialable* — never the default. Placement stays Hindcasts-home / Sgueltch-kin.

---

## garnish / media failures (spine + wear shipped; these hang off it) — with media scope

| effect | idea | scope |
|---|---|---|
| **wow / flutter** | shipped: reel-speed drift; audio = pitch warble, video = frame-time jitter | both |
| **HF self-erasure** | shipped: tape dulls where it played loudest (occupancy-driven) — climax erases itself | both |
| **dropout** | shipped: oxide-shed loss placed by the wear/recurrence map, not RNG | both |
| **head-switch** | shipped: the one *grid*: helical-scan tick locked to video framerate | both (a/v shared substrate) |
| **modulation noise / hiss** | amplitude-riding floor | audio |
| **non-local reel-fold** | true clip-distant / reel-adjacent cross-print | both |

Note: VHS Hi-Fi audio is FM-encoded via the helical heads, so audio *inherits* video-domain failure
(head-switch, tracking whoosh). VHS is the one medium where audio and video share a substrate — which
is why Remanence is the natural place for the suite's audio↔video asymmetry to collapse.

---

## placement — why Hindcasts, not Sgueltch

**Suite placement rule.** An app that centres on *glitch / corruption* — where the damage is the
point and the substrate is *specially organic* (ooze, tissue, lesion, mycelium, marbling, Voronoi
cell) — is **Sgueltch**. An app whose main idea is *utility* or *what whole-file analysis makes
possible* — with corruption a side effect, or corruption present but **not specially organic** (as
in Prolepsis) — is **Hindcasts**.

Remanence is Hindcasts-home: its main idea is whole-file acausal analysis (print-through *needs the
future*; wear is a path integral over the whole file), and its degradation is **analog-magnetic /
nostalgic**, not the biological-fluid substrate that defines Sgueltch. Precedent: Prolepsis. Contrast:
CyberScotoma is Sgueltch-home because its substrate *is* a biological lesion and a non-grid Voronoi
refusal of macroblocks — specially organic + anti-grid glitch.

Kept as **kin** in Sgueltch (the a/v tape-decay hinge), the way CyberScotoma is kept as kin in
Hindcasts. The membership is stronger now: Remanence does not just add tape flavor after the fact;
it changes transport lookup into a continuous, interstitial timing field, while treating head-switch
as a single unstable VHS scar rather than submitting the whole image to codec-grid artifacts. Same
hinge status, opposite primary homes.

---

## status

**Shipped (prototype):** print-through spine, audio + video, both from one reel. Reel knobs
(Print / Wraps / Wind / Wrap / Growth / Fold / Wear / Flow / Tracking / Falloff / Tilt / Dry), nine
FAITHFUL→MELT presets (FAITHFUL / HAUNTING / TAIL-OUT / ZERO-PHASE / REEL-FOLD / DUB-LOSS / LONG-FOLD /
PRE-SWARM / MELT), the
sunset-orb + Luminoid-stripe VHS shell (fused day↔night, clean previewer), WAV export (audio),
WebM export (video), fullscreen drag-drop.

**Shipped since:** **true non-local reel-fold** — Archimedean-spiral geometry (spreading/bunching
taps) + the **Fold** control (reel-mirror cross-print). Closed-form, both media.

**Occupancy/recurrence wear map** — whole-clip amplitude/brightness + neighbour-wrap recurrence drives
HF self-erasure, deterministic dropout, and stronger print in worn zones. Adds the global-statistics
superpower.

**Liquid transport + VHS head-switch** — wow/flutter warps the shared read-head; video gets frame jitter
and row swim, audio gets pitch wobble. Tracking adds the lower head-switch seam plus audio whoosh,
locked to the shared VHS substrate.

**Next moves:**
1. **Modulation noise / hiss** — amplitude-riding floor, ideally driven by the same wear/transport map.
2. **Non-Archimedean reels** — impossible spirals no physical tape allows. Circle-loop (taps wrap
   modular, `(n±kT) mod N` — clip end prints onto beginning, toroidal echo). Negative-grow collapse
   (shrinking wraps hub→rim; offset hits zero at a singularity where all echoes converge on the
   playhead, then flips pre/post past it). General reel law (replace the closed-form linear O(x) with
   a tabulated/inverted W(n) from any user-drawn O(x) curve — logarithmic, hyperbolic, Fermat spirals,
   sounder-style redrawable profile). Dequantizes the reel geometry itself.
3. **Other media as coupling geometries** — vinyl (play-count groove wear), optical film (spatial
   strip position), etc. Each a different time↔material coupling, not an EQ preset.

---

## field notes

**2026-08-05 — Claude Code — offline port, run against a 14:35 source**

Remanence's engine was ported to an offline Python/NumPy renderer to degrade the
Open4 VIDEOAKTION cut (`../../ephemeralrenders/open4-cut/remanence_offline.py`).
Nothing in this folder was changed. Three findings that belong here:

- **The shipped video path cannot take a long file.** `loadVideo` caps at
  `VMAXFRAMES` 240 frames / 360 px and holds every frame as a decoded
  `Uint8ClampedArray` in RAM. That is ~16 s at 15 fps. The cap is not incidental:
  the **Fold** tap reads the reel *mirror*, so frame *n* needs frame `N−n`, and no
  sliding window or streaming decode can serve it — the whole reel must be
  randomly addressable. The offline port used a disk memmap (8 GB for 14:35 at
  30 fps / 426×240). Any in-browser long-file support needs the same: a
  random-access frame store, not a bigger array.
- **Additive ghost accumulation white-outs at depth.** `renderVideo` sums taps as
  `gh += gk·(…)` and mixes `dry·src + print·gh`, so the ghost carries the *sum* of
  the per-wrap weights. At the REEL-FOLD preset (wraps 16, fall 0.82, fold 0.75)
  that sum is ≈9.3, and any non-dark frame clips to white. Tolerable in a 16 s
  prototype where the preset is the point; fatal over a long ramp, where rising
  `wraps` alone drives the image to white and the ramp reads as a fade. The port
  divides the ghost by its weight sum so `print` is a true mix level and depth
  changes density without changing brightness. Worth considering in the app —
  it would make **Wraps** and **Print** independent instead of multiplying.
- **Ramping the damage while holding the reel fixed works**, and is the right
  split: the reel is one physical object, so wrap/grow stay constant and only the
  damage parameters move. But the *shape* of that ramp is currently unwarranted —
  see `physics/GAPS.md`, "Radial dependence of print-through severity in a wound
  reel". The honest A(r) is not known and a hand-drawn curve was shipped.

Verified: fold tap destinations traced numerically across the reel (last frames
read the opening frames at 0.87 weight); ramp checked visually at u = 0.15 / 0.45
/ 0.75 / 0.97. Not done: none of this is fed back into the app — the two engine
points above are observations, not planned work, so **Next moves** above is
unchanged.

---

*spine: the tape remembers forward.*
