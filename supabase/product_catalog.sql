-- v0.5.0: Haushaltsweiter Produktkatalog
-- Einmal im Supabase SQL Editor des Lagerprogramm-Projekts ausführen.
create table if not exists public.household_products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  barcode text not null,
  name text not null check (char_length(trim(name)) between 1 and 200),
  brand text,
  description text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, barcode)
);
create index if not exists household_products_name_idx on public.household_products(household_id, name);
alter table public.household_products enable row level security;
drop policy if exists "Members can manage household product catalog" on public.household_products;
create policy "Members can manage household product catalog" on public.household_products
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
grant select, insert, update, delete on public.household_products to authenticated;
