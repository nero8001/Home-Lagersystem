-- Lagerprogramm für Zuhause: initiales Datenbankschema
-- In einem NEUEN Supabase-Projekt ausführen.
-- RLS ist aktiviert: Benutzer sehen und ändern nur ihre eigenen Daten.

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  parent_id uuid references public.categories(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  quantity numeric(12, 2) not null default 0 check (quantity >= 0),
  unit text not null default 'Stück',
  min_quantity numeric(12, 2) not null default 0 check (min_quantity >= 0),
  location text,
  barcode text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists categories_user_id_idx on public.categories(user_id);
create index if not exists inventory_items_user_id_idx on public.inventory_items(user_id);
create index if not exists inventory_items_barcode_idx on public.inventory_items(user_id, barcode);

alter table public.categories enable row level security;
alter table public.inventory_items enable row level security;

drop policy if exists "Users manage their own categories" on public.categories;
create policy "Users manage their own categories"
on public.categories for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage their own inventory" on public.inventory_items;
create policy "Users manage their own inventory"
on public.inventory_items for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists inventory_items_updated_at on public.inventory_items;
create trigger inventory_items_updated_at
before update on public.inventory_items
for each row execute procedure public.set_updated_at();
