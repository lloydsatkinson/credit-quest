-- Credit Quest V2.3 multi-reason intake and immutable activation snapshots.
-- Additive and service-role-only. No live routing or feature flag is enabled.

create table public.decline_intake_reasons (
  id uuid primary key default gen_random_uuid(),
  intake_session_id uuid not null references public.decline_intake_sessions(id) on delete cascade,
  ordinal integer not null check (ordinal between 1 and 8),
  external_code text not null check (char_length(btrim(external_code)) between 1 and 160),
  created_at timestamptz not null default now(),
  unique (intake_session_id, ordinal),
  unique (intake_session_id, external_code)
);

create table public.recovery_policy_snapshots (
  id uuid primary key default gen_random_uuid(),
  recovery_journey_id uuid not null unique references public.decline_recovery_journeys(id) on delete cascade,
  partner_id uuid references public.decline_partners(id) on delete restrict,
  product_category text not null
    check (product_category in ('credit_card','loan','overdraft','mortgage','other')),
  policy_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.decline_intake_reasons enable row level security;
alter table public.recovery_policy_snapshots enable row level security;
revoke all on public.decline_intake_reasons from anon, authenticated;
revoke all on public.recovery_policy_snapshots from anon, authenticated;
grant all on public.decline_intake_reasons to service_role;
grant all on public.recovery_policy_snapshots to service_role;

create or replace function public.reject_recovery_policy_snapshot_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'recovery_policy_snapshot_is_immutable' using errcode = '55000';
end;
$$;

create trigger recovery_policy_snapshots_immutable
before update or delete on public.recovery_policy_snapshots
for each row execute function public.reject_recovery_policy_snapshot_mutation();

create or replace function public.create_partner_intake_with_reasons_atomic(
  p_partner_id uuid,
  p_credential_id uuid,
  p_return_contract_id uuid,
  p_environment text,
  p_origin_reference text,
  p_product_category text,
  p_declined_at timestamptz,
  p_decline_reason_code text,
  p_decline_reason_codes text[],
  p_decline_reason_source text,
  p_attribution_key text,
  p_additional_support_may_be_needed boolean,
  p_disclosure_version text,
  p_consent_version text,
  p_idempotency_key text,
  p_nonce text,
  p_request_timestamp timestamptz,
  p_token_hash text,
  p_token_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_reasons text[] := coalesce(p_decline_reason_codes, array[]::text[]);
begin
  if p_environment <> 'sandbox' or cardinality(v_reasons) > 8 then
    raise exception 'invalid_partner_intake';
  end if;

  if exists (
    select 1 from unnest(v_reasons) as r(code)
    where r.code is null or char_length(btrim(r.code)) not between 1 and 160
  ) then
    raise exception 'invalid_partner_intake';
  end if;

  if (select count(*) from unnest(v_reasons)) <>
     (select count(distinct r.code) from unnest(v_reasons) as r(code)) then
    raise exception 'invalid_partner_intake';
  end if;

  insert into public.decline_intake_sessions(
    partner_id, credential_id, return_contract_id, environment, origin_reference,
    product_category, declined_at, decline_reason_code, decline_reason_source,
    attribution_key, additional_support_may_be_needed, disclosure_version,
    consent_version, idempotency_key, nonce, request_timestamp, token_hash,
    token_expires_at
  ) values (
    p_partner_id, p_credential_id, p_return_contract_id, p_environment, p_origin_reference,
    p_product_category, p_declined_at, p_decline_reason_code, p_decline_reason_source,
    p_attribution_key, p_additional_support_may_be_needed, p_disclosure_version,
    p_consent_version, p_idempotency_key, p_nonce, p_request_timestamp, p_token_hash,
    p_token_expires_at
  ) returning id into v_session_id;

  insert into public.decline_intake_reasons(intake_session_id, ordinal, external_code)
  select v_session_id, r.ordinality::integer, r.code
  from unnest(v_reasons) with ordinality as r(code, ordinality);

  return v_session_id;
end;
$$;

revoke all on function public.create_partner_intake_with_reasons_atomic(
  uuid,uuid,uuid,text,text,text,timestamptz,text,text[],text,text,boolean,text,text,text,text,timestamptz,text,timestamptz
) from public, anon, authenticated;
grant execute on function public.create_partner_intake_with_reasons_atomic(
  uuid,uuid,uuid,text,text,text,timestamptz,text,text[],text,text,boolean,text,text,text,text,timestamptz,text,timestamptz
) to service_role;
