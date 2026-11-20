'use strict';

const CascadeGraphCanvas = (() => {
  const model = typeof module !== 'undefined' && module.exports ? require('./model') : CascadeGraphModel;
  const geometry = typeof module !== 'undefined' && module.exports ? require('./geometry') : CascadeGraphGeometry;

  const layouts = typeof module !== 'undefined' && module.exports ? require('./layouts') : CascadeGraphLayouts;

  // getGraph supplies the active {nodes, order, links, view, sel, mode, layer, layout}.
  // Nodes are keyed by id, and links reference endpoint ids via a and b.
  // The renderer reads that model and updates its view {x, y, z} in place.
  // Presentation hooks decorate the DOM. Input callbacks own graph mutations.
  function createCanvas({
    elements:{stage,world,gridEl,gEdges,gTh,elabel},
    getGraph,getLook:getBaseLook,getInset,reduce,overviewFilter,
    initializeNode,nodeW,prepareNodes,paintNode,extraNodeClasses,beforeRestyle,restyleNode,
    applyWire,paintLink,getThreads,getHighlightedId,onZoom,onViewSettled
  }){
    const getLook=()=>{const look=getBaseLook(),style=['','straight','bezier','manhattan'][getGraph().visual?.wires||0];return style?{...look,wires:{...look.wires,style}}:look;};
    const document = stage.ownerDocument, window = document.defaultView;
    const requestAnimationFrame = window.requestAnimationFrame.bind(window);
    const cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
    const performance = window.performance;
    const SVGNS = 'http://www.w3.org/2000/svg';
    const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
    const {indexChildren,effectiveParent,visibleIds} = model;
    const {wirePath,linkAnchors,radialTreePath,layoutRadial,layoutTree} = geometry;
    const runtimeById = Object.create(null), spawnAt = Object.create(null);
    let vAnim = null;
    let hoveredId = null, dependencyTrace = null;

    function updateDependencyTrace(){
      const graph=getGraph();
      dependencyTrace=null;
      if(graph.visual&&runtimeById[hoveredId]?.shown){
        const links=(graph.getTraceLinks?.()||graph.links).filter(link=>
          link.codeEdge&&runtimeById[link.a]?.shown&&runtimeById[link.b]?.shown);
        const nodes=new Set([hoveredId]), traced=new Map();
        // Walk each direction separately so a shared dependency does not pull in siblings.
        for(const [from,to] of [['a','b'],['b','a']]){
          const neighbors=new Map();
          for(const link of links){
            if(!neighbors.has(link[from]))neighbors.set(link[from],[]);
            neighbors.get(link[from]).push(link);
          }
          const visited=new Set([hoveredId]);
          for(const id of visited){
            for(const link of neighbors.get(id)||[]){
              visited.add(link[to]);
              nodes.add(link[to]);
              traced.set(link.id,link);
            }
          }
        }
        dependencyTrace={nodes,links:traced};
      }
      world.classList.toggle('tracing-dependencies',!!dependencyTrace);
      for(const [id,r] of Object.entries(runtimeById)){
        r.el.toggleAttribute('data-trace-node',!!dependencyTrace?.nodes.has(id));
      }
    }
    function hoverDependencyNode(id){
      if(hoveredId===id)return;
      hoveredId=id;
      updateDependencyTrace();
      kick();
    }

    function nodeClasses(node,r,graph){
      return ['node',node.type,r.culled&&'culled',node.ghost&&'ghost',graph.sel===node.id&&'sel',
        r.enter&&'enter',r.hot&&'hot',r.growing&&'growing',r.drag&&'drag',r.drop&&'drop',r.settle&&'settle',
        node.collapsed&&'collapsed',...extraNodeClasses(node,graph)].filter(Boolean).join(' ');
    }

    function restyle(){
      const graph = getGraph();
      beforeRestyle(graph);
      for(const id in runtimeById){
        const node = graph.nodes[id], runtime = runtimeById[id];
        if(!node) continue;
        const classes = nodeClasses(node,runtime,graph);
        if(runtime.el.className!==classes) runtime.el.className = classes;
        restyleNode(runtime.el,id);
      }
    }

    function closestVisibleNode({x,y}){
      let best = null, distance = Infinity;
      for(const id in runtimeById){
        const r = runtimeById[id];
        if(!r.shown) continue;
        const next = Math.hypot(r.tgt.x+r.w/2-x,r.tgt.y+r.h/2-y);
        if(next<distance){ best = id; distance = next; }
      }
      return best;
    }

    function removeNode(id){
      const runtime = runtimeById[id];
      if(runtime.enterFrame) cancelAnimationFrame(runtime.enterFrame);
      runtime.el.remove();
      delete runtimeById[id];
      delete spawnAt[id];
    }

    function syncDom(graph,vis,children){
      for(const id in runtimeById) if(!graph.nodes[id]) removeNode(id);
      for(const id of graph.order){
        const n = graph.nodes[id]; if(!n) continue;
        if(!runtimeById[id] && (!graph.inspection || vis.has(id))){
          const el = document.createElement('div');
          el.dataset.id = id;
          el.tabIndex = 0;
          el.style.display = 'none';
          initializeNode(el);
          world.appendChild(el);
          runtimeById[id] = {el,cur:{x:0,y:0},tgt:{x:0,y:0},w:nodeW(n.type,n),h:56,shown:false,fresh:true};
        }
      }
      for(const id in runtimeById){
        const r = runtimeById[id], show = vis.has(id);
        if(show && !r.shown){ r.el.style.display=''; r.shown=true; r.fresh=true; }
        if(!show && r.shown){ r.el.style.display='none'; r.shown=false; }
        if(show){
          const node = graph.nodes[id];
          r.el.className = nodeClasses(node,r,graph);
          paintNode(node,r,graph,children);
        }
      }
    }

    let wasInspecting = false;
    function layoutInspection(ids,inspection){
      const anchor=runtimeById[inspection.id];
      const x=anchor.tx ?? anchor.cur.x, y=anchor.ty ?? anchor.cur.y;
      Object.assign(anchor.cur,{x,y});
      Object.assign(anchor.tgt,{x,y});
      anchor.fresh=false;
      let remaining=ids.length-1, ring=1, slot=0, capacity=Math.min(8,remaining);
      for(const id of ids){
        if(id===inspection.id)continue;
        const r=runtimeById[id], angle=-Math.PI/2+2*Math.PI*slot/capacity, radius=160*ring;
        r.tgt.x=x+(anchor.w-r.w)/2+Math.cos(angle)*radius;
        r.tgt.y=y+(anchor.h-r.h)/2+Math.sin(angle)*radius;
        if(r.tx===undefined){ r.cur.x=x; r.cur.y=y; }
        r.fresh=false;
        if(++slot===capacity){ remaining-=capacity; slot=0; capacity=Math.min(8*++ring,remaining); }
      }
    }

    function layout(initial){
      const graph = getGraph(), children = indexChildren(graph);
      prepareNodes(graph,children);
      const overview = overviewFilter(graph), vis = new Set(visibleIds(graph,overview));
      syncDom(graph,vis,children);
      if(hoveredId)updateDependencyTrace();
      const ids = [...vis];
      for(const id of ids){ const r = runtimeById[id], n = graph.nodes[id]; r.w = nodeW(n.type,n); r.h = r.el.offsetHeight || 56; }
      const parentOf = id => effectiveParent(graph,id,overview);
      if(graph.inspection){
        wasInspecting=true;
        layoutInspection(ids,graph.inspection);
        kick();
        return;
      }
      const restoreImmediately=wasInspecting;
      wasInspecting=false;
      if(['network','circle','circuit'].includes(graph.layout)) layouts.layoutGraph(graph,ids,runtimeById);
      else if(graph.layout==='radial') layoutRadial(graph,ids,runtimeById);
      else layoutTree(ids,vis,runtimeById,parentOf,getLook().layout);
      if(graph.visual&&!['radial','circuit'].includes(graph.layout))for(const id of ids){const p=runtimeById[id].tgt;p.x*=graph.layout==='tree'?graph.visual.layerGap:graph.visual.spacing;p.y*=graph.visual.spacing;}
      world.classList.toggle('hide-code-details',graph.visual?.labels===false);
      for(const id of ids){
        const r = runtimeById[id];
        if(initial || restoreImmediately || graph.layout==='circuit'){ r.cur.x = r.tgt.x; r.cur.y = r.tgt.y; r.fresh = false; continue; }
        if(r.fresh){
          r.fresh = false;
          const sp = spawnAt[id]; delete spawnAt[id];
          const p = parentOf(id), pr = p && runtimeById[p] && runtimeById[p].shown ? runtimeById[p] : null;
          if(sp){ r.cur.x = sp.x - r.w/2; r.cur.y = sp.y - r.h/2; }
          else if(pr){ const f = pr.fresh ? pr.tgt : pr.cur; r.cur.x = f.x; r.cur.y = f.y; }
          else { r.cur.x = r.tgt.x; r.cur.y = r.tgt.y; }
          if(!reduce){
            r.enter = true; r.el.className = nodeClasses(graph.nodes[id],r,graph);
            r.enterFrame = requestAnimationFrame(()=>{
              r.enterFrame = requestAnimationFrame(()=>{
                r.enterFrame = 0;
                r.enter = false;
                const current = getGraph();
                if(current.nodes[id]) r.el.className = nodeClasses(current.nodes[id],r,current);
              });
            });
          }
        }
      }
      kick();
    }

    let vz = 0, vgs = 0, vflags = '', skillOverview = false;
    function applyView(){
      const graph = getGraph(), v = graph.view;
      world.classList.toggle('radial',graph.layout==='radial');
      const overviewLOD = !!graph.visual && v.z<.36;
      if(overviewLOD!==skillOverview){
        skillOverview = overviewLOD;
        world.classList.toggle('skill-overview',skillOverview);
        kick();
      }
      world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.z})`;
      // only the grid layer and (when zoomed far out) the world get variables, and only when they change
      let gs = getLook().canvas.gridSize*v.z; while(gs<12) gs*=2;
      if(gs!==vgs){ vgs = gs; gridEl.style.setProperty('--gs', gs+'px'); }
      gridEl.style.transform = `translate3d(${v.x%gs}px,${v.y%gs}px,0)`;
      const far = graph.mode==='detail' && v.z<.55, flags = (far ? 'f' : '')+(graph.mode==='outer' ? 'o' : '')+(graph.layer ? 'm' : '');
      if(flags!==vflags){ vflags = flags; world.classList.toggle('far',far); world.classList.toggle('outer',graph.mode==='outer'); world.classList.toggle('maplayer',!!graph.layer); }
      if(far && Math.abs(v.z-vz)>.01){ vz = v.z; world.style.setProperty('--z',v.z.toFixed(2)); }
      cullNodes();
    }
    function screenToWorld(cx,cy){
      const rect = stage.getBoundingClientRect(), view = getGraph().view;
      return {x:(cx-rect.left-view.x)/view.z, y:(cy-rect.top-view.y)/view.z};
    }
    function fitTo(ids,o){
      o = Object.assign({maxZ:1,minZ:.2,pad:48,instant:false},o||{});
      ids = ids.filter(id=>runtimeById[id] && runtimeById[id].shown); if(!ids.length) return;
      let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
      ids.forEach(id=>{ const r=runtimeById[id]; x0=Math.min(x0,r.tgt.x); y0=Math.min(y0,r.tgt.y); x1=Math.max(x1,r.tgt.x+r.w); y1=Math.max(y1,r.tgt.y+r.h); });
      if(getGraph().layout==='radial'){
        const sw=(stage.clientWidth||900)-getInset(),sh=stage.clientHeight||600;
        const z=clamp(Math.min((sw-2*o.pad)/(2*Math.max(Math.abs(x0),Math.abs(x1))),(sh-2*o.pad)/(2*Math.max(Math.abs(y0),Math.abs(y1))),o.maxZ),Math.min(o.minZ,.08),o.maxZ);
        const target={x:sw/2,y:sh/2,z};if(o.instant){Object.assign(getGraph().view,target);vAnim=null;applyView();}else{vAnim=target;kickView();}return;
      }
      const sw = (stage.clientWidth || 900) - getInset(), sh = stage.clientHeight || 600, bw = x1-x0, bh = y1-y0;
      const z = clamp(Math.min((sw-2*o.pad)/bw,(sh-2*o.pad)/bh), o.minZ, o.maxZ);
      const t = {z, x: bw*z > sw-2*o.pad ? o.pad - x0*z : sw/2-(x0+bw/2)*z, y: bh*z > sh-2*o.pad ? o.pad + 40 - y0*z : sh/2-(y0+bh/2)*z};
      if(o.instant){ Object.assign(getGraph().view,t); vAnim=null; applyView(); } else { vAnim=t; kickView(); }
    }
    function ensureVisible(id){
      const r = runtimeById[id]; if(!r || !r.shown) return;
      const v = getGraph().view, sw = stage.clientWidth - getInset(), sh = stage.clientHeight, m = 70;
      const x0 = r.tgt.x*v.z+v.x, y0 = r.tgt.y*v.z+v.y, x1 = x0+r.w*v.z, y1 = y0+r.h*v.z;
      if(x0>=m && y0>=m+30 && x1<=sw-m && y1<=sh-m) return;
      const z = Math.max(v.z,.7);
      vAnim = {z, x: sw/2-(r.tgt.x+r.w/2)*z, y: sh/2-(r.tgt.y+r.h/2)*z}; kickView();
    }
    // touch and trackpads fire many events per frame: apply the camera once per frame
    let viewRaf = 0;
    function scheduleView(){ if(!viewRaf) viewRaf = requestAnimationFrame(()=>{ viewRaf = 0; applyView(); }); }
    function flushView(){ if(viewRaf){ cancelAnimationFrame(viewRaf); viewRaf = 0; applyView(); } }
    function zoomAt(f,cx,cy,defer){
      vAnim = null;
      const graph = getGraph(), v = graph.view, nz = clamp(v.z*f,graph.visual ? .08 : .18,1.8), k = nz/v.z;
      v.x = cx-(cx-v.x)*k; v.y = cy-(cy-v.y)*k; v.z = nz; if(defer) scheduleView(); else applyView();
      onZoom({x:(cx-v.x)/v.z,y:(cy-v.y)/v.z},v.z);
    }

    const EP = new Map(), TPM = new Map();
    function pathEl(key,cls,marker,markerStart){
      let p = EP.get(key);
      if(!p){ p = document.createElementNS(SVGNS,'path'); gEdges.appendChild(p); EP.set(key,p); }
      p.setAttribute('class',cls);
      if(marker) p.setAttribute('marker-end','url(#ah)'); else p.removeAttribute('marker-end');
      if(markerStart) p.setAttribute('marker-start','url(#ah)'); else p.removeAttribute('marker-start');
      return p;
    }
    function linkPath(a,b){
      if(getGraph().layout==='circle') return [1,3].includes(getGraph().visual?.wires)?radialTreePath(a,b,getLook().wires):layouts.chordPath(a,b);
      if(getGraph().layout==='circuit') return radialTreePath(a,b,getLook().wires);
      if(getGraph().layout==='network') return radialTreePath(a,b,getGraph().visual?.wires?getLook().wires:{style:'straight'});
      const q = linkAnchors(a,b); return wirePath(q.x1,q.y1,q.x2,q.y2,q.d1,q.d2,getLook().wires,40); }
    function treePath(a,b,graph){
      if(graph.inspection) return radialTreePath(a,b,getLook().wires);
      if(graph.layout==='circuit') return layouts.circuitPath(a,b,getLook().wires);
      if(skillOverview || (graph.layout==='network'&&!graph.visual?.wires)) return radialTreePath(a,b,{style:'straight'});
      const wires=getLook().wires;
      if(graph.layout==='circle') return [1,3].includes(graph.visual?.wires)?radialTreePath(a,b,wires):layouts.chordPath(a,b);
      if(graph.layout==='radial'||graph.layout==='network') return radialTreePath(a,b,wires);
      return wirePath(a.cur.x+a.w,a.cur.y+a.h/2,b.cur.x,b.cur.y+b.h/2,1,1,wires,36);
    }
    function drawEdges(){
      const graph = getGraph(), overview = overviewFilter(graph), seen = new Set();
      const overviewPaths = [];
      for(const id in runtimeById){
        const r = runtimeById[id]; if(!r.shown) continue;
        const n = graph.nodes[id]; if(!n) continue;
        const pid = effectiveParent(graph,id,overview); if(!pid) continue;
        const pr = runtimeById[pid]; if(!pr || !pr.shown) continue;
        const path = treePath(pr,r,graph);
        if(skillOverview){ overviewPaths.push(path); continue; }
        const key = 'e'+id; seen.add(key);
        const p = pathEl(key, (n.ghost?'g':'')+(n.back?' back':''), false, !!n.back); p._e = [id,pid];
        p.setAttribute('d',path);
        applyWire(p,n.back ? 'back' : 'tree',n,graph.nodes[pid],n.ghost);
      }
      if(overviewPaths.length){
        seen.add('skill-overview');
        pathEl('skill-overview','skill-overview-wires',false,false).setAttribute('d',overviewPaths.join(' '));
      }
      const baseLinks=skillOverview?(graph.previewActive?graph.links.filter(link=>link.codePlan):[]):graph.links;
      const displayedLinks=dependencyTrace
        ? [...baseLinks.filter(link=>!dependencyTrace.links.has(link.id)),...dependencyTrace.links.values()]
        : baseLinks;
      for(const L of displayedLinks){
        const a = runtimeById[L.a], b = runtimeById[L.b];
        if(!a || !b || !a.shown || !b.shown) continue;
        const na = graph.nodes[L.a], nb = graph.nodes[L.b];
        if(L.kind==='block' && !graph.layer) continue;
        const key = L.id || 'l'+L.a+'_'+L.b; seen.add(key);
        const ghost = na.ghost || nb.ghost;
        const kind = L.kind==='flow' ? 'flow' : L.kind==='block' ? 'block' : 'rel';
        const p = pathEl(key, kind + (ghost?' g':''), kind==='flow' || kind==='block'); p._e = [L.a,L.b];
        p.setAttribute('d', linkPath(a,b));
        applyWire(p,kind==='rel' ? 'related' : kind,nb,na,ghost);
        paintLink(p,L,na,nb);
        p.classList.toggle('trace-connection',!!dependencyTrace?.links.has(L.id));
      }
      const seenT = new Set();
      for(const t of getThreads()){
        for(let k=0; k<t.ids.length-1; k++){
          const a = runtimeById[t.ids[k]], b = runtimeById[t.ids[k+1]];
          if(!a || !b || !a.shown || !b.shown) continue;
          const key = 't'+t.i+'_'+k; seenT.add(key);
          let p = TPM.get(key);
          if(!p){ p = document.createElementNS(SVGNS,'path'); gTh.appendChild(p); TPM.set(key,p); }
          p.setAttribute('class','th t'+(t.i%3)); p.setAttribute('marker-end','url(#ah)'); p.setAttribute('d',linkPath(a,b));
        }
      }
      TPM.forEach((p,k)=>{ if(!seenT.has(k)){ p.remove(); TPM.delete(k); } });
      EP.forEach((p,k)=>{ if(!seen.has(k)){ p.remove(); EP.delete(k); } });
      let show = false; const fid = graph.sel || getHighlightedId();
      if(fid && runtimeById[fid] && runtimeById[fid].shown && graph.nodes[fid]){
        const n = graph.nodes[fid], pid = effectiveParent(graph,fid,overview);
        if(n.rel && pid && runtimeById[pid] && runtimeById[pid].shown && graph.view.z>=.5){
          const a = runtimeById[pid], b = runtimeById[fid];
          elabel.setAttribute('x', (a.cur.x+a.w+b.cur.x)/2);
          elabel.setAttribute('y', (a.cur.y+a.h/2+b.cur.y+b.h/2)/2 - 7);
          elabel.textContent = n.rel; show = true;
        }
      }
      elabel.style.display = show ? '' : 'none';
    }
    /* ---- culling: in a big tree most blocks are off screen. A block that cannot be seen is hidden (visibility keeps its size, so
       layout still works), which cuts the browser's painting and layer work several times over. Cheap to run every frame: it only
       does arithmetic and touches a block when it crosses the line. ---- */
    const CULL_MIN = 100, CULL_MARGIN = .6;
    let SW = 0, SH = 0, culledAny = false;
    function measureStage(){ SW = stage.clientWidth; SH = stage.clientHeight; }
    function resize(){ measureStage(); cullNodes(); }
    const observer = window.ResizeObserver ? new window.ResizeObserver(resize) : null;
    function cullNodes(){
      if(!SW) measureStage();
      const ids = Object.keys(runtimeById);
      if(ids.length<CULL_MIN || !SW || !SH){
        if(culledAny){ culledAny = false; for(const id of ids){ const r = runtimeById[id]; if(r.culled){ r.culled = false; r.el.classList.remove('culled'); } } EP.forEach(p=>{ if(p._h){ p._h = false; p.style.visibility = ''; } }); }
        return;
      }
      const {view:v,sel} = getGraph(), z = v.z, x0 = (-v.x-SW*CULL_MARGIN)/z, x1 = (-v.x+SW*(1+CULL_MARGIN))/z, y0 = (-v.y-SH*CULL_MARGIN)/z, y1 = (-v.y+SH*(1+CULL_MARGIN))/z;
      for(const id of ids){
        const r = runtimeById[id];
        const off = !!(r.shown && !r.dragging && !r.editing && !r.enter && sel!==id && (r.cur.x+r.w<x0 || r.cur.x>x1 || r.cur.y+r.h<y0 || r.cur.y>y1));
        if(off!==!!r.culled){ r.culled = off; r.el.classList.toggle('culled',off); if(off) culledAny = true; }
      }
      EP.forEach(p=>{
        const e = p._e; if(!e) return;
        const a = runtimeById[e[0]], b = runtimeById[e[1]], hide = !!(a && b && a.culled && b.culled);
        if(hide!==!!p._h){ p._h = hide; p.style.visibility = hide ? 'hidden' : ''; }
      });
    }
    let raf = 0, last = 0, edgesDirty = true;
    function schedule(){ if(!raf){ last = performance.now(); raf = requestAnimationFrame(tick); } }
    function kick(){ edgesDirty = true; schedule(); }   // something about the tree changed
    function kickView(){ schedule(); }                  // only the camera is moving: the edges stay as they are
    function tick(now){
      raf = 0;
      const dt = Math.min(.05,(now-last)/1000); last = now;
      const k = reduce ? 1 : 1 - Math.exp(-dt/.085);
      let moving = false, nodesMoved = false;
      for(const id in runtimeById){
        const r = runtimeById[id]; if(!r.shown) continue;
        if(!r.dragging){
          const dx = r.tgt.x-r.cur.x, dy = r.tgt.y-r.cur.y;
          if(Math.abs(dx)>.4 || Math.abs(dy)>.4){ r.cur.x += dx*k; r.cur.y += dy*k; moving = true; }
          else { r.cur.x = r.tgt.x; r.cur.y = r.tgt.y; }
        } else moving = true;
        if(r.tx!==r.cur.x || r.ty!==r.cur.y){ r.tx = r.cur.x; r.ty = r.cur.y; r.el.style.transform = `translate(${r.tx}px,${r.ty}px)`; nodesMoved = true; }
      }
      if(vAnim){
        const v = getGraph().view, kv = reduce ? 1 : 1 - Math.exp(-dt/.12);
        v.x += (vAnim.x-v.x)*kv; v.y += (vAnim.y-v.y)*kv; v.z += (vAnim.z-v.z)*kv;
        if(Math.abs(vAnim.x-v.x)<.5 && Math.abs(vAnim.y-v.y)<.5 && Math.abs(vAnim.z-v.z)<.002){ Object.assign(v,vAnim); vAnim = null; onViewSettled(); }
        else moving = true;
        applyView();
      }
      if(nodesMoved || edgesDirty){ drawEdges(); edgesDirty = false; }
      if(nodesMoved) cullNodes();
      if(moving) schedule();
    }

    function cancelViewAnimation(){ vAnim = null; }
    function spawnNode(id,position){ spawnAt[id] = position; }
    function destroy(){
      observer?.disconnect();
      window.removeEventListener('resize',resize);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(viewRaf);
      for(const id in runtimeById) removeNode(id);
      for(const paths of [EP,TPM]){
        for(const path of paths.values()) path.remove();
        paths.clear();
      }
      elabel.style.display = 'none';
    }

    if(observer) observer.observe(stage);
    else window.addEventListener('resize',resize);

    const getNode = id => runtimeById[id];
    const hasNodes = () => Object.keys(runtimeById).length>0;
    return {getNode,hasNodes,layout,restyle,kick,applyView,screenToWorld,fitTo,ensureVisible,hoverDependencyNode,
      scheduleView,flushView,zoomAt,closestVisibleNode,cancelViewAnimation,spawnNode,destroy};
  }

  return {createCanvas};
})();

if(typeof module !== 'undefined' && module.exports) module.exports = CascadeGraphCanvas;
