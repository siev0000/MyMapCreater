/* Responsive workspace and shared preview positioning. */
const EffectLayout=(()=>{
function fitSize(w,h,aw,ah,zoom){const scale=zoom==="fit"?Math.min(aw/w,ah/h):parseInt(zoom,10)/100;const z=Number.isFinite(scale)&&scale>0?scale:1;return {width:Math.max(1,Math.floor(w*z)),height:Math.max(1,Math.floor(h*z))}}
function setup(onPreviewChanged){
const tabs=[...document.querySelectorAll('[data-settings-tab]')],panes=[...document.querySelectorAll('[data-settings-pane]')],$=id=>document.getElementById(id),header=$('engineSelect');let canvasTab=EffectViewState.get().canvasTab,shaderTab='shader-'+EffectViewState.get().shaderTab;
function select(key,focus=false){
 const shader=key.startsWith('shader-');if(shader){shaderTab=key;EffectViewState.patch({shaderTab:key.slice(7)})}else if(!['external','code'].includes(key)){canvasTab=key;EffectViewState.patch({canvasTab:key})}
 for(const t of tabs){const active=t.dataset.settingsTab===key;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;if(active&&focus)t.focus()}
 for(const p of panes)p.hidden=p.dataset.settingsPane!==(shader?'external':key);for(const part of document.querySelectorAll('[data-ext-part]'))part.hidden=shader&&part.dataset.extPart!==key.slice(7);
 const code=key==='code',ext=key==='external'||shader;$('canvasStage').hidden=code||ext;$('canvasControls').hidden=code||ext;$('codeStage').hidden=!code;$('codeControls').hidden=!code;$('externalStage').hidden=!ext;$('externalControls').hidden=!ext;document.dispatchEvent(new CustomEvent('effect-tab-change',{detail:ext?'external':key}));
 $('settingsScroll').scrollTop=0;onPreviewChanged();
}
function setEngine(engine,notify=true){const mode=engine==='canvas'?'canvas':engine==='code'?'code':engine==='shader'?'shader':'external';header.value=engine;EffectViewState.patch({engine});document.querySelector('.settings-tabs').dataset.engineMode=mode;for(const t of tabs){const k=t.dataset.settingsTab;t.hidden=mode==='canvas'?['external','code'].includes(k)||k.startsWith('shader-'):mode==='shader'?!k.startsWith('shader-'):k!==mode;}select(mode==='canvas'?canvasTab:mode==='shader'?shaderTab:mode);if(notify)document.dispatchEvent(new CustomEvent('effect-engine-change',{detail:engine}));}
tabs.forEach(t=>{t.onclick=()=>select(t.dataset.settingsTab);t.onkeydown=e=>{const visible=tabs.filter(x=>!x.hidden),i=visible.indexOf(t);let n;if(e.key==='ArrowRight')n=(i+1)%visible.length;else if(e.key==='ArrowLeft')n=(i+visible.length-1)%visible.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=visible.length-1;else return;e.preventDefault();select(visible[n].dataset.settingsTab,true)}});
header.addEventListener('change',()=>setEngine(header.value));setEngine(EffectViewState.get().engine);
if(typeof ResizeObserver==='function')new ResizeObserver(onPreviewChanged).observe($('canvasStage'));else window.addEventListener('resize',onPreviewChanged);
}
return {fitSize,setup};
})();
if(typeof module!=='undefined')module.exports=EffectLayout;
