// Run: node proteus/test-browser.cjs. Set PLAYWRIGHT_PATH and EDGE_PATH if needed.
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async()=>{
  const browser=await chromium.launch({
    executablePath:process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true
  });
  try{
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.join(__dirname,'proteus.html')).href);
    const result=await page.evaluate(async()=>{
      __proteus.debugTones();document.getElementById('render').click();
      await new Promise(resolve=>setTimeout(resolve,150));
      const wav=await encodeWAV(S.out).arrayBuffer();
      const view=new DataView(wav),decoded=await getCtx().decodeAudioData(wav.slice(0));
      return {test:__proteus.selftest(),status:document.getElementById('status').textContent,
        samples:S.out.length,expected:S.A.length,decoded:decoded.length,
        wavBytes:view.getUint32(40,true),channels:S.out.numberOfChannels,
        exportEnabled:!document.getElementById('export').disabled};
    });
    assert.deepEqual(errors,[]);assert.ok(result.test.finite);
    assert.equal(result.samples,result.expected);assert.equal(result.decoded,result.expected);
    assert.equal(result.wavBytes,result.samples*result.channels*2);assert.ok(result.exportEnabled);
    assert.match(result.status,/Rendered/);console.log(JSON.stringify(result,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
