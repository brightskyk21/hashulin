function journalReviews(reviews, author = '', authors = null, legacyName = '') {
  return reviews.filter(
    (r) =>
      (!legacyName || r.reviewer === legacyName) &&
      (!author ||
        (authors
          ? authors.some((a) => a.reviewer === r.reviewer && a.accepted_at && a.user_id === author)
          : r.author_id === author)),
  );
}

function buildJournalRows(visits, archive, places, author = '', next = null) {
  const rows = new Map(),
    canonical = new Map(places.map((p) => [p.legacy_id || p.id, p]));
  const rowFor = (place, date) => {
    const key = place.id + ':' + (date || '');
    if (!rows.has(key))
      rows.set(key, { key, place, date, reviews: [], visit: null, legacyPlace: null });
    return rows.get(key);
  };
  for (const visit of visits) {
    const rs = journalReviews(visit.h_reviews, author);
    if (!rs.length) continue;
    const row = rowFor(
      places.find((p) => p.id === visit.h_places.id) || visit.h_places,
      visit.visited_on,
    );
    row.visit = visit;
    row.reviews.push(...rs);
  }
  for (const review of archive?.reviews || []) {
    const link = archive.authors?.find((a) => a.reviewer === review.reviewer && a.accepted_at),
      user = link?.user_id;
    if (author && author !== user) continue;
    const place = archive.places.find((p) => p.id === review.place_id);
    if (!place) continue;
    const row = rowFor(canonical.get(place.id) || place, review.visited_on);
    row.legacyPlace = place;
    row.reviews.push({ ...review, legacy: true, author_id: user || null });
  }
  // A later page can contain more visits on the boundary day. Do not show an incomplete day.
  const boundary = next && visits.length ? visits.at(-1).visited_on : null;
  return [...rows.values()]
    .filter((row) => !boundary || (row.date && row.date > boundary))
    .sort(
      (a, b) =>
        String(b.date || '').localeCompare(String(a.date || '')) || a.key.localeCompare(b.key),
    );
}

function ownLegacyReview(archive, places, user, placeId, date, name = '', address = '') {
  const place =
    places.find((p) => p.id === placeId) ||
    places.find((p) => p.name === name.trim() && p.address === address.trim());
  if (!place?.legacy_id) return null;
  const author = archive?.authors?.find((a) => a.user_id === user && a.accepted_at);
  return author
    ? (archive.reviews || []).find(
        (r) =>
          r.place_id === place.legacy_id && r.visited_on === date && r.reviewer === author.reviewer,
      ) || null
    : null;
}

function journalRows() {
  return sortJournalRows(
    buildJournalRows(visits, archive, workspace.places, filter, visitNext),
    journalSort,
  );
}

function journalAverage(row) {
  const scores = row.reviews
    .map((review) => Number(review.score))
    .filter((score) => Number.isFinite(score) && score >= 1 && score <= 10);
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
}

function sortJournalRows(rows, order = 'latest') {
  const latest = (a, b) =>
    String(b.date || '').localeCompare(String(a.date || '')) || a.key.localeCompare(b.key);
  return [...rows].sort((a, b) => {
    if (order === 'oldest') {
      if (!a.date || !b.date) return a.date ? -1 : b.date ? 1 : a.key.localeCompare(b.key);
      return a.date.localeCompare(b.date) || a.key.localeCompare(b.key);
    }
    if (order === 'highest' || order === 'lowest') {
      const left = journalAverage(a),
        right = journalAverage(b);
      if (left === null || right === null)
        return left === null ? (right === null ? latest(a, b) : 1) : -1;
      return (order === 'highest' ? right - left : left - right) || latest(a, b);
    }
    return latest(a, b);
  });
}
