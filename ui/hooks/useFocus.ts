import { useLayoutEffect, useRef } from "react";
import { useSnapshot } from "valtio";
import { type FocusTarget, focusRequest } from "../stores/focus.ts";
export function useFocus<T extends HTMLElement>(target: FocusTarget) {
	const element = useRef<T>(null);
	const {
		target: requestedTarget,
		select,
		revision,
	} = useSnapshot(focusRequest, { sync: true });
	useLayoutEffect(() => {
		const node = element.current;
		if (!node || requestedTarget !== target) return;
		node.focus();
		if (
			select &&
			(node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement)
		)
			node.select();
	}, [requestedTarget, select, revision, target]);
	return element;
}
