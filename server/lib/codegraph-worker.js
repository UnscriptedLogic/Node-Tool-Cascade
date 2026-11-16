'use strict';
const { parentPort, workerData } = require('worker_threads');
const {compare}=require('./codegraph');
const graph=require('./projectgraph').analyze(workerData.sources,workerData.csharp,workerData.coverage);
graph.diff=compare(workerData.previous,graph);
parentPort.postMessage(graph);
