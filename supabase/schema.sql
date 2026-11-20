-- Lagerprogramm für Zuhause v0.2.0
-- In einem NEUEN, ausschließlich für dieses Projekt verwendeten Supabase-Projekt ausführen.

create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists household_members_user_id_idx on public.household_members(user_id);

create or replace function public.is_household_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household and hm.user_id = auth.uid()
  );
$$;

create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_household_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(coalesce(household_name, ''))) not between 1 and 80 then
    raise exception 'Household name must contain 1 to 80 characters';
  end if;
  insert into public.households(name) values (trim(household_name)) returning id into new_household_id;
  insert into public.household_members(household_id, user_id, role)
    values (new_household_id, auth.uid(), 'owner');
  return new_household_id;
end;
$$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  parent_id uuid,
  created_at timestamptz not null default now(),
  constraint categories_parent_same_household_fk
    foreign key (parent_id, household_id) references public.categories(id, household_id) on delete restrict,
  constraint categories_id_household_unique unique (id, household_id)
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  description text,
  category_id uuid,
  quantity numeric(12, 2) not null default 0 check (quantity >= 0),
  unit text not null default 'Stück',
  min_quantity numeric(12, 2) not null default 0 check (min_quantity >= 0),
  location text,
  barcode text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_category_same_household_fk
    foreign key (category_id, household_id) references public.categories(id, household_id) on delete set null (category_id)
);

create index if not exists categories_household_id_idx on public.categories(household_id);
create index if not exists inventory_items_household_id_idx on public.inventory_items(household_id);
create index if not exists inventory_items_barcode_idx on public.inventory_items(household_id, barcode);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.inventory_items enable row level security;

drop policy if exists "Members can read their households" on public.households;
create policy "Members can read their households" on public.households
  for select using (public.is_household_member(id));

drop policy if exists "Members can read household membership" on public.household_members;
create policy "Members can read household membership" on public.household_members
  for select using (public.is_household_member(household_id));

drop policy if exists "Members can manage their household categories" on public.categories;
create policy "Members can manage their household categories" on public.categories
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "Members can manage their household inventory" on public.inventory_items;
create policy "Members can manage their household inventory" on public.inventory_items
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists inventory_items_updated_at on public.inventory_items;
create trigger inventory_items_updated_at before update on public.inventory_items
for each row execute procedure public.set_updated_at();

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;

-- Enable live updates across connected devices when the Supabase Realtime publication exists.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'categories') then
      alter publication supabase_realtime add table public.categories;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inventory_items') then
      alter publication supabase_realtime add table public.inventory_items;
    end if;
  end if;
end $$;
