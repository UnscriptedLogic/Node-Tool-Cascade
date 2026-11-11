'use strict';
// Shared setup for the Worker tests: a Worker wired to SQLite-as-D1, a fake Google signer, and a request helper.
const { createD1 } = require('./d1');
const CLIENT = 'cascade-test.apps.googleusercontent.com';
const ORIGIN = 'https://cascade.example';
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const tree = () => JSON.stringify({ nodes:{ n1:{ id:'n1', type:'loop', text:'Root', parent:null } }, order:['n1'], links:[], seq:1 });

async function signer(kid = 'k1'){
  const pair = await crypto.subtle.generateKey({ name:'RSASSA-PKCS1-v1_5', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256' },true,['sign','verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk',pair.publicKey)), kid, alg:'RS256', use:'sig' };
  const sign = async (claims,header = {}) => {
    const h = b64u(JSON.stringify({ alg:'RS256', kid, typ:'JWT', ...header })), p = b64u(JSON.stringify(claims));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(h+'.'+p));
    return h+'.'+p+'.'+b64u(sig);
  };
  return { jwk, sign };
}

async function setup(){
  const worker = await import('../../worker/src/index.js'), auth = await import('../../worker/src/auth.js');
  auth.resetKeyCache();
  const good = await signer(), db = createD1();
  let n = 0, clock = 1_700_000_000_000;
  const deps = { fetchImpl:async()=>({ ok:true, json:async()=>({ keys:[good.jwk] }) }), newId:()=>'id-'+(++n), now:()=>clock };
  const KEY_SECRET = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  const env = { DB:db, GOOGLE_CLIENT_ID:CLIENT, KEY_SECRET, ASSETS:{ fetch:async(r)=>new Response('static:'+new URL(r.url).pathname) } };
  const claims = (o = {}) => ({ iss:'https://accounts.google.com', aud:CLIENT, sub:'g-1', email:'ada@example.com', email_verified:true, name:'Ada', exp:Math.floor(clock/1000)+3600, ...o });
  const call = async (method,path,{ body, cookie, headers } = {}) => {
    const req = new Request(ORIGIN+path,{ method, headers:{ 'content-type':'application/json', ...(cookie ? { cookie } : {}), ...headers }, body:body===undefined ? undefined : JSON.stringify(body) });
    const res = await worker.handleRequest(req,env,deps);
    const text = await res.text(); let j = null; try{ j = JSON.parse(text); }catch(e){}
    return { status:res.status, json:j, text, cookie:(res.headers.get('set-cookie') || '').split(';')[0] };
  };
  const signIn = async (o) => { const r = await call('POST','/api/auth/google',{ body:{ credential:await good.sign(claims(o)) } }); return r; };
  return { call, signIn, good, claims, db, deps, env, tick:(ms)=>{ clock += ms; }, env };
}


module.exports = { CLIENT, ORIGIN, tree, signer, setup };
