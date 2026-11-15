'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const Mindsets = require('../app/js/core/mindsets');
const { cleanData } = require('../shared/library');

const pack = (id = 'design-lenses', domains = ['game']) => ({schemaVersion:1,id,version:'1.0.0',name:'Design lenses',icon:'🔍',domains,
  source:{title:'Workshop notes',edition:'First'},guidance:'Ask about the experience.',entries:[
    {id:'return',name:'Meaningful Return',label:'Lens',number:'CUSTOM-1',topics:['traversal','backtracking'],appliesWhen:'Repeated journeys.',questions:['What changes on return?']},
    {id:'combat',name:'Readable Combat',topics:['combat'],questions:['Can someone anticipate the next action?']}
  ]});
const tagged = (extra = {}) => ({type:'question',text:'What makes revisiting this route worthwhile?',mindset:{packId:'design-lenses',entryId:'return',why:'Traversal repeats through familiar terrain.'},...extra});

test('mindsets: domain and branch topic gates exclude unrelated lenses before prompting',()=>{
  const packs = Mindsets.collection([pack()]);
  assert.equal(Mindsets.candidates(packs,'general','Business traversal and revenue').length,0);
  assert.equal(Mindsets.candidates(packs,'game','Business revenue and hiring').length,0);
  assert.deepEqual(Mindsets.candidates(packs,'game','Improve TRAVERSAL!').map(c=>c.entry.id),['return']);
  assert.equal(Mindsets.candidates(packs,'game','Noncombatants need help').length,0,'match whole words');
  packs[0].enabled = false;
  assert.equal(Mindsets.candidates(packs,'game','traversal').length,0);
});

test('mindsets: import rejects missing applicability, duplicate ids and oversized packs',()=>{
  for(const change of [{schemaVersion:2},{domains:[]},{domains:['business']},{entries:[]},{entries:[{id:'x',name:'X',questions:['Why?']}]},{id:'__proto__'}]){
    assert.throws(()=>Mindsets.pack({...pack(),...change}));
  }
  const p = pack(); p.entries.push(p.entries[0]); assert.throws(()=>Mindsets.pack(p),/unique/);
  const broad = pack('broad',['general','game']); broad.entries[0].domains = ['game'];
  assert.equal(Mindsets.candidates(Mindsets.collection([broad]),'general','traversal').length,0);
  assert.throws(()=>Mindsets.collection([pack(),pack()]),/Duplicate/);
  assert.throws(()=>Mindsets.collection(Array.from({length:13},(_,i)=>pack('pack-'+i))),/12/);
  const numbered = pack(); numbered.entries[0].number = 5;
  assert.equal(Mindsets.pack(numbered).entries[0].number,'5');
});

test('mindsets: a large pack cannot crowd smaller matching packs out of the shortlist',()=>{
  const large = pack(); large.entries = Array.from({length:20},(_,i)=>({...large.entries[0],id:'entry-'+i}));
  const small = pack('small');
  const candidates = Mindsets.candidates(Mindsets.collection([large,small]),'game','traversal');
  assert.equal(candidates.length,12); assert.equal(candidates[1].pack.id,'small');
});

test('mindsets: multiple packs retain source snapshots through shared local/cloud library validation',()=>{
  const packs = Mindsets.collection([pack(),pack('second',['general'])]);
  const metadata = Mindsets.snapshot(packs[0],packs[0].entries[0],'Repeated journeys.');
  const tree = {nodes:{n1:{id:'n1',type:'question',text:'Why return?',parent:null,mindset:metadata}},order:['n1'],links:[],seq:1,mindsets:packs};
  const saved = cleanData({tree:JSON.stringify(tree),prefs:{domain:'game'}});
  const restored = JSON.parse(saved.tree);
  assert.equal(restored.mindsets.length,2);
  packs[0].name = 'Renamed'; packs[0].source.title = 'Changed';
  assert.equal(restored.nodes.n1.mindset.source.title,'Workshop notes');
  assert.match(Mindsets.label(metadata),/🔍 Lens #CUSTOM-1: Meaningful Return/);
  assert.deepEqual(Mindsets.metadata(metadata),metadata);
});

// UI regressions use the app's existing jsdom harness.
const {open,sleep,webHtml} = require('./helpers/dom');
function setup(t,reply = '',domain = 'game',extra = {}){
  const prompts = [];
  const a = open({local:{'cascade-prefs-v1':JSON.stringify({domain,autoGrow:false,pushback:false})},
    claude:{use:async()=>async(prompt)=>{prompts.push(prompt); return {text:typeof reply==='function' ? await reply(prompt) : reply};}},...extra});
  t.after(()=>a.dom.window.close());
  return {a,prompts};
}
function importPack(a,p = pack()){
  a.click(a.$('#setBtn')); a.click(a.$('[data-tab=mindsets]'));
  a.$('#msJson').value = JSON.stringify(p); a.click(a.$('#msPasteImport'));
}
const evalJson = (a,code) => JSON.parse(a.w.eval(`JSON.stringify(${code})`));
async function finish(a){ await a.w.eval('chain'); }

test('mindsets UI: import several, disable, override icons, remove and undo without losing tree data',async t=>{
  const {a} = setup(t); await sleep(60);
  importPack(a,[pack(),pack('critical-thinking',['general','game'])]);
  assert.equal(a.$$('.mindset-pack').length,2);
  assert.match(a.$('#msMsg').textContent,/Imported 2/);
  assert.ok(a.byId('n6').querySelector('[data-act=mindset]'),'existing nodes gain a mindset action immediately');
  const on = a.$('.mindset-pack input[type=checkbox]'); on.checked = false; on.dispatchEvent(new a.w.Event('change'));
  assert.equal(evalJson(a,'S.mindsets')[0].enabled,false);
  a.type(a.$('.mindset-pack input[type=text]'),'💡');
  assert.equal(evalJson(a,'S.mindsets')[0].icon,'💡');
  a.click([...a.$$('.mindset-pack button')].find(b=>b.textContent==='Remove'));
  assert.equal(a.$$('.mindset-pack').length,1);
  a.w.eval('undo()'); a.w.eval('renderMindsets()');
  assert.equal(a.$$('.mindset-pack').length,2);
  const saved = JSON.parse(JSON.parse(a.w.localStorage.getItem('cascade-tree-v1')).tree);
  assert.equal(saved.mindsets.length,2);
  const loaded = open({local:{'cascade-tree-v1':a.w.localStorage.getItem('cascade-tree-v1')}}); t.after(()=>loaded.dom.window.close());
  assert.equal(evalJson(loaded,'S.mindsets')[0].enabled,false);
  assert.deepEqual(a.errs,[]); assert.deepEqual(loaded.errs,[]);
});

test('mindsets UI: invalid and duplicate imports leave existing packs untouched',async t=>{
  const {a} = setup(t); await sleep(60); importPack(a);
  importPack(a); assert.match(a.$('#msMsg').textContent,/already imported/);
  importPack(a,{...pack('bad'),domains:[]});
  assert.equal(a.$$('.mindset-pack').length,1); assert.deepEqual(a.errs,[]);
});

test('mindsets UI: explicit generation creates labelled question suggestions and preserves provenance after removal',async t=>{
  const lines = [tagged(),tagged(),tagged({mindset:{packId:'design-lenses',entryId:'invented',why:'Unknown'}}),tagged({type:'answer'}),tagged({text:'Ordinary untagged question?',mindset:undefined})].map(JSON.stringify).join('\n');
  const {a,prompts} = setup(t,lines); await sleep(60); importPack(a);
  a.w.eval("select('n6')"); a.w.eval('renderMindsets()');
  a.click([...a.$$('.mindset-pack button')].find(b=>b.textContent==='Apply to selected node')); await finish(a);
  const nodes = evalJson(a,'Object.values(S.nodes).filter(n=>n.mindset)'); assert.equal(nodes.length,1);
  const q = nodes[0]; assert.equal(q.type,'question'); assert.equal(q.ghost,true); assert.equal(q.parent,'n6');
  assert.equal(a.byId(q.id).querySelector('.mindset-label').textContent,'Lens #CUSTOM-1: Meaningful Return');
  assert.match(a.byId(q.id).querySelector('.mindset-label').title,/Traversal repeats/);
  a.click(a.byId(q.id).querySelector('.mindset-label')); assert.match(a.$('#ntxt').textContent,/Workshop notes/);
  assert.match(prompts[0],/ONLY when they directly help/); assert.doesNotMatch(prompts[0],/Readable Combat/);
  a.w.eval(`acceptGhost('${q.id}'); startResolve('${q.id}')`);
  assert.match(a.$('.gq').textContent,/Meaningful Return/);
  a.type(a.$('.gans'),'Returning unlocks new paths.'); a.click(a.$('[data-gact=answer]')); await sleep(30);
  assert.equal(evalJson(a,`S.nodes['${q.id}']`).state,'settled');
  a.w.eval('S.mindsets = []; save(); layout(false)');
  const imported = evalJson(a,'sanitizeTree(JSON.parse(snap()))');
  assert.equal(imported.nodes[q.id].mindset.source.edition,'First');
  assert.match(a.byId(q.id).textContent,/Meaningful Return/);
  assert.deepEqual(a.errs,[]);
});

test('mindsets UI: business trees never send game-only packs, even when branch keywords overlap',async t=>{
  const {a,prompts} = setup(t,JSON.stringify(tagged({parent:'n1'})),'general'); await sleep(60); importPack(a);
  a.w.eval("S.nodes.n1.text='Business traversal of the sales pipeline'; select('n1'); applyMindset('n1','design-lenses')"); await finish(a);
  assert.equal(prompts.length,0,'explicit action cannot bypass the domain gate');
  a.w.eval("growNode('n1')"); await finish(a);
  assert.equal(prompts.length,1);
  assert.doesNotMatch(prompts[0],/Meaningful Return|Workshop notes|What changes on return/);
  assert.equal(evalJson(a,'Object.values(S.nodes).filter(n=>n.mindset)').length,0,'forged tagged output rejected');
  assert.deepEqual(a.errs,[]);
});

test('mindsets UI: automatic grow validates entries against actual parent branch and caps additions',async t=>{
  const reply = [tagged({id:'g1',parent:'n6'}),tagged({id:'g2',parent:'n6',text:'What changes after returning?'}),tagged({id:'g3',parent:'n6',text:'Third lens question?'}),tagged({id:'g4',parent:'n12',text:'Unrelated combat branch?'}),{id:'g5',parent:'n6',type:'question',text:'Ordinary follow-up?'}].map(JSON.stringify).join('\n');
  const {a} = setup(t,reply); await sleep(60); importPack(a);
  a.w.eval("closeSettings(); growNode('n6')"); await finish(a);
  assert.equal(evalJson(a,'Object.values(S.nodes).filter(n=>n.mindset)').length,2);
  assert.ok(a.byText('Ordinary follow-up')); assert.equal(a.byText('Unrelated combat branch'),undefined);
  assert.deepEqual(a.errs,[]);
});

test('mindsets UI: interview questions keep lens metadata when answered',async t=>{
  const {a,prompts} = setup(t,JSON.stringify(tagged({parent:'n6',why:'Tests repeated journeys.'}))); await sleep(60); importPack(a);
  a.w.eval("closeSettings(); startGrill('n6')"); await sleep(150);
  assert.match(prompts[0],/MINDSET QUESTION OPTIONS/);
  assert.match(a.$('.gq').textContent,/Meaningful Return/);
  a.type(a.$('.gans'),'New routes open after each trip.'); a.click(a.$('[data-gact=answer]')); await sleep(40);
  const q = evalJson(a,'Object.values(S.nodes).find(n=>n.mindset)');
  assert.equal(q.state,'settled'); assert.equal(q.mindset.entryId,'return'); assert.deepEqual(a.errs,[]);
});

test('mindsets UI: switching library trees isolates packs; older exports stay compatible',async t=>{
  const {a} = setup(t); await sleep(60); importPack(a);
  const data = evalJson(a,'libData()'); a.w.eval('libApply(libBlankData())');
  assert.equal(evalJson(a,'S.mindsets').length,0);
  a.w.eval(`libApply(${JSON.stringify(data)})`);
  assert.equal(evalJson(a,'S.mindsets').length,1);
  const legacy = {nodes:{n1:{id:'n1',type:'question',text:'Legacy question',parent:null}},order:['n1'],links:[],seq:1};
  assert.deepEqual(evalJson(a,`sanitizeTree(${JSON.stringify(legacy)}).mindsets`),[]);
  assert.deepEqual(a.errs,[]);
});

test('mindsets UI: demo mode does not pretend to apply imported packs',async t=>{
  const {a} = setup(t,'','game',{html:webHtml()}); await sleep(60); importPack(a);
  a.w.eval("closeSettings(); applyMindset('n6','design-lenses')"); await finish(a);
  assert.match(a.$('#ntxt').textContent,/connected provider/);
  assert.equal(evalJson(a,'Object.values(S.nodes).filter(n=>n.mindset)').length,0);
});

test('mindsets UI: chart uses relevant branches beyond a generic root',async t=>{
  const {a,prompts} = setup(t,JSON.stringify(tagged({id:'t1',parent:'n6',ticket:'research'}))); await sleep(60); importPack(a);
  a.w.eval("PREFS.goal='Improve traversal'; closeSettings(); chartMap()"); await finish(a);
  assert.match(prompts[0],/MINDSET QUESTION OPTIONS/);
  const q = evalJson(a,'Object.values(S.nodes).find(n=>n.mindset)');
  assert.equal(q.ticket,'research'); assert.equal(q.parent,'n6'); assert.deepEqual(a.errs,[]);
});

test('mindsets UI: disabling a pack while generation runs prevents stale suggestions',async t=>{
  let release, started;
  const ready = new Promise(resolve=>{started = resolve;});
  const {a} = setup(t,()=>new Promise(resolve=>{ release = resolve; started(); })); await sleep(60); importPack(a);
  a.w.eval("closeSettings(); applyMindset('n6','design-lenses')"); await ready;
  a.click(a.$('#setBtn')); a.click(a.$('[data-tab=mindsets]'));
  const on = a.$('.mindset-pack input[type=checkbox]'); on.checked = false; on.dispatchEvent(new a.w.Event('change'));
  release(JSON.stringify(tagged())); await finish(a);
  assert.equal(evalJson(a,'Object.values(S.nodes).filter(n=>n.mindset)').length,0);
  assert.deepEqual(a.errs,[]);
});
