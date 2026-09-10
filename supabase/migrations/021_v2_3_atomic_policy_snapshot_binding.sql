-- Credit Quest V2.3 activation durability hardening.
-- Freeze policy before redemption, then consume the handoff, create the recovery
-- journey and persist that exact snapshot inside one PostgreSQL transaction.

create or replace function public.redeem_partner_handoff_with_policy_snapshot_atomic(
  p_session_id uuid,
  p_user_id uuid,
  p_decline_reason_known boolean,
  p_decline_reason_code text,
  p_decline_reason_source text,
  p_context_confirmation text,
  p_policy_snapshot jsonb,
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
     or p_context_confirmation is null
     or p_policy_snapshot is null
     or jsonb_typeof(p_policy_snapshot) <> 'object'
     or p_policy_snapshot ->> 'schemaVersion' <> '1'
     or jsonb_typeof(p_policy_snapshot -> 'partnerReasons') <> 'array' then
    raise exception 'handoff_unavailable';
  end if;

  select enabled
  into v_intake_enabled
  from public.feature_flags
  where flag_key = 'partner_decline_intake_enabled'
  for update;

  if coalesce(v_intake_enabled, false) is not true then
    raise exception 'handoff_unavailable';
  end if;

  select
    s.id,
    s.partner_id,
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

  -- The server-built frozen snapshot must describe this exact activation.
  if p_policy_snapshot ->> 'partnerId' <> v_session.partner_id::text
     or p_policy_snapshot ->> 'productCategory' <> v_session.product_category::text
     or p_policy_snapshot ->> 'contextConfirmation' <> p_context_confirmation then
    raise exception 'handoff_unavailable';
  end if;

  update public.decline_intake_sessions
  set
    consumed_at = p_now,
    bound_user_id = p_user_id
  where id = p_session_id
    and environment = 'sandbox'
    and consumed_at is null
    and bound_user_id is null
    and token_expires_at > p_now;

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

  insert into public.recovery_policy_snapshots(
    recovery_journey_id,
    partner_id,
    product_category,
    policy_snapshot,
    created_at
  ) values (
    v_journey_id,
    v_session.partner_id,
    v_session.product_category,
    p_policy_snapshot,
    p_now
  );

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

revoke all on function public.redeem_partner_handoff_with_policy_snapshot_atomic(
  uuid,uuid,boolean,text,text,text,jsonb,timestamptz
) from public, anon, authenticated;
grant execute on function public.redeem_partner_handoff_with_policy_snapshot_atomic(
  uuid,uuid,boolean,text,text,text,jsonb,timestamptz
) to service_role;
