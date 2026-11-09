/* General-purpose geographic import test, with mocked geocoder and Overpass.
 * No external API calls. Run: node rebuild/tests/geodata-any-region.js */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const src=fs.readFileSync(path.resolve(__dirname,"../sakihana-map.js"),"utf8");
const window={};let calls=[];
const c=vm.createContext({window,Date,Math,Number,Error,URL,AbortController,setTimeout,clearTimeout,
 fetch:async url=>{
  calls.push(url);
  return {ok:true,json:async()=>[{display_name:"長岡駅, 新潟県",lat:"37.4476",lon:"138.8513"}]};
 }});
vm.runInContext(src,c);
const geo=window.AASakihanaMap;
assert.equal(geo.HALF_M,250);
assert.equal(geo.baseScene().id,"sakihana_gosen_500m");
assert.equal(geo.baseScene().settings.georeference.worldUnitsPerMeter,4);
const initial=geo.bbox();
const options=[
 {name:"長岡駅",lat:37.4476,lon:138.8513,sizeM:250},
 {name:"青森市",lat:40.8222,lon:140.7474,sizeM:1000},
 {name:"山間部",lat:36.4,lon:137.4,sizeM:2000},
];
for(const opt of options){
 const chosen=geo.configure(opt),scene=geo.baseScene(),b=geo.bbox().split(",").map(Number);
 assert.equal(chosen.sizeM,opt.sizeM);
 assert.equal(scene.settings.georeference.widthM,opt.sizeM);
 assert.equal(scene.settings.georeference.regionName,opt.name);
 assert(scene.id.startsWith("geo_"));
 assert.equal(scene.objects.length,1);
 assert(b[0]<opt.lat&&b[1]<opt.lon&&b[2]>opt.lat&&b[3]>opt.lon);
 assert(Math.abs(geo.toLonLat(...geo.fromLonLat({lat:opt.lat,lon:opt.lon})).lat-opt.lat)<1e-9);
 const half=opt.sizeM*2;
 assert.equal(geo.BOUNDS.maxX,half);
 assert.equal(geo.BOUNDS.minY,-half);
 const p={elements:[{type:"way",id:42,tags:{highway:"residential"},geometry:[
  {lat:opt.lat,lon:opt.lon-.001},{lat:opt.lat,lon:opt.lon+.001}]}]};
 const converted=geo.fromOverpass(p);
 assert.equal(converted.objects.filter(o=>o.metadata?.featureKind==="road").length,1);
 assert.equal(converted.id,scene.id);
 const samples=Array.from({length:21},(_,j)=>Array.from({length:21},(_,i)=>10+i+j));
 const terrain=geo.addElevation(converted,{
  samples,stepM:opt.sizeM/20,source:"mock",zoom:15,min:10,max:50,
  retrievedAt:"2026-11-09T00:00:00Z",known:441,total:441
 });
 assert.equal(terrain.objects.filter(o=>o.metadata?.featureKind==="terrain").length,400);
 assert.equal(terrain.objects.find(o=>o.id==="gsi_terrain_0_0").geometry.width,opt.sizeM/20*4);
}
assert.notEqual(initial,geo.bbox());
assert.throws(()=>geo.configure({lat:"",lon:138,sizeM:500}),/緯度/); // invalid lat zero? "" becomes 0 => test only out of range
assert.throws(()=>geo.configure({lat:90,lon:138,sizeM:500}),/緯度/);
assert.throws(()=>geo.configure({lat:37,lon:138,sizeM:5000}),/範囲/);
(async()=>{
 const results=await geo.searchPlace("新潟県長岡駅");
 assert.equal(results[0].name,"長岡駅, 新潟県");
 assert.match(calls[0],/nominatim.openstreetmap.org/);
 console.log("OK: default Sakihana, three chosen regions, metric bounds, OSM clipping, dynamic DEM cells, search source");
})().catch(e=>{console.error(e);process.exitCode=1});