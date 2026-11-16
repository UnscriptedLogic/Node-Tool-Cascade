import type { Delta, ProviderConfig, SampleOptions } from "./types.ts";
// Provider adapters for Claude, OpenAI, OpenRouter and OpenAI-compatible endpoints. Each turns a prompt into a stream of text deltas.
// Portable: runs in Node (the local app) and in the Cloudflare Worker.
import {
	clamp,
	doFetch,
	ProviderError,
	providerError,
	sseData,
} from "./util.ts";

const NO_TEXT =
	"The model returned no text. It may have spent its whole token budget on reasoning. Try a non-reasoning model.";

async function streamAnthropic(
	cfg: ProviderConfig,
	o: SampleOptions,
	onDelta: Delta,
) {
	const body: {
		model: string;
		stream: boolean;
		messages: { role: string; content: string }[];
		max_tokens?: number;
		max_completion_tokens?: number;
		temperature?: number;
	} = {
		model: cfg.model,
		max_tokens: o.maxTokens,
		stream: true,
		messages: [{ role: "user", content: o.prompt }],
	};
	if (typeof o.temperature === "number")
		body.temperature = clamp(o.temperature, 0, 1);
	for (let attempt = 0; attempt < 3; attempt++) {
		const up = await doFetch(`${cfg.base}/v1/messages`, {
			method: "POST",
			signal: o.signal,
			headers: {
				"content-type": "application/json",
				"x-api-key": cfg.key || "",
				"anthropic-version": "2023-06-01",
			},
			body: JSON.stringify(body),
		});
		if (!up.ok) {
			const err = await providerError(up);
			if ("temperature" in body && /temperature/i.test(err.message)) {
				delete body.temperature;
				continue;
			}
			throw err;
		}
		let got = 0;
		for await (const d of sseData(up.body)) {
			let ev: ReturnType<typeof JSON.parse>;
			try {
				ev = JSON.parse(d);
			} catch {
				continue;
			}
			if (
				ev.type === "content_block_delta" &&
				ev.delta &&
				ev.delta.type === "text_delta" &&
				ev.delta.text
			) {
				got++;
				onDelta(ev.delta.text);
			} else if (ev.type === "error")
				throw new ProviderError(
					502,
					ev.error?.message || "The provider reported a stream error.",
				);
		}
		if (!got) throw new ProviderError(502, NO_TEXT);
		return;
	}
}
// Chat Completions format: OpenAI, OpenRouter, and anything OpenAI-compatible (Ollama, LM Studio, Groq...).
async function streamOpenAI(
	cfg: ProviderConfig,
	o: SampleOptions,
	onDelta: Delta,
) {
	let official = false;
	try {
		official = new URL(cfg.base).hostname === "api.openai.com";
	} catch {}
	let tokenParam: "max_tokens" | "max_completion_tokens" = official
		? "max_completion_tokens"
		: "max_tokens";
	const body: {
		model: string;
		stream: boolean;
		messages: { role: string; content: string }[];
		max_tokens?: number;
		max_completion_tokens?: number;
		temperature?: number;
	} = {
		model: cfg.model,
		stream: true,
		messages: [{ role: "user", content: o.prompt }],
	};
	body[tokenParam] = official ? Math.max(o.maxTokens, 4000) : o.maxTokens; // reasoning models spend tokens thinking
	if (typeof o.temperature === "number")
		body.temperature = clamp(o.temperature, 0, 2);
	const headers: Record<string, string> = Object.assign(
		{ "content-type": "application/json" },
		cfg.extra?.headers || {},
	);
	if (cfg.key) headers.authorization = `Bearer ${cfg.key}`;
	for (let attempt = 0; attempt < 4; attempt++) {
		const up = await doFetch(`${cfg.base}/chat/completions`, {
			method: "POST",
			signal: o.signal,
			headers,
			body: JSON.stringify(body),
		});
		if (!up.ok) {
			const err = await providerError(up),
				m = err.message;
			if (up.status === 400) {
				// newer models reject temperature, and disagree about max_tokens vs max_completion_tokens
				if ("temperature" in body && /temperature/i.test(m)) {
					delete body.temperature;
					continue;
				}
				if (tokenParam === "max_tokens" && /max_completion_tokens/i.test(m)) {
					body.max_completion_tokens = body.max_tokens;
					delete body.max_tokens;
					tokenParam = "max_completion_tokens";
					continue;
				}
				if (
					tokenParam === "max_completion_tokens" &&
					/max_tokens/i.test(m) &&
					!/max_completion_tokens/i.test(m)
				) {
					body.max_tokens = body.max_completion_tokens;
					delete body.max_completion_tokens;
					tokenParam = "max_tokens";
					continue;
				}
			}
			throw err;
		}
		let got = 0;
		for await (const d of sseData(up.body)) {
			if (d === "[DONE]") break;
			let ev: ReturnType<typeof JSON.parse>;
			try {
				ev = JSON.parse(d);
			} catch {
				continue;
			}
			if (ev.error)
				throw new ProviderError(
					502,
					(ev.error.message || String(ev.error)).slice(0, 300),
				);
			const c = ev.choices?.[0]?.delta?.content;
			if (typeof c === "string" && c) {
				got++;
				onDelta(c);
			}
		}
		if (!got) throw new ProviderError(502, NO_TEXT);
		return;
	}
	throw new ProviderError(400, "The provider rejected the request parameters.");
}
const streamModel = (cfg: ProviderConfig, o: SampleOptions, onDelta: Delta) =>
	cfg.kind === "anthropic"
		? streamAnthropic(cfg, o, onDelta)
		: streamOpenAI(cfg, o, onDelta);

async function listModels(cfg: ProviderConfig) {
	const headers: Record<string, string> =
		cfg.kind === "anthropic"
			? { "x-api-key": cfg.key || "", "anthropic-version": "2023-06-01" }
			: cfg.key
				? { authorization: `Bearer ${cfg.key}` }
				: {};
	const url =
		cfg.kind === "anthropic"
			? `${cfg.base}/v1/models?limit=1000`
			: `${cfg.base}/models`;
	const up = await doFetch(url, { headers });
	if (!up.ok) throw await providerError(up);
	const j = (await up.json()) as {
		data?: (string | { id?: string; name?: string; created?: number })[];
		models?: (string | { id?: string; name?: string; created?: number })[];
		key?: string;
	};
	let rows = j.data || j.models || [];
	if (cfg.name === "openrouter")
		rows = rows
			.slice()
			.sort(
				(a, b) =>
					(typeof b === "string" ? 0 : b.created || 0) -
					(typeof a === "string" ? 0 : a.created || 0),
			); // newest first
	let ids: string[] = rows
		.map((m: string | { id?: string; name?: string }) =>
			typeof m === "string" ? m : m.id || m.name,
		)
		.filter((id): id is string => typeof id === "string" && !!id);
	if (cfg.name === "openai" && /api\.openai\.com/.test(cfg.base)) {
		ids = ids.filter(
			(id) =>
				/^(gpt|chatgpt|o\d)/.test(id) &&
				!/(instruct|audio|realtime|image|transcribe|tts|search|embedding|moderation|whisper|dall)/i.test(
					id,
				),
		);
	}
	ids = [...new Set(ids)];
	return cfg.name === "openrouter" ? ids : ids.sort();
}
// OpenRouter sign-in: trade the one-time code (and PKCE verifier) for a user-controlled API key.
async function exchangeOpenRouter(
	base: string,
	code: string,
	verifier: string,
) {
	const up = await doFetch(`${base}/auth/keys`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			code,
			code_verifier: verifier,
			code_challenge_method: "S256",
		}),
	});
	if (!up.ok) throw await providerError(up);
	const j = (await up.json()) as {
		data?: (string | { id?: string; name?: string; created?: number })[];
		models?: (string | { id?: string; name?: string; created?: number })[];
		key?: string;
	};
	if (!j.key) throw new ProviderError(502, "OpenRouter did not return a key.");
	return j.key;
}

export { exchangeOpenRouter, listModels, streamModel };
export default { streamModel, listModels, exchangeOpenRouter };
