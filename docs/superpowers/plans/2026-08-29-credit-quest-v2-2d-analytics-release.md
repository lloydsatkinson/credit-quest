# Credit Quest V2.2D Analytics & Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete V2.2 with outcome-focused analytics, presentation-only experiments, operational dashboards, end-to-end architecture enforcement and a dark-first production rollout that leaves email/commercial live switches off.

**Architecture:** Analytics reads downstream Journey/reminder/referral/event records and never writes strategy inputs. Experiments are deterministic assignments on explicitly allowlisted presentation surfaces and may only transform an already-permitted presentation set. Release hardening verifies the complete migration chain locally, deploys compatible code dark, then applies additive production migrations 009 -> 010 -> 011 with live switches still false and records exact release evidence in the existing V2.2 roadmap issue rather than triggering an extra documentation deployment.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase Postgres/RLS, Vitest 3, Playwright, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-29-credit-quest-v2-2-journey-growth-design.md`

**Dependency:** V2.2A-C complete and green.

## Global Constraints

- Analytics is observational. No metric, revenue event, partner performance, experiment result or campaign concept may feed safety, diagnosis, readiness, Quest Score, mission ranking or Academy selection.
- Optimise for useful action, reassessment and readiness movement; never introduce screen-time/streak/addictive metrics as product objectives.
- Experiments may alter only allowlisted presentation. They cannot change eligibility, safety, age gates, Safe Mode, readiness, mission ranking or protective Academy filtering.
- Experiment assignment cannot introduce a route that Commercial Gateway did not already permit.
- Revenue remains an outcome metric only.
- `email_reminders_enabled=false`, `commercial_gateway_enabled=false`, and `LIVE_CREDIT_REFERRALS_ALLOWED=false` remain the V2.2 production release defaults.
- Production DDL occurs only after compatible code is verified live/dark. Never apply 009/010/011 ahead of compatible code.
- No automatic admin promotion.
- Release evidence must contain actual observed identifiers/statuses; do not write guessed deployment or migration IDs.
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
- `tests/unit/v2-2-events.test.ts`
- `tests/unit/v2-2-architecture.test.ts`
- `tests/unit/v2-2-release-invariants.test.ts`

**Modify**
- `lib/events.ts`
- `lib/commercial/ordering.ts`
- `app/admin/page.tsx`
- `app/admin/experiments/page.tsx`
- `components/commercial/commercial-gateway-card.tsx`
- Journey presentation components where exposure events are needed
- `tests/e2e/smoke.spec.ts`
- `supabase/tests/rls.sql`
- `.github/workflows/ci.yml` only if necessary; never weaken a gate
- `README.md`

---

### Task 1: Finalise the V2.2 event taxonomy

**Files:** Modify `lib/events.ts`; create event test.

- [ ] RED test asserts these controlled names are accepted:

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

- [ ] Add them to existing `eventNames`; keep tracking best-effort.
- [ ] Metadata convention: stable IDs/keys/bands/reasons only. Never full application data, credentials, full card data, lender underwriting payloads or service keys.
- [ ] Journey audit truth remains `journey_outcomes`; analytics events cannot reconstruct/override core state.
- [ ] Run existing event tests + new test GREEN and commit: `feat: extend V2.2 analytics events`.

### Task 2: Add deterministic presentation experiment assignment

**Files:** Create experiment types/assignment/repository/tests; modify commercial ordering integration.

```ts
export type ExperimentSurface =
  | "commercial_route_order"
  | "journey_status_copy"
  | "journey_email_opt_in_copy";
```

- [ ] RED tests: same user+experiment -> same variant; inactive/draft -> control; unknown surface rejected; implementation takes no commission/revenue input.
- [ ] Implement a stable FNV-1a-style string hash; assignment is hash of `${userId}:${experimentKey}` modulo stable-key-sorted variants.
- [ ] Repository returns active experiment only after validating `surface_key` and JSON variant schema.
- [ ] `commercial_route_order` runs **after** permitted routes. Initial variants: `control` keeps stable order; `reverse` reverses only that existing array. Assert output route IDs are exactly the same set as input.
- [ ] Journey copy variants select only pre-approved static copy keys, never free-form financial advice/HTML.
- [ ] Record `experiment_exposed` only after render.
- [ ] Run GREEN and commit: `feat: add presentation-only experiments`.

### Task 3: Build outcome-focused metrics repository

**Files:** Create `lib/server/metrics-repository.ts`, tests.

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

- [ ] RED tests use fake query results and prove repository is read-only. Read failure returns explicit unavailable result rather than fabricated zeros.
- [ ] Query a bounded window, default 30 days, from Journey outcomes/reminders/referrals/revenue/events. Do not write profile/core tables.
- [ ] Confirmed revenue calculation: add `revenue`, subtract `reversal`, apply signed direction defined by event type; `lead/click/conversion` contribute no amount unless explicitly represented as revenue event. V2.2 live revenue should remain zero because live routes are locked.
- [ ] WAIT/non-permitted reporting uses actual readiness/Journey evidence only; missing rows stay unknown/unavailable.
- [ ] Run GREEN and commit: `feat: add journey and commercial metrics`.

### Task 4: Finish Admin overview and experiment UX

**Files:** Create metrics dashboard; modify admin pages/tests.

- [ ] RED component tests: customer-progress metrics appear before commercial/revenue; persistent label “Revenue is reporting only — it does not affect customer strategy.”
- [ ] Cards: onboarding, mission completion, reassessment, readiness movement, reminder sends; separate commercial section for sandbox referrals/consent/revenue events.
- [ ] Experiment admin only allows the three controlled surfaces and pre-approved variants. No mission priority, readiness threshold, lender probability, commission weighting or arbitrary JS/HTML.
- [ ] Metrics unavailable is explicit, never fake zero.
- [ ] Run GREEN and commit: `feat: complete V2.2 admin metrics`.

### Task 5: Add whole-system architecture enforcement

**Files:** Create V2.2 architecture/experiment boundary tests.

- [ ] RED test scans core:
  - `lib/domain/safety.ts`
  - `lib/domain/diagnosis.ts`
  - `lib/domain/passport.ts`
  - `lib/domain/readiness.ts`
  - `lib/domain/quest-score.ts`
  - `lib/domain/mission-engine.ts`
  - `lib/academy/selector.ts`

Forbid imports/paths containing `lib/journey`, `lib/reminders`, `lib/commercial`, `lib/experiments`, `metrics-repository`, `revenue`, `affiliate`, `commission`, `campaign`, `feature-flag`.
- [ ] Scan Commercial gates/ordering; forbid commission/EPC/payout/revenue/campaign implementation identifiers.
- [ ] Scan experiment code; it must not import safety/readiness/mission-engine directly and cannot create routes.
- [ ] Lock the pre-V2.2 readiness edge behaviour; no V2.2 task edits `hasRevolvingCredit === null` logic.
- [ ] Lock seven-card feed in both dashboard paths and E2E.
- [ ] Run GREEN and commit: `test: enforce V2.2 architecture boundaries`.

### Task 6: Complete end-to-end acceptance matrix

**Files:** Modify E2E and targeted configured-mode route/integration tests.

- [ ] Cover:
  1. adult mission action -> Journey outcome -> reassessment scheduled;
  2. readiness changes -> honest before/after;
  3. unchanged -> honest no-change;
  4. under-18 -> no commercial route;
  5. Safe Mode -> no route;
  6. red/amber/unknown -> WAIT/no route;
  7. `hasRevolvingCredit=null` -> no commercial route even if readiness green;
  8. route presentation can show disclosure without consent;
  9. referral creation without consent -> none;
  10. missing/current-mismatched disclosure -> none;
  11. commercial flag off -> none;
  12. sandbox referral -> provenance + internal destination only;
  13. email flag off -> no email, in-app unaffected;
  14. email preference missing/off -> suppressed;
  15. provider failure -> journey unaffected and retry bounded;
  16. experiment preserves exact permitted route set;
  17. live route blocked with `LIVE_CREDIT_REFERRALS_ALLOWED=false`.
- [ ] Keep existing Academy/Passport/Readiness/Action Layer regressions.
- [ ] Run all unit/E2E GREEN and commit: `test: cover V2.2 acceptance matrix`.

### Task 7: Strengthen CI/release invariants without weakening gates

**Files:** Create release invariant test; CI only if needed.

- [ ] RED source test confirms migrations 009/010/011 exist in numeric order; DB runtime flags seed false; `.env.example` sets `LIVE_CREDIT_REFERRALS_ALLOWED=false`; RLS tests mention all protected V2.2 tables/RPCs.
- [ ] Verify existing CI still runs audit, lint, unit, local Supabase migration/RLS, Playwright and build. Do not remove/downgrade any gate.
- [ ] If no CI edit is required, leave workflow untouched.
- [ ] Run CI-equivalent commands and commit: `test: lock V2.2 release invariants`.

### Task 8: Pre-production exact-head verification

No production write yet.

- [ ] Compare branch against `main`; no unrelated changes.
- [ ] Run:

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
```

- [ ] Clean local Supabase reset; verify 001-011 apply and `supabase/tests/rls.sql` passes.
- [ ] Open/update PR against `main`; wait for exact-head GitHub CI and exact-head Vercel preview success.
- [ ] Preview smoke: adult, under-18, Safe Mode, journey status, email preference, `/admin` denied to normal user, `/offers` no direct live referral.
- [ ] Do not merge until explicit user approval.

### Task 9: Dark-first production deployment and migration sequence

Only after explicit merge/deploy approval.

- [ ] Merge with expected-head SHA guard.
- [ ] Confirm compatible new `main`/production code is live **before** V2.2 DDL. Core public smoke must work while 009-011 are absent; Journey optional reads fail soft, feature flag reads fail closed, commercial routes return none, cron sends nothing.
- [ ] Apply 009 `journey_foundation`; verify policies/FKs/source-key uniqueness/UPDATE immutability and core smoke.
- [ ] Apply 010 `retention_runtime_flags`; verify `email_reminders_enabled=false`, `commercial_gateway_enabled=false`, preference/RLS, claim RPC permissions and no email sends.
- [ ] Apply 011 `commercial_admin`; verify no enabled live route, no client grants, sandbox disclosure/route state, referral/revenue UPDATE immutability and publication RPC permissions.
- [ ] Run Supabase security/performance advisors after DDL. Security findings exposing V2.2 data/control are blockers. Do not remove useful fresh indexes solely because an unused-index advisor flags them immediately.
- [ ] Do not set `LIVE_CREDIT_REFERRALS_ALLOWED=true`; do not enable email/commercial flags in base release.
- [ ] Admin membership bootstrap, if requested, is a separate deliberate operator-access action after correct auth user identification.

### Task 10: Record exact release evidence without triggering another app deployment

Use the existing GitHub roadmap issue **#7 `V2.1: Customer Journey + monetisation layer`** as the durable V2.2 release record. Add one final comment only after actual values are verified; also reference issue #10 if release-foundation targets materially changed.

The comment must contain actual:
- merged PR and merge/main SHA;
- successful CI run ID;
- production Vercel deployment/status;
- applied Supabase migration versions/names 009-011;
- post-DDL RLS/security/advisor results;
- actual values of `email_reminders_enabled` and `commercial_gateway_enabled` plus confirmation `LIVE_CREDIT_REFERRALS_ALLOWED` is not true;
- production smoke results;
- deferred items: FCA operating-model decision/live partners, marketing email, push/SMS, CRA/Open Banking/lender eligibility integrations.

- [ ] Re-run production smoke after migrations.
- [ ] Confirm seven-card feed, Academy, Passport/Readiness and Action Layer unchanged.
- [ ] Confirm under-18/Safe Mode/WAIT protections.
- [ ] Confirm no live referral possible.
- [ ] Post exact evidence to issue #7; do not create guessed documentation values and do not make a docs-only commit merely to record the release.

## V2.2 Definition of Done

V2.2 is done when customers can move from action -> outcome -> scheduled reassessment -> explainable progress, opt into deterministic service reminders, and exercise a fully auditable sandbox commercial journey; internal operators can safely manage downstream configuration; analytics prove customer progress without becoming strategy inputs; all architectural/RLS/E2E gates pass; exact release evidence is recorded; and production remains commercially dark pending the separate FCA operating-model decision.
