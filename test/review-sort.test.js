const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs'),
  path = require('node:path');
const model = fs.readFileSync(path.join(__dirname, '../src/client/reviews/model.js'), 'utf8');
function row(key, date, scores) {
  return { key, date, reviews: scores.map((score) => ({ score })) };
}
test('review sorting uses date and card mean, keeps ties stable and missing values last', () => {
  const c = vm.createContext({});
  vm.runInContext(model, c);
  const rows = [
    row('b', '2026-10-02', [6, 10]),
    row('a', '2026-10-02', [8]),
    row('c', '2026-10-01', [9]),
    row('d', '', [4]),
    row('e', '2026-10-03', []),
  ];
  const keys = (order) => Array.from(c.sortJournalRows(rows, order), (r) => r.key);
  assert.deepEqual(keys('latest'), ['e', 'a', 'b', 'c', 'd']);
  assert.deepEqual(keys('oldest'), ['c', 'a', 'b', 'e', 'd']);
  assert.deepEqual(keys('highest'), ['c', 'a', 'b', 'd', 'e']);
  assert.deepEqual(keys('lowest'), ['d', 'a', 'b', 'c', 'e']);
  assert.equal(rows[0].key, 'b');
  assert.equal(c.journalAverage(rows[0]), 8);
});
test('rating order merges legacy/new reviews and uses only selected author scores', () => {
  const c = vm.createContext({});
  vm.runInContext(model, c);
  const p = { id: 'p', legacy_id: 'old' },
    q = { id: 'q' };
  const visits = [
    { id: 'v', visited_on: '2026-10-01', h_places: p, h_reviews: [{ author_id: 'min', score: 5 }] },
    { id: 'w', visited_on: '2026-10-02', h_places: q, h_reviews: [{ author_id: 'min', score: 6 }] },
  ];
  const archive = {
    places: [{ id: 'old' }],
    authors: [{ reviewer: '하진', user_id: 'ha', accepted_at: 'yes' }],
    reviews: [{ place_id: 'old', visited_on: '2026-10-01', reviewer: '하진', score: 9 }],
  };
  const all = c.sortJournalRows(c.buildJournalRows(visits, archive, [p, q]), 'highest');
  assert.equal(all[0].place.id, 'p');
  assert.equal(c.journalAverage(all[0]), 7);
  const mine = c.sortJournalRows(c.buildJournalRows(visits, archive, [p, q], 'min'), 'highest');
  assert.equal(mine[0].place.id, 'q');
  assert.equal(c.journalAverage(mine[1]), 5);
});
function sortHarness() {
  const pending = [],
    renders = [],
    messages = [];
  const c = vm.createContext({
    groupId: 'g',
    filter: '',
    journalRequest: 1,
    journalLimit: 48,
    journalLoaded: true,
    journalBusy: false,
    journalFailed: false,
    visitNext: 'page2',
    visits: [],
    updateJournalPagination() {},
    renderJournalFeed: () => renders.push(vm.runInContext('journalSort', c)),
    observePhotos() {},
    status: (t) => messages.push(t),
    ensureJournalPage: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    setJournalSortMenu() {},
  });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../src/client/reviews/sort.js'), 'utf8'),
    c,
  );
  c.setJournalSortMenu = () => {};
  return { c, pending, renders, messages };
}
test('sort failure restores the prior order/page size; a filter change discards stale completion', async () => {
  const h = sortHarness();
  const sort = h.c.changeJournalSort('highest');
  assert.equal(h.c.journalLoaded, false);
  assert.equal(h.c.journalBusy, true);
  h.pending[0].reject(Error('offline'));
  await sort;
  assert.equal(vm.runInContext('journalSort', h.c), 'latest');
  assert.equal(h.c.journalLimit, 48);
  assert.equal(h.c.journalLoaded, true);
  assert.equal(h.c.journalBusy, false);
  assert.equal(h.messages.length, 1);
  const stale = h.c.changeJournalSort('oldest');
  h.c.journalRequest++;
  h.c.filter = 'ha';
  h.c.journalBusy = false;
  h.pending[1].resolve();
  await stale;
  assert.equal(h.renders.length, 1);
  assert.equal(h.c.journalBusy, false);
});
