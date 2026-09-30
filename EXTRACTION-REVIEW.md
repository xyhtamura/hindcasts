# Extraction review

**2026-09-30 — Codex.** Reviewed Antigravity's five extraction commits, `c2267af` through `a98c218`, against [EXTRACTION-HANDOFF.md](EXTRACTION-HANDOFF.md). The modules are usable starting points, but behavior preservation has two confirmed regressions. Effect code was left unchanged for the follow-up.

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
