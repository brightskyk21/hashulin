-- 일정에 "종료 시간" 추가: Supabase SQL Editor에서 실행.
-- start_time(시작) 은 이미 있고, end_time(종료) 추가.

alter table events
  add column if not exists end_time time;
