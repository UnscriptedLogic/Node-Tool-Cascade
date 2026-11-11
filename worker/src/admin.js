// The admin dashboard, online: /admin (the page) and /api/admin/* (the numbers), for the people on an allowlist only.
//
// Who may look: a signed-in Google account whose email is in ADMIN_EMAILS (a comma-separated secret, so no address is in the repo).
// What it reads: the anonymous counts in Analytics Engine, through Cloudflare's SQL API with a read-only token held as a Worker
// secret (ANALYTICS_READ_TOKEN) next to the account id (CF_ACCOUNT_ID). The page only ever receives finished numbers.
import stats from '../../scripts/admin/stats.js';

const { loadStats } = stats;
const json = (status,body) => new Response(JSON.stringify(body),{ status, headers:{ 'content-type':'application/json','cache-control':'no-store','x-robots-tag':'noindex, nofollow' } });
const NEEDED = ['ADMIN_EMAILS','CF_ACCOUNT_ID','ANALYTICS_READ_TOKEN'];
const cache = new Map();   // env|days -> { at, stats }: a refresh within a minute is served from memory

export const adminEmails = (env) => String(env.ADMIN_EMAILS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
export const isAdmin = (env,user) => !!(user && user.email && adminEmails(env).includes(String(user.email).toLowerCase()));
const missing = (env) => NEEDED.filter(k=>!String(env[k] || '').trim());

// The page itself holds nothing private (it only draws what the API returns), so it comes from the static assets.
export async function adminPage(request,env){
  // the asset host maps /admin to admin.html; asking for /admin.html would redirect back here
  const asset = env.ASSETS ? await env.ASSETS.fetch(new Request(new URL('/admin',request.url),request)) : new Response('Not found',{ status:404 });
  const headers = new Headers(asset.headers); headers.set('x-robots-tag','noindex, nofollow'); headers.set('cache-control','no-store');
  return new Response(asset.body,{ status:asset.status, headers });
}

// GET /api/admin/status and /api/admin/stats. `user` is the signed-in account or null.
export async function handleAdmin({ request, path, env, user, deps = {} }){
  if(request.method!=='GET') return json(405,{ error:'method_not_allowed' });
  const url = new URL(request.url);
  if(path==='/api/admin/status'){
    const gone = missing(env);
    return json(200,{ online:true, configured:gone.length===0, missing:gone, signedIn:!!user, email:user ? user.email : '', allowed:isAdmin(env,user),
      googleClientId:/^REPLACE/.test(env.GOOGLE_CLIENT_ID || '') ? '' : (env.GOOGLE_CLIENT_ID || '') });
  }
  if(path==='/api/admin/stats'){
    if(!user) return json(401,{ error:'sign_in', detail:'Sign in with Google to open the dashboard.' });
    if(!isAdmin(env,user)) return json(403,{ error:'not_allowed', detail:`${user.email} is not on the admin list.` });
    const gone = missing(env); if(gone.length) return json(503,{ error:'not_configured', detail:'The server is missing: '+gone.join(', ')+'.' });
    const e = url.searchParams.get('env')==='dev' ? 'dev' : 'prod', days = Math.max(1,Math.min(365,+url.searchParams.get('days') || 7));
    const key = e+'|'+days, hit = cache.get(key), now = (deps.now || Date.now)();
    if(hit && now-hit.at<60000 && url.searchParams.get('fresh')!=='1') return json(200,hit.stats);
    try{
      const s = await loadStats({ env:e, days, account:env.CF_ACCOUNT_ID, token:env.ANALYTICS_READ_TOKEN, fetchImpl:deps.cfFetch || fetch, now });
      cache.set(key,{ at:now, stats:s }); return json(200,s);
    }catch(err){
      const denied = err.status===401 || err.status===403 || err.status===400;
      return json(502,{ error:denied ? 'bad_token' : 'upstream', detail:denied ? 'Cloudflare did not accept the read token. It needs Account > Account Analytics > Read, for this account.' : 'Could not read from Cloudflare: '+err.message });
    }
  }
  return json(404,{ error:'not_found' });
}
export const clearAdminCache = () => cache.clear();
