// AI for signed-in web users. Each person saves their own Claude, OpenAI, OpenRouter or custom-endpoint key once; it is encrypted
// (AES-GCM, bound to the user and provider) before it reaches D1, and the page only ever sees its last four characters.
// Calls go page -> this Worker -> provider, streamed back. The routes and JSON match the local app, so the page reuses its
// provider settings screen unchanged.
import providers from '../../shared/providers.js';
import sharedUtil from '../../shared/util.js';

const { streamModel, listModels, exchangeOpenRouter } = providers;
import { record, userHash } from './analytics.js';
const { ProviderError, clamp, str } = sharedUtil;

export const NAMES = ['openrouter','anthropic','openai','custom','demo'];
const KEYED = NAMES.filter(n=>n!=='demo');
const DEFAULT_BASE = { anthropic:'https://api.anthropic.com', openai:'https://api.openai.com/v1', openrouter:'https://openrouter.ai/api/v1', custom:'' };
const DEFAULT_MODEL = { anthropic:'claude-haiku-5-5' };
const MAX_PROMPT = 150000;

class AiError extends Error { constructor(status,message){ super(message); this.status = status; } }

/* ------------------------------- encryption ------------------------------- */
const enc = new TextEncoder();
const toB64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const fromB64u = (s) => { s = s.replace(/-/g,'+').replace(/_/g,'/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s),c=>c.charCodeAt(0)); };
async function aesKey(env){
  let raw; try{ raw = fromB64u(String(env.KEY_SECRET || '')); }catch(e){ raw = new Uint8Array(0); }
  if(raw.length!==32) throw new AiError(503,'Saving AI keys is not set up on this server yet.');
  return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
}
export async function encryptKey(env,uid,provider,plain){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv, additionalData:enc.encode(uid+':'+provider) },await aesKey(env),enc.encode(plain));
  const out = new Uint8Array(12 + ct.byteLength); out.set(iv); out.set(new Uint8Array(ct),12);
  return toB64u(out);
}
export async function decryptKey(env,uid,provider,blob){
  if(!blob) return '';
  const all = fromB64u(blob);
  try{
    const pt = await crypto.subtle.decrypt({ name:'AES-GCM', iv:all.slice(0,12), additionalData:enc.encode(uid+':'+provider) },await aesKey(env),all.slice(12));
    return new TextDecoder().decode(pt);
  }catch(e){ throw new AiError(500,'A saved key could not be read. Save it again.'); }
}

/* ----------------------------- settings and config ----------------------------- */
// A custom base URL is fetched from our servers, so only public https hosts are allowed.
function cleanBase(raw,name){
  let b = String(raw || '').trim(); if(!b) return '';
  let u; try{ u = new URL(b); }catch(e){ throw new AiError(400,'That base URL isn’t valid. Start with https://'); }
  const h = u.hostname.toLowerCase();
  if(u.protocol!=='https:') throw new AiError(400,'The base URL must start with https://. Endpoints on your own computer only work in the local app.');
  if(h==='localhost' || /\.(local|internal|localhost)$/.test(h) || /^[\d.]+$/.test(h) || h.includes(':') || !h.includes('.')) throw new AiError(400,'Use a public host name. Endpoints on your own computer or network only work in the local app.');
  b = b.replace(/\/+$/,'');
  return name==='anthropic' ? b.replace(/\/v1$/,'') : b;
}
const hint = (k) => k ? '••••' + k.slice(-4) : '';

async function loadAi(store,uid){
  const { active, rows } = await store.getAi(uid);
  const providersByName = {};
  for(const n of KEYED){
    const r = rows.find(x=>x.provider===n) || {};
    providersByName[n] = { keyEnc:r.key_enc || '', hint:r.key_hint || '', model:r.model || '', baseUrl:r.base_url || '' };
  }
  return { active:NAMES.includes(active) ? active : 'demo', providers:providersByName };
}
function effective(name,saved,over){
  over = over || {};
  const pick = (o,s,d) => (o || s || d || '');
  return { name, kind:name==='anthropic' ? 'anthropic' : 'openai',
    base:pick(over.baseUrl,saved.baseUrl,DEFAULT_BASE[name]).replace(/\/+$/,''), model:pick(over.model,saved.model,DEFAULT_MODEL[name]),
    extra:name==='openrouter' ? { headers:{ 'X-Title':'Cascade' } } : {} };
}
function problem(name,cfg,hasKey){
  if(name==='demo') return 'The demo runs inside the page, not on the server.';
  if(name==='custom' && !cfg.base) return 'Enter a base URL first.';
  if(name!=='custom' && !hasKey) return 'Add an API key first.';
  if(!cfg.model) return 'Choose a model first. Try Fetch models.';
  return '';
}
function publicSettings(ai){
  const out = { local:false, cloud:true, active:ai.active, providers:{ demo:{ ready:true, hasKey:false, hint:'', source:null, model:'', effectiveModel:'', baseUrl:'', defaultModel:'' } } };
  for(const n of KEYED){
    const s = ai.providers[n], cfg = effective(n,s);
    out.providers[n] = { hasKey:!!s.keyEnc, hint:s.hint, source:s.keyEnc ? 'settings' : null, model:s.model, effectiveModel:cfg.model, baseUrl:s.baseUrl, effectiveBase:cfg.base,
      defaultModel:DEFAULT_MODEL[n] || '', ready:!problem(n,cfg,!!s.keyEnc) };
  }
  out.ready = out.providers[out.active].ready;
  return out;
}

async function applyPatch(env,store,uid,patch,now){
  if(!patch || typeof patch!=='object') throw new AiError(400,'Bad settings');
  if(patch.active!==undefined){ if(!NAMES.includes(patch.active)) throw new AiError(400,'Unknown provider'); await store.setActive(uid,patch.active,now); }
  if(patch.providers && typeof patch.providers==='object'){
    const ai = await loadAi(store,uid);
    for(const [n,v] of Object.entries(patch.providers)){
      if(!KEYED.includes(n) || !v || typeof v!=='object') continue;
      const cur = ai.providers[n], next = { keyEnc:cur.keyEnc, hint:cur.hint, model:cur.model, baseUrl:cur.baseUrl };
      if(v.key===null){ next.keyEnc = ''; next.hint = ''; }
      else if(typeof v.key==='string' && v.key.trim()){ const k = v.key.trim().slice(0,500); next.keyEnc = await encryptKey(env,uid,n,k); next.hint = hint(k); }
      if(typeof v.model==='string') next.model = v.model.trim().slice(0,200);
      if(typeof v.baseUrl==='string') next.baseUrl = cleanBase(v.baseUrl,n);
      await store.putConn(uid,n,next,now);
    }
  }
}
async function resolveForCall(env,store,uid,name,over){
  const ai = await loadAi(store,uid), saved = ai.providers[name];
  if(!saved) throw new AiError(400,'Unknown provider');
  const o = { key:str(over && over.key,500), model:str(over && over.model,200), baseUrl:over && over.baseUrl ? cleanBase(over.baseUrl,name) : '' };
  const cfg = effective(name,saved,o);
  cfg.key = o.key || await decryptKey(env,uid,name,saved.keyEnc);
  return { cfg, why:problem(name,cfg,!!cfg.key) };
}

/* --------------------------------- routes --------------------------------- */
const json = (status,body) => new Response(JSON.stringify(body),{ status, headers:{ 'content-type':'application/json','cache-control':'no-store' } });
const upstream = (e) => json(e.status===401||e.status===403 ? 401 : e.status===429 ? 429 : 502,{ error:'upstream', detail:e.message });

// Returns a Response, or null when the path is not an AI route.
export async function handleAi({ request, path, method, env, store, uid, bodyOf, now }){
  try{
    if(path==='/api/settings' && method==='GET') return json(200,publicSettings(await loadAi(store,uid)));
    if(path==='/api/settings' && method==='POST'){
      const patch = await bodyOf(); await applyPatch(env,store,uid,patch,now);
      for(const [n,v] of Object.entries((patch && patch.providers) || {})) if(v && typeof v.key==='string' && v.key.trim()) await record(env,request,'ai_key_saved',{ label:n },{ signedIn:true, visitor:await userHash(env,uid) });
      return json(200,publicSettings(await loadAi(store,uid)));
    }

    if(path==='/api/models' && method==='POST'){
      const b = await bodyOf();
      if(!KEYED.includes(b.provider)) throw new AiError(400,'Unknown provider');
      const { cfg } = await resolveForCall(env,store,uid,b.provider,{ key:b.key, baseUrl:b.baseUrl });
      if(cfg.name!=='custom' && cfg.name!=='openrouter' && !cfg.key) throw new AiError(400,'Add an API key first.');
      if(!cfg.base) throw new AiError(400,'Enter a base URL first.');
      try{ return json(200,{ models:await listModels(cfg) }); }catch(e){ if(e instanceof ProviderError) return upstream(e); throw e; }
    }
    if(path==='/api/test' && method==='POST'){
      const b = await bodyOf();
      if(!NAMES.includes(b.provider)) throw new AiError(400,'Unknown provider');
      const { cfg, why } = await resolveForCall(env,store,uid,b.provider==='demo' ? 'openrouter' : b.provider,{ key:b.key, model:b.model, baseUrl:b.baseUrl });
      if(b.provider==='demo' || why) return json(200,{ ok:false, error:why || 'The demo runs inside the page, not on the server.' });
      const t0 = Date.now(); let reply = '';
      try{ await streamModel(cfg,{ prompt:'Reply with the single word OK.', maxTokens:400 },t => { reply += t; }); return json(200,{ ok:true, ms:Date.now()-t0, reply:reply.trim().slice(0,60) }); }
      catch(e){ if(e instanceof ProviderError) return json(200,{ ok:false, status:e.status, error:e.message }); throw e; }
    }
    if(path==='/api/oauth/openrouter' && method==='POST'){
      const b = await bodyOf();
      if(typeof b.code!=='string' || typeof b.verifier!=='string') throw new AiError(400,'Missing code or verifier');
      let key; try{ key = await exchangeOpenRouter(DEFAULT_BASE.openrouter,b.code,b.verifier); }catch(e){ if(e instanceof ProviderError) return json(502,{ error:'upstream', detail:e.message }); throw e; }
      await applyPatch(env,store,uid,{ providers:{ openrouter:{ key } }, active:'openrouter' },now);
      return json(200,publicSettings(await loadAi(store,uid)));
    }
    if(path==='/api/sample' && method==='POST') return await sample({ request, env, store, uid, bodyOf });
    return null;
  }catch(e){
    if(e instanceof AiError) return json(e.status,{ error:'bad_request', detail:e.message });
    throw e;
  }
}

// Streams the model's text back as server-sent events, the same format the local app uses.
async function sample({ request, env, store, uid, bodyOf }){
  const b = await bodyOf();
  if(typeof b.prompt!=='string' || !b.prompt) throw new AiError(400,'Missing prompt');
  if(b.prompt.length>MAX_PROMPT) throw new AiError(413,'That prompt is too long.');
  const ai = await loadAi(store,uid);
  if(ai.active==='demo') return json(401,{ error:'not_ready', detail:'Pick a provider and add a key in Settings.' });
  const { cfg, why } = await resolveForCall(env,store,uid,ai.active,{});
  if(why) return json(401,{ error:'not_ready', detail:why+' Open Settings.' });

  const t0 = Date.now(), measure = (outcome) => userHash(env,uid).then(visitor=>record(env,request,'ai_call',{ label:ai.active, outcome, ms:Date.now()-t0 },{ signedIn:true, visitor }));
  const { readable, writable } = new TransformStream(), w = writable.getWriter(), te = new TextEncoder();
  const send = (o) => w.write(te.encode('data: '+JSON.stringify(o)+'\n\n')).catch(()=>{});
  let started = false, early = null, release; const first = new Promise(r=>{ release = r; });
  (async()=>{
    try{
      await streamModel(cfg,{ prompt:b.prompt, signal:request.signal, temperature:typeof b.temperature==='number' ? b.temperature : undefined, maxTokens:clamp(+b.maxTokens || 1800,100,8000) },t => { started = true; release(); send({ t }); });
      started = true; release(); await measure('ok');
    }catch(e){
      if(e && e.name==='AbortError'){ started = true; release(); }
      else if(!started){ early = e; await measure('error'); release(); return; }
      else { await send({ error:e && e.message || 'The provider stopped.' }); await measure('error'); }
    }
    try{ await w.close(); }catch(e){}
  })();
  await first;
  if(early){ if(early instanceof ProviderError) return upstream(early); throw early; }
  return new Response(readable,{ headers:{ 'content-type':'text/event-stream','cache-control':'no-store' } });
}
