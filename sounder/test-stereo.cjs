'use strict';
const assert=require('node:assert/strict'),DSP=require('./engine.js'),Rack=require('./rack.js');
const sr=44100,x=Float32Array.from({length:8821},(_,i)=>.1*Math.sin(i*.083)),neg=Float32Array.from(x,v=>-v);
const state=Rack.defaultState();state.bands[0].curve=[{x:0,y:0},{x:.6,y:.69},{x:1,y:1}];
function render(chs,s=state){return DSP.create(sr,s.global).render(chs,s);}
function near(a,b,t=1e-6){assert.equal(a.length,b.length);for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<t,`sample ${i}`);}
const engine=DSP.create(sr,state.global),mono=engine.analyseChannels([x],40,-90),same=engine.analyseChannels([x,x],40,-90),opposite=engine.analyseChannels([x,neg],40,-90);
assert.deepEqual(same,mono);assert.deepEqual(opposite,mono);
const active=engine.analyseChannels([x,new Float32Array(x.length)],40,-90);
for(let f=0;f<active.nFrames;f++)assert.ok(Math.abs((active.levelN[f]-mono.levelN[f])*90+10*Math.log10(2))<1e-5);
assert.ok(Math.max(...engine.analyseChannels([x,neg],40,-90,'mono').levelN)===0);
const inphase=render([x,x]),antiphase=render([x,neg]);assert.deepEqual(inphase[0],antiphase[0]);near(antiphase[1],Float32Array.from(antiphase[0],v=>-v));
assert.ok(Math.max(...antiphase[0].map((v,i)=>Math.abs(v-x[i])))>.01,'anti-phase audio must receive curve gain');
const legacy=structuredClone(state);legacy.version=2;delete legacy.global.detector;
const migrated=Rack.validateState(legacy);assert.equal(migrated.version,3);assert.equal(migrated.global.detector,'mono');
assert.deepEqual(render([x,neg],legacy),render([x,neg],migrated));assert.deepEqual(render([x],legacy),render([x]));
const multi=structuredClone(state);multi.global.crossovers=[300,3000];multi.bands=[0,1,2].map(()=>structuredClone(state.bands[0]));
const a=render([x,x],multi),b=render([x,neg],multi);assert.deepEqual(a[0],b[0]);near(b[1],Float32Array.from(a[1],v=>-v));
const scaled=Float32Array.from(x,v=>v*.5),linked=render([x,scaled]);near(linked[1],Float32Array.from(linked[0],v=>v*.5));
for(const length of [1,127,128,129]){
  const chs=[x.slice(0,length),neg.slice(0,length)];const out=render(chs);assert.equal(out[0].length,length);for(const c of out)for(const v of c)assert.ok(Number.isFinite(v));
}
const silence=render([new Float32Array(129),new Float32Array(129)]);silence.forEach(c=>assert.ok(c.every(v=>v===0)));
const bad=structuredClone(state);bad.global.detector='guess';assert.throws(()=>Rack.validateState(bad));
console.log('PASS: channel energy, anti-phase detection/render, linked gain, single-sided -3 dB, mono/legacy parity, multiband polarity invariance, short/silent buffers, state migration');
