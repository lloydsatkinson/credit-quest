# Credit Quest V2.2D Analytics & Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete V2.2 with outcome-focused analytics, presentation-only experiments, operational dashboards, end-to-end architecture enforcement and a dark-first production rollout that leaves email/commercial live switches off.

**Architecture:** Analytics reads downstream Journey/reminder/referral/event records and never writes strategy inputs. Experiments are deterministic assignments on explicitly allowlisted presentation surfaces and may only transform an already-permitted presentation set. Release hardening verifies the complete migration chain locally, deploys compatible code dark, then applies additive production migrations 009 -> 010 -> 011 with live switches still false and records exact release evidence.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase Postgres/RLS, Vitest 3, Playwright, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-29-credit-quest-v2-2-journey-growth-design.md`

**Dependency:** V2.2A-C complete and green.

## Global Constraints

- Analytics is observational. No metric, revenue event, partner performance, experiment result or campaign concept may feed safety, diagnosis, readiness, Quest Score, mission ranking or Academy selection.
- Optimise for useful action, reassessment and readiness movement; never introduce screen-time/streak/addictive metrics as product objectives.
- Experiments may alter only allowlisted presentation. They cannot change eligibility, safety, age gates, Safe Mode, readiness, mission ranking or protective Academy filtering.
- Experiment assignment cannot introduce a route that the Commercial Gateway did not already permit.
- Revenue remains an outcome metric only.
- `email_reminders_enabled=false`, `commercial_gateway_enabled=false`, and `LIVE_CREDIT_REFERRALS_ALLOWED=false` remain the V2.2 production release defaults.
- Production DDL occurs only after compatible code is verified live/dark. Never apply 009/010/011 ahead of compatible code.
- No automatic admin promotion.
- Every implementation task follows observed RED -> GREEN -> focused commit.

---

## File Map

**Create**
- `lib/experiments/types.ts`
- `lib/experiments/assignment.ts`
- `lib/server/experiment-repository.ts`
- `lib/server/metrics-repository.ts`
- `components/admin/metrics-dashboard.tsx`
- `tests/unit/experiment-assignment.test.ts`
- `tests/unit/experiment-boundaries.test.ts`
- `tests/unit/metrics-repository.test.ts`
- `tests/unit/v2-2-architecture.test.ts`
- `tests/unit/v2-2-release-invariants.test.ts`
- release evidence document at execution time under `docs/releases/` containing actual verified identifiers only

**Modify**
- `lib/events.ts`
- `lib/server/event-repository.ts` only if typing needs expansion
- `lib/commercial/ordering.ts`
- `app/admin/page.tsx`
- `app/admin/experiments/page.tsx`
- `components/commercial/commercial-gateway-card.tsx`
- `components/journey/*` where exposure events are needed
- `tests/e2e/smoke.spec.ts`
- `supabase/tests/rls.sql`
- `.github/workflows/ci.yml` only if necessary to preserve exact existing gates; do not weaken them
- `README.md`

---

### Task 1: Finalise the V2.2 event taxonomy

**Files:** Modify `lib/events.ts`; create `tests/unit/v2-2-events.test.ts`.

- [ ] RED test asserts these new event names are accepted while arbitrary revenue/strategy mutation events are rejected:

```ts
"journey_status_shown"
"journey_reassessment_completed"
"journey_readiness_changed"
"journey_reminder_shown"
"journey_email_preference_changed"
"journey_email_sent"
"commercial_routes_shown"
"referral_consent_accepted"
"referral_consent_declined"
"sandbox_referral_created"
"experiment_exposed"
```

- [ ] Add them to `eventNames`. Keep `trackEvent` best-effort exactly as today.
- [ ] Define metadata conventions in the test/docs: IDs/keys/bands/reasons only; never full application data, passwords, card numbers, lender underwriting payloads or service keys.
- [ ] Journey audit truth remains `journey_outcomes`; analytics events are not used to reconstruct core state.
- [ ] Run `npm test -- tests/unit/events.test.ts tests/unit/v2-2-events.test.ts` GREEN and commit: `feat: extend V2.2 analytics events`.

### Task 2: Add deterministic presentation experiment assignment

**Files:** Create `lib/experiments/types.ts`, `assignment.ts`, repository and tests; modify commercial ordering integration.

**Allowed surfaces:**

```ts
export type ExperimentSurface =
  | "commercial_route_order"
  | "journey_status_copy"
  | "journey_email_opt_in_copy";
```

No other surface is accepted by V2.2.

- [ ] RED tests: same user+experiment always gets same variant; different variants are approximately distributed; inactive/draft experiment => control; unknown surface rejected; no commission/revenue input exists.
- [ ] Implement a stable FNV-1a-style string hash in pure TypeScript; assignment is `hash(userId + ':' + experimentKey) % variants.length`. Sort variants by stable key before indexing.
- [ ] Repository returns active experiment config only after validating `surface_key` against the allowlist and JSON variant schema.
- [ ] For `commercial_route_order`, apply experiment **after** `listPermittedCommercialRoutes` returns. Supported initial variants: `control` keeps stable order; `reverse` reverses only that already-permitted array. Assert output IDs are exactly the same set as input IDs.
- [ ] For Journey copy surfaces, variants may select between pre-approved static copy keys only; no free-form admin HTML/financial advice.
- [ ] Add `experiment_exposed` best-effort event only after a variant is actually rendered.
- [ ] Run GREEN and commit: `feat: add presentation-only experiments`.

### Task 3: Build outcome-focused metrics repository

**Files:** Create `lib/server/metrics-repository.ts`, `tests/unit/metrics-repository.test.ts`.

**Return contract:**

```ts
export interface JourneyMetrics {
  onboardingCompleted: number;
  missionStarted: number;
  missionCompleted: number;
  reassessments: number;
  readinessChanged: number;
  readinessMovement: Record<"red_to_amber" | "amber_to_green" | "other", number>;
  remindersSent: number;
}

export interface CommercialMetrics {
  sandboxReferrals: number;
  consentAccepted: number;
  revenueEvents: number;
  confirmedRevenueMinor: number;
}
```

- [ ] RED tests use fake Supabase query results and prove metrics are read-only aggregates. Failures return an explicit unavailable result rather than zero pretending success.
- [ ] Implement server-only metrics queries from `journey_outcomes`, `journey_reminders`, `referral_attempts`, `revenue_events`, `events`. Query a bounded time window (default 30 days) and never join metrics back to `profiles` to write strategy.
- [ ] Count WAIT/non-permitted outcomes using readiness snapshots/current Journey state where evidence exists; do not infer missing rows.
- [ ] Partner performance is display/reporting only. Keep the metrics repository outside all core domain imports.
- [ ] Run GREEN and commit: `feat: add journey and commercial metrics`.

### Task 4: Finish Admin overview/experiment UX

**Files:** Create `components/admin/metrics-dashboard.tsx`; modify admin overview/experiments pages; component tests.

- [ ] RED component tests assert journey metrics appear before commercial/revenue metrics; a persistent label says “Revenue is reporting only — it does not affect customer strategy.”
- [ ] Build cards for onboarding/mission completion/reassessment/readiness movement/reminder return; separate commercial section for sandbox referrals/consent/revenue-event reporting.
- [ ] Experiment page only offers the three allowlisted surfaces and pre-approved variants. No field for mission priority, readiness threshold, lender probability, commission weighting or arbitrary JS/HTML.
- [ ] Metrics unavailable state is explicit and does not show fabricated zeros.
- [ ] Run GREEN and commit: `feat: complete V2.2 admin metrics`.

### Task 5: Add whole-system architecture enforcement

**Files:** Create `tests/unit/v2-2-architecture.test.ts`, `experiment-boundaries.test.ts`.

- [ ] RED test recursively reads these core files:
  - `lib/domain/safety.ts`
  - `lib/domain/diagnosis.ts`
  - `lib/domain/passport.ts`
  - `lib/domain/readiness.ts`
  - `lib/domain/quest-score.ts`
  - `lib/domain/mission-engine.ts`
  - `lib/academy/selector.ts`

Forbid imports/paths containing `lib/journey`, `lib/reminders`, `lib/commercial`, `lib/experiments`, `metrics-repository`, `revenue`, `affiliate`, `commission`, `campaign`, `feature-flag`.
- [ ] Scan `lib/commercial/gates.ts` and `ordering.ts`; forbid `commission`, `epc`, `payout`, `revenue`, `campaign` as implementation identifiers.
- [ ] Scan experiment code; assert it does not import safety/readiness/mission-engine directly and cannot create/append routes.
- [ ] Add explicit source regression that `readiness.ts` still has its pre-V2.2 logic; no V2.2 task edits the `hasRevolvingCredit === null` edge.
- [ ] Add a seven-card regression: `FEED_CARD_TOTAL` remains 7 in both dashboard implementations and E2E still counts 7.
- [ ] Run architecture tests GREEN and commit: `test: enforce V2.2 architecture boundaries`.

### Task 6: Complete end-to-end acceptance matrix

**Files:** Modify `tests/e2e/smoke.spec.ts`; create targeted route/integration tests where authenticated Supabase state cannot be represented safely in demo E2E.

- [ ] Cover the approved matrix:
  1. adult mission action -> Journey outcome -> reassessment scheduled;
  2. readiness changes -> honest before/after message;
  3. readiness unchanged -> honest no-change message;
  4. under-18 -> no referral;
  5. Safe Mode -> no referral;
  6. red/amber/unknown -> WAIT/no referral;
  7. `hasRevolvingCredit=null` -> no commercial referral even if readiness is green;
  8. consent refusal -> no referral attempt;
  9. missing disclosure -> no referral;
  10. commercial flag off -> no referral;
  11. sandbox route -> provenance recorded and only internal sandbox destination returned;
  12. email flag off -> no email, in-app journey unaffected;
  13. email preference off/missing -> suppressed;
  14. email provider failure -> journey unaffected;
  15. experiment changes only presentation of same permitted route set;
  16. live route -> blocked while `LIVE_CREDIT_REFERRALS_ALLOWED=false`.
- [ ] Keep public Academy and existing V2.1 protections in smoke suite.
- [ ] Run all unit/E2E GREEN and commit: `test: cover V2.2 journey and growth acceptance`.

### Task 7: Strengthen CI/release invariants without weakening existing gates

**Files:** Create `tests/unit/v2-2-release-invariants.test.ts`; modify CI only if needed.

- [ ] RED source test confirms migrations `009`, `010`, `011` exist in numeric order; runtime default flags are false; `.env.example` defaults `LIVE_CREDIT_REFERRALS_ALLOWED=false`; RLS test mentions all V2.2 protected tables.
- [ ] Verify current CI still runs audit, lint, unit, local Supabase migration/RLS, Playwright and build. Do not remove or downgrade a gate.
- [ ] If no CI change is required, leave `.github/workflows/ci.yml` untouched and document that decision in the final commit message.
- [ ] Run CI-equivalent commands locally and commit: `test: lock V2.2 release invariants`.

### Task 8: Pre-production exact-head verification

No production write yet.

- [ ] Ensure branch contains no unreviewed unrelated changes. Compare against `main`.
- [ ] Run full gate:

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
```

- [ ] Run disposable/local Supabase from a clean reset and execute `supabase/tests/rls.sql`; verify 001-011 apply in order.
- [ ] Open/update a PR against `main`; wait for exact-head GitHub CI success and exact-head Vercel preview success.
- [ ] Verify preview manually: standard adult, under-18, Safe Mode, journey status, email preference, `/admin` forbidden for normal user, `/offers` no direct live referral.
- [ ] Do not merge until explicit user approval.

### Task 9: Dark-first production deployment and migration sequence

This task occurs only after explicit merge/deploy approval and successful exact-head verification.

- [ ] Merge with an expected-head SHA guard.
- [ ] Confirm new `main`/production code is live **before** production V2.2 DDL. Public core smoke must still work while 009-011 tables are absent; optional Journey/reminder/commercial reads fail soft/closed as designed.
- [ ] Apply migration 009 `journey_foundation`; immediately verify table counts/policies/FKs/append-only trigger and core smoke.
- [ ] Apply migration 010 `retention_runtime_flags`; verify `email_reminders_enabled=false`, `commercial_gateway_enabled=false`, preference/RLS isolation and cron route remains inactive.
- [ ] Apply migration 011 `commercial_admin`; verify no enabled live route, no client grants, published sandbox disclosure only, append-only referral/revenue/audit triggers and publication RPC permissions.
- [ ] Run Supabase security/performance advisors after all DDL. Treat security findings as blockers if they expose V2.2 data/control; do not remove useful fresh indexes merely because an unused-index advisor reports them immediately after creation.
- [ ] Do **not** set `LIVE_CREDIT_REFERRALS_ALLOWED=true`; do **not** enable the commercial/email flags as part of base release.
- [ ] Admin membership bootstrap, if wanted, is a separate deliberate operator access action after identifying the correct existing auth user. No auto-promotion.

### Task 10: Record release evidence and final production verification

**Files:** Create `docs/releases/<actual-date>-credit-quest-v2-2-release.md` at execution time using actual values observed during release; do not create a placeholder document in advance.

The release record must contain actual:
- merged PR number and merge/main SHA;
- exact successful CI run ID;
- production Vercel deployment/status;
- applied Supabase migration versions/names 009-011;
- post-DDL RLS/security/advisor results;
- values of `email_reminders_enabled`, `commercial_gateway_enabled`, and confirmation that `LIVE_CREDIT_REFERRALS_ALLOWED` is not true;
- production smoke results;
- known deferred items: live FCA operating-model decision, live partners, marketing email, push/SMS, CRA/Open Banking/lender eligibility integrations.

- [ ] Re-run production smoke after migrations.
- [ ] Confirm seven-card feed, Academy, Passport/readiness and Action Layer still behave as before.
- [ ] Confirm under-18/Safe Mode/WAIT protections on production.
- [ ] Confirm no live referral is possible.
- [ ] Commit the release evidence only after actual values are known and verified.

## V2.2 Definition of Done

V2.2 is done when customers can move from action -> outcome -> scheduled reassessment -> explainable progress, opt into deterministic service reminders, and exercise a fully auditable sandbox commercial journey; internal operators can safely manage downstream configuration; analytics prove customer progress without becoming strategy inputs; all architectural/RLS/E2E gates pass; and the production release remains commercially dark pending the separate FCA operating-model decision.
