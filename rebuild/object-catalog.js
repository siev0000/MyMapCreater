/* Generic, user-editable placement icons. Entries are provisional examples, not lore. */
(function(global){"use strict";
 const defaults=[
  {id:"storage",name:"物置",icon:"📦",kind:"container",width:12,height:12},
  {id:"shelf",name:"収納棚",icon:"🗄️",kind:"container",width:8,height:12},
  {id:"cabinet",name:"収納庫",icon:"🗄️",kind:"container",width:10,height:10},
  {id:"chest",name:"収納箱",icon:"📦",kind:"container",width:7,height:7},
  {id:"desk",name:"作業机",icon:"🪑",kind:"object",width:10,height:6},
  {id:"bed",name:"寝具",icon:"🛏️",kind:"object",width:9,height:14},
  {id:"battery",name:"バッテリー",icon:"🔋",kind:"object",width:6,height:8},
  {id:"supplies",name:"物資",icon:"📦",kind:"object",width:8,height:8},
  {id:"machine",name:"機械設備",icon:"⚙️",kind:"object",width:12,height:10},
  {id:"terminal",name:"端末",icon:"🖥️",kind:"object",width:8,height:6}
 ];
 function entries(scene){return Array.isArray(scene?.settings?.objectCatalog)?scene.settings.objectCatalog:defaults}
 function get(scene,id){return entries(scene).find(x=>x.id===id)||null}
 global.AAMapObjectCatalog={defaults,entries,get};
})(window);
