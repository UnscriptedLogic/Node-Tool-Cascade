'use strict';
// Model calls: list models, test a provider, and stream a completion for the page.
const settings = require('../lib/settings');
const chatgpt = require('../lib/chatgpt');
const providers = require('../lib/providers');
const { HttpError, ProviderError, clamp, str } = require('../lib/util');
const { json, readJSON } = require('../http');

// credentials typed into Settings but not saved yet
const over = (b) => ({ key:str(b.key,500), model:str(b.model,200), baseUrl:str(b.baseUrl,300) });

module.exports = (r) => {
  r.post('/api/models',async({ req, res }) => {
    const b = await readJSON(req);
    if(!settings.NAMES.includes(b.provider) || b.provider==='demo') throw new HttpError(400,'Unknown provider');
    const o = over(b), cfg = settings.resolveProvider(b.provider,{ key:o.key, baseUrl:o.baseUrl });
    if(cfg.name==='chatgpt'){ if(!chatgpt.account()) throw new HttpError(400,'Sign in with ChatGPT first.'); }
    else{
      if(cfg.name!=='custom' && cfg.name!=='openrouter' && !cfg.key) throw new HttpError(400,'Add an API key first.');   // OpenRouter lists models without a key
      if(!cfg.base) throw new HttpError(400,'Enter a base URL first.');
    }
    try{ json(res,200,{ models:await providers.listModels(cfg) }); }
    catch(e){ if(e instanceof ProviderError) return json(res,502,{ error:'upstream', detail:e.message }); throw e; }
  });

  r.post('/api/test',async({ req, res }) => {
    const b = await readJSON(req);
    if(!settings.NAMES.includes(b.provider)) throw new HttpError(400,'Unknown provider');
    const cfg = settings.resolveProvider(b.provider,over(b)), why = settings.problem(cfg);
    if(why) return json(res,200,{ ok:false, error:why });
    const t0 = Date.now(); let reply = '';
    try{
      await providers.streamModel(cfg,{ prompt:'Reply with the single word OK.', maxTokens:400 },t => { reply += t; });
      json(res,200,{ ok:true, ms:Date.now()-t0, reply:reply.trim().slice(0,60) });
    }catch(e){
      if(e instanceof ProviderError) return json(res,200,{ ok:false, status:e.status, error:e.message });
      throw e;
    }
  });

  r.post('/api/sample',async({ req, res }) => {
    const b = await readJSON(req);
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
      start(); res.end();
    }catch(e){
      if(e && e.name==='AbortError'){ try{ res.end(); }catch(x){} return; }
      if(!(e instanceof ProviderError)) throw e;
      console.error('Provider error',e.status,e.message);
      if(!started) return json(res,e.status===401||e.status===403 ? 401 : e.status===429 ? 429 : 502,{ error:'upstream', detail:e.message });
      res.write('data: ' + JSON.stringify({ error:e.message }) + '\n\n'); res.end();
    }
  });
};
