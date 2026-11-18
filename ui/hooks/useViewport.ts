import { useEffect } from "react";
import { applyView } from "../legacy/canvas/view.ts";
import {
	cancelViewportUpdate,
	onResize,
	updateKeyboard,
} from "../legacy/shell/responsive.ts";
export function useViewport() {
	useEffect(() => {
		const viewport = window.visualViewport;
		window.addEventListener("resize", applyView);
		window.addEventListener("resize", onResize);
		window.addEventListener("orientationchange", onResize);
		viewport?.addEventListener("resize", updateKeyboard);
		return () => {
			window.removeEventListener("resize", applyView);
			window.removeEventListener("resize", onResize);
			window.removeEventListener("orientationchange", onResize);
			viewport?.removeEventListener("resize", updateKeyboard);
			cancelViewportUpdate();
		};
	}, []);
}
