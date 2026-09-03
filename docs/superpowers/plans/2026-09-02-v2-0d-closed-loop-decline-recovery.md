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

- [ ] **Step 1: Write the failing domain contract test**

Create `tests/unit/recovery-domain.test.ts` covering: unknown decline reason remains unknown; partner context is preserved without generating diagnosis/profile mutations; support needs produce presentation/support adaptations but no Safe Mode decision; existing green readiness maps to `ready_to_check`; Return-to-Origin fails closed for under-18, Safe Mode, incomplete evidence, non-ready readiness, incomplete cooldown, stale disclosure, expired/disabled contract, missing customer choice, environment mismatch and live hard-lock; a fully permitted sandbox case passes.

- [ ] **Step 2: Verify RED in CI**

Open a draft PR against `main`. Expected: `npm test` fails because the new `lib/recovery/*` contracts do not exist yet; earlier audit/lint steps may pass.

- [ ] **Step 3: Implement the minimal pure domain layer**

Keep all functions deterministic and free of Supabase/server imports. `toRecoveryReadinessState()` maps `red -> not_ready`, `amber -> getting_closer`, `green -> ready_to_check`, `unknown -> unknown`. `deriveSupportAdaptations()` returns functional UX adjustments only. `evaluateReturnToOriginGate()` checks every independent gate and returns a stable machine reason when blocked.

- [ ] **Step 4: Verify GREEN**

Run CI again. Expected: new domain tests pass and no existing tests regress.

- [ ] **Step 5: Commit**

Commit message: `feat: add decline recovery domain gates`.

### Task 2: Additive recovery persistence and RLS

**Files:**
- Create: `supabase/migrations/013_decline_recovery_foundation.sql`
- Create: `supabase/tests/recovery_rls.sql`
- Modify: `.github/workflows/ci.yml`
- Test: `tests/unit/recovery-migration.test.ts`

**Interfaces:**
- Produces private/server-owned `decline_partners`, `decline_partner_credentials`, `return_contracts`; owner-readable `decline_recovery_journeys`, `support_needs`, `return_attempts`; server-bound `decline_intake_sessions`; append-only/audited provenance; default-off `partner_decline_intake_enabled` and `return_to_origin_enabled` feature flags.

- [ ] **Step 1: Write migration contract tests first**

Assert the migration creates the named tables, enables RLS, seeds both runtime flags OFF, enforces sandbox/live environment values, unique partner/idempotency constraints, hashed-token storage rather than raw tokens, and no client-writable partner/config tables.

- [ ] **Step 2: Verify RED**

Expected: unit migration contract fails because migration 013 does not exist.

- [ ] **Step 3: Add migration and SQL RLS probes**

Use UUID primary keys, owner IDs derived server-side, `created_at/updated_at` timestamps, `token_hash`, `token_expires_at`, `consumed_at`, partner/contract kill switches, narrow JSONB provenance with server-only writes, and foreign keys with indexes. Do not store partner economics in recovery strategy records.

- [ ] **Step 4: Wire `supabase/tests/recovery_rls.sql` into CI**

Expected SQL probes: anon cannot read/write private partner credentials/config; authenticated customer cannot read another owner's recovery/support/return records; service role can create intake/config; direct client writes to provenance/config fail; runtime flags remain service-role controlled.

- [ ] **Step 5: Verify GREEN and commit**

Commit message: `feat: add recovery persistence and rls`.

### Task 3: Direct “I’ve just been declined” journey

**Files:**
- Create: `app/recovery/page.tsx`
- Create: `components/recovery/direct-decline-form.tsx`
- Create: `app/api/recovery/declines/route.ts`
- Create: `lib/server/recovery-repository.ts`
- Test: `tests/unit/recovery-direct-route.test.ts`
- Test: `tests/unit/recovery-direct-ui.test.tsx`

**Interfaces:**
- Browser submits only minimal direct-entry fields: approximate decline date, product category, whether a reason was actually provided, optional provider display name, recent-application context and optional support need codes.
- Server derives user ID from authenticated session and creates an owner-scoped recovery journey.

- [ ] **Step 1: Write failing route/UI tests**

Cover unauthenticated rejection, no invented reason, strict enum validation, no arbitrary partner/return URL/environment fields, and premium customer-shell presentation.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement direct entry**

Use Zod, authenticated server session, repository writes through the service-owned path, and neutral copy: “I’ve just been declined” / “Credit Quest can help you understand what to work on next.” Do not claim a lender reason that was not supplied.

- [ ] **Step 4: Verify GREEN and commit**

Commit message: `feat: add direct decline recovery entry`.

### Task 4: Functional Support Needs Profile

**Files:**
- Create: `app/api/support-needs/route.ts`
- Create: `components/recovery/support-check.tsx`
- Create: `lib/server/support-needs-repository.ts`
- Modify: `app/accounts/page.tsx` or the existing profile/settings customer surface to expose the voluntary support check.
- Test: `tests/unit/support-needs-route.test.ts`
- Test: `tests/unit/support-needs-ui.test.tsx`

**Interfaces:**
- Persist allowlisted functional need codes and provenance/confirmation/review dates; do not accept detailed health diagnoses or unrestricted medical free text.
- Output adaptations consumed by customer presentation only; no import path from support UI/repository into `lib/domain/safety.ts`, `diagnosis.ts`, `readiness.ts`, `mission-engine.ts`.

- [ ] **Step 1: Write failing support tests**

Cover allowed needs, rejection of detailed-health/free-text payloads, owner scoping, support need without automatic Safe Mode, and customer ability to update/clear needs.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement route/repository/UI**

Use a non-stigmatising question: “Would anything make Credit Quest easier for you to use right now?” Map needs to plain-English, larger-text, reduced-motion, fewer-steps, slower-pacing, reminder-support, human-support and digital-help adaptations.

- [ ] **Step 4: Verify GREEN and commit**

Commit message: `feat: add functional support needs profile`.

### Task 5: Secure sandbox Partner Decline Intake

**Files:**
- Create: `app/api/partner/declines/route.ts`
- Create: `lib/recovery/partner-intake-schema.ts`
- Create: `lib/server/partner-auth.ts`
- Create: `lib/server/partner-intake-repository.ts`
- Create: `lib/server/partner-intake-service.ts`
- Test: `tests/unit/partner-decline-intake.test.ts`

**Interfaces:**
- Header contract: partner credential identifier, timestamp, nonce, idempotency key, request signature.
- Body excludes raw PII, health detail, underwriting notes, arbitrary destination URLs and client-supplied trusted `partner_id`/environment.
- Service returns an opaque one-use handoff token URL; raw token is returned once and only its hash is persisted.

- [ ] **Step 1: Write failing API/security tests**

Cover valid sandbox signed request, invalid signature, expired timestamp, nonce replay, duplicate idempotency, disabled partner, payload overreach, environment manipulation, and token characteristics.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement sandbox-only service**

Use HMAC-SHA256 over a canonical request representation with timing-safe comparison, timestamp tolerance, nonce persistence, rate-limit hook, `crypto.randomBytes` token generation and SHA-256 token hashing. Require `partner_decline_intake_enabled=true`; live environment requests remain rejected.

- [ ] **Step 4: Verify GREEN and commit**

Commit message: `feat: add sandbox partner decline intake`.

### Task 6: One-time handoff redemption and customer transparency

**Files:**
- Create: `app/recovery/handoff/[token]/page.tsx`
- Create: `app/api/recovery/handoff/redeem/route.ts`
- Create: `components/recovery/partner-context-review.tsx`
- Modify: `lib/server/partner-intake-service.ts`
- Test: `tests/unit/partner-handoff-redemption.test.ts`
- Test: `tests/e2e/recovery.spec.ts`

**Interfaces:**
- Token is server-redeemed, short-lived, single-use and invalid after account binding.
- Customer sees source, product category, decline date and optional structured reason with provenance; can confirm/correct/unknown/decline optional use.

- [ ] **Step 1: Write failing redemption tests**

Cover expired token, reused token, disabled partner after issue, wrong environment, no raw sensitive data in URL, account binding and truthful context correction.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement redemption/transparency flow**

Never decode sensitive context from the URL. Resolve token hash server-side and bind the resulting journey to the authenticated customer.

- [ ] **Step 4: Verify GREEN and commit**

Commit message: `feat: add recovery handoff redemption`.

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

- [ ] **Step 1: Write failing orchestration tests**

Cover Safe Mode -> crisis/recovery, red -> stability, amber -> rebuilding, known dated cooldown -> reassessment date, missing source date -> no fabricated 30/90/180 exact date, green -> ready-to-check.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement downstream orchestration**

Do not import partner economics or mutate core guidance. Persist the projection only after valid core guidance has been calculated.

- [ ] **Step 4: Verify GREEN and commit**

Commit message: `feat: orchestrate decline recovery plans`.

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

Cover canonical event names, best-effort behavior, aggregate counts, unavailable-source semantics and absence of support detail/partner economics from strategy paths.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement aggregate reporting**

Report handoffs, activations, first actions, reassessments, ready-to-check, voluntary returns, time-to-action and suppression reasons. Revenue remains downstream/reporting-only.

- [ ] **Step 4: Verify GREEN and commit**

Commit message: `feat: add recovery analytics reporting`.

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

Cover standard decline -> recovery -> sandbox ready-to-check -> voluntary return; unknown reason; conflicting partner context; corrected context; repeated applications/cooldown; Safe Mode suppression; support need without Safe Mode; under-18; expired contract; disabled partner; customer declining return; second decline without invented cause.

- [ ] **Step 2: Run full release verification**

Run: `npm audit --omit=dev --audit-level=high`, `npm run lint`, `npm test`, local Supabase migrations + all RLS SQL including `recovery_rls.sql`, `npm run test:e2e`, `npm run build`.

- [ ] **Step 3: Verify dark production boundaries**

Before any merge/deploy: no production pilot assignment; `partner_decline_intake_enabled=false`; `return_to_origin_enabled=false`; `commercial_sandbox_enabled=false`; `commercial_gateway_enabled=false`; `email_reminders_enabled=false`; live referral/return environment locks false; no enabled live partner route or return contract.

- [ ] **Step 4: Final review and release decision**

Do not activate sandbox or live capabilities as part of merge. Internal sandbox pilot activation is a separate explicit production control step after the compatible application and migration are verified.

- [ ] **Step 5: Commit**

Commit message: `test: harden decline recovery release`.
