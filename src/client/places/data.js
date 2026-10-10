async function loadPlaceDetails(id, more = false) {
  const target = groupId;
  const cursor = more ? placeVisits[id]?.next : null;
  const [v, m] = await Promise.all([
    api(
      `/groups/${target}/visits?place=${id}${cursor ? '&after=' + encodeURIComponent(cursor) : ''}`,
    ),
    api(`/groups/${target}/media?place=${id}`),
  ]);
  if (target !== groupId || selectedPlace !== id) return;
  const list = more ? [...placeVisits[id], ...v.items] : v.items;
  list.next = v.next;
  placeVisits[id] = list;
  mergeMedia(m.items);
  renderPlaceDetail(id);
  const button = document.createElement('button');
  if (v.next) {
    button.textContent = '평가 더보기';
    button.onclick = () => busy(button, () => loadPlaceDetails(id, true));
    $('#placeDetailReviews').append(button);
  }
  if (m.next) {
    const button = document.createElement('button');
    button.textContent = '사진 모두 보기';
    button.onclick = () => {
      $('#placeDialog').close();
      $('#galleryPlace').value = id;
      $('#galleryKind').value = 'all';
      setView('gallery');
      loadGallery().catch((e) => status(e.message));
    };
    $('#placeDetailPhotos').append(button);
  }
  observePhotos();
}
