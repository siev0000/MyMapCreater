/* Read-only staged map navigation. Map links come from map-tree.json and scene object metadata.
   This module never changes map geometry, scale or auto-switches on zoom. */
(function(global){
 "use strict";
 function lineage(nodes,id){
  const trail=[],seen=new Set();let n=nodes.get(id);
  while(n&&!seen.has(n.id)){
   seen.add(n.id);trail.unshift(n);n=n.parentId?nodes.get(n.parentId):null;
  }
  return trail;
 }
 function directChildren(nodes,id){
  return [...nodes.values()].filter(n=>n.parentId===id&&
   n.temporary!==true&&n.scope!=="grid-performance-test");
 }
 function isDescendant(nodes,ancestorId,id){
  const path=lineage(nodes,id);return path.length>1&&
   path.some((node,i)=>i<path.length-1&&node.id===ancestorId);
 }
 function linkedTarget(nodes,currentMapId,item){
  if(!item||!currentMapId)return null;
  const metadata=item.metadata||{};
  const candidates=[metadata.detailMapId,metadata.cityMapId,
   ...(Array.isArray(metadata.linkedMapIds)?metadata.linkedMapIds:[])];
  return candidates.find(id=>typeof id==="string"&&nodes.has(id)&&
   isDescendant(nodes,currentMapId,id))||null;
 }
 function makeButton(label,handler,className){
  const b=document.createElement("button");b.type="button";b.textContent=label;
  if(className)b.className=className;b.addEventListener("click",handler);return b;
 }
 function create({bar,breadcrumb,back,childSelect,enter,status,detailEnter,getNodes,getSelected,selectMap}){
  if(!bar||!breadcrumb||!back||!childSelect||!enter||!status||!detailEnter)throw Error("Stage navigation controls are missing");
  let selectedItem=null,currentMap=null;
  const visibleLabel=n=>n.shortName||n.name||n.id;
  function render(){
   const nodes=getNodes(),selected=getSelected(),path=lineage(nodes,selected);
   if(!path.length){bar.hidden=true;detailEnter.hidden=true;return}
   bar.hidden=false;
   breadcrumb.replaceChildren();
   path.forEach((node,i)=>{
    if(i)breadcrumb.append(document.createTextNode(" › "));
    const b=makeButton(visibleLabel(node),()=>selectMap(node.id),i===path.length-1?"stage-current":"");
    b.title=node.name;b.setAttribute("aria-current",i===path.length-1?"page":"false");
    if(i===path.length-1)b.disabled=true;
    breadcrumb.append(b);
   });
   const parent=path[path.length-2];back.hidden=!parent;
   back.disabled=!parent;back.title=parent?"一つ上へ："+parent.name:"最上位マップ";
   const children=directChildren(nodes,selected);
   childSelect.replaceChildren();
   for(const n of children){
    const option=document.createElement("option");option.value=n.id;option.textContent=visibleLabel(n);
    childSelect.append(option);
   }
   childSelect.hidden=!children.length;
   enter.hidden=!children.length;enter.disabled=!children.length;
   status.hidden=children.length>0;
   status.textContent=children.length?"":"下位マップなし";
   if(children.length===1)enter.textContent="中へ進む ›";
   else enter.textContent="選択先へ ›";
   currentMap=selected;
   refreshDetailLink();
  }
  function refreshDetailLink(){
   const nodes=getNodes(),selected=getSelected();
   const id=linkedTarget(nodes,selected,selectedItem);
   const target=id?nodes.get(id):null;
   detailEnter.hidden=!target;
   detailEnter.disabled=!target;
   detailEnter.dataset.targetMap=id||"";
   if(target){
    detailEnter.textContent="詳細マップへ ›";
    detailEnter.title=(selectedItem?.name||"選択地点")+" → "+target.name;
    detailEnter.setAttribute("aria-label",detailEnter.title);
   }else{
    detailEnter.removeAttribute("title");detailEnter.removeAttribute("aria-label");
   }
  }
  back.addEventListener("click",()=>{
   const path=lineage(getNodes(),getSelected()),parent=path[path.length-2];
   if(parent)selectMap(parent.id);
  });
  enter.addEventListener("click",()=>{
   const target=childSelect.value;
   if(directChildren(getNodes(),getSelected()).some(n=>n.id===target))selectMap(target);
  });
  detailEnter.addEventListener("click",()=>{
   const id=linkedTarget(getNodes(),getSelected(),selectedItem);
   if(id)selectMap(id);
  });
  return{
   render,
   updateSelection(item,mapId){
    if(mapId!==getSelected())return;
    selectedItem=item||null;
    refreshDetailLink();
   },
   clearSelection(){selectedItem=null;refreshDetailLink();}
  };
 }
 global.AAMapStageNavigation=Object.freeze({create,lineage,directChildren,isDescendant,linkedTarget});
})(window);
