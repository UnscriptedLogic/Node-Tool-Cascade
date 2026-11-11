'use strict';
// Plain HTTP helpers and a tiny router. Route modules register handlers; app.js dispatches to them.
const { HttpError } = require('./lib/util');

const readBody = (req,max = 2e6) => new Promise((resolve,reject)=>{
  let b = '';
  req.on('data',c=>{ b += c; if(b.length>max){ reject(new HttpError(413,'Too large')); req.destroy(); } });
  req.on('end',()=>resolve(b)); req.on('error',reject);
});
const parseJSON = (t) => { try{ return JSON.parse(t || '{}'); }catch(e){ throw new HttpError(400,'Bad JSON'); } };
const readJSON = async (req) => parseJSON(await readBody(req));
const json = (res,code,obj) => { res.writeHead(code,{ 'content-type':'application/json','cache-control':'no-store' }); res.end(JSON.stringify(obj)); };
const inject = (v) => JSON.stringify(v).replace(/</g,'\\u003c');   // safe to put inside a <script>
const esc = (t) => String(t).replace(/[&<>"]/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

// Handlers receive { req, res, url } and either respond themselves or return nothing after doing so.
function createRouter(){
  const routes = [];
  const add = (m,p,h,prefix) => { routes.push({ m,p,h,prefix:!!prefix }); };
  return {
    get:(p,h) => add('GET',p,h), post:(p,h) => add('POST',p,h), getPrefix:(p,h) => add('GET',p,h,true), prefix:(m,p,h) => add(m,p,h,true),
    find:(method,pathname) => routes.find(r=>r.m===method && (r.prefix ? pathname.startsWith(r.p) : pathname===r.p))
  };
}
module.exports = { readBody, parseJSON, readJSON, json, inject, esc, createRouter };
