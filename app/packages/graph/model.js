'use strict';

const CascadeGraphModel = (() => {
  function indexChildren({nodes, order}){
    const children = Object.create(null);
    for(const id of order){
      const node = nodes[id];
      if(node) (children[node.parent || ''] ||= []).push(id);
    }
    return children;
  }

  function descendants(children,id){
    const result = [], pending = [id];
    while(pending.length){
      const parent = pending.pop();
      for(const child of children[parent] || []){
        result.push(child);
        pending.push(child);
      }
    }
    return result;
  }

  // A predicate projects the current graph onto its overview nodes.
  function effectiveParent({nodes},id,overview){
    let parent = nodes[id].parent;
    while(parent && overview && nodes[parent] && !overview(nodes[parent])) parent = nodes[parent].parent;
    return parent;
  }

  function visibleIds({nodes,order,inspection},overview){
    if(inspection)return order.filter(id=>inspection.related.has(id));
    return order.filter(id => {
      const node = nodes[id];
      if(!node) return false;
      if(overview) return overview(node);
      for(let parent = node.parent; parent; parent = nodes[parent].parent){
        if(!nodes[parent] || nodes[parent].collapsed) return false;
      }
      return true;
    });
  }

  const ghostActions = Object.freeze([
    Object.freeze(['accept','Keep this suggestion']),
    Object.freeze(['dismiss','Dismiss'])
  ]);

  return {indexChildren, descendants, effectiveParent, visibleIds, ghostActions};
})();

if(typeof module !== 'undefined' && module.exports) module.exports = CascadeGraphModel;
