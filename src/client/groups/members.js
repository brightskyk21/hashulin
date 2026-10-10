let membershipAction = null,
  membershipChecking = false;

function renderMemberControls() {
  const group = groups.find((g) => g.id === groupId),
    owner = group?.owner_id === session?.user.id;
  $('#currentMembers').innerHTML = members.length
    ? members
        .map(
          (m) =>
            `<div class="member-row"><span>${esc(m.h_profiles?.display_name || '멤버')}${m.user_id === session?.user.id ? ' · 나' : ''}${m.user_id === group?.owner_id ? ' · 모임장' : ''}</span>${m.user_id !== group?.owner_id && (owner || m.user_id === session?.user.id) ? `<button class="member-action" data-remove-member="${m.user_id}">${m.user_id === session.user.id ? '모임 나가기' : '내보내기'}</button>` : ''}</div>`,
        )
        .join('')
    : '<p class="note">현재 모임의 멤버가 없습니다.</p>';
  $('#membershipNote').textContent = owner
    ? '모임장은 현재 탈퇴할 수 없습니다. 멤버를 내보내도 기존 기록은 유지됩니다.'
    : '모임을 나가도 남긴 기록은 보관됩니다. 다시 참여하려면 새 초대가 필요합니다.';
}

async function refreshMembership() {
  if (!client || !session || document.hidden || membershipChecking) return;
  membershipChecking = true;
  const user = session.user.id,
    target = groupId;
  try {
    const available = await api('/groups');
    if (session?.user.id !== user || groupId !== target) return;
    if (target && !available.some((g) => g.id === target)) {
      ++loadVersion;
      groupId = '';
      groups = available;
      members = [];
      visits = [];
      archive = null;
      photoGallery = [];
      $('#photoLarge').removeAttribute('src');
      document.querySelectorAll('dialog[open]').forEach((d) => d.close());
      resetWorkspace();
      $('#records').replaceChildren();
      $('#archiveRecords').replaceChildren();
      $('#archiveSection').hidden = true;
      $('#inviteLink').value = '';
      $('#inviteBox').hidden = true;
      render();
      await loadAccount();
      status('모임 접근 권한이 변경되어 기록을 닫았습니다.');
    }
  } catch (_) {
    /* Offline does not imply revocation. Every API write still checks membership. */
  } finally {
    membershipChecking = false;
  }
}

function initGroupsMembersControls() {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove-member]');
    if (!b) return;
    const m = members.find((m) => m.user_id === b.dataset.removeMember);
    if (!m) return;
    const self = m.user_id === session.user.id;
    membershipAction = { group: groupId, user: m.user_id, self };
    $('#membershipTitle').textContent = self ? '모임 나가기' : '멤버 내보내기';
    $('#membershipMessage').textContent = self
      ? '이 모임에서 나갈까요? 이후에는 이 모임의 리뷰을 보거나 수정할 수 없습니다.'
      : (m.h_profiles?.display_name || '이 멤버') +
        ' 님을 내보낼까요? 이후에는 이 모임의 리뷰을 보거나 수정할 수 없습니다.';
    $('#confirmMembership').textContent = self ? '모임 나가기' : '내보내기';
    showDialog('#membershipDialog');
  });

  $('#confirmMembership').onclick = () =>
    busy($('#confirmMembership'), async () => {
      const action = membershipAction;
      if (!action) return;
      await api(`/groups/${action.group}/members/${action.user}`, { method: 'DELETE' });
      $('#membershipDialog').close();
      $('#inviteBox').hidden = true;
      $('#inviteLink').value = '';
      if (action.self) {
        $('#groupDialog').close();
        groupId = '';
      }
      await loadAccount();
      status(
        action.self
          ? '모임에서 나왔습니다.'
          : '멤버를 내보냈습니다. 미사용 초대 링크도 취소했습니다.',
      );
    });
}

function initGroupsMembersActions() {
  setInterval(refreshMembership, 30000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshMembership();
  });
}
