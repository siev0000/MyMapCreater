"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const w={};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,"../town-edit-tools.js"),"utf8"),{window:w});
const scene={schemaVersion:2,settings:{georeference:{worldUnitsPerMeter:4,minElevationM:20,maxElevationM:80}},
 objects:[
 {id:"roadA",objectType:"object",metadata:{featureKind:"road",osmId:1},geometry:{type:"polyline",points:[[0,0],[10,0]]}},
 {id:"roadB",objectType:"object",metadata:{featureKind:"road",osmId:2},geometry:{type:"polyline",points:[[14,0],[50,0]]}},
 {id:"t0",objectType:"object",metadata:{featureKind:"terrain",elevationM:30,verifiedElevation:true},geometry:{type:"rect",x:0,y:0,width:100,height:100},style:{fill:"#000"}},
 {id:"t1",objectType:"object",metadata:{featureKind:"terrain",elevationM:31,verifiedElevation:true},geometry:{type:"rect",x:100,y:0,width:100,height:100},style:{fill:"#000"}},
 {id:"t2",objectType:"object",metadata:{featureKind:"terrain",elevationM:35,verifiedElevation:true},geometry:{type:"rect",x:300,y:0,width:100,height:100},style:{fill:"#000"}}
]};
const c=w.AAMapTownTools.roadCandidate(scene,"roadA",8);
assert.equal(c.otherId,"roadB");
assert.equal(c.distanceWorld,4);
const road=w.AAMapTownTools.joinRoads(scene,"roadA",8);
assert.equal(road.connected,true);
assert.deepEqual([...road.scene.objects[0].geometry.points[1]],[12,0]);
assert.deepEqual([...road.scene.objects[1].geometry.points[0]],[12,0]);
assert.equal(road.scene.objects[0].metadata.manualGeometryEdit,true);
assert.equal(scene.objects[0].geometry.points[1][0],10,"Source geometry must remain unchanged");
assert.equal(w.AAMapTownTools.joinRoads(scene,"roadA",2).connected,false);
const painted=w.AAMapTownTools.terrainPaint(scene,"t0",105,2.5);
assert.equal(painted.count,2);
assert.equal(painted.scene.objects[2].metadata.elevationM,32.5);
assert.equal(painted.scene.objects[3].metadata.elevationM,33.5);
assert.equal(painted.scene.objects[4].metadata.elevationM,35);
assert.equal(painted.scene.objects[2].metadata.verifiedElevation,false);
assert.equal(painted.scene.objects[2].metadata.manualElevationEdit,true);
assert.equal(scene.objects[2].metadata.elevationM,30);
assert.throws(()=>w.AAMapTownTools.terrainPaint(scene,"roadA",4,2),/地形/);
console.log("OK: non-destructive road endpoint connection, bounded terrain brush, provenance and unchanged originals");