/* Generic, reusable building format library. Dimensions are grid cells, not existing map coordinates.
   Every object generated is JSON Scene v2 data, not a world-setting assertion. */
(function(global){"use strict";
const presets=[
  {
    "id": "small_house",
    "name": "小型住宅",
    "cells": [
      14,
      12
    ],
    "floors": 1,
    "layout": "split",
    "description": "居室と玄関を持つ小型住宅"
  },
  {
    "id": "row_house",
    "name": "連棟住宅",
    "cells": [
      16,
      12
    ],
    "floors": 2,
    "layout": "split",
    "description": "2階建ての小型住宅"
  },
  {
    "id": "shop",
    "name": "小型店舗",
    "cells": [
      18,
      14
    ],
    "floors": 1,
    "layout": "front",
    "description": "売場とバックヤード"
  },
  {
    "id": "office",
    "name": "事務所",
    "cells": [
      22,
      16
    ],
    "floors": 2,
    "layout": "split",
    "description": "事務室・通路・2階"
  },
  {
    "id": "warehouse",
    "name": "倉庫",
    "cells": [
      30,
      22
    ],
    "floors": 1,
    "layout": "open",
    "description": "搬入口と広い保管区画"
  },
  {
    "id": "workshop",
    "name": "工房",
    "cells": [
      24,
      18
    ],
    "floors": 1,
    "layout": "split",
    "description": "作業場所と材料保管区画"
  },
  {
    "id": "research",
    "name": "研究施設",
    "cells": [
      28,
      22
    ],
    "floors": 2,
    "layout": "split",
    "description": "作業室と共用通路"
  },
  {
    "id": "apartment",
    "name": "集合住宅",
    "cells": [
      28,
      22
    ],
    "floors": 3,
    "layout": "split",
    "description": "階ごとに部屋と階段"
  }
];
// Editable map-design guidance: never treat wall thickness as structural safety/canon.
// Building-template cells represent 0.5 metres independently of map scene spacing.
const WALL_GUIDE_VERSION="facility-wall-size-v1";
function wallThicknessGuide(template,opts={}){
 const dims=opts.dimensionsM||(Array.isArray(template?.cells)?template.cells.map(n=>Number(n)*.5):null);
 if(!dims||dims.length<2||!dims.every(n=>Number.isFinite(n)&&n>0))throw Error("壁厚の目安には幅・奥行が必要です");
 const longestSideM=Math.max(dims[0],dims[1]);
 const floors=Math.max(1,Number.isSafeInteger(opts.floors)?opts.floors:Number.isSafeInteger(template?.floors)?template.floors:1);
 const strength=opts.strength||(template?.worldStyle==="machine"?"sturdy":"standard");
 const rows=[
  {limit:10,standard:[20,12],sturdy:[30,20]},
  {limit:20,standard:[25,15],sturdy:[35,22]},
  {limit:40,standard:[30,18],sturdy:[40,25]},
  {limit:80,standard:[40,22],sturdy:[50,30]},
  {limit:Infinity,standard:[50,25],sturdy:[60,35]}
 ];
 if(!["standard","sturdy"].includes(strength))throw Error("壁厚基準はstandard/sturdyのみ");
 const row=rows.find(v=>longestSideM<=v.limit);
 const [outerBaseCm,innerCm]=row[strength];
 const floorAddCm=floors<=2?0:floors<=4?5:floors<=8?10:15;
 return{version:WALL_GUIDE_VERSION,strength,dimensionsM:dims.slice(0,2),longestSideM,
  floors,outerCm:outerBaseCm+floorAddCm,innerCm,floorAddCm,largeBlockCaution:longestSideM>80};
}
// Two alternative floorplans for each original category; original IDs remain valid.
const variants={
 small_house:[["small_house_side","小型住宅・側面玄関",[12,16],1,"side","片側に玄関と通路を寄せた住宅","left"],["small_house_open","小型住宅・広間型",[16,14],1,"open","仕切りの少ないワンルーム住宅","right"]],
 row_house:[["row_house_compact","連棟住宅・細長型",[12,18],2,"side","狭い間口と奥行きのある2階建て","left"],["row_house_large","連棟住宅・拡張型",[20,14],3,"cross","3階建ての連棟住宅","right"]],
 shop:[["shop_corner","小型店舗・角地型",[18,18],1,"side","側面玄関とバックヤード","right"],["shop_two_floor","小型店舗・2階型",[20,16],2,"front","1階売場と2階バックヤード","center"]],
 office:[["office_compact","事務所・小規模型",[18,14],1,"front","平屋の小型事務所","left"],["office_large","事務所・大型型",[28,22],3,"cross","複数室と廊下を持つ3階事務所","right"]],
 warehouse:[["warehouse_narrow","倉庫・細長型",[22,34],1,"open","奥行き重視の倉庫","left"],["warehouse_multi","倉庫・管理棟付き",[36,26],2,"side","保管場所と2階管理区画","right"]],
 workshop:[["workshop_compact","工房・小型",[18,14],1,"front","小型作業場と収納","left"],["workshop_large","工房・大型",[30,24],2,"cross","複数作業室と上階を持つ工房","right"]],
 research:[["research_linear","研究施設・廊下型",[34,18],2,"side","長い廊下と実験室","left"],["research_campus","研究施設・複室型",[34,28],3,"cross","複数室を持つ3階研究施設","right"]],
 apartment:[["apartment_compact","集合住宅・小型",[22,18],2,"side","2階建て集合住宅","left"],["apartment_tower","集合住宅・高層型",[30,26],4,"cross","4階建ての集合住宅","right"]]
};
for(const [category,arr] of Object.entries(variants)){
 const base=presets.find(t=>t.id===category);
 for(const [id,name,cells,floors,layout,description,entranceSide] of arr)
  presets.push({id,name,cells,floors,layout,description,entranceSide,category});
}
for(const preset of presets)if(!preset.category)preset.category=preset.id;
// Mechanical-life layouts are generic proposals based on AA's documented
// charging, fuel supply and communication facilities, not canonical floor plans.
const mechanical=[
 ["machine_residence","機械居住区・充電室",[16,14],1,"split","充電スタンドと個体用端末を置く生活施設","small_house"],
 ["machine_rest","機械休止所・共用型",[24,18],2,"side","複数の充電設備と燃料補給機を備える休止所","row_house"],
 ["machine_fuel","燃料補給ステーション",[22,16],1,"front","燃料補給設備と登録端末を持つ施設","shop"],
 ["machine_terminal","端末・情報施設",[20,18],2,"cross","登録・案内・通信のための端末施設","office"],
 ["machine_maintenance","整備・充電工房",[28,22],1,"split","保守台・充電設備・診断端末を持つ工房","workshop"],
 ["machine_supply","機械物資補給所",[28,20],1,"open","燃料・部品・バッテリーなどを管理する補給所","warehouse"],
 ["machine_research_lab","機械研究・測定棟（汎用）",[34,26],2,"cross","AA上層などの研究・計測・試験用の編集ひな型","research"],
 ["machine_reclaim_factory","廃部品回収・再処理棟（汎用）",[34,26],1,"cross","回収物の検査・選別・再利用を扱う編集ひな型","workshop"],
 ["machine_guild_center","任務受付・作戦棟（汎用）",[32,24],2,"cross","任務検索・作戦会議・装備管理の編集ひな型","office"],
 ["machine_greenhouse_control","人工自然管理・制御棟（汎用）",[30,24],1,"cross","栽培・環境・生物管理用の制御区画ひな型","research"],
 ["machine_security_checkpoint","通行認証・検査棟（汎用）",[26,22],1,"front","通行認証・装備検査・待機区の編集ひな型","office"],
 ["machine_cargo_checkpoint","貨物検査・仕分け棟（汎用）",[34,24],1,"cross","搬入検査・仮置・物流記録の編集ひな型","warehouse"]
];
for(const [id,name,cells,floors,layout,description,category] of mechanical)
 presets.push({id,name,cells,floors,layout,description,category,worldStyle:"machine",entranceSide:"center"});
// Mechanical housing and high-density dormancy are reusable layout proposals.
// A pod is an individually selectable object; no actual residents are auto-created.
const communalLayouts=[
 ["machine_apartment_small","機械共同住宅・小型",[22,18],2,"split","個室と共用充電・登録設備を備える小型集合住居","machine_housing","housing",2],
 ["machine_apartment_block","機械共同住宅・中型",[32,24],3,"cross","複数区画と各階の共有設備を持つ集合住居","machine_housing","housing",4],
 ["machine_residence_tower","機械居住塔・高層",[36,28],5,"cross","多層居住区と共用休止・補給設備","machine_housing","housing",6],
 ["machine_pod_unit","個人休眠ポッド区画",[18,14],1,"open","少数の個人休眠ポッドと管理端末","machine_dormancy","pods",4],
 ["machine_pod_hall","量産型休眠ホール",[34,24],1,"open","ポッド列と中央通路を備える量産型休眠区画","machine_dormancy","pods",16],
 ["machine_pod_block","休眠ポッド棟",[36,28],3,"open","複数階の休眠ポッドと保守・管理スペース","machine_dormancy","pods",20],
 ["machine_pod_tower","高密度休眠施設",[40,32],5,"open","大量ポッドを持つ多階層休眠施設","machine_dormancy","pods",28],
 ["machine_fuel_station_large","大型燃料補給所",[32,24],1,"front","補給列と制御端末を備える大型施設","machine_support","fuel",0],
 ["machine_terminal_center","端末・登録センター",[30,22],2,"cross","登録・通信・状態照会の端末を備える施設","machine_support","terminal",0],
 ["machine_charge_center","共用充電センター",[32,24],1,"open","多数の充電台と管理端末を持つ施設","machine_support","charging",0]
];
for(const [id,name,cells,floors,layout,description,category,facilityMode,podsPerFloor] of communalLayouts)
 presets.push({id,name,cells,floors,layout,description,category,facilityMode,podsPerFloor,worldStyle:"machine",entranceSide:"center"});

// Middle-layer proposals: no canonical facility placement or layout is asserted.
presets.push(...[
 {id:"machine_mid_personal_workshop",name:"個人工房・小型",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"workshop",roomNames:["個別設計・作業室","依頼相談室","部品保管室","試作調整室"],notionStatus:"layout-proposal"},
 {id:"machine_mid_weapon_workshop",name:"武器製造・改造工房",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"workshop",roomNames:["武器加工室","制御・設計室","銃器調整室","部品保管室"],notionStatus:"layout-proposal"},
 {id:"machine_mid_armor_workshop",name:"機体整備・外装工房",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"workshop",roomNames:["外装整備室","機体診断室","装甲加工室","部品保管室"],notionStatus:"layout-proposal"},
 {id:"machine_mid_electronics_workshop",name:"精密電子機器工房",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"workshop",roomNames:["電子制御調整室","計測室","センサー組立室","部品保管室"],notionStatus:"layout-proposal"},
 {id:"machine_mid_prototype_lab",name:"装備開発・試作ラボ",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"lab",roomNames:["試作開発室","設計記録室","性能測定室","試作品保管室"],notionStatus:"layout-proposal"},
 {id:"machine_mid_selrink_workshop",name:"セルリンクの工房（仮間取り）",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"workshop",roomNames:["汎用改造作業室","規格変換・設計室","互換部品保管室","複合装備調整室"],notionStatus:"layout-proposal"},
 {id:"machine_mid_kerank_workshop",name:"ケランクの工房（仮間取り）",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"workshop",roomNames:["重火器作業室","機械強度検査室","装甲加工室","重量部品保管室"],notionStatus:"layout-proposal"},
 {id:"machine_mid_borsko_workshop",name:"ボルスコの工房（仮間取り）",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"workshop",roomNames:["精密射撃調整室","照準・計測室","センサー統合室","電子部品保管室"],notionStatus:"layout-proposal"},
 {id:"machine_mid_equipment_shop",name:"武器・装備販売店",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"market",roomNames:["装備展示・販売区","販売管理室","受渡・相談区","商品保管区"],notionStatus:"layout-proposal"},
 {id:"machine_mid_parts_shop",name:"素材・部品販売店",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"market",roomNames:["部品販売区","査定・登録室","工具・素材販売区","在庫保管室"],notionStatus:"layout-proposal"},
 {id:"machine_mid_market",name:"市場・交易施設",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"market",roomNames:["交易・売場区","取引管理室","受渡・検品区","貨物保管区"],notionStatus:"layout-proposal"},
 {id:"machine_mid_guild_reception",name:"ギルド受付・報酬施設",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"guild",roomNames:["任務受付室","依頼検索室","完了報告室","報酬査定室"],notionStatus:"layout-proposal"},
 {id:"machine_mid_guild_storage",name:"ギルド倉庫・支給品管理所",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"storage",roomNames:["装備一時保管室","登録管理室","回収品検品室","支給品倉庫"],notionStatus:"layout-proposal"},
 {id:"machine_mid_plant_processing",name:"植物素材加工場",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"production",roomNames:["植物原料加工室","品質検査室","乾燥・選別室","加工品保管室"],notionStatus:"layout-proposal"},
 {id:"machine_mid_fuel_refinery",name:"燃料精製・製造施設",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"production",roomNames:["燃料加工室","安全監視室","精製制御室","製品保管室"],notionStatus:"layout-proposal"},
 {id:"machine_mid_fiber_resin",name:"樹脂・繊維加工場",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"production",roomNames:["繊維加工室","品質検査室","樹脂加工室","原料保管室"],notionStatus:"layout-proposal"},
 {id:"machine_mid_nursery",name:"栽培温室・育成施設",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"greenhouse",roomNames:["育苗区","環境制御室","栽培区","培養資材室"],notionStatus:"layout-proposal"},
 {id:"machine_mid_creature_holding",name:"生物飼育・一時保管施設",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"containment",roomNames:["生物保管区","環境監視室","飼育管理区","捕獲器材庫"],notionStatus:"layout-proposal"},
 {id:"machine_mid_lounge",name:"交流・娯楽施設",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"social",roomNames:["交流ラウンジ","情報端末室","共用活動室","設備管理室"],notionStatus:"layout-proposal"},
 {id:"machine_mid_communications",name:"通信所・情報掲示施設",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"terminal",roomNames:["情報掲示室","通信管理室","照会端末室","記録室"],notionStatus:"layout-proposal"},
 {id:"machine_mid_heavy_bay",name:"大型機体整備・搬入口",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"workshop",roomNames:["大型機整備室","安全管理室","搬入・点検室","交換部品庫"],notionStatus:"layout-proposal"},
 {id:"machine_mid_quarantine",name:"生物隔離・検査施設",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"containment",roomNames:["隔離検査室","監視制御室","隔離待機室","防護器材庫"],notionStatus:"layout-proposal"},
 {id:"machine_mid_emergency_repair",name:"緊急修理・救護施設",cells:[32,24],floors:1,layout:"cross",description:"中層向け編集用施設案。Notion上の用途に対応する仮間取りで、正式な寸法・配置・室構成ではない。",category:"machine_midlayer",worldStyle:"machine",entranceSide:"center",facilityMode:"workshop",roomNames:["応急修理室","診断・記録室","停止保管室","交換部品庫"],notionStatus:"layout-proposal"}
]);

// Official facility and function; dimensions and rooms below are a draft for map rebuilding.
presets.push({
 id:"machine_mid_registlink_dome",name:"ギルド複合区《レジストリンク・ドーム》",
 cells:[1000,1000],floors:1,layout:"terminal-integrated-ring",category:"machine_midlayer",
 worldStyle:"machine",facilityMode:"registlink_dome",notionStatus:"map-draft-restored",
 designStatus:"draft-unverified",
 description:"GitHub中層マップの仮配置を反映。直径500mの中央リンクターミナル内に、内半径130m・外半径210mの環状ギルド施設を組み合わせる。中央リフト乗降区・8受付・小作戦室など。詳細配置は再制作用仮案。",
 notionPage:"https://app.notion.com/p/1defa1b30dc9808f857ccbc8f17ef5b9"
});
// Middle-layer weapon complex: independent from the small weapon workshop.
// Its existence as a distinct Notion facility, dimensions and internal layout
// are NOT canon; all rooms and placement are provisional map-edit proposals.
presets.push({
 id:"machine_mid_weapons_yard",name:"兵器場",
 cells:[80,60],floors:1,layout:"weapons-yard",category:"machine_midlayer",
 worldStyle:"machine",use:"production",facilityMode:"weapons_yard",
 notionStatus:"layout-proposal",designStatus:"draft-unverified",
 description:"中層再制作に向けた大型兵器施設の仮案。部品受入・武装組立・加工調整・完成品保管・試験検査・整備制御を分離する。40×30m、1階、各区画の配置と施設名はNotion未確定。"
});

// Middle-layer parent layout: Notion footprint is 4000 x 2500 m, with sector center [-150,900] and size 1500 x 500 m.
// Forest size and vertical clearances remain provisional; fit its draft geometry inside the documented sector.
presets.push({id:"machine_middle_layer_frame",name:"中層《アームドヴェイン階層》・施設配置枠",cells:[2000,1250],floors:1,layout:"open",description:"中層の親枠とアルボラセクター子枠、屋内森林をまとめた編集用配置案。森林の寸法・高さは仮設定。",category:"machine_midlayer",worldStyle:"machine",facilityMode:"middle_layer_frame",entranceSide:"center"});
// Arbor Sector forest hall: a large editable zone, not a canonical footprint.
presets.push({id:"machine_mid_giant_tree_grove",name:"アルボラセクター・大木育成区画",cells:[420,360],floors:1,layout:"open",description:"大型樹木を複数育成する人工森林区。天井人工降雨、局所水循環、管理通路を持つ仮配置。寸法は未確定。",category:"machine_midlayer",worldStyle:"machine",facilityMode:"giant_grove",entranceSide:"center"});
// Tag all middle-layer editing templates, including the parent frame and forest hall.
// World style and ship level are separate facets in template search.
for(const t of presets)if(t.category==="machine_midlayer")
 t.tags=[...new Set([...(Array.isArray(t.tags)?t.tags:[]),"中層"])];


/* Modern Japanese housing: original playable layouts informed by typical 1R/1K/LDK
   arrangements (UR Housing / LIFULL), not tracings of any advertised property. */
const modernHousing=[
 {id:"jp_studio_1r",name:"現代日本・ワンルーム1R",cells:[8,12],floors:1,
  description:"外形約24㎡のコンパクトな1R。居室兼キッチン・水回り・玄関。1マス50cmの寸法モデル。",
  plans:[{rooms:[
   ["main","居室・キッチン",0,0,8,8],["bath","ユニットバス",0,8,3,4],["hall","玄関",3,8,5,4]],
   doors:[["main","hall"],["bath","hall"]],entry:"hall",
   items:[["キッチン","kitchen",.5,.5,3,1],["ベッド","bed",5,1,2,4],
    ["テーブル","table",3,5,2,1.5],["浴槽","bath",.4,8.6,2,2],
    ["トイレ","toilet",2.1,10.6,.8,1],["玄関収納","cabinet",6.2,9.5,1.5,1]]}]},
 {id:"jp_apartment_1k",name:"現代日本・アパート1K",cells:[8,14],floors:1,
  description:"外形約28㎡の1K。居室とキッチン・玄関の区画を分離。",
  plans:[{rooms:[
   ["main","居室",0,0,8,9],["bath","浴室・トイレ",0,9,3,5],["hall","キッチン・玄関",3,9,5,5]],
   doors:[["main","hall"],["bath","hall"]],entry:"hall",
   items:[["ベッド","bed",1,1,2,4],["収納","cabinet",6,1,1.5,1],
    ["キッチン","kitchen",3.6,10,3,1],["浴槽","bath",.4,10,2,2],
    ["トイレ","toilet",2.1,12.4,.8,1],["玄関収納","cabinet",6.3,11.5,1.4,1]]}]},
 {id:"jp_mansion_1ldk",name:"現代日本・マンション1LDK",cells:[12,15],floors:1,
  description:"外形約45㎡の1LDK。独立寝室とLDK・水回り・廊下。",
  plans:[{rooms:[
   ["bed","寝室",0,0,5,10],["ldk","LDK",5,0,7,10],
   ["bath","浴室・洗面",0,10,4,3],["wc","トイレ",0,13,4,2],["hall","玄関・廊下",4,10,8,5]],
   doors:[["bed","ldk"],["ldk","hall"],["bath","hall"],["wc","hall"]],entry:"hall",
   items:[["ベッド","bed",1,1.5,2.8,4],["収納","cabinet",1,8,3,1],
    ["キッチン","kitchen",6,1,4,1],["食卓","table",9,4,2,2],["ソファ","sofa",6,7,3,1.5],
    ["浴槽","bath",.5,10.5,2,2],["洗面台","sink",2.9,10.5,.9,1],
    ["トイレ","toilet",1,13.5,1.5,1],["玄関収納","cabinet",9,13,2,1]]}]},
 {id:"jp_mansion_2ldk",name:"現代日本・マンション2LDK",cells:[16,18],floors:1,
  description:"外形約72㎡の2LDK。個室2室、LDK、廊下、水回り。",
  plans:[{rooms:[
   ["bed1","寝室",0,0,6,9],["bed2","洋室",6,0,5,9],["ldk","LDK",11,0,5,13],
   ["corridor","共用廊下",0,9,11,4],["bath","浴室・洗面",0,13,4,3],
   ["wc","トイレ",0,16,4,2],["hall","玄関ホール",4,13,12,5]],
   doors:[["bed1","corridor"],["bed2","corridor"],["ldk","corridor"],
    ["corridor","hall"],["bath","hall"],["wc","hall"],["ldk","hall"]],entry:"hall",
   items:[["ベッド","bed",1,1.5,2.8,4],["ベッド","bed",7,1.5,2,4],
    ["キッチン","kitchen",12,1,3,1],["食卓","table",12,5,3,2],["ソファ","sofa",12,9,3,1.5],
    ["浴槽","bath",.5,13.4,2,2],["洗面台","sink",2.8,13.5,1,1],
    ["トイレ","toilet",1,16.5,1.5,1],["収納棚","cabinet",12.5,16,3,1]]}]},
 {id:"jp_mansion_3ldk",name:"現代日本・マンション3LDK",cells:[18,18],floors:1,
  description:"外形約81㎡の3LDK。個室3室と共用廊下・LDK・水回り。",
  plans:[{rooms:[
   ["bed1","主寝室",0,0,6,8],["bed2","洋室A",6,0,6,8],["bed3","洋室B",12,0,6,8],
   ["corridor","廊下",0,8,18,3],["bath","浴室・洗面",0,11,4,4],
   ["wc","トイレ",0,15,4,3],["hall","玄関ホール",4,11,2,7],["ldk","LDK",6,11,12,7]],
   doors:[["bed1","corridor"],["bed2","corridor"],["bed3","corridor"],
    ["corridor","hall"],["corridor","ldk"],["bath","hall"],["wc","hall"],["hall","ldk"]],entry:"hall",
   items:[["ベッド","bed",1,1,2.8,4],["ベッド","bed",7,1,2,4],["ベッド","bed",13,1,2,4],
    ["キッチン","kitchen",7,12,4,1],["食卓","table",12,12,3,2],["ソファ","sofa",13,15.5,3,1.5],
    ["浴槽","bath",.5,11.5,2,2],["洗面台","sink",2.8,12,1,1],
    ["トイレ","toilet",1,15.5,1.5,1],["収納棚","cabinet",7,16,3,1]]}]},
 {"id":"jp_detached_2story","name":"現代日本・2階建て戸建て","cells":[16,14],"floors":2,"description":"外形約56㎡／階・延べ約112㎡。階段室を独立させ、玄関から居間・水回り・階段へ移動できる試作間取り。","plans":[{"rooms":[["ldk","LDK",0,0,10,8],["wash","洗面・脱衣室",10,0,3,5],["bath","浴室",13,0,3,5],["pantry","食品収納",10,5,2,3],["stairroom","階段室・踊り場",12,5,4,9],["corridor","廊下",0,8,10,2],["wc","トイレ",0,10,4,2],["storage","玄関収納",0,12,4,2],["entry","玄関",4,10,4,4],["hall","玄関ホール",8,10,2,4],["stairApproach","階段前廊下",10,8,2,6]],"doors":[["ldk","corridor","sliding"],["ldk","wash","sliding"],["wash","bath","sliding"],["pantry","ldk","sliding"],["wc","corridor","sliding","end"],["storage","entry","sliding"],["entry","corridor","sliding"],["entry","hall","open"],["hall","stairApproach","open"],["stairApproach","stairroom","sliding","end"]],"entry":"entry","items":[["キッチン","kitchen",1,1,4,1],["食卓","table",5,2,3,2],["浴槽","bath",14.25,0.5,1.6,2.6],["洗面台","sink",10.3,0.5,1.5,1],["トイレ","toilet",0.3,10.3,1.5,1.2],["収納棚","cabinet",0.6,12.5,2,1],["階段（折り返し・概念図）","stair",12.2,5.2,3.6,5.6]]},{"rooms":[["b0","主寝室",0,0,6,8],["b1","洋室A",6,0,4,8],["b2","洋室B",10,0,6,5],["upperHall","上階廊下",10,5,2,3],["stairroom","階段室・踊り場",12,5,4,9],["corridor","廊下",0,8,12,2],["family","多目的室",0,10,8,4],["hall","2階ホール",8,10,4,4]],"doors":[["b0","corridor","sliding"],["b1","corridor","sliding"],["b2","upperHall","sliding"],["upperHall","corridor","open"],["corridor","hall","open"],["family","hall","sliding"],["hall","stairroom","sliding","end"]],"items":[["ベッド","bed",0.6,1,2.8,4],["ベッド","bed",6.5,1,2.3,3.5],["ベッド","bed",10.8,0.5,2.4,3.5],["階段（折り返し・概念図）","stair",12.2,5.2,3.6,5.6]]}]}
];
// Six independently planned detached homes; preserve all pre-existing template IDs.
for(const item of [{"id":"jp_detached_single_2ldk","name":"一軒家・コンパクト平屋2LDK","cells":[16,14],"floors":1,"description":"平屋8×7m。寝室2室、LDK、玄関、浴室。","plans":[{"rooms":[["b0","主寝室",0,0,5,7],["b1","洋室",5,0,5,7],["ldk","LDK",10,0,6,14],["hall","廊下",0,7,10,3],["bath","浴室・洗面",0,10,4,4],["wc","トイレ",4,10,3,2],["storage","収納",4,12,3,2],["entry","玄関",7,10,3,4]],"doors":[["b0","hall"],["b1","hall"],["ldk","hall"],["bath","hall"],["wc","hall","sliding","end"],["entry","hall"],["storage","entry"]],"entry":"entry","items":[["浴槽","bath",0.2,11.3,2,2.4],["トイレ","toilet",4.1,10.6,1.1,1.2],["収納棚","cabinet",4.15,12.4,1.4,1],["キッチン","kitchen",11,1,3,1],["食卓","table",11,10,3,2],["洗面台","sink",2.65,12.65,1.1,0.8]]}]},{"id":"jp_detached_single_3ldk","name":"一軒家・平屋3LDK","cells":[20,16],"floors":1,"description":"平屋10×8m。寝室3室、LDKと玄関、水回り。","plans":[{"rooms":[["b0","主寝室",0,0,5,9],["b1","洋室A",5,0,5,9],["b2","洋室B",10,0,5,9],["ldk","LDK",15,0,5,16],["hall","廊下",0,9,15,3],["bath","浴室",0,12,4,4],["wash","洗面室",4,12,4,4],["wc","トイレ",8,12,3,2],["storage","収納",8,14,3,2],["entry","玄関",11,12,4,4]],"doors":[["b0","hall"],["b1","hall"],["b2","hall"],["ldk","hall"],["bath","wash"],["wash","hall"],["wc","hall","sliding","end"],["entry","hall"],["storage","entry"]],"entry":"entry","items":[["浴槽","bath",0.2,13.3,2.3,2.5],["洗面台","sink",6,14.2,1.5,1],["トイレ","toilet",8.1,12.5,1.1,1.2],["収納棚","cabinet",8.15,14.4,1.4,1],["キッチン","kitchen",16,1,3,1],["食卓","table",16,12,3,2],["洗濯機","washer",0.2,10.3,1.3,1.3]]}]},{"id":"jp_detached_standard_3ldk","name":"一軒家・標準2階建て3LDK","cells":[18,16],"floors":2,"description":"2階建て9×8m。1階LDK、2階3室。","plans":[{"rooms":[["bath","浴室",0,0,4,4],["wash","洗面・脱衣室",4,0,4,4],["wc","トイレ",0,4,4,2],["storage","納戸",0,6,4,5],["entry","玄関",0,11,4,5],["hall","廊下",4,4,4,12],["ldk","LDK",8,0,10,7],["utility","家事室・パントリー",8,7,6,9],["stairroom","階段室・踊り場",14,7,4,9]],"doors":[["bath","wash","sliding"],["wash","hall","sliding"],["wc","hall","sliding"],["storage","hall","sliding"],["entry","hall","sliding","end"],["hall","ldk","sliding"],["hall","utility","sliding"],["ldk","utility","sliding"],["utility","stairroom","sliding","end"]],"entry":"entry","items":[["浴槽","bath",0.2,0.2,2.5,2.5],["洗面台","sink",4.5,0.5,2,1],["トイレ","toilet",0.8,4.3,1.6,1.2],["収納棚","cabinet",0.6,7,2,1],["玄関収納","cabinet",0.5,12.2,2,1],["キッチン","kitchen",9,1,4,1],["食卓","table",13,3,3,2],["収納棚","cabinet",8.5,10.5,2,1],["階段（折り返し・概念図）","stair",14.2,7.2,3.6,5.6]]},{"rooms":[["b0","主寝室",0,0,7,7],["b1","洋室A",7,0,5,7],["b2","洋室B",12,0,6,7],["corridor","上階廊下",0,7,14,2],["storage","収納・多目的室",0,9,8,7],["hall","2階ホール",8,9,6,7],["stairroom","階段室・踊り場",14,7,4,9]],"doors":[["b0","corridor","sliding"],["b1","corridor","sliding"],["b2","corridor","sliding"],["corridor","hall","open"],["storage","hall","sliding"],["stairroom","hall","sliding","end"]],"items":[["階段（折り返し・概念図）","stair",14.2,7.2,3.6,5.6],["ベッド","bed",1,1,2.8,3.5],["ベッド","bed",7.7,1,2.4,3.5],["ベッド","bed",13,1,2.4,3.5]]}]},{"id":"jp_detached_narrow_3ldk","name":"一軒家・細長2階建て3LDK","cells":[12,20],"floors":2,"description":"2階建て6×10m。細長い敷地向け。","plans":[{"rooms":[["ldk","LDK",0,0,12,9],["wash","洗面・脱衣室",0,9,4,4],["bath","浴室",0,13,4,4],["storage","収納",0,17,4,3],["hall","廊下",4,9,4,8],["entry","玄関ホール",4,17,4,3],["wc","トイレ",8,9,4,2],["stairroom","階段室・下部踊り場",8,11,4,9]],"doors":[["ldk","hall","sliding"],["wash","hall","sliding"],["bath","wash","sliding"],["storage","entry","sliding"],["hall","entry","open"],["wc","hall","sliding"],["stairroom","entry","sliding","end"]],"entry":"entry","items":[["キッチン","kitchen",1,1,4,1],["洗面台","sink",2.2,9.4,1.4,1],["浴槽","bath",0.2,14.3,2.5,2.6],["トイレ","toilet",9,9.3,1.4,1.2],["収納棚","cabinet",0.5,17.5,2,1],["階段（折り返し・概念図）","stair",8.2,11.2,3.6,5.6],["洗濯機","washer",0.3,9.3,1.3,1.3]]},{"rooms":[["b0","主寝室",0,0,6,7],["b1","洋室A",6,0,6,7],["corridor","上階廊下",0,7,12,2],["b2","洋室B",0,9,6,8],["store2","リネン収納",8,9,4,2],["hall","2階ホール",6,9,2,11],["stairroom","階段室・踊り場",8,11,4,9],["store","収納",0,17,6,3]],"doors":[["b0","corridor","sliding"],["b1","corridor","sliding"],["corridor","hall","open"],["b2","hall","sliding"],["store2","corridor","sliding"],["store","hall","sliding"],["stairroom","hall","sliding","end"]],"items":[["階段（折り返し・概念図）","stair",8.2,11.2,3.6,5.6],["ベッド","bed",0.5,1,2.6,3.5],["ベッド","bed",6.5,1,2.6,3.5],["ベッド","bed",0.5,10,2.6,3.5]]}]},{"id":"jp_detached_large_4ldk","name":"一軒家・和室付き2階建て4LDK","cells":[20,18],"floors":2,"description":"2階建て10×9m。1階和室・LDK、2階3室。","plans":[{"rooms":[["guest","和室",0,0,8,8],["wash","洗面・脱衣室",0,8,4,4],["bath","浴室",0,12,4,4],["wc","トイレ",0,16,4,2],["hall","玄関・廊下",4,8,4,10],["ldk","LDK",8,0,12,10],["utility","家事室",8,10,5,8],["stairroom","階段室・踊り場",13,10,4,8],["sunroom","サンルーム",17,10,3,8]],"doors":[["guest","hall","sliding"],["guest","ldk","sliding"],["wash","hall","sliding"],["bath","wash","sliding"],["wc","hall","sliding"],["hall","ldk","sliding"],["hall","utility","sliding"],["ldk","utility","sliding"],["utility","stairroom","sliding","end"],["sunroom","ldk","sliding"]],"entry":"hall","items":[["浴槽","bath",0.2,13.3,2.5,2.5],["洗面台","sink",2,8.1,1.4,1],["トイレ","toilet",0.9,16.2,1.5,1.2],["キッチン","kitchen",9,1,4,1],["食卓","table",14,4,3,2],["収納","cabinet",9,14,2,1],["階段（折り返し・概念図）","stair",13.2,10.2,3.6,5.6],["洗濯機","washer",0.2,8.5,1.3,1.3]]},{"rooms":[["b0","主寝室",0,0,8,8],["b1","洋室A",8,0,5,8],["b2","洋室B",13,0,7,8],["corridor","上階廊下",0,8,20,2],["family","家族室・収納",0,10,8,8],["hall","2階ホール",8,10,5,8],["stairroom","階段室・踊り場",13,10,4,8],["store","収納",17,10,3,8]],"doors":[["b0","corridor","sliding"],["b1","corridor","sliding"],["b2","corridor","sliding"],["corridor","hall","open"],["family","hall","sliding"],["stairroom","hall","sliding","end"],["store","corridor","sliding"]],"items":[["階段（折り返し・概念図）","stair",13.2,10.2,3.6,5.6],["ベッド","bed",1,1,2.6,3.5],["ベッド","bed",8.6,1,2.6,3.5],["ベッド","bed",14,1,2.6,3.5]]}]},{"id":"jp_detached_urban_3story","name":"一軒家・都市型3階建て3LDK＋書斎","cells":[12,16],"floors":3,"description":"都市型3階建て6×8m。2階2室・3階洋室と書斎。","plans":[{"rooms":[["ldk","LDK",0,0,12,8],["wc","トイレ",0,8,4,2],["wash","洗面室",0,10,4,2],["bath","浴室",0,12,4,4],["hall","玄関・廊下",4,8,4,8],["stairroom","階段・踊り場",8,8,4,8]],"doors":[["ldk","hall","sliding"],["wc","hall","sliding"],["wash","hall","sliding"],["bath","hall","sliding"],["stairroom","hall","sliding","end"]],"entry":"hall","items":[["キッチン","kitchen",1,1,4,1],["浴槽","bath",0.5,12.5,2,2],["洗面台","sink",0.6,10.3,2,1],["トイレ","toilet",1.1,8.3,1.4,1.2],["階段（折り返し・概念図）","stair",8.2,8.2,3.6,5.6]]},{"rooms":[["b0","主寝室",0,0,5,8],["b1","洋室",5,0,7,8],["hallL","共用廊下",0,8,4,3],["hall","廊下",4,8,4,8],["storageL","収納",0,11,4,5],["stairroom","階段・踊り場",8,8,4,8]],"doors":[["b0","hallL","sliding"],["b1","hall","sliding"],["hallL","hall","sliding"],["storageL","hall","sliding"],["stairroom","hall","sliding","end"]],"entry":null,"items":[["ベッド","bed",0.5,1,2.4,3.5],["ベッド","bed",6,1,2.4,3.5],["階段（折り返し・概念図）","stair",8.2,8.2,3.6,5.6]]},{"rooms":[["study","書斎",0,0,5,8],["bed","洋室",5,0,7,8],["hallL","共用廊下",0,8,4,3],["hall","廊下",4,8,4,8],["storageL","収納",0,11,4,5],["stairroom","階段・踊り場",8,8,4,8]],"doors":[["study","hallL","sliding"],["bed","hall","sliding"],["hallL","hall","sliding"],["storageL","hall","sliding"],["stairroom","hall","sliding","end"]],"entry":null,"items":[["書斎机","table",1,2,2,2],["ベッド","bed",6,1,2.4,4],["階段（折り返し・概念図）","stair",8.2,8.2,3.6,5.6]]}]}])modernHousing.push(item);
// 35-tsubo single-storey family house: 22 x 21 half-metre cells = 115.5 m² (34.94 tsubo).
// Conceptual layout; room areas are gross rectangles and do not deduct wall thickness.
modernHousing.push({
 id:"jp_detached_single_35tsubo_5ldk",name:"一軒家・35坪平屋（和室＋4寝室）",
 cells:[22,21],floors:1,
 description:"35坪平屋の配置試案。キッチンと浴室は共通壁で直接隣接、LDKと和室は引き戸で直接接続。実施設計・施工寸法は未検証。",
 plans:[{
  rooms:[
   ["master","主寝室",0,0,7,8],["bed1","洋室1",7,0,5,8],
   ["bed2","洋室2",12,0,5,8],["bed3","洋室3",17,0,5,8],
   ["hall","共用廊下",0,8,22,2],
   ["ldk","LDK",0,10,14,11],
   ["bath","浴室",14,10,4,4],
   ["wash","洗面脱衣室",18,10,4,4],
   ["washitsu","和室",14,14,5,7],
   ["entry","玄関",19,14,3,7]
  ],
  doors:[
   ["master","hall"],["bed1","hall"],["bed2","hall"],["bed3","hall"],
   ["ldk","hall","sliding"],["bath","ldk","sliding"],
   ["bath","wash","sliding"],["wash","hall","sliding"],
   ["washitsu","ldk","sliding"],["entry","washitsu","sliding"]
  ],
  entry:"entry",
  items:[
   ["ベッド","bed",1,1,2.6,4],["ベッド","bed",8,1,2.2,3.5],
   ["ベッド","bed",13,1,2.2,3.5],["ベッド","bed",18,1,2.2,3.5],
   ["キッチン","kitchen",12,10.7,1.5,3],
   ["食卓","table",7,13,3,2],
   ["浴槽","bath",15,10.5,2.5,2.5],
   ["洗面台","sink",18.4,10.5,1.5,1],
   ["洗濯機","washer",20.2,10.5,1.3,1.3],
   ["玄関収納","cabinet",19.4,18,1.2,1.5]
  ]
 }]
});
for(const plan of modernHousing)presets.push({
 id:plan.id,name:plan.name,cells:plan.cells,floors:plan.floors,layout:"custom-modern",
 category:"modern_housing",era:"modern-jp",use:"housing",
 description:plan.description,planSource:plan.id.startsWith("jp_detached_")?"unverified-original-draft":"original-layout-inspired-by-UR-LIFULL",
 designStatus:plan.id.startsWith("jp_detached_")?"draft-unverified":"example-layout",
 modernPlan:plan.plans
});
function generateModern(template,options){
 const {prefix,parentId=null,displayLevel=4,x=0,y=0,spacing=2,baseName=template.name}=options;
 if(typeof prefix!=="string"||!prefix||!Number.isFinite(spacing)||spacing<=0)throw Error("現代住宅テンプレートの配置指定が不正");
 const [w,h]=template.cells,objs=[],at=(a,b)=>[x+a*spacing,y+b*spacing];
 const rect=(a,b,c,d)=>({type:"rect",x:x+a*spacing,y:y+b*spacing,width:c*spacing,height:d*spacing});
 const line=(a,b,c,d)=>({type:"polyline",points:[at(a,b),at(c,d)]});
 const floors=template.modernPlan.map((_,i)=>({id:(i+1)+"F",label:(i+1)+"階",elevation:i*3,height:3}));
 const wallGuide=wallThicknessGuide(template,{strength:"standard",floors:template.modernPlan.length});
 const objFloorIndex=(pair,floor,direction)=>{
  const levels=pair.split("-");
  return (direction==="up"&&levels[0]===floor)||(direction==="down"&&levels[1]===floor)?0:-1;
 };
 const main={id:prefix,name:baseName,parentId,displayLevel,objectType:"facility",layer:"subregions",zIndex:30,
  geometry:rect(0,0,w,h),floors,visible:true,selectable:true,
  style:{fill:"rgba(90,143,153,.12)",stroke:"#a6cbd0",strokeWidth:1.4},
  label:{visible:true,text:baseName,position:at(w/2,h/2),fontSize:11},
  detail:template.description,metadata:{templateId:template.id,generated:true,era:"modern-jp",planSource:template.planSource,designStatus:template.designStatus}};
 objs.push(main);
 let count=0;
 const push=(name,kind,geometry,f,style,extra={})=>{
  const o={id:prefix+"_modern_"+(++count),name,parentId:prefix,displayLevel:displayLevel+1,
   floorId:f,objectType:kind,layer:kind==="wall"||kind==="door"?"walls":"structures",
   zIndex:kind==="slab"?29:kind==="region"?31:kind==="wall"?47:kind==="door"?49:kind==="stair"?46:42,
   geometry,visible:true,selectable:kind!=="slab",
   style,label:{visible:kind==="region",text:name,fontSize:8},
   detail:name+"（現代日本の住宅用テンプレート）",
   metadata:{templateId:template.id,generated:true},...extra};
  if(kind==="door"){o.door={hinge:"start",swing:"inward",state:"closed",swingSide:"left"};
   o.opening={kind:"interior",width:geometry.points?Math.hypot(
    geometry.points[1][0]-geometry.points[0][0],geometry.points[1][1]-geometry.points[0][1]):0,external:false};}
  objs.push(o);return o;
 };
 for(let z=0;z<template.modernPlan.length;z++){
  const plan=template.modernPlan[z],floor=floors[z].id;
  // Upper-floor slabs must have a real opening around the stairwell.
  // Keep the lower (ground) floor continuous. Each upper floor is represented
  // by non-overlapping slab rectangles outside the stair footprint.
  const floorStairs=plan.items.filter(item=>item[1]==="stair");
  const slabStyle={fill:"rgba(48,81,88,.64)",stroke:null};
  if(z>0&&floorStairs.length===1){
   const [, ,sx,sy,sw,sh]=floorStairs[0];
   const pieces=[
    [0,0,w,sy],[0,sy,sx,sh],
    [sx+sw,sy,w-(sx+sw),sh],[0,sy+sh,w,h-(sy+sh)]
   ];
   const validHole=sx>=0&&sy>=0&&sw>0&&sh>0&&sx+sw<=w&&sy+sh<=h;
   if(!validHole)throw Error("階段床開口が外形を超過："+template.id+"/"+floor);
   for(const [px,py,pw,ph] of pieces)if(pw>1e-8&&ph>1e-8)
    push("床面 "+floor,"slab",rect(px,py,pw,ph),floor,slabStyle,
     {metadata:{templateId:template.id,generated:true,stairFloorOpening:true}});
  }else{
   push("床面 "+floor,"slab",rect(0,0,w,h),floor,slabStyle);
  }
  const rooms=plan.rooms.map(([id,name,rx,ry,rw,rh])=>({id,name,x:rx,y:ry,w:rw,h:rh}));
  const roomMap=new Map(rooms.map(r=>[r.id,r]));
  const roomObjectIds=new Map();
  const containingRoom=(rx,ry,rw,rh)=>rooms.find(room=>
   rx>=room.x-1e-7&&ry>=room.y-1e-7&&
   rx+rw<=room.x+room.w+1e-7&&ry+rh<=room.y+room.h+1e-7);
  const assignRoomParent=(obj,rx,ry,rw,rh)=>{
   const room=containingRoom(rx,ry,rw,rh);
   const parentRoom=room&&roomObjectIds.get(room.id);
   if(parentRoom){
    obj.parentId=parentRoom;
    obj.displayLevel=displayLevel+2;
    obj.metadata={...obj.metadata,roomId:room.id};
   }
   return obj;
  };
  const edgeH=new Map(),edgeV=new Map(),blockedH=new Set(),blockedV=new Set();
  const addEdge=(map,key)=>map.set(key,true);
  for(const room of rooms){
   for(let ix=room.x;ix<room.x+room.w;ix++){
    addEdge(edgeH,ix+","+room.y);addEdge(edgeH,ix+","+(room.y+room.h));
   }
   for(let iy=room.y;iy<room.y+room.h;iy++){
    addEdge(edgeV,room.x+","+iy);addEdge(edgeV,(room.x+room.w)+","+iy);
   }
   const zone=push(room.name,"region",rect(room.x,room.y,room.w,room.h),floor,
    {fill:z%2?"rgba(69,115,124,.11)":"rgba(81,122,133,.12)",stroke:null},
    {shapePresetId:"room_zone",detail:room.name+"。部屋の用途を示す領域です。"});
   zone.label.position=at(room.x+room.w/2,room.y+room.h/2);
   roomObjectIds.set(room.id,zone.id);
  }
  const doors=[];
  const shared=(a,b)=>{
   if(Math.abs(a.x+a.w-b.x)<1e-9||Math.abs(b.x+b.w-a.x)<1e-9)
    return{direction:"V",fixed:Math.abs(a.x+a.w-b.x)<1e-9?a.x+a.w:b.x+b.w,
     lo:Math.max(a.y,b.y),hi:Math.min(a.y+a.h,b.y+b.h)};
   if(Math.abs(a.y+a.h-b.y)<1e-9||Math.abs(b.y+b.h-a.y)<1e-9)
    return{direction:"H",fixed:Math.abs(a.y+a.h-b.y)<1e-9?a.y+a.h:b.y+b.h,
     lo:Math.max(a.x,b.x),hi:Math.min(a.x+a.w,b.x+b.w)};
   return null;
  };
  // 80cm geometric interior openings; effective clear width still needs verifying.
  const widthCmFor=(a,b,external)=>external?90:80;
  const placeDoor=(join,widthCm,external,type)=>{
   const length=widthCm/50;
   if(join.hi-join.lo+1e-8<length)throw Error("扉の幅が共有壁を超過："+template.id+"/"+floor);
   // Use a fractional grid position so a 70–90 cm opening does not grow to 1 m.
   const start=join.lo+(join.hi-join.lo-length)/2;
   const same=doors.filter(d=>d.direction===join.direction&&Math.abs(d.fixed-join.fixed)<1e-8);
   for(const previous of same)if(start<previous.start+previous.length-1e-8&&start+length>previous.start+1e-8)
    throw Error("同じ壁で扉が重複："+template.id+"/"+floor);
   doors.push({direction:join.direction,fixed:join.fixed,start,length,widthCm,external,type});
  };
  for(const [aId,bId,doorType,doorPlacement] of plan.doors){
   const a=roomMap.get(aId),b=roomMap.get(bId),join=a&&b&&shared(a,b);
   if(!join||join.hi-join.lo<1.4)throw Error("間仕切り接続が不正："+template.id+"/"+floor+"/"+aId+"-"+bId);
   const widthCm=widthCmFor(aId,bId,false);
   if(doorPlacement==="end"||doorPlacement==="start"){
    const length=widthCm/50;
    const shifted=doorPlacement==="end"?
     {...join,lo:join.hi-length-.3,hi:join.hi-.3}:
     {...join,lo:join.lo+.3,hi:join.lo+length+.3};
    placeDoor(shifted,widthCm,false,doorType||"hinged");
   }else placeDoor(join,widthCm,false,doorType||"hinged");
  }
  if(plan.entry){
   const entry=roomMap.get(plan.entry);
   if(!entry||entry.y+entry.h!==h||entry.w<1.8)throw Error("外部入口が不正："+template.id);
   placeDoor({direction:"H",fixed:h,lo:entry.x,hi:entry.x+entry.w},90,true,"hinged");
  }
  // Residential daylight/ventilation windows: place openings in the *actual*
  // exterior wall runs, rather than drawing panes on top of solid walls.
  for(const room of rooms){
   const habitable=/LDK|居室|寝室|洋室|和室|書斎/.test(room.name);
   const wet=/浴室|洗面|脱衣|トイレ/.test(room.name);
   if(!habitable&&!wet)continue;
   const length=habitable?2:1.2; // opening width: ~1.0m / frosted ~0.6m
   const options=[];
   if(room.y===0&&room.w>=length+1)options.push({direction:"H",fixed:0,lo:room.x,hi:room.x+room.w});
   if(room.x===0&&room.h>=length+1)options.push({direction:"V",fixed:0,lo:room.y,hi:room.y+room.h});
   if(room.x+room.w===w&&room.h>=length+1)options.push({direction:"V",fixed:w,lo:room.y,hi:room.y+room.h});
   if(room.y+room.h===h&&room.w>=length+1)options.push({direction:"H",fixed:h,lo:room.x,hi:room.x+room.w});
   for(const side of options){
    const start=side.lo+(side.hi-side.lo-length)/2;
    if(doors.some(d=>d.direction===side.direction&&Math.abs(d.fixed-side.fixed)<1e-8&&
     start<d.start+d.length+.25&&start+length>d.start-.25))continue;
    doors.push({...side,start,length,widthCm:length*50,external:true,
     type:"window",privacyGlass:wet});
    break; // One appropriately sized real wall opening per room for now.
   }
  }
  // Build the true continuous wall segments, then subtract precise door gaps.
  // Never round a 0.7–0.9 m door up to two whole 0.5 m cells.
  for(const [map,direction] of [[edgeH,"H"],[edgeV,"V"]]){
   const groups=new Map();
   for(const key of map.keys()){
    const [a,b]=key.split(",").map(Number);
    const fixed=direction==="H"?b:a,pos=direction==="H"?a:b;
    if(!groups.has(fixed))groups.set(fixed,[]);
    groups.get(fixed).push(pos);
   }
   for(const [fixed,positions] of groups){
    positions.sort((a,b)=>a-b);
    const openings=doors.filter(d=>d.direction===direction&&Math.abs(d.fixed-fixed)<1e-8)
      .sort((a,b)=>a.start-b.start);
    for(let i=0;i<positions.length;){
     const first=positions[i];let end=first+1;i++;
     while(i<positions.length&&positions[i]===end){end++;i++}
     const relevant=openings.filter(d=>d.start>=first-1e-8&&d.start+d.length<=end+1e-8);
     let cursor=first;
     const emit=(from,to)=>{
      if(to-from<=1e-8)return;
      const exterior=direction==="H"?(fixed===0||fixed===h):(fixed===0||fixed===w);
      const wallThicknessCm=exterior?wallGuide.outerCm:wallGuide.innerCm;
      push("壁","wall",direction==="H"?line(from,fixed,to,fixed):line(fixed,from,fixed,to),floor,
       {fill:null,stroke:"#d3e6e8",strokeWidth:2},
       {wall:{thickness:wallThicknessCm/50*spacing},
        metadata:{templateId:template.id,generated:true,wallThicknessCm,
         wallRole:exterior?"exterior":"partition",wallThicknessRule:wallGuide.version,
         wallThicknessStatus:"editor-default"}});
     };
     for(const gap of relevant){emit(cursor,gap.start);cursor=gap.start+gap.length}
     emit(cursor,end);
    }
   }
  }
  for(const door of doors){
   // Stair-to-landing connections are genuinely walkable, doorless openings.
   // The wall segment was split above, but no door symbol is created.
   if(door.type==="open")continue;
   const g=door.direction==="H"?line(door.start,door.fixed,door.start+door.length,door.fixed):
    line(door.fixed,door.start,door.fixed,door.start+door.length);
   if(door.type==="window"){
    const win=push(door.privacyGlass?"型板ガラス窓":"外窓","window",g,floor,
     {fill:null,stroke:"#84ddef",strokeWidth:2},
     {detail:door.privacyGlass?"水回り用の目隠し窓（防水・換気連動は未設計）。":
      "採光・通風用の外窓。窓種や開閉・網戸は未設計。"});
    win.opening={kind:"window",external:true,width:door.length*spacing*2*.5};
    win.metadata={...win.metadata,openingWidthCm:door.widthCm,privacyGlass:door.privacyGlass};
    continue;
   }
   const o=push(door.external?"玄関扉":"室内扉","door",g,floor,
    {fill:null,stroke:"#e8b97a",strokeWidth:2},
    {detail:(door.external?"玄関":"室内")+"の開口幅 "+door.widthCm+"cm（建具の有効幅とは別）"});
   o.metadata={...o.metadata,openingWidthCm:door.widthCm};
   o.opening.width=door.widthCm/100*spacing*2;
   if(door.type==="sliding"){o.door.type="sliding";o.door.slideDirection="end"}
   if(door.external){o.opening.kind="entrance";o.opening.external=true}
  }
  // Add essential appliances without changing the authored rooms or fixtures.
  // Coordinates are template cells (one cell = 0.5m). Candidates must fit
  // inside the room, avoid the entrance and existing equipment, and not block doors.
  const furnished=plan.items.map(item=>item.slice());
  const existing=()=>furnished.filter(item=>item[1]!=="stair");
  const intersects=(a,b,padding=0)=>a[2]<b[2]+b[4]+padding&&
   a[2]+a[4]>b[2]-padding&&a[3]<b[3]+b[5]+padding&&
   a[3]+a[5]>b[3]-padding;
  const doorClear=([, ,fx,fy,fw,fh])=>doors.every(door=>{
   const buffer=.35;
   return door.direction==="H"?
    (fy>=door.fixed+buffer||fy+fh<=door.fixed-buffer||
     fx>=door.start+door.length+buffer||fx+fw<=door.start-buffer):
    (fx>=door.fixed+buffer||fx+fw<=door.fixed-buffer||
     fy>=door.start+door.length+buffer||fy+fh<=door.start-buffer);
  });
  const placeAppliance=(name,shape,rooms,dimensions)=>{
   if(shape!=="bed"&&furnished.some(item=>item[1]===shape))return true;
   for(const room of rooms){
    const [rw,rh]=dimensions;
    if(room.w<rw+.3||room.h<rh+.3)continue;
    const candidates=[];
    const step=.25;
    for(let xx=room.x+.15;xx+rw<=room.x+room.w-.15;xx+=step)
     for(let yy=room.y+.15;yy+rh<=room.y+room.h-.15;yy+=step){
      const item=[name,shape,+xx.toFixed(3),+yy.toFixed(3),rw,rh];
      if(!doorClear(item)||existing().some(other=>intersects(item,other,.10)))continue;
      // Near a room edge (with a small service margin) is preferred.
      const edge=Math.min(xx-room.x,yy-room.y,
       room.x+room.w-xx-rw,room.y+room.h-yy-rh);
      const doorProximity=doors.reduce((sum,d)=>{
       const cx=d.direction==="H"?d.start+d.length/2:d.fixed;
       const cy=d.direction==="H"?d.fixed:d.start+d.length/2;
       const dx=xx+rw/2-cx,dy=yy+rh/2-cy;
       return sum+1/(dx*dx+dy*dy+.1);
      },0);
      candidates.push({item,score:edge*10+yy*.002+xx*.001+doorProximity*5});
     }
    if(candidates.length){
     candidates.sort((a,b)=>a.score-b.score);
     furnished.push(candidates[0].item);
     return true;
    }
   }
   return false;
  };
  if(z===0){
   const kitchenRooms=rooms.filter(r=>/LDK|キッチン|居室/.test(r.name));
   placeAppliance("冷蔵庫","refrigerator",kitchenRooms,[1.35,1.35]);
  }
  const washRooms=rooms.filter(r=>/洗面|脱衣|家事/.test(r.name));
  if(z===0&&!furnished.some(item=>item[1]==="washer")){
   const washInstalled=placeAppliance("洗濯機","washer",washRooms,[1.3,1.3]);
   // Compact apartments sometimes place a washer in an indoor kitchen/
   // hall utility recess. Do not force it into a tiny bathroom or toilet.
   if(!washInstalled){
    const utilityRooms=rooms.filter(r=>/家事|キッチン|廊下/.test(r.name)&&
     !/階段/.test(r.name));
    placeAppliance("洗濯機","washer",utilityRooms,[1.3,1.3]);
   }
  }
  // Every bedroom should contain a bed; previously the two flat house
  // designs had rooms labelled bedrooms without any sleeping furniture.
  for(const room of rooms.filter(r=>/主寝室|洋室|寝室/.test(r.name))){
   const hasBed=furnished.some(item=>item[1]==="bed"&&
    item[2]>=room.x&&item[3]>=room.y&&
    item[2]+item[4]<=room.x+room.w&&item[3]+item[5]<=room.y+room.h);
   if(!hasBed){
    placeAppliance("ベッド","bed",[room],[2.2,3.5]);
   }
  }
  // A dedicated washroom needs its own handwash basin; the kitchenette
  // sink alone is not a substitute.
  if(z===0&&!furnished.some(item=>item[1]==="sink")){
   placeAppliance("洗面台","sink",rooms.filter(r=>/洗面|脱衣/.test(r.name)),[1.2,.85]);
  }
  for(const [name,shape,fx,fy,fw,fh,stairPair,stairDirection] of furnished){
   if(fx<0||fy<0||fx+fw>w||fy+fh>h)throw Error("設置物が外周を越える："+name);
   const stair=shape==="stair";
   const stairDesc=stairPair&&["up","down"].includes(stairDirection)
    ?(stairDirection==="up"?"上階へ上る専用階段区間です。":"下階へ下りる専用階段区間です。")+
     "同じ階段区間が上下2フロアに対応します。実際の段数・高さは未設計です。"
    :"折り返し階段の概念図。実際の段数・高さは未設計です。";
   const extra={shapePresetId:shape,detail:shape==="bath"?
    "浴槽・シャワー一体設備。壁付けシャワーを含みます（別個のシャワーブースではありません）。":
    shape==="washer"?"洗濯機（想定幅65cm）。給排水配管は模式図では省略。":
    shape==="refrigerator"?"冷蔵庫（想定設置面積約68cm四方）。扉の開き・放熱余白は未検証。":
    stair?stairDesc:name+"。住戸の生活用設備です。",
    ...(shape==="bath"?{metadata:{templateId:template.id,generated:true,
     attachedShower:true,installationType:"bath-with-shower"}}:{})};
   if(stair&&stairPair&&["up","down"].includes(stairDirection)){
    // A distinct pair of physical flights belongs to exactly two adjacent floors.
    const parts=stairPair.split("-");
    const fromId=parts[0],toId=parts[1];
    const targetId=stairDirection==="up"?toId:fromId;
    if(!floors.some(f=>f.id===targetId)||objFloorIndex(stairPair,floor,stairDirection)<0)
     throw Error("階段接続階が不正："+template.id+"/"+floor+"/"+stairPair);
    extra.stairDesign={type:"switchback-flight",pairId:stairPair,
     direction:stairDirection,flightWidthM:.8,
     footprintWidthM:fw*.5,footprintDepthM:fh*.5,
     status:"concept-not-architecturally-verified"};
    extra.connection={id:prefix+"_stair_"+stairPair,fromFloorId:floor,toFloorId:targetId,
     direction:stairDirection,fromAnchor:at(fx+fw/2,fy+fh/2),toAnchor:at(fx+fw/2,fy+fh/2)};
   }else if(stair){
    extra.stairDesign={type:"switchback",flightWidthM:0.8,landingDepthM:0.85,
     footprintWidthM:fw*.5,footprintDepthM:fh*.5,
     entrySide:"bottom-left",turnSide:"top",exitSide:"bottom-right",
     path:["bottom-left","top-left","top-landing","top-right","bottom-right"],
     status:"concept-not-architecturally-verified"};
    extra.stairNavigation={
     upFloorId:floors[z+1]?.id||null,
     downFloorId:floors[z-1]?.id||null,
     upSide:"left",downSide:"right"
    };
    extra.connection={id:prefix+"_stair_main",fromFloorId:floor,
     toFloorId:floors[z+1]?.id||floors[z-1]?.id,
     fromAnchor:at(fx+fw/2,fy+fh/2),toAnchor:at(fx+fw/2,fy+fh/2),
     direction:z<template.modernPlan.length-1?"up":"down"};
   }
   const placed=push(name,stair?"stair":"object",rect(fx,fy,fw,fh),floor,
    {fill:stair?"rgba(75,118,137,.5)":"rgba(46,91,110,.7)",stroke:"#9ec5ca",strokeWidth:1},extra);
   if(!stair)assignRoomParent(placed,fx,fy,fw,fh);
  }
 }
 // Find a less obstructed swing for each hinged door. This checks the
 // moving leaf against furniture rectangles, not construction clearances.
 for(const doorObj of objs.filter(o=>o.objectType==="door"&&o.door?.type!=="sliding")){
  const [a,b]=doorObj.geometry.points||[];
  if(!a||!b)continue;
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
  if(len<=1e-8)continue;
  const fixtures=objs.filter(o=>o.floorId===doorObj.floorId&&
   o.objectType==="object"&&o.geometry?.type==="rect");
  const candidates=[];
  for(const hinge of ["start","end"])for(const side of ["left","right"]){
   const hpt=hinge==="end"?b:a,far=hinge==="end"?a:b;
   const vx=(far[0]-hpt[0])/len,vy=(far[1]-hpt[1])/len;
   const sign=side==="right"?-1:1,px=-vy*sign,py=vx*sign;
   let penalty=0,hitIds=new Set();
   for(let k=1;k<=12;k++){
    const t=k/12*Math.PI/2,ux=vx*Math.cos(t)+px*Math.sin(t),
     uy=vy*Math.cos(t)+py*Math.sin(t);
    for(let m=1;m<=8;m++){
     const qx=hpt[0]+len*m/8*ux,qy=hpt[1]+len*m/8*uy;
     if(qx<x||qy<y||qx>x+w*spacing||qy>y+h*spacing)penalty+=10;
     for(const item of fixtures){
      const g=item.geometry,eps=spacing*.025;
      if(qx>g.x-eps&&qx<g.x+g.width+eps&&
       qy>g.y-eps&&qy<g.y+g.height+eps)hitIds.add(item.id);
     }
    }
   }
   penalty+=hitIds.size*100;
   // Bottom-facing exterior entry normally opens into the house.
   if(doorObj.opening?.external&&side!=="right")penalty+=5;
   candidates.push({hinge,side,penalty,interferenceCount:hitIds.size});
  }
  candidates.sort((a,b)=>a.penalty-b.penalty||
   (a.hinge==="start"?-1:1)-(b.hinge==="start"?-1:1));
  const best=candidates[0];
  doorObj.door.hinge=best.hinge;
  doorObj.door.swingSide=best.side;
  doorObj.metadata={...doorObj.metadata,
   swingFurnitureInterferenceCount:best.interferenceCount,
   swingChecked:"fixture-rectangles-only"};
  if(best.interferenceCount){
   // When no hinged orientation clears furniture, try a genuine sliding
   // leaf along a continuous adjacent wall (not into another wall opening).
   // Only convert when the parked leaf has a full supporting wall and the
   // park zone does not intersect a nearby furniture rectangle.
   const walls=objs.filter(o=>o.floorId===doorObj.floorId&&o.objectType==="wall");
   const vertical=Math.abs(a[0]-b[0])<1e-8,axis=vertical?1:0,normal=vertical?0:1;
   const low=Math.min(a[axis],b[axis]),high=Math.max(a[axis],b[axis]);
   const size=high-low;
   for(const option of ["start","end"]){
    const lo=option==="start"?low-size:high;
    const hi=option==="start"?low:high+size;
    const coverage=walls.reduce((sum,wall)=>{
     const points=wall.geometry.points;
     if(!points||points.length!==2||points.some(p=>Math.abs(p[normal]-a[normal])>1e-7))return sum;
     return sum+Math.max(0,Math.min(hi,Math.max(points[0][axis],points[1][axis]))-
      Math.max(lo,Math.min(points[0][axis],points[1][axis])));
    },0);
    if(coverage<size-1e-7)continue;
    const blocked=fixtures.some(o=>{
     const g=o.geometry,epsilon=spacing*.09;
     return vertical
      ?g.y<hi&&g.y+g.height>lo&&g.x-epsilon<a[0]&&g.x+g.width+epsilon>a[0]
      :g.x<hi&&g.x+g.width>lo&&g.y-epsilon<a[1]&&g.y+g.height+epsilon>a[1];
    });
    if(blocked)continue;
    doorObj.door.type="sliding";
    doorObj.door.slideDirection=option;
    doorObj.metadata.swingFurnitureInterferenceCount=0;
    doorObj.metadata.swingChecked="sliding-parked-leaf-clear-of-fixtures";
    break;
   }
  }
 }
 // Second pass: resolve hinged-door vs hinged-door swing collisions.
 // Furniture clearance alone misses opposing doors at corridor corners.
 const hinged=objs.filter(o=>o.objectType==="door"&&o.door?.type!=="sliding");
 const segment=(o,t)=>{
  const [a,b]=o.geometry.points,dist=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const pivot=o.door.hinge==="end"?b:a,far=o.door.hinge==="end"?a:b;
  const ux=(far[0]-pivot[0])/dist,uy=(far[1]-pivot[1])/dist;
  const sign=o.door.swingSide==="right"?-1:1;
  const vx=ux*Math.cos(t)-uy*sign*Math.sin(t);
  const vy=uy*Math.cos(t)+ux*sign*Math.sin(t);
  return[pivot,[pivot[0]+dist*vx,pivot[1]+dist*vy]];
 };
 const intersects=(a,b,c,d)=>{
  const orient=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  return orient(a,b,c)*orient(a,b,d)<-1e-8&&orient(c,d,a)*orient(c,d,b)<-1e-8;
 };
 const swingClash=(a,b)=>{
  if(a.floorId!==b.floorId)return false;
  const mid=o=>o.geometry.points.map(p=>p).reduce((v,p)=>[v[0]+p[0]/2,v[1]+p[1]/2],[0,0]);
  const ca=mid(a),cb=mid(b),len=o=>Math.hypot(
   o.geometry.points[0][0]-o.geometry.points[1][0],
   o.geometry.points[0][1]-o.geometry.points[1][1]);
  if(Math.hypot(ca[0]-cb[0],ca[1]-cb[1])>len(a)+len(b))return false;
  for(let i=0;i<=8;i++)for(let j=0;j<=8;j++){
   const [p,q]=segment(a,i*Math.PI/16),[u,v]=segment(b,j*Math.PI/16);
   if(intersects(p,q,u,v))return true;
  }
  return false;
 };
 const furnitureClash=door=>{
  const fixtures=objs.filter(o=>o.floorId===door.floorId&&
   o.objectType==="object"&&o.geometry?.type==="rect");
  for(let i=1;i<=8;i++){
   const [p,q]=segment(door,i*Math.PI/16);
   for(let k=1;k<=8;k++){
    const x=p[0]+(q[0]-p[0])*k/8,y=p[1]+(q[1]-p[1])*k/8;
    if(fixtures.some(f=>{const g=f.geometry,eps=spacing*.025;
     return x>g.x-eps&&x<g.x+g.width+eps&&y>g.y-eps&&y<g.y+g.height+eps;
    }))return true;
   }
  }
  return false;
 };
 for(let round=0;round<3;round++){
  let changed=false;
  for(const door of hinged){
   const adjacent=hinged.filter(o=>o!==door&&o.floorId===door.floorId);
   const conflicts=adjacent.filter(o=>swingClash(door,o));
   if(!conflicts.length)continue;
   const original={hinge:door.door.hinge,swingSide:door.door.swingSide};
   let solved=false;
   for(const hinge of ["start","end"])for(const side of ["left","right"]){
    door.door.hinge=hinge;door.door.swingSide=side;
    if(!furnitureClash(door)&&adjacent.every(o=>!swingClash(door,o))){
     solved=true;break;
    }
   }
   if(!solved){door.door.hinge=original.hinge;door.door.swingSide=original.swingSide}
   else changed=true;
  }
  if(!changed)break;
 }
 for(const door of hinged){
  door.metadata={...door.metadata,swingDoorInterferenceCount:
   hinged.filter(o=>o!==door&&swingClash(door,o)).length};
 }
 // Building services are small, selectable plan symbols. They are ceiling-
 // or wall-mounted, and MUST NOT be treated as furniture occupying walkable
 // floor area; connection routes are schematic and remain unverified.
 const service=(floor,room,name,shape,rx,ry,detail,options={})=>{
  const size=.48,px=Math.min(room.x+room.w-size-.08,Math.max(room.x+.08,rx)),
   py=Math.min(room.y+room.h-size-.08,Math.max(room.y+.08,ry));
  const obj=push(name,"object",rect(px,py,size,size),floor,
   {fill:"rgba(45,89,107,.3)",stroke:"#a2cfde",strokeWidth:.8},
   {shapePresetId:shape,detail,label:{visible:false,text:name},
    metadata:{templateId:template.id,generated:true,buildingService:true,
     ceilingMounted:!!options.ceiling,wallMounted:!!options.wall,
     fixtureCollisionExcluded:true,installationStatus:"schematic-unverified"}});
  obj.label.visible=false;
  // Service symbols are mounted within a room and must follow the room's
  // display hierarchy, while retaining a correct physical floorId.
  const floorIndex=floors.findIndex(f=>f.id===floor);
  const roomZone=template.modernPlan[floorIndex]?.rooms.find(r=>r[0]===room.id);
  const regionObj=roomZone&&objs.find(o=>o.floorId===floor&&o.objectType==="region"&&
   o.name===room.name&&o.geometry?.x===x+room.x*spacing&&o.geometry?.y===y+room.y*spacing);
  if(regionObj){
   obj.parentId=regionObj.id;
   obj.displayLevel=displayLevel+2;
   obj.metadata={...obj.metadata,roomId:room.id};
  }
  return obj;
 };
 for(let z=0;z<template.modernPlan.length;z++){
  const floor=floors[z].id,plan=template.modernPlan[z];
  const rooms=plan.rooms.map(([id,name,x,y,w,h])=>({id,name,x,y,w,h}));
  const active=rooms.filter(r=>/LDK|居室|洋室|寝室|和室|書斎|廊下|ホール|玄関|洗面|脱衣|浴室|トイレ|家事/.test(r.name)&&!/収納|階段/.test(r.name));
  for(const r of active){
   service(floor,r,"天井照明","ceiling_light",r.x+r.w/2-.24,r.y+r.h/2-.24,
    "天井照明の仮位置。照度・電源回路・高さは未設計。",{ceiling:true});
   service(floor,r,"スイッチ","light_switch",r.x+.12,r.y+.12,
    "照明スイッチの仮位置。設置高さと開閉扉との距離は要確認。",{wall:true});
  }
  for(const r of rooms.filter(r=>/LDK|居室|洋室|寝室|和室|書斎/.test(r.name))){
   service(floor,r,"コンセント","power_outlet",r.x+r.w-.7,r.y+.12,
    "電源コンセントの仮位置。回路・負荷・設置高さは未設計。",{wall:true});
   // Only habitable rooms receive cooling. Bathroom/utility rooms are excluded.
   service(floor,r,"エアコン","air_conditioner",r.x+r.w/2-.24,r.y+.12,
    "室内機の仮位置。室外機・配管・室内気流は未設計。",{wall:true});
  }
  for(const r of rooms.filter(r=>/浴室|バス|トイレ|洗面|脱衣/.test(r.name)))
   service(floor,r,"換気扇","ventilation_fan",r.x+r.w-.7,r.y+.12,
    "機械換気の仮位置。ダクト・排気先・必要風量は未検証。",{ceiling:true});
  const kitchen=rooms.find(r=>/LDK|キッチン/.test(r.name));
  if(kitchen&&z===0){
   service(floor,kitchen,"レンジフード","range_hood",kitchen.x+.75,kitchen.y+.15,
    "キッチンの排気フード。コンロとの位置・ダクト外壁貫通は未設計。",{wall:true});
  }
  if(z===0){
   const utility=rooms.find(r=>/洗面|脱衣|家事/.test(r.name))||
    rooms.find(r=>/玄関|ホール/.test(r.name));
   if(utility)service(floor,utility,"給湯器（仮）","water_heater",
    utility.x+.12,utility.y+utility.h-.7,
    "給湯器の模式位置。実際の機種に応じた屋外設置・給排気・配管位置へ変更が必要。",{wall:true});
  }
 }
 return{template:copy(template),objects:objs};
}

const copy=x=>JSON.parse(JSON.stringify(x));
// The AA machine-world templates use a purpose-built, room-accessible draft
// instead of the legacy human-house/generic partition generator. All concrete
// dimensions and layouts here are proposals, not assertions of Notion canon.
// Large forest cultivation is an open landscape, not a corridor-and-four-rooms building.
function generateMiddleLayerFrame(t,options={}){
 const {prefix,parentId=null,displayLevel=4,x=0,y=0,spacing=2,baseName=t.name}=options;
 if(!prefix||!Number.isFinite(spacing)||spacing<=0)throw Error("中層配置枠の指定が不正です");
 const unit=spacing/2; // template grid default 2m/cell; canonical footprint in meters
 const root={id:prefix,name:baseName,objectType:"building",parentId,displayLevel,
  layer:"structures",zIndex:20,geometry:{type:"rect",x,y,width:4000*unit,height:2500*unit},
  visible:true,selectable:true,style:{fill:"rgba(37,73,86,.06)",stroke:"#81aeb8",strokeWidth:3},
  label:{visible:true,text:baseName,fontSize:16},floors:[{id:"1F",label:"中層配置平面"}],
  metadata:{templateId:t.id,generated:true,designStatus:"draft-unverified",coordinateOrigin:"center",meterScale:unit}};
 const sector={id:prefix+"_arbora",name:"自然管理区画《アルボラセクター》",objectType:"region",
  parentId:root.id,displayLevel:displayLevel+1,floorId:"1F",layer:"structures",zIndex:22,
  geometry:{type:"rect",x:x+1100*unit,y:y+1900*unit,width:1500*unit,height:500*unit},
  visible:true,selectable:true,style:{fill:"rgba(57,129,83,.12)",stroke:"#71b488",strokeWidth:2},
  label:{visible:true,text:"アルボラセクター",fontSize:12},
  metadata:{templateId:t.id,generated:true,designStatus:"notion-area-footprint"}};
 const grove=presets.find(v=>v.id==="machine_mid_giant_tree_grove");
 const forest=generateGiantGrove(grove,{prefix:prefix+"_forest",parentId:sector.id,
  displayLevel:displayLevel+2,x:sector.geometry.x+80*unit,y:sector.geometry.y+34*unit,
  spacing:unit*1.15,wallUnitsPerMeter:unit,baseName:"アルボラセクター・大木育成区画"});
 // Keep the forest's draft footprint within the Notion sector; it is not a canonical forest size.
 forest.objects[0].metadata={...forest.objects[0].metadata,designStatus:"draft-unverified",indoorForest:true,
  resourceUses:["燃料用樹液","樹皮","繊維","樹脂","木質素材"],ceilingHeightM:null};
 return{template:t,objects:[root,sector,...forest.objects]};
}

function generateGiantGrove(t,options={}){
 const {prefix,parentId=null,displayLevel=4,x=0,y=0,spacing=2,baseName=t.name}=options;
 if(typeof prefix!=="string"||!prefix||!Number.isFinite(spacing)||spacing<=0)throw Error("大木育成区画の配置指定が不正です");
 const [W,H]=[420,360],objs=[],at=(a,b)=>[x+a*spacing,y+b*spacing],rect=(a,b,w,h)=>({type:"rect",x:x+a*spacing,y:y+b*spacing,width:w*spacing,height:h*spacing});
 const wallUnitsPerMeter=Number.isFinite(options.wallUnitsPerMeter)&&options.wallUnitsPerMeter>0
  ?options.wallUnitsPerMeter:spacing*2;
 let n=0;const add=(name,kind,level,geometry,parent,extra={})=>{
  const o={id:prefix+"_grove_"+(++n),name,objectType:kind,parentId:parent,displayLevel:level,floorId:"1F",layer:kind==="wall"||kind==="door"?"walls":"structures",zIndex:kind==="region"?31:kind==="wall"?47:kind==="door"?49:42,geometry,visible:true,selectable:true,style:kind==="region"?{fill:"rgba(45,124,73,.14)",stroke:"#659e73",strokeWidth:1}:{fill:"rgba(50,125,90,.27)",stroke:"#95bd9b",strokeWidth:1},label:{visible:kind==="region",text:name,fontSize:10},detail:"アルボラセクターの編集用試案。位置・寸法・設備数は未確定。",metadata:{templateId:t.id,generated:true,worldStyle:"machine",designStatus:"draft-unverified"},...extra};objs.push(o);return o;
 };
 const root=add(baseName,"facility",displayLevel,rect(0,0,W,H),parentId,{floors:[{id:"1F",label:"1階",elevation:0,height:3}],detail:"大木を複数育成する森林区画。立体的な樹高と天井高は未確定。仮寸法・仮配置。"});
 root.id=prefix;
 delete root.floorId;
 const zone=(name,a,b,w,h)=>{const z=add(name,"region",displayLevel+1,rect(a,b,w,h),prefix,{shapePresetId:"room_zone"});z.label.position=at(a+w/2,b+h/2);return z};
 const grove=zone("自然林・大木育成域",12,12,W-24,H-30);
 const north=zone("人工降雨・水管理設備帯",12,0,W-24,10);
 const south=zone("資材搬入・検査・管理帯",12,H-16,W-24,16);
 const addObject=(name,shape,zoneObj,a,b,w,h,role)=>add(name,"object",displayLevel+2,rect(a,b,w,h),zoneObj.id,{shapePresetId:shape,label:{visible:false,text:name},metadata:{templateId:t.id,generated:true,worldStyle:"machine",designStatus:"draft-unverified",role}});
 // Naturalistic woodland: clustered stands, irregular clearings and soft winding trails.
 let seed=7331;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const trails=[
  yy=>W*.5+34*Math.sin(yy/57)+19*Math.sin(yy/23),
  yy=>W*.27+24*Math.sin(yy/43+1.4),
  yy=>W*.76+30*Math.sin(yy/65+2.1)
 ];
 const clearings=[[W*.49,H*.42,25,19],[W*.23,H*.68,18,13],[W*.77,H*.27,23,17],[W*.63,H*.78,15,12]];
 const nearTrail=(xx,yy)=>trails.some((fn,i)=>Math.abs(xx-fn(yy))<(i===0?8:5))||
  (Math.abs(yy-(H*.55+13*Math.sin(xx/36)))<4&&xx>W*.25&&xx<W*.77);
 const inClearing=(xx,yy)=>clearings.some(([cx,cy,rx,ry])=>((xx-cx)/rx)**2+((yy-cy)/ry)**2<1);
 let count=0;const planted=[],decorative=[];
 // Uneven clusters, rather than a grid or a maze with tree walls.
 for(let group=0;group<110;group++){
  const cx=19+rand()*(W-38),cy=20+rand()*(H-48),density=5+Math.floor(rand()*6);
  for(let j=0;j<density;j++){
   const xx=cx+(rand()+rand()+rand()-1.5)*30,yy=cy+(rand()+rand()+rand()-1.5)*25;
   if(xx<17||xx>W-17||yy<18||yy>H-25||nearTrail(xx,yy)||inClearing(xx,yy))continue;
   const large=rand()<.18,d=large?11:6+rand()*5;
   if(planted.some(([tx,ty,td])=>(xx-tx)**2+(yy-ty)**2<((d+td)*.43)**2))continue;
   planted.push([xx,yy,d]);
   count++;
   if(large&&count%3===0)addObject("重要巨木 "+count,"tree_giant",grove,xx-d/2,yy-d/2,d,d,"cultivated-tree");
   else decorative.push([xx,yy,d,rand()<.16?1:0]);
  }
 }
 // Decorative canopy is drawn in a single lightweight scene object; significant trees remain editable.
 add("森林の樹冠群","object",displayLevel+2,rect(12,12,W-24,H-30),grove.id,{shapePresetId:"forest_canopy_cluster",selectable:false,layer:"structures",zIndex:39,label:{visible:false,text:""},forestCanopies:decorative.map(([xx,yy,d,needle])=>[xx*spacing+x,yy*spacing+y,d*spacing,needle]),metadata:{templateId:t.id,generated:true,role:"forest-canopy-batch",designStatus:"draft-unverified"}});
 for(let i=0;i<9;i++)addObject("人工降雨制御端末","terminal_device",north,20+i*44,3,3,3,"rain-control");
 for(let i=0;i<8;i++)addObject("水循環・排水監視端末","terminal_device",south,24+i*45,H-11,3,3,"water-monitor");
 addObject("搬入資材保管","storage_container",south,W-36,H-12,10,7,"materials");
 // Giant enclosed halls use a fixed provisional *display* thickness, not
 // a calculated structural section; the physical design is still unresolved.
 const groveWallThicknessCm=60;
 for(const [a,b,c,d] of [[0,0,W,0],[0,0,0,H],[W,0,W,H],[0,H,W/2-6,H],[W/2+6,H,W,H]]){
  add("外周区画壁","wall",displayLevel+1,{type:"polyline",points:[at(a,b),at(c,d)]},prefix,{
   wall:{thickness:groveWallThicknessCm/100*wallUnitsPerMeter},
   metadata:{templateId:t.id,generated:true,worldStyle:"machine",designStatus:"draft-unverified",
    wallThicknessCm:groveWallThicknessCm,wallRole:"exterior",wallUnitsPerMeter,
    wallThicknessRule:"large-sector-provisional-v1",wallThicknessStatus:"special-draft"}
  });
 }
 add("森林区画入口","door",displayLevel+1,{type:"polyline",points:[at(W/2-6,H),at(W/2+6,H)]},prefix,{door:{hinge:"start",swing:"inward",state:"closed",type:"sliding",slideDirection:"end"},opening:{kind:"entrance",width:12*spacing,external:true}});
 return{template:copy(t),objects:objs};
}

function generateWeaponsYard(t,options={}){
 const {prefix,parentId=null,displayLevel=4,x=0,y=0,spacing=2,baseName=t.name}=options;
 if(typeof prefix!=="string"||!prefix||!Number.isFinite(spacing)||spacing<=0)
  throw Error("兵器場テンプレートの配置指定が不正です");
 const [W,H]=t.cells,objects=[],floorId="1F";
 const at=(a,b)=>[x+a*spacing,y+b*spacing];
 const rect=(a,b,w,h)=>({type:"rect",x:x+a*spacing,y:y+b*spacing,width:w*spacing,height:h*spacing});
 const line=(a,b,c,d)=>({type:"polyline",points:[at(a,b),at(c,d)]});
 const guide=wallThicknessGuide(t,{strength:"sturdy"});
 const baseMeta={templateId:t.id,generated:true,worldStyle:"machine",
  notionStatus:"layout-proposal",designStatus:"draft-unverified"};
 let count=0;
 const add=(name,kind,geometry,extra={})=>{
  const o={
   id:prefix+"_weapons_"+(++count),name,parentId:prefix,objectType:kind,
   displayLevel:displayLevel+1,floorId,
   layer:kind==="wall"||kind==="door"?"walls":"structures",
   zIndex:kind==="slab"?29:kind==="region"?31:kind==="wall"?47:kind==="door"?49:43,
   geometry,visible:true,selectable:kind!=="slab",
   style:kind==="wall"?{stroke:"#c8dce3",strokeWidth:1.8}:
    kind==="door"?{stroke:"#e2b16d",strokeWidth:2}:
    kind==="region"?{fill:"rgba(72,103,129,.15)",stroke:"#7291a4",strokeWidth:1}:
    {fill:"rgba(83,122,139,.37)",stroke:"#99bdc9",strokeWidth:1},
   label:{visible:kind==="region",text:name,fontSize:9},
   detail:name+"（中層兵器場の編集用仮配置。Notionで確定した構造ではありません）",
   metadata:{...baseMeta},...extra
  };
  objects.push(o);return o;
 };
 objects.push({
  id:prefix,name:baseName,parentId,objectType:"facility",displayLevel,
  layer:"subregions",zIndex:30,geometry:rect(0,0,W,H),
  floors:[{id:floorId,label:"1階（仮）",elevation:0,height:3}],
  visible:true,selectable:true,
  style:{fill:"rgba(67,104,125,.13)",stroke:"#a1c6d3",strokeWidth:1.8},
  label:{visible:true,text:baseName,position:at(W/2,H/2),fontSize:12},
  detail:t.description,metadata:{...baseMeta,layoutStatus:"draft-only"}
 });
 add("床面","slab",rect(0,0,W,H),{selectable:false});
 const wall=(a,b,c,d,exterior=false)=>{
  if(Math.hypot(c-a,d-b)<=1e-8)return;
  const cm=exterior?guide.outerCm:guide.innerCm;
  add(exterior?"外周壁":"区画壁","wall",line(a,b,c,d),{
   wall:{thickness:cm/50*spacing},
   metadata:{...baseMeta,wallRole:exterior?"exterior":"partition",
    wallThicknessCm:cm,wallThicknessRule:guide.version,wallThicknessStatus:"editor-default"}
  });
 };
 const door=(a,b,c,d,external=false)=>{
  add(external?"兵器場・搬入出入口":"区画扉","door",line(a,b,c,d),{
   door:{hinge:"start",swing:"inward",state:"closed",type:"sliding",slideDirection:"end"},
   opening:{kind:external?"entrance":"interior",width:Math.hypot(c-a,d-b)*spacing,external}
  });
 };
 const cL=34,cR=46,band=H/3,rooms=new Map();
 const areas=[
  ["部品受入・検品区",0,0,cL,band,"incoming"],
  ["武装組立区",0,band,cL,band,"assembly"],
  ["加工・調整区",0,band*2,cL,band,"processing"],
  ["完成兵器保管区",cR,0,W-cR,band,"storage"],
  ["試験・安全検査区",cR,band,W-cR,band,"testing"],
  ["整備・制御区",cR,band*2,W-cR,band,"control"]
 ];
 for(const [name,xx,yy,ww,hh,role] of areas){
  const room=add(name,"region",rect(xx,yy,ww,hh),{
   shapePresetId:"room_zone",metadata:{...baseMeta,role}
  });
  room.label.position=at(xx+ww/2,yy+hh/2);
  rooms.set(role,room);
 }
 const corridor=add("中央搬送・通行路","region",rect(cL,0,cR-cL,H),{
  shapePresetId:"room_zone",metadata:{...baseMeta,role:"transfer-corridor"}
 });
 corridor.label.position=at((cL+cR)/2,H/2);
 // Cargo doors at both ends of the central lane; no solid wall beneath a door.
 const gap=5;
 wall(0,0,W/2-gap,0,true);door(W/2-gap,0,W/2+gap,0,true);
 wall(W/2+gap,0,W,0,true);wall(0,0,0,H,true);wall(W,0,W,H,true);
 wall(0,H,W/2-gap,H,true);door(W/2-gap,H,W/2+gap,H,true);
 wall(W/2+gap,H,W,H,true);
 // Six distinct room doors into the 6 m wide central movement lane.
 for(const xx of [cL,cR])for(const cy of [band/2,band*1.5,band*2.5]){
  const half=3;
  wall(xx,cy-band/2,xx,cy-half);
  door(xx,cy-half,xx,cy+half);
  wall(xx,cy+half,xx,cy+band/2);
 }
 // Dividers prevent direct access between storage/testing and fabrication bays.
 for(const xx of [0,cR])for(const yy of [band,band*2])wall(xx,yy,xx+cL,yy);
 const fixture=(role,name,shape,a,b,w,h)=>{
  const room=rooms.get(role);
  add(name,"object",rect(a,b,w,h),{
   parentId:room.id,displayLevel:displayLevel+2,shapePresetId:shape,
   label:{visible:false,text:name},
   metadata:{...baseMeta,role:"draft-fixture"}
  });
 };
 fixture("incoming","部品受入台","workbench",5,4,11,5);
 fixture("incoming","検品・計測端末","terminal_device",23,6,5,4);
 fixture("assembly","組立作業台A","workbench",4,band+6,9,5);
 fixture("assembly","組立作業台B","workbench",19,band+6,9,5);
 fixture("processing","装備調整台","workbench",7,band*2+7,12,6);
 fixture("processing","工具保管棚","tool_cabinet",24,band*2+7,5,4);
 fixture("storage","完成兵器保管棚","shelf",cR+5,5,11,5);
 fixture("storage","搬出品登録端末","terminal_device",cR+24,7,5,4);
 fixture("testing","検査台","workbench",cR+8,band+6,11,6);
 fixture("testing","安全監視端末","terminal_device",cR+25,band+6,5,4);
 fixture("control","設備制御端末","terminal_device",cR+8,band*2+7,6,4);
 fixture("control","補修工具棚","tool_cabinet",cR+22,band*2+7,7,4);
 return{template:copy(t),objects};
}

function generateRegistlinkDome(t,options={}){
 // Rebuild from rebuild/scenes/middle.scene.json. Rectangular root is
 // a transparent editing wrapper; the actual terminal and dome are circular.
 const {prefix,parentId=null,displayLevel=4,x=0,y=0,spacing=2,baseName=t.name}=options;
 if(!prefix||!Number.isFinite(spacing)||spacing<=0)throw Error("ドームの配置指定が不正です");
 const unit=spacing*2,C=[x+250*unit,y+250*unit],pi=Math.PI,objects=[],floorId="1F";
 const m=n=>n*unit,pos=(r,a)=>[C[0]+m(r)*Math.cos(a),C[1]+m(r)*Math.sin(a)];
 const rect=(cx,cy,w,h)=>({type:"rect",x:C[0]+m(cx-w/2),y:C[1]+m(cy-h/2),width:m(w),height:m(h)});
 const meta={templateId:t.id,generated:true,worldStyle:"machine",designStatus:"draft-unverified",
  sourceScene:"rebuild/scenes/middle.scene.json",coordinateStatus:"initial-draft"};
 const guide=wallThicknessGuide(t,{strength:"sturdy"});
 const root={id:prefix,name:baseName,objectType:"facility",parentId,displayLevel,
  layer:"subregions",zIndex:18,geometry:{type:"rect",x,y,width:m(500),height:m(500)},
  floors:[{id:floorId,label:"中層・1階仮平面",elevation:0,height:8}],visible:true,selectable:true,
  style:{fill:null,stroke:null},label:{visible:false,text:baseName},detail:t.description,
  metadata:{...meta,rectIsEditBoundsOnly:true,layoutMode:"terminal-integrated-ring"}};
 objects.push(root);let counter=0;
 const add=(name,kind,geometry,extra={})=>{
  const parent=extra.parentId||prefix,level=extra.displayLevel||displayLevel+1;
  const obj={id:prefix+"_guild_"+(++counter),name,objectType:kind,parentId:parent,
   displayLevel:level,floorId,
   layer:kind==="wall"||kind==="door"?"walls":kind==="route"?"routes":"structures",
   zIndex:kind==="wall"?47:kind==="door"?50:kind==="route"?48:kind==="region"?31:42,
   geometry,visible:true,selectable:true,
   style:kind==="wall"?{stroke:"#bad5df",strokeWidth:1.5}:
    kind==="door"?{stroke:"#ead09e",strokeWidth:2}:
    kind==="route"?{stroke:"#97d1d8",strokeWidth:2}:
    {fill:"rgba(70,115,141,.16)",stroke:"#84b0c1",strokeWidth:1},
   label:{visible:kind==="region",text:name,fontSize:9},
   detail:name+"（現行GitHub中層マップ準拠・内部の細部は編集用試案）",
   metadata:{...meta,...(extra.metadata||{})}};
  for(const key of ["style","label","wall","door","opening","shapePresetId"])
   if(Object.prototype.hasOwnProperty.call(extra,key))obj[key]=extra[key];
  objects.push(obj);return obj;
 };
 const terminal=add("リンクターミナル・中央交通施設","region",
  {type:"circle",center:C.slice(),radius:m(250)},{
   style:{fill:"rgba(48,91,111,.08)",stroke:"#a2bfc9",strokeWidth:2},
   metadata:{role:"central-terminal",sourceObjectId:"middle_terminal"},
   label:{visible:true,text:"リンクターミナル",position:pos(234,-pi/2),fontSize:11}
  });
 const dome=add("レジストリンク・ドーム・円環区","region",
  {type:"ring",center:C.slice(),innerRadius:m(130),outerRadius:m(210)},{
   parentId:terminal.id,displayLevel:displayLevel+2,
   style:{fill:"rgba(68,128,153,.26)",stroke:"#c6e1e6",strokeWidth:2},
   label:{visible:true,text:"レジストリンク・ドーム",position:pos(215,-pi/2),fontSize:11},
   metadata:{role:"guild-ring",sourceObjectId:"resist_link_dome",innerRadiusM:130,outerRadiusM:210}
  });
 const core=add("中央リフト乗降ホール","region",
  {type:"circle",center:C.slice(),radius:m(123)},{
   parentId:terminal.id,displayLevel:displayLevel+2,
   style:{fill:"rgba(43,91,105,.23)",stroke:"#a4cbd1",strokeWidth:2},
   label:{visible:true,text:"中央リフト乗降ホール",position:C.slice(),fontSize:10},
   metadata:{role:"lift-hall",positionStatus:"draft"}
  });
 const liftZones={};
 for(const [name,cx,cy,w,h,role] of [
  ["一般リフト・乗降区",-55,0,60,44,"passenger-elevators"],
  ["大型機用リフト・乗降区",55,0,65,55,"heavy-machine-elevators"]
 ]){
  const zone=add(name,"region",rect(cx,cy,w,h),{
   parentId:core.id,displayLevel:displayLevel+3,
   label:{visible:true,text:name,position:[C[0]+m(cx),C[1]+m(cy)],fontSize:9},
   metadata:{role,positionStatus:"draft",dimensionsM:[w,h],gridCells:[w*2,h*2]}
  });
  liftZones[role]=zone.id;
 }
 // Distinguish a physical lift shaft from its much larger boarding hall.
 for(const [name,cx,cy,w,h,role,group,height] of [
  ["一般リフト1",-72,-11,8,10,"passenger-lift-shaft","passenger-elevators",7],
  ["一般リフト2",-44,-11,8,10,"passenger-lift-shaft","passenger-elevators",7],
  ["一般リフト3",-72,11,8,10,"passenger-lift-shaft","passenger-elevators",7],
  ["一般リフト4",-44,11,8,10,"passenger-lift-shaft","passenger-elevators",7],
  ["大型機リフト1",38,0,12,16,"heavy-lift-shaft","heavy-machine-elevators",8],
  ["大型機リフト2",72,0,12,16,"heavy-lift-shaft","heavy-machine-elevators",8]
 ]){
  add(name,"region",rect(cx,cy,w,h),{
   parentId:liftZones[group],displayLevel:displayLevel+4,
   style:{fill:"rgba(91,153,167,.3)",stroke:"#c6e4e6",strokeWidth:1.3},
   label:{visible:true,text:name,position:[C[0]+m(cx),C[1]+m(cy)],fontSize:8},
   metadata:{role,dimensionsM:[w,h],gridCells:[w*2,h*2],clearHeightM:height,shaftCount:1,positionStatus:"draft"}
  });
 }
 // Public inner ring, controlled operating ring, outer maintenance service.
 for(const [name,r0,r1,role,color,access] of [
  ["内側環状コンコース（幅16m）",130,146,"public-ring","rgba(120,182,192,.2)","public"],
  ["業務連絡環状通路（幅8m）",174,182,"staff-ring","rgba(91,144,164,.19)","controlled"],
  ["外周設備保守帯（幅6m）",204,210,"maintenance-ring","rgba(81,111,128,.18)","staff-only"]
 ]){
  add(name,"region",{type:"ring",center:C.slice(),innerRadius:m(r0),outerRadius:m(r1)},{
   parentId:dome.id,displayLevel:displayLevel+3,
   style:{fill:color,stroke:"#98bcc7",strokeWidth:1},
   label:{visible:false,text:name},
   metadata:{role,clearWidthM:r1-r0,gridWidthCells:(r1-r0)*2,access}
  });
 }
 // All room widths and depths below are exact metres, 2 cells per metre.
 const point=(r,t,a)=>[C[0]+m(r*Math.cos(a)-t*Math.sin(a)),C[1]+m(r*Math.sin(a)+t*Math.cos(a))];
 const roomCorners=(r,a,w,d)=>[
  point(r-d/2,-w/2,a),point(r-d/2,w/2,a),
  point(r+d/2,w/2,a),point(r+d/2,-w/2,a)];
 const roomRecords=[];
 const room=(name,r,a,w,d,role,opts={})=>{
  const controlled=Boolean(opts.controlled),doorW=opts.doorW??(w<=8?4:6),
   doorH=opts.doorH??6,cm=opts.wallCm??(controlled?35:25);
  if([r,w,d,doorW,doorH].some(v=>!Number.isFinite(v)||v<=0)||
   w*2%1||d*2%1||doorW>w-2)throw Error("部屋・扉の実寸が不正: "+name);
  const pts=roomCorners(r,a,w,d),region=add(name,"region",{type:"polygon",points:pts},{
   parentId:opts.parentId||dome.id,displayLevel:displayLevel+4,
   style:{fill:controlled?"rgba(115,105,141,.23)":"rgba(72,139,158,.25)",
    stroke:controlled?"#b5a5c7":"#95c0cb",strokeWidth:1},
   label:{visible:true,text:name,position:pos(r,a),fontSize:8},
   detail:name+"。"+w+"×"+d+"m（"+(w*2)+"×"+(d*2)+"マス）。編集用の仮間取り。",
   metadata:{role,dimensionsM:[w,d],gridCells:[w*2,d*2],
    clearHeightM:Math.max(6,doorH+.5),access:controlled?"restricted":"public",
    ...(opts.metadata||{})}
  });
  // Actual room walls split around the entrance on its inward face.
  const inner=r-d/2,L=point(inner,-w/2,a),DL=point(inner,-doorW/2,a),
   DR=point(inner,doorW/2,a),R=point(inner,w/2,a);
  const wall=(p,q)=>{
   if(Math.hypot(p[0]-q[0],p[1]-q[1])<1e-7)return;
   add("区画壁","wall",{type:"polyline",points:[p,q]},{
    parentId:region.id,displayLevel:displayLevel+5,
    wall:{thickness:m(cm/100)},label:{visible:false,text:""},
    metadata:{role:"room-wall",wallThicknessCm:cm,wallRole:"partition",
     wallThicknessRule:"guild-room-detail-v1",wallThicknessStatus:"editor-default"}
   });
  };
  for(const [p,q] of [[L,DL],[DR,R],[pts[1],pts[2]],[pts[2],pts[3]],[pts[3],pts[0]]])wall(p,q);
  add(name+"・出入口","door",{type:"polyline",points:[DL,DR]},{
   parentId:region.id,displayLevel:displayLevel+5,
   door:{type:"sliding",slideDirection:"end",state:"closed"},
   opening:{kind:"interior",external:false,width:m(doorW),clearHeightM:doorH},
   label:{visible:false,text:""},
   metadata:{role:"room-door",clearWidthM:doorW,clearHeightM:doorH,
    gridWidthCells:doorW*2,accessControl:controlled?"restricted":"public"}
  });
  roomRecords.push({name,role,r,a,w,d,pts});
  return region;
 };
 const centers=Array.from({length:8},(_,i)=>-pi/2+(i+.5)*pi/4);
 const commonOrSpecial=["common","common","alchimeria","common","common","common","bionome","common"];
 for(let i=0;i<8;i++){
  const kind=commonOrSpecial[i],name=kind==="common"?"共通任務受付"+(i+1):
   kind==="alchimeria"?"アルキメリア専門相談受付":"バイオノーム専門相談受付";
  const reception=room(name,159.5,centers[i],20,24,"reception",{
   doorW:8,doorH:7,metadata:{receptionIndex:i+1,receptionType:kind,
    officialSystem:"HOST",services:kind==="common"?
    ["依頼検索","資格照合","受注・報告","報酬・実績処理"]:
    kind==="alchimeria"?["鑑定・再設計相談","素材収集依頼"]:
     ["栽培・採取相談","生物回収・捕獲依頼"]}
  });
  add(name+"・受付カウンター","object",
   {type:"polygon",points:roomCorners(163,centers[i],8,2)},{
   parentId:reception.id,displayLevel:displayLevel+5,
   style:{fill:"rgba(131,175,186,.72)",stroke:"#c6dfe3",strokeWidth:1},
   label:{visible:false,text:""},metadata:{role:"reception-counter",dimensionsM:[8,2],gridCells:[16,4]}
  });
  room("受付"+(i+1)+"・小作戦室",193,centers[i],12,16,"small-briefing",{
   doorW:6,doorH:6,metadata:{linkedReception:i+1}
  });
 }
 // Fill the inner ring without hiding doors behind one another or the main axes.
 const mainAngles=[0,pi/2,pi,3*pi/2];
 const angularDistance=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
 const innerRooms=()=>roomRecords.filter(o=>o.r<175);
 const nextOpenAngle=(desired,width,name)=>{
  for(let n=0;n<220;n++){
   const delta=n===0?0:(n%2?1:-1)*Math.ceil(n/2)*.025;
   const ang=desired+delta;
   if(mainAngles.some(a=>angularDistance(ang,a)*159<width/2+10))continue;
   if(innerRooms().some(o=>angularDistance(ang,o.a)*159<(width+o.w)/2+3))continue;
   return ang;
  }
  throw Error("内側円環のスペース不足: "+name);
 };
 for(let i=0;i<4;i++){
  const name="共用待機スペース"+(i+1);
  room(name,159,nextOpenAngle(-pi/4+i*pi/2,26,name),26,16,"public-waiting",{doorW:8,doorH:7});
 }
 for(const [i,name,role] of [
  [2,"アルキメリア鑑定・技術相談室","alchimeria-consult"],
  [6,"バイオノーム採取・生物任務相談室","bionome-consult"]
 ]){
  room(name,159,nextOpenAngle(centers[i]+.19,24,name),24,20,role,{doorW:8,doorH:7});
 }
 for(const [name,preferred,role] of [
  ["詳細任務報告室1",-.18,"report-detail"],["詳細任務報告室2",2.76,"report-detail"],
  ["回収品提出・査定室1",-.5,"appraisal"],["回収品提出・査定室2",2.45,"appraisal"],
  ["報酬物資引渡室1",1.32,"reward-handoff"],["報酬物資引渡室2",4.44,"reward-handoff"]
 ]){
  room(name,159,nextOpenAngle(preferred,20,name),20,20,role,{doorW:8,doorH:7});
 }
 // Outer operating band 182–204m. Each quadrant has independent office,
 // briefing, storage and security rooms with access from the 8m service ring.
 const sectors=[
  [["中規模戦術室1",20,16,"medium-briefing"],["分隊本部1",20,20,"squad-headquarters"],["個別通信ブース1",8,10,"private-comms"],["一般素材・回収品倉庫1",30,20,"common-storage"],["警備兵待機室1",24,20,"guard-ready"]],
  [["中規模戦術室2",20,16,"medium-briefing"],["分隊本部2",20,20,"squad-headquarters"],["個別通信ブース2",8,10,"private-comms"],["装備一時保管庫1",24,20,"equipment-storage"],["非常用待避室1",12,16,"emergency-shelter"]],
  [["中規模戦術室3",20,16,"medium-briefing"],["分隊本部3",20,20,"squad-headquarters"],["個別通信ブース3",8,10,"private-comms"],["一般素材・回収品倉庫2",30,20,"common-storage"],["警備兵待機室2",24,20,"guard-ready"]],
  [["中規模戦術室4",20,16,"medium-briefing"],["分隊本部4",20,20,"squad-headquarters"],["個別通信ブース4",8,10,"private-comms"],["装備一時保管庫2",24,20,"equipment-storage"],["データ・通信設備室1",16,20,"data-comms"],["非常用待避室2",12,16,"emergency-shelter"]],
  [["大会議室1",32,20,"large-conference"],["個別通信ブース5",8,10,"private-comms"],["報酬物資保管庫1",24,20,"reward-storage"],["警備兵待機室3",24,20,"guard-ready"]],
  [["大会議室2",32,20,"large-conference"],["個別通信ブース6",8,10,"private-comms"],["報酬物資保管庫2",24,20,"reward-storage"],["非常用待避室3",12,16,"emergency-shelter"]],
  [["個別通信ブース7",8,10,"private-comms"],["危険物密閉一時保管室",20,20,"hazard-storage"],["データ・通信設備室2",16,20,"data-comms"],["警備兵待機室4",24,20,"guard-ready"]],
  [["個別通信ブース8",8,10,"private-comms"],["生物密閉一時保管室",20,20,"bio-storage"],["非常用待避室4",12,16,"emergency-shelter"],["施設管理・監視室",20,20,"security-control"]]
 ];
 for(let i=0;i<8;i++){
  const sorted=sectors[i].sort((a,b)=>b[1]-a[1]);
  let left=9,right=9;
  for(const [name,w,d,role] of sorted){
   const L=left<=right,offset=(L?left:right)+w/2;
   if(offset+w/2>71)throw Error("外周円環の部屋間隔が不足: "+name);
   const ang=centers[i]+(L?-1:1)*offset/193;
   const controlled=["guard-ready","common-storage","equipment-storage","reward-storage",
    "hazard-storage","bio-storage","data-comms","security-control"].includes(role);
   const sealed=role==="hazard-storage"||role==="bio-storage";
   const doorW=sealed?10:role==="guard-ready"?8:role==="private-comms"?4:
    role.endsWith("storage")?10:6;
   const doorH=sealed?8:role==="guard-ready"?7:6;
   const loc=room(name,193,ang,w,d,role,{controlled,doorW,doorH,
    wallCm:sealed?100:controlled?35:25,
    metadata:role==="guard-ready"?{securityDuty:"armed-guard-standby",
     maxGuardHeightM:4,equipmentAndCharging:"draft",
     rapidResponseSector:i+1}:{}});
   if(role==="guard-ready"){
    add(name+"・警備装備／充電ステーション","object",
     {type:"polygon",points:roomCorners(198,ang,8,4)},{
      parentId:loc.id,displayLevel:displayLevel+5,
      label:{visible:false,text:""},
      style:{fill:"rgba(132,155,166,.58)",stroke:"#bdd2db",strokeWidth:1},
      metadata:{role:"guard-ready-equipment",dimensionsM:[8,4],gridCells:[16,8]}});
   }
   if(L)left+=w+3;else right+=w+3;
  }
 }
 // Four axial circulation links, measured in real 0.5m grid cells.
 const gateways=[0,pi/2,pi,3*pi/2].map((angle,i)=>({
  angle,heavy:i%2===0,widthM:i%2===0?12:8,heightM:i%2===0?8:7}));
 for(let i=0;i<4;i++){
  const g=gateways[i],half=g.widthM/2;
  add((g.heavy?"大型機":"一般")+"リフト接続通路"+(i+1),"route",{
   type:"polygon",points:[point(95,-half,g.angle),point(245,-half,g.angle),
    point(245,half,g.angle),point(95,half,g.angle)]},{
   parentId:terminal.id,displayLevel:displayLevel+3,
   style:{fill:g.heavy?"rgba(157,126,192,.24)":"rgba(110,185,180,.22)",
    stroke:g.heavy?"#ba9edd":"#97d5d1",strokeWidth:1},
   label:{visible:false,text:""},
   metadata:{role:g.heavy?"heavy-machine-passage":"general-passage",
    clearWidthM:g.widthM,clearHeightM:g.heightM,gridWidthCells:g.widthM*2,
    connectedRadiusRangeM:[95,245],routeStatus:"draft"}});
  add("警備認証ゲート"+(i+1),"region",{type:"polygon",points:roomCorners(139,g.angle,g.widthM+4,8)},{
   parentId:dome.id,displayLevel:displayLevel+4,
   label:{visible:true,text:"警備"+(i+1),position:pos(139,g.angle),fontSize:8},
   style:{fill:"rgba(176,144,95,.14)",stroke:"#cfb38b",strokeWidth:1},
   metadata:{role:"security-checkpoint",clearWidthM:g.widthM,clearHeightM:g.heightM,
    accessControl:"HOST-managed",positionStatus:"draft"}});
 }
 const arcWall=(radius,from,to,outer)=>{
  const points=[],N=18,cm=60;
  for(let i=0;i<=N;i++)points.push(pos(radius,from+(to-from)*i/N));
  add(outer?"円環外周構造壁":"円環内周構造壁","wall",{type:"polyline",points},{
   parentId:dome.id,displayLevel:displayLevel+3,
   wall:{thickness:m(cm/100)},label:{visible:false,text:""},
   metadata:{role:"ring-structural-wall",wallRole:outer?"exterior":"partition",
    wallThicknessCm:cm,wallThicknessRule:"guild-ring-structural-v2",
    wallThicknessStatus:"editor-default",gridThicknessCells:cm/50}
  });
 };
 // Different radii must get the SAME physical clear opening, not equal angular spans.
 for(const radius of [130,210]){
  const gateArcs=gateways.map(g=>({...g,half:Math.asin(g.widthM/(2*radius))}));
  for(let i=0;i<4;i++){
   const g=gateArcs[i],next=gateArcs[(i+1)%4];
   arcWall(radius,g.angle+g.half,next.angle+(i===3?2*pi:0)-next.half,radius===210);
   const a=pos(radius,g.angle-g.half),b=pos(radius,g.angle+g.half);
   const actual=Math.hypot(a[0]-b[0],a[1]-b[1])/unit;
   if(Math.abs(actual-g.widthM)>1e-7)throw Error("円環ゲート有効幅の計算誤差");
   add((g.heavy?"大型機":"一般")+(radius===130?"内側":"外側")+"出入口"+(i+1),
    "door",{type:"polyline",points:[a,b]},{
    parentId:dome.id,displayLevel:displayLevel+3,
    door:{type:"sliding",slideDirection:"end",state:"closed"},
    opening:{kind:"entrance",external:radius===210,width:m(g.widthM),clearHeightM:g.heightM},
    label:{visible:false,text:""},
    metadata:{role:g.heavy?"heavy-machine-access":"passenger-access",
     clearWidthM:g.widthM,clearHeightM:g.heightM,
     gridWidthCells:g.widthM*2,sourceLayout:"middle.scene.json",dimensionStatus:"draft"}
   });
  }
 }
 return{template:copy(t),objects};
}

function generateMachine(t,options={}){
 const {prefix,parentId=null,displayLevel=4,x=0,y=0,spacing=2,baseName=t.name}=options;
 if(!prefix||!Number.isFinite(spacing)||spacing<=0)throw Error("機械施設の配置指定が不正です");
 const [W,H]=t.cells,objs=[],floors=Array.from({length:t.floors},(_,i)=>({id:(i+1)+"F",label:(i+1)+"階",elevation:i*3,height:3}));
 const wallGuide=wallThicknessGuide(t,{strength:"sturdy"});
 const at=(a,b)=>[x+a*spacing,y+b*spacing],rect=(a,b,w,h)=>({type:"rect",x:x+a*spacing,y:y+b*spacing,width:w*spacing,height:h*spacing});
 let serial=0;
 const add=(name,kind,f,geo,extra={})=>{
  const obj={id:prefix+"_machine_"+(++serial),name,objectType:kind,
   parentId:prefix,displayLevel:displayLevel+1,floorId:f,
   layer:kind==="wall"||kind==="door"?"walls":"structures",
   zIndex:kind==="slab"?29:kind==="region"?31:kind==="wall"?47:kind==="door"?49:kind==="stair"?46:42,
   geometry:geo,visible:true,selectable:kind!=="slab",
   style:kind==="wall"?{stroke:"#cadfe6",strokeWidth:1.8}:
    kind==="door"?{stroke:"#e8b97a",strokeWidth:1.8}:
    kind==="region"?{fill:"rgba(68,113,128,.13)",stroke:null}:
    {fill:"rgba(49,100,120,.32)",stroke:"#9ac1cd",strokeWidth:1},
   label:{visible:kind==="region",text:name,fontSize:8},
   detail:name+"。AA機械施設の間取り試案。個別寸法・運用は要検証。",
   metadata:{templateId:t.id,generated:true,worldStyle:"machine",designStatus:"draft-unverified"},...extra};
  if(kind==="region")obj.label.position=at(geo.x/spacing-x/spacing+geo.width/spacing/2,geo.y/spacing-y/spacing+geo.height/spacing/2);
  objs.push(obj);return obj;
 };
 const root={id:prefix,name:baseName,parentId,displayLevel,objectType:"facility",
  layer:"subregions",zIndex:30,geometry:rect(0,0,W,H),floors,
  visible:true,selectable:true,style:{fill:"rgba(67,113,133,.13)",stroke:"#a2d1dd",strokeWidth:1.3},
  label:{visible:true,text:baseName,position:at(W/2,H/2),fontSize:11},
  detail:t.description+"。間取りと設備の配置はNotion確定施設図ではなく編集用試案。",
  metadata:{templateId:t.id,generated:true,worldStyle:"machine",designStatus:"draft-unverified"}};
 objs.push(root);
 const corridorW=4,cL=Math.floor((W-corridorW)/2),cR=cL+corridorW;
 const leftW=cL,rightW=W-cR;
 const topH=Math.max(6,Math.floor(H*.50)),bottomH=H-topH;
 const roomNames=t.roomNames||(t.facilityMode==="pods"?["休眠区画A","休眠区画B","休眠区画C","休眠区画D"]:
  t.facilityMode==="housing"||["machine_residence","machine_rest"].includes(t.id)?
   ["個体休止室A","共用充電室","個体休止室B","端末・燃料管理室"]:
  t.facilityMode==="fuel"||t.id==="machine_fuel"?
   ["燃料補給区A","登録・安全確認室","燃料補給区B","保守区"]:
  t.facilityMode==="charging"?["充電区A","管理・制御室","充電区B","機器保守区"]:
  t.facilityMode==="terminal"||t.id==="machine_terminal"?
   ["登録端末室","通信・情報端末室","照会端末室","管理・記録室"]:
  t.id==="machine_maintenance"?
   ["整備作業室","充電・診断室","部品管理室","精密調整室"]:
  t.id==="machine_supply"?
   ["補給品保管区","補給管理室","燃料・電池庫","出庫・検査室"]:
  t.id==="machine_research_lab"?
   ["研究・計測室","情報記録室","材料分析室","試料保管室"]:
  t.id==="machine_reclaim_factory"?
   ["回収物検査室","再処理制御室","分解・選別室","再利用部品保管室"]:
  t.id==="machine_guild_center"?
   ["任務受付室","作戦会議室","検索端末室","装備・報酬管理室"]:
  t.id==="machine_greenhouse_control"?
   ["栽培環境制御室","生物管理室","水・土壌検査室","資材記録室"]:
  t.id==="machine_security_checkpoint"?
   ["認証検査室","警備制御室","通行照合室","隔離待機室"]:
  t.id==="machine_cargo_checkpoint"?
   ["貨物搬入検査室","搬送制御室","仕分け・仮置室","登録記録室"]:
   ["作業区A","管理室","作業区B","保管室"]);
 const mode=t.facilityMode||"generic";
 const line=(a,b,c,d)=>({type:"polyline",points:[at(a,b),at(c,d)]});
 const addWall=(f,a,b,c,d)=>{
  if(Math.hypot(c-a,d-b)<=1e-6)return;
  const exterior=(a===c&&(a===0||a===W))||(b===d&&(b===0||b===H));
  const wallThicknessCm=exterior?wallGuide.outerCm:wallGuide.innerCm; // editable scale-based defaults
  add(exterior?"外周壁":"区画壁","wall",f,line(a,b,c,d),{
   wall:{thickness:wallThicknessCm/50*spacing},
   metadata:{templateId:t.id,generated:true,worldStyle:"machine",designStatus:"draft-unverified",
    wallThicknessCm,wallRole:exterior?"exterior":"partition",wallThicknessRule:wallGuide.version,
    wallThicknessStatus:"editor-default"}
  });
 };
 const addDoor=(f,a,b,c,d,external=false)=>{
  const door=add(external?"施設入口":"区画扉","door",f,line(a,b,c,d),
   {door:{hinge:"start",swing:"inward",state:"closed",type:"sliding",slideDirection:"end"},
    opening:{kind:external?"entrance":"interior",width:Math.hypot(c-a,d-b)*spacing,external}});
  door.metadata.openingWidthCm=Math.round(Math.hypot(c-a,d-b)*50);
  return door;
 };
 const addFixture=(f,room,name,shape,px,py,pw,ph,extra={})=>{
  if(px<room.x-.0001||py<room.y-.0001||px+pw>room.x+room.w+.0001||py+ph>room.y+room.h+.0001)return null;
  const obj=add(name,"object",f,rect(px,py,pw,ph),{shapePresetId:shape,...extra});
  obj.parentId=room.zone.id;obj.displayLevel=displayLevel+2;
  obj.label.visible=false;obj.metadata={...obj.metadata,roomId:room.id};
  return obj;
 };
 for(let z=0;z<floors.length;z++){
  const floor=floors[z].id;
  const stairs=t.floors>1;
  // Use two genuinely different plan archetypes. Pod halls, charging bays
  // and bulk logistics need open banks; residences, labs, inspections and
  // offices need enclosed individual rooms. Do not merely rename one plan.
  const openBank=["pods","charging","fuel"].includes(mode)||
   ["machine_supply","machine_cargo_checkpoint"].includes(t.id);
  const r=openBank?[
   {id:"left_full",name:t.id==="machine_cargo_checkpoint"?"貨物仕分け・仮置区":roomNames[0],x:0,y:0,w:leftW,h:H,side:"left"},
   ...(stairs?[
    {id:"right_top",name:"階段・共用設備室",x:cR,y:0,w:rightW,h:topH,side:"right"},
    {id:"right_bottom",name:roomNames[3],x:cR,y:topH,w:rightW,h:bottomH,side:"right"}
   ]:[{id:"right_full",name:t.id==="machine_cargo_checkpoint"?
    "搬送検査・登録室":roomNames[1],x:cR,y:0,w:rightW,h:H,side:"right"}]),
   {id:"corridor",name:"中央通路・出入口",x:cL,y:0,w:corridorW,h:H,side:"middle"}
  ]:[
   {id:"left_top",name:roomNames[0],x:0,y:0,w:leftW,h:topH,side:"left"},
   {id:"right_top",name:stairs?"階段・共用設備室":roomNames[1],x:cR,y:0,w:rightW,h:topH,side:"right"},
   {id:"left_bottom",name:roomNames[2],x:0,y:topH,w:leftW,h:bottomH,side:"left"},
   {id:"right_bottom",name:roomNames[3],x:cR,y:topH,w:rightW,h:bottomH,side:"right"},
   {id:"corridor",name:"共用通路・出入口",x:cL,y:0,w:corridorW,h:H,side:"middle"}
  ];
  const stairRoom=stairs?r.find(a=>a.id==="right_top"):null;
  const stairBox=stairRoom?{
   x:stairRoom.x+stairRoom.w-4.2,y:stairRoom.y+.5,w:3.6,h:5.6
  }:null;
  if(stairBox&&(stairBox.x<stairRoom.x+.5||stairBox.y+stairBox.h>stairRoom.y+stairRoom.h-2.5))
   throw Error("階段と下側踊り場の寸法が不足："+t.id);
  if(z>0&&stairBox){
   const st=stairBox;
   // Ground floor remains a complete slab; upper floors have a matching
   // conceptual cut-out for the aligned staircase.
   for(const [ax,ay,aw,ah] of [[0,0,W,st.y],[0,st.y,st.x,st.h],
     [st.x+st.w,st.y,W-st.x-st.w,st.h],[0,st.y+st.h,W,H-st.y-st.h]]){
    if(aw>1e-7&&ah>1e-7)add("床面 "+floor,"slab",floor,rect(ax,ay,aw,ah),
     {metadata:{templateId:t.id,generated:true,worldStyle:"machine",
       stairFloorOpening:true,designStatus:"draft-unverified"}});
   }
  }else add("床面 "+floor,"slab",floor,rect(0,0,W,H));
  for(const room of r){
   room.zone=add(room.name,"region",floor,rect(room.x,room.y,room.w,room.h),
    {shapePresetId:"room_zone",metadata:{templateId:t.id,generated:true,roomId:room.id,worldStyle:"machine",designStatus:"draft-unverified"}});
  }
  addWall(floor,0,0,W,0);addWall(floor,0,0,0,H);addWall(floor,W,0,W,H);
  const entryW=2.4,entryX=cL+(corridorW-entryW)/2;
  addWall(floor,0,H,entryX,H);
  if(z===0)addDoor(floor,entryX,H,entryX+entryW,H,true);
  else addWall(floor,entryX,H,entryX+entryW,H);
  addWall(floor,entryX+entryW,H,W,H);
  const gapW=Math.min(2.2,Math.min(topH,bottomH)-1.6);
  for(const room of r.filter(o=>o.side!=="middle")){
   const wallX=room.side==="left"?cL:cR;
   // A staircase door belongs beside the bottom approach/landing,
   // never at the height of a stair flight in the wall.
   const centre=stairs&&room.id==="right_top"?
    room.y+room.h-1.4:room.y+room.h/2;
   const openA=centre-gapW/2,openB=centre+gapW/2;
   addWall(floor,wallX,room.y,wallX,openA);
   addDoor(floor,wallX,openA,wallX,openB);
   addWall(floor,wallX,openB,wallX,room.y+room.h);
  }
  if(r.some(room=>room.id==="left_bottom"))addWall(floor,0,topH,cL,topH);
  if(r.some(room=>room.id==="right_bottom"))addWall(floor,cR,topH,W,topH);
  // Each pair of rooms has independent access via the central corridor.
  let devices=0;
  for(const room of r.filter(o=>o.side!=="middle")){
   if(stairs&&room.id==="right_top"){
    // Stair footprint remains in one stairwell across every floor.
    const sx=stairBox.x,sy=stairBox.y,sw=stairBox.w,sh=stairBox.h;
    const stair=add("階段","stair",floor,rect(sx,sy,sw,sh),
      {shapePresetId:"stair",stairDesign:{type:"switchback",flightWidthM:.8,
       footprintWidthM:sw*.5,footprintDepthM:sh*.5,
       status:"concept-not-architecturally-verified"},
       stairNavigation:{upFloorId:floors[z+1]?.id||null,downFloorId:floors[z-1]?.id||null,
        upSide:"left",downSide:"right"},
       connection:{id:prefix+"_main_stair",fromFloorId:floor,
        toFloorId:floors[z+1]?.id||floors[z-1]?.id,
        fromAnchor:at(sx+sw/2,sy+sh/2),toAnchor:at(sx+sw/2,sy+sh/2),
        direction:z<floors.length-1?"up":"down"}});
    // The stairwell is also a room. Its door opens directly to the corridor.
    stair.metadata={...stair.metadata,roomId:room.id};continue;
   }
   const station=mode==="pods"||mode==="housing"?"dormancy_pod":
    mode==="fuel"?"fuel_dispenser":mode==="charging"?"charging_station":
    mode==="terminal"?"terminal_device":
    t.roomNames?(room.name.includes("保管")||room.name.includes("倉庫")?"storage_container":room.name.includes("燃料")?"fuel_dispenser":room.name.includes("加工")||room.name.includes("作業")||room.name.includes("整備")||room.name.includes("組立")||room.name.includes("試作")?"workbench":"terminal_device"):
    t.id==="machine_maintenance"?(room.id==="left_top"?"workbench":"terminal_device"):
    t.id==="machine_supply"?(room.id==="right_full"?"terminal_device":"storage_container"):
    t.id==="machine_reclaim_factory"?
     (room.name.includes("保管")?"storage_container":"workbench"):
    t.id==="machine_research_lab"?
     (room.name.includes("試料")?"storage_container":"terminal_device"):
    t.id==="machine_guild_center"?
     (room.name.includes("装備")?"storage_container":"terminal_device"):
    t.id==="machine_greenhouse_control"?
     (room.name.includes("検査")?"workbench":"terminal_device"):
    t.id==="machine_security_checkpoint"?"terminal_device":
    t.id==="machine_cargo_checkpoint"?
     (room.name.includes("仮置")?"storage_container":"terminal_device"):
    room.name.includes("充電")?"charging_station":room.name.includes("燃料")?"fuel_dispenser":
    room.name.includes("整備")?"workbench":"terminal_device";
   const podMode=station==="dormancy_pod";
   const margin=1.1,cellW=podMode?2.15:3.25,cellH=podMode?3.1:3.5;
   const stepX=podMode?2.75:4.5,stepY=podMode?3.85:5.1;
   const endX=room.x+room.w-1.0,endY=room.y+room.h-1.0;
   for(let yy=room.y+margin;yy+cellH<=endY;yy+=stepY){
    for(let xx=room.x+margin;xx+cellW<=endX;xx+=stepX){
     // Do not fill the approach to a door in the centre of the room's inner wall.
     const doorSide=room.side==="left"?room.x+room.w:room.x;
     if(Math.abs(xx+cellW/2-doorSide)<2.1&&
        Math.abs(yy+cellH/2-(room.y+room.h/2))<2.3)continue;
     const limit=podMode?Math.max(1,t.podsPerFloor||8):room.id.endsWith("top")?3:2;
     if(devices>=limit&&podMode)continue;
     const name=podMode?"休眠ポッド "+(devices+1):
      station==="fuel_dispenser"?"燃料補給機":station==="charging_station"?"充電設備":
      station==="storage_container"?"資材保管コンテナ":
      station==="workbench"?"整備台":"情報・制御端末";
     const extra=podMode?{podGroup:room.id+"_"+floor,
      metadata:{templateId:t.id,generated:true,role:"dormancy-pod",podIndex:devices+1,worldStyle:"machine",roomId:room.id}}:{};
     if(addFixture(floor,room,name,station,xx,yy,cellW,cellH,extra))devices++;
    }
   }
   // Choose an actually empty floor position for the control terminal;
   // it must not overlap the mechanical pod or repair machinery.
   const roomDevices=objs.filter(o=>o.floorId===floor&&o.objectType==="object"&&
    o.parentId===room.zone.id);
   const candidatePositions=[
    [room.x+.2,room.y+.2],[room.x+room.w-1.4,room.y+.2],
    [room.x+.2,room.y+room.h-1.2],[room.x+room.w-1.4,room.y+room.h-1.2]
   ];
   for(const [tx,ty] of candidatePositions){
    const intersects=roomDevices.some(o=>{
     const g=o.geometry,ax=x+tx*spacing,ay=y+ty*spacing;
     return ax<g.x+g.width-.00001&&ax+1.2*spacing>g.x+.00001&&
      ay<g.y+g.height-.00001&&ay+spacing>g.y+.00001;
    });
    if(intersects)continue;
    const needsCharging=(mode==="housing"&&room.id==="right_bottom")||
     (t.id==="machine_rest"&&room.id==="left_bottom");
    const serviceShape=needsCharging?"charging_station":"terminal_device";
    const serviceName=needsCharging?"共用充電設備":"操作・診断端末";
    const serv=addFixture(floor,room,serviceName,serviceShape,tx,ty,1.2,1,
     {metadata:{templateId:t.id,generated:true,role:"room-service",worldStyle:"machine",roomId:room.id}});
    if(serv){serv.metadata.ceilingMounted=false;break}
   }
  }
  // Public-facing information is accessible from the corridor, not behind a pod.
  const hall=r.find(o=>o.id==="corridor");
  addFixture(floor,hall,"共用案内端末","terminal_device",hall.x+.2,1,.85,1.1);
 }
 return{template:copy(t),objects:objs};
}

function generate(templateId,options={}){
 const template=presets.find(t=>t.id===templateId);
 if(!template)throw Error("不明な建物テンプレート: "+templateId);
 if(template.modernPlan)return generateModern(template,options);
 if(template.facilityMode==="middle_layer_frame")return generateMiddleLayerFrame(template,options);
 if(template.facilityMode==="giant_grove")return generateGiantGrove(template,options);
 if(template.facilityMode==="registlink_dome")return generateRegistlinkDome(template,options);
 if(template.facilityMode==="weapons_yard")return generateWeaponsYard(template,options);
 if(template.worldStyle==="machine")return generateMachine(template,options);
 const {prefix,parentId=null,displayLevel=4,x=0,y=0,spacing=2,baseName=template.name}=options;
 if(typeof prefix!=="string"||!prefix)throw Error("建物IDが必要です");
 if(!Number.isFinite(spacing)||spacing<=0)throw Error("グリッド間隔が不正です");
 const W=template.cells[0]*spacing,H=template.cells[1]*spacing,objects=[];
 const wallGuide=wallThicknessGuide(template,{strength:"standard"});
 const at=(a,b)=>[x+a*spacing,y+b*spacing];
 const rect=(a,b,w,h)=>({type:"rect",x:x+a*spacing,y:y+b*spacing,width:w*spacing,height:h*spacing});
 const poly=points=>({type:"polyline",points:points.map(([a,b])=>at(a,b))});
 const id=s=>prefix+"_"+s;
 const base=(suffix,name,kind,geometry,floorId,style,extra={})=>{
  const obj={id:id(suffix),name,parentId:prefix,displayLevel:displayLevel+1,
   floorId,objectType:kind,layer:kind==="wall"||kind==="door"?"walls":"structures",
   zIndex:kind==="wall"?47:kind==="door"?49:kind==="stair"?46:kind==="slab"?29:45,
   geometry,visible:true,selectable:kind!=="slab",style,
   label:{visible:false,text:name},detail:"建物テンプレートから生成。必要に応じて編集してください。",
   metadata:{templateId:template.id,generated:true},...extra};
  objects.push(obj);return obj;
 };
 const floorNames=Array.from({length:template.floors},(_,i)=>({id:(i+1)+"F",label:(i+1)+"階",elevation:i*3,height:3}));
 const building={id:prefix,name:baseName,parentId,displayLevel,objectType:"facility",layer:"subregions",zIndex:30,
   geometry:{type:"rect",x,y,width:W,height:H},floors:copy(floorNames),
   visible:true,selectable:true,style:{fill:"rgba(90,143,153,.13)",stroke:"#a6cbd0",strokeWidth:1.5},
   label:{visible:true,text:baseName,position:[x+W/2,y+H/2],fontSize:11},
   detail:template.description+"（テンプレート配置。間取り・寸法は編集可能）",
   metadata:{templateId:template.id,generated:true}};
 objects.push(building);
 const wall=(name,f,points)=>{
  const [a,b]=points;
  const exterior=(a[0]===b[0]&&(a[0]===0||a[0]===template.cells[0]))||
                 (a[1]===b[1]&&(a[1]===0||a[1]===template.cells[1]));
  const wallThicknessCm=exterior?wallGuide.outerCm:wallGuide.innerCm;
  return base(name,"壁","wall",poly(points),f,{stroke:"#d3e6e8",strokeWidth:2},{
   wall:{thickness:wallThicknessCm/50*spacing},
   metadata:{templateId:template.id,generated:true,wallThicknessCm,
    wallRole:exterior?"exterior":"partition",wallThicknessRule:wallGuide.version,
    wallThicknessStatus:"editor-default"}
  });
 };
 const door=(name,f,points,external=false)=>base(name,external?"建物入口":"室内扉","door",poly(points),f,{stroke:"#e8b97a",strokeWidth:2},{
  door:{hinge:"start",swing:"inward",state:"closed",swingSide:"left"},
  opening:{kind:external?"entrance":"interior",width:2*spacing,external}
 });
 const nX=template.cells[0],nY=template.cells[1],mid=Math.round(nY*.54);
 const entranceWidth=template.category==="warehouse"?4:2;
 const entranceSide=template.entranceSide||"center";
 const start=entranceSide==="left"?2:entranceSide==="right"?nX-entranceWidth-2:(nX-entranceWidth)/2;
 const stair=template.floors>1;
 for(let i=0;i<template.floors;i++){
  const f=floorNames[i].id;
  base("floor_"+f,"床面 "+f,"slab",rect(0,0,nX,nY),f,{fill:"rgba(48,81,88,.64)",stroke:null});
  wall("north_"+f,f,[[0,0],[nX,0]]);
  wall("west_"+f,f,[[0,0],[0,nY]]);
  wall("east_"+f,f,[[nX,0],[nX,nY]]);
  if(i===0){
   wall("south_l_"+f,f,[[0,nY],[start,nY]]);
   wall("south_r_"+f,f,[[start+entranceWidth,nY],[nX,nY]]);
   door("entrance_"+f,f,[[start,nY],[start+entranceWidth,nY]],true);
  }else wall("south_"+f,f,[[0,nY],[nX,nY]]);
  if(template.layout!=="open"){
   // Internal wall with an actual opening, not a solid divider under a door.
   const depth=template.layout==="front"?Math.round(nY*.67):mid;
   const gapStart=template.layout==="side"?Math.round(nX*.28):(nX-2)/2;
   wall("partition_l_"+f,f,[[0,depth],[gapStart,depth]]);
   wall("partition_r_"+f,f,[[gapStart+2,depth],[nX,depth]]);
   door("partition_door_"+f,f,[[gapStart,depth],[gapStart+2,depth]]);
   if(template.layout==="cross"){
    const split=Math.round(nX*.48),y1=Math.max(3,depth-4),y2=depth-2;
    wall("cross_top_"+f,f,[[split,0],[split,y1]]);
    wall("cross_bottom_"+f,f,[[split,y2],[split,depth]]);
    door("cross_door_"+f,f,[[split,y1],[split,y2]]);
   }
  }
  if(stair){
   // Keep stairs within the south-right zone, entirely past the partition wall.
   const partitionY=template.layout==="front"?Math.round(nY*.67):mid;
   const sx=nX-5,sy=partitionY+1,stairH=Math.min(6,nY-partitionY-2);
   base("stair_"+f,i+1<template.floors?"上り階段":"下り階段","stair",rect(sx,sy,4,stairH),f,
    {fill:"rgba(75,118,137,.5)",stroke:"#acd5df",strokeWidth:1.5},
    {shapePresetId:"stair",connection:{id:id("stair_main"),fromFloorId:f,
      toFloorId:floorNames[i+1]?.id||floorNames[i-1].id,
      fromAnchor:at(sx+2,sy+stairH/2),toAnchor:at(sx+2,sy+stairH/2),direction:i+1<template.floors?"up":"down"}});
  }
  if(template.worldStyle!=="machine"&&template.category==="warehouse"){
    base("storage_"+f,"収納区画","object",rect(1,1,5,4),f,
     {fill:"#2b4856",stroke:"#9ec5ca",strokeWidth:1}, {shapePresetId:"storage_container"});
  }else if(template.worldStyle!=="machine"&&template.category==="shop"){
    base("counter_"+f,"カウンター","object",rect(2,2,5,2),f,
     {fill:"#375666",stroke:"#9ec5ca",strokeWidth:1},{shapePresetId:"table"});
  }else if(template.worldStyle!=="machine"&&template.category==="workshop"){
    base("workbench_"+f,"作業台","object",rect(2,2,6,3),f,
     {fill:"#375666",stroke:"#9ec5ca",strokeWidth:1},{shapePresetId:"workbench"});
  }else if(template.worldStyle!=="machine"&&["small_house","row_house","apartment"].includes(template.category)){
    base("bed_"+f,"ベッド","object",rect(2,Math.max(1,Math.min(2,(template.layout==="front"?Math.round(nY*.67):mid)-5)),3,5),f,
     {fill:"#375666",stroke:"#9ec5ca",strokeWidth:1},{shapePresetId:"bed"});
  }
  if(template.worldStyle==="machine"&&!template.facilityMode){
   const devices=template.id==="machine_fuel"?[
    ["fuel_station","燃料補給機",2,2,5,4,"fuel_dispenser"],["terminal","登録端末",nX-6,2,4,3,"terminal_device"]]:
    template.id==="machine_terminal"?[
    ["terminal","情報端末",2,2,5,4,"terminal_device"],["communication","通信端末",nX-7,2,4,3,"terminal_device"]]:
    template.id==="machine_maintenance"?[
    ["repair","整備台",2,2,7,5,"workbench"],["charging","充電設備",nX-8,2,5,5,"charging_station"],["diagnostic","診断端末",3,nY-6,4,3,"terminal_device"]]:
    template.id==="machine_supply"?[
    ["fuel_station","燃料補給機",2,2,5,4,"fuel_dispenser"],["terminal","管理端末",nX-7,2,4,3,"terminal_device"]]:
    [["charging","充電設備",2,2,5,5,"charging_station"],
     ["fuel_station","燃料補給機",nX-8,2,5,4,"fuel_dispenser"],
     ["terminal","個体用端末",2,nY-6,4,3,"terminal_device"]];
   for(const [deviceId,name,px,py,pw,ph,shapePresetId] of devices)
    base("device_"+deviceId+"_"+f,name,"object",rect(px,py,pw,ph),f,
     {fill:"#294d5d",stroke:"#9fc9d8",strokeWidth:1.2},{shapePresetId});
  }
  if(template.facilityMode){
   const addDevice=(key,name,px,py,pw,ph,shapePresetId,extra={})=>
    base("system_"+key+"_"+f,name,"object",rect(px,py,pw,ph),f,
     {fill:"#294d5d",stroke:"#9fc9d8",strokeWidth:1.2},
     {shapePresetId,metadata:{templateId:template.id,generated:true,role:"facility-device"},...extra});
   const mode=template.facilityMode;
   if(mode==="housing"||mode==="pods"){
    const reservedRight=stair?8:2;
    const podW=2.2,podH=3.3,stepX=3,stepY=4.8;
    const left=2,right=nX-reservedRight-2;
    // Keep the centre aisle clear: alternating banks at front/back.
    const bankTop=2,bankBottom=Math.round(nY*.55);
    const available=Math.max(1,Math.floor((right-left-podW)/stepX)+1);
    const desired=template.podsPerFloor;
    let number=0;
    for(const [bank,rowY] of [["front",bankTop],["rear",bankBottom]]){
     for(let col=0;col<available&&number<desired;col++){
      const px=left+col*stepX,py=rowY;
      if(py+podH>nY-4||px+podW>right)break;
      number++;
      const group=bank+"_"+f;
      base("pod_"+f+"_"+String(number).padStart(3,"0"),
       "個人休眠ポッド "+number,"object",rect(px,py,podW,podH),f,
       {fill:"#244c59",stroke:"#9fc9d8",strokeWidth:1},
       {shapePresetId:"dormancy_pod",podGroup:group,
        metadata:{templateId:template.id,generated:true,role:"dormancy-pod",podIndex:number}});
     }
    }
    if(mode==="pods"&&number<desired){
     // Longer facility templates may use further banks, preserving a walking strip.
     const nextY=Math.min(nY-7,Math.round(nY*.32));
     for(let col=0;col<available&&number<desired;col++){
      const px=left+col*stepX;
      if(nextY+podH>=bankBottom-1||px+podW>right)break;
      number++;
      base("pod_"+f+"_"+String(number).padStart(3,"0"),
       "個人休眠ポッド "+number,"object",rect(px,nextY,podW,podH),f,
       {fill:"#244c59",stroke:"#9fc9d8",strokeWidth:1},
       {shapePresetId:"dormancy_pod",podGroup:"middle_"+f,
        metadata:{templateId:template.id,generated:true,role:"dormancy-pod",podIndex:number}});
     }
    }
    if(mode==="pods"&&number<desired){
     // Last bank near the entrance, with its own walking gap.
     const lastY=nY-7;
     for(let col=0;col<available&&number<desired;col++){
      const px=left+col*stepX;
      if(px+podW>right||lastY<=bankBottom+podH+1)break;
      number++;
      base("pod_"+f+"_"+String(number).padStart(3,"0"),
       "個人休眠ポッド "+number,"object",rect(px,lastY,podW,podH),f,
       {fill:"#244c59",stroke:"#9fc9d8",strokeWidth:1},
       {shapePresetId:"dormancy_pod",podGroup:"south_"+f,
        metadata:{templateId:template.id,generated:true,role:"dormancy-pod",podIndex:number}});
     }
    }
    addDevice("management","休眠管理端末",nX-4,2,3,3,"terminal_device");
    // Fuel/charging are separate systems and not embedded in each dormancy pod.
    if(mode==="housing")addDevice("charging","共用充電設備",nX-7,2,3,3,"charging_station");
   }else{
    const kind=mode==="fuel"?"fuel_dispenser":mode==="charging"?"charging_station":"terminal_device";
    const cols=mode==="terminal"?3:4;
    const rows=mode==="terminal"?2:2;
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const px=template.layout==="cross"&&col===2?Math.round(nX*.48)+2:2+col*5,py=2+row*6;
      addDevice("station_"+row+"_"+col,mode==="fuel"?"燃料補給機":mode==="charging"?"充電設備":"登録端末",px,py,3,4,kind);
    }
    addDevice("management","管理端末",nX-7,2,4,3,"terminal_device");
   }
  }
 }
 return{template:copy(template),objects};
}
// User-saved templates store complete independent building/subobject snapshots.
const custom=[];
function register(spec){
 if(!spec||spec.schema!=="map-building-template-v1"||typeof spec.id!=="string"||
    !/^[a-z0-9_-]{3,80}$/i.test(spec.id)||!Array.isArray(spec.objects)||spec.objects.length<1)
  throw Error("テンプレート形式が不正です");
 if(presets.some(p=>p.id===spec.id))throw Error("標準テンプレートIDは上書きできません");
 if(spec.objects.length>500)throw Error("テンプレートは500オブジェクト以内にしてください");
 const root=spec.objects.find(o=>o.id===spec.rootId);
 if(!root||root.objectType!=="facility"||root.geometry?.type!=="rect")throw Error("建物の親図形が必要です");
 const oldIds=new Set(spec.objects.map(o=>o.id));
 if(oldIds.size!==spec.objects.length)throw Error("テンプレート内IDが重複しています");
 for(const o of spec.objects)if(o.id!==root.id&&!oldIds.has(o.parentId))throw Error("テンプレートに外部の親参照があります");
 const item=copy(spec),pos=custom.findIndex(c=>c.id===item.id);
 if(pos>=0)custom.splice(pos,1,item);else custom.push(item);
 return item;
}
function capture(scene,rootId,info){
 const root=scene?.objects?.find(o=>o.id===rootId);
 if(!root||root.objectType!=="facility"||root.geometry?.type!=="rect")throw Error("施設の四角形を選択してください");
 const subset=[],included=new Set([root.id]);
 let added=true;
 while(added){
  added=false;
  for(const o of scene.objects)if(!included.has(o.id)&&included.has(o.parentId)){included.add(o.id);added=true}
 }
 for(const o of scene.objects)if(included.has(o.id))subset.push(copy(o));
 if(root.interiorSource&&subset.length===1)throw Error("建物内部の読み込みが完了してからテンプレート登録してください");
 const id=String(info?.id||"").trim(),name=String(info?.name||root.name||"").trim();
 if(!/^[a-z0-9_-]{3,80}$/i.test(id)||!name)throw Error("英数字ID（3〜80文字）と名称が必要です");
 if(subset.length>500)throw Error("選択した建物には500個超のオブジェクトがあります");
 const source=allPresets().find(t=>t.id===root.metadata?.templateId);
 const tags=Array.isArray(info?.tags)?info.tags:Array.isArray(source?.tags)?source.tags:[];
 const position=[root.geometry.x,root.geometry.y];
 // Geometry remains in scene-coordinate units. Relative offsets are restored on placement.
 return{schema:"map-building-template-v1",id,name,category:"custom",description:info?.description||"",
   rootId:root.id,origin:position,originalSize:[root.geometry.width,root.geometry.height],
   tags:[...new Set(tags.filter(x=>typeof x==="string"))],objects:subset};
}
function generateCustom(templateId,options={}){
 const t=custom.find(v=>v.id===templateId);
 if(!t)throw Error("登録済みテンプレートが見つかりません");
 const {prefix,parentId=null,displayLevel=4,x=0,y=0,baseName=t.name}=options;
 if(!prefix)throw Error("建物IDが必要です");
 const idMap=new Map(t.objects.map(o=>[o.id,o.id===t.rootId?prefix:prefix+"_"+o.id.replace(/[^a-z0-9_-]/gi,"_")]));
 if(new Set(idMap.values()).size!==idMap.size)throw Error("ID変換が衝突します");
 const [ox,oy]=t.origin,dx=x-ox,dy=y-oy;
 const out=t.objects.map(src=>{
  const o=copy(src);
  o.id=idMap.get(src.id);
  o.parentId=src.id===t.rootId?parentId:idMap.get(src.parentId);
  o.displayLevel=displayLevel+(src.displayLevel-(t.objects.find(v=>v.id===t.rootId).displayLevel||4));
  const g=o.geometry||{};
  if(g.type==="rect"){g.x+=dx;g.y+=dy}
  if(["circle","ring"].includes(g.type)){g.center[0]+=dx;g.center[1]+=dy}
  if(g.points)for(const p of g.points){p[0]+=dx;p[1]+=dy}
  if(Array.isArray(o.label?.position)){o.label.position[0]+=dx;o.label.position[1]+=dy}
  if(src.id===t.rootId){o.name=baseName;if(o.label?.text)o.label.text=baseName}
  if(o.opening?.wallId&&idMap.has(o.opening.wallId))o.opening.wallId=idMap.get(o.opening.wallId);
  if(o.connection){
   if(Array.isArray(o.connection.fromAnchor)){o.connection.fromAnchor[0]+=dx;o.connection.fromAnchor[1]+=dy}
   if(Array.isArray(o.connection.toAnchor)){o.connection.toAnchor[0]+=dx;o.connection.toAnchor[1]+=dy}
   if(o.connection.id)o.connection.id=prefix+"_connection_"+String(o.connection.id).replace(/[^a-z0-9_-]/gi,"_");
  }
  o.metadata={...o.metadata,templateId:t.id,generated:true};
  return o;
 });
 return{template:{id:t.id,name:t.name,cells:[t.originalSize[0]/(options.spacing||2),t.originalSize[1]/(options.spacing||2)],floors:out[0].floors?.length||1,description:t.description,category:"custom",era:t.era||"common",use:t.use||"special",tags:t.tags||[],originalSize:t.originalSize},objects:out};
}
function allPresets(){return[...presets,...custom.map(t=>({id:t.id,name:t.name,category:"custom",description:t.description||"保存した建物",cells:[...t.originalSize],floors:t.objects.find(o=>o.id===t.rootId)?.floors?.length||1,custom:true,era:t.era||"common",use:t.use||"special",tags:Array.isArray(t.tags)?t.tags:[],originalSize:t.originalSize}))]}
function generateAny(templateId,options){return custom.some(t=>t.id===templateId)?generateCustom(templateId,options):generate(templateId,options)}
global.AAMapBuildingTemplates={presets,custom,allPresets,generate:generateAny,register,capture,wallThicknessGuide};

})(window);
