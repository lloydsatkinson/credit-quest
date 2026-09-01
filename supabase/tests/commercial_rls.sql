-- V2.2C commercial/admin isolation and append-only checks.
-- Run after all migrations are applied. Everything is rollback-only.
begin;

do $$
begin
  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'admin_members','commercial_partners','commercial_routes','commercial_disclosures',
        'referral_attempts','revenue_events','experiments','admin_audit_log'
      )
      and grantee in ('anon','authenticated')
  ) then
    raise exception 'Commercial/admin tables must have no anon/authenticated grants';
  end if;

  if not has_function_privilege('service_role', 'public.publish_commercial_disclosure(uuid)', 'EXECUTE') then
    raise exception 'service_role must publish commercial disclosures';
  end if;

  if has_function_privilege('authenticated', 'public.publish_commercial_disclosure(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.publish_commercial_disclosure(uuid)', 'EXECUTE') then
    raise exception 'Clients must not publish commercial disclosures';
  end if;

  if not has_function_privilege('service_role', 'public.admin_set_feature_flag(uuid,text,boolean)', 'EXECUTE') then
    raise exception 'service_role must execute audited admin mutation RPCs';
  end if;

  if has_function_privilege('authenticated', 'public.admin_set_feature_flag(uuid,text,boolean)', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_set_feature_flag(uuid,text,boolean)', 'EXECUTE') then
    raise exception 'Clients must not execute admin mutation RPCs';
  end if;

  if exists (
    select 1 from public.commercial_routes
    where environment = 'live' and enabled = true
  ) then
    raise exception 'No live commercial route may be enabled in V2.2C seed state';
  end if;
end $$;

do $$
declare
  probe_user uuid := gen_random_uuid();
  probe_partner uuid := gen_random_uuid();
  probe_route uuid := gen_random_uuid();
  probe_disclosure uuid := gen_random_uuid();
  probe_referral uuid;
  probe_revenue uuid;
begin
  insert into auth.users(
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) values (
    probe_user,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'commercial-rls-probe@example.com',
    '',
    now(),
    now(),
    now()
  );

  insert into public.commercial_partners(
    id, partner_key, display_name, enabled, sandbox_enabled, live_enabled
  ) values (
    probe_partner, 'rls-probe-partner', 'RLS Probe Partner', true, true, false
  );

  insert into public.commercial_disclosures(
    id, disclosure_key, version, status, body, reviewed_at, published_at
  ) values (
    probe_disclosure, 'rls-probe-disclosure', 1, 'published', 'Sandbox probe disclosure.', now(), now()
  );

  insert into public.commercial_routes(
    id, route_key, partner_id, environment, destination_url, enabled, min_age, required_readiness, disclosure_key
  ) values (
    probe_route, 'rls-probe-route', probe_partner, 'sandbox', '/sandbox/referral-complete', true, 18, 'green', 'rls-probe-disclosure'
  );

  insert into public.referral_attempts(
    referral_key, user_id, partner_id, route_id, readiness_snapshot,
    consented_at, disclosure_id, environment
  ) values (
    'rls-probe-referral', probe_user, probe_partner, probe_route, 'green',
    now(), probe_disclosure, 'sandbox'
  ) returning id into probe_referral;

  insert into public.revenue_events(
    user_id, referral_attempt_id, event_type, amount_minor
  ) values (
    probe_user, probe_referral, 'click', null
  ) returning id into probe_revenue;

  begin
    update public.referral_attempts
    set metadata = '{"changed":true}'::jsonb
    where id = probe_referral;
    raise exception 'Referral update unexpectedly succeeded';
  exception
    when others then
      if sqlerrm = 'Referral update unexpectedly succeeded' then
        raise;
      end if;
  end;

  begin
    update public.revenue_events
    set metadata = '{"changed":true}'::jsonb
    where id = probe_revenue;
    raise exception 'Revenue update unexpectedly succeeded';
  exception
    when others then
      if sqlerrm = 'Revenue update unexpectedly succeeded' then
        raise;
      end if;
  end;

  execute 'set local role service_role';
  delete from public.referral_attempts where id = probe_referral;
  execute 'reset role';

  if exists (select 1 from public.referral_attempts where id = probe_referral) then
    raise exception 'service_role erasure of referral history failed';
  end if;
  if exists (select 1 from public.revenue_events where id = probe_revenue) then
    raise exception 'Referral erasure did not cascade associated revenue history';
  end if;
end $$;

rollback;
