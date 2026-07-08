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

Presets walk the continuum: **FAITHFUL** (subtle real remanence) → **HAUNTING** → **REEL-FOLD**
(overdriven, long drift) → **PRE-SWARM** (dense anticipation comb). No mode switch — faithful and
hyperreal are the same engine at different ranges.

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
(Print / Wraps / Wind / Wrap / Growth / Fold / Wear / Flow / Tracking / Falloff / Tilt / Dry), FAITHFUL→PRE-SWARM presets, the
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
2. **Other media as coupling geometries** — vinyl (play-count groove wear), optical film (spatial
   strip position), etc. Each a different time↔material coupling, not an EQ preset.

*spine: the tape remembers forward.*
