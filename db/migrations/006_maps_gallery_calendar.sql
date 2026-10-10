begin;
alter table public.h_places add column legacy_id uuid unique, add column lat double precision, add column lng double precision,
 add column road_address text not null default '', add column category text not null default '',
 add column status text not null default 'visited' check(status in ('visited','wish'));
alter table public.h_places add constraint h_places_coordinates check((lat is null and lng is null) or (lat between -90 and 90 and lng between -180 and 180));
insert into public.h_places(id,group_id,legacy_id,name,address,road_address,category,lat,lng,status,created_at)
select p.id,a.group_id,p.id,p.name,coalesce(p.address,''),coalesce(p.road_address,''),coalesce(p.category,''),p.lat,p.lng,p.status,coalesce(p.created_at,now())
from public.places p cross join public.h_legacy_access a where a.source='original';

create table public.h_events(
 id uuid primary key default gen_random_uuid(),group_id uuid not null references public.h_groups(id),legacy_id uuid unique,
 title text not null check(length(btrim(title)) between 1 and 100),event_date date not null,end_date date,
 start_time time,end_time time,owner_label text not null default '모임' check(length(owner_label) between 1 and 40),
 memo text not null default '' check(length(memo)<=2000),created_by uuid references public.h_profiles(id),
 created_at timestamptz not null default now(),version integer not null default 1,deleted_at timestamptz,
 check(end_date is null or end_date>=event_date),check(end_time is null or start_time is not null),
 check(end_time is null or coalesce(end_date,event_date)>event_date or end_time>=start_time)
);
insert into public.h_events(id,group_id,legacy_id,title,event_date,end_date,start_time,end_time,owner_label,memo,created_at)
select e.id,a.group_id,e.id,e.title,e.event_date,e.end_date,e.start_time,e.end_time,e.owner,coalesce(e.memo,''),coalesce(e.created_at,now())
from public.events e cross join public.h_legacy_access a where a.source='original';

create table public.h_media(
 id uuid primary key default gen_random_uuid(),group_id uuid not null references public.h_groups(id),place_id uuid,
 legacy_kind text check(legacy_kind in ('place','couple')),legacy_id uuid,uploaded_by uuid references public.h_profiles(id),
 path text not null unique,caption text not null default '' check(length(caption)<=500),
 created_at timestamptz not null default now(),version integer not null default 1,deleted_at timestamptz,
 foreign key(place_id,group_id) references public.h_places(id,group_id),unique(legacy_kind,legacy_id),
 check(path=group_id::text||'/'||id::text||'.webp')
);
create table public.h_content_history(
 id bigint generated always as identity primary key,kind text not null,row_id uuid not null,actor uuid not null,
 changed_at timestamptz not null default now(),original jsonb not null
);
create index h_events_group_date on public.h_events(group_id,event_date);
create index h_media_group_date on public.h_media(group_id,created_at desc);
alter table public.h_events enable row level security;
alter table public.h_media enable row level security;
alter table public.h_content_history enable row level security;
revoke all on public.h_events,public.h_media,public.h_content_history from public,anon,authenticated;
revoke all on sequence public.h_content_history_id_seq from public,anon,authenticated;
grant select on public.h_events,public.h_media to authenticated;
create policy events_group_read on public.h_events for select to authenticated using(public.h_is_member(group_id));
create policy media_group_read on public.h_media for select to authenticated using(public.h_is_member(group_id) and
 (deleted_at is null or uploaded_by=auth.uid() or exists(select 1 from public.h_groups g where g.id=group_id and g.owner_id=auth.uid())));

create function public.h_save_map_place(target_group uuid,place_name text,place_address text,road text,category_name text,latitude double precision,longitude double precision,place_status text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null or not public.h_is_member(target_group) then raise exception 'Access denied' using errcode='42501'; end if;
 if latitude is null or longitude is null or latitude not between -90 and 90 or longitude not between -180 and 180
 or place_status is null or place_status not in ('visited','wish') or length(coalesce(road,''))>300 or length(coalesce(category_name,''))>200
 then raise exception 'Invalid place' using errcode='22023'; end if;
 insert into public.h_places(group_id,name,address,road_address,category,lat,lng,status)
 values(target_group,btrim(place_name),btrim(coalesce(place_address,'')),coalesce(road,''),coalesce(category_name,''),latitude,longitude,place_status)
 on conflict(group_id,name,address) do update set road_address=excluded.road_address,category=excluded.category,lat=excluded.lat,lng=excluded.lng,status=excluded.status returning id into result;
 return result;
end;$$;
create function public.h_set_place_status(target_place uuid,place_status text) returns void
language plpgsql security definer set search_path='' as $$
declare g uuid;
begin
 select group_id into g from public.h_places where id=target_place;
 if auth.uid() is null or g is null or not public.h_is_member(g) then raise exception 'Access denied' using errcode='42501'; end if;
 if place_status is null or place_status not in ('visited','wish') then raise exception 'Invalid status' using errcode='22023'; end if;
 update public.h_places set status=place_status where id=target_place;
end;$$;
create function public.h_record_at_place(target_place uuid,visit_date date,rating numeric,impression text) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.h_places%rowtype; result uuid;
begin
 select * into p from public.h_places where id=target_place;
 if auth.uid() is null or p.id is null or not public.h_is_member(p.group_id) then raise exception 'Access denied' using errcode='42501'; end if;
 result:=public.h_record_visit(p.group_id,p.name,p.address,visit_date,rating,impression);
 update public.h_places set status='visited' where id=p.id;
 return result;
end;$$;

create function public.h_save_event(target_group uuid,target_event uuid,event_title text,start_date date,finish_date date,starts time,ends time,label text,description text,expected_version integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare previous public.h_events%rowtype; result uuid;
begin
 if auth.uid() is null or not public.h_is_member(target_group) then raise exception 'Access denied' using errcode='42501'; end if;
 if target_event is null then
 insert into public.h_events(group_id,title,event_date,end_date,start_time,end_time,owner_label,memo,created_by)
 values(target_group,btrim(event_title),start_date,finish_date,starts,ends,coalesce(nullif(btrim(label),''),'모임'),coalesce(description,''),auth.uid()) returning id into result;
 else
 select * into previous from public.h_events where id=target_event for update;
 if previous.id is null or previous.group_id<>target_group then raise exception 'Access denied' using errcode='42501'; end if;
 if previous.version is distinct from expected_version or previous.deleted_at is not null then raise exception 'Changed event' using errcode='40001'; end if;
 insert into public.h_content_history(kind,row_id,actor,original) values('event',target_event,auth.uid(),to_jsonb(previous));
 update public.h_events set title=btrim(event_title),event_date=start_date,end_date=finish_date,start_time=starts,end_time=ends,
 owner_label=coalesce(nullif(btrim(label),''),'모임'),memo=coalesce(description,''),version=version+1 where id=target_event returning id into result;
 end if;
 return result;
end;$$;
create function public.h_set_event_deleted(target_event uuid,deleted boolean,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare previous public.h_events%rowtype;
begin
 select * into previous from public.h_events where id=target_event for update;
 if auth.uid() is null or previous.id is null or not public.h_is_member(previous.group_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if deleted is null then raise exception 'Invalid action' using errcode='22023'; end if;
 if previous.version is distinct from expected_version then raise exception 'Changed event' using errcode='40001'; end if;
 insert into public.h_content_history(kind,row_id,actor,original) values('event',target_event,auth.uid(),to_jsonb(previous));
 update public.h_events set deleted_at=case when deleted then now() else null end,version=version+1 where id=target_event;
end;$$;
create function public.h_edit_photo(target_photo uuid,description text,deleted boolean,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare previous public.h_media%rowtype;
begin
 select * into previous from public.h_media where id=target_photo for update;
 if auth.uid() is null or previous.id is null or not public.h_is_member(previous.group_id)
 or not (coalesce(previous.uploaded_by=auth.uid(),false) or exists(select 1 from public.h_groups where id=previous.group_id and owner_id=auth.uid()))
 then raise exception 'Access denied' using errcode='42501'; end if;
 if previous.version is distinct from expected_version then raise exception 'Changed photo' using errcode='40001'; end if;
 if deleted is null or description is null then raise exception 'Invalid photo' using errcode='22023'; end if;
 insert into public.h_content_history(kind,row_id,actor,original) values('photo',target_photo,auth.uid(),to_jsonb(previous));
 update public.h_media set caption=description,deleted_at=case when deleted then now() else null end,version=version+1 where id=target_photo;
end;$$;
revoke all on function public.h_save_map_place(uuid,text,text,text,text,double precision,double precision,text),public.h_set_place_status(uuid,text),public.h_record_at_place(uuid,date,numeric,text),public.h_save_event(uuid,uuid,text,date,date,time,time,text,text,integer),public.h_set_event_deleted(uuid,boolean,integer),public.h_edit_photo(uuid,text,boolean,integer) from public,anon;
grant execute on function public.h_save_map_place(uuid,text,text,text,text,double precision,double precision,text),public.h_set_place_status(uuid,text),public.h_record_at_place(uuid,date,numeric,text),public.h_save_event(uuid,uuid,text,date,date,time,time,text,text,integer),public.h_set_event_deleted(uuid,boolean,integer),public.h_edit_photo(uuid,text,boolean,integer) to authenticated;
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
  'place_photos',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'place_id',p.legacy_id,'created_at',m.created_at)),'[]'::jsonb) from public.h_media m join public.h_places p on p.id=m.place_id where m.group_id=target_group and p.legacy_id is not null and m.deleted_at is null),
  'couple_photos',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'caption',m.caption,'created_at',m.created_at)),'[]'::jsonb) from public.h_media m where m.group_id=target_group and m.place_id is null and m.deleted_at is null),
  'events',(select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) from public.events e)
 );
end;$$;


commit;
