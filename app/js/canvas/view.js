'use strict';
/* ================= view ================= */
function applyView(){
  const v = S.view;
  world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.z})`;
  stage.style.setProperty('--z', v.z);
  let gs = effLook().canvas.gridSize*v.z; while(gs<12) gs*=2;
  stage.style.setProperty('--gs', gs+'px');
  stage.style.setProperty('--gx', (v.x%gs)+'px');
  stage.style.setProperty('--gy', (v.y%gs)+'px');
  world.classList.toggle('far', S.mode==='detail' && v.z<.55);
  world.classList.toggle('outer', S.mode==='outer');
  world.classList.toggle('maplayer', !!S.layer);
}
const screenToWorld = (cx,cy) => { const r = stage.getBoundingClientRect(); return {x:(cx-r.left-S.view.x)/S.view.z, y:(cy-r.top-S.view.y)/S.view.z}; };
function fitTo(ids,o){
  o = Object.assign({maxZ:1,minZ:.2,pad:48,instant:false},o||{});
  ids = ids.filter(id=>R[id] && R[id].shown); if(!ids.length) return;
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  ids.forEach(id=>{ const r=R[id]; x0=Math.min(x0,r.tgt.x); y0=Math.min(y0,r.tgt.y); x1=Math.max(x1,r.tgt.x+r.w); y1=Math.max(y1,r.tgt.y+r.h); });
  const sw = (stage.clientWidth || 900) - drawerW(), sh = stage.clientHeight || 600, bw = x1-x0, bh = y1-y0;
  const z = clamp(Math.min((sw-2*o.pad)/bw,(sh-2*o.pad)/bh), o.minZ, o.maxZ);
  const t = {z, x: bw*z > sw-2*o.pad ? o.pad - x0*z : sw/2-(x0+bw/2)*z, y: bh*z > sh-2*o.pad ? o.pad + 40 - y0*z : sh/2-(y0+bh/2)*z};
  if(o.instant){ Object.assign(S.view,t); vAnim=null; applyView(); } else { vAnim=t; kick(); }
}
function ensureVisible(id){
  const r = R[id]; if(!r || !r.shown) return;
  const v = S.view, sw = stage.clientWidth - drawerW(), sh = stage.clientHeight, m = 70;
  const x0 = r.tgt.x*v.z+v.x, y0 = r.tgt.y*v.z+v.y, x1 = x0+r.w*v.z, y1 = y0+r.h*v.z;
  if(x0>=m && y0>=m+30 && x1<=sw-m && y1<=sh-m) return;
  const z = Math.max(v.z,.7);
  vAnim = {z, x: sw/2-(r.tgt.x+r.w/2)*z, y: sh/2-(r.tgt.y+r.h/2)*z}; kick();
}
function zoomAt(f,cx,cy){
  vAnim = null;
  const v = S.view, nz = clamp(v.z*f,.18,1.8), k = nz/v.z;
  v.x = cx-(cx-v.x)*k; v.y = cy-(cy-v.y)*k; v.z = nz; applyView();
  if(S.mode==='detail' && v.z<.3) setMode('outer');
  else if(S.mode==='outer' && v.z>1.25){
    const w = {x:(cx-v.x)/v.z, y:(cy-v.y)/v.z}; let best=null, bd=1e12;
    for(const id in R){ const r=R[id]; if(!r.shown) continue; const d=Math.hypot(r.tgt.x+r.w/2-w.x, r.tgt.y+r.h/2-w.y); if(d<bd){bd=d;best=id;} }
    setMode('detail',{focus:best});
  }
}
function setMode(m,o){
  o = o || {};
  if(S.mode===m){ updateHud(); return; }
  S.mode = m;
  if(m==='detail' && o.focus){ expandChain(o.focus); S.nodes[o.focus].collapsed = false; }
  layout(false);
  if(m==='outer') fitTo(visibleIds(),{maxZ:1,minZ:.3,pad:56});
  else if(o.focus){ rebuildKM(); fitTo([o.focus,...descendants(o.focus)],{maxZ:1,minZ:.55}); }
  else fitTo(visibleIds(),{maxZ:1,minZ:.5});
  applyView(); updateHud(); save();
}

