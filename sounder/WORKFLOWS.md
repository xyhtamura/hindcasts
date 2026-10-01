# Sounder rack workflows

Sounder's browser editor and command-line rack use `engine.js` for whole-file processing. The rack runs Sounder cells in an explicit graph, with optional parallel mixers. A recipe holds processing state; recordings stay in separate files.

The [Sounder page](index.html) owns a rack with serial and parallel paths. **Save rack** exports the complete configuration, including each effect’s values, routing, output settings, names, and node positions. Recipes can also be edited as JSON; build serial chains with `HindcastsRack.chain(states)` (`require('./rack.js').chain(states)` in Node).

## Browser rack

Open `sounder/index.html` through the root server. The default network is recording → Sounder → rack output, with routing hidden. **Rack view** reveals that same network; **Effect view** hides its routing controls. Switching views keeps the selected node, all effect values, and the decoded recording in memory. There is no page navigation or transfer between separate racks. The old `rack.html` address redirects to `index.html?view=rack`.

Select a node to show its settings on the page. Each Sounder has its own curve, bands, detector, makeup, and mix; its histogram measures the actual upstream signal. Recording selection shows channel, rate, and frame information. Output selection exposes the final makeup and ceiling. Mixer selection exposes input gains and disconnection. Add, duplicate, remove, or reorder Sounder cells with their buttons. Each cell also has a bypass switch and a separate dry/wet mix.

**Process rack** renders the chain. **Stage** selects the recording, a raw cell output, or the rack output for the audio player and **Export WAV**. Raw stages precede rack makeup and ceiling. The rack output applies both controls. Export writes float32 WAV at the decoded recording’s rate and length. The browser may resample recordings to its AudioContext rate when decoding; the CLI preserves the input WAV rate.

**Save rack** stores every cell, connection, name, position, and output setting in JSON. **Load rack** restores them and reveals routing for multi-node or nonserial configurations. Recordings stay separate; loading a rack preserves any recording already loaded. It rejects cycles and unsupported recipes without replacing the open graph. Edits disable stage audition and export until processing runs again. The browser and CLI use the same recipe format and DSP.

Rendering and upstream histogram preparation run in dedicated Workers. Processing reports the current cell and completed cell count, then the final output stage; this is stage progress, not an estimate of remaining time. **Cancel processing** terminates the render Worker and disables its output. The recording and recipe remain available for another render. Superseded histogram jobs are also terminated; generation checks prevent an old result from replacing the selected cell’s analysis.

Serve the rack over HTTP; there is no main-thread render fallback when a Worker fails. Workers receive copies of the recording and transfer results back, retaining whole-file buffers. Decoding, buffer copying, drawing, and WAV preparation still run on the main thread. Other effects remain outside this browser editor. [Effect adapters](../RACK-ADAPTERS.md) records the reusable structure and each extracted engine’s integration requirements.

## Cell routing

Each cell’s **Routing** button opens its incoming and outgoing connections. The selected cell’s controls also have a **Routing** button, available in Effect view. **In** selects the upstream recording or cell. Mixers have multiple input rows, each with a gain control, plus **Add input** and **Remove input**.

**Out** lists destination cells and rack output. Checking a Sounder replaces that destination’s input; unchecking it restores the recording. Checking a mixer adds this cell at 0 dB and preserves any existing input gain. Unchecking it removes this cell’s paths; a mixer must retain at least one input. Checking rack output makes this cell the final result; unchecking it restores the recording as output. A cell can feed several destinations.

**Apply routing** validates all changes together. A cycle or a mixer with no inputs keeps the dialog open with an error and leaves the rack unchanged. **Cancel** or Escape discards changes. Routing edits retain effect values and positions, invalidate processed audio, and save through the existing rack JSON format.

## Patch graph

Drag a node body to move it; select its title to edit it. Choose an output port and then an input port to connect. A Sounder input replaces its previous connection. A mixer input adds a path; its controls set each input gain and disconnect paths. Choose **Rack output** or connect to the output node to set the exported result. The graph permits shared upstream nodes and rejects feedback cycles.

**Add mixer** combines parallel paths without normalization. Node names and positions are saved in the recipe. Zoom buttons change the graph scale; scroll its surface to reach other nodes. Moving a node changes presentation only. Node removal reconnects its consumers to that Sounder’s upstream input, or to the recording when removing a mixer. Up/down buttons apply only to serial chains. Each Sounder keeps its complete band, crossover, curve, detector, bypass, and mix settings.

The optional recipe `layout.positions` maps node IDs, `source`, and `__output` to `{x, y}` coordinates. The core validates these as finite numbers from 0 to 10000 and ignores them when rendering. Existing recipes without layout remain valid. Older runners that reject unknown fields need updating before loading a recipe with layout.

## Run a recording

From `hindcasts/`, with Node on the command path:

```powershell
node sounder/run-rack.cjs describe
node sounder/run-rack.cjs validate --recipe sounder/examples/two-stage.rack.json
node sounder/run-rack.cjs render --input recording.wav --recipe sounder/examples/two-stage.rack.json --output processed.wav --report processed.report.json
```

`describe` returns the effect ID, control ranges, curve coordinates, and a complete default recipe as JSON. `validate` checks the whole graph and reports the order needed for its output. `render` also checks the recording and crossovers against its sample rate.

Input supports RIFF WAV with PCM 16-, 24-, or 32-bit samples, or float32 samples. Extensible WAV and compressed formats are rejected with an error. Convert those recordings to a supported WAV before running. Output is float32 WAV, retaining the input rate, channel count, and sample count. Existing output and report files require `--force`; the input and recipe cannot be overwritten by these options.

The example is an identity chain for checking routing, not a mastering preset. Use **Save rack** after drawing and auditioning a curve to obtain a processing recipe.

## Describe a chain

The root object has `format: "hindcasts-rack"`, `version: 1`, `nodes`, `output`, and `master`. Each node has a unique `id`; `source` names the original recording. Array order does not determine routing.

| Node type | Input | Processing controls |
| --- | --- | --- |
| `sounder` | `input`, a node ID or `source` | `state`, optional `bypass` (default false), optional `mix` (default 1) |
| `mix` | `inputs`, an array of `{node, gainDb}` | Each input's gain; the mixer sums without normalization |

A Sounder `state` uses version 3. `global.detector` is `power` for mean channel energy or `mono` for the legacy mono-sum detector. Version 2 states are accepted and migrated to version 3 with `mono`, preserving their processing. `global.crossovers` holds increasing frequencies in Hz. There must be one more band than crossover. Each band holds `tauMs`, `floorDb`, `smoothMs`, `makeupDb`, `mix`, `curve`, `enabled`, and `solo`. Optional `color` is editor metadata. The curve spans normalized `x=0` through `x=1`; both coordinates map from `floorDb` to 0 dB. `tauMs` changes the measurement used to read that curve. Saved version 1 states must first be loaded and saved by the browser editor.

The validator rejects unknown fields, unsupported effect IDs, cycles, missing nodes, non-finite numbers, duplicate curve x coordinates, and invalid ranges. It accepts an optional node `label`. Disconnected nodes are validated but not rendered.

New states use channel power: square each channel, average its energy across channels, then measure RMS over the selected window. Each band is filtered separately in each channel before measurement. Identical and opposite-polarity stereo have the same measured level; one active channel measures 3.01 dB below two equally active channels. RMS processing applies one gain curve to every channel. Below 2 ms, shaping still processes each channel independently. The browser’s **Level detector** selector can switch an older state to channel power; saving records that choice. The browser's selected ceiling affects monitoring; its WAV export clamps only at full scale. Rack exports apply the rack's chosen final ceiling.

`master.makeupDb` defaults to 0; `master.ceilingDb` defaults to -1. The rack applies a sample hard ceiling once, after the chosen output node. The legacy `state.global.ceilingDb` is accepted as editor metadata; it does not limit a cell. The ceiling is not a true-peak limiter or a loudness target. The report counts limited samples and records each stage's peak and RMS.

## Inspect a stage

```powershell
node sounder/run-rack.cjs render --input recording.wav --recipe sounder/examples/two-stage.rack.json --output stage.wav --stage sounder1
```

`--stage` exports a raw cached intermediate, before the rack's master gain and ceiling. The report still describes the full render and names the exported stage. In code, `Rack.render({sampleRate, channels}, recipe)` returns `channels`, `sampleRate`, `cache` (a Map from node ID to channel arrays), and `report`. Channels are equal-length `Float32Array` objects. Treat returned intermediate arrays as read-only. This cache lasts for one render; reuse across edits and bounded-memory rendering are planned. Long recordings and many branches retain several whole-file buffers in memory.

## Agent workflow

1. Read `describe` and this document before choosing controls. Only `sounder` and `mix` are supported.
2. Preserve the original recording. Save the chosen processing as a named recipe beside the output so a person can inspect and rerun it.
3. If the request names a chain, encode that order with node inputs. If it asks for a choice, select controls for the stated task and record why those controls address it; peak and RMS alone do not establish a good sound.
4. Validate, then render with `--report`. Read the report for limiting and stage gain changes. A successful render establishes finite output and format validity, not musical quality.
5. Leave listening and final selection to Xyh unless the task asks for a preview or listening check.

Pythia and the other effects need adapters before their IDs can appear in a recipe. The routing format reserves no implicit time alignment: this first version accepts only cells that preserve rate, channels, and timeline length. Effects that extend a head or tail require an explicit sample-origin contract before mixing.

## Checks

```powershell
node sounder/test-stereo.cjs
node sounder/test-rack.cjs
node sounder/test-browser.cjs
node sounder/test-rack-browser.cjs
```

The stereo check covers channel energy, linked gain, polarity invariance, mono parity, and legacy migration. The rack check covers numerical processing and the real command-line WAV round trip. The browser check requires Playwright (set `PLAYWRIGHT_PATH` to its package path if necessary) and headless Edge (override with `EDGE_PATH`). It loads the actual editor, processes a stereo WAV through the file control and Process button, and compares the page output with the rack's raw cell output.

`test-rack-browser.cjs` checks the actual rack page: cell edits and routing, upstream histograms, output/stage float WAV parity with the core renderer, playback advancement, edit invalidation, recipe round trips and rejection, and narrow-screen width. It also checks Worker progress/errors, alias-safe stage transfers, input ownership, responsive cancellation, and restart. It serves its own local HTTP fixture unless `RACK_URL` is supplied. It saves desktop/mobile screenshots to the system temporary directory, or `SCREENSHOT_DIR` when set.
