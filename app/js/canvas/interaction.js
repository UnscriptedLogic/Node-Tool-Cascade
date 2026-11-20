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
let lastTap = {id:null,t:0};
function reparentNode(id,parent){
  if(isClassCanvas()) return false;
  const node = S.nodes[id], target = S.nodes[parent];
  if(!node || !target || node.parent===parent) return false;
  pushHist();
  node.parent = parent;
  node.rel = '';
  S.order = S.order.filter(x=>x!==id);
  S.order.push(id);
  if(!node.ghost) acceptChain(parent);
  expandChain(parent);
  commit();
  showNote(['Moved under ',{b:`“${target.text}”`},'.'],true);
  return true;
}

CascadeGraphInput.bindCanvasInput(stage,world,graphCanvas,{
  getGraph:canvasState,
  editable:()=>!isClassCanvas(),
  ignorePointer:target=>target.closest('#compose,.hud,.pending,.bar,#side,#codeExplorer,#codeLegend,.srcmark,.mindset-label,[data-code-edge],[contenteditable="true"]'),
  ignoreWheel:target=>target.closest?.('#side,#codeExplorer,#codeLegend'),
  onDragUi:dragUi,
  onBackgroundPointerDown(){
    if(!compose.hidden) closeCompose();
    if(canvasState().sel) select(null);
    if(linkFrom){ linkFrom = null; restyle(); }
  },
  onSelect:select,
  onReparent:reparentNode,
  onNodeTap(id,e){
    const now = Date.now();
    if(linkFrom){ finishBlock(id); lastTap = {id:null,t:0}; }
    else if(isMinimal()){ select(id); lastTap = {id:null,t:0}; if(!tapSuppressed) openNodeMenu(id,e.clientX,e.clientY); }
    else if(lastTap.id===id && now-lastTap.t<380){ beginEdit(id); lastTap = {id:null,t:0}; }
    else { select(id); lastTap = {id,t:now}; }
  },
  onViewChange(){ if(!isClassCanvas()) save(); },
  onBackgroundTap(e){ if(isMinimal() && !tapSuppressed) openCanvasMenu(e.clientX,e.clientY); },
  onPointerSequenceEnd(){ tapSuppressed = false; },
  onNodeAction:(action,id)=>runNodeAction(action,id)
});

function beginEdit(id,opts){
  if(isClassCanvas()) return;
  const r = graphCanvas.getNode(id), n = canvasState().nodes[id]; if(!r || !n) return;
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
stage.addEventListener('contextmenu',event=>{
  if(!isClassCanvas())return;
  const tile=event.target.closest('.skill-node');
  const blank=event.target===stage||event.target===world||event.target===$('#grid');
  if(!blank&&(!tile||tile.classList.contains('proposal-tile')))return;
  event.preventDefault();
  graphCanvas.hoverDependencyNode(null);
  if(tile)openNodeMenu(tile.dataset.id,event.clientX,event.clientY);
  else openCanvasMenu(event.clientX,event.clientY);
});
world.addEventListener('pointerover',event=>{
  if(!isClassCanvas()||event.pointerType==='touch')return;
  if(canvasState().previewActive||menuEl)return;
  const tile=event.target.closest('.skill-node');
  if(tile)graphCanvas.hoverDependencyNode(tile.dataset.id);
});
world.addEventListener('pointerout',event=>{
  if(!isClassCanvas()||event.pointerType==='touch')return;
  const tile=event.target.closest('.skill-node');
  if(tile&&!tile.contains(event.relatedTarget))graphCanvas.hoverDependencyNode(null);
});
world.addEventListener('click',e=>{
  const edge=e.target.closest('[data-code-edge]'); if(edge && isClassCanvas()){ e.stopPropagation(); CLASS_CANVAS.edge?.(edge.dataset.codeEdge); return; }
  const ml = e.target.closest('.mindset-label'); if(ml){ e.stopPropagation(); showNote([ml.title.replace(/\n/g,'. ')],false); return; }
  const sm = e.target.closest('.srcmark'); if(sm){ e.stopPropagation(); openNodeSrc(sm.closest('.node').dataset.id); return; }
});
addEventListener('keydown',e=>{
  if(e.target.matches && e.target.matches('input,select,textarea,[contenteditable="true"]')) return;
  if(!document.getElementById('settings').hidden) return;
  if(isClassCanvas()){
    if((e.key==='ContextMenu'||e.shiftKey&&e.key==='F10')&&e.target.matches('.skill-node:not(.proposal-tile)')){
      e.preventDefault();
      const rect=e.target.getBoundingClientRect();
      graphCanvas.hoverDependencyNode(null);
      openNodeMenu(e.target.dataset.id,rect.left+rect.width/2,rect.bottom);
    }
    else if(e.key==='Enter' && e.target.matches('.node')) select(e.target.dataset.id);
    else if(['Enter',' '].includes(e.key) && e.target.matches('[data-code-edge]')){ e.preventDefault(); CLASS_CANVAS.edge?.(e.target.dataset.codeEdge); }
    else if(e.key==='Escape') select(null);
    else if(['Delete','Backspace'].includes(e.key)||(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z') e.preventDefault();
    return;
  }
  if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='z'){ e.preventDefault(); undo(); }
  else if(e.key==='Escape'){ closeCompose(); select(null); if(linkFrom){ linkFrom = null; restyle(); } }
  else if((e.key==='Delete'||e.key==='Backspace') && canvasState().sel){ e.preventDefault(); deleteNode(canvasState().sel,e.shiftKey); }
  else if(e.key==='Enter' && e.target.classList && e.target.classList.contains('node')){ select(e.target.dataset.id); }
});

