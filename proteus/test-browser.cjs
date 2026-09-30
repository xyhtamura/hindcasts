// Run: node proteus/test-browser.cjs. Set PLAYWRIGHT_PATH and EDGE_PATH if needed.
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
const {spawn}=require('node:child_process');

let chromium=null;
try {
  chromium = require(process.env.PLAYWRIGHT_PATH || 'playwright').chromium;
} catch {
  chromium = null;
}

(async()=>{
  const edgePath = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const pageUrl = pathToFileURL(path.join(__dirname,'proteus.html')).href;
  const evalExpr = `(async()=>{
    __proteus.debugTones();document.getElementById('render').click();
    await new Promise(resolve=>setTimeout(resolve,150));
    const wav=await encodeWAV(S.out).arrayBuffer();
    const view=new DataView(wav),decoded=await getCtx().decodeAudioData(wav.slice(0));
    return {test:__proteus.selftest(),status:document.getElementById('status').textContent,
      samples:S.out.length,expected:S.A.length,decoded:decoded.length,
      wavBytes:view.getUint32(40,true),channels:S.out.numberOfChannels,
      exportEnabled:!document.getElementById('export').disabled};
  })()`;

  let result;
  if(chromium){
    const browser=await chromium.launch({
      executablePath: edgePath, headless: true
    });
    try{
      const page=await browser.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(pageUrl);
      result=await page.evaluate(evalExpr);
      assert.deepEqual(errors,[]);
    }finally{await browser.close();}
  } else {
    // Native Edge headless CDP pipe fallback when playwright is not installed
    const profile = fs.mkdtempSync(path.resolve(os.tmpdir(), 'proteus-edge-'));
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
        const check = await cdp('Runtime.evaluate', { expression: 'typeof window.__proteus !== "undefined"', returnByValue: true }, sessionId);
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

  assert.ok(result.test.finite);
  assert.equal(result.samples,result.expected);assert.equal(result.decoded,result.expected);
  assert.equal(result.wavBytes,result.samples*result.channels*2);assert.ok(result.exportEnabled);
  assert.match(result.status,/Rendered/);console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
