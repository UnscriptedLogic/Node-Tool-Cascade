'use strict';
// The HTTP server: only this computer may talk to it, then each request goes to a route module.
const http = require('http');
const ctx = require('./context');
const router = require('./routes');
const { HttpError } = require('./lib/util');
const { json } = require('./http');

const hostOk = (req) => { const h = (req.headers.host || '').toLowerCase(); return h === `localhost:${ctx.PORT}` || h === `127.0.0.1:${ctx.PORT}`; };
const originOk = (req) => {
  const o = req.headers.origin; if(!o) return true;
  try{ const h = new URL(o).host.toLowerCase(); return h === `localhost:${ctx.PORT}` || h === `127.0.0.1:${ctx.PORT}`; }catch(e){ return false; }
};

module.exports = http.createServer(async (req,res)=>{
  try{
    if(!hostOk(req) || !originOk(req)) return json(res,403,{ error:'forbidden' });
    const url = new URL(req.url,'http://localhost');
    const route = router.find(req.method,url.pathname);
    if(!route) return json(res,404,{ error:'not_found' });
    await route.h({ req, res, url });
  }catch(e){
    if(e instanceof HttpError) return json(res,e.status,{ error:'bad_request', detail:e.message });
    console.error(e);
    if(!res.headersSent) json(res,500,{ error:'server_error' }); else res.end();
  }
});
