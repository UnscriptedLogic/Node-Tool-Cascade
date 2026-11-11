'use strict';
/* ================= edges + animation ================= */
const EP = new Map(), TPM = new Map();
function pathEl(key,cls,marker,markerStart){
  let p = EP.get(key);
  if(!p){ p = document.createElementNS(SVGNS,'path'); gEdges.appendChild(p); EP.set(key,p); }
  p.setAttribute('class',cls);
  if(marker) p.setAttribute('marker-end','url(#ah)'); else p.removeAttribute('marker-end');
  if(markerStart) p.setAttribute('marker-start','url(#ah)'); else p.removeAttribute('marker-start');
  return p;
}
function linkPath(a,b){ const q = linkAnchors(a,b); return wirePath(q.x1,q.y1,q.x2,q.y2,q.d1,q.d2,effLook().wires,40); }
function drawEdges(){
  const seen = new Set();
  for(const id in R){
    const r = R[id]; if(!r.shown) continue;
    const n = S.nodes[id]; if(!n) continue;
    const pid = effParent(id); if(!pid) continue;
    const pr = R[pid]; if(!pr || !pr.shown) continue;
    const key = 'e'+id; seen.add(key);
    const p = pathEl(key, (n.ghost?'g':'')+(n.back?' back':''), false, !!n.back); p._e = [id,pid];
    p.setAttribute('d',wirePath(pr.cur.x+pr.w,pr.cur.y+pr.h/2,r.cur.x,r.cur.y+r.h/2,1,1,effLook().wires,36));
    applyWire(p,n.back ? 'back' : 'tree',n,S.nodes[pid],n.ghost);
  }
  for(const L of S.links){
    const a = R[L.a], b = R[L.b];
    if(!a || !b || !a.shown || !b.shown) continue;
    const na = S.nodes[L.a], nb = S.nodes[L.b];
    if(L.kind==='block' && !S.layer) continue;
    const key = 'l'+L.a+'_'+L.b; seen.add(key);
    const ghost = na.ghost || nb.ghost;
    const kind = L.kind==='flow' ? 'flow' : L.kind==='block' ? 'block' : 'rel';
    const p = pathEl(key, kind + (ghost?' g':''), kind==='flow' || kind==='block'); p._e = [L.a,L.b];
    p.setAttribute('d', linkPath(a,b));
    applyWire(p,kind==='rel' ? 'related' : kind,nb,na,ghost);
  }
  const seenT = new Set();
  for(const t of THR){
    for(let k=0; k<t.ids.length-1; k++){
      const a = R[t.ids[k]], b = R[t.ids[k+1]];
      if(!a || !b || !a.shown || !b.shown) continue;
      const key = 't'+t.i+'_'+k; seenT.add(key);
      let p = TPM.get(key);
      if(!p){ p = document.createElementNS(SVGNS,'path'); gTh.appendChild(p); TPM.set(key,p); }
      p.setAttribute('class','th t'+(t.i%3)); p.setAttribute('marker-end','url(#ah)'); p.setAttribute('d',linkPath(a,b));
    }
  }
  TPM.forEach((p,k)=>{ if(!seenT.has(k)){ p.remove(); TPM.delete(k); } });
  EP.forEach((p,k)=>{ if(!seen.has(k)){ p.remove(); EP.delete(k); } });
  let show = false; const fid = S.sel || flashId;
  if(fid && R[fid] && R[fid].shown && S.nodes[fid]){
    const n = S.nodes[fid], pid = effParent(fid);
    if(n.rel && pid && R[pid] && R[pid].shown && S.view.z>=.5){
      const a = R[pid], b = R[fid];
      elabel.setAttribute('x', (a.cur.x+a.w+b.cur.x)/2);
      elabel.setAttribute('y', (a.cur.y+a.h/2+b.cur.y+b.h/2)/2 - 7);
      elabel.textContent = n.rel; show = true;
    }
  }
  elabel.style.display = show ? '' : 'none';
}
/* ---- culling: in a big tree most blocks are off screen. A block that cannot be seen is hidden (visibility keeps its size, so
   layout still works), which cuts the browser's painting and layer work several times over. Cheap to run every frame: it only
   does arithmetic and touches a block when it crosses the line. ---- */
const CULL_MIN = 100, CULL_MARGIN = .6;
let SW = 0, SH = 0, culledAny = false;
function measureStage(){ SW = stage.clientWidth; SH = stage.clientHeight; }
if(typeof ResizeObserver!=='undefined') new ResizeObserver(()=>{ measureStage(); cullNodes(); }).observe(stage); else addEventListener('resize',()=>{ measureStage(); cullNodes(); });
function cullNodes(){
  if(!SW) measureStage();
  const ids = Object.keys(R);
  if(ids.length<CULL_MIN || !SW || !SH){
    if(culledAny){ culledAny = false; for(const id of ids){ const r = R[id]; if(r.culled){ r.culled = false; r.el.classList.remove('culled'); } } EP.forEach(p=>{ if(p._h){ p._h = false; p.style.visibility = ''; } }); }
    return;
  }
  const v = S.view, z = v.z, x0 = (-v.x-SW*CULL_MARGIN)/z, x1 = (-v.x+SW*(1+CULL_MARGIN))/z, y0 = (-v.y-SH*CULL_MARGIN)/z, y1 = (-v.y+SH*(1+CULL_MARGIN))/z;
  for(const id of ids){
    const r = R[id];
    const off = !!(r.shown && !r.dragging && !r.editing && !r.enter && S.sel!==id && (r.cur.x+r.w<x0 || r.cur.x>x1 || r.cur.y+r.h<y0 || r.cur.y>y1));
    if(off!==!!r.culled){ r.culled = off; r.el.classList.toggle('culled',off); if(off) culledAny = true; }
  }
  EP.forEach(p=>{
    const e = p._e; if(!e) return;
    const a = R[e[0]], b = R[e[1]], hide = !!(a && b && a.culled && b.culled);
    if(hide!==!!p._h){ p._h = hide; p.style.visibility = hide ? 'hidden' : ''; }
  });
}
let raf = 0, last = 0, edgesDirty = true;
function schedule(){ if(!raf){ last = performance.now(); raf = requestAnimationFrame(tick); } }
function kick(){ edgesDirty = true; schedule(); }   // something about the tree changed
function kickView(){ schedule(); }                  // only the camera is moving: the edges stay as they are
function tick(now){
  raf = 0;
  const dt = Math.min(.05,(now-last)/1000); last = now;
  const k = reduce ? 1 : 1 - Math.exp(-dt/.085);
  let moving = false, nodesMoved = false;
  for(const id in R){
    const r = R[id]; if(!r.shown) continue;
    if(!r.dragging){
      const dx = r.tgt.x-r.cur.x, dy = r.tgt.y-r.cur.y;
      if(Math.abs(dx)>.4 || Math.abs(dy)>.4){ r.cur.x += dx*k; r.cur.y += dy*k; moving = true; }
      else { r.cur.x = r.tgt.x; r.cur.y = r.tgt.y; }
    } else moving = true;
    if(r.tx!==r.cur.x || r.ty!==r.cur.y){ r.tx = r.cur.x; r.ty = r.cur.y; r.el.style.transform = `translate(${r.tx}px,${r.ty}px)`; nodesMoved = true; }
  }
  if(vAnim){
    const v = S.view, kv = reduce ? 1 : 1 - Math.exp(-dt/.12);
    v.x += (vAnim.x-v.x)*kv; v.y += (vAnim.y-v.y)*kv; v.z += (vAnim.z-v.z)*kv;
    if(Math.abs(vAnim.x-v.x)<.5 && Math.abs(vAnim.y-v.y)<.5 && Math.abs(vAnim.z-v.z)<.002){ Object.assign(v,vAnim); vAnim = null; save(); }
    else moving = true;
    applyView();
  }
  if(nodesMoved || edgesDirty){ drawEdges(); edgesDirty = false; }
  if(nodesMoved) cullNodes();
  if(moving) schedule();
}

