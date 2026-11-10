/* node rebuild/tests/stair-direction-navigation.test.js */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"..","building-templates.js"),"utf8");
const viewerSource=fs.readFileSync(path.join(__dirname,"..","map-viewer.js"),"utf8");
const env={window:{}};vm.runInNewContext(source,env);
const library=env.window.AAMapBuildingTemplates;
const begin=viewerSource.indexOf(" function stairFloorTargets(");
const end=viewerSource.indexOf(" function initialDisplayLevel(){",begin);
assert.ok(begin>=0&&end>begin,"directional stair helpers must exist");
const helpers=viewerSource.slice(begin,end);
let count=0;
for(const t of library.allPresets().filter(t=>t.id.startsWith("jp_detached_")&&t.floors>1)){
 const objects=library.generate(t.id,{prefix:"home",spacing:2}).objects;
 const check=vm.runInNewContext("(function(scene,obj,px,py){"+
  "const worldAt=(x,y)=>[x,y];"+helpers+"return stairDirectionalHit(obj,px,py);})");
 const stairs=objects.filter(o=>o.objectType==="stair");
 assert.equal(stairs.length,t.floors,t.id+" must have one staircase footprint per floor");
 for(let i=0;i<stairs.length;i++){
  const stair=stairs[i],g=stair.geometry;
  const left=check({objects},stair,g.x+g.width*.25,g.y+g.height*.55);
  const right=check({objects},stair,g.x+g.width*.75,g.y+g.height*.55);
  assert.equal(left.direction,"up");assert.equal(right.direction,"down");
  assert.equal(left.destination?.id||null,t.modernPlan[i+1]?String(i+2)+"F":null);
  assert.equal(right.destination?.id||null,i>0?String(i)+"F":null);
  assert.equal(stair.stairNavigation.upFloorId,t.modernPlan[i+1]?String(i+2)+"F":null);
  assert.equal(stair.stairNavigation.downFloorId,i>0?String(i)+"F":null);
  count++;
 }
 console.log("PASS",t.id,stairs.length,"floor transitions");
}
console.log("PASS",count,"stair directional targets");
