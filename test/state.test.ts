import assert from "node:assert/strict";
import test from "node:test";
import { open, sleep } from "./helpers/dom.ts";

test("HUD and rail react to store writes without a manual refresh", async (t) => {
	const a = open();
	t.after(() => a.dom.window.close());
	await sleep(20);
	assert.equal(a.w.eval("typeof updateHud"), "undefined");
	a.w.eval(
		"PREFS.goal='A reactive destination'; S.mode='outer'; hist.push({s:snap(),v:null})",
	);
	await sleep(0);
	assert.equal(a.$("#goalchip .gt").textContent, "A reactive destination");
	assert.equal(a.$("#mOuter").getAttribute("aria-pressed"), "true");
	assert.equal(a.$("#undoBtn").disabled, false);
	a.w.eval(
		"UI.library={kind:'local',user:null,currentId:'test',cascades:[{id:'test',name:'A new name',folderId:'folder'}],folders:[{id:'folder',name:'A folder'}]}",
	);
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
	a.w.eval(
		"openSide('ask'); AN.summaryBusy=true; AN.summaryKind='tree'; AN.summary='<img src=x onerror=alert(1)> First chunk'; AN.busy=true",
	);
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
	a.w.eval(
		"AN.summary+=' Second chunk'; AN.busy=false; AN.summaryBusy=false; startResolve('n6')",
	);
	await sleep(0);
	assert.match(a.$("#aSumText").textContent, /First chunk Second chunk$/);
	assert.equal(a.$("#aGo").disabled, false);
	a.w.eval(
		"G.cards[0].answer='A draft answer'; G.cards[0].pushback='<b>A challenge</b>'",
	);
	await sleep(0);
	assert.equal(a.$(".gcard textarea").value, "A draft answer");
	assert.equal(a.$(".gpush").textContent, "<b>A challenge</b>");
	assert.equal(a.$(".gpush b"), null);
	a.type(a.$(".gcard textarea"), "A revised answer");
	assert.equal(a.w.eval("G.cards[0].answer"), "A revised answer");
	assert.deepEqual(a.errs, []);
});

test("settings reflect preference writes without reopening or manual syncing", async (t) => {
	const a = open();
	t.after(() => a.dom.window.close());
	await sleep(20);
	a.w.eval("PREFS.goal='A goal from a legacy action'; PREFS.domain='research'");
	await sleep(0);
	assert.equal(a.$("#gGoal").value, "A goal from a legacy action");
	assert.equal(a.$("#gDomain").value, "research");
	assert.match(a.$("#gDomainHelp").textContent, /study/);
});

test("legacy state writes notify Valtio subscribers and snapshots preserve saved data", async (t) => {
	const a = open();
	t.after(() => a.dom.window.close());
	await sleep(20);
	const state = a.w.eval("S"),
		prefs = a.w.eval("PREFS"),
		lib = a.w.eval("LIB");
	let updates = 0;
	const unsub = a.w.CascadeUI.subscribe(state, () => updates++);
	t.after(unsub);
	a.w.eval("S.nodes.n6.text = 'A revised question'");
	await Promise.resolve();
	assert.equal(updates, 1);
	assert.equal(
		a.w.CascadeUI.snapshot(state).nodes.n6.text,
		"A revised question",
	);
	a.w.eval(
		"pushHist(); clearGraph(); undo(); Object.assign(PREFS,{goal:'A goal'}); LIB.status='Saved'",
	);
	assert.equal(a.w.eval("S"), state);
	assert.equal(a.w.eval("PREFS"), prefs);
	assert.equal(a.w.eval("LIB"), lib);
	assert.equal(state.nodes.n6.text, "A revised question");
	assert.equal(
		JSON.parse(a.w.eval("snap()")).nodes.n6.text,
		"A revised question",
	);
});

test("canvas view mutations are untracked, including after clearing the tree", async (t) => {
	const a = open();
	t.after(() => a.dom.window.close());
	await sleep(20);
	const state = a.w.eval("S");
	let updates = 0;
	const unsub = a.w.CascadeUI.subscribe(state, () => updates++);
	t.after(unsub);
	state.view.x += 10;
	state.view.z = 2;
	await Promise.resolve();
	assert.equal(updates, 0);
	a.w.eval("clearGraph()");
	await Promise.resolve();
	updates = 0;
	state.view.x += 10;
	await Promise.resolve();
	assert.equal(updates, 0);
});
