'use strict';

const SKILL_NODE_SIZE = 64;
const skillCategories = {
  project: {icon:ICONS.consequence, kinds:['project']},
  system: {icon:svg('<rect x="2.5" y="2.5" width="4" height="4" rx=".6"/><rect x="9.5" y="2.5" width="4" height="4" rx=".6"/><rect x="2.5" y="9.5" width="4" height="4" rx=".6"/><rect x="9.5" y="9.5" width="4" height="4" rx=".6"/>'), kinds:['system','assembly','namespace']},
  script: {icon:ICONS.file, kinds:['file']},
  type: {icon:svg('<path d="m8 1.8 5.5 3.1v6.2L8 14.2l-5.5-3.1V4.9zM2.5 4.9 8 8l5.5-3.1M8 8v6.2"/>'), kinds:['class','interface','struct','enum','type','record','delegate']},
  callable: {icon:svg('<path d="m5.4 4-4 4 4 4m5.2-8 4 4-4 4M9.1 2.8 6.9 13.2"/>'), kinds:['method','function','constructor','local-function','accessor']},
  value: {icon:svg('<path d="M5.6 2.4c-1.5 0-2.1.7-2.1 2v1.7c0 1-.5 1.9-1.5 1.9 1 0 1.5.9 1.5 1.9v1.7c0 1.3.6 2 2.1 2m4.8-11.2c1.5 0 2.1.7 2.1 2v1.7c0 1 .5 1.9 1.5 1.9-1 0-1.5.9-1.5 1.9v1.7c0 1.3-.6 2-2.1 2"/>'), kinds:['property','field','variable','parameter','constant','enum-member']},
  event: {icon:ICONS.emotion, kinds:['event','signal']},
  asset: {icon:svg('<path d="m8 2 6 4-6 4-6-4zM2 9l6 4 6-4"/>'), kinds:['scene','prefab','asset','gameobject','component']},
  symbol: {icon:ICONS.decision, kinds:[]}
};
const skillCategoryByKind = new Map(Object.entries(skillCategories).flatMap(
  ([category,{kinds}])=>kinds.map(kind=>[kind,category])
));
const skillCategoryTints = {
  project:'#e4b849', system:'#4bc5ae', script:'#62a8f5',
  type:'#a28af0', callable:'#f28a61', value:'#90bc5a',
  event:'#e67fb6', asset:'#55c2df', symbol:'#a1a1aa'
};
const skillCategory = kind => skillCategoryByKind.get(kind)||'symbol';

function populateCodeLegend(){
  const labels={
    project:'Project',system:'System / assembly',script:'Script',type:'Type',
    callable:'Function / method',value:'Field / value',event:'Event',
    asset:'Unity asset / object',symbol:'Other symbol'
  };
  const list=$('#codeLegendNodes');
  for(const [category,label] of Object.entries(labels)){
    const entry=document.createElement('li');
    const icon=document.createElement('span');
    icon.className='code-legend-icon';
    icon.setAttribute('aria-hidden','true');
    icon.style.setProperty('--skill-tint',skillCategoryTints[category]);
    icon.innerHTML=skillCategories[category].icon;
    entry.append(icon,label);
    list.append(entry);
  }
}

function scriptDependencyTints(graph){
  const byId=new Map(graph.nodes.map(node=>[node.id,node]));
  const categoriesByFile=new Map();
  for(const {a,b} of graph.edges){
    const dependent=byId.get(a), dependency=byId.get(b);
    if(!dependent?.file||!dependency?.file||dependent.file===dependency.file)continue;
    if(!categoriesByFile.has(dependent.file))categoriesByFile.set(dependent.file,new Set());
    categoriesByFile.get(dependent.file).add(skillCategory(dependency.kind));
  }
  const tints=new Map();
  for(const node of graph.nodes){
    if(node.kind!=='file')continue;
    const categories=categoriesByFile.get(node.file);
    if(!categories?.size)continue;
    const sums=[0,0,0];
    for(const category of categories){
      const tint=skillCategoryTints[category];
      sums.forEach((_,index)=>{sums[index]+=parseInt(tint.slice(1+index*2,3+index*2),16);});
    }
    const mix=sums.map(sum=>Math.round(sum/categories.size).toString(16).padStart(2,'0')).join('');
    tints.set(node.id,'#'+mix);
  }
  return tints;
}

function canvasNodeClasses(n,graph){
  return [n.codeId&&'skill-node',n.codePreview&&'preview-'+n.codePreview,n.codeProposal&&'proposal-tile',n.codeImpact&&'code-affected',n.src?.length&&'has-src',graph.layer&&MAP.flag[n.id]&&'m-'+MAP.flag[n.id],graph.layer&&n.decided&&'decided',linkFrom===n.id&&'linking',THMAP[n.id]&&'in-thread'];
}
function paintSkillNode(n,r,graph,hasKids){
  const el = r.el, category = skillCategory(n.codeKind);
  const tint = graph.scriptTints?.get(n.codeId)||skillCategoryTints[category];
  const detail = [n.codePreviewNote, graph.visual?.labels===false ? n.codeKind : n.codeCaption||n.codeKind].filter(Boolean).join(' · ');
  const signature = JSON.stringify([n.text,category,tint,detail,n.codeKind,n.codeVirtual,n.codeExpandable,n.collapsed,hasKids]);
  if(r.sig===signature) return;
  r.sig = signature;
  el.dataset.skillCategory = category;
  el.style.setProperty('--skill-tint',tint);
  el.style.width = SKILL_NODE_SIZE+'px';
  el.title = n.text+' · '+detail;
  el.setAttribute('aria-label',n.text+' · '+n.codeKind);
  el.innerHTML = '<div class="in skill-tile"><span class="skill-icon"></span><span class="txt"></span></div><div class="bar"></div>';
  el.querySelector('.skill-icon').innerHTML = skillCategories[category].icon;
  el.querySelector('.txt').textContent = n.text;
  paintNodeActions(el,n,hasKids);
}
function stepAttr(el,id){
  const t = THMAP[id];
  if(t){ el.dataset.step = t.step; el.style.setProperty('--tc',t.color); }
  else if(el.dataset.step){ delete el.dataset.step; el.style.removeProperty('--tc'); }
}
function paintCanvasNode(n,r,graph,children){
  const el = r.el, blk = el.firstElementChild;
  stepAttr(el,n.id);
  const hasKids = !!children[n.id]?.length;
  if(n.codeId){ paintSkillNode(n,r,graph,hasKids); return; }
  const desc = (n.collapsed || graph.mode==='outer') ? CascadeGraphModel.descendants(children,n.id) : [];
  const dots = desc.filter(x=>graph.nodes[x].type==='emotion').map(x=>graph.nodes[x].mood||'curiosity');
  const sig = [n.type,n.text,n.codeCaption||'',JSON.stringify(n.mindset||null),n.ghost?1:0,n.mood||'',n.collapsed?1:0,graph.mode,hasKids?1:0,desc.length,dots.join(','),n.parent?1:0,graph.layer?1:0,MAP.flag[n.id]||'',n.ticket||'',n.state||'',(n.src&&n.src.length)||0,LOOKVER].join('|');
  const actionSig = graph.mindsets.length ? 'mindsets' : '';
  if(sig===r.sig && actionSig===r.actionSig) return; r.sig = sig; r.actionSig = actionSig;
  blk.className = 'in blk t-'+n.type;
  el.style.width = decorate(blk,n.type,n).width+'px';
  const ml = blk.querySelector('.mindset-label'), mindset = Mindsets.metadata(n.mindset);
  ml.hidden = !mindset; ml.textContent = mindset ? Mindsets.label(mindset,false) : '';
  ml.title = mindset ? [mindset.packName,mindset.source.title,mindset.source.edition,mindset.source.url,mindset.source.coverage,...mindset.references.map(r=>r.source+' — '+r.location),mindset.why].filter(Boolean).join('\n') : '';
  if(mindset) ml.setAttribute('aria-label',Mindsets.label(mindset,false)+'. Show source and relevance');
  const ico = blk.querySelector('.ico');
  if(mindset) ico.textContent = mindset.icon; else ico.innerHTML = ICONS[n.type];
  { const sm = blk.querySelector('.srcmark'); sm.innerHTML = ICONS.file; sm.title = n.src && n.src.length ? 'From '+n.src[0].f+':'+n.src[0].l+(n.src.length>1 ? ' (+'+(n.src.length-1)+' more)' : '') : ''; }
  if(!r.editing) blk.querySelector('.txt').textContent = n.text;
  const caption=blk.querySelector('.code-caption'); caption.hidden=!n.codeId; caption.textContent=n.codeCaption||'';
  const badge = blk.querySelector('.badge'); badge.textContent = '';
  const notes = desc.filter(x=>!isOuter(graph.nodes[x])).length;
  if(desc.length && !(graph.mode==='outer' && notes===0)){
    const sp = document.createElement('span');
    sp.textContent = graph.mode==='outer' ? `${notes} ${notes===1?'note':'notes'}` : `${desc.length} hidden`;
    badge.appendChild(sp);
    const d = document.createElement('span'); d.className = 'dots';
    dots.slice(0,14).forEach(m=>{ const i=document.createElement('i'); i.style.setProperty('--c',moodColor(m)); d.appendChild(i); });
    badge.appendChild(d);
  }
  const mb = blk.querySelector('.mbadge'); mb.textContent = '';
  if(graph.layer && (n.type==='question' || n.type==='fog')){
    const add = (t,c) => { const sp = document.createElement('span'); sp.className = 'mchip'+(c ? ' '+c : ''); sp.textContent = t; mb.appendChild(sp); };
    const f = MAP.flag[n.id];
    if(n.type==='question') add(TICKET_LABEL[n.ticket||'talk']);
    if(n.type==='fog') add(n.state==='out' ? 'Out of scope' : 'Fog','fogc');
    else if(f && !n.ghost) add({settled:'Settled',frontier:'Up next',blocked:'Waiting',out:'Out of scope'}[f],f);
  }
  paintNodeActions(el,n,hasKids);
}
function paintNodeActions(el,n,hasKids){
  const btns = nodeActions(n,hasKids);
  el.querySelector('.bar').innerHTML = btns.map(([a,t])=>`<button type="button" data-act="${a}" title="${t}" aria-label="${t}">${ACT[a]}</button>`).join('');
}
// what can be done to a block: [action, description] pairs, in order. Used by the desktop bar, the phone action strip and the menus.
function nodeActions(n,hasKids,graph = canvasState()){
  if(n.codeProposal)return [];
  if(n.codeId) return [...(!n.codeVirtual?[['src','View source']]:[]),['grill',n.codeKind==='project'?'Ask about this project':n.codeVirtual?'Ask about this system':'Ask about this code'],...(n.codeKind!=='project'&&(hasKids||n.codeExpandable)?[['collapse',n.collapsed?'Expand branch':'Collapse branch']]:[])];
  const btns = [];
  if(graph.mode==='outer'){ if(isOuter(n)) btns.push(['open','Open in detail view']); }
  else if(n.ghost){ btns.push(...CascadeGraphModel.ghostActions); }
  else if(n.type==='fog'){ btns.push(['sharpen','Sharpen into a question'],['out',n.state==='out' ? 'Bring back into scope' : 'Mark out of scope'],['del','Delete']); }
  else {
    if(graph.layer && n.type==='question'){
      btns.push(n.state==='settled' ? ['reopen','Reopen this question'] : ['resolve','Resolve this question']);
      btns.push(['ticket','Ticket type: '+TICKET_LABEL[n.ticket||'talk']+'. Click to change'],['block','Blocked by…'],['out',n.state==='out' ? 'Bring back into scope' : 'Mark out of scope']);
    }
    btns.push(['grill','Grill me on this']);
    if(n.src && n.src.length) btns.push(['src','Where this came from']);
    btns.push(['grow','Grow branches from here']);
    if(graph.mindsets.length) btns.push(['mindset','Apply a mindset']);
    if(n.type==='emotion'){ if(hasBridgeGround(n.id)) btns.push(['bridge','Bridge: connect the existing tree to this feeling, from both ends']); btns.push(['back',DOM().traceTip]); }
    if(hasKids) btns.push(['collapse',n.collapsed?'Expand':'Collapse']);
    btns.push(['del',hasKids?'Delete node (its children move up)':'Delete']);
    if(hasKids) btns.push(['delb','Delete node and everything below it']);
  }
  return btns;
}
function paintCanvasLink(p,L,na,nb){
  if(L.codePlan){
    p.classList.add('code-preview-wire');
    if(L.codePlanAction)p.classList.add('preview-wire-'+L.codePlanAction);
    if(L.codeLabel){
      let title=p.querySelector('title');
      if(!title){title=document.createElementNS(SVGNS,'title');p.appendChild(title);}
      title.textContent=L.codeLabel;
    }
  }
  if(L.codeEdge){
    p.dataset.codeEdge=L.codeEdge; p.classList.add('code-connection'); p.classList.toggle('code-selected',!!L.codeSelected);
    p.setAttribute('tabindex','0'); p.setAttribute('role','button'); p.setAttribute('aria-label',na.text+' '+L.codeKind+' '+nb.text+' · '+L.codeCount+' connection(s)');
    let title=p.querySelector('title'); if(!title){ title=document.createElementNS(SVGNS,'title'); p.appendChild(title); } title.textContent=L.codeKind+' · '+L.codeCount+' connection(s) · '+L.codeLabel;
  }
}
