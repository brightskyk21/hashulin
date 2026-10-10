const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const router = require('../src/server/auth/router');
const group = '10000000-0000-0000-0000-000000000001',
  user = '10000000-0000-0000-0000-000000000002';
test('review API sends expected version and exposes conflict; membership removal requires authentication', async () => {
  const env = { ...process.env };
  let server;
  const calls = [];
  try {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
    const makeClient = () => ({
      auth: { getUser: async () => ({ data: { user: { id: user } } }) },
      rpc: async (name, args) => {
        calls.push({ name, args });
        return name === 'h_review_visit' ? { error: { code: '40001' } } : { data: null };
      },
    });
    const app = express();
    app.use(express.json());
    app.use('/api/v2', router({ makeClient }));
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const url = 'http://127.0.0.1:' + server.address().port + '/api/v2';
    const auth = { 'Content-Type': 'application/json', Authorization: 'Bearer test' };
    let result = await fetch(url + '/visits/' + group + '/review', {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ score: 8, comment: 'draft', version: 1 }),
    });
    assert.equal(result.status, 409);
    assert.match((await result.json()).error, /최신 평가/);
    assert.equal(calls[0].args.expected_version, 1);
    result = await fetch(url + '/visits/' + group + '/review', {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ score: 8, comment: 'unversioned' }),
    });
    assert.equal(result.status, 400);
    assert.equal(calls.length, 1);
    result = await fetch(url + '/groups/' + group + '/members/' + user, { method: 'DELETE' });
    assert.equal(result.status, 401);
    result = await fetch(url + '/groups/' + group + '/members/' + user, {
      method: 'DELETE',
      headers: auth,
    });
    assert.equal(result.status, 200);
    assert.deepEqual(calls[1], {
      name: 'h_remove_group_member',
      args: { target_group: group, target_user: user },
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    process.env = env;
  }
});
