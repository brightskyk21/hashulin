-- 소원권 사용 기록: Supabase SQL Editor에서 실행하세요.
-- 잔액 = 승인받은 소원권 수 − 사용한 수

create table if not exists wish_uses (
  id          uuid primary key default gen_random_uuid(),
  user_name   text not null check (user_name in ('하진', '민혁')),  -- 쓴 사람
  used_on     date not null default current_date,                    -- 사용 날짜
  description text not null,                                         -- 어디에/무엇에
  created_at  timestamptz default now()
);
