'use strict';
// Server tests: ports, shutdown, security, provider adapters, OpenRouter and ChatGPT sign-in.
// Everything runs against local mock providers (see helpers/mocks.js). No network, no real keys.
const test = require('node:test'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net'), http = require('node:http');
const mocks = require('./helpers/mocks');

const ROOT = path.resolve(__dirname,'..');
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));
let mock;
test.before(async()=>{ mock = await mocks.start(); });
test.after(async()=>{ await mock.close(); });

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(),'cascade-test-'));
const freePort = () => new Promise(res=>{ const s = net.createServer(); s.listen(0,'127.0.0.1',()=>{ const p = s.address().port; s.close(()=>res(p)); }); });
const isFree = (port) => new Promise(res=>{ const s = net.createServer(); s.once('error',()=>res(false)); s.listen(port,'127.0.0.1',()=>s.close(()=>res(true))); });

// Starts a real server process. Returns helpers bound to its port.
async function boot(t,env = {},dir = tmp()){
  const p = spawn(process.execPath,[path.join(ROOT,'server','server.js')],{ env:{ ...process.env, NO_OPEN:'1', CASCADE_DATA_DIR:dir, ...mock.env, ...env } });
  p.out = ''; p.exited = false; p.dir = dir;
  p.on('exit',code=>{ p.exited = true; p.code = code; });
  p.stdout.on('data',d=>p.out += d); p.stderr.on('data',d=>p.out += d);
  for(let i=0; i<100 && !/running at http:\/\/localhost:\d+|already running at/.test(p.out) && !p.exited; i++) await sleep(50);
  const m = p.out.match(/running at http:\/\/localhost:(\d+)/);
  const port = m ? +m[1] : null;
  const req = (method,url,{ body,headers = {},host } = {}) => new Promise((resolve,reject)=>{
    const data = body===undefined ? null : (typeof body==='string' ? body : JSON.stringify(body));
    const r = http.request({ host:'127.0.0.1', port, path:url, method, headers:{ host:host || `localhost:${port}`, ...(data ? { 'content-type':'application/json' } : {}), ...headers } },res=>{
      let text = ''; res.on('data',c=>text += c); res.on('end',()=>{ let json = null; try{ json = JSON.parse(text); }catch(e){} resolve({ status:res.statusCode, text, json, headers:res.headers }); });
    });
    r.on('error',reject); if(data) r.write(data); r.end();
  });
  const stop = async () => { if(!p.exited){ p.kill('SIGINT'); for(let i=0; i<60 && !p.exited; i++) await sleep(50); if(!p.exited) p.kill('SIGKILL'); } };
  t.after(async()=>{ await stop(); fs.rmSync(dir,{ recursive:true, force:true }); });
  return { p, port, dir, req, stop };
}
const waitExit = async (p,ms = 5000) => { const t0 = Date.now(); while(!p.exited && Date.now()-t0<ms) await sleep(40); return Date.now()-t0; };

test('picks the next port when the preferred one is busy',async(t)=>{
  const busy = await freePort();
  const blocker = http.createServer((q,r)=>r.end('x')).listen(busy,'127.0.0.1'); t.after(()=>blocker.close());
  const b = await boot(t,{ PORT:String(busy) });
  assert.ok(b.port && b.port!==busy, 'used a different port');
  assert.match(b.p.out,/was busy/);
  const info = (await b.req('GET','/api/settings')).json.server;
  assert.equal(info.preferred,busy); assert.equal(info.port,b.port);
});
test('opens the copy already running from the same folder instead of starting a second',async(t)=>{
  const a = await boot(t);
  const second = spawn(process.execPath,[path.join(ROOT,'server','server.js')],{ env:{ ...process.env, NO_OPEN:'1', CASCADE_DATA_DIR:a.dir, PORT:String(a.port) } });
  let out = ''; second.stdout.on('data',d=>out += d); let code = null; second.on('exit',c=>{ code = c; });
  for(let i=0; i<80 && code===null; i++) await sleep(50);
  assert.equal(code,0); assert.match(out,/already running at/);
  assert.equal(a.p.exited,false,'the first copy keeps running');
});
test('a copy using a different data folder gets its own port',async(t)=>{
  const a = await boot(t);
  const b = await boot(t,{ PORT:String(a.port) });
  assert.notEqual(b.port,a.port); assert.ok(b.port>a.port);
});
test('falls back to an OS-chosen port when nothing nearby is free',async(t)=>{
  const busy = await freePort();
  const blocker = http.createServer((q,r)=>r.end('x')).listen(busy,'127.0.0.1'); t.after(()=>blocker.close());
  const b = await boot(t,{ PORT:String(busy), CASCADE_PORT_TRIES:'0' });
  assert.ok(b.port && b.port!==busy);
});
test('SIGINT releases the port',async(t)=>{
  const b = await boot(t); const port = b.port;
  b.p.kill('SIGINT'); await waitExit(b.p);
  assert.equal(b.p.code,0); assert.match(b.p.out,/is free again/); assert.equal(await isFree(port),true);
});
test('SIGTERM and /api/quit also release the port',async(t)=>{
  const a = await boot(t); a.p.kill('SIGTERM'); await waitExit(a.p); assert.equal(await isFree(a.port),true);
  const b = await boot(t); assert.equal((await b.req('POST','/api/quit',{ body:{} })).status,200); await waitExit(b.p);
  assert.equal(b.p.exited,true); assert.equal(await isFree(b.port),true);
});
test('shuts down promptly even with a model stream still open',async(t)=>{
  const b = await boot(t);
  await b.req('POST','/api/settings',{ body:{ active:'anthropic', providers:{ anthropic:{ key:'k', baseUrl:mock.base+'/anthropic-hang' } } } });
  let got = ''; const r = http.request({ host:'127.0.0.1', port:b.port, path:'/api/sample', method:'POST', headers:{ host:`localhost:${b.port}`, 'content-type':'application/json' } },res=>{ res.on('data',d=>got += d); res.on('error',()=>{}); });
  r.on('error',()=>{}); r.end('{"prompt":"x"}');
  for(let i=0; i<40 && !got.includes('"t":"hi"'); i++) await sleep(50);
  assert.ok(got.includes('"t":"hi"'),'stream is flowing');
  b.p.kill('SIGINT'); const ms = await waitExit(b.p,6000);
  assert.equal(b.p.exited,true); assert.ok(ms<3500,`exited in ${ms}ms`); assert.equal(await isFree(b.port),true);
});
test('quit-on-close: reload survives, closing the last tab stops the server',async(t)=>{
  const b = await boot(t,{ CASCADE_BYE_GRACE_MS:'500' }); const post = (u,id) => b.req('POST',u,{ body:{ id } });
  await b.req('POST','/api/settings',{ body:{ prefs:{ quitOnClose:true } } });
  await post('/api/hello','a'); await post('/api/bye','a'); await sleep(150); await post('/api/hello','b');
  await sleep(900); assert.equal(b.p.exited,false,'a reload does not stop it');
  await post('/api/hello','c'); await post('/api/bye','b'); await sleep(800); assert.equal(b.p.exited,false,'one tab still open');
  await post('/api/bye','c'); await waitExit(b.p,4000); assert.equal(b.p.exited,true);
});
test('quit-on-close is off by default',async(t)=>{
  const b = await boot(t,{ CASCADE_BYE_GRACE_MS:'200' });
  await b.req('POST','/api/hello',{ body:{ id:'x' } }); await b.req('POST','/api/bye',{ body:{ id:'x' } }); await sleep(700);
  assert.equal(b.p.exited,false);
});

test('only pages served by this exact server can talk to it',async(t)=>{
  const b = await boot(t); const post = (headers,host) => b.req('POST','/api/settings',{ body:{}, headers, host });
  assert.equal((await post({ origin:`http://localhost:${b.port}` })).status,200);
  assert.equal((await post({ origin:`http://127.0.0.1:${b.port}` })).status,200);
  assert.equal((await post({ origin:`http://localhost:${b.port+1}` })).status,403,'another local app');
  assert.equal((await post({ origin:'https://evil.example' })).status,403,'another website');
  assert.equal((await post({},'evil.example')).status,403,'DNS rebinding');
});
test('keys are stored but never sent back to the page',async(t)=>{
  const b = await boot(t);
  const r = await b.req('POST','/api/settings',{ body:{ active:'anthropic', providers:{ anthropic:{ key:'ant-key-1234' } } } });
  assert.equal(r.json.providers.anthropic.hint,'••••1234'); assert.equal(r.json.providers.anthropic.source,'settings');
  assert.ok(!r.text.includes('ant-key-1234'));
  assert.ok(!(await b.req('GET','/api/settings')).text.includes('ant-key-1234'));
  assert.ok(!(await b.req('GET','/')).text.includes('ant-key-1234'));
  const file = path.join(b.dir,'settings.json'); assert.ok(fs.readFileSync(file,'utf8').includes('ant-key-1234'));
  if(process.platform!=='win32') assert.equal(fs.statSync(file).mode & 0o777,0o600);
});
test('the served page gets this machine’s settings and tree injected',async(t)=>{
  const b = await boot(t);
  await b.req('POST','/api/tree',{ body:{ tree:'{"nodes":{}}', view:{ x:1, y:2, z:1 } } });
  const html = (await b.req('GET','/')).text;
  assert.ok(html.includes('window.__LOCAL__=true')); assert.ok(html.includes('window.__SETTINGS__=')); assert.ok(!html.includes('<!--RUNTIME-->'));
  assert.ok(html.includes('"tree":"{\\"nodes\\":{}}"'));
});
test('preferences are sanitised',async(t)=>{
  const b = await boot(t);
  const p = (await b.req('POST','/api/settings',{ body:{ prefs:{ goal:'g', steer:'bogus', creativity:9, theme:'dark', pushback:'x', grillStyle:'single' } } })).json.prefs;
  assert.equal(p.goal,'g'); assert.equal(p.steer,'balanced'); assert.equal(p.creativity,1); assert.equal(p.theme,'dark'); assert.equal(p.pushback,true); assert.equal(p.grillStyle,'single');
});
test('a fresh install defaults to the demo provider',async(t)=>{
  const b = await boot(t); const s = (await b.req('GET','/api/settings')).json;
  assert.equal(s.active,'demo'); assert.equal(s.ready,true);
  const r = await b.req('POST','/api/sample',{ body:{ prompt:'x' } }); assert.equal(r.status,401);
});

test('Claude: streams normalised text and maps a bad key to 401',async(t)=>{
  const b = await boot(t);
  await b.req('POST','/api/settings',{ body:{ active:'anthropic', providers:{ anthropic:{ key:'WRONG' } } } });
  const bad = await b.req('POST','/api/sample',{ body:{ prompt:'hi' } }); assert.equal(bad.status,401); assert.match(bad.json.detail,/invalid x-api-key/);
  await b.req('POST','/api/settings',{ body:{ providers:{ anthropic:{ key:'ant-key-1234' } } } });
  const ok = await b.req('POST','/api/sample',{ body:{ prompt:'hi', temperature:0.4 } });
  assert.equal(ok.status,200);
  const text = ok.text.split('\n').filter(l=>l.startsWith('data:')).map(l=>JSON.parse(l.slice(5)).t).join('');
  assert.equal(text,'{"id":"g1","type":"answer"}');
  assert.deepEqual((await b.req('POST','/api/models',{ body:{ provider:'anthropic' } })).json.models,['claude-haiku-5-5','claude-sonnet-5-5']);
  assert.equal((await b.req('POST','/api/test',{ body:{ provider:'anthropic' } })).json.ok,true);
});
test('OpenAI: adapts to models that reject temperature or max_tokens',async(t)=>{
  const b = await boot(t);
  await b.req('POST','/api/settings',{ body:{ active:'openai', providers:{ openai:{ key:'oa-key-9999', model:'strict' } } } });
  const from = mock.log.length;
  const ok = await b.req('POST','/api/sample',{ body:{ prompt:'hello', temperature:0.7 } }); assert.equal(ok.status,200);
  const sent = mock.log.slice(from).filter(e=>e.path==='/openai/v1/chat/completions').map(e=>e.body);
  assert.ok(sent.length>=3,'retried'); assert.ok('temperature' in sent[0] && 'max_tokens' in sent[0]);
  const last = sent[sent.length-1]; assert.ok(!('temperature' in last) && !('max_tokens' in last) && 'max_completion_tokens' in last);
  await b.req('POST','/api/settings',{ body:{ providers:{ openai:{ model:'empty' } } } });
  const t2 = (await b.req('POST','/api/test',{ body:{ provider:'openai' } })).json; assert.equal(t2.ok,false); assert.match(t2.error,/no text/);
});
test('custom endpoint needs a base URL and validates it',async(t)=>{
  const b = await boot(t);
  assert.equal((await b.req('POST','/api/settings',{ body:{ providers:{ custom:{ baseUrl:'ftp://x' } } } })).status,400);
  const t1 = (await b.req('POST','/api/test',{ body:{ provider:'custom' } })).json; assert.match(t1.error,/base URL/);
});

test('OpenRouter: lists models without a key, newest first',async(t)=>{
  const b = await boot(t);
  const r = await b.req('POST','/api/models',{ body:{ provider:'openrouter' } });
  assert.deepEqual(r.json.models,['google/gemini-flash:free','some-lab/model-x','anthropic/claude-new-haiku','openai/gpt-new-mini','anthropic/claude-old-haiku']);
});
test('OpenRouter sign-in: exchanges the code for a key and keeps it server-side',async(t)=>{
  const b = await boot(t);
  const verifier = 'v'.repeat(64);
  const bad = await b.req('POST','/api/oauth/openrouter',{ body:{ code:'wrong', verifier } }); assert.equal(bad.status,502); assert.match(bad.json.detail,/Invalid/);
  const from = mock.log.length;
  const r = await b.req('POST','/api/oauth/openrouter',{ body:{ code:'or-code-1', verifier } });
  assert.equal(r.status,200); assert.equal(r.json.active,'openrouter'); assert.equal(r.json.providers.openrouter.hasKey,true);
  assert.ok(!r.text.includes('sk-or-test-key'));
  const ex = mock.log.slice(from).find(e=>e.path.endsWith('/auth/keys')).body;
  assert.equal(ex.code_verifier,verifier); assert.equal(ex.code_challenge_method,'S256');
  await b.req('POST','/api/settings',{ body:{ providers:{ openrouter:{ model:'anthropic/claude-new-haiku' } } } });
  const s = await b.req('POST','/api/sample',{ body:{ prompt:'hi' } });
  assert.equal(s.status,200); assert.ok(s.text.includes('"t":"{\\"id\\":\\"g1\\","'));
  const chat = mock.log.filter(e=>e.path==='/openrouter/api/v1/chat/completions').pop();
  assert.equal(chat.headers['x-title'],'Cascade'); assert.equal(chat.body.model,'anthropic/claude-new-haiku');
});

// ---------- Claude plan through the Claude Code CLI ----------
// A stand-in for `claude`: records its arguments, environment and stdin, then replies in stream-json.
function fakeClaude(dir,mode = 'ok'){
  const f = path.join(dir,'fake-claude.js'), log = path.join(dir,'fake-claude.log');
  fs.writeFileSync(f,`#!${process.execPath}
let input = ''; process.stdin.on('data',d=>input += d); process.stdin.on('end',()=>{
  require('fs').appendFileSync(${JSON.stringify(log)},JSON.stringify({ args:process.argv.slice(2), cwd:process.cwd(), key:process.env.ANTHROPIC_API_KEY || null, input })+'\\n');
  const out = (o) => process.stdout.write(JSON.stringify(o)+'\\n');
  out({ type:'system', subtype:'init', apiKeySource:'none' });
  if(${JSON.stringify(mode)}==='logout'){ out({ type:'result', subtype:'success', is_error:true, result:'Not logged in · Please run /login' }); process.exit(1); }
  for(const t of ['{"id":"g1",','"type":"answer"}']) out({ type:'stream_event', event:{ type:'content_block_delta', index:0, delta:{ type:'text_delta', text:t } } });
  out({ type:'result', subtype:'success', is_error:false, result:'' });
});`,{ mode:0o755 });
  return { bin:f, calls:() => fs.existsSync(log) ? fs.readFileSync(log,'utf8').trim().split('\n').map(l=>JSON.parse(l)) : [] };
}
test('Claude Code: streams through the local CLI with no API key and no project context',{ skip:process.platform==='win32' },async(t)=>{
  const fake = fakeClaude(tmp());
  const b = await boot(t,{ CASCADE_CLAUDE_BIN:fake.bin, ANTHROPIC_API_KEY:'sk-ant-should-not-be-passed' });
  const s = (await b.req('GET','/api/settings')).json.providers.claudecode;
  assert.equal(s.installed,true); assert.equal(s.ready,true); assert.equal(s.effectiveModel,'haiku');
  assert.deepEqual((await b.req('POST','/api/models',{ body:{ provider:'claudecode' } })).json.models,['haiku','sonnet','opus','fable']);
  await b.req('POST','/api/settings',{ body:{ active:'claudecode', providers:{ claudecode:{ model:'sonnet' } } } });
  const r = await b.req('POST','/api/sample',{ body:{ prompt:'hello there', maxTokens:500 } });
  const text = r.text.split('\n').filter(l=>l.startsWith('data:')).map(l=>JSON.parse(l.slice(5)).t).join('');
  assert.equal(text,'{"id":"g1","type":"answer"}');
  const call = fake.calls().pop();
  assert.equal(call.input,'hello there','the prompt goes in on stdin');
  assert.equal(call.key,null,'the API key is not handed to the CLI');
  assert.equal(fs.realpathSync(call.cwd),fs.realpathSync(path.join(b.dir,'.claude-cli')));
  const a = call.args, val = (f) => a[a.indexOf(f)+1];
  assert.ok(a.includes('-p') && a.includes('--strict-mcp-config') && a.includes('--no-session-persistence') && a.includes('--include-partial-messages'));
  assert.equal(val('--tools'),''); assert.equal(val('--setting-sources'),''); assert.equal(val('--model'),'sonnet'); assert.equal(val('--output-format'),'stream-json');
});
test('Claude Code: explains a logged-out CLI and a missing one',{ skip:process.platform==='win32' },async(t)=>{
  const fake = fakeClaude(tmp(),'logout');
  const b = await boot(t,{ CASCADE_CLAUDE_BIN:fake.bin });
  const r = (await b.req('POST','/api/test',{ body:{ provider:'claudecode' } })).json;
  assert.equal(r.ok,false); assert.equal(r.status,401); assert.match(r.error,/isn’t logged in/);
  const missing = await boot(t,{ CASCADE_CLAUDE_BIN:path.join(tmp(),'nope') });
  const s = (await missing.req('GET','/api/settings')).json.providers.claudecode;
  assert.equal(s.installed,false); assert.equal(s.ready,false);
  assert.match((await missing.req('POST','/api/test',{ body:{ provider:'claudecode' } })).json.error,/isn’t installed/);
});

// ---------- Sign in with ChatGPT ----------
async function signIn(b,{ consent } = {}){
  const start = await b.req('POST','/api/chatgpt/start',{ body:{ consent } });
  const authz = await fetch(start.json.url,{ redirect:'manual' });
  const cb = new URL(authz.headers.get('location'));
  const res = await b.req('GET',cb.pathname+cb.search,{ host:`127.0.0.1:${b.port}` });
  return { url:new URL(start.json.url), callback:res };
}
test('ChatGPT: builds the documented authorization request',async(t)=>{
  const b = await boot(t); const { url } = await signIn(b); const q = url.searchParams;
  assert.equal(url.origin+url.pathname,mock.base+'/chatgpt-auth/api/accounts/authorize');
  assert.equal(q.get('client_id'),'dynamic_agent_client'); assert.equal(q.get('agent_name_hint'),'Cascade');
  assert.equal(q.get('response_type'),'code'); assert.equal(q.get('code_challenge_method'),'S256');
  assert.equal(q.get('redirect_uri'),`http://127.0.0.1:${b.port}/auth/callback`);
  assert.equal(q.get('resource'),'https://api.openai.com/v1');
  for(const s of ['openid','profile','email','offline_access','resource.invoke','chatgpt.tokens.use.direct']) assert.ok(q.get('scope').split(' ').includes(s),s);
  assert.match(q.get('ext_agent_host_id'),/^urn:uuid:/); assert.ok(q.get('state') && q.get('nonce') && q.get('code_challenge'));
});
test('ChatGPT: full sign-in, models, test and streaming, with tokens kept off the page',async(t)=>{
  const b = await boot(t); const { callback } = await signIn(b);
  assert.equal(callback.status,200); assert.match(callback.text,/signed in as dev@example.com/);
  const st = (await b.req('GET','/api/chatgpt/status')).json; assert.equal(st.state,'connected'); assert.equal(st.planUsage,true);
  const s = await b.req('GET','/api/settings'); assert.equal(s.json.providers.chatgpt.account.email,'dev@example.com');
  assert.ok(!s.text.includes('at-1') && !s.text.includes('rt-1'));
  assert.ok(!(await b.req('GET','/')).text.includes('rt-1'));
  const file = path.join(b.dir,'chatgpt-auth.json'); assert.ok(fs.existsSync(file));
  if(process.platform!=='win32') assert.equal(fs.statSync(file).mode & 0o777,0o600);
  assert.deepEqual((await b.req('POST','/api/models',{ body:{ provider:'chatgpt' } })).json.models,['gpt-plan-big','gpt-plan-mini']);
  await b.req('POST','/api/settings',{ body:{ active:'chatgpt', providers:{ chatgpt:{ model:'gpt-plan-mini' } } } });
  assert.equal((await b.req('GET','/api/settings')).json.ready,true);
  assert.equal((await b.req('POST','/api/test',{ body:{ provider:'chatgpt' } })).json.ok,true);
  const from = mock.log.length;
  const r = await b.req('POST','/api/sample',{ body:{ prompt:'hello', temperature:0.7, maxTokens:500 } });
  const text = r.text.split('\n').filter(l=>l.startsWith('data:')).map(l=>JSON.parse(l.slice(5)).t).join('');
  assert.equal(text,'{"id":"g1","type":"answer"}');
  const sent = mock.log.slice(from).find(e=>e.path==='/chatgpt-api/v1/responses');
  assert.equal(sent.headers.authorization,'Bearer at-1'); assert.equal(sent.body.store,false); assert.equal(sent.body.stream,true);
  assert.ok(!('temperature' in sent.body) && !('max_output_tokens' in sent.body) && !('max_tokens' in sent.body));
  assert.ok(sent.body.instructions); assert.deepEqual(sent.body.input,[{ type:'message', role:'user', content:[{ type:'input_text', text:'hello' }] }]);
});
test('ChatGPT: rejects a wrong state, a declined sign-in and a callback with nothing pending',async(t)=>{
  const b = await boot(t);
  assert.equal((await b.req('GET','/auth/callback?code=x&state=y',{ host:`127.0.0.1:${b.port}` })).status,400);
  const start = await b.req('POST','/api/chatgpt/start',{ body:{} });
  const cb = new URL((await fetch(start.json.url,{ redirect:'manual' })).headers.get('location')); cb.searchParams.set('state','tampered');
  const bad = await b.req('GET',cb.pathname+cb.search,{ host:`127.0.0.1:${b.port}` }); assert.equal(bad.status,400); assert.match(bad.text,/didn’t match/);
  mock.state.deny = true; t.after(()=>{ mock.state.deny = false; });
  const { callback } = await signIn(b); assert.equal(callback.status,400); assert.match(callback.text,/declined/);
  assert.equal((await b.req('GET','/api/chatgpt/status')).json.state,'error');
});
test('ChatGPT: verifies the ID token signature and nonce',async(t)=>{
  const b = await boot(t);
  mock.state.badSignature = true; t.after(()=>{ mock.state.badSignature = false; mock.state.badNonce = false; });
  let r = await signIn(b); assert.equal(r.callback.status,400); assert.match(r.callback.text,/signature/);
  assert.equal((await b.req('GET','/api/chatgpt/status')).json.state,'error');
  mock.state.badSignature = false; mock.state.badNonce = true;
  r = await signIn(b); assert.equal(r.callback.status,400); assert.match(r.callback.text,/nonce/);
});
test('ChatGPT: signed in without plan permission is not usable until consent is given',async(t)=>{
  const b = await boot(t);
  mock.state.noPlan = true; t.after(()=>{ mock.state.noPlan = false; });
  const { callback } = await signIn(b); assert.equal(callback.status,200); assert.match(callback.text,/wasn’t allowed/);
  const acct = (await b.req('GET','/api/settings')).json.providers.chatgpt.account; assert.equal(acct.planUsage,false);
  await b.req('POST','/api/settings',{ body:{ providers:{ chatgpt:{ model:'gpt-plan-mini' } } } });
  assert.match((await b.req('POST','/api/test',{ body:{ provider:'chatgpt' } })).json.error,/plan usage/i);
  mock.state.noPlan = false;
  const again = await signIn(b,{ consent:true });
  assert.equal(again.url.searchParams.get('prompt'),'consent'); assert.equal(again.url.searchParams.get('client_id'),'oaiapp_test123');
  assert.equal(again.url.searchParams.get('agent_name_hint'),null);
  assert.equal((await b.req('GET','/api/settings')).json.providers.chatgpt.account.planUsage,true);
});
test('ChatGPT: refreshes expiring tokens, rotating the refresh token, and retries after a 401',async(t)=>{
  const b = await boot(t);
  mock.state.expiresIn = 1; t.after(()=>{ mock.state.expiresIn = 3600; });
  await signIn(b); await b.req('POST','/api/settings',{ body:{ active:'chatgpt', providers:{ chatgpt:{ model:'gpt-plan-mini' } } } });
  const from = mock.log.length;
  assert.equal((await b.req('POST','/api/sample',{ body:{ prompt:'a' } })).status,200);
  assert.equal((await b.req('POST','/api/sample',{ body:{ prompt:'b' } })).status,200);
  const grants = mock.log.slice(from).filter(e=>e.path.endsWith('/oauth/token')).map(e=>Object.fromEntries(new URLSearchParams(e.raw)));
  assert.ok(grants.length>=2 && grants.every(g=>g.grant_type==='refresh_token' && g.client_id==='oaiapp_test123' && g.resource==='https://api.openai.com/v1'));
  const saved = JSON.parse(fs.readFileSync(path.join(b.dir,'chatgpt-auth.json'),'utf8')).account;
  assert.notEqual(saved.refresh_token,'rt-1'); assert.match(saved.access_token,/^at-/);
  mock.state.expiresIn = 3600; mock.state.expire401Once = true;
  assert.equal((await b.req('POST','/api/sample',{ body:{ prompt:'c' } })).status,200,'forced a refresh and retried');
});
test('ChatGPT: explains a usage limit instead of failing silently',async(t)=>{
  const b = await boot(t); await signIn(b);
  await b.req('POST','/api/settings',{ body:{ active:'chatgpt', providers:{ chatgpt:{ model:'gpt-plan-mini' } } } });
  mock.state.usageLimit = true; t.after(()=>{ mock.state.usageLimit = false; });
  const r = await b.req('POST','/api/sample',{ body:{ prompt:'x' } }); assert.equal(r.status,429); assert.match(r.json.detail,/usage limit/i);
});
test('ChatGPT: a dead refresh token ends the session cleanly',async(t)=>{
  const b = await boot(t); mock.state.expiresIn = 1; t.after(()=>{ mock.state.expiresIn = 3600; });
  await signIn(b); await b.req('POST','/api/settings',{ body:{ active:'chatgpt', providers:{ chatgpt:{ model:'gpt-plan-mini' } } } });
  mock.state.refreshTokens.clear();
  const r = await b.req('POST','/api/sample',{ body:{ prompt:'x' } }); assert.equal(r.status,401); assert.match(r.json.detail,/session ended/i);
  const s = (await b.req('GET','/api/settings')).json; assert.equal(s.providers.chatgpt.account,null); assert.equal(s.providers.chatgpt.ready,false);
});
test('ChatGPT: signing out revokes the token, keeps the registration and reuses it next time',async(t)=>{
  const b = await boot(t); await signIn(b);
  const out = (await b.req('POST','/api/chatgpt/signout',{ body:{} })).json; assert.equal(out.revoked,true);
  assert.equal(mock.state.revoked.token_type_hint,'refresh_token'); assert.equal(mock.state.revoked.client_id,'oaiapp_test123');
  const file = JSON.parse(fs.readFileSync(path.join(b.dir,'chatgpt-auth.json'),'utf8'));
  assert.equal(file.client_id,'oaiapp_test123'); assert.match(file.host_id,/^urn:uuid:/);
  assert.ok(!file.account.access_token && !file.account.refresh_token);
  assert.equal((await b.req('GET','/api/chatgpt/status')).json.state,'none');
  const hostBefore = file.host_id; mock.state.refreshTokens.add('rt-1');
  const { url } = await signIn(b); const q = url.searchParams;
  assert.equal(q.get('client_id'),'oaiapp_test123'); assert.equal(q.get('agent_name_hint'),null);
  assert.ok(q.get('id_token_hint')); assert.equal(q.get('login_hint'),'dev@example.com'); assert.equal(q.get('ext_agent_host_id'),hostBefore);
});

test('the look is stored on the server, injected into the page, and size-limited',async(t)=>{
  const b = await boot(t);
  const look = { wires:{ style:'straight' }, nodes:{ decision:{ shape:'diamond' } } };
  const r = await b.req('POST','/api/settings',{ body:{ look } }); assert.equal(r.status,200); assert.deepEqual(r.json.look,look);
  assert.deepEqual((await b.req('GET','/api/settings')).json.look,look);
  assert.ok((await b.req('GET','/')).text.includes('"look":{"wires":{"style":"straight"},"nodes":{"decision":{"shape":"diamond"}}}'));
  assert.ok(fs.readFileSync(path.join(b.dir,'settings.json'),'utf8').includes('"diamond"'));
  assert.equal((await b.req('POST','/api/settings',{ body:{ look:[1] } })).status,400);
  assert.equal((await b.req('POST','/api/settings',{ body:{ look:'x' } })).status,400);
  assert.equal((await b.req('POST','/api/settings',{ body:{ look:{ pad:'x'.repeat(21000) } } })).status,400);
  assert.deepEqual((await b.req('GET','/api/settings')).json.look,look,'a rejected look changes nothing');
});
