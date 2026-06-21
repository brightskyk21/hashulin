-- 일정에 "종료일" 추가 (여행 등 연속 일정용): Supabase SQL Editor에서 실행.
-- end_date 가 null 이면 단일 일정, 값이 있으면 event_date~end_date 기간 일정.

alter table events
  add column if not exists end_date date;
