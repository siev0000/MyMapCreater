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
// Mechanical housing and high-density dormancy are reusable layout proposals.
// A pod is an individually selectable object; no actual residents are auto-created.
const communalLayouts=[
 ["machine_apartment_small","機械共同住宅・小型",[22,18],2,"split","個室と共用充電・登録設備を備える小型集合住居","machine_housing","housing",2],
 ["machine_apartment_block","機械共同住宅・中型",[32,24],3,"cross","複数区画と各階の共有設備を持つ集合住居","machine_housing","housing",4],
 ["machine_residence_tower","機械居住塔・高層",[36,28],5,"cross","多層居住区と共用休止・補給設備","machine_housing","housing",6],
 ["machine_pod_unit","個人休眠ポッド区画",[18,14],1,"open","少数の個人休眠ポッドと管理端末","machine_dormancy","pods",4],
 ["machine_pod_hall","量産型休眠ホール",[34,24],1,"open","ポッド列と中央通路を備える量産型休眠区画","machine_dormancy","pods",16],
 ["machine_pod_block","休眠ポッド棟",[36,28],3,"open","複数階の休眠ポッドと保守・管理スペース","machine_dormancy","pods",20],
 ["machine_pod_tower","高密度休眠施設",[40,32],5,"open","大量ポッドを持つ多階層休眠施設","machine_dormancy","pods",28],
 ["machine_fuel_station_large","大型燃料補給所",[32,24],1,"front","補給列と制御端末を備える大型施設","machine_support","fuel",0],
 ["machine_terminal_center","端末・登録センター",[30,22],2,"cross","登録・通信・状態照会の端末を備える施設","machine_support","terminal",0],
 ["machine_charge_center","共用充電センター",[32,24],1,"open","多数の充電台と管理端末を持つ施設","machine_support","charging",0]
];
for(const [id,name,cells,floors,layout,description,category,facilityMode,podsPerFloor] of communalLayouts)
 presets.push({id,name,cells,floors,layout,description,category,facilityMode,podsPerFloor,worldStyle:"machine",entranceSide:"center"});

/* Modern Japanese housing: original playable layouts informed by typical 1R/1K/LDK
   arrangements (UR Housing / LIFULL), not tracings of any advertised property. */
const modernHousing=[
 {id:"jp_studio_1r",name:"現代日本・ワンルーム1R",cells:[10,12],floors:1,
  description:"居室とキッチンが一体の1R。玄関・ユニットバス・収納を備える。",
  plans:[{rooms:[
   ["main","居室・キッチン",0,0,10,8],["bath","ユニットバス",0,8,4,4],["hall","玄関",4,8,6,4]],
   doors:[["main","hall"],["bath","hall"]],entry:"hall",
   items:[["キッチン","kitchen",1,1,3,1],["ベッド","bed",7,1,2,4],
    ["テーブル","table",4,5,2,1.5],["浴槽","bath",.75,9,2,2],
    ["トイレ","toilet",2.7,10.5,.8,1],["玄関収納","cabinet",7,10.5,2,1]]}]},
 {id:"jp_apartment_1k",name:"現代日本・アパート1K",cells:[10,14],floors:1,
  description:"居室とキッチンを扉で分離した単身者向け1K。",
  plans:[{rooms:[
   ["main","居室",0,0,10,9],["bath","浴室・トイレ",0,9,4,5],["hall","キッチン・玄関",4,9,6,5]],
   doors:[["main","hall"],["bath","hall"]],entry:"hall",
   items:[["ベッド","bed",1,1,3,5],["収納","cabinet",7,1,2,1],
    ["キッチン","kitchen",5,10,3,1],["浴槽","bath",.75,10,2,2],
    ["トイレ","toilet",2.75,12,.8,1],["玄関収納","cabinet",7,12,2,1]]}]},
 {id:"jp_mansion_1ldk",name:"現代日本・マンション1LDK",cells:[14,16],floors:1,
  description:"LDKと独立寝室。玄関ホールから洗面・浴室・トイレへアクセスする。",
  plans:[{rooms:[
   ["bed","寝室",0,0,6,11],["ldk","LDK",6,0,8,11],
   ["bath","浴室・洗面",0,11,5,3],["wc","トイレ",0,14,5,2],["hall","玄関・廊下",5,11,9,5]],
   doors:[["bed","ldk"],["ldk","hall"],["bath","hall"],["wc","hall"]],entry:"hall",
   items:[["ベッド","bed",1,2,3,5],["収納","cabinet",1,8,3,1],
    ["キッチン","kitchen",7,1,4,1],["食卓","table",10,5,2,2],["ソファ","sofa",7,8,3,1.5],
    ["浴槽","bath",.5,11.5,2,2],["洗面台","sink",3,11.5,1,1],
    ["トイレ","toilet",1,14.5,1.5,1],["玄関収納","cabinet",11,14,2,1]]}]},
 {id:"jp_mansion_2ldk",name:"現代日本・マンション2LDK",cells:[18,20],floors:1,
  description:"2室の個室とLDK。居室を廊下から独立して利用できる家族向け住戸。",
  plans:[{rooms:[
   ["bed1","寝室",0,0,7,10],["bed2","洋室",7,0,6,10],["ldk","LDK",13,0,5,14],
   ["corridor","共用廊下",0,10,13,4],["bath","浴室・洗面",0,14,5,4],
   ["wc","トイレ",0,18,5,2],["hall","玄関ホール",5,14,13,6]],
   doors:[["bed1","corridor"],["bed2","corridor"],["ldk","corridor"],
    ["corridor","hall"],["bath","hall"],["wc","hall"],["ldk","hall"]],entry:"hall",
   items:[["ベッド","bed",1,2,3,5],["ベッド","bed",8,2,3,5],
    ["キッチン","kitchen",14,1,3,1],["食卓","table",14,5,3,2],["ソファ","sofa",14,9,3,1.5],
    ["浴槽","bath",.7,15,2,2],["洗面台","sink",3.3,15,1,1],
    ["トイレ","toilet",1,18.5,1.5,1],["収納棚","cabinet",6,18,3,1]]}]},
 {id:"jp_mansion_3ldk",name:"現代日本・マンション3LDK",cells:[20,22],floors:1,
  description:"LDKと個室3室。共用廊下、独立した水回りを備えたファミリー住戸。",
  plans:[{rooms:[
   ["bed1","主寝室",0,0,7,9],["bed2","洋室A",7,0,7,9],["bed3","洋室B",14,0,6,9],
   ["corridor","廊下",0,9,20,4],["bath","浴室・洗面",0,13,5,5],
   ["wc","トイレ",0,18,5,4],["hall","玄関ホール",5,13,2,9],["ldk","LDK",7,13,13,9]],
   doors:[["bed1","corridor"],["bed2","corridor"],["bed3","corridor"],
    ["corridor","hall"],["corridor","ldk"],["bath","hall"],["wc","hall"],["hall","ldk"]],entry:"hall",
   items:[["ベッド","bed",1,2,3,5],["ベッド","bed",9,2,3,5],["ベッド","bed",15,2,3,5],
    ["キッチン","kitchen",8,14,4,1],["食卓","table",13,15,3,2],["ソファ","sofa",15,19,3,1.5],
    ["浴槽","bath",.75,14,2,2],["洗面台","sink",3.3,14,1,1],
    ["トイレ","toilet",1,19,1.5,1],["収納棚","cabinet",8,20,3,1]]}]},
 {id:"jp_detached_2story",name:"現代日本・2階建て戸建て",cells:[18,18],floors:2,
  description:"1階はLDK・水回り・玄関、2階は寝室3室とホールを配置した2階建て。",
  plans:[
   {rooms:[["bath","浴室",0,0,5,5],["wash","洗面・脱衣",5,0,5,5],
     ["wc","トイレ",0,5,5,4],["hall","廊下・階段",5,5,5,13],
     ["entry","玄関・収納",0,9,5,9],["ldk","LDK",10,0,8,18]],
    doors:[["bath","wash"],["wash","hall"],["wc","hall"],["entry","hall"],["hall","ldk"]],entry:"entry",
    items:[["浴槽","bath",1,1,2,3],["洗面台","sink",6,1,2,1],
     ["トイレ","toilet",1,6,1.5,1.5],["収納棚","cabinet",1,11,3,1],
     ["階段","stair",6,14,3,3],["キッチン","kitchen",11,1,4,1],
     ["食卓","table",12,7,3,2],["ソファ","sofa",12,12,4,2]]},
   {rooms:[["bed1","主寝室",0,0,7,10],["bed2","洋室A",7,0,6,10],
     ["bed3","洋室B",13,0,5,10],["hall","2階ホール・階段",0,10,18,8]],
    doors:[["bed1","hall"],["bed2","hall"],["bed3","hall"]],
    items:[["ベッド","bed",1,2,3,5],["ベッド","bed",8,2,3,5],
     ["ベッド","bed",14,2,3,5],["階段","stair",6,14,3,3],
     ["収納棚","cabinet",13,12,3,1]]}
  ]}
];
for(const plan of modernHousing)presets.push({
 id:plan.id,name:plan.name,cells:plan.cells,floors:plan.floors,layout:"custom-modern",
 category:"modern_housing",era:"modern-jp",use:"housing",
 description:plan.description,planSource:"original-layout-inspired-by-UR-LIFULL",
 modernPlan:plan.plans
});
function generateModern(template,options){
 const {prefix,parentId=null,displayLevel=4,x=0,y=0,spacing=2,baseName=template.name}=options;
 if(typeof prefix!=="string"||!prefix||!Number.isFinite(spacing)||spacing<=0)throw Error("現代住宅テンプレートの配置指定が不正");
 const [w,h]=template.cells,objs=[],at=(a,b)=>[x+a*spacing,y+b*spacing];
 const rect=(a,b,c,d)=>({type:"rect",x:x+a*spacing,y:y+b*spacing,width:c*spacing,height:d*spacing});
 const line=(a,b,c,d)=>({type:"polyline",points:[at(a,b),at(c,d)]});
 const floors=template.modernPlan.map((_,i)=>({id:(i+1)+"F",label:(i+1)+"階",elevation:i*3,height:3}));
 const main={id:prefix,name:baseName,parentId,displayLevel,objectType:"facility",layer:"subregions",zIndex:30,
  geometry:rect(0,0,w,h),floors,visible:true,selectable:true,
  style:{fill:"rgba(90,143,153,.12)",stroke:"#a6cbd0",strokeWidth:1.4},
  label:{visible:true,text:baseName,position:at(w/2,h/2),fontSize:11},
  detail:template.description,metadata:{templateId:template.id,generated:true,era:"modern-jp"}};
 objs.push(main);
 let count=0;
 const push=(name,kind,geometry,f,style,extra={})=>{
  const o={id:prefix+"_modern_"+(++count),name,parentId:prefix,displayLevel:displayLevel+1,
   floorId:f,objectType:kind,layer:kind==="wall"||kind==="door"?"walls":"structures",
   zIndex:kind==="slab"?29:kind==="region"?31:kind==="wall"?47:kind==="door"?49:kind==="stair"?46:42,
   geometry,visible:true,selectable:kind!=="slab"&&kind!=="wall",
   style,label:{visible:kind==="region",text:name,fontSize:8},
   detail:name+"（現代日本の住宅用テンプレート）",
   metadata:{templateId:template.id,generated:true},...extra};
  if(kind==="door"){o.door={hinge:"start",swing:"inward",state:"closed",swingSide:"left"};
   o.opening={kind:"interior",width:geometry.points?Math.hypot(
    geometry.points[1][0]-geometry.points[0][0],geometry.points[1][1]-geometry.points[0][1]):0,external:false};}
  objs.push(o);return o;
 };
 for(let z=0;z<template.modernPlan.length;z++){
  const plan=template.modernPlan[z],floor=floors[z].id;
  push("床面 "+floor,"slab",rect(0,0,w,h),floor,{fill:"rgba(48,81,88,.64)",stroke:null});
  const rooms=plan.rooms.map(([id,name,rx,ry,rw,rh])=>({id,name,x:rx,y:ry,w:rw,h:rh}));
  const roomMap=new Map(rooms.map(r=>[r.id,r]));
  const edgeH=new Map(),edgeV=new Map(),blockedH=new Set(),blockedV=new Set();
  const addEdge=(map,key)=>map.set(key,true);
  for(const room of rooms){
   for(let ix=room.x;ix<room.x+room.w;ix++){
    addEdge(edgeH,ix+","+room.y);addEdge(edgeH,ix+","+(room.y+room.h));
   }
   for(let iy=room.y;iy<room.y+room.h;iy++){
    addEdge(edgeV,room.x+","+iy);addEdge(edgeV,(room.x+room.w)+","+iy);
   }
   const zone=push(room.name,"region",rect(room.x,room.y,room.w,room.h),floor,
    {fill:z%2?"rgba(69,115,124,.11)":"rgba(81,122,133,.12)",stroke:null},
    {shapePresetId:"room_zone",detail:room.name+"。部屋の用途を示す領域です。"});
   zone.label.position=at(room.x+room.w/2,room.y+room.h/2);
  }
  const doors=[];
  const shared=(a,b)=>{
   if(Math.abs(a.x+a.w-b.x)<1e-9||Math.abs(b.x+b.w-a.x)<1e-9)
    return{direction:"V",fixed:Math.abs(a.x+a.w-b.x)<1e-9?a.x+a.w:b.x+b.w,
     lo:Math.max(a.y,b.y),hi:Math.min(a.y+a.h,b.y+b.h)};
   if(Math.abs(a.y+a.h-b.y)<1e-9||Math.abs(b.y+b.h-a.y)<1e-9)
    return{direction:"H",fixed:Math.abs(a.y+a.h-b.y)<1e-9?a.y+a.h:b.y+b.h,
     lo:Math.max(a.x,b.x),hi:Math.min(a.x+a.w,b.x+b.w)};
   return null;
  };
  for(const [aId,bId] of plan.doors){
   const a=roomMap.get(aId),b=roomMap.get(bId),join=a&&b&&shared(a,b);
   if(!join||join.hi-join.lo<2)throw Error("間仕切り接続が不正："+template.id+"/"+floor+"/"+aId+"-"+bId);
   const openingWidth=2,start=join.lo+Math.floor((join.hi-join.lo-openingWidth)/2);
   for(let d=start;d<start+openingWidth;d++)
    (join.direction==="H"?blockedH:blockedV).add(
      join.direction==="H"?d+","+join.fixed:join.fixed+","+d);
   doors.push({direction:join.direction,fixed:join.fixed,start,external:false});
  }
  if(plan.entry){
   const entry=roomMap.get(plan.entry);
   if(!entry||entry.y+entry.h!==h||entry.w<2)throw Error("外部入口が不正："+template.id);
   const start=entry.x+Math.floor((entry.w-2)/2);
   blockedH.add(start+","+h);blockedH.add((start+1)+","+h);
   doors.push({direction:"H",fixed:h,start,external:true});
  }
  // Emit maximal, collinear wall segments; each doorway is a real wall gap.
  for(const [map,blocked,direction] of [[edgeH,blockedH,"H"],[edgeV,blockedV,"V"]]){
   const coordinates=[...map.keys()].filter(k=>!blocked.has(k)).map(k=>k.split(",").map(Number));
   const groups=new Map();
   for(const [a,b] of coordinates){
    const fixed=direction==="H"?b:a,pos=direction==="H"?a:b;
    if(!groups.has(fixed))groups.set(fixed,[]);
    groups.get(fixed).push(pos);
   }
   for(const [fixed,positions] of groups){
    positions.sort((a,b)=>a-b);
    for(let i=0;i<positions.length;){
     let first=positions[i],end=first+1;i++;
     while(i<positions.length&&positions[i]===end){end++;i++}
     push("壁","wall",direction==="H"?line(first,fixed,end,fixed):line(fixed,first,fixed,end),floor,
      {fill:null,stroke:"#d3e6e8",strokeWidth:2});
    }
   }
  }
  for(const door of doors){
   const g=door.direction==="H"?line(door.start,door.fixed,door.start+2,door.fixed):
    line(door.fixed,door.start,door.fixed,door.start+2);
   const o=push(door.external?"玄関扉":"室内扉","door",g,floor,
    {fill:null,stroke:"#e8b97a",strokeWidth:2},
    {detail:door.external?"住戸の出入口です。":"区画をつなぐ室内扉です。"});
   if(door.external){o.opening.kind="entrance";o.opening.external=true}
  }
  for(const [name,shape,fx,fy,fw,fh] of plan.items){
   if(fx<0||fy<0||fx+fw>w||fy+fh>h)throw Error("設置物が外周を越える："+name);
   const stair=shape==="stair";
   const extra={shapePresetId:shape,detail:name+"。住戸の生活用設備です。"};
   if(stair){
    extra.connection={id:prefix+"_stair_main",fromFloorId:floor,
     toFloorId:floors[z+1]?.id||floors[z-1]?.id,
     fromAnchor:at(fx+fw/2,fy+fh/2),toAnchor:at(fx+fw/2,fy+fh/2),
     direction:z<template.modernPlan.length-1?"up":"down"};
   }
   push(name,stair?"stair":"object",rect(fx,fy,fw,fh),floor,
    {fill:stair?"rgba(75,118,137,.5)":"rgba(46,91,110,.7)",stroke:"#9ec5ca",strokeWidth:1},extra);
  }
 }
 return{template:copy(template),objects:objs};
}

const copy=x=>JSON.parse(JSON.stringify(x));
function generate(templateId,options={}){
 const template=presets.find(t=>t.id===templateId);
 if(!template)throw Error("不明な建物テンプレート: "+templateId);
 if(template.modernPlan)return generateModern(template,options);
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
   // Keep stairs within the south-right zone, entirely past the partition wall.
   const partitionY=template.layout==="front"?Math.round(nY*.67):mid;
   const sx=nX-5,sy=partitionY+1,stairH=Math.min(6,nY-partitionY-2);
   base("stair_"+f,i+1<template.floors?"上り階段":"下り階段","stair",rect(sx,sy,4,stairH),f,
    {fill:"rgba(75,118,137,.5)",stroke:"#acd5df",strokeWidth:1.5},
    {shapePresetId:"stair",connection:{id:id("stair_main"),fromFloorId:f,
      toFloorId:floorNames[i+1]?.id||floorNames[i-1].id,
      fromAnchor:at(sx+2,sy+stairH/2),toAnchor:at(sx+2,sy+stairH/2),direction:i+1<template.floors?"up":"down"}});
  }
  if(template.worldStyle!=="machine"&&template.category==="warehouse"){
    base("storage_"+f,"収納区画","object",rect(1,1,5,4),f,
     {fill:"#2b4856",stroke:"#9ec5ca",strokeWidth:1}, {shapePresetId:"storage_container"});
  }else if(template.worldStyle!=="machine"&&template.category==="shop"){
    base("counter_"+f,"カウンター","object",rect(2,2,5,2),f,
     {fill:"#375666",stroke:"#9ec5ca",strokeWidth:1},{shapePresetId:"table"});
  }else if(template.worldStyle!=="machine"&&template.category==="workshop"){
    base("workbench_"+f,"作業台","object",rect(2,2,6,3),f,
     {fill:"#375666",stroke:"#9ec5ca",strokeWidth:1},{shapePresetId:"workbench"});
  }else if(template.worldStyle!=="machine"&&["small_house","row_house","apartment"].includes(template.category)){
    base("bed_"+f,"ベッド","object",rect(2,Math.max(1,Math.min(2,(template.layout==="front"?Math.round(nY*.67):mid)-5)),3,5),f,
     {fill:"#375666",stroke:"#9ec5ca",strokeWidth:1},{shapePresetId:"bed"});
  }
  if(template.worldStyle==="machine"&&!template.facilityMode){
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
  if(template.facilityMode){
   const addDevice=(key,name,px,py,pw,ph,shapePresetId,extra={})=>
    base("system_"+key+"_"+f,name,"object",rect(px,py,pw,ph),f,
     {fill:"#294d5d",stroke:"#9fc9d8",strokeWidth:1.2},
     {shapePresetId,metadata:{templateId:template.id,generated:true,role:"facility-device"},...extra});
   const mode=template.facilityMode;
   if(mode==="housing"||mode==="pods"){
    const reservedRight=stair?8:2;
    const podW=2.2,podH=3.3,stepX=3,stepY=4.8;
    const left=2,right=nX-reservedRight-2;
    // Keep the centre aisle clear: alternating banks at front/back.
    const bankTop=2,bankBottom=Math.round(nY*.55);
    const available=Math.max(1,Math.floor((right-left-podW)/stepX)+1);
    const desired=template.podsPerFloor;
    let number=0;
    for(const [bank,rowY] of [["front",bankTop],["rear",bankBottom]]){
     for(let col=0;col<available&&number<desired;col++){
      const px=left+col*stepX,py=rowY;
      if(py+podH>nY-4||px+podW>right)break;
      number++;
      const group=bank+"_"+f;
      base("pod_"+f+"_"+String(number).padStart(3,"0"),
       "個人休眠ポッド "+number,"object",rect(px,py,podW,podH),f,
       {fill:"#244c59",stroke:"#9fc9d8",strokeWidth:1},
       {shapePresetId:"dormancy_pod",podGroup:group,
        metadata:{templateId:template.id,generated:true,role:"dormancy-pod",podIndex:number}});
     }
    }
    if(mode==="pods"&&number<desired){
     // Longer facility templates may use further banks, preserving a walking strip.
     const nextY=Math.min(nY-7,Math.round(nY*.32));
     for(let col=0;col<available&&number<desired;col++){
      const px=left+col*stepX;
      if(nextY+podH>=bankBottom-1||px+podW>right)break;
      number++;
      base("pod_"+f+"_"+String(number).padStart(3,"0"),
       "個人休眠ポッド "+number,"object",rect(px,nextY,podW,podH),f,
       {fill:"#244c59",stroke:"#9fc9d8",strokeWidth:1},
       {shapePresetId:"dormancy_pod",podGroup:"middle_"+f,
        metadata:{templateId:template.id,generated:true,role:"dormancy-pod",podIndex:number}});
     }
    }
    if(mode==="pods"&&number<desired){
     // Last bank near the entrance, with its own walking gap.
     const lastY=nY-7;
     for(let col=0;col<available&&number<desired;col++){
      const px=left+col*stepX;
      if(px+podW>right||lastY<=bankBottom+podH+1)break;
      number++;
      base("pod_"+f+"_"+String(number).padStart(3,"0"),
       "個人休眠ポッド "+number,"object",rect(px,lastY,podW,podH),f,
       {fill:"#244c59",stroke:"#9fc9d8",strokeWidth:1},
       {shapePresetId:"dormancy_pod",podGroup:"south_"+f,
        metadata:{templateId:template.id,generated:true,role:"dormancy-pod",podIndex:number}});
     }
    }
    addDevice("management","休眠管理端末",nX-4,2,3,3,"terminal_device");
    // Fuel/charging are separate systems and not embedded in each dormancy pod.
    if(mode==="housing")addDevice("charging","共用充電設備",nX-7,2,3,3,"charging_station");
   }else{
    const kind=mode==="fuel"?"fuel_dispenser":mode==="charging"?"charging_station":"terminal_device";
    const cols=mode==="terminal"?3:4;
    const rows=mode==="terminal"?2:2;
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const px=template.layout==="cross"&&col===2?Math.round(nX*.48)+2:2+col*5,py=2+row*6;
      addDevice("station_"+row+"_"+col,mode==="fuel"?"燃料補給機":mode==="charging"?"充電設備":"登録端末",px,py,3,4,kind);
    }
    addDevice("management","管理端末",nX-7,2,4,3,"terminal_device");
   }
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
 if(root.interiorSource&&subset.length===1)throw Error("建物内部の読み込みが完了してからテンプレート登録してください");
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
 return{template:{id:t.id,name:t.name,cells:[t.originalSize[0]/(options.spacing||2),t.originalSize[1]/(options.spacing||2)],floors:out[0].floors?.length||1,description:t.description,category:"custom",era:t.era||"common",use:t.use||"special",originalSize:t.originalSize},objects:out};
}
function allPresets(){return[...presets,...custom.map(t=>({id:t.id,name:t.name,category:"custom",description:t.description||"保存した建物",cells:[...t.originalSize],floors:t.objects.find(o=>o.id===t.rootId)?.floors?.length||1,custom:true,era:t.era||"common",use:t.use||"special",originalSize:t.originalSize}))]}
function generateAny(templateId,options){return custom.some(t=>t.id===templateId)?generateCustom(templateId,options):generate(templateId,options)}
global.AAMapBuildingTemplates={presets,custom,allPresets,generate:generateAny,register,capture};

})(window);
