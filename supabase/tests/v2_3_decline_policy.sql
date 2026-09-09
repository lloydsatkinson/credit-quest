-- V2.3 recovery policy persistence, privilege and immutability checks.
begin;

do $$
declare
  private_tables text[] := array[
    'canonical_decline_reasons',
    'partner_decline_mappings',
    'recovery_templates',
    'recovery_template_steps',
    'reassessment_rules',
    'alternative_route_policies'
  ];
begin
  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = any(private_tables)
      and grantee in ('anon', 'authenticated')
  ) then
    raise exception 'V2.3 policy tables must have no client grants';
  end if;

  if (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any(private_tables)
      and c.relrowsecurity
  ) <> array_length(private_tables, 1) then
    raise exception 'Every V2.3 policy table must have RLS enabled';
  end if;

  if has_function_privilege('anon', 'public.admin_publish_recovery_policy_version(uuid,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.admin_publish_recovery_policy_version(uuid,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.admin_publish_recovery_policy_version(uuid,uuid)', 'EXECUTE') then
    raise exception 'Recovery policy publish RPC must be service-role-only';
  end if;

  if not exists (
    select 1 from public.canonical_decline_reasons
    where canonical_code = 'NEGATIVE_DISPOSABLE_INCOME'
      and risk_family = 'affordability'
      and alternative_credit_permitted_by_default = false
      and lifecycle = 'published'
  ) then
    raise exception 'Negative disposable income canonical policy row is missing or unsafe';
  end if;

  if not exists (
    select 1 from public.canonical_decline_reasons
    where canonical_code = 'FRAUD_SECURITY_DECISION'
      and restricted = true
      and lifecycle = 'published'
  ) then
    raise exception 'Restricted fraud/security canonical row is missing';
  end if;

  if exists (
    select canonical_code, version
    from public.canonical_decline_reasons
    group by canonical_code, version
    having count(*) > 1
  ) then
    raise exception 'Canonical decline reason versions must be unique';
  end if;

  begin
    update public.canonical_decline_reasons
    set customer_language_key = 'must_not_change'
    where canonical_code = 'THIN_FILE' and lifecycle = 'published';
    raise exception 'Published recovery policy row was unexpectedly mutable';
  exception
    when sqlstate '55000' then
      null;
  end;
end $$;

rollback;
