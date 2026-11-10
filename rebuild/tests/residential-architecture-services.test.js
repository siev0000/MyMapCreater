/* node rebuild/tests/residential-architecture-services.test.js */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"..","building-templates.js"),"utf8");
const env={window:{}};vm.runInNewContext(source,env);
const library=env.window.AAMapBuildingTemplates;
const presets=library.allPresets().filter(t=>t.modernPlan);
const step=.25;
let windows=0,services=0,checkedFloors=0;
for(const t of presets){
 const objects=library.generate(t.id,{prefix:"test",spacing:1}).objects;
 const windowsHere=objects.filter(o=>o.objectType==="window");
 assert.ok(windowsHere.length>=1,t.id+" exterior window missing");
 for(const win of windowsHere){
  windows++;
  const [a,b]=win.geometry.points;
  const isHorizontal=Math.abs(a[1]-b[1])<1e-8;
  const aligned=isHorizontal?(Math.abs(a[1])<1e-8||Math.abs(a[1]-t.cells[1])<1e-8):
   (Math.abs(a[0])<1e-8||Math.abs(a[0]-t.cells[0])<1e-8);
  assert.ok(aligned,t.id+" window must lie on exterior wall");
  for(const wall of objects.filter(o=>o.objectType==="wall"&&o.floorId===win.floorId)){
   const [c,d]=wall.geometry.points;
   if(isHorizontal&&Math.abs(c[1]-d[1])<1e-8&&Math.abs(c[1]-a[1])<1e-8)
    assert.ok(Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))-
     Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=1e-7,
     t.id+" window is blocked by an exterior wall");
   if(!isHorizontal&&Math.abs(c[0]-d[0])<1e-8&&Math.abs(c[0]-a[0])<1e-8)
    assert.ok(Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]))-
     Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=1e-7,
     t.id+" window is blocked by an exterior wall");
  }
 }
 for(const kind of ["ceiling_light","light_switch","power_outlet","air_conditioner",
  "ventilation_fan","range_hood","water_heater"]){
  const n=objects.filter(o=>o.shapePresetId===kind).length;
  assert.ok(n>=1,t.id+" missing "+kind);services+=n;
 }
 for(let floorIndex=0;floorIndex<t.modernPlan.length;floorIndex++){
  const plan=t.modernPlan[floorIndex],floor=(floorIndex+1)+"F";
  const os=objects.filter(o=>o.floorId===floor);
  const walls=os.filter(o=>o.objectType==="wall").map(o=>o.geometry.points);
  const solids=os.filter(o=>o.objectType==="stair"||
   (o.objectType==="object"&&!o.metadata?.fixtureCollisionExcluded)).map(o=>o.geometry);
  const W=t.cells[0]*4,H=t.cells[1]*4;
  const available=new Uint8Array(W*H),visited=new Uint8Array(W*H);
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){
   const x=(i+.5)*step,y=(j+.5)*step;
   available[j*W+i]=solids.some(g=>x>g.x+.01&&x<g.x+g.width-.01&&
    y>g.y+.01&&y<g.y+g.height-.01)?0:1;
  }
  let start;
  if(floorIndex===0){
   const entrance=os.find(o=>o.objectType==="door"&&o.opening?.external);
   assert.ok(entrance,t.id+" missing external entrance");
   start=[(entrance.geometry.points[0][0]+entrance.geometry.points[1][0])/2,
    t.cells[1]-.375];
  }else{
   const stair=os.find(o=>o.objectType==="stair");
   assert.ok(stair,t.id+" upper-floor staircase missing");
   start=[stair.geometry.x+stair.geometry.width/2,
    stair.geometry.y+stair.geometry.height+.375];
   const stairRoom=plan.rooms.find(r=>r[2]<=stair.geometry.x&&r[3]<=stair.geometry.y&&
    r[2]+r[4]>=stair.geometry.x+stair.geometry.width&&
    r[3]+r[5]>=stair.geometry.y+stair.geometry.height);
   assert.ok(stairRoom,t.id+" staircase must fit in a dedicated room");
   assert.ok(stairRoom[3]+stairRoom[5]-(stair.geometry.y+stair.geometry.height)>=1.5,
    t.id+" insufficient lower stair landing");
  }
  const sx=Math.max(0,Math.min(W-1,Math.floor(start[0]*4)));
  const sy=Math.max(0,Math.min(H-1,Math.floor(start[1]*4)));
  assert.ok(available[sy*W+sx],t.id+"/"+floor+" entry or stair landing blocked");
  const blocked=(i,j,ni,nj)=>{
   const x=(i+.5)*step,y=(j+.5)*step,nx=(ni+.5)*step,ny=(nj+.5)*step;
   for(const [a,b] of walls){
    if(Math.abs(a[0]-b[0])<1e-8&&Math.min(x,nx)<a[0]&&Math.max(x,nx)>a[0]&&
     y>Math.min(a[1],b[1])&&y<Math.max(a[1],b[1]))return true;
    if(Math.abs(a[1]-b[1])<1e-8&&Math.min(y,ny)<a[1]&&Math.max(y,ny)>a[1]&&
     x>Math.min(a[0],b[0])&&x<Math.max(a[0],b[0]))return true;
   }
   return false;
  };
  const queue=[sy*W+sx];let index=0;visited[queue[0]]=1;
  while(index<queue.length){
   const pos=queue[index++],i=pos%W,j=Math.floor(pos/W);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const ni=i+dx,nj=j+dy;
    if(ni<0||ni>=W||nj<0||nj>=H)continue;
    const dest=nj*W+ni;
    if(!visited[dest]&&available[dest]&&!blocked(i,j,ni,nj)){
     visited[dest]=1;queue.push(dest);
    }
   }
  }
  for(const room of plan.rooms){
   let reachable=false;
   for(let j=room[3]*4;j<(room[3]+room[5])*4&&!reachable;j++)
    for(let i=room[2]*4;i<(room[2]+room[4])*4;i++)
     if(visited[j*W+i]){reachable=true;break;}
   assert.ok(reachable,t.id+"/"+floor+" cannot walk to "+room[1]);
  }
  checkedFloors++;
 }
}
console.log("PASS",presets.length,"home templates,",checkedFloors,"floors,",
 windows,"clear external window openings,",services,"building-service symbols");
