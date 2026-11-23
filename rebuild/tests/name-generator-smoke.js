'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'../..'),header=fs.readFileSync(path.join(base,'rebuild/header.html'),'utf8'),html=fs.readFileSync(path.join(base,'rebuild/name-generator.html'),'utf8');
for(const needle of ['id="open-namegen"','id="namegen-modal"','namegenFrame.src=namegenFrame.dataset.src','closeNamegen()'])assert.ok(header.includes(needle),needle);
const match=html.match(/<script id="embedded" type="application\/json">([\s\S]*?)<\/script>/);assert.ok(match);
const data=JSON.parse(match[1]);assert.equal(data.races.length,11);assert.equal(data.lexicon.length,561);
assert.equal(data.lexicon.filter(w=>w.出典区分==='語源参考（追加候補）').length,15);
for(const r of data.races){const pool=data.lexicon.filter(w=>w.種族===r.key&&w.使用可);assert.ok(pool.length>=40,r.key);}
console.log('Name generator smoke: 11 races, 561 words, settings button');
