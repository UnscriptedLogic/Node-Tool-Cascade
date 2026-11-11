'use strict';
/* ================= canvas interaction ================= */
function dragUi(on){
  document.body.classList.toggle('dragging',on);
  if(on){ try{ getSelection().removeAllRanges(); }catch(e){} }
}
document.addEventListener('selectstart',e=>{ if(document.body.classList.contains('dragging')) e.preventDefault(); });
document.addEventListener('dragstart',e=>{
  const t = e.target && e.target.nodeType===3 ? e.target.parentElement : e.target;
  if(t && t.closest && t.closest('#stage,#rail') && !t.closest('textarea,input')) e.preventDefault();
});
const ptrs = new Map(); let pan = null, pinch = null, nd = null, lastTap = {id:null,t:0};
stage.addEventListener('pointerdown',e=>{
  if(e.target.closest('#compose,.hud,.pending,.bar,#side,.srcmark')) return;
  if(e.target.closest('[contenteditable="true"]')) return;
  dragUi(true);
  stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  vAnim = null;
  if(ptrs.size===2){
    const [a,b] = [...ptrs.values()];
    pinch = {d:Math.hypot(a.x-b.x,a.y-b.y)||1}; pan = null; nd = null; stage.classList.remove('panning'); return;
  }
  const nodeEl = e.target.closest('.node');
  if(nodeEl){ nd = {id:nodeEl.dataset.id,sx:e.clientX,sy:e.clientY,drag:false,pid:e.pointerId,set:null,drop:null}; }
  else{
    pan = {sx:e.clientX,sy:e.clientY,vx:S.view.x,vy:S.view.y}; stage.classList.add('panning');
    if(compose.hidden===false) closeCompose();
    if(S.sel) select(null);
    if(linkFrom){ linkFrom = null; restyle(); }
  }
});
stage.addEventListener('pointermove',e=>{
  if(ptrs.has(e.pointerId)) ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch && ptrs.size>=2){
    const [a,b] = [...ptrs.values()], d = Math.hypot(a.x-b.x,a.y-b.y)||1, r = stage.getBoundingClientRect();
    zoomAt(d/pinch.d,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top); pinch.d = d; return;
  }
  if(nd && e.pointerId===nd.pid){
    if(!nd.drag && Math.hypot(e.clientX-nd.sx,e.clientY-nd.sy)>6){
      const n = S.nodes[nd.id];
      if(n && n.parent && S.mode==='detail'){
        rebuildKM(); nd.set = new Set([nd.id,...descendants(nd.id)]);
        nd.set.forEach(x=>{ if(R[x]) R[x].dragging = true; });
        R[nd.id].drag = true; nd.drag = true; nd.lx = e.clientX; nd.ly = e.clientY; select(nd.id);
      } else { nd = null; }
    }
    if(nd && nd.drag){
      const dx = (e.clientX-nd.lx)/S.view.z, dy = (e.clientY-nd.ly)/S.view.z; nd.lx = e.clientX; nd.ly = e.clientY;
      nd.set.forEach(x=>{ const r = R[x]; if(r && r.shown){ r.cur.x += dx; r.cur.y += dy; } });
      let t = null;
      for(const el of document.elementsFromPoint(e.clientX,e.clientY)){
        const ne = el.closest && el.closest('.node');
        if(ne && !nd.set.has(ne.dataset.id)){ t = ne.dataset.id; break; }
      }
      if(t!==nd.drop){ if(nd.drop && R[nd.drop]) R[nd.drop].drop = false; nd.drop = t; if(t) R[t].drop = true; restyle(); }
      kick();
    }
  } else if(pan){
    S.view.x = pan.vx + (e.clientX-pan.sx); S.view.y = pan.vy + (e.clientY-pan.sy); applyView();
  }
});
function endPointer(e){
  ptrs.delete(e.pointerId);
  if(!ptrs.size) dragUi(false);
  if(pinch && ptrs.size<2) pinch = null;
  if(nd && e.pointerId===nd.pid){
    const id = nd.id;
    if(nd.drag){
      nd.set.forEach(x=>{ if(R[x]) R[x].dragging = false; });
      if(R[id]) R[id].drag = false;
      const t = nd.drop; if(t && R[t]) R[t].drop = false;
      if(t && S.nodes[t] && S.nodes[id] && t!==S.nodes[id].parent){
        pushHist(); const n = S.nodes[id]; n.parent = t; n.rel = '';
        S.order = S.order.filter(x=>x!==id); S.order.push(id);
        if(!n.ghost) acceptChain(t); expandChain(t);
        commit(); showNote(['Moved under ',{b:`“${S.nodes[t].text}”`},'.'],true);
      } else { restyle(); kick(); }
    } else if(S.nodes[id]){
      const now = Date.now();
      if(linkFrom){ finishBlock(id); lastTap = {id:null,t:0}; }
      else if(lastTap.id===id && now-lastTap.t<380){ beginEdit(id); lastTap = {id:null,t:0}; }
      else { select(id); lastTap = {id,t:now}; }
    }
    nd = null;
  }
  if(pan){ pan = null; stage.classList.remove('panning'); save(); }
}
stage.addEventListener('pointerup',endPointer);
stage.addEventListener('pointercancel',endPointer);
stage.addEventListener('wheel',e=>{
  if(e.target.closest && e.target.closest('#side')) return;
  e.preventDefault();
  const r = stage.getBoundingClientRect();
  zoomAt(Math.exp(-e.deltaY*(e.ctrlKey?.01:.0016)),e.clientX-r.left,e.clientY-r.top);
},{passive:false});
function beginEdit(id,opts){
  const r = R[id], n = S.nodes[id]; if(!r || !n) return;
  const txt = r.el.querySelector('.txt'); r.editing = true; txt.contentEditable = 'true'; txt.focus();
  if(opts && opts.graduate) showNote(['Rewrite it as a precise question, then press Enter.'],false);
  const range = document.createRange(); range.selectNodeContents(txt); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
  const finish = (keep) => {
    txt.removeEventListener('blur',onBlur); txt.removeEventListener('keydown',onKey);
    const v = txt.textContent.trim(); txt.contentEditable = 'false'; r.editing = false;
    if(keep && v && v!==n.text){ pushHist(); n.text = v.slice(0,220); if(opts && opts.graduate && n.type==='fog'){ n.type = 'question'; n.ticket = 'talk'; } } else txt.textContent = n.text;
    commit();
  };
  const onBlur = () => finish(true);
  const onKey = (e) => { if(e.key==='Enter'){ e.preventDefault(); txt.blur(); } else if(e.key==='Escape'){ e.preventDefault(); txt.removeEventListener('blur',onBlur); finish(false); } };
  txt.addEventListener('blur',onBlur); txt.addEventListener('keydown',onKey);
}
world.addEventListener('click',e=>{
  const sm = e.target.closest('.srcmark'); if(sm){ e.stopPropagation(); openNodeSrc(sm.closest('.node').dataset.id); return; }
  const b = e.target.closest('button[data-act]'); if(!b) return;
  const id = b.closest('.node').dataset.id; e.stopPropagation();
  ({accept:acceptGhost,dismiss:dismissGhost,grow:growNode,back:traceBack,collapse:toggleCollapse,del:(i)=>deleteNode(i,false),delb:(i)=>deleteNode(i,true),open:openLoop,resolve:startResolve,reopen:reopenQ,grill:startGrill,ticket:cycleTicket,block:startBlock,out:toggleOut,sharpen:(i)=>beginEdit(i,{graduate:true}),src:openNodeSrc})[b.dataset.act](id);
});
addEventListener('keydown',e=>{
  if(e.target.matches && e.target.matches('input,select,textarea,[contenteditable="true"]')) return;
  if(!document.getElementById('settings').hidden) return;
  if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='z'){ e.preventDefault(); undo(); }
  else if(e.key==='Escape'){ closeCompose(); select(null); if(linkFrom){ linkFrom = null; restyle(); } }
  else if((e.key==='Delete'||e.key==='Backspace') && S.sel){ e.preventDefault(); deleteNode(S.sel,e.shiftKey); }
  else if(e.key==='Enter' && e.target.classList && e.target.classList.contains('node')){ select(e.target.dataset.id); }
});

