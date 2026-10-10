async function ensureJournalPage(request = journalRequest) {
  const target = groupId,
    author = filter;
  while (visitNext && journalRows().length < journalLimit) {
    const cursor = visitNext,
      result = await api(
        `/groups/${target}/visits?author=${author}&after=${encodeURIComponent(cursor)}`,
      );
    if (request !== journalRequest || groupId !== target || filter !== author) return;
    visits = [...new Map([...visits, ...result.items].map((v) => [v.id, v])).values()];
    visitNext = result.next;
    if (visitNext === cursor) throw new Error('리뷰을 더 불러오지 못했습니다. 다시 시도해주세요.');
  }
}

function initReviewsData() {
  $('#moreVisits').onclick = () =>
    busy($('#moreVisits'), async () => {
      journalLimit += 24;
      await ensureJournalPage();
      render();
    });

  $('#moreArchive').onclick = () => {
    archiveLimit += 24;
    renderArchive();
  };
}
