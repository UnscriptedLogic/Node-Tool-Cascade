#!/usr/bin/env node

// Builds the static, no-install web version (for GitHub Pages): dist/web/index.html
// The page is the same app/ (assembled by scripts/assemble.ts), flagged to run in "web" mode (no server, demo + OpenRouter).
import fs from "node:fs";
import path from "node:path";
import { adminPage } from "./admin/page.ts";
import * as imported0 from "./pdf-assets.ts";

const root = path.resolve(import.meta.dirname, "..");

import { assemble } from "./assemble.ts";

const repo = process.env.REPO_URL || "https://github.com/";
const html = assemble({
	inline: true,
	runtime: "<script>window.__WEB__=true;</script>",
})
	.split("__REPO_URL__")
	.join(repo);
const out = path.join(root, "dist", "web");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "index.html"), html);
fs.copyFileSync(
	path.join(root, "app", "favicon.png"),
	path.join(out, "favicon.png"),
);
imported0.copyPdfAssets(path.join(out, "vendor", "pdfjs"));
fs.writeFileSync(path.join(out, ".nojekyll"), "");
fs.writeFileSync(path.join(out, "admin.html"), adminPage()); // the online admin page (the Worker serves it at /admin)   // tell GitHub Pages not to run Jekyll
console.log(
	`Built ${path.relative(root, path.join(out, "index.html"))} (${Math.round(html.length / 1024)} KB)`,
);
