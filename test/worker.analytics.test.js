'use strict';
// Anonymous usage counts: only listed events and labels are recorded, nothing identifying is stored, and opting out is honoured.
const test = require('node:test'), assert = require('node:assert/strict');
const { hasSqlite } = require('./helpers/d1');
const { setup, tree } = require('./helpers/worker');
const skip = !hasSqlite() && 'node:sqlite needs Node 22.5 or newer';

function withAnalytics(w,envName = 'prod'){
  const points = [];
  w.env.ANALYTICS = { writeDataPoint:(p) => points.push(p) }; w.env.ENV_NAME = envName;
  return points;
}
const names = (points) => points.map(p=>p.blobs[0]);
const sse = (events) => new Response(new ReadableStream({ start(c){ for(const e of events) c.enqueue(new TextEncoder().encode('data: '+JSON.stringify(e)+'\n\n')); c.close(); } }),{ status:200 });
async function withProvider(handler,fn){ const real = globalThis.fetch; globalThis.fetch = async (u,o) => handler(String(u),o); try{ return await fn(); } finally{ globalThis.fetch = real; } }
const event = (w,body,cookie,headers) => w.call('POST','/api/event',{ cookie, body, headers });

test('analytics: nothing is recorded when no dataset is bound, and the config says so',{ skip },async()=>{
  const w = await setup();
  assert.equal((await w.call('GET','/api/config')).json.analytics,false);
  assert.equal((await event(w,{ name:'ask' })).status,204);
});

test('analytics: a page load is a visit, tagged with the environment and country, and carries no address or browser',{ skip },async()=>{
  const w = await setup(), points = withAnalytics(w,'dev');
  assert.equal((await w.call('GET','/api/config',{ headers:{ 'cf-connecting-ip':'203.0.113.7', 'user-agent':'TestBrowser/1.0' } })).json.analytics,true);
  assert.equal(points.length,1);
  const p = points[0]; assert.deepEqual(p.blobs.slice(0,4),['visit','dev','','']); assert.equal(p.blobs[5],'0');
  assert.match(p.indexes[0],/^[0-9a-f]{32}$/);
  const all = JSON.stringify(p); assert.ok(!all.includes('203.0.113.7') && !all.includes('TestBrowser'),'the address and browser only go into the hash');
});

test('analytics: the visitor hash is stable within a day, differs between people, and changes tomorrow',{ skip },async()=>{
  const w = await setup(), points = withAnalytics(w);
  const visit = (ip,ua) => w.call('GET','/api/config',{ headers:{ 'cf-connecting-ip':ip, 'user-agent':ua } });
  await visit('1.1.1.1','A'); await visit('1.1.1.1','A'); await visit('2.2.2.2','A'); await visit('1.1.1.1','B');
  assert.equal(points[0].indexes[0],points[1].indexes[0],'same person, same day'); assert.notEqual(points[0].indexes[0],points[2].indexes[0]); assert.notEqual(points[0].indexes[0],points[3].indexes[0]);
  w.tick(86400e3); await visit('1.1.1.1','A');
  assert.notEqual(points[0].indexes[0],points[4].indexes[0],'a new day is a new hash');
});

test('analytics: people who send Do Not Track or Global Privacy Control are not measured',{ skip },async()=>{
  const w = await setup(), points = withAnalytics(w);
  await w.call('GET','/api/config',{ headers:{ dnt:'1' } }); await w.call('GET','/api/config',{ headers:{ 'sec-gpc':'1' } });
  await event(w,{ name:'block_created', label:'question' },undefined,{ dnt:'1' });
  assert.equal(points.length,0);
  await w.call('GET','/api/config'); assert.equal(points.length,1);
});

test('analytics: the page can only report listed events with listed labels, and extra fields are ignored',{ skip },async()=>{
  const w = await setup(), points = withAnalytics(w);
  const sendAll = [
    { name:'block_created', label:'question' }, { name:'block_approved', label:'answer', count:3 }, { name:'block_dismissed', label:'fog', count:2 },
    { name:'grow', label:'bridge' }, { name:'bridge_result', outcome:'gap' }, { name:'ask' }, { name:'grill' }, { name:'domain_set', label:'research' }
  ];
  for(const e of sendAll) assert.equal((await event(w,e)).status,204);
  assert.deepEqual(names(points),sendAll.map(e=>e.name));
  const approved = points.find(p=>p.blobs[0]==='block_approved'); assert.deepEqual([approved.blobs[2],approved.doubles[0]],['answer',3]);
  // rejected: server-only events, unknown names, labels off the list, junk
  const before = points.length;
  for(const bad of [{ name:'visit' },{ name:'signin', outcome:'new' },{ name:'ai_call', label:'openai', outcome:'ok' },{ name:'made_up' },{ name:'block_created', label:'Why does my secret project fail?' },{ name:'block_created' },{ name:'grow', label:'sideways' },{ name:'bridge_result', outcome:'maybe' },null,'text'])
    assert.equal((await event(w,bad)).status,204,'always 204, never an error to the page');
  assert.equal(points.length,before,'nothing off the lists was recorded');
  // content smuggled in extra fields never reaches the data point
  await event(w,{ name:'ask', question:'secret plans', text:'more secrets', label:'secret', props:{ a:'b' } });
  assert.ok(!JSON.stringify(points[points.length-1]).includes('secret'));
  // counts are bounded
  await event(w,{ name:'block_approved', label:'answer', count:100000 }); assert.equal(points[points.length-1].doubles[0],99);
});

test('analytics: the server records sign-ins (new or returning), library saves and account deletion',{ skip },async()=>{
  const w = await setup(), points = withAnalytics(w);
  const first = await w.signIn(); w.tick(5000); await w.signIn();
  assert.deepEqual(points.filter(p=>p.blobs[0]==='signin').map(p=>[p.blobs[3],p.blobs[5]]),[['new','1'],['returning','1']]);
  const cookie = first.cookie;
  await w.call('POST','/api/folders',{ cookie, body:{ name:'Private folder name' } });
  await w.call('POST','/api/cascades',{ cookie, body:{ name:'Private cascade name', data:{ tree:tree() } } });
  assert.deepEqual(names(points).slice(-2),['folder_created','cascade_created']);
  assert.ok(!JSON.stringify(points).includes('Private'),'names of folders and Cascades are never recorded');
  await w.call('DELETE','/api/auth/account',{ cookie });
  assert.equal(names(points).pop(),'account_deleted');
});

test('analytics: AI calls count by provider with outcome and time, and saved keys count without the key',{ skip },async()=>{
  const w = await setup(), points = withAnalytics(w);
  const { cookie } = await w.signIn();
  await w.call('POST','/api/settings',{ cookie, body:{ active:'anthropic', providers:{ anthropic:{ key:'sk-ant-VERYSECRET', model:'m' } } } });
  const saved = points.filter(p=>p.blobs[0]==='ai_key_saved'); assert.deepEqual(saved.map(p=>p.blobs[2]),['anthropic']);
  const { handleRequest } = await import('../worker/src/index.js');
  const ask = () => handleRequest(new Request('https://cascade.example/api/sample',{ method:'POST', headers:{ 'content-type':'application/json', cookie }, body:JSON.stringify({ prompt:'Say hi: my private idea' }) }),w.env,w.deps);
  await withProvider(()=>sse([{ type:'content_block_delta', delta:{ type:'text_delta', text:'Hi' } }]),async()=>{ const r = await ask(); await r.text(); });
  await new Promise(r=>setTimeout(r,20));
  await withProvider(()=>new Response(JSON.stringify({ error:{ message:'bad key' } }),{ status:401 }),async()=>{ await ask(); });
  const calls = points.filter(p=>p.blobs[0]==='ai_call');
  assert.deepEqual(calls.map(p=>[p.blobs[2],p.blobs[3]]),[['anthropic','ok'],['anthropic','error']]);
  assert.ok(calls.every(p=>Number.isFinite(p.doubles[1])));
  const all = JSON.stringify(points); assert.ok(!all.includes('VERYSECRET') && !all.includes('private idea'),'neither the key nor the prompt is recorded');
});

test('analytics: the page-view beacon is added to the page only when configured, and never for opted-out visitors',{ skip },async()=>{
  const { withBeacon } = await import('../worker/src/analytics.js');
  const html = () => new Response('<body></body>',{ headers:{ 'content-type':'text/html; charset=utf-8' } });
  const req = (h = {}) => new Request('https://cascade.example/',{ headers:h });
  const real = globalThis.HTMLRewriter; let appended = '';
  globalThis.HTMLRewriter = class { on(sel,h){ this.h = h; return this; } transform(r){ this.h.element({ append:(s)=>{ appended = s; } }); return r; } };
  try{
    withBeacon(html(),req(),{ CF_BEACON_TOKEN:'tok123' });
    assert.match(appended,/cloudflareinsights\.com\/beacon\.min\.js/); assert.match(appended,/tok123/);
    appended = ''; withBeacon(html(),req(),{}); assert.equal(appended,'','no token, no beacon');
    withBeacon(html(),req({ dnt:'1' }),{ CF_BEACON_TOKEN:'tok123' }); assert.equal(appended,'','Do Not Track is honoured');
    withBeacon(new Response('{}',{ headers:{ 'content-type':'application/json' } }),req(),{ CF_BEACON_TOKEN:'tok123' }); assert.equal(appended,'','only pages get it');
  } finally { globalThis.HTMLRewriter = real; }
});
