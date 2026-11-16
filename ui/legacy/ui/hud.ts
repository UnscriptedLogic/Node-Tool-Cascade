let noteTimer: ReturnType<typeof setTimeout> | undefined;

import { flushSync } from "react-dom";
import { kick } from "../canvas/edges.ts";
import { layout, restyle } from "../canvas/layout.ts";
import { S, save, UI } from "../core/state.ts";
export /* ================= transient UI actions ================= */
function setBusy(message: string | null, stoppable?: boolean) {
	flushSync(() => {
		UI.busy = message;
		UI.stoppable = !!stoppable;
	});
}
export function showNote(parts, withUndo) {
	flushSync(() => {
		UI.note = parts;
		UI.noteUndo = !!withUndo;
		UI.noteOpen = true;
	});
	clearTimeout(noteTimer);
	noteTimer = setTimeout(() => {
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
	flushSync(() => {
		UI.focus = {
			id,
			select: !!select,
		};
	});
}
