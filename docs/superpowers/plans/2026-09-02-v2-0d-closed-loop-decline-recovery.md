# Credit Quest V2.0d Closed-Loop Decline Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Credit Quest's closed-loop decline recovery journey, secure sandbox partner intake, functional support adaptations, and customer-controlled Return-to-Origin while keeping live regulated handoff dark.

**Architecture:** Add a new `recovery` domain downstream of the existing safety, diagnosis, Passport, readiness and mission engines. Inbound partner decline intake is a separate trust boundary from the existing outbound Commercial Gateway. Persistence is additive and owner/RLS protected; partner/server configuration stays service-role-only; sandbox/live activation remains independently gated.

**Tech Stack:** Next.js App Router, TypeScript, React, Supabase Auth/Postgres/RLS, Zod, Vitest/Testing Library, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-02-credit-quest-v2-0d-closed-loop-decline-recovery-design.md`

## Global Constraints

- A partner decline is context, not Credit Quest diagnosis.
- Partner/commercial economics cannot influence safety, diagnosis, Passport, readiness, support treatment, mission ranking or return readiness.
- Vulnerability/support needs do not automatically mean Safe Mode.
- Prefer functional support adjustments over medical/health detail; do not add detailed special-category health capture in this release.
- Return-to-Origin requires semantic `ready_to_check` plus all applicable safety, evidence, cooldown, disclosure, customer-choice, partner and environment gates.
- Browser clients never supply trusted partner identity, live/sandbox environment, or arbitrary return destinations.
- Inbound Partner Decline Intake remains separate from the existing outbound Commercial Gateway.
- Sandbox/live controls remain separate.
- `commercial_gateway_enabled=false`, `commercial_sandbox_enabled=false`, `email_reminders_enabled=false`, and `LIVE_CREDIT_REFERRALS_ALLOWED=false` remain untouched by this programme unless a later explicit release authorises otherwise.
- No production pilot membership, live regulated referral, live Return-to-Origin, partner callback or email activation is authorised by implementation work alone.
- Quest Feed remains exactly seven cards.
- Existing safety/readiness/mission logic stays authoritative and is not rewritten for partner context.

---

### Task 1: Recovery domain contracts and invariant gates

**Files:**
- Create: `lib/recovery/types.ts`
- Create: `lib/recovery/readiness.ts`
- Create: `lib/recovery/decline-context.ts`
- Create: `lib/recovery/support.ts`
- Create: `lib/recovery/return-gate.ts`
- Test: `tests/unit/recovery-domain.test.ts`

**Interfaces:**
- Consumes: `AgeMode`, `ReadinessState` from `lib/domain/types.ts`; `SafetyMode` from `lib/domain/safety.ts`.
- Produces: `RecoveryReadinessState`, `DeclineContext`, `SupportNeedCode`, `SupportAdaptations`, `ReturnGateContext`, `ReturnGateResult`, `toRecoveryReadinessState()`, `buildDeclineContext()`, `deriveSupportAdaptations()`, `evaluateReturnToOriginGate()`.

- [x] **Step 1: Write the failing domain contract test**

Create `tests/unit/recovery-domain.test.ts` covering: unknown decline reason remains unknown; partner context is preserved without generating diagnosis/profile mutations; support needs produce presentation/support adaptations but no Safe Mode decision; existing green readiness maps to `ready_to_check`; Return-to-Origin fails closed for under-18, Safe Mode, incomplete evidence, non-ready readiness, incomplete cooldown, stale disclosure, expired/disabled contract, missing customer choice, environment mismatch and live hard-lock; a fully permitted sandbox case passes.

- [x] **Step 2: Verify RED in CI**

- [x] **Step 3: Implement the minimal pure domain layer**

Keep all functions deterministic and free of Supabase/server imports. `toRecoveryReadinessState()` maps `red -> not_ready`, `amber -> getting_closer`, `green -> ready_to_check`, `unknown -> unknown`. `deriveSupportAdaptations()` returns functional UX adjustments only. `evaluateReturnToOriginGate()` checks every independent gate and returns a stable machine reason when blocked.

- [x] **Step 4: Verify GREEN**

GREEN head: `2880a9afdc2210b1cf9b0c85f3af8f40092f21c9`.

- [x] **Step 5: Commit**

Commit message: `feat: add decline recovery domain gates`.

### Task 2: Additive recovery persistence and RLS

**Files:**
- Create: `supabase/migrations/013_decline_recovery_foundation.sql`
- Create: `supabase/tests/recovery_rls.sql`
- Modify: `.github/workflows/ci.yml`
- Test: `tests/unit/recovery-migration.test.ts`

**Interfaces:**
- Produces private/server-owned `decline_partners`, `decline_partner_credentials`, `return_contracts`; owner-readable `decline_recovery_journeys`, `support_needs`, `return_attempts`; server-bound `decline_intake_sessions`; append-only/audited provenance; default-off `partner_decline_intake_enabled` and `return_to_origin_enabled` feature flags.

- [x] **Step 1: Write migration contract tests first**
- [x] **Step 2: Verify RED**
- [x] **Step 3: Add migration and SQL RLS probes**
- [x] **Step 4: Wire `supabase/tests/recovery_rls.sql` into CI**
- [x] **Step 5: Verify GREEN and commit**

GREEN head: `cf6ced12c888b1f35119e58ce3e4df4e43e72b9f`.

### Task 3: Direct “I’ve just been declined” journey

**Files:**
- Create: `app/recovery/page.tsx`
- Create: `components/recovery/direct-decline-form.tsx`
- Create: `app/api/recovery/declines/route.ts`
- Create: `lib/server/recovery-repository.ts`
- Test: `tests/unit/recovery-direct-route.test.ts`
- Test: `tests/unit/recovery-direct-ui.test.tsx`

- [x] **Step 1: Write failing route/UI tests**
- [x] **Step 2: Verify RED**
- [x] **Step 3: Implement direct entry**
- [x] **Step 4: Verify GREEN and commit**

GREEN head: `ab56013aa46492b5dd7a383aee732a0dfc1f00e1`.

### Task 4: Functional Support Needs Profile

**Files:**
- Create: `app/api/support-needs/route.ts`
- Create: `components/recovery/support-check.tsx`
- Create: `lib/server/support-needs-repository.ts`
- Modify: `app/accounts/page.tsx` or the existing profile/settings customer surface to expose the voluntary support check.
- Test: `tests/unit/support-needs-route.test.ts`
- Test: `tests/unit/support-needs-ui.test.tsx`

- [x] **Step 1: Write failing support tests**
- [x] **Step 2: Verify RED**
- [x] **Step 3: Implement route/repository/UI**
- [x] **Step 4: Verify GREEN and commit**

GREEN head: `75d09180c4b6b9dbe4c81875df467f424a450aa3`.

### Task 5: Secure sandbox Partner Decline Intake

**Files:**
- Create: `app/api/partner/declines/route.ts`
- Create: `lib/recovery/partner-intake-schema.ts`
- Create: `lib/server/partner-auth.ts`
- Create: `lib/server/partner-intake-repository.ts`
- Create: `lib/server/partner-intake-service.ts`
- Test: `tests/unit/partner-decline-intake.test.ts`

- [x] **Step 1: Write failing API/security tests**
- [x] **Step 2: Verify RED**
- [x] **Step 3: Implement sandbox-only service**
- [x] **Step 4: Verify GREEN and commit**

GREEN head: `f5ad23f30cc199446f05d781e4b2bf4a4cda5352`.

### Task 6: One-time handoff redemption and customer transparency

**Files:**
- Create: `app/recovery/handoff/[token]/page.tsx`
- Create: `app/api/recovery/handoff/redeem/route.ts`
- Create: `components/recovery/partner-context-review.tsx`
- Modify: `lib/server/partner-intake-service.ts`
- Test: `tests/unit/partner-handoff-redemption.test.ts`
- Test: `tests/e2e/recovery.spec.ts`

- [x] **Step 1: Write failing redemption tests**
- [x] **Step 2: Verify RED**
- [x] **Step 3: Implement redemption/transparency flow**
- [x] **Step 4: Verify GREEN and commit**

GREEN head: `3614fb17fc9b2ae37e9353a82f3b652dc81edef7`.

### Task 7: Recovery-plan orchestration

**Files:**
- Create: `lib/recovery/plan.ts`
- Create: `lib/server/recovery-orchestrator.ts`
- Create: `components/recovery/recovery-status.tsx`
- Modify: `app/dashboard/page.tsx` only to show a recovery status outside the fixed seven-card Quest Feed.
- Test: `tests/unit/recovery-orchestrator.test.ts`

**Interfaces:**
- Consumes existing `getCreditGuidanceForUser`, Journey, safety/readiness/Passport/mission outputs.
- Produces recovery stage, next safe action, evidence gaps and reassessment date only when real dated evidence supports one.

- [x] **Step 1: Write failing orchestration tests**
- [x] **Step 2: Verify RED**

RED head: `0f01ac4c29a6c74a36b7e25d77e9dd295cef5dbd`. Existing 400 assertions remained green; only the new orchestration suite failed because the implementation modules did not yet exist.

- [x] **Step 3: Implement downstream orchestration**
- [x] **Step 4: Verify GREEN and commit**

GREEN code head: `b6debacc8d3766fd7b6ac6fb71fe64d7981cb5a6`.
- 407/407 unit + integration across 97 files.
- 7/7 recovery orchestration contract tests.
- migrations 001-013 + all RLS suites.
- 17/17 Playwright.
- dependency audit 0 vulnerabilities, lint, production build and Vercel green.

Task 7 projects Safe Mode -> crisis recovery, red -> stability, amber -> rebuilding and green -> `ready_to_check`; derives evidence gaps from the existing Credit Passport; never fabricates a reassessment date; and renders recovery status outside the fixed seven-card Quest Feed.

### Task 8: Sandbox Return-to-Origin gateway

**Files:**
- Create: `app/api/recovery/return/route.ts`
- Create: `lib/server/return-origin-repository.ts`
- Create: `lib/server/return-origin-gateway.ts`
- Create: `components/recovery/return-to-origin-card.tsx`
- Test: `tests/unit/return-origin-gateway.test.ts`

**Interfaces:**
- Server owns destination/callback configuration through `return_contracts`.
- Gateway re-fetches current guidance, maps green readiness to semantic `ready_to_check`, re-runs safety/evidence/cooldown/disclosure/customer-choice/partner/environment/expiry gates, writes an auditable attempt, then returns only an allowlisted sandbox destination.

- [ ] **Step 1: Write failing gateway tests**

Cover every domain gate plus stale/expired contract, arbitrary browser URL rejection, partner disabled after readiness, sandbox/live manipulation, minimal callback payload shape and customer decline/continue choice.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement sandbox gateway**

Require `return_to_origin_enabled=true`, sandbox pilot membership and sandbox contract. Keep live Return-to-Origin hard-locked OFF; no callback is sent in this release unless a later explicitly approved sandbox callback adapter is configured.

- [ ] **Step 4: Verify GREEN and commit**

Commit message: `feat: add sandbox return to origin gateway`.

### Task 9: Recovery analytics and aggregate partner demo reporting

**Files:**
- Create: `lib/recovery/events.ts`
- Create: `lib/server/recovery-analytics-repository.ts`
- Create: `app/admin/recovery/page.tsx`
- Test: `tests/unit/recovery-analytics.test.ts`

**Interfaces:**
- Best-effort events only; event failure cannot block recovery/return actions.
- Admin reporting is aggregate/cohort-first and contains no detailed support/vulnerability data.

- [ ] **Step 1: Write failing analytics tests**
- [ ] **Step 2: Verify RED**
- [ ] **Step 3: Implement aggregate reporting**
- [ ] **Step 4: Verify GREEN and commit**

### Task 10: Architecture, security, privacy and release hardening

**Files:**
- Create: `tests/unit/recovery-boundaries.test.ts`
- Extend: `tests/e2e/recovery.spec.ts`
- Create: `docs/compliance/v2-0d-data-protection-gate.md`
- Modify: `README.md`

**Interfaces:**
- Architecture tests enforce no imports from recovery partner attribution/support/config into core safety/diagnosis/readiness/mission ranking.
- Compliance document records that detailed health/special-category processing remains out of scope until Article 6/Article 9/DPA 2018/DPIA controls are approved.

- [ ] **Step 1: Write boundary and E2E tests**
- [ ] **Step 2: Run full release verification**
- [ ] **Step 3: Verify dark production boundaries**
- [ ] **Step 4: Final review and release decision**
- [ ] **Step 5: Commit**

Commit message: `test: harden decline recovery release`.
