"use strict";
// Snapshot payload regression: verifies the registered map has saved features/terrain.
// Does not require live OSM/GSI services.
const assert=require("node:assert/strict");
const fs=require("node:fs"),zlib=require("node:zlib"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const data=JSON.parse(fs.readFileSync(path.join(root,"scenes/sakihana-saved-2026-11-09.packed.json"),"utf8"));
assert.equal(data.format,"scene-packed-deflate-v1");
const pack=JSON.parse(zlib.inflateSync(Buffer.from(data.payload,"base64")).toString("utf8"));
assert.equal(pack.a.length,88);
assert.equal(pack.t.length,400);
assert.equal(pack.a.filter(x=>x[6]==="building").length,69);
assert.equal(pack.a.filter(x=>x[6]==="road").length,11);
assert.equal(pack.a.filter(x=>x[6]==="railway").length,5);
assert.equal(pack.a.filter(x=>x[6]==="waterway").length,1);
assert.equal(pack.a.filter(x=>x[3]==="c").length,2);
assert(pack.a.some(x=>x[1]==="咲花駅"));
assert(pack.t.every(v=>Number.isInteger(v)));
const ids=new Set(pack.a.map(x=>x[0]));assert.equal(ids.size,88);
for(const feature of pack.a){
 if(feature[3]!=="p")continue;
 const p=feature[4];assert.equal(p.length%2,0);
 let x=0,y=0;for(let i=0;i<p.length;i+=2){
  x+=p[i];y+=p[i+1];
  assert(Math.abs(x)<=10000+1&&Math.abs(y)<=10000+1);
 }
}
const maps=JSON.parse(fs.readFileSync(path.join(root,"map-tree.json"),"utf8"));
assert(maps.maps.some(x=>x.id==="sakihana_gosen_500m"&&x.source.includes("sakihana-saved-2026-11-09.packed.json")));
console.log("OK: 88 stored OSM/reference objects + 400 elevation cells and registered map selector source");