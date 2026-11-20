'use strict';

const CascadeGraphInput = (() => {
  const model = typeof module !== 'undefined' && module.exports ? require('./model') : CascadeGraphModel;

  function bindCanvasInput(stage,world,canvas,{
    getGraph,editable,ignorePointer,ignoreWheel,onDragUi,onBackgroundPointerDown,
    onSelect,onReparent,onNodeTap,onViewChange,onBackgroundTap,onPointerSequenceEnd,onNodeAction
  }){
    const document = stage.ownerDocument;
    const controller = new document.defaultView.AbortController();
    const listen = (element,type,handler,options) => element.addEventListener(type,handler,{...options,signal:controller.signal});
    const {getNode,cancelViewAnimation,zoomAt,restyle,kick,scheduleView,flushView} = canvas;
    const {indexChildren,descendants} = model;

    const ptrs = new Map();
    let pan = null, pinch = null, nd = null;

    function clearDrag(drag){
      for(const id of drag.set){
        const node = getNode(id);
        if(node) node.dragging = false;
      }
      const source = getNode(drag.id), target = getNode(drag.drop);
      if(source) source.drag = false;
      if(target) target.drop = false;
    }
    listen(stage,'pointerdown',e=>{
      if(e.button>0||ignorePointer(e.target)) return;
      onDragUi(true);
      stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
      cancelViewAnimation();
      if(ptrs.size===2){
        const [a,b] = [...ptrs.values()];
        pinch = {d:Math.hypot(a.x-b.x,a.y-b.y)||1}; pan = null; nd = null; stage.classList.remove('panning'); return;
      }
      const nodeEl = e.target.closest('.node');
      if(nodeEl){ nd = {id:nodeEl.dataset.id,sx:e.clientX,sy:e.clientY,drag:false,pid:e.pointerId,set:null,drop:null}; }
      else{
        pan = {sx:e.clientX,sy:e.clientY,vx:getGraph().view.x,vy:getGraph().view.y,moved:false}; stage.classList.add('panning');
        onBackgroundPointerDown();
      }
    });
    listen(stage,'pointermove',e=>{
      if(ptrs.has(e.pointerId)) ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pinch && ptrs.size>=2){
        const [a,b] = [...ptrs.values()], d = Math.hypot(a.x-b.x,a.y-b.y)||1, r = stage.getBoundingClientRect();
        zoomAt(d/pinch.d,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top,true); pinch.d = d; return;
      }
      if(nd && !editable() && Math.hypot(e.clientX-nd.sx,e.clientY-nd.sy)>6){ pan={sx:nd.sx,sy:nd.sy,vx:getGraph().view.x,vy:getGraph().view.y,moved:true}; nd=null; }
      if(nd && e.pointerId===nd.pid){
        if(!nd.drag && Math.hypot(e.clientX-nd.sx,e.clientY-nd.sy)>6){
          const n = getGraph().nodes[nd.id];
          if(n && n.parent && getGraph().mode==='detail'){
            nd.set = new Set([nd.id,...descendants(indexChildren(getGraph()),nd.id)]);
            nd.set.forEach(x=>{ if(getNode(x)) getNode(x).dragging = true; });
            getNode(nd.id).drag = true; nd.drag = true; nd.lx = e.clientX; nd.ly = e.clientY; onSelect(nd.id);
          } else { nd = null; }
        }
        if(nd && nd.drag){
          const dx = (e.clientX-nd.lx)/getGraph().view.z, dy = (e.clientY-nd.ly)/getGraph().view.z; nd.lx = e.clientX; nd.ly = e.clientY;
          nd.set.forEach(x=>{ const r = getNode(x); if(r && r.shown){ r.cur.x += dx; r.cur.y += dy; } });
          let t = null;
          for(const el of document.elementsFromPoint(e.clientX,e.clientY)){
            const ne = el.closest && el.closest('.node');
            if(ne && getNode(ne.dataset.id)?.el===ne && !nd.set.has(ne.dataset.id)){ t = ne.dataset.id; break; }
          }
          if(t!==nd.drop){ if(nd.drop && getNode(nd.drop)) getNode(nd.drop).drop = false; nd.drop = t; if(t) getNode(t).drop = true; restyle(); }
          kick();
        }
      } else if(pan){
        if(!pan.moved && Math.hypot(e.clientX-pan.sx,e.clientY-pan.sy)>8) pan.moved = true;
        getGraph().view.x = pan.vx + (e.clientX-pan.sx); getGraph().view.y = pan.vy + (e.clientY-pan.sy); scheduleView();
      }
    });
    function endPointer(e){
      ptrs.delete(e.pointerId);
      if(!ptrs.size) onDragUi(false);
      if(pinch && ptrs.size<2) pinch = null;
      if(nd && e.pointerId===nd.pid){
        const id = nd.id;
        if(nd.drag){
          clearDrag(nd);
          const t = nd.drop;
          if(!t || !onReparent(id,t)){ restyle(); kick(); }
        } else if(getGraph().nodes[id]){
          onNodeTap(id,e);
        }
        nd = null;
      }
      if(pan){
        const tapped = !pan.moved && e.type==='pointerup' && !ptrs.size;
        pan = null; stage.classList.remove('panning'); flushView(); onViewChange();
        if(tapped) onBackgroundTap(e);
      } else if(!ptrs.size) flushView();
      if(!ptrs.size) onPointerSequenceEnd();
    }
    listen(stage,'pointerup',endPointer);
    listen(stage,'pointercancel',endPointer);
    listen(stage,'wheel',e=>{
      if(ignoreWheel(e.target)) return;
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY*(e.ctrlKey?.01:.0016)),e.clientX-r.left,e.clientY-r.top,true);
    },{passive:false});

    listen(world,'click',e=>{
      const button = e.target.closest('button[data-act]');
      const node = button?.closest('.node');
      if(!node || getNode(node.dataset.id)?.el!==node) return;
      e.stopPropagation();
      onNodeAction(button.dataset.act,node.dataset.id);
    });
    return () => {
      controller.abort();
      for(const id of ptrs.keys()) if(stage.hasPointerCapture?.(id)) stage.releasePointerCapture(id);
      if(nd?.drag){ clearDrag(nd); restyle(); kick(); }
      if(ptrs.size) onDragUi(false);
      stage.classList.remove('panning');
    };
  }

  return {bindCanvasInput};
})();

if(typeof module !== 'undefined' && module.exports) module.exports = CascadeGraphInput;
