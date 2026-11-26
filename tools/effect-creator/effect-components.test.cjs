const C=require("./effect-components.js");
const assert=(v,m)=>{if(!v)throw Error(m)};
const rejects=(fn,m)=>{let failed=false;try{fn()}catch{failed=true}assert(failed,m)};
const clone=x=>JSON.parse(JSON.stringify(x));
assert(C.library.length===14,"14 initial components");
assert(Object.isFrozen(C.library)&&Object.isFrozen(C.library[0]),"immutable registry");
for(const d of C.library){const c=C.create(d.duration,d.view==="BOTH"?"TOP":d.view);c.parts=[C.instance(d.id,"p",0,d.duration,d.version)];const r=C.compile(c);assert(r.source.includes("gl_FragColor=result"),d.id+" shader");assert(r.source.length<=C.MAX_SOURCE,d.id+" source cap")}
const a=C.sample("convergence"),b=C.sample("inferno");
assert(a.parts.length===2&&b.parts.length===5,"sample composition counts");
assert(b.parts.filter(p=>p.partId==="fire-ring").length===3,"three rings");
assert(a.parts[0].partId===b.parts[0].partId&&a.parts[0].version===b.parts[0].version,"shared fixed version");
assert(C.compile(b).source===C.compile(clone(b)).source,"deterministic roundtrip");
const many=C.create(3,"TOP");for(let i=0;i<12;i++)many.parts.push(C.instance("fire-ring","p"+i,0,2));
const code=C.compile(many).source;
assert((code.match(/vec4 part_fire_ring_v1\(/g)||[]).length===1,"dedup shared definitions");
assert((code.match(/vec4 a\d+=part_fire_ring_v1\(/g)||[]).length===12,"12 actual component instances");
for(const [label,change] of [["missing version",x=>delete x.parts[0].version],["unknown version",x=>x.parts[0].version=99],["invalid version type",x=>x.parts[0].version="1"],["invalid time",x=>x.parts[0].end=x.parts[0].start],["out-of-bounds",x=>x.parts[0].end=99],["duplicate uid",x=>x.parts[1].uid=x.parts[0].uid],["invalid color",x=>x.parts[0].tint="invalid"],["unknown param",x=>x.parts[0].params.inject=2],["view mismatch",x=>x.view="SIDE"]]){let x=clone(b);change(x);rejects(()=>C.compile(x),label)}
let x=C.create(2,"SIDE");x.parts=[C.instance("shockwave","s",0,.65)];x.parts[0].params.squash=2;rejects(()=>C.compile(x),"parameter bounds");
x=C.create(3,"TOP");x.parts=Array.from({length:33},(_,i)=>C.instance("fire-ring","p"+i,0,2));rejects(()=>C.compile(x),"part limit");
x=clone(b);x.parts[1].enabled=false;assert((C.compile(x).source.match(/vec4 a\d+=part_fire_ring_v1\(/g)||[]).length===2,"disabled part skipped");
console.log("component model tests passed");