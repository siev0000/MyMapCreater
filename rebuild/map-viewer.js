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
  if(obj.style?.opacity!==undefined&&(!Number.isFinite(obj.style.opacity)||obj.style.opacity<0||obj.style.opacity>1))throw Error("透過率が不正です: "+obj.id);
  if(obj.style?.strokeWidth!==undefined&&(!Number.isFinite(obj.style.strokeWidth)||obj.style.strokeWidth<0))throw Error("線幅が不正です: "+obj.id);
 }
 const lookup=new Map(scene.objects.map(o=>[o.id,o]));
 for(const obj of scene.objects){
  if(obj.parentId&&!ids.has(obj.parentId))throw Error("存在しない親ID: "+obj.id);
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
function contains(obj,x,y,tolerance){
 const g=obj.geometry||{type:"none"};
 switch(g.type){
  case "rect":return x>=g.x&&x<=g.x+g.width&&y>=g.y&&y<=g.y+g.height;
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
 const legendButton=opts.legendButton,roadButton=opts.roadButton;
 const memory=new Map(),pointers=new Map();
 let scene=null,selected=null,viewRootId=null,sceneKey="",request=0,projection=null;
 let width=1,height=1,dpr=1,zoom=1,panX=0,panY=0,initialScale=1;
 let dragStart=null,dragged=false,pinch=null,legendEnabled=false,groupModes={},editMode=false,objectDrag=null;
 let editorGrid={visible:false,spacing:2,snap:false,fraction:.5,originX:0,originY:0};
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
 function traceStroke(obj,emphasized=false){
  const st=obj.style||{},g=obj.geometry;
  if(!g||g.type==="none")return;
  ctx.save();
  ctx.globalAlpha=emphasized?1:clamp(finite(st.opacity,1),0,1);
  ctx.lineJoin=st.lineJoin||"round";ctx.lineCap=st.lineCap||"round";
  const ok=trace(ctx,g);
  if(ok){
   if(!emphasized&&st.fill){ctx.fillStyle=st.fill;ctx.fill(g.type==="ring"?"evenodd":"nonzero")}
   if(emphasized||st.stroke){
    ctx.strokeStyle=emphasized?(scene?.settings?.selectionStyle?.stroke||"#ffefa7"):st.stroke;
    ctx.lineWidth=(emphasized?2.3:Math.max(.15,finite(st.strokeWidth,1)))/scale();
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
  const grid=scene?.grid;if(!grid?.visible)return;
  const b=bounds(),spacing=Math.max(1,finite(grid.spacing,100));
  ctx.save();ctx.lineWidth=Math.max(.1,finite(grid.strokeWidth,.6))/scale();
  ctx.strokeStyle=htmlColor(grid.stroke,"#94b4c0");
  ctx.beginPath();
  for(let x=Math.ceil(b.minX/spacing)*spacing;x<=b.maxX;x+=spacing){ctx.moveTo(x,b.minY);ctx.lineTo(x,b.maxY)}
  for(let y=Math.ceil(b.minY/spacing)*spacing;y<=b.maxY;y+=spacing){ctx.moveTo(b.minX,y);ctx.lineTo(b.maxX,y)}
  ctx.stroke();ctx.restore();
 }
 function drawLabels(objects){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.save();
  ctx.textBaseline="middle";ctx.textAlign="center";
  const defaultStyle=scene?.settings?.labelDefaults||{};
  for(const o of objects){
   const l=o.label||{};
   if(l.visible===false||!l.text)continue;
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
 function draw(){
  if(!canvas.width||!canvas.height)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle=htmlColor(scene?.coordinateSystem?.background,"#0b1d27");
  ctx.fillRect(0,0,width,height);
  if(!scene)return;
  const [u,v]=getAxes(),s=scale(),[cu,cv]=project(...center());
  ctx.setTransform(dpr*s*u[0],dpr*s*v[0],dpr*s*u[1],dpr*s*v[1],
   dpr*(width/2+panX-s*cu),dpr*(height/2+panY-s*cv));
  const list=sortedVisible();
  // Grid is a regular ranked rendering pass, not a special background overlay.
  const gridRank=finite(scene.layers?.find(l=>l.id==="grid")?.zIndex,5);
  const passes=list.map((obj,i)=>({kind:"object",rank:layerRank(obj),i,obj}));
  if(scene.grid?.visible)passes.push({kind:"grid",rank:gridRank,i:-1});
  passes.sort((a,b)=>a.rank-b.rank||a.i-b.i);
  for(const pass of passes){
   if(pass.kind==="grid")drawGrid();
   else traceStroke(pass.obj,false);
  }
  if(selected&&visible(selected))traceStroke(selected,true);
  drawEditorGrid();
  drawLabels(list);
  if(opts.zoomLabel)opts.zoomLabel.textContent=Math.round(zoom*100)+"%";
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
   if(Array.isArray(obj.floors)&&obj.floors.length&&g.type==="rect"){
    const targetScale=Math.min(width/Math.max(1,g.width*1.75),height/Math.max(1,g.height*1.75));
    zoom=Math.min(30,Math.max(zoom,targetScale/Math.max(initialScale,.000001)));
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

 function setEditMode(enabled){editMode=Boolean(enabled);objectDrag=null;return editMode}
 function replaceScene(next,{preserveView=true,selectedId=null}={}){
  const valid=sceneCheck(clone(next));
  ++request;scene=valid;viewRootId=null;objectDrag=null;
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
 function translateObject(obj,dx,dy){
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
  projection=key;sceneKey=mapId;selected=null;viewRootId=null;scene=null;
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
    json=sceneCheck(await result.json());memory.set(source,json)}
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
 canvas.addEventListener("pointerdown",e=>{
  canvas.setPointerCapture(e.pointerId);
  const [x,y]=pos(e);pointers.set(e.pointerId,{x,y});
  dragged=false;dragStart={x,y};
  if(editMode&&selected&&
   contains(selected,...worldAt(x,y),8/scale())){
   objectDrag={id:selected.id,x,y,moved:false};
   if(typeof opts.onBeforeObjectDrag==="function")opts.onBeforeObjectDrag(getScene(),selected.id);
  }
  if(pointers.size===2){objectDrag=null;
   const list=[...pointers.values()],a=list[0],b=list[1];
   pinch={x:(a.x+b.x)/2,y:(a.y+b.y)/2,dist:Math.hypot(a.x-b.x,a.y-b.y)||1};
  }
 });
 canvas.addEventListener("pointermove",e=>{
  const old=pointers.get(e.pointerId);if(!old)return;
  const [x,y]=pos(e);pointers.set(e.pointerId,{x,y});
  if(dragStart&&Math.hypot(x-dragStart.x,y-dragStart.y)>4)dragged=true;
  if(objectDrag&&pointers.size===1&&selected?.id===objectDrag.id){
   const [ax,ay]=worldAt(old.x,old.y),[bx,by]=worldAt(x,y);
   if(Math.hypot(x-objectDrag.x,y-objectDrag.y)>4){
    const dx=bx-ax,dy=by-ay;
    if(dx||dy){translateObject(selected,dx,dy);objectDrag.moved=true;draw()}
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
  const movedObject=objectDrag?.moved&&scene?.objects.find(o=>o.id===objectDrag.id);
  if(movedObject&&editorGrid.snap){
   const g=movedObject.geometry||{},point=g.type==="rect"?[g.x,g.y]:g.center||g.points?.[0];
   if(point){const dx=snapWorld(point[0],0)-point[0],dy=snapWorld(point[1],1)-point[1];translateObject(movedObject,dx,dy);draw()}
  }
  objectDrag=null;
  if(movedObject){
   if(typeof opts.onObjectMoved==="function")opts.onObjectMoved(clone(movedObject),getScene());
  }else if(clicked){
   const hit=pick(x,y);
   if(hit?.objectType==="stair"&&hit.connection?.toFloorId){
    // A stair switches the physical floor of its owning building, never the
    // display level or the surrounding map.
    showDetails(hit);
    if(!setFloor(hit.connection.toFloorId))showDetails(hit);
   }else showDetails(hit||(viewRootId?scene.objects.find(o=>o.id===viewRootId):null));
  }
 }
 canvas.addEventListener("pointerup",end);
 canvas.addEventListener("pointercancel",end);
 return{show,reset,getHierarchy,selectItemById,enterItem,exitItem,getViewRoot,getViewRootPath,navigateToItem,getScene,getSelected,getSelectionNavigation,getFloorContext,setFloor,initialDisplayLevel,replaceScene,setEditMode,setEditorGrid,snapPoint:([x,y])=>[snapWorld(x,0),snapWorld(y,1)],
  getVisibilityGroups,setVisibilityMode,screenToWorld:worldAt,redraw:draw};
}
global.AAMapViewer={create,sceneCheck,inPolygon,contains};
})(window);
