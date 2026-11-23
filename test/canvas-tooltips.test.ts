import assert from "node:assert/strict";
import test from "node:test";
import Mindsets from "../shared/mindsets.ts";
import { open, sleep, tick } from "./helpers/dom.ts";

test("canvas node tooltips describe actions, sources and mindset labels", async (t) => {
	const a = open();
	t.after(() => a.w.close());
	const id = "n6";
	const node = a.api.tree.nodes[id];
	node.src = [
		{ f: "source.ts", l: 12 },
		{ f: "notes.md", l: 4 },
	];
	node.mindset = Mindsets.metadata({
		packId: "workshop",
		packName: "Workshop notes",
		entryId: "meaningful-return",
		name: "Meaningful Return",
		source: { title: "Design notes" },
		why: "Traversal repeats",
	});
	a.api.layoutCanvas(true);
	a.api.selectNode(id);
	const el = a.byId(id);
	const tooltip = (trigger: Element) =>
		a.d.getElementById(trigger.getAttribute("aria-describedby"));

	const action = el.querySelector<HTMLButtonElement>("[data-act=grill]");
	action.dispatchEvent(
		new a.w.PointerEvent("pointermove", {
			bubbles: true,
			pointerType: "mouse",
		}),
	);
	await tick();
	assert.equal(tooltip(action), null);
	await sleep(400);
	await tick();
	assert.equal(tooltip(action)?.textContent, "Grill me on this");
	action.dispatchEvent(
		new a.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
	);
	await tick();
	assert.equal(tooltip(action), null);

	const source = el.querySelector<HTMLButtonElement>(".srcmark");
	source.focus();
	await tick();
	assert.equal(tooltip(source)?.textContent, "From source.ts:12 (+1 more)");

	const label = el.querySelector<HTMLButtonElement>(".mindset-label");
	label.focus();
	await tick();
	assert.equal(tooltip(source), null);
	assert.equal(
		tooltip(label)?.textContent,
		"Workshop notes\nDesign notes\nTraversal repeats",
	);
	a.click(label);
	await tick();
	assert.equal(tooltip(label), null);
	assert.match(a.$("#ntxt").textContent, /Workshop notes.*Traversal repeats/);
	assert.deepEqual(a.errs, []);
});
