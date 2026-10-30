import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../server/data/db.js';
import { createApp } from '../server/app.js';
import { seedDemoData, DEMO_USERS, DEMO_PASSWORD } from '../server/data/seed.js';

const silentLogger = { warn() {}, error() {} };

describe('demo seed data', () => {
  let db;
  let server;
  let base;

  before(async () => {
    db = createDatabase(':memory:');
    assert.equal(await seedDemoData(db), true);
    server = createApp({ db, logger: silentLogger }).listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}/api`;
  });

  after(() => {
    server.close();
    db.close();
  });

  test('creates every demo user with checking and savings accounts', () => {
    const users = db.prepare('SELECT email FROM users ORDER BY id').all().map((u) => u.email);
    assert.deepEqual(users, DEMO_USERS.map((u) => u.email));
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM accounts').get();
    assert.equal(count, DEMO_USERS.length * 2);
  });

  test('balances match the ledger and are never negative', () => {
    const rows = db
      .prepare(
        `SELECT a.number, a.balance_cents,
                (SELECT balance_after_cents FROM transactions t WHERE t.account_id = a.id ORDER BY t.id DESC LIMIT 1) AS last,
                (SELECT COALESCE(SUM(CASE WHEN type IN ('deposit','transfer_in') THEN amount_cents ELSE -amount_cents END), 0)
                   FROM transactions t WHERE t.account_id = a.id) AS net,
                (SELECT MIN(balance_after_cents) FROM transactions t WHERE t.account_id = a.id) AS min
           FROM accounts a`
      )
      .all();
    for (const r of rows) {
      assert.equal(r.balance_cents, r.net, r.number);
      assert.equal(r.balance_cents, r.last ?? 0, r.number);
      assert.ok((r.min ?? 0) >= 0, r.number);
    }
  });

  test('does not reseed a database that already has users', async () => {
    assert.equal(await seedDemoData(db), false);
    assert.equal(db.prepare('SELECT COUNT(*) AS c FROM users').get().c, DEMO_USERS.length);
  });

  test('demo users can sign in and see history, then transfer to each other', async () => {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ada@example.com', password: DEMO_PASSWORD }),
    });
    assert.equal(res.status, 200);
    const cookie = res.headers.get('set-cookie').split(';')[0];
    const get = (path) => fetch(base + path, { headers: { Cookie: cookie } }).then((r) => r.json());

    const { accounts } = await get('/accounts');
    assert.deepEqual(accounts.map((a) => a.number), ['1000000001', '1000000002']);
    assert.ok(accounts[0].balanceCents > 0);
    assert.ok((await get('/transactions')).length > 0);

    const transfer = await fetch(`${base}/transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ fromAccountId: accounts[0].id, toAccountNumber: '1000000003', amount: '10' }),
    });
    assert.equal(transfer.status, 200);
  });
});
