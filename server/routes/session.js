'use strict';
// Who is connected: ping, open-tab bookkeeping, settings, the saved tree and quitting.
const fs = require('fs');
const ctx = require('../context');
const settings = require('../lib/settings');
const { DATA_DIR } = require('../lib/util');
const { json, readJSON, readBody, parseJSON } = require('../http');

module.exports = (r) => {
  r.get('/api/ping',({ res }) => json(res,200,{ app:'cascade', dir:DATA_DIR, pid:process.pid, port:ctx.PORT }));

  r.get('/api/settings',({ res }) => json(res,200,ctx.pub()));
  r.post('/api/settings',async({ req, res }) => { settings.applyPatch(await readJSON(req)); json(res,200,ctx.pub()); });

  r.post('/api/hello',async({ req, res }) => {
    const b = await readJSON(req); if(typeof b.id==='string') ctx.clients.add(b.id.slice(0,40));
    clearTimeout(ctx.byeTimer); json(res,200,{ ok:true });
  });
  r.post('/api/bye',async({ req, res }) => {
    const b = await readJSON(req); if(typeof b.id==='string') ctx.clients.delete(b.id.slice(0,40));
    if(settings.get().prefs.quitOnClose && ctx.clients.size===0){
      clearTimeout(ctx.byeTimer);
      ctx.byeTimer = setTimeout(()=>{ if(ctx.clients.size===0) ctx.shutdown('the last tab was closed'); },ctx.GRACE);
    }
    json(res,200,{ ok:true });
  });
  r.post('/api/quit',({ res }) => { json(res,200,{ ok:true }); setTimeout(()=>ctx.shutdown('quit from the app'),200); });

  r.post('/api/tree',async({ req, res }) => {
    const body = await readBody(req); parseJSON(body);
    const tmp = ctx.TREE_FILE + '.tmp'; fs.writeFileSync(tmp,body); fs.renameSync(tmp,ctx.TREE_FILE);
    json(res,200,{ ok:true });
  });
};
