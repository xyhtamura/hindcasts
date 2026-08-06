# METACHAMBER

*a chamber shaped by both horizons — wake, anticipation, and symmetric bloom · HINDCASTS / audio*

**renamed from Caesura 2026-07-13.** Caesura is retained as the shared gap-aware mechanic used here and in Pythia.

---

## one line

Reverb's original sin is that the tail cannot know how much room it has: **mud is a tail colliding with an event it couldn't see.** Metachamber reads the whole file first, measures every silence, and uses **Caesura** to fit each event's diffuse field to either adjacent gap. The same chamber can trail the event, gather into it from the past, or bloom symmetrically around it.

---

## thesis

A live reverb is **one room for all events.** Its decay is chosen as a compromise: long enough to flatter the sparse passages, short enough not to smear the busy ones — and it is wrong at both ends. Engineers resolve this with automation envelopes, which is to say **manually performed acausality**: the engineer has heard the whole song, and the CC lane is where that foreknowledge gets written down by hand. Metachamber is that foreknowledge as the effect itself.

Lookahead can't buy this. A limiter's lookahead is milliseconds; the gaps that govern a tail are **seconds** — a live reverb would need to see further ahead than any monitoring path can tolerate. The information genuinely does not exist at decision time. This is the suite's cleanest case of an *every-session insert* whose ideal form is structurally un-live.

Three acausal facts the live version can never hold:

1. **The gap.** How long until the next event — the tail's actual budget.
2. **The mask.** How loud that next event is. Spill only matters if it's *audible*: a tail running long under a louder next hit is free. The spill constraint is perceptual, not energetic, and it requires knowing the future event's level, not just its time.
3. **The reverse room.** A diffuse field may be integrated backward so it resolves into an event. This is not a reversed bounce pasted in front: the FDN recursion itself runs from future to past, with its own preceding-gap budget.

Superpowers drawn on: **precognition + whole-signal optimization + global statistics** (audibility floor, masking).

---

## the gap map (the acausal asset — suite substrate, not private)

The analysis pass, separable from the reverb that consumes it:

- **Segment** the file into events (onset/release detection, whole-file).
- Per event: **gap to next onset**, **level of next onset** (for masking credit), and a **per-band variant** (a crash's gap is not a bass note's gap — the highs may have room while the lows are already occupied).
- **Audibility floor** from global statistics — the noise floor / quietest-percentile level a tail must decay to before it counts as "gone."

**Caesura is shared infrastructure**, in the same way the control/source dual input is. It names the gap-aware mechanic: analyze neighboring events, derive a permissible resonance budget, then clear or reshape the tail at the known boundary. The canonical analyzer lives at `../shared/gap-map.js`; Metachamber and Pythia both load it and apply effect-specific policy. Delay and reverb do **not** merge into one tool: the engines differ in kind (sparse discrete taps + feedback vs t²-growing echo density through a diffusion network), and the sounder collapse (same op, one τ) does not apply. What collapses is the *analysis and boundary vocabulary*: one gap map, two active consumer policies.

---

## two orthogonal stance axes

These two axes are Metachamber's half of the suite **symmetry contract** (`../hindcasts.md`, symmetry section): Time Arrow, Balance, Caesura OFF/FIT/DUCK, Wet layer, one gap map.

**Caesura policy:**

- **OFF** — *shipped 2026-07-24.* No gap awareness: the fixed RT-max room renders either horizon or both, nothing fits and nothing rides. In SYMMETRIC this is the direct pre-verb + verb gesture: the same unmodified chamber before and after the source.
- **FIT** — *the room resizes per event.* RT60 solved per event so the decay reaches the floor (or the Spill allowance under the next onset) exactly when the next event lands. Every hit gets its own room. The flagship stance; the one with no live approximation at all.
- **DUCK** — *one fixed room, wet rides.* The classical automation ritual automated: wet/damping envelope derived from the gap map, pulled down ahead of each oncoming event — with **bidirectional (zero-phase) smoothing**, so the ride has no pumping and no attack lag in either direction.

**Time arrow:**

- **WAKE** — causal FDN recursion; each chamber trails its event and uses the following-gap solution.
- **ANTICIPATION** — backward FDN recursion; each precursor gathers into its event and uses a separate preceding-gap solution.
- **SYMMETRIC** — both recursions, equal-power blended by Anticipation ↔ Wake balance. This is the default stance: a zero-phase room in time. FIT/DUCK apply their policy independently to both horizons; OFF leaves both fields unguarded.

**HOLLOW** remains deferred: wet only where the dry is silent, making the negative space the figure.

---

## controls

- **Spill** (dB relative to the event, −∞ … 0) — allowed tail level at the moment the next onset lands. −∞ = fully caesura'd (tail down to the operational floor by the next event); 0 dB ≈ ordinary reverb behavior. *The threshold-of-when-to-dampen, as one number.* (Candidate control name: **Enjambment** — the line spilling over the break.)
- **Masking credit** (0–100%) — how much a *louder* next event excuses spill. At 100%, a tail under a masking hit runs free; at 0%, gaps are enforced energetically regardless of audibility.
- **Room law** — a **drawn curve** gap → RT60 (inscription, not a knob — the TaboTa argument, fourth appearance), clamped to [RT-min, RT-max]. Identity line = FIT's natural solution; bending it is where the tool becomes expressive (short gaps get *longer* rooms = deliberate smear; long gaps get dry = starkness).
- **Per-band sensing** (toggle) — gap map computed per band; the highs' budget separate from the lows'.
- Base-room voicing: **pre-delay, damping/tone, wet/dry** — the ordinary reverb face, unchanged.
- **Anticipation ↔ Wake** — equal-power balance between backward and forward fields when Time Arrow is SYMMETRIC.
- **Wet layer** *(planned 2026-07-17, symmetry contract)* — mix-law switch: dry at unity, both directional wets at full (send-style layering) in place of the equal-power insert blend. The hotter sum is already covered offline by the whole-file peak guard. Open: whether Wet layer forces both directions to unity (overriding Balance) or Balance still weights the pair — leaning override.

---

## construction

**MVP** — three fixed deterministic FDN rooms + event-side routing derived from the gap map. Ships OFF, DUCK, and a coarse FIT. OFF bypasses the map in DSP and sends the complete source through the RT-max room without boundary checks or gain rides. FIT routes events into bracketing rooms before diffusion; DUCK keeps the long room and applies zero-phase wet rides. Per-band sensing remains deferred.

**Full** — **per-event tail rendering**: segment the dry into events, convolve *each event* with its own kernel (RT60 solved per event), sum the tails. Offline makes per-event convolution affordable; this is the acausal luxury no latency budget can buy, and the version where FIT is exact rather than approximated.

Both: envelope smoothing is bidirectional/zero-phase throughout — no attack/release asymmetry anywhere in the control path.

### MVP — shipped 2026-07-12; bidirectional engine shipped 2026-07-17; OFF shipped 2026-07-24

Built at `metachamber/index.html` in the suite's drop file → analyze → preview/A-B → **Bounce WAV** pattern. It imports only the local shared gap-map analyzer. The sample-domain FDN render is deterministic within the JS engine; preview and 32-bit float WAV use the same final PCM. Repeatable tests live in `test-metachamber.mjs` and `test-browser.mjs`.

**Pipeline:**

1. **Decode** → channel-energy analysis (so anti-phase stereo cannot cancel itself out of the detector) + mono waveform display; mono/stereo rendering preserves source channels.
2. **Caesura / gap map** (canonical shared mechanic; Pythia is the second active consumer):
   - ~46 ms Hann/FFT window, ~10 ms hop, channel-energy RMS + 80 Hz–12 kHz spectral flux, centered local threshold, 75–80 ms onset/release holds.
   - Operational floor = clamped quiet-percentile statistic; releases are measured before silence gaps, rather than treating onset-to-onset time as free tail space.
   - Shared v1 JSON uses sample indices and explicit units: `{sampleRate, durationSamples, floorDbfs, analysis, events[]}` with `onsetSample`, `releaseSample`, `eventRmsPeakDbfs`, `nextOnsetSample`, `nextOnsetRmsDbfs`, `interOnsetSamples`, `silenceGapSamples`, `confidence`.
3. **Directional budgets**: every event gets an after-gap RT and a before-gap RT. Spill and masking credit are solved against the event on the opposite side of each boundary. Available decay time is `silenceGap − preDelay`; solve `RT60 = 60 · availableGap / requiredDropDb`, clamp to [RT-min, RT-max], and mark each horizon independently when RT-min is infeasible.
4. **Render — bidirectional three-room FDN**: deterministic, mutually coherent rooms at RT-min / geometric-mid / RT-max. WAKE iterates the feedback state forward; ANTICIPATION iterates the same recursion backward over genuine output head room. SYMMETRIC runs both and equal-power blends them. No file reversal or pasted pre-tail is involved.
5. **Policy**: FIT and DUCK apply direction-specific post guards; DUCK additionally applies its zero-phase wet ride. Wake is measured immediately before the next onset; anticipation immediately after the preceding release. SYMMETRIC verifies both sets of boundaries. OFF bypasses this stage entirely.
6. **Mix + export**: pre-delay becomes a dry/wet separation in the selected direction; head-extended dry is sample-aligned for A/B; equal-power wet/dry, whole-file peak guard, exact-buffer preview, 32-bit float WAV out.

**UI:** waveform with the directional gap map drawn on it — wake wedges decay right, precursor wedges gather from the left, and symmetric shows both. Controls: Caesura policy (OFF/FIT/DUCK), Time Arrow (WAKE/ANTICIPATION/SYMMETRIC), Anticipation ↔ Wake balance, Spill, Masking credit, RT-min/max, pre-delay, damping, wet/dry. OFF disables its irrelevant gap-policy controls and draws the fixed room at RT-max.

**Verified:** synthetic irregular impulse train → five onsets within one analysis hop; silence yields no fabricated event; FIT and DUCK pass their wet-only boundaries; OFF is sample-identical with or without gap-map events, applies zero guards/checks, and in SYMMETRIC produces nonzero head and tail energy. ANTICIPATION produces nonzero head energy and passes preceding-gap budgets; SYMMETRIC FIT verifies both boundaries; dry remains sample-aligned after head extension. Anti-phase stereo, finite samples, room routing, anchor decay, mono/stereo, render lengths, worker transfer, deterministic PCM, and WAV payload contracts hold. `node metachamber/test-metachamber.mjs` passes. `test-browser.mjs` covers the full decode → Blob-worker analysis → symmetric render → UI lifecycle.

**Deferred past MVP:** HOLLOW, drawn room law, per-band gap sensing, per-event exact kernels (true FIT), synthetic/self/donor IR sources, and strict cross-browser byte identity.

---

## absorbs (from the further-members shelf)

- **Pre-verb** → ANTICIPATION time arrow; now a backward-recursive room with preceding-gap budget, not a mirrored wet segment.
- **Future-sidechain** (applied to own wet) → DUCK stance.
- **Self-convolution reverb** → candidate *kernel source* option (IR = the file's own autocorrelation); deferred, listed below.

---

## deferred / open questions

- **Control/source dual input** — the suite interface, absent here. Two candidate roles, weighted 2026-07-17: the favored one is the control's *envelope* as a zero-phase wet ride — the sidechained-reverb move made precognitive; the reverb shaped by another file's contour ("reverb, but taken from another file"), equally applicable to Pythia. The control donating its *gap map* (A's tails budgeted by B's silences — the cross-signal Future-sidechain) is judged **niche**: kept on the shelf, not queued. Deliberately outside the symmetry contract — it is not quick-and-dirty.
- **Density axis inside Metachamber?** (slapback → multitap → cloud → diffuse as one slider.) Parked: Pythia owns discrete echoes; revisit only if gap-aware delay outgrows its Caesura feature. The suite boundary is engine kind, not gap-awareness.
- **Kernel sources** — beyond the synthetic room: the file's own autocorrelation (absorbing self-convolution), or a second file's IR on the control/source input (the room as donor).
- **Video cousin** — trail/wake length budgeted by gap-to-next-motion; Prolepsis kinship. Parked.
- **Interaction with the rack** — Metachamber after Sounder in a chain gets a gap map measured on *processed* dynamics; order matters and the offline rack makes both orders auditioning-cheap.
- **Color modes** — one orthogonal color axis (Neutral / Bright / Dark, à la VintageVerb's eras and FutureVerb's four colors), applied at IR-generation time. Cheap on the seeded-IR engine; not a full EQ. The Valhalla lesson: one color knob's worth of modes, never a tone section.
- **BPM pre-delay sync** — the one sync import that survives scrutiny (2026-07-17): pre-delay as a note division, one selector. RT60-to-grid would regress FIT — tails already land on the actual next onset, which a grid only approximates.
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

*spine: a room that remembers the wake and foresees the arrival.*
