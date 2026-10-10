async function copyInviteLink() {
  const field = $('#inviteLink');
  if (!field.value) return;
  try {
    await navigator.clipboard.writeText(field.value);
    $('#inviteMessage').textContent = '초대 링크를 복사했습니다.';
    $('#copyInvite').textContent = '복사 완료';
  } catch (_) {
    field.focus();
    field.select();
    field.setSelectionRange(0, field.value.length);
    $('#inviteMessage').textContent =
      '자동 복사가 지원되지 않습니다. 선택된 주소를 길게 눌러 복사해주세요.';
  }
}

async function createInvite(button) {
  const target = button.dataset.invite,
    actor = session?.user.id;
  const box = $('#inviteBox'),
    copy = $('#copyInvite');
  box.hidden = false;
  $('#inviteLink').value = '';
  copy.disabled = true;
  copy.textContent = '링크 복사';
  $('#inviteHeading').textContent = (groups.find((g) => g.id === target)?.name || '모임') + ' 초대';
  $('#inviteMessage').textContent = '초대 링크 생성 중…';
  box.scrollIntoView({ block: 'center', behavior: 'smooth' });
  try {
    const token = await api(`/groups/${target}/invites`, { method: 'POST' });
    if (session?.user.id !== actor || !groups.some((g) => g.id === target)) return;
    $('#inviteLink').value = location.origin + '/v2/#invite=' + encodeURIComponent(token);
    $('#inviteCode').value = token;
    $('#inviteMessage').textContent = '초대 링크를 생성했습니다.';
    copy.disabled = false;
    copy.focus({ preventScroll: true });
    box.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } catch (error) {
    $('#inviteMessage').textContent =
      error.message || '초대 링크를 만들지 못했습니다. 다시 시도해주세요.';
    box.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

let invitePreviewVersion = 0;

async function previewPendingInvite() {
  const version = ++invitePreviewVersion,
    token = inviteToken,
    actor = session?.user.id;
  $('#join').hidden = true;
  $('#join').disabled = true;
  $('#discardInvite').hidden = false;
  $('#invitePreview').textContent = '초대 확인 중…';
  chooseAccountMode('');
  try {
    const valid = parseInvite(token);
    if (!valid) throw new Error('초대 코드나 링크를 확인해주세요.');
    const rows = await api('/invites/preview', {
      method: 'POST',
      body: JSON.stringify({ token: valid }),
    });
    if (version !== invitePreviewVersion || inviteToken !== token || session?.user.id !== actor)
      return;
    const invitation = rows[0];
    $('#invitePreview').textContent = invitation
      ? invitation.already_member
        ? invitation.group_name + '에 이미 참여 중입니다.'
        : invitation.group_name + ' 모임에 초대되었습니다.'
      : '만료되었거나 취소된 초대입니다. 새 초대를 요청해주세요.';
    $('#join').textContent = invitation?.already_member ? '이 모임 열기' : '이 모임에 참여';
    $('#join').hidden = !invitation;
    $('#join').disabled = !invitation;
  } catch (error) {
    if (version === invitePreviewVersion && inviteToken === token)
      $('#invitePreview').textContent = error.message;
  }
}

function initGroupsInvitesControls() {
  $('#join').onclick = () =>
    busy($('#join'), async () => {
      groupId = await api('/groups/join', {
        method: 'POST',
        body: JSON.stringify({ token: inviteToken }),
      });
      inviteToken = null;
      sessionStorage.removeItem('hashulin.pendingInvite');
      history.replaceState({}, '', location.pathname);
      localStorage.setItem('hashulin.group.' + session.user.id, groupId);
      $('#choiceDialog').close();
      await loadAccount();
      status('모임에 참여했습니다.');
    });

  $('#discardInvite').onclick = () => {
    sessionStorage.removeItem('hashulin.pendingInvite');
    inviteToken = null;
    $('#invitePreview').textContent = '';
    $('#join').hidden = true;
    $('#discardInvite').hidden = true;
    $('#inviteCodeInput').value = '';
    chooseAccountMode('');
  };

  $('#copyInvite').onclick = () => busy($('#copyInvite'), copyInviteLink);
}

function initGroupsInvitesActions() {
  $('#inviteCodeForm').onsubmit = (e) => {
    e.preventDefault();
    busy(e.submitter, async () => {
      const token = parseInvite($('#inviteCodeInput').value);
      if (!token) throw new Error('받은 초대 코드나 링크를 그대로 붙여넣어주세요.');
      inviteToken = token;
      sessionStorage.setItem('hashulin.pendingInvite', token);
      await previewPendingInvite();
    });
  };
}
