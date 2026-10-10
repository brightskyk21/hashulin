begin;
-- Old photos stay place-based: no date or visit is inferred during migration.
alter table public.h_visits add constraint h_visits_photo_scope_key unique(id,group_id,place_id);
alter table public.h_media add column visit_id uuid, add column upload_key uuid;
alter table public.h_media add constraint h_media_visit_scope_fkey
 foreign key(visit_id,group_id,place_id) references public.h_visits(id,group_id,place_id);
alter table public.h_media add constraint h_media_visit_requires_place check(visit_id is null or place_id is not null);
create unique index h_media_upload_retry_idx on public.h_media(group_id,uploaded_by,upload_key) where upload_key is not null;
create index h_media_visit_cover_idx on public.h_media(visit_id,created_at,id) where deleted_at is null;

create function public.h_finalize_visit_photo(target_photo uuid,target_group uuid,target_place uuid,target_user uuid,description text,target_visit uuid,request_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; saved public.h_media;
begin
 perform 1 from public.h_group_members where group_id=target_group and user_id=target_user for key share;
 if not found then raise exception 'Access denied' using errcode='42501'; end if;
 if request_key is null then raise exception 'Upload key required' using errcode='22023'; end if;
 if target_visit is not null and not exists(select 1 from public.h_visits where id=target_visit and group_id=target_group and place_id=target_place)
 then raise exception 'Invalid visit' using errcode='22023'; end if;
 insert into public.h_media(id,group_id,place_id,uploaded_by,path,caption,visit_id,upload_key)
 values(target_photo,target_group,target_place,target_user,target_group::text||'/'||target_photo::text||'.webp',description,target_visit,request_key)
 on conflict(group_id,uploaded_by,upload_key) where upload_key is not null do nothing returning id into result;
 if result is null then
  select * into saved from public.h_media where group_id=target_group and uploaded_by=target_user and upload_key=request_key;
  if saved.place_id is distinct from target_place or saved.visit_id is distinct from target_visit or saved.caption is distinct from description or saved.deleted_at is not null
  then raise exception 'Changed upload' using errcode='40001'; end if;
  result:=saved.id;
 end if;
 return result;
end;$$;
revoke all on function public.h_finalize_visit_photo(uuid,uuid,uuid,uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.h_finalize_visit_photo(uuid,uuid,uuid,uuid,text,uuid,uuid) to service_role;

create function public.h_visit_photo_covers(target_visits uuid[])
returns setof public.h_media language sql stable security invoker set search_path='' as $$
 select distinct on (m.visit_id) m.* from public.h_media m
 where cardinality(target_visits)<=48 and m.visit_id=any(target_visits) and m.deleted_at is null
 order by m.visit_id,m.created_at,m.id;
$$;
revoke all on function public.h_visit_photo_covers(uuid[]) from public,anon;
grant execute on function public.h_visit_photo_covers(uuid[]) to authenticated;
commit;
