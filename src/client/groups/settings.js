function renderGroups() {
  const name = profile?.display_name || '내 계정';
  $('#myName').textContent = name;
  $('#displayName').value = profile?.display_name || session?.user.user_metadata?.name || '';
  $('#groupSelect').innerHTML = groups
    .map((g) => `<option value="${g.id}">${esc(g.name)}</option>`)
    .join('');
  $('#groupSelect').value = groupId;
  $('#groupTitle').textContent = groups.find((g) => g.id === groupId)?.name || '내 모임';
  $('#groupList').innerHTML = groups.length
    ? groups
        .map(
          (g) =>
            `<div class="member-row"><button data-group="${g.id}"><strong>${esc(g.name)}</strong>${g.id === groupId ? ' · 선택됨' : ''}</button>${g.owner_id === session.user.id ? `<span><button data-invite="${g.id}">새 초대 링크</button> · <button data-revoke="${g.id}">초대 취소</button></span>` : ''}</div>`,
        )
        .join('')
    : '<p class="note">참여 중인 모임이 없습니다.</p>';
  $('#join').hidden = !inviteToken;
  $('#discardInvite').hidden = !inviteToken;
  $('#membership').hidden = !profile;
  $('#compose').disabled = !groupId || !profile;
  $('#localInviteNote').hidden = !['localhost', '127.0.0.1'].includes(location.hostname);
  renderMemberControls();
  renderGroupSettings();
}

async function chooseGroup(id) {
  groupId = id;
  filter = '';
  archiveAuthor = '';
  localStorage.setItem('hashulin.group.' + session.user.id, id);
  $('#inviteBox').hidden = true;
  renderGroups();
  await loadVisits();
}

function renderGroupSettings() {
  const group = groups.find((g) => g.id === groupId);
  $('#renameGroupForm').hidden = !group || group.owner_id !== session?.user.id;
  $('#renameGroupName').value = group?.name || '';
}

function initGroupsSettingsControls() {
  $('#groupForm').onsubmit = (e) => {
    e.preventDefault();
    busy(e.submitter, async () => {
      groupId = await api('/groups', {
        method: 'POST',
        body: JSON.stringify({ name: $('#groupName').value.trim() }),
      });
      $('#groupName').value = '';
      localStorage.setItem('hashulin.group.' + session.user.id, groupId);
      $('#choiceDialog').close();
      await loadAccount();
      status('모임을 만들었습니다.');
    });
  };
}

function initGroupsSettingsActions() {
  $('#groupSelect').onchange = () =>
    chooseGroup($('#groupSelect').value).catch((e) => status(e.message));

  for (const id of ['groupNav', 'mobileGroups'])
    $('#' + id).onclick = () => showDialog('#groupDialog');
}

function initGroupsSettingsNavigation() {
  $('#renameGroupForm').onsubmit = (e) => {
    e.preventDefault();
    const target = groupId;
    busy(e.submitter, async () => {
      await api(`/groups/${target}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: $('#renameGroupName').value.trim() }),
      });
      await loadAccount();
      status('모임 이름을 저장했습니다.');
    });
  };
}
