/* Generic, reusable building format library. Dimensions are grid cells, not existing map coordinates.
   Every object generated is JSON Scene v2 data, not a world-setting assertion. */
(function(global){"use strict";
const presets=[
  {
    "id": "small_house",
    "name": "小型住宅",
    "cells": [
      14,
      12
    ],
    "floors": 1,
    "layout": "split",
    "description": "居室と玄関を持つ小型住宅"
  },
  {
    "id": "row_house",
    "name": "連棟住宅",
    "cells": [
      16,
      12
    ],
    "floors": 2,
    "layout": "split",
    "description": "2階建ての小型住宅"
  },
  {
    "id": "shop",
    "name": "小型店舗",
    "cells": [
      18,
      14
    ],
    "floors": 1,
    "layout": "front",
    "description": "売場とバックヤード"
  },
  {
    "id": "office",
    "name": "事務所",
    "cells": [
      22,
      16
    ],
    "floors": 2,
    "layout": "split",
    "description": "事務室・通路・2階"
  },
  {
    "id": "warehouse",
    "name": "倉庫",
    "cells": [
      30,
      22
    ],
    "floors": 1,
    "layout": "open",
    "description": "搬入口と広い保管区画"
  },
  {
    "id": "workshop",
    "name": "工房",
    "cells": [
      24,
      18
    ],
    "floors": 1,
    "layout": "split",
    "description": "作業場所と材料保管区画"
  },
  {
    "id": "research",
    "name": "研究施設",
    "cells": [
      28,
      22
    ],
    "floors": 2,
    "layout": "split",
    "description": "作業室と共用通路"
  },
  {
    "id": "apartment",
    "name": "集合住宅",
    "cells": [
      28,
      22
    ],
    "floors": 3,
    "layout": "split",
    "description": "階ごとに部屋と階段"
  }
];
// Two alternative floorplans for each original category; original IDs remain valid.
const variants={
 small_house:[["small_house_side","小型住宅・側面玄関",[12,16],1,"side","片側に玄関と通路を寄せた住宅","left"],["small_house_open","小型住宅・広間型",[16,14],1,"open","仕切りの少ないワンルーム住宅","right"]],
 row_house:[["row_house_compact","連棟住宅・細長型",[12,18],2,"side","狭い間口と奥行きのある2階建て","left"],["row_house_large","連棟住宅・拡張型",[20,14],3,"cross","3階建ての連棟住宅","right"]],
 shop:[["shop_corner","小型店舗・角地型",[18,18],1,"side","側面玄関とバックヤード","right"],["shop_two_floor","小型店舗・2階型",[20,16],2,"front","1階売場と2階バックヤード","center"]],
 office:[["office_compact","事務所・小規模型",[18,14],1,"front","平屋の小型事務所","left"],["office_large","事務所・大型型",[28,22],3,"cross","複数室と廊下を持つ3階事務所","right"]],
 warehouse:[["warehouse_narrow","倉庫・細長型",[22,34],1,"open","奥行き重視の倉庫","left"],["warehouse_multi","倉庫・管理棟付き",[36,26],2,"side","保管場所と2階管理区画","right"]],
 workshop:[["workshop_compact","工房・小型",[18,14],1,"front","小型作業場と収納","left"],["workshop_large","工房・大型",[30,24],2,"cross","複数作業室と上階を持つ工房","right"]],
 research:[["research_linear","研究施設・廊下型",[34,18],2,"side","長い廊下と実験室","left"],["research_campus","研究施設・複室型",[34,28],3,"cross","複数室を持つ3階研究施設","right"]],
 apartment:[["apartment_compact","集合住宅・小型",[22,18],2,"side","2階建て集合住宅","left"],["apartment_tower","集合住宅・高層型",[30,26],4,"cross","4階建ての集合住宅","right"]]
};
for(const [category,arr] of Object.entries(variants)){
 const base=presets.find(t=>t.id===category);
 for(const [id,name,cells,floors,layout,description,entranceSide] of arr)
  presets.push({id,name,cells,floors,layout,description,entranceSide,category});
}
for(const preset of presets)if(!preset.category)preset.category=preset.id;
// Mechanical-life layouts are generic proposals based on AA's documented
// charging, fuel supply and communication facilities, not canonical floor plans.
const mechanical=[
 ["machine_residence","機械居住区・充電室",[16,14],1,"split","充電スタンドと個体用端末を置く生活施設","small_house"],
 ["machine_rest","機械休止所・共用型",[24,18],2,"side","複数の充電設備と燃料補給機を備える休止所","row_house"],
 ["machine_fuel","燃料補給ステーション",[22,16],1,"front","燃料補給設備と登録端末を持つ施設","shop"],
 ["machine_terminal","端末・情報施設",[20,18],2,"cross","登録・案内・通信のための端末施設","office"],
 ["machine_maintenance","整備・充電工房",[28,22],1,"split","保守台・充電設備・診断端末を持つ工房","workshop"],
 ["machine_supply","機械物資補給所",[28,20],1,"open","燃料・部品・バッテリーなどを管理する補給所","warehouse"]
];
for(const [id,name,cells,floors,layout,description,category] of mechanical)
 presets.push({id,name,cells,floors,layout,description,category,worldStyle:"machine",entranceSide:"center"});
const copy=x=>JSON.parse(JSON.stringify(x));
function generate(templateId,options={}){
 const template=presets.find(t=>t.id===templateId);
 if(!template)throw Error("不明な建物テンプレート: "+templateId);
 const {prefix,parentId=null,displayLevel=4,x=0,y=0,spacing=2,baseName=template.name}=options;
 if(typeof prefix!=="string"||!prefix)throw Error("建物IDが必要です");
 if(!Number.isFinite(spacing)||spacing<=0)throw Error("グリッド間隔が不正です");
 const W=template.cells[0]*spacing,H=template.cells[1]*spacing,objects=[];
 const at=(a,b)=>[x+a*spacing,y+b*spacing];
 const rect=(a,b,w,h)=>({type:"rect",x:x+a*spacing,y:y+b*spacing,width:w*spacing,height:h*spacing});
 const poly=points=>({type:"polyline",points:points.map(([a,b])=>at(a,b))});
 const id=s=>prefix+"_"+s;
 const base=(suffix,name,kind,geometry,floorId,style,extra={})=>{
  const obj={id:id(suffix),name,parentId:prefix,displayLevel:displayLevel+1,
   floorId,objectType:kind,layer:kind==="wall"||kind==="door"?"walls":"structures",
   zIndex:kind==="wall"?47:kind==="door"?49:kind==="stair"?46:kind==="slab"?29:45,
   geometry,visible:true,selectable:kind!=="wall"&&kind!=="slab",style,
   label:{visible:false,text:name},detail:"建物テンプレートから生成。必要に応じて編集してください。",
   metadata:{templateId:template.id,generated:true},...extra};
  objects.push(obj);return obj;
 };
 const floorNames=Array.from({length:template.floors},(_,i)=>({id:(i+1)+"F",label:(i+1)+"階",elevation:i*3,height:3}));
 const building={id:prefix,name:baseName,parentId,displayLevel,objectType:"facility",layer:"subregions",zIndex:30,
   geometry:{type:"rect",x,y,width:W,height:H},floors:copy(floorNames),
   visible:true,selectable:true,style:{fill:"rgba(90,143,153,.13)",stroke:"#a6cbd0",strokeWidth:1.5},
   label:{visible:true,text:baseName,position:[x+W/2,y+H/2],fontSize:11},
   detail:template.description+"（テンプレート配置。間取り・寸法は編集可能）",
   metadata:{templateId:template.id,generated:true}};
 objects.push(building);
 const wall=(name,f,points)=>base(name,"壁", "wall",poly(points),f,{stroke:"#d3e6e8",strokeWidth:2});
 const door=(name,f,points,external=false)=>base(name,external?"建物入口":"室内扉","door",poly(points),f,{stroke:"#e8b97a",strokeWidth:2},{
  door:{hinge:"start",swing:"inward",state:"closed",swingSide:"left"},
  opening:{kind:external?"entrance":"interior",width:2*spacing,external}
 });
 const nX=template.cells[0],nY=template.cells[1],mid=Math.round(nY*.54);
 const entranceWidth=template.category==="warehouse"?4:2;
 const entranceSide=template.entranceSide||"center";
 const start=entranceSide==="left"?2:entranceSide==="right"?nX-entranceWidth-2:(nX-entranceWidth)/2;
 const stair=template.floors>1;
 for(let i=0;i<template.floors;i++){
  const f=floorNames[i].id;
  base("floor_"+f,"床面 "+f,"slab",rect(0,0,nX,nY),f,{fill:"rgba(48,81,88,.64)",stroke:null});
  wall("north_"+f,f,[[0,0],[nX,0]]);
  wall("west_"+f,f,[[0,0],[0,nY]]);
  wall("east_"+f,f,[[nX,0],[nX,nY]]);
  if(i===0){
   wall("south_l_"+f,f,[[0,nY],[start,nY]]);
   wall("south_r_"+f,f,[[start+entranceWidth,nY],[nX,nY]]);
   door("entrance_"+f,f,[[start,nY],[start+entranceWidth,nY]],true);
  }else wall("south_"+f,f,[[0,nY],[nX,nY]]);
  if(template.layout!=="open"){
   // Internal wall with an actual opening, not a solid divider under a door.
   const depth=template.layout==="front"?Math.round(nY*.67):mid;
   const gapStart=template.layout==="side"?Math.round(nX*.28):(nX-2)/2;
   wall("partition_l_"+f,f,[[0,depth],[gapStart,depth]]);
   wall("partition_r_"+f,f,[[gapStart+2,depth],[nX,depth]]);
   door("partition_door_"+f,f,[[gapStart,depth],[gapStart+2,depth]]);
   if(template.layout==="cross"){
    const split=Math.round(nX*.48),y1=Math.max(3,depth-4),y2=depth-2;
    wall("cross_top_"+f,f,[[split,0],[split,y1]]);
    wall("cross_bottom_"+f,f,[[split,y2],[split,depth]]);
    door("cross_door_"+f,f,[[split,y1],[split,y2]]);
   }
  }
  if(stair){
   const sx=nX-5,sy=nY-7;
   base("stair_"+f,i+1<template.floors?"上り階段":"下り階段","stair",rect(sx,sy,4,6),f,
    {fill:"rgba(75,118,137,.5)",stroke:"#acd5df",strokeWidth:1.5},
    {shapePresetId:"stair",connection:{id:id("stair_main"),fromFloorId:f,
      toFloorId:floorNames[i+1]?.id||floorNames[i-1].id,
      fromAnchor:at(sx+2,sy+3),toAnchor:at(sx+2,sy+3),direction:i+1<template.floors?"up":"down"}});
  }
  if(template.category==="warehouse"){
    base("storage_"+f,"収納区画","object",rect(1,1,5,4),f,
     {fill:"#2b4856",stroke:"#9ec5ca",strokeWidth:1}, {shapePresetId:"storage_container"});
  }else if(template.category==="shop"){
    base("counter_"+f,"カウンター","object",rect(2,2,5,2),f,
     {fill:"#375666",stroke:"#9ec5ca",strokeWidth:1},{shapePresetId:"table"});
  }else if(template.category==="workshop"){
    base("workbench_"+f,"作業台","object",rect(2,2,6,3),f,
     {fill:"#375666",stroke:"#9ec5ca",strokeWidth:1},{shapePresetId:"workbench"});
  }else if(template.worldStyle!=="machine"&&["small_house","row_house","apartment"].includes(template.category)){
    base("bed_"+f,"ベッド","object",rect(2,2,3,5),f,
     {fill:"#375666",stroke:"#9ec5ca",strokeWidth:1},{shapePresetId:"bed"});
  }
  if(template.worldStyle==="machine"){
   const devices=template.id==="machine_fuel"?[
    ["fuel_station","燃料補給機",2,2,5,4,"fuel_dispenser"],["terminal","登録端末",nX-6,2,4,3,"terminal_device"]]:
    template.id==="machine_terminal"?[
    ["terminal","情報端末",2,2,5,4,"terminal_device"],["communication","通信端末",nX-7,2,4,3,"terminal_device"]]:
    template.id==="machine_maintenance"?[
    ["repair","整備台",2,2,7,5,"workbench"],["charging","充電設備",nX-8,2,5,5,"charging_station"],["diagnostic","診断端末",3,nY-6,4,3,"terminal_device"]]:
    template.id==="machine_supply"?[
    ["fuel_station","燃料補給機",2,2,5,4,"fuel_dispenser"],["terminal","管理端末",nX-7,2,4,3,"terminal_device"]]:
    [["charging","充電設備",2,2,5,5,"charging_station"],
     ["fuel_station","燃料補給機",nX-8,2,5,4,"fuel_dispenser"],
     ["terminal","個体用端末",2,nY-6,4,3,"terminal_device"]];
   for(const [deviceId,name,px,py,pw,ph,shapePresetId] of devices)
    base("device_"+deviceId+"_"+f,name,"object",rect(px,py,pw,ph),f,
     {fill:"#294d5d",stroke:"#9fc9d8",strokeWidth:1.2},{shapePresetId});
  }
 }
 return{template:copy(template),objects};
}
// User-saved templates store complete independent building/subobject snapshots.
const custom=[];
function register(spec){
 if(!spec||spec.schema!=="map-building-template-v1"||typeof spec.id!=="string"||
    !/^[a-z0-9_-]{3,80}$/i.test(spec.id)||!Array.isArray(spec.objects)||spec.objects.length<1)
  throw Error("テンプレート形式が不正です");
 if(presets.some(p=>p.id===spec.id))throw Error("標準テンプレートIDは上書きできません");
 if(spec.objects.length>500)throw Error("テンプレートは500オブジェクト以内にしてください");
 const root=spec.objects.find(o=>o.id===spec.rootId);
 if(!root||root.objectType!=="facility"||root.geometry?.type!=="rect")throw Error("建物の親図形が必要です");
 const oldIds=new Set(spec.objects.map(o=>o.id));
 if(oldIds.size!==spec.objects.length)throw Error("テンプレート内IDが重複しています");
 for(const o of spec.objects)if(o.id!==root.id&&!oldIds.has(o.parentId))throw Error("テンプレートに外部の親参照があります");
 const item=copy(spec),pos=custom.findIndex(c=>c.id===item.id);
 if(pos>=0)custom.splice(pos,1,item);else custom.push(item);
 return item;
}
function capture(scene,rootId,info){
 const root=scene?.objects?.find(o=>o.id===rootId);
 if(!root||root.objectType!=="facility"||root.geometry?.type!=="rect")throw Error("施設の四角形を選択してください");
 const subset=[],included=new Set([root.id]);
 let added=true;
 while(added){
  added=false;
  for(const o of scene.objects)if(!included.has(o.id)&&included.has(o.parentId)){included.add(o.id);added=true}
 }
 for(const o of scene.objects)if(included.has(o.id))subset.push(copy(o));
 const id=String(info?.id||"").trim(),name=String(info?.name||root.name||"").trim();
 if(!/^[a-z0-9_-]{3,80}$/i.test(id)||!name)throw Error("英数字ID（3〜80文字）と名称が必要です");
 if(subset.length>500)throw Error("選択した建物には500個超のオブジェクトがあります");
 const position=[root.geometry.x,root.geometry.y];
 // Geometry remains in scene-coordinate units. Relative offsets are restored on placement.
 return{schema:"map-building-template-v1",id,name,category:"custom",description:info?.description||"",
   rootId:root.id,origin:position,originalSize:[root.geometry.width,root.geometry.height],objects:subset};
}
function generateCustom(templateId,options={}){
 const t=custom.find(v=>v.id===templateId);
 if(!t)throw Error("登録済みテンプレートが見つかりません");
 const {prefix,parentId=null,displayLevel=4,x=0,y=0,baseName=t.name}=options;
 if(!prefix)throw Error("建物IDが必要です");
 const idMap=new Map(t.objects.map(o=>[o.id,o.id===t.rootId?prefix:prefix+"_"+o.id.replace(/[^a-z0-9_-]/gi,"_")]));
 if(new Set(idMap.values()).size!==idMap.size)throw Error("ID変換が衝突します");
 const [ox,oy]=t.origin,dx=x-ox,dy=y-oy;
 const out=t.objects.map(src=>{
  const o=copy(src);
  o.id=idMap.get(src.id);
  o.parentId=src.id===t.rootId?parentId:idMap.get(src.parentId);
  o.displayLevel=displayLevel+(src.displayLevel-(t.objects.find(v=>v.id===t.rootId).displayLevel||4));
  const g=o.geometry||{};
  if(g.type==="rect"){g.x+=dx;g.y+=dy}
  if(["circle","ring"].includes(g.type)){g.center[0]+=dx;g.center[1]+=dy}
  if(g.points)for(const p of g.points){p[0]+=dx;p[1]+=dy}
  if(Array.isArray(o.label?.position)){o.label.position[0]+=dx;o.label.position[1]+=dy}
  if(src.id===t.rootId){o.name=baseName;if(o.label?.text)o.label.text=baseName}
  if(o.opening?.wallId&&idMap.has(o.opening.wallId))o.opening.wallId=idMap.get(o.opening.wallId);
  if(o.connection){
   if(Array.isArray(o.connection.fromAnchor)){o.connection.fromAnchor[0]+=dx;o.connection.fromAnchor[1]+=dy}
   if(Array.isArray(o.connection.toAnchor)){o.connection.toAnchor[0]+=dx;o.connection.toAnchor[1]+=dy}
   if(o.connection.id)o.connection.id=prefix+"_connection_"+String(o.connection.id).replace(/[^a-z0-9_-]/gi,"_");
  }
  o.metadata={...o.metadata,templateId:t.id,generated:true};
  return o;
 });
 return{template:{id:t.id,name:t.name,cells:[t.originalSize[0]/(options.spacing||2),t.originalSize[1]/(options.spacing||2)],floors:out[0].floors?.length||1,description:t.description,category:"custom",originalSize:t.originalSize},objects:out};
}
function allPresets(){return[...presets,...custom.map(t=>({id:t.id,name:t.name,category:"custom",description:t.description||"保存した建物",cells:[...t.originalSize],floors:t.objects.find(o=>o.id===t.rootId)?.floors?.length||1,custom:true,originalSize:t.originalSize}))]}
function generateAny(templateId,options){return custom.some(t=>t.id===templateId)?generateCustom(templateId,options):generate(templateId,options)}
global.AAMapBuildingTemplates={presets,custom,allPresets,generate:generateAny,register,capture};

})(window);
