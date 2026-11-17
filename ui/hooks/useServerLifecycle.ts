import { useEffect } from "react";
import { LOCAL } from "../legacy/core/constants.ts";
import { onServerPageHide, onServerPageShow } from "../legacy/core/server.ts";
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
