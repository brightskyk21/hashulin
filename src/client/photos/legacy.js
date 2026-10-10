function placePhotos(id) {
  return (archive?.place_photos || [])
    .filter((p) => p.place_id === id)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

function photoStrip(place) {
  const photos = placePhotos(place?.id);
  if (!photos.length) return '';
  return `<aside class="place-photos" aria-label="${esc(place.name)} 사진"><div class="photo-label">사진 <span>${photos.length}장</span></div><div class="photo-thumbnails">${photos
    .slice(0, 1)
    .map(
      (p, i) =>
        `<button class="photo-thumb" data-photo-place="${place.id}" data-photo-index="${i}" aria-label="${esc(place.name)} 사진 ${i + 1} 크게 보기">${lazyPhoto(p.id, place.name + ' 사진 ' + (i + 1))}<span class="photo-fallback" hidden>불러오지 못했습니다</span>${photos.length > 1 ? `<span class="photo-more">1 / ${photos.length}</span>` : ''}</button>`,
    )
    .join('')}</div></aside>`;
}

function visitPhotoCover(place) {
  const photos = workspace.media
    .filter((p) => p.place_id === place.id && !p.deleted_at)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  if (!photos.length) return '';
  const p = photos[0];
  return `<aside class="place-photos" aria-label="${esc(place.name)} 사진"><div class="photo-label">사진 </div><div class="photo-thumbnails"><button class="photo-thumb" data-media="${p.id}" aria-label="${esc(place.name)} 사진 크게 보기">${lazyPhoto(p.id, place.name + ' 사진')}</button></div></aside>`;
}
