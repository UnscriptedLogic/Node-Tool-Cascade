import { proxy, ref } from "valtio/vanilla";
import MindsetConversion from "../../../shared/mindset-conversion.ts";
import Mindsets from "../../../shared/mindsets.ts";
import { connect } from "../../bridge.ts";
import { mount } from "../../runtime.tsx";
import {
	activeProvider,
	aiAvailable,
	callAI,
	cancelAI,
	enqueue,
	getController,
	parseObj,
	setController,
} from "../ai/prompts.ts";
import { $, LOCAL, WEB } from "../core/constants.ts";
import { setBusy } from "../ui/hud.ts";
import { downloadMindset, importMindsets } from "./mindsets.ts";
export let MSCONVERT = null;
export function conversionBusy(on: boolean) {
	MSCONVERT.busy = on;
}
export function clearMindsetDraft() {
	MSCONVERT.draft = null;
	MSCONVERT.json = "";
}
export function renderMindsetDraft(pack, report) {
	MSCONVERT.draft = pack;
	MSCONVERT.json = JSON.stringify(pack, null, 2);
	MSCONVERT.report = report;
}
export async function extractMindsetPdf(
	file,
	{
		signal,
		onProgress,
	}: { signal?: AbortSignal; onProgress?: (message: string) => void } = {},
	loader?,
) {
	const base = new URL("vendor/pdfjs/", document.baseURI);
	let lib: typeof import("pdfjs-dist");
	try {
		lib = await (loader ? loader() : import(new URL("pdf.mjs", base).href));
	} catch {
		throw new Error(
			"PDF reader could not load. Run npm install and restart locally, or rebuild the hosted app. You can also paste exported text.",
		);
	}
	if (signal?.aborted) throw new DOMException("Stopped", "AbortError");
	lib.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.mjs", base).href;
	const documentOptions = {
		data: new Uint8Array(await file.arrayBuffer()),
		cMapUrl: new URL("cmaps/", base).href,
		cMapPacked: true,
		standardFontDataUrl: new URL("standard_fonts/", base).href,
		isEvalSupported: false,
		useWasm: false,
	};
	const loading = lib.getDocument(documentOptions);
	const abort = () => {
		loading.destroy().catch(() => {
			/* Cleanup may race with cancellation or an already destroyed PDF task. */
		});
	};
	if (signal)
		signal.addEventListener("abort", abort, {
			once: true,
		});
	const units = [];
	let size = 0,
		empty = 0;
	try {
		const pdf = await loading.promise;
		if (pdf.numPages > 1000)
			throw new Error(
				"PDF has more than 1,000 pages. Split it into smaller documents.",
			);
		for (let i = 1; i <= pdf.numPages; i++) {
			if (signal?.aborted) throw new DOMException("Stopped", "AbortError");
			if (onProgress)
				onProgress(`Reading ${file.name}: page ${i} of ${pdf.numPages}…`);
			const page = await pdf.getPage(i),
				content = await page.getTextContent();
			const text = content.items
				.map((item) =>
					"str" in item && typeof item.str === "string"
						? item.str + (item.hasEOL ? "\n" : " ")
						: "",
				)
				.join("")
				.trim();
			page.cleanup();
			size += text.length;
			if (size > MindsetConversion.MAX_TEXT)
				throw new Error(
					"PDF text exceeds 2 million characters. Split it into smaller documents.",
				);
			if (text)
				units.push({
					text,
					source: file.name,
					location: `PDF page ${i}`,
				});
			else empty++;
		}
		if (!units.length)
			throw new Error(
				"No readable text in this PDF. Run OCR or paste a text export first.",
			);
		return {
			units,
			warnings: empty
				? [
						`${file.name}: ${empty} ${empty === 1 ? "page had" : "pages had"} no readable text (images or blank pages).`,
					]
				: [],
		};
	} finally {
		if (signal) signal.removeEventListener("abort", abort);
		await loading.destroy().catch(() => {
			/* Cleanup may race with cancellation or an already destroyed PDF task. */
		});
	}
}
export async function extractMindsetFile(file, options) {
	if (file.size > 25 * 1024 * 1024)
		throw new Error("Each source file must be smaller than 25 MB.");
	const ext = (file.name.split(".").pop() || "").toLowerCase();
	if (ext === "pdf") return extractMindsetPdf(file, options);
	if (
		![
			"txt",
			"md",
			"markdown",
			"html",
			"htm",
			"json",
			"csv",
			"tsv",
			"xml",
			"yaml",
			"yml",
			"log",
		].includes(ext)
	)
		throw new Error(
			"Unsupported file. Export it as PDF, TXT, Markdown, HTML, JSON, CSV, XML or YAML.",
		);
	let text = await file.text();
	if (ext === "html" || ext === "htm") {
		const doc = new DOMParser().parseFromString(text, "text/html");
		doc.querySelectorAll("script,style,template,noscript,svg").forEach((el) => {
			el.remove();
		});
		doc
			.querySelectorAll("p,div,section,article,li,tr,br,h1,h2,h3,h4")
			.forEach((el) => {
				el.appendChild(doc.createTextNode("\n"));
			});
		text = doc.body.textContent;
	}
	return {
		units: MindsetConversion.textUnits(text, file.name),
		warnings: [],
	};
}
export async function readMindsetSources(files) {
	if (!files.length) return;
	if (files.length > 8) {
		MSCONVERT.status = "Choose up to 8 source files at once.";
		return;
	}
	cancelAI();
	clearMindsetDraft();
	const c = new AbortController();
	MSCONVERT.ctl = ref(c);
	conversionBusy(true);
	try {
		let units = [],
			warnings = [];
		for (const file of files) {
			if (c.signal.aborted) return;
			MSCONVERT.status = `Reading ${file.name}…`;
			const result = await extractMindsetFile(file, {
				signal: c.signal,
				onProgress: (message) => {
					MSCONVERT.status = message;
				},
			});
			if (c.signal.aborted) return;
			units = units.concat(result.units);
			warnings = warnings.concat(result.warnings);
		}
		const chunks = MindsetConversion.chunks(units);
		MSCONVERT.units = units;
		MSCONVERT.warnings = warnings;
		MSCONVERT.text = units.map((u) => u.text).join("\n\n");
		if (!MSCONVERT.name.trim())
			MSCONVERT.name = files[0].name.replace(/\.[^.]+$/, "").slice(0, 80);
		if (!MSCONVERT.title.trim())
			MSCONVERT.title = files
				.map((f) => f.name)
				.join(", ")
				.slice(0, 200);
		MSCONVERT.info = `${files.length} ${files.length === 1 ? "file" : "files"}, ${units.length} source ${units.length === 1 ? "section" : "sections"}. ${chunks.length} provider ${chunks.length === 1 ? "call" : "calls"} for full extracted-text coverage. ${warnings.join(" ")}`;
		MSCONVERT.status = chunks.length
			? "Source ready. Check the name and allowed domains, then generate a draft."
			: "No readable text found.";
	} catch (e) {
		MSCONVERT.status = c.signal.aborted ? "Reading stopped." : e.message;
	} finally {
		if (MSCONVERT.ctl === c) {
			if (c.signal.aborted) MSCONVERT.status = "Reading stopped.";
			MSCONVERT.ctl = null;
			conversionBusy(false);
		}
	}
}
export function conversionOptions() {
	const name = MSCONVERT.name.trim(),
		domains = [...MSCONVERT.domains];
	if (!name) throw new Error("Name the mindset first.");
	if (!domains.length) throw new Error("Choose at least one allowed domain.");
	const limit = Number(MSCONVERT.limit);
	if (!Number.isInteger(limit) || limit < 1 || limit > 200)
		throw new Error("Maximum entries must be between 1 and 200.");
	const source = {
		title: MSCONVERT.title.trim() || name,
		edition: MSCONVERT.edition.trim(),
		url: MSCONVERT.url.trim(),
	};
	if (source.url) {
		try {
			if (!["http:", "https:"].includes(new URL(source.url).protocol))
				throw new Error();
		} catch {
			throw new Error("Use an http or https source link.");
		}
	}
	return {
		name,
		domains,
		limit,
		source,
	};
}
export function generateMindsetDraft() {
	let options: ReturnType<typeof conversionOptions>,
		chunks: ReturnType<typeof MindsetConversion.chunks>;
	try {
		options = conversionOptions();
		const text = MSCONVERT.text;
		chunks = MindsetConversion.chunks(
			MSCONVERT.units || MindsetConversion.textUnits(text, "Pasted text"),
		);
		if (!chunks.length || !text.trim())
			throw new Error("Add readable source material first.");
		if (!aiAvailable() || ((LOCAL || WEB) && activeProvider() === "demo"))
			throw new Error(
				"Connect a provider in Settings > AI model. Demo mode cannot convert source material.",
			);
	} catch (e) {
		MSCONVERT.status = e.message;
		return;
	}
	cancelAI();
	clearMindsetDraft();
	const c = new AbortController(),
		warnings = [...MSCONVERT.warnings];
	MSCONVERT.ctl = ref(c);
	conversionBusy(true);
	MSCONVERT.status = `Queued conversion: up to ${chunks.length} provider ${chunks.length === 1 ? "call" : "calls"}.`;
	MSCONVERT.task = ref(
		enqueue(async () => {
			setController(c);
			setBusy("Converting mindset source…", true);
			let entries = [],
				processed = 0,
				rejected = 0,
				limited = false,
				failure = "";
			try {
				for (let i = 0; i < chunks.length; i++) {
					if (c.signal.aborted) break;
					MSCONVERT.status = `Converting chunk ${i + 1} of ${chunks.length}… ${entries.length} ${entries.length === 1 ? "entry" : "entries"} collected.`;
					setBusy(
						`Converting mindset source: ${i + 1}/${chunks.length}…`,
						true,
					);
					const output = await callAI(
						MindsetConversion.prompt(chunks[i], options, i, chunks.length),
						{
							cache: false,
							signal: c.signal,
							temperature: 0.2,
						},
					);
					if (c.signal.aborted) break;
					const result = MindsetConversion.groundedEntries(
						parseObj(output.text),
						chunks[i],
						options.domains,
					);
					rejected += result.rejected;
					const merged = MindsetConversion.merge(entries, result.entries);
					entries = merged.slice(0, options.limit);
					processed++;
					if (
						merged.length > options.limit ||
						(entries.length >= options.limit && processed < chunks.length)
					) {
						limited = true;
						break;
					}
				}
			} catch (e) {
				if (!c.signal.aborted)
					failure = e.message || "Provider conversion failed.";
			} finally {
				const complete =
					processed === chunks.length &&
					!limited &&
					!failure &&
					!c.signal.aborted;
				const coverage = `${complete ? "Complete extracted-text pass" : "Partial conversion"}: ${processed}/${chunks.length} chunks. ${entries.length} ${entries.length === 1 ? "entry" : "entries"}. ${warnings.join(" ")}`;
				const report =
					coverage +
					(limited ? " Entry limit reached." : "") +
					(c.signal.aborted ? " Stopped by user or tree change." : "") +
					(failure ? ` ${failure}` : "") +
					(rejected ? ` ${rejected} ungrounded entries rejected.` : "");
				if (entries.length) {
					const pack = Mindsets.pack({
						schemaVersion: 1,
						id: MindsetConversion.slug(options.name),
						version: "1.0.0",
						name: options.name,
						icon: "💡",
						domains: options.domains,
						source: {
							...options.source,
							coverage,
						},
						guidance:
							"Use these approaches only when the branch topic and goal fit.",
						entries,
					});
					renderMindsetDraft(pack, report);
				}
				MSCONVERT.status = entries.length
					? `Draft ready for review. ${report}`
					: `No draft entries produced. ${report}`;
				if (MSCONVERT.ctl === c) {
					MSCONVERT.ctl = null;
					conversionBusy(false);
				}
				if (getController() === c) {
					setController(null);
					setBusy(null);
				}
			}
		}),
	);
	return MSCONVERT.task;
}
export function reviewedMindsetDraft() {
	return Mindsets.pack(JSON.parse(MSCONVERT.json));
}
export function editMindsetSource(value) {
	MSCONVERT.text = value;
	MSCONVERT.units = null;
	MSCONVERT.warnings = [];
	clearMindsetDraft();
	try {
		const chunks = MindsetConversion.chunks(
			MindsetConversion.textUnits(value, "Pasted text"),
		);
		MSCONVERT.info = `${chunks.length} provider ${chunks.length === 1 ? "call" : "calls"} for full extracted-text coverage. Pasted text uses line references.`;
	} catch (e) {
		MSCONVERT.info = e.message;
	}
}
export function setConversionField(field, value) {
	MSCONVERT[field] = value;
	if (field !== "json") clearMindsetDraft();
}
export function setConversionDomain(domain, on) {
	MSCONVERT.domains = on
		? [...new Set([...MSCONVERT.domains, domain])]
		: MSCONVERT.domains.filter((d) => d !== domain);
	clearMindsetDraft();
}
export function stopMindsetConversion() {
	MSCONVERT.ctl?.abort();
}
export function importConvertedMindset() {
	try {
		const pack = reviewedMindsetDraft();
		importMindsets(pack);
		MSCONVERT.status = `Imported ${pack.name}.`;
	} catch (e) {
		MSCONVERT.status = e.message;
	}
}
export function downloadConvertedMindset() {
	try {
		const pack = reviewedMindsetDraft();
		downloadMindset(pack, `${pack.id}.mindset.json`);
	} catch (e) {
		MSCONVERT.status = e.message;
	}
}
export function startConverter() {
	MSCONVERT = proxy({
		ctl: null,
		units: null,
		warnings: [],
		draft: null,
		task: null,
		busy: false,
		status: "",
		info: "",
		report: "",
		name: "",
		title: "",
		edition: "",
		url: "",
		limit: "100",
		text: "",
		json: "",
		domains: [],
	});
	connect({
		MSCONVERT,
	});
	mount("converter", $("#converterRoot"));
}
