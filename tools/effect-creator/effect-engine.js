/* Deterministic Canvas renderer: preview and export share this function. */
const EffectEngine = (function engineFactory(){
const types={"斬撃":"slash","刺突":"thrust","衝撃":"impact","飛翔弾":"projectile","光線":"beam","稲妻":"lightning","落雷":"fall","爆発":"explosion","放射":"radial","波動":"wave","旋風":"vortex","粒子":"particles","魔法陣":"circle","球体":"orb","障壁":"shield","円環":"ring","オーラ":"aura","回復":"heal"};
const colors={slash:"#b6dfff",thrust:"#e5eaff",impact:"#f7ca82",projectile:"#ff853b",beam:"#a1dcff",lightning:"#72b8ff",fall:"#9bc8ff",explosion:"#ff9033",radial:"#a8caff",wave:"#75e4e6",vortex:"#91e3c7",particles:"#ff8138",circle:"#ad8bff",orb:"#79b9ff",shield:"#75d9ff",ring:"#b29bff",aura:"#ffe191",heal:"#78f2b3"};
const clamp=(v,min,max,d)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):d;
const hex=(v,d)=>/^#[0-9a-f]{6}$/i.test(v)?v:d;
const mix=(a,b,t)=>a+(b-a)*t;
function layer(type="lightning"){if(!Object.values(types).includes(type))type="lightning";return {type,name:Object.keys(types).find(k=>types[k]===type),color:colors[type],secondary:"#ffffff",size:80,endSize:80,opacity:100,endOpacity:0,glow:12,x:0,y:0,endX:0,endY:0,angle:0,endAngle:0,count:24,speed:1,start:0,end:1,seed:42,visible:true}}
function normalize(raw={}){if(!raw||typeof raw!=="object")throw Error("設定形式が不正です");const n={version:1,width:Math.round(clamp(raw.width,16,1024,128)),height:Math.round(clamp(raw.height,16,1024,128)),fps:Math.round(clamp(raw.fps,1,60,12)),duration:clamp(raw.duration,.1,10,1),columns:Math.round(clamp(raw.columns,0,600,0)),layers:[]};const arr=Array.isArray(raw.layers)?raw.layers:[layer()];if(!arr.length||arr.length>32)throw Error("レイヤー数は1～32です");n.layers=arr.map(x=>{x=x&&typeof x==="object"?x:{};const d=layer(x.type);const o={...d,name:typeof x.name==="string"?x.name.slice(0,80):d.name,color:hex(x.color,d.color),secondary:hex(x.secondary,d.secondary),visible:x.visible!==false};for(const [k,min,max] of [["size",1,250],["endSize",1,250],["opacity",0,100],["endOpacity",0,100],["glow",0,50],["x",-150,150],["y",-150,150],["endX",-150,150],["endY",-150,150],["angle",-1440,1440],["endAngle",-1440,1440],["count",1,150],["speed",0,10],["start",0,1],["end",0,1],["seed",0,2147483647]])o[k]=clamp(x[k],min,max,d[k]);o.count=Math.round(o.count);o.seed=Math.floor(o.seed);if(o.end<=o.start)throw Error("レイヤーの終了は開始より後にしてください");return o});return n}
function plan(p){let frames=Math.max(1,Math.round(p.duration*p.fps)),cols=p.columns?Math.min(p.columns,frames):frames,rows=Math.ceil(frames/cols);return {frames,cols,rows,width:p.width*cols,height:p.height*rows}}
function rand(seed,i){let a=Math.imul((seed|0)^Math.imul(i+1,0x9e3779b1),0x85ebca6b);a^=a>>>13;a=Math.imul(a,0xc2b2ae35);return ((a^(a>>>16))>>>0)/4294967296}
function line(g,pts,w){g.lineWidth=w;g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke()}
function ring(g,x,y,r,w,sy=1){g.lineWidth=w;g.beginPath();g.ellipse(x,y,Math.max(.1,r),Math.max(.1,r*sy),0,0,Math.PI*2);g.stroke()}
function dot(g,x,y,r,l){r=Math.max(.1,r);let a=g.createRadialGradient(x,y,0,x,y,r);a.addColorStop(0,l.secondary);a.addColorStop(.35,l.color);a.addColorStop(1,l.color+"00");g.fillStyle=a;g.fillRect(x-r,y-r,r*2,r*2)}
function bolt(g,x,y,xx,yy,s,w,l){let dx=xx-x,dy=yy-y,len=Math.hypot(dx,dy)||1,pts=[[x,y]];for(let i=1;i<12;i++){let q=i/12,j=(rand(s,i)-.5)*len*.19;pts.push([x+dx*q-dy/len*j,y+dy*q+dx/len*j])}pts.push([xx,yy]);g.strokeStyle=l.color;line(g,pts,w*2);g.strokeStyle=l.secondary;line(g,pts,w*.65);g.strokeStyle=l.color;return pts}
function draw(g,p,time){const w=p.width,h=p.height;g.clearRect(0,0,w,h);const q=Math.min(1,Math.max(0,time/p.duration)),m=Math.min(w,h)/100;for(const l of p.layers){if(!l.visible||q<l.start||q>l.end)continue;const u=(q-l.start)/(l.end-l.start),t=u*l.speed,phase=Math.floor(t*20),s=l.seed+phase;g.save();g.translate(w*(.5+mix(l.x,l.endX,u)/100),h*(.5+mix(l.y,l.endY,u)/100));g.rotate(mix(l.angle,l.endAngle,u)*Math.PI/180);const z=m*mix(l.size,l.endSize,u)/100;g.scale(z,z);g.globalAlpha=mix(l.opacity,l.endOpacity,u)/100;g.strokeStyle=l.color;g.fillStyle=l.color;g.shadowColor=l.color;g.shadowBlur=l.glow*m;g.lineCap="round";g.lineJoin="round";const n=l.count;
switch(l.type){
case "lightning":{const pts=bolt(g,-48,0,48,0,s,1.7,l);for(let i=2;i<11;i+=3){let [x,y]=pts[i];bolt(g,x,y,x+18,y+(i%2?1:-1)*22,s+i,.65,l)}break}
case "fall":bolt(g,4,-55,0,36,s,2.6,l);ring(g,0,36,5+u*25,1.5,.3);break;
case "beam":g.strokeStyle=l.color;line(g,[[-48,0],[48,0]],9*(.3+.7*Math.sin(Math.PI*u)));g.strokeStyle=l.secondary;line(g,[[-48,0],[48,0]],2);break;
case "slash":g.rotate(-1.5+u*2.5);g.beginPath();g.arc(0,0,35,-1.35,1.35);g.lineWidth=7;g.stroke();g.strokeStyle=l.secondary;g.lineWidth=1.4;g.stroke();break;
case "thrust":{const x=-35+u*65;line(g,[[x-32,0],[x,0]],4);line(g,[[x-13,-8],[x,0],[x-13,8]],2);break}
case "projectile":{let x=-42+84*u;line(g,[[x-25,0],[x,0]],5);dot(g,x,0,15,l);break}
case "orb":{dot(g,0,0,24,l);for(let i=0;i<4;i++){let a=i*Math.PI/2+t*6;bolt(g,Math.cos(a)*13,Math.sin(a)*13,Math.cos(a+.3)*33,Math.sin(a+.3)*33,s+i,.7,l)}break}
case "ring":ring(g,0,0,4+u*42,3);break;
case "wave":for(let i=0;i<3;i++)ring(g,0,10,4+((t+i/3)%1)*42,1.8,.45);break;
case "circle":g.rotate(t*Math.PI);[44,35,19].forEach(r=>ring(g,0,0,r,1.2));for(let j=0;j<2;j++){const a=j*Math.PI;line(g,Array.from({length:4},(_,i)=>[Math.cos(a+i*2*Math.PI/3)*33,Math.sin(a+i*2*Math.PI/3)*33]),1.1)}for(let i=0;i<12;i++){let a=i*Math.PI/6;line(g,[[Math.cos(a)*38,Math.sin(a)*38],[Math.cos(a)*43,Math.sin(a)*43]],1.4)}break;
case "shield":ring(g,0,0,40,3);ring(g,0,0,35,1);for(let i=0;i<6;i++){let a=i*Math.PI/3+t;dot(g,Math.cos(a)*39,Math.sin(a)*39,5,l)}break;
case "vortex":for(let i=0;i<Math.min(n,60);i++){let a=i*.4+t*7,r=5+i/Math.min(n,60)*38;dot(g,Math.cos(a)*r,Math.sin(a)*r*.66,4,l)}break;
case "impact":case "explosion":case "radial":for(let i=0;i<n;i++){let a=rand(l.seed,i)*Math.PI*2,r=(12+rand(l.seed+2,i)*38)*u;let x=Math.cos(a)*r,y=Math.sin(a)*r;if(l.type==="radial")bolt(g,0,0,x||.1,y||.1,s+i,.55,l);else dot(g,x,y,(1-u)*(l.type==="impact"?7:13)+1,l)}if(l.type==="impact")ring(g,0,0,4+u*38,2);break;
case "particles":case "aura":case "heal":for(let i=0;i<n;i++){let a=(rand(l.seed,i)+t*.7)%1,x=(rand(l.seed+3,i)-.5)*(l.type==="aura"?70:45),y=38-a*76;dot(g,x,y,(1-a)*7+2,l)}if(l.type==="heal")ring(g,0,30,30,1.3,.32);break;
}g.restore()}g.globalAlpha=1}
return {types,layer,normalize,plan,draw,rand};
})();
if (typeof module !== 'undefined') module.exports=EffectEngine;
