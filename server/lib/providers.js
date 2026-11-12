'use strict';
// Provider adapters for the local app: the portable ones in shared/providers.js, plus ChatGPT plan usage
// and the local Claude Code CLI.
const shared = require('../../shared/providers');
const chatgpt = require('./chatgpt');
const claudecode = require('./claudecode');
const settings = require('./settings');

const streamModel = (cfg,o,onDelta) => cfg.kind==='responses' ? chatgpt.streamResponses(cfg,o,onDelta)
  : cfg.kind==='claude-cli' ? claudecode.streamClaudeCode(cfg,o,onDelta) : shared.streamModel(cfg,o,onDelta);
const listModels = (cfg) => cfg.kind==='responses' ? chatgpt.listModels() : cfg.kind==='claude-cli' ? claudecode.listModels() : shared.listModels(cfg);
const exchangeOpenRouter = (code,verifier) => shared.exchangeOpenRouter(settings.resolveProvider('openrouter').base,code,verifier);
module.exports = { streamModel, listModels, exchangeOpenRouter };
