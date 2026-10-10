-- 2026-10-10 Supabase에 적용 완료. 재실행하지 않는다.
-- 기존 places/reviews/photos/events를 변경하거나 삭제하지 않는다.
begin;
create table public.h_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  created_at timestamptz not null default now()
);
create table public.h_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  owner_id uuid not null references public.h_profiles(id),
  created_at timestamptz not null default now()
);
create table public.h_group_members (
  group_id uuid not null references public.h_groups(id) on delete cascade,
  user_id uuid not null references public.h_profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index h_group_members_user_idx on public.h_group_members(user_id, group_id);
create table public.h_group_invites (
  token uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.h_groups(id) on delete cascade,
  created_by uuid not null references public.h_profiles(id),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references public.h_profiles(id),
  created_at timestamptz not null default now()
);

-- SECURITY DEFINER helper avoids recursive membership RLS. Fixed search_path.
create function public.h_is_member(target_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.h_group_members
    where group_id = target_group and user_id = (select auth.uid()));
$$;
revoke all on function public.h_is_member(uuid) from public;
grant execute on function public.h_is_member(uuid) to authenticated;

alter table public.h_profiles enable row level security;
alter table public.h_groups enable row level security;
alter table public.h_group_members enable row level security;
alter table public.h_group_invites enable row level security;
revoke all on public.h_profiles, public.h_groups, public.h_group_members, public.h_group_invites from anon, authenticated;
grant select on public.h_profiles, public.h_groups, public.h_group_members to authenticated;
grant insert(id, display_name), update(id, display_name) on public.h_profiles to authenticated;
create policy profiles_read on public.h_profiles for select to authenticated using (
  id = (select auth.uid()) or exists (
    select 1 from public.h_group_members m where m.user_id = h_profiles.id and public.h_is_member(m.group_id)
  )
);
create policy profiles_insert_self on public.h_profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_self on public.h_profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy groups_read on public.h_groups for select to authenticated using (public.h_is_member(id));
create policy members_read on public.h_group_members for select to authenticated using (public.h_is_member(group_id));
-- No direct grants or policies for invite tokens. They are returned only by owner RPC.

create function public.h_create_group(group_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists(select 1 from public.h_profiles where id = actor) then
    raise exception 'Profile required' using errcode = '22023';
  end if;
  insert into public.h_groups(name, owner_id) values(btrim(group_name), actor) returning id into result;
  insert into public.h_group_members(group_id, user_id) values(result, actor);
  return result;
end;
$$;

create function public.h_create_invite(target_group uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result uuid;
begin
  if actor is null or not exists(select 1 from public.h_groups where id = target_group and owner_id = actor) then
    raise exception 'Only the owner may invite members' using errcode = '42501';
  end if;
  insert into public.h_group_invites(group_id, created_by) values(target_group, actor) returning token into result;
  return result;
end;
$$;

create function public.h_join_group(invite_token uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); invitation public.h_group_invites;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists(select 1 from public.h_profiles where id = actor) then
    raise exception 'Profile required' using errcode = '22023';
  end if;
  select * into invitation from public.h_group_invites where token = invite_token for update;
  if invitation.token is null or invitation.used_at is not null or invitation.expires_at <= now() then
    raise exception 'Invite expired or invalid' using errcode = '22023';
  end if;
  if exists(select 1 from public.h_group_members where group_id = invitation.group_id and user_id = actor) then
    return invitation.group_id;
  end if;
  insert into public.h_group_members(group_id, user_id) values(invitation.group_id, actor);
  update public.h_group_invites set used_at = now(), used_by = actor where token = invite_token;
  return invitation.group_id;
end;
$$;
revoke all on function public.h_create_group(text), public.h_create_invite(uuid), public.h_join_group(uuid) from public;
grant execute on function public.h_create_group(text), public.h_create_invite(uuid), public.h_join_group(uuid) to authenticated;
commit;
