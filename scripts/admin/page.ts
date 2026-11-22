import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

export function adminPage(): string {
	const template = readFileSync(
		new URL("./index.html", import.meta.url),
		"utf8",
	);
	const { code } = transformSync(
		readFileSync(new URL("./client.ts", import.meta.url), "utf8"),
		{ loader: "ts", format: "iife", target: "es2022", minify: true },
	);
	return template.replace(
		"<!--ADMIN_SCRIPT-->",
		() => `<script>${code.replaceAll("</script", "<\\/script")}</script>`,
	);
}
