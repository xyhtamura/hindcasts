/* Recording and processed-stage previews; peaks retain every channel's extrema. */
window.SounderWaveforms=class{
 constructor({player,seek}){
  this.player=player;this.seek=seek;this.peaks={in:null,out:null};
  this.canvases={in:document.getElementById('wave-in'),out:document.getElementById('wave-out')};
  this.cache={in:document.createElement('canvas'),out:document.createElement('canvas')};
  for(const [which,canvas] of Object.entries(this.canvases)){
   canvas.addEventListener('pointerdown',e=>{if(!this.peaks[which])return;canvas.setPointerCapture(e.pointerId);this.drag=which;this.seekAt(which,e);});
   canvas.addEventListener('pointermove',e=>{if(this.drag===which)this.seekAt(which,e);});
   for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{this.drag=null;});
  }
  new ResizeObserver(()=>this.resize()).observe(this.canvases.in);
  player.addEventListener('play',()=>this.animate());
  for(const event of ['pause','ended','timeupdate','loadedmetadata','emptied'])player.addEventListener(event,()=>this.draw());
 }
 seekAt(which,e){const r=this.canvases[which].getBoundingClientRect();this.seek(which,Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)));}
 set(which,channels,label){
  if(which==='out')document.getElementById('wave-output-label').textContent=label||'Rack output';
  if(this.channels?.[which]===channels)return;
  this.channels??={};this.channels[which]=channels;
  const row=document.getElementById('row-'+which);row.classList.toggle('empty',!channels);
  if(which==='in')document.getElementById('wave-load').hidden=!!channels;
  else{document.getElementById('wave-output-empty').hidden=!!channels;document.getElementById('wave-output-label').textContent=label||'Rack output';}
  this.peaks[which]=null;
  if(channels){
   const frames=channels[0].length,bins=Math.min(2048,frames),min=new Float32Array(bins).fill(Infinity),max=new Float32Array(bins).fill(-Infinity);
   for(let i=0;i<frames;i++){const b=Math.min(bins-1,Math.floor(i*bins/frames));for(const channel of channels){const v=channel[i];if(v<min[b])min[b]=v;if(v>max[b])max[b]=v;}}
   this.peaks[which]={min,max,bins};
  }
  this.resize();
 }
 resize(){
  for(const [which,canvas] of Object.entries(this.canvases)){
   const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),width=Math.max(1,Math.round(r.width*dpr)),height=Math.max(1,Math.round(r.height*dpr));
   canvas.width=width;canvas.height=height;const cache=this.cache[which];cache.width=width;cache.height=height;const ctx=cache.getContext('2d');
   ctx.strokeStyle='#7caf9f33';ctx.beginPath();ctx.moveTo(0,height/2);ctx.lineTo(width,height/2);ctx.stroke();
   const peaks=this.peaks[which];if(!peaks)continue;
   for(let x=0;x<width;x++){
    const b=Math.min(peaks.bins-1,Math.floor(x*peaks.bins/width)),low=peaks.min[b],high=peaks.max[b];
    ctx.fillStyle=low<-1||high>1?'#ffb347':which==='in'?'#54f0c6':'#ff3145';
    const top=height/2-Math.min(1.2,high)*height*.4,bottom=height/2-Math.max(-1.2,low)*height*.4;
    ctx.fillRect(x,top,1,Math.max(1,bottom-top));
   }
  }
  this.draw();
 }
 draw(){
  const fraction=Number.isFinite(this.player.duration)&&this.player.duration>0?this.player.currentTime/this.player.duration:0;
  for(const [which,canvas] of Object.entries(this.canvases)){
   const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(this.cache[which],0,0);
   if(!this.peaks[which])continue;
   ctx.strokeStyle='#d3efe1';ctx.beginPath();ctx.moveTo(fraction*canvas.width,0);ctx.lineTo(fraction*canvas.width,canvas.height);ctx.stroke();
  }
 }
 animate(){cancelAnimationFrame(this.raf);const tick=()=>{this.draw();if(!this.player.paused)this.raf=requestAnimationFrame(tick);};tick();}
};
