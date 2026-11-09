/* Generic JSON Scene v2 editor: all behavior is based on scene objects, never map IDs. */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const copy=value=>JSON.parse(JSON.stringify(value));
const number=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const notice=(message,kind="")=>{$("message").className=kind;$("message").textContent=message};
const input=id=>$(id).value;
const checked=id=>$(id).checked;
const state={scene:null,selectedId:null,options:[],undo:[],redo:[],dragBefore:null,
 savingName:"",dirty:false,internal:false,currentOptionKey:null,batchIds:new Set()};
let viewer;
const gridDefaults={visible:true,snap:true,spacing:2,fraction:.5,originX:0,originY:0};
let gridState={...gridDefaults};
function readGridFields(){
 const spacing=Number(input("editor-grid-spacing"));
 const fraction=Number(input("editor-grid-fraction"));
 const originX=Number(input("editor-grid-origin-x")),originY=Number(input("editor-grid-origin-y"));
 if(!Number.isFinite(spacing)||spacing<=0||!Number.isFinite(originX)||!Number.isFinite(originY)||![.5,1].includes(fraction)){
  notice("グリッド値が不正です。マス幅は正の数、原点は数値、補助スナップは0.5または1を指定してください。","error");return null;
 }
 return{spacing,fraction,originX,originY,visible:checked("editor-grid-visible"),snap:checked("editor-grid-snap")};
}
function setGridInputs(config){
 gridState={...gridDefaults,...config};
 $("editor-grid-spacing").value=gridState.spacing;
 $("editor-grid-fraction").value=String(gridState.fraction);
 $("editor-grid-origin-x").value=gridState.originX;
 $("editor-grid-origin-y").value=gridState.originY;
 $("editor-grid-visible").checked=gridState.visible;
 $("editor-grid-snap").checked=gridState.snap;
 viewer?.setEditorGrid(gridState);
}
function updateGridPreview(){
 const value=readGridFields();
 if(!value)return;
 gridState=value;viewer?.setEditorGrid(gridState);
}
function snapPoint(p){
 return viewer&&gridState.snap?viewer.snapPoint(p):p;
}
function snapGeometry(g){
 if(!gridState.snap)return g;
 const step=gridState.spacing*gridState.fraction;
 const snap=(value,axis)=>{const origin=axis===0?gridState.originX:gridState.originY;return origin+Math.round((value-origin)/step)*step};
 if(g.type==="rect"){g.x=snap(g.x,0);g.y=snap(g.y,1);g.width=Math.max(step,Math.round(g.width/step)*step);g.height=Math.max(step,Math.round(g.height/step)*step)}
 else if(g.type==="circle"||g.type==="ring"){g.center=[snap(g.center[0],0),snap(g.center[1],1)]}
 else if(g.points){g.points=g.points.map(p=>[snap(p[0],0),snap(p[1],1)])}
 return g;
}

function sceneNow(){return viewer?.getScene()||state.scene}
function buttonStatus(){
 $("undo").disabled=!state.undo.length;
 $("redo").disabled=!state.redo.length;
 $("clone-object").disabled=!state.selectedId;
 $("delete-object").disabled=!state.selectedId;
 document.title=(state.dirty?"● ":"")+(sceneNow()?.name||"マップ")+"｜汎用マップ編集";
}
function setDirty(value){state.dirty=Boolean(value);buttonStatus()}
function pushUndo(value){exteriorExported=false;interiorExported.clear();state.undo.push(copy(value));if(state.undo.length>60)state.undo.shift();state.redo.length=0;setDirty(true)}
function centerOf(geom){
 const g=geom||{type:"none"};
 if(g.type==="rect")return[g.x+g.width/2,g.y+g.height/2];
 if(g.type==="circle"||g.type==="ring")return [...g.center];
 if(["polygon","polyline"].includes(g.type)&&g.points?.length){
  return[g.points.reduce((x,p)=>x+p[0],0)/g.points.length,
   g.points.reduce((y,p)=>y+p[1],0)/g.points.length];
 }
 const p=sceneNow()?.coordinateSystem?.bounds;
 return p?[(p.minX+p.maxX)/2,(p.minY+p.maxY)/2]:[0,0];
}
function shapeOf(type,p){
 const [x,y]=p;
 if(type==="rect")return{type,x:x-65,y:y-45,width:130,height:90};
 if(type==="circle")return{type,center:[x,y],radius:65};
 if(type==="ring")return{type,center:[x,y],innerRadius:40,outerRadius:85};
 if(type==="polyline")return{type,points:[[x-80,y],[x+80,y]]};
 if(type==="polygon")return{type,points:[[x-75,y-45],[x+75,y-45],[x+75,y+45],[x-75,y+45]]};
 return{type:"none"};
}
function showNewLayerChoices(){
 const data=sceneNow(),picker=$("new-layer");
 if(!data||!picker)return;
 const previous=picker.value;
 const entries=(data.layers||[]).map(x=>[x.id,x.id+" (z:"+String(number(x.zIndex,0))+")"]);
 if(!entries.length)entries.push(["objects","objects"]);
 const defaultLayer=entries.find(x=>x[0]===previous)?.[0]||
  entries.find(x=>{
   const layer=data.layers?.find(l=>l.id===x[0]);
   return number(layer?.zIndex,0)>=10;
  })?.[0]||entries[0][0];
 fillSelect(picker,entries,defaultLayer);
}
function batchMode(){return checked("batch-mode")}
function filteredObjects(){
 const q=input("object-search").trim().toLowerCase();
 return (sceneNow()?.objects||[]).filter(o=>!q||((o.name||"")+" "+o.id+" "+(o.objectType||"")).toLowerCase().includes(q));
}
function showObjects(){
 const list=$("objects"),data=sceneNow();
 list.replaceChildren();
 if(!data)return;
 const valid=new Set(data.objects.map(o=>o.id));
 for(const id of [...state.batchIds])if(!valid.has(id))state.batchIds.delete(id);
 const fragment=document.createDocumentFragment();
 for(const o of filteredObjects()){
  const item=document.createElement("button");item.type="button";
  item.className="object-entry";item.setAttribute("role","listitem");
  item.setAttribute("aria-current",String(state.selectedId===o.id));
  item.setAttribute("aria-pressed",String(state.batchIds.has(o.id)));
  const name=document.createElement("span");
  name.textContent=(batchMode()?(state.batchIds.has(o.id)?"☑ ":"☐ "):"")+
   (o.name||o.id)+(o.visible===false?" [非表示]":"");
  const meta=document.createElement("span");meta.className="meta";
  meta.textContent="Lv"+(o.displayLevel??1)+" · "+(o.objectType||"object");
  item.append(name,meta);
  item.addEventListener("click",()=>{
   if(batchMode()){
    if(state.batchIds.has(o.id))state.batchIds.delete(o.id);else state.batchIds.add(o.id);
    showObjects();
   }else viewer.selectItemById(o.id,{focus:true,force:true});
  });
  fragment.append(item);
 }
 list.append(fragment);
 $("batch-controls").classList.toggle("hidden",!batchMode());
 $("batch-count").textContent=state.batchIds.size+"件を選択";
}

function fillSelect(select,rows,value){
 select.replaceChildren();
 for(const [id,name] of rows){
  const o=document.createElement("option");o.value=id;o.textContent=name;select.append(o);
 }
 select.value=value;
}
for(const id of ["editor-grid-spacing","editor-grid-fraction","editor-grid-origin-x","editor-grid-origin-y"]){
 $(id).addEventListener("change",updateGridPreview);
}
for(const id of ["editor-grid-visible","editor-grid-snap"]){
 $(id).addEventListener("change",updateGridPreview);
}
$("editor-grid-save").addEventListener("click",()=>{
 const grid=readGridFields(),scene=sceneNow();
 if(!grid||!scene)return;
 const next=copy(scene);next.settings=next.settings||{};
 next.settings.editorGrid={spacing:grid.spacing,fraction:grid.fraction,originX:grid.originX,originY:grid.originY};
 if(applyScene(next,state.selectedId))notice("グリッドの座標換算・補助スナップ設定をJSONに反映しました。実寸0.5m/マスです。","success");
});
function translateSelectedBy(dx,dy){
 const current=sceneNow(),root=current?.objects.find(o=>o.id===state.selectedId);
 if(!root||!Number.isFinite(dx)||!Number.isFinite(dy))return false;
 if(!dx&&!dy)return true;
 if(root.interiorSource&&!current.objects.some(o=>o.parentId===root.id)){
  notice("建物内部を読み込んでから移動してください","error");return false;
 }
 const next=copy(current),byId=new Map(next.objects.map(o=>[o.id,o]));
 const ids=new Set([root.id]);let changed=true;
 while(changed){changed=false;for(const o of next.objects)
  if(!ids.has(o.id)&&ids.has(o.parentId)){ids.add(o.id);changed=true}}
 // If a wall is moved on its own, move linked doors as well.
 const walls=new Set([...ids].filter(id=>byId.get(id)?.objectType==="wall"));
 for(const obj of next.objects)if(obj.objectType==="door"&&walls.has(obj.opening?.wallId))ids.add(obj.id);
 for(const id of ids){
  const o=byId.get(id),g=o.geometry||{};
  if(g.type==="rect"){g.x+=dx;g.y+=dy}
  else if(g.type==="circle"||g.type==="ring"){g.center[0]+=dx;g.center[1]+=dy}
  else if(g.points)for(const p of g.points){p[0]+=dx;p[1]+=dy}
  if(Array.isArray(o.label?.position)){o.label.position[0]+=dx;o.label.position[1]+=dy}
  if(Array.isArray(o.connection?.fromAnchor)){o.connection.fromAnchor[0]+=dx;o.connection.fromAnchor[1]+=dy}
  if(Array.isArray(o.connection?.toAnchor)){o.connection.toAnchor[0]+=dx;o.connection.toAnchor[1]+=dy}
 }
 return applyScene(next,root.id);
}
// Batch editing does not introduce scene fields: only existing geometries move.
function batchRoots(data){
 const ids=new Set([...state.batchIds].filter(id=>data.objects.some(o=>o.id===id)));
 const byId=new Map(data.objects.map(o=>[o.id,o]));
 return data.objects.filter(o=>{
  if(!ids.has(o.id))return false;
  const seen=new Set();let parent=byId.get(o.parentId);
  while(parent&&!seen.has(parent.id)){
   if(ids.has(parent.id))return false;
   seen.add(parent.id);parent=byId.get(parent.parentId);
  }
  return true;
 });
}
function batchBounds(obj){
 const g=obj.geometry||{};
 let xs=[],ys=[];
 if(g.type==="rect"){
  const corners=[[g.x,g.y],[g.x+g.width,g.y],[g.x+g.width,g.y+g.height],[g.x,g.y+g.height]];
  const rad=(Number(g.rotation)||0)*Math.PI/180,cx=g.x+g.width/2,cy=g.y+g.height/2;
  for(const [x,y] of corners){
   xs.push(cx+(x-cx)*Math.cos(rad)-(y-cy)*Math.sin(rad));
   ys.push(cy+(x-cx)*Math.sin(rad)+(y-cy)*Math.cos(rad));
  }
 }else if(g.type==="circle"||g.type==="ring"){
  const rad=g.outerRadius??g.radius;xs=[g.center[0]-rad,g.center[0]+rad];ys=[g.center[1]-rad,g.center[1]+rad];
 }else if(Array.isArray(g.points)){xs=g.points.map(p=>p[0]);ys=g.points.map(p=>p[1])}
 else if(Array.isArray(obj.label?.position)){xs=[obj.label.position[0]];ys=[obj.label.position[1]]}
 if(!xs.length||!ys.length||!xs.every(Number.isFinite)||!ys.every(Number.isFinite))return null;
 const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
 return{left,right,top,bottom,centerX:(left+right)/2,centerY:(top+bottom)/2,width:right-left,height:bottom-top};
}
function batchTranslate(data,moves){
 const byId=new Map(data.objects.map(o=>[o.id,o])),offsets=new Map();
 for(const [rootId,delta] of moves){
  const root=byId.get(rootId);if(!root)continue;
  if(root.interiorSource&&!data.objects.some(o=>o.parentId===rootId))
   throw Error("建物内部を読み込んでから移動してください: "+(root.name||root.id));
  const ids=new Set([rootId]);let more=true;
  while(more){more=false;for(const o of data.objects){
   if(!ids.has(o.id)&&ids.has(o.parentId)){ids.add(o.id);more=true}
  }}
  const walls=new Set([...ids].filter(id=>byId.get(id)?.objectType==="wall"));
  for(const obj of data.objects)if(obj.objectType==="door"&&walls.has(obj.opening?.wallId))ids.add(obj.id);
  for(const id of ids){
   const previous=offsets.get(id);
   if(previous&&(previous[0]!==delta[0]||previous[1]!==delta[1]))
    throw Error("異なる移動量を指定した図形が子要素・扉を共有しています: "+id);
   offsets.set(id,delta);
  }
 }
 for(const [id,[dx,dy]] of offsets){
  const obj=byId.get(id),g=obj.geometry||{};
  if(g.type==="rect"){g.x+=dx;g.y+=dy}
  else if(g.type==="circle"||g.type==="ring"){g.center[0]+=dx;g.center[1]+=dy}
  else if(Array.isArray(g.points))for(const p of g.points){p[0]+=dx;p[1]+=dy}
  if(Array.isArray(obj.label?.position)){obj.label.position[0]+=dx;obj.label.position[1]+=dy}
  for(const key of ["fromAnchor","toAnchor"])if(Array.isArray(obj.connection?.[key])){
   obj.connection[key][0]+=dx;obj.connection[key][1]+=dy;
  }
 }
}
function batchCommit(action,minimum=1){
 const original=sceneNow();if(!original)return;
 const roots=batchRoots(original);
 if(roots.length<minimum){notice("選択する図形は"+minimum+"件以上必要です","error");return}
 try{
  const next=copy(original);
  const changed=action(next,roots);
  if(changed===false)return;
  if(applyScene(next,state.selectedId)){
   showObjects();
   notice(roots.length+"件をまとめて変更しました（未保存）","success");
  }
 }catch(error){notice("一括操作に失敗: "+error.message,"error")}
}
bind("batch-mode",()=>{if(!batchMode())state.batchIds.clear();showObjects()});
bind("batch-clear",()=>{state.batchIds.clear();showObjects()},"click");
bind("batch-select-visible",()=>{
 $("batch-mode").checked=true;
 for(const o of filteredObjects())state.batchIds.add(o.id);
 showObjects();
},"click");
bind("batch-move",()=>{
 const dx=Number(input("batch-dx")),dy=Number(input("batch-dy"));
 if(!Number.isFinite(dx)||!Number.isFinite(dy)){notice("移動量が数値ではありません","error");return}
 batchCommit((next,roots)=>{batchTranslate(next,new Map(roots.map(o=>[o.id,[dx,dy]])))});
},"click");
bind("batch-align-apply",()=>{
 const key=input("batch-align"),axis=["left","right","centerX"].includes(key)?"x":"y";
 if(!["left","right","centerX","top","bottom","centerY"].includes(key))return;
 batchCommit((next,roots)=>{
  const bounds=roots.map(o=>batchBounds(o));
  if(bounds.some(b=>!b))throw Error("外形のない図形は整列できません");
  const target=bounds[0][key];
  batchTranslate(next,new Map(roots.map((o,i)=>[o.id,axis==="x"?[target-bounds[i][key],0]:[0,target-bounds[i][key]]])));
 },2);
},"click");
bind("batch-distribute-apply",()=>{
 const axis=input("batch-distribute");if(!["x","y"].includes(axis))return;
 batchCommit((next,roots)=>{
  const entries=roots.map(o=>({o,b:batchBounds(o)}));
  if(entries.some(e=>!e.b))throw Error("外形のない図形は等間隔に配置できません");
  const start=axis==="x"?"left":"top",end=axis==="x"?"right":"bottom",length=axis==="x"?"width":"height";
  entries.sort((a,b)=>a.b[start]-b.b[start]);
  const extent=entries[entries.length-1].b[end]-entries[0].b[start];
  const total=entries.reduce((sum,e)=>sum+e.b[length],0);
  const gap=(extent-total)/(entries.length-1),deltas=new Map();
  let cursor=entries[0].b[start];
  for(const e of entries){
   const shift=cursor-e.b[start];
   deltas.set(e.o.id,axis==="x"?[shift,0]:[0,shift]);
   cursor+=e.b[length]+gap;
  }
  batchTranslate(next,deltas);
 },3);
},"click");
bind("batch-delete",()=>{
 const original=sceneNow();if(!original)return;
 const roots=batchRoots(original),ids=new Set(roots.map(o=>o.id));
 if(!ids.size){notice("削除対象を選択してください","error");return}
 for(const o of original.objects){
  if(ids.has(o.id))continue;
  if(ids.has(o.parentId)||ids.has(o.opening?.wallId)||
   ids.has(o.connection?.targetId)||ids.has(o.connection?.toObjectId)){
   notice("選択外の子オブジェクト・扉・接続から参照されています: "+o.id,"error");return;
  }
 }
 const next=copy(original);next.objects=next.objects.filter(o=>!ids.has(o.id));
 if(applyScene(next,ids.has(state.selectedId)?null:state.selectedId)){
  state.batchIds.clear();showObjects();notice(roots.length+"件を削除しました（未保存）","success");
 }
},"click");
function renderGeometry(obj){
 const g=obj.geometry||{type:"none"},target=$("geometry-fields");
 target.replaceChildren();
 function numeric(label,key,value,assign){
  const root=document.createElement("label");root.textContent=label;
  const field=document.createElement("input");field.type="number";field.step="any";
  field.value=Number.isFinite(value)?String(value):"0";
  field.addEventListener("change",()=>{
   const n=Number(field.value);
   if(!Number.isFinite(n)){notice("座標には数値を入力してください","error");return}
   const step=gridState.spacing*gridState.fraction;
   const axis=(key==="x"||key==="cx")?0:(key==="y"||key==="cy")?1:null;
   const value=gridState.snap&&step>0&&axis!==null
    ?snapPoint(axis===0?[n,0]:[0,n])[axis]
    :gridState.snap&&step>0&&["width","height"].includes(key)?Math.max(step,Math.round(n/step)*step):n;
   if(["x","y","cx","cy"].includes(key)){
    const current=sceneNow()?.objects.find(o=>o.id===state.selectedId);
    const origin=current?.geometry;
    const oldValue=origin?(key==="x"?origin.x:key==="y"?origin.y:key==="cx"?origin.center?.[0]:origin.center?.[1]):null;
    if(Number.isFinite(oldValue)){
     translateSelectedBy(key==="x"||key==="cx"?value-oldValue:0,key==="y"||key==="cy"?value-oldValue:0);
     return;
    }
   }
   changeObject(o=>assign(o.geometry,value));
  });
  root.append(field);return root;
 }
 function row(fields){
  const c=document.createElement("div");c.className="col2";
  for(const f of fields)c.append(f);target.append(c);
 }
 if(g.type==="rect"){
  row([numeric("X","x",g.x,(v,n)=>v.x=n),numeric("Y","y",g.y,(v,n)=>v.y=n),
   numeric("幅","width",g.width,(v,n)=>v.width=n),numeric("高さ","height",g.height,(v,n)=>v.height=n)]);
 }else if(g.type==="circle"||g.type==="ring"){
  const cx=numeric("中心 X","cx",g.center[0],(v,n)=>v.center[0]=n),
   cy=numeric("中心 Y","cy",g.center[1],(v,n)=>v.center[1]=n);
  const fields=[cx,cy];
  if(g.type==="circle")fields.push(numeric("半径","radius",g.radius,(v,n)=>v.radius=n));
  else fields.push(numeric("内半径","innerRadius",g.innerRadius,(v,n)=>v.innerRadius=n),numeric("外半径","outerRadius",g.outerRadius,(v,n)=>v.outerRadius=n));
  row(fields);
 }else if(g.type==="polygon"||g.type==="polyline"){
  const label=document.createElement("label");label.textContent="頂点座標 JSON（[[x,y], ...]）";
  const area=document.createElement("textarea");area.rows=5;area.value=JSON.stringify(g.points,null,2);
  area.addEventListener("change",()=>{
   try{
    const points=JSON.parse(area.value);
    changeObject(o=>{o.geometry.points=points});
   }catch(error){notice("頂点座標のJSONが不正です："+error.message,"error")}
  });
  label.append(area);target.append(label);
 }else{
  const p=document.createElement("p");p.className="note";p.textContent="図形はありません。必要に応じてラベルを設定できます。";
  target.append(p);
 }
}
function updateVertexControls(obj){
 const g=obj?.geometry,points=g?.points||[],enabled=g?.type==="polyline"||g?.type==="polygon";
 $("vertex-actions").classList.toggle("hidden",!enabled);
 const picker=$("vertex-index"),old=Number(picker.value);picker.replaceChildren();
 if(enabled)for(let i=0;i<points.length;i++){
  const option=document.createElement("option");option.value=String(i);
  option.textContent="頂点 "+(i+1)+" ["+points[i].map(n=>Number(n.toFixed(3))).join(", ")+"]";
  picker.append(option);
 }
 picker.value=enabled&&old>=0&&old<points.length?String(old):"0";
 $("vertex-delete").disabled=!enabled||points.length<=(g.type==="polygon"?3:2);
 $("rect-rotation-fields").classList.toggle("hidden",obj?.geometry?.type!=="rect");
 if(obj?.geometry?.type==="rect")$("obj-rotation").value=obj.geometry.rotation||0;
 const door=obj?.objectType==="door";
 $("door-wall-fields").classList.toggle("hidden",!door);
 if(door){
  const scene=sceneNow(),picker=$("door-wall-id");
  const opts=[["","（壁の関連付けなし）"],...(scene?.objects||[])
   .filter(o=>o.objectType==="wall"&&(!obj.floorId||o.floorId===obj.floorId))
   .map(o=>[o.id,o.name||o.id])];
  fillSelect(picker,opts,obj.opening?.wallId||"");
  $("door-type").value=obj.door?.type==="sliding"?"sliding":"hinged";
  $("door-leaf-count").value=obj.door?.leafCount===2?"2":"1";
  $("door-slide-direction").value=obj.door?.slideDirection==="start"?"start":"end";
  $("door-slide-fields").classList.toggle("hidden",obj.door?.type!=="sliding"||obj.door?.leafCount===2);
 }
 $("stair-direction-fields").classList.toggle("hidden",obj?.objectType!=="stair");
 if(obj?.objectType==="stair")$("stair-low-side").value=obj.stair?.lowSide||"";
 const geo=!!sceneNow()?.settings?.georeference;
 $("geo-height-fields").classList.toggle("hidden",!geo||!obj);
 if(geo&&obj){
  $("geo-elevation-m").value=Number.isFinite(obj.metadata?.elevationM)?String(obj.metadata.elevationM):"";
  $("geo-height-m").value=Number.isFinite(obj.metadata?.heightM)?String(obj.metadata.heightM):"";
 }
 $("wall-thickness-fields").classList.toggle("hidden",obj?.objectType!=="wall");
 if(obj?.objectType==="wall")$("wall-thickness").value=Number.isFinite(obj.wall?.thickness)?String(Number((obj.wall.thickness/gridState.spacing*50).toFixed(2))):"";
}
bind("vertex-add",()=>{
 const current=sceneNow()?.objects.find(o=>o.id===state.selectedId),points=current?.geometry?.points;
 if(!points)return;
 const index=Math.max(0,Math.min(points.length-1,Number($("vertex-index").value)||0));
 const backward=$("vertex-placement").value==="before";
 let other=backward?index-1:index+1;
 if(other<0||other>=points.length){
  if(current.geometry.type==="polygon")other=(other+points.length)%points.length;
  else{notice("線の端から外へは中点を挿入できません。別の頂点を選んでください。","error");return}
 }
 const target=backward?index:index+1,point=[(points[index][0]+points[other][0])/2,(points[index][1]+points[other][1])/2];
 if(changeObject(o=>o.geometry.points.splice(target,0,point)))$("vertex-index").value=String(target);
},"click");
bind("vertex-delete",()=>{
 const current=sceneNow()?.objects.find(o=>o.id===state.selectedId),points=current?.geometry?.points;
 if(!points)return;
 const min=current.geometry.type==="polygon"?3:2;
 if(points.length<=min){notice("必要な頂点数を下回るため削除できません","error");return}
 const index=Math.max(0,Math.min(points.length-1,Number($("vertex-index").value)||0));
 changeObject(o=>o.geometry.points.splice(index,1));
},"click");
bind("obj-rotation",()=>{
 const n=Number(input("obj-rotation"));if(!Number.isFinite(n)){notice("回転角度が不正です","error");return}
 changeObject(o=>{if(o.geometry?.type==="rect")o.geometry.rotation=((n%360)+360)%360});
});
bind("door-type",()=>{
 const type=input("door-type");
 changeObject(o=>{
  if(o.objectType!=="door")return;
  o.door={...o.door,type};
  if(type==="sliding"&&!["start","end"].includes(o.door.slideDirection))o.door.slideDirection="end";
 });
});
bind("door-leaf-count",()=>{
 const count=Number(input("door-leaf-count"));
 if(count!==1&&count!==2)return;
 changeObject(o=>{
  if(o.objectType!=="door")return;
  o.door={...o.door,leafCount:count};
 });
});
bind("door-slide-direction",()=>{
 const direction=input("door-slide-direction");
 if(!["start","end"].includes(direction))return;
 changeObject(o=>{
  if(o.objectType!=="door")return;
  o.door={...o.door,type:"sliding",slideDirection:direction};
 });
});
bind("door-wall-id",()=>{
 const wallId=input("door-wall-id"),data=sceneNow(),wall=data?.objects.find(x=>x.id===wallId);
 if(wallId&&(!wall||wall.objectType!=="wall"||wall.geometry?.type!=="polyline"||wall.geometry.points.length<2)){
  notice("接続する壁には折れ線の図形を指定してください","error");renderSelected();return;
 }
 changeObject(o=>{
  if(o.objectType!=="door")return;
  o.opening={...o.opening};
  if(!wallId){delete o.opening.wallId;return}
  o.opening.wallId=wallId;
  // Place door on the nearest segment, preserving its approximate opening width.
  const points=o.geometry?.points||[];
  if(o.geometry?.type!=="polyline"||points.length!==2)return;
  const center=[(points[0][0]+points[1][0])/2,(points[0][1]+points[1][1])/2];
  const desired=Math.max(.001,Number(o.opening.width)||Math.hypot(points[1][0]-points[0][0],points[1][1]-points[0][1]));
  let best=null;
  const vertices=wall.geometry.points;
  for(let i=1;i<vertices.length;i++){
   const a=vertices[i-1],b=vertices[i],dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy;
   if(len2<1e-8)continue;
   const t=Math.max(0,Math.min(1,((center[0]-a[0])*dx+(center[1]-a[1])*dy)/len2));
   const distance=(center[0]-(a[0]+dx*t))**2+(center[1]-(a[1]+dy*t))**2;
   if(!best||distance<best.distance)best={a,b,dx,dy,len:Math.sqrt(len2),t,distance};
  }
  if(!best)return;
  const width=Math.min(desired,best.len*.8),half=width/(2*best.len),t=Math.max(half,Math.min(1-half,best.t));
  o.geometry.points=[
   [best.a[0]+best.dx*(t-half),best.a[1]+best.dy*(t-half)],
   [best.a[0]+best.dx*(t+half),best.a[1]+best.dy*(t+half)]
  ];
  o.opening.width=width;
 });
});
bind("stair-low-side",()=>{
 const value=input("stair-low-side");
 if(value!==""&&!["top","bottom","left","right"].includes(value))return;
 changeObject(o=>{
  if(o.objectType!=="stair")return;
  o.stair={...o.stair};
  if(value)o.stair.lowSide=value;else delete o.stair.lowSide;
 });
});
bind("wall-thickness",()=>{
 const raw=input("wall-thickness").trim();
 if(raw===""){changeObject(o=>{if(o.objectType==="wall"&&o.wall)delete o.wall.thickness});return}
 const thickness=Number(raw);
 if(!Number.isFinite(thickness)||thickness<1||thickness>300){notice("壁厚は1〜300cmで指定してください","error");renderSelected();return}
 changeObject(o=>{if(o.objectType!=="wall")return;o.wall={...o.wall,thickness:thickness/50*gridState.spacing}});
});
function geoNumberEdit(field,raw,min=0){
 const text=raw.trim();
 if(text!==""&&(!Number.isFinite(Number(text))||Number(text)<min)){
  notice("数値が不正です（"+field+"）","error");renderSelected();return;
 }
 changeObject(o=>{
  o.metadata={...o.metadata};
  if(text===""){delete o.metadata[field];return}
  o.metadata[field]=Number(text);
  o.metadata[field==="elevationM"?"manualElevationEdit":"manualHeightEdit"]=true;
  if(field==="elevationM")o.metadata.verifiedElevation=false;
  if(field==="elevationM"&&o.metadata.featureKind==="terrain"){
   const range=sceneNow()?.settings?.georeference;
   const minHeight=Number(range?.minElevationM),maxHeight=Number(range?.maxElevationM);
   if(Number.isFinite(minHeight)&&Number.isFinite(maxHeight)){
    const t=maxHeight===minHeight?0.5:Math.max(0,Math.min(1,(Number(text)-minHeight)/(maxHeight-minHeight)));
    const red=Math.round(37+100*t),green=Math.round(75+78*(1-t)),blue=Math.round(63+18*(1-t));
    o.style={...o.style,fill:"rgb("+red+","+green+","+blue+")"};
   }
  }
 });
}
bind("geo-elevation-m",()=>geoNumberEdit("elevationM",input("geo-elevation-m"),-1000));
bind("geo-height-m",()=>geoNumberEdit("heightM",input("geo-height-m"),0));
function initBuildingTemplates(){
 const list=window.AAMapBuildingTemplates?.allPresets()||[];
 const picker=$("building-template"),previous=picker.value;picker.replaceChildren();
 for(const category of [...new Set(list.map(t=>t.category))]){
  const group=document.createElement("optgroup");
  group.label=category==="custom"?"自作テンプレート":category==="modern_housing"?"現代日本・住宅／マンション":list.find(t=>t.id===category)?.name||category;
  for(const t of list.filter(t=>t.category===category)){
   const option=document.createElement("option");
   option.value=t.id;option.textContent=t.name;
   group.append(option);
  }
  picker.append(group);
 }
 picker.value=list.some(t=>t.id===previous)?previous:(list[0]?.id||"");
 function describe(){
  const t=list.find(t=>t.id===input("building-template"));
  if(!t)return;
  const [w,h]=t.cells;
  $("building-template-description").textContent=t.description+"｜"+(t.custom?"保存時 "+t.originalSize.join("×")+"座標":w+"×"+h+"マス（"+(w*.5)+"×"+(h*.5)+"m）")+"｜"+t.floors+"階";
  $("building-base-name").value=t.name;
 }
 picker.onchange=describe;
 describe();
 if(window.AAMapTemplatePreview&&$("template-preview-list"))
  window.AAMapTemplatePreview.init(window.AAMapBuildingTemplates,picker);
}
window.addEventListener("building-templates-updated",initBuildingTemplates);
const customStorageKey="mymapcreater:building-templates:v1";
function loadCustomBuildingTemplates(){
 try{
  const raw=localStorage.getItem(customStorageKey);
  if(raw){const items=JSON.parse(raw);if(Array.isArray(items))for(const item of items)window.AAMapBuildingTemplates.register(item)}
 }catch(error){notice("保存済みテンプレートの読込に失敗："+error.message,"error")}
}
function persistCustomBuildingTemplates(){
 try{localStorage.setItem(customStorageKey,JSON.stringify(window.AAMapBuildingTemplates.custom))}
 catch(error){notice("ブラウザー保存できません。JSON書き出しでバックアップしてください："+error.message,"error")}
}
function downloadBuildingFile(payload,filename){
 const blob=new Blob([JSON.stringify(payload,null,2)+"\n"],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),0);
}
bind("building-capture",()=>{
 const scene=sceneNow(),library=window.AAMapBuildingTemplates;
 try{
  const spec=library.capture(scene,state.selectedId,{
   id:input("building-template-id"),name:input("building-template-name")
  });
  library.register(spec);persistCustomBuildingTemplates();initBuildingTemplates();
  $("building-template").value=spec.id;
  $("building-template").onchange?.();
  $("building-template-description").textContent="保存済み：" + spec.name+"｜"+spec.objects.length+"オブジェクト";
  notice("自作テンプレートを登録しました。JSON保存で他端末にも持ち出せます。","success");
 }catch(error){notice("テンプレート登録できません："+error.message,"error")}
},"click");
bind("building-export",()=>{
 const lib=window.AAMapBuildingTemplates;
 if(!lib.custom.length){notice("書き出す自作テンプレートがありません","error");return}
 downloadBuildingFile({schema:"map-building-template-library-v1",items:lib.custom},"custom-building-templates.json");
 notice("自作建物テンプレートを書き出しました","success");
},"click");
bind("building-import",()=>$("building-import-file").click(),"click");
bind("building-import-file",async()=>{
 const file=$("building-import-file").files?.[0];$("building-import-file").value="";
 if(!file)return;
 try{
  const data=JSON.parse(await file.text());
  const items=data.schema==="map-building-template-library-v1"?data.items:[data];
  if(!Array.isArray(items)||items.length>100)throw Error("テンプレート数が不正です");
  // Validate all entries before registering any, preserving existing custom templates.
  for(const entry of items){
   if(entry?.schema!=="map-building-template-v1"||!Array.isArray(entry.objects))throw Error("テンプレートJSONが不正です");
  }
  for(const entry of items)window.AAMapBuildingTemplates.register(entry);
  persistCustomBuildingTemplates();initBuildingTemplates();
  notice(items.length+"件の建物テンプレートを読み込みました","success");
 }catch(error){notice("テンプレートを読み込めません："+error.message,"error")}
});
function addBuildingTemplates(){
 const scene=sceneNow(),library=window.AAMapBuildingTemplates;
 if(!scene||!library){notice("建物テンプレートを読み込めません","error");return}
 const t=library.allPresets().find(t=>t.id===input("building-template"));
 const count=Number(input("building-count")),columns=Number(input("building-columns")),gap=Number(input("building-gap"));
 if(!t||!Number.isSafeInteger(count)||count<1||count>100||
    !Number.isSafeInteger(columns)||columns<1||columns>25||
    !Number.isSafeInteger(gap)||gap<0||gap>200){
  notice("配置数1～100、横の列数1～25、間隔0～200マスを指定してください","error");return;
 }
 const selection=scene.objects.find(o=>o.id===state.selectedId);
 const parent=checked("building-parent-selected")?selection:null;
 if(checked("building-parent-selected")&&!parent){notice("親として使う区画・施設を選択するか、親にする設定を解除してください","error");return}
 if(parent&&!["region","facility"].includes(parent.objectType)){
  notice("建物の親には区画または施設を選択してください","error");return;
 }
 const spacing=gridState.spacing;
 const box=$("map-canvas").getBoundingClientRect(),p=snapPoint(viewer.screenToWorld(box.width/2,box.height/2));
 const gapDistance=gap*spacing,baseName=input("building-base-name").trim()||t.name;
 const next=copy(scene),taken=new Set(next.objects.map(o=>o.id));
 const idBase="building_"+t.id;
 let nextIndex=1;
 const prefix=()=>{
  while(taken.has(idBase+"_"+nextIndex))nextIndex++;
  const value=idBase+"_"+nextIndex++;taken.add(value);return value;
 };
 let firstId=null;
 try{
  for(let i=0;i<count;i++){
   const col=i%columns,row=Math.floor(i/columns);
   const width=t.custom?t.originalSize[0]:t.cells[0]*spacing;
   const height=t.custom?t.originalSize[1]:t.cells[1]*spacing;
   const x=p[0]+col*(width+gapDistance);
   const y=p[1]+row*(height+gapDistance);
   const name=count===1?baseName:baseName+" "+(i+1);
   const id=prefix();
   if(!firstId)firstId=id;
   const generated=library.generate(t.id,{
    prefix:id,parentId:parent?.id||null,
    displayLevel:parent?.displayLevel+1||viewer.initialDisplayLevel(),
    x,y,spacing,baseName:name
   });
   // Newly generated building interiors belong in their own files on export.
   const generatedRoot=generated.objects.find(o=>o.id===id);
   if(generatedRoot)generatedRoot.interiorSource="./buildings/generated/"+id+".interior.json";
   next.objects.push(...generated.objects);
  }
  if(applyScene(next,firstId)){viewer.selectItemById(firstId,{focus:true,force:true});notice(count+"棟の建物を追加しました。保存して確定してください（未保存）","success")}
 }catch(error){notice("建物を追加できません："+error.message,"error")}
}
bind("building-add",addBuildingTemplates,"click");
function supplyCatalog(){return window.AAMapObjectCatalog.entries(sceneNow())}
function supplyOptions(){
 const picker=$("supply-preset"),last=picker.value;
 fillSelect(picker,supplyCatalog().map(x=>[x.id,x.icon+" "+x.name]),last||"supply_box");
 const current=sceneNow()?.objects.find(o=>o.id===state.selectedId);
 const lookup=new Map((sceneNow()?.objects||[]).map(o=>[o.id,o]));
 let owner=current;
 while(owner&&!Array.isArray(owner.floors))owner=lookup.get(owner.parentId);
 const rows=[["","階なし"],...(owner?.floors||[]).map(f=>[f.id,f.label||f.id])];
 fillSelect($("supply-floor"),rows,owner?viewer.getFloorContext()?.selectedFloorId||owner.floors[0].id:"");
 renderSupplyContents();
}
function renderSupplyContents(){
 const obj=sceneNow()?.objects.find(o=>o.id===state.selectedId),entries=obj?.contents||[];
 const panel=$("supply-contents-editor"),list=$("supply-contents-list");
 panel.classList.toggle("hidden",!obj||(!entries.length&&obj.objectType!=="object"&&obj.objectType!=="container"));
 list.replaceChildren();
 if(!obj)return;
 for(const entry of entries){
  const preset=supplyCatalog().find(x=>x.id===entry.presetId);
  const row=document.createElement("div");row.className="row";
  const name=document.createElement("span");name.textContent=(preset?.icon||"•")+" "+(entry.name||preset?.name||entry.presetId)+" ×"+entry.quantity;
  name.style.flex="1";
  const del=document.createElement("button");del.type="button";del.textContent="削除";del.title="この物資を収納内容から削除";
  del.addEventListener("click",()=>changeObject(o=>{o.contents=o.contents.filter(e=>e!==entry&&!(e.presetId===entry.presetId&&e.quantity===entry.quantity&&e.name===entry.name))}));
  row.append(name,del);list.append(row);
 }
 if(!entries.length)list.textContent="収納物は未登録です。";
}
function storeSupply(){
 const preset=supplyCatalog().find(x=>x.id===input("supply-preset"));
 const quantity=Number(input("supply-quantity"));
 if(!preset||!Number.isSafeInteger(quantity)||quantity<1){notice("物資の種類と1以上の個数を指定してください","error");return}
 if(!state.selectedId){notice("収納棚・物置などの図形を選択してください","error");return}
 const selected=sceneNow().objects.find(o=>o.id===state.selectedId);
 if(!selected||selected.objectType==="supply"||selected.objectType==="wall"||selected.objectType==="door"){
  notice("収納先には家具や収納物の図形を選択してください","error");return;
 }
 changeObject(o=>{
  o.contents=o.contents||[];
  const existing=o.contents.find(e=>e.presetId===preset.id&&!e.name);
  if(existing)existing.quantity+=quantity;
  else o.contents.push({presetId:preset.id,quantity});
 });
}
function placeSupply(){
 const preset=supplyCatalog().find(x=>x.id===input("supply-preset")),quantity=Number(input("supply-quantity"));
 const scene=sceneNow();if(!scene||!preset||!Number.isSafeInteger(quantity)||quantity<1){notice("物資と個数を確認してください","error");return}
 const canvas=$("map-canvas"),bounds=canvas.getBoundingClientRect();
 const [cx,cy]=snapPoint(viewer.screenToWorld(bounds.width/2,bounds.height/2));
 const id=uniqueId("supply_"+preset.id,scene.objects);
 const parent=scene.objects.find(o=>o.id===state.selectedId);
 const parentId=parent?.id||null;
 const floorId=input("supply-floor");
 if(floorId&&!parentId){notice("階へ配置するには対象の建物または室内オブジェクトを選択してください","error");return}
 const obj={id,name:preset.name,parentId,displayLevel:parent?.displayLevel+1||1,objectType:"supply",presetId:preset.id,quantity,
  layer:"structures",zIndex:48,visible:true,selectable:true,
  geometry:{type:"rect",x:cx-4,y:cy-4,width:8,height:8},
  style:{fill:null,stroke:null},
  icon:{text:preset.icon,visible:true,fontSize:18},
  label:{visible:false,text:preset.name,position:[cx,cy]},
  detail:"物資： "+preset.name+" ×"+quantity};
 if(floorId)obj.floorId=floorId;
 scene.objects.push(obj);applyScene(scene,id);
}
$("supply-place").addEventListener("click",placeSupply);
$("supply-store").addEventListener("click",storeSupply);
function renderSelected(){
 const data=sceneNow(),obj=data?.objects.find(o=>o.id===state.selectedId);
 $("selected-fields").classList.toggle("hidden",!obj);
 $("select-empty").classList.toggle("hidden",!!obj);
 if(!obj){updateVertexControls(null);buttonStatus();supplyOptions();return}
 $("obj-id").value=obj.id;
 $("obj-name").value=obj.name||"";
  $("obj-display-level").value=obj.displayLevel??"";
 $("obj-type").value=obj.objectType||"";
 const opts=[["","（親なし）"],...data.objects.filter(o=>o.id!==obj.id).map(o=>[o.id,o.name||o.id])];
 fillSelect($("obj-parent"),opts,obj.parentId||"");
 fillSelect($("layer-list"),[], ""); // Datalist options are rebuilt below.
 const layers=$("layer-list");layers.replaceChildren();
 for(const layer of data.layers||[]){
  const opt=document.createElement("option");opt.value=layer.id;layers.append(opt);
 }
 $("obj-layer").value=obj.layer||"";
 $("obj-z").value=String(number(obj.zIndex,0));
 $("obj-visible").checked=obj.visible!==false;
 $("obj-selectable").checked=obj.selectable!==false;
 $("obj-geometry").value=obj.geometry?.type||"none";
 const style=obj.style||{};
 $("obj-fill-enabled").checked=Boolean(style.fill);
 $("obj-fill").disabled=!style.fill;
 $("obj-fill").value=style.fill||"rgba(85,150,170,.25)";
 $("obj-stroke-enabled").checked=Boolean(style.stroke);
 $("obj-stroke").disabled=!style.stroke;
 $("obj-stroke").value=style.stroke||"#91cdd1";
 $("obj-stroke-width").value=String(number(style.strokeWidth,1.2));
 $("obj-opacity").value=String(number(style.opacity,1));
 const label=obj.label||{};
 $("obj-label-visible").checked=label.visible!==false;
 $("obj-label-text").value=label.text||"";
 const position=label.position||centerOf(obj.geometry);
 $("obj-label-x").value=String(number(position[0]));
 $("obj-label-y").value=String(number(position[1]));
 $("obj-label-size").value=String(number(label.fontSize,12));
 $("obj-detail").value=obj.detail||"";
 $("json-object").value=JSON.stringify(obj,null,2);
 renderGeometry(obj);updateVertexControls(obj);buttonStatus();supplyOptions();
}
function applyScene(scene,selectedId,{record=true,resetView=false}={}){
 try{
  window.AAMapViewer.sceneCheck(scene);
  const before=sceneNow();
  if(record&&before&&!same(before,scene))pushUndo(before);
  state.internal=true;
  try{viewer.replaceScene(scene,{preserveView:!resetView,selectedId})}
  finally{state.internal=false}
  state.scene=viewer.getScene();
  if(scene.settings?.editorGrid)setGridInputs({...gridState,...scene.settings.editorGrid});
  state.selectedId=selectedId||null;
  $("scene-name").textContent=scene.name||"マップ";
  renderSelected();showObjects();showNewLayerChoices();
  if(!record)setDirty(false);else setDirty(true);
  if(scene.settings?.georeference&&!state.options.some(o=>o.key===scene.id)){
   const option={key:scene.id,id:scene.id,title:"制作中｜"+scene.name,scene:copy(scene)};
   state.options.push(option);
   const tag=document.createElement("option");tag.value=option.key;tag.textContent=option.title;
   $("scene-select").append(tag);
   state.currentOptionKey=option.key;$("scene-select").value=option.key;
  }
  const live=state.options.find(o=>o.key===scene.id&&o.scene);
  if(live)live.scene=copy(scene);
  geoButtons();
  notice("JSONの設定を反映しました（未保存）","success");
  return true;
 }catch(error){notice("変更できません："+error.message,"error");return false}
}
function changeObject(callback){
 const old=sceneNow(),id=state.selectedId;
 if(!old||!id)return false;
 const data=copy(old),obj=data.objects.find(o=>o.id===id);
 if(!obj)return false;
 try{callback(obj);return same(old,data)?true:applyScene(data,obj.id)}
 catch(error){notice("変更できません："+error.message,"error");return false}
}
function bind(id,callback,event="change"){$(id).addEventListener(event,callback)}
function changeString(id,key){bind(id,()=>changeObject(o=>{o[key]=input(id)}))}
changeString("obj-name","name");
bind("obj-display-level",()=>{
 const value=Number(input("obj-display-level"));
 if(!Number.isSafeInteger(value)||value<1){notice("表示Lvは1以上の整数を指定してください","error");renderSelected();return}
 changeObject(o=>{o.displayLevel=value});
});
changeString("obj-type","objectType");changeString("obj-layer","layer");
bind("obj-z",()=>changeObject(o=>{o.zIndex=Number(input("obj-z"))}));
bind("obj-parent",()=>changeObject(o=>{o.parentId=input("obj-parent")||null}));
bind("obj-visible",()=>changeObject(o=>{o.visible=checked("obj-visible")}));
bind("obj-selectable",()=>changeObject(o=>{o.selectable=checked("obj-selectable")}));
bind("obj-geometry",()=>changeObject(o=>{o.geometry=shapeOf(input("obj-geometry"),centerOf(o.geometry))}));
bind("obj-fill-enabled",()=>changeObject(o=>{o.style=o.style||{};o.style.fill=checked("obj-fill-enabled")?(input("obj-fill")||"rgba(85,150,170,.25)"):null}));
bind("obj-stroke-enabled",()=>changeObject(o=>{o.style=o.style||{};o.style.stroke=checked("obj-stroke-enabled")?(input("obj-stroke")||"#91cdd1"):null}));
bind("obj-fill",()=>changeObject(o=>{o.style=o.style||{};o.style.fill=input("obj-fill")||null}));
bind("obj-stroke",()=>changeObject(o=>{o.style=o.style||{};o.style.stroke=input("obj-stroke")||null}));
bind("obj-stroke-width",()=>changeObject(o=>{o.style=o.style||{};o.style.strokeWidth=Number(input("obj-stroke-width"))}));
bind("obj-opacity",()=>changeObject(o=>{o.style=o.style||{};o.style.opacity=Number(input("obj-opacity"))}));
bind("obj-label-visible",()=>changeObject(o=>{o.label=o.label||{};o.label.visible=checked("obj-label-visible")}));
bind("obj-label-text",()=>changeObject(o=>{o.label=o.label||{};o.label.text=input("obj-label-text")}));
for(const [field,axis] of [["obj-label-x",0],["obj-label-y",1]]){
 bind(field,()=>changeObject(o=>{o.label=o.label||{};o.label.position=o.label.position||centerOf(o.geometry);o.label.position[axis]=Number(input(field))}));
}
bind("obj-label-size",()=>changeObject(o=>{o.label=o.label||{};o.label.fontSize=Number(input("obj-label-size"))}));
bind("obj-detail",()=>changeObject(o=>{o.detail=input("obj-detail")}));
bind("apply-json",()=>{
 try{
  const full=sceneNow();if(!full||!state.selectedId)return;
  const replacement=JSON.parse(input("json-object"));
  if(!replacement||typeof replacement.id!=="string"||!replacement.id)throw Error("IDが不正です");
  const index=full.objects.findIndex(o=>o.id===state.selectedId);
  if(index<0)throw Error("選択オブジェクトがありません");
  full.objects[index]=replacement;
  applyScene(full,replacement.id);
 }catch(error){notice("JSONを適用できません："+error.message,"error")}
},"click");
function uniqueId(base,objects){
 let name=String(base||"shape").replace(/[^a-z0-9_-]+/gi,"_");
 const used=new Set(objects.map(x=>x.id));
 if(!used.has(name))return name;
 let i=2;while(used.has(name+"_"+i))i++;
 return name+"_"+i;
}
bind("add-object",()=>{
 const scene=sceneNow();if(!scene)return;
 const gtype=input("new-shape");
 const box=$("map-canvas").getBoundingClientRect();
 const [x,y]=viewer.screenToWorld(box.width/2,box.height/2);
 const id=uniqueId("shape",scene.objects);
 const kind=input("new-role")||"object";
 const layer=input("new-layer")||"objects";
 const index=scene.layers?.find(l=>l.id===layer)?.zIndex;
 const g=snapGeometry(shapeOf(gtype,snapPoint([x,y])));
 const labelText="新しい図形";
 const parentId=checked("new-parent-selected")?state.selectedId:null;
 if(checked("new-when-parent-selected")&&!parentId){
  notice("親を選択したときだけ表示するには、先に親図形を選択し「選択中の図形を親にする」を有効にしてください","error");
  return;
 }
 const parent=scene.objects.find(o=>o.id===parentId);
 const parentLv=Number.isSafeInteger(parent?.displayLevel)?parent.displayLevel:null;
 const displayLevel=parentLv?parentLv+1:1;
 const obj={id,name:labelText,parentId,displayLevel,objectType:kind,layer,
  zIndex:Number.isFinite(index)?index:20,
  visible:true,selectable:true,geometry:g,
  style:{fill:gtype==="none"||gtype==="polyline"?null:"rgba(79,145,168,.22)",stroke:"#98d5df",strokeWidth:1.5},
  label:{visible:true,text:labelText,position:[x,y],fontSize:12},detail:""};
 if(checked("new-when-parent-selected"))obj.visibility={whenParentSelected:true};
 scene.objects.push(obj);
 applyScene(scene,id);
},"click");
bind("clone-object",()=>{
 const scene=sceneNow(),id=state.selectedId;if(!scene||!id)return;
 const original=scene.objects.find(o=>o.id===id);if(!original)return;
 const cloned=copy(original);cloned.id=uniqueId(id,scene.objects);cloned.name=(original.name||id)+" の複製";
 const g=cloned.geometry||{},dx=gridState.spacing*4,dy=gridState.spacing*4;
 if(g.type==="rect"){g.x+=dx;g.y+=dy}
 else if(g.type==="circle"||g.type==="ring"){g.center[0]+=dx;g.center[1]+=dy}
 else if(g.points)for(const p of g.points){p[0]+=dx;p[1]+=dy}
 if(cloned.label?.position){cloned.label.position[0]+=dx;cloned.label.position[1]+=dy}
 scene.objects.push(cloned);applyScene(scene,cloned.id);
},"click");
bind("delete-object",()=>{
 const scene=sceneNow(),id=state.selectedId;if(!scene||!id)return;
 const childIds=scene.objects.filter(o=>o.parentId===id).map(o=>o.id);
 if(childIds.length){notice("子オブジェクトがあります。削除するには先に子の親を変更してください。","error");return}
 scene.objects=scene.objects.filter(o=>o.id!==id);
 applyScene(scene,null);
},"click");
function restore(from,to){
 if(!from.length)return;
 const scene=from.pop(),before=sceneNow();
 if(before)to.push(copy(before));
 state.internal=true;
 try{viewer.replaceScene(scene,{preserveView:true,selectedId:state.selectedId})}
 finally{state.internal=false}
 state.scene=viewer.getScene();showObjects();renderSelected();setDirty(true);
 setGridInputs({...gridDefaults,...state.scene?.settings?.editorGrid});
 notice("履歴を復元しました","success");
}
bind("undo",()=>restore(state.undo,state.redo),"click");
bind("redo",()=>restore(state.redo,state.undo),"click");
bind("object-search",showObjects,"input");
bind("clear-search",()=>{$("object-search").value="";showObjects()},"click");
bind("move-mode",()=>{
 const enabled=viewer.setEditMode(checked("move-mode"));
 $("edit-hint").textContent=enabled?
  "図形の内側ドラッグで移動（子も追従）。黄色のハンドルで四角形を拡縮、線・多角形の頂点を移動できます。辺をダブルクリックで頂点追加、Alt＋頂点クリックで削除（タッチは右パネルから）。内部設備は自動伸縮しません。":
  "図形を選択して右のパネルで編集してください。ドラッグは地図移動です。";
});
async function importFile(file){
 if(!file)return;
 try{
  const data=JSON.parse(await file.text());
  window.AAMapViewer.sceneCheck(data);
  const good=applyScene(data,null,{record:true,resetView:true});
  if(good){state.savingName=file.name;notice("読み込み完了："+file.name,"success")}
 }catch(error){notice("ファイルを開けません："+error.message,"error")}
}
bind("open-json",()=>$("file-input").click(),"click");
bind("file-input",async()=>{await importFile($("file-input").files?.[0]);$("file-input").value=""});
// A lazy interior is not part of the exterior scene file. Export it separately
// so that selecting and editing a building never duplicates its children in town JSON.
let exteriorExported=false;
const interiorExported=new Set();
function externalOwners(data){return data.objects.filter(o=>typeof o.interiorSource==="string"&&o.interiorSource)}
function belongingTo(data,rootId){
 const ids=new Set([rootId]);let changed=true;
 while(changed){changed=false;for(const o of data.objects){
  if(!ids.has(o.id)&&ids.has(o.parentId)){ids.add(o.id);changed=true}
 }}
 return data.objects.filter(o=>o.id!==rootId&&ids.has(o.id));
}
function exteriorOnly(data){
 const exclude=new Set();
 for(const root of externalOwners(data))for(const o of belongingTo(data,root.id))exclude.add(o.id);
 return{...data,objects:data.objects.filter(o=>!exclude.has(o.id))};
}
function download(){
 const data=sceneNow();if(!data){notice("保存するJSONがありません","error");return}
 try{
  const exterior=exteriorOnly(data);
  window.AAMapViewer.sceneCheck(exterior);
  downloadBuildingFile(exterior,state.savingName||((data.id||"map")+".scene.json"));
  exteriorExported=true;
  const loaded=externalOwners(data).filter(root=>belongingTo(data,root.id).length);
  if(!loaded.length){setDirty(false);notice("街マップJSONを保存しました。建物内部は別JSONのまま保持します。","success")}
  else{
   if(loaded.every(root=>interiorExported.has(root.id)))setDirty(false);
   notice("街マップJSONを保存しました。読み込んだ建物の内部JSONは別途保存してください。","success");
  }
 }catch(error){notice("保存できません："+error.message,"error")}
}
function selectedExternalOwner(data){
 let object=data.objects.find(o=>o.id===state.selectedId);
 const byId=new Map(data.objects.map(o=>[o.id,o])),seen=new Set();
 while(object&&!seen.has(object.id)){
  if(object.interiorSource)return object;
  seen.add(object.id);object=byId.get(object.parentId);
 }
 return null;
}
function downloadInterior(){
 const data=sceneNow();if(!data){notice("建物を選択してください","error");return}
 const root=selectedExternalOwner(data);
 if(!root){notice("内部JSON参照がある建物、またはその内部設備を選択してください","error");return}
 const objects=belongingTo(data,root.id);
 if(!objects.length){notice("内部データは未読み込みです。建物を選択して読み込み完了後に保存してください","error");return}
 try{
  const interior={schemaVersion:2,buildingId:root.id,objects};
  const name=root.interiorSource.split("/").pop()||root.id+".interior.json";
  downloadBuildingFile(interior,name);
  interiorExported.add(root.id);
  if(exteriorExported&&externalOwners(data).filter(o=>belongingTo(data,o.id).length).every(o=>interiorExported.has(o.id)))setDirty(false);
  notice("建物内部JSONを保存しました。配置先："+root.interiorSource+"（リポジトリへの反映は別途必要）","success");
 }catch(error){notice("内部JSONの保存失敗："+error.message,"error")}
}
async function downloadBundle(){
 const data=sceneNow();if(!data){notice("保存データがありません","error");return}
 const roots=externalOwners(data),files=[],used=new Set();
 const basename=(state.savingName||((data.id||"map")+".scene.json")).replace(/[\\/]/g,"_");
 try{
  files.push({name:"scenes/"+basename,content:JSON.stringify(exteriorOnly(data),null,2)+"\n"});
  for(const root of roots){
   const target=String(root.interiorSource).replace(/^\.\//,"");
   if(!target.startsWith("buildings/")||target.split("/").includes(".."))
    throw Error("不正な内部JSONパス："+target);
   if(used.has(target))throw Error("建物の内部参照が重複しています："+target);
   used.add(target);
   const children=belongingTo(data,root.id);
   let payload;
   if(children.length)payload={schemaVersion:2,buildingId:root.id,objects:children};
   else{
    const response=await fetch(root.interiorSource,{cache:"no-store"});
    if(!response.ok)throw Error("内部JSONが取得できません："+target+" (HTTP "+response.status+")");
    payload=await response.json();
    if(payload.schemaVersion!==2||payload.buildingId!==root.id||!Array.isArray(payload.objects))
     throw Error("内部JSONの内容が不正："+target);
   }
   files.push({name:target,content:JSON.stringify(payload,null,2)+"\n"});
  }
  const blob=window.AAMapZip.pack(files),url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download=(data.id||"map")+"-scene-and-interiors.zip";
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),0);
  setDirty(false);notice(files.length+"ファイルをZIPにまとめて保存しました。rebuild/ 以下に展開して反映してください。","success");
 }catch(error){notice("ZIP保存できません："+error.message,"error")}
}
// The editor is a map creator; external map data is an optional, region-neutral import.
let geoCandidates=[],geoSearchPrevious=0,geoBusy=false;
function geoButtons(){
 const scene=sceneNow();
 $("geo-dem-fetch").disabled=geoBusy||!scene?.settings?.georeference;
 if(scene?.settings?.georeference&&!geoBusy){
  const gr=scene.settings.georeference;
  $("geo-import-status").textContent="編集中："+scene.name+" ／ "+(gr.widthM||"?")+"m四方。地理情報はマップと一緒にJSON保存されます。";
 }
}
bind("geo-import-toggle",()=>{
 const panel=$("geo-import-panel"),expanded=panel.hidden;
 panel.hidden=!expanded;
 $("geo-import-toggle").setAttribute("aria-expanded",String(expanded));
 if(expanded&&sceneNow()?.settings?.georeference){
  const gr=sceneNow().settings.georeference;
  $("geo-lat").value=gr.center.lat;
  $("geo-lon").value=gr.center.lon;
  $("geo-place").value=gr.regionName||sceneNow().name;
  $("geo-size").value=String(gr.widthM);
 }
});
bind("geo-place-search",async()=>{
 const q=input("geo-place").trim();
 if(!q)return notice("検索する地名を入力してください","error");
 const elapsed=Date.now()-geoSearchPrevious;
 if(geoBusy||elapsed<1100)return notice("地名検索は連続実行できません。少し時間を置いてください","error");
 geoSearchPrevious=Date.now();
 geoBusy=true;
 const button=$("geo-place-search");button.disabled=true;
 $("geo-import-status").textContent="地名を検索中…（入力時の自動検索は行いません）";
 try{
  geoCandidates=await window.AASakihanaMap.searchPlace(q);
  const select=$("geo-search-results");select.replaceChildren();
  for(let i=0;i<geoCandidates.length;i++){
   const option=document.createElement("option");option.value=String(i);
   option.textContent=geoCandidates[i].name;select.append(option);
  }
  if(!geoCandidates.length)throw Error("該当する場所が見つかりません。緯度・経度を直接指定できます");
  select.value="0";
  $("geo-lat").value=geoCandidates[0].lat;
  $("geo-lon").value=geoCandidates[0].lon;
  $("geo-import-status").textContent=geoCandidates.length+"件の候補があります。場所を確認してから取込を実行してください。";
 }catch(error){$("geo-import-status").textContent="検索失敗："+error.message;notice(error.message,"error")}
 finally{geoBusy=false;button.disabled=false;geoButtons()}
});
bind("geo-search-results",()=>{
 const found=geoCandidates[Number(input("geo-search-results"))];
 if(found){$("geo-lat").value=found.lat;$("geo-lon").value=found.lon;$("geo-place").value=found.name}
});
function selectedGeoRegion(){
 const geo=window.AASakihanaMap;
 if(!geo)throw Error("地理情報取込プログラムがありません");
 const lat=Number(input("geo-lat")),lon=Number(input("geo-lon"));
 if(!input("geo-lat").trim()||!input("geo-lon").trim())throw Error("緯度・経度を入力してください");
 return geo.configure({lat,lon,sizeM:Number(input("geo-size")),name:input("geo-place").trim()||"指定地域"});
}
async function loadGeoOSM(){
 if(geoBusy)return;
 let region;
 try{region=selectedGeoRegion()}catch(error){notice(error.message,"error");return}
 if(state.dirty&&!confirm("現在の未保存の編集内容が置き換わります。事前にJSONを保存しましたか？"))return;
 geoBusy=true;$("geo-osm-fetch").disabled=true;$("geo-dem-fetch").disabled=true;
 $("geo-import-status").textContent=region.name+"のOSMデータを取得中…";
 try{
  const imported=await window.AASakihanaMap.loadOSM();
  // Geographic matches only: terrain from a different area must never be transferred.
  const old=sceneNow(),before=old?.settings?.georeference;
  if(before?.terrainVerified&&before.center?.lat===region.lat&&before.center?.lon===region.lon&&before.widthM===region.sizeM){
   imported.objects.unshift(...old.objects.filter(o=>o.metadata?.featureKind==="terrain"));
   for(const key of ["terrainVerified","demLayer","demZoom","minElevationM","maxElevationM","demRetrievedAt","elevationSamplesKnown","elevationSamplesTotal"])
    imported.settings.georeference[key]=before[key];
  }
  if(!applyScene(imported,null,{resetView:true}))return;
  state.savingName=region.id+".scene.json";
  const counts=imported.settings.georeference.counts||{};
  $("geo-import-status").textContent="取得完了：建物"+(counts.building||0)+"件、道路"+(counts.road||0)+"件、鉄道"+(counts.railway||0)+"件。制作画面で編集できます。";
  notice("実地図を制作マップとして取り込みました。必ずJSON保存してください。","success");
 }catch(error){$("geo-import-status").textContent="取得失敗："+error.message;notice(error.message,"error")}
 finally{geoBusy=false;$("geo-osm-fetch").disabled=false;geoButtons()}
}
async function loadGeoDEM(){
 if(geoBusy)return;
 const scene=sceneNow(),g=scene?.settings?.georeference;
 if(!g)return notice("まずOSM地図を取得するか、地理参照付きのJSONを開いてください","error");
 geoBusy=true;$("geo-dem-fetch").disabled=true;$("geo-osm-fetch").disabled=true;
 $("geo-import-status").textContent="国土地理院DEM標高の取得中…";
 try{
  window.AASakihanaMap.configure({
   lat:g.center.lat,lon:g.center.lon,sizeM:g.widthM,
   name:g.regionName||scene.name,id:scene.id
  });
  const grid=await window.AASakihanaMap.elevationGrid();
  if(sceneNow()?.id!==scene.id||sceneNow()?.settings?.georeference?.center?.lat!==g.center.lat)
   throw Error("標高取得中にマップが変更されました。再実行してください");
  const next=window.AASakihanaMap.addElevation(sceneNow(),grid);
  if(!applyScene(next,null,{resetView:false}))return;
  $("geo-import-status").textContent="標高 "+grid.min.toFixed(1)+"〜"+grid.max.toFixed(1)+"m。地形は色分けされ、各セルを選択して高さを編集できます。";
  notice("標高の取得が完了しました。JSON保存すると保持できます。","success");
 }catch(error){$("geo-import-status").textContent="標高取得失敗："+error.message;notice(error.message,"error")}
 finally{geoBusy=false;$("geo-osm-fetch").disabled=false;geoButtons()}
}
bind("geo-osm-fetch",loadGeoOSM,"click");
bind("geo-dem-fetch",loadGeoDEM,"click");

bind("download-bundle",downloadBundle,"click");
bind("download",download,"click");
bind("download-interior",downloadInterior,"click");
bind("show-scene-json",()=>{
 const fields=$("scene-json-fields"),open=fields.classList.contains("hidden");
 fields.classList.toggle("hidden",!open);
 $("show-scene-json").textContent=open?"マップ全体のJSONを閉じる":"マップ全体のJSONを開く";
 if(open&&sceneNow())$("scene-json-text").value=JSON.stringify(sceneNow(),null,2);
},"click");
bind("reload-scene-json",()=>{
 const scene=sceneNow();if(!scene)return;
 $("scene-json-text").value=JSON.stringify(scene,null,2);
 notice("現在のマップ全体のJSONを読み直しました");
},"click");
bind("apply-scene-json",()=>{
 try{
  const scene=JSON.parse(input("scene-json-text"));
  const currentId=state.selectedId;
  if(applyScene(scene,scene.objects.some(o=>o.id===currentId)?currentId:null,{record:true,resetView:true})){
   $("scene-json-text").value=JSON.stringify(sceneNow(),null,2);
   notice("マップ全体のJSONを適用しました（未保存）","success");
  }
 }catch(error){notice("マップJSONを適用できません："+error.message,"error")}
},"click");

window.addEventListener("beforeunload",e=>{if(state.dirty){e.preventDefault();e.returnValue=""}});
viewer=window.AAMapViewer.create({
 host:$("viewport"),canvas:$("map-canvas"),info:$("detail-panel"),
 infoTitle:$("detail-title"),infoText:$("detail-text"),infoMeta:$("detail-meta"),
 legend:$("legend-footer"),legendContent:$("legend-content"),
 legendButton:$("legend-switch"),visibilityControls:$("visibility-controls"),
 zoomIn:$("zoom-in"),zoomOut:$("zoom-out"),zoomReset:$("zoom-reset"),zoomLabel:$("zoom-label"),
 hint:$("map-hint"),
 onLayoutLoaded:(_map,data)=>{
  if(!state.internal){
   exteriorExported=false;interiorExported.clear();
   state.scene=data?copy(data):null;state.undo.length=0;state.redo.length=0;state.selectedId=null;
   state.savingName=data?(data.id+".scene.json"):"";setDirty(false);
  }
  if(data)setGridInputs({...gridDefaults,...data.settings?.editorGrid});
  if(data)$("scene-name").textContent=data.name||data.id;
  else $("scene-name").textContent="マップ";
  showObjects();renderSelected();showNewLayerChoices();geoButtons();
 },
 onInteriorLoaded:(id,data)=>{
  state.scene=copy(data);
  showObjects();renderSelected();
  notice("建物内部を読み込みました："+(data.objects.find(o=>o.id===id)?.name||id),"success");
 },
 onInteriorStatus:(id,status,message)=>{
  if(status==="loading")notice("建物内部を読み込み中："+id);
  if(status==="error")notice("建物内部の読込に失敗："+message,"error");
 },
 onLayoutError:(_map,error)=>notice("読み込みエラー："+error,"error"),
 onSelectionChanged:(_map,obj)=>{
  state.selectedId=obj?.id||null;showObjects();renderSelected();
 },
 onBeforeObjectDrag:(before)=>{state.dragBefore=before},
 onObjectMoved:()=>{
  if(state.dragBefore){pushUndo(state.dragBefore);state.dragBefore=null}
  state.scene=viewer.getScene();showObjects();renderSelected();
  notice("図形の移動を反映しました（未保存）","success");
 }
});
setGridInputs(gridDefaults);
loadCustomBuildingTemplates();
initBuildingTemplates();
async function init(){
 try{
  const response=await fetch("./map-tree.json",{cache:"no-store"});
  if(!response.ok)throw Error("HTTP "+response.status);
  const config=await response.json(),opts=[];
  for(const root of config.maps.filter(m=>m.parentId===null)){
   for(const view of root.views||[])if(view.source){
    opts.push({key:root.id+"::"+view.id,title:root.name+" / "+(view.displayName||view.name),
     source:view.source,id:root.id,projection:view.id});
   }
   if(root.source)opts.push({key:root.id,title:root.name,source:root.source,id:root.id});
   for(const sub of config.maps.filter(m=>m.parentId===root.id)){
    if(sub.source)opts.push({key:sub.id,title:sub.name,source:sub.source,id:sub.id});
   }
  }
  if(!opts.length)throw Error("JSONの参照先マップがありません");
  state.options=opts;
  fillSelect($("scene-select"),opts.map(o=>[o.key,o.title]),opts[0].key);
  const hash=decodeURIComponent(location.hash.slice(1));
  const fallback=opts.find(o=>o.id===config.defaultMapId)||opts[0];
  const first=opts.find(o=>o.key===hash||o.id===hash)||fallback;
  $("scene-select").value=first.key;
  await load(first);
  if(first.id==="sakihana_gosen_500m"){
   const key="mymapcreater:viewer-to-editor:sakihana:v1";
   let incoming=null;
   try{incoming=sessionStorage.getItem(key)}
   catch(error){notice("確認画面からの地図引き継ぎを読み込めません："+error.message,"error")}
   if(incoming){
    try{
     const restored=JSON.parse(incoming);
     if(restored?.id!=="sakihana_gosen_500m")throw Error("別マップのデータです");
     window.AAMapViewer.sceneCheck(restored);
     if(applyScene(restored,null,{record:true,resetView:true})){
      sessionStorage.removeItem(key);
      state.savingName="sakihana_gosen_500m.scene.json";
      notice("確認画面で取得したOSM・標高データを編集画面へ引き継ぎました。編集後は「街マップJSONを保存」で保存してください。","success");
     }else notice("取得した地図を反映できません。転送データは保持しています。","error");
    }catch(error){notice("取得地図の引き継ぎに失敗："+error.message+"。転送データは保持しています。","error")}
   }
  }
 }catch(error){notice("マップ一覧の読み込み失敗："+error.message,"error")}
}
async function load(option){
 if(!option)return;
 state.dragBefore=null;state.undo.length=0;state.redo.length=0;state.selectedId=null;
 notice("読み込み中："+option.title);
 $("scene-select").value=option.key;
 state.currentOptionKey=option.key;
 if(history.replaceState)history.replaceState(null,"","#"+encodeURIComponent(option.key));
 if(option.scene){
  applyScene(copy(option.scene),null,{record:false,resetView:true});
  setDirty(false);
 }else await viewer.show(option.id,option.projection||null,option.source);
 geoButtons();
 if(sceneNow())notice("編集する図形を選択してください");
}
bind("scene-select",async()=>{
 const option=state.options.find(o=>o.key===input("scene-select"));
 if(!option)return;
 if(state.dirty&&!confirm("未保存の編集を破棄してマップを切り替えますか？")){
  $("scene-select").value=state.currentOptionKey||state.options[0].key;
  return;
 }
 await load(option);
});
init();
})();