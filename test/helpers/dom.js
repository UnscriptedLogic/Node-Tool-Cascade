'use strict';
// Loads the app into jsdom the way a browser would, in any of its three modes.
const { JSDOM } = require('jsdom');
const fs = require('node:fs'), path = require('node:path'), nodeCrypto = require('node:crypto');

const ROOT = path.resolve(__dirname,'..','..');
const { assemble } = require('../../scripts/assemble');
const APP = assemble({ inline:true });
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));
// Same transformation scripts/build.js performs for the GitHub Pages version.
const webHtml = () => assemble({ inline:true, runtime:'<script>window.__WEB__=true;</script>' }).split('__REPO_URL__').join('https://github.com/example/cascade');

function open({ html = APP, url = 'https://cascade.test/', claude, fetchImpl, session, local, width, height } = {}){
  const errs = [], navigated = [], opened = [];
  const dom = new JSDOM(html,{ runScripts:'dangerously', pretendToBeVisual:true, url, beforeParse(w){
    if(width) Object.defineProperty(w,'innerWidth',{ value:width, configurable:true, writable:true });   // a phone-sized window
    if(height) Object.defineProperty(w,'innerHeight',{ value:height, configurable:true, writable:true });
    w.matchMedia = () => ({ matches:true, addEventListener(){}, removeEventListener(){} });   // also means "reduced motion"
    Object.defineProperty(w.HTMLElement.prototype,'offsetHeight',{ get(){ return 52; } });
    w.document.elementsFromPoint = () => []; w.Element.prototype.setPointerCapture = function(){};
    Object.defineProperty(w,'crypto',{ value:nodeCrypto.webcrypto, configurable:true });
    w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.Blob = Blob;
    w.__DEMO_FAST__ = true; w.__POLL_MS = 40; w.__navigate = (u) => navigated.push(u);
    w.open = () => { const o = { location:{ href:'' }, close(){} }; opened.push(o); return o; };
    if(fetchImpl) w.fetch = fetchImpl;
    if(claude) w.claude = claude;
    if(session) for(const [k,v] of Object.entries(session)) w.sessionStorage.setItem(k,v);
    // the tests exercise the game-design starter tree unless a test says otherwise
    if(!(local && local['cascade-prefs-v1'])) w.localStorage.setItem('cascade-prefs-v1',JSON.stringify({ domain:'game' }));
    if(local) for(const [k,v] of Object.entries(local)) w.localStorage.setItem(k,v);
    w.addEventListener('error',e=>errs.push(String(e.error || e.message)));
  } });
  const w = dom.window, d = w.document;
  const $ = (s) => d.querySelector(s), $$ = (s) => [...d.querySelectorAll(s)];
  const click = (el) => el.dispatchEvent(new w.MouseEvent('click',{ bubbles:true }));
  const type = (el,v) => { el.value = v; el.dispatchEvent(new w.Event('input',{ bubbles:true })); el.dispatchEvent(new w.Event('change',{ bubbles:true })); };
  const nodes = () => $$('.node').filter(n=>n.style.display!=='none');
  const byText = (t) => nodes().find(n=>n.querySelector('.txt').textContent.includes(t));
  const byId = (id) => d.querySelector(`.node[data-id="${id}"]`);
  const escape = () => { const e = () => new w.KeyboardEvent('keydown',{ key:'Escape', bubbles:true }); d.dispatchEvent(e()); w.dispatchEvent(e()); };
  // drop a block of `type` with `text` through the compose card, then give the app a moment to place and grow it
  const drop = async (kind,text,ms = 600) => { click($(`.tile[data-type="${kind}"]`)); type($('#compose textarea'),text); click($('#cOk')); await sleep(ms); };
  return { dom, w, d, $, $$, click, type, nodes, byText, byId, escape, drop, sleep, errs, navigated, opened };
}
module.exports = { open, APP, webHtml, sleep, ROOT };
