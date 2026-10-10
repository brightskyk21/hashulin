begin;
alter table public.h_reviews add column version integer not null default 1;
create table public.h_membership_changes (
 id bigint generated always as identity primary key,
 group_id uuid not null references public.h_groups(id),
 user_id uuid not null references public.h_profiles(id),
 actor_id uuid not null references public.h_profiles(id),
 action text not null check(action in ('leave','remove')),
 changed_at timestamptz not null default now()
);
alter table public.h_membership_changes enable row level security;
revoke all on public.h_membership_changes from public,anon,authenticated;
revoke all on sequence public.h_membership_changes_id_seq from public,anon,authenticated;

create function public.h_remove_group_member(target_group uuid,target_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); owner uuid;
begin
 select owner_id into owner from public.h_groups where id=target_group for update;
 if actor is null or owner is null or not public.h_is_member(target_group)
 or (actor<>target_user and actor<>owner) then raise exception 'Access denied' using errcode='42501'; end if;
 if target_user is null or target_user=owner then raise exception 'Owner cannot leave' using errcode='22023'; end if;
 delete from public.h_group_members where group_id=target_group and user_id=target_user;
 if not found then return; end if;
 -- An old, unused link must not silently undo a removal.
 update public.h_group_invites set revoked_at=now() where group_id=target_group and used_at is null and revoked_at is null;
 insert into public.h_membership_changes(group_id,user_id,actor_id,action)
 values(target_group,target_user,actor,case when actor=target_user then 'leave' else 'remove' end);
 -- Contributions, author links and media stay attached to their original author.
end;$$;

create or replace function public.h_join_group(invite_token uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); invitation public.h_group_invites; g uuid;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not exists(select 1 from public.h_profiles where id=actor) then raise exception 'Profile required' using errcode='22023'; end if;
 select group_id into g from public.h_group_invites where token=invite_token;
 if g is null then raise exception 'Invalid invite' using errcode='22023'; end if;
 -- Same lock order as issuance, revocation and membership removal.
 perform 1 from public.h_groups where id=g for update;
 select * into invitation from public.h_group_invites where token=invite_token for update;
 if exists(select 1 from public.h_group_members where group_id=g and user_id=actor) then return g; end if;
 if invitation.used_at is not null or invitation.revoked_at is not null or invitation.expires_at<=now() then
 raise exception 'Invite expired or invalid' using errcode='22023'; end if;
 insert into public.h_group_members(group_id,user_id) values(g,actor);
 update public.h_group_invites set used_at=now(),used_by=actor where token=invite_token;
 return g;
end;$$;

create function public.h_review_visit(target_visit uuid,rating numeric,impression text,expected_version integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); g uuid; previous public.h_reviews; result uuid;
begin
 select group_id into g from public.h_visits where id=target_visit;
 if actor is null or g is null then raise exception 'Access denied' using errcode='42501'; end if;
 perform 1 from public.h_group_members where group_id=g and user_id=actor for key share;
 if not found then raise exception 'Access denied' using errcode='42501'; end if;
 -- Serialize inserts too: there may not be a review row to lock yet.
 perform 1 from public.h_visits where id=target_visit for update;
 if rating is null or rating<1 or rating>10 or rating<>round(rating,1) or impression is null or char_length(btrim(impression)) not between 1 and 1000 then
 raise exception 'Invalid review' using errcode='22023'; end if;
 select * into previous from public.h_reviews where visit_id=target_visit and author_id=actor for update;
 if previous.id is null then
  if expected_version is not null then raise exception 'Changed review' using errcode='40001'; end if;
  insert into public.h_reviews(group_id,visit_id,author_id,score,comment) values(g,target_visit,actor,rating,btrim(impression)) returning id into result;
 else
  -- Identical network retries are harmless; create-only requests never overwrite.
  if previous.score=rating and previous.comment=btrim(impression) then return previous.id; end if;
  if expected_version is null or previous.version<>expected_version then raise exception 'Changed review' using errcode='40001'; end if;
  insert into public.h_content_history(kind,row_id,actor,original) values('review',previous.id,actor,to_jsonb(previous));
  update public.h_reviews set score=rating,comment=btrim(impression),version=version+1,updated_at=clock_timestamp() where id=previous.id returning id into result;
 end if;
 return result;
end;$$;
-- Existing record-creation functions keep their signatures but cannot overwrite a review.
create or replace function public.h_review_visit(target_visit uuid,rating numeric,impression text) returns uuid
language sql security invoker set search_path='' as $$
 select public.h_review_visit(target_visit,rating,impression,null::integer);
$$;

-- Only the server may finalize a normalized Storage upload. Check and insert atomically.
create function public.h_finalize_photo(target_photo uuid,target_group uuid,target_place uuid,target_user uuid,description text) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.h_group_members where group_id=target_group and user_id=target_user for key share;
 if not found then raise exception 'Access denied' using errcode='42501'; end if;
 insert into public.h_media(id,group_id,place_id,uploaded_by,path,caption)
 values(target_photo,target_group,target_place,target_user,target_group::text||'/'||target_photo::text||'.webp',description);
 return target_photo;
end;$$;
revoke all on function public.h_remove_group_member(uuid,uuid),public.h_review_visit(uuid,numeric,text,integer) from public,anon;
grant execute on function public.h_remove_group_member(uuid,uuid),public.h_review_visit(uuid,numeric,text,integer) to authenticated;
revoke all on function public.h_finalize_photo(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.h_finalize_photo(uuid,uuid,uuid,uuid,text) to service_role;
commit;
