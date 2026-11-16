// Folders and Cascades on this computer. The rules live in shared/library.js, which the cloud backend also uses.
import crypto from "node:crypto";
import * as library from "../../shared/library.ts";
import type { Router } from "../http.ts";
import { json, readJSON } from "../http.ts";
import store from "../lib/filestore.ts";
import { HttpError } from "../lib/util.ts";

const deps = { newId: () => crypto.randomUUID(), now: () => Date.now() };

export default (r: Router) => {
	const run =
		(method: string) =>
		async ({ req, res, url }) => {
			const parts = url.pathname.split("/").filter(Boolean).slice(1); // drop "api"
			const body =
				method === "GET" || method === "DELETE" ? null : await readJSON(req);
			try {
				const out = await library.handle({
					method,
					parts,
					body,
					store,
					uid: "local",
					deps,
				});
				if (!out) return json(res, 404, { error: "not_found" });
				json(res, out.status, out.body);
			} catch (e) {
				if (e instanceof library.LibraryError)
					throw new HttpError(e.status, e.message);
				throw e;
			}
		};
	r.get("/api/library", run("GET"));
	for (const base of ["/api/folders", "/api/cascades"]) {
		r.post(base, run("POST"));
		for (const m of ["GET", "PUT", "PATCH", "DELETE"])
			r.prefix(m, `${base}/`, run(m));
	}
};
