"use strict";
// Web Worker script for browser execution
if (typeof importScripts === "function") {
  importScripts("../shared/gap-map.js", "engine.js");
  const { analyzeGapMap, renderMetachamber } = self.MetachamberDSP;
  self.onmessage = e => {
    const { id, kind, payload } = e.data;
    const report = (phase, value) => self.postMessage({ id, progress: true, phase, value });
    try {
      if (kind === "analyze") {
        const result = analyzeGapMap(payload, report);
        self.postMessage({ id, ok: true, result });
      } else if (kind === "render") {
        const result = renderMetachamber(payload, report);
        const transfer = result.channels.map(x => x.buffer);
        self.postMessage({ id, ok: true, result }, transfer);
      } else {
        throw new Error("Unknown engine job: " + kind);
      }
    } catch (error) {
      self.postMessage({ id, ok: false, error: (error && error.stack) || String(error) });
    }
  };
}
