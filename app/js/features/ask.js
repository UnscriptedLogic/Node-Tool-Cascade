'use strict';
/* ================= ask the graph ================= */
const AN = {q:'',verdict:'',answer:'',threads:[],gaps:[],sources:[],basis:'',summary:'',summaryKind:'',local:false,ctl:null,busy:false};
const AHIST = [];
const TCOL = ['var(--t0)','var(--t1)','var(--t2)'];
const VERDICT = {answered:'Answered by the tree',partial:'Partly answered',unanswered:'The tree can’t answer this yet'};
const aRes = $('#aRes'), aQ = $('#aQ'), aSumText = $('#aSumText'), aNext = $('#aNext');

function linksText(){
  return S.links.filter(l=>S.nodes[l.a] && S.nodes[l.b]).map(l=>`${l.a} -> ${l.b} (${l.kind==='block' ? 'must be settled first' : l.kind==='flow' ? 'leads to' : 'related'})`).join('\n');
}
function nodeLine(id){
  const n = S.nodes[id];
  return `${n.type}${n.type==='emotion' && n.mood ? ' ('+n.mood+')' : ''}${n.state==='settled' ? ' [settled]' : n.state==='out' ? ' [out of scope]' : ''}${n.decided ? ' [decision]' : ''}: ${n.text}`;
}
function askPrompt(q,ev){
  return `You are analysing a ${DOM().treeName} to answer the ${DOM().person}'s question using only what is in the tree${ev ? ' and the project excerpts below' : ''}.

${guideBlock()}TREE (id | type | text | parent):
${treeText()}

EXTRA LINKS BETWEEN NODES:
${linksText() || '(none)'}

${ev ? ev.block+'\n\n' : ''}QUESTION: ${q}

A thread is an ordered line of nodes, by id, that together answer the question and read like a chain of reasoning, for example a problem, its cause, the feeling it produces and the decision it leads to. A thread can follow tree edges or jump across branches along the extra links, but every consecutive pair must be genuinely connected in meaning.

Reply with ONLY a JSON object, no markdown:
{"verdict":"answered or partial or unanswered","answer":"<2 to 4 sentences answering from the tree only. If it is not answered, say what is missing.>","threads":[{"label":"<at most 6 words>","ids":["n1","n2"],"why":"<at most 25 words on how this thread answers the question>"}],"gaps":[{"text":"<a question that would fill a gap, at most 16 words>","parent":"<existing id it belongs under>"}]${ev ? ',"basis":"tree or code or both","sources":[{"id":"f1","note":"<at most 20 words on what it shows>"}]' : ''}}

Rules:
- Use only ids that appear in the tree. Ignore nodes marked as unaccepted suggestions.
- 2 to 8 nodes per thread and at most 3 threads. Order each thread from the start of the reasoning to its end.
- Never invent facts that are not in the tree. If the tree cannot answer, use verdict unanswered, an empty threads list and fill gaps.
- Leave gaps empty when the question is fully answered.${ev ? `
- The tree is the ${DOM().person}'s intent and the excerpts are what the project does today. Say which one the answer rests on in basis, and cite excerpt ids in the answer text like [f1].
- If the tree and the excerpts disagree, say so plainly in the answer.
- Excerpts are not tree nodes: never put an excerpt id in a thread.` : ''}`;
}
function cleanAsk(o,ev){
  const valid = id => typeof id==='string' && S.nodes[id] && !S.nodes[id].ghost;
  let verdict = ['answered','partial','unanswered'].includes(o.verdict) ? o.verdict : 'partial';
  const threads = (Array.isArray(o.threads) ? o.threads : []).slice(0,3).map(t=>({
    label:String((t && t.label) || 'Thread').slice(0,48), why:String((t && t.why) || '').slice(0,200),
    ids:[...new Set((Array.isArray(t && t.ids) ? t.ids : []).filter(valid))].slice(0,8), on:true
  })).filter(t=>t.ids.length>0);
  const gaps = (Array.isArray(o.gaps) ? o.gaps : []).slice(0,4).filter(g=>g && typeof g.text==='string' && g.text.trim()).map(g=>({text:g.text.trim().slice(0,140),parent:valid(g.parent) ? g.parent : null}));
  const sources = [];
  if(ev && Array.isArray(o.sources)) for(const x of o.sources){ const r = x && ev.refs[x.id]; if(r && sources.length<6 && !sources.some(y=>y.id===x.id)) sources.push({id:x.id,f:r.f,l:r.l,e:r.e,note:String(x.note || '').slice(0,160)}); }
  if(ev) String(o.answer || '').replace(/\[(f\d+)\]/g,(m,id)=>{ const r = ev.refs[id]; if(r && sources.length<6 && !sources.some(y=>y.id===id)) sources.push({id,f:r.f,l:r.l,e:r.e,note:''}); return m; });
  const basis = ['tree','code','both'].includes(o.basis) ? o.basis : (sources.length ? (threads.length ? 'both' : 'code') : 'tree');
  if(verdict!=='unanswered' && !threads.length && !sources.length) verdict = 'unanswered';
  return {verdict,answer:String(o.answer || '').slice(0,800),threads,gaps,sources,basis};
}
function localAnalyse(q){
  const words = new Set(toks(q)), scored = [];
  for(const id of S.order){
    const n = S.nodes[id]; if(!n || n.ghost || n.type==='loop') continue;
    const sc = toks(n.text).filter(w=>words.has(w)).length; if(sc>0) scored.push([sc,id]);
  }
  scored.sort((a,b)=>b[0]-a[0]);
  rebuildKM();
  const used = new Set(), threads = [];
  for(const [,id] of scored){
    if(threads.length>=3 || used.has(id)) continue;
    const up = []; let cur = S.nodes[id];
    while(cur && up.length<4){ up.unshift(cur.id); cur = cur.parent && S.nodes[cur.parent]; }
    const kid = (KM[id]||[]).map(k=>S.nodes[k]).find(k=>k && !k.ghost && (k.type==='emotion' || k.type==='answer'));
    const ids = [...up,...(kid ? [kid.id] : [])];
    ids.forEach(i=>used.add(i));
    threads.push({label:S.nodes[id].text.slice(0,30),why:'Shares words with your question.',ids,on:true});
  }
  return {verdict:threads.length ? 'partial' : 'unanswered',
    answer: threads.length ? 'The AI is off, so these are the closest keyword matches rather than a reasoned answer.' : 'No node shares words with that question, and the AI is off.',
    threads,gaps:[]};
}
function setAskBusy(on){ ['#aGo','#aSumAll','#aSum'].forEach(sel=>{ $(sel).disabled = on; }); }
async function runAsk(q){
  q = (q||'').trim(); if(!q || AN.busy) return;
  if(!S.order.length){ showNote(['The tree is empty, so there is nothing to ask yet.'],false); return; }
  track('ask');
  let res = null, local = false;
  if(aiAvailable()){
    AN.busy = true; setAskBusy(true); setBusy('Reading the graph…',true);
    const c = new AbortController(); AN.ctl = c;
    try{ const ev = await projectEvidence(q,6); res = cleanAsk(parseObj((await callAI(askPrompt(q,ev),{signal:c.signal,temperature:.2})).text),ev); }
    catch(e){
      if(e && e.code==='cancelled'){ AN.ctl = null; AN.busy = false; setBusy(null); setAskBusy(false); return; }
      if(e && e.code==='invalid_json') showNote(['The AI’s reply couldn’t be read, so this is a keyword match instead.'],false); else handleAIError(e);
    }
    AN.ctl = null; AN.busy = false; setBusy(null); setAskBusy(false);
  }
  if(!res){ res = localAnalyse(q); local = true; }
  applyAsk(q,res,local);
}
function applyAsk(q,res,local){
  Object.assign(AN,{q,verdict:res.verdict,answer:res.answer,threads:res.threads,gaps:res.gaps,sources:res.sources||[],basis:res.basis||'',summary:'',summaryKind:'',local:!!local});
  const i = AHIST.findIndex(h=>h.q===q); if(i>=0) AHIST.splice(i,1);
  AHIST.unshift(JSON.parse(JSON.stringify({q,verdict:res.verdict,answer:res.answer,threads:res.threads,gaps:res.gaps,sources:res.sources||[],basis:res.basis||'',local:!!local})));
  AHIST.length = Math.min(AHIST.length,8);
  $('#aSummaryWrap').hidden = true;
  revealThreads(); renderAsk();
}
function revealThreads(){
  if(S.mode==='outer') setMode('detail');
  const ids = [];
  AN.threads.forEach(t=>t.ids.forEach(id=>{ if(S.nodes[id]){ expandChain(S.nodes[id].parent); ids.push(id); } }));
  layout(false); rebuildHighlight();
  if(ids.length) fitTo(ids,{maxZ:1,minZ:.35,pad:70});
}
function rebuildHighlight(){
  THMAP = {}; THR = [];
  AN.threads.forEach((t,i)=>{
    if(!t.on) return;
    const ids = t.ids.filter(id=>S.nodes[id]); if(!ids.length) return;
    THR.push({ids,i});
    ids.forEach((id,k)=>{ if(!THMAP[id]) THMAP[id] = {step:k+1,color:TCOL[i%3]}; });
  });
  world.classList.toggle('spot',THR.length>0);
  const chip = $('#hlchip'); chip.hidden = !THR.length;
  chip.querySelector('.hl').textContent = AN.q ? 'Highlighting: '+AN.q.slice(0,56) : '';
  restyle(); kick();
}
function pruneThreads(){
  let ch = false;
  AN.threads.forEach(t=>{ const f = t.ids.filter(id=>S.nodes[id]); if(f.length!==t.ids.length){ t.ids = f; ch = true; } });
  const before = AN.threads.length; AN.threads = AN.threads.filter(t=>t.ids.length>0);
  if(AN.threads.length!==before) ch = true;
  if(ch){ rebuildHighlight(); renderAsk(); }
}
function mkThread(t,i){
  const el = document.createElement('div'); el.className = 'athread'+(t.on ? '' : ' off'); el.dataset.i = i;
  const head = document.createElement('div'); head.className = 'ath-head';
  const sw = document.createElement('span'); sw.className = 'swatch'; sw.style.background = TCOL[i%3];
  const b = document.createElement('b'); b.textContent = t.label;
  const tg = document.createElement('button'); tg.type = 'button'; tg.className = 'btn'; tg.dataset.aact = 'toggle'; tg.textContent = t.on ? 'Hide' : 'Show';
  head.append(sw,b,tg); el.appendChild(head);
  if(t.why){ const w = document.createElement('div'); w.className = 'ath-why'; w.textContent = t.why; el.appendChild(w); }
  const ol = document.createElement('ol'); ol.className = 'ath-steps';
  t.ids.forEach(id=>{
    const n = S.nodes[id]; if(!n) return;
    const li = document.createElement('li'); li.dataset.id = id;
    const ty = document.createElement('i'); ty.textContent = LABEL[n.type] || n.type;
    li.append(ty,document.createTextNode(n.text)); ol.appendChild(li);
  });
  el.appendChild(ol);
  return el;
}
function renderAskHist(){
  const w = $('#aHistWrap'), h = $('#aHist'); h.textContent = '';
  AHIST.forEach((x,i)=>{ const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.hi = i; b.textContent = x.q.length>44 ? x.q.slice(0,43)+'…' : x.q; b.title = x.q; h.appendChild(b); });
  w.hidden = !AHIST.length;
}
function renderAsk(){
  renderAskHist();
  const has = !!AN.q && !!AN.verdict; aRes.hidden = !has;
  if(!has) return;
  const v = $('#aVerdict'); v.className = 'averdict '+AN.verdict; v.textContent = VERDICT[AN.verdict] + (AN.local ? ' (keyword match)' : '');
  const bs = $('#aBasis'), BASIS = {tree:'From the tree',code:'From the project files',both:'From the tree and the files'};
  bs.hidden = !(AN.basis && (AN.sources||[]).length); bs.textContent = BASIS[AN.basis] || '';
  renderAnswer(); renderSources();
  const box = $('#aThreads'); box.textContent = '';
  AN.threads.forEach((t,i)=>box.appendChild(mkThread(t,i)));
  const g = $('#aGaps'); g.hidden = !AN.gaps.length;
  const gl = $('#aGapList'); gl.textContent = '';
  AN.gaps.forEach(x=>{ const d = document.createElement('div'); d.className = 'gapitem'; d.textContent = x.text; gl.appendChild(d); });
  $('#aSum').hidden = !AN.threads.length; aNext.closest('label').hidden = !AN.threads.length;
  $('#aSummaryWrap').hidden = !AN.summary && !AN.busy;
}
function addGaps(){
  const fallback = S.order.find(id=>S.nodes[id] && !S.nodes[id].parent);
  pushHist(); let n = 0;
  AN.gaps.forEach(g=>{ addNode({type:'question',text:g.text,parent:(g.parent && S.nodes[g.parent]) ? g.parent : (fallback || null),ghost:true}); n++; });
  AN.gaps = []; commit(); renderAsk();
  showNote([`Added ${n} suggested ${n===1 ? 'question' : 'questions'}. Keep the ones you want.`],true);
}
function threadSummaryPrompt(){
  const th = AN.threads.filter(t=>t.on).map((t,i)=>`Thread ${i+1}, ${t.label}${t.why ? ' ('+t.why+')' : ''}:\n`+t.ids.filter(id=>S.nodes[id]).map((id,k)=>`  ${k+1}. ${nodeLine(id)}`).join('\n')).join('\n\n');
  return `Summarise what a ${DOM().treeName} says in answer to a question, using only the highlighted threads below.

${guideBlock()}QUESTION: ${AN.q}

HIGHLIGHTED THREADS:
${th}

Write ${aNext.checked ? '3 to 5 sentences, then one sentence beginning "Next:" that names the single most useful thing to decide or test next,' : '3 to 5 sentences'} in plain prose. No bullet points, no headings, no markdown. Stay faithful to the nodes: say what is settled and what is still open, and do not add facts or recommendations that are not in them.`;
}
function treeSummaryPrompt(){
  return `Summarise this ${DOM().treeName} for the ${DOM().person}.

${guideBlock()}TREE (id | type | text | parent):
${treeText()}

EXTRA LINKS BETWEEN NODES:
${linksText() || '(none)'}

Write two short paragraphs of plain prose, with no bullet points, headings or markdown. First: where the design stands, what is settled, and what the tree is mostly about${(PREFS.goal||'').trim() ? ', measured against the goal' : ''}. Second: the main player feelings in the tree and what seems to cause them, then what is still undecided.${aNext.checked ? ' End with one sentence beginning "Next:" that names the most useful thing to decide or test next.' : ''} Use only what is in the tree.`;
}
async function summarize(kind){
  if(!aiAvailable()){ showNote([aiNeed('Summaries')],false); return; }
  if(AN.busy) return;
  if(kind==='tree' && !S.order.length){ showNote(['The tree is empty, so there is nothing to summarise.'],false); return; }
  if(kind==='threads' && !AN.threads.some(t=>t.on)){ showNote(['Show at least one thread first.'],false); return; }
  AN.busy = true; setAskBusy(true); setBusy('Summarizing…',true);
  const c = new AbortController(); AN.ctl = c;
  AN.summaryKind = kind;
  $('#aSumLabel').textContent = kind==='tree' ? 'Summary of the whole tree' : 'Summary of the highlighted threads';
  $('#aSummaryWrap').hidden = false; aSumText.textContent = '';
  try{
    const out = await callAI(kind==='tree' ? treeSummaryPrompt() : threadSummaryPrompt(),{signal:c.signal,temperature:.4,onText:({text})=>{ aSumText.textContent = text; }});
    AN.summary = out.text.trim(); aSumText.textContent = AN.summary;
  }catch(e){
    if(!(e && e.code==='cancelled')) handleAIError(e);
    if(!aSumText.textContent.trim()) $('#aSummaryWrap').hidden = true;
  }
  AN.ctl = null; AN.busy = false; setBusy(null); setAskBusy(false);
}
function restoreAsk(i){
  const h = AHIST[i]; if(!h) return;
  const c = JSON.parse(JSON.stringify(h));
  Object.assign(AN,{q:c.q,verdict:c.verdict,answer:c.answer,threads:c.threads,gaps:c.gaps,sources:c.sources||[],basis:c.basis||'',local:!!c.local,summary:'',summaryKind:''});
  AN.threads.forEach(t=>{ t.on = true; });
  aQ.value = c.q; $('#aSummaryWrap').hidden = true; revealThreads(); renderAsk();
}
$('#aGo').addEventListener('click',()=>runAsk(aQ.value));
aQ.addEventListener('keydown',e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); runAsk(aQ.value); } });
$('#aChips').addEventListener('click',e=>{ const c = e.target.closest('.chip'); if(!c) return; aQ.value = c.textContent; runAsk(aQ.value); });
$('#aHist').addEventListener('click',e=>{ const c = e.target.closest('.chip'); if(c) restoreAsk(+c.dataset.hi); });
$('#aThreads').addEventListener('click',e=>{
  const li = e.target.closest('li[data-id]');
  if(li){ focusNode(li.dataset.id); return; }
  const b = e.target.closest('button[data-aact="toggle"]'); if(!b) return;
  const i = +b.closest('.athread').dataset.i; AN.threads[i].on = !AN.threads[i].on; rebuildHighlight(); renderAsk();
});
$('#aAddGaps').addEventListener('click',addGaps);
$('#aSum').addEventListener('click',()=>summarize('threads'));
$('#aSumAll').addEventListener('click',()=>summarize('tree'));
$('#aCopy').addEventListener('click',async()=>{
  try{ await navigator.clipboard.writeText(aSumText.textContent); $('#aCopy').textContent = 'Copied'; setTimeout(()=>{ $('#aCopy').textContent = 'Copy'; },1400); }
  catch(e){ $('#aCopy').textContent = 'Select and copy'; setTimeout(()=>{ $('#aCopy').textContent = 'Copy'; },2000); }
});
$('#hlchip').addEventListener('click',()=>{ AN.threads.forEach(t=>{ t.on = false; }); rebuildHighlight(); renderAsk(); });

