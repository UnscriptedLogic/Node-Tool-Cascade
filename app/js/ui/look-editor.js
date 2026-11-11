'use strict';
/* ================= look editor ================= */
const PRESETS = [
  {id:'default',name:'Default',desc:'The original Cascade look.',words:['default','original','reset','factory'],sw:['#e4eaef','#ffffff','#16233a','#16233a','#7c8da3'],patch:{}},
  {id:'blueprint',name:'Blueprint',desc:'Technical drawing: right-angle wires on a blue grid.',words:['blueprint','technical','schematic','engineering','drafting'],sw:['#0b2545','#13315c','#8da9c4','#eef4ed','#8da9c4'],
    patch:{canvas:{bg:'#0b2545',grid:'lines',gridColor:'#16365f',gridSize:28},nodes:{base:{shape:'rect',fill:'#13315c',stroke:'#8da9c4',strokeWidth:1.5,text:'#eef4ed',iconColor:'#8da9c4'},question:{fill:'#0b2545',stroke:'#eef4ed',strokeWidth:2},emotion:{shape:'pill'},consequence:{fill:'#0f2d52',bar:{width:4,color:'#8da9c4'}},decision:{shape:'diamond',fill:'#eef4ed',stroke:'#eef4ed',text:'#0b2545',width:240},loop:{shape:'rect',fill:'#0b2545',stroke:'#eef4ed',ring:null,width:200},fog:{fill:'#0b2545',stroke:'#8da9c4',strokeStyle:'dashed',text:'#8da9c4',pattern:'none'}},wires:{style:'manhattan',radius:0,width:1.5,color:'#8da9c4',arrows:'end'},layout:{colGap:56,rowGap:14}}},
  {id:'paper',name:'Paper sketch',desc:'Warm paper, ink outlines, loose curved wires.',words:['paper','sketch','notebook','hand-drawn','handdrawn','ink','whiteboard'],sw:['#fbf7ef','#fffdf8','#3a3a3a','#2b2b2b','#3a3a3a'],
    patch:{canvas:{bg:'#fbf7ef',grid:'none'},nodes:{base:{fill:'#fffdf8',stroke:'#3a3a3a',strokeWidth:1.5,text:'#2b2b2b',radius:6,iconColor:'#6b6b6b'},question:{radius:[2,12,2,12],strokeWidth:2},consequence:{fill:'#f6efe0',bar:{width:4,color:'#3a3a3a'}},decision:{fill:'#2b2b2b',stroke:'#2b2b2b',text:'#fffdf8',shadow:'hard'},loop:{ring:null,stroke:'#2b2b2b',strokeWidth:2.5,radius:8},fog:{fill:'#f6efe0',stroke:'#6b6b6b',text:'#6b6b6b'}},wires:{style:'bezier',curvature:.75,width:1.4,color:'#3a3a3a'},layout:{colGap:52,rowGap:16}}},
  {id:'neon',name:'Neon night',desc:'Dark canvas, glowing outlines, colour-coded wires.',words:['neon','cyber','synthwave','glowing','cyberpunk','vaporwave'],sw:['#0a0a12','#12121f','#00f5d4','#f15bb5','#7b7bff'],
    patch:{canvas:{bg:'#0a0a12',grid:'dots',gridColor:'#1c1c30'},nodes:{base:{fill:'#12121f',stroke:'#7b7bff',strokeWidth:1.5,text:'#f2f2ff',radius:8,shadow:'glow',iconColor:'#7b7bff'},question:{stroke:'#00f5d4',strokeWidth:2},answer:{stroke:'#9b5de5'},emotion:{shadow:'glow'},consequence:{stroke:'#fee440',bar:null,fill:'#12121f'},decision:{fill:'#f15bb5',stroke:'#f15bb5',text:'#12121f'},loop:{fill:'#0a0a12',stroke:'#00bbf9',ring:null},fog:{fill:'#12121f',stroke:'#7b7bff',strokeStyle:'dashed',text:'#c9c9ff',pattern:'none'}},wires:{style:'straight',width:1.6,color:'#7b7bff',opacity:.85,arrows:'end',colorBy:'child'}}},
  {id:'mono',name:'Minimal mono',desc:'Square, grey and quiet. Thin straight wires.',words:['minimal','monochrome','mono','clean','simple','greyscale','grayscale'],sw:['#ffffff','#ffffff','#888888','#222222','#999999'],
    patch:{canvas:{bg:'#ffffff',grid:'none'},nodes:{base:{shape:'rect',fill:'#ffffff',stroke:'#888888',strokeWidth:1,text:'#222222',radius:0,fontSize:13,iconColor:'#888888'},question:{stroke:'#222222',strokeWidth:1.5},emotion:{shape:'pill'},consequence:{bar:null,fill:'#f4f4f4'},decision:{fill:'#222222',stroke:'#222222',text:'#ffffff'},loop:{ring:null,stroke:'#222222',strokeWidth:2,fontWeight:700},fog:{fill:'#ffffff',stroke:'#aaaaaa',text:'#777777',pattern:'none',strokeStyle:'dashed'}},wires:{style:'straight',width:1,color:'#999999'},layout:{colGap:40,rowGap:10}}},
  {id:'pastel',name:'Soft pastel',desc:'Rounded, borderless and gentle.',words:['pastel','soft','cute','candy','gentle','friendly','playful'],sw:['#f7f4ff','#dcebff','#e6f7ec','#ffd9e6','#b8b8d1'],
    patch:{canvas:{bg:'#f7f4ff',grid:'dots',gridColor:'#e1daf5'},nodes:{base:{radius:18,strokeStyle:'none',text:'#3b3358',fill:'#ffffff',shadow:'soft',iconColor:'#8a7fb5'},question:{fill:'#dcebff'},answer:{fill:'#e6f7ec'},consequence:{fill:'#fff1d6',bar:null},decision:{fill:'#ffd9e6',text:'#5a1f3a'},loop:{fill:'#e9e1ff',ring:null,radius:20},fog:{fill:'#f0f0f6',stroke:'#b8b8d1',strokeStyle:'dotted',strokeWidth:1.5,text:'#6d6d8a',pattern:'none',shadow:'none'}},wires:{style:'bezier',curvature:.55,width:2.5,color:'#b8b8d1'},layout:{colGap:54,rowGap:18}}},
  {id:'shapes',name:'Shape sampler',desc:'A different shape for every kind of block.',words:['shapes','geometric','varied shapes','different shapes'],sw:['#e4eaef','#ffffff','#16233a','#16233a','#3566d1'],
    patch:{nodes:{question:{shape:'hexagon',width:236},consequence:{shape:'tag',bar:null},decision:{shape:'diamond',width:250},loop:{shape:'ellipse',width:210},fog:{shape:'parallelogram'}},wires:{style:'manhattan',radius:12,colorBy:'child'}}}
];

/* describe it in words: a keyword interpreter that works with no AI (the AI path is in lkGenerate) */
const mixHex = (a,b,t) => { const x = rgbOf(a), y = rgbOf(b); if(!x || !y) return a; return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join(''); };
const TYPE_PHRASE = {question:'questions?',answer:'answers?',emotion:'emotions?|feelings?|moods?',consequence:'consequences?',decision:'decisions?',loop:'loops?|stages?',fog:'fog|clouds?',base:'nodes?|blocks?|boxes|cards?|everything|all'};
function lookFromText(desc){
  const t = ' '+String(desc || '').toLowerCase().replace(/[,.;:!?()]/g,' ').replace(/\s+/g,' ')+' ';
  const patch = {}; let reset = false;
  const put = (path,val) => { const ks = path.split('.'); let o = patch; ks.slice(0,-1).forEach(k=>{ o = o[k] = o[k] || {}; }); o[ks[ks.length-1]] = val; };
  const pre = PRESETS.find(pr=>pr.words.some(w=>t.includes(' '+w)));
  if(pre){ if(pre.id==='default') reset = true; else Object.assign(patch,JSON.parse(JSON.stringify(pre.patch))); }
  if(/ straight |direct lines?|plain lines?/.test(t)) put('wires.style','straight');
  if(/manhattan|orthogonal|right[- ]?angle|circuit|stepped|elbow/.test(t)) put('wires.style','manhattan');
  if(/curv|smooth|swoop|organic|bezier|flowing|loopy/.test(t)){ put('wires.style','bezier'); put('wires.curvature',/very|extra|super|really|swoop|loopy|dramatic/.test(t) ? .9 : /gentle|slight|subtle|tight/.test(t) ? .3 : .7); }
  if(/thick (wires?|lines?|connections?|edges?)|heavy (wires?|lines?)|bold (wires?|lines?)/.test(t)) put('wires.width',3.5);
  if(/thin (wires?|lines?|connections?|edges?)|hairline|delicate (wires?|lines?)/.test(t)) put('wires.width',1);
  if(/dashed (wires?|lines?|connections?)/.test(t)) put('wires.dash','dashed'); else if(/dotted (wires?|lines?|connections?)/.test(t)) put('wires.dash','dotted');
  if(/arrows?|arrowheads?|directional/.test(t)) put('wires.arrows','end');
  if(/colou?r[- ]?coded (wires?|lines?)|colou?red (wires?|lines?)|wires? (match|use|take) (the )?(block|node)? ?colou?rs?/.test(t)) put('wires.colorBy','child');
  if(/no grid|without (a )?grid|plain background|blank (canvas|background)/.test(t)) put('canvas.grid','none');
  else if(/graph paper|grid lines|squared paper|lined grid/.test(t)) put('canvas.grid','lines');
  else if(/dot grid|dotted (grid|background)/.test(t)) put('canvas.grid','dots');
  if(!pre && /\b(dark|night|midnight)\b/.test(t)){ put('canvas.bg','#0f1a2b'); put('canvas.gridColor','#22334d'); put('nodes.base.fill','#18273d'); put('nodes.base.stroke','#3b5273'); put('nodes.base.text','#e8eef7'); put('nodes.base.iconColor','#9db0c8'); put('wires.color','#566b88'); }
  else if(!pre && /\b(light|bright|airy white)\b/.test(t) && !/lightweight|light blue|light green/.test(t)){ put('canvas.bg','#f7f9fb'); put('nodes.base.fill','#ffffff'); put('nodes.base.text','#16233a'); }
  if(/spacious|airy|roomy|loose|spread out|more space|breathing room/.test(t)){ put('layout.colGap',96); put('layout.rowGap',30); }
  else if(/\btight\b|compact|dense|cramped|close together|less space/.test(t) && !/tight curv/.test(t)){ put('layout.colGap',22); put('layout.rowGap',6); }
  if(/\bglow(ing)?\b/.test(t)) put('nodes.base.shadow','glow'); else if(/shadows?|drop shadow|raised|floating|elevated/.test(t)) put('nodes.base.shadow','soft'); else if(/\bflat\b/.test(t)) put('nodes.base.shadow','none');
  const cur = (k) => effLook().nodes[k === 'base' ? 'answer' : k];
  let colourUsed = false;
  for(const k of ['base',...NODE_TYPES]){
    const m = t.match(new RegExp('((?:[a-z-]+ ){0,4})(?:'+TYPE_PHRASE[k]+')(?= |$)')); if(!m) continue;
    const words = m[1].trim().split(' ').filter(Boolean); let scale = 1, tint = 0;
    words.forEach((w,i)=>{
      if(w==='dark'||w==='deep'||w==='darker') { tint = -1; return; } if(w==='light'||w==='pale'||w==='lighter') { tint = 1; return; }
      const nm = /^(diamond|hexagon|hexagonal|round|rounded|square|boxy|rectangular|sharp|pill|capsule|oval|ellipse|elliptical|circular|circle|tag|arrow|slanted|parallelogram)$/.exec(w);
      if(nm){ const v = nm[1]; put(`nodes.${k}.shape`, /diamond/.test(v) ? 'diamond' : /hex/.test(v) ? 'hexagon' : /^(round|rounded)$/.test(v) ? 'rounded' : /square|boxy|rect|sharp/.test(v) ? 'rect' : /pill|capsule/.test(v) ? 'pill' : /oval|ellip|circ/.test(v) ? 'ellipse' : /tag|arrow/.test(v) ? 'tag' : 'parallelogram'); if(v==='round') put(`nodes.${k}.radius`,20); return; }
      if(/^(huge|giant|enormous|massive)$/.test(w)) scale = 1.5; else if(/^(big|large|bigger|larger)$/.test(w)) scale = 1.3; else if(/^(small|tiny|little|smaller|compact)$/.test(w)) scale = .78;
      else if(/^(bold|heavy)$/.test(w)) put(`nodes.${k}.fontWeight`,800); else if(w==='italic') put(`nodes.${k}.italic`,true);
      else if(/^(dashed|dotted)$/.test(w)) put(`nodes.${k}.strokeStyle`,w);
      else if(/^(outlined|hollow|transparent|empty)$/.test(w)){ put(`nodes.${k}.fill`,'transparent'); put(`nodes.${k}.text`,'var(--ink)'); }
      else if(NAMED[w]){ let hex = NAMED[w]; if(tint<0) hex = mixHex(hex,'#000000',.38); else if(tint>0) hex = mixHex(hex,'#ffffff',.5); put(`nodes.${k}.fill`,hex); put(`nodes.${k}.text`,'auto'); colourUsed = true; }
    });
    if(scale!==1){ const c = cur(k); put(`nodes.${k}.width`,Math.round(c.width*scale/2)*2); put(`nodes.${k}.fontSize`,Math.max(10,Math.min(26,Math.round((c.fontSize+(scale>1 ? 2.5*scale-1.5 : -2))*2)/2))); put(`nodes.${k}.padY`,Math.round(c.padY*(scale>1 ? 1.25 : .8))); }
  }
  if(!colourUsed && !pre){
    const cw = Object.keys(NAMED).find(w=>new RegExp(' '+w+' (theme|look|palette|style|scheme|colou?rs?|vibe)').test(t) || new RegExp('(theme|palette|colou?rs?) (of |in )?'+w+' ').test(t));
    if(cw){ const hex = NAMED[cw]; put('canvas.bg',mixHex(hex,'#ffffff',.93)); put('nodes.base.fill',mixHex(hex,'#ffffff',.84)); put('nodes.base.stroke',hex); put('nodes.base.text','#16233a'); put('nodes.decision.fill',hex); put('nodes.decision.stroke',hex); put('nodes.decision.text','auto'); put('wires.color',hex); }
  }
  return {patch,reset};
}
function describePatch(p){
  const out = [], bits = (o,names) => names.filter(([k])=>o[k]!==undefined).map(([k,l])=>`${l} ${typeof o[k]==='object' ? 'changed' : o[k]}`);
  if(p.nodes) for(const k in p.nodes){
    const n = p.nodes[k], b = bits(n,[['shape','shape'],['fill','fill'],['stroke','outline'],['strokeWidth','outline width'],['width','width'],['fontSize','text size'],['radius','corners'],['shadow','shadow'],['pattern','pattern']]);
    if(b.length) out.push(`${k==='base' ? 'All blocks' : (LABEL[k] || k)+' blocks'}: ${b.join(', ')}`);
  }
  if(p.wires){ const b = bits(p.wires,[['style','style'],['curvature','curve'],['elbow','elbow'],['radius','corner radius'],['width','width'],['color','colour'],['dash','dash'],['arrows','arrows'],['colorBy','coloured by']]); if(p.wires.kinds) b.push('per-link colours changed'); if(b.length) out.push('Wires: '+b.join(', ')); }
  if(p.canvas){ const b = bits(p.canvas,[['bg','background'],['grid','grid'],['gridColor','grid colour'],['gridSize','grid size']]); if(b.length) out.push('Canvas: '+b.join(', ')); }
  if(p.layout){ const b = bits(p.layout,[['colGap','column gap'],['rowGap','row gap']]); if(b.length) out.push('Spacing: '+b.join(', ')); }
  if(p.moods) out.push('Mood colours: '+Object.keys(p.moods).join(', '));
  return out;
}
function lookPrompt(desc){
  return `You are the visual designer for a node-graph app. Turn the description into a JSON style patch.

CURRENT OVERRIDES (JSON, may be empty): ${JSON.stringify(LOOK)}

STYLE FIELDS (include only what you want to change):
{
 "nodes": { "base": N, "question": N, "answer": N, "emotion": N, "consequence": N, "decision": N, "loop": N, "fog": N },
 "wires": { "style": "default|bezier|straight|manhattan", "curvature": 0-1, "elbow": 0.1-0.9, "radius": 0-30, "width": 0.5-8, "color": C, "opacity": 0.1-1, "dash": "solid|dashed|dotted", "arrows": "none|end", "colorBy": "none|child|parent", "kinds": { "tree|related|flow|block|back": { "color": C, "width": n, "dash": "solid|dashed|dotted" } } },
 "canvas": { "bg": C, "grid": "dots|lines|none", "gridColor": C, "gridSize": 10-80 },
 "layout": { "colGap": 16-200, "rowGap": 2-80 },
 "moods": { "frustration|boredom|curiosity|delight|awe|confusion|tension": C }
}
N (a block style) = { "shape": "rounded|rect|pill|ellipse|diamond|hexagon|parallelogram|tag", "radius": 0-60, "fill": C or "mood", "stroke": C, "strokeWidth": 0-10, "strokeStyle": "solid|dashed|dotted|double|none", "text": C or "auto", "fontSize": 9-30, "fontWeight": 400|500|600|700|800, "italic": true|false, "width": 100-480, "padX": 0-60, "padY": 0-40, "shadow": "none|soft|hard|glow", "pattern": "none|hatch|dots", "opacity": 0.3-1, "icon": true|false, "bar": {"width": 0-14, "color": C} or null, "ring": {"width": 0-6, "color": C, "offset": 0-12} or null }
C is a hex colour such as "#3566D1".
"base" applies to every block type, and a type's own entry wins. Emotion blocks normally take their colour from the player mood, so leave the emotion fill alone unless the description asks for it.

DESCRIPTION: ${desc}

Rules: reply with ONLY a JSON object, no markdown. Keep text readable with strong contrast against its fill. Prefer a few well-chosen changes over changing everything. Do not invent fields.`;
}

/* the editor */
const LK = {tab:'presets',type:'base',pend:null,ctls:[],hist:[],built:false,busy:false};
const mk = (tag,props,...kids) => {
  const e = document.createElement(tag);
  if(props) for(const k in props){ const v = props[k]; if(k==='class') e.className = v; else if(k==='text') e.textContent = v; else if(k.startsWith('on')) e.addEventListener(k.slice(2),v); else if(v!==false && v!==null && v!==undefined) e.setAttribute(k,v===true ? '' : v); }
  kids.flat().forEach(c=>{ if(c===null || c===undefined || c===false) return; e.appendChild(typeof c==='string' ? document.createTextNode(c) : c); });
  return e;
};
const lkStyle = () => effLook().nodes[LK.type==='base' ? 'answer' : LK.type];
function lkCheckpoint(){ const j = JSON.stringify(LOOK); if(LK.hist[LK.hist.length-1]!==j){ LK.hist.push(j); if(LK.hist.length>40) LK.hist.shift(); } lkRefreshBar(); }
function lkUndo(){
  const cur = JSON.stringify(LOOK); let prev;
  while(LK.hist.length){ prev = LK.hist.pop(); if(prev!==cur) break; prev = undefined; }
  if(prev!==undefined){ LK.pend = null; LOOK = JSON.parse(prev); applyLook(); lkRefresh(); }
  lkRefreshBar();
}
function lkReset(){ lkCommitPending(); lkCheckpoint(); LOOK = {}; applyLook(); lkRefresh(); }
function lookChanged(){ applyLook(); lkRefresh(); }
function lkSetNode(field,val){
  const t = LK.type; LOOK.nodes = LOOK.nodes || {};
  const o = LOOK.nodes[t] = LOOK.nodes[t] || {};
  if(val===undefined) delete o[field]; else o[field] = val;
  if(!Object.keys(o).length) delete LOOK.nodes[t]; if(!Object.keys(LOOK.nodes).length) delete LOOK.nodes;
  lookChanged();
}
function lkSetGroup(group,field,val){
  LOOK[group] = LOOK[group] || {};
  if(val===undefined) delete LOOK[group][field]; else LOOK[group][field] = val;
  if(!Object.keys(LOOK[group]).length) delete LOOK[group];
  lookChanged();
}
function lkSetKind(kind,field,val){
  LOOK.wires = LOOK.wires || {}; LOOK.wires.kinds = LOOK.wires.kinds || {}; const o = LOOK.wires.kinds[kind] = LOOK.wires.kinds[kind] || {};
  if(val===undefined) delete o[field]; else o[field] = val;
  if(!Object.keys(o).length) delete LOOK.wires.kinds[kind]; if(!Object.keys(LOOK.wires.kinds).length) delete LOOK.wires.kinds; if(!Object.keys(LOOK.wires).length) delete LOOK.wires;
  lookChanged();
}
function toHex(c){
  const rgb = rgbOf(c); if(rgb) return '#'+rgb.map(x=>x.toString(16).padStart(2,'0')).join('');
  try{ const pr = document.createElement('span'); pr.style.color = c; pr.style.display = 'none'; document.body.appendChild(pr); const cs = getComputedStyle(pr).color; pr.remove(); const m = cs.match(/\d+/g); if(m) return '#'+m.slice(0,3).map(x=>(+x).toString(16).padStart(2,'0')).join(''); }catch(e){}
  return '#808080';
}
/* controls: each returns a row with .update() so the whole panel can be refreshed from the current look */
function lkReg(row){ LK.ctls.push(row); return row; }
function lkRange(label,field,get,set,o){
  const out = mk('output'), inp = mk('input',{type:'range',min:o.min,max:o.max,step:o.step,'data-f':field});
  const fmt = v => String(Math.round(v*100)/100)+(o.unit || '');
  inp.addEventListener('pointerdown',lkCheckpoint); inp.addEventListener('keydown',lkCheckpoint);
  inp.addEventListener('input',()=>{ set(+inp.value); out.textContent = fmt(+inp.value); });
  const row = mk('label',{class:'lk-row'},mk('span',{class:'lk-l',text:label}),inp,out);
  row.update = () => { const v = get(); if(document.activeElement!==inp) inp.value = v; out.textContent = fmt(+v); if(o.show) row.hidden = !o.show(); };
  return lkReg(row);
}
function lkSelect(label,field,options,get,set,show){
  const sel = mk('select',{'data-f':field}); options.forEach(o=>sel.appendChild(mk('option',{value:String(o),text:String(o)})));
  sel.addEventListener('focus',lkCheckpoint); sel.addEventListener('change',()=>set(sel.value));
  const row = mk('div',{class:'lk-row'},mk('span',{class:'lk-l',text:label}),sel);
  row.update = () => { sel.value = String(get()); if(show) row.hidden = !show(); };
  return lkReg(row);
}
function lkCheck(label,field,get,set){
  const cb = mk('input',{type:'checkbox','data-f':field}); cb.addEventListener('change',()=>{ lkCheckpoint(); set(cb.checked); });
  const row = mk('div',{class:'lk-row'},mk('span',{class:'lk-l',text:label}),mk('label',{class:'lk-chk'},cb));
  row.update = () => { cb.checked = !!get(); };
  return lkReg(row);
}
// a colour with an optional keyword switch ("match mood", "auto contrast") and a way back to the default
function lkColor(label,field,get,set,o){
  o = o || {};
  const col = mk('input',{type:'color','data-f':field}), kw = o.keyword ? mk('input',{type:'checkbox','data-f':field+'-kw'}) : null;
  col.addEventListener('pointerdown',lkCheckpoint); col.addEventListener('keydown',lkCheckpoint);
  col.addEventListener('input',()=>set(col.value));
  if(kw) kw.addEventListener('change',()=>{ lkCheckpoint(); set(kw.checked ? o.keyword : toHex(col.value)); });
  const back = mk('button',{type:'button',class:'lk-mini',text:'default',title:'Back to the default',onclick:()=>{ lkCheckpoint(); set(undefined); }});
  const row = mk('div',{class:'lk-row'},mk('span',{class:'lk-l',text:label}),mk('div',{class:'lk-col'},col,kw ? mk('label',{class:'lk-sub'},kw,o.keywordLabel) : null,o.noReset ? null : back));
  row.update = () => {
    const v = get(), isKw = o.keyword && v===o.keyword;
    if(kw) kw.checked = !!isKw; col.disabled = !!isKw; if(!isKw && document.activeElement!==col) col.value = toHex(v || '#808080');
    if(o.show) row.hidden = !o.show();
  };
  return lkReg(row);
}
function lkPreviewNode(){
  const t = LK.type==='base' ? 'question' : LK.type, node = {type:t,mood:'curiosity'};
  const blk = mk('div',{class:'blk t-'+t},mk('span',{class:'ico',html:null}),mk('span',{class:'txt',text:{question:'Would a bigger map help?',answer:'Landmarks are too far apart',emotion:'Bored crossing empty ground',consequence:'Players skip optional areas',decision:'Add a glide ability',loop:'Explore',fog:'Camera on long routes'}[t]}));
  blk.querySelector('.ico').innerHTML = ICONS[t];
  const box = mk('div',{class:'lk-pv',id:'lkPv'},blk);
  box.update = () => { const d = decorate(blk,t,node); blk.className = 'blk t-'+t+(d.poly ? ' sh-poly' : '')+(d.icon ? '' : ' no-ico'); blk.querySelector('.ico').innerHTML = ICONS[t]; box.style.setProperty('--pvw',d.width+'px'); box.querySelector('.txt').style.removeProperty('color'); };
  return lkReg(box);
}
function buildNodesPane(){
  const pane = mk('div',{class:'lk-pane',id:'lk-nodes',hidden:true});
  const seg = mk('div',{class:'seg',id:'lkType',role:'group','aria-label':'Block type'});
  [['base','All'],...NODE_TYPES.map(t=>[t,LABEL[t]])].forEach(([t,l])=>seg.appendChild(mk('button',{type:'button','data-t':t,'aria-pressed':t===LK.type ? 'true' : 'false',text:l,onclick:()=>{ LK.type = t; lkRefresh(); }})));
  pane.append(mk('div',{class:'field'},mk('span',{class:'lbl',text:'Which blocks'}),mk('div',{style:'display:flex;flex-wrap:wrap;gap:6px'},seg),mk('small',{text:'“All” sets a look for every block. A type’s own settings win over it.'})));
  pane.append(lkPreviewNode());
  const S_ = () => lkStyle(), isEmotionOrAll = () => LK.type==='emotion' || LK.type==='base';
  pane.append(
    lkSelect('Shape','shape',SHAPES,()=>S_().shape,v=>lkSetNode('shape',v)),
    lkRange('Corner radius','radius',()=>Array.isArray(S_().radius) ? S_().radius[1] : S_().radius,v=>lkSetNode('radius',v),{min:0,max:40,step:1,show:()=>S_().shape==='rounded'}),
    lkColor('Fill','fill',()=>S_().fill,v=>lkSetNode('fill',v),{keyword:'mood',keywordLabel:'Match mood',show:()=>true}),
    lkColor('Outline','stroke',()=>S_().stroke,v=>lkSetNode('stroke',v)),
    lkRange('Outline width','strokeWidth',()=>S_().strokeWidth,v=>lkSetNode('strokeWidth',v),{min:0,max:8,step:.5}),
    lkSelect('Outline style','strokeStyle',['solid','dashed','dotted','double','none'],()=>S_().strokeStyle,v=>lkSetNode('strokeStyle',v)),
    lkColor('Text','text',()=>S_().text,v=>lkSetNode('text',v),{keyword:'auto',keywordLabel:'Auto contrast'}),
    lkRange('Text size','fontSize',()=>S_().fontSize,v=>lkSetNode('fontSize',v),{min:10,max:26,step:.5,unit:'px'}),
    lkSelect('Text weight','fontWeight',[400,500,600,700,800],()=>S_().fontWeight,v=>lkSetNode('fontWeight',+v)),
    lkCheck('Italic','italic',()=>S_().italic,v=>lkSetNode('italic',v)),
    lkRange('Width','width',()=>S_().width,v=>lkSetNode('width',v),{min:110,max:460,step:2,unit:'px'}),
    lkRange('Side padding','padX',()=>S_().padX,v=>lkSetNode('padX',v),{min:2,max:40,step:1,unit:'px'}),
    lkRange('Vertical padding','padY',()=>S_().padY,v=>lkSetNode('padY',v),{min:2,max:30,step:1,unit:'px'}),
    lkSelect('Shadow','shadow',['none','soft','hard','glow'],()=>S_().shadow,v=>lkSetNode('shadow',v)),
    lkSelect('Pattern','pattern',['none','hatch','dots'],()=>S_().pattern,v=>lkSetNode('pattern',v)),
    lkRange('Opacity','opacity',()=>S_().opacity,v=>lkSetNode('opacity',v),{min:.3,max:1,step:.05}),
    lkCheck('Show icon','icon',()=>S_().icon!==false,v=>lkSetNode('icon',v)),
    lkRange('Side bar','barW',()=>S_().bar ? S_().bar.width : 0,v=>lkSetNode('bar',v>0 ? {width:v,color:(S_().bar && S_().bar.color) || 'var(--ink2)'} : null),{min:0,max:10,step:1,unit:'px'}),
    lkRange('Outer ring','ringW',()=>S_().ring ? S_().ring.width : 0,v=>lkSetNode('ring',v>0 ? {width:v,color:(S_().ring && S_().ring.color) || 'var(--line)',offset:(S_().ring && S_().ring.offset) || 3} : null),{min:0,max:5,step:.5,unit:'px'})
  );
  const moods = mk('div',{class:'field',id:'lkMoods'},mk('span',{class:'lbl',text:'Mood colours'}),mk('small',{text:'Colour is reserved for how the player feels. Change what each feeling looks like.'}));
  MOOD_KEYS.forEach(k=>{
    const c = mk('input',{type:'color','data-mood':k}); c.addEventListener('pointerdown',lkCheckpoint);
    c.addEventListener('input',()=>{ LOOK.moods = LOOK.moods || {}; LOOK.moods[k] = c.value; lookChanged(); });
    const back = mk('button',{type:'button',class:'lk-mini',text:'default',onclick:()=>{ lkCheckpoint(); if(LOOK.moods){ delete LOOK.moods[k]; if(!Object.keys(LOOK.moods).length) delete LOOK.moods; } lookChanged(); }});
    const row = mk('div',{class:'lk-row'},mk('span',{class:'lk-l',text:k[0].toUpperCase()+k.slice(1)}),mk('div',{class:'lk-col'},c,back));
    row.update = () => { if(document.activeElement!==c) c.value = toHex(moodColor(k)); };
    moods.appendChild(lkReg(row));
  });
  moods.update = () => { moods.hidden = !isEmotionOrAll(); };
  LK.ctls.push(moods); pane.append(moods);
  pane.append(mk('div',{class:'frow'},mk('button',{type:'button',class:'btn',id:'lkTypeReset',text:'Reset these blocks',onclick:()=>{ lkCheckpoint(); if(LOOK.nodes){ delete LOOK.nodes[LK.type]; if(!Object.keys(LOOK.nodes).length) delete LOOK.nodes; } lookChanged(); }})));
  return pane;
}
function wirePreview(){
  const svg = $('#lkWpv'); if(!svg) return; svg.textContent = '';
  const W = effLook().wires, mkr = (x,y,w,h) => { const r = document.createElementNS(SVGNS,'rect'); r.setAttribute('x',x); r.setAttribute('y',y); r.setAttribute('width',w); r.setAttribute('height',h); r.setAttribute('rx',5); return r; };
  const kids = [{y:10,type:'question'},{y:50,type:'emotion'},{y:92,type:'decision'}];
  svg.appendChild(mkr(14,48,86,34));
  kids.forEach(k=>svg.appendChild(mkr(220,k.y,86,30)));
  kids.forEach(k=>{
    const pth = document.createElementNS(SVGNS,'path'); pth.setAttribute('d',wirePath(100,65,220,k.y+15,1,1,W,36));
    applyWire(pth,'tree',{type:k.type,mood:'curiosity'},{type:'question'},false); svg.insertBefore(pth,svg.firstChild);
  });
}
function buildWiresPane(){
  const pane = mk('div',{class:'lk-pane',id:'lk-wires',hidden:true});
  const get = () => effLook().wires;
  const seg = mk('div',{class:'seg',id:'lkWStyle',role:'group','aria-label':'Wire style'});
  [['default','Default'],['bezier','Bezier'],['straight','Straight'],['manhattan','Manhattan']].forEach(([v,l])=>seg.appendChild(mk('button',{type:'button','data-v':v,'aria-pressed':'false',text:l,onclick:()=>{ lkCheckpoint(); lkSetGroup('wires','style',v); }})));
  pane.append(mk('div',{class:'field'},mk('span',{class:'lbl',text:'Wire style'}),seg,mk('small',{text:'Default is the original gentle curve. Bezier lets you tune the curve, Straight draws direct lines, and Manhattan routes with right angles.'})));
  const prev = document.createElementNS(SVGNS,'svg'); prev.setAttribute('id','lkWpv'); prev.setAttribute('class','lk-wpv'); prev.setAttribute('viewBox','0 0 320 132'); prev.setAttribute('preserveAspectRatio','xMidYMid meet');
  pane.append(prev);
  const w = (f) => (v) => lkSetGroup('wires',f,v);
  pane.append(
    lkRange('Curve','curvature',()=>get().curvature,w('curvature'),{min:0,max:1,step:.05,show:()=>get().style==='bezier'}),
    lkRange('Elbow position','elbow',()=>get().elbow,w('elbow'),{min:.1,max:.9,step:.05,show:()=>get().style==='manhattan'}),
    lkRange('Corner radius','wradius',()=>get().radius,w('radius'),{min:0,max:30,step:1,unit:'px',show:()=>get().style==='manhattan'}),
    lkRange('Width','wwidth',()=>get().width || 1.7,w('width'),{min:.5,max:8,step:.1,unit:'px'}),
    lkColor('Colour','wcolor',()=>get().color || 'var(--edge)',w('color')),
    lkRange('Opacity','wopacity',()=>get().opacity || 1,w('opacity'),{min:.1,max:1,step:.05}),
    lkSelect('Dash','wdash',['solid','dashed','dotted'],()=>get().dash || 'solid',w('dash')),
    lkSelect('Arrowheads','warrows',['none','end'],()=>get().arrows,w('arrows')),
    lkSelect('Colour by block','wcolorBy',['none','child','parent'],()=>get().colorBy,w('colorBy'))
  );
  const kinds = mk('div',{class:'field'},mk('span',{class:'lbl',text:'Other kinds of link'}),mk('small',{text:'Related links, loop flow, blocking and trace-back wires keep their own look. Override them here.'}));
  WIRE_KINDS.filter(k=>k!=='tree').forEach(k=>{
    kinds.append(
      lkColor(KIND_LABEL[k],'k-'+k+'-color',()=>(get().kinds[k] && get().kinds[k].color) || (k==='block' ? 'var(--focus)' : 'var(--ink2)'),v=>lkSetKind(k,'color',v)),
      lkSelect('','k-'+k+'-dash',['solid','dashed','dotted'],()=>(get().kinds[k] && get().kinds[k].dash) || (k==='flow' ? 'dashed' : k==='block' ? 'dashed' : 'dotted'),v=>lkSetKind(k,'dash',v))
    );
  });
  pane.append(kinds);
  const upd = mk('div',{hidden:true}); upd.update = () => { seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===get().style))); wirePreview(); };
  LK.ctls.push(upd); pane.append(upd);
  return pane;
}
function buildCanvasPane(){
  const pane = mk('div',{class:'lk-pane',id:'lk-canvas',hidden:true}), C = () => effLook().canvas, Lt = () => effLook().layout;
  const seg = mk('div',{class:'seg',id:'lkGrid',role:'group','aria-label':'Grid'});
  [['dots','Dots'],['lines','Lines'],['none','None']].forEach(([v,l])=>seg.appendChild(mk('button',{type:'button','data-v':v,'aria-pressed':'false',text:l,onclick:()=>{ lkCheckpoint(); lkSetGroup('canvas','grid',v); }})));
  pane.append(
    lkColor('Background','cbg',()=>C().bg || 'var(--bg)',v=>lkSetGroup('canvas','bg',v)),
    mk('div',{class:'field'},mk('span',{class:'lbl',text:'Grid'}),seg),
    lkColor('Grid colour','cgrid',()=>C().gridColor || 'var(--dot)',v=>lkSetGroup('canvas','gridColor',v)),
    lkRange('Grid size','cgridSize',()=>C().gridSize,v=>lkSetGroup('canvas','gridSize',v),{min:10,max:80,step:2,unit:'px'}),
    lkRange('Column gap','colGap',()=>Lt().colGap,v=>lkSetGroup('layout','colGap',v),{min:16,max:200,step:2,unit:'px'}),
    lkRange('Row gap','rowGap',()=>Lt().rowGap,v=>lkSetGroup('layout','rowGap',v),{min:2,max:80,step:1,unit:'px'})
  );
  const upd = mk('div',{hidden:true}); upd.update = () => seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===C().grid)));
  LK.ctls.push(upd); pane.append(upd);
  return pane;
}
function buildPresetsPane(){
  const pane = mk('div',{class:'lk-pane',id:'lk-presets'}), grid = mk('div',{class:'lk-presets'});
  PRESETS.forEach(pr=>grid.appendChild(mk('button',{type:'button',class:'lk-preset','data-id':pr.id,onclick:()=>{ lkCommitPending(); lkCheckpoint(); LOOK = sanitizeLook(JSON.parse(JSON.stringify(pr.patch))); applyLook(); lkRefresh(); }},mk('b',{text:pr.name}),mk('small',{text:pr.desc}),mk('div',{class:'lk-sw'},pr.sw.map(c=>mk('i',{style:'background:'+c}))))));
  pane.append(grid,mk('p',{class:'small',style:'margin-top:14px'},'Presets replace your current look. Undo brings it back.'));
  return pane;
}
function lkCommitPending(){ if(LK.pend){ LK.pend = null; saveLook(); const r = $('#lkResult'); if(r) r.hidden = true; } }
function lkPreviewPatch(patch,reset,note){
  lkCheckpoint(); LK.pend = {before:JSON.stringify(LOOK)};
  LOOK = reset ? sanitizeLook(patch) : sanitizeLook(deepMerge(LOOK,patch));
  applyLook({noSave:true}); lkRefresh();
  const list = $('#lkChanges'); list.textContent = '';
  const lines = describePatch(patch); if(reset) lines.unshift('Back to the default look');
  (lines.length ? lines : ['Nothing visible changed.']).forEach(l=>list.appendChild(mk('li',{text:l})));
  $('#lkNote').textContent = note || ''; $('#lkResult').hidden = false;
}
async function lkGenerate(){
  const desc = $('#lkDesc').value.trim(); if(!desc || LK.busy) return;
  lkCommitPending(); LK.busy = true; $('#lkGo').disabled = true; $('#lkStatus').textContent = 'Designing…';
  let patch = null, reset = false, note = '';
  const real = aiAvailable() && activeProvider()!=='demo';
  if(real){
    try{ patch = sanitizeLook(parseObj((await callAI(lookPrompt(desc),{temperature:.6})).text)); if(!Object.keys(patch).length){ patch = null; note = 'The AI didn’t return anything usable, so the built-in interpreter handled it.'; } }
    catch(e){ patch = null; note = 'The AI’s reply couldn’t be used, so the built-in interpreter handled it.'; }
  } else note = 'Interpreted by the built-in keyword engine. Connect an AI for freer descriptions.';
  if(!patch){ const r = lookFromText(desc); patch = sanitizeLook(r.patch); reset = r.reset; }
  LK.busy = false; $('#lkGo').disabled = false; $('#lkStatus').textContent = '';
  if(!Object.keys(patch).length && !reset){ $('#lkStatus').textContent = 'I couldn’t find anything to change. Try words like “blueprint”, “straight wires”, “huge diamond decisions”, “pastel” or “dark”.'; return; }
  lkPreviewPatch(patch,reset,note);
}
function buildDescribePane(){
  const pane = mk('div',{class:'lk-pane',id:'lk-describe',hidden:true});
  pane.append(
    mk('p',{class:'small',text:'Describe the look you want in your own words. You can try it, then keep it or put it back.'}),
    mk('textarea',{id:'lkDesc',class:'area',rows:3,maxlength:'400',placeholder:'A calm blueprint look with straight wires and huge diamond decisions'}),
    mk('div',{class:'chips',style:'margin-top:8px',id:'lkChips'},['Soft pastel with curvy wires','Dark and spacious, thin straight wires','Big red decisions, small grey answers','Neon with arrows and glowing outlines'].map(t=>mk('button',{type:'button',class:'chip',text:t,onclick:()=>{ $('#lkDesc').value = t; lkGenerate(); }}))),
    mk('div',{class:'mrow'},mk('button',{type:'button',class:'btn primary',id:'lkGo',text:'Design it',onclick:lkGenerate}),mk('span',{class:'small',id:'lkStatus','aria-live':'polite'})),
    mk('div',{class:'lk-chg',id:'lkResult',hidden:true},mk('b',{text:'What changed'}),mk('ul',{id:'lkChanges'}),mk('div',{class:'small',id:'lkNote'}),mk('div',{class:'frow',style:'margin-top:10px'},mk('button',{type:'button',class:'btn primary',id:'lkKeep',text:'Keep it',onclick:lkCommitPending}),mk('button',{type:'button',class:'btn',id:'lkRevert',text:'Put it back',onclick:()=>{ if(!LK.pend) return; LOOK = JSON.parse(LK.pend.before); LK.pend = null; $('#lkResult').hidden = true; applyLook(); lkRefresh(); }})))
  );
  return pane;
}
const countLeaves = (o) => isObj(o) || Array.isArray(o) ? Object.values(o).reduce((a,v)=>a+countLeaves(v),0) : 1;
function buildTextPane(){
  const pane = mk('div',{class:'lk-pane',id:'lk-text',hidden:true});
  const err = mk('div',{class:'lk-err',id:'lkTextErr','aria-live':'polite'});
  pane.append(
    mk('p',{class:'small',text:'This is everything you have changed, as text. Edit it, paste one from a friend, or copy yours. Unknown or out-of-range values are ignored.'}),
    mk('textarea',{id:'lkText',spellcheck:'false'}),err,
    mk('div',{class:'frow',style:'margin-top:10px'},
      mk('button',{type:'button',class:'btn primary',id:'lkApply',text:'Apply',onclick:()=>{
        let obj; try{ obj = JSON.parse($('#lkText').value || '{}'); }catch(e){ err.className = 'lk-err'; err.textContent = 'That isn’t valid JSON: '+e.message; return; }
        if(!isObj(obj)){ err.className = 'lk-err'; err.textContent = 'The look must be a JSON object, like { "wires": { "style": "straight" } }.'; return; }
        const clean = sanitizeLook(obj), dropped = countLeaves(obj)-countLeaves(clean);
        lkCommitPending(); lkCheckpoint(); LOOK = clean; applyLook(); lkRefresh();
        err.className = 'lk-err ok'; err.textContent = dropped>0 ? `Applied. ${dropped} value${dropped===1 ? ' was' : 's were'} ignored because they were unknown or out of range.` : 'Applied.';
      }}),
      mk('button',{type:'button',class:'btn',id:'lkFormat',text:'Reload from current look',onclick:()=>{ $('#lkText').value = JSON.stringify(LOOK,null,2); err.textContent = ''; }}),
      mk('button',{type:'button',class:'btn',id:'lkCopy',text:'Copy',onclick:async()=>{ try{ await navigator.clipboard.writeText($('#lkText').value); err.className = 'lk-err ok'; err.textContent = 'Copied.'; }catch(e){ err.className = 'lk-err'; err.textContent = 'Select the text and copy it.'; } }})),
    mk('details',{class:'card',style:'margin-top:14px'},mk('summary',{text:'What you can set'}),mk('pre',{id:'lkSheet',style:'white-space:pre-wrap;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;color:var(--ink2);margin:10px 0 0',text:
`nodes.base | question | answer | emotion | consequence | decision | loop | fog:
  shape: ${SHAPES.join(' | ')}
  radius 0-60 (or four numbers)   fill, stroke, text, iconColor: "#rrggbb"
  fill "mood" and text "auto" follow the player mood and contrast
  strokeWidth 0-10   strokeStyle: solid | dashed | dotted | double | none
  fontSize 9-30   fontWeight 400-900   italic   icon
  width 100-480   padX 0-60   padY 0-40
  shadow: none | soft | hard | glow   pattern: none | hatch | dots   opacity 0.3-1
  bar: { width, color } or null   ring: { width, color, offset } or null
wires: style ${WIRE_STYLES.join(' | ')}, curvature 0-1, elbow 0.1-0.9, radius 0-30,
  width, color, opacity, dash, arrows none | end, colorBy none | child | parent,
  kinds.${WIRE_KINDS.join(' | ')}: { color, width, dash }
canvas: bg, grid dots | lines | none, gridColor, gridSize 10-80
layout: colGap 16-200, rowGap 2-80
moods: ${MOOD_KEYS.join(' | ')}: "#rrggbb"`}))
  );
  const upd = mk('div',{hidden:true}); upd.update = () => { const ta = $('#lkText'); if(ta && document.activeElement!==ta) ta.value = JSON.stringify(LOOK,null,2); };
  LK.ctls.push(upd); pane.append(upd);
  return pane;
}
function lkRefreshBar(){ const u = $('#lkUndo'); if(u) u.disabled = !LK.hist.some(h=>h!==JSON.stringify(LOOK)); }
function lkRefresh(){
  LK.ctls.forEach(c=>{ if(c.update) c.update(); });
  const seg = $('#lkType'); if(seg) seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.t===LK.type)));
  const tr = $('#lkTypeReset'); if(tr) tr.hidden = !(LOOK.nodes && LOOK.nodes[LK.type]);
  lkRefreshBar();
}
function lkShowTab(t){
  LK.tab = t;
  document.querySelectorAll('#lkTabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lk===t)));
  ['presets','describe','nodes','wires','canvas','text'].forEach(k=>{ const p = document.getElementById('lk-'+k); if(p) p.hidden = k!==t; });
  lkRefresh();
}
function ensureLookUI(){
  if(LK.built){ lkRefresh(); return; }
  LK.built = true; const root = $('#lookRoot'); root.textContent = '';
  const tabs = mk('div',{class:'seg big',id:'lkTabs',role:'group','aria-label':'Look sections',style:'flex-wrap:wrap'});
  [['presets','Presets'],['describe','Describe'],['nodes','Blocks'],['wires','Wires'],['canvas','Canvas'],['text','Text']].forEach(([k,l])=>tabs.appendChild(mk('button',{type:'button','data-lk':k,'aria-pressed':'false',text:l,onclick:()=>lkShowTab(k)})));
  root.append(
    mk('div',{class:'lk-bar'},mk('h4',{text:'Look'}),mk('div',{class:'frow'},mk('button',{type:'button',class:'btn',id:'lkUndo',text:'Undo',onclick:lkUndo,disabled:true}),mk('button',{type:'button',class:'btn',id:'lkReset',text:'Reset look',onclick:lkReset}))),
    tabs,buildPresetsPane(),buildDescribePane(),buildNodesPane(),buildWiresPane(),buildCanvasPane(),buildTextPane()
  );
  lkShowTab(LK.tab);
}

