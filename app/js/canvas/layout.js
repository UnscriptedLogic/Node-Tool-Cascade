'use strict';
/* ================= layout ================= */
function syncDom(vis){
  for(const id in R){ if(!S.nodes[id]){ R[id].el.remove(); delete R[id]; } }
  for(const id of S.order){
    const n = S.nodes[id]; if(!n) continue;
    if(!R[id]){
      const el = document.createElement('div');
      el.dataset.id = id; el.tabIndex = 0; el.style.display = 'none';
      el.innerHTML = '<div class="in blk"><span class="ico"></span><span class="txt"></span><span class="srcmark" role="button" aria-label="Where this came from"></span><span class="badge"></span><span class="mbadge"></span></div><div class="bar"></div>';
      world.appendChild(el);
      R[id] = {el,cur:{x:0,y:0},tgt:{x:0,y:0},w:nodeW(n.type),h:56,shown:false,fresh:true};
    }
  }
  for(const id in R){
    const r = R[id], show = vis.has(id);
    if(show && !r.shown){ r.el.style.display=''; r.shown=true; r.fresh=true; }
    if(!show && r.shown){ r.el.style.display='none'; r.shown=false; }
    if(show) paint(S.nodes[id]);
  }
}
const clsFor = (n,r) => ['node',n.type,n.ghost&&'ghost',S.sel===n.id&&'sel',r.enter&&'enter',r.hot&&'hot',r.growing&&'growing',r.drag&&'drag',r.drop&&'drop',r.settle&&'settle',n.src&&n.src.length&&'has-src',n.collapsed&&'collapsed',S.layer&&MAP.flag[n.id]&&'m-'+MAP.flag[n.id],S.layer&&n.decided&&'decided',linkFrom===n.id&&'linking',THMAP[n.id]&&'in-thread'].filter(Boolean).join(' ');
function stepAttr(el,id){
  const t = THMAP[id];
  if(t){ el.dataset.step = t.step; el.style.setProperty('--tc',t.color); }
  else if(el.dataset.step){ delete el.dataset.step; el.style.removeProperty('--tc'); }
}
function restyle(){ MAP = computeMap(); for(const id in R){ const n = S.nodes[id]; if(n){ R[id].el.className = clsFor(n,R[id]); stepAttr(R[id].el,id); } } }
function paint(n){
  const r = R[n.id], el = r.el, blk = el.firstElementChild;
  el.className = clsFor(n,r); stepAttr(el,n.id);
  const hasKids = !!(KM[n.id] && KM[n.id].length);
  const desc = (n.collapsed || S.mode==='outer') ? descendants(n.id) : [];
  const dots = desc.filter(x=>S.nodes[x].type==='emotion').map(x=>S.nodes[x].mood||'curiosity');
  const sig = [n.type,n.text,n.ghost?1:0,n.mood||'',n.collapsed?1:0,S.mode,hasKids?1:0,desc.length,dots.join(','),n.parent?1:0,S.layer?1:0,MAP.flag[n.id]||'',n.ticket||'',n.state||'',(n.src&&n.src.length)||0,LOOKVER].join('|');
  if(sig===r.sig) return; r.sig = sig;
  blk.className = 'in blk t-'+n.type;
  el.style.width = decorate(blk,n.type,n).width+'px';
  blk.querySelector('.ico').innerHTML = ICONS[n.type];
  { const sm = blk.querySelector('.srcmark'); sm.innerHTML = ICONS.file; sm.title = n.src && n.src.length ? 'From '+n.src[0].f+':'+n.src[0].l+(n.src.length>1 ? ' (+'+(n.src.length-1)+' more)' : '') : ''; }
  if(!r.editing) blk.querySelector('.txt').textContent = n.text;
  const badge = blk.querySelector('.badge'); badge.textContent = '';
  const notes = desc.filter(x=>!isOuter(S.nodes[x])).length;
  if(desc.length && !(S.mode==='outer' && notes===0)){
    const sp = document.createElement('span');
    sp.textContent = S.mode==='outer' ? `${notes} ${notes===1?'note':'notes'}` : `${desc.length} hidden`;
    badge.appendChild(sp);
    const d = document.createElement('span'); d.className = 'dots';
    dots.slice(0,14).forEach(m=>{ const i=document.createElement('i'); i.style.setProperty('--c',moodColor(m)); d.appendChild(i); });
    badge.appendChild(d);
  }
  const mb = blk.querySelector('.mbadge'); mb.textContent = '';
  if(S.layer && (n.type==='question' || n.type==='fog')){
    const add = (t,c) => { const sp = document.createElement('span'); sp.className = 'mchip'+(c ? ' '+c : ''); sp.textContent = t; mb.appendChild(sp); };
    const f = MAP.flag[n.id];
    if(n.type==='question') add(TICKET_LABEL[n.ticket||'talk']);
    if(n.type==='fog') add(n.state==='out' ? 'Out of scope' : 'Fog','fogc');
    else if(f && !n.ghost) add({settled:'Settled',frontier:'Up next',blocked:'Waiting',out:'Out of scope'}[f],f);
  }
  const btns = [];
  if(S.mode==='outer'){ if(isOuter(n)) btns.push(['open','Open in detail view']); }
  else if(n.ghost){ btns.push(['accept','Keep this suggestion'],['dismiss','Dismiss']); }
  else if(n.type==='fog'){ btns.push(['sharpen','Sharpen into a question'],['out',n.state==='out' ? 'Bring back into scope' : 'Mark out of scope'],['del','Delete']); }
  else {
    if(S.layer && n.type==='question'){
      btns.push(n.state==='settled' ? ['reopen','Reopen this question'] : ['resolve','Resolve this question']);
      btns.push(['ticket','Ticket type: '+TICKET_LABEL[n.ticket||'talk']+'. Click to change'],['block','Blocked by…'],['out',n.state==='out' ? 'Bring back into scope' : 'Mark out of scope']);
    }
    btns.push(['grill','Grill me on this']);
    if(n.src && n.src.length) btns.push(['src','Where this came from']);
    btns.push(['grow','Grow branches from here']);
    if(n.type==='emotion') btns.push(['back','Trace back: why does the player feel this?']);
    if(hasKids) btns.push(['collapse',n.collapsed?'Expand':'Collapse']);
    btns.push(['del',hasKids?'Delete node (its children move up)':'Delete']);
    if(hasKids) btns.push(['delb','Delete node and everything below it']);
  }
  el.querySelector('.bar').innerHTML = btns.map(([a,t])=>`<button type="button" data-act="${a}" title="${t}" aria-label="${t}">${ACT[a]}</button>`).join('');
}
function layout(initial){
  rebuildKM();
  MAP = computeMap();
  const vis = new Set(visibleIds());
  syncDom(vis);
  const ids = [...vis];
  for(const id of ids){ const r = R[id]; r.w = nodeW(S.nodes[id].type); r.h = r.el.offsetHeight || 56; }
  const kidsOf = {}, roots = [];
  for(const id of ids){ const p = effParent(id); if(p && vis.has(p)) (kidsOf[p]||(kidsOf[p]=[])).push(id); else roots.push(id); }
  const GY = effLook().layout.rowGap, gapX = effLook().layout.colGap, colW = [], colX = [0];
  const walk = (id,d) => { colW[d] = Math.max(colW[d] || 0,R[id].w); (kidsOf[id]||[]).forEach(c=>walk(c,d+1)); };
  roots.forEach(id=>walk(id,0));
  for(let d=1; d<colW.length; d++) colX[d] = colX[d-1]+colW[d-1]+gapX;
  const sub = (id) => { let hs=0; const k = kidsOf[id]||[]; k.forEach((c,i)=>{ hs += sub(c) + (i?GY:0); }); R[id].kh = hs; R[id].sh = Math.max(R[id].h,hs); return R[id].sh; };
  const put = (id,d,top) => {
    const r = R[id], k = kidsOf[id]||[]; r.tgt.x = colX[d];
    if(!k.length){ r.tgt.y = top + (r.sh-r.h)/2; return; }
    let cy = top + (r.sh-r.kh)/2;
    k.forEach(c=>{ put(c,d+1,cy); cy += R[c].sh + GY; });
    const a = R[k[0]], b = R[k[k.length-1]];
    r.tgt.y = (a.tgt.y + b.tgt.y + b.h)/2 - r.h/2;
  };
  let y = 0; roots.forEach(id=>{ sub(id); put(id,0,y); y += R[id].sh + 40; });
  for(const id of ids){
    const r = R[id];
    if(initial){ r.cur.x = r.tgt.x; r.cur.y = r.tgt.y; r.fresh = false; continue; }
    if(r.fresh){
      r.fresh = false;
      const sp = spawnAt[id]; delete spawnAt[id];
      const p = effParent(id), pr = p && R[p] && R[p].shown ? R[p] : null;
      if(sp){ r.cur.x = sp.x - r.w/2; r.cur.y = sp.y - r.h/2; }
      else if(pr){ const f = pr.fresh ? pr.tgt : pr.cur; r.cur.x = f.x; r.cur.y = f.y; }
      else { r.cur.x = r.tgt.x; r.cur.y = r.tgt.y; }
      if(!reduce){
        r.enter = true; r.el.className = clsFor(S.nodes[id],r);
        requestAnimationFrame(()=>requestAnimationFrame(()=>{ r.enter=false; if(S.nodes[id]) r.el.className = clsFor(S.nodes[id],r); }));
      }
    }
  }
  kick();
}

