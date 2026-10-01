/* Serial browser host; recipes use the same validated graph as the CLI. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),Rack=HindcastsRack;
let recipe=Rack.chain([Rack.defaultState()]),selected=recipe.nodes[0].id,audio=null,result=null,editorReady=false,serial=1,objectURL=null;
let revision=0,editorGeneration=0,busy=false;
let renderJob=null,analysisJob=null,analysisTimer=null,analysisSequence=0,selectedBand=0;
const status=t=>{$('status').textContent=t;};
function sourceAudio(buffer){return {sampleRate:buffer.sampleRate,channels:Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i))};}
function wire(){recipe.nodes.forEach((n,i)=>n.input=i?recipe.nodes[i-1].id:'source');recipe.output=recipe.nodes.at(-1)?.id||'source';}
function invalidate(){revision++;result=null;cancelAnalysis();scheduleAnalysis();$('stage').disabled=true;$('export').disabled=true;$('player').pause();$('player').removeAttribute('src');$('player').load();if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null;}status('Rack changed. Process to audition or export.');}
function acceptRecipe(value){
  const checked=Rack.validate(value).recipe;
  if(checked.nodes.some((n,i)=>n.type!=='sounder'||n.input!==(i?checked.nodes[i-1].id:'source'))||checked.output!==(checked.nodes.at(-1)?.id||'source'))
    throw Error('Browser editor accepts serial Sounder chains only. Use the command-line runner for branched recipes.');
  return checked;
}
function drawCells(){
  $('cells').replaceChildren();
  recipe.nodes.forEach((n,i)=>{
    const card=document.createElement('div');card.className='cell'+(selected===n.id?' selected':'');card.dataset.id=n.id;
    const choose=document.createElement('button');choose.textContent=n.label||`Sounder ${i+1}`;choose.setAttribute('aria-pressed',String(n.id===selected));choose.onclick=()=>select(n.id);card.append(choose);
    const actions=document.createElement('div');actions.className='actions';
    for(const [text,action,disabled] of [
      ['Duplicate',()=>{const clone=structuredClone(n);clone.id=newId();clone.label=(n.label||'Sounder')+' copy';recipe.nodes.splice(i+1,0,clone);selected=clone.id;},false],
      ['Remove',()=>{recipe.nodes.splice(i,1);selected=recipe.nodes[Math.min(i,recipe.nodes.length-1)]?.id||null;},recipe.nodes.length===1],
      ['Up',()=>{[recipe.nodes[i-1],recipe.nodes[i]]=[n,recipe.nodes[i-1]];},i===0],
      ['Down',()=>{[recipe.nodes[i+1],recipe.nodes[i]]=[n,recipe.nodes[i+1]];},i===recipe.nodes.length-1]
    ]){const b=document.createElement('button');b.textContent=text;b.disabled=disabled||busy;b.onclick=()=>{action();wire();invalidate();drawCells();syncEditor();};actions.append(b);}card.append(actions);
    const bypass=document.createElement('input');bypass.type='checkbox';bypass.checked=!!n.bypass;bypass.disabled=busy;
    bypass.onchange=()=>{n.bypass=bypass.checked;invalidate();syncEditor();};const bl=document.createElement('label');bl.append(bypass,' Bypass');card.append(bl);
    const mix=document.createElement('input');mix.type='number';mix.min=0;mix.max=1;mix.step=.05;mix.value=n.mix??1;mix.disabled=busy;
    mix.onchange=()=>{if(!mix.checkValidity()||mix.value===''){mix.value=n.mix??1;return;}n.mix=+mix.value;invalidate();syncEditor();};const ml=document.createElement('label');ml.append('Cell mix ',mix);card.append(ml);
    $('cells').append(card);
  });
}
function newId(){let id;do{id=`sounder${++serial}`;}while(recipe.nodes.some(n=>n.id===id));return id;}
function select(id){if(busy)return;selected=id;drawCells();syncEditor();}
function syncEditor(){
  if(!editorReady)return;
  const cell=recipe.nodes.find(n=>n.id===selected);if(!cell)return;
  cancelAnalysis();selectedBand=0;
  $('selected').textContent=`${cell.label||cell.id} controls`;
  $('upstream').textContent=audio?'Preparing upstream histogram…':'Histogram input: load a recording';
  editorGeneration++;
  $('editor').contentWindow.postMessage({type:'sounder-cell',cellId:selected,generation:editorGeneration,state:cell.state,sampleRate:audio?.sampleRate},'*');
}
function cancelAnalysis(){clearTimeout(analysisTimer);analysisSequence++;analysisJob?.cancel();analysisJob=null;}
function sendAnalysis(analysis,generation=editorGeneration,cellId=selected,bandIndex=selectedBand){$('editor').contentWindow.postMessage({type:'sounder-analysis',generation,cellId,bandIndex,analysis},'*');}
function scheduleAnalysis(){clearTimeout(analysisTimer);analysisTimer=setTimeout(analyse,80);}
async function analyse(){
  cancelAnalysis();sendAnalysis(null);
  if(!audio||busy||!editorReady)return;
  const ticket=analysisSequence,rev=revision,generation=editorGeneration,cellId=selected,bandIndex=selectedBand;
  const job=HindcastsRackJobs.start({kind:'analyse',audio,recipe,cellId,bandIndex});analysisJob=job;
  $('upstream').textContent='Preparing upstream histogram…';
  try{const analysis=await job.promise;
    if(ticket!==analysisSequence||rev!==revision||generation!==editorGeneration)return;
    sendAnalysis(analysis,generation,cellId,bandIndex);const cell=recipe.nodes.find(n=>n.id===cellId);
    $('upstream').textContent=`Histogram input: ${cell.input==='source'?'recording':cell.input}`;
  }catch(e){if(e.name!=='AbortError'&&ticket===analysisSequence)$('upstream').textContent=`Histogram unavailable: ${e.message}`;}
  finally{if(analysisJob===job)analysisJob=null;}
}
addEventListener('message',e=>{
  if(e.source!==$('editor').contentWindow)return;
  if(e.data?.type==='sounder-size'&&Number.isFinite(e.data.height))$('editor').style.height=`${Math.max(600,e.data.height)}px`;
  if(e.data?.type==='sounder-ready'){editorReady=true;syncEditor();}
  if(e.data?.type==='sounder-cell-ready'&&e.data.generation===editorGeneration){$('editor').dataset.cell=e.data.cellId;selectedBand=e.data.bandIndex;scheduleAnalysis();}
  if(e.data?.type==='sounder-analyse'&&e.data.generation===editorGeneration&&e.data.cellId===selected){selectedBand=e.data.bandIndex;scheduleAnalysis();}
  if(e.data?.type==='sounder-edit'&&!busy&&e.data.cellId===selected&&e.data.generation===editorGeneration){
    try{const cell=recipe.nodes.find(n=>n.id===selected);cell.state=Rack.validateState(e.data.state);invalidate();}
    catch(err){status(err.message);}
  }
});
$('add').onclick=()=>{if(busy)return;const n={id:newId(),type:'sounder',state:Rack.defaultState()};recipe.nodes.push(n);selected=n.id;wire();invalidate();drawCells();syncEditor();};
$('load').onclick=()=>$('recipe-file').click();
$('recipe-file').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const next=acceptRecipe(JSON.parse(await f.text()));recipe=next;
    if(!recipe.nodes.length){recipe.nodes=[{id:newId(),type:'sounder',state:Rack.defaultState()}];wire();}
    selected=recipe.nodes[0].id;invalidate();drawCells();syncMaster();syncEditor();status('Rack loaded. Process to audition.');
  }catch(err){status(`Rack not loaded: ${err.message}`);}
};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
$('save').onclick=()=>{try{const valid=Rack.validate(recipe).recipe;download(new Blob([JSON.stringify(valid,null,2)+'\n'],{type:'application/json'}),'sounder.rack.json');status('Rack saved.');}catch(e){status(e.message);}};
function syncMaster(){$('master-gain').value=recipe.master.makeupDb;$('master-ceiling').value=recipe.master.ceilingDb;}
for(const [id,key] of [['master-gain','makeupDb'],['master-ceiling','ceilingDb']])$(id).onchange=()=>{const el=$(id);if(!el.checkValidity()||el.value===''){syncMaster();return;}recipe.master[key]=+el.value;invalidate();};
const context=new (window.AudioContext||window.webkitAudioContext)();
$('recording').onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  try{const buffer=await context.decodeAudioData(await f.arrayBuffer());audio=sourceAudio(buffer);invalidate();$('process').disabled=false;syncEditor();status(`Loaded ${f.name}: ${buffer.numberOfChannels} channels, ${buffer.sampleRate} Hz. Process to audition.`);}
  catch(err){status(`Recording not loaded: ${err.message}`);}
};
function setBusy(value){busy=value;$('editor').inert=value;$('cancel').disabled=!value;$('progress').hidden=!value;for(const id of ['process','add','load','save','recording','master-gain','master-ceiling'])$(id).disabled=value||(id==='process'&&!audio);drawCells();}
$('process').onclick=async()=>{
  if(!audio||busy)return;cancelAnalysis();setBusy(true);$('stage').disabled=true;$('export').disabled=true;status('Processing rack…');$('progress').removeAttribute('value');
  const job=HindcastsRackJobs.start({kind:'render',audio,recipe},p=>{
    if(p.total){$('progress').max=p.total;$('progress').value=p.completed;}
    status(p.phase==='cell'?`Processing ${p.id} (${p.completed+1}/${p.total})…`:p.phase==='master'?'Applying rack output gain and ceiling…':'Checking recording and recipe…');
  });renderJob=job;
  try{result=await job.promise;
    $('stage').replaceChildren();for(const [value,text] of [['source','Recording'],...recipe.nodes.map(n=>[n.id,n.label||n.id]),['__rack_output','Rack output']]){const o=document.createElement('option');o.value=value;o.textContent=text;$('stage').append(o);}
    $('stage').value='__rack_output';$('stage').disabled=false;$('export').disabled=false;audition();
    status(`Processed ${recipe.nodes.length} cells. ${result.report.limitedSamples} samples limited at the rack ceiling.`);
  }catch(err){result=null;$('player').pause();$('player').removeAttribute('src');$('player').load();status(err.name==='AbortError'?'Processing cancelled. The recording and recipe are unchanged.':`Processing failed: ${err.message}`);}
  finally{if(renderJob===job)renderJob=null;setBusy(false);scheduleAnalysis();}
};
$('cancel').onclick=()=>renderJob?.cancel();
addEventListener('pagehide',()=>{renderJob?.cancel();cancelAnalysis();});
function stageChannels(){return $('stage').value==='__rack_output'?result.channels:result.cache.get($('stage').value);}
// Float32 WAV keeps intermediate samples above full scale available for inspection.
function wav(channels,rate){const frames=channels[0].length,count=channels.length,data=new ArrayBuffer(44+frames*count*4),v=new DataView(data);const str=(p,s)=>[...s].forEach((c,i)=>v.setUint8(p+i,c.charCodeAt(0)));
  str(0,'RIFF');v.setUint32(4,data.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,3,true);v.setUint16(22,count,true);v.setUint32(24,rate,true);v.setUint32(28,rate*count*4,true);v.setUint16(32,count*4,true);v.setUint16(34,32,true);str(36,'data');v.setUint32(40,data.byteLength-44,true);
  for(let i=0,p=44;i<frames;i++)for(let c=0;c<count;c++,p+=4)v.setFloat32(p,channels[c][i],true);return new Blob([data],{type:'audio/wav'});}
function audition(){if(!result)return;$('player').pause();if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(wav(stageChannels(),audio.sampleRate));$('player').src=objectURL;}
$('stage').onchange=audition;
$('export').onclick=()=>{if(result)download(wav(stageChannels(),audio.sampleRate),`sounder-${$('stage').value}.wav`);};
drawCells();syncMaster();
const connect=()=>$('editor').contentWindow.postMessage({type:'sounder-connect'},'*');
$('editor').addEventListener('load',connect);connect();
})();

