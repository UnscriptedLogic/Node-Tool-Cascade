import * as CascadeUI from "../../runtime.tsx";
import { kick } from "../canvas/edges.ts";
import { layout, restyle } from "../canvas/layout.ts";
import { S, save, UI } from "../core/state.ts";
export const state = {
	noteTimer: undefined,
};
export /* ================= transient UI actions ================= */
function setBusy(message: string | null, stoppable?: boolean) {
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
export function select(id: string | null) {
	S.sel = id;
	restyle();
	kick();
}
export function focusControl(id: string, select?: boolean) {
	CascadeUI.sync(() => {
		UI.focus = {
			id,
			select: !!select,
		};
	});
}
export function initialize() {
	state.noteTimer = 0;
}
