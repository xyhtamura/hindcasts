# HINDCASTS

*a suite of un-live effects — audio and video*

---

## micro-statement

A **hindcast** is a forecast you run over a span you already know the outcome of — you "predict" the past with full knowledge of what happened. Oceanographers do it to wave fields. We do it to signals.

Every realtime effect is a causal system: its output at time *t* can depend only on samples at or before *t*. That single constraint — not *liveness*, but *causality* — is what forces the threshold-and-attack dance, the running estimate, the late and guessing reaction. A live compressor waits for evidence a peak arrived, then responds, always behind. Lookahead is a small confession that the ideal effect was never meant to be live.

Hindcast drops causality on purpose. These are effects that have **read to the end of the score before they begin.** They do not detect; they *know*. They do not estimate a running distribution; they have the whole one. They respond *before*, smooth *backward*, measure-then-act-then-measure, and fit their transfer curves to the entire piece at once.

Pythia named it first — *precognitive / paracognitive*. Hindcast is the practice that figure performs.

---

## the thesis (why this isn't just "offline processing")

Audio is **causal-by-default**. Image is **acausal-by-default**. The *same operation* reads as transgressive in one medium and as a checkbox in the other.

Brightness normalization over a time window is RMS normalization. Temporal denoise is bidirectional smoothing. Optical-flow retiming is lookahead with the arrow free to point either way. None of it feels like cheating to a colorist — it's the water they swim in. In audio the offline version of the same move reads as a *violation*.

This isn't a law. It's sedimented history:

- **Audio** inherited causality from the **monitoring** lineage — you must hear yourself play, latency must stay sub-perceptual, the effect lives in the same instant as the performance. The constraint naturalized so deeply that "an effect" and "a realtime causal system" became synonyms.
- **Image** never had that. Film was *already a strip you held in your hand* — the whole timeline physically present, cut and graded and re-seen as an object. The substrate was acausal from the start.

The medium's material history decided what would feel like cheating. This is the **quantization thesis** in its cleanest form — contingent processing commitments naturalized through inertia — except here it's a *controlled comparison*: two media, same operation, opposite intuitions, the only variable is lineage. The contingency isn't argued, it's **demonstrated** by the asymmetry.

### the two-axis frame

So the suite has two axes, not one.

**Axis 1 — operation:** delay / dynamics / distortion / dust.

**Axis 2 — medium, with opposite political valence:**
- In **audio**, Hindcast *reveals* a buried contingency — these effects shouldn't feel transgressive but do.
- In **video**, Hindcast *refuses* a naturalized one — these operations are normal but should be allowed to show themselves. Nearly all of video's acausality is *corrective and invisible* (deflicker wants to be unnoticed; denoise restores a continuity that "should" have been there; flow interpolation wants to pass as real). The Hindcast stance inverts this: acausality made **expressive and visible** — refusing to hide the hand. The torque is *because* the technique is mundane there.

Same name, opposite valence per medium.

---

## the five superpowers of acausality

Every member draws on at least one:

1. **Precognition** — respond *before*. (Pythia's delay; pre-ducking; pre-verb.)
2. **Global statistics** — shape relative to the whole file's distribution, not a running estimate.
3. **Bidirectionality** — smooth/filter symmetrically, not only forward. (Zero-phase.)
4. **Multi-pass** — measure, then act, then measure again. Convergence.
5. **Whole-signal optimization** — pick the transfer curve / quantizer / kernel that's optimal over the entire piece.

---

## AUDIO members

### Horn of Plenty — *the stationarizer; scrap into yardage* · **specced, unbuilt**
Every other audio member redraws values on a fixed timeline or schedules grains around events. This one rebuilds the timeline itself to a statistical target: feed it a *non-stationary* recording — sand that runs out, paper that goes thin and tears, a pour dense at the top and sparse at the bottom — and it emits a **stationary substrate**, material whose statistics don't depend on where you read. Not a bed for a listener playing front-to-back; a **substrate for a downstream resynthesizer doing random access**, so a sampler or granulator can land its read head *anywhere* and get the same evenness and the same full variation. The whole-envelope life is reintroduced downstream by the consumer's own envelope — so this layer's job is to be neutral and even, and the flatness gets driven *hard* (no liveliness knob; deadness-in-dynamics is correct here).

The metaphor is **felt, not weave.** A weave is periodic — warp/weft regularity is exactly the structure to destroy. Felt is nonwoven: fibers matted in random orientation, no periodic component, the same everywhere — *cut it anywhere and the swatch is the same material.* So the operation is precise about what it keeps: **whiten the non-stationarity, preserve the stationary structure.** Kill the position-dependence (the exhaustion curve, the drift); keep the position-*independent* color (the burst-shape of a single crackle, the short-time correlation that makes paper sound like paper and not like clicks). Full grain-scale scramble overshoots — it flattens the drift *and* the material signature, and you get felt that's lost its wool: even, samples-anywhere-fine, sounds like filtered noise. *Stationary ≠ white.*

The two failure modes name the two orders of stationarity. "Silence then a crackle at the end" is **first-order** failure — the energy distribution drifts with position. "The same sound again and again" is **second-order** failure — the autocorrelation has periodic structure. A flat envelope only fixes the first; you can hold perfectly flat power while one grain repeats on a clock. The fix for the second isn't *more grains* — periodic reuse is the killer, random reuse at the same average rate is far less audible. Schedule onsets *and* identity-reuse as **blue noise**: evenly spread, no periodic component, every recurrence jittered past a similarity window. Buy palette by transforming reused grains (micro pitch-shift, EQ, reversal — thematically ours) so a returning crackle reads as *another* crackle, not the same one.

This is **audio texture synthesis** — the image swatch-into-infinite-texture problem rotated ninety degrees into time, the temporal sibling of the compositing→audio thread. The image lesson transfers exactly: synthesize by *global* statistics alone → mush; synthesize by *local-neighborhood* statistics → novel material everywhere locally faithful to the example, never a global copy. So grain succession is drawn from the source's own transition structure, keeping the higher-order statistics *colored* (paper-like) rather than *white*.

> **Construction (scrappy-robust; solver only to trim).** Stays in the **power domain** — decorrelated grains add in power, not amplitude (two equal grains = +3 dB; √N for N), which makes placement **linear**: needed overlap density = target power ÷ mean grain power, no search. Segment → grain library with per-grain power + spectral descriptor (the **depth chart, over grains**) → blue-noise onsets at that density, drawn to pull each neighborhood's grain-type histogram toward the global one → trim per-grain gains to flatten residual ripple → **one backward pass to shave heaps** (the acausal move: reach back and delete from an overfull region, because there's no committed past). **Source-position diversity is a hard constraint** among overlapping grains — correlated overlap breaks the power-add linearity and combs. The full least-squares whole-signal solve buys the last sliver of flatness, which you mostly don't want. Superpowers: **global statistics + whole-signal optimization** — the one member whose entire output *is* a statistical object.

> **The live fork → handed to the user.** The load-bearing parameter is **fiber length** (how far above the single grain the preserved correlation reaches) × **whiteness** (how fully the supra-grain statistics scramble — full-white most-novel/risks-generic vs neighborhood-preserving keeps the micro-grammar). Both resolved by *trial and error*, seeded by a principled **suggested cut**: the source's own autocorrelation length, measured whole-file before a grain is committed — the felt's natural fiber length read off the material. Cheap because grains are **configs, not buffers** (re-cut = re-derive; audition as fast as you drag). Presets are points on that plane — **gauze / felt / tweed**, each a named (fiber, whiteness) coordinate.

**Effort is proportional to non-stationarity.** Running water is the degenerate floor — already stationary, near-noise higher-order statistics — so the tool nearly no-ops it and "turn it on for thirty seconds" is pure duration-authoring over an identity pass. Sand-running-out and paper-tearing are the ceiling, all frayed-end and thin-patch, where the flattening does real work. Looping is a non-problem: generate long enough that no wrap is needed and let the sampler crossfade. The name is the one place in the suite that names the **vessel, not the power** — the cornucopia that never empties (Amalthea's horn, kept as connotation), punning on goat-horn *and* musical-horn; it sells the *outcome* (endless material) where Sounder names the *method*. Completes the suite arc: Pythia/ProLepsis own time, Sounder owns value-mapping, **Horn of Plenty owns the boundless whole.**

### Paracognitive Dynamics (the compressor) — ✅ **SHIPPED → `sounder`**
Every DAW compressor requires a stimulus signal, a threshold, then attacks/decays — always late, always reacting. Freed from causality, it reads the entire waveform, sees every peak, and shapes gain reduction as a smooth, **bidirectional, globally-normalized** envelope. No detection. The **limiter** is the pure case: true brickwall limiting without distortion is *fundamentally* acausal — which is why every live limiter cheats with lookahead.

> **`sounder`** — built. The compressor member, but it landed *fused with the Histogram Waveshaper* rather than separate. It reads the whole file, builds the **time-occupancy histogram over level** (the "depth chart" — how long the signal spends at each depth), and hands you the transfer curve to *redraw the bottom*. Sonar/sounding-line framing instead of the meter-and-threshold one.
> The load-bearing discovery: its single **RMS-window knob is a regime slider.** Short window → the curve acts on near-instantaneous level (`waveshape · mangle`, <2ms); through `grain · harmonic`, `compression`, `leveling`; long window → the curve acts on the whole-piece average (`normalizing`, >500ms). One control walks continuously from *memoryless waveshaping* to *global normalization* — which **demonstrates, inside one tool, that the Histogram Waveshaper and Paracognitive Dynamics members are a single continuum** (the only difference is the timescale the value-distribution is measured over). That collapse was a thesis claim; sounder makes it a knob.

**→ multiband: ✅ SHIPPED.** The RMS window is now per-band — split the spectrum and each band gets its own window *and* curve. The regime slider became a regime **field across frequency**: waveshape the highs (sub-ms) while *compressing* the body (40ms) and *normalizing* the sub (300ms), independently — choosing which spectral region gets waveshaped and which gets leveled. Linear-phase STFT split, **perfect reconstruction** (one full-range band == single-band Sounder, Float32-exact). The thesis line is now playable: *different timescales of acausality applied to different parts of the signal at once.*

**sounder's identity has grown — it's a distribution operator, and it's becoming a rack.** The atom is **frequency-distribution × dB-distribution-per-region**: the crossover field partitions the spectrum; each region carries its own occupancy histogram, curve, and τ; selecting a region selects *which* distribution you edit (and τ *is* that histogram's measurement window — one instrument, two faces). With per-cell chaining — DAG-modeled, linear by default, collapsible flowchart, offline so every intermediate stage is free, optional mixer/merge node — sounder is turning into a real **mixing / mastering** tool. Not feature creep but the consequence of the two things already built: τ-as-regime + multiband = a *chain of regimes* = mastering. Architecture in `sounder-roadmap.md` (cell / host split).

### Histogram Waveshaper — *the one that sounds strangest soonest* · partly absorbed into `sounder`
A pure waveshaper is *memoryless* — instantaneous f(x), no time dependence — so naively acausality buys it nothing. The trick: acausality doesn't change *when* the curve applies, it changes **where the curve comes from.** Derive the transfer function from the signal's own global amplitude histogram (image histogram-EQ, applied to a 1-D audio value distribution). Compute the empirical CDF of every sample, build f as the warp of that CDF onto a target:
- onto **uniform** → statistically-driven companding; limiting and expansion fused, but principled rather than reactive.
- onto **Gaussian** → "Gaussianizing"; softens peaky transient structure.
- onto **arcsine/bimodal** (a square wave's native histogram) → squarewave-ification by *distribution matching*; distortion that makes any material statistically *want* to be a square.
- onto **another file's histogram** → amplitude-statistics transfer, the value-domain cousin of style transfer. → **slots straight into Pythia's control/source dual input: one signal donates statistics, the other is the body.**

Irreducibly un-live: you can't know the CDF until the last sample. (The live version slides a running-histogram curve — itself an interesting *drifting* distortion, but it's the degraded approximation of the clean offline thing.)

> What `sounder` already gives: the **time-occupancy distribution** and a hand-drawn curve over it, at any timescale. What's still open as a *dedicated* waveshaper: the **automatic CDF-onto-target warps** (uniform / Gaussian / arcsine / *another file's histogram*) as one-click presets rather than freehand — and the cross-file version that "slots straight into Pythia's control/source dual input." So: not fully closed, but the spine is built.

### Lloyd–Max Quantizer (the un-live bitcrusher) — *secretly load-bearing*
A bitcrusher's bins are equal-width. The **optimal** quantizer — minimum distortion for a bit budget — has bins of equal *population*: narrow where the signal lives, wide in the tails, and computing it needs the whole signal's PDF first. "A bitcrusher that has read the entire file before it begins" → minimum-character quantization. **Invert the objective** → bins placed to *maximize* audible damage → maximum-character quantization. This is the quantization thesis made into an effect: bin boundaries explicitly derived from (or perversely against) the signal's own statistics, rather than naturalized as uniform.

### Anticipatory Dust
Live dust is forward-decaying — impulse, scatter, fade. Un-live dust runs time backward: **grain clouds that crescendo *into* an event** you could only schedule because you'd already seen it. Each transient gets a precursor swarm ramping up to it — pre-echo as deliberate texture rather than codec artifact.

### Negative-Space Granulation
Analyze the full spectrogram, find the **holes** — spectral and temporal gaps — and inject grains *only* into them. Dust as the photographic negative of the signal's own activity. Needs the whole picture; no coherent live form.

### further audio members (one-line reason each is un-live)
- **Pre-verb** — acausal reverb whose tail *precedes* each hit; every transient swells into itself. Reverse reverb as principle, not tape trick.
- **Zero-phase EQ** — forward-backward filtering; EQ with literally no phase distortion because it's allowed to run backward.
- **Bidirectional transient designer** — sharpen an attack by reaching *backward* into the pre-onset, not just gating decay.
- **Future-sidechain** — ducking that ducks *before* the kick lands; the pre-pump.
- **Self-convolution reverb** — file reverberated by its own autocorrelation; needs every sample for the kernel.
- **Global spectral shaping** — flatten/warp the long-term average spectrum to a target; spectral analog of normalization.

---

## VIDEO members

The video tools aren't "do what colorists already do." They take the normally-invisible acausal operation and **make it show its hand.**

### Luminance Normalization → perverse target
Brightness-normalize over a span (the easy cousin of RMS normalization) — but to a *perverse* target, or normalize one clip's luminance distribution against **another clip's**. Control/source dual input, image domain: one clip donates statistics, the other is the body.

### Histogram Waveshaper (video) — *goes home here*
Image histogram-EQ is where the audio waveshaper was smuggled from in the first place. Closing that loop is a structural fact for the suite: the audio effect is the image technique in disguise, and Hindcast is where they're revealed as **the same operation wearing different medium-clothes.** → build the histogram tool in *both* domains at once; it's literally one algorithm, and it proves the audio/video symmetry to ourselves.

### Anticipatory Optical Flow — *the prize; the one nobody's seen* · ✅ **anticipation SHIPPED → `prolepsis`**
Flow computed across the whole clip, run **backward**, so movement smears *into* the event it's about to become — the visual exact-cousin of pre-verb and the anticipatory grain swarm. Datamosh has the look but none of the principle; this is the principled version, the image bleeding *forward in anticipation* rather than *backward in decay*. Genuinely hard to do live → the one video member that resists the "already normal" deflation, and the one that justifies the video wing existing.

> **`prolepsis`** — built. The anticipation *principle* shipped, but via the **feedback-field / framesmear** route rather than dense per-pixel flow estimation: "framesmear, unshackled." A recursive feedback buffer (decay, flow, zoom, rotation, chroma) run with the **time-arrow free** — three stances: **wake** (the old live, causal trail), **anticipation** (field run backward; each transient gets a precursor swarm ramping *into* it), and **symmetric** (forward+backward, zero-phase, balance slider weighting precursor vs wake). Because every frame is pre-rendered end-to-end, **scrubbing is instant and acausal** instead of a buffer reset — that's the un-liveness made tactile in the transport itself. Transient-aware pre-pass scales precursor density to the size of what's coming; whole-clip luminance normalization is in there too.
> Still open as the *harder* version (keep the line item alive): **true dense optical-flow estimation** run backward — per-pixel motion vectors fit to the whole clip, not a recursive smear field. `prolepsis` proves the gesture reads; the flow-estimation build is the one that's still genuinely nobody's-seen-it.

### Negative-Space (video)
Spatiotemporal analog of the audio version — inject activity only into the still/empty regions of the spatiotemporal volume.

---

## adjacencies (don't re-derive these later)

- **Pythia** is the flagship — paracognitive granular delay. The control/source dual input is the **shared interface for the whole suite**: one signal donates structure or statistics, the other is the body it gets done to.
- **ooid** is kin: a codec whose damage is organic *because it's globally fitted* (anisotropic Gaussian sediment). The anticipatory-flow and negative-space ideas share its logic — a Hindcast video member and an ooid corruption pass may be the same gesture seen from two sides.
- **Quantization thesis / Concordia retry:** the audio↔video asymmetry is the cleanest available demonstration of the contingency argument — better than the SOFAR material because it's a controlled comparison, not a reading. The Pacific/oceanic frame is *in the name itself* (hindcast = wave-field reconstruction; ties to wave-propagation undergrad work).
- **The rack is a shared *pattern*, not a shared host.** Each app gets its own isolated rack of its own cell-type — same shape (collapsible DAG; select a cell to reveal its internals), reinstantiated per app. The offline commitment makes it cheap: topological render, every intermediate stage cached and instantly scrubbable. Homogeneous-audio cross-app (Pythia→Sounder) is the near reach; a/v cross-app is parked.
- **A second audio→video transfer: the console.** The main asymmetry is causality (transgressive in audio, mundane in video). But wet/dry-per-effect and serial/parallel racks are a different import — the mixer / console paradigm. Video has opacity and blend modes (opacity ≈ layer dry/wet), but "wet/dry of an effect" and "an insert chain" are console idioms, not compositing ones. Racking Prolepsis (extreme-blur chains, wet/dry on a video effect) imports the mixer, not the strip — broadening the audio↔video asymmetry from causality alone to routing / mixing conventions. Parking-lot thesis thread; logged.
- **The inverse transfer: image compositing → audio.** The console thread carries the mixer into video; this one carries image compositing into audio — opposite direction, same acausal substrate. Photoshop's layer stack → sounder's rack; layer opacity → per-cell wet/dry; adjustment layer → cell; and the genuinely new import, the layer mask → a processing mask (a time×frequency selection on the spectrogram; the crossover field is already its frequency twin). The asymmetry runs wider this direction: Photoshop at least has a stack, but audio editing inherited the timeline/tape paradigm and grew no layer model at all — so the unclaimed territory is bigger on the audio side. Why the timeline never grew masks-and-layers: a mask and a layer composite don't care about time-order, which is exactly what a tape-descended editor can't naturalize — the same reason these are acausal-native. Mirror of the console thread; parked, logged. (Seeded concretely in sounder's analysis × application split — the 1-D ancestor of the 2-D mask.)
---

## naming notes (shelf, in case of second thoughts)

- **HINDCAST** — chosen. Forecast over a known outcome; pulls acausal-audio + wave physics + Pacific frame through one word. Native internal triptych if ever wanted: *forecast / nowcast / hindcast* — only the last is honest.
- *Manteia* (μαντεία, divination) — rejected-but-keep: stays in Pythia's Delphic register; would support a "each tool is a kind of reading" structure.
- *Prolepsis* — the figure of representing a future act as already accomplished; the theory-forward sibling.
- *Haruspex* — diviner reading entrails; foreknowledge by dissection. Too gothic for a tool suite but rhymes hard with the *Biopsy* / readable-interiors aesthetic.

---

## status — what's on board (and what's next)

**Shipped:**
- **`pythia`** — flagship. Paracognitive granular delay; the control/source dual input that's the shared interface for the whole suite.
- **`sounder`** — the **distribution operator**: frequency-distribution × dB-distribution-per-region. **Multiband shipped** — per-band τ/curve/floor, linear-phase perfect-reconstruction split, regime-field across frequency. Time-occupancy depth chart + redrawable transfer curve per band; RMS-window-as-regime-slider (waveshape → compression → normalizing). Now growing toward a **racked mastering tool** (cell / host refactor next).
- **`prolepsis`** — the anticipation member (video), via the feedback-field route. Wake / anticipation / symmetric stances; acausal scrubbing.
- **`Horn of Plenty`** — specced, unbuilt. The **stationarizer / audio texture-synthesis** member: eats a non-stationary recording, emits a stationary substrate for downstream random-access resynthesis. Felt-not-weave (whiten the drift, keep the grain color); power-domain blue-noise matching-pursuit; fiber-length × whiteness handed to the user, seeded by the autocorrelation-length cut. Sits behind the sounder rack in priority.

**Next moves (ordered by leverage):**
1. **`sounder` → cell / host refactor + rack** — dissolve the intake panel into a clean **cell** (freq-dist × dB-dist + waveform) and a **host** (file / transport / master); then a per-app **rack**: DAG-modeled, linear by default, collapsible flowchart, per-cell wet/dry, offline intermediate-caching, optional mixer/merge node. Pushes sounder into a real mixing/mastering tool. *(The multiband STFT → Worker + STFT-cache is paused underneath this.)*
2. **Histogram-waveshaper presets** — the automatic CDF-onto-target warps (uniform / Gaussian / arcsine / another-file's-histogram) as one-click modes inside `sounder` (now per-band), plus the cross-file version on Pythia's control/source input. Closes the audio↔image histogram loop.
3. **Lloyd–Max quantizer** — load-bearing for the larger argument; the quantization thesis as a playable object. Optimal (equal-population) bins vs *inverted* (max-damage) bins.
4. **Dense anticipatory optical flow** — the harder video build `prolepsis` gestures at: per-pixel flow fit to the whole clip, run backward. The one that's still genuinely unseen.

---

*spine: effects that have read to the end of the score before they begin.*
