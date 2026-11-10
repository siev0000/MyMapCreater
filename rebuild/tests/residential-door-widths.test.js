/* node rebuild/tests/residential-door-widths.test.js */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const w={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"..","building-templates.js"),"utf8"),w);
let checked=0,doorsTotal=0;
for(const t of w.window.AAMapBuildingTemplates.allPresets().filter(x=>x.modernPlan)){
 const spacing=3.7, objects=w.window.AAMapBuildingTemplates.generate(t.id,{prefix:"verify",spacing}).objects;
 const doors=objects.filter(o=>o.objectType==="door"),walls=objects.filter(o=>o.objectType==="wall");
 for(const door of doors){
  const p=door.geometry.points;
  assert.equal(p.length,2);
  const actual=Math.hypot(p[1][0]-p[0][0],p[1][1]-p[0][1]);
  const expected=door.metadata.openingWidthCm/50*spacing;
  assert.ok(Math.abs(actual-expected)<1e-7,t.id+" wrong door width");
  assert.ok(Math.abs(door.opening.width-expected)<1e-7,t.id+" opening metadata mismatch");
  assert.ok([70,75,80,90].includes(door.metadata.openingWidthCm),t.id+" unknown size");
  if(door.opening.external)assert.equal(door.metadata.openingWidthCm,90);
  // No wall segment may remain underneath an open doorway.
  const vertical=Math.abs(p[0][0]-p[1][0])<1e-7;
  for(const wall of walls.filter(o=>o.floorId===door.floorId)){
   const a=wall.geometry.points[0],b=wall.geometry.points[1];
   const collinear=vertical
    ?Math.abs(a[0]-p[0][0])<1e-7&&Math.abs(b[0]-p[0][0])<1e-7
    :Math.abs(a[1]-p[0][1])<1e-7&&Math.abs(b[1]-p[0][1])<1e-7;
   if(!collinear)continue;
   const axis=vertical?1:0;
   const sharedLength=Math.min(Math.max(p[0][axis],p[1][axis]),Math.max(a[axis],b[axis]))
    -Math.max(Math.min(p[0][axis],p[1][axis]),Math.min(a[axis],b[axis]));
   assert.ok(sharedLength<1e-7,t.id+" wall obstructs opening");
  }
  doorsTotal++;
 }
 checked++;
}
assert.equal(checked,12);
console.log("PASS",checked,"modern housing templates,",doorsTotal,"doors with exact openings");
