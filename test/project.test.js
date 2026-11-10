'use strict';
// Project folders: the scanner, ignore rules, secret handling, digests, search and the HTTP routes around them.
// Fixtures are tiny game projects written to a temp folder, shaped like real Unity, Godot and Unreal ones.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawn } = require('node:child_process');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(),'cascade-proj-data-'));
process.env.CASCADE_DATA_DIR = DATA;           // must be set before the module is loaded
const project = require('../server/lib/project');
const { parseIgnore, ignored, detectEngine, digestFile, tokenize, redactFull } = project._internal;
const { pickFolder } = require('../server/lib/picker');
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));

const { write, makeUnity, FAKE_KEY } = require('./helpers/fixtures');
const rels = (info) => info.files.map(f=>f.path);
async function scanAndWait(root,opts){ const s = await project.scan(root,opts); return s; }

/* ------------------------------------ ignore rules ------------------------------------ */
test('gitignore rules: comments, negation, anchoring, directory-only, wildcards and nesting',()=>{
  const r = parseIgnore('# comment\n*.log\n!keep.log\nbuild/\n/rootonly.txt\ndocs/**/*.tmp\n**/cache\nsrc/*.gen\n','');
  const t = (p,d=false) => ignored(r,p,d);
  assert.equal(t('a/b/c.log'),true); assert.equal(t('keep.log'),false,'negation wins when it is last');
  assert.equal(t('build',true),true); assert.equal(t('build'),false,'a trailing slash means directories only');
  assert.equal(t('rootonly.txt'),true); assert.equal(t('sub/rootonly.txt'),false,'a leading slash anchors to the root');
  assert.equal(t('docs/a/b/x.tmp'),true); assert.equal(t('docs/x.tmp'),true); assert.equal(t('other/x.tmp'),false);
  assert.equal(t('deep/inside/cache',true),true); assert.equal(t('src/a.gen'),true); assert.equal(t('src/sub/a.gen'),false,'a slash inside the pattern anchors it');
  const nested = parseIgnore('*.tmp\n','pkg');
  assert.equal(ignored(nested,'pkg/a.tmp'),true); assert.equal(ignored(nested,'other/a.tmp'),false,'a nested .gitignore only applies inside its folder');
});
test('engine detection from the project root',()=>{
  assert.equal(detectEngine(['Assets','ProjectSettings','Packages']),'unity');
  assert.equal(detectEngine(['MyGame.uproject','Source','Content']),'unreal');
  assert.equal(detectEngine(['project.godot','scenes']),'godot');
  assert.equal(detectEngine(['game.yyp']),'gamemaker');
  assert.equal(detectEngine(['src','README.md']),'generic');
});

/* ------------------------------------- digests ------------------------------------- */
test('digests pull out symbols, tuning values, open questions and the header comment without reading it all',()=>{
  const text = fs.readFileSync(path.join(makeUnity(),'Assets/Scripts/Player/PlayerController.cs'),'utf8');
  const d = digestFile('Assets/Scripts/Player/PlayerController.cs',text,'.cs');
  assert.match(d.header,/walking, sprinting and jumping/);
  const names = d.symbols.map(s=>s.name); assert.ok(names.includes('PlayerController')); assert.ok(names.includes('Jump')); assert.ok(names.includes('Move'));
  const vals = Object.fromEntries(d.tunables.map(t=>[t.name,t.value]));
  assert.equal(vals.moveSpeed,'6.5'); assert.equal(vals.jumpForce,'12'); assert.equal(vals.stamina,'100'); assert.equal(vals.sprintMultiplier,'1.6');
  assert.equal(d.todos.length,1); assert.match(d.todos[0].text,/double jump/);
});
test('redaction covers keys, tokens, private keys and quoted passwords, and keeps the rest',()=>{
  const ant = ['sk','ant','abcdefghijklmnopqrstuvwxyz0123'].join('-'), gh = 'ghp'+'_'+'abcdefghijklmnopqrstuvwxyz0123456789';
  const r = redactFull(`const k = "${ant}"; token ${gh}; password = "hunter2hunter2"; speed = 5;`);
  assert.equal(r.count,3); assert.doesNotMatch(r.text,/sk-ant|ghp_|hunter2/); assert.match(r.text,/speed = 5/);
  assert.match(r.text,/password = "\[REDACTED\]"/);
});

/* ------------------------------------- scanning ------------------------------------- */
test('scan: reads the design intent and the code, skips everything that is noise or private',async()=>{
  const root = makeUnity();
  const s = await scanAndWait(root);
  assert.equal(s.engine,'unity'); assert.equal(s.engineLabel,'Unity');
  const info = project.publicInfo(); assert.equal(info.has,true);
  const idx = JSON.parse(fs.readFileSync(path.join(DATA,'project-index.json'),'utf8')), files = idx.files.map(f=>f.path);
  for(const keep of ['Assets/Scripts/Player/PlayerController.cs','Assets/Scripts/Enemies/EnemyAI.cs','Assets/Scripts/World/MapGenerator.cs','docs/DESIGN.md','keep.txt']) assert.ok(files.includes(keep),'kept '+keep);
  for(const drop of ['Assets/Plugins/Lib/ThirdParty.cs','Library/Cache/cached.cs','Assets/Art/hero.png','Assets/Scenes/Main.unity','Assets/Scripts/Tmp/Scratch.cs','Assets/Scripts/Generated/Auto.cs','Assets/Scripts/blob.cs','Assets/Scripts/min.js','.env','config/keys.pem','scratch.txt'])
    assert.ok(!files.includes(drop),'skipped '+drop);
  assert.ok(s.skipped.secret>=2 && s.skipped.generated>=2 && s.skipped.tooBig>=1 && s.skipped.binary>=1 && s.skipped.ignored>=3);
  assert.equal(s.redactions,3,'the key, the password and the key in a second form were redacted');
  assert.ok(!JSON.stringify(idx).includes('hunter2') && !JSON.stringify(idx).includes(FAKE_KEY),'secrets never reach the index');
  assert.ok(s.counts.files>=6 && s.counts.tokensEst>0 && s.topDirs.length>0 && s.byExt.some(e=>e.ext==='.cs'));
  assert.ok(s.engineIgnore.includes('Library/'));
});
test('scan: user ignore patterns and extra extensions apply',async()=>{
  const root = makeUnity(); write(root,'notes/ideas.txt','hello'); write(root,'tools/x.weird','custom data');
  const s = await scanAndWait(root,{ ignore:['docs/','notes/'], include:['weird'] });
  const files = JSON.parse(fs.readFileSync(path.join(DATA,'project-index.json'),'utf8')).files.map(f=>f.path);
  assert.ok(!files.includes('docs/DESIGN.md') && !files.includes('notes/ideas.txt')); assert.ok(files.includes('tools/x.weird'));
  assert.deepEqual(s.include,['.weird']);
});
test('scan: never follows a link out of the project and refuses a drive root or the whole home folder',async()=>{
  const root = makeUnity(), outside = fs.mkdtempSync(path.join(os.tmpdir(),'cascade-outside-')); write(outside,'private.cs','public class Private { }');
  fs.symlinkSync(outside,path.join(root,'Assets','Linked'),'dir'); fs.symlinkSync(path.join(outside,'private.cs'),path.join(root,'Assets','Scripts','link.cs'));
  await scanAndWait(root);
  const files = JSON.parse(fs.readFileSync(path.join(DATA,'project-index.json'),'utf8')).files.map(f=>f.path);
  assert.ok(!files.some(f=>/Linked|link\.cs|private/i.test(f)));
  await assert.rejects(project.scan('/'),/too broad/); await assert.rejects(project.scan(os.homedir()),/too broad/);
  await assert.rejects(project.scan('/definitely/not/here'),/doesn’t exist/); await assert.rejects(project.scan(path.join(root,'docs','DESIGN.md')),/isn’t a folder/);
});
test('scan: Godot and Unreal layouts skip their own generated folders',async()=>{
  const g = fs.mkdtempSync(path.join(os.tmpdir(),'cascade-godot-'));
  write(g,'project.godot','config_version=5'); write(g,'scripts/player.gd','extends CharacterBody2D\nclass_name Player\nvar speed = 220.0\nfunc jump():\n\tpass\n'); write(g,'addons/lib/x.gd','extends Node'); write(g,'.godot/cache.gd','x');
  let s = await scanAndWait(g); assert.equal(s.engine,'godot');
  let files = JSON.parse(fs.readFileSync(path.join(DATA,'project-index.json'),'utf8')).files.map(f=>f.path);
  assert.deepEqual(files.filter(f=>f.endsWith('.gd')),['scripts/player.gd']);
  const u = fs.mkdtempSync(path.join(os.tmpdir(),'cascade-unreal-'));
  write(u,'Game.uproject','{}'); write(u,'Source/Game/Hero.cpp','AHero::AHero() { MaxWalkSpeed = 450.f; }'); write(u,'Plugins/Gameplay/Source/Abilities.cpp','void UAbility::Cast() { }'); write(u,'Binaries/Win64/x.cpp','x'); write(u,'Saved/Logs/y.cpp','x');
  s = await scanAndWait(u); assert.equal(s.engine,'unreal');
  files = JSON.parse(fs.readFileSync(path.join(DATA,'project-index.json'),'utf8')).files.map(f=>f.path);
  assert.ok(files.includes('Source/Game/Hero.cpp') && files.includes('Plugins/Gameplay/Source/Abilities.cpp'),'project plugins are kept');
  assert.ok(!files.some(f=>/Binaries|Saved/.test(f)));
});
test('scan can be cancelled part-way',async()=>{
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'cascade-big-'));
  for(let i=0;i<1500;i++) write(root,`src/d${i%40}/f${i}.cs`,`public class C${i} { public float speed = ${i}; }`);
  const p = project.scan(root); await sleep(25); project.cancel();
  await assert.rejects(p,/cancelled/); assert.equal(project.getProgress().running,false);
});

/* --------------------------------------- search --------------------------------------- */
test('search ranks the right file for the question, cites lines, and keeps one file from crowding the rest',async()=>{
  await scanAndWait(makeUnity());
  const top = (q) => project.search(q,5)[0];
  assert.equal(top('how fast does the player move and jump').file,'Assets/Scripts/Player/PlayerController.cs');
  assert.equal(top('how big is the map and how far apart are landmarks').file,'Assets/Scripts/World/MapGenerator.cs');
  assert.equal(top('enemy wind up warning attack').file,'Assets/Scripts/Enemies/EnemyAI.cs');
  assert.equal(top('fast travel pillars exploration discovery').file,'docs/DESIGN.md','intent in the docs outranks code on a design question');
  const r = project.search('player speed',5); assert.ok(r[0].start>=1 && r[0].end>=r[0].start && r[0].text.includes('moveSpeed'));
  assert.deepEqual(project.search('zzzz qqqq',5),[]); assert.deepEqual(project.search('',5),[]);
  assert.deepEqual(tokenize('PlayerController.moveSpeed_max'),['player','controller','move','speed','max']);
  assert.deepEqual(tokenize('Players are jumping and dodged enemies'),['player','jump','dodg','enemy'],'plurals and endings are folded together');
  assert.equal(project.search('how do players jump',3)[0].file,'Assets/Scripts/Player/PlayerController.cs','a plural in the question still finds the code');
});

/* ----------------------------- groups, incremental rescans ----------------------------- */
test('groups hand the AI compact digests plus a little raw code, and a rescan marks only what changed',async()=>{
  const root = makeUnity(); await scanAndWait(root);
  let g = project.groups(); assert.ok(g.length>=2);
  const scripts = g.find(x=>x.label.startsWith('Assets/Scripts')); assert.ok(scripts);
  assert.match(scripts.digest,/FILE Assets\/Scripts\/Player\/PlayerController\.cs/); assert.match(scripts.digest,/moveSpeed=6\.5@5/); assert.match(scripts.digest,/open: \[9\] TODO: should there be a double jump/);
  assert.match(scripts.excerpts,/--- Assets\/Scripts\/Player\/PlayerController\.cs:1-/);
  assert.ok(g.every(x=>!x.changed),'nothing has changed on the first scan');
  write(root,'Assets/Scripts/Player/PlayerController.cs',fs.readFileSync(path.join(root,'Assets/Scripts/Player/PlayerController.cs'),'utf8').replace('6.5f','9f'));
  write(root,'Assets/Scripts/Inventory/Bag.cs','public class Bag { public int capacity = 24; }'); fs.rmSync(path.join(root,'Assets/Scripts/World/MapGenerator.cs'));
  const s = await scanAndWait(root);
  assert.deepEqual(s.diff.changed,['Assets/Scripts/Player/PlayerController.cs']); assert.deepEqual(s.diff.added,['Assets/Scripts/Inventory/Bag.cs']); assert.deepEqual(s.diff.removed,['Assets/Scripts/World/MapGenerator.cs']);
  g = project.groups({ }); const changedLabels = g.filter(x=>x.changed).map(x=>x.label); assert.ok(changedLabels.length>=1);
  assert.ok(g.filter(x=>x.changed).every(x=>x.files.some(f=>s.diff.changed.includes(f) || s.diff.added.includes(f))));
  const again = await scanAndWait(root); assert.deepEqual(again.diff,{ added:[], changed:[], removed:[] });
});

/* ------------------------------------ reading files back ------------------------------------ */
test('reading back is limited to scanned files, stays inside the project, and is redacted again',async()=>{
  const root = makeUnity(); await scanAndWait(root);
  const ok = await project.readLines('Assets/Scripts/Player/PlayerController.cs',5,8);
  assert.equal(ok.start,5); assert.match(ok.text,/moveSpeed = 6\.5f/); assert.equal(ok.text.split('\n').length,4);
  const net = await project.readLines('Assets/Scripts/Net/Online.cs',1,1); assert.match(net.text,/REDACTED/); assert.doesNotMatch(net.text,/hunter2/);
  await assert.rejects(project.readLines('../../../etc/passwd',1,5),/isn’t part of the scanned project/);
  await assert.rejects(project.readLines('.env',1,5),/isn’t part of the scanned project/,'a skipped secret file cannot be read back');
  await assert.rejects(project.readLines('Assets/Scripts/Tmp/Scratch.cs',1,5),/isn’t part of/);
  fs.rmSync(path.join(root,'Assets/Scripts/Enemies/EnemyAI.cs')); await assert.rejects(project.readLines('Assets/Scripts/Enemies/EnemyAI.cs',1,5),/gone/);
  const huge = await project.readLines('docs/DESIGN.md',1,99999); assert.ok(huge.end<=huge.total);
});

/* ------------------------------------- brief + findings ------------------------------------- */
test('the brief and findings are kept, trimmed and survive a rescan; forgetting removes everything',async()=>{
  const root = makeUnity(); await scanAndWait(root);
  const info = project.saveBrief({ brief:'A slow exploration game.', briefMeta:{ model:'m', groups:3 }, findings:[
    { id:'f1', kind:'parameter', text:'Walk speed is 6.5', refs:[{ file:'Assets/Scripts/Player/PlayerController.cs', line:5 }], group:'Assets/Scripts' },
    { id:'f2', kind:'nonsense', text:'  ', refs:[] }, { id:'f3', kind:'open', text:'Double jump undecided', refs:[{ file:'x', line:-3 }] } ],
    groupFindings:{ g1:'abc' } });
  assert.equal(info.brief,'A slow exploration game.'); assert.equal(info.findingCount,2,'empty findings are dropped');
  const f = project.findings(); assert.equal(f.findings[1].refs[0].line,1); assert.equal(f.findings[0].kind,'parameter'); assert.equal(f.groupFindings.g1,'abc');
  await scanAndWait(root); assert.equal(project.publicInfo().brief,'A slow exploration game.','a rescan of the same folder keeps the brief');
  project.forget(); assert.equal(project.publicInfo().has,false); assert.equal(project.hasProject(),false);
  assert.ok(!fs.existsSync(path.join(DATA,'project.json')) && !fs.existsSync(path.join(DATA,'project-index.json')));
});

/* ------------------------------------ native folder dialog ------------------------------------ */
test('folder picker: returns the chosen path, treats closing the dialog as no choice, and explains a missing dialog',async()=>{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'cascade-pick-')), chosen = path.join(dir,'MyGame'); fs.mkdirSync(chosen);
  const ok = path.join(dir,'pick-ok.sh'), no = path.join(dir,'pick-cancel.sh');
  fs.writeFileSync(ok,`#!/bin/sh\necho "${chosen}"\n`,{ mode:0o755 }); fs.writeFileSync(no,'#!/bin/sh\nexit 1\n',{ mode:0o755 });
  process.env.CASCADE_PICKER_CMD = ok; assert.deepEqual(await pickFolder(),{ path:chosen });
  process.env.CASCADE_PICKER_CMD = no; assert.deepEqual(await pickFolder(),{ path:'' });
  process.env.CASCADE_PICKER_CMD = path.join(dir,'nope'); await assert.rejects(pickFolder(),/No folder dialog is available/);
  delete process.env.CASCADE_PICKER_CMD;
});

/* --------------------------------------- HTTP routes --------------------------------------- */
async function boot(t){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'cascade-proj-srv-'));
  const p = spawn(process.execPath,[path.join(__dirname,'..','server','server.js')],{ env:{ ...process.env, NO_OPEN:'1', CASCADE_DATA_DIR:dir } });
  p.out = ''; p.exited = false; p.on('exit',()=>{ p.exited = true; }); p.stdout.on('data',d=>p.out += d); p.stderr.on('data',d=>p.out += d);
  for(let i=0;i<100 && !/running at http:\/\/localhost:\d+/.test(p.out);i++) await sleep(50);
  const port = +p.out.match(/running at http:\/\/localhost:(\d+)/)[1], base = `http://localhost:${port}`;
  t.after(async()=>{ if(!p.exited){ p.kill('SIGINT'); for(let i=0;i<60 && !p.exited;i++) await sleep(50); } fs.rmSync(dir,{ recursive:true, force:true }); });
  const post = (u,b,h={}) => fetch(base+u,{ method:'POST', headers:{ 'content-type':'application/json',...h }, body:JSON.stringify(b||{}) });
  return { base, post, get:(u)=>fetch(base+u), dir };
}
test('routes: scan in the background, poll for progress, search, read lines, save a brief, forget',async(t)=>{
  const s = await boot(t), root = makeUnity();
  assert.deepEqual(await (await s.get('/api/project')).json(),{ has:false, scanning:{ running:false, files:0, dirs:0 } });
  const bad = await s.post('/api/project/scan',{ path:'/no/such/place' }); assert.equal(bad.status,400); assert.match((await bad.json()).detail,/doesn’t exist/);
  assert.equal((await s.post('/api/project/scan',{ path:'/' })).status,400);
  assert.deepEqual(await (await s.post('/api/project/scan',{ path:root, ignore:'docs/', include:'' })).json(),{ started:true });
  let st; for(let i=0;i<80;i++){ st = await (await s.get('/api/project/status')).json(); if(!st.running) break; await sleep(50); }
  assert.equal(st.running,false); assert.equal(st.error,''); assert.equal(st.info.engine,'unity'); assert.ok(st.info.counts.files>=5);
  const found = (await (await s.post('/api/project/search',{ q:'player jump speed', k:3 })).json()).results; assert.equal(found[0].file,'Assets/Scripts/Player/PlayerController.cs');
  const file = await (await s.get('/api/project/file?path='+encodeURIComponent('Assets/Scripts/Player/PlayerController.cs')+'&start=5&end=6')).json(); assert.match(file.text,/moveSpeed/);
  assert.equal((await s.get('/api/project/file?path='+encodeURIComponent('../../etc/passwd'))).status,404);
  assert.equal((await s.get('/api/project/file?path=.env')).status,404);
  const groups = (await (await s.get('/api/project/groups')).json()).groups; assert.ok(groups.length>=1 && groups[0].digest.includes('FILE '));
  const saved = await (await s.post('/api/project/brief',{ brief:'Brief text', findings:[{ id:'a', kind:'decision', text:'Slow travel', refs:[{ file:'docs/DESIGN.md', line:2 }] }] })).json(); assert.equal(saved.brief,'Brief text');
  const settings = await (await s.get('/api/settings')).json(); assert.equal(settings.project.brief,'Brief text','the brief rides along with the settings the page loads');
  assert.equal(settings.prefs.useProject,true); assert.equal(settings.prefs.askFiles,true);
  const html = await (await fetch(s.base+'/')).text(); assert.match(html,/Brief text/);
  const forgot = await (await s.post('/api/project/forget',{})).json(); assert.equal(forgot.project.has,false);
  assert.deepEqual((await (await s.post('/api/project/search',{ q:'player' })).json()).results,[]);
});
test('routes: only the page served by Cascade can use them',async(t)=>{
  const s = await boot(t);
  assert.equal((await s.post('/api/project/scan',{ path:os.tmpdir() },{ origin:'https://evil.example' })).status,403);
  assert.equal((await s.post('/api/project/pick',{},{ origin:'http://localhost:9' })).status,403);
  assert.equal((await fetch(s.base+'/api/project/file?path=x',{ headers:{ origin:'https://evil.example' } })).status,403);
});
test('routes: the picker reports a closed dialog and a missing one',async(t)=>{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'cascade-pickroute-')), chosen = path.join(dir,'G'); fs.mkdirSync(chosen); const ok = path.join(dir,'ok.sh'); fs.writeFileSync(ok,`#!/bin/sh\necho "${chosen}"\n`,{ mode:0o755 });
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(),'cascade-proj-srv-')), srv = spawn(process.execPath,[path.join(__dirname,'..','server','server.js')],{ env:{ ...process.env, NO_OPEN:'1', CASCADE_DATA_DIR:dir2, CASCADE_PICKER_CMD:ok } });
  let out = ''; srv.stdout.on('data',d=>out += d); t.after(()=>{ srv.kill('SIGINT'); fs.rmSync(dir2,{ recursive:true,force:true }); });
  for(let i=0;i<100 && !/running at/.test(out);i++) await sleep(50);
  const base = `http://localhost:${+out.match(/localhost:(\d+)/)[1]}`;
  assert.deepEqual(await (await fetch(base+'/api/project/pick',{ method:'POST', headers:{ 'content-type':'application/json' }, body:'{}' })).json(),{ path:chosen });
});
