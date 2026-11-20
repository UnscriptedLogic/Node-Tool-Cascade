'use strict';

const CascadeGraphGeometry = (() => {
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

  function radialTreePath(a,b,wires){
    const ax=a.cur.x+a.w/2,ay=a.cur.y+a.h/2,bx=b.cur.x+b.w/2,by=b.cur.y+b.h/2,dx=bx-ax,dy=by-ay;
    if(Math.abs(dx)+Math.abs(dy)<.01)return 'M'+ax+' '+ay+'L'+bx+' '+by;
    const boundary=(w,h)=>1/Math.max(Math.abs(dx)/(w/2),Math.abs(dy)/(h/2));
    const from=boundary(a.w,a.h),to=boundary(b.w,b.h),x1=ax+dx*from,y1=ay+dy*from,x2=bx-dx*to,y2=by-dy*to;
    const style=wires.style;if(style==='straight')return `M${x1} ${y1}L${x2} ${y2}`;
    if(style==='manhattan')return wirePath(x1,y1,x2,y2,Math.sign(dx)||1,Math.sign(dx)||1,wires,36);
    const bend=style==='bezier'?.08:.025,vx=x2-x1,vy=y2-y1;
    return `M${x1} ${y1}C${x1+vx*.35-vy*bend} ${y1+vy*.35+vx*bend} ${x1+vx*.65-vy*bend} ${y1+vy*.65+vx*bend} ${x2} ${y2}`;
  }

  function layoutRadial(model,ids,runtime){
    const children=new Map();
    for(const id of ids){
      const parent = model.nodes[id].parent;
      if(!children.has(parent)) children.set(parent,[]);
      children.get(parent).push(id);
    }
    const root = ids.find(id=>!model.nodes[id].parent);
    if(!root) return;
    // Allocate sibling space locally so a dense branch cannot stretch every ring.
    const widths=new Map(), positions=new Map([[root,{x:0,y:0}]]);
    const gap=28,spacing=model.visual?.spacing||1,layerGap=model.visual?.layerGap||1;
    const diagonal = id => Math.hypot(runtime[id].w,runtime[id].h);
    function measure(id){
      const list=children.get(id)||[];
      const width=Math.max((diagonal(id)+gap)*spacing,list.reduce((sum,child)=>sum+measure(child),0));
      widths.set(id,width);return width;
    }
    measure(root);
    function branch(id,angle){
      const parent=positions.get(id),list=children.get(id)||[];
      let offset=-list.reduce((sum,child)=>sum+widths.get(child),0)/2;
      for(const child of list){
        const width=widths.get(child),side=offset+width/2;
        const distance=((diagonal(id)+diagonal(child))/2+64)*layerGap;
        positions.set(child,{x:parent.x+Math.cos(angle)*distance-Math.sin(angle)*side,y:parent.y+Math.sin(angle)*distance+Math.cos(angle)*side});
        offset+=width;branch(child,angle);
      }
    }
    const ring = children.get(root)||[];
    const circumference = ring.reduce((sum,id)=>sum+diagonal(id)+gap,0);
    const radius = Math.max(280,...ring.map(id=>diagonal(id)+48),circumference/(2*Math.PI))*layerGap;
    ring.forEach((id,index)=>{
      const angle = -Math.PI/2+2*Math.PI*index/ring.length;
      positions.set(id,{x:Math.cos(angle)*radius,y:Math.sin(angle)*radius});
      branch(id,angle);
    });
    for(const id of ids){
      const position = positions.get(id)||{x:0,y:0}, node = runtime[id];
      node.tgt = {x:position.x-node.w/2,y:position.y-node.h/2};
    }
  }

  function layoutTree(ids,vis,R,parentOf,spacing){
    const kidsOf = {}, roots = [];
    for(const id of ids){ const p = parentOf(id); if(p && vis.has(p)) (kidsOf[p]||(kidsOf[p]=[])).push(id); else roots.push(id); }
    const GY = spacing.rowGap, gapX = spacing.colGap, colW = [], colX = [0];
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
  }

  return {wirePath, linkAnchors, radialTreePath, layoutRadial, layoutTree};
})();

if(typeof module !== 'undefined' && module.exports) module.exports = CascadeGraphGeometry;
