import { DOM } from "./profiles.js";
import { KEY, LOCAL } from "./constants.js";
import * as CascadeUI from "../../runtime.jsx";
import { Mindsets } from "./mindsets.js";
import { libAfterSave } from "../features/library.js";
export const state = {
  KM: undefined,
  flashId: undefined,
  vAnim: undefined,
  linkFrom: undefined,
  MAP: undefined,
  THMAP: undefined,
  THR: undefined,
  saveTimer: undefined
};
export let loaded, initialState, S, R, spawnAt, hist, snap, AI, UI;
export /* ================= state ================= */
function seed() {
  return DOM().sample();
}
export function load() {
  try {
    let o = window.__CASCADE_SAVED__;
    if (!o) {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      o = JSON.parse(raw);
    }
    const t = JSON.parse(o.tree);
    if (!t || !t.nodes || !Array.isArray(t.order)) return null;
    t.view = o.view;
    return t;
  } catch (e) {
    return null;
  }
}
export function save() {
  const payload = JSON.stringify({
    tree: snap(),
    view: S.view
  });
  try {
    localStorage.setItem(KEY, payload);
  } catch (e) {}
  if (typeof libAfterSave === 'function') libAfterSave();
  if (LOCAL) {
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => {
      fetch('/api/tree', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: payload
      }).catch(() => {});
    }, 400);
  }
}
export function pushHist(withView) {
  hist.push({
    s: snap(),
    v: withView ? {
      x: S.view.x,
      y: S.view.y,
      z: S.view.z
    } : null
  });
  if (hist.length > 40) hist.shift();
}
export function applySnap(s) {
  const o = JSON.parse(s);
  S.nodes = o.nodes;
  S.order = o.order;
  S.links = o.links;
  S.seq = o.seq;
  S.mindsets = Mindsets.collection(o.mindsets);
  if (!S.nodes[S.sel]) S.sel = null;
}
export function initialize() {
  loaded = load();
  initialState = Object.assign({
    view: {
      x: 0,
      y: 0,
      z: 1
    },
    mode: 'detail',
    layer: false,
    sel: null,
    nodes: {},
    order: [],
    links: [],
    seq: 0
  }, loaded || {});
  initialState.view = CascadeUI.ref(initialState.view && isFinite(initialState.view.z) ? initialState.view : {
    x: 0,
    y: 0,
    z: 1
  });
  S = CascadeUI.proxy(initialState);
  S.mode = 'detail';
  S.sel = null;
  try {
    S.mindsets = Mindsets.collection(S.mindsets);
  } catch (e) {
    S.mindsets = [];
  }
  R = {};
  state.KM = {};
  spawnAt = {};
  hist = CascadeUI.proxy([]);
  state.flashId = null;
  state.vAnim = null;
  state.linkFrom = null;
  state.MAP = {
    frontier: [],
    blocked: [],
    settled: [],
    fog: [],
    out: [],
    flag: {}
  };
  state.THMAP = {};
  state.THR = [];
  snap = () => JSON.stringify({
    nodes: S.nodes,
    order: S.order,
    links: S.links,
    seq: S.seq,
    mindsets: S.mindsets
  });
  state.saveTimer = 0;
  AI = CascadeUI.proxy({
    checked: false,
    sample: null,
    off: false
  });
  UI = CascadeUI.proxy({
    focus: null,
    bye: false,
    busy: null,
    stoppable: false,
    note: [],
    noteOpen: false,
    noteUndo: false,
    small: false,
    minimal: false,
    panel: null,
    ask: null,
    library: null,
    seed: false,
    providerLabels: {},
    settingsTitle: 'Settings',
    moodColors: {},
    compose: {
      open: false,
      type: 'question',
      text: '',
      x: 0,
      y: 0,
      w: 300,
      wpos: null,
      focus: 0
    },
    menu: null
  });
}
