/* Regression smoke: template editor classifications, linked windows, interior areas,
   furniture sizing/rotation, collision warning, and backward-compatible copy-save.
   Run: node rebuild/tests/template-advanced-editor.js */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const folder=path.resolve(__dirname,"..");
const source=file=>fs.readFileSync(path.join(folder,file),"utf8");
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.dataset={};this.attributes={};
  this.classList={add(){}};this.value="";this.checked=false;this.style={};this.hidden=true;this.textContent="";this.parentNode=null}
 setAttribute(key,value){this.attributes[key]=value}
 append(...items){for(const item of items){item.parentNode=this;this.children.push(item)}}
 replaceChildren(...items){this.children=[];this.append(...items)}
 insertBefore(item,reference){
  if(item.parentNode)item.parentNode.children=item.parentNode.children.filter(x=>x!==item);
  const index=this.children.indexOf(reference);
  this.children.splice(index<0?this.children.length:index,0,item);item.parentNode=this;
 }
 get firstChild(){return this.children[0]||null}
 get options(){return this.children}
 addEventListener(key,callback){this.listeners[key]=callback}
 dispatchEvent(event){this.listeners[event.type]?.(event)}
 click(){this.listeners.click?.()}
 focus(){}
 getBoundingClientRect(){return{width:540,height:360,left:0,top:0}}
 querySelectorAll(){return[]}
 getContext(){return new Proxy({measureText:s=>({width:s.length*6}),
  createLinearGradient:()=>({addColorStop(){}})},{
  get:(obj,key)=>obj[key]??(()=>{})})}
}
const elements=new Map(),get=id=>{
 if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);
};
const document={
 getElementById:get,createElement:tag=>new Element(tag),
 createElementNS:(_ns,tag)=>new Element(tag),addEventListener(){},activeElement:null
};
get("editor-grid-spacing").value="2";
get("template-preview-grid").checked=true;
get("template-preview-picker").append(get("template-preview-list"));
get("template-edit-controls").append(get("template-edit-catalog"));
get("template-era-filter").value="all";get("template-use-filter").value="all";
const store={data:null,setItem(key,value){
 assert.equal(key,"mymapcreater:building-templates:v1");this.data=JSON.parse(value);
},getItem(){return null}};
const window={confirm(){return true},dispatchEvent(){}};
const ctx=vm.createContext({window,document,localStorage:store,
 ResizeObserver:class{observe(){}},Event:class{constructor(type){this.type=type}}});
for(const file of ["building-templates.js","map-viewer.js","template-preview.js"])
 vm.runInContext(source(file),ctx,{filename:file});
const templates=window.AAMapBuildingTemplates;
assert.equal(templates.presets.length,46,"Original builtin count");
const original=JSON.stringify(templates.generate("jp_mansion_3ldk",{prefix:"original",spacing:2}).objects);
const picker=new Element("select");picker.value="jp_mansion_3ldk";
window.AAMapTemplatePreview.init(templates,picker);
get("template-preview-open").click();
assert.equal(get("template-preview-list").children.length,46);
assert.match(get("template-area-status").textContent,/室内面積（概算）/);
get("template-era-filter").value="modern-jp";get("template-era-filter").listeners.change();
assert.equal(get("template-preview-list").children.length,6);
get("template-era-filter").value="all";get("template-era-filter").listeners.change();
get("template-mode-toggle").click();
assert.equal(get("template-edit-controls").hidden,false);
assert.equal(get("template-edit-catalog").parentNode,get("template-preview-picker"));
// A window inserted from the left category palette is snapped to a wall.
get("template-item-category").value="建築";get("template-item-category").listeners.change();
get("template-item-choice").value="window";get("template-item-add").click();
assert.equal(get("template-preview-info-title").textContent,"窓");
assert.equal(Number(get("template-opening-width").value),100);
get("template-opening-width").value="75";get("template-item-apply").click();
assert.match(get("template-edit-status").textContent,/変更/);
// A dimensioned, rotated furniture object can be reverted and restored.
get("template-item-category").value="家具";get("template-item-category").listeners.change();
get("template-item-choice").value="chair";get("template-item-add").click();
assert.equal(get("template-preview-info-title").textContent,"椅子");
get("template-undo").click();get("template-redo").click();
get("template-dim-width").value="50";get("template-dim-height").value="50";
get("template-dim-rotation").value="35";get("template-item-apply").click();
assert.match(get("template-collision-status").textContent,/問題なし/);
get("template-save-id").value="advanced_test_3ldk";
get("template-save-name").value="テスト3LDK";get("template-save-copy").click();
assert.equal(templates.custom.length,1);
assert.equal(store.data.length,1);
const custom=store.data[0];
const windowObj=custom.objects.find(o=>o.objectType==="window");
const chair=custom.objects.find(o=>o.shapePresetId==="chair"&&o.metadata?.templateEditor);
assert(windowObj?.opening?.wallId,"Saved window must reference its wall");
assert.equal(chair.geometry.rotation,35);
assert.equal(chair.geometry.width,2);
assert.equal(templates.generate("jp_mansion_3ldk",{prefix:"original",spacing:2}).objects.length,
 JSON.parse(original).length,"Builtin unchanged after custom save");
assert.equal(JSON.stringify(templates.generate("jp_mansion_3ldk",{prefix:"original",spacing:2}).objects),
 original,"Original standard fixtures unchanged");
const regenerated=templates.generate("advanced_test_3ldk",{prefix:"copy",spacing:2});
window.AAMapViewer.sceneCheck({schemaVersion:2,objects:regenerated.objects});
const linked=regenerated.objects.find(o=>o.objectType==="window");
assert(regenerated.objects.some(o=>o.id===linked.opening.wallId&&o.objectType==="wall"),
 "Custom template must remap window-wall reference when generating");
// A bad placement must warn before save and not corrupt earlier custom templates.
picker.value="jp_mansion_1ldk";get("template-preview-open").click();
get("template-mode-toggle").click();
get("template-item-category").value="家具";get("template-item-category").listeners.change();
get("template-item-choice").value="chair";get("template-item-add").click();
assert.match(get("template-collision-status").textContent,/干渉/);
get("template-save-id").value="bad_overlap";
get("template-save-name").value="重複した部屋";get("template-save-copy").click();
assert.match(get("template-edit-status").textContent,/保存失敗/);
assert.equal(templates.custom.length,1);
console.log("OK: 46 standard templates preserved, room areas, live clearance, wall-linked window, dimensions/rotation, undo/redo and custom save");
