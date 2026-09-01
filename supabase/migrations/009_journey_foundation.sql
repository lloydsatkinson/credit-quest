create table public.journey_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stage text not null,
  active_mission_id uuid,
  next_reassessment_at timestamptz,
  last_reassessed_at timestamptz,
  last_readiness_band text,
  updated_at timestamptz not null default now(),
  constraint journey_state_stage_check
    check (stage in ('onboarding','active_mission','waiting','cooldown','reassessment_due','ready','optimising')),
  constraint journey_state_readiness_check
    check (last_readiness_band is null or last_readiness_band in ('red','amber','green','unknown')),
  constraint journey_state_mission_owner_fkey
    foreign key (active_mission_id, user_id)
    references public.user_missions(id, user_id)
    on delete set null (active_mission_id)
);

create table public.journey_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  source text not null,
  source_key text not null,
  mission_instance_id uuid,
  readiness_before text,
  readiness_after text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint journey_outcomes_type_check
    check (event_type in ('onboarding_completed','mission_started','mission_completed','mission_deferred','action_submitted','action_verified','cooldown_started','cooldown_ended','reassessment_performed','readiness_changed')),
  constraint journey_outcomes_source_check
    check (source in ('onboarding','mission','action','reassessment')),
  constraint journey_outcomes_before_check
    check (readiness_before is null or readiness_before in ('red','amber','green','unknown')),
  constraint journey_outcomes_after_check
    check (readiness_after is null or readiness_after in ('red','amber','green','unknown')),
  constraint journey_outcomes_source_unique unique (user_id, source_key),
  constraint journey_outcomes_mission_owner_fkey
    foreign key (mission_instance_id, user_id)
    references public.user_missions(id, user_id)
    on delete set null (mission_instance_id)
);

create index journey_state_reassessment_due_idx
  on public.journey_state(next_reassessment_at)
  where next_reassessment_at is not null;

create index journey_outcomes_user_time_idx
  on public.journey_outcomes(user_id, occurred_at desc);

alter table public.journey_state enable row level security;
alter table public.journey_outcomes enable row level security;

create policy "journey_state_select_own" on public.journey_state
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "journey_outcomes_select_own" on public.journey_outcomes
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.journey_state from anon;
revoke all on public.journey_outcomes from anon;
revoke insert, update, delete on public.journey_state from authenticated;
revoke insert, update, delete on public.journey_outcomes from authenticated;
grant select on public.journey_state to authenticated;
grant select on public.journey_outcomes to authenticated;
grant all on public.journey_state to service_role;
grant all on public.journey_outcomes to service_role;

create or replace function public.reject_journey_outcome_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'journey_outcomes are append-only';
end;
$$;

revoke all on function public.reject_journey_outcome_update() from public;

create trigger journey_outcomes_reject_update
before update on public.journey_outcomes
for each row execute function public.reject_journey_outcome_update();
