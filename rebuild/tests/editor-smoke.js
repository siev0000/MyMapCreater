/* Node smoke tests for the generic editor & viewer, no browser dependencies. */
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../.."),read=n=>fs.readFileSync(path.join(root,n),"utf8");
const sample=JSON.parse(read("rebuild/examples/sample-town.scene.json"));
const tree={schemaVersion:1,defaultMapId:"world_map",maps:[{id:"world_map",name:"架空の世界",kind:"root",parentId:null,source:"sample.scene.json"}]};
const draw={strokes:[],labels:[]},ctx=new Proxy({strokeStyle:"",fillStyle:"",lineWidth:1},{get(t,k){
 if(k in t)return t[k];
 if(k==="stroke")return()=>draw.strokes.push(t.strokeStyle);
 if(k==="fillText")return(s)=>draw.labels.push(s);
 return()=>{};
},set(t,k,v){t[k]=v;return true}});
function makeElement(tag="div"){
 const el={tag,hidden:false,textContent:"",value:"",checked:false,disabled:false,style:{},children:[],listeners:{},attributes:{},
  classList:{add(){},remove(){},toggle(){},contains(){return false}},
  append(...items){for(const item of items)if(item.tag==="fragment")this.children.push(...item.children);else this.children.push(item)},
  replaceChildren(...items){this.children=[];this.append(...items)},
  setAttribute(key,value){this.attributes[key]=value},addEventListener(key,fn){this.listeners[key]=fn},
  click(){this.listeners.click?.()},focus(){},remove(){},
  getContext(){return ctx},
  getBoundingClientRect(){return{width:850,height:540,left:0,top:0}},
  setPointerCapture(){},hasPointerCapture(){return false},releasePointerCapture(){},contains(item){return item===this}
 };
 return el;
}
const ids=[
"viewport","map-canvas","detail-panel","detail-title","detail-text","detail-meta",
"legend-footer","legend-content","legend-switch","visibility-controls","zoom-in","zoom-out",
"zoom-reset","zoom-label","map-hint","scene-select","scene-name","edit-hint","message",
"undo","redo","clone-object","delete-object","selected-fields","select-empty",
"objects","object-search","clear-search","obj-id","obj-name","obj-display-level","obj-type",
"obj-parent","layer-list","obj-layer","obj-z","obj-visible","obj-selectable",
"door-type","door-leaf-count","door-slide-fields","door-slide-direction","door-wall-id","door-wall-fields","wall-thickness-fields","wall-thickness","rect-rotation-fields","obj-rotation","vertex-actions","vertex-index","vertex-delete","obj-geometry","obj-fill-enabled","obj-fill","obj-stroke-enabled","obj-stroke",
"obj-stroke-width","obj-opacity","obj-label-visible","obj-label-text","obj-label-x",
"obj-label-y","obj-label-size","obj-detail","json-object","geometry-fields",
"apply-json","new-shape","new-role","new-layer","new-parent-selected","new-when-parent-selected","add-object","move-mode","open-json","file-input","download","show-scene-json","reload-scene-json","apply-scene-json","scene-json-text","scene-json-fields"
];
const el=Object.fromEntries(ids.map(id=>[id,makeElement(id)]));
el["new-shape"].value="rect";
const document={title:"",body:makeElement("body"),
 getElementById(id){assert(el[id],"Unknown element "+id);return el[id]},
 createElement:makeElement,createDocumentFragment:()=>makeElement("fragment")
};
const location={hash:""};
const history={replaceState(a,b,hash){location.hash=hash}};
const store={getItem(){return null},setItem(){}};
const downloads=[];
const URL={createObjectURL(){return"blob:test"},revokeObjectURL(){}};
let activeLink=null;
const createElement=document.createElement;
document.createElement=function(tag){
 const node=createElement(tag);
 if(tag==="a"){node.click=function(){downloads.push(this.download)}}
 return node;
};
const window={devicePixelRatio:1,listeners:{},addEventListener(name,fn){this.listeners[name]=fn}};
class ResizeObserver{constructor(fn){this.fn=fn}observe(){this.fn()}}
const fetch=async target=>({ok:true,json:async()=>target==="./map-tree.json"?tree:sample});
const context=vm.createContext({window,document,ResizeObserver,localStorage:store,
 history,location,fetch,confirm:()=>true,Blob,URL,console});
vm.runInContext(read("rebuild/map-viewer.js"),context,{filename:"map-viewer.js"});
vm.runInContext(read("rebuild/map-editor.js"),context,{filename:"map-editor.js"});
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve()};
async function main(){
 await tick();
 assert.equal(el["scene-name"].textContent,"汎用サンプル：町");
 assert.equal(el["visibility-controls"].children[0]?.textContent,"通路：主要のみ","Visibility label must come from JSON");
 el["visibility-controls"].children[0].click();
 assert.equal(el["visibility-controls"].children[0]?.textContent,"通路：全案を表示");
 el["visibility-controls"].children[0].click();
 assert.equal(el["visibility-controls"].children[0]?.textContent,"通路：非表示");
 assert.equal(el.objects.children.length,sample.objects.length);
 assert.deepEqual(draw.labels.includes("非表示のはず"),false);
 assert(draw.strokes.includes("#f5dfac"),"Independent wall not drawn");
 const choice=el.objects.children.find(item=>item.children[0].textContent==="作業棟");
 assert(choice,"Editor did not show building");
 choice.click();
 assert.equal(el["obj-id"].value,"workshop");
 // Explicitly create a nested door, displayed only when the parent is selected.
 el["new-shape"].value="polyline";el["new-role"].value="door";el["new-level"].value="small";
 el["new-parent-selected"].checked=true;el["new-when-parent-selected"].checked=true;
 el["add-object"].click();
 assert.equal(el["obj-type"].value,"door");
 el["door-type"].value="sliding";el["door-type"].listeners.change();
 assert.equal(JSON.parse(el["json-object"].value).door.type,"sliding");
 el["door-leaf-count"].value="2";el["door-leaf-count"].listeners.change();
 assert.equal(JSON.parse(el["json-object"].value).door.leafCount,2);
 el.undo.click();
 assert.notEqual(JSON.parse(el["json-object"].value).door.leafCount,2);
 el.redo.click();
 assert.equal(JSON.parse(el["json-object"].value).door.leafCount,2);
 el["door-slide-direction"].value="start";el["door-slide-direction"].listeners.change();
 assert.equal(JSON.parse(el["json-object"].value).door.slideDirection,"start");
 el.undo.click();
 assert.equal(JSON.parse(el["json-object"].value).door.slideDirection,"end");
 el.redo.click();
 assert.equal(JSON.parse(el["json-object"].value).door.slideDirection,"start");
 assert.equal(el["obj-parent"].value,"workshop");
 assert.equal(JSON.parse(el["json-object"].value).visibility.whenParentSelected,true);
 el.undo.click();
 const workshopAgain=el.objects.children.find(item=>item.children[0].textContent==="作業棟");
 workshopAgain.click();
 el["new-parent-selected"].checked=false;el["new-when-parent-selected"].checked=false;
 el["obj-name"].value="編集済み作業棟";el["obj-name"].listeners.change();
 assert.equal(el["obj-name"].value,"編集済み作業棟");
 el.undo.click();assert.equal(el["obj-name"].value,"作業棟");
 el.redo.click();assert.equal(el["obj-name"].value,"編集済み作業棟");
 el["obj-label-visible"].checked=false;el["obj-label-visible"].listeners.change();
 assert.equal(el["obj-label-visible"].checked,false);
 el["new-shape"].value="ring";el["new-role"].value="wall";el["add-object"].click();
 assert.equal(el["obj-type"].value,"wall","Role was incorrectly inferred from geometry");
 assert.equal(Number(el["obj-display-level"].value),1);
 assert.equal(el["obj-geometry"].value,"ring");
 const ringId=el["obj-id"].value;
 el["obj-parent"].value="town-area";el["obj-parent"].listeners.change();
 assert.equal(el["obj-parent"].value,"town-area");
 el["obj-display-level"].value="2";el["obj-display-level"].listeners.change();
 assert.equal(Number(el["obj-display-level"].value),2);
 const beforeCount=el.objects.children.length;
 el["clone-object"].click();
 assert.equal(el.objects.children.length,beforeCount+1);
 el["delete-object"].click();
 assert.equal(el.objects.children.length,beforeCount);
 el["obj-name"].value="戻した図形";el["obj-name"].listeners.change();
 el.download.click();assert.equal(downloads.length,1);
 assert(downloads[0].endsWith(".scene.json"));
 // Click workshop, enable drag and move its center 20 screen pixels.
 const editedWork=el.objects.children.find(item=>item.children[0].textContent==="編集済み作業棟");
 assert(editedWork,"Renamed workshop disappeared");
 editedWork.click();
 el["move-mode"].checked=true;el["move-mode"].listeners.change();
 const c=el["map-canvas"],start={pointerId:1,clientX:255,clientY:270};
 c.listeners.pointerdown(start);
 c.listeners.pointermove({pointerId:1,clientX:275,clientY:270});
 c.listeners.pointerup({pointerId:1,clientX:275,clientY:270});
 const movedX=Number(el["geometry-fields"].children[0].children[0].children[0].value);
 assert(movedX>130,"Selected building did not move: "+movedX);
 el.undo.click();
 const restoredX=Number(el["geometry-fields"].children[0].children[0].children[0].value);
 assert(Math.abs(restoredX-130)<.00001,"Drag undo failed "+restoredX);
 const all=JSON.parse(JSON.stringify(sample));
 all.name="JSONで編集した町";
 all.coordinateSystem.background="#222a33";
 all.layers.push({id:"new-layer",zIndex:70});
 el["scene-json-text"].value=JSON.stringify(all);
 el["apply-scene-json"].click();
 assert.equal(el["scene-name"].textContent,"JSONで編集した町");
 el.undo.click();
 assert.equal(el["scene-name"].textContent,"汎用サンプル：町");
 console.log("PASS generic editor: labels, walls, rename, undo/redo, arbitrary shapes/roles, export, drag, full-scene JSON + undo");
}
main().catch(error=>{console.error(error);process.exitCode=1});
