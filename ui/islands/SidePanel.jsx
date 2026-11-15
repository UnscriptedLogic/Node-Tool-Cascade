import { useLayoutEffect, useRef } from 'react';
import { useSnapshot } from 'valtio';
import { getLegacy } from '../bridge.js';
import { Button } from '@/components/ui/button';

const call=(name,...args)=>window[name](...args);

function Card({card,hidden}) {
  const input=useRef(null),{TICKET_ASK,TICKET_LABEL,Mindsets}=getLegacy();
  useLayoutEffect(()=>{if(card.focus) input.current.focus();},[card.focus]);
  const done=card.status!=='open';
  const tag=!card.grillable?'Talking probably won’t settle this. A prototype may be faster.':card.ticket!=='talk'?TICKET_LABEL[card.ticket]+' ticket':'';
  const action=(kind)=>call('grillAction',card.id,kind);
  return <div className={'gcard'+(done?' done':'')} data-cid={card.id} hidden={hidden}>
    <div className="gq">{(card.mindset?Mindsets.label(card.mindset)+' — ':'')+card.text}</div>
    <div className="gwhy" hidden={!card.why}>{card.why}</div><div className="gtag" hidden={!tag}>{tag}</div>
    <textarea ref={input} className="area gans" rows={3} placeholder={TICKET_ASK[card.ticket]} value={card.answer} disabled={done||card.busy} onChange={()=>{}} onInput={e=>call('setGrillAnswer',card.id,e.currentTarget.value)}/>
    <div className="gpush" hidden={done||!card.pushback}>{card.pushback}</div>
    <div className="gbtns" hidden={done}>
      <Button type="button" className="btn primary" data-gact="answer" disabled={card.busy} onClick={()=>action('answer')}>{card.busy?card.busyLabel:card.checks>0?'Answer again':'Answer'}</Button>
      <Button type="button" className="btn" data-gact="standby" hidden={!card.pushback} disabled={card.busy} onClick={()=>action('standby')}>Stand by it</Button>
      {[['idk','I don’t know'],['proto','Needs a prototype'],['out','Out of scope'],['skip','Skip']].map(([kind,label])=><Button type="button" className="btn" key={kind} data-gact={kind} hidden={kind==='proto'&&card.ticket==='prototype'} disabled={card.busy} onClick={()=>action(kind)}>{label}</Button>)}
    </div>
    <div className="gstate" hidden={!done}>{card.message}{card.withPrototype&&<Button type="button" className="btn" data-gact="toproto" onClick={()=>action('toproto')}>Make it a prototype</Button>}</div>
  </div>;
}

export default function SidePanel() {
  const {PANEL,G,S,PREFS,TICKET_LABEL}=getLegacy();
  const panel=useSnapshot(PANEL,{sync:true}), grill=useSnapshot(G,{sync:true}),state=useSnapshot(S,{sync:true}),prefs=useSnapshot(PREFS,{sync:true});
  const map=panel.map, total=map?map.settled.length+map.frontier.length+map.blocked.length:0;
  const hint=panel.hint || (!(prefs.goal||'').trim()?'Name the destination first. Everything on the map is measured against it.':map&&total&&!map.frontier.length&&!map.blocked.length&&!map.fog.length?'The map is clear. Nothing is left to decide before you build.':map&&!total&&!map.fog.length?'Chart the map to draft decision tickets, or grill the tree to find them.':map?.fog.length&&!map.frontier.length&&!map.blocked.length?'Only fog is left. Sharpen it into questions once you can phrase them.':'');
  const scope=grill.scope&&state.nodes[grill.scope], firstOpen=grill.cards.find(card=>card.status==='open');
  function section(title,ids,kind) {
    if(!ids?.length) return null;
    return <div className="msec" key={title}><h4><div>{title}</div><span>{ids.length}</span></h4>{ids.slice(0,14).map(id=>{
      const node=state.nodes[id]; if(!node) return null;
      const waiting=kind==='blocked'?(map.blockers[id]||[]).map(key=>state.nodes[key]).find(n=>n&&n.state!=='settled'&&n.state!=='out'):null;
      const answers=kind==='settled'?state.order.map(key=>state.nodes[key]).filter(n=>n&&n.parent===id&&n.type==='answer'&&!n.ghost):[];
      const decision=(answers.find(n=>n.decided)||answers[0])?.text||'';
      const action={frontier:['resolve','Resolve'],settled:['reopen','Reopen'],fog:['sharpen','Sharpen'],out:['restore','Bring back']}[kind];
      return <div className="mitem" data-id={id} tabIndex={0} key={id} onClick={event=>{const button=event.target.closest('button[data-act]');call('mapAction',id,button?.dataset.act);}}>
        <div>{node.text}</div>{decision&&<div className="dec">{'→ '+decision}</div>}
        <div className="mrow2">{['frontier','blocked'].includes(kind)&&<span className="chip2">{TICKET_LABEL[node.ticket||'talk']}</span>}
          {kind==='blocked'&&<span className="chip2">{waiting?'after: '+waiting.text.slice(0,32):'waiting'}</span>}
          {action&&<Button type="button" className="btn" data-act={action[0]}>{action[1]}</Button>}
        </div>
      </div>;
    })}{ids.length>14&&<div className="small">and {ids.length-14} more</div>}</div>;
  }
  return <aside id="side" hidden={!panel.open} aria-label="Map and grill">
    <header className="sidehead"><div className="seg" role="group" aria-label="Panel">{[['map','Map'],['grill','Grill'],['ask','Ask']].map(([key,label])=><button type="button" key={key} id={'st'+label} aria-pressed={String(panel.tab===key)} onClick={()=>call('showStab',key)}>{label}</button>)}</div><Button className="btn" id="sideClose" type="button" onClick={()=>call('closeSide')}>Close</Button></header>
    <div className="sidebody">
      <section id="s-map" hidden={panel.tab!=='map'}><div className="msec"><h4>Destination</h4><textarea id="mDest" className="area" rows={2} maxLength={600} placeholder="What does the finished map look like?" value={prefs.goal} onChange={()=>{}} onInput={e=>call('setDestination',e.currentTarget.value)}/>
        <div className="mrow"><div className="prog"><i id="mProg" style={{width:(total?Math.round(map.settled.length/total*100):0)+'%'}}/></div><span id="mProgTxt" className="small">{total?`${map.settled.length} of ${total} settled`:'No decisions yet'}</span></div>
        <div className="mrow"><Button className="btn primary" id="mChart" type="button" onClick={()=>call('chartMap')}>Chart the map</Button><Button className="btn" id="mGrillAll" type="button" onClick={()=>call('startGrill',null)}>Grill me</Button><Button className="btn" id="mSeed" type="button" hidden={!panel.canSeed} onClick={()=>call('seedFromProject')}>Seed from project</Button></div><small id="mHint">{hint}</small>
      </div><div id="mLists">{map&&[section('Up next',map.frontier,'frontier'),section('Waiting',map.blocked,'blocked'),section('Decisions so far',map.settled,'settled'),section('Fog',map.fog,'fog'),section('Out of scope',map.out,'out')]}</div></section>
      <section id="s-grill" hidden={panel.tab!=='grill'}>
        <div id="gIdle" hidden={grill.active}><p className="gintro">A grill is an interview. The AI asks, you decide, and it pushes back when an answer looks weak. It never writes an answer for you. Each question you settle lands on the canvas as a decision. “I don’t know” is a real answer, and if talking can’t settle something, make it a prototype.</p><div className="mrow"><Button className="btn primary" id="gStartAll" type="button" onClick={()=>call('startGrill',null)}>Grill the whole tree</Button><Button className="btn" id="gStartSel" type="button" onClick={()=>call('startGrill',state.nodes[state.sel]?state.sel:null)}>Grill the selected node</Button></div><small id="gIdleMsg" className="gnote" hidden={!panel.idleMessage}>{panel.idleMessage}</small></div>
        <div id="gSession" hidden={!grill.active}><div className="ghead"><span id="gScope">{grill.resolve?'Resolving one question':scope?'Grilling: '+scope.text.slice(0,44):'Grilling the whole tree'}</span><span id="gRound">{grill.resolve?'':'Round '+grill.round}</span></div>
          <div id="gCards">{grill.cards.map(card=><Card key={card.id} card={card} hidden={prefs.grillStyle==='single'&&!grill.resolve&&card.status==='open'&&card.id!==firstOpen?.id}/>)}</div>
          <small id="gNote" className="gnote" hidden={!panel.grillNote}>{panel.grillNote}</small><div id="gDone" className="gdone" hidden={!panel.doneMessage}>{panel.doneMessage}</div>
          <div className="gfoot"><Button className="btn primary" id="gNext" type="button" hidden={grill.resolve||grill.done} disabled={grill.busy} onClick={()=>call('nextRound')}>{grill.busy?'Asking…':'Next round'}</Button><Button className="btn" id="gEnd" type="button" onClick={()=>{call('resetG');PANEL.idleMessage='';call('renderGrillShell');}}>End session</Button></div>
        </div>
      </section>
      <section id="s-ask" hidden={panel.tab!=='ask'}><div id="askRoot"/></section>
    </div>
  </aside>;
}
