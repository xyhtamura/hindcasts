# PROLEPSIS — notes & roadmap

*hindcast feedback field — video anticipation member. Live at `hindcasts/prolepsis/`.*

Status: **shipped** (v3.0, single-file `index.html`). The anticipation *principle* built via the
feedback-field / framesmear route — "framesmear, unshackled." Recursive feedback buffer (decay,
flow, zoom, rotation, chroma) with the time-arrow free. Suite context: `../hindcasts.md`.

---

## what's on board

- **Three temporal stances:** wake (old live causal trail), anticipation (field run backward;
  precursor swarm ramps into each event), symmetric (fwd+bwd passes blended, zero-phase,
  balance slider weighting precursor vs wake).
- **Transient-aware pre-pass** — frame-to-frame change curve scales precursor deposit
  (`depositScale = 0.35 + 0.65·look`).
- **Whole-clip exposure normalization** — luminance nudged toward clip mean (global statistics).
- **Acausal scrub** — every frame pre-rendered, so seeking is instant; the un-liveness made
  tactile in the transport.
- 13 presets across anticipatory / classic-ported / spectral / kinetic / temporal / atmospheric.
- Split + wipe compare, trim, decode fps/width, PNG snapshot, MediaRecorder export (MP4→WebM
  fallback), drag-drop load.

Superpowers used: **precognition + bidirectionality**, partial **global statistics** (exposure
norm), partial **multi-pass** (transient scan). Missing: **whole-signal optimization**.

---

## roadmap — manifesto already points at these

### 1. Dense anticipatory optical flow — *the prize* (hindcasts.md next-move #4)
Per-pixel flow fit to the whole clip, run backward. Incremental route that keeps the engine:
replace the global affine advection (flowX/flowY/zoom/rotation) with a **per-pixel warp from an
estimated flow field**. Even coarse block-matching flow, reversed, makes the smear follow each
object's actual future trajectory instead of one shared drift. Halfway house between
"framesmear unshackled" and the genuinely-nobody's-seen-it version.

### 2. Rack / wet-dry — the console import
Logged in hindcasts.md adjacencies: "racking Prolepsis (extreme-blur chains, wet/dry on a video
effect) imports the mixer." Every stage pre-rendered ⇒ a two-cell chain (smear → smear,
per-cell wet/dry) is cheap: each cell's output is just another frame array. Same rack *pattern*
as sounder (collapsible DAG, per-app instantiation), not a shared host.

### 3. Control/source dual input — the suite's shared interface
Pythia's dual input, absent here. Second clip donates the **transient curve**, the **motion
field**, or the **inscription mask**; first clip is the body. Clip A smears according to what's
about to happen in clip B. CyberScotoma already proved cross-clip donorship reads in video.

---

## roadmap — new, thesis-extending

### Parameters as drawn curves over the timeline
Every slider is currently a constant. Proteus's spec makes morph amount "a drawn curve, not a
knob" — same inscription argument applies, and offline render makes it free: balance, decay,
flow each as an inscribed curve. The killer one is **balance-as-a-curve**: a clip that opens in
wake and crosses into anticipation mid-piece — the time-arrow itself automated.

### Spatial regime field — the multiband twin
Sounder's big move was per-band τ/curve; the video cousin is **per-region temporal stance**:
anticipation in one part of the frame, wake in another, split by drawn mask or by
luminance/motion statistics. "Different timescales of acausality applied to different parts of
the signal at once" becomes playable in both media — strong structural rhyme.

### Multiclip crossfades — the cut foreseen
Load several clips on one timeline; the smear field bridges the cuts. Because both sides of a
cut are known end-to-end, the transition is acausal in both directions: **clip B's precursor
swarm blooms inside clip A's tail before the cut arrives**, and A's wake decays into B after
it. The crossfade stops being an opacity ramp and becomes a temporal-stance hinge — the
incoming shot announced by its own anticipation, the outgoing one persisting as memory. Balance
curve (above) is the natural control: each cut is a local excursion on the anticipation↔wake
axis. Turns prolepsis into a micro-editor where the *transition* is the effect — no live
switcher can smear toward a source it hasn't seen selected yet.

### Editable transient curve
Already computed; render it under the scrubber and let the user redraw it (sounder's
depth-chart-and-redrawn-curve pattern, applied to time instead of level). Precursor density
becomes an inscription, not just a measurement.

### Periodic boundary conditions for loops
Whole clip known ⇒ seed the forward pass's buffer with the tail's converged state (backward
pass with the head's), so a looping clip has no smear discontinuity at the wrap. Cyclic
boundary condition in time; one extra warm-up lap. Live feedback can never do this.

### Whole-signal optimization stance — the unused superpower
Examples: solve per-frame decay so total smear energy is *constant* across the clip (video
cousin of normalization — the field breathes against the content); or fit deposit so the
output's luminance histogram matches a target.

### Transient-locked strobe
Strobe currently pulses on a fixed clock; phase-lock the gate to the detected transient curve
so echoes stamp *around events*, not metronomically. Global statistics applied to an existing
control.

### Long-exposure still
Integrate the entire processed clip into one frame — a true whole-clip photograph. Nearly free
given the frame cache; the global-statistics object as an exportable artifact beside the PNG
snapshot.

### Anticipatory audio
Export currently drops audio entirely. Minimal: mux the original track back in. Maximal:
pre-verb the audio so sound anticipates with image — would make prolepsis a second a/v hinge
member alongside Remanence. Own decision (placement rule cares).

---

## engineering wins

- **WebCodecs decode + encode.** `decodeAll` seek-steps the `<video>` element (slow; the 800ms
  seek-timeout fallback can silently duplicate frames). Export drives MediaRecorder in real
  time via `setTimeout` — a 30s clip takes 30s to export and frame timing is at the event
  loop's mercy, despite the "export is deterministic" claim in the UI. `VideoDecoder` /
  `VideoEncoder` make both frame-exact and much faster.
- **Worker / OffscreenCanvas offload** — same carry-forward Pythia has logged; processing janks
  the main thread between `raf()` yields.
- **Memory ceiling.** Long clip at 1024px = gigabytes of ImageBitmaps (src + out). Chunked
  processing (sliding window of src frames per pass) lifts the practical clip-length ceiling.
- **Small bugs:** stray dangling `--` in `:root` (`index.html` ~line 29, malformed
  declaration); `@font-face` points at absolute `/fonts/BlurMedium.otf`, breaks anywhere but a
  server root — "Blur Regular" likely silently falling back.

---

## priority read

Highest thesis-leverage per effort: **drawn-curve parameters** (esp. balance-as-curve) and the
**spatial regime field**. **Multiclip crossfades** builds directly on balance-as-curve — same
mechanism, second clip. **Control/source input** keeps the suite's interface promise.
**WebCodecs export** is the biggest practical-quality fix. **Dense flow** remains the prize but
is the largest single build.
