'use strict';
// The page itself: assembled from app/, with this machine's saved tree and settings injected, plus its css/js parts.
const fs = require('fs'), path = require('path');
const ctx = require('../context');
const { json, inject } = require('../http');
const { assemble, APP_DIR } = require('../../scripts/assemble');

module.exports = (r) => {
  const page = ({ res }) => {
    clearTimeout(ctx.byeTimer);   // a reload, not a close
    let saved = 'null';
    try{ const raw = fs.readFileSync(ctx.TREE_FILE,'utf8'); JSON.parse(raw); saved = raw; }catch(e){}
    const runtime = `<script>window.__LOCAL__=true;window.__SETTINGS__=${inject(ctx.pub())};window.__CASCADE_SAVED__=${saved.replace(/</g,'\\u003c')};</script>`;
    res.writeHead(200,{ 'content-type':'text/html; charset=utf-8','cache-control':'no-store' });
    res.end(assemble({ inline:false, runtime }));
  };
  r.get('/',page); r.get('/index.html',page);
  r.get('/favicon.png',({ res }) => {
    res.writeHead(200,{ 'content-type':'image/png','cache-control':'public, max-age=86400' });
    res.end(fs.readFileSync(path.join(APP_DIR,'favicon.png')));
  });

  // the page's css and js parts, and nothing else under app/
  r.getPrefix('/app/',({ res, url }) => {
    const rel = path.normalize(decodeURIComponent(url.pathname.slice(5)));
    const file = path.join(APP_DIR,rel);
    if(rel.startsWith('..') || !/\.(css|js)$/.test(rel) || !fs.existsSync(file)) return json(res,404,{ error:'not found' });
    res.writeHead(200,{ 'content-type':rel.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8','cache-control':'no-store' });
    res.end(fs.readFileSync(file));
  });
};
