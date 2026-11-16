'use strict';
const fs=require('fs'), fsp=fs.promises, path=require('path'), os=require('os'), crypto=require('crypto');
const {execFile}=require('child_process');
const TOOL=path.resolve(__dirname,'../../tools/csharp-analyzer');
const env={...process.env,DOTNET_NOLOGO:'1',DOTNET_SKIP_FIRST_TIME_EXPERIENCE:'1',DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_CLI_DO_NOT_USE_MSBUILD_SERVER:'1'};
function run(args,{signal,cwd,input,timeout=25000}={}){
  return new Promise((resolve,reject)=>{
    const p=execFile('dotnet',args,{cwd,env,signal,timeout,maxBuffer:64*1024*1024,windowsHide:true},(error,stdout,stderr)=>{
      if(error){ error.detail=String(stderr||stdout||error.message).slice(0,1200); reject(error); }else resolve(stdout);
    });
    p.stdin?.on('error',()=>{}); if(input) p.stdin?.end(input); else p.stdin?.end();
  });
}
async function executable(signal){
  const sdkText=await run(['--list-sdks'],{signal});
  const versions=sdkText.split(/\r?\n/).map(s=>s.match(/^(\d+)\.(\d+)\.(\d+)\s/)).filter(m=>m&&+m[1]>=8).sort((a,b)=>+b[1]-+a[1]||+b[2]-+a[2]||+b[3]-+a[3]);
  if(!versions.length) throw new Error('Install .NET SDK 8 or newer, then rescan for C# relationships.');
  const sdk=versions[0], version=sdk[1]+'.'+sdk[2]+'.'+sdk[3];
  const hash=crypto.createHash('sha256');
  for(const f of ['Program.cs','Cascade.CodeAnalysis.csproj','NuGet.Config']) hash.update(await fsp.readFile(path.join(TOOL,f)));
  hash.update(version);
  const cache=path.join(os.tmpdir(),'cascade-csharp-analyzer',hash.digest('hex').slice(0,20)), dll=path.join(cache,'out','Cascade.CodeAnalysis.dll');
  if(fs.existsSync(dll)) return dll;
  await fsp.mkdir(path.dirname(cache),{recursive:true});
  const build=await fsp.mkdtemp(path.join(path.dirname(cache),'build-'));
  await fsp.writeFile(path.join(build,'global.json'),JSON.stringify({sdk:{version,rollForward:'disable'}}));
  // Compile only Cascade's bundled helper. Scanned .csproj files are never built.
  await run(['build',path.join(TOOL,'Cascade.CodeAnalysis.csproj'),'--nologo','--verbosity','quiet','--configfile',path.join(TOOL,'NuGet.Config'),
    '--output',path.join(build,'out'),'-p:BaseIntermediateOutputPath='+path.join(build,'obj')+path.sep,'-p:CascadeFramework=net'+sdk[1]+'.0'],{signal,cwd:build});
  try{ await fsp.rename(build,cache); }catch(e){ if(!fs.existsSync(dll)) throw e; }
  return dll;
}
async function analyze(input,{signal}={}){
  if(!input.sources.length) return null;
  try{
    const dll=await executable(signal);
    return {...JSON.parse(await run([dll],{signal,input:JSON.stringify(input),timeout:25000})),available:true};
  }catch(e){
    if(signal?.aborted || e.name==='AbortError') throw e;
    return {available:false,nodes:input.sources.map(s=>({id:'file:'+s.path,name:s.path,kind:'file',file:s.path,line:1,assembly:s.assembly})),edges:[],unresolved:[],unresolvedCount:0,parseErrors:0,semanticErrors:0,
      error:e.code==='ENOENT'?'Install .NET SDK 8 or newer, then rescan for C# relationships.':e.detail||e.message};
  }
}
module.exports={analyze,executable};
