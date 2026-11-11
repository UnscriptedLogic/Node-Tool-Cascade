'use strict';
// Every route module, in the order they are registered.
const { createRouter } = require('../http');

const router = createRouter();
for(const mod of ['page','session','project','auth','ai']) require('./'+mod)(router);
module.exports = router;
