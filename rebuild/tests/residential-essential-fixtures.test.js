/* node rebuild/tests/residential-essential-fixtures.test.js */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const src=fs.readFileSync(path.join(root,"building-templates.js"),"utf8");
const editor=fs.readFileSync(path.join(root,"map-editor.js"),"utf8");
const ui=fs.readFileSync(path.join(root,"editor.html"),"utf8");
const context={window:{}};vm.runInNewContext(src,context);
const presets=context.window.AAMapBuildingTemplates.allPresets().filter(t=>t.modernPlan);
assert.equal(presets.length,12,"Current modern-home templates");
let checked=0;
for(const template of presets){
 const scene=context.window.AAMapBuildingTemplates.generate(template.id,{prefix:"house",spacing:2.3});
 const objects=scene.objects,fixtures=objects.filter(x=>x.objectType==="object");
 for(const key of ["washer","refrigerator"]){
  assert.equal(fixtures.filter(x=>x.shapePresetId===key).length,1,
   template.id+" must contain one "+key);
 }
 assert.ok(fixtures.some(x=>x.shapePresetId==="bath"&&x.metadata?.attachedShower),
  template.id+" needs a shower-equipped bath");
 const beds=template.modernPlan.flatMap(p=>p.rooms)
  .filter(room=>/主寝室|洋室|寝室/.test(room[1])).length;
 assert.ok(fixtures.filter(x=>x.shapePresetId==="bed").length>=Math.max(1,beds),
  template.id+" all bedrooms must have a bed");
 const bath=fixtures.find(x=>x.shapePresetId==="bath");
 assert.ok(/シャワー/.test(bath.detail),"Bath detail must mention the integrated shower");
 const appliances=fixtures.filter(x=>["washer","refrigerator"].includes(x.shapePresetId));
 for(const target of appliances){
  const g=target.geometry;
  const floor=template.modernPlan[Number(target.floorId.replace("F",""))-1];
  const r=floor.rooms.some(room=>
   g.x>=room[2]*2.3-1e-8&&g.y>=room[3]*2.3-1e-8&&
   g.x+g.width<=(room[2]+room[4])*2.3+1e-8&&
   g.y+g.height<=(room[3]+room[5])*2.3+1e-8);
  assert.ok(r,template.id+" appliance must fit inside a single room");
  for(const other of objects.filter(x=>x.floorId===target.floorId&&x!==target&&
   ["object","stair"].includes(x.objectType)&&!x.metadata?.fixtureCollisionExcluded)){
   const b=other.geometry;
   if(!b||b.type!=="rect")continue;
   assert.ok(!(g.x<b.x+b.width-1e-8&&g.x+g.width>b.x+1e-8&&
    g.y<b.y+b.height-1e-8&&g.y+g.height>b.y+1e-8),
    template.id+" equipment overlaps "+other.name);
  }
 }
 for(const door of objects.filter(x=>x.objectType==="door")){
  assert.equal(door.metadata?.swingFurnitureInterferenceCount||0,0,
   template.id+" door must not hit installed fixtures");
  assert.equal(door.metadata?.swingDoorInterferenceCount||0,0,
   template.id+" door must not hit another door");
 }
 checked++;
}
for(const shape of ["shower","bath","washer","refrigerator","sink","toilet","kitchen","bed","lamp"]){
 assert.ok(ui.includes('<option value="'+shape+'">'),shape+" needs a placement option");
 assert.ok(editor.includes(shape+':{'),shape+" needs an installation size");
}
console.log("PASS",checked,"residences: shower baths, washers, fridges, beds, equipment menu, fixture clearance");
