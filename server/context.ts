// State that routes and the lifecycle code share: which port we are on, tabs that are open, a scan in progress.
// Keeping it here means a route module never has to reach into the HTTP server itself.
import path from "node:path";
import * as project from "./lib/project.ts";
import * as settings from "./lib/settings.ts";
import { DATA_DIR } from "./lib/util.ts";

const PREFERRED = +process.env.PORT || 4173;
const ctx = {
	ROOT: path.resolve(import.meta.dirname, ".."),
	HOST: "127.0.0.1",
	PREFERRED,
	PORT: PREFERRED, // the port actually in use; differs when the preferred one is busy
	TREE_FILE: path.join(DATA_DIR, "tree.json"),
	GRACE: +process.env.CASCADE_BYE_GRACE_MS || 6000,
	scanState: { running: false, error: "" },
	clients: new Set(), // ids of open tabs
	byeTimer: null,
	shutdown: (_reason?: string, _code?: number) => {}, // replaced by lifecycle.js
	// everything the page may know: settings without keys, the server's own details, and the scanned project
	pub() {
		const o = settings.publicSettings({
			port: ctx.PORT,
			preferred: ctx.PREFERRED,
			pid: process.pid,
		});
		return { ...o, project: project.publicInfo() };
	},
};
export default ctx;
