const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  express = require('express');
test('photo retries stay scoped to the member, group and original visit', async () => {
  const group = '10000000-0000-0000-0000-000000000001',
    visit = '20000000-0000-0000-0000-000000000002',
    place = '30000000-0000-0000-0000-000000000003',
    key = '40000000-0000-0000-0000-000000000004';
  let canReadVisit = true;
  const queries = [];
  const db = {
    rpc: async () => ({ data: true }),
    from(table) {
      const filters = [];
      queries.push({ table, filters });
      return {
        select() {
          return this;
        },
        eq(...args) {
          filters.push(args);
          return this;
        },
        async maybeSingle() {
          return {
            data:
              table === 'h_visits'
                ? canReadVisit
                  ? { id: visit, place_id: place }
                  : null
                : table === 'h_places'
                  ? { id: place }
                  : {
                      id: 'existing',
                      visit_id: visit,
                      place_id: place,
                      caption: '',
                      deleted_at: null,
                    },
          };
        },
      };
    },
  };
  const app = express();
  app.use((req, res, next) => {
    req.db = db;
    req.user = { id: 'me' };
    next();
  });
  app.use(require('../src/server/workspace/router')());
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const upload = async () => {
    const body = new FormData();
    body.append('photo', new Blob(['same retry']), 'photo.jpg');
    body.append('visitId', visit);
    body.append('uploadId', key);
    return fetch(`http://127.0.0.1:${server.address().port}/groups/${group}/photos`, {
      method: 'POST',
      body,
    });
  };
  try {
    let r = await upload();
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { id: 'existing' });
    const media = queries.find((q) => q.table === 'h_media');
    assert.ok(media.filters.some(([k, v]) => k === 'group_id' && v === group));
    assert.ok(media.filters.some(([k, v]) => k === 'uploaded_by' && v === 'me'));
    assert.ok(media.filters.some(([k, v]) => k === 'upload_key' && v === key));
    canReadVisit = false;
    r = await upload();
    assert.equal(r.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
