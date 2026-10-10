let journalSort = 'latest';
const journalSortLabels = {
  latest: '최신순',
  oldest: '오래된순',
  highest: '평점 높은순',
  lowest: '평점 낮은순',
};

function setJournalSortMenu(open, restoreFocus = false) {
  $('#reviewSortMenu').hidden = !open;
  $('#reviewSortToggle').setAttribute('aria-expanded', String(open));
  if (open) $('#reviewSortMenu [aria-pressed="true"]').focus();
  else if (restoreFocus) $('#reviewSortToggle').focus();
}

function updateJournalSortControls() {
  const button = $('#reviewSortToggle');
  button.disabled = !journalLoaded || journalBusy;
  button.title = journalSortLabels[journalSort];
  button.setAttribute('aria-label', '정렬: ' + journalSortLabels[journalSort]);
  button.classList.toggle('is-sorted', journalSort !== 'latest');
  document.querySelectorAll('[data-journal-sort]').forEach((item) => {
    item.setAttribute('aria-pressed', String(item.dataset.journalSort === journalSort));
  });
}

async function changeJournalSort(order) {
  setJournalSortMenu(false, true);
  if (
    !Object.hasOwn(journalSortLabels, order) ||
    order === journalSort ||
    !journalLoaded ||
    journalBusy
  )
    return;
  const previous = journalSort,
    previousLimit = journalLimit,
    request = ++journalRequest;
  const target = groupId,
    author = filter;
  const isCurrent = () => request === journalRequest && target === groupId && author === filter;
  journalSort = order;
  journalLimit = 24;
  journalBusy = true;
  journalLoaded = false;
  journalFailed = false;
  updateJournalPagination();
  try {
    // Other sort orders need all review metadata to merge legacy/new visits correctly.
    // Image URLs and image bytes remain lazy loaded.
    await ensureJournalPage(request);
    if (!isCurrent()) return;
    journalLoaded = true;
    renderJournalFeed();
    observePhotos();
  } catch (_) {
    if (!isCurrent()) return;
    journalSort = previous;
    journalLimit = previousLimit;
    journalLoaded = true;
    renderJournalFeed();
    observePhotos();
    status('정렬을 변경하지 못했습니다. 다시 시도해주세요.');
  } finally {
    if (isCurrent()) {
      journalBusy = false;
      updateJournalPagination();
    }
  }
}

function initReviewsSort() {
  $('#reviewSortToggle').onclick = () => setJournalSortMenu($('#reviewSortMenu').hidden);
  $('#reviewSortMenu').onclick = (event) => {
    const button = event.target.closest('[data-journal-sort]');
    if (button) changeJournalSort(button.dataset.journalSort);
  };
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.review-sort')) setJournalSortMenu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('#reviewSortMenu').hidden) {
      event.preventDefault();
      setJournalSortMenu(false, true);
    }
  });
}
