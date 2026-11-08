/* AA structural draft overlay v1. Display-only proposal: does not affect paths or Notion settings. */
(function(){
'use strict';
const MODEL={
  upper:{
    columns:[[-1400,-215],[-1410,205],[-600,-255],[-600,255],[900,-265],[900,265],
      [-1600,-1000],[-1300,-1000],[-1000,-1100],[-600,-1100],[-200,-1150],[200,-1150],[600,-1180],[1000,-1200],[1500,-950],
      [-1600,1000],[-1300,1000],[-1000,1100],[-600,1100],[-200,1150],[200,1150],[600,1180],[1000,1200],[1500,950]],
    partitions:[{id:'upper-magitech-boundary',name:'研究区境界（左舷側・候補）',points:[[-1650,-250],[1650,-250]]},
      {id:'upper-eidolon-boundary',name:'研究区境界（右舷側・候補）',points:[[-1650,250],[1650,250]]}],
    gateChecks:[
      {name:'マギテック認証門',facility:'upper_shared_security_magitech',route:'upper_magitech_gate_corridor'},
      {name:'エイドロン認証門',facility:'upper_shared_security_eidolon',route:'upper_eidolon_gate_corridor'}]
  },
  middle:{
    columns:[[0,-730],[400,-650],[650,-450],[650,450],[400,650],[0,730],[-400,650],[-400,-650],
      [-1500,1000],[-1000,900],[-1500,-900],[-1000,-900],[1000,-400],[1000,400],[1350,-350],[1350,350]],
    partitions:[{id:'middle-arbora-boundary',name:'アルボラ環境区境界（候補）',points:[[-1560,-630],[-530,-630],[-530,630],[-1560,630],[-1560,-630]]}],
    gateChecks:[]
  },
  lower:{
    columns:[[-60,-760],[400,-800],[680,-400],[700,0],[680,400],[400,700],[0,700],[-300,670],[-360,-700],
      [900,-440],[1300,-440],[1700,-440],[900,-240],[1300,-240],[1700,-240],
      [900,240],[1300,240],[1700,240],[900,440],[1300,440],[1700,440]],
    // X=700 closed boundary and Y=0 sortie split already drawn by the existing map.
    partitions:[],gateChecks:[]
  }
};
// A broad structural grid for the 4km x 2.5km vessel. All locations are design
// candidates only, not approved columns nor an engineering load calculation.
// Use two interleaved lattices to cover the long hull without excessive clutter.
function proposedMiddleSupports(){
 const supports=[];
 for(let x=-1540;x<=1540;x+=440){
  for(let y=-840;y<=840;y+=420)supports.push({point:[x,y],primary:true});
 }
 for(let x=-1320;x<=1320;x+=440){
  for(let y=-630;y<=630;y+=420)supports.push({point:[x,y],primary:false});
 }
 // Extra supports around the large terminal/urban circular structure.
 for(let n=0;n<16;n++){
  const rad=n*Math.PI/8;
  supports.push({point:[Math.round(750*Math.cos(rad)),Math.round(750*Math.sin(rad))],primary:true});
 }
 return supports;
}
function withinStructuralEnvelope(point){
 const [x,y]=point;
 // Restrict to the protected interior, rather than the full outer hull.
 // This is a conservative graphic guard only; actual frame offsets are unverified.
 if(Math.abs(x)>1730)return false;
 const allowedY=820-Math.max(0,Math.abs(x)-1050)*.24;
 return Math.abs(y)<=allowedY;
}
function segmentDistance(p,a,b){
 const vx=b[0]-a[0],vy=b[1]-a[1],q=vx*vx+vy*vy;
 const t=q?Math.max(0,Math.min(1,((p[0]-a[0])*vx+(p[1]-a[1])*vy)/q)):0;
 return Math.hypot(p[0]-a[0]-t*vx,p[1]-a[1]-t*vy);
}
function inside(p,poly){
 let result=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])result=!result;
 }
 return result;
}
function shape(f){
 const local=Array.isArray(f.footprint)&&f.footprint.length>=3?f.footprint:
  [[-f.w/2,-f.h/2],[f.w/2,-f.h/2],[f.w/2,f.h/2],[-f.w/2,f.h/2]];
 return local.map(a=>[a[0]+f.x,a[1]+f.y]);
}
function distanceToShape(p,poly){
 if(inside(p,poly))return 0;
 let best=Infinity;
 for(let i=0;i<poly.length;i++)best=Math.min(best,segmentDistance(p,poly[i],poly[(i+1)%poly.length]));
 return best;
}
function isClear(p,facilities,roads,facilityMargin,roadMargin){
 if(facilities.some(f=>!f.ringDistrict&&!f.zoneOutline&&distanceToShape(p,shape(f))<facilityMargin))return false;
 for(const r of roads){
  if(r.kind==='line'&&Array.isArray(r.points)){
   for(let i=1;i<r.points.length;i++){
    if(segmentDistance(p,r.points[i-1],r.points[i])<(r.width||0)/2+roadMargin)return false;
   }
  }else if(r.kind==='ring'&&Number.isFinite(r.r)){
   if(Math.abs(Math.hypot(p[0],p[1])-r.r)<(r.width||0)/2+roadMargin)return false;
  }
 }
 // The circular central terminal and public concourse must remain clear.
 if(Math.hypot(p[0],p[1])<365)return false;
 return true;
}
function drawPartition(ctx,xy,part,facilities,roads){
 const pts=part.points;
 let open=false;
 ctx.save();ctx.strokeStyle='rgba(255,191,117,.90)';ctx.lineWidth=2.5;ctx.setLineDash([5,6]);
 for(let k=1;k<pts.length;k++){
  let a=pts[k-1],b=pts[k],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(len/10);
  for(let i=0;i<=n;i++){
   const t=i/n,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],valid=isClear(p,facilities,roads,20,10);
   if(valid){if(!open){ctx.beginPath();ctx.moveTo(...xy(...p));open=true}else ctx.lineTo(...xy(...p))}
   else if(open){ctx.stroke();open=false}
  }
  if(open){ctx.stroke();open=false}
 }
 ctx.restore();
}
function draw(ctx,xy,{floor,facilities=[],roads=[]}={}){
 const data=MODEL[floor];if(!data)return;
 ctx.save();
 for(const part of data.partitions)drawPartition(ctx,xy,part,facilities,roads);
 const activeRoads=roads.filter(r=>!String(r.geometryStatus||'').startsWith('stale_'));
 const supportCandidates=floor==='middle'?proposedMiddleSupports():
   data.columns.map(point=>({point,primary:true}));
 const placed=[];
 for(const {point,primary} of supportCandidates){
  if(!withinStructuralEnvelope(point))continue;
  if(!isClear(point,facilities,activeRoads,primary?55:40,primary?36:28))continue;
  // Avoid drawing a denser cluster of markers in the same area.
  if(placed.some(p=>Math.hypot(p[0]-point[0],p[1]-point[1])<140))continue;
  placed.push(point);
  const [x,y]=xy(...point),size=primary?17:13,half=size/2;
  ctx.save();
  ctx.fillStyle=primary?'rgba(68,151,174,.82)':'rgba(62,128,148,.68)';
  ctx.strokeStyle=primary?'#d4faff':'#a2d9ea';
  ctx.lineWidth=primary?2:1.5;
  ctx.fillRect(x-half,y-half,size,size);
  ctx.strokeRect(x-half,y-half,size,size);
  // Reinforced core mark makes it recognizable as a post, not a grid cell.
  if(primary){ctx.fillStyle='#153743';ctx.fillRect(x-2.5,y-2.5,5,5);}
  ctx.restore();
 }
 for(const gate of data.gateChecks){
  const f=facilities.find(o=>o.id===gate.facility),r=roads.find(o=>o.id===gate.route);
  if(!f||!r||r.kind!=='line'||r.points?.length<2)continue;
  const p=[f.x,f.y];
  let d=Infinity,q=null;
  for(let i=1;i<r.points.length;i++){
   const a=r.points[i-1],b=r.points[i],vx=b[0]-a[0],vy=b[1]-a[1];
   const denom=vx*vx+vy*vy,t=denom?Math.max(0,Math.min(1,((p[0]-a[0])*vx+(p[1]-a[1])*vy)/denom)):0;
   const point=[a[0]+vx*t,a[1]+vy*t],distance=Math.hypot(p[0]-point[0],p[1]-point[1]);
   if(distance<d){d=distance;q=point}
  }
  if(q&&d>50){
   const a=xy(...p),b=xy(...q);
   ctx.save();ctx.strokeStyle='#ffdf62';ctx.lineWidth=2;ctx.setLineDash([4,5]);
   ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();ctx.setLineDash([]);
   ctx.fillStyle='#ffdf62';ctx.beginPath();ctx.arc(...a,7,0,Math.PI*2);ctx.fill();
   ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.strokeStyle='#1b2329';ctx.lineWidth=3;
   ctx.strokeText('!',a[0],a[1]+4);ctx.fillStyle='#202020';ctx.fillText('!',a[0],a[1]+4);
   ctx.restore();
  }
 }
 ctx.restore();
}
window.AAStructureOverlay={draw,model:MODEL};
})();