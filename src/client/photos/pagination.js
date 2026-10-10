let galleryBusy = false,
  galleryFailed = false;

function updateGalleryPagination() {
  $('#galleryLoadStatus').textContent = galleryBusy
    ? '사진을 불러오는 중…'
    : galleryFailed
      ? '사진을 불러오지 못했습니다.'
      : '';
  $('#moreGallery').hidden = !galleryFailed;
  $('#galleryGrid').setAttribute('aria-busy', String(galleryBusy));
  galleryObserver.unobserve($('#gallerySentinel'));
  if (!galleryBusy && !galleryFailed && galleryLoaded && galleryNext)
    galleryObserver.observe($('#gallerySentinel'));
}

async function loadGallery(more = false) {
  if (!groupId || (more && (galleryBusy || !galleryLoaded || !galleryNext))) return;
  const target = groupId,
    version = ++galleryRequest;
  const query = new URLSearchParams({
    kind: $('#galleryKind').value,
    place: $('#galleryPlace').value,
  });
  if (more) query.set('after', galleryNext);
  galleryBusy = true;
  galleryFailed = false;
  if (!more) {
    galleryIds = [];
    galleryNext = null;
    galleryLoaded = false;
    renderGallery();
  }
  updateGalleryPagination();
  try {
    const result = await api(`/groups/${target}/media?${query}`);
    if (groupId !== target || version !== galleryRequest) return;
    mergeMedia(result.items);
    galleryIds = more
      ? [...new Set([...galleryIds, ...result.items.map((p) => p.id)])]
      : result.items.map((p) => p.id);
    galleryNext = result.next;
    galleryLoaded = true;
    renderGallery(more);
    observePhotos();
  } catch (error) {
    if (groupId === target && version === galleryRequest) galleryFailed = true;
    throw error;
  } finally {
    if (groupId === target && version === galleryRequest) {
      galleryBusy = false;
      updateGalleryPagination();
    }
  }
}

const galleryObserver = new IntersectionObserver(
  (entries) => {
    if (currentView === 'gallery' && entries.some((e) => e.isIntersecting) && !galleryFailed)
      loadGallery(true).catch((e) => status(e.message));
  },
  { rootMargin: '0px 0px 400px 0px' },
);

function initPhotosPagination() {
  $('#moreGallery').onclick = () =>
    busy($('#moreGallery'), () => loadGallery(galleryLoaded && !!galleryNext));
}
