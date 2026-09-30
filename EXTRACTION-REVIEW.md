# Extraction review

**2026-09-30 — Codex.** Reviewed Antigravity's five extraction commits, `c2267af` through `a98c218`, against [EXTRACTION-HANDOFF.md](EXTRACTION-HANDOFF.md). The modules are usable starting points, but behavior preservation has two confirmed regressions. Effect code was left unchanged for the follow-up.

**Resolution, 2026-09-30:** Both regressions below are fixed. `scripts/check-extraction.cjs` passes 37 acceptance cases, including zero controls, invalid-value defaults, and the original Husk preset. The findings and initial test limits below describe the earlier review; the follow-up checks are recorded at the end.

## Required fixes

1. **Prolepsis drops valid zero controls.** `prolepsis/engine.js` uses `Number(value) || default` in `validateParams`. Passing zero for `balance`, `flowY`, `chromaSplit`, `edgeInscription`, `lightPersistence`, or `blur` restores a nonzero default. The page passes its controls through this validator on each render, so the regression affects normal use: zero vertical flow becomes -1.2, zero chromatic splitting becomes 6.5, and symmetric balance 0 becomes 0.5. Select defaults by absence or invalidity, preserve finite zero values, and test each boundary.
2. **Horn of Plenty's Husk preset changed.** Before extraction (`f2e03ff:horn-of-plenty/index.html`), Husk used `dens: 4`, `rev: 10`, and `spread: 25`. The extracted preset uses 3.5, 0, and 20. Restore the original values; changes in taste belong in a separate change. The browser imports this preset from the module.

Run `node scripts/check-extraction.cjs` from `hindcasts/` for the focused acceptance checks. It reports seven failing assertions on the reviewed version (six zero controls and one preset comparison); it should exit 0 after the fixes. This check is intentionally separate from the passing engine suites.

## Checks performed

All five supplied Node suites passed: Metachamber, Proteus, Horn of Plenty, Remanence, and Prolepsis. The supplied browser suites for Proteus, Horn of Plenty, Remanence, and Prolepsis passed in headless Edge with bundled Playwright.

Metachamber's standalone CDP browser harness timed out at `Target.createTarget` on this run. Loading its actual `index.html?selftest=1` through Playwright instead passed: three events, Worker analysis and rendering, symmetric head/tail energy, 4/4 boundary checks, enabled WAV bounce, and no page errors. That checks the application; the harness timeout remains a separate reproducibility issue.

Metachamber's numerical test reproduced the documented pre-extraction SHA-256 and sample count. The other supplied suites check numerical properties or repeatability, but do not establish a comparison to their pre-extraction render. Passing them alone does not close the handoff's baseline-parity requirement. Add fixed-input comparisons under the same random sequence for Horn, and frame/sample comparisons for the remaining engines before claiming complete extraction parity.

## Integration remains separate

The Sounder rack still accepts only Sounder and mixers. Metachamber needs head/tail origin alignment; Proteus needs donor input and channel-policy handling; Horn changes duration and produces stereo from mono analysis; Remanence retains its own processing and clipping; Prolepsis uses a Canvas pipeline for video. The wrappers and validators need adapter-specific checks before these become recipe effect IDs. Pythia's existing edit remains untouched and its engine boundary has not received a new extraction handoff entry.

This was a code and synthetic-processing review, not a listening or visual quality judgment. No roadmap step changed. The next rack step remains the Sounder browser editor; the extraction fixes above can proceed in their effect folders.

## Follow-up verification

**2026-09-30 — Codex — Corrected extraction regressions and checked pre-extraction parity.** Prolepsis defaults numeric controls only when they are absent or invalid; finite zero values survive validation. Horn's Husk preset again uses density 4, reversal 10%, and spread 25%. The affected Node and browser suites pass.

Run `node scripts/check-extraction-parity.cjs` from `hindcasts/` with Playwright available (or set `PLAYWRIGHT_PATH` to its package directory). It serves both the historical pages at `f2e03ff` and the working pages on a temporary loopback server, exercises their actual processing, and compares outputs. An optional positional Git ref selects another baseline. Test-only hooks expose historical closure state; production engines do not parse or evaluate HTML source.

The fixed cases pass: Horn's seeded Husk scatter is sample-identical, Proteus's dual-tone morph is sample-identical, Remanence's looped audio and video with fold/wear/flow/tracking are sample/pixel-identical, and Prolepsis's symmetric all-anticipation render with zero controls and transient/exposure passes is pixel-identical. Metachamber's Worker selftest metrics match the historical page; its existing Node suite already establishes the baseline render hash. These cases establish parity for the exercised inputs, not every setting or recording.

This parity runner also provides a checked Playwright route for Metachamber's browser selftest. Its original direct-CDP harness still times out on this machine. Sounder's stereo detector, the browser rack editor, and multi-effect adapters remain separate work. No effect's planned next feature changed.
