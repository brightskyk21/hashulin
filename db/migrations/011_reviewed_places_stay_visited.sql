begin;
-- The place row is the shared lock for status changes and review inserts.
create function public.h_guard_reviewed_place_status() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='wish' and (
  exists(select 1 from public.h_visits v join public.h_reviews r on r.visit_id=v.id and r.group_id=v.group_id where v.place_id=new.id and v.group_id=new.group_id)
  or exists(select 1 from public.reviews r join public.h_legacy_access a on a.group_id=new.group_id where r.place_id=new.legacy_id)
 ) then raise exception 'HAS_PLACE_REVIEWS' using errcode='P0001'; end if;
 return new;
end;$$;
create trigger h_reviewed_place_status before insert or update of status,legacy_id on public.h_places
for each row execute function public.h_guard_reviewed_place_status();

create function public.h_mark_reviewed_place_visited() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='h_reviews' then
  update public.h_places p set status='visited' from public.h_visits v
  where v.id=new.visit_id and v.group_id=new.group_id and p.id=v.place_id and p.group_id=v.group_id;
 else
  update public.h_places p set status='visited' from public.h_legacy_access a
  where p.legacy_id=new.place_id and a.group_id=p.group_id;
 end if;
 return new;
end;$$;
create trigger h_review_marks_visited before insert or update of visit_id,group_id on public.h_reviews
for each row execute function public.h_mark_reviewed_place_visited();
create trigger h_legacy_review_marks_visited before insert or update of place_id on public.reviews
for each row execute function public.h_mark_reviewed_place_visited();
revoke all on function public.h_guard_reviewed_place_status(),public.h_mark_reviewed_place_visited() from public,anon,authenticated;
-- Repair only inconsistent status labels; preserve all reviews, scores and photos.
update public.h_places p set status='visited' where p.status='wish' and (
 exists(select 1 from public.h_visits v join public.h_reviews r on r.visit_id=v.id where v.place_id=p.id and v.group_id=p.group_id)
 or exists(select 1 from public.reviews r join public.h_legacy_access a on a.group_id=p.group_id where r.place_id=p.legacy_id)
);
commit;
