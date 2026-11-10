/* Detached-home regression checks: node rebuild/tests/detached-housing-layouts.test.js */
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const assert=require("node:assert/strict");
const root=path.resolve(__dirname,"..");
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,"building-templates.js"),"utf8"),context);
const library=context.window.AAMapBuildingTemplates;
const ids=["jp_detached_2story","jp_detached_single_2ldk","jp_detached_single_3ldk","jp_detached_standard_3ldk","jp_detached_narrow_3ldk","jp_detached_large_4ldk","jp_detached_urban_3story"];
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
  const generatedStairs=geometry.objects.filter(o=>o.objectType==="stair"&&o.floorId===(floor+1)+"F");
  assert.equal(generatedStairs.length,stairs.length,id+" stair object count");
  if(id==="jp_detached_urban_3story"){
   const expected=floor===1?2:1;
   assert.equal(stairs.length,expected,"Urban townhouse: 2F has two independent stairs");
   const landing=roomMap.get("landing");
   assert.ok(landing,"All urban floors need a shared landing");
   for(const obj of generatedStairs){
    assert.equal(obj.stairDesign?.type,"switchback-flight","Separate stair flight required");
    const pair=obj.stairDesign?.pairId,direction=obj.stairDesign?.direction;
    const expectedDestination=direction==="up"?String(floor+2)+"F":String(floor)+"F";
    assert.equal(obj.connection.toFloorId,expectedDestination);
    const matches=stairs.find(x=>x[6]===pair&&x[7]===direction);
    assert.ok(matches,"Stair metadata must match a unique source item");
    assert.ok(Math.abs(obj.stairDesign.footprintWidthM-1.8)<1e-8);
    assert.ok(Math.abs(obj.stairDesign.footprintDepthM-2.8)<1e-8);
   }
   const openConnections=plan.doors.filter(x=>x[2]==="open"&&x[1]==="landing");
   assert.equal(openConnections.length,stairs.length,
    "Every separate flight needs a walkable landing opening");
   for(const [source] of openConnections){
    const zone=roomMap.get(source);
    assert.ok(zone,"Stair zone must exist");
    const matching=stairs.find(x=>x[2]>=zone[2]&&x[3]>=zone[3]&&
     x[2]+x[4]<=zone[2]+zone[4]&&x[3]+x[5]<=zone[3]+zone[5]);
    assert.ok(matching,"Opening must serve a real staircase");
   }
  }else if(stairs.length){
   assert.equal(stairs.length,1,id+" conventional stair count");
   const d=generatedStairs[0].stairDesign;
   assert.equal(d?.type,"switchback");
   assert.deepEqual(Array.from(d.path),["bottom-left","top-left","top-landing","top-right","bottom-right"]);
   assert.equal(d.entrySide,"bottom-left");assert.equal(d.turnSide,"top");assert.equal(d.exitSide,"bottom-right");
   assert.equal(d.flightWidthM,.8);
   assert.ok(Math.abs(d.footprintWidthM-1.8)<1e-8);
   assert.ok(Math.abs(d.footprintDepthM-2.8)<1e-8);
  }
  const origin=plan.entry||plan.rooms.find(r=>stairs.some(s=>s[2]>=r[2]&&s[3]>=r[3]&&s[2]+s[4]<=r[2]+r[4]&&s[3]+s[5]<=r[3]+r[5]))?.[0];
  assert.ok(origin&&roomMap.has(origin),id+" missing floor access");
  const visited=new Set([origin]),queue=[origin];
  while(queue.length)for(const next of adjacency.get(queue.shift())||[])if(!visited.has(next)){visited.add(next);queue.push(next)}
  assert.equal(visited.size,plan.rooms.length,id+" inaccessible rooms");
  for(const [name,kind,x,y,fw,fh] of plan.items)
   assert.ok(plan.rooms.some(r=>x>=r[2]&&y>=r[3]&&x+fw<=r[2]+r[4]&&y+fh<=r[3]+r[5]),id+" item crosses rooms: "+name);
  if(floor>0&&id!=="jp_detached_urban_3story")assert.equal(JSON.stringify(stairs.map(s=>s.slice(2))),JSON.stringify(previousStair),id+" stairs not aligned");
  previousStair=stairs.map(s=>s.slice(2));
 }
 if(id==="jp_detached_urban_3story"){
  const doors=geometry.objects.filter(o=>o.objectType==="door");
  const roomDoors=doors.filter(o=>!o.opening?.external);
  assert.ok(roomDoors.filter(o=>o.door?.type==="sliding").length>=8,"Townhouse indoor doors should avoid swing congestion");
  const segments=geometry.objects.filter(o=>o.objectType==="stair");
  assert.equal(segments.length,4,"One stair on 1F/3F and two on 2F");
  for(const pair of ["1F-2F","2F-3F"]){
   const both=segments.filter(o=>o.stairDesign.pairId===pair);
   assert.equal(both.length,2,"Each physical pair must appear on both connected floors");
   assert.equal(JSON.stringify(both[0].geometry),JSON.stringify(both[1].geometry),
    "The same flight must align between the two connected floors");
   assert.notEqual(both[0].floorId,both[1].floorId);
  }
 }
 console.log("PASS",id,template.modernPlan.length,"floors",geometry.objects.length,"objects");
}
console.log("PASS",ids.length,"detached homes",floors,"floorplans");