'use strict';
/* ================= AI providers: local server, browser (OpenRouter) and demo ================= */
const OR_SITE = 'https://openrouter.ai';
const goTo = (url) => (window.__navigate ? window.__navigate(url) : location.assign(url));
const getJSON = async (url) => { const r = await fetch(url); return r.json(); };
function saveWebAI(){ try{ localStorage.setItem(WEBAI_KEY,JSON.stringify(WEBAI)); }catch(e){} }
async function readSSE(res,onData){
  const rd = res.body.getReader(), dec = new TextDecoder(); let buf = '';
  for(;;){
    const {value,done} = await rd.read(); if(done) break;
    buf += dec.decode(value,{stream:true});
    let i;
    while((i = buf.indexOf('\n')) >= 0){
      const line = buf.slice(0,i).replace(/\r$/,''); buf = buf.slice(i+1);
      if(line.startsWith('data:')) onData(line.slice(5).trim());
    }
  }
}
const streamFail = (e,text) => { if(e && e.name==='AbortError') return {code:'cancelled',message:'aborted',text}; if(e && e.code) return e; return {code:'upstream_error',message:String(e),text}; };

/* local server: it holds the keys and talks to the provider */
async function serverSample(prompt,o){
  o = o || {};
  const body = {prompt}; if(typeof o.temperature==='number') body.temperature = o.temperature;
  let r;
  try{ r = await fetch('/api/sample',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:o.signal}); }
  catch(e){ throw {code: e && e.name==='AbortError' ? 'cancelled' : 'upstream_error', message:String(e)}; }
  if(!r.ok){
    let j = {}; try{ j = await r.json(); }catch(e){}
    throw {code:(r.status===401 || r.status===403) ? 'sampling_disabled' : r.status===429 ? 'rate_limited' : 'upstream_error',message:j.detail || ('HTTP '+r.status)};
  }
  let text = '';
  try{
    await readSSE(r,d=>{
      let ev; try{ ev = JSON.parse(d); }catch(e){ return; }
      if(typeof ev.t==='string'){ text += ev.t; if(o.onText) o.onText({text,delta:ev.t}); }
      else if(ev.error) throw {code:'upstream_error',message:String(ev.error),text};
    });
  }catch(e){ throw streamFail(e,text); }
  return {text,truncated:false};
}

/* browser-only mode: call OpenRouter directly with the key kept in this browser */
async function webSample(prompt,o){
  o = o || {};
  if(!(WEBAI.key && WEBAI.model)) throw {code:'sampling_disabled',message:'Connect OpenRouter in Settings first.'};
  const body = {model:WEBAI.model,stream:true,max_tokens:1800,messages:[{role:'user',content:prompt}]};
  if(typeof o.temperature==='number') body.temperature = Math.min(1,Math.max(0,o.temperature));
  let r;
  for(let attempt=0; attempt<2; attempt++){
    try{
      r = await fetch(OR_SITE+'/api/v1/chat/completions',{method:'POST',signal:o.signal,
        headers:{'content-type':'application/json',authorization:'Bearer '+WEBAI.key,'x-title':'Cascade','http-referer':location.origin},body:JSON.stringify(body)});
    }catch(e){ throw {code:e && e.name==='AbortError' ? 'cancelled' : 'upstream_error',message:'Could not reach OpenRouter. Check your connection.'}; }
    if(r.ok) break;
    let j = {}; try{ j = await r.json(); }catch(e){}
    const msg = String((j.error && (j.error.message || j.error)) || j.message || ('HTTP '+r.status));
    if(attempt===0 && r.status===400 && 'temperature' in body && /temperature/i.test(msg)){ delete body.temperature; continue; }
    throw {code:(r.status===401 || r.status===402 || r.status===403) ? 'sampling_disabled' : r.status===429 ? 'rate_limited' : 'upstream_error',
      message: r.status===402 ? 'OpenRouter says this key is out of credits. Add some on openrouter.ai.' : msg.slice(0,200)};
  }
  let text = '';
  try{
    await readSSE(r,d=>{
      if(d==='[DONE]') return;
      let ev; try{ ev = JSON.parse(d); }catch(e){ return; }
      if(ev.error) throw {code:'upstream_error',message:String(ev.error.message || ev.error).slice(0,200),text};
      const c = ev.choices && ev.choices[0] && ev.choices[0].delta && ev.choices[0].delta.content;
      if(typeof c==='string' && c){ text += c; if(o.onText) o.onText({text,delta:c}); }
    });
  }catch(e){ throw streamFail(e,text); }
  if(!text) throw {code:'upstream_error',message:'The model returned no text. Try a different model.'};
  return {text,truncated:false};
}

/* OpenRouter sign-in (OAuth PKCE): no client registration, no backend, no secret */
function b64url(bytes){ let s = ''; bytes.forEach(b=>{ s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
async function pkcePair(){
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
  return {verifier,challenge:b64url(digest)};
}
async function startOpenRouterLogin(){
  const {verifier,challenge} = await pkcePair();
  try{ sessionStorage.setItem('cascade-or-pkce',JSON.stringify({verifier,t:Date.now()})); }
  catch(e){ throw new Error('This browser blocked session storage, which sign-in needs.'); }
  const cb = location.origin + location.pathname;
  goTo(`${OR_SITE}/auth?callback_url=${encodeURIComponent(cb)}&code_challenge=${challenge}&code_challenge_method=S256`);
}
async function finishOpenRouterLogin(){
  const code = new URLSearchParams(location.search).get('code'); if(!code) return;
  let saved = null;
  try{ saved = JSON.parse(sessionStorage.getItem('cascade-or-pkce') || 'null'); sessionStorage.removeItem('cascade-or-pkce'); }catch(e){}
  if(!saved || !saved.verifier) return;
  history.replaceState(null,'',location.pathname+location.hash);
  try{
    if(LOCAL){ SRV = await postJSON('/api/oauth/openrouter',{code,verifier:saved.verifier}); }
    else{
      const r = await fetch(OR_SITE+'/api/v1/auth/keys',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,code_verifier:saved.verifier,code_challenge_method:'S256'})});
      let j = {}; try{ j = await r.json(); }catch(e){}
      if(!r.ok || !j.key) throw new Error(String((j.error && (j.error.message || j.error)) || j.message || 'OpenRouter did not return a key.'));
      WEBAI = {provider:'openrouter',key:j.key,model:WEBAI.model || ''}; saveWebAI();
    }
    aiOff = false; updateHud(); openSettings('ai');
    showNote(['Signed in with OpenRouter. Pick a model and you’re set.'],false);
    if(LOCAL){ const sec = document.querySelector('.prov[data-prov=openrouter]'); if(sec) fetchModels('openrouter',sec,true); }
    else fetchOpenRouterModels(true);
  }catch(e){ showNote([`OpenRouter sign-in didn’t finish: ${e.message}`],false); }
}

/* demo provider: scripted answers so people can try the app with no account */
const J = (o) => JSON.stringify(o);
function demoRows(prompt){
  const rows = [], re = /^(\S+) \| (\w+)(?: \((\w+)\))?((?: \[[^\]]*\])*) \| (.*) \| parent: (\S+)$/gm; let m;
  while((m = re.exec(prompt))) rows.push({id:m[1],type:m[2],mood:m[3] || '',flags:m[4] || '',text:m[5],parent:m[6]==='none' ? null : m[6]});
  return rows.filter(r=>!/unaccepted/.test(r.flags));
}
const demoFind = (rows,re,type) => rows.find(r=>re.test(r.text) && (!type || r.type===type));
function demoMatches(rows,text,skipLoop){
  const words = new Set(toks(text));
  return rows.filter(r=>!(skipLoop && r.type==='loop')).map(r=>[toks(r.text).filter(w=>words.has(w)).length,r]).filter(x=>x[0]>0).sort((a,b)=>b[0]-a[0]).map(x=>x[1]);
}
function demoPlace(prompt,rows){
  const type = (prompt.match(/type chosen by the [^:\n]+: (\w+)/) || [])[1] || 'question';
  const text = ((prompt.match(/text: "([\s\S]*?)"\n\nRules:/) || [])[1] || '').replace(/\\"/g,'"');
  if(!rows.length) return J({type,parent:null,relation:'',related:[],mood:null,reason:''});
  const hits = demoMatches(rows,text,type!=='loop'), best = hits[0];
  const fallback = rows.find(r=>r.type==='loop' && r.parent) || rows[0];
  const parent = best || fallback, matched = !!best;
  const relation = type==='emotion' ? 'feels like' : type==='consequence' ? 'follows from' : type==='decision' ? 'decides' : type==='fog' ? 'sits beside'
    : /\b(would|could|should|what if|solve|fix|bigger|larger|wider|add|more)\b/i.test(text) ? 'proposed fix' : type==='answer' ? 'answers' : 'raises';
  return J({type,parent:parent.id,relation,related:hits.filter(r=>r.id!==parent.id).slice(0,2).map(r=>r.id),mood:type==='emotion' ? moodGuess(text) : null,
    reason: matched ? `It shares the most words with “${parent.text.slice(0,48)}”.` : `Nothing matched closely, so it sits under “${parent.text.slice(0,48)}”.`});
}
function demoGrow(prompt,rows){
  const m = prompt.match(/FOCUS NODE: (\S+) \| (\w+) \| (.*)/) || [], fid = m[1], ftype = m[2] || 'question', ftext = m[3] || '';
  const max = +((prompt.match(/At most (\d+) lines/) || [])[1]) || 9;
  const L = [];
  const add = (parent,type,text,wave,mood) => { const o = {id:'g'+(L.length+1),parent,type,text,wave}; if(mood) o.mood = mood; L.push(o); return o.id; };
  if(isGameDomain() && /map|bigger|wider|horizontal|travers|slow|distance|route/i.test(ftext)){
    const a = add(fid,'answer','The wider the map, the longer every route takes',1);
    const b = add(fid,'answer','A bigger map only works if landmarks and encounters fill it',1);
    add(b,'question','How many minutes should a typical trip take?',2);
    const c = add(a,'consequence','Players skip optional areas that sit far off the path',2);
    add(a,'question','Could movement abilities shorten trips instead?',2);
    add(c,'emotion','Boredom on long empty stretches',3,'boredom');
    add(b,'emotion','Curiosity when a landmark pulls the eye ahead',3,'curiosity');
  } else if(isGameDomain() && /upgrade|ability|glide|dash|movement|stat/i.test(ftext)){
    const a = add(fid,'answer','Movement upgrades change how the world is read',1);
    const b = add(fid,'answer','Stat upgrades keep fights balanced but feel flat',1);
    add(a,'question','Which ability should arrive in the first hour?',2);
    const c = add(b,'consequence','Players stop reading upgrade descriptions',2);
    add(c,'emotion','Delight fades once upgrades are only numbers',3,'delight');
    add(a,'emotion','Awe the first time a ledge becomes reachable',3,'awe');
  } else if(isGameDomain() && /enemy|combat|fight|wind-?up|telegraph|hit/i.test(ftext)){
    const a = add(fid,'answer','A distinct silhouette for each attack makes it readable',1);
    const b = add(fid,'answer','Longer wind-ups trade pace for fairness',1);
    add(b,'question','How long can a fight last before it drags?',2);
    const c = add(a,'consequence','Animation work grows with every new enemy',2);
    add(a,'emotion','Tension when a cue flashes before a hit',3,'tension');
    add(c,'emotion','Confusion if two attacks look alike',3,'confusion');
  } else if(ftype==='answer'){
    const a = add(fid,'consequence','People notice this soon after it changes',1);
    add(fid,'question','What would change if this turned out to be false?',1);
    add(a,'question','Who will be affected first?',2);
    add(a,'emotion','Curiosity about whether it holds up',3,'curiosity');
  } else if(ftype==='decision'){
    const a = add(fid,'consequence','Effort shifts toward the first stretch of the work',1);
    add(fid,'question','What does this make harder somewhere else?',1);
    add(a,'consequence','Later steps need a different pace',2);
    add(a,'emotion','Tension while the new rule settles in',3,'tension');
  } else if(ftype==='emotion'){
    add(fid,'question','What in the design causes this feeling?',1);
    const b = add(fid,'consequence','People may disengage when they feel this',1);
    add(b,'question','What would make them stay?',2);
  } else {
    const a = add(fid,'answer','The answer depends on what the person is trying to do right then',1);
    const b = add(fid,'answer','A simple rule of thumb would settle it',1);
    add(b,'question','What would a prototype need to show?',2);
    add(a,'emotion','Confusion about what the design wants',3,'confusion');
    add(b,'emotion','Curiosity about trying both ways',3,'curiosity');
  }
  return L.slice(0,max).map(J).join('\n');
}
function demoBack(prompt,rows){
  const m = prompt.match(/EMOTION NODE: (\S+) \| emotion(?: \((\w+)\))? \| (.*)/) || [], fid = m[1], mood = m[2] || '';
  const max = +((prompt.match(/At most (\d+) lines/) || [])[1]) || 6;
  const link = (re) => { const r = demoFind(rows,re); return r ? [r.id] : []; };
  const L = [];
  const add = (parent,type,text,wave,links) => { const o = {id:'g'+(L.length+1),parent,type,text,wave}; if(links) o.links = links; L.push(o); return o.id; };
  if(isGameDomain() && mood==='boredom'){
    const a = add(fid,'question','Is the ground between landmarks too empty?',1,link(/apart|empty|nothing in between/i));
    const b = add(fid,'question','Does walking speed fit the size of the map?',1,link(/movement abilities|walking/i));
    add(a,'answer','Landmarks sit more than a minute apart',2);
    add(b,'question','What could shorten a trip without shrinking the world?',2);
  } else if(isGameDomain() && mood==='frustration'){
    const a = add(fid,'question','Why do players retrace the same routes?',1,link(/movement abilities|retrac/i));
    const b = add(fid,'question','Is there any way to mark progress on the map?',1);
    add(a,'answer','Routes loop back with no shortcut',2);
    add(b,'question','What would players do with a marker?',2);
  } else if(isGameDomain() && mood==='confusion'){
    const a = add(fid,'question','What tells the player a hit is coming?',1,link(/wind-?ups|alike/i));
    const b = add(fid,'question','Do enemy attacks share one silhouette?',1);
    add(a,'answer','The cue appears too late to react',2);
    add(b,'question','Which attacks need their own look?',2);
  } else if(isGameDomain() && mood==='delight'){
    const a = add(fid,'question','What made the first few upgrades feel good?',1,link(/only raise numbers|upgrade/i));
    const b = add(fid,'question','When does the novelty wear off?',1);
    add(a,'answer','They changed what the player could reach',2);
    add(b,'question','What would renew it after the first few?',2);
  } else {
    const a = add(fid,'question','What in the design triggers this feeling?',1);
    const b = add(fid,'question','Who feels it, and at what moment?',1);
    add(a,'answer','Something people expected did not happen',2);
    add(b,'question','Is it the same for newcomers and experienced people?',2);
  }
  return L.slice(0,max).map(J).join('\n');
}
function demoChart(prompt,rows){
  const root = rows.find(r=>!r.parent) || rows[0] || {id:null};
  const trav = demoFind(rows,/travers/i,'question'), up = demoFind(rows,/upgrade/i,'question'), com = demoFind(rows,/enemy|combat/i,'question');
  const L = [];
  const add = (o) => { o.id = 't'+(L.length+1); L.push(o); return o.id; };
  if(isGameDomain() && trav){
    const t1 = add({parent:trav.id,type:'question',text:'What counts as a long trip?',ticket:'talk',blockedBy:[],wave:1});
    add({parent:t1,type:'question',text:'How long should crossing the map take?',ticket:'prototype',blockedBy:[t1],wave:1});
    add({parent:(up||trav).id,type:'question',text:'Which movement ability arrives first?',ticket:'talk',blockedBy:[t1],wave:1});
    add({parent:(com||trav).id,type:'question',text:'How readable must an enemy wind-up be?',ticket:'talk',blockedBy:[],wave:1});
    add({parent:trav.id,type:'question',text:'What do players say makes a trip worth taking?',ticket:'research',blockedBy:[],wave:2});
    add({parent:trav.id,type:'fog',text:'Camera behaviour on long routes',wave:2});
    add({parent:(up||trav).id,type:'fog',text:'How fast travel ties into progression',wave:2});
  } else {
    const o = DOM().demoOpen;
    const t1 = add({parent:root.id,type:'question',text:o[0],ticket:'talk',blockedBy:[],wave:1});
    add({parent:root.id,type:'question',text:o[3],ticket:'talk',blockedBy:[t1],wave:1});
    add({parent:root.id,type:'question',text:o[1],ticket:'talk',blockedBy:[],wave:1});
    add({parent:root.id,type:'fog',text:'Where to start',wave:2});
  }
  return L.map(J).join('\n');
}
function demoRound(prompt,rows){
  if(/SESSION SO FAR/.test(prompt)) return J({done:true,summary:'The main questions are decided for now.'});
  const sc = prompt.match(/SCOPE: stay inside this part of the tree: (.*) \((\S+)\)/);
  const scopeId = sc ? sc[2] : null, scopeText = sc ? sc[1] : '';
  const trav = demoFind(rows,/travers/i,'question'), com = demoFind(rows,/enemy|combat/i,'question'), up = demoFind(rows,/upgrade/i,'question');
  const pid = (r) => scopeId || (r && r.id) || (rows[0] && rows[0].id) || null;
  const q = (parent,text,why,ticket,grillable) => J({id:'q'+Math.random().toString(36).slice(2,6),parent,text,why,ticket:ticket || 'talk',grillable:grillable !== false});
  if(isGameDomain() && (/enemy|combat|wind/i.test(scopeText) || (!scopeId && !trav && com))){
    return [q(pid(com),'How readable must an enemy’s next move be?','It sets the animation budget.'),
      q(pid(com),'Should a fight ever be won by waiting?','It decides whether patience is a strategy.'),
      q(pid(com),'How long should one fight last?','It sets the pacing of the whole loop.'),
      q(pid(com),'What should a near miss feel like?','This needs something to react to.','prototype',false)].join('\n');
  }
  if(isGameDomain() && (trav || /travers|explor/i.test(scopeText))){
    return [q(pid(trav),'What counts as a long trip for the player?','It sets how big the map needs to be.'),
      q(pid(trav),'Should the player ever be allowed to skip travel?','It decides whether fast travel exists.'),
      q(pid(trav),'Which matters more: the journey or the arrival?','It shows what the in-between time is for.'),
      q(pid(trav),'What should crossing the map feel like?','This needs something to react to.','prototype',false),
      q(pid(up),'Should upgrades ever shorten a trip?','It links progression to travel.')].join('\n');
  }
  const r0 = rows.find(r=>r.type==='question') || rows[0];
  const o = DOM().demoOpen;
  return [q(pid(r0),o[0],'Everything else is measured against the audience.'),
    q(pid(r0),o[1],'It defines the core feeling.'),
    q(pid(r0),o[2],'It exposes what you will not compromise on.'),
    q(pid(r0),o[3],'This needs something to react to.','prototype',false)].join('\n');
}
function demoPushback(prompt){
  const ans = ((prompt.match(/THE [^\n']+'S ANSWER: ([\s\S]*?)\n\nPush back only/) || [])[1] || '').trim();
  const words = ans.split(/\s+/).filter(Boolean).length;
  const reasoned = /\b(because|so that|since|if|when|which|then|unless|otherwise)\b|\d/i.test(ans);
  const bank = [`What happens to ${DOM().audience} this doesn’t help?`,'If you’re wrong about this, what would you notice first?',`What does this make harder somewhere else in the ${DOM().subject}?`,'Is that a decision, or an assumption you haven’t tested?'];
  if(words<9 || !reasoned) return J({verdict:'challenge',text:bank[ans.length % bank.length]});
  return J({verdict:'solid',text:''});
}
function demoAsk(prompt,rows){
  const question = (prompt.match(/QUESTION: (.*)/) || [])[1] || '';
  const f = (re,type) => demoFind(rows,re,type);
  const chain = (...ns) => ns.filter(Boolean).map(r=>r.id);
  const trav = f(/travers/i,'question'), far = f(/apart|nothing in between/i), bored = f(/bored/i,'emotion'), skip = f(/skip optional/i);
  const noMove = f(/no movement abilities/i), frus = f(/retrac/i,'emotion'), up = f(/upgrade/i,'question'), nums = f(/only raise numbers/i);
  const com = f(/enemy|combat/i,'question'), wind = f(/wind-?ups/i), conf = f(/sudden hits|confus/i,'emotion');
  const T = [], add = (label,ids,why) => { if(ids.filter(Boolean).length>=2) T.push({label,ids,why}); };
  let verdict = 'answered', answer = '', gaps = [];
  if(isGameDomain() && /bored|boredom|empty|slow|travers/i.test(question)){
    add('Empty ground causes boredom',chain(trav,far,bored,skip),'Sparse points of interest leave long empty walks, which bore players into skipping content.');
    add('Walking-only travel',chain(trav,noMove,frus,up),'With no movement abilities the same routes get retraced, and upgrades could change that.');
    answer = 'Travel feels slow because points of interest sit far apart with nothing between them, and walking is the only way to cover the ground. The boredom and the skipped optional areas both follow from that.';
  } else if(isGameDomain() && /frustrat|retrac|ability|abilities|movement/i.test(question)){
    add('Retracing the same routes',chain(trav,noMove,frus),'Walking-only movement makes players cross familiar ground again and again.');
    add('Upgrades that do not move you',chain(up,nums,f(/delight fades/i,'emotion')),'Upgrades that only raise numbers do not change how the player moves, so the novelty fades.');
    answer = 'The frustration comes from having no movement abilities, so players retrace routes. Upgrades could address it, but today they mostly raise numbers.';
  } else if(isGameDomain() && /confus|enem|combat|wind/i.test(question)){
    add('Unreadable wind-ups',chain(com,wind,conf),'Short, similar wind-ups make hits feel sudden and confusing.');
    answer = 'Combat confusion traces back to wind-ups that are short and look alike, so players are hit without warning.';
  } else if(/negative|feeling|emotion|mood|feel/i.test(question)){
    const neg = rows.filter(r=>r.type==='emotion' && /boredom|frustration|confusion/.test(r.mood || r.flags + r.text)).slice(0,3);
    neg.forEach(e=>{ const a = rows.find(r=>r.id===e.parent), qq = a && rows.find(r=>r.id===a.parent); add(e.text,chain(qq,a,e),'This is the chain of reasoning behind this feeling.'); });
    answer = T.length ? (isGameDomain() ? 'The negative feelings in the tree each trace back to a specific design cause: boredom to sparse landmarks, frustration to walking-only travel, and confusion to similar wind-ups.' : 'Each negative feeling in the tree traces back to a specific cause, shown in the threads below.') : '';
  } else if(/undecided|open|still|unsettled|left|remain/i.test(question)){
    const open = rows.filter(r=>r.type==='question' && !/\[settled\]/.test(r.flags)).slice(0,8);
    if(open.length>1) add('Questions still open',open.map(r=>r.id),'These questions have no settled decision yet.');
    answer = open.length ? `${open.length} questions are still open. ${isGameDomain() ? 'Most are about travel, combat readability and how upgrades change movement.' : 'The threads below list them.'}` : '';
  } else if(/loop|connect|flow|stage|relate/i.test(question)){
    const loops = rows.filter(r=>r.type==='loop' && r.parent).slice(0,5);
    if(loops.length>1) add('How the loops connect',loops.map(r=>r.id),'These stages feed into each other.');
    answer = loops.length ? (isGameDomain() ? 'Explore, Combat and Upgrade form the core loop: what you find while exploring is fought for, and upgrades change how you explore next.' : loops.slice(0,3).map(r=>r.text).join(', ')+' are stages that lead into each other.') : '';
  }
  if(!T.length){
    const hits = demoMatches(rows,question,true).slice(0,3);
    hits.forEach(h=>{ const up2 = rows.find(r=>r.id===h.parent); add(h.text.slice(0,30),chain(up2,h),'Shares words with your question.'); });
    if(T.length){ verdict = 'partial'; answer = 'Demo mode can only match keywords, so these are the closest threads. Connect an AI for a reasoned answer.'; }
    else { verdict = 'unanswered'; answer = 'Nothing in the tree speaks to that yet.'; gaps = [{text:`What does the tree say about “${question.slice(0,60)}”?`,parent:(rows[0]||{}).id || null}]; }
  }
  return J({verdict,answer,threads:T.slice(0,3),gaps});
}
function demoThreadSummary(prompt){
  const q = (prompt.match(/QUESTION: (.*)/) || [])[1] || 'this question', next = /beginning "Next:"/.test(prompt);
  const threads = []; const re = /Thread \d+, ([^\n(]*?)(?: \([^)]*\))?:\n((?:  \d+\. .*\n?)+)/g; let m;
  while((m = re.exec(prompt))){
    const steps = m[2].trim().split('\n').map(l=>l.replace(/^\s*\d+\.\s*/,'')).map(l=>{ const mm = l.match(/^(\w+)(?: \((\w+)\))?((?: \[[^\]]*\])*): (.*)$/); return mm ? {type:mm[1],flags:mm[3] || '',text:mm[4]} : {type:'',flags:'',text:l}; });
    threads.push({label:m[1].trim(),steps});
  }
  if(!threads.length) return 'There is nothing highlighted to summarise yet.';
  const parts = threads.map(t=>{ const first = t.steps[0].text, last = t.steps[t.steps.length-1].text, mid = t.steps.slice(1,-1).map(s=>`“${s.text}”`);
    return `${t.label.toLowerCase()} starts from “${first}”${mid.length ? ' and passes through '+mid.join(', ') : ''}, ending at “${last}”`; });
  const all = threads.flatMap(t=>t.steps), settled = all.filter(s=>/\[settled\]|\[decision\]/.test(s.flags)), open = all.filter(s=>s.type==='question' && !/\[settled\]/.test(s.flags));
  let out = `On “${q}”, the tree answers in ${threads.length===1 ? 'one thread' : threads.length+' threads'}: ${parts.join('; ')}. `;
  out += settled.length ? `${settled.length} ${settled.length===1 ? 'step is' : 'steps are'} already settled. ` : 'Nothing along the way is settled yet. ';
  out += open.length ? `The open question${open.length===1 ? ' is' : 's are'} ${open.slice(0,2).map(s=>`“${s.text}”`).join(' and ')}.` : 'No questions along these threads are still open.';
  if(next) out += open.length ? ` Next: settle “${open[0].text}”.` : ' Next: test the thread with a prototype.';
  return out;
}
function demoTreeSummary(prompt,rows){
  const goal = (prompt.match(/OVERARCHING GOAL: (.*)/) || [])[1];
  const qs = rows.filter(r=>r.type==='question'), settled = qs.filter(r=>/\[settled\]/.test(r.flags)), open = qs.length - settled.length;
  const emo = rows.filter(r=>r.type==='emotion'), moods = [...new Set(emo.map(r=>r.mood).filter(Boolean))];
  const p1 = `The tree holds ${rows.length} blocks and ${qs.length} questions, ${settled.length} of them settled and ${open} still open${goal ? `, measured against the goal “${goal.slice(0,90)}”` : ''}. ${isGameDomain() ? 'Most of the weight sits on exploration, with combat readability and upgrades as the other two stages.' : 'The questions are spread across the stages of the tree.'}`;
  const p2 = emo.length ? `The feelings recorded are ${moods.join(', ') || 'mixed'}. ${isGameDomain() ? 'They trace back to travel that is slow, combat cues that are easy to miss and upgrades that do not change play. What is still undecided is mostly how those three fixes relate.' : 'Each traces back to a cause somewhere in the tree. What is still undecided is how those causes relate.'}` : 'No player feelings are recorded yet, so it is hard to say how the design should feel.';
  return p1+'\n\n'+p2;
}
function demoRespond(prompt){
  const rows = demoRows(prompt);
  if(prompt.includes('placement engine')) return demoPlace(prompt,rows);
  if(/You are interviewing an? /.test(prompt)) return demoRound(prompt,rows);
  if(prompt.includes('sharp but fair design interviewer')) return demoPushback(prompt);
  if(prompt.includes('charting a map of decisions')) return demoChart(prompt,rows);
  if(/You are analysing an? [^\n]*decision tree/.test(prompt)) return demoAsk(prompt,rows);
  if(/Summarise what an? [^\n]*decision tree says/.test(prompt)) return demoThreadSummary(prompt);
  if(/Summarise this [^\n]*decision tree/.test(prompt)) return demoTreeSummary(prompt,rows);
  if(/backtrack from an emotion/.test(prompt)) return demoBack(prompt,rows);
  if(/You grow an? [^\n]*decision tree/.test(prompt)) return demoGrow(prompt,rows);
  return '';
}
async function demoSample(prompt,o){
  o = o || {};
  const wait = (ms) => window.__DEMO_FAST__ ? Promise.resolve() : sleep(ms);
  const stop = () => { if(o.signal && o.signal.aborted) throw {code:'cancelled',message:'aborted'}; };
  stop(); await wait(380); stop();
  const out = demoRespond(prompt), lines = out.split('\n');
  if(lines.length>1 && lines.every(l=>l.trim().startsWith('{'))){
    let text = '';
    for(const l of lines){ stop(); text += l+'\n'; if(o.onText) o.onText({text}); await wait(170); }
  } else if(o.onText) o.onText({text:out});
  stop();
  return {text:out,truncated:false};
}

