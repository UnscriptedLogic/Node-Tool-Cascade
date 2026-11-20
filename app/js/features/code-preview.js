'use strict';

const CodePreview = (() => {
  const labels={added:'Proposed addition',changed:'Proposed edit',removed:'Proposed removal',risk:'Direct consumer at risk',downstream:'Downstream impact'};
  const text=(value,limit)=>typeof value==='string'?value.trim().slice(0,limit):'';

  function parse(raw,allowed,edges){
    const result=parseObj(raw);
    if(!Array.isArray(result.additions)||!Array.isArray(result.changes))throw new Error('Expected a change plan. Try again or preview a local draft.');
    const additions=result.additions.slice(0,12).flatMap(item=>{
      const name=text(item?.name,80);
      if(!name)return [];
      const kind=item.kind==='system'?'system':item.kind==='class'?'class':'file';
      const dependsOn=Array.isArray(item.dependsOn)?[...new Set(item.dependsOn.filter(id=>allowed.has(id)))].slice(0,8):[];
      return [{name,kind,dependsOn,note:text(item.note,350)}];
    });
    const changes=result.changes.slice(0,20).flatMap(item=>{
      if(!allowed.has(item?.id)||!['edit','remove'].includes(item.action))return [];
      return [{id:item.id,action:item.action,note:text(item.note,350)}];
    });
    const existingPairs=new Set([...edges.values()].map(edge=>JSON.stringify([edge.a,edge.b])));
    const connections=(Array.isArray(result.connections)?result.connections:[]).slice(0,20).flatMap(item=>{
      if(!allowed.has(item?.from)||!allowed.has(item?.to)||item.from===item.to)return [];
      const exists=existingPairs.has(JSON.stringify([item.from,item.to]));
      if(!(item.action==='add'&&!exists||item.action==='remove'&&exists))return [];
      return [{from:item.from,to:item.to,action:item.action,note:text(item.note,350)}];
    });
    if(!additions.length&&!changes.length&&!connections.length)throw new Error('No changes matched the scanned graph. Try a more specific request.');
    return {summary:text(result.summary,900),additions,changes,connections};
  }

  function overlay(model,preview){
    const anchor=model.nodes[preview.anchor];
    if(!anchor)return;
    const related=model.inspection?.related||new Set([anchor.id]);
    const display=new Map();
    for(const id of model.order){
      const node=model.nodes[id];
      if(node.codeId&&!display.has(node.codeId))display.set(node.codeId,id);
    }
    display.set(anchor.codeId,anchor.id);
    function add(node){ model.nodes[node.id]=node;model.order.push(node.id);related.add(node.id);return node.id; }
    function existing(id){
      const shown=display.get(id);
      if(shown){ related.add(shown);return shown; }
      const source=preview.sources.get(id);
      if(!source)return null;
      const tile=add({id:'preview-source:'+id,type:'answer',text:source.name,parent:null,
        codeId:id,codeKind:source.kind,codeCaption:source.file?source.file+':'+source.line:source.kind,
        codeVirtual:!!source.virtual,src:source.file?[{f:source.file,l:source.line}]:[]});
      display.set(id,tile);
      return tile;
    }
    function mark(id,state,note){
      if(!id)return;
      const node=model.nodes[id];
      model.nodes[id]={...node,codePreview:state,codePreviewNote:[labels[state],note].filter(Boolean).join(' · ')};
    }
    if(preview.mode==='remove')mark(anchor.id,'removed');
    for(const hit of preview.impact.slice(0,24)){
      const id=existing(hit.id);
      const edge=preview.edges.get(hit.via);
      mark(id,preview.mode==='remove'&&hit.depth===1&&edge?.a===hit.id?'risk':'downstream');
      const target=edge&&display.get(edge.b);
      if(id&&target&&target!==id&&edge.a===hit.id){
        model.links.push({id:'preview-impact:'+hit.id,a:id,b:target,kind:'flow',codePlan:true});
      }
    }
    for(const [index,change] of preview.changes.entries()){
      const id=existing(change.id);
      mark(id,change.action==='remove'?'removed':'changed',change.note);
      if(id&&change.action==='edit')add({id:'preview-edit:'+index,type:'answer',text:'Edit '+model.nodes[id].text,
        parent:id,codeId:'preview-edit:'+index,codeKind:model.nodes[id].codeKind,codeProposal:true,codePreview:'changed',codeCaption:change.note});
    }
    for(const [index,proposal] of preview.additions.entries()){
      const id='preview-add:'+index;
      add({id,type:'answer',text:proposal.name,parent:anchor.id,codeId:id,codeKind:proposal.kind,
        codeProposal:true,codePreview:'added',codeCaption:proposal.note});
      for(const target of proposal.dependsOn||[]){
        const b=existing(target);
        if(b)model.links.push({id:id+'>'+b,a:id,b,kind:'flow',codePlan:true});
      }
    }
    for(const [index,change] of preview.connections.entries()){
      const a=existing(change.from),b=existing(change.to);
      if(a&&b)model.links.push({id:'preview-wire:'+index,a,b,kind:'flow',codePlan:true,
        codePlanAction:change.action,codeLabel:change.note});
    }
    model.inspection={id:anchor.id,related};
    model.previewActive=true;
  }

  return {parse,overlay};
})();
