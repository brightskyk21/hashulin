const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
test('feed APIs enforce bounded cursors, group scope, media filters and calendar overlap', async () => {
  const group = '10000000-0000-0000-0000-000000000001',
    calls = [];
  const db = {
    rpc: async (name) => {
      assert.equal(name, 'h_is_member');
      return { data: true };
    },
    from(table) {
      calls.push(['from', table]);
      const q = {};
      for (const method of ['select', 'eq', 'is', 'not', 'or', 'lte', 'order'])
        q[method] = (...args) => {
          calls.push([method, ...args]);
          return q;
        };
      q.limit = (n) => {
        calls.push(['limit', n]);
        return Promise.resolve({ data: [] });
      };
      q.range = () => Promise.resolve({ data: [] });
      return q;
    },
  };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: 'test' };
    req.db = db;
    next();
  });
  app.use(require('../src/server/workspace/router')());
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    let r = await fetch(base + `/groups/${group}/media?kind=couple`);
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { items: [], next: null });
    assert.ok(calls.some((c) => c[0] === 'eq' && c[1] === 'group_id' && c[2] === group));
    assert.ok(calls.some((c) => c[0] === 'is' && c[1] === 'place_id'));
    assert.ok(calls.some((c) => c[0] === 'limit' && c[1] === 25));
    r = await fetch(base + `/groups/${group}/media?after=invalid`);
    assert.equal(r.status, 400);
    r = await fetch(base + `/groups/${group}/events?from=2026-10-01&to=2026-11-15`);
    assert.equal(r.status, 200);
    assert.ok(calls.some((c) => c[0] === 'lte' && c[1] === 'event_date' && c[2] === '2026-11-15'));
    assert.ok(
      calls.some(
        (c) =>
          c[0] === 'or' &&
          c[1] === 'end_date.gte.2026-10-01,and(end_date.is.null,event_date.gte.2026-10-01)',
      ),
    );
    r = await fetch(base + `/groups/${group}/events?from=2020-01-01&to=2026-01-01`);
    assert.equal(r.status, 400);
    r = await fetch(base + `/groups/${group}/photo-urls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array(49).fill(group) }),
    });
    assert.equal(r.status, 400);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
