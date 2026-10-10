function eventsOn(date) {
  return workspace.events.filter(
    (e) => !e.deleted_at && e.event_date <= date && (e.end_date || e.event_date) >= date,
  );
}

function eventItem(e, restore = false) {
  return `<button class="event-item" ${restore ? 'data-restore-event' : 'data-event'}="${e.id}"><span class="event-owner">${esc(e.owner_label)}</span><strong>${esc(e.title)}</strong><small>${esc(e.event_date)}${e.end_date && e.end_date !== e.event_date ? ' ~ ' + esc(e.end_date) : ''} · ${e.start_time ? esc(e.start_time.slice(0, 5)) + (e.end_time ? '–' + esc(e.end_time.slice(0, 5)) : '') : '종일'}${restore ? ' · 눌러서 복원' : ''}</small>${e.memo ? `<p>${esc(e.memo)}</p>` : ''}</button>`;
}

function renderCalendar() {
  const first = dateObject(calendarMonth + '-01'),
    start = new Date(first);
  start.setDate(1 - first.getDay());
  $('#monthTitle').textContent = first.getFullYear() + '년 ' + (first.getMonth() + 1) + '월';
  $('#monthGrid').innerHTML = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const value = dateString(d),
      items = eventsOn(value);
    return `<button class="month-day ${value.slice(0, 7) !== calendarMonth ? 'outside' : ''} ${value === today() ? 'today' : ''} ${value === calendarDate ? 'selected' : ''}" data-day="${value}" aria-label="${value} 일정 ${items.length}개" aria-pressed="${value === calendarDate}"><span>${d.getDate()}</span>${items
      .slice(0, 2)
      .map((e) => `<small>${esc(e.title)}</small>`)
      .join('')}${items.length > 2 ? `<em>+${items.length - 2}</em>` : ''}</button>`;
  }).join('');
  $('#selectedDayTitle').textContent = calendarDate;
  const day = eventsOn(calendarDate);
  $('#dayEvents').innerHTML = day.length
    ? day.map((e) => eventItem(e)).join('')
    : '<p class="note">등록된 일정이 없습니다.</p>';
  const upcoming = cancelledEvents
    ? workspace.events.filter((e) => e.deleted_at)
    : workspace.events.filter((e) => !e.deleted_at && (e.end_date || e.event_date) >= today());
  $('#showCancelled').textContent = cancelledEvents ? '다가오는 일정' : '취소된 일정';
  $('#agendaTitle').textContent = cancelledEvents ? '취소된 일정' : '다가오는 일정';
  $('#upcomingEvents').innerHTML = upcoming.length
    ? upcoming.map((e) => eventItem(e, cancelledEvents)).join('')
    : `<p class="note">${cancelledEvents ? '취소된 일정이 없습니다.' : '예정된 일정이 없습니다.'}</p>`;
}

function moveMonth(offset) {
  const date = dateObject(calendarMonth + '-01');
  date.setMonth(date.getMonth() + offset);
  calendarMonth = dateString(date).slice(0, 7);
  loadCalendar().catch((e) => status(e.message));
}

function initCalendarCalendarControls() {
  $('#previousMonth').onclick = () => moveMonth(-1);
}

function initCalendarCalendarActions() {
  $('#calendarToday').onclick = () => {
    calendarDate = today();
    calendarMonth = calendarDate.slice(0, 7);
    loadCalendar().catch((e) => status(e.message));
  };

  $('#showCancelled').onclick = () => {
    cancelledEvents = !cancelledEvents;
    renderCalendar();
  };
}
