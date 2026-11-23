/* Seven-level fantasy map scales. Standard canvas = 1000 x 1000 cells.
   One standard cell = 50 scene-coordinate units.
   Editing/snapping grid (settings.editorGrid) is independent of this distance scale. */
(function(global){
 "use strict";
 const tiers=[
  {id:"world",name:"世界地図",metersPerCell:40000},
  {id:"continent",name:"大陸地図",metersPerCell:5000},
  {id:"nation",name:"国家地図",metersPerCell:500},
  {id:"region",name:"地方地図",metersPerCell:100},
  {id:"town",name:"都市・町マップ",metersPerCell:50},
  {id:"district",name:"街区・敷地マップ",metersPerCell:10},
  {id:"interior",name:"建物内部マップ",metersPerCell:1}
 ];
 const standard=Object.freeze({
  id:"rasetsu-seven-level-v2",
  coordinateUnitsPerCell:50,
  referenceColumns:1000,
  referenceRows:1000,
  tiers:Object.freeze(tiers.map(x=>Object.freeze(x)))
 });
 global.AAMapScalePresets=standard;
})(window);
