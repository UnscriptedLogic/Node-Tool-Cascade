'use strict';
/* ================= controls ================= */
const stageCenter=()=>({x:stage.clientWidth/2,y:stage.clientHeight/2});
function zoomCanvas(factor){ const center=stageCenter(); zoomAt(factor,center.x,center.y); }
function fitCanvas(){ fitTo(visibleIds(),{maxZ:1,minZ:isMobile()?.6:.3,pad:isMobile()?24:56}); }
function stopCanvasAI(){ cancelAI(); }
addEventListener('resize',applyView);
