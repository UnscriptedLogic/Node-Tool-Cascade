'use strict';
// The project-folder workflow through the real page, real server and a scripted AI behind it:
// scan, build a brief, seed the graph with sourced ghosts, open sources, ask and grill with file citations.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const mocks = require('./helpers/mocks');
const { open, webHtml, sleep } = require('./helpers/dom');
const { bootServer, page } = require('./helpers/server');
const { makeUnity, write, FAKE_KEY, FAKE_ENV_KEY } = require('./helpers/fixtures');

let mock;
test.before(async()=>{ mock = await mocks.start(); });
test.after(async()=>{ await mock.close(); });
const J = JSON.stringify;
const prompts = () => mock.log.filter(e=>e.path==='/openai/v1/chat/completions').map(e=>e.body.messages[0].content);
const withText = (t) => prompts().filter(p=>p.includes(t));

/* ---- the scripted AI: it answers each kind of prompt the way a real model would, from what is in the prompt ---- */
function script(prompt){
  if(prompt.includes('reading part of a game project')){
    const files = [...prompt.matchAll(/^FILE (\S+) \(/gm)].map(m=>m[1]), out = [];
    for(const f of files){
      if(f.endsWith('PlayerController.cs')){
        out.push({ kind:'parameter', text:'Walk speed is 6.5 and sprinting multiplies it by 1.6.', file:'PlayerController.cs', line:5 });   // basename only: the app must map it to the real path
        out.push({ kind:'open', text:'Whether to add a double jump is undecided.', file:f, line:9 });
      }
      if(f.endsWith('EnemyAI.cs')) out.push({ kind:'open', text:'The enemy wind-up of 0.3 seconds is too short to read.', file:f, line:3 }, { kind:'state', text:'Enemies cycle through Idle, Chase and Attack.', file:f, line:4 });
      if(f.endsWith('MapGenerator.cs')) out.push({ kind:'parameter', text:'The world is 128 by 128 with landmarks 40 apart.', file:f, line:2 });
      if(f.endsWith('DESIGN.md')) out.push({ kind:'decision', text:'There is no fast travel in the first act.', file:f, line:3 });
    }
    return out.map(J).join('\n');
  }
  if(prompt.includes('writing a brief about a game project'))
    return 'What it is\nA slow exploration game about noticing things.\nHow it plays\nWalk speed is 6.5 and there is no fast travel in the first act.\nUnfinished or undecided\nA double jump and the enemy wind-up are undecided.';
  if(prompt.includes('turning what a game project already contains')){
    const id = (kind) => (prompt.match(new RegExp('^(f\\d+) \\| '+kind+' \\|','m')) || [])[1];
    return [
      { id:'s1', parent:null, type:'loop', text:'Explore', from:[id('decision')] },
      { id:'s2', parent:'s1', type:'decision', text:'Walking is slow on purpose: base speed 6.5', from:[id('parameter')] },
      { id:'s3', parent:'s1', type:'question', text:'Should there be a double jump?', ticket:'talk', from:[id('open')] },
      { id:'s4', parent:'s1', type:'fog', text:'How big the world should be', from:[id('parameter')] },
      { id:'s5', parent:'s1', type:'decision', text:'Invented with a source that does not exist', from:['f999'] },
      { id:'s6', parent:'s1', type:'decision', text:'Invented with no source at all' },
      { id:'s7', parent:'s1', type:'emotion', text:'Players feel wonder', from:[id('decision')] }
    ].map(J).join('\n');
  }
  if(prompt.includes('analysing a game-design decision tree')){
    if(prompt.includes('PROJECT EXCERPTS')) return J({ verdict:'answered', answer:'The tree wants travel to feel deliberate, and the controller sets walking at 6.5 [f1].', threads:[{ label:'Traversal pace', ids:['n6','n7'], why:'The slow-travel problem and its cause.' }], gaps:[], basis:'both', sources:[{ id:'f1', note:'Walk speed in the controller' },{ id:'f99', note:'not a real excerpt' }] });
    return J({ verdict:'answered', answer:'Travel is slow because points of interest are far apart.', threads:[{ label:'Traversal', ids:['n6','n7'], why:'Cause.' }], gaps:[] });
  }
  if(prompt.includes('interviewing a game designer')){
    return prompt.includes('SESSION SO FAR') ? J({ done:true, summary:'Settled.' }) : J({ id:'q1', parent:'n6', text:'How fast should the player be able to move?', why:'Sets the pace of travel.', ticket:'talk', grillable:true });
  }
  if(prompt.includes('sharp but fair design interviewer')){
    // like a real model, cite the excerpt that actually supports the point
    const id = (prompt.match(/\[(f\d+)\] Assets\/Scripts\/Player\/PlayerController\.cs/) || [])[1];
    return id ? J({ verdict:'challenge', text:`The controller already lets players sprint at 1.6 times speed [${id}]. Is that intended?` }) : J({ verdict:'solid', text:'' });
  }
  return null;   // anything else gets the default reply
}

async function setup(t){
  mock.log.length = 0; mock.state.script = script;
  const s = await bootServer(t,mock);
  await fetch(s.base+'/api/settings',{ method:'POST', headers:{ 'content-type':'application/json' }, body:J({ active:'openai', providers:{ openai:{ key:'oa-key-9999', model:'gpt-x-mini' } } }) });
  const a = await page(s); await sleep(500);
  a.escape();   // first run opens Settings; start from the canvas
  return { s, a, root:makeUnity() };
}
async function until(fn,ms = 6000){ const t0 = Date.now(); while(Date.now()-t0<ms){ if(fn()) return true; await sleep(40); } return false; }
async function scan(a,root){
  a.click(a.$('#setBtn')); a.click(a.$('.stabs [data-tab=project]'));
  a.type(a.$('#pPath'),root); a.click(a.$('#pScan'));
  assert.ok(await until(()=>!a.$('#pSummary').hidden),'the scan finishes and shows a summary');
}
async function buildBrief(a){
  a.click(a.$('#pBuild'));
  assert.ok(await until(()=>/Brief written/.test(a.$('#pMsg').textContent)),'the brief is written');
}

test('the Project tab exists only in the local app',async()=>{
  const hosted = open({}); await sleep(300);
  assert.equal(hosted.$('.stabs [data-tab=project]').hidden,true);
  const web = open({ html:webHtml(), url:'https://someone.github.io/cascade/' }); await sleep(300);
  assert.equal(web.$('.stabs [data-tab=project]').hidden,true);
  assert.equal(web.$('#aFilesRow').hidden,true,'no project file option on the Ask tab outside the local app');
});

test('project: scan shows what was read, what was skipped and what was redacted',async(t)=>{
  const { a, root } = await setup(t); await scan(a,root);
  const stats = a.$$('#pStats div').map(d=>d.textContent);
  assert.ok(stats.some(x=>/Unity/.test(x)),'engine is named'); assert.ok(stats.some(x=>/Files read/.test(x)));
  assert.match(a.$('#pDetail').textContent,/Biggest folders/); assert.match(a.$('#pDetail').textContent,/binary/); assert.match(a.$('#pDetail').textContent,/private/);
  assert.match(a.$('#pDetail').textContent,/3 possible secrets were redacted/);
  assert.match(a.$('#pDefaults').textContent,/Unity: .*Library\//);
  assert.equal(a.$('#pBriefWrap').hidden,false); assert.match(a.$('#pEstimate').textContent,/tokens across \d+ calls?/);
  assert.equal(a.$('#mSeed').hidden,true,'nothing to seed from until the brief exists');
  a.type(a.$('#pPath'),'/no/such/folder'); a.click(a.$('#pScan')); await sleep(150);
  assert.match(a.$('#pMsg').textContent,/doesn’t exist/); assert.deepEqual(a.errs,[]);
});

test('project: building a brief reads each folder, never sends a secret, and saves an editable brief',async(t)=>{
  const { s, a, root } = await setup(t); await scan(a,root); await buildBrief(a);
  const maps = withText('reading part of a game project'); assert.ok(maps.length>=2,'one call per folder');
  assert.equal(withText('writing a brief about a game project').length,1);
  const all = prompts().join('\n'); for(const secret of ['hunter2',FAKE_KEY,FAKE_ENV_KEY,'PRIVATE KEY']) assert.ok(!all.includes(secret),'no secret ever leaves the machine: '+secret.slice(0,6));
  assert.match(all,/FILE Assets\/Scripts\/Player\/PlayerController\.cs[^]*moveSpeed=6\.5@5/,'the AI got a digest, not just raw code');
  assert.match(a.$('#pBrief').value,/slow exploration game/); assert.equal(a.$('#pSeed').disabled,false);
  const saved = await (await fetch(s.base+'/api/project')).json(); assert.match(saved.brief,/slow exploration/); assert.ok(saved.findingCount>=5);
  assert.equal(a.$('#mSeed').hidden,false);
  // edits are kept
  a.type(a.$('#pBrief'),'My own corrected brief.'); await sleep(900);
  assert.equal((await (await fetch(s.base+'/api/project')).json()).brief,'My own corrected brief.');
  assert.deepEqual(a.errs,[]);
});

test('project: the brief rides along under the goal and can be switched off',async(t)=>{
  const { a, root } = await setup(t); await scan(a,root); await buildBrief(a);
  a.type(a.$('#gGoal'),'Make travel feel like discovery');
  a.click(a.$('.stabs [data-tab=goal]')); await sleep(50);
  const pre = () => a.$('#gPreview').textContent;
  a.click(a.$('.stabs [data-tab=project]')); a.click(a.$('.stabs [data-tab=goal]'));
  assert.match(pre(),/OVERARCHING GOAL: Make travel feel like discovery[^]*PROJECT BRIEF[^]*the goal and the pillars above always take precedence/);
  a.click(a.$('.stabs [data-tab=project]')); a.$('#pUse').checked = false; a.$('#pUse').dispatchEvent(new a.w.Event('change',{ bubbles:true }));
  a.click(a.$('.stabs [data-tab=goal]')); assert.doesNotMatch(pre(),/PROJECT BRIEF/);
});

test('project: seeding drafts sourced ghosts, drops anything without a real source, and the source opens',async(t)=>{
  const { a, root } = await setup(t); await scan(a,root); await buildBrief(a);
  const before = a.nodes().length; a.click(a.$('#pSeed'));
  assert.ok(await until(()=>a.nodes().filter(n=>n.classList.contains('ghost')).length>=4),'ghosts appear');
  await sleep(200);
  const ghosts = a.nodes().filter(n=>n.classList.contains('ghost'));
  assert.equal(ghosts.length,4,'the node citing a missing finding, the one with no source and the emotion were all refused');
  const texts = ghosts.map(g=>g.querySelector('.txt').textContent);
  assert.deepEqual(texts.sort(),['Explore','How big the world should be','Should there be a double jump?','Walking is slow on purpose: base speed 6.5'].sort());
  assert.ok(ghosts.every(g=>g.classList.contains('has-src')),'every seeded node remembers where it came from');
  const q = ghosts.find(g=>g.classList.contains('question')); assert.ok(q);
  assert.equal(a.nodes().length,before+4); assert.match(a.$('#ntxt').textContent,/Seeded 4 suggestions/);
  // provenance survives keeping the nodes
  a.click(a.$('#keepAll')); await sleep(100);
  const dec = a.nodes().find(n=>n.querySelector('.txt').textContent.startsWith('Walking is slow on purpose'));
  assert.ok(!dec.classList.contains('ghost') && dec.classList.contains('has-src'));
  // click the source mark: the viewer shows the real lines, with the cited line highlighted
  a.click(dec.querySelector('.srcmark')); await sleep(250);
  assert.equal(a.$('#srcview').hidden,false); assert.match(a.$('#svTitle').textContent,/PlayerController\.cs:5/);
  assert.match(a.$('#svCode').textContent,/public float moveSpeed = 6\.5f;/);
  assert.equal(a.$$('#svCode .hit').length,1); assert.match(a.$('#svCode .hit').textContent,/moveSpeed/);
  assert.match(a.$('#svNote').textContent,/Walk speed is 6\.5/);
  a.escape(); assert.equal(a.$('#srcview').hidden,true);
  // and through the bar button
  a.click(dec.querySelector('[data-act=src]')); await sleep(200); assert.equal(a.$('#srcview').hidden,false); a.click(a.$('#svClose')); assert.equal(a.$('#srcview').hidden,true);
  assert.deepEqual(a.errs,[]);
});

test('project: seeding into an empty tree starts it from the project',async(t)=>{
  const { a, root } = await setup(t); await scan(a,root); await buildBrief(a);
  a.click(a.$('#dClear')); a.escape(); await sleep(100);
  assert.equal(a.$('#empty').hidden,false); assert.equal(a.$('#eSeed').hidden,false,'the empty canvas offers to seed');
  a.click(a.$('#eSeed')); assert.ok(await until(()=>a.nodes().length>=4)); await sleep(200);
  assert.equal(a.nodes().filter(n=>!n.classList.contains('ghost')).length,0,'everything arrives as a suggestion');
});

test('project: Ask cites the files it used, shows what it read, and can be told to ignore them',async(t)=>{
  const { a, root } = await setup(t); await scan(a,root); await buildBrief(a); a.escape();
  a.click(a.$('#askBtn')); await sleep(100);
  assert.equal(a.$('#aFilesRow').hidden,false); assert.equal(a.$('#aFiles').checked,true);
  a.type(a.$('#aQ'),'How fast does the player move?'); a.click(a.$('#aGo'));
  assert.ok(await until(()=>!a.$('#aRes').hidden),'an answer arrives'); await sleep(150);
  const ask = withText('analysing a game-design decision tree').pop();
  assert.match(ask,/PROJECT EXCERPTS[^]*\[f1\] Assets\/Scripts\/Player\/PlayerController\.cs lines \d+-\d+/,'the best excerpt is first');
  assert.match(ask,/Excerpts are not tree nodes/);
  assert.equal(a.$('#aBasis').hidden,false); assert.equal(a.$('#aBasis').textContent,'From the tree and the files');
  assert.equal(a.$$('#aAnswer .cite').length,1); assert.match(a.$('#aAnswer .cite').textContent,/PlayerController\.cs:\d+/);
  assert.equal(a.$('#aSources').hidden,false); assert.equal(a.$$('#aSourceList .srcitem').length,1,'a cited id that was never offered is dropped');
  assert.deepEqual(a.$$('.node.in-thread').map(n=>n.dataset.id).sort(),['n6','n7'],'the thread still lights up the tree');
  a.click(a.$('#aAnswer .cite')); await sleep(250);
  assert.equal(a.$('#srcview').hidden,false); assert.match(a.$('#svCode').textContent,/moveSpeed/); a.escape();
  // switch it off: the next question carries no excerpts and shows no sources
  a.$('#aFiles').checked = false; a.$('#aFiles').dispatchEvent(new a.w.Event('change',{ bubbles:true }));
  a.type(a.$('#aQ'),'Why is travel slow?'); a.click(a.$('#aGo')); await sleep(600);
  assert.doesNotMatch(withText('analysing a game-design decision tree').pop(),/PROJECT EXCERPTS/);
  assert.equal(a.$('#aSources').hidden,true); assert.equal(a.$('#aBasis').hidden,true);
  assert.deepEqual(a.errs,[]);
});

test('project: Grill grounds its questions in the code, and pushback can cite it',async(t)=>{
  const { a, root } = await setup(t); await scan(a,root); await buildBrief(a); a.escape();
  a.click(a.$('#mapBtn')); a.click(a.$('#mGrillAll')); await sleep(500);
  const round = withText('interviewing a game designer').pop();
  assert.match(round,/PROJECT EXCERPTS/); assert.match(round,/where it has already made a decision, ask whether it is intended|Where it has already made a decision, ask whether it is intended/i);
  assert.equal(a.$$('.gcard').length,1);
  a.type(a.$('.gcard textarea'),'Players can move as fast as they like, with no limit on their speed.'); a.click(a.$('.gcard [data-gact=answer]')); await sleep(500);
  const push = withText('sharp but fair design interviewer').pop();
  assert.match(push,/PROJECT EXCERPTS[^]*\[f\d\] Assets\/Scripts\/Player\/PlayerController\.cs/,'the controller is among the excerpts'); assert.match(push,/cite the excerpt id like \[f2\]/);
  const shown = a.$('.gcard .gpush').textContent;
  assert.match(shown,/\(PlayerController\.cs:\d+\)/,'the [fN] marker becomes a readable file reference'); assert.doesNotMatch(shown,/\[f\d\]/);
  assert.deepEqual(a.errs,[]);
});

test('project: a rescan finds what changed and updating the brief rereads only that folder',async(t)=>{
  const { a, root } = await setup(t); await scan(a,root); await buildBrief(a);
  const mapsBefore = withText('reading part of a game project').length;
  assert.match(a.$('#pBuild').textContent,/Rebuild brief/,'nothing is stale yet');
  const f = path.join(root,'Assets/Scripts/Player/PlayerController.cs'); fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace('6.5f','9f'));
  write(root,'Assets/Scripts/Inventory/Bag.cs','public class Bag { public int capacity = 24; }');
  a.click(a.$('#pScan')); assert.ok(await until(()=>/Scan finished/.test(a.$('#pMsg').textContent)),'rescan'); await until(()=>/Update brief/.test(a.$('#pBuild').textContent));
  assert.match(a.$('#pBuild').textContent,/Update brief \(1 changed\)/); assert.match(a.$('#pEstimate').textContent,/Only the changed ones this time/);
  const before = a.$('#pBrief').value; a.click(a.$('#pBuild'));
  assert.ok(await until(()=>/Brief written/.test(a.$('#pMsg').textContent)));
  assert.equal(withText('reading part of a game project').length,mapsBefore+1,'only the changed folder was read again');
  assert.equal(a.$('#pRestore').hidden,false); a.$('#pBrief').value = 'something else'; a.click(a.$('#pRestore')); await sleep(900);
  assert.equal(a.$('#pBrief').value,before,'the previous brief comes back');
  assert.deepEqual(a.errs,[]);
});

test('project: reading code needs a real AI, and forgetting the project clears it everywhere',async(t)=>{
  const { s, a, root } = await setup(t); await scan(a,root); await buildBrief(a);
  a.click(a.$('#pForget')); await sleep(300);
  assert.equal(a.$('#pSummary').hidden,true); assert.equal(a.$('#pBrief').value,''); assert.equal(a.$('#mSeed').hidden,true); assert.equal(a.$('#aFilesRow').hidden,true);
  assert.equal((await (await fetch(s.base+'/api/project')).json()).has,false);
  mock.log.length = 0; a.escape(); a.click(a.$('#askBtn')); a.type(a.$('#aQ'),'Why is travel slow?'); a.click(a.$('#aGo')); await sleep(500);
  assert.doesNotMatch(prompts().join('\n'),/PROJECT BRIEF|PROJECT EXCERPTS/);
  // with the demo provider, building a brief explains itself instead of failing quietly
  await fetch(s.base+'/api/settings',{ method:'POST', headers:{ 'content-type':'application/json' }, body:J({ active:'demo' }) });
  const d = await page(s); await sleep(500); d.escape(); await scan(d,root); d.click(d.$('#pBuild')); await sleep(150);
  assert.match(d.$('#pMsg').textContent,/needs a real AI/); assert.deepEqual(d.errs,[]);
});

test('project: sources are saved with the tree and come back after a reload',async(t)=>{
  const { s: srv, a, root } = await setup(t); await scan(a,root); await buildBrief(a); a.click(a.$('#pSeed'));
  assert.ok(await until(()=>a.nodes().filter(n=>n.classList.contains('ghost')).length>=4)); a.click(a.$('#keepAll')); await sleep(900);   // the page saves after a short pause
  const b = await page(srv); await sleep(600);
  const withSrc = b.nodes().filter(n=>n.classList.contains('has-src'));
  assert.equal(withSrc.length,4,'the four kept nodes still know where they came from');
  b.click(withSrc.find(n=>n.querySelector('.txt').textContent.startsWith('Should there be a double jump')).querySelector('.srcmark')); await sleep(250);
  assert.match(b.$('#svTitle').textContent,/PlayerController\.cs:9/); assert.match(b.$('#svCode').textContent,/TODO: should there be a double jump/);
  assert.equal(b.$('#pBrief').value || (JSON.parse(await (await fetch(srv.base+'/api/settings')).text()).project.brief),'What it is\nA slow exploration game about noticing things.\nHow it plays\nWalk speed is 6.5 and there is no fast travel in the first act.\nUnfinished or undecided\nA double jump and the enemy wind-up are undecided.');
  assert.deepEqual(b.errs,[]);
});
