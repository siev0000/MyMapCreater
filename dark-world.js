(function(){
"use strict";
const STORAGE_KEY="aa-dark-world-terrain-prototype-v1";
const DISPLAY_KEY="aa-dark-world-overlay-display-v1";
const clone=x=>JSON.parse(JSON.stringify(x));
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function create(options){
 const {canvas,ctx,getView,redraw,isDrawerOpen}=options;
 let base=null,model=null,selection=null,mode="inspect",selectedTerrain="plain",selectedOwner="vampire",routeStart=null;
 const display={borders:true,routes:true,sites:true};
 function saveDisplay(){
  try{localStorage.setItem(DISPLAY_KEY,JSON.stringify(display))}
  catch(err){console.warn("表示設定を保存できませんでした",err)}
 }
 function restoreDisplay(){
  try{
   const raw=localStorage.getItem(DISPLAY_KEY);
   if(raw){
    const stored=JSON.parse(raw);
    for(const key of ["borders","routes","sites"])if(typeof stored?.[key]==="boolean")display[key]=stored[key];
   }
  }catch(err){console.warn("表示設定を復元できませんでした",err)}
  updateDisplayButtons();
 }
 function updateDisplayButtons(){
  for(const [id,key,label] of [["darkBorders","borders","境界"],["darkRoutes","routes","経路"],["darkSites","sites","拠点"]]){
   const el=$(id);if(!el)continue;
   el.textContent=label+"："+(display[key]?"ON":"OFF");
   el.classList.toggle("on",display[key]);el.setAttribute("aria-pressed",String(display[key]));
  }
 }
 const $=id=>document.getElementById(id);
 function validate(d){
  if(!d||d.schemaVersion!==1||d.kind!=="terrain-territory-map"||d.id!=="dark_world"||!d.grid||!Array.isArray(d.tiles)||!Array.isArray(d.terrains)||!Array.isArray(d.territories))throw Error("ダークワールドJSONが不正です");
  const {cols,rows}=d.grid;
  if(!Number.isInteger(cols)||!Number.isInteger(rows)||cols<1||rows<1||cols>100||rows>100||d.tiles.length!==cols*rows)throw Error("マス数が不正です");
  const terrains=new Set(d.terrains.map(t=>t.id)),owners=new Set(d.territories.map(t=>t.id));
  for(const tile of d.tiles)if(!tile||!terrains.has(tile.terrain)||!owners.has(tile.owner))throw Error("地形または領地のIDが不正です");
  if(d.settlements!==undefined&&!Array.isArray(d.settlements))throw Error("拠点データが不正です");
  if(d.routes!==undefined&&!Array.isArray(d.routes))throw Error("経路データが不正です");
  for(const place of d.settlements||[])if(!place||typeof place.id!=="string"||typeof place.name!=="string"||!Number.isInteger(place.col)||!Number.isInteger(place.row)||place.col<0||place.row<0||place.col>=cols||place.row>=rows)throw Error("拠点の座標が不正です");
  for(const route of d.routes||[]){
   if(!route||typeof route.id!=="string"||typeof route.name!=="string"||!Array.isArray(route.points)||route.points.length<2||route.points.some(pt=>!Array.isArray(pt)||pt.length!==2||!pt.every(Number.isInteger)||pt[0]<0||pt[1]<0||pt[0]>=cols||pt[1]>=rows))throw Error("経路の座標が不正です");
  }
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
  const stored=readLocal();
  model=stored||clone(base);
  // Preserve previously edited terrain tiles while adding new demo overlays.
  if(!Array.isArray(model.routes))model.routes=clone(base.routes||[]);
  if(!Array.isArray(model.settlements))model.settlements=clone(base.settlements||[]);
  routeStart=null;selection=null;
  restoreDisplay();
  renderPalette();renderLists();
  $("darkStatus").textContent=stored?"ブラウザの保存データを読み込みました":"GitHubの仮配置を読み込みました";
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
   if(display.borders){
    if(c===model.grid.cols-1||right?.owner!==tile.owner){ctx.beginPath();ctx.moveTo(x+w,y);ctx.lineTo(x+w,y+h);ctx.stroke()}
    if(r===model.grid.rows-1||down?.owner!==tile.owner){ctx.beginPath();ctx.moveTo(x,y+h);ctx.lineTo(x+w,y+h);ctx.stroke()}
   }
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
  drawRoutesAndSites(w,h);
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
 function drawRoutesAndSites(w,h){
  const toXY=point=>[(point[0]+.5)*w,(point[1]+.5)*h];
  if(display.routes){
   ctx.save();
   for(const route of model.routes||[]){
    if(!Array.isArray(route.points)||route.points.length<2)continue;
    ctx.beginPath();
    route.points.forEach((pt,i)=>{const [x,y]=toXY(pt);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});
    ctx.strokeStyle="#0a1923";ctx.lineWidth=12;ctx.setLineDash([]);ctx.stroke();
    ctx.strokeStyle="#f2ce7b";ctx.lineWidth=6;ctx.setLineDash([12,9]);ctx.stroke();
   }
   if(routeStart!==null){
    const [x,y]=toXY([routeStart%model.grid.cols,Math.floor(routeStart/model.grid.cols)]);
    ctx.setLineDash([]);ctx.strokeStyle="#fff1a2";ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,19,0,Math.PI*2);ctx.stroke();
   }
   ctx.restore();
  }
  if(display.sites){
   ctx.save();
   for(const site of model.settlements||[]){
    const [x,y]=toXY([site.col,site.row]);
    ctx.fillStyle=site.kind==="city"?"#f4e4b7":"#e2f2fc";
    ctx.strokeStyle="#091520";ctx.lineWidth=3.5;
    ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle="#101923";ctx.font="bold 13px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(site.kind==="city"?"◆":"●",x,y);
    ctx.font="bold 13px system-ui";ctx.lineWidth=4;ctx.strokeStyle="#0a1520";ctx.strokeText(site.name,x,y-22,125);
    ctx.fillStyle="#fff8e8";ctx.fillText(site.name,x,y-22,125);
   }
   ctx.restore();
  }
 }
 function renderLists(){
  if(!model)return;
  const sites=$("darkSiteList"),routes=$("darkRouteList");
  sites.innerHTML=(model.settlements||[]).map(site=>'<div class="darkListItem"><input aria-label="拠点の名前" data-site-name="'+esc(site.id)+'" maxlength="90" value="'+esc(site.name)+'"><button type="button" data-delete-site="'+esc(site.id)+'">削除</button></div>').join("")||'<p class="darkTiny">拠点がありません</p>';
  routes.innerHTML=(model.routes||[]).map(route=>'<div class="darkListItem"><input aria-label="経路の名前" data-route-name="'+esc(route.id)+'" maxlength="90" value="'+esc(route.name)+'"><button type="button" data-delete-route="'+esc(route.id)+'">削除</button></div>').join("")||'<p class="darkTiny">経路がありません</p>';
  $("darkRouteHint").textContent=routeStart===null?"経路追加では始点と終点の2マスを順にタップしてください。":"始点を選択しました。次に終点をタップしてください。";
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
  const places=(model.settlements||[]).filter(s=>s.col===c&&s.row===r);
  const placeText=places.length?'<p>仮拠点：'+places.map(s=>esc(s.name)).join("、")+'</p>':"";
  return '<strong>マス ('+(c+1)+','+(r+1)+')</strong><div class="meta"><span class="pill">領地：'+esc(owner?.name||tile.owner)+'</span><span class="pill">地形：'+esc(t?.name||tile.terrain)+'</span></div>'+placeText+'<p>作業用の仮マスです。地理・距離・移動コストは未確定。</p>';
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
  if(mode==="route"){
   if(routeStart===null)routeStart=selection;
   else if(routeStart!==selection){
    const start=[routeStart%model.grid.cols,Math.floor(routeStart/model.grid.cols)];
    model.routes.push({id:"user-route-"+Date.now()+"-"+model.routes.length,name:"追加した仮経路 "+(model.routes.length+1),kind:"draft_route",status:"prototype",points:[start,[c,r]],note:"接続・通行可否・距離は未確定"});
    routeStart=null;save();
   }
  }
  if(mode==="site"){
   const existing=model.settlements.some(s=>s.col===c&&s.row===r);
   if(!existing){
    const name=$("darkSiteName").value.trim().slice(0,90)||"新しい拠点（仮）";
    model.settlements.push({id:"user-site-"+Date.now()+"-"+model.settlements.length,name,kind:name.includes("都市")?"city":"outpost",owner:tile.owner,col:c,row:r,status:"prototype",note:"ユーザーによる仮配置。Notion未反映"});
    save();
   }else{$("darkStatus").textContent="そのマスには既に拠点があります。必要なら一覧で名前を変更してください。";}
  }
  renderLists();updateSelected();redraw();
  if(mode==="inspect"&&!isDrawerOpen()){
   $("info").innerHTML=tileInfoHtml(selection);
   const mask=$("popupMask");mask.classList.add("show");mask.setAttribute("aria-hidden","false");
  }
  return true;
 }
 function reset(){
  if(!model||!confirm("ダークワールドのこのブラウザの編集を破棄し、GitHubの仮配置へ戻しますか？"))return;
  model=clone(base);selection=null;routeStart=null;
  try{localStorage.removeItem(STORAGE_KEY)}catch(e){console.warn(e)}
  $("darkStatus").textContent="GitHubの仮配置へ戻しました";
  renderPalette();renderLists();updateSelected();redraw();
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
  document.querySelectorAll("[data-dark-mode]").forEach(b=>b.addEventListener("click",()=>{
   mode=b.dataset.darkMode;routeStart=null;renderLists();updateToolButtons();redraw();
  }));
  for(const [id,key] of [["darkBorders","borders"],["darkRoutes","routes"],["darkSites","sites"]]){
   $(id).addEventListener("click",()=>{display[key]=!display[key];updateDisplayButtons();saveDisplay();redraw()});
  }
  $("darkSiteList").addEventListener("change",e=>{
   const id=e.target.dataset.siteName;
   if(!id)return;
   const site=model?.settlements.find(s=>s.id===id);if(!site)return;
   site.name=(e.target.value.trim()||site.name).slice(0,90);
   save();renderLists();updateSelected();redraw();
  });
  $("darkRouteList").addEventListener("change",e=>{
   const id=e.target.dataset.routeName;
   if(!id)return;
   const route=model?.routes.find(r=>r.id===id);if(!route)return;
   route.name=(e.target.value.trim()||route.name).slice(0,90);
   save();renderLists();redraw();
  });
  $("darkSiteList").addEventListener("click",e=>{
   const b=e.target.closest("[data-delete-site]");if(!b||!model)return;
   model.settlements=model.settlements.filter(s=>s.id!==b.dataset.deleteSite);
   save();renderLists();updateSelected();redraw();
  });
  $("darkRouteList").addEventListener("click",e=>{
   const b=e.target.closest("[data-delete-route]");if(!b||!model)return;
   model.routes=model.routes.filter(r=>r.id!==b.dataset.deleteRoute);
   save();renderLists();redraw();
  });
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
