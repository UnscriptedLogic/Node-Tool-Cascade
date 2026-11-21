// Assembles ui/index.html with the UI bundle built into dist/ui.
//   inline:true  -> a single self-contained HTML string (web build, tests)
//   inline:false -> <link>/<script src> tags the local server can serve from /app/
import fs from "node:fs";
import path from "node:path";

const UI_DIR = path.resolve(import.meta.dirname, "..", "ui");
const BUNDLE_DIR = path.resolve(import.meta.dirname, "..", "dist", "ui");
const BUNDLE = { css: ["ui.css"], js: ["ui.js"] };
const read = (f: string) => fs.readFileSync(path.join(BUNDLE_DIR, f), "utf8");

function assemble({ inline = true, runtime = "" } = {}) {
	if (
		![...BUNDLE.css, ...BUNDLE.js].every((f) =>
			fs.existsSync(path.join(BUNDLE_DIR, f)),
		)
	) {
		throw new Error("The UI bundle is missing. Run npm run build:ui first.");
	}
	const m = BUNDLE;
	const html = fs.readFileSync(path.join(UI_DIR, "index.html"), "utf8");
	for (const k of ["<!--STYLES-->", "<!--SCRIPTS-->", "<!--RUNTIME-->"])
		if (!html.includes(k)) throw new Error(`ui/index.html is missing ${k}`);
	const styles = inline
		? `<style>\n${m.css.map(read).join("")}</style>`
		: m.css.map((f) => `<link rel="stylesheet" href="/app/${f}">`).join("\n");
	const scripts = inline
		? `<script>\n${m.js.map(read).join("\n")}\n</script>`
		: m.js.map((f) => `<script src="/app/${f}"></script>`).join("\n");
	return html
		.replace("<!--STYLES-->", () => styles)
		.replace("<!--RUNTIME-->", () => runtime)
		.replace("<!--SCRIPTS-->", () => scripts);
}

export { assemble, BUNDLE, BUNDLE_DIR, UI_DIR };
export default { assemble, BUNDLE, BUNDLE_DIR, UI_DIR };

// Turns the server's <link>/<script src> tags back into inline code, for jsdom tests that load the page from a string.
function inlineParts(html: string) {
	return html
		.replace(
			/<link rel="stylesheet" href="\/app\/([^"]+)">/g,
			(_m, f) => `<style>\n${read(f)}</style>`,
		)
		.replace(
			/<script src="\/app\/([^"]+)"><\/script>/g,
			(_m, f) => `<script>\n${read(f)}\n</script>`,
		);
}

export { inlineParts };
