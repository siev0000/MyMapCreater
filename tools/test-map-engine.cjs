/* Run: node tools/test-map-engine.cjs (no dependencies). */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path'),root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'aa-map-engine.js'),'utf8');
const context={window:{}};vm.runInNewContext(code,context,{filename:'aa-map-engine.js'});
const api=context.window.AAMapEngine;
const draft=JSON.parse(fs.readFileSync(path.join(root,'data/middle-layout-draft.json'),'utf8'));
const original=JSON.stringify(draft),model=api.normalizeFloor(draft);
const byRole=role=>model.nodes.filter(n=>n.role===role);
assert.equal(model.districts.length,4,'four established district outlines');
assert.equal(byRole('medium').length,18);
assert.equal(byRole('small').length,36);
assert.equal(byRole('road').length,27);
assert.equal(model.problems.length,0);
assert.equal(JSON.stringify(draft),original,'normalization must not mutate draft');
for(const id of ['core_shell_town','refine_valley','stern_core_shell_town','stern_refine_lab_district']){
 const n=model.byId.get(id);assert.equal(n.geometry.kind,'polygon');assert.equal(n.geometry.vertices.length,114);
}
for(const [id,x,y,w,h] of [
 ['standard_fuel_factory',-545,245,160,120],
 ['plant_oil_processing',-500,410,100,80],
 ['fiber_resin_processing',-545,-245,120,100],
 ['middle_material_processing',-490,-400,140,100]
]){
 const n=model.byId.get(id);assert.ok(n);assert.equal(n.legacyX,x);assert.equal(n.legacyY,y);
 assert.equal(n.raw.w,w);assert.equal(n.raw.h,h);
}
const district=model.byId.get('core_shell_town'),medium=api.childrenOf(model,district.id,'medium')[0];
const small=api.childrenOf(model,medium.id,'small')[0];
assert.ok(Math.abs(api.worldPose(model,medium).x-medium.raw.x)<1e-6);
assert.ok(Math.abs(api.worldPose(model,medium).y-medium.raw.y)<1e-6);
assert.equal(api.hitMiddleChild(model,district.id,medium.raw.x,medium.raw.y).id,medium.id);
assert.equal(api.hitMiddleChild(model,medium.id,small.raw.x,small.raw.y).id,small.id);
assert.equal(api.middleState(model,small.id).medium.id,medium.id);
assert.equal(medium.type,'facility');assert.equal(small.type,'room');
for(const id of [null,district.id,medium.id,small.id]){
 let calls=0;const ctx=new Proxy({},{get:(o,k)=>k in o?o[k]:()=>{calls++},
  set:(o,k,v)=>(o[k]=v,true)});
 api.drawMiddleCanvas(ctx,(x,y)=>[x,y],model,id,{labels:true});
 assert.ok(calls>50,'draw not empty: '+id);
}
assert.ok(byRole('road').some(n=>n.properties.sourceStatus==='draft_route_requires_review'));
console.log('PASS: middle model, polygons, dimensions, nested selection and draft status');
