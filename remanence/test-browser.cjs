// Run: node remanence/test-browser.cjs. Set PLAYWRIGHT_PATH and EDGE_PATH if needed.
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
    const rem = window.__remanence;
    if (!rem) throw new Error('window.__remanence not found');

    // 1. Audio test in browser
    const sr = 44100, dur = 0.5, len = Math.round(sr * dur);
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: sr });
    const audioBuf = ctx.createBuffer(2, len, sr);
    const d0 = audioBuf.getChannelData(0), d1 = audioBuf.getChannelData(1);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      d0[i] = Math.sin(2 * Math.PI * 330 * t) * 0.5;
      d1[i] = Math.sin(2 * Math.PI * 440 * t) * 0.5;
    }

    await rem.loadAudioBuffer(audioBuf, 'browser-audio.wav');
    await rem.renderAudio();

    const wet = rem.getWetBuf();
    const wetSamples = wet ? wet.length : 0;
    const wetChannels = wet ? wet.numberOfChannels : 0;
    const audioWavBytes = rem.encodeWav(wet);

    // 2. Video test in browser
    const vW = 32, vH = 24, vFps = 15, vN = 6;
    const frames = [];
    for (let n = 0; n < vN; n++) {
      const f = new Uint8ClampedArray(vW * vH * 4);
      for (let y = 0; y < vH; y++) {
        for (let x = 0; x < vW; x++) {
          const idx = (y * vW + x) * 4;
          f[idx] = (x * 8) & 0xff;
          f[idx + 1] = (y * 10) & 0xff;
          f[idx + 2] = 160;
          f[idx + 3] = 255;
        }
      }
      frames.push(f);
    }

    rem.loadFrames(frames, vW, vH, vFps, 'browser-video.mp4');
    await rem.renderVideo();

    const vOut = rem.getVOut();
    const vOutCount = vOut ? vOut.length : 0;
    const vOutFrameBytes = vOut && vOut[0] ? vOut[0].length : 0;

    // 3. Preset switching
    const hauntBtn = document.querySelector('.presets button[data-p="haunt"]');
    if (hauntBtn) hauntBtn.click();
    const hauntPrint = rem.P.print;
    const hauntWraps = rem.P.wraps;

    return {
      wetSamples,
      wetChannels,
      audioWavSize: audioWavBytes ? audioWavBytes.byteLength : 0,
      expectedWavSize: 44 + len * 2 * 2,
      vOutCount,
      vOutFrameBytes,
      expectedFrameBytes: vW * vH * 4,
      hauntPrint,
      hauntWraps,
      exportEnabled: !document.getElementById('export').disabled,
      playEnabled: !document.getElementById('play').disabled
    };
  })()`;

  let result;
  if (chromium) {
    const browser = await chromium.launch({ executablePath: edgePath, headless: true });
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
    const profile = fs.mkdtempSync(path.resolve(os.tmpdir(), 'remanence-edge-'));
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
        if (msg.method === 'Runtime.exceptionThrown') {
          console.error('EXCEPTION:', JSON.stringify(msg.params.exceptionDetails));
        }
        if (msg.method === 'Runtime.consoleAPICalled') {
          console.log('CONSOLE:', JSON.stringify(msg.params.args));
        }
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
        const check = await cdp('Runtime.evaluate', { expression: 'typeof window.__remanence !== "undefined"', returnByValue: true }, sessionId);
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

  assert.equal(result.wetSamples, 22050);
  assert.equal(result.wetChannels, 2);
  assert.equal(result.audioWavSize, result.expectedWavSize);
  assert.equal(result.vOutCount, 6);
  assert.equal(result.vOutFrameBytes, result.expectedFrameBytes);
  assert.equal(result.hauntPrint, 0.55);
  assert.equal(result.hauntWraps, 5);
  assert.ok(result.exportEnabled, 'export should be enabled');
  assert.ok(result.playEnabled, 'play should be enabled');

  console.log('PASS: remanence browser tests in Edge:');
  console.log(JSON.stringify(result, null, 2));
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
