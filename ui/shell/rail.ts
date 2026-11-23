import { flushSync } from "react-dom";
import { proxy } from "valtio/vanilla";
import { applyView } from "../canvas/view.ts";
import { UI } from "../core/state.ts";

const KEY = "cascade-rail-v1";

function savedDesktop() {
	try {
		return localStorage.getItem(KEY) !== "closed";
	} catch {
		return true;
	}
}

// The sidebar stays open on desktop unless the viewer closed it. On small screens it starts closed.
export const RAIL = proxy({
	desktop: savedDesktop(),
	mobile: false,
});

export const railOpen = () => (UI.small ? RAIL.mobile : RAIL.desktop);

export function setRailOpen(open: boolean) {
	flushSync(() => {
		if (UI.small) RAIL.mobile = open;
		else RAIL.desktop = open;
	});
	if (UI.small) return;
	try {
		localStorage.setItem(KEY, open ? "open" : "closed");
	} catch {}
	// The canvas changes width with the sidebar.
	applyView();
}
