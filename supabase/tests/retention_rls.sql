-- V2.2B retention/email security checks.
-- Run after all migrations are applied. Everything is rollback-only.
begin;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'journey_reminders'
      and policyname = 'journey_reminders_select_own'
      and cmd = 'SELECT'
  ) then
    raise exception 'Journey reminders owner-select policy missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'communication_preferences'
      and policyname = 'communication_preferences_select_own'
      and cmd = 'SELECT'
  ) then
    raise exception 'Communication preferences owner-select policy missing';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('journey_reminders','communication_preferences')
      and grantee in ('anon','authenticated')
      and privilege_type in ('INSERT','UPDATE','DELETE')
  ) then
    raise exception 'Reminder/preference client writes must be denied';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('journey_reminders','communication_preferences')
      and grantee = 'anon'
      and privilege_type = 'SELECT'
  ) then
    raise exception 'Anonymous users must not read reminder/preference state';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'feature_flags'
      and grantee in ('anon','authenticated')
  ) then
    raise exception 'Feature flags must stay private';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.claim_due_journey_reminders(integer,timestamp with time zone)',
    'EXECUTE'
  ) then
    raise exception 'service_role must execute reminder claim RPC';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.claim_due_journey_reminders(integer,timestamp with time zone)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must not execute reminder claim RPC';
  end if;

  if has_function_privilege(
    'anon',
    'public.claim_due_journey_reminders(integer,timestamp with time zone)',
    'EXECUTE'
  ) then
    raise exception 'anon must not execute reminder claim RPC';
  end if;
end $$;

do $$
declare
  probe_user uuid := gen_random_uuid();
begin
  insert into auth.users(
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) values (
    probe_user,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'retention-rls-probe@example.com',
    '',
    now(),
    now(),
    now()
  );

  insert into public.journey_reminders(
    user_id, reason, channel, due_at, source_key, template_key
  ) values (
    probe_user,
    'mission_incomplete',
    'in_app',
    now(),
    'retention-duplicate-probe',
    'mission-incomplete-v1'
  );

  begin
    insert into public.journey_reminders(
      user_id, reason, channel, due_at, source_key, template_key
    ) values (
      probe_user,
      'mission_incomplete',
      'in_app',
      now(),
      'retention-duplicate-probe',
      'mission-incomplete-v1'
    );
    raise exception 'Reminder duplicate unexpectedly succeeded';
  exception
    when unique_violation then null;
  end;
end $$;

rollback;
