'use strict';
// UI tests: the app in jsdom, in each of its three modes.
//   artifact  hosted inside Claude (a scripted stand-in for Claude's sample API)
//   web       the static GitHub Pages build: demo provider and OpenRouter sign-in, no server
//   local     served by the real Node server, with mock providers behind it
const test = require('node:test'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const mocks = require('./helpers/mocks');
const { open, webHtml, sleep, ROOT } = require('./helpers/dom');

let mock;
test.before(async()=>{ mock = await mocks.start(); });
test.after(async()=>{ await mock.close(); });

const J = JSON.stringify;
const webFetch = (u,o) => fetch(String(u).replace('https://openrouter.ai',mock.base+'/openrouter'),o);
const WEB_URL = 'https://someone.github.io/cascade/';

/* ---------------- a scripted stand-in for Claude, used for the hosted-mode tests ---------------- */
function scriptedClaude(calls = []){
  return { use: async (n) => n!=='sample' ? null : async (prompt,o) => {
    calls.push(prompt); let text = '';
    if(prompt.includes('analysing a game-design decision tree')){
      if(prompt.includes('QUESTION: What causes the boredom')) text = J({ verdict:'answered', answer:'Long empty stretches bore players.', threads:[
        { label:'Empty ground', ids:['n6','n7','n8','n9','zzz'], why:'Sparse landmarks.' }, { label:'Movement', ids:['n6','n10','n11','n15'], why:'No abilities.' }], gaps:[] });
      else if(prompt.includes('QUESTION: Who is the final boss')) text = J({ verdict:'unanswered', answer:'Nothing mentions a boss.', threads:[], gaps:[{ text:'Who is the final boss and why?', parent:'n4' },{ text:'What does the ending reward?', parent:'bogus' }] });
      else text = 'not json';
    } else if(prompt.includes('Summarise what a game-design decision tree says')) text = 'Players get bored. Next: test spacing.';
    else if(prompt.includes('Summarise this game-design decision tree')) text = 'The design centres on traversal.';
    else if(prompt.includes('interviewing a game designer')) text = prompt.includes('SESSION SO FAR') ? J({ done:true, summary:'Settled.' })
      : ['What counts as a long trip?','Should travel ever be skippable?','How long is a fight?','What should crossing feel like?'].map((q,i)=>J({ id:'q'+i, parent:'n6', text:q, why:'Matters.', ticket:'talk', grillable:true })).join('\n');
    else if(prompt.includes('sharp but fair design interviewer')) text = prompt.includes('ANSWER: weak answer') ? J({ verdict:'challenge', text:'What about players who never find it?' }) : J({ verdict:'solid', text:'' });
    else if(prompt.includes('charting a map of decisions')) text = [{ id:'t1', parent:'n6', type:'question', text:'Who earns a shortcut?', ticket:'talk', blockedBy:[] },{ id:'t2', parent:'t1', type:'question', text:'What does a shortcut look like?', ticket:'prototype', blockedBy:['t1'] },{ id:'t3', parent:'n6', type:'fog', text:'Camera on long routes' }].map(J).join('\n');
    else if(prompt.includes('backtrack from an emotion')){ const f = prompt.match(/EMOTION NODE: (n\d+)/)[1]; text = [{ id:'g1', parent:f, type:'question', text:'Is the ground too empty?', links:['n7'], wave:1 },{ id:'g2', parent:f, type:'question', text:'Is walking too slow?', links:[], wave:1 }].map(J).join('\n'); }
    else if(prompt.includes('placement engine')) text = J({ type:'question', parent:'n6', relation:'proposed fix', related:[], mood:null, reason:'Fix for traversal.' });
    else if(prompt.includes('You grow a game-design decision tree')){ const f = prompt.match(/FOCUS NODE: (n\d+)/)[1]; text = [{ id:'g1', parent:f, type:'answer', text:'Forward answer', wave:1 }].map(J).join('\n'); }
    if(o.onText && text) o.onText({ text:text.slice(0,25) });
    return { text };
  } };
}

/* =============================== hosted inside Claude =============================== */
test('hosted: boots the example tree and shows only the hosted settings',async()=>{
  const a = open({ claude:scriptedClaude() }); await sleep(400);
  assert.equal(a.nodes().length,18); assert.deepEqual(a.errs,[]);
  a.click(a.$('#setBtn'));
  const shown = (m) => a.$$(`[data-modes~="${m}"]`).filter(e=>!e.hidden && e.closest('#p-ai')).length;
  assert.ok(shown('artifact')>0); assert.equal(shown('web'),0); assert.equal(shown('local'),0);
  assert.ok(a.$('.stabs [data-tab=data]').hidden,'no Data tab without a server or browser storage');
});
test('dragging never selects text: pan, node drag and palette drag block selection and clear a stray one',async()=>{
  const a = open({ claude:scriptedClaude() }); await sleep(400);
  const { w, d } = a;
  const ptr = (el,type) => el.dispatchEvent(new w.MouseEvent(type,{ bubbles:true, clientX:300, clientY:300 }));
  const blocked = () => { const e = new w.Event('selectstart',{ bubbles:true, cancelable:true }); d.body.dispatchEvent(e); return e.defaultPrevented; };
  const dragging = () => d.body.classList.contains('dragging');
  assert.equal(dragging(),false); assert.equal(blocked(),false,'ordinary selection is untouched when idle');
  // a stray selection is cleared the moment a drag starts
  const r = d.createRange(); r.selectNodeContents(a.$('.node .txt')); w.getSelection().removeAllRanges(); w.getSelection().addRange(r);
  assert.ok(w.getSelection().toString().length>0);
  ptr(a.$('#stage'),'pointerdown');
  assert.ok(dragging()); assert.equal(w.getSelection().toString(),''); assert.equal(blocked(),true,'selectstart is cancelled mid-drag');
  ptr(a.$('#stage'),'pointerup'); assert.equal(dragging(),false); assert.equal(blocked(),false);
  // dragging a node
  const node = a.nodes().find(n=>n.classList.contains('answer'));
  ptr(node,'pointerdown'); assert.ok(dragging()); ptr(node,'pointermove'); ptr(a.$('#stage'),'pointerup'); assert.equal(dragging(),false);
  // dragging a block out of the palette, finished and cancelled
  const tile = a.$('.tile[data-type="question"]');
  ptr(tile,'pointerdown'); assert.ok(dragging()); w.dispatchEvent(new w.MouseEvent('pointerup')); assert.equal(dragging(),false);
  ptr(tile,'pointerdown'); assert.ok(dragging()); w.dispatchEvent(new w.MouseEvent('pointercancel')); assert.equal(dragging(),false);
  // the browser's own text drag-and-drop is cancelled on the canvas and rail, but not inside inputs
  const ds = (el) => { const e = new w.Event('dragstart',{ bubbles:true, cancelable:true }); el.dispatchEvent(e); return e.defaultPrevented; };
  assert.equal(ds(a.$('.node .txt')),true); assert.equal(ds(a.$('.brand')),true);
  a.click(tile); assert.equal(ds(a.$('#compose textarea')),false);
  // text you are meant to edit or copy stays selectable
  const css = require('../scripts/assemble').assemble({ inline:true });
  assert.ok(!/\.node:hover \.bar/.test(css),'the block action bar appears on click, not on hover');
  assert.match(css,/\.node\.sel \.bar\{display:flex/);
  assert.match(css,/#stage,#rail\{user-select:none/);
  assert.match(css,/#stage \[contenteditable="true"\],#side,#compose,#note\{user-select:text/);
  assert.deepEqual(a.errs,[]);
});
test('hosted: placing a block puts it under the best parent and grows ghost branches',async()=>{
  const a = open({ claude:scriptedClaude() }); await sleep(400);
  await a.drop('question','Would a bigger map help?',1500);
  assert.match(a.$('#ntxt').textContent,/Placed under .*Why does traversal feel slow/);
  assert.ok(a.nodes().some(n=>n.classList.contains('ghost')),'ghost suggestions appeared');
  a.click(a.$('#keepAll')); await sleep(200); assert.equal(a.nodes().filter(n=>n.classList.contains('ghost')).length,0);
});
test('hosted: trace back is for emotions, delete keeps children, branch delete removes them, undo and clear work',async()=>{
  const a = open({ claude:scriptedClaude() }); await sleep(400);
  assert.ok(a.byText('Bored crossing').querySelector('[data-act=back]')); assert.ok(!a.byText('No movement abilities').querySelector('[data-act=back]'));
  a.click(a.byText('Bored crossing').querySelector('[data-act=back]')); await sleep(1800);
  assert.equal(a.nodes().filter(n=>n.classList.contains('ghost')).length,2); assert.ok(a.$$('#eg path.back').length>=2);
  a.click(a.$('#keepAll')); await sleep(100);
  const before = a.nodes().length, a1 = a.byText('Points of interest sit far apart');
  a.click(a1.querySelector('[data-act=del]')); await sleep(150);
  assert.equal(a.nodes().length,before-1); assert.ok(a.byText('Bored crossing'),'its children moved up');
  a.click(a.byText('No movement abilities').querySelector('[data-act=delb]')); await sleep(150); assert.ok(a.nodes().length<before-1);
  a.click(a.$('#undoBtn')); await sleep(100);
  a.click(a.$('#clearBtn')); await sleep(200); assert.equal(a.nodes().length,0); assert.equal(a.$('#empty').hidden,false);
});
test('hosted: map layer, resolve with pushback, grill rounds and the passivity nudge',async()=>{
  const a = open({ claude:scriptedClaude() }); await sleep(400);
  a.click(a.$('#mapBtn')); await sleep(150);
  assert.ok(a.$('#world').classList.contains('maplayer')); assert.match(a.$('#mLists').textContent,/Up next/);
  a.type(a.$('#mDest'),'Make traversal feel like discovery'); a.click(a.$('#mChart')); await sleep(2800);
  assert.equal(a.nodes().filter(n=>n.classList.contains('ghost')).length,3);
  a.click(a.$('#keepAll')); await sleep(150); assert.match(a.$('#mLists').textContent,/Waiting/);
  a.click([...a.$$('#mLists .mitem')].find(i=>i.textContent.includes('earns a shortcut')).querySelector('[data-act=resolve]')); await sleep(150);
  const card = a.$$('.gcard')[0]; a.type(card.querySelector('textarea'),'weak answer'); a.click(card.querySelector('[data-gact=answer]')); await sleep(300);
  assert.match(card.querySelector('.gpush').textContent,/never find it/); a.click(card.querySelector('[data-gact=standby]')); await sleep(200);
  assert.ok(a.nodes().some(n=>n.classList.contains('decided')),'the decision is on the canvas');
  a.click(a.$('#mGrillAll')); await sleep(700);
  const cards = a.$$('.gcard'); assert.equal(cards.length,4);
  for(const [i,t] of ['yes','ok','sure'].entries()){ a.type(cards[i].querySelector('textarea'),t); a.click(cards[i].querySelector('[data-gact=answer]')); await sleep(250); }
  assert.match(a.$('#gNote').textContent,/quick agreements/);
  a.click(a.$('#gNext')); await sleep(500); assert.equal(a.$('#gDone').hidden,false);
});
test('hosted: ask the graph highlights threads, offers gaps and summaries, and prunes deleted nodes',async()=>{
  const a = open({ claude:scriptedClaude() }); await sleep(400);
  a.click(a.$('#askBtn')); assert.ok(!a.$('#world').classList.contains('maplayer'),'map layer is off while asking');
  a.type(a.$('#aQ'),'What causes the boredom?'); a.click(a.$('#aGo')); await sleep(800);
  assert.equal(a.$('#aVerdict').className,'averdict answered'); assert.equal(a.$$('.athread').length,2);
  assert.deepEqual(a.$$('.node.in-thread').map(n=>n.dataset.id).sort(),['n10','n11','n15','n6','n7','n8','n9']);
  assert.equal(a.byId('n6').dataset.step,'1'); assert.equal(a.byId('n9').dataset.step,'4'); assert.ok(a.$('#world').classList.contains('spot')); assert.equal(a.$$('#th path').length,6);
  a.click(a.$('.athread[data-i="1"] [data-aact=toggle]')); await sleep(80); assert.equal(a.$$('#th path').length,3);
  a.$('#aNext').checked = true; a.click(a.$('#aSum')); await sleep(300); assert.match(a.$('#aSumText').textContent,/Next:/);
  a.click(a.$('#aSumAll')); await sleep(300); assert.match(a.$('#aSumLabel').textContent,/whole tree/);
  a.type(a.$('#aQ'),'Who is the final boss?'); a.click(a.$('#aGo')); await sleep(800);
  assert.match(a.$('#aVerdict').textContent,/can’t answer/); assert.equal(a.$$('.gapitem').length,2); assert.ok(!a.$('#world').classList.contains('spot'));
  a.click(a.$('#aAddGaps')); await sleep(250); assert.equal(a.nodes().filter(n=>n.classList.contains('ghost')&&n.classList.contains('question')).length,2);
  a.type(a.$('#aQ'),'What causes the boredom?'); a.click(a.$('#aGo')); await sleep(800);
  a.click(a.byId('n8').querySelector('[data-act=del]')); await sleep(200); assert.equal(a.$$('.athread[data-i="0"] li').length,3);
  assert.deepEqual(a.errs,[]);
});
test('hosted: with no AI at all the page still boots and falls back to keywords',async()=>{
  const a = open({}); await sleep(400); assert.equal(a.nodes().length,18); assert.deepEqual(a.errs,[]);
  a.click(a.$('#askBtn')); a.type(a.$('#aQ'),'why is traversal slow'); a.click(a.$('#aGo')); await sleep(300);
  assert.match(a.$('#aVerdict').textContent,/keyword match/); assert.ok(a.$$('.node.in-thread').length>0);
});

/* =============================== static web build: demo provider =============================== */
test('web: starts in demo mode with a clear way to connect a real AI',async()=>{
  const a = open({ html:webHtml(), url:WEB_URL }); await sleep(400);
  assert.match(a.$('#stxt').textContent,/Demo mode/); assert.equal(a.$('#setLink').hidden,false); assert.equal(a.$('#setLink').textContent,'Connect an AI');
  a.click(a.$('#setBtn'));
  assert.ok(!a.$('#wOr').closest('[data-modes]').hidden); assert.ok(a.$('#wDemoRadio').checked);
  assert.ok(a.$('[data-modes="web"] a[href="https://github.com/example/cascade"]'),'links to the repo for the full version');
  assert.ok(!a.$('.stabs [data-tab=data]').hidden,'export and import are available');
  assert.deepEqual(a.errs,[]);
});
test('web demo: the headline question is placed under the traversal problem and grows a cascade',async()=>{
  const a = open({ html:webHtml(), url:WEB_URL }); await sleep(400);
  await a.drop('question','Would a bigger map horizontally solve traversal issues?',3600);
  assert.match(a.$('#ntxt').textContent,/Placed under .*Why does traversal feel slow/);
  const ghosts = a.nodes().filter(n=>n.classList.contains('ghost'));
  assert.ok(ghosts.length>=6,`ghosts: ${ghosts.length}`); assert.ok(ghosts.some(n=>n.classList.contains('emotion')));
  assert.deepEqual(a.errs,[]);
});
test('web demo: trace back from an emotion links questions to likely causes',async()=>{
  const a = open({ html:webHtml(), url:WEB_URL }); await sleep(400);
  a.click(a.byText('Bored crossing').querySelector('[data-act=back]')); await sleep(2600);
  assert.equal(a.nodes().filter(n=>n.classList.contains('ghost')).length,4);
  assert.ok(a.$$('#eg path.back').length>=2); assert.ok(a.$$('#eg path.rel').length>=2,'a dotted link to an existing cause');
});
test('web demo: chart the map, resolve with pushback, and grill to the end',async()=>{
  const a = open({ html:webHtml(), url:WEB_URL }); await sleep(400);
  a.click(a.$('#mapBtn')); a.type(a.$('#mDest'),'Make traversal feel like discovery'); a.click(a.$('#mChart')); await sleep(3800);
  const ghosts = a.nodes().filter(n=>n.classList.contains('ghost'));
  assert.equal(ghosts.length,7); assert.ok(ghosts.some(n=>n.classList.contains('fog')));
  a.click(a.$('#keepAll')); await sleep(150); assert.match(a.$('#mLists').textContent,/Waiting/); assert.match(a.$('#mLists').textContent,/Fog/);
  a.click(a.$('#mGrillAll')); await sleep(900);
  const cards = a.$$('.gcard'); assert.equal(cards.length,5);
  assert.ok(cards.some(c=>/won’t settle/.test(c.textContent)),'one question is flagged as needing a prototype');
  a.type(cards[0].querySelector('textarea'),'yes'); a.click(cards[0].querySelector('[data-gact=answer]')); await sleep(300);
  assert.equal(cards[0].querySelector('.gpush').hidden,false,'a one-word answer gets pushback');
  a.type(cards[0].querySelector('textarea'),'Eight minutes, because longer than that and players start to feel the walk is a chore rather than a journey');
  a.click(cards[0].querySelector('[data-gact=answer]')); await sleep(300);
  assert.ok(cards[0].classList.contains('done'),'a reasoned answer passes');
  a.click(a.$('#gNext')); await sleep(600); assert.equal(a.$('#gDone').hidden,false);
});
test('web demo: ask the graph and summarise, with no account',async()=>{
  const a = open({ html:webHtml(), url:WEB_URL }); await sleep(400);
  a.click(a.$('#askBtn')); a.click(a.$('#aChips .chip')); await sleep(900);
  assert.equal(a.$('#aVerdict').className,'averdict answered'); assert.ok(a.$$('.athread').length>=2); assert.ok(a.$$('.node.in-thread').length>=6);
  a.click(a.$('#aSum')); await sleep(400); assert.match(a.$('#aSumText').textContent,/^On “/);
  a.click(a.$('#aSumAll')); await sleep(400); assert.match(a.$('#aSumText').textContent,/questions/);
  a.type(a.$('#aQ'),'Who is the final boss?'); a.click(a.$('#aGo')); await sleep(600);
  assert.match(a.$('#aVerdict').textContent,/can’t answer/); assert.equal(a.$$('.gapitem').length,1);
  assert.deepEqual(a.errs,[]);
});

/* =============================== static web build: OpenRouter sign-in =============================== */
test('web OpenRouter: sign-in sends the user to OpenRouter with a PKCE challenge',async()=>{
  const a = open({ html:webHtml(), url:WEB_URL }); await sleep(300);
  a.click(a.$('#setBtn')); a.click(a.$('#wOrSignIn')); await sleep(200);
  assert.equal(a.navigated.length,1); const u = new URL(a.navigated[0]);
  assert.equal(u.origin+u.pathname,'https://openrouter.ai/auth');
  assert.equal(u.searchParams.get('callback_url'),WEB_URL); assert.equal(u.searchParams.get('code_challenge_method'),'S256');
  const verifier = JSON.parse(a.w.sessionStorage.getItem('cascade-or-pkce')).verifier;
  assert.ok(verifier.length>=43);
  assert.equal(u.searchParams.get('code_challenge'),crypto.createHash('sha256').update(verifier).digest('base64url'));
});
test('web OpenRouter: coming back with a code trades it for a key, picks a model and cleans the URL',async()=>{
  const verifier = 'x'.repeat(64);
  const a = open({ html:webHtml(), url:WEB_URL+'?code=or-code-1', fetchImpl:webFetch, session:{ 'cascade-or-pkce':J({ verifier, t:Date.now() }) } });
  await sleep(900);
  const saved = JSON.parse(a.w.localStorage.getItem('cascade-web-ai-v1'));
  assert.equal(saved.provider,'openrouter'); assert.equal(saved.key,'sk-or-test-key'); assert.equal(saved.model,'anthropic/claude-new-haiku','newest fast model from a major lab');
  assert.equal(a.w.location.search,''); assert.equal(a.w.sessionStorage.getItem('cascade-or-pkce'),null);
  assert.equal(a.$('#settings').hidden,false,'opens the AI tab so the user can confirm the model');
  assert.equal(a.$('#wOrRadio').checked,true); assert.match(a.$('#wOrKeyHint').textContent,/••••-key/);
  assert.ok(a.$$('#ml-wor option').length>=4); assert.match(a.$('#stxt').textContent,/Drag a block/);
  const ex = mock.log.filter(e=>e.path.endsWith('/auth/keys')).pop().body; assert.equal(ex.code_verifier,verifier);
});
test('web OpenRouter: blocks are placed by the chosen model, called straight from the browser',async()=>{
  const a = open({ html:webHtml(), url:WEB_URL, fetchImpl:webFetch, local:{ 'cascade-web-ai-v1':J({ provider:'openrouter', key:'sk-or-test-key', model:'anthropic/claude-new-haiku' }) } });
  await sleep(300); assert.equal(a.$('#setLink').hidden,true,'no "connect" nag once a real AI is set');
  const from = mock.log.length;
  await a.drop('question','Would a bigger map help?',900);
  const call = mock.log.slice(from).find(e=>e.path==='/openrouter/api/v1/chat/completions');
  assert.ok(call,'the browser called OpenRouter'); assert.equal(call.headers.authorization,'Bearer sk-or-test-key'); assert.equal(call.headers['x-title'],'Cascade');
  assert.equal(call.body.model,'anthropic/claude-new-haiku'); assert.equal(call.body.stream,true); assert.ok(call.body.messages[0].content.includes('placement engine'));
  assert.deepEqual(a.errs,[]);
});
test('web OpenRouter: test connection, out-of-credits message, and forgetting the key',async()=>{
  const a = open({ html:webHtml(), url:WEB_URL, fetchImpl:webFetch, local:{ 'cascade-web-ai-v1':J({ provider:'openrouter', key:'sk-or-test-key', model:'m' }) } });
  await sleep(300); a.click(a.$('#setBtn'));
  a.click(a.$('#wOrTest')); await sleep(400); assert.match(a.$('#wOrResult').textContent,/Connected/);
  a.type(a.$('#wOrKey'),'sk-or-broke'); a.click(a.$('#wOrSave')); await sleep(100); a.click(a.$('#wOrTest')); await sleep(400);
  assert.match(a.$('#wOrResult').textContent,/out of credits/);
  a.click(a.$('#wOrForget')); await sleep(100);
  assert.equal(JSON.parse(a.w.localStorage.getItem('cascade-web-ai-v1')).key,''); assert.ok(a.$('#wDemoRadio').checked);
});
test('web OpenRouter: a code with no matching verifier is ignored',async()=>{
  const a = open({ html:webHtml(), url:WEB_URL+'?code=or-code-1', fetchImpl:webFetch }); await sleep(500);
  assert.equal(a.w.localStorage.getItem('cascade-web-ai-v1'),null); assert.deepEqual(a.errs,[]);
});
test('web: an unfinished OpenRouter setup says so instead of calling a model',async()=>{
  const a = open({ html:webHtml(), url:WEB_URL, fetchImpl:webFetch, local:{ 'cascade-web-ai-v1':J({ provider:'openrouter', key:'k', model:'' }) } }); await sleep(400);
  assert.match(a.$('#stxt').textContent,/No AI connected/); assert.equal(a.$('#setLink').textContent,'Open settings');
});

/* =============================== local mode: real server =============================== */
async function bootServer(t,env = {}){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'cascade-ui-'));
  const p = spawn(process.execPath,[path.join(ROOT,'server','server.js')],{ env:{ ...process.env, NO_OPEN:'1', CASCADE_DATA_DIR:dir, ...mock.env, ...env } });
  p.out = ''; p.exited = false; p.on('exit',()=>{ p.exited = true; }); p.stdout.on('data',d=>p.out += d); p.stderr.on('data',d=>p.out += d);
  for(let i=0; i<100 && !/running at http:\/\/localhost:\d+/.test(p.out); i++) await sleep(50);
  const port = +p.out.match(/running at http:\/\/localhost:(\d+)/)[1], base = `http://localhost:${port}`;
  t.after(async()=>{ if(!p.exited){ p.kill('SIGINT'); for(let i=0; i<60 && !p.exited; i++) await sleep(50); } fs.rmSync(dir,{ recursive:true, force:true }); });
  return { p, port, base, dir, fetchImpl:(u,o)=>fetch(new URL(u,base+'/'),o) };
}
async function page(s,extra = {}){
  const html = require('../scripts/assemble').inlineParts(await (await fetch(s.base+'/')).text());
  return open({ html, url:s.base+'/', fetchImpl:s.fetchImpl, ...extra });
}
test('local: first run offers every way to connect, with the demo already working',async(t)=>{
  const s = await bootServer(t); const a = await page(s); await sleep(900);
  assert.equal(a.$('#settings').hidden,false,'Settings opens itself on first run');
  assert.deepEqual(a.$$('.prov[data-prov]').map(e=>e.dataset.prov),['chatgpt','openrouter','anthropic','openai','custom','demo']);
  assert.ok(a.$('.prov[data-prov=demo]').classList.contains('active')); assert.match(a.$('#stxt').textContent,/Demo mode/);
  assert.ok(a.$('[data-act=cgSignIn]').textContent.includes('Continue with ChatGPT')); assert.ok(a.$('[data-act=orSignIn]'));
  assert.deepEqual(a.errs,[]);
});
test('local: Continue with ChatGPT signs in through the loopback callback and picks a model',async(t)=>{
  const s = await bootServer(t); const a = await page(s); await sleep(800);
  a.click(a.$('[data-act=cgSignIn]')); await sleep(300);
  assert.equal(a.opened.length,1); const url = a.opened[0].location.href; assert.ok(url.includes('/chatgpt-auth/api/accounts/authorize'));
  assert.match(a.$('[data-prov=chatgpt] [data-role=cgstate]').textContent,/Waiting/);
  // play the browser: follow the authorize redirect, then hit the loopback callback on the server
  const cb = new URL((await fetch(url,{ redirect:'manual' })).headers.get('location'));
  assert.equal(cb.hostname,'127.0.0.1'); assert.equal(cb.pathname,'/auth/callback');
  const res = await fetch(`http://127.0.0.1:${s.port}${cb.pathname}${cb.search}`); assert.equal(res.status,200);
  await sleep(700);
  assert.match(a.$('[data-prov=chatgpt] [data-role=cgstate]').textContent,/Signed in as dev@example.com\. ChatGPT plan usage is allowed/);
  assert.equal(a.$('[data-prov=chatgpt] [data-act=cgSignOut]').hidden,false);
  assert.equal(a.$('#m-chatgpt').value,'gpt-plan-mini'); assert.equal((await (await fetch(s.base+'/api/settings')).json()).active,'demo','signing in does not silently switch providers');
  a.$('[data-prov=chatgpt] input[type=radio]').checked = true; a.$('[data-prov=chatgpt] input[type=radio]').dispatchEvent(new a.w.Event('change',{ bubbles:true })); await sleep(300);
  assert.equal(a.$('[data-prov=chatgpt] [data-role=status]').textContent,'In use');
  a.click(a.$('[data-prov=chatgpt] [data-act=test]')); await sleep(500); assert.match(a.$('[data-prov=chatgpt] [data-role=result]').textContent,/Connected/);
  assert.match(a.$('#setBtn').title,/ChatGPT plan · gpt-plan-mini/);
  a.escape(); await a.drop('question','Would a bigger map help?',900);
  assert.ok(mock.log.some(e=>e.path==='/chatgpt-api/v1/responses'),'the model call went through the plan-usage route');
  a.click(a.$('#setBtn')); a.click(a.$('[data-prov=chatgpt] [data-act=cgSignOut]')); await sleep(400);
  assert.match(a.$('[data-prov=chatgpt] [data-role=cgstate]').textContent,/Not signed in/); assert.equal(a.$('[data-prov=chatgpt] [data-act=cgSignIn]').hidden,false);
  assert.deepEqual(a.errs,[]);
});
test('local: a declined ChatGPT sign-in is explained',async(t)=>{
  const s = await bootServer(t); const a = await page(s); await sleep(800);
  mock.state.deny = true; t.after(()=>{ mock.state.deny = false; });
  a.click(a.$('[data-act=cgSignIn]')); await sleep(250);
  const cb = new URL((await fetch(a.opened[0].location.href,{ redirect:'manual' })).headers.get('location'));
  await fetch(`http://127.0.0.1:${s.port}${cb.pathname}${cb.search}`); await sleep(700);
  assert.match(a.$('[data-prov=chatgpt] [data-role=result]').textContent,/declined/);
});
test('local: Continue with OpenRouter stores the key on the server and fetches models',async(t)=>{
  const s = await bootServer(t); const a = await page(s,{}); await sleep(800);
  a.click(a.$('[data-act=orSignIn]')); await sleep(250);
  const u = new URL(a.navigated[0]); assert.equal(u.searchParams.get('callback_url'),s.base+'/');
  const verifier = JSON.parse(a.w.sessionStorage.getItem('cascade-or-pkce')).verifier;
  const b = await page(s,{ session:{ 'cascade-or-pkce':J({ verifier, t:Date.now() }) }, url:s.base+'/?code=or-code-1' }); await sleep(1100);
  const settings = await (await fetch(s.base+'/api/settings')).json();
  assert.equal(settings.active,'openrouter'); assert.equal(settings.providers.openrouter.hasKey,true); assert.ok(!JSON.stringify(settings).includes('sk-or-test-key'));
  assert.equal(b.w.location.search,''); assert.equal(b.$('.prov[data-prov=openrouter]').classList.contains('active'),true);
  assert.equal(b.$('#m-openrouter').value,'anthropic/claude-new-haiku'); assert.deepEqual(b.errs,[]);
});
test('local: server info, quit button and the stopped screen',async(t)=>{
  const s = await bootServer(t); const a = await page(s); await sleep(700);
  a.click(a.$('.stabs [data-tab=data]'));
  assert.match(a.$('#sInfo').textContent,new RegExp(`localhost:${s.port}`));
  a.click(a.$('#sQuit')); await sleep(800);
  assert.equal(a.$('#bye').hidden,false); assert.equal(a.$('#settings').hidden,true); assert.equal(s.p.exited,true);
});
test('local: saved tree comes back after a reload',async(t)=>{
  const s = await bootServer(t); const a = await page(s); await sleep(500);
  a.escape(); await a.drop('question','A brand new question about traversal speed',500); await sleep(600);
  const html = await (await fetch(s.base+'/')).text();
  assert.ok(html.includes('A brand new question about traversal speed'),'the server injected the saved tree');
});

/* =============================== build script =============================== */
test('build: scripts/build.js produces the web page the tests exercise, and the Pages marker file',()=>{
  const { execFileSync } = require('node:child_process');
  execFileSync(process.execPath,[path.join(ROOT,'scripts','build.js')],{ env:{ ...process.env, REPO_URL:'https://github.com/example/cascade' } });
  const built = fs.readFileSync(path.join(ROOT,'dist','web','index.html'),'utf8');
  assert.equal(built,webHtml()); assert.ok(!built.includes('<!--RUNTIME-->')); assert.ok(!built.includes('__REPO_URL__'));
  assert.ok(fs.existsSync(path.join(ROOT,'dist','web','.nojekyll')));
});
