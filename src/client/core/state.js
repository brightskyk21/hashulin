let client,
  session,
  profile,
  groups = [],
  members = [],
  visits = [],
  groupId = '',
  filter = '',
  editing = null,
  loadVersion = 0,
  archive = null,
  archiveAuthor = '',
  storageOrigin = '',
  photoGallery = [],
  photoIndex = 0;

let mapFittedGroup = '',
  mapClusters = [],
  mapRenderVersion = 0;

let workspace = { places: [], media: [], events: [] },
  workspaceGroup = '',
  currentView = 'journal',
  mapClientId = '',
  liveMap = null,
  mapMarkers = [],
  mapLoading = null,
  selectedPlace = null,
  searchItems = [],
  searchVersion = 0,
  calendarDate = today(),
  calendarMonth = today().slice(0, 7),
  editingEvent = null,
  cancelledEvents = false;

const viewNames = { journal: '리뷰', map: '지도', gallery: '사진', calendar: '일정' };

let visitNext = null,
  archiveLimit = 24,
  galleryIds = [],
  galleryNext = null,
  galleryLoaded = false,
  placeVisits = {},
  galleryRequest = 0,
  calendarRequest = 0;

let journalLimit = 24,
  journalRequest = 0,
  visibleJournal = [],
  selectedJournal = '';
