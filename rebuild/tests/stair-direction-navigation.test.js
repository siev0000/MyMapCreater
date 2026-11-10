/* node rebuild/tests/stair-direction-navigation.test.js */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"..","building-templates.js"),"utf8");
const viewer=fs.readFileSync(path.join(__dirname,"..","map-viewer.js"),"utf8");
const env={window:{}};vm.runInNewContext(source,env);
const lib=env.window.AAMapBuildingTemplates;
const begin=viewer.indexOf(" function stairFloorTargets(");
const end=viewer.indexOf(" function initialDisplayLevel(){",begin);
assert.ok(begin>=0&&end>begin,"Legacy stair helpers must still exist");
const testHit=vm.runInNewContext("(function(scene,obj,px,py){const worldAt=(x,y)=>[x,y];"+
 viewer.slice(begin,end)+"return stairDirectionalHit(obj,px,py);})");
let checked=0;
for(const t of lib.allPresets().filter(x=>x.id.startsWith("jp_detached_")&&x.floors>1)){
 const objs=lib.generate(t.id,{prefix:"home",spacing:2}).objects;
 const stairs=objs.filter(o=>o.objectType==="stair");
 if(t.id==="jp_detached_urban_3story"){
  assert.equal(stairs.length,4,"Two adjacent floor-pairs require four visible segments");
  const expected=[
   ["1F","1F-2F","up","2F"],
   ["2F","1F-2F","down","1F"],
   ["2F","2F-3F","up","3F"],
   ["3F","2F-3F","down","2F"]
  ];
  for(const [floor,pair,direction,target] of expected){
   const obj=stairs.find(s=>s.floorId===floor&&s.stairDesign?.pairId===pair);
   assert.ok(obj,floor+" should show "+pair);
   assert.equal(obj.stairDesign.direction,direction);
   assert.equal(obj.connection.toFloorId,target);
   const g=obj.geometry;
   assert.equal(testHit({objects:objs},obj,g.x+g.width*.5,g.y+g.height*.5),null,
    "Segment should not use combined left/right direction navigation");
   checked++;
  }
  const middle=stairs.filter(s=>s.floorId==="2F");
  assert.equal(middle.length,2,"The middle floor needs two stair choices");
  const a=middle[0].geometry,b=middle[1].geometry;
  assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x,
   "Upper and lower staircase footprints must not overlap");
  const pairA=stairs.filter(s=>s.stairDesign.pairId==="1F-2F");
  const pairB=stairs.filter(s=>s.stairDesign.pairId==="2F-3F");
  assert.equal(JSON.stringify(pairA[0].geometry),JSON.stringify(pairA[1].geometry));
  assert.equal(JSON.stringify(pairB[0].geometry),JSON.stringify(pairB[1].geometry));
 }else{
  assert.equal(stairs.length,t.floors,t.id+" legacy stair count");
  for(let floor=0;floor<stairs.length;floor++){
   const obj=stairs[floor],g=obj.geometry;
   const up=testHit({objects:objs},obj,g.x+g.width*.25,g.y+g.height*.5);
   const down=testHit({objects:objs},obj,g.x+g.width*.75,g.y+g.height*.5);
   assert.equal(up.direction,"up");assert.equal(down.direction,"down");
   assert.equal(up.destination?.id||null,floor+1<stairs.length?String(floor+2)+"F":null);
   assert.equal(down.destination?.id||null,floor>0?String(floor)+"F":null);
   checked++;
  }
 }
 console.log("PASS",t.id);
}
console.log("PASS",checked,"stair floor choices");
