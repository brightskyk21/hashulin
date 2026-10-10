function initReviewsGuardsControls() {
  $('#reviewDialog').addEventListener('cancel', (e) => {
    if (reviewSaving) {
      e.preventDefault();
      return;
    }
    if (reviewDirty() && !confirm('작성 중인 내용을 닫을까요? 저장하지 않은 내용은 사라집니다.'))
      e.preventDefault();
  });

  window.addEventListener('beforeunload', (e) => {
    if ($('#reviewDialog').open && reviewDirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

function initReviewsGuardsActions() {
  $('#reloadReview').onclick = () =>
    busy($('#reloadReview'), async () => {
      if (
        !confirm('작성 중인 내용을 최신 저장 내용으로 바꿀까요? 필요한 내용은 먼저 복사해주세요.')
      )
        return;
      const previous = editing,
        f = $('#reviewForm'),
        name = f.elements.placeName.value.trim(),
        address = f.elements.address.value.trim(),
        date = f.elements.date.value,
        place = f.dataset.placeId;
      await loadVisits();
      let fresh;
      if (previous?.legacy) {
        const r = archive?.reviews.find((r) => r.id === previous.id);
        if (r)
          fresh = {
            id: r.id,
            legacy: r,
            h_places: archive.places.find((p) => p.id === r.place_id) || { name: '이전 리뷰' },
            visited_on: r.visited_on,
            h_reviews: [{ ...r, author_id: session.user.id }],
          };
      } else if (previous) fresh = await api('/visits/' + previous.id);
      else {
        const query = new URLSearchParams({
          day: date,
          ...(place ? { place } : { name, address }),
        });
        const result = await api(`/groups/${groupId}/visits?${query}`);
        fresh = result.items[0];
      }
      if (!fresh) throw new Error('최신 리뷰를 찾지 못했습니다. 작성 내용은 유지됩니다.');
      $('#reviewDialog').close();
      compose(fresh);
      status('최신 리뷰를 불러왔습니다.');
    });
}
