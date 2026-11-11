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
    const p = pathEl(key, (n.ghost?'g':'')+(n.back?' back':''), false, !!n.back);
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
    const p = pathEl(key, kind + (ghost?' g':''), kind==='flow' || kind==='block');
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
let raf = 0, last = 0;
function kick(){ if(!raf){ last = performance.now(); raf = requestAnimationFrame(tick); } }
function tick(now){
  raf = 0;
  const dt = Math.min(.05,(now-last)/1000); last = now;
  const k = reduce ? 1 : 1 - Math.exp(-dt/.085);
  let moving = false;
  for(const id in R){
    const r = R[id]; if(!r.shown) continue;
    if(!r.dragging){
      const dx = r.tgt.x-r.cur.x, dy = r.tgt.y-r.cur.y;
      if(Math.abs(dx)>.4 || Math.abs(dy)>.4){ r.cur.x += dx*k; r.cur.y += dy*k; moving = true; }
      else { r.cur.x = r.tgt.x; r.cur.y = r.tgt.y; }
    } else moving = true;
    r.el.style.transform = `translate(${r.cur.x}px,${r.cur.y}px)`;
  }
  if(vAnim){
    const v = S.view, kv = reduce ? 1 : 1 - Math.exp(-dt/.12);
    v.x += (vAnim.x-v.x)*kv; v.y += (vAnim.y-v.y)*kv; v.z += (vAnim.z-v.z)*kv;
    if(Math.abs(vAnim.x-v.x)<.5 && Math.abs(vAnim.y-v.y)<.5 && Math.abs(vAnim.z-v.z)<.002){ Object.assign(v,vAnim); vAnim = null; save(); }
    else moving = true;
    applyView();
  }
  drawEdges();
  if(moving) kick();
}

