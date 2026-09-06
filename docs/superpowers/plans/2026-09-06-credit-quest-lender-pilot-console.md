# Credit Quest Lender Pilot Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal, admin-only lender pilot console that shows partner-scoped closed-loop recovery performance, pseudonymised recovery cases, cohort results and read-only pilot gate status without creating a second credit strategy or exposing sensitive customer data.

**Architecture:** Reuse existing decline/recovery/journey/action/return records and authoritative Return-to-Origin evaluation. Add one pure lender projection module, one read-only server repository, one server orchestration service and a single `/admin/lender-demo` route with four tab views. Partner scoping happens before journey-level data leaves the repository; customer IDs and recovery UUIDs exist only inside server-side orchestration and are stripped before render.

**Tech Stack:** Next.js App Router 16.3.3, React 19.1.1, TypeScript 5.9.2, Tailwind CSS 4, Supabase Auth/Postgres/RLS, Zod 3.25.76, Vitest 3.2.4, Testing Library 16.3.0, Playwright 1.54.2, Node `crypto` HMAC.

**Spec:** `docs/superpowers/specs/2026-09-06-credit-quest-lender-pilot-console-design.md`

## Global Constraints

- This tranche is internal/admin-only; do not create external lender users, organisation membership or partner-user RBAC.
- The lender selector reads `decline_partners`; do not reuse `commercial_partners` as the recovery partner source.
- Lender projections are read-only and downstream of existing Credit Quest strategy/readiness/recovery logic.
- Never import lender/partner/commercial reporting values into mission ranking, Passport, Safe Mode, readiness computation or customer recovery strategy.
- `ready_to_check` remains independent from Return-to-Origin availability.
- Reuse `getReturnOriginAvailability()` for Return-to-Origin status; do not reimplement return eligibility.
- No names, emails, phone numbers, DOB, address, raw user UUIDs, raw recovery UUIDs, balances, limits, income, vulnerability/support-needs detail, free-text decline reasons, partner economics or approval probability may enter lender-facing view models.
- All journey-level reads must be partner-scoped server-side before the records are returned to the service/UI.
- Missing reporting data is `Unavailable`, never silently converted to zero.
- Rates are unavailable when their numerator source is unavailable or their denominator is zero.
- Activation rate = activations / handoffs.
- First-action rate = journeys with a first recovery action / activations.
- Recovery rate = ready-to-check journeys / activations.
- Voluntary-return rate = voluntary returns / ready-to-check journeys.
- Pipeline includes all active partner-linked journeys plus completed partner-linked journeys whose final recovery/return activity is inside the selected window; direct recovery is excluded.
- No CRA/Open Banking connectivity is claimed or added.
- No database migration is required for this tranche.
- `partner_decline_intake_enabled=false`, `return_to_origin_enabled=false`, `commercial_sandbox_enabled=false`, `commercial_gateway_enabled=false`, `email_reminders_enabled=false`, and `LIVE_CREDIT_REFERRALS_ALLOWED=false` remain unchanged unless a separate release explicitly authorises otherwise.
- No lender-console control may mutate a live/regulated runtime gate.
- Intermediate non-visual commits use `[vercel skip]`; the first coherent lender UI and final reviewed release heads intentionally do not.

---

## File map

**Create**
- `lib/recovery/lender-projection.ts` — pure lender-facing rates, state adaptation, evidence summary, inclusion and cohort projection.
- `lib/server/lender-pilot-reference.ts` — server-only HMAC case-reference generation.
- `lib/server/lender-recovery-repository.ts` — partner-scoped read-only data access.
- `lib/server/lender-recovery-service.ts` — orchestrates repository reads, HMAC and authoritative RTO availability into sanitised view models.
- `components/admin/lender-demo/lender-demo-controls.tsx` — partner/window selector.
- `components/admin/lender-demo/lender-demo-tabs.tsx` — tab navigation retaining partner/window.
- `components/admin/lender-demo/lender-overview.tsx` — executive funnel.
- `components/admin/lender-demo/lender-pipeline.tsx` — pseudonymised case table.
- `components/admin/lender-demo/lender-cohorts.tsx` — cohort table/trend summary.
- `components/admin/lender-demo/lender-status.tsx` — read-only pilot gates/status.
- `components/admin/lender-demo/lender-demo-tracker.tsx` — best-effort presentation analytics.
- `app/admin/lender-demo/page.tsx` — admin-only single-route console.
- `tests/unit/lender-projection.test.ts`
- `tests/unit/lender-pilot-reference.test.ts`
- `tests/unit/lender-recovery-repository.test.ts`
- `tests/unit/lender-recovery-service.test.ts`
- `tests/unit/lender-demo-components.test.tsx`
- `tests/unit/lender-demo-contract.test.ts`
- `tests/e2e/helpers/admin-session.ts`
- `tests/e2e/lender-demo.spec.ts`

**Modify**
- `.env.example` — add server-only `LENDER_PILOT_REFERENCE_SECRET=`.
- `lib/server/return-origin-gateway.ts` — export the existing false live-RTO lock as a named constant without changing behaviour.
- `components/admin/admin-nav.tsx` — add Lender Demo link.
- `lib/events.ts` — add controlled lender-demo presentation events.
- `tests/unit/events.test.ts` — validate those event names.
- `README.md` — document internal pilot console and privacy/security boundaries.

---

### Task 1: Pure lender projection contract

**Files:**
- Create: `lib/recovery/lender-projection.ts`
- Create: `tests/unit/lender-projection.test.ts`

**Interfaces:**
- Consumes: existing `RecoveryExperienceState`, `EvidenceConfidence`, `JourneyLifecycleStage`, `ActionAttemptStatus` types.
- Produces:
  - `LenderDemoWindowDays = 7 | 30 | 90`
  - `LenderDemoView = "overview" | "pipeline" | "cohorts" | "status"`
  - `LenderRate`
  - `calculateLenderRate()`
  - `deriveLenderRecoveryState()`
  - `summariseLenderEvidenceConfidence()`
  - `shouldIncludeLenderPipelineJourney()`
  - `buildLenderOverviewProjection()`
  - `buildLenderCohorts()`

- [ ] **Step 1: Write RED tests for exact rates and unavailable semantics**

Create `tests/unit/lender-projection.test.ts` with fixtures that assert:

```ts
expect(calculateLenderRate(8, 10)).toEqual({
  numerator: 8,
  denominator: 10,
  percentage: 80,
});
expect(calculateLenderRate(null, 10).percentage).toBeNull();
expect(calculateLenderRate(0, 0).percentage).toBeNull();

const overview = buildLenderOverviewProjection({
  handoffs: 10,
  activations: 8,
  firstActions: 6,
  reassessments: 5,
  readyToCheck: 4,
  voluntaryReturns: 2,
  averageTimeToFirstActionHours: 12.5,
  suppressionReasons: { cooldown_active: 2 },
});
expect(overview.activationRate.percentage).toBe(80);
expect(overview.firstActionRate.percentage).toBe(75);
expect(overview.recoveryRate.percentage).toBe(50);
expect(overview.voluntaryReturnRate.percentage).toBe(50);
```

- [ ] **Step 2: Add RED tests for the five-state read-only adapter**

Use this precedence:

```ts
expect(deriveLenderRecoveryState({
  recoveryStage: "ready_to_check",
  readinessState: "ready_to_check",
  journeyStage: "waiting",
  activeMissionId: null,
  openAttempt: null,
  now,
})).toBe("ready_to_check");

expect(deriveLenderRecoveryState({
  recoveryStage: "rebuilding",
  readinessState: "getting_closer",
  journeyStage: "reassessment_due",
  activeMissionId: null,
  openAttempt: null,
  now,
})).toBe("reassessment_due");

expect(deriveLenderRecoveryState({
  recoveryStage: "rebuilding",
  readinessState: "not_ready",
  journeyStage: "active_mission",
  activeMissionId: "m1",
  openAttempt: null,
  now,
})).toBe("action_required");

expect(deriveLenderRecoveryState({
  recoveryStage: "rebuilding",
  readinessState: "getting_closer",
  journeyStage: "waiting",
  activeMissionId: null,
  openAttempt: { status: "submitted", nextReviewAt: "2026-09-20T09:00:00.000Z", verifiedAt: null },
  now,
})).toBe("waiting_for_evidence");
```

The default result is `not_ready`. This function adapts persisted authoritative state for display only; it must not call any credit strategy function.

- [ ] **Step 3: Add RED tests for evidence summary and inclusion window**

```ts
expect(summariseLenderEvidenceConfidence([
  { status: "verified", nextReviewAt: null, verifiedAt: "2026-09-05T09:00:00.000Z" },
], now)).toBe("verified");

expect(summariseLenderEvidenceConfidence([
  { status: "submitted", nextReviewAt: "2026-09-20T09:00:00.000Z", verifiedAt: null },
], now)).toBe("pending");

expect(summariseLenderEvidenceConfidence([
  { status: "self_confirmed", nextReviewAt: null, verifiedAt: null },
], now)).toBe("confirmed");

expect(shouldIncludeLenderPipelineJourney({ completedAt: null, finalActivityAt: "2026-06-01T09:00:00.000Z" }, from)).toBe(true);
expect(shouldIncludeLenderPipelineJourney({ completedAt: "2026-09-05T09:00:00.000Z", finalActivityAt: "2026-09-05T09:00:00.000Z" }, from)).toBe(true);
expect(shouldIncludeLenderPipelineJourney({ completedAt: "2026-06-01T09:00:00.000Z", finalActivityAt: "2026-06-01T09:00:00.000Z" }, from)).toBe(false);
```

- [ ] **Step 4: Add RED cohort tests**

Pin weekly/monthly bucketing to UTC and the same rate definitions. A cohort row must contain only bucket label and aggregate counts/rates; no user or journey IDs.

- [ ] **Step 5: Run the RED suite**

Run:

```bash
npm test -- tests/unit/lender-projection.test.ts
```

Expected: FAIL because `@/lib/recovery/lender-projection` does not exist.

- [ ] **Step 6: Implement the pure projection module**

Start with these exact contracts:

```ts
import type { ActionAttemptStatus } from "@/lib/domain/types";
import type { JourneyLifecycleStage } from "@/lib/journey/types";
import type {
  EvidenceConfidence,
  RecoveryExperienceState,
} from "@/lib/recovery/experience";
import type { RecoveryStage } from "@/lib/recovery/plan";
import type { RecoveryReadinessState } from "@/lib/recovery/types";

export type LenderDemoWindowDays = 7 | 30 | 90;
export type LenderDemoView = "overview" | "pipeline" | "cohorts" | "status";

export interface LenderRate {
  numerator: number | null;
  denominator: number;
  percentage: number | null;
}

export function calculateLenderRate(numerator: number | null, denominator: number): LenderRate {
  return {
    numerator,
    denominator,
    percentage: numerator === null || denominator <= 0
      ? null
      : Number(((numerator / denominator) * 100).toFixed(1)),
  };
}
```

Implement `deriveLenderRecoveryState()` with the test precedence above and `summariseLenderEvidenceConfidence()` with `verified > pending future review > confirmed > unknown`. Implement cohort and inclusion helpers as pure functions.

- [ ] **Step 7: Run GREEN tests**

```bash
npm test -- tests/unit/lender-projection.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/recovery/lender-projection.ts tests/unit/lender-projection.test.ts
git commit -m "feat: define lender recovery projection [vercel skip]"
```

---

### Task 2: Non-reversible lender case references

**Files:**
- Create: `lib/server/lender-pilot-reference.ts`
- Create: `tests/unit/lender-pilot-reference.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces `getLenderPilotReferenceSecret(env?)` and `createLenderPilotCaseReference(secret, recoveryJourneyId)`.
- The helper is server-only and is the only code allowed to transform raw recovery UUIDs into lender display references.

- [ ] **Step 1: Write RED tests**

```ts
expect(getLenderPilotReferenceSecret({ LENDER_PILOT_REFERENCE_SECRET: "short" } as NodeJS.ProcessEnv)).toBeNull();

const secret = "0123456789abcdef0123456789abcdef";
const first = createLenderPilotCaseReference(secret, "11111111-1111-1111-1111-111111111111");
const again = createLenderPilotCaseReference(secret, "11111111-1111-1111-1111-111111111111");
expect(first).toBe(again);
expect(first).toMatch(/^CQ-[A-F0-9]{10}$/);
expect(first).not.toContain("11111111");
expect(createLenderPilotCaseReference(secret, "22222222-2222-2222-2222-222222222222")).not.toBe(first);
```

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/unit/lender-pilot-reference.test.ts
```

Expected: FAIL because the server helper does not exist.

- [ ] **Step 3: Implement HMAC helper**

```ts
import "server-only";
import { createHmac } from "node:crypto";

export function getLenderPilotReferenceSecret(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const value = env.LENDER_PILOT_REFERENCE_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

export function createLenderPilotCaseReference(
  secret: string,
  recoveryJourneyId: string,
): string {
  const digest = createHmac("sha256", secret)
    .update(recoveryJourneyId)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
  return `CQ-${digest}`;
}
```

Do not use `SUPABASE_SERVICE_ROLE_KEY` as the HMAC key.

- [ ] **Step 4: Add `.env.example` entry**

Append exactly:

```text
LENDER_PILOT_REFERENCE_SECRET=
```

It must not use a `NEXT_PUBLIC_` prefix.

- [ ] **Step 5: Run GREEN**

```bash
npm test -- tests/unit/lender-pilot-reference.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .env.example lib/server/lender-pilot-reference.ts tests/unit/lender-pilot-reference.test.ts
git commit -m "feat: pseudonymise lender pilot cases [vercel skip]"
```

---

### Task 3: Partner-scoped read-only repository

**Files:**
- Create: `lib/server/lender-recovery-repository.ts`
- Create: `tests/unit/lender-recovery-repository.test.ts`

**Interfaces:**
- Consumes existing tables only: `decline_partners`, `decline_intake_sessions`, `decline_recovery_journeys`, `journey_state`, `user_missions`, `action_attempts`, `return_attempts`, `return_contracts`, `feature_flags`, `commercial_disclosures`.
- Produces:
  - `listLenderRecoveryPartners(admin)`
  - `readPartnerRecoveryAnalyticsInput(admin, partnerId, fromIso)`
  - `readPartnerPipelineSources(admin, partnerId)`
  - `readPartnerCohortSources(admin, partnerId, fromIso)`
  - `readPartnerPilotStatus(admin, partnerId)`
- No exported insert/update/upsert/delete/RPC mutation function is allowed.

- [ ] **Step 1: Write RED repository contract tests**

Use the existing lightweight Supabase query-double pattern and assert:

```ts
await readPartnerPipelineSources(admin, "partner-a");
expect(journeyQuery.eqCalls).toContainEqual(["decline_intake_sessions.partner_id", "partner-a"]);
expect(journeyQuery.eqCalls).toContainEqual(["origin", "partner"]);
```

Also inspect source text in the test and assert the lender repository contains none of:

```ts
expect(source).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
expect(source).not.toMatch(/support_needs/);
expect(source).not.toMatch(/date_of_birth|income_band|balance_minor|credit_limit_minor/);
```

- [ ] **Step 2: Add RED partner-list test**

Pin the source to `decline_partners` and the exact safe columns:

```text
id,partner_key,display_name,enabled,sandbox_enabled,live_enabled
```

Do not query `commercial_partners`.

- [ ] **Step 3: Add RED pipeline-source security test**

The initial journey query must select only internal fields required for projection:

```text
id,user_id,started_at,completed_at,updated_at,stage,readiness_snapshot,next_reassessment_at,last_reassessed_at,intake_session_id,decline_intake_sessions!inner(partner_id)
```

After this partner-scoped query, follow-up `journey_state`, active `user_missions`, `action_attempts`, and `return_attempts` reads may use only IDs obtained from the scoped result. Return-attempt reads must additionally enforce `.eq("partner_id", partnerId)`.

- [ ] **Step 4: Add RED status-source test**

Read only these feature flags:

```ts
[
  "partner_decline_intake_enabled",
  "return_to_origin_enabled",
  "commercial_gateway_enabled",
  "commercial_sandbox_enabled",
  "email_reminders_enabled",
]
```

Read safe return-contract fields only:

```text
id,environment,product_category,disclosure_key,disclosure_version,callback_policy,enabled,expires_at
```

Explicitly do not select `destination_url` or `callback_url` for lender status.

- [ ] **Step 5: Run RED**

```bash
npm test -- tests/unit/lender-recovery-repository.test.ts
```

Expected: FAIL because the repository does not exist.

- [ ] **Step 6: Implement read-only repository**

Use a first-stage partner-scoped journey read before any user-level follow-up query:

```ts
const journeys = await admin
  .from("decline_recovery_journeys")
  .select([
    "id",
    "user_id",
    "started_at",
    "completed_at",
    "updated_at",
    "stage",
    "readiness_snapshot",
    "next_reassessment_at",
    "last_reassessed_at",
    "intake_session_id",
    "decline_intake_sessions!inner(partner_id)",
  ].join(","))
  .eq("origin", "partner")
  .eq("decline_intake_sessions.partner_id", partnerId);
```

If there are no scoped journeys, return empty dependent arrays without issuing broad user-level reads. Keep raw `userId` and `journeyId` internal to server return types; they are never lender view-model fields.

For `readPartnerRecoveryAnalyticsInput`, apply `fromIso` to partner handoffs/journeys/returns and preserve the current `RecoveryAnalyticsInput` semantics so `aggregateRecoveryAnalytics()` can be reused later.

- [ ] **Step 7: Run GREEN**

```bash
npm test -- tests/unit/lender-recovery-repository.test.ts tests/unit/recovery-analytics.test.ts
```

Expected: PASS, including the pre-existing recovery analytics suite.

- [ ] **Step 8: Commit**

```bash
git add lib/server/lender-recovery-repository.ts tests/unit/lender-recovery-repository.test.ts
git commit -m "feat: read partner-scoped recovery data [vercel skip]"
```

---

### Task 4: Lender recovery orchestration service and authoritative RTO status

**Files:**
- Create: `lib/server/lender-recovery-service.ts`
- Create: `tests/unit/lender-recovery-service.test.ts`
- Modify: `lib/server/return-origin-gateway.ts`

**Interfaces:**
- Consumes Task 1 projections, Task 2 HMAC, Task 3 repository, existing `aggregateRecoveryAnalytics()`, existing `getReturnOriginAvailability()`.
- Produces sanitised partner/view projections consumed by the page/components.
- Export from RTO gateway:

```ts
export const LIVE_RETURN_TO_ORIGIN_ALLOWED = false;
```

and use that constant in `createProductionReturnOriginGateway()` instead of a second literal `false`.

- [ ] **Step 1: Write RED test proving the live-RTO constant is behaviour-neutral**

```ts
expect(LIVE_RETURN_TO_ORIGIN_ALLOWED).toBe(false);
```

Keep all existing return-origin gateway tests unchanged and passing.

- [ ] **Step 2: Write RED sanitisation tests**

Given internal source data containing `userId` and `journeyId`, the service result must serialize without either raw ID and without prohibited names:

```ts
const serialized = JSON.stringify(result);
expect(serialized).not.toContain("user-uuid-1");
expect(serialized).not.toContain("journey-uuid-1");
expect(serialized).not.toMatch(/dateOfBirth|income|balance|creditLimit|supportNeed|vulnerab|declineReason|commission|revenue|approvalProbability/i);
expect(result.pipeline?.rows[0]?.caseReference).toMatch(/^CQ-[A-F0-9]{10}$/);
```

- [ ] **Step 3: Write RED test proving RTO is single-sourced**

Inject a mocked availability function and assert it is called once per included row:

```ts
expect(getReturnAvailability).toHaveBeenCalledWith({
  userId: "user-uuid-1",
  recoveryJourneyId: "journey-uuid-1",
  now,
});
expect(result.pipeline?.rows[0]?.returnAvailability).toBe("blocked");
```

Rejected availability promises map to `unavailable`, never `available`.

- [ ] **Step 4: Write RED missing-secret test**

If `LENDER_PILOT_REFERENCE_SECRET` is absent, partner list/overview/cohorts/status may still render, but pipeline result must be:

```ts
{ available: false, reason: "reference_secret_unavailable" }
```

No raw fallback ID may be emitted.

- [ ] **Step 5: Run RED**

```bash
npm test -- tests/unit/lender-recovery-service.test.ts tests/unit/return-origin-availability.test.ts tests/unit/return-origin-gateway.test.ts
```

Expected: lender service suite fails because service/constant are missing; pre-existing RTO suites remain GREEN.

- [ ] **Step 6: Implement service**

Use an injectable constructor for deterministic tests:

```ts
export function createLenderRecoveryService(deps: {
  admin: SupabaseClient;
  getReferenceSecret(): string | null;
  getReturnAvailability(input: { userId: string; recoveryJourneyId: string; now: Date }): Promise<ReturnOriginAvailability>;
  liveCreditReferralsAllowed: boolean;
  liveReturnToOriginAllowed: boolean;
}) { /* return listPartners/getOverview/getPipeline/getCohorts/getStatus */ }
```

Production wrapper uses:

```ts
createAdminSupabaseClient();
getLenderPilotReferenceSecret();
getReturnOriginAvailability(...);
process.env.LIVE_CREDIT_REFERRALS_ALLOWED === "true";
LIVE_RETURN_TO_ORIGIN_ALLOWED;
```

For pipeline rows:
- derive five-state display from persisted recovery/journey/action facts via Task 1;
- evidence confidence is summary only, never raw customer evidence text;
- compute `finalActivityAt` as max valid timestamp of recovery `updated_at`, `completed_at`, and latest partner-scoped return attempt;
- apply Task 1 inclusion helper before RTO lookups;
- use `Promise.allSettled()` for RTO availability and fail unavailable per row;
- create HMAC reference last;
- strip raw internal IDs before returning.

- [ ] **Step 7: Run GREEN**

```bash
npm test -- \
  tests/unit/lender-recovery-service.test.ts \
  tests/unit/return-origin-availability.test.ts \
  tests/unit/return-origin-gateway.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/server/lender-recovery-service.ts lib/server/return-origin-gateway.ts tests/unit/lender-recovery-service.test.ts
git commit -m "feat: orchestrate lender recovery views [vercel skip]"
```

---

### Task 5: Executive overview shell and safe selectors

**Files:**
- Create: `app/admin/lender-demo/page.tsx`
- Create: `components/admin/lender-demo/lender-demo-controls.tsx`
- Create: `components/admin/lender-demo/lender-demo-tabs.tsx`
- Create: `components/admin/lender-demo/lender-overview.tsx`
- Create: `tests/unit/lender-demo-components.test.tsx`
- Create: `tests/unit/lender-demo-contract.test.ts`
- Modify: `components/admin/admin-nav.tsx`

**Interfaces:**
- Page consumes only the sanitised service API.
- URL contract:
  `/admin/lender-demo?partner=<decline-partner-id>&window=7|30|90&view=overview|pipeline|cohorts|status`
- If `partner` is omitted, use the first allowed decline partner returned by the service.
- If a supplied `partner` is unknown, render `Partner unavailable`; do not silently broaden/fallback to all partners.

- [ ] **Step 1: Write RED component tests for executive funnel**

Render `LenderOverview` with a known projection and assert:
- all six counts are visible;
- all four rates use provided percentages;
- `null` percentages render `Unavailable`;
- copy includes “Ready to check is not an approval decision” or equivalent non-guarantee;
- no customer-sensitive labels are present.

- [ ] **Step 2: Write RED route/source contract tests**

Inspect `app/admin/lender-demo/page.tsx` and assert it:
- calls `requireAdminUser()`;
- imports lender service, not Supabase directly;
- contains no `commercial_partners` reference;
- accepts only windows 7/30/90 and four allowed views;
- checks selected partner against the server-returned decline-partner list.

- [ ] **Step 3: Run RED**

```bash
npm test -- tests/unit/lender-demo-components.test.tsx tests/unit/lender-demo-contract.test.ts
```

Expected: FAIL because UI files do not exist.

- [ ] **Step 4: Implement overview page and controls**

Use server-side parsing:

```ts
const WINDOWS = new Set(["7", "30", "90"]);
const VIEWS = new Set(["overview", "pipeline", "cohorts", "status"]);

function parseWindow(value: string | undefined): LenderDemoWindowDays {
  return WINDOWS.has(value ?? "") ? Number(value) as LenderDemoWindowDays : 30;
}
function parseView(value: string | undefined): LenderDemoView {
  return VIEWS.has(value ?? "") ? value as LenderDemoView : "overview";
}
```

Use a GET form for partner/window so selection is URL-addressable. Tabs are normal `Link`s carrying the current partner/window. No client-side partner filtering.

Add to admin nav:

```ts
["Lender Demo", "/admin/lender-demo"],
```

- [ ] **Step 5: Run GREEN and build**

```bash
npm test -- tests/unit/lender-demo-components.test.tsx tests/unit/lender-demo-contract.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit first coherent visual checkpoint WITHOUT `[vercel skip]`**

```bash
git add app/admin/lender-demo components/admin/lender-demo components/admin/admin-nav.tsx tests/unit/lender-demo-components.test.tsx tests/unit/lender-demo-contract.test.ts
git commit -m "feat: add lender pilot overview"
```

This is the first deliberate Vercel preview checkpoint.

---

### Task 6: Pipeline, cohort and pilot-status views

**Files:**
- Create: `components/admin/lender-demo/lender-pipeline.tsx`
- Create: `components/admin/lender-demo/lender-cohorts.tsx`
- Create: `components/admin/lender-demo/lender-status.tsx`
- Modify: `app/admin/lender-demo/page.tsx`
- Modify: `tests/unit/lender-demo-components.test.tsx`
- Modify: `tests/unit/lender-demo-contract.test.ts`

**Interfaces:**
- Pipeline receives only sanitised rows with `caseReference`; no `userId`/`journeyId` props exist.
- Cohort view receives aggregate rows only.
- Status view receives read-only gate state and safe contract/disclosure metadata only.

- [ ] **Step 1: Add RED pipeline tests**

Assert a row shows:
- `CQ-...` reference;
- recovery state/stage;
- time in recovery;
- evidence summary;
- reassessment status/date if known;
- readiness;
- RTO `available|blocked|unavailable` separately.

Assert the rendered HTML does not contain fixture raw IDs or destination URLs.

- [ ] **Step 2: Add RED cohort tests**

Assert weekly/monthly cohort rows show aggregate counts/rates, and a zero denominator renders `Unavailable`.

- [ ] **Step 3: Add RED status tests**

Show explicit rows for:
- partner decline intake;
- RTO;
- commercial gateway;
- commercial sandbox;
- email reminders;
- live credit referral hard lock;
- live RTO hard lock;
- decline-partner enabled/sandbox/live config;
- return contract/disclosure status.

Assert there are no checkbox, switch, enable/disable or save controls in this view.

- [ ] **Step 4: Run RED**

```bash
npm test -- tests/unit/lender-demo-components.test.tsx tests/unit/lender-demo-contract.test.ts
```

Expected: new pipeline/cohort/status assertions fail.

- [ ] **Step 5: Implement three views and page switch**

The page selects exactly one service call for the active view so a pipeline failure does not erase a valid overview. Render independent unavailable panels per view.

For readiness/RTO copy use separate columns and include:

```text
Ready to check does not mean approved or accepted by the lender.
```

Do not expose RTO `reason` if it would reveal internal security/config detail; map raw reasons to controlled categories such as `Available`, `Blocked`, `Unavailable`.

- [ ] **Step 6: Run GREEN**

```bash
npm test -- tests/unit/lender-demo-components.test.tsx tests/unit/lender-demo-contract.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/admin/lender-demo/page.tsx components/admin/lender-demo tests/unit/lender-demo-components.test.tsx tests/unit/lender-demo-contract.test.ts
git commit -m "feat: complete lender pilot console views [vercel skip]"
```

---

### Task 7: Controlled console analytics

**Files:**
- Create: `components/admin/lender-demo/lender-demo-tracker.tsx`
- Modify: `lib/events.ts`
- Modify: `tests/unit/events.test.ts`
- Modify: `app/admin/lender-demo/page.tsx`
- Modify: `tests/unit/lender-demo-components.test.tsx`

**Interfaces:**
- New events:
  - `lender_demo_opened`
  - `lender_demo_pipeline_viewed`
  - `lender_demo_cohorts_viewed`
  - `lender_demo_status_viewed`
- Metadata only: `{ partnerId, windowDays, view, environmentMode }`.
- Do not emit case references or customer IDs.
- Existing `/api/events` authenticates the current admin user, so no admin ID is sent by browser metadata.

- [ ] **Step 1: Write RED event-schema tests**

```ts
for (const name of [
  "lender_demo_opened",
  "lender_demo_pipeline_viewed",
  "lender_demo_cohorts_viewed",
  "lender_demo_status_viewed",
]) {
  expect(eventPayloadSchema.safeParse({
    name,
    metadata: { partnerId: "p1", windowDays: 30, view: "overview", environmentMode: "internal_demo" },
  }).success).toBe(true);
}
```

- [ ] **Step 2: Write RED tracker test**

Mock `trackEvent` and assert the tracker emits only the approved metadata fields. Serialize the call and reject matches for `caseReference|userId|journeyId|balance|income|support|vulnerab|commission|revenue`.

- [ ] **Step 3: Run RED**

```bash
npm test -- tests/unit/events.test.ts tests/unit/lender-demo-components.test.tsx
```

Expected: lender event names/tracker tests fail.

- [ ] **Step 4: Implement best-effort client tracker**

Map overview to `lender_demo_opened`, and other views to their matching event. Reuse `trackEvent()`; analytics failure remains swallowed by the existing helper.

Do not add `lender_demo_partner_selected`: partner changes are represented by the metadata on the subsequent view event, avoiding duplicate telemetry.

- [ ] **Step 5: Run GREEN**

```bash
npm test -- tests/unit/events.test.ts tests/unit/lender-demo-components.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/events.ts tests/unit/events.test.ts components/admin/lender-demo/lender-demo-tracker.tsx app/admin/lender-demo/page.tsx tests/unit/lender-demo-components.test.tsx
git commit -m "feat: measure lender demo usage [vercel skip]"
```

---

### Task 8: Real admin-session E2E and pilot journey coverage

**Files:**
- Create: `tests/e2e/helpers/admin-session.ts`
- Create: `tests/e2e/lender-demo.spec.ts`
- Modify only if required: `playwright.config.ts`

**Interfaces:**
- E2E helper creates disposable Supabase auth/admin fixtures through the service role only in the test process.
- It must authenticate through the real `/auth/callback` exchange; do not add a production auth bypass.
- Cleanup removes seeded records and the temporary auth user.

- [ ] **Step 1: Build test helper for temporary admin session**

Use service-role Supabase client and a unique email. The helper flow is:

```ts
const { data: created } = await admin.auth.admin.createUser({
  email,
  email_confirm: true,
});
await admin.from("admin_members").insert({ user_id: created.user!.id, role: "admin" });

const { data: link } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email,
  options: { redirectTo: `${baseURL}/auth/callback?next=/admin/lender-demo` },
});
await page.goto(link.properties.action_link);
await expect(page).toHaveURL(/\/admin\/lender-demo/);
```

If the installed Supabase version returns a PKCE callback URL rather than a direct code in this test environment, follow the returned action link exactly; do not synthesize or bypass cookies.

- [ ] **Step 2: Seed one safe sandbox decline-partner fixture**

Create:
- one `decline_partners` row with sandbox true/live false;
- one temporary customer auth user;
- one partner `decline_intake_sessions` row;
- one linked `decline_recovery_journeys` row;
- one `journey_state` row;
- one `user_missions` row where needed for state display.

Use only dummy fixture data. Do not seed support needs, real customer data, live destinations or external URLs.

- [ ] **Step 3: Write E2E tests**

Cover:

```text
1. anonymous/non-admin request to /admin/lender-demo does not expose the console;
2. real temporary admin can open lender demo;
3. selected decline partner appears in selector;
4. overview -> pipeline -> cohorts -> status navigation retains partner/window;
5. pipeline renders CQ-* and never raw customer/recovery UUID;
6. direct-recovery fixture is absent from selected partner pipeline;
7. status shows live paths locked/read-only;
8. normal demo customer dashboard still renders seven Quest Feed cards.
```

- [ ] **Step 4: Run E2E**

```bash
npm run test:e2e -- tests/e2e/lender-demo.spec.ts tests/e2e/recovery-preservation.spec.ts tests/e2e/smoke.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/helpers/admin-session.ts tests/e2e/lender-demo.spec.ts playwright.config.ts
git commit -m "test: cover lender pilot console end to end [vercel skip]"
```

If `playwright.config.ts` was not changed, omit it from `git add`.

---

### Task 9: Documentation, architecture regression and release verification

**Files:**
- Modify: `README.md`
- Review: all Task 1–8 files

**Interfaces:**
- Final output is an exact-head lender-demo candidate ready for internal UAT.
- Merge remains a separate explicit user decision after UAT.

- [ ] **Step 1: Update README**

Document:
- `/admin/lender-demo` is internal/admin-only;
- selector uses decline partners, not commercial/affiliate partners;
- partner scoping is server-side;
- case references are HMAC pseudonyms requiring `LENDER_PILOT_REFERENCE_SECRET`;
- lender projection is downstream/read-only;
- readiness and RTO are separate;
- no sensitive fields are exposed;
- no external lender login exists yet;
- live/commercial/email gates remain dark and lender status is read-only.

- [ ] **Step 2: Run focused suites**

```bash
npm test -- \
  tests/unit/lender-projection.test.ts \
  tests/unit/lender-pilot-reference.test.ts \
  tests/unit/lender-recovery-repository.test.ts \
  tests/unit/lender-recovery-service.test.ts \
  tests/unit/lender-demo-components.test.tsx \
  tests/unit/lender-demo-contract.test.ts \
  tests/unit/events.test.ts \
  tests/unit/recovery-analytics.test.ts \
  tests/unit/return-origin-availability.test.ts \
  tests/unit/return-origin-gateway.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full verification**

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npm run test:e2e
npm run build
```

Run the same Supabase verification as CI:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f supabase/tests/rls.sql \
  -f supabase/tests/retention_rls.sql \
  -f supabase/tests/commercial_rls.sql \
  -f supabase/tests/recovery_rls.sql \
  -f supabase/tests/recovery_atomic.sql \
  -f supabase/tests/recovery_privileges.sql
```

No new migration means the existing security suite must remain unchanged/green.

- [ ] **Step 4: Architecture regression review**

Fail the tranche if the final diff:
- imports lender/partner/commercial reporting into mission, Passport, safety, readiness or core recovery strategy;
- queries `commercial_partners` for lender recovery selection;
- creates a new readiness/creditworthiness calculation;
- reimplements RTO eligibility instead of calling the existing availability gateway;
- sends mixed-partner journey data to the browser;
- exposes raw customer/recovery IDs or prohibited sensitive fields;
- exposes return destination/callback URLs;
- shows `ready_to_check` as approval/acceptance probability;
- changes the customer seven-card Quest Feed;
- creates external lender auth/RBAC;
- adds a lender-console mutation path for live/regulated gates;
- changes any dark production flag/hard-lock default;
- converts missing data to zero;
- claims CRA/Open Banking connectivity.

- [ ] **Step 5: Run secret/privacy source scan**

```bash
rg -n "LENDER_PILOT_REFERENCE_SECRET|SUPABASE_SERVICE_ROLE_KEY|destination_url|callback_url|support_needs|date_of_birth|income_band|balance_minor|credit_limit_minor" \
  app/admin/lender-demo components/admin/lender-demo lib/recovery/lender-projection.ts lib/server/lender-* tests/unit/lender-* README.md .env.example
```

Expected:
- secret names only in server env/helper/docs/tests; never a secret value;
- no service-role key used for case reference;
- no prohibited database columns in lender UI/view-model files;
- destination/callback URL fields absent from lender status projection.

- [ ] **Step 6: Final reviewed commit WITHOUT `[vercel skip]`**

```bash
git add README.md
git commit -m "docs: document lender pilot console release"
```

This intentionally triggers the final exact-head Vercel preview. If README was already included in a prior non-skipped checkpoint, create no empty commit; instead ensure the last substantive reviewed commit is intentionally deployable.

- [ ] **Step 7: Verify exact head in GitHub/Vercel**

Require:
- dependency audit GREEN;
- lint GREEN;
- full unit/integration GREEN;
- Supabase/RLS/security GREEN;
- full Playwright GREEN;
- production build GREEN;
- Vercel preview success for the exact head.

- [ ] **Step 8: Internal UAT**

Operator UAT script:

```text
1. Open Lender Demo as admin.
2. Select a sandbox decline partner and 30-day window.
3. Confirm funnel counts/rates and unavailable semantics look credible.
4. Open Pipeline and confirm every customer row is CQ-* only.
5. Confirm readiness and Return-to-Origin are visibly separate.
6. Open Cohorts and verify no individual drill-through/sensitive segmentation.
7. Open Status and verify all controls are read-only and live paths remain locked.
8. Re-open normal customer dashboard and verify core Credit Quest experience is unchanged.
```

Do not merge until the user explicitly passes UAT and separately authorises merge.
