function showPhoto() {
  const p = photoGallery[photoIndex];
  if (!p) return;
  const src = safePhotoUrl(p.url);
  $('#photoError').textContent = '사진을 불러오는 중입니다.';
  $('#photoError').hidden = !!src;
  $('#photoLarge').hidden = !src;
  $('#photoLarge').alt = $('#photoTitle').textContent + ' ' + (photoIndex + 1);
  if (src) $('#photoLarge').src = src;
  else $('#photoLarge').removeAttribute('src');
  $('#photoPosition').textContent = `${photoIndex + 1} / ${photoGallery.length}`;
  updatePhotoTools(p);
  refreshViewerPhoto(p);
  $('#photoPrevious').disabled = photoIndex === 0;
  $('#photoNext').disabled = photoIndex === photoGallery.length - 1;
}

function movePhoto(direction) {
  const next = photoIndex + direction;
  if (next < 0 || next >= photoGallery.length) return;
  photoIndex = next;
  showPhoto();
}

async function openMedia(id) {
  let m = workspace.media.find((p) => p.id === id);
  if (!m) {
    try {
      const result = await api('/photos/' + id + '/url?size=thumb');
      m = result.media;
      mergeMedia([m]);
    } catch (e) {
      status(e.message);
      return;
    }
  }
  const list =
    currentView === 'gallery'
      ? galleryPhotos()
      : workspace.media
          .filter((p) => p.place_id === m.place_id && !p.deleted_at)
          .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  photoGallery = list;
  photoIndex = list.findIndex((p) => p.id === id);
  if (photoIndex < 0) {
    photoGallery = [m];
    photoIndex = 0;
  }
  $('#photoTitle').textContent =
    workspace.places.find((p) => p.id === m.place_id)?.name || '모임 사진';
  showPhoto();
  showDialog('#photoDialog');
}

function updatePhotoTools(photo) {
  const p = workspace.media.find((m) => m.id === photo.id);
  const canEdit =
    p &&
    (p.uploaded_by === session?.user.id ||
      groups.find((g) => g.id === groupId)?.owner_id === session?.user.id);
  const title = workspace.places.find((x) => x.id === p?.place_id)?.name || '모임 사진';
  $('#photoTitle').textContent = title;
  $('#photoLarge').alt = p?.caption || title;
  $('#photoMetaForm').hidden = !canEdit;
  $('#photoCaptionText').textContent = p?.caption || '';
  $('#photoCaptionInput').value = p?.caption || '';
  $('#photoTrash').textContent = p?.deleted_at ? '사진 복원' : '휴지통으로';
}

async function refreshViewerPhoto(photo) {
  try {
    const result = await api('/photos/' + photo.id + '/url');
    if (!$('#photoDialog').open || photoGallery[photoIndex]?.id !== photo.id) return;
    photo.url = result.url;
    mergeMedia([result.media]);
    updatePhotoTools(photo);
    $('#photoLarge').hidden = false;
    $('#photoError').hidden = true;
    $('#photoLarge').src = safePhotoUrl(result.url);
  } catch (_) {
    if ($('#photoDialog').open && photoGallery[photoIndex]?.id === photo.id) {
      $('#photoError').hidden = false;
      $('#photoError').textContent = '사진을 불러오지 못했습니다. 닫고 다시 열어주세요.';
    }
  }
}

async function savePhotoMetadata(button, deleted) {
  const p = workspace.media.find((m) => m.id === photoGallery[photoIndex]?.id);
  if (!p) return;
  await busy(button, async () => {
    await api('/photos/' + p.id, {
      method: 'PUT',
      body: JSON.stringify({
        caption: $('#photoCaptionInput').value.trim(),
        deleted,
        version: p.version,
      }),
    });
    p.deleted_at = deleted ? new Date().toISOString() : null;
    p.caption = $('#photoCaptionInput').value.trim();
    p.version++;
    if (archive && p.legacy_kind) {
      const key = p.legacy_kind === 'place' ? 'place_photos' : 'couple_photos';
      archive[key] = archive[key].filter((x) => x.id !== p.id);
      if (!deleted) archive[key].push({ ...p });
    }
    $('#photoDialog').close();
    await refreshPhotos();
    status(
      deleted
        ? '휴지통으로 옮겼습니다. 갤러리 휴지통에서 복원할 수 있어요.'
        : '사진을 저장했습니다.',
    );
  });
}

function initPhotosViewerControls() {
  $('#photoPrevious').onclick = () => movePhoto(-1);
}

function initPhotosViewerActions() {
  $('#photoDialog').addEventListener('keydown', (e) => {
    if (
      !e.target.matches('input,textarea,select') &&
      (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
    ) {
      e.preventDefault();
      movePhoto(e.key === 'ArrowLeft' ? -1 : 1);
    }
  });

  $('#photoDialog').addEventListener('close', () => {
    photoGallery = [];
    $('#photoLarge').removeAttribute('src');
  });

  $('#photoLarge').onerror = () => {
    $('#photoError').textContent = '사진을 불러오지 못했습니다.';
    $('#photoError').hidden = false;
    $('#photoLarge').hidden = true;
  };
}

function initPhotosViewerNavigation() {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.acceptAuthor)
      busy(b, async () => {
        await api(`/groups/${groupId}/legacy-authors/accept`, {
          method: 'POST',
          body: JSON.stringify({ reviewer: b.dataset.acceptAuthor }),
        });
        await loadVisits();
        $('#legacyAuthors details').open = true;
        status('이전 리뷰를 연결했습니다. 이제 내 리뷰를 수정할 수 있어요.');
      });
    if (b.dataset.legacyReview) {
      const r = archive.reviews.find((r) => r.id === b.dataset.legacyReview);
      if (r)
        compose({
          id: r.id,
          legacy: r,
          h_places: archive.places.find((p) => p.id === r.place_id) || { name: '이전 리뷰' },
          visited_on: r.visited_on,
          h_reviews: [{ ...r, author_id: session.user.id }],
        });
    }
    if (b.dataset.photoPlace) {
      photoGallery = placePhotos(b.dataset.photoPlace);
      photoIndex = Number(b.dataset.photoIndex);
      $('#photoTitle').textContent =
        (archive.places.find((p) => p.id === b.dataset.photoPlace)?.name || '장소') + ' · 사진';
      showPhoto();
      showDialog('#photoDialog');
    }
  });
}

function initPhotosViewerLifecycle() {
  $('#photoMetaForm').onsubmit = (e) => {
    e.preventDefault();
    const p = workspace.media.find((m) => m.id === photoGallery[photoIndex]?.id);
    savePhotoMetadata(e.submitter, !!p?.deleted_at);
  };

  $('#photoTrash').onclick = () => {
    const p = workspace.media.find((m) => m.id === photoGallery[photoIndex]?.id);
    savePhotoMetadata($('#photoTrash'), !p?.deleted_at);
  };
}
