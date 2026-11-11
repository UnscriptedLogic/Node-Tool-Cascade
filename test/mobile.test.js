'use strict';
// Phones: the standard layout (top bar, dock, action strip, bottom sheet) and the minimal one (only the canvas, menus on tap),
// plus the rendering work that keeps panning smooth on slow devices.
const test = require('node:test'), assert = require('node:assert/strict');
const { open, webHtml, sleep } = require('./helpers/dom');

const GAME = { 'cascade-prefs-v1':JSON.stringify({ domain:'game' }) };
const phone = (extra = {}) => open({ width:390, height:844, local:GAME, ...extra });
const tapPoint = (a,el) => { const r = el.getBoundingClientRect(); return { x:r.left+20, y:r.top+10 }; };
const ptr = (a,type,target,x,y) => { const e = new a.w.MouseEvent(type,{ bubbles:true, clientX:x, clientY:y }); Object.defineProperty(e,'pointerId',{ value:1 }); target.dispatchEvent(e); };
// a tap on the canvas: down and up in the same place
const tapStage = (a,x = 60,y = 300) => { ptr(a,'pointerdown',a.$('#stage'),x,y); ptr(a,'pointerup',a.$('#stage'),x,y); };
const tapNode = (a,el) => { ptr(a,'pointerdown',el,50,50); ptr(a,'pointerup',el,50,50); };
const menuLabels = (a) => a.$$('#ctx button').map(b=>(b.querySelector('.lb') || b).textContent.trim());

test('mobile: wide windows are untouched; narrow ones get a layout, and ?layout= or the setting picks which',async()=>{
  const d = open({ local:GAME }); await sleep(300);
  assert.ok(!d.d.body.classList.contains('m')); assert.equal(d.$('#nodebar').hidden,true);
  const s = phone(); await sleep(300);
  assert.ok(s.d.body.classList.contains('m') && s.d.body.classList.contains('m-standard') && !s.d.body.classList.contains('m-minimal'));
  const m = phone({ url:'https://cascade.test/?layout=minimal' }); await sleep(300);
  assert.ok(m.d.body.classList.contains('m-minimal') && !m.d.body.classList.contains('m-standard'));
  // the choice lives in Settings > Behavior and is remembered
  const c = phone(); await sleep(300);
  c.click(c.$('#setBtn')); c.click(c.$('.stabs [data-tab=behavior]'));
  c.click(c.$('#bLayout [data-val=minimal]'));
  assert.ok(c.d.body.classList.contains('m-minimal')); assert.equal(JSON.parse(c.w.localStorage.getItem('cascade-prefs-v1')).mobileLayout,'minimal');
  // resizing a window across the breakpoint switches layouts
  const r = open({ local:GAME }); await sleep(300);
  Object.defineProperty(r.w,'innerWidth',{ value:400, configurable:true }); r.w.dispatchEvent(new r.w.Event('resize')); await sleep(250);
  assert.ok(r.d.body.classList.contains('m'));
  Object.defineProperty(r.w,'innerWidth',{ value:1200, configurable:true }); r.w.dispatchEvent(new r.w.Event('resize')); await sleep(250);
  assert.ok(!r.d.body.classList.contains('m'));
  for(const x of [d,s,m,c,r]) assert.deepEqual(x.errs,[]);
});

test('mobile standard: selecting a block shows an action strip, and the strip runs the actions',async()=>{
  const a = phone(); await sleep(500);
  const node = a.byText('Bored crossing');
  assert.equal(a.$('#nodebar').hidden,true,'nothing selected, no strip');
  tapNode(a,node); await sleep(100);
  const bar = a.$('#nodebar'); assert.equal(bar.hidden,false);
  const acts = [...bar.querySelectorAll('button')].map(b=>b.dataset.act);
  assert.ok(acts.includes('grill') && acts.includes('grow') && acts.includes('back') && acts.includes('del'),'the same actions the desktop bar offers: '+acts);
  assert.match(bar.textContent,/Grill/); assert.ok(a.$('#stage').classList.contains('nb'));
  const before = a.nodes().length;
  a.click(bar.querySelector('[data-act=del]')); await sleep(200);
  assert.equal(a.nodes().length,before-1,'delete ran'); assert.equal(a.$('#nodebar').hidden,true,'the strip goes with the selection');
  tapStage(a); assert.equal(a.$('#nodebar').hidden,true);
  assert.deepEqual(a.errs,[]);
});

test('mobile standard: the dock\'s More button opens the same menu as a bottom sheet',async()=>{
  const a = phone(); await sleep(400);
  a.click(a.$('#moreBtn'));
  assert.ok(a.$('#ctx.sheet') && a.$('#ctxBack'),'a sheet with a backdrop');
  const labels = menuLabels(a); for(const l of ['Add a block','Ask the graph','Map and grill','Undo','Fit to screen','Settings','Switch to minimal layout']) assert.ok(labels.includes(l),l+' in '+labels);
  a.click(a.$$('#ctx button').find(b=>b.textContent.includes('Add a block')));
  assert.deepEqual(menuLabels(a).slice(1),['Question','Answer','Emotion','Consequence','Decision','Loop','Fog'],'a submenu with a back row');
  a.click(a.$('#ctx .ctx-back')); assert.ok(menuLabels(a).includes('Ask the graph'));
  a.click(a.$$('#ctx button').find(b=>b.textContent.includes('Switch to minimal layout'))); await sleep(50);
  assert.ok(a.d.body.classList.contains('m-minimal')); assert.ok(!a.$('#ctx'),'the menu closed');
  assert.deepEqual(a.errs,[]);
});

test('mobile minimal: a tap on empty space opens a menu, Add a block opens the composer there, a drag only pans',async()=>{
  const a = phone({ url:'https://cascade.test/?layout=minimal' }); await sleep(500);
  assert.ok(!a.$('#ctx'));
  tapStage(a,60,300); await sleep(50);
  assert.ok(a.$('#ctx') && !a.$('#ctx.sheet'),'a popover at the tap'); assert.ok(menuLabels(a).includes('Add a block'));
  a.click(a.$$('#ctx button').find(b=>b.textContent.includes('Add a block')));
  a.click(a.$$('#ctx button').find(b=>b.textContent.trim()==='Question')); await sleep(80);
  assert.equal(a.$('#compose').hidden,false); assert.equal(a.$('#compose .cname').textContent,'Question');
  a.escape(); await sleep(50);
  // a drag across the canvas pans and does not open a menu
  const x0 = a.w.eval('S.view.x');
  ptr(a,'pointerdown',a.$('#stage'),100,300); ptr(a,'pointermove',a.$('#stage'),160,320); ptr(a,'pointerup',a.$('#stage'),160,320); await sleep(60);
  assert.ok(!a.$('#ctx'),'no menu after a pan'); assert.notEqual(a.w.eval('S.view.x'),x0,'the view moved');
  assert.deepEqual(a.errs,[]);
});

test('mobile minimal: tapping a block opens its menu, an outside tap only closes it, and an item acts',async()=>{
  const a = phone({ url:'https://cascade.test/?layout=minimal' }); await sleep(500);
  const node = a.byText('Bored crossing'); const before = a.nodes().length;
  tapNode(a,node); await sleep(50);
  assert.ok(a.$('#ctx')); assert.match(a.$('#ctx .ctx-title').textContent,/Bored crossing/);
  const labels = menuLabels(a); for(const l of ['Edit text','Grill me on this','Grow branches from here']) assert.ok(labels.includes(l),l+' in '+labels);
  assert.ok(a.$$('#ctx button.danger').length>=1,'delete is marked');
  // a tap outside closes it without opening the canvas menu
  ptr(a,'pointerdown',a.$('#stage'),20,20); ptr(a,'pointerup',a.$('#stage'),20,20); await sleep(50);
  assert.ok(!a.$('#ctx'),'closed, not replaced');
  tapNode(a,node); await sleep(50);
  a.click(a.$$('#ctx button.danger')[0]); await sleep(200);
  assert.equal(a.nodes().length,before-1,'the item ran');
  // Escape closes
  tapStage(a); await sleep(50); assert.ok(a.$('#ctx')); a.escape(); assert.ok(!a.$('#ctx'));
  assert.deepEqual(a.errs,[]);
});

test('mobile minimal: suggestions are handled from the menu, and the hint appears once',async()=>{
  const web = { html:webHtml(), url:'https://someone.github.io/cascade/?layout=minimal' };   // the demo AI grows suggestions
  const a = phone(web); await sleep(1100);
  assert.match(a.$('#ntxt').textContent,/Tap empty space for a menu/);
  await a.drop('question','Would a bigger map help?',2300);
  assert.ok(a.nodes().some(n=>n.classList.contains('ghost')));
  tapStage(a); await sleep(50);
  const labels = menuLabels(a); assert.ok(labels.some(l=>/^Keep all \d+ suggestions?$/.test(l)),labels.join()); assert.ok(labels.includes('Dismiss all suggestions'));
  a.click(a.$$('#ctx button').find(b=>/^Keep all/.test(b.textContent.trim()))); await sleep(120);
  assert.ok(!a.nodes().some(n=>n.classList.contains('ghost')),'all kept');
  const again = phone({ ...web, local:{ ...GAME, 'cascade-minimal-hint':'1' } }); await sleep(1100);
  assert.ok(!/Tap empty space/.test(again.$('#ntxt').textContent),'only shown once');
});

/* ------------------------------- smooth panning ------------------------------- */
test('performance: the grid layer carries the pan and zoom variables, so no block is restyled by a camera move',async()=>{
  const a = open({ local:GAME }); await sleep(400);
  a.w.eval('S.view.x += 40; S.view.z = .9; applyView()');
  const stage = a.$('#stage'), grid = a.$('#grid');
  for(const v of ['--gx','--gy','--gs','--z']) assert.equal(stage.style.getPropertyValue(v),'',v+' is not set on the stage, where every block would inherit it');
  assert.match(grid.style.transform,/translate3d/); assert.notEqual(grid.style.getPropertyValue('--gs'),'');
  a.w.eval('S.view.z = .4; applyView()'); assert.equal(a.$('#world').style.getPropertyValue('--z'),'0.40','--z only exists on the world, and only when zoomed far out');
  assert.equal(a.$('#world').classList.contains('far'),true);
});

test('performance: a camera-only animation does not redraw the edges, but changing the tree does',async()=>{
  const a = open({ local:GAME }); await sleep(500);
  let n = 0; const real = a.w.drawEdges; a.w.drawEdges = () => { n++; return real(); };
  await sleep(300); n = 0;
  a.w.eval("fitTo(visibleIds(),{maxZ:1,minZ:.3,pad:56})"); await sleep(700);
  assert.equal(n,0,'panning and zooming leave the edges as they are');
  a.w.eval("S.nodes[S.order.find(i=>S.nodes[i].type==='question')].text = 'Changed'; layout(false)"); await sleep(400);
  assert.ok(n>0,'a change to the tree redraws them');
});

test('performance: a burst of pointer moves is applied once per frame',async()=>{
  const a = phone(); await sleep(500);
  let n = 0; const real = a.w.applyView; a.w.applyView = () => { n++; return real(); };
  ptr(a,'pointerdown',a.$('#stage'),100,300);
  for(let i=1;i<=40;i++) ptr(a,'pointermove',a.$('#stage'),100+i*2,300);
  const x = a.w.eval('S.view.x'); ptr(a,'pointerup',a.$('#stage'),180,300); await sleep(80);
  assert.ok(n<=4,`40 moves caused ${n} camera updates`); assert.ok(a.w.eval('S.view.x')===x,'and the view still ended where the finger did');
});

test('performance: restyle leaves blocks whose classes did not change alone',async()=>{
  const a = open({ local:GAME }); await sleep(400);
  const el = a.nodes()[3]; let writes = 0; const proto = Object.getOwnPropertyDescriptor(a.w.Element.prototype,'className');
  Object.defineProperty(el,'className',{ configurable:true, get(){ return proto.get.call(this); }, set(v){ writes++; proto.set.call(this,v); } });
  a.w.eval('restyle()'); assert.equal(writes,0,'same classes, no write');
  a.w.eval("S.sel = '"+el.dataset.id+"'; restyle()"); assert.equal(writes,1,'it changed, so it was written once');
});
