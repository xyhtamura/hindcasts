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

## position — redistribute (the third valence)

The thesis above has two valences: audio *reveals* a buried contingency, video *refuses* a naturalized one. There's a third that motivates the suite as much as either — **redistribute**. Realtime isn't only an aesthetic commitment with a sedimented history; it's a **hardware rent**. A causal effect must finish its entire computation inside the buffer window — a budget fixed by sample rate and silicon speed, not by ambition. An acausal effect has unbounded compute budget; it only costs patience. Patience is the one resource distributed opposite to bandwidth and GPUs. Realtime converts algorithmic ambition into a silicon requirement; offline converts it into waiting — a different political economy of the effect, not a workaround.

**The Instagram-filter case makes the gating legible as ideological, not technical.** No face-melting filter needs to be live — a 2016 phone could apply it to a saved clip in a minute. It's gated on the Neural Engine because it ships inside the preview loop: liveness as UX doctrine, the selfie-mirror as the assumed site of the effect. "Effect" and "realtime causal system" fused the same way in video as in audio, and both fusions double as paywalls.

**The pitchbend case is two problems, answered by two different projects.** One is the latency loop — performance-precision needs body→system→ear under ~10ms, a budget bought with proximity to fast infrastructure. The other survives even after you give up performing it: MIDI pitchbend isn't an inscription, it's a transmission-line datum, a stream of 14-bit events wearing a curve costume — the DAW's automation lane is a grudging visualization of that stream, never the pen tool. TaboTa's `{from, to}` spline is the repair: inscription-precision needs no latency loop, only undo. So **TaboTa fixes inscription of control** (why can't I pen-tool a glide), **Hindcast fixes acausality of processing** (why must the effect be live). Both say: expressivity that doesn't require a low-latency loop is expressivity that doesn't require infrastructure.

**Lineage to claim, not invent.** Offline rendering is the historic poverty-of-means technique — trackers on Amigas, demoscene precalculation, the overnight render, early CG farms grinding for days. Limited machines could always compute anything; they just couldn't compute it *now*. Thirty years of industry effort converted "eventually" into "live" and called it progress — quietly redefining access: the old regime asked for your time, the new one asks for your hardware. Turn-based vs realtime, download vs stream, emulation vs cloud gaming: same fork everywhere.

**The strong claim, not the weak one.** Don't let this collapse into "non-realtime because poor" — that framing invites the rebuttal that the practice obsolesces the moment infrastructure improves. The stronger claim: **the lag is an epistemic instrument.** The realtime commitment is invisible where latency is cheap; it only shows itself where it fails (infrastructural inversion — the broken tool discloses its assumptions). The peripheral position isn't the *cause* of the aesthetic, it's the *vantage* from which the contingency became legible at all, for people to whom "effect = live causal system" was never water they had to notice. The audio/video controlled comparison demonstrates the contingency logically; lived infrastructural lag demonstrates it materially — two proofs of one theorem. And infrastructure improving doesn't retire the position, because the position was never really the lag — it was the vantage the lag opened. (Twenty years composing from inside lag doesn't teach tolerance for non-realtime; it trains thinking from inscription, global statistics, whole-file-at-once — a sensorium that outlives the constraint and keeps generating objects realtime-native vocabulary structurally can't conceive, because that vocabulary's whole idea of "effect" is causal.)

**Precise citation trail, not metaphor.** The reflex here is "crip theory" — build for the excluded, everyone benefits (curb-cut effect: lookahead limiters and offline mastering are already the mainstream secretly relying on acausality). But curb-cut is assimilationist — the accommodation gets absorbed, the norm stays intact. Closer: Alison Kafer's **crip time** — bend the clock to meet the body, not the body to meet the clock. Hindcast is crip time for signals: the realtime loop presumes a normate body-infrastructure compound (sub-10ms reflexes *and* sub-10ms audio stack, both at once); instead of helping the chain limp toward that norm, refuse the norm. An effect that has read to the end of the score isn't a slower live effect — it's exempt from the clock. Disability theorists are rightly wary of disability-as-metaphor with no disabled people in frame; the more precise term for *this* body (the geopolitical one, not an individual one) is Jasbir Puar's **debility** — the slow, massified, geopolitically distributed wearing-down of capacity in the Global South, distinguished from disability as a Northern rights-bearing identity. Infrastructural lag is debility in close to the textbook sense. Kept as kin concepts, named precisely rather than collapsed.

**The fax machine is the third leg, not a joke about anachronism.** A fax is an inscription technology — it transmits a page, not a message stream: a document with material authority, stamp-able, legally itself. Japan didn't fail to modernize the document; it kept the document as the unit while modernizing everything around it. Fax-and-robotics coexistence isn't a contradiction — it's proof technologies don't sit on one modernization axis (Bloch's non-simultaneity of the simultaneous; Williams's residual-alongside-emergent; Yuk Hui's plural cosmotechnics — no single arrow of technical time, only practice-worlds each maintaining the commitments they need). The residual isn't lag, it's a *maintained ontology*. **TaboTa is the fax machine's ontology built into a music notation** — the page that travels, the mark that holds, `.tab` as a document you open rather than a process you must stay plugged into.

**The braid.** "Behind" only exists on a single-axis model of modernity. Two inheritances refute that model from opposite ends: scarcity (lag as epistemic instrument, debility as vantage) and abundance (the fax as deliberate residual, advanced and anachronistic in the same body). Holding both isn't standing between two speeds of modernity — it's standing where the single-axis picture is visibly false twice over. Strongest place to put "how do you do Frutiger Aero from the Pacific": Frutiger Aero was an aesthetic of frictionless synchronous abundance, rebuilt from a position where time was never frictionless and never needed to be. Hindcast's name already carries the oceanography (hindcast = wave-field reconstruction) — the suite stops reading as a clever DSP inversion and becomes: **effects for the periphery, which turn out to be the ideal effects everyone else was already approximating with lookahead.** The live limiter cheats toward acausality; the "degraded" position was aimed at the ideal all along.

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

### Horn of Plenty — *the stationarizer; scrap into yardage* · ✅ **MVP SHIPPED → `horn-of-plenty/index.html`**
Every other audio member redraws values on a fixed timeline or schedules grains around events. This one rebuilds the timeline itself to a statistical target: feed it a *non-stationary* recording — sand that runs out, paper that goes thin and tears, a pour dense at the top and sparse at the bottom — and it emits a **stationary substrate**, material whose statistics don't depend on where you read. Not a bed for a listener playing front-to-back; a **substrate for a downstream resynthesizer doing random access**, so a sampler or granulator can land its read head *anywhere* and get the same evenness and the same full variation. The whole-envelope life is reintroduced downstream by the consumer's own envelope — so this layer's job is to be neutral and even, and the flatness gets driven *hard* (no liveliness knob; deadness-in-dynamics is correct here).

The metaphor is **felt, not weave.** A weave is periodic — warp/weft regularity is exactly the structure to destroy. Felt is nonwoven: fibers matted in random orientation, no periodic component, the same everywhere — *cut it anywhere and the swatch is the same material.* So the operation is precise about what it keeps: **whiten the non-stationarity, preserve the stationary structure.** Kill the position-dependence (the exhaustion curve, the drift); keep the position-*independent* color (the burst-shape of a single crackle, the short-time correlation that makes paper sound like paper and not like clicks). Full grain-scale scramble overshoots — it flattens the drift *and* the material signature, and you get felt that's lost its wool: even, samples-anywhere-fine, sounds like filtered noise. *Stationary ≠ white.*

The two failure modes name the two orders of stationarity. "Silence then a crackle at the end" is **first-order** failure — the energy distribution drifts with position. "The same sound again and again" is **second-order** failure — the autocorrelation has periodic structure. A flat envelope only fixes the first; you can hold perfectly flat power while one grain repeats on a clock. The fix for the second isn't *more grains* — periodic reuse is the killer, random reuse at the same average rate is far less audible. Schedule onsets *and* identity-reuse as **blue noise**: evenly spread, no periodic component, every recurrence jittered past a similarity window. Buy palette by transforming reused grains (micro pitch-shift, EQ, reversal — thematically ours) so a returning crackle reads as *another* crackle, not the same one.

This is **audio texture synthesis** — the image swatch-into-infinite-texture problem rotated ninety degrees into time, the temporal sibling of the compositing→audio thread. The image lesson transfers exactly: synthesize by *global* statistics alone → mush; synthesize by *local-neighborhood* statistics → novel material everywhere locally faithful to the example, never a global copy. So grain succession is drawn from the source's own transition structure, keeping the higher-order statistics *colored* (paper-like) rather than *white*.

> **Construction (scrappy-robust; solver only to trim).** Stays in the **power domain** — decorrelated grains add in power, not amplitude (two equal grains = +3 dB; √N for N), which makes placement **linear**: needed overlap density = target power ÷ mean grain power, no search. Segment → grain library with per-grain power + spectral descriptor (the **depth chart, over grains**) → blue-noise onsets at that density, drawn to pull each neighborhood's grain-type histogram toward the global one → trim per-grain gains to flatten residual ripple → **one backward pass to shave heaps** (the acausal move: reach back and delete from an overfull region, because there's no committed past). **Source-position diversity is a hard constraint** among overlapping grains — correlated overlap breaks the power-add linearity and combs. The full least-squares whole-signal solve buys the last sliver of flatness, which you mostly don't want. Superpowers: **global statistics + whole-signal optimization** — the one member whose entire output *is* a statistical object.

> **The live fork → handed to the user.** The load-bearing parameter is **fiber length** (how far above the single grain the preserved correlation reaches) × **whiteness** (how fully the supra-grain statistics scramble — full-white most-novel/risks-generic vs neighborhood-preserving keeps the micro-grammar). Both resolved by *trial and error*, seeded by a principled **suggested cut**: the source's own autocorrelation length, measured whole-file before a grain is committed — the felt's natural fiber length read off the material. Cheap because grains are **configs, not buffers** (re-cut = re-derive; audition as fast as you drag). Presets are points on that plane — **gauze / felt / tweed**, each a named (fiber, whiteness) coordinate.

**Effort is proportional to non-stationarity.** Running water is the degenerate floor — already stationary, near-noise higher-order statistics — so the tool nearly no-ops it and "turn it on for thirty seconds" is pure duration-authoring over an identity pass. Sand-running-out and paper-tearing are the ceiling, all frayed-end and thin-patch, where the flattening does real work. Looping is a non-problem: generate long enough that no wrap is needed and let the sampler crossfade. The name is the one place in the suite that names the **vessel, not the power** — the cornucopia that never empties (Amalthea's horn, kept as connotation), punning on goat-horn *and* musical-horn; it sells the *outcome* (endless material) where Sounder names the *method*. Completes the suite arc: Pythia/ProLepsis own time, Sounder owns value-mapping, **Horn of Plenty owns the boundless whole.**

### Proteus — *the morph that has read both scores* · ✅ **MVP built → `proteus/proteus.html`**
The acausal answer to the realtime morph plugins (Zynaptiq MORPH, Melda MMorph). Morph is image-native — Zynaptiq's own pitch is "one face becoming another," and image morphing (Beier–Neely) was never live: correspondence over whole frames, then warp and blend. The audio plugins kept the warp-and-blend and dropped the acausality; a causal morph can only marry frame *t* of A to frame *t* of B, whatever is simultaneous. Proteus repatriates the operation. Four stances on one engine: **HANDFAST** (DTW-align both whole files, then morph the aligned pairs — the stance realtime cannot have even in principle), **MATCHMAKE** (each A-frame seeks its best partner *anywhere* in B, Viterbi-smoothed — the donor as library, not timeline), **ORACLE** (donor = the same file, later; timbre morphing toward its own future — Remanence prints amplitude backward, Oracle prints *timbre* backward), **BARYCENTER** (interpolate the whole-file spectral distributions — Sounder's distribution operator given a second input). Engine bet: frame-wise **1-D optimal transport** (displacement interpolation — spectral mass *moves* instead of fading in place, so pitch glides rather than double-exposing), with transport maps smoothed over the whole clip — the acausal repair the realtime version of the idea (Henderson & Solomon's Audio Transport) structurally can't make. Morph amount is a **drawn curve, not a knob** — the TaboTa inscription argument applied to the morph dimension. Reuses Pythia's control/source dual input. Spec: `proteus/proteus.md`.

### Metachamber — *the chamber shaped by both horizons; wake, anticipation, and symmetric bloom* · ✅ **bidirectional MVP built → `metachamber/index.html`**
Reverb's original sin: the tail cannot know how much room it has — **mud is a tail colliding with an event it couldn't see.** Metachamber reads the whole file, builds the shared **gap map**, and solves separate room budgets for each event's preceding and following silence. Two orthogonal axes keep the model legible: **Caesura policy** = FIT (directional RT60 solved per event) or DUCK (fixed long room with zero-phase wet rides); **Time Arrow** = WAKE (forward FDN recursion), ANTICIPATION (backward FDN recursion into real output head room), or SYMMETRIC (both directions, equal-power balanced). This absorbs pre-verb as an actual reverse-integrated room rather than a mirrored wet paste. Each horizon gets its own masking-aware budget check and post guard; symmetric verifies both. **Caesura is suite substrate, not private** — the shared gap-aware mechanic serves Metachamber diffuse fields and Pythia repeat trains while their engines remain separate in kind. MVP ships deterministic three-room bidirectional FDN rendering, head-aligned dry A/B, directional waveform wedges, exact-buffer preview, and float WAV bounce. HOLLOW, room-law drawing, per-band sensing, exact per-event kernels, and alternate kernel sources remain deferred.

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
- **Pre-verb** — acausal reverb whose tail *precedes* each hit; every transient swells into itself. Reverse reverb as principle, not tape trick. *→ absorbed into Metachamber (ANTICIPATION time arrow).*
- **Zero-phase EQ** — forward-backward filtering; EQ with literally no phase distortion because it's allowed to run backward.
- **Bidirectional transient designer** — sharpen an attack by reaching *backward* into the pre-onset, not just gating decay.
- **Future-sidechain** — ducking that ducks *before* the kick lands; the pre-pump. *→ the on-own-wet case absorbed into Metachamber (DUCK stance); the cross-signal case still open.*
- **Self-convolution reverb** — file reverberated by its own autocorrelation; needs every sample for the kernel. *→ deferred into Metachamber as a kernel-source option.*
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

### CyberScotoma - *the scintillating graft; the aura pinned* - **SHIPPED -> `sgueltch/cyberscotoma`**
CyberScotoma is the Hindcasts/Sgueltch hinge: a scotoma is a missing region in the visual field, but the migraine aura is a hole that arrives before the pain it announces. The tool turns that into an acausal video effect. Voronoi hold-regions stop refreshing, keep receiving the current motion field, and fill with donor-descended content. At onset, donor content can come from `t + donorOffset`; positive offset means the future bleeds backward into the present. A second donor clip can also supply the tissue inside the scotoma, making the Pythia control/source dual input visible in video.

It is datamosh without honoring the codec block. Classic mosh artifacts expose a compressed bitstream's lattice; CyberScotoma decodes to frames, estimates its own motion field, and gives the blind region a noised non-grid cellular boundary. Superpower used now: **precognition**. Roadmap pushes toward **bidirectionality** via anticipatory/backward motion, and toward **global statistics** via whole-clip auto-placement at motion extrema or negative-space stillness.

> **`cyberscotoma`** - built at `https://xyhtamura.github.io/sgueltch/cyberscotoma/`. Shipped pieces: non-grid Voronoi hold regions, drawn bloom curve, latch, motion drag, acausal donor offset, cross-clip graft, cached offline render, and WebM export. It belongs here because its core effect has read the donor timeline before it begins; it belongs to Sgueltch because the temporal stance is also a biological lesion.

### Negative-Space (video)
Spatiotemporal analog of the audio version — inject activity only into the still/empty regions of the spatiotemporal volume.

---

## AUDIO + VIDEO members (the hinge)

### Remanence — *magnetic print-through; the tape remembers forward* · ✅ **SHIPPED (prototype) → `hindcasts/remanence`**
The suite's **first true audio+video member** — one reel engine, both media. A wound reel imprints
itself: loud moments print a faint copy onto neighbouring wraps, heard as **pre-echo** (ghost before
the hit) and post-echo. Remanence is that defect as an instrument, and its acausality is *forced by
physics, not chosen*: wear is a **dose integrated over the material's whole life** (∝ amplitude ×
play-count, deposited over storage), and print-through's pre-echo literally needs a future sample —
a live effect can't integrate a path it hasn't finished. This is pre-verb / anticipatory-dust as a
*real* defect, where the grains are the actual future signal placed by reel geometry.

Engine: a **position-varying multi-tap delay with negative taps allowed** (audio) / the same reel
composited over frames (video). Reel period T_N = 2π(r₀+Nd)/v drifts hub→rim, so echo spacing
drifts across the clip; **Wind** = the reel's wind direction = pre/post = Prolepsis's stance switch,
physically motivated. Superpowers now: **precognition + bidirectionality**; roadmap adds
**global statistics** (wear/dropout placed by whole-clip occupancy/recurrence).

Every control is A·V; only **Tilt** splits medium — temporal low-pass (audio) vs ghost box-blur
(video, print's *spatial* LF bias). Presets **FAITHFUL → HAUNTING → REEL-FOLD → PRE-SWARM** walk the
faithful↔hyperreal continuum on one engine (same trick as sounder's τ). WAV/WebM export, fullscreen
drop, clean previewer. Full spec: `remanence/remanence.md`.

> **Non-local reel-fold shipped:** true Archimedean-spiral geometry (k-th neighbour = same phase,
> k wraps out — taps spread outward / bunch inward) + a **Fold** control coupling across the reel
> mirror, so clip-distant / reel-adjacent moments cross-print. Closed-form (e^{s·W(n)}=1+s·n/O₀), both
> media. **Shipped since:** wow/flutter (shared transport warp, both media), HF self-erasure (climax
> dulls itself, occupancy-driven), map-driven dropout, head-switch (the one *grid*, framerate-locked +
> whoosh). Cranked, these are the **MELT** Sgueltch-crossover zone — a preset now, not a future zone.
> VHS Hi-Fi (audio FM-encoded via the video heads) is where the suite's audio↔video asymmetry
> physically collapses — the reason this member is a/v at all. Next: modulation noise/hiss off the same
> wear/transport map; other media as coupling geometries (vinyl groove wear, optical-film strip).

---

## suite placement rule (Hindcasts ↔ Sgueltch)

Corruption-forward + *specially organic* substrate (ooze / tissue / lesion / mycelium / marbling /
Voronoi cell) ⇒ **Sgueltch**. Utility- or whole-file-analysis-forward, with glitch a side effect or
present-but-not-specially-organic (Prolepsis) ⇒ **Hindcasts**. Hinge members live in one home and are
kept as *kin* in the other: **CyberScotoma** is Sgueltch-home / Hindcasts-kin (biological lesion +
non-grid macroblock refusal); **Remanence** is Hindcasts-home / Sgueltch-kin (whole-file acausal
print-through; analog-magnetic, not biologically organic).

---

## symmetry — the shared time-arrow contract *(2026-07-17; contract written, gaps being built)*

Pythia, Metachamber, and Prolepsis share the WAKE / ANTICIPATION / SYMMETRIC grammar. **Symmetry** promotes that grammar from a coincidence of three UIs to a contract: what you can do in one member you can do in the others, and a proposed control can be checked against the list. Five items:

1. **Time Arrow** — WAKE / ANTICIPATION / SYMMETRIC. Time (or the medium's displacement analog) is a magnitude; stance owns direction.
2. **Balance** — equal-power Anticipation ↔ Wake, live only in SYMMETRIC.
3. **Caesura policy** — OFF / FIT / DUCK, with Spill and Masking Credit subordinate to FIT and DUCK. OFF is gap-unaware: the directional fields render at their fixed law, nothing fits or rides. **Sensing controls are shared vocabulary too** *(planned 2026-07-17)*: onset threshold, what counts as an event, the operational floor — the analyzer's parameters surface uniformly wherever Caesura is on, instead of staying hardcoded per app.
4. **Wet layer** — one switch changing the mix law from equal-power insert to send-style layering: dry at unity, both directional wets at full. With Caesura OFF this is the quick-and-dirty stack — wet pre-delay/pre-verb plus wet delay/verb straight on top of the signal.
5. **Substrate** — one canonical gap map (`shared/gap-map.js`); members derive policy, never grow analyzers.

**The anti-scope guard is part of the contract.** Symmetry is the quick-and-dirty effect: one engine, linked parameters, one balance knob. Independently voiced halves — a pre-verb of a different quality than the verb, the two mixed precisely — belong to the rack. A control joins the contract only if it stays linked across both directions; anything per-direction is rack territory.

Status (2026-07-17):

| contract item | Pythia | Metachamber | Prolepsis |
|---|---|---|---|
| Time Arrow | ✅ | ✅ | ✅ |
| Balance | ✅ | ✅ | ✅ |
| Caesura OFF | ✅ (toggle) | ☐ planned | — |
| Caesura FIT | ✅ repeat budget | ✅ per-event RT | ☐ via audio input |
| Caesura DUCK | ☐ planned | ✅ | — |
| Wet layer | ☐ planned | ☐ planned | ☐ with wet/dry |
| gap-map substrate | ✅ | ✅ | ☐ planned consumer |

Prolepsis holds the time-arrow half natively; the Caesura half arrives through the **audio control input** (`prolepsis/prolepsis.md` roadmap #4): the gap map is audio-native, so sound-determines-blur makes Prolepsis a third Caesura consumer rather than a new analyzer — and makes it the suite's second audio+video member (placement unchanged: utility-forward, Hindcasts-home).

---

## adjacencies (don't re-derive these later)

- **CyberScotoma** is the bridge to Sgueltch: a biological visual-field lesion that becomes a precognitive video graft. It carries the shared control/source input into cross-clip donor tissue and keeps the datamosh artifact non-grid by refusing macroblock inheritance.
- **Pythia** is the flagship — paracognitive granular delay. Its WAKE / ANTICIPATION / SYMMETRIC time-arrow grammar now matches Prolepsis and Metachamber. Its control/source dual input is the **shared interface for the whole suite**: source is the body/dry signal; control is the sidechain or structure donor, with polarity (follow/off/duck), gate shape, lookahead, and optional monitor. Statistics-donor modes should reuse this input, not invent a third lane.
- **ooid** is kin: a codec whose damage is organic *because it's globally fitted* (anisotropic Gaussian sediment). The anticipatory-flow and negative-space ideas share its logic — a Hindcast video member and an ooid corruption pass may be the same gesture seen from two sides.
- **Quantization thesis / Concordia retry:** the audio↔video asymmetry is the cleanest available demonstration of the contingency argument — better than the SOFAR material because it's a controlled comparison, not a reading. The Pacific/oceanic frame is *in the name itself* (hindcast = wave-field reconstruction; ties to wave-propagation undergrad work).
- **Medium-agnostic control (parked 2026-07-17).** The control/source input need not share the body's medium. Audio control driving video (Prolepsis roadmap #4, sound-determines-blur) has a mirror: **video control driving audio** — a motion gap map (Metachamber's deferred "video cousin," gap-to-next-motion, velocity as trigger) budgeting Pythia repeats or Metachamber tails. One canonical analyzer per medium, like `shared/gap-map.js`; consumers stay medium-blind. Parked until the audio→video direction ships.
- **The rack is a shared *pattern*, not a shared host.** Each app gets its own isolated rack of its own cell-type — same shape (collapsible DAG; select a cell to reveal its internals), reinstantiated per app. The offline commitment makes it cheap: topological render, every intermediate stage cached and instantly scrubbable. Homogeneous-audio cross-app (Pythia→Sounder) is the near reach; a/v cross-app is parked.
- **A second audio→video transfer: the console.** The main asymmetry is causality (transgressive in audio, mundane in video). But wet/dry-per-effect and serial/parallel racks are a different import — the mixer / console paradigm. Video has opacity and blend modes (opacity ≈ layer dry/wet), but "wet/dry of an effect" and "an insert chain" are console idioms, not compositing ones. Racking Prolepsis (extreme-blur chains, wet/dry on a video effect) imports the mixer, not the strip — broadening the audio↔video asymmetry from causality alone to routing / mixing conventions. Parking-lot thesis thread; logged.
- **The inverse transfer: image compositing → audio.** The console thread carries the mixer into video; this one carries image compositing into audio — opposite direction, same acausal substrate. Photoshop's layer stack → sounder's rack; layer opacity → per-cell wet/dry; adjustment layer → cell; and the genuinely new import, the layer mask → a processing mask (a time×frequency selection on the spectrogram; the crossover field is already its frequency twin). The asymmetry runs wider this direction: Photoshop at least has a stack, but audio editing inherited the timeline/tape paradigm and grew no layer model at all — so the unclaimed territory is bigger on the audio side. Why the timeline never grew masks-and-layers: a mask and a layer composite don't care about time-order, which is exactly what a tape-descended editor can't naturalize — the same reason these are acausal-native. Mirror of the console thread; parked, logged. (Seeded concretely in sounder's analysis × application split — the 1-D ancestor of the 2-D mask.)
---

## penciled — the essentials ledger *(2026-07-12; candidates, not commitments)*

Sounder and Pythia are the suite's most canonical replies because they answer *inserts every session already has* — dynamics and delay. Horn of Plenty is unique but not an every-session insert. This ledger lists the remaining **essentials** — effects a DAW or NLE session reaches for by default — where the whole-file intervention buys something the live version structurally cannot have. Ordered roughly by how essential the slot is.

**Priority note (2026-07-12).** Hindcasts members can be effects (Proteus), even non-grid corruption (the Sgueltch intersect) — but the spine priority is **simple, practical usage** in the Sounder/Pythia mold. Clean-up and restoration count as essentials here: the restoration category (de-noise, de-verb, spectral correction) is where commercial audio already sells acausality *as a workaround* — Hindcasts sells it as the point.

### audio

- **Gap-aware reverb** — *the biggest open slot.* ✅ **promoted same day → full member `Metachamber` (specced, `metachamber/metachamber.md`); see AUDIO members.**
- **Resonance suppressor, omniscient** — the Soothe/Gullfoss/UNFILTER slot. Soothe and Gullfoss are running-estimate detectors, forever chasing; Zynaptiq UNFILTER is the widest live claim in the category — adaptive filter *inversion* (undo resonances, comb filtering, wah, even some room) sold as realtime, which means its estimate of "the filter to undo" is forever a running guess about a whole-file fact. The acausal version has the whole spectrogram: every resonance known over the piece's full duration, the long-term transfer function estimated *once and globally* (the inverse filter is a whole-file statistic — exactly the thing a live process must approximate), suppression zero-phase, masking solved as **one global assignment problem**. Doubles as the suite's **clean-up/restoration** essential — the practical-wing member par excellence. Superpowers: **global statistics + bidirectionality + whole-signal optimization**.
- **The de-LFO** (chorus / flanger / phaser) — replace the causal oscillator with a curve **drawn or fit against known events**. Chorus is already Pythia (Oracle Chorus); flanger needs a future signed displacement curve extending scalar Time magnitude + stance. Through-zero flanging is secretly acausal-native: live TZF delays dry as a hidden lookahead confession, while an offline curve crosses zero honestly.
- **Intonation as distribution** (pitch) — Melodyne is the industry's lone acausal citizen, but its target is still the grid. Hindcasts stance: snap to the take's **own pitch histogram** (self-consistent intonation, not equal temperament), or cross-file **intonation transfer** on Pythia's control/source input. Sounder's histogram move rotated from amplitude into pitch. Superpower: **global statistics**.
- **Precognitive gate** — gates chop attacks because they open on evidence; this one opens *before* the onset, hold fit to the known gap. One-liner class; kin of the bidirectional transient designer.
- **Mono-fold, solved globally** (monocompatibility) — the mastering utility that is *still strangely live*: correlation meters are running estimates, and the fix is by-ear M/S surgery while staring at a needle. Acausal version: fold the whole file to mono **once**, produce the time×frequency **cancellation map** (exactly where and when the fold loses energy against the stereo original), then solve the repair globally — frequency-dependent phase rotation / per-band width / micro-delays chosen as **one whole-file constrained optimization**: minimum audible change to the stereo image subject to the mono-sum constraint. The anomaly makes it pointed: mastering is already audio's least-causal corner (streaming LUFS normalization is whole-file statistics as industry plumbing), yet its mono meter still twitches in realtime. Sounder-rack kin. Superpowers: **global statistics + whole-signal optimization**.

### video

- **Stabilization made expressive** — *the* NLE essential, already whole-clip acausal and maximally invisible-corrective, which makes it the perfect refusal target (the video-valence move at full strength). Stabilize onto **perverse path targets**; anti-stabilize (inject another clip's shake); stabilize clip A onto **clip B's camera path** — the control/source dual input in the camera-motion domain. Superpower: **whole-signal optimization**.
- **Motion stationarizer** (retiming / speed ramp) — Horn of Plenty rotated into motion: retime the clip so motion density is stationary (constant flow-magnitude per second), or ramp toward a drawn statistical target. Optical-flow retiming with the target **statistical, not editorial**. Superpowers: **global statistics + whole-signal optimization**.

### control streams (the third medium)

- **Groove Lloyd–Max** (MIDI / onset quantize) — the quantization thesis over *time itself*: quantize bins fit to the take's own onset-timing distribution (equal-population bins = the take's own groove made explicit as a grid), or inverted for maximum damage. The Lloyd–Max member's exact logic, rotated from sample values to event times — and the move that extends the suite past audio/video to **symbolic and control streams** (MIDI, automation, tempo maps: whole-take tempo fit is the corrective cousin).

---

## naming notes (shelf, in case of second thoughts)

- **HINDCAST** — chosen. Forecast over a known outcome; pulls acausal-audio + wave physics + Pacific frame through one word. Native internal triptych if ever wanted: *forecast / nowcast / hindcast* — only the last is honest.
- *Manteia* (μαντεία, divination) — rejected-but-keep: stays in Pythia's Delphic register; would support a "each tool is a kind of reading" structure.
- *Prolepsis* — the figure of representing a future act as already accomplished; the theory-forward sibling.
- *Haruspex* — diviner reading entrails; foreknowledge by dissection. Too gothic for a tool suite but rhymes hard with the *Biopsy* / readable-interiors aesthetic.

---

## status — what's on board (and what's next)

**Shipped:**
- **`cyberscotoma`** - shipped at `https://xyhtamura.github.io/sgueltch/cyberscotoma/`. The scintillating-scotoma graft: non-grid Voronoi hold regions, drawn bloom, motion-field advect, acausal donor offset, cross-clip donor, cached offline render, WebM export.
- **`pythia`** — flagship. Paracognitive granular delay; **full rebuild + linked symmetry shipped and verified** (2026-07-17): Time magnitude with WAKE / ANTICIPATION / SYMMETRIC stance, Anticipation ↔ Wake balance, ⥀/𓆙 clip semantics, Scatter, directional feedback + damping, polarity sidechain, Caesura Gap Fit, BPM sync, pitch/pan spray + ping-pong, and deterministic Worker Bounce WAV. Symmetric bounce aligns exact forward/backward engines, extends both head and tail, and applies one acausal peak ceiling; v8 migration preserves old signed-Time states.
- **`sounder`** — the **distribution operator**: frequency-distribution × dB-distribution-per-region. **Multiband shipped** — per-band τ/curve/floor, linear-phase perfect-reconstruction split, regime-field across frequency. Time-occupancy depth chart + redrawable transfer curve per band; RMS-window-as-regime-slider (waveshape → compression → normalizing). Now growing toward a **racked mastering tool** (cell / host refactor next).
- **`prolepsis`** — the anticipation member (video), via the feedback-field route. Wake / anticipation / symmetric stances; acausal scrubbing.
- **`remanence`** — the **print-through reel**; the suite's first **audio+video** member. Whole-file acausal multi-tap with negative (pre-echo) taps; reel geometry drifts the echo hub→rim; Wind = pre/post time-arrow. Video = same reel over frames + Tilt-as-ghost-blur. FAITHFUL→PRE-SWARM continuum, WAV/WebM export. Hindcasts-home / Sgueltch-kin (see placement rule). Spec: `remanence/remanence.md`.
- **`Proteus`** — **MVP built** (`proteus/proteus.html`). The **acausal morph**. MVP: DAW two-lane timeline with draggable B (manual-align), drawn morph curve, **Transport↔Fade** phase-vocoder engine (1-D optimal-transport displacement-interp vs fade), mono/per-channel, WAV export. Verified — pitch *glides* under the curve (mass moves, not fades). Deferred: auto-DTW / MATCHMAKE / ORACLE / BARYCENTER stances, OT peak-grouping, formant split, map smoothing. Name provisional. Spec + status: `proteus/proteus.md`.
- **`Horn of Plenty`** — ✅ **MVP shipped** (`horn-of-plenty/index.html`). The **stationarizer / audio texture-synthesis** member: eats a non-stationary recording, emits a stationary substrate for downstream random-access resynthesis. Shipped: winnow → sow → flatten → stereo pour → loop-audition → WAV export; grain × whiteness spine, pitch/reverse/spread motion, 0 dB loudness guardian, four presets (Mist/Sand/Orchard/Husk), autocorrelation suggest. Validated ~0.98 head/tail RMS on an 8.8× drifting source. Spec + deferred (matching-pursuit solver, neighborhood-histogram selection): `horn-of-plenty/horn-of-plenty.md`.
- **`Metachamber`** — ✅ **bidirectional MVP built and verified** (`metachamber/index.html`; spec/status in `metachamber/metachamber.md`). The **both-horizons reverb** and first Caesura consumer: versioned whole-file gap map, separate preceding/following Spill + masking budgets, deterministic three-room FDN running forward (WAKE), backward (ANTICIPATION), or both (SYMMETRIC), orthogonal FIT/DUCK policy, head-aligned dry A/B, directional budget guards, and 32-bit float WAV bounce. Node DSP/schema/WAV/worker-transfer tests and in-app browser lifecycle pass. Deferred: HOLLOW, room-law drawing, per-band sensing, exact per-event kernels, and per-event hypergeometry.

**Next moves (ordered by leverage):**
0. **Symmetry contract build-out** *(added 2026-07-17)* — Metachamber Caesura OFF (smallest), Pythia Caesura DUCK (closes the matrix), Wet layer switch in both, then Prolepsis audio control input (envelope mode, then gap-map mode). Contract + status table in the symmetry section above; consumer ledger in `DEPENDENCIES.md`.
1. **`sounder` → cell / host refactor + rack** — dissolve the intake panel into a clean **cell** (freq-dist × dB-dist + waveform) and a **host** (file / transport / master); then a per-app **rack**: DAG-modeled, linear by default, collapsible flowchart, per-cell wet/dry, offline intermediate-caching, optional mixer/merge node. Pushes sounder into a real mixing/mastering tool. *(The multiband STFT → Worker + STFT-cache is paused underneath this.)*
2. **Histogram-waveshaper presets** — the automatic CDF-onto-target warps (uniform / Gaussian / arcsine / another-file's-histogram) as one-click modes inside `sounder` (now per-band), plus the cross-file version on Pythia's control/source input. Closes the audio↔image histogram loop.
3. **Lloyd–Max quantizer** — load-bearing for the larger argument; the quantization thesis as a playable object. Optimal (equal-population) bins vs *inverted* (max-damage) bins.
4. **Dense anticipatory optical flow** — the harder video build `prolepsis` gestures at: per-pixel flow fit to the whole clip, run backward. The one that's still genuinely unseen.
5. **`remanence` → modulation noise/hiss + non-Archimedean reels** — amplitude-riding floor off the existing wear/transport map; then impossible reel geometries beyond the physical Archimedean spiral (circle-loop / negative-grow collapse / user-drawn reel law) as the next dequantization move; then other media as coupling geometries (vinyl play-count, optical-film strip position). *(Occupancy wear map, wow/flutter, head-switch, and non-local reel-fold are all **shipped**, both media.)*

---

*spine: effects that have read to the end of the score before they begin.*
