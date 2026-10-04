# SOUNDER — multiband build / roadmap

*the normalizer that grew a transfer curve — the practical member of HINDCASTS*

---

## where this sits

The current single-band tool stays, retitled **`sounder (single band)`** — it processes a whole file in milliseconds, it's clean, and people may want exactly that. The new **multiband** build becomes the canonical `sounder`. Crucially, multiband is a *superset*: one band spanning the full range is the single-band tool, bit-for-bit. **If the user makes no cuts, they're using single-band Sounder.** The multiband UI only earns its complexity the moment you split.

This is the HINDCASTS member that speaks to the practical audience — producers, mixers, masters making things real people will hear. The thesis rides underneath; the surface is a tool that fixes the thing you fought with last Tuesday.

> **Status: multiband and the offline rack core are built.** `engine.js` supplies the browser and command-line runner with the same DSP; `rack.js` supplies versioned routing, Sounder cells, mixers, and per-render intermediate buffers. See [WORKFLOWS.md](WORKFLOWS.md) for commands and the recipe contract. The browser can save its cell as a rack recipe; the interactive rack editor and host layout remain unbuilt. Worker offload and STFT reuse remain paused.

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

**The atom is also the suite's EQ** *(agreed 2026-08-07)*. Take the crossover field to fine resolution and freq-dist × dB-dist-per-region is an equalizer — one whose per-band control is an occupancy distribution rather than a single gain, so "lift the 10th percentile of 3 kHz, leave its 90th alone" is a single gesture and equalization and multiband dynamics stop being two inserts. Hindcasts therefore ships **no separate EQ member**: an offline magnitude EQ buys almost nothing over the live one, and what acausality does buy in filtering is the magnitude/phase split, which belongs to the penciled Dispersion entry in `hindcasts.md`. Practical consequence for this file: band count and crossover-handle density are a *load-bearing* axis, not a convenience — the EQ claim only holds if the field can get fine.

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

**Start with Sounder, then add audio effect adapters.** The 2026-09-30 direction replaces isolated per-app racks with a reusable recipe and offline runner. Sounder is the first supported effect. Keep each effect's state and DSP separate from routing; adding Pythia requires an explicit sample-origin and head/tail contract, because the first rack preserves the input timeline. Audio/video routing remains parked.

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
- [x] **DSP extraction and offline rack core** — shared browser/Node processing, validated recipes, explicit DAG inputs, cell wet/dry and bypass, mixers, intermediate buffers, WAV runner, and JSON reports.
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


## Log

**2026-09-30 — Codex — Extracted Sounder's DSP and built the offline rack foundation.** `engine.js` runs in the existing browser editor and in Node. The browser keeps its between-band yields and adds **Save rack**. `rack.js` validates Sounder version 2 states and explicit DAG routing, renders output ancestors once, retains raw intermediates, supports cell mix/bypass and gain-controlled mixers, and applies one final sample ceiling. `run-rack.cjs` reads PCM/float WAV, writes float32 WAV, refuses accidental overwrites, and reports stage peak/RMS and limiting. Commands, API, format limits, and agent workflow are in [WORKFLOWS.md](WORKFLOWS.md); the two-stage example is identity processing, not a taste preset.

Checks: `test-rack.cjs` passes short/stereo/multiband identity, serial and parallel processing, mix/bypass, ceiling, determinism, invalid routing/state, WAV round trips, the real CLI output/report, and overwrite guards. `test-browser.cjs` loads stereo audio and three bands through the page's file controls, presses Process, decodes its WAV download, and validates Save rack. With `BASELINE_REF=38fc9be`, the browser export is byte-identical to the pre-extraction page for a three-band curve with shaping/compression/leveling windows. No listening check was made.

Known prerequisite: the existing linked detector averages channels before squaring. An opposite-polarity stereo sine measured normalized level 0 and received zero curve-driven gain change, despite nonzero energy in each channel. This inherited behavior is preserved for extraction parity; choose and test a channel-energy detector before treating stereo rack output as a mastering result. The browser's ceiling still affects monitoring only, while its PCM16 export clamps at full scale; the rack's final ceiling affects exported samples. Neither is a true-peak limiter.

Next: build a vertical browser insert stack with cell selection, add/duplicate/remove/reorder, recipe load/save, and intermediate audition. A selected cell's histogram must describe its actual upstream signal. Resolve the stereo detector issue before relying on the rack for wide stereo mastering. The interactive rack item above remains open for this UI work; routing and mixers are already implemented in the core.

Undone: host layout, Worker/STFT reuse, edit-to-edit cache invalidation, memory limits for long branched graphs, other effect adapters, and sample-origin/tail routing. Layout was postponed so a runnable recipe/CLI could establish the processing contract first. Work stayed sequential in the existing checkout; no worktree was created. The pre-existing Pythia edit was left untouched.

## 2026-09-30 — Codex — Channel-power stereo detector

New version 3 states use mean channel power for RMS analysis. Each channel is band-filtered before its energy is measured; all channels receive the same RMS gain. Identical and opposite-polarity stereo now measure equally. One active stereo channel measures 3.01 dB below two equally active channels. Mono processing and the independent shaping path below 2 ms are unchanged.

Version 1/2 browser states and version 2 rack states retain an explicit `mono` detector, preserving their sound. The Level detector selector switches to `power`; state and rack saves record the choice. The earlier stereo prerequisite is resolved.

Checks: `test-stereo.cjs` passes energy, polarity, linked-gain, mono/legacy parity, multiband, short/silent-buffer, and migration cases. `test-rack.cjs` passes. `test-browser.cjs` with `BASELINE_REF=38fc9be` passes actual page processing/export, polarity-invariant histograms and output, selector invalidation, version 3 rack saving, and byte-identical migrated version 2 export against the historical page. No listening check was made.

Next: the vertical browser insert stack, including upstream histograms and intermediate audition. Other-effect adapters, Worker processing, and reusable STFT caches remain undone.

## 2026-10-01 — Codex — Browser insert rack

[rack.html](rack.html) hosts serial Sounder cells with selection, add/duplicate/remove/reorder, bypass, and cell mix. The existing editor receives each selected cell’s upstream PCM through a source-checked message bridge; changes return version 3 state to the host. Bypass and mix changes refresh downstream analysis. The host rejects unsupported graph shapes without replacing the recipe.

Processing uses the rack core. The Stage selector auditions or exports the recording, a raw cell stage, or the final rack output. Export is float32 WAV; the rack ceiling affects only final output. Edits clear playback and disable stale exports. Rack load/save preserves all cells and master controls. The original single-cell editor remains available, with an Open rack link.

Checks: `test-rack-browser.cjs` exercises the real page’s cell edits/reordering, upstream histogram response, recipe round trip/rejection, sample ceiling, output and intermediate float WAV parity with `Rack.render`, media duration/playback advancement, and edit invalidation. Desktop and 390 px mobile screenshots were inspected; the selected-cell panel resizes to its controls. The single-cell browser, stereo, and core rack checks also pass. No listening assessment was made.

Next: Worker rendering with progress and cancellation. Whole-file main-thread processing can pause the interface; upstream analysis also rerenders its prefix. Branched graph editing, other-effect adapters, cache reuse, bounded memory, and sample-origin/tail routing remain undone. Branch editing was deferred so this page can use an inspectable insert-chain UI without flattening a saved DAG. Work stayed in the existing checkout; the pre-existing Pythia edit is untouched.

## 2026-10-01 — Codex — Worker rendering and analysis

The rack runs rendering and upstream/band analysis in dedicated Workers. `rack.js` exposes generator steps shared with its synchronous renderer, so the CLI and Worker follow the same DSP and master path. Progress reports validation, cells, and output gain/ceiling. Cancel terminates the render Worker immediately; superseded analysis jobs are terminated as well. Input PCM is copied into the Worker, and unique output buffers are transferred back, including aliased bypass stages. Generation/revision checks reject stale histograms.

The embedded editor receives analysis results instead of upstream PCM and no longer performs STFT/RMS preparation on the main thread. Edits invalidate stage playback and export. A cancelled or failed render cannot publish an output; the recipe and original recording remain available for restart. HTTP serving is required; there is no synchronous fallback.

Checks: `test-rack-browser.cjs` compares Worker final and intermediate float WAV samples with `Rack.render`, checks upstream histogram changes, progress phases, invalid-job errors, shared stage aliases and retained input buffers, and runs a longer multiband chain while main-thread timers advance. The Cancel button stops that job; saved recipe state survives, and a subsequent short render matches the core again. Existing recipe, playback, invalidation, and mobile-width checks pass. `test-rack.cjs`, `test-stereo.cjs`, and the single-cell browser parity check pass. No listening assessment was made.

[Effect adapters](../RACK-ADAPTERS.md) records the reusable host/job structure and the remaining Sounder dispatch branches. Next: asynchronous adapter registry dispatch and Remanence as the first additional audio cell. Other effects, sample-origin/tail routing, branched browser editing, bounded memory, and edit-to-edit cache reuse remain undone. Input copying, decoding, canvas work, and WAV preparation still use the main thread. Work stayed in the existing checkout; the Pythia edit remains untouched.

## 2026-10-01 — Codex — Graphic Sounder rack

Sounder starts in its single-effect editor. Rack view hands off the complete state and decoded recording through same-origin IndexedDB and consumes that draft on entry. The rack toggles between a patch graph and focused effect controls without discarding the graph. SVG nodes support dragging, naming, zoom, port connections, parallel Sounder paths, mixers with per-input gain/disconnection, and an explicit output. Each selected Sounder uses its own full editor and Worker-prepared upstream histogram. Cycles are rejected through the core validator.

Recipes accept optional bounded `layout.positions`; DSP ignores layout. Existing CLI, Worker, and browser consumers use the updated validator. Save/load preserves branches and positions. Removing a Sounder reconnects consumers to its upstream input; removing a mixer reconnects them to the recording. Stage selection lists only rendered output ancestors. No other effect integration was pursued in this sitting: the user redirected work to Sounder’s graph editor.

Checks: the actual browser test connects two Sounder paths into a mixer, compares exported samples with `Rack.render`, rejects a cycle without changing the graph, drags a node and round-trips layout, checks zoom/view switching, and carries settings plus decoded PCM from the single-effect editor into the rack. Existing Worker cancellation/restart, playback, recipe, and mobile-width checks pass. Core/stereo and single-effect browser parity checks pass. Desktop/mobile screenshots were inspected. No listening assessment was made.

Next: graph usability on larger patches, including connection inspection and navigation. Modulation/control-rate patching, feedback DSP, undo/redo, other-effect adapters, and bounded-memory rendering remain undone. This is an offline audio DAG, not a live modular DSP environment. Work stayed in the existing checkout; the unrelated Pythia edit remains untouched.

## 2026-10-01 — Codex — Main-page rack

`index.html` owns the live rack and decoded recording. It starts with a hidden recording → Sounder → output network and shows that Sounder’s controls. Rack view reveals the graph and node list; Effect view hides routing while retaining the selected node, values, audio, and connections. Selecting Recording shows source information; selecting Rack output shows the final gain and ceiling. Selecting a Sounder or mixer shows its own settings.

The original Sounder controls moved to the internal `effect.html` editor. `rack.html` redirects to the main page with the graph open. The IndexedDB handoff was removed because both views use the same live recipe. Save/load preserves all effect values, routing, master controls, names, and layout. A recipe routed directly from the recording to output retains its disconnected effects and routing. Recordings remain separate from recipe JSON.

Checks: `test-rack-browser.cjs` loads the actual main page, confirms routing is initially hidden, edits a cell before revealing the graph, checks the URL and values remain unchanged, round-trips distinct cell settings and branched routing/layout, selects both endpoints, and compares exported PCM with `Rack.render`. It also checks direct recording output imports, adding from the output node, the old URL redirect, Worker cancellation/restart, playback, and mobile width. `test-rack.cjs` and `test-stereo.cjs` pass. `test-browser.cjs` loads the moved editor and confirms stereo processing and byte-identical legacy exports. Desktop/mobile screenshots were inspected. No listening assessment was made.

Next: improve connection inspection and navigation on larger patches. Undo/redo, other-effect adapters, feedback DSP, and bounded-memory rendering remain undone. Work stayed in the existing checkout; the unrelated Pythia edit remains untouched.

## 2026-10-01 — Codex — Per-cell routing dialog

Every Sounder and mixer card has a Routing button. The selected cell’s controls have the same button in Effect view. The modal dialog edits input sources and outgoing destinations without using graph ports. Mixers expose input rows with gain, add, and remove controls. Outgoing destinations support fan-out, replacing a Sounder input, adding a mixer input while preserving an existing gain, and selecting rack output. Disconnecting a Sounder or rack output restores the recording. A mixer must retain at least one input.

Apply validates the complete routing change through the existing core and retains current DSP settings and layout. Cycles or empty mixers report an error inside the dialog without changing the recipe. Cancel or Escape discards the draft. Successful changes invalidate processed audio and use the existing JSON save/load path. `rack-routing.js` holds the form editor; graphical manipulation and `rack-graph.js` were left unchanged at the user’s request.

Checks: `test-rack-browser.cjs` exercises card and focused-view buttons, Sounder input/output changes, cycle rejection, Cancel/Escape, mixer input addition/removal/gain, rejection of disconnecting a mixer’s final input, and preservation of existing mixer gain. Saved values remain intact, and audio exported after form routing matches `Rack.render` sample for sample. Existing graph routing/layout, recipe persistence, Worker cancellation/restart, playback, and mobile-width checks pass. Routing dialog screenshots were inspected at desktop and mobile widths. No listening assessment was made.

Next: check per-cell routing forms on larger Sounder patches. Changes to graphical connection editing are deferred by user request. Undo/redo, other-effect adapters, feedback DSP, and bounded-memory rendering remain undone. Work stayed in the existing checkout; the unrelated Pythia edit remains untouched.

## 2026-10-04 — Codex — UI layout proposal

[UI-PLAN.md](UI-PLAN.md) records a proposed workspace layout, pending design feedback. A persistent cell selector will switch between Sounder and mixer controls with the rack open or closed. Rack disclosure will insert a bounded routing area before the editor. Compact depth and crossover charts will each have an app-level Focus action and Return to overview/Escape exits. Plot clicks will continue to edit the plot; they will not toggle focus.

The preferred selector is a horizontal strip, with a vertical selector as the comparison layout. Implementation will first establish selection/disclosure, then compact chart sizing, then one shared focus mechanism. Graphical manipulation changes remain deferred at the user's request. Presentation state will stay separate from the rack recipe.

Inspection: `index.html` already places the graph before the editor, but `rack.css` adds a 260 px sidebar in rack view; the graph surface also takes at least 370 px. `effect.html` fixes its depth chart overlay inside the iframe, so the overlay cannot fill the parent app window. These are implementation constraints for the planned layout, not new application changes.

A separate interactive layout study compares horizontal and sidebar selection, rack disclosure, and focus. Headless Edge checks confirm mockup selection, mixer visibility, rack state restoration on leaving focus, and no page overflow at 390 px; desktop/mobile screenshots were inspected. This checks the mockup only. No application code or DSP changed, and no audio assessment was made.

Next: settle the layout with the interactive study before implementing persistent selection, rack disclosure, and chart focus. Minimum chart heights and the host/editor focus bridge remain to be tested in the real app. The unrelated Pythia edit remains untouched.

## 2026-10-04 — Codex — Persistent cell selection and chart focus

The accepted horizontal layout is implemented in `index.html`. The cell strip stays available with the rack open or closed, and both Sounder and mixer cells share its selection path. Add buttons and Recording/Rack output selection remain accessible without the graph. Secondary actions, bypass, and mix moved beside the selected cell’s controls. Show rack/Hide rack disclose a bounded routing area (230 px on desktop, 190 px on narrow screens), pushing the editor down without introducing a sidebar or changing its width. Graph manipulation and routing validation are unchanged.

The embedded overview uses a 100 px crossover field and a depth plot with at least 180 px of editing height. Focus on either chart coordinates the editor frame with the host, giving it the app window’s working area. Depth focus keeps band selection, window/presets, and band parameters; crossover focus keeps selection, split/merge, and handles. Return to overview or Escape restores the prior disclosure, selected band, scroll position, and keyboard focus. Other host controls are inert during focus. Canvas buffers resize to the displayed dimensions and device pixel ratio. View changes do not invalidate rendered audio or modify the recipe; editing a plot still does.

Per-cell band selection is kept as presentation state and survives cell switching. The old iframe-only depth overlay was replaced by one focus path for both charts. Normal controls use the page scrollbar; focus allows scrolling when retained controls exceed a short window. Axis labels received extra space after screenshot inspection found clipping in the compact depth chart.

Checks: `test-rack-browser.cjs` uses the shared server on port 8000, checks disclosure moves the editor without narrowing it, switches Sounder/mixer controls with the rack closed, and confirms focus/return retains rendered audio and the saved recipe. It edits a curve and band mix in depth focus, drags a crossover in crossover focus, checks band retention across cells, checks keyboard return, and exercises 1024×600 and 390×844 windows with canvas-size assertions. Existing routing dialog, branched PCM parity, saved layout, playback, Worker progress/cancellation/restart, and recipe rejection checks pass. `test-browser.cjs` passes stereo render/detector checks and byte-identical legacy WAV comparison. Desktop and mobile overview/focus screenshots were inspected. No listening assessment was made.

The sidebar alternative was dropped when the user accepted the horizontal study. Browser fullscreen was deferred: app-window focus fulfills the requested enlargement without depending on browser fullscreen. The accepted layout is recorded in [UI-PLAN.md](UI-PLAN.md), and operating details are in [WORKFLOWS.md](WORKFLOWS.md).

Next: assess the compact layout and focused controls on a longer multiband rack with real recordings. Browser fullscreen, undo/redo, other-effect adapters, and bounded-memory rendering remain undone. Work stayed in the existing checkout; the unrelated Pythia edit remains untouched.

## 2026-10-04 — Codex — Rack in the controls column

The rack and its disclosure/zoom toolbar moved inside the selected cell’s panel in `index.html`. The workspace is capped at 1180 px so the rack and effect controls share one column. A fresh page shows recording → `sounder1` → rack output. Hide rack collapses the graph and moves the controls up; `?view=effect` starts closed. Chart focus hides the nested rack and toolbar, then restores their prior disclosure on return. Graph manipulation, recipes, and DSP are unchanged.

Checks: `test-rack-browser.cjs` passes against the shared server. It checks the initial three nodes, equal rack/editor width and horizontal position, disclosure moving the controls without narrowing them, and chart focus hiding/restoring an open rack. Existing cell switching, routing forms, saved layout/recipe round trips, rendered PCM parity, playback, Worker cancellation/restart, short-window, and mobile-width checks pass. Desktop initial-rack and mobile screenshots were inspected. No listening assessment was made.

Next: assess the compact layout and focused controls on a longer multiband rack with real recordings. Graphical editing changes remain deferred. Work stayed in the existing checkout; the unrelated Pythia edit remains untouched.
