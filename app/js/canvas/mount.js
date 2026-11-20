'use strict';

const graphCanvas = CascadeGraphCanvas.createCanvas({
  elements:{stage,world,gridEl:$('#grid'),gEdges,gTh,elabel},
  getGraph:canvasState,getLook:effLook,getInset:()=>drawerW(),reduce,overviewFilter,
  initializeNode(el){
    el.innerHTML = '<div class="in blk"><button type="button" class="mindset-label" hidden></button><span class="ico"></span><span class="txt"></span><span class="srcmark" role="button" aria-label="Where this came from"></span><small class="code-caption" hidden></small><span class="badge"></span><span class="mbadge"></span></div><div class="bar"></div>';
  },
  nodeW:(type,node)=>node?.codeId ? SKILL_NODE_SIZE : nodeW(type),
  prepareNodes(graph,children){ rebuildKM(graph,children); MAP = computeMap(graph); },
  paintNode:paintCanvasNode,
  extraNodeClasses:canvasNodeClasses,
  beforeRestyle(graph){ MAP = computeMap(graph); },
  restyleNode:stepAttr,
  applyWire,paintLink:paintCanvasLink,getThreads:()=>THR,getHighlightedId:()=>flashId,
  onZoom(point,z){
    if(isClassCanvas()) return;
    if(canvasState().mode==='detail' && z<.3) setMode('outer');
    else if(canvasState().mode==='outer' && z>1.25) setMode('detail',{focus:graphCanvas.closestVisibleNode(point)});
  },
  onViewSettled(){ if(!isClassCanvas()) save(); }
});

const {layout,restyle,kick,applyView,screenToWorld,fitTo,ensureVisible,zoomAt,cancelViewAnimation} = graphCanvas;
const {wirePath} = CascadeGraphGeometry;

function setMode(m,o){
  if(isClassCanvas()) return;
  o = o || {};
  if(canvasState().mode===m){ updateHud(); return; }
  canvasState().mode = m;
  if(m==='detail' && o.focus){ expandChain(o.focus); canvasState().nodes[o.focus].collapsed = false; }
  layout(false);
  if(m==='outer') fitTo(visibleIds(),{maxZ:1,minZ:.3,pad:56});
  else if(o.focus){ rebuildKM(); fitTo([o.focus,...descendants(o.focus)],{maxZ:1,minZ:.55}); }
  else fitTo(visibleIds(),{maxZ:1,minZ:.5});
  applyView(); updateHud(); save();
}
