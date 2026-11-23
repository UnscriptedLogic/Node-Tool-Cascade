import { flushSync } from "react-dom";
import { proxy } from "valtio/vanilla";
import { clearGraph, resetTree } from "./actions.ts";

export type GraphAction = "load-example" | "clear-graph";

// One confirmation for the destructive graph actions, wherever they start.
export const CONFIRM = proxy({
	pending: null as GraphAction | null,
	after: null as (() => void) | null,
});

// Where focus goes when the confirmation closes, if its opener is gone (a menu item).
let returnTo: string | null = null;
export const confirmReturnTarget = () => returnTo;

export function askConfirm(
	action: GraphAction,
	after?: () => void,
	focusId?: string,
) {
	returnTo = focusId || null;
	flushSync(() => {
		CONFIRM.pending = action;
		CONFIRM.after = after || null;
	});
}

export function cancelConfirm() {
	flushSync(() => {
		CONFIRM.pending = null;
		CONFIRM.after = null;
	});
}

export function acceptConfirm() {
	const { pending, after } = CONFIRM;
	cancelConfirm();
	if (pending === "load-example") resetTree();
	else if (pending === "clear-graph") clearGraph();
	else return;
	after?.();
}
