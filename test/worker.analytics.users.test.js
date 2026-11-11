'use strict';
// Signed-in people are counted with a stable one-way ID, so "users of Claude this month" can be counted, and nothing else about them.
const test = require('node:test'), assert = require('node:assert/strict');
const { hasSqlite } = require('./helpers/d1');
const { setup } = require('./helpers/worker');
const skip = !hasSqlite() && 'node:sqlite needs Node 22.5 or newer';

test('analytics users: a signed-in person keeps one ID across days, two people differ, and the ID is not the account id or email',{ skip },async()=>{
  const w = await setup(), points = []; w.env.ANALYTICS = { writeDataPoint:(p)=>points.push(p) }; w.env.ENV_NAME = 'prod';
  const a = await w.signIn({ sub:'ga', email:'ada@example.com' }), b = await w.signIn({ sub:'gb', email:'bob@example.com' });
  const ev = (cookie,body) => w.call('POST','/api/event',{ cookie, body });
  await ev(a.cookie,{ name:'ask' }); w.tick(3*86400e3); await ev(a.cookie,{ name:'ask' }); await ev(b.cookie,{ name:'ask' });
  const asks = points.filter(p=>p.blobs[0]==='ask');
  assert.equal(asks[0].indexes[0],asks[1].indexes[0],'the same person three days later'); assert.notEqual(asks[0].indexes[0],asks[2].indexes[0],'a different person');
  assert.equal(asks[0].blobs[5],'1');
  const userIds = w.db.raw.prepare('SELECT id FROM users').all().map(r=>r.id), all = JSON.stringify(points);
  for(const s of [...userIds,'ada@example.com','bob@example.com']) assert.ok(!all.includes(s),'no account id or email in the data');
  // the sign-in itself uses the same ID as later events
  assert.equal(points.filter(p=>p.blobs[0]==='signin')[0].indexes[0],points.find(p=>p.blobs[0]==='ask').indexes[0]);
  // signed-out visitors are not given the stable ID
  w.env.ANALYTICS.writeDataPoint = (p)=>points.push(p); const before = points.length;
  await w.call('POST','/api/event',{ body:{ name:'ask' } });
  assert.equal(points[before].blobs[5],'0'); assert.notEqual(points[before].indexes[0],asks[0].indexes[0]);
});
