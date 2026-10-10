const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const router = require('../src/server/auth/router');
const jwt = (role) =>
  'eyJhbGciOiJIUzI1NiJ9.' +
  Buffer.from(JSON.stringify({ role })).toString('base64url') +
  '.signature';

test('browser config never accepts service_role or secret keys', () => {
  assert.equal(router.isPublicKey(jwt('service_role')), false);
  assert.equal(router.isPublicKey('sb_secret_test'), false);
  assert.equal(router.isPublicKey(undefined), false);
  assert.equal(router.isPublicKey(jwt('anon')), true);
  assert.equal(router.isPublicKey('sb_publishable_test'), true);
});
test('group API rejects missing authentication and config redacts a service key', async () => {
  const before = { ...process.env };
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = jwt('service_role');
  let server;
  try {
    const app = express();
    app.use(express.json());
    app.use('/api/v2', router());
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const url = 'http://127.0.0.1:' + server.address().port;
    const config = await fetch(url + '/api/v2/config').then((r) => r.json());
    assert.equal(config.ready, false);
    assert.equal(config.publicKey, null);
    await new Promise((resolve) => server.close(resolve));
    server = null;
    process.env.SUPABASE_PUBLISHABLE_KEY = jwt('anon');
    const secured = express();
    secured.use('/api/v2', router());
    server = await new Promise((resolve) => {
      const s = secured.listen(0, '127.0.0.1', () => resolve(s));
    });
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/v2/groups');
    assert.equal(response.status, 401);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    for (const k of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY']) {
      if (before[k] === undefined) delete process.env[k];
      else process.env[k] = before[k];
    }
  }
});
