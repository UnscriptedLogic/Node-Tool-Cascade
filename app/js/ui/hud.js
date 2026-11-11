'use strict';
/* ================= HUD ================= */
let busyMsg = null;
function idleText(){
  if(aiChecked && (LOCAL || WEB) && activeProvider()==='demo') return 'Demo mode: the AI is scripted. Drag a block onto the canvas to try it.';
  return aiChecked && !aiAvailable() ? ((LOCAL || WEB) ? 'No AI connected, so blocks place by keyword' : 'Claude isn’t available here, so blocks place by keyword') : 'Drag a block onto the canvas, then type your idea';
}
function syncExtras(){
  const demo = (LOCAL || WEB) && activeProvider()==='demo';
  const l = $('#setLink'); l.hidden = !((LOCAL || WEB) && aiChecked && !busyMsg && (!aiAvailable() || demo));
  l.textContent = demo ? 'Connect an AI' : 'Open settings';
}
function updateGoalChip(){ const g = (PREFS.goal||'').trim(), c = $('#goalchip'); c.classList.toggle('unset',!g); c.querySelector('.gl').textContent = g ? 'Goal' : 'No goal set'; c.querySelector('.gt').textContent = g || ''; c.title = g ? g : 'Set an overarching goal to steer the questions'; }
function setBusy(msg,stoppable){
  busyMsg = msg;
  status.classList.toggle('busy', !!msg);
  stxt.textContent = msg || idleText();
  stopBtn.hidden = !(msg && stoppable);
  syncExtras();
}
function updateHud(){
  const g = Object.values(S.nodes).filter(n=>n.ghost).length;
  $('#ghostbar').hidden = !(g>0 && S.mode==='detail');
  $('#gcount').textContent = `${g} suggested ${g===1?'node':'nodes'}`;
  $('#undoBtn').disabled = hist.length===0;
  $('#empty').hidden = S.order.length>0;
  $('#mDetail').setAttribute('aria-pressed', S.mode==='detail');
  $('#mOuter').setAttribute('aria-pressed', S.mode==='outer');
  if(!busyMsg) stxt.textContent = idleText();
  syncExtras(); updateGoalChip(); renderMapIfOpen(); try{ pruneThreads(); }catch(e){}
  try{ syncProjectButtons(); }catch(e){}
}
let noteTimer = 0;
function showNote(parts,withUndo){
  ntxt.textContent = '';
  parts.forEach(p=>{ if(typeof p==='string') ntxt.appendChild(document.createTextNode(p)); else { const b=document.createElement('b'); b.textContent=p.b; ntxt.appendChild(b); } });
  $('#noteUndo').hidden = !withUndo;
  note.hidden = false;
  clearTimeout(noteTimer); noteTimer = setTimeout(()=>{ note.hidden = true; }, 16000);
}
function commit(){ layout(false); save(); updateHud(); }
function select(id){ S.sel = id; restyle(); kick(); }

