'use strict';
// The Library tab in the local app: several Cascades, folders, autosave of the open one, and switching between them.
const test = require('node:test'), assert = require('node:assert/strict');
const { bootServer, page } = require('./helpers/server');
const { sleep } = require('./helpers/dom');

const api = (s) => async (method,path,body) => { const r = await fetch(s.base+'/api/'+path,{ method, headers:{ 'content-type':'application/json' }, body:body ? JSON.stringify(body) : undefined }); return r.json(); };
async function until(fn,ms = 4000){ const t0 = Date.now(); while(Date.now()-t0<ms){ if(await fn()) return true; await sleep(50); } return false; }

test('library UI: appears in the local app, makes Cascades and folders, autosaves the open one and switches between them',async(t)=>{
  const s = await bootServer(t,{ env:{} }), j = api(s);
  const a = await page(s); await sleep(500);
  a.escape();
  assert.equal(a.$('#railLib').hidden,false); assert.equal(a.$('#libTab').hidden,false);
  a.click(a.$('#railLib'));
  assert.equal(a.$('#libSaveCur').hidden,false,'the tree you already have can be saved');
  a.click(a.$('#libSaveCur'));
  assert.ok(await until(async()=>(await j('GET','library')).cascades.length===1),'saved as a Cascade');
  const first = (await j('GET','library')).cascades[0];
  a.type(a.$('.lib-name-input'),'Roadmap'); a.$('.lib-name-input').dispatchEvent(new a.w.KeyboardEvent('keydown',{ key:'Enter', bubbles:true }));
  assert.ok(await until(async()=>(await j('GET','library')).cascades[0].name==='Roadmap'),'renamed');
  assert.equal(a.$('#openName').hidden,false); assert.equal(a.$('#openName').textContent,'Roadmap','the open Cascade is named under the logo');

  // a new, empty Cascade; the one that was open is saved first
  a.click(a.$('#libNew')); assert.ok(await until(async()=>(await j('GET','library')).cascades.length===2));
  assert.equal(a.nodes().length,0,'the new Cascade starts empty');
  a.type(a.$('.lib-name-input'),'Experiments'); a.$('.lib-name-input').dispatchEvent(new a.w.KeyboardEvent('keydown',{ key:'Enter', bubbles:true }));

  // work in it: the open Cascade autosaves
  a.click(a.$('#resetBtn')); await sleep(300);
  assert.ok(a.nodes().length>5);
  const second = (await j('GET','library')).cascades.find(c=>c.name==='Experiments' || c.id!==first.id);
  assert.ok(await until(async()=>/Why is progress slower/.test((await j('GET','cascades/'+second.id)).data.tree),6000),'the open Cascade autosaved the example tree');

  // folders and moving
  a.click(a.$('#railLib')); a.click(a.$('#libFolder'));
  assert.ok(await until(async()=>(await j('GET','library')).folders.length===1));
  a.type(a.$('.lib-name-input'),'Q3'); a.$('.lib-name-input').dispatchEvent(new a.w.KeyboardEvent('keydown',{ key:'Enter', bubbles:true }));
  await sleep(200);
  const folder = (await j('GET','library')).folders[0];
  const sel = a.$(`.lib-row[data-id="${first.id}"] select`); a.type(sel,folder.id);
  assert.ok(await until(async()=>(await j('GET','library')).cascades.find(c=>c.id===first.id).folderId===folder.id),'moved into the folder');
  assert.equal(a.$$('.lib-folder[data-folder] .lib-row').length,1);
  assert.equal(a.$('#openName').textContent,'Experiments','still working in the other Cascade');
  a.click(a.$(`.lib-row[data-id="${first.id}"] .lib-open`)); await sleep(400);
  assert.equal(a.$('#openName').textContent,'Q3 / Roadmap','folder and name');
  a.click(a.$('#railLib'));

  // switch back to the first Cascade: its own (empty or saved) tree and name replace the canvas
  a.click(a.$(`.lib-row[data-id="${first.id}"] .lib-open`)); await sleep(500);
  assert.equal(a.w.eval('LIB.currentId'),first.id,'the first Cascade is the open one'); assert.ok(a.nodes().length>5,'its tree is on the canvas');
  assert.deepEqual(a.errs,[]);

  // deleting takes two clicks
  a.click(a.$('#railLib'));
  const del = a.$(`.lib-row[data-id="${second.id}"] .btn.small:last-of-type`); a.click(del);
  assert.equal((await j('GET','library')).cascades.length,2,'one click only arms it');
  a.click(a.$(`.lib-row[data-id="${second.id}"] .btn.danger`));
  assert.ok(await until(async()=>(await j('GET','library')).cascades.length===1),'second click deletes');
});

test('library UI: the web build has no library unless a cloud backend answers',async()=>{
  const { open, webHtml } = require('./helpers/dom');
  const a = open({ html:webHtml(), url:'https://someone.github.io/cascade/' }); await sleep(400);
  assert.equal(a.$('#railLib').hidden,true); assert.equal(a.$('#libTab').hidden,true);
  assert.deepEqual(a.errs,[]);
});

test('library UI: with a cloud backend the page shows Google sign-in, and the library only after signing in',async()=>{
  const { open, webHtml } = require('./helpers/dom');
  let signedIn = false; const calls = [];
  const fetchImpl = async (u,o = {}) => {
    const p = String(u); calls.push((o.method || 'GET')+' '+p);
    const res = (body,status = 200) => ({ ok:status<400, status, headers:{ get:()=>'application/json' }, json:async()=>body });
    if(p==='/api/config') return res({ cloud:true, googleClientId:'test-client.apps.googleusercontent.com' });
    if(p==='/api/auth/me') return res({ user:signedIn ? { email:'ada@example.com', name:'Ada' } : null });
    if(p==='/api/library') return signedIn ? res({ folders:[], cascades:[{ id:'c1', folderId:null, name:'Cloud one', domain:'research', createdAt:1, updatedAt:2 }] }) : res({ error:'sign_in' },401);
    return res({ error:'nope' },404);
  };
  const a = open({ html:webHtml(), url:'https://someone.github.io/cascade/', fetchImpl }); await sleep(500);
  assert.equal(a.$('#libTab').hidden,false); assert.equal(a.$('#railLib').hidden,false);
  a.click(a.$('#railLib'));
  assert.equal(a.$('#libAccount').hidden,false); assert.match(a.$('#libWho').textContent,/Sign in/);
  assert.equal(a.$('#libTools').hidden,true,'no tools until signed in'); assert.equal(a.$$('#libList .lib-row').length,0);
  signedIn = true; await a.w.libRefresh(); await sleep(50);
  assert.match(a.$('#libWho').textContent,/Ada/); assert.equal(a.$('#libTools').hidden,false);
  assert.equal(a.$$('#libList .lib-row').length,1); assert.equal(a.$('#libList .lib-open').textContent,'Cloud one');
});
