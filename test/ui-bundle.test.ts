import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { JSDOM } from "jsdom";
import { assemble, manifest } from "../scripts/assemble.ts";
import { open, sleep } from "./helpers/dom.ts";

for (const mode of ["artifact", "web", "local"]) {
	test(`UI bundle loads in ${mode} mode`, async (t) => {
		const runtime =
			mode === "artifact"
				? ""
				: mode === "web"
					? "<script>window.__WEB__=true;</script>"
					: '<script>window.__LOCAL__=true;window.__SETTINGS__={active:"demo",prefs:{},providers:{demo:{ready:true}}};</script>';
		const html = assemble({ inline: true, runtime });
		const fetchImpl = async () =>
			new Response(JSON.stringify({ folders: [], cascades: [] }), {
				headers: { "content-type": "application/json" },
			});
		const a = open({ html, example: false, fetchImpl });
		t.after(() => a.dom.window.close());
		await sleep(20);
		assert.equal(a.api.mode, mode);
		for (const name of [
			"proxy",
			"subscribe",
			"snapshot",
			"ref",
			"mount",
			"unmount",
		])
			assert.equal(typeof a.w.CascadeUI[name], "function", name);
		assert.deepEqual(a.errs, []);
		assert.ok(!/<script\b[^>]*\bsrc\s*=/i.test(html), "scripts are inline");
	});
}

test("UI bundle mounts once per name and releases its root", async (t) => {
	const dom = new JSDOM('<div id="island"></div>', {
		runScripts: "dangerously",
		pretendToBeVisual: true,
	});
	t.after(() => dom.window.close());
	const script = dom.window.document.createElement("script");
	script.textContent = fs.readFileSync(
		path.join(import.meta.dirname, "../app/gen/ui.js"),
		"utf8",
	);
	dom.window.document.head.append(script);
	const ui = dom.window.CascadeUI,
		el = dom.window.document.getElementById("island");
	assert.throws(() => ui.mount("missing", el), /Unknown Cascade UI island/);
	ui.register("example", () => "Mounted");
	assert.throws(() => ui.mount("example", null), /Missing container/);
	ui.mount("example", el);
	ui.mount("example", el);
	await sleep(30);
	assert.equal(el.textContent, "Mounted");
	assert.throws(
		() => ui.mount("example", dom.window.document.createElement("div")),
		/already mounted/,
	);
	assert.equal(ui.unmount("example"), true);
	assert.equal(el.textContent, "");
	assert.equal(ui.unmount("example"), false);
	ui.mount("example", el);
	await sleep(30);
	assert.equal(el.textContent, "Mounted");
	ui.unmount("example");
});

test("manifest uses one script bundle and emits only the expected files", () => {
	assert.deepEqual(manifest().js, ["gen/ui.js"]);
	assert.deepEqual(manifest().css, ["gen/ui.css"]);
	assert.deepEqual(
		fs.readdirSync(path.join(import.meta.dirname, "../app/gen")).sort(),
		["ui.css", "ui.js"],
	);
	assert.ok(
		assemble().includes("Copyright (c) 2023 shadcn"),
		"self-contained distribution retains the component license",
	);
});

test("production loads without exposing model globals", async (t) => {
	const a = open({ example: false });
	t.after(() => a.dom.window.close());
	await sleep(20);
	for (const name of [
		"S",
		"PREFS",
		"LIB",
		"layout",
		"applyView",
		"drawEdges",
		"openSettings",
	])
		assert.equal(a.w[name], undefined, name);
	assert.ok(a.api.tree);
	assert.equal("legacy" in a.w.CascadeUI, false);
	assert.equal(a.$("#rail").tagName, "ASIDE");
	assert.deepEqual(a.errs, []);
});
