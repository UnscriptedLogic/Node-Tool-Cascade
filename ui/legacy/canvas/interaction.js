import { SETTINGS } from "../ui/settings.js";
import { renameNode } from "../core/tree.js";
import { stage, world } from "../core/dom.js";
import { R, S, UI, pushHist, save, state as coreStateState } from "../core/state.js";
import { closeCompose } from "../ui/compose.js";
import { commit, select, showNote } from "../ui/hud.js";
import { restyle } from "./layout.js";
import { flushView, scheduleView, zoomAt } from "./view.js";
import { acceptChain, descendants, expandChain, rebuildKM } from "../core/tree.js";
import { kick } from "./edges.js";
import { finishBlock } from "../features/map.js";
import { isMinimal, openCanvasMenu, openNodeMenu, runNodeAction, state as uiResponsiveState } from "../ui/responsive.js";
import { openNodeSrc } from "../features/project.js";
import { deleteNode, undo } from "../ui/actions.js";
export const state = {
  pan: undefined,
  pinch: undefined,
  nd: undefined,
  lastTap: undefined
};
export let ptrs;
export /* ================= canvas interaction ================= */
function dragUi(on) {
  document.body.classList.toggle('dragging', on);
  if (on) {
    try {
      getSelection().removeAllRanges();
    } catch (e) {}
  }
}
export function endPointer(e) {
  ptrs.delete(e.pointerId);
  if (!ptrs.size) dragUi(false);
  if (state.pinch && ptrs.size < 2) state.pinch = null;
  if (state.nd && e.pointerId === state.nd.pid) {
    const id = state.nd.id;
    if (state.nd.drag) {
      state.nd.set.forEach(x => {
        if (R[x]) R[x].dragging = false;
      });
      if (R[id]) R[id].drag = false;
      const t = state.nd.drop;
      if (t && R[t]) R[t].drop = false;
      if (t && S.nodes[t] && S.nodes[id] && t !== S.nodes[id].parent) {
        pushHist();
        const n = S.nodes[id];
        n.parent = t;
        n.rel = '';
        S.order = S.order.filter(x => x !== id);
        S.order.push(id);
        if (!n.ghost) acceptChain(t);
        expandChain(t);
        commit();
        showNote(['Moved under ', {
          b: `“${S.nodes[t].text}”`
        }, '.'], true);
      } else {
        restyle();
        kick();
      }
    } else if (S.nodes[id]) {
      const now = Date.now();
      if (coreStateState.linkFrom) {
        finishBlock(id);
        state.lastTap = {
          id: null,
          t: 0
        };
      } else if (isMinimal()) {
        select(id);
        state.lastTap = {
          id: null,
          t: 0
        };
        if (!uiResponsiveState.tapSuppressed) openNodeMenu(id, e.clientX, e.clientY);
      } // minimal layout: a tap opens the block's menu
      else if (state.lastTap.id === id && now - state.lastTap.t < 380) {
        beginEdit(id);
        state.lastTap = {
          id: null,
          t: 0
        };
      } else {
        select(id);
        state.lastTap = {
          id,
          t: now
        };
      }
    }
    state.nd = null;
  }
  if (state.pan) {
    const tapped = !state.pan.moved && e.type === 'pointerup' && !ptrs.size;
    state.pan = null;
    stage.classList.remove('panning');
    flushView();
    save();
    if (tapped && isMinimal() && !uiResponsiveState.tapSuppressed) openCanvasMenu(e.clientX, e.clientY); // minimal layout: a tap on empty space opens the menu
  } else if (!ptrs.size) flushView();
  if (!ptrs.size) uiResponsiveState.tapSuppressed = false;
}
export function beginEdit(id, opts) {
  const r = R[id],
    n = S.nodes[id];
  if (!r || !n) return;
  const txt = r.el.querySelector('.txt');
  r.editing = true;
  txt.contentEditable = 'true';
  txt.focus();
  if (opts && opts.graduate) showNote(['Rewrite it as a precise question, then press Enter.'], false);
  const range = document.createRange();
  range.selectNodeContents(txt);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  const finish = keep => {
    txt.removeEventListener('blur', onBlur);
    txt.removeEventListener('keydown', onKey);
    const v = txt.textContent.trim();
    txt.contentEditable = 'false';
    r.editing = false;
    if (keep && v && v !== n.text) {
      pushHist();
      renameNode(id,v);
      if (opts && opts.graduate && n.type === 'fog') {
        n.type = 'question';
        n.ticket = 'talk';
      }
    } else txt.textContent = n.text;
    commit();
  };
  const onBlur = () => finish(true);
  const onKey = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      txt.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      txt.removeEventListener('blur', onBlur);
      finish(false);
    }
  };
  txt.addEventListener('blur', onBlur);
  txt.addEventListener('keydown', onKey);
}
export function initialize() {
  document.addEventListener('selectstart', e => {
    if (document.body.classList.contains('dragging')) e.preventDefault();
  });
  document.addEventListener('dragstart', e => {
    const t = e.target && e.target.nodeType === 3 ? e.target.parentElement : e.target;
    if (t && t.closest && t.closest('#stage,#rail') && !t.closest('textarea,input')) e.preventDefault();
  });
  ptrs = new Map();
  state.pan = null;
  state.pinch = null;
  state.nd = null;
  state.lastTap = {
    id: null,
    t: 0
  };
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('#compose,.hud,.pending,.bar,#side,.srcmark,.mindset-label')) return;
    if (e.target.closest('[contenteditable="true"]')) return;
    dragUi(true);
    stage.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY
    });
    coreStateState.vAnim = null;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      state.pinch = {
        d: Math.hypot(a.x - b.x, a.y - b.y) || 1
      };
      state.pan = null;
      state.nd = null;
      stage.classList.remove('panning');
      return;
    }
    const nodeEl = e.target.closest('.node');
    if (nodeEl) {
      state.nd = {
        id: nodeEl.dataset.id,
        sx: e.clientX,
        sy: e.clientY,
        drag: false,
        pid: e.pointerId,
        set: null,
        drop: null
      };
    } else {
      state.pan = {
        sx: e.clientX,
        sy: e.clientY,
        vx: S.view.x,
        vy: S.view.y,
        moved: false
      };
      stage.classList.add('panning');
      if (UI.compose.open) closeCompose();
      if (S.sel) select(null);
      if (coreStateState.linkFrom) {
        coreStateState.linkFrom = null;
        restyle();
      }
    }
  });
  stage.addEventListener('pointermove', e => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY
    });
    if (state.pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()],
        d = Math.hypot(a.x - b.x, a.y - b.y) || 1,
        r = stage.getBoundingClientRect();
      zoomAt(d / state.pinch.d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, true);
      state.pinch.d = d;
      return;
    }
    if (state.nd && e.pointerId === state.nd.pid) {
      if (!state.nd.drag && Math.hypot(e.clientX - state.nd.sx, e.clientY - state.nd.sy) > 6) {
        const n = S.nodes[state.nd.id];
        if (n && n.parent && S.mode === 'detail') {
          rebuildKM();
          state.nd.set = new Set([state.nd.id, ...descendants(state.nd.id)]);
          state.nd.set.forEach(x => {
            if (R[x]) R[x].dragging = true;
          });
          R[state.nd.id].drag = true;
          state.nd.drag = true;
          state.nd.lx = e.clientX;
          state.nd.ly = e.clientY;
          select(state.nd.id);
        } else {
          state.nd = null;
        }
      }
      if (state.nd && state.nd.drag) {
        const dx = (e.clientX - state.nd.lx) / S.view.z,
          dy = (e.clientY - state.nd.ly) / S.view.z;
        state.nd.lx = e.clientX;
        state.nd.ly = e.clientY;
        state.nd.set.forEach(x => {
          const r = R[x];
          if (r && r.shown) {
            r.cur.x += dx;
            r.cur.y += dy;
          }
        });
        let t = null;
        for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
          const ne = el.closest && el.closest('.node');
          if (ne && !state.nd.set.has(ne.dataset.id)) {
            t = ne.dataset.id;
            break;
          }
        }
        if (t !== state.nd.drop) {
          if (state.nd.drop && R[state.nd.drop]) R[state.nd.drop].drop = false;
          state.nd.drop = t;
          if (t) R[t].drop = true;
          restyle();
        }
        kick();
      }
    } else if (state.pan) {
      if (!state.pan.moved && Math.hypot(e.clientX - state.pan.sx, e.clientY - state.pan.sy) > 8) state.pan.moved = true;
      S.view.x = state.pan.vx + (e.clientX - state.pan.sx);
      S.view.y = state.pan.vy + (e.clientY - state.pan.sy);
      scheduleView();
    }
  });
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  stage.addEventListener('wheel', e => {
    if (e.target.closest && e.target.closest('#side')) return;
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0016)), e.clientX - r.left, e.clientY - r.top, true);
  }, {
    passive: false
  });
  world.addEventListener('click', e => {
    const ml = e.target.closest('.mindset-label');
    if (ml) {
      e.stopPropagation();
      showNote([ml.title.replace(/\n/g, '. ')], false);
      return;
    }
    const sm = e.target.closest('.srcmark');
    if (sm) {
      e.stopPropagation();
      openNodeSrc(sm.closest('.node').dataset.id);
      return;
    }
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const id = b.closest('.node').dataset.id;
    e.stopPropagation();
    runNodeAction(b.dataset.act, id);
  });
  addEventListener('keydown', e => {
    if (e.target.matches && e.target.matches('input,select,textarea,[contenteditable="true"]')) return;
    if (SETTINGS.open) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    } else if (e.key === 'Escape') {
      closeCompose();
      select(null);
      if (coreStateState.linkFrom) {
        coreStateState.linkFrom = null;
        restyle();
      }
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) {
      e.preventDefault();
      deleteNode(S.sel, e.shiftKey);
    } else if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('node')) {
      select(e.target.dataset.id);
    }
  });
}
