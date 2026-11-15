import { useLayoutEffect, useRef } from 'react';
import { useSnapshot } from 'valtio';
import { getLegacy } from '../bridge.js';
import { Button } from '@/components/ui/button';

const call=(name,...args)=>window[name](...args);
export default function Compose() {
  const {UI,PREFS,DOMAINS,LABEL,ICONS}=getLegacy(),ui=useSnapshot(UI,{sync:true}),prefs=useSnapshot(PREFS,{sync:true}),input=useRef(null);
  const compose=ui.compose,domain=DOMAINS[prefs.domain]||DOMAINS.general;
  useLayoutEffect(()=>{if(compose.open) input.current.focus();},[compose.open,compose.focus]);
  return <div id="compose" hidden={!compose.open} role="dialog" aria-label="New block" style={{width:compose.w,left:compose.x,top:compose.y}}>
    <div className="chead"><span className="ico" dangerouslySetInnerHTML={{__html:ICONS[compose.type]}}/><span className="cname">{LABEL[compose.type]}</span></div>
    <textarea ref={input} rows={2} maxLength={220} aria-label="Block text" placeholder={domain.blocks[compose.type]} value={compose.text} onChange={()=>{}} onInput={e=>{UI.compose.text=e.currentTarget.value;}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();call('submitCompose');}else if(e.key==='Escape'){e.preventDefault();call('closeCompose');}}}/>
    <div className="row"><span>Enter to place</span><span><Button className="btn" id="cCancel" type="button" onClick={()=>call('closeCompose')}>Cancel</Button>{' '}<Button className="btn primary" id="cOk" type="button" onClick={()=>call('submitCompose')}>Place</Button></span></div>
  </div>;
}
