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
function refresh(){if(busy)return;dirty=true;buttons();outputInfo();let next=null;
 try{const c=C.compile(composition),settings=config(),p=renderConfig(c.composition,c.source,settings);next=ShaderStudio.createRenderer(p,c.source);const t=Math.min(position,c.composition.duration);draw(next,$("preview"),t);const old=renderer;renderer=next;next=null;applied={...c,settings,p};position=t;dirty=false;old?.dispose();status("反映済み / "+c.composition.parts.length+" 部品 / GLSL "+c.source.length+" 文字"+(c.composition.loop?" / ループの継ぎ目は要確認":""));updatePosition()}catch(e){next?.dispose();status("未反映（前回の正常なプレビューを保持）\n"+e.message,true)}finally{buttons()}}
function mark(){changed=true;dirty=true;buttons();refresh()}
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
 showLibrary();
}
function authorBase(){const v=$("authorBase").value;if(!v)return null;const [id,version]=v.split("@");return C.get(id,Number(version))}
function uniqueId(base){let id=base.slice(0,50),n=1;while(C.nextVersion(id)!==1)id=base.slice(0,50)+"-"+(++n);return id}
function startAuthor(versionMode=false){
 if(busy)return;const base=authorBase();
 if(versionMode&&!base){authorStatus("新版を作る元の部品を選択してください",true);return}
 invalidateAuthor();authorVersionMode=versionMode;
 authorTemplate=base||{name:"発光球",category:"発光",view:"BOTH",duration:1,description:"",body:"float a = ball(p, vec2(0.), .22) * sin(3.14159*q);\nreturn light(a);",dependencies:["fire-common@1"],params:[]};
 $("authorId").value=versionMode?base.id:uniqueId(base?"custom-"+base.id:"custom-orb");$("authorId").readOnly=versionMode;$("authorVersionNumber").value=versionMode?C.nextVersion(base.id):1;
 for(const [id,key] of [["authorName","name"],["authorCategory","category"],["authorView","view"],["authorDuration","duration"],["authorDescription","description"],["authorBody","body"]])$(id).value=authorTemplate[key];
 authorStatus(versionMode?"新しい版を編集中。旧版は変更されません。":"新規部品を編集中。試写後に登録してください。");
}
function readAuthor(){
 const d=C.normalizeDefinition({id:$("authorId").value.trim(),version:Number($("authorVersionNumber").value),name:$("authorName").value.trim(),category:$("authorCategory").value.trim(),view:$("authorView").value,duration:Number($("authorDuration").value),description:$("authorDescription").value,body:$("authorBody").value,dependencies:authorTemplate.dependencies,params:authorTemplate.params});
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
function timeline(){const box=$("timeline");box.replaceChildren();const ruler=document.createElement("div");ruler.className="ruler";const label=document.createElement("span");label.textContent="秒";const scale=document.createElement("div");scale.className="rulerline";for(let i=0;i<=4;i++){const e=document.createElement("span");e.textContent=(composition.duration*i/4).toFixed(2);scale.append(e)}ruler.append(label,scale);box.append(ruler);for(const p of composition.parts){const d=C.get(p.partId,p.version),row=document.createElement("div");row.className="track";const name=document.createElement("button");name.textContent=(p.enabled?"":"非表示 ")+d.name;name.title=d.name;name.onclick=()=>selectPart(p.uid);if(p.uid===selected)name.classList.add("selected");const rail=document.createElement("div");rail.className="rail";const clip=document.createElement("button");clip.className="clip"+(p.uid===selected?" selected":"");clip.style.left=Math.max(0,Math.min(100,p.start/composition.duration*100))+"%";clip.style.width=Math.max(0,Math.min(100,(p.end-p.start)/composition.duration*100))+"%";clip.style.opacity=p.enabled?1:.4;clip.textContent=p.start.toFixed(2)+"–"+p.end.toFixed(2);clip.title=d.name+" "+clip.textContent+"秒";clip.onclick=e=>{e.stopPropagation();selectPart(p.uid)};rail.onclick=e=>{if(!renderer||busy)return;const r=rail.getBoundingClientRect();playing=false;position=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*applied.composition.duration;renderAt();buttons()};const cursor=document.createElement("span");cursor.className="cursor";rail.append(clip,cursor);row.append(name,rail);box.append(row)}updatePosition()}
const numericFields=[["start","開始秒",0,30,.01],["end","終了秒",0,30,.01],["x","開始 X",-2,2,.01],["y","開始 Y",-2,2,.01],["endX","終了 X",-2,2,.01],["endY","終了 Y",-2,2,.01],["arc","放物線の高さ",-2,2,.01],["scale","倍率",.05,4,.01],["rotation","回転角",-360,360,1],["opacity","透明度",0,1,.01],["speed","模様の速度",.05,10,.05],["tintMix","色の適用量",0,1,.01]];
function field(box,title,input){const l=document.createElement("label");l.textContent=title;l.append(input);box.append(l);return input}
function numberField(box,title,value,min,max,step,cb){const i=document.createElement("input");i.type="number";i.min=min;i.max=max;i.step=step;i.value=value;field(box,title,i);i.onchange=()=>{if(busy)return;const n=Number(i.value);if(i.value===""||!Number.isFinite(n)||n<min||n>max){i.value=value;status(title+" の入力範囲が不正",true);return}cb(n)};return i}
function inspector(){const p=current(),box=$("partFields");$("inspector").hidden=!p;$("empty").hidden=!!p;box.replaceChildren();if(!p)return;const d=C.get(p.partId,p.version);$("partName").textContent=d.name+" v"+p.version;for(const [k,label,min,max,step] of numericFields)numberField(box,label,p[k],min,k==="start"||k==="end"?composition.duration:max,step,n=>{p[k]=n;timeline();mark()});const tint=document.createElement("input");tint.type="color";tint.value=p.tint;field(box,"色補正",tint);tint.onchange=()=>{p.tint=tint.value;mark()};const mode=document.createElement("select");option(mode,"local","部品内");option(mode,"scene","全体と同期");mode.value=p.timeMode;field(box,"模様の時間",mode);mode.onchange=()=>{p.timeMode=mode.value;mark()};const show=document.createElement("input");show.type="checkbox";show.checked=p.enabled;field(box,"表示",show);show.onchange=()=>{p.enabled=show.checked;timeline();mark()};for(const a of d.params)numberField(box,a.name,p.params[a.id],a.min,a.max,a.step,n=>{p.params[a.id]=n;mark()})}
function drawEditor(){timeline();inspector();showLibrary();const p=current(),i=composition.parts.indexOf(p);$("duplicate").disabled=!p||composition.parts.length>=C.MAX_PARTS;$("delete").disabled=!p;$("up").disabled=i<=0;$("down").disabled=i<0||i>=composition.parts.length-1;outputInfo()}
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
$("localSave").onclick=()=>{try{localStorage.setItem(storageKey,JSON.stringify(snapshot()));changed=false;status("ブラウザーに保存しました")}catch(e){status(e.message,true)}};
$("localLoad").onclick=()=>{try{const raw=localStorage.getItem(storageKey);if(!raw)throw Error("保存された構成がありません");readSnapshot(JSON.parse(raw))}catch(e){status(e.message,true)}};
$("source").onclick=()=>{if(!dirty&&applied)EffectExport.download(new Blob([applied.source],{type:"text/plain"}),"effect.frag")};
async function exportImage(kind){if(busy||dirty||!renderer||!applied)return;busy=true;playing=false;const states=[...document.querySelectorAll("button,input,select,textarea")].map(e=>[e,e.disabled]);for(const [e] of states)e.disabled=true;buttons();const p=applied.p,r=renderer,t=position;try{const plan=EffectEngine.plan(p),frame=Math.min(plan.frames-1,Math.floor(t*p.fps));await EffectExport.run(p,kind,frame,(i,n)=>status("出力中 "+i+"/"+n),async(_p,i,c)=>{r.render(i/p.fps);const ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(r.canvas,0,0);return c});status("画像出力完了")}catch(e){status("出力失敗: "+e.message,true)}finally{busy=false;for(const [e,v] of states)e.disabled=v;position=t;renderAt();buttons()}}
for(const b of exports)b.onclick=()=>exportImage(b.dataset.export);
function tick(now){if(!busy&&playing&&renderer){const delta=Math.min(.10,Math.max(0,(now-last)/1000));position+=delta;const d=applied.composition.duration;if(position>=d){if($("repeat").checked)position%=d;else{position=d;playing=false;buttons()}}renderAt()}last=now;if(!busy&&miniRenderer){try{draw(miniRenderer,$("mini"),((now-miniStart)/1000)%miniDuration)}catch(e){miniRenderer.dispose();miniRenderer=null;$("miniStatus").textContent=e.message;invalidateAuthor()}}requestAnimationFrame(tick)}
window.addEventListener("beforeunload",e=>{if(changed){e.preventDefault();e.returnValue=""}});
syncRegistry();startAuthor(false);if(registryLoadError)authorStatus(registryLoadError,true);sync();drawEditor();refresh();if(renderer){playing=true;last=performance.now();buttons()}requestAnimationFrame(tick);
})();