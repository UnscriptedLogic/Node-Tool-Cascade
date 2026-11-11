// Anonymous usage counts, written to Cloudflare Workers Analytics Engine. No cookies, no accounts, no content.
//
// What is recorded: an event name from a fixed list, a few small labels from fixed lists (a block type, an AI provider, a domain),
// the country the request came from, and a one-way hash used only to count unique people. What is never recorded: tree text,
// prompts, keys, names, emails, IP addresses or user agents (they only go into a hash). Anything not on the lists is dropped.
// Signed-out visitors get a hash that changes every day, so they cannot be followed across days. Signed-in people get one stable
// one-way ID (their account id, hashed with a server secret), so "users of Claude this month" can be counted. It cannot be
// turned back into an account.
//
// Row layout (query it with SQL, see scripts/analytics-report.js):
//   blob1 event   blob2 environment   blob3 label   blob4 outcome   blob5 country   blob6 signed in ("1" or "0")
//   double1 count (blocks in one action)   double2 milliseconds   index1 daily visitor hash

const BLOCKS = ['loop','question','answer','emotion','consequence','decision','fog'];
const PROVIDERS = ['openrouter','anthropic','openai','custom','demo'];
const DOMAINS = ['general','product','research','game'];
// event -> { label: allowed values or null for none, outcome: allowed values or null }
export const EVENTS = {
  // sent by the page
  block_created:{ label:BLOCKS },                 // a person placed a block
  block_approved:{ label:BLOCKS, count:true },    // a person kept AI suggestions
  block_dismissed:{ label:BLOCKS, count:true },   // a person dismissed AI suggestions
  grow:{ label:['forward','back','bridge','chart'] },
  bridge_result:{ label:null, outcome:['bridged','gap'] },
  ask:{ label:null },
  grill:{ label:null },
  domain_set:{ label:DOMAINS },
  // recorded by the server itself
  visit:{ label:null },
  signin:{ label:null, outcome:['new','returning'] },
  ai_call:{ label:PROVIDERS, outcome:['ok','error'] },
  ai_key_saved:{ label:PROVIDERS },
  cascade_created:{ label:null },
  folder_created:{ label:null },
  account_deleted:{ label:null }
};
export const CLIENT_EVENTS = ['block_created','block_approved','block_dismissed','grow','bridge_result','ask','grill','domain_set'];

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');

// People who ask not to be measured are not measured.
export const optedOut = (request) => request.headers.get('dnt')==='1' || request.headers.get('sec-gpc')==='1';

// Signed-in people: a stable one-way ID. Nothing in the data points back to the account without the server secret.
export async function userHash(env,uid){ return hex(await crypto.subtle.digest('SHA-256',enc.encode(['cascade-user',env.KEY_SECRET || 'cascade',uid].join('|')))).slice(0,32); }

// A hash of (secret, day, address, browser). Stored, but the inputs are not, and tomorrow's hash is different.
async function visitorHash(request,env,now){
  const day = new Date(now).toISOString().slice(0,10);
  const raw = [env.KEY_SECRET || 'cascade', 'analytics', day, request.headers.get('cf-connecting-ip') || '', request.headers.get('user-agent') || ''].join('|');
  return hex(await crypto.subtle.digest('SHA-256',enc.encode(raw))).slice(0,32);
}

// Checks a name and its labels against the lists. Returns a clean event, or null.
export function clean(name,o){
  const spec = EVENTS[name]; if(!spec) return null;
  o = o && typeof o==='object' ? o : {};
  const label = spec.label ? (spec.label.includes(o.label) ? o.label : '') : '';
  if(spec.label && !label) return null;
  const outcome = spec.outcome ? (spec.outcome.includes(o.outcome) ? o.outcome : '') : '';
  if(spec.outcome && !outcome) return null;
  const count = spec.count ? Math.min(Math.max(Math.round(+o.count || 1),1),99) : 1;
  const ms = Number.isFinite(+o.ms) ? Math.min(Math.max(Math.round(+o.ms),0),600000) : 0;
  return { name, label, outcome, count, ms };
}

// Writes one data point. Never throws: measuring must not break the app.
export async function record(env,request,name,o = {},ctx = {}){
  try{
    if(!env.ANALYTICS || optedOut(request)) return false;
    const e = clean(name,o); if(!e) return false;
    const now = ctx.now ? ctx.now() : Date.now();
    env.ANALYTICS.writeDataPoint({
      blobs:[e.name, env.ENV_NAME || 'prod', e.label, e.outcome, (request.cf && request.cf.country) || '', ctx.signedIn ? '1' : '0'],
      doubles:[e.count, e.ms],
      indexes:[ctx.visitor || await visitorHash(request,env,now)]
    });
    return true;
  }catch(err){ return false; }
}

// POST /api/event from the page: { name, label?, outcome?, count? }. Always answers 204 so the page never waits on it.
export async function handleEvent(request,env,{ signedIn, visitor, now }){
  let b = null; try{ b = await request.json(); }catch(e){}
  if(b && CLIENT_EVENTS.includes(b.name)) await record(env,request,b.name,{ label:b.label, outcome:b.outcome, count:b.count },{ signedIn, visitor, now });
  return new Response(null,{ status:204, headers:{ 'cache-control':'no-store' } });
}

// Adds Cloudflare Web Analytics (cookieless page-view counting) to the page, unless the visitor asked not to be measured.
export function withBeacon(response,request,env){
  const token = env.CF_BEACON_TOKEN;
  if(!token || optedOut(request) || !(response.headers.get('content-type') || '').includes('text/html') || typeof HTMLRewriter==='undefined') return response;
  return new HTMLRewriter().on('body',{ element(el){
    el.append(`<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token })}'></script>`,{ html:true });
  } }).transform(response);
}
