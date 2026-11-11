'use strict';
/* ================= anonymous usage counts ================= */
// Only the cloud version sends anything, and only a short event name with a block type or similar label: never text, prompts,
// keys or names. The local app and the static GitHub Pages build send nothing at all. Do Not Track, Global Privacy Control and the
// switch in Settings > Data all turn it off.
const ANALYTICS = { on:false };            // set when the server says it is counting
const ANALYTICS_OFF = 'cascade-analytics-off';
function analyticsAllowed(){
  try{ if(localStorage.getItem(ANALYTICS_OFF)==='1') return false; }catch(e){}
  return !(navigator.doNotTrack==='1' || window.doNotTrack==='1' || navigator.globalPrivacyControl);
}
function track(name,o){
  if(!ANALYTICS.on || !analyticsAllowed()) return;
  try{
    const body = JSON.stringify(Object.assign({name},o || {}));
    if(!(navigator.sendBeacon && navigator.sendBeacon('/api/event',new Blob([body],{type:'application/json'})))) fetch('/api/event',{method:'POST',headers:{'content-type':'application/json'},body,keepalive:true}).catch(()=>{});
  }catch(e){}
}
// ghost suggestions a person kept or dismissed, counted per block type
function trackGhosts(name,ids){
  const by = {}; ids.forEach(i=>{ const n = S.nodes[i]; if(n && n.ghost) by[n.type] = (by[n.type] || 0) + 1; });
  Object.keys(by).forEach(t=>track(name,{label:t,count:by[t]}));
}
