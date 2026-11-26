const C=require("./effect-components.js");
const assert=(v,m)=>{if(!v)throw Error(m)};
const reject=(fn,m)=>{let failed=false;try{fn()}catch{failed=true}assert(failed,m)};
const d={id:"typed-test",version:1,name:"型テスト",category:"試験",view:"BOTH",duration:1,description:"",dependencies:["fire-common@1"],body:"float a=ball(p,vec2(0.),radius)*float(count)*.2;return vec4(enabled?color:vec3(0.),a);",params:[{id:"radius",name:"半径",type:"float",unit:"倍",min:.1,max:1,default:.3,step:.05},{id:"count",name:"個数",type:"int",min:1,max:10,default:3,step:1},{id:"enabled",name:"表示",type:"bool",default:true},{id:"color",name:"色",type:"color",default:"#FF8000"}]};
const norm=C.normalizeDefinition(d);assert(norm.params[3].default==="#ff8000","color normalize");assert(norm.params[0].unit==="倍","unit preserved");
const pre=C.previewDefinition(d);assert(pre.source.includes("float radius,int count,bool enabled,vec3 color"),"typed signature");assert(pre.source.includes(",0.3,3,true,vec3(1.0,0.50196078,0.0))"),"typed literals");
C.installDefinitions([d]);const c=C.create(1,"TOP");c.parts=[C.instance(d.id,"a",0,1),C.instance(d.id,"b",0,1)];c.parts[1].params={radius:.8,count:7,enabled:false,color:"#0000ff"};const code=C.compile(c).source;assert(code.includes(",0.8,7,false,vec3(0.0,0.0,1.0))"),"independent overrides");assert(C.compile(JSON.parse(JSON.stringify(c))).source===code,"roundtrip");assert(C.referencedDefinitions(c)[0].params[3].type==="color","portable definition");
for(const [k,v] of [["radius",9],["count",1.5],["enabled",1],["color","blue"]]){const x=JSON.parse(JSON.stringify(c));x.parts[0].params[k]=v;reject(()=>C.compile(x),"invalid "+k)}
reject(()=>C.normalizeDefinition({...d,params:[d.params[0],d.params[0]]}),"duplicate parameter");
reject(()=>C.normalizeDefinition({...d,params:[{...d.params[1],step:.5}]}),"integer step");
reject(()=>C.normalizeDefinition({...d,params:[{...d.params[0],type:"unknown"}]}),"unknown type");
const nap=C.create(2.56,"SIDE");nap.parts=[C.instance("napalm-cloud","p",0,2.56,2)];const original=C.compile(nap).source;nap.parts[0].params.smoke=.2;nap.parts[0].params.residual=false;assert(C.compile(nap).source!==original,"napalm controls");assert(C.get("napalm-cloud",1).params.length===0,"old napalm untouched");assert(C.referencedDefinitions(nap).length===0,"builtin v2");
console.log("typed parameter tests passed");