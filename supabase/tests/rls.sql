-- Run after `supabase db reset` in a local project.
-- These checks document and verify the intended isolation rules.
begin;

-- Policies must exist for owner-only profile and mission access.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'profiles_select_own'
      and qual like '%auth.uid()%user_id%'
  ) then
    raise exception 'profiles owner-select policy missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_missions'
      and policyname = 'missions_update_own'
      and cmd = 'UPDATE'
      and qual like '%auth.uid()%user_id%'
      and with_check like '%auth.uid()%user_id%'
  ) then
    raise exception 'user_missions owner-update policy missing or not owner-scoped';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'events' and cmd = 'SELECT'
  ) then
    raise exception 'events must not expose a client select policy';
  end if;
end $$;

rollback;
