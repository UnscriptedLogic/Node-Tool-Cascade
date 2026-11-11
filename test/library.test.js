'use strict';
// Folders and Cascades: the shared rules (in memory) and the local server's routes (files on disk).
const test = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
const library = require('../shared/library');
const { bootServer } = require('./helpers/server');

const tree = (n = 1) => JSON.stringify({ nodes:{ n1:{ id:'n1', type:'loop', text:'Root'+n, parent:null } }, order:['n1'], links:[], seq:1 });
const data = (extra = {}) => ({ tree:tree(), view:{ x:1, y:2, z:1 }, prefs:{ domain:'research', goal:'Find the weak spot', secret:'ignored' }, ...extra });

// the simplest possible store, to test the rules without a disk or a database
function memoryStore(){
  const folders = [], cascades = new Map();
  return {
    folders, cascades,
    async listFolders(){ return folders.map(f=>({ ...f })); },
    async createFolder(u,f){ folders.push(f); },
    async updateFolder(u,id,p){ Object.assign(folders.find(f=>f.id===id),p); },
    async deleteFolder(u,id){ folders.splice(folders.findIndex(f=>f.id===id),1); for(const [k,c] of cascades) if(c.folderId===id) cascades.delete(k); },
    async listCascades(){ return [...cascades.values()].map(({ data:_d, ...m })=>m); },
    async getCascade(u,id){ return cascades.get(id) || null; },
    async putCascade(u,r){ cascades.set(r.id,r); },
    async deleteCascade(u,id){ cascades.delete(id); }
  };
}
let tick = 1000;
const deps = { newId:() => crypto.randomUUID(), now:() => ++tick };
const call = (store,method,path,body) => library.handle({ method, parts:path.split('/').filter(Boolean), body, store, uid:'u1', deps });

test('library: create a folder and a Cascade in it, list them, open, rename and move the Cascade',async()=>{
  const s = memoryStore();
  const f = (await call(s,'POST','folders',{ name:'  Launch   plan ' })).body;
  assert.equal(f.name,'Launch plan');
  const c = (await call(s,'POST','cascades',{ name:'Pricing', folderId:f.id, data:data() })).body;
  assert.equal(c.folderId,f.id); assert.equal(c.domain,'research');
  const lib = (await call(s,'GET','library')).body;
  assert.equal(lib.folders.length,1); assert.equal(lib.cascades.length,1); assert.ok(!('data' in lib.cascades[0]),'the list never carries tree data');
  const open = (await call(s,'GET','cascades/'+c.id)).body;
  assert.deepEqual(open.data.prefs,{ domain:'research', goal:'Find the weak spot' },'only known preferences are kept');
  assert.deepEqual(open.data.view,{ x:1, y:2, z:1 });
  await call(s,'PUT','cascades/'+c.id,{ name:'Pricing v2', folderId:null });
  const moved = (await call(s,'GET','cascades/'+c.id)).body;
  assert.equal(moved.name,'Pricing v2'); assert.equal(moved.folderId,null); assert.ok(moved.updatedAt>c.updatedAt);
});

test('library: saving new data replaces the tree and keeps the name',async()=>{
  const s = memoryStore();
  const c = (await call(s,'POST','cascades',{ name:'A', data:data() })).body;
  await call(s,'PUT','cascades/'+c.id,{ data:data({ tree:tree(2) }) });
  const back = (await call(s,'GET','cascades/'+c.id)).body;
  assert.match(back.data.tree,/Root2/); assert.equal(back.name,'A');
});

test('library: deleting a folder deletes the Cascades inside it, and nothing else',async()=>{
  const s = memoryStore();
  const f = (await call(s,'POST','folders',{ name:'F' })).body;
  const inside = (await call(s,'POST','cascades',{ folderId:f.id, data:data() })).body;
  const outside = (await call(s,'POST','cascades',{ name:'Loose', data:data() })).body;
  assert.equal(inside.name,'Untitled Cascade');
  await call(s,'DELETE','folders/'+f.id);
  const lib = (await call(s,'GET','library')).body;
  assert.deepEqual(lib.cascades.map(c=>c.id),[outside.id]); assert.equal(lib.folders.length,0);
  await call(s,'DELETE','cascades/'+outside.id);
  assert.equal((await call(s,'GET','library')).body.cascades.length,0);
});

test('library: bad input is refused with a clear status',async()=>{
  const s = memoryStore();
  const fails = async (p,status) => { try{ await p; assert.fail('should have been refused'); }catch(e){ assert.ok(e instanceof library.LibraryError,String(e)); assert.equal(e.status,status); } };
  await fails(call(s,'POST','folders',{ name:'   ' }),400);
  await fails(call(s,'POST','cascades',{ name:'x', data:{ tree:'not json' } }),400);
  await fails(call(s,'POST','cascades',{ name:'x', data:{ tree:'{"a":1}' } }),400);
  await fails(call(s,'POST','cascades',{ name:'x', folderId:'nope', data:data() }),404);
  await fails(call(s,'GET','cascades/nope'),404);
  await fails(call(s,'PATCH','folders/nope',{ name:'x' }),404);
  const big = JSON.stringify({ nodes:{}, order:[], pad:'x'.repeat(library.LIMITS.dataBytes) });
  await fails(call(s,'POST','cascades',{ name:'x', data:{ tree:big } }),413);
  assert.equal(await call(s,'GET','nothing'),null);
});

test('library: the local server stores folders and Cascades on disk and serves them under /api',async(t)=>{
  const s = await bootServer(t,{ env:{} });
  const api = async (method,path,body) => { const r = await fetch(s.base+'/api/'+path,{ method, headers:{ 'content-type':'application/json' }, body:body ? JSON.stringify(body) : undefined }); return { status:r.status, body:await r.json() }; };
  const f = await api('POST','folders',{ name:'Ideas' }); assert.equal(f.status,201);
  const c = await api('POST','cascades',{ name:'First', folderId:f.body.id, data:data() }); assert.equal(c.status,201);
  assert.equal((await api('GET','library')).body.cascades[0].name,'First');
  const open = await api('GET','cascades/'+c.body.id); assert.equal(open.body.data.view.z,1);
  assert.equal((await api('PUT','cascades/'+c.body.id,{ name:'Renamed' })).body.name,'Renamed');
  assert.equal((await api('GET','cascades/missing')).status,404);
  assert.equal((await api('POST','folders',{ name:'' })).status,400);
  assert.equal((await api('DELETE','folders/'+f.body.id)).status,200);
  assert.equal((await api('GET','library')).body.cascades.length,0);
});
