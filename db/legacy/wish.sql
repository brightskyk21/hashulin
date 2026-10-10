-- 소원권 대장: Supabase SQL Editor에 붙여넣고 실행하세요.

create table if not exists wish_tickets (
  id         uuid primary key default gen_random_uuid(),
  owner      text not null check (owner in ('하진', '민혁')),  -- 소원권 받을 사람
  reason     text not null,                                    -- 획득 사유
  status     text not null default 'pending'
             check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now(),
  decided_at timestamptz                                       -- 컨펌/거절된 시각
);
