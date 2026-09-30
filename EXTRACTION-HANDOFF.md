# Effect extraction handoff

**2026-09-30. Assigned to Antigravity.** Extract the other Hindcasts effects' processing code from their HTML into reusable modules. The existing pages must keep working through those modules. This prepares browser racks and agent runners; it does not add effects to the Sounder rack yet.

## Ownership

Codex owns `sounder/` and rack integration. Antigravity owns extraction in the other effect folders, one folder at a time. Keep edits, tests, and dated notes in the effect being extracted. Leave `sounder/`, `shared/`, `hindcasts.md`, and the root `ROADMAP.md` and `DEPENDENCIES.md` to Codex during this handoff; report any required shared change instead of making it concurrently. This note establishes the split for this task.

There is a pre-existing uncommitted edit in `pythia/index.html`. Identify its owner and wait for that edit to finish before changing Pythia. Do not restore it or include it in an extraction commit. No worktree is authorized by this spec.

## Starting points

| Effect | Source inspected | Extraction target |
| --- | --- | --- |
| Metachamber | `metachamber/index.html`, inline `workerSource()` | Move the bounce DSP into a module; retain a thin Worker wrapper |
| Proteus | `proteus/proteus.html` | Separate analysis/correspondence/render from editor and transport; preserve both inputs |
| Horn of Plenty | `horn-of-plenty/index.html` | Separate grain analysis and synthesis; record randomness and output-duration behavior |
| Pythia | `pythia/pythia.js`, `pythia/pythia-worker.js` | Already external; inspect the bounce engine's reusable boundary rather than extracting it again |
| Remanence | `remanence/index.html` | Separate processing from media playback and export; retain its existing media types |
| Prolepsis | `prolepsis/index.html` | Separate processing from UI; keep video work independent of the audio rack |

MASKROM is specified rather than implemented, so it has no engine to extract. Start with Metachamber, then Proteus and Horn of Plenty. Pythia waits on the edit above. The video effects can follow; do not force them into an audio buffer API.

## Extraction procedure

1. Read the effect's notes and Git history. Capture a fixed-input baseline from its authoritative render/bounce path before changing code; preview may use a different algorithm.
2. Move processing into an effect-local `engine.js` (or preserve an existing engine filename). Expose explicit inputs and processing state. Keep DOM access, decoding, playback, downloads, and Worker message handling in wrappers. Use the same implementation from the page and headless tests, without runtime HTML parsing or `eval`.
3. Keep mathematics, defaults, state versions, and output behavior unchanged in the extraction commit. For stochastic processing, compare under the same random sequence and document how it is supplied. Report nondeterminism as a remaining integration constraint; do not silently introduce a different generator.
4. Retarget existing tests to the module. Run those tests and exercise the real page's load, render, and export path. Compare sample values, rate, channels, length, and event placement against the baseline. Document a numerical tolerance where exact equality is unavailable.
5. Append a dated Antigravity entry to that effect's notes and commit only its extraction files. Hand back the commit, module entry points, checks, and unresolved constraints.

## Boundary to prepare

For audio, use channel arrays (`Float32Array`) and an explicit sample rate at the processing boundary. Document all named inputs, including donor/control audio, state defaults and validation, randomness, and whether inputs are mutated. Processing must be callable without a page or an active audio device. Sounder's [engine.js](sounder/engine.js) is a browser/Node packaging example; its state model is specific to Sounder.

Document where input sample zero lands in each output, any added leading/trailing samples, duration changes, and channel/rate changes. Preserve those behaviors. Do not trim anticipation or tails to fit the current rack. A future adapter needs an explicit sample-origin contract to align branches; that contract remains Codex's integration work.

Return raw effect audio and identify any existing gain, wet/dry, normalization, or ceiling operation. Preserve effect-owned operations during extraction; identify host-owned ones for later factoring. List render/progress/cancellation entry points and any browser-only dependencies. For video, document its native frame/time boundary separately.

## Done when

The page uses the extracted module, baseline and browser checks pass, headless processing runs for audio, and the effect's notes describe the API and remaining integration limits. Leave DSP fixes, new presets, rack registration, and cross-effect routing for separate work. The current rack only supports Sounder and mixers: [Sounder workflow contract](sounder/WORKFLOWS.md).
