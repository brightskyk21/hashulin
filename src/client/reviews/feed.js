function render() {
  renderGroups();
  $('#filters').innerHTML = members.length
    ? [{ user_id: '', h_profiles: { display_name: '모든 리뷰' } }, ...members]
        .map(
          (m) =>
            `<button class="filter-tab ${filter === m.user_id ? 'active' : ''}" data-filter="${m.user_id}">${esc(m.h_profiles?.display_name || '멤버')}${m.user_id ? '의 리뷰' : ''}</button>`,
        )
        .join('')
    : '';
  if (!groupId) {
    $('#records').innerHTML =
      '<div class="empty-state"><h2>참여 중인 모임이 없습니다</h2><button class="primary" data-manage>모임 선택</button></div>';
    return;
  }
  renderJournalFeed();
}

function journalAuthor(r) {
  return r.legacy
    ? r.reviewer
    : members.find((m) => m.user_id === r.author_id)?.h_profiles?.display_name || '멤버';
}

function renderJournalFeed(append = false) {
  const rows = journalRows();
  const next = rows.slice(0, journalLimit);
  // Appending preserves decoded images, expanded reviews and scroll position.
  const appendFrom =
    append && visibleJournal.every((row, index) => row.key === next[index]?.key)
      ? visibleJournal.length
      : 0;
  visibleJournal = next;
  const html = visibleJournal.length
    ? visibleJournal
        .slice(appendFrom)
        .map((row) => {
          const photo = journalPhotoButton(row);
          return `<article class="live-card archive-card journal-entry ${photo ? 'with-photos' : ''}"><div class="archive-content"><div class="date">${esc(row.date || '날짜 없음')}</div><button class="journal-open" data-journal="${esc(row.key)}"><h2>${esc(row.place.name)}</h2></button>${row.place.category ? `<p class="place-category">${esc(row.place.category.split('>').pop().trim())}</p>` : ''}${row.reviews.map((r) => `<div class="live-review"><header><strong>${esc(journalAuthor(r))}${r.author_id === session?.user.id ? ' · 나' : ''}</strong><span class="score-pill" style="color:${band(Number(r.score))[2]}">${Number(r.score).toFixed(1)}</span></header>${reviewCopy(r, 'feed')}</div>`).join('')}</div>${photo}${journalScoreBadge(row)}</article>`;
        })
        .join('')
    : `<div class="empty-state"><h2>${filter ? '작성한 리뷰가 없습니다' : '리뷰가 없습니다'}</h2><button class="primary" data-compose>리뷰 추가</button></div>`;
  if (appendFrom) $('#records').insertAdjacentHTML('beforeend', html);
  else $('#records').innerHTML = html;
  updateJournalPagination();
  $('#archiveSection').hidden = true;
  scheduleReviewClamps();
  if (selectedJournal && $('#journalDialog').open) renderJournalDetail(selectedJournal);
}
