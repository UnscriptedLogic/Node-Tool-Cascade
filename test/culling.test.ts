// In a big tree most blocks are off screen. Hiding the ones that cannot be seen is what keeps panning smooth on a phone.

import assert from "node:assert/strict";
import test from "node:test";
import { open, sleep } from "./helpers/dom.ts";

const GAME = { "cascade-prefs-v1": JSON.stringify({ domain: "game" }) };

test("culling: in a big tree far-away blocks are hidden, never the selected one, and they return when panned to", async () => {
	const a = open({ local: GAME });
	await sleep(400);
	const st = a.$("#stage");
	Object.defineProperty(st, "clientWidth", { value: 400, configurable: true });
	Object.defineProperty(st, "clientHeight", { value: 700, configurable: true });
	const { tree } = a.api;
	const nodes: typeof tree.nodes = {};
	const order: string[] = [];
	let seq = 0;
	const add = (type: string, text: string, parent: string | null) => {
		const id = `n${++seq}`;
		nodes[id] = { id, type, text, parent, ghost: false };
		order.push(id);
		return id;
	};
	const root = add("loop", "Root", null);
	for (let area = 0; area < 6; area++) {
		const loop = add("loop", `Area ${area}`, root);
		for (let question = 0; question < 6; question++) {
			const parent = add("question", `Question ${area}-${question}`, loop);
			for (let answer = 0; answer < 3; answer++) {
				add("answer", `Answer ${answer}`, parent);
			}
		}
	}
	Object.assign(tree, { nodes, order, links: [], seq, sel: null });
	a.api.layoutCanvas(false);
	await sleep(1500);
	tree.view.x = 0;
	tree.view.y = 0;
	tree.view.z = 0.8;
	a.api.applyView();
	const culled = () =>
			a.nodes().filter((n) => n.classList.contains("culled")).length,
		total = a.nodes().length;
	assert.ok(total > 100, `a big tree: ${total}`);
	assert.ok(
		culled() > 0 && culled() < total,
		`some are hidden and some are not (${culled()} of ${total})`,
	);
	assert.equal(
		a.byId(tree.order[1]).classList.contains("culled"),
		false,
		"a block in view is shown",
	);
	// the selected block is never hidden, even far off screen
	const far = tree.order.at(-1);
	a.api.selectNode(far);
	a.api.applyView();
	assert.equal(a.byId(far).classList.contains("culled"), false);
	a.api.selectNode(null);
	a.api.applyView();
	// panning changes which blocks are hidden
	const before = culled();
	tree.view.x -= 900;
	a.api.applyView();
	assert.notEqual(culled(), before);
	// edges between two hidden blocks are hidden too
	assert.ok(
		[...a.$$("#edges path")].some((p) => p.style.visibility === "hidden"),
	);
	// a small tree is never culled
	tree.order = tree.order.slice(0, 40);
	const keep = new Set(tree.order);
	for (const id of Object.keys(tree.nodes)) {
		if (!keep.has(id)) delete tree.nodes[id];
	}
	a.api.layoutCanvas(false);
	await sleep(300);
	a.api.applyView();
	assert.equal(culled(), 0, "under the threshold nothing is hidden");
	assert.deepEqual(a.errs, []);
});
