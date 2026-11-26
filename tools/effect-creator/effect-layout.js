/* Responsive workspace and shared preview positioning. */
const EffectLayout=(()=>{
function fitSize(w,h,aw,ah,zoom){const scale=zoom==="fit"?Math.min(aw/w,ah/h):parseInt(zoom,10)/100;const z=Number.isFinite(scale)&&scale>0?scale:1;return {width:Math.max(1,Math.floor(w*z)),height:Math.max(1,Math.floor(h*z))}}
function setup(onPreviewChanged){
const tabs=[...document.querySelectorAll('[data-settings-tab]')],panes=[...document.querySelectorAll('[data-settings-pane]')],$=id=>document.getElementById(id);
function select(key,focus=false){
 for(const t of tabs){const active=t.dataset.settingsTab===key;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;if(active&&focus)t.focus()}
 for(const p of panes)p.hidden=p.dataset.settingsPane!==key;
 const code=key==='code';$('canvasStage').hidden=code;$('canvasControls').hidden=code;$('codeStage').hidden=!code;$('codeControls').hidden=!code;
 $('settingsScroll').scrollTop=0;onPreviewChanged();
}
tabs.forEach((t,i)=>{t.onclick=()=>select(t.dataset.settingsTab);t.onkeydown=e=>{let n;if(e.key==='ArrowRight')n=(i+1)%tabs.length;else if(e.key==='ArrowLeft')n=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=tabs.length-1;else return;e.preventDefault();select(tabs[n].dataset.settingsTab,true)}});
select('layers');
if(typeof ResizeObserver==='function')new ResizeObserver(onPreviewChanged).observe($('canvasStage'));else window.addEventListener('resize',onPreviewChanged);
}
return {fitSize,setup};
})();
if(typeof module!=='undefined')module.exports=EffectLayout;
