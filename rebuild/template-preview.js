/* Read-only previews of the exact generated building template objects. */
(function(global){"use strict";
 const ns="http://www.w3.org/2000/svg";
 const $=id=>document.getElementById(id);
 const S=(name,attrs={})=>{const el=document.createElementNS(ns,name);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));return el};
 const T=(tag,cls,value)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(value!==undefined)node.textContent=value;return node};
 let library=null,picker=null,activeId=null,activeFloor=null,lastFocus=null,previewViewer=null;
 const renderCache=new Map();
 function previewSpacing(){
  const value=Number($("editor-grid-spacing")?.value);
  return Number.isFinite(value)&&value>0?value:2;
 }
 function record(template){
  if(!template)return null;
  const cacheKey=template.id+"::"+previewSpacing();
  if(renderCache.has(cacheKey))return renderCache.get(cacheKey);
  // This is a preview only. It does not write to the active map or allocate IDs there.
  const data=library.generate(template.id,{prefix:"preview_root",displayLevel:4,x:0,y:0,spacing:previewSpacing(),baseName:template.name});
  const root=data.objects.find(o=>o.id==="preview_root"&&o.geometry?.type==="rect");
  if(!root)throw Error("プレビュー用の建物外形がありません");
  const floors=(root.floors||[]).length?root.floors:[{id:"1F",label:"1階"}];
  const result={root,objects:data.objects,floors};
  renderCache.set(cacheKey,result);return result;
 }
 function renderPlan(template,floorId,small=false){
  const {root,objects}=record(template),r=root.geometry,w=r.width,h=r.height;
  const pad=Math.max(1,Math.min(w,h)*.06);
  const svg=S("svg",{viewBox:[r.x-pad,r.y-pad,w+2*pad,h+2*pad].join(" "),
   preserveAspectRatio:"xMidYMid meet",role:"img","aria-label":template.name+"、"+floorId+"の間取り"});
  svg.classList.add("template-floorplan");
  svg.append(S("rect",{x:r.x,y:r.y,width:w,height:h,fill:"#294a52",stroke:"#a9cbd0","stroke-width":Math.max(.3,Math.min(w,h)*.015)}));
  const order={slab:1,room:2,object:3,stair:4,wall:5,door:6};
  const visible=objects.filter(o=>o.id!==root.id&&(!o.floorId||o.floorId===floorId)&&o.visible!==false)
   .sort((a,b)=>(order[a.objectType]||3)-(order[b.objectType]||3));
  const strokeWidth=Math.max(.2,Math.min(w,h)*(small?.012:.01));
  for(const obj of visible){
   const g=obj.geometry||{},type=obj.objectType;
   let shape=null;
   if(g.type==="rect")shape=S("rect",{x:g.x,y:g.y,width:g.width,height:g.height});
   else if(g.type==="polyline")shape=S("polyline",{points:(g.points||[]).map(p=>p.join(",")).join(" "),fill:"none"});
   else if(g.type==="polygon")shape=S("polygon",{points:(g.points||[]).map(p=>p.join(",")).join(" ")});
   else if(g.type==="circle")shape=S("circle",{cx:g.center[0],cy:g.center[1],r:g.radius});
   else if(g.type==="ring")shape=S("circle",{cx:g.center[0],cy:g.center[1],r:g.outerRadius,fill:"none"});
   if(!shape)continue;
   const fill=type==="slab"?"rgba(36,69,80,.66)":type==="wall"?"none":type==="door"?"none":
     type==="stair"?"rgba(93,138,158,.70)":obj.style?.fill||"rgba(103,149,163,.40)";
   const stroke=type==="wall"?"#dbeded":type==="door"?"#f4bc72":
     type==="stair"?"#a9d5e2":type==="slab"?"none":"#93b7c6";
   shape.setAttribute("fill",fill);
   shape.setAttribute("stroke",stroke);
   shape.setAttribute("stroke-width",String(type==="wall"?strokeWidth*2.1:type==="door"?strokeWidth*1.8:strokeWidth));
   if(g.type==="rect"&&Number.isFinite(g.rotation)&&g.rotation)shape.setAttribute("transform",
    "rotate("+g.rotation+" "+(g.x+g.width/2)+" "+(g.y+g.height/2)+")");
   svg.append(shape);
   if(type==="stair"&&g.type==="rect"){
    const n=6,horizontal=g.height>=g.width;
    for(let i=1;i<n;i++)svg.append(S("line",horizontal?
     {x1:g.x,y1:g.y+i*g.height/n,x2:g.x+g.width,y2:g.y+i*g.height/n,stroke:"#c0d7dc","stroke-width":strokeWidth*.6}:
     {x1:g.x+i*g.width/n,y1:g.y,x2:g.x+i*g.width/n,y2:g.y+g.height,stroke:"#c0d7dc","stroke-width":strokeWidth*.6}));
   }
  }
  return svg;
 }
 function sizeText(t){
  const a=t.custom?t.originalSize:t.cells;return a.join(" × ")+(t.custom?" 座標":" マス");
 }
 function selectTemplate(id){
  const t=library?.allPresets().find(item=>item.id===id);if(!t)return;
  const previous=activeId;
  activeId=id;
  const available=record(t).floors;
  // When moving between templates, use the matching floor if it exists.
  if(previous!==id||!available.some(f=>f.id===activeFloor))
   activeFloor=available.some(f=>f.id===activeFloor)?activeFloor:available[0].id;
  const floors=$("template-preview-floor");
  $("template-preview-title").textContent=t.name;
  $("template-preview-description").textContent=t.description||"説明なし";
  // Dimensions and floor count already appear in the left-side template list.
  floors.replaceChildren();
  for(const f of available){const o=T("option","",f.label||f.id);o.value=f.id;floors.append(o)}
  floors.value=activeFloor;
  drawModal({rebuild:true});
  for(const card of $("template-preview-list").children)
   card.setAttribute("aria-selected",String(card.dataset.templateId===id));
 }
 function open(){
  if(!library)return;
  lastFocus=document.activeElement;
  $("template-preview-modal").hidden=false;
  renderCache.clear();refresh();
  selectTemplate(picker.value||library.allPresets()[0]?.id);
  $("template-preview-filter").focus();
 }
 function showObjectInfo(obj){
  const t=library?.allPresets().find(item=>item.id===activeId);
  const title=$("template-preview-info-title"),meta=$("template-preview-info-meta"),
    detail=$("template-preview-info-text");
  if(!obj){
   title.textContent="設置物を選択してください";
   meta.textContent="";
   detail.textContent="平面図の家具・設備・扉・階段をクリックすると、名前と説明を表示します。";
   return;
  }
  title.textContent=obj.name||obj.id;
  const kind={
   facility:"建物",slab:"床",wall:"壁",door:"扉",stair:"階段",object:"設置物"
  }[obj.objectType]||obj.objectType||"オブジェクト";
  const floor=record(t)?.floors.find(f=>f.id===obj.floorId);
  const g=obj.geometry||{};
  const dimension=g.type==="rect"?" / "+(g.width/previewSpacing()).toFixed(1).replace(/\\.0$/,"")+" × "+(g.height/previewSpacing()).toFixed(1).replace(/\\.0$/,"")+"マス":"";
  meta.textContent=kind+(floor?" / "+(floor.label||floor.id):"")+dimension;
  if(obj.id==="preview_root"){
   detail.textContent=t?.description||obj.detail||"建物の概要";
   return;
  }
  // Existing templates give fixtures a shared boilerplate description. Explain
  // their verified role/type without inventing world-specific lore or capabilities.
  const hints={
   dormancy_pod:"個別に配置された休眠ポッドです。配置・通路・扉との位置関係を確認できます。",
   charging_station:"建物内の充電設備です。配置位置を確認できます。",
   fuel_dispenser:"燃料を補給するための設備です。配置位置を確認できます。",
   terminal_device:"操作・情報用の端末です。配置位置を確認できます。",
   workbench:"作業用の設備です。配置位置を確認できます。",
   storage_container:"収納・保管用の設備です。配置位置を確認できます。",
   table:"作業や接客に使う台です。配置位置を確認できます。",
   bed:"ベッドです。部屋内の配置を確認できます。"
  };
  let explanation=obj.detail||"";
  if(!explanation||explanation.startsWith("建物テンプレートから生成。")){
   if(obj.objectType==="stair"){
    const to=record(t)?.floors.find(f=>f.id===obj.connection?.toFloorId);
    explanation="階を移動するための階段です。"+(to?"接続先："+(to.label||to.id)+"。":"")+"通路や壁との位置関係を確認できます。";
   }else if(obj.objectType==="door")explanation="開口部に配置する扉です。出入口と通行経路を確認できます。";
   else if(obj.objectType==="wall")explanation="間仕切り・外壁を構成する壁です。";
   else if(obj.objectType==="slab")explanation="この階の床面です。";
   else explanation=hints[obj.shapePresetId]||"「"+(obj.name||kind)+"」として配置された設置物です。具体的な機能はテンプレート側で未設定です。";
  }
  detail.textContent=explanation;
 }
 function ensurePreviewViewer(){
  if(previewViewer)return previewViewer;
  if(!global.AAMapViewer?.create)throw Error("共通マップ描画機能が見つかりません");
  // The shared viewer also maintains a legend toggle. Keep its controls
  // off-screen for the read-only preview, while satisfying its UI contract.
  const legendButton=document.createElement("button");
  const legendPanel=document.createElement("div");
  previewViewer=global.AAMapViewer.create({
   canvas:$("template-preview-canvas"),host:$("template-preview-large"),
   legend:legendPanel,legendButton,
   infoTitle:$("template-preview-info-title"),
   infoMeta:$("template-preview-info-meta"),
   infoText:$("template-preview-info-text"),
   onSelectionChanged:(_key,obj)=>showObjectInfo(obj)
  });
  previewViewer.setEditMode(false);
  return previewViewer;
 }
 function buildScene(t){
  const data=record(t),g=data.root.geometry;
  const margin=Math.max(4,Math.min(g.width,g.height)*.12);
  return{
   schemaVersion:2,id:"template_preview",name:t.name,
   coordinateSystem:{
    horizontal:[1,0],vertical:[0,1],background:"#0b1d27",
    bounds:{minX:g.x-margin,maxX:g.x+g.width+margin,minY:g.y-margin,maxY:g.y+g.height+margin}
   },
   layers:[
    {id:"grid",zIndex:5},{id:"subregions",zIndex:20},
    {id:"structures",zIndex:30},{id:"walls",zIndex:45}
   ],
   grid:{visible:false,spacing:previewSpacing(),stroke:"rgba(148,180,192,.40)",strokeWidth:.6},
   settings:{initialDisplayLevel:data.root.displayLevel,editorGrid:{
    spacing:previewSpacing(),originX:Number($("editor-grid-origin-x")?.value)||0,
    originY:Number($("editor-grid-origin-y")?.value)||0}},
   objects:data.objects
  };
 }
 function drawModal({rebuild=false}={}){
  if(!activeId)return;
  const t=library.allPresets().find(item=>item.id===activeId);if(!t)return;
  const viewer=ensurePreviewViewer();
  if(rebuild||viewer.getScene()===null){
   viewer.replaceScene(buildScene(t),{preserveView:false,selectedId:record(t).root.id});
  }
  // Match the editor grid: it is rendered above rooms/slabs and remains legible.
  viewer.setPreviewGridVisible(false);
  viewer.setEditorGrid({visible:$("template-preview-grid").checked,
   spacing:previewSpacing(),originX:Number($("editor-grid-origin-x")?.value)||0,
   originY:Number($("editor-grid-origin-y")?.value)||0,snap:false});
  if(activeFloor&&!viewer.setFloor(activeFloor))
   throw Error("プレビューの階層を切り替えられません");
  viewer.redraw();
  showObjectInfo(viewer.getSelected());
 }
 function close(){
  $("template-preview-modal").hidden=true;activeId=null;
  if(lastFocus?.focus)lastFocus.focus();
 }
 function refresh(){
  if(!library)return;
  renderCache.clear();
  const root=$("template-preview-list");
  root.replaceChildren();
  const filter=$("template-preview-filter").value.trim().toLowerCase();
  for(const t of library.allPresets()){
   if(filter&&!((t.name||"")+" "+(t.category||"")+" "+(t.description||"")).toLowerCase().includes(filter))continue;
   const row=T("button","template-preview-card");row.type="button";
   row.dataset.templateId=t.id;
   row.setAttribute("role","option");
   row.setAttribute("aria-label",t.name+" の間取りを見る");
   row.setAttribute("aria-selected",String(t.id===activeId));
   const thumbnail=T("span","template-preview-thumb");
   try{thumbnail.append(renderPlan(t,record(t).floors[0].id,true))}
   catch(error){thumbnail.textContent="プレビュー不可";row.title=error.message}
   const info=T("span","template-preview-card-text");
   info.append(T("strong","",t.name),T("small","",sizeText(t)+" · "+t.floors+"階"));
   row.append(thumbnail,info);
   row.addEventListener("click",()=>selectTemplate(t.id));
   root.append(row);
  }
 }
 function init(lib,select){
  library=lib;picker=select;
  const modal=$("template-preview-modal");
  if(!modal.dataset.initialized){
   modal.dataset.initialized="1";
   $("template-preview-close").addEventListener("click",close);
   $("template-preview-open").addEventListener("click",open);
   $("template-preview-filter").addEventListener("input",refresh);
   $("template-preview-floor").addEventListener("change",e=>{activeFloor=e.target.value;drawModal()});
   $("template-preview-grid").addEventListener("change",()=>{if(activeId)drawModal()});
   $("template-preview-zoom-in").addEventListener("click",()=>previewViewer?.zoomBy(1.3));
   $("template-preview-zoom-out").addEventListener("click",()=>previewViewer?.zoomBy(1/1.3));
   $("template-preview-fit").addEventListener("click",()=>previewViewer?.reset());
   $("template-preview-use").addEventListener("click",()=>{
    if(!activeId)return;
    picker.value=activeId;picker.dispatchEvent(new Event("change",{bubbles:true}));close();
    picker.focus();
   });
   modal.addEventListener("click",e=>{if(e.target===modal)close()});
   modal.addEventListener("keydown",e=>{
    if(e.key==="Escape"){e.preventDefault();close()}
    if(e.key==="Tab"){
     const nodes=[...modal.querySelectorAll("button:not(:disabled),select:not(:disabled)")];
     const i=nodes.indexOf(document.activeElement);
     if(e.shiftKey&&i===0){e.preventDefault();nodes[nodes.length-1].focus()}
     else if(!e.shiftKey&&i===nodes.length-1){e.preventDefault();nodes[0].focus()}
    }
   });
   document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!modal.hidden)close()});
  }
  refresh();
 }
 global.AAMapTemplatePreview={init,refresh,renderPlan};
})(window);
