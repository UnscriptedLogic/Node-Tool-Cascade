'use strict';
/* ================= actions ================= */
function acceptGhost(id){ pushHist(); acceptChain(id); const r=R[id]; if(r){ r.settle=true; setTimeout(()=>{ r.settle=false; restyle(); },600); } commit(); }
function dismissGhost(id){ pushHist(); removeSubtree(id); commit(); }
function keepAll(){ pushHist(); for(const id in S.nodes) S.nodes[id].ghost = false; commit(); }
function dismissAll(){ pushHist(); Object.values(S.nodes).filter(n=>n.ghost).forEach(n=>removeSubtree(n.id)); commit(); }
function deleteNode(id,branch){
  const n = S.nodes[id]; if(!n) return;
  if(n.ghost) return dismissGhost(id);
  rebuildKM();
  const kids = (KM[id]||[]).slice();
  pushHist();
  if(branch || !kids.length){
    const below = descendants(id).length;
    removeSubtree(id); commit();
    showNote(['Deleted ',{b:`“${n.text}”`},below ? ` and ${below} ${below===1?'node':'nodes'} below it.` : '.'],true);
  } else {
    kids.forEach(k=>{ S.nodes[k].parent = n.parent; });
    delete S.nodes[id]; S.order = S.order.filter(x=>x!==id); S.links = S.links.filter(l=>l.a!==id && l.b!==id);
    if(S.sel===id) S.sel = null;
    commit();
    showNote(['Deleted ',{b:`“${n.text}”`},`. Its ${kids.length} ${kids.length===1?'child moved':'children moved'} up a level.`],true);
  }
}
function clearGraph(){
  if(!S.order.length) return;
  cancelAI(); pushHist(true);
  S.nodes = {}; S.order = []; S.links = []; S.sel = null; flashId = null; S.mode = 'detail';
  vAnim = null; S.view = {x:140,y:200,z:1};
  layout(false); applyView(); save(); updateHud();
  showNote(['Graph cleared.'],true);
}
function toggleCollapse(id){ pushHist(); S.nodes[id].collapsed = !S.nodes[id].collapsed; commit(); }
function openLoop(id){ setMode('detail',{focus:id}); }
function undo(){
  cancelAI();
  const h = hist.pop(); if(!h) return;
  applySnap(h.s); if(h.v){ vAnim = null; Object.assign(S.view,h.v); applyView(); }
  layout(false); save(); updateHud(); note.hidden = true;
}
function resetTree(){ cancelAI(); pushHist(); const t = seed(); S.nodes=t.nodes; S.order=t.order; S.links=t.links; S.seq=t.seq; S.sel=null; S.mode='detail'; layout(false); initialView(); save(); updateHud(); }
function initialView(instant){
  const ex = S.order.find(id=>S.nodes[id] && S.nodes[id].type==='loop' && S.nodes[id].text==='Explore');
  if(ex){ rebuildKM(); const core = S.nodes[ex].parent; fitTo([core,ex,...descendants(ex)].filter(Boolean),{maxZ:1,minZ:.7,pad:40,instant:!!instant}); }
  else fitTo(visibleIds(),{maxZ:1,minZ:.5,instant:!!instant});
}

