-- 사진 기능: Supabase SQL Editor에서 실행.
-- (먼저 Storage에서 'photos' 라는 public 버킷을 만들어야 함)

-- 가게(식당) 사진
create table if not exists place_photos (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references places(id) on delete cascade,
  url        text not null,   -- 공개 URL
  path       text not null,   -- 스토리지 경로(삭제용)
  created_at timestamptz default now()
);

-- 홈 커플 사진
create table if not exists couple_photos (
  id         uuid primary key default gen_random_uuid(),
  url        text not null,
  path       text not null,
  caption    text default '',
  created_at timestamptz default now()
);
