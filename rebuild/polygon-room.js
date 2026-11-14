/* Generic polygon room -> perimeter walls + edge-selected doors.
   Coordinates are Scene v2 world units. No world-setting assumptions. */
(function(global){"use strict";
 const EPS=1e-7;
 const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
 const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
 const close=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<EPS;
 function normalize(points){
  if(!Array.isArray(points))throw Error("部屋には多角形の頂点が必要です");
  const pts=points.map(p=>{
   if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))throw Error("多角形の頂点座標が不正です");
   return [...p];
  });
  if(pts.length>3&&close(pts[0],pts[pts.length-1]))pts.pop();
  if(pts.length<3)throw Error("部屋は3頂点以上で指定してください");
  for(let i=0;i<pts.length;i++)if(close(pts[i],pts[(i+1)%pts.length]))throw Error("辺の長さが0です: "+(i+1));
  let doubleArea=0;
  for(let i=0;i<pts.length;i++)doubleArea+=cross(pts[i],pts[(i+1)%pts.length]);
  if(Math.abs(doubleArea)<EPS)throw Error("多角形の面積が0です");
  const intersect=(a,b,c,d)=>{
   const u=sub(b,a),v=sub(d,c),w=sub(c,a),den=cross(u,v);
   if(Math.abs(den)<EPS)return false;
   const t=cross(w,v)/den,s=cross(w,u)/den;
   return t>EPS&&t<1-EPS&&s>EPS&&s<1-EPS;
  };
  for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){
   if(j===i+1||(i===0&&j===pts.length-1))continue;
   if(intersect(pts[i],pts[(i+1)%pts.length],pts[j],pts[(j+1)%pts.length]))
    throw Error("多角形の辺が交差しています: "+(i+1)+" と "+(j+1));
  }
  return pts;
 }
 function build(room,{worldUnitsPerMeter=1,wallThicknessCm=25,doors=[]}={}){
  if(!room?.id||room.geometry?.type!=="polygon")throw Error("多角形の部屋を選択してください");
  if(!Number.isFinite(worldUnitsPerMeter)||worldUnitsPerMeter<=0)throw Error("マップ縮尺が不正です");
  if(!Number.isFinite(wallThicknessCm)||wallThicknessCm<=0||wallThicknessCm>300)throw Error("壁厚は1〜300cmで指定してください");
  const points=normalize(room.geometry.points);
  const specs=new Map();
  for(const d of doors){
   const edgeIndex=Number(d.edgeIndex),widthM=Number(d.widthM),position=Number(d.position);
   if(!Number.isSafeInteger(edgeIndex)||edgeIndex<0||edgeIndex>=points.length)throw Error("扉を置く辺番号が範囲外です");
   if(specs.has(edgeIndex))throw Error("同じ辺に複数の扉を重複指定しています");
   if(!Number.isFinite(widthM)||widthM<=0)throw Error("扉の幅は正の数で指定してください");
   if(!Number.isFinite(position)||position<0||position>1)throw Error("扉の位置は0〜1で指定してください");
   const a=points[edgeIndex],b=points[(edgeIndex+1)%points.length],vec=sub(b,a),len=Math.hypot(...vec);
   const width=widthM*worldUnitsPerMeter;
   if(width>len+EPS)throw Error("辺"+(edgeIndex+1)+"の長さより扉幅が大きいです");
   if(position*len-width/2< -EPS||(1-position)*len-width/2< -EPS)
    throw Error("辺"+(edgeIndex+1)+"の扉が角からはみ出しています");
   specs.set(edgeIndex,{edgeIndex,widthM,position,type:d.type==="hinged"?"hinged":"sliding"});
  }
  const common={parentId:room.id,displayLevel:(room.displayLevel||1)+1,
   ...(room.floorId?{floorId:room.floorId}:{}),visible:true,selectable:true};
  // Keep a single perimeter wall; its consecutive segments are the room edges.
  // The existing viewer cuts linked door spans from any polyline segment.
  const wallId=room.id+"__polygon_wall";
  const walls=[{id:wallId,name:(room.name||"部屋")+"・外周壁",objectType:"wall",layer:"walls",zIndex:47,
   ...common,geometry:{type:"polyline",points:[...points,points[0]]},
   style:{stroke:"#bed4df",strokeWidth:1.5},label:{visible:false,text:""},
   wall:{thickness:wallThicknessCm/100*worldUnitsPerMeter},
   metadata:{generatedFromPolygonRoom:room.id,role:"polygon-room-perimeter-wall",wallThicknessCm,
    wallUnitsPerMeter:worldUnitsPerMeter}}];
  const openings=[];
  for(const [i,spec] of specs){
   const a=points[i],b=points[(i+1)%points.length],delta=sub(b,a),len=Math.hypot(...delta);
   const half=spec.widthM*worldUnitsPerMeter/(2*len);
   const point=(t)=>[a[0]+delta[0]*t,a[1]+delta[1]*t];
   openings.push({id:room.id+"__polygon_door_"+(i+1),
    name:(room.name||"部屋")+"・扉（辺"+(i+1)+"）",objectType:"door",layer:"walls",zIndex:50,
    ...common,geometry:{type:"polyline",points:[point(spec.position-half),point(spec.position+half)]},
    style:{stroke:"#e7cb9d",strokeWidth:2},label:{visible:false,text:""},
    opening:{kind:"interior",external:false,width:spec.widthM*worldUnitsPerMeter,wallId},
    door:{type:spec.type,slideDirection:"end",state:"closed"},
    metadata:{generatedFromPolygonRoom:room.id,role:"polygon-room-door",edgeIndex:i,widthM:spec.widthM,position:spec.position}});
  }
  return{points,walls,doors:openings};
 }
 global.AAMapPolygonRoom={build,normalize};
})(window);
