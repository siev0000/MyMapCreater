/* Shared navigation: add data-tool-home to a tool header. */
(function(){
"use strict";
function requestHome(confirmFn,navigate,href){if(!confirmFn("ツール選択画面に戻りますか？\n保存していない編集内容や生成結果は失われる可能性があります。"))return false;navigate(href);return true}
if(typeof module!=="undefined" && module.exports){module.exports={requestHome};return;}
const script=document.currentScript;
const href=new URL("../index.html",script.src).href;
const label="ツール選択画面に戻る";
const ns="http://www.w3.org/2000/svg";
for(const host of document.querySelectorAll("[data-tool-home]")){
  if(host.querySelector(".tool-home-button"))continue;
  const button=document.createElement("button");
  button.type="button";button.className="tool-home-button";button.title=label;button.setAttribute("aria-label",label);
  const svg=document.createElementNS(ns,"svg");
  for(const [k,v] of Object.entries({viewBox:"0 0 24 24",width:"20",height:"20",fill:"none",stroke:"currentColor","stroke-width":"1.8","stroke-linecap":"round","stroke-linejoin":"round","aria-hidden":"true",focusable:"false"}))svg.setAttribute(k,v);
  const roof=document.createElementNS(ns,"path");roof.setAttribute("d","M3 10.5 12 3l9 7.5 M5.5 9v11h13V9 M9.5 20v-6h5v6");svg.append(roof);button.append(svg);
  button.addEventListener("click",()=>requestHome(window.confirm.bind(window),url=>window.location.assign(url),href));
  host.prepend(button);
}
})();
