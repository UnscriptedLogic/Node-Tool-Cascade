'use strict';
// Project folder: scan, search and read back. Read-only; nothing is sent anywhere until the page builds a prompt.
const ctx = require('../context');
const project = require('../lib/project');
const { pickFolder } = require('../lib/picker');
const { HttpError } = require('../lib/util');
const { json, readJSON } = require('../http');

module.exports = (r) => {
  r.get('/api/project',({ res }) => json(res,200,project.publicInfo()));
  r.get('/api/project/status',({ res }) => json(res,200,{ ...project.getProgress(), running:ctx.scanState.running, error:ctx.scanState.error, info:ctx.scanState.running ? null : project.publicInfo() }));
  r.post('/api/project/pick',async({ res }) => {
    try{ json(res,200,await pickFolder()); }
    catch(e){ throw new HttpError(e.status || 500,e.message); }
  });
  r.post('/api/project/scan',async({ req, res }) => {
    const b = await readJSON(req);
    if(ctx.scanState.running) throw new HttpError(409,'A scan is already running.');
    const list = (v,n) => (Array.isArray(v) ? v : String(v || '').split(/[\n,]+/)).map(x=>String(x).trim()).filter(Boolean).slice(0,n);
    const opts = { ignore:list(b.ignore,60).map(x=>x.slice(0,200)), include:list(b.include,20).map(x=>x.slice(0,12)) };
    await project.resolveRoot(b.path);   // answers "no such folder" straight away
    ctx.scanState = { running:true, error:'' };
    project.scan(b.path,opts)
      .then(()=>{ ctx.scanState = { running:false, error:'' }; })
      .catch(e=>{ ctx.scanState = { running:false, error:e && e.status===499 ? 'Scan cancelled.' : (e && e.message) || 'The scan failed.' }; });
    json(res,200,{ started:true });
  });
  r.post('/api/project/cancel',({ res }) => { project.cancel(); json(res,200,{ ok:true }); });
  r.get('/api/project/groups',({ res, url }) => {
    let g = project.groups({ groupChars:+url.searchParams.get('chars') || undefined });
    if(url.searchParams.get('only')==='changed') g = g.filter(x=>x.changed);
    json(res,200,{ groups:g });
  });
  r.get('/api/project/findings',({ res }) => json(res,200,project.findings()));
  r.post('/api/project/brief',async({ req, res }) => json(res,200,project.saveBrief(await readJSON(req))));
  r.post('/api/project/search',async({ req, res }) => {
    const b = await readJSON(req);
    json(res,200,{ results:project.search(String(b.q || '').slice(0,600),Math.max(1,Math.min(12,+b.k || 6)),{ perFile:+b.perFile || 2 }) });
  });
  r.get('/api/project/file',async({ res, url }) => json(res,200,await project.readLines(url.searchParams.get('path') || '',url.searchParams.get('start'),url.searchParams.get('end'))));
  r.post('/api/project/forget',({ res }) => { project.forget(); json(res,200,ctx.pub()); });
};
