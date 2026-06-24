# SOUNDER — multiband build / roadmap

*the normalizer that grew a transfer curve — the practical member of HINDCASTS*

---

## where this sits

The current single-band tool stays, retitled **`sounder (single band)`** — it processes a whole file in milliseconds, it's clean, and people may want exactly that. The new **multiband** build becomes the canonical `sounder`. Crucially, multiband is a *superset*: one band spanning the full range is the single-band tool, bit-for-bit. **If the user makes no cuts, they're using single-band Sounder.** The multiband UI only earns its complexity the moment you split.

This is the HINDCASTS member that speaks to the practical audience — producers, mixers, masters making things real people will hear. The thesis rides underneath; the surface is a tool that fixes the thing you fought with last Tuesday.

> **Status: multiband shipped and verified.** Phases 0–2 are done (state refactor, dB grid, linear-phase splitter, band manager + crossover field, per-band τ/curve/floor — the regime field is live). Perfect reconstruction confirmed to Float32 precision; one full-range band is the single-band tool by construction. The Worker offload is *paused* (bundled with the STFT-cache). The live edge of the work is now the **cell / host refactor + rack** — see the two new sections below.

---

## the ancestry reframe (the pitch spine)

**The proper ancestor of Sounder is the normalizer, not the compressor.** The compressor framing was always a costume.

Two tools converge on "control dynamics" from opposite bloodlines:

- The **compressor** descends from the hardware envelope follower — causal, reactive, *late*. It waits for evidence a peak arrived, then responds, always behind.
- **Sounder** descends from the **normalizer** — acausal, global, total. Normalize reads the entire wave, finds one statistic (the peak, or the RMS), and applies one gain. It already does the un-live move; it just only knows how to multiply by a constant.

Sounder is convergent evolution from the normalizer's side: take the tool that already sees every sample and **give it a curve instead of a single number.** It backs into the compressor's territory from the acausal direction — and because nothing in its lineage was ever late, it can do what the causal family structurally can't.

> **Why multi-pass compression leaks spikes.** Each causal pass is a running estimate taking another guess. Stack ten and a few peaks still slip through every time, because no pass ever sees the whole distribution. That wasn't compressing wrong — it was using a tool whose ancestry forbids the one thing needed: knowing where every spike is *before* acting. The normalizer's ancestry does know (it found the global max in one read); Sounder is "what if the thing that already sees every peak could draw a shape." One pass kills the spikes that used to take five.

`normalize` is the **degenerate case** of Sounder: a one-point curve with the window cranked to infinity — literally the τ→∞ regime already built. The audience already trusts the acausal move; they call it Normalize. Sounder is what Normalize becomes when you let it read the whole occupancy and draw the shape yourself.

---

## architecture (locked)

**Band split: linear-phase FFT.** Chosen over IIR Linkwitz-Riley. The reason is more than transparency: a linear-phase split *is* a zero-phase operation — one of the five superpowers (bidirectionality) — so the whole chain refuses causality, splitter included. An IIR crossover would smuggle causal phase shift back in at the first stage, self-undermining given the thesis.

- Use the FFT **only to produce N time-domain band signals.** Then run the existing, proven RMS-curve engine unchanged on each band, and sum. Keep the DSP core we trust; add only a clean splitter and a summer.
- Use **soft (raised-cosine) crossover regions** between adjacent band masks. Brick-wall masks pre-ring (pre-echo). *Note the tension:* pre-ring is itself an acausal artifact — for the suite-thesis you might let it show; for a mastering tool you want it gone. Decide per-use which side of that line you're on.

**Signal flow:** `source → linear-phase splitter (global) → N band engines (local) → sum → master + safety wall (global) → out`.

**Global vs local:**

| Local (per-band) | Global |
|---|---|
| transfer curve | band edges + FFT window |
| RMS window τ | master makeup |
| floor *(global default, per-band override)* | safety wall / ceiling |
| makeup | master dry/wet |
| dry/wet *(per-band parallel — quietly killer)* | source file |
| gain smooth | |
| enable / solo / bypass | |

Per-band τ and floor being local means **the depth chart, histogram, and curve are all per-band.** Selecting a band swaps the right-hand chart to that band's occupancy and curve.

**The regime field across frequency.** Today the RMS window is one regime for the whole signal. Per-band τ makes the regime slider a regime *field*: waveshape the highs (sub-ms, mangle the transient grit), compress the body (~40ms), normalize the sub (~300ms) — selective dynamics, choosing which spectral region gets waveshaped and which gets leveled, independently. The multiband split is the natural carrier for "different timescales of acausality applied at once."

**State as single source of truth.** `{ version, global:{…}, bands:[ {edges, τ, floor, curve, makeup, mix, smooth, enabled}, … ] }`. Every panel reads from it; JSON export/import is just serialize/deserialize; a preset is a saved instance of it. Versioned from day one. **Audio stays out of the JSON** — save processing state only, so a "vocal multiband" preset travels across files.

**Performance.** N bands × whole-file = N× the work. Once N-band is real, move processing to a **Web Worker** (or `OfflineAudioContext` for the filtering) so the UI doesn't freeze on long files. This is the architectural cost that the test-strip workflow pays back.

---

## the cell / host refactor — what sounder *is* (new spine)

*Decided after multiband shipped. This reframes the tool: sounder is a cell; chaining is a host.*

**The atom is freq-dist × dB-dist-per-region.** A sounder instance is a *frequency distribution* (the crossover field, partitioning the spectrum into regions) × *a dB distribution per region* (each region's depth chart + curve + τ). The crossover field doesn't carry one histogram — it selects *which* dB-distribution you're editing. That's the selected-band model already built; naming it this way is what tells us what belongs together.

**τ is the histogram's measurement window — they're one instrument.** τ isn't a loose "localizable" knob; it determines what the depth chart *shows* (per-sample shaping → windowed RMS occupancy → global normalization). The knob and the histogram are the **same measurement viewed two ways** — the time-scale imposed vs. the distribution produced. So τ (with floor, smooth, band makeup/mix) moves **into the depth-chart panel** as the selected region's controls. The reason is structural, not just space: they're faces of one object.

**The intake panel dissolves.** Once the atom is clear, every widget lands somewhere with a reason:
- file drop → **whole screen** (the file is the substrate, not a widget in a corner)
- upload + state save/load → a **thin toolbar**
- filename / stats → the **waveform header** (the waveform *is* the file)
- τ + floor + curve + presets → **into the depth-chart panel**, as the selected region's controls

That leaves a clean two-part split:
- a **cell** — freq-dist + per-region dB-dist + its controls + the source/final waveform. Self-contained, clean in/out.
- a **host** — file, transport, master, safety, and (once chained) the rack.

Keep *cell* and *host* apart. The cell is what sounder *is*; the host is where chaining lives. That separation is what lets the host generalize later without touching the cell.

---

## the rack — sounder as a real mastering tool

*The ambitious move, and tractable* because *it's offline. Decided: model it as a DAG from the start; ship the linear view first; the mixer/merge node is in (optional).*

**Per-app rack, not a suite-general host.** Each HINDCAST app gets its own isolated rack of its own cell-type. Not a shared host — a shared *pattern*, reinstantiated per app. (Weaker coupling, safer.)

**Model the DAG now; default to the chain.** A linear chain and a node graph are the same object at two fidelities — a chain is a path, a path is a DAG. So model edges explicitly from day one: the linear UI is just the default rendering (append auto-wires i→i+1), and the collapsible **flowchart** (TouchDesigner / Reaktor register) is the *unlocked rendering of the same structure.* "Most people won't use the graph" becomes "most people see the path-view of the graph." No either/or.

**The selection grammar stays consistent all the way down.** Pick a cell → see its crossover field; pick a region → see its depth chart; the curve lives inside that. A collapsed node is a process box; selected, it's the full editor we already have — one focused at a time, Reaktor-style: the graph is the map, you dive into one room.

**The offline dividend — intermediates are free.** A DAG of offline cells topologically sorts and renders each node once, caching its output buffer. So *"show any intermediate step"* is nearly free — every stage's output already exists in memory; scrub stage 2 instantly. A *live* graph would need a pull-based engine, taps, re-renders, latency compensation across branches. The whole-file commitment is exactly what lets the rack be ambitious. **Acausality pays out again, this time at the routing layer.**

**The capability cliff — wires are cheap, junctions are not.**
- **Per-cell wet/dry** gives parallel *around* a cell for free: the dry path rejoins *inside* the cell, no summing — covers most parallel-compression-style moves.
- **True branch-and-merge** (two chains recombining) needs an explicit **sum / mixer node** — and the moment you have summing you have gain-staging and bus levels.

**Decision: the mixer node is in (optional).** For a tool that pays this much attention to dynamics, recombining parallel banks earns its keep — multiband itself is half a mixer already. So v1's rack carries a merge node, but it's **opt-in**: most users stay on the reorderable-linear + per-cell-wet/dry path (zero summing), and reach for the mixer node only when they want recombining banks.

**Cross-app racking — ordered by the types, not by taste.**
- **Homogeneous (audio→audio): cheap.** Pythia → Sounder is the natural first cross — same buffer type, the engine just has to allow a foreign cell in the chain. (Complex delay-into-distribution effects; mixdown-then-reprocess in one *editable* chain instead of re-uploading.)
- **Heterogeneous (audio↔video): hard, parked.** Video buffers, typed ports, no obvious meaning for an audio→video edge. A different project. In-app racking first; Pythia+Sounder as the first cross; Prolepsis-cross parked.

**Layout note (unresolved trade).** A chain strip reading left→right as signal flow collides with the two horizontal axes already inside a cell (time on the waveform, frequency on the crossover field). A **vertical** insert-stack (DAW-style) uses a different axis and reads as "stages," at the cost of competing with the cell editor's width. Leaning vertical — but it's a genuine trade. Sit with it.

---

## the three spans (do not conflate)

A selection can mean three different things. They are separate *objects* in the UI, because confusing them is where it gets broken.

1. **Analysis span** — what the histogram is built from. **Default: whole file.** This is the un-live commitment; you don't get to un-see the rest of the score.
2. **Exclusion mask** — regions *removed* from analysis (the clapper, chair scrape, count-in). A property of the histogram, drawn deliberately.
3. **Render strip (test strips)** — a short region you audition *now* instead of waiting on the full pass. A property of playback/render, not of what the tool knows.

The depth chart shows the **global** distribution at all times (minus exclusions). The render strip scopes only where you listen. The strip is then honest: exactly what the final full pass sounds like there, computed for ten seconds instead of three minutes.

**Wrinkles to wire from the start:**

- **Exclusion is an analysis mask, not a "don't process" flag.** Excluded audio is still *rendered* with whatever gain its neighbors get, because the curve is a function of level, not of time. (Exactly right for the clapper — it's getting cut anyway.) Label this in the UI so nobody expects exclude = bypass. It means *don't let this teach the curve*, not *don't apply the curve here*.
- **Exclusion shifts every percentile.** Pull out a loud outlier and the whole distribution re-floors, so the same drawn curve lands differently. That's the point (you wanted the dialogue's real range) — but exclusion and curve-drawing are coupled, and **the chart must redraw live as you mask.**
- **Strips need margin.** Bidirectional smoothing reaches both directions and overlap-add needs neighbors, so a strip can't slice samples `[a,b]` in isolation or you'll hear edge artifacts that won't be in the master. Render `[a − margin, b + margin]` where the margin covers the smoothing kernel plus FFT window, then play `[a,b]`. Correct edges, tiny cost.

**Scrappy-robustness as a design value.** "Tablet in the desert, slap the interview on, bam" means defaults must be good *before anyone touches anything*. Whole-file analysis plus a sane default curve should already produce a usable master on a raw field recording with a clapper in it — the person who needs it most won't open the exclusion gutter. Exclusion is for when you care; the global default is for when you can't. Inherited from the normalizer's contract: it does something reasonable on contact, zero configuration.

---

## the depth chart: dB grid on both axes

Put **real dB on both axes** with a proper grid. This is not only a readability fix — it is the thing that *builds* the curve-vocabulary audio has never had.

The Photoshop curve has a legible space (0–255, you know where shadows and highlights are). Sounder's chart is currently normalized 0–1, so a point's height is abstract. With dB on both axes the **diagonal becomes readable**: a point above the identity line is gain *up* at that level, below is gain *down*, and the vertical distance from the diagonal *is* the gain change in dB. The curve narrates itself — "pulling everything around −18 up by 4 dB" instead of "dragged a dot to a vibe." That legibility is what lets a shared language of curves form, and what lets a preset library mean anything.

**The Photoshop analogy inverts in one place — flag it loudly.** In Photoshop, X is a fixed input *value* and there is no time; every pixel at 128 gets the same treatment. In Sounder, **X is windowed *level*, and the same curve means a different operation depending on τ.** A steep curve at τ = 1 ms waveshapes the instantaneous amplitude (distortion, harmonics). The identical curve at τ = 300 ms levels the whole-piece average (mastering glue). Same shape, opposite operation, because the axis underneath is measuring a different thing. **A preset is therefore a `(curve, τ)` pair at minimum** — the τ does as much work as the shape. Photoshop muscle memory transfers for *reading height as gain*; it misleads the moment you forget the horizontal axis is a timescale, not a value.

---

## presets: stability vs taste

Two different axes. **Ship provably stable presets; let good accrete through use.** Don't try to ship good presets — that only comes from living with the tool.

**Stability is mechanical and checkable; taste is not.** Build a preset *validator* and ship anything that passes:

1. **Ceiling.** Output can't exceed −0.3 (or chosen ceiling). This is *free* — the monitor-side hard-limit WaveShaper already enforces it. Stability is not a property of the curve; the ceiling is. The curve's job is taste, the wall's job is safety. Free the curve from having to be safe and "what's a good curve" stops being scary — the worst a bad curve does is sound wrong, not damage anything.
2. **Monotonic / no-collapse slope.** The ceiling can't catch the *other* instability — extreme lows, the curve diving toward the floor where you didn't mean it. So require the curve's slope to stay non-negative and not flatten past a minimum, so it never drops a level region into the floor unless you drew it there.

A preset that passes both is stable *by construction*. The author (even future-you) gets a green light or a flag.

**Starter set — anchor to the regimes already built**, each ceiling-protected and monotonic-checked, each a legible point on the τ sweep so the set doubles as a tutorial:

- **normalize** — one-point curve, τ → ∞ (the ancestor, the thing they already trust)
- **gentle glue** — shallow upward bow, τ ≈ 200 ms
- **tame the spikes** — soft downward bend in the top third, τ ≈ 40 ms (kills the leaky peaks)
- **lift the floor** — raise the bottom without touching the top
- *(more accrete from use)*

People learn what curves do by reading the named ones against the dB grid, then start drawing their own.

---

## framing for the practical audience (video notes)

**Lead with the wound, not the thesis.** Invert the order of the hindcasts doc. The producer video should go: (1) here's you fighting a live comp to open up a master, still getting spikes in places, still getting dips in places; (2) the toolbar inconsistency; (3) Sounder as the obvious fix; (4) *only then*, as dessert, the fifty-year accident about causality that explains why nobody built it. The academic version stays for Concordia; this one leads with the ache.

**The toolbar inconsistency (the strongest practical version of the thesis).** You're already standing in an acausal environment. Audition / Audacity read the entire file to normalize to −0.3 without anyone blinking — and right next to that button sits a compressor still cosplaying as an 1176 (threshold, attack, release), though there is no live signal anywhere in the room. Same app, same offline workspace, two operations: one reads the whole wave and is a checkbox, the other pretends it's reacting to a performance that already finished. The producer doesn't need film grading to feel it; it's on their own toolbar, and they used both this week.

**Stability ≠ loudness war.** Get ahead of the reflex. Not maximizing loudness (that's the crushing, the life squeezed out) — after *stability*: lift the floor, tame the specific spikes you didn't want, keep the experience coherent on earbuds on a train. Whole-distribution view is exactly what earns this: place the curve to catch the three peaks that poke out and the two dips that vanish, without slamming everything into a wall. **Surgical, not flattening** — the distinction a good mastering engineer would make. (Real context: increasingly everyone listens on headphones / earbuds, and wants reception stability; that's a population-level reality, not a fashion.)

**Sounder vs the live comp = different verbs.** Not a replacement. A live compressor is an instrument you *play* — you ride it in the moment, and the causal grab is part of the feel. Sounder is a *darkroom* — you develop the whole take with the whole distribution in front of you. You'd still keep a live comp for speed, support, realtime feel, the way you keep tape for its lag-sound.

**Transients, stated honestly.** Live comps don't preserve transients because they're *good* at them — they preserve them because they're too *late* to catch them (the attack lag lets the leading edge through, then clamps the body), and that lateness is the characteristic *sound* of a compressor. Sounder *decouples* transient handling from causal lag and turns it into a dial: long window leaves the hit untouched (and preserves it *more* faithfully than a slow-attack live comp, which still pumps the body around it); short window catches it precisely; and because smoothing is bidirectional, Sounder can **duck before the peak** — pre-ducking, the precognition power, impossible live without lookahead. What you give up is the causal grab — symmetric zero-phase smoothing sounds cleaner, more surgical, less "like a compressor." Not a deficit; a different aesthetic.

**The compressed pitch:** every other compressor is late and reacting because of causality; we've had every ingredient to build the un-late one for years and nobody consolidated it; Sounder is that — and multiband makes it a different timescale of acausality per frequency region at once.

---

## roadmap (updated — multiband shipped)

### ✅ Phase 0 — foundations *(done, verified)*
- [x] Single state object `{version, global, bands[]}` — verified a **pure re-sourcing**: prefix-reversed diff against the original was byte-identical except the declaration line. DSP unchanged.
- [x] JSON save / load on that state (the preset substrate); version-guarded, round-trip tested.
- [x] **dB grid on both axes** of the depth chart.

### ✅ Phase 1 — multiband core *(done, verified — one item paused)*
- [x] Linear-phase STFT splitter + summer, soft (complementary raised-cosine) crossovers. **Perfect reconstruction verified**: masks form an exact partition of unity; bands sum to the input to ~1e-7 (Float32-exact).
- [x] **1 band == single-band Sounder** — confirmed: identity through the *full process path* (identity curve → wet == clean split → sum == original), same LUT round-trip as Phase 0. No-crossover fast path skips the FFT entirely.
- [x] Band-manager UI — band list, per-band color, solo / mute, selected band highlighted on spectrum + chart.
- [x] Crossover field — log-frequency axis, draggable crossover handles, split / merge.
- [x] Per-band params wired to the selected band (the **`band`-as-selected-reference** trick: every existing `band.*` site retargets on selection, so the whole editor follows the selection for free).
- [ ] ⏸ **Web Worker / `OfflineAudioContext` offload** — *paused, bundled with the STFT-cache.* Synchronous path works (yields between bands, per-band progress). Worker + caching the forward STFT once (reuse across bands → halves the FFT count) are the right pair; build them together when un-paused.

### ✅ Phase 2 — the regime field *(done — folded into multiband)*
- [x] Per-band τ, floor, curve. The regime slider is now a regime **field across frequency**: selecting a band swaps the depth chart, histogram, curve, and τ to that band. Waveshape the highs / compress the body / normalize the sub, independently — live.

---

### → the live edge: cell / host refactor + rack
See the two new sections above. Rough order:
- [ ] **Layout refactor** — dissolve the intake panel; whole-screen file drop; stats into the waveform header; τ + floor + curve + presets into the depth-chart panel. (Makes room *and* encodes the cell/host split.)
- [ ] **Cell ↔ host factoring** — sounder becomes a self-contained cell with clean in/out; the host owns file / transport / master / safety.
- [ ] **Rack v1** — DAG model, linear default rendering, collapsible flowchart, per-cell wet/dry, offline intermediate-caching ("show any step"), **optional mixer/merge node.**

### still ahead (intent unchanged)

#### Phase 3 — workflow
- [ ] **Test strips** — render-span scoping with margin (`[a−margin, b+margin]` render, `[a,b]` play). Histogram stays global.
- [ ] **Analysis exclusion mask** — exclude regions from the histogram (the clapper case); live chart redraw; clear "analysis-only, still rendered" labeling.

#### Phase 4 — presets
- [ ] Preset **validator** (ceiling + monotonic / no-collapse).
- [ ] Starter set anchored to regimes (normalize / gentle glue / tame the spikes / lift the floor).
- [ ] Preset dropdown over the JSON state. *(A preset is now per-band; a full sounder state is a freq-partition × per-region `(curve, τ)` set.)*

#### Phase 5 — polish + dessert
- [ ] Generalize fullscreen to every viewer (spectrum, curve chart, combined waveforms + transport).
- [ ] **Dynamics matching** — per-band histogram specification. Load a reference, compute per-band occupancy, solve the monotone CDF-match (`f = CDF_target⁻¹ ∘ CDF_input`) into an editable starting curve per band. Matches the *distribution of levels*, not timing/groove — a smart starting point. Slots into Pythia's control/source dual input.

---

## parked (logged, deliberately not now)

**Waveform zoom / measure / RMS-window grid.** τ is currently a number in ms with no referent on the signal. Give the waveform **zoom + length-measure**, and at small-enough zoom an **RMS-window grid** so τ shows as *time cells* you can match to transient/musical structure by eye. Payoff: τ gets *two* visual anchors — the **histogram** (the distribution it produces) and the **waveform grid** (the time-scale it imposes). τ lives exactly between the time domain and the dB distribution; the UI would finally show both faces. Measure a length → *derive* τ from an event (snare decay → τ).

**Analysis-window offset — the acausal nerve.** A symmetric RMS window centers on the present. A window offset *forward* is a **look-ahead / precognitive measurement** — literally power #1 of the five. An asymmetric or forward-offset analysis window is the most on-thesis knob in the whole tool. *Not just a detail* — deserves its own pass. Parked, but flagged.

**STFT-cache (with the Worker).** Cache the forward STFT of the source once; reuse across bands at process time. Halves the FFT count; pairs with the Worker offload. Paused alongside Phase 1's last item.

---

---

*spine: the normalizer, let off its leash — an effect that has read the whole file before it draws a single point.*
