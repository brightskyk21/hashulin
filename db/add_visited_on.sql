-- 리뷰에 "방문 날짜" 추가: Supabase SQL Editor에서 실행하세요.
-- 같은 식당을 여러 번 방문한 기록을 날짜별로 남기기 위함.

alter table reviews
  add column if not exists visited_on date not null default current_date;
