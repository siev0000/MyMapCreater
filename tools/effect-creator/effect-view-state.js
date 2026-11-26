/* Restore navigation and built-in preset IDs, never stale shader code. */
const EffectViewState=(function viewFactory(storage){
 const key="myMapCreater.effect.view.v1",engines=["shader","canvas","pixi","three","quarks","ts","code"],tabs=["magic","layers","output","save"],shapes=["lightning","burst","fire","vortex","ring"];
 function normalize(raw={}){if(!raw||typeof raw!=="object")raw={};const s={engine:engines.includes(raw.engine)?raw.engine:"shader",canvasTab:tabs.includes(raw.canvasTab)?raw.canvasTab:"layers",shaderTab:tabs.includes(raw.shaderTab)?raw.shaderTab:"layers",samples:{}};for(const k of ["canvasMagic","shaderMagic","canvasLoaded","shaderLoaded"])s[k]=typeof raw[k]==="string"&&(k.startsWith("shader")?/^(?:thunder-[a-z-]+|magic-cs-[1-9][0-9]{0,3})$/:/^thunder-[a-z-]+$/).test(raw[k])?raw[k]:"";for(const e of engines)if(shapes.includes(raw.samples?.[e]))s.samples[e]=raw.samples[e];return s}
 let state;try{state=normalize(JSON.parse(storage.getItem(key)||"{}"))}catch{state=normalize()}
 function patch(v){state=normalize({...state,...v});try{storage.setItem(key,JSON.stringify(state))}catch{}return state}
 return {get:()=>state,patch,sample:(engine,id)=>patch({samples:{...state.samples,[engine]:id}}),normalize};
})((()=>{try{return localStorage}catch{return null}})());
if(typeof module!=='undefined')module.exports=EffectViewState;
