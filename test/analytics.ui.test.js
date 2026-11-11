'use strict';
// The page's side of anonymous usage counts: what it reports, when it stays silent, and the switch in Settings.
const test = require('node:test'), assert = require('node:assert/strict');
const { open, webHtml, sleep } = require('./helpers/dom');

const J = JSON.stringify;
const GAME = { 'cascade-prefs-v1':J({ domain:'game' }) };
// a cloud backend that counts (or not), recording every event the page sends
function cloud({ analytics = true } = {}){
  const events = [], calls = [];
  const res = (body,status = 200) => ({ ok:status<400, status, headers:{ get:()=>'application/json' }, json:async()=>body });
  const fetchImpl = async (u,o = {}) => {
    const p = String(u); calls.push(p);
    if(p==='/api/config') return res({ cloud:true, analytics, googleClientId:'x.apps.googleusercontent.com' });
    if(p==='/api/auth/me') return res({ user:null });
    if(p==='/api/event'){ events.push(JSON.parse(o.body)); return res(null,204); }
    return res({ error:'sign_in' },401);
  };
  return { events, calls, fetchImpl };
}
const page = (c,extra = {}) => open({ html:webHtml(), url:'https://someone.github.io/cascade/', fetchImpl:c.fetchImpl, local:GAME, ...extra });

test('analytics page: placing a block and keeping its suggestions are reported with block types and counts only',async()=>{
  const c = cloud(), a = page(c); await sleep(600);
  await a.drop('question','Would a bigger map horizontally solve traversal issues?',2200);
  const created = c.events.filter(e=>e.name==='block_created');
  assert.deepEqual(created,[{ name:'block_created', label:'question' }],'one block placed by a person, reported by type only');
  assert.ok(c.events.some(e=>e.name==='grow' && e.label==='forward'),'the automatic grow is counted');
  assert.ok(a.nodes().some(n=>n.classList.contains('ghost')),'there are suggestions to keep');
  const ghostsByType = {}; a.nodes().filter(n=>n.classList.contains('ghost')).forEach(n=>{ const t = [...n.classList].find(k=>['question','answer','emotion','consequence','decision','fog'].includes(k)); ghostsByType[t] = (ghostsByType[t]||0)+1; });
  a.click(a.$('#keepAll')); await sleep(200);
  const approved = c.events.filter(e=>e.name==='block_approved');
  assert.ok(approved.length>0); assert.equal(approved.reduce((s,e)=>s+e.count,0),Object.values(ghostsByType).reduce((s,n)=>s+n,0),'every kept suggestion is counted once');
  // nothing but names, labels, outcomes and counts ever leaves the page
  for(const e of c.events) for(const k of Object.keys(e)) assert.ok(['name','label','outcome','count'].includes(k),'unexpected field '+k);
  assert.ok(!J(c.events).includes('bigger map'),'block text is never sent');
  assert.deepEqual(a.errs,[]);
});

test('analytics page: dismissing suggestions, asking, grilling and choosing a domain are counted',async()=>{
  const c = cloud(), a = page(c); await sleep(600);
  await a.drop('question','Would a bigger map horizontally solve traversal issues?',2200);
  a.click(a.$('#dismissAll')); await sleep(200);
  assert.ok(c.events.some(e=>e.name==='block_dismissed' && e.count>0));
  a.click(a.$('#askBtn')); a.type(a.$('#aQ'),'What is causing the boredom?'); a.click(a.$('#aGo')); await sleep(1500);
  assert.ok(c.events.some(e=>e.name==='ask'));
  a.click(a.byText('Why does traversal feel slow').querySelector('[data-act=grill]')); await sleep(300);
  assert.ok(c.events.some(e=>e.name==='grill'),'starting a grill is counted');
  a.click(a.$('#setBtn')); a.click(a.$('.stabs [data-tab=goal]')); a.type(a.$('#gDomain'),'research');
  assert.deepEqual(c.events.filter(e=>e.name==='domain_set'),[{ name:'domain_set', label:'research' }]);
});

test('analytics page: the switch in Settings turns it off, and it is only offered where something is counted',async()=>{
  const c = cloud(), a = page(c); await sleep(600);
  a.click(a.$('#setBtn')); a.click(a.$('.stabs [data-tab=data]'));
  assert.equal(a.$('#dStats').hidden,false); assert.equal(a.$('#dStatsOn').checked,true);
  a.$('#dStatsOn').checked = false; a.$('#dStatsOn').dispatchEvent(new a.w.Event('change',{ bubbles:true }));
  assert.equal(a.w.localStorage.getItem('cascade-analytics-off'),'1');
  a.escape(); await a.drop('question','Would a bigger map help?',800);
  assert.equal(c.events.length,0,'nothing is sent once it is off');
  const quiet = cloud({ analytics:false }), b = page(quiet); await sleep(600);
  b.click(b.$('#setBtn')); b.click(b.$('.stabs [data-tab=data]'));
  assert.equal(b.$('#dStats').hidden,true,'no switch when nothing is being counted');
  b.escape(); await b.drop('question','Would a bigger map help?',800);
  assert.equal(quiet.events.length,0);
});

test('analytics page: Do Not Track, the static web build and the local app send nothing',async()=>{
  const c = cloud(), a = page(c,{}); await sleep(300);
  a.w.eval("Object.defineProperty(navigator,'doNotTrack',{ value:'1', configurable:true })");
  await a.drop('question','Would a bigger map help?',800);
  assert.equal(c.events.length,0,'Do Not Track is honoured');
  const calls = []; const staticWeb = open({ html:webHtml(), url:'https://someone.github.io/cascade/', local:GAME, fetchImpl:async(u)=>{ calls.push(String(u)); return { ok:false, status:404, headers:{ get:()=>'text/html' }, json:async()=>({}) }; } }); await sleep(500);
  await staticWeb.drop('question','Would a bigger map help?',800);
  assert.ok(!calls.includes('/api/event'),'the static build has no counting endpoint and never calls one');
  const local = open({ claude:{ use:async()=>null } }); await sleep(300);
  assert.equal(local.w.eval('ANALYTICS.on'),false);
});
