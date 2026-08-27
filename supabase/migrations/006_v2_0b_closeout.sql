-- V2.0b close-out hardening after the Action Layer cutover.
-- Remove the additive-phase mission id index now that id is the primary key,
-- cover the legacy events.user_id foreign key, and optimize remaining owner
-- RLS policies so auth.uid() is evaluated once per statement rather than row.

drop index if exists public.user_missions_id_unique;

create index if not exists events_user_id_idx on public.events(user_id);

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "missions_select_own" on public.user_missions;
drop policy if exists "missions_insert_own" on public.user_missions;
drop policy if exists "missions_update_own" on public.user_missions;

create policy "missions_select_own" on public.user_missions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "missions_insert_own" on public.user_missions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "missions_update_own" on public.user_missions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "events_insert_own" on public.events;

create policy "events_insert_own" on public.events
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
