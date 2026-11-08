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
// District tint is the primary identifier; its hairline is NOT a solid wall.
const DISTRICT_COLORS={
 "core_shell_town":{fill:"rgba(52,148,192,.28)",line:"#8eeaff"},
 "refine_valley":{fill:"rgba(135,98,187,.27)",line:"#dcc1ff"},
 "stern_core_shell_town":{fill:"rgba(178,130,66,.28)",line:"#ffd18c"},
 "stern_refine_lab_district":{fill:"rgba(162,102,119,.27)",line:"#f6b9bd"},
 "arbora_sector":{fill:"rgba(61,140,102,.23)",line:"#73c99c"}
};
const ROAD_GRAY="#929da5";
// Only key transport routes appear on the first view. Other source routes remain intact.
const PRIMARY_ROAD_TYPES=new Set(["主要幹線道路","大型機用主要通路","重貨物道路","貨物トンネル"]);
const ROAD_DISPLAY_MODES=["main","all","off"];
const RENDER_REVISION="中層描画 v7";
// Display hierarchy only. No mutation of data/middle-layout-draft.json.
const DISPLAY_MEDIUM_CHILDREN=Object.freeze({
 arbora_sector:Object.freeze([
  "ecosystem_greenhouses","water_soil_cycle","biological_management","bio_material_greenhouse"
 ])
});
function primaryRoute(r){return PRIMARY_ROAD_TYPES.has(r.roadType)&&!String(r.geometryStatus||"").startsWith("stale")}
const TUNNEL_MARK="#d5dde0";
function isTunnel(r){return /トンネル|tunnel/i.test(r.roadType||"") || /tunnel/i.test(r.subtype||"")}
// Road widths remain in the source JSON. The overview draws only a fixed-width centerline.
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
 if(f.ringComplex){
  // This facility is an annular area inside the terminal, not a solid square.
  const cx=f.ringComplex.center?.[0]??f.x,cy=f.ringComplex.center?.[1]??f.y;
  const d=Math.hypot(x-cx,y-cy);
  return d>=f.ringComplex.innerRadius&&d<=f.ringComplex.outerRadius;
 }
 if(f.ringDistrict){
  const d=Math.hypot(x-f.x,y-f.y);
  return d>=(f.innerRadius||0)&&d<=(f.outerRadius||0);
 }
 if(f.type==="terminal"&&f.id==="middle_terminal")return Math.hypot(x-f.x,y-f.y)<=250;
 return shapeVertices(f).length>=3&&insidePolygon(shapeVertices(f),x,y);
}
function roadColor(r){return ROAD_GRAY}
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
 let legendOn=false,gestureMoved=false,downAt=null,lastPinch=null,roadMode="main";
 try{const saved=localStorage.getItem("aa-map-road-mode");if(ROAD_DISPLAY_MODES.includes(saved))roadMode=saved}catch(_){}
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
 function visibleRoads(){
  return !data||roadMode==="off"?[]:data.roads.filter(r=>r.kind!=="internal"&&(roadMode==="all"||primaryRoute(r)));
 }
 function roadIsVisible(r){return roadMode!=="off"&&(roadMode==="all"||primaryRoute(r))}
 function syncRoadButton(){
  if(!opts.roadButton)return;
  opts.roadButton.textContent="経路："+({main:"主要のみ",all:"全案を表示",off:"非表示"})[roadMode];
  opts.roadButton.setAttribute("aria-label","経路表示を切り替え。現在："+roadMode);
 }
 function setRoadMode(mode){
  if(!ROAD_DISPLAY_MODES.includes(mode))return;
  roadMode=mode;
  try{localStorage.setItem("aa-map-road-mode",mode)}catch(_){}
  if(selected?.roadType&&!roadIsVisible(selected)){selected=null;info.hidden=true}
  syncRoadButton();renderLegend();draw();setCurrentHint();
 }
 if(opts.roadButton)opts.roadButton.addEventListener("click",()=>{
  const next=ROAD_DISPLAY_MODES[(ROAD_DISPLAY_MODES.indexOf(roadMode)+1)%ROAD_DISPLAY_MODES.length];
  setRoadMode(next);
 });
 syncRoadButton();
 function setCurrentHint(){
  const n=visibleRoads().length;
  const label=data?(floor==="middle"?"中層":"階層")+"・配置検討案｜経路"+n+"/"+data.roads.length:"船体表示";
  hint.textContent=label+"｜"+RENDER_REVISION;
 }
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
 function presentationChildren(parentId){
  if(!data)return [];
  const ids=DISPLAY_MEDIUM_CHILDREN[parentId]||[];
  const byId=new Map(data.facilities.map(f=>[f.id,f]));
  return ids.map(id=>byId.get(id)).filter(Boolean);
 }
 function isArboraMedium(f){return Boolean(f&&DISPLAY_MEDIUM_CHILDREN.arbora_sector.includes(f.id))}
 function arboraParent(){return data?.facilities.find(f=>f.id==="arbora_sector")||null}
 // Displayed district sizes do not depend on click state. Clicks change detail only.
 function isArboraOpen(){return selected?.id==="arbora_sector"||isArboraMedium(selected)}
 function getSelectionPath(){
  if(!data||!selected)return {district:null,medium:null};
  const arbora=arboraParent();
  if(arbora&&isArboraOpen())return {district:arbora,medium:isArboraMedium(selected)?selected:null};
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
  ctx.lineWidth=(selected?.id===f.id?2.5:1.25)/scale();
  ctx.setLineDash([]);ctx.stroke();ctx.restore();
 }
 function drawRing(f){
  ctx.save();
  const {x,y,outerRadius:o,innerRadius:i}=f;
  ctx.beginPath();ctx.arc(x,y,o,0,2*Math.PI);ctx.arc(x,y,i,0,2*Math.PI,true);
  ctx.fillStyle="rgba(64,136,100,.15)";ctx.fill("evenodd");
  ctx.strokeStyle=selected?.id===f.id?"#ffef9b":"#8ccf9f";ctx.lineWidth=(selected?.id===f.id?2.5:1.25)/scale();
  for(const r of [o,i]){ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.stroke()}
  ctx.restore();
 }
 function drawFacility(f,alpha=1){
  const t=TYPES[f.type]||TYPES.shared;
  ctx.save();ctx.globalAlpha=alpha;
  ctx.strokeStyle=selected?.id===f.id?"#fff2a6":t.line;
  ctx.lineWidth=(selected?.id===f.id?2.5:1.2)/scale();
  if(f.ringComplex){
   // レジストリンク・ドーム: only the actual annular frame is shown.
   // Never fill the parent's 500x500m bounding rectangle or the ring interior.
   const ring=f.ringComplex,cx=ring.center?.[0]??f.x,cy=ring.center?.[1]??f.y;
   for(const radius of [ring.innerRadius,ring.outerRadius]){
    ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.stroke();
   }
  }else{
   polygon(f);
   if(!f.areaFrame){
    // Ordinary solid facilities keep their existing color; grouping frames do not.
    ctx.fillStyle=t.fill;ctx.fill();
   }
   ctx.stroke();
  }
  ctx.restore();
 }
 function drawZone(z){
  ctx.save();polygon(z);ctx.fillStyle="rgba(125,198,160,.15)";ctx.fill();
  ctx.strokeStyle=selected?.id===z.id?"#fff2a6":"#a8daba";
  ctx.lineWidth=(selected?.id===z.id?2.2:1)/scale();ctx.setLineDash([]);ctx.stroke();ctx.restore();
 }
 function drawArboraMedium(f){
  // Physical facilities are medium-level frames, not separate opaque buildings.
  ctx.save();polygon(f);
  ctx.fillStyle=selected?.id===f.id?"rgba(132,211,155,.23)":"rgba(132,211,155,.10)";
  ctx.fill();
  ctx.strokeStyle=selected?.id===f.id?"#fff2a6":"#9ed9ae";
  ctx.lineWidth=(selected?.id===f.id?2.2:1.15)/scale();
  ctx.setLineDash([]);ctx.stroke();ctx.restore();
 }
 function drawMedium(f){
  ctx.save();polygon(f);ctx.fillStyle="rgba(225,233,237,.07)";ctx.fill();
  ctx.strokeStyle="#c4d3db";ctx.lineWidth=1/scale();
  ctx.setLineDash([]);ctx.stroke();ctx.restore();
 }
 function drawSmall(f){
  ctx.save();polygon(f);ctx.fillStyle=selected?.id===f.id?"rgba(255,236,172,.28)":"rgba(240,241,224,.12)";
  ctx.fill();ctx.strokeStyle=selected?.id===f.id?"#ffefa7":"#d6d9ce";
  ctx.lineWidth=1/scale();ctx.stroke();ctx.restore();
 }
 function traceRoad(r){
  if(r.kind==="ring"){ctx.beginPath();ctx.arc(0,0,r.r,0,2*Math.PI);return true}
  if(r.kind==="line"&&r.points?.length>=2){
   ctx.beginPath();r.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));return true;
  }
  return false;
 }
 function tunnelHatching(r,pxWidth){
  if(!isTunnel(r)||r.kind!=="line"||!Array.isArray(r.points))return;
  ctx.save();ctx.strokeStyle=TUNNEL_MARK;ctx.lineWidth=.65/scale();ctx.setLineDash([]);
  const step=18/scale(),half=1.6/scale(),slant=.6/scale();
  for(let i=1;i<r.points.length;i++){
   const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
   if(len<step)continue;
   const ux=dx/len,uy=dy/len,nx=-uy,ny=ux;
   for(let d=step/2;d<len;d+=step){
    const x=a[0]+ux*d,y=a[1]+uy*d;
    ctx.beginPath();ctx.moveTo(x-nx*half-ux*slant,y-ny*half-uy*slant);
    ctx.lineTo(x+nx*half+ux*slant,y+ny*half+uy*slant);ctx.stroke();
   }
  }
  ctx.restore();
 }
 function drawRoad(r){
  if(r.kind==="internal")return;
  const pxWidth=selected?.id===r.id?2:1.1;
  ctx.save();ctx.lineCap="round";ctx.lineJoin="round";ctx.setLineDash([]);
  if(!traceRoad(r)){ctx.restore();return}
  // Thin gray centerline, regardless of road width data; no dark casing.
  // Tunnels add small sparse hatches without becoming thick bands.
  ctx.strokeStyle=selected?.id===r.id?"#fff0ac":ROAD_GRAY;
  ctx.globalAlpha=selected?.id===r.id?1:.84;
  ctx.lineWidth=pxWidth/scale();ctx.stroke();
  tunnelHatching(r,pxWidth);
  ctx.restore();
 }
 function drawTerminal(){
  const t=data?.facilities.find(f=>f.id==="middle_terminal");if(!t)return;
  // Transparent outer terminal frame; the 250m disc must not cover its inner guild.
  ctx.save();ctx.beginPath();ctx.arc(t.x,t.y,250,0,2*Math.PI);
  ctx.strokeStyle=selected?.id===t.id?"#fff2a6":"#98e5fc";
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
  for(const f of data.facilities.filter(f=>f.mediumZones?.length||f.id==="arbora_sector")){
   // The large district title must exist from the very first overview.
   // Use its own label placement rather than replacing it with children labels.
   if(f.id==="arbora_sector"){
    label(f.name,f.x-f.w*.44,f.y,Math.max(124,250*scale()),selected?.id===f.id);
    continue;
   }
   if(district?.id===f.id)continue;
   const p=f.mapLabelPosition||[f.x,f.y];
   label(f.districtMapLabel||f.short||f.name,p[0],p[1],Math.max(60,235*scale()),false);
  }
  if(isArboraOpen()){
   // One label per registered physical facility, no macroZone labels on top.
   for(const f of presentationChildren("arbora_sector")){
    label(f.name,f.x,f.y,Math.max(60,165*scale()),selected?.id===f.id);
   }
  }else if(district){
   if(medium){
    for(const small of medium.smallZones||[])label(small.name,small.x,small.y,Math.max(50,130*scale()),small.id===selected?.id);
   }else for(const zone of district.mediumZones||[])
    label(zone.name,zone.x,zone.y,Math.max(50,175*scale()),selected?.id===zone.id);
  }
  if(selected&&!isArboraOpen()&&(!selected.districtMapLabel)&&selected.id!=="middle_terminal"&&!medium?.smallZones?.some(s=>s.id===selected.id)){
   label(selected.name,selected.x,selected.y-60,180,true);
  }
  ctx.restore();
 }
 function drawSelectionOutline(){
  if(!selected||data?.roads.some(r=>r.id===selected.id))return;
  // The selected outline is drawn AFTER routes, so roads cannot hide it.
  ctx.save();ctx.strokeStyle="#fff2a6";ctx.lineWidth=2.4/scale();
  ctx.setLineDash([]);
  if(selected.ringComplex){
   const ring=selected.ringComplex,cx=ring.center?.[0]??selected.x,cy=ring.center?.[1]??selected.y;
   for(const radius of [ring.innerRadius,ring.outerRadius]){
    ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.stroke();
   }
  }else if(selected.ringDistrict){
   for(const r of [selected.innerRadius,selected.outerRadius]){
    ctx.beginPath();ctx.arc(selected.x,selected.y,r,0,Math.PI*2);ctx.stroke();
   }
  }else if(selected.id==="middle_terminal"){
   ctx.beginPath();ctx.arc(selected.x,selected.y,250,0,Math.PI*2);ctx.stroke();
  }else{
   polygon(selected);ctx.stroke();
  }
  ctx.restore();
 }
 // Painter order, from back to front. This is the single map layer priority.
 // Geographical boundaries are not walls. Roads are drawn over district tints,
 // but under solid structures and the terminal so they cannot cut across them.
 const WORLD_LAYER_ORDER=Object.freeze([
  "hull","grid","districts","roads","subzones","facilities","terminal","selection"
 ]);
 function drawWorld(){
  const s=scale();
  ctx.setTransform(0,-dpr*s,dpr*s,0,dpr*(width/2+offsetX),dpr*(height/2+offsetY));
  const passes={
   hull:drawHull,
   grid:drawGrid,
   districts:()=>{
    for(const f of data.facilities.filter(f=>f.ringDistrict))drawRing(f);
    for(const f of data.facilities.filter(f=>f.zoneOutline&&!f.ringDistrict))drawDistrict(f);
   },
   facilities:()=>{
    for(const f of data.facilities.filter(f=>!f.zoneOutline&&!f.ringDistrict&&f.type!=="terminal")){
     // Arbora's physical facilities are drawn exactly once in the medium pass.
     if(isArboraMedium(f))continue;
     drawFacility(f);
    }
   },
   subzones:()=>{
    const {medium}=getSelectionPath();
    for(const d of data.facilities.filter(f=>f.mediumZones?.length)){
     for(const m of d.mediumZones)if(m.id!==medium?.id)drawMedium(m);
    }
    if(medium)for(const item of medium.smallZones||[])drawSmall(item);
    // Arbora is always a large frame; its four registered physical facilities
    // are always medium frames, exactly like mediumZones in the other districts.
    // The six overlapping macro environment areas stay out of this drawing layer.
    for(const f of presentationChildren("arbora_sector"))drawArboraMedium(f);
   },
   terminal:drawTerminal,
   roads:()=>{for(const r of visibleRoads())drawRoad(r)},
   selection:drawSelectionOutline
  };
  // The outer hull must remain visible even when floor data has not loaded.
  if(!data){drawHull();drawGrid();return}
  for(const layer of WORLD_LAYER_ORDER)passes[layer]();
 }
 function draw(){
  if(!width||!height)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle="#0b1d27";ctx.fillRect(0,0,width,height);
  // The top hull profile is not the side elevation. Never pass it off as one.
  if(floor==="automaton_ship"&&projection==="side"){
   ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#a9c9d4";
   ctx.font="700 15px system-ui";
   ctx.fillText("船体側面図は次の工程で作成",width/2,height/2);
  }else{
   drawWorld();
   ctx.setTransform(dpr,0,0,dpr,0,0);
   drawLabels();
  }
  zoomLabel.textContent=Math.round(zoom*100)+"%";
 }
 function pickAt(px,py){
  if(!data)return null;
  const [x,y]=screenToWorld(px,py),world=[x,y],tol=11/scale();
  const {district,medium}=getSelectionPath();
  if(medium)for(const s of medium.smallZones||[])if(contains(s,x,y))return s;
  if(district)for(const m of district.mediumZones||[])if(contains(m,x,y))return m;
  // On an overview, first click anywhere inside Arbora (even on a child or road)
  // selects its large district. A second click can select a medium facility.
  const arbora=arboraParent();
  if(arbora&&!isArboraOpen()&&contains(arbora,x,y))return arbora;
  // The physical medium frames are visible from the start, but drill down only
  // once the large district has been selected. No hidden macro zones are pickable.
  if(isArboraOpen())for(const f of [...presentationChildren("arbora_sector")].reverse()){
   if(contains(f,x,y))return f;
  }
  // Roads need a click tolerance even though they are intentionally drawn as thin lines.
  for(const r of [...visibleRoads()].reverse()){
   if(r.kind==="ring"&&Math.abs(Math.hypot(x,y)-r.r)<tol)return r;
   if(r.kind==="line"&&(r.points||[]).some((p,i,a)=>i&&nearestSegmentDistance(world,a[i-1],p)<tol))return r;
  }
  for(const f of [...data.facilities].reverse())
   if(!f.zoneOutline&&!f.ringDistrict&&!isArboraMedium(f)&&contains(f,x,y))return f;
  for(const f of [...data.facilities].reverse())if(f.zoneOutline&&contains(f,x,y))return f;
  for(const f of data.facilities.filter(f=>f.ringDistrict))if(contains(f,x,y))return f;
  return null;
 }
 function showDetails(item){
  selected=item||null;
  info.hidden=!selected;
  if(typeof opts.onSelectionChanged==="function")opts.onSelectionChanged(floor,selected);
  if(!selected){draw();return}
  infoTitle.textContent=selected.name||selected.id;
  const parts=[];
  if(selected.roadType)parts.push(selected.roadType);
  if(selected.id==="arbora_sector")parts.push("大枠・自然環境地区／中枠4施設");
  if(isArboraMedium(selected))parts.push("中枠・施設");
  if(selected.status?.startsWith("draft")||selected.draft===true||selected.reviewStatus==="draft")
   parts.push("配置・接続未確定");
  if(selected.ringComplex)parts.push("環状施設｜内半径"+selected.ringComplex.innerRadius+"m・外半径"+selected.ringComplex.outerRadius+"m");
  else if(selected.w&&selected.h)parts.push(Math.round(selected.w)+"×"+Math.round(selected.h)+"m");
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
    const color=document.createElement("i");color.className=e.kind==="district"?"legend-swatch":e.kind==="tunnel"?"legend-line legend-tunnel":"legend-line";
    color.style.backgroundColor=e.color;
    const label=document.createElement("span");label.textContent=e.name;
    item.append(color,label);list.append(item);
   }
   box.append(list);legendContent.append(box);
  };
  const districts=data.facilities.filter(f=>f.mediumZones?.length||f.id==="arbora_sector").map(f=>({
   name:f.districtMapLabel||f.short||f.name,
   color:(DISTRICT_COLORS[f.id]||TYPES[f.type]).line,kind:"district"
  }));
  const roads=visibleRoads();
  const entries=[];
  if(roads.some(r=>!isTunnel(r)))entries.push({name:"道路・通路（灰色・実線）",color:ROAD_GRAY,kind:"road"});
  if(roads.some(isTunnel))entries.push({name:"トンネル（斜線入り）",color:ROAD_GRAY,kind:"tunnel"});
  section("区画",districts);section("経路",entries);
  const footnote=document.createElement("small");footnote.className="legend-note";
  footnote.textContent="道路は細い灰色の中心線。非表示の仮経路もJSONには保持しています。交差だけでは接続しません。";
  legendContent.append(footnote);
 }
 async function show(mapId,viewId,source){
  const next=floor===mapId&&projection===(viewId||"top")&&
    (data?.floor===mapId||!source);
  if(next)return;
  floor=mapId;projection=viewId||"top";data=null;selected=null;info.hidden=true;reset();
  if(typeof opts.onSelectionChanged==="function")opts.onSelectionChanged(mapId,null);
  const myToken=++token;
  if(!source){
   setHint(projection==="side"?"船体側面の詳細描画は次の段階で追加します。":"船体全域の上面表示（外殻幅は現行図面の仮案）。");
   renderLegend();
   if(typeof opts.onLayoutLoaded==="function")opts.onLayoutLoaded(mapId,null);
   return;
  }
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
   setCurrentHint();
   if(typeof opts.onLayoutLoaded==="function")opts.onLayoutLoaded(mapId,data);
  }catch(e){
   if(myToken!==token)return;
   setHint("マップ読み込みエラー："+e.message);renderLegend();draw();
   if(typeof opts.onLayoutError==="function")opts.onLayoutError(mapId,e.message);
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
 // Expose a read-only map > district > facility tree based on named relationships.
 function getHierarchy(){
  if(!data)return {large:[],unassigned:[]};
  const main=data.facilities.filter(f=>f.zoneOutline||f.ringDistrict||f.type==="terminal");
  const assigned=new Set(main.map(f=>f.id));
  const large=main.map(parent=>{
   const children=[...(parent.mediumZones||[]),...presentationChildren(parent.id),
    ...data.facilities.filter(f=>f.id!==parent.id&&(f.containedIn===parent.id||f.locatedInDistrict===parent.id))];
   const uniques=[...new Map(children.map(f=>[f.id,f])).values()];
   for(const f of uniques)assigned.add(f.id);
   return {id:parent.id,name:parent.name,children:uniques.map(f=>({
    id:f.id,name:f.name,parentId:parent.id
   }))};
  });
  const unassigned=data.facilities.filter(f=>!assigned.has(f.id)).map(f=>({id:f.id,name:f.name}));
  return {large,unassigned};
 }
 function findSelection(id){
  if(!data)return null;
  for(const f of data.facilities){
   if(f.id===id)return f;
   for(const m of f.mediumZones||[])if(m.id===id)return m;
  }
  return null;
 }
 function selectItemById(id,{focus=true}={}){
  const item=findSelection(id);
  if(!item)return false;
  if(focus){
   const isMedium=Boolean(item.level==="medium"||isArboraMedium(item)||item.containedIn||
    item.districtParentId);
   zoom=Math.max(zoom,isMedium?2.25:1.45);
   const s=scale();
   offsetX=-(item.y||0)*s;offsetY=(item.x||0)*s;
  }
  showDetails(item);
  return true;
 }
 return {show,reset,getHierarchy,selectItemById,legendEntries:()=>data?[...data.facilities.filter(f=>f.mediumZones?.length),...data.roads]:[]};
}
global.AAMapViewer={create,shapeVertices,insidePolygon,roadColor};
})(window);
