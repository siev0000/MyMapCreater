(()=>{"use strict";
const C=EffectComponents,$=id=>document.getElementById(id);
let composition=C.sample("convergence"),selected=composition.parts[0].uid,serial=0,renderer=null,miniRenderer=null,applied=null,dirty=true,playing=false,position=0,last=0,busy=false,miniStart=0,miniDuration=1,changed=false;
const exports=[...document.querySelectorAll("[data-export]")],storageKey="effect-components-v1";
const settingsIds=["width","height","fps","columns","color","core"];
const newId=()=>{let id;do{id="part-"+(++serial)}while(composition.parts.some(p=>p.uid===id));return id};
function status(message,error=false){$("status").textContent=message;$("status").classList.toggle("error",error)}
function config(){const n=(id,min,max)=>{const v=Number($(id).value);if($(id).value===""||!Number.isInteger(v)||v<min||v>max)throw Error(id+" の範囲が不正");return v};return {width:n("width",16,512),height:n("height",16,512),fps:n("fps",1,60),columns:n("columns",0,300),color:$("color").value,core:$("core").value}}
function renderConfig(c,source,settings){return {...settings,engine:"shader",shape:"burst",duration:c.duration,seed:c.seed,size:88,glow:65,speed:1,shaderLayers:[{name:c.name,code:source}],notes:"GLSL部品構成"}}
function buttons(){for(const b of exports)b.disabled=busy||dirty||!renderer;$("source").disabled=busy||dirty||!applied;$("play").disabled=busy||!renderer;$("compile").disabled=busy;$("play").textContent=playing?"停止":"再生"}
function draw(r,canvas,t){r.render(t);if(canvas.width!==r.canvas.width||canvas.height!==r.canvas.height){canvas.width=r.canvas.width;canvas.height=r.canvas.height}const ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(r.canvas,0,0)}
function updatePosition(){const d=applied?.composition.duration??composition.duration;$("seek").value=String(Math.round(1000*position/d));$("time").textContent=position.toFixed(2)+" / "+d.toFixed(2)+" 秒";for(const n of document.querySelectorAll(".cursor"))n.style.left=Math.min(100,position/Math.max(.001,composition.duration)*100)+"%"}
function outputInfo(){try{const p={...config(),duration:composition.duration};if(!Number.isFinite(p.duration)||p.duration<.05||p.duration>30)throw Error("秒数が不正");const a=EffectEngine.plan(p);$("outputInfo").textContent=a.frames+" コマ / "+a.cols+"×"+a.rows+" / "+a.width+"×"+a.height+" px（透過）"}catch(e){$("outputInfo").textContent=e.message}}
function refresh(){if(busy)return;cancelTimeDrag();dirty=true;buttons();outputInfo();let next=null;
 try{const c=C.compile(composition),settings=config(),p=renderConfig(c.composition,c.source,settings);next=ShaderStudio.createRenderer(p,c.source);const t=Math.min(position,c.composition.duration);draw(next,$("preview"),t);const old=renderer;renderer=next;next=null;applied={...c,settings,p};position=t;dirty=false;old?.dispose();status("反映済み / "+c.composition.parts.length+" 部品 / GLSL "+c.source.length+" 文字"+(c.composition.loop?" / ループの継ぎ目は要確認":""));updatePosition()}catch(e){next?.dispose();status("未反映（前回の正常なプレビューを保持）\n"+e.message,true)}finally{buttons()}}
function mark(){cancelTimeDrag();closeComparison();showUsage();changed=true;dirty=true;buttons();refresh()}
function sync(){for(const k of ["name","duration","view","seed"])$(k).value=composition[k];$("loop").checked=composition.loop;$("repeat").checked=composition.loop}
function option(select,value,label){const o=document.createElement("option");o.value=value;o.textContent=label;select.append(o)}

const registryKey="effect-component-registry-v1";
let authorTemplate=null,authorTested=null,authorVersionMode=false,registryLoadError="",registrySnapshot=null;
const authorIds=["authorId","authorName","authorCategory","authorView","authorDuration","authorDescription","authorBody"];
function authorStatus(s,error=false){$("authorStatus").textContent=s;$("authorStatus").classList.toggle("error",error)}
function invalidateAuthor(){authorTested=null;$("authorRegister").disabled=true}
function registryData(){return {format:"glsl-part-registry",version:1,definitions:C.customDefinitions()}}
function persistAdditions(raw){
 const added=C.prepareDefinitions(raw);
 if(!added.length)return 0;
 if(registryLoadError)throw Error("保存部品の読込エラーがあるため上書きしません。既存の保存内容を確認してください");
 if(localStorage.getItem(registryKey)!==registrySnapshot)throw Error("別タブ等で部品保存が変更されています。現在の編集を保存して再読込してください");
 const next=JSON.stringify({format:"glsl-part-registry",version:1,definitions:[...C.customDefinitions(),...added]});
 localStorage.setItem(registryKey,next);registrySnapshot=next;
 C.installDefinitions(added);syncRegistry();return added.length;
}
function parseRegistry(raw){if(!raw||raw.format!=="glsl-part-registry"||raw.version!==1||!Array.isArray(raw.definitions))throw Error("追加部品JSONの形式が不正");return raw.definitions}
try{registrySnapshot=localStorage.getItem(registryKey);if(registrySnapshot)C.installDefinitions(parseRegistry(JSON.parse(registrySnapshot)))}catch(e){registryLoadError="保存部品の読込失敗: "+e.message}
function syncRegistry(){
 const cat=$("category"),previous=cat.value;cat.replaceChildren();option(cat,"","すべて");for(const name of [...new Set(C.definitions().map(d=>d.category))])option(cat,name,name);if(C.definitions().some(d=>d.category===previous))cat.value=previous;
 const base=$("authorBase"),choice=base.value;base.replaceChildren();option(base,"","新規（基本発光球）");for(const d of C.definitions())option(base,d.id+"@"+d.version,d.name+" v"+d.version+" ("+d.id+")");if(C.definitions().some(d=>d.id+"@"+d.version===choice))base.value=choice;
 showLibrary();updateUsageParts();
}
function authorBase(){const v=$("authorBase").value;if(!v)return null;const [id,version]=v.split("@");return C.get(id,Number(version))}
function uniqueId(base){let id=base.slice(0,50),n=1;while(C.nextVersion(id)!==1)id=base.slice(0,50)+"-"+(++n);return id}

let authorParams=[];
function authorSignature(){const types={float:"float",int:"int",bool:"bool",color:"vec3"};$("authorSignature").textContent="vec4 part(vec2 p, float t, float q"+authorParams.map(p=>", "+types[p.type||"float"]+" "+p.id).join("")+")";}
function editParamRows(){
 const box=$("authorParams");box.replaceChildren();
 for(const [idx,p] of authorParams.entries()){
  const card=document.createElement("div");card.className="param-card";const fields=document.createElement("div");fields.className="fields";
  const change=(k,v)=>{p[k]=v;invalidateAuthor();authorSignature()};
  const input=(label,k,type="text")=>{const el=document.createElement("input");el.type=type;el.value=p[k]??"";if(type==="number")el.step="any";field(fields,label,el);el.oninput=()=>change(k,type==="number"?(el.value===""?NaN:Number(el.value)):el.value);return el};
  input("GLSL変数ID","id");input("表示名","name");
  const type=document.createElement("select");for(const [v,n] of [["float","小数"],["int","整数"],["bool","ON/OFF"],["color","色 RGB"]])option(type,v,n);type.value=p.type||"float";field(fields,"型",type);
  type.onchange=()=>{p.type=type.value;if(p.type==="bool"){p.default=true;delete p.min;delete p.max;delete p.step}else if(p.type==="color"){p.default="#ffffff";delete p.min;delete p.max;delete p.step}else{p.min=0;p.max= p.type==="int"?10:2;p.default=1;p.step=p.type==="int"?1:.05}invalidateAuthor();editParamRows()};
  if((p.type||"float")==="bool"){const el=document.createElement("input");el.type="checkbox";el.checked=p.default;field(fields,"初期値",el);el.onchange=()=>change("default",el.checked)}
  else if(p.type==="color")input("初期色","default","color");
  else{input("最小値","min","number");input("最大値","max","number");input("初期値","default","number");input("刻み","step","number")}
  input("単位（任意）","unit");
  const del=document.createElement("button");del.type="button";del.textContent="項目削除";del.onclick=()=>{authorParams.splice(idx,1);invalidateAuthor();editParamRows()};card.append(fields,del);box.append(card);
 }
 $("authorParamAdd").disabled=authorParams.length>=16;authorSignature();
}
$("authorParamAdd").onclick=()=>{if(busy||authorParams.length>=16)return;let n=1;while(authorParams.some(p=>p.id==="amount"+n))n++;authorParams.push({id:"amount"+n,name:"調整値 "+n,type:"float",min:0,max:2,default:1,step:.05,unit:"倍"});invalidateAuthor();editParamRows()};
function parameterField(box,a,p){
 const label=a.name+(a.unit?"（"+a.unit+"）":""),type=a.type||"float",wrap=document.createElement("div");wrap.className="param-value";
 const apply=v=>{if(busy)return;try{p.params[a.id]=C.parameterValue(a,v);mark()}catch(e){status(e.message,true);inspector()}};
 if(type==="bool"){const el=document.createElement("input");el.type="checkbox";el.checked=p.params[a.id];field(wrap,label,el);el.onchange=()=>apply(el.checked)}
 else if(type==="color"){const el=document.createElement("input");el.type="color";el.value=p.params[a.id];field(wrap,label,el);el.onchange=()=>apply(el.value)}
 else{
  const el=document.createElement("input");el.type="number";el.min=a.min;el.max=a.max;el.step=a.step;el.value=p.params[a.id];field(wrap,label,el);
  const range=document.createElement("input");range.type="range";range.min=a.min;range.max=a.max;range.step=a.step;range.value=p.params[a.id];range.setAttribute("aria-label",label);
  range.oninput=()=>{el.value=range.value};range.onchange=()=>apply(Number(range.value));el.onchange=()=>{if(el.value===""){inspector();return}range.value=el.value;apply(Number(el.value))};wrap.append(range);
 }
 const reset=document.createElement("button");reset.type="button";reset.textContent="初期値に戻す";reset.onclick=()=>{apply(a.default);inspector()};wrap.append(reset);box.append(wrap);
}

function startAuthor(versionMode=false){
 if(busy)return;const base=authorBase();
 if(versionMode&&!base){authorStatus("新版を作る元の部品を選択してください",true);return}
 invalidateAuthor();authorVersionMode=versionMode;
 authorTemplate=base||{name:"発光球",category:"発光",view:"BOTH",duration:1,description:"",body:"float a = ball(p, vec2(0.), .22) * sin(3.14159*q);\nreturn light(a);",dependencies:["fire-common@1"],params:[]};
 $("authorId").value=versionMode?base.id:uniqueId(base?"custom-"+base.id:"custom-orb");$("authorId").readOnly=versionMode;$("authorVersionNumber").value=versionMode?C.nextVersion(base.id):1;
 for(const [id,key] of [["authorName","name"],["authorCategory","category"],["authorView","view"],["authorDuration","duration"],["authorDescription","description"],["authorBody","body"]])$(id).value=authorTemplate[key];
 authorParams=JSON.parse(JSON.stringify(authorTemplate.params));editParamRows();authorStatus(versionMode?"新しい版を編集中。旧版は変更されません。":"新規部品を編集中。試写後に登録してください。");
}
function readAuthor(){
 const d=C.normalizeDefinition({id:$("authorId").value.trim(),version:Number($("authorVersionNumber").value),name:$("authorName").value.trim(),category:$("authorCategory").value.trim(),view:$("authorView").value,duration:Number($("authorDuration").value),description:$("authorDescription").value,body:$("authorBody").value,dependencies:authorTemplate.dependencies,params:authorParams});
 if(d.version!==C.nextVersion(d.id)||(!authorVersionMode&&d.version!==1))throw Error("IDが既に登録済み、または版が不正。新規IDまたは新版を作る操作を使用してください");
 return d;
}
function trialRenderer(d){
 const x=C.previewDefinition(d,composition.view),p=renderConfig(x.composition,x.source,{width:128,height:128,fps:12,columns:0,color:$("color").value,core:$("core").value});let next=null;
 try{next=ShaderStudio.createRenderer(p,x.source);for(const q of [0,.1,.35,.5,.8,1])next.render(d.duration*q);return next}catch(e){next?.dispose();throw e}
}
function testAuthor(){
 if(busy)return;invalidateAuthor();let next=null;
 try{const d=readAuthor();next=trialRenderer(d);draw(next,$("mini"),d.duration*.5);const old=miniRenderer;miniRenderer=next;next=null;old?.dispose();miniStart=performance.now();miniDuration=d.duration;$("miniTitle").textContent=d.name+" v"+d.version+"（未登録試写）";$("miniStatus").textContent="試写成功";authorTested=JSON.stringify(d);$("authorRegister").disabled=false;authorStatus("コンパイル・6時点の描画成功。部品登録できます。")}catch(e){next?.dispose();authorStatus("試写失敗: "+e.message,true)}
}
function registerAuthor(){
 if(busy||!authorTested)return;
 try{const d=readAuthor();if(JSON.stringify(d)!==authorTested)throw Error("内容が変わりました。再試写してください");persistAdditions([d]);invalidateAuthor();$("authorBase").value=d.id+"@"+d.version;authorStatus("登録済み: "+d.id+"@"+d.version+"。ライブラリから追加できます。")}catch(e){invalidateAuthor();authorStatus(e.message,true)}
}
function verifyAdditions(raw){
 const added=C.prepareDefinitions(raw);
 for(const d of added){let r=null;try{r=trialRenderer(d)}finally{r?.dispose()}}
 return added;
}
$("authorNew").onclick=()=>startAuthor(false);$("authorVersion").onclick=()=>startAuthor(true);
for(const id of authorIds){$(id).addEventListener("input",invalidateAuthor);$(id).addEventListener("change",invalidateAuthor)}
$("authorTest").onclick=testAuthor;$("authorRegister").onclick=registerAuthor;
$("authorExport").onclick=()=>{if(!busy)EffectExport.download(new Blob([JSON.stringify(registryData(),null,2)],{type:"application/json"}),"glsl-part-registry.json")};
$("authorImport").onchange=async()=>{try{if(busy)return;const file=$("authorImport").files[0];if(!file)return;const raw=parseRegistry(JSON.parse(await file.text())),added=verifyAdditions(raw),count=persistAdditions(added);authorStatus(count+"版を追加しました（既存版は変更なし）")}catch(e){authorStatus("読込失敗: "+e.message,true)}finally{$("authorImport").value=""}};

function showLibrary(){const box=$("library"),cat=$("category").value,query=$("search").value.trim().toLowerCase();box.replaceChildren();for(const d of C.definitions()){if(cat&&cat!==d.category||query&&!(d.name+" "+d.id+" "+d.description).toLowerCase().includes(query))continue;const row=document.createElement("div");row.className="part";const preview=document.createElement("button");preview.textContent=d.name+" v"+d.version;preview.onclick=()=>mini(d);const add=document.createElement("button");add.textContent="追加";add.disabled=d.view!=="BOTH"&&d.view!==composition.view;add.title=add.disabled?"視点 "+d.view+" に変更してください":"構成へ追加";add.onclick=()=>addPart(d);const hint=document.createElement("small");hint.textContent=d.view+" / "+d.duration+"秒 / "+d.description;row.append(preview,add,hint);box.append(row)}}
function mini(d){if(busy)return;let next=null;try{const c=C.create(d.duration,d.view==="BOTH"?composition.view:d.view);c.name=d.name;c.parts=[C.instance(d.id,"preview",0,d.duration,d.version)];if(d.category==="飛翔"){c.parts[0].x=-.65;c.parts[0].endX=.65}if(d.id==="shockwave")c.parts[0].params.squash=c.view==="TOP"?1:.34;const x=C.compile(c);const p=renderConfig(x.composition,x.source,{width:128,height:128,fps:12,columns:0,color:$("color").value,core:$("core").value});next=ShaderStudio.createRenderer(p,x.source);draw(next,$("mini"),0);miniRenderer?.dispose();miniRenderer=next;next=null;miniStart=performance.now();miniDuration=d.duration;$("miniTitle").textContent=d.name+" v"+d.version;$("miniStatus").textContent="単体再生中"}catch(e){next?.dispose();$("miniStatus").textContent=e.message}}
function addPart(d){if(busy||composition.parts.length>=C.MAX_PARTS){status("部品数の上限です",true);return}const start=0,end=Math.min(composition.duration,d.duration);const p=C.instance(d.id,newId(),start,end,d.version);if(d.category==="飛翔"){p.x=-.65;p.endX=.65}if(d.id==="shockwave")p.params.squash=composition.view==="TOP"?1:.34;composition.parts.push(p);selected=p.uid;drawEditor();mark()}
function current(){return composition.parts.find(p=>p.uid===selected)}
function selectPart(id){selected=id;drawEditor()}

let timeDrag=null;
function timeStatus(s){$("timelineStatus").textContent=s}
function snapSeconds(){const v=$("timelineSnap").value;if(v==="frame"){const fps=Number($("fps").value);return Number.isFinite(fps)&&fps>=1&&fps<=60?1/fps:0}return Number(v)||0}
function paintClip(clip,body,start,end,duration){
 clip.style.left=(start/duration*100)+"%";clip.style.width=((end-start)/duration*100)+"%";
 body.textContent=start.toFixed(3)+"–"+end.toFixed(3);clip.title=body.textContent+" 秒";
}
function cancelTimeDrag(){
 const d=timeDrag;if(!d)return;timeDrag=null;
 paintClip(d.clip,d.body,d.start,d.end,d.duration);d.clip.classList.remove("dragging");
 try{if(d.handle.hasPointerCapture(d.pointer))d.handle.releasePointerCapture(d.pointer)}catch{}
 timeStatus("時間調整をキャンセルしました");
}
function bindTimeHandle(handle,mode,p,rail,clip,body){
 handle.onpointerdown=e=>{
  if(busy||timeDrag||e.isPrimary===false||e.button!==0)return;
  const width=rail.getBoundingClientRect().width;if(!(width>0))return;
  e.stopPropagation();e.preventDefault();
  try{handle.setPointerCapture(e.pointerId)}catch{return}
  timeDrag={handle,mode,p,uid:p.uid,composition,start:p.start,end:p.end,duration:composition.duration,clip,body,width,x:e.clientX,pointer:e.pointerId,moved:false,snap:snapSeconds(),next:null};
 };
 handle.onpointermove=e=>{
  const d=timeDrag;if(!d||d.handle!==handle||d.pointer!==e.pointerId)return;
  e.preventDefault();e.stopPropagation();const px=e.clientX-d.x;
  if(!d.moved&&Math.abs(px)<4)return;
  if(!d.moved){d.moved=true;playing=false;buttons();d.clip.classList.add("dragging");closeComparison()}
  try{d.next=C.timelineRange(d.start,d.end,d.duration,d.mode,px/d.width*d.duration,d.snap);paintClip(d.clip,d.body,d.next.start,d.next.end,d.duration);timeStatus(d.next.start.toFixed(3)+"〜"+d.next.end.toFixed(3)+" 秒 / 長さ "+(d.next.end-d.next.start).toFixed(3)+" 秒（未反映）")}catch(err){cancelTimeDrag();timeStatus(err.message)}
 };
 handle.onpointerup=e=>{
  const d=timeDrag;if(!d||d.handle!==handle||d.pointer!==e.pointerId)return;
  e.preventDefault();e.stopPropagation();
  if(d.moved)handle.onpointermove(e);
  if(timeDrag!==d)return;
  timeDrag=null;d.clip.classList.remove("dragging");try{if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId)}catch{}
  if(!d.moved){selectPart(d.uid);return}
  try{
   if(busy||composition!==d.composition||composition.duration!==d.duration||!composition.parts.includes(d.p)||d.p.start!==d.start||d.p.end!==d.end)throw Error("構成が変更されたため操作を中止しました");
   if(!d.next)throw Error("変更位置を取得できません");
   const next=C.changeTiming(composition,d.uid,d.next.start,d.next.end);
   selected=d.uid;composition=next;drawEditor();mark();timeStatus("時間を反映: "+d.next.start.toFixed(3)+"〜"+d.next.end.toFixed(3)+" 秒");
  }catch(err){drawEditor();timeStatus(err.message)}
 };
 handle.onpointercancel=e=>{if(timeDrag?.handle===handle&&timeDrag.pointer===e.pointerId)cancelTimeDrag()};
 handle.onlostpointercapture=e=>{if(timeDrag?.handle===handle&&timeDrag.pointer===e.pointerId)cancelTimeDrag()};
 handle.onclick=e=>{e.stopPropagation();if(e.detail===0&&!timeDrag)selectPart(p.uid)};
 handle.onkeydown=e=>{
  if(busy||timeDrag||!["ArrowLeft","ArrowRight"].includes(e.key))return;
  e.preventDefault();e.stopPropagation();
  const step=snapSeconds()||.01,delta=(e.key==="ArrowLeft"?-1:1)*step*(e.shiftKey?10:1);
  try{const r=C.timelineRange(p.start,p.end,composition.duration,mode,delta,snapSeconds());composition=C.changeTiming(composition,p.uid,r.start,r.end);selected=p.uid;playing=false;drawEditor();mark();timeStatus("時間を反映: "+r.start.toFixed(3)+"〜"+r.end.toFixed(3)+" 秒")}catch(err){timeStatus(err.message)}
 };
}
function timeline(){
 cancelTimeDrag();const box=$("timeline"),viewport=$("timelineViewport"),scroll=viewport.scrollLeft;box.replaceChildren();
 const zoom=Number($("timelineZoom").value)||1;box.style.width=(zoom*100)+"%";box.style.minWidth=(280*zoom)+"px";
 const ruler=document.createElement("div");ruler.className="ruler";const label=document.createElement("span");label.textContent="秒";const scale=document.createElement("div");scale.className="rulerline";const ticks=4*zoom;
 for(let i=0;i<=ticks;i++){const e=document.createElement("span");e.textContent=(composition.duration*i/ticks).toFixed(composition.duration<1?3:2);scale.append(e)}ruler.append(label,scale);box.append(ruler);
 for(const p of composition.parts){
  const d=C.get(p.partId,p.version),row=document.createElement("div");row.className="track";const name=document.createElement("button");name.textContent=(p.enabled?"":"非表示 ")+d.name+" v"+p.version;name.title=d.name;name.onclick=()=>selectPart(p.uid);if(p.uid===selected)name.classList.add("selected");
  const rail=document.createElement("div");rail.className="rail";const clip=document.createElement("div");clip.className="clip"+(p.uid===selected?" selected":"");clip.style.opacity=p.enabled?1:.4;
  const body=document.createElement("button");body.type="button";body.className="clip-body";body.setAttribute("aria-label",d.name+" 移動");
  const grip=(side,label)=>{const el=document.createElement("button");el.type="button";el.className="clip-grip";el.textContent=side==="start"?"‹":"›";el.setAttribute("aria-label",d.name+" "+label);el.title=label;bindTimeHandle(el,side,p,rail,clip,body);return el};
  clip.append(grip("start","開始時刻"),body,grip("end","終了時刻"));bindTimeHandle(body,"move",p,rail,clip,body);paintClip(clip,body,p.start,p.end,composition.duration);
  rail.onclick=e=>{if(!renderer||busy||timeDrag||e.target!==rail)return;const r=rail.getBoundingClientRect();if(!(r.width>0))return;playing=false;position=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*applied.composition.duration;renderAt();buttons()};
  const cursor=document.createElement("span");cursor.className="cursor";rail.append(clip,cursor);row.append(name,rail);box.append(row);
 }
 viewport.scrollLeft=scroll;updatePosition();
}
$("timelineZoom").onchange=()=>{if(!busy)timeline()};
$("timelineSnap").onchange=()=>cancelTimeDrag();
window.addEventListener("keydown",e=>{if(e.key==="Escape")cancelTimeDrag()});

const numericFields=[["start","開始秒",0,30,.01],["end","終了秒",0,30,.01],["x","開始 X",-2,2,.01],["y","開始 Y",-2,2,.01],["endX","終了 X",-2,2,.01],["endY","終了 Y",-2,2,.01],["arc","放物線の高さ",-2,2,.01],["scale","倍率",.05,4,.01],["rotation","回転角",-360,360,1],["opacity","透明度",0,1,.01],["speed","模様の速度",.05,10,.05],["tintMix","色の適用量",0,1,.01]];
function field(box,title,input){const l=document.createElement("label");l.textContent=title;l.append(input);box.append(l);return input}
function numberField(box,title,value,min,max,step,cb){const i=document.createElement("input");i.type="number";i.min=min;i.max=max;i.step=step;i.value=value;field(box,title,i);i.onchange=()=>{if(busy)return;const n=Number(i.value);if(i.value===""||!Number.isFinite(n)||n<min||n>max){i.value=value;status(title+" の入力範囲が不正",true);return}cb(n)};return i}
function inspector(){const p=current(),box=$("partFields");$("inspector").hidden=!p;$("empty").hidden=!!p;box.replaceChildren();if(!p)return;const d=C.get(p.partId,p.version);$("partName").textContent=d.name+" v"+p.version;for(const [k,label,min,max,step] of numericFields)numberField(box,label,p[k],min,k==="start"||k==="end"?composition.duration:max,step,n=>{if(k==="start"||k==="end"){try{const c=C.changeTiming(composition,p.uid,k==="start"?n:p.start,k==="end"?n:p.end);composition=c;playing=false;drawEditor();mark();timeStatus("時間を反映しました")}catch(e){inspector();status(e.message,true)}return}p[k]=n;timeline();mark()});const tint=document.createElement("input");tint.type="color";tint.value=p.tint;field(box,"色補正",tint);tint.onchange=()=>{p.tint=tint.value;mark()};const mode=document.createElement("select");option(mode,"local","部品内");option(mode,"scene","全体と同期");mode.value=p.timeMode;field(box,"模様の時間",mode);mode.onchange=()=>{p.timeMode=mode.value;mark()};const show=document.createElement("input");show.type="checkbox";show.checked=p.enabled;field(box,"表示",show);show.onchange=()=>{p.enabled=show.checked;timeline();mark()};for(const a of d.params)parameterField(box,a,p)}
function drawEditor(){timeline();inspector();showLibrary();syncVersion();const p=current(),i=composition.parts.indexOf(p);$("duplicate").disabled=!p||composition.parts.length>=C.MAX_PARTS;$("delete").disabled=!p;$("up").disabled=i<=0;$("down").disabled=i<0||i>=composition.parts.length-1;outputInfo()}
function move(delta){const i=composition.parts.indexOf(current()),j=i+delta;if(i<0||j<0||j>=composition.parts.length)return;[composition.parts[i],composition.parts[j]]=[composition.parts[j],composition.parts[i]];drawEditor();mark()}
$("up").onclick=()=>move(-1);$("down").onclick=()=>move(1);
$("duplicate").onclick=()=>{const p=current();if(!p||composition.parts.length>=C.MAX_PARTS)return;const copy=JSON.parse(JSON.stringify(p));copy.uid=newId();composition.parts.splice(composition.parts.indexOf(p)+1,0,copy);selected=copy.uid;drawEditor();mark()};
$("delete").onclick=()=>{composition.parts=composition.parts.filter(p=>p.uid!==selected);selected=composition.parts[0]?.uid;drawEditor();mark()};
$("category").onchange=showLibrary;$("search").oninput=showLibrary;
for(const k of ["name","duration","view","seed","loop"])$(k).onchange=()=>{if(busy)return;const el=$(k),prev=composition[k],v=k==="loop"?el.checked:k==="duration"||k==="seed"?Number(el.value):el.value;if(k==="duration"&&(el.value===""||!Number.isFinite(v)||v<.05||v>30||composition.parts.some(p=>p.end>v))){el.value=prev;status("全体時間は部品の終了時刻以上、0.05〜30秒にしてください",true);return}if(k==="view"&&composition.parts.some(p=>{const d=C.get(p.partId,p.version);return d.view!=="BOTH"&&d.view!==v})){el.value=prev;status("現在の部品に対応しない視点です",true);return}if(k==="name"&&!v.trim()||k==="seed"&&(el.value===""||!Number.isInteger(v)||v<0||v>2147483647)){el.value=prev;status("設定値が不正です",true);return}composition[k]=v;drawEditor();mark()};
for(const id of settingsIds)$(id).onchange=mark;
$("compile").onclick=refresh;
function renderAt(){if(!renderer)return;try{draw(renderer,$("preview"),position);updatePosition()}catch(e){playing=false;dirty=true;status("描画失敗: "+e.message,true);buttons()}}
$("play").onclick=()=>{if(!renderer)return;playing=!playing;if(playing&&position>=applied.composition.duration)position=0;last=performance.now();buttons()};
$("reset").onclick=()=>{position=0;playing=false;renderAt();buttons()};
$("seek").oninput=()=>{if(!renderer||busy)return;position=Number($("seek").value)/1000*applied.composition.duration;playing=false;renderAt();buttons()};
function replace(c,settings,confirmed=false){if(busy)return;if(!confirmed&&changed&&!confirm("現在の部品構成を置き換えますか？"))return;const next=C.validate(c);if(settings){const {width,height,fps,columns,color,core}=settings;if(![width,height,fps,columns].every(Number.isInteger)||width<16||width>512||height<16||height>512||fps<1||fps>60||columns<0||columns>300||!/^#[0-9a-f]{6}$/i.test(color)||!/^#[0-9a-f]{6}$/i.test(core))throw Error("出力設定が不正");for(const k of settingsIds)$(k).value=settings[k]}composition=next;selected=composition.parts[0]?.uid;playing=false;position=0;changed=false;sync();drawEditor();refresh()}
$("new").onclick=()=>replace(C.create(2.8,composition.view));$("sampleConvergence").onclick=()=>replace(C.sample("convergence"));$("sampleInferno").onclick=()=>replace(C.sample("inferno"));
function snapshot(){return {format:"glsl-component-composition",composition:C.validate(composition),output:config(),definitions:C.referencedDefinitions(composition)}}
function readSnapshot(x){
 if(!x||x.format!=="glsl-component-composition")throw Error("部品構成JSONではありません");
 if(busy||changed&&!confirm("現在の部品構成を置き換えますか？"))return;
 const defs=x.definitions===undefined?[]:x.definitions,added=C.prepareDefinitions(defs);
 C.withDefinitions(added,()=>C.compile(x.composition));
 if(x.output){const {width,height,fps,columns,color,core}=x.output;if(![width,height,fps,columns].every(Number.isInteger)||width<16||width>512||height<16||height>512||fps<1||fps>60||columns<0||columns>300||!/^#[0-9a-f]{6}$/i.test(color)||!/^#[0-9a-f]{6}$/i.test(core))throw Error("出力設定が不正")}
 verifyAdditions(added);persistAdditions(added);replace(x.composition,x.output,true);
}
$("save").onclick=()=>{try{EffectExport.download(new Blob([JSON.stringify(snapshot(),null,2)],{type:"application/json"}),"effect-composition.json");changed=false}catch(e){status(e.message,true)}};
$("load").onchange=async()=>{try{const f=$("load").files[0];if(f)readSnapshot(JSON.parse(await f.text()))}catch(e){status(e.message,true)}finally{$("load").value=""}};
$("localSave").onclick=()=>{try{localStorage.setItem(storageKey,JSON.stringify(snapshot()));changed=false;showUsage();status("ブラウザーに保存しました")}catch(e){status(e.message,true)}};
$("localLoad").onclick=()=>{try{const raw=localStorage.getItem(storageKey);if(!raw)throw Error("保存された構成がありません");readSnapshot(JSON.parse(raw))}catch(e){status(e.message,true)}};
$("source").onclick=()=>{if(!dirty&&applied)EffectExport.download(new Blob([applied.source],{type:"text/plain"}),"effect.frag")};
async function exportImage(kind){if(busy||dirty||!renderer||!applied||timeDrag)return;busy=true;playing=false;const states=[...document.querySelectorAll("button,input,select,textarea")].map(e=>[e,e.disabled]);for(const [e] of states)e.disabled=true;buttons();const p=applied.p,r=renderer,t=position;try{const plan=EffectEngine.plan(p),frame=Math.min(plan.frames-1,Math.floor(t*p.fps));await EffectExport.run(p,kind,frame,(i,n)=>status("出力中 "+i+"/"+n),async(_p,i,c)=>{r.render(i/p.fps);const ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(r.canvas,0,0);return c});status("画像出力完了")}catch(e){status("出力失敗: "+e.message,true)}finally{busy=false;for(const [e,v] of states)e.disabled=v;position=t;renderAt();buttons()}}
for(const b of exports)b.onclick=()=>exportImage(b.dataset.export);
function tick(now){if(!busy&&playing&&renderer){const delta=Math.min(.10,Math.max(0,(now-last)/1000));position+=delta;const d=applied.composition.duration;if(position>=d){if($("repeat").checked)position%=d;else{position=d;playing=false;buttons()}}renderAt()}last=now;if(!busy&&miniRenderer){try{draw(miniRenderer,$("mini"),((now-miniStart)/1000)%miniDuration)}catch(e){miniRenderer.dispose();miniRenderer=null;$("miniStatus").textContent=e.message;invalidateAuthor()}}requestAnimationFrame(tick)}
window.addEventListener("beforeunload",e=>{if(changed){e.preventDefault();e.returnValue=""}});

const archiveKey="effect-component-archive-v1";
let comparison=null,archiveRaw=null;
function readArchive(){
 const raw=localStorage.getItem(archiveKey);const data=raw===null?{version:1,entries:[]}:JSON.parse(raw);
 if(data.version!==1||!Array.isArray(data.entries)||data.entries.length>50||new Set(data.entries.map(x=>x.id)).size!==data.entries.length||data.entries.some(x=>typeof x.id!=="string"||x.snapshot?.format!=="glsl-component-composition"||!Array.isArray(x.snapshot.composition?.parts)))throw Error("保存構成一覧が不正です。上書きしません");
 return {raw,entries:data.entries};
}
function refreshArchive(){try{const {raw,entries}=readArchive();archiveRaw=raw;const el=$("archiveList"),prev=el.value;el.replaceChildren();option(el,"","選択してください");for(const e of entries)option(el,e.id,e.snapshot.composition.name+" / "+e.savedAt);if(entries.some(e=>e.id===prev))el.value=prev;$("archiveStatus").textContent=entries.length+" / 50 件"}catch(e){$("archiveStatus").textContent=e.message;$("archiveList").replaceChildren();archiveRaw=null}}
function usageEntries(){const entries=[{id:"current",scope:"編集中",composition}],errors=[];
 try{const raw=localStorage.getItem(storageKey);if(raw){const x=JSON.parse(raw);if(x.format!=="glsl-component-composition"||!Array.isArray(x.composition?.parts))throw Error("形式不正");entries.push({id:"slot",scope:"従来の保存枠",composition:x.composition})}}catch(e){errors.push("従来枠: "+e.message)}
 try{for(const e of readArchive().entries)entries.push({id:e.id,scope:"名前付き保存",composition:e.snapshot.composition})}catch(e){errors.push("保存一覧: "+e.message)}
 return {entries,errors};
}
function updateUsageVersions(){const el=$("usageVersion"),prev=el.value;el.replaceChildren();for(const d of C.versions($("usagePart").value))option(el,String(d.version),"v"+d.version+" / "+(C.origin(d.id,d.version)==="builtin"?"組み込み":"ローカル"));if([...C.versions($("usagePart").value)].some(d=>String(d.version)===prev))el.value=prev;else{const ds=C.versions($("usagePart").value);if(ds.length)el.value=String(ds[ds.length-1].version)}showUsage()}
function updateUsageParts(){const el=$("usagePart"),prev=el.value;el.replaceChildren();for(const id of [...new Set(C.definitions().map(d=>d.id))]){const ds=C.versions(id),d=ds[ds.length-1];option(el,id,d.name+" ("+id+")")}if(C.definitions().some(d=>d.id===prev))el.value=prev;else el.value=C.definitions()[0]?.id||"";updateUsageVersions()}
function showUsage(){const box=$("usageResults");box.replaceChildren();try{const {entries,errors}=usageEntries(),id=$("usagePart").value,version=Number($("usageVersion").value),hits=C.findUsage(id,version,entries);for(const x of hits){const item=document.createElement("div");item.className="usage-item";const label=document.createElement("div");label.textContent=x.scope+" / "+x.name+" / #"+(x.index+1)+" / "+x.start+"–"+x.end+"秒"+(x.enabled?"":"（非表示）");item.append(label);if(x.entryId==="current"){const b=document.createElement("button");b.textContent="選択";b.onclick=()=>selectPart(x.uid);item.append(b)}else{const b=document.createElement("button");b.textContent="構成を開く";b.onclick=()=>{try{if(x.entryId==="slot")$("localLoad").onclick();else{const e=readArchive().entries.find(e=>e.id===x.entryId);if(!e)throw Error("保存構成がありません");readSnapshot(e.snapshot)}}catch(e){status(e.message,true)}};item.append(b)}box.append(item)}$("usageStatus").textContent=hits.length+"箇所 / "+entries.length+"構成を確認"+(errors.length?"（一部読込失敗: "+errors.join(" / ")+"）":"")}catch(e){$("usageStatus").textContent=e.message}}
function closeComparison(message=""){
 if(comparison){comparison.before?.dispose();comparison.after?.dispose();comparison=null}
 $("versionComparison").hidden=true;$("versionApply").disabled=true;$("versionStatus").textContent=message;
}
function syncVersion(){closeComparison();const p=current(),el=$("versionTarget"),prev=el.value;el.replaceChildren();$("versionCurrent").textContent=p?p.partId+"@"+p.version+" / "+(C.origin(p.partId,p.version)==="builtin"?"組み込み":"ローカル"):"タイムラインから部品を選択してください";
 const ds=p?C.versions(p.partId).filter(d=>d.version!==p.version):[];for(const d of ds)option(el,String(d.version),"v"+d.version+" / "+d.name+" / "+d.view);
 if(ds.some(d=>String(d.version)===prev))el.value=prev;else if(ds.length)el.value=String(ds[ds.length-1].version);
 $("versionCompare").disabled=!ds.length;showUsage();
}
function comparisonFingerprint(){return JSON.stringify({composition:C.validate(composition),settings:config(),uid:selected,target:$("versionTarget").value})}
function compareAt(q){if(!comparison)return;try{const t=comparison.candidate.composition.duration*q;draw(comparison.before,$("versionBefore"),t);draw(comparison.after,$("versionAfter"),t);$("versionTime").textContent=t.toFixed(2)+" 秒 / "+comparison.candidate.composition.duration.toFixed(2)+" 秒"}catch(e){closeComparison("比較描画失敗: "+e.message)}}
function compareVersions(){
 if(busy)return;closeComparison();let before=null,after=null;
 try{const p=current();if(!p)throw Error("部品を選択してください");const target=Number($("versionTarget").value);if(target===p.version)throw Error("異なる版を選択してください");
 const result=C.migrateVersion(composition,p.uid,target),original=C.compile(composition),candidate=C.compile(result.composition),settings=config(),fingerprint=comparisonFingerprint(),oldP=renderConfig(original.composition,original.source,settings),newP=renderConfig(candidate.composition,candidate.source,settings);
 before=ShaderStudio.createRenderer(oldP,original.source);after=ShaderStudio.createRenderer(newP,candidate.source);
 for(const q of [0,.1,.35,.5,.8,1]){before.render(original.composition.duration*q);after.render(candidate.composition.duration*q)}
 comparison={before,after,candidate,p:newP,settings,fingerprint};before=after=null;
 $("versionBeforeLabel").textContent="変更前 v"+result.from.version;$("versionAfterLabel").textContent="変更後 v"+result.to.version;$("versionNotes").textContent=result.notes.length?result.notes.join("\n"):"互換パラメータを引継ぎ。";
 $("versionComparison").hidden=false;$("versionSeek").value="500";compareAt(.5);if(comparison){$("versionApply").disabled=false;$("versionStatus").textContent="両版のコンパイル・6時点描画成功。構成全体の比較です。"}
 }catch(e){before?.dispose();after?.dispose();closeComparison("比較失敗: "+e.message)}
}
function applyVersion(){
 if(busy||!comparison)return;try{if(comparison.fingerprint!==comparisonFingerprint())throw Error("構成が変わりました。再比較してください");if(!confirm("選択部品だけ版を切り替えますか？保存済み構成は変更しません。"))return;
 const c=comparison,t=Math.min(position,c.candidate.composition.duration);draw(c.after,$("preview"),t);
 const old=renderer;renderer=c.after;c.after=null;composition=c.candidate.composition;applied={...c.candidate,settings:c.settings,p:c.p};position=t;dirty=false;changed=true;old?.dispose();closeComparison();drawEditor();updatePosition();buttons();status("選択部品の版を切り替えました。保存済み構成は未変更。");
 }catch(e){closeComparison("切替失敗: "+e.message)}
}
$("archiveSave").onclick=()=>{if(busy)return;try{const {raw,entries}=readArchive();if(raw!==archiveRaw)throw Error("別タブ等で保存一覧が変わりました。一覧更新してください");if(entries.length>=50)throw Error("保存上限50件です");let id="save-"+Date.now(),i=0;while(entries.some(e=>e.id===id))id="save-"+Date.now()+"-"+(++i);const next={version:1,entries:[...entries,{id,savedAt:new Date().toISOString(),snapshot:snapshot()}]};localStorage.setItem(archiveKey,JSON.stringify(next));changed=false;refreshArchive();$("archiveList").value=id;showUsage();$("archiveStatus").textContent="別保存しました。既存構成は未変更。"}catch(e){$("archiveStatus").textContent=e.message}};
$("archiveLoad").onclick=()=>{if(busy)return;try{const e=readArchive().entries.find(e=>e.id===$("archiveList").value);if(!e)throw Error("保存構成を選択してください");readSnapshot(e.snapshot)}catch(e){$("archiveStatus").textContent=e.message}};
$("archiveRefresh").onclick=()=>{refreshArchive();showUsage()};
$("usagePart").onchange=updateUsageVersions;$("usageVersion").onchange=showUsage;$("usageRefresh").onclick=showUsage;
$("versionTarget").onchange=()=>closeComparison("変更先を選び直しました。");$("versionCompare").onclick=compareVersions;$("versionClose").onclick=()=>closeComparison();$("versionSeek").oninput=()=>compareAt(Number($("versionSeek").value)/1000);$("versionApply").onclick=applyVersion;

refreshArchive();syncRegistry();startAuthor(false);if(registryLoadError)authorStatus(registryLoadError,true);sync();drawEditor();refresh();if(renderer){playing=true;last=performance.now();buttons()}requestAnimationFrame(tick);
})();