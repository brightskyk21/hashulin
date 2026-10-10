-- 우리 일정(캘린더): Supabase SQL Editor에서 실행하세요.

create table if not exists events (
  id         uuid primary key default gen_random_uuid(),
  owner      text not null check (owner in ('민혁', '하진', '데이트')),  -- 누구 일정
  title      text not null,
  event_date date not null,
  start_time time,                -- 선택 (없으면 종일)
  memo       text default '',
  created_at timestamptz default now()
);

create index if not exists events_date_idx on events (event_date);
