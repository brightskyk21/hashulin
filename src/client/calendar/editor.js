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
  f.elements.allDay.checked = !f.elements.startTime.value && !f.elements.endTime.value;
  $('#eventGroupName').textContent = groups.find((group) => group.id === groupId)?.name || '';
  syncEventInputs();
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

function syncEventInputs() {
  const f = $('#eventForm');
  for (const name of ['startTime', 'endTime']) {
    const input = f.elements[name];
    input.disabled = f.elements.allDay.checked;
    input.closest('.event-time-picker').hidden = input.disabled;
  }
  f.querySelectorAll('[data-event-value]').forEach((label) => {
    const name = label.dataset.eventValue;
    const value = f.elements[name].value;
    const isDate = name === 'date' || name === 'endDate';
    label.textContent = value
      ? isDate
        ? value.slice(2).replaceAll('-', '. ') + '.'
        : value
      : name === 'endDate'
        ? '같은 날'
        : isDate
          ? '날짜 선택'
          : '시간 선택';
    label.classList.toggle('is-empty', !value);
  });
}

function initCalendarEditor() {
  $('#addEvent').onclick = () => openEvent();
  $('#eventForm').addEventListener('input', syncEventInputs);
  $('#eventForm').addEventListener('change', syncEventInputs);
  $('#eventForm')
    .querySelectorAll('.event-picker input')
    .forEach((input) => {
      input.addEventListener('click', () => {
        // Keep the native date/time picker and keyboard editing on every platform.
        try {
          input.showPicker?.();
        } catch {
          /* Native input remains editable. */
        }
      });
    });

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
          startTime: f.get('startTime') || '',
          endTime: f.get('endTime') || '',
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
