'use strict';
// The look editor: node shapes, colours and sizes per block type, wire styles, canvas, text/describe editing, persistence.
const test = require('node:test'), assert = require('node:assert/strict');
const mocks = require('./helpers/mocks');
const { open, webHtml, sleep } = require('./helpers/dom');
const { bootServer, page } = require('./helpers/server');

let mock;
test.before(async()=>{ mock = await mocks.start(); });
test.after(async()=>{ await mock.close(); });

const J = JSON.stringify, WEB_URL = 'https://someone.github.io/cascade/';
const web = (extra = {}) => open({ html:webHtml(), url:WEB_URL, ...extra });
const hosted = (claude) => open({ claude });
const X = (n) => +n.style.transform.match(/translate\(([-\d.]+)px/)[1];
const Y = (n) => +n.style.transform.match(/translate\([-\d.]+px,\s*([-\d.]+)px/)[1];
const lookKey = (a) => JSON.parse(a.w.localStorage.getItem('cascade-look-v1') || '{}');
async function openLook(a,tab){
  if(a.$('#settings').hidden) a.click(a.$('#setBtn'));
  a.click(a.$('.stabs [data-tab=look]'));
  if(tab) a.click(a.$(`#lkTabs [data-lk=${tab}]`));
  await sleep(60);
}
const range = (a,sel,v) => { const el = a.$(sel); el.value = v; el.dispatchEvent(new a.w.Event('input',{ bubbles:true })); };
const select = (a,sel,v) => { const el = a.$(sel); el.value = v; el.dispatchEvent(new a.w.Event('change',{ bubbles:true })); };
const color = (a,sel,v) => { const el = a.$(sel); el.value = v; el.dispatchEvent(new a.w.Event('input',{ bubbles:true })); };
const treePaths = (a) => a.$$('#eg path').filter(p=>!/\b(rel|flow|block|back)\b/.test(p.getAttribute('class') || ''));
const rgb = (h) => `rgb(${parseInt(h.slice(1,3),16)}, ${parseInt(h.slice(3,5),16)}, ${parseInt(h.slice(5,7),16)})`;

test('the default look is exactly the original design',async()=>{
  const a = web(); await sleep(400);
  const v = (n,k) => n.querySelector('.in').style.getPropertyValue(k);
  const q = a.byText('Why does traversal feel slow'), d1 = a.byText('Bored crossing'), loop = a.byText('Explore');
  assert.equal(v(q,'--nr'),'3px 15px 15px 15px'); assert.equal(v(q,'--nsw'),'2px'); assert.equal(v(q,'--ns'),'var(--ink)');
  assert.equal(q.style.width,'224px'); assert.equal(loop.style.width,'196px'); assert.match(v(loop,'--nrg'),/1\.5px solid var\(--line\)/);
  assert.equal(v(d1,'--nf').toLowerCase(),'#a3aebf'); assert.equal(v(d1,'--nr'),'999px');
  assert.match(v(a.byText('Players skip optional'),'--nsh'),/inset 5px 0 0 var\(--ink2\)/);
  const tree = treePaths(a); assert.ok(tree.length>10); assert.ok(tree.every(p=>/C/.test(p.getAttribute('d')) && !/[LQ]/.test(p.getAttribute('d'))));
  assert.ok(tree.every(p=>p.style.stroke==='' && !p.hasAttribute('marker-end')),'wires use the stylesheet colours');
  assert.equal(a.$('#stage').style.backgroundColor,''); assert.deepEqual(a.errs,[]);
  assert.equal(a.w.localStorage.getItem('cascade-look-v1'),null,'nothing is stored until you change something');
});
test('appearance opens as a side sheet that leaves the canvas visible and live',async()=>{
  const a = web(); await sleep(300); await openLook(a);
  assert.ok(a.$('#settings').classList.contains('sheet')); assert.equal(a.$('#app').inert,false);
  a.click(a.$('.stabs [data-tab=goal]')); assert.ok(!a.$('#settings').classList.contains('sheet')); assert.equal(a.$('#app').inert,true);
  a.click(a.$('.stabs [data-tab=look]')); assert.ok(a.$('#settings').classList.contains('sheet'));
  a.click(a.$('#sClose')); assert.equal(a.$('#app').inert,false);
});

test('presets restyle everything: shapes, wires, arrows and canvas',async()=>{
  const a = web(); await sleep(300); await a.drop('decision','Add a glide ability',700); a.escape();
  await openLook(a,'presets'); a.click(a.$('.lk-preset[data-id=blueprint]')); await sleep(200);
  assert.equal(a.$('#stage').style.backgroundColor,rgb('#0b2545')); assert.match(a.$('#stage').style.backgroundImage,/linear-gradient/);
  const dec = a.byText('Add a glide ability'); assert.ok(dec.querySelector('.in').classList.contains('sh-poly'));
  assert.equal(dec.querySelector('.shp polygon').getAttribute('points'),'50,0 100,50 50,100 0,50'); assert.equal(dec.style.width,'240px');
  const tree = treePaths(a); assert.ok(tree.every(p=>!/[CQ]/.test(p.getAttribute('d'))),'right-angle wires, radius 0');
  assert.ok(tree.every(p=>(p.getAttribute('marker-end') || '').includes('#ahc')),'arrowheads on'); assert.equal(tree[0].style.stroke,'#8da9c4');
  assert.ok(a.$('.tile[data-type=decision]').classList.contains('sh-poly'),'the palette follows the look');
  assert.equal(lookKey(a).wires.style,'manhattan');
  a.click(a.$('.lk-preset[data-id=shapes]')); await sleep(150);
  assert.equal(a.byText('Why does traversal feel slow').querySelector('.shp polygon').getAttribute('points'),'10,0 90,0 100,50 90,100 10,100 0,50');
  assert.deepEqual(a.errs,[]);
});

test('per-type size drives the layout, and shape adds room for the text',async()=>{
  const a = web(); await sleep(300);
  const ans = () => a.byText('Points of interest sit far apart'), before = X(ans());
  await openLook(a,'nodes'); a.click(a.$('#lkType [data-t=question]'));
  range(a,'input[data-f=width]','400'); await sleep(150);
  const q = a.byText('Why does traversal feel slow'); assert.equal(q.style.width,'400px');
  assert.ok(X(ans())>=before+170,`the next column moved right (${before} -> ${X(ans())})`);
  assert.equal(a.$('#lkPv .blk').parentNode.style.getPropertyValue('--pvw'),'400px','the preview follows');
  select(a,'select[data-f=shape]','diamond'); await sleep(100);
  const inq = q.querySelector('.in'); assert.ok(inq.classList.contains('sh-poly')); assert.equal(inq.style.getPropertyValue('--npx'),'52px','12px + 40px extra so text stays in the diamond');
  select(a,'select[data-f=shape]','pill'); await sleep(60); assert.equal(q.querySelector('.in').style.getPropertyValue('--nr'),'999px');
  assert.deepEqual(lookKey(a).nodes.question,{ width:400, shape:'pill' });
  a.click(a.$('#lkTypeReset')); await sleep(100); assert.equal(q.style.width,'224px'); assert.equal(lookKey(a).nodes,undefined);
});
test('colours: per type, "all blocks" leaves emotions on their mood, and mood colours are editable with automatic contrast',async()=>{
  const a = web(); await sleep(300); await openLook(a,'nodes');
  a.click(a.$('#lkType [data-t=question]')); color(a,'input[data-f=fill]','#ff0000'); await sleep(80);
  const v = (n,k) => n.querySelector('.in').style.getPropertyValue(k);
  assert.equal(v(a.byText('Why does traversal feel slow'),'--nf'),'#ff0000'); assert.equal(v(a.byText('Points of interest sit far apart'),'--nf'),'var(--paper)');
  a.click(a.$('#lkType [data-t=base]')); color(a,'input[data-f=fill]','#112233'); await sleep(80);
  assert.equal(v(a.byText('Points of interest sit far apart'),'--nf'),'#112233'); assert.equal(v(a.byText('Why does traversal feel slow'),'--nf'),'#ff0000','a type beats "all"');
  assert.equal(v(a.byText('Bored crossing'),'--nf').toLowerCase(),'#a3aebf','emotions keep their mood colour');
  a.click(a.$('#lkType [data-t=emotion]')); assert.equal(a.$('#lkMoods').hidden,false);
  color(a,'input[data-mood=boredom]','#ff00ff'); await sleep(80);
  assert.equal(v(a.byText('Bored crossing'),'--nf'),'#ff00ff'); assert.equal(v(a.byText('Bored crossing'),'--nfg'),'#ffffff','white text on dark magenta');
  assert.match(a.$('#legend li i').getAttribute('style') + a.$$('#legend li i').map(i=>i.getAttribute('style')).join(''),/#ff00ff/);
  color(a,'input[data-mood=boredom]','#ffff00'); await sleep(60); assert.equal(v(a.byText('Bored crossing'),'--nfg'),'#142033','dark text on yellow');
  const kw = a.$('input[data-f=fill-kw]'); kw.checked = false; kw.dispatchEvent(new a.w.Event('change',{ bubbles:true })); await sleep(60);
  assert.ok(/^#[0-9a-f]{6}$/.test(lookKey(a).nodes.emotion.fill),'a fixed colour replaces "match mood"');
  kw.checked = true; kw.dispatchEvent(new a.w.Event('change',{ bubbles:true })); await sleep(60); assert.equal(lookKey(a).nodes.emotion.fill,'mood');
});

test('wires: default, straight, manhattan and bezier, with their adjustments',async()=>{
  const a = web(); await sleep(300); await openLook(a,'wires');
  const tree = () => treePaths(a), dist = (d) => { const m = d.match(/^M([-\d.]+) ([-\d.]+)C([-\d.]+) /); return Math.abs(+m[3]-+m[1]); };
  const wide = () => tree().map(p=>p.getAttribute('d')).filter(d=>/C/.test(d)).sort((x,y)=>dist(y)-dist(x))[0];
  assert.ok(a.$('#lkWStyle [data-v=default]').getAttribute('aria-pressed')==='true'); assert.equal(a.$$('#lkWpv path').length,3);
  a.click(a.$('#lkWStyle [data-v=straight]')); await sleep(80);
  assert.ok(tree().every(p=>/^M[-\d.]+ [-\d.]+L[-\d.]+ [-\d.]+$/.test(p.getAttribute('d'))),'straight lines'); assert.match(a.$('#lkWpv path').getAttribute('d'),/L/);
  a.click(a.$('#lkWStyle [data-v=manhattan]')); await sleep(80);
  assert.ok(tree().some(p=>/Q/.test(p.getAttribute('d'))),'rounded corners at radius 10'); assert.ok(tree().every(p=>!/C/.test(p.getAttribute('d'))));
  range(a,'input[data-f=wradius]','0'); await sleep(60); assert.ok(tree().every(p=>!/Q/.test(p.getAttribute('d'))),'square corners at radius 0');
  const elbow = (e) => { range(a,'input[data-f=elbow]',e); return tree().map(p=>p.getAttribute('d')).find(d=>/L/.test(d)); };
  const e1 = elbow('0.2'); await sleep(40); const e2 = elbow('0.8'); assert.notEqual(e1,e2,'the elbow moves');
  a.click(a.$('#lkWStyle [data-v=bezier]')); await sleep(60);
  range(a,'input[data-f=curvature]','0'); await sleep(40); const flat = dist(wide());
  range(a,'input[data-f=curvature]','1'); await sleep(40); const swoop = dist(wide());
  assert.ok(swoop>flat*2,`more curve at 1 than at 0 (${flat} -> ${swoop})`);
  a.click(a.$('#lkWStyle [data-v=default]')); await sleep(60); assert.equal(lookKey(a).wires.style,'default');
  assert.deepEqual(a.errs,[]);
});
test('wires: width, colour, dash, arrowheads, colour-by-block and per-link overrides',async()=>{
  const a = web(); await sleep(300); await openLook(a,'wires');
  range(a,'input[data-f=wwidth]','4'); select(a,'select[data-f=wdash]','dashed'); color(a,'input[data-f=wcolor]','#00aa00'); await sleep(80);
  const first = treePaths(a).find(p=>!/\bg\b/.test(p.getAttribute('class')));
  assert.equal(first.style.strokeWidth,'4'); assert.equal(first.style.strokeDasharray,'7 6'); assert.equal(first.style.stroke,'#00aa00');
  select(a,'select[data-f=warrows]','end'); await sleep(60); assert.ok((first.getAttribute('marker-end') || '').includes('#ahc')); assert.ok(a.$('#edges defs marker[id^=ahc]'));
  select(a,'select[data-f=wcolorBy]','child'); await sleep(80);
  const stroke = (txt) => { const n = a.byText(txt); return treePaths(a).find(p=>p.getAttribute('d').endsWith(`${X(n)} ${Y(n)+n.offsetHeight/2}`) || true); };
  const colours = new Set(treePaths(a).map(p=>p.style.stroke)); assert.ok(colours.size>=3,`wires take the colour of the block they lead to (${[...colours].join(', ')})`);
  assert.ok(colours.has('var(--ink)') && [...colours].some(c=>/^#/.test(c)),'question outline and mood colours');
  color(a,'input[data-f=k-related-color]','#ff8800'); await sleep(60);
  const rel = a.$$('#eg path.rel')[0]; assert.ok(rel); assert.equal(rel.style.stroke,'#ff8800');
  select(a,'select[data-f=k-flow-dash]','solid'); await sleep(60); assert.equal(a.$$('#eg path.flow')[0].style.strokeDasharray,'none');
});
test('canvas: background, grid style and spacing',async()=>{
  const a = web(); await sleep(300); await openLook(a,'canvas');
  const ans = () => a.byText('Points of interest sit far apart'), x0 = X(ans());
  a.click(a.$('#lkGrid [data-v=none]')); assert.equal(a.$('#stage').style.backgroundImage,'none');
  a.click(a.$('#lkGrid [data-v=lines]')); assert.match(a.$('#stage').style.backgroundImage,/linear-gradient/);
  color(a,'input[data-f=cbg]','#223344'); assert.equal(a.$('#stage').style.backgroundColor,rgb('#223344'));
  range(a,'input[data-f=colGap]','120'); await sleep(120); assert.ok(X(ans())>x0+60);
  const sibs = () => a.$$('.node').filter(n=>n.style.display!=='none' && /Is the ground|Points of interest|No movement abilities/.test(n.textContent)).map(Y).sort((p,q)=>p-q);
  const g0 = sibs(); range(a,'input[data-f=rowGap]','60'); await sleep(120); const g1 = sibs();
  assert.ok(g1[g1.length-1]-g1[0]>g0[g0.length-1]-g0[0],'rows spread out');
  assert.deepEqual(lookKey(a).canvas,{ grid:'lines',bg:'#223344' }); assert.equal(lookKey(a).layout.colGap,120);
});

test('text editor: applies valid JSON, drops unknown and out-of-range values, and rejects bad JSON',async()=>{
  const a = web(); await sleep(300); await openLook(a,'text');
  const ta = a.$('#lkText'); assert.equal(ta.value.trim(),'{}');
  ta.value = '{ nope'; a.click(a.$('#lkApply')); assert.match(a.$('#lkTextErr').textContent,/isn’t valid JSON/); assert.deepEqual(lookKey(a),{});
  ta.value = '[1,2]'; a.click(a.$('#lkApply')); assert.match(a.$('#lkTextErr').textContent,/must be a JSON object/);
  ta.value = J({ wires:{ style:'straight', color:'red', width:99 }, nodes:{ decision:{ width:9999, shape:'star', fill:'javascript:alert(1)' } }, zzz:1 });
  a.click(a.$('#lkApply')); await sleep(100);
  assert.match(a.$('#lkTextErr').textContent,/Applied\. 3 values were ignored/);
  const L = lookKey(a); assert.equal(L.wires.style,'straight'); assert.equal(L.wires.color,'#d94a2b','colour names are understood'); assert.equal(L.wires.width,10,'clamped');
  assert.deepEqual(L.nodes.decision,{ width:480 }); assert.equal(L.zzz,undefined);
  assert.match(a.$('#lkText').value,/"style": "straight"/);
});
test('describe in words: the built-in interpreter, preview, keep and put back',async()=>{
  const a = web(); await sleep(300); await a.drop('decision','Add a glide ability',700); a.escape();
  await openLook(a,'describe');
  a.$('#lkDesc').value = 'A calm blueprint look with straight wires and huge decisions'; a.click(a.$('#lkGo')); await sleep(250);
  assert.equal(a.$('#lkResult').hidden,false); assert.match(a.$('#lkNote').textContent,/keyword engine/);
  assert.match(a.$('#lkChanges').textContent,/Decision blocks: .*width 336/); assert.match(a.$('#lkChanges').textContent,/Wires: .*style straight/);
  assert.equal(a.byText('Add a glide ability').style.width,'336px'); assert.equal(a.$('#stage').style.backgroundColor,rgb('#0b2545'));
  assert.equal(a.w.localStorage.getItem('cascade-look-v1'),null,'a preview is not saved yet');
  a.click(a.$('#lkRevert')); await sleep(120);
  assert.equal(a.byText('Add a glide ability').style.width,'224px'); assert.equal(a.$('#lkResult').hidden,true); assert.equal(a.$('#stage').style.backgroundColor,'');
  a.$('#lkDesc').value = 'big red decisions and small grey answers'; a.click(a.$('#lkGo')); await sleep(250); a.click(a.$('#lkKeep')); await sleep(100);
  const L = lookKey(a); assert.equal(L.nodes.decision.fill,'#d94a2b'); assert.ok(L.nodes.decision.width>224); assert.equal(L.nodes.answer.fill,'#8a94a3'); assert.ok(L.nodes.answer.width<224);
  assert.equal(a.byText('Add a glide ability').querySelector('.in').style.getPropertyValue('--nfg'),'#ffffff','auto contrast on red');
  a.$('#lkDesc').value = 'soft pastel with curvy wires'; a.click(a.$('#lkGo')); await sleep(200);
  assert.equal(lookKey(a).nodes.decision.fill,'#d94a2b','previewing does not overwrite what you saved'); a.click(a.$('#lkKeep')); await sleep(80);
  const P = lookKey(a); assert.equal(P.wires.style,'bezier'); assert.equal(P.canvas.bg,'#f7f4ff');
  a.$('#lkDesc').value = 'xyzzy plugh'; a.click(a.$('#lkGo')); await sleep(150);
  assert.match(a.$('#lkStatus').textContent,/couldn’t find anything to change/);
  assert.deepEqual(a.errs,[]);
});
test('describe in words with an AI: the reply is cleaned before it is applied, and a bad reply falls back',async()=>{
  const prompts = []; let reply = J({ wires:{ style:'manhattan', radius:4 }, nodes:{ decision:{ fill:'red', text:'auto', width:9999, shape:'star' } }, bogus:1 });
  const a = hosted({ use: async (n) => n!=='sample' ? null : async (prompt) => { prompts.push(prompt); return { text:reply }; } });
  await sleep(300); await openLook(a,'describe');
  a.$('#lkDesc').value = 'industrial and bold'; a.click(a.$('#lkGo')); await sleep(300);
  assert.ok(prompts[0].includes('visual designer for a node-graph app') && prompts[0].includes('DESCRIPTION: industrial and bold'));
  assert.doesNotMatch(a.$('#lkNote').textContent,/keyword engine/);
  const L = JSON.parse(a.w.localStorage.getItem('cascade-look-v1') || 'null'); assert.equal(L,null,'preview only');
  a.click(a.$('#lkKeep')); await sleep(80); const K = lookKey(a);
  assert.deepEqual(K.nodes.decision,{ fill:'#d94a2b',text:'auto',width:480 }); assert.equal(K.wires.style,'manhattan'); assert.equal(K.bogus,undefined);
  reply = 'sorry, I can not do that'; a.$('#lkDesc').value = 'straight wires please'; a.click(a.$('#lkGo')); await sleep(300);
  assert.match(a.$('#lkNote').textContent,/reply couldn’t be used/); assert.match(a.$('#lkChanges').textContent,/style straight/);
});

test('undo and reset',async()=>{
  const a = web(); await sleep(300); await openLook(a,'presets');
  assert.equal(a.$('#lkUndo').disabled,true);
  a.click(a.$('.lk-preset[data-id=neon]')); await sleep(100); assert.equal(a.$('#lkUndo').disabled,false);
  a.click(a.$('.lk-preset[data-id=paper]')); await sleep(100); assert.equal(lookKey(a).canvas.bg,'#fbf7ef');
  a.click(a.$('#lkUndo')); await sleep(100); assert.equal(lookKey(a).canvas.bg,'#0a0a12','back to neon');
  a.click(a.$('#lkUndo')); await sleep(100); assert.deepEqual(lookKey(a),{});
  a.click(a.$('.lk-preset[data-id=pastel]')); await sleep(100); a.click(a.$('#lkReset')); await sleep(100);
  assert.deepEqual(lookKey(a),{}); assert.equal(a.$('#stage').style.backgroundColor,'');
  a.click(a.$('#lkUndo')); await sleep(100); assert.equal(lookKey(a).canvas.bg,'#f7f4ff','reset can be undone');
});
test('the look survives a reload (browser storage) and works hosted inside Claude too',async()=>{
  const a = hosted(); await sleep(300); await openLook(a,'presets'); a.click(a.$('.lk-preset[data-id=blueprint]')); await sleep(150);
  const saved = a.w.localStorage.getItem('cascade-look-v1'); assert.ok(saved);
  const b = open({ local:{ 'cascade-look-v1':saved } }); await sleep(400);
  assert.equal(b.$('#stage').style.backgroundColor,rgb('#0b2545')); assert.ok(treePaths(b).every(p=>!/C/.test(p.getAttribute('d'))));
  assert.equal(b.$('#settings').hidden,true,'applied at start without opening settings');
  const c = open({ local:{ 'cascade-look-v1':'{ not json' } }); await sleep(300); assert.equal(c.nodes().length,18); assert.deepEqual(c.errs,[]);
  const d = open({ local:{ 'cascade-look-v1':J({ wires:{ style:'evil' }, nodes:{ question:{ width:99999, fill:'url(javascript:1)' } } }) } }); await sleep(300);
  assert.equal(d.byText('Why does traversal feel slow').style.width,'480px','an out-of-range size is clamped, not trusted');
  assert.equal(d.byText('Why does traversal feel slow').querySelector('.in').style.getPropertyValue('--nf'),'var(--paper)','a non-colour fill is ignored');
  assert.ok(treePaths(d).every(p=>/C/.test(p.getAttribute('d'))),'an unknown wire style falls back to the default'); assert.deepEqual(d.errs,[]);
});
test('local app: the look is stored on the server and follows you to a new browser',async(t)=>{
  const s = await bootServer(t,mock); const a = await page(s); await sleep(800); a.escape();
  await openLook(a,'presets'); a.click(a.$('.lk-preset[data-id=neon]')); await sleep(800);
  const st = await (await fetch(s.base+'/api/settings')).json(); assert.equal(st.look.wires.style,'straight'); assert.equal(st.look.canvas.bg,'#0a0a12');
  const b = await page(s); await sleep(500);
  assert.equal(b.$('#stage').style.backgroundColor,rgb('#0a0a12'),'a fresh page (empty browser storage) picks the look up from the server');
  assert.deepEqual(a.errs.concat(b.errs),[]);
});

test('describe: ordinary phrases do not trigger the wrong preset',async()=>{
  const a = web(); await sleep(300); await openLook(a,'describe');
  a.$('#lkDesc').value = 'no grid and a plain background with thick wires'; a.click(a.$('#lkGo')); await sleep(200);
  a.click(a.$('#lkKeep')); await sleep(60);
  const L = lookKey(a); assert.equal(L.canvas.grid,'none'); assert.equal(L.wires.width,3.5); assert.equal(L.nodes,undefined,'no preset was applied');
});
test('palette tiles follow polygon shapes and keep their label inside',async()=>{
  const a = web(); await sleep(300); await openLook(a,'presets'); a.click(a.$('.lk-preset[data-id=shapes]')); await sleep(120);
  const t = a.$('.tile[data-type=decision]'); assert.ok(t.classList.contains('sh-poly')); assert.equal(t.querySelector('.shp polygon').getAttribute('points'),'50,0 100,50 50,100 0,50');
  assert.ok(parseFloat(t.style.getPropertyValue('--npx'))>12,'extra side padding on a diamond tile');
});
