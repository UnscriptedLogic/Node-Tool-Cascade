'use strict';
/* ================= boot ================= */
applyLook({noSave:true});
layout(true);
applyView();
if(loaded && loaded.view && isFinite(loaded.view.z)){ Object.assign(S.view,loaded.view); applyView(); }
else initialView(true);
setBusy(null);
updateHud();
if(new URLSearchParams(location.search).has('code')) finishOpenRouterLogin();
else if(LOCAL && SRV && SRV.active==='demo'){
  try{ if(!localStorage.getItem('cascade-seen-settings')){ localStorage.setItem('cascade-seen-settings','1'); setTimeout(()=>openSettings('ai'),500); } }catch(e){}
}
