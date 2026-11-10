#!/usr/bin/env node
'use strict';
// Cascade local server.
//  - serves the app (app/app.html) with this machine's saved tree and settings injected
//  - keeps API keys and sign-ins on this computer; the page can never read one back
//  - streams model output from Claude, OpenAI, OpenRouter, ChatGPT plan usage or any OpenAI-compatible endpoint
//  - finds a free port, and frees it again on exit
// No npm packages needed. Requires Node 18 or newer.
const http = require('http'), fs = require('fs'), path = require('path'), { exec } = require('child_process');
const ROOT = path.resolve(__dirname,'..');

// ---------- .env (optional) ----------
try{
  for(const line of fs.readFileSync(path.join(ROOT,'.env'),'utf8').split(/\r?\n/)){
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if(m && !m[1].startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g,'');
  }
}catch(e){}

const { HttpError, ProviderError, clamp, str, DATA_DIR } = require('./lib/util');
const settings = require('./lib/settings');
const chatgpt = require('./lib/chatgpt');
const providers = require('./lib/providers');
const project = require('./lib/project');
const { pickFolder } = require('./lib/picker');

const PREFERRED = +process.env.PORT || 4173;
let PORT = PREFERRED;   // the port actually in use; differs when the preferred one is busy
const HOST = '127.0.0.1';
const APP_FILE = path.join(ROOT,'app','app.html');
const TREE_FILE = path.join(DATA_DIR,'tree.json');
const pub = () => { const o = settings.publicSettings({ port:PORT, preferred:PREFERRED, pid:process.pid }); o.project = project.publicInfo(); return o; };
let scanState = { running:false, error:'' };

// ---------- http helpers ----------
const hostOk = (req) => { const h = (req.headers.host || '').toLowerCase(); return h === `localhost:${PORT}` || h === `127.0.0.1:${PORT}`; };
const originOk = (req) => { const o = req.headers.origin; if(!o) return true; try{ const h = new URL(o).host.toLowerCase(); return h === `localhost:${PORT}` || h === `127.0.0.1:${PORT}`; }catch(e){ return false; } };
const readBody = (req,max=2e6) => new Promise((resolve,reject)=>{
  let b = '';
  req.on('data',c=>{ b += c; if(b.length>max){ reject(new HttpError(413,'Too large')); req.destroy(); } });
  req.on('end',()=>resolve(b)); req.on('error',reject);
});
const parseJSON = (t) => { try{ return JSON.parse(t || '{}'); }catch(e){ throw new HttpError(400,'Bad JSON'); } };
const json = (res,code,obj) => { res.writeHead(code,{ 'content-type':'application/json','cache-control':'no-store' }); res.end(JSON.stringify(obj)); };
const inject = (v) => JSON.stringify(v).replace(/</g,'\\u003c');
const over = (b) => ({ key:str(b.key,500), model:str(b.model,200), baseUrl:str(b.baseUrl,300) });
const esc = (t) => String(t).replace(/[&<>"]/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
function callbackPage(r){
  const body = r.ok
    ? `<h1>You’re signed in${r.email ? ' as '+esc(r.email) : ''}.</h1><p>${r.planUsage ? 'Cascade can use your ChatGPT plan now.' : 'ChatGPT plan usage wasn’t allowed, so Cascade can’t use it yet. You can allow it from Settings.'}</p><p>You can close this tab and go back to Cascade.</p>`
    : `<h1>Sign-in didn’t finish</h1><p>${esc(r.message)}</p><p>Go back to Cascade and try again.</p>`;
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cascade</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;color:#16233a}h1{font-size:1.4rem}</style>${body}<script>try{setTimeout(function(){window.close()},2500)}catch(e){}</script>`;
}

// ---------- routes ----------
const server = http.createServer(async (req,res)=>{
  try{
    if(!hostOk(req) || !originOk(req)) return json(res,403,{ error:'forbidden' });
    const url = new URL(req.url,'http://localhost');
    const is = (m,p) => req.method===m && url.pathname===p;

    if(req.method==='GET' && (url.pathname==='/' || url.pathname==='/index.html')){
      clearTimeout(byeTimer);   // a reload, not a close
      let saved = 'null';
      try{ const raw = fs.readFileSync(TREE_FILE,'utf8'); JSON.parse(raw); saved = raw; }catch(e){}
      const runtime = `<script>window.__LOCAL__=true;window.__SETTINGS__=${inject(pub())};window.__CASCADE_SAVED__=${saved.replace(/</g,'\\u003c')};</script>`;
      const html = fs.readFileSync(APP_FILE,'utf8').replace('<!--RUNTIME-->',()=>runtime);
      res.writeHead(200,{ 'content-type':'text/html; charset=utf-8','cache-control':'no-store' });
      return res.end(html);
    }
    if(is('GET','/api/ping')) return json(res,200,{ app:'cascade', dir:DATA_DIR, pid:process.pid, port:PORT });
    if(is('GET','/api/settings')) return json(res,200,pub());
    if(is('POST','/api/settings')){ settings.applyPatch(parseJSON(await readBody(req))); return json(res,200,pub()); }

    if(is('POST','/api/hello')){
      const b = parseJSON(await readBody(req)); if(typeof b.id==='string') clients.add(b.id.slice(0,40));
      clearTimeout(byeTimer); return json(res,200,{ ok:true });
    }
    if(is('POST','/api/bye')){
      const b = parseJSON(await readBody(req)); if(typeof b.id==='string') clients.delete(b.id.slice(0,40));
      if(settings.get().prefs.quitOnClose && clients.size===0){
        clearTimeout(byeTimer);
        byeTimer = setTimeout(()=>{ if(clients.size===0) shutdown('the last tab was closed'); },GRACE);
      }
      return json(res,200,{ ok:true });
    }
    if(is('POST','/api/quit')){ json(res,200,{ ok:true }); setTimeout(()=>shutdown('quit from the app'),200); return; }

    if(is('POST','/api/tree')){
      const body = await readBody(req); JSON.parse(body);
      const tmp = TREE_FILE + '.tmp'; fs.writeFileSync(tmp,body); fs.renameSync(tmp,TREE_FILE);
      return json(res,200,{ ok:true });
    }

    // --- project folder: scan, search and read back (read-only; nothing is sent anywhere until the page builds a prompt) ---
    if(is('GET','/api/project')) return json(res,200,project.publicInfo());
    if(is('GET','/api/project/status')) return json(res,200,{ ...project.getProgress(), running:scanState.running, error:scanState.error, info:scanState.running ? null : project.publicInfo() });
    if(is('POST','/api/project/pick')){
      try{ return json(res,200,await pickFolder()); }
      catch(e){ throw new HttpError(e.status || 500,e.message); }
    }
    if(is('POST','/api/project/scan')){
      const b = parseJSON(await readBody(req));
      if(scanState.running) throw new HttpError(409,'A scan is already running.');
      const list = (v,n) => (Array.isArray(v) ? v : String(v || '').split(/[\n,]+/)).map(x=>String(x).trim()).filter(Boolean).slice(0,n);
      const opts = { ignore:list(b.ignore,60).map(x=>x.slice(0,200)), include:list(b.include,20).map(x=>x.slice(0,12)) };
      await project.resolveRoot(b.path);   // answers "no such folder" straight away
      scanState = { running:true, error:'' };
      project.scan(b.path,opts).then(()=>{ scanState = { running:false, error:'' }; }).catch(e=>{ scanState = { running:false, error:e && e.status===499 ? 'Scan cancelled.' : (e && e.message) || 'The scan failed.' }; });
      return json(res,200,{ started:true });
    }
    if(is('POST','/api/project/cancel')){ project.cancel(); return json(res,200,{ ok:true }); }
    if(is('GET','/api/project/groups')){
      let g = project.groups({ groupChars:+url.searchParams.get('chars') || undefined });
      if(url.searchParams.get('only')==='changed') g = g.filter(x=>x.changed);
      return json(res,200,{ groups:g });
    }
    if(is('GET','/api/project/findings')) return json(res,200,project.findings());
    if(is('POST','/api/project/brief')) return json(res,200,project.saveBrief(parseJSON(await readBody(req))));
    if(is('POST','/api/project/search')){
      const b = parseJSON(await readBody(req));
      return json(res,200,{ results:project.search(String(b.q || '').slice(0,600),Math.max(1,Math.min(12,+b.k || 6)),{ perFile:+b.perFile || 2 }) });
    }
    if(is('GET','/api/project/file')) return json(res,200,await project.readLines(url.searchParams.get('path') || '',url.searchParams.get('start'),url.searchParams.get('end')));
    if(is('POST','/api/project/forget')){ project.forget(); return json(res,200,pub()); }

    // --- sign-in flows ---
    if(is('POST','/api/oauth/openrouter')){
      const b = parseJSON(await readBody(req));
      if(typeof b.code!=='string' || typeof b.verifier!=='string') throw new HttpError(400,'Missing code or verifier');
      try{ settings.setKey('openrouter',await providers.exchangeOpenRouter(b.code,b.verifier)); }
      catch(e){ if(e instanceof ProviderError) return json(res,502,{ error:'upstream', detail:e.message }); throw e; }
      return json(res,200,pub());
    }
    if(is('POST','/api/chatgpt/start')){
      const b = parseJSON(await readBody(req));
      return json(res,200,chatgpt.start({ port:PORT, consent:!!b.consent }));
    }
    if(is('GET','/api/chatgpt/status')) return json(res,200,chatgpt.status());
    if(is('POST','/api/chatgpt/signout')){ const r = await chatgpt.signOut(); return json(res,200,Object.assign({ ok:true },r)); }
    if(is('GET','/auth/callback')){
      const r = await chatgpt.callback(url.searchParams);
      res.writeHead(r.ok ? 200 : 400,{ 'content-type':'text/html; charset=utf-8','cache-control':'no-store' });
      return res.end(callbackPage(r));
    }

    // --- model calls ---
    if(is('POST','/api/models')){
      const b = parseJSON(await readBody(req));
      if(!settings.NAMES.includes(b.provider) || b.provider==='demo') throw new HttpError(400,'Unknown provider');
      const o = over(b), cfg = settings.resolveProvider(b.provider,{ key:o.key, baseUrl:o.baseUrl });
      if(cfg.name==='chatgpt'){ if(!chatgpt.account()) throw new HttpError(400,'Sign in with ChatGPT first.'); }
      else{
        if(cfg.name!=='custom' && cfg.name!=='openrouter' && !cfg.key) throw new HttpError(400,'Add an API key first.');   // OpenRouter lists models without a key
        if(!cfg.base) throw new HttpError(400,'Enter a base URL first.');
      }
      try{ return json(res,200,{ models:await providers.listModels(cfg) }); }
      catch(e){ if(e instanceof ProviderError) return json(res,502,{ error:'upstream', detail:e.message }); throw e; }
    }
    if(is('POST','/api/test')){
      const b = parseJSON(await readBody(req));
      if(!settings.NAMES.includes(b.provider)) throw new HttpError(400,'Unknown provider');
      const cfg = settings.resolveProvider(b.provider,over(b)), why = settings.problem(cfg);
      if(why) return json(res,200,{ ok:false, error:why });
      const t0 = Date.now(); let reply = '';
      try{
        await providers.streamModel(cfg,{ prompt:'Reply with the single word OK.', maxTokens:400 },t => { reply += t; });
        return json(res,200,{ ok:true, ms:Date.now()-t0, reply:reply.trim().slice(0,60) });
      }catch(e){
        if(e instanceof ProviderError) return json(res,200,{ ok:false, status:e.status, error:e.message });
        throw e;
      }
    }
    if(is('POST','/api/sample')){
      const b = parseJSON(await readBody(req));
      if(typeof b.prompt!=='string' || !b.prompt) throw new HttpError(400,'Missing prompt');
      const cfg = settings.resolveProvider(settings.active()), why = settings.problem(cfg);
      if(why) return json(res,401,{ error:'not_ready', detail:why + ' Open Settings.' });
      const ac = new AbortController(); res.on('close',()=>ac.abort());
      let started = false;
      const start = () => { if(!started){ started = true; res.writeHead(200,{ 'content-type':'text/event-stream','cache-control':'no-store' }); } };
      try{
        await providers.streamModel(cfg,{
          prompt:b.prompt, signal:ac.signal,
          temperature: typeof b.temperature==='number' ? b.temperature : undefined,
          maxTokens: clamp(+b.maxTokens || 1800,100,8000)
        },t => { start(); res.write('data: ' + JSON.stringify({ t }) + '\n\n'); });
        start(); return res.end();
      }catch(e){
        if(e && e.name==='AbortError'){ try{ res.end(); }catch(x){} return; }
        if(!(e instanceof ProviderError)) throw e;
        console.error('Provider error',e.status,e.message);
        if(!started) return json(res,e.status===401||e.status===403 ? 401 : e.status===429 ? 429 : 502,{ error:'upstream', detail:e.message });
        res.write('data: ' + JSON.stringify({ error:e.message }) + '\n\n'); return res.end();
      }
    }

    json(res,404,{ error:'not_found' });
  }catch(e){
    if(e instanceof HttpError) return json(res,e.status,{ error:'bad_request', detail:e.message });
    console.error(e);
    if(!res.headersSent) json(res,500,{ error:'server_error' }); else res.end();
  }
});

// ---------- lifecycle: find a free port, and release it cleanly on exit ----------
const sockets = new Set(), clients = new Set();
server.on('connection',sk=>{ sockets.add(sk); sk.on('close',()=>sockets.delete(sk)); });
const GRACE = +process.env.CASCADE_BYE_GRACE_MS || 6000;
let closing = false, byeTimer = null;

function shutdown(reason,code){
  if(closing) return; closing = true;
  console.log(`\n  Stopping Cascade (${reason})...`);
  const force = setTimeout(()=>{ for(const sk of sockets) sk.destroy(); console.log('  Forced the port closed.'); process.exit(code || 0); },3000);
  force.unref();
  const closeStreams = setTimeout(()=>{ if(server.closeAllConnections) server.closeAllConnections(); else for(const sk of sockets) sk.destroy(); },800);
  closeStreams.unref();
  server.close(()=>{ clearTimeout(force); console.log(`  Port ${PORT} is free again. Goodbye.\n`); process.exit(code || 0); });
  if(server.closeIdleConnections) server.closeIdleConnections();
}
for(const sig of ['SIGINT','SIGTERM','SIGHUP','SIGBREAK']){ try{ process.on(sig,()=>shutdown(sig)); }catch(e){} }
process.on('uncaughtException',e=>{ console.error(e); shutdown('an unexpected error',1); });
process.on('unhandledRejection',e=>{ console.error(e); });

function openBrowser(port){
  if(process.env.NO_OPEN) return;
  const addr = `http://localhost:${port}`;
  const cmd = process.platform==='darwin' ? `open "${addr}"` : process.platform==='win32' ? `start "" "${addr}"` : `xdg-open "${addr}"`;
  exec(cmd,()=>{});
}
// Is the thing on this port a Cascade server using the same data folder?
function probe(port){
  return new Promise(resolve=>{
    const req = http.get({ host:'127.0.0.1', port, path:'/api/ping', timeout:900 },res=>{
      let b = ''; res.on('data',c=>{ b += c; });
      res.on('end',()=>{ try{ const j = JSON.parse(b); resolve(j && j.app==='cascade' && j.dir===DATA_DIR ? j : null); }catch(e){ resolve(null); } });
    });
    req.on('timeout',()=>{ req.destroy(); resolve(null); });
    req.on('error',()=>resolve(null));
  });
}
function tryListen(port){
  return new Promise((resolve,reject)=>{
    const onErr = e => { server.removeListener('listening',onOk); reject(e); };
    const onOk = () => { server.removeListener('error',onErr); resolve(); };
    server.once('error',onErr); server.once('listening',onOk);
    server.listen(port,HOST);
  });
}
function announce(){
  const s = pub(), a = s.providers[s.active];
  console.log(`\n  Cascade is running at http://localhost:${PORT}`);
  if(PORT!==PREFERRED) console.log(`  (port ${PREFERRED} was busy, so ${PORT} was used instead)`);
  console.log(s.active==='demo' ? '  AI: demo mode (scripted). Open Settings in the app to connect a real one.' : s.ready ? `  AI: ${s.active}${a.effectiveModel ? ' · '+a.effectiveModel : ''}` : `  AI: ${s.active} is not set up yet. Open Settings in the app.`);
  console.log('  Press Ctrl+C to stop. The port is released when you do.\n');
  openBrowser(PORT);
}
async function boot(){
  const env = process.env.CASCADE_PORT_TRIES;
  const tries = env!==undefined && env!=='' ? Math.max(0,+env) : 50;
  for(let i=0; i<=tries; i++){
    const port = PREFERRED + i; if(port>65535) break;
    try{ await tryListen(port); PORT = server.address().port; return announce(); }
    catch(e){
      if(e.code!=='EADDRINUSE' && e.code!=='EACCES') throw e;
      if(await probe(port)){
        console.log(`\n  Cascade is already running at http://localhost:${port}. Opening it instead of starting a second copy.\n`);
        openBrowser(port); process.exit(0);
      }
    }
  }
  await tryListen(0); PORT = server.address().port; announce();   // everything nearby was busy: let the OS pick
}
boot().catch(e=>{ console.error('Could not start the server:',e.message); process.exit(1); });
