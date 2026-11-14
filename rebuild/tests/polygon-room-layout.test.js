/* Multi-sided polygon room / linked doorway geometry tests.
   node rebuild/tests/polygon-room-layout.test.js */
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"..","polygon-room.js"),"utf8"),context);
const lib=context.window.AAMapPolygonRoom;
const room={id:"room-test",name:"多角形テスト室",objectType:"region",floorId:"1F",displayLevel:4,
 geometry:{type:"polygon",points:[[0,0],[80,0],[80,60],[45,60],[45,90],[0,90]]}};
const build=lib.build(room,{worldUnitsPerMeter:4,wallThicknessCm:25,doors:[
 {edgeIndex:0,widthM:6,position:.5},{edgeIndex:3,widthM:3,position:.5}
]});
assert.equal(build.walls.length,6);
assert.equal(build.doors.length,2);
assert.equal(build.points.length,6);
for(const door of build.doors){
 const wall=build.walls.find(o=>o.id===door.opening.wallId);
 assert.ok(wall,"door must reference existing wall");
 assert.equal(door.objectType,"door");
 assert.equal(door.parentId,room.id);
 assert.equal(door.floorId,"1F");
 assert.equal(door.geometry.points.length,2);
 const len=Math.hypot(door.geometry.points[1][0]-door.geometry.points[0][0],door.geometry.points[1][1]-door.geometry.points[0][1]);
 assert.ok(Math.abs(len-door.opening.width)<1e-9);
}
assert.deepEqual([...new Set(build.walls.map(o=>o.metadata.edgeIndex))],[0,1,2,3,4,5]);
const again=lib.build(room,{worldUnitsPerMeter:4,wallThicknessCm:25,doors:[{edgeIndex:0,widthM:6,position:.5}]});
assert.equal(again.doors.length,1);
assert.equal(again.walls[0].id,build.walls[0].id,"wall ids stable between regenerations");
assert.throws(()=>lib.build({...room,geometry:{type:"polygon",points:[[0,0],[40,40],[0,40],[40,0]]}}),/交差|面積/);
assert.throws(()=>lib.build(room,{worldUnitsPerMeter:4,doors:[{edgeIndex:1,widthM:999,position:.5}]}),/長さ/);
assert.throws(()=>lib.build(room,{worldUnitsPerMeter:4,doors:[{edgeIndex:2,widthM:5,position:.01}]}),/角から/);
assert.throws(()=>lib.build(room,{worldUnitsPerMeter:4,doors:[{edgeIndex:1,widthM:2,position:.5},{edgeIndex:1,widthM:2,position:.5}]}),/重複/);
console.log("PASS polygon room: 6 walls, multi-edge doors, stable IDs, invalid geometry rejected");
