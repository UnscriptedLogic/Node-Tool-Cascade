import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// A stand-in for Cloudflare D1 built on node:sqlite, so the Worker's SQL runs for real in tests. Same API surface the Worker uses.
import fs from "node:fs";
import path from "node:path";

function hasSqlite() {
	try {
		require("node:sqlite");
		return true;
	} catch {
		return false;
	}
}

function createD1() {
	const { DatabaseSync } = require("node:sqlite");
	const db = new DatabaseSync(":memory:");
	db.exec("PRAGMA foreign_keys = ON");
	db.exec(
		fs.readFileSync(
			path.join(import.meta.dirname, "..", "..", "worker", "schema.sql"),
			"utf8",
		),
	);
	const stmt = (sql, args = []) => ({
		bind: (...a) => stmt(sql, a),
		async first() {
			return db.prepare(sql).get(...args) || null;
		},
		async all() {
			return { results: db.prepare(sql).all(...args) };
		},
		async run() {
			db.prepare(sql).run(...args);
			return { success: true };
		},
		_run() {
			db.prepare(sql).run(...args);
		},
	});
	return {
		prepare: (sql) => stmt(sql),
		async batch(list) {
			db.exec("BEGIN");
			try {
				for (const s of list) s._run();
				db.exec("COMMIT");
			} catch (e) {
				db.exec("ROLLBACK");
				throw e;
			}
			return [];
		},
		raw: db,
	};
}

export { createD1, hasSqlite };
export default { createD1, hasSqlite };
