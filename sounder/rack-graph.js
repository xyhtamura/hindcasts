/* SVG patch surface. Routing is committed only after core graph validation. */
window.SounderGraph=class{
 constructor(svg,{getRecipe,select,change,move,status}){Object.assign(this,{svg,getRecipe,select,change,move,status});this.pending=null;this.drag=null;this.zoom=1;
  svg.addEventListener('pointermove',e=>{if(!this.drag)return;const p=this.point(e);this.move(this.drag.id,{x:Math.min(10000,Math.max(0,p.x-this.drag.dx)),y:Math.min(10000,Math.max(0,p.y-this.drag.dy))});this.draw();});
  svg.addEventListener('pointerup',()=>{this.drag=null;});svg.addEventListener('pointercancel',()=>{this.drag=null;});
 }
 point(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform(this.svg.getScreenCTM().inverse());}
 element(tag,attrs,text){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs||{}))e.setAttribute(k,v);if(text)e.textContent=text;return e;}
 draw(selected,busy){this.selected=selected??this.selected;this.busy=busy??this.busy;const r=this.getRecipe(),positions=r.layout?.positions||{},ids=['source',...r.nodes.map(n=>n.id),'__output'];this.svg.replaceChildren();
  const pos=id=>Object.hasOwn(positions,id)?positions[id]:{x:30+(ids.indexOf(id)%4)*230,y:30+Math.floor(ids.indexOf(id)/4)*160};
  const width=Math.max(980,...ids.map(id=>pos(id).x+220)),height=Math.max(370,...ids.map(id=>pos(id).y+130));this.svg.setAttribute('viewBox',`0 0 ${width} ${height}`);this.svg.style.width=width*this.zoom+'px';this.svg.style.height=height*this.zoom+'px';
  const edges=[];for(const n of r.nodes)for(const source of n.type==='mix'?n.inputs.map(p=>p.node):[n.input])edges.push([source,n.id]);edges.push([r.output,'__output']);
  for(const [a,b] of edges){const pa=pos(a),pb=pos(b);this.svg.append(this.element('path',{d:`M ${pa.x+180} ${pa.y+64} C ${pa.x+240} ${pa.y+64}, ${pb.x-60} ${pb.y+64}, ${pb.x} ${pb.y+64}`,class:'wire'}));}
  for(const id of ids){const p=pos(id),n=r.nodes.find(n=>n.id===id),g=this.element('g',{transform:`translate(${p.x},${p.y})`,'data-node':id,class:'patch-node'+(id===this.selected?' selected':'')});
    g.append(this.element('rect',{width:180,height:110,rx:10}),this.element('text',{x:16,y:30},id==='source'?'Recording':id==='__output'?'Rack output':n.label||n.id),this.element('text',{x:16,y:52,class:'node-type'},n?.type||'audio'));
    const title=g.querySelector('text');title.setAttribute('tabindex','0');title.setAttribute('role','button');title.setAttribute('aria-label',`Select ${id}`);title.addEventListener('click',()=>{if(!this.busy)this.select(id);});title.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!this.busy){e.preventDefault();this.select(id);}});
    g.querySelector('rect').addEventListener('pointerdown',e=>{if(this.busy)return;const at=this.point(e);this.drag={id,dx:at.x-p.x,dy:at.y-p.y};this.svg.setPointerCapture(e.pointerId);this.select(id);});
    for(const port of id==='source'?['out']:id==='__output'?['in']:['in','out']){const dot=this.element('circle',{cx:port==='in'?0:180,cy:64,r:8,tabindex:0,role:'button','aria-label':`${port==='in'?'Input':'Output'} ${id}`,class:'port'+(this.pending===id&&port==='out'?' active':'')});const activate=()=>{if(this.busy)return;if(port==='out'){this.pending=id;this.status('Choose an input port to connect.');this.draw();}else if(this.pending){const from=this.pending;this.pending=null;this.change(from,id);this.draw();}};dot.addEventListener('click',activate);dot.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});g.append(dot);}
    this.svg.append(g);
  }
 }
};
