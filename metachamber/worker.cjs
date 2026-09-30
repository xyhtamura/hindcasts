"use strict";
// Worker runner for Node.js worker_threads
const { parentPort } = require("node:worker_threads");
const { analyzeGapMap, renderMetachamber } = require("./engine.js");

parentPort.on("message", event => {
  const data = event && event.data ? event.data : event;
  const { id, kind, payload } = data;
  const report = (phase, value) => parentPort.postMessage({ id, progress: true, phase, value });
  try {
    if (kind === "analyze") {
      const result = analyzeGapMap(payload, report);
      parentPort.postMessage({ id, ok: true, result });
    } else if (kind === "render") {
      const result = renderMetachamber(payload, report);
      parentPort.postMessage({ id, ok: true, result }, result.channels.map(channel => channel.buffer));
    } else {
      throw new Error("Unknown engine job: " + kind);
    }
  } catch (error) {
    parentPort.postMessage({ id, ok: false, error: (error && error.stack) || String(error) });
  }
});
