/* Regression: the documentation modal must render a fetched spec and switch files. */
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../..");
const specSource=fs.readFileSync(path.join(root,"rebuild/spec-viewer.js"),"utf8");
function el(tag="div"){
 return {tag,hidden:tag==="modal",textContent:"",value:"",children:[],listeners:{},attributes:{},classList:{add(){},remove(){}},
  append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},
  addEventListener(name,fn){this.listeners[name]=fn},setAttribute(k,v){this.attributes[k]=v},focus(){},
  removeAttribute(k){delete this.attributes[k]},getAttribute(k){return this.attributes[k]}};
}
const ids=["spec-modal","spec-content","spec-picker","spec-status","spec-close","open-specs","map-menu-popover","map-menu-button"];
const elements=Object.fromEntries(ids.map(id=>[id,el(id)]));
elements["spec-modal"].hidden=true;
const document={body:el("body"),activeElement:null,listeners:{},
 getElementById(id){return elements[id]||null},createElement:el,createTextNode(text){return {tag:"text",textContent:text}},
 createDocumentFragment(){return el("fragment")},addEventListener(name,fn){this.listeners[name]=fn}};
const fetch=async url=>{
 const filename=url.split("/").pop();
 const file=path.join(root,"docs/specs",filename);
 return {ok:fs.existsSync(file),status:fs.existsSync(file)?200:404,text:async()=>fs.readFileSync(file,"utf8")};
};
const context=vm.createContext({document,fetch,console});
vm.runInContext(specSource,context,{filename:"spec-viewer.js"});
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve()};
(async()=>{
 assert.equal(elements["spec-picker"].children.length,9);
 elements["open-specs"].listeners.click();
 await tick();
 assert.equal(elements["spec-modal"].hidden,false,"Modal must open");
 assert.equal(elements["spec-status"].textContent,"","Document fetch/render must not fail");
 assert(elements["spec-content"].children.length>0,"Initial README must render");
 assert.equal(elements["map-menu-popover"].hidden,true,"Map menu should close");
 elements["spec-picker"].value="08-placeable-objects.md";
 elements["spec-picker"].listeners.change();
 await tick();
 assert(elements["spec-content"].children.length>0,"Selected spec must render");
 assert.equal(elements["spec-status"].textContent,"");
 elements["spec-close"].listeners.click();
 assert.equal(elements["spec-modal"].hidden,true,"Modal must close");
 console.log("PASS spec modal: open, Markdown render, select, close");
})().catch(e=>{console.error(e);process.exitCode=1});
