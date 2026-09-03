-- V2.0d recovery durability hardening.
-- Both functions are service-role-only RPC boundaries so multi-row state changes
-- commit together or roll back together. This migration does not enable any
-- recovery, partner, commercial, email or live-return feature flag.

create or replace function public.replace_support_needs_atomic(
  p_user_id uuid,
  p_need_codes text[],
  p_effective_at timestamptz
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_need_codes text[] := coalesce(p_need_codes, array[]::text[]);
begin
  if p_user_id is null or p_effective_at is null then
    raise exception 'invalid_support_needs_request';
  end if;

  if cardinality(v_need_codes) > 8 then
    raise exception 'invalid_support_needs_request';
  end if;

  if exists (
    select 1
    from unnest(v_need_codes) as n(need_code)
    where n.need_code is null
       or n.need_code not in (
         'simpler_explanations','larger_text','fewer_steps','more_time',
         'reduced_motion','reminder_support','human_support','digital_support'
       )
  ) then
    raise exception 'invalid_support_needs_request';
  end if;

  if (select count(*) from unnest(v_need_codes)) <>
     (select count(distinct n.need_code) from unnest(v_need_codes) as n(need_code)) then
    raise exception 'invalid_support_needs_request';
  end if;

  -- Delete + insert are one PostgreSQL transaction because the whole mutation
  -- lives inside this RPC. Any validation/FK/insert error rolls the delete back.
  delete from public.support_needs
  where user_id = p_user_id;

  insert into public.support_needs(
    user_id,
    need_code,
    source,
    confirmation_state,
    effective_at,
    created_at,
    updated_at
  )
  select
    p_user_id,
    n.need_code,
    'customer',
    'confirmed',
    p_effective_at,
    p_effective_at,
    p_effective_at
  from unnest(v_need_codes) as n(need_code);

  return v_need_codes;
end;
$$;

revoke all on function public.replace_support_needs_atomic(uuid,text[],timestamptz)
  from public, anon, authenticated;
grant execute on function public.replace_support_needs_atomic(uuid,text[],timestamptz)
  to service_role;

create or replace function public.redeem_partner_handoff_atomic(
  p_session_id uuid,
  p_user_id uuid,
  p_decline_reason_known boolean,
  p_decline_reason_code text,
  p_decline_reason_source text,
  p_context_confirmation text,
  p_now timestamptz
)
returns table (
  id uuid,
  origin text,
  product_category text,
  decline_reason_known boolean,
  decline_reason_code text,
  decline_reason_source text,
  context_confirmation text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intake_enabled boolean := false;
  v_session record;
  v_journey_id uuid;
begin
  if p_session_id is null
     or p_user_id is null
     or p_now is null
     or p_decline_reason_known is null
     or p_decline_reason_source is null
     or p_context_confirmation is null then
    raise exception 'handoff_unavailable';
  end if;

  -- Lock the kill-switch row so an in-flight redemption observes one stable
  -- decision for the duration of this transaction.
  select enabled
  into v_intake_enabled
  from public.feature_flags
  where flag_key = 'partner_decline_intake_enabled'
  for update;

  if coalesce(v_intake_enabled, false) is not true then
    raise exception 'handoff_unavailable';
  end if;

  -- Lock both the one-time session and its partner configuration. This closes
  -- the race between the application pre-check and consume/create persistence.
  select
    s.id,
    s.environment,
    s.product_category,
    s.declined_at,
    s.consumed_at,
    s.bound_user_id,
    s.token_expires_at,
    p.display_name as partner_display_name,
    p.enabled as partner_enabled,
    p.sandbox_enabled as partner_sandbox_enabled
  into v_session
  from public.decline_intake_sessions s
  join public.decline_partners p on p.id = s.partner_id
  where s.id = p_session_id
    and s.environment = 'sandbox'
    and p.enabled = true
    and p.sandbox_enabled = true
  for update of s, p;

  if not found
     or v_session.consumed_at is not null
     or v_session.bound_user_id is not null
     or v_session.token_expires_at <= p_now then
    raise exception 'handoff_unavailable';
  end if;

  if p_decline_reason_source not in ('partner','customer','unknown')
     or p_context_confirmation not in ('confirmed','corrected','unknown','optional_use_declined')
     or (
       p_decline_reason_known = false
       and (p_decline_reason_code is not null or p_decline_reason_source <> 'unknown')
     )
     or (
       p_decline_reason_known = true
       and (p_decline_reason_code is null or p_decline_reason_source not in ('partner','customer'))
     ) then
    raise exception 'invalid_review';
  end if;

  -- Consume first while the session row is locked. If the journey insert below
  -- fails for any reason, PostgreSQL rolls this update back automatically.
  update public.decline_intake_sessions as s
  set
    consumed_at = p_now,
    bound_user_id = p_user_id
  where s.id = p_session_id
    and s.environment = 'sandbox'
    and s.consumed_at is null
    and s.bound_user_id is null
    and s.token_expires_at > p_now;

  if not found then
    raise exception 'handoff_unavailable';
  end if;

  insert into public.decline_recovery_journeys(
    user_id,
    intake_session_id,
    origin,
    product_category,
    declined_at,
    provider_display_name,
    decline_reason_known,
    decline_reason_code,
    decline_reason_source,
    context_confirmation,
    stage,
    return_eligibility_state,
    started_at,
    updated_at
  ) values (
    p_user_id,
    p_session_id,
    'partner',
    v_session.product_category,
    v_session.declined_at,
    v_session.partner_display_name,
    p_decline_reason_known,
    p_decline_reason_code,
    p_decline_reason_source,
    p_context_confirmation,
    'intake',
    'not_assessed',
    p_now,
    p_now
  )
  returning decline_recovery_journeys.id into v_journey_id;

  return query
  select
    v_journey_id,
    'partner'::text,
    v_session.product_category::text,
    p_decline_reason_known,
    p_decline_reason_code,
    p_decline_reason_source,
    p_context_confirmation;
end;
$$;

revoke all on function public.redeem_partner_handoff_atomic(uuid,uuid,boolean,text,text,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.redeem_partner_handoff_atomic(uuid,uuid,boolean,text,text,text,timestamptz)
  to service_role;
