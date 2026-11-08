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
 const entranceWidth=template.id==="warehouse"?4:2,start=(nX-entranceWidth)/2;
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
   const gapStart=(nX-2)/2;
   wall("partition_l_"+f,f,[[0,mid],[gapStart,mid]]);
   wall("partition_r_"+f,f,[[gapStart+2,mid],[nX,mid]]);
   door("partition_door_"+f,f,[[gapStart,mid],[gapStart+2,mid]]);
  }
  if(stair){
   const sx=nX-5,sy=nY-7;
   base("stair_"+f,i+1<template.floors?"上り階段":"下り階段","stair",rect(sx,sy,4,6),f,
    {fill:"rgba(75,118,137,.5)",stroke:"#acd5df",strokeWidth:1.5},
    {shapePresetId:"stair",connection:{id:id("stair_main"),fromFloorId:f,
      toFloorId:floorNames[i+1]?.id||floorNames[i-1].id,
      fromAnchor:at(sx+2,sy+3),toAnchor:at(sx+2,sy+3),direction:i+1<template.floors?"up":"down"}});
  }
  if(template.id==="warehouse"){
    base("storage_"+f,"収納区画","object",rect(1,1,5,4),f,
     {fill:"#2b4856",stroke:"#9ec5ca",strokeWidth:1}, {shapePresetId:"storage_container"});
  }else if(template.id==="shop"){
    base("counter_"+f,"カウンター","object",rect(2,2,5,2),f,
     {fill:"#375666",stroke:"#9ec5ca",strokeWidth:1},{shapePresetId:"table"});
  }else if(template.id==="workshop"){
    base("workbench_"+f,"作業台","object",rect(2,2,6,3),f,
     {fill:"#375666",stroke:"#9ec5ca",strokeWidth:1},{shapePresetId:"workbench"});
  }else if(template.id==="small_house"||template.id==="row_house"||template.id==="apartment"){
    base("bed_"+f,"ベッド","object",rect(2,2,3,5),f,
     {fill:"#375666",stroke:"#9ec5ca",strokeWidth:1},{shapePresetId:"bed"});
  }
 }
 return{template:copy(template),objects};
}
global.AAMapBuildingTemplates={presets,generate};
})(window);
