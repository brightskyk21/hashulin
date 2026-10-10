const imageCache = new Map(),
  imageRequests = new Map(),
  thumbnailQueues = new Map();

function lazyPhoto(id, alt) {
  return `<img data-lazy-photo="${id}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
}

const photoObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries)
      if (entry.isIntersecting) {
        photoObserver.unobserve(entry.target);
        loadThumbnail(entry.target);
      }
  },
  { rootMargin: '120px' },
);

function observePhotos() {
  document.querySelectorAll('img[data-lazy-photo]').forEach((img) => {
    if (!img.getAttribute('src')) photoObserver.observe(img);
  });
}

async function loadThumbnail(img) {
  const id = img.dataset.lazyPhoto,
    scope = groupId,
    user = session?.user.id,
    key = user + ':' + scope + ':' + id;
  if (!scope || !user) return;
  try {
    let result = imageCache.get(key);
    if (!result || result.expiresAt < Date.now() + 30000) {
      let request = imageRequests.get(key);
      if (!request) {
        request = queueThumbnail(scope, user, id);
        imageRequests.set(key, request);
      }
      try {
        result = await request;
        imageCache.set(key, result);
      } finally {
        imageRequests.delete(key);
      }
    }
    if (groupId !== scope || session?.user.id !== user || !img.isConnected) return;
    const url = safePhotoUrl(result.url);
    if (url) {
      img.onload = () => img.classList.toggle('landscape', img.naturalWidth >= img.naturalHeight);
      img.src = url;
      img.hidden = false;
    }
  } catch (_) {
    img.alt = '사진을 불러오지 못했습니다';
  }
}

function queueThumbnail(scope, user, id) {
  const key = user + ':' + scope;
  let queue = thumbnailQueues.get(key);
  if (!queue) {
    queue = [];
    thumbnailQueues.set(key, queue);
    setTimeout(async () => {
      thumbnailQueues.delete(key);
      for (let offset = 0; offset < queue.length; offset += 48) {
        const batch = queue.slice(offset, offset + 48);
        try {
          if (groupId !== scope || session?.user.id !== user) throw new Error('Changed session');
          const results = await api(`/groups/${scope}/photo-urls`, {
            method: 'POST',
            body: JSON.stringify({ ids: batch.map((x) => x.id) }),
          });
          for (const item of batch) {
            const result = results.find((r) => r.id === item.id);
            result?.url ? item.resolve(result) : item.reject(new Error('Unavailable photo'));
          }
        } catch (e) {
          batch.forEach((x) => x.reject(e));
        }
      }
    }, 25);
  }
  return new Promise((resolve, reject) => queue.push({ id, resolve, reject }));
}

function initPhotosThumbnails() {
  setInterval(() => {
    if (document.hidden || !session) return;
    for (const img of document.querySelectorAll('img[data-lazy-photo]')) {
      const r = img.getBoundingClientRect();
      if (r.width && r.height && r.bottom >= 0 && r.top <= innerHeight) {
        const key = session.user.id + ':' + groupId + ':' + img.dataset.lazyPhoto;
        if ((imageCache.get(key)?.expiresAt || 0) < Date.now() + 30000) loadThumbnail(img);
      }
    }
  }, 60000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) observePhotos();
  });
}
