import { useSnapshot } from 'valtio';
import { getLegacy } from '../bridge.js';
import { Button } from '@/components/ui/button';

const call=(name,...args)=>window[name](...args);
export default function SourceViewer() {
  const source=useSnapshot(getLegacy().SV,{sync:true}),current=source.list[source.i];
  return <div id="srcview" role="dialog" aria-modal="true" aria-labelledby="svTitle" hidden={!source.open}>
    <div className="svcard">
      <header><b id="svTitle">{current?current.f+':'+current.l+(current.e>current.l?'-'+current.e:''):''}</b><Button className="btn" id="svClose" type="button" onClick={()=>call('closeSrcView')}>Close</Button></header>
      <p id="svNote" className="svnote" hidden={!current?.note}>{current?.note}</p>
      <pre id="svCode" className="svcode">{source.loading?'Loading…':source.error||source.lines.map(line=><div className={'ln'+(line.hit?' hit':'')} key={line.number}><span className="no">{line.number}</span><span>{line.text||' '}</span></div>)}</pre>
      <footer><span id="svPos" className="small">{source.list.length>1?`${source.i+1} of ${source.list.length}`:''}</span><span><Button className="btn" id="svPrev" type="button" disabled={source.list.length<2} onClick={()=>call('stepSource',-1)}>Previous</Button>{' '}<Button className="btn" id="svNext" type="button" disabled={source.list.length<2} onClick={()=>call('stepSource',1)}>Next</Button>{' '}<Button className="btn" id="svCopy" type="button" onClick={()=>call('copySource')}>{source.copyText}</Button></span></footer>
    </div>
  </div>;
}
