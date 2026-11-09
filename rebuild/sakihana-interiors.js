/* 咲花駅周辺・建物内部の編集用仮案。
 * OSM/国土地理院が室内を検証したデータではない。
 * 既存の建物外形・駅座標・標高・道路・鉄道を一切変更せず、子オブジェクトのみ追加する。
 */
(function(root){"use strict";
const VERSION="sakihana-interiors-draft-v2";
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
function room(scene,owner,b,i,name,x,y,w,h){
 const margin=Math.min(w,h)*.04;
 if(w<=0||h<=0)return;
 const midX=x+w/2,midY=y+h/2;
 if(owner.geometry.type==="polygon"&&!inside(midX,midY,owner.geometry.points))return;
 add(scene,owner,"room_"+i,name,"room",
  {type:"rect",x:x+margin,y:y+margin,width:Math.max(0.1,w-2*margin),height:Math.max(0.1,h-2*margin)},
  2,{fill:"rgba(87,139,153,.23)",stroke:"#acd3dc",strokeWidth:0.8,opacity:1},
  {metadata:{generated:true,source:"schematic-draft",verifiedInterior:false,interiorDraftVersion:VERSION,roomPurpose:name}});
}
function wall(scene,owner,i,x1,y1,x2,y2){
 add(scene,owner,"wall_"+i,"間仕切り（仮）","wall",{type:"polyline",points:[[x1,y1],[x2,y2]]},2,
  {fill:null,stroke:"#d2e0de",strokeWidth:1.4,opacity:1},{wall:{thickness:0.3}});
}
function object(scene,owner,id,name,x,y,w,h,kind){
 add(scene,owner,"object_"+id,name,"object",
  {type:"rect",x,y,width:w,height:h},2,
  {fill:"#557e88",stroke:"#dfc482",strokeWidth:1,opacity:1},
  {metadata:{generated:true,source:"schematic-draft",verifiedInterior:false,interiorDraftVersion:VERSION,kind}});
}
function build(scene,owner,ordinal){
 const b=bounds(owner.geometry);if(!b||b.w<4||b.h<4)return false;
 // Limit every room to an inscribed zone for awkward OSM footprints.
 const p=owner.geometry.type==="polygon"?owner.geometry.points:null;
 const center=(x,y)=>!p||inside(x,y,p);
 let scale=0.8,cx=b.x+b.w/2,cy=b.y+b.h/2;
 while(scale>0.25){
  const hw=b.w*scale/2,hh=b.h*scale/2;
  if([[cx-hw,cy-hh],[cx+hw,cy-hh],[cx+hw,cy+hh],[cx-hw,cy+hh]].every(v=>center(...v)))break;
  scale-=0.05;
 }
 if(scale<=0.25)return false;
 const x=cx-b.w*scale/2,y=cy-b.h*scale/2,w=b.w*scale,h=b.h*scale;
 const name=String(owner.name||"");
 const isStation=/咲花|駅|station/i.test(name)&&!/周辺/.test(name);
 const large=Math.max(w,h)>=50;
 const floorsNumber=Number(owner.metadata?.buildingLevels);
 const floors=Number.isFinite(floorsNumber)&&floorsNumber>=1?Math.min(4,Math.floor(floorsNumber)):1;
 owner.objectType="facility";
 owner.floors=Array.from({length:floors},(_,i)=>({id:owner.id+"__"+(i+1)+"F",label:(i+1)+"階",elevation:i*3,height:3}));
 owner.detail=(owner.detail?owner.detail+"\n":"")+"室内配置は実測ではなく編集用の仮案。";
 owner.metadata={...(owner.metadata||{}),interiorDraftVersion:VERSION,verifiedInterior:false,interiorDraft:true};
 room(scene,owner,b,0,isStation?"駅待合室（仮）":large?"共用空間（仮）":"玄関・共用室（仮）",x,y,w,h);
 if(w>13&&h>13){
  const vertical=w>=h;
  if(vertical){
   room(scene,owner,b,1,isStation?"駅事務スペース（仮）":large?"室内区画A（仮）":"居室（仮）",x+w*.52,y,w*.48,h*.53);
   room(scene,owner,b,2,isStation?"設備・倉庫（仮）":large?"室内区画B（仮）":"水回り（仮）",x+w*.52,y+h*.54,w*.48,h*.46);
   wall(scene,owner,1,x+w*.52,y,x+w*.52,y+h*.40);
   wall(scene,owner,2,x+w*.52,y+h*.65,x+w*.52,y+h);
  }else{
   room(scene,owner,b,1,isStation?"駅事務スペース（仮）":large?"室内区画A（仮）":"居室（仮）",x,y+h*.52,w*.54,h*.48);
   room(scene,owner,b,2,isStation?"設備・倉庫（仮）":large?"室内区画B（仮）":"水回り（仮）",x+w*.55,y+h*.52,w*.45,h*.48);
   wall(scene,owner,1,x,y+h*.52,x+w*.42,y+h*.52);
   wall(scene,owner,2,x+w*.66,y+h*.52,x+w,y+h*.52);
  }
 }
 const ow=Math.max(1,Math.min(w*.13,6)),oh=Math.max(1,Math.min(h*.12,5));
 object(scene,owner,"entry","出入口付近の設備（仮）",x+w*.12,y+h*.13,ow,oh,"entry");
 if(large)object(scene,owner,"storage",isStation?"案内・券売設備位置（仮）":"収納設備（仮）",x+w*.70,y+h*.16,ow,oh,isStation?"station-service":"storage");
 if(floors>1)object(scene,owner,"stair","階段位置（仮）",x+w*.37,y+h*.70,Math.max(2,w*.16),Math.max(2,h*.18),"stair-proxy");
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
