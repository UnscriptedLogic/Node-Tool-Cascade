'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const DATA=fs.mkdtempSync(path.join(os.tmpdir(),'cascade-code-data-'));
process.env.CASCADE_DATA_DIR=DATA;
const {analyze,impact,compare}=require('../server/lib/codegraph');
const project=require('../server/lib/project');
const {write}=require('./helpers/fixtures');
const source=(name,text)=>({path:name,text,hash:require('crypto').createHash('sha1').update(text).digest('hex').slice(0,12)});
const sources=[
  source('model.ts','export class Base {}\nexport class Store extends Base { value=1; set(v:number){ this.value=v; this.value++; return this.value; } }'),
  source('use.ts','import { Store } from "./model";\nconst store=new Store();\nexport function update(){ store.set(2); }\nfunction local(){let store=1; return store;}'),
  source('consumer.ts','import {update} from "./use"; export function run(){update();}'),
  source('shared.js','let sharedValue=3; function sharedTask(){return sharedValue;}'),
  source('caller.js','function sharedCaller(){sharedTask(); sharedValue=4;}'),
  source('other.js','// sharedTask();\nconst text="sharedTask()";\nfunction isolated(){let sharedValue=0;return sharedValue;}'),
  source('common.cjs','const model=require("./model"); module.exports = () => new model.Store();'),
  source('external.ts','import {x} from "external"; x(); import("./missing");')
];
test.after(()=>fs.rmSync(DATA,{recursive:true,force:true}));

test('semantic graph resolves aliases, inheritance, calls, scope and read/write evidence',()=>{
  const g=analyze(sources), node=(name,file)=>g.nodes.find(n=>n.name===name&&(!file||n.file===file));
  const has=(a,b,kind)=>g.edges.some(e=>e.a===a.id&&e.b===b.id&&e.kind===kind);
  const store=node('Store'), base=node('Base'), update=node('update'), set=node('set'), value=node('value');
  assert.ok(has(store,base,'extends'));
  assert.ok(has(update,set,'calls'),'imported instance method resolved');
  assert.ok(has(set,value,'writes')); assert.ok(has(set,value,'reads'));
  assert.ok(has(node('sharedCaller'),node('sharedTask'),'calls'),'shared browser-script globals resolved');
  assert.ok(has(node('sharedCaller'),node('sharedValue','shared.js'),'writes'));
  assert.ok(!has(node('isolated'),node('sharedValue','shared.js'),'reads'),'same name in local scope is distinct');
  assert.ok(!g.edges.some(e=>e.kind==='calls'&&e.file==='other.js'),'comments and strings never make call edges');
  assert.ok(g.edges.some(e=>e.kind==='imports'&&e.file==='common.cjs'),'literal CommonJS dependency recorded');
  assert.ok(g.unresolved.some(x=>x.kind==='module'&&x.name==='external'));
  assert.ok(g.edges.every(e=>e.file&&e.line>0&&e.evidence==='static'));
  assert.ok(JSON.stringify(g).length<100000);
});

test('incoming impact follows transitive consumers, expands scopes, respects depth and terminates cycles',()=>{
  const g=analyze(sources), store=g.nodes.find(n=>n.name==='Store');
  const direct=impact(g,store.id,1), deeper=impact(g,store.id,5);
  const id=g.nodes.find(n=>n.name==='run').id;
  assert.ok(!direct.some(x=>x.id===id)); assert.ok(deeper.some(x=>x.id===id));
  const consumerFile=g.nodes.find(n=>n.kind==='file'&&n.file==='consumer.ts');
  assert.ok(impact(g,'file:model.ts',5).some(x=>x.id===consumerFile.id));
  const cyclic={nodes:[{id:'a'},{id:'b'},{id:'c'}],edges:[{id:'1',a:'a',b:'b'},{id:'2',a:'b',b:'a'},{id:'3',a:'c',b:'b'}]};
  assert.deepEqual(impact(cyclic,'a',3).map(x=>x.id).sort(),['b','c']);
  assert.deepEqual(impact(g,'missing',3),[]);
});

test('snapshot scan persists full code graph independently of search, validates prompt evidence and forgets it',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cascade-code-project-'));
  try{
    for(const s of sources) write(root,s.path,s.text);
    write(root,'notes.md','Project notes'); write(root,'.env','SECRET=private');
    await project.scan(root);
    let g=project.codeGraph();
    assert.equal(g.coverage.analyzedFiles,sources.length); assert.equal(g.coverage.scannedFiles,sources.length+1);
    assert.equal(g.coverage.omittedFiles,0); assert.ok(g.scannedAt);
    assert.ok(!g.nodes.some(n=>n.file==='.env'));
    const store=g.nodes.find(n=>n.name==='Store'), edge=g.edges.find(e=>e.kind==='calls'&&e.file==='use.ts');
    const context=await project.codeContext([store.id],edge.id);
    assert.equal(context.snapshot,g.snapshot); assert.ok(context.excerpts.some(x=>x.file==='use.ts'&&x.text.includes('store.set(2)')));
    project.load(); assert.equal(project.codeGraph().snapshot,g.snapshot);
    write(root,'model.ts','export class Store {}');
    await assert.rejects(project.codeContext([store.id]),/Rescan/);
    await assert.rejects(project.codeContext(['file:../../outside']),/Select/);
    await project.scan(root); assert.notEqual(project.codeGraph().snapshot,g.snapshot);
    project.forget(); assert.throws(()=>project.codeGraph(),/Scan/);
  }finally{ fs.rmSync(root,{recursive:true,force:true}); }
});

test('malformed syntax and excluded files stay visible as coverage limits',()=>{
  const g=analyze([source('bad.ts','export class {')],{supportedFiles:3,omittedFiles:2,scanLimited:true});
  assert.ok(g.coverage.parseErrors>0); assert.equal(g.coverage.omittedFiles,2); assert.equal(g.coverage.scanLimited,true);
});

test('snapshot comparison ignores line shifts and tracks symbol/relationship removal',()=>{
  const before=analyze(sources), moved=analyze(sources.map(s=>source(s.path,'\n\n'+s.text)));
  const d=compare(before,moved);
  assert.equal(d.addedCount,0);assert.equal(d.removedCount,0);assert.equal(d.addedConnections,0);assert.equal(d.removedConnections,0);
  const removed=compare(before,analyze(sources.filter(s=>s.path!=='consumer.ts')));
  assert.ok(removed.removed.some(n=>n.name==='run'));assert.ok(removed.removedConnections>0);
});
