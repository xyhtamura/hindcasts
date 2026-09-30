'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url'),{execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const Rack=require('./rack.js'),WAV=require('./wav.cjs');
async function downloaded(download){return fs.readFileSync(await download.path());}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try{
    const page=await browser.newPage({acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://**/*',route=>route.abort());
    const rate=await page.evaluate(()=>new AudioContext().sampleRate);
    const audio={sampleRate:rate,channels:[Float32Array.from({length:5003},(_,i)=>0.1*Math.sin(i*0.07)),Float32Array.from({length:5003},(_,i)=>0.12*Math.cos(i*0.11))]};
    const state=Rack.defaultState();state.global.crossovers=[300,3000];state.global.mix=0.8;state.global.makeupDb=1;
    state.bands=[0,1,2].map(i=>({...structuredClone(state.bands[0]),tauMs:[1,40,800][i],mix:0.7,makeupDb:i,
      curve:[{x:0,y:0},{x:0.6,y:0.66},{x:1,y:1}]}));
    async function processPage(baseline){
      if(baseline)await page.setContent(execFileSync('git',['show',`${process.env.BASELINE_REF}:sounder/index.html`],{cwd:path.join(__dirname,'..'),encoding:'utf8',maxBuffer:2e6}));
      else await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
      await page.locator('#file').setInputFiles({name:'probe.wav',mimeType:'audio/wav',buffer:WAV.encode(audio)});
      await page.waitForFunction(()=>!document.getElementById('sound').disabled);
      await page.locator('#state-file').setInputFiles({name:'probe.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(state))});
      await page.waitForFunction(()=>document.getElementById('status').textContent.includes('State loaded'));
      await page.locator('#sound').click();await page.waitForFunction(()=>!document.getElementById('export').disabled);
      const pending=page.waitForEvent('download');await page.locator('#export').click();const bytes=await downloaded(await pending);
      assert.match(await page.locator('#status').textContent(),/Processed/);
      return bytes;
    }
    const current=await processPage(false),decoded=WAV.decode(current),expected=Rack.render(audio,Rack.chain([state])).cache.get('sounder1');
    assert.equal(decoded.sampleRate,rate);assert.equal(decoded.channels[0].length,5003);
    for(let c=0;c<2;c++)for(let i=0;i<5003;i++)assert.ok(Math.abs(decoded.channels[c][i]-expected[c][i])<6.2e-5);
    const pending=page.waitForEvent('download');await page.locator('#rack-save').click();
    const saved=JSON.parse((await downloaded(await pending)).toString());Rack.validate(saved);assert.equal(saved.nodes[0].state.bands.length,3);
    if(process.env.BASELINE_REF){const baseline=await processPage(true);assert.deepEqual(current,baseline);}
    assert.deepEqual(errors,[]);console.log(`PASS: browser stereo multiband render, WAV export, saved rack${process.env.BASELINE_REF?', byte-identical to legacy browser export':''}`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
