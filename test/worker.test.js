'use strict';
// The Cloudflare Worker: Google sign-in, sessions and the library, run against a real SQLite database standing in for D1.
const test = require('node:test'), assert = require('node:assert/strict');
const { hasSqlite } = require('./helpers/d1');
const skip = !hasSqlite() && 'node:sqlite needs Node 22.5 or newer';

const { CLIENT, ORIGIN, tree, signer, setup } = require('./helpers/worker');

test('worker: config exposes only the public Google client id',{ skip },async()=>{
  const w = await setup(); const r = await w.call('GET','/api/config');
  assert.deepEqual(r.json,{ cloud:true, analytics:false, googleClientId:CLIENT });
});

test('worker: the library needs a signed-in session',{ skip },async()=>{
  const w = await setup();
  for(const [m,p] of [['GET','/api/library'],['POST','/api/folders'],['GET','/api/cascades/x']]) assert.equal((await w.call(m,p,{ body:m==='POST' ? { name:'x' } : undefined })).status,401,m+' '+p);
  assert.deepEqual((await w.call('GET','/api/auth/me')).json,{ user:null });
});

test('worker: Google tokens are accepted only when signed by Google, for this app, unexpired and verified',{ skip },async()=>{
  const w = await setup(), other = await signer();   // same key id, different private key
  const post = async (credential) => (await w.call('POST','/api/auth/google',{ body:{ credential } })).status;
  assert.equal(await post(await w.good.sign(w.claims())),200);
  assert.equal(await post(await other.sign(w.claims())),401,'forged signature');
  assert.equal(await post(await w.good.sign(w.claims({ aud:'someone-else' }))),401,'wrong audience');
  assert.equal(await post(await w.good.sign(w.claims({ iss:'https://evil.example' }))),401,'wrong issuer');
  assert.equal(await post(await w.good.sign(w.claims({ exp:1 }))),401,'expired');
  assert.equal(await post(await w.good.sign(w.claims({ email_verified:false }))),401,'unverified email');
  assert.equal(await post(await w.good.sign(w.claims(),{ kid:'unknown' })),401,'unknown key');
  assert.equal(await post(await w.good.sign(w.claims(),{ alg:'none' })),401,'wrong algorithm');
  assert.equal(await post('garbage'),401);
});

test('worker: sign in, save a Cascade in a folder, sign out, and the session stops working',{ skip },async()=>{
  const w = await setup();
  const si = await w.signIn(); assert.equal(si.status,200); assert.equal(si.json.user.email,'ada@example.com');
  assert.match(si.cookie,/^cascade_session=/);
  const cookie = si.cookie;
  const sessionRows = w.db.raw.prepare('SELECT token_hash FROM sessions').all();
  assert.equal(sessionRows.length,1); assert.ok(!cookie.includes(sessionRows[0].token_hash),'only a hash of the token is stored');
  assert.equal((await w.call('GET','/api/auth/me',{ cookie })).json.user.name,'Ada');

  const f = await w.call('POST','/api/folders',{ cookie, body:{ name:'Q3 plans' } }); assert.equal(f.status,201);
  const c = await w.call('POST','/api/cascades',{ cookie, body:{ name:'Roadmap', folderId:f.json.id, data:{ tree:tree(), view:{ x:0, y:0, z:1 }, prefs:{ domain:'product' } } } });
  assert.equal(c.status,201); assert.equal(c.json.domain,'product');
  const lib = await w.call('GET','/api/library',{ cookie }); assert.equal(lib.json.cascades[0].name,'Roadmap'); assert.equal(lib.json.folders[0].name,'Q3 plans');
  assert.match((await w.call('GET','/api/cascades/'+c.json.id,{ cookie })).json.data.tree,/Root/);
  const put = await w.call('PUT','/api/cascades/'+c.json.id,{ cookie, body:{ name:'Roadmap v2', data:{ tree:tree(), prefs:{ domain:'product', goal:'Ship' } } } });
  assert.equal(put.status,200); assert.equal(put.json.name,'Roadmap v2');

  const out = await w.call('POST','/api/auth/logout',{ cookie, body:{} }); assert.equal(out.status,200);
  assert.equal((await w.call('GET','/api/library',{ cookie })).status,401);
});

test('worker: sessions expire after thirty days',{ skip },async()=>{
  const w = await setup(); const { cookie } = await w.signIn();
  assert.equal((await w.call('GET','/api/library',{ cookie })).status,200);
  w.tick(31*86400e3);
  assert.equal((await w.call('GET','/api/library',{ cookie })).status,401);
});

test('worker: one account can never see, change or delete another account’s Cascades',{ skip },async()=>{
  const w = await setup();
  const a = await w.signIn({ sub:'g-a', email:'a@example.com' }), b = await w.signIn({ sub:'g-b', email:'b@example.com' });
  const mine = await w.call('POST','/api/cascades',{ cookie:a.cookie, body:{ name:'Secret', data:{ tree:tree() } } });
  const folder = await w.call('POST','/api/folders',{ cookie:a.cookie, body:{ name:'Mine' } }); assert.equal(folder.status,201,JSON.stringify(folder.json));
  assert.equal((await w.call('GET','/api/library',{ cookie:b.cookie })).json.cascades.length,0);
  assert.equal((await w.call('GET','/api/cascades/'+mine.json.id,{ cookie:b.cookie })).status,404);
  assert.equal((await w.call('PUT','/api/cascades/'+mine.json.id,{ cookie:b.cookie, body:{ name:'Hacked' } })).status,404);
  assert.equal((await w.call('DELETE','/api/cascades/'+mine.json.id,{ cookie:b.cookie })).status,404);
  assert.equal((await w.call('DELETE','/api/folders/'+folder.json.id,{ cookie:b.cookie })).status,404);
  assert.equal((await w.call('POST','/api/cascades',{ cookie:b.cookie, body:{ name:'x', folderId:folder.json.id, data:{ tree:tree() } } })).status,404,'cannot file a Cascade in someone else’s folder');
  assert.equal((await w.call('GET','/api/cascades/'+mine.json.id,{ cookie:a.cookie })).json.name,'Secret');
});

test('worker: deleting a folder removes its Cascades; deleting the account removes everything',{ skip },async()=>{
  const w = await setup(); const { cookie } = await w.signIn();
  const f = (await w.call('POST','/api/folders',{ cookie, body:{ name:'F' } })).json;
  await w.call('POST','/api/cascades',{ cookie, body:{ name:'In', folderId:f.id, data:{ tree:tree() } } });
  await w.call('POST','/api/cascades',{ cookie, body:{ name:'Out', data:{ tree:tree() } } });
  assert.equal((await w.call('DELETE','/api/folders/'+f.id,{ cookie })).status,200);
  assert.deepEqual((await w.call('GET','/api/library',{ cookie })).json.cascades.map(c=>c.name),['Out']);
  assert.equal((await w.call('DELETE','/api/auth/account',{ cookie })).status,200);
  for(const t of ['users','sessions','folders','cascades']) assert.equal(w.db.raw.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n,0,t);
});

test('worker: cross-site and non-JSON writes are refused, and other paths are served as static files',{ skip },async()=>{
  const w = await setup(); const { cookie } = await w.signIn();
  assert.equal((await w.call('POST','/api/folders',{ cookie, body:{ name:'x' }, headers:{ origin:'https://evil.example' } })).status,403);
  assert.equal((await w.call('POST','/api/folders',{ cookie, body:{ name:'x' }, headers:{ 'content-type':'text/plain' } })).status,415);
  assert.equal((await w.call('POST','/api/folders',{ cookie, body:{ name:'x' }, headers:{ origin:ORIGIN } })).status,201);
  assert.equal((await w.call('GET','/index.html')).text,'static:/index.html');
  assert.equal((await w.call('GET','/api/nothing',{ cookie })).status,404);
});
