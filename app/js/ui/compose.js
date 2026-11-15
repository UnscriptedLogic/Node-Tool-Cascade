'use strict';
/* ================= compose + palette ================= */
function closeCompose(){ CascadeUI.sync(()=>{ UI.compose.open=false; }); }
function openCompose(type,cx,cy){
  const sr=stage.getBoundingClientRect(),w=Math.min(300,sr.width-24);
  const x=clamp(cx-sr.left-24,12,sr.width-w-12),y=clamp(cy-sr.top-24,100,Math.max(100,sr.height-190));
  CascadeUI.sync(()=>{ Object.assign(UI.compose,{type,wpos:screenToWorld(cx,cy),x,y,w,text:'',open:true,focus:UI.compose.focus+1}); });
}
function submitCompose(){
  if(!UI.compose.open) return;
  const text=UI.compose.text.trim(); if(!text){ UI.compose.focus++; return; }
  const {type,wpos,x,y}=UI.compose; closeCompose();
  const pend = document.createElement('div');
  pend.className = 'pending blk t-'+type; pend.style.left = x+'px'; pend.style.top = y+'px';
  pend.innerHTML = '<span class="ico"></span><span class="txt"></span>';
  pend.querySelector('.ico').innerHTML = ICONS[type]; pend.querySelector('.txt').textContent = text;
  decorate(pend,type,null); pend.style.width = nodeW(type)+'px';
  stage.appendChild(pend);
  enqueue(async()=>{
    const c = new AbortController(); ctl = c;
    try{ await placeBlock(type,text,wpos,pend,c.signal); }
    finally{ ctl = null; pend.remove(); if(!queued || queued===1) setBusy(null); }
  });
}
document.querySelectorAll('.tile').forEach(t=>{
  const type = t.dataset.type;
  t.addEventListener('click',e=>{ if(e.detail===0){ const sr = stage.getBoundingClientRect(); openCompose(type,sr.left+sr.width/2,sr.top+sr.height/2); } });
  t.addEventListener('pointerdown',e=>{
    e.preventDefault(); dragUi(true);
    const sx = e.clientX, sy = e.clientY; let moved = false, chip = null, finished = false;
    const mv = ev => {
      if(!moved && Math.hypot(ev.clientX-sx,ev.clientY-sy)>6){
        moved = true; chip = t.cloneNode(true); chip.id = 'chip'; chip.removeAttribute('data-type'); chip.className = 'blk t-'+type; chip.style.cssText='';
        chip.innerHTML = `<span class="ico">${ICONS[type]}</span><span class="txt">${LABEL[type]}</span>`; decorate(chip,type,null,{tile:true});
        document.body.appendChild(chip); stage.classList.add('droptarget');
      }
      if(chip) chip.style.transform = `translate(${ev.clientX+10}px,${ev.clientY+10}px)`;
    };
    const up = ev => {
      if(finished) return; finished = true; dragUi(false);
      removeEventListener('pointerup',up);
      removeEventListener('pointermove',mv); removeEventListener('pointercancel',up);
      if(chip) chip.remove(); stage.classList.remove('droptarget');
      const sr = stage.getBoundingClientRect();
      const inside = ev.clientX>sr.left && ev.clientX<sr.right && ev.clientY>sr.top && ev.clientY<sr.bottom;
      if(!moved) openCompose(type,sr.left+sr.width/2,sr.top+sr.height/2);
      else if(inside && ev.type==='pointerup') openCompose(type,ev.clientX,ev.clientY);
    };
    addEventListener('pointermove',mv); addEventListener('pointerup',up); addEventListener('pointercancel',up);
  });
});

