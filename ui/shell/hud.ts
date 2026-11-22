import { type FocusTarget, focusRequest } from "../stores/focus.ts";

let noteTimer: ReturnType<typeof setTimeout> | undefined;

import { flushSync } from "react-dom";
import { kick } from "../canvas/edges.ts";
import { layout, restyle } from "../canvas/layout.ts";
import { S, save, UI } from "../core/state.ts";
/* ================= transient UI actions ================= */
export function setBusy(message: string | null, stoppable?: boolean) {
	UI.busy = message;
	UI.stoppable = !!stoppable;
}
export function showNote(parts, withUndo) {
	// Source-label clicks read the note before returning (test/mindsets.test.ts:311).
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
export function requestFocus(target: FocusTarget, select?: boolean) {
	Object.assign(focusRequest, {
		target,
		select: !!select,
		revision: focusRequest.revision + 1,
	});
}
