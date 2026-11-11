'use strict';
// Signed in on the cloud version, AI settings and AI calls use the account's saved keys through the server.
const test = require('node:test'), assert = require('node:assert/strict');
const { open, webHtml, sleep } = require('./helpers/dom');

const J = JSON.stringify;

test('cloud AI: signed in, the provider screen replaces the browser-only one and AI calls go through /api/sample',async()=>{
  const calls = [];
  let settings = { local:false, cloud:true, active:'anthropic', ready:true, providers:{ demo:{ ready:true }, openrouter:{ hasKey:false, ready:false }, anthropic:{ hasKey:true, hint:'••••WXYZ', source:'settings', model:'claude-x', effectiveModel:'claude-x', defaultModel:'claude-haiku-5-5', ready:true }, openai:{ hasKey:false, ready:false }, custom:{ hasKey:false, ready:false } } };
  const res = (body,status = 200) => ({ ok:status<400, status, headers:{ get:()=>'application/json' }, json:async()=>body });
  const placement = J({ type:'question', parent:'n6', relation:'raises', related:[], mood:null, reason:'From the account AI.' });
  const fetchImpl = async (u,o = {}) => {
    const p = String(u), body = o.body ? JSON.parse(o.body) : null; calls.push((o.method || 'GET')+' '+p);
    if(p==='/api/config') return res({ cloud:true, googleClientId:'x.apps.googleusercontent.com' });
    if(p==='/api/auth/me') return res({ user:{ email:'ada@example.com', name:'Ada' } });
    if(p==='/api/library') return res({ folders:[], cascades:[] });
    if(p==='/api/settings' && (o.method || 'GET')==='GET') return res(settings);
    if(p==='/api/settings'){
      if(body.active) settings.active = body.active;
      if(body.providers && body.providers.openai) settings.providers.openai = { hasKey:true, hint:'••••1234', source:'settings', model:'', effectiveModel:'', ready:false };
      return res(settings);
    }
    if(p==='/api/sample') return new Response('data: '+J({ t:placement })+'\n\n',{ status:200, headers:{ 'content-type':'text/event-stream' } });
    return res({ error:'nope' },404);
  };
  const a = open({ html:webHtml(), url:'https://someone.github.io/cascade/', fetchImpl }); await sleep(700);
  a.click(a.$('#setBtn')); a.click(a.$('.stabs [data-tab=ai]'));
  assert.equal(a.$('#aiLocal').hidden,false,'the account provider screen is shown'); assert.equal(a.$('#aiWeb').hidden,true,'the browser-key screen is hidden');
  assert.equal(a.$('.prov[data-prov=chatgpt]').hidden,true,'no ChatGPT sign-in on the cloud');
  assert.equal(a.$$('.prov[data-prov]').filter(s=>!s.hidden).length,5);
  assert.match(a.$('.prov[data-prov=anthropic] [data-role=keyhint]').textContent,/to your account, encrypted/);
  assert.equal(a.$('.prov[data-prov=anthropic] input[type=radio]').checked,true);
  // saving a key sends it to the account server
  a.type(a.$('#k-openai'),'sk-openai-1234'); a.click(a.$('.prov[data-prov=openai] [data-act=saveKey]')); await sleep(250);
  assert.ok(calls.includes('POST /api/settings'));
  // an AI call goes through the account server, never to a provider from the browser
  a.escape(); await a.drop('question','Would a bigger map help?',900);
  assert.ok(calls.includes('POST /api/sample'),'the model call went through /api/sample');
  assert.ok(!calls.some(c=>/anthropic\.com|openrouter\.ai|openai\.com/.test(c)),'the browser never calls a provider itself');
  assert.ok(a.byText('Would a bigger map help?'),'the block was placed using the account AI\'s answer');
  assert.deepEqual(a.errs,[]);
});

test('cloud AI: signed out, the browser-only OpenRouter screen stays and points to signing in',async()=>{
  const res = (body,status = 200) => ({ ok:status<400, status, headers:{ get:()=>'application/json' }, json:async()=>body });
  const fetchImpl = async (u) => { const p = String(u);
    if(p==='/api/config') return res({ cloud:true, googleClientId:'x.apps.googleusercontent.com' });
    if(p==='/api/auth/me') return res({ user:null });
    return res({ error:'sign_in' },401); };
  const a = open({ html:webHtml(), url:'https://someone.github.io/cascade/', fetchImpl }); await sleep(600);
  a.click(a.$('#setBtn')); a.click(a.$('.stabs [data-tab=ai]'));
  assert.equal(a.$('#aiLocal').hidden,true); assert.equal(a.$('#aiWeb').hidden,false); assert.equal(a.$('#aiCloudHint').hidden,false);
  assert.deepEqual(a.errs,[]);
});
