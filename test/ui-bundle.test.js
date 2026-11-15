'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { JSDOM } = require('jsdom');
const { assemble, manifest } = require('../scripts/assemble');
const { open, sleep } = require('./helpers/dom');

for(const mode of ['artifact','web','local']){
  test(`UI bundle loads in ${mode} mode`,async(t)=>{
    const runtime = mode==='artifact' ? '' : mode==='web' ? '<script>window.__WEB__=true;</script>'
      : '<script>window.__LOCAL__=true;window.__SETTINGS__={active:"demo",prefs:{},providers:{demo:{ready:true}}};</script>';
    const html = assemble({inline:true,runtime});
    const fetchImpl = async()=>new Response(JSON.stringify({folders:[],cascades:[]}),{headers:{'content-type':'application/json'}});
    const a = open({html,example:false,fetchImpl}); t.after(()=>a.dom.window.close());
    await sleep(20);
    assert.equal(a.w.eval('MODE'),mode);
    for(const name of ['proxy','subscribe','snapshot','ref','mount','unmount']) assert.equal(typeof a.w.CascadeUI[name],'function',name);
    assert.deepEqual(a.errs,[]);
    assert.ok(!/<script\b[^>]*\bsrc\s*=/i.test(html),'scripts are inline');
  });
}

test('UI bundle mounts once per name and releases its root',async(t)=>{
  const dom = new JSDOM('<div id="island"></div>',{runScripts:'dangerously',pretendToBeVisual:true});
  t.after(()=>dom.window.close());
  dom.window.eval(fs.readFileSync(path.join(__dirname,'../app/gen/ui.js'),'utf8'));
  const ui = dom.window.CascadeUI, el = dom.window.document.getElementById('island');
  assert.throws(()=>ui.mount('missing',el),/Unknown Cascade UI island/);
  ui.register('example',()=> 'Mounted');
  assert.throws(()=>ui.mount('example',null),/Missing container/);
  ui.mount('example',el); ui.mount('example',el);
  await sleep(30);
  assert.equal(el.textContent,'Mounted');
  assert.throws(()=>ui.mount('example',dom.window.document.createElement('div')),/already mounted/);
  assert.equal(ui.unmount('example'),true); assert.equal(el.textContent,'');
  assert.equal(ui.unmount('example'),false);
  ui.mount('example',el); await sleep(30); assert.equal(el.textContent,'Mounted'); ui.unmount('example');
});

test('bundle precedes the legacy scripts and emits only the expected files',()=>{
  assert.equal(manifest().js[0],'gen/ui.js'); assert.equal(manifest().css[0],'gen/ui.css');
  assert.deepEqual(fs.readdirSync(path.join(__dirname,'../app/gen')).sort(),['ui.css','ui.js']);
  assert.ok(assemble().includes('Copyright (c) 2023 shadcn'),'self-contained distribution retains the component license');
});
