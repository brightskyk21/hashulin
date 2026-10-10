function holidaysAvailable(year) {
  return Object.hasOwn(koreanHolidayDates, year);
}

function holidaysBetween(from, to) {
  const days = new Map();
  for (const [year, dates] of Object.entries(koreanHolidayDates)) {
    for (const [day, name] of dates) {
      const date = `${year}-${day}`;
      if (date < from || date > to) continue;
      if (!days.has(date)) days.set(date, []);
      days.get(date).push(name);
    }
  }
  return [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, names]) => ({
      holiday: true,
      event_date: date,
      title: names.join(' · '),
    }));
}

function holidayItem(holiday) {
  return `<div class="holiday-item"><div><span class="holiday-label">공휴일</span><strong>${esc(holiday.title)}</strong></div><time datetime="${holiday.event_date}">${holiday.event_date}</time></div>`;
}

function calendarAgenda(events, from, to, cancelled) {
  if (cancelled) return events.filter((event) => event.deleted_at);
  return [
    ...events.filter(
      (event) =>
        !event.deleted_at && (event.end_date || event.event_date) >= from && event.event_date <= to,
    ),
    ...holidaysBetween(from, to),
  ].sort(
    (a, b) => a.event_date.localeCompare(b.event_date) || Number(!!b.holiday) - Number(!!a.holiday),
  );
}
