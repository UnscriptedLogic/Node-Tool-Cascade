'use strict';
// Project organization is independent of source identity and analysis evidence.
(function(root){
  const PROJECT='overview:project';
  const script=n=>n.kind==='file' && /\.(?:[cm]?[jt]s|[jt]sx|cs)$/i.test(n.file);
  const label=value=>String(value).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).replace(/\bAi\b/g,'AI').replace(/\bUi\b/g,'UI');
  function infer(file,nodes){
    if(file.assembly && !['Project','Assembly-CSharp','Assembly-CSharp-Editor'].includes(file.assembly)) return {key:'assembly:'+file.assembly,name:file.assembly,basis:'assembly'};
    const folders=file.file.split('/').slice(0,-1);
    while(folders.length && /^(assets|scripts?|src|source|code|app|js|ts|runtime|public|client)$/i.test(folders[0])) folders.shift();
    if(folders.length) return {key:'folder:'+folders[0],name:label(folders[0]),basis:'folder'};
    const type=nodes.find(n=>n.file===file.file&&['class','interface','struct'].includes(n.kind)&&n.qualifiedName?.includes('.'));
    if(type){const parts=type.qualifiedName.replace(/^global::/,'').split('.');parts.pop();const name=parts.pop();if(name)return {key:'namespace:'+name,name:label(name),basis:'namespace'};}
    return {key:'scripts',name:'Scripts',basis:'folder'};
  }
  function build(graph,config={},name='Project'){
    const files=graph.nodes.filter(script), systems=new Map(), memberships=new Map();
    const create=(id,name,basis)=>{if(!systems.has(id))systems.set(id,{id,name:String(config.names?.[id]||name).trim().slice(0,80)||'System',kind:'system',virtual:true,basis,memberIds:[],files:[]});return systems.get(id);};
    for(const group of (Array.isArray(config.custom)?config.custom:[]).slice(0,60)) if(group&&typeof group.id==='string'&&group.id.startsWith('overview:system:')&&typeof group.name==='string') create(group.id,group.name,'manual');
    const automaticIds=new Map();
    for(const file of files){const group=infer(file,graph.nodes),id='overview:system:'+encodeURIComponent(group.key);create(id,config.names?.[id]||group.name,group.basis);automaticIds.set(file.id,id);}
    for(const file of files){
      const automatic=automaticIds.get(file.id);
      const override=Object.prototype.hasOwnProperty.call(config.memberships||{},file.file)?config.memberships[file.file]:null;
      let ids=Array.isArray(override)?[...new Set(override.filter(id=>typeof id==='string'&&systems.has(id)))].slice(0,20):[automatic];
      if(!ids.length){const id='overview:system:unassigned';create(id,'Unassigned','manual');ids=[id];}
      memberships.set(file.id,ids);
      for(const id of ids){const system=systems.get(id);system.name=String(config.names?.[id]||system.name).slice(0,80);system.memberIds.push(file.id);system.files.push(file);}
    }
    // Keep deliberately created empty categories, but hide abandoned automatic groups.
    const groups=[...systems.values()].filter(g=>g.files.length||g.basis==='manual').sort((a,b)=>a.name.localeCompare(b.name));
    for(const group of groups)group.parent=PROJECT;
    return {project:{id:PROJECT,name,kind:'project',virtual:true,memberIds:files.map(f=>f.id)},systems:groups,files,memberships};
  }
  function proposal(value,files){
    const allowed=new Set(files.map(f=>f.file));
    return (Array.isArray(value?.systems)?value.systems:[]).filter(g=>g&&typeof g==='object').slice(0,40).map(g=>({name:typeof g.name==='string'?g.name.trim().slice(0,80):'',files:[...new Set((Array.isArray(g.files)?g.files:[]).filter(f=>typeof f==='string'&&allowed.has(f)))]})).filter(g=>g.name&&g.files.length);
  }
  const api={PROJECT,script,build,proposal};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CodeSystems=api;
})(typeof globalThis==='object'?globalThis:this);
