/* 咲花駅周辺・建物内部の編集用仮案。
 * OSM/国土地理院が室内を検証したデータではない。
 * 既存の建物外形・駅座標・標高・道路・鉄道を一切変更せず、子オブジェクトのみ追加する。
 */
(function(root){"use strict";
const VERSION="sakihana-interiors-draft-v4";
function bounds(g){
 if(!g)return null;
 let p=g.type==="polygon"?g.points:(g.type==="rect"?[[g.x,g.y],[g.x+g.width,g.y+g.height]]:null);
 if(!Array.isArray(p)||!p.length)return null;
 const xs=p.map(x=>x[0]),ys=p.map(x=>x[1]);
 return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
}
function inside(px,py,points){
 let hit=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];
  if(((a[1]>py)!==(b[1]>py))&&(px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1])+a[0]))hit=!hit;
 }
 return hit;
}
function add(scene,owner,suffix,name,type,geometry,level,style,extra){
 const child={
  id:owner.id+"__"+suffix,name,parentId:owner.id,objectType:type,displayLevel:level,
  floorId:owner.id+"__1F",layer:"buildings",zIndex:type==="object"?47:type==="door"?46:type==="wall"?45:43,
  visible:true,selectable:true,geometry,
  style:style||{fill:"rgba(100,156,176,.18)",stroke:"#8bc1ce",strokeWidth:0.9,opacity:1},
  detail:"編集用の仮間取りです。実地の室内情報ではありません。",
  metadata:{generated:true,source:"schematic-draft",verifiedInterior:false,interiorDraftVersion:VERSION},
  ...extra
 };
 scene.objects.push(child);return child;
}

function clip(points,inside,intersection){
 let out=[],prev=points[points.length-1];
 for(const cur of points){
  const a=inside(prev),b=inside(cur);
  if(a!==b)out.push(intersection(prev,cur));
  if(b)out.push(cur);
  prev=cur;
 }
 return out;
}
function polygonArea(p){
 return Math.abs(p.reduce((sum,q,i)=>{const n=p[(i+1)%p.length];return sum+q[0]*n[1]-n[0]*q[1]},0))/2;
}
function orientedFrame(points){
 let max=0,angle=0;
 for(let i=0;i<points.length;i++){
  const p=points[i],q=points[(i+1)%points.length],dx=q[0]-p[0],dy=q[1]-p[1],d=dx*dx+dy*dy;
  if(d>max){max=d;angle=Math.atan2(dy,dx)}
 }
 if(!max)return null;
 const c=Math.cos(angle),t=Math.sin(angle);
 const coords=points.map(p=>[p[0]*c+p[1]*t,-p[0]*t+p[1]*c]);
 return{c,t,u0:Math.min(...coords.map(p=>p[0])),u1:Math.max(...coords.map(p=>p[0])),v0:Math.min(...coords.map(p=>p[1])),v1:Math.max(...coords.map(p=>p[1]))};
}
function localClip(poly,frame,u0,u1,v0,v1){
 const u=p=>p[0]*frame.c+p[1]*frame.t,v=p=>-p[0]*frame.t+p[1]*frame.c;
 const limits=[[u,u0,1],[u,u1,-1],[v,v0,1],[v,v1,-1]];
 let result=poly;
 for(const [fn,limit,sign] of limits){
  if(!result.length)return null;
  result=clip(result,p=>(fn(p)-limit)*sign>=-1e-7,(a,b)=>{
   const da=fn(a)-limit,db=fn(b)-limit,t=da/(da-db);
   return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  });
 }
 if(result.length<3||polygonArea(result)<1)return null;
 // Concave shapes may split a clipped zone; reject polygons that bridge exterior.
 for(let i=0;i<result.length;i++){
  const a=result[i],b=result[(i+1)%result.length];
  for(const t of [.2,.5,.8]){
   const p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
   const onEdge=poly.some((q,j)=>{
    const n=poly[(j+1)%poly.length];
    const cr=(p[0]-q[0])*(n[1]-q[1])-(p[1]-q[1])*(n[0]-q[0]);
    return Math.abs(cr)<1e-4&&((p[0]-q[0])*(p[0]-n[0])+(p[1]-q[1])*(p[1]-n[1])<=1e-5);
   });
   if(!inside(p[0],p[1],poly)&&!onEdge)return null;
  }
 }
 return result;
}

function lineAtLocalU(poly,f,target,minV,maxV){
 const u=p=>p[0]*f.c+p[1]*f.t,v=p=>-p[0]*f.t+p[1]*f.c;
 const hits=[];
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],ua=u(a),ub=u(b);
  if(Math.abs(ua-ub)<1e-7){
   if(Math.abs(ua-target)<1e-5){hits.push(a,b)}
   continue;
  }
  const t=(target-ua)/(ub-ua);
  if(t>=-1e-7&&t<=1+1e-7)hits.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
 }
 const values=[...new Set(hits.map(p=>Math.round(v(p)*1e5)/1e5)),minV,maxV].sort((a,b)=>a-b);
 let candidate=null;
 for(let i=1;i<values.length;i++){
  const low=Math.max(minV,values[i-1]),high=Math.min(maxV,values[i]);
  if(high-low<1.8)continue;
  const mid=(low+high)/2;
  const p=[target*f.c-mid*f.t,target*f.t+mid*f.c];
  if(!inside(p[0],p[1],poly))continue;
  if(!candidate||high-low>candidate[1]-candidate[0])candidate=[low,high];
 }
 return candidate?[[target*f.c-candidate[0]*f.t,target*f.t+candidate[0]*f.c],
                   [target*f.c-candidate[1]*f.t,target*f.t+candidate[1]*f.c]]:null;
}
function wallLine(scene,owner,id,a,b,kind){
 return add(scene,owner,"wall_"+id,kind==="outer"?"外壁（仮）":"間仕切り（仮）","wall",
 {type:"polyline",points:[a,b]},2,{fill:null,stroke:"#d4e2e6",strokeWidth:1.3,opacity:1},
 {wall:{thickness:.3},metadata:{generated:true,source:"schematic-draft",verifiedInterior:false,interiorDraftVersion:VERSION,kind}});
}
function doorOnWall(scene,owner,id,wall,kind,fromId,toId){
 const [a,b]=wall.geometry.points,dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
 if(length<2.2)return null;
 const width=Math.min(3.6,length*.34),half=width/(2*length);
 const t0=.5-half,t1=.5+half;
 const start=[a[0]+dx*t0,a[1]+dy*t0],end=[a[0]+dx*t1,a[1]+dy*t1];
 return add(scene,owner,"door_"+id,kind==="exterior"?"屋外出入口（仮）":"室内扉（仮）","door",
 {type:"polyline",points:[start,end]},2,{fill:null,stroke:"#f3c279",strokeWidth:2,opacity:1},
 {opening:{wallId:wall.id,width},door:{type:"hinged",leafCount:1},
  metadata:{generated:true,source:"schematic-draft",verifiedInterior:false,interiorDraftVersion:VERSION,kind,
   connections:{from:fromId,to:toId},connectionVerified:false}});
}
function makeDoorAndWalls(scene,owner,poly,f,rooms){
 const exterior=[];
 const u=p=>p[0]*f.c+p[1]*f.t,v=p=>-p[0]*f.t+p[1]*f.c;
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(len<1e-4)continue;
  const wall=wallLine(scene,owner,"outer_"+i,a,b,"outer");
  if(len>=4){
   const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],uMid=u(mid),vMid=v(mid);
   // Prefer the side bordering the common/entry zone. No street-side assertion.
   const inCommon=uMid<=f.u0+(f.u1-f.u0)*.53&&vMid>=f.v0&&vMid<=f.v1;
   exterior.push({wall,len,score:inCommon?len+10000:len});
  }
 }
 exterior.sort((a,b)=>b.score-a.score);
 const entrance=exterior[0]?doorOnWall(scene,owner,"exterior",exterior[0].wall,"exterior","outside",rooms.main):null;
 const roomLinks=[];
 for(const {id,roomId,vStart,vEnd} of [{id:"a",roomId:rooms.a,vStart:.035,vEnd:.5},{id:"b",roomId:rooms.b,vStart:.5,vEnd:.965}]){
  if(!roomId)continue;
  const a=lineAtLocalU(poly,f,f.u0+(f.u1-f.u0)*.5,
   f.v0+(f.v1-f.v0)*vStart,f.v0+(f.v1-f.v0)*vEnd);
  if(!a)continue;
  const wall=wallLine(scene,owner,"partition_"+id,a[0],a[1],"partition");
  const door=doorOnWall(scene,owner,"room_"+id,wall,"interior",rooms.main,roomId);
  if(door)roomLinks.push(door.id);
 }
 return{entrance:entrance?.id||null,roomLinks};
}
function build(scene,owner,ordinal){
 const g=owner.geometry;
 const poly=g.type==="polygon"?g.points:g.type==="rect"?[[g.x,g.y],[g.x+g.width,g.y],[g.x+g.width,g.y+g.height],[g.x,g.y+g.height]]:null;
 if(!Array.isArray(poly)||poly.length<3||polygonArea(poly)<8)return false;
 const f=orientedFrame(poly);if(!f)return false;
 const w=f.u1-f.u0,h=f.v1-f.v0;if(w<2||h<2)return false;
 const slice=(a,b,c,d)=>localClip(poly,f,f.u0+a*w,f.u0+b*w,f.v0+c*h,f.v0+d*h);
 const common=slice(.035,.5,.035,.965);
 if(!common)return false;
 const isStation=/咲花|駅|station/i.test(owner.name||"")&&!/周辺/.test(owner.name||"");
 const large=Math.max(w,h)>=50;
 const addShape=(id,name,type,points,kind)=>{
  if(!points)return;
  add(scene,owner,id,name,type,{type:"polygon",points},2,
   {fill:type==="room"?"rgba(87,139,153,.23)":"#557e88",stroke:type==="room"?"#acd3dc":"#dfc482",strokeWidth:.9,opacity:1},
   {metadata:{generated:true,source:"schematic-draft",verifiedInterior:false,interiorDraftVersion:VERSION,kind}});
 };
 addShape("room_0",isStation?"駅待合室（仮）":large?"共用空間（仮）":"玄関・共用室（仮）","room",common,"main");
 addShape("room_1",large?"室内区画A（仮）":"居室（仮）","room",slice(.5,.965,.035,.5),"room");
 addShape("room_2",large?"室内区画B（仮）":"水回り（仮）","room",slice(.5,.965,.5,.965),"room");
 const roomIds={main:owner.id+"__room_0",a:scene.objects.some(o=>o.id===owner.id+"__room_1")?owner.id+"__room_1":null,
  b:scene.objects.some(o=>o.id===owner.id+"__room_2")?owner.id+"__room_2":null};
 const layout=makeDoorAndWalls(scene,owner,poly,f,roomIds);
 // Keep this distinction explicit: geometrically linked != walkability verified.
 owner.metadata={...(owner.metadata||{}),entranceDraft:!!layout.entrance,interiorDoorsDraft:layout.roomLinks.length,
  interiorConnectionsVerified:false};

 if(large)addShape("object_storage","収納設備（仮）","object",slice(.70,.82,.14,.27),"storage");
 const floorsNumber=Number(owner.metadata?.buildingLevels);
 const floors=Number.isFinite(floorsNumber)&&floorsNumber>=1?Math.min(4,Math.floor(floorsNumber)):1;
 if(floors>1)addShape("object_stair","階段位置（仮）","object",slice(.34,.48,.73,.91),"stair-proxy");
 owner.objectType="facility";
 owner.floors=Array.from({length:floors},(_,i)=>({id:owner.id+"__"+(i+1)+"F",label:(i+1)+"階",elevation:i*3,height:3}));
 owner.detail=(owner.detail?owner.detail+"\\n":"")+"室内配置は実測ではなく編集用の仮案。";
 owner.metadata={...(owner.metadata||{}),interiorDraftVersion:VERSION,verifiedInterior:false,interiorDraft:true,interiorConnectionsVerified:false};
 return true;
}
function addStationInterior(scene){
 // Link the schematic to the EXISTING station coordinate marker in the same scene.
 // The marker's position and footprint are left unchanged.
 const station=scene.objects.find(o=>o.metadata?.source==="station-coordinate"&&
  (/咲花|station/i.test(String(o.name||"")+" "+String(o.id||""))));
 if(!station||station.geometry?.type!=="circle")return false;
 const center=station.geometry.center;
 if(!Array.isArray(center)||center.length!==2)return false;
 station.objectType="facility";
 station.floors=[{id:station.id+"__1F",label:"駅施設・参考配置",elevation:0,height:3}];
 station.detail=(station.detail?station.detail+"\\n":"")+
  "駅構内の仮案。待合・出入口・ホーム等の相対配置と寸法は実測値ではありません。";
 station.metadata={...(station.metadata||{}),verifiedInterior:false,interiorDraft:true,interiorDraftVersion:VERSION};
 const [cx,cy]=center;
 // The geometry is a schematic overlay that appears ONLY after the existing marker is selected.
 const extent=Math.max(12,Math.min(20,Number(station.geometry.radius||6)*2));
 const x=cx-extent*.5,y=cy-extent*.55,w=extent,h=extent*.66;
 const floorId=station.id+"__1F";
 const zone=(id,name,g,type="room",style={fill:"rgba(74,132,151,.40)",stroke:"#b7dce6",strokeWidth:1.3,opacity:1})=>{
  scene.objects.push({id:station.id+"__"+id,name,parentId:station.id,objectType:type,displayLevel:2,
   floorId,layer:"stations",zIndex:80,visible:true,selectable:true,geometry:g,style,
   detail:"咲花駅の参考配置です。実際の位置・形状・寸法は未確認です。",
   metadata:{generated:true,source:"station-schematic-draft",verifiedInterior:false,interiorDraftVersion:VERSION}});
 };
 zone("waiting","駅待合スペース（仮）",{type:"rect",x,y,width:w*.65,height:h});
 zone("service","駅内設備（仮）",{type:"rect",x:x+w*.70,y:y+h*.15,width:w*.20,height:h*.35},"object");
 zone("entrance","駅出入口（仮位置）",{type:"rect",x:x+w*.3,y:y+h*.88,width:w*.25,height:h*.10},"door",
  {fill:"#dab979",stroke:"#ffdf9c",strokeWidth:1,opacity:1});
 zone("platform","ホーム方向（模式図）",
  {type:"rect",x:x-w*.15,y:y-h*.32,width:w*1.3,height:h*.22},"object",
  {fill:"rgba(140,153,149,.34)",stroke:"#d6dad8",strokeWidth:1,opacity:1});
 return true;
}
function enrich(scene){
 if(scene?.id!=="sakihana_gosen_500m"||!Array.isArray(scene.objects))return scene;
 if(scene.settings?.sakihanaInteriorDraft===VERSION)return scene;
 const original=[...scene.objects],buildings=original.filter(o=>o.metadata?.featureKind==="building");
 let generated=0,skipped=0;
 for(let i=0;i<buildings.length;i++)(build(scene,buildings[i],i)?generated++:skipped++);
 const stationLinked=addStationInterior(scene);
 // Station stays inside the same 500m map: its original coordinate marker is the parent.
 scene.settings={...scene.settings,sakihanaInteriorDraft:VERSION,
  interiorDraftNotice:"既存建物の室内構成は参考用の仮間取りで、現地調査・公開図面による検証はしていません。駅の実際の駅舎形状も未確認です。",
  interiorDraftCounts:{existingBuildingCount:buildings.length,generatedBuildingCount:generated,skippedBuildingCount:skipped,stationLinked}};
 return scene;
}
root.AASakihanaInteriorDraft={enrich,version:VERSION};
})(window);
