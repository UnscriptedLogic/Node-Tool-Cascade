import { flushSync } from "react-dom";
import { postJSON, SETTINGS } from "../ui/settings.ts";
import { UI } from "./state.ts";
/* ================= server lifecycle (local version) ================= */
export function showBye() {
	UI.bye = true;
	flushSync(() => {
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
		}).catch(() => {
			/* Lifecycle notifications are best effort when the server is unavailable. */
		});
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
		} catch {
			/* Unloading must continue if the browser refuses the beacon. */
		}
	});
}
export async function quitCascade() {
	try {
		await postJSON("/api/quit", {});
	} catch {
		/* The server may close the connection while quitting. */
	}
	showBye();
}
