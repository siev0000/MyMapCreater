/* Read-only previews of the exact generated building template objects. */
(function(global){"use strict";
 const ns="http://www.w3.org/2000/svg";
 const $=id=>document.getElementById(id);
 const S=(name,attrs={})=>{const el=document.createElementNS(ns,name);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));return el};
 const T=(tag,cls,value)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(value!==undefined)node.textContent=value;return node};
 let library=null,picker=null,activeId=null,activeFloor=null,lastFocus=null,previewViewer=null,editing=false,editPast=[],editFuture=[],beforeDrag=null;
 const renderCache=new Map();
 const savedPreviewKey="mymapcreater:template-preview-state:v1";
 function readSavedPreview(){
  try{
   const v=JSON.parse(localStorage.getItem(savedPreviewKey)||"null");
   return v?.version===1&&typeof v.id==="string"?v:null;
  }catch(_){return null}
 }
 function writeSavedPreview(){
  try{localStorage.setItem(savedPreviewKey,JSON.stringify({
   version:1,id:activeId||picker?.value||"",
   floorId:activeFloor||null,
   open:!$("template-preview-modal").hidden,
   query:$("template-preview-filter").value,
   era:$("template-era-filter").value,
   use:$("template-use-filter").value,
   showGrid:$("template-preview-grid").checked
  }))}catch(_){}
 }
 function restoreSavedPreviewFields(saved){
  if(!saved)return;
  for(const [id,v] of [["template-preview-filter",saved.query],["template-era-filter",saved.era],["template-use-filter",saved.use]]){
   const el=$(id);
   if(el&&typeof v==="string"&&(el.tagName!=="SELECT"||[...el.options].some(x=>x.value===v)))el.value=v;
  }
  if(typeof saved.showGrid==="boolean")$("template-preview-grid").checked=saved.showGrid;
 }

 function previewSpacing(){
  const mapScale=Number(global.AAMapTemplateCellSpacing?.());
  if(Number.isFinite(mapScale)&&mapScale>0)return mapScale;
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
  const order={slab:1,room:2,region:2,object:3,stair:4,wall:5,door:6,window:6};
  const visible=objects.filter(o=>o.id!==root.id&&(!o.floorId||o.floorId===floorId)&&o.visible!==false)
   .sort((a,b)=>(order[a.objectType]||3)-(order[b.objectType]||3));
  const strokeWidth=Math.max(.2,Math.min(w,h)*(small?.012:.01));
  for(const obj of visible){
   const g=obj.geometry||{},type=obj.objectType;
   let shape=null;
   if(g.type==="rect")shape=S("rect",{x:g.x,y:g.y,width:g.width,height:g.height});
   else if(g.type==="polyline"){
    if(type==="wall"){
     // The small thumbnail must reflect real geometric openings too.
     const linked=objects.filter(o=>["door","window"].includes(o.objectType)&&o.opening?.wallId===obj.id&&o.floorId===floorId);
     if(linked.length){
      let d="";
      for(let i=1;i<g.points.length;i++){
       const a=g.points[i-1],b=g.points[i],dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy;
       if(len2<=1e-9)continue;
       const gaps=[];
       for(const opening of linked){
        const points=opening.geometry?.points;if(points?.length!==2)continue;
        const ts=points.map(p=>((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len2);
        const residual=points.some(p=>Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/Math.sqrt(len2)>.01);
        if(!residual&&Math.min(...ts)>=-.001&&Math.max(...ts)<=1.001)
         gaps.push([Math.max(0,Math.min(...ts)),Math.min(1,Math.max(...ts))]);
       }
       gaps.sort((v,w)=>v[0]-w[0]);let pos=0;
       const seg=(u,v)=>{if(v-u>1e-6)d+="M"+(a[0]+dx*u)+" "+(a[1]+dy*u)+" L"+(a[0]+dx*v)+" "+(a[1]+dy*v)+" "};
       for(const [start,end] of gaps){seg(pos,start);pos=Math.max(pos,end)}
       seg(pos,1);
      }
      shape=S("path",{d,fill:"none"});
     }
    }
    if(!shape)shape=S("polyline",{points:(g.points||[]).map(p=>p.join(",")).join(" "),fill:"none"});
   }
   else if(g.type==="polygon")shape=S("polygon",{points:(g.points||[]).map(p=>p.join(",")).join(" ")});
   else if(g.type==="circle")shape=S("circle",{cx:g.center[0],cy:g.center[1],r:g.radius});
   else if(g.type==="ring")shape=S("circle",{cx:g.center[0],cy:g.center[1],r:g.outerRadius,fill:"none"});
   if(!shape)continue;
   const fill=type==="slab"?"rgba(36,69,80,.66)":type==="wall"?"none":type==="door"||type==="window"?"none":
     type==="stair"?"rgba(93,138,158,.70)":obj.style?.fill||"rgba(103,149,163,.40)";
   const stroke=type==="wall"?"#dbeded":type==="door"?"#f4bc72":type==="window"?"#80ddf0":
     type==="stair"?"#a9d5e2":type==="slab"?"none":"#93b7c6";
   shape.setAttribute("fill",fill);
   shape.setAttribute("stroke",stroke);
   shape.setAttribute("stroke-width",String(type==="wall"?(obj.wall?.thickness||strokeWidth*2.1):type==="door"||type==="window"?strokeWidth*1.8:strokeWidth));
   if(type==="wall")shape.setAttribute("stroke-linecap","butt");
   if(g.type==="rect"&&Number.isFinite(g.rotation)&&g.rotation)shape.setAttribute("transform",
    "rotate("+g.rotation+" "+(g.x+g.width/2)+" "+(g.y+g.height/2)+")");
   svg.append(shape);
   if(g.type==="rect"&&obj.metadata?.attachedShower){
    // Match the bathtub-mounted shower indicator used in the large canvas.
    const radius=Math.max(.12,Math.min(g.width,g.height)*.085);
    svg.append(S("circle",{cx:g.x+g.width*.77,cy:g.y+g.height*.22,
     r:radius,fill:"#d5eff1",stroke:"#315d70","stroke-width":strokeWidth*.35}));
   }
   if(type==="stair"&&g.type==="rect"){
    if(obj.stairDesign?.type==="switchback-flight"){
     const left=g.x,right=g.x+g.width,top=g.y,bottom=g.y+g.height;
     const mid=(left+right)/2,turn=top+g.height*.28;
     const yHi=top+g.height*.15,yLo=top+g.height*.88;
     const l=left+g.width*.25,r=left+g.width*.75;
     const up=obj.stairDesign.direction==="up",color=up?"#82e3f4":"#ffc875";
     svg.append(S("rect",{x:left,y:top,width:g.width,height:turn-top,
      fill:"rgba(92,144,160,.4)",stroke:"#bad6df","stroke-width":strokeWidth*.55}));
     svg.append(S("line",{x1:mid,y1:turn,x2:mid,y2:bottom,
      stroke:"#c3dde4","stroke-width":strokeWidth*.6}));
     for(let k=1;k<7;k++){
      const yy=turn+(bottom-turn)*k/7;
      for(const [a,b] of [[left,mid],[mid,right]])
       svg.append(S("line",{x1:a,y1:yy,x2:b,y2:yy,stroke:"#9fbdc8",
        "stroke-width":strokeWidth*.45}));
     }
     const xStart=up?l:r,xEnd=up?r:l;
     const route="M"+xStart+" "+yLo+" L"+xStart+" "+turn+
      " Q"+xStart+" "+yHi+" "+mid+" "+yHi+
      " Q"+xEnd+" "+yHi+" "+xEnd+" "+turn+" L"+xEnd+" "+yLo;
     svg.append(S("path",{d:route,fill:"none",stroke:color,
      "stroke-width":strokeWidth*1.4,"stroke-linecap":"round"}));
     const head=g.width*.07;
     svg.append(S("path",{d:"M"+(xEnd-head)+" "+(yLo-head)+" L"+xEnd+" "+yLo+
      " L"+(xEnd+head)+" "+(yLo-head),fill:"none",stroke:color,
      "stroke-width":strokeWidth*1.35}));
     if(!small){
      const txt=S("text",{x:mid,y:turn+g.height*.15,fill:color,
       "text-anchor":"middle","font-size":Math.max(strokeWidth*2.3,g.width*.2),
       "font-weight":"700",stroke:"#12303d","stroke-width":strokeWidth*.8,
       "paint-order":"stroke"});
      txt.textContent=up?"上階へ":"下階へ";svg.append(txt);
     }
    }else if(obj.stairDesign?.type==="switchback"){
     // A single U-shaped stair, without a route arrow. Omit only the
     // lowest tread on the ascending (left) side as the entry cue.
     const left=g.x,right=g.x+g.width,top=g.y,bottom=g.y+g.height;
     const mid=(left+right)/2,turn=top+g.height*.28;
     svg.append(S("rect",{x:left,y:top,width:g.width,height:turn-top,
      fill:"rgba(92,144,160,.4)",stroke:"#bad6df","stroke-width":strokeWidth*.55}));
     svg.append(S("line",{x1:mid,y1:turn,x2:mid,y2:bottom,
      stroke:"#effcff","stroke-width":strokeWidth*.7}));
     svg.append(S("line",{x1:left,y1:turn,x2:right,y2:turn,
      stroke:"#effcff","stroke-width":strokeWidth*.7}));
     for(let step=1;step<=6;step++){
      const yy=turn+(bottom-turn)*step/7;
      if(step!==6)svg.append(S("line",{x1:left,y1:yy,x2:mid,y2:yy,
       stroke:"#abcbd4","stroke-width":strokeWidth*.48}));
      svg.append(S("line",{x1:mid,y1:yy,x2:right,y2:yy,
       stroke:"#abcbd4","stroke-width":strokeWidth*.48}));
     }
    }else{
     const n=6,horizontal=g.height>=g.width;
     for(let i=1;i<n;i++)svg.append(S("line",horizontal?
      {x1:g.x,y1:g.y+i*g.height/n,x2:g.x+g.width,y2:g.y+i*g.height/n,stroke:"#c0d7dc","stroke-width":strokeWidth*.6}:
      {x1:g.x+i*g.width/n,y1:g.y,x2:g.x+i*g.width/n,y2:g.y+g.height,stroke:"#c0d7dc","stroke-width":strokeWidth*.6}));
    }
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
  writeSavedPreview();
 }
 function open(){
  if(!library)return;
  lastFocus=document.activeElement;
  if(editing)setMode(false);
  const saved=readSavedPreview();
  restoreSavedPreviewFields(saved);
  $("template-preview-modal").hidden=false;
  renderCache.clear();refresh();
  $("template-picker-filters").open=false;
  const previous=library.allPresets().some(t=>t.id===saved?.id)?saved.id:null;
  activeFloor=saved?.floorId||null;
  selectTemplate(previous||picker.value||library.allPresets()[0]?.id);
  writeSavedPreview();
  $("template-mode-toggle").focus();
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
   facility:"建物",slab:"床",wall:"壁",door:"扉",window:"窓",region:"部屋",stair:"階段",object:"設置物"
  }[obj.objectType]||obj.objectType||"オブジェクト";
  const floor=record(t)?.floors.find(f=>f.id===obj.floorId);
  const g=obj.geometry||{};
  const dimension=g.type==="rect"?" / "+String(Number((g.width/previewSpacing()).toFixed(1)))+" × "+String(Number((g.height/previewSpacing()).toFixed(1)))+"マス":"";
  meta.textContent=kind+(floor?" / "+(floor.label||floor.id):"")+dimension+(obj.objectType==="wall"&&Number.isFinite(obj.wall?.thickness)?" / 壁厚"+Number((obj.wall.thickness/previewSpacing()*50).toFixed(1))+"cm":"")+(["door","window"].includes(obj.objectType)&&obj.geometry?.points?.length===2?" / 開口"+Number((length2(obj.geometry.points[0],obj.geometry.points[1])/previewSpacing()*50).toFixed(1))+"cm":"");
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
   else explanation=hints[obj.shapePresetId]||
    (obj.shapePresetId==="refrigerator"?"冷蔵庫です。設置位置を確認できます。":
    obj.shapePresetId==="washer"?"洗濯機です。給排水への接続は別途確認が必要です。":
    obj.shapePresetId==="bath"&&obj.metadata?.attachedShower?"浴槽と付属シャワーです。":
    "「"+(obj.name||kind)+"」として配置された設置物です。具体的な機能はテンプレート側で未設定です。");
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
   onSelectionChanged:(_key,obj)=>{
    // Clicking a directional stair target changes the physical floor.
    // Keep the preview floor selector and saved state in sync.
    const currentFloor=previewViewer?.getFloorContext()?.selectedFloorId;
    if(currentFloor&&activeFloor!==currentFloor){
     activeFloor=currentFloor;
     if([...$("template-preview-floor").options].some(o=>o.value===currentFloor))
      $("template-preview-floor").value=currentFloor;
     writeSavedPreview();
    }
    showObjectInfo(obj);syncEditFields(obj);
    if(editing)updateAreaStatus(previewViewer?.getScene());
   },
   onBeforeObjectDrag:scene=>{if(editing)beforeDrag=JSON.stringify(scene)},
   onObjectChanging:(_obj,scene)=>{if(editing)refreshChecks(scene)},
   onObjectMoved:()=>{if(editing&&beforeDrag){
    editPast.push(JSON.parse(beforeDrag));editFuture=[];beforeDrag=null;
    const obj=previewViewer.getSelected();
    if(["door","window"].includes(obj?.objectType))linkSelectedOpening(true);
    setEditMessage("位置・形状を変更しました");refreshChecks(previewViewer.getScene());
   }}
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
  refreshChecks(viewer.getScene());
 }
 function close(){
  if(editPast.length&&global.confirm&&!global.confirm("未保存の編集内容を破棄して閉じますか？"))return;
  if(editing)setMode(false);
  editPast=[];editFuture=[];
  writeSavedPreview();
  $("template-preview-modal").hidden=true;
  writeSavedPreview();
  activeId=null;
  if(lastFocus?.focus)lastFocus.focus();
 }
 const eraNames={"common":"共通・未分類","modern-jp":"現代日本","japanese":"和風","historical-eu":"歴史欧州","fantasy":"異世界","machine":"機械","ruins":"終末・廃墟"};
 const catalog={
  "建築":[["wall","壁",0,0],["door","扉",0,0],["window","窓",0,0],["room","部屋の区画",6,6]],
  "生活設備":[["kitchen","キッチン",4,2],["toilet","トイレ",2,2],["sink","洗面台",2,1],["bath","浴槽",3,2]],
  "家具":[["bed","ベッド",3,5],["table","机",3,2],["chair","椅子",1,1],["shelf","収納棚",3,1]],
  "商業設備":[["counter","カウンター",5,2],["display_shelf","商品棚",4,1]],
  "作業設備":[["workbench","作業台",6,3],["tool_cabinet","工具棚",3,1]],
  "機械設備":[["charging_station","充電設備",4,3],["fuel_dispenser","燃料補給機",4,3],["dormancy_pod","休眠ポッド",2.2,3.3],["terminal_device","端末",2,2]],
  "特殊設備":[["research_table","研究台",5,2],["storage_container","大型保管庫",5,4]]
 };
 function palette(){
  const combined=Object.fromEntries(Object.entries(catalog).map(([category,items])=>[category,items.map(item=>({
   id:item[0],name:item[1],widthCm:(item[2]||4)*50,depthCm:(item[3]||2)*50,shape:item[0],icon:"",description:item[1]+"の設置範囲です。"
  }))]));
  const residential=global.AAMapObjectCatalog?.residential||[];
  for(const item of residential){
   if(!combined[item.category])combined[item.category]=[];
   combined[item.category].push(item);
  }
  return combined;
 }
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
  const entries=palette()[category]||[];
  const previous=$("template-item-choice").value;
  fillOptions($("template-item-choice"),entries.map(a=>[a.id,(a.icon?a.icon+" ":"")+a.name+" · "+a.widthCm+"×"+a.depthCm+"cm"]));
  if(entries.some(e=>e.id===previous))$("template-item-choice").value=previous;
  refreshItemList();
 }
 function paletteShape(item){
  const outer=T("span","template-item-shape");
  outer.setAttribute("aria-hidden","true");
  const ns="http://www.w3.org/2000/svg";
  const svg=document.createElementNS(ns,"svg");svg.setAttribute("viewBox","0 0 48 40");
  const add=(tag,attrs)=>{const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));svg.appendChild(el);return el};
  const type=String(item.objectType||item.type||item.id||"").toLowerCase();
  const name=String(item.name||"");
  const stroke="#bcdde5",accent="#e6c986",base="#426c7c";
  if(/door|扉|ドア/.test(type+" "+name)){
   add("path",{d:"M7 34 V7 H41 V34",fill:"none",stroke, "stroke-width":3});
   add("path",{d:"M9 34 L9 9 A25 25 0 0 1 34 34",fill:"none",stroke:accent,"stroke-dasharray":"3 2"});
   add("line",{x1:9,y1:34,x2:9,y2:9,stroke:accent,"stroke-width":2});
  }else if(/window|窓/.test(type+" "+name)){
   add("rect",{x:5,y:12,width:38,height:16,fill:base,stroke,"stroke-width":3});
   add("line",{x1:24,y1:12,x2:24,y2:28,stroke:accent,"stroke-width":2});
  }else if(/wall|壁/.test(type+" "+name)){
   add("rect",{x:4,y:14,width:40,height:12,fill:base,stroke,"stroke-width":2});
   add("line",{x1:20,y1:14,x2:20,y2:26,stroke:accent,"stroke-width":1});
  }else if(/room|区画/.test(type+" "+name)){
   add("rect",{x:7,y:5,width:34,height:30,fill:"none",stroke,"stroke-width":2,"stroke-dasharray":"5 2"});
  }else{
   add("rect",{x:7,y:8,width:34,height:24,rx:3,fill:base,stroke,"stroke-width":2});
   add("rect",{x:12,y:13,width:24,height:14,rx:2,fill:"none",stroke:accent,"stroke-width":2});
  }
  outer.append(svg);return outer;
 }
 function setDetailTab(tab){
  const settings=tab==="settings";
  const edit=$("template-edit-controls"),description=$("template-detail-description");
  if(!edit||!description)return;
  edit.hidden=!editing||!settings;
  description.hidden=editing&&settings;
  $("template-detail-settings-tab").setAttribute("aria-selected",String(editing&&settings));
  $("template-detail-description-tab").setAttribute("aria-selected",String(!editing||!settings));
  $("template-detail-settings-tab").hidden=!editing;
  $("template-detail-description-tab").hidden=!editing;
 }
 function refreshItemList(){
  const root=$("template-item-list");if(!root)return;
  root.replaceChildren();
  const entries=palette()[$("template-item-category").value]||[];
  const selected=$("template-item-choice").value;
  for(const item of entries){
   const button=T("button","template-preview-card template-item-card");
   button.type="button";button.setAttribute("role","option");
   button.setAttribute("aria-selected",String(item.id===selected));
   button.append(paletteShape(item),T("strong","",(item.icon?item.icon+" ":"")+item.name),
    T("small","",item.widthCm+" × "+item.depthCm+"cm"));
   button.addEventListener("click",()=>{
    $("template-item-choice").value=item.id;
    for(const card of root.children)card.setAttribute("aria-selected",String(card===button));
   });
   root.append(button);
  }
 }
 function setEditMessage(s){$("template-edit-status").textContent=s}
 function syncEditFields(obj){
  $("template-edit-name").value=editing&&obj?obj.name||"":"";
  $("template-edit-detail").value=editing&&obj?obj.detail||"":"";
  $("template-wall-thickness-label").hidden=!(editing&&obj?.objectType==="wall");
  $("template-wall-thickness").value=editing&&obj?.objectType==="wall"&&Number.isFinite(obj.wall?.thickness)?String(Number((obj.wall.thickness/previewSpacing()*50).toFixed(2))):"";
  const rect=editing&&obj?.geometry?.type==="rect"&&obj.objectType==="object";
  for(const [label,input] of [["template-dim-width-label","template-dim-width"],["template-dim-height-label","template-dim-height"],["template-dim-rotation-label","template-dim-rotation"]])
   $(label).hidden=!rect;
  $("template-dim-width").value=rect?Number((obj.geometry.width/previewSpacing()*50).toFixed(1)):"";
  $("template-dim-height").value=rect?Number((obj.geometry.height/previewSpacing()*50).toFixed(1)):"";
  $("template-dim-rotation").value=rect?obj.geometry.rotation||0:"";
  const opening=editing&&["door","window"].includes(obj?.objectType);
  $("template-opening-width-label").hidden=!opening;
  $("template-opening-link").hidden=!opening;
  $("template-opening-width").value=opening?Number((length2(obj.geometry.points[0],obj.geometry.points[1])/previewSpacing()*50).toFixed(1)):"";
 }
 function setMode(value){
  editing=!!value;
  $("template-mode-toggle").setAttribute("aria-pressed",String(editing));
  $("template-mode-toggle").textContent=editing?"プレビューに戻る":"編集モード";
  setDetailTab(editing?"settings":"description");
  const pickerSide=$("template-preview-picker"),palettePanel=$("template-edit-catalog");
  const houseList=$("template-preview-list"),itemList=$("template-item-list"),filters=$("template-picker-filters");
  pickerSide.dataset.editing=String(editing);
  houseList.hidden=editing;itemList.hidden=!editing;filters.hidden=editing;
  if(editing){
   pickerSide.insertBefore(palettePanel,itemList);
   refreshItemList();
  }else{
   pickerSide.insertBefore(palettePanel,itemList);
  }
  previewViewer?.setEditMode(editing);
  if(editing){syncEditFields(previewViewer?.getSelected());setEditMessage("配置物を選択して編集、保存時は別名で登録します")}
 }
 function snapshot(){if(!editing||!previewViewer)return;editPast.push(previewViewer.getScene());if(editPast.length>45)editPast.shift();editFuture=[]}
 function updateScene(scene,selectedId){
  previewViewer.replaceScene(scene,{preserveView:true,selectedId});
  previewViewer.setEditMode(editing);
  if(activeFloor&&previewViewer.getFloorContext()?.selectedFloorId!==activeFloor)previewViewer.setFloor(activeFloor);
  showObjectInfo(previewViewer.getSelected());
  syncEditFields(previewViewer.getSelected());
  refreshChecks(previewViewer.getScene());
 }
 function setHistory(from,to){
  if(!from.length)return;
  const current=previewViewer.getScene();
  to.push(current);
  const next=from.pop(),selectedId=previewViewer.getSelected()?.id;
  const fresh=next.objects.find(o=>o.metadata?.templateEditor&&!current.objects.some(v=>v.id===o.id));
  updateScene(next,fresh?.id||(next.objects.some(o=>o.id===selectedId)?selectedId:"preview_root"));
 }
 function uniqueId(scene,key){
  let name="preview_"+String(key).replace(/[^a-z0-9_-]/gi,"_"),i=2;
  while(scene.objects.some(o=>o.id===name+"_"+i))i++;
  return name+"_"+i;
 }
 function addItem(){
  if(!editing)return;
  const key=$("template-item-choice").value;
  const item=(palette()[$("template-item-category").value]||[]).find(x=>x.id===key);
  if(!item)return;
  const scene=previewViewer.getScene(),root=scene.objects.find(o=>o.id==="preview_root");
  if(!root)return;
  const spacing=previewSpacing(),g=root.geometry;
  const id=uniqueId(scene,key),w=item.widthCm/50*spacing,h=item.depthCm/50*spacing;
  // Snap newly added objects to half-cell positions at the building center.
  const center=previewViewer.screenToWorld($("template-preview-canvas").getBoundingClientRect().width/2,$("template-preview-canvas").getBoundingClientRect().height/2);
  const snap=v=>Math.round(v/(spacing*.5))*(spacing*.5);
  const x=snap(Math.max(g.x+spacing,Math.min(g.x+g.width-w-spacing,center[0]-w/2)));
  const y=snap(Math.max(g.y+spacing,Math.min(g.y+g.height-h-spacing,center[1]-h/2)));
  let geometry=key==="wall"||key==="door"||key==="window"?{type:"polyline",points:[[x,y],[x+2*spacing,y]]}:{type:"rect",x,y,width:w,height:h};
  const kind=key==="wall"?"wall":key==="door"?"door":key==="window"?"window":key==="room"?"region":"object";
  const obj={id,name:item.name,parentId:root.id,displayLevel:(root.displayLevel||4)+1,floorId:activeFloor,
   objectType:kind,layer:["wall","door","window"].includes(kind)?"walls":"structures",zIndex:kind==="wall"?47:kind==="door"||kind==="window"?49:kind==="region"?31:45,
   visible:true,selectable:true,geometry,
   style:{fill:kind==="object"?"rgba(65,110,130,.65)":null,stroke:kind==="door"?"#e8b97a":"#a8d7dd",strokeWidth:1.5},
   shapePresetId:item.shape||key,label:{visible:false,text:item.name},detail:item.description||item.name+"（設置物の説明を編集できます）",
   metadata:{generated:false,templateEditor:true,catalogItemId:key}};
  if(kind==="wall")obj.wall={thickness:previewSpacing()*10/50};
  if(kind==="door")obj.door={hinge:"start",swing:"inward",state:"closed",swingSide:"left"};
  if(kind==="region"){obj.label={visible:true,text:obj.name,position:[x+w/2,y+h/2],fontSize:9};obj.shapePresetId="room_zone"}
  if(kind==="door"||kind==="window"){
   if(!placeOpening(scene,obj,center,2*spacing)){setEditMessage("扉・窓を設置できる長さの壁がありません");return}
   if(kind==="window")obj.style.stroke="#80ddf0";
  }
  snapshot();
  scene.objects.push(obj);updateScene(scene,id);setEditMessage(item.name+"を追加しました");
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
   if(obj.objectType==="object"&&obj.geometry?.type==="rect"){
    const w=Number($("template-dim-width").value),h=Number($("template-dim-height").value),rotation=Number($("template-dim-rotation").value);
    if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1||w>5000||h>5000||!Number.isFinite(rotation)||Math.abs(rotation)>360){
     editPast.pop();setEditMessage("家具の幅・奥行は1〜5000cm、回転は±360°で入力してください");return;
    }
    const g=obj.geometry,cx=g.x+g.width/2,cy=g.y+g.height/2;
    g.width=w/50*previewSpacing();g.height=h/50*previewSpacing();
    g.x=cx-g.width/2;g.y=cy-g.height/2;g.rotation=rotation;
   }
   if(["door","window"].includes(obj.objectType)){
    const cm=Number($("template-opening-width").value);
    if(!Number.isFinite(cm)||cm<25||cm>500){editPast.pop();setEditMessage("開口幅は25〜500cmで入力してください");return}
    const ps=obj.geometry.points,center=[(ps[0][0]+ps[1][0])/2,(ps[0][1]+ps[1][1])/2];
    if(!placeOpening(scene,obj,center,cm/50*previewSpacing(),true)){
     editPast.pop();setEditMessage("開口幅に合う壁が近くにありません");return
    }
   }
   if(obj.objectType==="wall"){
    const cm=Number($("template-wall-thickness").value);
    if(!Number.isFinite(cm)||cm<1||cm>300){editPast.pop();setEditMessage("壁の厚さは1〜300cmで入力してください");return}
    obj.wall={...obj.wall,thickness:cm/50*previewSpacing()};
   }
   if(obj.label)obj.label.text=obj.name;
  }
  if(remove)for(const door of scene.objects)if(["door","window"].includes(door.objectType)&&door.opening?.wallId===selected.id){delete door.opening.wallId}
  updateScene(scene,remove?"preview_root":selected.id);
  setEditMessage(remove?"設置物を削除しました":"名前と説明を変更しました");
 }
 // Geometry helpers: metres use 1 cell = 0.5m, independent of map coordinate spacing.
 const EPS=1e-7;
 const length2=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 function polygonOfRect(g){
  const x=g.x,y=g.y,w=g.width,h=g.height,cx=x+w/2,cy=y+h/2,
   rad=(Number(g.rotation)||0)*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);
  return [[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([px,py])=>
   [cx+(px-cx)*c-(py-cy)*s,cy+(px-cx)*s+(py-cy)*c]);
 }
 function thickSegment(a,b,width){
  const len=length2(a,b),half=width/2;if(len<EPS)return null;
  const nx=-(b[1]-a[1])/len*half,ny=(b[0]-a[0])/len*half;
  return [[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]];
 }
 function polygonsIntersect(a,b){
  for(const poly of [a,b])for(let i=0;i<poly.length;i++){
   const p=poly[i],q=poly[(i+1)%poly.length],nx=q[1]-p[1],ny=p[0]-q[0];
   const proj=points=>points.map(v=>v[0]*nx+v[1]*ny);
   const ap=proj(a),bp=proj(b);
   if(Math.max(...ap)<=Math.min(...bp)+EPS||Math.max(...bp)<=Math.min(...ap)+EPS)return false;
  }
  return true;
 }
 function checkFixtureCollisions(scene,floorId=null){
  const errors=[],objects=scene?.objects||[];
  const fixtures=objects.filter(o=>["object","stair"].includes(o.objectType)&&o.geometry?.type==="rect"&&(!floorId||o.floorId===floorId));
  const walls=objects.filter(o=>o.objectType==="wall"&&o.geometry?.type==="polyline");
  const openings=objects.filter(o=>["door","window"].includes(o.objectType)&&o.geometry?.type==="polyline");
  // Two openings may not occupy the same portion of a linked wall.
  for(let i=0;i<openings.length;i++)for(let j=i+1;j<openings.length;j++){
   const a=openings[i],b=openings[j];
   if(!a.opening?.wallId||a.opening.wallId!==b.opening?.wallId||a.floorId!==b.floorId||(!floorId?false:a.floorId!==floorId))continue;
   const [p,q]=a.geometry.points, [u,v]=b.geometry.points;
   if(!p||!q||!u||!v)continue;
   const dx=q[0]-p[0],dy=q[1]-p[1],len=Math.hypot(dx,dy);
   if(len<EPS)continue;
   const cross=pt=>Math.abs((pt[0]-p[0])*dy-(pt[1]-p[1])*dx)/len;
   if(cross(u)>EPS||cross(v)>EPS)continue;
   const project=pt=>((pt[0]-p[0])*dx+(pt[1]-p[1])*dy)/len;
   if(Math.min(len,Math.max(project(u),project(v)))-Math.max(0,Math.min(project(u),project(v)))>EPS)
    errors.push({a:a.id,b:b.id,message:a.name+"と"+b.name+"の開口が重複"});
  }
  for(const fixture of fixtures){
   const fp=polygonOfRect(fixture.geometry);
   for(const wall of [...walls,...openings]){
    if(wall.floorId!==fixture.floorId)continue;
    const halfWidth=wall.objectType==="wall"?(wall.wall?.thickness||0.04):Math.max(.04,(scene.settings?.editorGrid?.spacing||2)*.035);
    const points=wall.geometry.points||[];
    for(let i=1;i<points.length;i++){
     const poly=thickSegment(points[i-1],points[i],halfWidth);
     if(poly&&polygonsIntersect(fp,poly)){errors.push({a:fixture.id,b:wall.id,message:fixture.name+"と"+wall.name+"が干渉"});break}
    }
   }
   for(const other of fixtures)if(fixture.id<other.id&&fixture.floorId===other.floorId&&
     polygonsIntersect(fp,polygonOfRect(other.geometry)))
    errors.push({a:fixture.id,b:other.id,message:fixture.name+"と"+other.name+"が重複"});
  }
  return errors;
 }
 function updateCollisionStatus(scene){
  if(!scene)return;
  const errors=checkFixtureCollisions(scene,activeFloor);
  const node=$("template-collision-status");
  node.dataset.hasCollision=String(errors.length>0);
  $("template-preview-large").dataset.collision=String(errors.length>0&&editing);
  node.textContent=errors.length?"干渉 "+errors.length+"件："+errors.slice(0,2).map(e=>e.message).join("、")+
   (errors.length>2?" ほか"+(errors.length-2)+"件":""):"干渉チェック：問題なし";
 }
 function chooseWall(scene,center,floor,width,strict=false){
  let best=null;
  for(const wall of scene.objects){
   if(wall.objectType!=="wall"||wall.floorId!==floor||wall.geometry?.type!=="polyline")continue;
   const points=wall.geometry.points;
   for(let i=1;i<points.length;i++){
    const [a,b]=[points[i-1],points[i]],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
    if(len<width+EPS)continue;
    const dot=((center[0]-a[0])*dx+(center[1]-a[1])*dy)/(len*len);
    const t=Math.max(width/(2*len),Math.min(1-width/(2*len),dot));
    const mx=a[0]+dx*t,my=a[1]+dy*t,dist=Math.hypot(mx-center[0],my-center[1]);
    if(!best||dist<best.dist)best={wall,a,b,dx,dy,len,mid:[mx,my],dist};
   }
  }
  if(strict&&best&&best.dist>previewSpacing()*2)return null;
  return best;
 }
 function placeOpening(scene,obj,position,width,strict=false){
  const found=chooseWall(scene,position,obj.floorId,width,strict);
  if(!found)return false;
  const ux=found.dx/found.len,uy=found.dy/found.len;
  obj.geometry={type:"polyline",points:[
   [found.mid[0]-ux*width/2,found.mid[1]-uy*width/2],
   [found.mid[0]+ux*width/2,found.mid[1]+uy*width/2]]};
  obj.opening={...obj.opening,wallId:found.wall.id,kind:obj.objectType==="window"?"window":"interior",width,external:false};
  return true;
 }
 function linkSelectedOpening(fromMove=false){
  const selected=previewViewer?.getSelected();
  if(!editing||!selected||!["door","window"].includes(selected.objectType))return false;
  const scene=previewViewer.getScene(),obj=scene.objects.find(o=>o.id===selected.id);
  const points=obj.geometry?.points||[],center=points.length>=2?
   [(points[0][0]+points[1][0])/2,(points[0][1]+points[1][1])/2]:[0,0];
  const width=length2(points[0]||center,points[1]||center);
  const before=JSON.stringify(obj);
  if(!placeOpening(scene,obj,center,width,true)){
   if(fromMove&&obj.opening?.wallId){
    delete obj.opening.wallId;
    updateScene(scene,obj.id);
    setEditMessage("壁から離れたため、開口の関連付けを解除しました");
   }else if(!fromMove)setEditMessage("壁が近くに見つかりません。扉・窓を壁のそばへ移動してください");
   return false;
  }
  if(before===JSON.stringify(obj))return true;
  if(!fromMove)snapshot();
  updateScene(scene,obj.id);
  setEditMessage("壁と開口部を関連付けました");
  return true;
 }
 function roomArea(scene,room){
  const g=room.geometry,spacing=previewSpacing(),walls=scene.objects.filter(o=>o.objectType==="wall"&&o.floorId===room.floorId&&o.geometry?.type==="polyline");
  const insets=[0,0,0,0],sides=[
   {axis:0,at:g.x,min:g.y,max:g.y+g.height},
   {axis:0,at:g.x+g.width,min:g.y,max:g.y+g.height},
   {axis:1,at:g.y,min:g.x,max:g.x+g.width},
   {axis:1,at:g.y+g.height,min:g.x,max:g.x+g.width}];
  sides.forEach((side,index)=>{
   for(const wall of walls){
    const half=(wall.wall?.thickness||0)/2,p=wall.geometry.points;
    for(let i=1;i<p.length;i++){
     const a=p[i-1],b=p[i],coord=side.axis===0?0:1,parallel=side.axis===0?1:0;
     if(Math.abs(a[coord]-b[coord])>EPS||Math.abs(a[coord]-side.at)>EPS)continue;
     const cover=Math.min(side.max,Math.max(a[parallel],b[parallel]))-Math.max(side.min,Math.min(a[parallel],b[parallel]));
     if(cover>EPS)insets[index]=Math.max(insets[index],half);
    }
   }
  });
  const usableWidth=Math.max(0,g.width-insets[0]-insets[1]);
  const usableHeight=Math.max(0,g.height-insets[2]-insets[3]);
  return{gross:g.width*g.height/(spacing*spacing)*.25,
   net:usableWidth*usableHeight/(spacing*spacing)*.25};
 }
 function updateAreaStatus(scene){
  if(!scene)return;
  const rooms=scene.objects.filter(o=>o.objectType==="region"&&o.geometry?.type==="rect"&&o.floorId===activeFloor);
  const summary=$("template-area-status");
  if(rooms.length){
   const totals=rooms.map(r=>roomArea(scene,r));
   const net=totals.reduce((a,r)=>a+r.net,0),gross=totals.reduce((a,r)=>a+r.gross,0);
   summary.textContent="室内面積（概算）："+net.toFixed(1)+"㎡（区画外形 "+gross.toFixed(1)+"㎡、"+rooms.length+"室）";
   const selected=previewViewer?.getSelected();
   if(selected?.objectType==="region"&&selected.geometry?.type==="rect"){
    const m=roomArea(scene,selected);
    summary.textContent+=" / 選択中「"+selected.name+"」："+m.net.toFixed(1)+"㎡";
   }
  }else{
   const root=scene.objects.find(o=>o.id==="preview_root"),g=root?.geometry;
   summary.textContent=g?.type==="rect"?"建物外形："+(g.width*g.height/previewSpacing()**2*.25).toFixed(1)+"㎡（部屋区画がないため内法未計算）":"有効面積：未計算";
  }
 }
 function refreshChecks(scene){
  updateCollisionStatus(scene);updateAreaStatus(scene);
 }
 function saveCopy(){
  if(!editing)return;
  const name=$("template-save-name").value.trim(),id=$("template-save-id").value.trim();
  try{
   const scene=previewViewer.getScene();
   const collisions=checkFixtureCollisions(scene);
   if(collisions.length)throw Error("設備の貫通・重複を修正してください："+collisions.slice(0,3).map(e=>e.message).join("、")+(collisions.length>3?" ほか"+(collisions.length-3)+"件":""));
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
   const setSidebarCollapsed=collapsed=>{
    const layout=$("template-preview-picker").parentElement;
    layout.dataset.pickerCollapsed=String(collapsed);
    const toggle=$("template-sidebar-toggle");
    toggle.textContent=collapsed?"一覧を表示 ▶":"一覧を隠す ◀";
    toggle.setAttribute("aria-expanded",String(!collapsed));
    toggle.title=collapsed?"絞り込みサイドバーを表示":"絞り込みサイドバーを最小化";
    $("template-sidebar-edge").hidden=!collapsed;
    if(typeof previewViewer!=="undefined"&&previewViewer?.redraw)previewViewer.redraw();
   };
   $("template-sidebar-toggle").addEventListener("click",()=>setSidebarCollapsed($("template-preview-picker").parentElement.dataset.pickerCollapsed!=="true"));
   $("template-sidebar-edge").addEventListener("click",()=>setSidebarCollapsed(false));
   $("template-preview-open").addEventListener("click",open);
   $("template-preview-filter").addEventListener("input",()=>{refresh();writeSavedPreview()});
   $("template-era-filter").addEventListener("change",()=>{refresh();writeSavedPreview()});
   $("template-use-filter").addEventListener("change",()=>{refresh();writeSavedPreview()});
   $("template-mode-toggle").addEventListener("click",()=>setMode(!editing));
   $("template-detail-settings-tab").addEventListener("click",()=>setDetailTab("settings"));
   $("template-detail-description-tab").addEventListener("click",()=>setDetailTab("description"));
   fillOptions($("template-item-category"),Object.keys(palette()).map(name=>[name,name]));
   updateCatalog();
   $("template-item-category").addEventListener("change",updateCatalog);
   $("template-item-choice").addEventListener("change",refreshItemList);
   $("template-item-add").addEventListener("click",addItem);
   $("template-item-apply").addEventListener("click",()=>changeSelected(false));
   $("template-item-delete").addEventListener("click",()=>changeSelected(true));
   $("template-opening-link").addEventListener("click",()=>linkSelectedOpening());
   $("template-undo").addEventListener("click",()=>setHistory(editPast,editFuture));
   $("template-redo").addEventListener("click",()=>setHistory(editFuture,editPast));
   $("template-save-copy").addEventListener("click",saveCopy);
   $("template-preview-floor").addEventListener("change",e=>{activeFloor=e.target.value;drawModal();writeSavedPreview()});
   $("template-preview-grid").addEventListener("change",()=>{if(activeId)drawModal();writeSavedPreview()});
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
  const saved=readSavedPreview();
  restoreSavedPreviewFields(saved);
  refresh();
  // Restore the modal only when it was open at reload; a deliberately closed
  // preview must stay closed. Never restore unsaved template edits.
  if(saved?.open&&saved.id&&library.allPresets().some(t=>t.id===saved.id)){
   setTimeout(()=>{if($("template-preview-modal").hidden)open()},0);
  }
 }
 global.AAMapTemplatePreview={init,refresh,renderPlan};
})(window);
