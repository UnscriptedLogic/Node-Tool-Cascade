#!/usr/bin/env node

// Cascade local server. Run `npm start`.
//  - serves the app (app/) with this machine's saved tree and settings injected
//  - keeps API keys and sign-ins on this computer; the page can never read one back
//  - streams model output from Claude, OpenAI, OpenRouter, ChatGPT plan usage or any OpenAI-compatible endpoint
//  - finds a free port, and frees it again on exit
// No npm packages needed. Requires Node 18 or newer.
//
// Layout:  server.ts (this entry)  ->  lifecycle.ts (ports, shutdown)  ->  app.ts (HTTP guard + dispatch)
//          routes/*.ts (page, session, project, auth, ai)   context.ts (shared state)   lib/* (providers, settings, scanner)
import fs from "node:fs";
import path from "node:path";
import * as imported0 from "./lifecycle.ts";

// .env (optional). It must load before the modules below read their environment.
try {
	for (const line of fs
		.readFileSync(path.resolve(import.meta.dirname, "..", ".env"), "utf8")
		.split(/\r?\n/)) {
		const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
		if (m && !m[1].startsWith("#") && !(m[1] in process.env))
			process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
	}
} catch {}

imported0.boot().catch((e) => {
	console.error("Could not start the server:", e.message);
	process.exit(1);
});
