const OWNER_COLOR = { 민혁: '#3182F6', 하진: '#E64980', 데이트: '#7C5CFC' };
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

let viewYear, viewMonth;        // 보고 있는 연/월 (month: 0-11)
let selected;                   // 선택된 날짜 YYYY-MM-DD
let events = [];                // 전체 일정

function ymd(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function todayStr() {
  const t = new Date();
  return ymd(t.getFullYear(), t.getMonth(), t.getDate());
}

async function load() {
  events = await fetch('/api/events').then((r) => r.json());
  renderMonth();
  renderDayPanel();
}

function renderMonth() {
  document.getElementById('calLabel').textContent = `${viewYear}.${String(viewMonth + 1).padStart(2, '0')}`;
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = todayStr();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push('<div class="cal-cell empty"></div>');
  for (let d = 1; d <= daysInMonth; d++) {
    const date = ymd(viewYear, viewMonth, d);
    const dayEvents = events.filter((e) => e.event_date <= date && date <= (e.end_date || e.event_date));
    const bars = dayEvents.slice(0, 3).map((e) => {
      const end = e.end_date || e.event_date;
      const bl = e.event_date === date ? 6 : 0;  // 시작일 왼쪽 둥글게
      const br = end === date ? 6 : 0;            // 종료일 오른쪽 둥글게
      return `<div class="cal-bar" style="background:${OWNER_COLOR[e.owner]};border-radius:${bl}px ${br}px ${br}px ${bl}px"></div>`;
    }).join('');
    const more = dayEvents.length > 3 ? `<span class="cal-more">+${dayEvents.length - 3}</span>` : '';
    const cls = ['cal-cell'];
    if (date === today) cls.push('today');
    if (date === selected) cls.push('selected');
    const wd = new Date(viewYear, viewMonth, d).getDay();
    const numCls = wd === 0 ? 'sun' : wd === 6 ? 'sat' : '';
    cells.push(`
      <div class="${cls.join(' ')}" data-date="${date}">
        <span class="cal-num ${numCls}">${d}</span>
        <div class="cal-bars">${bars}${more}</div>
      </div>`);
  }

  const grid = document.getElementById('calGrid');
  grid.innerHTML = cells.join('');
  grid.querySelectorAll('.cal-cell[data-date]').forEach((c) =>
    c.addEventListener('click', () => { selected = c.dataset.date; renderMonth(); renderDayPanel(); })
  );
}

function renderDayPanel() {
  const panel = document.getElementById('dayPanel');
  const dayEvents = events.filter((e) => e.event_date <= selected && selected <= (e.end_date || e.event_date));
  const [y, m, d] = selected.split('-').map(Number);
  const wd = WEEK[new Date(y, m - 1, d).getDay()];

  panel.innerHTML = `
    <div class="day-head">
      <b>${m}월 ${d}일 (${wd})</b>
      <button class="day-add" id="dayAdd">＋ 추가</button>
    </div>
    ${dayEvents.length === 0
      ? '<div class="empty">일정이 없어요.</div>'
      : dayEvents.map((e) => `
        <div class="ev-item" style="border-left-color:${OWNER_COLOR[e.owner]}">
          <div class="ev-top">
            <span class="ev-owner" style="background:${OWNER_COLOR[e.owner]}">${e.owner}</span>
            ${e.start_time ? `<span class="ev-time">${e.start_time.slice(0, 5)}</span>` : '<span class="ev-time">종일</span>'}
            <button class="rdel" data-id="${e.id}" title="삭제">✕</button>
          </div>
          <div class="ev-title">${escapeHtml(e.title)}</div>
          ${e.end_date && e.end_date !== e.event_date
            ? `<div class="ev-range">📅 ${shortK(e.event_date)} ~ ${shortK(e.end_date)} (여행/연속)</div>` : ''}
          ${e.memo ? `<div class="ev-memo">${escapeHtml(e.memo)}</div>` : ''}
        </div>`).join('')}
  `;

  panel.querySelector('#dayAdd').addEventListener('click', () => openAdd(selected));
  panel.querySelectorAll('.rdel').forEach((b) =>
    b.addEventListener('click', () => delEvent(b.dataset.id))
  );
}

// ── 추가 모달 ──────────────────────────────────────────────────
let pickedOwner = localStorage.getItem('whoami') || '민혁';
let addDate;

function fmtDateK(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일 (${WEEK[new Date(y, m - 1, d).getDay()]})`;
}
function shortK(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}.${d}`;
}
function buildTimeOptions() {
  document.getElementById('evHour').innerHTML =
    '<option value="">종일</option>' +
    Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}시</option>`).join('');
  document.getElementById('evMin').innerHTML =
    Array.from({ length: 12 }, (_, i) => {
      const mm = String(i * 5).padStart(2, '0');
      return `<option value="${mm}">${mm}분</option>`;
    }).join('');
}

function openAdd(dateStr) {
  addDate = dateStr || selected || todayStr();
  document.getElementById('evDateDisplay').textContent = fmtDateK(addDate);
  const end = document.getElementById('evEndDate');
  end.value = '';
  end.min = addDate;
  document.getElementById('evAmpm').value = 'AM';
  document.getElementById('evHour').value = '';
  document.getElementById('evMin').value = '00';
  document.getElementById('evTitle').value = '';
  document.getElementById('evMemo').value = '';
  paintOwner();
  document.getElementById('addModal').classList.remove('hidden');
}
function paintOwner() {
  document.querySelectorAll('.owner-btn').forEach((b) => {
    const on = b.dataset.owner === pickedOwner;
    b.classList.toggle('on', on);
    b.style.background = on ? OWNER_COLOR[b.dataset.owner] : '';
    b.style.color = on ? '#fff' : '';
    b.style.borderColor = on ? OWNER_COLOR[b.dataset.owner] : '';
  });
}
document.querySelectorAll('.owner-btn').forEach((b) =>
  b.addEventListener('click', () => { pickedOwner = b.dataset.owner; paintOwner(); })
);
document.getElementById('addBtn').addEventListener('click', () => openAdd(selected));
document.querySelectorAll('[data-close]').forEach((b) =>
  b.addEventListener('click', () => document.getElementById('addModal').classList.add('hidden'))
);
document.getElementById('addModal').addEventListener('click', (e) => {
  if (e.target.id === 'addModal') e.target.classList.add('hidden');
});

document.getElementById('saveEvent').addEventListener('click', async () => {
  const title = document.getElementById('evTitle').value.trim();
  const eventDate = addDate;
  const memo = document.getElementById('evMemo').value.trim();
  if (!title) return toast('내용을 입력하세요.');
  if (!eventDate) return toast('날짜를 선택하세요.');

  // 오전/오후 + 시 + 분 → "HH:MM" (시 미선택이면 종일)
  const hourSel = document.getElementById('evHour').value;
  let startTime = '';
  if (hourSel !== '') {
    let h = Number(hourSel);
    const ampm = document.getElementById('evAmpm').value;
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    startTime = `${String(h).padStart(2, '0')}:${document.getElementById('evMin').value}`;
  }

  const endDate = document.getElementById('evEndDate').value;
  const res = await fetch('/api/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner: pickedOwner, title, eventDate, endDate, startTime, memo }),
  });
  if (!res.ok) return toast('저장 실패');
  document.getElementById('addModal').classList.add('hidden');
  selected = eventDate;
  toast('일정 추가됨 📅');
  await load();
});

async function delEvent(id) {
  if (!confirm('이 일정을 삭제할까요?')) return;
  await fetch(`/api/events/${id}`, { method: 'DELETE' });
  await load();
}

// ── 월 이동 ────────────────────────────────────────────────────
document.getElementById('prevM').addEventListener('click', () => {
  viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  renderMonth();
});
document.getElementById('nextM').addEventListener('click', () => {
  viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderMonth();
});

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}
function escapeHtml(s = '') {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// 초기화
(function init() {
  const t = new Date();
  viewYear = t.getFullYear();
  viewMonth = t.getMonth();
  selected = todayStr();
  buildTimeOptions();
  load();
})();
