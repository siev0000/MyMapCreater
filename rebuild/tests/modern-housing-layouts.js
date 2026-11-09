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
 for(let i=1;i<p.length;i++){
  const [ax,ay]=p[i-1],[bx,by]=p[i];
  if(Math.abs(ax-bx)<e&&ax>rect.x+e&&ax<rect.x+rect.width-e&&
    Math.max(Math.min(ay,by),rect.y)<Math.min(Math.max(ay,by),rect.y+rect.height)-e)return true;
  if(Math.abs(ay-by)<e&&ay>rect.y+e&&ay<rect.y+rect.height-e&&
    Math.max(Math.min(ax,bx),rect.x)<Math.min(Math.max(ax,bx),rect.x+rect.width)-e)return true;
 }
 return false;
};
let floorCount=0,fixtureCount=0;
for(const t of modern){
 const result=library.generate(t.id,{prefix:"test",x:100,y:-30,spacing:2});
 const {objects}=result,rootObj=objects.find(o=>o.id==="test");
 assert(rootObj?.floors?.length===t.floors);
 win.AAMapViewer.sceneCheck({schemaVersion:2,objects});
 for(let i=0;i<t.modernPlan.length;i++){
  const plan=t.modernPlan[i],f=rootObj.floors[i].id;
  const links=new Map(plan.rooms.map(a=>[a[0],new Set()]));
  for(const [a,b] of plan.doors){links.get(a).add(b);links.get(b).add(a)}
  const seen=new Set([plan.entry||plan.rooms[0][0]]),queue=[...seen];
  while(queue.length){const current=queue.shift();for(const next of links.get(current))if(!seen.has(next)){seen.add(next);queue.push(next)}}
  assert.equal(seen.size,plan.rooms.length,t.id+"/"+f+": disconnected rooms");
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
console.log("OK: "+modern.length+" modern templates, "+floorCount+" floors, "+fixtureCount+" fixtures; all room paths connected and no crossings");
