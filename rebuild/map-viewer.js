/* New AA map renderer (read-only). All positions are read directly from layout JSON. */
(function (global) {
"use strict";
const TYPES={
 terminal:{fill:"#346e87",line:"#98e5fc"},
 town:{fill:"#587789",line:"#a6dcf2"},
 workshop:{fill:"#776879",line:"#d5b4eb"},
 guild:{fill:"#817253",line:"#ead59a"},
 nature:{fill:"#356956",line:"#9dd7ad"},
 industrial:{fill:"#70634c",line:"#e8bc7e"},
 shared:{fill:"#42687a",line:"#b0e8f7"}
};
const DISTRICT_COLORS={
 "core_shell_town":{fill:"rgba(52,148,192,.39)",line:"#8eeaff"},
 "refine_valley":{fill:"rgba(135,98,187,.36)",line:"#dcc1ff"},
 "stern_core_shell_town":{fill:"rgba(178,130,66,.38)",line:"#ffd18c"},
 "stern_refine_lab_district":{fill:"rgba(162,102,119,.37)",line:"#f6b9bd"},
 "arbora_sector":{fill:"rgba(61,140,102,.25)",line:"#73c99c"}
};
const ROAD_COLORS={
 "コンコース":"#e6cd99",
 "freight_authorized":"#a8c2dd",
 "hazard_authorized":"#ef9a72",
 "bio_authorized":"#85dbc0",
 "draft_parallel_freight_B":"#e4ac6a"
};
const shipProfile=[[0,.39],[.035,.63],[.12,.83],[.22,.94],[.40,1],[.68,.99],[.82,.97],[.94,.91],[1,.81]];
const q=id=>document.getElementById(id);
function hullWidth(t){
 for(let i=1;i<shipProfile.length;i++)if(t<=shipProfile[i][0]){
  const a=shipProfile[i-1],b=shipProfile[i],f=(t-a[0])/(b[0]-a[0]);
  return a[1]+f*(b[1]-a[1]);
 }
 return .81;
}
function shapeVertices(f){
 if(Array.isArray(f.footprint)&&f.footprint.length>=3)
  return f.footprint.map(([dx,dy])=>[f.x+dx,f.y+dy]);
 return [[f.x-f.w/2,f.y-f.h/2],[f.x+f.w/2,f.y-f.h/2],[f.x+f.w/2,f.y+f.h/2],[f.x-f.w/2,f.y+f.h/2]];
}
function insidePolygon(points,x,y){
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];
  if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
function contains(f,x,y){
 if(f.ringDistrict){
  const d=Math.hypot(x-f.x,y-f.y);
  return d>=(f.innerRadius||0)&&d<=(f.outerRadius||0);
 }
 if(f.type==="terminal"&&f.id==="middle_terminal")return Math.hypot(x-f.x,y-f.y)<=250;
 return shapeVertices(f).length>=3&&insidePolygon(shapeVertices(f),x,y);
}
function roadColor(r){
 return ROAD_COLORS[r.geometryStatus]||ROAD_COLORS[r.access]||ROAD_COLORS[r.roadType]||r.color||"#a8b5bd";
}
function nearestSegmentDistance(p,a,b){
 const vx=b[0]-a[0],vy=b[1]-a[1],l=vx*vx+vy*vy||1;
 const t=Math.max(0,Math.min(1,((p[0]-a[0])*vx+(p[1]-a[1])*vy)/l));
 return Math.hypot(p[0]-(a[0]+vx*t),p[1]-(a[1]+vy*t));
}
function create(opts){
 const host=opts.host,canvas=opts.canvas,ctx=canvas.getContext("2d");
 const info=opts.info,infoTitle=opts.infoTitle,infoText=opts.infoText,infoMeta=opts.infoMeta;
 const legend=opts.legend,legendContent=opts.legendContent,legendButton=opts.legendButton;
 const hint=opts.hint,zoomLabel=opts.zoomLabel;
 const cache=new Map(),pointers=new Map();
 let floor=null,data=null,selected=null,projection="top",token=0;
 let width=1,height=1,dpr=1,zoom=1,offsetX=0,offsetY=0;
 let legendOn=false,gestureMoved=false,downAt=null,lastPinch=null;
 try{legendOn=localStorage.getItem("aa-map-new-legend")==="true"}catch(_){}
 function isMiddle(){return floor==="middle"&&data}
 function setLegend(on){
  legendOn=Boolean(on);legend.hidden=!legendOn;
  legendButton.setAttribute("aria-pressed",String(legendOn));
  legendButton.textContent="色の凡例："+(legendOn?"ON":"OFF");
  try{localStorage.setItem("aa-map-new-legend",String(legendOn))}catch(_){}
 }
 legendButton.addEventListener("click",()=>setLegend(!legendOn));
 setLegend(legendOn);
 function setHint(s){hint.textContent=s||""}
 function baseScale(){return Math.min((width-34)/2500,(height-30)/4000)}
 function scale(){return baseScale()*zoom}
 function worldToScreen(x,y){
  const s=scale();return [width/2+offsetX+y*s,height/2+offsetY-x*s];
 }
 function screenToWorld(px,py){
  const s=scale();return [(height/2+offsetY-py)/s,(px-width/2-offsetX)/s];
 }
 function reset(){
  zoom=1;offsetX=0;offsetY=0;draw();
 }
 function zoomAt(factor,x,y){
  const before=screenToWorld(x,y);
  zoom=Math.max(1,Math.min(18,zoom*factor));
  const pos=worldToScreen(...before);
  offsetX+=x-pos[0];offsetY+=y-pos[1];
  draw();
 }
 function getSelectionPath(){
  if(!data||!selected)return {district:null,medium:null};
  const districts=data.facilities.filter(f=>Array.isArray(f.mediumZones)&&f.mediumZones.length);
  const district=districts.find(f=>f.id===selected.id||
   f.mediumZones.some(m=>m.id===selected.id||(m.smallZones||[]).some(s=>s.id===selected.id)));
  const medium=district?.mediumZones.find(m=>m.id===selected.id||
   (m.smallZones||[]).some(s=>s.id===selected.id))||null;
  return {district:district||null,medium};
 }
 function hullPath(inset){
  const half0=1215;ctx.beginPath();
  const samples=100;for(let i=0;i<=samples;i++){
   const t=i/samples,x=2000-4000*t,y=-Math.max(10,half0*hullWidth(t)-inset);
   if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  for(let i=samples;i>=0;i--){
   const t=i/samples,x=2000-4000*t,y=Math.max(10,half0*hullWidth(t)-inset);
   ctx.lineTo(x,y);
  }ctx.closePath();
 }
 function polygon(f){
  ctx.beginPath();for(const [i,p] of shapeVertices(f).entries()){
   if(i===0)ctx.moveTo(...p);else ctx.lineTo(...p);
  }ctx.closePath();
 }
 function drawHull(){
  for(const [inset,color] of [[0,"#667484"],[45,"#223d50"],[195,"#52514b"],[340,"#1b343c"]]){
   hullPath(inset);ctx.fillStyle=color;ctx.fill();
  }
  for(const [inset,color,pixels] of [[0,"#a7bac5",2.5],[45,"#a5c9e2",1.2],[195,"#74cce8",1.1],[340,"#ffda94",1.2]]){
   hullPath(inset);ctx.strokeStyle=color;ctx.lineWidth=pixels/scale();ctx.stroke();
  }
 }
 function drawGrid(){
  ctx.save();ctx.strokeStyle="rgba(162,204,211,.11)";
  ctx.lineWidth=.65/scale();
  ctx.beginPath();for(let x=-2000;x<=2000;x+=100){ctx.moveTo(x,-1250);ctx.lineTo(x,1250)}
  for(let y=-1200;y<=1200;y+=100){ctx.moveTo(-2000,y);ctx.lineTo(2000,y)}
  ctx.stroke();ctx.restore();
 }
 function drawDistrict(f){
  const palette=DISTRICT_COLORS[f.id]||TYPES[f.type]||TYPES.town;
  ctx.save();polygon(f);ctx.fillStyle=palette.fill;ctx.fill();
  ctx.strokeStyle=selected?.id===f.id?"#fff2a6":palette.line;
  ctx.lineWidth=(selected?.id===f.id?3.2:2)/scale();
  ctx.setLineDash(selected?.id===f.id?[]:[7/scale(),4/scale()]);
  ctx.stroke();ctx.restore();
 }
 function drawRing(f){
  ctx.save();
  const {x,y,outerRadius:o,innerRadius:i}=f;
  ctx.beginPath();ctx.arc(x,y,o,0,2*Math.PI);ctx.arc(x,y,i,0,2*Math.PI,true);
  ctx.fillStyle="rgba(64,136,100,.20)";ctx.fill("evenodd");
  ctx.strokeStyle=selected?.id===f.id?"#ffef9b":"#8ccf9f";ctx.lineWidth=2/scale();
  for(const r of [o,i]){ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.stroke()}
  ctx.restore();
 }
 function drawFacility(f,alpha=1){
  const t=TYPES[f.type]||TYPES.shared;
  ctx.save();ctx.globalAlpha=alpha;
  polygon(f);ctx.fillStyle=t.fill;ctx.fill();
  ctx.strokeStyle=selected?.id===f.id?"#fff2a6":t.line;
  ctx.lineWidth=(selected?.id===f.id?3:1.7)/scale();ctx.stroke();
  ctx.restore();
 }
 function drawZone(z){
  ctx.save();polygon(z);ctx.fillStyle="rgba(125,198,160,.13)";ctx.fill();
  ctx.strokeStyle=selected?.id===z.id?"#fff2a6":"#a8daba";
  ctx.lineWidth=1.35/scale();ctx.setLineDash([5/scale(),5/scale()]);ctx.stroke();ctx.restore();
 }
 function drawMedium(f){
  ctx.save();polygon(f);ctx.fillStyle="rgba(225,233,237,.07)";ctx.fill();
  ctx.strokeStyle="#cfdae0";ctx.lineWidth=1.25/scale();
  ctx.setLineDash([5/scale(),4/scale()]);ctx.stroke();ctx.restore();
 }
 function drawSmall(f){
  ctx.save();polygon(f);ctx.fillStyle=selected?.id===f.id?"rgba(255,236,172,.28)":"rgba(240,241,224,.12)";
  ctx.fill();ctx.strokeStyle=selected?.id===f.id?"#ffefa7":"#d6d9ce";
  ctx.lineWidth=1.5/scale();ctx.stroke();ctx.restore();
 }
 function drawRoad(r){
  if(r.kind==="internal")return;
  ctx.save();ctx.lineCap="round";ctx.lineJoin="round";
  ctx.strokeStyle=selected?.id===r.id?"#fff1a5":roadColor(r);
  ctx.lineWidth=(selected?.id===r.id?3.5:1.7)/scale();
  ctx.setLineDash(r.status?.startsWith("draft")?[6/scale(),5/scale()]:[]);
  if(r.kind==="ring"){ctx.beginPath();ctx.arc(0,0,r.r,0,2*Math.PI);ctx.stroke()}
  if(r.kind==="line"&&r.points?.length>=2){
   ctx.beginPath();r.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
  }
  ctx.restore();
 }
 function drawTerminal(){
  const t=data?.facilities.find(f=>f.id==="middle_terminal");if(!t)return;
  ctx.save();ctx.beginPath();ctx.arc(t.x,t.y,250,0,2*Math.PI);
  ctx.fillStyle="#346e87";ctx.fill();ctx.strokeStyle=selected?.id===t.id?"#fff2a6":"#98e5fc";
  ctx.lineWidth=2.5/scale();ctx.stroke();ctx.restore();
 }
 function drawLabels(){
  if(!data)return;
  ctx.save();ctx.textAlign="center";ctx.textBaseline="middle";
  const label=(txt,x,y,maxWidth,emphasis=false)=>{
   if(!txt)return;const [px,py]=worldToScreen(x,y);
   const font=Math.max(10,Math.min(15,11.5+Math.log2(zoom)*1.35));
   ctx.font="700 "+font+"px system-ui";ctx.lineWidth=3.3;
   ctx.strokeStyle="rgba(10,24,34,.93)";ctx.strokeText(txt,px,py,maxWidth);
   ctx.fillStyle=emphasis?"#fff1ad":"#edf4f1";ctx.fillText(txt,px,py,maxWidth);
  };
  const {district,medium}=getSelectionPath();
  for(const f of data.facilities.filter(f=>f.mediumZones?.length)){
   if(district?.id===f.id)continue;
   const p=f.mapLabelPosition||[f.x,f.y];
   label(f.districtMapLabel||f.short||f.name,p[0],p[1],Math.max(60,235*scale()),false);
  }
  if(district){
   if(medium){
    for(const small of medium.smallZones||[])label(small.name,small.x,small.y,Math.max(50,130*scale()),small.id===selected?.id);
   }else for(const zone of district.mediumZones||[])
    label(zone.name,zone.x,zone.y,Math.max(50,175*scale()),selected?.id===zone.id);
  }
  if(selected&&(!selected.districtMapLabel)&&selected.id!=="middle_terminal"&&!medium?.smallZones?.some(s=>s.id===selected.id)){
   label(selected.name,selected.x,selected.y-60,180,true);
  }
  ctx.restore();
 }
 function drawWorld(){
  const s=scale();
  ctx.setTransform(0,-dpr*s,dpr*s,0,dpr*(width/2+offsetX),dpr*(height/2+offsetY));
  drawHull();drawGrid();
  if(!data)return;
  for(const f of data.facilities.filter(f=>f.ringDistrict))drawRing(f);
  for(const f of data.facilities.filter(f=>f.zoneOutline&&!f.ringDistrict))drawDistrict(f);
  for(const r of data.roads)drawRoad(r);
  for(const f of data.facilities.filter(f=>!f.zoneOutline&&!f.ringDistrict&&f.type!=="terminal")){
   const arboraChildren=["ecosystem_greenhouses","water_soil_cycle","biological_management","bio_material_greenhouse"];
   if(arboraChildren.includes(f.id)&&selected?.id!=="arbora_sector"&&
     selected?.id!==f.id&&!data.facilities.find(d=>d.id==="arbora_sector")?.macroZones?.some(z=>z.id===selected?.id))continue;
   drawFacility(f);
  }
  const {district,medium}=getSelectionPath();
  for(const d of data.facilities.filter(f=>f.mediumZones?.length)){
   for(const m of d.mediumZones)if(m.id!==medium?.id)drawMedium(m);
  }
  if(medium)for(const item of medium.smallZones||[])drawSmall(item);
  if(selected?.id==="arbora_sector"||data.facilities.find(f=>f.id==="arbora_sector")?.macroZones?.some(z=>z.id===selected?.id))
   for(const z of data.facilities.find(f=>f.id==="arbora_sector")?.macroZones||[])drawZone(z);
  drawTerminal();
 }
 function draw(){
  if(!width||!height)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle="#0b1d27";ctx.fillRect(0,0,width,height);
  drawWorld();
  ctx.setTransform(dpr,0,0,dpr,0,0);
  drawLabels();
  zoomLabel.textContent=Math.round(zoom*100)+"%";
 }
 function pickAt(px,py){
  if(!data)return null;
  const [x,y]=screenToWorld(px,py),world=[x,y],tol=11/scale();
  const {district,medium}=getSelectionPath();
  if(medium)for(const s of medium.smallZones||[])if(contains(s,x,y))return s;
  if(district)for(const m of district.mediumZones||[])if(contains(m,x,y))return m;
  if(selected?.id==="arbora_sector"||data.facilities.find(f=>f.id==="arbora_sector")?.macroZones?.some(z=>z.id===selected?.id)){
   const macro=data.facilities.find(f=>f.id==="arbora_sector")?.macroZones||[];
   for(const z of macro)if(contains(z,x,y))return z;
  }
  // Roads need a click tolerance even though they are intentionally drawn as thin lines.
  for(const r of [...data.roads].reverse()){
   if(r.kind==="ring"&&Math.abs(Math.hypot(x,y)-r.r)<tol)return r;
   if(r.kind==="line"&&(r.points||[]).some((p,i,a)=>i&&nearestSegmentDistance(world,a[i-1],p)<tol))return r;
  }
  for(const f of [...data.facilities].reverse())if(!f.zoneOutline&&!f.ringDistrict&&contains(f,x,y))return f;
  for(const f of [...data.facilities].reverse())if(f.zoneOutline&&contains(f,x,y))return f;
  for(const f of data.facilities.filter(f=>f.ringDistrict))if(contains(f,x,y))return f;
  return null;
 }
 function showDetails(item){
  selected=item||null;
  info.hidden=!selected;
  if(!selected){draw();return}
  infoTitle.textContent=selected.name||selected.id;
  const parts=[];
  if(selected.roadType)parts.push(selected.roadType);
  if(selected.status?.startsWith("draft")||selected.draft===true||selected.reviewStatus==="draft")
   parts.push("配置・接続未確定");
  if(selected.w&&selected.h)parts.push(Math.round(selected.w)+"×"+Math.round(selected.h)+"m");
  infoMeta.textContent=parts.join(" ｜ ")||"選択した区画";
  infoText.textContent=selected.detail||selected.draftNote||"説明は現在の配置JSONに登録されていません。";
  draw();
 }
 opts.infoClose.addEventListener("click",()=>showDetails(null));
 function renderLegend(){
  legendContent.replaceChildren();
  if(!data){legendContent.textContent="中層の配置データを読み込むと道路・区画の凡例を表示します。";return}
  const section=(name,entries)=>{
   const box=document.createElement("div");box.className="legend-section";
   const title=document.createElement("strong");title.textContent=name;box.append(title);
   const list=document.createElement("div");list.className="legend-items";
   for(const e of entries){
    const item=document.createElement("span");item.className="legend-item";
    const color=document.createElement("i");color.className=e.kind==="road"?"legend-line":"legend-swatch";color.style.backgroundColor=e.color;
    const label=document.createElement("span");label.textContent=e.name;
    item.append(color,label);list.append(item);
   }
   box.append(list);legendContent.append(box);
  };
  const districts=data.facilities.filter(f=>f.mediumZones?.length||f.id==="arbora_sector").map(f=>({
   name:f.districtMapLabel||f.short||f.name,
   color:(DISTRICT_COLORS[f.id]||TYPES[f.type]).line,kind:"district"
  }));
  const byType=new Map();
  for(const r of data.roads){
   if(r.kind==="internal")continue;
   const key=r.roadType+"|"+roadColor(r);
   if(!byType.has(key))byType.set(key,{name:r.roadType,color:roadColor(r),kind:"road"});
  }
  section("区画",districts);section("道路・通路",[...byType.values()]);
  const footnote=document.createElement("small");footnote.className="legend-note";
  footnote.textContent="道路の破線＝接続未確定／同じ位置でも通行可能とは限りません。";
  legendContent.append(footnote);
 }
 async function show(mapId,viewId,source){
  const next=floor===mapId&&projection===viewId&&
    (data?.floor===mapId||!source);
  if(next)return;
  floor=mapId;projection=viewId||"top";data=null;selected=null;info.hidden=true;reset();
  const myToken=++token;
  if(!source){setHint(projection==="side"?"船体側面の詳細描画は次の段階で追加します。":"船体全域の上面表示（外殻幅は現行図面の仮案）。");renderLegend();return}
  setHint("配置データを読み込み中…");
  try{
   let loaded=cache.get(source);
   if(!loaded){
    const response=await fetch(source,{cache:"no-store"});
    if(!response.ok)throw new Error("HTTP "+response.status);
    loaded=await response.json();
    if(!Array.isArray(loaded.facilities)||!Array.isArray(loaded.roads))throw new Error("施設・道路データの形式が不正");
    cache.set(source,loaded);
   }
   if(myToken!==token)return;
   data=loaded;renderLegend();draw();
   setHint((data.floor==="middle"?"中層":"階層")+"／既存配置を読み取り専用で表示 ・ 道路接続は仮");
  }catch(e){
   if(myToken!==token)return;
   setHint("マップ読み込みエラー："+e.message);renderLegend();draw();
  }
 }
 function resize(){
  const box=host.getBoundingClientRect();width=Math.max(1,box.width);height=Math.max(1,box.height);
  dpr=Math.min(2,global.devicePixelRatio||1);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  draw();
 }
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 function position(e){
  const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];
 }
 canvas.addEventListener("wheel",e=>{
  e.preventDefault();const [x,y]=position(e);zoomAt(e.deltaY<0?1.14:1/1.14,x,y);
 },{passive:false});
 canvas.addEventListener("pointerdown",e=>{
  canvas.setPointerCapture(e.pointerId);const [x,y]=position(e);
  pointers.set(e.pointerId,{x,y});gestureMoved=false;
  downAt={x,y};
  if(pointers.size===2){
   const p=[...pointers.values()],mx=(p[0].x+p[1].x)/2,my=(p[0].y+p[1].y)/2;
   lastPinch={mx,my,d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)||1};
  }
 });
 canvas.addEventListener("pointermove",e=>{
  if(!pointers.has(e.pointerId))return;
  const [x,y]=position(e),p=pointers.get(e.pointerId);
  if(Math.hypot(x-p.x,y-p.y)>1)gestureMoved=true;
  pointers.set(e.pointerId,{x,y});
  if(pointers.size===2){
   const v=[...pointers.values()],mx=(v[0].x+v[1].x)/2,my=(v[0].y+v[1].y)/2;
   const d=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y)||1;
   if(lastPinch){zoomAt(d/lastPinch.d,mx,my);offsetX+=mx-lastPinch.mx;offsetY+=my-lastPinch.my;draw()}
   lastPinch={mx,my,d};
  }else if(pointers.size===1){offsetX+=x-p.x;offsetY+=y-p.y;draw()}
 });
 function pointerEnd(e){
  if(!pointers.has(e.pointerId))return;
  const [x,y]=position(e);
  const clicked=pointers.size===1&&!gestureMoved&&downAt&&Math.hypot(x-downAt.x,y-downAt.y)<5;
  pointers.delete(e.pointerId);if(!pointers.size){lastPinch=null;downAt=null}
  if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  if(clicked)showDetails(pickAt(x,y));
 }
 canvas.addEventListener("pointerup",pointerEnd);canvas.addEventListener("pointercancel",pointerEnd);
 opts.zoomIn.addEventListener("click",()=>zoomAt(1.3,width/2,height/2));
 opts.zoomOut.addEventListener("click",()=>zoomAt(1/1.3,width/2,height/2));
 opts.zoomReset.addEventListener("click",reset);
 return {show,reset,legendEntries:()=>data?[...data.facilities.filter(f=>f.mediumZones?.length),...data.roads]:[]};
}
global.AAMapViewer={create,shapeVertices,insidePolygon,roadColor};
})(window);
