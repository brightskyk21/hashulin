function renderLegacyAuthors() {
  const own = groups.find((g) => g.id === groupId)?.owner_id === session.user.id;
  const pending = (archive.authors || []).filter(
    (a) => !a.accepted_at && (own || a.user_id === session.user.id),
  );
  $('#legacyAuthors').hidden = !pending.length;
  $('#legacyAuthors').innerHTML =
    `<details><summary>이전 리뷰의 계정 연결</summary><p class="note">모임장이 계정을 지정하고, 당사자가 본인의 리뷰인지 확인하면 수정할 수 있습니다. 연결이 끝난 작성자는 여기서 바꿀 수 없습니다.</p>${pending.map((a) => `<div class="author-link-row"><div><strong>${esc(a.reviewer)}</strong><span class="note"> · 리뷰 ${a.review_count}개</span><p class="note">${a.accepted_at ? esc(a.display_name) + ' 계정에 연결됨' : a.user_id ? esc(a.display_name) + ' 님의 확인 대기' : '연결할 계정을 선택해주세요.'}</p></div>${!a.accepted_at && own ? `<form class="author-link-form" data-author-form="${esc(a.reviewer)}"><label>연결할 계정<select name="userId" required aria-label="${esc(a.reviewer)} 리뷰에 연결할 계정"><option value="">계정 선택</option>${members.map((m) => `<option value="${m.user_id}" ${m.user_id === a.user_id ? 'selected' : ''}>${esc(m.h_profiles?.display_name || '멤버')}${m.user_id === session.user.id ? ' · 나' : ''}</option>`).join('')}</select></label><button class="primary small">${a.user_id ? '지정 변경' : '계정 지정'}</button></form>` : ''}${!a.accepted_at && a.user_id === session.user.id ? `<div class="author-confirm"><p>이전 ‘${esc(a.reviewer)}’ 리뷰 ${a.review_count}개가 본인이 작성한 리뷰인가요?</p><button class="primary small" data-accept-author="${esc(a.reviewer)}">내 리뷰로 연결</button></div>` : ''}</div>`).join('')}</details>`;
}

function renderArchive() {
  $('#archiveSection').hidden = true;
  if (archive) renderLegacyAuthors();
  else $('#legacyAuthors').replaceChildren();
  renderJournalFeed();
}

function initGroupsLegacyAuthorsControls() {
  $('#archiveRecords').addEventListener(
    'error',
    (e) => {
      if (e.target.matches('.photo-thumb img')) {
        e.target.hidden = true;
        e.target.nextElementSibling.hidden = false;
      }
    },
    true,
  );

  $('#legacyAuthors').addEventListener('submit', (e) => {
    const f = e.target.closest('[data-author-form]');
    if (!f) return;
    e.preventDefault();
    busy(e.submitter, async () => {
      await api(`/groups/${groupId}/legacy-authors`, {
        method: 'POST',
        body: JSON.stringify({
          reviewer: f.dataset.authorForm,
          userId: new FormData(f).get('userId'),
        }),
      });
      await loadVisits();
      $('#legacyAuthors details').open = true;
      status('계정을 지정했습니다. 당사자가 확인하면 연결됩니다.');
    });
  });
}

function initGroupsLegacyAuthorsActions() {
  $('#archiveAuthor').onchange = (e) => {
    archiveAuthor = e.target.value;
    archiveLimit = 24;
    renderArchive();
  };
}
