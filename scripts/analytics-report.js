#!/usr/bin/env node
'use strict';
// Prints how Cascade is being used, from the anonymous counts in Cloudflare Workers Analytics Engine.
//
//   CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... node scripts/analytics-report.js [--env prod|dev] [--days 7]
//
// The token needs the permission "Account > Account Analytics > Read". Page views from Cloudflare Web Analytics are in the
// Cloudflare dashboard (Analytics & Logs > Web Analytics); this report covers everything the app counts itself.
const args = process.argv.slice(2), arg = (n,d) => { const i = args.indexOf('--'+n); return i>=0 ? args[i+1] : d; };
const env = arg('env','prod'), days = Math.max(1,Math.min(365,+arg('days',7) || 7));
const DATASET = env==='dev' ? 'cascade_events_dev' : 'cascade_events';
const account = process.env.CLOUDFLARE_ACCOUNT_ID, token = process.env.CLOUDFLARE_API_TOKEN;
if(!account || !token){ console.error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (Account Analytics: Read).'); process.exit(1); }

const WHERE = `timestamp > NOW() - INTERVAL '${days}' DAY`;
// _sample_interval corrects for sampling, so sums stay accurate when traffic is high
const QUERIES = [
  ['Visits and unique visitors per day',`SELECT toDate(timestamp) AS day, SUM(_sample_interval) AS visits, COUNT(DISTINCT index1) AS visitors FROM ${DATASET} WHERE blob1='visit' AND ${WHERE} GROUP BY day ORDER BY day`],
  ['Blocks: created by people, kept and dismissed (of AI suggestions)',`SELECT blob1 AS event, SUM(_sample_interval * double1) AS blocks FROM ${DATASET} WHERE blob1 IN ('block_created','block_approved','block_dismissed') AND ${WHERE} GROUP BY event ORDER BY event`],
  ['Blocks by type',`SELECT blob1 AS event, blob3 AS type, SUM(_sample_interval * double1) AS blocks FROM ${DATASET} WHERE blob1 IN ('block_created','block_approved','block_dismissed') AND ${WHERE} GROUP BY event, type ORDER BY event, blocks DESC`],
  ['AI provider use (anthropic = Claude, openai = OpenAI / ChatGPT models)',`SELECT blob3 AS provider, SUM(_sample_interval) AS calls, SUM(IF(blob4='error',_sample_interval,0)) AS errors, COUNT(DISTINCT index1) AS users, ROUND(AVG(double2)) AS avg_ms FROM ${DATASET} WHERE blob1='ai_call' AND ${WHERE} GROUP BY provider ORDER BY calls DESC`],
  ['People who saved a key, by provider',`SELECT blob3 AS provider, COUNT(DISTINCT index1) AS users FROM ${DATASET} WHERE blob1='ai_key_saved' AND ${WHERE} GROUP BY provider ORDER BY users DESC`],
  ['Sign-ins',`SELECT blob4 AS kind, SUM(_sample_interval) AS signins, COUNT(DISTINCT index1) AS people FROM ${DATASET} WHERE blob1='signin' AND ${WHERE} GROUP BY kind`],
  ['Features used',`SELECT blob1 AS event, blob3 AS label, blob4 AS outcome, SUM(_sample_interval) AS times FROM ${DATASET} WHERE blob1 IN ('grow','bridge_result','ask','grill','domain_set','cascade_created','folder_created') AND ${WHERE} GROUP BY event, label, outcome ORDER BY event, times DESC`],
  ['Visits by country',`SELECT blob5 AS country, SUM(_sample_interval) AS visits FROM ${DATASET} WHERE blob1='visit' AND ${WHERE} GROUP BY country ORDER BY visits DESC LIMIT 10`]
];

async function run(sql){
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`,{ method:'POST', headers:{ authorization:'Bearer '+token }, body:sql+' FORMAT JSON' });
  const t = await r.text(); let j; try{ j = JSON.parse(t); }catch(e){ throw new Error(`HTTP ${r.status}: ${t.slice(0,200)}`); }
  if(!r.ok || j.success===false) throw new Error(`HTTP ${r.status}: ${t.slice(0,300)}`);
  return j.data || [];
}
function table(rows){
  if(!rows.length) return '  (nothing yet)';
  const cols = Object.keys(rows[0]), w = cols.map(c=>Math.max(c.length,...rows.map(r=>String(r[c] ?? '').length)));
  const line = (vals) => '  ' + vals.map((v,i)=>String(v ?? '').padEnd(w[i])).join('  ');
  return [line(cols),line(w.map(n=>'-'.repeat(n))),...rows.map(r=>line(cols.map(c=>r[c])))].join('\n');
}
(async()=>{
  console.log(`Cascade usage, ${env}, last ${days} day${days===1 ? '' : 's'}\n`);
  for(const [title,sql] of QUERIES){
    console.log(title);
    try{ console.log(table(await run(sql))+'\n'); }catch(e){ console.log('  could not read: '+e.message+'\n'); }
  }
  // approval rate, from the block counts above
  try{
    const rows = await run(QUERIES[1][1]), n = (e) => +((rows.find(r=>r.event===e) || {}).blocks || 0);
    const kept = n('block_approved'), dropped = n('block_dismissed');
    if(kept+dropped) console.log(`Suggestions kept: ${Math.round(100*kept/(kept+dropped))}% (${kept} kept, ${dropped} dismissed)\n`);
  }catch(e){}
})();
