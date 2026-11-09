/* Synthetic HTTP failure test; does not call public Overpass endpoints. */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const source=fs.readFileSync(path.resolve(__dirname,"../sakihana-map.js"),"utf8");
const c={lat:37.7351639,lon:139.2909028};
const payload={elements:[{type:"way",id:100,tags:{highway:"residential"},geometry:[
 {lat:c.lat,lon:c.lon-.001},{lat:c.lat,lon:c.lon+.001}]}]};
async function test(){
 const requests=[],window={};
 const sandbox={
  window,URL,setTimeout,clearTimeout,AbortController,Date,
  fetch:async(url,options)=>{
   requests.push({url,method:options.method,body:options.body});
   if(requests.length===1)return{ok:false,status:502};
   return{ok:true,json:async()=>payload};
  }
 };
 vm.runInNewContext(source,sandbox);
 const scene=await window.AASakihanaMap.loadOSM();
 assert.equal(requests.length,2,"Should fall back when primary returns 502");
 assert.match(requests[0].url,/private\.coffee/);
 assert.match(requests[1].url,/lz4\.overpass-api\.de/);
 assert(requests.every(r=>r.method==="POST"&&r.body.startsWith("data=")));
 assert.equal(scene.objects.filter(o=>o.metadata?.featureKind==="road").length,1);
 assert.equal(scene.settings.georeference.overpassEndpoint,requests[1].url);
 const failed={window:{},URL,setTimeout,clearTimeout,AbortController,Date,
  fetch:async()=>({ok:false,status:502})};
 vm.runInNewContext(source,failed);
 await assert.rejects(()=>failed.window.AASakihanaMap.loadOSM(),e=>
  /502/.test(e.message)&&/既存マップは変更されません/.test(e.message));
 console.log("OK: HTTP 502 fallback, successful scene conversion, source endpoint recording and all-failure diagnostics");
}
test().catch(e=>{console.error(e);process.exitCode=1});