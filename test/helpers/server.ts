// Starts the real server against the mock providers and opens its page in jsdom.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import * as imported0 from "../../scripts/assemble.ts";
import { open, ROOT, sleep } from "./dom.ts";

async function bootServer(
	t: TestContext,
	mock: { env: NodeJS.ProcessEnv },
	env: NodeJS.ProcessEnv = {},
) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cascade-t-"));
	const p = Object.assign(
		spawn(
			process.execPath,
			["--import", "tsx", path.join(ROOT, "server", "server.ts")],
			{
				env: {
					...process.env,
					NO_OPEN: "1",
					CASCADE_DATA_DIR: dir,
					...mock.env,
					...env,
				},
			},
		),
		{ out: "", exited: false },
	);
	p.out = "";
	p.exited = false;
	p.on("exit", () => {
		p.exited = true;
	});
	p.stdout.on("data", (d) => (p.out += d));
	p.stderr.on("data", (d) => (p.out += d));
	for (
		let i = 0;
		i < 100 && !/running at http:\/\/localhost:\d+/.test(p.out);
		i++
	)
		await sleep(50);
	const port = +p.out.match(/running at http:\/\/localhost:(\d+)/)[1],
		base = `http://localhost:${port}`;
	t.after(async () => {
		if (!p.exited) {
			p.kill("SIGINT");
			for (let i = 0; i < 60 && !p.exited; i++) await sleep(50);
		}
		fs.rmSync(dir, { recursive: true, force: true });
	});
	return {
		p,
		port,
		base,
		dir,
		fetchImpl: (u: string | URL, o?: RequestInit) =>
			fetch(new URL(u, `${base}/`), o),
	};
}
async function page(s, extra = {}) {
	const html = imported0.inlineParts(await (await fetch(`${s.base}/`)).text());
	return open({ html, url: `${s.base}/`, fetchImpl: s.fetchImpl, ...extra });
}

export { bootServer, page };
export default { bootServer, page };
