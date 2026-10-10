function galleryPhotos() {
  return galleryIds.map((id) => workspace.media.find((p) => p.id === id)).filter(Boolean);
}

function renderGallery(append = false) {
  const media = galleryPhotos();
  $('#galleryCount').textContent = galleryLoaded && !galleryNext ? media.length + '장' : '';
  $('#galleryNotice').textContent =
    $('#galleryKind').value === 'trash' ? '올린 사람이나 모임장이 사진을 복원할 수 있습니다.' : '';
  const existing = append
    ? new Set([...$('#galleryGrid').querySelectorAll('[data-media]')].map((b) => b.dataset.media))
    : new Set();
  const html = media.length
    ? media
        .filter((p) => !existing.has(p.id))
        .map(
          (p) =>
            `<button class="gallery-tile" data-media="${p.id}" aria-label="${esc(p.caption || workspace.places.find((x) => x.id === p.place_id)?.name || '모임 사진')} 크게 보기">${lazyPhoto(p.id, p.caption || '모임 사진')}${workspace.places.find((x) => x.id === p.place_id)?.name || p.caption ? `<span>${esc(workspace.places.find((x) => x.id === p.place_id)?.name || p.caption)}</span>` : ''}</button>`,
        )
        .join('')
    : galleryLoaded
      ? '<div class="empty-state"><p>사진이 없습니다.</p></div>'
      : '';
  if (append) $('#galleryGrid').insertAdjacentHTML('beforeend', html);
  else $('#galleryGrid').innerHTML = html;
}

function initPhotosGallery() {
  $('#galleryKind').onchange = () => loadGallery().catch((e) => status(e.message));

  $('#galleryPlace').onchange = () => loadGallery().catch((e) => status(e.message));
}
