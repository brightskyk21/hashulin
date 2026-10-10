function openPlace(id) {
  $('#journalDialog').close();
  $('#mapClusterDialog').close();
  selectedPlace = id;
  renderPlaceDetail(id);
  showDialog('#placeDialog');
  loadPlaceDetails(id).catch((e) => status(e.message));
  scheduleReviewClamps();
}

function renderPlaceDetail(id) {
  const p = workspace.places.find((p) => p.id === id);
  if (!p) return;
  const reviews = allPlaceReviews(p),
    avg = placeAverage(p);
  $('#placeDetailTitle').textContent = p.name;
  $('#placeDetailCategory').textContent = (p.category || '').split('>').join(' · ');
  $('#placeDetailCategory').hidden = !p.category;
  $('#placeDetailAddress').textContent = p.road_address || p.address;
  $('#placeDetailActions').innerHTML =
    `<span class="detail-average">${avg == null ? '리뷰 없음' : avg.toFixed(1) + '점 · 리뷰 ' + (Number(p.review_count || 0) + (archive?.reviews || []).filter((r) => r.place_id === p.legacy_id).length) + '개'}</span><div class="place-action-row"><button class="primary" data-place-review="${id}">리뷰 추가</button>${p.status === 'wish' && !placeHasReviews(p, archive) ? `<button class="secondary-action place-icon-action" data-place-status="${id}" data-state="visited" aria-label="다녀온 곳으로 변경" title="다녀온 곳으로 변경"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button>` : ''}<button class="secondary-action place-icon-action" data-place-upload="${id}" aria-label="사진 올리기" title="사진 올리기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></button></div>`;
  $('#placeDetailPhotos').innerHTML = workspace.media
    .filter((m) => !m.deleted_at && m.place_id === id)
    .map(
      (m) =>
        `<button data-media="${m.id}" aria-label="${esc(p.name)} 사진 크게 보기">${lazyPhoto(m.id, m.caption || p.name)}</button>`,
    )
    .join('');
  $('#placeDetailReviews').innerHTML = reviews.length
    ? reviews
        .map((r) => {
          const b = band(Number(r.score));
          return `<div class="live-review"><header><strong>${esc(r.label)}</strong><span class="score-pill" style="color:${b[2]}">${Number(r.score).toFixed(1)}</span></header><div class="date">${esc(r.date || '')}</div>${reviewCopy(r, 'detail')}</div>`;
        })
        .join('')
    : '<p class="note">등록된 리뷰가 없습니다.</p>';
  scheduleReviewClamps();
}

function composePlace(id) {
  const p = workspace.places.find((p) => p.id === id);
  if (!p) return;
  $('#placeDialog').close();
  compose();
  const f = $('#reviewForm');
  f.dataset.placeId = id;
  f.elements.placeName.value = p.name;
  f.elements.address.value = p.address;
  f.elements.placeName.readOnly = true;
  f.elements.address.readOnly = true;
}
