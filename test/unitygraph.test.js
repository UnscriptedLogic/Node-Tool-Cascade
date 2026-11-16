'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const DATA=fs.mkdtempSync(path.join(os.tmpdir(),'cascade-unity-graph-data-'));process.env.CASCADE_DATA_DIR=DATA;
const csharp=require('../server/lib/csharp'),unity=require('../server/lib/unitygraph'),projectgraph=require('../server/lib/projectgraph');
const {impact,compare}=require('../server/lib/codegraph');
const project=require('../server/lib/project');
const {write}=require('./helpers/fixtures');
const src=(path,text)=>({path,text,hash:crypto.createHash('sha1').update(text).digest('hex').slice(0,12)});
const healthGuid='1'.repeat(32),weaponGuid='2'.repeat(32),prefabGuid='3'.repeat(32),coreGuid='4'.repeat(32);
const sources=[
  src('Assets/Core/Core.asmdef',JSON.stringify({name:'Game.Core'})),src('Assets/Core/Core.asmdef.meta','guid: '+coreGuid),
  src('Assets/Combat/Combat.asmdef',JSON.stringify({name:'Game.Combat',references:['GUID:'+coreGuid]})),
  src('Assets/Core/Health.cs','namespace Game.Core; public interface IDamage { void Damage(int amount); } public partial class Health : IDamage { public int Value=100; public void Damage(int amount) { Value -= amount; } public void Damage(string reason) { } }'),
  src('Assets/Core/Health.Extra.cs','namespace Game.Core; public partial class Health { public void Reset() { Value=100; } }'),
  src('Assets/Core/Health.cs.meta','guid: '+healthGuid),
  src('Assets/Combat/Weapon.cs','using Target=Game.Core.Health; namespace Game.Combat; public class Weapon { public Target health = new Target(); public void Hit() { health.Damage(10); { int health=0; health++; } } } public class Sword : Weapon {}'),
  src('Assets/Combat/Weapon.cs.meta','guid: '+weaponGuid),
  src('Assets/Prefabs/Hero.prefab',`%YAML 1.1
--- !u!1 &1
GameObject:
  m_Name: Hero
--- !u!114 &10
MonoBehaviour:
  m_GameObject: {fileID: 1}
  m_Script: {fileID: 11500000, guid: ${healthGuid}, type: 3}
--- !u!114 &11
MonoBehaviour:
  m_GameObject: {fileID: 1}
  m_Script: {fileID: 11500000, guid: ${weaponGuid}, type: 3}
  health: {fileID: 10}
`),src('Assets/Prefabs/Hero.prefab.meta','guid: '+prefabGuid),
  src('Assets/Scenes/Arena.unity',`%YAML 1.1
--- !u!1 &2
GameObject:
  m_Name: Enemy
--- !u!114 &20
MonoBehaviour:
  m_GameObject: {fileID: 2}
  m_Script: {fileID: 11500000, guid: ${healthGuid}, type: 3}
--- !u!1001 &30
PrefabInstance:
  m_SourcePrefab: {fileID: 100100000, guid: ${prefabGuid}, type: 3}
`)
];
let cs,graph;
test.before(async()=>{
  const prepared=unity.prepare(sources,true);
  cs=await csharp.analyze({sources:prepared.code,assemblies:prepared.assemblies});
  if(!cs.available && !/Install \.NET SDK/.test(cs.error)) throw Error(cs.error);
  graph=projectgraph.analyze(sources,cs,{engine:'unity',supportedFiles:prepared.code.length,scannedFiles:sources.length,omittedFiles:0});
});
test.after(()=>fs.rmSync(DATA,{recursive:true,force:true}));
const node=(name,kind)=>graph.nodes.find(n=>n.name===name&&(!kind||n.kind===kind));

test('Roslyn resolves namespaces, partial classes, overloads, field writes and local shadowing across assemblies',t=>{
  if(!cs.available)return t.skip(cs.error);
  const health=node('Health','class'), value=node('Value','field'), hit=node('Hit','method'), sword=node('Sword','class');
  assert.equal(graph.nodes.filter(n=>n.name==='Health'&&n.kind==='class').length,1);
  assert.equal(health.declarations.length,2);
  const damage=graph.nodes.filter(n=>n.name==='Damage'&&n.kind==='method'&&n.parent===health.id);
  assert.equal(damage.length,2);
  const call=graph.edges.find(e=>e.a===hit.id&&e.kind==='calls');assert.ok(call);assert.match(call.b,/System.Int32/);
  assert.ok(graph.edges.some(e=>e.a===call.b&&e.b===value.id&&e.kind==='writes'));
  assert.ok(graph.edges.some(e=>e.a===sword.id&&e.b===node('Weapon','class').id&&e.kind==='extends'));
  const local=node('health','variable');assert.ok(local);assert.ok(graph.edges.some(e=>e.b===local.id&&e.kind==='writes'));
  assert.ok(!graph.edges.some(e=>e.b===node('health','field').id&&e.kind==='writes'),'local increment does not mutate field');
  assert.ok(graph.edges.some(e=>e.a==='assembly:Game.Combat'&&e.b==='assembly:Game.Core'&&e.kind==='assembly-reference'));
  assert.equal(graph.coverage.semanticErrors,0);
});

test('Unity instances stay separate, preserve source lines, and connect through GUID/fileID references',t=>{
  const hero=node('Hero','gameobject');assert.ok(hero);
  const instances=graph.nodes.filter(n=>n.classId===node('Health','class')?.id);
  if(cs.available){assert.equal(instances.length,2);assert.ok(instances.every(n=>n.kind==='component'&&n.id!==n.classId));}
  const link=graph.edges.find(e=>e.kind==='serialized'&&e.field==='health');assert.ok(link);assert.equal(link.a,'unity:Assets/Prefabs/Hero.prefab#11');assert.equal(link.b,'unity:Assets/Prefabs/Hero.prefab#10');
  assert.equal(sources.find(s=>s.path===link.file).text.split('\n')[link.line-1].trim(),'health: {fileID: 10}');
  assert.ok(graph.edges.some(e=>e.kind==='prefab-reference'&&e.b==='file:Assets/Prefabs/Hero.prefab'));
  const script=graph.edges.find(e=>e.kind==='script');assert.ok(script.evidenceFiles[0].endsWith('.cs.meta'));
  if(cs.available)assert.ok(impact(graph,node('Health','class').id,5).some(x=>x.id==='file:Assets/Scenes/Arena.unity'));
});

test('duplicate GUIDs and missing serialized targets are unresolved instead of guessed',()=>{
  const bad=sources.concat(src('Assets/Other.cs.meta','guid: '+healthGuid),src('Assets/Bad.asset','%YAML 1.1\n--- !u!114 &1\nMonoBehaviour:\n  target: {fileID: 12, guid: '+ '9'.repeat(32)+', type: 3}\n'));
  const prepared=unity.prepare(bad,true), result=unity.analyze(bad,structuredClone(cs),prepared);
  assert.ok(result.unresolved.some(x=>x.name.includes('ambiguous GUID')));
  assert.ok(!result.edges.some(e=>e.kind==='instance-of'&&e.b===node('Health','class')?.id));
  assert.ok(result.unresolved.some(x=>x.name.includes('9'.repeat(32))));
});

test('C# identities survive whitespace changes, and absent engine types reduce coverage without inventing calls',async t=>{
  if(!cs.available)return t.skip(cs.error);
  const moved=sources.map(s=>/\.cs$/.test(s.path)?src(s.path,'\n\n'+s.text):s), prep=unity.prepare(moved,true);
  const other=await csharp.analyze({sources:prep.code,assemblies:prep.assemblies});assert.ok(other.available,other.error);
  const diff=compare(graph,projectgraph.analyze(moved,other,{engine:'unity'}));assert.equal(diff.addedCount,0);assert.equal(diff.removedCount,0);assert.equal(diff.addedConnections,0);assert.equal(diff.removedConnections,0);
  const missing=await csharp.analyze({sources:[{path:'Actor.cs',assembly:'Project',text:'using UnityEngine; public class Actor : MonoBehaviour { void Update(){ Missing(); } }'}],assemblies:[]});
  assert.ok(missing.semanticErrors>0);assert.ok(missing.unresolvedCount>0);assert.ok(!missing.edges.some(e=>e.kind==='calls'));
});

test('Unity scan persists assets, excludes binary data, validates metadata evidence, and refreshes removal impact',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cascade-unity-graph-'));
  try{
    write(root,'ProjectSettings/ProjectVersion.txt','m_EditorVersion: 6000.4.8f1');write(root,'Packages/manifest.json','{}');
    for(const s of sources)write(root,s.path,s.text);
    write(root,'Assets/Binary.asset','\0binary');write(root,'Assets/texture.png.meta','guid: '+'8'.repeat(32));
    await project.scan(root);const g=project.codeGraph();assert.equal(g.coverage.engine,'unity');assert.ok(g.nodes.some(n=>n.kind==='prefab'));assert.ok(!g.nodes.some(n=>n.file==='Assets/Binary.asset'));
    const e=g.edges.find(e=>e.kind==='script'), ctx=await project.codeContext([e.a],e.id);assert.ok(ctx.excerpts.some(x=>x.file.endsWith('.cs.meta')));
    write(root,e.evidenceFiles[0],'guid: '+'7'.repeat(32));await assert.rejects(project.codeContext([e.a],e.id),/Rescan/);
    fs.unlinkSync(path.join(root,'Assets/Scenes/Arena.unity'));await project.scan(root);assert.ok(project.codeGraph().diff.removed.some(n=>n.kind==='scene'));
    assert.ok(!project.codeGraph().nodes.some(n=>n.kind==='file'&&n.file.endsWith('.png.meta')));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('missing SDK preserves file browsing and reports installation requirement without guessed symbols',()=>{
  const {execFileSync}=require('node:child_process');
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>key.toLowerCase()!=='path'));env.PATH='';
  const script='require('+JSON.stringify(require.resolve('../server/lib/csharp'))+').analyze({sources:[{path:"Actor.cs",text:"public class Actor {}",assembly:"Project"}],assemblies:[]}).then(r=>console.log(JSON.stringify(r)))';
  const result=JSON.parse(execFileSync(process.execPath,['-e',script],{env,encoding:'utf8',windowsHide:true}));
  assert.equal(result.available,false);assert.match(result.error,/Install \.NET SDK/);assert.equal(result.nodes.length,1);assert.equal(result.nodes[0].kind,'file');assert.equal(result.edges.length,0);
});
