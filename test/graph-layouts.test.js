'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {layoutGraph,chordPath}=require('../app/packages/graph/layouts');
for(const layout of ['network','circle','circuit'])test(layout+' places connected and isolated nodes deterministically',()=>{
  const graph={layout,nodes:{root:{parent:null},a:{parent:'root'},b:{parent:'root'},child:{parent:'a'},isolated:{parent:null}},links:[{a:'child',b:'b'}]};
  const ids=Object.keys(graph.nodes),runtime=Object.fromEntries(ids.map(id=>[id,{w:180,h:56,cur:{x:0,y:0}}]));
  layoutGraph(graph,ids,runtime);
  const first=ids.map(id=>({...runtime[id].tgt}));
  assert.ok(first.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  assert.equal(new Set(first.map(p=>JSON.stringify(p))).size,ids.length,'nodes occupy distinct positions');
  layoutGraph(graph,ids,runtime);assert.deepEqual(ids.map(id=>runtime[id].tgt),first);
  if(layout==='circle'){
    const radii=ids.map(id=>Math.hypot(runtime[id].tgt.x+90,runtime[id].tgt.y+28));
    assert.ok(radii.every(r=>Math.abs(r-radii[0])<.001));
  }
});
test('chord paths bend through circle center',()=>{
  assert.equal(chordPath({cur:{x:0,y:0},w:100,h:40},{cur:{x:200,y:200},w:100,h:40}),'M50 20Q0 0 250 220');
});

test('dense circuit fans keep ownership wires from crossing',()=>{
  const graph={layout:'circuit',nodes:{root:{parent:null}},links:[],visual:{spacing:.6,layerGap:.6}};
  for(let system=0;system<24;system++){
    const parent='system-'+system;
    graph.nodes[parent]={parent:'root'};
    for(let script=0;script<4;script++){
      const id=parent+':'+script;
      graph.nodes[id]={parent};
      for(let member=0;member<=script%2;member++)graph.nodes[id+':'+member]={parent:id};
    }
  }
  const ids=Object.keys(graph.nodes),runtime=Object.fromEntries(ids.map(id=>[id,{w:64,h:64}]));
  layoutGraph(graph,ids,runtime);
  const edges=ids.slice(1).map(id=>[id,graph.nodes[id].parent]);
  const side=(a,b,p)=>{
    const start=runtime[a].tgt,end=runtime[b].tgt,point=runtime[p].tgt;
    return (end.x-start.x)*(point.y-start.y)-(end.y-start.y)*(point.x-start.x);
  };
  for(const [index,[a,b]] of edges.entries())for(let next=index+1;next<edges.length;next++){
    const [c,d]=edges[next];
    if(a===c||a===d||b===c||b===d)continue;
    assert.ok(side(a,b,c)*side(a,b,d)>=0||side(c,d,a)*side(c,d,b)>=0,`${a} and ${c} cross`);
  }
});
