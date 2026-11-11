'use strict';
/* ================= settings ================= */
const settingsEl = $('#settings'), appEl = $('#app');
let curTab = 'ai', prefsTimer = 0; const syncers = [];

function applyTheme(){ const r = document.documentElement; if(PREFS.theme==='light' || PREFS.theme==='dark') r.setAttribute('data-theme',PREFS.theme); else r.removeAttribute('data-theme'); }
async function postJSON(url,body){
  const r = await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  let j = {}; try{ j = await r.json(); }catch(e){}
  if(!r.ok) throw new Error(j.detail || j.error || ('HTTP '+r.status));
  return j;
}
async function postSettings(patch){
  const j = await postJSON('/api/settings',patch);
  SRV = j; if(SRV.ready) aiOff = false;
  updateProviders(); updateHud();
  return j;
}
function savePrefs(){
  try{ localStorage.setItem('cascade-prefs-v1',JSON.stringify(PREFS)); }catch(e){}
  if(LOCAL){ clearTimeout(prefsTimer); prefsTimer = setTimeout(()=>{ postSettings({prefs:PREFS}).catch(()=>{}); },450); }
}
function updatePreview(){ $('#gPreview').textContent = guidance() || 'Nothing yet. Add a goal, context or pillars and they will appear here exactly as the AI sees them.'; }
function showTab(n){
  if(n==='project' && LOCAL) setTimeout(()=>{ try{ loadProjectData(); }catch(e){} },0);
  curTab = n;
  document.querySelectorAll('.stabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===n)));
  document.querySelectorAll('.spane').forEach(p=>{ p.hidden = p.id!=='p-'+n; });
  settingsEl.classList.toggle('sheet',n==='look');          // appearance opens as a side sheet so the canvas stays visible
  if(!settingsEl.hidden) appEl.inert = n!=='look';
  if(n==='look') ensureLookUI();
}
function openSettings(tab){
  syncers.forEach(f=>f()); updatePreview(); updateProviders(); updateWeb();
  settingsEl.hidden = false; appEl.inert = true;
  showTab(tab || curTab);
  $('#sClose').focus();
}
function closeSettings(){ settingsEl.hidden = true; appEl.inert = false; $('#setBtn').focus(); }

/* --- preferences --- */
function bindText(sel,key){ const el = $(sel); el.addEventListener('input',()=>{ PREFS[key] = el.value; savePrefs(); updatePreview(); updateGoalChip(); }); syncers.push(()=>{ el.value = PREFS[key] || ''; }); }
function bindSeg(sel,key,after){
  const el = $(sel);
  const sync = () => el.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.val===String(PREFS[key]))));
  el.addEventListener('click',e=>{ const b = e.target.closest('button[data-val]'); if(!b) return; PREFS[key] = b.dataset.val; sync(); savePrefs(); if(after) after(); });
  syncers.push(sync);
}
function bindCheck(sel,key){ const el = $(sel); el.addEventListener('change',()=>{ PREFS[key] = el.checked; savePrefs(); updatePreview(); }); syncers.push(()=>{ el.checked = !!PREFS[key]; }); }
bindText('#gGoal','goal'); bindText('#gContext','context'); bindText('#gPillars','pillars'); bindText('#gAvoid','avoid');
bindSeg('#gSteer','steer',()=>{ $('#steerHelp').textContent = STEER_HELP[PREFS.steer]; updatePreview(); });
syncers.push(()=>{ $('#steerHelp').textContent = STEER_HELP[PREFS.steer] || ''; });
bindSeg('#bSize','growSize'); bindSeg('#aTheme','theme',applyTheme);
bindCheck('#bAutoGrow','autoGrow'); bindCheck('#bAutoTrace','autoTrace'); bindCheck('#bPushback','pushback'); bindCheck('#pUse','useProject'); bindCheck('#pAsk','askFiles'); bindCheck('#aFiles','askFiles'); bindSeg('#bGrill','grillStyle'); bindCheck('#sQuitClose','quitOnClose');
{
  const cr = $('#bCreative'), out = $('#bCreativeVal');
  cr.addEventListener('input',()=>{ PREFS.creativity = +cr.value; out.textContent = (+cr.value).toFixed(2); savePrefs(); });
  syncers.push(()=>{ cr.value = PREFS.creativity; out.textContent = (+PREFS.creativity).toFixed(2); });
}
$('#gChips').addEventListener('click',e=>{
  const c = e.target.closest('.chip'); if(!c) return;
  PREFS.goal = c.textContent; $('#gGoal').value = PREFS.goal; savePrefs(); updatePreview(); updateGoalChip();
});

/* --- providers (local version) --- */
const PROV_ORDER = ['chatgpt','openrouter','anthropic','openai','custom','demo'];
const PROV = {
  chatgpt:{label:'ChatGPT plan',sub:'Use your ChatGPT Plus or Pro plan instead of an API key. This uses OpenAI’s “Sign in with ChatGPT” for open-source apps, which is still a preview.'},
  openrouter:{label:'OpenRouter',sub:'One sign-in, many models: Claude, GPT, Gemini and more. You pay OpenRouter for usage.',key:'sk-or-…',model:'Choose one with Fetch models',base:'https://openrouter.ai/api/v1'},
  anthropic:{label:'Claude (Anthropic)',sub:'Claude models through the Anthropic API, with your own key.',key:'sk-ant-…',model:'claude-haiku-5-5',base:'https://api.anthropic.com'},
  openai:{label:'OpenAI API',sub:'OpenAI models through the OpenAI API, with your own key. Use Fetch models to see what your key can use.',key:'sk-…',model:'Choose one with Fetch models',base:'https://api.openai.com/v1'},
  custom:{label:'Custom endpoint',sub:'Anything that speaks the OpenAI chat format: Ollama, LM Studio, Groq, Gemini’s compatible endpoint and more.',key:'Only if the service needs one',model:'Model name, for example llama3.1',base:'http://localhost:11434/v1'},
  demo:{label:'Demo (no account)',sub:'Scripted responses on the example tree. Nothing leaves your computer.'}
};
const STEER_HELP = {light:'The goal is a gentle lean. Questions still wander.',balanced:'Most questions help you move toward the goal, with room for tangents.',strong:'Everything is framed as a step toward the goal. Few tangents.'};

function provCard(p){
  const m = PROV[p], head = `<header><label class="radio"><input type="radio" name="activeProv" value="${p}"><span>${m.label}</span></label><span class="tag" data-role="status" hidden></span></header><p class="sub">${m.sub}</p>`;
  if(p==='demo') return `<section class="prov" data-prov="demo">${head}</section>`;
  const result = '<div class="frow"><button class="btn primary" type="button" data-act="test">Test connection</button><span class="result" data-role="result" aria-live="polite"></span></div>';
  const model = `<div class="field"><label for="m-${p}">Model</label><div class="frow"><input id="m-${p}" type="text" list="ml-${p}" data-role="model" autocomplete="off" spellcheck="false" placeholder="${m.model || 'Choose one with Fetch models'}"><datalist id="ml-${p}"></datalist><button class="btn" type="button" data-act="fetch">Fetch models</button></div><small data-role="modelhint"></small></div>`;
  if(p==='chatgpt') return `<section class="prov" data-prov="chatgpt">${head}
  <div class="field"><span class="lbl">Account</span>
    <div class="frow"><button class="btn primary" type="button" data-act="cgSignIn">Continue with ChatGPT</button><button class="btn" type="button" data-act="cgConsent" hidden>Allow plan usage</button><button class="btn" type="button" data-act="cgSignOut" hidden>Sign out</button></div>
    <small data-role="cgstate"></small></div>
  ${model}${result}
  <p class="small" style="margin:10px 0 16px;line-height:1.45">Needs ChatGPT Plus or Pro. Usage counts against your plan and any limit you set for this app. <a href="https://chatgpt.com/settings/usage" target="_blank" rel="noopener">Manage usage</a></p></section>`;
  return `<section class="prov" data-prov="${p}">${head}
  ${p==='openrouter' ? '<div class="frow" style="margin:0 0 16px 27px"><button class="btn primary" type="button" data-act="orSignIn">Continue with OpenRouter</button></div>' : ''}
  <div class="field"><label for="k-${p}">${p==='openrouter' ? 'Or paste an API key' : 'API key'}</label>
    <div class="frow"><input id="k-${p}" type="password" autocomplete="off" spellcheck="false" placeholder="${m.key}"><button class="btn" type="button" data-act="saveKey">Save key</button><button class="btn" type="button" data-act="rmKey" hidden>Remove</button></div>
    <small data-role="keyhint"></small></div>
  ${model}
  <div class="field"><label for="b-${p}">Base URL${p==='custom' ? '' : ' (optional)'}</label>
    <input id="b-${p}" type="text" data-role="base" autocomplete="off" spellcheck="false" placeholder="${m.base}">
    <small>${p==='custom' ? 'Required. Include the version path, usually ending in /v1.' : 'Only change this for a proxy or gateway.'}</small></div>
  ${result}</section>`;
}
function draftOf(sec,p){
  const d = {provider:p};
  const k = sec.querySelector('input[type=password]'); if(k && k.value.trim()) d.key = k.value.trim();
  const m = sec.querySelector('[data-role=model]'); if(m && m.value.trim()) d.model = m.value.trim();
  const b = sec.querySelector('[data-role=base]'); if(b && b.value.trim()) d.baseUrl = b.value.trim();
  return d;
}
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
  if(!LOCAL || !SRV) return;
  document.querySelectorAll('.prov[data-prov]').forEach(sec=>{
    const p = sec.dataset.prov, s = SRV.providers[p]; if(!s) return;
    const active = SRV.active===p;
    sec.classList.toggle('active',active);
    sec.querySelector('input[type=radio]').checked = active;
    const tag = sec.querySelector('[data-role=status]');
    tag.hidden = !active; tag.textContent = s.ready ? 'In use' : 'Needs setup'; tag.classList.toggle('on',active && s.ready);
    if(p==='demo') return;
    if(p==='chatgpt'){
      const a = s.account, st = sec.querySelector('[data-role=cgstate]');
      st.textContent = s.pending ? 'Waiting for you to finish in the other tab…'
        : a ? (a.planUsage ? `Signed in as ${a.email}. ChatGPT plan usage is allowed.` : `Signed in as ${a.email}, but ChatGPT plan usage wasn’t allowed.`)
        : (s.lastError || 'Not signed in.');
      sec.querySelector('[data-act=cgSignIn]').hidden = !!a;
      sec.querySelector('[data-act=cgConsent]').hidden = !(a && !a.planUsage);
      sec.querySelector('[data-act=cgSignOut]').hidden = !a;
    } else {
      sec.querySelector('[data-role=keyhint]').textContent = s.hasKey
        ? (s.source==='env' ? `Using the key from your environment (${s.hint}). Saving one here overrides it.` : `Key saved on this computer (${s.hint}).`)
        : (p==='custom' ? 'No key saved. Local models usually don’t need one.' : 'No key saved yet.');
      sec.querySelector('[data-act=rmKey]').hidden = !(s.hasKey && s.source==='settings');
      const bi = sec.querySelector('[data-role=base]'); if(document.activeElement!==bi) bi.value = s.baseUrl || '';
    }
    const mi = sec.querySelector('[data-role=model]'); if(document.activeElement!==mi) mi.value = s.model || '';
    mi.placeholder = s.defaultModel || PROV[p].model || 'Choose one with Fetch models';
    sec.querySelector('[data-role=modelhint]').textContent = !s.model && s.defaultModel ? `Using the default, ${s.defaultModel}.` : '';
  });
  const em = SRV.providers[SRV.active] && SRV.providers[SRV.active].effectiveModel;
  $('#setBtn').title = SRV.ready ? `Settings · ${PROV[SRV.active].label}${em ? ' · '+em : ''}` : 'Settings';
}
async function fetchModels(p,sec,quiet){
  const res = sec.querySelector('[data-role=result]');
  const say = (t,c) => { res.textContent = t; res.className = 'result '+(c||''); };
  if(!quiet) say('Fetching models…');
  try{
    const d = draftOf(sec,p), r = await postJSON('/api/models',{provider:p,key:d.key,baseUrl:d.baseUrl});
    const list = r.models || [], dl = $('#ml-'+p); dl.innerHTML = '';
    list.forEach(id=>{ const o = document.createElement('option'); o.value = id; dl.appendChild(o); });
    if(!list.length){ if(!quiet) say('No models came back. You can still type a model name.','bad'); return; }
    const mi = sec.querySelector('[data-role=model]');
    if(!mi.value.trim() && !SRV.providers[p].defaultModel){
      const sug = suggestModel(list,p); mi.value = sug; await postSettings({providers:{[p]:{model:sug}}});
      say(`Found ${list.length} models and picked ${sug}. Change it any time.`,'ok');
    } else say(`Found ${list.length} models. Click the model box to choose one.`,'ok');
  }catch(err){ if(!quiet) say(err.message,'bad'); }
}
async function chatgptSignIn(consent,say,sec){
  const w = window.open('about:blank','_blank');
  try{
    const r = await postJSON('/api/chatgpt/start',{consent:!!consent});
    say('Finish signing in in the new tab…');
    const cgs = sec.querySelector('[data-role=cgstate]'); if(cgs) cgs.textContent = 'Waiting for you to finish in the other tab…';
    if(w) w.location.href = r.url; else goTo(r.url);
    for(let i=0; i<240; i++){
      await sleep(window.__POLL_MS || 1500);
      const st = await getJSON('/api/chatgpt/status');
      if(st.state==='pending') continue;
      SRV = await getJSON('/api/settings'); aiOff = false; updateProviders(); updateHud();
      if(st.state==='connected'){
        say(st.planUsage ? 'Signed in.' : 'Signed in, but plan usage wasn’t allowed.',st.planUsage ? 'ok' : 'bad');
        if(st.planUsage && !SRV.providers.chatgpt.model) fetchModels('chatgpt',sec,true);
      } else say(st.error || 'Sign-in didn’t finish.','bad');
      return;
    }
    say('Timed out waiting for sign-in. Try again.','bad');
  }catch(e){ try{ if(w) w.close(); }catch(x){} say(e.message || 'Sign-in failed.','bad'); }
}
async function onProvClick(e){
  const b = e.target.closest('button[data-act]'); if(!b) return;
  const sec = b.closest('.prov'), p = sec.dataset.prov, act = b.dataset.act;
  const res = sec.querySelector('[data-role=result]') || sec.querySelector('[data-role=cgstate]');
  const say = (t,c) => { res.textContent = t; res.className = res.classList.contains('result') ? 'result '+(c||'') : res.className; };
  try{
    if(act==='saveKey'){
      const inp = sec.querySelector('input[type=password]'), v = inp.value.trim();
      if(!v){ say('Paste a key first.','bad'); return; }
      await postSettings({providers:{[p]:{key:v}}}); inp.value = ''; say('Key saved.','ok'); fetchModels(p,sec,true);
    } else if(act==='rmKey'){ await postSettings({providers:{[p]:{key:null}}}); say('Key removed.'); }
    else if(act==='fetch'){ await fetchModels(p,sec,false); }
    else if(act==='orSignIn'){ say('Opening OpenRouter…'); await startOpenRouterLogin(); }
    else if(act==='cgSignIn' || act==='cgConsent'){ await chatgptSignIn(act==='cgConsent',say,sec); }
    else if(act==='cgSignOut'){ await postJSON('/api/chatgpt/signout',{}); SRV = await getJSON('/api/settings'); updateProviders(); updateHud(); say('Signed out.'); }
    else if(act==='test'){
      say('Testing…'); b.disabled = true;
      const r = await postJSON('/api/test',draftOf(sec,p));
      if(r.ok){ aiOff = false; updateHud(); say(`Connected in ${r.ms} ms. The model replied “${r.reply}”.`,'ok'); }
      else say(r.error || 'The test failed.','bad');
      b.disabled = false;
    }
  }catch(err){ say(err.message || 'Something went wrong.','bad'); b.disabled = false; }
}
async function onProvChange(e){
  const t = e.target, sec = t.closest('.prov'); if(!sec) return;
  const p = sec.dataset.prov, res = sec.querySelector('[data-role=result]') || sec.querySelector('[data-role=cgstate]');
  try{
    if(t.type==='radio') await postSettings({active:p});
    else if(t.dataset.role==='model') await postSettings({providers:{[p]:{model:t.value.trim()}}});
    else if(t.dataset.role==='base') await postSettings({providers:{[p]:{baseUrl:t.value.trim()}}});
  }catch(err){ res.textContent = err.message; if(res.classList.contains('result')) res.className = 'result bad'; }
}

/* --- browser-only mode: demo / OpenRouter --- */
function updateWeb(){
  if(!WEB) return;
  const or = WEBAI.provider==='openrouter', has = !!WEBAI.key;
  $('#wDemoRadio').checked = !or; $('#wOrRadio').checked = or;
  $('#wDemo').classList.toggle('active',!or); $('#wOr').classList.toggle('active',or);
  $('#wDemoTag').hidden = or; $('#wOrTag').hidden = !or; $('#wOrTag').classList.toggle('on',or && !!WEBAI.model);
  $('#wOrTag').textContent = or && !WEBAI.model ? 'Pick a model' : 'In use'; $('#wDemoTag').classList.add('on');
  $('#wOrKeyHint').textContent = has ? `Key saved in this browser (••••${WEBAI.key.slice(-4)}).` : 'No key yet.';
  $('#wOrForget').hidden = !has;
  $('#wOrSignIn').textContent = has ? 'Sign in again with OpenRouter' : 'Continue with OpenRouter';
  const mi = $('#wOrModel'); if(document.activeElement!==mi) mi.value = WEBAI.model || '';
  $('#setBtn').title = or && WEBAI.model ? `Settings · OpenRouter · ${WEBAI.model}` : 'Settings · Demo';
}
async function fetchOpenRouterModels(quiet){
  const res = $('#wOrResult'), say = (t,c) => { res.textContent = t; res.className = 'result '+(c||''); };
  if(!quiet) say('Fetching models…');
  try{
    const r = await fetch(OR_SITE+'/api/v1/models'), j = await r.json();
    const list = (j.data || []).slice().sort((a,b)=>(b.created || 0)-(a.created || 0)).map(m=>m.id).filter(Boolean);
    const dl = $('#ml-wor'); dl.innerHTML = '';
    list.forEach(id=>{ const o = document.createElement('option'); o.value = id; dl.appendChild(o); });
    if(!list.length){ if(!quiet) say('No models came back. You can still type a model name.','bad'); return; }
    if(!WEBAI.model){ WEBAI.model = suggestModel(list,'openrouter'); saveWebAI(); updateWeb(); updateHud(); say(`Found ${list.length} models and picked ${WEBAI.model}. Change it any time.`,'ok'); }
    else say(`Found ${list.length} models. Click the model box to choose one.`,'ok');
  }catch(e){ if(!quiet) say('Could not load the model list. You can still type a model name.','bad'); }
}
function initWebConnect(){
  const say = (t,c) => { const r = $('#wOrResult'); r.textContent = t; r.className = 'result '+(c||''); };
  $('#wDemoRadio').addEventListener('change',()=>{ WEBAI.provider = 'demo'; saveWebAI(); aiOff = false; updateWeb(); updateHud(); });
  $('#wOrRadio').addEventListener('change',()=>{
    if(!WEBAI.key){ say('Sign in with OpenRouter first.','bad'); updateWeb(); return; }
    WEBAI.provider = 'openrouter'; saveWebAI(); aiOff = false; updateWeb(); updateHud();
    if(!WEBAI.model) fetchOpenRouterModels(true);
  });
  $('#wOrSignIn').addEventListener('click',async()=>{ say('Opening OpenRouter…'); try{ await startOpenRouterLogin(); }catch(e){ say(e.message,'bad'); } });
  $('#wOrSave').addEventListener('click',()=>{
    const v = $('#wOrKey').value.trim(); if(!v){ say('Paste a key first.','bad'); return; }
    WEBAI = {provider:'openrouter',key:v,model:WEBAI.model || ''}; saveWebAI(); $('#wOrKey').value = ''; aiOff = false; updateWeb(); updateHud();
    say('Key saved in this browser.','ok'); if(!WEBAI.model) fetchOpenRouterModels(true);
  });
  $('#wOrForget').addEventListener('click',()=>{ WEBAI = {provider:'demo',key:'',model:''}; saveWebAI(); updateWeb(); updateHud(); say('Key forgotten. Back to the demo.'); });
  $('#wOrModel').addEventListener('change',()=>{ WEBAI.model = $('#wOrModel').value.trim(); saveWebAI(); aiOff = false; updateWeb(); updateHud(); });
  $('#wOrFetch').addEventListener('click',()=>fetchOpenRouterModels(false));
  $('#wOrTest').addEventListener('click',async()=>{
    const btn = $('#wOrTest'); if(!(WEBAI.key && WEBAI.model)){ say('Add a key and choose a model first.','bad'); return; }
    say('Testing…'); btn.disabled = true; const t0 = Date.now();
    try{ const r = await webSample('Reply with the single word OK.',{}); aiOff = false; updateHud(); say(`Connected in ${Date.now()-t0} ms. The model replied “${r.text.trim().slice(0,40)}”.`,'ok'); }
    catch(e){ say(e.message || 'The test failed.','bad'); }
    btn.disabled = false;
  });
  syncers.push(updateWeb); updateWeb();
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
    if(Array.isArray(n.src)) c.src = n.src.slice(0,3).filter(x=>x && typeof x.f==='string').map(x=>({f:x.f.slice(0,300),l:Math.max(1,Math.floor(+x.l)||1),t:String(x.t||'').slice(0,200)}));
    nodes[c.id] = c; order.push(c.id);
    const num = parseInt(String(id).replace(/\D/g,''),10); if(num>seq) seq = num;
  }
  for(const id of order){ const n = nodes[id]; if(n.parent && (!nodes[n.parent] || n.parent===id)) n.parent = null; }
  const links = (Array.isArray(t.links) ? t.links : []).filter(l=>l && nodes[l.a] && nodes[l.b]).map(l=>({a:l.a,b:l.b,kind:l.kind==='flow'?'flow':l.kind==='block'?'block':'rel'}));
  return {nodes,order,links,seq};
}
function initData(){
  $('#dExport').addEventListener('click',()=>{
    const blob = new Blob([JSON.stringify({app:'cascade',version:1,tree:JSON.parse(snap())},null,2)],{type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cascade-tree.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  });
  $('#dImport').addEventListener('click',()=>$('#dFile').click());
  $('#dFile').addEventListener('change',async e=>{
    const f = e.target.files[0]; if(!f) return;
    try{
      const j = JSON.parse(await f.text()), t = sanitizeTree(j.tree || j);
      if(!t.order.length) throw new Error('That file doesn’t look like a Cascade tree.');
      cancelAI(); pushHist(true);
      S.nodes = t.nodes; S.order = t.order; S.links = t.links; S.seq = t.seq; S.sel = null; S.mode = 'detail';
      layout(false); initialView(); save(); updateHud(); closeSettings(); showNote(['Imported the tree.'],true);
    }catch(err){ $('#dMsg').textContent = err.message; }
    e.target.value = '';
  });
  $('#dClear').addEventListener('click',()=>{ closeSettings(); clearGraph(); });
  $('#dForgetKey').addEventListener('click',()=>{ WEBAI = {provider:'demo',key:'',model:''}; saveWebAI(); updateWeb(); updateHud(); $('#dMsg').textContent = 'Your OpenRouter key was forgotten.'; });
  $('#dWipeKeys').addEventListener('click',async()=>{
    try{ await postSettings({clearAllKeys:true}); $('#dMsg').textContent = 'All saved API keys were removed.'; }catch(err){ $('#dMsg').textContent = err.message; }
  });
}

/* --- wiring --- */
$('#setBtn').addEventListener('click',()=>openSettings());
$('#setLink').addEventListener('click',()=>openSettings('ai'));
$('#goalchip').addEventListener('click',()=>{ openSettings('goal'); setTimeout(()=>$('#gGoal').focus(),30); });
$('#sClose').addEventListener('click',closeSettings);
document.querySelector('.stabs').addEventListener('click',e=>{ const b = e.target.closest('button[data-tab]'); if(b) showTab(b.dataset.tab); });
addEventListener('keydown',e=>{ if(e.key==='Escape' && !settingsEl.hidden && document.getElementById('srcview').hidden){ e.stopPropagation(); closeSettings(); } },true);
document.querySelectorAll('[data-modes]').forEach(el=>{ el.hidden = !el.dataset.modes.split(' ').includes(MODE); });
document.body.classList.add('mode-'+MODE);
if(LOCAL){
  const list = $('#provList');
  list.innerHTML = PROV_ORDER.map(provCard).join('');
  list.addEventListener('click',onProvClick); list.addEventListener('change',onProvChange);
  initServer();
}
if(WEB) initWebConnect();
if(LOCAL || WEB) initData();
applyTheme();

