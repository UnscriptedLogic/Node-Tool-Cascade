import { useEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { getLegacy } from '../bridge.js';
import LegacyTemplate from '../components/LegacyTemplate.jsx';
import template from '../templates/mindsets-view.json';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const call=(name,...args)=>window[name](...args);
function MindsetIcon({pack}){
  const [value,setValue]=useState(pack.icon);
  useEffect(()=>setValue(pack.icon),[pack.icon]);
  return <Input type="text" maxLength={16} value={value} aria-label={'Icon for '+pack.name} onChange={()=>{}} onInput={e=>setValue(e.currentTarget.value)} onBlur={()=>{if(value!==pack.icon)call('changeMindsetIcon',pack.id,value);}}/>;
}
function context(state,prefs){
  const parts=[],seen=new Set();let node=state.nodes[state.sel];
  while(node&&!seen.has(node.id)&&seen.size<3){seen.add(node.id);parts.push(node.text);node=state.nodes[node.parent];}
  return parts.length?parts.join('\n'):[prefs.goal,prefs.context,...state.order.filter(id=>state.nodes[id]&&!state.nodes[id].ghost).slice(0,20).map(id=>state.nodes[id].text)].join('\n');
}
export default function Mindsets(){
  const {S,PREFS,MSUI,DOMAINS,MINDSET_PRESETS,Mindsets}=getLegacy(),state=useSnapshot(S,{sync:true}),prefs=useSnapshot(PREFS,{sync:true}),ui=useSnapshot(MSUI,{sync:true}),file=useRef(null);
  const topic=context(state,prefs);
  const bind=({attrs})=>{
    if(attrs.id==='msJson')return {value:ui.json,onChange:()=>{},onInput:e=>{MSUI.json=e.currentTarget.value;}};
    if(attrs.id==='msMsg')return {children:ui.message};
    if(attrs.id==='msEmpty')return {hidden:state.mindsets.length>0};
    if(attrs.id==='msFile')return {ref:file,onChange:async e=>{const input=e.currentTarget;await call('importMindsetFile',input.files[0]);input.value='';}};
    const action={msPasteImport:'importMindsetJson',msExample:'downloadMindsetExample'}[attrs.id];
    if(action)return {onClick:()=>call(action)};
    if(attrs.id==='msImport')return {onClick:()=>file.current.click()};
    return {};
  };
  const replace=({attrs})=>{
    if(attrs.id==='msConverter')return <div key="converter" id="converterRoot"/>;
    if(attrs.id==='msBuiltins')return <div key={attrs.id} id={attrs.id}>{MINDSET_PRESETS.map(preset=>{
      const pack=Mindsets.pack(preset),installed=state.mindsets.find(p=>p.id===pack.id);
      return <section className="card mindset-builtin" key={pack.id}><strong>{pack.icon+' '+pack.name}</strong><p className="small">{`Included · Game design only · ${pack.source.edition}. ${pack.source.coverage}`}</p><div className="frow"><Button type="button" className="btn primary" disabled={!!installed?.enabled} onClick={()=>call('enableBuiltinMindset',pack.id)}>{installed?.enabled?'Enabled in this Cascade':'Enable starter mindset'}</Button><Button type="button" className="btn" onClick={()=>call('downloadBuiltinMindset',pack.id)}>Download starter JSON</Button><a href={pack.source.url} target="_blank" rel="noopener">Source reference</a></div></section>;
    })}</div>;
    if(attrs.id==='msList')return <div key={attrs.id} id={attrs.id}>{state.mindsets.map(pack=>{
      const candidates=Mindsets.candidates(state.mindsets,prefs.domain,topic,pack.id);
      return <section className="card mindset-pack" data-pack={pack.id} key={pack.id}>
        <label className="check"><input type="checkbox" checked={pack.enabled} aria-label={'Enable '+pack.name} onChange={e=>call('enableMindset',pack.id,e.currentTarget.checked)}/><strong>{pack.name}</strong></label>
        <p className="small">{`${pack.entries.length} ${pack.entries.length===1?'entry':'entries'} · ${pack.domains.map(d=>DOMAINS[d].label).join(', ')}${pack.source.title?' · '+pack.source.title+(pack.source.edition?' ('+pack.source.edition+')':''):''}`}</p>
        {pack.source.coverage&&<p className="small">{pack.source.coverage}</p>}
        <label className="field">Node icon<MindsetIcon pack={pack}/></label>
        <p className="small">{!pack.domains.includes(prefs.domain)?'Inactive in this domain.':!pack.enabled?'Disabled for this Cascade.':`${candidates.length} matching ${candidates.length===1?'entry':'entries'} for ${state.sel?'the selected branch':'this tree'}.`}</p>
        <div className="frow"><Button type="button" className="btn" disabled={!state.sel||!candidates.length} onClick={()=>{call('closeSettings');call('applyMindset',state.sel,pack.id);}}>Apply to selected node</Button><Button type="button" className="btn" onClick={()=>call('exportMindset',pack.id)}>Export pack</Button><Button type="button" className="btn" onClick={()=>call('removeMindset',pack.id)}>Remove</Button></div>
      </section>;
    })}</div>;
  };
  return <LegacyTemplate nodes={template} bind={bind} replace={replace}/>;
}
