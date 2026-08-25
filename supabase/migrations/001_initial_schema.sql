create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  date_of_birth date not null,
  employment_status text not null,
  income_band text not null,
  housing_status text not null,
  electoral_roll boolean not null default false,
  utilisation_pct numeric,
  missed_payments_last_12m int not null default 0,
  hard_applications_last_6m int not null default 0,
  has_revolving_credit boolean not null default false,
  has_direct_debit_for_credit boolean not null default false,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_utilisation_range check (utilisation_pct is null or (utilisation_pct >= 0 and utilisation_pct <= 100)),
  constraint profiles_nonnegative_missed check (missed_payments_last_12m >= 0),
  constraint profiles_nonnegative_apps check (hard_applications_last_6m >= 0)
);

create table public.user_missions (
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_slug text not null,
  state text not null default 'not_started',
  first_shown_at timestamptz,
  last_shown_at timestamptz,
  completed_at timestamptz,
  next_review_at timestamptz,
  primary key (user_id, mission_slug),
  constraint user_missions_valid_state check (state in ('not_started','started','completed','dismissed','deferred'))
);

create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_missions enable row level security;
alter table public.events enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "missions_select_own" on public.user_missions
  for select to authenticated using (auth.uid() = user_id);
create policy "missions_insert_own" on public.user_missions
  for insert to authenticated with check (auth.uid() = user_id);
create policy "missions_update_own" on public.user_missions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "events_insert_own" on public.events
  for insert to authenticated with check (auth.uid() = user_id);

revoke all on public.events from anon;
revoke select, update, delete on public.events from authenticated;
grant insert on public.events to authenticated;
