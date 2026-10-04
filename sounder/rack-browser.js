/* Browser host; recipes use the same validated graph as the CLI. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),Rack=HindcastsRack;
let recipe=Rack.chain([Rack.defaultState()]),selected=recipe.nodes[0].id,audio=null,result=null,editorReady=false,serial=1,objectURL=null;
let revision=0,editorGeneration=0,busy=false;
let renderJob=null,analysisJob=null,analysisTimer=null,analysisSequence=0,selectedBand=0;
let graph=null,routing=null,graphView=false,chartFocus=null,focusScroll=0;
const bandSelections=new Map(),focusInert=new Map();
const status=t=>{$('status').textContent=t;};
function sourceAudio(buffer){return {sampleRate:buffer.sampleRate,channels:Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i))};}
function wire(){recipe.nodes.forEach((n,i)=>n.input=i?recipe.nodes[i-1].id:'source');recipe.output=recipe.nodes.at(-1)?.id||'source';}
function invalidate(){revision++;result=null;cancelAnalysis();scheduleAnalysis();$('stage').disabled=true;$('export').disabled=true;$('player').pause();$('player').removeAttribute('src');$('player').load();if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null;}status('Rack changed. Process to audition or export.');}
function acceptRecipe(value){return Rack.validate(value).recipe;}
function isSerial(){return recipe.nodes.every((n,i)=>n.type==='sounder'&&n.input===(i?recipe.nodes[i-1].id:'source'))&&recipe.output===recipe.nodes.at(-1)?.id;}
function commit(next){try{recipe=Rack.validate(next).recipe;invalidate();drawCells();syncEditor();return true;}catch(e){status(e.message);return false;}}
function connect(from,to){const next=structuredClone(recipe);if(to==='__output')next.output=from;else{const n=next.nodes.find(n=>n.id===to);if(n.type==='mix'){if(!n.inputs.some(p=>p.node===from))n.inputs.push({node:from,gainDb:0});}else n.input=from;}commit(next);}
function removeNode(id){const next=structuredClone(recipe),removed=next.nodes.find(n=>n.id===id),upstream=removed.input||'source';next.nodes=next.nodes.filter(n=>n.id!==id);for(const n of next.nodes){if(n.type==='mix')n.inputs.forEach(p=>{if(p.node===id)p.node=upstream;});else if(n.input===id)n.input=upstream;}if(next.output===id)next.output=upstream;if(next.layout)delete next.layout.positions[id];selected=next.nodes[0]?.id;commit(next);}
function drawCells(){
  $('cells').replaceChildren();
  recipe.nodes.forEach((n,i)=>{
    const card=document.createElement('div');card.className='cell'+(selected===n.id?' selected':'');card.dataset.id=n.id;
    const choose=document.createElement('button');choose.textContent=n.label||(n.type==='mix'?n.id:`Sounder ${i+1}`);choose.setAttribute('aria-pressed',String(n.id===selected));choose.disabled=busy;choose.onclick=()=>select(n.id);card.append(choose);
    const kind=document.createElement('small');kind.textContent=n.type==='mix'?'Mixer':'Sounder';card.append(kind);
    const routingRow=document.createElement('div'),route=document.createElement('button');routingRow.className='cell-routing';route.textContent='Routing';route.disabled=busy;route.onclick=()=>routing.open(n.id);routingRow.append(route);card.append(routingRow);$('cells').append(card);
  });
  drawActions();
  for(const [id,node] of [['source-select','source'],['master-select','__output']])$(id).setAttribute('aria-pressed',String(selected===node));
  $('output-node').replaceChildren();for(const id of ['source',...recipe.nodes.map(n=>n.id)]){const o=document.createElement('option');o.value=id;o.textContent=id;$('output-node').append(o);}$('output-node').value=recipe.output;
  graph?.draw(selected,busy);
}
function drawActions(){
  const controls=$('cell-actions');controls.replaceChildren();const i=recipe.nodes.findIndex(n=>n.id===selected),n=recipe.nodes[i];if(!n)return;
  const actions=document.createElement('div');actions.className='actions';
  const options=n.type==='mix'?[['Remove',()=>removeNode(n.id),recipe.nodes.length===1]]:[
    ['Duplicate',()=>{const linear=isSerial(),clone=structuredClone(n);clone.id=newId();clone.label=(n.label||'Sounder')+' copy';recipe.nodes.splice(i+1,0,clone);selected=clone.id;if(linear)wire();invalidate();drawCells();syncEditor();},false],
    ['Remove',()=>removeNode(n.id),recipe.nodes.length===1],
    ['Up',()=>reorder(i,i-1),i===0||!isSerial()],['Down',()=>reorder(i,i+1),i===recipe.nodes.length-1||!isSerial()]
  ];
  for(const [text,action,disabled] of options){const button=document.createElement('button');button.textContent=text;button.disabled=disabled||busy;button.onclick=action;actions.append(button);}controls.append(actions);
  if(n.type==='mix')return;
  const bypass=document.createElement('input');bypass.type='checkbox';bypass.checked=!!n.bypass;bypass.disabled=busy;bypass.onchange=()=>{n.bypass=bypass.checked;invalidate();syncEditor();};const label=document.createElement('label');label.append(bypass,' Bypass');controls.append(label);
  const mix=document.createElement('input');mix.type='number';mix.min=0;mix.max=1;mix.step=.05;mix.value=n.mix??1;mix.disabled=busy;mix.onchange=()=>{if(!mix.checkValidity()||mix.value===''){mix.value=n.mix??1;return;}n.mix=+mix.value;invalidate();syncEditor();};const ml=document.createElement('label');ml.append('Cell mix ',mix);controls.append(ml);
}
function reorder(a,b){[recipe.nodes[a],recipe.nodes[b]]=[recipe.nodes[b],recipe.nodes[a]];wire();invalidate();drawCells();syncEditor();}
function newId(){let id;do{id=`sounder${++serial}`;}while(recipe.nodes.some(n=>n.id===id));return id;}
function select(id){if(busy)return;selected=id;drawCells();syncEditor();}
function syncEditor(){
  if(!editorReady)return;
  const cell=recipe.nodes.find(n=>n.id===selected);
  $('master-home').append(document.querySelector('.master'));
  $('routing-open').hidden=!cell;
  $('node-name').hidden=!cell;$('endpoint-controls').hidden=!!cell;
  if(!cell){cancelAnalysis();editorGeneration++;$('editor').hidden=true;$('mixer-controls').hidden=true;
    $('selected').textContent=selected==='source'?'Recording':'Rack output';
    $('upstream').textContent=selected==='source'?(audio?`${audio.channels.length} channels, ${audio.sampleRate} Hz, ${audio.channels[0].length} frames.`:'Load a recording using the file control above.'):'Final gain and sample ceiling follow the connected node.';
    if(selected==='__output')$('endpoint-controls').append(document.querySelector('.master'));
    return;
  }
  cancelAnalysis();selectedBand=bandSelections.get(selected)||0;
  $('node-label').value=cell.label||cell.id;
  $('editor').hidden=cell.type==='mix';$('mixer-controls').hidden=cell.type!=='mix';
  if(cell.type==='mix'){drawMixer(cell);$('selected').textContent=cell.id+' controls';$('upstream').textContent='Mixer sums its inputs without normalization.';return;}
  $('selected').textContent=`${cell.label||cell.id} controls`;
  $('upstream').textContent=audio?'Preparing upstream histogram…':'Histogram input: load a recording';
  editorGeneration++;
  $('editor').contentWindow.postMessage({type:'sounder-cell',cellId:selected,generation:editorGeneration,state:cell.state,bandIndex:selectedBand,sampleRate:audio?.sampleRate},'*');
}
function cancelAnalysis(){clearTimeout(analysisTimer);analysisSequence++;analysisJob?.cancel();analysisJob=null;}
function sendAnalysis(analysis,generation=editorGeneration,cellId=selected,bandIndex=selectedBand){$('editor').contentWindow.postMessage({type:'sounder-analysis',generation,cellId,bandIndex,analysis},'*');}
function scheduleAnalysis(){clearTimeout(analysisTimer);analysisTimer=setTimeout(analyse,80);}
async function analyse(){
  cancelAnalysis();sendAnalysis(null);
  if(!audio||busy||!editorReady||recipe.nodes.find(n=>n.id===selected)?.type!=='sounder')return;
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
  if(e.data?.type==='sounder-focus')setChartFocus(e.data.chart);
  if(e.data?.type==='sounder-size'&&Number.isFinite(e.data.height)&&!chartFocus)$('editor').style.height=`${Math.max(400,e.data.height)}px`;
  if(e.data?.type==='sounder-ready'){editorReady=true;syncEditor();}
  if(e.data?.type==='sounder-cell-ready'&&e.data.generation===editorGeneration){$('editor').dataset.cell=e.data.cellId;selectedBand=e.data.bandIndex;bandSelections.set(selected,selectedBand);scheduleAnalysis();}
  if(e.data?.type==='sounder-analyse'&&e.data.generation===editorGeneration&&e.data.cellId===selected){selectedBand=e.data.bandIndex;bandSelections.set(selected,selectedBand);scheduleAnalysis();}
  if(e.data?.type==='sounder-edit'&&!busy&&e.data.cellId===selected&&e.data.generation===editorGeneration){
    try{const cell=recipe.nodes.find(n=>n.id===selected);cell.state=Rack.validateState(e.data.state);invalidate();}
    catch(err){status(err.message);}
  }
});
$('add').onclick=()=>{if(busy)return;const linear=isSerial(),n={id:newId(),type:'sounder',input:selected==='__output'?recipe.output:selected||'source',state:Rack.defaultState()};recipe.nodes.push(n);selected=n.id;if(linear)wire();else recipe.output=n.id;invalidate();drawCells();syncEditor();};
$('add-mixer').onclick=()=>{const next=structuredClone(recipe),id=newId().replace('sounder','mixer');next.nodes.push({id,type:'mix',inputs:[{node:selected==='__output'?recipe.output:selected||'source',gainDb:0}]});next.output=id;selected=id;commit(next);};
$('output-node').onchange=e=>connect(e.target.value,'__output');
$('node-label').onchange=e=>{const n=recipe.nodes.find(n=>n.id===selected);if(!n)return;n.label=e.target.value.trim()||selected;
  const title=$('graph').querySelector(`[data-node="${selected}"] text`);if(title)title.textContent=n.label;
  const button=$('cells').querySelector(`[data-id="${selected}"] > button`);if(button)button.textContent=n.label;
  $('selected').textContent=n.label+' controls';const option=[...$('stage').options].find(o=>o.value===selected);if(option)option.textContent=n.label;};
function drawMixer(cell){$('mixer-controls').replaceChildren();cell.inputs.forEach((p,i)=>{const row=document.createElement('div'),label=document.createElement('label');label.textContent=p.node+' gain (dB) ';const gain=document.createElement('input');gain.type='number';gain.min=-120;gain.max=36;gain.step=.5;gain.value=p.gainDb;gain.onchange=()=>{if(!gain.checkValidity()||gain.value==='')return;recipe.nodes.find(n=>n.id===cell.id).inputs[i].gainDb=+gain.value;invalidate();};label.append(gain);row.append(label);const remove=document.createElement('button');remove.textContent='Disconnect '+p.node;remove.disabled=cell.inputs.length===1;remove.onclick=()=>{const next=structuredClone(recipe);next.nodes.find(n=>n.id===cell.id).inputs.splice(i,1);commit(next);};row.append(remove);$('mixer-controls').append(row);});}
function setView(value){graphView=value;document.body.classList.toggle('effect-view',!value);$('patch').hidden=!value;$('view').textContent=value?'Hide rack':'Show rack';$('view').setAttribute('aria-expanded',String(value));
}
$('view').onclick=()=>setView(!graphView);
$('source-select').onclick=()=>select('source');$('master-select').onclick=()=>select('__output');
function setChartFocus(chart){
  const next=['depth','crossover'].includes(chart)?chart:null;if(next===chartFocus)return;
  if(next&&!chartFocus){focusScroll=scrollY;const editor=document.querySelector('.editor');
    for(const el of [...document.body.children,...document.querySelector('main').children]){if(el===editor||el.contains(editor)||['SCRIPT','STYLE'].includes(el.tagName))continue;focusInert.set(el,el.inert);el.inert=true;}
  }
  if(!next){for(const [el,value] of focusInert)el.inert=value;focusInert.clear();}
  chartFocus=next;document.body.classList.toggle('chart-focus',!!next);$('focus-return').hidden=!next;
  if(!next){scrollTo(0,focusScroll);$('editor').contentWindow.postMessage({type:'sounder-focus-exit'},'*');}
}
$('focus-return').onclick=()=>setChartFocus(null);
addEventListener('keydown',e=>{if(e.key==='Escape'&&chartFocus){e.preventDefault();setChartFocus(null);}});

$('load').onclick=()=>$('recipe-file').click();
$('recipe-file').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const next=acceptRecipe(JSON.parse(await f.text()));recipe=next;bandSelections.clear();
    selected=recipe.nodes[0]?.id||'__output';invalidate();drawCells();syncMaster();syncEditor();if(recipe.nodes.length>1||!isSerial())setView(true);status('Rack loaded. Process to audition.');
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
function setBusy(value){busy=value;$('editor').inert=value;$('mixer-controls').inert=value;$('node-label').disabled=value;$('cancel').disabled=!value;$('progress').hidden=!value;for(const id of ['process','add','add-mixer','output-node','load','save','recording','master-gain','master-ceiling','routing-open','source-select','master-select'])$(id).disabled=value||(id==='process'&&!audio);drawCells();}
$('process').onclick=async()=>{
  if(!audio||busy)return;cancelAnalysis();setBusy(true);$('stage').disabled=true;$('export').disabled=true;status('Processing rack…');$('progress').removeAttribute('value');
  const job=HindcastsRackJobs.start({kind:'render',audio,recipe},p=>{
    if(p.total){$('progress').max=p.total;$('progress').value=p.completed;}
    status(p.phase==='cell'?`Processing ${p.id} (${p.completed+1}/${p.total})…`:p.phase==='master'?'Applying rack output gain and ceiling…':'Checking recording and recipe…');
  });renderJob=job;
  try{result=await job.promise;
    $('stage').replaceChildren();for(const [value,text] of [['source','Recording'],...recipe.nodes.filter(n=>result.cache.has(n.id)).map(n=>[n.id,n.label||n.id]),['__rack_output','Rack output']]){const o=document.createElement('option');o.value=value;o.textContent=text;$('stage').append(o);}
    $('stage').value='__rack_output';$('stage').disabled=false;$('export').disabled=false;audition();
    status(`Processed ${result.report.stages.length} cells. ${result.report.limitedSamples} samples limited at the rack ceiling.`);
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
routing=new SounderRouting({getRecipe:()=>recipe,commit});
$('routing-open').onclick=()=>{if(!busy)routing.open(selected);};
graph=new SounderGraph($('graph'),{getRecipe:()=>recipe,select,change:connect,status,move:(id,p)=>{recipe.layout??={positions:{}};recipe.layout.positions[id]=p;}});
$('zoom-in').onclick=()=>{graph.zoom=Math.min(2,graph.zoom+.25);graph.draw();};$('zoom-out').onclick=()=>{graph.zoom=Math.max(.25,graph.zoom-.25);graph.draw();};
drawCells();syncMaster();setView(new URLSearchParams(location.search).get('view')==='rack');
const handshake=()=>$('editor').contentWindow.postMessage({type:'sounder-connect'},'*');
$('editor').addEventListener('load',handshake);handshake();
})();

