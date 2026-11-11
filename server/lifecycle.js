'use strict';
// Starting and stopping: find a free port, open the browser, and release the port cleanly on exit.
const http = require('http'), { exec } = require('child_process');
const ctx = require('./context');
const server = require('./app');
const { DATA_DIR } = require('./lib/util');

const sockets = new Set();
server.on('connection',sk=>{ sockets.add(sk); sk.on('close',()=>sockets.delete(sk)); });
let closing = false;

function shutdown(reason,code){
  if(closing) return; closing = true;
  console.log(`\n  Stopping Cascade (${reason})...`);
  const force = setTimeout(()=>{ for(const sk of sockets) sk.destroy(); console.log('  Forced the port closed.'); process.exit(code || 0); },3000);
  force.unref();
  const closeStreams = setTimeout(()=>{ if(server.closeAllConnections) server.closeAllConnections(); else for(const sk of sockets) sk.destroy(); },800);
  closeStreams.unref();
  server.close(()=>{ clearTimeout(force); console.log(`  Port ${ctx.PORT} is free again. Goodbye.\n`); process.exit(code || 0); });
  if(server.closeIdleConnections) server.closeIdleConnections();
}
ctx.shutdown = shutdown;
for(const sig of ['SIGINT','SIGTERM','SIGHUP','SIGBREAK']){ try{ process.on(sig,()=>shutdown(sig)); }catch(e){} }
process.on('uncaughtException',e=>{ console.error(e); shutdown('an unexpected error',1); });
process.on('unhandledRejection',e=>{ console.error(e); });

function openBrowser(port){
  if(process.env.NO_OPEN) return;
  const addr = `http://localhost:${port}`;
  const cmd = process.platform==='darwin' ? `open "${addr}"` : process.platform==='win32' ? `start "" "${addr}"` : `xdg-open "${addr}"`;
  exec(cmd,()=>{});
}
// Is the thing on this port a Cascade server using the same data folder?
function probe(port){
  return new Promise(resolve=>{
    const req = http.get({ host:'127.0.0.1', port, path:'/api/ping', timeout:900 },res=>{
      let b = ''; res.on('data',c=>{ b += c; });
      res.on('end',()=>{ try{ const j = JSON.parse(b); resolve(j && j.app==='cascade' && j.dir===DATA_DIR ? j : null); }catch(e){ resolve(null); } });
    });
    req.on('timeout',()=>{ req.destroy(); resolve(null); });
    req.on('error',()=>resolve(null));
  });
}
function tryListen(port){
  return new Promise((resolve,reject)=>{
    const onErr = e => { server.removeListener('listening',onOk); reject(e); };
    const onOk = () => { server.removeListener('error',onErr); resolve(); };
    server.once('error',onErr); server.once('listening',onOk);
    server.listen(port,ctx.HOST);
  });
}
function announce(){
  const s = ctx.pub(), a = s.providers[s.active];
  console.log(`\n  Cascade is running at http://localhost:${ctx.PORT}`);
  if(ctx.PORT!==ctx.PREFERRED) console.log(`  (port ${ctx.PREFERRED} was busy, so ${ctx.PORT} was used instead)`);
  console.log(s.active==='demo' ? '  AI: demo mode (scripted). Open Settings in the app to connect a real one.' : s.ready ? `  AI: ${s.active}${a.effectiveModel ? ' · '+a.effectiveModel : ''}` : `  AI: ${s.active} is not set up yet. Open Settings in the app.`);
  console.log('  Press Ctrl+C to stop. The port is released when you do.\n');
  openBrowser(ctx.PORT);
}
async function boot(){
  const env = process.env.CASCADE_PORT_TRIES;
  const tries = env!==undefined && env!=='' ? Math.max(0,+env) : 50;
  for(let i=0; i<=tries; i++){
    const port = ctx.PREFERRED + i; if(port>65535) break;
    try{ await tryListen(port); ctx.PORT = server.address().port; return announce(); }
    catch(e){
      if(e.code!=='EADDRINUSE' && e.code!=='EACCES') throw e;
      if(await probe(port)){
        console.log(`\n  Cascade is already running at http://localhost:${port}. Opening it instead of starting a second copy.\n`);
        openBrowser(port); process.exit(0);
      }
    }
  }
  await tryListen(0); ctx.PORT = server.address().port; announce();   // everything nearby was busy: let the OS pick
}
module.exports = { boot, shutdown };
