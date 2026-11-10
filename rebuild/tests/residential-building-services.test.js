/* node rebuild/tests/residential-building-services.test.js */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const code=fs.readFileSync(path.join(root,"building-templates.js"),"utf8");
const editor=fs.readFileSync(path.join(root,"map-editor.js"),"utf8");
const html=fs.readFileSync(path.join(root,"editor.html"),"utf8");
const viewer=fs.readFileSync(path.join(root,"map-viewer.js"),"utf8");
const context={window:{}};vm.runInNewContext(code,context);
const templates=context.window.AAMapBuildingTemplates.allPresets().filter(t=>t.modernPlan);
const serviceTypes=["ventilation_fan","range_hood","water_heater","air_conditioner",
 "power_outlet","light_switch","ceiling_light"];
const overlap=(a,b)=>{
 const x=a.geometry,y=b.geometry;
 return x.x<y.x+y.width-1e-8&&x.x+x.width>y.x+1e-8&&
  x.y<y.y+y.height-1e-8&&x.y+x.height>y.y+1e-8;
};
for(const template of templates){
 const objects=context.window.AAMapBuildingTemplates.generate(template.id,{prefix:"check",spacing:2.5}).objects;
 const services=objects.filter(o=>o.metadata?.buildingService);
 assert.ok(objects.some(o=>o.objectType==="window"),template.id+" must generate an external window");
 for(const type of serviceTypes)
  assert.ok(services.some(o=>o.shapePresetId===type),template.id+" missing "+type);
 for(const item of services){
  assert.equal(item.metadata.installationStatus,"schematic-unverified");
  assert.ok(item.metadata.ceilingMounted||item.metadata.wallMounted);
  const owner=template.modernPlan[Number(item.floorId.slice(0,-1))-1];
  assert.ok(owner.rooms.some(r=>item.geometry.x>=r[2]*2.5-1e-8&&
   item.geometry.y>=r[3]*2.5-1e-8&&
   item.geometry.x+item.geometry.width<=(r[2]+r[4])*2.5+1e-8&&
   item.geometry.y+item.geometry.height<=(r[3]+r[5])*2.5+1e-8),
   template.id+": service outside its room");
 }
 for(let i=0;i<services.length;i++)for(let j=i+1;j<services.length;j++){
  if(services[i].floorId!==services[j].floorId)continue;
  assert.ok(!overlap(services[i],services[j]),
   template.id+": overlapping "+services[i].name+" and "+services[j].name);
 }
}
for(const type of serviceTypes){
 assert.ok(html.includes('<option value="'+type+'">'),"Editor option missing: "+type);
 assert.ok(editor.includes(type+':{'),"Editor size missing: "+type);
 assert.ok(viewer.includes('kind==="'+type+'"'),"Viewer symbol missing: "+type);
}
console.log("PASS",templates.length,"modern homes: window openings and seven service categories, zero overlaps");
