/* AA terminal interior study v1 for upper and lower floor.
   No Notion changes, no implicit road connections. Shared tower diameter 500m. */
(function(){
'use strict';
const polar=(radius,deg)=>[radius*Math.cos(deg*Math.PI/180),radius*Math.sin(deg*Math.PI/180)];
function annularArc(ctx,xy,cx,cy,r0,r1,a0,a1){
 const n=Math.max(18,Math.ceil((a1-a0)/3));
 ctx.beginPath();
 for(let i=0;i<=n;i++){const [dx,dy]=polar(r1,a0+(a1-a0)*i/n),p=xy(cx+dx,cy+dy);if(i===0)ctx.moveTo(...p);else ctx.lineTo(...p)}
 for(let i=n;i>=0;i--){const [dx,dy]=polar(r0,a0+(a1-a0)*i/n);ctx.lineTo(...xy(cx+dx,cy+dy))}
 ctx.closePath();
}
function draw(ctx,xy,terminal,opts={}){
 const plan=terminal?.terminalInterior;
 if(!plan||plan.status!=='draft_shared_terminal_v1')return;
 const {labels=true,zoom=1,chosen=null,roads=true}=opts;
 const [cx,cy]=xy(terminal.x,terminal.y),scale=Math.abs(xy(terminal.x+1,terminal.y)[1]-cy)||.4;
 const circle=(radius,fill,stroke,width=2)=>{
  ctx.beginPath();ctx.arc(cx,cy,radius*scale,0,2*Math.PI);
  ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();
 };
 ctx.save();ctx.lineJoin='round';
 // The center remains a shared lift platform, not a collection of new independent buildings.
 circle(plan.exitBandOuterRadius,'rgba(62,98,114,.42)','#d0e1e8',2);
 circle(plan.waitingSecurityOuterRadius,'rgba(65,109,139,.82)','#87c7e5',2);
 circle(plan.centralTransportRadius,'rgba(29,69,92,.94)','#b6e4f2',2.5);
 const color=terminal.id==='upper_terminal'?'rgba(103,129,155,.9)':'rgba(120,111,91,.92)';
 const arcBoundary=[0,90,180,270];
 for(let q=0;q<4;q++){
  const angle=45+90*q;
  const start=q*90+(plan.passageways?.find(p=>p.angleDeg===q*90)?.halfAngleDeg||9);
  const end=(q+1)*90-(plan.passageways?.find(p=>p.angleDeg===((q+1)*90)%360)?.halfAngleDeg||9);
  annularArc(ctx,xy,terminal.x,terminal.y,plan.waitingSecurityOuterRadius,plan.supportBandOuterRadius,start,end);
  ctx.fillStyle=color;ctx.strokeStyle=chosen?.id===terminal.id?'#f7f4b4':'#e7d4aa';ctx.lineWidth=1.8;ctx.fill();ctx.stroke();
  const section=plan.sections?.find(s=>s.angleDeg===angle);
  if(section&&labels&&zoom>=1.2){
   const [x,y]=polar((plan.waitingSecurityOuterRadius+plan.supportBandOuterRadius)/2,angle);
   const [px,py]=xy(terminal.x+x,terminal.y+y);
   ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.strokeStyle='#172733';ctx.lineWidth=3;ctx.strokeText(section.name,px,py,83);
   ctx.fillStyle='#f7f0de';ctx.fillText(section.name,px,py,83);
  }
 }
 // Segregated large-machine / general corridors.
 if(roads)for(const p of plan.passageways||[]){
  const [ux,uy]=polar(1,p.angleDeg);
  const a=xy(terminal.x+ux*(plan.centralTransportRadius-5),terminal.y+uy*(plan.centralTransportRadius-5));
  const b=xy(terminal.x+ux*plan.exitBandOuterRadius,terminal.y+uy*plan.exitBandOuterRadius);
  const heavy=p.access==='large_machine_authorized';
  ctx.save();ctx.lineCap='butt';ctx.strokeStyle=heavy?'rgba(188,139,215,.88)':'rgba(115,210,196,.88)';
  ctx.lineWidth=p.width*scale;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
  const marker=xy(terminal.x+ux*plan.supportBandOuterRadius,terminal.y+uy*plan.supportBandOuterRadius);
  ctx.strokeStyle=heavy?'#f0d0ff':'#d0f7ec';ctx.lineWidth=2.6;
  ctx.beginPath();ctx.arc(marker[0],marker[1],Math.max(4,p.width*scale/4),0,Math.PI*2);ctx.stroke();
  ctx.restore();
 }
 if(labels){
  ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.lineJoin='round';ctx.lineWidth=3;ctx.strokeStyle='#122632';ctx.fillStyle='#f5fafc';
  ctx.strokeText('乗降・リフト',cx,cy-7);ctx.fillText('乗降・リフト',cx,cy-7);
  ctx.font='10px system-ui';ctx.strokeText('一般・大型機',cx,cy+9);ctx.fillText('一般・大型機',cx,cy+9);
 }
 ctx.restore();
}
window.AATerminalInterior={draw};
})();