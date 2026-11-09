/* Shared city-production utilities; no geographic API calls or scene schema changes. */
(function(global){"use strict";
 const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const cp=o=>JSON.parse(JSON.stringify(o));
 function roadCandidate(scene,selectedId,maxWorld){
  const target=scene.objects.find(o=>o.id===selectedId);
  if(target?.metadata?.featureKind!=="road"||target.geometry?.type!=="polyline")throw Error("道路を選択してください");
  if(!Number.isFinite(maxWorld)||maxWorld<=0)throw Error("接続距離を確認してください");
  const candidates=[];
  for(const other of scene.objects){
   if(other.id===target.id||other.metadata?.featureKind!=="road"||other.geometry?.type!=="polyline")continue;
   for(const i of [0,target.geometry.points.length-1])for(const j of [0,other.geometry.points.length-1]){
    const a=target.geometry.points[i],b=other.geometry.points[j],d=dist(a,b);
    if(d>0.0001&&d<=maxWorld)candidates.push({sourceId:target.id,otherId:other.id,sourceIndex:i,otherIndex:j,distanceWorld:d,point:[(a[0]+b[0])/2,(a[1]+b[1])/2]});
   }
  }
  return candidates.sort((a,b)=>a.distanceWorld-b.distanceWorld)[0]||null;
 }
 function joinRoads(scene,selectedId,maxWorld){
  const candidate=roadCandidate(scene,selectedId,maxWorld);
  if(!candidate)return{scene:null,connected:false};
  const next=cp(scene),a=next.objects.find(o=>o.id===candidate.sourceId),b=next.objects.find(o=>o.id===candidate.otherId);
  a.geometry.points[candidate.sourceIndex]=[...candidate.point];
  b.geometry.points[candidate.otherIndex]=[...candidate.point];
  // Real imported OSM paths are user-edited here: mark geometries as modified.
  a.metadata={...a.metadata,manualGeometryEdit:true};
  b.metadata={...b.metadata,manualGeometryEdit:true};
  return{scene:next,connected:true,candidate};
 }
 function terrainPaint(scene,selectedId,radiusWorld,deltaM){
  const target=scene.objects.find(o=>o.id===selectedId);
  if(target?.metadata?.featureKind!=="terrain"||target.geometry?.type!=="rect"||!Number.isFinite(target.metadata?.elevationM))throw Error("標高のある地形セルを選択してください");
  if(!Number.isFinite(radiusWorld)||radiusWorld<0||!Number.isFinite(deltaM)||Math.abs(deltaM)>1000)throw Error("変更範囲・標高差が不正です");
  const next=cp(scene),g=target.geometry,origin=[g.x+g.width/2,g.y+g.height/2];
  const geo=next.settings?.georeference||{};
  const min=Number(geo.minElevationM),max=Number(geo.maxElevationM);
  let changed=0;
  for(const item of next.objects){
   if(item.metadata?.featureKind!=="terrain"||item.geometry?.type!=="rect"||!Number.isFinite(item.metadata?.elevationM))continue;
   const p=[item.geometry.x+item.geometry.width/2,item.geometry.y+item.geometry.height/2];
   if(dist(origin,p)>radiusWorld+1e-8)continue;
   const h=Math.round((item.metadata.elevationM+deltaM)*100)/100;
   item.metadata={...item.metadata,elevationM:h,manualElevationEdit:true,verifiedElevation:false};
   item.name="標高 "+h.toFixed(1)+"m";
   if(Number.isFinite(min)&&Number.isFinite(max)){
    const t=max===min?.5:Math.max(0,Math.min(1,(h-min)/(max-min)));
    const red=Math.round(37+100*t),green=Math.round(75+78*(1-t)),blue=Math.round(63+18*(1-t));
    item.style={...item.style,fill:"rgb("+red+","+green+","+blue+")"};
   }
   changed++;
  }
  return{scene:next,count:changed};
 }
 global.AAMapTownTools={roadCandidate,joinRoads,terrainPaint};
})(window);
