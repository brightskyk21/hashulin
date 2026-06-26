-- Supabase SQL Editor에 그대로 붙여넣고 실행하세요.

-- 가게(북마크) 테이블
create table if not exists places (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text,
  address      text,            -- 지번 주소
  road_address text,            -- 도로명 주소
  link         text,            -- 네이버 상세 링크
  lat          double precision not null,
  lng          double precision not null,
  status       text not null default 'visited' check (status in ('visited', 'wish')), -- 방문/위시
  created_at   timestamptz default now()
);

-- 주의: status 같은 컬럼을 나중에 추가하면, 아래 place_with_stats 뷰(p.*)에는
--       자동 반영되지 않으므로 뷰를 반드시 다시 만들어줘야 함 (drop + create).

-- 평가 테이블 (한 가게에 여러 명이 점수 가능)
create table if not exists reviews (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references places(id) on delete cascade,
  reviewer   text not null,
  score      numeric(3,1) not null check (score >= 1 and score <= 10),
  comment    text default '',
  created_at timestamptz default now()
);

-- 가게 + 평균점수/리뷰수 뷰 (지도 마커 색·정렬에 사용)
create or replace view place_with_stats as
select
  p.*,
  coalesce(round(avg(r.score), 1), 0) as avg_score,
  count(r.id)                         as review_count
from places p
left join reviews r on r.place_id = p.id
group by p.id;
