'use strict';
const overviewExpanded=new Set(), overviewLimits=new Map();
let overviewContext=null;
let codeVisualization='radial';
function renderProjectOverview(graph,organization,selected,edges,selectedEdge,focus,allLinks,getTraceEdges){
  const source=new Map(graph.nodes.map(n=>[n.id,n])), old=CLASS_CANVAS.state;
  const model={nodes:{},order:[],links:[],seq:0,mindsets:[],mode:'detail',layer:false,layout:codeVisualization,sel:null,view:old?.view||{x:0,y:0,z:1}};
  const selectedNode=source.get(selected), limit=240;
  const groups=organization.systems.slice();
  const context=selectedNode?.kind==='system'?selected:overviewContext || organization.memberships.get(selected)?.[0];
  if(groups.length>48&&!groups.slice(0,48).some(g=>g.id===context))groups.sort((a,b)=>(b.id===context)-(a.id===context));
  const shown=groups.slice(0,48), selectedFiles=new Set(selectedNode?.virtual?selectedNode.memberIds:[...organization.files.filter(f=>f.file===selectedNode?.file).map(f=>f.id)]);
  const displayForFile=new Map();
  const visual=CodeInspector.settings;
  const levels=new Map();
  const add=n=>{const depth=n.parent?(levels.get(n.parent)||0)+1:0;if(depth>visual.layers)return false;levels.set(n.id,depth);if(model.order.length>=limit)return false;model.nodes[n.id]=n;model.order.push(n.id);return true;};
  const projectId=codeCanvasId(organization.project.id);
  add({id:projectId,type:'answer',text:organization.project.name,parent:null,codeId:organization.project.id,codeKind:'project',codeVirtual:true,codeMembers:organization.project.memberIds,codeCaption:'Project · '+organization.files.length+' scripts · '+organization.systems.length+' systems',src:[]});
  const children=new Map();for(const n of graph.nodes)if(!n.virtual){if(!children.has(n.parent))children.set(n.parent,[]);children.get(n.parent).push(n);}
  const containsSelected=(id)=>{let n=selectedNode;while(n?.parent){if(n.parent===id)return true;n=source.get(n.parent);}return false;};
  function declarations(file,parent,system,depth=0){
    if(depth>5||depth+3>visual.layers)return;
    for(const node of children.get(file)||[]){
      if(node.kind==='parameter')continue;
      const id='overview:detail:'+system+':'+node.id, hasChildren=!!children.get(node.id)?.length;
      const expanded=overviewExpanded.has(id)||containsSelected(node.id)||(visual.expandLayers&&depth+4<=visual.layers);
      if(!add({id,type:'answer',text:node.name,parent,codeId:node.id,codeKind:node.kind,codeCaption:node.kind+' · '+node.file+':'+node.line,codeSystem:system,codeExpandable:hasChildren,collapsed:!expanded,src:[{f:node.file,l:node.line}]}))return;
      if(node.id===selected)model.sel=id;
      if(expanded)declarations(node.id,id,system,depth+1);
    }
  }
  for(const group of shown){
    const id=codeCanvasId(group.id), expanded=(overviewExpanded.has(group.id)||(visual.expandLayers&&visual.layers>=2));
    add({id,type:'answer',text:group.name,parent:projectId,codeId:group.id,codeKind:'system',codeVirtual:true,codeMembers:group.memberIds,codeExpandable:!!group.files.length,codeCaption:group.files.length+' scripts · '+group.basis+' grouping',collapsed:!expanded,src:[]});
    if(selected===group.id)model.sel=id;
  }
  // Reserve the system ring before spending the display budget on expanded scripts.
  for(const group of shown.slice().sort((a,b)=>(b.id===context)-(a.id===context))){
    const id=codeCanvasId(group.id),expanded=overviewExpanded.has(group.id);
    if(!expanded)continue;
    const files=group.files.slice().sort((a,b)=>(selectedFiles.has(b.id)-selectedFiles.has(a.id))||a.name.localeCompare(b.name));
    for(const file of files.slice(0,overviewLimits.get(group.id)||visual.scriptLimit)){
      const scriptId='overview:script:'+group.id+':'+file.id;
      const open=overviewExpanded.has(scriptId)||containsSelected(file.id)||(visual.expandLayers&&visual.layers>=3);
      const shared=organization.memberships.get(file.id).length;
      if(!add({id:scriptId,type:'answer',text:file.file.split('/').pop(),parent:id,codeId:file.id,codeKind:'file',codeSystem:group.id,codeCaption:file.file+(shared>1?' · Shared across '+shared+' systems':''),codeExpandable:!!children.get(file.id)?.length,collapsed:!open,src:[{f:file.file,l:1}]}))break;
      if(!displayForFile.has(file.id)||group.id===context)displayForFile.set(file.id,scriptId);
      if(file.id===selected&&group.id===context)model.sel=scriptId;
      if(open)declarations(file.id,scriptId,group.id);
    }
  }
  model.sel ||= selected===organization.project.id?projectId:null;
  const fileByPath=new Map(organization.files.map(f=>[f.file,f.id]));
  function endpoint(file){
    if(CLASS_CANVAS.inspectedId&&model.nodes[CLASS_CANVAS.inspectedId]&&!selectedNode?.virtual&&selectedFiles.has(file)){
      return CLASS_CANVAS.inspectedId;
    }
    const visible=displayForFile.get(file);if(visible)return visible;
    const ids=organization.memberships.get(file)||[], id=ids.includes(context)?context:ids[0];
    return model.nodes[codeCanvasId(id)]?codeCanvasId(id):null;
  }
  function collectLinks(evidence,includeAll){
  const aggregate=new Map();
  for(const edge of evidence){
    const aFile=fileByPath.get(source.get(edge.a)?.file),bFile=fileByPath.get(source.get(edge.b)?.file);
    if(!aFile||!bFile||aFile===bFile)continue;
    if(!includeAll&&!selectedFiles.has(aFile)&&!selectedFiles.has(bFile))continue;
    const a=endpoint(aFile),b=endpoint(bFile);if(!a||!b||a===b)continue;
    const key=[a,b,edge.kind].join('|');let link=aggregate.get(key);
    if(!link){link={id:'overview:link:'+key,a,b,kind:'flow',codeEdge:edge.id,codeKind:edge.kind,codeCount:0,codeLabel:edge.file+':'+edge.line,codeSelected:false};aggregate.set(key,link);}
    link.codeCount++;if(edge.id===selectedEdge){link.codeEdge=edge.id;link.codeSelected=true;}
  }
  return aggregate;
  }
  const aggregate=collectLinks(selected!==organization.project.id||allLinks?edges:[],allLinks);
  model.links=[...aggregate.values()].sort((a,b)=>Number(b.codeSelected)-Number(a.codeSelected)).slice(0,400);
  let traceLinks;
  model.getTraceLinks=()=>traceLinks??=[...collectLinks(getTraceEdges(),true).values()].slice(0,400);
  for(const n of Object.values(model.nodes))n.codeImpact=!!(CLASS_CANVAS.affected?.has(n.codeId)||n.codeMembers?.some(id=>CLASS_CANVAS.affected?.has(id)));
  model.visual={...visual};applyCodePresentation(model);CLASS_CANVAS.state=model;layout(false);applyView();updateHud();
  if(focus)fitTo(visibleIds(),{maxZ:1,minZ:.08,pad:isMobile()?24:56,instant:true});
  $('#codeDiagram').textContent='Project overview · '+organization.systems.length+' systems · '+organization.files.length+' scripts. Select a system to open its branch.'+(shown.length<groups.length?' Showing '+shown.length+' systems; browse or search to select others.':'')+(model.order.length>=limit?' Canvas limited to 240 nodes.':'')+(aggregate.size>400?' Showing 400 dependency links; select a system or filter connections.':'');
}
