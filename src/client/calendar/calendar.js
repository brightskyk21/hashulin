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
  const end = new Date(start);
  end.setDate(end.getDate() + 41);
  const holidays = new Map(
    holidaysBetween(dateString(start), dateString(end)).map((holiday) => [
      holiday.event_date,
      holiday,
    ]),
  );
  $('#monthTitle').textContent = first.getFullYear() + '년 ' + (first.getMonth() + 1) + '월';
  $('#holidayCoverage').hidden = holidaysAvailable(first.getFullYear());
  $('#monthGrid').innerHTML = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const value = dateString(d),
      items = eventsOn(value),
      holiday = holidays.get(value);
    return `<button class="month-day ${holiday || d.getDay() === 0 ? 'holiday' : ''} ${value.slice(0, 7) !== calendarMonth ? 'outside' : ''} ${value === today() ? 'today' : ''} ${value === calendarDate ? 'selected' : ''}" data-day="${value}" aria-label="${value}${holiday ? ' ' + esc(holiday.title) : ''} 일정 ${items.length}개" aria-pressed="${value === calendarDate}"><span>${d.getDate()}</span><span class="day-holiday" aria-hidden="true">${holiday ? esc(holiday.title.startsWith('대체공휴일') ? '대체공휴일' : holiday.title) : ''}</span><span class="day-event-dots" aria-hidden="true">${items
      .slice(0, 2)
      .map((e) => `<small>${esc(e.title)}</small>`)
      .join('')}${items.length > 2 ? `<em>+${items.length - 2}</em>` : ''}</span></button>`;
  }).join('');
  $('#selectedDayTitle').textContent = calendarDate;
  const day = eventsOn(calendarDate);
  const dayHolidays = holidaysBetween(calendarDate, calendarDate);
  $('#dayEvents').innerHTML =
    day.length || dayHolidays.length
      ? dayHolidays.map(holidayItem).join('') + day.map((e) => eventItem(e)).join('')
      : '<p class="note">등록된 일정이 없습니다.</p>';
  const future = dateObject(today());
  future.setDate(future.getDate() + 90);
  const upcoming = calendarAgenda(workspace.events, today(), dateString(future), cancelledEvents);
  $('#showCancelled').textContent = cancelledEvents ? '다가오는 일정' : '취소된 일정';
  $('#agendaTitle').textContent = cancelledEvents ? '취소된 일정' : '다가오는 일정';
  $('#upcomingEvents').innerHTML = upcoming.length
    ? upcoming.map((e) => (e.holiday ? holidayItem(e) : eventItem(e, cancelledEvents))).join('')
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
