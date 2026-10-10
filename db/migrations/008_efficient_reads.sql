begin;
alter table public.h_media add column thumb_path text check(thumb_path is null or thumb_path=group_id::text||'/'||id::text||'.thumb.webp');
alter policy media_group_read on public.h_media using(public.h_is_member(group_id) and
 (deleted_at is null or uploaded_by=(select auth.uid()) or exists(select 1 from public.h_groups g where g.id=group_id and g.owner_id=(select auth.uid()))));
create index h_media_place_date_idx on public.h_media(place_id,group_id,created_at,id);
create index h_reviews_author_idx on public.h_reviews(author_id,visit_id);
create index h_media_group_cursor_idx on public.h_media(group_id,created_at desc,id desc);
create index h_visits_group_cursor_idx on public.h_visits(group_id,visited_on desc,id desc);
create function public.h_place_review_totals(target_group uuid)
returns table(place_id uuid,review_count bigint,score_sum numeric)
language sql stable security invoker set search_path='' as $$
 select v.place_id,count(r.id),sum(r.score) from public.h_visits v join public.h_reviews r on r.visit_id=v.id
 where v.group_id=target_group group by v.place_id;
$$;
create function public.h_photo_covers(target_group uuid)
returns setof public.h_media language sql stable security invoker set search_path='' as $$
 select distinct on (m.place_id) m.* from public.h_media m where m.group_id=target_group and m.place_id is not null and m.deleted_at is null
 order by m.place_id,m.created_at,m.id;
$$;
revoke all on function public.h_place_review_totals(uuid),public.h_photo_covers(uuid) from public,anon;
grant execute on function public.h_place_review_totals(uuid),public.h_photo_covers(uuid) to authenticated;
commit;
