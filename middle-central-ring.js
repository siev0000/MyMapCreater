/* Middle-floor central-city visualization. Draft only; source geometry is data/middle-layout-draft.json.
   This module never changes navigation, official Notion data, or routes. */
(function(){
'use strict';
function worldPoint(r,deg) {
 const a=deg*Math.PI/180;
 return [r*Math.cos(a),r*Math.sin(a)];
}
function strokeSegment(ctx,xy,r,a0,a1) {
 const steps=Math.max(6,Math.ceil((a1-a0)/3));
 ctx.beginPath();
 for(let i=0;i<=steps;i++){
  const pt=worldPoint(r,a0+(a1-a0)*i/steps);
  const [u,v]=xy(...pt);if(!i)ctx.moveTo(u,v);else ctx.lineTo(u,v);
 }
 ctx.stroke();
}
function ringSector(ctx,xy,rIn,rOut,a0,a1) {
 const steps=Math.max(8,Math.ceil((a1-a0)/2));
 ctx.beginPath();
 for(let i=0;i<=steps;i++){
  const [u,v]=xy(...worldPoint(rOut,a0+(a1-a0)*i/steps));
  if(!i)ctx.moveTo(u,v);else ctx.lineTo(u,v);
 }
 for(let i=steps;i>=0;i--){
  const [u,v]=xy(...worldPoint(rIn,a0+(a1-a0)*i/steps));ctx.lineTo(u,v);
 }
 ctx.closePath();
}
function drawUrbanBlocks(ctx,xy,model,options={}){
 if(!model?.urbanBlocks?.length)return;
 const {zoom=1,labels=true}=options;
 ctx.save();
 for(const b of model.urbanBlocks) {
  const [cx,cy]=xy(b.x,b.y),w=b.h*.4,h=b.w*.4;
  ctx.fillStyle=b.role==='workshop'?'rgba(142,105,144,.88)':'rgba(82,139,137,.83)';
  ctx.strokeStyle=b.role==='workshop'?'#e5c4f1':'#b4e6d5';
  ctx.lineWidth=1.4;ctx.fillRect(cx-w/2,cy-h/2,w,h);ctx.strokeRect(cx-w/2,cy-h/2,w,h);
  ctx.strokeStyle='rgba(240,251,254,.35)';ctx.lineWidth=.8;
  ctx.beginPath();ctx.moveTo(cx-w/2+3,cy);ctx.lineTo(cx+w/2-3,cy);ctx.stroke();
  if(labels&&zoom>=1.45){
   ctx.font='10px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.strokeStyle='#101f28';ctx.lineWidth=3;ctx.strokeText(b.name,cx,cy,w+16);
   ctx.fillStyle='#f2fbff';ctx.fillText(b.name,cx,cy,w+16);
  }
 }
 ctx.restore();
}
function drawGuild(ctx,xy,facility,options={}){
 const ring=facility?.ringComplex;if(!ring)return;
 const {zoom=1,labels=true,chosen=null,roads=true}=options;
 const inR=ring.innerRadius,outR=ring.outerRadius;
 ctx.save();
 // Four 80-degree arc buildings. The 10-degree gaps are physical openings,
 // not closed traversable building surfaces.
 for(let q=0;q<4;q++){
  const start=5+q*90,end=85+q*90;
  ringSector(ctx,xy,inR,outR,start,end);
  ctx.fillStyle=q%2?'rgba(154,129,82,.88)':'rgba(135,111,76,.9)';
  ctx.strokeStyle=chosen?.id===facility.id?'#fff3a3':'#f0dba4';
  ctx.lineWidth=2;ctx.fill();ctx.stroke();
  // Divide each quadrant into two independently staffed reception-and-briefing groups.
  const angle=45+90*q,a=worldPoint(inR,angle),b=worldPoint(outR,angle);
  ctx.beginPath();ctx.moveTo(...xy(...a));ctx.lineTo(...xy(...b));
  ctx.strokeStyle='rgba(248,231,187,.65)';ctx.lineWidth=1;ctx.stroke();
 }
 // Annular pedestrian corridor is internal only and interrupted at every passage.
 if(roads){
  ctx.save();ctx.strokeStyle='#f6e7bf';ctx.lineWidth=3.5;ctx.setLineDash([6,4]);
  for(let q=0;q<4;q++)strokeSegment(ctx,xy,369,6+q*90,84+q*90);
  ctx.setLineDash([]);ctx.restore();
 }
 // Reception windows face inward. Two small briefing rooms adjoin each service desk.
 const angles=ring.receptionAnglesDeg||[];
 for(let i=0;i<angles.length;i++){
  const angle=angles[i],p=worldPoint(ring.receptionRadius||355,angle);
  const [sx,sy]=xy(...p);
  ctx.save();ctx.translate(sx,sy);ctx.rotate((angle-90)*Math.PI/180);
  ctx.fillStyle='#8ed5f3';ctx.strokeStyle='#edfaff';ctx.lineWidth=1.2;
  ctx.fillRect(-6,-3,12,6);ctx.strokeRect(-6,-3,12,6);ctx.restore();
  for(const off of [-4.6,4.6]){
   const [mx,my]=xy(...worldPoint(ring.briefingRadius||393,angle+off));
   ctx.save();ctx.translate(mx,my);ctx.rotate((angle+off-90)*Math.PI/180);
   ctx.fillStyle='#5e5369';ctx.strokeStyle='#f1dfc6';ctx.lineWidth=1;
   ctx.fillRect(-5,-4,10,8);ctx.strokeRect(-5,-4,10,8);ctx.restore();
  }
  if(labels&&zoom>=1.8){
   ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.lineWidth=2.5;ctx.strokeStyle='#152632';ctx.strokeText(String(i+1),sx,sy-8);
   ctx.fillStyle='#f3fbff';ctx.fillText(String(i+1),sx,sy-8);
  }
 }
 // Authorized large-machine corridors are distinctly separated from ordinary halls.
 for(const gate of ring.passageways||[]){
  const at=worldPoint((inR+outR)/2,gate.angleDeg),[x,y]=xy(...at);
  ctx.save();ctx.translate(x,y);ctx.rotate((gate.angleDeg-90)*Math.PI/180);
  const machine=gate.access==='large_machine_authorized';
  ctx.strokeStyle=machine?'#e1b2ff':'#8ee4e0';
  ctx.lineWidth=machine?3:2;
  ctx.beginPath();ctx.moveTo(-gate.width*.2,-9);ctx.lineTo(-gate.width*.2,9);
  ctx.moveTo(gate.width*.2,-9);ctx.lineTo(gate.width*.2,9);
  ctx.stroke();
  if(machine){
   ctx.fillStyle='#e5c7ff';ctx.fillRect(-3,-3,6,6);
  }
  ctx.restore();
 }
 if(labels){
  const [lx,ly]=xy(470,120);
  ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.lineWidth=4;ctx.strokeStyle='#17242c';ctx.strokeText('レジストリンク・ドーム〈環状受付〉',lx,ly);
  ctx.fillStyle='#fbe6b5';ctx.fillText('レジストリンク・ドーム〈環状受付〉',lx,ly);
  if(zoom>=1.35){
   const [tx,ty]=xy(-450,95);
   ctx.font='11px system-ui';ctx.strokeText('8受付区＋各小作戦室／大型機専用開口2か所',tx,ty);
   ctx.fillStyle='#f4deb0';ctx.fillText('8受付区＋各小作戦室／大型機専用開口2か所',tx,ty);
  }
 }
 ctx.restore();
}
window.AAMiddleCentral={drawUrbanBlocks,drawGuild};
})();