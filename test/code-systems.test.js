'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const systems=require('../app/js/core/code-systems');
const {impact}=require('../server/lib/codegraph');
const file=(path,assembly)=>({id:'file:'+path,name:path,kind:'file',file:path,line:1,assembly});
const graph={nodes:[file('Assets/Scripts/Combat/Weapon.cs'),file('Assets/Scripts/Movement/Player.cs'),file('Assets/Scripts/UI/HUD.cs'),file('Assets/Scripts/Saving/Save.cs'),file('Assets/Gameplay/Damage.cs','Game.Combat')],edges:[]};
test('project groups use folders/custom assemblies and retain canonical script identity',()=>{
  const o=systems.build(graph,{},'My Game');assert.equal(o.project.name,'My Game');assert.equal(o.project.memberIds.length,5);
  assert.deepEqual(o.systems.map(g=>g.name).sort(),['Combat','Game.Combat','Movement','Saving','UI']);
  assert.ok(o.systems.every(g=>g.parent===systems.PROJECT));assert.ok(o.systems.every(g=>g.memberIds.every(id=>graph.nodes.some(n=>n.id===id))));
});
test('renames, custom systems and shared memberships survive rescans without duplicating source nodes',()=>{
  const o=systems.build(graph),combat=o.systems.find(g=>g.name==='Combat').id,ui=o.systems.find(g=>g.name==='UI').id;
  const manual='overview:system:manual:test',config={names:{[combat]:'Battle',[manual]:'Networking'},custom:[{id:manual,name:'Network'}],memberships:{'Assets/Scripts/Combat/Weapon.cs':[combat,ui]}};
  const result=systems.build(graph,config);assert.equal(result.systems.find(g=>g.id===combat).name,'Battle');assert.equal(result.systems.find(g=>g.id===manual).name,'Networking');
  assert.equal(result.memberships.get(graph.nodes[0].id).length,2);assert.equal(result.files.length,5);
  const rescanned=systems.build({nodes:graph.nodes.concat(file('Assets/Scripts/Combat/Enemy.cs')),edges:[]},config);assert.equal(rescanned.systems.find(g=>g.id===combat).memberIds.length,2);
  assert.equal(rescanned.memberships.get(graph.nodes[0].id).length,2);
});
test('unassigned and removed scripts do not create missing graph identities; AI proposals reject invented paths',()=>{
  const result=systems.build(graph,{memberships:{[graph.nodes[0].file]:[],gone:['unknown']}});assert.equal(result.systems.find(g=>g.name==='Unassigned').files[0].id,graph.nodes[0].id);
  const proposed=systems.proposal({systems:[{name:'Combat',files:[graph.nodes[0].file,'not-real.cs',graph.nodes[0].file]},{name:'',files:[graph.nodes[1].file]}]},graph.nodes);
  assert.deepEqual(proposed,[{name:'Combat',files:[graph.nodes[0].file]}]);
});
test('system impact seeds multiple scripts and excludes members while tracing external consumers',()=>{
  const graph={nodes:[{id:'weapon'},{id:'damage'},{id:'hud'},{id:'save'}],edges:[{id:'1',a:'hud',b:'damage'},{id:'2',a:'save',b:'hud'}]};
  const found=impact(graph,['weapon','damage'],2);assert.deepEqual(found.map(n=>n.id),['hud','save']);assert.equal(found[1].depth,2);
});
