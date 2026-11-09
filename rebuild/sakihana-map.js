/* Sakihana geographic importer; 500m square, real OSM ways and GSI heights.
   1 map-grid cell = 0.5m = 2 world coordinates, 1m = 4 coordinates.
   No synthetic building, route or terrain geometry is generated.
   OpenStreetMap ODbL attribution: https://www.openstreetmap.org/copyright
   GSI DEM source: https://maps.gsi.go.jp/development/demtile.html */
(function(global){"use strict";
const CENTER={lat:37.7351639,lon:139.2909028};
let HALF_M=250,REGION_NAME="咲花駅周辺",REGION_ID="sakihana_gosen_500m";
const UNIT=4,DEG_LAT=111132.92;
let DEG_LON=111320*Math.cos(CENTER.lat*Math.PI/180);
const BOUNDS={minX:-1000,maxX:1000,minY:-1000,maxY:1000};
function configure({lat,lon,sizeM=500,name="指定地域",id}={}){
 const a=Number(lat),b=Number(lon),size=Number(sizeM);
 if(!Number.isFinite(a)||a<=-85||a>=85||!Number.isFinite(b)||b<-180||b>180)throw Error("緯度・経度が不正です");
 if(!Number.isFinite(size)||size<100||size>2000)throw Error("取得範囲は100〜2000mで指定してください");
 CENTER.lat=a;CENTER.lon=b;HALF_M=size/2;
 DEG_LON=111320*Math.cos(a*Math.PI/180);
 for(const [key,value] of Object.entries({minX:-HALF_M*UNIT,maxX:HALF_M*UNIT,minY:-HALF_M*UNIT,maxY:HALF_M*UNIT}))BOUNDS[key]=value;
 REGION_NAME=String(name||"指定地域").slice(0,100);
 REGION_ID=String(id||("geo_"+a.toFixed(5).replace(".","_")+"_"+b.toFixed(5).replace(".","_")+"_"+size+"m")).replace(/[^a-zA-Z0-9_-]/g,"_");
 return region();
}
function region(){return{lat:CENTER.lat,lon:CENTER.lon,sizeM:HALF_M*2,name:REGION_NAME,id:REGION_ID}}
async function searchPlace(name){
 const q=String(name||"").trim();
 if(q.length<2||q.length>120)throw Error("地名は2〜120文字で指定してください");
 const url="https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=ja&q="+encodeURIComponent(q);
 const response=await fetch(url,{headers:{"Accept":"application/json"}});
 if(!response.ok)throw Error("地名検索に失敗しました（HTTP "+response.status+"）");
 const results=await response.json();
 if(!Array.isArray(results))throw Error("検索応答が不正です");
 return results.map(x=>({name:String(x.display_name||q),lat:Number(x.lat),lon:Number(x.lon)}))
  .filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon));
}
// Try the community instance first; overpass-api.de often returns HTTP 502
// when its query queue is full. Never hammer a failing host with fast retries.
const overpassEndpoints=[
 "https://overpass.private.coffee/api/interpreter",
 "https://lz4.overpass-api.de/api/interpreter",
 "https://overpass-api.de/api/interpreter"
];
function fromLonLat(p){return[(p.lon-CENTER.lon)*DEG_LON*UNIT,(CENTER.lat-p.lat)*DEG_LAT*UNIT]}
function toLonLat(x,y){return{lat:CENTER.lat-y/UNIT/DEG_LAT,lon:CENTER.lon+x/UNIT/DEG_LON}}
function bbox(){
 const a=toLonLat(-HALF_M*UNIT,HALF_M*UNIT),b=toLonLat(HALF_M*UNIT,-HALF_M*UNIT);
 return[a.lat,a.lon,b.lat,b.lon].map(v=>v.toFixed(8)).join(",");
}
function osmQuery(){
 const box=bbox();
 return "[out:json][timeout:45];("+
  "way[highway]("+box+");"+
  "way[railway]("+box+");"+
  "way[building]("+box+");"+
  "way[landuse]("+box+");"+
  "way[natural]("+box+");"+
  "way[waterway]("+box+");"+
  "way[leisure]("+box+");"+
  "node[railway~\"station|halt\"]("+box+");"+
  ");out body geom;";
}
function clipSegment(a,b){
 let lo=0,hi=1,dx=b[0]-a[0],dy=b[1]-a[1];
 const pp=[-dx,dx,-dy,dy],qq=[a[0]-BOUNDS.minX,BOUNDS.maxX-a[0],a[1]-BOUNDS.minY,BOUNDS.maxY-a[1]];
 for(let i=0;i<4;i++){
  if(Math.abs(pp[i])<1e-12){if(qq[i]<0)return null;continue}
  const t=qq[i]/pp[i];
  if(pp[i]<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
  if(lo>hi)return null;
 }
 return[[a[0]+dx*lo,a[1]+dy*lo],[a[0]+dx*hi,a[1]+dy*hi]];
}
function clipLine(points){
 const result=[];let current=[];
 const push=()=>{
  if(current.length>=2)result.push(current);
  current=[];
 };
 for(let i=1;i<points.length;i++){
  const seg=clipSegment(points[i-1],points[i]);
  if(!seg){push();continue}
  if(current.length&&Math.hypot(current[current.length-1][0]-seg[0][0],current[current.length-1][1]-seg[0][1])>1e-5)push();
  if(!current.length)current.push(seg[0]);
  current.push(seg[1]);
 }
 push();return result;
}
function clipPolygon(points){
 let poly=points.map(x=>[...x]);
 if(poly.length>2&&Math.hypot(poly[0][0]-poly.at(-1)[0],poly[0][1]-poly.at(-1)[1])<1e-7)poly.pop();
 const tests=[
  [p=>p[0]>=BOUNDS.minX,(a,b)=>intersect(a,b,0,BOUNDS.minX)],
  [p=>p[0]<=BOUNDS.maxX,(a,b)=>intersect(a,b,0,BOUNDS.maxX)],
  [p=>p[1]>=BOUNDS.minY,(a,b)=>intersect(a,b,1,BOUNDS.minY)],
  [p=>p[1]<=BOUNDS.maxY,(a,b)=>intersect(a,b,1,BOUNDS.maxY)]
 ];
 for(const [inside,inter] of tests){
  const output=[];
  for(let i=0;i<poly.length;i++){
   const a=poly[(i+poly.length-1)%poly.length],b=poly[i],ia=inside(a),ib=inside(b);
   if(ia!==ib)output.push(inter(a,b));
   if(ib)output.push(b);
  }
  poly=output;
  if(!poly.length)break;
 }
 return poly;
}
function intersect(a,b,k,val){
 const t=Math.abs(b[k]-a[k])<1e-12?0:(val-a[k])/(b[k]-a[k]);
 return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
}
function classify(tags,closed){
 if(tags.building&&tags.building!=="no"&&closed)
  return{kind:"building",layer:"buildings",z:40,fill:"#647f85",stroke:"#bdd5d6"};
 if(tags.railway&&tags.railway!=="abandoned"&&tags.railway!=="disused")
  return{kind:"railway",layer:"railways",z:60,fill:null,stroke:"#d1b89b"};
 if(tags.highway)
  return{kind:"road",layer:"roads",z:55,fill:null,stroke:["footway","path","steps","pedestrian"].includes(tags.highway)?"#9b8d71":"#d7d0bd"};
 if(tags.waterway)return{kind:"waterway",layer:"water",z:22,fill:null,stroke:"#4a9abf"};
 if(tags.natural==="water"||tags.water||tags.landuse==="reservoir")
  return{kind:"water",layer:"water",z:20,fill:"#236684",stroke:"#4b9cba"};
 if(tags.natural==="wood"||tags.landuse==="forest")
  return{kind:"forest",layer:"landuse",z:14,fill:"#305c45",stroke:"#417457"};
 if(["grassland","scrub","heath"].includes(tags.natural)||tags.landuse==="grass"||tags.leisure==="park")
  return{kind:"green",layer:"landuse",z:14,fill:"#60805b",stroke:"#72906c"};
 if(tags.landuse==="farmland"||tags.landuse==="meadow")
  return{kind:"farmland",layer:"landuse",z:14,fill:"#6b7749",stroke:"#879263"};
 if(tags.landuse)return{kind:"landuse",layer:"landuse",z:12,fill:"#3d4a49",stroke:"#596863"};
 if(tags.natural)return{kind:"natural",layer:"landuse",z:12,fill:"#425450",stroke:"#60746b"};
 return null;
}
const niceKind={building:"建物",railway:"鉄道",road:"道路",waterway:"水路",water:"水域",forest:"森林",green:"緑地",farmland:"農地",landuse:"土地利用",natural:"自然"};
function lineWidthMeters(tags,kind){
 const specific=Number.parseFloat(tags.width);
 if(Number.isFinite(specific)&&specific>0&&specific<80)return{value:specific,estimated:false};
 if(kind==="railway")return{value:1.5,estimated:true};
 if(kind==="waterway")return{value:Math.min(18,Number.parseFloat(tags.width)||5),estimated:true};
 const highway=tags.highway;
 return{value:({motorway:12,trunk:10,primary:8,secondary:7,tertiary:6,
  residential:4.5,unclassified:4.5,living_street:4,service:3.5,
  footway:1.5,path:1.2,track:2,steps:1.5,cycleway:2,pedestrian:3})[highway]||3.5,estimated:true};
}
function baseScene(){
 const root={
  id:REGION_ID==="sakihana_gosen_500m"?"sakihana_station_reference":"geo_center_reference",name:REGION_NAME+"（位置参照点）",objectType:"object",
  layer:"stations",zIndex:70,visible:true,selectable:true,displayLevel:1,
  geometry:{type:"circle",center:[0,0],radius:8},
  style:{fill:"#e8c17a",stroke:"#fff1c0",strokeWidth:1.3},
  label:{visible:true,text:REGION_NAME.slice(0,36),position:[0,-25],fontSize:12},
  detail:"検索または座標指定による中心点です。実地物はOSM取得後に追加されます。",
  metadata:{source:"geographic-center-reference",lat:CENTER.lat,lon:CENTER.lon}
 };
 return{
  schemaVersion:2,id:REGION_ID,name:"実在地域｜"+REGION_NAME+"（"+(HALF_M*2)+"m四方）",
  coordinateSystem:{horizontal:[1,0],vertical:[0,1],background:"#14202a",bounds:{...BOUNDS}},
  grid:{visible:false,spacing:2,stroke:"rgba(180,202,205,.14)",strokeWidth:.5},
  settings:{initialDisplayLevel:1,editorGrid:{spacing:2,fraction:.5,originX:0,originY:0,visible:true,snap:true},
   georeference:{center:{...CENTER},regionName:REGION_NAME,widthM:HALF_M*2,heightM:HALF_M*2,worldUnitsPerMeter:UNIT,
    source:"OpenStreetMap",copyright:"© OpenStreetMap contributors",license:"ODbL 1.0",
    attributionUrl:"https://www.openstreetmap.org/copyright",
    terrainSource:"国土地理院 基盤地図情報数値標高モデル（取得時のみ）",terrainVerified:false}},
  layers:[{id:"terrain",zIndex:4},{id:"landuse",zIndex:12},{id:"water",zIndex:20},
   {id:"buildings",zIndex:40},{id:"roads",zIndex:55},{id:"railways",zIndex:60},{id:"stations",zIndex:70}],
  objects:[root]
 };
}
function fromOverpass(payload){
 if(!payload||!Array.isArray(payload.elements))throw Error("Overpassのデータ形式が不正です");
 const scene=baseScene();
 const names=new Set(),counts={road:0,railway:0,building:0,landuse:0,water:0,other:0};
 for(const item of payload.elements){
  if(item.type==="node"){
   if(!["station","halt"].includes(item.tags?.railway))continue;
   const [x,y]=fromLonLat(item);
   if(x<BOUNDS.minX||x>BOUNDS.maxX||y<BOUNDS.minY||y>BOUNDS.maxY)continue;
   const id="osm_node_"+item.id;
   if(names.has(id))continue;
   names.add(id);
   scene.objects.push({
    id,name:item.tags.name||"鉄道駅",objectType:"object",layer:"stations",zIndex:70,
    visible:true,selectable:true,displayLevel:1,geometry:{type:"circle",center:[x,y],radius:5},
    style:{fill:"#f1c66d",stroke:"#fff4d8",strokeWidth:1},
    label:{visible:!!item.tags.name,text:item.tags.name||"",position:[x,y-14],fontSize:10},
    detail:"OpenStreetMap node "+item.id,
    metadata:{osmType:"node",osmId:item.id,osmTags:item.tags,source:"OpenStreetMap"}
   });continue;
  }
  if(item.type!=="way"||!Array.isArray(item.geometry)||item.geometry.length<2)continue;
  const tags=item.tags||{},closed=item.geometry.length>3&&item.geometry[0].lat===item.geometry.at(-1).lat&&item.geometry[0].lon===item.geometry.at(-1).lon;
  const type=classify(tags,closed);if(!type)continue;
  const points=item.geometry.map(fromLonLat);
  const pieces=closed&&type.fill?[clipPolygon(points)]:clipLine(points);
  let part=0;
  for(const piece of pieces){
   if(piece.length<(closed&&type.fill?3:2))continue;
   const id="osm_way_"+item.id+"_"+(part++);
   const polygon=!!(closed&&type.fill);
   const width=lineWidthMeters(tags,type.kind);
   const label=tags["name:ja"]||tags.name||tags.ref||null;
   const geometry=polygon?{type:"polygon",points:piece}:{type:"polyline",points:piece};
   const o={
    id,name:label||niceKind[type.kind]+"（OSM "+item.id+"）",objectType:"object",
    layer:type.layer,zIndex:type.z,displayLevel:1,visible:true,selectable:true,
    geometry,style:{fill:type.fill||null,stroke:type.stroke,strokeWidth:1,opacity:1},
    detail:niceKind[type.kind]+" / OSM way "+item.id+(label?" / "+label:""),
    metadata:{osmType:"way",osmId:item.id,osmTags:tags,featureKind:type.kind,
     source:"OpenStreetMap",sourceUrl:"https://www.openstreetmap.org/way/"+item.id}
   };
   if(!polygon){o.metadata.renderWidthM=width.value;o.metadata.renderWidthEstimated=width.estimated}
   if(type.kind==="building"){
    const height=Number.parseFloat(tags.height),levels=Number.parseFloat(tags["building:levels"]);
    if(Number.isFinite(height)&&height>0)o.metadata.heightM=height;
    else if(Number.isFinite(levels)&&levels>0)o.metadata.buildingLevels=levels;
   }
   // Polygons preserve actual OSM outline; arbitrary rotation/rect snapping is not applied.
   scene.objects.push(o);
   counts[type.kind in counts?type.kind:["water","waterway"].includes(type.kind)?"water":"landuse"]++;
  }
 }
 if(scene.objects.length<=1)throw Error("対象範囲に地物がありません。Overpass応答を確認してください。");
 scene.settings.georeference.osmTimestamp=payload.osm3s?.timestamp_osm_base||null;
 scene.settings.georeference.importedAt=new Date().toISOString();
 scene.settings.georeference.counts=counts;
 return scene;
}
async function loadOSM(){
 const query=osmQuery(),failures=[];
 for(const endpoint of overpassEndpoints){
  const host=new URL(endpoint).hostname;
  const controller=typeof AbortController==="function"?new AbortController():null;
  const timeout=controller?setTimeout(()=>controller.abort(),60000):null;
  try{
   const response=await fetch(endpoint,{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
    body:"data="+encodeURIComponent(query),
    ...(controller?{signal:controller.signal}:{})
   });
   if(!response.ok){
    const reason=response.status===502||response.status===503||response.status===504
     ?"（サーバー混雑・一時障害）"
     :response.status===429?"（利用制限）":"";
    failures.push(host+": HTTP "+response.status+reason);
    // A wrong query/blocked client should not be retried repeatedly on the same host.
    continue;
   }
   const payload=await response.json();
   const scene=fromOverpass(payload);
   scene.settings.georeference.overpassEndpoint=endpoint;
   return scene;
  }catch(error){
   failures.push(host+": "+(error?.name==="AbortError"?"60秒でタイムアウト":error?.message||"通信エラー"));
  }finally{if(timeout!==null)clearTimeout(timeout)}
 }
 throw Error("OSMを取得できませんでした。"+
  failures.join(" / ")+"。時間を置いて再試行してください。取得に失敗しても既存マップは変更されません。");
}
// Source elevations are supplied by GSI DEM PNG tiles, not estimated from OSM terrain classes.
const TILE_SIZE=256;
function tilePoint(lat,lon,z){
 const n=2**z,rad=lat*Math.PI/180;
 const xx=(lon+180)/360*n,yy=(1-Math.asinh(Math.tan(rad))/Math.PI)/2*n;
 return{x:Math.floor(xx),y:Math.floor(yy),px:Math.floor((xx%1)*TILE_SIZE),py:Math.floor((yy%1)*TILE_SIZE)};
}
async function fetchElevationTile(z,x,y,kind){
 const url="https://cyberjapandata.gsi.go.jp/xyz/"+kind+"/"+z+"/"+x+"/"+y+".png";
 const img=new Image();img.crossOrigin="anonymous";
 await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error("標高タイルを取得できません: "+url));img.src=url});
 const canvas=document.createElement("canvas");canvas.width=TILE_SIZE;canvas.height=TILE_SIZE;
 const ctx=canvas.getContext("2d",{willReadFrequently:true});
 ctx.drawImage(img,0,0);
 return ctx.getImageData(0,0,TILE_SIZE,TILE_SIZE).data;
}
function elevationFromRgb(r,g,b){
 const v=r*65536+g*256+b;
 if(v===8388608)return null;
 return Number(((v<8388608?v:v-16777216)*.01).toFixed(2));
}
async function elevationGrid(){
 const step=HALF_M/10,missing=[];
 // Prefer locally available 5m DEM tiles; fallback to 10m DEM rather than fabricate heights.
 for(const [kind,z] of [["dem5a_png",15],["dem5b_png",15],["dem5c_png",15],["dem_png",14]]){
  try{
   const tiles=new Map(),get=async(lat,lon)=>{
    const p=tilePoint(lat,lon,z),key=p.x+"/"+p.y;
    if(!tiles.has(key))tiles.set(key,await fetchElevationTile(z,p.x,p.y,kind));
    const rgba=tiles.get(key),off=(p.py*TILE_SIZE+p.px)*4;
    return elevationFromRgb(rgba[off],rgba[off+1],rgba[off+2]);
   };
   const samples=[];
   for(let j=0;j<=20;j++){
    const row=[];
    for(let i=0;i<=20;i++){
     const x=-HALF_M*UNIT+i*step*UNIT,y=-HALF_M*UNIT+j*step*UNIT;
     const p=toLonLat(x,y);row.push(await get(p.lat,p.lon));
    }
    samples.push(row);
   }
   const valid=samples.flat().filter(Number.isFinite);
   if(valid.length<30)continue;
   return{samples,stepM:step,source:kind,zoom:z,min:Math.min(...valid),max:Math.max(...valid),
    retrievedAt:new Date().toISOString(),known:valid.length,total:441};
  }catch(error){missing.push(kind+": "+error.message)}
 }
 throw Error("国土地理院の標高タイルを取得できませんでした。標高値を仮生成せず中止します。"+missing.join(" / ").slice(0,250));
}
function addElevation(scene,data){
 if(!Array.isArray(data?.samples)||data.samples.length!==21)throw Error("標高グリッドの形式が不正です");
 const next=JSON.parse(JSON.stringify(scene));
 next.objects=next.objects.filter(o=>o.metadata?.featureKind!=="terrain");
 const elevations=[];
 for(let j=0;j<20;j++)for(let i=0;i<20;i++){
  const cells=[data.samples[j][i],data.samples[j][i+1],data.samples[j+1][i],data.samples[j+1][i+1]].filter(Number.isFinite);
  if(!cells.length)continue;
  const h=cells.reduce((a,b)=>a+b,0)/cells.length;elevations.push(h);
  const t=data.max===data.min?0.5:Math.max(0,Math.min(1,(h-data.min)/(data.max-data.min)));
  const red=Math.round(37+100*t),green=Math.round(75+78*(1-t)),blue=Math.round(63+18*(1-t));
  next.objects.push({
   id:"gsi_terrain_"+i+"_"+j,name:"標高 "+h.toFixed(1)+"m",
   objectType:"object",layer:"terrain",zIndex:4,displayLevel:1,selectable:true,visible:true,
   geometry:{type:"rect",x:-HALF_M*UNIT+i*data.stepM*UNIT,y:-HALF_M*UNIT+j*data.stepM*UNIT,
    width:data.stepM*UNIT,height:data.stepM*UNIT},
   style:{fill:"rgb("+red+","+green+","+blue+")",stroke:null,opacity:.72},
   detail:"国土地理院 標高タイルから取得した"+data.stepM+"mセルの平均標高（m）",
   metadata:{featureKind:"terrain",elevationM:Number(h.toFixed(2)),
    source:"国土地理院 標高タイル",verifiedElevation:true,demLayer:data.source}
  });
 }
 const opts=next.settings.georeference;
 opts.terrainVerified=true;opts.demLayer=data.source;opts.demZoom=data.zoom;
 opts.demRetrievedAt=data.retrievedAt;
 opts.minElevationM=data.min;opts.maxElevationM=data.max;
 opts.elevationSamplesKnown=data.known;opts.elevationSamplesTotal=data.total;
 return next;
}
global.AASakihanaMap={CENTER,UNIT,BOUNDS,configure,region,searchPlace,fromLonLat,toLonLat,bbox,osmQuery,
 baseScene,fromOverpass,loadOSM,elevationGrid,addElevation,elevationFromRgb,clipLine,clipPolygon};
})(window);
