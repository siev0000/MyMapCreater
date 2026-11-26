const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const L=require('./effect-layout.js');
assert.deepEqual(L.fitSize(128,128,300,160,'fit'),{width:160,height:160});
assert.deepEqual(L.fitSize(256,128,120,200,'fit'),{width:120,height:60});
assert.deepEqual(L.fitSize(64,128,100,100,'200%'),{width:128,height:256});
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length);
for(const id of ['preview','codeFrame','canvasStage','codeStage','settingsScroll','play','runCode','status','codeStatus','zoom','properties','project','layers'])assert.ok(ids.includes(id),id);
for(const tab of ['layers','output','save','code']){assert.ok(html.includes('data-settings-tab="'+tab+'"'));assert.ok(html.includes('data-settings-pane="'+tab+'"'))}
assert.ok(html.includes('data-tool-home'));assert.ok(html.includes('value="fit" selected'));
console.log('layout tests passed');

assert.match(html, /<option value="shader" selected>GLSL<\/option>/);
const layoutSource=fs.readFileSync(path.join(__dirname,'effect-layout.js'),'utf8');
assert.match(layoutSource,/header\.addEventListener\('change',\(\)=>setEngine\(header\.value\)\);setEngine\('shader'\);/);
assert.match(layoutSource,/if\(notify\)document\.dispatchEvent\(new CustomEvent\('effect-engine-change',\{detail:engine\}\)\)/);

for(const tab of ['shader-magic','shader-layers','shader-output','shader-save'])assert.ok(html.includes('data-settings-tab="'+tab+'"'));
for(const id of ['shaderMagicPrev','shaderMagicNext','shaderCSOriginal','shaderCSData','canvasCSOriginal','canvasCSData','externalLoop','externalZoom','externalBackground'])assert.ok(ids.includes(id),id);
const ref=require('./cs-magic-reference.js');assert.equal(Object.keys(ref.rows).length,24);assert.equal(ref.rows['thunder-many'].original,'');assert.equal(ref.rows['thunder-blue-jet'].data,'');
