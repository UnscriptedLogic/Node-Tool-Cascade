import { useLayoutEffect, useRef } from 'react';
import { useSnapshot } from 'valtio';
import { getLegacy } from '../bridge.js';

const call=(name,...args)=>getLegacy().actions[name](...args);
export default function Menu() {
  const ui=useSnapshot(getLegacy().UI,{sync:true}),element=useRef(null),menu=ui.menu;
  useLayoutEffect(()=>{
    if(!menu) return;
    call('setMenuElement',element.current);
    const node=element.current,pad=8;
    if(!menu.at.sheet){
      node.style.maxHeight=(window.innerHeight-2*pad)+'px';
      const width=node.offsetWidth,height=node.offsetHeight;
      const x=Math.min(Math.max(pad,menu.at.x-width/2),window.innerWidth-width-pad);
      let y=menu.at.y+10;
      if(y+height>window.innerHeight-pad) y=Math.max(pad,Math.min(menu.at.y-height-10,window.innerHeight-height-pad));
      node.style.left=x+'px';node.style.top=y+'px';
    }
    if(menu.focus) node.querySelector('button:not([disabled])')?.focus({preventScroll:true});
  },[menu]);
  if(!menu) return null;
  const {spec,at}=menu;
  return <>{at.sheet&&<div id="ctxBack"/>}<div ref={element} id="ctx" role="menu" className={at.sheet?'sheet':''}>
    {(spec.back||spec.title)&&<div className="ctx-head">{spec.back&&<button type="button" className="ctx-back" aria-label="Back" onClick={()=>call('backMenu')}><svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg></button>}<span className="ctx-title">{spec.title||''}</span></div>}
    {spec.items.map((item,i)=>item.sep?<div className="ctx-sep" key={i}/>:<button type="button" role="menuitem" key={i} disabled={!!item.disabled} className={item.danger?'danger':undefined} onClick={()=>call('chooseMenuItem',i)}><span className="ic" dangerouslySetInnerHTML={{__html:item.icon||''}}/><span className="lb">{item.label}</span>{item.sub&&<span className="chev">›</span>}</button>)}
  </div></>;
}
