-- V2.0d Closed-Loop Decline Recovery foundation.
-- Additive and dark-first: no partner intake or Return-to-Origin path is enabled by this migration.

create table public.decline_partners (
  id uuid primary key default gen_random_uuid(),
  partner_key text not null unique,
  display_name text not null,
  enabled boolean not null default false,
  sandbox_enabled boolean not null default false,
  live_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.decline_partner_credentials (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.decline_partners(id) on delete cascade,
  credential_key text not null unique,
  secret_reference text not null,
  enabled boolean not null default false,
  valid_from timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint decline_partner_credentials_expiry_check
    check (expires_at is null or expires_at > valid_from)
);

create table public.return_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_key text not null unique,
  partner_id uuid not null references public.decline_partners(id) on delete restrict,
  environment text not null check (environment in ('sandbox','live')),
  destination_url text not null,
  product_category text not null
    check (product_category in ('credit_card','loan','overdraft','mortgage','other')),
  disclosure_key text not null,
  disclosure_version integer not null default 1 check (disclosure_version >= 1),
  callback_policy text not null default 'none'
    check (callback_policy in ('none','ready_for_recheck')),
  callback_url text,
  enabled boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint return_contract_destination_check check (
    (environment = 'sandbox' and destination_url like '/sandbox/%')
    or (environment = 'live' and destination_url like 'https://%')
  ),
  constraint return_contract_callback_check check (
    callback_url is null or callback_url like 'https://%'
  )
);

create table public.decline_intake_sessions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.decline_partners(id) on delete restrict,
  credential_id uuid references public.decline_partner_credentials(id) on delete set null,
  return_contract_id uuid references public.return_contracts(id) on delete set null,
  environment text not null check (environment in ('sandbox','live')),
  origin_reference text not null,
  product_category text not null
    check (product_category in ('credit_card','loan','overdraft','mortgage','other')),
  declined_at timestamptz not null,
  decline_reason_code text,
  decline_reason_source text not null default 'unknown'
    check (decline_reason_source in ('partner','unknown')),
  attribution_key text,
  additional_support_may_be_needed boolean,
  disclosure_version text,
  consent_version text,
  idempotency_key text not null,
  nonce text not null,
  request_timestamp timestamptz not null,
  token_hash text not null unique,
  token_expires_at timestamptz not null,
  consumed_at timestamptz,
  bound_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (partner_id, idempotency_key),
  unique (partner_id, nonce),
  constraint decline_intake_token_expiry_check
    check (token_expires_at > created_at),
  constraint decline_intake_consumed_check
    check (consumed_at is null or consumed_at >= created_at)
);

create table public.decline_recovery_journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intake_session_id uuid unique references public.decline_intake_sessions(id) on delete set null,
  origin text not null check (origin in ('direct','partner')),
  product_category text not null
    check (product_category in ('credit_card','loan','overdraft','mortgage','other')),
  declined_at timestamptz not null,
  provider_display_name text,
  decline_reason_known boolean not null default false,
  decline_reason_code text,
  decline_reason_source text not null default 'unknown'
    check (decline_reason_source in ('partner','customer','unknown')),
  context_confirmation text not null default 'pending'
    check (context_confirmation in ('pending','confirmed','corrected','unknown','optional_use_declined')),
  stage text not null default 'intake'
    check (stage in ('intake','crisis_recovery','stability','rebuilding','optimisation','ready_to_check','completed')),
  next_reassessment_at timestamptz,
  last_reassessed_at timestamptz,
  readiness_snapshot text
    check (readiness_snapshot is null or readiness_snapshot in ('not_ready','getting_closer','ready_to_check','unknown')),
  return_eligibility_state text not null default 'not_assessed'
    check (return_eligibility_state in ('not_assessed','blocked','ready_to_check','returned','declined_return')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint decline_recovery_reason_truth_check check (
    (decline_reason_known = false and decline_reason_code is null and decline_reason_source = 'unknown')
    or (decline_reason_known = true and decline_reason_code is not null and decline_reason_source in ('partner','customer'))
  )
);

create table public.support_needs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  need_code text not null
    check (need_code in (
      'simpler_explanations','larger_text','fewer_steps','more_time',
      'reduced_motion','reminder_support','human_support','digital_support'
    )),
  source text not null default 'customer'
    check (source in ('customer','partner_signal','credit_quest')),
  confirmation_state text not null default 'confirmed'
    check (confirmation_state in ('pending','confirmed','declined','cleared')),
  effective_at timestamptz not null default now(),
  review_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, need_code),
  constraint support_needs_review_check
    check (review_at is null or review_at >= effective_at),
  constraint support_needs_expiry_check
    check (expires_at is null or expires_at >= effective_at)
);

create table public.return_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recovery_journey_id uuid not null,
  partner_id uuid not null references public.decline_partners(id) on delete restrict,
  return_contract_id uuid not null references public.return_contracts(id) on delete restrict,
  environment text not null check (environment in ('sandbox','live')),
  readiness_snapshot text not null check (readiness_snapshot = 'ready_to_check'),
  disclosure_key text not null,
  disclosure_version integer not null check (disclosure_version >= 1),
  customer_choice text not null check (customer_choice in ('continue','decline')),
  outcome text not null default 'created'
    check (outcome in ('created','redirected','callback_queued','callback_sent','declined','suppressed','failed')),
  suppression_reason text,
  callback_status text not null default 'not_applicable'
    check (callback_status in ('not_applicable','queued','sent','acknowledged','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint return_attempt_journey_owner_fkey
    foreign key (recovery_journey_id, user_id)
    references public.decline_recovery_journeys(id, user_id)
    on delete cascade
);

create index decline_partner_credentials_partner_idx
  on public.decline_partner_credentials(partner_id, enabled);
create index decline_intake_sessions_partner_created_idx
  on public.decline_intake_sessions(partner_id, created_at desc);
create index decline_intake_sessions_expiry_idx
  on public.decline_intake_sessions(token_expires_at)
  where consumed_at is null;
create index decline_intake_sessions_bound_user_idx
  on public.decline_intake_sessions(bound_user_id)
  where bound_user_id is not null;
create index decline_recovery_journeys_user_time_idx
  on public.decline_recovery_journeys(user_id, started_at desc);
create index decline_recovery_journeys_reassessment_idx
  on public.decline_recovery_journeys(next_reassessment_at)
  where next_reassessment_at is not null;
create index support_needs_user_idx
  on public.support_needs(user_id, updated_at desc);
create index return_contracts_partner_env_idx
  on public.return_contracts(partner_id, environment, enabled);
create index return_attempts_user_time_idx
  on public.return_attempts(user_id, created_at desc);

alter table public.decline_partners enable row level security;
alter table public.decline_partner_credentials enable row level security;
alter table public.decline_intake_sessions enable row level security;
alter table public.decline_recovery_journeys enable row level security;
alter table public.support_needs enable row level security;
alter table public.return_contracts enable row level security;
alter table public.return_attempts enable row level security;

create policy "decline_recovery_journeys_select_own" on public.decline_recovery_journeys
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "support_needs_select_own" on public.support_needs
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "return_attempts_select_own" on public.return_attempts
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.decline_partners from anon, authenticated;
revoke all on public.decline_partner_credentials from anon, authenticated;
revoke all on public.decline_intake_sessions from anon, authenticated;
revoke all on public.return_contracts from anon, authenticated;

grant all on public.decline_partners to service_role;
grant all on public.decline_partner_credentials to service_role;
grant all on public.decline_intake_sessions to service_role;
grant all on public.return_contracts to service_role;

revoke all on public.decline_recovery_journeys from anon;
revoke all on public.support_needs from anon;
revoke all on public.return_attempts from anon;
revoke insert, update, delete on public.decline_recovery_journeys from authenticated;
revoke insert, update, delete on public.support_needs from authenticated;
revoke insert, update, delete on public.return_attempts from authenticated;
grant select on public.decline_recovery_journeys to authenticated;
grant select on public.support_needs to authenticated;
grant select on public.return_attempts to authenticated;
grant all on public.decline_recovery_journeys to service_role;
grant all on public.support_needs to service_role;
grant all on public.return_attempts to service_role;

insert into public.feature_flags(flag_key, enabled, description) values
  ('partner_decline_intake_enabled', false, 'Allow authenticated sandbox partner decline intake processing.'),
  ('return_to_origin_enabled', false, 'Allow customer-controlled sandbox Return-to-Origin after all independent gates pass.')
on conflict (flag_key) do update set
  enabled = false,
  description = excluded.description,
  updated_at = now();

create or replace function public.admin_set_feature_flag(
  p_admin_user_id uuid,
  p_flag_key text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_credit_quest_admin(p_admin_user_id);

  if p_flag_key not in (
    'email_reminders_enabled',
    'commercial_gateway_enabled',
    'commercial_sandbox_enabled',
    'partner_decline_intake_enabled',
    'return_to_origin_enabled'
  ) then
    raise exception 'Feature flag is not admin-editable';
  end if;

  update public.feature_flags
  set enabled = p_enabled, updated_at = now()
  where flag_key = p_flag_key;

  if not found then
    raise exception 'Feature flag not found';
  end if;

  insert into public.admin_audit_log(admin_user_id, action, entity_type, metadata)
  values (
    p_admin_user_id,
    'set_feature_flag',
    'feature_flag',
    jsonb_build_object('flag_key', p_flag_key, 'enabled', p_enabled)
  );
end;
$$;

revoke all on function public.admin_set_feature_flag(uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.admin_set_feature_flag(uuid,text,boolean) to service_role;
