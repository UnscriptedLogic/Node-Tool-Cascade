'use strict';
// Small shared helpers. The portable ones live in shared/util.js; this adds what needs Node.
const path = require('path');
const shared = require('../../shared/util');

// Where tree.json, settings.json and chatgpt-auth.json live. Defaults to the repo folder.
const DATA_DIR = process.env.CASCADE_DATA_DIR ? path.resolve(process.env.CASCADE_DATA_DIR) : path.resolve(__dirname,'..','..');

class HttpError extends Error { constructor(status,message){ super(message); this.status = status; } }

module.exports = { DATA_DIR, HttpError, ...shared };
