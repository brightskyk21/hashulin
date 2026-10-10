function shownPlaces() {
  return workspace.places.filter(
    (p) => $('#mapStatus').value === 'all' || p.status === $('#mapStatus').value,
  );
}

async function ensureMap() {
  if (liveMap) return liveMap;
  if (!mapClientId) throw new Error('지도를 표시할 수 없습니다. 장소 목록을 이용해주세요.');
  if (!mapLoading)
    mapLoading = new Promise((resolve, reject) => {
      if (window.naver?.maps) return resolve();
      const script = document.createElement('script');
      script.src =
        'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=' + encodeURIComponent(mapClientId);
      const timeout = setTimeout(
        () => reject(new Error('지도를 불러오지 못했습니다. 다시 시도해주세요.')),
        15000,
      );
      script.onload = () => {
        clearTimeout(timeout);
        window.naver?.maps
          ? resolve()
          : reject(new Error('지도를 표시할 수 없습니다. 잠시 후 다시 시도해주세요.'));
      };
      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('지도를 불러오지 못했습니다.'));
      };
      document.head.append(script);
    });
  await mapLoading;
  $('#realMap').replaceChildren();
  liveMap = new naver.maps.Map('realMap', {
    center: new naver.maps.LatLng(37.5666, 126.9784),
    zoom: 11,
    zoomControl: false,
  });
  naver.maps.Event.addListener(liveMap, 'idle', refreshMapMarkers);
  return liveMap;
}

async function renderMap() {
  const target = groupId,
    version = ++mapRenderVersion,
    places = shownPlaces();
  $('#mapCount').textContent = places.length + '곳';
  $('#mapPlaceList').innerHTML = places.length
    ? places
        .map((p) => {
          const average = placeAverage(p);
          return `<button class="saved-place" data-place="${p.id}"><span><strong>${esc(p.name)}</strong>${p.category ? `<span class="place-category">${esc(p.category.split('>').pop().trim())}</span>` : ''}<small>${esc(p.road_address || p.address)}</small><small>${p.status === 'wish' ? '가고 싶은 곳' : '다녀온 곳'}${p.lat == null ? ' · 지도 위치 없음' : ''}</small></span><b class="map-score-value score-${mapScoreTone(average)}">${average == null ? '—' : average.toFixed(1)}</b></button>`;
        })
        .join('')
    : '<p class="note">저장된 장소가 없습니다. 검색해서 추가할 수 있습니다.</p>';
  if (currentView !== 'map') return;
  try {
    const map = await ensureMap();
    if (groupId !== target || currentView !== 'map' || version !== mapRenderVersion) return;
    map.setSize(new naver.maps.Size($('#realMap').clientWidth, $('#realMap').clientHeight));
    if (mapFittedGroup !== target && places.some((p) => p.lat != null)) {
      mapFittedGroup = target;
      fitMap();
    }
    refreshMapMarkers();
  } catch (e) {
    $('#realMap').textContent = e.message;
  }
}

function refreshMapMarkers() {
  if (!liveMap || currentView !== 'map') return;
  const projection = liveMap.getProjection(),
    zoom = liveMap.getZoom();
  const points = shownPlaces()
    .filter((p) => p.lat != null && p.lng != null)
    .map((place) => {
      const xy = projection.fromCoordToOffset(new naver.maps.LatLng(place.lat, place.lng));
      return { place, x: xy.x, y: xy.y };
    });
  mapClusters = clusterPlaces(points, zoom >= 14 ? 58 : 42);
  mapMarkers.forEach((m) => m.setMap(null));
  mapMarkers = [];
  mapClusters.forEach((cluster, index) => {
    const many = cluster.items.length > 1,
      p = cluster.items[0],
      avg = placeAverage(p),
      compact = zoom < 14;
    const position = many
      ? projection.fromOffsetToCoord(new naver.maps.Point(cluster.x, cluster.y))
      : new naver.maps.LatLng(p.lat, p.lng);
    const label = many
      ? `${cluster.items.length}곳 모아 보기`
      : p.name + (avg == null ? '' : `, ${avg.toFixed(1)}점`);
    const content = many
      ? `<button class="map-cluster" aria-label="${esc(label)}">${cluster.items.length}</button>`
      : `<button class="${compact ? 'map-dot' : 'map-score-pin'} score-${mapScoreTone(avg)}" aria-label="${esc(label)}">${compact ? '' : avg == null ? '♡' : `${band(avg)[0]} ${avg.toFixed(1)}`}</button>`;
    const marker = new naver.maps.Marker({
      map: liveMap,
      position,
      title: label,
      icon: {
        content,
        anchor: new naver.maps.Point(many ? 21 : compact ? 16 : 32, many ? 21 : compact ? 16 : 17),
      },
    });
    naver.maps.Event.addListener(marker, 'click', () =>
      many ? openMapCluster(index) : openPlace(p.id),
    );
    mapMarkers.push(marker);
  });
}

function openMapCluster(index) {
  const cluster = mapClusters[index];
  if (!cluster) return;
  const distinct = new Set(cluster.items.map((p) => p.lat + ':' + p.lng));
  if (liveMap.getZoom() >= 19 || distinct.size === 1) {
    $('#clusterPlaces').innerHTML = cluster.items
      .map(
        (p) =>
          `<button class="saved-place" data-place="${p.id}"><span><strong>${esc(p.name)}</strong><small>${esc(p.road_address || p.address)}</small></span></button>`,
      )
      .join('');
    showDialog('#mapClusterDialog');
    return;
  }
  liveMap.setCenter(
    liveMap.getProjection().fromOffsetToCoord(new naver.maps.Point(cluster.x, cluster.y)),
  );
  liveMap.setZoom(Math.min(19, liveMap.getZoom() + 2));
}

function fitMap() {
  if (!liveMap) return;
  const places = shownPlaces().filter((p) => p.lat != null && p.lng != null);
  if (!places.length) return;
  const bounds = new naver.maps.LatLngBounds();
  places.forEach((p) => bounds.extend(new naver.maps.LatLng(p.lat, p.lng)));
  liveMap.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
  if (places.length === 1) liveMap.setZoom(15);
}

function initMapMap() {
  $('#mapFit').onclick = fitMap;

  $('#mapStatus').onchange = renderMap;

  new ResizeObserver(() => {
    if (liveMap && currentView === 'map')
      liveMap.setSize(new naver.maps.Size($('#realMap').clientWidth, $('#realMap').clientHeight));
  }).observe($('#realMap'));

  $('#mapSearchForm').onsubmit = (e) => {
    e.preventDefault();
    const group = groupId,
      version = ++searchVersion;
    busy(e.submitter, async () => {
      const items = await api(
        '/search?group=' + group + '&query=' + encodeURIComponent($('#mapQuery').value.trim()),
      );
      if (group !== groupId || version !== searchVersion) return;
      searchItems = items;
      $('#mapSearchResults').innerHTML = items.length
        ? `<div class="search-results">${items
            .map(
              (p, i) =>
                `<article><strong>${esc(p.name)}</strong>${p.category ? `<span class="place-category">${esc(p.category.split('>').pop().trim())}</span>` : ''}<p class="note">${esc(p.roadAddress || p.address)}</p><div>${
                  placeHasReviews(
                    workspace.places.find(
                      (saved) => saved.name === p.name && saved.address === p.address,
                    ),
                    archive,
                  )
                    ? ''
                    : `<button data-save-search="${i}" data-state="wish">가고 싶은 곳에 저장</button>`
                }<button data-save-search="${i}" data-state="visited">다녀온 곳에 저장</button></div></article>`,
            )
            .join('')}</div>`
        : '<p class="note">검색 결과가 없습니다. 장소 이름과 지역을 함께 입력해주세요.</p>';
    });
  };
}
