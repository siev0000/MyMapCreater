/* Regression: a lift is one polygon, one closed perimeter wall, one door.
   Run: node rebuild/tests/terminal-lift-unified-walls.test.js */
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const root=path.join(__dirname,".."),context={window:{}};
for(const f of ["building-templates.js","polygon-room.js","map-viewer.js"])
 vm.runInNewContext(fs.readFileSync(path.join(root,f),"utf8"),context,{filename:f});
const lib=context.window.AAMapBuildingTemplates,helper=context.window.AAMapPolygonRoom;
const objects=lib.generate("machine_mid_link_terminal_dome_v2",{prefix:"test"}).objects;
context.window.AAMapViewer.sceneCheck({schemaVersion:2,id:"lift-test",name:"lift-test",
 coordinateSystem:{horizontal:[1,0],vertical:[0,1],bounds:{minX:0,maxX:2000,minY:0,maxY:2000}},objects});
const roles=role=>objects.filter(o=>o.metadata?.role===role);
const shafts=roles("lift-shaft"),walls=roles("lift-shaft-perimeter-wall"),doors=roles("lift-arrivals-door");
assert.equal(shafts.length,8);
assert.equal(walls.length,8);
assert.equal(doors.length,8);
assert.equal(roles("heavy-vehicle-road").length,4);
for(const shaft of shafts){
 assert.equal(shaft.geometry.type,"polygon",shaft.name);
 assert.doesNotThrow(()=>helper.normalize(shaft.geometry.points));
 const sub=objects.filter(o=>o.parentId===shaft.id);
 const border=sub.filter(o=>o.objectType==="wall"),door=sub.filter(o=>o.objectType==="door");
 assert.equal(border.length,1,shaft.name+" must have one perimeter wall");
 assert.equal(door.length,1,shaft.name+" must have one door");
 assert.equal(border[0].geometry.points.length,shaft.geometry.points.length+1);
 assert.equal(door[0].opening.wallId,border[0].id);
 const edge=door[0].metadata.edgeIndex,p=shaft.geometry.points[edge],q=shaft.geometry.points[(edge+1)%shaft.geometry.points.length];
 const [d0,d1]=door[0].geometry.points;
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 assert.ok(distance(p,d0)<1e-7&&distance(q,d1)<1e-7,"Door is the full flat entrance edge");
 assert.ok(shaft.metadata.polygonRoom,"Room polygon metadata is editable");
}
assert.equal(objects.filter(o=>/昇降機.*(?:側壁|前壁|内壁)/.test(o.name)).length,0);
assert.equal(roles("lift-arrivals-boundary-wall").length,8);
assert.equal(roles("terminal-room").length,12);
assert.equal(lib.generate("machine_mid_registlink_dome",{prefix:"legacy"}).objects.length,96);
console.log("PASS 8 elevator polygons with single linked perimeter and one outward door each");
