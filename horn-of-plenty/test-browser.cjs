// Run: node horn-of-plenty/test-browser.cjs. Set PLAYWRIGHT_PATH and EDGE_PATH if needed.
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn } = require('node:child_process');

let chromium = null;
try {
  chromium = require(process.env.PLAYWRIGHT_PATH || 'playwright').chromium;
} catch {
  chromium = null;
}

(async () => {
  const edgePath = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const pageUrl = pathToFileURL(path.join(__dirname, 'index.html')).href;
  const evalExpr = `(async () => {
    const hop = window.__hornOfPlenty;
    if (!hop) throw new Error('window.__hornOfPlenty not found');

    // Create a 1-second stereo test buffer with transients and sinusoidal bursts
    const sr = 44100, dur = 1.0, len = Math.round(sr * dur);
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: sr });
    const buf = ctx.createBuffer(2, len, sr);
    const d0 = buf.getChannelData(0), d1 = buf.getChannelData(1);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const sig = Math.sin(2 * Math.PI * 220 * t) * Math.exp(-((t % 0.2) * 20));
      d0[i] = sig;
      d1[i] = sig * 0.8;
    }

    // Load into Horn of Plenty
    await hop.loadAudioBuffer(buf, 'test-seed.wav');
    const grainCountAfterLoad = hop.getGrains().length;

    // Test suggest fiber
    hop.suggestFiber();
    const fiberAfterSuggest = hop.P.fiber;

    // Set short output length for rapid test execution
    hop.P.len = 2.0;
    document.getElementById('k-len').value = 2.0;

    // Render output
    hop.doRender();

    const outAudio = hop.getOutAudioBuf();
    const outL = hop.getOutL();
    const outR = hop.getOutR();
    const expectedOutLen = Math.round(hop.P.len * sr);

    // Test WAV encoding
    const wavBytes = hop.HornOfPlentyDSP.encodeWav(outL, outR, sr);
    const wavView = new DataView(wavBytes);
    const riff = String.fromCharCode(...new Uint8Array(wavBytes, 0, 4));
    const wave = String.fromCharCode(...new Uint8Array(wavBytes, 8, 4));
    const dataSize = wavView.getUint32(40, true);

    // Test preset switching
    const mistBtn = document.querySelector('#presets button[data-p="mist"]');
    if (mistBtn) mistBtn.click();
    const mistFiber = hop.P.fiber;
    const mistWhite = hop.P.white;

    return {
      grainCountAfterLoad,
      fiberAfterSuggest,
      expectedOutLen,
      actualOutLen: outAudio ? outAudio.length : 0,
      outChannels: outAudio ? outAudio.numberOfChannels : 0,
      riff,
      wave,
      dataSize,
      expectedDataSize: expectedOutLen * 2 * 2,
      exportEnabled: !document.getElementById('export').disabled,
      playEnabled: !document.getElementById('play').disabled,
      status: document.getElementById('status').textContent,
      mistFiber,
      mistWhite
    };
  })()`;

  let result;
  if (chromium) {
    const browser = await chromium.launch({
      executablePath: edgePath,
      headless: true
    });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(pageUrl);
      result = await page.evaluate(evalExpr);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  } else {
    // Native Edge headless CDP pipe fallback
    const profile = fs.mkdtempSync(path.resolve(os.tmpdir(), 'hop-edge-'));
    const browser = spawn(edgePath, [
      '--headless=new', '--disable-gpu', '--disable-extensions', '--no-first-run',
      `--user-data-dir=${profile}`, '--remote-debugging-pipe', 'about:blank'
    ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
    const commandPipe = browser.stdio[3], eventPipe = browser.stdio[4];
    let nextId = 1, incoming = '';
    const pending = new Map();
    eventPipe.on('data', chunk => {
      incoming += chunk.toString('utf8');
      let b;
      while ((b = incoming.indexOf('\0')) >= 0) {
        const text = incoming.slice(0, b);
        incoming = incoming.slice(b + 1);
        if (!text) continue;
        const msg = JSON.parse(text);
        if (msg.id && pending.has(msg.id)) {
          const { resolve, reject } = pending.get(msg.id);
          pending.delete(msg.id);
          msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result || {});
        }
      }
    });
    const cdp = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      commandPipe.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
    });
    try {
      const { targetId } = await cdp('Target.createTarget', { url: pageUrl });
      const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
      await cdp('Runtime.enable', {}, sessionId);
      await cdp('Page.enable', {}, sessionId);
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        const check = await cdp('Runtime.evaluate', { expression: 'typeof window.__hornOfPlenty !== "undefined"', returnByValue: true }, sessionId);
        if (check.result && check.result.value) break;
        await new Promise(r => setTimeout(r, 100));
      }
      const evaluated = await cdp('Runtime.evaluate', { expression: evalExpr, awaitPromise: true, returnByValue: true }, sessionId);
      if (evaluated.exceptionDetails) throw new Error(JSON.stringify(evaluated.exceptionDetails));
      result = evaluated.result.value;
    } finally {
      try { browser.kill(); } catch {}
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
    }
  }

  assert.ok(result.grainCountAfterLoad > 0, 'grains should be extracted');
  assert.ok(result.fiberAfterSuggest >= 15 && result.fiberAfterSuggest <= 300, 'fiber within valid range');
  assert.equal(result.actualOutLen, result.expectedOutLen);
  assert.equal(result.outChannels, 2);
  assert.equal(result.riff, 'RIFF');
  assert.equal(result.wave, 'WAVE');
  assert.equal(result.dataSize, result.expectedDataSize);
  assert.ok(result.exportEnabled, 'export should be enabled');
  assert.ok(result.playEnabled, 'play should be enabled');
  assert.equal(result.mistFiber, 25);
  assert.equal(result.mistWhite, 85);

  console.log('PASS: horn-of-plenty browser tests in Edge:');
  console.log(JSON.stringify(result, null, 2));
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
