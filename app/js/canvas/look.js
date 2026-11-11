'use strict';
/* ================= look: shapes, colours, sizes and wires ================= */
const LOOK_KEY = 'cascade-look-v1';
const SVGNS = 'http://www.w3.org/2000/svg';
const NODE_TYPES = ['question','answer','emotion','consequence','decision','loop','fog'];
const SHAPES = ['rounded','rect','pill','ellipse','diamond','hexagon','parallelogram','tag'];
const POLY = {diamond:'50,0 100,50 50,100 0,50',hexagon:'10,0 90,0 100,50 90,100 10,100 0,50',parallelogram:'12,0 100,0 88,100 0,100',tag:'0,0 90,0 100,50 90,100 0,100'};
const SHAPE_PAD = {diamond:[40,30],hexagon:[22,9],parallelogram:[24,8],tag:[10,8],ellipse:[20,10]};   // extra padding so text stays inside the shape
const WIRE_STYLES = ['default','bezier','straight','manhattan'];
const WIRE_KINDS = ['tree','related','flow','block','back'];
const KIND_LABEL = {tree:'Parent to child',related:'Related links',flow:'Loop flow',block:'Blocking',back:'Trace back'};
const DASH = {solid:'none',dashed:'7 6',dotted:'1 6'};
const SAFE_TOKENS = ['--ink','--ink2','--paper','--paper2','--line','--bg','--edge','--focus','--dot'];
const NAMED = {red:'#d94a2b',orange:'#f08a24',yellow:'#f2c230',gold:'#e0a800',green:'#2e9e5b',lime:'#8bc34a',mint:'#9be3c4',teal:'#19877a',cyan:'#1fb5c9',blue:'#3566d1',navy:'#0b2545',indigo:'#4b3fb5',purple:'#7653b4',violet:'#8a63d2',lavender:'#c9b8ee',pink:'#e879a8',magenta:'#c2218b',coral:'#f27d6a',salmon:'#f4978e',peach:'#fbc8a6',brown:'#8b5a2b',beige:'#e8dcc5',ivory:'#fbf7ea',maroon:'#7a1f2b',olive:'#7a8031',crimson:'#c0183e',black:'#111111',white:'#ffffff',gray:'#8a94a3',grey:'#8a94a3',silver:'#c0c6cf'};
const DEF_NODE = {shape:'rounded',radius:10,fill:'var(--paper)',stroke:'var(--line)',strokeWidth:1,strokeStyle:'solid',text:'var(--ink)',iconColor:'var(--ink2)',fontSize:13.5,fontWeight:500,italic:false,icon:true,width:224,padX:12,padY:9,bar:null,ring:null,pattern:'none',shadow:'none',opacity:1};
const DEF_LOOK = {
  nodes:{
    question:{stroke:'var(--ink)',strokeWidth:2,radius:[3,15,15,15]},
    answer:{},
    emotion:{fill:'mood',stroke:'transparent',shape:'pill',padX:15,padY:8,text:'auto',iconColor:'text'},
    consequence:{fill:'var(--paper2)',radius:[3,10,10,3],bar:{width:5,color:'var(--ink2)'}},
    decision:{fill:'var(--ink)',stroke:'var(--ink)',text:'var(--bg)',iconColor:'text'},
    loop:{stroke:'var(--ink)',strokeWidth:2.5,radius:14,fontWeight:800,fontSize:15,width:196,ring:{width:1.5,color:'var(--line)',offset:3}},
    fog:{stroke:'var(--ink2)',strokeStyle:'dotted',strokeWidth:1.5,radius:16,italic:true,text:'var(--ink2)',fill:'var(--paper2)',pattern:'hatch'}
  },
  wires:{style:'default',curvature:.5,elbow:.5,radius:10,width:null,color:null,opacity:null,dash:null,arrows:'none',colorBy:'none',kinds:{tree:{},related:{},flow:{},block:{},back:{}}},
  canvas:{bg:null,grid:'dots',gridColor:null,gridSize:24},
  layout:{colGap:44,rowGap:14}
};
const isObj = (v) => !!v && typeof v==='object' && !Array.isArray(v);
function deepMerge(a,b){
  const out = Array.isArray(a) ? a.slice() : Object.assign({},a);
  for(const k in b){ out[k] = isObj(b[k]) && isObj(out[k]) ? deepMerge(out[k],b[k]) : b[k]; }
  return out;
}
function cleanColor(v){
  if(typeof v!=='string') return null; v = v.trim().toLowerCase();
  if(NAMED[v]) return NAMED[v];
  if(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(v) || v==='transparent') return v;
  const m = v.match(/^var\((--[a-z0-9-]+)\)$/); if(m && SAFE_TOKENS.includes(m[1])) return v;
  if(/^(rgb|rgba|hsl|hsla)\(\s*[-0-9.%,\s\/]+\)$/.test(v)) return v;
  return null;
}
function sanitizeLook(o){
  const out = {}; if(!isObj(o)) return out;
  const num = (v,a,b) => { v = +v; return isFinite(v) ? Math.min(b,Math.max(a,v)) : undefined; };
  const en = (v,list) => list.includes(v) ? v : undefined;
  const col = (v,extra) => (extra && extra.includes(v)) ? v : (cleanColor(v) || undefined);
  const set = (r,k,v) => { if(v!==undefined) r[k] = v; };
  const node = (s) => {
    const r = {}; if(!isObj(s)) return r;
    set(r,'shape',en(s.shape,SHAPES));
    if(Array.isArray(s.radius) && s.radius.length===4){ const a = s.radius.map(x=>num(x,0,60)); if(a.every(x=>x!==undefined)) r.radius = a; } else set(r,'radius',num(s.radius,0,60));
    set(r,'fill',col(s.fill,['mood'])); set(r,'stroke',col(s.stroke)); set(r,'strokeWidth',num(s.strokeWidth,0,10));
    set(r,'strokeStyle',en(s.strokeStyle,['solid','dashed','dotted','double','none']));
    set(r,'text',col(s.text,['auto'])); set(r,'iconColor',col(s.iconColor,['text']));
    set(r,'fontSize',num(s.fontSize,9,30));
    if(s.fontWeight!==undefined && [300,400,500,600,700,800,900].includes(+s.fontWeight)) r.fontWeight = +s.fontWeight;
    if(typeof s.italic==='boolean') r.italic = s.italic; if(typeof s.icon==='boolean') r.icon = s.icon;
    const w = num(s.width,100,480); if(w!==undefined) r.width = Math.round(w);
    set(r,'padX',num(s.padX,0,60)); set(r,'padY',num(s.padY,0,40));
    if(s.bar===null) r.bar = null; else if(isObj(s.bar)){ const bw = num(s.bar.width,0,14), bc = cleanColor(s.bar.color); if(bw!==undefined && bc) r.bar = {width:bw,color:bc}; }
    if(s.ring===null) r.ring = null; else if(isObj(s.ring)){ const rw = num(s.ring.width,0,6), rc = cleanColor(s.ring.color), ro = num(s.ring.offset,0,12); if(rw!==undefined && rc) r.ring = {width:rw,color:rc,offset:ro===undefined ? 3 : ro}; }
    set(r,'pattern',en(s.pattern,['none','hatch','dots'])); set(r,'shadow',en(s.shadow,['none','soft','hard','glow'])); set(r,'opacity',num(s.opacity,.3,1));
    return r;
  };
  if(isObj(o.nodes)){ const n = {}; for(const k of ['base',...NODE_TYPES]){ const c = node(o.nodes[k]); if(Object.keys(c).length) n[k] = c; } if(Object.keys(n).length) out.nodes = n; }
  if(isObj(o.wires)){
    const w = o.wires, r = {};
    set(r,'style',en(w.style,WIRE_STYLES)); set(r,'curvature',num(w.curvature,0,1)); set(r,'elbow',num(w.elbow,.1,.9)); set(r,'radius',num(w.radius,0,30));
    if(w.width===null) r.width = null; else set(r,'width',num(w.width,.5,10));
    if(w.color===null) r.color = null; else set(r,'color',col(w.color));
    if(w.opacity===null) r.opacity = null; else set(r,'opacity',num(w.opacity,.1,1));
    if(w.dash===null) r.dash = null; else set(r,'dash',en(w.dash,['solid','dashed','dotted']));
    set(r,'arrows',en(w.arrows,['none','end'])); set(r,'colorBy',en(w.colorBy,['none','child','parent']));
    if(isObj(w.kinds)){
      const ks = {};
      for(const k of WIRE_KINDS) if(isObj(w.kinds[k])){ const kk = {}, s2 = w.kinds[k]; set(kk,'color',col(s2.color)); set(kk,'width',num(s2.width,.5,10)); set(kk,'dash',en(s2.dash,['solid','dashed','dotted'])); set(kk,'opacity',num(s2.opacity,.1,1)); if(Object.keys(kk).length) ks[k] = kk; }
      if(Object.keys(ks).length) r.kinds = ks;
    }
    if(Object.keys(r).length) out.wires = r;
  }
  if(isObj(o.canvas)){
    const c = o.canvas, r = {};
    if(c.bg===null) r.bg = null; else set(r,'bg',col(c.bg)); set(r,'grid',en(c.grid,['dots','lines','none']));
    if(c.gridColor===null) r.gridColor = null; else set(r,'gridColor',col(c.gridColor)); set(r,'gridSize',num(c.gridSize,10,80));
    if(Object.keys(r).length) out.canvas = r;
  }
  if(isObj(o.layout)){ const r = {}; set(r,'colGap',num(o.layout.colGap,16,200)); set(r,'rowGap',num(o.layout.rowGap,2,80)); if(Object.keys(r).length) out.layout = r; }
  if(isObj(o.moods)){ const r = {}; for(const k of MOOD_KEYS){ const c = cleanColor(o.moods[k]); if(c) r[k] = c; } if(Object.keys(r).length) out.moods = r; }
  return out;
}
function loadLook(){
  try{
    const raw = (LOCAL && window.__SETTINGS__ && window.__SETTINGS__.look) || JSON.parse(localStorage.getItem(LOOK_KEY) || 'null');
    return sanitizeLook(raw);
  }catch(e){ return {}; }
}
let LOOK = loadLook();      // only what the user changed; the defaults above reproduce the original look
let LOOKVER = 0, EFF = null;
function effLook(){
  if(EFF && EFF.v===LOOKVER) return EFF;
  const N = LOOK.nodes || {}, base = N.base || {};
  EFF = {v:LOOKVER,nodes:{},wires:deepMerge(DEF_LOOK.wires,LOOK.wires || {}),canvas:Object.assign({},DEF_LOOK.canvas,LOOK.canvas || {}),layout:Object.assign({},DEF_LOOK.layout,LOOK.layout || {}),moods:Object.assign({},LOOK.moods || {})};
  for(const t of NODE_TYPES){
    const b = Object.assign({},base); if(t==='emotion'){ delete b.fill; delete b.text; }   // emotions keep their mood colour unless set on emotion itself
    EFF.nodes[t] = Object.assign({},DEF_NODE,DEF_LOOK.nodes[t] || {},b,N[t] || {});
  }
  return EFF;
}
const nodeW = (type) => (effLook().nodes[type] || effLook().nodes.answer).width;
function rgbOf(c){
  if(!c) return null; c = String(c).trim().toLowerCase(); let m;
  if((m = c.match(/^#([0-9a-f]{3,8})$/))){ let h = m[1]; if(h.length<6) h = h.slice(0,3).split('').map(x=>x+x).join(''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
  if((m = c.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/))) return [+m[1],+m[2],+m[3]];
  return null;
}
const lum = ([r,g,b]) => { const f = v => { v /= 255; return v<=.03928 ? v/12.92 : Math.pow((v+.055)/1.055,2.4); }; return .2126*f(r)+.7152*f(g)+.0722*f(b); };
function contrastText(fill){
  if(fill==='var(--ink)') return 'var(--bg)';
  if(/^var\(--(paper|paper2|bg|line)\)$/.test(fill) || fill==='transparent') return 'var(--ink)';
  const rgb = rgbOf(fill); if(!rgb) return 'var(--ink)';
  return lum(rgb)>.42 ? '#142033' : '#ffffff';
}
const moodColor = (m) => effLook().moods[m] || (MOODS[m] || MOODS.curiosity).bg;
const moodFg = (m) => effLook().moods[m] ? contrastText(effLook().moods[m]) : (MOODS[m] || MOODS.curiosity).fg;
// CSS variables, shape and size for one block type (n is the node, for its mood)
function nodeVars(type,n,o){
  o = o || {};
  const st = effLook().nodes[type] || effLook().nodes.answer, mood = (n && n.mood) || 'curiosity', tile = !!o.tile;
  const fromMood = st.fill==='mood';
  const fill = fromMood ? (tile ? 'var(--line)' : moodColor(mood)) : st.fill;
  const fg = st.text==='auto' ? (fromMood && !tile ? moodFg(mood) : contrastText(fill)) : st.text;
  const noStroke = st.strokeStyle==='none' || !st.strokeWidth;
  const poly = !!POLY[st.shape], pad = SHAPE_PAD[st.shape] || [0,0];
  const radius = (poly || st.shape==='rect') ? '0' : st.shape==='pill' ? '999px' : st.shape==='ellipse' ? '50%' : (Array.isArray(st.radius) ? st.radius.map(r=>r+'px').join(' ') : st.radius+'px');
  const accent = (noStroke || st.stroke==='transparent') ? fill : st.stroke, shadows = [];
  if(st.shadow==='soft') shadows.push('0 6px 16px -6px rgba(0,0,0,.35)'); else if(st.shadow==='hard') shadows.push('4px 4px 0 rgba(0,0,0,.28)'); else if(st.shadow==='glow') shadows.push(`0 0 14px color-mix(in srgb,${accent} 65%,transparent)`);
  if(st.bar && st.bar.width>0 && !poly) shadows.push(`inset ${st.bar.width}px 0 0 ${st.bar.color}`);
  const v = {
    '--nf':fill,'--ns':noStroke ? 'transparent' : st.stroke,'--nsw':(noStroke ? 0 : st.strokeWidth)+'px','--nss':st.strokeStyle==='none' ? 'solid' : st.strokeStyle,
    '--nr':radius,'--nfg':fg,'--nic':st.iconColor==='text' ? 'inherit' : st.iconColor,'--nsg':accent,
    '--nsd':st.strokeStyle==='dashed' ? '7 5' : st.strokeStyle==='dotted' ? '1.5 5' : 'none',
    '--npat':st.pattern==='hatch' ? 'repeating-linear-gradient(135deg,transparent 0 6px,color-mix(in srgb,var(--ns) 18%,transparent) 6px 7px)' : st.pattern==='dots' ? 'radial-gradient(circle,color-mix(in srgb,var(--ns) 45%,transparent) 1px,transparent 1.7px)' : 'none',
    '--npsz':st.pattern==='dots' ? '9px 9px' : 'auto','--nsh':shadows.length ? shadows.join(',') : 'none',
    '--nrg':(st.ring && st.ring.width>0 && !poly) ? `${st.ring.width}px solid ${st.ring.color}` : '0','--nro':(st.ring ? st.ring.offset : 0)+'px',
    '--nop':String(st.opacity),'--nfi':st.italic ? 'italic' : 'normal'
  };
  if(!tile){ v['--nfs'] = st.fontSize+'px'; v['--nfw'] = String(st.fontWeight); v['--npx'] = (st.padX+pad[0])+'px'; v['--npy'] = (st.padY+pad[1])+'px'; }
  else if(poly || st.shape==='ellipse'){ v['--npx'] = (12+pad[0]*.6)+'px'; v['--npy'] = (9+pad[1]*.5)+'px'; }
  return {vars:v,shape:st.shape,poly,icon:st.icon!==false,width:st.width};
}
function decorate(blk,type,n,o){
  const d = nodeVars(type,n,o);
  for(const k in d.vars) blk.style.setProperty(k,d.vars[k]);
  blk.classList.toggle('sh-poly',d.poly); blk.classList.toggle('no-ico',!d.icon);
  let svg = Array.from(blk.children).find(c=>c.classList && c.classList.contains('shp'));
  if(!svg){
    svg = document.createElementNS(SVGNS,'svg'); svg.setAttribute('class','shp'); svg.setAttribute('viewBox','0 0 100 100'); svg.setAttribute('preserveAspectRatio','none'); svg.setAttribute('aria-hidden','true');
    const pg = document.createElementNS(SVGNS,'polygon'); svg.appendChild(pg); blk.insertBefore(svg,blk.firstChild);
  }
  svg.firstChild.setAttribute('points',POLY[d.shape] || '');
  return d;
}
function applyTiles(){ document.querySelectorAll('.tile').forEach(t=>decorate(t,t.dataset.type,null,{tile:true})); }
function renderLegend(){ $('#legend').innerHTML = MOOD_KEYS.map(k=>`<li><i style="--c:${moodColor(k)}"></i>${k[0].toUpperCase()+k.slice(1)}</li>`).join(''); }
function applyCanvasLook(){
  const C = effLook().canvas, g = C.gridColor || 'var(--dot)';
  stage.style.backgroundColor = C.bg || '';
  stage.style.backgroundImage = C.grid==='none' ? 'none' : C.grid==='lines' ? `linear-gradient(${g} 1px,transparent 1px),linear-gradient(90deg,${g} 1px,transparent 1px)` : `radial-gradient(circle,${g} 1.2px,transparent 1.5px)`;
}
let lookTimer = 0;
function saveLook(){
  const raw = JSON.stringify(LOOK);
  try{ localStorage.setItem(LOOK_KEY,raw); }catch(e){}
  if(LOCAL){ clearTimeout(lookTimer); lookTimer = setTimeout(()=>{ fetch('/api/settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({look:LOOK})}).catch(()=>{}); },450); }
}
function applyLook(opts){
  opts = opts || {};
  LOOKVER++; EFF = null; effLook();
  applyCanvasLook(); applyTiles(); renderLegend();
  if(Object.keys(R).length){ layout(false); }
  applyView(); kick();
  if(!opts.noSave) saveLook();
}

/* wires: default, bezier, straight and manhattan (right angles) */
function roundedPath(pts,r){
  const q = pts.filter((p,i)=>i===0 || p[0]!==pts[i-1][0] || p[1]!==pts[i-1][1]);
  if(q.length<2) return `M${pts[0][0]} ${pts[0][1]}`;
  if(r<=.5) return 'M'+q.map(p=>p[0]+' '+p[1]).join('L');
  let d = `M${q[0][0]} ${q[0][1]}`;
  for(let i=1; i<q.length-1; i++){
    const p0 = q[i-1], p1 = q[i], p2 = q[i+1];
    const l1 = Math.hypot(p1[0]-p0[0],p1[1]-p0[1]), l2 = Math.hypot(p2[0]-p1[0],p2[1]-p1[1]), rr = Math.min(r,l1/2,l2/2);
    if(rr<.5){ d += `L${p1[0]} ${p1[1]}`; continue; }
    const a = [p1[0]+(p0[0]-p1[0])/l1*rr,p1[1]+(p0[1]-p1[1])/l1*rr], b = [p1[0]+(p2[0]-p1[0])/l2*rr,p1[1]+(p2[1]-p1[1])/l2*rr];
    d += `L${a[0]} ${a[1]}Q${p1[0]} ${p1[1]} ${b[0]} ${b[1]}`;
  }
  const e = q[q.length-1]; return d+`L${e[0]} ${e[1]}`;
}
function manhattan(x1,y1,x2,y2,d1,d2,elbow,r){
  const stub = 18; let pts;
  if(d1===d2){
    const dist = (x2-x1)*d1;
    if(dist>=2*stub){ const xm = x1+d1*dist*elbow; pts = [[x1,y1],[xm,y1],[xm,y2],[x2,y2]]; }
    else{ const xs = x1+d1*stub, xe = x2-d2*stub, ym = (y1+y2)/2; pts = [[x1,y1],[xs,y1],[xs,ym],[xe,ym],[xe,y2],[x2,y2]]; }
  } else { const xs = d1>0 ? Math.max(x1,x2)+stub : Math.min(x1,x2)-stub; pts = [[x1,y1],[xs,y1],[xs,y2],[x2,y2]]; }
  return roundedPath(pts,r);
}
// d1 is the direction the wire leaves the first node, d2 the direction it travels when it arrives at the second
function wirePath(x1,y1,x2,y2,d1,d2,W,minK){
  if(W.style==='straight') return `M${x1} ${y1}L${x2} ${y2}`;
  if(W.style==='manhattan') return manhattan(x1,y1,x2,y2,d1,d2,W.elbow,W.radius);
  const dist = Math.abs(x2-x1), bez = W.style==='bezier'; let k;
  if(d1===d2) k = bez ? Math.max(minK*.4,dist*(.15+W.curvature*.7)) : Math.max(minK,dist*.5);
  else { const base = Math.max(52,Math.abs(y2-y1)*.12+40); k = bez ? base*(.4+W.curvature*1.2) : base; }
  return `M${x1} ${y1}C${x1+d1*k} ${y1} ${x2-d2*k} ${y2} ${x2} ${y2}`;
}
function linkAnchors(a,b){
  const y1 = a.cur.y+a.h/2, y2 = b.cur.y+b.h/2;
  if(a.cur.x+a.w+16<=b.cur.x) return {x1:a.cur.x+a.w,y1,x2:b.cur.x,y2,d1:1,d2:1};
  if(b.cur.x+b.w+16<=a.cur.x) return {x1:a.cur.x,y1,x2:b.cur.x+b.w,y2,d1:-1,d2:-1};
  return {x1:a.cur.x+a.w,y1,x2:b.cur.x+b.w,y2,d1:1,d2:-1};
}
const MK = new Map();
function markerFor(color){
  if(!MK.has(color)){
    const id = 'ahc'+(MK.size+1), defs = document.querySelector('#edges defs');
    const m = document.createElementNS(SVGNS,'marker');
    m.setAttribute('id',id); m.setAttribute('viewBox','0 0 10 10'); m.setAttribute('refX','8'); m.setAttribute('refY','5'); m.setAttribute('markerWidth','8'); m.setAttribute('markerHeight','8'); m.setAttribute('orient','auto-start-reverse');
    const pth = document.createElementNS(SVGNS,'path'); pth.setAttribute('d','M1.5 1.5 8.5 5 1.5 8.5'); pth.setAttribute('fill','none'); pth.setAttribute('stroke-width','1.7'); pth.setAttribute('stroke-linecap','round'); pth.setAttribute('stroke-linejoin','round'); pth.style.stroke = color;
    m.appendChild(pth); defs.appendChild(m); MK.set(color,id);
  }
  return `url(#${MK.get(color)})`;
}
function accentOf(n){
  const st = effLook().nodes[n.type] || effLook().nodes.answer, hollow = st.strokeStyle==='none' || !st.strokeWidth || st.stroke==='transparent';
  return hollow ? (st.fill==='mood' ? moodColor(n.mood || 'curiosity') : st.fill) : st.stroke;
}
function setCss(p,prop,val){ if(val===null || val===undefined) p.style.removeProperty(prop); else p.style.setProperty(prop,String(val)); }
function applyWire(p,kind,child,parent,ghost){
  const W = effLook().wires, K = (W.kinds && W.kinds[kind]) || {};
  let color = K.color || null, width = K.width || null, dash = K.dash || null, op = K.opacity || null;
  if(kind==='tree'){
    if(!color && W.colorBy!=='none'){ const nn = W.colorBy==='parent' ? parent : child; if(nn) color = accentOf(nn); }
    color = color || W.color; width = width || W.width; dash = dash || W.dash; op = op || W.opacity;
  }
  setCss(p,'stroke',color); setCss(p,'stroke-width',width); setCss(p,'opacity',op);
  setCss(p,'stroke-dasharray',(!ghost && dash) ? DASH[dash] : null);
  if(kind==='tree' && W.arrows==='end') p.setAttribute('marker-end',markerFor(color || 'var(--edge)'));
}

