'use strict';
/* ================= state ================= */
function seed(){ return DOM().sample(); }
function load(){
  try{
    let o = window.__CASCADE_SAVED__;
    if(!o){ const raw = localStorage.getItem(KEY); if(!raw) return null; o = JSON.parse(raw); }
    const t = JSON.parse(o.tree);
    if(!t || !t.nodes || !Array.isArray(t.order)) return null;
    t.view = o.view; return t;
  }catch(e){ return null; }
}
const loaded = load();
const initialState = Object.assign({view:{x:0,y:0,z:1},mode:'detail',layer:false,sel:null,nodes:{},order:[],links:[],seq:0}, loaded || {});
initialState.view = CascadeUI.ref(initialState.view && isFinite(initialState.view.z) ? initialState.view : {x:0,y:0,z:1});
const S = CascadeUI.proxy(initialState);
S.mode = 'detail'; S.sel = null;
try{ S.mindsets = Mindsets.collection(S.mindsets); }catch(e){ S.mindsets = []; }
const R = {};            // runtime per node: el, cur, tgt, w, h ...
let KM = {};             // parent -> [child ids]
const spawnAt = {};
const hist = CascadeUI.proxy([]);
let flashId = null, vAnim = null, linkFrom = null, MAP = {frontier:[],blocked:[],settled:[],fog:[],out:[],flag:{}}, THMAP = {}, THR = [];

const snap = () => JSON.stringify({nodes:S.nodes,order:S.order,links:S.links,seq:S.seq,mindsets:S.mindsets});
let saveTimer = 0;
function save(){
  const payload = JSON.stringify({tree:snap(),view:S.view});
  try{ localStorage.setItem(KEY,payload); }catch(e){}
  if(typeof libAfterSave==='function') libAfterSave();
  if(LOCAL){ clearTimeout(saveTimer); saveTimer = setTimeout(()=>{ fetch('/api/tree',{method:'POST',headers:{'content-type':'application/json'},body:payload}).catch(()=>{}); },400); }
}
function pushHist(withView){ hist.push({s:snap(),v:withView?{x:S.view.x,y:S.view.y,z:S.view.z}:null}); if(hist.length>40) hist.shift();  }
function applySnap(s){ const o = JSON.parse(s); S.nodes=o.nodes; S.order=o.order; S.links=o.links; S.seq=o.seq; S.mindsets=Mindsets.collection(o.mindsets); if(!S.nodes[S.sel]) S.sel=null; }


const AI=CascadeUI.proxy({checked:false,sample:null,off:false});
const UI=CascadeUI.proxy({bye:false,busy:null,stoppable:false,note:[],noteOpen:false,noteUndo:false,small:false,minimal:false,panel:null,ask:null,library:null,seed:false,providerLabels:{},settingsTitle:'Settings',moodColors:{},compose:{open:false,type:'question',text:'',x:0,y:0,w:300,wpos:null,focus:0},menu:null});
