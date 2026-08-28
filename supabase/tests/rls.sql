-- Run after `supabase db reset` in a local project.
-- These checks document and verify the intended isolation rules.
begin;

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

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_accounts'
      and policyname = 'accounts_select_own'
      and qual like '%auth.uid()%user_id%'
  ) then
    raise exception 'user_accounts owner-select policy missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'action_attempts'
      and policyname = 'action_attempts_select_own'
      and qual like '%auth.uid()%user_id%'
  ) then
    raise exception 'action_attempts owner-select policy missing';
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'user_missions'
      and c.conname = 'user_missions_subject_owner_fkey'
      and pg_get_constraintdef(c.oid) like 'FOREIGN KEY (subject_id, user_id)%'
  ) then
    raise exception 'user_missions subject/account owner foreign key missing';
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'action_attempts'
      and c.conname = 'action_attempts_mission_owner_fkey'
      and pg_get_constraintdef(c.oid) like 'FOREIGN KEY (mission_instance_id, user_id)%'
  ) then
    raise exception 'action_attempts mission owner foreign key missing';
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'action_attempts'
      and c.conname = 'action_attempts_account_owner_fkey'
      and pg_get_constraintdef(c.oid) like 'FOREIGN KEY (account_id, user_id)%'
  ) then
    raise exception 'action_attempts account owner foreign key missing';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'events' and cmd = 'SELECT'
  ) then
    raise exception 'events must not expose a client select policy';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'providers'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'providers must not expose client write policies';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'action_registry'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'action_registry must not expose client write policies';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'academy_articles'
      and policyname = 'academy_articles_public_published_select'
      and cmd = 'SELECT'
      and qual like '%status%published%'
  ) then
    raise exception 'Academy published-only public select policy missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'academy_progress'
      and policyname = 'academy_progress_select_own'
      and cmd = 'SELECT'
      and qual like '%auth.uid()%user_id%'
  ) then
    raise exception 'Academy progress owner-select policy missing';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('academy_articles', 'academy_progress')
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'Academy client write grant must not exist';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'academy_progress'
      and grantee = 'anon'
      and privilege_type = 'SELECT'
  ) then
    raise exception 'Anonymous users must not read Academy progress';
  end if;

  if exists (
    select 1
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'publish_academy_article'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
      and privilege_type = 'EXECUTE'
  ) then
    raise exception 'Academy publish function must not be client executable';
  end if;
end $$;

rollback;
