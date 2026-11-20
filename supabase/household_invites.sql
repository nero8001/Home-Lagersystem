-- v0.6.0 household invitations
create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  code text not null unique,
  invited_email text,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists household_invites_household_idx on public.household_invites(household_id);
alter table public.household_invites enable row level security;

create or replace function public.create_household_invite(target_household uuid, invited_email text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare new_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = auth.uid()
      and role in ('owner','admin')
  ) then raise exception 'Only household owners or administrators can invite members'; end if;
  if invited_email is not null and length(trim(invited_email)) > 254 then
    raise exception 'Email address is too long';
  end if;
  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.household_invites(household_id, code, invited_email, created_by)
  values (target_household, new_code, nullif(lower(trim(invited_email)), ''), auth.uid());
  return new_code;
end;
$$;

create or replace function public.accept_household_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare invitation public.household_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into invitation from public.household_invites
    where code = upper(trim(invite_code))
      and accepted_at is null and expires_at > now()
    for update;
  if not found then raise exception 'Invitation code is invalid, expired, or already used'; end if;
  if invitation.invited_email is not null and lower(invitation.invited_email) <> lower(coalesce(auth.jwt()->>'email','')) then
    raise exception 'This invitation was sent to a different email address';
  end if;
  insert into public.household_members(household_id, user_id, role)
  values (invitation.household_id, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;
  update public.household_invites set accepted_by = auth.uid(), accepted_at = now()
    where id = invitation.id;
  return invitation.household_id;
end;
$$;

grant execute on function public.create_household_invite(uuid,text) to authenticated;
grant execute on function public.accept_household_invite(text) to authenticated;
grant select on public.household_invites to authenticated;
