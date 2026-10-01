# Effect adapters for the rack

The Sounder rack supplies recipes, explicit routing, bypass and mix, raw stage caches, final output gain and ceiling, stage audition, float WAV export, and cancellable Worker jobs. Browser and CLI rendering share `sounder/rack.js`. These mechanisms can serve other effects inside Hindcasts without copying their DSP into the host.

Effect support is still explicit. The core accepts only `sounder` and `mix`; the browser edits Sounder and mixer DAGs. `sounder/rack-worker.js` imports Sounder, and `sounder/rack-browser.js` embeds its editor. Extraction alone does not register another effect.

## Adapter boundary

Each effect needs a stable ID, a versioned JSON state, defaults, strict validation, a render adapter, and an editor bridge. The adapter calls the existing extracted engine. It must not duplicate DSP or silently substitute defaults for invalid saved controls.

The first audio contract takes `{sampleRate, channels}` with equal-length `Float32Array` channels and returns the same rate, channel count, and sample count. Time zero stays at the same sample. Finite output must be checked before a stage reaches a mixer. Dry/wet blending and bypass belong to the host; the adapter must state whether engine controls already include a dry component. The host applies its final ceiling once. An engine's own normalization or saturation remains part of that effect's documented sound.

The proposed registry entry groups `defaultState`, `validateState`, `render`, and the editor URL under the effect ID. Replace the Sounder branches in core validation/render dispatch and browser cell creation with registry dispatch. The CLI's `describe` response then exposes each supported effect's controls and versioned defaults. Keep migration in the adapter and recipes readable as JSON.

Render adapters should allow a Promise because Remanence's entry point is asynchronous. The current generator driver is synchronous; awaiting adapters requires a shared asynchronous driver with browser/CLI parity checks. Worker jobs can keep the same request/progress/result/error protocol. Cancellation terminates the dedicated Worker, including synchronous loops; it does not rely on an effect periodically checking a flag.

The editor bridge carries state, cell identity, a request generation, and analysis results. It accepts messages only from its parent or selected frame. Sounder currently asks the Worker for band-energy analysis; another editor can request its own analysis instead. The Worker must reject unsupported analysis kinds rather than treat every effect as Sounder.

## Existing engines

This inventory comes from reading the extracted entry points. No non-Sounder rack adapter has been validated yet.

| Effect | Existing interface | Required integration |
| --- | --- | --- |
| [Remanence](remanence/engine.js) | `renderAudio(channels, sampleRate, params, onProgress)` returns a Promise with channels at the input length and rate. | First candidate for the length-preserving contract. Add versioned strict state validation, await the engine, select result PCM, and bridge the editor. Keep its internal dry/print and saturation controls explicit. Its video entry point is separate. |
| [Horn of Plenty](horn-of-plenty/engine.js) | `render(source, sampleRate, params, randomSource)` folds the source to mono and produces two channels with a duration set by `params.len`. | Define generator duration and channel conversion. Record a seed and pass its RNG for reproducible recipes. Do not pad, crop, or fold silently to satisfy a mixer. |
| [Metachamber](metachamber/engine.js) | `render(channels, sampleRate, params, report)` produces up to two channels and extends the file with a head and/or tail; metadata includes source offset. | Add integer sample-origin and tail routing before host dry/wet blending or parallel mixing. Preserve the gap-map contract and temporal stance. |
| [Proteus](proteus/engine.js) | `render(channelsA, channelsB, sampleRate, options)` requires two recordings, with mono or paired stereo modes and internal gain protection. | Add named multi-source inputs, rate/alignment rules, and channel policy. A second source cannot be represented by the current single-input effect node. |
| [Pythia](pythia/pythia-worker.js) | `performBounceRender` has its own Worker payload and returns encoded WAV plus start/head/tail metadata. | Expose PCM behind its existing renderer, then establish sample-origin, sidechain, and multi-layer input contracts. Its current page has an unrelated uncommitted edit; leave it alone during rack work. |
| [Prolepsis](prolepsis/engine.js) | Frame-based video feedback and anticipation. | Needs a frame/timestamp graph and export contract. The audio PCM rack is not a video transport. |

## Check each adapter

Compare fixed-input standalone and rack PCM before final output gain or ceiling. Check state migration, zero controls, bypass, dry/wet behavior, mono/stereo policy, input ownership, finite output, and sample count/origin. Verify browser/Worker and CLI parity, cancellation, progress, and stage export. For stochastic processing, fix the seed; for multiple sources, supply a known alignment case. For a head or tail, mix against a known impulse and check its sample index.

Next: Remanence, after adding asynchronous registry dispatch. Length-changing effects follow the sample-origin contract. Branched browser editing uses the existing DAG routing meaning; optional layout records presentation only.
