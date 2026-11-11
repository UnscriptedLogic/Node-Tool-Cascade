'use strict';
// State that routes and the lifecycle code share: which port we are on, tabs that are open, a scan in progress.
// Keeping it here means a route module never has to reach into the HTTP server itself.
const path = require('path');
const settings = require('./lib/settings');
const project = require('./lib/project');
const { DATA_DIR } = require('./lib/util');

const PREFERRED = +process.env.PORT || 4173;
const ctx = {
  ROOT: path.resolve(__dirname,'..'),
  HOST: '127.0.0.1',
  PREFERRED,
  PORT: PREFERRED,                 // the port actually in use; differs when the preferred one is busy
  TREE_FILE: path.join(DATA_DIR,'tree.json'),
  GRACE: +process.env.CASCADE_BYE_GRACE_MS || 6000,
  scanState: { running:false, error:'' },
  clients: new Set(),              // ids of open tabs
  byeTimer: null,
  shutdown: () => {},              // replaced by lifecycle.js
  // everything the page may know: settings without keys, the server's own details, and the scanned project
  pub(){
    const o = settings.publicSettings({ port:ctx.PORT, preferred:ctx.PREFERRED, pid:process.pid });
    o.project = project.publicInfo();
    return o;
  }
};
module.exports = ctx;
