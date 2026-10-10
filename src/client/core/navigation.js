function setView(view) {
  currentView = view;
  for (const name of Object.keys(viewNames)) {
    $('#' + name + 'View').hidden = name !== view;
    const nav = $('#' + name + 'Nav');
    if (nav) nav.classList.toggle('active', name === view);
    const mobile = $(
      '#mobile' + (name === 'journal' ? 'Journal' : name[0].toUpperCase() + name.slice(1)),
    );
    if (mobile) mobile.classList.toggle('active', name === view);
  }
  document.title = '하슐랭 · ' + viewNames[view];
  if (view === 'map') renderMap();
  if (view === 'journal') scheduleReviewClamps();
  if (view === 'gallery' && !galleryLoaded) loadGallery().catch((e) => status(e.message));
  if (view === 'calendar') loadCalendar().catch((e) => status(e.message));
  observePhotos();
}

function initCoreNavigationControls() {
  for (const id of ['journalNav', 'mobileJournal'])
    $('#' + id).onclick = () => loadVisits().catch((e) => status(e.message));

  $('#compose').onclick = () => compose();
}

function initCoreNavigationActions() {
  for (const name of ['map', 'gallery', 'calendar'])
    for (const prefix of ['', 'mobile']) {
      const id = prefix ? prefix + name[0].toUpperCase() + name.slice(1) : name + 'Nav';
      $('#' + id).onclick = () => setView(name);
    }

  for (const id of ['journalNav', 'mobileJournal']) $('#' + id).onclick = () => setView('journal');
}
