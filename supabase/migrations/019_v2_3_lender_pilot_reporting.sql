-- Credit Quest V2.3 lender pilot reporting boundary.
-- Reporting configuration is service-role-only and does not enable any live route.

create table public.recovery_pilots (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.decline_partners(id) on delete restrict,
  pilot_key text not null check (char_length(btrim(pilot_key)) between 1 and 120),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 160),
  pilot_type text not null default 'sandbox' check (pilot_type in ('synthetic','sandbox','live')),
  product_category text check (product_category is null or product_category in ('credit_card','loan','overdraft','mortgage','other')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (partner_id, pilot_key),
  unique (id, partner_id),
  constraint recovery_pilot_window_check check (ends_at is null or ends_at > starts_at)
);

create table public.recovery_pilot_assignments (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null,
  partner_id uuid not null references public.decline_partners(id) on delete restrict,
  intake_session_id uuid not null unique references public.decline_intake_sessions(id) on delete cascade,
  canonical_reason_codes text[] not null default array[]::text[],
  synthetic boolean not null default false,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (pilot_id, intake_session_id),
  constraint recovery_pilot_assignment_partner_fkey
    foreign key (pilot_id, partner_id)
    references public.recovery_pilots(id, partner_id)
    on delete cascade,
  constraint recovery_pilot_assignment_reason_codes_check
    check (cardinality(canonical_reason_codes) <= 8)
);

create table public.lender_portal_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references public.decline_partners(id) on delete cascade,
  pilot_id uuid not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, pilot_id),
  constraint lender_portal_member_partner_fkey
    foreign key (pilot_id, partner_id)
    references public.recovery_pilots(id, partner_id)
    on delete cascade
);

alter table public.recovery_pilots enable row level security;
alter table public.recovery_pilot_assignments enable row level security;
alter table public.lender_portal_members enable row level security;

revoke all on public.recovery_pilots from anon, authenticated;
revoke all on public.recovery_pilot_assignments from anon, authenticated;
revoke all on public.lender_portal_members from anon, authenticated;
grant all on public.recovery_pilots to service_role;
grant all on public.recovery_pilot_assignments to service_role;
grant all on public.lender_portal_members to service_role;

create index recovery_pilots_partner_idx on public.recovery_pilots(partner_id, starts_at desc);
create index recovery_pilot_assignments_scope_idx on public.recovery_pilot_assignments(partner_id, pilot_id, assigned_at desc);
create index lender_portal_members_user_idx on public.lender_portal_members(user_id, enabled);

-- Preserve historical Ready-to-Check truth even if the current journey snapshot later changes.
alter table public.decline_recovery_journeys
  add column first_ready_to_check_at timestamptz;

update public.decline_recovery_journeys
set first_ready_to_check_at = coalesce(last_reassessed_at, updated_at, started_at)
where readiness_snapshot = 'ready_to_check'
  and first_ready_to_check_at is null;

create or replace function public.capture_first_ready_to_check()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.first_ready_to_check_at is not null then
    new.first_ready_to_check_at := old.first_ready_to_check_at;
  end if;

  if new.first_ready_to_check_at is null and new.readiness_snapshot = 'ready_to_check' then
    new.first_ready_to_check_at := coalesce(new.last_reassessed_at, new.updated_at, now());
  end if;

  return new;
end;
$$;

create trigger decline_recovery_journeys_capture_first_ready
before insert or update on public.decline_recovery_journeys
for each row execute function public.capture_first_ready_to_check();

revoke all on function public.capture_first_ready_to_check() from public, anon, authenticated;
grant execute on function public.capture_first_ready_to_check() to service_role;

-- Route type is server-owned. Existing Return-to-Origin attempts remain original-product attempts.
alter table public.return_attempts
  add column route_type text not null default 'original'
  check (route_type in ('original','alternative'));
