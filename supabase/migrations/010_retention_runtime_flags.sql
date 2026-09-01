create table public.journey_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null
    check (reason in ('mission_incomplete','cooldown_ending','reassessment_due','readiness_changed')),
  channel text not null check (channel in ('in_app','email')),
  status text not null default 'scheduled'
    check (status in ('scheduled','processing','sent','suppressed','failed','cancelled')),
  due_at timestamptz not null,
  source_outcome_id uuid references public.journey_outcomes(id) on delete set null,
  source_key text not null,
  template_key text not null,
  template_version integer not null default 1 check (template_version >= 1),
  suppression_reason text,
  sent_at timestamptz,
  provider_reference text,
  ai_assist_status text not null default 'not_used'
    check (ai_assist_status in ('not_used','used','rejected','failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  claimed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, channel, reason, source_key)
);

create table public.communication_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  journey_email_enabled boolean not null default false,
  journey_email_suppressed_at timestamptz,
  suppression_reason text,
  updated_at timestamptz not null default now()
);

create table public.feature_flags (
  flag_key text primary key,
  enabled boolean not null default false,
  description text not null,
  updated_at timestamptz not null default now()
);

insert into public.feature_flags(flag_key, enabled, description) values
  ('email_reminders_enabled', false, 'Allow due journey service emails to be sent.'),
  ('commercial_gateway_enabled', false, 'Allow commercial gateway processing after all hard gates.')
on conflict (flag_key) do nothing;

create index journey_reminders_due_idx
  on public.journey_reminders(status, due_at);

create index journey_reminders_user_due_idx
  on public.journey_reminders(user_id, due_at desc);

alter table public.journey_reminders enable row level security;
alter table public.communication_preferences enable row level security;
alter table public.feature_flags enable row level security;

create policy "journey_reminders_select_own" on public.journey_reminders
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "communication_preferences_select_own" on public.communication_preferences
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.journey_reminders from anon;
revoke all on public.communication_preferences from anon;
revoke all on public.feature_flags from anon, authenticated;

revoke insert, update, delete on public.journey_reminders from authenticated;
revoke insert, update, delete on public.communication_preferences from authenticated;
grant select on public.journey_reminders to authenticated;
grant select on public.communication_preferences to authenticated;

grant all on public.journey_reminders to service_role;
grant all on public.communication_preferences to service_role;
grant all on public.feature_flags to service_role;

create or replace function public.claim_due_journey_reminders(
  p_limit integer,
  p_now timestamptz
)
returns setof public.journey_reminders
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'p_limit must be between 1 and 100';
  end if;

  return query
  with claimable as (
    select id
    from public.journey_reminders
    where channel = 'email'
      and due_at <= p_now
      and (
        status = 'scheduled'
        or (
          status = 'processing'
          and claimed_at < p_now - interval '6 hours'
        )
      )
    order by due_at asc, id asc
    for update skip locked
    limit p_limit
  )
  update public.journey_reminders r
  set status = 'processing',
      attempt_count = r.attempt_count + 1,
      claimed_at = p_now,
      last_error = null,
      updated_at = p_now
  from claimable c
  where r.id = c.id
  returning r.*;
end;
$$;

revoke all on function public.claim_due_journey_reminders(integer, timestamptz) from public;
revoke all on function public.claim_due_journey_reminders(integer, timestamptz) from anon;
revoke all on function public.claim_due_journey_reminders(integer, timestamptz) from authenticated;
grant execute on function public.claim_due_journey_reminders(integer, timestamptz) to service_role;
