'use strict';
/* ================= AI ================= */
let aiChecked = false, sampleFn = null, aiOff = false, ctl = null, chain = Promise.resolve(), queued = 0, stopReveal = false;
(async()=>{
  await null;   // let the rest of the script finish initialising before touching it
  try{
    if(LOCAL) sampleFn = serverSample;
    else if(!WEB && window.claude && claude.use) sampleFn = await claude.use('sample');
  }catch(e){}
  aiChecked = true; updateHud();
})();
function cancelAI(){ stopReveal = true; if(ctl) ctl.abort(); try{ if(G.ctl) G.ctl.abort(); }catch(e){} try{ if(AN.ctl) AN.ctl.abort(); }catch(e){} }
function enqueue(job){
  queued++;
  chain = chain.then(job).catch(e=>console.error(e)).finally(()=>{ queued--; });
  return chain;
}
const activeProvider = () => WEB ? WEBAI.provider : LOCAL ? ((SRV && SRV.active) || 'demo') : 'claude';
function aiAvailable(){
  if(aiOff) return false;
  const p = activeProvider();
  if(p==='demo' && (LOCAL || WEB)) return true;
  if(WEB) return !!(WEBAI.key && WEBAI.model);
  if(LOCAL) return !!(SRV && SRV.ready);
  return !!sampleFn;
}
const aiNeed = (what) => (LOCAL || WEB) ? `${what} needs an AI. Connect one in Settings.` : `${what} needs Claude, which isn’t available in this view.`;
const STEER = {
  light:'Let the goal color your questions lightly. Keep exploring freely.',
  balanced:'Most of your questions and answers should help the designer move toward the goal. Allow the occasional lateral one.',
  strong:'Every question and answer must directly serve the goal. Prefer questions that test whether a specific change would achieve it, and avoid tangents.'
};
const GROW = {small:{w1:'2',w2:'2',w3:'2',max:6,back:4},medium:{w1:'2 or 3',w2:'2 to 4',w3:'2 or 3',max:9,back:6},large:{w1:'3 or 4',w2:'4 or 5',w3:'3 or 4',max:13,back:8}};
function guidance(){
  const P = PREFS, parts = [];
  if((P.context||'').trim()) parts.push('GAME CONTEXT: '+P.context.trim());
  if((P.goal||'').trim()) parts.push('OVERARCHING GOAL: '+P.goal.trim()+'\nSTEERING: '+(STEER[P.steer]||STEER.balanced));
  if((P.pillars||'').trim()) parts.push('DESIGN PILLARS AND CONSTRAINTS (respect these): '+P.pillars.trim());
  if((P.avoid||'').trim()) parts.push('AVOID: '+P.avoid.trim());
  if(projectBriefOn()) parts.push('PROJECT BRIEF (what the existing project already does, read from its notes and code. It is context only: the goal and the pillars above always take precedence):\n'+briefText());
  return parts.join('\n\n');
}
const guideBlock = () => { const g = guidance(); return g ? g+'\n\n' : ''; };
function callAI(prompt,o){
  o = o || {};
  const opts = {modelTier:'quick',signal:o.signal};
  if(o.onText) opts.onText = o.onText;
  if(o.cache===false) opts.cache = false;
  if(LOCAL && typeof o.temperature==='number') opts.temperature = o.temperature;
  if((LOCAL || WEB) && activeProvider()==='demo') return demoSample(prompt,o);
  if(WEB) return webSample(prompt,o);
  return sampleFn(prompt,opts);
}
function treeText(){
  const lines = [];
  for(const id of S.order){
    const n = S.nodes[id]; if(!n) continue;
    lines.push(`${id} | ${n.type}${n.type==='emotion'&&n.mood?' ('+n.mood+')':''}${n.ghost?' [unaccepted suggestion]':''}${n.state==='settled'?' [settled]':n.state==='out'?' [out of scope]':''}${n.ticket && n.ticket!=='talk' ? ' [ticket: '+n.ticket+']' : ''}${n.decided?' [decision]':''} | ${n.text} | parent: ${n.parent||'none'}`);
  }
  return lines.join('\n');
}
function parseObj(text){
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if(a<0 || b<a) throw {code:'invalid_json',message:'no JSON'};
  try{ return JSON.parse(text.slice(a,b+1)); }catch(e){ throw {code:'invalid_json',message:'bad JSON'}; }
}
async function askPlacement(type,text,signal){
  const prompt = `You are the placement engine inside a game-design decision tree. The tree maps design questions, answers, player emotions, consequences and decisions for one game. A designer just dropped a new block; decide where it belongs.

${guideBlock()}TREE (id | type | text | parent):
${treeText()}

NEW BLOCK
type chosen by the designer: ${type}
text: "${text.replace(/"/g,'\\"')}"

Rules:
- Pick the single best parent id from the tree. Prefer the most specific node the block responds to over a broad loop stage. A proposed solution belongs under the problem it addresses.
- Answers go under questions; emotions under the answer or consequence that causes the feeling; consequences under decisions or answers; follow-up questions under whatever raised them. Loop nodes are stages of the game loop: use them as a parent only when nothing more specific fits, and a new loop block belongs under another loop node. Fog blocks are decisions the designer can see coming but cannot phrase precisely yet; put them beside the area they affect.
- Keep the designer's type unless it is clearly wrong.${PREFS.goal.trim() ? '\n- If the block pulls away from the overarching goal, still place it where it belongs and say so in the reason.' : ''}
- relation: 2 to 4 words saying how the block connects to its parent (for example "proposed fix", "answers", "follows from", "refines", "contradicts").
- related: up to 3 other ids that connect to the block without being its parent (same problem from another angle, a conflicting idea, an upgrade that would enable it). Empty list if none.
- mood: only for emotion blocks, one of ${MOOD_KEYS.join(', ')}. Otherwise null.
- reason: one plain sentence, at most 20 words, saying why it goes there.
Reply with ONLY a JSON object, no markdown:
{"type":"...","parent":"id","relation":"...","related":["id"],"mood":null,"reason":"..."}`;
  const out = await callAI(prompt,{signal,temperature:.2});
  return parseObj(out.text);
}
const STOP = new Set('the a an and or of to in on for is are be it this that with would could should can will do does how why what when where which more less than then into from by at as we our you your their they them if not'.split(' '));
const toks = s => s.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>2 && !STOP.has(w));
function fallbackPlace(type,text){
  const t = new Set(toks(text)); let best = null, bs = 0;
  for(const id of S.order){
    const n = S.nodes[id]; if(!n || n.ghost) continue;
    let sc = toks(n.text).filter(w=>t.has(w)).length; if(n.type==='loop') sc *= .8;
    if(sc>bs){ bs = sc; best = id; }
  }
  return {type,parent:best||S.sel||S.order[0],relation:'closest match',related:[],mood:null,reason: bs ? 'It shares the most words with this node.' : 'Nothing matched closely, so it sits near the start.'};
}
const MOOD_WORDS = [['frustrat',"frustration"],['annoy','frustration'],['tedious','frustration'],['bor','boredom'],['empty','boredom'],['curio','curiosity'],['explor','curiosity'],['discover','curiosity'],['delight','delight'],['fun','delight'],['joy','delight'],['awe','awe'],['wonder','awe'],['epic','awe'],['confus','confusion'],['lost','confusion'],['tens','tension'],['pressure','tension'],['anxi','tension'],['fear','tension']];
function moodGuess(text){ const s = text.toLowerCase(); for(const [k,m] of MOOD_WORDS) if(s.includes(k)) return m; return 'curiosity'; }
function handleAIError(e){
  const c = e && e.code, m = e && e.message ? String(e.message).slice(0,200) : '';
  if(LOCAL || WEB){
    if(c==='sampling_disabled'){ aiOff = true; showNote([`${m || 'The provider rejected the request.'} Check Settings. Blocks place by keyword match for now.`],false); updateHud(); }
    else if(c==='rate_limited'){ showNote(['The provider is rate limiting requests. Try again in a moment.'],false); }
    else if(c!=='cancelled'){ showNote([`The provider returned an error${m ? ': '+m : ''}`],false); }
    return;
  }
  if(['not_granted','sampling_disabled','not_declared','capability_disabled','capability_removed'].includes(c)){
    aiOff = true; showNote(['Claude is switched off for this page, so blocks place by keyword match.'],false); updateHud();
  } else if(c==='rate_limited'){ showNote(['Claude is rate limited right now. Try again in a moment.'],false); }
  else if(c!=='cancelled'){ showNote(['Claude couldn’t answer that one, so it was placed by keyword match.'],false); }
}
function cleanRel(s){ return typeof s==='string' ? s.trim().slice(0,32) : ''; }

async function placeBlock(type,text,wpos,pend,signal){
  const empty = S.order.length===0;
  setBusy(empty ? 'Planting the first node…' : 'Finding where it fits…',true);
  let res = null, usedAI = false;
  if(empty){ res = {type,parent:null,relation:'',related:[],mood:null,reason:''}; usedAI = aiAvailable(); }
  else if(aiAvailable()){
    try{ res = await askPlacement(type,text,signal); usedAI = true; }
    catch(e){ if(e && e.code==='cancelled'){ pend.remove(); setBusy(null); return; } handleAIError(e); }
  }
  if(!res) res = fallbackPlace(type,text);
  const parent = S.nodes[res.parent] ? res.parent : (S.order.length ? (fallbackPlace(type,text).parent || null) : null);
  const ntype = BLOCKS.includes(res.type) ? res.type : type;
  if(S.mode==='outer') setMode('detail');
  pushHist(); pend.remove();
  const id = addNode({type:ntype,text,parent,rel:cleanRel(res.relation),mood:MOODS[res.mood]?res.mood:(ntype==='emotion'?moodGuess(text):undefined),spawn:wpos});
  (Array.isArray(res.related)?res.related:[]).slice(0,3).forEach(rid=>{ if(S.nodes[rid] && rid!==parent && rid!==id) S.links.push({a:id,b:rid,kind:'rel'}); });
  S.sel = null; flashId = id; setTimeout(()=>{ if(flashId===id){ flashId=null; kick(); } },7000);
  commit();
  const r = R[id], pr = R[parent];
  if(r){ r.hot = true; setTimeout(()=>{ r.hot=false; restyle(); },1700); }
  if(pr){ pr.hot = true; setTimeout(()=>{ pr.hot=false; restyle(); },1700); }
  restyle(); ensureVisible(id);
  const pn = parent && S.nodes[parent];
  if(pn) showNote(['Placed under ',{b:`“${pn.text}”`},res.reason ? ` — ${String(res.reason).slice(0,160)}` : '.'],true);
  else showNote(['Planted as the first node.'],true);
  if(usedAI && (ntype==='emotion' ? PREFS.autoTrace : ntype==='fog' ? false : PREFS.autoGrow)) await expandFrom(id,signal,ntype==='emotion'?'back':'forward'); else setBusy(null);
}

async function expandFrom(fid,signal,mode){
  const back = mode==='back', chart = mode==='chart';
  const GS = GROW[PREFS.growSize] || GROW.medium;
  if(!aiAvailable()){ showNote([aiNeed(chart ? 'Charting' : 'Growing branches')],false); setBusy(null); return; }
  const f = S.nodes[fid]; if(!f){ setBusy(null); return; }
  f.collapsed = false; stopReveal = false;
  const fr = R[fid]; if(fr){ fr.growing = true; restyle(); }
  setBusy(chart ? 'Charting the map…' : back ? 'Tracing back…' : 'Growing branches…',true);
  const fwdPrompt = `You grow a game-design decision tree outward from one node, in waves, like dominoes falling.

${guideBlock()}TREE (id | type | text | parent):
${treeText()}

FOCUS NODE: ${fid} | ${f.type} | ${f.text}

Write one JSON object per line (NDJSON). No markdown, no commentary, no blank lines. Each line:
{"id":"g1","parent":"<an existing id or an earlier gN>","type":"answer|question|emotion|consequence|decision","text":"<at most 14 words>","mood":"<emotion nodes only>","wave":1}

Wave 1 (${GS.w1} lines): direct responses hanging off the focus node. If it is a question, give plausible answers; if it is an answer or decision, give likely consequences or follow-up questions.
Wave 2 (${GS.w2} lines): follow-ups beneath wave 1 nodes: the next question a designer should ask, or what this changes in the game.
Wave 3 (${GS.w3} lines): emotion nodes describing how the player feels, placed under wave 1 or 2 nodes. mood must be one of ${MOOD_KEYS.join(', ')}.
At most ${GS.max} lines in total, wave 1 first, then 2, then 3. Be specific to this game, write in the same terse voice as the tree, and do not repeat existing nodes.`;
  const backPrompt = `You help a game designer backtrack from a player emotion to its causes by asking questions.

${guideBlock()}TREE (id | type | text | parent):
${treeText()}

EMOTION NODE: ${fid} | ${f.type}${f.mood?' ('+f.mood+')':''} | ${f.text}

Write one JSON object per line (NDJSON). No markdown, no commentary, no blank lines. Each line:
{"id":"g1","parent":"<${fid} or an earlier gN>","type":"question|answer","text":"<at most 14 words>","links":["<existing ids>"],"wave":1}

Wave 1 (2 or 3 lines): why-questions about what in the design could cause this feeling. parent is ${fid}, type is question. Look at level layout, pacing, mechanics, feedback, rewards and difficulty. links lists up to 2 existing node ids that may already be the cause (empty list if none).
Wave 2 (2 or 3 lines): under some wave 1 questions, either a plausible root cause as an answer or a sharper follow-up question. parent is the wave 1 question.
At most ${GS.back} lines in total, wave 1 first. Be specific to this game, terse like the tree, and do not repeat existing nodes.`;
  const chartPrompt = `You are charting a map of decisions for a game design effort that is too big to settle in one sitting. The destination is fixed: every ticket you write must help reach it, and nothing beyond it belongs on the map.

${guideBlock()}DESTINATION: ${(PREFS.goal||'').trim()}

TREE (id | type | text | parent):
${treeText()}

Write one JSON object per line (NDJSON). No markdown, no commentary, no blank lines. Each line:
{"id":"t1","parent":"<existing id or an earlier tN>","type":"question|fog","text":"<at most 16 words>","ticket":"talk|prototype|research|task","blockedBy":["<ids of existing or earlier tickets that must be settled first>"],"wave":1}

Rules:
- A question is a decision to make, written as a question. Never write a build step or a to-do disguised as a question.
- ticket: talk = settled by discussion (the default). prototype = cannot be decided until the designer has something to look at or play. research = needs a fact from outside the tree. task = nothing to decide, but manual preparation blocks a decision.
- fog = a decision you can see coming but cannot yet phrase precisely. Its text is a short noun phrase. Leave out ticket and blockedBy.
- Only add blockedBy where one decision truly depends on another.
- Write about ${GS.w1} to ${GS.max-3} questions and 2 to 4 fog items. Do not repeat existing nodes. Never answer any question.`;
  const prompt = chart ? chartPrompt : back ? backPrompt : fwdPrompt;
  const gmap = Object.create(null), queue = [];
  let done = 0, count = 0, streaming = true, lastWave = 0;
  const parse = (text,final) => {
    const lines = text.split('\n'), upto = final ? lines.length : lines.length-1;
    for(; done<upto; done++){
      const ln = lines[done].trim().replace(/^```(json)?/,'').replace(/```$/,'').replace(/,$/,'').trim();
      if(!ln.startsWith('{')) continue;
      try{ queue.push(JSON.parse(ln)); }catch(e){}
    }
  };
  const pendingBlocks = [];
  const apply = (o) => {
    if(chart){
      if(count>=GS.max+4 || !o || typeof o.text!=='string' || !o.text.trim() || (o.type!=='question' && o.type!=='fog')) return false;
      const pidc = (o.parent in gmap) ? gmap[o.parent] : (S.nodes[o.parent] ? o.parent : fid);
      const idc = addNode({type:o.type,text:o.text.trim().slice(0,140),parent:pidc,ghost:true});
      const nc = S.nodes[idc];
      if(o.type==='question'){ nc.ticket = TICKETS.includes(o.ticket) ? o.ticket : 'talk'; if(Array.isArray(o.blockedBy)) pendingBlocks.push([idc,o.blockedBy]); }
      gmap[String(o.id)] = idc; count++;
      layout(false); updateHud(); save();
      return true;
    }
    if(count>=(back?GS.back:GS.max) || !o || typeof o.text!=='string' || !o.text.trim() || !TYPES.includes(o.type)) return false;
    const pid = (o.parent in gmap) ? gmap[o.parent] : (S.nodes[o.parent] ? o.parent : fid);
    const id = addNode({type:o.type,text:o.text.trim().slice(0,140),parent:pid,ghost:true,mood:o.type==='emotion'?(MOODS[o.mood]?o.mood:moodGuess(o.text)):undefined});
    if(back){
      const nn = S.nodes[id];
      if(pid===fid){ nn.back = true; nn.rel = 'traces back'; }
      (Array.isArray(o.links)?o.links:[]).slice(0,2).forEach(lid=>{ if(S.nodes[lid] && lid!==id && lid!==fid && lid!==pid) S.links.push({a:id,b:lid,kind:'rel'}); });
    }
    gmap[String(o.id)] = id; count++;
    layout(false); updateHud(); save();
    return true;
  };
  const reveal = (async()=>{
    while(streaming || queue.length){
      if(stopReveal){ queue.length = 0; break; }
      if(!queue.length){ await sleep(60); continue; }
      const o = queue.shift();
      if(apply(o)){ const w = o.wave|0; await sleep(w!==lastWave && lastWave ? 520 : 250); lastWave = w; }
    }
  })();
  try{
    const out = await callAI(prompt,{cache:false,signal,temperature:PREFS.creativity,onText:({text})=>parse(text,false)});
    parse(out.text,true);
  }catch(e){
    if(!(e && e.code==='cancelled')) handleAIError(e);
    if(e && e.code==='cancelled') stopReveal = true;
  }finally{ streaming = false; }
  await reveal;
  if(chart && pendingBlocks.length){
    for(const [bid,list] of pendingBlocks) for(const raw of list.slice(0,3)){
      const real = (String(raw) in gmap) ? gmap[String(raw)] : (S.nodes[raw] ? raw : null);
      if(real && real!==bid && S.nodes[bid] && !S.links.some(l=>l.kind==='block' && l.a===real && l.b===bid) && !blockCycle(real,bid)) S.links.push({a:real,b:bid,kind:'block'});
    }
    layout(false); save();
  }
  if(fr){ fr.growing = false; restyle(); }
  if(count===0 && !stopReveal) showNote(['No new branches came back for that node.'],false);
  else if(chart && !stopReveal) showNote([`Charted ${count} suggestions against the destination. Keep the ones that belong.`],false);
  else if(back && !stopReveal) showNote(['Traced back from ',{b:`“${f.text}”`},'. Keep the questions that ring true.'],false);
  setBusy(null); updateHud();
}
function traceBack(id){
  if(!aiAvailable()){ showNote([aiNeed('Tracing back')],false); return; }
  enqueue(async()=>{
    const c = new AbortController(); ctl = c; pushHist();
    try{ await expandFrom(id,c.signal,'back'); } finally{ ctl = null; }
  });
}
function growNode(id){
  if(!aiAvailable()){ showNote([aiNeed('Growing branches')],false); return; }
  enqueue(async()=>{
    const c = new AbortController(); ctl = c; pushHist();
    try{ await expandFrom(id,c.signal); } finally{ ctl = null; }
  });
}

