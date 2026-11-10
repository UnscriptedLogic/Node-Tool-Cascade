'use strict';
// Starts the real server against the mock providers and opens its page in jsdom.
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { open, sleep, ROOT } = require('./dom');

async function bootServer(t,mock,env = {}){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'cascade-t-'));
  const p = spawn(process.execPath,[path.join(ROOT,'server','server.js')],{ env:{ ...process.env, NO_OPEN:'1', CASCADE_DATA_DIR:dir, ...mock.env, ...env } });
  p.out = ''; p.exited = false; p.on('exit',()=>{ p.exited = true; }); p.stdout.on('data',d=>p.out += d); p.stderr.on('data',d=>p.out += d);
  for(let i=0; i<100 && !/running at http:\/\/localhost:\d+/.test(p.out); i++) await sleep(50);
  const port = +p.out.match(/running at http:\/\/localhost:(\d+)/)[1], base = `http://localhost:${port}`;
  t.after(async()=>{ if(!p.exited){ p.kill('SIGINT'); for(let i=0; i<60 && !p.exited; i++) await sleep(50); } fs.rmSync(dir,{ recursive:true, force:true }); });
  return { p, port, base, dir, fetchImpl:(u,o)=>fetch(new URL(u,base+'/'),o) };
}
async function page(s,extra = {}){
  const html = await (await fetch(s.base+'/')).text();
  return open({ html, url:s.base+'/', fetchImpl:s.fetchImpl, ...extra });
}
module.exports = { bootServer, page };
