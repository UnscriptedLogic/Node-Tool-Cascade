import { useSnapshot } from 'valtio';
import { getLegacy } from '../bridge.js';
import template from '../templates/project-view.json';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const call=(name,...args)=>window[name](...args);
const attributes={class:'className',for:'htmlFor',maxlength:'maxLength',spellcheck:'spellCheck',autocomplete:'autoComplete'};
export default function Project() {
  const {PROJECTUI,PREFS,DOMAINS}=getLegacy(),ui=useSnapshot(PROJECTUI,{sync:true}),prefs=useSnapshot(PREFS,{sync:true});
  const project=ui.project,domain=DOMAINS[prefs.domain]||DOMAINS.general;
  function render(node,index,parent) {
    if(typeof node==='string') return node;
    const {tag,attrs,children}=node,id=attrs.id,props={key:id||index};
    for(const [name,value] of Object.entries(attrs)) props[attributes[name]||name]=['hidden','disabled'].includes(name)?true:value;
    let content=children;
    if(attrs['data-dom-text']) content=[domain[attrs['data-dom-text']]];
    if(attrs['data-dom-ph']) props.placeholder=domain[attrs['data-dom-ph']];
    const field={pPath:'path',pIgnore:'ignore',pInclude:'include',pBrief:'brief'}[id];
    if(field){props.value=ui[field];props.onChange=()=>{};props.onInput=e=>call(field==='brief'?'editProjectBrief':'setProjectField',...(field==='brief'?[e.currentTarget.value]:[field,e.currentTarget.value]));}
    if(id==='pPath') props.onKeyDown=e=>{if(e.key==='Enter'){e.preventDefault();call('projectScan');}};
    if(id==='pSummary'||id==='pBriefWrap') props.hidden=!project.has;
    if(id==='pDefaults') content=[project.has&&project.engineIgnore?.length?'Skipped automatically for '+project.engineLabel+': '+project.engineIgnore.join(', '):''];
    if(id==='pStats'){
      const counts=project.counts||{},skipped=Object.values(project.skipped||{}).reduce((a,b)=>a+b,0);
      return <div {...props}>{[['Engine',project.engineLabel],['Files read',String(counts.files)],['Text',counts.textKB+' KB · about '+call('fmtProjectNumber',counts.tokensEst||0)+' tokens'],['Skipped',String(skipped)]].map(([label,value])=><div key={label}><b>{value}</b>{label}</div>)}</div>;
    }
    if(id==='pDetail') content=[ui.detail];
    if(id==='pEstimate') content=[ui.estimate];
    if(id==='pBuild') content=[ui.buildLabel];
    if(id==='pMsg'){content=[ui.message];props.className=ui.messageClass;}
    if(id==='pProg'){content=[ui.progress];props.className=ui.progressClass;}
    if(id==='pRestore') props.hidden=!ui.canRestore;
    if(id==='pStop') props.hidden=!ui.busy;
    if(id==='pCancel') props.hidden=!ui.scanBusy;
    if(['pScan','pPick','pBuild','pSeed','pForget'].includes(id)) props.disabled=ui.busy||(id==='pScan'&&ui.scanBusy);
    if(parent?.attrs?.id==='pDepth'){props['aria-pressed']=String(ui.depth===attrs['data-val']);props.onClick=()=>call('setProjectDepth',attrs['data-val']);}
    const action={pPick:'projectPick',pScan:'projectScan',pCancel:'cancelProjectScan',pBuild:'buildBrief',pStop:'stopProject',pRestore:'restoreProjectBrief',pForget:'forgetProject'}[id];
    if(action) props.onClick=()=>call(action);
    if(id==='pSeed') props.onClick=()=>{call('closeSettings');call('seedFromProject');};
    if(id==='pUse'||id==='pAsk'){const key=id==='pUse'?'useProject':'askFiles';props.checked=prefs[key];props.onChange=e=>{PREFS[key]=e.currentTarget.checked;call('savePrefs');call('updatePreview');};}
    const Tag=tag==='button'&&!parent?.attrs?.id?.includes('Depth')?Button:tag==='input'&&attrs.type==='text'?Input:tag;
    return <Tag {...props}>{content.length?content.map((child,i)=>render(child,i,node)):undefined}</Tag>;
  }
  return template.map((node,i)=>render(node,i));
}
