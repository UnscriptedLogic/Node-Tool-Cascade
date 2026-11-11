#!/usr/bin/env node
'use strict';
// A small admin dashboard for the anonymous usage counts, served on this computer only.
//
//   npm run admin                 (then open http://localhost:4400)
//   node scripts/admin/server.js --demo        made-up numbers, no token needed, to see the layout
//   node scripts/admin/server.js --open        also opens the page in your browser
//
// The Cloudflare token stays in this process. The page only ever receives finished numbers, never the token.
// It needs "Account > Account Analytics > Read". Give it as CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN, in
// scripts/analytics.local.env, or type it into the page (kept in memory; saving it to that file is optional).
const http = require('http'), fs = require('fs'), path = require('path'), { exec } = require('child_process');
const { loadStats } = require('./stats');
const { demoStats } = require('./demo');

const args = process.argv.slice(2), flag = (n) => args.includes('--'+n), opt = (n,d) => { const i = args.indexOf('--'+n); return i>=0 ? args[i+1] : d; };
const PORT = +opt('port',process.env.ADMIN_PORT || 4400), HOST = '127.0.0.1', DEMO = flag('demo');
const API_BASE = process.env.CF_API_BASE || 'https://api.cloudflare.com/client/v4';
const SAVED = path.join(__dirname,'..','analytics.local.env');
const PAGE = path.join(__dirname,'index.html');

// ---------- credentials: environment, the saved file, or typed into the page ----------
const creds = { account:'', token:'', source:null };
function readSaved(){
  try{
    const o = {}; for(const line of fs.readFileSync(SAVED,'utf8').split(/\r?\n/)){ const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if(m && !line.trim().startsWith('#')) o[m[1]] = m[2]; }
    return { account:o.CLOUDFLARE_ACCOUNT_ID || '', token:o.CLOUDFLARE_API_TOKEN || '' };
  }catch(e){ return { account:'', token:'' }; }
}
function loadCreds(){
  const s = readSaved();
  const account = process.env.CLOUDFLARE_ACCOUNT_ID || s.account, token = process.env.CLOUDFLARE_API_TOKEN || s.token;
  if(account && token){ Object.assign(creds,{ account, token, source:process.env.CLOUDFLARE_API_TOKEN ? 'environment' : 'file' }); }
}
loadCreds();

// ---------- helpers ----------
const json = (res,code,obj) => { res.writeHead(code,{ 'content-type':'application/json','cache-control':'no-store' }); res.end(JSON.stringify(obj)); };
const hostOk = (req) => { const h = (req.headers.host || '').toLowerCase(); return h===`localhost:${PORT}` || h===`127.0.0.1:${PORT}`; };
const originOk = (req) => { const o = req.headers.origin; if(!o) return true; try{ const h = new URL(o).host.toLowerCase(); return h===`localhost:${PORT}` || h===`127.0.0.1:${PORT}`; }catch(e){ return false; } };
const readBody = (req) => new Promise((ok,bad)=>{ let b = ''; req.on('data',c=>{ b += c; if(b.length>20000){ bad(new Error('too large')); req.destroy(); } }); req.on('end',()=>ok(b)); req.on('error',bad); });
const cache = new Map();   // env|days -> { at, stats }: the page can refresh freely without hammering the API

const server = http.createServer(async (req,res)=>{
  try{
    if(!hostOk(req) || !originOk(req)) return json(res,403,{ error:'forbidden' });
    const url = new URL(req.url,'http://localhost');
    if(req.method==='GET' && (url.pathname==='/' || url.pathname==='/index.html')){
      res.writeHead(200,{ 'content-type':'text/html; charset=utf-8','cache-control':'no-store' }); return res.end(fs.readFileSync(PAGE));
    }
    if(req.method==='GET' && url.pathname==='/api/status') return json(res,200,{ demo:DEMO, hasCredentials:DEMO || !!(creds.account && creds.token), source:DEMO ? 'demo' : creds.source, account:DEMO ? '' : creds.account });
    if(req.method==='POST' && url.pathname==='/api/credentials'){
      if(!(req.headers['content-type'] || '').includes('json')) return json(res,415,{ error:'JSON only' });
      let b = {}; try{ b = JSON.parse(await readBody(req)); }catch(e){ return json(res,400,{ error:'Bad JSON' }); }
      const account = String(b.account || '').trim(), token = String(b.token || '').trim();
      if(!/^[0-9a-f]{32}$/i.test(account)) return json(res,400,{ error:'The account id is 32 letters and numbers. You can copy it from the Cloudflare dashboard URL.' });
      if(token.length<20) return json(res,400,{ error:'That does not look like an API token.' });
      Object.assign(creds,{ account, token, source:'page' }); cache.clear();
      if(b.save){ fs.writeFileSync(SAVED,`# Local only. Ignored by git. Delete this file to forget the token.\nCLOUDFLARE_ACCOUNT_ID=${account}\nCLOUDFLARE_API_TOKEN=${token}\n`,{ mode:0o600 }); creds.source = 'file'; }
      return json(res,200,{ ok:true });
    }
    if(req.method==='GET' && url.pathname==='/api/stats'){
      const env = url.searchParams.get('env')==='dev' ? 'dev' : 'prod', days = Math.max(1,Math.min(365,+url.searchParams.get('days') || 7));
      if(DEMO) return json(res,200,demoStats({ env, days }));
      if(!creds.account || !creds.token) return json(res,401,{ error:'no_credentials', detail:'Add your Cloudflare account id and an API token with Account Analytics: Read.' });
      const key = env+'|'+days, hit = cache.get(key);
      if(hit && Date.now()-hit.at<60000 && url.searchParams.get('fresh')!=='1') return json(res,200,hit.stats);
      try{
        const stats = await loadStats({ env, days, account:creds.account, token:creds.token, base:API_BASE });
        cache.set(key,{ at:Date.now(), stats }); return json(res,200,stats);
      }catch(e){
        const denied = e.status===401 || e.status===403 || e.status===400;
        return json(res,denied ? 401 : 502,{ error:denied ? 'bad_credentials' : 'upstream', detail:denied ? 'Cloudflare did not accept this token. It needs Account > Account Analytics > Read, for this account.' : 'Could not read from Cloudflare: '+e.message });
      }
    }
    json(res,404,{ error:'not_found' });
  }catch(e){ console.error(e); if(!res.headersSent) json(res,500,{ error:'server_error' }); else res.end(); }
});

function openBrowser(addr){ const cmd = process.platform==='darwin' ? `open "${addr}"` : process.platform==='win32' ? `start "" "${addr}"` : `xdg-open "${addr}"`; exec(cmd,()=>{}); }
server.listen(PORT,HOST,()=>{
  const addr = `http://localhost:${server.address().port}`;
  console.log(`\n  Cascade admin dashboard: ${addr}${DEMO ? '   (demo data)' : ''}`);
  if(!DEMO) console.log(creds.token ? `  Using the Cloudflare token from ${creds.source}.` : '  No Cloudflare token yet. The page will ask for one.');
  console.log('  Only this computer can open it. Press Ctrl+C to stop.\n');
  if(flag('open') && !process.env.NO_OPEN) openBrowser(addr);
});
server.on('error',e=>{ console.error(e.code==='EADDRINUSE' ? `Port ${PORT} is already in use. Try --port 4401.` : e.message); process.exit(1); });
