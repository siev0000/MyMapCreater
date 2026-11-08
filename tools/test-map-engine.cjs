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
function overlapPolys(A,B){
 const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
 function inside(v,P){let ok=false;for(let i=0,j=P.length-1;i<P.length;j=i++){
  const a=P[i],b=P[j];if((a[1]>v[1])!==(b[1]>v[1])&&v[0]<(b[0]-a[0])*(v[1]-a[1])/(b[1]-a[1])+a[0])ok=!ok;
 }return ok}
 for(let i=0;i<A.length;i++)for(let j=0;j<B.length;j++){
  const a=A[i],b=A[(i+1)%A.length],c=B[j],d=B[(j+1)%B.length];
  if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return true;
 }
 return inside(A[0],B)||inside(B[0],A);
}
function verifyNoOverlaps(nodes,label){
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)
  assert.equal(overlapPolys(api.polygon(model,nodes[i]),api.polygon(model,nodes[j])),false,
   label+' overlaps: '+nodes[i].id+' vs '+nodes[j].id);
}
const arbora=model.byId.get('arbora_sector');
const naturalBuildings=model.nodes.filter(n=>n.parentId==='arbora_sector'&&n.role==='facility');
const naturalZones=api.childrenOf(model,arbora.id,'macro');
assert.equal(naturalBuildings.length,4);
assert.equal(naturalZones.length,6);
verifyNoOverlaps(naturalBuildings,'Arbora building');
verifyNoOverlaps(naturalZones,'Arbora macro');
for(const n of naturalBuildings)for(const point of api.polygon(model,n))
 assert.equal(api.contains(model,arbora,point[0],point[1]),true,'facility must stay within Arbora: '+n.id);
const blockingBuildings=model.nodes.filter(n=>n.role==='facility'&&!n.raw.zoneOutline&&!n.raw.areaFrame&&n.raw.type!=='terminal');
const blockers=blockingBuildings.map(n=>api.polygon(model,n));
const checks=new Set(['draft_central_access','draft_purple_machine_axis','draft_parallel_freight_B','draft_arbora_B_access']);
let splitCount=0;
for(const road of model.nodes.filter(n=>n.role==='road'&&n.geometry.kind==='polyline'&&checks.has(n.raw.geometryStatus))){
 const parts=api.visiblePolyline(road.geometry.points,blockers);
 if(parts.length>1)splitCount++;
 for(const part of parts)for(let k=1;k<part.length;k++){
  const mid=[(part[k-1][0]+part[k][0])/2,(part[k-1][1]+part[k][1])/2];
  for(const p of blockers)assert.equal(overlapPolys([mid,[mid[0]+1e-6,mid[1]],[mid[0],mid[1]+1e-6]],p),false,
   'visible road should not pass through building: '+road.id);
 }
}
assert.ok(splitCount>=1,'draft roads should be clipped where they hit solid facilities');

console.log('PASS: middle model, polygons, dimensions, nested selection and draft status');
