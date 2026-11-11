'use strict';
// Provider adapters for the local app: the portable ones in shared/providers.js, plus ChatGPT plan usage.
const shared = require('../../shared/providers');
const chatgpt = require('./chatgpt');
const settings = require('./settings');

const streamModel = (cfg,o,onDelta) => cfg.kind==='responses' ? chatgpt.streamResponses(cfg,o,onDelta) : shared.streamModel(cfg,o,onDelta);
const listModels = (cfg) => cfg.kind==='responses' ? chatgpt.listModels() : shared.listModels(cfg);
const exchangeOpenRouter = (code,verifier) => shared.exchangeOpenRouter(settings.resolveProvider('openrouter').base,code,verifier);
module.exports = { streamModel, listModels, exchangeOpenRouter };
