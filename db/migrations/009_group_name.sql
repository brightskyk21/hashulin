begin;
create function public.h_rename_group(target_group uuid, group_name text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if group_name is null or char_length(btrim(group_name)) not between 1 and 60 then
  raise exception 'Invalid group name' using errcode='22023';
 end if;
 update public.h_groups set name=btrim(group_name) where id=target_group and owner_id=auth.uid();
 if not found then raise exception 'Only owner may rename group' using errcode='42501'; end if;
end;$$;
revoke all on function public.h_rename_group(uuid,text) from public,anon;
grant execute on function public.h_rename_group(uuid,text) to authenticated;
commit;
