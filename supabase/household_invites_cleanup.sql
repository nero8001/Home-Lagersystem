-- v0.6.4: Angenommene Einladungen aus der Übersicht ausblenden.
-- Im Supabase SQL Editor des bestehenden Projekts einmal ausführen.
-- Offene und abgelaufene Einladungen bleiben sichtbar.

drop function if exists public.list_household_invites(uuid);

create function public.list_household_invites(target_household uuid)
returns table(
  id uuid,
  invited_email text,
  code text,
  expires_at timestamptz,
  created_at timestamptz,
  accepted_at timestamptz,
  status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household
      and hm.user_id = auth.uid()
      and hm.role in ('owner', 'admin')
  ) then
    raise exception 'Only owners and administrators can view invitations';
  end if;

  return query
    select
      hi.id,
      hi.invited_email,
      hi.code,
      hi.expires_at,
      hi.created_at,
      hi.accepted_at,
      case when hi.expires_at <= now() then 'expired' else 'pending' end as status
    from public.household_invites hi
    where hi.household_id = target_household
      and hi.accepted_at is null
    order by
      case when hi.expires_at > now() then 0 else 1 end,
      hi.created_at desc;
end;
$$;

grant execute on function public.list_household_invites(uuid) to authenticated;
revoke all on function public.list_household_invites(uuid) from public, anon;
