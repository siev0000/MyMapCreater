const C=require("./effect-components.js"),M=require("./magic-catalog.js");
const assert=(v,m)=>{if(!v)throw Error(m)},near=(a,b)=>Math.abs(a-b)<1e-7;
assert(C.spellComparisons.length===4,"four comparison samples");
for(const d of C.spellComparisons){const c=C.spellSample(d.row),r=M.records.find(r=>r.id==="magic-cs-"+d.row);assert(r&&r.duration===c.duration,"same old duration "+d.row);assert(c.view===d.view&&!c.loop,"view and activation");assert(C.compile(c).source.length<=C.MAX_SOURCE,"source limit");assert(C.compile(JSON.parse(JSON.stringify(c))).source===C.compile(c).source,"deterministic");assert(C.referencedDefinitions(c).length===0,"builtins portable")}
const f=C.spellSample(252),i=C.spellSample(257),p=C.spellSample(245),n=C.spellSample(253);
assert(f.parts.length===2&&!f.parts.some(x=>x.partId==="fire-ring"),"no rings");
const rings=i.parts.filter(x=>x.partId==="fire-ring");assert(rings.length===3&&rings.every((x,j)=>x.version===2&&x.params.ringSeed===9+j),"three seeded rings");
const bullet=p.parts.find(x=>x.uid==="projectile");assert(near(bullet.end-bullet.start,.129)&&bullet.x===-.67&&bullet.endX===.72,"fast projectile");
assert(near(p.parts.find(x=>x.uid==="burst").start,bullet.end),"impact aligned");
const flight=n.parts.find(x=>x.uid==="flight");assert(flight.params.dx===.81&&flight.params.dy===-.35&&flight.params.arcHeight===.3,"smoky trajectory");
assert(n.parts.slice(-4).map(x=>x.partId).join(",")==="ground-smoke,fire-roll-cloud,fire-roll-soot,fire-residual","independent napalm layers");
assert(n.parts.slice(-4).every(x=>near(x.start,2.24)&&x.end===4.8&&x.x===.13),"blast time/location");
assert(C.compile(C.sample("convergence")).source===C.compile(f).source,"original convergence sample unchanged");
for(const d of C.representativeBuiltins){assert(C.origin(d.id,d.version)==="builtin","builtin");C.normalizeDefinition(d)}
console.log("representative spell tests passed");