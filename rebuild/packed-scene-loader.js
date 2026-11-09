/* Lossless-feature-count packed snapshot decoder for maps generated in MyMapCreater.
 * Geometry coordinates in compact snapshots may be rounded for display; retain
 * original user JSON separately as archival full-precision source. */
(function(g){"use strict";
async function unpack(data){
 if(data?.format!=="scene-packed-deflate-v1")return data;
 if(typeof data.payload!=="string"||data.payload.length>2000000)throw Error("圧縮地図データが不正です");
 if(typeof DecompressionStream!=="function")throw Error("このブラウザーは圧縮シーンに対応していません");
 const raw=Uint8Array.from(atob(data.payload),x=>x.charCodeAt(0));
 const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate"));
 const pack=JSON.parse(await new Response(stream).text());
 if(!Array.isArray(pack.a)||!Array.isArray(pack.t))throw Error("圧縮地図の地物データが不正です");
 const gr={center:{lat:37.7351639,lon:139.2909028},widthM:500,heightM:500,worldUnitsPerMeter:4,source:"OpenStreetMap",copyright:"© OpenStreetMap contributors",license:"ODbL 1.0",attributionUrl:"https://www.openstreetmap.org/copyright",regionName:"咲花駅周辺",terrainVerified:true,terrainSource:"国土地理院 基盤地図情報数値標高モデル",demLayer:"dem5a_png",demZoom:15,osmTimestamp:"2026-11-09T13:16:52Z",importedAt:"2026-11-09T13:18:40.649Z",demRetrievedAt:"2026-11-09T13:50:37.590Z",minElevationM:21.01,maxElevationM:103.97,elevationSamplesKnown:441,elevationSamplesTotal:441,counts:{road:11,railway:5,building:69,landuse:0,water:1,other:0}},size=500;
 const b=size*2;
 const scene={
  schemaVersion:2,id:"sakihana_gosen_500m",name:"実在地域｜咲花駅周辺（500m四方）",
  coordinateSystem:{horizontal:[1,0],vertical:[0,1],background:"#14202a",
   bounds:{minX:-b,maxX:b,minY:-b,maxY:b}},
  grid:{visible:false,spacing:2,stroke:"rgba(180,202,205,.14)",strokeWidth:0.5},
  settings:{initialDisplayLevel:1,editorGrid:{spacing:2,fraction:0.5,originX:0,originY:0,visible:true,snap:true},
   georeference:{...gr,packedSnapshot:true,sourceAccuracy:"地図表示用スナップショット。元JSONの幾何座標を小数2桁へ丸めています"}},
  layers:[{id:"terrain",zIndex:4},{id:"landuse",zIndex:12},{id:"water",zIndex:20},
   {id:"buildings",zIndex:40},{id:"roads",zIndex:55},{id:"railways",zIndex:60},{id:"stations",zIndex:70}],
  objects:[]
 };
 const kinds={building:"建物",road:"道路",railway:"鉄道",waterway:"水路"};
 const layerNames={t:"terrain",l:"landuse",w:"water",b:"buildings",r:"roads",s:"stations"};
 // Railway and road share r initial; infer from each OSM ID classification label.
 // Categories are restored from featureKind, which is authoritative here.
 for(const [id,name,layerCode,typeCode,rawGeometry,width,kind,labelText,levels] of pack.a){
  const layer=kind==="railway"?"railways":kind==="road"?"roads":kind==="waterway"?"water":
   kind==="building"?"buildings":id.includes("station")||name==="咲花"?"stations":layerNames[layerCode]||"stations";
  let geometry;
  if(typeCode==="p"&&Array.isArray(rawGeometry)){
   const points=[];let x=0,y=0;
   for(let i=0;i<rawGeometry.length;i+=2){
    x+=rawGeometry[i];y+=rawGeometry[i+1];points.push([x/10,y/10]);
   }
   geometry={type:kind==="building"?"polygon":"polyline",points};
  }else if(typeCode==="c")geometry={type:"circle",center:[rawGeometry[0]/10,rawGeometry[1]/10],radius:rawGeometry[2]/10};
  else geometry={type:"none"};
  // The historical station-reference circle must retain its own metadata and marker.
  const style=layer==="buildings"?{fill:"#647f85",stroke:"#bdd5d6",strokeWidth:1,opacity:1}
   :layer==="roads"?{fill:null,stroke:"#d7d0bd",strokeWidth:1,opacity:1}
   :layer==="railways"?{fill:null,stroke:"#d1b89b",strokeWidth:1,opacity:1}
   :layer==="water"?{fill:null,stroke:"#4a9abf",strokeWidth:1,opacity:1}
   :{fill:"#f1c66d",stroke:"#fff4d8",strokeWidth:1};
  const osmMatch=id.match(/^osm_(?:way|node)_(\d+)/),osmId=osmMatch?Number(osmMatch[1]):null;
  const metadata={source:osmMatch?"OpenStreetMap":"station-coordinate"};
  if(kind)metadata.featureKind=kind;
  if(Number.isFinite(osmId))metadata.osmId=osmId;
  if(id.startsWith("osm_way_")&&Number.isFinite(osmId))metadata.sourceUrl="https://www.openstreetmap.org/way/"+osmId;
  if(Number.isFinite(width)){metadata.renderWidthM=width;metadata.renderWidthEstimated=true}
  if(Number.isFinite(levels))metadata.buildingLevels=Number(levels);
  if(osmMatch)metadata.snapshotReducedMetadata=true;
  const obj={id,name,objectType:"object",layer,zIndex:({terrain:4,landuse:12,water:22,buildings:40,roads:55,railways:60,stations:70})[layer]||40,
   displayLevel:1,visible:true,selectable:true,geometry,style,metadata};
  if(labelText)obj.label={visible:true,text:labelText,position:typeCode==="c"?[geometry.center[0],geometry.center[1]-14]:[0,0],fontSize:10};
  scene.objects.push(obj);
 }
 const min=Number(gr.minElevationM),max=Number(gr.maxElevationM);
 const tileW=size/20*4;
 for(let j=0;j<20;j++)for(let i=0;i<20;i++){
  const rawHeight=pack.t[j*20+i],h=rawHeight/10;if(!Number.isFinite(rawHeight))continue;
  const t=Number.isFinite(min)&&Number.isFinite(max)&&max>min?Math.max(0,Math.min(1,(h-min)/(max-min))):0.5;
  const red=Math.round(37+100*t),green=Math.round(75+78*(1-t)),blue=Math.round(63+18*(1-t));
  scene.objects.push({id:"gsi_terrain_"+i+"_"+j,name:"標高 "+h.toFixed(1)+"m",
   objectType:"object",layer:"terrain",zIndex:4,displayLevel:1,visible:true,selectable:true,
   geometry:{type:"rect",x:-b+i*tileW,y:-b+j*tileW,width:tileW,height:tileW},
   style:{fill:"rgb("+red+","+green+","+blue+")",stroke:null,opacity:0.72},
   detail:"国土地理院DEMから取得した標高の25mセル平均値（保存済み）",
   metadata:{featureKind:"terrain",elevationM:h,source:"国土地理院 標高タイル",verifiedElevation:true,demLayer:gr.demLayer||"dem5a_png"}
  });
 }
 if(scene.objects.length!==488)throw Error("保存された咲花駅の地物件数が一致しません："+scene.objects.length);
 return window.AASakihanaInteriorDraft?window.AASakihanaInteriorDraft.enrich(scene):scene;
}
g.AAMapPackedScene={unpack};
})(window);