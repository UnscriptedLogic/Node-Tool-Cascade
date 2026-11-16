'use strict';
const path=require('path').posix;
const ASSET=/\.(?:unity|prefab|asset)$/i;
const INPUT=/\.(?:unity|prefab|asset|asmdef|asmref|meta)$/i;
const GUID=/^[a-f0-9]{32}$/i;
function prepare(sources,isUnity){
  const metadata=new Map(), byGuid=new Map(), definitions=[], issues=[];
  for(const s of sources.filter(s=>/\.meta$/i.test(s.path))){
    const guid=s.text.match(/^guid:\s*([a-f0-9]{32})\s*$/mi)?.[1].toLowerCase(); if(!guid) continue;
    const asset=s.path.slice(0,-5); metadata.set(asset,{guid,path:s.path});
    if(!byGuid.has(guid)) byGuid.set(guid,[]); byGuid.get(guid).push(asset);
  }
  const resolveGuid=guid=>byGuid.get(guid?.toLowerCase())?.length===1?byGuid.get(guid.toLowerCase())[0]:null;
  for(const s of sources.filter(s=>/\.asmdef$/i.test(s.path))){
    try{ const d=JSON.parse(s.text); if(typeof d.name!=='string'||!d.name.trim()) throw Error(); definitions.push({name:d.name,file:s.path,folder:path.dirname(s.path),data:d}); }
    catch(e){ issues.push({file:s.path,line:1,kind:'assembly',name:'Invalid assembly definition'}); }
  }
  const named=name=>definitions.filter(d=>d.name===name).length===1?definitions.find(d=>d.name===name):null;
  for(const name of new Set(definitions.map(d=>d.name))) if(definitions.filter(d=>d.name===name).length>1) issues.push({file:definitions.find(d=>d.name===name).file,line:1,kind:'assembly',name:'Duplicate assembly name: '+name});
  const resolveAssembly=reference=>{
    if(typeof reference!=='string') return null;
    if(reference.startsWith('GUID:')){ const file=resolveGuid(reference.slice(5)); return definitions.find(d=>d.file===file)?.name||null; }
    return named(reference)?.name||null;
  };
  const boundaries=definitions.map(d=>({folder:d.folder,name:d.name}));
  for(const s of sources.filter(s=>/\.asmref$/i.test(s.path))){
    try{ const name=resolveAssembly(JSON.parse(s.text).reference); if(!name) throw Error(); boundaries.push({folder:path.dirname(s.path),name}); }
    catch(e){ issues.push({file:s.path,line:1,kind:'assembly',name:'Unresolved assembly reference'}); }
  }
  boundaries.sort((a,b)=>b.folder.length-a.folder.length);
  const code=sources.filter(s=>/\.cs$/i.test(s.path)).map(s=>{
    const boundary=boundaries.find(d=>d.folder==='.'||s.path.startsWith(d.folder+'/'));
    return {...s,assembly:boundary?.name || (isUnity?(s.path.split('/').includes('Editor')?'Assembly-CSharp-Editor':'Assembly-CSharp'):'Project')};
  });
  const assemblies=[...new Set(code.map(s=>s.assembly).concat(definitions.map(d=>d.name)))].map(name=>{
    const d=named(name); let references=[];
    if(d) for(const ref of Array.isArray(d.data.references)?d.data.references:[]){ const resolved=resolveAssembly(ref); if(resolved) references.push(resolved); else issues.push({file:d.file,line:1,kind:'assembly',name:'Unresolved assembly: '+String(ref)}); }
    else if(isUnity){
      references=definitions.filter(x=>x.data.autoReferenced!==false && (name==='Assembly-CSharp-Editor'||!x.data.includePlatforms?.includes('Editor'))).map(x=>x.name);
      if(name==='Assembly-CSharp-Editor' && code.some(s=>s.assembly==='Assembly-CSharp')) references.push('Assembly-CSharp');
    }
    return {name,references,file:d?.file || code.find(s=>s.assembly===name)?.path,line:1,configured:!!d};
  });
  return {code,assemblies,definitions,metadata,resolveGuid,issues};
}
function analyze(sources,csharp,prepared){
  const {metadata,resolveGuid,assemblies,issues}=prepared, nodes=[],edges=[],unresolved=[...issues], known=new Map((csharp?.nodes||[]).map(n=>[n.id,n]));
  let unsupportedAssets=0, truncated=false, unresolvedCount=unresolved.length;
  function unknown(item){unresolvedCount++;if(unresolved.length<300)unresolved.push(item);}
  const add=n=>{if(known.has(n.id))return;if(nodes.length+(csharp?.nodes.length||0)>=20000){truncated=true;return;}nodes.push(n);known.set(n.id,n);};
  function link(a,b,kind,file,line,extra={}){if(!known.has(a)||!known.has(b)||a===b)return;if(edges.length>=60000){truncated=true;return;}edges.push({id:'unity-e'+edges.length,a,b,kind,file,line,evidence:'serialized',...extra});}
  for(const a of assemblies) if(a.file){
    add({id:'assembly:'+a.name,name:a.name,kind:'assembly',file:a.file,line:1,configured:a.configured});
    for(const n of csharp?.nodes||[]) if(n.kind==='file'&&n.assembly===a.name) n.parent='assembly:'+a.name;
  }
  for(const a of assemblies) for(const ref of a.references) link('assembly:'+a.name,'assembly:'+ref,'assembly-reference',a.file,1,{evidence:'configuration'});
  const classesByFile=new Map();
  for(const n of csharp?.nodes||[]) if(n.kind==='class') for(const file of new Set([n.file,...(n.declarations||[]).map(d=>d.file)])){
    if(!classesByFile.has(file))classesByFile.set(file,[]);classesByFile.get(file).push(n);
  }
  const documents=new Map(), assets=sources.filter(s=>ASSET.test(s.path));
  function objectId(file,id){return 'unity:'+file+'#'+id;}
  for(const s of assets){
    const kind=/\.unity$/i.test(s.path)?'scene':/\.prefab$/i.test(s.path)?'prefab':'asset';
    add({id:'file:'+s.path,name:path.basename(s.path),kind,file:s.path,line:1});
    if(!/^%YAML|^--- !u!/m.test(s.text)){unsupportedAssets++;unknown({file:s.path,line:1,kind:'serialization',name:'Not a supported Unity text asset'});continue;}
    const headers=[...s.text.matchAll(/^--- !u!(\d+) &(-?\d+)(?: stripped)?\s*\r?$/gm)], docs=[];
    const gameObjects=new Set(headers.filter(h=>h[1]==='1').map(h=>h[2]));let previousStart=0, line=1;
    for(let i=0;i<headers.length;i++){
      const h=headers[i], start=h.index, text=s.text.slice(start,headers[i+1]?.index ?? s.text.length);
      line+=(s.text.slice(previousStart,start).match(/\n/g)||[]).length;previousStart=start;
      const id=objectId(s.path,h[2]), type=text.split('\n')[1]?.replace(/:\s*$/,'').trim()||'Object';
      let name=text.match(/^  m_Name:\s*(.*)$/m)?.[1].trim() || type+' #'+h[2];
      if(name.startsWith('"')){try{name=JSON.parse(name);}catch(e){}}
      const gameObject=text.match(/^  m_GameObject:\s*\{\s*fileID:\s*(-?\d+)/m)?.[1];
      const parent=gameObject && gameObjects.has(gameObject)?objectId(s.path,gameObject):'file:'+s.path;
      add({id,name,kind:h[1]==='1'?'gameobject':'component',file:s.path,line,parent,unityType:type,unityFileID:h[2]});
      if(!known.has(id))break;
      docs.push({id,text,line,file:s.path});
    }
    documents.set(s.path,docs);
  }
  for(const docs of documents.values()) for(const doc of docs){
    doc.text.split('\n').forEach((line,index)=>{
      const field=line.match(/^\s*(?:-\s*)?([^:{}]+):/)?.[1].trim()||'reference';
      for(const match of line.matchAll(/\{[^{}\r\n]*\bfileID:\s*(-?\d+)[^{}\r\n]*\}/g)){
        const local=match[1]; if(local==='0')continue;
        const guid=match[0].match(/\bguid:\s*([a-f0-9]{32})/i)?.[1]?.toLowerCase();
        let file=doc.file, target, evidenceFiles=[];
        if(guid && !/^0+$/.test(guid)){
          file=resolveGuid(guid);
          if(!file){unknown({file:doc.file,line:doc.line+index,kind:'serialized',name:'Missing or ambiguous GUID '+guid});continue;}
          evidenceFiles=[metadata.get(file).path];
        }
        if(field==='m_Script' && /\.cs$/i.test(file)){
          target='file:'+file;link(doc.id,target,'script',doc.file,doc.line+index,{evidenceFiles});
          const main=path.basename(file,path.extname(file));
          const classes=(classesByFile.get(file)||[]).filter(n=>n.name===main);
          if(classes.length===1){
            known.get(doc.id).name=main+' (component)'; known.get(doc.id).classId=classes[0].id;
            link(doc.id,classes[0].id,'instance-of',doc.file,doc.line+index,{evidenceFiles});
          }
          continue;
        }
        target=known.has(objectId(file,local))?objectId(file,local):known.has('file:'+file)?'file:'+file:null;
        if(target)link(doc.id,target,field==='m_SourcePrefab'?'prefab-reference':'serialized',doc.file,doc.line+index,{field,evidenceFiles});
        else unknown({file:doc.file,line:doc.line+index,kind:'serialized',name:'Unresolved object '+file+'#'+local});
      }
    });
  }
  return {nodes,edges,unresolved:unresolved.slice(0,300),unresolvedCount,unsupportedAssets,truncated};
}
module.exports={prepare,analyze,ASSET,INPUT,GUID};
