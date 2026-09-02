-- V2.0d decline-recovery isolation, ownership and dark-default probes.
-- Run after all migrations are applied. Everything is rollback-only.
begin;

do $$
declare
  probe_table text;
begin
  foreach probe_table in array array[
    'decline_partners',
    'decline_partner_credentials',
    'decline_intake_sessions',
    'decline_recovery_journeys',
    'support_needs',
    'return_contracts',
    'return_attempts'
  ] loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = probe_table
        and c.relrowsecurity = true
    ) then
      raise exception 'RLS must be enabled on public.%', probe_table;
    end if;
  end loop;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'decline_partners','decline_partner_credentials',
        'decline_intake_sessions','return_contracts'
      )
      and grantee in ('anon','authenticated')
  ) then
    raise exception 'Partner intake and return configuration must remain private';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('decline_recovery_journeys','support_needs','return_attempts')
      and grantee = 'authenticated'
      and privilege_type in ('INSERT','UPDATE','DELETE')
  ) then
    raise exception 'Customers must not directly mutate recovery provenance/state tables';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'decline_recovery_journeys'
      and policyname = 'decline_recovery_journeys_select_own'
      and cmd = 'SELECT'
  ) then
    raise exception 'Recovery journey owner-select policy missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'support_needs'
      and policyname = 'support_needs_select_own'
      and cmd = 'SELECT'
  ) then
    raise exception 'Support-needs owner-select policy missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'return_attempts'
      and policyname = 'return_attempts_select_own'
      and cmd = 'SELECT'
  ) then
    raise exception 'Return-attempt owner-select policy missing';
  end if;

  if coalesce((select enabled from public.feature_flags where flag_key = 'partner_decline_intake_enabled'), true) then
    raise exception 'Partner decline intake must default OFF';
  end if;

  if coalesce((select enabled from public.feature_flags where flag_key = 'return_to_origin_enabled'), true) then
    raise exception 'Return-to-Origin must default OFF';
  end if;

  if coalesce((select enabled from public.feature_flags where flag_key = 'commercial_gateway_enabled'), true) then
    raise exception 'Existing commercial gateway dark default changed unexpectedly';
  end if;

  if coalesce((select enabled from public.feature_flags where flag_key = 'commercial_sandbox_enabled'), true) then
    raise exception 'Existing commercial sandbox dark default changed unexpectedly';
  end if;

  if coalesce((select enabled from public.feature_flags where flag_key = 'email_reminders_enabled'), true) then
    raise exception 'Existing email dark default changed unexpectedly';
  end if;

  if not has_function_privilege('service_role', 'public.admin_set_feature_flag(uuid,text,boolean)', 'EXECUTE') then
    raise exception 'service_role must retain audited feature-flag mutation';
  end if;

  if has_function_privilege('authenticated', 'public.admin_set_feature_flag(uuid,text,boolean)', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_set_feature_flag(uuid,text,boolean)', 'EXECUTE') then
    raise exception 'Clients must not execute audited feature-flag mutation';
  end if;

  if exists (
    select 1 from public.decline_partners
    where live_enabled = true
  ) then
    raise exception 'No live decline partner may be enabled by the foundation migration';
  end if;

  if exists (
    select 1 from public.return_contracts
    where environment = 'live' and enabled = true
  ) then
    raise exception 'No live return contract may be enabled by the foundation migration';
  end if;
end $$;

do $$
declare
  owner_user uuid := gen_random_uuid();
  other_user uuid := gen_random_uuid();
  owner_journey uuid;
  other_journey uuid;
  partner_id uuid := gen_random_uuid();
  contract_id uuid := gen_random_uuid();
  owner_visible integer;
  other_visible integer;
begin
  insert into auth.users(
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) values
  (
    owner_user,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'recovery-owner-probe@example.com', '', now(), now(), now()
  ),
  (
    other_user,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'recovery-other-probe@example.com', '', now(), now(), now()
  );

  insert into public.decline_partners(
    id, partner_key, display_name, enabled, sandbox_enabled, live_enabled
  ) values (
    partner_id, 'recovery-rls-probe', 'Recovery RLS Probe', true, true, false
  );

  insert into public.return_contracts(
    id, contract_key, partner_id, environment, destination_url,
    product_category, disclosure_key, disclosure_version, enabled, expires_at
  ) values (
    contract_id, 'recovery-rls-contract', partner_id, 'sandbox',
    '/sandbox/recovery-return', 'credit_card', 'recovery-probe', 1, true,
    now() + interval '1 day'
  );

  insert into public.decline_recovery_journeys(
    user_id, origin, product_category, declined_at,
    decline_reason_known, decline_reason_source
  ) values (
    owner_user, 'direct', 'credit_card', now(), false, 'unknown'
  ) returning id into owner_journey;

  insert into public.decline_recovery_journeys(
    user_id, origin, product_category, declined_at,
    decline_reason_known, decline_reason_source
  ) values (
    other_user, 'direct', 'credit_card', now(), false, 'unknown'
  ) returning id into other_journey;

  insert into public.support_needs(user_id, need_code)
  values
    (owner_user, 'simpler_explanations'),
    (other_user, 'larger_text');

  insert into public.return_attempts(
    user_id, recovery_journey_id, partner_id, return_contract_id,
    environment, readiness_snapshot, disclosure_key, disclosure_version,
    customer_choice, outcome
  ) values
  (
    owner_user, owner_journey, partner_id, contract_id,
    'sandbox', 'ready_to_check', 'recovery-probe', 1, 'continue', 'created'
  ),
  (
    other_user, other_journey, partner_id, contract_id,
    'sandbox', 'ready_to_check', 'recovery-probe', 1, 'decline', 'declined'
  );

  perform set_config('request.jwt.claim.sub', owner_user::text, true);
  execute 'set local role authenticated';

  select count(*) into owner_visible from public.decline_recovery_journeys;
  if owner_visible <> 1 then
    raise exception 'Owner should see exactly one recovery journey, saw %', owner_visible;
  end if;

  select count(*) into owner_visible from public.support_needs;
  if owner_visible <> 1 then
    raise exception 'Owner should see exactly one support-need row, saw %', owner_visible;
  end if;

  select count(*) into owner_visible from public.return_attempts;
  if owner_visible <> 1 then
    raise exception 'Owner should see exactly one return attempt, saw %', owner_visible;
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', other_user::text, true);
  execute 'set local role authenticated';

  select count(*) into other_visible from public.decline_recovery_journeys;
  if other_visible <> 1 then
    raise exception 'Other owner should see exactly one recovery journey, saw %', other_visible;
  end if;

  if exists (
    select 1 from public.decline_recovery_journeys where id = owner_journey
  ) then
    raise exception 'Cross-owner recovery journey read unexpectedly succeeded';
  end if;

  execute 'reset role';
end $$;

rollback;
