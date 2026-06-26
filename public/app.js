// ── 상태 ───────────────────────────────────────────────────────
let map;
let markers = {};            // place.id -> naver.maps.Marker
let sortMode = 'recent';     // 저장된 가게 정렬: recent | score
let reviewFilter = '전체';   // 리뷰 필터: 전체 | 민혁 | 하진
let editingReviewId = null;  // 수정 중인 리뷰 id
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

// ── 위치로 부드럽게 이동 (별도 핀은 띄우지 않음) ───────────────
function highlight(lat, lng) {
  if (!map || lat == null || lng == null) return;
  map.panTo(new naver.maps.LatLng(lat, lng));
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

  // 평점순 정렬 (최신순은 서버 기본 순서 유지)
  if (sortMode === 'score') places.sort((a, b) => Number(b.avg_score) - Number(a.avg_score));

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
        content: `<div class="map-pin" style="background:${b.bg}">${b.emoji || ''}</div>`,
        anchor: new naver.maps.Point(17, 17),
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
  editingReviewId = null;   // 패널 (재)렌더 시 수정모드 해제
  const places = await fetch('/api/places').then((r) => r.json());
  const p = places.find((x) => x.id === placeId);
  if (!p) return;
  const reviews = await fetch(`/api/places/${placeId}/reviews`).then((r) => r.json());

  const body = document.getElementById('panelBody');
  const b = scoreBand(p.avg_score);
  const avgText = Number(p.avg_score) ? Number(p.avg_score).toFixed(1) : '-';
  const tags = (p.category || '')
    .split(/[>,]/)
    .map((s) => s.trim())
    .filter((t) => t && t !== '음식점');
  const tagHtml = tags.map((t) => `<span class="cat-tag">${escapeHtml(t)}</span>`).join('');

  // 사용자별 리뷰 필터
  const shownReviews = reviewFilter === '전체' ? reviews : reviews.filter((r) => r.reviewer === reviewFilter);
  const filterHtml = reviews.length
    ? `<div class="rfilter">${['전체', '민혁', '하진']
        .map((f) => `<button class="rfilter-btn ${reviewFilter === f ? 'on' : ''}" data-f="${f}">${f}</button>`)
        .join('')}</div>`
    : '';

  body.innerHTML = `
    <div class="place-head">
      <h2 class="place-name">${escapeHtml(p.name)}</h2>
      <div class="cat-tags">${tagHtml}</div>
      <div class="place-addr">${escapeHtml(p.road_address || p.address || '')}</div>
      ${p.link ? `<a class="naver-link" href="${p.link}" target="_blank">네이버에서 보기 ↗</a>` : ''}
    </div>

    <div class="score-summary">
      <span class="ss-emoji" style="background:${b.bg};color:${b.fg}">${b.emoji || '–'}</span>
      <div class="ss-main">
        <div class="ss-score" style="color:${b.bg}">${avgText}<small>/ 10</small></div>
        <div class="ss-sub">평가 ${p.review_count}개 · 평균</div>
      </div>
      <button id="delPlace" class="ss-del" title="가게 삭제">삭제</button>
    </div>

    <div class="form">
      <label>방문 날짜</label>
      <input id="dateInput" type="date" value="${todayLocal()}" max="${todayLocal()}" />
      <label>점수</label>
      <div class="score-pick">
        <div id="scoreReadout" class="score-readout">
          <span id="scoreEmoji">😐</span> <span id="scoreVal">5.0</span>
        </div>
        <input id="scoreInput" class="score-range" type="range" min="1" max="10" step="0.1" value="5" />
        <div class="score-scale"><span>1</span><span>5</span><span>10</span></div>
      </div>
      <label>평가</label>
      <textarea id="commentInput" rows="3" placeholder="한 줄 평을 남겨주세요"></textarea>
      <button id="addReview">평가 등록</button>
    </div>

    <div style="margin-top:14px">
      ${filterHtml}
      <div id="reviewList">
        ${shownReviews.map((r) => `
          <div class="review-item">
            <div class="who">
              ${r.reviewer}
              <span class="badge" style="background:${scoreColor(Number(r.score))};font-size:11px">${Number(r.score).toFixed(1)}</span>
              <span class="rdate">${r.visited_on || ''}</span>
              <span class="rtools">
                <button class="redit" data-id="${r.id}" title="수정">✏️</button>
                <button class="rdel" data-id="${r.id}" title="삭제">✕</button>
              </span>
            </div>
            ${r.comment ? `<div class="cmt">${escapeHtml(r.comment)}</div>` : ''}
          </div>`).join('') || `<div class="cat">${reviewFilter === '전체' ? '아직 평가가 없어요.' : '이 사람의 평가가 없어요.'}</div>`}
      </div>
    </div>`;

  body.querySelector('#addReview').addEventListener('click', () => addReview(placeId));
  body.querySelector('#delPlace').addEventListener('click', () => deletePlace(placeId));
  body.querySelectorAll('.rdel').forEach((btn) =>
    btn.addEventListener('click', () => deleteReview(btn.dataset.id, placeId))
  );
  body.querySelectorAll('.redit').forEach((btn) =>
    btn.addEventListener('click', () => openReviewEdit(reviews.find((r) => r.id === btn.dataset.id)))
  );
  body.querySelectorAll('.rfilter-btn').forEach((btn) =>
    btn.addEventListener('click', () => { reviewFilter = btn.dataset.f; openPanel(placeId); })
  );

  // 스펙트럼 슬라이더: 드래그하면 점수·이모지·색 실시간 갱신
  const slider = body.querySelector('#scoreInput');
  const updateScore = () => {
    const v = Number(slider.value);
    const b = scoreBand(v);
    body.querySelector('#scoreVal').textContent = v.toFixed(1);
    body.querySelector('#scoreEmoji').textContent = b.emoji || '🤔';
    body.querySelector('#scoreReadout').style.color = b.bg;
  };
  slider.addEventListener('input', updateScore);
  updateScore();

  document.getElementById('panel').classList.remove('hidden');
}

async function deleteReview(reviewId, placeId) {
  if (!confirm('이 평가를 삭제할까요?')) return;
  await fetch(`/api/reviews/${reviewId}`, { method: 'DELETE' });
  await loadPlaces();
  openPanel(placeId);
}

function openReviewEdit(r) {
  if (!r) return;
  editingReviewId = r.id;
  const body = document.getElementById('panelBody');
  body.querySelector('#dateInput').value = r.visited_on || todayLocal();
  const slider = body.querySelector('#scoreInput');
  slider.value = r.score;
  slider.dispatchEvent(new Event('input'));        // 점수 읽기값 갱신
  body.querySelector('#commentInput').value = r.comment || '';
  body.querySelector('#addReview').textContent = '평가 수정';
  body.querySelector('.form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function addReview(placeId) {
  const reviewer = ME;
  const editing = editingReviewId;
  if (!editing && !reviewer) return alert('홈으로 가서 하진/민혁을 먼저 선택하세요.');
  const score = document.getElementById('scoreInput').value;
  const comment = document.getElementById('commentInput').value;
  const visitedOn = document.getElementById('dateInput').value;
  if (!(Number(score) >= 1 && Number(score) <= 10)) return alert('점수는 1~10 사이로 입력하세요.');

  const res = await fetch(editing ? `/api/reviews/${editing}` : `/api/places/${placeId}/reviews`, {
    method: editing ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(editing ? { score, comment, visitedOn } : { reviewer, score, comment, visitedOn }),
  });
  if (!res.ok) return alert(editing ? '수정 실패' : '등록 실패');
  editingReviewId = null;
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

// ── 모바일 바텀시트: 핸들 끌어서 펼치기/접기 ───────────────────
function initSheet() {
  const sheet = document.querySelector('.sidebar');
  const handle = document.querySelector('.sheet-handle');
  if (!sheet || !handle) return;
  const isMobile = () => window.matchMedia('(max-width: 720px)').matches;
  const collapsedY = () => Math.max(0, sheet.offsetHeight - 140); // 검색바까지만 살짝 보이게
  let curY = 0, startTouchY = 0, startCurY = 0, dragging = false;

  const apply = (y, anim) => {
    sheet.style.transition = anim ? 'transform .25s ease' : 'none';
    sheet.style.transform = `translateY(${y}px)`;
    curY = y;
  };
  const expand = () => apply(0, true);
  const collapse = () => apply(collapsedY(), true);

  const reset = () => {
    if (isMobile()) collapse();
    else { sheet.style.transform = ''; sheet.style.transition = ''; }
  };

  handle.addEventListener('touchstart', (e) => {
    if (!isMobile()) return;
    dragging = true; startTouchY = e.touches[0].clientY; startCurY = curY;
    sheet.style.transition = 'none';
  }, { passive: true });
  handle.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const dy = e.touches[0].clientY - startTouchY;
    apply(Math.min(collapsedY(), Math.max(0, startCurY + dy)), false);
    e.preventDefault();
  }, { passive: false });
  handle.addEventListener('touchend', () => {
    if (!dragging) return; dragging = false;
    const moved = Math.abs(curY - startCurY);
    if (moved < 6) (curY > collapsedY() / 2 ? expand() : collapse());   // 탭 → 토글
    else (curY < collapsedY() / 2 ? expand() : collapse());            // 드래그 → 가까운 쪽
  });

  window.addEventListener('resize', reset);
  reset();
}

// 저장된 가게 정렬 토글
document.querySelectorAll('.sort-btn').forEach((btn) =>
  btn.addEventListener('click', () => {
    sortMode = btn.dataset.sort;
    document.querySelectorAll('.sort-btn').forEach((b) => b.classList.toggle('on', b === btn));
    loadPlaces();
  })
);

initMap();
initSheet();
