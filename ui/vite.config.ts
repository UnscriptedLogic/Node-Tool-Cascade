import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		{
			name: "preserve-component-license",
			enforce: "post",
			generateBundle(_options, bundle) {
				const script = bundle["ui.js"];
				if (script?.type === "chunk") {
					script.code =
						"/*!\n" +
						readFileSync(
							new URL("./components/ui/LICENSE", import.meta.url),
							"utf8",
						) +
						"\n*/\n" +
						script.code;
				}
			},
		},
	],
	resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
	define: { "process.env.NODE_ENV": '"production"' },
	build: {
		outDir: fileURLToPath(new URL("../app/gen", import.meta.url)),
		emptyOutDir: true,
		minify: true,
		cssMinify: false,
		lib: {
			entry: fileURLToPath(new URL("./main.tsx", import.meta.url)),
			name: "CascadeUI",
			formats: ["iife"],
			fileName: () => "ui.js",
			cssFileName: "ui",
		},
	},
});
