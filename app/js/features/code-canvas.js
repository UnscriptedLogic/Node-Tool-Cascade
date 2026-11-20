'use strict';
// Adapt scanned symbols to Cascade's normal nodes and links. Source graph stays immutable.
const codeCanvasId = id => 'code:'+id;
const codeCollapsed = new Set();
const codeExpanded = new Set();
function applyCodeInspection(model){
  const id=CLASS_CANVAS.inspectedId;
  if(!id || !model.nodes[id]) return;
  model.sel=id;
  const related=new Set([id]);
  if(!model.nodes[id].collapsed){
    for(const node of Object.values(model.nodes))if(node.parent===id)related.add(node.id);
  }
  const scope=new Set(related);
  for(const link of model.links){
    if(scope.has(link.a)||scope.has(link.b)){ related.add(link.a); related.add(link.b); }
  }
  const parent=model.nodes[id].parent;
  if(parent&&model.nodes[parent])related.add(parent);
  // Keep previously rendered branches available without including them in the focus layout.
  const previous=CLASS_CANVAS.state;
  for(const nodeId of previous?.order||[]){
    if(model.nodes[nodeId])continue;
    if(nodeId.startsWith('preview-'))continue;
    const {codePreview,codePreviewNote,...node}=previous.nodes[nodeId];
    model.nodes[nodeId]=node;
    model.order.push(nodeId);
  }
  model.inspection={id,related};
}

function applyCodePresentation(model){
  model.scriptTints=CLASS_CANVAS.scriptTints;
  applyCodeInspection(model);
  if(CLASS_CANVAS.preview)CodePreview.overlay(model,CLASS_CANVAS.preview);
}
function renderCodeCanvas(graph,selected,edges,selectedEdge,focus){
  if(!isClassCanvas()) return;
  const source=new Map(graph.nodes.map(n=>[n.id,n])), included=new Map(), limit=180;
  const chosen=source.get(selected);
  function add(id){
    if(included.has(id)) return true;
    const n=source.get(id); if(!n || included.size>=limit) return false;
    if(n.parent && (source.get(n.parent)?.kind!=='assembly'||chosen?.kind==='assembly') && !add(n.parent)) return false;
    if(included.size>=limit) return false;
    included.set(id,n); return true;
  }
  add(selected);
  const scopeView=['file','class','interface','struct','assembly','scene','prefab','asset','gameobject'].includes(chosen?.kind);
  const evidence=edges.filter(e=>!scopeView || ![e.a,e.b].some(id=>source.get(id)?.kind==='parameter')).slice(0,120);
  // Ensure an explicitly reviewed edge survives the display budget.
  const reviewed=edges.find(e=>e.id===selectedEdge);
  if(reviewed){ add(reviewed.a); add(reviewed.b); }
  for(const n of graph.nodes) if(n.parent===selected && n.kind!=='parameter') add(n.id);
  if(['scene','prefab','asset'].includes(chosen?.kind)) for(const n of graph.nodes) if(n.file===chosen.file) add(n.id);
  for(const e of evidence){ add(e.a); add(e.b); }
  for(const n of graph.nodes) if(included.has(n.parent) && codeExpanded.has(n.parent)) add(n.id);
  const old=CLASS_CANVAS.state;
  const definitionAncestors=new Set();
  for(const e of evidence) for(const id of [e.a,e.b]) if(['class','interface','struct'].includes(source.get(id)?.kind)){
    for(let n=source.get(source.get(id).parent);n;n=source.get(n.parent)) definitionAncestors.add(n.id);
  }
  const model={nodes:{},order:[],links:[],seq:0,mindsets:[],mode:'detail',layer:false,layout:codeVisualization==='radial'?'tree':codeVisualization,sel:codeCanvasId(selected),view:old ? old.view : {x:0,y:0,z:1}};
  for(const n of included.values()){
    const id=codeCanvasId(n.id), parent=n.parent && included.has(n.parent)?codeCanvasId(n.parent):null;
    const collapsed=codeCollapsed.has(n.id) || (!codeExpanded.has(n.id) && !definitionAncestors.has(n.id) && n.id!==selected && ['file','class','interface','struct','assembly','scene','prefab','asset','gameobject'].includes(n.kind) && !isAncestor(n.id,selected));
    model.nodes[id]={id,type:'answer',text:n.name,parent,collapsed,codeId:n.id,codeKind:n.kind,codeImpact:!!CLASS_CANVAS.affected?.has(n.id),codeCaption:n.kind+' · '+(n.qualifiedName?n.qualifiedName+' · ':'')+n.file+':'+n.line,src:[{f:n.file,l:n.line},...(n.declarations||[]).filter(d=>d.file!==n.file||d.line!==n.line).map(d=>({f:d.file,l:d.line}))],rel:'contains'};
    model.order.push(id);
  }
  function isAncestor(id,child){ let n=source.get(child); while(n?.parent){ if(n.parent===id) return true; n=source.get(n.parent); } return false; }
  function endpoint(id){
    let out=codeCanvasId(id), n=model.nodes[out]; if(!n) return null;
    while(n.parent){ n=model.nodes[n.parent]; if(n.collapsed) out=n.id; }
    return out;
  }
  const groups=new Map();
  for(const e of evidence.concat(reviewed && !evidence.includes(reviewed)?[reviewed]:[])){
    const a=endpoint(e.a), b=endpoint(e.b); if(!a||!b||a===b) continue;
    const key=[a,b,e.kind].join('|'); let link=groups.get(key);
    if(!link){ link={id:'code-link:'+key,a,b,kind:'flow',codeEdge:e.id,codeKind:e.kind,codeCount:0,codeLabel:e.file+':'+e.line,codeSelected:false}; groups.set(key,link); }
    link.codeCount++; if(e.id===selectedEdge){ link.codeSelected=true; link.codeEdge=e.id; }
  }
  model.links=[...groups.values()];
  model.visual={...CodeInspector.settings};
  const depth=id=>model.nodes[id]?.parent?1+depth(model.nodes[id].parent):0;
  const hidden=model.order.filter(id=>depth(id)>model.visual.layers);
  for(const id of hidden)delete model.nodes[id];
  model.order=model.order.filter(id=>model.nodes[id]);
  model.links=model.links.filter(link=>model.nodes[link.a]&&model.nodes[link.b]);
  applyCodePresentation(model);
  CLASS_CANVAS.state=model;
  layout(false); applyView(); updateHud();
  if(focus) fitTo(visibleIds(),{maxZ:1,minZ:.18,pad:isMobile()?24:56,instant:true});
  $('#codeDiagram').textContent='Canvas: '+model.order.length+' nodes, '+model.links.length+' dependency links. Select a node or wire to inspect it.'+(included.size>=limit?' Focused view limited to 180 nodes.':'');
}
