import type { IncomingMessage, ServerResponse } from "node:http";
import { HttpError } from "./lib/util.ts";

export interface RequestContext {
	req: IncomingMessage;
	res: ServerResponse;
	url: URL;
}
export type Handler = (context: RequestContext) => void | Promise<void>;
interface Route {
	m: string;
	p: string;
	h: Handler;
	prefix: boolean;
}

export const readBody = (req: IncomingMessage, max = 2e6): Promise<string> =>
	new Promise((resolve, reject) => {
		let b = "";
		req.on("data", (c) => {
			b += c;
			if (b.length > max) {
				reject(new HttpError(413, "Too large"));
				req.destroy();
			}
		});
		req.on("end", () => resolve(b));
		req.on("error", reject);
	});
export const parseJSON = (text: string) => {
	try {
		return JSON.parse(text || "{}");
	} catch {
		throw new HttpError(400, "Bad JSON");
	}
};
export const readJSON = async (req: IncomingMessage) =>
	parseJSON(await readBody(req));
export const json = (res: ServerResponse, code: number, obj: unknown) => {
	res.writeHead(code, {
		"content-type": "application/json",
		"cache-control": "no-store",
	});
	res.end(JSON.stringify(obj));
};
export const inject = (value: unknown) =>
	JSON.stringify(value).replace(/</g, "\\u003c");
export const esc = (text: unknown) =>
	String(text).replace(
		/[&<>"]/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
	);

export function createRouter() {
	const routes: Route[] = [];
	const add = (m: string, p: string, h: Handler, prefix = false) => {
		routes.push({ m, p, h, prefix });
	};
	return {
		get: (p: string, h: Handler) => add("GET", p, h),
		post: (p: string, h: Handler) => add("POST", p, h),
		getPrefix: (p: string, h: Handler) => add("GET", p, h, true),
		prefix: (m: string, p: string, h: Handler) => add(m, p, h, true),
		find: (method: string, pathname: string) =>
			routes.find(
				(r) =>
					r.m === method &&
					(r.prefix ? pathname.startsWith(r.p) : pathname === r.p),
			),
	};
}
export type Router = ReturnType<typeof createRouter>;
