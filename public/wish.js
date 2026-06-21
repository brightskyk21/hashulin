// ── 신원: 홈에서 선택한 하진 / 민혁 ────────────────────────────
const ME = localStorage.getItem('whoami') || '';
const meChip = document.getElementById('meChip');
if (meChip) meChip.textContent = ME || '이름 선택 →';
const OTHER = { 하진: '민혁', 민혁: '하진' };

// ── 모달 열고 닫기 ─────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(el) { el.classList.add('hidden'); }
document.querySelectorAll('[data-close]').forEach((b) =>
  b.addEventListener('click', () => closeModal(b.closest('.modal')))
);
document.querySelectorAll('.modal').forEach((m) =>
  m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); })
);

document.getElementById('openRequest').addEventListener('click', () => {
  if (!requireMe()) return;
  openModal('requestModal');
});
document.getElementById('openUse').addEventListener('click', () => {
  if (!requireMe()) return;
  document.getElementById('useDate').value = todayLocal();
  openModal('useModal');
});
document.getElementById('drawerBtn').addEventListener('click', () => {
  if (!requireMe()) return;
  openModal('drawerModal');
});

function requireMe() {
  if (!ME) { toast('홈으로 가서 하진/민혁을 먼저 선택하세요.'); return false; }
  return true;
}

// ── 소원권 신청 ────────────────────────────────────────────────
document.getElementById('requestBtn').addEventListener('click', async () => {
  const reason = document.getElementById('reasonInput').value.trim();
  if (!reason) return toast('획득 사유를 입력하세요.');
  const res = await fetch('/api/wishes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner: ME, reason }),
  });
  if (!res.ok) return toast('신청 실패');
  document.getElementById('reasonInput').value = '';
  closeModal(document.getElementById('requestModal'));
  toast('신청 완료! 상대방 컨펌을 기다려요 ⏳');
  render();
});

// ── 소원권 사용 ────────────────────────────────────────────────
document.getElementById('useBtn').addEventListener('click', async () => {
  const description = document.getElementById('useDesc').value.trim();
  const usedOn = document.getElementById('useDate').value;
  if (!description) return toast('어디에 썼는지 입력하세요.');
  const res = await fetch('/api/wish-uses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: ME, usedOn, description }),
  });
  const data = await res.json();
  if (!res.ok) return toast(data.error || '사용 실패');
  document.getElementById('useDesc').value = '';
  closeModal(document.getElementById('useModal'));
  toast('소원권을 사용했어요 ✨');
  render();
});

// ── 컨펌 / 거절 ────────────────────────────────────────────────
async function decide(id, action) {
  const res = await fetch(`/api/wishes/${id}/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ by: ME }),
  });
  if (!res.ok) { const e = await res.json(); return toast(e.error || '처리 실패'); }
  toast(action === 'approve' ? '컨펌 완료 ✓' : '거절했어요');
  render();
}

// ── 화면 그리기 ────────────────────────────────────────────────
async function render() {
  const me = ME;
  const data = await fetch('/api/wishes').then((r) => r.json());
  const { tickets } = data;

  // 잔액 (위아래 가로 바)
  document.getElementById('balances').innerHTML = ['하진', '민혁'].map((name) => `
    <div class="bal-bar ${me === name ? 'is-me' : ''}">
      <span class="bal-emoji">🎫</span>
      <span class="bal-name">${name}</span>
      <span class="bal-count">${data.balances[name] || 0}<small>장</small></span>
    </div>`).join('');

  // 컨펌 대기 (상대가 신청한 pending)
  const forMe = tickets.filter((t) => t.status === 'pending' && me && t.owner === OTHER[me]);
  const badge = document.getElementById('drawerBadge');
  if (forMe.length > 0) { badge.textContent = forMe.length; badge.classList.remove('hidden'); }
  else badge.classList.add('hidden');

  const pBox = document.getElementById('pendingForMe');
  if (!me) pBox.innerHTML = '<div class="empty">먼저 "나는" 누구인지 선택하세요.</div>';
  else if (forMe.length === 0) pBox.innerHTML = '<div class="empty">컨펌할 요청이 없어요.</div>';
  else pBox.innerHTML = forMe.map((t) => `
      <div class="wish-item">
        <div class="wish-top"><b>${t.owner}</b>님의 소원권 신청</div>
        <div class="wish-reason">${escapeHtml(t.reason)}</div>
        <div class="wish-actions">
          <button class="btn-ok" onclick="decide('${t.id}','approve')">✓ 컨펌</button>
          <button class="btn-no" onclick="decide('${t.id}','reject')">✕ 거절</button>
        </div>
      </div>`).join('');
}

// ── 토스트 ─────────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}

function todayLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function escapeHtml(s = '') {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

render();
