function resetWorkspace() {
  if (workspaceGroup !== groupId) {
    mapFittedGroup = '';
    ++journalRequest;
    journalLimit = 24;
    placeVisits = {};
    imageCache.clear();
    galleryIds = [];
    galleryLoaded = false;
    galleryNext = null;
    visitNext = null;
    archiveLimit = 24;
    ++galleryRequest;
    ++calendarRequest;
    $('#galleryPlace').value = '';
    $('#galleryKind').value = 'all';
    $('#mapStatus').value = 'all';
    for (const id of [
      'placeDialog',
      'photoDialog',
      'eventDialog',
      'uploadDialog',
      'journalDialog',
      'mapClusterDialog',
    ])
      if ($('#' + id).open) $('#' + id).close();
    selectedPlace = null;
  }
  workspaceGroup = groupId;
  workspace = { places: [], media: [], events: [] };
  ++searchVersion;
  searchItems = [];
  $('#mapSearchResults').replaceChildren();
  mapMarkers.forEach((m) => m.setMap(null));
  mapMarkers = [];
  $('#galleryGrid').textContent = groupId ? '사진을 불러오는 중입니다.' : '모임을 선택해주세요.';
  $('#mapPlaceList').replaceChildren();
  $('#dayEvents').replaceChildren();
  $('#upcomingEvents').replaceChildren();
  $('#monthGrid').replaceChildren();
}

function renderWorkspace() {
  for (const id of ['galleryPlace', 'uploadPlace']) {
    const input = $('#' + id),
      value = input.value;
    input.innerHTML =
      `<option value="">${id === 'galleryPlace' ? '모든 장소' : '장소 없이 올리기'}</option>` +
      workspace.places.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    input.value = workspace.places.some((p) => p.id === value) ? value : '';
  }
  $('#uploadPhotos').disabled = !groupId;
  $('#addEvent').disabled = !groupId;
  $('#mapSearchForm button').disabled = !groupId;
  renderGallery();
  renderCalendar();
  if (currentView === 'map') renderMap();
  if (selectedPlace && $('#placeDialog').open) renderPlaceDetail(selectedPlace);
}
