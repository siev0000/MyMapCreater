/* Seven-level fantasy map scales. One standard cell = 50 scene-coordinate units.
   Editing/snapping grid (settings.editorGrid) is independent of this distance scale. */
(function(global){
 "use strict";
 const tiers=[
  {id:"world",name:"世界地図",metersPerCell:1000000},
  {id:"continent",name:"大陸地図",metersPerCell:100000},
  {id:"nation",name:"国家地図",metersPerCell:20000},
  {id:"region",name:"地方地図",metersPerCell:2000},
  {id:"town",name:"都市・町マップ",metersPerCell:50},
  {id:"district",name:"街区・敷地マップ",metersPerCell:10},
  {id:"interior",name:"建物内部マップ",metersPerCell:1}
 ];
 const standard=Object.freeze({
  id:"rasetsu-seven-level-v1",
  coordinateUnitsPerCell:50,
  referenceColumns:32,
  referenceRows:20,
  tiers:Object.freeze(tiers.map(x=>Object.freeze(x)))
 });
 global.AAMapScalePresets=standard;
})(window);
