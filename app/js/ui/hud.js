'use strict';
/* ================= transient UI actions ================= */
function setBusy(message,stoppable){ CascadeUI.sync(()=>{ UI.busy=message; UI.stoppable=!!stoppable; }); }
let noteTimer=0;
function showNote(parts,withUndo){
  CascadeUI.sync(()=>{ UI.note=parts; UI.noteUndo=!!withUndo; UI.noteOpen=true; });
  clearTimeout(noteTimer); noteTimer=setTimeout(()=>{ UI.noteOpen=false; },16000);
}
function commit(){ layout(false); save(); }
function select(id){ S.sel=id; restyle(); kick(); }
