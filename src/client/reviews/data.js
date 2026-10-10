async function ensureJournalPage(request = journalRequest) {
  const target = groupId,
    author = filter,
    order = journalSort;
  while (visitNext && (order !== 'latest' || journalRows().length < journalLimit)) {
    const cursor = visitNext,
      result = await api(
        `/groups/${target}/visits?author=${author}&after=${encodeURIComponent(cursor)}`,
      );
    if (
      request !== journalRequest ||
      groupId !== target ||
      filter !== author ||
      journalSort !== order
    )
      return;
    visits = [...new Map([...visits, ...result.items].map((v) => [v.id, v])).values()];
    visitNext = result.next;
    if (visitNext === cursor) throw new Error('리뷰를 더 불러오지 못했습니다. 다시 시도해주세요.');
  }
}

let journalBusy = false,
  journalFailed = false,
  journalLoaded = false;

function journalHasMore() {
  return !!visitNext || journalRows().length > journalLimit;
}

function resetJournalPagination() {
  journalBusy = false;
  journalFailed = false;
  journalLoaded = false;
  updateJournalPagination();
}

function updateJournalPagination() {
  updateJournalSortControls();
  $('#journalLoadStatus').textContent = journalBusy
    ? '리뷰를 불러오는 중…'
    : journalFailed
      ? '리뷰를 불러오지 못했습니다.'
      : '';
  $('#moreVisits').hidden = !journalFailed;
  $('#records').setAttribute('aria-busy', String(journalBusy));
  journalObserver.unobserve($('#journalSentinel'));
  if (
    currentView === 'journal' &&
    groupId &&
    journalLoaded &&
    !journalBusy &&
    !journalFailed &&
    journalHasMore()
  )
    journalObserver.observe($('#journalSentinel'));
}

async function loadMoreReviews() {
  if (!groupId || !journalLoaded || journalBusy || !journalHasMore()) return;
  const request = journalRequest,
    target = groupId,
    author = filter,
    previousLimit = journalLimit;
  const isCurrent = () => request === journalRequest && target === groupId && author === filter;
  journalBusy = true;
  journalFailed = false;
  journalLimit += 24;
  updateJournalPagination();
  try {
    await ensureJournalPage(request);
    if (!isCurrent()) return;
    renderJournalFeed(true);
    observePhotos();
  } catch (error) {
    if (!isCurrent()) return;
    journalLimit = previousLimit;
    journalFailed = true;
  } finally {
    if (isCurrent()) {
      journalBusy = false;
      updateJournalPagination();
    }
  }
}

const journalObserver = new IntersectionObserver(
  (entries) => {
    if (
      currentView === 'journal' &&
      entries.some((entry) => entry.isIntersecting) &&
      !journalFailed
    )
      loadMoreReviews();
  },
  { rootMargin: '0px 0px 480px 0px' },
);

function initReviewsData() {
  $('#moreVisits').onclick = loadMoreReviews;
  $('#moreArchive').onclick = () => {
    archiveLimit += 24;
    renderArchive();
  };
}
