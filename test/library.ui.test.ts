import assert from "node:assert/strict";
// The Library tab in the local app: several Cascades, folders, autosave of the open one, and switching between them.
import test from "node:test";
import * as imported0 from "./helpers/dom.ts";
import * as imported1 from "./helpers/dom.ts";
import { sleep, tick } from "./helpers/dom.ts";
import { bootServer, page } from "./helpers/server.ts";

const api = (s) => async (method, path, body?) => {
	const r = await fetch(`${s.base}/api/${path}`, {
		method,
		headers: { "content-type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
	});
	return r.json();
};
async function until(fn, ms = 4000) {
	const t0 = Date.now();
	while (Date.now() - t0 < ms) {
		if (await fn()) return true;
		await sleep(50);
	}
	return false;
}

test("library UI: appears in the local app, makes Cascades and folders, autosaves the open one and switches between them", async (t) => {
	const s = await bootServer(t, { env: {} }),
		j = api(s);
	const a = await page(s);
	await sleep(500);
	a.escape();
	assert.equal(a.$("#libOpen").hidden, false);
	a.click(a.$("#libOpen"));
	await tick();
	assert.equal(a.$("#libTab").hidden, false);
	assert.equal(
		a.$("#libSaveCur").hidden,
		false,
		"the tree you already have can be saved",
	);
	a.click(a.$("#libSaveCur"));
	assert.ok(
		await until(async () => (await j("GET", "library")).cascades.length === 1),
		"saved as a Cascade",
	);
	const first = (await j("GET", "library")).cascades[0];
	await tick();
	a.type(a.$(".lib-name-input"), "Roadmap");
	a.$(".lib-name-input").dispatchEvent(
		new a.w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
	);
	assert.ok(
		await until(
			async () => (await j("GET", "library")).cascades[0].name === "Roadmap",
		),
		"renamed",
	);
	assert.equal(a.$("#openName").hidden, false);
	assert.equal(
		a.$("#openName").textContent,
		"Roadmap",
		"the open Cascade is named under the logo",
	);

	// a new, empty Cascade; the one that was open is saved first
	a.click(a.$("#libNew"));
	assert.ok(
		await until(async () => (await j("GET", "library")).cascades.length === 2),
	);
	assert.equal(a.nodes().length, 0, "the new Cascade starts empty");
	a.type(a.$(".lib-name-input"), "Experiments");
	a.$(".lib-name-input").dispatchEvent(
		new a.w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
	);

	// work in it: the open Cascade autosaves
	a.click(a.$("#sClose"));
	await a.runRailAction("resetBtn");
	await sleep(300);
	assert.ok(a.nodes().length > 5);
	const second = (await j("GET", "library")).cascades.find(
		(c) => c.name === "Experiments" || c.id !== first.id,
	);
	assert.ok(
		await until(
			async () =>
				/Why is progress slower/.test(
					(await j("GET", `cascades/${second.id}`)).data.tree,
				),
			6000,
		),
		"the open Cascade autosaved the example tree",
	);

	// folders and moving
	a.click(a.$("#libOpen"));
	a.click(a.$("#libFolder"));
	assert.ok(
		await until(async () => (await j("GET", "library")).folders.length === 1),
	);
	a.type(a.$(".lib-name-input"), "Q3");
	a.$(".lib-name-input").dispatchEvent(
		new a.w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
	);
	await sleep(200);
	const folder = (await j("GET", "library")).folders[0];
	const folders = await a.openSelect(
		`.lib-row[data-id="${first.id}"] [role=combobox]`,
	);
	a.click(folders.find((option) => option.textContent === "Q3"));
	assert.ok(
		await until(
			async () =>
				(await j("GET", "library")).cascades.find((c) => c.id === first.id)
					.folderId === folder.id,
		),
		"moved into the folder",
	);
	assert.equal(a.$$(".lib-folder[data-folder] .lib-row").length, 1);
	assert.equal(
		a.$("#openName").textContent,
		"Experiments",
		"still working in the other Cascade",
	);
	a.click(a.$(`.lib-row[data-id="${first.id}"] .lib-open`));
	await sleep(400);
	assert.equal(a.$("#openName").textContent, "Q3 / Roadmap", "folder and name");
	a.click(a.$("#libOpen"));
	await tick();

	// Switching back restores the example tree saved in the second Cascade.
	a.click(a.$(`.lib-row[data-id="${second.id}"] .lib-open`));
	await sleep(500);
	assert.equal(
		a.api.library.currentId,
		second.id,
		"the second Cascade is the open one",
	);
	assert.ok(a.nodes().length > 5, "its tree is on the canvas");
	assert.deepEqual(a.errs, []);

	// deleting takes two clicks
	a.click(a.$("#libOpen"));
	await tick();
	const del = a.$(
		`.lib-row[data-id="${first.id}"] button[aria-label^="Delete"]`,
	);
	a.click(del);
	assert.equal(
		(await j("GET", "library")).cascades.length,
		2,
		"one click only arms it",
	);
	a.click(a.$(`.lib-row[data-id="${first.id}"] .btn.danger`));
	assert.ok(
		await until(async () => (await j("GET", "library")).cascades.length === 1),
		"second click deletes",
	);
});

test("library UI: the web build has no library unless a cloud backend answers", async () => {
	const { open, webHtml } = imported0;
	const a = open({
		html: webHtml(),
		url: "https://someone.github.io/cascade/",
	});
	await sleep(400);
	assert.equal(a.$("#libOpen"), null);
	a.openSettings();
	assert.equal(a.$("#libTab").hidden, true);
	assert.deepEqual(a.errs, []);
});

test("library UI: with a cloud backend the page shows Google sign-in, and the library only after signing in", async () => {
	const { open, webHtml } = imported1;
	let signedIn = false;
	const calls = [];
	const fetchImpl = async (u, o: RequestInit = {}) => {
		const p = String(u);
		calls.push(`${o.method || "GET"} ${p}`);
		const res = (body, status = 200) => ({
			ok: status < 400,
			status,
			headers: { get: () => "application/json" },
			json: async () => body,
		});
		if (p === "/api/config")
			return res({
				cloud: true,
				googleClientId: "test-client.apps.googleusercontent.com",
			});
		if (p === "/api/auth/me")
			return res({
				user: signedIn ? { email: "ada@example.com", name: "Ada" } : null,
			});
		if (p === "/api/library")
			return signedIn
				? res({
						folders: [],
						cascades: [
							{
								id: "c1",
								folderId: null,
								name: "Cloud one",
								domain: "research",
								createdAt: 1,
								updatedAt: 2,
							},
						],
					})
				: res({ error: "sign_in" }, 401);
		return res({ error: "nope" }, 404);
	};
	const a = open({
		html: webHtml(),
		url: "https://someone.github.io/cascade/",
		fetchImpl,
	});
	await sleep(500);
	assert.equal(a.$("#libOpen").hidden, false);
	a.click(a.$("#libOpen"));
	await tick();
	assert.equal(a.$("#libTab").hidden, false);
	assert.equal(a.$("#libAccount").hidden, false);
	assert.match(a.$("#libWho").textContent, /Sign in/);
	assert.equal(a.$("#libTools").hidden, true, "no tools until signed in");
	assert.equal(a.$$("#libList .lib-row").length, 0);
	signedIn = true;
	await a.api.refreshLibrary();
	await tick();
	assert.match(a.$("#libWho").textContent, /Ada/);
	assert.equal(a.$("#libTools").hidden, false);
	assert.equal(a.$$("#libList .lib-row").length, 1);
	assert.equal(a.$("#libList .lib-open").textContent, "Cloud one");
	a.api.library.cascades[0].name = "Renamed without libRender";
	await tick();
	assert.equal(
		a.$("#libList .lib-open").textContent,
		"Renamed without libRender",
	);
	const google = a.$("#libGoogle"),
		marker = a.d.createElement("span");
	marker.textContent = "Google-owned content";
	google.append(marker);
	a.api.library.status = "A status update";
	await tick();
	assert.equal(a.$("#libGoogle"), google);
	assert.equal(marker.parentNode, google);
});
