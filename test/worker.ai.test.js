'use strict';
// AI through the Worker: keys are encrypted at rest and never returned, calls are proxied and streamed, and URLs are checked.
const test = require('node:test'), assert = require('node:assert/strict');
const { hasSqlite } = require('./helpers/d1');
const { setup } = require('./helpers/worker');
const skip = !hasSqlite() && 'node:sqlite needs Node 22.5 or newer';

const KEY = 'sk-ant-supersecret-WXYZ';
const sse = (events) => new Response(new ReadableStream({ start(c){ for(const e of events) c.enqueue(new TextEncoder().encode('data: '+JSON.stringify(e)+'\n\n')); c.close(); } }),{ status:200, headers:{ 'content-type':'text/event-stream' } });
// replace the global fetch (used for provider calls) for one test, recording what was sent
async function withProvider(handler,fn){
  const real = globalThis.fetch, seen = [];
  globalThis.fetch = async (url,o = {}) => { seen.push({ url:String(url), headers:o.headers || {}, body:o.body ? JSON.parse(o.body) : null }); return handler(String(url),o); };
  try{ return await fn(seen); } finally{ globalThis.fetch = real; }
}
const readAll = async (res) => { let t = ''; const r = res.body.getReader(), d = new TextDecoder(); for(;;){ const { done, value } = await r.read(); if(done) break; t += d.decode(value); } return t; };
async function signedIn(w,o){ const s = await w.signIn(o); return s.cookie; }
const save = (w,cookie,patch) => w.call('POST','/api/settings',{ cookie, body:patch });

test('worker ai: every AI route needs a signed-in session',{ skip },async()=>{
  const w = await setup();
  for(const [m,p] of [['GET','/api/settings'],['POST','/api/settings'],['POST','/api/models'],['POST','/api/test'],['POST','/api/sample']]) assert.equal((await w.call(m,p,{ body:m==='POST' ? {} : undefined })).status,401,p);
});

test('worker ai: a new account starts on the demo, with the cloud providers and no ChatGPT sign-in',{ skip },async()=>{
  const w = await setup(), cookie = await signedIn(w);
  const s = (await w.call('GET','/api/settings',{ cookie })).json;
  assert.equal(s.active,'demo'); assert.equal(s.ready,true); assert.equal(s.cloud,true);
  assert.deepEqual(Object.keys(s.providers).sort(),['anthropic','custom','demo','openai','openrouter']);
  assert.equal(s.providers.anthropic.defaultModel,'claude-haiku-5-5'); assert.equal(s.providers.anthropic.ready,false);
});

test('worker ai: a saved key is encrypted in the database, bound to its owner, and never sent back',{ skip },async()=>{
  const w = await setup(), cookie = await signedIn(w);
  const r = await save(w,cookie,{ active:'anthropic', providers:{ anthropic:{ key:KEY, model:'claude-test' } } });
  assert.equal(r.status,200); assert.equal(r.json.active,'anthropic'); assert.equal(r.json.ready,true);
  assert.equal(r.json.providers.anthropic.hint,'••••WXYZ'); assert.equal(r.json.providers.anthropic.hasKey,true);
  for(const t of [r.text,(await w.call('GET','/api/settings',{ cookie })).text]) assert.ok(!t.includes(KEY) && !t.includes('supersecret'),'the key is never in a response');
  const row = w.db.raw.prepare('SELECT * FROM ai_connections').get();
  assert.ok(!JSON.stringify(row).includes('supersecret'),'the database holds ciphertext'); assert.ok(row.key_enc.length>20);
  // the same ciphertext cannot be read as another user's, or another provider's
  const { decryptKey } = await import('../worker/src/ai.js');
  const owner = w.db.raw.prepare('SELECT id FROM users').get().id;
  assert.equal(await decryptKey(w.env,owner,'anthropic',row.key_enc),KEY);
  await assert.rejects(decryptKey(w.env,'someone-else','anthropic',row.key_enc));
  await assert.rejects(decryptKey(w.env,owner,'openai',row.key_enc));
  // removing it
  const gone = await save(w,cookie,{ providers:{ anthropic:{ key:null } } });
  assert.equal(gone.json.providers.anthropic.hasKey,false); assert.equal(gone.json.ready,false);
});

test('worker ai: keys are per account',{ skip },async()=>{
  const w = await setup(), a = await signedIn(w,{ sub:'a', email:'a@example.com' }), b = await signedIn(w,{ sub:'b', email:'b@example.com' });
  await save(w,a,{ active:'anthropic', providers:{ anthropic:{ key:KEY, model:'m' } } });
  const sb = (await w.call('GET','/api/settings',{ cookie:b })).json;
  assert.equal(sb.active,'demo'); assert.equal(sb.providers.anthropic.hasKey,false);
  assert.equal((await w.call('POST','/api/sample',{ cookie:b, body:{ prompt:'hi' } })).status,401,'b has no key to use');
});

test('worker ai: saving keys says so when the server has no encryption secret',{ skip },async()=>{
  const w = await setup(); delete w.env.KEY_SECRET; const cookie = await signedIn(w);
  const r = await save(w,cookie,{ providers:{ openai:{ key:'sk-x' } } });
  assert.equal(r.status,503); assert.match(r.json.detail,/not set up/);
  assert.equal(w.db.raw.prepare('SELECT COUNT(*) n FROM ai_connections').get().n,0);
});

test('worker ai: a sample is proxied with the saved key, streamed back, and the page never carries the key',{ skip },async()=>{
  const w = await setup(), cookie = await signedIn(w);
  await save(w,cookie,{ active:'anthropic', providers:{ anthropic:{ key:KEY, model:'claude-test' } } });
  await withProvider(()=>sse([{ type:'content_block_delta', delta:{ type:'text_delta', text:'Hel' } },{ type:'content_block_delta', delta:{ type:'text_delta', text:'lo' } }]),async(seen)=>{
    const { handleRequest } = await import('../worker/src/index.js');
    const res = await handleRequest(new Request('https://cascade.example/api/sample',{ method:'POST', headers:{ 'content-type':'application/json', cookie }, body:JSON.stringify({ prompt:'Say hello', temperature:0.4 }) }),w.env,w.deps);
    assert.equal(res.status,200); assert.match(res.headers.get('content-type'),/event-stream/);
    const text = await readAll(res);
    assert.deepEqual(text.trim().split('\n\n').map(l=>JSON.parse(l.slice(5)).t),['Hel','lo']);
    assert.equal(seen.length,1); assert.match(seen[0].url,/^https:\/\/api\.anthropic\.com\/v1\/messages/);
    assert.equal(seen[0].headers['x-api-key'],KEY); assert.equal(seen[0].body.model,'claude-test'); assert.equal(seen[0].body.messages[0].content,'Say hello');
  });
});

test('worker ai: provider problems come back as clear statuses',{ skip },async()=>{
  const w = await setup(), cookie = await signedIn(w);
  assert.equal((await w.call('POST','/api/sample',{ cookie, body:{ prompt:'hi' } })).json.error,'not_ready','demo is not served from the server');
  await save(w,cookie,{ active:'openai', providers:{ openai:{ key:'sk-oa', model:'gpt-x' } } });
  await withProvider(()=>new Response(JSON.stringify({ error:{ message:'Incorrect API key provided' } }),{ status:401 }),async()=>{
    const r = await w.call('POST','/api/sample',{ cookie, body:{ prompt:'hi' } });
    assert.equal(r.status,401); assert.match(r.json.detail,/Incorrect API key/);
  });
  await withProvider(()=>new Response('{}',{ status:429 }),async()=>{ assert.equal((await w.call('POST','/api/sample',{ cookie, body:{ prompt:'hi' } })).status,429); });
  assert.equal((await w.call('POST','/api/sample',{ cookie, body:{} })).status,400);
  assert.equal((await w.call('POST','/api/sample',{ cookie, body:{ prompt:'x'.repeat(150001) } })).status,413);
});

test('worker ai: listing models and testing a connection use the saved or typed key',{ skip },async()=>{
  const w = await setup(), cookie = await signedIn(w);
  await save(w,cookie,{ providers:{ openai:{ key:'sk-saved', model:'gpt-x' } } });
  await withProvider(()=>new Response(JSON.stringify({ data:[{ id:'gpt-4o-mini' },{ id:'text-embedding-3' },{ id:'gpt-4o' }] }),{ status:200 }),async(seen)=>{
    const m = await w.call('POST','/api/models',{ cookie, body:{ provider:'openai' } });
    assert.deepEqual(m.json.models,['gpt-4o','gpt-4o-mini']); assert.equal(seen[0].headers.authorization,'Bearer sk-saved');
    await w.call('POST','/api/models',{ cookie, body:{ provider:'openai', key:'sk-typed' } });
    assert.equal(seen[1].headers.authorization,'Bearer sk-typed','a key typed but not saved yet is used');
  });
  await withProvider(()=>sse([{ choices:[{ delta:{ content:'OK' } }] }]),async()=>{
    const t = await w.call('POST','/api/test',{ cookie, body:{ provider:'openai' } });
    assert.equal(t.json.ok,true); assert.equal(t.json.reply,'OK');
  });
  assert.equal((await w.call('POST','/api/test',{ cookie, body:{ provider:'anthropic' } })).json.ok,false);
});

test('worker ai: custom endpoints must be public https hosts',{ skip },async()=>{
  const w = await setup(), cookie = await signedIn(w);
  for(const bad of ['http://api.example.com/v1','https://localhost:11434/v1','https://10.0.0.5/v1','https://[::1]/v1','https://printer.local/v1','https://intranet/v1','nonsense'])
    assert.equal((await save(w,cookie,{ providers:{ custom:{ baseUrl:bad, model:'m' } } })).status,400,bad);
  const ok = await save(w,cookie,{ providers:{ custom:{ baseUrl:'https://api.groq.com/openai/v1/', model:'llama' } } });
  assert.equal(ok.status,200); assert.equal(ok.json.providers.custom.baseUrl,'https://api.groq.com/openai/v1');
  assert.equal(ok.json.providers.custom.ready,true,'a custom endpoint may not need a key');
  assert.equal((await w.call('POST','/api/models',{ cookie, body:{ provider:'custom', baseUrl:'http://localhost/v1' } })).status,400,'typed URLs are checked too');
});

test('worker ai: deleting the account deletes the saved keys',{ skip },async()=>{
  const w = await setup(), cookie = await signedIn(w);
  await save(w,cookie,{ active:'openai', providers:{ openai:{ key:'sk-x', model:'m' } } });
  assert.equal(w.db.raw.prepare('SELECT COUNT(*) n FROM ai_connections').get().n,1);
  assert.equal((await w.call('DELETE','/api/auth/account',{ cookie })).status,200);
  for(const t of ['ai_connections','ai_settings']) assert.equal(w.db.raw.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n,0,t);
});
