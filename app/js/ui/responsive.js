'use strict';
/* ================= small screens =================
   Two layouts for phones, chosen in Settings > Behavior (or ?layout=minimal in the address):
     standard  a top bar, a block dock at the bottom, an action strip for the selected block, and bottom sheets
     minimal   nothing on screen but the canvas. Tap empty space for a menu of everything you can do; tap a block for its menu.
   Larger screens are untouched. Which layout applies is decided by the screen, not the device, so a narrow desktop window gets it too. */
const SHORT = { accept:'Keep', dismiss:'Dismiss', grow:'Grow', back:'Trace', bridge:'Bridge', collapse:'Fold', del:'Delete', delb:'Delete all', open:'Open', resolve:'Resolve', reopen:'Reopen', ticket:'Ticket', block:'Block by', out:'Scope', sharpen:'Sharpen', src:'Source', grill:'Grill' };
const isSmall = () => innerWidth<=760 || (innerHeight<=520 && matchMedia && matchMedia('(pointer: coarse)').matches);
const isMobile = () => document.body.classList.contains('m');
const isMinimal = () => document.body.classList.contains('m-minimal');
function layoutChoice(){
  const q = new URLSearchParams(location.search).get('layout');
  return q==='minimal' || q==='standard' ? q : (PREFS.mobileLayout==='minimal' ? 'minimal' : 'standard');
}
let lastSmall = null, lastChoice = null;
function applyResponsive(force){
  const small = isSmall(), choice = layoutChoice(), first = lastSmall===null;
  if(!force && small===lastSmall && choice===lastChoice) return;
  lastSmall = small; lastChoice = choice;
  const cl = document.body.classList;
  cl.toggle('m',small); cl.toggle('m-standard',small && choice==='standard'); cl.toggle('m-minimal',small && choice==='minimal');
  closeMenu(); syncNodeBar();
  if(small && choice==='minimal') hintMinimal();
  if(!first) try{ fitIfNeeded(); }catch(e){}   // the first call is start-up: the saved view stays
}
// the stage changes size when the dock or bars appear: keep the tree in view
function fitIfNeeded(){ if(S.order.length && typeof fitTo==='function') requestAnimationFrame(()=>fitTo(visibleIds(),{maxZ:1,minZ:.6,pad:24,instant:true})); }
function hintMinimal(){
  try{ if(localStorage.getItem('cascade-minimal-hint')) return; localStorage.setItem('cascade-minimal-hint','1'); }catch(e){}
  setTimeout(()=>showNote(['Tap empty space for a menu, or tap a block for its actions.'],false),600);
}
let resizeTimer = 0;
const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(()=>applyResponsive(false),120); updateKeyboard(); };
addEventListener('resize',onResize); addEventListener('orientationchange',onResize);
// keep sheets above the on-screen keyboard
function updateKeyboard(){ const vv = window.visualViewport; if(!vv) return; document.documentElement.style.setProperty('--kb',Math.max(0,Math.round(innerHeight-vv.height-vv.offsetTop))+'px'); }
if(window.visualViewport) visualViewport.addEventListener('resize',updateKeyboard);

/* ---------- running a block's action, from the desktop bar, the strip, or a menu ---------- */
// built when used, because the functions live in files that load after this one
function runNodeAction(act,id){
  const run = { accept:acceptGhost, dismiss:dismissGhost, grow:growNode, back:traceBack, bridge:bridgeTo, collapse:toggleCollapse, del:(i)=>deleteNode(i,false), delb:(i)=>deleteNode(i,true), open:openLoop, resolve:startResolve, reopen:reopenQ, grill:startGrill, ticket:cycleTicket, block:startBlock, out:toggleOut, sharpen:(i)=>beginEdit(i,{graduate:true}), src:openNodeSrc }[act];
  if(run && S.nodes[id]) run(id);
}

/* ---------- standard layout: the strip of actions for the selected block ---------- */
function syncNodeBar(){
  const bar = document.getElementById('nodebar'); if(!bar) return;
  const n = S.sel && S.nodes[S.sel], show = !!(n && isMobile() && !isMinimal() && (S.mode!=='outer' || isOuter(n)));
  stage.classList.toggle('nb',show);
  if(!show){ bar.hidden = true; bar.textContent = ''; bar.dataset.for = ''; return; }
  const sig = S.sel+'|'+nodeActions(n,!!(KM[n.id] && KM[n.id].length)).map(a=>a[0]+a[1]).join();
  if(bar.dataset.for===sig && !bar.hidden) return;   // nothing changed: leave the DOM alone
  bar.dataset.for = sig; bar.hidden = false; bar.textContent = '';
  nodeActions(n,!!(KM[n.id] && KM[n.id].length)).forEach(([act,title])=>{
    const b = document.createElement('button'); b.type = 'button'; b.dataset.act = act; b.setAttribute('aria-label',title); b.title = title;
    const ic = document.createElement('span'); ic.className = 'ic'; ic.innerHTML = ACT[act]; const t = document.createElement('span'); t.textContent = SHORT[act] || act;
    b.append(ic,t); bar.appendChild(b);
  });
}
document.getElementById('nodebar').addEventListener('click',e=>{ const b = e.target.closest('button[data-act]'); if(b && S.sel) runNodeAction(b.dataset.act,S.sel); });

/* ---------- context menu: popover at a point (minimal) or bottom sheet (standard's "more") ---------- */
let menuEl = null, menuBack = null, menuSpec = null, tapSuppressed = false;
function closeMenu(){
  if(menuEl){ menuEl.remove(); menuEl = null; }
  if(menuBack){ menuBack.remove(); menuBack = null; }
  menuSpec = null; document.removeEventListener('pointerdown',menuOutside,true); document.removeEventListener('keydown',menuKey,true);
}
function menuOutside(e){ if(menuEl && !menuEl.contains(e.target)){ tapSuppressed = true; closeMenu(); } }
function menuKey(e){ if(e.key==='Escape'){ e.stopPropagation(); closeMenu(); } }
// spec: { title, items:[{ label, icon, run, sub, danger, disabled, note }] }; sub is another spec shown in place, with a back row
function openMenu(spec,at){
  at = at || menuSpec && menuSpec.at || { x:innerWidth/2, y:innerHeight/2 };
  const sheet = !!at.sheet, hadMenu = !!menuEl;
  if(!hadMenu){
    if(sheet){ menuBack = document.createElement('div'); menuBack.id = 'ctxBack'; document.body.appendChild(menuBack); }
    menuEl = document.createElement('div'); menuEl.id = 'ctx'; menuEl.setAttribute('role','menu'); document.body.appendChild(menuEl);
    document.addEventListener('pointerdown',menuOutside,true); document.addEventListener('keydown',menuKey,true);
  }
  menuEl.className = sheet ? 'sheet' : ''; menuEl.textContent = '';
  menuSpec = { spec, at };
  if(spec.back || spec.title){
    const head = document.createElement('div'); head.className = 'ctx-head';
    if(spec.back){ const bk = document.createElement('button'); bk.type = 'button'; bk.className = 'ctx-back'; bk.setAttribute('aria-label','Back'); bk.innerHTML = svg('<path d="M10 3 5 8l5 5"/>'); bk.addEventListener('click',()=>openMenu(spec.back,at)); head.appendChild(bk); }
    const t = document.createElement('span'); t.className = 'ctx-title'; t.textContent = spec.title || ''; head.appendChild(t); menuEl.appendChild(head);
  }
  spec.items.forEach(it=>{
    if(it.sep){ const hr = document.createElement('div'); hr.className = 'ctx-sep'; menuEl.appendChild(hr); return; }
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role','menuitem'); b.disabled = !!it.disabled; if(it.danger) b.className = 'danger';
    const ic = document.createElement('span'); ic.className = 'ic'; if(it.icon) ic.innerHTML = it.icon; const lb = document.createElement('span'); lb.className = 'lb'; lb.textContent = it.label;
    b.append(ic,lb); if(it.sub){ const ch = document.createElement('span'); ch.className = 'chev'; ch.textContent = '›'; b.appendChild(ch); }
    b.addEventListener('click',()=>{ if(it.sub){ openMenu(Object.assign({},it.sub,{ back:spec, title:it.sub.title || it.label }),at); } else { closeMenu(); setTimeout(()=>it.run && it.run(),0); } });
    menuEl.appendChild(b);
  });
  if(!sheet) placeMenu(at); else menuEl.style.cssText = '';
  const first = menuEl.querySelector('button:not([disabled])'); if(first && !hadMenu) first.focus({ preventScroll:true });
}
function placeMenu(at){
  const m = menuEl, pad = 8, vw = innerWidth, vh = innerHeight;
  m.style.maxHeight = (vh-2*pad)+'px'; m.style.left = '0px'; m.style.top = '0px';
  const w = m.offsetWidth, h = m.offsetHeight;
  let x = Math.min(Math.max(pad,at.x-w/2),vw-w-pad), y = at.y+10;
  if(y+h>vh-pad){ y = at.y-h-10; if(y<pad) y = Math.max(pad,vh-h-pad); }
  m.style.left = x+'px'; m.style.top = y+'px';
}

const MI = {
  ask:ACT.grill, undo:svg('<path d="M3.5 6.5h6a3 3 0 0 1 0 6H6"/><path d="M6 4 3.5 6.5 6 9"/>'), fit:svg('<path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3"/>'),
  map:svg('<path d="M2 4l4-1.5 4 1.5 4-1.5v9.5l-4 1.5-4-1.5-4 1.5z"/><path d="M6 2.5v10M10 4v10"/>'), goal:svg('<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2"/>'),
  folder:svg('<path d="M2.5 4.5h4l1.5 1.5h5.5v6.5h-11z"/>'), settings:svg('<path d="M3 5h10M3 11h10"/><circle cx="6" cy="5" r="1.6"/><circle cx="10" cy="11" r="1.6"/>'), layout:svg('<rect x="3" y="3" width="10" height="10" rx="2"/><path d="M3 10h10"/>')
};
const TYPE_ORDER = ['question','answer','emotion','consequence','decision','loop','fog'];
function addBlockSpec(x,y){ return { title:'Add a block', items:TYPE_ORDER.map(t=>({ label:LABEL[t], icon:ICONS[t], run:()=>openCompose(t,x,y) })) }; }
// everything the desktop screen offers as buttons, as one menu
function canvasMenuSpec(x,y){
  const ghosts = Object.values(S.nodes).filter(n=>n.ghost).length, items = [];
  items.push({ label:'Add a block', icon:ICONS.question, sub:addBlockSpec(x,y) });
  if(ghosts && S.mode==='detail') items.push({ label:`Keep all ${ghosts} suggestion${ghosts===1 ? '' : 's'}`, icon:ACT.accept, run:keepAll }, { label:'Dismiss all suggestions', icon:ACT.dismiss, run:dismissAll });
  items.push({ sep:true });
  items.push({ label:'Ask the graph', icon:MI.ask, run:()=>document.getElementById('askBtn').click() }, { label:'Map and grill', icon:MI.map, run:()=>document.getElementById('mapBtn').click() });
  if(!document.getElementById('hlchip').hidden) items.push({ label:'Clear highlight', icon:ACT.dismiss, run:()=>document.getElementById('hlchip').click() });
  items.push({ sep:true });
  items.push({ label:'Undo', icon:MI.undo, disabled:!hist.length, run:undo }, { label:'Fit to screen', icon:MI.fit, run:()=>document.getElementById('zFit').click() },
    { label:S.mode==='outer' ? 'Back to detail view' : 'Loops overview', icon:ICONS.loop, run:()=>document.getElementById(S.mode==='outer' ? 'mDetail' : 'mOuter').click() });
  items.push({ sep:true });
  items.push({ label:'Goal and steering', icon:MI.goal, run:()=>openSettings('goal') });
  if(typeof LIB!=='undefined' && LIB.kind && libSignedIn()) items.push({ label:(function(){ const c = libCurrent(); return c ? 'Library: '+c.name : 'Library'; })(), icon:MI.folder, run:()=>openSettings('library') });
  items.push({ label:'Settings', icon:MI.settings, run:()=>openSettings() });
  items.push({ label:isMinimal() ? 'Switch to standard layout' : 'Switch to minimal layout', icon:MI.layout, run:()=>setMobileLayout(isMinimal() ? 'standard' : 'minimal') });
  return { title:'', items };
}
function nodeMenuSpec(id){
  const n = S.nodes[id], hasKids = !!(KM[id] && KM[id].length), items = [];
  if(!n.ghost) items.push({ label:'Edit text', icon:ICONS[n.type] || ICONS.question, run:()=>beginEdit(id) });
  const WORDS = { del:hasKids ? 'Delete (its children move up)' : 'Delete', delb:'Delete with everything below', bridge:'Bridge to this feeling', collapse:n.collapsed ? 'Expand' : 'Collapse' };
  nodeActions(n,hasKids).forEach(([act,title])=>items.push({ label:WORDS[act] || title.replace(/\. Click to change$/,''), icon:ACT[act], danger:act==='del' || act==='delb', run:()=>runNodeAction(act,id) }));
  const ghosts = Object.values(S.nodes).filter(x=>x.ghost).length;
  if(ghosts>1 && n.ghost) items.push({ sep:true }, { label:`Keep all ${ghosts} suggestions`, icon:ACT.accept, run:keepAll }, { label:'Dismiss all suggestions', icon:ACT.dismiss, run:dismissAll });
  return { title:n.text.length>46 ? n.text.slice(0,45)+'…' : n.text, items };
}
function openCanvasMenu(x,y){ openMenu(canvasMenuSpec(x,y),{ x,y }); }
function openNodeMenu(id,x,y){ if(S.nodes[id]) openMenu(nodeMenuSpec(id),{ x,y }); }
function setMobileLayout(v){ PREFS.mobileLayout = v==='minimal' ? 'minimal' : 'standard'; savePrefs(); applyResponsive(true); syncers.forEach(f=>f()); }

// the dock's "more" button, the standard layout's way to the same menu
document.getElementById('moreBtn').addEventListener('click',()=>openMenu(canvasMenuSpec(innerWidth/2,innerHeight/2),{ sheet:true }));
document.getElementById('moreBtn').addEventListener('pointerdown',e=>e.stopPropagation());
applyResponsive(true);
