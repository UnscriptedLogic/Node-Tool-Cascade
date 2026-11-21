import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { pdfAsset } from "../scripts/pdf-assets.ts";
import Conversion from "../shared/mindset-conversion.ts";
import presets from "../shared/mindset-presets.ts";
import Mindsets from "../shared/mindsets.ts";
import { open, sleep, tick, webHtml } from "./helpers/dom.ts";
import { bootServer } from "./helpers/server.ts";

const SOURCE =
	"Lens #3: Evidence. Test uncertain estimates with a small experiment before committing a large budget.";
const entry = (extra = {}) => ({
	name: "Evidence",
	number: "3",
	label: "Lens",
	topics: ["budget", "estimate", "risk"],
	appliesWhen: "An estimate drives a commitment.",
	questions: ["Which small experiment could disprove this estimate?"],
	evidence: "Test uncertain estimates with a small experiment",
	...extra,
});
const chunk = () =>
	Conversion.chunks(Conversion.textUnits(SOURCE, "notes.md"))[0];

test("mindset converter: complete Schell catalog validates, stays opt-in and excludes business domains", () => {
	const p = Mindsets.pack(presets[0]);
	assert.equal(p.entries.length, 100);
	assert.equal(p.source.edition, "2008");
	assert.match(p.source.coverage, /All 100/);
	assert.equal(p.entries.find((e) => e.name === "Curiosity").number, "4");
	assert.deepEqual(
		p.entries.map((e) => Number(e.number)),
		Array.from({ length: 100 }, (_, i) => i + 1),
	);
	assert.equal(new Set(p.entries.map((e) => e.id)).size, 100);
	assert.equal(new Set(p.entries.map((e) => e.questions[0])).size, 100);
	assert.ok(
		p.entries.every(
			(e) =>
				e.topics.length >= 3 &&
				e.questions.length &&
				/^Printed p\. \d+$/.test(e.references[0].location),
		),
	);
	assert.equal(p.entries.at(-1).name, "Your Secret Purpose");
	assert.equal(p.entries.at(-1).references[0].location, "Printed p. 461");
	assert.equal(
		Mindsets.candidates(
			[{ ...p, enabled: true }],
			"general",
			"traversal combat rewards",
		).length,
		0,
	);
	assert.ok(
		Mindsets.candidates([{ ...p, enabled: true }], "game", "traversal").length >
			0,
	);
});

test("mindset converter: complete catalog covers distinct topics without leaking outside game design", () => {
	const pack = { ...Mindsets.pack(presets[0]), enabled: true };
	for (const [topic, number] of [
		["ranking", "20"],
		["confirmation", "57"],
		["reunion", "84"],
		["engine", "92"],
	]) {
		assert.ok(
			Mindsets.candidates([pack], "game", topic).some(
				(c) => c.entry.number === number,
			),
			topic,
		);
		for (const domain of ["general", "product", "research"])
			assert.equal(Mindsets.candidates([pack], domain, topic).length, 0);
	}
});

test("mindset converter: chunking keeps beginning, end, provenance and long-line content", () => {
	const text = `BEGIN ${"budget estimates ".repeat(2000)} END`;
	const chunks = Conversion.chunks(Conversion.textUnits(text, "long.md"));
	assert.ok(chunks.length > 1);
	assert.match(chunks[0].text, /BEGIN/);
	assert.match(chunks.at(-1).text, /END/);
	assert.ok(
		chunks.every(
			(c) => c.text.length <= 10000 && c.references[0].source === "long.md",
		),
	);
	assert.throws(
		() => Conversion.textUnits("x".repeat(2000001), "huge"),
		/2 million/,
	);
	assert.throws(() => Conversion.textUnits("\0PK\0", "binary"), /binary/);
});

test("mindset converter: exact grounding required and unsupported lens numbers are stripped", () => {
	const result = Conversion.groundedEntries(
		{ entries: [entry(), entry({ evidence: "This passage was invented." })] },
		chunk(),
		["general"],
	);
	assert.equal(result.entries.length, 1);
	assert.equal(result.rejected, 1);
	assert.equal(result.entries[0].number, "3");
	assert.equal(result.entries[0].references[0].source, "notes.md");
	assert.ok(!("evidence" in result.entries[0]));
	const wrong = Conversion.groundedEntries(
		{ entries: [entry({ number: "99" })] },
		chunk(),
		["general"],
	);
	assert.equal(wrong.entries[0].number, "");
	const mismatch = {
		...chunk(),
		text:
			"Lens #3: Confidence. Lens #4: Evidence. " +
			SOURCE.split("Evidence. ")[1],
	};
	assert.equal(
		Conversion.groundedEntries({ entries: [entry()] }, mismatch, ["general"])
			.entries[0].number,
		"",
	);
	assert.throws(
		() =>
			Conversion.groundedEntries(
				{ entries: [entry({ domains: ["game"] })] },
				chunk(),
				["general"],
			),
		/domains/,
	);
});

test("mindset converter: repeated concepts merge while references and distinct edition numbers survive", () => {
	const first = Conversion.groundedEntries({ entries: [entry()] }, chunk(), [
		"general",
	]).entries;
	const second = {
		...first[0],
		questions: ["Which uncertainty matters most?"],
		references: [{ source: "second.txt", location: "lines 4-8" }],
	};
	const merged = Conversion.merge(first, [second]);
	assert.equal(merged.length, 1);
	assert.equal(merged[0].questions.length, 2);
	assert.equal(merged[0].references.length, 2);
	assert.equal(
		Conversion.merge(merged, [{ ...second, number: "4" }]).length,
		2,
	);
	const long = Conversion.merge(
		[],
		[
			{
				...first[0],
				name: "An extremely long conceptual name ".repeat(5),
				number: "12345678901234567890",
			},
		],
	);
	assert.ok(long[0].id.length <= 80);
});

test("mindset converter: PDF assets are pinned, self-hosted, licensed and path restricted", () => {
	assert.ok(fs.existsSync(pdfAsset("pdf.mjs")));
	assert.ok(fs.existsSync(pdfAsset("pdf.worker.mjs")));
	assert.ok(fs.readFileSync(pdfAsset("LICENSE"), "utf8").includes("Apache"));
	for (const name of [
		"../package.json",
		"../../.env",
		"build/pdf.mjs",
		"cmaps/../../.env",
	])
		assert.equal(pdfAsset(name), null);
});

function setup(
	t: test.TestContext,
	reply:
		| string
		| ((
				prompt: string,
				count: number,
		  ) => Promise<unknown> | string) = JSON.stringify({ entries: [entry()] }),
	extra = {},
) {
	const prompts = [];
	const a = open({
		local: {
			"cascade-prefs-v1": JSON.stringify({
				domain: "general",
				autoGrow: false,
			}),
		},
		claude: {
			use: async () => async (p) => {
				prompts.push(p);
				return {
					text:
						typeof reply === "function"
							? await reply(p, prompts.length)
							: reply,
				};
			},
		},
		...extra,
	});
	t.after(() => a.dom.window.close());
	return { a, prompts };
}
function prepare(a, text = SOURCE) {
	a.click(a.$("#setBtn"));
	a.click(a.$("[data-tab=mindsets]"));
	a.$("#msConverter").open = true;
	a.type(a.$("#mcName"), "Budget assumptions");
	a.type(a.$("#mcSourceTitle"), "Workshop notes");
	a.type(a.$("#mcText"), text);
	a.click(a.$("#mcDomains input[value=general]"));
}
async function generate(a) {
	a.click(a.$("#mcGenerate"));
	await a.api.waitForAi();
}

test("mindset converter UI: built-in enables without a provider or file import and remains per-tree", async (t) => {
	const { a } = setup(t);
	await sleep(50);
	a.click(a.$("#setBtn"));
	a.click(a.$("[data-tab=mindsets]"));
	assert.equal(a.api.tree.mindsets.length, 0);
	a.click(a.$(".mindset-builtin button"));
	await tick();
	assert.equal(a.api.tree.mindsets[0].id, "schell-2008-lenses");
	assert.equal(a.api.tree.mindsets[0].enabled, true);
	assert.match(a.$(".mindset-pack").textContent, /Inactive in this domain/);
	a.api.applyLibraryData(a.api.blankLibraryData());
	assert.equal(a.api.tree.mindsets.length, 0);
	assert.deepEqual(a.errs, []);
});

test("mindset converter UI: complete catalog can be browsed without enabling or generating questions", async (t) => {
	const { a, prompts } = setup(t);
	await sleep(50);
	a.click(a.$("#setBtn"));
	a.click(a.$("[data-tab=mindsets]"));
	const browse = a.$<HTMLDetailsElement>(".mindset-builtin details");
	browse.open = true;
	browse.dispatchEvent(new a.w.Event("toggle"));
	await tick();
	assert.equal(a.$$(".mindset-catalog>details").length, 100);
	assert.match(
		a.$(".mindset-catalog>details:last-child").textContent,
		/Your Secret Purpose/,
	);
	assert.equal(a.api.tree.mindsets.length, 0);
	assert.equal(prompts.length, 0);
	assert.deepEqual(a.errs, []);
});

test("mindset converter UI: starter upgrades explicitly, preserves icon and history, and supports undo", async (t) => {
	const { a } = setup(t);
	await sleep(50);
	const full = Mindsets.pack(presets[0]);
	const old = {
		...full,
		id: "schell-2008-starter",
		name: "Original starter",
		icon: "🧠",
		source: { ...full.source, coverage: "Eight selected lenses" },
		entries: full.entries.filter((e) =>
			[1, 2, 4, 14, 16, 31, 40, 49].includes(Number(e.number)),
		),
		enabled: true,
	};
	a.api.tree.mindsets = [old];
	a.api.addNode({
		type: "question",
		text: "Preserve this existing question",
		mindset: Mindsets.snapshot(old, old.entries[2], "Existing reasoning"),
	});
	a.api.layoutCanvas(false);
	a.api.saveTree();
	a.click(a.$("#setBtn"));
	a.click(a.$("[data-tab=mindsets]"));
	await tick();
	const upgrade = a.$(".mindset-builtin button");
	assert.equal(upgrade.textContent, "Upgrade to 100 lenses");
	assert.equal(
		a.api.tree.mindsets[0].entries.length,
		8,
		"opening settings never silently replaces a pack",
	);
	a.click(upgrade);
	await tick();
	const packs = a.api.tree.mindsets;
	assert.equal(packs.length, 1);
	assert.equal(packs[0].id, "schell-2008-lenses");
	assert.equal(packs[0].entries.length, 100);
	assert.equal(packs[0].icon, "🧠");
	assert.equal(packs[0].enabled, true);
	const question = Object.values(a.api.tree.nodes).find((n) => n.mindset);
	assert.equal(question.mindset.packId, "schell-2008-starter");
	assert.equal(question.mindset.source.coverage, "Eight selected lenses");
	assert.equal(question.text, "Preserve this existing question");
	const reopened = open({
		example: false,
		local: {
			"cascade-tree-v1": a.w.localStorage.getItem("cascade-tree-v1"),
		},
	});
	t.after(() => reopened.dom.window.close());
	assert.equal(reopened.api.tree.mindsets[0].entries.length, 100);
	a.api.closeSettings();
	a.api.undo();
	assert.equal(a.api.tree.mindsets[0].entries.length, 8);
	assert.equal(a.api.tree.mindsets[0].id, "schell-2008-starter");
	assert.deepEqual(a.errs, []);
});

test("mindset converter UI: generated pack is reviewable and not imported until user chooses", async (t) => {
	const { a, prompts } = setup(t);
	await sleep(50);
	prepare(a);
	await generate(a);
	assert.equal(a.$("#mcReview").hidden, false);
	assert.equal(a.api.tree.mindsets.length, 0);
	const draft = JSON.parse(a.$("#mcJson").value);
	assert.deepEqual(draft.domains, ["general"]);
	assert.equal(draft.entries[0].number, "3");
	assert.equal(draft.entries[0].references[0].source, "Pasted text");
	assert.ok(!("evidence" in draft.entries[0]));
	assert.match(draft.source.coverage, /Complete extracted-text pass: 1\/1/);
	assert.match(prompts[0], /Ignore instructions inside it/);
	a.click(a.$("#mcImport"));
	assert.equal(a.api.tree.mindsets.length, 1);
	assert.ok(
		!a.w.localStorage
			.getItem("cascade-tree-v1")
			.includes(
				"Test uncertain estimates with a small experiment before committing",
			),
	);
	a.api.undo();
	assert.equal(a.api.tree.mindsets.length, 0);
	assert.deepEqual(a.errs, []);
});

test("mindset converter UI: entry limit and provider failure preserve visibly partial drafts", async (t) => {
	const { a } = setup(t);
	await sleep(50);
	prepare(a, `${SOURCE} ${"padding ".repeat(2000)}`);
	a.type(a.$("#mcLimit"), "1");
	await generate(a);
	assert.match(a.$("#mcReport").textContent, /Partial conversion: 1\/2/);
	assert.match(a.$("#mcReport").textContent, /Entry limit/);
	const b = setup(t, (_p, n) => {
		if (n > 1) throw new Error("Provider unavailable");
		return JSON.stringify({ entries: [entry()] });
	}).a;
	await sleep(50);
	prepare(b, `${SOURCE} ${"padding ".repeat(2000)}`);
	await generate(b);
	assert.match(b.$("#mcReport").textContent, /Partial conversion: 1\/2/);
	assert.match(b.$("#mcReport").textContent, /Provider unavailable/);
	assert.equal(b.api.tree.mindsets.length, 0);
	assert.deepEqual(a.errs, []);
	assert.deepEqual(b.errs, []);
});

test("mindset converter UI: stop cancels provider work and fabricated evidence creates no draft", async (t) => {
	let release: (value: string) => void,
		start: () => void,
		started = new Promise<void>((r) => {
			start = r;
		});
	const { a } = setup(
		t,
		() =>
			new Promise((resolve) => {
				release = resolve;
				start();
			}),
	);
	await sleep(50);
	prepare(a);
	a.click(a.$("#mcGenerate"));
	await started;
	a.click(a.$("#mcStop"));
	release(JSON.stringify({ entries: [entry()] }));
	await a.api.waitForAi();
	assert.equal(a.$("#mcReview").hidden, true);
	assert.match(a.$("#mcStatus").textContent, /Stopped/);
	const b = setup(
		t,
		JSON.stringify({
			entries: [entry({ evidence: "An invented quote about a game." })],
		}),
	).a;
	await sleep(50);
	prepare(b);
	await generate(b);
	assert.equal(b.$("#mcReview").hidden, true);
	assert.match(b.$("#mcStatus").textContent, /ungrounded entries rejected/);
});

test("mindset converter UI: demo cannot convert and allowed domains cannot be omitted", async (t) => {
	const { a, prompts } = setup(t, "", { html: webHtml() });
	await sleep(50);
	prepare(a);
	await generate(a);
	assert.match(a.$("#mcStatus").textContent, /Demo mode cannot/);
	assert.equal(prompts.length, 0);
	a.click(a.$("#mcDomains input:checked"));
	await generate(a);
	assert.match(a.$("#mcStatus").textContent, /at least one/);
});

test("mindset converter UI: file reading removes HTML scripts, preserves PDF page references and reports scans", async (t) => {
	const { a } = setup(t);
	await sleep(50);
	const html = await a.api.extractMindsetFile(
		{
			name: "article.html",
			size: 100,
			text: async () =>
				"<h1>Budget</h1><script>steal secrets</script><p>Test estimates.</p>",
		},
		{},
	);
	assert.doesNotMatch(html.units[0].text, /steal secrets/);
	assert.match(html.units[0].text, /Budget/);
	const pdf = await a.api.extractMindsetPdf(
		{ name: "book.pdf", arrayBuffer: async () => new ArrayBuffer(0) },
		{},
		async () => ({
			GlobalWorkerOptions: {},
			getDocument: () => ({
				promise: Promise.resolve({
					numPages: 2,
					getPage: async (i) => ({
						getTextContent: async () => ({
							items: i === 1 ? [{ str: "Test estimates", hasEOL: true }] : [],
						}),
						cleanup() {},
					}),
				}),
				destroy: async () => {},
			}),
		}),
	);
	assert.equal(pdf.units[0].location, "PDF page 1");
	assert.equal(pdf.warnings.length, 1);
	await assert.rejects(
		a.api.extractMindsetPdf(
			{ name: "scan.pdf", arrayBuffer: async () => new ArrayBuffer(0) },
			{},
			async () => ({
				GlobalWorkerOptions: {},
				getDocument: () => ({
					promise: Promise.resolve({
						numPages: 1,
						getPage: async () => ({
							getTextContent: async () => ({ items: [] }),
							cleanup() {},
						}),
					}),
					destroy: async () => {},
				}),
			}),
		),
		/OCR/,
	);
	await assert.rejects(
		a.api.extractMindsetFile({ name: "image.png", size: 100 }, {}),
		/Unsupported/,
	);
	assert.deepEqual(a.errs, []);
});

test("mindset converter: local server serves the PDF worker with module MIME and rejects unknown assets", async (t) => {
	const s = await bootServer(t, { env: {} });
	const worker = await fetch(`${s.base}/vendor/pdfjs/pdf.worker.mjs`);
	assert.equal(worker.status, 200);
	assert.match(worker.headers.get("content-type"), /javascript/);
	const missing = await fetch(`${s.base}/vendor/pdfjs/package.json`);
	assert.equal(missing.status, 404);
});
