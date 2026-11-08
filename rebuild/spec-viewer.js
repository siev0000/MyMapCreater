/* Standalone, dependency-free Markdown spec reader for local docs/specs files.
   Markdown is rendered using text nodes (never untrusted innerHTML). */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const specs=[
 ["README.md","仕様書の目次"],
 ["01-architecture.md","01 基本設計"],
 ["02-hierarchy-and-visibility.md","02 階層・表示Lv"],
 ["03-geometry-and-editing.md","03 図形と編集"],
 ["04-walls-doors-and-connections.md","04 壁・扉・接続"],
 ["05-data-and-validation.md","05 JSON・保存"],
 ["06-roadmap-and-acceptance.md","06 開発タスク"],
 ["07-floors-and-interiors.md","07 フロア・内部"],
 ["08-placeable-objects.md","08 家具・設備"],
 ["09-indoor-supply-icon-catalog.md","09 物資アイコン一覧"],
 ["__shape_gallery__","10 図形プレビュー"]
];
const names=new Map(specs),cache=new Map();
let current="README.md",priorFocus=null,request=0;
const modal=$("spec-modal"),content=$("spec-content"),picker=$("spec-picker"),status=$("spec-status");
if(!modal||!content||!picker)return;
for(const [file,label] of specs){const o=document.createElement("option");o.value=file;o.textContent=label;picker.append(o)}
function elt(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e}
function inline(target,str){
 // Limited inline markdown: plain text, code, emphasis, and links.
 const regex=/\[([^\]]+)\]\(([^)]+)\)|\`([^\`]+)\`|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
 let last=0,m;
 while((m=regex.exec(str))){
  if(m.index>last)target.append(document.createTextNode(str.slice(last,m.index)));
  if(m[1]!==undefined){
   const a=elt("a",m[1]),url=m[2].trim();
   if(/^(?:https?:\/\/|\.\.?\/|[a-z0-9_.-]+\.md(?:#[a-z0-9_-]+)?)$/i.test(url)){
    const file=url.split("#")[0].split("/").pop();
    if(names.has(file)){a.href="#";a.addEventListener("click",e=>{e.preventDefault();open(file)})}
    else if(url.startsWith("http")){a.href=url;a.target="_blank";a.rel="noopener noreferrer"}
    else{a.href="../docs/specs/"+url;a.target="_blank";a.rel="noopener noreferrer"}
   }else{a.removeAttribute("href")}
   target.append(a);
  }else if(m[3]!==undefined)target.append(elt("code",m[3]));
  else if(m[4]!==undefined)target.append(elt("strong",m[4]));
  else target.append(elt("em",m[5]));
  last=regex.lastIndex;
 }
 if(last<str.length)target.append(document.createTextNode(str.slice(last)));
}
function render(md){
 const frag=document.createDocumentFragment(),lines=md.replace(/\r\n?/g,"\n").split("\n");
 let i=0;
 while(i<lines.length){
  const line=lines[i];if(!line.trim()){i++;continue}
  if(/^\`\`\`/.test(line)){
   const lang=line.replace(/^\`\`\`/,"").trim();i++;const code=[];
   while(i<lines.length&&!/^\`\`\`/.test(lines[i]))code.push(lines[i++]);
   i++;const pre=elt("pre");const c=elt("code",code.join("\n"));if(lang)c.className="language-"+lang;pre.append(c);frag.append(pre);continue;
  }
  if(/^\s*\|/.test(line)&&i+1<lines.length&&/^\s*\|[\s:|-]+\|?\s*$/.test(lines[i+1])){
   const tbl=elt("table");
   const cells=s=>s.trim().replace(/^\||\|$/g,"").split("|").map(x=>x.trim());
   const headings=cells(line),thead=elt("thead"),tr=elt("tr");headings.forEach(t=>{const th=elt("th");inline(th,t);tr.append(th)});thead.append(tr);tbl.append(thead);i+=2;
   const tbody=elt("tbody");
   while(i<lines.length&&/^\s*\|/.test(lines[i])){const row=elt("tr");cells(lines[i++]).forEach(t=>{const td=elt("td");inline(td,t);row.append(td)});tbody.append(row)}
   tbl.append(tbody);frag.append(tbl);continue;
  }
  const heading=/^(#{1,6})\s+(.+)$/.exec(line);
  if(heading){const h=elt("h"+heading[1].length);inline(h,heading[2]);frag.append(h);i++;continue}
  if(/^\s*---+\s*$/.test(line)){frag.append(elt("hr"));i++;continue}
  const list=/^\s*(?:[-*+]\s+|\d+\.\s+)/.exec(line);
  if(list){const ordered=/\d+\./.test(list[0]),ul=elt(ordered?"ol":"ul");
   while(i<lines.length&&/^\s*(?:[-*+]\s+|\d+\.\s+)/.test(lines[i])){
    const raw=lines[i++].replace(/^\s*(?:[-*+]\s+|\d+\.\s+)/,"");
    const li=elt("li");const checkbox=/^\[([ xX])\]\s+/.exec(raw);
    if(checkbox){const mark=elt("span",checkbox[1].toLowerCase()==="x"?"☑ ":"☐ ");li.append(mark);inline(li,raw.slice(checkbox[0].length))}
    else inline(li,raw);
    ul.append(li);
   }frag.append(ul);continue;
  }
  if(/^>\s?/.test(line)){const q=[];while(i<lines.length&&/^>\s?/.test(lines[i]))q.push(lines[i++].replace(/^>\s?/,""));const b=elt("blockquote");inline(b,q.join(" "));frag.append(b);continue}
  const paragraph=[line];i++;
  while(i<lines.length&&lines[i].trim()&&!/^(#{1,6}\s|\`\`\`|\s*\||\s*[-*+]\s|\s*\d+\.\s|>\s?)/.test(lines[i]))paragraph.push(lines[i++]);
  const p=elt("p");inline(p,paragraph.join(" "));frag.append(p);
 }
 content.replaceChildren(frag);
}
async function open(file="README.md"){
 if(!names.has(file))file="README.md";
 if(modal.hidden){priorFocus=document.activeElement;modal.hidden=false;document.body.classList.add("spec-open")}
 current=file;picker.value=file;content.replaceChildren();status.textContent="読み込み中…";
 const id=++request;
 try{
  if(file==="__shape_gallery__"){
   const frame=document.createElement("iframe");
   frame.src="./shape-catalog.html";
   frame.title="家具・設備の図形プレビュー一覧";
   frame.className="spec-gallery-frame";
   frame.setAttribute("loading","eager");
   frame.addEventListener("load",()=>{if(id===request)status.textContent="家具・設備13種類の図形プレビュー"});
   content.replaceChildren(frame);
   status.textContent="図形一覧を表示しています…";
   return;
  }
  let markdown=cache.get(file);
  if(markdown===undefined){
   const res=await fetch("../docs/specs/"+file,{cache:"no-store"});
   if(!res.ok)throw Error("HTTP "+res.status);
   markdown=await res.text();cache.set(file,markdown);
  }
  if(id!==request)return;
  if(!markdown.trim())throw Error("仕様書ファイルが空です");
  // Always make readable source content available first. An unexpected parser
  // failure must never leave the modal completely blank.
  const raw=document.createElement("pre");
  raw.className="spec-raw";
  raw.textContent=markdown;
  content.replaceChildren(raw);
  status.textContent="読み込み済み："+markdown.length+"文字";
  try{
   render(markdown);
   // Verify the browser DOM really contains readable text, not just nodes.
   if(!content.textContent.trim())throw Error("変換結果が空です");
  }catch(parseError){
   content.replaceChildren(raw);
   status.textContent="原文表示（整形エラー）："+parseError.message;
  }
  content.scrollTop=0;
 }catch(error){
  if(id!==request)return;
  content.replaceChildren();
  const msg=document.createElement("p");
  msg.textContent="仕様書の読み込みに失敗しました。"+error.message;
  content.append(msg);
  status.textContent="読み込みエラー";
 }
 $("spec-close").focus();
}
function close(){
 if(modal.hidden)return;
 request++;modal.hidden=true;document.body.classList.remove("spec-open");
 if(priorFocus?.focus)priorFocus.focus();
}
$("open-specs").addEventListener("click",()=>{
 const menu=$("map-menu-popover"),button=$("map-menu-button");
 if(menu)menu.hidden=true;
 if(button)button.setAttribute("aria-expanded","false");
 open(current);
});
$("spec-close").addEventListener("click",close);
picker.addEventListener("change",()=>open(picker.value));
modal.addEventListener("pointerdown",e=>{if(e.target===modal)close()});
document.addEventListener("keydown",e=>{
 if(modal.hidden)return;
 if(e.key==="Escape"){e.preventDefault();close()}
 if(e.key==="Tab"){
  const controls=[picker,$("spec-close")],index=controls.indexOf(document.activeElement);
  if(index>=0){e.preventDefault();controls[(index+(e.shiftKey?1:-1)+controls.length)%controls.length].focus()}
 }
});
})();