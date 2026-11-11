'use strict';
// Cascade is not only for game design: the words, examples and prompts follow the chosen domain.
const test = require('node:test'), assert = require('node:assert/strict');
const { open, sleep } = require('./helpers/dom');

const GAMEY = /\b(game|games|gameplay|player|players|designer|playtest)\b/i;
const NO_PREFS = { 'cascade-prefs-v1':JSON.stringify({}) };   // a brand new browser: no saved preferences
const recorder = (prompts) => ({ use: async (n) => n!=='sample' ? null : async (prompt) => { prompts.push(prompt); return ''; } });
const legend = (a) => a.$('#legend').previousElementSibling.textContent;

test('domain: a new browser starts with the general profile and no game wording on screen',async()=>{
  const a = open({ local:NO_PREFS, claude:recorder([]) }); await sleep(400);
  assert.equal(legend(a),'How people feel');
  const text = a.nodes().map(n=>n.querySelector('.txt').textContent).join(' | ');
  assert.doesNotMatch(text,GAMEY); assert.match(text,/Why is progress slower than expected/);
  assert.doesNotMatch(a.$$('#gChips .chip').map(c=>c.textContent).join(' '),GAMEY);
  for(const id of ['#gContext','#gPillars','#gAvoid','#aQ','#pPath']) assert.doesNotMatch(a.$(id).placeholder,GAMEY,id);
  assert.deepEqual(a.errs,[]);
});

test('domain: prompts for placing and tracing back carry no game wording in the general profile',async()=>{
  const prompts = [], a = open({ local:NO_PREFS, claude:recorder(prompts) }); await sleep(400);
  await a.drop('question','Should we hire before the launch?',900);
  a.click(a.byText('Interest fades').querySelector('[data-act=back]')); await sleep(900);
  assert.ok(prompts.length>=2,'the AI was asked to place the block and to trace back');
  for(const p of prompts) assert.doesNotMatch(p,GAMEY,p.slice(0,80));
  assert.ok(prompts.some(p=>/decision tree/.test(p)));
});

test('domain: switching to game design changes the words and the starter tree, and the choice is remembered',async()=>{
  const a = open({ local:NO_PREFS, claude:recorder([]) }); await sleep(400);
  a.click(a.$('#setBtn')); a.click(a.$('.stabs button[data-tab=goal]'));
  assert.equal(a.$$('#gDomain option').map(o=>o.value).join(),'general,product,research,game');
  a.type(a.$('#gDomain'),'game');
  assert.equal(legend(a),'Player feeling');
  assert.match(a.$('#gChips .chip').textContent,/traversal/);
  assert.equal(JSON.parse(a.w.localStorage.getItem('cascade-prefs-v1')).domain,'game');
  a.click(a.$('#sClose')); a.click(a.$('#resetBtn')); await sleep(300);
  assert.ok(a.byText('Why does traversal feel slow'));
  assert.deepEqual(a.errs,[]);
});

test('domain: browsers that saved preferences before domains existed keep their game wording',async()=>{
  const a = open({ local:{ 'cascade-prefs-v1':JSON.stringify({ goal:'Make travel fun' }) }, claude:recorder([]) }); await sleep(400);
  assert.equal(legend(a),'Player feeling');
});

test('domain: project-reading prompts follow the profile, and name an engine only when there is one',async()=>{
  const prompts = (domain) => open({ local:{ 'cascade-prefs-v1':JSON.stringify({ domain }) }, claude:recorder([]) });
  const g = prompts('general'); await sleep(300);
  const grp = { label:'docs', digest:'FILE a.md (md)', excerpts:'' };
  const map = g.w.eval(`mapPrompt(${JSON.stringify(grp)},'')`), brief = g.w.eval(`briefPrompt([{id:'f1',kind:'decision',text:'We ship monthly.',refs:[{file:'a.md',line:1}]}],'')`);
  for(const p of [map,brief]) assert.doesNotMatch(p,GAMEY);
  assert.match(map,/part of a project so its decision-maker/); assert.doesNotMatch(map,/\(\s*\)/);
  const k = prompts('game'); await sleep(300);
  assert.match(k.w.eval(`mapPrompt(${JSON.stringify(grp)},'Unity')`),/part of a game project \(Unity\) so its designer/);
});
