'use strict';
// Sign-in flows for the local app: OpenRouter (code + PKCE) and ChatGPT (loopback callback).
const ctx = require('../context');
const settings = require('../lib/settings');
const chatgpt = require('../lib/chatgpt');
const providers = require('../lib/providers');
const { HttpError, ProviderError } = require('../lib/util');
const { json, readJSON, esc } = require('../http');

function callbackPage(r){
  const body = r.ok
    ? `<h1>You’re signed in${r.email ? ' as '+esc(r.email) : ''}.</h1><p>${r.planUsage ? 'Cascade can use your ChatGPT plan now.' : 'ChatGPT plan usage wasn’t allowed, so Cascade can’t use it yet. You can allow it from Settings.'}</p><p>You can close this tab and go back to Cascade.</p>`
    : `<h1>Sign-in didn’t finish</h1><p>${esc(r.message)}</p><p>Go back to Cascade and try again.</p>`;
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cascade</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;color:#16233a}h1{font-size:1.4rem}</style>${body}<script>try{setTimeout(function(){window.close()},2500)}catch(e){}</script>`;
}

module.exports = (r) => {
  r.post('/api/oauth/openrouter',async({ req, res }) => {
    const b = await readJSON(req);
    if(typeof b.code!=='string' || typeof b.verifier!=='string') throw new HttpError(400,'Missing code or verifier');
    try{ settings.setKey('openrouter',await providers.exchangeOpenRouter(b.code,b.verifier)); }
    catch(e){ if(e instanceof ProviderError) return json(res,502,{ error:'upstream', detail:e.message }); throw e; }
    json(res,200,ctx.pub());
  });
  r.post('/api/chatgpt/start',async({ req, res }) => {
    const b = await readJSON(req);
    json(res,200,chatgpt.start({ port:ctx.PORT, consent:!!b.consent }));
  });
  r.get('/api/chatgpt/status',({ res }) => json(res,200,chatgpt.status()));
  r.post('/api/chatgpt/signout',async({ res }) => { const out = await chatgpt.signOut(); json(res,200,Object.assign({ ok:true },out)); });
  r.get('/auth/callback',async({ res, url }) => {
    const out = await chatgpt.callback(url.searchParams);
    res.writeHead(out.ok ? 200 : 400,{ 'content-type':'text/html; charset=utf-8','cache-control':'no-store' });
    res.end(callbackPage(out));
  });
};
