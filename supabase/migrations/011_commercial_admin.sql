create table public.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role = 'admin'),
  created_at timestamptz not null default now()
);

create table public.commercial_partners (
  id uuid primary key default gen_random_uuid(),
  partner_key text not null unique,
  display_name text not null,
  enabled boolean not null default false,
  sandbox_enabled boolean not null default false,
  live_enabled boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.commercial_disclosures (
  id uuid primary key default gen_random_uuid(),
  disclosure_key text not null,
  version integer not null check (version >= 1),
  status text not null check (status in ('draft','reviewed','published','superseded','archived')),
  body text not null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (disclosure_key, version)
);

create unique index commercial_disclosures_one_published
  on public.commercial_disclosures(disclosure_key)
  where status = 'published';

create table public.commercial_routes (
  id uuid primary key default gen_random_uuid(),
  route_key text not null unique,
  partner_id uuid not null references public.commercial_partners(id) on delete restrict,
  environment text not null check (environment in ('sandbox','live')),
  destination_url text not null,
  enabled boolean not null default false,
  min_age integer not null default 18 check (min_age >= 18),
  required_readiness text not null default 'green' check (required_readiness = 'green'),
  disclosure_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_route_destination_check check (
    (environment = 'sandbox' and destination_url like '/sandbox/%')
    or (environment = 'live' and destination_url like 'https://%')
  )
);

create table public.referral_attempts (
  id uuid primary key default gen_random_uuid(),
  referral_key text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references public.commercial_partners(id) on delete restrict,
  route_id uuid not null references public.commercial_routes(id) on delete restrict,
  originating_mission_id uuid,
  readiness_snapshot text not null check (readiness_snapshot = 'green'),
  consented_at timestamptz not null,
  disclosure_id uuid not null references public.commercial_disclosures(id) on delete restrict,
  environment text not null check (environment in ('sandbox','live')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint referral_mission_owner_fkey
    foreign key (originating_mission_id, user_id)
    references public.user_missions(id, user_id)
    on delete set null (originating_mission_id)
);

create table public.revenue_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  referral_attempt_id uuid not null,
  event_type text not null check (event_type in ('click','lead','conversion','revenue','reversal','adjustment')),
  amount_minor integer check (amount_minor is null or amount_minor >= 0),
  currency text not null default 'GBP',
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint revenue_referral_owner_fkey
    foreign key (referral_attempt_id, user_id)
    references public.referral_attempts(id, user_id)
    on delete cascade
);

create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  experiment_key text not null unique,
  status text not null check (status in ('draft','active','paused','ended')),
  surface_key text not null,
  variants jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

alter table public.admin_members enable row level security;
alter table public.commercial_partners enable row level security;
alter table public.commercial_routes enable row level security;
alter table public.commercial_disclosures enable row level security;
alter table public.referral_attempts enable row level security;
alter table public.revenue_events enable row level security;
alter table public.experiments enable row level security;
alter table public.admin_audit_log enable row level security;

revoke all on public.admin_members from anon, authenticated;
revoke all on public.commercial_partners from anon, authenticated;
revoke all on public.commercial_routes from anon, authenticated;
revoke all on public.commercial_disclosures from anon, authenticated;
revoke all on public.referral_attempts from anon, authenticated;
revoke all on public.revenue_events from anon, authenticated;
revoke all on public.experiments from anon, authenticated;
revoke all on public.admin_audit_log from anon, authenticated;

grant all on public.admin_members to service_role;
grant all on public.commercial_partners to service_role;
grant all on public.commercial_routes to service_role;
grant all on public.commercial_disclosures to service_role;
grant all on public.referral_attempts to service_role;
grant all on public.revenue_events to service_role;
grant all on public.experiments to service_role;
grant all on public.admin_audit_log to service_role;

create or replace function public.reject_referral_attempt_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'referral_attempts are append-only';
end;
$$;

create trigger referral_attempts_reject_update
before update on public.referral_attempts
for each row execute function public.reject_referral_attempt_update();

create or replace function public.reject_revenue_event_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'revenue_events are append-only';
end;
$$;

create trigger revenue_events_reject_update
before update on public.revenue_events
for each row execute function public.reject_revenue_event_update();

create or replace function public.publish_commercial_disclosure(p_disclosure_id uuid)
returns public.commercial_disclosures
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.commercial_disclosures;
begin
  select * into target
  from public.commercial_disclosures
  where id = p_disclosure_id
  for update;

  if target.id is null then
    raise exception 'Disclosure not found';
  end if;
  if target.status <> 'reviewed' then
    raise exception 'Only reviewed disclosures can be published';
  end if;

  update public.commercial_disclosures
  set status = 'superseded', updated_at = now()
  where disclosure_key = target.disclosure_key
    and status = 'published'
    and id <> target.id;

  update public.commercial_disclosures
  set status = 'published',
      published_at = coalesce(published_at, now()),
      updated_at = now()
  where id = target.id
  returning * into target;

  return target;
end;
$$;

revoke all on function public.publish_commercial_disclosure(uuid) from public, anon, authenticated;
grant execute on function public.publish_commercial_disclosure(uuid) to service_role;

create or replace function public.assert_credit_quest_admin(p_admin_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.admin_members
    where user_id = p_admin_user_id and role = 'admin'
  ) then
    raise exception 'Admin access required';
  end if;
end;
$$;

revoke all on function public.assert_credit_quest_admin(uuid) from public, anon, authenticated;
grant execute on function public.assert_credit_quest_admin(uuid) to service_role;

create or replace function public.admin_upsert_commercial_partner(
  p_admin_user_id uuid,
  p_partner_id uuid,
  p_partner_key text,
  p_display_name text,
  p_enabled boolean,
  p_sandbox_enabled boolean,
  p_live_enabled boolean,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid := coalesce(p_partner_id, gen_random_uuid());
begin
  perform public.assert_credit_quest_admin(p_admin_user_id);

  insert into public.commercial_partners(
    id, partner_key, display_name, enabled, sandbox_enabled, live_enabled, notes
  ) values (
    target_id, p_partner_key, p_display_name, p_enabled, p_sandbox_enabled, p_live_enabled, p_notes
  )
  on conflict (id) do update set
    partner_key = excluded.partner_key,
    display_name = excluded.display_name,
    enabled = excluded.enabled,
    sandbox_enabled = excluded.sandbox_enabled,
    live_enabled = excluded.live_enabled,
    notes = excluded.notes,
    updated_at = now();

  insert into public.admin_audit_log(admin_user_id, action, entity_type, entity_id, metadata)
  values (p_admin_user_id, 'upsert', 'commercial_partner', target_id, jsonb_build_object('partner_key', p_partner_key));

  return target_id;
end;
$$;

revoke all on function public.admin_upsert_commercial_partner(uuid,uuid,text,text,boolean,boolean,boolean,text) from public, anon, authenticated;
grant execute on function public.admin_upsert_commercial_partner(uuid,uuid,text,text,boolean,boolean,boolean,text) to service_role;

create or replace function public.admin_upsert_commercial_route(
  p_admin_user_id uuid,
  p_route_id uuid,
  p_route_key text,
  p_partner_id uuid,
  p_environment text,
  p_destination_url text,
  p_enabled boolean,
  p_disclosure_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid := coalesce(p_route_id, gen_random_uuid());
begin
  perform public.assert_credit_quest_admin(p_admin_user_id);

  insert into public.commercial_routes(
    id, route_key, partner_id, environment, destination_url, enabled,
    min_age, required_readiness, disclosure_key
  ) values (
    target_id, p_route_key, p_partner_id, p_environment, p_destination_url, p_enabled,
    18, 'green', p_disclosure_key
  )
  on conflict (id) do update set
    route_key = excluded.route_key,
    partner_id = excluded.partner_id,
    environment = excluded.environment,
    destination_url = excluded.destination_url,
    enabled = excluded.enabled,
    min_age = 18,
    required_readiness = 'green',
    disclosure_key = excluded.disclosure_key,
    updated_at = now();

  insert into public.admin_audit_log(admin_user_id, action, entity_type, entity_id, metadata)
  values (p_admin_user_id, 'upsert', 'commercial_route', target_id, jsonb_build_object('route_key', p_route_key, 'environment', p_environment));

  return target_id;
end;
$$;

revoke all on function public.admin_upsert_commercial_route(uuid,uuid,text,uuid,text,text,boolean,text) from public, anon, authenticated;
grant execute on function public.admin_upsert_commercial_route(uuid,uuid,text,uuid,text,text,boolean,text) to service_role;

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

  if p_flag_key not in ('email_reminders_enabled','commercial_gateway_enabled') then
    raise exception 'Feature flag is not admin-editable';
  end if;

  update public.feature_flags
  set enabled = p_enabled, updated_at = now()
  where flag_key = p_flag_key;

  if not found then
    raise exception 'Feature flag not found';
  end if;

  insert into public.admin_audit_log(admin_user_id, action, entity_type, metadata)
  values (p_admin_user_id, 'set_feature_flag', 'feature_flag', jsonb_build_object('flag_key', p_flag_key, 'enabled', p_enabled));
end;
$$;

revoke all on function public.admin_set_feature_flag(uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.admin_set_feature_flag(uuid,text,boolean) to service_role;

create or replace function public.admin_upsert_experiment(
  p_admin_user_id uuid,
  p_experiment_id uuid,
  p_experiment_key text,
  p_status text,
  p_surface_key text,
  p_variants jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid := coalesce(p_experiment_id, gen_random_uuid());
begin
  perform public.assert_credit_quest_admin(p_admin_user_id);

  insert into public.experiments(id, experiment_key, status, surface_key, variants)
  values (target_id, p_experiment_key, p_status, p_surface_key, p_variants)
  on conflict (id) do update set
    experiment_key = excluded.experiment_key,
    status = excluded.status,
    surface_key = excluded.surface_key,
    variants = excluded.variants,
    updated_at = now();

  insert into public.admin_audit_log(admin_user_id, action, entity_type, entity_id, metadata)
  values (p_admin_user_id, 'upsert', 'experiment', target_id, jsonb_build_object('experiment_key', p_experiment_key));

  return target_id;
end;
$$;

revoke all on function public.admin_upsert_experiment(uuid,uuid,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.admin_upsert_experiment(uuid,uuid,text,text,text,jsonb) to service_role;

create or replace function public.admin_publish_commercial_disclosure(
  p_admin_user_id uuid,
  p_disclosure_id uuid
)
returns public.commercial_disclosures
language plpgsql
security definer
set search_path = public
as $$
declare
  published public.commercial_disclosures;
begin
  perform public.assert_credit_quest_admin(p_admin_user_id);
  published := public.publish_commercial_disclosure(p_disclosure_id);

  insert into public.admin_audit_log(admin_user_id, action, entity_type, entity_id, metadata)
  values (
    p_admin_user_id,
    'publish',
    'commercial_disclosure',
    p_disclosure_id,
    jsonb_build_object('disclosure_key', published.disclosure_key, 'version', published.version)
  );

  return published;
end;
$$;

revoke all on function public.admin_publish_commercial_disclosure(uuid,uuid) from public, anon, authenticated;
grant execute on function public.admin_publish_commercial_disclosure(uuid,uuid) to service_role;

insert into public.commercial_partners(partner_key, display_name, enabled, sandbox_enabled, live_enabled)
values ('credit-quest-sandbox', 'Credit Quest Sandbox Partner', true, true, false)
on conflict (partner_key) do nothing;

insert into public.commercial_disclosures(disclosure_key, version, status, body, reviewed_at, published_at)
values (
  'sandbox-referral-disclosure',
  1,
  'published',
  'Sandbox only. No lender or credit application is contacted. This journey exists to test Credit Quest consent, attribution and safety controls.',
  now(),
  now()
)
on conflict (disclosure_key, version) do nothing;

insert into public.commercial_routes(
  route_key, partner_id, environment, destination_url, enabled, min_age, required_readiness, disclosure_key
)
select
  'credit-quest-sandbox-route',
  p.id,
  'sandbox',
  '/sandbox/referral-complete',
  false,
  18,
  'green',
  'sandbox-referral-disclosure'
from public.commercial_partners p
where p.partner_key = 'credit-quest-sandbox'
on conflict (route_key) do nothing;
