function accountDialog(id) {
  for (const other of ['#profileDialog', '#choiceDialog', '#groupDialog'])
    if (other !== id && $(other).open) $(other).close();
  if (!$(id).open) showDialog(id);
}

function openProfile() {
  $('#profileTitle').textContent = profile ? '내 프로필' : '프로필 설정';
  $('#profileGuide').textContent = profile ? '' : '모임에서 사용할 이름을 입력해주세요.';
  $('#profileForm .primary').textContent = profile ? '이름 저장' : '다음';
  $('#profileDialog [data-close]').hidden = !profile;
  accountDialog('#profileDialog');
}

function chooseAccountMode(mode) {
  $('#accountChoices').hidden = !!inviteToken;
  $('#groupForm').hidden = mode !== 'create' || !!inviteToken;
  $('#inviteCodeForm').hidden = mode !== 'join' || !!inviteToken;
  $('#choiceDialog [data-close]').hidden = !groups.length;
  accountDialog('#choiceDialog');
}

async function guideAccount() {
  const step = accountStep(profile, groups, inviteToken);
  if (step === 'profile') openProfile();
  else if (step === 'invite') await previewPendingInvite();
  else if (step === 'group') chooseAccountMode('');
}

function initAuthOnboardingControls() {
  $('#profileForm').onsubmit = (e) => {
    e.preventDefault();
    busy(e.submitter, async () => {
      await api('/profile', {
        method: 'PUT',
        body: JSON.stringify({ displayName: $('#displayName').value.trim() }),
      });
      $('#profileDialog').close();
      await loadAccount();
      status('이름을 저장했습니다.');
    });
  };
}

function initAuthOnboardingActions() {
  $('#myName').onclick = openProfile;

  $('#editProfile').onclick = openProfile;

  $('#addGroup').onclick = () => {
    chooseAccountMode('');
    if (inviteToken) previewPendingInvite();
  };

  $('#chooseCreate').onclick = () => chooseAccountMode('create');

  $('#chooseJoin').onclick = () => chooseAccountMode('join');

  $('#profileDialog').addEventListener('cancel', (e) => {
    if (!profile) e.preventDefault();
  });

  $('#choiceDialog').addEventListener('cancel', (e) => {
    if (!groups.length) e.preventDefault();
  });
}
