/* 09: approved 30 supply icons; 10: shape-only placement categories. */
(function(global){"use strict";
const supplies=[{"id":"supply_box","name":"梱包物資","icon":"📦"},{"id":"tool_kit","name":"工具箱","icon":"🧰"},{"id":"repair_supplies","name":"工具","icon":"🔧"},{"id":"hardware_parts","name":"金属部品","icon":"🔩"},{"id":"machine_parts","name":"機械部品","icon":"⚙️"},{"id":"building_material","name":"建築資材","icon":"🧱"},{"id":"timber","name":"木材","icon":"🪵"},{"id":"raw_stone","name":"鉱石","icon":"🪨"},{"id":"textile_material","name":"糸","icon":"🧵"},{"id":"fiber_bundle","name":"繊維束","icon":"🧶"},{"id":"food","name":"食料","icon":"🍞"},{"id":"preserved_food","name":"保存食","icon":"🥫"},{"id":"drinks","name":"飲料","icon":"🥤"},{"id":"water","name":"水","icon":"💧"},{"id":"bottled_supplies","name":"洗剤","icon":"🧴"},{"id":"hygiene_supplies","name":"衛生用品","icon":"🧻"},{"id":"clothing","name":"衣服","icon":"👕"},{"id":"bedding_supply","name":"寝具","icon":"🛏️"},{"id":"medical_supply","name":"医薬品","icon":"💊"},{"id":"batteries","name":"バッテリー","icon":"🔋"},{"id":"power_parts","name":"電源部品","icon":"🔌"},{"id":"reagent","name":"試薬","icon":"🧪"},{"id":"samples","name":"研究試料","icon":"🧫"},{"id":"magnetic_parts","name":"磁性素材","icon":"🧲"},{"id":"drafting_supplies","name":"製図用品","icon":"📐"},{"id":"data_media","name":"記録媒体","icon":"💾"},{"id":"documents","name":"書類","icon":"📄"},{"id":"books","name":"書籍","icon":"📚"},{"id":"keys","name":"鍵","icon":"🗝️"},{"id":"valuables","name":"金銭・貴重品","icon":"💰"}];
const shapes=[{"id":"table","name":"机・テーブル"},{"id":"chair","name":"椅子"},{"id":"shelf","name":"棚"},{"id":"bed","name":"ベッド"},{"id":"cabinet","name":"収納庫"},{"id":"counter","name":"カウンター"},{"id":"sink","name":"流し台"},{"id":"generator","name":"発電機"},{"id":"tank","name":"タンク"},{"id":"control_panel","name":"制御盤"},{"id":"workbench","name":"大型作業台"},{"id":"conveyor","name":"搬送装置"},{"id":"storage_container","name":"大型コンテナ"}];

// Editable real-scale housing presets. Width/depth in cm, one cell = 50cm.
// These are broad product-size defaults, not exact manufacturer dimensions.
const residential=[
 ["リビング","sofa_1","1人掛けソファ","🛋️",80,80,"sofa"],
 ["リビング","sofa_2","2人掛けソファ","🛋️",150,85,"sofa"],
 ["リビング","sofa_3","3人掛けソファ","🛋️",200,90,"sofa"],
 ["リビング","sofa_corner","L字ソファ","🛋️",220,170,"corner_sofa"],
 ["リビング","coffee_table","ローテーブル","🪑",100,55,"table"],
 ["リビング","television","テレビ","📺",110,15,"screen"],
 ["リビング","tv_stand","テレビ台","📺",140,40,"cabinet"],
 ["リビング","floor_lamp","フロアランプ","💡",35,35,"lamp"],
 ["寝室","single_bed","シングルベッド","🛏️",100,200,"bed"],
 ["寝室","semi_double_bed","セミダブルベッド","🛏️",120,200,"bed"],
 ["寝室","double_bed","ダブルベッド","🛏️",140,200,"bed"],
 ["寝室","bunk_bed","二段ベッド","🛏️",100,200,"bunk_bed"],
 ["寝室","nightstand","サイドテーブル","🪑",45,40,"cabinet"],
 ["寝室","wardrobe","クローゼット","🚪",120,60,"cabinet"],
 ["寝室","dresser","タンス","🗄️",90,45,"cabinet"],
 ["寝室","desk","学習・作業机","🪑",110,60,"table"],
 ["キッチン","kitchen_counter","システムキッチン","🍳",240,65,"kitchen"],
 ["キッチン","cooktop","コンロ","🍳",60,60,"cooktop"],
 ["キッチン","kitchen_sink","キッチンシンク","🚰",80,60,"sink"],
 ["キッチン","refrigerator","冷蔵庫","🧊",60,65,"refrigerator"],
 ["キッチン","microwave","電子レンジ","🍱",50,45,"microwave"],
 ["キッチン","dish_cabinet","食器棚","🗄️",90,45,"shelf"],
 ["キッチン","kitchen_island","アイランド調理台","🍽️",160,85,"counter"],
 ["キッチン","dining_table_2","2人用食卓","🍽️",80,80,"table"],
 ["キッチン","dining_table_4","4人用食卓","🍽️",130,80,"table"],
 ["水回り","washbasin","洗面化粧台","🚰",75,55,"sink"],
 ["水回り","toilet_unit","洋式トイレ","🚽",40,75,"toilet"],
 ["水回り","bathtub","浴槽","🛁",160,80,"bath"],
 ["水回り","shower_booth","シャワーブース","🚿",90,90,"shower"],
 ["水回り","washing_machine","洗濯機","🧺",60,60,"washer"],
 ["水回り","washing_pan","洗濯パン","🧺",65,65,"washer"],
 ["家具・収納","bookshelf","本棚","📚",90,30,"shelf"],
 ["家具・収納","shoe_cabinet","靴箱","👞",90,40,"cabinet"],
 ["家具・収納","locker","ロッカー","🗄️",60,50,"cabinet"],
 ["家具・収納","trash_bin","ゴミ箱","🗑️",35,35,"bin"],
 ["家具・収納","office_chair","オフィスチェア","🪑",60,60,"chair"],
 ["家具・収納","storage_box","収納ボックス","📦",55,45,"storage_container"],
 ["電気設備","air_conditioner","エアコン室内機","❄️",85,25,"aircon"],
 ["電気設備","ventilator","換気扇","🌬️",35,35,"fan"],
 ["電気設備","water_heater","給湯器","♨️",50,25,"heater"],
 ["電気設備","distribution_board","分電盤","⚡",45,15,"control_panel"],
 ["電気設備","ceiling_light","天井照明","💡",45,45,"lamp"],
 ["屋外","plant_pot","植木鉢","🪴",40,40,"plant"],
 ["屋外","garden_bench","ベンチ","🪑",140,50,"sofa"],
 ["屋外","clothesline","物干し台","👕",160,45,"rack"],
 ["屋外","bicycle_space","自転車置き場","🚲",65,190,"bicycle"]
].map(([category,id,name,icon,widthCm,depthCm,shape])=>({
 category,id,name,icon,widthCm,depthCm,shape,
 description:name+"の平面設置範囲です。幅・奥行きと回転を編集できます。"
}));

function entries(scene){return Array.isArray(scene?.settings?.supplyCatalog)?scene.settings.supplyCatalog:supplies}
function get(scene,id){return entries(scene).find(x=>x.id===id)||null}
global.AAMapObjectCatalog={supplies,shapes,residential,entries,get};
})(window);
