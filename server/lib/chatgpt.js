'use strict';
// "Sign in with ChatGPT" for open-source, locally hosted apps (OpenAI preview).
// Implements the documented flow: dynamic client registration, OAuth code + PKCE on a 127.0.0.1
// loopback callback, ID-token verification, rotating refresh tokens, and Responses API streaming.
// Tokens stay in chatgpt-auth.json (owner-only) and are never sent to the page.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { ProviderError, doFetch, providerError, sseData, DATA_DIR } = require('./util');

const trim = (u) => u.replace(/\/+$/,'');
// The overrides exist so tests can point at a mock server. Leave them unset in real use.
const AUTH_BASE = trim(process.env.CASCADE_CHATGPT_AUTH_BASE || 'https://auth.openai.com');
const API_BASE = trim(process.env.CASCADE_CHATGPT_API_BASE || 'https://api.openai.com/v1');
const ISSUER = process.env.CASCADE_CHATGPT_ISSUER || 'https://auth.openai.com';
const RESOURCE = 'https://api.openai.com/v1';
const AUTHORIZE = AUTH_BASE + '/api/accounts/authorize';
const TOKEN = AUTH_BASE + '/api/accounts/oauth/token';
const JWKS = AUTH_BASE + '/.well-known/jwks.json';
const DISCOVERY = AUTH_BASE + '/.well-known/openid-configuration';
const SCOPE = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const PLAN_SCOPE = 'chatgpt.tokens.use.direct';
const APP_NAME = 'Cascade';
const FILE = path.join(DATA_DIR,'chatgpt-auth.json');
const UNUSABLE = new Set(['invalid_grant','invalid_refresh_token','token_expired','refresh_token_expired','refresh_token_invalidated','refresh_token_reused']);
const INSTRUCTIONS = 'You follow the user’s formatting instructions exactly and reply with only what they ask for.';
const NO_TEXT = 'The model returned no text. Try a different model.';

let auth = read();
let pending = null, lastError = '', refreshing = null, jwksCache = null;

function read(){
  try{ const o = JSON.parse(fs.readFileSync(FILE,'utf8')); return { host_id:o.host_id || null, client_id:o.client_id || null, account:o.account || null }; }
  catch(e){ return { host_id:null, client_id:null, account:null }; }
}
function write(){
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp,JSON.stringify(auth,null,2),{ mode:0o600 });
  fs.renameSync(tmp,FILE);
  try{ fs.chmodSync(FILE,0o600); }catch(e){}
}
const b64u = (buf) => Buffer.from(buf).toString('base64url');
function hostId(){ if(!auth.host_id){ auth.host_id = 'urn:uuid:' + crypto.randomUUID(); write(); } return auth.host_id; }

// A signed-in account is one that still has a refresh token. Signing out keeps the registration for next time.
const account = () => (auth.account && auth.account.refresh_token) ? auth.account : null;
const publicAccount = () => { const a = account(); return a ? { email:a.email || '', planUsage:!!a.planUsage } : null; };
const isPending = () => !!(pending && Date.now() - pending.createdAt < 15*60*1000);
const lastErr = () => lastError;
function status(){
  const a = publicAccount();
  return { state: isPending() ? 'pending' : a ? 'connected' : lastError ? 'error' : 'none', email:a ? a.email : '', planUsage:a ? a.planUsage : false, error:lastError };
}

function start({ port, consent }){
  const verifier = b64u(crypto.randomBytes(48));
  const challenge = b64u(crypto.createHash('sha256').update(verifier).digest());
  const state = b64u(crypto.randomBytes(24)), nonce = b64u(crypto.randomBytes(24));
  const redirect_uri = `http://127.0.0.1:${port}/auth/callback`;   // must be 127.0.0.1, not localhost
  const reauth = !!auth.client_id;
  const q = new URLSearchParams({
    client_id: reauth ? auth.client_id : 'dynamic_agent_client', response_type:'code', redirect_uri, scope:SCOPE, resource:RESOURCE,
    state, nonce, code_challenge:challenge, code_challenge_method:'S256', ext_agent_host_id:hostId()
  });
  if(!reauth) q.set('agent_name_hint',APP_NAME);
  else{
    if(auth.account && auth.account.id_token) q.set('id_token_hint',auth.account.id_token);
    if(auth.account && auth.account.email) q.set('login_hint',auth.account.email);
    if(consent) q.set('prompt','consent');
  }
  pending = { state, nonce, verifier, redirect_uri, reauth, client_id:auth.client_id || null, createdAt:Date.now() };
  lastError = '';
  return { url: AUTHORIZE + '?' + q.toString() };
}

async function tokenRequest(form){
  const up = await doFetch(TOKEN,{ method:'POST', headers:{ 'content-type':'application/x-www-form-urlencoded', accept:'application/json' }, body:new URLSearchParams(form).toString() });
  let j = {}; try{ j = await up.json(); }catch(e){}
  if(!up.ok){
    const code = typeof j.error==='string' ? j.error : (j.error && j.error.code) || '';
    throw new ProviderError(up.status,`${code || 'error'}${j.error_description ? ': '+j.error_description : ''}`,{ code });
  }
  return j;
}
async function findKey(kid){
  const load = async () => { const up = await doFetch(JWKS); if(!up.ok) throw await providerError(up); jwksCache = { at:Date.now(), keys:(await up.json()).keys || [] }; };
  if(!jwksCache || Date.now() - jwksCache.at > 10*60*1000) await load();
  let k = jwksCache.keys.find(x=>x.kid===kid);
  if(!k){ await load(); k = jwksCache.keys.find(x=>x.kid===kid); }
  if(!k) throw new Error('The ID token was signed with a key OpenAI doesn’t publish.');
  return k;
}
async function verifyIdToken(jwt,{ clientId, nonce }){
  const parts = String(jwt || '').split('.');
  if(parts.length!==3) throw new Error('OpenAI returned no usable ID token.');
  let header, claims;
  try{ header = JSON.parse(Buffer.from(parts[0],'base64url').toString()); claims = JSON.parse(Buffer.from(parts[1],'base64url').toString()); }
  catch(e){ throw new Error('The ID token couldn’t be read.'); }
  if(header.alg!=='RS256') throw new Error('The ID token uses an unexpected signature type.');
  const jwk = await findKey(header.kid);
  const ok = crypto.verify('sha256',Buffer.from(parts[0]+'.'+parts[1]),crypto.createPublicKey({ key:jwk, format:'jwk' }),Buffer.from(parts[2],'base64url'));
  if(!ok) throw new Error('The ID token’s signature didn’t verify.');
  if(claims.iss!==ISSUER) throw new Error('The ID token came from an unexpected issuer.');
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if(!aud.includes(clientId)) throw new Error('The ID token was issued for a different client.');
  if(!claims.exp || claims.exp*1000 < Date.now()) throw new Error('The ID token has expired.');
  if(claims.nonce!==nonce) throw new Error('The ID token’s nonce didn’t match this sign-in.');
  if(!claims.sub) throw new Error('The ID token has no subject.');
  return claims;
}

async function callback(params){
  const p = pending;
  const fail = (msg) => { lastError = msg; pending = null; return { ok:false, message:msg }; };
  if(!p) return { ok:false, message:'No sign-in was in progress. Start again from Cascade.' };
  if(params.get('state')!==p.state) return fail('The sign-in response didn’t match the request. Try again.');
  if(Date.now() - p.createdAt > 15*60*1000) return fail('That sign-in link expired. Try again.');
  const err = params.get('error');
  if(err) return fail(err==='access_denied' ? 'You declined. Cascade needs your permission to use your ChatGPT plan.' : `OpenAI returned an error: ${params.get('error_description') || err}`);
  const code = params.get('code'); if(!code) return fail('OpenAI didn’t return a sign-in code.');
  let clientId = p.client_id; const issued = params.get('client_id');
  if(!p.reauth){
    if(!issued) return fail('OpenAI didn’t return a client ID, so registration is incomplete. Try again.');
    clientId = issued; auth.client_id = issued; write();   // kept so a retry reuses it instead of registering again
  } else if(issued && issued!==clientId) return fail('OpenAI returned a different client ID than the one saved. Sign out and start again.');
  try{
    let tok;
    try{ tok = await tokenRequest({ grant_type:'authorization_code', client_id:clientId, code, code_verifier:p.verifier, redirect_uri:p.redirect_uri, resource:RESOURCE }); }
    catch(e){ if(e.code==='invalid_grant') return fail('That sign-in code expired. Cascade kept your registration, so just try again.'); throw e; }
    const claims = await verifyIdToken(tok.id_token,{ clientId, nonce:p.nonce });
    if(p.reauth && auth.account && auth.account.subject && auth.account.subject!==claims.sub) return fail('That’s a different ChatGPT account than the one saved. Sign out first to switch.');
    const scopes = String(tok.scope || params.get('scope') || '').split(/\s+/).filter(Boolean);
    auth.account = {
      email:claims.email || '', subject:claims.sub, client_id:clientId, id_token:tok.id_token, access_token:tok.access_token,
      refresh_token:tok.refresh_token || (auth.account && auth.account.refresh_token) || '', token_type:tok.token_type || 'Bearer',
      expires_at:Date.now() + (+tok.expires_in || 3600)*1000, scopes, planUsage:scopes.includes(PLAN_SCOPE), saved_at:new Date().toISOString()
    };
    write(); pending = null; lastError = '';
    return { ok:true, planUsage:auth.account.planUsage, email:auth.account.email };
  }catch(e){ return fail(e.message || 'Sign-in failed.'); }
}

function refresh(){
  if(refreshing) return refreshing;   // serialize: refresh tokens rotate, so two refreshes would race
  refreshing = (async()=>{
    try{
      const a = auth.account;
      if(!a || !a.refresh_token) throw new ProviderError(401,'Sign in with ChatGPT first.');
      try{
        const tok = await tokenRequest({ grant_type:'refresh_token', client_id:a.client_id, refresh_token:a.refresh_token, resource:RESOURCE });
        a.access_token = tok.access_token;
        if(tok.refresh_token) a.refresh_token = tok.refresh_token;
        if(tok.id_token) a.id_token = tok.id_token;
        a.expires_at = Date.now() + (+tok.expires_in || 3600)*1000;
        if(tok.scope){ a.scopes = String(tok.scope).split(/\s+/).filter(Boolean); a.planUsage = a.scopes.includes(PLAN_SCOPE); }
        write();
      }catch(e){
        if(e.code && UNUSABLE.has(e.code)){
          a.access_token = ''; a.refresh_token = ''; write();
          lastError = 'Your ChatGPT session ended. Sign in again.';
          throw new ProviderError(401,lastError);
        }
        throw e;   // network or server trouble: keep the credentials
      }
    } finally { refreshing = null; }
  })();
  return refreshing;
}
async function accessToken(force){
  const a = account();
  if(!a || !a.access_token) throw new ProviderError(401,'Sign in with ChatGPT first.');
  if(!force && a.expires_at - Date.now() > 120000) return a.access_token;
  await refresh();
  return auth.account.access_token;
}

const FRIENDLY = {
  subscription_sharing_usage_limit_exceeded:[429,'Your ChatGPT plan’s usage limit for apps has been reached. Check ChatGPT Settings → Usage, then try again later.'],
  subscription_sharing_user_not_eligible:[403,'ChatGPT plan usage isn’t available for this account or workspace.'],
  subscription_sharing_usage_unavailable:[503,'ChatGPT couldn’t check your usage right now. Try again shortly.'],
  subscription_sharing_unsupported_capability:[400,'ChatGPT plan usage doesn’t support something in this request'],
  subscription_sharing_route_not_supported:[403,'ChatGPT plan usage doesn’t allow that endpoint.'],
  subscription_sharing_invalid_user:[401,'ChatGPT didn’t accept this sign-in. Sign in again.'],
  subscription_sharing_user_unavailable:[503,'ChatGPT couldn’t load your account right now. Try again shortly.']
};
async function responsesError(up){
  let j = {}; try{ j = JSON.parse(await up.text()); }catch(e){}
  const er = j.error || {}, code = typeof er==='object' ? er.code : '';
  if(code && FRIENDLY[code]){
    const [status,msg] = FRIENDLY[code];
    return new ProviderError(up.status || status,msg + (code==='subscription_sharing_unsupported_capability' && er.param ? ` (${er.param})` : ''),{ code });
  }
  if(up.status===401) return new ProviderError(401,'ChatGPT didn’t accept the sign-in. Sign in again.');
  const msg = (typeof er==='object' && er.message) || (typeof er==='string' && er) || j.detail || j.message || ('HTTP '+up.status);
  return new ProviderError(up.status,String(msg).slice(0,300),{ code });
}
// Stream-only, store:false, no temperature or max_output_tokens: the preview rejects those.
async function streamResponses(cfg,o,onDelta){
  const body = { model:cfg.model, instructions:INSTRUCTIONS, input:[{ type:'message', role:'user', content:[{ type:'input_text', text:o.prompt }] }], store:false, stream:true };
  for(let attempt=0; attempt<2; attempt++){
    const token = await accessToken(attempt>0);
    const up = await doFetch(API_BASE + '/responses',{ method:'POST', signal:o.signal,
      headers:{ 'content-type':'application/json', authorization:'Bearer '+token, accept:'text/event-stream' }, body:JSON.stringify(body) });
    if(up.status===401 && attempt===0){ await up.text().catch(()=>''); continue; }
    if(!up.ok) throw await responsesError(up);
    let got = 0, completed = false;
    for await (const d of sseData(up.body)){
      if(d==='[DONE]') break;
      let ev; try{ ev = JSON.parse(d); }catch(e){ continue; }
      if(ev.type==='response.output_text.delta' && typeof ev.delta==='string' && ev.delta){ got++; onDelta(ev.delta); }
      else if(ev.type==='response.completed') completed = true;
      else if(ev.type==='response.failed' || ev.type==='error'){
        const er = (ev.response && ev.response.error) || ev.error || ev, f = FRIENDLY[er.code];
        throw new ProviderError(f ? f[0] : 502,f ? f[1] : String(er.message || 'The response failed.').slice(0,300),{ code:er.code });
      }
    }
    if(!completed && !got) throw new ProviderError(502,'The stream ended before the response completed.');
    if(!got) throw new ProviderError(502,NO_TEXT);
    return;
  }
}
async function listModels(){
  for(let attempt=0; attempt<2; attempt++){
    const token = await accessToken(attempt>0);
    const up = await doFetch(API_BASE + '/models',{ headers:{ authorization:'Bearer '+token } });
    if(up.status===401 && attempt===0){ await up.text().catch(()=>''); continue; }
    if(!up.ok) throw await responsesError(up);
    const j = await up.json(), all = j.models || j.data || [];
    const shown = all.filter(m=>m.visibility==='list'), use = shown.length ? shown : all;
    return [...new Set(use.map(m=>m.slug || m.id).filter(Boolean))].sort();
  }
}
async function signOut(){
  const a = auth.account; let revoked = false;
  if(a && a.refresh_token){
    try{
      let ep = AUTH_BASE + '/api/accounts/oauth/revoke';
      try{ const d = await (await doFetch(DISCOVERY)).json(); if(d.revocation_endpoint) ep = d.revocation_endpoint; }catch(e){}
      const up = await doFetch(ep,{ method:'POST', headers:{ 'content-type':'application/x-www-form-urlencoded' }, body:new URLSearchParams({ token:a.refresh_token, token_type_hint:'refresh_token', client_id:a.client_id }).toString() });
      revoked = up.ok;
    }catch(e){}
  }
  // keep the registration and host id so the next sign-in reuses them; drop every token
  auth.account = a ? { email:a.email, subject:a.subject, client_id:a.client_id, id_token:a.id_token } : null;
  write(); pending = null; lastError = '';
  return { revoked };
}
module.exports = { API_BASE, account, publicAccount, isPending, lastError:lastErr, status, start, callback, streamResponses, listModels, signOut };
