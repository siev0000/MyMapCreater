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
 savingName:"",dirty:false,internal:false,currentOptionKey:null};
let viewer;
function sceneNow(){return viewer?.getScene()||state.scene}
function buttonStatus(){
 $("undo").disabled=!state.undo.length;
 $("redo").disabled=!state.redo.length;
 $("clone-object").disabled=!state.selectedId;
 $("delete-object").disabled=!state.selectedId;
 document.title=(state.dirty?"● ":"")+(sceneNow()?.name||"マップ")+"｜汎用マップ編集";
}
function setDirty(value){state.dirty=Boolean(value);buttonStatus()}
function pushUndo(value){state.undo.push(copy(value));if(state.undo.length>60)state.undo.shift();state.redo.length=0;setDirty(true)}
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
function showObjects(){
 const list=$("objects"),data=sceneNow();
 list.replaceChildren();
 if(!data)return;
 const q=input("object-search").trim().toLowerCase();
 const fragment=document.createDocumentFragment();
 for(const o of data.objects){
  if(q&&!((o.name||"")+" "+o.id+" "+(o.objectType||"")).toLowerCase().includes(q))continue;
  const item=document.createElement("button");item.type="button";
  item.className="object-entry";item.setAttribute("role","listitem");
  item.setAttribute("aria-current",String(state.selectedId===o.id));
  const name=document.createElement("span");
  name.textContent=(o.name||o.id)+(o.visible===false?" [非表示]":"");
  const meta=document.createElement("span");meta.className="meta";meta.textContent=o.level||o.objectType||"";
  item.append(name,meta);
  item.addEventListener("click",()=>viewer.selectItemById(o.id,{focus:true,force:true}));
  fragment.append(item);
 }
 list.append(fragment);
}
function fillSelect(select,rows,value){
 select.replaceChildren();
 for(const [id,name] of rows){
  const o=document.createElement("option");o.value=id;o.textContent=name;select.append(o);
 }
 select.value=value;
}
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
   changeObject(o=>assign(o.geometry,n));
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
function renderSelected(){
 const data=sceneNow(),obj=data?.objects.find(o=>o.id===state.selectedId);
 $("selected-fields").classList.toggle("hidden",!obj);
 $("select-empty").classList.toggle("hidden",!!obj);
 if(!obj){buttonStatus();return}
 $("obj-id").value=obj.id;
 $("obj-name").value=obj.name||"";
 $("obj-level").value=obj.level||"facility";
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
 renderGeometry(obj);buttonStatus();
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
  state.selectedId=selectedId||null;
  $("scene-name").textContent=scene.name||"マップ";
  renderSelected();showObjects();showNewLayerChoices();
  if(!record)setDirty(false);else setDirty(true);
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
changeString("obj-name","name");changeString("obj-level","level");
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
 const level=input("new-level")||"object";
 const layer=input("new-layer")||"objects";
 const index=scene.layers?.find(l=>l.id===layer)?.zIndex;
 const g=shapeOf(gtype,[x,y]);
 const labelText="新しい図形";
 const parentId=checked("new-parent-selected")?state.selectedId:null;
 if(checked("new-when-parent-selected")&&!parentId){
  notice("親を選択したときだけ表示するには、先に親図形を選択し「選択中の図形を親にする」を有効にしてください","error");
  return;
 }
 const parent=scene.objects.find(o=>o.id===parentId);
 const parentLv=Number.isSafeInteger(parent?.displayLevel)?parent.displayLevel:(parent?.level==="large"?1:parent?.level==="medium"?2:parent?.level==="small"?3:null);
 const displayLevel=parentLv?parentLv+1:(level==="large"?1:level==="medium"?2:level==="small"?3:1);
 const obj={id,name:labelText,parentId,level,displayLevel,objectType:kind,layer,
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
 const g=cloned.geometry||{},dx=25,dy=25;
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
 notice("履歴を復元しました","success");
}
bind("undo",()=>restore(state.undo,state.redo),"click");
bind("redo",()=>restore(state.redo,state.undo),"click");
bind("object-search",showObjects,"input");
bind("clear-search",()=>{$("object-search").value="";showObjects()},"click");
bind("move-mode",()=>{
 const enabled=viewer.setEditMode(checked("move-mode"));
 $("edit-hint").textContent=enabled?
  "図形を一度選択してからドラッグで移動します。親子は自動的にまとめて移動しません。":
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
function download(){
 const data=sceneNow();if(!data){notice("保存するJSONがありません","error");return}
 try{
  window.AAMapViewer.sceneCheck(data);
  const blob=new Blob([JSON.stringify(data,null,2)+"\n"],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;link.download=state.savingName||((data.id||"map")+".scene.json");
  document.body.append(link);link.click();link.remove();
  URL.revokeObjectURL(url);
  setDirty(false);notice("JSONを書き出しました。リポジトリへの反映は別途行ってください。","success");
 }catch(error){notice("保存できません："+error.message,"error")}
}
bind("download",download,"click");
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
   state.scene=data?copy(data):null;state.undo.length=0;state.redo.length=0;state.selectedId=null;
   state.savingName=data?(data.id+".scene.json"):"";setDirty(false);
  }
  if(data)$("scene-name").textContent=data.name||data.id;
  else $("scene-name").textContent="マップ";
  showObjects();renderSelected();showNewLayerChoices();
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
 }catch(error){notice("マップ一覧の読み込み失敗："+error.message,"error")}
}
async function load(option){
 if(!option)return;
 state.dragBefore=null;state.undo.length=0;state.redo.length=0;state.selectedId=null;
 notice("読み込み中："+option.title);
 $("scene-select").value=option.key;
 state.currentOptionKey=option.key;
 if(history.replaceState)history.replaceState(null,"","#"+encodeURIComponent(option.key));
 await viewer.show(option.id,option.projection||null,option.source);
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