import { useSnapshot } from 'valtio';
import { getLegacy } from '../bridge.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const call = (name,...args)=>getLegacy().actions[name](...args);

export default function Providers() {
  const {SETTINGS,PROV,PROV_ORDER,LOCAL}=getLegacy();
  const state=useSnapshot(SETTINGS,{sync:true}), server=state.server;
  return <div id="provList">
    {PROV_ORDER.map(provider=>{
      const meta=PROV[provider], saved=server?.providers[provider], active=server?.active===provider;
      const draft=state.drafts[provider] || {}, result=state.results[provider] || {};
      const account=saved?.account;
      const draftInput=event=>{ const field=event.target.dataset.role || (event.target.type==='password'?'key':null); if(field) SETTINGS.drafts[provider]={...SETTINGS.drafts[provider],[field]:event.target.value}; };
      const model=provider==='demo'?null:<div className="field"><label htmlFor={'m-'+provider}>Model</label><div className="frow">
        <Input id={'m-'+provider} type="text" list={'ml-'+provider} data-role="model" autoComplete="off" spellCheck={false}
          value={draft.model || ''} onInput={draftInput} onChange={()=>{}} placeholder={saved?.defaultModel || meta.model || 'Choose one with Fetch models'} />
        <datalist id={'ml-'+provider}>{(state.models[provider] || []).map(id=><option key={id} value={id}/>)}</datalist>
        <Button className="btn" type="button" data-act="fetch">Fetch models</Button>
      </div><small data-role="modelhint">{!saved?.model && saved?.defaultModel?`Using the default, ${saved.defaultModel}.`:''}</small></div>;
      const test=provider==='demo'?null:<div className="frow"><Button className="btn primary" type="button" data-act="test" disabled={!!state.busy[provider]}>Test connection</Button>
        <span className={'result '+(result.cls || '')} data-role="result" aria-live="polite">{result.text || ''}</span></div>;
      return <section className={'prov'+(active?' active':'')} data-prov={provider} key={provider} hidden={!saved}
        onClick={e=>{const button=e.target.closest('button[data-act]');if(button)call('onProviderAction',provider,button.dataset.act);}}
        onChange={e=>{const input=e.target;call('onProviderChange',provider,input.type==='radio'?'active':input.dataset.role,input.value);}}>
        <header><label className="radio"><input type="radio" name="activeProv" value={provider} checked={!!active} onChange={()=>{}}/><span>{meta.label}</span></label>
          <span className={'tag'+(active&&saved?.ready?' on':'')} data-role="status" hidden={!active}>{saved?.ready?'In use':'Needs setup'}</span>
        </header><p className="sub">{meta.sub}</p>
        {provider==='chatgpt'?<>
          <div className="field"><span className="lbl">Account</span><div className="frow">
            <Button className="btn primary" type="button" data-act="cgSignIn" hidden={!!account}>Continue with ChatGPT</Button>
            <Button className="btn" type="button" data-act="cgConsent" hidden={!(account&&!account.planUsage)}>Allow plan usage</Button>
            <Button className="btn" type="button" data-act="cgSignOut" hidden={!account}>Sign out</Button>
          </div><small data-role="cgstate">{state.signingIn?'Waiting for you to finish in the other tab…':account?
            account.planUsage?`Signed in as ${account.email}. ChatGPT plan usage is allowed.`:`Signed in as ${account.email}, but ChatGPT plan usage wasn’t allowed.`:saved?.lastError || 'Not signed in.'}</small></div>
          {model}{test}<p className="small" style={{margin:'10px 0 16px',lineHeight:1.45}}>Needs ChatGPT Plus or Pro. Usage counts against your plan and any limit you set for this app. <a href="https://chatgpt.com/settings/usage" target="_blank" rel="noopener">Manage usage</a></p>
        </>:provider==='claudecode'?<>
          <div className="field"><span className="lbl">Claude Code</span><small data-role="ccstate">{saved?.installed?'Found on this computer. Use Test connection to check that it’s logged in.':'Not found. Install Claude Code, log in, then reopen Settings.'}</small></div>
          {model}{test}<p className="small" style={{margin:'10px 0 16px',lineHeight:1.45}}>Needs Claude Code, logged in with a Claude Pro or Max plan. Run <code>claude</code> once in a terminal. Usage counts against your plan’s limits. Each request starts Claude Code, so replies begin a second or two later than with an API key. Only for your own computer and account.</p>
        </>:provider!=='demo'?<>
          {provider==='openrouter'&&<div className="frow" style={{margin:'0 0 16px 27px'}}><Button className="btn primary" type="button" data-act="orSignIn">Continue with OpenRouter</Button></div>}
          <div className="field"><label htmlFor={'k-'+provider}>{provider==='openrouter'?'Or paste an API key':'API key'}</label><div className="frow">
            <Input id={'k-'+provider} type="password" autoComplete="off" spellCheck={false} placeholder={meta.key} value={draft.key || ''} onInput={draftInput} onChange={()=>{}}/>
            <Button className="btn" type="button" data-act="saveKey">Save key</Button><Button className="btn" type="button" data-act="rmKey" hidden={!(saved?.hasKey&&saved.source==='settings')}>Remove</Button>
          </div><small data-role="keyhint">{saved?.hasKey?saved.source==='env'?`Using the key from your environment (${saved.hint}). Saving one here overrides it.`:`Key saved ${LOCAL?'on this computer':'to your account, encrypted'} (${saved.hint}).`:provider==='custom'?'No key saved. Local models usually don’t need one.':'No key saved yet.'}</small></div>
          {model}<div className="field"><label htmlFor={'b-'+provider}>Base URL{provider==='custom'?'':' (optional)'}</label>
            <Input id={'b-'+provider} type="text" data-role="base" autoComplete="off" spellCheck={false} placeholder={meta.base} value={draft.base || ''} onInput={draftInput} onChange={()=>{}}/>
            <small>{provider==='custom'?'Required. Include the version path, usually ending in /v1.':'Only change this for a proxy or gateway.'}</small>
          </div>{test}
        </>:null}
      </section>;
    })}
  </div>;
}
