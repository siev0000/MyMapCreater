/* Generic JSON scene renderer. No world, character, facility, or map IDs in code. */
(function(global){
"use strict";

const finite=(n,fallback=0)=>Number.isFinite(Number(n))?Number(n):fallback;
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const htmlColor=(s,defaultValue)=>typeof s==="string"&&s?s:defaultValue;

function sceneCheck(scene){
 if(scene?.schemaVersion!==2||!Array.isArray(scene.objects))throw Error("シーンJSONの形式が不正です（schemaVersion:2 が必要）");
 const ids=new Set();
 for(const obj of scene.objects){
  if(!obj||typeof obj.id!=="string"||!obj.id||ids.has(obj.id))throw Error("オブジェクトIDが不正・重複しています");
  ids.add(obj.id);
  const g=obj.geometry||{type:"none"};
  if(!["none","rect","polygon","polyline","circle","ring"].includes(g.type))throw Error("未対応の形状: "+g.type);
  const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
  if(["polygon","polyline"].includes(g.type)&&(!Array.isArray(g.points)||g.points.length<(g.type==="polygon"?3:2)||!g.points.every(point)))throw Error("形状の座標が不正です: "+obj.id);
  if(g.type==="rect"&&(![g.x,g.y,g.width,g.height].every(Number.isFinite)||g.width<0||g.height<0))throw Error("四角形が不正です: "+obj.id);
  if(g.type==="circle"&&(!point(g.center)||!Number.isFinite(g.radius)||g.radius<=0))throw Error("円が不正です: "+obj.id);
  if(g.type==="ring"&&(!point(g.center)||![g.innerRadius,g.outerRadius].every(Number.isFinite)||g.innerRadius<0||g.outerRadius<=g.innerRadius))throw Error("環状図形が不正です: "+obj.id);
  if(obj.label?.position&&!point(obj.label.position))throw Error("文字位置が不正です: "+obj.id);
  if(obj.displayLevel!==undefined&&(!Number.isSafeInteger(obj.displayLevel)||obj.displayLevel<1))throw Error("表示Lvは1以上の整数です: "+obj.id);
  if(g.type==="rect"&&g.rotation!==undefined&&!Number.isFinite(g.rotation))throw Error("図形の回転角が不正です: "+obj.id);
  if(obj.wall?.thickness!==undefined&&(!Number.isFinite(obj.wall.thickness)||obj.wall.thickness<=0))throw Error("壁の実厚が不正です: "+obj.id);
  if(obj.style?.opacity!==undefined&&(!Number.isFinite(obj.style.opacity)||obj.style.opacity<0||obj.style.opacity>1))throw Error("透過率が不正です: "+obj.id);
  if(obj.style?.strokeWidth!==undefined&&(!Number.isFinite(obj.style.strokeWidth)||obj.style.strokeWidth<0))throw Error("線幅が不正です: "+obj.id);
 }
 const lookup=new Map(scene.objects.map(o=>[o.id,o]));
 for(const obj of scene.objects){
  if(obj.parentId&&!ids.has(obj.parentId))throw Error("存在しない親ID: "+obj.id);
  if((obj.objectType==="door"||obj.objectType==="window")&&obj.opening?.wallId){
   const linked=lookup.get(obj.opening.wallId);
   if(!linked||linked.objectType!=="wall")throw Error("扉が参照する壁IDが不正です: "+obj.id);
  }
  if(obj.floors!==undefined){
   if(!Array.isArray(obj.floors)||!obj.floors.length)throw Error("フロア一覧が不正です: "+obj.id);
   const floorIds=new Set();
   for(const f of obj.floors){
    if(!f||typeof f.id!=="string"||!f.id||floorIds.has(f.id))throw Error("フロアIDが不正・重複: "+obj.id);
    floorIds.add(f.id);
   }
  }
  if(obj.floorId!==undefined){
   let current=lookup.get(obj.parentId),owner=null;
   const visited=new Set();
   while(current&&!visited.has(current.id)){
    visited.add(current.id);
    if(Array.isArray(current.floors)){owner=current;break}
    current=lookup.get(current.parentId);
   }
   if(!owner||!owner.floors.some(f=>f.id===obj.floorId))throw Error("所属階が不正です: "+obj.id);
  }
  const seen=new Set();
  let current=obj;
  while(current?.parentId){
   if(seen.has(current.id))throw Error("親子関係が循環しています: "+obj.id);
   seen.add(current.id);current=lookup.get(current.parentId);
  }
 }
 const ax=scene.coordinateSystem?.horizontal||[1,0],ay=scene.coordinateSystem?.vertical||[0,1];
 if(Math.abs(ax[0]*ay[1]-ax[1]*ay[0])<.0001)throw Error("座標変換が無効です");
 return scene;
}
function inPolygon(points,x,y){
 let yes=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];
  if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;
 }
 return yes;
}
function segmentDistance(x,y,a,b){
 const vx=b[0]-a[0],vy=b[1]-a[1],len=vx*vx+vy*vy||1;
 const t=clamp(((x-a[0])*vx+(y-a[1])*vy)/len,0,1);
 return Math.hypot(x-a[0]-vx*t,y-a[1]-vy*t);
}
function rectRotation(g){return Number.isFinite(g?.rotation)?g.rotation:0}
function unrotateRectPoint(g,x,y){
 const a=-rectRotation(g)*Math.PI/180,cx=g.x+g.width/2,cy=g.y+g.height/2;
 const dx=x-cx,dy=y-cy,co=Math.cos(a),si=Math.sin(a);
 return[cx+dx*co-dy*si,cy+dx*si+dy*co];
}
function contains(obj,x,y,tolerance){
 const g=obj.geometry||{type:"none"};
 switch(g.type){
  case "rect":{const [px,py]=rectRotation(g)?unrotateRectPoint(g,x,y):[x,y];return px>=g.x-tolerance&&px<=g.x+g.width+tolerance&&py>=g.y-tolerance&&py<=g.y+g.height+tolerance}
  case "polygon":return Array.isArray(g.points)&&inPolygon(g.points,x,y);
  case "circle":return Math.hypot(x-g.center[0],y-g.center[1])<=g.radius+tolerance;
  case "ring":{const d=Math.hypot(x-g.center[0],y-g.center[1]);return d>=g.innerRadius-tolerance&&d<=g.outerRadius+tolerance}
  case "polyline":return Array.isArray(g.points)&&g.points.some((p,i)=>i&&segmentDistance(x,y,g.points[i-1],p)<=tolerance);
  default:return false;
 }
}
function trace(ctx,geometry){
 const g=geometry||{type:"none"};
 ctx.beginPath();
 switch(g.type){
  case "rect":ctx.rect(g.x,g.y,g.width,g.height);return true;
  case "polygon":
  case "polyline":
   if(!g.points?.length)return false;
   g.points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
   if(g.type==="polygon")ctx.closePath();
   return true;
  case "circle":ctx.arc(g.center[0],g.center[1],g.radius,0,Math.PI*2);return true;
  case "ring":
   ctx.arc(g.center[0],g.center[1],g.outerRadius,0,Math.PI*2);
   ctx.moveTo(g.center[0]+g.innerRadius,g.center[1]);
   ctx.arc(g.center[0],g.center[1],g.innerRadius,0,Math.PI*2,true);
   return true;
  default:return false;
 }
}
function create(opts){
 const canvas=opts.canvas,host=opts.host,ctx=canvas.getContext("2d");
 const geoCredit=document.createElement("div");
 geoCredit.hidden=true;
 geoCredit.setAttribute("aria-label","地図の出典");
 geoCredit.style.cssText="position:absolute;right:8px;bottom:8px;z-index:9;padding:3px 6px;border-radius:4px;background:rgba(7,22,30,.82);font:10px system-ui,sans-serif;color:#ebf3f4;pointer-events:none;user-select:none;max-width:min(85vw,340px)";
 const creditLink=document.createElement("span");
 creditLink.textContent="© OpenStreetMap contributors (ODbL)";
 geoCredit.append(creditLink);
 const demCredit=document.createElement("span");
 demCredit.textContent=" / 標高：国土地理院（加工表示）";
 geoCredit.append(demCredit);
 if(host?.append)host.append(geoCredit);

 const legendButton=opts.legendButton,roadButton=opts.roadButton;
 const memory=new Map(),pointers=new Map();
 let scene=null,selected=null,viewRootId=null,sceneKey="",request=0,projection=null;
 const interiorCache=new Map(),interiorPending=new Map(),interiorLoaded=new Set();
 const linkedDoors=new Map();
 let width=1,height=1,dpr=1,zoom=1,panX=0,panY=0,initialScale=1;
 let dragStart=null,dragged=false,pinch=null,legendEnabled=false,groupModes={},editMode=false,objectDrag=null,handleDrag=null,suppressClick=false;
 let editorGrid={visible:false,spacing:2,snap:false,fraction:.5,originX:0,originY:0};
 let previewGridVisible=null;
 try{legendEnabled=localStorage.getItem("map-scene-legend")==="true"}catch(_){}
 function getAxes(){
  return [scene?.coordinateSystem?.horizontal||[1,0],scene?.coordinateSystem?.vertical||[0,1]];
 }
 function bounds(){
  return scene?.coordinateSystem?.bounds||{minX:-100,maxX:100,minY:-100,maxY:100};
 }
 function center(){
  const b=bounds();return [(b.minX+b.maxX)/2,(b.minY+b.maxY)/2];
 }
 function project(x,y){
  const [a,b]=getAxes();return [a[0]*x+a[1]*y,b[0]*x+b[1]*y];
 }
 function unproject(u,v){
  const [a,b]=getAxes(),det=a[0]*b[1]-a[1]*b[0];
  return [(b[1]*u-a[1]*v)/det,(-b[0]*u+a[0]*v)/det];
 }
 function computeScale(){
  const b=bounds(),pts=[[b.minX,b.minY],[b.minX,b.maxY],[b.maxX,b.minY],[b.maxX,b.maxY]].map(p=>project(p[0],p[1]));
  const xx=pts.map(p=>p[0]),yy=pts.map(p=>p[1]);
  const dx=Math.max(1,Math.max(...xx)-Math.min(...xx)),dy=Math.max(1,Math.max(...yy)-Math.min(...yy));
  return Math.max(.000001,Math.min((width-24)/dx,(height-24)/dy));
 }
 function scale(){return initialScale*zoom}
 function screenAt(x,y){
  const [u,v]=project(x,y),[cu,cv]=project(...center());
  return [width/2+panX+(u-cu)*scale(),height/2+panY+(v-cv)*scale()];
 }
 function worldAt(px,py){
  const [cu,cv]=project(...center());
  return unproject(cu+(px-width/2-panX)/scale(),cv+(py-height/2-panY)/scale());
 }
 function zoomAt(factor,x,y){
  const point=worldAt(x,y);
  zoom=clamp(zoom*factor,1,30);
  const after=screenAt(...point);
  panX+=x-after[0];panY+=y-after[1];draw();
 }
 function reset(){zoom=1;panX=0;panY=0;draw()}
 function layerRank(obj){
  const layers=scene?.layers||[];
  const l=layers.find(x=>x.id===obj.layer);
  return finite(obj.zIndex,finite(l?.zIndex,0));
 }
 const floorChoices=new Map();
 function getFloorContext(){
  if(!scene||!selected)return null;
  const byId=new Map(scene.objects.map(o=>[o.id,o]));
  let current=selected;
  const seen=new Set();
  while(current&&!seen.has(current.id)){
   seen.add(current.id);
   if(Array.isArray(current.floors)&&current.floors.length){
    const valid=current.floors;
    const selectedFloorId=floorChoices.get(current.id)||valid[0].id;
    return{ownerId:current.id,floors:valid.map(f=>({id:f.id,label:f.label||f.id})),selectedFloorId};
   }
   current=byId.get(current.parentId);
  }
  return null;
 }
 function setFloor(floorId){
  const context=getFloorContext();
  if(!context||!context.floors.some(f=>f.id===floorId))return false;
  floorChoices.set(context.ownerId,floorId);
  const owner=scene.objects.find(o=>o.id===context.ownerId);
  showDetails(owner);
  return true;
 }
 function floorOverlayState(){
  const context=getFloorContext();
  if(!context)return null;
  const owner=scene.objects.find(o=>o.id===context.ownerId),g=owner?.geometry;
  if(!g)return null;
  let points=[];
  if(g.type==="rect"){
   points=[[g.x,g.y],[g.x+g.width,g.y],[g.x+g.width,g.y+g.height],[g.x,g.y+g.height]];
   if(Number.isFinite(g.rotation)&&g.rotation){
    const angle=g.rotation*Math.PI/180,cx=g.x+g.width/2,cy=g.y+g.height/2;
    points=points.map(([x,y])=>[cx+(x-cx)*Math.cos(angle)-(y-cy)*Math.sin(angle),
                             cy+(x-cx)*Math.sin(angle)+(y-cy)*Math.cos(angle)]);
   }
  }else if(g.type==="polygon"&&g.points?.length)points=g.points;
  else if(g.type==="circle"&&g.center)points=[
   [g.center[0]-g.radius,g.center[1]],[g.center[0]+g.radius,g.center[1]],
   [g.center[0],g.center[1]-g.radius],[g.center[0],g.center[1]+g.radius]];
  if(!points.length)return null;
  const positions=points.map(p=>screenAt(...p));
  const xs=positions.map(p=>p[0]),ys=positions.map(p=>p[1]);
  return{ownerId:owner.id,name:owner.name||owner.id,
   floors:context.floors,selectedFloorId:context.selectedFloorId,
   x:(Math.min(...xs)+Math.max(...xs))/2,y:Math.min(...ys),width,height};
 }
 function stairDestination(obj){
  if(obj.objectType!=="stair")return null;
  const connection=obj.connection;
  if(!connection?.fromFloorId||!connection?.toFloorId)return null;
  const lookup=new Map(scene.objects.map(o=>[o.id,o]));
  let owner=lookup.get(obj.parentId),seen=new Set();
  while(owner&&!seen.has(owner.id)&&!Array.isArray(owner.floors)){
   seen.add(owner.id);owner=lookup.get(owner.parentId);
  }
  if(!Array.isArray(owner?.floors)||obj.floorId!==connection.fromFloorId)return null;
  const a=owner.floors.findIndex(f=>f.id===connection.fromFloorId);
  const b=owner.floors.findIndex(f=>f.id===connection.toFloorId);
  if(a<0||b<0||a===b)return null;
  const floor=owner.floors[b];
  return{symbol:b>a?"↑":"↓",label:floor.label||floor.id,id:floor.id};
 }
 // A switchback stair has two selectable floor transitions at a landing:
 // higher and lower floors are separate actions, not a single toFloorId.
 function stairFloorTargets(obj){
  if(obj?.objectType!=="stair"||obj?.stairDesign?.type!=="switchback"||!scene)return null;
  const parents=new Map(scene.objects.map(o=>[o.id,o]));
  let owner=parents.get(obj.parentId),seen=new Set();
  while(owner&&!seen.has(owner.id)&&!Array.isArray(owner.floors)){
   seen.add(owner.id);owner=parents.get(owner.parentId);
  }
  if(!Array.isArray(owner?.floors))return null;
  const floors=owner.floors.filter(f=>typeof f.id==="string");
  const index=floors.findIndex(f=>f.id===obj.floorId);
  if(index<0)return null;
  const format=(f)=>f?{id:f.id,label:f.label||f.id}:null;
  return{up:format(floors[index+1]),down:format(floors[index-1])};
 }
 function stairDirectionalHit(obj,px,py){
  const targets=stairFloorTargets(obj),g=obj?.geometry;
  if(!targets||g?.type!=="rect")return null;
  const [wx,wy]=worldAt(px,py);
  if(wx<g.x||wx>g.x+g.width||wy<g.y||wy>g.y+g.height)return null;
  // Left flight/label is UP, right flight/label is DOWN. On endpoint
  // floors the whole stair area can select its only available direction.
  if(targets.up&&!targets.down)return{direction:"up",destination:targets.up};
  if(targets.down&&!targets.up)return{direction:"down",destination:targets.down};
  const direction=wx<g.x+g.width/2?"up":"down";
  return{direction,destination:targets[direction]};
 }
 function initialDisplayLevel(){
  const level=scene?.settings?.initialDisplayLevel;
  return Number.isSafeInteger(level)&&level>=1?level:3;
 }
 function selectionPath(){
  const ids=new Set(),byId=new Map((scene?.objects||[]).map(o=>[o.id,o]));
  let o=selected;
  while(o&&!ids.has(o.id)){ids.add(o.id);o=byId.get(o.parentId)}
  return ids;
 }
 function isWithin(obj,rootId){
  if(!obj||!rootId)return false;
  const byId=new Map(scene.objects.map(o=>[o.id,o]));
  const seen=new Set();
  let o=obj;
  while(o&&!seen.has(o.id)){
   if(o.id===rootId)return true;
   seen.add(o.id);o=byId.get(o.parentId);
  }
  return false;
 }
 function visibleByDepth(obj){
  const level=Number.isSafeInteger(obj.displayLevel)?obj.displayLevel:1;
  // The overview always remains on screen, including when looking inside a
  // facility. Only the direct children along the current selection path open.
  if(level<=initialDisplayLevel())return true;
  if(!selected)return false;
  const byId=new Map(scene.objects.map(o=>[o.id,o]));
  const path=selectionPath();
  const parent=byId.get(obj.parentId);
  return !!(parent&&path.has(parent.id)&&
   level===parent.displayLevel+1);
 }
 function fitToObject(obj){
  const g=obj.geometry||{};
  let cx=0,cy=0,w=0,h=0;
  if(g.type==="rect"){cx=g.x+g.width/2;cy=g.y+g.height/2;w=g.width;h=g.height}
  else if((g.type==="polygon"||g.type==="polyline")&&g.points?.length){
   const xx=g.points.map(p=>p[0]),yy=g.points.map(p=>p[1]);
   cx=(Math.min(...xx)+Math.max(...xx))/2;cy=(Math.min(...yy)+Math.max(...yy))/2;
   w=Math.max(...xx)-Math.min(...xx);h=Math.max(...yy)-Math.min(...yy);
  }else if(g.center){[cx,cy]=g.center;w=h=(g.outerRadius||g.radius||25)*2}
  else return;
  const [a,b]=getAxes();
  const projectedWidth=Math.max(1,Math.abs(a[0])*w+Math.abs(a[1])*h);
  const projectedHeight=Math.max(1,Math.abs(b[0])*w+Math.abs(b[1])*h);
  const wanted=Math.min((width-42)/projectedWidth,(height-42)/projectedHeight);
  zoom=clamp(wanted/Math.max(initialScale,.000001),1,30);
  const [u,v]=project(cx,cy),[cu,cv]=project(...center());
  panX=-(u-cu)*scale();panY=-(v-cv)*scale();
 }
 function getViewRoot(){return null}
 function getViewRootPath(){
  if(!scene||!selected)return [];
  const byId=new Map(scene.objects.map(o=>[o.id,o]));
  const chain=[],seen=new Set();
  let current=byId.get(selected.id);
  while(current&&!seen.has(current.id)){
   seen.add(current.id);
   chain.unshift({id:current.id,name:current.name||current.id,displayLevel:current.displayLevel});
   current=byId.get(current.parentId);
  }
  return chain;
 }
 function navigateToItem(id){return selectItemById(id,{focus:true})}
 function enterItem(id=selected?.id){return selectItemById(id,{focus:true})}
 function exitItem(){
  if(!selected||!scene)return false;
  const parent=scene.objects.find(o=>o.id===selected.parentId);
  if(!parent){showDetails(null);return true}
  return selectItemById(parent.id,{focus:true});
 }
 function visible(obj){
  if(obj.visible===false||!visibleByDepth(obj))return false;
  if(obj.floorId){
   const context=getFloorContext();
   if(!context||obj.floorId!==context.selectedFloorId)return false;
   const byId=new Map(scene.objects.map(o=>[o.id,o]));
   let parent=byId.get(obj.parentId),belongs=false;
   const seen=new Set();
   while(parent&&!seen.has(parent.id)){
    if(parent.id===context.ownerId){belongs=true;break}
    seen.add(parent.id);parent=byId.get(parent.parentId);
   }
   if(!belongs)return false;
  }
  const v=obj.visibility||{};
  // Explicit parent-selection visibility is still supported for legacy scenes,
  // but initialDisplayLevel is authoritative for the level-based reveal.
  if(v.whenParentSelected && obj.displayLevel===undefined){
   if(!selected)return false;
   const path=selectionPath();
   if(!path.has(obj.parentId)&&selected.id!==obj.id)return false;
  }
  if(v.modeGroup&&Array.isArray(v.modes)){
   const mode=groupModes[v.modeGroup]||modeConfig(v.modeGroup).default;
   if(!v.modes.includes(mode))return false;
  }
  return true;
 }
 function sortedVisible(){
  return scene?.objects?.filter(visible).map((obj,i)=>({obj,i}))
   .sort((a,b)=>layerRank(a.obj)-layerRank(b.obj)||a.i-b.i).map(x=>x.obj)||[];
 }
 function traceDoorSymbol(obj,emphasized=false){
  const points=obj.geometry?.points;
  if(!Array.isArray(points)||points.length!==2)return false;
  const [a,b]=points,dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
  if(len<=0)return false;
  const door=obj.door||{};
  if(door.leafCount===2){
   // Both leaf types share the same full opening [a,b]; no extra wall gaps or IDs.
   const vx=dx/len,vy=dy/len,half=len/2;
   const center=[(a[0]+b[0])/2,(a[1]+b[1])/2];
   const color=emphasized?(scene?.settings?.selectionStyle?.stroke||"#ffefa7"):
    (door.type==="sliding"?"#ff9500":(obj.style?.stroke||"#f0be72"));
   const leaves=door.type==="sliding"
    ?[[a,[a[0]-dx/2,a[1]-dy/2]],[b,[b[0]+dx/2,b[1]+dy/2]]]
    :null;
   ctx.save();ctx.strokeStyle=color;ctx.lineCap="butt";ctx.lineJoin="round";
   if(leaves){
    // Two half-width leaves move outwards and overlap the adjoining wall.
    ctx.lineWidth=(emphasized?4.2:3.2)/scale();
    for(const [p,q] of leaves){ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke()}
    const cap=(emphasized?3.4:2.5)/scale();
    ctx.lineWidth=(emphasized?1.8:1.4)/scale();
    ctx.beginPath();
    for(const [p,q] of leaves)for(const endpoint of [p,q]){
     ctx.moveTo(endpoint[0]-vy*cap,endpoint[1]+vx*cap);
     ctx.lineTo(endpoint[0]+vy*cap,endpoint[1]-vx*cap);
    }
    ctx.stroke();
   }else{
    // Two half-width hinged leaves: hinges at opposite ends, each opens 90 degrees.
    const side=door.swingSide==="right"?-1:1;
    const openX=-vy*side,openY=vx*side;
    ctx.lineCap="round";ctx.lineWidth=(emphasized?2.6:2)/scale();
    for(const [hinge,dir] of [[a,1],[b,-1]]){
     const ix=vx*dir,iy=vy*dir;
     ctx.beginPath();ctx.moveTo(...hinge);
     ctx.lineTo(hinge[0]+openX*half,hinge[1]+openY*half);ctx.stroke();
     ctx.lineWidth=(emphasized?1.6:1.1)/scale();
     ctx.setLineDash([3/scale(),2/scale()]);
     ctx.beginPath();
     for(let i=0;i<=16;i++){
      const t=(Math.PI/2)*i/16;
      const x=hinge[0]+(ix*Math.cos(t)+openX*Math.sin(t))*half;
      const y=hinge[1]+(iy*Math.cos(t)+openY*Math.sin(t))*half;
      if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);
     }
     ctx.stroke();ctx.setLineDash([]);
     ctx.beginPath();ctx.arc(hinge[0],hinge[1],Math.max(1/scale(),half*.055),0,Math.PI*2);
     ctx.fillStyle=color;ctx.fill();
     ctx.lineWidth=(emphasized?2.6:2)/scale();
    }
   }
   ctx.restore();return true;
  }
  if(door.type==="sliding"){
   // Open sliding leaf runs along, and is drawn over, the linked wall.
   // The two geometry endpoints still describe the actual wall opening.
   const towardsStart=door.slideDirection==="start";
   const vx=dx/len,vy=dy/len;
   const start=towardsStart?[a[0]-dx,a[1]-dy]:[b[0],b[1]];
   const end=towardsStart?[a[0],a[1]]:[b[0]+dx,b[1]+dy];
   ctx.save();
   ctx.strokeStyle=emphasized?(scene?.settings?.selectionStyle?.stroke||"#ffefa7"):"#ff9500";
   ctx.lineCap="butt";ctx.lineJoin="round";
   // Fixed screen width is visual only; the wall's physical thickness remains independent.
   ctx.lineWidth=(emphasized?4.2:3.2)/scale();
   ctx.beginPath();ctx.moveTo(...start);ctx.lineTo(...end);ctx.stroke();
   // Small end marks make the sliding panel discernible from the wall.
   const cap=(emphasized?3.4:2.5)/scale();
   ctx.lineWidth=(emphasized?1.8:1.4)/scale();
   ctx.beginPath();
   for(const p of [start,end]){ctx.moveTo(p[0]-vy*cap,p[1]+vx*cap);ctx.lineTo(p[0]+vy*cap,p[1]-vx*cap)}
   ctx.stroke();ctx.restore();return true;
  }
  const hinge=door.hinge==="end"?b:a;
  const far=door.hinge==="end"?a:b;
  const vx=(far[0]-hinge[0])/len,vy=(far[1]-hinge[1])/len;
  const side=door.swingSide==="right"?-1:1;
  const openX=-vy*side,openY=vx*side;
  const color=emphasized?(scene?.settings?.selectionStyle?.stroke||"#ffefa7"):(obj.style?.stroke||"#f0be72");
  ctx.save();ctx.strokeStyle=color;ctx.lineCap="round";ctx.lineJoin="round";
  // The wall has an actual gap; the leaf opens perpendicular to the gap.
  ctx.lineWidth=(emphasized?2.6:2)/scale();
  ctx.beginPath();ctx.moveTo(...hinge);ctx.lineTo(hinge[0]+openX*len,hinge[1]+openY*len);ctx.stroke();
  // Quarter-circle swing arc, not a line painted across the opening.
  ctx.lineWidth=(emphasized?1.6:1.1)/scale();
  ctx.setLineDash([3/scale(),2/scale()]);
  ctx.beginPath();
  const segments=16;
  for(let i=0;i<=segments;i++){
   const t=(Math.PI/2)*i/segments;
   const x=hinge[0]+(vx*Math.cos(t)+openX*Math.sin(t))*len;
   const y=hinge[1]+(vy*Math.cos(t)+openY*Math.sin(t))*len;
   if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.stroke();ctx.setLineDash([]);
  ctx.beginPath();ctx.arc(hinge[0],hinge[1],Math.max(1/scale(),len*.055),0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
  ctx.restore();return true;
 }
 function traceSupplyIcon(obj,emphasized=false){
  if(obj.objectType!=="supply")return false;
  const g=obj.geometry||{};
  const point=g.type==="rect"?[g.x+g.width/2,g.y+g.height/2]:
   Array.isArray(obj.label?.position)?obj.label.position:null;
  if(!point)return true;
  ctx.save();
  const size=Math.max(12,finite(obj.icon?.fontSize,18))/scale();
  ctx.font=size+"px system-ui, sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillText(obj.icon?.text||"●",point[0],point[1]);
  if(emphasized){
   ctx.strokeStyle="#ffefa7";ctx.lineWidth=1.4/scale();
   ctx.strokeRect(point[0]-size*.72,point[1]-size*.72,size*1.44,size*1.44);
  }
  ctx.restore();return true;
 }
 // Shared plan symbols for indoor furniture and stairs. Objects retain a
 // normal geometry for selection, scaling and floor filtering.
 function traceIndoorShape(obj,emphasized=false){
  const kind=obj.shapePresetId||(obj.objectType==="stair"?"stair":null),g=obj.geometry;
  if(!kind||g?.type!=="rect"||g.width<=0||g.height<=0)return false;
  const {x,y,width:w,height:h}=g,accent=emphasized?"#ffefa7":"#9fc7d0";
  const edge=1.45/scale(),line=(a,b,c,d)=>{ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,d);ctx.stroke()};
  const R=(a,b,c,d,fill,stroke=accent)=>{
   ctx.beginPath();ctx.rect(x+a*w,y+b*h,c*w,d*h);
   if(fill){ctx.fillStyle=fill;ctx.fill()}
   if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=edge;ctx.stroke()}
  };
  const circle=(cx,cy,r,fill,stroke=accent)=>{
   ctx.beginPath();ctx.arc(x+cx*w,y+cy*h,r*Math.min(w,h),0,Math.PI*2);
   if(fill){ctx.fillStyle=fill;ctx.fill()}
   if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=edge;ctx.stroke()}
  };
  ctx.save();ctx.globalAlpha=1;ctx.lineWidth=edge;ctx.strokeStyle=accent;
  // Outer bounds always show the physical footprint, not an emoji.
  R(0,0,1,1,"#18333d");
  if(kind==="shelf"){
   for(const f of [.25,.5,.75])line(x,y+h*f,x+w,y+h*f);
   R(.05,.035,.12,.93,"#678f9d",null);R(.83,.035,.12,.93,"#678f9d",null);
  }else if(kind==="cabinet"){
   line(x+w/2,y,x+w/2,y+h);
   circle(.44,.52,.045,"#bbd3d6",null);circle(.56,.52,.045,"#bbd3d6",null);
  }else if(kind==="table"||kind==="workbench"){
   R(.07,.1,.86,.8,"#3d6572");
   for(const ax of [.13,.87])for(const ay of [.2,.8])R(ax-.045,ay-.045,.09,.09,"#99bdc5",null);
   if(kind==="workbench")R(.16,.24,.25,.5,"#294956");
  }else if(kind==="bed"){
   R(.1,.08,.8,.84,"#446a7c");
   R(.2,.13,.6,.18,"#9ab9c6",null);
   R(.15,.4,.7,.43,"#658497");
  }else if(kind==="sofa"||kind==="corner_sofa"){
   // Plan view: upholstered seat cushions and backrest.
   R(.05,.05,.90,.90,"#426c7a");
   R(.07,.07,.86,.19,"#7097a4");
   const n=w/h>2.1?3:w/h>1.25?2:1;
   for(let i=0;i<n;i++)R(.11+i*.78/n,.31,.73/n,.59,"#608a98");
   R(.03,.23,.10,.67,"#8aabb2",null);R(.87,.23,.10,.67,"#8aabb2",null);
   if(kind==="corner_sofa")R(.08,.58,.38,.34,"#90a9b2");
  }else if(kind==="chair"){
   R(.12,.14,.76,.75,"#5d8797");
   R(.11,.11,.78,.22,"#9ebcc2");
  }else if(kind==="bunk_bed"){
   R(.1,.08,.8,.84,"#446a7c");R(.2,.13,.6,.18,"#9ab9c6",null);
   R(.15,.4,.7,.43,"#658497");
   ctx.strokeStyle="#dae7e9";for(let i=0;i<4;i++)line(x+w*.83,y+h*(.26+i*.16),x+w*.95,y+h*(.26+i*.16));
  }else if(kind==="kitchen"){
   R(.06,.08,.88,.84,"#547b89");
   for(const cx of [.2,.38,.55,.73])circle(cx,.32,.08,"#233c45",null);
   R(.12,.59,.3,.23,"#7da8b4");R(.52,.58,.31,.24,"#244a59");
  }else if(kind==="cooktop"){
   for(const cx of [.26,.73])for(const cy of [.27,.73])circle(cx,cy,.16,"#213a43");
  }else if(kind==="sink"){
   R(.12,.13,.76,.74,"#668f9f");R(.19,.2,.62,.58,"#294e5b");
   circle(.74,.28,.035,"#d4e5e8",null);
  }else if(kind==="toilet"){
   R(.25,.03,.5,.22,"#b4d1d8");
   ctx.beginPath();ctx.ellipse(x+w*.5,y+h*.61,w*.3,h*.3,0,0,Math.PI*2);
   ctx.fillStyle="#b4d1d8";ctx.fill();ctx.strokeStyle=accent;ctx.stroke();
  }else if(kind==="bath"||kind==="shower"){
   R(.08,.08,.84,.84,"#8ab4c2");R(.15,.15,.70,.70,"#366b83");
   if(kind==="shower")circle(.75,.23,.075,"#bce2e9");
  }else if(kind==="refrigerator"||kind==="cabinet"){
   line(x+w*.5,y,x+w*.5,y+h);
   R(.07,.09,.86,.83,"#537783",null);
   line(x+w*.5,y+h*.12,x+w*.5,y+h*.88);
   circle(.43,.52,.035,"#d2e1e6",null);circle(.57,.52,.035,"#d2e1e6",null);
  }else if(kind==="washer"){
   R(.09,.09,.82,.82,"#789fa9");circle(.5,.54,.31,"#2c6177");
   circle(.5,.54,.22,"#96bdc5");R(.13,.13,.74,.12,"#b4d4d9",null);
  }else if(kind==="microwave"||kind==="screen"){
   R(.07,.15,.86,.7,"#2a5568");
   R(.14,.24,.68,.52,"#448a9f");
   if(kind==="microwave")circle(.9,.5,.04,"#b9d0cd",null);
  }else if(kind==="lamp"||kind==="plant"||kind==="bin"){
   circle(.5,.5,.33,kind==="plant"?"#4c8763":kind==="bin"?"#536671":"#f0dca0");
   if(kind==="plant")for(const [fx,fy] of [[.32,.46],[.59,.4],[.46,.62]])circle(fx,fy,.10,"#82bb87",null);
  }else if(kind==="aircon"||kind==="heater"||kind==="control_panel"){
   R(.08,.15,.84,.68,"#567e8c");
   for(const f of [.3,.45,.6,.75])line(x+w*.2,y+h*f,x+w*.8,y+h*f);
  }else if(kind==="fan"){
   circle(.5,.5,.35,"#375b67");
   for(const [fx,fy] of [[.32,.34],[.68,.32],[.66,.7],[.32,.68]])circle(fx,fy,.12,"#9dbcc4",null);
  }else if(kind==="bicycle"){
   circle(.5,.2,.15,"#506d78");circle(.5,.8,.15,"#506d78");
   line(x+w*.5,y+h*.2,x+w*.7,y+h*.53);
   line(x+w*.7,y+h*.53,x+w*.5,y+h*.8);
  }else if(kind==="rack"){
   for(const f of [.2,.5,.8])line(x+w*f,y,x+w*f,y+h);
  }else if(kind==="dormancy_pod"){
   // Top-down personal rest pod: chassis, enclosed berth, status/control port.
   R(.06,.04,.88,.92,"#264a58");
   R(.18,.1,.64,.72,"#406875");
   R(.27,.19,.46,.46,"#1a3540");
   circle(.5,.31,.115,"#90b7c2",null);
   R(.31,.7,.38,.13,"#73a6ab");
   circle(.82,.87,.045,"#a7dcaa",null);
  }else if(kind==="charging_station"){
   // Charging cradle: docking rails, charging port and central connector.
   R(.12,.12,.14,.76,"#537b8a");R(.74,.12,.14,.76,"#537b8a");
   R(.32,.21,.36,.57,"#264d5b");
   circle(.5,.47,.14,"#6ebdc5");
   ctx.strokeStyle="#d1e8d5";ctx.lineWidth=1.8/scale();
   line(x+w*.46,y+h*.36,x+w*.39,y+h*.51);
   line(x+w*.39,y+h*.51,x+w*.53,y+h*.48);
   line(x+w*.53,y+h*.48,x+w*.46,y+h*.63);
  }else if(kind==="fuel_dispenser"){
   // Physical filler nozzle and reservoir, kept distinct from charge sockets.
   R(.16,.12,.52,.76,"#385a65");R(.26,.22,.32,.22,"#6395a6");
   R(.73,.29,.12,.38,"#9da8a0");
   ctx.strokeStyle="#e5be79";ctx.lineWidth=1.8/scale();
   line(x+w*.68,y+h*.39,x+w*.78,y+h*.39);
   line(x+w*.78,y+h*.39,x+w*.78,y+h*.6);
  }else if(kind==="terminal_device"){
   // Fixed terminal: display and tactile control buttons.
   R(.1,.08,.8,.84,"#1b4554");
   R(.2,.2,.6,.42,"#3c8094");
   for(const fx of [.34,.5,.66])circle(fx,.76,.045,"#b0d0cd",null);
  }else if(kind==="storage_container"){
   for(const f of [.2,.4,.6,.8])line(x+w*f,y,x+w*f,y+h);
  }else if(kind==="stair"&&obj.stairDesign?.type==="switchback"){
   // Full-size interactive canvas view (also used by the template modal).
   // The SVG thumbnail uses a different renderer: keep both consistent.
   const mid=x+w/2,turn=y+h*.29,lowY=y+h*.9;
   const pathColor="#ffd17a",treadColor="#9dbfc8",edgeColor="#d8edf2";
   ctx.lineWidth=1.2/scale();ctx.strokeStyle=edgeColor;
   line(mid,turn,mid,y+h);
   line(x,turn,x+w,turn);
   ctx.fillStyle="rgba(109,169,182,.20)";
   ctx.fillRect(x,y,w,turn-y);
   ctx.strokeStyle=treadColor;ctx.lineWidth=.9/scale();
   for(let i=1;i<7;i++){
    const yy=turn+(y+h-turn)*i/7;
    line(x,yy,mid,yy);line(mid,yy,x+w,yy);
   }
   // One continuous yellow U-route: lower-left -> upper-left -> turn ->
   // upper-right -> lower-right. Arrow points at the upper-floor exit.
   const leftX=x+w*.25,rightX=x+w*.75,topY=y+h*.13;
   ctx.beginPath();ctx.moveTo(leftX,lowY);ctx.lineTo(leftX,turn);
   ctx.quadraticCurveTo(leftX,topY,mid,topY);
   ctx.quadraticCurveTo(rightX,topY,rightX,turn);
   ctx.lineTo(rightX,lowY);
   ctx.strokeStyle=pathColor;ctx.lineWidth=2.8/scale();ctx.lineCap="round";ctx.stroke();
   const head=Math.min(w,h)*.11;
   ctx.beginPath();ctx.moveTo(rightX-head*.65,lowY-head);
   ctx.lineTo(rightX,lowY);ctx.lineTo(rightX+head*.65,lowY-head);
   ctx.stroke();
   // Endpoint blocks show which side is the entry and which is the exit.
   ctx.fillStyle="#8fe0df";
   ctx.beginPath();ctx.arc(leftX,lowY,Math.max(1.8/scale(),w*.045),0,Math.PI*2);ctx.fill();
   ctx.fillStyle=pathColor;
   ctx.beginPath();ctx.arc(rightX,lowY,Math.max(1.8/scale(),w*.045),0,Math.PI*2);ctx.fill();
   ctx.lineCap="butt";
  }else if(kind==="stair"){
   const n=Math.max(4,Math.min(12,Math.round(Math.max(w,h)/2)));
   const horizontal=h>=w;
   for(let i=1;i<n;i++){
    if(horizontal)line(x,y+h*i/n,x+w,y+h*i/n);
    else line(x+w*i/n,y,x+w*i/n,y+h);
   }
   // Slightly raised treads: the low entry end remains distinct from the high end.
   // For older scenes without a stair.lowSide, do not guess the climbing direction.
   const lowSide=obj.stair?.lowSide;
   const side=["top","bottom","left","right"].includes(lowSide)?lowSide:null;
   const count=Math.max(4,Math.min(12,Math.round((h>=w?h:w)/2)));
   const alongVertical=h>=w;
   for(let i=0;i<count;i++){
    const lowAtStart=alongVertical?side==="top":side==="left";
    const lowAtEnd=alongVertical?side==="bottom":side==="right";
    const depth=lowAtStart?i:lowAtEnd?count-1-i:Math.floor(count/2);
    const lightness=side?Math.round(45+depth/(count-1)*39):60;
    const fill="hsl(198 24% "+lightness+"% / .36)";
    ctx.fillStyle=fill;
    if(alongVertical)ctx.fillRect(x,y+h*i/count,w,h/count);
    else ctx.fillRect(x+w*i/count,y,w/count,h);
   }
   ctx.strokeStyle=accent;ctx.lineWidth=Math.max(1/scale(),.9/scale());
   for(let i=1;i<count;i++){
    if(alongVertical)line(x,y+h*i/count,x+w,y+h*i/count);
    else line(x+w*i/count,y,x+w*i/count,y+h);
   }
   if(side){
    const lowColor="#8fd9e8",highColor="#ffd68c";
    const cap=Math.max(2/scale(),Math.min(w,h)*.14);
    ctx.strokeStyle=lowColor;ctx.lineWidth=2.2/scale();
    ctx.beginPath();
    if(side==="top"){ctx.moveTo(x,y);ctx.lineTo(x+w,y)}
    if(side==="bottom"){ctx.moveTo(x,y+h);ctx.lineTo(x+w,y+h)}
    if(side==="left"){ctx.moveTo(x,y);ctx.lineTo(x,y+h)}
    if(side==="right"){ctx.moveTo(x+w,y);ctx.lineTo(x+w,y+h)}
    ctx.stroke();
    ctx.strokeStyle=highColor;
    ctx.beginPath();
    if(side==="top"){ctx.moveTo(x,y+h-cap/3);ctx.lineTo(x+w,y+h-cap/3)}
    if(side==="bottom"){ctx.moveTo(x,y+cap/3);ctx.lineTo(x+w,y+cap/3)}
    if(side==="left"){ctx.moveTo(x+w-cap/3,y);ctx.lineTo(x+w-cap/3,y+h)}
    if(side==="right"){ctx.moveTo(x+cap/3,y);ctx.lineTo(x+cap/3,y+h)}
    ctx.stroke();
   }

  }
  ctx.restore();return true;
 }
 // Draw gaps in a linked wall only where the linked door geometry actually
 // lies on the same segment. Otherwise leave wall unchanged and never infer a gap.
 function traceWallWithOpenings(target,wall){
  const g=wall.geometry;
  if(g?.type!=="polyline"||!Array.isArray(g.points)||g.points.length<2)return trace(target,g);
  const doors=(linkedDoors.get(wall.id)||[]).filter(o=>o.geometry?.type==="polyline"&&o.geometry.points?.length===2);
  if(!doors.length)return trace(target,g);
  const tolerance=Math.max(.05,(wall.wall?.thickness||0)*.5);
  target.beginPath();
  for(let i=1;i<g.points.length;i++){
   const a=g.points[i-1],b=g.points[i],dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy;
   if(len2<=1e-10)continue;
   const gaps=[];
   for(const door of doors){
    const [p,q]=door.geometry.points;
    const t1=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len2;
    const t2=((q[0]-a[0])*dx+(q[1]-a[1])*dy)/len2;
    if(Math.min(t1,t2)<-1e-5||Math.max(t1,t2)>1+1e-5)continue;
    if(segmentDistance(p[0],p[1],a,b)>tolerance||
       segmentDistance(q[0],q[1],a,b)>tolerance)continue;
    gaps.push([Math.max(0,Math.min(t1,t2)),Math.min(1,Math.max(t1,t2))]);
   }
   gaps.sort((a,b)=>a[0]-b[0]);
   let cursor=0;
   const line=(start,end)=>{
    if(end-start<1e-8)return;
    target.moveTo(a[0]+dx*start,a[1]+dy*start);
    target.lineTo(a[0]+dx*end,a[1]+dy*end);
   };
   for(const [start,end] of gaps){if(start>cursor)line(cursor,start);cursor=Math.max(cursor,end)}
   if(cursor<1)line(cursor,1);
  }
  return true;
 }
 function traceStroke(obj,emphasized=false){
  const g=obj.geometry;
  if(g?.type==="rect"&&rectRotation(g)){
   ctx.save();
   const cx=g.x+g.width/2,cy=g.y+g.height/2;
   ctx.translate(cx,cy);ctx.rotate(rectRotation(g)*Math.PI/180);ctx.translate(-cx,-cy);
   traceStrokeCore(obj,emphasized);ctx.restore();return;
  }
  traceStrokeCore(obj,emphasized);
 }
 function traceStrokeCore(obj,emphasized=false){
  const st=obj.style||{},g=obj.geometry;
  if(obj.objectType==="supply"&&traceSupplyIcon(obj,emphasized))return;
  if(traceIndoorShape(obj,emphasized))return;
  if(!g||g.type==="none")return;
  ctx.save();
  ctx.globalAlpha=emphasized?1:clamp(finite(st.opacity,1),0,1);
  ctx.lineJoin=st.lineJoin||"round";ctx.lineCap=st.lineCap||"round";
  // Openings should not be filled back in by rounded stroke caps.
  if(obj.objectType==="wall"&&linkedDoors.has(obj.id))ctx.lineCap="butt";
  if(obj.objectType==="door"&&traceDoorSymbol(obj,emphasized)){ctx.restore();return}
  // Windows share the wall opening path but remain a thin cyan glazed line.
  if(obj.objectType==="window"&&g.type==="polyline"){ctx.strokeStyle=emphasized?"#ffefa7":(st.stroke||"#80ddf0");ctx.lineWidth=(emphasized?3:2)/scale();ctx.beginPath();for(let i=0;i<g.points.length;i++){if(!i)ctx.moveTo(...g.points[i]);else ctx.lineTo(...g.points[i])}ctx.stroke();ctx.restore();return}
  const ok=obj.objectType==="wall"?traceWallWithOpenings(ctx,obj):trace(ctx,g);
  if(ok){
   if(!emphasized&&st.fill){ctx.fillStyle=st.fill;ctx.fill(g.type==="ring"?"evenodd":"nonzero")}
   if(emphasized||st.stroke){
    ctx.strokeStyle=emphasized?(scene?.settings?.selectionStyle?.stroke||"#ffefa7"):st.stroke;
    const geoWidth=Number(obj.metadata?.renderWidthM);
    const unitsPerM=Number(scene?.settings?.georeference?.worldUnitsPerMeter);
    ctx.lineWidth=obj.objectType==="wall"&&Number.isFinite(obj.wall?.thickness)&&obj.wall.thickness>0
     ?Math.max(obj.wall.thickness,(emphasized?2.3:0)/scale())
     :Number.isFinite(geoWidth)&&geoWidth>0&&Number.isFinite(unitsPerM)&&unitsPerM>0
      ?Math.max(.1,geoWidth*unitsPerM,(emphasized?2.3:0)/scale())
      :(emphasized?2.3:Math.max(.15,finite(st.strokeWidth,1)))/scale();
    ctx.setLineDash(emphasized?[]:(st.dash||[]).map(n=>n/scale()));
    ctx.stroke();
   }
  }
  ctx.restore();
 }
 function setEditorGrid(config){
  editorGrid={...editorGrid,...config};draw();
 }
 function snapWorld(value,axis){
  if(!editorGrid.snap)return value;
  const step=editorGrid.spacing*editorGrid.fraction;
  if(!(step>0))return value;
  const origin=axis===0?editorGrid.originX:editorGrid.originY;
  return origin+Math.round((value-origin)/step)*step;
 }
 function drawEditorGrid(){
  if(!editorGrid.visible||!scene)return;
  const spacing=editorGrid.spacing;
  if(!(spacing>0)||spacing*scale()<5)return;
  const corners=[[0,0],[width,0],[0,height],[width,height]].map(([x,y])=>worldAt(x,y));
  const xx=corners.map(c=>c[0]),yy=corners.map(c=>c[1]);
  const minX=Math.min(...xx),maxX=Math.max(...xx),minY=Math.min(...yy),maxY=Math.max(...yy);
  if((maxX-minX)/spacing>600||(maxY-minY)/spacing>600)return;
  ctx.save();ctx.strokeStyle="rgba(157,221,236,.38)";ctx.lineWidth=1/scale();ctx.beginPath();
  const x0=editorGrid.originX,y0=editorGrid.originY;
  for(let i=Math.ceil((minX-x0)/spacing);i<=(maxX-x0)/spacing;i++){
   const x=x0+i*spacing;ctx.moveTo(x,minY);ctx.lineTo(x,maxY);
  }
  for(let i=Math.ceil((minY-y0)/spacing);i<=(maxY-y0)/spacing;i++){
   const y=y0+i*spacing;ctx.moveTo(minX,y);ctx.lineTo(maxX,y);
  }
  ctx.stroke();ctx.restore();
 }
 function drawGrid(){
  const configured=scene?.grid||{},enabled=previewGridVisible===null?configured.visible===true:previewGridVisible;
  if(!enabled)return;
  // Explicit preview ON works even in scenes whose stored grid.visible is false.
  const spacing=Number(configured.spacing)>0?Number(configured.spacing):
   Number(scene?.settings?.editorGrid?.spacing)>0?Number(scene.settings.editorGrid.spacing):2;
  if(!(spacing>0)||spacing*scale()<5)return;
  const points=[[0,0],[width,0],[0,height],[width,height]].map(p=>worldAt(...p));
  const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0]));
  const minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
  if((maxX-minX)/spacing>600||(maxY-minY)/spacing>600)return;
  ctx.save();ctx.lineWidth=Math.max(.1,finite(configured.strokeWidth,.6))/scale();
  ctx.strokeStyle=htmlColor(configured.stroke,"#94b4c0");ctx.beginPath();
  const ox=Number(scene?.settings?.editorGrid?.originX)||0,oy=Number(scene?.settings?.editorGrid?.originY)||0;
  for(let i=Math.ceil((minX-ox)/spacing);i<=(maxX-ox)/spacing;i++){const x=ox+i*spacing;ctx.moveTo(x,minY);ctx.lineTo(x,maxY)}
  for(let i=Math.ceil((minY-oy)/spacing);i<=(maxY-oy)/spacing;i++){const y=oy+i*spacing;ctx.moveTo(minX,y);ctx.lineTo(maxX,y)}
  ctx.stroke();ctx.restore();
 }
 function setPreviewGridVisible(visible){
  previewGridVisible=typeof visible==="boolean"?visible:null;
  draw();return getPreviewGridVisible();
 }
 function getPreviewGridVisible(){
  return previewGridVisible===null?scene?.grid?.visible===true:previewGridVisible;
 }
 function drawStairIndicators(objects){
  // Render elevation symbols in screen coordinates; projected map axes may rotate.
  ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);
  for(const obj of objects){
   if(obj.objectType!=="stair"&&obj.shapePresetId!=="stair")continue;
   const g=obj.geometry;if(g?.type!=="rect")continue;
   const destinations=stairFloorTargets(obj);
   if(destinations){
    const [leftX,leftY]=screenAt(g.x+g.width*.25,g.y+g.height*.53);
    const [rightX,rightY]=screenAt(g.x+g.width*.75,g.y+g.height*.53);
    for(const [target,sx,sy,arrow] of [[destinations.up,leftX,leftY,"↑"],[destinations.down,rightX,rightY,"↓"]]){
     const caption=target?arrow+(target.label||target.id):"－";
     ctx.font="bold 10px system-ui, sans-serif";
     const labelWidth=ctx.measureText(caption).width;
     const bw=Math.max(21,labelWidth+9),bh=19;
     ctx.fillStyle=target?"rgba(10,45,59,.94)":"rgba(30,42,47,.72)";
     ctx.fillRect(sx-bw/2,sy-bh/2,bw,bh);
     ctx.lineWidth=1;ctx.strokeStyle=target?"#b4e1e8":"#64717b";
     ctx.strokeRect(sx-bw/2,sy-bh/2,bw,bh);
     ctx.textAlign="center";ctx.textBaseline="middle";
     ctx.fillStyle=target?(arrow==="↑"?"#a9effb":"#ffcf92"):"#83939a";
     ctx.fillText(caption,sx,sy);
    }
    continue;
   }
   const dest=stairDestination(obj);
   const side=["top","bottom","left","right"].includes(obj.stair?.lowSide)?obj.stair.lowSide:null;
   const [x,y]=screenAt(g.x+g.width/2,g.y+g.height/2);
   const symbol=dest?.symbol||"?",floor=dest?.label||"";
   ctx.font="bold 10px system-ui, sans-serif";
   const str=symbol+(floor?" "+floor:"");
   const textWidth=ctx.measureText(str)?.width??str.length*6.5;
   const bw=Math.max(23,textWidth+9),bh=17;
   const px=clamp(x,bw/2+2,Math.max(bw/2+2,width-bw/2-2)),py=clamp(y,bh/2+2,Math.max(bh/2+2,height-bh/2-2));
   ctx.fillStyle="rgba(9,34,45,.48)";
   ctx.fillRect(px-bw/2,py-bh/2,bw,bh);
   ctx.strokeStyle="rgba(141,192,205,.30)";
   ctx.lineWidth=.6;ctx.strokeRect(px-bw/2,py-bh/2,bw,bh);
   ctx.textBaseline="middle";ctx.textAlign="center";
   ctx.fillStyle=dest?(dest.symbol==="↑"?"#b0e6f8":"#ffe0ae"):"#e6c1c1";
   ctx.fillText(str,px,py);
   if(side){
    // LOW label always points to the actual entry side; elevation arrow is separate.
    const edge={top:[g.x+g.width/2,g.y],bottom:[g.x+g.width/2,g.y+g.height],
     left:[g.x,g.y+g.height/2],right:[g.x+g.width,g.y+g.height/2]}[side];
    const [ex,ey]=screenAt(...edge);
    ctx.font="bold 9px system-ui, sans-serif";
    ctx.fillStyle="#a9f3f6";ctx.fillText("入口",ex,ey-9);
   }
  }
  ctx.restore();
 }
 function drawLabels(objects){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.save();
  ctx.textBaseline="middle";ctx.textAlign="center";
  const defaultStyle=scene?.settings?.labelDefaults||{};
  // Opening an area/building reveals its contents. Hide labels belonging
  // to the opened level and higher parent levels, so their large text never
  // overlaps the newly revealed buildings or indoor equipment.
  const openedLevel=selected&&["region","facility"].includes(selected.objectType)
   ?selected.displayLevel
   :selected?(()=>{const byId=new Map(scene.objects.map(o=>[o.id,o]));let p=selected;
     const seen=new Set();while(p&&!seen.has(p.id)){
      seen.add(p.id);
      if(["region","facility"].includes(p.objectType))return p.displayLevel;
      p=byId.get(p.parentId);
     }return null})():null;
  for(const o of objects){
   const l=o.label||{};
   if(l.visible===false||!l.text)continue;
   if(Number.isSafeInteger(openedLevel)&&
      ["region","facility"].includes(o.objectType)&&
      Number.isSafeInteger(o.displayLevel)&&o.displayLevel<=openedLevel)continue;
   const p=l.position||o.geometry?.center||[0,0];
   const [x,y]=screenAt(p[0],p[1]);
   const fontSize=Math.max(7,finite(l.fontSize,finite(defaultStyle.fontSize,12)));
   ctx.font=(l.fontWeight||"700")+" "+fontSize+"px system-ui, sans-serif";
   ctx.strokeStyle=htmlColor(l.outline,htmlColor(defaultStyle.stroke,"#061a22"));
   ctx.lineWidth=Math.max(0,finite(l.outlineWidth,finite(defaultStyle.strokeWidth,3)));
   if(ctx.lineWidth>0)ctx.strokeText(l.text,x,y,l.maxWidth||260);
   ctx.fillStyle=selected?.id===o.id?"#fff1ad":htmlColor(l.color,htmlColor(defaultStyle.color,"#ebf3f6"));
   ctx.fillText(l.text,x,y,l.maxWidth||260);
  }
  ctx.restore();
 }
 // Screen-space edit handles; only the selected geometry is changed.
 function editHandles(obj){
  const g=obj?.geometry||{};
  if(g.type==="rect"&&!rectRotation(g)){
   const x=g.x,y=g.y,w=g.width,h=g.height;
   return[
    ["nw",x,y],["n",x+w/2,y],["ne",x+w,y],
    ["e",x+w,y+h/2],["se",x+w,y+h],["s",x+w/2,y+h],
    ["sw",x,y+h],["w",x,y+h/2]
   ].map(([id,px,py])=>({id,point:[px,py]}));
  }
  if(["polygon","polyline"].includes(g.type))
   return(g.points||[]).map((point,i)=>({id:"vertex:"+i,point}));
  return[];
 }
 function hitEditHandle(x,y){
  if(!editMode||!selected)return null;
  const items=editHandles(selected);
  for(let i=items.length-1;i>=0;i--){
   const [sx,sy]=screenAt(...items[i].point);
   if(Math.hypot(x-sx,y-sy)<=11)return items[i];
  }
  return null;
 }
 function applyHandle(obj,handle,x,y){
  if(!obj||!handle)return false;
  const [wx,wy]=worldAt(x,y),sx=snapWorld(wx,0),sy=snapWorld(wy,1),g=obj.geometry||{};
  if(handle.id.startsWith("vertex:")&&g.points){
   const index=Number(handle.id.slice(7)),pt=g.points[index];
   if(!pt||pt[0]===sx&&pt[1]===sy)return false;
   const previous=obj.objectType==="wall"?g.points.map(p=>[...p]):null;
   g.points[index]=[sx,sy];
   if(previous){
    for(const door of scene.objects.filter(o=>o.objectType==="door"&&o.opening?.wallId===obj.id&&
      o.geometry?.type==="polyline"&&o.geometry.points?.length===2)){
     const [p,q]=door.geometry.points,center=[(p[0]+q[0])/2,(p[1]+q[1])/2];let nearest=null;
     for(let i=1;i<previous.length;i++){
      const a=previous[i-1],b=previous[i],dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy;
      if(len2<1e-8)continue;
      const t=Math.max(0,Math.min(1,((center[0]-a[0])*dx+(center[1]-a[1])*dy)/len2));
      const distance=(center[0]-a[0]-dx*t)**2+(center[1]-a[1]-dy*t)**2;
      if(!nearest||distance<nearest.distance)nearest={i,t,distance};
     }
     if(!nearest)continue;
     const a=g.points[nearest.i-1],b=g.points[nearest.i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
     if(len<1e-5)continue;
     const width=Math.min(Number(door.opening.width)||Math.hypot(p[0]-q[0],p[1]-q[1]),len*.8);
     const half=width/(2*len),t=Math.max(half,Math.min(1-half,nearest.t));
     door.geometry.points=[[a[0]+dx*(t-half),a[1]+dy*(t-half)],
                           [a[0]+dx*(t+half),a[1]+dy*(t+half)]];
     door.opening.width=width;
    }
   }
   return true;
  }
  if(g.type!=="rect")return false;
  const right=g.x+g.width,bottom=g.y+g.height;
  let left=g.x,top=g.y,r=right,b=bottom;
  const min=editorGrid.snap?Math.max(.001,editorGrid.spacing*editorGrid.fraction):.001;
  if(handle.id.includes("w"))left=Math.min(sx,r-min);
  if(handle.id.includes("e"))r=Math.max(sx,left+min);
  if(handle.id.includes("n"))top=Math.min(sy,b-min);
  if(handle.id.includes("s"))b=Math.max(sy,top+min);
  if(left===g.x&&top===g.y&&r===right&&b===bottom)return false;
  g.x=left;g.y=top;g.width=r-left;g.height=b-top;
  // Keep an explicit, centered label anchored to the new geometry.
  if(Array.isArray(obj.label?.position)&&handleDrag?.startGeometry){
   const initial=handleDrag.startGeometry;
   const xRatio=initial.width? (handleDrag.startLabel?.[0]-initial.x)/initial.width:.5;
   const yRatio=initial.height?(handleDrag.startLabel?.[1]-initial.y)/initial.height:.5;
   if(handleDrag.startLabel){
    obj.label.position=[left+g.width*xRatio,top+g.height*yRatio];
   }
  }
  return true;
 }
 function drawEditHandles(){
  if(!editMode||!selected||!visible(selected))return;
  const handles=editHandles(selected);
  if(!handles.length)return;
  ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);
  for(const h of handles){
   const [sx,sy]=screenAt(...h.point);
   ctx.beginPath();ctx.rect(sx-5,sy-5,10,10);
   ctx.fillStyle="#f2cb80";ctx.fill();
   ctx.strokeStyle="#18333d";ctx.lineWidth=1.4;ctx.stroke();
  }
  ctx.restore();
 }
 function draw(){
  geoCredit.hidden=!scene?.settings?.georeference;
  demCredit.hidden=!scene?.settings?.georeference?.terrainVerified;
  if(!canvas.width||!canvas.height)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle=htmlColor(scene?.coordinateSystem?.background,"#0b1d27");
  ctx.fillRect(0,0,width,height);
  if(!scene)return;
  const [u,v]=getAxes(),s=scale(),[cu,cv]=project(...center());
  ctx.setTransform(dpr*s*u[0],dpr*s*v[0],dpr*s*u[1],dpr*s*v[1],
   dpr*(width/2+panX-s*cu),dpr*(height/2+panY-s*cv));
  const list=sortedVisible();
  linkedDoors.clear();
  for(const item of scene.objects)if((item.objectType==="door"||item.objectType==="window")&&item.opening?.wallId){
   const key=item.opening.wallId;
   if(!linkedDoors.has(key))linkedDoors.set(key,[]);
   linkedDoors.get(key).push(item);
  }
  // Grid is a regular ranked rendering pass, not a special background overlay.
  const gridRank=finite(scene.layers?.find(l=>l.id==="grid")?.zIndex,5);
  const passes=list.map((obj,i)=>({kind:"object",rank:layerRank(obj),i,obj}));
  if(getPreviewGridVisible())passes.push({kind:"grid",rank:gridRank,i:-1});
  passes.sort((a,b)=>a.rank-b.rank||a.i-b.i);
  for(const pass of passes){
   if(pass.kind==="grid")drawGrid();
   else traceStroke(pass.obj,false);
  }
  if(selected&&visible(selected)){
   if(opts.editorSelectionEmphasis){
    const g=selected.geometry||{};
    ctx.save();
    // Opt-in editor-only halo; never change saved geometry or styling.
    if(g.type==="rect"&&rectRotation(g)){
     const cx=g.x+g.width/2,cy=g.y+g.height/2;
     ctx.translate(cx,cy);ctx.rotate(rectRotation(g)*Math.PI/180);ctx.translate(-cx,-cy);
    }
    if(g.type!=="none"&&trace(ctx,g)){
     if(g.type==="rect"||g.type==="polygon"||g.type==="circle"||g.type==="ring"){
      ctx.fillStyle="rgba(255,211,110,.15)";
      ctx.fill(g.type==="ring"?"evenodd":"nonzero");
     }
     ctx.strokeStyle="#ffbd56";ctx.lineWidth=6/Math.max(.0001,scale());
     ctx.lineJoin="round";ctx.stroke();
    }
    ctx.restore();
   }
   traceStroke(selected,true);
  }
  drawEditorGrid();
  drawLabels(list);
  drawStairIndicators(list);
  drawEditHandles();
  if(typeof opts.onFloorOverlayChanged==="function")opts.onFloorOverlayChanged(floorOverlayState());
  if(opts.zoomLabel)opts.zoomLabel.textContent=Math.round(zoom*100)+"%";
 }
 // Exterior scene is loaded first. Interiors are fetched only after selecting
 // the corresponding facility; repeated selections reuse the cached payload.
 async function ensureInterior(obj){
  if(!obj?.interiorSource||!scene||interiorLoaded.has(obj.id))return;
  // Freshly generated buildings already have their child objects in the editor.
  if(scene.objects.some(child=>child.parentId===obj.id)){
   interiorLoaded.add(obj.id);return;
  }
  const source=obj.interiorSource,key=sceneKey+"::"+obj.id,active=request;
  if(interiorPending.has(key))return interiorPending.get(key);
  const task=(async()=>{
   try{
    if(opts.onInteriorStatus)opts.onInteriorStatus(obj.id,"loading");
    let data=interiorCache.get(source);
    if(!data){
     const result=await fetch(source,{cache:"no-store"});
     if(!result.ok)throw Error("HTTP "+result.status);
     data=await result.json();
     if(data.schemaVersion!==2||data.buildingId!==obj.id||!Array.isArray(data.objects))
      throw Error("建物内部JSONの形式または建物IDが一致しません");
     const byId=new Map(data.objects.map(child=>[child.id,child]));
     if(byId.size!==data.objects.length||byId.has(obj.id))throw Error("建物内部JSONに重複IDがあります");
     for(const child of data.objects){
      if(!child.id)throw Error("建物内部JSONにIDのない設備があります");
      const seen=new Set();let current=child;
      while(current&&current.id!==obj.id&&!seen.has(current.id)){
       seen.add(current.id);
       current=current.parentId===obj.id?obj:byId.get(current.parentId);
      }
      if(current?.id!==obj.id)throw Error("建物内部JSONの親子参照が不正です: "+child.id);
     }
     interiorCache.set(source,data);
    }
    if(request!==active||!scene?.objects.some(o=>o.id===obj.id&&o.interiorSource===source))return;
    const seen=new Set(scene.objects.map(o=>o.id));
    if(data.objects.some(child=>seen.has(child.id)))throw Error("建物内部JSONのオブジェクトIDが街マップと衝突しています");
    const newObjects=data.objects;
    sceneCheck({...scene,objects:[...scene.objects,...newObjects]});
    scene.objects.push(...JSON.parse(JSON.stringify(newObjects)));
    interiorLoaded.add(obj.id);
    if(opts.onInteriorLoaded)opts.onInteriorLoaded(obj.id,getScene());
    if(opts.onSelectionChanged)opts.onSelectionChanged(sceneKey,selected);
    if(opts.onInteriorStatus)opts.onInteriorStatus(obj.id,"loaded");
    draw();
   }catch(error){
    if(request===active){
     if(opts.onInteriorStatus)opts.onInteriorStatus(obj.id,"error",error.message);
     if(opts.hint)setHint("建物内部の読み込み失敗: "+error.message);
    }
   }finally{interiorPending.delete(key)}
  })();
  interiorPending.set(key,task);return task;
 }
 function showDetails(obj){
  selected=obj||null;
  const panel=opts.info;
  if(panel)panel.hidden=!selected;
  if(selected){
   opts.infoTitle.textContent=selected.name||selected.id;
   const meta=[selected.metadata?.roadType,selected.metadata?.status].filter(Boolean);
   opts.infoMeta.textContent=meta.join(" ｜ ");
   opts.infoText.textContent=selected.detail||"説明は登録されていません。";
  }
  draw();
  if(typeof opts.onSelectionChanged==="function")opts.onSelectionChanged(sceneKey,selected);
  if(selected?.interiorSource)void ensureInterior(selected);
 }
 function getHierarchy(){
  if(!scene)return{roots:[]};
  const floorParents=new Set(scene.objects.filter(o=>Array.isArray(o.floors)).map(o=>o.id));
  const candidates=scene.objects.filter(o=>o.objectType==="region"||o.objectType==="facility"||floorParents.has(o.parentId));
  const byId=new Map(candidates.map(o=>[o.id,o]));
  const children=new Map();
  for(const o of candidates){
   const parent=byId.has(o.parentId)?o.parentId:null;
   if(!children.has(parent))children.set(parent,[]);
   children.get(parent).push(o);
  }
  const build=(o,seen=new Set())=>{
   if(seen.has(o.id))return null;
   const next=new Set(seen);next.add(o.id);
   return{id:o.id,name:o.name||o.id,parentId:o.parentId||null,
    floorId:o.floorId||null,displayLevel:o.displayLevel??null,
    children:(children.get(o.id)||[]).map(c=>build(c,next)).filter(Boolean)};
  };
  return{roots:(children.get(null)||[]).map(o=>build(o)).filter(Boolean)};
 }
 function selectItemById(id,{focus=true,force=false}={}){
  const obj=scene?.objects.find(o=>o.id===id);
  if(!obj||(!force&&obj.selectable===false))return false;
  if(focus){
   const g=obj.geometry||{};
   if(Array.isArray(obj.floors)&&obj.floors.length){
    // Focus every interior-bearing footprint, including OSM polygon buildings.
    // A center-only pan left polygon interiors too small to inspect in the editor.
    let footprintWidth=0,footprintHeight=0;
    if(g.type==="rect"){
     footprintWidth=g.width;footprintHeight=g.height;
    }else if((g.type==="polygon"||g.type==="polyline")&&g.points?.length){
     const xs=g.points.map(p=>p[0]),ys=g.points.map(p=>p[1]);
     footprintWidth=Math.max(...xs)-Math.min(...xs);
     footprintHeight=Math.max(...ys)-Math.min(...ys);
    }else if(g.type==="circle"&&Number.isFinite(g.radius)){
     footprintWidth=g.radius*2;footprintHeight=g.radius*2;
    }
    if(footprintWidth>0&&footprintHeight>0){
     const axes=getAxes();
     const projectedWidth=Math.abs(axes[0][0])*footprintWidth+Math.abs(axes[0][1])*footprintHeight;
     const projectedHeight=Math.abs(axes[1][0])*footprintWidth+Math.abs(axes[1][1])*footprintHeight;
     const targetScale=Math.min(width/Math.max(1,projectedWidth*1.75),height/Math.max(1,projectedHeight*1.75));
     zoom=Math.min(30,Math.max(zoom,targetScale/Math.max(initialScale,.000001)));
    }
   }
   let p=obj.label?.position||g.center||[0,0];
   if(g.type==="rect")p=[g.x+g.width/2,g.y+g.height/2];
   if(g.type==="polygon"&&g.points?.length){
    p=[g.points.reduce((sum,v)=>sum+v[0],0)/g.points.length,
       g.points.reduce((sum,v)=>sum+v[1],0)/g.points.length];
   }
   const [u,v]=project(p[0],p[1]),[cu,cv]=project(...center());
   const preferred=scene?.settings?.selectionZoom?.[obj.displayLevel]??scene?.settings?.selectionZoom?.[obj.level];
   if(Number.isFinite(preferred))zoom=Math.max(zoom,preferred);
   panX=-(u-cu)*scale();panY=-(v-cv)*scale();
  }
  showDetails(obj);return true;
 }
 function clone(obj){return JSON.parse(JSON.stringify(obj))}
 function getScene(){return scene?clone(scene):null}
 function getSelected(){return selected?clone(selected):null}
 function getSelectionNavigation(){
  if(!scene)return null;
  const byId=new Map(scene.objects.map(o=>[o.id,o]));
  const current=selected?byId.get(selected.id):null;
  if(!current)return null;
  const parents=[],visited=new Set();
  let parent=byId.get(current.parentId);
  while(parent&&!visited.has(parent.id)){
   parents.unshift({id:parent.id,name:parent.name||parent.id,displayLevel:parent.displayLevel});
   visited.add(parent.id);parent=byId.get(parent.parentId);
  }
  const children=scene.objects.filter(o=>o.parentId===current.id&&
   (o.objectType==="region"||o.objectType==="facility"||o.floorId||
    scene.objects.some(child=>child.parentId===o.id)))
   .filter(o=>!o.floorId||getFloorContext()?.selectedFloorId===o.floorId)
   .map(o=>({id:o.id,name:o.name||o.id,displayLevel:o.displayLevel,floorId:o.floorId||null}));
  return{current:{id:current.id,name:current.name||current.id,displayLevel:current.displayLevel},
   parents,children};
 }

 function setEditMode(enabled){editMode=Boolean(enabled);objectDrag=null;handleDrag=null;draw();return editMode}
 function replaceScene(next,{preserveView=true,selectedId=null}={}){
  const valid=sceneCheck(clone(next));
  ++request;scene=valid;viewRootId=null;objectDrag=null;handleDrag=null;
  interiorLoaded.clear();
  for(const obj of scene.objects)if(obj.interiorSource&&scene.objects.some(child=>child.parentId===obj.id))interiorLoaded.add(obj.id);
  if(!preserveView){initialScale=computeScale();zoom=1;panX=0;panY=0}
  else initialScale=computeScale();
  setupModes();
  const id=selectedId||selected?.id;
  selected=id?scene.objects.find(o=>o.id===id)||null:null;
  if(opts.info)opts.info.hidden=!selected;
  if(selected&&opts.infoTitle){
   opts.infoTitle.textContent=selected.name||selected.id;
   opts.infoMeta.textContent=[selected.metadata?.roadType,selected.metadata?.status].filter(Boolean).join(" ｜ ");
   opts.infoText.textContent=selected.detail||"説明は登録されていません。";
  }
  renderLegend();draw();
  if(typeof opts.onLayoutLoaded==="function")opts.onLayoutLoaded(sceneKey,scene);
  if(typeof opts.onSelectionChanged==="function")opts.onSelectionChanged(sceneKey,selected);
  return true;
 }
 // Move a selected object with all loaded descendants and absolute anchors.
 // Coordinates remain world-relative, while floor IDs and references are unchanged.
 function translateSingle(obj,dx,dy){
  const geom=obj.geometry||{type:"none"};
  if(geom.type==="rect"){geom.x+=dx;geom.y+=dy}
  else if(geom.type==="polygon"||geom.type==="polyline"){
   for(const p of geom.points||[]){p[0]+=dx;p[1]+=dy}
  }else if(geom.type==="circle"||geom.type==="ring"){
   geom.center[0]+=dx;geom.center[1]+=dy;
  }
  if(Array.isArray(obj.label?.position)){
   obj.label.position[0]+=dx;obj.label.position[1]+=dy;
  }
  if(Array.isArray(obj.connection?.fromAnchor)){
   obj.connection.fromAnchor[0]+=dx;obj.connection.fromAnchor[1]+=dy;
  }
  if(Array.isArray(obj.connection?.toAnchor)){
   obj.connection.toAnchor[0]+=dx;obj.connection.toAnchor[1]+=dy;
  }
 }
 function descendantsOf(rootId){
  if(!scene)return[];
  const descendants=[],ids=new Set([rootId]);
  let added=true;
  while(added){
   added=false;
   for(const candidate of scene.objects){
    if(!ids.has(candidate.id)&&ids.has(candidate.parentId)){
     ids.add(candidate.id);descendants.push(candidate);added=true;
    }
   }
  }
  return descendants;
 }
 function translateObject(obj,dx,dy){
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||(!dx&&!dy))return;
  const moved=new Set([obj.id]);
  const descendants=descendantsOf(obj.id);
  for(const item of descendants)moved.add(item.id);
  for(const item of [obj,...descendants])translateSingle(item,dx,dy);
  // Wall dragging moves linked doors, but never moves a sibling twice
  // when the whole building containing both wall and door is dragged.
  const walls=[obj,...descendants].filter(item=>item.objectType==="wall");
  for(const wall of walls){
   for(const door of scene.objects){
    if(door.objectType==="door"&&door.opening?.wallId===wall.id&&!moved.has(door.id)){
     translateSingle(door,dx,dy);moved.add(door.id);
    }
   }
  }
 }

 function pick(px,py){
  if(!scene)return null;
  const [x,y]=worldAt(px,py),tol=8/scale();
  const candidates=sortedVisible().filter(o=>o.selectable!==false&&contains(o,x,y,tol));
  if(!candidates.length)return null;
  const lookup=new Map(scene.objects.map(o=>[o.id,o]));
  const ancestors=o=>{
   let n=o,ids=[];while(n){ids.unshift(n.id);n=lookup.get(n.parentId)}
   return ids;
  };
  // Choose the most specific visible object. Never force a large frame over
  // its nested rooms; declared selectable:false backgrounds are filtered above.
  // Children of the current selection remain the first navigation target.
  const descendants=selected?candidates.filter(o=>ancestors(o).includes(selected.id)&&o.id!==selected.id):[];
  const pool=descendants.length?descendants:candidates;
  const depth=o=>ancestors(o).length;
  const area=o=>{
   const g=o.geometry||{};
   if(g.type==="rect")return Math.abs(g.width*g.height);
   if(g.type==="circle")return Math.PI*g.radius*g.radius;
   if(g.type==="ring")return Math.PI*(g.outerRadius*g.outerRadius-g.innerRadius*g.innerRadius);
   if(g.type==="polygon"&&g.points?.length>=3)
    return Math.abs(g.points.reduce((sum,p,i)=>{const q=g.points[(i+1)%g.points.length];return sum+p[0]*q[1]-q[0]*p[1]},0))/2;
   return Infinity;
  };
  return pool.map((o,i)=>({o,i})).sort((a,b)=>
   depth(b.o)-depth(a.o)||area(a.o)-area(b.o)||layerRank(b.o)-layerRank(a.o)||b.i-a.i)[0].o;
 }
 function modeConfig(group){
  const declared=scene?.settings?.visibilityGroups?.[group]||{};
  const values=[...new Set((scene?.objects||[])
   .filter(o=>o.visibility?.modeGroup===group)
   .flatMap(o=>o.visibility?.modes||[]))];
  const options=Array.isArray(declared.options)&&declared.options.length?
   declared.options.map(o=>({id:o.id,label:o.label||o.id})):
   values.map(id=>({id,label:id}));
  if(!options.length)options.push({id:"all",label:"すべて"});
  const allowed=options.map(o=>o.id);
  const initial=allowed.includes(declared.default)?declared.default:allowed[0];
  return{label:declared.label||group,default:initial,options};
 }
 function groupIds(){
  return [...new Set([
   ...Object.keys(scene?.settings?.visibilityGroups||{}),
   ...(scene?.objects||[]).map(o=>o.visibility?.modeGroup).filter(Boolean)
  ])];
 }
 function setupModes(){
  groupModes={};
  for(const group of groupIds()){
   const conf=modeConfig(group),allowed=conf.options.map(o=>o.id);
   let stored=null;
   try{stored=localStorage.getItem("map-scene-mode:"+scene.id+":"+group)}catch(_){}
   groupModes[group]=allowed.includes(stored)?stored:conf.default;
  }
  renderModeControls();
 }
 function renderModeControls(){
  const groups=groupIds();
  if(opts.visibilityControls){
   const host=opts.visibilityControls;host.replaceChildren();
   for(const group of groups){
    const conf=modeConfig(group);
    const mode=groupModes[group]||conf.default;
    const button=document.createElement("button");button.type="button";
    button.className="menu-settings-button";
    button.textContent=conf.label+"："+(conf.options.find(o=>o.id===mode)?.label||mode);
    button.setAttribute("aria-label",conf.label+"の表示切替");
    button.addEventListener("click",()=>cycleMode(group));
    host.append(button);
   }
  }
  // Legacy hosts can provide a single button; it controls the first JSON group.
  if(roadButton){
   const group=groups[0],conf=group?modeConfig(group):null;
   const mode=groupModes[group]||conf?.default;
   roadButton.disabled=!group;
   roadButton.textContent=conf?conf.label+"："+(conf.options.find(o=>o.id===mode)?.label||mode):"表示切替なし";
  }
 }
 function setVisibilityMode(group,mode){
  if(!groupIds().includes(group))return false;
  const conf=modeConfig(group);
  if(!conf.options.some(o=>o.id===mode))return false;
  groupModes[group]=mode;
  try{localStorage.setItem("map-scene-mode:"+scene.id+":"+group,mode)}catch(_){}
  draw();renderLegend();renderModeControls();return true;
 }
 function cycleMode(group){
  const conf=modeConfig(group),options=conf.options.map(x=>x.id);
  if(!options.length)return false;
  const current=groupModes[group]||conf.default;
  return setVisibilityMode(group,options[(Math.max(0,options.indexOf(current))+1)%options.length]);
 }
 function getVisibilityGroups(){
  return groupIds().map(id=>({id,...modeConfig(id),current:groupModes[id]}));
 }
 function readPath(obj,path){
  if(!path)return undefined;
  return String(path).split(".").reduce((v,key)=>v==null?undefined:v[key],obj);
 }
 function renderLegend(){
  const host=opts.legendContent;if(!host)return;
  host.replaceChildren();
  if(!scene)return;
  // JSON decides which objects and labels belong to each legend section.
  for(const config of scene.settings?.legendGroups||[]){
   const filter=config.filter||{},seen=new Set();
   const entries=scene.objects.filter(o=>{
    if(filter.visibleOnly&& !visible(o))return false;
    if(Array.isArray(filter.displayLevels)&&!filter.displayLevels.includes(o.displayLevel))return false;
    if(Array.isArray(filter.levels)&&!filter.levels.includes(o.level))return false;
    if(Array.isArray(filter.objectTypes)&&!filter.objectTypes.includes(o.objectType))return false;
    if(Array.isArray(filter.layers)&&!filter.layers.includes(o.layer))return false;
    const key=readPath(o,config.uniqueBy)||o.id;
    if(seen.has(key))return false;
    seen.add(key);return true;
   });
   if(!entries.length)continue;
   const row=document.createElement("div");row.className="legend-section";
   const heading=document.createElement("strong");heading.textContent=config.title||"凡例";row.append(heading);
   const items=document.createElement("div");items.className="legend-items";
   for(const o of entries){
    const span=document.createElement("span");span.className="legend-item";
    const swatch=document.createElement("i");
    swatch.className=config.swatch==="line"?"legend-line":"legend-swatch";
    swatch.style.backgroundColor=o.style?.stroke||o.style?.fill||"#929da5";
    const txt=document.createElement("span");
    txt.textContent=String(readPath(o,config.displayField)||o.name||o.id);
    span.append(swatch,txt);items.append(span);
   }
   row.append(items);host.append(row);
  }
 }
 function setLegend(value){
  legendEnabled=Boolean(value);
  opts.legend.hidden=!legendEnabled;
  legendButton.setAttribute("aria-pressed",String(legendEnabled));
  legendButton.textContent="色の凡例："+(legendEnabled?"ON":"OFF");
  try{localStorage.setItem("map-scene-legend",String(legendEnabled))}catch(_){}
 }
 if(legendButton)legendButton.addEventListener("click",()=>setLegend(!legendEnabled));
 if(roadButton)roadButton.addEventListener("click",()=>{const group=groupIds()[0];if(group)cycleMode(group)});
 if(opts.infoClose)opts.infoClose.addEventListener("click",()=>showDetails(null));
 if(opts.zoomIn)opts.zoomIn.addEventListener("click",()=>zoomAt(1.3,width/2,height/2));
 if(opts.zoomOut)opts.zoomOut.addEventListener("click",()=>zoomAt(1/1.3,width/2,height/2));
 if(opts.zoomReset)opts.zoomReset.addEventListener("click",reset);
 setLegend(legendEnabled);
 async function show(mapId,viewId,source){
  const key=[mapId,viewId||"",source||""].join("::");
  if(key===projection&&scene)return;
  projection=key;sceneKey=mapId;selected=null;viewRootId=null;scene=null;interiorLoaded.clear();
  if(opts.info)opts.info.hidden=true;
  reset();
  const myRequest=++request;
  if(opts.onSelectionChanged)opts.onSelectionChanged(mapId,null);
  if(!source){
   setHint("シーンデータが未登録です");
   if(opts.onLayoutLoaded)opts.onLayoutLoaded(mapId,null);
   return;
  }
  setHint("シーンを読み込み中…");
  try{
   let json=memory.get(source);
   if(!json){const result=await fetch(source,{cache:"no-store"});
    if(!result.ok)throw Error("HTTP "+result.status);
    const raw=await result.json();
    json=sceneCheck(window.AAMapPackedScene?await window.AAMapPackedScene.unpack(raw):raw);
    memory.set(source,json)}
   if(request!==myRequest)return;
   scene=json;initialScale=computeScale();zoom=1;panX=0;panY=0;
   setupModes();draw();renderLegend();setHint("");
   if(opts.onLayoutLoaded)opts.onLayoutLoaded(mapId,scene);
  }catch(error){
   if(request!==myRequest)return;
   setHint("描画データの読み込みに失敗: "+error.message);
   if(opts.onLayoutError)opts.onLayoutError(mapId,error.message);
  }
 }
 function setHint(message){
  if(!opts.hint)return;
  opts.hint.textContent=message||"";
  opts.hint.hidden=!message;
 }
 function resize(){
  // Map canvas can occupy only part of its host (e.g. a reserved detail footer).
  // Always use canvas client dimensions for drawing and pointer coordinates.
  const rect=canvas.getBoundingClientRect();
  width=Math.max(1,rect.width);height=Math.max(1,rect.height);dpr=Math.min(2,global.devicePixelRatio||1);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  initialScale=computeScale();
  draw();
 }
 const observer=new ResizeObserver(resize);observer.observe(host);observer.observe(canvas);resize();
 const pos=e=>{const r=canvas.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
 canvas.addEventListener("wheel",e=>{e.preventDefault();const [x,y]=pos(e);zoomAt(e.deltaY<0?1.15:1/1.15,x,y)},{passive:false});
 // Double-click a selected polygon/polyline edge to insert a vertex.
 // Alt-click an existing vertex to remove it (minimum 3 / 2 retained).
 // Editor property buttons provide the same actions on touch devices.
 canvas.addEventListener("dblclick",e=>{
  if(!editMode||!selected||!["polygon","polyline"].includes(selected.geometry?.type))return;
  const points=selected.geometry.points,[x,y]=pos(e);
  const count=selected.geometry.type==="polygon"?points.length:points.length-1;
  let near=null;
  for(let i=0;i<count;i++){
   const a=screenAt(...points[i]),b=screenAt(...points[(i+1)%points.length]);
   const distance=segmentDistance(x,y,a,b);
   if(distance<=12&&(!near||distance<near.distance))near={i,distance};
  }
  if(!near)return;
  e.preventDefault?.();
  const [wx,wy]=worldAt(x,y),point=[snapWorld(wx,0),snapWorld(wy,1)];
  if(typeof opts.onBeforeObjectDrag==="function")opts.onBeforeObjectDrag(getScene(),selected.id);
  points.splice(near.i+1,0,point);
  draw();
  if(typeof opts.onObjectMoved==="function")opts.onObjectMoved(clone(selected),getScene());
 });
 canvas.addEventListener("pointerdown",e=>{
  canvas.setPointerCapture(e.pointerId);
  const [x,y]=pos(e);pointers.set(e.pointerId,{x,y});
  dragged=false;dragStart={x,y};
  const handle=pointers.size===1?hitEditHandle(x,y):null;
  if(e.altKey&&handle?.id.startsWith("vertex:")&&selected?.geometry?.points){
   const points=selected.geometry.points;
   if(points.length>(selected.geometry.type==="polygon"?3:2)){
    if(typeof opts.onBeforeObjectDrag==="function")opts.onBeforeObjectDrag(getScene(),selected.id);
    points.splice(Number(handle.id.slice(7)),1);draw();
    if(typeof opts.onObjectMoved==="function")opts.onObjectMoved(clone(selected),getScene());
    suppressClick=true;return;
   }
  }
  if(handle&&selected){
   handleDrag={id:selected.id,handle,startGeometry:clone(selected.geometry),
    startLabel:Array.isArray(selected.label?.position)?[...selected.label.position]:null,
    x,y,moved:false};
   if(typeof opts.onBeforeObjectDrag==="function")opts.onBeforeObjectDrag(getScene(),selected.id);
  }else if(editMode&&selected&&
   contains(selected,...worldAt(x,y),8/scale())){
   objectDrag={id:selected.id,x,y,moved:false};
   if(typeof opts.onBeforeObjectDrag==="function")opts.onBeforeObjectDrag(getScene(),selected.id);
  }
  if(pointers.size===2){objectDrag=null;handleDrag=null;
   const list=[...pointers.values()],a=list[0],b=list[1];
   pinch={x:(a.x+b.x)/2,y:(a.y+b.y)/2,dist:Math.hypot(a.x-b.x,a.y-b.y)||1};
  }
 });
 canvas.addEventListener("pointermove",e=>{
  const old=pointers.get(e.pointerId);if(!old)return;
  const [x,y]=pos(e);pointers.set(e.pointerId,{x,y});
  if(dragStart&&Math.hypot(x-dragStart.x,y-dragStart.y)>4)dragged=true;
  if(handleDrag&&pointers.size===1&&selected?.id===handleDrag.id){
   if(Math.hypot(x-handleDrag.x,y-handleDrag.y)>3){
    if(selected.interiorSource&&!interiorLoaded.has(selected.id)&&
       !scene.objects.some(child=>child.parentId===selected.id)){
     setHint("建物内部を読み込んでからサイズ変更してください");return;
    }
    if(applyHandle(selected,handleDrag.handle,x,y)){
     handleDrag.moved=true;draw();
     if(typeof opts.onObjectChanging==="function")opts.onObjectChanging(selected,scene);
    }
   }
  }else if(objectDrag&&pointers.size===1&&selected?.id===objectDrag.id){
   const [ax,ay]=worldAt(old.x,old.y),[bx,by]=worldAt(x,y);
   if(selected.interiorSource&&!interiorLoaded.has(selected.id)&&!scene.objects.some(child=>child.parentId===selected.id)){
    setHint("建物内部の読み込みが完了してから移動してください");
    return;
   }
   if(Math.hypot(x-objectDrag.x,y-objectDrag.y)>4){
    const dx=bx-ax,dy=by-ay;
    if(dx||dy){translateObject(selected,dx,dy);objectDrag.moved=true;draw();if(typeof opts.onObjectChanging==="function")opts.onObjectChanging(selected,scene)}
   }
  }else if(pointers.size===2){
   const [a,b]=[...pointers.values()],mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
   const dist=Math.hypot(a.x-b.x,a.y-b.y)||1;
   if(pinch){zoomAt(dist/pinch.dist,mx,my);panX+=mx-pinch.x;panY+=my-pinch.y;draw()}
   pinch={x:mx,y:my,dist};dragged=true;
  }else if(pointers.size===1){panX+=x-old.x;panY+=y-old.y;draw()}
 });
 function end(e){
  if(!pointers.has(e.pointerId))return;
  const [x,y]=pos(e),clicked=pointers.size===1&&!dragged&&
   dragStart&&Math.hypot(x-dragStart.x,y-dragStart.y)<5;
  pointers.delete(e.pointerId);
  if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  if(!pointers.size){pinch=null;dragStart=null}
  const editedObject=handleDrag?.moved&&scene?.objects.find(o=>o.id===handleDrag.id);
  const movedObject=objectDrag?.moved&&scene?.objects.find(o=>o.id===objectDrag.id);
  if(movedObject&&editorGrid.snap){
   const g=movedObject.geometry||{},point=g.type==="rect"?[g.x,g.y]:g.center||g.points?.[0];
   if(point){const dx=snapWorld(point[0],0)-point[0],dy=snapWorld(point[1],1)-point[1];translateObject(movedObject,dx,dy);draw()}
  }
  objectDrag=null;handleDrag=null;
  if(suppressClick){suppressClick=false;return}
  if(editedObject){
   if(typeof opts.onObjectMoved==="function")opts.onObjectMoved(clone(editedObject),getScene());
  }else if(movedObject){
   if(typeof opts.onObjectMoved==="function")opts.onObjectMoved(clone(movedObject),getScene());
  }else if(clicked&&!suppressClick){
   const hit=pick(x,y);
   const choice=!editMode&&hit?.objectType==="stair"?stairDirectionalHit(hit,x,y):null;
   if(choice){
    if(choice.destination){
     showDetails(hit);
     if(!setFloor(choice.destination.id))showDetails(hit);
    }else showDetails(hit); // A disabled direction never moves floors.
   }else if(!editMode&&hit?.objectType==="stair"&&hit.connection?.toFloorId){
    // Legacy single-destination stair behavior stays intact.
    showDetails(hit);
    if(!setFloor(hit.connection.toFloorId))showDetails(hit);
   }else showDetails(hit||(viewRootId?scene.objects.find(o=>o.id===viewRootId):null));
  }
 }
 canvas.addEventListener("pointerup",end);
 canvas.addEventListener("pointercancel",end);
 return{zoomBy:(factor)=>zoomAt(factor,width/2,height/2),show,reset,getHierarchy,selectItemById,enterItem,exitItem,getViewRoot,getViewRootPath,navigateToItem,getScene,getSelected,getSelectionNavigation,getFloorContext,setFloor,initialDisplayLevel,replaceScene,setEditMode,setEditorGrid,snapPoint:([x,y])=>[snapWorld(x,0),snapWorld(y,1)],
  getVisibilityGroups,setVisibilityMode,setPreviewGridVisible,getPreviewGridVisible,screenToWorld:worldAt,redraw:draw};
}
global.AAMapViewer={create,sceneCheck,inPolygon,contains};
})(window);
