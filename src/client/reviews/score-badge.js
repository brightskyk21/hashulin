function journalScoreBadge(row) {
  const scores = row.reviews
    .map((r) => Number(r.score))
    .filter((s) => Number.isFinite(s) && s >= 1 && s <= 10);
  if (!scores.length) return '';
  const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const [emoji, mood, ink] = band(average),
    image = journalEmojiImage(emoji);
  const label = `${filter ? '내 점수' : '평균'} ${Number(average.toFixed(2))} · 리뷰 ${scores.length}개`;
  return `<div class="journal-score-footer"><details class="journal-score"><summary aria-label="${label} · ${mood}" style="--badge-ink:${ink}"><span class="journal-score-disc" aria-hidden="true">${image ? `<img class="journal-score-emoji" src="${image}" width="18" height="18" alt="">` : `<span class="journal-score-emoji">${emoji}</span>`}</span></summary><span class="journal-score-info">${label}</span></details></div>`;
}
