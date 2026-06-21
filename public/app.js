// ── 상태 ───────────────────────────────────────────────────────
let map;
let markers = {};            // place.id -> naver.maps.Marker
let highlightMarker = null;  // 검색/선택 위치를 가리키는 핀
const ME = localStorage.getItem('whoami') || '';   // 홈에서 선택한 신원
const meChip = document.getElementById('meChip');
if (meChip) meChip.textContent = ME || '이름 선택 →';

// ── 점수 → 색 (개별 평가 배지용, 연속 색) ──────────────────────
function scoreColor(score) {
  if (!score) return '#9ca3af';                  // 평가 없음: 회색
  const hue = ((score - 1) / 9) * 120;           // 0(red) ~ 120(green)
  return `hsl(${hue}, 70%, 45%)`;
}

// ── 점수 구간 → 이모지 + 배경/글자색 (지도 마커용) ─────────────
//    1~2 다신X / 3~4 맛없음 / 5 쏘쏘 / 6~7 무난 / 8~10 개맛
function scoreBand(score) {
  const s = Number(score);
  if (!s)      return { emoji: '',   bg: '#9ca3af', fg: '#fff' };      // 평가 없음
  if (s < 3)   return { emoji: '🤢', bg: '#e23b3b', fg: '#fff' };      // 1~2 빨강
  if (s < 5)   return { emoji: '😣', bg: '#f5811f', fg: '#fff' };      // 3~4 주황
  if (s < 6)   return { emoji: '😐', bg: '#f2c200', fg: '#5b4a00' };   // 5  노랑(진한 글자)
  if (s < 8)   return { emoji: '😋', bg: '#7cc02f', fg: '#fff' };      // 6~7 연두
  return        { emoji: '⭐', bg: '#1f9d57', fg: '#fff' };            // 8~10 초록
}

// ── 위치 강조 핀 (검색/선택 시 통통 튀는 마커) ─────────────────
function highlight(lat, lng) {
  if (!map || lat == null || lng == null) return;
  const pos = new naver.maps.LatLng(lat, lng);
  if (highlightMarker) highlightMarker.setMap(null);
  highlightMarker = new naver.maps.Marker({
    position: pos,
    map,
    zIndex: 1000,
    icon: {
      content: '<div class="pin-drop"><div class="pin"></div><div class="pin-pulse"></div></div>',
      anchor: new naver.maps.Point(13, 34),
    },
  });
  map.panTo(pos);
}

// ── 지도 동적 로드 (Client ID는 서버에서 받아옴) ───────────────
async function initMap() {
  const cfg = await fetch('/api/config').then((r) => r.json());
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${cfg.naverMapClientId}`;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

  map = new naver.maps.Map('map', {
    center: new naver.maps.LatLng(37.5666, 126.9784), // 서울시청
    zoom: 12,
  });

  loadPlaces();
}

// ── 검색 ──────────────────────────────────────────────────────
document.getElementById('searchBtn').addEventListener('click', doSearch);
document.getElementById('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch();
});

async function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return;
  const box = document.getElementById('searchResults');
  box.innerHTML = '검색 중…';
  const items = await fetch(`/api/search?query=${encodeURIComponent(q)}`).then((r) => r.json());
  if (!Array.isArray(items) || items.length === 0) {
    box.innerHTML = '<div class="card">결과 없음</div>';
    return;
  }
  box.innerHTML = '';
  items.forEach((it) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <div class="name">${it.name}</div>
      <div class="cat">${it.category || ''}</div>
      <div class="addr">${it.roadAddress || it.address || ''}</div>
      <div class="row" style="margin-top:6px">
        <span></span>
        <button>＋ 저장</button>
      </div>`;
    el.querySelector('button').addEventListener('click', async (e) => {
      e.stopPropagation();
      await savePlace(it);
    });
    el.addEventListener('click', () => highlight(it.lat, it.lng));
    box.appendChild(el);
  });
}

async function savePlace(it) {
  const place = await fetch('/api/places', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(it),
  }).then((r) => r.json());
  await loadPlaces();
  openPanel(place.id);
}

// ── 저장된 가게 로드 + 마커 ────────────────────────────────────
async function loadPlaces() {
  const places = await fetch('/api/places').then((r) => r.json());

  // 마커 갱신
  Object.values(markers).forEach((m) => m.setMap(null));
  markers = {};

  const listBox = document.getElementById('placeList');
  listBox.innerHTML = '';

  places.forEach((p) => {
    const b = scoreBand(p.avg_score);
    const scoreText = Number(p.avg_score) ? Number(p.avg_score).toFixed(1) : '·';
    const marker = new naver.maps.Marker({
      position: new naver.maps.LatLng(p.lat, p.lng),
      map,
      icon: {
        content: `<div style="background:${b.bg};color:${b.fg};border-radius:14px;padding:3px 9px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.3)">${b.emoji ? b.emoji + ' ' : ''}${scoreText} ${p.name}</div>`,
        anchor: new naver.maps.Point(20, 14),
      },
    });
    naver.maps.Event.addListener(marker, 'click', () => { highlight(p.lat, p.lng); openPanel(p.id); });
    markers[p.id] = marker;

    // 사이드바 리스트
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <div class="row">
        <span class="badge" style="background:${b.bg};color:${b.fg}">${b.emoji ? b.emoji + ' ' : ''}${scoreText}</span>
        <span class="name" style="flex:1">${p.name}</span>
        <span class="cat">(${p.review_count})</span>
      </div>
      <div class="addr">${p.road_address || p.address || ''}</div>`;
    el.addEventListener('click', () => {
      highlight(p.lat, p.lng);
      openPanel(p.id);
    });
    listBox.appendChild(el);
  });
}

// ── 상세/평가 패널 ────────────────────────────────────────────
async function openPanel(placeId) {
  const places = await fetch('/api/places').then((r) => r.json());
  const p = places.find((x) => x.id === placeId);
  if (!p) return;
  const reviews = await fetch(`/api/places/${placeId}/reviews`).then((r) => r.json());

  const body = document.getElementById('panelBody');
  body.innerHTML = `
    <h2 style="margin-top:0">${p.name}</h2>
    <div class="cat">${p.category || ''}</div>
    <div class="addr">${p.road_address || p.address || ''}</div>
    ${p.link ? `<a href="${p.link}" target="_blank" style="font-size:12px">네이버에서 보기 ↗</a>` : ''}
    <div style="margin:10px 0">
      평균 <span class="badge" style="background:${scoreBand(p.avg_score).bg};color:${scoreBand(p.avg_score).fg}">${scoreBand(p.avg_score).emoji} ${Number(p.avg_score) ? Number(p.avg_score).toFixed(1) : '-'}</span>
      <span class="cat">· 평가 ${p.review_count}개</span>
      <button id="delPlace" style="float:right;font-size:12px;border:none;background:none;color:#cf222e;cursor:pointer">삭제</button>
    </div>

    <div class="form">
      <label>방문 날짜</label>
      <input id="dateInput" type="date" value="${todayLocal()}" max="${todayLocal()}" />
      <label>점수 (1.0 ~ 10.0)</label>
      <input id="scoreInput" type="number" min="1" max="10" step="0.1" placeholder="예: 8.5" />
      <label>평가</label>
      <textarea id="commentInput" rows="3" placeholder="한 줄 평을 남겨주세요"></textarea>
      <button id="addReview">평가 등록</button>
    </div>

    <div id="reviewList" style="margin-top:14px">
      ${reviews.map((r) => `
        <div class="review-item">
          <div class="who">
            ${r.reviewer}
            <span class="badge" style="background:${scoreColor(Number(r.score))};font-size:11px">${Number(r.score).toFixed(1)}</span>
            <span class="rdate">${r.visited_on || ''}</span>
            <button class="rdel" data-id="${r.id}" title="삭제">✕</button>
          </div>
          ${r.comment ? `<div class="cmt">${escapeHtml(r.comment)}</div>` : ''}
        </div>`).join('') || '<div class="cat">아직 평가가 없어요.</div>'}
    </div>`;

  body.querySelector('#addReview').addEventListener('click', () => addReview(placeId));
  body.querySelector('#delPlace').addEventListener('click', () => deletePlace(placeId));
  body.querySelectorAll('.rdel').forEach((btn) =>
    btn.addEventListener('click', () => deleteReview(btn.dataset.id, placeId))
  );
  document.getElementById('panel').classList.remove('hidden');
}

async function deleteReview(reviewId, placeId) {
  if (!confirm('이 평가를 삭제할까요?')) return;
  await fetch(`/api/reviews/${reviewId}`, { method: 'DELETE' });
  await loadPlaces();
  openPanel(placeId);
}

async function addReview(placeId) {
  const reviewer = ME;
  if (!reviewer) return alert('홈으로 가서 하진/민혁을 먼저 선택하세요.');
  const score = document.getElementById('scoreInput').value;
  const comment = document.getElementById('commentInput').value;
  const visitedOn = document.getElementById('dateInput').value;
  if (!(Number(score) >= 1 && Number(score) <= 10)) return alert('점수는 1~10 사이로 입력하세요.');

  const res = await fetch(`/api/places/${placeId}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewer, score, comment, visitedOn }),
  });
  if (!res.ok) return alert('등록 실패');
  await loadPlaces();
  openPanel(placeId);
}

async function deletePlace(placeId) {
  if (!confirm('이 가게와 평가를 모두 삭제할까요?')) return;
  await fetch(`/api/places/${placeId}`, { method: 'DELETE' });
  document.getElementById('panel').classList.add('hidden');
  await loadPlaces();
}

document.getElementById('panelClose').addEventListener('click', () => {
  document.getElementById('panel').classList.add('hidden');
});

function escapeHtml(s = '') {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// 오늘 날짜(로컬) → YYYY-MM-DD
function todayLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

initMap();
