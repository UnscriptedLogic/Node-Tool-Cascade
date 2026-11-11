#!/usr/bin/env node
'use strict';
// Builds the static, no-install web version (for GitHub Pages): dist/web/index.html
// The page is the same app/ (assembled by scripts/assemble.js), flagged to run in "web" mode (no server, demo + OpenRouter).
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname,'..');
const { assemble } = require('./assemble');
const repo = process.env.REPO_URL || 'https://github.com/';
const html = assemble({ inline:true, runtime:'<script>window.__WEB__=true;</script>' }).split('__REPO_URL__').join(repo);
const out = path.join(root,'dist','web');
fs.mkdirSync(out,{ recursive:true });
fs.writeFileSync(path.join(out,'index.html'),html);
fs.writeFileSync(path.join(out,'.nojekyll'),'');   // tell GitHub Pages not to run Jekyll
console.log(`Built ${path.relative(root,path.join(out,'index.html'))} (${Math.round(html.length/1024)} KB)`);
