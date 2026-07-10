# PYTHIA — delay build / roadmap

*the flagship learns to echo — from paracognitive texture to a delay a producer would reach for*

> **Status (2026-07-10): all five phases shipped and verified.** Phase 0 (scheduler/state groundwork), Phase 1 (Time + loop/unloop + Scatter + feedback + shared-timeline viz), Phase 2 (polarity sidechain + Pneuma Classic), Phase 3 (BPM sync, pitch/pan spray, ping-pong, feedback grain), Phase 4 (deterministic sample-domain Bounce WAV with true acausal ceiling). The live edge is now the carry-forward list: Worker offload for the bounce, user-settable ring room, preset shelf, and the histogram-waveshaper cross-file stance.

---

## where this sits

The current build stays intact through the transition — not as a museum piece but as a **live corner of the new parameter space**. What Pythia does now (amplitude-gated granular texture, control/source dual input, future-read grains) turns out to be one setting of the new engine: sidechain in *follow* polarity, feedback at zero, Time on the negative side. **If the user dials those, they're using old Pythia, by construction.** Same move Sounder made with single-band: the old tool is the degenerate case, not the deprecated one.

The pitch problem being solved: current Pythia never *repeats* anything. A producer's delay is a copy of the input, displaced in time, decaying through a feedback path. Pythia's grains read near-present, amplitude-gated by the control — output is a gated smear, not an echo. The "Envelope Delay" slider shifts which control amplitude gates the grains, which is perceptually near-invisible. It reads as broken, not as precognitive. The fix is not to abandon the granular identity but to give it the two things that make a delay a delay — **displacement and regeneration** — and then let the acausal stance do what no shipping delay does.

---

## the reframe (the pitch spine)

**Regular delay is the degenerate case of granular delay.** Lock a granulator down — Hann windows, 50% overlap, grain rate matched to grain size (the COLA condition, constant overlap-add), zero position jitter, zero pitch/pan spray, every grain reading exactly `t − D` — and overlap-add reconstructs the delayed signal perfectly. A pristine echo *is* a grain cloud holding perfectly still.

Every departure from that lock is texture: timing jitter shreds the repeats, position jitter smears them, pitch spray turns them to shimmer, sub-COLA density gaps them into stutter. So "granular vs regular" is not two engines — it's **one axis measuring departure from coherence**, and the axis is **temporal jitter**. Jitter is the thing a realtime delay structurally *cannot* do: a hardware/plugin delay reads at exactly `t − D`, always, because it has no future to scatter into. Pythia has the whole file, so it can spread each grain's fire-time and read-position around the ideal `t − time` — and that spread *is* the granular character. At jitter = 0 the grains land on the lock and reconstruct the clean echo; crank it and the repeats disperse into a cloud. It's the producer-legible macro **and** the one that names what makes Pythia granular rather than just delayed: the clean delay is the granular oracle holding perfectly still.

The second spine: **the delay that already read the score.** Producers fake acausality by hand today — the reverse-reverb bounce trick, manually ducked delay sends riding a vocal. Pythia is the principled one-click version of both:

- **Pre-echo** — Time is signed. Positive reads the past (normal delay); negative reads the future — repeats that arrive *before* the hit, crescendoing into it. Anticipatory Dust, inside a delay producers already understand.
- **Pre-ducking** — the sidechain sees the whole control signal, so the wet gets out of the vocal's way *before* the vocal comes in. Superpower #1 (precognition) doing an actual mixing job.

---

## architecture (proposed, not yet locked)

**Dual-path wet.** Chosen over a single COLA-morphing engine. Two readers over one delayed-signal concept:

- a **clean tap** (`DelayNode`) — pristine, cheap, guaranteed-perfect regular delay
- the **granulator** — the existing grain engine, retargeted to read `t − time`

The axis between them is surfaced as the **Scatter** knob (0 = pristine tap, 1 = full granular cloud), an *equal-power crossfade* plus read-position scatter — it's the cheap/guaranteed-clean route (the `DelayNode` is bit-clean where the granulator's overlap-add wouldn't be without exact COLA scheduling) and the CPU-light regular-delay mode. Default **1** preserves the current granular sound; dialing down reveals the clean delay. **Density Jitter stays a separate knob** (independent fire-time scatter) so the classic sound stays exactly reproducible — Scatter drives crossfade + read-position spread, not fire-timing. The dual path also enables the one trick only this topology has: **the granulator inside the feedback path**. First repeat clean, each regeneration grainier — repeats *disintegrate* across generations, the granular cousin of tape degradation. Keep the COLA identity for the docs and poster; build the dual path.

**Two realtime-preview fallbacks** (both resolved by the offline bounce, which reads the whole buffer): a live `DelayNode` can't produce **negative delay**, so for `time < 0` the wet forces to the granulator regardless of Scatter (the granulator reads `t − time` and does pre-echo fine); and a looping live delay can't go silent mid-stream, so **𓆙 unloop** is honored by the granulator path while the clean tap keeps looping. Neither matters for the common case (positive delay well inside the file); both are documented approximations, not bugs.

**Signal flow:**

```
source ──┬──────────────────────────────────────────────► dry ──┐
         │                                                      ├─► master ─► out
         └─► [ clean tap ◄─ jitter ─► granulator ] ─► wet bus ──┘
                                                        │
       (offline bounce) feedback = clip extended ◄──────┘
       head (pre-roll) + tail (ring-out), decay law, capped at maxSeconds
       (realtime preview) approximated by a decaying feedback loop w/ damping LPF
                                                        ▲
control (sidechain) ── envelope @ (t − duckLookahead) ──┘  (follow ◄─► duck)
```

**Semantics rework:**

- **Time** — one signed knob, replaces the current delay/lookahead pair. Grain read position and clean-tap offset both = `t − time`. Negative = pre-echo.
- **Loop / unloop (⥀ / 𓆙)** — what happens when a read falls outside the source clip `[0, D]`. **⥀ loop** = modulo wrap, the **ouroboros** reading: a read past an edge wraps to the other end (positive time near the start reaches back into the tail; negative time past the end reaches into the head), so the clip eats its own tail. This is the *current* behavior — the classic-preserving default. **𓆙 unloop** = clamp to silence: reads outside `[0, D]` simply don't sound, exactly like a regular delay whose pre-roll is void and whose tail rings out into nothing. The toggle is the difference between "the file is a cycle" and "the file has a real beginning and end."
- **Feedback = bidirectional clip extension** (not a loop-gain). Regeneration is reconceived as *render length*, because in the offline frame you don't need to loop a signal to hear its repeats — you extend the clip and render the decaying repeats into the new room. **Ring N seconds** extends the **tail** so echoes play out past the source end; because Pythia is acausal it also extends the **head** (pre-roll) so negative-time pre-echoes have room to ramp in *before* the original. A decay law shapes the repeats across the extension; **maxSeconds** caps the extension against runaway/ultra-long renders. This is inherently a bounce mechanic — the realtime preview approximates it with a standard decaying feedback loop (gain + damping LPF). Disintegration rides here: how much of each regenerated pass routes through the granulator vs the clean tap.
- **Dry = source.** The signal being processed is the source; that's what a producer means by dry/wet. The control becomes an optional **sidechain** with a "monitor control" toggle for anyone who wants the old both-audible behavior.
- **Sidechain polarity** — one bipolar knob: **+1 follow** (wet rides the control's envelope — current Pythia), **0 off**, **−1 duck** (wet dodges the control — the producer move). Continuous between. The current *threshold* mode becomes a gate-shape option on the same sidechain (continuous ↔ gated).
- **Duck lookahead** — signed. The sidechain reads the control at `t − duckLookahead`; negative values duck *before* the control arrives. This is where the current "Envelope Delay" slider's soul goes — same mechanism, now legible.

**Scheduling fix (unconditional, behavior-preserving).** Grains currently fire from the rAF loop — frame-quantized, tab-throttled, jittery. Move to an audio-clock lookahead scheduler (`setInterval` ~25 ms, schedule ~100 ms ahead, exact `start(when)` times). This is a correctness fix that changes no semantics; it lands first.

**Offline render.** The realtime path is the preview; the bounce is a deterministic offline render — sample-accurate grain placement, true WAV export (replacing MediaRecorder webm; note the old constructor never received its `mimeType` anyway), finite head/tail extension, and an acausal peak ceiling. The first implementation is a sample-domain renderer rather than an `OfflineAudioContext` graph because negative-time feedback needs backward recursion (`y(t)` depends on `y(t+|D|)`), which Web Audio delay nodes cannot express directly. This is the Hindcast commitment paying rent: the whole file is known, so the render can be exact.

---

## the preservation contract

What current Pythia does must remain reachable at every phase:

| current behavior | where it lives in the new engine | status |
|---|---|---|
| grains read `t + lookahead` | Time knob, negative side | ✅ |
| amplitude-gated by control RMS | Polarity = +1 (follow) | ✅ |
| envelope-delay shifting the amp read | Sidechain Lookahead (signed, was `delay`) | ✅ |
| threshold / triggered mode | Gate checkbox (follow-direction, polarity≥0) | ✅ |
| self-sampling | source = control, unchanged | ✅ |
| control audible as dry | Monitor Control toggle (+ Source in Dry off) | ✅ |
| modulo-wrap on out-of-clip reads | ⥀ loop mode (default) | ✅ |
| no repeats | feedback = 0 (no clip extension) | ✅ |
| grain size / density / jitter / envelope shape | unchanged, now also feeding Scatter | ✅ |

**"Pneuma (Classic)"** preset button ships — one click back to the current instrument (verified field-for-field). If any phase can't express a row of this table, the phase is wrong, not the row.

---

## phases

**Phase 0 — groundwork (no audible change).**
Audio-clock grain scheduler replacing rAF-driven firing. State object as single source of truth (`{ version, params, sidechain, … }`), JSON export/import, versioned from day one — audio stays out of the JSON. Hann window option alongside the current linear attack/decay (linear clicks at short grain sizes). Verify: old sound, steadier timing.

**Phase 1 — delay semantics.** Built in verifiable increments:

1. *Signed Time + loop/unloop.* ✅ **Time** absorbs the current `lookahead` (grains read `t − time`; classic positive lookahead = negative Time). The current `delay` param stays put — it's the amp-gate offset, and becomes duck-lookahead in Phase 2's sidechain rework, *not* merged into Time. Loop/unloop toggle (⥀ wrap / 𓆙 clamp-to-silence).
2. *Clean tap + Scatter axis.* ✅ Clean `DelayNode` tap (fed by a continuous looping source node) alongside the granulator; the **Scatter** knob equal-power-crossfades between them and scales read-position spread. Default 1 = current granular sound. Density Jitter kept separate. Two realtime fallbacks (negative time, unloop) documented above.
3. *Feedback + shared-timeline viz.* ✅ Realtime feedback as a **decaying loop on the whole wet bus** (`wetGain → fbDelay → damping LPF → feedbackGain → wetGain`; legal cycle via the DelayNode; works at any Scatter — clean and/or granular material recircs). **Feedback** (0–0.95, clamped <1) + **Damping** (LPF, each pass darker). **Master safety limiter** shipped: fast compressor + `tanh` soft-clip wall (ceiling ≈ −0.2 dBFS) so feedback can't exceed 0 dBFS — a *causal* preview guardrail (a cheat by the thesis; the bounce does the true acausal ceiling). **Shared-timeline viz:** ctrl + src canvases moved onto one time axis `[−head, D+tail]` (head = pre-echo room from negative time, tail = feedback ring-out estimate); the original clip is drawn as a bounded sub-range with acid-green boundary markers and ember-tinted extension zones. Verified: clip edges land at the predicted `tToX` positions, defaults fill full width (no regression). The literal head/tail *buffer* extension (rendering the decay into new room) is the offline bounce — this increment does the realtime loop + the viz that shows where it will live.

Dry-bus semantics stayed deferred here and landed in Phase 2: source is dry by default, control is optional monitor. **This phase is where it starts sounding like a delay.**

**Phase 2 — the sidechain rework (where it stays Pythia).** ✅ Shipped and verified.
**Polarity** (bipolar −1…1, default +1) replaces the implicit always-follow: `amp = max(0, polarity≥0 ? 1−polarity·(1−e) : 1+polarity·e)`, one formula that reduces algebraically to exactly the old unclamped envelope at +1 (classic, unchanged), gives constant full amplitude at 0 (sidechain off), and duck (`1−e`, clamped ≥0) at −1. **Gate checkbox** absorbs threshold mode as a shape toggle on the same sidechain; direction flips with polarity's sign — follow-gate fires above threshold (old behavior), duck-gate fires *below* it, filling the gaps (a new, legitimate mode this formula gives for free). `delay` renamed to **Sidechain Lookahead** (identical math — this is the duck-lookahead the roadmap named; no semantic change, just legible). **Dry bus rework**: dry is now the *source* by default (`Source in Dry`, default on) — what a producer means by dry — with control demoted to an optional **Monitor Control** tap (default off) for hearing the sidechain itself. Both feed a new `dryBus` ahead of the existing mix gain. **"Pneuma (Classic)"** preset button ships: one click sets polarity=1, gate=off, Source in Dry=off, Monitor Control=on — the exact pre-Phase-2 sound. State version bumped to 2; old (v1) saves migrate `delay→sidechainLookahead` (identity) and `mode→gate+polarity`, and get `sourceDry:false, monitorControl:true` by default (since v1 files only ever had control audible).

*Verified*: polarity formula confirmed exactly against a steady test signal (follow mean 0.844 → predicted duck 1−0.844=0.156 → measured duck mean 0.156, exact match; off = constant 1.000). Gate direction-flip confirmed by grain-fire counts (threshold below envelope: follow fires 20/20, duck fires 0/20; threshold above: follow 0/21, duck fires 21/21). Dry-bus routing confirmed via node-level RMS probes (exact 0 when a tap is gated off, nonzero when on). Classic preset and full v2 state round-trip verified field-for-field; v1-legacy-file migration verified (delay→sidechainLookahead, mode:'triggered'→gate:true, dry-bus legacy defaults applied).

*Scoping note*: control is still a required file (used as the scheduler's clock/modulo reference) — "optional sidechain" here means audibility and influence are optional (polarity=0, Monitor Control off), not that the file itself is optional. True control-optional / single-file operation is future work if wanted.

*Viz cleanup after Phase 2*: the middle amp canvas now shares the same `[−head, D+tail]` timeline as ctrl/src. The waveform no longer owns a full-width scrolling geometry; it stays fixed in the shared clip window, with a current-time guide plus ember sidechain readhead showing `t − sidechainLookahead`.

**Phase 3 — producer legitimacy.** ✅ All four slices shipped and verified.
BPM + note-division sync (1/4, 1/8 dotted, triplets; free-ms fallback). Per-grain pan spray → stereo width; optional ping-pong. Per-grain pitch spray (shipped as continuous ±24 st center + spray rather than fixed +12/+7 shimmer presets — strictly more general; shimmer presets can ride on the preset shelf). Disintegrating feedback.

*Verified (2026-07-10)*: Time Sync math exact (120 BPM ¼ → 0.50 s, 90 BPM ¼ → 0.67 s, 90 BPM dotted-8th → 0.50 s; sign preserved under sync on negative Time; manual Time move reverts selector to free). Stereo: pan spray 0 → output channels byte-identical; pan spray 1 + ping-pong → L/R difference ratio 1.13 (near the √2 hard-alternation ceiling). Live playback stable with pitch +7, spray 3, pan 0.5, feedback-grain 0.6 all hot; zero console errors. Classic preset zeroes every Phase-3 param (verified field-for-field); v6 state serializes all new fields.

*Audibility note*: **Ping-Pong requires Pan Spray > 0 to be audible** — the feedback channel-swap is a no-op on centered material. Consider auto-nudging pan spray when ping-pong is enabled, or noting it in the UI hint.

*First slice shipped*: user-settable **BPM** plus **Time Sync** selector for `Time` (free seconds, 1/1, 1/2, 1/4, dotted 1/8, 1/8, triplet 1/8, 1/16). Sync writes the existing signed Time parameter, so realtime preview, shared timeline, feedback room, and Bounce WAV all inherit the same value. Manual Time movement returns the selector to free seconds. State version bumped to 3; old saves load as free seconds at 120 BPM unless they specify otherwise.

*Second slice shipped*: per-grain **Pitch** (center semitones, −24…+24) and **Pitch Spray** (random ± semitones per grain, 0…24) on the granulator path. Clean tap remains pristine at Scatter=0 by design; pitch/spray become audible as Scatter opens. Live grains use `AudioBufferSourceNode.playbackRate`; Bounce WAV uses the same sample-domain pitch-rate read. State version bumped to 4; older saves default pitch fields to 0.

*Third slice shipped*: per-grain **Pan Spray** (0…1 stereo width) on the granulator path, plus **Ping-Pong** feedback mode. Pan Spray at 0 preserves the old channel path; when opened, grains are equal-power panned, with random pan by default or alternating left/right under Ping-Pong. The live feedback loop now swaps stereo channels when Ping-Pong is enabled; Bounce WAV uses the same channel-swapped recursive feedback. State version bumped to 5; older saves default to no Pan Spray and Ping-Pong off.

*Fourth slice shipped*: **Feedback Grain** (0…1 disintegration) now controls how much the feedback return smears into sub-grain offset reads as it regenerates. At 0 it preserves the prior clean recursive feedback exactly; opening it makes repeated echoes blur and darken while still honoring signed Time and Ping-Pong routing. Realtime preview uses a cheaper darkened-return approximation; Bounce WAV renders the deterministic recursive smear. State version bumped to 6; older saves default Feedback Grain to 0.

*Preset shelf — full build spec now lives in `pythia-presets.md` (12 presets with exact param payloads). Original sketch:*
- **Oracle Chorus** — short synced/free Time, low feedback, modest Scatter, tiny Pitch Spray, wide Pan Spray; wet-only or high wet for chorus/doubler use.
- **Stereo Vapor** — Scatter high, Density Jitter low-mid, Pitch Spray subtle, Pan Spray wide; feedback near zero so it widens without obvious repeats.
- **Ping-Pong Pneuma** — positive Time, moderate feedback+damping, Ping-Pong on, Pan Spray low; producer-legible stereo delay.
- **Disintegrating Echo** — clean first repeat, feedback return increasingly smeared/dark/wide with Feedback Grain opened.
- **Pre-Chorus / Pre-Widen** — negative Time, subtle Pitch Spray + Pan Spray; anticipation cloud that blooms before the source.

**Phase 4 — the bounce.** ✅ Pulled forward before Phase 3. Verified.
The old MediaRecorder capture button is now **Bounce WAV**: a deterministic 32-bit float WAV render from the loaded buffers and current state. Render window = original control-clock body plus head room for negative Time/pre-feedback and tail room for positive Time/post-feedback, capped to the same 8-second feedback room used by the viz. Clean tap is rendered in sample-domain, so negative Time can produce clean pre-echo instead of falling back to the granulator. Grains use a state-derived seeded PRNG for deterministic density/position jitter. Feedback is rendered as a whole-wet-bus recursive delay: forward for positive Time, backward for negative Time, with damping and true acausal peak normalization to ≈ −0.2 dBFS. Dry extension rooms are silent; source/control dry taps only occupy the original body. Aligns Pythia with the suite's offline commitment and readies it for the rack pattern (cell = this engine, host = file/transport/master — same shape as the Sounder refactor, reinstantiated per app).

*Design note*: this is a **pure sample-domain render**, not the `OfflineAudioContext` the roadmap originally named — the deviation is an upgrade: `OfflineAudioContext` couldn't have given byte-determinism (Web Audio nodes have no seedable RNG path) or the backward-recursive negative-Time feedback.

*Verified (2026-07-10, decoded WAV analysis on a 1 s test clip)*: positive Time +0.5 → duration exactly 1.50 s with delayed-copy energy in the tail (RMS 0.30); negative Time −0.5 → pre-echo energy in the head *before* the dry enters (RMS 0.18), dry silent in extensions. **Byte-determinism**: two bounces with pitch spray 6, pan spray 0.7, density jitter 0.5 all active → identical SHA-256. **Acausal ceiling**: feedback 0.95 at full wet → decoded peak exactly 0.977 (−0.2 dBFS), and the 8 s ring-cap confirmed by output duration 9.40 s (= 1 + 0.4 + 8).

*Phase-4 carry-forwards*:
- The render runs **synchronously on the main thread** — long files will freeze the UI during a bounce. Move to a Worker when it hurts (same cost note as Sounder's multiband).
- The 8 s ring room is **hardcoded** — the original design's "let feedback ring for N seconds" user knob is still unexposed. Add it (bidirectional, as designed) if the cap ever bites.
- Preview ↔ bounce is a documented **approximation relationship**, not bit-matching (live: causal limiter, no head extension, damping-as-disintegration). By design, not drift.

Order rationale: 0 is a bug-class fix wearing a refactor's clothes; 1 alone makes it *sound* like a delay; 2 makes it Pythia rather than a Portal clone; 4 came before 3 because sync/pitch/pan controls need a trustworthy offline truth first.

---

## open questions (park, don't block)

- **Smear at the extremes** — does the crossfade need an equal-power law, or does the granulator at full COLA-lock get close enough that the midpoint doesn't dip?
- **Realtime preview vs negative-Time feedback** — bounce now does backward-recursive negative-Time feedback with head extension. The live preview remains the cheaper `|time|` forward-delay approximation, so it may show fewer/less-correct pre-echo generations than the WAV.
- **Naming shelf** — jitter axis as *Jitter* vs *Scatter* vs *Dispersion*; polarity knob as *Stance* (follow/duck) keeps the oracle register. The Delphic frame has room: the clean tap as *the verbatim oracle*, full jitter as *the vapor*. Loop/unloop glyphs ⥀ / 𓆙 (ouroboros vs the open serpent) are a keeper if they render cross-platform — verify 𓆙 (Egyptian hieroglyph U+13199) has fallback.
- **Histogram-waveshaper cross-file preset** (hindcasts.md next-move #2) is now unblocked by Phase 2: it slots into the same control/source input, with control donating *statistics* instead of an envelope — effectively a fourth stance, not a new input.

---

## adjacency guard

`remanence` already owns whole-file acausal **multi-tap** with negative taps and reel geometry. Pythia does not grow taps; it stays **granular + single displaced read + feedback**. The overlap zone (pre-echo) is shared vocabulary, not shared mechanism — remanence's pre-echoes are print-through physics, Pythia's are the oracle reading ahead. If a multi-tap urge appears here, it belongs there.

The control/source dual input is the **suite-wide shared interface** (see `hindcasts/hindcasts.md` adjacencies). Phase 2 changed its meaning from control-as-gate to control-as-sidechain/structure donor with polarity, gate shape, lookahead, and optional monitor; `hindcasts.md` and `DEPENDENCIES.md` track that contract. Keep all three synced if this interface changes again.
