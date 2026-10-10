function renderJournalDetail(key) {
  const row = journalRows().find((r) => r.key === key);
  if (!row) {
    $('#journalDialog').close();
    return;
  }
  selectedJournal = key;
  $('#journalDetailTitle').textContent = row.place.name;
  $('#journalDetailDate').textContent = [row.date, row.place.road_address || row.place.address]
    .filter(Boolean)
    .join(' · ');
  const old = ownLegacyReview(archive, workspace.places, session?.user.id, row.place.id, row.date);
  const mine =
    row.reviews.find((r) => r.author_id === session?.user.id) ||
    row.visit?.h_reviews.find((r) => r.author_id === session?.user.id) ||
    (old ? { ...old, legacy: true } : null);
  $('#journalDetailReviews').innerHTML = row.reviews
    .map(
      (r) =>
        `<div class="live-review"><header><strong>${esc(journalAuthor(r))}${r.author_id === session?.user.id ? ' · 나' : ''}</strong><span class="score-pill" style="color:${band(Number(r.score))[2]}">${Number(r.score).toFixed(1)}</span></header><p>${esc(r.comment || '')}</p></div>`,
    )
    .join('');
  $('#journalDetailPhotos').innerHTML = journalPhotoButton(row);
  observePhotos();
  $('#journalDetailActions').innerHTML =
    `${mine ? `<button class="primary" ${mine.legacy ? `data-legacy-review="${mine.id}"` : `data-review="${row.visit.id}"`}>내 리뷰 수정</button>` : row.date ? `<button class="primary" data-journal-review="${esc(key)}">내 리뷰 추가</button>` : ''}<button class="secondary-action" data-place="${row.place.id}">장소 보기</button>`;
}

function openJournal(key) {
  renderJournalDetail(key);
  showDialog('#journalDialog');
}

function initReviewsDetail() {
  $('#journalDialog').addEventListener('close', () => {
    selectedJournal = '';
  });

  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.journal) openJournal(b.dataset.journal);
    if (b.dataset.journalReview) {
      const row = journalRows().find((r) => r.key === b.dataset.journalReview);
      if (!row) return;
      $('#journalDialog').close();
      if (row.visit) compose(row.visit);
      else {
        composePlace(row.place.id);
        $('#reviewForm').elements.date.value = row.date;
      }
    }
    if (b.dataset.visitMedia) openVisitPhoto(b.dataset.visitMedia, b.dataset.visitId);
  });
}
