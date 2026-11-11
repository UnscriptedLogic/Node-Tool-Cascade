'use strict';
/* ================= controls ================= */
const stageCenter = () => ({x:stage.clientWidth/2,y:stage.clientHeight/2});
$('#zIn').addEventListener('click',()=>{ const c=stageCenter(); zoomAt(1.25,c.x,c.y); });
$('#zOut').addEventListener('click',()=>{ const c=stageCenter(); zoomAt(.8,c.x,c.y); });
$('#zFit').addEventListener('click',()=>fitTo(visibleIds(),{maxZ:1,minZ:isMobile() ? .6 : .3,pad:isMobile() ? 24 : 56}));
$('#mDetail').addEventListener('click',()=>setMode('detail'));
$('#mOuter').addEventListener('click',()=>setMode('outer'));
$('#undoBtn').addEventListener('click',undo);
$('#noteUndo').addEventListener('click',undo);
$('#resetBtn').addEventListener('click',resetTree);
$('#clearBtn').addEventListener('click',clearGraph);
$('#keepAll').addEventListener('click',keepAll);
$('#dismissAll').addEventListener('click',dismissAll);
stopBtn.addEventListener('click',()=>{ if(ctl) ctl.abort(); try{ if(AN.ctl) AN.ctl.abort(); }catch(e){} stopReveal = true; });
addEventListener('resize',applyView);

