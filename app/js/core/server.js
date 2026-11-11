'use strict';
/* ================= server lifecycle (local version) ================= */
function renderServerInfo(){
  const sv = SRV && SRV.server; if(!sv) return;
  $('#sInfo').textContent = `Listening on http://localhost:${sv.port}` + (sv.port!==sv.preferred ? ` (port ${sv.preferred} was busy, so this one was chosen)` : '') + ` · process ${sv.pid}`;
}
function showBye(){ $('#bye').hidden = false; settingsEl.hidden = true; appEl.inert = true; }
function initServer(){
  syncers.push(renderServerInfo);
  const cid = Math.random().toString(36).slice(2);
  const hello = () => { fetch('/api/hello',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:cid}),keepalive:true}).catch(()=>{}); };
  hello();
  addEventListener('pageshow',e=>{ if(e.persisted) hello(); });
  addEventListener('pagehide',()=>{ try{ navigator.sendBeacon('/api/bye',new Blob([JSON.stringify({id:cid})],{type:'application/json'})); }catch(e){} });
  $('#sQuit').addEventListener('click',async()=>{ try{ await postJSON('/api/quit',{}); }catch(e){} showBye(); });
}

