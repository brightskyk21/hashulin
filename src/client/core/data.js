async function loadVisits() {
  const version = ++loadVersion;
  journalLimit = 24;
  const id = groupId;
  visits = [];
  members = [];
  archive = null;
  resetWorkspace();
  const request = ++journalRequest;
  $('#archiveSection').hidden = true;
  if (!id) {
    render();
    renderWorkspace();
    return;
  }
  $('#records').textContent = '리뷰를 불러오는 중입니다.';
  try {
    const [m, v, a, w] = await Promise.all([
      api(`/groups/${id}/members`),
      api(`/groups/${id}/visits`),
      api(`/groups/${id}/archive`),
      api(`/groups/${id}/content`),
    ]);
    if (version !== loadVersion || id !== groupId) return;
    members = m;
    visits = v.items;
    visitNext = v.next;
    archive = a;
    workspace = w;
    await ensureJournalPage(request);
    if (version !== loadVersion || id !== groupId) return;
    galleryIds = [];
    galleryNext = null;
    galleryLoaded = false;
    render();
    renderArchive();
    renderWorkspace();
    if (currentView === 'gallery') await loadGallery();
    if (currentView === 'calendar') await loadCalendar();
  } catch (e) {
    if (version !== loadVersion) return;
    $('#records').innerHTML =
      '<div class="empty-state"><p>리뷰를 불러오지 못했습니다.</p><button class="primary" data-retry>다시 시도</button></div>';
    throw e;
  }
}

async function refreshPlaces() {
  const target = groupId;
  const w = await api(`/groups/${target}/content`);
  if (target !== groupId) return;
  workspace.places = w.places;
  mergeMedia(w.media);
  renderWorkspace();
  render();
  renderArchive();
  observePhotos();
}

async function refreshJournal(legacy = false) {
  const target = groupId,
    author = filter,
    request = ++journalRequest;
  const [v, a] = await Promise.all([
    api(`/groups/${target}/visits?author=${author}`),
    legacy ? api(`/groups/${target}/archive`) : Promise.resolve(archive),
  ]);
  if (target !== groupId || request !== journalRequest) return;
  visits = v.items;
  visitNext = v.next;
  archive = a;
  placeVisits = {};
  await ensureJournalPage(request);
  if (request !== journalRequest) return;
  await refreshPlaces();
}

async function refreshPhotos() {
  imageCache.clear();
  const target = groupId;
  await refreshJournal();
  if (target !== groupId) return;
  await loadGallery();
  if (selectedPlace) await loadPlaceDetails(selectedPlace);
}
