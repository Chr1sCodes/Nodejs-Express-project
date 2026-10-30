import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../server/data/db.js';
import { createApp } from '../server/app.js';
import { parseAmount } from '../server/routes/accounts.js';

let server;
let base;
let db;

before(async () => {
  db = createDatabase(':memory:');
  server = createApp({ db, loginRateLimit: { windowMs: 60_000, max: 1000 } }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => {
  server.close();
  db.close();
});

/** Tiny client that keeps the session cookie between calls, like a browser would. */
function client() {
  let cookie = '';
  return async (path, { method = 'GET', body, headers = {} } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }), ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const data = res.status === 204 ? null : await res.json();
    return { status: res.status, body: data, setCookie };
  };
}

async function registerUser(name, email, password = 'Passw0rd!') {
  const call = client();
  const res = await call('/auth/register', { method: 'POST', body: { name, email, password } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const { body } = await call('/accounts');
  const [checking, savings] = body.accounts;
  return { call, user: res.body.user, checking, savings };
}

describe('auth', () => {
  test('register sets a secure session cookie and opens two accounts', async () => {
    const call = client();
    const res = await call('/auth/register', {
      method: 'POST',
      body: { name: ' Ada Lovelace ', email: 'ADA@example.com', password: 'Engine123' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.name, 'Ada Lovelace');
    assert.equal(res.body.user.email, 'ada@example.com');
    assert.equal(res.body.user.passwordHash, undefined);
    assert.match(res.setCookie, /HttpOnly/);
    assert.match(res.setCookie, /SameSite=Strict/);

    const me = await call('/auth/me');
    assert.equal(me.body.user.email, 'ada@example.com');

    const { body } = await call('/accounts');
    assert.deepEqual(body.accounts.map((a) => a.type), ['checking', 'savings']);
    assert.ok(body.accounts.every((a) => /^\d{10}$/.test(a.number) && a.balanceCents === 0));
  });

  test('passwords are stored hashed', () => {
    const row = db.prepare("SELECT password_hash FROM users WHERE email = 'ada@example.com'").get();
    assert.match(row.password_hash, /^scrypt\$/);
    assert.ok(!row.password_hash.includes('Engine123'));
  });

  test('rejects duplicate email and weak input', async () => {
    const call = client();
    const dup = await call('/auth/register', {
      method: 'POST',
      body: { name: 'X', email: 'ada@example.com', password: 'Engine123' },
    });
    assert.equal(dup.status, 409);

    const bad = await call('/auth/register', {
      method: 'POST',
      body: { name: '', email: 'nope', password: 'short' },
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.details.length, 3);
  });

  test('login, logout and invalid credentials', async () => {
    const call = client();
    const wrong = await call('/auth/login', {
      method: 'POST',
      body: { email: 'ada@example.com', password: 'wrongpass1' },
    });
    assert.equal(wrong.status, 401);
    const unknown = await call('/auth/login', {
      method: 'POST',
      body: { email: 'ghost@example.com', password: 'wrongpass1' },
    });
    assert.equal(unknown.status, 401);
    assert.equal(unknown.body.error, wrong.body.error);

    const ok = await call('/auth/login', {
      method: 'POST',
      body: { email: 'Ada@Example.com', password: 'Engine123' },
    });
    assert.equal(ok.status, 200);
    assert.equal((await call('/auth/me')).body.user.email, 'ada@example.com');

    assert.equal((await call('/auth/logout', { method: 'POST' })).status, 204);
    assert.equal((await call('/auth/me')).body.user, null);
    assert.equal((await call('/accounts')).status, 401);
  });

  test('logout works without a request body', async () => {
    const res = await fetch(`${base}/auth/logout`, { method: 'POST' });
    assert.equal(res.status, 204);
  });

  test('protected routes require a session', async () => {
    const call = client();
    assert.equal((await call('/accounts')).status, 401);
    assert.equal((await call('/transactions')).status, 401);
    const forged = await call('/accounts', { headers: { Cookie: 'sid=forged' } });
    assert.equal(forged.status, 401);
  });

  test('non-JSON state-changing requests are rejected (CSRF defence)', async () => {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'email=a&password=b',
    });
    assert.equal(res.status, 415);
  });

  test('login is rate limited', async () => {
    const limited = createApp({ db, loginRateLimit: { windowMs: 60_000, max: 2 } }).listen(0);
    await new Promise((r) => limited.once('listening', r));
    const url = `http://127.0.0.1:${limited.address().port}/api/auth/login`;
    const attempt = () =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'x@example.com', password: 'nope12345' }),
      });
    assert.equal((await attempt()).status, 401);
    assert.equal((await attempt()).status, 401);
    assert.equal((await attempt()).status, 429);
    limited.close();
  });
});

describe('banking', () => {
  test('deposit and withdraw update balance and ledger', async () => {
    const { call, checking } = await registerUser('Bob', 'bob@example.com');

    const dep = await call(`/accounts/${checking.id}/deposit`, {
      method: 'POST',
      body: { amount: '100.10', description: 'Paycheck' },
    });
    assert.equal(dep.status, 200);
    assert.equal(dep.body.balanceCents, 10010);

    const wd = await call(`/accounts/${checking.id}/withdraw`, { method: 'POST', body: { amount: 0.1 } });
    assert.equal(wd.body.balanceCents, 10000);

    const over = await call(`/accounts/${checking.id}/withdraw`, { method: 'POST', body: { amount: 100.01 } });
    assert.equal(over.status, 422);
    assert.equal(over.body.error, 'Insufficient funds');

    const tx = await call(`/transactions?accountId=${checking.id}`);
    assert.deepEqual(
      tx.body.map((t) => [t.type, t.amountCents, t.balanceAfterCents, t.description]),
      [
        ['withdrawal', 10, 10000, 'Withdrawal'],
        ['deposit', 10010, 10010, 'Paycheck'],
      ]
    );

    const { body } = await call('/accounts');
    assert.equal(body.summary.totalCents, 10000);
    assert.equal(body.summary.monthInCents, 10010);
    assert.equal(body.summary.monthOutCents, 10);
  });

  test('transfers between own accounts and to other users', async () => {
    const alice = await registerUser('Alice', 'alice@example.com');
    const carol = await registerUser('Carol', 'carol@example.com');
    await alice.call(`/accounts/${alice.checking.id}/deposit`, { method: 'POST', body: { amount: 500 } });

    const internal = await alice.call('/transfers', {
      method: 'POST',
      body: { fromAccountId: alice.checking.id, toAccountNumber: alice.savings.number, amount: 200 },
    });
    assert.equal(internal.status, 200);
    assert.equal(internal.body.balanceCents, 30000);

    const external = await alice.call('/transfers', {
      method: 'POST',
      body: {
        fromAccountId: alice.checking.id,
        toAccountNumber: carol.checking.number,
        amount: '50.25',
        description: 'Dinner',
      },
    });
    assert.equal(external.status, 200);
    assert.equal(external.body.balanceCents, 24975);

    const carolAccounts = (await carol.call('/accounts')).body;
    assert.equal(carolAccounts.accounts[0].balanceCents, 5025);
    const [carolTx] = (await carol.call('/transactions')).body;
    assert.equal(carolTx.type, 'transfer_in');
    assert.equal(carolTx.counterparty, 'Alice');
    assert.equal(carolTx.description, 'Dinner');

    // Internal transfers are excluded from monthly in/out.
    const aliceSummary = (await alice.call('/accounts')).body.summary;
    assert.equal(aliceSummary.totalCents, 44975);
    assert.equal(aliceSummary.monthInCents, 50000);
    assert.equal(aliceSummary.monthOutCents, 5025);
  });

  test('cannot touch other users accounts or overdraw via transfer', async () => {
    const mallory = await registerUser('Mallory', 'mallory@example.com');
    const victim = await registerUser('Victim', 'victim@example.com');
    await victim.call(`/accounts/${victim.checking.id}/deposit`, { method: 'POST', body: { amount: 100 } });

    const steal = await mallory.call('/transfers', {
      method: 'POST',
      body: { fromAccountId: victim.checking.id, toAccountNumber: mallory.checking.number, amount: 100 },
    });
    assert.equal(steal.status, 404);
    assert.equal(
      (await mallory.call(`/accounts/${victim.checking.id}/withdraw`, { method: 'POST', body: { amount: 1 } }))
        .status,
      404
    );
    assert.equal((await mallory.call(`/transactions?accountId=${victim.checking.id}`)).body.length, 0);

    const overdraw = await mallory.call('/transfers', {
      method: 'POST',
      body: { fromAccountId: mallory.checking.id, toAccountNumber: victim.checking.number, amount: 1 },
    });
    assert.equal(overdraw.status, 422);

    const self = await victim.call('/transfers', {
      method: 'POST',
      body: { fromAccountId: victim.checking.id, toAccountNumber: victim.checking.number, amount: 1 },
    });
    assert.equal(self.status, 400);

    const missing = await victim.call('/transfers', {
      method: 'POST',
      body: { fromAccountId: victim.checking.id, toAccountNumber: '0000000000', amount: 1 },
    });
    assert.equal(missing.status, 404);
    assert.equal((await victim.call('/accounts')).body.accounts[0].balanceCents, 10000);
  });

  test('parseAmount validation', () => {
    assert.equal(parseAmount('0.01'), 1);
    assert.equal(parseAmount(19.99), 1999);
    assert.equal(parseAmount('1000000'), 100_000_000);
    for (const bad of ['0', '-5', '1.234', 'abc', '', null, '1e3', '1000000.01', Infinity]) {
      assert.throws(() => parseAmount(bad), undefined, String(bad));
    }
  });
});
