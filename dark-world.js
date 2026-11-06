(function(){
"use strict";
const STORAGE_KEY="aa-dark-world-terrain-prototype-v1";
const clone=x=>JSON.parse(JSON.stringify(x));
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function create(options){
 const {canvas,ctx,getView,redraw,isDrawerOpen}=options;
 let base=null,model=null,selection=null,mode="inspect",selectedTerrain="plain",selectedOwner="vampire";
 const $=id=>document.getElementById(id);
 function validate(d){
  if(!d||d.schemaVersion!==1||d.kind!=="terrain-territory-map"||d.id!=="dark_world"||!d.grid||!Array.isArray(d.tiles)||!Array.isArray(d.terrains)||!Array.isArray(d.territories))throw Error("ダークワールドJSONが不正です");
  const {cols,rows}=d.grid;
  if(!Number.isInteger(cols)||!Number.isInteger(rows)||cols<1||rows<1||cols>100||rows>100||d.tiles.length!==cols*rows)throw Error("マス数が不正です");
  const terrains=new Set(d.terrains.map(t=>t.id)),owners=new Set(d.territories.map(t=>t.id));
  for(const tile of d.tiles)if(!tile||!terrains.has(tile.terrain)||!owners.has(tile.owner))throw Error("地形または領地のIDが不正です");
  return d;
 }
 function readLocal(){
  try{
   const raw=localStorage.getItem(STORAGE_KEY);
   if(!raw)return null;
   const saved=validate(JSON.parse(raw));
   if(saved.grid.cols!==base.grid.cols||saved.grid.rows!==base.grid.rows)return null;
   return saved;
  }catch(e){console.warn("ダークワールドの作業データを復元できません",e);return null}
 }
 function save(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(model));$("darkStatus").textContent="このブラウザに保存済み（Notion・GitHub未反映）";return true}
  catch(e){$("darkStatus").textContent="保存できません。JSONを書き出してください。";return false}
 }
 function load(data){
  base=clone(validate(data));
  model=readLocal()||clone(base);
  selection=null;
  renderPalette();
  $("darkStatus").textContent=model===base?"仮配置を読み込みました":"作業データをブラウザから復元しました";
  $("darkStatus").textContent=(localStorage.getItem(STORAGE_KEY)?"ブラウザの保存データを読み込みました":"GitHubの仮配置を読み込みました");
  updateToolButtons();updateSelected();redraw();
 }
 function colors(){
  const terrains=Object.fromEntries(model.terrains.map(x=>[x.id,x]));
  const owners=Object.fromEntries(model.territories.map(x=>[x.id,x]));
  return {terrains,owners};
 }
 function drawGrid(tileW,tileH){
  if(!options.gridVisible())return;
  ctx.save();
  ctx.strokeStyle=options.gridOnTop()?"rgba(236,248,255,.65)":"rgba(181,211,225,.35)";
  ctx.lineWidth=options.gridOnTop()?1.75:1;
  for(let c=0;c<=model.grid.cols;c++){
   const x=c*tileW;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,1600);ctx.stroke();
  }
  for(let r=0;r<=model.grid.rows;r++){
   const y=r*tileH;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1000,y);ctx.stroke();
  }
  ctx.restore();
 }
 function draw(){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,1000,1600);
  ctx.fillStyle="#0a1119";ctx.fillRect(0,0,1000,1600);
  if(!model)return;
  const v=getView(),w=1000/model.grid.cols,h=1600/model.grid.rows;
  const {terrains,owners}=colors();
  ctx.save();
  ctx.translate(500+v.offsetX,800+v.offsetY);ctx.scale(v.zoom,v.zoom);ctx.translate(-500,-800);
  for(let r=0;r<model.grid.rows;r++)for(let c=0;c<model.grid.cols;c++){
   const tile=model.tiles[r*model.grid.cols+c];
   const terrain=terrains[tile.terrain],owner=owners[tile.owner],x=c*w,y=r*h;
   ctx.fillStyle=terrain?.color||"#172734";ctx.fillRect(x,y,w+0.6,h+0.6);
   ctx.save();ctx.globalAlpha=.17;ctx.fillStyle=owner?.color||"#76898a";ctx.fillRect(x,y,w,h);ctx.restore();
   ctx.fillStyle=owner?.color||"#617078";ctx.fillRect(x+2,y+2,11,11);
   if(terrain?.symbol){ctx.fillStyle="rgba(245,241,218,.50)";ctx.font="bold 20px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(terrain.symbol,x+w/2,y+h/2);}
   const right=model.tiles[r*model.grid.cols+c+1];
   const down=model.tiles[(r+1)*model.grid.cols+c];
   ctx.strokeStyle=owner?.color||"#617078";ctx.lineWidth=3;
   if(c===model.grid.cols-1||right?.owner!==tile.owner){ctx.beginPath();ctx.moveTo(x+w,y);ctx.lineTo(x+w,y+h);ctx.stroke()}
   if(r===model.grid.rows-1||down?.owner!==tile.owner){ctx.beginPath();ctx.moveTo(x,y+h);ctx.lineTo(x+w,y+h);ctx.stroke()}
  }
  if(!options.gridOnTop())drawGrid(w,h);
  const group={};
  model.tiles.forEach((t,i)=>{
   if(t.owner==="unclaimed"||t.owner==="intermediate")return;
   const c=i%model.grid.cols,r=Math.floor(i/model.grid.cols);
   const g=group[t.owner]||(group[t.owner]={x:0,y:0,n:0});
   g.x+=c+.5;g.y+=r+.5;g.n++;
  });
  for(const [id,g] of Object.entries(group)){
   const owner=owners[id];if(!owner)continue;
   const x=g.x/g.n*w,y=g.y/g.n*h;
   ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="bold 22px system-ui";
   ctx.strokeStyle="#071018";ctx.lineWidth=5;ctx.strokeText(owner.name,x,y,190);
   ctx.fillStyle="#ffffff";ctx.fillText(owner.name,x,y,190);
  }
  if(selection!==null){
   const c=selection%model.grid.cols,r=Math.floor(selection/model.grid.cols);
   ctx.strokeStyle="#ffed9e";ctx.lineWidth=5;ctx.strokeRect(c*w+2,r*h+2,w-4,h-4);
  }
  if(options.gridOnTop())drawGrid(w,h);
  ctx.restore();
  ctx.save();ctx.fillStyle="#e8eff6";ctx.strokeStyle="#111b26";ctx.lineWidth=4;
  ctx.font="bold 20px system-ui";ctx.textAlign="center";
  ctx.strokeText("領地・地形の仮配置／距離・方位は未設定",500,30);
  ctx.fillText("領地・地形の仮配置／距離・方位は未設定",500,30);
  ctx.restore();
 }
 function updateToolButtons(){
  document.querySelectorAll("[data-dark-mode]").forEach(b=>{
   const on=b.dataset.darkMode===mode;b.classList.toggle("on",on);b.setAttribute("aria-pressed",String(on));
  });
  document.querySelectorAll("[data-dark-terrain]").forEach(b=>b.classList.toggle("on",b.dataset.darkTerrain===selectedTerrain));
  document.querySelectorAll("[data-dark-owner]").forEach(b=>b.classList.toggle("on",b.dataset.darkOwner===selectedOwner));
 }
 function renderPalette(){
  if(!model)return;
  $("darkTerrainPalette").innerHTML=model.terrains.map(t=>'<button type="button" class="darkSwatch" data-dark-terrain="'+esc(t.id)+'"><span class="darkColor" style="background:'+esc(t.color)+'"></span>'+esc(t.name)+'</button>').join("");
  $("darkOwnerPalette").innerHTML=model.territories.map(t=>'<button type="button" class="darkSwatch" data-dark-owner="'+esc(t.id)+'"><span class="darkColor" style="background:'+esc(t.color)+'"></span>'+esc(t.name)+'</button>').join("");
  updateToolButtons();
 }
 function tileInfoHtml(i){
  const c=i%model.grid.cols,r=Math.floor(i/model.grid.cols),tile=model.tiles[i];
  const t=model.terrains.find(x=>x.id===tile.terrain),owner=model.territories.find(x=>x.id===tile.owner);
  return '<strong>マス ('+(c+1)+','+(r+1)+')</strong><div class="meta"><span class="pill">領地：'+esc(owner?.name||tile.owner)+'</span><span class="pill">地形：'+esc(t?.name||tile.terrain)+'</span></div><p>作業用の仮マスです。地理・距離・移動コストは未確定。</p>';
 }
 function updateSelected(){
  $("darkTileInfo").innerHTML=selection===null?'<span class="muted">地図上のマスを選んでください。</span>':tileInfoHtml(selection);
 }
 function selectAt(x,y){
  if(!model||x<0||x>=1000||y<0||y>=1600)return false;
  const c=Math.floor(x/(1000/model.grid.cols)),r=Math.floor(y/(1600/model.grid.rows));
  selection=r*model.grid.cols+c;
  const tile=model.tiles[selection];
  if(mode==="terrain"&&tile.terrain!==selectedTerrain){tile.terrain=selectedTerrain;save()}
  if(mode==="territory"&&tile.owner!==selectedOwner){tile.owner=selectedOwner;save()}
  updateSelected();redraw();
  if(mode==="inspect"&&!isDrawerOpen()){
   $("info").innerHTML=tileInfoHtml(selection);
   const mask=$("popupMask");mask.classList.add("show");mask.setAttribute("aria-hidden","false");
  }
  return true;
 }
 function reset(){
  if(!model||!confirm("ダークワールドのこのブラウザの編集を破棄し、GitHubの仮配置へ戻しますか？"))return;
  model=clone(base);selection=null;
  try{localStorage.removeItem(STORAGE_KEY)}catch(e){console.warn(e)}
  $("darkStatus").textContent="GitHubの仮配置へ戻しました";
  renderPalette();updateSelected();redraw();
 }
 function exportJSON(){
  if(!model)return;
  const output=clone(model);output.metadata={...(output.metadata||{}),editedAs:"browser-prototype"};
  const blob=new Blob([JSON.stringify(output,null,2)+"\n"],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="dark-world-draft.json";document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  $("darkStatus").textContent="JSONを書き出しました。GitHubやNotionには未反映です。";
 }
 function initEvents(){
  document.querySelectorAll("[data-dark-mode]").forEach(b=>b.addEventListener("click",()=>{mode=b.dataset.darkMode;updateToolButtons()}));
  $("darkTerrainPalette").addEventListener("click",e=>{
   const b=e.target.closest("[data-dark-terrain]");if(!b)return;
   selectedTerrain=b.dataset.darkTerrain;mode="terrain";updateToolButtons();
  });
  $("darkOwnerPalette").addEventListener("click",e=>{
   const b=e.target.closest("[data-dark-owner]");if(!b)return;
   selectedOwner=b.dataset.darkOwner;mode="territory";updateToolButtons();
  });
  $("darkReset").addEventListener("click",reset);
  $("darkExport").addEventListener("click",exportJSON);
 }
 initEvents();
 return {load,draw,selectAt,reset,exportJSON,get model(){return model},get selection(){return selection}};
}
window.DarkWorldMap={create};
})();
