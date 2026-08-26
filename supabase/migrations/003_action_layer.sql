create extension if not exists pgcrypto;

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  display_name text not null,
  provider_type text not null,
  allowed_hosts text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint providers_type_check
    check (provider_type in ('government','bank','card_issuer','partner','generic'))
);

create table if not exists public.user_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid references public.providers(id),
  account_type text not null,
  nickname text,
  last_four text,
  balance_minor bigint,
  credit_limit_minor bigint,
  currency text not null default 'GBP',
  direct_debit_status text not null default 'unknown',
  source text not null default 'manual',
  active boolean not null default true,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_accounts_type_check
    check (account_type in ('credit_card','current_account','loan','other')),
  constraint user_accounts_last_four_check
    check (last_four is null or last_four ~ '^[0-9]{4}$'),
  constraint user_accounts_balance_nonnegative
    check (balance_minor is null or balance_minor >= 0),
  constraint user_accounts_limit_positive
    check (credit_limit_minor is null or credit_limit_minor > 0),
  constraint user_accounts_dd_check
    check (direct_debit_status in ('yes','no','unknown')),
  constraint user_accounts_source_check
    check (source in ('manual','open_banking'))
);

alter table public.user_missions
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists subject_type text not null default 'profile',
  add column if not exists subject_id uuid;

update public.user_missions
set id = gen_random_uuid()
where id is null;

alter table public.user_missions
  alter column id set not null;

alter table public.user_missions
  drop constraint if exists user_missions_pkey;

alter table public.user_missions
  add constraint user_missions_pkey primary key (id);

alter table public.user_missions
  drop constraint if exists user_missions_subject_type_check;

alter table public.user_missions
  add constraint user_missions_subject_type_check
  check (subject_type in ('profile','account'));

alter table public.user_missions
  drop constraint if exists user_missions_subject_account_check;

alter table public.user_missions
  add constraint user_missions_subject_account_check
  check (
    (subject_type = 'profile' and subject_id is null)
    or (subject_type = 'account' and subject_id is not null)
  );

alter table public.user_missions
  drop constraint if exists user_missions_subject_id_fkey;

alter table public.user_missions
  add constraint user_missions_subject_id_fkey
  foreign key (subject_id) references public.user_accounts(id) on delete cascade;

create unique index if not exists user_missions_profile_unique
  on public.user_missions(user_id, mission_slug)
  where subject_type = 'profile';

create unique index if not exists user_missions_account_unique
  on public.user_missions(user_id, mission_slug, subject_id)
  where subject_type = 'account';

create table if not exists public.action_registry (
  id uuid primary key default gen_random_uuid(),
  action_key text unique not null,
  mission_slug text not null,
  provider_id uuid references public.providers(id),
  account_type text,
  action_mode text not null,
  destination_url text,
  instructions text not null,
  verification_mode text not null,
  safe_mode_allowed boolean not null,
  min_age int,
  priority int not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint action_registry_account_type_check
    check (account_type is null or account_type in ('credit_card','current_account','loan','other')),
  constraint action_registry_mode_check
    check (action_mode in ('external_link','internal_flow','referral','api')),
  constraint action_registry_verification_check
    check (verification_mode in ('internal_state','self_confirm','self_confirm_review','api_verified','partner_callback')),
  constraint action_registry_min_age_check
    check (min_age is null or min_age >= 0)
);

create table if not exists public.action_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_instance_id uuid not null references public.user_missions(id) on delete cascade,
  action_registry_id uuid not null references public.action_registry(id),
  account_id uuid references public.user_accounts(id) on delete set null,
  status text not null,
  started_at timestamptz not null default now(),
  returned_at timestamptz,
  self_confirmed_at timestamptz,
  verified_at timestamptz,
  next_review_at timestamptz,
  external_reference text,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  constraint action_attempts_status_check
    check (status in ('started','returned','submitted','self_confirmed','verified','cancelled','failed'))
);

create index if not exists user_accounts_user_active_idx
  on public.user_accounts(user_id, active);

create index if not exists action_registry_mission_active_idx
  on public.action_registry(mission_slug, active);

create index if not exists action_attempts_user_status_idx
  on public.action_attempts(user_id, status, started_at desc);

alter table public.providers enable row level security;
alter table public.user_accounts enable row level security;
alter table public.action_registry enable row level security;
alter table public.action_attempts enable row level security;

create policy "providers_select_active" on public.providers
  for select to authenticated
  using (active = true);

create policy "accounts_select_own" on public.user_accounts
  for select to authenticated
  using (auth.uid() = user_id);

create policy "accounts_insert_own" on public.user_accounts
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "accounts_update_own" on public.user_accounts
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "action_registry_select_active" on public.action_registry
  for select to authenticated
  using (active = true);

create policy "action_attempts_select_own" on public.action_attempts
  for select to authenticated
  using (auth.uid() = user_id);

create policy "action_attempts_insert_own" on public.action_attempts
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "action_attempts_update_own" on public.action_attempts
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Government and major UK card/account providers. The provider directory is
-- configuration only; it does not imply an API partnership or data connection.
insert into public.providers (
  slug,
  display_name,
  provider_type,
  allowed_hosts,
  active
)
values
  ('gov-uk', 'GOV.UK', 'government', array['www.gov.uk','gov.uk'], true),
  ('barclaycard', 'Barclaycard', 'card_issuer', array['www.barclaycard.co.uk','barclaycard.co.uk'], true),
  ('capital-one-uk', 'Capital One UK', 'card_issuer', array['www.capitalone.co.uk','capitalone.co.uk'], true),
  ('lloyds-bank', 'Lloyds Bank', 'bank', array['www.lloydsbank.com','lloydsbank.com'], true),
  ('halifax', 'Halifax', 'bank', array['www.halifax.co.uk','halifax.co.uk'], true),
  ('mbna', 'MBNA', 'card_issuer', array['www.mbna.co.uk','mbna.co.uk'], true),
  ('natwest', 'NatWest', 'bank', array['www.natwest.com','natwest.com'], true),
  ('rbs', 'Royal Bank of Scotland', 'bank', array['www.rbs.co.uk','rbs.co.uk'], true),
  ('santander-uk', 'Santander UK', 'bank', array['www.santander.co.uk','santander.co.uk'], true),
  ('hsbc-uk', 'HSBC UK', 'bank', array['www.hsbc.co.uk','hsbc.co.uk'], true),
  ('american-express-uk', 'American Express UK', 'card_issuer', array['www.americanexpress.com','americanexpress.com'], true),
  ('tesco-bank', 'Tesco Bank', 'bank', array['www.tescobank.com','tescobank.com'], true),
  ('vanquis', 'Vanquis', 'card_issuer', array['www.vanquis.co.uk','vanquis.co.uk'], true),
  ('newday', 'NewDay (Aqua / Marbles / Fluid / Bip)', 'card_issuer', array['www.newday.co.uk','newday.co.uk','www.aquacard.co.uk','aquacard.co.uk'], true)
on conflict (slug) do update set
  display_name = excluded.display_name,
  provider_type = excluded.provider_type,
  allowed_hosts = excluded.allowed_hosts,
  active = true,
  updated_at = now();

insert into public.action_registry (
  action_key,
  mission_slug,
  provider_id,
  account_type,
  action_mode,
  destination_url,
  instructions,
  verification_mode,
  safe_mode_allowed,
  min_age,
  priority,
  active
)
select
  'electoral-roll-gov-uk',
  'register-electoral-roll',
  p.id,
  null,
  'external_link',
  'https://www.gov.uk/register-to-vote',
  'Use the official GOV.UK service to submit your registration. Returning to Credit Quest does not prove registration has taken effect.',
  'self_confirm_review',
  true,
  16,
  10,
  true
from public.providers p
where p.slug = 'gov-uk'
on conflict (action_key) do update set
  provider_id = excluded.provider_id,
  destination_url = excluded.destination_url,
  instructions = excluded.instructions,
  verification_mode = excluded.verification_mode,
  safe_mode_allowed = excluded.safe_mode_allowed,
  min_age = excluded.min_age,
  priority = excluded.priority,
  active = true,
  updated_at = now();

-- Exact provider routes are included only where a current, stable official
-- support journey was verified. Other issuers deliberately use the generic
-- fallback rather than a guessed or brittle login/deep-link URL.
insert into public.action_registry (
  action_key,
  mission_slug,
  provider_id,
  account_type,
  action_mode,
  destination_url,
  instructions,
  verification_mode,
  safe_mode_allowed,
  min_age,
  priority,
  active
)
select
  v.action_key,
  'set-up-direct-debit',
  p.id,
  'credit_card',
  'external_link',
  v.destination_url,
  v.instructions,
  'self_confirm',
  true,
  16,
  20,
  true
from (
  values
    (
      'direct-debit-capital-one-uk',
      'capital-one-uk',
      'https://www.capitalone.co.uk/support/worried-about-missed-payments',
      'Capital One says you can set up or edit your Direct Debit in the app or after signing in online. Use the official support journey, then return to Credit Quest to confirm the target card.'
    ),
    (
      'direct-debit-lloyds-bank',
      'lloyds-bank',
      'https://www.lloydsbank.com/credit-cards/ways-to-pay-your-credit-card.html',
      'Lloyds Bank provides Direct Debit setup through its app and Online Banking. Follow the official payment guidance, then return to Credit Quest to confirm the target card.'
    ),
    (
      'direct-debit-halifax',
      'halifax',
      'https://www.halifax.co.uk/creditcards/ways-to-pay-your-credit-card/pay-by-direct-debit.html',
      'Halifax provides Direct Debit setup through its app and Online Banking. Follow the official guidance, then return to Credit Quest to confirm the target card.'
    ),
    (
      'direct-debit-mbna',
      'mbna',
      'https://www.mbna.co.uk/credit-cards/help-and-support/making-payments.html',
      'MBNA provides Direct Debit setup through its app and Online Services. Follow the official payment guidance, then return to Credit Quest to confirm the target card.'
    ),
    (
      'direct-debit-natwest',
      'natwest',
      'https://www.natwest.com/support-centre/payments/general/pay-my-credit-card-with-direct-debit.html',
      'NatWest provides Direct Debit setup through its app and Online Banking. Follow the official guidance, then return to Credit Quest to confirm the target card.'
    )
) as v(action_key, provider_slug, destination_url, instructions)
join public.providers p on p.slug = v.provider_slug
on conflict (action_key) do update set
  provider_id = excluded.provider_id,
  account_type = excluded.account_type,
  action_mode = excluded.action_mode,
  destination_url = excluded.destination_url,
  instructions = excluded.instructions,
  verification_mode = excluded.verification_mode,
  safe_mode_allowed = excluded.safe_mode_allowed,
  min_age = excluded.min_age,
  priority = excluded.priority,
  active = true,
  updated_at = now();

insert into public.action_registry (
  action_key,
  mission_slug,
  provider_id,
  account_type,
  action_mode,
  destination_url,
  instructions,
  verification_mode,
  safe_mode_allowed,
  min_age,
  priority,
  active
)
values
  (
    'direct-debit-generic',
    'set-up-direct-debit',
    null,
    'credit_card',
    'internal_flow',
    '/accounts',
    'Open or sign in to the relevant card issuer and set up at least the minimum payment by direct debit. Credit Quest never needs your banking password.',
    'self_confirm',
    true,
    16,
    100,
    true
  ),
  (
    'utilisation-generic',
    'reduce-utilisation',
    null,
    'credit_card',
    'internal_flow',
    '/accounts',
    'Use the balance and credit-limit details you entered to plan a lower utilisation level, then update the account after the balance changes.',
    'self_confirm_review',
    true,
    16,
    100,
    true
  ),
  (
    'application-cooldown-internal',
    'application-cooldown',
    null,
    null,
    'internal_flow',
    '/dashboard',
    'Start a Credit Quest application cooldown. The mission stays in cooldown until its review date rather than completing immediately.',
    'internal_state',
    true,
    16,
    100,
    true
  ),
  (
    'revolving-history-offers',
    'build-revolving-history',
    null,
    null,
    'referral',
    '/offers',
    'Review optional credit-builder products only if they remain appropriate for your age and current safety state. A click or application never completes this mission automatically.',
    'self_confirm_review',
    false,
    18,
    100,
    true
  )
on conflict (action_key) do update set
  destination_url = excluded.destination_url,
  instructions = excluded.instructions,
  verification_mode = excluded.verification_mode,
  safe_mode_allowed = excluded.safe_mode_allowed,
  min_age = excluded.min_age,
  priority = excluded.priority,
  active = true,
  updated_at = now();