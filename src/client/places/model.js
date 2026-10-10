function placeHasReviews(place, archive) {
  return (
    Number(place?.review_count || 0) > 0 ||
    !!(place?.legacy_id && (archive?.reviews || []).some((r) => r.place_id === place.legacy_id))
  );
}

function allPlaceReviews(p) {
  const old = (archive?.reviews || [])
    .filter((r) => r.place_id === p.legacy_id)
    .map((r) => ({ ...r, label: r.reviewer, date: r.visited_on, legacy: true }));
  const fresh = (placeVisits[p.id] || visits)
    .filter((v) => v.h_places.id === p.id)
    .flatMap((v) =>
      v.h_reviews.map((r) => ({
        ...r,
        visit_id: v.id,
        date: v.visited_on,
        label: members.find((m) => m.user_id === r.author_id)?.h_profiles?.display_name || '멤버',
      })),
    );
  return [...old, ...fresh].sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || '')),
  );
}

function placeAverage(p) {
  const old = (archive?.reviews || []).filter((r) => r.place_id === p.legacy_id);
  const count = Number(p.review_count || 0) + old.length;
  return count
    ? Math.round(
        (Number(p.score_sum || 0) * 10 +
          old.reduce((s, r) => s + Math.round(Number(r.score) * 10), 0)) /
          count,
      ) / 10
    : null;
}
