'use strict';
// In a big tree most blocks are off screen. Hiding the ones that cannot be seen is what keeps panning smooth on a phone.
const test = require('node:test'), assert = require('node:assert/strict');
const { open, sleep } = require('./helpers/dom');

const GAME = { 'cascade-prefs-v1':JSON.stringify({ domain:'game' }) };

test('culling: in a big tree far-away blocks are hidden, never the selected one, and they return when panned to',async()=>{
  const a = open({ local:GAME }); await sleep(400);
  const st = a.$('#stage');
  Object.defineProperty(st,'clientWidth',{ value:400, configurable:true }); Object.defineProperty(st,'clientHeight',{ value:700, configurable:true });
  a.w.eval(`(()=>{ const nodes = {}, order = []; let n = 0; const add = (type,text,parent) => { const id = 'n'+(++n); nodes[id] = { id, type, text, parent, ghost:false }; order.push(id); return id; };
    const root = add('loop','Root',null);
    for(let a=0;a<6;a++){ const l = add('loop','Area '+a,root); for(let q=0;q<6;q++){ const qq = add('question','Question '+a+'-'+q,l); for(let k=0;k<3;k++) add('answer','Answer '+k,qq); } }
    S.nodes = nodes; S.order = order; S.links = []; S.seq = n; S.sel = null; layout(false); })()`);
  await sleep(1500);
  a.w.eval("S.view.x = 0; S.view.y = 0; S.view.z = .8; applyView()");
  const culled = () => a.nodes().filter(n=>n.classList.contains('culled')).length, total = a.nodes().length;
  assert.ok(total>100,'a big tree: '+total);
  assert.ok(culled()>0 && culled()<total,`some are hidden and some are not (${culled()} of ${total})`);
  assert.equal(a.byId(a.w.eval("S.order[1]")).classList.contains('culled'),false,'a block in view is shown');
  // the selected block is never hidden, even far off screen
  const far = a.w.eval("S.order[S.order.length-1]");
  a.w.eval(`select('${far}')`); a.w.eval('applyView()');
  assert.equal(a.byId(far).classList.contains('culled'),false);
  a.w.eval('select(null)'); a.w.eval('applyView()');
  // panning changes which blocks are hidden
  const before = culled(); a.w.eval('S.view.x -= 900; applyView()');
  assert.notEqual(culled(),before);
  // edges between two hidden blocks are hidden too
  assert.ok([...a.$$('#edges path')].some(p=>p.style.visibility==='hidden'));
  // a small tree is never culled
  a.w.eval(`(()=>{ const keep = new Set(S.order.slice(0,40)); S.order = S.order.slice(0,40); Object.keys(S.nodes).forEach(id=>{ if(!keep.has(id)) delete S.nodes[id]; }); layout(false); })()`);
  await sleep(300); a.w.eval('applyView()');
  assert.equal(culled(),0,'under the threshold nothing is hidden');
  assert.deepEqual(a.errs,[]);
});
