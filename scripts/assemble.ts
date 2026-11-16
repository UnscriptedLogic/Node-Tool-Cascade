// Assembles app/app.html with the generated UI assets listed in app/manifest.json.
//   inline:true  -> a single self-contained HTML string (web build, tests)
//   inline:false -> <link>/<script src> tags the local server can serve from /app/
import fs from "node:fs";
import path from "node:path";
import imported0 from "../package.json" with { type: "json" };

const APP_DIR = path.resolve(import.meta.dirname, "..", "app");
const read = (f: string) => fs.readFileSync(path.join(APP_DIR, f), "utf8");
const manifest = () => JSON.parse(read("manifest.json"));

function assemble({ inline = true, runtime = "" } = {}) {
	if (
		!fs.existsSync(path.join(APP_DIR, "gen/ui.js")) ||
		!fs.existsSync(path.join(APP_DIR, "gen/ui.css"))
	) {
		throw new Error("The UI bundle is missing. Run npm run build:ui first.");
	}
	const m = manifest();
	const html = read("app.html").replaceAll(
		"__APP_VERSION__",
		imported0.version,
	);
	for (const k of ["<!--STYLES-->", "<!--SCRIPTS-->", "<!--RUNTIME-->"])
		if (!html.includes(k)) throw new Error(`app/app.html is missing ${k}`);
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

export { APP_DIR, assemble, manifest };
export default { assemble, APP_DIR, manifest };

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
