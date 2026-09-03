-- V2.0d atomic recovery write probes.
-- Run after all migrations. Everything is rollback-only.
begin;

do $$
declare
  support_fn regprocedure := to_regprocedure(
    'public.replace_support_needs_atomic(uuid,text[],timestamp with time zone)'
  );
  handoff_fn regprocedure := to_regprocedure(
    'public.redeem_partner_handoff_atomic(uuid,uuid,boolean,text,text,text,timestamp with time zone)'
  );
begin
  if support_fn is null or handoff_fn is null then
    raise exception 'Atomic recovery RPCs must exist';
  end if;

  if not has_function_privilege('service_role', support_fn, 'EXECUTE')
     or not has_function_privilege('service_role', handoff_fn, 'EXECUTE') then
    raise exception 'service_role must execute atomic recovery RPCs';
  end if;

  if has_function_privilege('authenticated', support_fn, 'EXECUTE')
     or has_function_privilege('anon', support_fn, 'EXECUTE')
     or has_function_privilege('authenticated', handoff_fn, 'EXECUTE')
     or has_function_privilege('anon', handoff_fn, 'EXECUTE') then
    raise exception 'Client roles must not execute atomic recovery RPCs';
  end if;
end $$;

do $$
declare
  owner_user uuid := gen_random_uuid();
  partner_id uuid := gen_random_uuid();
  session_id uuid := gen_random_uuid();
  rejected boolean := false;
  journey_count integer;
begin
  insert into auth.users(
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) values (
    owner_user,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'recovery-atomic-probe@example.com', '', now(), now(), now()
  );

  insert into public.support_needs(user_id, need_code)
  values (owner_user, 'simpler_explanations');

  begin
    perform public.replace_support_needs_atomic(
      owner_user,
      array['more_time', 'not_a_real_support_need'],
      now()
    );
  exception when others then
    rejected := true;
  end;

  if not rejected then
    raise exception 'Invalid Support Needs replacement unexpectedly succeeded';
  end if;

  if not exists (
    select 1 from public.support_needs
    where user_id = owner_user and need_code = 'simpler_explanations'
  ) then
    raise exception 'Failed Support Needs replacement did not roll back atomically';
  end if;

  perform public.replace_support_needs_atomic(
    owner_user,
    array['more_time', 'human_support'],
    now()
  );

  if (select count(*) from public.support_needs where user_id = owner_user) <> 2
     or not exists (
       select 1 from public.support_needs
       where user_id = owner_user and need_code = 'more_time'
     )
     or not exists (
       select 1 from public.support_needs
       where user_id = owner_user and need_code = 'human_support'
     ) then
    raise exception 'Valid Support Needs replacement did not commit as one set';
  end if;

  insert into public.decline_partners(
    id, partner_key, display_name, enabled, sandbox_enabled, live_enabled
  ) values (
    partner_id, 'atomic-probe-partner', 'Atomic Probe Partner', true, true, false
  );

  insert into public.decline_intake_sessions(
    id,
    partner_id,
    environment,
    origin_reference,
    product_category,
    declined_at,
    decline_reason_code,
    decline_reason_source,
    idempotency_key,
    nonce,
    request_timestamp,
    token_hash,
    token_expires_at
  ) values (
    session_id,
    partner_id,
    'sandbox',
    'atomic-probe-origin',
    'credit_card',
    now() - interval '1 hour',
    'partner_reason_probe',
    'partner',
    'atomic-probe-idempotency',
    'atomic_probe_nonce_123',
    now(),
    repeat('a', 64),
    now() + interval '15 minutes'
  );

  update public.feature_flags
  set enabled = true
  where flag_key = 'partner_decline_intake_enabled';

  perform public.redeem_partner_handoff_atomic(
    session_id,
    owner_user,
    true,
    'partner_reason_probe',
    'partner',
    'confirmed',
    now()
  );

  if not exists (
    select 1 from public.decline_intake_sessions
    where id = session_id
      and consumed_at is not null
      and bound_user_id = owner_user
  ) then
    raise exception 'Atomic handoff did not consume and bind the session';
  end if;

  select count(*) into journey_count
  from public.decline_recovery_journeys
  where intake_session_id = session_id
    and user_id = owner_user;

  if journey_count <> 1 then
    raise exception 'Atomic handoff must create exactly one recovery journey, saw %', journey_count;
  end if;

  rejected := false;
  begin
    perform public.redeem_partner_handoff_atomic(
      session_id,
      owner_user,
      true,
      'partner_reason_probe',
      'partner',
      'confirmed',
      now()
    );
  exception when others then
    rejected := true;
  end;

  if not rejected then
    raise exception 'Consumed handoff unexpectedly redeemed twice';
  end if;

  select count(*) into journey_count
  from public.decline_recovery_journeys
  where intake_session_id = session_id;

  if journey_count <> 1 then
    raise exception 'Replay changed recovery journey count to %', journey_count;
  end if;
end $$;

rollback;
