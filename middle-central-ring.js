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
 const revealGuild=chosen?.id===facility.id||chosen?.parentId===facility.id;
 const revealTerminal=chosen?.id===facility.containedIn||revealGuild;
 const inR=ring.innerRadius,outR=ring.outerRadius,terminalR=ring.terminalOuterRadius||250;
 const passage=ring.passageways||[];
 const getGate=a=>passage.find(g=>g.angleDeg===a);
 ctx.save();
 ctx.lineJoin='round';
 // Circular transport hub (0–100m), common concourse/inspection (100–130m).
 const [cx,cy]=xy(facility.x,facility.y);
 const pxPerMetre=Math.abs(xy(facility.x+1,facility.y)[1]-cy)||.4;
 const circle=(r,fill,stroke,width=2)=>{
  ctx.beginPath();ctx.arc(cx,cy,r*pxPerMetre,0,Math.PI*2);
  ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();
 };
 circle(130,'rgba(71,111,137,.88)','#9cd7eb',2);
 circle(100,'rgba(30,65,87,.96)','#b8e0ef',2.5);
 ctx.beginPath();ctx.arc(cx,cy,terminalR*pxPerMetre,0,Math.PI*2);
 ctx.lineWidth=2;ctx.strokeStyle='#b3dbe6';ctx.stroke();
 // Eight stations in 4 pairs, grouped into 4 arc buildings.
 // Gaps are actual passageways; 48m for large-machine gates and 24m for pedestrians.
 for(let q=0;q<4;q++){
  const start=q*90+(getGate(q*90)?.halfAngleDeg||8);
  const end=(q+1)*90-(getGate(((q+1)*90)%360)?.halfAngleDeg||8);
  ringSector(ctx,xy,inR,outR,start,end);
  ctx.fillStyle=q%2?'rgba(171,137,90,.92)':'rgba(147,115,76,.94)';
  ctx.strokeStyle=chosen?.id===facility.id?'#fff3a3':'#f1d8a0';
  ctx.lineWidth=2;ctx.fill();ctx.stroke();
  const mid=(start+end)/2;
  const [a,b]=[worldPoint(inR,mid),worldPoint(outR,mid)];
  ctx.beginPath();ctx.moveTo(...xy(facility.x+a[0],facility.y+a[1]));ctx.lineTo(...xy(facility.x+b[0],facility.y+b[1]));
  ctx.strokeStyle='rgba(252,235,192,.55)';ctx.lineWidth=1;ctx.stroke();
  if(roads){ctx.strokeStyle='#ffe1aa';ctx.lineWidth=2;ctx.setLineDash([4,4]);strokeSegment(ctx,(x,y)=>xy(facility.x+x,facility.y+y),165,start+3,end-3);ctx.setLineDash([])}
 }
 // Gate gaps are structurally continuous, but separate traversal classes.
 // Draw the public and 48m heavy passages inside the terminal.
 if(roads)for(const gate of passage){
  const radial=worldPoint(1,gate.angleDeg),from=xy(facility.x+radial[0]*90,facility.y+radial[1]*90);
  const to=xy(facility.x+radial[0]*terminalR,facility.y+radial[1]*terminalR);
  ctx.save();ctx.lineCap='butt';ctx.lineJoin='round';
  const heavy=gate.access==='large_machine_authorized';
  ctx.strokeStyle=heavy?'rgba(168,116,215,.95)':'rgba(93,201,197,.90)';
  ctx.lineWidth=gate.width*pxPerMetre;ctx.beginPath();ctx.moveTo(...from);ctx.lineTo(...to);ctx.stroke();
  const inner=xy(facility.x+radial[0]*(inR-2),facility.y+radial[1]*(inR-2));
  const outer=xy(facility.x+radial[0]*(outR+2),facility.y+radial[1]*(outR+2));
  // Gate boundary marker: no ordinary access into heavy lanes.
  ctx.strokeStyle=heavy?'#edd1ff':'#b6faf0';ctx.lineWidth=3;
  for(const [x,y] of [inner,outer]){
   ctx.beginPath();ctx.arc(x,y,Math.max(4,gate.width*pxPerMetre*.23),0,Math.PI*2);ctx.stroke();
  }
  ctx.restore();
 }
 if(revealGuild){
 // Eight identical task counters and two adjoining briefing cubicles per station.
 const angles=ring.receptionAnglesDeg||[];
 for(let i=0;i<angles.length;i++){
  const a=angles[i],p=worldPoint(ring.receptionRadius||150,a);
  const [x,y]=xy(facility.x+p[0],facility.y+p[1]);
  ctx.save();ctx.translate(x,y);ctx.rotate((a-90)*Math.PI/180);
  ctx.fillStyle='#83d5f9';ctx.strokeStyle='#edfaff';ctx.lineWidth=1.2;
  ctx.fillRect(-6,-4,12,8);ctx.strokeRect(-6,-4,12,8);ctx.restore();
  for(const offset of [-5.5,5.5]){
   const v=worldPoint(ring.briefingRadius||180,a+offset),[rx,ry]=xy(facility.x+v[0],facility.y+v[1]);
   ctx.save();ctx.translate(rx,ry);ctx.rotate((a+offset-90)*Math.PI/180);
   ctx.fillStyle='#65536f';ctx.strokeStyle='#ecd6f3';ctx.lineWidth=1;
   ctx.fillRect(-5,-4,10,8);ctx.strokeRect(-5,-4,10,8);ctx.restore();
  }
  if(labels&&zoom>=1.65){
   ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.lineWidth=2.3;ctx.strokeStyle='#102737';ctx.strokeText('受付'+(i+1),x,y-11);
   ctx.fillStyle='#eff9ff';ctx.fillText('受付'+(i+1),x,y-11);
  }
 }
 // Management, conference, storage and specialist guild service positions.
 for(const child of facility.internalFacilities||[]){
  const [x,y]=xy(facility.x+child.dx,facility.y+child.dy);
  ctx.fillStyle=chosen?.id===child.id?'#fff3a0':'#e4c4a0';
  ctx.strokeStyle='#332c35';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(x,y,5.5,0,2*Math.PI);ctx.fill();ctx.stroke();
  if(labels&&zoom>=2.45){
   ctx.font='10px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.lineWidth=3;ctx.strokeStyle='#16202a';ctx.strokeText(child.short||child.name,x,y-14);
   ctx.fillStyle='#fff2d7';ctx.fillText(child.short||child.name,x,y-14);
  }
 }
 }
 if(labels&&revealTerminal){
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  ctx.strokeStyle='#122432';ctx.fillStyle='#f7f9fa';ctx.lineWidth=3;
  ctx.font='bold 12px system-ui';ctx.strokeText('乗降ホール',cx,cy-6);ctx.fillText('乗降ホール',cx,cy-6);
  ctx.font='10px system-ui';ctx.strokeText('一般・大型機',cx,cy+9);ctx.fillText('一般・大型機',cx,cy+9);
  if(chosen?.id===facility.containedIn){
   const p=xy(facility.x+210,facility.y+42);
   ctx.font='bold 11px system-ui';ctx.strokeStyle='#172a33';ctx.fillStyle='#ffe6b7';
   ctx.strokeText('レジストリンク・ドーム',p[0],p[1]);
   ctx.fillText('レジストリンク・ドーム',p[0],p[1]);
  }
  // The guild is located inside the tower, never at an external coordinate.
  if(revealGuild&&zoom>=1.25){
   const [lx,ly]=xy(facility.x+225,facility.y+45);
   ctx.font='bold 11px system-ui';ctx.strokeStyle='#12212d';ctx.fillStyle='#ffe5b2';ctx.lineWidth=3;
   ctx.strokeText('レジストリンク・ドーム（ターミナル内部）',lx,ly);
   ctx.fillText('レジストリンク・ドーム（ターミナル内部）',lx,ly);
  }
 }
 ctx.restore();
}
window.AAMiddleCentral={drawUrbanBlocks,drawGuild};
})();