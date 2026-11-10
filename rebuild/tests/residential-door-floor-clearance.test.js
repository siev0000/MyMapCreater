/* node rebuild/tests/residential-door-floor-clearance.test.js */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"..","building-templates.js"),"utf8");
const viewerSource=fs.readFileSync(path.join(__dirname,"..","map-viewer.js"),"utf8");
const ctx={window:{}};vm.runInNewContext(source,ctx);
const library=ctx.window.AAMapBuildingTemplates;
const templates=library.allPresets().filter(x=>x.modernPlan);
let doorsChecked=0,stairHoles=0;
for(const template of templates){
 const spacing=2.7;
 const objs=library.generate(template.id,{prefix:"check_"+template.id,spacing}).objects;
 for(let z=0;z<template.floors;z++){
  const floor=(z+1)+"F",slabs=objs.filter(o=>o.floorId===floor&&o.objectType==="slab");
  const stairs=objs.filter(o=>o.floorId===floor&&o.objectType==="stair");
  const squareMetres=template.cells[0]*template.cells[1]*.25;
  const floorArea=slabs.reduce((sum,o)=>sum+
   o.geometry.width*o.geometry.height/spacing/spacing*.25,0);
  const hole=z>0&&stairs.length===1?
   stairs[0].geometry.width*stairs[0].geometry.height/spacing/spacing*.25:0;
  assert.ok(Math.abs(floorArea+hole-squareMetres)<1e-7,template.id+" "+floor+" slab-area mismatch");
  for(const slab of slabs)for(const stair of z>0?stairs:[]){
   const a=slab.geometry,b=stair.geometry;
   const overlaps=a.x<b.x+b.width-1e-7&&a.x+a.width>b.x+1e-7&&
    a.y<b.y+b.height-1e-7&&a.y+a.height>b.y+1e-7;
   assert.ok(!overlaps,template.id+" "+floor+" slab obstructs stair opening");
  }
  if(hole>0)stairHoles++;
 }
 for(const door of objs.filter(o=>o.objectType==="door")){
  doorsChecked++;
  assert.equal(door.door?.state,"closed",template.id+" door must start closed");
  assert.ok([70,75,80,90].includes(door.metadata.openingWidthCm),template.id+" width");
  if(door.metadata.swingFurnitureInterferenceCount!==undefined)
   assert.equal(door.metadata.swingFurnitureInterferenceCount,0,
    template.id+" no unobstructed swing or valid sliding pocket");
  assert.ok(["fixture-rectangles-only","sliding-parked-leaf-clear-of-fixtures",undefined]
   .includes(door.metadata.swingChecked),template.id+" clearance status");
  if(door.door.type!=="sliding")
   assert.equal(door.metadata.swingDoorInterferenceCount,0,
    template.id+" hinged door must not sweep across another hinged door");

 }
}
assert.ok(viewerSource.includes("doorOpenOverrides.set(hit.id,nextOpen)"),
 "Canvas click should toggle door state");
assert.ok(viewerSource.includes("doorIsOpen(obj)"),"Door renderer must use live state");
assert.ok(viewerSource.includes("doors[doors.length-1]"),
 "Door hit test must not be masked by a room");
const minimumPassageM=0.8;
for(const template of templates)for(const [index,plan] of template.modernPlan.entries()){
 for(const room of plan.rooms){
  if(!/(廊下|ホール|玄関|階段|踊り場)/.test(room[1]))continue;
  const narrower=Math.min(room[4],room[5])*.5;
  assert.ok(narrower>=minimumPassageM,
   template.id+" floor "+(index+1)+" has narrow circulation zone "+room[1]);
 }
}
console.log("PASS",templates.length,"modern residential templates,",
 doorsChecked,"doors,",stairHoles,"upper-floor openings");
