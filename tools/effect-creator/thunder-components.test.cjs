"use strict";
const assert=require("node:assert/strict");
globalThis.LightningEffects=require("./lightning-presets.js");
const S=require("./shader-studio.js"),C=require("./effect-components.js"),T=require("./thunder-components.js");
const A=require("./spell-assignments.js").create(C,S.records,{});
const records=S.records.filter(r=>r.id.startsWith("thunder-"));
assert.equal(T.recipeCount,25);
assert.equal(records.length,31);
assert.equal(C.thunderBuiltins.length,136);
for(const r of records){
 const init=A.initial(r.id),c=init.composition;
 assert.equal(init.kind,"thunder-extracted",r.id);
 assert.equal(c.duration,r.duration);
 assert.equal(c.loop,r.loop);
 assert.ok(c.parts.length>=2);
 const compiled=C.compile(c);
 assert.match(compiled.source,/vec4 result=tc_/);
 assert.ok(compiled.source.length<=C.MAX_SOURCE);
 for(const part of c.parts){
  const one=C.create(c.duration,c.view);
  one.parts=[part];one.loop=c.loop;
  assert.match(C.compile(one).source,/tc_/);
 }
 const moved=structuredClone(c);moved.parts[0].x=moved.parts[0].endX=.1;
 assert.match(C.compile(moved).source,/part_thunder_extract_/);
 const toggled=structuredClone(c);toggled.parts[0].enabled=false;
 assert.match(C.compile(toggled).source,/vec4 result=tc_/);
 const strength=structuredClone(c);strength.parts[0].params.strength=.5;
 assert.ok(C.compile(strength).source.includes("0.50000000"));
 const snapshot=A.snapshot(r.id,{format:"glsl-component-composition",magicId:r.id,composition:c,definitions:C.referencedDefinitions(c),output:{width:128,height:128,fps:12,columns:0,color:r.color||"#ff8634",core:"#ffffff"}});
 assert.equal(snapshot.magicId,r.id);
 assert.equal(snapshot.composition.parts.length,c.parts.length);
}
console.log("Thunder extraction model: 31 recipes, 136 built-in parts. GLSL generation and assignments passed; WebGL rendering not tested.");
