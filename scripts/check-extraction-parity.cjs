#!/usr/bin/env node
'use strict';
// Compare actual pre-extraction and current browser processing. Test-only hooks expose
// old closure state; production processing never reads HTML or evaluates source text.
// Run: node scripts/check-extraction-parity.cjs [baseline-ref]
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),ref=process.argv[2]||'f2e03ff';
const pages=['metachamber/index.html','horn-of-plenty/index.html','proteus/proteus.html','remanence/index.html','prolepsis/index.html'];
const hook=`window.__parity={P,load:(audio,frames,w,h)=>{
  ac=new AudioContext({sampleRate:22050});srcBuf=ac.createBuffer(2,audio[0].length,22050);
  audio.forEach((c,i)=>srcBuf.copyToChannel(Float32Array.from(c),i));
  media='audio';vFrames=frames.map(x=>Uint8ClampedArray.from(x));vW=w;vH=h;vFps=15;vN=frames.length;
},audio:render,video:renderVideo,getAudio:()=>Array.from({length:wetBuf.numberOfChannels},(_,c)=>Array.from(wetBuf.getChannelData(c))),getVideo:()=>vOut.map(x=>Array.from(x))};\n`;
function instrument(html,name){return name.startsWith('remanence/')?html.replace('}); // DOMContentLoaded',hook+'}); // DOMContentLoaded'):html;}
const old=new Map(pages.map(name=>[name,instrument(execFileSync('git',['show',`${ref}:${name}`],{cwd:root,encoding:'utf8',maxBuffer:4e6}),name)]));
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'),baseline=url.pathname.startsWith('/baseline/');
  const name=decodeURIComponent(url.pathname.replace(/^\/(baseline\/)?/,'')),file=path.resolve(root,name);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{const body=baseline&&old.has(name)?old.get(name):pages.includes(name)?instrument(fs.readFileSync(file,'utf8'),name):fs.readFileSync(file);
    res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(body);
  }catch(e){res.writeHead(404).end();}
});
async function run(page,name){
  if(name.startsWith('metachamber/')){
    await page.waitForFunction(()=>['pass','fail','error'].includes(document.documentElement.dataset.selftest),{},{timeout:60000});
    const result=await page.evaluate(()=>({state:document.documentElement.dataset.selftest,details:document.documentElement.dataset.selftestDetails}));
    assert.equal(result.state,'pass',result.details);return JSON.parse(result.details);
  }
  if(name.startsWith('horn-of-plenty/'))return page.evaluate(()=>{
    sr=22050;src=Float32Array.from({length:22050},(_,i)=>.3*Math.sin(i*.13)*Math.exp(-(i%5000)/4000));
    Object.assign(P,PRESETS.husk,{len:1,lvlOwn:true});let seed=123;
    Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    analyze(false);doRender();return {params:P,audio:[Array.from(outL),Array.from(outR)]};
  });
  if(name.startsWith('proteus/'))return page.evaluate(()=>{
    __proteus.debugTones();doRender();return {audio:Array.from({length:S.out.numberOfChannels},(_,c)=>Array.from(S.out.getChannelData(c)))};
  });
  if(name.startsWith('remanence/'))return page.evaluate(async()=>{
    const api=__parity,w=16,h=12;
    const audio=[0,1].map(c=>Array.from({length:2205},(_,i)=>.25*Math.sin(i*(.13+c*.017))));
    const frames=Array.from({length:8},(_,n)=>Array.from({length:w*h*4},(_,i)=>i%4===3?255:(i*7+n*23)%256));
    api.load(audio,frames,w,h);Object.assign(api.P,{print:.7,wraps:4,wind:-.3,wrap:.02,grow:.03,fold:.4,wear:.5,flow:.3,track:.2,fall:.7,tilt:1800,dry:1,loop:1});
    await api.audio();const out=api.getAudio();await api.video();return {audio:out,frames:api.getVideo()};
  });
  return page.evaluate(async()=>{
    const w=32,h=24,N=6;
    Object.defineProperty(video,'videoWidth',{configurable:true,value:w});Object.defineProperty(video,'videoHeight',{configurable:true,value:h});
    state.srcFrames=await Promise.all(Array.from({length:N},async(_,n)=>{
      const cv=document.createElement('canvas');cv.width=w;cv.height=h;const ctx=cv.getContext('2d');
      ctx.fillStyle='#163852';ctx.fillRect(0,0,w,h);ctx.fillStyle='#efc952';ctx.fillRect(n*3,6,8,9);return createImageBitmap(cv);
    }));
    Object.assign(state,{loaded:true,decodeDirty:false,N,width:w,height:h,fps:24,duration:N/24,inSec:0,outSec:N/24,mode:'symmetric',balance:0,transientAware:true,exposureNorm:true});
    for(const key of ['flowY','chromaSplit','edgeInscription','lightPersistence','blur'])controls[key].value=0;
    await process();if(!state.processed)throw Error('Prolepsis render did not complete');
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;const ctx=cv.getContext('2d');
    const frames=state.outFrames.map(frame=>{ctx.clearRect(0,0,w,h);ctx.drawImage(frame,0,0);return Array.from(ctx.getImageData(0,0,w,h).data);});
    return {frames};
  });
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
    const origin=`http://127.0.0.1:${server.address().port}`;
    for(const name of pages){
      const results=[];
      for(const prefix of ['baseline/','']){
        const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.route('https://**/*',route=>route.abort());
        try{await page.goto(`${origin}/${prefix}${name}${name.startsWith('metachamber/')?'?selftest=1':''}`);results.push(await run(page,name));assert.deepEqual(errors,[]);}finally{await page.close();}
      }
      assert.deepEqual(results[1],results[0],`${name} changed from ${ref}`);
      console.log(`PASS: ${name} matches ${ref} ${name.startsWith('metachamber/')?'Worker selftest metrics':'sample/frame bytes'}`);
    }
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
