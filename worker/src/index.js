// Cascade on Cloudflare: Google sign-in, sessions, and the library API. Everything else is the static web app.
import library from '../../shared/library.js';
import { d1Store } from './d1store.js';
import { handleAi } from './ai.js';
import { handleAdmin, adminPage } from './admin.js';
import { record, handleEvent, withBeacon, userHash } from './analytics.js';
import { verifyGoogleToken, sha256Hex, newToken, readCookie, sessionCookie, SESSION_DAYS } from './auth.js';

const { handle, LibraryError } = library;
const json = (status,body,headers = {}) => new Response(JSON.stringify(body),{ status, headers:{ 'content-type':'application/json','cache-control':'no-store', ...headers } });

// Browsers send Origin on cross-site posts. Our own page sends the same origin, so anything else is refused.
const sameOrigin = (request) => { const o = request.headers.get('origin'); return !o || o===new URL(request.url).origin; };

export async function handleRequest(request,env,deps = {}){
  const url = new URL(request.url), path = url.pathname, method = request.method;
  const now = deps.now || (() => Date.now());
  const newId = deps.newId || (() => crypto.randomUUID());
  const store = d1Store(env.DB);

  if(!path.startsWith('/api/')){
    if(path==='/admin' || path==='/admin/') return adminPage(request,env);   // the dashboard page; its numbers need a sign-in
    if(!env.ASSETS) return json(404,{ error:'not_found' });
    const asset = await env.ASSETS.fetch(request);
    return method==='GET' ? withBeacon(asset,request,env) : asset;   // page-view counting, unless the visitor opted out
  }
  if(method!=='GET' && method!=='HEAD'){
    if(!sameOrigin(request)) return json(403,{ error:'forbidden' });
    if(!(request.headers.get('content-type') || '').includes('json')) return json(415,{ error:'JSON only' });
  }
  const bodyOf = async () => { try{ return await request.json(); }catch(e){ throw new LibraryError(400,'Bad JSON'); } };

  try{
    if(path==='/api/config'){
      await record(env,request,'visit',{},{ now });   // the page asks for this once per load
      return json(200,{ cloud:true, analytics:!!env.ANALYTICS, googleClientId:/^REPLACE/.test(env.GOOGLE_CLIENT_ID || '') ? '' : (env.GOOGLE_CLIENT_ID || '') });
    }

    if(path==='/api/auth/google' && method==='POST'){
      const b = await bodyOf();
      let g; try{ g = await verifyGoogleToken(b.credential,{ clientId:env.GOOGLE_CLIENT_ID, fetchImpl:deps.fetchImpl || fetch, now:now() }); }
      catch(e){ return json(401,{ error:'bad_token', detail:e.message }); }
      const t = now(), user = await store.upsertUser(g,newId(),t);
      await record(env,request,'signin',{ outcome:user.created_at===t ? 'new' : 'returning' },{ now, signedIn:true, visitor:await userHash(env,user.id) });
      const token = newToken();
      await store.createSession(user.id,await sha256Hex(token),now() + SESSION_DAYS*86400e3,now());
      return json(200,{ user:{ email:user.email, name:user.name, picture:user.picture } },{ 'set-cookie':sessionCookie(token) });
    }

    const token = readCookie(request);
    const user = token ? await store.userForSession(await sha256Hex(token),now()) : null;

    if(path==='/api/event' && method==='POST') return handleEvent(request,env,{ signedIn:!!user, visitor:user ? await userHash(env,user.id) : undefined, now });
    if(path.startsWith('/api/admin/')) return handleAdmin({ request, path, env, user, deps });
    if(path==='/api/auth/me') return json(200,{ user:user ? { email:user.email, name:user.name, picture:user.picture } : null });
    if(path==='/api/auth/logout' && method==='POST'){
      if(token) await store.deleteSession(await sha256Hex(token));
      return json(200,{ ok:true },{ 'set-cookie':sessionCookie('') });
    }
    if(path==='/api/auth/account' && method==='DELETE'){   // delete my account and everything saved in it
      if(!user) return json(401,{ error:'sign_in' });
      await record(env,request,'account_deleted',{},{ now, signedIn:true, visitor:await userHash(env,user.id) });
      await store.deleteUser(user.id); return json(200,{ ok:true },{ 'set-cookie':sessionCookie('') });
    }

    if(/^\/api\/(settings|models|test|sample|oauth\/openrouter)$/.test(path)){
      if(!user) return json(401,{ error:'sign_in', detail:'Sign in to use AI from your account.' });
      const res = await handleAi({ request, path, method, env, store, uid:user.id, bodyOf, now:now() });
      if(res) return res;
    }

    if(!/^\/api\/(library|folders|cascades)(\/|$)/.test(path)) return json(404,{ error:'not_found' });
    if(!user) return json(401,{ error:'sign_in', detail:'Sign in to use your library.' });
    const parts = path.split('/').filter(Boolean).slice(1);
    const out = await handle({ method, parts, body:method==='GET' || method==='DELETE' ? null : await bodyOf(), store, uid:user.id, deps:{ newId, now } });
    if(out && out.status===201 && !parts[1]) await record(env,request,parts[0]==='folders' ? 'folder_created' : 'cascade_created',{},{ now, signedIn:true, visitor:await userHash(env,user.id) });
    return out ? json(out.status,out.body) : json(404,{ error:'not_found' });
  }catch(e){
    if(e instanceof LibraryError) return json(e.status,{ error:'bad_request', detail:e.message });
    console.error(e);
    return json(500,{ error:'server_error' });
  }
}

export default { fetch:(request,env) => handleRequest(request,env) };
