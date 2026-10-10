begin;
-- Explicit scope for the original couple's data. Never choose a group by name.
create table public.h_legacy_access (
 source text primary key check(source='original'),
 group_id uuid not null unique references public.h_groups(id)
);
alter table public.h_legacy_access enable row level security;
revoke all on public.h_legacy_access from anon,authenticated;
create function public.h_legacy_archive(target_group uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.h_is_member(target_group) then raise exception 'Access denied' using errcode='42501'; end if;
 if not exists(select 1 from public.h_legacy_access where source='original' and group_id=target_group) then return null; end if;
 return jsonb_build_object(
  'places',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.places p),
  'reviews',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from public.reviews r),
  'place_photos',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.place_photos p),
  'couple_photos',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.couple_photos p),
  'events',(select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) from public.events e)
 );
end;$$;
revoke all on function public.h_legacy_archive(uuid) from public,anon;
grant execute on function public.h_legacy_archive(uuid) to authenticated;
commit;
