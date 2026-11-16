'use strict';
const overviewExpanded=new Set(), overviewLimits=new Map();
let overviewContext=null;
function renderProjectOverview(graph,organization,selected,edges,selectedEdge,focus,allLinks=false){
  const source=new Map(graph.nodes.map(n=>[n.id,n])), old=CLASS_CANVAS.state;
  const model={nodes:{},order:[],links:[],seq:0,mindsets:[],mode:'detail',layer:false,layout:'radial',sel:null,view:old?.view||{x:0,y:0,z:1}};
  const selectedNode=source.get(selected), limit=240;
  const groups=organization.systems.slice();
  const context=selectedNode?.kind==='system'?selected:overviewContext || organization.memberships.get(selected)?.[0];
  if(groups.length>48&&!groups.slice(0,48).some(g=>g.id===context))groups.sort((a,b)=>(b.id===context)-(a.id===context));
  const shown=groups.slice(0,48), selectedFiles=new Set(selectedNode?.virtual?selectedNode.memberIds:[...organization.files.filter(f=>f.file===selectedNode?.file).map(f=>f.id)]);
  const displayForFile=new Map();
  const add=n=>{if(model.order.length>=limit)return false;model.nodes[n.id]=n;model.order.push(n.id);return true;};
  const projectId=codeCanvasId(organization.project.id);
  add({id:projectId,type:'loop',text:organization.project.name,parent:null,codeId:organization.project.id,codeKind:'project',codeVirtual:true,codeMembers:organization.project.memberIds,codeCaption:'Project · '+organization.files.length+' scripts · '+organization.systems.length+' systems',src:[]});
  const children=new Map();for(const n of graph.nodes)if(!n.virtual){if(!children.has(n.parent))children.set(n.parent,[]);children.get(n.parent).push(n);}
  const containsSelected=(id)=>{let n=selectedNode;while(n?.parent){if(n.parent===id)return true;n=source.get(n.parent);}return false;};
  function declarations(file,parent,system,depth=0){
    if(depth>5)return;
    for(const node of children.get(file)||[]){
      if(node.kind==='parameter')continue;
      const id='overview:detail:'+system+':'+node.id, hasChildren=!!children.get(node.id)?.length;
      const expanded=overviewExpanded.has(id)||containsSelected(node.id);
      if(!add({id,type:['class','interface','struct','enum'].includes(node.kind)?'decision':['method','function'].includes(node.kind)?'question':'answer',text:node.name,parent,codeId:node.id,codeKind:node.kind,codeCaption:node.kind+' · '+node.file+':'+node.line,codeSystem:system,codeExpandable:hasChildren,collapsed:!expanded,src:[{f:node.file,l:node.line}]}))return;
      if(node.id===selected)model.sel=id;
      if(expanded)declarations(node.id,id,system,depth+1);
    }
  }
  for(const group of shown){
    const id=codeCanvasId(group.id), expanded=overviewExpanded.has(group.id);
    add({id,type:'decision',text:group.name,parent:projectId,codeId:group.id,codeKind:'system',codeVirtual:true,codeMembers:group.memberIds,codeExpandable:!!group.files.length,codeCaption:group.files.length+' scripts · '+group.basis+' grouping',collapsed:!expanded,src:[]});
    if(selected===group.id)model.sel=id;
  }
  // Reserve the system ring before spending the display budget on expanded scripts.
  for(const group of shown.slice().sort((a,b)=>(b.id===context)-(a.id===context))){
    const id=codeCanvasId(group.id),expanded=overviewExpanded.has(group.id);
    if(!expanded)continue;
    const files=group.files.slice().sort((a,b)=>(selectedFiles.has(b.id)-selectedFiles.has(a.id))||a.name.localeCompare(b.name));
    for(const file of files.slice(0,overviewLimits.get(group.id)||12)){
      const scriptId='overview:script:'+group.id+':'+file.id;
      const open=overviewExpanded.has(scriptId)||containsSelected(file.id);
      const shared=organization.memberships.get(file.id).length;
      if(!add({id:scriptId,type:'question',text:file.file.split('/').pop(),parent:id,codeId:file.id,codeKind:'file',codeSystem:group.id,codeCaption:file.file+(shared>1?' · Shared across '+shared+' systems':''),codeExpandable:!!children.get(file.id)?.length,collapsed:!open,src:[{f:file.file,l:1}]}))break;
      if(!displayForFile.has(file.id)||group.id===context)displayForFile.set(file.id,scriptId);
      if(file.id===selected&&group.id===context)model.sel=scriptId;
      if(open)declarations(file.id,scriptId,group.id);
    }
  }
  model.sel ||= selected===organization.project.id?projectId:null;
  const fileByPath=new Map(organization.files.map(f=>[f.file,f.id]));
  function endpoint(file){
    const visible=displayForFile.get(file);if(visible)return visible;
    const ids=organization.memberships.get(file)||[], id=ids.includes(context)?context:ids[0];
    return model.nodes[codeCanvasId(id)]?codeCanvasId(id):null;
  }
  const aggregate=new Map();
  if(selected!==organization.project.id||allLinks)for(const edge of edges){
    const aFile=fileByPath.get(source.get(edge.a)?.file),bFile=fileByPath.get(source.get(edge.b)?.file);
    if(!aFile||!bFile||aFile===bFile)continue;
    if(!allLinks&&!selectedFiles.has(aFile)&&!selectedFiles.has(bFile))continue;
    const a=endpoint(aFile),b=endpoint(bFile);if(!a||!b||a===b)continue;
    const key=[a,b,edge.kind].join('|');let link=aggregate.get(key);
    if(!link){link={id:'overview:link:'+key,a,b,kind:'flow',codeEdge:edge.id,codeKind:edge.kind,codeCount:0,codeLabel:edge.file+':'+edge.line,codeSelected:false};aggregate.set(key,link);}
    link.codeCount++;if(edge.id===selectedEdge){link.codeEdge=edge.id;link.codeSelected=true;}
  }
  model.links=[...aggregate.values()].sort((a,b)=>Number(b.codeSelected)-Number(a.codeSelected)).slice(0,400);
  for(const n of Object.values(model.nodes))n.codeImpact=!!(CLASS_CANVAS.affected?.has(n.codeId)||n.codeMembers?.some(id=>CLASS_CANVAS.affected?.has(id)));
  CLASS_CANVAS.state=model;layout(false);applyView();updateHud();
  if(focus)fitTo(visibleIds(),{maxZ:1,minZ:.08,pad:isMobile()?24:56,instant:true});
  $('#codeDiagram').textContent='Project overview · '+organization.systems.length+' systems · '+organization.files.length+' scripts. Select a system to open its branch.'+(shown.length<groups.length?' Showing '+shown.length+' systems; browse or search to select others.':'')+(model.order.length>=limit?' Canvas limited to 240 nodes.':'')+(aggregate.size>400?' Showing 400 dependency links; select a system or filter connections.':'');
}

function radialTreePath(a,b){
  const ax=a.cur.x+a.w/2,ay=a.cur.y+a.h/2,bx=b.cur.x+b.w/2,by=b.cur.y+b.h/2,dx=bx-ax,dy=by-ay;
  if(Math.abs(dx)+Math.abs(dy)<.01)return 'M'+ax+' '+ay+'L'+bx+' '+by;
  const boundary=(w,h)=>1/Math.max(Math.abs(dx)/(w/2),Math.abs(dy)/(h/2));
  const from=boundary(a.w,a.h),to=boundary(b.w,b.h),x1=ax+dx*from,y1=ay+dy*from,x2=bx-dx*to,y2=by-dy*to;
  const style=effLook().wires.style;if(style==='straight')return `M${x1} ${y1}L${x2} ${y2}`;
  if(style==='manhattan')return wirePath(x1,y1,x2,y2,Math.sign(dx)||1,Math.sign(dx)||1,effLook().wires,36);
  const bend=style==='bezier'?.08:.025,vx=x2-x1,vy=y2-y1;
  return `M${x1} ${y1}C${x1+vx*.35-vy*bend} ${y1+vy*.35+vx*bend} ${x1+vx*.65-vy*bend} ${y1+vy*.65+vx*bend} ${x2} ${y2}`;
}

function layoutRadial(ids){
  const model=canvasState(), children=new Map();
  for(const id of ids){const parent=model.nodes[id].parent;if(!children.has(parent))children.set(parent,[]);children.get(parent).push(id);}
  const root=ids.find(id=>!model.nodes[id].parent);if(!root)return;
  const rings=new Map(), angles=new Map([[root,0]]), depths=new Map([[root,0]]);
  function place(id,angle,span,depth){
    angles.set(id,angle);depths.set(id,depth);if(!rings.has(depth))rings.set(depth,[]);rings.get(depth).push(id);
    const list=children.get(id)||[];list.forEach((child,index)=>place(child,angle+(index-(list.length-1)/2)*span/Math.max(1,list.length),span/Math.max(1,list.length)*.88,depth+1));
  }
  const systems=children.get(root)||[];
  systems.forEach((id,index)=>place(id,-Math.PI/2+2*Math.PI*index/Math.max(1,systems.length),2*Math.PI/Math.max(1,systems.length)*.8,1));
  const radius=[0];
  for(const [depth,list] of rings){
    const sorted=list.slice().sort((a,b)=>angles.get(a)-angles.get(b));let needed=0;
    for(let i=0;i<sorted.length;i++){
      const a=sorted[i],b=sorted[(i+1)%sorted.length],delta=(angles.get(b)-angles.get(a)+Math.PI*2)%(Math.PI*2);
      if(sorted.length>1&&delta>.00001)needed=Math.max(needed,(Math.hypot(R[a].w,R[a].h)+Math.hypot(R[b].w,R[b].h)+48)/(4*Math.sin(delta/2)));
    }
    radius[depth]=Math.max((radius[depth-1]||0)+330,needed);
  }
  for(const id of ids){const angle=angles.get(id)||0,radiusHere=radius[depths.get(id)]||0;R[id].tgt={x:Math.cos(angle)*radiusHere-R[id].w/2,y:Math.sin(angle)*radiusHere-R[id].h/2};}
}
