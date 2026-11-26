/* CS雷魔法: 2026-11-26 source snapshot; animation design only. */
const LightningEffects=(function thunderFactory(records){
const byId=Object.fromEntries(records.map(r=>[r.id,r]));
const clamp=v=>Math.max(0,Math.min(1,v));
function project(id,base={}){let r=byId[id];if(!r)throw Error("不明な雷魔法");return {...base,duration:r.duration,presetId:r.id,notes:r.note,layers:[{type:r.type,name:r.name,color:r.color,secondary:"#ffffff",size:88,endSize:88,opacity:100,endOpacity:r.loop?100:0,glow:8,count:24,speed:1,start:0,end:1,seed:42,visible:true}]}}
function draw(g,l,u,t,s,H){
const {bolt,line,ring,dot,rand}=H;
const key=l.type.slice(8),tau=Math.PI*2,seed=l.seed,phase=Math.floor(t*22),A=g.globalAlpha;
const B=(x,y,xx,yy,w=1,k=0,style=l)=>bolt(g,x,y,xx,yy,s+k,w,style);
const D=(x,y,r,style=l)=>dot(g,x,y,r,style);
const R=(x,y,r,w=1,sy=1)=>{g.strokeStyle=l.color;ring(g,x,y,r,w,sy)};
const L=(pts,w=1,c=l.color)=>{g.strokeStyle=c;line(g,pts,w)};
const alpha=(a,fn)=>{g.save();g.globalAlpha=A*clamp(a);fn();g.restore()};
const P=(x,y,r,a)=>[x+Math.cos(a)*r,y+Math.sin(a)*r];
function branches(x,y,xx,yy,w=.9,num=3,k=0,style=l){const pts=B(x,y,xx,yy,w,k,style);for(let i=0;i<num;i++){let ix=2+i*3;if(ix>=pts.length-1)break;let [bx,by]=pts[ix],a=Math.atan2(yy-y,xx-x)+(i%2===0?1:-1)*(0.6+rand(seed,i+k)*.55),r=8+rand(seed+4,i+k)*13;B(bx,by,bx+Math.cos(a)*r,by+Math.sin(a)*r,w*.42,k+i+11,style)}return pts}
function haze(x,y,rx,ry,c="#27354d",a=.8){g.save();g.shadowBlur=0;g.globalAlpha=A*a;g.translate(x,y);g.scale(rx,ry);let gr=g.createRadialGradient(0,0,0,0,0,1);gr.addColorStop(0,c);gr.addColorStop(.65,c);gr.addColorStop(1,c+"00");g.fillStyle=gr;g.fillRect(-1,-1,2,2);g.restore()}
function cloud(x,y,rx=38,ry=10,dark="#28334a",k=0){for(let i=0;i<9;i++){let f=(i/8-.5)*1.6;haze(x+f*rx,y+Math.sin(i*1.7+t*2+k)*ry*.26,rx*.40,ry*(.7+rand(seed+k,i)*.6),dark,.88)}}
function strike(x,y0,y1,k=0,w=1.7,local=u){let grow=clamp(local*6),end=y0+(y1-y0)*grow;if(grow>0)branches(x+4,y0,x,end,w,2,k);if(grow>.92){D(x,y1,8+local*5);R(x,y1,2+local*19,1,.28)}}
function burst(x,y,r,n,w=.5){for(let i=0;i<n;i++){let a=rand(seed+3,i)*tau,rr=r*(.45+rand(seed+7,i)*.55);let [xx,yy]=P(x,y,rr,a);let [sx,sy]=P(x,y,rr*.25,a);B(sx,sy,xx,yy,w,i);D(xx,yy,1.5)}}
function wind(n=14){for(let i=0;i<n;i++){let f=(rand(seed,i)+t*.9)%1,x=-42+84*f,y=-26+rand(seed+3,i)*62;alpha(.25+.25*Math.sin(f*Math.PI),()=>L([[x-14,y+4],[x,y],[x+8,y-3]],.65))}}
function rain(){for(let i=0;i<Math.min(l.count+14,80);i++){let f=(rand(seed,i)+t*1.7)%1,x=-42+rand(seed+9,i)*84,y=-20+f*63;alpha(.45,()=>L([[x+2,y-6],[x,y+4]],.5))}}
switch(key){
case "spark":{let q=clamp(u*5);D(-26,0,6*(1-u)+2);if(q>0)branches(-26,0,-26+q*53,1,1.05,2);if(q>.85){D(27,1,6*(1-u)+2);burst(27,1,8*(.5+u),5,.35)}break}
case "contact":{D(0,0,10*(1-u)+2);let k=clamp(u*5);for(let i=0;i<5;i++){let y=(i%2?-1:1)*(13+rand(seed,i)*25)*k;B(0,0,(rand(seed+7,i)-.5)*24,y,.85,i)}burst(0,0,12*u,6,.45);break}
case "st-elmo":for(let i=0;i<5;i++){let x=(i-2)*13,y=15+Math.sin(i*2)*6;let a=.55+.4*Math.sin(t*10+i);alpha(a,()=>{D(x,y,7);for(let j=0;j<3;j++){let h=9+rand(seed+i,j)*9;B(x,y,x+(j-1)*5,y-h,.4,i*4+j)}})}break;
case "arc":{let pts=[[-43,5],[-28,-7],[-10,-14],[10,-14],[27,-7],[43,5]];for(let i=0;i<pts.length-1;i++)B(...pts[i],...pts[i+1],2.2,i);D(-43,5,7);D(43,5,8);for(let i=1;i<4;i++){let [x,y]=pts[i];B(x,y,x+8,y-9,.6,i+9)}break}
case "spark-shield":{R(0,0,30,1.8,1.25);R(0,0,26,.65,1.25);for(let i=0;i<8;i++){let a=t*3+i*tau/8,b=a+.48;B(Math.cos(a)*30,Math.sin(a)*37,Math.cos(b)*30,Math.sin(b)*37,.75,i);D(Math.cos(a)*30,Math.sin(a)*37,3)}break}
case "guide":{const path=[[-43,18],[-22,-12],[0,7],[22,-14],[43,6]];let progress=clamp(u*1.8)*4;for(let i=0;i<4;i++){let f=clamp(progress-i);if(f>0){let [x,y]=path[i],[a,b]=path[i+1];L([[x,y],[x+(a-x)*f,y+(b-y)*f]],.7);D(x,y,2)}}if(u>.42){let j=clamp((u-.42)*3)*4;for(let i=0;i<4;i++){let f=clamp(j-i);if(f>0){let [x,y]=path[i],[a,b]=path[i+1];B(x,y,x+(a-x)*f,y+(b-y)*f,1.4,i)}}}break}
case "thunderbolt":strike(0,-45,33,1,1.9,u);break;
case "thundercloud":cloud(0,-24,28,11);alpha(.4+.5*Math.sin(t*12)**2,()=>D(Math.sin(t*6)*15,-24,13));if(Math.floor(t*5)%2===0)B(Math.sin(t*8)*14,-19,Math.sin(t*8)*14+4,8,1,3);break;
case "net":{let f=clamp(u*4);for(let i=0;i<5;i++){let x=-34+i*17,y=-30+i*15;if(f>=i*.18){B(x,-30,x,-30+60*f,.65,i);B(-34,y,-34+68*f,y,.65,10+i);for(let j=0;j<5;j++)alpha(.35+.6*Math.sin(t*9+i+j)**2,()=>D(x,-30+j*15,2.4))}}break}
case "streamer":{let f=clamp(u*2.2),x=-43+f*73;if(f>0){const pts=B(-43,0,x,0,1.1,0);for(let i=2;i<11;i+=2){let [bx,by]=pts[i],r=(8+i)*f,sign=i%4===0?-1:1;branches(bx,by,bx+r*.65,by+sign*r,.55,1,i)}if(f>.6)D(x,0,4)}break}
case "spark-burst":D(0,0,12*(1-u)+1);burst(0,0,4+u*39,Math.min(l.count,24),.55);break;
case "thunder-rain":cloud(0,-32,40,9);rain();{let n=Math.floor(t*4),x=-29+rand(seed,n)*58;alpha(1-(t*4%1)*.8,()=>strike(x,-28,35,n,1.05,.8));}break;
case "blue-jet":{cloud(0,30,29,8);let f=clamp(u*2.4),y=26-f*72;for(let i=0;i<Math.min(l.count,18);i++){let x=(rand(seed,i)-.5)*49*f;alpha(.5+.5*rand(seed+2,i),()=>B((rand(seed+1,i)-.5)*6,22,x,y+rand(seed+5,i)*9,.48,i))}haze(0,22-f*36,6+f*9,7+f*24,l.color,.24);break}
case "ball-lightning":for(let i=0;i<4;i++){let a=i*tau/4+t*1.8,x=Math.cos(a)*24,y=Math.sin(a)*23;D(x,y,12);for(let j=0;j<3;j++){let b=a+j*tau/3+t*5;B(x+Math.cos(b)*5,y+Math.sin(b)*5,x+Math.cos(b+.3)*15,y+Math.sin(b+.3)*15,.5,i*3+j)}}break;
case "thunderstorm":cloud(0,-32,42,10);wind();for(let i=0;i<3;i++){let n=Math.floor(t*5),x=-29+i*29+Math.sin(t*9+i)*6;alpha(.55+.45*Math.sin(t*12+i)**2,()=>branches(x,-26,x+(i-1)*10,34,1.45,2,n+i))}break;
case "gigantic-jet":{cloud(0,34,38,10);let f=clamp(u*2.8),y=27-70*f;D(0,26,10);for(let i=0;i<5;i++)B((i-2)*3,28,(i-2)*2,y,1.4,i);let style={...l,color:"#dd8bff"};if(f>.65)for(let i=0;i<7;i++){let r=(f-.65)/.35;branches(0,y+12,i*9-27,y-5*r,.65,1,i+12,style)}break}
case "elves":{let r=3+u*47;alpha(1-u,()=>{R(0,-8,r,2,.34);R(0,-8,r*.9,.6,.34);for(let i=0;i<12;i++){let a=i*tau/12;D(Math.cos(a)*r,-8+Math.sin(a)*r*.34,2)}});break}
case "positive":{strike(0,-48,32,1,3.9,u);if(u>.16){D(0,32,15*(1-u)+4);R(0,32,5+u*36,2.2,.3);R(0,32,3+u*26,1,.3)}break}
case "side-flash":{strike(0,-45,10,0,2,clamp(u*2));if(u>.27){let q=clamp((u-.27)*3);branches(0,10,-q*38,19,1.5,2,12);D(-q*38,19,4)}if(u>.45){let q=clamp((u-.45)*3);branches(0,10,q*38,20,1.5,2,19);D(q*38,20,4)}break}
case "volcanic":{let f=clamp(u*3);for(let i=0;i<8;i++){let y=33-i*9*f;haze(Math.sin(i*1.8+t*4)*i*2,y,7+i*2,10,"#30303a",.85)}let pulse=Math.floor(u*2),v=u*2-pulse;alpha(Math.sin(Math.PI*v),()=>{branches(-18,-14*f,20,12,1.4,3,pulse*5);B(0,-25*f,12,19,.95,8+pulse)});break}
case "sprite":{cloud(0,33,38,7);let f=clamp(u*5),a=Math.sin(Math.PI*clamp(u*1.7));alpha(a,()=>{for(let i=0;i<7;i++){let x=(i-3)*8;haze(x,-25,4,13,l.color,.28);branches(x,-37,x+Math.sin(i)*5,-37+f*49,.75,2,i)}});break}
case "divine":{let f=clamp(u*2.5);alpha(1-u*.6,()=>{R(0,-32,25-12*f,1.8,.3);R(0,-32,18-6*f,.75,.3);D(0,-32,12);for(let i=0;i<8;i++){let a=i*tau/8;L([P(0,-32,13,a),P(0,-32,22,a)],.9)}});if(u>.32){strike(0,-32,30,4,3.5,clamp((u-.32)*2));if(u>.45)burst(0,30,7+u*24,12,.6)}break}
case "many":{let k=Math.min(2,Math.floor(u*3)),f=u*3-k;let x=[-23,23,0][k];alpha(1-f*.65,()=>{strike(x,-45,32,k,2.2,f);if(f>.2)burst(x,32,7+f*12,6,.45)});break}
case "supercell":{for(let i=0;i<3;i++)cloud(0,-33+i*8,40-i*4,9,"#27334a",i);for(let i=0;i<15;i++){let a=i*tau/15+t*3,r=16+(i%5)*5;haze(Math.cos(a)*r,-18+Math.sin(a)*r*.25,12,4,"#687387",.6)}let n=Math.floor(t*6);D(Math.sin(t*11)*23,-24,11);for(let i=0;i<2;i++){let x=-35+rand(seed+n,i)*70;alpha(.7+.3*Math.sin(t*10+i)**2,()=>strike(x,-13,35,n+i,1.5,.8))}break}
default:throw Error("Unknown thunder effect "+key);
}
}
return {records,byId,project,draw};
})([
  {
    "id": "thunder-spark",
    "type": "thunder-spark",
    "name": "放電",
    "lv": 1,
    "ruby": "スパーク",
    "row": 312,
    "duration": 0.65,
    "color": "#72bcff",
    "loop": false,
    "placement": "術者→対象",
    "note": "左の手元に小さな閃光を集め、短い細い稲妻を右へ伸ばす。先端の白い火花が弾けて消える。",
    "description": "魔法による、射程1。\n演出：術者の手から短い稲妻を放ち、対象の表面で瞬間的に放電する。"
  },
  {
    "id": "thunder-contact",
    "type": "thunder-contact",
    "name": "放電接触",
    "lv": 1,
    "ruby": "スパーク・コンタクト",
    "row": 313,
    "duration": 0.7,
    "color": "#80c9ff",
    "loop": false,
    "placement": "接触地点",
    "note": "中心に接触火花が出て、人体の周囲を想定した縦長の細い電流が上下へ走り、すぐ消える。",
    "description": "魔法による、射程0。\n演出：術者が対象に触れた瞬間、対象の全身に電流が走る。"
  },
  {
    "id": "thunder-st-elmo",
    "type": "thunder-st-elmo",
    "name": "雷火",
    "lv": 2,
    "ruby": "セントエルモの火",
    "row": 314,
    "duration": 1.6,
    "color": "#867bff",
    "loop": true,
    "placement": "対象の先端・表面",
    "note": "細い青紫の光が先端数か所で立ち上り、コロナ状の小さな放電が揺らめく。大きな落雷は発生させない。",
    "description": "強い電場によって物体の先端や周囲に持続的な発光放電を発生させる。\n演出：対象の先端や表面に青紫色の発光が生じ、細かな放電が持続する。"
  },
  {
    "id": "thunder-arc",
    "type": "thunder-arc",
    "name": "電弧放電",
    "lv": 2,
    "ruby": "アーク放電",
    "row": 315,
    "duration": 0.95,
    "color": "#75c8ff",
    "loop": false,
    "placement": "術者→対象",
    "note": "左右をつなぐ太い湾曲した電弧。白い芯と青い外光が連続して揺れ、枝が少し散る。",
    "description": "気体中に高電流の放電路を形成し、強い発光と高熱を伴う電弧状の放電を発生させる。\n演出：術者から対象まで太い電弧が伸び、両者の間を強い光を伴う電流がつなぐ。"
  },
  {
    "id": "thunder-spark-shield",
    "type": "thunder-spark-shield",
    "name": "放電の盾",
    "lv": 2,
    "ruby": "スパーク・シールド",
    "row": 316,
    "duration": 1.5,
    "color": "#70baff",
    "loop": true,
    "placement": "術者中心",
    "note": "縦長の電気障壁を形成し、外周を細い稲妻が巡る。中心は透過してユニットを隠さない。",
    "description": "肉体による、3ターンの間、効果が持続する。\n演出：術者の身体を包むように電流が走り、周囲に細かな稲妻が巡る。"
  },
  {
    "id": "thunder-guide",
    "type": "thunder-guide",
    "name": "雷誘導",
    "lv": 3,
    "ruby": "ライトニング・ガイド",
    "row": 317,
    "duration": 1.2,
    "color": "#96dcff",
    "loop": false,
    "placement": "指定経路",
    "note": "折れ曲がった経路に細い誘導光が順次点灯し、遅れて強い電流が同じ経路を走る。",
    "description": "放電路の進行方向を人為的に制御し、雷を指定した経路へ導く。\n演出：指定した経路に沿って細い放電路が伸び、その経路に雷が導かれる。"
  },
  {
    "id": "thunder-thunderbolt",
    "type": "thunder-thunderbolt",
    "name": "落雷",
    "lv": 3,
    "ruby": "フォール・サンダー",
    "row": 318,
    "duration": 1,
    "color": "#8dbdff",
    "loop": false,
    "placement": "対象上空→地面",
    "note": "上から一本の稲妻が一気に落ち、着弾地点に白い閃光と薄い衝撃環が広がって消える。",
    "description": "魔法による、射程2。\n演出：対象の上空から地面へ稲妻が落ち、着弾地点が瞬間的に発光する。"
  },
  {
    "id": "thunder-thundercloud",
    "type": "thunder-thundercloud",
    "name": "雷雲",
    "lv": 3,
    "ruby": "サンダー・クラウド",
    "row": 319,
    "duration": 2,
    "color": "#83b9ff",
    "loop": true,
    "placement": "対象上空",
    "note": "小型の暗い雲が浮かび、内部の光と雲の下への短い放電を繰り返す。",
    "description": "魔法による、3ターンの間、効果が持続する。射程1。\n演出：対象地点の上空に小型の雷雲が形成され、雲の内部や下部で放電が繰り返される。"
  },
  {
    "id": "thunder-net",
    "type": "thunder-net",
    "name": "雷網",
    "lv": 4,
    "ruby": "ライトニング・ネット",
    "row": 320,
    "duration": 1.7,
    "color": "#75d6ff",
    "loop": true,
    "placement": "指定範囲",
    "note": "縦横の細い稲妻が順次つながり、格子状の電気網を形成。交点が明滅する。",
    "description": "複数の放電路を網状に連結し、一定範囲へ維持する。\n演出：複数の稲妻が交差して網目状に広がり、範囲内に電流の網を形成する。"
  },
  {
    "id": "thunder-streamer",
    "type": "thunder-streamer",
    "name": "前駆放電",
    "lv": 4,
    "ruby": "ストリーマ放電",
    "row": 321,
    "duration": 1,
    "color": "#a3cdff",
    "loop": false,
    "placement": "術者→前方",
    "note": "左端から樹枝状の細い放電路が複数方向へ段階的に伸びる。最後に枝先が一斉に明滅する。",
    "description": "絶縁破壊に先行して枝分かれしながら進展するストリーマ状の前駆放電を形成する。\n演出：術者の前方へ細い稲妻が樹木の枝のように分岐しながら伸びていく。"
  },
  {
    "id": "thunder-spark-burst",
    "type": "thunder-spark-burst",
    "name": "火花放電",
    "lv": 4,
    "ruby": "スパーク放電",
    "row": 322,
    "duration": 0.75,
    "color": "#9bcaff",
    "loop": false,
    "placement": "対象地点中心",
    "note": "中心から短い電撃と光粒を全方向へ飛散させ、外へ広がりながら急速に減衰する。",
    "description": "絶縁破壊によって瞬間的な火花状の放電を発生させ、周囲へ電撃を拡散する。\n演出：対象地点を中心に細かな火花状の電撃が放射状に飛び散る。"
  },
  {
    "id": "thunder-thunder-rain",
    "type": "thunder-thunder-rain",
    "name": "雷雨",
    "lv": 4,
    "ruby": "サンダー・レイン",
    "row": 323,
    "duration": 2.4,
    "color": "#86bfff",
    "loop": true,
    "placement": "範囲上空",
    "note": "横長の暗い雨雲から多数の細い雨筋が降り、異なる位置に細い落雷が順次発生する。",
    "description": "雨を伴う雷雲を形成し、範囲内へ継続的な降雨と落雷を発生させる。\n演出：範囲の上空を雨雲が覆い、降雨とともに各所へ稲妻が落ちる。"
  },
  {
    "id": "thunder-blue-jet",
    "type": "thunder-blue-jet",
    "name": "青色噴流",
    "lv": 5,
    "ruby": "ブルージェット",
    "row": 324,
    "duration": 1.3,
    "color": "#287dff",
    "loop": false,
    "placement": "雷雲上部→上空",
    "note": "下部の雷雲から青い円錐状の細い放電束が上方へ開きながら伸び、先端から薄れる。",
    "description": "雷雲上部から上空へ伸びる青色の高層放電を発生させる。\n演出：雷雲の上部から青い円錐状の放電が上空へ向かって伸びる。"
  },
  {
    "id": "thunder-ball-lightning",
    "type": "thunder-ball-lightning",
    "name": "球雷",
    "lv": 5,
    "ruby": "ボールライトニング",
    "row": 325,
    "duration": 1.6,
    "color": "#6fbaff",
    "loop": false,
    "placement": "対象周辺",
    "note": "4つの青白い発光球が空中を漂い、各球から短い枝状電撃が明滅する。",
    "description": "雷雨時などに目撃される球状の発光体である球雷を複数発生させ、周囲へ放電させる。\n演出：複数の球状の発光体が空中に浮かび、それぞれの表面から周囲へ稲妻が伸びる。"
  },
  {
    "id": "thunder-thunderstorm",
    "type": "thunder-thunderstorm",
    "name": "雷嵐",
    "lv": 5,
    "ruby": "サンダー・ストーム",
    "row": 326,
    "duration": 2,
    "color": "#8dcaff",
    "loop": false,
    "placement": "広域",
    "note": "暗い雲の下に斜めの風の筋が渦巻き、太い稲妻が複数の地点へ交錯する。",
    "description": "魔法による、射程2。全体に効果が及ぶ。\n演出：範囲内に強風が吹き荒れ、複数の稲妻が交錯する。"
  },
  {
    "id": "thunder-gigantic-jet",
    "type": "thunder-gigantic-jet",
    "name": "巨大雷噴流",
    "lv": 6,
    "ruby": "ギガンティック・ジェット",
    "row": 327,
    "duration": 1.7,
    "color": "#5a8dff",
    "loop": false,
    "placement": "雷雲→高層大気",
    "note": "暗い雲から青白い太い放電柱が上へ伸び、上層で赤紫色の枝に大きく分岐する。",
    "description": "雷雲から高層大気までを接続する巨大な放電柱を発生させる。\n演出：雷雲から高い上空へ巨大な放電柱が伸び、先端が枝分かれする。"
  },
  {
    "id": "thunder-elves",
    "type": "thunder-elves",
    "name": "雷円環",
    "lv": 6,
    "ruby": "エルブス",
    "row": 328,
    "duration": 1.1,
    "color": "#d48cff",
    "loop": false,
    "placement": "高層大気",
    "note": "水平に近い薄い赤紫の発光円環が上空で急拡大し、外周から消える。地上への落雷は描かない。",
    "description": "上層大気に巨大な発光円環を瞬間的に発生させ、急速に拡大させる。\n演出：上空に薄い発光円環が現れ、中心から外側へ急速に拡大して消える。"
  },
  {
    "id": "thunder-positive",
    "type": "thunder-positive",
    "name": "正極性落雷",
    "lv": 6,
    "ruby": "ポジティブ・ライトニング",
    "row": 329,
    "duration": 1.25,
    "color": "#b6e1ff",
    "loop": false,
    "placement": "対象上空→地面",
    "note": "通常落雷より太い白い主放電が縦に突き刺さり、大きな着弾閃光と二重の衝撃環が広がる。",
    "description": "雷雲上部の正電荷から地表へ生じる正極性落雷を再現し、強力な一撃を発生させる。\n演出：通常の落雷よりも太く強烈な稲妻が上空から対象へ落ちる。"
  },
  {
    "id": "thunder-side-flash",
    "type": "thunder-side-flash",
    "name": "側撃雷",
    "lv": 6,
    "ruby": "サイドフラッシュ",
    "row": 330,
    "duration": 1.3,
    "color": "#7ec9ff",
    "loop": false,
    "placement": "主対象→周囲",
    "note": "中央へ最初の雷が落ち、その直後に左右の周囲へ横向きの電撃が順番に飛び移る。",
    "description": "落雷を受けた物体から周囲の対象へ雷が飛び移る側撃雷を連鎖的に発生させる。\n演出：最初の対象に落雷した後、その対象から周囲の対象へ稲妻が横方向に飛び移る。"
  },
  {
    "id": "thunder-volcanic",
    "type": "thunder-volcanic",
    "name": "火山雷",
    "lv": 6,
    "ruby": "ボルカニック・ライトニング",
    "row": 331,
    "duration": 1.8,
    "color": "#b2a6ff",
    "loop": false,
    "placement": "地表→噴煙",
    "note": "下部から黒灰色の噴煙が立ち上り、煙の内部と外周で二度、紫白の枝状雷が走る。",
    "description": "火山噴煙中の粒子が衝突して帯電し、噴煙内部や周辺へ多数の放電が発生する火山雷を再現する。\n演出：黒い噴煙が立ち上がり、煙の内部や周囲で枝状の稲妻が繰り返し走る。"
  },
  {
    "id": "thunder-sprite",
    "type": "thunder-sprite",
    "name": "高層放電",
    "lv": 6,
    "ruby": "スプライト",
    "row": 332,
    "duration": 1.25,
    "color": "#ff628d",
    "loop": false,
    "placement": "雷雲より上空",
    "note": "下部の暗い雲より上に赤紫の縦長発光柱が現れ、下向きに細い枝を伸ばし瞬時に消える。",
    "description": "雷雲より高い上空に瞬間的な大規模発光放電を発生させる高層大気の放電現象を再現する。\n演出：雷雲より高い上空に赤紫色の巨大な枝状放電が瞬間的に現れる。"
  },
  {
    "id": "thunder-divine",
    "type": "thunder-divine",
    "name": "神雷",
    "lv": 7,
    "ruby": "ディヴァイン・サンダー",
    "row": 333,
    "duration": 1.6,
    "color": "#ffe096",
    "loop": false,
    "placement": "上空→対象",
    "note": "上空に金白の光環が集まり、白金色の太い雷が降りる。着弾時に金の放射光が広がる。",
    "description": "信仰による奇跡として雷を顕現させ、対象へ落とす。\n演出：神々しい光が上空に集まり、強大な稲妻となって対象へ降り注ぐ。"
  },
  {
    "id": "thunder-many",
    "type": "thunder-many",
    "name": "万雷",
    "lv": 7,
    "ruby": "",
    "row": 334,
    "duration": 1.65,
    "color": "#9dd0ff",
    "loop": false,
    "placement": "対象上空→範囲",
    "note": "三波の稲妻が上空から異なる近接地点へ順に降り、各着弾点で閃光が弾ける。",
    "description": "演出：上空から複数の稲妻が連続して降り注ぐ。"
  },
  {
    "id": "thunder-supercell",
    "type": "thunder-supercell",
    "name": "巨大積乱雲",
    "lv": 7,
    "ruby": "スーパーセル",
    "row": 335,
    "duration": 2.8,
    "color": "#9dbeff",
    "loop": true,
    "placement": "広域上空",
    "note": "大きな積乱雲と回転する雲の帯を形成。内部放電と複数地点への落雷が繰り返される。",
    "description": "内部に持続的な回転上昇流を持つ巨大な積乱雲を形成し、広域へ激しい雷活動を発生させる。\n演出：広域の上空に巨大な積乱雲が形成され、雲が回転しながら各所で激しい落雷が繰り返される。"
  }
]);
if(typeof module!=='undefined')module.exports=LightningEffects;
