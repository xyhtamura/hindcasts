# PYTHIA - preset specs

Current spec for the active preset shelf. Each preset is a v6 state payload applied
through `applyState`. Params listed as **deltas from `DEFAULT_PARAMS`**; unlisted
fields stay default.

**Implementation notes**
- UI: one preset `<select>` in the state toolbar. The old Pneuma Classic shortcut
  is retired from the active UI; legacy saves still migrate through the state path.
- Presets never touch `selfSampling` or loaded files.
- After any manual knob move, show the selector as `custom`.
- Unless noted: `sourceDry: true`, `monitorControl: false`, `gateEnabled: false`,
  `pingPong: false`, `loopClip: true`, `timeSync: 'free'`, `windowType: 'hann'`.
- `polarity: 0` unless the sidechain is the point of the preset.
- Scatter is exact-to-whole-clip: `0` = exact clean/read position, `1` = the
  granulator can draw from the full source clip. With loop on, scatter wraps.
  With `loopClip: false`, scatter is clipped to the available material ahead or
  before the ideal read; it does not sample the other edge.

---

## producer staples

**Slapback**
`time 0.11, scatter 0, feedback 0.10, damping 0.2, mix 0.35`
Clean tap only. The 50s vocal double.

**Anticipatory Delay**
`time -0.35, scatter 0, feedback 0.55, damping 0.15, mix 0.45` + `loopClip: false`
The spine patch: a clean delay folded before the event. Repeats begin quiet, grow louder as time approaches the original hit, then resolve into the dry sound.

**Ping-Pong Pneuma**
`timeSync '1/4', bpm 120, scatter 0.08, feedback 0.55, damping 0.35, panSpray 0.6, mix 0.45` + `pingPong: true`
Mostly coherent stereo delay; panSpray > 0 is required or ping-pong is inaudible.

**Dub Ouroboros**
`timeSync '1/8d', bpm 120, scatter 0.18, feedback 0.8, damping 0.7, feedbackGrain 0.2, mix 0.5`
Looped dark regeneration; the tape-echo corner.

**Oracle Chorus**
`time 0.04, scatter 0.12, grainSize 60, grainDensity 40, pitchSpray 0.3, panSpray 0.8, feedback 0.05, mix 0.5`
Doubler/chorus. Short time, no audible repeats.

## granular character

**Stereo Vapor**
`scatter 0.85, grainSize 200, grainDensity 30, densityJitter 0.4, pitchSpray 1.5, panSpray 1, feedback 0.1, mix 0.6`
Wide cloud, near-zero feedback; widens without echoing.

**Shimmer Vapor**
`pitch 12, scatter 0.55, grainSize 250, feedback 0.6, damping 0.4, panSpray 0.5, mix 0.4`
Octave-up regeneration; each repeat climbs.

**Disintegrating Echo**
`time 0.5, scatter 0.05, feedback 0.75, feedbackGrain 0.8, damping 0.3, mix 0.5`
First repeat stays mostly coherent, then repeats shred through the feedback path.

**Glass Halo**
`time 0.08, scatter 0.28, grainSize 90, grainDensity 55, pitch 7, pitchSpray 0.2, panSpray 1, feedback 0.12, damping 0.2, mix 0.45`
Bright short halo with stereo width and a fixed fifth-ish lift.

**Tape Mirage**
`timeSync '1/16', bpm 120, scatter 0.22, grainSize 110, grainDensity 25, pitchSpray 0.8, panSpray 0.35, feedback 0.65, feedbackGrain 0.45, damping 0.55, mix 0.5`
Small timed repeats that wobble and darken with each pass.

## precognitive signatures

**Verbatim Pre-Echo**
`time -0.4, scatter 0, feedback 0.3, mix 0.4` + `loopClip: false`
Clean repeats arriving before the hit. Bounce renders true clean pre-echo; live preview uses the negative-time tap bank.

**Anticipation Bloom**
`time -0.8, scatter 0.65, grainSize 180, grainDensity 35, pitchSpray 0.5, panSpray 0.7, feedback 0.5, mix 0.5` + `loopClip: false`
Grain cloud crescendoing into the event; feedback regenerates backward in the bounce.

**Pre-Duck**
`polarity -1, sidechainLookahead -0.15, timeSync '1/8', bpm 120, scatter 0.2, feedback 0.5, damping 0.4, mix 0.5`
The mixing job: repeats clear out before the control arrives. Needs a distinct control file to make sense.

**Duck-Gate Gaps**
`polarity -1, threshold 0.18, scatter 0.6, grainSize 120, grainDensity 30, panSpray 0.4, mix 0.6` + `gateEnabled: true`
Fires full-amplitude grains only in the control's silences; texture that fills the gaps.

**Negative Shimmer**
`time -0.6, scatter 0.55, grainSize 220, grainDensity 32, pitch 7, pitchSpray 0.4, panSpray 0.75, feedback 0.45, feedbackGrain 0.35, damping 0.45, mix 0.5` + `loopClip: false`
Upward pre-echo bloom; a softer shimmer that arrives before the source.

**Reverse Room**
`time -1.2, scatter 0.35, grainSize 260, grainDensity 28, feedback 0.65, feedbackGrain 0.5, damping 0.5, panSpray 0.45, mix 0.55` + `loopClip: false`
Long anticipatory room smear, closer to a reverse-reverb gesture than a tap delay.

---

*Sanity checks for the build*: every preset loads without console errors; selector
and catalog stay in sync; save-state after loading a preset round-trips;
determinism holds (same preset + same files -> identical bounce hash).
