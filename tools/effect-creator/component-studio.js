(()=>{"use strict";
const C=EffectComponents,$=id=>document.getElementById(id);
let composition=C.sample("convergence"),selected=composition.parts[0].uid,serial=0,renderer=null,miniRenderer=null,applied=null,dirty=true,playing=false,position=0,last=0,busy=false,miniStart=0,miniPosition=0,miniDuration=1,changed=false;
const exports=[...document.querySelectorAll("[data-export]")],storageKey="effect-components-v1";
const settingsIds=["width","height","fps","columns","color","core"];

const A=SpellAssignments.create(C,ShaderStudio.records,CSMagicReference.rows);
let magicId="",magicRaw=null,magicOutput=null,magicReadError="";
const viewKey="effect-component-studio-view-v1";
function readView(){try{return JSON.parse(localStorage.getItem(viewKey)||"{}")||{}}catch(e){return {}}}
const playbackRates=[.1,.25,.5,.75,1,1.25,1.5,2,3,4];
let playbackRate=playbackRates.includes(readView().playbackRate)?readView().playbackRate:1;
function saveView(){try{localStorage.setItem(viewKey,JSON.stringify({magicId,attribute:$("magicAttribute").value,output:config(),repeat:$("repeat").checked,playbackRate,position,playing}))}catch(e){}}
const magicExportIds=["magicPng","magicSheet","magicWebp","magicZip"];
function magicData(){const raw=localStorage.getItem(SpellAssignments.KEY);return {raw,data:A.parse(raw)}}
function magicState(reset=false){try{const {raw,data}=magicData();if(reset)magicRaw=raw;magicReadError=raw===magicRaw?"":"別タブで保存が変更されました。魔法を再選択してください";return data}catch(e){magicReadError=e.message;return A.empty()}}
function magicMessage(s){$("magicStatus").textContent=s}
function magicButtons(data){const e=data?.entries[magicId];$("magicSave").disabled=!magicId||!!magicReadError||dirty;$("magicAdopt").disabled=!magicId||!!magicReadError||dirty||!e||!e.draft;$("magicLegacy").disabled=!magicId||!!magicReadError||e?.mode!=="components";$("magicRestore").disabled=!magicId||!e?.adopted;if($("magicInitial"))$("magicInitial").hidden=!magicId.startsWith("thunder-");$("magicPreview").disabled=!magicId||!!magicReadError;$("magicDetach").disabled=!magicId;const opts=magicChoices(),i=opts.findIndex(r=>r.id===magicId);$("magicPrev").disabled=i<=0;$("magicNext").disabled=i>=opts.length-1}
function magicChoices(){const attr=$("magicAttribute").value;return A.records.filter(r=>!attr||r.attribute===attr)}
function magicList(){const el=$("magicSelect");el.replaceChildren();option(el,"","選択してください");for(const r of magicChoices())option(el,r.id,(r.row?"CS"+r.row+" ":"")+r.name+(r.ruby?" / "+r.ruby:"")+" / Lv"+r.lv);el.value=magicChoices().some(r=>r.id===magicId)?magicId:""}
function magicSync(){
 const data=magicState(),e=data.entries[magicId];magicButtons(data);
 if(!magicId){if($("magicCopyName"))$("magicCopyName").textContent="";$("magicState").textContent="魔法未選択（自由制作）";$("magicReference").hidden=true;return}
 const r=A.record(magicId);if($("magicCopyName"))$("magicCopyName").textContent=r.name;$("magicReference").hidden=false;CSMagicReference.render(magicId,"magic");$("magicNote").textContent=r.note||"制作備考なし";
 $("magicState").textContent=magicId+" / "+(r.loop?"持続":"発動・単発")+" / "+(e?.draft?"作業構成保存済み":"未保存")+" / 採用出力："+(e?.mode==="components"?"部品版":"旧個別版")+(changed?" / 編集中の変更あり":"")+(applied?.previewOnly?" / 上段：旧個別GLSL（参照用）":"");
 if(magicReadError)magicMessage("保存データ読込失敗（上書きしません）: "+magicReadError);
}
function magicClose(){magicOutput?.renderer.dispose();magicOutput=null;$("magicStage").hidden=true;$("magicSeek").disabled=true;for(const id of magicExportIds)$(id).disabled=true;$("magicTime").textContent="";$("magicOutputStatus").textContent=""}
function magicDetach(){magicClose();magicId="";if(applied?.previewOnly){playing=false;position=0;refresh()}magicList();magicSync();saveView()}
function magicLoadSnapshot(id,x){const n=A.snapshot(id,x),added=C.prepareDefinitions(n.definitions);verifyAdditions(added);persistAdditions(added);replace(n.composition,n.output,true,id)}
function selectMagic(id,source="draft"){
 if(busy)return false;if(!id){magicDetach();return true}
 if(changed&&!confirm("現在の未保存編集を破棄して魔法を切り替えますか？")){magicList();return false}
 try{const data=magicState(true);if(magicReadError)throw Error(magicReadError);const r=A.record(id),e=data.entries[id],x=source==="initial"?null:source==="adopted"?e?.adopted:e?.draft;
 if(source==="adopted"&&!x)throw Error("採用済み構成がありません");
 if(x)magicLoadSnapshot(id,x);else{const initial=A.initial(id,composition.view),s={...config(),color:r.color||"#ff8634"};replace(initial.composition,s,true,id);magicMessage(initial.kind==="thunder-extracted"?"完成版の雷を分解した初期部品構成を読み込みました（編集用・未採用）":initial.kind==="sample"?"比較試作を読み込みました（未採用）":"部品版は未作成。上段で旧個別GLSLを再生します。部品を追加すると部品版へ切り替わります")}
 $("magicAttribute").value=r.attribute;magicList();magicSync();if(renderer&&!dirty){playing=true;last=performance.now();buttons()}saveView();if(x)magicMessage(applied?.previewOnly?"保存構成に部品がないため旧個別GLSLを再生します":source==="adopted"?"採用済み構成を編集用にコピーしました":"保存済み作業構成を読み込みました");return true
 }catch(e){magicList();magicMessage("魔法読込失敗: "+e.message);return false}
}
function magicWrite(action,x){
 if(!magicId)throw Error("魔法を選択してください");
 const {raw,data}=magicData();if(raw!==magicRaw)throw Error("別タブで魔法保存が変更されました。魔法を再選択してください");
 const next=A.transition(data,magicId,action,x,new Date().toISOString());const saved=JSON.stringify(next);localStorage.setItem(SpellAssignments.KEY,saved);magicRaw=saved;magicClose();magicSync();showUsage();
}
function magicConfig(s){const x=A.snapshot(magicId,s,true),c=C.withDefinitions(x.definitions,()=>C.compile(x.composition));return {source:c.source,p:renderConfig(c.composition,c.source,x.output)}}
function magicAdopt(){
 if(busy||dirty||!magicId)return;let r=null;
 try{const {raw,data}=magicData();if(raw!==magicRaw)throw Error("別タブで保存が変更されています");const current=snapshot(),candidate=A.snapshot(magicId,current,true),saved=data.entries[magicId]?.draft;if(!saved||JSON.stringify(A.snapshot(magicId,saved,true))!==JSON.stringify(candidate))throw Error("現在の構成を先に魔法の作業構成として保存してください");
 const {p,source}=magicConfig(candidate);r=ShaderStudio.createRenderer(p,source);for(const q of [0,.1,.35,.5,.8,1])r.render(p.duration*q);r.dispose();r=null;
 if(!confirm("現在保存されている部品構成をこの魔法の採用出力にしますか？見た目を確認・承認済みの場合だけ実行してください。旧個別GLSLは保持されます。"))return;
 magicWrite("adopt",candidate);magicMessage("部品版を採用しました（このブラウザーのみ）")
 }catch(e){r?.dispose();magicMessage("採用失敗: "+e.message)}
}
function magicDraw(){if(!magicOutput)return;try{const o=magicOutput;draw(o.renderer,$("magicCanvas"),o.position);$("magicTime").textContent=o.position.toFixed(3)+" / "+o.p.duration.toFixed(3)+" 秒 / "+o.mode}catch(e){magicClose();$("magicOutputStatus").textContent="描画失敗: "+e.message}}
function magicPreview(){if(busy||!magicId)return;magicClose();let next=null;
 try{const {raw,data}=magicData();const active=A.active(data,magicId),rec=A.record(magicId);let source,p;
 if(active.mode==="components"){({source,p}=magicConfig(active.snapshot))}else{source=ShaderStudio.sources[rec.id];if(!source)throw Error("旧個別GLSLがありません");p=renderConfig({name:rec.name,duration:rec.duration,seed:42},source,{...config(),color:rec.color||"#ff8634"});}
 next=ShaderStudio.createRenderer(p,source);for(const q of [0,.1,.35,.5,.8,1])next.render(p.duration*q);magicOutput={renderer:next,p,source,raw,id:magicId,mode:active.mode==="components"?"採用済み部品版":"旧個別版",position:p.duration*.5};next=null;$("magicStage").hidden=false;$("magicSeek").disabled=false;$("magicSeek").value="500";for(const id of magicExportIds)$(id).disabled=false;magicDraw();if(magicOutput)$("magicOutputStatus").textContent="採用出力を確認できます（試写6時点成功）";
 }catch(e){next?.dispose();magicClose();$("magicOutputStatus").textContent="採用出力の試写失敗: "+e.message}}
async function magicExport(kind){if(busy||!magicOutput)return;const o=magicOutput;
 try{if(localStorage.getItem(SpellAssignments.KEY)!==o.raw||o.id!==magicId)throw Error("採用状態が変更されました。再試写してください");busy=true;playing=false;const states=[...document.querySelectorAll("button,input,select,textarea")].map(e=>[e,e.disabled]);for(const [e] of states)e.disabled=true;try{const plan=EffectEngine.plan(o.p),frame=Math.max(0,Math.min(plan.frames-1,Math.floor(o.position*o.p.fps)));await EffectExport.run(o.p,kind,frame,(i,n)=>{$("magicOutputStatus").textContent="出力中 "+i+"/"+n},async(_p,i,c)=>{o.renderer.render(i/o.p.fps);const ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(o.renderer.canvas,0,0);return c});$("magicOutputStatus").textContent="採用出力完了: "+o.id+" / "+o.mode}finally{busy=false;for(const [e,v] of states)e.disabled=v;magicDraw();buttons()}}
 catch(e){$("magicOutputStatus").textContent="出力失敗: "+e.message}}
function initMagic(){
 magicState(true);option($("magicAttribute"),"","すべて");for(const attr of [...new Set(A.records.map(r=>r.attribute))])option($("magicAttribute"),attr,attr);magicList();magicSync();
 $("magicAttribute").onchange=()=>{const opts=magicChoices();if(!opts.some(r=>r.id===magicId)&&opts.length){const previous=magicId?A.record(magicId).attribute:"";if(!selectMagic(opts[0].id)){$("magicAttribute").value=previous;magicList();magicSync()}}else{magicList();magicSync();saveView()}};$("magicSelect").onchange=()=>selectMagic($("magicSelect").value);
 $("magicPrev").onclick=()=>{const rs=magicChoices(),i=rs.findIndex(r=>r.id===magicId);if(i>0)selectMagic(rs[i-1].id)};
 $("magicNext").onclick=()=>{const rs=magicChoices(),i=rs.findIndex(r=>r.id===magicId);if(i<rs.length-1)selectMagic(rs[i+1].id)};
 $("magicDetach").onclick=magicDetach;
 $("magicSave").onclick=()=>{if(busy||dirty)return;try{magicWrite("save",snapshot());changed=false;magicSync();magicMessage("魔法の作業構成を保存しました。採用出力は未変更")}catch(e){magicMessage("保存失敗: "+e.message)}};
 $("magicAdopt").onclick=magicAdopt;$("magicLegacy").onclick=()=>{if(busy||!confirm("採用出力を旧個別GLSLへ戻しますか？保存した部品構成は保持します。"))return;try{magicWrite("legacy",null);magicMessage("旧個別版へ戻しました")}catch(e){magicMessage(e.message)}};
 $("magicRestore").onclick=()=>selectMagic(magicId,"adopted");if($("magicInitial"))$("magicInitial").onclick=()=>selectMagic(magicId,"initial");$("magicPreview").onclick=magicPreview;$("magicClose").onclick=magicClose;$("magicSeek").oninput=()=>{if(magicOutput){magicOutput.position=Number($("magicSeek").value)/1000*magicOutput.p.duration;magicDraw()}};
 for(const [i,k] of ["png","sheet","webp","zip"].entries())$(magicExportIds[i]).onclick=()=>magicExport(k);
 $("magicBackup").onclick=()=>{try{EffectExport.download(new Blob([JSON.stringify(magicData().data,null,2)],{type:"application/json"}),"effect-spell-assignments.json")}catch(e){magicMessage(e.message)}};
 window.addEventListener("pagehide",()=>{saveView();magicClose()});
}

const newId=()=>{let id;do{id="part-"+(++serial)}while(composition.parts.some(p=>p.uid===id));return id};
function status(message,error=false){$("status").textContent=message;$("status").classList.toggle("error",error)}
function config(){const n=(id,min,max)=>{const v=Number($(id).value);if($(id).value===""||!Number.isInteger(v)||v<min||v>max)throw Error(id+" の範囲が不正");return v};return {width:n("width",16,512),height:n("height",16,512),fps:n("fps",1,60),columns:n("columns",0,300),color:$("color").value,core:$("core").value}}
function renderConfig(c,source,settings){return {...settings,engine:"shader",shape:"burst",duration:c.duration,seed:c.seed,size:88,glow:65,speed:1,shaderLayers:[{name:c.name,code:source}],notes:"GLSL部品構成"}}
function buttons(){for(const b of exports)b.disabled=busy||dirty||!renderer||!!applied?.previewOnly;$("source").disabled=busy||dirty||!applied||!!applied?.previewOnly;$("play").disabled=busy||!renderer;$("compile").disabled=busy;$("play").textContent=playing?"停止":"再生"}
function draw(r,canvas,t){r.render(t);if(canvas.width!==r.canvas.width||canvas.height!==r.canvas.height){canvas.width=r.canvas.width;canvas.height=r.canvas.height}const ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(r.canvas,0,0)}
function updatePosition(){const d=applied?.composition.duration??composition.duration;$("seek").value=String(Math.round(1000*position/d));$("time").textContent=position.toFixed(2)+" / "+d.toFixed(2)+" 秒";for(const n of document.querySelectorAll(".cursor"))n.style.left=Math.min(100,position/Math.max(.001,composition.duration)*100)+"%"}
function outputInfo(){try{const p={...config(),duration:composition.duration};if(!Number.isFinite(p.duration)||p.duration<.05||p.duration>30)throw Error("秒数が不正");const a=EffectEngine.plan(p);$("outputInfo").textContent=a.frames+" コマ / "+a.cols+"×"+a.rows+" / "+a.width+"×"+a.height+" px（透過）"}catch(e){$("outputInfo").textContent=e.message}}
function refresh(){if(busy)return;cancelTimeDrag();dirty=true;buttons();outputInfo();let next=null;
 try{const legacy=!!magicId&&composition.parts.length===0,rec=legacy?A.record(magicId):null;const c=legacy?{composition:{...composition,duration:rec.duration},source:ShaderStudio.sources[rec.id],previewOnly:true}:C.compile(composition);if(!c.source)throw Error("旧個別GLSLがありません");const settings=config(),p=renderConfig(c.composition,c.source,settings);next=ShaderStudio.createRenderer(p,c.source);const t=Math.min(position,c.composition.duration);draw(next,$("preview"),t);const old=renderer;renderer=next;next=null;applied={...c,settings,p};position=t;dirty=false;old?.dispose();status(c.previewOnly?"旧個別GLSLを再生中（部品構成未作成）":"反映済み / "+c.composition.parts.length+" 部品 / GLSL "+c.source.length+" 文字"+(c.composition.loop?" / ループの継ぎ目は要確認":""));updatePosition()}catch(e){next?.dispose();status("未反映（前回の正常なプレビューを保持）\n"+e.message,true)}finally{buttons();magicSync()}}
function mark(){magicClose();invalidateGroup();updateGroupBindings();cancelTimeDrag();closeComparison();showUsage();changed=true;dirty=true;buttons();refresh()}
let repeatPreference=typeof readView().repeat==="boolean"?readView().repeat:null;
function sync(){for(const k of ["name","duration","view","seed"])$(k).value=composition[k];$("loop").checked=composition.loop;$("repeat").checked=repeatPreference===null?composition.loop:repeatPreference}
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
 const base=$("authorBase"),choice=base.value;base.replaceChildren();option(base,"","新規（基本発光球）");for(const d of C.definitions().filter(d=>!C.isComposite(d)))option(base,d.id+"@"+d.version,d.name+" v"+d.version+" ("+d.id+")");if(C.definitions().some(d=>d.id+"@"+d.version===choice))base.value=choice;
 showLibrary();updateUsageParts();syncGroupList();
}
function authorBase(){const v=$("authorBase").value;if(!v)return null;const [id,version]=v.split("@");return C.get(id,Number(version))}
function uniqueId(base){let id=base.slice(0,50),n=1;while(C.nextVersion(id)!==1)id=base.slice(0,50)+"-"+(++n);return id}

let authorParams=[];
function authorSignature(){const types={float:"float",int:"int",bool:"bool",color:"vec3"};$("authorSignature").textContent="vec4 part(vec2 p, float t, float q"+authorParams.map(p=>", "+types[p.type||"float"]+" "+p.id).join("")+")";}
function renderAuthorSimple(){
 const box=$("authorSimpleParams");if(!box)return;box.replaceChildren();
 for(const p of authorParams){
  const el=document.createElement("input"),type=p.type||"float";el.type=type==="bool"?"checkbox":type==="color"?"color":"number";
  if(type==="bool")el.checked=p.default;else el.value=p.default;
  if(el.type==="number"){el.min=p.min;el.max=p.max;el.step=p.step}
  field(box,p.name+(p.unit?"（"+p.unit+"）":""),el);
  el.onchange=()=>{if(busy)return;try{p.default=C.parameterValue(p,type==="bool"?el.checked:type==="color"?el.value:Number(el.value));invalidateAuthor();editParamRows()}catch(e){authorStatus(e.message,true);renderAuthorSimple()}};
 }
}
function editParamRows(){
 renderAuthorSimple();
 const box=$("authorParams");box.replaceChildren();
 for(const [idx,p] of authorParams.entries()){
  const card=document.createElement("div");card.className="param-card";const fields=document.createElement("div");fields.className="fields";
  const change=(k,v)=>{p[k]=v;invalidateAuthor();authorSignature();renderAuthorSimple()};
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
 try{const d=readAuthor();next=trialRenderer(d);draw(next,$("mini"),d.duration*.5);const old=miniRenderer;miniRenderer=next;next=null;old?.dispose();miniPosition=0;miniStart=performance.now();miniDuration=d.duration;$("miniTitle").textContent=d.name+" v"+d.version+"（未登録試写）";$("miniStatus").textContent="試写成功";authorTested=JSON.stringify(d);$("authorRegister").disabled=false;authorStatus("コンパイル・6時点の描画成功。部品登録できます。")}catch(e){next?.dispose();authorStatus("試写失敗: "+e.message,true)}
}
function registerAuthor(){
 if(busy||!authorTested)return;
 try{const d=readAuthor();if(JSON.stringify(d)!==authorTested)throw Error("内容が変わりました。再試写してください");persistAdditions([d]);invalidateAuthor();$("authorBase").value=d.id+"@"+d.version;authorStatus("登録済み: "+d.id+"@"+d.version+"。ライブラリから追加できます。")}catch(e){invalidateAuthor();authorStatus(e.message,true)}
}
function verifyAdditions(raw){
 const added=C.prepareDefinitions(raw);
 C.withDefinitions(added,()=>{for(const d of added){let r=null;try{r=trialRenderer(d)}finally{r?.dispose()}}});
 return added;
}
$("authorBase").addEventListener("change",()=>startAuthor(false));$("authorNew").onclick=()=>startAuthor(false);$("authorVersion").onclick=()=>startAuthor(true);
for(const id of authorIds){$(id).addEventListener("input",invalidateAuthor);$(id).addEventListener("change",invalidateAuthor)}
$("authorTest").onclick=testAuthor;$("authorRegister").onclick=registerAuthor;
$("authorExport").onclick=()=>{if(!busy)EffectExport.download(new Blob([JSON.stringify(registryData(),null,2)],{type:"application/json"}),"glsl-part-registry.json")};
$("authorImport").onchange=async()=>{try{if(busy)return;const file=$("authorImport").files[0];if(!file)return;const raw=parseRegistry(JSON.parse(await file.text())),added=verifyAdditions(raw),count=persistAdditions(added);authorStatus(count+"版を追加しました（既存版は変更なし）")}catch(e){authorStatus("読込失敗: "+e.message,true)}finally{$("authorImport").value=""}};

let libraryChoice=null;
function clearLibraryChoice(){
 libraryChoice=null;
 const label=$("libraryChoice"),add=$("libraryAdd"),cancel=$("libraryCancel");
 if(label)label.textContent="部品名を選択して試写";
 if(add)add.hidden=true;if(cancel)cancel.hidden=true;
 const box=$("library");if(box.querySelectorAll)for(const el of box.querySelectorAll(".selected"))el.classList.remove("selected");
}
function chooseLibraryPart(d,button){
 if(busy)return;
 clearLibraryChoice();libraryChoice=d;button.classList.add("selected");mini(d);
 const label=$("libraryChoice"),add=$("libraryAdd"),cancel=$("libraryCancel");
 const compatible=d.view==="BOTH"||d.view===composition.view;
 if(label)label.textContent=compatible?d.name+" v"+d.version+" を追加しますか？":d.name+"：視点を "+d.view+" に変更すると追加できます";
 if(add){add.hidden=false;add.disabled=!compatible||composition.parts.length>=C.MAX_PARTS}
 if(cancel)cancel.hidden=false;
}
// Batch export uses the same standalone component setup as the library preview.
function batchDefinitions(){
 const cat=$("category").value,query=$("search").value.trim().toLowerCase();
 const filtered=$("batchScope").value==="filtered";
 return C.definitions().filter(d=>!filtered||(!cat||d.category===cat)&&(!query||(d.name+" "+d.id+" "+d.description).toLowerCase().includes(query)));
}
function batchMessage(message,error=false){$("batchStatus").textContent=message;$("batchStatus").classList.toggle("error",error)}
function batchUpdate(){if(!$("batchScope"))return;const n=batchDefinitions().length;$("batchCount").textContent=n+" 部品・版";$("batchPng").disabled=busy||!n;$("batchJson").disabled=busy||!n;}
function batchComposition(d){
 const c=C.create(d.duration,d.view==="BOTH"?composition.view:d.view);
 c.name=d.name;c.parts=[C.instance(d.id,"preview",0,d.duration,d.version)];
 if(C.isComposite(d))c.loop=d.composition.loop;else if(d.category==="氷・持続")c.loop=true;
 const p=c.parts[0];
 if(d.id==="fire-smoky-flight"){p.x=p.endX=-.4;p.y=p.endY=.175}
 else if(!C.isComposite(d)&&d.category==="飛翔"){p.x=-.65;p.endX=.65}
 if(d.id==="shockwave"||d.id==="electric-wave")p.params.squash=c.view==="TOP"?1:.34;
 return c;
}
function batchCatalog(){
 if(busy)return;try{
 const definitions=batchDefinitions(),data={format:"glsl-part-catalog",version:1,count:definitions.length,definitions:definitions.map(d=>({...d,origin:C.origin(d.id,d.version)}))};
 EffectExport.download(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),"effect-part-catalog.json");batchMessage(definitions.length+" 部品・版の一覧JSONを保存しました（参照用）");
 }catch(e){batchMessage(e.message,true)}
}
let batchCanceled=false;
async function batchSheets(){
 if(busy||timeDrag)return;
 let states=[],wasPlaying=playing,completed=0;
 try{
  const defs=batchDefinitions(),settings=config();
  if(!defs.length)throw Error("出力する部品がありません");
  const jobs=defs.map(d=>{const c=batchComposition(d),a=EffectEngine.plan({...settings,duration:c.duration});return {d,c,a}});
  if(jobs.some(j=>j.a.width>16384||j.a.height>16384||j.a.width*j.a.height>32000000))throw Error("シートが大きすぎます。列数・解像度・FPSを調整してください");
  const pixels=jobs.reduce((sum,j)=>sum+j.a.frames*settings.width*settings.height,0);
  if(pixels>250000000)throw Error("一括出力が大きすぎます。分類で分けるか、解像度・FPSを下げてください（上限2.5億フレーム画素）");
  if(!confirm(defs.length+" 部品・版の透過PNGシートをZIPで出力します。現在の編集中構成は変更しません。続けますか？"))return;
  busy=true;playing=false;batchCanceled=false;
  states=[...document.querySelectorAll("button,input,select,textarea")].map(e=>[e,e.disabled]);for(const [e] of states)e.disabled=true;
  $("batchStop").disabled=false;buttons();
  const files=[],items=[];let bytes=0;const enc=new TextEncoder();
  for(const {d,c,a} of jobs){
   if(batchCanceled)break;
   let renderer0=null,sheet=null;
   const safe=d.id.replace(/[^a-zA-Z0-9_-]/g,"_")+"-v"+d.version;
   const item={id:d.id,version:d.version,name:d.name,category:d.category,view:c.view,duration:c.duration,loop:c.loop,frames:a.frames,columns:a.cols,rows:a.rows,width:settings.width,height:settings.height,fps:settings.fps};
   try{
    const x=C.compile(c),p=renderConfig(x.composition,x.source,settings);
    renderer0=ShaderStudio.createRenderer(p,x.source);
    sheet=document.createElement("canvas");sheet.width=a.width;sheet.height=a.height;const ctx=sheet.getContext("2d");if(!ctx)throw Error("Canvas作成失敗");
    for(let i=0;i<a.frames;i++){
     if(batchCanceled)break;
     renderer0.render(i/settings.fps);ctx.drawImage(renderer0.canvas,(i%a.cols)*settings.width,Math.floor(i/a.cols)*settings.height);
     if(i%8===0){batchMessage((completed+1)+"/"+jobs.length+" "+d.name+" "+(i+1)+"/"+a.frames);await new Promise(resolve=>setTimeout(resolve,0))}
    }
    if(batchCanceled)break;
    const blob=await new Promise((resolve,reject)=>sheet.toBlob(b=>b?resolve(b):reject(Error("PNG生成失敗")),"image/png"));
    if(bytes+blob.size>256*1024*1024){batchCanceled=true;item.error="ZIP容量上限256MiB";items.push(item);break}
    const name="sheets/"+safe+".png";files.push({name,bytes:new Uint8Array(await blob.arrayBuffer())});bytes+=blob.size;item.file=name;
   }catch(e){item.error=String(e.message||e)}
   finally{renderer0?.dispose();if(sheet){sheet.width=0;sheet.height=0}}
   items.push(item);completed++;await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(!files.length&&!items.length){batchMessage("中止しました（出力なし）");return}
  const manifest={format:"effect-part-sheet-batch",version:1,settings,requested:jobs.length,exported:files.length,canceled:batchCanceled,items};
  files.push({name:"manifest.json",bytes:enc.encode(JSON.stringify(manifest,null,2))});
  EffectExport.download(EffectExport.zip(files),"effect-parts"+(batchCanceled?"-partial":"")+".zip");
  batchMessage("出力 "+manifest.exported+"/"+jobs.length+" 件"+(batchCanceled?"（途中まで）":"")+" / エラー "+items.filter(x=>x.error).length+" 件。詳細はmanifest.json",items.some(x=>x.error));
 }catch(e){batchMessage("一括出力失敗: "+e.message,true)}
 finally{if(states.length){busy=false;for(const [e,v] of states)e.disabled=v;$("batchStop").disabled=true;playing=wasPlaying;last=miniStart=performance.now();buttons();batchUpdate()}}
}
if($("batchScope")){$("batchScope").onchange=batchUpdate;$("batchJson").onclick=batchCatalog;$("batchPng").onclick=batchSheets;$("batchStop").onclick=()=>{batchCanceled=true;batchMessage("中止中…")}}
function showLibrary(){
 const box=$("library"),cat=$("category").value,query=$("search").value.trim().toLowerCase(),scroll=box.scrollTop;
 clearLibraryChoice();box.replaceChildren();
 for(const d of C.definitions()){
  if(cat&&cat!==d.category||query&&!(d.name+" "+d.id+" "+d.description).toLowerCase().includes(query))continue;
  const row=document.createElement("div");row.className="part";
  const name=document.createElement("button");name.type="button";name.textContent=d.name+" v"+d.version;name.title=d.name+" v"+d.version+"：単体試写";name.onclick=()=>chooseLibraryPart(d,name);
  const desc=document.createElement("small");desc.textContent=d.description||"説明なし";desc.title=d.view+" / "+d.duration+"秒 / "+desc.textContent;
  row.append(name,desc);box.append(row);
 }
 box.scrollTop=scroll;batchUpdate();
}
if($("libraryCancel"))$("libraryCancel").onclick=()=>clearLibraryChoice();
if($("libraryAdd"))$("libraryAdd").onclick=()=>{
 const d=libraryChoice;if(!d||busy||composition.parts.length>=C.MAX_PARTS||d.view!=="BOTH"&&d.view!==composition.view)return;
 addPart(d);const tab=$("studio-tab-part");if(tab)tab.click();
};
function mini(d){if(busy)return;let next=null;try{const c=C.create(d.duration,d.view==="BOTH"?composition.view:d.view);c.name=d.name;c.parts=[C.instance(d.id,"preview",0,d.duration,d.version)];if(C.isComposite(d))c.loop=d.composition.loop;else if(d.category==="氷・持続")c.loop=true;if(d.id==="fire-smoky-flight"){c.parts[0].x=c.parts[0].endX=-.4;c.parts[0].y=c.parts[0].endY=.175}else if(!C.isComposite(d)&&d.category==="飛翔"){c.parts[0].x=-.65;c.parts[0].endX=.65}if(d.id==="shockwave"||d.id==="electric-wave")c.parts[0].params.squash=c.view==="TOP"?1:.34;const x=C.compile(c);const p=renderConfig(x.composition,x.source,{width:128,height:128,fps:12,columns:0,color:$("color").value,core:$("core").value});next=ShaderStudio.createRenderer(p,x.source);draw(next,$("mini"),0);miniRenderer?.dispose();miniRenderer=next;next=null;miniPosition=0;miniStart=performance.now();miniDuration=d.duration;$("miniTitle").textContent=d.name+" v"+d.version;$("miniStatus").textContent="単体再生中"}catch(e){next?.dispose();$("miniStatus").textContent=e.message}}
function addPart(d){if(busy||composition.parts.length>=C.MAX_PARTS){status("部品数の上限です",true);return}const start=0,end=Math.min(composition.duration,d.duration);const p=C.instance(d.id,newId(),start,end,d.version);if(d.id==="fire-smoky-flight"){p.x=p.endX=-.4;p.y=p.endY=.175}else if(!C.isComposite(d)&&d.category==="飛翔"){p.x=-.65;p.endX=.65}if(d.id==="shockwave"||d.id==="electric-wave"||d.id==="ice-ground-freeze"||d.id==="ice-freeze-front")p.params.squash=composition.view==="TOP"?1:.34;composition.parts.push(p);selected=p.uid;drawEditor();mark()}
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
 handle.dataset.timelineUid=p.uid;handle.dataset.timelineMode=mode;
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
   if(d.next.start===d.start&&d.next.end===d.end){selectPart(d.uid);timeStatus("時間は変更されていません");return}
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
  try{const r=C.timelineRange(p.start,p.end,composition.duration,mode,delta,snapSeconds());composition=C.changeTiming(composition,p.uid,r.start,r.end);selected=p.uid;playing=false;drawEditor();mark();for(const el of document.querySelectorAll("[data-timeline-uid]"))if(el.dataset.timelineUid===p.uid&&el.dataset.timelineMode===mode){el.focus({preventScroll:true});break}timeStatus("時間を反映: "+r.start.toFixed(3)+"〜"+r.end.toFixed(3)+" 秒")}catch(err){timeStatus(err.message)}
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
function inspector(){const p=current(),box=$("partFields"),picker=$("studioPartSelect");if(picker){picker.replaceChildren();for(const [i,part] of composition.parts.entries()){const def=C.get(part.partId,part.version);option(picker,part.uid,(i+1)+". "+def.name+" v"+part.version)}picker.value=selected||"";picker.disabled=!p}$("inspector").hidden=!p;$("empty").hidden=!!p;box.replaceChildren();if(!p)return;const d=C.get(p.partId,p.version);$("partName").textContent=d.name+" v"+p.version;for(const [k,label,min,max,step] of numericFields)numberField(box,label,p[k],min,k==="start"||k==="end"?composition.duration:max,step,n=>{if(k==="start"||k==="end"){try{const c=C.changeTiming(composition,p.uid,k==="start"?n:p.start,k==="end"?n:p.end);composition=c;playing=false;drawEditor();mark();timeStatus("時間を反映しました")}catch(e){inspector();status(e.message,true)}return}p[k]=n;timeline();mark()});const tint=document.createElement("input");tint.type="color";tint.value=p.tint;field(box,"色補正",tint);tint.onchange=()=>{p.tint=tint.value;mark()};const mode=document.createElement("select");option(mode,"local","部品内");option(mode,"scene","全体と同期");mode.value=p.timeMode;field(box,"模様の時間",mode);mode.onchange=()=>{p.timeMode=mode.value;mark()};const show=document.createElement("input");show.type="checkbox";show.checked=p.enabled;field(box,"表示",show);show.onchange=()=>{p.enabled=show.checked;timeline();mark()};for(const a of d.params)parameterField(box,a,p)}
if($("studioPartSelect"))$("studioPartSelect").onchange=()=>{if(!busy)selectPart($("studioPartSelect").value)};
if($("studioPartDuplicate"))$("studioPartDuplicate").onclick=()=>{if(!busy)$("duplicate").click()};
if($("studioPartDelete"))$("studioPartDelete").onclick=()=>{if(!busy)$("delete").click()};
if($("studioPartPreview"))$("studioPartPreview").onclick=()=>{
 if(busy)return;const p=current();if(!p)return;let next=null;
 try{const d=C.get(p.partId,p.version),duration=p.end-p.start,c=C.create(duration,composition.view);c.name=d.name;c.loop=composition.loop;const copy=JSON.parse(JSON.stringify(p));copy.start=0;copy.end=duration;c.parts=[copy];const x=C.compile(c);const settings={width:128,height:128,fps:12,columns:0,color:$("color").value,core:$("core").value};next=ShaderStudio.createRenderer(renderConfig(x.composition,x.source,settings),x.source);draw(next,$("mini"),duration*.5);miniRenderer?.dispose();miniRenderer=next;next=null;miniPosition=0;miniStart=performance.now();miniDuration=duration;$("miniTitle").textContent=d.name+"（調整済み）";$("miniStatus").textContent="単体再生中"}catch(e){next?.dispose();$("miniStatus").textContent=e.message}
};
function drawEditor(){invalidateGroup();updateGroupBindings();timeline();inspector();showLibrary();syncVersion();const p=current(),i=composition.parts.indexOf(p);$("duplicate").disabled=!p||composition.parts.length>=C.MAX_PARTS;$("delete").disabled=!p;$("up").disabled=i<=0;$("down").disabled=i<0||i>=composition.parts.length-1;outputInfo()}
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
function replace(c,settings,confirmed=false,associatedId=""){if(busy)return;if(!confirmed&&changed&&!confirm("現在の部品構成を置き換えますか？"))return;const next=C.validate(c);if(settings){const {width,height,fps,columns,color,core}=settings;if(![width,height,fps,columns].every(Number.isInteger)||width<16||width>512||height<16||height>512||fps<1||fps>60||columns<0||columns>300||!/^#[0-9a-f]{6}$/i.test(color)||!/^#[0-9a-f]{6}$/i.test(core))throw Error("出力設定が不正");for(const k of settingsIds)$(k).value=settings[k]}magicClose();magicId=associatedId;composition=next;selected=composition.parts[0]?.uid;playing=false;position=0;changed=false;sync();drawEditor();refresh();magicList();magicSync()}
$("new").onclick=()=>replace(C.create(2.8,composition.view));$("sampleConvergence").onclick=()=>replace(C.spellSample(252));$("sampleInferno").onclick=()=>replace(C.spellSample(257));$("samplePlasma").onclick=()=>replace(C.spellSample(245));$("sampleNapalm").onclick=()=>replace(C.spellSample(253));
function snapshot(){return {format:"glsl-component-composition",...(magicId?{magicId}:{}),composition:C.validate(composition),output:config(),definitions:C.referencedDefinitions(composition)}}
function readSnapshot(x){
 if(!x||x.format!=="glsl-component-composition")throw Error("部品構成JSONではありません");
 if(busy||changed&&!confirm("現在の部品構成を置き換えますか？"))return;
 const defs=x.definitions===undefined?[]:x.definitions,added=C.prepareDefinitions(defs);
 C.withDefinitions(added,()=>C.compile(x.composition));
 if(x.output){const {width,height,fps,columns,color,core}=x.output;if(![width,height,fps,columns].every(Number.isInteger)||width<16||width>512||height<16||height>512||fps<1||fps>60||columns<0||columns>300||!/^#[0-9a-f]{6}$/i.test(color)||!/^#[0-9a-f]{6}$/i.test(core))throw Error("出力設定が不正")}
 let associated="";if(x.magicId!==undefined){const n=A.snapshot(x.magicId,x);associated=n.magicId;if(!confirm("この構成を "+A.record(associated).name+" の作業構成として開きますか？採用状態は変更しません。"))return;magicState(true);if(magicReadError)throw Error(magicReadError);$("magicAttribute").value=A.record(associated).attribute}
 verifyAdditions(added);persistAdditions(added);replace(x.composition,x.output,true,associated);
}
$("save").onclick=()=>{try{EffectExport.download(new Blob([JSON.stringify(snapshot(),null,2)],{type:"application/json"}),"effect-composition.json");changed=false}catch(e){status(e.message,true)}};
$("load").onchange=async()=>{try{const f=$("load").files[0];if(f)readSnapshot(JSON.parse(await f.text()))}catch(e){status(e.message,true)}finally{$("load").value=""}};
$("localSave").onclick=()=>{try{localStorage.setItem(storageKey,JSON.stringify(snapshot()));changed=false;showUsage();status("ブラウザーに保存しました")}catch(e){status(e.message,true)}};
$("localLoad").onclick=()=>{try{const raw=localStorage.getItem(storageKey);if(!raw)throw Error("保存された構成がありません");readSnapshot(JSON.parse(raw))}catch(e){status(e.message,true)}};
$("source").onclick=()=>{if(!dirty&&applied&&!applied.previewOnly)EffectExport.download(new Blob([applied.source],{type:"text/plain"}),"effect.frag")};
async function exportImage(kind){if(busy||dirty||!renderer||!applied||applied.previewOnly||timeDrag)return;busy=true;playing=false;const states=[...document.querySelectorAll("button,input,select,textarea")].map(e=>[e,e.disabled]);for(const [e] of states)e.disabled=true;buttons();const p=applied.p,r=renderer,t=position;try{const plan=EffectEngine.plan(p),frame=Math.min(plan.frames-1,Math.floor(t*p.fps));await EffectExport.run(p,kind,frame,(i,n)=>status("出力中 "+i+"/"+n),async(_p,i,c)=>{r.render(i/p.fps);const ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(r.canvas,0,0);return c});status("画像出力完了")}catch(e){status("出力失敗: "+e.message,true)}finally{busy=false;for(const [e,v] of states)e.disabled=v;position=t;renderAt();buttons()}}
for(const b of exports)b.onclick=()=>exportImage(b.dataset.export);
function tick(now){if(!busy&&playing&&renderer){const delta=document.hidden?0:Math.max(0,(now-last)/1000);position+=delta*playbackRate;const d=applied.composition.duration;if(position>=d){if($("repeat").checked)position%=d;else{position=d;playing=false;buttons()}}renderAt()}last=now;if(!busy&&miniRenderer){try{miniPosition=(miniPosition+(document.hidden?0:Math.max(0,(now-miniStart)/1000))*playbackRate)%miniDuration;miniStart=now;draw(miniRenderer,$("mini"),miniPosition)}catch(e){miniRenderer.dispose();miniRenderer=null;$("miniStatus").textContent=e.message;invalidateAuthor()}}else{miniStart=now}requestAnimationFrame(tick)}
document.addEventListener("visibilitychange",()=>{last=miniStart=performance.now()});
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
 try{for(const [id,e] of Object.entries(magicData().data.entries)){entries.push({id:"magic-draft:"+id,scope:"魔法作業構成 "+id,composition:e.draft.composition});if(e.adopted)entries.push({id:"magic-adopted:"+id,scope:"魔法採用保存 "+id,composition:e.adopted.composition})}}catch(e){errors.push("魔法保存: "+e.message)}
 return {entries,errors};
}
function updateUsageVersions(){const el=$("usageVersion"),prev=el.value;el.replaceChildren();for(const d of C.versions($("usagePart").value))option(el,String(d.version),"v"+d.version+" / "+(C.origin(d.id,d.version)==="builtin"?"組み込み":"ローカル"));if([...C.versions($("usagePart").value)].some(d=>String(d.version)===prev))el.value=prev;else{const ds=C.versions($("usagePart").value);if(ds.length)el.value=String(ds[ds.length-1].version)}showUsage()}
function updateUsageParts(){const el=$("usagePart"),prev=el.value;el.replaceChildren();for(const id of [...new Set(C.definitions().map(d=>d.id))]){const ds=C.versions(id),d=ds[ds.length-1];option(el,id,d.name+" ("+id+")")}if(C.definitions().some(d=>d.id===prev))el.value=prev;else el.value=C.definitions()[0]?.id||"";updateUsageVersions()}
function showUsage(){const box=$("usageResults");box.replaceChildren();try{const {entries,errors}=usageEntries(),id=$("usagePart").value,version=Number($("usageVersion").value),hits=C.findUsage(id,version,entries);for(const x of hits){const item=document.createElement("div");item.className="usage-item";const label=document.createElement("div");label.textContent=x.scope+" / "+x.name+" / #"+(x.index+1)+" / "+Number(x.start).toFixed(3)+"–"+Number(x.end).toFixed(3)+"秒"+(x.enabled?"":"（非表示）")+(x.path?" / "+x.path:"");item.append(label);if(x.entryId==="current"){const b=document.createElement("button");b.textContent="選択";b.onclick=()=>selectPart(x.uid);item.append(b)}else{const b=document.createElement("button");b.textContent="構成を開く";b.onclick=()=>{try{if(x.entryId==="slot")$("localLoad").onclick();else if(x.entryId.startsWith("magic-draft:"))selectMagic(x.entryId.slice(12));else if(x.entryId.startsWith("magic-adopted:"))selectMagic(x.entryId.slice(14),"adopted");else{const e=readArchive().entries.find(e=>e.id===x.entryId);if(!e)throw Error("保存構成がありません");readSnapshot(e.snapshot)}}catch(e){status(e.message,true)}};item.append(b)}box.append(item)}$("usageStatus").textContent=hits.length+"箇所 / "+entries.length+"構成を確認"+(errors.length?"（一部読込失敗: "+errors.join(" / ")+"）":"")}catch(e){$("usageStatus").textContent=e.message}}
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
function applyVersion(){magicClose();
 if(busy||!comparison)return;try{if(comparison.fingerprint!==comparisonFingerprint())throw Error("構成が変わりました。再比較してください");if(!confirm("選択部品だけ版を切り替えますか？保存済み構成は変更しません。"))return;
 const c=comparison,t=Math.min(position,c.candidate.composition.duration);draw(c.after,$("preview"),t);
 const old=renderer;renderer=c.after;c.after=null;composition=c.candidate.composition;applied={...c.candidate,settings:c.settings,p:c.p};position=t;dirty=false;changed=true;old?.dispose();closeComparison();drawEditor();updatePosition();buttons();status("選択部品の版を切り替えました。保存済み構成は未変更。");magicSync();
 }catch(e){closeComparison("切替失敗: "+e.message)}
}
$("archiveSave").onclick=()=>{if(busy)return;try{const {raw,entries}=readArchive();if(raw!==archiveRaw)throw Error("別タブ等で保存一覧が変わりました。一覧更新してください");if(entries.length>=50)throw Error("保存上限50件です");let id="save-"+Date.now(),i=0;while(entries.some(e=>e.id===id))id="save-"+Date.now()+"-"+(++i);const next={version:1,entries:[...entries,{id,savedAt:new Date().toISOString(),snapshot:snapshot()}]};localStorage.setItem(archiveKey,JSON.stringify(next));changed=false;refreshArchive();$("archiveList").value=id;showUsage();$("archiveStatus").textContent="別保存しました。既存構成は未変更。"}catch(e){$("archiveStatus").textContent=e.message}};
$("archiveLoad").onclick=()=>{if(busy)return;try{const e=readArchive().entries.find(e=>e.id===$("archiveList").value);if(!e)throw Error("保存構成を選択してください");readSnapshot(e.snapshot)}catch(e){$("archiveStatus").textContent=e.message}};
$("archiveRefresh").onclick=()=>{refreshArchive();showUsage()};
$("usagePart").onchange=updateUsageVersions;$("usageVersion").onchange=showUsage;$("usageRefresh").onclick=showUsage;
$("versionTarget").onchange=()=>closeComparison("変更先を選び直しました。");$("versionCompare").onclick=compareVersions;$("versionClose").onclick=()=>closeComparison();$("versionSeek").oninput=()=>compareAt(Number($("versionSeek").value)/1000);$("versionApply").onclick=applyVersion;


let groupBindings=new Map(),groupTested=null,groupVersionId=null;
function groupStatus(s){$("groupStatus").textContent=s}
function invalidateGroup(){groupTested=null;$("groupRegister").disabled=true}
function syncGroupList(){const el=$("groupBase"),prev=el.value;el.replaceChildren();option(el,"","選択してください");for(const d of C.definitions().filter(C.isComposite))option(el,d.id+"@"+d.version,d.name+" v"+d.version+" ("+d.id+")");if(C.definitions().some(d=>C.isComposite(d)&&d.id+"@"+d.version===prev))el.value=prev}
function updateGroupBindings(){
 const box=$("groupBindings"),valid=new Set();box.replaceChildren();
 for(const [i,p] of composition.parts.entries()){
  const d=C.get(p.partId,p.version);
  for(const param of d.params){
   const key=JSON.stringify([p.uid,param.id]);valid.add(key);
   const label=document.createElement("label");label.className="usage-item check";const input=document.createElement("input");input.type="checkbox";input.checked=groupBindings.has(key);
   const text=document.createElement("span");text.textContent="#"+(i+1)+" "+d.name+" / "+param.name+" = "+String(p.params[param.id]);label.append(input,text);box.append(label);
   input.onchange=()=>{if(input.checked){if(groupBindings.size>=16){input.checked=false;groupStatus("公開項目は最大16件");return}let n=1;while([...groupBindings.values()].some(b=>b.id==="exposed"+n))n++;groupBindings.set(key,{id:"exposed"+n,name:(d.name+" / "+param.name).slice(0,100),uid:p.uid,paramId:param.id})}else groupBindings.delete(key);invalidateGroup();$("groupInfo").textContent=groupBindings.size+" / 16 公開項目"};
  }
 }
 for(const key of groupBindings.keys())if(!valid.has(key))groupBindings.delete(key);
 $("groupInfo").textContent=composition.parts.length+" 子部品 / "+composition.duration+"秒 / "+groupBindings.size+" / 16 公開項目";
}
function newGroup(){
 if(busy)return;groupVersionId=null;groupBindings.clear();invalidateGroup();$("groupId").readOnly=false;$("groupId").value=uniqueId("composite");$("groupVersion").value=1;$("groupName").value=(composition.name+"（複合）").slice(0,100);$("groupCategory").value="複合";$("groupDescription").value="";updateGroupBindings();groupStatus("現在の構成から新規部品を制作");
}
function openGroup(){
 if(busy)return;try{const v=$("groupBase").value;if(!v)throw Error("複合部品を選択してください");const [id,ver]=v.split("@"),d=C.get(id,Number(ver));if(!C.isComposite(d))throw Error("複合部品ではありません");
 if(!confirm("現在の編集を複合部品の子構成で置き換えますか？登録済みの旧版は変更しません。"))return;
 replace(d.composition,null,true);groupVersionId=d.id;$("groupId").readOnly=true;$("groupId").value=d.id;$("groupVersion").value=C.nextVersion(d.id);$("groupName").value=d.name;$("groupCategory").value=d.category;$("groupDescription").value=d.description;groupBindings=new Map(d.bindings.map(b=>[JSON.stringify([b.uid,b.paramId]),{...b}]));invalidateGroup();updateGroupBindings();groupStatus("子構成を開きました。変更を新版として登録できます");
 }catch(e){groupStatus(e.message)}
}
function readGroup(){
 const id=$("groupId").value.trim(),version=Number($("groupVersion").value);
 if(version!==C.nextVersion(id)||groupVersionId!==null&&id!==groupVersionId||groupVersionId===null&&version!==1)throw Error("新規IDまたは新版を指定してください");
 return C.makeComposite(composition,{id,version,name:$("groupName").value.trim(),category:$("groupCategory").value.trim(),description:$("groupDescription").value},[...groupBindings.values()]);
}
$("groupNew").onclick=newGroup;$("groupOpen").onclick=openGroup;
for(const id of ["groupId","groupName","groupCategory","groupDescription"])$(id).addEventListener("input",invalidateGroup);
$("groupTest").onclick=()=>{if(busy)return;invalidateGroup();let next=null;try{const d=readGroup();next=trialRenderer(d);draw(next,$("mini"),d.duration*.5);const old=miniRenderer;miniRenderer=next;next=null;old?.dispose();miniPosition=0;miniStart=performance.now();miniDuration=d.duration;$("miniTitle").textContent=d.name+"（複合部品試写）";$("miniStatus").textContent="試写成功";groupTested=JSON.stringify(d);$("groupRegister").disabled=false;groupStatus("コンパイル・6時点の試写成功。登録できます")}catch(e){next?.dispose();groupStatus("試写失敗: "+e.message)}};
$("groupRegister").onclick=()=>{if(busy||!groupTested)return;try{const d=readGroup();if(JSON.stringify(d)!==groupTested)throw Error("構成が変更されています。再試写してください");persistAdditions([d]);invalidateGroup();$("groupBase").value=d.id+"@"+d.version;groupStatus(d.id+"@"+d.version+" を登録しました。元の構成は未変更")}catch(e){invalidateGroup();groupStatus(e.message)}};

$("repeat").addEventListener("change",()=>{repeatPreference=$("repeat").checked;saveView()});
$("playbackRate").value=String(playbackRate);
$("playbackRate").addEventListener("change",()=>{const rate=Number($("playbackRate").value);if(!playbackRates.includes(rate))return;playbackRate=rate;last=miniStart=performance.now();saveView()});
const savedView=readView();initMagic();refreshArchive();syncRegistry();startAuthor(false);newGroup();if(registryLoadError)authorStatus(registryLoadError,true);sync();drawEditor();
if(savedView.output){try{const settings=A.output(savedView.output);for(const k of settingsIds)$(k).value=settings[k]}catch(e){}}
if([...$("magicAttribute").options].some(o=>o.value===savedView.attribute))$("magicAttribute").value=savedView.attribute;
const restored=typeof savedView.magicId==="string"&&A.records.some(r=>r.id===savedView.magicId)&&selectMagic(savedView.magicId);
if(!restored){magicList();magicSync();refresh()}
if(renderer){playing=true;last=performance.now();if(restored){if(Number.isFinite(savedView.position)){position=Math.max(0,Math.min(applied.composition.duration,savedView.position));playing=savedView.playing!==false;if(playing&&position>=applied.composition.duration)position=0;renderAt()}}buttons()}saveView();requestAnimationFrame(tick);
})();