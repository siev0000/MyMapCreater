const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {requestHome}=require("./tool-home.js");
let visits=[];
assert.equal(requestHome(()=>false,url=>visits.push(url),"/index.html"),false);
assert.deepEqual(visits,[]);
assert.equal(requestHome(message=>{assert.match(message,/保存していない/);return true},url=>visits.push(url),"/index.html"),true);
assert.deepEqual(visits,["/index.html"]);
for(const name of ["rebuild/header.html","rebuild/editor.html","rebuild/name-generator.html","rebuild/shape-catalog.html","tools/effect-creator/index.html"]){
const html=fs.readFileSync(path.join(__dirname,"..",name),"utf8");
assert.match(html,/data-tool-home/);assert.match(html,/shared\/tool-home\.js/);assert.match(html,/shared\/tool-home\.css/);
}
console.log("tool home tests passed");
