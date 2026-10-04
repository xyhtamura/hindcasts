# PROTEUS

*the morph that has read both scores — audio · HINDCASTS · **MVP built** (`proteus.html`)*

*(name provisional — see naming notes at the end)*

---

## one line

Feed it two recordings — or one recording and its own future — and it morphs them **after reading both to the end**: time-aligned, globally matched, spectral mass *transported* rather than crossfaded. Not a third realtime morph plugin; the acausal thing the realtime ones are approximating.

---

## thesis

**Morph is image-native, and the audio plugins know it.** Zynaptiq's own pitch for MORPH is "one face slowly becoming another" — the canonical *image* operation. And image morphing was never live: Beier–Neely (1992, the *Black or White* faces) needs hand-placed correspondences over **whole frames**, then warps geometry and crossfades appearance. Correspondence → warp → blend, all with both images fully in hand. When audio borrowed the metaphor (Zynaptiq MORPH, Melda MMorph), it kept the warp-and-blend but **dropped the acausality**: a realtime plugin can only marry frame *t* of A to frame *t* of B — whatever happens to be simultaneous — with features estimated on the fly and no power to align, search, or optimize. MMorph even asks the *user* to do the alignment ahead of time (its formant-shift and spectral-compression stages exist to make the inputs "more alike" before the morph, because the plugin can't reach across time to find likeness itself).

So this member doesn't invent acausal morphing — it **repatriates** it. Same shape as the limiter argument: the live version cheats toward an acausal ideal (lookahead, pre-conditioning, user-side alignment); the offline version *is* the ideal. This is the suite thesis in its most commercially legible form, because the causal competitors exist, are named, and cost money — the contingency isn't hypothetical, it ships as two products.

**Crossfade vs morph, said precisely.** A crossfade *sums* — both sounds audible, one thing dissolving over another. A morph *interpolates* — one intermediate thing that is neither. In spectral terms: a fade makes mass **appear and disappear in place** (a peak at 200 Hz dies while a peak at 300 Hz is born — momentarily a chord); a morph makes mass **move** (one peak *slides* 200 → 300). Mass-that-moves is **optimal transport**, and displacement interpolation of spectra is the mathematically honest version of what every morph plugin gestures at. That's the engine bet (see construction).

**Superpowers drawn on:** **whole-signal optimization** (alignment, matchmaking, transport maps fit over entire files) + **global statistics** (the barycenter stance) + **precognition** (the oracle stance — donor is the file's own future) + **bidirectionality** (symmetric forward/backward passes available for free offline).

---

## the four stances

Same move as Prolepsis's wake / anticipation / symmetric: one engine, a stance switch that names the temporal politics.

### 1 · HANDFAST — the aligned duet
DTW over both **whole files** first — syllable married to syllable, hit to hit — then morph the *aligned* pairs. This is the stance no realtime plugin can have even in principle: alignment requires both timelines complete before the first output sample. Realtime morphing of unaligned material is mush because the wrong moments are forced to marry; aligned morph is a **chimera** — one creature, seams intended. An **Alignment** control (0–100%) interpolates between the identity path (what realtime is stuck with) and the full DTW path — so the tool *demonstrates* what alignment buys, continuously.

### 2 · MATCHMAKE — the global search
Drop simultaneity entirely: for each frame of A, search **all of B** for its best spectral partner, with a transition-smoothness cost so the chosen B-path doesn't thrash — i.e. a Viterbi path over B's frame index, globally optimal because the whole file is there to optimize over. This is concatenative synthesis / audio mosaicing recast as *morph target selection*: A doesn't morph toward what B is doing now, it morphs toward the B-moment it most resembles. Kin to Negative-Space thinking — the donor is a **library**, not a timeline.

### 3 · ORACLE — the self-morph
B = **the same file, later.** Each moment morphs toward what it is about to become (offset and window as controls; offset can run negative for the retrospective twin). Timbre anticipating its own future — **Remanence prints amplitude backward; Oracle prints *timbre* backward.** Direct kin, and the stance that exists nowhere else: no realtime tool can morph toward a future it hasn't heard, and no offline tool has wanted to. Pure Hindcasts.

### 4 · BARYCENTER — the distribution morph
Ignore time-alignment altogether and interpolate the **whole-file statistics**: the Wasserstein barycenter of the two files' long-term spectral distributions, applied as a global reshaping. This is Sounder's identity — the distribution operator — generalized to **two inputs**: Sounder redraws one file's distribution against a drawn target; Barycenter's target is *another file's distribution*, met partway. (Same slot as the histogram waveshaper's "onto another file's histogram" — the spectral cousin of the amplitude-statistics transfer.)

---

## the control model

- **The morph curve** — drawn over the timeline, 0 = A, 1 = B. Inscription, not performance: pen-tool the trajectory, audition, undo. This is the TaboTa argument inside the tool — the realtime plugins put morph amount on a knob *because* they assume a hand riding it live; the drawn curve is the `{from, to}` spline repair applied to the morph dimension itself.
- **Alignment** (0–100%) — identity path ↔ full DTW (Handfast stance).
- **Transport ↔ Fade** — pure displacement interpolation ↔ pure crossfade, blendable. The axis that *demonstrates the difference*; 100% Fade is the control condition, the thing every DAW already does.
- **Formant / excitation split** — separate morph amounts (each its own drawn curve) for spectral envelope vs fine structure. Borrowed from the commercial morphs — it's the one thing they get right — but here each gets inscription.
- **Stance** — HANDFAST / MATCHMAKE / ORACLE / BARYCENTER.
- **Oracle offset & window** — how far ahead the donor-self sits; negative allowed.
- **Inputs** — Pythia's **control/source dual input**, the suite's shared interface: source = the body (A), control = the donor (B). Statistics-donor modes reuse this lane, not a third one.

---

## construction — build pathways (ranked)

### Path A — envelope/excitation split (the MVP)
STFT both files; separate spectral envelope from fine structure by cepstral liftering; interpolate log-envelopes and excitation separately; resynthesize. This is approximately what MMorph does, minus realtime. **Cheap, known artifacts** (envelope interpolation still fades peaks in place within each domain). Worth building first because DTW + the stances + the drawn curve already differentiate the tool even on a plain engine — the acausal frame is the product, the spectral engine is swappable.

### Path B — 1-D optimal transport per aligned frame pair (the core bet)
Henderson & Solomon, *"Audio Transport: a generalized portamento via optimal transport"* (DAFx 2019). Treat each pair of magnitude spectra as mass distributions over frequency; **1-D OT is closed-form** — the monotone rearrangement via inverse CDFs, O(N) after a cumulative sum, no solver. Displacement-interpolate: every parcel of spectral mass moves partway along its transport route. Pitch *glides* instead of double-exposing — kills the chord-during-crossfade artifact structurally. Their refinements to steal: group bins into spectral peaks so partials move as units (raw bin-mass transport smears tonal peaks); handle noise-vs-tonal mass separately. They built it *realtime*, which forces frame-local greedy maps — offline, the transport maps can be **smoothed across the whole clip** (a map that jumps between frames = warble; whole-file map regularization is exactly the acausal repair, and is this path's genuinely novel contribution over the paper).

**The phase problem** (the honest hard part): displacement-interpolated magnitudes need phases that don't exist in either source. Options, in order of effort — (1) phase-vocoder-style accumulation at the transported frequencies (what the paper does; adequate); (2) Phase Gradient Heap Integration (PGHI) over the output magnitude spectrogram; (3) the acausal luxury: a global two-pass phase fit over the whole output, since nothing is streaming. Start with (1).

### Path C — sinusoidal modeling (parked)
Full partial-tracking (SMS): track partials through both files, assign partial-to-partial correspondences via OT *over whole trajectories* (not per-frame), interpolate frequencies/amplitudes of matched partials. The most beautiful version and the heaviest — tracker quality dominates results. Park until Path B's peak-grouping proves insufficient.

### Path D — 2-D optimal transport over full spectrograms (parked)
Mass moves in time and frequency at once, without requiring one frame pairing. Valdivia, Renaud, Cazelles, and Févotte's [2025 preprint](https://arxiv.org/abs/2502.15430) implements global spectrogram barycenters with unbalanced transport and a cost that restricts distant time displacement. The earlier novelty claim is withdrawn. This remains a heavier candidate for Proteus, with computation and transient preservation to assess before adoption.

### Feasibility notes
Single self-contained HTML, house pattern: `decodeAudioData` intake, own radix-2 FFT (pythia/sounder already carry the chops), everything rendered offline, **pre-rendered result = instant acausal scrubbing** (the Prolepsis transport lesson), WAV export, drag-drop. DTW on downsampled feature frames (e.g. 20–40 mel/log bands at ~10 ms hop) is trivial compute at song length; the O(N²) cost matrix at 3-minute × 3-minute needs banding (Sakoe–Chiba) — standard. Worker offload is the same carry-forward it always is.

---

## placement & adjacencies

- **Hindcasts home**, cleanly: whole-file-analysis-forward, utility-forward, nothing specially organic in the substrate. No Sgueltch kin claim unless a MELT-grade extreme emerges (transport maps deliberately mis-regularized into smearing could get there; not the point now).
- **Sounder** — Barycenter stance is Sounder's distribution-operator identity given a second input; if the sounder rack lands first, Barycenter could even ship as a sounder cell before Proteus exists.
- **Remanence** — Oracle stance is Remanence's pre-echo with timbre substituted for amplitude; the two tools argue for each other.
- **Pythia** — control/source dual input reused verbatim; Pythia's statistics-donor slot ("another file's histogram") is the amplitude-domain cousin of Barycenter.
- **TaboTa** — the drawn morph curve is the inscription argument applied to the morph dimension; knob-riding is exactly the performance-assumption being refused.
- **Horn of Plenty** — Matchmake's grain-library reading of the donor is a cousin of the winnow; if Matchmake ever schedules rather than marries, it converges on granular territory deliberately left to Pythia/Horn.

---

## the competitive frame (for the essay, not the UI)

Zynaptiq MORPH 2: proprietary "structural" morphing (Prosoniq lineage), five algorithms, computes A-becoming-B and B-becoming-A simultaneously and crossfades *between the two morphs* — a genuinely good causal idea worth stealing as a symmetric-pass option, since offline gets it free. MMorph: overtly spectral-feature-based, formant shift + spectral compression as user-side pre-alignment. Both: sidechain as donor lane, morph amount as a live knob. Neither can align, search, self-morph, or optimize globally — not as a gap in effort but **by definition of the category they ship in.** The tool's argument: the category was the constraint.

---

## naming notes (shelf)

- **PROTEUS** — provisional pick. The Old Man of the Sea who **shapeshifts to escape prophecy**: hold him through every form — lion, serpent, water, tree — and he must foretell truly. Shapeshifting *and* divination *and* the ocean in one figure; sits beside Pythia's oracular register and keeps the hindcast wave-frame. The stances are literally the holds. **Known collision:** E-MU Proteus (the 90s rompler line) — an art-suite tool, not commerce, and the collision is at least *on-topic* (a sample-playback box), but flagged.
- *Chimera* — names the **output** (the seamed hybrid) rather than the practice; heavy plugin-name collision traffic. Keep as the word for what HANDFAST produces.
- *Amphisbaena* — the serpent with a head at each end, moving either way: the bidirectionality emblem. Too narrow for the whole tool; good preset or stance name if symmetric passes ship.
- *Handfast* — the hold itself (and the old betrothal rite — two things bound). Currently spent on stance 1; could be promoted if Proteus falls.

---

## status — MVP built (2026-07-12)

Single self-contained `proteus.html`. Shipped: dual drag-drop intake (decoded through one AudioContext → guaranteed matching rate), **DAW-style two-lane timeline** with the B lane **draggable to position it against A** (manual alignment = the inscription HANDFAST), **drawn morph curve** editor (add/drag/double-remove points, ends pinned in time), the **Transport↔Fade** axis on a phase-vocoder morph engine (own radix-2 FFT → STFT → per-frame magnitude = blend of 1-D optimal-transport displacement-interp vs linear fade; instantaneous-frequency phase accumulation → ISTFT overlap-add), **mono / per-channel** stereo modes, −1 dBFS peak-safe normalize, offline render → instant playback + WAV export. Verified: FFT/STFT/OT/ISTFT run finite and clean; a 220→440 Hz test pair under a 0→1 ramp **glides 226→435 Hz** (mass moves, not fades — the thesis, working); playback confirmed flowing to the destination (analyser meter) and the morph curve audibly sweeps.

**Transport** (added after first pass): moving playhead, play/pause/stop, click-or-drag-to-seek with scrub (pauses, follows the cursor, resumes on release), m:ss.d time readout. Persistent `gain→analyser→destination` graph, awaited `AudioContext.resume()`.

Decisions taken during the build (were open questions): central viz **is** the timeline+curve (yes, visible — like Prolepsis); stereo is a setting; unequal lengths = output rides A's clock, B absent where it doesn't cover (rests on A); manual track-sliding stands in for auto-DTW in the MVP.

**Two bugs fixed post-first-render:** (1) canvas code used `strokeStyle='var(--…)'` — CSS vars don't resolve on a 2D context, so waveforms drew black-on-black (invisible); now literal hex. (2) **the no-sound bug** — ISTFT normalized by per-sample overlap `winAcc`, which →0 at the tapered clip edges, so `outAcc/winAcc` exploded into an edge spike (tail-segment RMS 1.6 vs body 0.1); that spike hijacked peak-normalization and buried the real signal. Fixed by dividing by the constant COLA plateau (`max(winAcc)`) so edges fade instead of blowing up. Peak went 19.9→0.51 (natural sine level), body even.

**Not yet built (the spec's harder half):** auto-DTW alignment (Handfast slider), MATCHMAKE, ORACLE, BARYCENTER stances; OT peak-grouping (raw-bin transport smears tonal partials — next real DSP task); formant/excitation split curves; whole-clip transport-map smoothing; better phase (PGHI / two-pass). Engine is MVP-grade: independent per-source IF interpolation + OT magnitude is coherent enough to morph, not yet the clean Audio-Transport reconstruction.

---

## open questions

- **Does DTW want to be visible?** The alignment path is a beautiful object (the warped lattice between two waveforms) — show it as the tool's central visualization, or keep the previewer clean per house style? Leaning visible: the path *is* the acausality, and this suite's video wing exists to make the invisible operation show its hand.
- **Stereo** — morph M/S jointly, or mid-only with stereo reconstitution? Path B's transport is per-channel-independent at first; check for image wander.
- **Unequal lengths** — DTW handles it; the morph curve's timeline should probably be A's (source-as-body convention). Confirm against real material.
- **Oracle at the boundaries** — the last N seconds have no future to morph toward; taper, wrap, or mirror? (Remanence's reel-edge answers are the precedent to consult.)

---

*spine: hold the shapeshifter through every form, and he must tell you the future.*

## Review log

2026-09-30 — Codex — Reviewed the manual-alignment MVP without changing the app. Executed the HTML's DSP functions in Node with generated signals, FFT size 2048, hop 512, and edge fade disabled.

- A 1,000-sample clip produces 1,025 non-finite magnitude bins because `stft` reads beyond its array. Passing those spectra into `otMag` hangs its loop: NaN residuals never advance either index. The render probe was interrupted. Zero-pad incomplete windows before taking the FFT.
- The Fade endpoint interpolates magnitudes and phase advances rather than waveforms. With A a 220 Hz sine and B a 220 Hz cosine, both at amplitude 0.4 and 44,100 samples, the interior relative RMS error against a waveform crossfade is 1.415 at morph amount 1 and 1.001 at amount 0.5; the A endpoint error is 0.000141. The output phase starts from A even at amount 1. Provide a waveform crossfade for the Fade control and reconstruct the donor phase at the B endpoint.
- The frame count drops the incomplete final window. A 44,100-sample input produces 44,032 samples. Include a zero-padded final window and trim reconstruction to A's exact sample count.

All three defects remain unfixed. Browser interaction, listening, and WAV playback were not checked in this review. Planned stances and phase-reconstruction limitations remain as documented above.

2026-09-30 — Codex — Fixed the three reviewed DSP defects. `stft` adds zero-padded pre-roll and final windows, and reconstruction returns A's exact sample count. Fade mixes sample-aligned waveforms; transport uses that crossfade as its other endpoint. Morph amounts 0 and 1 preserve the corresponding input samples, with A retained outside donor coverage. Edge fade and the curve are evaluated against sample time. Transport phase accumulation uses 64-bit storage, and endpoint frames use the corresponding source phase.

Verification: `node proteus/test-proteus.mjs` passes short clips (1–2,049 samples), exact lengths, endpoints, phase-different waveform fades, positive and negative offsets, donor absence, a drawn ramp, edge fade, identical inputs, silence, and an FFT impulse reference. `test-browser.cjs` runs the app in headless Edge through the Render button and decodes the WAV: 72,000 source, output, and decoded samples, with the expected PCM payload size. The browser glide probe remains finite and measures 226→435 Hz for a 220→440 Hz pair. Listening and pointer interaction were not checked. Run the browser test with Playwright available as `playwright`, or set `PLAYWRIGHT_PATH`; `EDGE_PATH` overrides the browser executable.

The existing intermediate transport still moves raw bins and blends phase advances at fixed bins. Donor analysis frames remain rounded to a hop; exact offsets apply to the waveform fade and input endpoints. Endpoint preservation does not establish continuity for curves that repeatedly hit 0 or 1. These are remaining reconstruction limitations, not claims of a finished phase algorithm. No additional morph engine was implemented in this sitting.

Algorithm assessment, in order of expected usefulness:

1. Move spectral peak regions as units and preserve each region's relative bin phases. Accumulate phase at the transported peak frequency, rather than blending instantaneous frequencies at unchanged output bins. Henderson and Solomon's [Audio Transport](https://www.dafx.de/paper-archive/2019/DAFx2019_paper_56.pdf), sections 3.2–3.3, provides the concrete reconstruction model. This addresses the current mismatch between moved magnitudes and stationary-bin phase.
2. Separate harmonic and percussive material, so sustained components can move while attacks retain their timing. Roma, Green, and Tremblay's [matrix-decomposition morph](https://dafx2020.mdw.ac.at/proceedings/papers/DAFx2020_paper_42.pdf) combines HPSS, NMF component transport, and PGHI. Component-level morphing is a separate candidate for transferring timbre while retaining A's activation pattern; it needs additional analysis and component matching.
3. Use whole-file access to stabilize peak correspondences over time, then evaluate automatic alignment on onset and spectral features. This is an implementation proposal, not a demonstrated quality improvement. Compare sustained tones, chords, attacks, speech, and unequal-length recordings against the waveform fade before choosing it.
4. Assess global spectrogram transport as a separate experimental engine, with restricted time displacement and unbalanced mass handling. It has a published precedent, cited in Path D. Keep it parked until the frame-based reconstruction is credible.

The three papers were retrieved into `../../library/proteus/`; the 2025 file is named as a preprint. The app roadmap is unchanged: these are recommendations for discussion, not adopted development steps.

2026-09-30 — Codex — Added peak-aware transport to the existing Transport control. Each frame is divided at valleys between local magnitude maxima. The normalized mass of those regions determines a monotone transport plan; each parcel translates complete spectral lobes and preserves their phases relative to the source peak. The two region shapes contribute under a shared output peak phase. Matched parcels carry phase across frames using the interpolated instantaneous-frequency advance at their source peak bins. Exact waveform Fade and input endpoints remain in place. `otMag` remains a debug reference; it is no longer the rendering path.

Verification: `node proteus/test-proteus.mjs` passes the earlier regressions plus region-mass accounting, a constant 220→440 Hz midpoint, a two-peak chord midpoint, a drawn glide trajectory, and noise-to-tone finiteness. Interior FFT energy within 35 Hz of the expected midpoint frequencies is 99.999998% for the single tone and 99.982469% for the chord. The glide's two measured time intervals agree with its expected trajectory within 5 Hz. Headless Edge's Render/WAV decode check passes with 72,000 samples before and after export. The browser glide probe is finite, with peak 0.502 and RMS 0.323. These are synthetic numerical checks, not a listening judgment.

The first phase update averaged successive frame advances, but failed the identity test by a maximum sample error of 0.068. It was replaced with the current frame's interval advance, which preserves identical inputs within the existing 0.0001 sample tolerance. No additional controls or alternate engines were added.

2026-09-30 — Antigravity — Extracted Proteus DSP into engine.js module.
- `engine.js` exports `ProteusDSP` with `morphChannel`, `render`, `stft`, `fft`, `hann`, `princ`, `otMag`, `peakRegions`, `peakTransport`, `curveFromPoints`, `toMono`, `defaultParams`, `validateParams`, and `bucketPeaks`. Zero DOM, AudioContext, or UI dependencies; runs in Node.js and browser scripts.
- `proteus.html` and `test-proteus.mjs` retargeted to `engine.js`, eliminating HTML string splitting and `vm.runInNewContext`.
- `test-browser.cjs` updated to support headless Edge via native CDP pipe fallback when Playwright is not installed globally.
- Verification: `node proteus/test-proteus.mjs` passes all regressions (short clips, exact length, endpoints, offsets, waveform crossfade, edge fade, identity, FFT, single peak energy 99.999998%, chord peak energy 99.982469%, glide trajectory, noise finiteness). `node proteus/test-browser.cjs` passes in headless Edge (72,000 samples, WAV decode match, status Rendered, peak 0.502, RMS 0.323).
- Boundary contract:
  - Named inputs: `channelsA` (`Float32Array[]`, source/body), `channelsB` (`Float32Array[]`, donor/target), `sampleRate` (number), `opts` (`fftSize`, `tf`, `bOffsetSamples` / `bOffset`, `edgeFadeSamples` / `edgeFade`, `stereoMode`, `curveAt` / `curve`). Both input arrays are read-only and never mutated.
  - Placement: Output length is exactly A's length; input sample 0 of A lands at output sample 0. B is positioned at `bOffsetSamples`; samples outside B's span retain A untouched.
  - Operations: Fade endpoint blends sample-aligned waveforms; Transport (`tf > 0`) reconstructs via STFT peak-region translation and instantaneous-frequency accumulation. Pre-normalization ceiling clamps peak to 0.891 (-1 dBFS) via `g = Math.min(1, 0.891 / peak)`.
  - Randomness: Deterministic (no random state).
- Remaining integration limits: dual-input routing and buffer alignment in the offline rack (A = primary clock, B = secondary donor); cross-channel stereo phase correlation; whole-file correspondence smoothing.

2026-10-05 — Codex — Reskinned Proteus as a pearl-cased audio instrument. `skin.css` gives the source and donor rose/citron intake compartments, plum timeline and curve displays, asymmetric casing, raised transport buttons, and a CSS-only three-part seal. The mixed light/dark surfaces and compact controls follow the design calibration in `../../principles/`; Proteus keeps its own palette. Labels describe loading, alignment, curve editing, and rendering directly. Added a Hindcasts return link, associated control labels, keyboard file selection, and a live status region. No external assets were added; the DSP is unchanged.

Verification: headless Edge `node proteus/test-ui.cjs [screenshot-directory]` checks file-picker activation by click and Enter, decoding two generated WAV uploads, donor dragging, curve point addition/dragging/removal, rendering, download, and playback-clock advancement. It checks horizontal overflow at 320, 390, 700, and 1024 pixels. Desktop and mobile screenshots were inspected. `node proteus/test-browser.cjs` passes exact-length render/WAV decoding (72,000 samples), and `node proteus/test-proteus.mjs` passes the numerical regressions. Both browser scripts accept `PLAYWRIGHT_PATH` and `EDGE_PATH` environment overrides.

Remaining: listening with real recordings and the earlier reconstruction/integration limits. Automatic alignment and additional morph stances were not part of this reskin. The suite's next step remains Sounder's longer-rack assessment.
