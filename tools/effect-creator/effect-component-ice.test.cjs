const C=require("./effect-components.js"),M=require("./magic-catalog.js"),SA=require("./spell-assignments.js");
const ok=(v,m)=>{if(!v)throw Error(m)};
ok(C.iceBuiltins.length===14,"14 ice definitions");ok(C.iceSamples.length===5,"4 magic + sustain");
for(const d of C.iceBuiltins){C.normalizeDefinition(d);const c=C.create(d.duration,d.view==="BOTH"?"TOP":d.view);c.loop=d.category==="氷・持続";c.parts=[C.instance(d.id,"p",0,d.duration)];const s=C.compile(c).source;ok(s.includes("vec4 iceFacet("),"ice helper");ok(C.referencedDefinitions(c).length===0,"builtin");ok(C.compile(JSON.parse(JSON.stringify(c))).source===s,"roundtrip")}
for(const d of C.iceSamples){const c=C.iceSample(d.id),r=M.records.find(r=>r.id===d.id);ok(r.duration===c.duration&&r.loop===c.loop,"legacy duration/loop");ok(c.view===d.view,"view");ok(C.compile(c).source.length<=C.MAX_SOURCE,"compile source");ok(SA.create(C,M.records,M.rows).initial(d.id).kind==="sample","auto load")}
const tower=C.iceSample("magic-cs-285");ok(tower.parts.some(p=>p.partId==="ice-tower-rise"),"tower rises");ok(!tower.parts.some(p=>p.y>0),"no falling");
ok(C.iceSample("magic-cs-281").view==="TOP","radial floor freeze");
const polar=C.iceSample("magic-cs-288-sustain");ok(polar.loop&&polar.parts.every(p=>p.partId.endsWith("-sustain")),"separate sustain");
ok((C.compile(tower).source.match(/vec4 iceFacet\(/g)||[]).length===1,"dependency dedup");ok(!C.compile(C.sample("inferno")).source.includes("vec4 iceFacet("),"fire unaffected");
console.log("ice component tests passed");