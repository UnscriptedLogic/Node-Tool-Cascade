'use strict';
/* ================= library: several Cascades, in folders ================= */
// Works against the same /api/library routes whether they are served by the local app (files on this computer)
// or by the Cloudflare backend (D1, behind Google sign-in). The Cascade you have open saves into the library as you work.
const LIB = { kind:null, user:null, folders:[], cascades:[], currentId:null, googleClientId:'', status:'', editing:null, armed:null, suspend:false, timer:0, gsi:false };
const LIB_CURRENT = 'cascade-current-v1';

async function libApi(method,path,body){
  const r = await fetch('/api/'+path,{ method, credentials:'same-origin', headers:body ? { 'content-type':'application/json' } : {}, body:body ? JSON.stringify(body) : undefined });
  let j = null; try{ j = await r.json(); }catch(e){}
  if(!r.ok){ const err = new Error((j && (j.detail || j.error)) || ('HTTP '+r.status)); err.status = r.status; throw err; }
  return j;
}
const libSignedIn = () => LIB.kind==='local' || !!LIB.user;
const libCurrent = () => LIB.cascades.find(c=>c.id===LIB.currentId) || null;
function libRemember(id){ LIB.currentId = id; libTitle(); try{ if(id) localStorage.setItem(LIB_CURRENT,JSON.stringify({ kind:LIB.kind, id })); else localStorage.removeItem(LIB_CURRENT); }catch(e){} }
// "Folder / Name" of the open Cascade, shown under the logo so it is always clear what you are working on
function libTitle(){
  const el = $('#openName'); if(!el) return;
  if(!LIB.kind || !libSignedIn()){ el.hidden = true; return; }
  const c = libCurrent(), f = c && c.folderId ? LIB.folders.find(x=>x.id===c.folderId) : null;
  el.hidden = false; el.classList.toggle('unsaved',!c);
  el.querySelector('.cf').textContent = f ? f.name+' / ' : '';
  el.querySelector('.cn').textContent = c ? c.name : 'Not in your library yet';
  el.title = c ? (f ? f.name+' / ' : '')+c.name+'. Open the library.' : 'This tree is not saved in your library. Open the library to save it.';
}
function libSetStatus(t){ LIB.status = t; const el = $('#libStatus'); if(el) el.textContent = t; }

// what a saved Cascade holds
function libData(){
  const prefs = {}; for(const k of ['domain','goal','context','pillars','avoid','steer']) prefs[k] = PREFS[k];
  return { tree:snap(), view:{ x:S.view.x, y:S.view.y, z:S.view.z }, prefs };
}
// called by save(): keep the open Cascade up to date, a moment after the last change
function libAfterSave(){
  if(!LIB.kind || !LIB.currentId || LIB.suspend || !libSignedIn()) return;
  clearTimeout(LIB.timer);
  LIB.timer = setTimeout(async()=>{
    const id = LIB.currentId; if(!id) return;
    try{ const m = await libApi('PUT','cascades/'+id,{ data:libData() }); const c = LIB.cascades.find(x=>x.id===id); if(c) Object.assign(c,m); libSetStatus('Saved to your library.'); }
    catch(e){ libSetStatus('Could not save to the library: '+e.message); }
  },1200);
}

async function libRefresh(){
  if(LIB.kind==='cloud'){
    try{ LIB.user = (await libApi('GET','auth/me')).user; }catch(e){ LIB.user = null; }
    if(!LIB.user){ LIB.folders = []; LIB.cascades = []; await cloudAiRefresh(); libRender(); return; }
  }
  await cloudAiRefresh();
  try{ const l = await libApi('GET','library'); LIB.folders = l.folders; LIB.cascades = l.cascades; }
  catch(e){ libSetStatus('Could not load the library: '+e.message); }
  if(!libCurrent()) libRemember(null);
  libRender();
}

/* ---- opening, creating, moving, deleting ---- */
function libApply(data){
  LIB.suspend = true; cancelAI();
  try{
    const t = JSON.parse(data.tree);
    S.nodes = t.nodes; S.order = t.order; S.links = t.links || []; S.seq = t.seq || S.order.length; S.sel = null; S.mode = 'detail'; hist.length = 0;
    Object.assign(PREFS,{ goal:'', context:'', pillars:'', avoid:'' },data.prefs || {}); savePrefs();
    syncers.forEach(f=>f()); updatePreview(); updateGoalChip();
    layout(false);
    if(data.view){ vAnim = null; Object.assign(S.view,data.view); applyView(); } else initialView();
    save(); updateHud();
  }finally{ LIB.suspend = false; }
}
async function libOpen(id){
  clearTimeout(LIB.timer);
  try{ const c = await libApi('GET','cascades/'+id); libApply(c.data); libRemember(id); closeSettings(); }
  catch(e){ libSetStatus('Could not open that Cascade: '+e.message); }
}
function libBlankData(){
  const prefs = { domain:PREFS.domain || DEFAULT_DOMAIN, goal:'', context:'', pillars:'', avoid:'', steer:PREFS.steer };
  return { tree:JSON.stringify({ nodes:{}, order:[], links:[], seq:0 }), view:{ x:0, y:0, z:1 }, prefs };
}
async function libCreate(data,name,folderId){
  const m = await libApi('POST','cascades',{ name, folderId:folderId || null, data });
  LIB.cascades.unshift(m); return m;
}
async function libNewCascade(folderId){
  try{
    // what you have open now is saved first, so nothing is lost by starting fresh
    clearTimeout(LIB.timer); if(LIB.currentId) await libApi('PUT','cascades/'+LIB.currentId,{ data:libData() });
    const m = await libCreate(libBlankData(),'Untitled Cascade',folderId);
    libApply(JSON.parse(JSON.stringify(libBlankData()))); libRemember(m.id); LIB.editing = { kind:'cascade', id:m.id }; libRender();
  }catch(e){ libSetStatus('Could not create a Cascade: '+e.message); }
}
async function libSaveCurrent(){
  try{ const m = await libCreate(libData(),'My Cascade',null); libRemember(m.id); LIB.editing = { kind:'cascade', id:m.id }; libSetStatus('Saved. This Cascade now keeps itself up to date.'); libRender(); }
  catch(e){ libSetStatus('Could not save: '+e.message); }
}
async function libNewFolder(){
  try{ const f = await libApi('POST','folders',{ name:'New folder' }); LIB.folders.push(f); LIB.editing = { kind:'folder', id:f.id }; libRender(); }
  catch(e){ libSetStatus('Could not create a folder: '+e.message); }
}
async function libRename(kind,id,name){
  LIB.editing = null; name = (name || '').trim();
  const item = (kind==='folder' ? LIB.folders : LIB.cascades).find(x=>x.id===id);
  if(!item || !name || name===item.name) return libRender();
  try{ await libApi(kind==='folder' ? 'PATCH' : 'PUT',(kind==='folder' ? 'folders/' : 'cascades/')+id,{ name }); item.name = name.slice(0,80); }
  catch(e){ libSetStatus('Could not rename: '+e.message); }
  libRender();
}
async function libMove(id,folderId){
  try{ const m = await libApi('PUT','cascades/'+id,{ folderId:folderId || null }); Object.assign(LIB.cascades.find(c=>c.id===id),m); }
  catch(e){ libSetStatus('Could not move it: '+e.message); }
  libRender();
}
async function libDelete(kind,id){
  try{
    await libApi('DELETE',(kind==='folder' ? 'folders/' : 'cascades/')+id);
    if(kind==='folder'){ const gone = LIB.cascades.filter(c=>c.folderId===id).map(c=>c.id); LIB.folders = LIB.folders.filter(f=>f.id!==id); LIB.cascades = LIB.cascades.filter(c=>c.folderId!==id); if(gone.includes(LIB.currentId)) libRemember(null); }
    else{ LIB.cascades = LIB.cascades.filter(c=>c.id!==id); if(LIB.currentId===id) libRemember(null); }
  }catch(e){ libSetStatus('Could not delete: '+e.message); }
  LIB.armed = null; libRender();
}

/* ---- the list ---- */
function libEl(tag,attrs,...kids){
  const e = document.createElement(tag);
  for(const [k,v] of Object.entries(attrs || {})){ if(k==='text') e.textContent = v; else if(k==='on') for(const [ev,fn] of Object.entries(v)) e.addEventListener(ev,fn); else if(v!==false && v!==null && v!==undefined) e.setAttribute(k,v===true ? '' : v); }
  kids.forEach(k=>{ if(k) e.append(k); });
  return e;
}
const libWhen = (t) => { const d = new Date(t); return isFinite(d) ? d.toLocaleDateString(undefined,{ month:'short', day:'numeric' }) : ''; };
function libNameCell(kind,item){
  if(LIB.editing && LIB.editing.kind===kind && LIB.editing.id===item.id){
    const inp = libEl('input',{ type:'text', value:item.name, maxlength:80, 'aria-label':'Name', class:'lib-name-input' });
    inp.addEventListener('keydown',e=>{ if(e.key==='Enter') libRename(kind,item.id,inp.value); else if(e.key==='Escape'){ LIB.editing = null; libRender(); } });
    inp.addEventListener('blur',()=>{ if(LIB.editing) libRename(kind,item.id,inp.value); });
    setTimeout(()=>{ inp.focus(); inp.select(); },0);
    return inp;
  }
  return kind==='cascade' ? libEl('button',{ type:'button', class:'lib-open', text:item.name, on:{ click:()=>libOpen(item.id) } }) : libEl('strong',{ text:item.name });
}
function libDeleteBtn(kind,item){
  const armed = LIB.armed===kind+item.id;
  return libEl('button',{ type:'button', class:'btn small'+(armed ? ' danger' : ''), text:armed ? 'Really delete?' : 'Delete', 'aria-label':'Delete '+item.name, on:{ click:()=>{
    if(armed) return libDelete(kind,item.id);
    LIB.armed = kind+item.id; libRender(); setTimeout(()=>{ if(LIB.armed===kind+item.id){ LIB.armed = null; libRender(); } },4000);
  } } });
}
function libCascadeRow(c){
  const move = libEl('select',{ 'aria-label':'Move '+c.name+' to a folder', on:{ change:(e)=>libMove(c.id,e.target.value) } },
    libEl('option',{ value:'', text:'No folder' }), ...LIB.folders.map(f=>libEl('option',{ value:f.id, text:f.name })));
  move.value = c.folderId || '';
  return libEl('li',{ class:'lib-row'+(c.id===LIB.currentId ? ' current' : ''), 'data-id':c.id },
    libNameCell('cascade',c),
    libEl('span',{ class:'lib-meta', text:(DOMAINS[c.domain] ? DOMAINS[c.domain].label : '')+' · '+libWhen(c.updatedAt)+(c.id===LIB.currentId ? ' · open now' : '') }),
    libEl('span',{ class:'lib-actions' },
      libEl('button',{ type:'button', class:'btn small', text:'Rename', 'aria-label':'Rename '+c.name, on:{ click:()=>{ LIB.editing = { kind:'cascade', id:c.id }; libRender(); } } }),
      move, libDeleteBtn('cascade',c)));
}
function libRender(){
  libTitle();
  const list = $('#libList'); if(!list) return;
  const signed = libSignedIn();
  $('#libTools').hidden = !signed;
  $('#libSaveCur').hidden = !signed || !!libCurrent();
  const acct = $('#libAccount'); acct.hidden = LIB.kind!=='cloud';
  if(LIB.kind==='cloud'){
    $('#libWho').textContent = LIB.user ? `Signed in as ${LIB.user.name || LIB.user.email} (${LIB.user.email})` : 'Sign in to keep your Cascades on the web and open them anywhere.';
    $('#libSignOut').hidden = !LIB.user; $('#libGoogle').hidden = !!LIB.user;
    $('#libDeleteAccount').hidden = !LIB.user;
    if(!LIB.user) libMountGoogle();
  }
  list.textContent = '';
  if(!signed) return;
  if(!LIB.folders.length && !LIB.cascades.length){ list.append(libEl('p',{ class:'small', text:'Nothing saved yet. Start a new Cascade, or save the one you have open.' })); return; }
  for(const f of LIB.folders){
    const inside = LIB.cascades.filter(c=>c.folderId===f.id);
    list.append(libEl('section',{ class:'lib-folder', 'data-folder':f.id },
      libEl('header',{ class:'lib-fhead' }, libNameCell('folder',f), libEl('span',{ class:'lib-meta', text:inside.length+(inside.length===1 ? ' Cascade' : ' Cascades') }),
        libEl('span',{ class:'lib-actions' },
          libEl('button',{ type:'button', class:'btn small', text:'New Cascade here', on:{ click:()=>libNewCascade(f.id) } }),
          libEl('button',{ type:'button', class:'btn small', text:'Rename', 'aria-label':'Rename folder '+f.name, on:{ click:()=>{ LIB.editing = { kind:'folder', id:f.id }; libRender(); } } }),
          libDeleteBtn('folder',f))),
      libEl('ul',{ class:'lib-list' }, ...inside.map(libCascadeRow))));
  }
  const loose = LIB.cascades.filter(c=>!c.folderId);
  if(loose.length) list.append(libEl('section',{ class:'lib-folder' }, LIB.folders.length ? libEl('header',{ class:'lib-fhead' },libEl('strong',{ text:'Not in a folder' })) : null, libEl('ul',{ class:'lib-list' }, ...loose.map(libCascadeRow))));
}

/* ---- AI through the account (cloud only) ---- */
// Signed in on the cloud, the AI settings screen and every AI call use the account's saved keys, through the server.
async function cloudAiRefresh(){
  if(LIB.kind!=='cloud') return;
  if(LIB.user){
    try{ SRV = await libApi('GET','settings'); CLOUDAI = true; aiOff = false; initProviderList(); }
    catch(e){ CLOUDAI = false; SRV = null; }
  }else{ CLOUDAI = false; SRV = null; }
  $('#aiLocal').hidden = !CLOUDAI; $('#aiWeb').hidden = CLOUDAI;
  $('#aiLocalLead').textContent = 'Pick who does the thinking. Your keys are saved to your account, encrypted, and used from our server only to call the provider you choose. The page can’t read them back.';
  $('#aiCloudHint').hidden = CLOUDAI || !LIB.googleClientId;
  $('#dStats').hidden = !ANALYTICS.on;
  updateProviders(); updateHud();
}

/* ---- Google sign-in (cloud only) ---- */
function libMountGoogle(){
  const host = $('#libGoogle'); if(!LIB.googleClientId){ host.textContent = 'Google sign-in is not set up on this server yet.'; return; }
  if(LIB.gsi && window.google && google.accounts){ libDrawGoogle(); return; }
  if(document.getElementById('gsi-script')) return;
  const s = document.createElement('script'); s.id = 'gsi-script'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
  s.onload = () => { LIB.gsi = true; libDrawGoogle(); };
  s.onerror = () => { host.textContent = 'Could not load Google sign-in. Check your connection.'; };
  document.head.append(s);
}
function libDrawGoogle(){
  const host = $('#libGoogle'); host.textContent = '';
  google.accounts.id.initialize({ client_id:LIB.googleClientId, callback:libGoogleDone, ux_mode:'popup' });
  google.accounts.id.renderButton(host,{ theme:'outline', size:'large', text:'signin_with' });
}
async function libGoogleDone(resp){
  try{ const r = await libApi('POST','auth/google',{ credential:resp.credential }); LIB.user = r.user; libSetStatus(''); await libRefresh(); }
  catch(e){ libSetStatus('Sign-in did not work: '+e.message); }
}
async function libSignOut(){ try{ await libApi('POST','auth/logout',{}); }catch(e){} LIB.user = null; cloudAiRefresh(); libRemember(null); LIB.folders = []; LIB.cascades = []; libRender(); }
async function libDeleteAccount(){
  if(LIB.armed!=='account'){ LIB.armed = 'account'; $('#libDeleteAccount').textContent = 'Really delete my account and every saved Cascade?'; setTimeout(()=>{ if(LIB.armed==='account'){ LIB.armed = null; $('#libDeleteAccount').textContent = 'Delete my account'; } },5000); return; }
  try{ await libApi('DELETE','auth/account'); }catch(e){ libSetStatus('Could not delete the account: '+e.message); return; }
  LIB.armed = null; $('#libDeleteAccount').textContent = 'Delete my account'; LIB.user = null; cloudAiRefresh(); libRemember(null); LIB.folders = []; LIB.cascades = []; libRender();
}

/* ---- start-up: find out which library (if any) this page can use ---- */
async function libInit(){
  $('#libNew').addEventListener('click',()=>libNewCascade(null));
  $('#libFolder').addEventListener('click',libNewFolder);
  $('#libSaveCur').addEventListener('click',libSaveCurrent);
  $('#libSignOut').addEventListener('click',libSignOut);
  $('#libDeleteAccount').addEventListener('click',libDeleteAccount);
  $('#railLib').addEventListener('click',()=>openSettings('library'));
  $('#openName').addEventListener('click',()=>openSettings('library'));
  if(LOCAL) LIB.kind = 'local';
  else if(WEB){
    try{
      const r = await fetch('/api/config');
      if(r.ok && (r.headers.get('content-type') || '').includes('json')){ const c = await r.json(); if(c && c.cloud){ LIB.kind = 'cloud'; LIB.googleClientId = c.googleClientId || ''; ANALYTICS.on = !!c.analytics; } }
    }catch(e){}
  }
  if(!LIB.kind) return;
  try{ const saved = JSON.parse(localStorage.getItem(LIB_CURRENT) || 'null'); if(saved && saved.kind===LIB.kind) LIB.currentId = saved.id; }catch(e){}
  $('#libTab').hidden = false; $('#railLib').hidden = false;
  await libRefresh();
}
