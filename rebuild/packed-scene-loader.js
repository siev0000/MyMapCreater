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
 if(!Array.isArray(pack.f)||!Array.isArray(pack.t))throw Error("圧縮地図の地物データが不正です");
 const gr=pack.g||{},size=Number(gr.widthM)||500;
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
 for(const [id,name,layer,type,rawGeometry,width,estimated,kind,osmId,levels,height,labelText] of pack.f){
  const geometry=type==="polyline"||type==="polygon"?{type,points:rawGeometry}
   :type==="circle"?{type,center:rawGeometry.slice(0,2),radius:rawGeometry[2]}
   :{type,...rawGeometry};
  const style=layer==="buildings"?{fill:"#647f85",stroke:"#bdd5d6",strokeWidth:1,opacity:1}
   :layer==="roads"?{fill:null,stroke:"#d7d0bd",strokeWidth:1,opacity:1}
   :layer==="railways"?{fill:null,stroke:"#d1b89b",strokeWidth:1,opacity:1}
   :layer==="water"?{fill:null,stroke:"#4a9abf",strokeWidth:1,opacity:1}
   :{fill:"#f1c66d",stroke:"#fff4d8",strokeWidth:1};
  const metadata={source:id.startsWith("osm_")?"OpenStreetMap":"station-coordinate"};
  if(kind)metadata.featureKind=kind;
  if(Number.isFinite(osmId))metadata.osmId=osmId;
  if(id.startsWith("osm_way_")&&Number.isFinite(osmId))metadata.sourceUrl="https://www.openstreetmap.org/way/"+osmId;
  if(Number.isFinite(width)){metadata.renderWidthM=width;metadata.renderWidthEstimated=!!estimated}
  if(Number.isFinite(levels))metadata.buildingLevels=levels;
  if(Number.isFinite(height))metadata.heightM=height;
  if(id.startsWith("osm_"))metadata.snapshotReducedMetadata=true;
  const obj={id,name,objectType:"object",layer,zIndex:({terrain:4,landuse:12,water:22,buildings:40,roads:55,railways:60,stations:70})[layer]||40,
   displayLevel:1,visible:true,selectable:true,geometry,style,metadata};
  if(labelText)obj.label={visible:true,text:labelText,position:type==="circle"?[geometry.center[0],geometry.center[1]-14]:[0,0],fontSize:10};
  scene.objects.push(obj);
 }
 const min=Number(gr.minElevationM),max=Number(gr.maxElevationM);
 const tileW=size/20*4;
 for(let j=0;j<20;j++)for(let i=0;i<20;i++){
  const h=pack.t[j*20+i];if(!Number.isFinite(h))continue;
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
 return scene;
}
g.AAMapPackedScene={unpack};
})(window);