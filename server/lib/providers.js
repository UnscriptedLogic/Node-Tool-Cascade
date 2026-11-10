'use strict';
// Provider adapters. Each one turns a prompt into a stream of text deltas.
const { ProviderError, doFetch, providerError, sseData, clamp } = require('./util');
const chatgpt = require('./chatgpt');
const settings = require('./settings');

const NO_TEXT = 'The model returned no text. It may have spent its whole token budget on reasoning. Try a non-reasoning model.';

async function streamAnthropic(cfg,o,onDelta){
  const body = { model:cfg.model, max_tokens:o.maxTokens, stream:true, messages:[{ role:'user', content:o.prompt }] };
  if(typeof o.temperature==='number') body.temperature = clamp(o.temperature,0,1);
  for(let attempt=0; attempt<3; attempt++){
    const up = await doFetch(cfg.base + '/v1/messages',{
      method:'POST', signal:o.signal,
      headers:{ 'content-type':'application/json','x-api-key':cfg.key,'anthropic-version':'2023-06-01' },
      body:JSON.stringify(body)
    });
    if(!up.ok){
      const err = await providerError(up);
      if('temperature' in body && /temperature/i.test(err.message)){ delete body.temperature; continue; }
      throw err;
    }
    let got = 0;
    for await (const d of sseData(up.body)){
      let ev; try{ ev = JSON.parse(d); }catch(e){ continue; }
      if(ev.type==='content_block_delta' && ev.delta && ev.delta.type==='text_delta' && ev.delta.text){ got++; onDelta(ev.delta.text); }
      else if(ev.type==='error') throw new ProviderError(502,(ev.error && ev.error.message) || 'The provider reported a stream error.');
    }
    if(!got) throw new ProviderError(502,NO_TEXT);
    return;
  }
}
// Chat Completions format: OpenAI, OpenRouter, and anything OpenAI-compatible (Ollama, LM Studio, Groq...).
async function streamOpenAI(cfg,o,onDelta){
  let official = false; try{ official = new URL(cfg.base).hostname === 'api.openai.com'; }catch(e){}
  let tokenParam = official ? 'max_completion_tokens' : 'max_tokens';
  const body = { model:cfg.model, stream:true, messages:[{ role:'user', content:o.prompt }] };
  body[tokenParam] = official ? Math.max(o.maxTokens,4000) : o.maxTokens;   // reasoning models spend tokens thinking
  if(typeof o.temperature==='number') body.temperature = clamp(o.temperature,0,2);
  const headers = Object.assign({ 'content-type':'application/json' },(cfg.extra && cfg.extra.headers) || {});
  if(cfg.key) headers.authorization = 'Bearer ' + cfg.key;
  for(let attempt=0; attempt<4; attempt++){
    const up = await doFetch(cfg.base + '/chat/completions',{ method:'POST', signal:o.signal, headers, body:JSON.stringify(body) });
    if(!up.ok){
      const err = await providerError(up), m = err.message;
      if(up.status===400){
        // newer models reject temperature, and disagree about max_tokens vs max_completion_tokens
        if('temperature' in body && /temperature/i.test(m)){ delete body.temperature; continue; }
        if(tokenParam==='max_tokens' && /max_completion_tokens/i.test(m)){ body.max_completion_tokens = body.max_tokens; delete body.max_tokens; tokenParam = 'max_completion_tokens'; continue; }
        if(tokenParam==='max_completion_tokens' && /max_tokens/i.test(m) && !/max_completion_tokens/i.test(m)){ body.max_tokens = body.max_completion_tokens; delete body.max_completion_tokens; tokenParam = 'max_tokens'; continue; }
      }
      throw err;
    }
    let got = 0;
    for await (const d of sseData(up.body)){
      if(d==='[DONE]') break;
      let ev; try{ ev = JSON.parse(d); }catch(e){ continue; }
      if(ev.error) throw new ProviderError(502,(ev.error.message || String(ev.error)).slice(0,300));
      const c = ev.choices && ev.choices[0] && ev.choices[0].delta && ev.choices[0].delta.content;
      if(typeof c==='string' && c){ got++; onDelta(c); }
    }
    if(!got) throw new ProviderError(502,NO_TEXT);
    return;
  }
  throw new ProviderError(400,'The provider rejected the request parameters.');
}
const streamModel = (cfg,o,onDelta) =>
  cfg.kind==='anthropic' ? streamAnthropic(cfg,o,onDelta)
  : cfg.kind==='responses' ? chatgpt.streamResponses(cfg,o,onDelta)
  : streamOpenAI(cfg,o,onDelta);

async function listModels(cfg){
  if(cfg.kind==='responses') return chatgpt.listModels();
  const headers = cfg.kind==='anthropic' ? { 'x-api-key':cfg.key, 'anthropic-version':'2023-06-01' } : (cfg.key ? { authorization:'Bearer '+cfg.key } : {});
  const url = cfg.kind==='anthropic' ? cfg.base + '/v1/models?limit=1000' : cfg.base + '/models';
  const up = await doFetch(url,{ headers });
  if(!up.ok) throw await providerError(up);
  const j = await up.json();
  let rows = j.data || j.models || [];
  if(cfg.name==='openrouter') rows = rows.slice().sort((a,b)=>(b.created || 0)-(a.created || 0));   // newest first
  let ids = rows.map(m => typeof m==='string' ? m : (m.id || m.name)).filter(Boolean);
  if(cfg.name==='openai' && /api\.openai\.com/.test(cfg.base)){
    ids = ids.filter(id => /^(gpt|chatgpt|o\d)/.test(id) && !/(instruct|audio|realtime|image|transcribe|tts|search|embedding|moderation|whisper|dall)/i.test(id));
  }
  ids = [...new Set(ids)];
  return cfg.name==='openrouter' ? ids : ids.sort();
}
// OpenRouter sign-in: trade the one-time code (and PKCE verifier) for a user-controlled API key.
async function exchangeOpenRouter(code,verifier){
  const base = settings.resolveProvider('openrouter').base;
  const up = await doFetch(base + '/auth/keys',{ method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ code, code_verifier:verifier, code_challenge_method:'S256' }) });
  if(!up.ok) throw await providerError(up);
  const j = await up.json();
  if(!j.key) throw new ProviderError(502,'OpenRouter did not return a key.');
  return j.key;
}
module.exports = { streamModel, listModels, exchangeOpenRouter };
