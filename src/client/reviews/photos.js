function journalPhoto(row) {
  const cover = row.visit?.cover;
  if (cover && !workspace.media.find((m) => m.id === cover.id)?.deleted_at)
    return { id: cover.id, visit: row.visit.id };
  // Photos without a visit remain attached to the place, including all legacy photos.
  const old = row.legacyPlace ? placePhotos(row.legacyPlace.id) : [];
  return old.length ? { id: old[0].id, legacyPlace: row.legacyPlace.id, count: old.length } : null;
}

function journalPhotoButton(row) {
  const photo = journalPhoto(row);
  if (!photo) return '';
  return `<aside class="place-photos"><button class="photo-thumb" ${photo.legacyPlace ? `data-photo-place="${photo.legacyPlace}" data-photo-index="0"` : `data-visit-media="${photo.id}" data-visit-id="${photo.visit}"`} aria-label="${esc(row.place.name)} 사진 보기">${lazyPhoto(photo.id, row.place.name + ' 사진')}</button></aside>`;
}

async function openVisitPhoto(id, visitId) {
  try {
    const target = groupId,
      items = [],
      seen = new Set();
    let cursor = null;
    do {
      const result = await api(
        `/groups/${target}/media?visit=${visitId}${cursor ? '&after=' + encodeURIComponent(cursor) : ''}`,
      );
      if (target !== groupId) return;
      items.push(...result.items);
      cursor = result.next;
      if (cursor && seen.has(cursor))
        throw new Error('사진을 더 불러오지 못했습니다. 다시 시도해주세요.');
      seen.add(cursor);
    } while (cursor);
    mergeMedia(items);
    photoGallery = [...new Map(items.map((p) => [p.id, p])).values()].reverse();
    photoIndex = Math.max(
      0,
      photoGallery.findIndex((p) => p.id === id),
    );
    if (!photoGallery.length) return;
    $('#photoTitle').textContent =
      workspace.places.find((p) => p.id === photoGallery[photoIndex].place_id)?.name || '방문 사진';
    showPhoto();
    showDialog('#photoDialog');
  } catch (e) {
    status(e.message);
  }
}
