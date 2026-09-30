# Sounder rack workflows

Sounder's browser editor and command-line rack use `engine.js` for whole-file processing. The rack runs Sounder cells in an explicit graph, with optional parallel mixers. A recipe holds processing state; recordings stay in separate files.

The browser's **Save rack** button exports the selected Sounder settings as a one-cell recipe. The browser rack editor is planned. For multiple cells, edit the recipe or build one with `HindcastsRack.chain(states)` (`require('./rack.js').chain(states)` in Node).

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
```

The stereo check covers channel energy, linked gain, polarity invariance, mono parity, and legacy migration. The rack check covers numerical processing and the real command-line WAV round trip. The browser check requires Playwright (set `PLAYWRIGHT_PATH` to its package path if necessary) and headless Edge (override with `EDGE_PATH`). It loads the actual editor, processes a stereo WAV through the file control and Process button, and compares the page output with the rack's raw cell output.
