-- Lagerprogramm für Zuhause v0.2.2
-- Run this once in Supabase SQL Editor if the database schema already exists.
-- These grants do NOT disable RLS. Existing RLS policies continue to restrict rows.

grant usage on schema public to authenticated;
grant select on table public.households, public.household_members to authenticated;
grant select, insert, update, delete on table public.categories, public.inventory_items to authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;
