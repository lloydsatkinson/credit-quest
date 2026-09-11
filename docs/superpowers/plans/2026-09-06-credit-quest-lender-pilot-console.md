# Credit Quest Lender Pilot Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal, admin-only lender pilot console showing partner-scoped closed-loop recovery performance, pseudonymised case progress, cohorts and read-only pilot status without creating a second credit strategy or exposing sensitive customer information.

**Architecture:** Reuse existing decline/recovery/journey/action/return records and the authoritative Return-to-Origin gateway. Add a pure lender projection module, a read-only partner-scoped repository, a server orchestration service and one `/admin/lender-demo` route with four tab views. Raw customer/recovery IDs stay server-side and are stripped before render.

**Tech Stack:** Next.js App Router 16.3.3, React 19.1.1, TypeScript 5.9.2, Tailwind CSS 4, Supabase Auth/Postgres/RLS, Zod 3.25.76, Vitest 3.2.4, Testing Library 16.3.0, Playwright 1.54.2, Node `crypto` HMAC.

**Spec:** `docs/superpowers/specs/2026-09-06-credit-quest-lender-pilot-console-design.md`

## Global Constraints

- Internal/admin-only. Do not create external lender users, organisation membership or partner-user RBAC.
- The lender selector reads `decline_partners`; never use `commercial_partners` as the recovery partner source.
- Lender reporting is downstream/read-only. It must not influence mission ranking, Passport, Safe Mode, readiness or recovery strategy.
- `ready_to_check` is independent of Return-to-Origin availability.
- Reuse `getReturnOriginAvailability()`; do not duplicate return eligibility logic.
- No names, emails, phones, DOB, addresses, raw user/recovery UUIDs, balances, limits, income, vulnerability/support-needs detail, free-text decline reasons, partner economics or approval probability in lender view models.
- Journey-level records must be scoped to one allowed partner in the server repository before follow-up reads or browser rendering.
- Missing reporting data is `Unavailable`, never zero by substitution.
- Exact rates: activation = activations/handoffs; first action = first-actions/activations; recovery = ready-to-check/activations; voluntary return = voluntary-returns/ready-to-check. A missing numerator source or zero denominator means `Unavailable`.
- Pipeline includes every active selected-partner journey plus completed selected-partner journeys whose final recovery/return activity is inside the chosen window. Direct recovery is excluded.
- No CRA/Open Banking claims or adapters in this tranche.
- No database migration is required.
- Existing dark defaults and hard locks stay unchanged: `partner_decline_intake_enabled=false`, `return_to_origin_enabled=false`, `commercial_sandbox_enabled=false`, `commercial_gateway_enabled=false`, `email_reminders_enabled=false`, `LIVE_CREDIT_REFERRALS_ALLOWED=false`, live RTO hard-lock false.
- The lender console has no runtime mutation controls.
- Intermediate non-visual commits use `[vercel skip]`; coherent visual and final review checkpoints intentionally deploy.

## File Map

**Create**
- `lib/recovery/lender-projection.ts`
- `lib/server/lender-pilot-reference.ts`
- `lib/server/lender-recovery-repository.ts`
- `lib/server/lender-recovery-service.ts`
- `app/admin/lender-demo/page.tsx`
- `components/admin/lender-demo/lender-demo-controls.tsx`
- `components/admin/lender-demo/lender-demo-tabs.tsx`
- `components/admin/lender-demo/lender-overview.tsx`
- `components/admin/lender-demo/lender-pipeline.tsx`
- `components/admin/lender-demo/lender-cohorts.tsx`
- `components/admin/lender-demo/lender-status.tsx`
- `components/admin/lender-demo/lender-demo-tracker.tsx`
- `tests/unit/lender-projection.test.ts`
- `tests/unit/lender-pilot-reference.test.ts`
- `tests/unit/lender-recovery-repository.test.ts`
- `tests/unit/lender-recovery-service.test.ts`
- `tests/unit/lender-demo-components.test.tsx`
- `tests/unit/lender-demo-contract.test.ts`
- `tests/e2e/helpers/admin-session.ts`
- `tests/e2e/lender-demo.spec.ts`

**Modify**
- `.env.example`
- `playwright.config.ts`
- `lib/server/return-origin-gateway.ts`
- `components/admin/admin-nav.tsx`
- `lib/events.ts`
- `tests/unit/events.test.ts`
- `README.md`

---

### Task 1 — Pure lender projection contract

**Files:** Create `lib/recovery/lender-projection.ts`, `tests/unit/lender-projection.test.ts`.

**Interfaces:**

```ts
export type LenderDemoWindowDays = 7 | 30 | 90;
export type LenderDemoView = "overview" | "pipeline" | "cohorts" | "status";
export interface LenderRate {
  numerator: number | null;
  denominator: number;
  percentage: number | null;
}
export function calculateLenderRate(numerator: number | null, denominator: number): LenderRate;
export function deriveLenderRecoveryState(input: LenderRecoveryStateInput): RecoveryExperienceState;
export function summariseLenderEvidenceConfidence(input: LenderEvidenceAttempt[], now: Date): EvidenceConfidence;
export function shouldIncludeLenderPipelineJourney(input: { completedAt: string | null; finalActivityAt: string | null }, from: Date): boolean;
export function buildLenderOverviewProjection(input: LenderOverviewSource): LenderOverviewProjection;
export function buildLenderCohorts(input: LenderCohortSource[], bucket: "week" | "month"): LenderCohortProjection[];
```

- [ ] **1.1 RED — rates and unavailable semantics.** Tests must prove `8/10=80`, `null/10=Unavailable`, `0/0=Unavailable`, and the four approved overview denominators.

```ts
expect(calculateLenderRate(8, 10)).toEqual({ numerator: 8, denominator: 10, percentage: 80 });
expect(calculateLenderRate(null, 10).percentage).toBeNull();
expect(calculateLenderRate(0, 0).percentage).toBeNull();
```

- [ ] **1.2 RED — five-state display adapter.** Precedence is: persisted recovery/readiness ready => `ready_to_check`; Journey `reassessment_due`; Journey `active_mission` with active mission => `action_required`; Journey waiting/cooldown or future unverified action review => `waiting_for_evidence`; otherwise `not_ready`.

- [ ] **1.3 RED — evidence summary.** `verified` outranks `pending`; an unverified future review is `pending`; returned/submitted/self-confirmed without future review is `confirmed`; otherwise `unknown`.

- [ ] **1.4 RED — pipeline inclusion and cohorts.** Active always included; completed only if `finalActivityAt >= from`; UTC week/month cohort rows contain aggregate values only, never user/journey IDs.

- [ ] **1.5 Run RED:**

```bash
npm test -- tests/unit/lender-projection.test.ts
```

Expected: missing-module failure only.

- [ ] **1.6 Implement pure module.** `calculateLenderRate` must use:

```ts
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

Import existing `RecoveryExperienceState`/`EvidenceConfidence`, `JourneyLifecycleStage`, `ActionAttemptStatus`, `RecoveryStage`, `RecoveryReadinessState`; do not call credit strategy functions.

- [ ] **1.7 GREEN:** `npm test -- tests/unit/lender-projection.test.ts`.

- [ ] **1.8 Commit:**

```bash
git add lib/recovery/lender-projection.ts tests/unit/lender-projection.test.ts
git commit -m "feat: define lender recovery projection [vercel skip]"
```

---

### Task 2 — Non-reversible case references

**Files:** Create `lib/server/lender-pilot-reference.ts`, `tests/unit/lender-pilot-reference.test.ts`; modify `.env.example`.

**Interfaces:**

```ts
export function getLenderPilotReferenceSecret(env?: NodeJS.ProcessEnv): string | null;
export function createLenderPilotCaseReference(secret: string, recoveryJourneyId: string): string;
```

- [ ] **2.1 RED.** Prove a secret shorter than 32 chars fails closed, same journey+secret gives stable result, different journey differs, output matches `^CQ-[A-F0-9]{10}$`, and no UUID substring appears.

- [ ] **2.2 Run RED:** `npm test -- tests/unit/lender-pilot-reference.test.ts`; expected missing-module failure.

- [ ] **2.3 Implement:**

```ts
import "server-only";
import { createHmac } from "node:crypto";

export function getLenderPilotReferenceSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.LENDER_PILOT_REFERENCE_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

export function createLenderPilotCaseReference(secret: string, recoveryJourneyId: string): string {
  const digest = createHmac("sha256", secret)
    .update(recoveryJourneyId)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
  return `CQ-${digest}`;
}
```

Never reuse `SUPABASE_SERVICE_ROLE_KEY` as the reference secret.

- [ ] **2.4 Add to `.env.example`:** `LENDER_PILOT_REFERENCE_SECRET=` with no `NEXT_PUBLIC_` prefix.

- [ ] **2.5 GREEN:** `npm test -- tests/unit/lender-pilot-reference.test.ts`.

- [ ] **2.6 Commit:**

```bash
git add .env.example lib/server/lender-pilot-reference.ts tests/unit/lender-pilot-reference.test.ts
git commit -m "feat: pseudonymise lender pilot cases [vercel skip]"
```

---

### Task 3 — Partner-scoped read-only repository

**Files:** Create `lib/server/lender-recovery-repository.ts`, `tests/unit/lender-recovery-repository.test.ts`.

**Interfaces:**

```ts
export function listLenderRecoveryPartners(admin: SupabaseClient): Promise<LenderRecoveryPartner[]>;
export function readPartnerRecoveryAnalyticsInput(admin: SupabaseClient, partnerId: string, fromIso: string): Promise<RecoveryAnalyticsInput>;
export function readPartnerPipelineSources(admin: SupabaseClient, partnerId: string): Promise<LenderPipelineSources>;
export function readPartnerCohortSources(admin: SupabaseClient, partnerId: string, fromIso: string): Promise<LenderCohortSource[]>;
export function readPartnerPilotStatus(admin: SupabaseClient, partnerId: string): Promise<LenderPilotStatusSource>;
```

No exported mutation function is allowed.

- [ ] **3.1 RED — repository is read-only and contains no sensitive relations/columns.** Source contract test rejects `.insert(`, `.update(`, `.upsert(`, `.delete(`, `.rpc(`, `support_needs`, `date_of_birth`, `income_band`, `balance_minor`, `credit_limit_minor`.

- [ ] **3.2 RED — partner source.** `listLenderRecoveryPartners` reads `decline_partners` safe columns `id,partner_key,display_name,enabled,sandbox_enabled,live_enabled`; source must not query `commercial_partners`.

- [ ] **3.3 RED — first-stage scoping.** Initial journey read must include the inner intake relation and filters:

```ts
.eq("origin", "partner")
.eq("decline_intake_sessions.partner_id", partnerId)
```

Safe internal fields are `id,user_id,started_at,completed_at,updated_at,stage,readiness_snapshot,next_reassessment_at,last_reassessed_at,intake_session_id,decline_intake_sessions!inner(partner_id)`.

Follow-up `journey_state`, `user_missions`, `action_attempts` reads may use only IDs derived from those scoped journeys. `return_attempts` must also use `.eq("partner_id", partnerId)`. If scoped journeys are empty, issue no broad user-level follow-up reads.

- [ ] **3.4 RED — status safety.** Read only flags `partner_decline_intake_enabled`, `return_to_origin_enabled`, `commercial_gateway_enabled`, `commercial_sandbox_enabled`, `email_reminders_enabled`. Return-contract status selects only `id,environment,product_category,disclosure_key,disclosure_version,callback_policy,enabled,expires_at`; never `destination_url` or `callback_url`. Disclosure read is publication/version status only.

- [ ] **3.5 Run RED:** `npm test -- tests/unit/lender-recovery-repository.test.ts`.

- [ ] **3.6 Implement repository.** Reuse current `RecoveryAnalyticsInput` shape for the selected partner/window so `aggregateRecoveryAnalytics()` remains the aggregate calculator. Internal raw IDs are allowed only in repository/service types.

- [ ] **3.7 GREEN:**

```bash
npm test -- tests/unit/lender-recovery-repository.test.ts tests/unit/recovery-analytics.test.ts
```

- [ ] **3.8 Commit:**

```bash
git add lib/server/lender-recovery-repository.ts tests/unit/lender-recovery-repository.test.ts
git commit -m "feat: read partner-scoped recovery data [vercel skip]"
```

---

### Task 4 — Service orchestration and authoritative RTO status

**Files:** Create `lib/server/lender-recovery-service.ts`, `tests/unit/lender-recovery-service.test.ts`; modify `lib/server/return-origin-gateway.ts`.

**Interfaces:**

```ts
export interface LenderRecoveryService {
  listPartners(): Promise<LenderRecoveryPartner[]>;
  getOverview(input: LenderViewInput): Promise<LenderOverviewResult>;
  getPipeline(input: LenderViewInput): Promise<LenderPipelineResult>;
  getCohorts(input: LenderViewInput): Promise<LenderCohortResult>;
  getStatus(input: LenderViewInput): Promise<LenderStatusResult>;
}

export interface LenderRecoveryServiceDeps {
  admin: SupabaseClient;
  getReferenceSecret(): string | null;
  getReturnAvailability(input: { userId: string; recoveryJourneyId: string; now: Date }): Promise<ReturnOriginAvailability>;
  liveCreditReferralsAllowed: boolean;
  liveReturnToOriginAllowed: boolean;
}

export function createLenderRecoveryService(deps: LenderRecoveryServiceDeps): LenderRecoveryService;
```

- [ ] **4.1 RED — export existing live-RTO hard lock.** Add test expecting `LIVE_RETURN_TO_ORIGIN_ALLOWED === false`; existing RTO tests must remain unchanged.

- [ ] **4.2 RED — sanitisation.** Service input may contain raw IDs; `JSON.stringify(service result)` must contain neither. Reject sensitive property-name patterns such as `dateOfBirth|income|balance|creditLimit|supportNeed|vulnerab|declineReason|commission|revenue|approvalProbability`.

- [ ] **4.3 RED — RTO single source.** Inject mocked `getReturnAvailability`; assert exactly one call per included pipeline row with internal `{userId,recoveryJourneyId,now}`. Map rejected lookup to `unavailable`, never `available`.

- [ ] **4.4 RED — missing HMAC secret.** Overview/cohorts/status may still work; pipeline returns `{ available:false, reason:"reference_secret_unavailable" }` with no raw-ID fallback.

- [ ] **4.5 Run RED:**

```bash
npm test -- tests/unit/lender-recovery-service.test.ts tests/unit/return-origin-availability.test.ts tests/unit/return-origin-gateway.test.ts
```

- [ ] **4.6 Implement.** Export:

```ts
export const LIVE_RETURN_TO_ORIGIN_ALLOWED = false;
```

and replace the production gateway's literal `liveAllowed: false` with that constant only; behaviour must not change.

Production service dependencies are `createAdminSupabaseClient()`, `getLenderPilotReferenceSecret()`, `getReturnOriginAvailability()`, `process.env.LIVE_CREDIT_REFERRALS_ALLOWED === "true"`, and `LIVE_RETURN_TO_ORIGIN_ALLOWED`.

Pipeline orchestration must:
1. use partner-scoped sources;
2. compute `finalActivityAt` as max valid recovery `updated_at`, `completed_at`, and latest partner-scoped return-attempt timestamp;
3. apply Task 1 inclusion before RTO lookups;
4. derive five-state display from persisted recovery/Journey/action facts only;
5. summarise evidence without raw customer evidence text;
6. use `Promise.allSettled()` for RTO availability;
7. create HMAC reference;
8. return a new sanitised object that omits raw IDs.

Cohorts must not use free-text `attribution_key`; channel segmentation is omitted until a controlled enumerated channel exists.

- [ ] **4.7 GREEN:**

```bash
npm test -- tests/unit/lender-recovery-service.test.ts tests/unit/return-origin-availability.test.ts tests/unit/return-origin-gateway.test.ts
```

- [ ] **4.8 Commit:**

```bash
git add lib/server/lender-recovery-service.ts lib/server/return-origin-gateway.ts tests/unit/lender-recovery-service.test.ts
git commit -m "feat: orchestrate lender recovery views [vercel skip]"
```

---

### Task 5 — Executive overview shell and safe selectors

**Files:** Create `app/admin/lender-demo/page.tsx`, `lender-demo-controls.tsx`, `lender-demo-tabs.tsx`, `lender-overview.tsx`, `tests/unit/lender-demo-components.test.tsx`, `tests/unit/lender-demo-contract.test.ts`; modify `components/admin/admin-nav.tsx`.

**URL:** `/admin/lender-demo?partner=<decline-partner-id>&window=7|30|90&view=overview|pipeline|cohorts|status`.

- [ ] **5.1 RED — overview component.** Assert six counts, four rates, `Unavailable` for null percentage, visible non-guarantee, and no sensitive labels.

- [ ] **5.2 RED — page contract.** Source test asserts `requireAdminUser()` is called, page imports lender service rather than Supabase, contains no `commercial_partners`, and parses only approved windows/views.

- [ ] **5.3 RED — selector semantics.** No `partner` query param => first allowed decline partner. Supplied unknown partner => render `Partner unavailable`; never broaden to all partners or silently replace an explicitly invalid ID.

- [ ] **5.4 Run RED:**

```bash
npm test -- tests/unit/lender-demo-components.test.tsx tests/unit/lender-demo-contract.test.ts
```

- [ ] **5.5 Implement.** Server parse helpers:

```ts
function parseWindow(value: string | undefined): LenderDemoWindowDays {
  return value === "7" || value === "30" || value === "90" ? Number(value) as LenderDemoWindowDays : 30;
}
function parseView(value: string | undefined): LenderDemoView {
  return value === "pipeline" || value === "cohorts" || value === "status" ? value : "overview";
}
```

Use a GET form for partner/window and `Link` tabs that retain both. No client-side partner filtering. Add `["Lender Demo", "/admin/lender-demo"]` to admin nav.

- [ ] **5.6 GREEN + build:**

```bash
npm test -- tests/unit/lender-demo-components.test.tsx tests/unit/lender-demo-contract.test.ts
npm run build
```

- [ ] **5.7 Commit coherent visual checkpoint WITHOUT `[vercel skip]`:**

```bash
git add app/admin/lender-demo components/admin/lender-demo components/admin/admin-nav.tsx tests/unit/lender-demo-components.test.tsx tests/unit/lender-demo-contract.test.ts
git commit -m "feat: add lender pilot overview"
```

This creates the first Vercel preview. The overview must still render if the HMAC secret is not yet provisioned because overview has no case references.

---

### Task 6 — Pipeline, cohorts and read-only pilot status

**Files:** Create `lender-pipeline.tsx`, `lender-cohorts.tsx`, `lender-status.tsx`; modify page and component/contract tests.

- [ ] **6.1 RED — pipeline.** Assert `CQ-*`, recovery state/stage, time in recovery, evidence summary, reassessment, readiness and separate RTO status. Rendered output must exclude raw fixture IDs and destination URLs.

- [ ] **6.2 RED — cohorts.** Assert week/month aggregate rows and unavailable zero-denominator rates; no individual drill-through.

- [ ] **6.3 RED — status.** Show partner intake, RTO, commercial gateway, commercial sandbox, email reminders, live-credit hard lock, live-RTO hard lock, decline-partner enabled/sandbox/live state, and safe return contract/disclosure status. Assert no checkbox/switch/enable/save controls.

- [ ] **6.4 Run RED:**

```bash
npm test -- tests/unit/lender-demo-components.test.tsx tests/unit/lender-demo-contract.test.ts
```

- [ ] **6.5 Implement.** Page loads only the active view's service result so one source failure does not erase other independently valid views. RTO reasons are collapsed to `Available`, `Blocked`, `Unavailable`; do not expose internal gate reasons. Always show readiness separately with: “Ready to check does not mean approved or accepted by the lender.”

- [ ] **6.6 GREEN + build:**

```bash
npm test -- tests/unit/lender-demo-components.test.tsx tests/unit/lender-demo-contract.test.ts
npm run build
```

- [ ] **6.7 Commit:**

```bash
git add app/admin/lender-demo/page.tsx components/admin/lender-demo tests/unit/lender-demo-components.test.tsx tests/unit/lender-demo-contract.test.ts
git commit -m "feat: complete lender pilot console views [vercel skip]"
```

---

### Task 7 — Controlled console analytics

**Files:** Create `lender-demo-tracker.tsx`; modify `lib/events.ts`, `tests/unit/events.test.ts`, page and component tests.

**Events:** `lender_demo_opened`, `lender_demo_pipeline_viewed`, `lender_demo_cohorts_viewed`, `lender_demo_status_viewed`.

**Metadata:** `{ partnerId, windowDays, view, environmentMode }` only. Do not emit case references/customer IDs. The existing `/api/events` authenticates the admin, so browser metadata does not send admin ID.

- [ ] **7.1 RED event-schema tests** for all four names.
- [ ] **7.2 RED tracker test** asserting only approved metadata keys and rejecting `caseReference|userId|journeyId|balance|income|support|vulnerab|commission|revenue`.
- [ ] **7.3 Run RED:** `npm test -- tests/unit/events.test.ts tests/unit/lender-demo-components.test.tsx`.
- [ ] **7.4 Implement** using existing best-effort `trackEvent()`. Overview maps to `lender_demo_opened`; each other view maps to its event. Do not add a separate partner-selected event; selection is represented on the subsequent view event.
- [ ] **7.5 GREEN:** same command.
- [ ] **7.6 Commit:**

```bash
git add lib/events.ts tests/unit/events.test.ts components/admin/lender-demo/lender-demo-tracker.tsx app/admin/lender-demo/page.tsx tests/unit/lender-demo-components.test.tsx
git commit -m "feat: measure lender demo usage [vercel skip]"
```

---

### Task 8 — Real admin-session E2E

**Files:** Create `tests/e2e/helpers/admin-session.ts`, `tests/e2e/lender-demo.spec.ts`; modify `playwright.config.ts`.

No production auth bypass is permitted.

- [ ] **8.1 Add deterministic test-only reference secret to Playwright web server.** This is required because a correctly fail-closed app will not show pipeline case references without a server secret.

```ts
webServer: {
  command: "npm run dev -- --hostname localhost",
  url: "http://localhost:3000",
  reuseExistingServer: !process.env.CI,
  env: {
    LENDER_PILOT_REFERENCE_SECRET:
      process.env.LENDER_PILOT_REFERENCE_SECRET ?? "credit-quest-playwright-lender-reference-secret-2026",
  },
},
```

This value is a non-production test fixture only. Do not add a real secret to source control.

- [ ] **8.2 Build disposable admin auth helper.** Create an auth user using service-role `auth.admin.createUser({email,email_confirm:true})`, insert `admin_members`, generate a magic link with redirect to `/auth/callback?next=/admin/lender-demo`, follow the returned action link and let the real callback exchange establish cookies. Never synthesize session cookies.

- [ ] **8.3 Seed safe sandbox fixtures.** Unique decline partner (sandbox true/live false), temporary customer, partner intake session, linked recovery journey, `journey_state`, and a `user_missions` record if needed. Also seed one direct-recovery journey to prove exclusion. No support needs, real data, live destination or external URL.

- [ ] **8.4 E2E cases:** anonymous/non-admin cannot expose console; admin opens console; selected decline partner appears; overview→pipeline→cohorts→status retains partner/window; pipeline shows `CQ-*` and no raw IDs; direct recovery absent; status is locked/read-only; normal demo customer still has seven Quest Feed cards.

- [ ] **8.5 Cleanup** all seeded records/admin membership and temporary auth users even on test failure using `try/finally`/fixture teardown.

- [ ] **8.6 Run:**

```bash
npm run test:e2e -- tests/e2e/lender-demo.spec.ts tests/e2e/recovery-preservation.spec.ts tests/e2e/smoke.spec.ts
```

- [ ] **8.7 Commit:**

```bash
git add playwright.config.ts tests/e2e/helpers/admin-session.ts tests/e2e/lender-demo.spec.ts
git commit -m "test: cover lender pilot console end to end [vercel skip]"
```

---

### Task 9 — Documentation, deployment configuration and release verification

**Files:** Modify `README.md`; review all Task 1–8 files. No schema change.

- [ ] **9.1 README.** Document internal/admin-only access, decline-partner source, server-side scoping, HMAC pseudonyms, downstream/read-only projection, readiness/RTO separation, prohibited sensitive data, no external lender login, and dark/read-only pilot gates.

- [ ] **9.2 Provision a Preview-only HMAC secret before pipeline UAT.** In Vercel Preview environment set `LENDER_PILOT_REFERENCE_SECRET` to a cryptographically random 32+ character value. Do not expose or print its value. If connector permissions cannot set Preview environment variables, stop at this configuration boundary and ask the user to set the named variable in Vercel; do not substitute another app secret. Production may remain unset until a production lender-console release is explicitly authorised. Preview and Production should use separate secrets.

- [ ] **9.3 Focused tests:**

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

- [ ] **9.4 Full gate:**

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npm run test:e2e
npm run build
```

Run existing CI Supabase security probes unchanged:

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

- [ ] **9.5 Architecture regression review.** Fail if final diff: imports lender/commercial reporting into core strategy; uses `commercial_partners` for recovery selection; creates new readiness logic; duplicates RTO gating; sends mixed-partner cases to browser; exposes raw IDs/sensitive values/destination or callback URLs; implies approval; changes seven-card customer feed; creates external lender auth; adds live-gate mutation; changes dark defaults; converts missing to zero; or claims CRA/Open Banking.

- [ ] **9.6 Secret/privacy scan:**

```bash
rg -n "LENDER_PILOT_REFERENCE_SECRET|SUPABASE_SERVICE_ROLE_KEY|destination_url|callback_url|support_needs|date_of_birth|income_band|balance_minor|credit_limit_minor" \
  app/admin/lender-demo components/admin/lender-demo lib/recovery/lender-projection.ts lib/server/lender-* tests/unit/lender-* README.md .env.example playwright.config.ts
```

Expected: no secret values; service-role key never used for case refs; prohibited columns absent from lender UI/view-model code; destination/callback URL absent from lender status projection; only the explicit test-only Playwright reference-secret fixture is committed.

- [ ] **9.7 Final reviewed commit WITHOUT `[vercel skip]`:**

```bash
git add README.md
git commit -m "docs: document lender pilot console release"
```

Do not create an empty commit. Ensure the final substantive reviewed head is intentionally deployable.

- [ ] **9.8 Exact-head verification.** Require GitHub audit/lint/unit/Supabase/E2E/build GREEN and Vercel Preview success on the same SHA.

- [ ] **9.9 Internal UAT:** select sandbox decline partner + 30-day window; validate funnel; pipeline only `CQ-*`; readiness/RTO separate; cohorts aggregate-only; status read-only/live locked; normal customer dashboard unchanged.

- [ ] **9.10 Merge boundary.** Do not merge until the user explicitly passes UAT and separately authorises merge. If production use of the pipeline is then approved, provision a distinct production `LENDER_PILOT_REFERENCE_SECRET` before production UAT; this secret configuration does not enable any regulated/live referral gate.
