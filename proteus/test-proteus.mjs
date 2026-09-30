// Run with: node proteus/test-proteus.mjs (from hindcasts).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ProteusDSP = require('./engine.js');
const api = ProteusDSP;
const html = fs.readFileSync(new URL('./proteus.html', import.meta.url), 'utf8');
assert.match(html, /<script src="engine\.js"><\/script>/, 'proteus.html loads engine.js');
const N=2048,hop=N/4,win=api.hann(N);
const tone=(len,f,phase=0)=>Float32Array.from({length:len},(_,n)=>.4*Math.sin(2*Math.PI*f*n/44100+phase));
const render=(a,b,m,tf=1,offset=0,edge=0)=>api.morphChannel(a,b,{
  N,hop,win,curveAt:typeof m==='function'?m:()=>m,bOffsetSamples:offset,tf,edgeFadeSamples:edge
});
const finite=o=>assert.ok(o.every(Number.isFinite),'non-finite output');
function close(a,b,tolerance=1e-6){
  assert.equal(a.length,b.length);
  let max=0;for(let n=0;n<a.length;n++)max=Math.max(max,Math.abs(a[n]-b[n]));
  assert.ok(max<tolerance,`maximum sample error ${max}`);
}
for(const len of [1,17,1000,2048,2049,44100]){
  const a=tone(len,220),b=tone(len,440);
  const spectrum=api.stft(a,N,hop,win);
  for(const frame of spectrum.mag)finite(frame);
  for(const tf of [0,.7,1]){
    const o=render(a,b,.5,tf);assert.equal(o.length,len);finite(o);
    close(render(a,b,0,tf),a);close(render(a,b,1,tf),b);
  }
}
const a=tone(44100,220),b=tone(44100,220,Math.PI/2);
for(const offset of [-777,333,50000]){
  for(const m of [0,.5,1]){
    const expected=Float32Array.from(a,(v,n)=>{
      const j=n-offset;return j<0||j>=b.length?v:(1-m)*v+m*b[j];
    });
    close(render(a,b,m,0,offset),expected);
    if(m===0||m===1)close(render(a,b,m,1,offset),expected);
  }
}
const ramp=render(a,b,x=>x,0);
close(ramp,Float32Array.from(a,(v,n)=>(1-n/(a.length-1))*v+n/(a.length-1)*b[n]));
const edges=render(a,b,1,0,0,11025);
assert.equal(edges[0],a[0]);assert.equal(edges.at(-1),a.at(-1));
close(render(a,a,.5),a,1e-4);
finite(render(new Float32Array(a.length),b,.5));
// Validate the FFT independently against an impulse's known flat spectrum.
const re=new Float64Array(N),im=new Float64Array(N);re[0]=1;
api.fft(re,im,false);assert.ok(re.every(v=>Math.abs(v-1)<1e-10));
api.fft(re,im,true);assert.ok(Math.abs(re[0]-1)<1e-10);
console.log('PASS: short clips, exact length, endpoints, offsets, waveform fade, edge fade, identity, silence, FFT');

function bandEnergy(signal,frequencies){
  const size=32768,re=new Float64Array(size),im=new Float64Array(size);
  for(let n=0;n<size;n++)re[n]=signal[n+4096]*(.5-.5*Math.cos(2*Math.PI*n/size));
  api.fft(re,im,false);
  let all=0,inside=0;
  for(let k=1;k<size/2;k++){
    const e=re[k]**2+im[k]**2,hz=k*44100/size;all+=e;
    if(frequencies.some(f=>Math.abs(f-hz)<35))inside+=e;
  }
  return inside/all;
}
const single=render(tone(44100,220),tone(44100,440),.5);
const singleRatio=bandEnergy(single,[330]);
assert.ok(singleRatio>.9,`single transported peak energy ${singleRatio}`);
const chord=(f,g)=>Float32Array.from(tone(44100,f),(v,n)=>.5*(v+toneSecond(g,n)));
const toneSecond=(f,n)=>.4*Math.sin(2*Math.PI*f*n/44100);
const chordOut=render(chord(220,660),chord(440,880),.5);
const chordRatio=bandEnergy(chordOut,[330,770]);
assert.ok(chordRatio>.8,`transported chord energy ${chordRatio}`);
const regions=api.peakRegions(Float32Array.from([0,1,4,1,0,2,8,2,0]));
assert.equal(regions.regions.length,2);
assert.equal(regions.regions.reduce((s,r)=>s+r.mass,0),regions.total);
console.log(JSON.stringify({singlePeakEnergy:singleRatio,chordPeakEnergy:chordRatio}));
const glide=render(tone(44100,220),tone(44100,440),x=>x);
for(const [start,end] of [[6000,12000],[30000,36000]]){
  let crossings=0;for(let n=start+1;n<end;n++)if((glide[n-1]<0)!==(glide[n]<0))crossings++;
  const hz=crossings*44100/(2*(end-start)),expected=220+220*(start+end)/2/44099;
  assert.ok(Math.abs(hz-expected)<5,`glide ${hz} Hz; expected ${expected} Hz`);
}
let seed=17;
const noise=Float32Array.from({length:10000},()=>{seed=(1664525*seed+1013904223)>>>0;return .1*(seed/2147483648-1);});
finite(render(noise,tone(noise.length,500),.5));
console.log('PASS: glide trajectory and noise-to-tone finiteness');
