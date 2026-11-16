'use strict';
// Snapshot-only analysis. The compiler host cannot read disk or execute project code.
const ts = require('typescript');
const path = require('path').posix;
const crypto = require('crypto');
const SUPPORTED = /\.(?:[cm]?[jt]s|[jt]sx)$/i;
const LIMITS = { files:800, bytes:8*1024*1024, nodes:20000, edges:60000 };
const fileId = f => 'file:'+f;

function analyze(sources, coverage={}){
  const input = new Map(sources.map(s=>['/project/'+s.path,s.text]));
  const options = { allowJs:true, checkJs:true, noLib:true, noEmit:true, target:ts.ScriptTarget.Latest, module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.Preserve };
  const resolve = (name,from) => {
    if(!name.startsWith('.')) return null;
    const base = path.resolve(path.dirname(from),name);
    const variants = [base, ...['.ts','.tsx','.js','.jsx','.mts','.cts','.mjs','.cjs'].map(e=>base+e), ...['.ts','.tsx','.js','.jsx'].map(e=>base+'/index'+e)];
    if(/\.[cm]?jsx?$/.test(base)) variants.push(base.replace(/\.[cm]?jsx?$/,'.ts'),base.replace(/\.[cm]?jsx?$/,'.tsx'));
    return variants.find(f=>input.has(f)) || null;
  };
  const host = {
    getSourceFile:(f,v)=>input.has(f) ? ts.createSourceFile(f,input.get(f),v,true) : undefined,
    getDefaultLibFileName:()=>'', writeFile:()=>{}, getCurrentDirectory:()=>'/project',
    getCanonicalFileName:f=>f, useCaseSensitiveFileNames:()=>true, getNewLine:()=> '\n',
    fileExists:f=>input.has(f), readFile:f=>input.get(f),
    resolveModuleNames:(names,from)=>names.map(n=>{ const f=resolve(n,from); return f ? {resolvedFileName:f,isExternalLibraryImport:false} : undefined; })
  };
  const program = ts.createProgram([...input.keys()],options,host), checker = program.getTypeChecker();
  const nodes=[], edges=[], unresolved=[], declarations=new Map(), nodeById=new Map(), seen=new Set(), names=new Map();
  let truncated=false, unresolvedCount=0, parseErrors=0;
  const rel = sf=>sf.fileName.slice('/project/'.length);
  const line = n=>n.getSourceFile().getLineAndCharacterOfPosition(n.getStart()).line+1;
  function addNode(n){ if(nodes.length>=LIMITS.nodes){ truncated=true; return; } nodes.push(n); nodeById.set(n.id,n); return n.id; }
  function edge(a,b,kind,n){
    if(!a || !b || a===b || !nodeById.has(a) || !nodeById.has(b)) return;
    if(edges.length>=LIMITS.edges){ truncated=true; return; }
    const file=rel(n.getSourceFile()), l=line(n), key=[a,b,kind,file,l].join('|');
    if(seen.has(key)) return; seen.add(key);
    edges.push({id:'e'+edges.length,a,b,kind,file,line:l,evidence:'static'});
  }
  function unresolvedAt(n,kind,name){ unresolvedCount++; if(unresolved.length<300) unresolved.push({file:rel(n.getSourceFile()),line:line(n),kind,name:String(name).slice(0,160)}); }
  function kind(n){
    if(ts.isClassDeclaration(n)) return 'class';
    if(ts.isInterfaceDeclaration(n)) return 'interface';
    if(ts.isTypeAliasDeclaration(n)) return 'type';
    if(ts.isFunctionDeclaration(n)) return 'function';
    if(ts.isMethodDeclaration(n) || ts.isMethodSignature(n) || ts.isGetAccessor(n) || ts.isSetAccessor(n)) return 'method';
    if(ts.isPropertyDeclaration(n) || ts.isPropertySignature(n)) return 'property';
    if(ts.isParameter(n)) return 'parameter';
    if(ts.isVariableDeclaration(n) || ts.isBindingElement(n)) return n.initializer && ts.isClassExpression(n.initializer) ? 'class' : n.initializer && (ts.isArrowFunction(n.initializer)||ts.isFunctionExpression(n.initializer)) ? 'function' : 'variable';
    if(ts.isEnumDeclaration(n)) return 'enum';
  }
  const sourceFiles=program.getSourceFiles();
  for(const sf of sourceFiles){
    const file=rel(sf); addNode({id:fileId(file),name:file,kind:'file',file,line:1});
    parseErrors += sf.parseDiagnostics.length;
    function visit(n,parent){
      const k=kind(n);
      if(k && n.name && (ts.isIdentifier(n.name)||ts.isStringLiteral(n.name)||ts.isPrivateIdentifier(n.name))){
        const key=(parent===fileId(file)?'symbol:'+file:parent)+'/'+k+':'+encodeURIComponent(n.name.text), ordinal=names.get(key)||0;
        names.set(key,ordinal+1);
        const id=addNode({id:key+':'+ordinal,name:n.name.text,kind:k,file,line:line(n),parent});
        if(id){ declarations.set(n,id); parent=id; }
      }
      ts.forEachChild(n,c=>visit(c,parent));
    }
    visit(sf,fileId(file));
  }
  function target(n){
    let s=checker.getSymbolAtLocation(n);
    if(s && (s.flags & ts.SymbolFlags.Alias)){ try{ s=checker.getAliasedSymbol(s); }catch(e){ return; } }
    if(!s) return;
    for(const d of s.declarations || []){
      if(declarations.has(d)) return declarations.get(d);
      if(ts.isSourceFile(d) && input.has(d.fileName)) return fileId(rel(d));
    }
  }
  function access(n){
    let p=n.parent, expr=n;
    if(ts.isPropertyAccessExpression(p) && p.name===n){ expr=p; p=p.parent; }
    if(ts.isBinaryExpression(p) && p.left===expr && p.operatorToken.kind>=ts.SyntaxKind.FirstAssignment && p.operatorToken.kind<=ts.SyntaxKind.LastAssignment)
      return p.operatorToken.kind===ts.SyntaxKind.EqualsToken ? ['writes'] : ['reads','writes'];
    if((ts.isPrefixUnaryExpression(p)||ts.isPostfixUnaryExpression(p)) && [ts.SyntaxKind.PlusPlusToken,ts.SyntaxKind.MinusMinusToken].includes(p.operator)) return ['reads','writes'];
    return ['reads'];
  }
  for(const sf of sourceFiles){
    function visit(n,owner){
      owner=declarations.get(n)||owner;
      if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)){
        const f=resolve(n.moduleSpecifier.text,sf.fileName);
        if(f) edge(fileId(rel(sf)),fileId(f.slice(9)),ts.isExportDeclaration(n)?'exports':'imports',n);
        else unresolvedAt(n,'module',n.moduleSpecifier.text);
      }
      if(ts.isCallExpression(n)||ts.isNewExpression(n)){
        const ex=n.expression;
        if(ts.isIdentifier(ex) && ex.text==='require' && n.arguments && n.arguments[0] && ts.isStringLiteral(n.arguments[0]) && !checker.getSymbolAtLocation(ex)?.declarations?.length){
          const name=n.arguments[0].text, f=resolve(name,sf.fileName);
          if(f) edge(fileId(rel(sf)),fileId(f.slice(9)),'imports',n); else unresolvedAt(n,'module',name);
        } else {
          const t=target(ts.isPropertyAccessExpression(ex)?ex.name:ex);
          if(t) edge(owner,t,ts.isNewExpression(n)?'constructs':'calls',n);
          else unresolvedAt(n,'call',ex.getText(sf));
        }
      }
      if(ts.isExpressionWithTypeArguments(n) && ts.isHeritageClause(n.parent)){
        const t=target(n.expression);
        if(t) edge(owner,t,n.parent.token===ts.SyntaxKind.ExtendsKeyword?'extends':'implements',n);
        else unresolvedAt(n,'heritage',n.expression.getText(sf));
      }
      if(ts.isIdentifier(n)||ts.isPrivateIdentifier(n)){
        const p=n.parent;
        const declarationName=p.name===n && (declarations.has(p)||ts.isImportSpecifier(p)||ts.isImportClause(p)||ts.isNamespaceImport(p));
        const label=(ts.isPropertyAssignment(p) && p.name===n)||ts.isPropertyAccessExpression(p)&&p.expression===n&&n.text==='this';
        if(!declarationName && !label){
          const t=target(n), tn=nodeById.get(t);
          if(t && tn && tn.kind!=='file') for(const k of ['variable','parameter','property'].includes(tn.kind)?access(n):['references']) edge(owner,t,k,n);
        }
      }
      ts.forEachChild(n,c=>visit(c,owner));
    }
    visit(sf,fileId(rel(sf)));
  }
  return {version:1,snapshot:crypto.createHash('sha1').update(JSON.stringify(sources.map(s=>[s.path,s.hash]))).digest('hex').slice(0,12),nodes,edges,unresolved,
    coverage:{...coverage,analyzedFiles:sources.length,unresolved:unresolvedCount,parseErrors,truncated,limits:LIMITS},
    limitations:['JavaScript/TypeScript only. Relative modules and shared script globals; project aliases, external package types and build configuration are not loaded.',
      'Non-module scripts share one analysis scope. Separate runtime entry points and script load order are not modeled.',
      'Static references show possible dependencies, not guaranteed execution or value propagation. Reflection, events, assets and runtime wiring may be missing.']};
}

// Incoming dependencies reveal potential consumers affected by a change. Containment
// expands selected scopes, but is never treated as a dependency itself.
function impact(graph,id,depth=3){
  const byId=new Map(graph.nodes.map(n=>[n.id,n]));
  const seeds=(Array.isArray(id)?id:[id]).filter(x=>byId.has(x));
  if(!seeds.length) return [];
  const children=new Map(), incoming=new Map();
  for(const n of graph.nodes) if(n.parent){ if(!children.has(n.parent)) children.set(n.parent,[]); children.get(n.parent).push(n.id); }
  for(const e of graph.edges){ if(!incoming.has(e.b)) incoming.set(e.b,[]); incoming.get(e.b).push(e); }
  const found=new Map(), queues=Array.from({length:depth+1},()=>[]);
  function scope(x,d,via,expand=false){
    if(found.has(x) && found.get(x).depth<=d) return;
    found.set(x,{id:x,depth:d,via}); queues[d].push(x);
    if(expand) for(const c of children.get(x)||[]) scope(c,d,via,true);
  }
  for(const seed of seeds) scope(seed,0,null,true);
  for(let d=0;d<=depth;d++) for(let i=0;i<queues[d].length;i++){
    const x=queues[d][i]; if(found.get(x).depth!==d) continue;
    // Scope promotion has zero dependency cost; process it at the same depth.
    const n=byId.get(x); if(n.parent) scope(n.parent,d,found.get(x).via);
    if(d<depth) for(const e of incoming.get(x)||[]) scope(e.a,d+1,e.id);
  }
  return [...found.values()].filter(n=>n.depth>0);
}
function compare(previous,current){
  if(!previous) return null;
  const before=new Map(previous.nodes.map(n=>[n.id,n])), after=new Map(current.nodes.map(n=>[n.id,n]));
  const added=current.nodes.filter(n=>!before.has(n.id)), removed=previous.nodes.filter(n=>!after.has(n.id));
  // Compare semantic relationships independently of changing source line positions.
  const key=e=>[e.a,e.b,e.kind].join('|'), oldEdges=new Set(previous.edges.map(key)), newEdges=new Set(current.edges.map(key));
  return {baseSnapshot:previous.snapshot,addedCount:added.length,removedCount:removed.length,added:added.slice(0,100),removed:removed.slice(0,100),
    addedConnections:[...newEdges].filter(k=>!oldEdges.has(k)).length,removedConnections:[...oldEdges].filter(k=>!newEdges.has(k)).length};
}
module.exports={analyze,impact,compare,SUPPORTED,LIMITS};
