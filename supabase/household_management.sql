-- v0.6.2: sichere Haushalts- und Mitgliederverwaltung
-- Im SQL Editor des bestehenden Supabase-Projekts ausführen.

create or replace function public.list_household_members(target_household uuid)
returns table(user_id uuid, role text, email text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (select 1 from public.household_members where household_id = target_household and user_id = auth.uid()) then
    raise exception 'You are not a member of this household';
  end if;
  return query
    select hm.user_id, hm.role, au.email::text
    from public.household_members hm
    left join auth.users au on au.id = hm.user_id
    where hm.household_id = target_household
    order by case hm.role when 'owner' then 0 when 'admin' then 1 else 2 end, au.email;
end;
$$;

create or replace function public.list_household_invites(target_household uuid)
returns table(id uuid, invited_email text, code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.household_members where household_id = target_household and user_id = auth.uid() and role in ('owner','admin')) then
    raise exception 'Only owners and administrators can view invitations';
  end if;
  return query select hi.id, hi.invited_email, hi.code, hi.expires_at
    from public.household_invites hi
    where hi.household_id = target_household and hi.accepted_at is null and hi.expires_at > now()
    order by hi.created_at desc;
end;
$$;

create or replace function public.set_household_member_role(target_household uuid, target_user uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare actor_role text; target_role text;
begin
  select role into actor_role from public.household_members where household_id = target_household and user_id = auth.uid();
  select role into target_role from public.household_members where household_id = target_household and user_id = target_user;
  if actor_role is null or target_role is null then raise exception 'Household member not found'; end if;
  if new_role not in ('admin','member') then raise exception 'Only member and administrator roles can be assigned'; end if;
  if target_role = 'owner' then raise exception 'The owner role cannot be changed here'; end if;
  if actor_role = 'owner' then
    update public.household_members set role = new_role where household_id = target_household and user_id = target_user;
  elsif actor_role = 'admin' then
    if target_role <> 'member' or new_role <> 'admin' then
      raise exception 'Administrators can only promote regular members to administrator';
    end if;
    update public.household_members set role = new_role where household_id = target_household and user_id = target_user;
  else
    raise exception 'Only owners and administrators can change roles';
  end if;
end;
$$;

create or replace function public.remove_household_member(target_household uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare actor_role text; target_role text;
begin
  select role into actor_role from public.household_members where household_id = target_household and user_id = auth.uid();
  select role into target_role from public.household_members where household_id = target_household and user_id = target_user;
  if actor_role is null or actor_role not in ('owner','admin') or target_role is null then raise exception 'Not authorized or member not found'; end if;
  if target_role = 'owner' then raise exception 'The owner cannot be removed'; end if;
  if actor_role = 'admin' and target_role <> 'member' then raise exception 'Administrators can only remove regular members'; end if;
  delete from public.household_members where household_id = target_household and user_id = target_user;
end;
$$;

create or replace function public.revoke_household_invite(target_invite uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.household_invites hi
  where hi.id = target_invite and hi.accepted_at is null
    and exists (select 1 from public.household_members hm where hm.household_id = hi.household_id and hm.user_id = auth.uid() and hm.role in ('owner','admin'));
  if not found then raise exception 'Invitation not found or not authorized'; end if;
end;
$$;

create or replace function public.rename_household(target_household uuid, new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.household_members where household_id = target_household and user_id = auth.uid() and role = 'owner') then
    raise exception 'Only the household owner can rename it';
  end if;
  if char_length(trim(coalesce(new_name, ''))) not between 1 and 80 then raise exception 'Name must contain 1 to 80 characters'; end if;
  update public.households set name = trim(new_name) where id = target_household;
end;
$$;

create or replace function public.delete_household(target_household uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.household_members where household_id = target_household and user_id = auth.uid() and role = 'owner') then
    raise exception 'Only the household owner can delete it';
  end if;
  delete from public.households where id = target_household;
end;
$$;

grant execute on function public.list_household_members(uuid) to authenticated;
grant execute on function public.list_household_invites(uuid) to authenticated;
grant execute on function public.set_household_member_role(uuid,uuid,text) to authenticated;
grant execute on function public.remove_household_member(uuid,uuid) to authenticated;
grant execute on function public.revoke_household_invite(uuid) to authenticated;
grant execute on function public.rename_household(uuid,text) to authenticated;
grant execute on function public.delete_household(uuid) to authenticated;

-- SECURITY DEFINER RPCs dürfen nicht anonym aufrufbar sein.
revoke all on function public.list_household_members(uuid) from public, anon;
revoke all on function public.list_household_invites(uuid) from public, anon;
revoke all on function public.set_household_member_role(uuid,uuid,text) from public, anon;
revoke all on function public.remove_household_member(uuid,uuid) from public, anon;
revoke all on function public.revoke_household_invite(uuid) from public, anon;
revoke all on function public.rename_household(uuid,text) from public, anon;
revoke all on function public.delete_household(uuid) from public, anon;
