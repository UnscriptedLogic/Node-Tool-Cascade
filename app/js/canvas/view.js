'use strict';
/* ================= view ================= */
const gridEl = document.getElementById('grid');
let vz = 0, vgs = 0, vflags = '';
function applyView(){
  const v = S.view;
  world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.z})`;
  // only the grid layer and (when zoomed far out) the world get variables, and only when they change
  let gs = effLook().canvas.gridSize*v.z; while(gs<12) gs*=2;
  if(gs!==vgs){ vgs = gs; gridEl.style.setProperty('--gs', gs+'px'); }
  gridEl.style.transform = `translate3d(${v.x%gs}px,${v.y%gs}px,0)`;
  const far = S.mode==='detail' && v.z<.55, flags = (far ? 'f' : '')+(S.mode==='outer' ? 'o' : '')+(S.layer ? 'm' : '');
  if(flags!==vflags){ vflags = flags; world.classList.toggle('far',far); world.classList.toggle('outer',S.mode==='outer'); world.classList.toggle('maplayer',!!S.layer); }
  if(far && Math.abs(v.z-vz)>.01){ vz = v.z; world.style.setProperty('--z',v.z.toFixed(2)); }
  cullNodes();
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
  if(o.instant){ Object.assign(S.view,t); vAnim=null; applyView(); } else { vAnim=t; kickView(); }
}
function ensureVisible(id){
  const r = R[id]; if(!r || !r.shown) return;
  const v = S.view, sw = stage.clientWidth - drawerW(), sh = stage.clientHeight, m = 70;
  const x0 = r.tgt.x*v.z+v.x, y0 = r.tgt.y*v.z+v.y, x1 = x0+r.w*v.z, y1 = y0+r.h*v.z;
  if(x0>=m && y0>=m+30 && x1<=sw-m && y1<=sh-m) return;
  const z = Math.max(v.z,.7);
  vAnim = {z, x: sw/2-(r.tgt.x+r.w/2)*z, y: sh/2-(r.tgt.y+r.h/2)*z}; kickView();
}
// touch and trackpads fire many events per frame: apply the camera once per frame
let viewRaf = 0;
function scheduleView(){ if(!viewRaf) viewRaf = requestAnimationFrame(()=>{ viewRaf = 0; applyView(); }); }
function flushView(){ if(viewRaf){ cancelAnimationFrame(viewRaf); viewRaf = 0; applyView(); } }
function zoomAt(f,cx,cy,defer){
  vAnim = null;
  const v = S.view, nz = clamp(v.z*f,.18,1.8), k = nz/v.z;
  v.x = cx-(cx-v.x)*k; v.y = cy-(cy-v.y)*k; v.z = nz; if(defer) scheduleView(); else applyView();
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

