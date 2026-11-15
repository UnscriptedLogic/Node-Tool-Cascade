'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {open,webHtml,sleep} = require('./helpers/dom');
async function start(t){
  const a = open({html:webHtml()}); t.after(()=>a.dom.window.close()); await sleep(100);
  a.click(a.$('#setBtn')); a.click(a.$('#chatPrepare'));
  return a;
}
function reply(a,nodes){ a.type(a.$('#chatReply'),JSON.stringify({nodes})); a.click(a.$('#chatReview')); }
const row = {type:'question',text:'Which assumption fails under load?',parent:'n6'};
test('manual exchange previews without mutation, imports ghost nodes, and undoes import',async t=>{
  const a = await start(t), before = a.nodes().length;
  assert.match(a.$('#chatPrompt').value,/TREE \(JSON\)/);
  assert.equal(a.$('#appVersion').textContent,'v'+require('../package.json').version);
  reply(a,[row]); assert.equal(a.$('#chatPreview').hidden,false); assert.equal(a.nodes().length,before);
  a.click(a.$('#chatImport')); assert.equal(a.nodes().length,before+1);
  assert.ok(a.byText(row.text).classList.contains('ghost'));
  a.click(a.$('#undoBtn')); assert.equal(a.nodes().length,before); assert.deepEqual(a.errs,[]);
});
test('manual exchange rejects malformed, unknown parent, oversized, and duplicate responses',async t=>{
  const a = await start(t), before = a.nodes().length;
  for(const nodes of [[{...row,parent:'unknown'}],[{...row,type:'script'}],[{...row,text:'x'.repeat(141)}],[row,row],Array(13).fill(row)]){
    reply(a,nodes); assert.equal(a.$('#chatPreview').hidden,true); assert.equal(a.nodes().length,before);
  }
  a.type(a.$('#chatReply'),'not JSON'); a.click(a.$('#chatReview')); assert.equal(a.$('#chatPreview').hidden,true);
  assert.deepEqual(a.errs,[]);
});
test('manual exchange accepts fenced JSON, renders text safely, and invalidates edited replies',async t=>{
  const a = await start(t), text = '<img src=x onerror=alert(1)>';
  a.type(a.$('#chatReply'),'```json\n'+JSON.stringify({nodes:[{...row,text}]})+'\n```');
  a.click(a.$('#chatReview')); assert.equal(a.$('#chatPreview').hidden,false);
  assert.equal(a.$('#chatSuggestions img'),null); assert.ok(a.$('#chatSuggestions').textContent.includes(text));
  a.type(a.$('#chatReply'),'{}'); assert.equal(a.$('#chatPreview').hidden,true); assert.deepEqual(a.errs,[]);
});
test('manual exchange focuses selected branch and rejects import after tree reset',async t=>{
  const a = await start(t);
  a.w.eval("S.sel = 'n6'"); a.click(a.$('#chatPrepare'));
  assert.match(a.$('#chatPrompt').value,/FOCUS: n6/);
  const tree = JSON.parse(a.$('#chatPrompt').value.split('TREE (JSON): ')[1].split('\n\n')[0]);
  assert.equal(tree[0].id,'n6'); assert.ok(tree.length<a.nodes().length);
  reply(a,[row]); a.w.eval('resetTree()'); a.click(a.$('#chatImport'));
  assert.equal(a.byText(row.text),undefined); assert.match(a.$('#chatStatus').textContent,/fresh prompt/);
  assert.deepEqual(a.errs,[]);
});
