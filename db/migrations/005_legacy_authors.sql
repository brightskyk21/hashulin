begin;
-- Historical labels are linked only by explicit nomination and account acceptance.
create table public.h_legacy_authors (
 reviewer text primary key,
 group_id uuid not null references public.h_legacy_access(group_id),
 user_id uuid not null references public.h_profiles(id),
 proposed_by uuid not null references public.h_profiles(id),
 proposed_at timestamptz not null default now(),
 accepted_at timestamptz,
 unique(group_id,user_id)
);
create table public.h_legacy_review_versions (
 id bigint generated always as identity primary key,
 review_id uuid not null,
 edited_by uuid not null references auth.users(id),
 edited_at timestamptz not null default now(),
 original jsonb not null
);
alter table public.h_legacy_authors enable row level security;
alter table public.h_legacy_review_versions enable row level security;
revoke all on public.h_legacy_authors,public.h_legacy_review_versions from public,anon,authenticated;
revoke all on sequence public.h_legacy_review_versions_id_seq from public,anon,authenticated;

create function public.h_propose_legacy_author(target_group uuid,legacy_reviewer text,target_user uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.h_groups where id=target_group and owner_id=auth.uid() for update;
 if not found or not public.h_is_member(target_group) then raise exception 'Access denied' using errcode='42501'; end if;
 if not exists(select 1 from public.h_legacy_access where group_id=target_group)
 or not exists(select 1 from public.reviews where reviewer=legacy_reviewer)
 or not exists(select 1 from public.h_group_members where group_id=target_group and user_id=target_user)
 then raise exception 'Invalid member or author' using errcode='22023'; end if;
 if exists(select 1 from public.h_legacy_authors where reviewer=legacy_reviewer and accepted_at is not null)
 then raise exception 'Author already linked' using errcode='22023'; end if;
 insert into public.h_legacy_authors(reviewer,group_id,user_id,proposed_by)
 values(legacy_reviewer,target_group,target_user,auth.uid())
 on conflict(reviewer) do update set user_id=excluded.user_id,proposed_by=excluded.proposed_by,proposed_at=now();
end;$$;

create function public.h_accept_legacy_author(target_group uuid,legacy_reviewer text)
returns void language plpgsql security definer set search_path='' as $$
begin
 -- Same lock order as nomination, so acceptance cannot race a replacement.
 perform 1 from public.h_groups where id=target_group for update;
 if auth.uid() is null or not public.h_is_member(target_group) then raise exception 'Access denied' using errcode='42501'; end if;
 update public.h_legacy_authors set accepted_at=coalesce(accepted_at,now())
 where reviewer=legacy_reviewer and group_id=target_group and user_id=auth.uid();
 if not found then raise exception 'Access denied' using errcode='42501'; end if;
end;$$;

create function public.h_edit_legacy_review(target_review uuid,rating numeric,impression text,expected_score numeric,expected_comment text)
returns void language plpgsql security definer set search_path='' as $$
declare previous public.reviews%rowtype;
begin
 if auth.uid() is null then raise exception 'Access denied' using errcode='42501'; end if;
 select * into previous from public.reviews where id=target_review for update;
 if not found or not exists(select 1 from public.h_legacy_authors l
 where l.reviewer=previous.reviewer and l.user_id=auth.uid() and l.accepted_at is not null
 and public.h_is_member(l.group_id)) then raise exception 'Access denied' using errcode='42501'; end if;
 if rating is null or rating < 1 or rating > 10 or rating <> round(rating,1)
 or impression is null or length(btrim(impression)) not between 1 and 1000
 then raise exception 'Invalid review' using errcode='22023'; end if;
 if previous.score is distinct from expected_score or previous.comment is distinct from expected_comment
 then raise exception 'Review changed; reload before editing' using errcode='40001'; end if;
 if previous.score=rating and previous.comment=btrim(impression) then return; end if;
 insert into public.h_legacy_review_versions(review_id,edited_by,original) values(target_review,auth.uid(),to_jsonb(previous));
 update public.reviews set score=rating,comment=btrim(impression) where id=target_review;
end;$$;
create or replace function public.h_legacy_archive(target_group uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.h_is_member(target_group) then raise exception 'Access denied' using errcode='42501'; end if;
 if not exists(select 1 from public.h_legacy_access where source='original' and group_id=target_group) then return null; end if;
 return jsonb_build_object(
  'authors',(select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from (
   select r.reviewer,count(*) as review_count,l.user_id,l.accepted_at,p.display_name
   from public.reviews r left join public.h_legacy_authors l on l.reviewer=r.reviewer and l.group_id=target_group
   left join public.h_profiles p on p.id=l.user_id group by r.reviewer,l.user_id,l.accepted_at,p.display_name order by r.reviewer
  ) a),
  'places',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.places p),
  'reviews',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from public.reviews r),
  'place_photos',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.place_photos p),
  'couple_photos',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.couple_photos p),
  'events',(select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) from public.events e)
 );
end;$$;

revoke all on function public.h_propose_legacy_author(uuid,text,uuid),public.h_accept_legacy_author(uuid,text),public.h_edit_legacy_review(uuid,numeric,text,numeric,text),public.h_legacy_archive(uuid) from public,anon;
grant execute on function public.h_propose_legacy_author(uuid,text,uuid),public.h_accept_legacy_author(uuid,text),public.h_edit_legacy_review(uuid,numeric,text,numeric,text),public.h_legacy_archive(uuid) to authenticated;
commit;
