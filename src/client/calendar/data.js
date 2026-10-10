async function loadCalendar() {
  const target = groupId,
    version = ++calendarRequest;
  if (!target) return;
  const first = dateObject(calendarMonth + '-01'),
    start = new Date(first);
  start.setDate(1 - first.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 41);
  const future = dateObject(today());
  future.setDate(future.getDate() + 90);
  const ranges = [
    [dateString(start), dateString(end)],
    [today(), dateString(future)],
  ];
  const results = await Promise.all(
    ranges.map(([from, to]) => api(`/groups/${target}/events?from=${from}&to=${to}`)),
  );
  if (target !== groupId || version !== calendarRequest) return;
  workspace.events = [...new Map(results.flat().map((e) => [e.id, e])).values()].sort(
    (a, b) => a.event_date.localeCompare(b.event_date) || a.id.localeCompare(b.id),
  );
  renderCalendar();
}
