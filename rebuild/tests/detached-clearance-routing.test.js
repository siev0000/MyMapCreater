/* node rebuild/tests/detached-clearance-routing.test.js
 * Approximate 0.50m-wide avatar clearance, not a building-code check. */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"..","building-templates.js"),"utf8");
const env={window:{}};vm.runInNewContext(source,env);
const library=env.window.AAMapBuildingTemplates;
const templates=library.allPresets().filter(t=>t.id.startsWith("jp_detached_"));
const resolution=4,clearance=.5;
const distance=(x,y,a,b)=>{
 const vx=b[0]-a[0],vy=b[1]-a[1],length=vx*vx+vy*vy||1;
 const fraction=Math.max(0,Math.min(1,((x-a[0])*vx+(y-a[1])*vy)/length));
 return Math.hypot(x-a[0]-fraction*vx,y-a[1]-fraction*vy);
};
let floors=0;
for(const template of templates){
 const items=library.generate(template.id,{prefix:"test",spacing:1}).objects;
 for(let z=0;z<template.floors;z++){
  const floor=(z+1)+"F",objects=items.filter(o=>o.floorId===floor);
  const walls=objects.filter(o=>o.objectType==="wall").map(o=>o.geometry.points);
  const physical=objects.filter(o=>o.objectType==="stair"||
   (o.objectType==="object"&&!o.metadata?.fixtureCollisionExcluded)).map(o=>o.geometry);
  const width=template.cells[0]*resolution,height=template.cells[1]*resolution;
  const open=new Uint8Array(width*height),visited=new Uint8Array(width*height);
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){
   const x=(i+.5)/resolution,y=(j+.5)/resolution;
   let blocked=physical.some(g=>x>g.x-clearance&&x<g.x+g.width+clearance&&
    y>g.y-clearance&&y<g.y+g.height+clearance);
   if(!blocked)blocked=walls.some(([a,b])=>distance(x,y,a,b)<clearance);
   open[j*width+i]=blocked?0:1;
  }
  let start;
  if(z===0){
   const door=objects.find(o=>o.objectType==="door"&&o.opening?.external);
   assert.ok(door,template.id+" must have a front door");
   start=[(door.geometry.points[0][0]+door.geometry.points[1][0])/2,
    template.cells[1]-.8];
  }else{
   const stair=objects.find(o=>o.objectType==="stair");
   assert.ok(stair,template.id+" must have upper stair");
   const g=stair.geometry;
   start=[g.x+g.width/2,g.y+g.height+.8];
  }
  const sx=Math.max(0,Math.min(width-1,Math.floor(start[0]*resolution)));
  const sy=Math.max(0,Math.min(height-1,Math.floor(start[1]*resolution)));
  const startId=sy*width+sx;
  assert.ok(open[startId],template.id+"/"+floor+" entrance/stair landing has no avatar clearance");
  const queue=[startId];visited[startId]=1;
  for(let front=0;front<queue.length;front++){
   const index=queue[front],x=index%width,y=Math.floor(index/width);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nx=x+dx,ny=y+dy;
    if(nx<0||ny<0||nx>=width||ny>=height)continue;
    const next=ny*width+nx;
    if(open[next]&&!visited[next]){visited[next]=1;queue.push(next)}
   }
  }
  for(const room of template.modernPlan[z].rooms){
   let reached=false;
   for(let j=room[3]*resolution;j<(room[3]+room[5])*resolution&&!reached;j++)
    for(let i=room[2]*resolution;i<(room[2]+room[4])*resolution;i++)
     if(visited[j*width+i]){reached=true;break}
   assert.ok(reached,template.id+"/"+floor+" avatar cannot enter "+room[1]);
  }
  floors++;
 }
}
console.log("PASS",templates.length,"detached homes /",floors,"floors: approximate 0.5m avatar clear routes");
