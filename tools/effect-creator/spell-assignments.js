/* Local-only spell assignments. The catalog and CS snapshot remain read-only. */
const SpellAssignments=(function(){
"use strict";
const KEY="effect-spell-assignments-v1",MAX=500;
const clone=x=>JSON.parse(JSON.stringify(x));
function create(C,records,refs){
 const byId=new Map(records.map(r=>[r.id,r]));
 function record(id){const r=byId.get(id);if(!r)throw Error("不明な魔法ID: "+id);return r}
 function reference(id){const r=record(id),ref=refs[id]||refs[r.baseId||id.replace(/-sustain$/,"")];return {record:r,ref:ref||null}}
 function output(o){
  if(!o||![o.width,o.height,o.fps,o.columns].every(Number.isInteger)||o.width<16||o.width>512||o.height<16||o.height>512||o.fps<1||o.fps>60||o.columns<0||o.columns>300||!/^#[0-9a-f]{6}$/i.test(o.color)||!/^#[0-9a-f]{6}$/i.test(o.core))throw Error("出力設定が不正");
  return {width:o.width,height:o.height,fps:o.fps,columns:o.columns,color:o.color,core:o.core}
 }
 function snapshot(id,x,forAdoption=false){
  const r=record(id);
  if(!x||x.format!=="glsl-component-composition")throw Error("構成JSONが不正");
  if(x.magicId!==undefined&&x.magicId!==id)throw Error("別の魔法IDの構成です");
  const defs=x.definitions??[];
  const c=C.withDefinitions(defs,()=>{const compiled=C.compile(x.composition),definitions=C.referencedDefinitions(compiled.composition);return {composition:compiled.composition,definitions}});
  if(c.composition.loop!==r.loop)throw Error("発動/持続設定をカタログに合わせてください");
  if(forAdoption&&!c.composition.parts.some(p=>p.enabled&&p.opacity>0))throw Error("有効な部品がありません");
  return {format:"glsl-component-composition",magicId:id,...c,output:output(x.output)}
 }
 function empty(){return {version:1,entries:{}}}
 function parse(raw){
  if(raw===null)return empty();const v=JSON.parse(raw);
  if(!v||v.version!==1||!v.entries||typeof v.entries!=="object"||Array.isArray(v.entries)||Object.keys(v.entries).length>MAX)throw Error("魔法保存データが不正です");
  for(const [id,e] of Object.entries(v.entries)){record(id);if(!e||!["legacy","components"].includes(e.mode)||!e.draft||typeof e.savedAt!=="string"||e.mode==="components"&&!e.adopted)throw Error("魔法保存項目が不正: "+id);for(const x of [e.draft,e.adopted].filter(Boolean)){if(x.format!=="glsl-component-composition"||x.magicId!==id||!Array.isArray(x.composition?.parts)||!Array.isArray(x.definitions))throw Error("保存構成が不正: "+id)}}
  return v
 }
 function transition(input,id,action,x=null,at=""){
  record(id);const data=clone(input),prev=data.entries[id];if(action==="save"){const draft=snapshot(id,x);data.entries[id]={mode:prev?.mode||"legacy",draft,adopted:prev?.adopted||null,savedAt:at,adoptedAt:prev?.adoptedAt||null}}
  else if(action==="adopt"){if(!prev)throw Error("先に魔法の構成を保存してください");const candidate=snapshot(id,x,true);if(JSON.stringify(candidate)!==JSON.stringify(snapshot(id,prev.draft,true)))throw Error("保存した構成と一致しません。再保存してください");data.entries[id]={...prev,mode:"components",adopted:clone(candidate),adoptedAt:at}}
  else if(action==="legacy"){if(!prev)throw Error("保存済み構成がありません");data.entries[id]={...prev,mode:"legacy"}}
  else throw Error("不明な操作");
  if(Object.keys(data.entries).length>MAX)throw Error("保存上限 "+MAX+" 件");return data
 }
 function initial(id,view="SIDE"){const r=record(id),s=C.spellComparisons.find(d=>id==="magic-cs-"+d.row);if(s)return {composition:C.spellSample(s.row),kind:"sample"};const c=C.create(r.duration,view);c.name=r.name;c.loop=r.loop;return {composition:c,kind:"empty"}}
 function active(data,id){record(id);const e=data.entries[id];return e?.mode==="components"?{mode:"components",snapshot:snapshot(id,e.adopted,true)}:{mode:"legacy",record:record(id)}}
 return {record,reference,output,snapshot,empty,parse,transition,initial,active,records}
}
return {KEY,create};
})();
if(typeof module!=="undefined")module.exports=SpellAssignments;