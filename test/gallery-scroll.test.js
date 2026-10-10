const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup() {
  const els = Object.fromEntries(
    [
      'galleryKind',
      'galleryPlace',
      'galleryLoadStatus',
      'moreGallery',
      'galleryGrid',
      'gallerySentinel',
    ].map((k) => ['#' + k, { value: k === 'galleryKind' ? 'all' : '', setAttribute() {} }]),
  );
  const pending = [];
  const ctx = vm.createContext({
    groupId: 'one',
    currentView: 'gallery',
    galleryRequest: 0,
    galleryIds: [],
    galleryNext: null,
    galleryLoaded: false,
    URLSearchParams,
    Set,
    $: (k) => els[k],
    api: (url) => new Promise((resolve, reject) => pending.push({ url, resolve, reject })),
    renderGallery() {},
    mergeMedia() {},
    observePhotos() {},
    status() {},
    busy: (_, fn) => fn(),
    IntersectionObserver: class {
      observe() {}
      unobserve() {}
    },
  });
  const s = fs.readFileSync(
    require('node:path').join(__dirname, '../src/client/photos/pagination.js'),
    'utf8',
  );
  vm.runInContext(s + '\ninitPhotosPagination();', ctx);
  return { ctx, els, pending };
}
test('gallery coalesces load-more and ignores stale filter results', async () => {
  const h = setup();
  let first = h.ctx.loadGallery();
  h.pending[0].resolve({ items: [{ id: 'a' }], next: 'page2' });
  await first;
  const more = h.ctx.loadGallery(true);
  await h.ctx.loadGallery(true);
  assert.equal(h.pending.length, 2);
  assert.match(h.pending[1].url, /after=page2/);
  h.els['#galleryKind'].value = 'place';
  const reset = h.ctx.loadGallery();
  h.pending[2].resolve({ items: [{ id: 'b' }], next: null });
  await reset;
  h.pending[1].resolve({ items: [{ id: 'c' }], next: null });
  await more;
  assert.deepEqual([...h.ctx.galleryIds], ['b']);
  await h.ctx.loadGallery(true);
  assert.equal(h.pending.length, 3);
});
test('gallery failure exposes retry and retains loaded photos and cursor', async () => {
  const h = setup();
  let first = h.ctx.loadGallery();
  h.pending[0].resolve({ items: [{ id: 'a' }], next: 'page2' });
  await first;
  const more = h.ctx.loadGallery(true);
  h.pending[1].reject(new Error('offline'));
  await assert.rejects(more, /offline/);
  assert.equal(h.els['#moreGallery'].hidden, false);
  assert.deepEqual([...h.ctx.galleryIds], ['a']);
  const retry = h.els['#moreGallery'].onclick();
  h.pending[2].resolve({ items: [{ id: 'a' }, { id: 'b' }], next: null });
  await retry;
  assert.deepEqual([...h.ctx.galleryIds], ['a', 'b']);
  assert.equal(h.els['#moreGallery'].hidden, true);
});
