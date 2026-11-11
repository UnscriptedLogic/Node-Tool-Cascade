'use strict';
// The Cascade library: folders that hold Cascades (one saved tree each). The same rules run in the local Node server
// (files on disk) and in the Cloudflare Worker (D1), so both answer the page with identical JSON.
//
// A store is the only thing that differs. It implements, for one user (`uid`):
//   listFolders(uid) -> [{id,name,createdAt}]            createFolder(uid,folder)        updateFolder(uid,id,{name})
//   deleteFolder(uid,id) (also deletes the folder's cascades)
//   listCascades(uid) -> [{id,folderId,name,domain,createdAt,updatedAt}]      (no tree data)
//   getCascade(uid,id) -> {…meta,data} | null          putCascade(uid,record)         deleteCascade(uid,id)
// `deps` supplies { newId(), now() } so this file needs no platform APIs.

const LIMITS = { name:80, folders:100, cascades:500, dataBytes:1500000, prefText:1200 };
const DOMAINS = ['general','product','research','game'];
const PREF_TEXT = { goal:600, context:1200, pillars:1200, avoid:800 };

class LibraryError extends Error { constructor(status,message){ super(message); this.status = status; } }

const cleanName = (v,fallback) => {
  const s = typeof v==='string' ? v.replace(/\s+/g,' ').trim().slice(0,LIMITS.name) : '';
  if(!s && fallback===undefined) throw new LibraryError(400,'A name is required.');
  return s || fallback;
};

// What a saved Cascade holds: the tree (as the page stores it), the camera, and the settings that belong to this tree.
function cleanData(d){
  if(!d || typeof d!=='object') throw new LibraryError(400,'Missing data.');
  if(typeof d.tree!=='string') throw new LibraryError(400,'data.tree must be the saved tree as a string.');
  let t; try{ t = JSON.parse(d.tree); }catch(e){ throw new LibraryError(400,'data.tree is not valid JSON.'); }
  if(!t || typeof t.nodes!=='object' || !Array.isArray(t.order)) throw new LibraryError(400,'data.tree is not a Cascade tree.');
  const view = d.view && typeof d.view==='object' && [d.view.x,d.view.y,d.view.z].every(Number.isFinite) ? { x:d.view.x, y:d.view.y, z:d.view.z } : null;
  const prefs = {}, p = d.prefs && typeof d.prefs==='object' ? d.prefs : {};
  if(DOMAINS.includes(p.domain)) prefs.domain = p.domain;
  for(const [k,max] of Object.entries(PREF_TEXT)) if(typeof p[k]==='string') prefs[k] = p[k].slice(0,max);
  if(['light','balanced','strong'].includes(p.steer)) prefs.steer = p.steer;
  const out = { tree:d.tree, view, prefs };
  if(JSON.stringify(out).length>LIMITS.dataBytes) throw new LibraryError(413,'This Cascade is too large to save.');
  return out;
}

const meta = (r) => ({ id:r.id, folderId:r.folderId || null, name:r.name, domain:r.domain || 'general', createdAt:r.createdAt, updatedAt:r.updatedAt });

// Routes, relative to the API root. Returns { status, body }. `parts` is the path split on "/" without the leading "api".
async function handle({ method, parts, body, store, uid, deps }){
  const [res,id] = parts;
  const ok = (b,status = 200) => ({ status, body:b });
  const folderOrThrow = async (fid) => {
    if(fid===null || fid===undefined || fid==='') return null;
    const f = (await store.listFolders(uid)).find(x=>x.id===fid);
    if(!f) throw new LibraryError(404,'That folder does not exist.');
    return f.id;
  };

  if(res==='library' && method==='GET') return ok({ folders:await store.listFolders(uid), cascades:await store.listCascades(uid) });

  if(res==='folders'){
    if(!id && method==='POST'){
      if((await store.listFolders(uid)).length>=LIMITS.folders) throw new LibraryError(409,'Too many folders.');
      const f = { id:deps.newId(), name:cleanName(body && body.name), createdAt:deps.now() };
      await store.createFolder(uid,f); return ok(f,201);
    }
    if(id && method==='PATCH'){
      if(!(await store.listFolders(uid)).some(x=>x.id===id)) throw new LibraryError(404,'That folder does not exist.');
      const name = cleanName(body && body.name); await store.updateFolder(uid,id,{ name }); return ok({ id, name });
    }
    if(id && method==='DELETE'){
      if(!(await store.listFolders(uid)).some(x=>x.id===id)) throw new LibraryError(404,'That folder does not exist.');
      await store.deleteFolder(uid,id); return ok({ ok:true });
    }
  }

  if(res==='cascades'){
    if(!id && method==='POST'){
      const b = body || {};
      if((await store.listCascades(uid)).length>=LIMITS.cascades) throw new LibraryError(409,'Too many Cascades.');
      const data = cleanData(b.data), t = deps.now();
      const rec = { id:deps.newId(), folderId:await folderOrThrow(b.folderId), name:cleanName(b.name,'Untitled Cascade'), domain:data.prefs.domain || 'general', createdAt:t, updatedAt:t, data };
      await store.putCascade(uid,rec); return ok(meta(rec),201);
    }
    if(id && method==='GET'){
      const r = await store.getCascade(uid,id); if(!r) throw new LibraryError(404,'That Cascade does not exist.');
      return ok({ ...meta(r), data:r.data });
    }
    if(id && method==='PUT'){
      const cur = await store.getCascade(uid,id); if(!cur) throw new LibraryError(404,'That Cascade does not exist.');
      const b = body || {};
      const data = b.data!==undefined ? cleanData(b.data) : cur.data;
      const rec = { ...cur, data, domain:data.prefs.domain || cur.domain || 'general', updatedAt:deps.now() };
      if(b.name!==undefined) rec.name = cleanName(b.name);
      if(b.folderId!==undefined) rec.folderId = await folderOrThrow(b.folderId);
      await store.putCascade(uid,rec); return ok(meta(rec));
    }
    if(id && method==='DELETE'){
      if(!(await store.getCascade(uid,id))) throw new LibraryError(404,'That Cascade does not exist.');
      await store.deleteCascade(uid,id); return ok({ ok:true });
    }
  }
  return null;   // not a library route
}

module.exports = { handle, LibraryError, LIMITS, cleanData };
