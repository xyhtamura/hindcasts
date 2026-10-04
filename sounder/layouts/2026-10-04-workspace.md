# Sounder workspace layouts

2026-10-04 — Codex. Layout references for the Sounder browser editor. These diagrams record alternatives; [index.html](../index.html) is the working page.

## Current layout: recording first, rack beside controls

```text
Header: original Sounder wordmark, subtitle, and divider
Recording: source waveform / processed-stage waveform
Transport: process / stage / playback / export
┌──────────────────────────────┬──────────────────────┐
│ Selected cell                │ Rack                 │
│ Spectrum panel               │ Load / Save rack     │
│ Console                      │ Cell list / Routing  │
│ Band and cell parameters     │ Add / endpoint picks │
│                              │ Recording            │
│                              │     ↓                │
│                              │ sounder1 → output    │
└──────────────────────────────┴──────────────────────┘
```

The user chose waveforms and transport below the header, before controls and rack. The empty source waveform opens the recording picker. **Load file** stays available after loading, and file drops reach the recording loader from the host page or embedded controls. The console contains processing controls.

Load/Save rack, the cell list and its Routing buttons, Add Sounder/Add mixer, and Recording/Rack output selection belong to the rack panel. The effect controls have no duplicate Routing button. Default nodes run vertically, with input ports at the top and output ports at the bottom. Saved coordinates remain intact; older wide layouts can scroll horizontally within the rack. The routing format and DSP are unchanged.

At widths up to 1000 px, the controls and rack stack. This is a temporary responsive layout. A pull-out rack, expanded panel, and optional swipe remain undecided. Swipe is not implemented because curve and crossover drags already use pointer movement. Chart focus still occupies the app window and restores the prior rack disclosure.

## Earlier side-by-side layout

Commit `a36be04` introduced the restored header, recording-first area, and vertical rack beside the controls. Its cell selector and add/endpoint buttons occupied a separate row before both panels, and the selected cell’s editor retained a duplicate Routing button. These controls moved into the rack panel in the current layout.

## Earlier layout: rack inside the controls panel

Commit `c7dd704` records the shared-column layout:

```text
Header / recording toolbar
Cell selector
┌───────────────────────────────────────────┐
│ Rack toolbar                             │
│ Recording → sounder1 → Rack output        │
│ Selected cell controls                   │
└───────────────────────────────────────────┘
Audition
```

The rack started visible. Disclosure moved the controls vertically without changing their width. This version can be inspected with `git show c7dd704:sounder/index.html` and the matching CSS/scripts from the same commit.

## Earlier layout: rack before a persistent editor

Commit `646688b` records the horizontal cell selector and chart-focus implementation. The graph sat outside the editor, started hidden, and expanded before the cell strip and controls. Depth and crossover focus coordinated the embedded editor with its host. The original design proposal is retained in [UI-PLAN.md](../UI-PLAN.md).

## Header reference

[effect.html](../effect.html) retains the original standalone header. The embedded editor hides that header; the main page now carries its wordmark, build tag, subtitle, gradient divider, background, and existing font families. The wordmark uses the original per-letter offsets. The decorative snow canvas remains in the effect editor; it was not duplicated in the host.

## Open decisions

- Choose the narrow-screen rack interaction after trying the current layout.
- Assess control widths and navigation with a longer multiband rack and real recordings.
- Decide whether waveform previews need separate channel lanes. The current preview keeps extrema across channels, so opposite-polarity stereo does not disappear through averaging.
