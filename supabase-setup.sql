-- Deal Checker: shared database setup for Supabase.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.

-- 1. The table that holds every property (one row per property, details in a JSON column).
create table if not exists public.properties (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid()
);

-- 2. Only signed-in users can read or change anything.
--    After you and your partner have both signed in once, turn OFF new sign-ups
--    (Authentication → Sign In / Providers → "Allow new users to sign up").
alter table public.properties enable row level security;

drop policy if exists "signed-in users read"   on public.properties;
drop policy if exists "signed-in users insert" on public.properties;
drop policy if exists "signed-in users update" on public.properties;
drop policy if exists "signed-in users delete" on public.properties;

create policy "signed-in users read"   on public.properties for select to authenticated using (true);
create policy "signed-in users insert" on public.properties for insert to authenticated with check (true);
create policy "signed-in users update" on public.properties for update to authenticated using (true) with check (true);
create policy "signed-in users delete" on public.properties for delete to authenticated using (true);

-- 3. Live updates: when your partner changes something, your screen refreshes.
do $$ begin
  alter publication supabase_realtime add table public.properties;
exception when duplicate_object then null; end $$;

-- 4. Photo storage. Photos get a public link (hard to guess) so they show on the cards.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "signed-in users upload photos" on storage.objects;
drop policy if exists "signed-in users delete photos" on storage.objects;
create policy "signed-in users upload photos" on storage.objects for insert to authenticated with check (bucket_id = 'photos');
create policy "signed-in users delete photos" on storage.objects for delete to authenticated using (bucket_id = 'photos');
