/* Run: node tools/regenerate-middle-preview.cjs
 * Builds preview/middle-regenerated.svg from the current middle layout draft.
 * No Notion data or canonical references are changed.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const context={window:{}};vm.runInNewContext(read('aa-map-engine.js'),context,{filename:'aa-map-engine.js'});
const map=context.window.AAMapEngine.normalizeFloor(JSON.parse(read('data/middle-layout-draft.json')));
const at=(x,y)=>[500+y*.4,800-x*.4];
const str=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const points=ps=>ps.map(p=>at(...p).map(v=>v.toFixed(2)).join(',')).join(' ');
const poly=(n,color,edge,opacity=.2,width=2,dash='')=>{
 const p=context.window.AAMapEngine.polygon(map,n);
 return p.length?'<polygon points="'+points(p)+'" fill="'+color+'" fill-opacity="'+opacity+'" stroke="'+edge+'" stroke-width="'+width+'"'+
   (dash?' stroke-dasharray="'+dash+'"':'')+'/>':'';
};
const districts=map.districts,factories=['standard_fuel_factory','plant_oil_processing','fiber_resin_processing','middle_material_processing'];
const source=[
 '<?xml version="1.0" encoding="UTF-8"?>',
 '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1600" width="1000" height="1600" role="img">',
 '<title>AA中層 共通モデル再生成プレビュー</title>',
 '<rect x="0" y="0" width="1000" height="1600" fill="#0b1b26"/>',
 '<rect x="11" y="11" width="978" height="1578" rx="14" fill="#123040" stroke="#345567" stroke-dasharray="12 8"/>',
 '<g font-family="sans-serif" fill="#edf7fb"><text x="35" y="44" font-size="22" font-weight="bold">中層｜共通モデル再生成プレビュー</text>',
 '<text x="35" y="71" font-size="15" fill="#a9c7d4">既存下書きの座標・寸法を維持</text>',
 '<text x="500" y="115" font-size="16" text-anchor="middle">▲ 船首 +X</text>',
 '<text x="500" y="1550" font-size="16" text-anchor="middle">船尾 -X ▼</text></g>',
 '<g id="middle-geometry">'
];
const ring=map.byId.get('core_shell_refine');
if(ring&&ring.geometry.kind==='ring'){
 const [cx,cy]=at(ring.legacyX,ring.legacyY),o=ring.geometry.outerRadius*.4,i=ring.geometry.innerRadius*.4;
 source.push('<path d="M '+(cx-o)+' '+cy+' a '+o+' '+o+' 0 1 0 '+(2*o)+' 0 a '+o+' '+o+' 0 1 0 -'+(2*o)+' 0 M '+(cx-i)+' '+cy+' a '+i+' '+i+' 0 1 1 '+(2*i)+' 0 a '+i+' '+i+' 0 1 1 -'+(2*i)+' 0" fill="#4b967e" fill-opacity=".13" fill-rule="evenodd" stroke="#79c7a3" stroke-dasharray="8 5"/>');
}
const arbora=map.byId.get('arbora_sector');if(arbora)source.push(poly(arbora,'#2e8954','#79dba0',.23,2.5,'8 5'));
for(const n of districts){
 const upper=n.raw.socialTier==='upper',town=n.raw.type==='town';
 const fill=upper?(town?'#4196c0':'#8a69b8'):(town?'#ab7a40':'#9d626f');
 const stroke=upper?(town?'#8eeaff':'#dcc1ff'):(town?'#ffd18c':'#f6b9bd');
 source.push(poly(n,fill,stroke,.36,3,'9 6'));
}
for(const n of map.nodes.filter(n=>n.role==='facility'&&n.id!=='middle_terminal'&&!factories.includes(n.id)&&n.id!=='resist_link_dome'))
 source.push(poly(n,'#6293a6','#aad4e2',.25,1.4));
for(const id of factories){const n=map.byId.get(id);if(n)source.push(poly(n,'#c58b47','#f1cf96',.72,2))}
for(const d of districts)for(const n of context.window.AAMapEngine.childrenOf(map,d.id,'medium'))
 source.push(poly(n,'#d6e2e8','#e0e6eb',.06,1.3,'5 4'));
const terminal=map.byId.get('middle_terminal');
if(terminal){const [cx,cy]=at(terminal.legacyX,terminal.legacyY);source.push('<circle cx="'+cx+'" cy="'+cy+'" r="100" fill="#205f7d" fill-opacity=".82" stroke="#a0ddec" stroke-width="3"/>')}
const statuses=new Set(['draft_central_access','draft_purple_machine_axis','draft_parallel_freight_B','draft_arbora_B_access']);
for(const n of map.nodes.filter(n=>n.role==='road'&&n.geometry.kind==='polyline'&&statuses.has(n.raw.geometryStatus))){
 const machine=n.raw.geometryStatus==='draft_purple_machine_axis',freight=n.raw.geometryStatus==='draft_parallel_freight_B';
 const color=machine?'#d3b4ee':freight?'#e4ac6a':n.raw.color||'#aec8d7';
 source.push('<polyline points="'+points(n.geometry.points)+'" fill="none" stroke="'+str(color)+'" stroke-width="'+(machine||freight?2.6:1.6)+'" stroke-linejoin="round"/>');
}
for(const n of districts){
 const p=n.raw.mapLabelPosition||[n.legacyX,n.legacyY],[x,y]=at(...p);
 source.push('<text x="'+x+'" y="'+y+'" font-family="sans-serif" font-size="18" font-weight="bold" text-anchor="middle" paint-order="stroke" stroke="#102330" stroke-width="4" fill="#fff2d5">'+str(n.raw.districtMapLabel||n.raw.short||n.name)+'</text>');
}
source.push('</g>',
 '<rect x="20" y="1430" width="960" height="107" rx="9" fill="#071722" stroke="#426b79"/>',
 '<g font-family="sans-serif" font-size="15" fill="#d9edf4">',
 '<text x="37" y="1460">4地区・18中区画・4加工施設・主要仮道路をJSONから再描画</text>',
 '<text x="37" y="1487">柱位置・通行接続・内部小区画は未確定。詳細は施設選択後に表示。</text>',
 '<text x="37" y="1514" fill="#e6bf86">※ 静的プレビュー。正式な施設配置・通路接続ではありません。</text>',
 '</g>','</svg>');
fs.mkdirSync(path.join(root,'preview'),{recursive:true});
fs.writeFileSync(path.join(root,'preview/middle-regenerated.svg'),source.join('\n')+'\n');
console.log('Regenerated middle preview: '+map.districts.length+' districts, '+map.nodes.length+' objects');
