-- v0.6.3: Einladungsstatus, Erstellungsdatum und Ablaufdatum anzeigen
-- Im Supabase SQL Editor des bestehenden Projekts ausführen.

-- Die Rückgabestruktur wird erweitert; deshalb muss die alte Funktion vorher entfernt werden.
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
      case
        when hi.accepted_at is not null then 'accepted'
        when hi.expires_at <= now() then 'expired'
        else 'pending'
      end as status
    from public.household_invites hi
    where hi.household_id = target_household
    order by
      case
        when hi.accepted_at is null and hi.expires_at > now() then 0
        when hi.accepted_at is null then 1
        else 2
      end,
      hi.created_at desc;
end;
$$;

grant execute on function public.list_household_invites(uuid) to authenticated;
revoke all on function public.list_household_invites(uuid) from public, anon;

-- Widerrufen ist nur für noch offene, nicht abgelaufene Einladungen möglich.
create or replace function public.revoke_household_invite(target_invite uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.household_invites hi
  where hi.id = target_invite
    and hi.accepted_at is null
    and hi.expires_at > now()
    and exists (
      select 1 from public.household_members hm
      where hm.household_id = hi.household_id
        and hm.user_id = auth.uid()
        and hm.role in ('owner', 'admin')
    );
  if not found then
    raise exception 'Invitation not found, expired, already accepted, or not authorized';
  end if;
end;
$$;

grant execute on function public.revoke_household_invite(uuid) to authenticated;
revoke all on function public.revoke_household_invite(uuid) from public, anon;
