# PYTHIA — delay build / roadmap

*the flagship learns to echo — from paracognitive texture to a delay a producer would reach for*

> **Status (2026-08-13): Phases 0–5 plus linked symmetric delay and the full Caesura OFF/FIT/DUCK policy shipped and verified.** The delay engine, WAKE / ANTICIPATION / SYMMETRIC time-arrow stance, polarity sidechain, sync/pitch/pan/disintegration controls, deterministic Worker bounce, preset shelf, Maximum Ring, and shared-map Caesura mechanic are present. The live edge is the carry-forward list, the histogram-waveshaper cross-file stance, and the remaining Phase 6 work (Wet layer, Caesura sensing controls).

---

## where this sits

The original build stays intact as a **live corner of the new parameter space**: sidechain in *follow* polarity, feedback at zero, Time Arrow on ANTICIPATION. The old tool is the degenerate case, not the deprecated one.

The pitch problem being solved: current Pythia never *repeats* anything. A producer's delay is a copy of the input, displaced in time, decaying through a feedback path. Pythia's grains read near-present, amplitude-gated by the control — output is a gated smear, not an echo. The "Envelope Delay" slider shifts which control amplitude gates the grains, which is perceptually near-invisible. It reads as broken, not as precognitive. The fix is not to abandon the granular identity but to give it the two things that make a delay a delay — **displacement and regeneration** — and then let the acausal stance do what no shipping delay does.

---

## the reframe (the pitch spine)

**Regular delay is the degenerate case of granular delay.** Lock a granulator down — Hann windows, 50% overlap, grain rate matched to grain size (the COLA condition, constant overlap-add), zero position jitter, zero pitch/pan spray, every grain reading exactly `t − D` — and overlap-add reconstructs the delayed signal perfectly. A pristine echo *is* a grain cloud holding perfectly still.

Every departure from that lock is texture: timing jitter shreds the repeats, position jitter smears them, pitch spray turns them to shimmer, sub-COLA density gaps them into stutter. So "granular vs regular" is not two engines — it's **one axis measuring departure from coherence**, and the axis is **temporal jitter**. Jitter is the thing a realtime delay structurally *cannot* do: a hardware/plugin delay reads at exactly `t − D`, always, because it has no future to scatter into. Pythia has the whole file, so it can spread each grain's fire-time and read-position around the ideal `t − time` — and that spread *is* the granular character. At jitter = 0 the grains land on the lock and reconstruct the clean echo; crank it and the repeats disperse into a cloud. It's the producer-legible macro **and** the one that names what makes Pythia granular rather than just delayed: the clean delay is the granular oracle holding perfectly still.

The second spine: **the delay that already read the score.** Producers fake acausality by hand today — the reverse-reverb bounce trick, manually ducked delay sends riding a vocal. Pythia is the principled one-click version of both:

- **Time-arrow delay** — Time is a magnitude; stance owns direction. WAKE reads the past, ANTICIPATION reads the future, and SYMMETRIC performs both linked reads with an equal-power Anticipation ↔ Wake balance. Old signed-Time states migrate losslessly by sign.
- **Pre-ducking** — the sidechain sees the whole control signal, so the wet gets out of the vocal's way *before* the vocal comes in. Superpower #1 (precognition) doing an actual mixing job.

---

## architecture (proposed, not yet locked)

**Dual-path wet.** Chosen over a single COLA-morphing engine. Two readers over one delayed-signal concept:

- a **clean tap** (`DelayNode`) — pristine, cheap, guaranteed-perfect regular delay
- the **granulator** — the existing grain engine, retargeted to read `t − time`

The axis between them is surfaced as the **Scatter** knob (0 = pristine tap / exact read, 1 = draw from the whole source clip), an *equal-power crossfade* plus read-position scatter — it's the cheap/guaranteed-clean route (the `DelayNode` is bit-clean where the granulator's overlap-add wouldn't be without exact COLA scheduling) and the CPU-light regular-delay mode. Default **1** preserves the current granular sound; dialing down reveals the clean delay. **Density Jitter stays a separate knob** (independent fire-time scatter) so the classic sound stays exactly reproducible — Scatter drives crossfade + read-position spread, not fire-timing. The dual path also enables the one trick only this topology has: **the granulator inside the feedback path**. First repeat clean, each regeneration grainier — repeats *disintegrate* across generations, the granular cousin of tape degradation. Keep the COLA identity for the docs and poster; build the dual path.

**Realtime-preview boundary:** a live `DelayNode` cannot read the future, so ANTICIPATION uses a pre-echo tap bank: tap 1 reads `t + Time`, and feedback adds earlier, quieter taps that build toward the event. The offline bounce remains the authority because it can render true backward-recursive feedback over the whole buffer. A looping live source still cannot go silent mid-stream, so **𓆙 unloop** is exact in the bounce and partly approximate in live preview at clip boundaries.

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
control (sidechain) ── AMP envelope @ (t − Time − sidechainLookahead) ──┘  (follow ◄─► duck)
```

**Semantics rework:**

- **Time + Time Arrow** — Time is a non-negative magnitude. WAKE reads `t − Time`; ANTICIPATION reads `t + Time`; SYMMETRIC performs both linked reads and exposes an equal-power balance.
- **Loop / unloop (⥀ / 𓆙)** — what happens when a directional read falls outside the source clip `[0, D]`. **⥀ loop** wraps across the opposite edge; **𓆙 unloop** makes clean reads silent and clips scattered reads to available material. The toggle is the difference between "the file is a cycle" and "the file has a real beginning and end."
- **Feedback = directional clip extension** (not merely loop-gain). WAKE extends the tail, ANTICIPATION extends the head, and SYMMETRIC extends both. Its offline render runs two complete directional engines on one aligned timeline, so feedback, granular scatter, ping-pong, damping, and Caesura provenance remain exact on both sides. Live preview isolates causal wet feedback from the anticipatory tap/grain bus, preventing cross-direction recirculation.
- **Dry = source.** The signal being processed is the source; that's what a producer means by dry/wet. The control becomes an optional **sidechain** with a "monitor control" toggle for anyone who wants the old both-audible behavior.
- **Sidechain polarity** — one bipolar knob: **+1 follow** (wet rides the control's envelope — current Pythia), **0 off**, **−1 duck** (wet dodges the control — the producer move). Continuous between. The current *threshold* mode becomes a gate-shape option on the same sidechain (continuous ↔ gated).
- **Sidechain Lookahead** — signed extra offset on the AMP envelope. The envelope read is `control(t − Time − sidechainLookahead)`: Time places the delayed/pre-echo amplitude copy, and Sidechain Lookahead nudges that envelope earlier or later for duck/follow timing.

**Scheduling fix (unconditional, behavior-preserving).** Grains currently fire from the rAF loop — frame-quantized, tab-throttled, jittery. Move to an audio-clock lookahead scheduler (`setInterval` ~25 ms, schedule ~100 ms ahead, exact `start(when)` times). This is a correctness fix that changes no semantics; it lands first.

**Offline render.** The realtime path is the preview; the bounce is a deterministic offline render — sample-accurate grain placement, true WAV export (replacing MediaRecorder webm; note the old constructor never received its `mimeType` anyway), finite head/tail extension, and an acausal peak ceiling. The first implementation is a sample-domain renderer rather than an `OfflineAudioContext` graph because negative-time feedback needs backward recursion (`y(t)` depends on `y(t+|D|)`), which Web Audio delay nodes cannot express directly. This is the Hindcast commitment paying rent: the whole file is known, so the render can be exact.

---

## the preservation contract

What current Pythia does must remain reachable at every phase:

| current behavior | where it lives in the new engine | status |
|---|---|---|
| grains read `t + lookahead` | ANTICIPATION with Time = old lookahead magnitude | ✅ |
| amplitude-gated by control RMS | Polarity = +1 (follow) | ✅ |
| envelope-delay shifting the amp read | Sidechain Lookahead (signed, was `delay`) | ✅ |
| threshold / triggered mode | Gate checkbox (follow-direction, polarity≥0) | ✅ |
| self-sampling | source = control, unchanged | ✅ |
| control audible as dry | Monitor Control toggle (+ Source in Dry off) | ✅ |
| modulo-wrap on out-of-clip reads | ⥀ loop mode (default) | ✅ |
| no repeats | feedback = 0 (no clip extension) | ✅ |
| grain size / density / jitter / envelope shape | unchanged, now also feeding Scatter | ✅ |

**Pneuma Classic remains a preservation recipe**, not a permanent top-level control: legacy saves still migrate into the old source/control routing, and the old sound stays expressible from the table above. The dedicated Classic button was retired once the preset shelf became the primary surface.

---

## phases

**Phase 0 — groundwork (no audible change).**
Audio-clock grain scheduler replacing rAF-driven firing. State object as single source of truth (`{ version, params, sidechain, … }`), JSON export/import, versioned from day one — audio stays out of the JSON. Hann window option alongside the current linear attack/decay (linear clicks at short grain sizes). Verify: old sound, steadier timing.

**Phase 1 — delay semantics.** Built in verifiable increments:

1. *Time displacement + loop/unloop.* ✅ **Time** first shipped signed, then migrated in v8 to a magnitude plus WAKE / ANTICIPATION / SYMMETRIC stance. Old sign is preserved as stance on import. The current `delay` param stays put — it is the amp-gate offset, and becomes duck-lookahead in Phase 2's sidechain rework, *not* merged into Time. Loop/unloop toggle (⥀ wrap / 𓆙 no opposite-edge sampling; clean reads silence, scattered grains expand inward).
2. *Clean tap + Scatter axis.* ✅ Clean `DelayNode` tap alongside the granulator; **Scatter** equal-power-crossfades exact delay toward whole-clip granular reads. Unlooped scatter stays inside available material. ANTICIPATION clean preview uses the pre-echo tap bank, so Scatter=0 remains the plain anticipatory-delay spine.
3. *Feedback + shared-timeline viz.* ✅ Realtime WAKE feedback is a **decaying loop on its isolated causal wet bus** (`causalWetBus → fbDelay → damping LPF → feedbackGain → causalWetBus`; legal cycle via the DelayNode; works at any Scatter). ANTICIPATION has a separate pre-echo tap/grain bus, so symmetric preview never recirculates future-reading material into the causal loop. **Feedback** (0–0.95, clamped <1) + **Damping** (LPF, each pass darker). **Master safety limiter** shipped: fast compressor + `tanh` soft-clip wall (ceiling ≈ −0.2 dBFS) so feedback cannot exceed 0 dBFS — a causal preview guardrail; the bounce does the true acausal ceiling. **Viz correction:** ctrl/src stay anchored on the clip timeline; Time does not move the viewport. AMP shows the active stance displacement(s), while SRC dots show source read positions under that envelope. Literal head/tail extension belongs to the offline bounce.

*Anticipatory-delay correction (2026-07-10; migrated to stance 2026-07-17)*: quiet repeats grow into the event. Live ANTICIPATION builds a pre-echo tap bank (`t + Time`, then earlier taps scaled by Feedback); Bounce WAV performs exact backward recursion. Anticipatory Delay, Verbatim Pre-Echo, Anticipation Bloom, Negative Shimmer, and Reverse Room now store positive Time magnitude plus `temporalStance: 'anticipation'`.

*Verified (2026-07-11, post-migration to `hindcasts/pythia/`)*: bounce anticipatory crescendo intact (impulse at 0.5 s, `time −0.4`, feedback 0.6 → pre-echo train rising `0.04 → 0.06 → 0.11 → 0.18 → 0.30` into the event, spacing = |time|); normal `+0.4` decays after. Byte-determinism holds (heavy pitch/pan/density spray → identical SHA-256); acausal ceiling still clamps the clean-tap buildup to exactly 0.977. **Live pre-echo tap bank confirmed audible**: `scatter 0, time −0.4, feedback 0.6` builds a 15-tap bank into `preEchoGain` measuring RMS 0.079 under a real gesture (the anticipatory spine is now auditionable live, not bounce-only). Rebuilds on Time/Feedback/loop changes without error. All 16 presets apply with correct payloads; selector reverts to `custom` on manual edit; zero console errors.

Dry-bus semantics stayed deferred here and landed in Phase 2: source is dry by default, control is optional monitor. **This phase is where it starts sounding like a delay.**

**Phase 2 — the sidechain rework (where it stays Pythia).** ✅ Shipped and verified.
**Polarity** (bipolar −1…1, default +1) replaces the implicit always-follow: `amp = max(0, polarity≥0 ? 1−polarity·(1−e) : 1+polarity·e)`, one formula that reduces algebraically to exactly the old unclamped envelope at +1 (classic, unchanged), gives constant full amplitude at 0 (sidechain off), and duck (`1−e`, clamped ≥0) at −1. **Gate checkbox** absorbs threshold mode as a shape toggle on the same sidechain; direction flips with polarity's sign — follow-gate fires above threshold (old behavior), duck-gate fires *below* it, filling the gaps (a new, legitimate mode this formula gives for free). `delay` renamed to **Sidechain Lookahead** as the signed extra AMP-envelope offset. **Dry bus rework**: dry is now the *source* by default (`Source in Dry`, default on) — what a producer means by dry — with control demoted to an optional **Monitor Control** tap (default off) for hearing the sidechain itself. Both feed a new `dryBus` ahead of the existing mix gain. The Classic recipe originally shipped as a one-click button; that dedicated button is now retired, while old (v1) saves still migrate `delay→sidechainLookahead` (identity) and `mode→gate+polarity`, and get `sourceDry:false, monitorControl:true` by default (since v1 files only ever had control audible).

*Verified*: polarity formula confirmed exactly against a steady test signal (follow mean 0.844 → predicted duck 1−0.844=0.156 → measured duck mean 0.156, exact match; off = constant 1.000). Gate direction-flip confirmed by grain-fire counts (threshold below envelope: follow fires 20/20, duck fires 0/20; threshold above: follow 0/21, duck fires 21/21). Dry-bus routing confirmed via node-level RMS probes (exact 0 when a tap is gated off, nonzero when on). Classic recipe and full v2 state round-trip verified field-for-field; v1-legacy-file migration verified (delay→sidechainLookahead, mode:'triggered'→gate:true, dry-bus legacy defaults applied).

*Scoping note*: control is still a required file (used as the scheduler's clock/modulo reference) — "optional sidechain" here means audibility and influence are optional (polarity=0, Monitor Control off), not that the file itself is optional. True control-optional / single-file operation is future work if wanted.

*Viz cleanup after Phase 2, corrected after the AMP model was clarified*: `ctrl` is the control clip/clock/envelope donor; `amp` is that control envelope placed in delay time. WAKE uses `control(t − Time − sidechainLookahead)`; ANTICIPATION mirrors the Time displacement; SYMMETRIC draws both. `src` is the audio material read under the AMP envelope. In the self-source degenerate case, AMP and SRC describe the same delayed clip; with an alternate source, SRC is enveloped by AMP.

**Phase 3 — producer legitimacy.** ✅ All four slices shipped and verified.
BPM + note-division sync (1/4, 1/8 dotted, triplets; free-ms fallback). Per-grain pan spray → stereo width; optional ping-pong. Per-grain pitch spray (shipped as continuous ±24 st center + spray rather than fixed +12/+7 shimmer presets — strictly more general; shimmer presets can ride on the preset shelf). Disintegrating feedback.

*Verified (2026-07-10; stance migration rechecked 2026-07-17)*: Time Sync math exact (120 BPM ¼ → 0.50 s, 90 BPM ¼ → 0.67 s, 90 BPM dotted-8th → 0.50 s); sync preserves Time magnitude and stance, while manual Time movement reverts the selector to free. Stereo: pan spray 0 → output channels byte-identical; pan spray 1 + ping-pong → L/R difference ratio 1.13 (near the √2 hard-alternation ceiling). Live playback stable with pitch +7, spray 3, pan 0.5, feedback-grain 0.6 all hot; zero console errors. Legacy Classic recipe zeroes every Phase-3 param (verified field-for-field); old state versions migrate into v8.

*Audibility note*: **Ping-Pong requires Pan Spray > 0 to be audible** — the feedback channel-swap is a no-op on centered material. Consider auto-nudging pan spray when ping-pong is enabled, or noting it in the UI hint.

*First slice shipped*: user-settable **BPM** plus **Time Sync** selector for `Time` (free seconds, 1/1, 1/2, 1/4, dotted 1/8, 1/8, triplet 1/8, 1/16). Sync now writes Time magnitude; time-arrow stance supplies direction. Manual Time movement returns the selector to free seconds.

*Second slice shipped*: per-grain **Pitch** (center semitones, −24…+24) and **Pitch Spray** (random ± semitones per grain, 0…24) on the granulator path. Clean tap remains pristine at Scatter=0 by design; pitch/spray become audible as Scatter opens. Live grains use `AudioBufferSourceNode.playbackRate`; Bounce WAV uses the same sample-domain pitch-rate read. State version bumped to 4; older saves default pitch fields to 0.

*Third slice shipped*: per-grain **Pan Spray** (0…1 stereo width) on the granulator path, plus **Ping-Pong** feedback mode. Pan Spray at 0 preserves the old channel path; when opened, grains are equal-power panned, with random pan by default or alternating left/right under Ping-Pong. The live feedback loop now swaps stereo channels when Ping-Pong is enabled; Bounce WAV uses the same channel-swapped recursive feedback. State version bumped to 5; older saves default to no Pan Spray and Ping-Pong off.

*Fourth slice shipped*: **Feedback Grain** (0…1 disintegration) controls how much the feedback return smears into sub-grain offset reads as it regenerates. At 0 it preserves clean recursive feedback; opening it makes repeats blur and darken while honoring time-arrow direction and Ping-Pong routing. Realtime preview uses a cheaper darkened-return approximation; Bounce WAV renders deterministic pass-by-pass smear.

*Preset shelf — current build spec now lives in `pythia-presets.md` (17 active presets with exact param payloads, including linked-symmetric **Janus Delay**). Classic remains a preservation recipe through legacy state migration. Original sketch:*
- **Oracle Chorus** — short synced/free Time, low feedback, modest Scatter, tiny Pitch Spray, wide Pan Spray; wet-only or high wet for chorus/doubler use.
- **Stereo Vapor** — Scatter high, Density Jitter low-mid, Pitch Spray subtle, Pan Spray wide; feedback near zero so it widens without obvious repeats.
- **Ping-Pong Pneuma** — positive Time, moderate feedback+damping, Ping-Pong on, Pan Spray low; producer-legible stereo delay.
- **Disintegrating Echo** — clean first repeat, feedback return increasingly smeared/dark/wide with Feedback Grain opened.
- **Pre-Chorus / Pre-Widen** — ANTICIPATION, subtle Pitch Spray + Pan Spray; anticipation cloud that blooms before the source.

**Phase 4 — the bounce.** ✅ Pulled forward before Phase 3. Verified.
The old MediaRecorder capture button is now **Bounce WAV**: a deterministic 32-bit float WAV render from loaded buffers and state. Directional renders extend head or tail; SYMMETRIC aligns both complete passes, equal-power blends them, then applies one acausal peak ceiling at ≈ −0.2 dBFS. Dry extension rooms remain silent and sample-aligned. Grains use a state-derived seeded PRNG; opposite directions share seed geometry. State v9 stores stance + Time magnitude + explicit Caesura policy while migrating old signed-Time and `gapFitEnabled` saves.

*Design note*: this is a **pure sample-domain render**, not the `OfflineAudioContext` the roadmap originally named — the deviation is an upgrade: `OfflineAudioContext` could not provide byte-determinism (Web Audio nodes have no seedable RNG path) or ANTICIPATION's backward-recursive feedback.

*Verified (2026-07-10, decoded WAV analysis on a 1 s test clip)*: positive Time +0.5 → duration exactly 1.50 s with delayed-copy energy in the tail (RMS 0.30); negative Time −0.5 → pre-echo energy in the head *before* the dry enters (RMS 0.18), dry silent in extensions. **Byte-determinism**: two bounces with pitch spray 6, pan spray 0.7, density jitter 0.5 all active → identical SHA-256. **Acausal ceiling**: feedback 0.95 at full wet → decoded peak exactly 0.977 (−0.2 dBFS), and the 8 s ring-cap confirmed by output duration 9.40 s (= 1 + 0.4 + 8).

*Phase-4 carry-forwards*:
- **Worker offload** — ✅ Shipped 2026-07-11. Reorganized rendering logic into a standalone file [pythia-worker.js](file:///f:/xyh/hindcasts/pythia/pythia-worker.js). Uses a background Web Worker when served over HTTP/HTTPS to prevent UI lockup, and falls back to synchronous main-thread execution under the `file://` protocol to ensure full local filesystem compatibility.
- ✅ **Maximum Ring** shipped 2026-07-13. The former 8 s constant is now a 0–12 s stateful control; 8 s remains the compatibility default.
- Preview ↔ bounce is a documented **approximation relationship**, not bit-matching (live: causal limiter, no head extension, damping-as-disintegration). By design, not drift.

Order rationale: 0 is a bug-class fix wearing a refactor's clothes; 1 alone makes it *sound* like a delay; 2 makes it Pythia rather than a Portal clone; 4 came before 3 because sync/pitch/pan controls need a trustworthy offline truth first.

**Phase 5 — Caesura / Gap Fit MVP (shipped 2026-07-13).**
Delay mud is the same disease as reverb mud: repeats colliding with an event they couldn't see. Producers ride send/feedback automation by hand — the same manually-performed acausality Metachamber applies to tails. **Caesura** names the shared gap-aware mechanic; “Gap Fit” is its plain-language description. It consumes the canonical **gap map v1** analyzer in `hindcasts/shared/gap-map.js` (also used by Metachamber) and budgets the echo train per source event:

- **Repeat budget.** Feedback stops being one global decay law: per source event, the number of repeats / decay rate is solved so the train falls to **Spill** dB before the next onset (with **masking credit** — repeats under a louder next hit run free). In this engine's frame that's natural: feedback is already *clip extension + decay law*, so gap-awareness = the decay law goes per-event.
- **Repeat-quantized kill** — the delay-specific twist reverb doesn't have. A tail decays continuously; a delay's repeats are discrete, often rhythmic (Time Sync). The MVP steepens the event's feedback coefficient as needed, then stops after a whole repeat at the natural/Maximum Ring boundary; it never cuts through a repeat.
- **Directional fit, including symmetry.** ANTICIPATION budgets against the *preceding* gap; WAKE budgets against the next gap. SYMMETRIC runs both policies from the same canonical gap map, then aligns and balances the two complete renders. Rack composition remains the route for independently voiced halves.
- **Not the polarity sidechain.** Duck polarity shapes the wet by the control's *envelope* (continuous, signal-following); gap-aware is *structural* — event-wise decisions from whole-file analysis, active even with the sidechain off. Implementation-wise they compose: gap budget writes a per-event feedback-gain/decay schedule, polarity still multiplies on top.
- **Maximum still means maximum.** The effective train is bounded by the natural −60 dB decay, **Maximum Ring**, and the event's gap-derived budget. Gap Fit never lengthens a train.
- **Where it lives.** Bounce is authoritative. It renders whole feedback passes with source-event provenance, a per-event effective feedback coefficient, damping, feedback-grain texture, and ping-pong intact. Negative live preview honors Maximum Ring in its tap count; the realtime path does not yet reproduce event-wise Gap Fit, consistent with the existing preview↔bounce approximation contract.
- **State/UI.** Caesura is an explicit OFF / FIT / DUCK policy, not merely a preset. OFF keeps the fixed feedback law in both directions; FIT enables the gap map and its repeat budgets; DUCK keeps the fixed law and rides the wet (added 2026-08-13). `Spill` and `Masking Credit` feed FIT and DUCK alike. State v10 stores `caesuraPolicy` while retaining and migrating the internal `gapFitEnabled` field for compatibility (it stays true only for FIT); existing states and presets remain OFF by default.

Adjacency guard extension: **Pythia does not grow its own gap analysis.** Metachamber and Pythia both load the canonical shared analyzer and apply the Caesura mechanic with different policies; Pythia derives only its repeat policy. Spill/masking/RT policy remains intentionally absent from the shared v1 wire shape. If the map's schema changes, this phase, Metachamber's spec/tests, and `DEPENDENCIES.md` move together.

**Phase 6 — symmetry contract build-out (planned 2026-07-17; DUCK shipped 2026-08-13).**
The suite contract (`../hindcasts.md`, symmetry section) fixes the shared surface: Time Arrow, Balance, Caesura OFF/FIT/DUCK, Wet layer, one gap map. Pythia now exposes the whole OFF/FIT/DUCK policy and still lacks the Wet layer and the shared sensing controls.

- **Caesura DUCK — shipped 2026-08-13.** The gap-map wet ride, Metachamber's second policy ported to the echo train: fixed feedback law, wet gain pulled down into each oncoming event. Structural, not the polarity sidechain — the same boundary Phase 5 draws: the ride comes from whole-file event analysis and is active with the sidechain off; polarity still multiplies on top. What it solves per event pair: the budget is the same Spill / masking-credit / floor solve FIT uses, and the *predicted* arriving level is the fixed train's own — the primary tap itself when the gap is shorter than Time, otherwise `feedback^k` for the repeat that crosses the gap. Ride depth is the shortfall between the two, so a train that already fits asks for no ride at all and the bounce comes out bit-identical to OFF. Direction follows Time: WAKE rides the event ahead, ANTICIPATION the event behind, SYMMETRIC solves each linked direction from the same map.
- **The ride shape is a raised cosine, not a smoothed rectangle.** Metachamber marks the event spans and runs a forward/backward one-pole over them; at delay timescales that filter cannot reach its own target — a 45 ms span smoothed with a 45 ms constant only gets a third of the way down. Pythia builds the ride directly instead: full requested depth held across the event, with a 45 ms raised-cosine skirt of equal length either side. Same zero-phase property, exact depth, and no group delay, verified by the two skirts measuring equal.
- **Decision, held: the ride may dip mid-repeat.** The repeat-quantized kill rule ("never cuts through a repeat") stays a FIT property. DUCK is a gain ride, not a kill — it automates the hand-ridden send, and hand-ridden sends dip through repeats. Continuous shipped as agreed 2026-07-17; the fallback (ride control points quantized to repeat boundaries, each successive repeat lowered gradually) is still on the shelf if the continuous ride reads as wrong on rhythmic material. **That call is still open by ear** — it has been verified numerically, not auditioned on music.
- **Where it lives.** Bounce only, like FIT: the ride multiplies the summed wet after the feedback render, so the dry is untouched at any mix. Live preview does not reproduce it, consistent with the existing preview↔bounce approximation contract.
- **Caesura sensing controls** — the analyzer's parameters (onset threshold, what counts as a sound to measure from, operational floor, holds) surface as a shared settings block wherever Caesura is on — the same vocabulary in Metachamber, per the symmetry contract. Currently hardcoded defaults in `shared/gap-map.js`; exposure is additive to the v1 wire shape.
- **Wet layer** — mix-law switch: dry at unity, both directional wets at full (send-style), in place of the equal-power insert blend. Bounce's acausal peak ceiling covers the hotter sum; live preview leans on the existing safety limiter. Open (shared with Metachamber): Wet layer forcing both directions to unity vs Balance still weighting the pair — leaning override, since the gesture is "both at 100%."

---

## open questions (park, don't block)

- **Time as a drawn curve (penciled 2026-07-12)** — scalar Time is now magnitude, but a future **signed displacement curve** may inscribe both magnitude and direction over the clip. Crossing zero gives exact through-zero flanging; live TZF must secretly delay the dry path, while the offline curve makes the crossing native. Chorus already exists as the Oracle Chorus jittered grain cloud.
- **Valhalla-adjacent feedback colors (noted 2026-07-12)** — Shimmer-style pitch-in-feedback may already be expressible (Feedback Grain routed through the granulator with pitch center +12) → verify, then preset-shelf it ("Shimmer ladder"). FreqEcho-style **frequency shift** in the feedback path (Bode/SSB — inharmonic barberpole, not pitch shift) is a distinct small color worth one checkbox someday.

- **Smear at the extremes** — does the crossfade need an equal-power law, or does the granulator at full COLA-lock get close enough that the midpoint doesn't dip?
- **Realtime preview vs anticipatory feedback** — live anticipation uses a pre-echo tap bank; Bounce WAV remains authoritative through true backward recursion and exact clip-boundary silence.
- **Symmetric delay — shipped 2026-07-17.** WAKE / ANTICIPATION / SYMMETRIC now matches Prolepsis and Metachamber. One Time magnitude, feedback, scatter, pitch, pan, sidechain, and Caesura setup feeds both directions; Anticipation ↔ Wake balances them. Rack composition remains the route for independently voiced halves.
- **Naming shelf** — jitter axis as *Jitter* vs *Scatter* vs *Dispersion*; polarity knob as *Stance* (follow/duck) keeps the oracle register. The Delphic frame has room: the clean tap as *the verbatim oracle*, full jitter as *the vapor*. Loop/unloop glyphs ⥀ / 𓆙 (ouroboros vs the open serpent) are a keeper if they render cross-platform — verify 𓆙 (Egyptian hieroglyph U+13199) has fallback.
- **Histogram-waveshaper cross-file preset** (hindcasts.md next-move #2) is now unblocked by Phase 2: it slots into the same control/source input, with control donating *statistics* instead of an envelope — effectively a fourth stance, not a new input.

---

## adjacency guard

`remanence` already owns whole-file acausal **multi-tap** with negative taps and reel geometry. Pythia does not grow arbitrary taps; it stays **granular + one displaced-read family**, optionally integrated in one or both temporal directions. The overlap zone (pre-echo) is shared vocabulary, not shared mechanism — remanence's pre-echoes are print-through physics, Pythia's are the oracle reading ahead. Independently voiced symmetric halves still belong in parallel rack cells; a linked symmetric stance belongs in Pythia itself.

The control/source dual input is the **suite-wide shared interface** (see `hindcasts/hindcasts.md` adjacencies). Phase 2 changed its meaning from control-as-gate to control-as-sidechain/structure donor with polarity, gate shape, lookahead, and optional monitor; `hindcasts.md` and `DEPENDENCIES.md` track that contract. Keep all three synced if this interface changes again.
