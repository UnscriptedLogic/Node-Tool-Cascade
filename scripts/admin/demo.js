'use strict';
// Made-up numbers in the same shape as real ones, so the dashboard can be looked at before there is any data (node server.js --demo).
const { lastDays, PROVIDER_LABEL } = require('./stats');

function rng(seed){ let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function demoStats({ env = 'prod', days = 7, now = Date.now() } = {}){
  const r = rng(days * 97 + (env==='dev' ? 5 : 11)), list = lastDays(days,now);
  const scale = env==='dev' ? 0.18 : 1;
  const visits = [], visitors = [], created = [], approved = [], dismissed = [];
  list.forEach((d,i)=>{
    const dow = new Date(d+'T00:00:00Z').getUTCDay(), weekday = dow>0 && dow<6 ? 1 : 0.55;
    const trend = 0.7 + 0.6*(i/Math.max(1,days-1));
    const v = Math.round((90 + r()*60) * weekday * trend * scale);
    visits.push(v); visitors.push(Math.round(v * (0.62 + r()*0.12)));
    const c = Math.round(v * (1.4 + r()*0.9)); created.push(c);
    const a = Math.round(c * (0.9 + r()*0.5)), x = Math.round(c * (0.5 + r()*0.4)); approved.push(a); dismissed.push(x);
  });
  const sum = (a) => a.reduce((s,x)=>s+x,0);
  const T = sum(created), A = sum(approved), X = sum(dismissed);
  const split = (total,parts) => { const w = parts.map(p=>p.w), tw = sum(w); return parts.map(p=>({ ...p, n:Math.round(total*p.w/tw) })); };
  const types = ['question','answer','emotion','consequence','decision','fog'];
  const wt = { question:30, answer:26, emotion:14, consequence:13, decision:9, fog:5 };
  const blocksByType = types.map(t=>({ type:t, created:Math.round(T*wt[t]/97), approved:Math.round(A*wt[t]/97*(t==='emotion' ? 0.6 : 1)), dismissed:Math.round(X*wt[t]/97) })).sort((a,b)=>(b.created+b.approved+b.dismissed)-(a.created+a.approved+a.dismissed));
  const calls = Math.round(sum(visits) * 0.55);
  const ai = split(calls,[{ provider:'anthropic', w:46 },{ provider:'openai', w:34 },{ provider:'openrouter', w:15 },{ provider:'custom', w:5 }]).map((p,i)=>({
    provider:p.provider, label:PROVIDER_LABEL[p.provider], calls:p.n, errors:Math.round(p.n*[0.02,0.03,0.07,0.12][i]), users:Math.max(1,Math.round(p.n/[26,24,18,9][i])), avgMs:[1900,1400,2600,3800][i] }));
  const keys = ai.map(a=>({ provider:a.provider, label:a.label, users:Math.max(1,Math.round(a.users*1.1)) }));
  const f = (key,label,times) => ({ key, label, times:Math.round(times*scale) });
  const features = [
    f('grow|forward','Grow branches',sum(visits)*0.9), f('ask','Ask the graph',sum(visits)*0.42), f('grill','Grill me',sum(visits)*0.31),
    f('grow|bridge','Bridge to a feeling',sum(visits)*0.2), f('bridge_result|bridged','Bridge: ends met',sum(visits)*0.11), f('bridge_result|gap','Bridge: gap found, grill started',sum(visits)*0.08),
    f('grow|back','Trace back from a feeling',sum(visits)*0.15), f('domain_set|game','Domain: game',sum(visits)*0.07), f('domain_set|general','Domain: general',sum(visits)*0.1),
    f('domain_set|product','Domain: product',sum(visits)*0.06), f('cascade_created','Cascades created',sum(visits)*0.12), f('folder_created','Folders created',sum(visits)*0.04)
  ].sort((a,b)=>b.times-a.times);
  const cc = [['US',40],['GB',12],['CA',9],['DE',8],['AU',7],['SG',6],['IN',5],['BR',4],['FR',4],['NL',3]];
  const countries = cc.map(([country,w])=>({ country, visits:Math.round(sum(visits)*w/100) }));
  const kept = A, dropped = X, errors = sum(ai.map(a=>a.errors));
  return {
    env, days, dates:list, generatedAt:new Date(now).toISOString(), demo:true,
    series:{ visits, visitors, created, approved, dismissed },
    totals:{ visits:sum(visits), visitors:sum(visitors), created:T, approved:kept, dismissed:dropped, keptRate:kept/(kept+dropped), aiCalls:calls, aiErrors:errors, aiErrorRate:errors/calls,
      activeUsers:Math.round(sum(visitors)*0.09), signins:Math.round(sum(visits)*0.1), newSignins:Math.round(sum(visits)*0.04) },
    blocksByType, ai, keys, features, countries
  };
}
module.exports = { demoStats };
