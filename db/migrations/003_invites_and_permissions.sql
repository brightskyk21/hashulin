begin;
-- Supabase default privileges can grant anon directly, independently of PUBLIC.
revoke all on function public.h_is_member(uuid),public.h_create_group(text),public.h_create_invite(uuid),public.h_join_group(uuid),public.h_record_visit(uuid,text,text,date,numeric,text),public.h_review_visit(uuid,numeric,text) from anon,public;
alter view public.place_with_stats set (security_invoker=true);
revoke execute on function public.rls_auto_enable() from anon,authenticated,public;
alter table public.h_group_invites add column revoked_at timestamptz;
create index h_group_invites_group_idx on public.h_group_invites(group_id,created_at desc);
create or replace function public.h_create_invite(target_group uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result uuid;
begin
 -- Lock the group so concurrent issues cannot create two active links.
 perform 1 from public.h_groups where id=target_group and owner_id=actor for update;
 if not found then raise exception 'Only owner may invite' using errcode='42501'; end if;
 update public.h_group_invites set revoked_at=now() where group_id=target_group and used_at is null and revoked_at is null;
 insert into public.h_group_invites(group_id,created_by) values(target_group,actor) returning token into result;
 return result;
end;$$;
create or replace function public.h_join_group(invite_token uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); invitation public.h_group_invites;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not exists(select 1 from public.h_profiles where id=actor) then raise exception 'Profile required' using errcode='22023'; end if;
 select * into invitation from public.h_group_invites where token=invite_token for update;
 if invitation.token is null then raise exception 'Invalid invite' using errcode='22023'; end if;
 -- A retry from an existing member is harmless, even after their invite was consumed.
 if exists(select 1 from public.h_group_members where group_id=invitation.group_id and user_id=actor) then return invitation.group_id; end if;
 if invitation.used_at is not null or invitation.revoked_at is not null or invitation.expires_at<=now() then raise exception 'Invite expired or invalid' using errcode='22023'; end if;
 insert into public.h_group_members(group_id,user_id) values(invitation.group_id,actor) on conflict do nothing;
 update public.h_group_invites set used_at=now(),used_by=actor where token=invite_token;
 return invitation.group_id;
end;$$;
create function public.h_revoke_invites(target_group uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.h_groups where id=target_group and owner_id=auth.uid() for update;
 if not found then raise exception 'Only owner may revoke' using errcode='42501'; end if;
 update public.h_group_invites set revoked_at=now() where group_id=target_group and used_at is null and revoked_at is null;
end;$$;
-- No records, member list or identities are disclosed before accepting an invitation.
create function public.h_preview_invite(invite_token uuid) returns table(group_name text,expires_at timestamptz,already_member boolean)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 return query select g.name,i.expires_at,public.h_is_member(g.id)
 from public.h_group_invites i join public.h_groups g on g.id=i.group_id
 where i.token=invite_token and (public.h_is_member(g.id) or (i.used_at is null and i.revoked_at is null and i.expires_at>now()));
end;$$;
revoke all on function public.h_revoke_invites(uuid),public.h_preview_invite(uuid) from public,anon;
grant execute on function public.h_revoke_invites(uuid),public.h_preview_invite(uuid) to authenticated;
commit;
