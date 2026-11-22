import { flushSync } from "react-dom";
import type { ACT } from "../core/constants.ts";

export type NodeAction = [action: keyof typeof ACT, label: string];

export interface NodeControls {
	actions: NodeAction[];
	mindset: { label: string; details: string } | null;
	source: string | null;
}

const controlsByNode = new Map<HTMLDivElement, NodeControls>();
const listeners = new Set<() => void>();
let snapshot: [HTMLDivElement, NodeControls][] = [];
let dirty = false;

export function setNodeControls(
	el: HTMLDivElement,
	controls: NodeControls | null,
) {
	if (controls) {
		controlsByNode.set(el, controls);
		dirty = true;
	} else if (controlsByNode.delete(el)) {
		dirty = true;
	}
}

export function subscribeNodeControls(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function getNodeControls() {
	return snapshot;
}

export function syncNodeControls() {
	if (!dirty) return;
	dirty = false;
	snapshot = [...controlsByNode];
	// The mindset label contributes to the height measured by the canvas layout.
	flushSync(() => {
		for (const listener of listeners) listener();
	});
}
