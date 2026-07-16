# METACHAMBER

*a chamber shaped by the future — a tail that knows how much room it has · HINDCASTS / audio*

**renamed from Caesura 2026-07-13.** Caesura is retained as the shared gap-aware mechanic used here and in Pythia.

---

## one line

Reverb's original sin is that the tail cannot know how much room it has: **mud is a tail colliding with an event it couldn't see.** Metachamber reads the whole file first, measures every silence, and uses **Caesura** to fit each event's tail to the gap that actually follows it. The classical manual ritual — riding wet/damping automation down into the busy sections, opening it up for the exposed ones — made structural: a real effect instead of a mixdown chore.

---

## thesis

A live reverb is **one room for all events.** Its decay is chosen as a compromise: long enough to flatter the sparse passages, short enough not to smear the busy ones — and it is wrong at both ends. Engineers resolve this with automation envelopes, which is to say **manually performed acausality**: the engineer has heard the whole song, and the CC lane is where that foreknowledge gets written down by hand. Metachamber is that foreknowledge as the effect itself.

Lookahead can't buy this. A limiter's lookahead is milliseconds; the gaps that govern a tail are **seconds** — a live reverb would need to see further ahead than any monitoring path can tolerate. The information genuinely does not exist at decision time. This is the suite's cleanest case of an *every-session insert* whose ideal form is structurally un-live.

Two acausal facts the live version can never hold:

1. **The gap.** How long until the next event — the tail's actual budget.
2. **The mask.** How loud that next event is. Spill only matters if it's *audible*: a tail running long under a louder next hit is free. The spill constraint is perceptual, not energetic, and it requires knowing the future event's level, not just its time.

Superpowers drawn on: **precognition + whole-signal optimization + global statistics** (audibility floor, masking).

---

## the gap map (the acausal asset — suite substrate, not private)

The analysis pass, separable from the reverb that consumes it:

- **Segment** the file into events (onset/release detection, whole-file).
- Per event: **gap to next onset**, **level of next onset** (for masking credit), and a **per-band variant** (a crash's gap is not a bass note's gap — the highs may have room while the lows are already occupied).
- **Audibility floor** from global statistics — the noise floor / quietest-percentile level a tail must decay to before it counts as "gone."

**Caesura is shared infrastructure**, in the same way the control/source dual input is. It names the gap-aware mechanic: analyze neighboring events, derive a permissible resonance budget, then clear or reshape the tail at the known boundary. The canonical analyzer lives at `../shared/gap-map.js`; Metachamber and Pythia both load it and apply effect-specific policy. Delay and reverb do **not** merge into one tool: the engines differ in kind (sparse discrete taps + feedback vs t²-growing echo density through a diffusion network), and the sounder collapse (same op, one τ) does not apply. What collapses is the *analysis and boundary vocabulary*: one gap map, two active consumer policies.

---

## stances (one engine, four uses)

- **FIT** — *the room resizes per event.* RT60 solved per event so the decay reaches the floor (or the Spill allowance under the next onset) exactly when the next event lands. Every hit gets its own room. The flagship stance; the one with no live approximation at all.
- **DUCK** — *one fixed room, wet rides.* The classical automation ritual automated: wet/damping envelope derived from the gap map, pulled down ahead of each oncoming event — with **bidirectional (zero-phase) smoothing**, so the ride has no pumping and no attack lag in either direction.
- **SWELL** — *pre-verb, budgeted.* The tail mirrored before the hit, its length fit to the *preceding* gap. Remanence's Wind applied to a room; absorbs the pre-verb one-liner with a budget it never had as a tape trick.
- **HOLLOW** — *wet only where the dry is silent.* Reverb poured exclusively into the negative space; the tail becomes the figure, the events become the frame. Negative-space granulation's kin in the tail domain.

---

## controls

- **Spill** (dB relative to the event, −∞ … 0) — allowed tail level at the moment the next onset lands. −∞ = fully caesura'd (tail down to the operational floor by the next event); 0 dB ≈ ordinary reverb behavior. *The threshold-of-when-to-dampen, as one number.* (Candidate control name: **Enjambment** — the line spilling over the break.)
- **Masking credit** (0–100%) — how much a *louder* next event excuses spill. At 100%, a tail under a masking hit runs free; at 0%, gaps are enforced energetically regardless of audibility.
- **Room law** — a **drawn curve** gap → RT60 (inscription, not a knob — the TaboTa argument, fourth appearance), clamped to [RT-min, RT-max]. Identity line = FIT's natural solution; bending it is where the tool becomes expressive (short gaps get *longer* rooms = deliberate smear; long gaps get dry = starkness).
- **Per-band sensing** (toggle) — gap map computed per band; the highs' budget separate from the lows'.
- Base-room voicing: **pre-delay, damping/tone, wet/dry** — the ordinary reverb face, unchanged.

---

## construction

**MVP** — three fixed deterministic FDN rooms + event-side routing derived from the gap map. Ships DUCK fully and a coarse FIT: events enter the bracketing rooms before diffusion, so a ringing tail never changes room when the next event arrives. Cheap, robust, already past what automation-by-hand achieves (zero-phase envelopes, masking credit). Per-band sensing remains deferred.

**Full** — **per-event tail rendering**: segment the dry into events, convolve *each event* with its own kernel (RT60 solved per event), sum the tails. Offline makes per-event convolution affordable; this is the acausal luxury no latency budget can buy, and the version where FIT is exact rather than approximated.

Both: envelope smoothing is bidirectional/zero-phase throughout — no attack/release asymmetry anywhere in the control path.

### MVP — shipped 2026-07-12

Built at `metachamber/index.html` in the suite's drop file → analyze → preview/A-B → **Bounce WAV** pattern. It imports only the local shared gap-map analyzer. The sample-domain FDN render is deterministic within the JS engine; preview and 32-bit float WAV use the same final PCM. Repeatable tests live in `test-metachamber.mjs` and `test-browser.mjs`.

**Pipeline:**

1. **Decode** → channel-energy analysis (so anti-phase stereo cannot cancel itself out of the detector) + mono waveform display; mono/stereo rendering preserves source channels.
2. **Caesura / gap map** (canonical shared mechanic; Pythia is the second active consumer):
   - ~46 ms Hann/FFT window, ~10 ms hop, channel-energy RMS + 80 Hz–12 kHz spectral flux, centered local threshold, 75–80 ms onset/release holds.
   - Operational floor = clamped quiet-percentile statistic; releases are measured before silence gaps, rather than treating onset-to-onset time as free tail space.
   - Shared v1 JSON uses sample indices and explicit units: `{sampleRate, durationSamples, floorDbfs, analysis, events[]}` with `onsetSample`, `releaseSample`, `eventRmsPeakDbfs`, `nextOnsetSample`, `nextOnsetRmsDbfs`, `interOnsetSamples`, `silenceGapSamples`, `confidence`.
3. **Budgets**: Spill is dB relative to the preceding event. Masking credit interpolates that relative allowance toward the next onset's level minus a conservative masking margin. Available decay time is `silenceGap − preDelay`; solve `RT60 = 60 · availableGap / requiredDropDb`, clamp to [RT-min, RT-max], and mark constraints below RT-min as infeasible rather than pretending the clamp met them.
4. **Render — the corrected three-room trick**: deterministic, mutually coherent FDN rooms at RT-min / geometric-mid / RT-max. Each event is routed into its two bracketing rooms **before** diffusion; already-ringing tails remain in the room they were assigned. A wet-only post guard enforces summed-tail budgets at crowded cuts.
5. **DUCK path**: one fixed RT-max room + wet-gain targets over incoming event spans, forward/backward one-pole smoothing, then symmetric onset pins where smoothing made a short dip too shallow.
6. **Mix + export**: pre-delay, feedback-loop damping, equal-power wet/dry, one whole-file peak guard, exact-buffer preview, 32-bit float WAV out.

**UI (minimal):** waveform with the **gap map drawn on it** — event spans, each event's budget shown as a decaying wedge dying exactly at the next onset (the acausality made visible; this viz is half the tool's argument). Controls: Spill, Masking credit, RT-min/max, stance toggle (FIT/DUCK), pre-delay, damping, wet/dry.

**Verified:** synthetic irregular impulse train → five onsets within one analysis hop; silence yields no fabricated event; FIT and DUCK both pass every wet-only pre-onset budget check; anti-phase stereo remains detectable and visible; all samples finite; room routing, anchor decay, mono/stereo, render-length, worker-transfer, and WAV payload contracts hold; two bounces are sample-identical and have the same SHA-256. `node metachamber/test-metachamber.mjs` passes. `test-browser.mjs` is a dependency-free Edge DevTools-pipe harness for the full decode → Blob-worker analysis → render → UI lifecycle.

**Deferred past MVP:** SWELL (time-mirror the wet segment pre-render — cheap once per-event segmentation exists), HOLLOW, drawn room law, per-band gap sensing, per-event exact kernels (true FIT), synthetic/self/donor IR sources, and strict cross-browser byte identity.

---

## absorbs (from the further-members shelf)

- **Pre-verb** → SWELL stance.
- **Future-sidechain** (applied to own wet) → DUCK stance.
- **Self-convolution reverb** → candidate *kernel source* option (IR = the file's own autocorrelation); deferred, listed below.

---

## deferred / open questions

- **Density axis inside Metachamber?** (slapback → multitap → cloud → diffuse as one slider.) Parked: Pythia owns discrete echoes; revisit only if gap-aware delay outgrows its Caesura feature. The suite boundary is engine kind, not gap-awareness.
- **Kernel sources** — beyond the synthetic room: the file's own autocorrelation (absorbing self-convolution), or a second file's IR on the control/source input (the room as donor).
- **Video cousin** — trail/wake length budgeted by gap-to-next-motion; Prolepsis kinship. Parked.
- **Interaction with the rack** — Metachamber after Sounder in a chain gets a gap map measured on *processed* dynamics; order matters and the offline rack makes both orders auditioning-cheap.
- **Color modes** — one orthogonal color axis (Neutral / Bright / Dark, à la VintageVerb's eras and FutureVerb's four colors), applied at IR-generation time. Cheap on the seeded-IR engine; not a full EQ. The Valhalla lesson: one color knob's worth of modes, never a tone section.
- **Hypergeometry / orthotope rooms** — multidimensional room mechanics are compelling special-effect color, but not intrinsically acausal. Defer until whole-file knowledge earns the feature: dimension or geometry chosen per event, fitted to the coming gap, or projected backward as a future chamber.

---

## naming

- **Metachamber** — chosen 2026-07-13. The instrument is not one mutable room but a chamber *about chambers*: a higher-order reverb assigning acoustic space per event with foreknowledge. Clear sibling sentence: **Pythia reads ahead in time; Metachamber rebuilds space around what it finds.**
- **Caesura** — retained for the shared mechanic. The cut inside the verse line, and the pedal-like act of clearing resonance at a known structural boundary. Pythia applies it to repeat trains; Metachamber applies it to diffuse tails. “Gap Fit” remains the plain-language description.
- *Kairos* — the opportune, right-sized moment (vs chronos); the tail fit to its opportunity. Strong, but Greek-philosophic solemn — adds to the heavy pile Caesura relieves.
- *Lacuna* — the manuscript gap; closest to HOLLOW alone, narrower than the whole tool.
- *Fermata* — the held pause; benign, maybe too gentle.
- *Enjambment* — the spill-over itself; better spent as the Spill control's name than the tool's.

**Notation vein** (score-marking words — a register lane the suite hasn't opened; plain-technical tone, low collision):
- *Tacet* — "it is silent"; the score's instruction for an enforced rest. Names exactly what the tool enforces between events.
- *Niente* — *al niente*, decay to nothing; names the method precisely (RT60 solved so each tail lands al niente at the next onset). The dynamic marking as tool name.
- *Luftpause* — the breath mark (' above the staff); gap-as-breath, with reverb-as-air underneath. Charming without spending the suite's one joke.
- (*Slack water* — the oceanic-vein sibling, pause between ebb and flood; semantically perfect, killed by Slack-the-app on googlability.)

---

*spine: a tail that has measured every silence before the first note rings.*
