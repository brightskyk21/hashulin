const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(events = []) {
  const elements = {};
  const ctx = vm.createContext({
    workspace: { events },
    calendarMonth: '2026-10',
    calendarDate: '2026-10-05',
    cancelledEvents: false,
    $: (id) => (elements[id] ||= {}),
    esc: (value) =>
      String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
  });
  for (const file of [
    'shared/dates.js',
    'calendar/holiday-dates.js',
    'calendar/holidays.js',
    'calendar/calendar.js',
  ]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/client', file), 'utf8'), ctx);
  }
  ctx.today = () => '2026-10-01';
  return { ctx, elements };
}

test('Korean holidays include lunar days, substitutes and announced exceptions', () => {
  const { ctx } = setup();
  const names = (date) =>
    ctx
      .holidaysBetween(date, date)
      .map((h) => h.title)
      .join();
  assert.match(names('2025-01-27'), /임시공휴일/);
  assert.match(names('2025-06-03'), /대통령선거/);
  assert.equal(names('2025-05-01'), '');
  assert.equal(names('2025-07-17'), '');
  assert.equal(names('2026-05-01'), '노동절');
  assert.equal(names('2026-07-17'), '제헌절');
  assert.equal(ctx.holidaysBetween('2026-02-16', '2026-02-18').length, 3);
  assert.match(names('2026-05-25'), /대체공휴일/);
  assert.match(names('2026-06-03'), /지방선거/);
  assert.equal(names('2026-06-08'), '', 'Saturday Memorial Day has no substitute');
  assert.equal(names('2026-09-28'), '', 'Chuseok Saturday alone has no substitute');
  assert.match(names('2027-02-09'), /대체공휴일\(설날\)/);
  assert.match(names('2027-05-03'), /대체공휴일\(노동절\)/);
  assert.match(names('2027-07-19'), /대체공휴일\(제헌절\)/);
  assert.match(names('2028-04-12'), /국회의원선거/);
});

test('overlapping holidays merge without losing names; ranges include year boundaries', () => {
  const { ctx } = setup();
  const sameDay = ctx.holidaysBetween('2025-05-05', '2025-05-05');
  assert.equal(sameDay.length, 1);
  assert.match(sameDay[0].title, /어린이날/);
  assert.match(sameDay[0].title, /부처님오신날/);
  assert.deepEqual(
    Array.from(ctx.holidaysBetween('2026-12-25', '2027-01-01'), (h) => h.event_date),
    ['2026-12-25', '2027-01-01'],
  );
  assert.equal(ctx.holidaysAvailable(2028), true);
  assert.equal(ctx.holidaysAvailable(2029), false);
});

test('agenda merges holidays with active events without modifying events or cancelled view', () => {
  const events = [
    { id: 'later', event_date: '2026-10-09', title: '저녁' },
    { id: 'ongoing', event_date: '2026-09-30', end_date: '2026-10-02', title: '여행' },
    { id: 'cancelled', event_date: '2026-10-03', deleted_at: 'yes' },
    { id: 'outside', event_date: '2027-02-01' },
  ];
  const { ctx } = setup(events);
  const original = JSON.stringify(events);
  const agenda = ctx.calendarAgenda(events, '2026-10-01', '2026-10-09', false);
  assert.deepEqual(
    Array.from(agenda, (e) => e.id || e.title),
    ['ongoing', '개천절', '대체공휴일(개천절)', '한글날', 'later'],
  );
  assert.deepEqual(
    Array.from(ctx.calendarAgenda(events, '2026-10-01', '2026-10-09', true), (e) => e.id),
    ['cancelled'],
  );
  assert.equal(JSON.stringify(events), original);
});

test('calendar renders named holidays accessibly, preserves event actions and reports unsupported years', () => {
  const { ctx, elements } = setup([
    { id: 'meeting', event_date: '2026-10-05', title: '점심', owner_label: '민혁' },
  ]);
  ctx.renderCalendar();
  assert.match(
    elements['#monthGrid'].innerHTML,
    /aria-label="2026-10-05 대체공휴일\(개천절\) 일정 1개"/,
  );
  assert.match(elements['#dayEvents'].innerHTML, /holiday-item/);
  assert.match(elements['#dayEvents'].innerHTML, /data-event="meeting"/);
  assert.doesNotMatch(
    ctx.holidayItem({ event_date: '2026-10-05', title: '대체공휴일' }),
    /button|data-event|data-restore-event/,
  );
  assert.equal(elements['#holidayCoverage'].hidden, true);
  ctx.cancelledEvents = true;
  ctx.renderCalendar();
  assert.doesNotMatch(elements['#upcomingEvents'].innerHTML, /holiday-item/);
  ctx.calendarMonth = '2029-01';
  ctx.renderCalendar();
  assert.equal(elements['#holidayCoverage'].hidden, false);
});
