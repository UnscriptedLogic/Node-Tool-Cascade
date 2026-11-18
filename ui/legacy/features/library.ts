import { proxy } from "valtio/vanilla";
import Mindsets from "../../../shared/mindsets.ts";
import { record } from "../../../shared/types.ts";
import { cancelAI } from "../ai/prompts.ts";
import { layout } from "../canvas/layout.ts";
import { applyView } from "../canvas/view.ts";
import { ANALYTICS } from "../core/analytics.ts";
import { CONNECTION, LOCAL, PREFS, WEB } from "../core/constants.ts";
import { DEFAULT_DOMAIN } from "../core/profiles.ts";
import { decodeSavedTree } from "../core/saved-tree.ts";
import {
	AI,
	state as coreStateState,
	hist,
	onTreeSaved,
	S,
	save,
	snap,
	UI,
} from "../core/state.ts";
import { initialView } from "../ui/actions.ts";
import {
	closeSettings,
	SETTINGS,
	savePrefs,
	updatePreview,
	updateProviders,
} from "../ui/settings.ts";
export let LIB = null;
LIB = proxy({
	kind: null,
	user: null,
	folders: [],
	cascades: [],
	currentId: null,
	googleClientId: "",
	status: "",
	editing: null,
	armed: null,
	suspend: false,
	timer: 0,
	gsi: false,
});
onTreeSaved(libAfterSave);
export async function libApi(method, path, body?) {
	const r = await fetch(`/api/${path}`, {
		method,
		credentials: "same-origin",
		headers: body
			? {
					"content-type": "application/json",
				}
			: {},
		body: body ? JSON.stringify(body) : undefined,
	});
	let j = null;
	try {
		j = await r.json();
	} catch {
		/* Use the HTTP status if the reply has no JSON body. */
	}
	if (!r.ok) {
		const err = new Error((j && (j.detail || j.error)) || `HTTP ${r.status}`);
		Object.assign(err, { status: r.status });
		throw err;
	}
	return j;
}
export function libRemember(id: null) {
	LIB.currentId = id;
	try {
		if (id)
			localStorage.setItem(
				LIB_CURRENT,
				JSON.stringify({
					kind: LIB.kind,
					id,
				}),
			);
		else localStorage.removeItem(LIB_CURRENT);
	} catch {}
}
// "Folder / Name" of the open Cascade, shown under the logo so it is always clear what you are working on
export function libSetStatus(t: string) {
	LIB.status = t;
}

// what a saved Cascade holds
export function libData() {
	const prefs = {};
	for (const k of ["domain", "goal", "context", "pillars", "avoid", "steer"])
		prefs[k] = PREFS[k];
	return {
		tree: snap(),
		view: {
			x: S.view.x,
			y: S.view.y,
			z: S.view.z,
		},
		prefs,
	};
}
// called by save(): keep the open Cascade up to date, a moment after the last change
export function libAfterSave() {
	if (!LIB.kind || !LIB.currentId || LIB.suspend || !libSignedIn()) return;
	clearTimeout(LIB.timer);
	LIB.timer = setTimeout(async () => {
		const id = LIB.currentId;
		if (!id) return;
		try {
			const m = await libApi("PUT", `cascades/${id}`, {
				data: libData(),
			});
			const c = LIB.cascades.find((x) => x.id === id);
			if (c) Object.assign(c, m);
			libSetStatus("Saved to your library.");
		} catch (e) {
			libSetStatus(`Could not save to the library: ${e.message}`);
		}
	}, 1200);
}
export async function libRefresh() {
	if (LIB.kind === "cloud") {
		try {
			LIB.user = (await libApi("GET", "auth/me")).user;
		} catch {
			LIB.user = null;
		}
		if (!LIB.user) {
			LIB.folders = [];
			LIB.cascades = [];
			await cloudAiRefresh();

			return;
		}
	}
	await cloudAiRefresh();
	try {
		const l = await libApi("GET", "library");
		LIB.folders = l.folders;
		LIB.cascades = l.cascades;
	} catch (e) {
		libSetStatus(`Could not load the library: ${e.message}`);
	}
	if (!libCurrent()) libRemember(null);
}

/* ---- opening, creating, moving, deleting ---- */
export function libApply(data) {
	LIB.suspend = true;
	cancelAI();
	try {
		const parsed: unknown = JSON.parse(data.tree);
		const t = decodeSavedTree(parsed);
		if (!t) throw new Error("That file doesn’t look like a Cascade tree.");
		const mindsets = Mindsets.collection(t.mindsets);
		S.nodes = t.nodes;
		S.order = t.order;
		S.links = t.links || [];
		S.seq = t.seq || S.order.length;
		S.sel = null;
		S.mode = "detail";
		hist.length = 0;
		S.mindsets = mindsets;
		Object.assign(
			PREFS,
			{
				goal: "",
				context: "",
				pillars: "",
				avoid: "",
			},
			data.prefs || {},
		);
		savePrefs();
		updatePreview();
		layout(false);
		if (data.view) {
			coreStateState.vAnim = null;
			Object.assign(S.view, data.view);
			applyView();
		} else initialView();
		save();
	} finally {
		LIB.suspend = false;
	}
}
export async function libOpen(id) {
	clearTimeout(LIB.timer);
	try {
		const c = await libApi("GET", `cascades/${id}`);
		libApply(c.data);
		libRemember(id);
		closeSettings();
	} catch (e) {
		libSetStatus(`Could not open that Cascade: ${e.message}`);
	}
}
export function libBlankData() {
	const prefs = {
		domain: PREFS.domain || DEFAULT_DOMAIN,
		goal: "",
		context: "",
		pillars: "",
		avoid: "",
		steer: PREFS.steer,
	};
	return {
		tree: JSON.stringify({
			nodes: {},
			order: [],
			links: [],
			seq: 0,
		}),
		view: {
			x: 0,
			y: 0,
			z: 1,
		},
		prefs,
	};
}
export async function libCreate(data, name, folderId) {
	const m = await libApi("POST", "cascades", {
		name,
		folderId: folderId || null,
		data,
	});
	LIB.cascades.unshift(m);
	return m;
}
export async function libNewCascade(folderId) {
	try {
		// what you have open now is saved first, so nothing is lost by starting fresh
		clearTimeout(LIB.timer);
		if (LIB.currentId)
			await libApi("PUT", `cascades/${LIB.currentId}`, {
				data: libData(),
			});
		const m = await libCreate(libBlankData(), "Untitled Cascade", folderId);
		libApply(JSON.parse(JSON.stringify(libBlankData())));
		libRemember(m.id);
		LIB.editing = {
			kind: "cascade",
			id: m.id,
		};
	} catch (e) {
		libSetStatus(`Could not create a Cascade: ${e.message}`);
	}
}
export async function libSaveCurrent() {
	try {
		const m = await libCreate(libData(), "My Cascade", null);
		libRemember(m.id);
		LIB.editing = {
			kind: "cascade",
			id: m.id,
		};
		libSetStatus("Saved. This Cascade now keeps itself up to date.");
	} catch (e) {
		libSetStatus(`Could not save: ${e.message}`);
	}
}
export async function libNewFolder() {
	try {
		const f = await libApi("POST", "folders", {
			name: "New folder",
		});
		LIB.folders.push(f);
		LIB.editing = {
			kind: "folder",
			id: f.id,
		};
	} catch (e) {
		libSetStatus(`Could not create a folder: ${e.message}`);
	}
}
export async function libRename(kind, id, name) {
	LIB.editing = null;
	name = (name || "").trim();
	const item = (kind === "folder" ? LIB.folders : LIB.cascades).find(
		(x) => x.id === id,
	);
	if (!item || !name || name === item.name) return;
	try {
		await libApi(
			kind === "folder" ? "PATCH" : "PUT",
			(kind === "folder" ? "folders/" : "cascades/") + id,
			{
				name,
			},
		);
		item.name = name.slice(0, 80);
	} catch (e) {
		libSetStatus(`Could not rename: ${e.message}`);
	}
}
export async function libMove(id, folderId) {
	try {
		const m = await libApi("PUT", `cascades/${id}`, {
			folderId: folderId || null,
		});
		Object.assign(
			LIB.cascades.find((c) => c.id === id),
			m,
		);
	} catch (e) {
		libSetStatus(`Could not move it: ${e.message}`);
	}
}
export async function libDelete(kind: string, id) {
	try {
		await libApi("DELETE", (kind === "folder" ? "folders/" : "cascades/") + id);
		if (kind === "folder") {
			const gone = LIB.cascades
				.filter((c) => c.folderId === id)
				.map((c) => c.id);
			LIB.folders = LIB.folders.filter((f) => f.id !== id);
			LIB.cascades = LIB.cascades.filter((c) => c.folderId !== id);
			if (gone.includes(LIB.currentId)) libRemember(null);
		} else {
			LIB.cascades = LIB.cascades.filter((c) => c.id !== id);
			if (LIB.currentId === id) libRemember(null);
		}
	} catch (e) {
		libSetStatus(`Could not delete: ${e.message}`);
	}
	LIB.armed = null;
}

/* ---- the list ---- */
/* ---- AI through the account (cloud only) ---- */
// Signed in on the cloud, the AI settings screen and every AI call use the account's saved keys, through the server.
export async function cloudAiRefresh() {
	if (LIB.kind !== "cloud") return;
	if (LIB.user) {
		try {
			CONNECTION.server = await libApi("GET", "settings");
			CONNECTION.cloud = true;
			AI.off = false;
		} catch {
			CONNECTION.cloud = false;
			CONNECTION.server = null;
		}
	} else {
		CONNECTION.cloud = false;
		CONNECTION.server = null;
	}
	SETTINGS.cloud = CONNECTION.cloud;
	SETTINGS.server = CONNECTION.server;
	SETTINGS.googleClientId = LIB.googleClientId;
	SETTINGS.analytics = ANALYTICS.on;
	updateProviders();
}

/* ---- Google sign-in (cloud only) ---- */
export function libMountGoogle(host: HTMLElement) {
	if (!LIB.googleClientId) {
		host.textContent = "Google sign-in is not set up on this server yet.";
		return;
	}
	if (LIB.gsi && window.google && google.accounts) {
		libDrawGoogle(host);
		return;
	}
	if (document.getElementById("gsi-script")) return;
	const s = document.createElement("script");
	s.id = "gsi-script";
	s.src = "https://accounts.google.com/gsi/client";
	s.async = true;
	s.onload = () => {
		LIB.gsi = true;
	};
	s.onerror = () => {
		if (!host.isConnected) return;
		host.textContent = "Could not load Google sign-in. Check your connection.";
	};
	document.head.append(s);
}
export function libDrawGoogle(host: HTMLElement) {
	if (!host.isConnected) return;
	host.textContent = "";
	google.accounts.id.initialize({
		client_id: LIB.googleClientId,
		callback: libGoogleDone,
		ux_mode: "popup",
	});
	google.accounts.id.renderButton(host, {
		theme: "outline",
		size: "large",
		text: "signin_with",
	});
}
export async function libGoogleDone(resp) {
	try {
		const r = await libApi("POST", "auth/google", {
			credential: resp.credential,
		});
		LIB.user = r.user;
		libSetStatus("");
		await libRefresh();
	} catch (e) {
		libSetStatus(`Sign-in did not work: ${e.message}`);
	}
}
export async function libSignOut() {
	try {
		await libApi("POST", "auth/logout", {});
	} catch {
		/* Clear local sign-in state even if logout cannot reach the server. */
	}
	LIB.user = null;
	cloudAiRefresh();
	libRemember(null);
	LIB.folders = [];
	LIB.cascades = [];
}
export async function libDeleteAccount() {
	if (LIB.armed !== "account") {
		LIB.armed = "account";
		setTimeout(() => {
			if (LIB.armed === "account") {
				LIB.armed = null;
			}
		}, 5000);
		return;
	}
	try {
		await libApi("DELETE", "auth/account");
	} catch (e) {
		libSetStatus(`Could not delete the account: ${e.message}`);
		return;
	}
	LIB.armed = null;
	LIB.user = null;
	cloudAiRefresh();
	libRemember(null);
	LIB.folders = [];
	LIB.cascades = [];
}

/* ---- start-up: find out which library (if any) this page can use ---- */
export async function libInit() {
	if (LOCAL) LIB.kind = "local";
	else if (WEB) {
		try {
			const r = await fetch("/api/config");
			if (r.ok && (r.headers.get("content-type") || "").includes("json")) {
				const c = await r.json();
				if (c?.cloud) {
					LIB.kind = "cloud";
					LIB.googleClientId = c.googleClientId || "";
					ANALYTICS.on = !!c.analytics;
				}
			}
		} catch {
			/* Keep the current local configuration if account discovery fails. */
		}
	}
	if (!LIB.kind) return;
	try {
		const value: unknown = JSON.parse(
			localStorage.getItem(LIB_CURRENT) || "null",
		);
		const saved = record(value);
		if (saved.kind === LIB.kind && typeof saved.id === "string")
			LIB.currentId = saved.id;
	} catch {}
	SETTINGS.library = true;
	await libRefresh();
}
export const LIB_CURRENT: string = "cascade-current-v1";
export const libSignedIn = () => LIB.kind === "local" || !!LIB.user;
export const libCurrent = () =>
	LIB.cascades.find((c) => c.id === LIB.currentId) || null;

export function startLibrary() {
	UI.library = LIB;
}
