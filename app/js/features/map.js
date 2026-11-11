'use strict';
/* ================= map layer + grill ================= */
const side = $('#side'), mDest = $('#mDest'), mLists = $('#mLists');
const gIdle = $('#gIdle'), gSession = $('#gSession'), gCards = $('#gCards'), gNote = $('#gNote'), gDone = $('#gDone');
let curStab = 'map';
const G = {active:false,scope:null,cards:[],round:0,history:[],busy:false,done:false,failed:false,summary:'',resolve:false,yes:0,ctl:null,seq:0};

function showStab(t){
  curStab = t;
  [['#stMap','map'],['#stGrill','grill'],['#stAsk','ask']].forEach(([sel,k])=>$(sel).setAttribute('aria-pressed',String(t===k)));
  $('#s-map').hidden = t!=='map'; $('#s-grill').hidden = t!=='grill'; $('#s-ask').hidden = t!=='ask';
  S.layer = t!=='ask';
  $('#mapBtn').setAttribute('aria-pressed',String(!side.hidden && t!=='ask'));
  $('#askBtn').setAttribute('aria-pressed',String(!side.hidden && t==='ask'));
  layout(false); applyView(); updateHud();
  if(t==='map') renderMap(); else if(t==='grill') renderGrillShell(); else renderAsk();
}
function openSide(tab){
  side.hidden = false;
  stage.style.setProperty('--drawer', drawerW()+'px');
  showStab(tab || curStab);
}
function closeSide(){
  side.hidden = true; S.layer = false; linkFrom = null;
  stage.style.setProperty('--drawer','0px');
  $('#mapBtn').setAttribute('aria-pressed','false'); $('#askBtn').setAttribute('aria-pressed','false');
  layout(false); applyView(); updateHud();
}
function focusNode(id){
  if(!S.nodes[id]) return;
  if(S.mode==='outer') setMode('detail');
  expandChain(S.nodes[id].parent); layout(false); select(id); ensureVisible(id);
}

/* ---- ticket + map actions on nodes ---- */
function cycleTicket(id){ const n = S.nodes[id]; if(!n) return; pushHist(); n.ticket = TICKETS[(TICKETS.indexOf(n.ticket||'talk')+1)%TICKETS.length]; commit(); }
function toggleOut(id){
  const n = S.nodes[id]; if(!n) return; pushHist();
  if(n.state==='out'){ n.state = n.was || 'open'; delete n.was; } else { n.was = n.state || 'open'; n.state = 'out'; }
  commit();
}
function reopenQ(id){ const n = S.nodes[id]; if(!n) return; pushHist(); n.state = 'open'; commit(); }
function startBlock(id){ linkFrom = id; restyle(); showNote(['Click the question that must be settled first. Esc cancels.'],false); }
function finishBlock(blockerId){
  const blocked = linkFrom; linkFrom = null; restyle();
  const a = S.nodes[blockerId], b = S.nodes[blocked];
  if(!a || !b || blockerId===blocked) return;
  if(a.type!=='question' || b.type!=='question'){ showNote(['Blocking works between two questions.'],false); return; }
  const i = S.links.findIndex(l=>l.kind==='block' && l.a===blockerId && l.b===blocked);
  if(i>=0){ pushHist(); S.links.splice(i,1); commit(); showNote(['Removed the block.'],true); return; }
  if(blockCycle(blockerId,blocked)){ showNote(['That would make two questions wait on each other.'],false); return; }
  pushHist(); S.links.push({a:blockerId,b:blocked,kind:'block'}); commit();
  showNote([{b:`“${b.text}”`},' now waits for ',{b:`“${a.text}”`},'.'],true);
}

/* ---- map tab ---- */
function decisionOf(id){
  rebuildKM();
  const kids = (KM[id]||[]).map(k=>S.nodes[k]).filter(x=>x && x.type==='answer' && !x.ghost);
  const d = kids.find(x=>x.decided) || kids[0];
  return d ? d.text : '';
}
function mkItem(id,o){
  const n = S.nodes[id], el = document.createElement('div');
  el.className = 'mitem'; el.dataset.id = id; el.tabIndex = 0;
  const t = document.createElement('div'); t.textContent = n.text; el.appendChild(t);
  if(o.dec){ const d = document.createElement('div'); d.className = 'dec'; d.textContent = '→ '+o.dec; el.appendChild(d); }
  const row = document.createElement('div'); row.className = 'mrow2';
  (o.chips||[]).forEach(c=>{ const sp = document.createElement('span'); sp.className = 'chip2'; sp.textContent = c; row.appendChild(sp); });
  (o.acts||[]).forEach(([act,label])=>{ const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.dataset.act = act; b.textContent = label; row.appendChild(b); });
  if(row.children.length) el.appendChild(row);
  return el;
}
function mkSection(title,ids,build){
  if(!ids.length) return null;
  const w = document.createElement('div'); w.className = 'msec';
  const h = document.createElement('h4'); const a = document.createElement('div'); a.textContent = title; const c = document.createElement('span'); c.textContent = String(ids.length); h.append(a,c); w.appendChild(h);
  ids.slice(0,14).forEach(id=>w.appendChild(build(id)));
  if(ids.length>14){ const m = document.createElement('div'); m.className = 'small'; m.textContent = `and ${ids.length-14} more`; w.appendChild(m); }
  return w;
}
function renderMap(){
  MAP = computeMap(); const m = MAP;
  if(document.activeElement!==mDest) mDest.value = PREFS.goal || '';
  const total = m.settled.length + m.frontier.length + m.blocked.length;
  $('#mProg').style.width = (total ? Math.round(m.settled.length/total*100) : 0)+'%';
  $('#mProgTxt').textContent = total ? `${m.settled.length} of ${total} settled` : 'No decisions yet';
  const hint = $('#mHint');
  if(!(PREFS.goal||'').trim()) hint.textContent = 'Name the destination first. Everything on the map is measured against it.';
  else if(total && !m.frontier.length && !m.blocked.length && !m.fog.length) hint.textContent = 'The map is clear. Nothing is left to decide before you build.';
  else if(!total && !m.fog.length) hint.textContent = 'Chart the map to draft decision tickets, or grill the tree to find them.';
  else hint.textContent = m.fog.length && !m.frontier.length && !m.blocked.length ? 'Only fog is left. Sharpen it into questions once you can phrase them.' : '';
  const kids = [];
  const tk = id => TICKET_LABEL[S.nodes[id].ticket||'talk'];
  kids.push(mkSection('Up next',m.frontier,id=>mkItem(id,{chips:[tk(id)],acts:[['resolve','Resolve']]})));
  kids.push(mkSection('Waiting',m.blocked,id=>{
    const w = (m.blockers[id]||[]).map(b=>S.nodes[b]).filter(b=>b && b.state!=='settled' && b.state!=='out')[0];
    return mkItem(id,{chips:[tk(id),w ? 'after: '+w.text.slice(0,32) : 'waiting']});
  }));
  kids.push(mkSection('Decisions so far',m.settled,id=>mkItem(id,{dec:decisionOf(id),acts:[['reopen','Reopen']]})));
  kids.push(mkSection('Fog',m.fog,id=>mkItem(id,{acts:[['sharpen','Sharpen']]})));
  kids.push(mkSection('Out of scope',m.out,id=>mkItem(id,{acts:[['restore','Bring back']]})));
  mLists.textContent = ''; kids.filter(Boolean).forEach(k=>mLists.appendChild(k));
}
function renderMapIfOpen(){ try{ const s = document.getElementById('side'); if(s && !s.hidden && curStab==='map') renderMap(); }catch(e){} }
mLists.addEventListener('click',e=>{
  const item = e.target.closest('.mitem'); if(!item) return;
  const id = item.dataset.id, b = e.target.closest('button[data-act]');
  if(!b){ focusNode(id); return; }
  const a = b.dataset.act;
  if(a==='resolve') startResolve(id);
  else if(a==='reopen') reopenQ(id);
  else if(a==='restore') toggleOut(id);
  else if(a==='sharpen'){ focusNode(id); beginEdit(id,{graduate:true}); }
});
mDest.addEventListener('input',()=>{ PREFS.goal = mDest.value; savePrefs(); updateGoalChip(); updatePreview(); });
function chartMap(){
  const hint = $('#mHint');
  if(!(PREFS.goal||'').trim()){ hint.textContent = 'Name the destination first. Everything on the map is measured against it.'; mDest.focus(); return; }
  if(!aiAvailable()){ showNote([aiNeed('Charting')],false); return; }
  const root = S.order.find(id=>S.nodes[id] && !S.nodes[id].parent && !S.nodes[id].ghost);
  if(!root){ hint.textContent = 'Plant at least one node first, then chart the map around it.'; return; }
  if(S.mode==='outer') setMode('detail');
  enqueue(async()=>{ const c = new AbortController(); ctl = c; pushHist(); try{ await expandFrom(root,c.signal,'chart'); } finally{ ctl = null; } });
}

/* ---- grill ---- */
function resetG(){
  if(G.ctl) G.ctl.abort();
  Object.assign(G,{active:false,scope:null,cards:[],round:0,history:[],busy:false,done:false,failed:false,summary:'',resolve:false,yes:0,ctl:null,seq:0});
  gCards.textContent = ''; gNote.hidden = true; gDone.hidden = true;
}
function renderGrillShell(){
  gIdle.hidden = G.active; gSession.hidden = !G.active;
  const sc = G.scope && S.nodes[G.scope];
  $('#gScope').textContent = G.resolve ? 'Resolving one question' : (sc ? 'Grilling: '+sc.text.slice(0,44) : 'Grilling the whole tree');
  $('#gRound').textContent = G.resolve ? '' : 'Round '+G.round;
  $('#gNext').hidden = G.resolve || G.done; $('#gNext').disabled = G.busy; $('#gNext').textContent = G.busy ? 'Asking…' : 'Next round';
}
function gNoteShow(t){ gNote.textContent = t; gNote.hidden = !t; }
function startGrill(scopeId){
  openSide('grill');
  if(!aiAvailable()){ resetG(); renderGrillShell(); const m = $('#gIdleMsg'); m.textContent = aiNeed('Grilling'); m.hidden = false; return; }
  $('#gIdleMsg').hidden = true; resetG(); G.active = true; G.scope = scopeId || null; renderGrillShell(); nextRound();
}
function startResolve(id){
  const n = S.nodes[id]; if(!n || n.type!=='question') return;
  openSide('grill'); $('#gIdleMsg').hidden = true; resetG(); G.active = true; G.resolve = true; G.scope = id; G.round = 1;
  renderGrillShell();
  addCard({nodeId:id,text:n.text,why:n.why||'',ticket:n.ticket||'talk',parent:n.parent,grillable:true});
}
function applySingle(){
  const single = PREFS.grillStyle==='single' && !G.resolve; let shown = false;
  for(const c of G.cards){
    if(!single || c.status!=='open'){ c.el.hidden = false; continue; }
    c.el.hidden = shown; shown = true;
  }
}
function addCard(spec){
  const card = {id:'c'+(++G.seq),nodeId:spec.nodeId||null,text:spec.text,why:spec.why||'',ticket:spec.ticket||'talk',parent:spec.parent||null,grillable:spec.grillable!==false,status:'open',checks:0};
  const el = document.createElement('div'); el.className = 'gcard'; el.dataset.cid = card.id;
  el.innerHTML = '<div class="gq"></div><div class="gwhy"></div><div class="gtag" hidden></div><textarea class="area gans" rows="3"></textarea><div class="gpush" hidden></div><div class="gbtns"><button type="button" class="btn primary" data-gact="answer">Answer</button><button type="button" class="btn" data-gact="standby" hidden>Stand by it</button><button type="button" class="btn" data-gact="idk">I don’t know</button><button type="button" class="btn" data-gact="proto">Needs a prototype</button><button type="button" class="btn" data-gact="out">Out of scope</button><button type="button" class="btn" data-gact="skip">Skip</button></div><div class="gstate" hidden></div>';
  el.querySelector('.gq').textContent = card.text;
  const why = el.querySelector('.gwhy'); why.textContent = card.why; why.hidden = !card.why;
  const tag = el.querySelector('.gtag');
  if(!card.grillable){ tag.textContent = 'Talking probably won’t settle this. A prototype may be faster.'; tag.hidden = false; }
  else if(card.ticket!=='talk'){ tag.textContent = TICKET_LABEL[card.ticket]+' ticket'; tag.hidden = false; }
  card.ta = el.querySelector('textarea'); card.ta.placeholder = TICKET_ASK[card.ticket];
  card.el = el; card.pushEl = el.querySelector('.gpush'); card.stateEl = el.querySelector('.gstate');
  card.ansBtn = el.querySelector('[data-gact=answer]'); card.standBtn = el.querySelector('[data-gact=standby]'); card.btnsEl = el.querySelector('.gbtns');
  if(card.ticket==='prototype') el.querySelector('[data-gact=proto]').hidden = true;
  gCards.appendChild(el); G.cards.push(card); applySingle();
  return card;
}
function setCardBusy(card,on,label){
  card.el.querySelectorAll('button,textarea').forEach(x=>{ x.disabled = on; });
  card.ansBtn.textContent = on ? label : (card.checks>0 ? 'Answer again' : 'Answer');
}
function finishCard(card,status,msg,withProtoBtn){
  card.status = status; card.el.classList.add('done'); card.ta.disabled = true; card.btnsEl.hidden = true; card.pushEl.hidden = true;
  card.stateEl.textContent = msg; card.stateEl.hidden = false;
  if(withProtoBtn){ const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.dataset.gact = 'toproto'; b.textContent = 'Make it a prototype'; card.stateEl.appendChild(b); }
  applySingle(); renderGrillShell(); checkRoundEnd();
}
function ensureQuestion(card){
  if(card.nodeId && S.nodes[card.nodeId]) return S.nodes[card.nodeId];
  const parent = card.parent && S.nodes[card.parent] ? card.parent : null;
  const id = addNode({type:'question',text:card.text,parent});
  const q = S.nodes[id]; q.ticket = card.ticket; q.state = 'open'; if(card.why) q.why = card.why; card.nodeId = id;
  return q;
}
function commitAnswer(card,text){
  pushHist();
  const q = ensureQuestion(card); q.state = 'settled'; delete q.unknown;
  const aid = addNode({type:'answer',text:text.length>220 ? text.slice(0,217)+'…' : text,parent:card.nodeId});
  const a = S.nodes[aid]; a.decided = true; if(text.length>220) a.note = text.slice(0,1000);
  G.history.push({q:card.text,a:text,s:'settled'});
  commit(); ensureVisible(card.nodeId);
  finishCard(card,'settled','Settled. It’s on the canvas as a decision.');
}
function trackYes(text){
  const quick = /^(yes|yep|yeah|ok|okay|agreed?|sure|fine|sounds good|right|correct|true|makes sense)[\s.!]*$/i.test(text.trim());
  G.yes = quick ? G.yes+1 : 0;
  if(G.yes>=3) gNoteShow(`That’s ${G.yes} quick agreements in a row. Push back on one before moving on. A session where you never disagree is one you didn’t need.`);
  else if(G.yes===0 && gNote.textContent.startsWith('That’s')) gNoteShow('');
}
async function askPushback(card,text){
  const ev = await projectEvidence(card.text+' '+text,4);
  const prompt = `You are a sharp but fair design interviewer. A ${DOM().personFull} just answered a question. Decide whether the answer needs pushback and, if it does, give it. You never answer for the ${DOM().person}, never suggest an alternative decision and never offer options to pick from.

${guideBlock()}TREE (id | type | text | parent):
${treeText()}

QUESTION: ${card.text}
WHY IT WAS ASKED: ${card.why || 'not stated'}
THE ${DOM().person.toUpperCase()}'S ANSWER: ${text}
${ev ? '\n'+ev.block+'\n' : ''}
Push back only when you see a real problem: a hidden assumption, a conflict with something already in the tree or with the destination, an unexamined consequence, or an answer too vague to act on. If the answer holds up, say so.
${ev ? 'If the answer conflicts with what the excerpts show, say so and cite the excerpt id like [f2].\n' : ''}Reply with ONLY a JSON object, no markdown:
{"verdict":"solid or challenge","text":"if challenge: one or two sentences phrased as a pointed question. If solid: empty."}`;
  const c = new AbortController(); G.ctl = c;
  try{ const out = await callAI(prompt,{signal:c.signal,temperature:.3}); const r0 = parseObj(out.text); r0.refs = ev ? ev.refs : null; return r0; }
  finally{ if(G.ctl===c) G.ctl = null; }
}
async function submitAnswer(card){
  const text = card.ta.value.trim();
  if(!text){ card.ta.focus(); return; }
  trackYes(text);
  if(PREFS.pushback && aiAvailable() && card.checks<2){
    card.checks++; setCardBusy(card,true,'Thinking…');
    let r = null;
    try{ r = await askPushback(card,text); }catch(e){ if(e && e.code==='cancelled'){ setCardBusy(card,false); return; } }
    setCardBusy(card,false);
    if(r && r.verdict==='challenge' && typeof r.text==='string' && r.text.trim()){
      card.pushEl.textContent = citeText(r.text.trim(),r.refs).slice(0,420); card.pushEl.hidden = false;
      card.standBtn.hidden = false; card.ansBtn.textContent = 'Answer again'; card.ta.focus();
      return;
    }
  }
  commitAnswer(card,text);
}
function cardAction(card,act){
  if(card.status!=='open' && act!=='toproto') return;
  if(act==='answer') return submitAnswer(card);
  if(act==='standby'){ const t = card.ta.value.trim(); if(t) commitAnswer(card,t); return; }
  if(act==='skip'){ card.status = 'skipped'; card.el.remove(); G.cards = G.cards.filter(c=>c!==card); applySingle(); renderGrillShell(); checkRoundEnd(); return; }
  if(act==='toproto'){ const q = card.nodeId && S.nodes[card.nodeId]; if(q){ pushHist(); q.ticket = 'prototype'; commit(); card.stateEl.textContent = 'Now a prototype ticket. It stays open on the map.'; } return; }
  pushHist();
  const q = ensureQuestion(card);
  if(act==='idk'){ q.unknown = true; G.history.push({q:card.text,s:'the '+DOM().person+' did not know'}); commit(); finishCard(card,'unknown','Left open on the map. If talking won’t get you there, try a prototype.',card.ticket!=='prototype'); }
  else if(act==='proto'){ q.ticket = 'prototype'; G.history.push({q:card.text,s:'needs a prototype'}); commit(); finishCard(card,'proto','Now a prototype ticket. It stays open on the map.'); }
  else if(act==='out'){ q.was = q.state || 'open'; q.state = 'out'; G.history.push({q:card.text,s:'out of scope'}); commit(); finishCard(card,'out','Parked as out of scope.'); }
}
gCards.addEventListener('click',e=>{
  const b = e.target.closest('button[data-gact]'); if(!b) return;
  const el = b.closest('.gcard'), card = G.cards.find(c=>c.id===el.dataset.cid);
  if(card) cardAction(card,b.dataset.gact);
});
function checkRoundEnd(){
  if(G.resolve || G.yes>=3) return;   // keep the passivity nudge on screen
  const open = G.cards.filter(c=>c.status==='open').length;
  if(!open && !G.busy && G.cards.length) gNoteShow(G.round>=5 ? 'That’s a long session. Consider ending it and grilling a smaller branch.' : 'Round complete. Ask for the next one when you’re ready.');
}
function roundPrompt(ev){
  const sc = G.scope && S.nodes[G.scope];
  const fog = S.order.filter(id=>S.nodes[id] && S.nodes[id].type==='fog' && S.nodes[id].state!=='out' && !S.nodes[id].ghost).map(id=>`- ${S.nodes[id].text}`).join('\n');
  const hist = G.history.map(h=>h.s==='settled' ? `Q: ${h.q}\nA: ${h.a}` : `Q: ${h.q}\n(${h.s})`).join('\n\n');
  return `You are interviewing a ${DOM().personFull} so they can commit to decisions. You ask, they decide. You are working in rounds: a round is every question whose prerequisites the ${DOM().person} has already settled. Never ask a question that depends on an answer you have not heard yet.

${guideBlock()}TREE (id | type | text | parent):
${S.order.length ? treeText() : '(empty)'}${ev ? '\n\n'+ev.block : ''}
${sc ? '\nSCOPE: stay inside this part of the tree: '+sc.text+' ('+G.scope+')\n' : ''}${fog ? '\nFOG (decisions coming that the '+DOM().person+' cannot phrase yet):\n'+fog+'\n' : ''}${hist ? '\nSESSION SO FAR:\n'+hist+'\n' : ''}
Write one JSON object per line (NDJSON). No markdown, no commentary. Each line:
{"id":"q1","parent":"<id of the existing node this question comes out of>","text":"<question, at most 18 words>","why":"<at most 20 words on what answering it unlocks>","ticket":"talk|prototype|research|task","grillable":true}

Rules:
- Ask 3 to 6 questions this round, all independent of each other.
- Never answer a question yourself, never offer options to pick from, and never hint at the answer.
- Prefer questions that expose decisions the ${DOM().person} is making without noticing, and that test the destination or the goal.
- Be specific to this ${DOM().subject} and this tree. Do not repeat anything already settled or already asked.
- Set grillable to false and ticket to prototype when the question cannot be settled by talking because the ${DOM().person} needs something to react to. Use research when a fact from outside the tree is needed and task when manual preparation blocks a decision.
${ev ? "- The excerpts show what the project already does. Where it has already made a decision, ask whether it is intended instead of asking as if the question were open. Where it conflicts with the tree or the goal, ask about the conflict.\n" : ''}- If nothing is left to ask, write exactly one line instead: {"done":true,"summary":"<at most 25 words on what is now settled>"}`;
}
async function nextRound(){
  if(G.busy || G.resolve) return;
  if(!aiAvailable()){ gNoteShow(aiNeed('Grilling')); return; }
  G.busy = true; G.failed = false; G.round++; G.cards = []; gCards.textContent = ''; gDone.hidden = true; gNoteShow('');
  renderGrillShell();
  const sc0 = G.scope && S.nodes[G.scope];
  const ev = await projectEvidence(((sc0 ? sc0.text+' ' : '')+(PREFS.goal||'')+' '+(PREFS.context||'')).trim() || (DOM().subject+' '+DOM().treeName),5);
  const c = new AbortController(); G.ctl = c;
  let done = 0, got = 0, cancelled = false;
  const parse = (text,final) => {
    const lines = text.split('\n'), upto = final ? lines.length : lines.length-1;
    for(; done<upto; done++){
      const ln = lines[done].trim().replace(/^```(json)?/,'').replace(/```$/,'').replace(/,$/,'').trim();
      if(!ln.startsWith('{')) continue;
      let o; try{ o = JSON.parse(ln); }catch(e){ continue; }
      if(o.done){ G.done = true; G.summary = typeof o.summary==='string' ? o.summary.slice(0,220) : ''; continue; }
      if(typeof o.text!=='string' || !o.text.trim() || got>=6) continue;
      const parent = S.nodes[o.parent] ? o.parent : (G.scope && S.nodes[G.scope] ? G.scope : null);
      addCard({text:o.text.trim().slice(0,200),why:typeof o.why==='string' ? o.why.slice(0,160) : '',ticket:TICKETS.includes(o.ticket) ? o.ticket : 'talk',parent,grillable:o.grillable!==false});
      got++;
    }
  };
  try{
    const out = await callAI(roundPrompt(ev),{cache:false,signal:c.signal,temperature:PREFS.creativity,onText:({text})=>parse(text,false)});
    parse(out.text,true);
  }catch(e){
    if(e && e.code==='cancelled') cancelled = true; else { G.failed = true; handleAIError(e); }
  }
  G.ctl = null; G.busy = false;
  if(!got && !G.done && !G.failed && !cancelled) G.done = true;
  if(G.failed) gNoteShow('That round didn’t come back. Try again.');
  if(G.done && !got){
    const n = G.history.filter(h=>h.s==='settled').length;
    gDone.textContent = (G.summary ? G.summary+' ' : '') + `Nothing is left unspoken for now. ${n} ${n===1?'decision is':'decisions are'} settled this session.`; gDone.hidden = false;
  }
  renderGrillShell(); checkRoundEnd();
}
$('#gStartAll').addEventListener('click',()=>startGrill(null));
$('#gStartSel').addEventListener('click',()=>startGrill(S.sel && S.nodes[S.sel] ? S.sel : null));
$('#gNext').addEventListener('click',nextRound);
$('#gEnd').addEventListener('click',()=>{ resetG(); renderGrillShell(); $('#gIdleMsg').hidden = true; });
$('#mChart').addEventListener('click',chartMap);
$('#mGrillAll').addEventListener('click',()=>startGrill(null));
$('#mapBtn').addEventListener('click',()=>{ if(side.hidden || curStab==='ask') openSide(curStab==='ask' ? 'map' : curStab); else closeSide(); });
$('#askBtn').addEventListener('click',()=>{ if(side.hidden || curStab!=='ask') openSide('ask'); else closeSide(); });
$('#stAsk').addEventListener('click',()=>showStab('ask'));
$('#sideClose').addEventListener('click',closeSide);
$('#stMap').addEventListener('click',()=>showStab('map'));
$('#stGrill').addEventListener('click',()=>showStab('grill'));

