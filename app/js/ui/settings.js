'use strict';
/* ================= settings ================= */
let settingsEl; const appEl = $('#app');
const SETTINGS = CascadeUI.proxy({open:false,tab:'ai',preview:'',server:CONNECTION.server,drafts:{},results:{},models:{},busy:{},signingIn:false,web:{...CONNECTION.web},webKeyDraft:'',webModelDraft:CONNECTION.web.model,webModels:[],webBusy:false,cloud:CONNECTION.cloud,googleClientId:'',analytics:false,dataMessage:'',statsOn:true});
let curTab = 'ai', prefsTimer = 0;

function applyTheme(){ const r = document.documentElement; if(PREFS.theme==='light' || PREFS.theme==='dark') r.setAttribute('data-theme',PREFS.theme); else r.removeAttribute('data-theme'); }
async function postJSON(url,body){
  const r = await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  let j = {}; try{ j = await r.json(); }catch(e){}
  if(!r.ok) throw new Error(j.detail || j.error || ('HTTP '+r.status));
  return j;
}
async function postSettings(patch){
  const j = await postJSON('/api/settings',patch);
  CONNECTION.server = j; if(CONNECTION.server.ready) AI.off = false;
  updateProviders();
  return j;
}
function savePrefs(){
  try{ localStorage.setItem('cascade-prefs-v1',JSON.stringify(PREFS)); }catch(e){}
  if(LOCAL){ clearTimeout(prefsTimer); prefsTimer = setTimeout(()=>{ postSettings({prefs:PREFS}).catch(()=>{}); },450); }
}
function updatePreview(){ SETTINGS.preview = guidance() || 'Nothing yet. Add a goal, context or pillars and they will appear here exactly as the AI sees them.'; }
function showTab(n){
  if(n==='project' && LOCAL) setTimeout(()=>{ try{ loadProjectData(); }catch(e){} },0);
  curTab = n; CascadeUI.sync(()=>{ SETTINGS.tab = n; });
  if(SETTINGS.open) appEl.inert = n!=='look';
  if(n==='look') ensureLookUI();
  if(n==='mindsets') renderMindsets();
}
function openSettings(tab){
  updatePreview(); updateProviders(); updateWeb();
  CascadeUI.sync(()=>{ SETTINGS.open = true; }); appEl.inert = true;
  showTab(tab || curTab);
  $('#sClose').focus();
}
function closeSettings(){ CascadeUI.sync(()=>{ SETTINGS.open = false; }); appEl.inert = false; $('#setBtn').focus(); }

/* --- preferences --- */
/* --- providers (local version) --- */
const PROV_ORDER = ['chatgpt','claudecode','openrouter','anthropic','openai','custom','demo'];
const PROV = {
  chatgpt:{label:'ChatGPT plan',sub:'Use your ChatGPT Plus or Pro plan instead of an API key. This uses OpenAI’s “Sign in with ChatGPT” for open-source apps, which is still a preview.'},
  claudecode:{label:'Claude plan (Claude Code)',sub:'Use your Claude Pro or Max plan instead of an API key. Cascade runs the Claude Code app installed on this computer, which uses the account it’s logged in with.',model:'haiku'},
  openrouter:{label:'OpenRouter',sub:'One sign-in, many models: Claude, GPT, Gemini and more. You pay OpenRouter for usage.',key:'sk-or-…',model:'Choose one with Fetch models',base:'https://openrouter.ai/api/v1'},
  anthropic:{label:'Claude (Anthropic)',sub:'Claude models through the Anthropic API, with your own key.',key:'sk-ant-…',model:'claude-haiku-5-5',base:'https://api.anthropic.com'},
  openai:{label:'OpenAI API',sub:'OpenAI models through the OpenAI API, with your own key. Use Fetch models to see what your key can use.',key:'sk-…',model:'Choose one with Fetch models',base:'https://api.openai.com/v1'},
  custom:{label:'Custom endpoint',sub:'Anything that speaks the OpenAI chat format: Ollama, LM Studio, Groq, Gemini’s compatible endpoint and more.',key:'Only if the service needs one',model:'Model name, for example llama3.1',base:'http://localhost:11434/v1'},
  demo:{label:'Demo (no account)',sub:'Scripted responses on the example tree. Nothing leaves your computer.'}
};
const STEER_HELP = {light:'The goal is a gentle lean. Questions still wander.',balanced:'Most questions help you move toward the goal, with room for tangents.',strong:'Everything is framed as a step toward the goal. Few tangents.'};

function draftOf(sec,p){ const d=SETTINGS.drafts[p] || {}; return {provider:p,key:d.key || undefined,model:d.model || undefined,baseUrl:d.base || undefined}; }
function providerSay(p,text,cls){ SETTINGS.results[p]={text,cls:cls || ''}; }
function suggestModel(list,p){
  const bad = /(embed|whisper|tts|dall|moderation|image|audio|realtime|transcribe|rerank|instruct|:free|preview|search|vision)/i;
  let pool = list.filter(id=>!bad.test(id));
  if(p==='openrouter'){ const big = pool.filter(id=>/^~?(anthropic|openai|google)\//.test(id)); if(big.length) pool = big; }
  if(!pool.length) pool = list;
  const rank = id => /(mini|nano|haiku|flash|lite|8b)/i.test(id) ? 0 : 1;
  const idx = id => list.indexOf(id);
  return [...pool].sort((a,b)=>rank(a)-rank(b) || (p==='openrouter' ? idx(a)-idx(b) : b.localeCompare(a)))[0];
}
function updateProviders(){
  if(!(LOCAL || CONNECTION.cloud) || !CONNECTION.server) return;
  SETTINGS.server=CONNECTION.server;
  for(const [p,s] of Object.entries(CONNECTION.server.providers)){
    const d=SETTINGS.drafts[p] || {}, focused=document.activeElement && document.activeElement.id;
    SETTINGS.drafts[p]={...d,model:focused==='m-'+p?d.model:s.model || '',base:focused==='b-'+p?d.base:s.baseUrl || ''};
  }
  const em=CONNECTION.server.providers[CONNECTION.server.active] && CONNECTION.server.providers[CONNECTION.server.active].effectiveModel;
  UI.settingsTitle=CONNECTION.server.ready?`Settings · ${PROV[CONNECTION.server.active].label}${em?' · '+em:''}`:'Settings';

}
async function fetchModels(p,sec,quiet){
  const say=(t,c)=>providerSay(p,t,c);
  if(!quiet) say('Fetching models…');
  try{
    const d = draftOf(sec,p), r = await postJSON('/api/models',{provider:p,key:d.key,baseUrl:d.baseUrl});
    const list=r.models || []; SETTINGS.models[p]=list;
    if(!list.length){ if(!quiet) say('No models came back. You can still type a model name.','bad'); return; }
    if(!(SETTINGS.drafts[p]?.model || '').trim() && !CONNECTION.server.providers[p].defaultModel){
      const sug = suggestModel(list,p); SETTINGS.drafts[p].model=sug; await postSettings({providers:{[p]:{model:sug}}});
      say(`Found ${list.length} models and picked ${sug}. Change it any time.`,'ok');
    } else say(`Found ${list.length} models. Click the model box to choose one.`,'ok');
  }catch(err){ if(!quiet) say(err.message,'bad'); }
}
async function chatgptSignIn(consent,say,sec){
  const w = window.open('about:blank','_blank');
  try{
    const r = await postJSON('/api/chatgpt/start',{consent:!!consent});
    say('Finish signing in in the new tab…');
    SETTINGS.signingIn=true;
    if(w) w.location.href = r.url; else goTo(r.url);
    for(let i=0; i<240; i++){
      await sleep(window.__POLL_MS || 1500);
      const st = await getJSON('/api/chatgpt/status');
      if(st.state==='pending') continue;
      SETTINGS.signingIn=false; CONNECTION.server = await getJSON('/api/settings'); AI.off = false; updateProviders();
      if(st.state==='connected'){
        say(st.planUsage ? 'Signed in.' : 'Signed in, but plan usage wasn’t allowed.',st.planUsage ? 'ok' : 'bad');
        if(st.planUsage && !CONNECTION.server.providers.chatgpt.model) fetchModels('chatgpt',sec,true);
      } else say(st.error || 'Sign-in didn’t finish.','bad');
      return;
    }
    say('Timed out waiting for sign-in. Try again.','bad');
  }catch(e){ try{ if(w) w.close(); }catch(x){} say(e.message || 'Sign-in failed.','bad'); }finally{ SETTINGS.signingIn=false; }
}
async function onProvClick(e){
  const b = e.target.closest('button[data-act]'); if(!b) return;
  const sec = b.closest('.prov'), p = sec.dataset.prov, act = b.dataset.act;
  const say=(t,c)=>providerSay(p,t,c);
  try{
    if(act==='saveKey'){
      const v=(SETTINGS.drafts[p]?.key || '').trim();
      if(!v){ say('Paste a key first.','bad'); return; }
      await postSettings({providers:{[p]:{key:v}}}); SETTINGS.drafts[p].key = ''; say('Key saved.','ok'); fetchModels(p,sec,true);
    } else if(act==='rmKey'){ await postSettings({providers:{[p]:{key:null}}}); say('Key removed.'); }
    else if(act==='fetch'){ await fetchModels(p,sec,false); }
    else if(act==='orSignIn'){ say('Opening OpenRouter…'); await startOpenRouterLogin(); }
    else if(act==='cgSignIn' || act==='cgConsent'){ await chatgptSignIn(act==='cgConsent',say,sec); }
    else if(act==='cgSignOut'){ await postJSON('/api/chatgpt/signout',{}); CONNECTION.server = await getJSON('/api/settings'); updateProviders();  say('Signed out.'); }
    else if(act==='test'){
      say('Testing…'); SETTINGS.busy[p]=true;
      const r = await postJSON('/api/test',draftOf(sec,p));
      if(r.ok){ AI.off = false;  say(`Connected in ${r.ms} ms. The model replied “${r.reply}”.`,'ok'); }
      else say(r.error || 'The test failed.','bad');
      SETTINGS.busy[p]=false;
    }
  }catch(err){ say(err.message || 'Something went wrong.','bad'); SETTINGS.busy[p]=false; }
}
async function onProvChange(e){
  const t = e.target, sec = t.closest('.prov'); if(!sec) return;
  const p=sec.dataset.prov;
  try{
    if(t.type==='radio') await postSettings({active:p});
    else if(t.dataset.role==='model') await postSettings({providers:{[p]:{model:t.value.trim()}}});
    else if(t.dataset.role==='base') await postSettings({providers:{[p]:{baseUrl:t.value.trim()}}});
  }catch(err){ providerSay(p,err.message,'bad'); }
}

/* --- browser-only mode: demo / OpenRouter --- */
function updateWeb(){
  if(!WEB) return;
  SETTINGS.web={...CONNECTION.web};
  if(document.activeElement?.id!=='wOrModel') SETTINGS.webModelDraft=CONNECTION.web.model || '';
  UI.settingsTitle=CONNECTION.web.provider==='openrouter' && CONNECTION.web.model?`Settings · OpenRouter · ${CONNECTION.web.model}`:'Settings · Demo';
}
async function fetchOpenRouterModels(quiet){
  const say=(t,c)=>providerSay('web',t,c);
  if(!quiet) say('Fetching models…');
  try{
    const r = await fetch(OR_SITE+'/api/v1/models'), j = await r.json();
    const list = (j.data || []).slice().sort((a,b)=>(b.created || 0)-(a.created || 0)).map(m=>m.id).filter(Boolean);
    SETTINGS.webModels=list;
    if(!list.length){ if(!quiet) say('No models came back. You can still type a model name.','bad'); return; }
    if(!CONNECTION.web.model){ CONNECTION.web.model = suggestModel(list,'openrouter'); saveWebAI(); updateWeb();  say(`Found ${list.length} models and picked ${CONNECTION.web.model}. Change it any time.`,'ok'); }
    else say(`Found ${list.length} models. Click the model box to choose one.`,'ok');
  }catch(e){ if(!quiet) say('Could not load the model list. You can still type a model name.','bad'); }
}
function initWebConnect(){ updateWeb(); }
async function onWebAction(action,value){
  const say=(text,cls)=>providerSay('web',text,cls);
  if(action==='demo'){ CONNECTION.web.provider='demo'; saveWebAI(); AI.off=false; updateWeb();  }
  else if(action==='openrouter'){
    if(!CONNECTION.web.key){ say('Sign in with OpenRouter first.','bad'); updateWeb(); return; }
    CONNECTION.web.provider='openrouter'; saveWebAI(); AI.off=false; updateWeb();  if(!CONNECTION.web.model) fetchOpenRouterModels(true);
  }else if(action==='signin'){ say('Opening OpenRouter…'); try{ await startOpenRouterLogin(); }catch(e){ say(e.message,'bad'); } }
  else if(action==='save'){
    const key=SETTINGS.webKeyDraft.trim(); if(!key){ say('Paste a key first.','bad'); return; }
    CONNECTION.web={provider:'openrouter',key,model:CONNECTION.web.model || ''}; saveWebAI(); SETTINGS.webKeyDraft=''; AI.off=false; updateWeb();  say('Key saved in this browser.','ok'); if(!CONNECTION.web.model) fetchOpenRouterModels(true);
  }else if(action==='forget'){ CONNECTION.web={provider:'demo',key:'',model:''}; saveWebAI(); updateWeb();  say('Key forgotten. Back to the demo.'); }
  else if(action==='model'){ CONNECTION.web.model=value.trim(); saveWebAI(); AI.off=false; updateWeb();  }
  else if(action==='fetch') await fetchOpenRouterModels(false);
  else if(action==='test'){
    if(!(CONNECTION.web.key && CONNECTION.web.model)){ say('Add a key and choose a model first.','bad'); return; }
    say('Testing…'); SETTINGS.webBusy=true; const started=Date.now();
    try{ const result=await webSample('Reply with the single word OK.',{}); AI.off=false;  say(`Connected in ${Date.now()-started} ms. The model replied “${result.text.trim().slice(0,40)}”.`,'ok'); }
    catch(e){ say(e.message || 'The test failed.','bad'); }
    SETTINGS.webBusy=false;
  }
}

/* --- data (local version) --- */
function sanitizeTree(t){
  const nodes = {}, order = [];
  let seq = 0;
  for(const id of (Array.isArray(t.order) ? t.order : Object.keys(t.nodes||{}))){
    const n = t.nodes && t.nodes[id];
    if(!n || typeof n.text!=='string' || !BLOCKS.includes(n.type)) continue;
    const c = {id:String(id),type:n.type,text:n.text.slice(0,220),parent:n.parent ? String(n.parent) : null,ghost:!!n.ghost};
    if(n.mood && MOODS[n.mood]) c.mood = n.mood;
    if(typeof n.rel==='string') c.rel = n.rel.slice(0,32);
    if(n.back) c.back = true; if(n.collapsed) c.collapsed = true;
    if(TICKETS.includes(n.ticket)) c.ticket = n.ticket;
    if(n.state==='settled' || n.state==='out' || n.state==='open') c.state = n.state;
    if(n.decided) c.decided = true; if(n.unknown) c.unknown = true;
    if(typeof n.why==='string') c.why = n.why.slice(0,200);
    if(typeof n.note==='string') c.note = n.note.slice(0,1000);
    if(n.type==='question' && n.mindset){ const m = Mindsets.metadata(n.mindset); if(m) c.mindset = m; }
    if(Array.isArray(n.src)) c.src = n.src.slice(0,3).filter(x=>x && typeof x.f==='string').map(x=>({f:x.f.slice(0,300),l:Math.max(1,Math.floor(+x.l)||1),t:String(x.t||'').slice(0,200)}));
    nodes[c.id] = c; order.push(c.id);
    const num = parseInt(String(id).replace(/\D/g,''),10); if(num>seq) seq = num;
  }
  for(const id of order){ const n = nodes[id]; if(n.parent && (!nodes[n.parent] || n.parent===id)) n.parent = null; }
  const links = (Array.isArray(t.links) ? t.links : []).filter(l=>l && nodes[l.a] && nodes[l.b]).map(l=>({a:l.a,b:l.b,kind:l.kind==='flow'?'flow':l.kind==='block'?'block':'rel'}));
  return {nodes,order,links,seq,mindsets:Mindsets.collection(t.mindsets)};
}
function initData(){ try{ SETTINGS.statsOn=localStorage.getItem(ANALYTICS_OFF)!=='1'; }catch(e){} }
async function onDataAction(action,file){
  if(action==='stats'){
    SETTINGS.statsOn=!!file;
    try{ if(file) localStorage.removeItem(ANALYTICS_OFF); else localStorage.setItem(ANALYTICS_OFF,'1'); }catch(e){}
  }else if(action==='export'){
    const blob = new Blob([JSON.stringify({app:'cascade',version:1,tree:JSON.parse(snap())},null,2)],{type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cascade-tree.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  }else if(action==='import'){
    const f=file; if(!f) return;
    try{
      const j = JSON.parse(await f.text()), t = sanitizeTree(j.tree || j);
      if(!t.order.length) throw new Error('That file doesn’t look like a Cascade tree.');
      cancelAI(); pushHist(true);
      S.nodes = t.nodes; S.order = t.order; S.links = t.links; S.seq = t.seq; S.sel = null; S.mode = 'detail';
      S.mindsets = t.mindsets;
      layout(false); initialView(); save();  closeSettings(); showNote(['Imported the tree.'],true);
    }catch(err){ SETTINGS.dataMessage=err.message; }
  }
  else if(action==='clear'){ closeSettings(); clearGraph(); }
  else if(action==='forgetKey'){ CONNECTION.web={provider:'demo',key:'',model:''}; saveWebAI(); updateWeb();  SETTINGS.dataMessage='Your OpenRouter key was forgotten.'; }
  else if(action==='wipeKeys'){ try{ await postSettings({clearAllKeys:true}); SETTINGS.dataMessage='All saved API keys were removed.'; }catch(err){ SETTINGS.dataMessage=err.message; } }

}

UI.providerLabels=Object.fromEntries(Object.entries(PROV).map(([key,value])=>[key,value.label]));
CascadeUI.connect({S,PREFS,SETTINGS,DOMAINS,STEER_HELP,MODE,PROV,PROV_ORDER,LOCAL});
CascadeUI.mount('settings',$('#settingsRoot'));
settingsEl = $('#settings');

/* --- wiring --- */
addEventListener('keydown',e=>{ if(e.key==='Escape' && !settingsEl.hidden && document.getElementById('srcview').hidden){ e.stopPropagation(); closeSettings(); } },true);
document.body.classList.add('mode-'+MODE);
// the provider list is built once, for the local app or for a signed-in cloud account
let provListBuilt = false;
function initProviderList(){ provListBuilt=true; updateProviders(); }

if(LOCAL){ initProviderList(); initServer(); }
if(WEB) initWebConnect();
if(LOCAL || WEB) initData();
applyTheme();

