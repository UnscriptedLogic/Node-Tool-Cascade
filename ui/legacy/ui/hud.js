import * as CascadeUI from "../../runtime.jsx";
import { S, UI, save } from "../core/state.js";
import { layout, restyle } from "../canvas/layout.js";
import { kick } from "../canvas/edges.js";
export const state = {
  noteTimer: undefined
};
export /* ================= transient UI actions ================= */
function setBusy(message, stoppable) {
  CascadeUI.sync(() => {
    UI.busy = message;
    UI.stoppable = !!stoppable;
  });
}
export function showNote(parts, withUndo) {
  CascadeUI.sync(() => {
    UI.note = parts;
    UI.noteUndo = !!withUndo;
    UI.noteOpen = true;
  });
  clearTimeout(state.noteTimer);
  state.noteTimer = setTimeout(() => {
    UI.noteOpen = false;
  }, 16000);
}
export function commit() {
  layout(false);
  save();
}
export function select(id) {
  S.sel = id;
  restyle();
  kick();
}
export function focusControl(id, select) {
  CascadeUI.sync(() => {
    UI.focus = {
      id,
      select: !!select
    };
  });
}
export function initialize() {
  state.noteTimer = 0;
}
