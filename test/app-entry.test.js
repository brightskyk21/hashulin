const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('server serves the built app, vendor script and compatible legacy asset URLs', async () => {
  const previous = { ...process.env };
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'server-only-test-key';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  const app = require('../src/server/app');
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(base + '/healthz');
    assert.deepEqual(await health.json(), { ok: true });
    const entry = await fetch(base + '/?code=oauth-return', { redirect: 'manual' });
    assert.equal(entry.status, 302);
    assert.equal(entry.headers.get('location'), '/v2/?code=oauth-return');

    const page = await fetch(base + '/v2/');
    assert.equal(page.status, 200);
    const html = await page.text();
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, 'HTML fragments must not duplicate IDs');
    for (const file of ['app.js', 'app.css']) {
      assert.ok(html.includes(`"${file}"`));
      const asset = await fetch(base + '/v2/' + file);
      assert.equal(asset.status, 200);
      const body = await asset.text();
      assert.equal(body, fs.readFileSync(path.join(__dirname, '../public/v2', file), 'utf8'));
      if (file.endsWith('.js')) new vm.Script(body);
    }
    const vendor = await fetch(base + '/vendor/supabase.js');
    assert.equal(vendor.status, 200);
    assert.match(vendor.headers.get('content-type'), /javascript/);
    const legacy = await fetch(base + '/app.js');
    assert.equal(legacy.status, 200);
    assert.equal(
      await legacy.text(),
      fs.readFileSync(path.join(__dirname, '../public/legacy/app.js'), 'utf8'),
    );

    const config = await fetch(base + '/api/v2/config').then((response) => response.json());
    assert.equal(config.publicKey, 'sb_publishable_test');
    assert.ok(!JSON.stringify(config).includes('server-only-test-key'));
    for (const endpoint of [
      '/api/v2/groups',
      '/api/v2/groups/any/content',
      '/api/v2/photos/any/url',
    ]) {
      const response = await fetch(base + endpoint);
      assert.equal(response.status, 401, endpoint);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    process.env = previous;
  }
});
