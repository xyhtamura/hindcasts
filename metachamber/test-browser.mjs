import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const edge = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const page = new URL("./index.html", import.meta.url);
page.searchParams.set("selftest", "1");
const profilePrefix = path.resolve(os.tmpdir(), "metachamber-edge-");
const profile = fs.mkdtempSync(profilePrefix);

const browser = spawn(edge, [
  "--headless=new",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-component-update",
  "--disable-sync",
  "--disable-default-apps",
  "--disable-background-networking",
  "--metrics-recording-only",
  "--no-proxy-server",
  "--no-first-run",
  "--no-default-browser-check",
  `--user-data-dir=${profile}`,
  "--remote-debugging-pipe",
  "about:blank"
], { windowsHide: true, stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });

const commandPipe = browser.stdio[3];
const eventPipe = browser.stdio[4];
let stderr = "";
browser.stderr.on("data", chunk => { if (stderr.length < 12000) stderr += chunk.toString(); });

let nextId = 1;
const pending = new Map();
let incoming = "";
eventPipe.on("data", chunk => {
  incoming += chunk.toString("utf8");
  let boundary;
  while ((boundary = incoming.indexOf("\0")) >= 0) {
    const text = incoming.slice(0, boundary);
    incoming = incoming.slice(boundary + 1);
    if (!text) continue;
    const message = JSON.parse(text);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(timer);
      message.error ? reject(new Error(`${message.error.message}: ${JSON.stringify(message.error.data || {})}`)) : resolve(message.result || {});
    }
  }
});

function command(method, params = {}, sessionId) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP command timed out: ${method}`));},10000);timer.unref?.();
    pending.set(id, { resolve, reject, timer });
    commandPipe.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + "\0", error=>{if(error&&pending.has(id)){clearTimeout(timer);pending.delete(id);reject(error);}});
  });
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const deadline = Date.now() + 60000;

let targetId;
try {
  const target = await command("Target.createTarget", { url: page.href });
  targetId = target.targetId;
  const attached = await command("Target.attachToTarget", { targetId, flatten: true });
  const sessionId = attached.sessionId;
  await command("Runtime.enable", {}, sessionId);

  let state = "missing", details = null, status = "";
  while (Date.now() < deadline) {
    try {
      const evaluated = await command("Runtime.evaluate", {
        expression: `(() => ({
          state: document.documentElement.dataset.selftest || "missing",
          details: document.documentElement.dataset.selftestDetails || null,
          status: document.getElementById("status")?.textContent || "",
          canvas: !!document.getElementById("gap-canvas"),
          renderButton: !!document.getElementById("render")
        }))()`,
        returnByValue: true
      }, sessionId);
      const value = evaluated.result?.value;
      if (value) {
        ({ state, details, status } = value);
        if (state === "pass") {
          const parsed = JSON.parse(details);
          assert.equal(parsed.events, 3);
          assert.equal(parsed.analysisMode, "worker");
          assert.equal(parsed.renderMode, "worker");
          assert.ok(parsed.energy > 1e-8);
          assert.equal(parsed.checks.passed, parsed.checks.total);
          assert.equal(parsed.bounceEnabled, true);
          assert.equal(value.canvas, true);
          assert.equal(value.renderButton, true);
          console.log(JSON.stringify({ ok: true, browser: "Microsoft Edge (headless CDP pipe)", state, details: parsed }, null, 2));
          break;
        }
        if (state === "error" || state === "fail") throw new Error(`browser self-test ${state}: ${details}; status=${status}`);
      }
    } catch (error) {
      if (/Cannot find context|Execution context was destroyed/.test(error.message)) { await wait(100); continue; }
      throw error;
    }
    await wait(100);
  }
  if (state !== "pass") throw new Error(`browser self-test timed out in state=${state}; status=${status}; details=${details}; stderr=${stderr}`);
} finally {
  try { if (targetId) await Promise.race([command("Target.closeTarget", { targetId }),wait(500)]); } catch {}
  try { await Promise.race([command("Browser.close"),wait(500)]); } catch {}
  browser.kill();
  await Promise.race([new Promise(resolve => browser.once("exit", resolve)), wait(2000)]);
  if (path.resolve(profile).startsWith(profilePrefix)) {
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Crash-handler files can be released just after browser exit. */ }
  }
}
