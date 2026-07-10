# PYTHIA — preset specs (for build)

Spec for the preset shelf. Each preset = a full v6 state payload applied via `applyState`
(same path as Pneuma Classic). Params listed as **deltas from `DEFAULT_PARAMS`** — everything
unlisted stays default. `applyState` already merges over defaults, so partial `params` is safe.

**Implementation notes**
- UI: a preset `<select>` in the state toolbar next to the Pneuma (Classic) button; Classic joins the list (keep the button too or fold it in — builder's call).
- Presets never touch `selfSampling` or loaded files (same rule as Classic).
- After any manual knob move, show the selector as `custom` (don't fight the user).
- Unless noted: `sourceDry: true`, `monitorControl: false`, `gateEnabled: false`, `pingPong: false`, `loopClip: true`, `timeSync: 'free'`, `windowType: 'hann'` (granular presets need clickless grains; only Classic keeps `linear`).
- `polarity: 0` unless the sidechain is the point of the preset.

---

## producer staples

**Slapback**
`time 0.11, scatter 0, feedback 0.10, damping 0.2, mix 0.35`
Clean tap only. The 50s vocal double.

**Ping-Pong Pneuma**
`timeSync '1/4', bpm 120, scatter 0.15, feedback 0.55, damping 0.35, panSpray 0.6, mix 0.45` + `pingPong: true`
panSpray > 0 is required or ping-pong is inaudible (see roadmap note).

**Dub Ouroboros**
`timeSync '1/8d', bpm 120, scatter 0.3, feedback 0.8, damping 0.7, feedbackGrain 0.2, mix 0.5`
⥀ loop. Long dark regeneration; the tape-echo corner.

**Oracle Chorus**
`time 0.04, scatter 0.5, grainSize 60, grainDensity 40, pitchSpray 0.3, panSpray 0.8, feedback 0.05, mix 0.5`
Doubler/chorus. Short time, no audible repeats.

## granular character

**Stereo Vapor**
`scatter 1, grainSize 200, grainDensity 30, densityJitter 0.4, pitchSpray 1.5, panSpray 1, feedback 0.1, mix 0.6`
Wide cloud, near-zero feedback — widens without echoing.

**Shimmer Vapor**
`pitch 12, scatter 1, grainSize 250, feedback 0.6, damping 0.4, panSpray 0.5, mix 0.4`
Octave-up regeneration; each repeat climbs.

**Disintegrating Echo**
`time 0.5, scatter 0.1, feedback 0.75, feedbackGrain 0.8, damping 0.3, mix 0.5`
First repeat clean, then repeats shred — the dual-topology signature.

## precognitive signatures (the ones only Pythia has)

**Verbatim Pre-Echo**
`time -0.4, scatter 0, feedback 0.3, mix 0.4` + `loopClip: false` (𓆙)
Clean repeats arriving *before* the hit. Bounce renders true clean pre-echo; live preview falls back to granulator (documented approximation) — fine.

**Anticipation Bloom**
`time -0.8, scatter 1, grainSize 180, grainDensity 35, pitchSpray 0.5, panSpray 0.7, feedback 0.5, mix 0.5` + `loopClip: false`
Grain cloud crescendoing into the event; feedback regenerates backward in the bounce.

**Pre-Duck**
`polarity -1, sidechainLookahead -0.15, timeSync '1/8', bpm 120, scatter 0.2, feedback 0.5, damping 0.4, mix 0.5`
The mixing job: repeats clear out *before* the control (vocal) arrives. Needs a distinct control file to make sense — note in UI hint if cheap.

**Duck-Gate Gaps**
`polarity -1, threshold 0.18, scatter 1, grainSize 120, grainDensity 30, panSpray 0.4, mix 0.6` + `gateEnabled: true`
Fires full-amplitude grains only in the control's silences — texture that fills the gaps.

## preservation

**Pneuma (Classic)** — already shipped; keep exactly as is (`windowType 'linear'`, sourceDry off, monitorControl on, all Phase-1+ params zeroed).

---

*Sanity checks for the build*: every preset loads without console errors; Classic still byte-matches its current behavior; save-state after loading a preset round-trips; determinism holds (same preset + same files → identical bounce hash).
