'use strict';
// Reads the anonymous usage counts from Cloudflare Workers Analytics Engine and shapes them for the dashboard.
// Pure functions plus one fetch wrapper, so the shaping can be tested without a network.

const PROVIDER_LABEL = { anthropic:'Claude (Anthropic)', openai:'OpenAI (GPT / ChatGPT models)', openrouter:'OpenRouter', custom:'Custom endpoint', demo:'Demo' };
const dataset = (env) => env==='dev' ? 'cascade_events_dev' : 'cascade_events';

// One SQL string per question. _sample_interval corrects for sampling, so sums stay right when traffic is high.
function queries(env,days){
  const D = dataset(env), W = `timestamp > NOW() - INTERVAL '${days}' DAY`;
  const BLOCKS = `blob1 IN ('block_created','block_approved','block_dismissed')`;
  return {
    visitsByDay:`SELECT toDate(timestamp) AS day, SUM(_sample_interval) AS visits, COUNT(DISTINCT index1) AS visitors FROM ${D} WHERE blob1='visit' AND ${W} GROUP BY day ORDER BY day`,
    blocksByDay:`SELECT toDate(timestamp) AS day, blob1 AS event, SUM(_sample_interval * double1) AS n FROM ${D} WHERE ${BLOCKS} AND ${W} GROUP BY day, event ORDER BY day`,
    blocksByType:`SELECT blob1 AS event, blob3 AS type, SUM(_sample_interval * double1) AS n FROM ${D} WHERE ${BLOCKS} AND ${W} GROUP BY event, type`,
    ai:`SELECT blob3 AS provider, SUM(_sample_interval) AS calls, SUM(IF(blob4='error',_sample_interval,0)) AS errors, COUNT(DISTINCT index1) AS users, AVG(double2) AS avg_ms FROM ${D} WHERE blob1='ai_call' AND ${W} GROUP BY provider ORDER BY calls DESC`,
    keys:`SELECT blob3 AS provider, COUNT(DISTINCT index1) AS users FROM ${D} WHERE blob1='ai_key_saved' AND ${W} GROUP BY provider ORDER BY users DESC`,
    signins:`SELECT blob4 AS kind, SUM(_sample_interval) AS signins, COUNT(DISTINCT index1) AS people FROM ${D} WHERE blob1='signin' AND ${W} GROUP BY kind`,
    features:`SELECT blob1 AS event, blob3 AS label, blob4 AS outcome, SUM(_sample_interval) AS times FROM ${D} WHERE blob1 IN ('grow','bridge_result','ask','grill','domain_set','cascade_created','folder_created') AND ${W} GROUP BY event, label, outcome ORDER BY times DESC`,
    countries:`SELECT blob5 AS country, SUM(_sample_interval) AS visits FROM ${D} WHERE blob1='visit' AND ${W} GROUP BY country ORDER BY visits DESC LIMIT 12`,
    activeUsers:`SELECT COUNT(DISTINCT index1) AS users FROM ${D} WHERE blob6='1' AND ${W}`
  };
}

async function runSql({ account, token, sql, base = 'https://api.cloudflare.com/client/v4', fetchImpl = fetch }){
  const r = await fetchImpl(`${base}/accounts/${account}/analytics_engine/sql`,{ method:'POST', headers:{ authorization:'Bearer '+token }, body:sql+' FORMAT JSON' });
  const text = await r.text(); let j = null; try{ j = JSON.parse(text); }catch(e){}
  if(!r.ok || !j || j.success===false){
    const msg = j && j.errors && j.errors[0] && j.errors[0].message;
    const err = new Error(msg ? `${msg} (HTTP ${r.status})` : `HTTP ${r.status}`); err.status = r.status; throw err;
  }
  return j.data || [];
}

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const dayOf = (v) => String(v || '').slice(0,10);
// the last `days` UTC dates, oldest first, ending today
function lastDays(days,now = Date.now()){
  const out = []; const end = new Date(new Date(now).toISOString().slice(0,10)+'T00:00:00Z').getTime();
  for(let i=days-1;i>=0;i--) out.push(new Date(end - i*86400e3).toISOString().slice(0,10));
  return out;
}

const FEATURE_LABEL = {
  'grow:forward':'Grow branches','grow:back':'Trace back from a feeling','grow:bridge':'Bridge to a feeling','grow:chart':'Chart the map',
  'bridge_result:bridged':'Bridge: ends met','bridge_result:gap':'Bridge: gap found, grill started',
  ask:'Ask the graph', grill:'Grill me', cascade_created:'Cascades created', folder_created:'Folders created'
};
const featureLabel = (r) => r.event==='domain_set' ? `Domain: ${r.label}` : (FEATURE_LABEL[r.event + (r.label ? ':'+r.label : '')] || FEATURE_LABEL[r.event + (r.outcome ? ':'+r.outcome : '')] || r.event);

// rows: the result of each query, keyed like queries()
function shape(rows,{ env = 'prod', days = 7, now = Date.now() } = {}){
  const list = lastDays(days,now), idx = Object.fromEntries(list.map((d,i)=>[d,i]));
  const zeros = () => list.map(()=>0);
  const visits = zeros(), visitors = zeros(), created = zeros(), approved = zeros(), dismissed = zeros();
  for(const r of rows.visitsByDay || []){ const i = idx[dayOf(r.day)]; if(i!==undefined){ visits[i] = n(r.visits); visitors[i] = n(r.visitors); } }
  const bucket = { block_created:created, block_approved:approved, block_dismissed:dismissed };
  for(const r of rows.blocksByDay || []){ const i = idx[dayOf(r.day)]; if(i!==undefined && bucket[r.event]) bucket[r.event][i] = n(r.n); }

  const types = {};
  for(const r of rows.blocksByType || []){ const t = r.type || 'other'; (types[t] = types[t] || { type:t, created:0, approved:0, dismissed:0 }); const k = { block_created:'created', block_approved:'approved', block_dismissed:'dismissed' }[r.event]; if(k) types[t][k] += n(r.n); }
  const blocksByType = Object.values(types).sort((a,b)=>(b.created+b.approved+b.dismissed)-(a.created+a.approved+a.dismissed));

  const ai = (rows.ai || []).map(r=>({ provider:r.provider, label:PROVIDER_LABEL[r.provider] || r.provider || 'Unknown', calls:n(r.calls), errors:n(r.errors), users:n(r.users), avgMs:Math.round(n(r.avg_ms)) }));
  const keys = (rows.keys || []).map(r=>({ provider:r.provider, label:PROVIDER_LABEL[r.provider] || r.provider, users:n(r.users) }));
  const features = (rows.features || []).map(r=>({ key:[r.event,r.label,r.outcome].join('|'), label:featureLabel(r), times:n(r.times) })).sort((a,b)=>b.times-a.times);
  const countries = (rows.countries || []).filter(r=>r.country).map(r=>({ country:r.country, visits:n(r.visits) }));
  const si = Object.fromEntries((rows.signins || []).map(r=>[r.kind,r]));
  const sum = (a) => a.reduce((s,x)=>s+x,0);
  const kept = sum(approved), dropped = sum(dismissed);
  const calls = sum(ai.map(a=>a.calls));
  return {
    env, days, dates:list, generatedAt:new Date(now).toISOString(),
    series:{ visits, visitors, created, approved, dismissed },
    totals:{
      visits:sum(visits), visitors:sum(visitors), created:sum(created), approved:kept, dismissed:dropped,
      keptRate:kept+dropped ? kept/(kept+dropped) : null,
      aiCalls:calls, aiErrors:sum(ai.map(a=>a.errors)), aiErrorRate:calls ? sum(ai.map(a=>a.errors))/calls : null,
      activeUsers:n(((rows.activeUsers || [])[0] || {}).users),
      signins:n((si.new || {}).signins) + n((si.returning || {}).signins), newSignins:n((si.new || {}).signins)
    },
    blocksByType, ai, keys, features, countries
  };
}

async function loadStats({ env, days, account, token, base, fetchImpl, now }){
  const q = queries(env,days), keys = Object.keys(q);
  const results = await Promise.all(keys.map(k=>runSql({ account, token, sql:q[k], base, fetchImpl })));
  return shape(Object.fromEntries(keys.map((k,i)=>[k,results[i]])),{ env, days, now });
}

module.exports = { queries, runSql, shape, lastDays, loadStats, PROVIDER_LABEL, dataset };
