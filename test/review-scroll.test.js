const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm'),
  fs = require('node:fs'),
  path = require('node:path');
function setup({ count = 24, next = 'page2' } = {}) {
  const elements = Object.fromEntries(
    ['journalLoadStatus', 'moreVisits', 'records', 'journalSentinel', 'moreArchive'].map((id) => [
      '#' + id,
      { hidden: true, setAttribute() {} },
    ]),
  );
  const pending = [],
    renders = [],
    observers = [];
  const context = vm.createContext({
    groupId: 'group',
    filter: '',
    currentView: 'journal',
    journalSort: 'latest',
    updateJournalSortControls() {},
    journalRequest: 0,
    journalLimit: 24,
    visitNext: next,
    visits: Array.from({ length: count }, (_, i) => ({ id: String(i) })),
    $: (id) => elements[id],
    journalRows: () => context.visits,
    api: (url) => new Promise((resolve, reject) => pending.push({ url, resolve, reject })),
    renderJournalFeed: (append) => renders.push({ append, limit: context.journalLimit }),
    observePhotos() {},
    IntersectionObserver: class {
      constructor(callback) {
        this.callback = callback;
        observers.push(this);
      }
      observe() {
        this.active = true;
      }
      unobserve() {
        this.active = false;
      }
    },
  });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../src/client/reviews/data.js'), 'utf8'),
    context,
  );
  vm.runInContext('journalLoaded=true;initReviewsData();updateJournalPagination();', context);
  return { context, elements, pending, renders, observer: observers[0] };
}
test('review sentinel appends legacy rows without extra requests, and stops at the end', async () => {
  const h = setup({ count: 60, next: null });
  await h.context.loadMoreReviews();
  assert.equal(h.context.journalLimit, 48);
  assert.equal(h.renders[0].append, true);
  assert.equal(h.observer.active, true);
  await h.context.loadMoreReviews();
  assert.equal(h.context.journalLimit, 72);
  assert.equal(h.observer.active, false);
  await h.context.loadMoreReviews();
  assert.equal(h.renders.length, 2);
  assert.equal(h.pending.length, 0);
  assert.equal(h.elements['#moreVisits'].hidden, true);
});
test('review requests coalesce and retry preserves the page limit and loaded cards', async () => {
  const h = setup();
  const first = h.context.loadMoreReviews();
  await h.context.loadMoreReviews();
  assert.equal(h.pending.length, 1);
  assert.equal(h.context.journalLimit, 48);
  h.pending[0].reject(Error('offline'));
  await first;
  assert.equal(h.context.journalLimit, 24);
  assert.equal(h.renders.length, 0);
  assert.equal(h.context.visits.length, 24);
  assert.equal(h.elements['#moreVisits'].hidden, false);
  assert.equal(h.observer.active, false);
  const retry = h.elements['#moreVisits'].onclick();
  h.pending[1].resolve({
    items: [{ id: '0' }, ...Array.from({ length: 24 }, (_, i) => ({ id: String(24 + i) }))],
    next: null,
  });
  await retry;
  assert.equal(h.context.visits.length, 48);
  assert.equal(h.context.journalLimit, 48);
  assert.equal(h.elements['#moreVisits'].hidden, true);
  assert.equal(h.observer.active, false);
});
test('filter/group changes invalidate pending review pages without resetting the new state', async () => {
  for (const change of ['filter', 'groupId']) {
    const h = setup();
    const old = h.context.loadMoreReviews();
    h.context[change] = 'new';
    h.context.journalRequest++;
    h.context.journalLimit = 24;
    h.context.visits = [{ id: 'new' }];
    h.context.visitNext = null;
    h.context.resetJournalPagination();
    h.pending[0].resolve({ items: [{ id: 'old' }], next: null });
    await old;
    assert.equal(h.context.journalLimit, 24);
    assert.deepEqual(h.context.visits, [{ id: 'new' }]);
    assert.equal(h.renders.length, 0);
    assert.equal(h.observer.active, false);
  }
});
test('review sentinel ignores other tabs and repeated cursors expose a retry', async () => {
  const h = setup();
  h.context.currentView = 'gallery';
  h.observer.callback([{ isIntersecting: true }]);
  assert.equal(h.pending.length, 0);
  h.context.currentView = 'journal';
  const request = h.context.loadMoreReviews();
  h.pending[0].resolve({ items: [], next: 'page2' });
  await request;
  assert.equal(h.elements['#moreVisits'].hidden, false);
  assert.equal(h.context.journalLimit, 24);
});

test('non-latest orders load every cursor page before sorting, latest stays incremental', async () => {
  const h = setup({ count: 48 });
  h.context.journalSort = 'highest';
  const load = h.context.ensureJournalPage();
  assert.equal(h.pending.length, 1);
  h.pending[0].resolve({ items: [{ id: '48' }], next: 'page3' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.pending.length, 2);
  h.pending[1].resolve({ items: [{ id: '49' }], next: null });
  await load;
  assert.equal(h.context.visits.length, 50);
  const latest = setup({ count: 48 });
  await latest.context.ensureJournalPage();
  assert.equal(latest.pending.length, 0);
});
