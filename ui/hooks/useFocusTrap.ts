import { type RefObject, useEffect } from "react";
export function useFocusTrap(
	element: RefObject<HTMLElement | null>,
	active: boolean,
) {
	useEffect(() => {
		const root = element.current;
		if (!active || !root) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Tab") return;
			const controls = [
				...root.querySelectorAll<HTMLElement>(
					"a[href],button,input,select,textarea,[tabindex]",
				),
			].filter(
				(node) =>
					node.tabIndex >= 0 &&
					!node.matches(":disabled") &&
					!node.closest("[hidden]"),
			);
			const first = controls[0],
				last = controls.at(-1);
			if (!first) {
				event.preventDefault();
				return;
			}
			const current = root.ownerDocument.activeElement;
			if (event.shiftKey && current === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && current === last) {
				event.preventDefault();
				first.focus();
			}
		};
		root.addEventListener("keydown", onKeyDown);
		return () => root.removeEventListener("keydown", onKeyDown);
	}, [active, element]);
}
