'use strict';
/* Domain-specific settings read the active profile through the preferences proxy. */
function applyDomain(){
  const D = DOM();
  document.querySelectorAll('[data-dom-text]').forEach(el=>{ if(el.closest('#settingsRoot')) return; const v=D[el.dataset.domText]; if(typeof v==='string') el.textContent=v; });
  document.querySelectorAll('[data-dom-ph]').forEach(el=>{ if(el.closest('#settingsRoot')) return; const v=D[el.dataset.domPh]; if(typeof v==='string') el.placeholder=v; });
}
applyDomain();
