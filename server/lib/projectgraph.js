'use strict';
const crypto=require('crypto');
const javascript=require('./codegraph'), unity=require('./unitygraph');
function analyze(sources,csharp,coverage={}){
  const js=sources.filter(s=>javascript.SUPPORTED.test(s.path)), cs=sources.filter(s=>/\.cs$/i.test(s.path));
  const base=javascript.analyze(js,coverage), prepared=unity.prepare(sources,coverage.engine==='unity');
  const assets=unity.analyze(sources,csharp,prepared);
  const nodes=[], edges=[], byId=new Map(); let truncated=base.coverage.truncated||csharp?.truncated||assets.truncated||false;
  for(const n of base.nodes.concat(assets.nodes,csharp?.nodes||[])){
    if(byId.has(n.id))continue;
    if(nodes.length>=javascript.LIMITS.nodes){truncated=true;continue;} nodes.push(n); byId.set(n.id,n);
  }
  for(const n of nodes) if(n.parent&&!byId.has(n.parent)) delete n.parent;
  for(const e of base.edges.concat(csharp?.edges||[],assets.edges)){
    if(!byId.has(e.a)||!byId.has(e.b))continue;
    if(edges.length>=javascript.LIMITS.edges){truncated=true;break;}edges.push({...e,id:'e'+edges.length});
  }
  const errors=csharp && !csharp.available?[csharp.error]:[];
  return {version:2,snapshot:crypto.createHash('sha1').update('projectgraph-v2').update(JSON.stringify(sources.map(s=>[s.path,s.hash]))).digest('hex').slice(0,12),nodes,edges,
    unresolved:base.unresolved.concat(csharp?.unresolved||[],assets.unresolved).slice(0,300),
    coverage:{...coverage,analyzedFiles:js.length+(csharp?.available?cs.length:0),javascriptFiles:js.length,csharpFiles:cs.length,csharpAvailable:csharp?.available??null,
      unityFiles:sources.filter(s=>unity.INPUT.test(s.path)).length,parseErrors:base.coverage.parseErrors+(csharp?.parseErrors||0),semanticErrors:csharp?.semanticErrors||0,conditionalFiles:csharp?.conditionalFiles||0,
      assemblyConstraints:prepared.definitions.filter(d=>['defineConstraints','includePlatforms','excludePlatforms','versionDefines'].some(k=>d.data[k]?.length)).length,
      unsupportedAssets:assets.unsupportedAssets,unresolved:base.coverage.unresolved+(csharp?.unresolvedCount||0)+assets.unresolvedCount,truncated,limits:javascript.LIMITS,errors},
    limitations:[...(js.length?base.limitations:[]),'Static relationships show potential dependencies, not guaranteed execution, breakage, or value propagation.',...(cs.length?[
      'C# uses Roslyn source semantics and .NET runtime types. Unity/package DLLs, .csproj build settings, active platform defines, generators and runtime reflection are not loaded.',
      'C# conditional branches use default preprocessing symbols. Semantic errors and missing engine APIs reduce coverage; ambiguous calls are not treated as resolved.',
      'Virtual/interface calls retain their statically resolved target; possible runtime implementations are not enumerated.',
      'Assembly definitions and references group source; platform constraints and assembly cycles may leave dependencies unresolved.'
    ]:[]),...(coverage.engine==='unity'?[
      'Unity text scenes, prefabs and assets use GUID/fileID references. Class definitions and serialized component instances are separate nodes.',
      'Binary assets, large/excluded assets, dynamic spawning, GetComponent lookups and runtime event registration may be missing. Prefab overrides are shown as serialized references, not a reconstructed runtime scene.',
      'Unity analysis reads at most 1,200 metadata/asset files and 16 MB in addition to code limits; individual text assets are limited to 4 MB.'
    ]:[])]};
}
module.exports={analyze};
