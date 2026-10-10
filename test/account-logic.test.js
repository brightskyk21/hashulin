const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ctx = vm.createContext({ URL, URLSearchParams });
for (const file of [
  'reviews/model',
  'auth/model',
  'groups/invite-model',
  'map/clusters',
  'places/model',
])
  vm.runInContext(
    fs.readFileSync(require('node:path').join(__dirname, '../src/client/' + file + '.js'), 'utf8'),
    ctx,
  );
test('author tabs filter reviews within a shared visit, with accepted legacy ownership only', () => {
  const rows = [{ author_id: 'min' }, { author_id: 'ha' }];
  assert.equal(ctx.journalReviews(rows, 'min')[0], rows[0]);
  assert.equal(ctx.journalReviews(rows, 'ha').length, 1);
  assert.equal(ctx.journalReviews(rows).length, 2);
  const old = [{ reviewer: '민혁' }, { reviewer: '하진' }],
    authors = [
      { reviewer: '민혁', user_id: 'min', accepted_at: 'date' },
      { reviewer: '하진', user_id: 'ha', accepted_at: 'date' },
    ];
  assert.equal(ctx.journalReviews(old, 'min', authors).length, 1);
  assert.equal(ctx.journalReviews(old, 'min', authors)[0], old[0]);
  assert.equal(ctx.journalReviews(old, 'ha', authors)[0], old[1]);
  assert.equal(ctx.journalReviews(old, '', authors).length, 2);
  assert.equal(ctx.journalReviews(old, 'min', authors, '하진').length, 0);
  assert.equal(ctx.journalReviews(old, '', authors, '하진')[0], old[1]);
  authors[1].accepted_at = null;
  assert.equal(ctx.journalReviews(old, 'ha', authors).length, 0);
});
test('profile comes before invite acceptance, group choice is only needed for first-time members', () => {
  assert.equal(ctx.accountStep(null, [], 'invite'), 'profile');
  assert.equal(ctx.accountStep({}, [], 'invite'), 'invite');
  assert.equal(ctx.accountStep({}, [], null), 'group');
  assert.equal(ctx.accountStep({}, [{}], null), 'ready');
  assert.equal(ctx.accountStep({}, [{}], 'invite'), 'invite');
});
test('code and link resolve to the same full-strength invite without guessing malformed input', () => {
  const token = '10000000-1234-4567-89ab-123456789abc';
  for (const input of [
    token,
    token.toUpperCase(),
    token.replace(/-/g, ''),
    'https://example.test/v2/#invite=' + token,
    'https://example.test/v2/?invite=' + token,
  ])
    assert.equal(ctx.parseInvite(input), token);
  for (const input of ['123456', 'https://example.test/v2/', 'javascript:alert(1)', '', null])
    assert.equal(ctx.parseInvite(input), null);
});
test('journal merges same place/day without losing legacy reviews and filters each author', () => {
  const place = { id: 'p', legacy_id: 'old', name: '식당' },
    visits = [
      {
        id: 'v',
        visited_on: '2026-09-12',
        h_places: place,
        h_reviews: [{ id: 'new', author_id: 'min', score: 7.4 }],
      },
    ];
  const archive = {
    places: [{ id: 'old', name: '식당' }],
    authors: [{ reviewer: '하진', user_id: 'ha', accepted_at: 'yes' }],
    reviews: [
      { id: 'old-review', place_id: 'old', visited_on: '2026-09-12', reviewer: '하진', score: 8.8 },
      { id: 'older', place_id: 'old', visited_on: '2026-08-01', reviewer: '하진', score: 6.2 },
    ],
  };
  const all = ctx.buildJournalRows(visits, archive, [place]);
  assert.equal(all.length, 2);
  assert.equal(all[0].reviews.length, 2);
  assert.equal(all[0].visit.id, 'v');
  assert.equal(all[0].legacyPlace.id, 'old');
  const mine = ctx.buildJournalRows(visits, archive, [place], 'min');
  assert.equal(mine.length, 1);
  assert.equal(mine[0].reviews[0].id, 'new');
  const hers = ctx.buildJournalRows(visits, archive, [place], 'ha');
  assert.equal(hers.length, 2);
  assert.equal(hers[0].reviews.length, 1);
  assert.equal(hers[0].reviews[0].id, 'old-review');
});
test('journal waits for a complete cursor boundary day before mixing archive rows', () => {
  const p = { id: 'p' },
    visits = [
      { id: 'a', visited_on: '2026-10-05', h_places: p, h_reviews: [{ id: '1' }] },
      { id: 'b', visited_on: '2026-10-02', h_places: p, h_reviews: [{ id: '2' }] },
    ];
  const a = { places: [p], reviews: [{ id: 'old', place_id: 'p', visited_on: '2026-10-01' }] };
  assert.deepEqual(
    Array.from(ctx.buildJournalRows(visits, a, [p], '', 'next'), (r) => r.date),
    ['2026-10-05'],
  );
  assert.deepEqual(
    Array.from(ctx.buildJournalRows(visits, a, [p]), (r) => r.date),
    ['2026-10-05', '2026-10-02', '2026-10-01'],
  );
});
test('map clustering keeps every place once and separates distant places', () => {
  const points = [
    { place: { id: 'b' }, x: 10, y: 10 },
    { place: { id: 'a' }, x: 0, y: 0 },
    { place: { id: 'c' }, x: 300, y: 300 },
  ];
  const clusters = ctx.clusterPlaces(points, 42);
  assert.equal(clusters.length, 2);
  assert.equal(clusters[0].items.length, 2);
  assert.deepEqual(
    Array.from(clusters)
      .flatMap((c) => Array.from(c.items, (p) => p.id))
      .sort(),
    ['a', 'b', 'c'],
  );
});

test('legacy duplicate matching uses accepted account, exact place and visit date', () => {
  const places = [{ id: 'p', legacy_id: 'old', name: '식당', address: '서울' }],
    archive = {
      authors: [{ user_id: 'min', reviewer: '민혁', accepted_at: 'yes' }],
      reviews: [{ id: 'r', place_id: 'old', reviewer: '민혁', visited_on: '2026-10-01' }],
    };
  assert.equal(ctx.ownLegacyReview(archive, places, 'min', 'p', '2026-10-01').id, 'r');
  assert.equal(
    ctx.ownLegacyReview(archive, places, 'min', null, '2026-10-01', '식당', '서울').id,
    'r',
  );
  assert.equal(ctx.ownLegacyReview(archive, places, 'ha', 'p', '2026-10-01'), null);
  assert.equal(ctx.ownLegacyReview(archive, places, 'min', 'p', '2026-10-02'), null);
  archive.authors[0].accepted_at = null;
  assert.equal(ctx.ownLegacyReview(archive, places, 'min', 'p', '2026-10-01'), null);
});

test('wishlist eligibility includes all new review totals and linked legacy reviews', () => {
  assert.equal(ctx.placeHasReviews({ review_count: 1 }, null), true);
  assert.equal(ctx.placeHasReviews({ legacy_id: 'p' }, { reviews: [{ place_id: 'p' }] }), true);
  assert.equal(
    ctx.placeHasReviews({ review_count: 0, legacy_id: 'other' }, { reviews: [{ place_id: 'p' }] }),
    false,
  );
  assert.equal(ctx.placeHasReviews(undefined, null), false);
});
