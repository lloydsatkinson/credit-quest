alter table public.profiles alter column electoral_roll drop not null;
alter table public.profiles alter column electoral_roll drop default;
alter table public.profiles alter column missed_payments_last_12m drop not null;
alter table public.profiles alter column missed_payments_last_12m drop default;
alter table public.profiles alter column hard_applications_last_6m drop not null;
alter table public.profiles alter column hard_applications_last_6m drop default;
alter table public.profiles alter column has_revolving_credit drop not null;
alter table public.profiles alter column has_revolving_credit drop default;
alter table public.profiles alter column has_direct_debit_for_credit drop not null;
alter table public.profiles alter column has_direct_debit_for_credit drop default;

alter table public.user_missions
  drop constraint if exists user_missions_valid_state;

alter table public.user_missions
  add constraint user_missions_valid_state
  check (state in (
    'eligible', 'shown', 'not_started', 'started', 'completed',
    'deferred', 'dismissed', 'in_review', 'cooldown', 'no_longer_eligible'
  ));

alter table public.user_missions
  add column if not exists started_at timestamptz,
  add column if not exists deferred_at timestamptz,
  add column if not exists dismissed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
