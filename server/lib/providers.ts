// Provider adapters for the local app: the portable ones in shared/providers.js, plus ChatGPT plan usage
// and the local Claude Code CLI.
import * as shared from "../../shared/providers.ts";
import type { ProviderConfig } from "../../shared/types.ts";
import * as chatgpt from "./chatgpt.ts";
import * as claudecode from "./claudecode.ts";
import * as settings from "./settings.ts";

const streamModel = (cfg, o, onDelta) =>
	cfg.kind === "responses"
		? chatgpt.streamResponses(cfg, o, onDelta)
		: cfg.kind === "claude-cli"
			? claudecode.streamClaudeCode(cfg, o, onDelta)
			: shared.streamModel(cfg, o, onDelta);
const listModels = (cfg: ProviderConfig) =>
	cfg.kind === "responses"
		? chatgpt.listModels()
		: cfg.kind === "claude-cli"
			? claudecode.listModels()
			: shared.listModels(cfg);
const exchangeOpenRouter = (code: string, verifier: string) =>
	shared.exchangeOpenRouter(
		settings.resolveProvider("openrouter").base,
		code,
		verifier,
	);

export { exchangeOpenRouter, listModels, streamModel };
export default { streamModel, listModels, exchangeOpenRouter };
