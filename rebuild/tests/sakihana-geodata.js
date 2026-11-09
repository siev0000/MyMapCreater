/* Test pure Sakihana OSM / GSI scene conversions with synthetic fixtures.
   This does not assert that any geometry was actually downloaded.
   Run: node rebuild/tests/sakihana-geodata.js */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,".."),window={};
const context=vm.createContext({window,Date,Number,Math,Error});
for(const file of ["sakihana-map.js","map-viewer.js"])
 vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),context,{filename:file});
const geo=window.AASakihanaMap;
const center=geo.CENTER,mid=geo.fromLonLat(center);
assert(Math.abs(mid[0])<1e-9&&Math.abs(mid[1])<1e-9);
assert(Math.abs(geo.toLonLat(0,0).lat-center.lat)<1e-9);
assert(Math.abs(geo.toLonLat(0,0).lon-center.lon)<1e-9);
assert.equal(geo.UNIT,4);
assert.equal(geo.HALF_M,250);
const bbox=geo.bbox().split(",").map(Number);
assert(bbox[0]<center.lat&&bbox[1]<center.lon&&bbox[2]>center.lat&&bbox[3]>center.lon);
const elements=[
 {type:"way",id:10,tags:{highway:"residential",name:"試験用道路"},geometry:[
  {lat:center.lat,lon:center.lon-.01},{lat:center.lat,lon:center.lon+.01}]},
 {type:"way",id:11,tags:{railway:"rail"},geometry:[
  {lat:center.lat+.001,lon:center.lon-.004},{lat:center.lat+.001,lon:center.lon+.004}]},
 {type:"way",id:12,tags:{building:"yes",height:"7.5"},geometry:[
  {lat:center.lat+.0002,lon:center.lon+.0001},{lat:center.lat+.0002,lon:center.lon+.0003},
  {lat:center.lat+.0004,lon:center.lon+.0003},{lat:center.lat+.0004,lon:center.lon+.0001},
  {lat:center.lat+.0002,lon:center.lon+.0001}]},
 {type:"way",id:13,tags:{landuse:"forest"},geometry:[
  {lat:center.lat-.004,lon:center.lon-.004},{lat:center.lat-.004,lon:center.lon+.004},
  {lat:center.lat+.004,lon:center.lon+.004},{lat:center.lat+.004,lon:center.lon-.004},
  {lat:center.lat-.004,lon:center.lon-.004}]},
 {type:"node",id:99,tags:{railway:"station",name:"検証駅"},lat:center.lat,lon:center.lon}
];
const scene=geo.fromOverpass({elements,osm3s:{timestamp_osm_base:"2026-11-09T00:00:00Z"}});
window.AAMapViewer.sceneCheck(scene);
assert.equal(scene.settings.georeference.worldUnitsPerMeter,4);
assert.equal(scene.settings.georeference.importedAt.length,24);
assert.equal(scene.objects.filter(o=>o.metadata?.featureKind==="road").length,1);
assert.equal(scene.objects.filter(o=>o.metadata?.featureKind==="railway").length,1);
assert.equal(scene.objects.filter(o=>o.metadata?.featureKind==="building").length,1);
assert.equal(scene.objects.filter(o=>o.metadata?.featureKind==="forest").length,1);
assert.equal(scene.objects.find(o=>o.id==="osm_way_12_0").metadata.heightM,7.5);
assert(scene.objects.find(o=>o.id==="osm_way_10_0").metadata.renderWidthEstimated);
for(const obj of scene.objects){
 for(const p of obj.geometry?.points||[]){
  assert(Math.abs(p[0])<=1000.001&&Math.abs(p[1])<=1000.001,"Unclipped OSM feature");
 }
}
const elevations=Array.from({length:21},(_,j)=>Array.from({length:21},(_,i)=>20+i+j));
const enhanced=geo.addElevation(scene,{
 samples:elevations,stepM:25,source:"mock-dem",zoom:15,
 min:20,max:60,retrievedAt:"2026-11-09",known:441,total:441
});
window.AAMapViewer.sceneCheck(enhanced);
assert.equal(enhanced.objects.filter(x=>x.metadata?.featureKind==="terrain").length,400);
assert.equal(enhanced.settings.georeference.terrainVerified,true);
assert.equal(enhanced.settings.georeference.minElevationM,20);
assert.equal(enhanced.settings.georeference.maxElevationM,60);
assert.equal(scene.objects.filter(x=>x.metadata?.featureKind==="terrain").length,0);
assert.equal(geo.elevationFromRgb(128,0,0),null);
assert.equal(geo.elevationFromRgb(0,3,232),10);
console.log("OK: 500m metric mapping, clipped road/rail/forest/building, source metadata, 400 DEM cells; no fabricated real measurements");