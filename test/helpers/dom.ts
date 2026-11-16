export type TestFetch = (
	url: RequestInfo | URL,
	options?: RequestInit,
) => Promise<{
	ok: boolean;
	status: number;
	headers: Pick<Headers, "get">;
	json(): Promise<unknown>;
}>;
type TestWindow = Omit<DOMWindow, "eval" | "innerWidth"> & {
	innerWidth: number;
	eval(code: string): ReturnType<typeof JSON.parse>;
};

import type { DOMWindow } from "jsdom";
export interface OpenOptions {
	html?: string;
	url?: string;
	claude?: unknown;
	fetchImpl?: TestFetch;
	session?: Record<string, string>;
	local?: Record<string, string>;
	width?: number;
	height?: number;
	example?: boolean;
	exposeInternals?: boolean;
}
export type TestElement = HTMLElement &
	Pick<
		HTMLInputElement,
		"value" | "checked" | "files" | "disabled" | "select" | "placeholder"
	>;

import nodeCrypto from "node:crypto";
import path from "node:path";
// Loads the app into jsdom the way a browser would, in any of its three modes.
import { JSDOM } from "jsdom";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

import { assemble } from "../../scripts/assemble.ts";

const APP = assemble({ inline: true });
const sleep = (ms?: number) => new Promise((r) => setTimeout(r, ms));
const tick = async () => {
	await Promise.resolve();
	await sleep(0);
};
// Same transformation scripts/build.ts performs for the GitHub Pages version.
const webHtml = () =>
	assemble({ inline: true, runtime: "<script>window.__WEB__=true;</script>" })
		.split("__REPO_URL__")
		.join("https://github.com/example/cascade");

function open({
	html = APP,
	url = "https://cascade.test/",
	claude,
	fetchImpl,
	session,
	local,
	width,
	height,
	example = true,
	exposeInternals = true,
}: OpenOptions = {}) {
	const errs: string[] = [],
		navigated = [],
		opened = [];
	const dom = new JSDOM(html, {
		runScripts: "dangerously",
		pretendToBeVisual: true,
		url,
		beforeParse(w) {
			if (width)
				Object.defineProperty(w, "innerWidth", {
					value: width,
					configurable: true,
					writable: true,
				}); // a phone-sized window
			if (height)
				Object.defineProperty(w, "innerHeight", {
					value: height,
					configurable: true,
					writable: true,
				});
			w.matchMedia = () => ({
				media: "",
				onchange: null,
				addListener() {},
				removeListener() {},
				dispatchEvent() {
					return true;
				},
				matches: true,
				addEventListener() {},
				removeEventListener() {},
			}); // also means "reduced motion"
			Object.defineProperty(w.HTMLElement.prototype, "offsetHeight", {
				get() {
					return 52;
				},
			});
			w.document.elementsFromPoint = () => [];
			w.Element.prototype.setPointerCapture = () => {};
			Object.defineProperty(w, "crypto", {
				value: nodeCrypto.webcrypto,
				configurable: true,
			});
			w.TextEncoder = TextEncoder;
			w.TextDecoder = TextDecoder;
			w.Blob = Blob;
			// Node's fetch requires signals from the same runtime as its AbortController.
			w.AbortController = AbortController;
			w.AbortSignal = AbortSignal;
			w.__DEMO_FAST__ = true;
			w.__POLL_MS = 40;
			w.__navigate = (u) => navigated.push(u);
			w.open = (() => {
				const o = { location: { href: "" }, close() {} };
				opened.push(o);
				return o;
			}) as unknown as DOMWindow["open"];
			if (fetchImpl) w.fetch = fetchImpl as typeof fetch;
			if (claude) w.claude = claude;
			if (session)
				for (const [k, v] of Object.entries(session))
					w.sessionStorage.setItem(k, v);
			// the tests exercise the game-design starter tree unless a test says otherwise
			if (!local?.["cascade-prefs-v1"])
				w.localStorage.setItem(
					"cascade-prefs-v1",
					JSON.stringify({ domain: "game" }),
				);
			if (local)
				for (const [k, v] of Object.entries(local))
					w.localStorage.setItem(k, v);
			w.addEventListener("error", (e) =>
				errs.push(String(e.error || e.message)),
			);
		},
	});
	const w = dom.window as TestWindow,
		d: Document = dom.window.document;
	// Keep existing model assertions in this harness; production exposes only CascadeUI.
	if (exposeInternals && w.CascadeUI?.legacy)
		for (const key of Object.keys(w.CascadeUI.legacy)) {
			Object.defineProperty(w, key, {
				configurable: true,
				get: () => w.CascadeUI.legacy[key],
				set: (value) => {
					w.CascadeUI.legacy[key] = value;
				},
			});
		}
	// Canvas tests use explicit example data. Startup tests opt out to exercise the real blank canvas.
	if (example && d.getElementById("stage") && !w.eval("loaded"))
		w.eval("Object.assign(S,seed()); layout(true); initialView(true);");
	const $ = <T extends Element = TestElement>(s: string): T =>
			d.querySelector<T>(s),
		$$ = <T extends Element = TestElement>(s: string): T[] => [
			...d.querySelectorAll<T>(s),
		];
	const click = (el) =>
		el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
	const type = (el, v) => {
		const proto =
			el.tagName === "TEXTAREA"
				? w.HTMLTextAreaElement.prototype
				: el.tagName === "INPUT"
					? w.HTMLInputElement.prototype
					: w.HTMLSelectElement.prototype;
		Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
		el.dispatchEvent(new w.Event("input", { bubbles: true }));
		el.dispatchEvent(new w.Event("change", { bubbles: true }));
	};
	const nodes = () => $$(".node").filter((n) => n.style.display !== "none");
	const byText = (t) =>
		nodes().find((n) => n.querySelector(".txt").textContent.includes(t));
	const byId = (id) => d.querySelector<TestElement>(`.node[data-id="${id}"]`);
	const pressEscape = () => {
		const e = () =>
			new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true });
		d.dispatchEvent(e());
		w.dispatchEvent(e());
	};
	// drop a block of `type` with `text` through the compose card, then give the app a moment to place and grow it
	const drop = async (kind, text, ms = 600) => {
		click($(`.tile[data-type="${kind}"]`));
		type($("#compose textarea"), text);
		click($("#cOk"));
		await sleep(ms);
	};
	return {
		dom,
		w,
		d,
		$,
		$$,
		click,
		type,
		nodes,
		byText,
		byId,
		escape: pressEscape,
		drop,
		sleep,
		errs,
		navigated,
		opened,
	};
}

export { APP, open, ROOT, sleep, tick, webHtml };
export default { open, APP, webHtml, sleep, tick, ROOT };
