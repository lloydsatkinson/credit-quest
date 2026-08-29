# Credit Quest V2.2C Commercial Gateway & Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete dark commercial control plane: server-side hard gates, sandbox-only referral provenance, versioned disclosures, partner/route configuration, append-only revenue/audit events and a narrow Credit Quest Admin — while production live regulated credit referrals remain technically blocked.

**Architecture:** Add an isolated `lib/commercial` pure gate/ordering domain downstream of existing safety/readiness; all persistence and redirects happen through server-only repositories/routes. Route presentation applies protective/configuration gates and lets the customer see the current disclosure. Referral creation re-runs the gates and then requires explicit consent. The browser supplies only stable IDs and consent, never destination URLs or eligibility facts. `feature_flags` from V2.2B controls runtime activation. A second server environment guard keeps live credit referrals impossible until a future explicitly approved regulatory release.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase Auth/Postgres/RLS, Zod 3, Vitest 3, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-29-credit-quest-v2-2-journey-growth-design.md`

**Dependency:** V2.2A and V2.2B complete and green, including migrations 009/010 and `feature_flags`.

## Global Constraints

- Live regulated credit referrals remain OFF. V2.2 creates sandbox referrals only until a later separately approved regulatory decision changes the explicit server guard.
- `commercial_gateway_enabled` defaults false. Turning it on is necessary but not sufficient for a live route.
- `LIVE_CREDIT_REFERRALS_ALLOWED=false` is a server-only guard. Live route presentation/creation requires the DB flag true **and** env value exactly `true`; V2.2 rollout never sets it true.
- Under-18, Safe Mode, red/amber/unknown readiness, incomplete required evidence, missing disclosure, disabled partner/route or unavailable config => no route presentation/referral.
- Explicit consent is required at referral creation, after the disclosure has been shown. Consent is not required merely to list an otherwise permitted route/disclosure.
- Commercial gating is downstream. Do not modify safety, readiness, mission ranking, Quest Score or Academy selection.
- The known `hasRevolvingCredit === null` readiness edge remains untouched. Commercial Gateway independently requires `hasRevolvingCredit !== null`.
- No lender underwriting criteria, approval odds or inferred lender eligibility.
- No commission/EPC/payout fields in `commercial_routes`; route ordering cannot see revenue economics.
- Multiple equivalent permitted routes use stable `routeKey`, then partner key ordering. Experiments may later vary presentation only within that already-permitted set.
- Browser never supplies arbitrary destination URL, user id, readiness, age, Safe Mode state or revenue amount.
- Existing `lib/domain/offer-matcher.ts` is demo-only after this stage. Configured/authenticated product referrals go through Commercial Gateway; no configured production page may bypass it.
- Referral/revenue history is append-only in application semantics: DB rejects UPDATE; clients have no DELETE; service-role DELETE remains possible for deliberate user/account data erasure.
- Admin membership is explicit; no user can self-promote.
- Quest Feed remains exactly seven cards.
- Every task follows observed RED -> minimal GREEN -> refactor -> focused commit.

---

## File Map

### New commercial domain/server files
- `lib/commercial/types.ts` — route/partner/disclosure/gate/result contracts without economics.
- `lib/commercial/gates.ts` — pure presentation and referral hard gates.
- `lib/commercial/ordering.ts` — stable non-commercial ordering.
- `lib/server/commercial-repository.ts` — private config reads and append-only referral/revenue writes.
- `lib/server/commercial-gateway.ts` — recomputes current user context and applies gates.
- `supabase/migrations/011_commercial_admin.sql` — commercial/admin schema, publication/mutation RPCs, RLS.

### New commercial routes/UI
- `app/api/commercial/routes/route.ts`
- `app/api/commercial/referrals/route.ts`
- `app/sandbox/referral-complete/page.tsx`
- `components/commercial/commercial-gateway-card.tsx`

### New admin files
- `lib/server/admin-auth.ts`
- `lib/server/admin-repository.ts`
- `app/admin/layout.tsx`
- `app/admin/page.tsx`
- `app/admin/partners/page.tsx`
- `app/admin/routes/page.tsx`
- `app/admin/disclosures/page.tsx`
- `app/admin/flags/page.tsx`
- `app/admin/experiments/page.tsx`
- `app/admin/audit/page.tsx`
- `app/api/admin/partners/route.ts`
- `app/api/admin/routes/route.ts`
- `app/api/admin/disclosures/route.ts`
- `app/api/admin/flags/route.ts`
- `app/api/admin/experiments/route.ts`
- `components/admin/admin-nav.tsx`
- `components/admin/partner-form.tsx`
- `components/admin/route-form.tsx`
- `components/admin/disclosure-form.tsx`
- `components/admin/flag-toggle.tsx`
- `components/admin/experiment-form.tsx`

### Existing files to modify
- `.env.example`
- `app/offers/page.tsx`
- `components/offers/offers-client.tsx`
- `app/dashboard/page.tsx`
- `components/dashboard/dashboard-client.tsx`
- `supabase/tests/rls.sql`
- `tests/e2e/smoke.spec.ts`
- `README.md`

### New tests
- `tests/unit/commercial-migration.test.ts`
- `tests/unit/commercial-gates.test.ts`
- `tests/unit/commercial-ordering.test.ts`
- `tests/unit/commercial-repository.test.ts`
- `tests/unit/commercial-gateway.test.ts`
- `tests/unit/commercial-routes-api.test.ts`
- `tests/unit/commercial-referrals-api.test.ts`
- `tests/unit/commercial-gateway-card.test.tsx`
- `tests/unit/admin-auth.test.ts`
- `tests/unit/admin-repository.test.ts`
- `tests/unit/admin-api.test.ts`
- `tests/unit/commercial-boundaries.test.ts`

---

### Task 1: Add commercial/admin schema, provenance, publication and transactional admin mutation RPCs

**Files:**
- Create: `supabase/migrations/011_commercial_admin.sql`
- Modify: `supabase/tests/rls.sql`
- Test: `tests/unit/commercial-migration.test.ts`

**Interfaces:**
- Produces tables `admin_members`, `commercial_partners`, `commercial_routes`, `commercial_disclosures`, `referral_attempts`, `revenue_events`, `experiments`, `admin_audit_log`.
- Produces service-only `publish_commercial_disclosure(uuid)`.
- Produces service-only admin mutation RPCs that verify explicit admin membership and append audit in the same transaction.

- [ ] **Step 1: Write the failing migration contract test**

Create `tests/unit/commercial-migration.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "supabase/migrations/011_commercial_admin.sql");

describe("V2.2C commercial/admin migration", () => {
  it("creates private commercial control tables and no live seed", () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;
    const sql = readFileSync(migrationPath, "utf8");
    for (const table of [
      "admin_members",
      "commercial_partners",
      "commercial_routes",
      "commercial_disclosures",
      "referral_attempts",
      "revenue_events",
      "experiments",
      "admin_audit_log",
    ]) {
      expect(sql).toContain(`create table public.${table}`);
    }
    expect(sql).toContain("commercial_disclosures_one_published");
    expect(sql).toContain("reject_referral_attempt_update");
    expect(sql).toContain("reject_revenue_event_update");
    expect(sql).toContain("publish_commercial_disclosure");
    expect(sql).toContain("credit-quest-sandbox");
    expect(sql).not.toMatch(/insert[\s\S]*environment[^;]*'live'/i);
  });
});
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/commercial-migration.test.ts
```

Expected: FAIL because migration 011 does not exist.

- [ ] **Step 3: Create the base tables and DB constraints**

Start `supabase/migrations/011_commercial_admin.sql` with:

```sql
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
```

- [ ] **Step 4: Add RLS/grants and update immutability**

Continue migration 011:

```sql
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
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'referral_attempts are append-only';
end;
$$;

create trigger referral_attempts_reject_update
before update on public.referral_attempts
for each row execute function public.reject_referral_attempt_update();

create or replace function public.reject_revenue_event_update()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'revenue_events are append-only';
end;
$$;

create trigger revenue_events_reject_update
before update on public.revenue_events
for each row execute function public.reject_revenue_event_update();
```

Do not add DELETE-rejection triggers. Ordinary users have no delete grant; service-role erasure must remain possible.

- [ ] **Step 5: Add service-only atomic disclosure publication**

Add:

```sql
create or replace function public.publish_commercial_disclosure(p_article_id uuid)
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
  where id = p_article_id
  for update;

  if target.id is null then raise exception 'Disclosure not found'; end if;
  if target.status <> 'reviewed' then raise exception 'Only reviewed disclosures can be published'; end if;

  update public.commercial_disclosures
  set status = 'superseded', updated_at = now()
  where disclosure_key = target.disclosure_key
    and status = 'published'
    and id <> target.id;

  update public.commercial_disclosures
  set status = 'published', published_at = coalesce(published_at, now()), updated_at = now()
  where id = target.id
  returning * into target;

  return target;
end;
$$;

revoke all on function public.publish_commercial_disclosure(uuid) from public, anon, authenticated;
grant execute on function public.publish_commercial_disclosure(uuid) to service_role;
```

- [ ] **Step 6: Add explicit admin-check helper and transactional mutation RPCs**

Add a private helper:

```sql
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
```

Then add these service-only RPCs, each calling `assert_credit_quest_admin`, performing one config mutation and inserting an `admin_audit_log` row in the same transaction:

```text
admin_upsert_commercial_partner(
  p_admin_user_id uuid,
  p_partner_id uuid,
  p_partner_key text,
  p_display_name text,
  p_enabled boolean,
  p_sandbox_enabled boolean,
  p_live_enabled boolean,
  p_notes text
)

admin_upsert_commercial_route(
  p_admin_user_id uuid,
  p_route_id uuid,
  p_route_key text,
  p_partner_id uuid,
  p_environment text,
  p_destination_url text,
  p_enabled boolean,
  p_disclosure_key text
)

admin_set_feature_flag(
  p_admin_user_id uuid,
  p_flag_key text,
  p_enabled boolean
)

admin_upsert_experiment(
  p_admin_user_id uuid,
  p_experiment_id uuid,
  p_experiment_key text,
  p_status text,
  p_surface_key text,
  p_variants jsonb
)
```

For `admin_set_feature_flag`, enforce:

```sql
if p_flag_key not in ('email_reminders_enabled','commercial_gateway_enabled') then
  raise exception 'Feature flag is not admin-editable';
end if;
```

For route RPC, enforce DB values `min_age=18` and `required_readiness='green'` server-side; do not accept them as mutable parameters.

- [ ] **Step 7: Seed only disabled internal sandbox data**

Add:

```sql
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
```

- [ ] **Step 8: Extend RLS verification and run migration checks**

Add SQL assertions that:
- anon/authenticated have no grants on all eight new tables;
- only service_role executes publication/admin RPCs;
- no `environment='live' and enabled=true` row exists;
- UPDATE on a rollback-only referral/revenue probe raises;
- service role can DELETE a rollback-only referral/revenue probe to preserve erasure behavior.

Run:

```bash
npm test -- tests/unit/commercial-migration.test.ts
supabase db start
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f supabase/tests/rls.sql
supabase stop --no-backup
```

Expected: all commands exit 0.

- [ ] **Step 9: Commit Task 1**

```bash
git add supabase/migrations/011_commercial_admin.sql supabase/tests/rls.sql tests/unit/commercial-migration.test.ts
git commit -m "feat: add commercial control plane schema"
```

---

### Task 2: Add pure commercial presentation/referral gates and non-commercial ordering

**Files:**
- Create: `lib/commercial/types.ts`
- Create: `lib/commercial/gates.ts`
- Create: `lib/commercial/ordering.ts`
- Test: `tests/unit/commercial-gates.test.ts`
- Test: `tests/unit/commercial-ordering.test.ts`

**Interfaces:**

```ts
hasRequiredCommercialEvidence(profile): boolean
evaluateCommercialPresentationGate(context): CommercialGateResult
evaluateCommercialReferralGate({ ...context, consent }): CommercialGateResult
orderEquivalentCommercialRoutes(routes): routes
```

- [ ] **Step 1: Write the failing hard-gate tests**

Create `tests/unit/commercial-gates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  evaluateCommercialPresentationGate,
  evaluateCommercialReferralGate,
  hasRequiredCommercialEvidence,
} from "@/lib/commercial/gates";
import type { CreditProfile } from "@/lib/domain/types";

const profile: CreditProfile = {
  userId: "u1",
  dateOfBirth: "1990-01-01",
  employmentStatus: "employed",
  incomeBand: "30_50k",
  housingStatus: "rent",
  electoralRoll: true,
  utilisationPct: 10,
  missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 0,
  hasRevolvingCredit: true,
  hasDirectDebitForCredit: true,
};

const allowed = {
  gatewayEnabled: true,
  liveAllowed: false,
  environment: "sandbox" as const,
  ageMode: "adult" as const,
  safetyMode: "normal" as const,
  readinessState: "green" as const,
  evidenceComplete: true,
  partnerEnabled: true,
  partnerEnvironmentEnabled: true,
  routeEnabled: true,
  routeEnvironment: "sandbox" as const,
  disclosurePresent: true,
};

describe("commercial hard gates", () => {
  it("blocks every non-green readiness state", () => {
    for (const state of ["red", "amber", "unknown"] as const) {
      expect(evaluateCommercialPresentationGate({ ...allowed, readinessState: state }))
        .toEqual({ permitted: false, reason: "readiness_not_green" });
    }
  });

  it("blocks unknown revolving-credit evidence independently of readiness", () => {
    expect(hasRequiredCommercialEvidence({ ...profile, hasRevolvingCredit: null })).toBe(false);
  });

  it("shows disclosure before consent but requires consent to create a referral", () => {
    expect(evaluateCommercialPresentationGate(allowed)).toEqual({ permitted: true });
    expect(evaluateCommercialReferralGate({ ...allowed, consent: false }))
      .toEqual({ permitted: false, reason: "consent_missing" });
    expect(evaluateCommercialReferralGate({ ...allowed, consent: true }))
      .toEqual({ permitted: true });
  });
});
```

Add cases for `gateway_disabled`, `live_not_allowed`, `under_18`, `safe_mode`, missing evidence, partner/route disabled, wrong environment and missing disclosure. Assert first protective failure wins.

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/commercial-gates.test.ts
```

Expected: FAIL because commercial domain does not exist.

- [ ] **Step 3: Implement commercial types and evidence/gate functions**

Create `lib/commercial/types.ts`:

```ts
import type { ReadinessState } from "@/lib/domain/types";

export type CommercialEnvironment = "sandbox" | "live";

export interface CommercialPartner {
  id: string;
  partnerKey: string;
  displayName: string;
  enabled: boolean;
  sandboxEnabled: boolean;
  liveEnabled: boolean;
}

export interface CommercialRoute {
  id: string;
  routeKey: string;
  partnerId: string;
  partnerKey: string;
  partnerDisplayName: string;
  environment: CommercialEnvironment;
  destinationUrl: string;
  enabled: boolean;
  disclosureKey: string;
}

export interface CommercialDisclosure {
  id: string;
  disclosureKey: string;
  version: number;
  body: string;
}

export type CommercialGateReason =
  | "gateway_disabled"
  | "live_not_allowed"
  | "under_18"
  | "safe_mode"
  | "readiness_not_green"
  | "missing_evidence"
  | "partner_disabled"
  | "route_disabled"
  | "environment_not_permitted"
  | "disclosure_missing"
  | "consent_missing";

export type CommercialGateResult =
  | { permitted: true }
  | { permitted: false; reason: CommercialGateReason };

export interface CommercialGateContext {
  gatewayEnabled: boolean;
  liveAllowed: boolean;
  environment: CommercialEnvironment;
  ageMode: "adult" | "education";
  safetyMode: "normal" | "caution" | "safe_mode";
  readinessState: ReadinessState;
  evidenceComplete: boolean;
  partnerEnabled: boolean;
  partnerEnvironmentEnabled: boolean;
  routeEnabled: boolean;
  routeEnvironment: CommercialEnvironment;
  disclosurePresent: boolean;
}
```

Create `lib/commercial/gates.ts`:

```ts
import type { CreditProfile } from "@/lib/domain/types";
import type { CommercialGateContext, CommercialGateResult } from "@/lib/commercial/types";

export function hasRequiredCommercialEvidence(profile: CreditProfile): boolean {
  if (profile.missedPaymentsLast12m === null) return false;
  if (profile.hardApplicationsLast6m === null) return false;
  if (profile.hasRevolvingCredit === null) return false;
  if (profile.hasRevolvingCredit === true && profile.utilisationPct === null) return false;
  return true;
}

export function evaluateCommercialPresentationGate(context: CommercialGateContext): CommercialGateResult {
  if (!context.gatewayEnabled) return { permitted: false, reason: "gateway_disabled" };
  if (context.environment === "live" && !context.liveAllowed) return { permitted: false, reason: "live_not_allowed" };
  if (context.ageMode !== "adult") return { permitted: false, reason: "under_18" };
  if (context.safetyMode === "safe_mode") return { permitted: false, reason: "safe_mode" };
  if (context.readinessState !== "green") return { permitted: false, reason: "readiness_not_green" };
  if (!context.evidenceComplete) return { permitted: false, reason: "missing_evidence" };
  if (!context.partnerEnabled || !context.partnerEnvironmentEnabled) return { permitted: false, reason: "partner_disabled" };
  if (!context.routeEnabled) return { permitted: false, reason: "route_disabled" };
  if (context.routeEnvironment !== context.environment) return { permitted: false, reason: "environment_not_permitted" };
  if (!context.disclosurePresent) return { permitted: false, reason: "disclosure_missing" };
  return { permitted: true };
}

export function evaluateCommercialReferralGate(
  context: CommercialGateContext & { consent: boolean },
): CommercialGateResult {
  const presentation = evaluateCommercialPresentationGate(context);
  if (!presentation.permitted) return presentation;
  if (context.consent !== true) return { permitted: false, reason: "consent_missing" };
  return { permitted: true };
}
```

- [ ] **Step 4: Run gate tests and verify GREEN**

```bash
npm test -- tests/unit/commercial-gates.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write and implement non-commercial ordering**

Create `tests/unit/commercial-ordering.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { orderEquivalentCommercialRoutes } from "@/lib/commercial/ordering";

describe("commercial route ordering", () => {
  it("uses stable route/partner keys and ignores economics-shaped extra data", () => {
    const routes = [
      { id: "2", routeKey: "z-route", partnerKey: "a", commission: 9999 },
      { id: "1", routeKey: "a-route", partnerKey: "z", commission: 1 },
    ];
    const ordered = orderEquivalentCommercialRoutes(routes);
    expect(ordered.map((route) => route.id)).toEqual(["1", "2"]);
  });
});
```

Create `lib/commercial/ordering.ts`:

```ts
export function orderEquivalentCommercialRoutes<T extends {
  routeKey: string;
  partnerKey: string;
}>(routes: readonly T[]): T[] {
  return [...routes].sort((a, b) =>
    a.routeKey.localeCompare(b.routeKey) || a.partnerKey.localeCompare(b.partnerKey));
}
```

Run:

```bash
npm test -- tests/unit/commercial-ordering.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add lib/commercial tests/unit/commercial-gates.test.ts tests/unit/commercial-ordering.test.ts
git commit -m "feat: add commercial hard gates"
```

---

### Task 3: Add Commercial Repository and server-side Gateway

**Files:**
- Create: `lib/server/commercial-repository.ts`
- Create: `lib/server/commercial-gateway.ts`
- Test: `tests/unit/commercial-repository.test.ts`
- Test: `tests/unit/commercial-gateway.test.ts`

**Interfaces:**

```ts
listCommercialRoutes(admin, environment)
getPublishedCommercialDisclosure(admin, disclosureKey)
getCommercialRoute(admin, routeId)
appendReferralAttempt(admin, input)
appendRevenueEvent(admin, input)
listPermittedCommercialRoutes({ userId, environment, now })
createCommercialReferral({ userId, routeId, disclosureId, consent, originatingMissionId, now })
```

- [ ] **Step 1: Write failing repository mapping tests**

Create `tests/unit/commercial-repository.test.ts` asserting:
- DB snake_case maps to `CommercialRoute`/`CommercialDisclosure`.
- list query filters exact `environment`.
- referral insert takes `userId`, route/partner/disclosure IDs and no caller-provided destination.
- module exports no `updateReferralAttempt`/`deleteReferralAttempt`/`updateRevenueEvent` functions.

Run:

```bash
npm test -- tests/unit/commercial-repository.test.ts
```

Expected: FAIL because repository does not exist.

- [ ] **Step 2: Implement the repository**

Create `lib/server/commercial-repository.ts` as `server-only` and use `SupabaseClient`. Implement explicit mappers. `listCommercialRoutes` should select route fields plus joined partner display/status fields, then fetch current published disclosure by `disclosure_key` separately so publication state is explicit. `appendReferralAttempt` inserts only:

```ts
{
  referral_key: input.referralKey,
  user_id: input.userId,
  partner_id: input.partnerId,
  route_id: input.routeId,
  originating_mission_id: input.originatingMissionId ?? null,
  readiness_snapshot: input.readinessSnapshot,
  consented_at: input.consentedAt,
  disclosure_id: input.disclosureId,
  environment: input.environment,
  metadata: input.metadata ?? {},
}
```

No update/delete functions for referral/revenue history.

- [ ] **Step 3: Run repository tests and verify GREEN**

```bash
npm test -- tests/unit/commercial-repository.test.ts
```

Expected: PASS.

- [ ] **Step 4: Write failing Gateway tests with injected dependencies**

Create `tests/unit/commercial-gateway.test.ts` using a factory `createCommercialGateway(deps)`. Pin these cases:

```ts
it("does not require consent to list a permitted disclosure", async () => {
  const routes = await gateway.listPermittedCommercialRoutes({ userId: "u1", environment: "sandbox", now });
  expect(routes).toHaveLength(1);
  expect(routes[0].disclosure.body).toMatch(/Sandbox only/i);
});

it("re-fetches current disclosure and requires consent before insert", async () => {
  await expect(gateway.createCommercialReferral({
    userId: "u1",
    routeId: "route-1",
    disclosureId: "disclosure-1",
    consent: true,
    now,
  })).resolves.toMatchObject({ destinationUrl: "/sandbox/referral-complete" });
  expect(deps.appendReferral).toHaveBeenCalledBefore(deps.returnDestinationMarker);
});
```

Also pin:
- `LIVE_CREDIT_REFERRALS_ALLOWED=false` blocks live.
- `hasRevolvingCredit:null` blocks even with mocked green readiness.
- Safe Mode blocks.
- under-18 blocks.
- route-list/config failure returns `[]` rather than throwing into the core UI.
- referral creation config failure throws a controlled `CommercialGatewayError` and inserts nothing.

- [ ] **Step 5: Implement the Gateway factory and production wrapper**

Create `lib/server/commercial-gateway.ts`. Use a dependency factory for tests, and production deps from:
- `getCreditGuidanceForUser`;
- `getAgeMode`;
- `assessSafety`;
- `hasRequiredCommercialEvidence`;
- `isFeatureEnabled(admin,"commercial_gateway_enabled")`;
- Commercial Repository;
- `createAdminSupabaseClient`.

The list flow for each route:

```ts
const gate = evaluateCommercialPresentationGate({
  gatewayEnabled,
  liveAllowed,
  environment,
  ageMode,
  safetyMode: guidance.safety.mode,
  readinessState: guidance.readiness.state,
  evidenceComplete: hasRequiredCommercialEvidence(guidance.effectiveProfile),
  partnerEnabled: route.partner.enabled,
  partnerEnvironmentEnabled: environment === "sandbox"
    ? route.partner.sandboxEnabled
    : route.partner.liveEnabled,
  routeEnabled: route.enabled,
  routeEnvironment: route.environment,
  disclosurePresent: disclosure !== null,
});
```

Only permitted routes are returned, ordered by `orderEquivalentCommercialRoutes`.

The referral flow must:
1. fetch current guidance/profile/context again;
2. fetch the exact current route by `routeId`;
3. fetch the currently published disclosure for `route.disclosureKey`;
4. require `currentDisclosure.id === input.disclosureId`;
5. run `evaluateCommercialReferralGate(... consent:true)`;
6. validate destination server-side;
7. generate `crypto.randomUUID()` as `referralKey`;
8. insert `referral_attempts`;
9. only then return `{ referralId, destinationUrl }`.

Destination validation:

```ts
if (route.environment === "sandbox") {
  if (!route.destinationUrl.startsWith("/sandbox/")) throw new CommercialGatewayError("invalid_destination");
} else {
  const url = new URL(route.destinationUrl);
  if (url.protocol !== "https:") throw new CommercialGatewayError("invalid_destination");
}
```

Do not accept or return approval probability/criteria/economic values.

- [ ] **Step 6: Run Gateway tests and commit**

```bash
npm test -- tests/unit/commercial-repository.test.ts tests/unit/commercial-gateway.test.ts
git add lib/server/commercial-repository.ts lib/server/commercial-gateway.ts tests/unit/commercial-repository.test.ts tests/unit/commercial-gateway.test.ts
git commit -m "feat: add sandbox commercial gateway"
```

Expected: PASS.

---

### Task 4: Add strict commercial APIs and internal sandbox completion

**Files:**
- Create: `app/api/commercial/routes/route.ts`
- Create: `app/api/commercial/referrals/route.ts`
- Create: `app/sandbox/referral-complete/page.tsx`
- Test: `tests/unit/commercial-routes-api.test.ts`
- Test: `tests/unit/commercial-referrals-api.test.ts`

- [ ] **Step 1: Write failing strict-schema tests**

Create referral API test against exported schema:

```ts
import { describe, expect, it } from "vitest";
import { commercialReferralSchema } from "@/app/api/commercial/referrals/route";

describe("commercial referral payload", () => {
  it("accepts only stable ids and explicit consent", () => {
    const valid = {
      routeId: "00000000-0000-0000-0000-000000000001",
      disclosureId: "00000000-0000-0000-0000-000000000002",
      consent: true,
    };
    expect(commercialReferralSchema.safeParse(valid).success).toBe(true);
    expect(commercialReferralSchema.safeParse({ ...valid, destinationUrl: "https://example.com" }).success).toBe(false);
    expect(commercialReferralSchema.safeParse({ ...valid, userId: "other-user" }).success).toBe(false);
    expect(commercialReferralSchema.safeParse({ ...valid, readiness: "green" }).success).toBe(false);
    expect(commercialReferralSchema.safeParse({ ...valid, commission: 500 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/commercial-routes-api.test.ts tests/unit/commercial-referrals-api.test.ts
```

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Implement authenticated route listing**

Create `app/api/commercial/routes/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listPermittedCommercialRoutes } from "@/lib/server/commercial-gateway";

export async function GET() {
  if (!getSupabasePublicEnv()) return NextResponse.json({ routes: [], mode: "demo" });
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const routes = await listPermittedCommercialRoutes({
    userId: user.id,
    environment: "sandbox",
    now: new Date(),
  }).catch(() => []);
  return NextResponse.json({ routes });
}
```

- [ ] **Step 4: Implement strict referral creation**

Create `app/api/commercial/referrals/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createCommercialReferral, CommercialGatewayError } from "@/lib/server/commercial-gateway";

export const commercialReferralSchema = z.object({
  routeId: z.string().uuid(),
  disclosureId: z.string().uuid(),
  consent: z.literal(true),
  originatingMissionId: z.string().uuid().nullable().optional(),
}).strict();

export async function POST(request: Request) {
  const parsed = commercialReferralSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid referral request" }, { status: 400 });
  if (!getSupabasePublicEnv()) return NextResponse.json({ error: "Sandbox referral requires a signed-in account" }, { status: 409 });

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  try {
    const result = await createCommercialReferral({
      userId: user.id,
      ...parsed.data,
      now: new Date(),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CommercialGatewayError) {
      return NextResponse.json({ error: "This route is not available right now" }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create the sandbox referral" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Add sandbox completion page**

Create `app/sandbox/referral-complete/page.tsx` with visible copy:

```tsx
<h1>Sandbox journey complete</h1>
<p>No lender or credit application was contacted. This page only proves Credit Quest’s consent, attribution and safety plumbing.</p>
```

Do not create a conversion/revenue event merely by loading this page.

- [ ] **Step 6: Run API tests and commit**

```bash
npm test -- tests/unit/commercial-routes-api.test.ts tests/unit/commercial-referrals-api.test.ts
git add app/api/commercial app/sandbox/referral-complete tests/unit/commercial-routes-api.test.ts tests/unit/commercial-referrals-api.test.ts
git commit -m "feat: add commercial sandbox APIs"
```

Expected: PASS.

---

### Task 5: Replace configured referral bypass with a Gateway UI; keep demo inert

**Files:**
- Create: `components/commercial/commercial-gateway-card.tsx`
- Modify: `app/offers/page.tsx`
- Modify: `components/offers/offers-client.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `components/dashboard/dashboard-client.tsx`
- Test: `tests/unit/commercial-gateway-card.test.tsx`

- [ ] **Step 1: Write the failing Gateway-card consent test**

Create `tests/unit/commercial-gateway-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommercialGatewayCard } from "@/components/commercial/commercial-gateway-card";

describe("CommercialGatewayCard", () => {
  it("shows disclosure before requiring explicit sandbox consent", () => {
    render(<CommercialGatewayCard route={{
      id: "r1",
      routeKey: "sandbox",
      partnerDisplayName: "Credit Quest Sandbox Partner",
      disclosure: { id: "d1", body: "Sandbox only. No lender is contacted." },
    }} />);
    expect(screen.getByText(/Sandbox only/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /I understand this is a sandbox referral/i })).not.toBeChecked();
    expect(screen.getByRole("button", { name: /Continue sandbox journey/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/commercial-gateway-card.test.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement the Gateway card**

Create a client component that:
- displays partner name, `Sandbox` badge and current disclosure;
- controls a local consent checkbox;
- POSTs only `{ routeId, disclosureId, consent:true }`;
- on success navigates to `destinationUrl` only if it begins `/sandbox/` in V2.2 UI;
- on error displays “This route is not available right now.”

Never accept destination as a prop from client-side legacy offer data. Destination comes only from the successful server referral response.

- [ ] **Step 4: Make `/offers` configured-mode Gateway-only**

In `app/offers/page.tsx`, detect configured Supabase. In configured mode, authenticate server-side and load `listPermittedCommercialRoutes({ environment:"sandbox" })`. Render:
- route cards when available;
- otherwise: “No product step is available from Credit Quest right now.” plus a link back to `/learn`.

In unconfigured demo mode, keep `OffersClient` only as a visual demo.

- [ ] **Step 5: Make demo offer CTA inert/internal**

Change `components/offers/offers-client.tsx` so it does not navigate to `offer.affiliateUrl`. Render demo cards with visible copy:

```text
Demo only — no application is sent.
```

The demo CTA can be a disabled button or link to `/learn/credit-quest-readiness`; it must not open an affiliate URL.

- [ ] **Step 6: Remove configured dashboard affiliate bypass**

In configured `app/dashboard/page.tsx`, remove any direct affiliate display and route commercial surfaces through the same permitted-route/Gateway component. In demo `dashboard-client.tsx`, any legacy offer section is clearly “Demo only” and has no external affiliate navigation.

Do not alter `FEED_CARD_TOTAL = 7` or add a feed card.

- [ ] **Step 7: Run UI/regression tests and commit**

```bash
npm test -- tests/unit/commercial-gateway-card.test.tsx tests/unit/offers-client.test.tsx tests/unit/academy-components.test.tsx
git add components/commercial/commercial-gateway-card.tsx app/offers/page.tsx components/offers/offers-client.tsx app/dashboard/page.tsx components/dashboard/dashboard-client.tsx tests/unit/commercial-gateway-card.test.tsx
git commit -m "feat: route product journeys through commercial gateway"
```

Use the actual existing offers/dashboard test filenames if they differ; do not duplicate equivalent suites.

Expected: PASS.

---

### Task 6: Add explicit admin authentication and audited repository

**Files:**
- Create: `lib/server/admin-auth.ts`
- Create: `lib/server/admin-repository.ts`
- Test: `tests/unit/admin-auth.test.ts`
- Test: `tests/unit/admin-repository.test.ts`

- [ ] **Step 1: Write failing admin-auth tests**

Create `tests/unit/admin-auth.test.ts` around a dependency factory:

```ts
import { describe, expect, it, vi } from "vitest";
import { createAdminAuthorizer } from "@/lib/server/admin-auth";

describe("admin authorization", () => {
  it("requires both authenticated user and explicit admin membership", async () => {
    const authorize = createAdminAuthorizer({
      getAuthenticatedUser: vi.fn().mockResolvedValue({ id: "u1" }),
      getAdminMembership: vi.fn().mockResolvedValue({ userId: "u1", role: "admin" }),
    });
    await expect(authorize()).resolves.toEqual({ id: "u1" });
  });

  it("fails closed on missing membership", async () => {
    const authorize = createAdminAuthorizer({
      getAuthenticatedUser: vi.fn().mockResolvedValue({ id: "u1" }),
      getAdminMembership: vi.fn().mockResolvedValue(null),
    });
    await expect(authorize()).rejects.toThrow("Admin access required");
  });
});
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/admin-auth.test.ts
```

Expected: FAIL because admin-auth module does not exist.

- [ ] **Step 3: Implement verified admin authorization**

Create `lib/server/admin-auth.ts` using:
- normal `createServerSupabaseClient().auth.getUser()` for identity;
- `createAdminSupabaseClient()` to query `admin_members` for that exact `user.id`;
- throw `AdminAccessError` on unauthenticated, missing membership or read failure.

Do not read an `x-admin`, role cookie, query string or client-provided user id.

- [ ] **Step 4: Implement audited admin repository via RPC only**

Create `lib/server/admin-repository.ts` with list functions for each config table plus mutation wrappers that call only the Task 1 RPCs:

```ts
setFeatureFlag(adminClient, adminUserId, flagKey, enabled)
upsertCommercialPartner(adminClient, adminUserId, input)
upsertCommercialRoute(adminClient, adminUserId, input)
publishCommercialDisclosure(adminClient, adminUserId, disclosureId)
upsertExperiment(adminClient, adminUserId, input)
listAdminAudit(adminClient, limit)
```

For disclosure publication, either add an `admin_publish_commercial_disclosure` wrapper RPC in migration 011 that calls publication + audit atomically, or extend the publication RPC itself to require `p_admin_user_id` and audit. Choose the wrapper so the existing service publication primitive remains reusable and locked.

- [ ] **Step 5: Write repository RPC assertions and run GREEN**

In `admin-repository.test.ts`, use a fake client and assert:
- `setFeatureFlag` calls `admin_set_feature_flag` and sends verified `adminUserId`;
- arbitrary flag key `readiness_threshold` is rejected before RPC;
- route input cannot set `minAge<18` or `requiredReadiness!='green'` because those are not input fields;
- list audit caps limit at 100.

Run:

```bash
npm test -- tests/unit/admin-auth.test.ts tests/unit/admin-repository.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

```bash
git add lib/server/admin-auth.ts lib/server/admin-repository.ts tests/unit/admin-auth.test.ts tests/unit/admin-repository.test.ts supabase/migrations/011_commercial_admin.sql
git commit -m "feat: add admin authorization and audit"
```

---

### Task 7: Build the narrow Credit Quest Admin pages and strict APIs

**Files:**
- Create: `app/admin/layout.tsx`, six admin pages, five admin API routes, five small form components + nav.
- Test: `tests/unit/admin-api.test.ts`

- [ ] **Step 1: Write failing admin API schema tests**

Create `tests/unit/admin-api.test.ts` importing exported Zod schemas. Pin:

```ts
expect(partnerSchema.safeParse({
  partnerKey: "example",
  displayName: "Example",
  enabled: true,
  sandboxEnabled: true,
  liveEnabled: false,
  notes: "Sandbox only",
}).success).toBe(true);

expect(routeSchema.safeParse({
  routeKey: "example-sandbox",
  partnerId: uuid,
  environment: "sandbox",
  destinationUrl: "/sandbox/referral-complete",
  enabled: false,
  disclosureKey: "sandbox-referral-disclosure",
  commission: 100,
}).success).toBe(false);

expect(flagSchema.safeParse({ flagKey: "readiness_threshold", enabled: true }).success).toBe(false);
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/admin-api.test.ts
```

Expected: FAIL because schemas/routes do not exist.

- [ ] **Step 3: Implement strict schemas and APIs**

Use these exact fields:

```ts
partnerSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  partnerKey: z.string().regex(/^[a-z0-9-]+$/),
  displayName: z.string().min(1).max(120),
  enabled: z.boolean(),
  sandboxEnabled: z.boolean(),
  liveEnabled: z.boolean(),
  notes: z.string().max(1000).nullable(),
}).strict();

routeSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  routeKey: z.string().regex(/^[a-z0-9-]+$/),
  partnerId: z.string().uuid(),
  environment: z.enum(["sandbox", "live"]),
  destinationUrl: z.string().min(1).max(2048),
  enabled: z.boolean(),
  disclosureKey: z.string().regex(/^[a-z0-9-]+$/),
}).strict();

flagSchema = z.object({
  flagKey: z.enum(["email_reminders_enabled", "commercial_gateway_enabled"]),
  enabled: z.boolean(),
}).strict();
```

Each admin route must call `requireAdminUser()` before reading/mutating config and use the verified user id in repository RPC calls.

For any partner or route request that tries to set a live capability true while:

```ts
process.env.LIVE_CREDIT_REFERRALS_ALLOWED !== "true"
```

return 409 with “Live credit referrals are locked pending regulatory clearance.”

- [ ] **Step 4: Implement admin layout/navigation and pages**

`app/admin/layout.tsx` must server-side require admin and render a persistent banner:

```tsx
<div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
  Live credit referrals are locked pending regulatory clearance.
</div>
```

Navigation links exactly:
- Overview
- Partners
- Routes
- Disclosures
- Flags
- Experiments
- Audit

Pages use server-side list functions and small client forms that POST/PATCH only their strict API schemas. No customer impersonation, arbitrary SQL, readiness threshold or mission priority editor.

- [ ] **Step 5: Run admin tests and commit**

```bash
npm test -- tests/unit/admin-auth.test.ts tests/unit/admin-repository.test.ts tests/unit/admin-api.test.ts
git add app/admin app/api/admin components/admin lib/server/admin-auth.ts lib/server/admin-repository.ts tests/unit/admin-api.test.ts
git commit -m "feat: add Credit Quest admin control plane"
```

Expected: PASS.

---

### Task 8: Lock commercial architecture, E2E safety and production-dark defaults

**Files:**
- Create: `tests/unit/commercial-boundaries.test.ts`
- Modify: `.env.example`
- Modify: `tests/e2e/smoke.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Add server-only live lock to environment example**

Append:

```text
LIVE_CREDIT_REFERRALS_ALLOWED=false
```

- [ ] **Step 2: Write the commercial architecture boundary test**

Create `tests/unit/commercial-boundaries.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const core = [
  "lib/domain/safety.ts",
  "lib/domain/diagnosis.ts",
  "lib/domain/passport.ts",
  "lib/domain/readiness.ts",
  "lib/domain/mission-engine.ts",
  "lib/domain/quest-score.ts",
  "lib/academy/selector.ts",
];

describe("commercial dependency direction", () => {
  it("keeps commercial/admin/revenue data out of strategy", () => {
    for (const file of core) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8").toLowerCase();
      for (const forbidden of ["@/lib/commercial", "commercial-gateway", "revenue_events", "feature_flags", "admin-repository", "commission", "epc", "payout", "campaign"]) {
        expect(source, `${file} contains ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("keeps economics out of gate and ordering implementations", () => {
    for (const file of ["lib/commercial/gates.ts", "lib/commercial/ordering.ts"]) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8").toLowerCase();
      for (const forbidden of ["commission", "epc", "payout", "revenue", "campaign"]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });
});
```

- [ ] **Step 3: Extend E2E/configured integration acceptance**

Add cases proving:
- under-18 -> no route/CTA;
- Safe Mode -> no route/CTA;
- red/amber/unknown readiness -> no route;
- `hasRevolvingCredit=null` -> no route even if a mocked guidance fixture is green;
- route disclosure can be viewed without referral consent;
- referral POST cannot succeed without `consent:true`;
- sandbox completion says no lender/application contacted;
- Quest Feed still has 7 cards;
- configured mode contains no direct `affiliateUrl` navigation.

Use unit/integration tests for configured Supabase cases that demo Playwright cannot represent without fabricating auth state.

- [ ] **Step 4: Update README with deliberate admin bootstrap and dark release rules**

Document:
- migration 011;
- `LIVE_CREDIT_REFERRALS_ALLOWED=false` hard lock;
- `commercial_gateway_enabled=false` DB switch;
- sandbox-only initial route;
- admin membership is added only by an authorised operator after identifying the exact existing `auth.users.id` and inserting it into `admin_members` using Supabase admin/SQL tooling;
- no auto-promotion/self-grant endpoint;
- live activation requires a separate FCA operating-model decision and release.

- [ ] **Step 5: Run the full V2.2C verification gate**

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
supabase db start
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f supabase/tests/rls.sql
supabase stop --no-backup
```

Expected: every command exits 0.

- [ ] **Step 6: Commit Task 8**

```bash
git add .env.example tests/unit/commercial-boundaries.test.ts tests/e2e/smoke.spec.ts README.md
git commit -m "test: verify V2.2C commercial admin boundaries"
```

## V2.2C Exit Gate

Complete only when route presentation and referral consent are correctly separated, every configured referral goes through the server Gateway, unknown evidence blocks referral independently of readiness, no configured page has an affiliate bypass, admin cannot override hard gates, sandbox provenance is auditable, user erasure is not blocked by audit controls, commercial/revenue data is absent from strategy inputs, the feed remains seven cards, and live referral remains impossible with `LIVE_CREDIT_REFERRALS_ALLOWED=false`.
