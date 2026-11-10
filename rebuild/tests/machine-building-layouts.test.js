/* node rebuild/tests/machine-building-layouts.test.js */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const src=fs.readFileSync(path.join(__dirname,"..","building-templates.js"),"utf8");
const ctx={window:{}};vm.runInNewContext(src,ctx);
const library=ctx.window.AAMapBuildingTemplates;
const templates=library.allPresets().filter(t=>t.worldStyle==="machine");
assert.equal(templates.length,22,"Original 16 plus six AA facility drafts");
function overlaps(a,b,eps=1e-7){return a.x<b.x+b.width-eps&&a.x+a.width>b.x+eps&&
 a.y<b.y+b.height-eps&&a.y+a.height>b.y+eps}
function onSegment(p,seg){const [a,b]=seg,eps=1e-7;
 return Math.abs((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))<eps&&
 p[0]>=Math.min(a[0],b[0])-eps&&p[0]<=Math.max(a[0],b[0])+eps&&
 p[1]>=Math.min(a[1],b[1])-eps&&p[1]<=Math.max(a[1],b[1])+eps}
let floorCount=0,deviceCount=0,roomCount=0;
for(const t of templates){
 const scene=library.generate(t.id,{prefix:"mechanical",spacing:2.3}).objects;
 const root=scene.find(o=>o.id==="mechanical");
 assert.equal(root.displayLevel,4);assert.equal(root.floors.length,t.floors);
 assert.equal(root.metadata.designStatus,"draft-unverified");
 const ids=new Set(scene.map(o=>o.id));
 assert.equal(ids.size,scene.length,t.id+" unique IDs");
 for(let z=0;z<t.floors;z++){
  floorCount++;
  const floor=(z+1)+"F",objects=scene.filter(o=>o.floorId===floor);
  const rooms=objects.filter(o=>o.objectType==="region"),doors=objects.filter(o=>o.objectType==="door");
  const equipment=objects.filter(o=>o.objectType==="object"),stairs=objects.filter(o=>o.objectType==="stair");
  const slabs=objects.filter(o=>o.objectType==="slab"),walls=objects.filter(o=>o.objectType==="wall");
  assert.equal(rooms.length,5,t.id+" five corridor-accessible zones per floor");
  assert.equal(doors.length,z===0?5:4,t.id+" four interior doors and ground entrance");
  assert.equal(stairs.length,t.floors>1?1:0,t.id+" stair should occupy one room");
  for(const room of rooms){assert.equal(room.displayLevel,5);assert.equal(room.parentId,root.id)}
  for(const o of equipment){
   roomCount+=0;deviceCount++;
   const room=rooms.find(r=>r.id===o.parentId);
   assert.ok(room,t.id+" equipment not in a real room");
   assert.equal(o.displayLevel,room.displayLevel+1);
   assert.equal(o.floorId,room.floorId);
   const a=o.geometry,b=room.geometry;
   assert.ok(a.x>=b.x-1e-8&&a.y>=b.y-1e-8&&
    a.x+a.width<=b.x+b.width+1e-8&&a.y+a.height<=b.y+b.height+1e-8,
    t.id+" equipment outside room");
  }
  for(let i=0;i<equipment.length;i++)for(let j=i+1;j<equipment.length;j++)
   assert.ok(!overlaps(equipment[i].geometry,equipment[j].geometry),
    t.id+" overlapping "+equipment[i].name+" and "+equipment[j].name);
  for(const door of doors){
   assert.equal(door.door?.type,"sliding");
   assert.equal(door.door?.state,"closed");
   const p=door.geometry.points;
   assert.ok(!walls.some(w=>w.geometry.points?.length===2&&
    p.every(q=>onSegment(q,w.geometry.points))),t.id+" opening blocked by a wall");
  }
  if(stairs.length){
   const st=stairs[0],dest=st.stairNavigation;
   assert.equal(dest.upFloorId,z<t.floors-1?(z+2)+"F":null);
   assert.equal(dest.downFloorId,z>0?z+"F":null);
   const approach=rooms.find(r=>r.name==="階段・共用設備室");
   assert.ok(approach&&approach.geometry.x<=st.geometry.x);
   for(const d of doors.filter(x=>!x.opening.external)){
    if(Math.abs(d.geometry.points[0][0]-approach.geometry.x)>1e-7)continue;
    // Stairwell entry is positioned on the lower-landing side.
    const lowest=Math.min(...d.geometry.points.map(p=>p[1]));
    assert.ok(lowest>st.geometry.y+st.geometry.height-1e-7,
     t.id+" door enters stair mid-flight");
   }
   for(const slab of z>0?slabs:[])
    assert.ok(!overlaps(st.geometry,slab.geometry),t.id+" slab covers staircase");
  }
  if(t.facilityMode==="pods"||t.facilityMode==="housing"){
   const pods=equipment.filter(x=>x.shapePresetId==="dormancy_pod");
   assert.equal(pods.length,t.podsPerFloor,t.id+" requested pod count");
  }
  roomCount+=rooms.length;
 }
}
console.log("PASS",templates.length,"machine-world templates,",floorCount,"floors,",
 roomCount,"rooms,",deviceCount,"equipment, stair landings and openings");
