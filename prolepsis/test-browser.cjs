// Run: node prolepsis/test-browser.cjs. Set PLAYWRIGHT_PATH and EDGE_PATH if needed.
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
    const pro = window.__prolepsis;
    if (!pro) throw new Error('window.__prolepsis not found');

    const w = 64, h = 48, N = 6;
    const srcBitmaps = [];
    for (let i = 0; i < N; i++) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      // Draw a colored background with a moving bright circle
      ctx.fillStyle = i % 2 === 0 ? '#103040' : '#402010';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffb229';
      ctx.beginPath();
      ctx.arc((i * 10) % w + 5, h / 2, 6, 0, Math.PI * 2);
      ctx.fill();
      const bmp = await createImageBitmap(c);
      srcBitmaps.push(bmp);
    }

    // 1. Load test frames
    pro.loadSrcFrames(srcBitmaps, w, h, 24);

    // 2. Test preset switching
    const presetSelect = document.getElementById('preset');
    presetSelect.value = 'foreshadow';
    presetSelect.dispatchEvent(new Event('change'));
    const foreshadowMode = pro.state.mode;

    // 3. Process anticipation pass
    await pro.process();
    const antOutCount = pro.state.outFrames.length;
    const antProcessed = pro.state.processed;

    // 4. Test symmetric mode with transient awareness and exposure norm
    pro.setPreset('preverb');
    pro.state.transientAware = true;
    pro.state.exposureNorm = true;
    await pro.process();
    const symOutCount = pro.state.outFrames.length;

    // 5. Test scrub
    pro.drawFrame(2);

    return {
      foreshadowMode,
      antOutCount,
      antProcessed,
      symOutCount,
      symmetricMode: pro.state.mode,
      stateText: document.getElementById('state').textContent
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
    const profile = fs.mkdtempSync(path.resolve(os.tmpdir(), 'prolepsis-edge-'));
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
          console.log(`[BROWSER ${msg.params.type}]`, ...msg.params.args.map(a => a.value || a.description || ''));
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
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        const check = await cdp('Runtime.evaluate', { expression: 'typeof window.__prolepsis !== "undefined"', returnByValue: true }, sessionId);
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

  assert.equal(result.foreshadowMode, 'anticipation');
  assert.equal(result.antOutCount, 6);
  assert.equal(result.antProcessed, true);
  assert.equal(result.symOutCount, 6);
  assert.equal(result.symmetricMode, 'symmetric');

  console.log('PASS: prolepsis browser tests in Edge:');
  console.log(JSON.stringify(result, null, 2));
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
