begin;
create table public.h_places (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.h_groups(id) on delete cascade,
 name text not null check(char_length(btrim(name)) between 1 and 100),
 address text not null default '' check(char_length(address)<=300),
 created_at timestamptz not null default now(),
 unique(group_id,name,address), unique(id,group_id)
);
create table public.h_visits (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.h_groups(id) on delete cascade,
 place_id uuid not null,
 visited_on date not null,
 created_by uuid not null references public.h_profiles(id),
 created_at timestamptz not null default now(),
 foreign key(place_id,group_id) references public.h_places(id,group_id),
 unique(group_id,place_id,visited_on),unique(id,group_id)
);
create table public.h_reviews (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.h_groups(id) on delete cascade,
 visit_id uuid not null,
 author_id uuid not null references public.h_profiles(id),
 score numeric not null check(score between 1 and 10 and score=round(score,1)),
 comment text not null check(char_length(btrim(comment)) between 1 and 1000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(visit_id,group_id) references public.h_visits(id,group_id),
 unique(visit_id,author_id)
);
create index h_visits_group_date_idx on public.h_visits(group_id,visited_on desc);
create index h_reviews_group_visit_idx on public.h_reviews(group_id,visit_id);
alter table public.h_places enable row level security;
alter table public.h_visits enable row level security;
alter table public.h_reviews enable row level security;
revoke all on public.h_places,public.h_visits,public.h_reviews from anon,authenticated;
grant select on public.h_places,public.h_visits,public.h_reviews to authenticated;
create policy places_member_read on public.h_places for select to authenticated using(public.h_is_member(group_id));
create policy visits_member_read on public.h_visits for select to authenticated using(public.h_is_member(group_id));
create policy reviews_member_read on public.h_reviews for select to authenticated using(public.h_is_member(group_id));
create function public.h_review_visit(target_visit uuid,rating numeric,impression text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); g uuid; result uuid;
begin
 select group_id into g from public.h_visits where id=target_visit;
 if actor is null or g is null or not public.h_is_member(g) then raise exception 'Access denied' using errcode='42501'; end if;
 if rating is null or rating<1 or rating>10 or rating<>round(rating,1) or impression is null or char_length(btrim(impression)) not between 1 and 1000 then
 raise exception 'Invalid review' using errcode='22023'; end if;
 insert into public.h_reviews(group_id,visit_id,author_id,score,comment) values(g,target_visit,actor,rating,btrim(impression))
 on conflict(visit_id,author_id) do update set score=excluded.score,comment=excluded.comment,updated_at=now() returning id into result;
 return result;
end;$$;
create function public.h_record_visit(target_group uuid,place_name text,place_address text,visit_date date,rating numeric,impression text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); p uuid; v uuid;
begin
 if actor is null or not public.h_is_member(target_group) then raise exception 'Access denied' using errcode='42501'; end if;
 if place_name is null or char_length(btrim(place_name)) not between 1 and 100 or char_length(coalesce(place_address,''))>300 or visit_date is null or visit_date>(now() at time zone 'Asia/Seoul')::date then raise exception 'Invalid visit' using errcode='22023'; end if;
 insert into public.h_places(group_id,name,address) values(target_group,btrim(place_name),btrim(coalesce(place_address,'')))
 on conflict(group_id,name,address) do update set name=excluded.name returning id into p;
 insert into public.h_visits(group_id,place_id,visited_on,created_by) values(target_group,p,visit_date,actor)
 on conflict(group_id,place_id,visited_on) do update set place_id=excluded.place_id returning id into v;
 perform public.h_review_visit(v,rating,impression);
 return v;
end;$$;
revoke all on function public.h_record_visit(uuid,text,text,date,numeric,text),public.h_review_visit(uuid,numeric,text) from public;
grant execute on function public.h_record_visit(uuid,text,text,date,numeric,text),public.h_review_visit(uuid,numeric,text) to authenticated;
commit;
