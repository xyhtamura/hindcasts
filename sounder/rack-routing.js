/* Form-based routing editor. Apply changes through the host's graph validator. */
window.SounderRouting=class{
 constructor({getRecipe,commit}){
  Object.assign(this,{getRecipe,commit});
  this.dialog=document.getElementById('routing-dialog');
  this.form=document.getElementById('routing-form');
  this.inputs=document.getElementById('routing-inputs');
  this.outputs=document.getElementById('routing-outputs');
  this.error=document.getElementById('routing-error');
  this.form.addEventListener('submit',e=>{e.preventDefault();this.apply();});
  document.getElementById('routing-close').onclick=()=>this.dialog.close();
 }
 name(id){const n=this.getRecipe().nodes.find(n=>n.id===id);return id==='source'?'Recording':id==='__output'?'Rack output':n?.label?`${n.label} (${id})`:id;}
 sourceSelect(value,label){
  const select=document.createElement('select');select.setAttribute('aria-label',label);
  for(const id of ['source',...this.getRecipe().nodes.map(n=>n.id)].filter(id=>id!==this.id)){
   const option=document.createElement('option');option.value=id;option.textContent=this.name(id);select.append(option);
  }
  select.value=value;select.required=true;return select;
 }
 mixerRow(input){
  const row=document.createElement('div');row.className='routing-input-row';
  row.append(this.sourceSelect(input.node,'Input source'));
  const label=document.createElement('label');label.textContent='Gain (dB) ';
  const gain=document.createElement('input');gain.type='number';gain.min=-120;gain.max=36;gain.step='any';gain.required=true;gain.value=input.gainDb;
  label.append(gain);row.append(label);
  const remove=document.createElement('button');remove.type='button';remove.textContent='Remove input';remove.onclick=()=>{row.remove();this.updateRemove();};row.append(remove);this.inputs.insertBefore(row,this.inputs.querySelector('.routing-add'));this.updateRemove();
 }
 updateRemove(){const rows=[...this.inputs.querySelectorAll('.routing-input-row')];for(const row of rows)row.querySelector('button').disabled=rows.length===1;}
 open(id){
  const cell=this.getRecipe().nodes.find(n=>n.id===id);if(!cell)return;
  this.id=id;this.error.textContent='';this.inputs.replaceChildren();this.outputs.replaceChildren();
  document.getElementById('routing-title').textContent=`Routing: ${this.name(id)}`;
  if(cell.type==='mix'){
   cell.inputs.forEach(p=>this.mixerRow(p));
   const add=document.createElement('button');add.type='button';add.className='routing-add';add.textContent='Add input';add.onclick=()=>this.mixerRow({node:'source',gainDb:0});this.inputs.append(add);
  }else{const label=document.createElement('label');label.textContent='Input source ';label.append(this.sourceSelect(cell.input,'Input source'));this.inputs.append(label);}
  for(const target of [...this.getRecipe().nodes.filter(n=>n.id!==id),{id:'__output'}]){
   const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.dataset.target=target.id;
   check.checked=target.id==='__output'?this.getRecipe().output===id:target.type==='mix'?target.inputs.some(p=>p.node===id):target.input===id;
   label.append(check,` ${this.name(target.id)}`);this.outputs.append(label);
  }
  this.dialog.showModal();
 }
 apply(){
  try{
   // Copy the latest effect values: opening this dialog never snapshots DSP settings.
   const next=structuredClone(this.getRecipe()),cell=next.nodes.find(n=>n.id===this.id);
   if(cell.type==='mix')cell.inputs=[...this.inputs.querySelectorAll('.routing-input-row')].map(row=>({node:row.querySelector('select').value,gainDb:+row.querySelector('input').value}));
   else cell.input=this.inputs.querySelector('select').value;
   for(const check of this.outputs.querySelectorAll('input')){
    const id=check.dataset.target;
    if(id==='__output'){if(check.checked)next.output=this.id;else if(next.output===this.id)next.output='source';continue;}
    const target=next.nodes.find(n=>n.id===id);
    if(target.type==='mix'){
     if(check.checked){if(!target.inputs.some(p=>p.node===this.id))target.inputs.push({node:this.id,gainDb:0});}
     else target.inputs=target.inputs.filter(p=>p.node!==this.id);
    }else if(check.checked)target.input=this.id;
    else if(target.input===this.id)target.input='source';
   }
   HindcastsRack.validate(next);
   if(this.commit(next))this.dialog.close();
  }catch(e){this.error.textContent=e.message;}
 }
};
