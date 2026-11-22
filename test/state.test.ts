import assert from "node:assert/strict";
import test from "node:test";
import { open, sleep } from "./helpers/dom.ts";

test("HUD and rail react to store writes without a manual refresh", async (t) => {
	const a = open();
	t.after(() => a.dom.window.close());
	await sleep(20);
	assert.equal(typeof a.w.updateHud, "undefined");
	a.api.prefs.goal = "A reactive destination";
	a.api.tree.mode = "outer";
	a.api.history.push({ s: a.api.serializeTree(), v: null });
	await sleep(0);
	assert.equal(a.$("#goalchip .gt").textContent, "A reactive destination");
	assert.equal(a.$("#mOuter").getAttribute("aria-pressed"), "true");
	assert.equal(a.$("#undoBtn").disabled, false);
	a.api.ui.library = {
		...a.api.library,
		kind: "local",
		user: null,
		currentId: "test",
		cascades: [
			{
				id: "test",
				name: "A new name",
				folderId: "folder",
				domain: "game",
				createdAt: 0,
				updatedAt: 0,
			},
		],
		folders: [{ id: "folder", name: "A folder", createdAt: 0 }],
	};
	await sleep(0);
	assert.equal(a.$("#openName .cn").textContent, "A new name");
	assert.equal(a.$("#openName .cf").textContent, "A folder / ");
	assert.equal(a.$("#openName").hidden, false);
	assert.deepEqual(a.errs, []);
});

test("side panels render streamed state as text and keep card edits reactive", async (t) => {
	const a = open();
	t.after(() => a.dom.window.close());
	await sleep(20);
	a.api.openSidePanel("ask");
	a.api.ask.summaryBusy = true;
	a.api.ask.summaryKind = "tree";
	a.api.ask.summary = "<img src=x onerror=alert(1)> First chunk";
	a.api.ask.busy = true;
	await sleep(0);
	assert.equal(a.$("#aSummaryWrap").hidden, false);
	assert.equal(
		a.$("#aSumText").textContent,
		"<img src=x onerror=alert(1)> First chunk",
	);
	assert.equal(
		a.$("#aSumText img"),
		null,
		"model text is never interpreted as HTML",
	);
	assert.equal(a.$("#aGo").disabled, true);
	a.api.ask.summary += " Second chunk";
	a.api.ask.busy = false;
	a.api.ask.summaryBusy = false;
	a.api.startResolve("n6");
	await sleep(0);
	assert.match(a.$("#aSumText").textContent, /First chunk Second chunk$/);
	assert.equal(a.$("#aGo").disabled, false);
	a.api.grill.cards[0].answer = "A draft answer";
	a.api.grill.cards[0].pushback = "<b>A challenge</b>";
	await sleep(0);
	assert.equal(a.$(".gcard textarea").value, "A draft answer");
	assert.equal(a.$(".gpush").textContent, "<b>A challenge</b>");
	assert.equal(a.$(".gpush b"), null);
	a.type(a.$(".gcard textarea"), "A revised answer");
	assert.equal(a.api.grill.cards[0].answer, "A revised answer");
	assert.deepEqual(a.errs, []);
});

test("settings reflect preference writes without reopening or manual syncing", async (t) => {
	const a = open();
	t.after(() => a.dom.window.close());
	await sleep(20);
	a.api.prefs.goal = "A goal from a legacy action";
	a.api.prefs.domain = "research";
	await sleep(0);
	assert.equal(a.$("#gGoal").value, "A goal from a legacy action");
	assert.equal(a.$("#gDomain").value, "research");
	assert.match(a.$("#gDomainHelp").textContent, /study/);
});

test("legacy state writes notify Valtio subscribers and snapshots preserve saved data", async (t) => {
	const a = open();
	t.after(() => a.dom.window.close());
	await sleep(20);
	const state = a.api.tree,
		prefs = a.api.prefs,
		lib = a.api.library;
	let updates = 0;
	const unsub = a.w.CascadeUI.subscribe(state, () => updates++);
	t.after(unsub);
	a.api.tree.nodes.n6.text = "A revised question";
	await Promise.resolve();
	assert.equal(updates, 1);
	assert.equal(
		a.w.CascadeUI.snapshot(state).nodes.n6.text,
		"A revised question",
	);
	a.api.pushHistory();
	a.api.clearGraph();
	a.api.undo();
	Object.assign(a.api.prefs, { goal: "A goal" });
	a.api.library.status = "Saved";
	assert.equal(a.api.tree, state);
	assert.equal(a.api.prefs, prefs);
	assert.equal(a.api.library, lib);
	assert.equal(state.nodes.n6.text, "A revised question");
	assert.equal(
		JSON.parse(a.api.serializeTree()).nodes.n6.text,
		"A revised question",
	);
});

test("canvas view mutations are untracked, including after clearing the tree", async (t) => {
	const a = open();
	t.after(() => a.dom.window.close());
	await sleep(20);
	const state = a.api.tree;
	let updates = 0;
	const unsub = a.w.CascadeUI.subscribe(state, () => updates++);
	t.after(unsub);
	state.view.x += 10;
	state.view.z = 2;
	await Promise.resolve();
	assert.equal(updates, 0);
	a.api.clearGraph();
	await Promise.resolve();
	updates = 0;
	state.view.x += 10;
	await Promise.resolve();
	assert.equal(updates, 0);
});
