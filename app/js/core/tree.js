'use strict';
/* ================= tree helpers ================= */
let hasLoop = false;
const isOuter = (n) => n.type==='loop' || (!hasLoop && !n.parent);
function rebuildKM(){
  KM = {};
  for(const id of S.order){ const n = S.nodes[id]; if(n) (KM[n.parent||'']||(KM[n.parent||'']=[])).push(id); }
  hasLoop = S.order.some(id=>S.nodes[id] && S.nodes[id].type==='loop');
}
function computeMap(){
  const m = {frontier:[],blocked:[],settled:[],fog:[],out:[],flag:{}}, blockers = {};
  for(const L of S.links) if(L.kind==='block' && S.nodes[L.a] && S.nodes[L.b]) (blockers[L.b]||(blockers[L.b]=[])).push(L.a);
  for(const id of S.order){
    const n = S.nodes[id]; if(!n || n.ghost) continue;
    if(n.type==='fog'){ if(n.state==='out'){ m.out.push(id); m.flag[id]='out'; } else { m.fog.push(id); m.flag[id]='fog'; } continue; }
    if(n.type!=='question') continue;
    if(n.state==='out'){ m.out.push(id); m.flag[id]='out'; continue; }
    if(n.state==='settled'){ m.settled.push(id); m.flag[id]='settled'; continue; }
    const waiting = (blockers[id]||[]).filter(b=>{ const bn = S.nodes[b]; return bn && bn.state!=='settled' && bn.state!=='out'; });
    if(waiting.length){ m.blocked.push(id); m.flag[id]='blocked'; } else { m.frontier.push(id); m.flag[id]='frontier'; }
  }
  m.blockers = blockers;
  return m;
}
function blockCycle(blocker,blocked){
  const seen = new Set(), st = [blocked];
  while(st.length){ const x = st.pop(); if(x===blocker) return true; if(seen.has(x)) continue; seen.add(x); for(const l of S.links) if(l.kind==='block' && l.a===x) st.push(l.b); }
  return false;
}
function descendants(id){ const out=[], st=[id]; while(st.length){ const x=st.pop(); (KM[x]||[]).forEach(c=>{ out.push(c); st.push(c); }); } return out; }
function effParent(id){ let p = S.nodes[id].parent; if(S.mode==='outer'){ while(p && !isOuter(S.nodes[p])) p = S.nodes[p].parent; } return p; }
function visibleIds(){
  const out = [];
  for(const id of S.order){
    const n = S.nodes[id]; if(!n) continue;
    if(S.mode==='outer'){ if(isOuter(n)) out.push(id); continue; }
    let p = n.parent, ok = true;
    while(p){ const pn = S.nodes[p]; if(!pn || pn.collapsed){ ok = false; break; } p = pn.parent; }   // a missing parent (removed while suggestions were still arriving) hides the orphan
    if(ok) out.push(id);
  }
  return out;
}
function removeSubtree(id){
  rebuildKM();
  [id,...descendants(id)].forEach(x=>{ delete S.nodes[x]; });
  S.order = S.order.filter(x=>S.nodes[x]);
  S.links = S.links.filter(l=>S.nodes[l.a] && S.nodes[l.b]);
  if(S.sel && !S.nodes[S.sel]) S.sel = null;
}
function acceptChain(id){ let n = S.nodes[id]; while(n){ n.ghost = false; n = n.parent && S.nodes[n.parent]; } }
function expandChain(id){ let n = S.nodes[id]; while(n){ n.collapsed = false; n = n.parent && S.nodes[n.parent]; } }
function addNode({type,text,parent,rel,mood,ghost,spawn}){
  const id = 'n'+(++S.seq);
  const n = {id,type,text,parent,ghost:!!ghost};
  if(rel) n.rel = rel;
  if(type==='emotion') n.mood = mood || 'curiosity';
  S.nodes[id] = n; S.order.push(id);
  if(!ghost) acceptChain(parent);
  expandChain(parent);
  if(spawn) spawnAt[id] = spawn;
  return id;
}

