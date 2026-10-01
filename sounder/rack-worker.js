/* One job per Worker. Termination cancels even a synchronous DSP loop. */
'use strict';
importScripts('engine.js','rack.js');
function render(audio,recipe){
  const steps=HindcastsRack.renderSteps(audio,recipe);let step=steps.next();
  while(!step.done){postMessage({type:'progress',...step.value});step=steps.next();}
  return step.value;
}
onmessage=e=>{
  try{
    const {kind,audio,recipe,cellId,bandIndex}=e.data;
    let result;
    if(kind==='render')result=render(audio,recipe);
    else if(kind==='analyse'){
      HindcastsRack.validateAudio(audio);
      const r=HindcastsRack.validate(recipe).recipe,index=r.nodes.findIndex(n=>n.id===cellId),cell=r.nodes[index];
      if(!cell||cell.type!=='sounder'||!Number.isInteger(bandIndex)||!cell.state.bands[bandIndex])throw Error('Invalid analysis cell or band');
      let channels=audio.channels;
      if(cell.input!=='source'){
        // The core resolves output ancestors; unrelated cells are not rendered.
        channels=render(audio,{...r,output:cell.input}).cache.get(cell.input);
      }
      const engine=SounderDSP.create(audio.sampleRate,cell.state.global),xo=engine.crossoverBins();
      if(cell.state.global.crossovers.some(x=>x>=audio.sampleRate/2))throw Error('Analysis crossover exceeds Nyquist');
      postMessage({type:'progress',phase:'histogram',completed:0,total:1});
      if(xo.length){const mask=engine.buildMasks(xo)[bandIndex];channels=channels.map(c=>engine.splitBand(c,mask));}
      const band=cell.state.bands[bandIndex];result=engine.analyseChannels(channels,band.tauMs,band.floorDb);
    }else throw Error(`Unsupported Worker job: ${kind}`);
    const buffers=new Set();
    function collect(value){if(ArrayBuffer.isView(value)){buffers.add(value.buffer);return;}
      if(value instanceof Map){for(const v of value.values())collect(v);}
      else if(value&&typeof value==='object')for(const v of Object.values(value))collect(v);}
    collect(result);postMessage({type:'result',result},[...buffers]);
  }catch(err){postMessage({type:'error',message:err.message||String(err)});}
};
