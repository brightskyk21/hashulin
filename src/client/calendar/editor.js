function openEvent(event = null) {
  if (!groupId) return showDialog('#groupDialog');
  editingEvent = event;
  const f = $('#eventForm');
  f.reset();
  f.elements.title.value = event?.title || '';
  f.elements.date.value = event?.event_date || calendarDate;
  f.elements.endDate.value = event?.end_date || '';
  f.elements.startTime.value = event?.start_time?.slice(0, 5) || '';
  f.elements.endTime.value = event?.end_time?.slice(0, 5) || '';
  f.elements.owner.value = event?.owner_label || '모임';
  f.elements.memo.value = event?.memo || '';
  $('#eventLabels').innerHTML = [
    ...new Set([
      '모임',
      ...members.map((m) => m.h_profiles?.display_name),
      ...workspace.events.map((e) => e.owner_label),
    ]),
  ]
    .filter(Boolean)
    .map((n) => `<option value="${esc(n)}"></option>`)
    .join('');
  $('#eventFormTitle').textContent = event ? '일정 수정' : '일정 추가';
  $('#deleteEvent').hidden = !event;
  showDialog('#eventDialog');
}

function initCalendarEditor() {
  $('#addEvent').onclick = () => openEvent();

  $('#eventForm').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      event = editingEvent,
      target = groupId;
    busy(e.submitter, async () => {
      await api(`/groups/${target}/events`, {
        method: 'POST',
        body: JSON.stringify({
          id: event?.id,
          version: event?.version,
          title: f.get('title').trim(),
          date: f.get('date'),
          endDate: f.get('endDate'),
          startTime: f.get('startTime'),
          endTime: f.get('endTime'),
          owner: f.get('owner').trim(),
          memo: f.get('memo').trim(),
        }),
      });
      calendarDate = f.get('date');
      calendarMonth = calendarDate.slice(0, 7);
      $('#eventDialog').close();
      if (target === groupId) await loadCalendar();
      status('일정을 저장했습니다.');
    });
  };

  $('#deleteEvent').onclick = () =>
    busy($('#deleteEvent'), async () => {
      const e = editingEvent;
      await api('/events/' + e.id + '/deleted', {
        method: 'PUT',
        body: JSON.stringify({ deleted: true, version: e.version }),
      });
      $('#eventDialog').close();
      await loadCalendar();
      status('일정을 취소했습니다. 취소된 일정에서 복원할 수 있어요.');
    });
}
