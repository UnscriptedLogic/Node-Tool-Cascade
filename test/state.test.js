'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { open, sleep } = require('./helpers/dom');

test('settings reflect preference writes without reopening or manual syncing',async(t)=>{
  const a=open(); t.after(()=>a.dom.window.close()); await sleep(20);
  a.w.eval("PREFS.goal='A goal from a legacy action'; PREFS.domain='research'"); await sleep(0);
  assert.equal(a.$('#gGoal').value,'A goal from a legacy action');
  assert.equal(a.$('#gDomain').value,'research');
  assert.match(a.$('#gDomainHelp').textContent,/study/);
});

test('legacy state writes notify Valtio subscribers and snapshots preserve saved data',async(t)=>{
  const a = open(); t.after(()=>a.dom.window.close()); await sleep(20);
  const state = a.w.eval('S'), prefs = a.w.eval('PREFS'), lib = a.w.eval('LIB');
  let updates = 0;
  const unsub = a.w.CascadeUI.subscribe(state,()=>updates++); t.after(unsub);
  a.w.eval("S.nodes.n6.text = 'A revised question'"); await Promise.resolve();
  assert.equal(updates,1);
  assert.equal(a.w.CascadeUI.snapshot(state).nodes.n6.text,'A revised question');
  a.w.eval("pushHist(); clearGraph(); undo(); Object.assign(PREFS,{goal:'A goal'}); LIB.status='Saved'");
  assert.equal(a.w.eval('S'),state); assert.equal(a.w.eval('PREFS'),prefs); assert.equal(a.w.eval('LIB'),lib);
  assert.equal(state.nodes.n6.text,'A revised question');
  assert.equal(JSON.parse(a.w.eval('snap()')).nodes.n6.text,'A revised question');
});

test('canvas view mutations are untracked, including after clearing the tree',async(t)=>{
  const a = open(); t.after(()=>a.dom.window.close()); await sleep(20);
  const state = a.w.eval('S'); let updates = 0;
  const unsub = a.w.CascadeUI.subscribe(state,()=>updates++); t.after(unsub);
  state.view.x += 10; state.view.z = 2; await Promise.resolve(); assert.equal(updates,0);
  a.w.eval('clearGraph()'); await Promise.resolve(); updates = 0;
  state.view.x += 10; await Promise.resolve(); assert.equal(updates,0);
});
