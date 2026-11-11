'use strict';
// Bridge: name a feeling you want, and the existing tree is extended toward it while the feeling is traced back from the other
// end. If the two cannot meet, a grill starts to find the missing step.
const test = require('node:test'), assert = require('node:assert/strict');
const { open, webHtml, sleep } = require('./helpers/dom');

const J = JSON.stringify;
// a scripted model: placement puts the feeling under n6, the bridge answers with `bridge`, grill rounds ask one question
function model(prompts,bridge){
  return { use: async (n) => n!=='sample' ? null : async (prompt) => {
    prompts.push(prompt); let text = '';
    if(prompt.includes('placement engine')) text = J({ type:'emotion', parent:'n6', relation:'feels like', related:[], mood:'awe', reason:'It is the feeling the traversal should end in.' });
    else if(prompt.includes('You are bridging a gap')) text = bridge;
    else if(prompt.includes('interviewing a game designer')) text = prompt.includes('SESSION SO FAR') ? J({ done:true, summary:'ok' }) : J({ id:'q1', parent:'n6', text:'What would make a long trip feel like a reward?', why:'It links the tree to the feeling.', ticket:'talk', grillable:true });
    return { text };
  } };
}
const NODES = [
  { id:'g1', side:'forward', parent:'n6', type:'question', text:'What could a long trip end with?', wave:1 },
  { id:'g2', side:'forward', parent:'g1', type:'consequence', text:'Players arrive somewhere that was worth the walk', wave:2 },
  { id:'g3', side:'backward', parent:'EMO', type:'question', text:'What would make arriving feel earned?', wave:1 },
  { id:'g4', side:'backward', parent:'g3', type:'answer', text:'A view that was hidden until you arrived', links:['g2'], wave:2 }
];

test('bridge: dropping an emotion into a tree with content grows both ends, links them, and reports the bridge',async()=>{
  const prompts = [], probe = open({ claude:model([],'') }); await sleep(300);
  const emoId = 'n' + (probe.w.eval('S.seq') + 1);   // the new feeling gets the next id; the model refers to it by that id
  const bridge = NODES.map(n=>J(n).replace('"EMO"',J(emoId))).concat(J({ verdict:'bridged', gap:'' })).join('\n');
  const b = open({ claude:model(prompts,bridge) }); await sleep(400);
  await b.drop('emotion','Awe when a long trip finally pays off',2600);
  const p = prompts.find(x=>x.includes('You are bridging a gap'));
  assert.ok(p,'the AI was asked to bridge'); assert.match(p,/TARGET FEELING: n\d+ \| emotion/); assert.match(p,/Awe when a long trip finally pays off/);
  assert.ok(!prompts.some(x=>x.includes('backtrack from an emotion')),'bridging replaces the plain trace back');
  const ghosts = b.nodes().filter(n=>n.classList.contains('ghost'));
  assert.equal(ghosts.length,4,'two forward and two backward suggestions');
  assert.match(b.$('#ntxt').textContent,/Bridged/);
  assert.ok(b.$$('#eg path').length>0);
  assert.equal(prompts.filter(x=>x.includes('interviewing')).length,0,'no grill when the ends meet');
  assert.deepEqual(b.errs,[]);
});

test('bridge: when the ends cannot meet, a grill starts with the missing step as its focus',async()=>{
  const prompts = [];
  const probe = open({ claude:model([],'') }); await sleep(300);
  const emo = 'n' + (probe.w.eval('S.seq') + 1);
  const bridge = [{ id:'g1', side:'backward', parent:emo, type:'question', text:'What would produce this?', wave:1 }].map(J).join('\n') + '\n' + J({ verdict:'gap', gap:'Nothing says how players get from walking to wonder.' });
  const a = open({ claude:model(prompts,bridge) }); await sleep(400);
  await a.drop('emotion','Wonder at the end of the road',2600);
  assert.match(a.$('#ntxt').textContent,/Not bridged/);
  assert.ok(await (async()=>{ for(let i=0;i<40;i++){ if(prompts.some(x=>x.includes('interviewing a game designer'))) return true; await sleep(100); } return false; })(),'a grill round was requested');
  const round = prompts.find(x=>x.includes('interviewing a game designer'));
  assert.match(round,/GAP TO CLOSE/); assert.match(round,/Nothing says how players get from walking to wonder/); assert.match(round,/Wonder at the end of the road/);
  assert.equal(a.$('#side').hidden,false,'the side panel opened for the grill');
  assert.ok(a.$$('.gcard').length>=1,'a question card is waiting');
});

test('bridge: emotions get a Bridge button once the tree has something to start from, and a click bridges',async()=>{
  const prompts = [], a = open({ claude:model(prompts,J({ verdict:'bridged', gap:'' })) }); await sleep(400);
  const emo = a.byText('Bored crossing');
  assert.ok(emo.querySelector('[data-act=bridge]'),'Bridge is offered'); assert.ok(emo.querySelector('[data-act=back]'),'Trace back is still offered');
  assert.ok(!a.byText('No movement abilities').querySelector('[data-act=bridge]'),'only emotions can be bridged to');
  a.click(emo.querySelector('[data-act=bridge]')); await sleep(900);
  assert.ok(prompts.some(x=>x.includes('You are bridging a gap')));
});

test('bridge: the demo provider bridges a related feeling, and grills when nothing in the tree is related',async()=>{
  const web = () => open({ html:webHtml(), url:'https://someone.github.io/cascade/', local:{ 'cascade-prefs-v1':J({ domain:'game' }) } });
  const a = web(); await sleep(400);
  await a.drop('emotion','Relief when upgrades change how the player moves',2500);
  assert.match(a.$('#ntxt').textContent,/Bridged/,'related words connect to the upgrade question');
  assert.ok(a.nodes().some(n=>n.classList.contains('ghost')));
  const b = web(); await sleep(400);
  await b.drop('emotion','Dread of a dragon',2500);
  assert.match(b.$('#ntxt').textContent,/Not bridged/);
  assert.ok(await (async()=>{ for(let i=0;i<40;i++){ if(b.$$('.gcard').length) return true; await sleep(100); } return false; })(),'the demo grill asks questions');
  assert.deepEqual(a.errs.concat(b.errs),[]);
});
