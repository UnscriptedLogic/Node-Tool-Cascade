'use strict';
/* ================= state ================= */
function seed(){
  const nodes = {}, order = [], links = []; let n = 0;
  const add = (type,text,parent,extra) => { const id = 'n'+(++n); nodes[id] = Object.assign({id,type,text,parent,ghost:false},extra||{}); order.push(id); return id; };
  const game = add('loop','Game',null);
  const core = add('loop','Core loop',game);
  const explore = add('loop','Explore',core);
  const combat = add('loop','Combat',core);
  const upgrade = add('loop','Upgrade',core);

  const q1 = add('question','Why does traversal feel slow?',explore);
  const a1 = add('answer','Points of interest sit far apart with nothing in between',q1);
  add('emotion','Bored crossing empty ground',a1,{mood:'boredom'});
  add('consequence','Players skip optional areas',a1);
  const a2 = add('answer','No movement abilities beyond walking',q1);
  add('emotion','Frustrated retracing the same routes',a2,{mood:'frustration'});

  const q2 = add('question','Can players read an enemy’s next move?',combat);
  const a3 = add('answer','Wind-ups are short and look alike',q2);
  add('emotion','Confused by sudden hits',a3,{mood:'confusion'});

  const q3 = add('question','Do upgrades change how the player moves?',upgrade);
  const a4 = add('answer','Most upgrades only raise numbers',q3);
  add('emotion','Delight fades after the first few',a4,{mood:'delight'});

  const meta = add('loop','Meta loop',game,{collapsed:true});
  const prog = add('loop','Progression',meta);
  add('question','Does campaign pacing hold across twenty hours?',prog);
  const soc = add('loop','Social',meta);
  add('question','Why would a friend come back tomorrow?',soc);

  links.push({a:explore,b:combat,kind:'flow'},{a:combat,b:upgrade,kind:'flow'},{a:upgrade,b:explore,kind:'flow'});
  links.push({a:a2,b:q3,kind:'rel'});
  return {nodes,order,links,seq:n};
}
function load(){
  try{
    let o = window.__CASCADE_SAVED__;
    if(!o){ const raw = localStorage.getItem(KEY); if(!raw) return null; o = JSON.parse(raw); }
    const t = JSON.parse(o.tree);
    if(!t || !t.nodes || !t.order || !t.order.length) return null;
    t.view = o.view; return t;
  }catch(e){ return null; }
}
const loaded = load();
const S = Object.assign({view:{x:0,y:0,z:1},mode:'detail',layer:false,sel:null,nodes:{},order:[],links:[],seq:0}, loaded || seed());
S.mode = 'detail'; S.sel = null;
if(!S.view || !isFinite(S.view.z)) S.view = {x:0,y:0,z:1};
const R = {};            // runtime per node: el, cur, tgt, w, h ...
let KM = {};             // parent -> [child ids]
const spawnAt = {};
const hist = [];
let flashId = null, vAnim = null, linkFrom = null, MAP = {frontier:[],blocked:[],settled:[],fog:[],out:[],flag:{}}, THMAP = {}, THR = [];

const snap = () => JSON.stringify({nodes:S.nodes,order:S.order,links:S.links,seq:S.seq});
let saveTimer = 0;
function save(){
  const payload = JSON.stringify({tree:snap(),view:S.view});
  try{ localStorage.setItem(KEY,payload); }catch(e){}
  if(LOCAL){ clearTimeout(saveTimer); saveTimer = setTimeout(()=>{ fetch('/api/tree',{method:'POST',headers:{'content-type':'application/json'},body:payload}).catch(()=>{}); },400); }
}
function pushHist(withView){ hist.push({s:snap(),v:withView?{x:S.view.x,y:S.view.y,z:S.view.z}:null}); if(hist.length>40) hist.shift(); updateHud(); }
function applySnap(s){ const o = JSON.parse(s); S.nodes=o.nodes; S.order=o.order; S.links=o.links; S.seq=o.seq; if(!S.nodes[S.sel]) S.sel=null; }

