import { record } from "./types.ts";

// Helpers that run unchanged in Node and in a Cloudflare Worker: errors, a fetch wrapper, an SSE reader.
class ProviderError extends Error {
	status: number;
	code?: string;
	constructor(status: number, message: string, extra?: { code?: string }) {
		super(message);
		this.status = status;
		Object.assign(this, extra || {});
	}
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const str = (v: unknown, max?: number) =>
	typeof v === "string" ? v.trim().slice(0, max) : "";

async function doFetch(url: string, opts?: RequestInit) {
	try {
		return await fetch(url, opts);
	} catch (e) {
		if (record(e).name === "AbortError") throw e;
		const cause = record(record(e).cause);
		const c = cause.code || cause.message;
		let host = url;
		try {
			host = new URL(url).host;
		} catch {}
		throw new ProviderError(
			502,
			`Could not reach ${host}${c ? ` (${c})` : ""}.`,
		);
	}
}
async function providerError(up: Response) {
	let msg = "";
	try {
		const t = await up.text();
		try {
			const j = JSON.parse(t);
			msg =
				(j.error && (j.error.message || j.error)) || j.message || j.detail || t;
		} catch {
			msg = t;
		}
	} catch {}
	if (typeof msg !== "string") msg = JSON.stringify(msg);
	return new ProviderError(
		up.status,
		(msg || `HTTP ${up.status}`).slice(0, 400),
	);
}
// Yields the payload of each `data:` line in a server-sent-event stream.
async function* sseData(body: ReadableStream<Uint8Array> | null) {
	if (!body) return;
	const dec = new TextDecoder(),
		reader = body.getReader();
	let buf = "";
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			buf += dec.decode(value, { stream: true });
			let i: number;
			for (i = buf.indexOf("\n"); i >= 0; i = buf.indexOf("\n")) {
				const line = buf.slice(0, i).replace(/\r$/, "");
				buf = buf.slice(i + 1);
				if (line.startsWith("data:")) yield line.slice(5).trim();
			}
		}
	} finally {
		try {
			reader.releaseLock();
		} catch {}
	}
}

export { clamp, doFetch, ProviderError, providerError, sseData, str };
export default { ProviderError, clamp, str, doFetch, providerError, sseData };
