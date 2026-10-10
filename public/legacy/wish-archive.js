const me = localStorage.getItem('whoami') || '';

async function render() {
  const data = await fetch('/api/wishes').then((r) => r.json());
  const { earned, used, balances, uses, tickets } = data;

  // 요약: 사람별 받은/쓴/남은
  document.getElementById('summary').innerHTML = ['하진', '민혁'].map((name) => `
    <div class="sum-card ${me === name ? 'is-me' : ''}">
      <div class="sum-name">${name}</div>
      <div class="sum-row">
        <span>받음 <b>${earned[name] || 0}</b></span>
        <span>씀 <b>${used[name] || 0}</b></span>
        <span class="sum-left">남음 <b>${balances[name] || 0}</b></span>
      </div>
    </div>`).join('');

  // 사용 내역
  const useBox = document.getElementById('useList');
  if (!uses.length) {
    useBox.innerHTML = '<div class="empty">아직 사용한 소원권이 없어요.</div>';
  } else {
    useBox.innerHTML = uses.map((u) => `
      <div class="wish-item">
        <div class="wish-top">
          <span class="who-chip ${u.user_name}">${u.user_name}</span>
          <span class="wish-date">${u.used_on}</span>
          <button class="rdel" onclick="delUse('${u.id}')" title="삭제">✕</button>
        </div>
        <div class="wish-reason">${escapeHtml(u.description)}</div>
      </div>`).join('');
  }

  // 획득(승인) 내역
  const earnBox = document.getElementById('earnList');
  const approved = tickets.filter((t) => t.status === 'approved');
  if (!approved.length) {
    earnBox.innerHTML = '<div class="empty">아직 획득한 소원권이 없어요.</div>';
  } else {
    earnBox.innerHTML = approved.map((t) => `
      <div class="wish-item">
        <div class="wish-top">
          <span class="who-chip ${t.owner}">${t.owner}</span>
          <span class="tag tag-ok">획득</span>
          <span class="wish-date">${(t.decided_at || t.created_at || '').slice(0, 10)}</span>
        </div>
        <div class="wish-reason">${escapeHtml(t.reason)}</div>
      </div>`).join('');
  }
}

async function delUse(id) {
  if (!confirm('이 사용 기록을 삭제(되돌리기)할까요?')) return;
  await fetch(`/api/wish-uses/${id}`, { method: 'DELETE' });
  toast('되돌렸어요');
  render();
}

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}
function escapeHtml(s = '') {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

render();
