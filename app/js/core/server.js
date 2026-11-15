'use strict';
/* ================= server lifecycle (local version) ================= */
function showBye(){ UI.bye=true; CascadeUI.sync(()=>{ SETTINGS.open=false; }); appEl.inert = true; }
function initServer(){
  const cid = Math.random().toString(36).slice(2);
  const hello = () => { fetch('/api/hello',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:cid}),keepalive:true}).catch(()=>{}); };
  hello();
  addEventListener('pageshow',e=>{ if(e.persisted) hello(); });
  addEventListener('pagehide',()=>{ try{ navigator.sendBeacon('/api/bye',new Blob([JSON.stringify({id:cid})],{type:'application/json'})); }catch(e){} });

}


async function quitCascade(){ try{ await postJSON('/api/quit',{}); }catch(e){} showBye(); }
