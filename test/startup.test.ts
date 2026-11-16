import assert from "node:assert/strict";
import test from "node:test";
import imported0 from "../shared/mindset-presets.ts";
import { open, webHtml } from "./helpers/dom.ts";

test("startup: fresh canvases are empty in every domain, including the static build", (t) => {
	for (const domain of ["general", "game", "product", "research"]) {
		const a = open({
			example: false,
			html: webHtml(),
			local: { "cascade-prefs-v1": JSON.stringify({ domain }) },
		});
		t.after(() => a.dom.window.close());
		assert.equal(a.nodes().length, 0);
		assert.equal(a.$("#empty").hidden, false);
		assert.deepEqual(a.errs, []);
	}
});

test("startup: existing graphs restore while Load example still supplies the chosen domain sample", (t) => {
	const tree = {
		nodes: {
			n1: {
				id: "n1",
				type: "question",
				text: "Keep this saved question?",
				parent: null,
				ghost: false,
			},
		},
		order: ["n1"],
		links: [],
		seq: 1,
	};
	const a = open({
		example: false,
		local: {
			"cascade-tree-v1": JSON.stringify({
				tree: JSON.stringify(tree),
				view: { x: 12, y: 34, z: 0.8 },
			}),
		},
	});
	t.after(() => a.dom.window.close());
	assert.equal(a.nodes().length, 1);
	assert.ok(a.byText("Keep this saved question?"));
	a.click(a.$("#resetBtn"));
	assert.ok(a.nodes().length > 1);
	assert.ok(a.byText("Why does traversal feel slow?"));
	assert.deepEqual(a.errs, []);
});

test("startup: saved empty canvases preserve camera and imported mindsets on reload", (t) => {
	const preset = imported0[0];
	const tree = {
		nodes: {},
		order: [],
		links: [],
		seq: 7,
		mindsets: [{ ...preset, enabled: true }],
	};
	const view = { x: 20, y: 45, z: 0.75 };
	const a = open({
		example: false,
		local: {
			"cascade-tree-v1": JSON.stringify({ tree: JSON.stringify(tree), view }),
		},
	});
	t.after(() => a.dom.window.close());
	assert.equal(a.nodes().length, 0);
	const restored = JSON.parse(
		a.w.eval("JSON.stringify({view:S.view,mindsets:S.mindsets,seq:S.seq})"),
	);
	assert.deepEqual(restored.view, view);
	assert.equal(restored.seq, 7);
	assert.equal(restored.mindsets[0].id, preset.id);
	assert.deepEqual(a.errs, []);
});
