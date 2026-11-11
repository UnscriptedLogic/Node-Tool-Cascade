'use strict';
// The admin dashboard online: only allowlisted Google accounts see numbers, the read token stays on the server, and the page states.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { hasSqlite } = require('./helpers/d1');
const { setup } = require('./helpers/worker');
const { open, sleep } = require('./helpers/dom');
const skip = !hasSqlite() && 'node:sqlite needs Node 22.5 or newer';

const TOKEN = 'cf-read-token-0123456789-abcdef', ACCOUNT = 'e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1';
const configure = (w,extra = {}) => Object.assign(w.env,{ ADMIN_EMAILS:' Owner@Example.com , other@example.com ', CF_ACCOUNT_ID:ACCOUNT, ANALYTICS_READ_TOKEN:TOKEN },extra);
// a stand-in for Cloudflare's SQL API
function cf(seen,now = () => Date.now()){
  return async (url,o = {}) => {
    seen.push({ url:String(url), auth:o.headers && o.headers.authorization, sql:String(o.body || '') });
    if(!(o.headers && o.headers.authorization==='Bearer '+TOKEN)) return new Response(JSON.stringify({ success:false, errors:[{ message:'Authentication failed' }] }),{ status:403 });
    const sql = String(o.body), data = /blob1='visit' AND/.test(sql) && /AS visitors/.test(sql) ? [{ day:new Date(now()).toISOString().slice(0,10), visits:'9', visitors:'6' }] : /AS country/.test(sql) ? [{ country:'SG', visits:9 }] : [];
    return new Response(JSON.stringify({ success:true, data }),{ status:200 });
  };
}
async function admin(w,email){ const s = await w.signIn({ sub:'g-'+email, email }); return s.cookie; }

test('admin online: the page comes from the static assets, marked noindex',{ skip },async()=>{
  const w = await setup(); const { clearAdminCache } = await import('../worker/src/admin.js'); clearAdminCache();
  for(const p of ['/admin','/admin/']){ const r = await w.call('GET',p); assert.equal(r.text,'static:/admin.html'); }
  const { handleRequest } = await import('../worker/src/index.js');
  const res = await handleRequest(new Request('https://cascade.example/admin'),w.env,w.deps); assert.match(res.headers.get('x-robots-tag'),/noindex/); assert.equal(res.headers.get('cache-control'),'no-store');
});

test('admin online: status says who is looking and whether the server is set up, without secrets',{ skip },async()=>{
  const w = await setup();
  let s = (await w.call('GET','/api/admin/status')).json; assert.deepEqual([s.online,s.configured,s.signedIn,s.allowed],[true,false,false,false]); assert.deepEqual(s.missing,['ADMIN_EMAILS','CF_ACCOUNT_ID','ANALYTICS_READ_TOKEN']);
  configure(w);
  s = (await w.call('GET','/api/admin/status')).json; assert.deepEqual([s.configured,s.signedIn,s.allowed],[true,false,false]); assert.ok(s.googleClientId);
  const owner = await admin(w,'owner@example.com'), other = await admin(w,'stranger@example.com');
  const so = (await w.call('GET','/api/admin/status',{ cookie:owner })).json, sx = (await w.call('GET','/api/admin/status',{ cookie:other })).json;
  assert.deepEqual([so.signedIn,so.allowed,so.email],[true,true,'owner@example.com'],'case and spaces in the list do not matter'); assert.deepEqual([sx.signedIn,sx.allowed],[true,false]);
  assert.ok(!JSON.stringify([so,sx,s]).includes(TOKEN) && !JSON.stringify(so).includes(ACCOUNT),'no secret in a status');
});

test('admin online: numbers need a sign-in, an allowlisted account, and a configured server',{ skip },async()=>{
  const w = await setup(), seen = []; w.deps.cfFetch = cf(seen,w.deps.now); const { clearAdminCache } = await import('../worker/src/admin.js'); clearAdminCache();
  configure(w);
  assert.equal((await w.call('GET','/api/admin/stats')).status,401);
  const other = await admin(w,'stranger@example.com'); const no = await w.call('GET','/api/admin/stats',{ cookie:other });
  assert.equal(no.status,403); assert.match(no.json.detail,/not on the admin list/); assert.equal(seen.length,0,'a stranger never causes a read');
  const owner = await admin(w,'owner@example.com');
  const ok = await w.call('GET','/api/admin/stats?env=prod&days=7',{ cookie:owner });
  assert.equal(ok.status,200); assert.equal(ok.json.totals.visits,9); assert.equal(ok.json.countries[0].country,'SG'); assert.equal(ok.json.dates.length,7);
  assert.ok(!ok.text.includes(TOKEN) && !ok.text.includes(ACCOUNT),'the read token and account id never leave the server');
  assert.ok(seen.length>=9 && seen.every(c=>c.auth==='Bearer '+TOKEN && c.url===`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/analytics_engine/sql` && /FORMAT JSON$/.test(c.sql)));
  assert.ok(seen.every(c=>/cascade_events\b/.test(c.sql) && !/cascade_events_dev/.test(c.sql)),'prod reads the prod dataset');
  clearAdminCache(); seen.length = 0; await w.call('GET','/api/admin/stats?env=dev&days=30',{ cookie:owner });
  assert.ok(seen.every(c=>/cascade_events_dev/.test(c.sql) && /INTERVAL '30' DAY/.test(c.sql)),'dev and the range are honoured');
  const n = seen.length; await w.call('GET','/api/admin/stats?env=dev&days=30',{ cookie:owner }); assert.equal(seen.length,n,'a repeat within a minute is served from memory');
  // an unconfigured server says what is missing instead of failing oddly
  delete w.env.ANALYTICS_READ_TOKEN; const miss = await w.call('GET','/api/admin/stats',{ cookie:owner });
  assert.equal(miss.status,503); assert.match(miss.json.detail,/ANALYTICS_READ_TOKEN/);
});

test('admin online: a rejected read token is explained; read-only and no list means no one',{ skip },async()=>{
  const w = await setup(); const { clearAdminCache } = await import('../worker/src/admin.js'); clearAdminCache();
  configure(w,{ ANALYTICS_READ_TOKEN:'wrong-token-0123456789-abcdef' }); w.deps.cfFetch = cf([]);
  const owner = await admin(w,'owner@example.com'), bad = await w.call('GET','/api/admin/stats?days=3',{ cookie:owner });
  assert.equal(bad.status,502); assert.match(bad.json.detail,/Account Analytics/); assert.ok(!bad.text.includes('wrong-token'));
  assert.equal((await w.call('POST','/api/admin/stats',{ cookie:owner, body:{} })).status,405,'GET only');
  configure(w,{ ADMIN_EMAILS:'' });
  assert.equal((await w.call('GET','/api/admin/status',{ cookie:owner })).json.allowed,false,'an empty list allows nobody');
});

/* ---------------------- the page, in each state ---------------------- */
const PAGE = fs.readFileSync(path.join(__dirname,'..','scripts','admin','index.html'),'utf8');
const res = (body,status = 200) => ({ ok:status<400, status, headers:{ get:()=>'application/json' }, json:async()=>body });
function adminPage(status,stats){
  const calls = [];
  const fetchImpl = async (u,o = {}) => { const p = String(u); calls.push((o.method || 'GET')+' '+p);
    if(p==='/api/admin/status') return res(status);
    if(p.startsWith('/api/admin/stats')) return stats ? res(stats) : res({ error:'not_allowed' },403);
    return res({ error:'nope' },404); };
  const a = open({ html:PAGE, url:'https://cascade.example/admin', fetchImpl }); a.calls = calls; return a;
}
test('admin page online: signed out shows Google sign-in, not on the list shows who, set up shows what is missing',{ skip },async()=>{
  const out = adminPage({ online:true, configured:true, missing:[], signedIn:false, allowed:false, email:'', googleClientId:'x.apps.googleusercontent.com' }); await sleep(300);
  assert.equal(out.$('#signin').hidden,false); assert.equal(out.$('#main').hidden,true); assert.equal(out.$('#denied').hidden,true); assert.ok(!out.calls.some(c=>c.includes('/stats')),'no numbers requested');
  const no = adminPage({ online:true, configured:true, missing:[], signedIn:true, allowed:false, email:'stranger@example.com', googleClientId:'x' }); await sleep(300);
  assert.equal(no.$('#denied').hidden,false); assert.match(no.$('#deniedMsg').textContent,/stranger@example.com is not on the admin list/); assert.ok(!no.calls.some(c=>c.includes('/stats')));
  const un = adminPage({ online:true, configured:false, missing:['CF_ACCOUNT_ID'], signedIn:false, allowed:false, email:'', googleClientId:'' }); await sleep(300);
  assert.equal(un.$('#unconfigured').hidden,false); assert.match(un.$('#unconfMsg').textContent,/CF_ACCOUNT_ID/);
  for(const p of [out,no,un]) assert.deepEqual(p.errs,[]);
});

test('admin page online: an allowed account sees the dashboard, loaded from the online API with a sign-out button',{ skip },async()=>{
  const { shape } = require('../scripts/admin/stats'); const { demoStats } = require('../scripts/admin/demo');
  const a = adminPage({ online:true, configured:true, missing:[], signedIn:true, allowed:true, email:'owner@example.com', googleClientId:'x' },demoStats({ days:7 })); await sleep(500);
  assert.equal(a.$('#main').hidden,false); assert.equal(a.$('#signin').hidden,true); assert.equal(a.$('#denied').hidden,true);
  assert.ok(a.calls.some(c=>/^GET \/api\/admin\/stats\?env=prod&days=7/.test(c))); assert.ok(!a.calls.some(c=>/^GET \/api\/stats/.test(c)),'it does not call the local API');
  assert.equal(a.$('#signout').hidden,false); assert.ok(a.$$('#tiles .tile').length>=5); assert.ok(a.$$('svg').length>=3);
  assert.deepEqual(a.errs,[]);
});
