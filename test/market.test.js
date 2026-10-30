import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../server/data/db.js';
import { createApp } from '../server/app.js';
import { createMarket } from '../server/services/market.js';

describe('sample market data', () => {
  test('advances prices only as time passes', () => {
    let t = 0;
    const market = createMarket({ tickMs: 1000, now: () => t });
    const first = market.snapshot();
    assert.deepEqual(market.snapshot().stocks, first.stocks, 'no tick without elapsed time');

    t = 3000;
    const later = market.snapshot();
    assert.notDeepEqual(later.stocks.map((s) => s.price), first.stocks.map((s) => s.price));
    assert.equal(later.updatedAt, new Date(3000).toISOString());
  });

  test('reports consistent change values and bounded history', () => {
    let t = 0;
    const market = createMarket({ tickMs: 1000, now: () => t });
    t = 1_000_000;
    for (const s of market.snapshot().stocks) {
      assert.ok(s.price > 0, s.symbol);
      assert.equal(s.history.length, 30, s.symbol);
      assert.equal(s.history.at(-1), s.price, s.symbol);
      const open = s.price - s.change;
      assert.ok(Math.abs((s.change / open) * 100 - s.changePercent) < 0.01, s.symbol);
    }
  });

  test('GET /api/market/popular is public and labeled as sample data', async () => {
    const db = createDatabase(':memory:');
    const server = createApp({ db }).listen(0);
    await new Promise((r) => server.once('listening', r));
    try {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api/market/popular`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.sample, true);
      assert.ok(body.stocks.length >= 5);
      assert.ok(body.stocks.every((s) => typeof s.symbol === 'string' && typeof s.price === 'number'));
    } finally {
      server.close();
      db.close();
    }
  });
});
