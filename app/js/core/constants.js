'use strict';
/* ================= constants ================= */
const TYPES = ['question','answer','emotion','consequence','decision'];
const BLOCKS = ['loop',...TYPES,'fog'];
const TICKETS = ['talk','prototype','research','task'];
const TICKET_LABEL = {talk:'Talk',prototype:'Prototype',research:'Research',task:'Task'};
const TICKET_ASK = {talk:'Your answer',prototype:'What did the prototype show, and what do you decide?',research:'What did you find, and what do you decide?',task:'What happened, and what do you decide?'};
const drawerW = () => { const e = document.getElementById('side'); return e && !e.hidden && innerWidth>760 ? 380 : 0; };
const LABEL = {question:'Question',answer:'Answer',emotion:'Emotion',consequence:'Consequence',decision:'Decision',loop:'Loop',fog:'Fog'};
const MOODS = {
  frustration:{bg:'#D94A2B',fg:'#FFFFFF'},
  boredom:    {bg:'#A3AEBF',fg:'#142033'},
  curiosity:  {bg:'#19877A',fg:'#FFFFFF'},
  delight:    {bg:'#F2B33D',fg:'#2B1E00'},
  awe:        {bg:'#7653B4',fg:'#FFFFFF'},
  confusion:  {bg:'#E08AB0',fg:'#3A0F26'},
  tension:    {bg:'#3566D1',fg:'#FFFFFF'}
};
const MOOD_KEYS = Object.keys(MOODS);
const svg = (d) => `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  question: svg('<circle cx="8" cy="8" r="6.3"/><path d="M6.2 6.2a1.9 1.9 0 1 1 2.7 1.7c-.6.3-.9.7-.9 1.4"/><path d="M8 11.5v.1"/>'),
  answer: svg('<path d="M3 3v4.5A2.5 2.5 0 0 0 5.5 10H12"/><path d="M9.5 7.5 12 10l-2.5 2.5"/>'),
  emotion: svg('<path d="M1.5 8h3l1.7-4.5 3 9L11 8h3.5"/>'),
  consequence: svg('<path d="M8 2.5v4"/><path d="M8 6.5 4 10.5M8 6.5l4 4"/><circle cx="4" cy="12.2" r="1.2"/><circle cx="12" cy="12.2" r="1.2"/>'),
  decision: svg('<path d="M8 1.8 14.2 8 8 14.2 1.8 8z"/>'),
  loop: svg('<path d="M13.2 8a5.2 5.2 0 1 1-1.7-3.8"/><path d="M13.3 2.4v3h-3"/>'),
  fog: svg('<path d="M4.5 12.5h7a2.5 2.5 0 0 0 .3-5A3.7 3.7 0 0 0 4.6 7.2 2.7 2.7 0 0 0 4.5 12.5z"/>'),
  file: svg('<path d="M4 1.8h5.2L12.5 5v9.2H4z"/><path d="M9 1.8V5h3.5"/>')
};
const ACT = {
  accept: svg('<path d="m3.5 8.5 3 3 6-7"/>'),
  dismiss: svg('<path d="m4 4 8 8M12 4l-8 8"/>'),
  grow: svg('<path d="M8 1.5c.4 3.2 1.6 5 5.5 6.5-3.9 1.5-5.1 3.3-5.5 6.5-.4-3.2-1.6-5-5.5-6.5C6.4 6.5 7.6 4.7 8 1.5z"/>'),
  collapse: svg('<path d="m4.5 6.5 3.5 3.5 3.5-3.5"/>'),
  del: svg('<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8h5.8l.6-8"/>'),
  open: svg('<path d="M9.5 2.5h4v4M13.5 2.5 8.5 7.5M12 9.5v3.5H3V4h3.5"/>'),
  resolve: svg('<circle cx="8" cy="8" r="6.3"/><path d="m5.3 8.3 1.9 1.9 3.5-4"/>'),
  reopen: svg('<path d="M3 8a5 5 0 1 1 1.6 3.7"/><path d="M3 12V8.5h3.5"/>'),
  grill: svg('<path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/>'),
  ticket: svg('<path d="M2.5 8.5V3h5.5l5.5 5.5-5.5 5.5z"/><circle cx="5.5" cy="5.5" r=".8"/>'),
  block: svg('<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"/>'),
  out: svg('<circle cx="8" cy="8" r="6.3"/><path d="M5 8h6"/>'),
  sharpen: svg('<path d="m3 13 .8-3L11 2.8l2.2 2.2L6 12.2z"/>'),
  bridge: svg('<circle cx="3" cy="8" r="1.6"/><circle cx="13" cy="8" r="1.6"/><path d="M4.6 8h6.8" stroke-dasharray="1.6 1.8"/><path d="M6.2 8h3.6"/>'),
  back: svg('<path d="M12.5 12.5V7.5a3 3 0 0 0-3-3H3.5"/><path d="M6 2 3.5 4.5 6 7"/>'),
  delb: svg('<path d="M2.5 4h7M5 4V2.8h2V4M3.5 4l.5 7h4l.5-7"/><path d="M11.5 6v3.5M11.5 9.5l-1.8 2M11.5 9.5l1.8 2"/>'),
  src: svg('<path d="M4 1.8h5.2L12.5 5v9.2H4z"/><path d="M9 1.8V5h3.5"/><path d="M6 8.5h4M6 11h4"/>')
};
const KEY = 'cascade-tree-v1';
const LOCAL = !!window.__LOCAL__;
const WEB = !!window.__WEB__;
const MODE = LOCAL ? 'local' : WEB ? 'web' : 'artifact';
const WEBAI_KEY = 'cascade-web-ai-v1';
const DEFAULT_PREFS = {domain:'general',goal:'',context:'',pillars:'',avoid:'',steer:'balanced',autoGrow:true,autoTrace:true,growSize:'medium',creativity:0.7,theme:'system',pushback:true,grillStyle:'round',quitOnClose:false,useProject:true,askFiles:true};
function loadPrefs(){
  try{
    if(LOCAL && window.__SETTINGS__ && window.__SETTINGS__.prefs) return window.__SETTINGS__.prefs;
    const raw = localStorage.getItem('cascade-prefs-v1'); return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}
let PREFS = Object.assign({},DEFAULT_PREFS,loadPrefs());
if(!loadPrefs().domain && Object.keys(loadPrefs()).length) PREFS.domain = 'game';   // trees saved before domains existed were all game design
let SRV = LOCAL ? (window.__SETTINGS__ || null) : null;
let PROJ = LOCAL && SRV && SRV.project ? SRV.project : null;   // the scanned project, if any (local app only)   // public server settings (never contains keys)
function loadWebAI(){
  try{ const o = JSON.parse(localStorage.getItem(WEBAI_KEY) || '{}'); return {provider:o.provider==='openrouter' ? 'openrouter' : 'demo',key:typeof o.key==='string' ? o.key : '',model:typeof o.model==='string' ? o.model : ''}; }
  catch(e){ return {provider:'demo',key:'',model:''}; }
}
let WEBAI = WEB ? loadWebAI() : {provider:'demo',key:'',model:''};   // browser-only mode: lives in this browser's storage
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);

