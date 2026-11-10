/* node rebuild/tests/residential-room-level-visibility.test.js */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const base=path.resolve(__dirname,"..");
const buildingCode=fs.readFileSync(path.join(base,"building-templates.js"),"utf8");
const viewerCode=fs.readFileSync(path.join(base,"map-viewer.js"),"utf8");
const context={window:{}};vm.runInNewContext(buildingCode,context);
const presets=context.window.AAMapBuildingTemplates.allPresets().filter(t=>t.modernPlan);
assert.equal(presets.length,12);
assert.ok(viewerCode.includes('if(kind==="room_zone")return false;'),
 "A selected room must not redraw opaque furniture-covering fill");
const from=viewerCode.indexOf(" function selectionPath(){"),to=viewerCode.indexOf(" function fitToObject(",from);
assert.ok(from>=0&&to>from,"Viewer depth logic must exist");
const testVisibility=vm.runInNewContext(
 "(function(data,selectedId){const scene=data,selected=data.objects.find(o=>o.id===selectedId);"+
 "const initialDisplayLevel=()=>4;"+
 viewerCode.slice(from,to)+
 "return scene.objects.filter(o=>visibleByDepth(o)).map(o=>o.id);})"
);
let checked=0;
for(const template of presets){
 const scene=context.window.AAMapBuildingTemplates.generate(template.id,{prefix:"house"});
 const owner=scene.objects.find(o=>o.id==="house"),rooms=scene.objects.filter(o=>o.objectType==="region");
 const fixtures=scene.objects.filter(o=>o.objectType==="object");
 assert.equal(owner.displayLevel,4);
 assert.ok(rooms.length>0&&fixtures.length>0,template.id);
 for(const fixture of fixtures){
  const room=rooms.find(r=>r.id===fixture.parentId);
  assert.ok(room,template.id+" fixture must be parented to a room: "+fixture.name);
  assert.equal(room.displayLevel,5);
  assert.equal(fixture.displayLevel,6);
  assert.equal(room.floorId,fixture.floorId);
 }
 const visibleAtOwner=new Set(testVisibility({objects:scene.objects},owner.id));
 const visibleAtRoom=new Set(testVisibility({objects:scene.objects},rooms[0].id));
 for(const fixture of fixtures){
  assert.ok(visibleAtOwner.has(fixture.id),template.id+" furniture hidden when building selected");
  assert.ok(visibleAtRoom.has(fixture.id),template.id+" furniture hidden when room selected");
 }
 checked+=fixtures.length;
}
console.log("PASS",presets.length,"homes and",checked,"room-parented fixtures stay visible under building/room selection");
