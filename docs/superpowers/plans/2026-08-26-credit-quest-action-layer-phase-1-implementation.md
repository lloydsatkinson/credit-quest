# Credit Quest Mission Action Layer Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every current Credit Quest mission executable through a secure, account-aware Mission Action Layer that routes customers to trusted internal, government, provider, or referral actions without treating a click as completion.

**Architecture:** Extend the existing Next.js/Supabase application with a Supabase-backed provider/action registry, minimal user-account records, target-aware mission instances, a deterministic server-authoritative action resolver, auditable action attempts, and return/resume confirmation flows. Keep mission ranking and safety independent from commercial economics; use code adapters only where behaviour is genuinely required, while Phase 1 external actions remain configured destinations or internal flows.

**Tech Stack:** Next.js App Router 16.3.3, React 19, TypeScript 5.9, Tailwind CSS 4, Supabase Auth/Postgres/RLS, Zod, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-26-credit-quest-action-layer-phase-1-design.md`

## Global Constraints

- Clicking a button is never the same as completing a mission.
- Preserve the current one-way customer-benefit flow: profile/account state → safety → deterministic mission selection → optional action/referral.
- Affiliate commission, lender payout, campaign economics, or conversion rate must never alter mission ranking, safety, action resolution priority, or whether a mission is shown.
- Users aged 16–17 remain education-only for credit-product referrals; action eligibility must be enforced in domain/server logic, not only UI.
- Electoral-roll submission must not immediately set `electoralRoll=true`; submission enters `in_review`, and completion happens only after later confirmation or verification.
- Unknown account/profile data must remain unknown; never coerce missing data to zero, false, safe, or completed.
- Store no banking passwords, provider credentials, full card numbers, NI numbers, raw provider query strings, auth tokens, or sensitive form data.
- Money values in account records use integer minor units.
- The browser never supplies an arbitrary external destination URL to the action-start endpoint.
- External destinations must be configured server-side and validated against the provider allowlist before the server returns them.
- A missing provider integration must degrade to safe internal/manual guidance, not a dead end.
- Existing authenticated Supabase/RLS boundaries must remain intact.
- Existing user mission progress must survive migration.
- The Action Layer supports multiple accounts from Phase 1.
- `set-up-direct-debit` and `reduce-utilisation` become account-scoped when suitable account data exists; electoral roll, application cooldown, and first revolving-history remain profile-scoped.
- Open Banking, CRA ingestion, payment initiation, provider scraping, automatic form filling, and a full admin CMS remain out of scope.
- Demo provider and product data stays clearly fictional unless an official government endpoint is explicitly configured.

---

## File map

### Domain

- Modify `lib/domain/types.ts` — add account/action/mission-instance types.
- Create `lib/domain/account-missions.ts` — account utilisation/direct-debit eligibility, mission-instance generation, profile summaries.
- Create `lib/domain/action-resolver.ts` — deterministic action matching and host validation.
- Create `lib/domain/action-lifecycle.ts` — pure action-attempt transitions and mission outcomes.
- Modify `lib/domain/mission-lifecycle.ts` — support `in_review` and cooldown transitions without premature completion effects.
- Modify `lib/domain/mission-engine.ts` — consume target-aware mission instances while preserving the current profile-only fallback path.
- Modify `lib/data/missions.ts` — mark mission scope and action semantics.
- Modify `lib/events.ts` — action analytics event names.

### Server/data access

- Create `lib/server/profile-repository.ts` — map profile rows to `CreditProfile` and persist allowed profile updates.
- Create `lib/server/account-repository.ts` — owner-scoped account CRUD/read helpers.
- Create `lib/server/mission-repository.ts` — owner-scoped mission-instance reads/writes.
- Create `lib/server/action-repository.ts` — provider/action registry reads and action-attempt writes.

### API/UI

- Create `app/api/accounts/route.ts` — list/create accounts.
- Create `app/api/accounts/[id]/route.ts` — update/deactivate owned accounts.
- Create `app/accounts/page.tsx` — protected account management page.
- Create `components/accounts/accounts-client.tsx` — manual provider/account entry and account cards.
- Create `app/actions/[missionInstanceId]/page.tsx` — protected Action Screen.
- Create `components/actions/action-screen.tsx` — reusable start/continue UI.
- Create `app/api/actions/resolve/route.ts` — resolve an owned mission instance to a safe action preview.
- Create `app/api/actions/start/route.ts` — create attempt and return approved destination/internal route.
- Create `app/api/actions/attempts/[id]/route.ts` — resume/confirm/cancel an owned attempt.
- Create `components/actions/resume-action-card.tsx` — pending-action return/resume prompt.
- Modify `components/dashboard/dashboard-client.tsx` — hydrate accounts/instances/pending attempt, route CTA into Action Screen, preserve demo mode.
- Modify `components/dashboard/next-mission-card.tsx` — replace direct completion CTA with action-aware CTA/status.
- Modify `components/offers/offer-card.tsx` and `components/offers/offers-client.tsx` — preserve marketplace while mission-linked referral starts through Action Layer.
- Modify `app/dashboard/page.tsx` if server bootstrap data is introduced.
- Modify `lib/supabase/middleware.ts` and `proxy.ts` — protect `/accounts` and `/actions`.

### Database

- Create `supabase/migrations/003_action_layer.sql` — providers, user_accounts, action_registry, action_attempts, mission-instance evolution, RLS, seed data.
- Modify `supabase/tests/rls.sql` — owner isolation and registry read rules.

### Tests

- Create `tests/unit/account-missions.test.ts`.
- Create `tests/unit/action-resolver.test.ts`.
- Create `tests/unit/action-lifecycle.test.ts`.
- Create `tests/unit/action-screen.test.tsx`.
- Create `tests/unit/accounts-client.test.tsx`.
- Create `tests/unit/action-api-routes.test.ts`.
- Modify `tests/unit/mission-engine.test.ts`.
- Modify `tests/unit/mission-lifecycle.test.ts`.
- Modify `tests/unit/dashboard-components.test.tsx`.
- Modify `tests/unit/events.test.ts`.
- Modify `tests/e2e/smoke.spec.ts`.
- Modify `README.md`.

---

### Task 1: Add action/account/mission-instance domain types

**Files:**
- Modify: `lib/domain/types.ts`
- Modify: `lib/data/missions.ts`
- Test: `tests/unit/account-missions.test.ts`

**Interfaces:**
- Produces `MissionScope`, `MissionSubject`, `MissionInstance`, `UserAccount`, `ProviderDefinition`, `ActionDefinition`, `ResolvedAction`, `ActionAttempt`, and related unions.
- Adds `scope: "profile" | "account"` to `MissionDefinition`.
- Keeps existing `MissionProgress` and profile-only APIs available for compatibility during migration.

- [ ] **Step 1: Write the failing type/behaviour test**

Create `tests/unit/account-missions.test.ts` with the first contract:

```ts
import { describe, expect, it } from "vitest";
import { MISSION_CATALOGUE } from "@/lib/data/missions";

it("declares direct debit and utilisation as account-scoped missions", () => {
  const bySlug = Object.fromEntries(MISSION_CATALOGUE.map((mission) => [mission.slug, mission]));
  expect(bySlug["set-up-direct-debit"].scope).toBe("account");
  expect(bySlug["reduce-utilisation"].scope).toBe("account");
  expect(bySlug["register-electoral-roll"].scope).toBe("profile");
  expect(bySlug["application-cooldown"].scope).toBe("profile");
  expect(bySlug["build-revolving-history"].scope).toBe("profile");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- tests/unit/account-missions.test.ts
```

Expected: FAIL because `MissionDefinition` and the catalogue do not yet contain `scope`.

- [ ] **Step 3: Add the domain types**

Add to `lib/domain/types.ts`:

```ts
export type MissionScope = "profile" | "account";
export type AccountType = "credit_card" | "current_account" | "loan" | "other";
export type DirectDebitStatus = "yes" | "no" | "unknown";
export type AccountSource = "manual" | "open_banking";
export type ProviderType = "government" | "bank" | "card_issuer" | "partner" | "generic";
export type ActionMode = "external_link" | "internal_flow" | "referral" | "api";
export type VerificationMode =
  | "internal_state"
  | "self_confirm"
  | "self_confirm_review"
  | "api_verified"
  | "partner_callback";
export type ActionAttemptStatus =
  | "started"
  | "returned"
  | "submitted"
  | "self_confirmed"
  | "verified"
  | "cancelled"
  | "failed";

export type MissionSubject =
  | { kind: "profile" }
  | { kind: "account"; accountId: string };

export interface MissionInstance {
  id: string;
  userId: string;
  missionSlug: string;
  subject: MissionSubject;
  state: MissionState;
  startedAt: string | null;
  completedAt: string | null;
  nextReviewAt: string | null;
}

export interface UserAccount {
  id: string;
  userId: string;
  providerId: string | null;
  providerName?: string | null;
  accountType: AccountType;
  nickname: string | null;
  lastFour: string | null;
  balanceMinor: number | null;
  creditLimitMinor: number | null;
  currency: string;
  directDebitStatus: DirectDebitStatus;
  source: AccountSource;
  active: boolean;
  lastVerifiedAt: string | null;
}

export interface ProviderDefinition {
  id: string;
  slug: string;
  displayName: string;
  providerType: ProviderType;
  allowedHosts: string[];
  active: boolean;
}

export interface ActionDefinition {
  id: string;
  actionKey: string;
  missionSlug: string;
  providerId: string | null;
  accountType: AccountType | null;
  mode: ActionMode;
  destinationUrl: string | null;
  instructions: string;
  verificationMode: VerificationMode;
  safeModeAllowed: boolean;
  minAge: number | null;
  priority: number;
  active: boolean;
}

export interface ResolvedAction {
  actionId: string;
  mode: ActionMode;
  providerName: string | null;
  destinationUrl: string | null;
  instructions: string;
  verificationMode: VerificationMode;
  fallbackUsed: boolean;
}

export interface ActionAttempt {
  id: string;
  userId: string;
  missionInstanceId: string;
  actionRegistryId: string;
  accountId: string | null;
  status: ActionAttemptStatus;
  startedAt: string;
  returnedAt: string | null;
  selfConfirmedAt: string | null;
  verifiedAt: string | null;
  nextReviewAt: string | null;
}
```

Add to `MissionDefinition`:

```ts
scope: MissionScope;
```

- [ ] **Step 4: Mark the five current missions with scope**

In `lib/data/missions.ts` set:

```ts
// electoral roll
scope: "profile",

// utilisation
scope: "account",

// direct debit
scope: "account",

// cooldown
scope: "profile",

// revolving history
scope: "profile",
```

- [ ] **Step 5: Run the focused test and verify GREEN**

```bash
npm test -- tests/unit/account-missions.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/domain/types.ts lib/data/missions.ts tests/unit/account-missions.test.ts
git commit -m "feat: add action layer domain types"
```

---

### Task 2: Add account-scoped mission generation and utilisation helpers

**Files:**
- Create: `lib/domain/account-missions.ts`
- Modify: `tests/unit/account-missions.test.ts`
- Modify: `tests/unit/mission-engine.test.ts`

**Interfaces:**
- Produces `calculateAccountUtilisation(account: UserAccount): number | null`.
- Produces `amountToReachUtilisation(account: UserAccount, thresholdPct: number): number | null` in minor units.
- Produces `buildMissionInstances(profile, accounts, existing, now): MissionInstance[]` for current missions.

- [ ] **Step 1: Add failing tests for account calculations and separate instances**

Append:

```ts
import {
  amountToReachUtilisation,
  buildMissionInstances,
  calculateAccountUtilisation,
} from "@/lib/domain/account-missions";
import type { CreditProfile, UserAccount } from "@/lib/domain/types";

const profile: CreditProfile = {
  userId: "u1", dateOfBirth: "1990-01-01", employmentStatus: "employed",
  incomeBand: "30_50k", housingStatus: "rent", electoralRoll: true,
  utilisationPct: 62, missedPaymentsLast12m: 0, hardApplicationsLast6m: 0,
  hasRevolvingCredit: true, hasDirectDebitForCredit: false,
};

const card = (id: string, balanceMinor: number, limitMinor: number, directDebitStatus: "yes" | "no" | "unknown"): UserAccount => ({
  id, userId: "u1", providerId: null, accountType: "credit_card", nickname: id,
  lastFour: null, balanceMinor, creditLimitMinor: limitMinor, currency: "GBP",
  directDebitStatus, source: "manual", active: true, lastVerifiedAt: null,
});

it("calculates utilisation and amount needed to reach 30 percent", () => {
  const account = card("a1", 62000, 100000, "no");
  expect(calculateAccountUtilisation(account)).toBe(62);
  expect(amountToReachUtilisation(account, 30)).toBe(32000);
});

it("returns unknown utilisation when balance or limit is missing", () => {
  expect(calculateAccountUtilisation({ ...card("a1", 0, 100000, "no"), balanceMinor: null })).toBeNull();
  expect(calculateAccountUtilisation({ ...card("a1", 0, 100000, "no"), creditLimitMinor: null })).toBeNull();
});

it("creates separate direct-debit mission instances for separate unprotected cards", () => {
  const instances = buildMissionInstances(profile, [
    card("a1", 20000, 100000, "no"),
    card("a2", 10000, 100000, "no"),
  ], [], new Date("2026-08-26T12:00:00Z"));

  const dd = instances.filter((instance) => instance.missionSlug === "set-up-direct-debit");
  expect(dd).toHaveLength(2);
  expect(dd.map((instance) => instance.subject)).toEqual(expect.arrayContaining([
    { kind: "account", accountId: "a1" },
    { kind: "account", accountId: "a2" },
  ]));
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- tests/unit/account-missions.test.ts
```

Expected: FAIL because `lib/domain/account-missions.ts` does not exist.

- [ ] **Step 3: Implement the pure helpers**

Create `lib/domain/account-missions.ts` with:

```ts
import { MISSION_CATALOGUE } from "@/lib/data/missions";
import type { CreditProfile, MissionInstance, UserAccount } from "@/lib/domain/types";

export function calculateAccountUtilisation(account: UserAccount): number | null {
  if (account.balanceMinor === null || account.creditLimitMinor === null || account.creditLimitMinor <= 0) return null;
  return Math.round((account.balanceMinor / account.creditLimitMinor) * 10000) / 100;
}

export function amountToReachUtilisation(account: UserAccount, thresholdPct: number): number | null {
  if (account.balanceMinor === null || account.creditLimitMinor === null || account.creditLimitMinor <= 0) return null;
  const targetBalance = Math.floor(account.creditLimitMinor * (thresholdPct / 100));
  return Math.max(0, account.balanceMinor - targetBalance);
}

export function buildMissionInstances(
  profile: CreditProfile,
  accounts: UserAccount[],
  existing: MissionInstance[] = [],
  now = new Date(),
): MissionInstance[] {
  const byKey = new Map(existing.map((item) => [
    `${item.missionSlug}:${item.subject.kind === "profile" ? "profile" : item.subject.accountId}`,
    item,
  ]));
  const result: MissionInstance[] = [];

  for (const mission of MISSION_CATALOGUE) {
    if (mission.scope === "profile") {
      if (!mission.isEligible(profile, now)) continue;
      const key = `${mission.slug}:profile`;
      result.push(byKey.get(key) ?? {
        id: `local:${key}`,
        userId: profile.userId,
        missionSlug: mission.slug,
        subject: { kind: "profile" },
        state: "not_started",
        startedAt: null,
        completedAt: null,
        nextReviewAt: null,
      });
      continue;
    }

    for (const account of accounts.filter((item) => item.active && item.accountType === "credit_card")) {
      const eligible = mission.slug === "set-up-direct-debit"
        ? account.directDebitStatus === "no"
        : mission.slug === "reduce-utilisation"
          ? (calculateAccountUtilisation(account) ?? 0) > 30
          : false;
      if (!eligible) continue;
      const key = `${mission.slug}:${account.id}`;
      result.push(byKey.get(key) ?? {
        id: `local:${key}`,
        userId: profile.userId,
        missionSlug: mission.slug,
        subject: { kind: "account", accountId: account.id },
        state: "not_started",
        startedAt: null,
        completedAt: null,
        nextReviewAt: null,
      });
    }
  }

  return result;
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

```bash
npm test -- tests/unit/account-missions.test.ts tests/unit/mission-engine.test.ts
```

Expected: PASS after updating any mission fixtures to include `scope`.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/account-missions.ts tests/unit/account-missions.test.ts tests/unit/mission-engine.test.ts
git commit -m "feat: generate account scoped missions"
```

---

### Task 3: Create the Action Layer database migration and RLS rules

**Files:**
- Create: `supabase/migrations/003_action_layer.sql`
- Modify: `supabase/tests/rls.sql`

**Interfaces:**
- Produces `providers`, `user_accounts`, `action_registry`, `action_attempts`.
- Evolves `user_missions` with stable `id`, `subject_type`, and `subject_id` while retaining existing rows.
- Seeds the official GOV.UK electoral-roll route and safe generic internal fallbacks.

- [ ] **Step 1: Write SQL assertions before migration implementation**

Append to `supabase/tests/rls.sql` inside the existing `do $$ ... end $$` block:

```sql
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_accounts'
      and policyname = 'accounts_select_own'
      and qual like '%auth.uid()%user_id%'
  ) then
    raise exception 'user_accounts owner-select policy missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'action_attempts'
      and policyname = 'action_attempts_select_own'
      and qual like '%auth.uid()%user_id%'
  ) then
    raise exception 'action_attempts owner-select policy missing';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'providers' and cmd in ('INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'providers must not expose client write policies';
  end if;
```

- [ ] **Step 2: Create `003_action_layer.sql`**

Use this schema shape:

```sql
create extension if not exists pgcrypto;

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  display_name text not null,
  provider_type text not null check (provider_type in ('government','bank','card_issuer','partner','generic')),
  allowed_hosts text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid references public.providers(id),
  account_type text not null check (account_type in ('credit_card','current_account','loan','other')),
  nickname text,
  last_four text check (last_four is null or last_four ~ '^[0-9]{4}$'),
  balance_minor bigint,
  credit_limit_minor bigint,
  currency text not null default 'GBP',
  direct_debit_status text not null default 'unknown' check (direct_debit_status in ('yes','no','unknown')),
  source text not null default 'manual' check (source in ('manual','open_banking')),
  active boolean not null default true,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_missions add column if not exists id uuid default gen_random_uuid();
update public.user_missions set id = gen_random_uuid() where id is null;
alter table public.user_missions alter column id set not null;
create unique index if not exists user_missions_id_key on public.user_missions(id);
alter table public.user_missions add column if not exists subject_type text not null default 'profile';
alter table public.user_missions add column if not exists subject_id uuid;
alter table public.user_missions drop constraint if exists user_missions_subject_type_check;
alter table public.user_missions add constraint user_missions_subject_type_check check (subject_type in ('profile','account'));

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
  account_type text check (account_type is null or account_type in ('credit_card','current_account','loan','other')),
  action_mode text not null check (action_mode in ('external_link','internal_flow','referral','api')),
  destination_url text,
  instructions text not null,
  verification_mode text not null check (verification_mode in ('internal_state','self_confirm','self_confirm_review','api_verified','partner_callback')),
  safe_mode_allowed boolean not null,
  min_age int,
  priority int not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.action_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_instance_id uuid not null,
  action_registry_id uuid not null references public.action_registry(id),
  account_id uuid references public.user_accounts(id),
  status text not null check (status in ('started','returned','submitted','self_confirmed','verified','cancelled','failed')),
  started_at timestamptz not null default now(),
  returned_at timestamptz,
  self_confirmed_at timestamptz,
  verified_at timestamptz,
  next_review_at timestamptz,
  external_reference text,
  error_code text,
  metadata jsonb not null default '{}'
);
```

Enable RLS and create owner-only `SELECT/INSERT/UPDATE` policies for `user_accounts` and `action_attempts`. Allow authenticated `SELECT` on active `providers` and active `action_registry`, but no client writes. Keep registry mutations server/admin-only.

- [ ] **Step 3: Seed the government provider and initial action rows**

Include deterministic seed upserts:

```sql
insert into public.providers (slug, display_name, provider_type, allowed_hosts)
values ('gov-uk', 'GOV.UK', 'government', array['www.gov.uk','gov.uk'])
on conflict (slug) do update set
  display_name = excluded.display_name,
  allowed_hosts = excluded.allowed_hosts,
  active = true;

insert into public.action_registry (
  action_key, mission_slug, provider_id, account_type, action_mode,
  destination_url, instructions, verification_mode, safe_mode_allowed, min_age, priority
)
select
  'electoral-roll-gov-uk', 'register-electoral-roll', p.id, null, 'external_link',
  'https://www.gov.uk/register-to-vote',
  'Use the official GOV.UK service to submit your registration. Returning to Credit Quest does not prove registration has taken effect.',
  'self_confirm_review', true, 16, 10
from public.providers p where p.slug = 'gov-uk'
on conflict (action_key) do update set destination_url = excluded.destination_url, instructions = excluded.instructions, active = true;
```

Also seed internal/manual generic fallbacks for `set-up-direct-debit`, `reduce-utilisation`, and `application-cooldown`. Seed a referral/internal route for `build-revolving-history` pointing to `/offers` rather than a lender URL so existing age/safety-gated offer matching remains the product gate.

- [ ] **Step 4: Run local database reset and RLS checks**

Run:

```bash
npx supabase db reset
psql "$SUPABASE_DB_URL" -f supabase/tests/rls.sql
```

Expected: migration succeeds; RLS script exits without exception. If local Supabase/`SUPABASE_DB_URL` is unavailable, stop and record that database verification must run in CI or the connected Supabase project before merge.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/003_action_layer.sql supabase/tests/rls.sql
git commit -m "feat: add action layer database schema"
```

---

### Task 4: Implement the deterministic Action Resolver

**Files:**
- Create: `lib/domain/action-resolver.ts`
- Create: `tests/unit/action-resolver.test.ts`

**Interfaces:**
- Produces `resolveAction(input): ResolvedAction | null`.
- Produces `isAllowedDestination(url, provider): boolean`.
- Resolver ranking order: exact provider+account type → provider generic → account-type generic → mission-wide generic.
- Rejects inactive records, age-ineligible actions, Safe Mode-blocked actions, and disallowed destination hosts.

- [ ] **Step 1: Write failing resolver tests**

Create:

```ts
import { describe, expect, it } from "vitest";
import { isAllowedDestination, resolveAction } from "@/lib/domain/action-resolver";
import type { ActionDefinition, ProviderDefinition } from "@/lib/domain/types";

const provider: ProviderDefinition = {
  id: "p1", slug: "issuer", displayName: "Issuer", providerType: "card_issuer",
  allowedHosts: ["issuer.example"], active: true,
};
const action = (overrides: Partial<ActionDefinition>): ActionDefinition => ({
  id: "a1", actionKey: "k", missionSlug: "set-up-direct-debit", providerId: null,
  accountType: null, mode: "external_link", destinationUrl: "https://issuer.example/manage",
  instructions: "Manage your account", verificationMode: "self_confirm",
  safeModeAllowed: true, minAge: null, priority: 100, active: true, ...overrides,
});

it("prefers exact provider and account type over generic actions", () => {
  const resolved = resolveAction({
    missionSlug: "set-up-direct-debit", provider, accountType: "credit_card",
    actions: [
      action({ id: "generic", actionKey: "generic", destinationUrl: null, mode: "internal_flow" }),
      action({ id: "exact", actionKey: "exact", providerId: "p1", accountType: "credit_card" }),
    ],
    age: 36, safeMode: false,
  });
  expect(resolved?.actionId).toBe("exact");
  expect(resolved?.fallbackUsed).toBe(false);
});

it("rejects an external destination outside the provider allowlist", () => {
  expect(isAllowedDestination("https://evil.example/phish", provider)).toBe(false);
});

it("suppresses an adult-only action for a 17 year old", () => {
  expect(resolveAction({
    missionSlug: "build-revolving-history", provider: null, accountType: null,
    actions: [action({ missionSlug: "build-revolving-history", minAge: 18, mode: "referral", destinationUrl: "/offers" })],
    age: 17, safeMode: false,
  })).toBeNull();
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- tests/unit/action-resolver.test.ts
```

Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Implement host validation and deterministic ranking**

Create `lib/domain/action-resolver.ts` exporting:

```ts
export interface ResolveActionInput {
  missionSlug: string;
  provider: ProviderDefinition | null;
  accountType: AccountType | null;
  actions: ActionDefinition[];
  age: number;
  safeMode: boolean;
}

export function isAllowedDestination(url: string, provider: ProviderDefinition | null): boolean {
  if (url.startsWith("/")) return true;
  if (!provider || !provider.active) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && provider.allowedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}
```

Filter by mission/active/minAge/Safe Mode first. Score candidates with exact provider+account type highest, then provider-only, then account-type-only, then mission generic. For external links, discard candidates whose destination fails `isAllowedDestination`. Return `fallbackUsed: true` when the chosen action is not an exact provider match.

- [ ] **Step 4: Run focused resolver tests**

```bash
npm test -- tests/unit/action-resolver.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/action-resolver.ts tests/unit/action-resolver.test.ts
git commit -m "feat: add secure action resolver"
```

---

### Task 5: Add owner-scoped repositories and manual account API

**Files:**
- Create: `lib/server/profile-repository.ts`
- Create: `lib/server/account-repository.ts`
- Create: `lib/server/mission-repository.ts`
- Create: `lib/server/action-repository.ts`
- Create: `app/api/accounts/route.ts`
- Create: `app/api/accounts/[id]/route.ts`
- Create: `tests/unit/action-api-routes.test.ts`

**Interfaces:**
- `listUserAccounts(supabase, userId): Promise<UserAccount[]>`.
- `createUserAccount(supabase, userId, input): Promise<UserAccount>`.
- `updateUserAccount(supabase, userId, accountId, input): Promise<UserAccount | null>`.
- `listMissionInstances(supabase, userId): Promise<MissionInstance[]>`.
- `listActiveActions(supabase, missionSlug): Promise<ActionDefinition[]>`.
- `listProviders(supabase): Promise<ProviderDefinition[]>`.

- [ ] **Step 1: Write failing route tests for validation and ownership**

In `tests/unit/action-api-routes.test.ts`, mock `createServerSupabaseClient` and assert:

```ts
it("rejects a full card number and accepts only optional last four", async () => {
  const response = await POST_ACCOUNT(new Request("https://app.test/api/accounts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      accountType: "credit_card",
      providerId: null,
      nickname: "Main card",
      lastFour: "1234567890123456",
      balanceMinor: 20000,
      creditLimitMinor: 100000,
      directDebitStatus: "no",
    }),
  }));
  expect(response.status).toBe(400);
});
```

Add a second test that an unauthenticated request returns `401`, and an update query always scopes by both `user_id` and account `id`.

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- tests/unit/action-api-routes.test.ts
```

Expected: FAIL because account routes/repositories do not exist.

- [ ] **Step 3: Implement Zod account input schemas**

Use:

```ts
const accountInputSchema = z.object({
  providerId: z.string().uuid().nullable(),
  accountType: z.enum(["credit_card", "current_account", "loan", "other"]),
  nickname: z.string().trim().max(80).nullable(),
  lastFour: z.string().regex(/^\d{4}$/).nullable(),
  balanceMinor: z.number().int().min(0).nullable(),
  creditLimitMinor: z.number().int().positive().nullable(),
  directDebitStatus: z.enum(["yes", "no", "unknown"]),
}).strict();
```

Do not accept a full card number field at all.

- [ ] **Step 4: Implement repository row mapping once**

Centralise snake_case ↔ camelCase conversion in repository helpers. Move the existing profile-row mapping currently embedded in `app/api/missions/[slug]/route.ts` into `lib/server/profile-repository.ts` so later action routes do not duplicate it.

- [ ] **Step 5: Implement account routes**

`GET /api/accounts` returns the authenticated user's active accounts plus active providers for the manual selector. `POST /api/accounts` creates an owner-scoped manual account. `PATCH /api/accounts/[id]` updates only a row matching both `id` and `user_id`. `DELETE` should soft-deactivate by setting `active=false` rather than deleting history used by attempts.

- [ ] **Step 6: Run focused tests**

```bash
npm test -- tests/unit/action-api-routes.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/server app/api/accounts tests/unit/action-api-routes.test.ts
git commit -m "feat: add account repositories and api"
```

---

### Task 6: Build the manual My Accounts screen

**Files:**
- Create: `app/accounts/page.tsx`
- Create: `components/accounts/accounts-client.tsx`
- Create: `tests/unit/accounts-client.test.tsx`
- Modify: `lib/supabase/middleware.ts`
- Modify: `proxy.ts`

**Interfaces:**
- UI consumes `GET /api/accounts` and `POST/PATCH/DELETE /api/accounts`.
- User can add multiple cards without supplying sensitive credentials or a full card number.
- Account cards expose provider/nickname/last-four, optional balance/limit, and direct-debit status.

- [ ] **Step 1: Write failing UI tests**

Create:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountsClient } from "@/components/accounts/accounts-client";

afterEach(cleanup);

it("does not ask for a full card number", () => {
  render(<AccountsClient initialAccounts={[]} providers={[]} />);
  expect(screen.queryByLabelText(/card number/i)).toBeNull();
  expect(screen.getByLabelText(/last four digits/i)).not.toBeNull();
});

it("supports adding more than one credit card", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ account: { id: "a1" } }), { status: 200 }));
  render(<AccountsClient initialAccounts={[]} providers={[]} />);
  fireEvent.click(screen.getByRole("button", { name: /add account/i }));
  expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("cardNumber"), expect.anything());
  fetchMock.mockRestore();
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- tests/unit/accounts-client.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement `AccountsClient`**

Use provider `<select>`, account type, optional nickname, optional last-four, optional balance in pounds converted to integer pence, optional credit limit in pounds converted to integer pence, and direct-debit status. Include copy:

```text
Only add the last four digits if they help you recognise the account. Never enter your full card number or banking password.
```

Render existing accounts individually with Edit and Remove controls.

- [ ] **Step 4: Create the protected page**

`app/accounts/page.tsx` renders a Credit Quest header, plain explanation that manual accounts can later be replaced/enriched by Open Banking, and `AccountsClient`.

- [ ] **Step 5: Protect `/accounts`**

Add `/accounts` to `PROTECTED_PREFIXES` and to `proxy.ts` matcher.

- [ ] **Step 6: Run component tests**

```bash
npm test -- tests/unit/accounts-client.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/accounts components/accounts tests/unit/accounts-client.test.tsx lib/supabase/middleware.ts proxy.ts
git commit -m "feat: add manual account management"
```

---

### Task 7: Persist target-aware mission instances

**Files:**
- Modify: `lib/server/mission-repository.ts`
- Modify: `lib/domain/mission-engine.ts`
- Modify: `tests/unit/mission-engine.test.ts`
- Modify: `app/api/missions/[slug]/route.ts`

**Interfaces:**
- `syncMissionInstances(supabase, profile, accounts, now): Promise<MissionInstance[]>` upserts currently eligible profile/account instances without deleting historical progress.
- Account-scoped instance uniqueness is `(user_id, mission_slug, subject_id)`.
- Profile fallback remains usable in demo mode.

- [ ] **Step 1: Write failing ranking test for two card targets**

Add to `tests/unit/mission-engine.test.ts` a test that two eligible account-scoped instances can coexist and that a started instance receives the existing priority boost without suppressing the other account instance.

Use explicit IDs `mi-a1` and `mi-a2` and assert ranking keys include the mission instance ID, not only mission slug.

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- tests/unit/mission-engine.test.ts
```

Expected: FAIL because the current progress map is keyed only by mission slug.

- [ ] **Step 3: Add instance-aware ranking API while keeping compatibility**

Add:

```ts
export interface RankedMissionInstance extends RankedMission {
  instance: MissionInstance;
}

export function rankMissionInstances(
  profile: CreditProfile,
  instances: MissionInstance[],
  accounts: UserAccount[],
  now = new Date(),
): RankedMissionInstance[];
```

Use the instance state for availability/started boost. Derive account-specific reason text such as utilisation percentage or provider/nickname when the subject is an account.

Do not delete the current `rankMissions/getNextBestMission` functions until the dashboard demo path is migrated.

- [ ] **Step 4: Implement server sync/upsert**

`syncMissionInstances` calls `buildMissionInstances`, assigns/preserves real database IDs, and upserts profile/account rows with `subject_type` and `subject_id`. Never overwrite a terminal historical row merely because current eligibility changed; mark active non-terminal instances `no_longer_eligible` only when their underlying condition is definitively no longer true.

- [ ] **Step 5: Narrow the legacy mission API**

Update `app/api/missions/[slug]/route.ts` so it remains the demo/back-compat profile-scoped lifecycle endpoint, but it must not be used by account-scoped Action Layer flows. Reject direct `complete` for electoral roll once Action Layer is enabled server-side; electoral completion will come through action confirmation.

- [ ] **Step 6: Run tests**

```bash
npm test -- tests/unit/mission-engine.test.ts tests/unit/mission-lifecycle.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/server/mission-repository.ts lib/domain/mission-engine.ts tests/unit/mission-engine.test.ts app/api/missions/[slug]/route.ts
git commit -m "feat: persist target aware mission instances"
```

---

### Task 8: Add Action Screen resolution and secure start endpoint

**Files:**
- Create: `app/actions/[missionInstanceId]/page.tsx`
- Create: `components/actions/action-screen.tsx`
- Create: `app/api/actions/resolve/route.ts`
- Create: `app/api/actions/start/route.ts`
- Modify: `lib/server/action-repository.ts`
- Modify: `lib/supabase/middleware.ts`
- Modify: `proxy.ts`
- Create: `tests/unit/action-screen.test.tsx`
- Extend: `tests/unit/action-api-routes.test.ts`

**Interfaces:**
- `POST /api/actions/resolve` accepts `{ missionInstanceId }` only.
- `POST /api/actions/start` accepts `{ missionInstanceId }` only.
- The server loads ownership/profile/account/safety/age, reruns resolver, validates host, creates `action_attempt`, and returns `{ attemptId, mode, destinationUrl }`.

- [ ] **Step 1: Write failing security test**

Add:

```ts
it("does not accept a client supplied destination url", async () => {
  const response = await START_ACTION(new Request("https://app.test/api/actions/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      missionInstanceId: "11111111-1111-1111-1111-111111111111",
      destinationUrl: "https://evil.example",
    }),
  }));
  expect(response.status).toBe(400);
});
```

Also test `401` unauthenticated, `404` non-owned instance, `409` action blocked by age/Safe Mode, and success returns only a server-resolved allowlisted destination.

- [ ] **Step 2: Write failing Action Screen component test**

```tsx
it("explains external ownership and does not claim completion", () => {
  render(<ActionScreen missionTitle="Get on the electoral roll" rationale="Address matching" resolvedAction={{
    actionId: "a1", mode: "external_link", providerName: "GOV.UK",
    destinationUrl: "https://www.gov.uk/register-to-vote",
    instructions: "Use the official service", verificationMode: "self_confirm_review", fallbackUsed: false,
  }} missionInstanceId="mi1" />);
  expect(screen.getByText(/operated by GOV.UK/i)).not.toBeNull();
  expect(screen.queryByText(/mission completed/i)).toBeNull();
});
```

- [ ] **Step 3: Run and verify RED**

```bash
npm test -- tests/unit/action-api-routes.test.ts tests/unit/action-screen.test.tsx
```

Expected: FAIL.

- [ ] **Step 4: Implement resolve/start server flow**

Both routes authenticate and load the mission instance by `id + user_id`. Resolve also loads the subject account if present, current profile, action rows and providers, calculates age with `getAgeYears`, safety with `assessSafety`, and calls `resolveAction`.

Start repeats the full resolution server-side; never trust the preview response. Before inserting `action_attempt`, revalidate destination host. Insert status `started`, account ID from the mission subject, and minimal metadata containing only mission slug and whether fallback was used.

- [ ] **Step 5: Implement the Action Screen**

Render:
- mission title
- rationale
- target provider/account
- action instructions
- verification explanation
- timing/review copy
- Continue button that posts to `/api/actions/start`
- Back to dashboard.

For `external_link`, on success navigate with `window.location.assign(data.destinationUrl)`. For `internal_flow`, route to the returned internal path. Never show `Mark complete` on the Action Screen.

- [ ] **Step 6: Protect `/actions`**

Add `/actions` to middleware/proxy protected prefixes.

- [ ] **Step 7: Run focused tests**

```bash
npm test -- tests/unit/action-api-routes.test.ts tests/unit/action-screen.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/actions app/api/actions components/actions lib/server/action-repository.ts lib/supabase/middleware.ts proxy.ts tests/unit/action-api-routes.test.ts tests/unit/action-screen.test.tsx
git commit -m "feat: add secure mission action screen"
```

---

### Task 9: Implement return/resume confirmation and mission outcomes

**Files:**
- Create: `lib/domain/action-lifecycle.ts`
- Modify: `lib/domain/mission-lifecycle.ts`
- Create: `tests/unit/action-lifecycle.test.ts`
- Modify: `tests/unit/mission-lifecycle.test.ts`
- Create: `app/api/actions/attempts/[id]/route.ts`
- Create: `components/actions/resume-action-card.tsx`
- Extend: `tests/unit/action-api-routes.test.ts`

**Interfaces:**
- `applyActionResponse(input)` returns updated attempt, mission state, account/profile patch.
- Electoral `submitted` → mission `in_review`, `nextReviewAt` around 30 days, no `electoralRoll` profile patch.
- Electoral later `verified/confirmed_registered` → mission `completed`, profile patch `electoralRoll=true`.
- Direct debit self-confirm → account patch `directDebitStatus="yes"`, mission completed.
- Utilisation only completes if updated account data proves utilisation <= threshold.
- Cooldown internal start → mission `cooldown` with review date; not `completed` immediately.

- [ ] **Step 1: Write failing lifecycle tests**

Create:

```ts
import { describe, expect, it } from "vitest";
import { applyActionResponse } from "@/lib/domain/action-lifecycle";

it("puts electoral roll submission into review without setting registered true", () => {
  const result = applyActionResponse({
    missionSlug: "register-electoral-roll",
    response: "submitted",
    now: new Date("2026-08-26T12:00:00Z"),
  });
  expect(result.missionState).toBe("in_review");
  expect(result.profilePatch).toEqual({});
  expect(result.nextReviewAt).not.toBeNull();
});

it("self-confirming direct debit updates the target account and completes only that instance", () => {
  const result = applyActionResponse({
    missionSlug: "set-up-direct-debit",
    response: "completed",
    now: new Date("2026-08-26T12:00:00Z"),
  });
  expect(result.missionState).toBe("completed");
  expect(result.accountPatch).toEqual({ directDebitStatus: "yes" });
});

it("starting an application cooldown creates cooldown state rather than completion", () => {
  const result = applyActionResponse({
    missionSlug: "application-cooldown",
    response: "started",
    now: new Date("2026-08-26T12:00:00Z"),
  });
  expect(result.missionState).toBe("cooldown");
  expect(result.nextReviewAt).not.toBeNull();
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- tests/unit/action-lifecycle.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement pure lifecycle outcomes**

Use an explicit response union:

```ts
export type ActionResponse =
  | "submitted"
  | "completed"
  | "started"
  | "not_finished"
  | "could_not_do"
  | "do_later"
  | "confirmed_registered";
```

Return:

```ts
export interface ActionOutcome {
  attemptStatus: ActionAttemptStatus;
  missionState: MissionState;
  nextReviewAt: string | null;
  profilePatch: Partial<Pick<CreditProfile, "electoralRoll" | "hasDirectDebitForCredit">>;
  accountPatch: Partial<Pick<UserAccount, "directDebitStatus" | "balanceMinor" | "creditLimitMinor">>;
}
```

For electoral submission use 30 days. For cooldown use 30 days initially. `not_finished` returns mission `started`; `do_later` returns `deferred` with 7-day review; `could_not_do` leaves `started` or defers based on UI choice but does not complete.

- [ ] **Step 4: Implement owner-scoped attempt update route**

`PATCH /api/actions/attempts/[id]` accepts `{ response }` and optional account evidence fields only for the utilisation flow:

```ts
z.object({
  response: z.enum(["submitted","completed","started","not_finished","could_not_do","do_later","confirmed_registered"]),
  balanceMinor: z.number().int().min(0).optional(),
  creditLimitMinor: z.number().int().positive().optional(),
}).strict();
```

Load attempt by `id + user_id`; load its mission instance and subject account. Apply the pure outcome. For utilisation, recalculate using the updated balance/limit and complete only when the result is <=30; otherwise keep the mission started/in-review and persist the updated account figures.

Perform account/profile write first, mission instance second, attempt third, then analytics. If any write fails, return an error and do not claim completion in the response.

- [ ] **Step 5: Build `ResumeActionCard`**

Props include attempt, mission title, provider/account label, and verification mode. Provide buttons:
- Yes, completed/submitted
- I started but did not finish
- I could not do it
- Do this later.

For electoral roll, the primary label is `I submitted my registration`; a later in-review prompt uses `I’m now registered`.

- [ ] **Step 6: Run lifecycle/API tests**

```bash
npm test -- tests/unit/action-lifecycle.test.ts tests/unit/mission-lifecycle.test.ts tests/unit/action-api-routes.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/domain/action-lifecycle.ts lib/domain/mission-lifecycle.ts tests/unit/action-lifecycle.test.ts tests/unit/mission-lifecycle.test.ts app/api/actions/attempts components/actions/resume-action-card.tsx tests/unit/action-api-routes.test.ts
git commit -m "feat: add action confirmation lifecycle"
```

---

### Task 10: Integrate all five current missions with Action Layer semantics

**Files:**
- Modify: `lib/data/missions.ts`
- Modify: `lib/domain/account-missions.ts`
- Modify: `lib/domain/action-lifecycle.ts`
- Modify: `lib/domain/offer-matcher.ts` only if needed for referral handoff metadata; do not change ranking inputs.
- Modify: `tests/unit/account-missions.test.ts`
- Modify: `tests/unit/offer-matcher.test.ts`

**Interfaces:**
- Electoral roll: official GOV.UK action, `self_confirm_review`.
- Direct debit: provider-aware if configured, otherwise safe internal/manual fallback; self-confirm updates only target card.
- Reduce utilisation: calculate target amount where balance/limit known; action click never completes.
- Application cooldown: internal flow sets cooldown review date.
- Build revolving history: internal `/offers` route remains adult/Safe Mode gated; offer click/application never completes mission automatically.

- [ ] **Step 1: Add mission-semantic tests**

Add assertions:

```ts
it("calculates a useful reduction target without promising a score outcome", () => {
  const account = card("a1", 62000, 100000, "yes");
  expect(amountToReachUtilisation(account, 30)).toBe(32000);
});

it("does not complete revolving-history mission from an offer click", () => {
  // offer matching can return an offer, but no mission lifecycle function is invoked by getOffersForMission
  expect(getOffersForMission(profileWithNoRevolvingHistory, revolvingMission).length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run focused tests**

```bash
npm test -- tests/unit/account-missions.test.ts tests/unit/offer-matcher.test.ts tests/unit/action-lifecycle.test.ts
```

Expected: initial failures where semantics are not yet wired.

- [ ] **Step 3: Add mission action metadata only where domain code needs it**

Do not put provider URLs into `lib/data/missions.ts`. Keep URLs in `action_registry`. Mission definitions may add `reviewPeriodDays` where lifecycle semantics require it: electoral roll `30`, application cooldown `30`.

Remove reliance on `completionEffect` for electoral roll and direct debit in Action Layer server flows; the action lifecycle now applies those patches only after the correct confirmation. Keep legacy completion effects only if demo mode still requires them, and guard the production Action Layer path from invoking them prematurely.

- [ ] **Step 4: Add utilisation planning copy helper**

Export:

```ts
export function utilisationTargetCopy(account: UserAccount, thresholdPct = 30): string | null {
  const amount = amountToReachUtilisation(account, thresholdPct);
  if (amount === null || amount <= 0) return null;
  return `Based on the balance and limit you entered, reducing this balance by about £${(amount / 100).toFixed(2)} would bring this card to around ${thresholdPct}% utilisation. This is a planning target, not a guaranteed credit-score outcome.`;
}
```

- [ ] **Step 5: Verify offer gating remains unchanged**

Run:

```bash
npm test -- tests/unit/offer-matcher.test.ts tests/unit/safety.test.ts tests/unit/age-gate.test.ts
```

Expected: under-18 and Safe Mode referral suppression still PASS, and commission still has no effect on mission ranking.

- [ ] **Step 6: Commit**

```bash
git add lib/data/missions.ts lib/domain/account-missions.ts lib/domain/action-lifecycle.ts lib/domain/offer-matcher.ts tests/unit/account-missions.test.ts tests/unit/offer-matcher.test.ts
git commit -m "feat: wire current missions to action semantics"
```

---

### Task 11: Replace dashboard direct-completion flow with Action Layer navigation and resume state

**Files:**
- Modify: `components/dashboard/dashboard-client.tsx`
- Modify: `components/dashboard/next-mission-card.tsx`
- Modify: `components/dashboard/progress-strip.tsx` only if instance counts require it.
- Modify: `tests/unit/dashboard-components.test.tsx`
- Modify: `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Authenticated mode uses target-aware mission instances and routes Start/Continue into `/actions/<missionInstanceId>`.
- Demo mode may keep local-only behaviour but must mirror the no-click-equals-complete principle.
- Pending attempts render `ResumeActionCard` before a new mission CTA when appropriate.
- Dashboard exposes a `My accounts` link.

- [ ] **Step 1: Update component test to demand action routing rather than Mark complete**

Replace the started-state expectation with:

```tsx
it("routes an actionable mission into the Action Screen instead of offering immediate completion", () => {
  render(<NextMissionCard
    rankedMission={rankedMission}
    progress={{ state: "started" }}
    actionHref="/actions/mi1"
  />);
  expect(screen.getByRole("link", { name: /continue this mission/i }).getAttribute("href")).toBe("/actions/mi1");
  expect(screen.queryByRole("button", { name: "Mark complete" })).toBeNull();
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- tests/unit/dashboard-components.test.tsx
```

Expected: FAIL because `NextMissionCard` still exposes direct completion.

- [ ] **Step 3: Update `NextMissionCard` API**

Use props:

```ts
actionHref?: string;
onStart?: () => void;
onDefer?: () => void;
```

Before start, button may say `Start this mission`. Once a persisted instance exists, primary CTA should be a link `Continue this mission` to `actionHref`. Remove `onComplete`/`Mark complete` from authenticated Action Layer rendering.

- [ ] **Step 4: Hydrate server-backed dashboard data**

Add a single authenticated bootstrap endpoint if needed, e.g. `GET /api/dashboard`, returning profile, accounts, synced mission instances, ranked next instance, and latest pending attempt. If created, test it in `tests/unit/action-api-routes.test.ts` and keep it owner-scoped. Avoid making the client reconstruct database mission IDs from local storage.

- [ ] **Step 5: Add resume card and accounts navigation**

At dashboard top, if a pending attempt exists, render `ResumeActionCard`. Add header link `My accounts` to `/accounts`. When account-scoped mission eligibility exists but no manual accounts have been added, render a contextual `Add your credit account` CTA rather than pretending a provider route can be resolved.

- [ ] **Step 6: Update E2E expectations**

Change the electoral-roll journey:

```ts
await page.getByRole("button", { name: "Start this mission" }).click();
await page.getByRole("link", { name: "Continue this mission" }).click();
await expect(page).toHaveURL(/\/actions\//);
await expect(page.getByText(/GOV.UK/)).toBeVisible();
await expect(page.getByText(/does not mean the mission is complete/i)).toBeVisible();
```

In demo E2E, do not actually leave for GOV.UK. Mock `/api/actions/start` or use the internal demo resolver so the test can assert the attempt is created and completion count remains `0` until confirmation.

- [ ] **Step 7: Run component and E2E tests**

```bash
npm test -- tests/unit/dashboard-components.test.tsx tests/unit/action-screen.test.tsx
npm run test:e2e
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/dashboard components/actions tests/unit/dashboard-components.test.tsx tests/e2e/smoke.spec.ts app/api/dashboard
git commit -m "feat: connect dashboard to mission actions"
```

---

### Task 12: Add Action Layer analytics without allowing analytics to block journeys

**Files:**
- Modify: `lib/events.ts`
- Modify: `tests/unit/events.test.ts`
- Modify action API routes to write analytics after successful state writes.

**Interfaces:**
- Adds `action_resolved`, `action_started`, `action_returned`, `action_submitted`, `action_self_confirmed`, `action_verified`, `action_cancelled`.
- Metadata is limited to non-sensitive IDs/categories: mission slug, mission instance ID, action ID, provider slug/name where appropriate, account type, fallback used.

- [ ] **Step 1: Add failing event validation tests**

Append:

```ts
expect(eventPayloadSchema.safeParse({ name: "action_started", metadata: { missionSlug: "register-electoral-roll", actionId: "a1" } }).success).toBe(true);
expect(eventPayloadSchema.safeParse({ name: "action_verified", metadata: { missionSlug: "register-electoral-roll" } }).success).toBe(true);
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- tests/unit/events.test.ts
```

Expected: FAIL because action event names are not accepted.

- [ ] **Step 3: Extend the event enum**

Add:

```ts
"action_resolved",
"action_started",
"action_returned",
"action_submitted",
"action_self_confirmed",
"action_verified",
"action_cancelled",
```

Keep `trackEvent` best-effort and non-blocking.

- [ ] **Step 4: Write events only after core writes succeed**

In server routes, call `events.insert` after the action attempt/mission/account/profile updates complete. Analytics insertion errors must not roll back or change the user-visible success state.

- [ ] **Step 5: Run event/API tests**

```bash
npm test -- tests/unit/events.test.ts tests/unit/action-api-routes.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/events.ts tests/unit/events.test.ts app/api/actions
git commit -m "feat: track mission action analytics"
```

---

### Task 13: Update docs and run full verification

**Files:**
- Modify: `README.md`
- Modify: `tests/e2e/smoke.spec.ts` if final integration changes require it.

**Interfaces:**
- README accurately distinguishes shipped Action Layer capability from future Open Banking/CRA/API integrations.
- Full CI command set passes.

- [ ] **Step 1: Update README product section**

Add a `V2 Action Layer Phase 1` section covering:

```text
- current missions now resolve to internal, official-government, provider, or referral actions
- manual multi-account support for card-specific missions
- official electoral-roll route uses GOV.UK and submission enters review instead of instant completion
- account/provider destinations come from a server-side registry and allowlist
- Credit Quest stores no provider credentials or full card numbers
- Open Banking, CRA ingestion and payment initiation are still future integrations
```

Add `003_action_layer.sql`, the new design spec and implementation plan to the docs/setup references.

- [ ] **Step 2: Run focused regression suite**

```bash
npm test -- \
  tests/unit/account-missions.test.ts \
  tests/unit/action-resolver.test.ts \
  tests/unit/action-lifecycle.test.ts \
  tests/unit/action-api-routes.test.ts \
  tests/unit/action-screen.test.tsx \
  tests/unit/accounts-client.test.tsx \
  tests/unit/mission-engine.test.ts \
  tests/unit/mission-lifecycle.test.ts \
  tests/unit/offer-matcher.test.ts \
  tests/unit/events.test.ts \
  tests/unit/dashboard-components.test.tsx
```

Expected: all PASS.

- [ ] **Step 3: Run full verification**

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
```

Expected:
- audit reports no high/critical production dependency vulnerabilities
- lint exits 0
- all Vitest tests pass
- all Playwright tests pass
- Next production build exits 0.

- [ ] **Step 4: Verify database migration in a Supabase environment**

Run local `npx supabase db reset` plus `supabase/tests/rls.sql`, or apply the migration to the connected non-production/development Supabase project and inspect security advisors. Confirm `user_accounts` and `action_attempts` are owner-scoped and provider/action registries expose no client write policy.

- [ ] **Step 5: Manual happy-path checks**

Verify these journeys in a browser:

```text
1. Electoral roll:
   not registered → Start → Action Screen → official GOV.UK destination → return → "submitted" → in_review → later "I'm now registered" → completed.

2. Two cards, no direct debit:
   add Card A + Card B → two separate direct-debit mission instances → complete Card A → Card B remains actionable.

3. High utilisation:
   known balance/limit → target amount displayed → external/internal provider action → click does not complete → update balance below threshold → completes.

4. Application cooldown:
   high recent applications → start cooldown → mission enters cooldown with review date; no product referral appears if Safe Mode blocks it.

5. Build revolving history:
   adult thin-file profile → Action Screen → internal Offers → provider click remains lender-owned and does not auto-complete mission.

6. Education mode:
   age 16–17 → electoral roll educational/official action may appear where profile says not registered; no credit-product referral/action is available.
```

- [ ] **Step 6: Commit documentation/final test adjustments**

```bash
git add README.md tests/e2e/smoke.spec.ts
git commit -m "docs: document mission action layer"
```

- [ ] **Step 7: Final branch verification**

Run:

```bash
git status --short
git log --oneline --decorate -12
```

Expected: clean working tree and a sequence of small Action Layer commits ready for review/PR.

---

## Self-review results

### Spec coverage

- Hybrid configured/internal/API-ready action model: Tasks 3, 4, 8.
- Verification/self-confirm/review semantics: Task 9.
- Manual provider/account selection and future Open Banking-compatible model: Tasks 2, 3, 5, 6.
- Major-provider-ready registry + generic fallback: Tasks 3, 4.
- Supabase-backed Action Registry: Tasks 3, 4, 8.
- Multiple accounts and target-aware mission instances: Tasks 1, 2, 3, 7.
- Minimal account model with no credentials/full PAN: Tasks 1, 3, 5, 6.
- Secure server-authoritative start and allowlist: Tasks 4, 8.
- Action Screen: Task 8.
- Return/resume: Tasks 9, 11.
- Electoral-roll delayed verification: Tasks 3, 9, 10, 11.
- Direct-debit per-account behaviour: Tasks 2, 9, 10.
- Utilisation target calculation/evidence-based completion: Tasks 2, 9, 10.
- Application cooldown internal state: Tasks 9, 10.
- Controlled revolving-history referral: Tasks 10, 11.
- Analytics: Task 12.
- RLS/security: Tasks 3, 5, 8, 13.
- PWA/mobile architecture preserved; no unrelated redesign: all tasks.
- Customer Journey Workflow Visualisation remains out of scope and is not introduced here.

### Placeholder scan

No `TBD`, `TODO`, or unspecified "handle errors" steps are used. Each implementation task names files, concrete interfaces, test commands, expected states, and commit boundaries.

### Type consistency

- `MissionInstance.subject` uses `MissionSubject` consistently.
- `UserAccount.directDebitStatus` uses `yes|no|unknown` in domain, SQL, and lifecycle patches.
- `ActionDefinition.mode` and `ResolvedAction.mode` use the same `ActionMode` union.
- `VerificationMode` names match SQL constraints and resolver output.
- `ActionAttemptStatus` names match SQL constraints and lifecycle output.
- Money fields are consistently integer minor units.
- Electoral submission uses `in_review`; only later confirmed registration applies `electoralRoll=true`.
