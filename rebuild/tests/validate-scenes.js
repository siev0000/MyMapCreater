/* Generic scene migration checks. Run: node rebuild/tests/validate-scenes.js */
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../..");
const read=(name)=>JSON.parse(fs.readFileSync(path.join(root,name),"utf8"));
const pt=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
function validate(scene,{migrated=false}={}){
 assert.equal(scene.schemaVersion,2);
 const ids=new Set();
 for(const o of scene.objects){
  assert.equal(typeof o.id,"string");
  assert(!ids.has(o.id),"Duplicate ID: "+o.id);
  ids.add(o.id);
  if(migrated){
   assert(Number.isSafeInteger(o.displayLevel)&&o.displayLevel>=1,"Invalid displayLevel: "+o.id);
   assert(!Object.hasOwn(o,"level"),"Legacy level remains: "+o.id);
  }
  const g=o.geometry||{type:"none"};
  assert(["none","rect","polygon","polyline","circle","ring"].includes(g.type),"Unsupported "+g.type);
  if(g.type==="polygon"||g.type==="polyline"){
   assert(g.points.length>=(g.type==="polygon"?3:2)&&g.points.every(pt),"Invalid points "+o.id);
  }
  if(g.type==="rect")assert([g.x,g.y,g.width,g.height].every(Number.isFinite)&&g.width>=0&&g.height>=0);
  if(g.type==="circle")assert(pt(g.center)&&g.radius>0);
  if(g.type==="ring")assert(pt(g.center)&&g.innerRadius>=0&&g.outerRadius>g.innerRadius);
  if(o.label?.position)assert(pt(o.label.position));
 }
 for(const o of scene.objects){
  if(o.parentId)assert(ids.has(o.parentId),"Missing parent for "+o.id);
  const trace=new Set();
  let current=o;
  while(current.parentId){
   assert(!trace.has(current.id),"Hierarchy cycle at "+o.id);
   trace.add(current.id);
   current=scene.objects.find(x=>x.id===current.parentId);
  }
 }
 return scene;
}
const tree=read("rebuild/map-tree.json");
assert.equal(tree.schemaVersion,1);
assert(tree.maps.some(m=>m.id===tree.defaultMapId));
for(const m of tree.maps){
 if(m.source)validate(read(path.join("rebuild",m.source)));
 for(const view of m.views||[])if(view.source)validate(read(path.join("rebuild",view.source)));
}
const counts=[];
for(const floor of ["upper","middle","lower"]){
 const original=read("data/"+floor+"-layout-draft.json");
 const scene=validate(read("rebuild/scenes/"+floor+".scene.json"));
 const objects=new Map(scene.objects.map(o=>[o.id,o]));
 for(const f of original.facilities){
  const o=objects.get(f.id);
  assert(o,"Missing facility "+f.id);
  const g=o.geometry;
  if(f.ringDistrict){
   assert.equal(g.type,"ring");
   assert.equal(g.innerRadius,f.innerRadius);
   assert.equal(g.outerRadius,f.outerRadius);
  }else if(f.ringComplex){
   assert.equal(g.type,"ring");
   assert.equal(g.innerRadius,f.ringComplex.innerRadius);
   assert.equal(g.outerRadius,f.ringComplex.outerRadius);
  }else if(f.type==="terminal"&&f.terminalInterior?.buildingRadius){
   assert.equal(g.type,"circle");
   assert.equal(g.radius,f.terminalInterior.buildingRadius);
  }else if(f.footprint?.length>=3){
   assert.equal(g.type,"polygon");
   assert.deepEqual(g.points,f.footprint.map(([x,y])=>[f.x+x,f.y+y]));
  }else{
   assert.equal(g.type,"rect");
   assert.deepEqual([g.x,g.y,g.width,g.height],[f.x-f.w/2,f.y-f.h/2,f.w,f.h]);
  }
  if(f.showLabel===false)assert.equal(o.label.visible,false,"Overridden showLabel:false "+f.id);
 }
 for(const r of original.roads){
  const o=objects.get(r.id);assert(o,"Missing road "+r.id);
  if(r.kind==="line"&&r.points?.length>=2)assert.deepEqual(o.geometry.points,r.points);
  if(r.kind==="ring")assert.equal(o.geometry.radius,r.r);
  assert.equal(o.metadata.roadWidthM,r.width||null);
 }
 counts.push({floor,facilities:original.facilities.length,roads:original.roads.length,objects:scene.objects.length});
}
const sample=validate(read("rebuild/examples/sample-town.scene.json"),{migrated:true});
assert(sample.objects.some(o=>o.objectType==="wall"&&o.geometry.type==="polyline"));
assert(sample.objects.some(o=>o.displayLevel===2&&o.parentId));
const renderer=fs.readFileSync(path.join(root,"rebuild/map-viewer.js"),"utf8");
for(const forbidden of ["arbora_sector","middle_terminal","core_shell_town","automaton_ship","shipProfile","hullWidth"]){
 assert(!renderer.includes(forbidden),"World-specific ID in generic renderer: "+forbidden);
}
const header=fs.readFileSync(path.join(root,"rebuild/header.html"),"utf8");
assert(!header.includes("nodes.has('middle')"),"Hard-coded initial floor");
assert(!header.includes("船体全域"),"Hard-coded ship UI");
console.log("PASS: generic scenes validated",JSON.stringify(counts));
