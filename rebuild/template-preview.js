/* Read-only previews of the exact generated building template objects. */
(function(global){"use strict";
 const ns="http://www.w3.org/2000/svg";
 const $=id=>document.getElementById(id);
 const S=(name,attrs={})=>{const el=document.createElementNS(ns,name);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));return el};
 const T=(tag,cls,value)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(value!==undefined)node.textContent=value;return node};
 let library=null,picker=null,activeId=null,activeFloor=null,lastFocus=null,previewViewer=null,editing=false,editPast=[],editFuture=[],beforeDrag=null;
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
  if(editPast.length&&activeId&&activeId!==id&&global.confirm&&!global.confirm("未保存の編集内容を破棄して別のテンプレートを開きますか？"))return;
  if(editing)setMode(false);
  editPast=[];editFuture=[];
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
  if(editing)setMode(false);
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
  const dimension=g.type==="rect"?" / "+String(Number((g.width/previewSpacing()).toFixed(1)))+" × "+String(Number((g.height/previewSpacing()).toFixed(1)))+"マス":"";
  meta.textContent=kind+(floor?" / "+(floor.label||floor.id):"")+dimension+(obj.objectType==="wall"&&Number.isFinite(obj.wall?.thickness)?" / 壁厚"+Number((obj.wall.thickness/previewSpacing()*50).toFixed(1))+"cm":"");
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
   onSelectionChanged:(_key,obj)=>{showObjectInfo(obj);syncEditFields(obj)},
   onBeforeObjectDrag:scene=>{if(editing)beforeDrag=JSON.stringify(scene)},
   onObjectMoved:()=>{if(editing&&beforeDrag){editPast.push(JSON.parse(beforeDrag));editFuture=[];beforeDrag=null;setEditMessage("位置・形状を変更しました")}}
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
  if(activeFloor&&viewer.getFloorContext()?.selectedFloorId!==activeFloor&&!viewer.setFloor(activeFloor))
   throw Error("プレビューの階層を切り替えられません");
  viewer.redraw();
  showObjectInfo(viewer.getSelected());
 }
 function close(){
  if(editPast.length&&global.confirm&&!global.confirm("未保存の編集内容を破棄して閉じますか？"))return;
  if(editing)setMode(false);
  editPast=[];editFuture=[];
  $("template-preview-modal").hidden=true;activeId=null;
  if(lastFocus?.focus)lastFocus.focus();
 }
 const eraNames={"common":"共通・未分類","modern-jp":"現代日本","japanese":"和風","historical-eu":"歴史欧州","fantasy":"異世界","machine":"機械","ruins":"終末・廃墟"};
 const catalog={
  "建築":[["wall","壁",0,0],["door","扉",0,0],["room","部屋の区画",6,6]],
  "生活設備":[["kitchen","キッチン",4,2],["toilet","トイレ",2,2],["sink","洗面台",2,1],["bath","浴槽",3,2]],
  "家具":[["bed","ベッド",3,5],["table","机",3,2],["chair","椅子",1,1],["shelf","収納棚",3,1]],
  "商業設備":[["counter","カウンター",5,2],["display_shelf","商品棚",4,1]],
  "作業設備":[["workbench","作業台",6,3],["tool_cabinet","工具棚",3,1]],
  "機械設備":[["charging_station","充電設備",4,3],["fuel_dispenser","燃料補給機",4,3],["dormancy_pod","休眠ポッド",2.2,3.3],["terminal_device","端末",2,2]],
  "特殊設備":[["research_table","研究台",5,2],["storage_container","大型保管庫",5,4]]
 };
 function useGroup(t){
  if(t.use)return t.use;
  const name=(t.name||"");
  if(/住宅|住居|休眠|ポッド/.test(name))return "housing";
  if(/宿|ホテル|旅館/.test(name))return "lodging";
  if(/店舗|商店/.test(name))return "shop";
  if(/研究|事務所|端末|登録/.test(name))return "office";
  if(/工房|整備/.test(name))return "production";
  if(/倉庫|補給|燃料|充電/.test(name))return "storage";
  return "special";
 }
 function eraGroup(t){
  // The legacy generic plans are NOT retroactively asserted to be historical.
  return t.era||((t.worldStyle==="machine"||/^machine_/.test(t.id))?"machine":"common");
 }
 function fillOptions(select,items){
  select.replaceChildren();
  for(const [value,name] of items){const o=T("option","",name);o.value=value;select.append(o)}
  if(items.length)select.value=items[0][0];
 }
 function updateCatalog(){
  const category=$("template-item-category").value;
  fillOptions($("template-item-choice"),(catalog[category]||[]).map(a=>[a[0],a[1]]));
 }
 function setEditMessage(s){$("template-edit-status").textContent=s}
 function syncEditFields(obj){
  $("template-edit-name").value=editing&&obj?obj.name||"":"";
  $("template-edit-detail").value=editing&&obj?obj.detail||"":"";
  $("template-wall-thickness-label").hidden=!(editing&&obj?.objectType==="wall");
  $("template-wall-thickness").value=editing&&obj?.objectType==="wall"&&Number.isFinite(obj.wall?.thickness)?String(Number((obj.wall.thickness/previewSpacing()*50).toFixed(2))):"";
 }
 function setMode(value){
  editing=!!value;
  $("template-mode-toggle").setAttribute("aria-pressed",String(editing));
  $("template-mode-toggle").textContent=editing?"プレビューに戻る":"編集モード";
  $("template-edit-controls").hidden=!editing;
  const pickerSide=$("template-preview-picker"),palette=$("template-edit-catalog");
  if(editing)pickerSide.insertBefore(palette,$("template-preview-list"));
  else $("template-edit-controls").insertBefore(palette,$("template-edit-controls").firstChild);
  previewViewer?.setEditMode(editing);
  if(editing){syncEditFields(previewViewer?.getSelected());setEditMessage("配置物を選択して編集、保存時は別名で登録します")}
 }
 function snapshot(){if(!editing||!previewViewer)return;editPast.push(previewViewer.getScene());if(editPast.length>45)editPast.shift();editFuture=[]}
 function updateScene(scene,selectedId){
  previewViewer.replaceScene(scene,{preserveView:true,selectedId});
  previewViewer.setEditMode(editing);
  if(activeFloor&&previewViewer.getFloorContext()?.selectedFloorId!==activeFloor)previewViewer.setFloor(activeFloor);
  showObjectInfo(previewViewer.getSelected());
 }
 function setHistory(from,to){
  if(!from.length)return;
  to.push(previewViewer.getScene());
  const next=from.pop(),selectedId=previewViewer.getSelected()?.id;
  updateScene(next,next.objects.some(o=>o.id===selectedId)?selectedId:"preview_root");
 }
 function uniqueId(scene,key){
  let name="preview_"+String(key).replace(/[^a-z0-9_-]/gi,"_"),i=2;
  while(scene.objects.some(o=>o.id===name+"_"+i))i++;
  return name+"_"+i;
 }
 function addItem(){
  if(!editing)return;
  const key=$("template-item-choice").value;
  const item=(catalog[$("template-item-category").value]||[]).find(x=>x[0]===key);
  if(!item)return;
  const scene=previewViewer.getScene(),root=scene.objects.find(o=>o.id==="preview_root");
  if(!root)return;
  const spacing=previewSpacing(),g=root.geometry;
  const id=uniqueId(scene,key),w=(item[2]||4)*spacing,h=(item[3]||2)*spacing;
  // Snap newly added objects to half-cell positions at the building center.
  const center=previewViewer.screenToWorld($("template-preview-canvas").getBoundingClientRect().width/2,$("template-preview-canvas").getBoundingClientRect().height/2);
  const snap=v=>Math.round(v/(spacing*.5))*(spacing*.5);
  const x=snap(Math.max(g.x+spacing,Math.min(g.x+g.width-w-spacing,center[0]-w/2)));
  const y=snap(Math.max(g.y+spacing,Math.min(g.y+g.height-h-spacing,center[1]-h/2)));
  let geometry=key==="wall"||key==="door"?{type:"polyline",points:[[x,y],[x+2*spacing,y]]}:{type:"rect",x,y,width:w,height:h};
  const kind=key==="wall"?"wall":key==="door"?"door":"object";
  snapshot();
  const obj={id,name:item[1],parentId:root.id,displayLevel:(root.displayLevel||4)+1,floorId:activeFloor,
   objectType:kind,layer:kind==="wall"||kind==="door"?"walls":"structures",zIndex:kind==="wall"?47:kind==="door"?49:45,
   visible:true,selectable:true,geometry,
   style:{fill:kind==="object"?"rgba(65,110,130,.65)":null,stroke:kind==="door"?"#e8b97a":"#a8d7dd",strokeWidth:1.5},
   shapePresetId:key,label:{visible:false,text:item[1]},detail:item[1]+"（設置物の説明を編集できます）",
   metadata:{generated:false,templateEditor:true}};
  if(kind==="wall")obj.wall={thickness:previewSpacing()*10/50};
  if(kind==="door")obj.door={hinge:"start",swing:"inward",state:"closed",swingSide:"left"};
  scene.objects.push(obj);updateScene(scene,id);setEditMessage(item[1]+"を追加しました");
 }
 function changeSelected(remove=false){
  if(!editing)return;
  const selected=previewViewer?.getSelected();
  if(!selected||selected.id==="preview_root"){setEditMessage("建物全体ではなく設置物を選択してください");return}
  const scene=previewViewer.getScene();
  snapshot();
  if(remove){
   const ids=new Set([selected.id]);
   for(let i=0;i<scene.objects.length;i++)if(ids.has(scene.objects[i].parentId))ids.add(scene.objects[i].id);
   scene.objects=scene.objects.filter(o=>!ids.has(o.id));
  }else{
   const obj=scene.objects.find(o=>o.id===selected.id);
   obj.name=$("template-edit-name").value.trim()||obj.name;
   obj.detail=$("template-edit-detail").value.trim();
   if(obj.objectType==="wall"){
    const cm=Number($("template-wall-thickness").value);
    if(!Number.isFinite(cm)||cm<1||cm>300){editPast.pop();setEditMessage("壁の厚さは1〜300cmで入力してください");return}
    obj.wall={...obj.wall,thickness:cm/50*previewSpacing()};
   }
   if(obj.label)obj.label.text=obj.name;
  }
  updateScene(scene,remove?"preview_root":selected.id);
  setEditMessage(remove?"設置物を削除しました":"名前と説明を変更しました");
 }
 // Geometric clearance checks for placed fixtures and wall thickness.
 function checkFixtureCollisions(scene){
  const errors=[],eps=1e-7,objects=scene?.objects||[];
  const fixtures=objects.filter(o=>["object","stair"].includes(o.objectType)&&o.geometry?.type==="rect");
  const barriers=objects.filter(o=>["wall","door"].includes(o.objectType)&&o.geometry?.type==="polyline");
  for(const fixture of fixtures){
   const g=fixture.geometry;
   for(const wall of barriers){
    if(wall.floorId!==fixture.floorId)continue;
    const half=wall.objectType==="wall"?(wall.wall?.thickness||0)/2:0;
    const points=wall.geometry.points||[];
    for(let i=1;i<points.length;i++){
     const [ax,ay]=points[i-1],[bx,by]=points[i];
     const horizontal=Math.abs(ay-by)<eps,vertical=Math.abs(ax-bx)<eps;
     if(horizontal&&g.y<ay+half-eps&&g.y+g.height>ay-half+eps&&
       Math.min(Math.max(ax,bx),g.x+g.width)-Math.max(Math.min(ax,bx),g.x)>eps){
       errors.push(fixture.name+"と"+wall.name+"が干渉");break;
     }
     if(vertical&&g.x<ax+half-eps&&g.x+g.width>ax-half+eps&&
       Math.min(Math.max(ay,by),g.y+g.height)-Math.max(Math.min(ay,by),g.y)>eps){
       errors.push(fixture.name+"と"+wall.name+"が干渉");break;
     }
    }
   }
   for(const other of fixtures)if(fixture.id<other.id&&fixture.floorId===other.floorId){
    const b=other.geometry;
    if(Math.min(g.x+g.width,b.x+b.width)-Math.max(g.x,b.x)>eps&&
       Math.min(g.y+g.height,b.y+b.height)-Math.max(g.y,b.y)>eps)
     errors.push(fixture.name+"と"+other.name+"が重複");
   }
  }
  return errors;
 }
 function saveCopy(){
  if(!editing)return;
  const name=$("template-save-name").value.trim(),id=$("template-save-id").value.trim();
  try{
   const scene=previewViewer.getScene();
   const collisions=checkFixtureCollisions(scene);
   if(collisions.length)throw Error("設備の貫通・重複を修正してください："+collisions.slice(0,3).join("、")+(collisions.length>3?" ほか"+(collisions.length-3)+"件":""));
   const spec=library.capture(scene,"preview_root",{id,name,description:library.allPresets().find(t=>t.id===activeId)?.description||""});
   const source=library.allPresets().find(t=>t.id===activeId);
   spec.era=source?eraGroup(source):"common";
   spec.use=source?.use||useGroup(source||{name});
   library.register(spec);
   // Identical local key used by the existing editor's template storage.
   localStorage.setItem("mymapcreater:building-templates:v1",JSON.stringify(library.custom));
   if(typeof global.dispatchEvent==="function")global.dispatchEvent(new Event("building-templates-updated"));
   if(![...picker.options].some(o=>o.value===spec.id)){
    const option=T("option","",spec.name);option.value=spec.id;picker.append(option);
   }
   picker.value=spec.id;
   picker.dispatchEvent(new Event("change",{bubbles:true}));
   activeId=spec.id;
   setMode(false);
   editPast=[];editFuture=[];
   renderCache.clear();
   $("template-era-filter").value="all";$("template-use-filter").value="all";
   refresh();selectTemplate(spec.id);
   setEditMessage("別名保存しました");
  }catch(e){setEditMessage("保存失敗："+e.message)}
 }
 function refresh(){
  if(!library)return;
  renderCache.clear();
  const root=$("template-preview-list");
  root.replaceChildren();
  const filter=$("template-preview-filter").value.trim().toLowerCase();
  const era=$("template-era-filter").value,use=$("template-use-filter").value;
  for(const t of library.allPresets()){
   if(era!=="all"&&eraGroup(t)!==era)continue;
   if(use!=="all"&&useGroup(t)!==use)continue;
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
   $("template-era-filter").addEventListener("change",refresh);
   $("template-use-filter").addEventListener("change",refresh);
   $("template-mode-toggle").addEventListener("click",()=>setMode(!editing));
   fillOptions($("template-item-category"),Object.keys(catalog).map(name=>[name,name]));
   updateCatalog();
   $("template-item-category").addEventListener("change",updateCatalog);
   $("template-item-add").addEventListener("click",addItem);
   $("template-item-apply").addEventListener("click",()=>changeSelected(false));
   $("template-item-delete").addEventListener("click",()=>changeSelected(true));
   $("template-undo").addEventListener("click",()=>setHistory(editPast,editFuture));
   $("template-redo").addEventListener("click",()=>setHistory(editFuture,editPast));
   $("template-save-copy").addEventListener("click",saveCopy);
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
