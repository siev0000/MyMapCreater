/* AA map common model v2: runtime legacy-JSON normalization. No source data mutation. */
(function(global){
'use strict';
const num=v=>typeof v==='number'&&Number.isFinite(v);
const pair=v=>Array.isArray(v)&&v.length===2&&v.every(num);
const turn=(x,y,deg)=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [x*c-y*s,x*s+y*c]};
function shape(src){
 if(Array.isArray(src.footprint)&&src.footprint.length>=3)return {kind:'polygon',vertices:src.footprint.map(p=>[...p])};
 if(src.ringDistrict||src.ringComplex)return {kind:'ring',outerRadius:src.outerRadius||src.ringComplex?.outerRadius||Math.max(src.w,src.h)/2,innerRadius:src.innerRadius||src.ringComplex?.innerRadius||0};
 return {kind:'rectangle',width:src.w,height:src.h};
}
function normalizeFloor(data){
 if(!data||!Array.isArray(data.facilities)||!Array.isArray(data.roads))throw Error('施設・道路の配列がありません');
 const nodes=[],byId=new Map(),children=new Map(),problems=[];
 function add(raw,role,parentId,x,y,geometry){
  if(!raw||typeof raw.id!=='string'||!raw.id||byId.has(raw.id))throw Error('重複または不正なID: '+raw?.id);
  if(!num(x)||!num(y))throw Error('座標が不正: '+raw.id);
  const parent=parentId?byId.get(parentId):null;if(parentId&&!parent)throw Error('親が見つかりません: '+parentId);
  const node={id:raw.id,name:raw.name||raw.id,role,
   type:role==='road'?'path':role==='district'?'district':['medium','small','internal'].includes(role)?'room':role==='macro'?'zone':'facility',
   subtype:raw.subtype||raw.type||raw.roadType||null,parentId:parentId||null,
   position:{x:x-(parent?.legacyX||0),y:y-(parent?.legacyY||0)},rotation:num(raw.rotation)?raw.rotation:0,
   geometry,properties:{sourceStatus:raw.reviewStatus||raw.status||null,locked:Boolean(raw.locked)},
   legacyX:x,legacyY:y,raw};
  nodes.push(node);byId.set(node.id,node);
  if(parentId){if(!children.has(parentId))children.set(parentId,[]);children.get(parentId).push(node)}
  return node;
 }
 const fs=new Map(data.facilities.map(f=>[f.id,f]));
 function facility(f,visiting=new Set()){
  if(byId.has(f.id))return;
  if(visiting.has(f.id))throw Error('施設の親子関係が循環: '+f.id);
  visiting.add(f.id);
  const parentId=fs.has(f.containedIn)&&f.containedIn!==f.id?f.containedIn:null;
  if(parentId&&!byId.has(parentId))facility(fs.get(parentId),visiting);
  add(f,f.mediumZones?.length||f.zoneOutline||f.ringDistrict?'district':'facility',parentId,f.x,f.y,shape(f));
  visiting.delete(f.id);
 }
 data.facilities.forEach(f=>facility(f));
 for(const f of data.facilities){
  for(const m of f.mediumZones||[]){
   add(m,'medium',f.id,m.x,m.y,shape(m));
   for(const s of m.smallZones||[])add(s,'small',m.id,s.x,s.y,shape(s));
  }
  for(const m of f.macroZones||[])add(m,'macro',f.id,m.x,m.y,shape(m));
  for(const m of f.internalFacilities||[]){
   if(!m.id||byId.has(m.id))continue;
   add(m,'internal',f.id,f.x+(m.dx||0),f.y+(m.dy||0),shape(m));
  }
 }
 for(const r of data.roads){
  const geom=r.kind==='ring'?{kind:'ringPath',radius:r.r,width:r.width}:
   r.kind==='line'?{kind:'polyline',points:(r.points||[]).map(p=>[...p]),width:r.width}:{kind:'internalPath',width:r.width};
  add(r,'road',null,0,0,geom);
 }
 for(const n of nodes){
  const g=n.geometry;
  if(g.kind==='rectangle'&&(!num(g.width)||g.width<=0||!num(g.height)||g.height<=0))
   problems.push({severity:'error',objectId:n.id,description:'矩形の幅・高さが不正'});
  if(g.kind==='polygon'&&!g.vertices.every(pair))
   problems.push({severity:'error',objectId:n.id,description:'多角形の座標が不正'});
  if(g.kind==='polyline'&&g.points.length<2)
   problems.push({severity:'error',objectId:n.id,description:'通路の頂点不足'});
 }
 return {schemaVersion:2,floor:data.floor,unit:data.unit||'m',nodes,byId,children,problems,
   districts:nodes.filter(n=>(children.get(n.id)||[]).some(v=>v.role==='medium'))};
}
function worldPose(model,value){
 const n=typeof value==='string'?model.byId.get(value):value;if(!n)return null;
 if(!n.parentId)return{x:n.position.x,y:n.position.y,rotation:n.rotation};
 const p=worldPose(model,n.parentId);if(!p)throw Error('親座標の取得失敗: '+n.id);
 const [dx,dy]=turn(n.position.x,n.position.y,p.rotation);
 return {x:p.x+dx,y:p.y+dy,rotation:p.rotation+n.rotation};
}
function polygon(model,n){
 const g=n.geometry,p=worldPose(model,n);
 if(!['rectangle','polygon'].includes(g.kind))return [];
 const v=g.kind==='polygon'?g.vertices:[[-g.width/2,-g.height/2],[g.width/2,-g.height/2],[g.width/2,g.height/2],[-g.width/2,g.height/2]];
 return v.map(([x,y])=>{const [dx,dy]=turn(x,y,p.rotation);return [p.x+dx,p.y+dy]});
}
function pointInPolygon(poly,x,y){
 let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const [ax,ay]=poly[j],[bx,by]=poly[i],cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);
  if(Math.abs(cross)<1e-7&&x>=Math.min(ax,bx)-1e-7&&x<=Math.max(ax,bx)+1e-7&&y>=Math.min(ay,by)-1e-7&&y<=Math.max(ay,by)+1e-7)return true;
  if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
 }
 return inside;
}
function contains(model,n,x,y){
 if(['polygon','rectangle'].includes(n.geometry.kind))return pointInPolygon(polygon(model,n),x,y);
 if(n.geometry.kind==='ring'){
  const p=worldPose(model,n),r=Math.hypot(x-p.x,y-p.y);
  return r>=n.geometry.innerRadius&&r<=n.geometry.outerRadius;
 }
 return false;
}
const childrenOf=(m,id,role)=>(m.children.get(id)||[]).filter(n=>!role||n.role===role);
function middleState(m,id){
 let n=m.byId.get(id)||null,medium=null,district=null;const visited=new Set();
 while(n&&!visited.has(n.id)){
  visited.add(n.id);if(n.role==='medium'&&!medium)medium=n;
  if(m.districts.includes(n)){district=n;break}
  n=n.parentId?m.byId.get(n.parentId):null;
 }
 return {district,medium};
}
function hitMiddleChild(m,id,x,y){
 const {district,medium}=middleState(m,id);if(!district)return null;
 if(medium){const small=childrenOf(m,medium.id,'small').find(n=>contains(m,n,x,y));if(small)return small}
 return childrenOf(m,district.id,'medium').find(n=>contains(m,n,x,y))||null;
}
function trace(ctx,project,vertices){
 ctx.beginPath();
 vertices.forEach(([x,y],i)=>{const [px,py]=project(x,y);i?ctx.lineTo(px,py):ctx.moveTo(px,py)});
 ctx.closePath();
}
function drawMiddleCanvas(ctx,project,m,selectedId,options={}){
 const {district,medium}=middleState(m,selectedId);
 const frames=!options.labelsOnly,labels=options.labels!==false&&!options.framesOnly;
 ctx.save();ctx.lineJoin='round';
 if(frames)for(const parent of m.districts)for(const n of childrenOf(m,parent.id,'medium')){
  if(medium&&n.id===medium.id)continue;
  trace(ctx,project,polygon(m,n));ctx.fillStyle='rgba(222,228,232,.08)';ctx.fill();
  ctx.lineWidth=1.65;ctx.strokeStyle='#d4dde2';ctx.setLineDash([6,4]);ctx.stroke();
 }
 if(frames&&medium)for(const n of childrenOf(m,medium.id,'small')){
  trace(ctx,project,polygon(m,n));const active=n.id===selectedId;
  ctx.fillStyle=active?'rgba(255,237,166,.27)':'rgba(234,232,230,.12)';ctx.fill();
  ctx.lineWidth=active?2.7:1.65;ctx.strokeStyle=active?'#fff1a6':'#d6d5cd';ctx.setLineDash([]);ctx.stroke();
 }
 if(labels){
  ctx.setLineDash([]);ctx.textAlign='center';ctx.textBaseline='middle';
  const label=(n,title,size,color,p=null)=>{
   const where=p||worldPose(m,n),[px,py]=project(where.x,where.y);
   ctx.font='bold '+size+'px system-ui';ctx.lineWidth=size>=15?4.5:3.1;
   ctx.strokeStyle='#13212a';ctx.strokeText(title,px,py);
   ctx.fillStyle=color;ctx.fillText(title,px,py);
  };
  for(const n of m.districts)if(n.id!==district?.id){
   const a=n.raw.mapLabelPosition;
   label(n,n.raw.districtMapLabel||n.raw.short||n.name,options.bigFont||16,'#fff4d5',pair(a)?{x:a[0],y:a[1]}:null);
  }
  if(medium)for(const n of childrenOf(m,medium.id,'small'))label(n,n.name,options.smallFont||10,n.id===selectedId?'#fff5a5':'#e9eef1');
  else if(district)for(const n of childrenOf(m,district.id,'medium'))label(n,n.name,options.mediumFont||12,'#f1f5f7');
 }
 ctx.restore();
}
function svgShape(m,n,project){
 const g=n.geometry,p=worldPose(m,n);
 if(g.kind==='rectangle'&&p.rotation===0){
  const [a,b]=project(p.x-g.width/2,p.y-g.height/2),[c,d]=project(p.x+g.width/2,p.y+g.height/2);
  return {tag:'rect',props:{x:Math.min(a,c),y:Math.min(b,d),width:Math.abs(c-a),height:Math.abs(d-b)},label:project(p.x,p.y)};
 }
 if(['rectangle','polygon'].includes(g.kind))return {tag:'polygon',props:{points:polygon(m,n).map(pt=>project(...pt).join(',')).join(' ')},label:project(p.x,p.y)};
 return null;
}
function snapshot(m){return{schemaVersion:2,floor:m.floor,unit:m.unit,generator:'aa-map-engine.js: normalizeFloor',
 notes:'Derived preview only; draft roads/rooms/connections do not become confirmed.',
 objects:m.nodes.map(n=>({id:n.id,name:n.name,type:n.type,subtype:n.subtype,parentId:n.parentId,
 position:n.position,rotation:n.rotation,geometry:n.geometry,properties:n.properties}))}};
global.AAMapEngine=Object.freeze({normalizeFloor,worldPose,polygon,contains,middleState,hitMiddleChild,
 drawMiddleCanvas,childrenOf,svgShape,snapshot});
})(window);
