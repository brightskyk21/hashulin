async function loadAccount() {
  profile = await api('/profile');
  groups = await api('/groups');
  const preferred = localStorage.getItem('hashulin.group.' + session.user.id);
  if (!groups.some((g) => g.id === groupId))
    groupId = groups.some((g) => g.id === preferred) ? preferred : groups[0]?.id || '';
  renderGroups();
  await loadVisits();
  await guideAccount();
}

function clearAccount() {
  ++loadVersion;
  session = null;
  profile = null;
  groups = [];
  members = [];
  visits = [];
  archive = null;
  resetWorkspace();
  $('#archiveRecords').replaceChildren();
  $('#legacyAuthors').replaceChildren();
  photoGallery = [];
  $('#photoLarge').removeAttribute('src');
  $('#archiveSection').hidden = true;
  groupId = '';
  ++journalRequest;
  resetJournalPagination();
  sessionStorage.removeItem('hashulin.pendingInvite');
  inviteToken = null;
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  $('#records').replaceChildren();
  $('#groupList').replaceChildren();
  $('#currentMembers').replaceChildren();
  $('#inviteLink').value = '';
  $('#app').hidden = true;
  $('#login').hidden = false;
}

async function logout(button) {
  await busy(button, async () => {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    clearAccount();
    status('로그아웃했습니다.');
  });
}
