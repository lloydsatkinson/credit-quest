# Credit Quest V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working Credit Quest V1 as a mobile-first Next.js PWA with Supabase auth/data, progressive onboarding, deterministic mission ranking, an explainable Credit Quest Score, age-gated referrals, and a clean affiliate/offers layer.

**Architecture:** Use a Next.js App Router frontend with server-safe Supabase clients and a small domain layer for pure mission/scoring logic. Persist user-owned data in Supabase Postgres with Row Level Security, while keeping public mission and offer catalogues separate. The mission engine must select the user's next-best mission before any affiliate logic runs.

**Tech Stack:** Next.js, TypeScript, React, Tailwind CSS, Supabase Auth/Postgres/RLS, Zod, Vitest, Testing Library, Playwright, PWA manifest/service-worker support.

**Spec:** `docs/superpowers/specs/2026-08-25-credit-quest-v1-design.md`

## Global Constraints

- Mobile-first installable PWA.
- Users aged 16–17 use education mode only; no credit-product referrals.
- Users aged 18+ may receive relevant referrals where otherwise appropriate.
- Credit Quest Score is an internal progress score, never a bureau score or lender-approval prediction.
- Mission ranking is deterministic, explainable, and independent of affiliate payout or conversion value.
- Progressive onboarding must reach a useful first mission quickly.
- V1 uses manual data entry but keeps extension points for future Open Banking, CRA, and AI integrations.
- Affiliate/referral relationships must be disclosed clearly.
- Do not store unnecessary identity or financial data.
- Secrets remain server-side.

---

## File Structure

Create the following focused structure:

```text
app/
  (auth)/login/page.tsx
  onboarding/page.tsx
  dashboard/page.tsx
  offers/page.tsx
  api/events/route.ts
  layout.tsx
  page.tsx
components/
  dashboard/next-mission-card.tsx
  dashboard/progress-strip.tsx
  onboarding/onboarding-form.tsx
  offers/offer-card.tsx
lib/
  domain/types.ts
  domain/age-gate.ts
  domain/quest-score.ts
  domain/mission-engine.ts
  domain/offer-matcher.ts
  data/missions.ts
  data/offers.ts
  supabase/client.ts
  supabase/server.ts
  supabase/middleware.ts
  events.ts
supabase/
  migrations/001_initial_schema.sql
  seed.sql
  tests/rls.sql
tests/
  unit/age-gate.test.ts
  unit/quest-score.test.ts
  unit/mission-engine.test.ts
  unit/offer-matcher.test.ts
  integration/onboarding-flow.test.ts
  e2e/smoke.spec.ts
public/
  manifest.webmanifest
  icons/icon-192.png
  icons/icon-512.png
middleware.ts
vitest.config.ts
playwright.config.ts
.env.example
README.md
```

## Task 1: Scaffold the Next.js PWA foundation

**Files:**
- Create/modify: `package.json`, `app/layout.tsx`, `app/page.tsx`, `public/manifest.webmanifest`, `middleware.ts`, `.env.example`, `vitest.config.ts`, `playwright.config.ts`, `README.md`

**Interfaces:**
- Produces a bootable Next.js TypeScript app with scripts: `dev`, `build`, `lint`, `test`, `test:watch`, `test:e2e`.
- Establishes environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 1: Scaffold the app**

Run:

```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir=false --import-alias='@/*'
npm install @supabase/ssr @supabase/supabase-js zod
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test
```

Expected: Next.js app boots with `npm run dev`.

- [ ] **Step 2: Add test scripts**

Set scripts in `package.json`:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test"
}
```

- [ ] **Step 3: Add the PWA manifest**

Create `public/manifest.webmanifest`:

```json
{
  "name": "Credit Quest",
  "short_name": "Credit Quest",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#111827",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 4: Wire metadata in `app/layout.tsx`**

Use:

```ts
export const metadata = {
  title: "Credit Quest",
  description: "Your next best move for better credit habits.",
  manifest: "/manifest.webmanifest",
};
```

- [ ] **Step 5: Verify**

Run:

```bash
npm run lint
npm run build
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: scaffold Credit Quest web app"
```

## Task 2: Define the core domain model and age gate

**Files:**
- Create: `lib/domain/types.ts`, `lib/domain/age-gate.ts`
- Test: `tests/unit/age-gate.test.ts`

**Interfaces:**
- Produces `AgeMode = "education" | "adult"`.
- Produces `getAgeMode(dateOfBirth: string, now?: Date): AgeMode`.
- Produces shared types used by later tasks.

- [ ] **Step 1: Write failing age-gate tests**

Create `tests/unit/age-gate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getAgeMode } from "@/lib/domain/age-gate";

describe("getAgeMode", () => {
  const now = new Date("2026-08-25T12:00:00Z");

  it("returns education for a 17 year old", () => {
    expect(getAgeMode("2009-08-26", now)).toBe("education");
  });

  it("returns adult on the user's 18th birthday", () => {
    expect(getAgeMode("2008-08-25", now)).toBe("adult");
  });
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npm test -- tests/unit/age-gate.test.ts
```

Expected: FAIL because module/function does not exist.

- [ ] **Step 3: Define domain types**

Create `lib/domain/types.ts` with these exact exported types:

```ts
export type JourneyStage = "setup" | "stabilise" | "build" | "optimise" | "maintain";
export type ImpactLevel = "low" | "medium" | "high";
export type AgeMode = "education" | "adult";
export type MissionState = "not_started" | "started" | "completed" | "dismissed" | "deferred";

export interface CreditProfile {
  userId: string;
  dateOfBirth: string;
  employmentStatus: "employed" | "self_employed" | "student" | "unemployed" | "other";
  incomeBand: "under_15k" | "15_30k" | "30_50k" | "50k_plus";
  housingStatus: "owner" | "mortgage" | "rent" | "family" | "other";
  electoralRoll: boolean;
  utilisationPct: number | null;
  missedPaymentsLast12m: number;
  hardApplicationsLast6m: number;
  hasRevolvingCredit: boolean;
  hasDirectDebitForCredit: boolean;
}

export interface MissionDefinition {
  id: string;
  slug: string;
  title: string;
  description: string;
  rationale: string;
  stage: JourneyStage;
  impact: ImpactLevel;
  questScoreDelta: number;
  priorityWeight: number;
  referralCategory?: "credit_builder_card";
  isEligible(profile: CreditProfile, now: Date): boolean;
}

export interface RankedMission {
  mission: MissionDefinition;
  priorityScore: number;
  reasons: string[];
}

export interface OfferDefinition {
  id: string;
  provider: string;
  productName: string;
  category: "credit_builder_card";
  affiliateUrl: string;
  disclosure: string;
  minAge: number;
  active: boolean;
  commissionPence?: number;
}
```

- [ ] **Step 4: Implement `getAgeMode`**

Use exact signature:

```ts
export function getAgeMode(dateOfBirth: string, now = new Date()): AgeMode
```

Compute age by calendar date, not by dividing milliseconds.

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/unit/age-gate.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/domain tests/unit/age-gate.test.ts
git commit -m "feat: add credit profile types and age gating"
```

## Task 3: Implement the explainable Credit Quest Score

**Files:**
- Create: `lib/domain/quest-score.ts`
- Test: `tests/unit/quest-score.test.ts`

**Interfaces:**
- Produces `calculateQuestScore(profile: CreditProfile): { score: number; factors: string[] }`.
- Score must be clamped to `0..100`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { calculateQuestScore } from "@/lib/domain/quest-score";
import type { CreditProfile } from "@/lib/domain/types";

const base: CreditProfile = {
  userId: "u1",
  dateOfBirth: "1990-01-01",
  employmentStatus: "employed",
  incomeBand: "30_50k",
  housingStatus: "rent",
  electoralRoll: false,
  utilisationPct: 70,
  missedPaymentsLast12m: 1,
  hardApplicationsLast6m: 3,
  hasRevolvingCredit: true,
  hasDirectDebitForCredit: false,
};

describe("calculateQuestScore", () => {
  it("returns a bounded score and explainable factors", () => {
    const result = calculateQuestScore(base);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.factors.length).toBeGreaterThan(0);
  });

  it("improves when utilisation falls", () => {
    const high = calculateQuestScore(base).score;
    const low = calculateQuestScore({ ...base, utilisationPct: 20 }).score;
    expect(low).toBeGreaterThan(high);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npm test -- tests/unit/quest-score.test.ts
```

- [ ] **Step 3: Implement deterministic scoring**

Use base score `50`, then apply these V1 rules:

```text
+10 electoral roll true
+10 utilisation <= 30
+5 utilisation >30 and <=50
-10 utilisation >75
-15 each missed payment in last 12m, capped at -30
-5 each hard application above 1 in last 6m, capped at -15
+5 revolving credit exists
+5 direct debit exists for credit
```

Return user-facing factor strings for every applied adjustment.

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/unit/quest-score.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/quest-score.ts tests/unit/quest-score.test.ts
git commit -m "feat: add explainable Credit Quest score"
```

## Task 4: Implement mission catalogue and deterministic ranking

**Files:**
- Create: `lib/data/missions.ts`, `lib/domain/mission-engine.ts`
- Test: `tests/unit/mission-engine.test.ts`

**Interfaces:**
- Produces `MISSION_CATALOGUE: MissionDefinition[]`.
- Produces `rankMissions(profile: CreditProfile, now?: Date): RankedMission[]`.
- Produces `getNextBestMission(profile: CreditProfile, now?: Date): RankedMission | null`.

- [ ] **Step 1: Write failing ranking tests**

Cover these cases:

```ts
it("prioritises electoral roll when not registered", ...)
it("prioritises utilisation reduction when utilisation is high", ...)
it("returns application cooldown when recent hard applications are excessive", ...)
it("never changes rank because of affiliate economics", ...)
```

Use a profile fixture and assert the expected first mission slug.

- [ ] **Step 2: Run tests and confirm failure**

```bash
npm test -- tests/unit/mission-engine.test.ts
```

- [ ] **Step 3: Add initial mission catalogue**

Create missions with these exact slugs:

```text
register-electoral-roll
reduce-utilisation
set-up-direct-debit
application-cooldown
build-revolving-history
```

Suggested priorities:

```text
register-electoral-roll: 90
reduce-utilisation: 100 when utilisation > 50, else 70 when > 30
set-up-direct-debit: 65
application-cooldown: 95 when hardApplicationsLast6m >= 3
build-revolving-history: 55 when no revolving credit
```

`build-revolving-history` may expose `referralCategory: "credit_builder_card"` but the ranking calculation must ignore that field.

- [ ] **Step 4: Implement ranking**

`rankMissions` must:

1. filter by `isEligible`
2. calculate priority from mission rules only
3. sort descending by score, then slug ascending for deterministic ties
4. attach concise reasons

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/unit/mission-engine.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/data/missions.ts lib/domain/mission-engine.ts tests/unit/mission-engine.test.ts
git commit -m "feat: add deterministic mission engine"
```

## Task 5: Implement age-gated offer matching

**Files:**
- Create: `lib/data/offers.ts`, `lib/domain/offer-matcher.ts`
- Test: `tests/unit/offer-matcher.test.ts`

**Interfaces:**
- Produces `OFFER_CATALOGUE: OfferDefinition[]`.
- Produces `getOffersForMission(profile: CreditProfile, mission: MissionDefinition, now?: Date): OfferDefinition[]`.

- [ ] **Step 1: Write failing tests**

Required tests:

```ts
it("returns no credit offers for a 17 year old", ...)
it("returns active matching offers for an adult", ...)
it("returns no offers when mission has no referral category", ...)
it("does not use commissionPence to change mission ranking", ...)
```

- [ ] **Step 2: Run and confirm failure**

```bash
npm test -- tests/unit/offer-matcher.test.ts
```

- [ ] **Step 3: Create seeded offer catalogue**

Use clearly fictional/demo providers only in source control, for example:

```ts
{
  id: "demo-credit-builder-1",
  provider: "Example Card Co",
  productName: "Example Credit Builder Card",
  category: "credit_builder_card",
  affiliateUrl: "https://example.com/credit-builder?src=creditquest",
  disclosure: "Partner link — Credit Quest may earn a commission.",
  minAge: 18,
  active: true,
  commissionPence: 2500,
}
```

- [ ] **Step 4: Implement matching**

Rules:

```text
age mode must be adult
mission.referralCategory must exist
offer.active must be true
offer.category must equal mission.referralCategory
```

Never inspect `commissionPence` for suitability or ordering.

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/unit/offer-matcher.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/data/offers.ts lib/domain/offer-matcher.ts tests/unit/offer-matcher.test.ts
git commit -m "feat: add age-gated affiliate offer matching"
```

## Task 6: Add Supabase schema, RLS, and clients

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`, `supabase/tests/rls.sql`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `middleware.ts`

**Interfaces:**
- Produces tables: `profiles`, `user_missions`, `events`.
- Public catalogue can remain source-controlled in V1; only user-owned state needs persistence initially.

- [ ] **Step 1: Write schema migration**

Create tables with UUID user IDs referencing `auth.users(id)`:

```sql
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
  updated_at timestamptz not null default now()
);

create table public.user_missions (
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_slug text not null,
  state text not null default 'not_started',
  first_shown_at timestamptz,
  last_shown_at timestamptz,
  completed_at timestamptz,
  next_review_at timestamptz,
  primary key (user_id, mission_slug)
);

create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: Enable RLS and policies**

For `profiles` and `user_missions`, allow users to select/insert/update only rows where `auth.uid() = user_id`.

For `events`, allow authenticated users to insert rows only when `auth.uid() = user_id`; allow no client-side reads.

- [ ] **Step 3: Add RLS verification SQL**

`supabase/tests/rls.sql` must include assertions or manual transaction blocks proving user A cannot read/update user B's profile or mission rows.

- [ ] **Step 4: Add Supabase clients**

Create:

```ts
export function createBrowserSupabaseClient()
export async function createServerSupabaseClient()
```

Use `@supabase/ssr` and cookie integration appropriate for Next.js App Router.

- [ ] **Step 5: Add auth-refresh middleware**

Use `middleware.ts` to refresh auth sessions and protect `/dashboard`, `/onboarding`, and `/offers`.

- [ ] **Step 6: Verify database locally**

Run:

```bash
npx supabase start
npx supabase db reset
```

Expected: migration succeeds and RLS checks pass.

- [ ] **Step 7: Commit**

```bash
git add supabase lib/supabase middleware.ts
git commit -m "feat: add Supabase schema and row level security"
```

## Task 7: Build auth and progressive onboarding

**Files:**
- Create: `app/(auth)/login/page.tsx`, `app/onboarding/page.tsx`, `components/onboarding/onboarding-form.tsx`
- Test: `tests/integration/onboarding-flow.test.ts`

**Interfaces:**
- On successful onboarding, persists a complete `CreditProfile`-compatible record and redirects to `/dashboard`.

- [ ] **Step 1: Write integration test**

Test the pure onboarding transformation first:

```ts
it("maps onboarding answers into a valid CreditProfile", ...)
it("rejects under-16 date of birth", ...)
it("accepts 16-17 in education mode", ...)
```

Extract transformation into a testable helper if needed, e.g. `normaliseOnboardingAnswers`.

- [ ] **Step 2: Run and confirm failure**

```bash
npm test -- tests/integration/onboarding-flow.test.ts
```

- [ ] **Step 3: Build login page**

Support email magic-link or OTP using Supabase Auth. Keep UI copy simple:

```text
Build better credit habits, one move at a time.
```

- [ ] **Step 4: Build progressive onboarding form**

Use 6–8 short steps covering:

```text
date of birth
employment status
income band
housing status
electoral roll
revolving credit + utilisation
missed payments
recent hard applications + direct debit
```

Persist only at completion for V1.

- [ ] **Step 5: Enforce age rules server-side**

Reject under-16 users. Persist 16–17 users normally, but rely on domain age gate to suppress referrals later.

- [ ] **Step 6: Run tests and lint**

```bash
npm test -- tests/integration/onboarding-flow.test.ts
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app components tests/integration
git commit -m "feat: add auth and progressive onboarding"
```

## Task 8: Build the action-first dashboard

**Files:**
- Create: `app/dashboard/page.tsx`, `components/dashboard/next-mission-card.tsx`, `components/dashboard/progress-strip.tsx`

**Interfaces:**
- Dashboard reads persisted profile, calls `calculateQuestScore` and `getNextBestMission`, then conditionally calls `getOffersForMission`.

- [ ] **Step 1: Add component tests**

Test that `NextMissionCard` renders:

```text
mission title
what to do
why it matters
impact label
estimated Quest Score movement
review timing when present
partner disclosure when offer exists
```

- [ ] **Step 2: Run and confirm failure**

```bash
npm test -- tests/unit/dashboard-components.test.tsx
```

- [ ] **Step 3: Implement dashboard data flow**

Use this strict order:

```ts
const score = calculateQuestScore(profile);
const rankedMission = getNextBestMission(profile);
const offers = rankedMission
  ? getOffersForMission(profile, rankedMission.mission)
  : [];
```

Do not pass offers into the mission engine.

- [ ] **Step 4: Implement action-first layout**

Top content order:

```text
1. "Your next best move"
2. mission card
3. compact progress strip
4. brief journey stage indicator
5. secondary education copy
```

- [ ] **Step 5: Add fallback behaviour**

If mission calculation fails or returns `null`, show:

```text
You're up to date for now.
Review your profile or check back after your next review date.
```

- [ ] **Step 6: Run tests/build**

```bash
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/dashboard components/dashboard tests/unit/dashboard-components.test.tsx
git commit -m "feat: add action-first Credit Quest dashboard"
```

## Task 9: Add offers marketplace and event tracking

**Files:**
- Create: `app/offers/page.tsx`, `components/offers/offer-card.tsx`, `lib/events.ts`, `app/api/events/route.ts`

**Interfaces:**
- Produces `trackEvent(name: string, metadata?: Record<string, unknown>): Promise<void>`.
- Offers page must return no credit-product cards for education-mode users.

- [ ] **Step 1: Add tests for event payload validation and age-gated offers page logic**

Use Zod to permit only these event names:

```text
onboarding_started
onboarding_completed
mission_shown
mission_started
mission_completed
mission_deferred
mission_dismissed
offer_shown
offer_clicked
referral_outcome
```

- [ ] **Step 2: Run and confirm failure**

```bash
npm test -- tests/unit/events.test.ts tests/unit/offers-page.test.ts
```

- [ ] **Step 3: Implement event API**

Server route must derive `user_id` from the authenticated session rather than trusting a client-provided user ID.

- [ ] **Step 4: Build marketplace**

Adults see active offers with:

```text
provider
product name
broad suitability note
partner disclosure
"Check eligibility with provider" CTA
```

Education-mode users see an educational explanation and no product links.

- [ ] **Step 5: Add click tracking**

Record `offer_clicked` before redirecting to the affiliate URL.

- [ ] **Step 6: Run tests/build**

```bash
npm test
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add app/offers app/api/events components/offers lib/events.ts tests/unit
git commit -m "feat: add offers marketplace and analytics events"
```

## Task 10: Add end-to-end smoke coverage and polish the PWA

**Files:**
- Create/modify: `tests/e2e/smoke.spec.ts`, `README.md`, PWA icons/assets as needed

**Interfaces:**
- Produces a verified happy path from sign-in stub/test account through onboarding to dashboard and age-appropriate referrals.

- [ ] **Step 1: Write failing Playwright smoke test**

Cover:

```text
sign in
complete onboarding
land on dashboard
see next-best mission
see explanation and Quest Score
complete/start mission interaction
see updated progress
confirm no referral for 17-year-old fixture
confirm relevant referral for adult fixture
```

- [ ] **Step 2: Run and confirm failure**

```bash
npm run test:e2e
```

- [ ] **Step 3: Fix only the missing behaviour required by the smoke test**

Keep changes minimal and aligned with the spec.

- [ ] **Step 4: Verify PWA installability**

Run production build and inspect manifest in browser dev tools:

```bash
npm run build
npm start
```

Expected: valid manifest, icons load, app works at mobile viewport.

- [ ] **Step 5: Update README**

Document:

```text
product purpose
local setup
required environment variables
Supabase local setup
how to run unit/integration/e2e tests
V1 compliance boundaries
affiliate demo-data warning
future integration extension points
```

- [ ] **Step 6: Run full verification suite**

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "test: complete Credit Quest V1 smoke coverage"
```

## Task 11: Final security and product-boundary verification

**Files:**
- Review all touched files; modify only if verification exposes gaps.

**Interfaces:**
- Produces release-candidate V1 behaviour aligned with the approved design.

- [ ] **Step 1: Verify affiliate separation**

Search code and confirm `commissionPence` is never imported by `mission-engine.ts` or used in mission priority calculations.

Run:

```bash
grep -R "commissionPence" lib app tests
```

Expected: references only in offer data/matching/tests/analytics contexts.

- [ ] **Step 2: Verify age-gating cannot be bypassed in UI only**

Confirm `getAgeMode` is called in domain/server logic before offers are returned.

- [ ] **Step 3: Verify user-facing copy**

Search for prohibited implications:

```bash
grep -R -i "guarantee\|approval odds\|experian score\|equifax score\|transunion score" app components lib
```

Expected: no misleading claims.

- [ ] **Step 4: Re-run RLS checks and full test suite**

```bash
npx supabase db reset
npm run lint
npm test
npm run test:e2e
npm run build
```

Expected: all pass.

- [ ] **Step 5: Commit any final fixes**

```bash
git add .
git commit -m "chore: verify Credit Quest V1 release boundaries"
```

## Completion Criteria

Implementation is complete only when all of the following are true:

- A user can sign in and complete progressive onboarding.
- Under-16 onboarding is rejected.
- 16–17 users receive education-mode guidance with zero credit-product referrals.
- 18+ users can receive mission-linked and marketplace offers where relevant.
- Dashboard always selects the mission before offers are considered.
- Credit Quest Score is bounded, explainable, and clearly distinct from bureau scores.
- Mission ranking is deterministic and tested.
- Affiliate commission cannot influence mission ranking and a test proves this.
- Supabase RLS isolates user-owned data.
- The app is mobile-friendly and installable as a PWA.
- `npm run lint`, `npm test`, `npm run test:e2e`, and `npm run build` all pass.
