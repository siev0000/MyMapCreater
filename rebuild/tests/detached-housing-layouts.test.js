/* Detached-home regression checks: node rebuild/tests/detached-housing-layouts.test.js */
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const assert=require("node:assert/strict");
const root=path.resolve(__dirname,"..");
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,"building-templates.js"),"utf8"),context);
const library=context.window.AAMapBuildingTemplates;
const ids=["jp_detached_single_2ldk","jp_detached_single_3ldk","jp_detached_standard_3ldk","jp_detached_narrow_3ldk","jp_detached_large_4ldk","jp_detached_urban_3story"];
const shared=(a,b)=>{
 const overlap=(s,e,u,v)=>Math.min(e,v)-Math.max(s,u);
 return (Math.abs(a[2]+a[4]-b[2])<1e-7||Math.abs(b[2]+b[4]-a[2])<1e-7)&&overlap(a[3],a[3]+a[5],b[3],b[3]+b[5])>=2
 ||(Math.abs(a[3]+a[5]-b[3])<1e-7||Math.abs(b[3]+b[5]-a[3])<1e-7)&&overlap(a[2],a[2]+a[4],b[2],b[2]+b[4])>=2;
};
let floors=0;
for(const id of ids){
 const template=library.allPresets().find(t=>t.id===id);
 assert.ok(template&&template.modernPlan,id);
 const [w,h]=template.cells;
 const geometry=library.generate(id,{prefix:"verify_"+id,spacing:2,displayLevel:2});
 const keys=new Set(geometry.objects.map(o=>o.id));
 assert.equal(keys.size,geometry.objects.length,id+" duplicate generated ID");
 assert.equal(geometry.objects.filter(o=>o.objectType==="door"&&o.opening?.external).length,1,id+" exterior entrance");
 let previousStair=null;
 for(let floor=0;floor<template.modernPlan.length;floor++){
  floors++;
  const plan=template.modernPlan[floor],tiles=Array(w*h).fill(0);
  const roomMap=new Map(plan.rooms.map(r=>[r[0],r]));
  for(const [rid,name,x,y,rw,rh] of plan.rooms){
   assert.ok([x,y,rw,rh].every(Number.isInteger),id+" fractional room");
   assert.ok(x>=0&&y>=0&&rw>0&&rh>0&&x+rw<=w&&y+rh<=h,id+" outside "+rid);
   if(name==="トイレ")assert.ok(rw*rh*.25<=2,id+" oversized WC");
   for(let yy=y;yy<y+rh;yy++)for(let xx=x;xx<x+rw;xx++)tiles[yy*w+xx]++;
  }
  assert.ok(tiles.every(n=>n===1),id+" floor "+floor+" has overlaps or gaps");
  const adjacency=new Map(plan.rooms.map(r=>[r[0],[]]));
  for(const [a,b] of plan.doors){
   assert.ok(roomMap.has(a)&&roomMap.has(b)&&shared(roomMap.get(a),roomMap.get(b)),id+" invalid room door "+a+"-"+b);
   adjacency.get(a).push(b);adjacency.get(b).push(a);
  }
  const stairs=plan.items.filter(i=>i[1]==="stair");
  const origin=plan.entry||plan.rooms.find(r=>stairs.some(s=>s[2]>=r[2]&&s[3]>=r[3]&&s[2]+s[4]<=r[2]+r[4]&&s[3]+s[5]<=r[3]+r[5]))?.[0];
  assert.ok(origin&&roomMap.has(origin),id+" missing floor access");
  const visited=new Set([origin]),queue=[origin];
  while(queue.length)for(const next of adjacency.get(queue.shift())||[])if(!visited.has(next)){visited.add(next);queue.push(next)}
  assert.equal(visited.size,plan.rooms.length,id+" inaccessible rooms");
  for(const [name,kind,x,y,fw,fh] of plan.items)
   assert.ok(plan.rooms.some(r=>x>=r[2]&&y>=r[3]&&x+fw<=r[2]+r[4]&&y+fh<=r[3]+r[5]),id+" item crosses rooms: "+name);
  if(floor>0)assert.equal(JSON.stringify(stairs.map(s=>s.slice(2))),JSON.stringify(previousStair),id+" stairs not aligned");
  previousStair=stairs.map(s=>s.slice(2));
 }
 console.log("PASS",id,template.modernPlan.length,"floors",geometry.objects.length,"objects");
}
console.log("PASS",ids.length,"detached homes",floors,"floorplans");