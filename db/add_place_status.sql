-- 가게 상태(방문/가고싶음) 추가: Supabase SQL Editor에서 실행.
-- visited: 방문해서 평가하는 가게 / wish: 가고싶은 곳(위시)

alter table places
  add column if not exists status text not null default 'visited'
  check (status in ('visited', 'wish'));
