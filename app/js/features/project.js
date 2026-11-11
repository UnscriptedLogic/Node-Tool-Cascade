'use strict';
/* ================= project folder (local app only) ================= */
const DEPTHS = {quick:{groups:6,chars:16000},standard:{groups:12,chars:22000},thorough:{groups:24,chars:26000}};
const KINDS = ['mechanic','parameter','state','decision','open','constraint','system'];
let projDepth = 'standard', PGROUPS = null, PFIND = null, projBusy = false, projCtl = null, prevBrief = null, scanBusy = false;
const projectReady = () => !!(PROJ && PROJ.has);
const briefText = () => ((PROJ && PROJ.brief) || '').trim();
const projectBriefOn = () => LOCAL && PREFS.useProject && projectReady() && !!briefText();
const fmtN = (n) => n>=10000 ? Math.round(n/1000)+'k' : n>=1000 ? (n/1000).toFixed(1)+'k' : String(n);
async function fetchJSON(url){
  const r = await fetch(url); let j = {}; try{ j = await r.json(); }catch(e){}
  if(!r.ok) throw new Error(j.detail || j.error || ('HTTP '+r.status));
  return j;
}
const pMsg = (t,cls) => { const e = $('#pMsg'); e.textContent = t || ''; e.className = cls || ''; };
const pProg = (t,cls) => { const e = $('#pProg'); e.textContent = t || ''; e.className = cls || ''; };
const citeName = (r) => r.f.split('/').pop()+':'+r.l;
function citeText(text,refs){ return refs ? String(text).replace(/\[(f\d+)\]/g,(m,id)=>refs[id] ? '('+citeName(refs[id])+')' : m) : text; }

/* --- evidence: the few excerpts that matter for one question, found locally --- */
async function projectEvidence(q,k){
  if(!LOCAL || !PREFS.askFiles || !projectReady() || activeProvider()==='demo') return null;
  try{
    const r = await postJSON('/api/project/search',{q:String(q).slice(0,500),k:k || 6});
    const hits = r.results || []; if(!hits.length) return null;
    const refs = {}; let block = 'PROJECT EXCERPTS (what the project’s notes and code actually say right now; cite them by id like [f1]):\n';
    hits.forEach((h,i)=>{ const id = 'f'+(i+1); refs[id] = {f:h.file,l:h.start,e:h.end}; block += `[${id}] ${h.file} lines ${h.start}-${h.end}\n${String(h.text).slice(0,1100)}\n\n`; });
    return {block:block.trim(),refs};
  }catch(e){ return null; }
}

/* --- source viewer --- */
let SV = {list:[],i:0};
function closeSrcView(){ $('#srcview').hidden = true; }
async function showSrc(){
  const s0 = SV.list[SV.i]; if(!s0) return;
  const hi = s0.e || s0.l;
  $('#svTitle').textContent = s0.f+':'+s0.l+(s0.e && s0.e>s0.l ? '-'+s0.e : '');
  const note = $('#svNote'); note.textContent = s0.note || ''; note.hidden = !s0.note;
  $('#svPos').textContent = SV.list.length>1 ? `${SV.i+1} of ${SV.list.length}` : '';
  $('#svPrev').disabled = $('#svNext').disabled = SV.list.length<2;
  const code = $('#svCode'); code.textContent = 'Loading…';
  try{
    const r = await fetchJSON(`/api/project/file?path=${encodeURIComponent(s0.f)}&start=${Math.max(1,s0.l-8)}&end=${hi+18}`);
    code.textContent = '';
    r.text.split('\n').forEach((line,k)=>{
      const n = r.start+k, row = document.createElement('div'); row.className = 'ln'+(n>=s0.l && n<=hi ? ' hit' : '');
      const no = document.createElement('span'); no.className = 'no'; no.textContent = n;
      const tx = document.createElement('span'); tx.textContent = line || ' ';
      row.append(no,tx); code.appendChild(row);
    });
  }catch(e){ code.textContent = e.message+' Rescan the project in Settings to refresh it.'; }
}
function openSrcView(list,i){ if(!list.length) return; SV = {list,i:i || 0}; $('#srcview').hidden = false; showSrc(); $('#svClose').focus(); }
function openNodeSrc(id){
  const n = S.nodes[id]; if(!n || !n.src || !n.src.length) return;
  openSrcView(n.src.map(x=>({f:x.f,l:x.l,note:x.t || n.text})),0);
}
$('#svClose').addEventListener('click',closeSrcView);
$('#svPrev').addEventListener('click',()=>{ SV.i = (SV.i+SV.list.length-1)%SV.list.length; showSrc(); });
$('#svNext').addEventListener('click',()=>{ SV.i = (SV.i+1)%SV.list.length; showSrc(); });
$('#svCopy').addEventListener('click',async()=>{ const s0 = SV.list[SV.i]; try{ await navigator.clipboard.writeText(s0.f+':'+s0.l); $('#svCopy').textContent = 'Copied'; setTimeout(()=>{ $('#svCopy').textContent = 'Copy path'; },1400); }catch(e){} });
addEventListener('keydown',e=>{ if(e.key==='Escape' && !$('#srcview').hidden){ e.stopImmediatePropagation(); closeSrcView(); } },true);

/* --- Ask: cites in the answer, and the list of what it read --- */
function renderAnswer(){
  const box = $('#aAnswer'); box.textContent = '';
  const byId = Object.fromEntries((AN.sources || []).map(x=>[x.id,x]));
  String(AN.answer || '').split(/(\[f\d+\])/).forEach(part=>{
    const m = part.match(/^\[(f\d+)\]$/);
    if(m && byId[m[1]]){ const b = document.createElement('button'); b.type = 'button'; b.className = 'cite'; b.dataset.cite = m[1]; b.textContent = citeName(byId[m[1]]); box.appendChild(b); }
    else box.appendChild(document.createTextNode(part));
  });
}
function renderSources(){
  const wrap = $('#aSources'), list = $('#aSourceList'); list.textContent = '';
  wrap.hidden = !(AN.sources || []).length;
  (AN.sources || []).forEach((x,i)=>{
    const d = document.createElement('div'); d.className = 'srcitem';
    if(x.note){ const t = document.createElement('div'); t.textContent = x.note; d.appendChild(t); }
    const w = document.createElement('div'); w.className = 'where';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cite'; b.dataset.cite = x.id; b.textContent = x.f+':'+x.l+(x.e && x.e>x.l ? '-'+x.e : '');
    w.appendChild(b); d.appendChild(w); list.appendChild(d);
  });
}
$('#aRes').addEventListener('click',e=>{
  const b = e.target.closest('button[data-cite]'); if(!b) return;
  const list = (AN.sources || []).map(x=>({f:x.f,l:x.l,e:x.e,note:x.note || ''}));
  const i = (AN.sources || []).findIndex(x=>x.id===b.dataset.cite);
  if(i>=0) openSrcView(list,i);
});
function updateAskFiles(){ const row = $('#aFilesRow'); row.hidden = !(LOCAL && projectReady()); $('#aFiles').checked = !!PREFS.askFiles; }

/* --- streaming helper: one JSON object per line --- */
async function streamLines(prompt,o){
  let done = 0;
  const parse = (text,final) => {
    const lines = text.split('\n'), upto = final ? lines.length : lines.length-1;
    for(; done<upto; done++){
      const ln = lines[done].trim().replace(/^```(json)?/,'').replace(/```$/,'').replace(/,$/,'').trim();
      if(!ln.startsWith('{')) continue;
      let v; try{ v = JSON.parse(ln); }catch(e){ continue; }
      o.onObj(v);
    }
  };
  const out = await callAI(prompt,{cache:false,signal:o.signal,temperature:o.temperature,onText:({text})=>parse(text,false)});
  parse(out.text,true);
  return out.text;
}

/* --- the prompts --- */
function mapPrompt(g,engine){
  return `You are reading part of a ${DOM().projectNoun}${engine && engine!=='a generic project' ? ' ('+engine+')' : ''} so its ${DOM().person} can see what the notes and code already decide.

FOLDER: ${g.label}

PER-FILE DIGESTS (symbols, tuning values and open comments, with line numbers):
${g.digest}${g.excerpts ? '\nRAW EXCERPTS:\n'+g.excerpts : ''}
Write one JSON object per line (NDJSON). No markdown, no commentary. Each line is one finding:
{"kind":"mechanic|parameter|state|decision|open|constraint|system","text":"<one plain sentence, at most 28 words>","file":"<a path from above>","line":<line number>}

Rules:
- Describe what the ${DOM().subject} does or has decided, in plain language, not how the files or code are organised.
- mechanic: a rule or process by which something works.
- parameter: a value that shapes the outcome, with the value ("The trial lasts 14 days and renewals are 20% cheaper").
- state: a mode or state machine the ${DOM().subject} has ("An order moves through Draft, Review and Approved").
- decision: a choice the notes or code clearly make.
- open: a TODO, FIXME, TBD or visibly unfinished piece, and what is unsettled.
- constraint: a rule, cap or restriction.
- system: a major system and the role it plays.
- Use only what is above. Never invent anything. Give the best file and line for each finding.
- At most 12 findings, the most design-relevant first. Skip rendering, networking and other plumbing.`;
}
function briefPrompt(findings,engine){
  const body = findings.map(f=>`${f.kind}: ${f.text} [${(f.refs[0] || {}).file || ''}]`).join('\n');
  return `You are writing a brief about a ${DOM().projectNoun}${engine && engine!=='a generic project' ? ' ('+engine+')' : ''} for a ${DOM().personFull}'s tool. Below are findings from reading the project's notes and code, in no particular order. Write the brief that the tool reads before every task.

FINDINGS:
${body}

Write plain prose under these headings, each heading on its own line followed by a short paragraph: What it is. How it plays. Systems. Values that matter. Unfinished or undecided. Rules and limits.
Rules: at most 4500 characters in total. Use only the findings and quote values exactly. No bullet points and no markdown symbols. Where findings seem to disagree, say so plainly. Leave out a heading when the findings say nothing about it.`;
}
function seedPrompt(findings){
  const order = ['decision','open','constraint','state','mechanic','parameter','system'];
  const list = [...findings].sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind)).slice(0,90);
  const f = list.map(x=>`${x.id} | ${x.kind} | ${x.text} | ${x.refs[0] ? x.refs[0].file+':'+x.refs[0].line : ''}`).join('\n');
  const size = {small:10,medium:16,large:24}[PREFS.growSize] || 16;
  return `You are turning what a ${DOM().projectNoun} already contains into a decision tree for its ${DOM().person}. Every node must come from the findings below. You add no facts of your own.

${guideBlock()}TREE (id | type | text | parent):
${S.order.length ? treeText() : '(empty)'}

FINDINGS FROM THE PROJECT (id | kind | text | file:line):
${f}

Write one JSON object per line (NDJSON). No markdown, no commentary. Each line:
{"id":"s1","parent":"<an existing id, an earlier sN, or null for a first node>","type":"loop|decision|question|consequence|fog","text":"<at most 16 words>","ticket":"talk|prototype|research|task","from":["f3","f7"]}

Rules:
- decision: something the project has already settled, in design language ("Walking is slow on purpose: base speed 6.5"). Use it for mechanics, parameters, states and constraints.
- question: something the project leaves open (TODOs, FIXMEs, TBDs), or where the project seems to conflict with the goal, the pillars or something already in the tree. ticket applies to questions only.
- fog: an area the project hints at but has not defined yet.
- consequence: only an effect that follows directly from a value or rule in a finding, such as what a stamina limit does to travel.
- loop: one of the ${DOM().loopDesc}, only when the findings clearly show one. If the tree is empty, start with loop nodes and hang the rest beneath them.
- Do not write emotion nodes unless a finding states how ${DOM().audience} feel.
- from lists the finding ids that support the node, at least one. Never cite a finding that does not support it.
- Put each node under the existing node it belongs with. Do not repeat anything already in the tree.
- At most ${size} lines, the most important first.`;
}

/* --- scanning --- */
function lockProject(on){
  ['#pScan','#pPick','#pBuild','#pSeed','#pForget'].forEach(sel=>{ const e = $(sel); if(e) e.disabled = on; });
  $('#pStop').hidden = !(on && projBusy);
}
async function refreshProject(){ PROJ = await fetchJSON('/api/project'); renderProject(); syncProjectButtons(); updatePreview(); }
async function loadProjectData(){
  if(!LOCAL) return;
  if(!projectReady()){ PGROUPS = null; PFIND = null; renderProject(); return; }
  try{
    const [g,f] = await Promise.all([fetchJSON('/api/project/groups?chars='+DEPTHS[projDepth].chars),fetchJSON('/api/project/findings')]);
    PGROUPS = g.groups; PFIND = f;
  }catch(e){ PGROUPS = null; PFIND = null; }
  renderProject();
}
async function projectPick(){
  pMsg('');
  try{ const r = await postJSON('/api/project/pick',{}); if(r.path){ $('#pPath').value = r.path; pMsg('Folder chosen. Press Scan.'); } }
  catch(e){ pMsg(e.message,'bad'); }
}
async function projectScan(){
  if(scanBusy) return;
  const folder = $('#pPath').value.trim();
  if(!folder){ pMsg('Choose or paste a folder first.','bad'); return; }
  scanBusy = true; $('#pScan').disabled = true; $('#pCancel').hidden = false; pMsg('Scanning…');
  try{
    await postJSON('/api/project/scan',{path:folder,ignore:$('#pIgnore').value,include:$('#pInclude').value});
    for(;;){
      await sleep(window.__POLL_MS || 400);
      const st = await fetchJSON('/api/project/status');
      if(st.running){ pMsg(`Scanning… ${st.files} files in ${st.dirs} folders`); continue; }
      if(st.error){ pMsg(st.error,'bad'); }
      else { PROJ = st.info; pMsg('Scan finished.','ok'); }
      break;
    }
    await loadProjectData(); syncProjectButtons(); updatePreview();
  }catch(e){ pMsg(e.message,'bad'); }
  finally{ scanBusy = false; $('#pScan').disabled = false; $('#pCancel').hidden = true; }
}
function renderProject(){
  if(!LOCAL) return;
  const P = PROJ || {has:false}, has = !!P.has;
  const path = $('#pPath'); if(document.activeElement!==path && !path.value) path.value = P.root || '';
  $('#pSummary').hidden = !has; $('#pBriefWrap').hidden = !has;
  $('#pDefaults').textContent = has && (P.engineIgnore||[]).length ? 'Skipped automatically for '+P.engineLabel+': '+P.engineIgnore.join(', ') : '';
  if(!has) return;
  const c = P.counts || {}, sk = P.skipped || {};
  const stats = $('#pStats'); stats.textContent = '';
  const skipped = (sk.ignored||0)+(sk.binary||0)+(sk.tooBig||0)+(sk.generated||0)+(sk.secret||0)+(sk.other||0);
  [['Engine',P.engineLabel],['Files read',String(c.files)],['Text',c.textKB+' KB · about '+fmtN(c.tokensEst)+' tokens'],['Skipped',String(skipped)]].forEach(([k,v])=>{
    const d = document.createElement('div'); const b = document.createElement('b'); b.textContent = v; d.append(b,document.createTextNode(k)); stats.appendChild(d);
  });
  const bits = [];
  if((P.topDirs||[]).length) bits.push('Biggest folders: '+P.topDirs.slice(0,4).map(x=>`${x.dir} (${x.kb} KB)`).join(', ')+'.');
  const why = []; ['ignored','binary','tooBig','generated','secret'].forEach(k=>{ if(sk[k]) why.push(`${sk[k]} ${({ignored:'ignored',binary:'binary',tooBig:'too big',generated:'generated',secret:'private'})[k]}`); });
  if(why.length) bits.push('Skipped: '+why.join(', ')+'.');
  if(P.redactions) bits.push(`${P.redactions} possible secret${P.redactions===1 ? '' : 's'} were redacted from what Cascade reads.`);
  if(c.indexTruncated) bits.push('The project is large, so search covers the most relevant files only.');
  $('#pDetail').textContent = bits.join(' ');
  // brief controls
  const brief = $('#pBrief'); if(document.activeElement!==brief) brief.value = P.brief || '';
  $('#pDepth').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.val===projDepth)));
  const hasBrief = !!briefText(); let est = '', label = 'Build brief';
  if(PGROUPS && PFIND){
    const sel = PGROUPS.slice(0,DEPTHS[projDepth].groups), have = PFIND.groupFindings || {}, stale = sel.filter(g=>have[g.id]!==g.fingerprint);
    const mode = !hasBrief ? 'build' : stale.length ? 'update' : 'rebuild', work = mode==='update' ? stale : sel;
    label = mode==='build' ? 'Build brief' : mode==='update' ? `Update brief (${stale.length} changed)` : 'Rebuild brief';
    const tok = Math.round(work.reduce((a,g)=>a+g.chars,0)/4)+1500;
    est = `${DEPTHS[projDepth].groups<PGROUPS.length ? 'Reads the '+sel.length+' most design-relevant of '+PGROUPS.length+' folders. ' : 'Reads all '+sel.length+' folders. '}${mode==='update' ? 'Only the changed ones this time: ' : ''}about ${fmtN(tok)} tokens across ${work.length} call${work.length===1 ? '' : 's'}, plus one to write the brief.`;
  }
  $('#pBuild').textContent = label; $('#pEstimate').textContent = est;
  $('#pRestore').hidden = !prevBrief;
}
function syncProjectButtons(){
  if(!LOCAL) return;
  const show = projectReady() && (PROJ.findingCount>0);
  $('#mSeed').hidden = !show; $('#eSeed').hidden = !show;
  updateAskFiles();
}

/* --- the brief --- */
async function readGroup(g,engine,signal){
  const out = [], files = new Set(g.files);
  await streamLines(mapPrompt(g,engine),{signal,temperature:.2,onObj:(o)=>{
    if(!o || typeof o.text!=='string' || !o.text.trim()) return;
    const kind = KINDS.includes(o.kind) ? o.kind : 'system';
    let file = typeof o.file==='string' ? o.file : '';
    if(!files.has(file)){ const base = file.split('/').pop(); file = g.files.find(f=>f.split('/').pop()===base) || g.files[0] || ''; }
    out.push({kind,text:o.text.trim().slice(0,260),group:g.label,refs:file ? [{file,line:Math.max(1,Math.floor(+o.line) || 1)}] : []});
  }});
  return out.slice(0,14);
}
async function buildBrief(){
  if(projBusy) return;
  if(!projectReady()){ pMsg('Scan a folder first.','bad'); return; }
  if(activeProvider()==='demo' || !aiAvailable()){ pMsg('Reading a project needs a real AI. Connect one under Settings > AI model first.','bad'); return; }
  if(!PGROUPS || !PFIND) await loadProjectData();
  if(!PGROUPS || !PFIND){ pMsg('Couldn’t load the scan. Try scanning again.','bad'); return; }
  const sel = PGROUPS.slice(0,DEPTHS[projDepth].groups), have = PFIND.groupFindings || {}, stale = sel.filter(g=>have[g.id]!==g.fingerprint);
  const mode = !briefText() ? 'build' : stale.length ? 'update' : 'rebuild', work = mode==='update' ? stale : sel;
  const kept = mode==='update' ? PFIND.findings.filter(f=>sel.some(g=>g.label===f.group && have[g.id]===g.fingerprint)) : [];
  projBusy = true; projCtl = new AbortController(); lockProject(true); pMsg('');
  const engine = (PROJ && PROJ.engineLabel) || '', fresh = []; let nDone = 0, failed = 0;
  try{
    const queue = work.slice();
    const worker = async () => {
      for(;;){
        const g = queue.shift(); if(!g || projCtl.signal.aborted) return;
        pProg(`Reading ${g.label} (${nDone+1} of ${work.length})…`);
        try{ fresh.push(...await readGroup(g,engine,projCtl.signal)); }
        catch(e){ if(e && e.code==='cancelled') return; failed++; handleAIError(e); if(aiOff){ queue.length = 0; return; } }
        nDone++;
      }
    };
    await Promise.all([worker(),worker()]);
    if(projCtl.signal.aborted){ pMsg('Stopped. Nothing was changed.'); return; }
    if(!fresh.length && !kept.length){ pMsg('The AI didn’t find anything design-relevant to report. Try Thorough, or check the folder.','bad'); return; }
    const all = kept.concat(fresh).map((f,i)=>({...f,id:'f'+(i+1)}));
    pProg(`Writing the brief from ${all.length} findings…`);
    const out = await callAI(briefPrompt(all,engine),{cache:false,signal:projCtl.signal,temperature:.3,onText:({text})=>{ $('#pBrief').value = text; }});
    const brief = out.text.trim().slice(0,6000);
    if(!brief){ pMsg('The AI returned an empty brief.','bad'); return; }
    prevBrief = briefText() || null;
    const gf = mode==='update' ? {...have} : {}; work.forEach(g=>{ gf[g.id] = g.fingerprint; });
    const model = (SRV && SRV.providers && SRV.providers[SRV.active] && SRV.providers[SRV.active].effectiveModel) || '';
    PROJ = await postJSON('/api/project/brief',{brief,briefMeta:{model,groups:sel.length,edited:false},findings:all,groupFindings:gf});
    await loadProjectData(); syncProjectButtons(); updatePreview();
    pMsg(`Brief written from ${all.length} findings across ${sel.length} folder${sel.length===1 ? '' : 's'}.${failed ? ' '+failed+' could not be read.' : ''}`,'ok');
  }catch(e){
    if(e && e.code==='cancelled') pMsg('Stopped. Nothing was changed.'); else { handleAIError(e); pMsg('The brief couldn’t be written.','bad'); }
  }finally{
    projBusy = false; projCtl = null; lockProject(false); pProg(''); $('#pBrief').value = (PROJ && PROJ.brief) || ''; renderProject();
  }
}
let briefTimer = 0;
function initProject(){
  syncers.push(()=>{ renderProject(); updateAskFiles(); });
  $('#pPick').addEventListener('click',projectPick);
  $('#pScan').addEventListener('click',projectScan);
  $('#pPath').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); projectScan(); } });
  $('#pCancel').addEventListener('click',()=>{ postJSON('/api/project/cancel',{}).catch(()=>{}); });
  $('#pBuild').addEventListener('click',buildBrief);
  $('#pStop').addEventListener('click',()=>{ if(projCtl) projCtl.abort(); });
  $('#pDepth').addEventListener('click',e=>{ const b = e.target.closest('button[data-val]'); if(!b) return; projDepth = b.dataset.val; loadProjectData(); });
  $('#pBrief').addEventListener('input',()=>{
    clearTimeout(briefTimer);
    briefTimer = setTimeout(async()=>{ try{ PROJ = await postJSON('/api/project/brief',{brief:$('#pBrief').value,briefMeta:{...(PROJ && PROJ.briefMeta || {}),edited:true}}); updatePreview(); }catch(e){} },600);
  });
  $('#pRestore').addEventListener('click',async()=>{ if(!prevBrief) return; const b = prevBrief; prevBrief = null; $('#pBrief').value = b; try{ PROJ = await postJSON('/api/project/brief',{brief:b,briefMeta:{...(PROJ && PROJ.briefMeta || {}),edited:true}}); updatePreview(); }catch(e){} renderProject(); });
  $('#pSeed').addEventListener('click',()=>{ closeSettings(); seedFromProject(); });
  $('#pForget').addEventListener('click',async()=>{
    try{ const r = await postJSON('/api/project/forget',{}); PROJ = r.project; PGROUPS = null; PFIND = null; prevBrief = null; $('#pPath').value = ''; $('#pBrief').value = ''; pMsg('This project was forgotten.'); renderProject(); syncProjectButtons(); updatePreview(); }
    catch(e){ pMsg(e.message,'bad'); }
  });
  $('#mSeed').addEventListener('click',seedFromProject);
  $('#eSeed').addEventListener('click',seedFromProject);
  if(PROJ && PROJ.has) loadProjectData();
  renderProject(); syncProjectButtons();
}

/* --- seeding the graph --- */
async function seedFromProject(){
  if(!projectReady()){ showNote(['Scan a project folder first, in Settings > Project.'],false); return; }
  if(activeProvider()==='demo' || !aiAvailable()){ showNote([aiNeed('Seeding from a project')],false); return; }
  let findings = []; try{ findings = (await fetchJSON('/api/project/findings')).findings || []; }catch(e){}
  if(!findings.length){ showNote(['Build the project brief first. Seeding works from what it finds.'],false); openSettings('project'); return; }
  enqueue(async()=>{
    const c = new AbortController(); ctl = c; pushHist();
    try{ await runSeed(findings,c.signal); } finally{ ctl = null; }
  });
}
async function runSeed(findings,signal){
  stopReveal = false; setBusy('Seeding from the project…',true);
  if(S.mode==='outer') setMode('detail');
  const byId = Object.fromEntries(findings.map(x=>[x.id,x])), TT = ['loop','decision','question','consequence','fog'];
  const gmap = Object.create(null), queue = [], max = {small:10,medium:16,large:24}[PREFS.growSize] || 16;
  let count = 0, streaming = true;
  const apply = (o) => {
    if(count>=max || !o || typeof o.text!=='string' || !o.text.trim() || !TT.includes(o.type)) return false;
    const refs = [];
    (Array.isArray(o.from) ? o.from : []).forEach(fid=>{ const fi = byId[fid]; if(fi && fi.refs && fi.refs[0] && refs.length<3) refs.push({f:fi.refs[0].file,l:fi.refs[0].line,t:String(fi.text).slice(0,200)}); });
    if(!refs.length) return false;   // a node with no real source is not allowed in
    const root = S.order.find(id=>S.nodes[id] && !S.nodes[id].parent && !S.nodes[id].ghost);
    let pid = (String(o.parent) in gmap) ? gmap[String(o.parent)] : (S.nodes[o.parent] ? o.parent : null);
    if(!pid && root) pid = root;
    const id = addNode({type:o.type,text:o.text.trim().slice(0,140),parent:pid,ghost:true});
    const n = S.nodes[id]; n.src = refs;
    if(o.type==='question') n.ticket = TICKETS.includes(o.ticket) ? o.ticket : 'talk';
    gmap[String(o.id)] = id; count++;
    layout(false); updateHud(); save();
    return true;
  };
  const reveal = (async()=>{
    while(streaming || queue.length){
      if(stopReveal){ queue.length = 0; break; }
      if(!queue.length){ await sleep(60); continue; }
      if(apply(queue.shift())) await sleep(window.__DEMO_FAST__ ? 0 : 260);
    }
  })();
  try{ await streamLines(seedPrompt(findings),{signal,temperature:PREFS.creativity,onObj:o=>queue.push(o)}); }
  catch(e){ if(e && e.code==='cancelled') stopReveal = true; else handleAIError(e); }
  finally{ streaming = false; }
  await reveal; setBusy(null); updateHud();
  if(count) showNote([`Seeded ${count} suggestion${count===1 ? '' : 's'} from the project. Each one shows where it came from.`],true);
  else if(!stopReveal) showNote(['Nothing in the findings could be turned into nodes.'],false);
}
if(LOCAL) initProject();

