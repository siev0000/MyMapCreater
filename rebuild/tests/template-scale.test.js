/* Validate 0.5 m/cell geometry of housing templates.
   node rebuild/tests/template-scale.test.js */
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"..","building-templates.js"),"utf8"),ctx);
const lib=ctx.window.AAMapBuildingTemplates;
for(const t of lib.allPresets().filter(t=>t.id.startsWith("jp_detached_"))){
 assert.equal(t.designStatus,"draft-unverified",t.id+" must not claim reference fidelity");
 for(const unitsPerMeter of [1,4,10]){
  const spacing=unitsPerMeter*.5;
  const result=lib.generate(t.id,{prefix:"house",x:200,y:300,spacing,displayLevel:3});
  const building=result.objects.find(o=>o.id==="house");
  const mWidth=building.geometry.width/unitsPerMeter;
  const mHeight=building.geometry.height/unitsPerMeter;
  assert.ok(Math.abs(mWidth-t.cells[0]*.5)<1e-9,t.id+" width in metres");
  assert.ok(Math.abs(mHeight-t.cells[1]*.5)<1e-9,t.id+" depth in metres");
  const stair=result.objects.filter(o=>o.objectType==="stair");
  assert.equal(stair.length,t.floors===1?0:t.floors,t.id+" stair count");
 }
 console.log("PASS",t.id,t.cells[0]*.5+"m × "+t.cells[1]*.5+"m");
}
console.log("PASS house unit scale across georeferences");
