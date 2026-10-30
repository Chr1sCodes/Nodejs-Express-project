import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../server/data/db.js';
import { createApp } from '../server/app.js';

describe('error logging middleware', () => {
  const logs = { error: [], warn: [] };
  const logger = {
    error: (line) => logs.error.push(JSON.parse(line)),
    warn: (line) => logs.warn.push(JSON.parse(line)),
  };
  const brokenMarket = {
    snapshot() {
      throw new Error('market feed exploded');
    },
  };
  let server;
  let base;

  before(async () => {
    const db = createDatabase(':memory:');
    server = createApp({ db, logger, market: brokenMarket }).listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}/api`;
  });

  after(() => server.close());

  test('logs 500s with stack and request ID, but hides details from the client', async () => {
    const res = await fetch(`${base}/market/popular?debug=secret`);
    assert.equal(res.status, 500);
    const body = await res.json();
    const id = res.headers.get('x-request-id');
    assert.ok(id);
    assert.deepEqual(body, { error: 'Internal server error', requestId: id });

    const entry = logs.error.at(-1);
    assert.equal(entry.level, 'error');
    assert.equal(entry.requestId, id);
    assert.equal(entry.method, 'GET');
    assert.equal(entry.path, '/api/market/popular', 'query string is not logged');
    assert.equal(entry.status, 500);
    assert.equal(entry.error, 'market feed exploded');
    assert.match(entry.stack, /market feed exploded/);
  });

  test('logs client errors as warnings without request bodies', async () => {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'SuperSecret123' }),
    });
    assert.equal(res.status, 401);

    const entry = logs.warn.at(-1);
    assert.equal(entry.level, 'warn');
    assert.equal(entry.status, 401);
    assert.equal(entry.path, '/api/auth/login');
    assert.equal(entry.requestId, res.headers.get('x-request-id'));
    assert.equal(entry.stack, undefined);

    const all = JSON.stringify(logs);
    assert.ok(!all.includes('SuperSecret123'), 'passwords never reach the logs');
    assert.ok(!all.includes('nobody@example.com'), 'request bodies never reach the logs');
  });

  test('logs malformed JSON as a 400 warning', async () => {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'Invalid JSON' });
    assert.equal(logs.warn.at(-1).status, 400);
  });
});
