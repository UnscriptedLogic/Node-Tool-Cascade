'use strict';
// Small shared helpers: errors, fetch wrapper, SSE reader.
const path = require('path');

// Where tree.json, settings.json and chatgpt-auth.json live. Defaults to the repo folder.
const DATA_DIR = process.env.CASCADE_DATA_DIR ? path.resolve(process.env.CASCADE_DATA_DIR) : path.resolve(__dirname,'..','..');

class HttpError extends Error { constructor(status,message){ super(message); this.status = status; } }
class ProviderError extends Error { constructor(status,message,extra){ super(message); this.status = status; Object.assign(this,extra || {}); } }

const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const str = (v,max) => typeof v==='string' ? v.trim().slice(0,max) : '';

async function doFetch(url,opts){
  try{ return await fetch(url,opts); }
  catch(e){
    if(e && e.name==='AbortError') throw e;
    const c = e && e.cause && (e.cause.code || e.cause.message);
    let host = url; try{ host = new URL(url).host; }catch(x){}
    throw new ProviderError(502,`Could not reach ${host}${c ? ' ('+c+')' : ''}.`);
  }
}
async function providerError(up){
  let msg = '';
  try{
    const t = await up.text();
    try{ const j = JSON.parse(t); msg = (j.error && (j.error.message || j.error)) || j.message || j.detail || t; }catch(e){ msg = t; }
  }catch(e){}
  if(typeof msg!=='string') msg = JSON.stringify(msg);
  return new ProviderError(up.status,(msg || ('HTTP '+up.status)).slice(0,400));
}
// Yields the payload of each `data:` line in a server-sent-event stream.
async function* sseData(body){
  const dec = new TextDecoder(); let buf = '';
  for await (const chunk of body){
    buf += dec.decode(chunk,{ stream:true });
    let i;
    while((i = buf.indexOf('\n')) >= 0){
      const line = buf.slice(0,i).replace(/\r$/,''); buf = buf.slice(i+1);
      if(line.startsWith('data:')) yield line.slice(5).trim();
    }
  }
}
module.exports = { DATA_DIR, HttpError, ProviderError, clamp, str, doFetch, providerError, sseData };
