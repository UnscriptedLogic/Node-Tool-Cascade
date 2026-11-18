import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const folders = [
	"shared/",
	"ui/components/",
	"ui/app/",
	"ui/islands/Compose.tsx",
	"ui/islands/Hud.tsx",
	"ui/islands/SidePanel.tsx",
	"ui/islands/Ask.tsx",
	"ui/islands/Library.tsx",
	"ui/islands/LookEditor.tsx",
	"ui/islands/Menu.tsx",
	"ui/islands/MindsetConverter.tsx",
	"ui/islands/Mindsets.tsx",
	"ui/islands/Providers.tsx",
	"ui/islands/Rail.tsx",
	"ui/islands/SourceViewer.tsx",
];
const result = spawnSync(
	process.execPath,
	[
		fileURLToPath(
			new URL("../node_modules/typescript/lib/tsc.js", import.meta.url),
		),
		"-p",
		"ui/tsconfig.json",
		"--noEmit",
		"--strict",
		"--pretty",
		"false",
	],
	{ cwd: root, encoding: "utf8" },
);
if (result.error) throw result.error;
if (result.signal || result.status === null) {
	throw new Error(
		`Strict compiler did not finish: ${result.signal || "unknown"}`,
	);
}
let keep = false;
let count = 0;
let unscoped = false;
for (const line of result.stdout.split(/\r?\n/)) {
	const diagnostic = line.match(/^(.*?)\(\d+,\d+\): error TS\d+:/);
	if (diagnostic) {
		const path = diagnostic[1].replaceAll("\\", "/").replace(root, "");
		keep = folders.some((folder) =>
			folder.endsWith("/") ? path.startsWith(folder) : path === folder,
		);
		if (keep) count++;
	} else if (/^error TS\d+:/.test(line)) {
		keep = true;
		unscoped = true;
	}
	if (keep && line) console.error(line);
}
if (result.stderr) console.error(result.stderr.trimEnd());
if (result.status !== 0 && !result.stdout.trim()) unscoped = true;
console.log(`Strict check: ${count} diagnostics in ${folders.join(", ")}`);
process.exitCode = count || unscoped || result.stderr ? 1 : 0;
