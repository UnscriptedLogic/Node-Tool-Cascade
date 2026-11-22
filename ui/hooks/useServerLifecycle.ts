import { useEffect } from "react";
import { LOCAL } from "../core/constants.ts";
import { onServerPageHide, onServerPageShow } from "../core/server.ts";
export function useServerLifecycle() {
	useEffect(() => {
		if (!LOCAL) return;
		window.addEventListener("pageshow", onServerPageShow);
		window.addEventListener("pagehide", onServerPageHide);
		return () => {
			window.removeEventListener("pageshow", onServerPageShow);
			window.removeEventListener("pagehide", onServerPageHide);
		};
	}, []);
}
