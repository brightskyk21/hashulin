function initCoreEventsControls() {
  $('#mobileLogout').onclick = () => logout($('#mobileLogout'));
}

function initCoreEventsActions() {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-close')) {
      const dialog = b.closest('dialog');
      if (dialog.id === 'reviewDialog' && reviewSaving)
        return status('저장이 끝날 때까지 기다려주세요.');
      if (
        dialog.id === 'reviewDialog' &&
        reviewDirty() &&
        !confirm('작성 중인 내용을 닫을까요? 저장하지 않은 내용은 사라집니다.')
      )
        return;
      dialog.close();
    }
    if (b.hasAttribute('data-manage')) showDialog('#groupDialog');
    if (b.hasAttribute('data-compose')) compose();
    if (b.hasAttribute('data-filter')) {
      filter = b.dataset.filter;
      archiveAuthor = '';
      archiveLimit = 24;
      journalLimit = 24;
      refreshJournal().catch((e) => status(e.message));
    }
    if (b.dataset.review) compose(visits.find((v) => v.id === b.dataset.review));
    if (b.hasAttribute('data-retry')) busy(b, loadVisits);
    if (b.dataset.group)
      busy(b, async () => {
        await chooseGroup(b.dataset.group);
        $('#groupDialog').close();
      });
    if (b.dataset.invite) busy(b, () => createInvite(b));
    if (b.dataset.revoke)
      busy(b, async () => {
        await api(`/groups/${b.dataset.revoke}/invites`, { method: 'DELETE' });
        $('#inviteBox').hidden = true;
        $('#inviteLink').value = '';
        status('아직 사용하지 않은 초대 링크를 취소했습니다.');
      });
  });
}

function initCoreEventsNavigation() {
  $('#photoNext').onclick = () => movePhoto(1);
}
