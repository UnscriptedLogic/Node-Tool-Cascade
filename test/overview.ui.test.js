'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const mocks=require('./helpers/mocks'),{bootServer,page}=require('./helpers/server'),{sleep}=require('./helpers/dom'),{write}=require('./helpers/fixtures');
let mock;test.before(async()=>{mock=await mocks.start();});test.after(()=>mock.close());
async function until(fn){for(let i=0;i<200;i++){if(fn())return;await sleep(30);}assert.fail('Timed out waiting for overview');}
function tap(a,node){for(const type of ['pointerdown','pointerup'])node.dispatchEvent(new a.w.MouseEvent(type,{bubbles:true,clientX:150,clientY:180}));}

test('radial project overview supports branches, shared scripts, manual corrections, reviewed AI groups and persistence',async t=>{
  const s=await bootServer(t,mock),folder=fs.mkdtempSync(path.join(os.tmpdir(),'cascade-overview-'));
  t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));
  const weapon='src/combat/weapon.ts',player='src/movement/player.ts';
  write(folder,weapon,'import {move} from "../movement/player"; export function attack(){move();}');
  write(folder,player,'export function move(){return 1;}');
  write(folder,'src/ui/hud.ts','import {attack} from "../combat/weapon"; export function update(){attack();}');
  write(folder,'src/saving/save.ts','export function save(){return true;}');
  await fetch(s.base+'/api/settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({active:'openai',providers:{openai:{key:'oa-key-9999',model:'gpt-x-mini'}}})});
  await fetch(s.base+'/api/project/scan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path:folder})});
  for(let i=0;i<100;i++){if(!(await (await fetch(s.base+'/api/project/status')).json()).running)break;await sleep(50);}
  const original=await (await fetch(s.base+'/api/project/code')).json();
  const a=await page(s,{local:{'cascade-seen-settings':'1'}});t.after(()=>a.w.close());await sleep(300);
  const defaultState=a.w.eval('JSON.stringify({tree:snap(),view:S.view,history:hist})');
  a.click(a.$('#viewClass'));await until(()=>a.$$('#codeList .code-node').length===4);
  assert.equal(a.w.eval('canvasState().layout'),'radial');
  const centers=JSON.parse(a.w.eval('JSON.stringify(Object.values(canvasState().nodes).map(n=>({kind:n.codeKind,x:R[n.id].tgt.x+R[n.id].w/2,y:R[n.id].tgt.y+R[n.id].h/2})))'));
  const center=centers.find(n=>n.kind==='project');assert.equal(center.x,0);assert.equal(center.y,0);
  const systems=centers.filter(n=>n.kind==='system');assert.equal(systems.length,4);
  assert.ok(systems.some(n=>n.x>100)&&systems.some(n=>n.x< -100)&&systems.some(n=>n.y>100)&&systems.some(n=>n.y< -100),'systems branch in every direction');
  assert.equal(a.w.eval('canvasState().links.length'),0,'overview starts without dependency clutter');
  a.click(a.$$('#codeList .code-node').find(n=>n.textContent.startsWith('Combat')));await until(()=>!a.$('#codePrepare').disabled);
  assert.ok(a.$$('#world .node .txt').some(n=>n.textContent==='weapon.ts'));
  assert.ok(a.w.eval('canvasState().links.length')>0,'selected system reveals dependency links');
  const script=a.$$('#world .node').find(n=>n.querySelector('.txt').textContent==='weapon.ts');tap(a,script);
  await until(()=>!a.$('#codeMemberships').hidden);
  assert.ok(a.$$('#world .node .txt').some(n=>n.textContent==='attack'),'script expands into code declarations');
  a.type(a.$('#codeNewSystem'),'Shared gameplay');a.click(a.$('#codeAddSystem'));
  a.type(a.$('#codeMode'),'file');a.click(a.$$('#codeList .code-node').find(n=>n.textContent.includes(weapon)));
  const shared=a.$$('#codeMembershipList label').find(n=>n.textContent==='Shared gameplay').querySelector('input');shared.checked=true;shared.dispatchEvent(new a.w.Event('change',{bubbles:true}));
  a.type(a.$('#codeMode'),'system');a.click(a.$$('#codeList .code-node').find(n=>n.textContent.startsWith('Shared gameplay')));
  const representations=JSON.parse(a.w.eval('JSON.stringify(Object.values(canvasState().nodes).filter(n=>n.codeId==='+JSON.stringify('file:'+weapon)+').map(n=>({id:n.id,caption:n.codeCaption})))'));
  assert.equal(representations.length,2);assert.ok(representations.every(n=>n.caption.includes('Shared across 2 systems')));
  a.click(a.$$('#codeList .code-node').find(n=>n.textContent.startsWith('Combat')));a.type(a.$('#codeSystemName'),'Battle');a.click(a.$('#codeRenameSystem'));
  assert.ok(a.$('#codeList').textContent.includes('Battle'));
  const configKey=Object.keys(a.w.localStorage).find(k=>k.startsWith('cascade-code-systems-v1:')),before=a.w.localStorage.getItem(configKey);
  mock.state.script=prompt=>prompt.startsWith('Suggest project systems')?JSON.stringify({systems:[{name:'Battle',files:[weapon,player]},{name:'Shared gameplay',files:[weapon,'not-in-project.ts']}]}):null;
  await until(()=>!a.$('#codeSuggestSystems').disabled);a.click(a.$('#codeSuggestSystems'));await until(()=>!a.$('#codeApplySystems').hidden);
  assert.equal(a.w.localStorage.getItem(configKey),before,'AI suggestion is previewed before applying');assert.ok(!a.$('#codeSystemProposal').textContent.includes('not-in-project'));
  a.click(a.$('#codeApplySystems'));await until(()=>a.w.localStorage.getItem(configKey)!==before);
  const after=await (await fetch(s.base+'/api/project/code')).json();assert.equal(after.snapshot,original.snapshot);assert.equal(after.nodes.length,original.nodes.length,'organization never creates duplicate source identities');
  a.click(a.$('#viewDefault'));assert.equal(a.w.eval('JSON.stringify({tree:snap(),view:S.view,history:hist})'),defaultState);
  const local=Object.fromEntries(Object.keys(a.w.localStorage).map(k=>[k,a.w.localStorage.getItem(k)]));
  const b=await page(s,{local});t.after(()=>b.w.close());await sleep(250);b.click(b.$('#viewClass'));await until(()=>b.$('#codeList').textContent.includes('Battle'));
  assert.ok(b.$('#codeList').textContent.includes('Shared gameplay'));
  b.type(b.$('#codeMode'),'file');b.click(b.$$('#codeList .code-node').find(n=>n.textContent.includes(weapon)));
  assert.equal(b.$$('#codeMembershipList input:checked').length,2,'shared memberships survive reload');
  b.click(b.$('#codeDetails'));assert.notEqual(b.w.eval('canvasState().layout'),'radial');b.click(b.$('#codeOverview'));assert.equal(b.w.eval('canvasState().layout'),'radial');
  assert.deepEqual(a.errs,[]);assert.deepEqual(b.errs,[]);
});
