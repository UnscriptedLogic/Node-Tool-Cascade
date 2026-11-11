'use strict';
// The local admin dashboard: how the numbers are shaped, and a server that keeps the Cloudflare token to itself.
const test = require('node:test'), assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { shape, lastDays, queries } = require('../scripts/admin/stats');
const { demoStats } = require('../scripts/admin/demo');

const NOW = Date.UTC(2026,10,11,12,0,0);   // 2026-11-11
const ROWS = {
  visitsByDay:[{ day:'2026-11-09', visits:'120', visitors:'80' },{ day:'2026-11-11 00:00:00', visits:50, visitors:'31' },{ day:'2025-01-01', visits:999, visitors:999 }],
  blocksByDay:[{ day:'2026-11-10', event:'block_created', n:'40' },{ day:'2026-11-10', event:'block_approved', n:'30' },{ day:'2026-11-10', event:'block_dismissed', n:'10' },{ day:'2026-11-11', event:'block_created', n:5 }],
  blocksByType:[{ event:'block_created', type:'question', n:30 },{ event:'block_approved', type:'answer', n:20 },{ event:'block_created', type:'answer', n:15 },{ event:'block_dismissed', type:'fog', n:2 }],
  ai:[{ provider:'anthropic', calls:'60', errors:'3', users:'4', avg_ms:'1234.6' },{ provider:'openai', calls:40, errors:0, users:2, avg_ms:900 }],
  keys:[{ provider:'anthropic', users:5 }],
  signins:[{ kind:'new', signins:3, people:3 },{ kind:'returning', signins:7, people:4 }],
  features:[{ event:'ask', label:'', outcome:'', times:9 },{ event:'grow', label:'bridge', outcome:'', times:4 },{ event:'bridge_result', label:'', outcome:'gap', times:2 },{ event:'domain_set', label:'research', outcome:'', times:6 }],
  countries:[{ country:'US', visits:100 },{ country:'', visits:5 },{ country:'GB', visits:20 }],
  activeUsers:[{ users:'6' }]
};

test('admin stats: the last N days are filled in oldest first, with gaps as zeros and stray days ignored',()=>{
  assert.deepEqual(lastDays(3,NOW),['2026-11-09','2026-11-10','2026-11-11']);
  const s = shape(ROWS,{ env:'prod', days:4, now:NOW });
  assert.deepEqual(s.dates,['2026-11-08','2026-11-09','2026-11-10','2026-11-11']);
  assert.deepEqual(s.series.visits,[0,120,0,50]); assert.deepEqual(s.series.visitors,[0,80,0,31]);
  assert.deepEqual(s.series.created,[0,0,40,5]); assert.deepEqual(s.series.approved,[0,0,30,0]); assert.deepEqual(s.series.dismissed,[0,0,10,0]);
});

test('admin stats: totals, rates, labels and ordering',()=>{
  const s = shape(ROWS,{ env:'prod', days:4, now:NOW }), t = s.totals;
  assert.equal(t.visits,170); assert.equal(t.visitors,111); assert.equal(t.created,45); assert.equal(t.approved,30); assert.equal(t.dismissed,10);
  assert.equal(t.keptRate,0.75); assert.equal(t.aiCalls,100); assert.equal(t.aiErrors,3); assert.equal(t.aiErrorRate,0.03);
  assert.equal(t.activeUsers,6); assert.equal(t.signins,10); assert.equal(t.newSignins,3);
  assert.deepEqual(s.ai.map(a=>[a.label,a.calls,a.errors,a.users,a.avgMs]),[['Claude (Anthropic)',60,3,4,1235],['OpenAI (GPT / ChatGPT models)',40,0,2,900]]);
  assert.deepEqual(s.blocksByType.map(b=>b.type),['answer','question','fog'],'busiest type first');
  assert.deepEqual(s.blocksByType.find(b=>b.type==='answer'),{ type:'answer', created:15, approved:20, dismissed:0 });
  assert.deepEqual(s.features.map(f=>f.label),['Ask the graph','Domain: research','Bridge to a feeling','Bridge: gap found, grill started']);
  assert.deepEqual(s.countries,[{ country:'US', visits:100 },{ country:'GB', visits:20 }],'rows without a country are dropped');
  assert.deepEqual(s.keys,[{ provider:'anthropic', label:'Claude (Anthropic)', users:5 }]);
});

test('admin stats: an empty dataset gives zeros and no rates instead of errors',()=>{
  const s = shape({},{ env:'dev', days:7, now:NOW });
  assert.equal(s.dates.length,7); assert.equal(s.totals.visits,0); assert.equal(s.totals.keptRate,null); assert.equal(s.totals.aiErrorRate,null);
  assert.deepEqual([s.ai,s.features,s.countries,s.blocksByType],[[],[],[],[]]);
});

test('admin stats: queries target the right dataset and window, and only read',()=>{
  const prod = queries('prod',30), dev = queries('dev',7);
  for(const q of Object.values(prod)){ assert.match(q,/FROM cascade_events WHERE|FROM cascade_events\b/); assert.match(q,/INTERVAL '30' DAY/); assert.match(q,/^SELECT /); }
  for(const q of Object.values(dev)) assert.match(q,/cascade_events_dev/);
});

test('admin demo: made-up numbers have the same shape as real ones and cover every chart',()=>{
  const d = demoStats({ env:'prod', days:30, now:NOW }), real = shape(ROWS,{ days:30, now:NOW });
  assert.deepEqual(Object.keys(d).filter(k=>k!=='demo').sort(),Object.keys(real).sort());
  assert.deepEqual(Object.keys(d.totals).sort(),Object.keys(real.totals).sort());
  assert.equal(d.dates.length,30); assert.ok(d.series.visits.every(v=>v>0)); assert.ok(d.ai.length>=3 && d.features.length>5 && d.countries.length>5 && d.blocksByType.length===6);
  assert.ok(demoStats({ env:'dev', days:7, now:NOW }).totals.visits < demoStats({ env:'prod', days:7, now:NOW }).totals.visits,'dev is quieter than production');
});

/* ------------------------------ the server ------------------------------ */
const TOKEN = 'test-token-0123456789-abcdef', ACCOUNT = 'e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1';
function mockCloudflare(){
  const seen = [];
  const srv = http.createServer((req,res)=>{
    let body = ''; req.on('data',c=>body += c); req.on('end',()=>{
      seen.push({ url:req.url, auth:req.headers.authorization, sql:body });
      if(req.headers.authorization!=='Bearer '+TOKEN){ res.writeHead(403,{ 'content-type':'application/json' }); return res.end(JSON.stringify({ success:false, errors:[{ message:'Authentication failed' }] })); }
      const pick = (re) => { for(const [k,v] of Object.entries({ visitsByDay:/toDate\(timestamp\) AS day, SUM\(_sample_interval\) AS visits/, blocksByDay:/AS day, blob1 AS event/, ai:/AS avg_ms/, countries:/AS country/, activeUsers:/blob6='1'/ })) if(v.test(body)) return k; return ''; };
      const k = pick(); const data = { visitsByDay:[{ day:new Date().toISOString().slice(0,10), visits:'7', visitors:'5' }], ai:[{ provider:'anthropic', calls:3, errors:0, users:1, avg_ms:800 }], countries:[{ country:'SG', visits:7 }], activeUsers:[{ users:1 }] }[k] || [];
      res.writeHead(200,{ 'content-type':'application/json' }); res.end(JSON.stringify({ success:true, data }));
    });
  });
  return new Promise(ok=>srv.listen(0,'127.0.0.1',()=>ok({ srv, seen, base:`http://127.0.0.1:${srv.address().port}` })));
}
async function startAdmin(t,{ env = {}, args = [] } = {}){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'cascade-admin-')), port = 4400 + Math.floor(Math.random()*500);
  const p = spawn(process.execPath,[path.join(__dirname,'..','scripts','admin','server.js'),'--port',String(port),...args],{ env:{ ...process.env, NO_OPEN:'1', CLOUDFLARE_ACCOUNT_ID:'', CLOUDFLARE_API_TOKEN:'', ...env }, stdio:['ignore','pipe','pipe'] });
  let out = ''; p.stdout.on('data',d=>out += d); p.stderr.on('data',d=>out += d);
  for(let i=0;i<60 && !/Only this computer/.test(out);i++) await new Promise(r=>setTimeout(r,50));
  t.after(()=>{ p.kill(); try{ fs.rmSync(dir,{ recursive:true, force:true }); }catch(e){} });
  const base = `http://localhost:${port}`, get = async (u,o) => { const r = await fetch(base+u,o); const text = await r.text(); let j = null; try{ j = JSON.parse(text); }catch(e){} return { status:r.status, json:j, text }; };
  return { base, get, port, out:()=>out };
}

test('admin server: reads with the token from the environment, never sends the token to the page, and caches briefly',async(t)=>{
  const cf = await mockCloudflare(); t.after(()=>cf.srv.close());
  const a = await startAdmin(t,{ env:{ CLOUDFLARE_ACCOUNT_ID:ACCOUNT, CLOUDFLARE_API_TOKEN:TOKEN, CF_API_BASE:cf.base } });
  const st = await a.get('/api/status'); assert.deepEqual([st.json.hasCredentials,st.json.source,st.json.demo],[true,'environment',false]);
  assert.ok(!st.text.includes(TOKEN),'status never carries the token');
  const r = await a.get('/api/stats?env=prod&days=7');
  assert.equal(r.status,200); assert.equal(r.json.totals.visits,7); assert.equal(r.json.ai[0].label,'Claude (Anthropic)'); assert.equal(r.json.countries[0].country,'SG');
  assert.ok(!r.text.includes(TOKEN),'stats never carry the token');
  assert.ok(cf.seen.length>=9 && cf.seen.every(c=>c.auth==='Bearer '+TOKEN && c.url===`/accounts/${ACCOUNT}/analytics_engine/sql`),'every query went to this account with the token');
  assert.ok(cf.seen.every(c=>/FORMAT JSON$/.test(c.sql) && /cascade_events\b/.test(c.sql)));
  const n = cf.seen.length; await a.get('/api/stats?env=prod&days=7'); assert.equal(cf.seen.length,n,'a second request within a minute is served from memory');
  await a.get('/api/stats?env=dev&days=7'); assert.ok(cf.seen.slice(n).every(c=>/cascade_events_dev/.test(c.sql)),'dev reads the dev dataset');
  assert.ok(!a.out().includes(TOKEN),'the token is not logged');
});

test('admin server: without a token it asks for one, takes it from the page, and a wrong token is explained',async(t)=>{
  const cf = await mockCloudflare(); t.after(()=>cf.srv.close());
  const a = await startAdmin(t,{ env:{ CF_API_BASE:cf.base } });
  assert.equal((await a.get('/api/status')).json.hasCredentials,false);
  const none = await a.get('/api/stats'); assert.equal(none.status,401); assert.equal(none.json.error,'no_credentials');
  const post = (b) => a.get('/api/credentials',{ method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(b) });
  assert.equal((await post({ account:'nope', token:TOKEN })).status,400); assert.equal((await post({ account:ACCOUNT, token:'short' })).status,400);
  assert.equal((await a.get('/api/credentials',{ method:'POST', headers:{ 'content-type':'text/plain' }, body:'{}' })).status,415);
  assert.equal((await post({ account:ACCOUNT, token:'wrong-token-0123456789-abcdef' })).status,200);
  const bad = await a.get('/api/stats'); assert.equal(bad.status,401); assert.equal(bad.json.error,'bad_credentials'); assert.match(bad.json.detail,/Account Analytics/);
  assert.ok(!bad.text.includes('wrong-token'));
  await post({ account:ACCOUNT, token:TOKEN });
  assert.equal((await a.get('/api/stats')).status,200); assert.equal((await a.get('/api/status')).json.source,'page');
});

test('admin server: demo mode needs no token, and only this computer may talk to it',async(t)=>{
  const a = await startAdmin(t,{ args:['--demo'] });
  const st = await a.get('/api/status'); assert.deepEqual([st.json.demo,st.json.hasCredentials],[true,true]);
  const s = await a.get('/api/stats?days=30'); assert.equal(s.status,200); assert.equal(s.json.demo,true); assert.equal(s.json.dates.length,30);
  const page = await a.get('/'); assert.equal(page.status,200); assert.match(page.text,/<title>Cascade admin<\/title>/);
  // another site, or a rebinding trick, cannot read it from a browser
  assert.equal((await a.get('/api/stats',{ headers:{ origin:'https://evil.example' } })).status,403);
  const rebound = await new Promise(ok=>{ http.get({ host:'127.0.0.1', port:a.port, path:'/api/stats', headers:{ host:'evil.example' } },res=>{ res.resume(); ok(res.statusCode); }); });
  assert.equal(rebound,403);
  assert.equal((await a.get('/nothing')).status,404);
});
