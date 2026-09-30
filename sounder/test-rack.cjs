'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync,spawnSync}=require('node:child_process');
const Rack=require('./rack.js'),DSP=require('./engine.js'),WAV=require('./wav.cjs');
const audio={sampleRate:44100,channels:[Float32Array.from({length:5003},(_,i)=>0.15*Math.sin(i*0.071)),Float32Array.from({length:5003},(_,i)=>0.12*Math.cos(i*0.103))]};
const close=(a,b,t=1e-6)=>{assert.equal(a.length,b.length);for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<t,`sample ${i}: ${a[i]} != ${b[i]}`);};
const identity=Rack.defaultState();
for(const len of [1,2,127,128,129,2049,5003]){
  const input={sampleRate:audio.sampleRate,channels:audio.channels.map(c=>c.slice(0,len))};
  for(const multi of [false,true]){
    const s=structuredClone(identity);if(multi){s.global.crossovers=[300,3000];s.bands=[0,1,2].map(()=>structuredClone(s.bands[0]));}
    const out=Rack.render(input,Rack.chain([s]));out.channels.forEach((c,k)=>close(c,input.channels[k]));
    const decoded=WAV.decode(WAV.encode(out));assert.equal(decoded.sampleRate,input.sampleRate);decoded.channels.forEach((c,k)=>assert.deepEqual(c,out.channels[k]));
  }
}
const gain=Rack.defaultState();gain.bands[0].makeupDb=6;
const chain=Rack.chain([gain,gain]);const sequential=DSP.create(audio.sampleRate,gain.global).render(DSP.create(audio.sampleRate,gain.global).render(audio.channels,gain),gain);
Rack.render(audio,chain).channels.forEach((c,k)=>close(c,sequential[k]));
const parallel=Rack.chain([identity]);parallel.nodes.push({id:'sum',type:'mix',inputs:[{node:'sounder1',gainDb:20*Math.log10(0.5)},{node:'source',gainDb:20*Math.log10(0.5)}]});parallel.output='sum';
Rack.render(audio,parallel).channels.forEach((c,k)=>close(c,audio.channels[k]));
const bypass=Rack.chain([gain]);bypass.nodes[0].bypass=true;Rack.render(audio,bypass).channels.forEach((c,k)=>assert.deepEqual(c,audio.channels[k]));
bypass.nodes[0].bypass=false;bypass.nodes[0].mix=0.25;
const wet=DSP.create(audio.sampleRate,gain.global).render(audio.channels,gain);
Rack.render(audio,bypass).channels.forEach((c,k)=>close(c,Float32Array.from(c,(_,i)=>wet[k][i]*0.25+audio.channels[k][i]*0.75)));
const hot=Rack.chain([gain]);hot.master.ceilingDb=-20;const limited=Rack.render(audio,hot);assert.ok(limited.report.limitedSamples>0);assert.ok(limited.report.output.peak<0.100001);
const twice=Rack.render(audio,chain);assert.deepEqual(twice.channels,Rack.render(audio,chain).channels);
const bad=f=>{const r=Rack.chain([identity]);f(r);assert.throws(()=>Rack.render(audio,r));};
bad(r=>r.nodes[0].input='sounder1');bad(r=>r.nodes[0].input='missing');bad(r=>r.nodes[0].state.bands[0].tauMs='40');
bad(r=>r.nodes[0].state.bands[0].curve[1].x=0);bad(r=>r.nodes[0].type='pythia');bad(r=>r.nodes[0].state.global.crossovers=[30000]);bad(r=>r.extra=1);
bad(r=>r.nodes[0].mix=NaN);bad(r=>r.master.makeupDb=null);bad(r=>r.master.ceilingDb=Infinity);
bad(r=>{r.nodes.push({...r.nodes[0],id:'unused',input:'unused'});});
assert.throws(()=>WAV.decode(Buffer.from('not a WAV')));
// Run the real CLI, decode its output, and inspect its report and refusal to overwrite.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sounder-rack-'));
try{
  const input=path.join(dir,'in.wav'),recipe=path.join(dir,'rack.json'),output=path.join(dir,'out.wav'),report=path.join(dir,'report.json');
  fs.writeFileSync(input,WAV.encode(audio));fs.writeFileSync(recipe,JSON.stringify(chain));
  const cli=path.join(__dirname,'run-rack.cjs'),args=[cli,'render','--input',input,'--recipe',recipe,'--output',output,'--report',report];
  execFileSync(process.execPath,args);const decoded=WAV.decode(fs.readFileSync(output));decoded.channels.forEach((c,k)=>assert.deepEqual(c,twice.channels[k]));
  const log=JSON.parse(fs.readFileSync(report));assert.equal(log.frames,5003);assert.equal(log.stages.length,2);
  assert.equal(spawnSync(process.execPath,args).status,1);
  assert.equal(spawnSync(process.execPath,[cli,'render','--input',input,'--recipe',recipe,'--output',input,'--force']).status,1);
  console.log('PASS: short/stereo/multiband identity, WAV round trip, serial and parallel routing, bypass/mix, ceiling, determinism, invalid recipes, CLI render and overwrite guards');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
