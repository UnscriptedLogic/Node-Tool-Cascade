'use strict';

const CascadeGraphLayouts = (() => {
  const center = node => ({x:node.cur.x+node.w/2,y:node.cur.y+node.h/2});
  function chordPath(a,b){
    const p=center(a),q=center(b);
    return `M${p.x} ${p.y}Q0 0 ${q.x} ${q.y}`;
  }
  function layoutCircuit(graph,ids,root,visible,children,points,runtime){
    // Ordered subtree intervals keep each fan-out inside its own lane.
    const spacing=graph.visual?.spacing||1, layerGap=graph.visual?.layerGap||1;
    const footprint=Math.max(...ids.map(id=>Math.hypot(runtime[id].w,runtime[id].h)),graph.visual?128:0);
    const pitch=footprint+24*spacing, depthStep=footprint+48*layerGap;
    const widths=new Map();
    function measure(id){
      const width=Math.max(pitch,(children.get(id)||[]).reduce((sum,child)=>sum+measure(child),0));
      widths.set(id,width);
      return width;
    }
    const lanes=Array.from({length:8},()=>[]);
    const branches=[...(children.get(root)||[]),...ids.filter(id=>id!==root&&!visible.has(graph.nodes[id].parent))];
    branches.forEach((id,index)=>{
      measure(id);
      lanes[branches.length<8?Math.floor(index*8/branches.length):index%8].push(id);
    });
    points.set(root,{x:0,y:0});
    lanes.forEach((list,lane)=>{
      const angle=lane*Math.PI/4-Math.PI/2, dx=Math.cos(angle), dy=Math.sin(angle);
      const totalWidth=nodes=>nodes.reduce((sum,id)=>sum+widths.get(id),0);
      // Leave room for the whole lane inside its 45-degree sector, including tiles.
      const radius=Math.max(depthStep,(totalWidth(list)/2+pitch/2)/Math.tan(Math.PI/8)+pitch/2);
      function place(nodes,midpoint,distance,firstLayer=false){
        let cursor=midpoint-totalWidth(nodes)/2;
        for(const id of nodes){
          const width=widths.get(id), offset=cursor+width/2;
          points.set(id,{x:dx*distance-dy*offset,y:dy*distance+dx*offset});
          runtime[id].circuitLane={dx,dy,elbow:distance-(firstLayer?pitch/3:depthStep/2)};
          place(children.get(id)||[],offset,distance+depthStep);
          cursor+=width;
        }
      }
      place(list,0,radius,true);
    });
  }

  function circuitPath(a,b,wires){
    const p=center(a), q=center(b), dx=q.x-p.x, dy=q.y-p.y;
    const length=Math.abs(dx)+Math.abs(dy);
    if(!length)return `M${p.x} ${p.y}`;
    const start=Math.min(.5,(Math.min(a.w,a.h)/2-1)/length);
    const end=Math.min(.5,(Math.min(b.w,b.h)/2-1)/length);
    const lane=b.circuitLane;
    if(!lane || wires.style==='straight')return `M${p.x+dx*start} ${p.y+dy*start}L${q.x-dx*end} ${q.y-dy*end}`;

    const forward=dx*lane.dx+dy*lane.dy, across=dy*lane.dx-dx*lane.dy;
    if(forward<=0)return `M${p.x} ${p.y}L${q.x} ${q.y}`;
    const point=(along,side)=>`${p.x+lane.dx*along-lane.dy*side} ${p.y+lane.dy*along+lane.dx*side}`;
    const fan=Math.tanh(across/180);
    // Ordered offsets give siblings separate ports. Outer wires turn first.
    const port=point(12,12*fan);
    const tip=(Math.min(b.w,b.h)/2-1)/(Math.abs(lane.dx)+Math.abs(lane.dy));
    const destination=point(forward-tip,across);
    if(wires.style==='manhattan'){
      const parentDepth=p.x*lane.dx+p.y*lane.dy;
      const elbow=Math.min(forward-tip,Math.max(12,lane.elbow-parentDepth-18*Math.abs(fan)));
      return `M${port}L${point(elbow,12*fan)}L${point(elbow,across)}L${destination}`;
    }
    const run=forward-tip-12;
    const control=Math.min(.45,.2+(wires.curvature||0)*.25)*run;
    return `M${port}C${point(12+control,12*fan)} ${point(forward-tip-control,across)} ${destination}`;
  }

  function layoutGraph(graph,ids,runtime){
    if(!ids.length)return;
    const visible=new Set(ids), points=new Map(), children=new Map();
    for(const id of ids){const parent=graph.nodes[id].parent;if(!children.has(parent))children.set(parent,[]);children.get(parent).push(id);}
    const size=id=>Math.hypot(runtime[id].w,runtime[id].h);
    const root=ids.find(id=>!visible.has(graph.nodes[id].parent))||ids[0];
    function ring(list,radius){list.forEach((id,index)=>{const angle=-Math.PI/2+2*Math.PI*index/list.length;points.set(id,{x:Math.cos(angle)*radius,y:Math.sin(angle)*radius});});}
    if(graph.layout==='circle'){
      // Depth-first order keeps each system's scripts adjacent on the ring.
      const ordered=[];
      function visit(id){ordered.push(id);for(const child of children.get(id)||[])visit(child);}
      for(const id of ids)if(!visible.has(graph.nodes[id].parent))visit(id);
      ring(ordered,Math.max(300,ordered.reduce((sum,id)=>sum+size(id)+28,0)/(2*Math.PI)));
    }else if(graph.layout==='circuit'){
      layoutCircuit(graph,ids,root,visible,children,points,runtime);
    }else{
      // Bounded deterministic simulation: no perpetual animation or random jumps.
      ring(ids,Math.max(300,Math.sqrt(ids.length)*95));
      const edges=ids.filter(id=>visible.has(graph.nodes[id].parent)).map(id=>({a:id,b:graph.nodes[id].parent})).concat(graph.links.filter(e=>visible.has(e.a)&&visible.has(e.b)));
      for(let step=0;step<150;step++){
        const force=new Map(ids.map(id=>[id,{x:0,y:0}]));
        for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
          const a=ids[i],b=ids[j],p=points.get(a),q=points.get(b),dx=p.x-q.x,dy=p.y-q.y,d=Math.max(1,Math.hypot(dx,dy));
          const clearance=(size(a)+size(b))/2+36,strength=16000/(d*d)+Math.max(0,clearance-d)*.6;
          const x=dx/d*strength,y=dy/d*strength;force.get(a).x+=x;force.get(a).y+=y;force.get(b).x-=x;force.get(b).y-=y;
        }
        for(const edge of edges){const p=points.get(edge.a),q=points.get(edge.b),dx=q.x-p.x,dy=q.y-p.y,d=Math.max(1,Math.hypot(dx,dy)),pull=(d-(size(edge.a)+size(edge.b))/2-90)*.025;const x=dx/d*pull,y=dy/d*pull;force.get(edge.a).x+=x;force.get(edge.a).y+=y;force.get(edge.b).x-=x;force.get(edge.b).y-=y;}
        const cap=24*(1-step/180);
        for(const id of ids){const p=points.get(id),f=force.get(id);p.x+=Math.max(-cap,Math.min(cap,f.x-p.x*.002));p.y+=Math.max(-cap,Math.min(cap,f.y-p.y*.002));}
      }
    }
    for(const id of ids){const p=points.get(id)||{x:0,y:0},node=runtime[id];node.tgt={x:p.x-node.w/2,y:p.y-node.h/2};}
  }
  return {layoutGraph,chordPath,circuitPath};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=CascadeGraphLayouts;
