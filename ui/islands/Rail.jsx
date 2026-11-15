import { useSnapshot } from 'valtio';
import { getLegacy } from '../bridge.js';
import { Button } from '@/components/ui/button';

const call=(name,...args)=>getLegacy().actions[name](...args);
export default function Rail() {
  const {UI,PREFS,DOMAINS,LABEL,ICONS,MOOD_KEYS,MOODS}=getLegacy(),ui=useSnapshot(UI,{sync:true}),prefs=useSnapshot(PREFS,{sync:true});
  const library=ui.library, signedIn=library&&(library.kind==='local'||library.user),current=library?.cascades.find(c=>c.id===library.currentId),folder=current?.folderId?library.folders.find(f=>f.id===current.folderId):null;
  return <aside id="rail">
    <h1 className="brand">Cascade<small>Drag a block onto the tree. It finds its place, then grows.</small></h1>
    <button id="openName" className={'openname'+(current?'':' unsaved')} type="button" hidden={!library?.kind||!signedIn} title={current?(folder?folder.name+' / ':'')+current.name+'. Open the library.':'This tree is not saved in your library. Open the library to save it.'} onClick={()=>call('openSettings','library')}><span className="cf">{folder?folder.name+' / ':''}</span><span className="cn">{current?current.name:'Not in your library yet'}</span></button>
    <div className="tiles" id="tiles">{['loop','question','answer','emotion','consequence','decision','fog'].map(type=><button className={'tile blk t-'+type} data-type={type} type="button" key={type}><span className="ico" dangerouslySetInnerHTML={{__html:ICONS[type]}}/><span className="txt">{LABEL[type]}</span></button>)}</div>
    <div className="legend"><h2 data-dom-text="feeling">{(DOMAINS[prefs.domain]||DOMAINS.general).feeling}</h2><ul id="legend">{MOOD_KEYS.map(key=><li key={key}><i style={{'--c':ui.moodColors[key]||MOODS[key].bg}}/>{key[0].toUpperCase()+key.slice(1)}</li>)}</ul></div>
    <button id="moreBtn" className="more" type="button" aria-label="More: menu" onPointerDown={e=>e.stopPropagation()} onClick={()=>call('openMoreMenu')}><svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="3" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="13" cy="8" r="1.4"/></svg><span>More</span></button>
    <div className="rail-foot"><Button className="btn" id="railLib" type="button" hidden={!library?.kind} onClick={()=>call('openSettings','library')}>Library</Button><Button className="btn" id="resetBtn" type="button" onClick={()=>call('resetTree')}>Load example</Button><Button className="btn" id="clearBtn" type="button" onClick={()=>call('clearGraph')}>Clear graph</Button></div>
  </aside>;
}
