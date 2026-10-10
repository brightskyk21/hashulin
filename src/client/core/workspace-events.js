function initCoreWorkspaceEventsControls() {
  window.navermap_authFailure = () => {
    $('#realMap').textContent = '지도를 표시할 수 없습니다. 장소 목록을 이용해주세요.';
  };
}

function initCoreWorkspaceEventsActions() {
  $('#nextMonth').onclick = () => moveMonth(1);
}

function initCoreWorkspaceEventsNavigation() {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.place) openPlace(b.dataset.place);
    if (b.dataset.placeReview) composePlace(b.dataset.placeReview);
    if (b.dataset.placeUpload) {
      $('#placeDialog').close();
      openUpload(b.dataset.placeUpload);
    }
    if (b.dataset.placeStatus)
      busy(b, async () => {
        await api('/places/' + b.dataset.placeStatus + '/status', {
          method: 'PUT',
          body: JSON.stringify({ status: b.dataset.state }),
        });
        await refreshPlaces();
        status('장소 상태를 변경했습니다.');
      });
    if (b.hasAttribute('data-save-search'))
      busy(b, async () => {
        const p = searchItems[Number(b.dataset.saveSearch)],
          target = groupId;
        const result = await api(`/groups/${target}/places`, {
          method: 'POST',
          body: JSON.stringify({ ...p, status: b.dataset.state }),
        });
        if (groupId !== target) return;
        await refreshPlaces();
        openPlace(result.id);
        status('장소를 저장했습니다.');
      });
    if (b.dataset.media) openMedia(b.dataset.media);
    if (b.dataset.day) {
      calendarDate = b.dataset.day;
      renderCalendar();
    }
    if (b.dataset.event) openEvent(workspace.events.find((x) => x.id === b.dataset.event));
    if (b.dataset.restoreEvent)
      busy(b, async () => {
        const event = workspace.events.find((x) => x.id === b.dataset.restoreEvent);
        await api('/events/' + event.id + '/deleted', {
          method: 'PUT',
          body: JSON.stringify({ deleted: false, version: event.version }),
        });
        await loadCalendar();
        status('일정을 복원했습니다.');
      });
  });
}
