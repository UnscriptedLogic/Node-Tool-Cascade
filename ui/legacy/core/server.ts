import * as CascadeUI from "../../runtime.tsx";
import { postJSON, SETTINGS } from "../ui/settings.ts";
import { UI } from "./state.ts";
export /* ================= server lifecycle (local version) ================= */
function showBye() {
	UI.bye = true;
	CascadeUI.sync(() => {
		SETTINGS.open = false;
	});
}
export function initServer() {
	const cid = Math.random().toString(36).slice(2);
	const hello = () => {
		fetch("/api/hello", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				id: cid,
			}),
			keepalive: true,
		}).catch(() => {});
	};
	hello();
	addEventListener("pageshow", (e) => {
		if (e.persisted) hello();
	});
	addEventListener("pagehide", () => {
		try {
			navigator.sendBeacon(
				"/api/bye",
				new Blob(
					[
						JSON.stringify({
							id: cid,
						}),
					],
					{
						type: "application/json",
					},
				),
			);
		} catch {}
	});
}
export async function quitCascade() {
	try {
		await postJSON("/api/quit", {});
	} catch {}
	showBye();
}
export function initialize() {}
