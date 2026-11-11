'use strict';
/* ================= domain: what this tree is about ================= */
// Writes the active profile's words into the page (labels, placeholders, goal examples) and wires the picker.
function applyDomain(){
  const D = DOM();
  document.querySelectorAll('[data-dom-text]').forEach(el=>{ const v = D[el.dataset.domText]; if(typeof v==='string') el.textContent = v; });
  document.querySelectorAll('[data-dom-ph]').forEach(el=>{ const v = D[el.dataset.domPh]; if(typeof v==='string') el.placeholder = v; });
  const chips = $('#gChips'); chips.textContent = '';
  D.goalChips.forEach(t=>{ const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = t; chips.appendChild(b); });
  const sel = $('#gDomain'); if(sel.value!==(PREFS.domain || DEFAULT_DOMAIN)) sel.value = PREFS.domain || DEFAULT_DOMAIN;
  $('#gDomainHelp').textContent = D.blurb + ' This sets the words the AI uses and the example tree. Your blocks stay as they are.';
}
(function(){
  const sel = $('#gDomain');
  Object.keys(DOMAINS).forEach(id=>{ const o = document.createElement('option'); o.value = id; o.textContent = DOMAINS[id].label; sel.appendChild(o); });
  sel.addEventListener('change',()=>{ PREFS.domain = sel.value; savePrefs(); applyDomain(); updatePreview(); });
  syncers.push(applyDomain);
  applyDomain();
})();
