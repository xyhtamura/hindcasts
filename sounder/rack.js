// Versioned whole-file routing. Browser global and dependency-free Node entry point.
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./engine.js'));
  else root.HindcastsRack=factory(root.SounderDSP);
})(typeof globalThis!=='undefined'?globalThis:this,DSP=>{
'use strict';
const copy=x=>structuredClone(x);
const fail=m=>{throw new Error(m);};
function number(x,lo,hi,name){
  if(typeof x!=='number'||!Number.isFinite(x)||x<lo||x>hi)fail(`${name} must be in [${lo}, ${hi}]`);
  return x;
}
function keys(o,allowed,name){
  if(!o||typeof o!=='object'||Array.isArray(o))fail(`${name} must be an object`);
  for(const k of Object.keys(o))if(!allowed.includes(k))fail(`${name}: unknown field ${k}`);
}
function defaultState(){return {version:3,global:{crossovers:[],makeupDb:0,mix:1,detector:'power'},bands:[{
  tauMs:40,floorDb:-90,smoothMs:30,makeupDb:0,mix:1,
  curve:[{x:0,y:0},{x:1,y:1}],enabled:true,solo:false
}]};}
function validateState(state){
  keys(state,['version','global','bands'],'Sounder state');
  if(state.version!==2&&state.version!==3)fail('Rack Sounder state requires version 2 or 3');
  const s=copy(state),g=s.global;
  keys(g,['crossovers','makeupDb','mix','ceilingDb','detector'],'Sounder global');
  if(state.version===2){if(g.detector!==undefined)fail('Version 2 cannot declare a detector');g.detector='mono';s.version=3;}
  if(!['power','mono'].includes(g.detector))fail('Detector must be power or mono');
  if(!Array.isArray(g.crossovers)||g.crossovers.length>31)fail('Expected at most 31 crossovers');
  g.crossovers.forEach((x,i)=>{number(x,20,96000,'crossover Hz');if(i&&x<=g.crossovers[i-1])fail('Crossovers must increase');});
  g.makeupDb=number((g.makeupDb===undefined?0:g.makeupDb),-60,36,'master makeup dB');
  g.mix=number((g.mix===undefined?1:g.mix),0,1,'master mix');
  if(g.ceilingDb!==undefined)number(g.ceilingDb,-60,0,'legacy ceiling dB');
  if(!Array.isArray(s.bands)||s.bands.length!==g.crossovers.length+1)fail('Band count must equal crossover count + 1');
  s.bands.forEach((b,i)=>{
    keys(b,['tauMs','floorDb','smoothMs','makeupDb','mix','curve','enabled','solo','color'],`band ${i}`);
    number(b.tauMs,0.5,2000,'window ms');number(b.floorDb,-200,-1,'floor dB');
    number(b.smoothMs,0,2000,'smoothing ms');number(b.makeupDb,-60,36,'band makeup dB');number(b.mix,0,1,'band mix');
    for(const k of ['enabled','solo']){
      if(b[k]===undefined)b[k]=k==='enabled';
      if(typeof b[k]!=='boolean')fail(`${k} must be boolean`);
    }
    if(!Array.isArray(b.curve)||b.curve.length<2||b.curve.length>256)fail('Curve needs 2–256 points');
    b.curve.forEach((p,j)=>{
      keys(p,['x','y'],'curve point');number(p.x,0,1,'curve x');number(p.y,0,1,'curve y');
      if(j&&p.x<=b.curve[j-1].x)fail('Curve x values must increase');
    });
    if(b.curve[0].x!==0||b.curve.at(-1).x!==1)fail('Curve must span x=0 to x=1');
  });
  return s;
}
function validate(recipe){
  keys(recipe,['format','version','nodes','output','master'],'rack');
  if(recipe.format!=='hindcasts-rack'||recipe.version!==1)fail('Expected hindcasts-rack version 1');
  if(!Array.isArray(recipe.nodes)||!recipe.nodes.length||recipe.nodes.length>128)fail('Rack needs 1–128 nodes');
  const r=copy(recipe),ids=new Map();
  for(const n of r.nodes){
    keys(n,['id','type','input','inputs','state','bypass','mix','label'],'node');
    if(typeof n.id!=='string'||! /^[a-zA-Z][\w-]*$/.test(n.id)||n.id==='source'||ids.has(n.id))fail('Node IDs must be unique; source is reserved');
    if(n.type==='sounder'){
      if(n.inputs!==undefined)fail('Sounder takes one input');
      n.state=validateState(n.state);
      if(typeof n.input!=='string')fail('Sounder input must name a node or source');
      n.mix=number((n.mix===undefined?1:n.mix),0,1,'cell mix');
      n.bypass=(n.bypass===undefined?false:n.bypass);if(typeof n.bypass!=='boolean')fail('Bypass must be boolean');
    }else if(n.type==='mix'){
      if(n.input!==undefined||n.state!==undefined||n.mix!==undefined||n.bypass!==undefined)fail('Mixer accepts inputs only');
      if(!Array.isArray(n.inputs)||!n.inputs.length)fail('Mixer needs inputs');
      for(const p of n.inputs){keys(p,['node','gainDb'],'mixer input');if(typeof p.node!=='string')fail('Mixer input must name a node');number(p.gainDb,-120,36,'mixer gain dB');}
    }else fail(`Unsupported effect: ${n.type}`);
    ids.set(n.id,n);
  }
  const order=[],visiting=new Set(),done=new Set();
  function visit(id){
    if(id==='source'||done.has(id))return;
    const n=ids.get(id);if(!n)fail(`Missing node: ${id}`);
    if(visiting.has(id))fail(`Routing cycle at ${id}`);
    visiting.add(id);for(const dep of n.type==='mix'?n.inputs.map(p=>p.node):[n.input])visit(dep);
    visiting.delete(id);done.add(id);order.push(n);
  }
  if(typeof r.output!=='string')fail('Output must name a node or source');
  visit(r.output);
  // Validate disconnected routing too; execution only visits output ancestors.
  const active=order.slice();for(const n of r.nodes)visit(n.id);
  r.master=r.master===undefined?{}:r.master;keys(r.master,['makeupDb','ceilingDb'],'rack master');
  r.master.makeupDb=number((r.master.makeupDb===undefined?0:r.master.makeupDb),-60,36,'rack makeup dB');
  r.master.ceilingDb=number((r.master.ceilingDb===undefined?-1:r.master.ceilingDb),-60,0,'rack ceiling dB');
  return {recipe:r,order:active};
}
function validateAudio(audio){
  if(!audio||!Array.isArray(audio.channels)||!audio.channels.length||audio.channels.length>32)fail('Expected 1–32 PCM channels');
  number(audio.sampleRate,8000,192000,'sample rate');if(!Number.isInteger(audio.sampleRate))fail('Sample rate must be an integer');
  const len=audio.channels[0].length;if(!len)fail('Audio is empty');
  for(const c of audio.channels){if(!(c instanceof Float32Array)||c.length!==len)fail('PCM channels must have equal lengths');for(const x of c)if(!Number.isFinite(x))fail('PCM contains non-finite samples');}
}
function measure(channels){
  let peak=0,energy=0,count=0;
  for(const c of channels)for(const x of c){if(!Number.isFinite(x))fail('Render produced non-finite audio');peak=Math.max(peak,Math.abs(x));energy+=x*x;count++;}
  return {peak,rms:Math.sqrt(energy/count)};
}
function* renderSteps(audio,recipe){
  yield {phase:'validate',completed:0,total:0};
  validateAudio(audio);const plan=validate(recipe),cache=new Map([['source',audio.channels]]),stages=[];
  let completed=0;
  for(const n of plan.order){
    yield {phase:'cell',id:n.id,completed,total:plan.order.length};
    let output;
    if(n.type==='sounder'){
      const input=cache.get(n.input);
      if(n.state.global.crossovers.some(x=>x>=audio.sampleRate/2))fail(`${n.id}: crossover exceeds Nyquist`);
      output=n.bypass||n.mix===0?input:DSP.create(audio.sampleRate,n.state.global).render(input,n.state);
      if(!n.bypass&&n.mix>0&&n.mix<1)output=output.map((c,k)=>Float32Array.from(c,(x,i)=>n.mix*x+(1-n.mix)*input[k][i]));
    }else{
      output=audio.channels.map(c=>new Float32Array(c.length));
      for(const p of n.inputs){const input=cache.get(p.node),g=10**(p.gainDb/20);
        for(let c=0;c<output.length;c++)for(let i=0;i<output[c].length;i++)output[c][i]+=input[c][i]*g;}
    }
    stages.push({id:n.id,type:n.type,...measure(output)});cache.set(n.id,output);
    completed++;
  }
  yield {phase:'master',completed,total:plan.order.length};
  const g=10**(plan.recipe.master.makeupDb/20),ceiling=10**(plan.recipe.master.ceilingDb/20);
  let limitedSamples=0;
  const channels=cache.get(plan.recipe.output).map(c=>Float32Array.from(c,x=>{
    const y=x*g;if(Math.abs(y)>ceiling)limitedSamples++;return Math.max(-ceiling,Math.min(ceiling,y));
  }));
  return {channels,sampleRate:audio.sampleRate,cache,report:{format:'hindcasts-render-report',version:1,
    sampleRate:audio.sampleRate,frames:channels[0].length,channels:channels.length,stages,
    limitedSamples,output:measure(channels),master:plan.recipe.master}};
}
function render(audio,recipe){const steps=renderSteps(audio,recipe);let step=steps.next();while(!step.done)step=steps.next();return step.value;}
function chain(states){
  return {format:'hindcasts-rack',version:1,nodes:states.map((state,i)=>({id:`sounder${i+1}`,type:'sounder',input:i?`sounder${i}`:'source',state})),
    output:`sounder${states.length}`,master:{makeupDb:0,ceilingDb:-1}};
}
return {defaultState,validateState,validate,validateAudio,renderSteps,render,chain};
});
