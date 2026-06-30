# HORN OF PLENTY

*the stationarizer — a scrap into yardage · HINDCASTS / audio*

---

## one line

Feed it a sound that **runs out** — sand emptying, paper going thin and tearing — and it emits a **stationary substrate**: material whose statistics don't depend on where you read, so a downstream resynthesizer can land its read head anywhere and get the same evenness and the same full variation, at any length, without hearing the loop.

The name is the one place in the suite that names the **vessel, not the power**: the cornucopia that never empties (Amalthea's horn), punning on goat-horn *and* musical-horn. It sells the outcome — endless material — where Sounder names the method.

---

## thesis

The consumer isn't a listener playing front-to-back; it's a **machine doing random access** (a sampler or granulator reading the output at arbitrary points). So the property required isn't "even to someone pressing play," it's **even no matter where you read** — *stationarity*: the statistics of a window don't depend on where the window sits. Pushed to the limit ("sample anywhere, get the whole variation"), that's the ergodic intuition — the part equalling the whole, statistically.

This is **audio texture synthesis**: the image swatch-into-infinite-texture problem rotated ninety degrees into time, the temporal sibling of the compositing→audio thread. The image lesson transfers exactly — synthesize by *global* statistics alone → mush; synthesize by *local-neighborhood* statistics → novel material everywhere locally faithful to the example, never a global copy.

It is acausal-native. A causal granulator can't do this even in principle: at the moment it places a grain it doesn't know what overlaps it three grains from now, so it can only react to heaps and dips after they exist. Offline, the heap is visible before it exists, and you can reach back and delete from an overfull region because there is no committed past. Superpowers drawn on: **global statistics + whole-signal optimization** — the one suite member whose entire output *is* a statistical object.

### felt, not weave (the operating metaphor)

The user-facing register is the **harvest** (the cornucopia overflowing with grain — and the granular atom is *literally* called a grain). But the load-bearing engineering metaphor is **felt, not weave**:

- A **weave** is periodic — warp/weft regularity *is* the texture, and that's the structure to destroy.
- **Felt** is nonwoven: fibers matted in random orientation, no periodic component, the same everywhere — *cut it anywhere and the swatch is the same material.*

So the operation is precise about what it keeps: **whiten the non-stationarity, preserve the stationary structure.** Kill the position-*dependence* (the exhaustion curve, the drift); keep the position-*independent* color (the burst-shape of a single crackle, the short-time correlation that makes paper sound like paper and not like clicks). Full grain-scale scramble overshoots — it flattens the drift *and* the material signature, and you get felt that's lost its wool: even, samples-anywhere-fine, sounds like filtered noise. **Stationary ≠ white.**

### the two failure modes = the two orders of stationarity

- "Silence then a crackle at the end" → **first-order** failure: the energy distribution drifts with position.
- "The same sound again and again" → **second-order** failure: the autocorrelation has periodic structure.

A flat envelope only fixes the first; you can hold perfectly flat power while one grain repeats on a clock. The fix for the second is **not more grains** — periodic reuse is the killer, *random* reuse at the same average rate is far less audible. The ear hooks onto regularity, not recurrence.

---

## the control model

Two axes are the spine; the rest is variety and safety.

### the field (the spine)

- **Grain** (fiber length, 15–300 ms) — the matting scale; how much of each event survives whole. The **suggest** button seeds it from the source's own autocorrelation length (the felt's natural fiber length, measured before a grain is committed). Re-deriving the grain library on change is cheap because grains are **configs, not buffers** — audition as fast as you drag.
- **Whiteness** (0–100%) — how hard to scramble above the grain. Drives the anti-repeat window (how many recent grains are forbidden) and the onset jitter. Low = true to the source's grammar (more character, more repetition risk); high = wild scatter (most novel/stationary, risks genericizing).

### the grain motion (optional variety)

Each is a cheap palette-extender that makes a reused grain read as *another* grain, not the same one returning. All preserve the power bookkeeping.

- **Pitch jitter** (0–12 st) — per-grain interpolated resampling.
- **Reverse** (0–100%) — probability a grain plays backward.
- **Spread** (0–100%) — stereo width; constant-power per-grain pan (energy-preserving, so it doesn't fight the flatten). Output is stereo.

### the measure (level)

- **Match own average** (default, checked) — flatten to the signal's own average, then a safe **−1 dBFS** peak normalize. Output level tracks the material.
- Unchecked → **Output level** (−36…0 dB) — a fixed loudness (RMS) target so every export sits at the same level regardless of source (consistent sampler feeding). **0 dB is a hard ceiling** — if the loudness target would push the peak past full scale, it is pulled back to 0 dBFS. The loudness-guardian veto is structural, not advisory.

### presets — points on the grain × whiteness plane

Starting points, not commitments; any manual nudge clears the highlight.

| preset | grain | whiteness | character |
|---|---|---|---|
| **Mist** | finest | highest | smooth diffuse wash, near-noise; the water/already-stationary end |
| **Sand** | fine | high | even dense granular bed |
| **Orchard** | medium | balanced | lush, varied (pitch + spread on) |
| **Husk** | coarse | low | keeps the source's grammar; chunkier, character-forward |

---

## construction (scrappy-robust; solver only to trim)

Stays in the **power domain** — decorrelated grains add in power, not amplitude (two equal grains = +3 dB; √N for N), which makes placement **linear**: needed overlap density = target power ÷ mean grain power.

1. **Winnow** — segment the source into windowed (Hann) grains on a half-grain hop; compute per-grain power *and* a brightness proxy (zero-crossing rate). An **adaptive energy gate** drops near-silence (chaff), auto-removing the tedious manual editing. Guard: if too few grains survive, keep the loudest N.
2. **Depth chart over grains** — the loudness histogram of the kept grains (*the winnow*), bars colored along the harvest ramp by the mean brightness of grains in each bin, so the real produce spread is visible.
3. **Sow** — lay onsets as jittered (blue-noise-ish) placement at the density; draw grain identities avoiding a recent-use window; apply optional pitch / reverse / pan per grain.
4. **Flatten** — measure the short-time cross-channel RMS envelope, target the signal's own average, apply a smoothed correction **capped at ±9 dB** (so it removes slow drift without pumping), `evenness`-dialed.
5. **Measure** — own-average safe normalize, or fixed-loudness target with the 0 dBFS guardian.

Validated numerically: on a synthetic source 8.8× louder at head than tail, the yield comes out ~0.98 head/tail RMS ratio (even end to end), env CV ≈ 0.08, with the full motion stack on. The blue-noise scatter alone already lands near-even — the flatten only shaves residual ripple, exactly as designed.

---

## status

**Shipped (MVP, single self-contained HTML):** winnow → sow → flatten → stereo pour → loop-audition → WAV export. Grain × whiteness spine, pitch/reverse/spread motion, own-average / fixed-loudness level with 0 dB guardian, four presets, autocorrelation suggest, harvest-ramp visuals (seed waveform · the winnow · the pour with erased-drift ghost). Polychrome identity (fig → pomegranate → cherry → persimmon → gold → pear → leaf), Fraunces-italic display on the dyer's-bench ground — the suite's deliberately colorful member, because abundance *is* variety.

---

## deferred (clean additions onto this spine)

- **Matching-pursuit solver** — greedy place-the-grain-that-most-reduces-the-residual against a target envelope. *Only* needed for hand-drawn **non-flat** targets (a substrate that slowly swells). For a flat yield, construction already wins; not needed yet.
- **Neighborhood-histogram-matched selection** — pull each local region's grain-type histogram toward the global one. Uniform draw approximates this over long output; assessed as not immediately important.
- **True spectral centroid** for grain coloring/selection — currently a zero-crossing-rate proxy. A real centroid is a clean swap.
- Micro-EQ on reuse · worker offload + STFT cache · the rack (cross-app with Pythia — homogeneous audio buffers, the natural first cross-app case).

---

## open questions

- **Spread default (35%)** — useful for a standalone bed, but if the output feeds *another* granulator that pans on its own, mono (0%) may be the safer default. Decide per intended consumer.
- **Loop-awareness** — currently we generate long and let the consumer crossfade (no wrap = nothing to be stationary across). If a *seamless looped* substrate is ever wanted, the blue-noise schedules need to be periodic-aware so the loop point doesn't become the one piece of periodicity we removed. Parked deliberately.
- **Grain-vs-consumer crossover** — if the downstream grain is shorter than ours it reads *inside* our grains and can resurface source repetition. We bias short by default; no free way to know the consumer's setting.

---

*spine: a vessel that has read the whole scrap before it begins to pour.*
