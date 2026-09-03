-- Production-parity privilege probe for V2.0d recovery tables.
-- Supabase hosted projects can carry default table grants beyond DML, so this
-- asserts the effective client contract rather than checking INSERT/UPDATE/DELETE only.
begin;

do $$
begin
  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'decline_partners',
        'decline_partner_credentials',
        'decline_intake_sessions',
        'return_contracts'
      )
      and grantee in ('anon', 'authenticated')
  ) then
    raise exception 'Private recovery configuration tables must have no client grants';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'decline_recovery_journeys',
        'support_needs',
        'return_attempts'
      )
      and grantee = 'anon'
  ) then
    raise exception 'Anonymous clients must have no recovery owner-table grants';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'decline_recovery_journeys',
        'support_needs',
        'return_attempts'
      )
      and grantee = 'authenticated'
      and privilege_type <> 'SELECT'
  ) then
    raise exception 'Authenticated recovery owner-table grants must be SELECT-only';
  end if;

  if (
    select count(distinct table_name)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'decline_recovery_journeys',
        'support_needs',
        'return_attempts'
      )
      and grantee = 'authenticated'
      and privilege_type = 'SELECT'
  ) <> 3 then
    raise exception 'Authenticated owner SELECT grants are incomplete';
  end if;

  if has_function_privilege('anon', 'public.replace_support_needs_atomic(uuid,text[],timestamptz)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.replace_support_needs_atomic(uuid,text[],timestamptz)', 'EXECUTE')
     or has_function_privilege('anon', 'public.redeem_partner_handoff_atomic(uuid,uuid,boolean,text,text,text,timestamptz)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.redeem_partner_handoff_atomic(uuid,uuid,boolean,text,text,text,timestamptz)', 'EXECUTE') then
    raise exception 'Atomic recovery RPCs must not be executable by clients';
  end if;

  if has_function_privilege('anon', 'public.get_partner_credential_vault_secret(text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.get_partner_credential_vault_secret(text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.get_partner_credential_vault_secret(text)', 'EXECUTE') then
    raise exception 'Vault partner secret RPC must be service-role-only';
  end if;
end $$;

rollback;
