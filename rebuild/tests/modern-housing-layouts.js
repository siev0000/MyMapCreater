/* Regression test: modern housing plans are valid, connected, and never pierce walls. */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const root=path.resolve(__dirname,"../.."),win={};
const context=vm.createContext({window:win});
for(const filename of ["building-templates.js","map-viewer.js"])
 vm.runInContext(fs.readFileSync(path.join(root,"rebuild",filename),"utf8"),context,{filename});
const library=win.AAMapBuildingTemplates,modern=library.allPresets().filter(t=>t.era==="modern-jp");
assert.equal(modern.length,6,"All six modern Japanese home plans must exist");
const overlap=(a,b)=>{
 const e=1e-8;
 return Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>e&&
        Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>e;
};
const crosses=(wall,rect)=>{
 const p=wall.geometry.points,e=1e-8;
 const half=wall.objectType==="wall"?(wall.wall?.thickness||0)/2:0;
 for(let i=1;i<p.length;i++){
  const [ax,ay]=p[i-1],[bx,by]=p[i];
  if(Math.abs(ax-bx)<e&&ax>rect.x-half+e&&ax<rect.x+rect.width+half-e&&
    Math.max(Math.min(ay,by),rect.y)<Math.min(Math.max(ay,by),rect.y+rect.height)-e){
   if(ax+half>rect.x+e&&ax-half<rect.x+rect.width-e)return true;
  }
  if(Math.abs(ay-by)<e&&ay+half>rect.y+e&&ay-half<rect.y+rect.height-e&&
    Math.max(Math.min(ax,bx),rect.x)<Math.min(Math.max(ax,bx),rect.x+rect.width)-e)return true;
 }
 return false;
};
const expected={"jp_studio_1r":24,"jp_apartment_1k":28,"jp_mansion_1ldk":45,"jp_mansion_2ldk":72,"jp_mansion_3ldk":81,"jp_detached_2story":112};
let floorCount=0,fixtureCount=0;
for(const t of modern){
 const result=library.generate(t.id,{prefix:"test",x:100,y:-30,spacing:2});
 const {objects}=result,rootObj=objects.find(o=>o.id==="test");
 assert.equal(t.cells[0]*t.cells[1]*.25*t.floors,expected[t.id],t.id+" area changed");
 assert(rootObj?.floors?.length===t.floors);
 win.AAMapViewer.sceneCheck({schemaVersion:2,objects});
 for(let i=0;i<t.modernPlan.length;i++){
  const plan=t.modernPlan[i],f=rootObj.floors[i].id;
  const links=new Map(plan.rooms.map(a=>[a[0],new Set()]));
  for(const [a,b] of plan.doors){links.get(a).add(b);links.get(b).add(a)}
  const seen=new Set([plan.entry||plan.rooms[0][0]]),queue=[...seen];
  while(queue.length){const current=queue.shift();for(const next of links.get(current))if(!seen.has(next)){seen.add(next);queue.push(next)}}
  assert.equal(seen.size,plan.rooms.length,t.id+"/"+f+": disconnected rooms");
  // Each room must fit inside its floor, and rooms must not overlap one another.
  const regions=objects.filter(o=>o.floorId===f&&o.objectType==="region");
  let regionArea=0;
  for(const a of regions){
   const g=a.geometry;
   assert(g.x>=rootObj.geometry.x-1e-8&&g.y>=rootObj.geometry.y-1e-8&&
    g.x+g.width<=rootObj.geometry.x+rootObj.geometry.width+1e-8&&
    g.y+g.height<=rootObj.geometry.y+rootObj.geometry.height+1e-8,t.id+"/"+f+" room outside");
   regionArea+=g.width*g.height;
   for(const b of regions)if(a.id<b.id)assert(!overlap(g,b.geometry),t.id+"/"+f+" overlapping rooms");
  }
  assert(Math.abs(regionArea-rootObj.geometry.width*rootObj.geometry.height)<1e-5,t.id+"/"+f+" untiled rooms");
  const furniture=objects.filter(o=>o.floorId===f&&["object","stair"].includes(o.objectType));
  const barriers=objects.filter(o=>o.floorId===f&&["wall","door"].includes(o.objectType));
  for(const item of furniture){
   fixtureCount++;
   for(const barrier of barriers)assert(!crosses(barrier,item.geometry),
    t.id+"/"+f+": "+item.name+" crosses "+barrier.name);
   for(const other of furniture)if(item.id<other.id)
    assert(!overlap(item.geometry,other.geometry),
     t.id+"/"+f+": "+item.name+" overlaps "+other.name);
  }
  floorCount++;
 }
}
console.log("OK: "+modern.length+" modern templates, "+floorCount+" floors, "+fixtureCount+" fixtures; 24-112sqm, connected rooms, thick-wall clearance and no overlapping equipment");
