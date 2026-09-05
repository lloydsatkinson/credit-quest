# Credit Quest Recovery Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing V2.0d decline-recovery foundations into a coherent recovery-first customer experience while preserving the main Credit Quest product, core strategy engines, seven-card Quest Feed and dark live-routing controls.

**Architecture:** Add a pure `RecoveryExperienceProjection` downstream of existing Safety, Diagnosis, Mission, Passport, Application Readiness, Journey and V2.0d Recovery outputs. The dashboard composes the existing authoritative outputs into that projection and renders recovery-specific presentation only while an active recovery journey exists. Return-to-Origin remains a separate server-owned downstream gate; evidence confidence is introduced as a presentation/domain boundary using current evidence only, with CRA/Open Banking adapters explicitly deferred.

**Tech Stack:** Next.js 16.3.3 App Router, React 19, TypeScript 5.9, Tailwind CSS 4, Supabase Auth/Postgres/RLS, Zod, Vitest/Testing Library, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-05-credit-quest-recovery-experience-design.md`

## Global Constraints

- Recovery must not fork or replace Safe Mode, Barrier Diagnosis, mission eligibility/ranking, Credit Passport, Application Readiness, Quest Score or Academy selection.
- Normal and recovery journeys use one customer profile, account set, mission history, Passport, readiness and Journey history.
- Recovery changes contextual orchestration and presentation only; a decline or partner context cannot become a second creditworthiness model.
- Customers without an active recovery journey keep the established Credit Quest dashboard.
- The Quest Feed remains exactly seven cards.
- `ready_to_check` is determined by independent Credit Quest readiness and does not require a partner return contract.
- Return-to-Origin availability is downstream of readiness and remains server-owned, customer-controlled and fail-closed.
- The browser never supplies partner identity, environment, readiness, or an arbitrary lender destination.
- Partner decline reason remains attributed context, not Credit Quest diagnosis.
- Unknown evidence remains unknown; it must never become false, zero or fabricated improvement.
- No CRA, Open Banking, lender-eligibility integration, database migration or new underwriting model is required by this tranche.
- `partner_decline_intake_enabled=false`, `return_to_origin_enabled=false`, `commercial_sandbox_enabled=false`, `commercial_gateway_enabled=false`, `email_reminders_enabled=false` and `LIVE_CREDIT_REFERRALS_ALLOWED=false` remain unchanged unless separately authorised.
- Live Return-to-Origin remains hard-locked OFF.
- Every production behaviour change is RED -> GREEN, with focused tests before broader verification.
- Intermediate commits should include `[vercel skip]`; only deliberate review/deployment checkpoints should consume a Vercel deployment.

---

### Task 1: Recovery Experience domain contract and state machine

**Files:**
- Create: `lib/recovery/experience.ts`
- Create: `tests/unit/recovery-experience.test.ts`

**Interfaces:**
- Consumes: `RecoveryPlanProjection` from `lib/recovery/plan.ts`, `ApplicationReadiness`, `RankedMissionInstance`, `ActionAttempt`, `JourneyState`, `ImpactLevel` from existing domain/Journey types.
- Produces: `RecoveryExperienceState`, `EvidenceConfidence`, `RecoveryEvidenceItem`, `RecoveryTimelineItem`, `RecoveryReturnState`, `RecoveryExperienceProjection`, `buildRecoveryExperienceProjection()`.

- [ ] **Step 1: Write RED state-derivation tests**

Create tests for the five explicit states:

```ts
expect(buildRecoveryExperienceProjection(base({ nextMission } )).state)
  .toBe("action_required");

expect(buildRecoveryExperienceProjection(base({
  nextMission: null,
  pendingAttempt: { status: "submitted", nextReviewAt: "2026-10-05T09:00:00.000Z" },
})).state).toBe("waiting_for_evidence");

expect(buildRecoveryExperienceProjection(base({
  nextMission: null,
  journeyState: { ...journey, stage: "reassessment_due", nextReassessmentAt: "2026-09-05T09:00:00.000Z" },
})).state).toBe("reassessment_due");

expect(buildRecoveryExperienceProjection(base({
  nextMission: null,
  readiness: { ...readiness, state: "amber" },
})).state).toBe("not_ready");

expect(buildRecoveryExperienceProjection(base({
  nextMission: null,
  readiness: { ...readiness, state: "green" },
  returnState: { status: "unavailable", reason: "direct_recovery", partnerLabel: null, actionHref: null },
})).state).toBe("ready_to_check");
```

Also assert that `ready_to_check` is unchanged when `returnState` is blocked/unavailable; Safe Mode never becomes ready; and no state returns generic `up_to_date` semantics.

- [ ] **Step 2: Run focused test and confirm RED**

Run:

```bash
npm test -- tests/unit/recovery-experience.test.ts
```

Expected: FAIL because `lib/recovery/experience.ts` does not exist.

- [ ] **Step 3: Implement the pure projection contract**

Use a stable input contract that contains already-derived strategy outputs rather than raw partner/commercial data:

```ts
export interface RecoveryExperienceInput {
  recoveryJourneyId: string;
  origin: "direct" | "partner";
  plan: RecoveryPlanProjection;
  readiness: ApplicationReadiness;
  nextMission: RankedMissionInstance | null;
  pendingAttempt: Pick<ActionAttempt, "missionInstanceId" | "status" | "nextReviewAt" | "verifiedAt"> | null;
  journeyState: JourneyState | null;
  now: Date;
  evidence: RecoveryEvidenceItem[];
  returnState: RecoveryReturnState;
}
```

State precedence must be deterministic:

```ts
if (input.readiness.state === "green" && input.plan.stage === "ready_to_check") return "ready_to_check";
if (input.journeyState?.stage === "reassessment_due") return "reassessment_due";
if (input.nextMission) return "action_required";
if (input.pendingAttempt?.nextReviewAt && Date.parse(input.pendingAttempt.nextReviewAt) > input.now.getTime()) return "waiting_for_evidence";
return "not_ready";
```

Do not let `returnState` decide readiness.

- [ ] **Step 4: Build timeline/headline/action copy from machine state**

The projection must provide one dominant `nextAction`, a five-step timeline (`declined`, `fixing`, `waiting`, `reassessment`, `ready`), a real reassessment label when a genuine date exists, and neutral non-guarantee language.

- [ ] **Step 5: Run focused test and confirm GREEN**

- [ ] **Step 6: Commit**

```bash
git add lib/recovery/experience.ts tests/unit/recovery-experience.test.ts
git commit -m "feat: add recovery experience projection [vercel skip]"
```

---

### Task 2: Read-only Return-to-Origin availability

**Files:**
- Modify: `lib/server/return-origin-gateway.ts`
- Modify: `tests/unit/return-origin-gateway.test.ts`

**Interfaces:**
- Preserves: `createReturnToOrigin()` POST semantics and all existing V2.0d gate behaviour.
- Produces: `ReturnOriginAvailability` and `getReturnOriginAvailability()` for read-only dashboard projection.

- [ ] **Step 1: Add RED tests proving availability can be evaluated without writing a return attempt**

Required contract:

```ts
export type ReturnOriginAvailability =
  | { status: "unavailable"; reason: "direct_recovery" | "recovery_unavailable" | "contract_unavailable"; partnerDisplayName: null }
  | { status: "blocked"; reason: ReturnOriginGatewayErrorCode; partnerDisplayName: string | null }
  | { status: "available"; reason: null; partnerDisplayName: string };
```

Test that a fully gated partner journey returns `available` and `appendReturnAttempt` is never called. Test gateway-disabled, cooldown, evidence, stale disclosure and live-hard-lock as `blocked`. Direct/no-contract cases are `unavailable`.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- tests/unit/return-origin-gateway.test.ts
```

- [ ] **Step 3: Factor shared gate-context loading**

Extract a private function that loads guidance, journey, contract, disclosure and suppression state and evaluates `evaluateReturnToOriginGate()` with `customerChoseReturn: true` only as a gate-completeness placeholder. It must not append `return_attempts` and must not expose `destinationUrl`.

- [ ] **Step 4: Reuse the same shared evaluation from `createReturn()`**

`createReturn()` must still re-fetch current state, validate destination server-side, append the audited attempt only after all gates pass, and return the destination only after explicit `customerChoice`.

- [ ] **Step 5: Confirm all Return-to-Origin tests GREEN**

- [ ] **Step 6: Commit**

```bash
git add lib/server/return-origin-gateway.ts tests/unit/return-origin-gateway.test.ts
git commit -m "refactor: expose read only return availability [vercel skip]"
```

---

### Task 3: Evidence confidence/provenance projection using current data

**Files:**
- Create: `lib/recovery/evidence.ts`
- Create: `tests/unit/recovery-evidence.test.ts`

**Interfaces:**
- Consumes: `CreditProfile`, `UserAccount[]`, `MissionInstance[]`, `ActionAttempt[]`, `CreditPassport`.
- Produces: `buildRecoveryEvidence()` returning `RecoveryEvidenceItem[]` with controlled source/confidence semantics.

- [ ] **Step 1: Write RED evidence tests**

Pin these examples:

```ts
expect(evidenceByKey(result, "electoral_roll")).toMatchObject({
  confidence: "confirmed",
  source: "customer",
});

expect(evidenceByKey(pendingElectoralRoll, "electoral_roll")).toMatchObject({
  confidence: "pending",
  source: "government_action",
});

expect(evidenceByKey(manualCard, "utilisation")).toMatchObject({
  confidence: "confirmed",
  source: "account",
});

expect(evidenceByKey(unknownIncomeEvidence, "application_evidence")).toMatchObject({
  confidence: "unknown",
});
```

No current manual/profile signal may be labelled `verified`; reserve `verified` for future trusted external adapters.

- [ ] **Step 2: Confirm RED**

- [ ] **Step 3: Implement controlled evidence mapping**

Map only customer-understandable evidence categories required for recovery: electoral roll/identity, utilisation/headroom where known, payment protection/direct debit, recent applications/cooldown, revolving history, and Passport unknown gaps. Do not surface raw decline codes, support needs or commercial metadata.

- [ ] **Step 4: Confirm GREEN and commit**

```bash
git add lib/recovery/evidence.ts tests/unit/recovery-evidence.test.ts
git commit -m "feat: add recovery evidence confidence model [vercel skip]"
```

---

### Task 4: Recovery hero and timeline UI

**Files:**
- Create: `components/recovery/recovery-hero.tsx`
- Create: `tests/unit/recovery-experience-components.test.tsx`

**Interfaces:**
- Consumes only `RecoveryExperienceProjection`.
- Produces one accessible recovery hero with a single dominant CTA and no embedded strategy logic.

- [ ] **Step 1: Write RED component tests**

Test `action_required`, `waiting_for_evidence`, `reassessment_due`, `not_ready`, and `ready_to_check`. Require:

```ts
expect(screen.getByRole("region", { name: /your recovery plan/i })).toBeTruthy();
expect(screen.getByRole("link", { name: /start quest|take action/i })).toHaveAttribute("href", "/actions/mission-1");
expect(screen.queryByText(/you will be approved|you now qualify/i)).toBeNull();
```

For waiting/reassessment/not-ready states there must be no fake action CTA. Timeline must expose the current step accessibly.

- [ ] **Step 2: Confirm RED**

- [ ] **Step 3: Implement `RecoveryHero`**

Render stage, projection headline/summary, next action, grounded impact/review timing, five-step timeline and reassessment label. Use existing premium `cq-panel`/dark-neon styling; do not add a second design system.

- [ ] **Step 4: Confirm GREEN and commit**

```bash
git add components/recovery/recovery-hero.tsx tests/unit/recovery-experience-components.test.tsx
git commit -m "feat: add recovery hero experience [vercel skip]"
```

---

### Task 5: Recovery-aware seven-card Quest Feed

**Files:**
- Create: `components/recovery/recovery-progress-card.tsx`
- Create: `components/recovery/recovery-next-card.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `tests/unit/recovery-experience-components.test.tsx`
- Create: `tests/unit/recovery-dashboard-contract.test.ts`

**Interfaces:**
- Reuses: `NextMissionCard`, `PassportCard`, `ReadinessCard`, `AcademyCard`, `QuestFeed`, `QuestFeedCard`.
- Preserves: normal dashboard rendering and `FEED_CARD_TOTAL = 7`.

- [ ] **Step 1: Add RED dashboard contract tests**

The source contract test must pin:

```ts
expect(dashboardSource).toContain("FEED_CARD_TOTAL = 7");
expect(dashboardSource).toContain("RecoveryHero");
expect(dashboardSource).not.toContain("<RecoveryStatus");
```

Component tests must prove the recovery feed tells this sequence:

1. `Do this now`
2. `Why this matters`
3. `Your Credit Passport`
4. `Can I apply yet?`
5. `Learn in 20 seconds`
6. `Your recovery progress`
7. `What happens next`

- [ ] **Step 2: Confirm RED**

- [ ] **Step 3: Build the projection in the configured dashboard path**

When `getLatestRecoveryJourney()` returns an active journey, construct evidence, read-only return availability and `RecoveryExperienceProjection` from the already-derived dashboard outputs. If there is no active recovery journey, keep the existing normal dashboard path.

- [ ] **Step 4: Replace additive `RecoveryStatus` with recovery-first composition**

Do not show duplicate `RecoveryStatus` + generic Journey explanation above the feed. Render `RecoveryHero`; retain Safe Mode, resumable action and account-setup surfaces where applicable. Reuse Passport/Readiness/Academy cards rather than cloning them.

- [ ] **Step 5: Remove recovery generic dead-end copy**

For active recovery, never render `You’re up to date for now.`; use projection state via `RecoveryHero`/`RecoveryNextCard`. Normal non-recovery customers may keep the current generic no-mission state.

- [ ] **Step 6: Confirm GREEN and commit**

```bash
git add app/dashboard/page.tsx components/recovery/recovery-progress-card.tsx components/recovery/recovery-next-card.tsx tests/unit/recovery-experience-components.test.tsx tests/unit/recovery-dashboard-contract.test.ts
git commit -m "feat: make recovery drive the quest experience"
```

This is the first deliberate Vercel-worthy checkpoint because it materially changes customer presentation.

---

### Task 6: Evidence UI and safe fallback behaviour

**Files:**
- Create: `components/recovery/recovery-evidence.tsx`
- Create: `components/recovery/recovery-fallback.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `tests/unit/recovery-experience-components.test.tsx`

**Interfaces:**
- Consumes `RecoveryEvidenceItem[]`; presentation only.

- [ ] **Step 1: Add RED evidence/fallback tests**

Require customer-facing labels `Verified`, `Confirmed`, `Pending`, `Unknown`; never expose `cra`/`open_banking` as connected when no adapter produced that evidence. Require a safe active-recovery fallback when projection enrichment throws.

- [ ] **Step 2: Confirm RED**

- [ ] **Step 3: Implement evidence presentation**

Display the highest-value evidence items and unknown/pending status without presenting unknown as bad. Include source language only where useful (`You told us`, `From your tracked account`, `Submitted — waiting for review`).

- [ ] **Step 4: Implement recovery fallback**

If an active recovery journey exists but optional recovery-experience enrichment fails, render:

```text
Your recovery plan
We can’t load the detailed recovery view right now.
Your core Credit Quest information is still available and no lender return will be attempted from this state.
```

Fail Return-to-Origin closed and do not invent a next action.

- [ ] **Step 5: Confirm GREEN and commit**

---

### Task 7: Customer-controlled Return-to-Origin surface

**Files:**
- Create: `components/recovery/return-to-origin-card.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `tests/unit/recovery-experience-components.test.tsx`
- Modify: `tests/unit/return-origin-gateway.test.ts`

**Interfaces:**
- Consumes `RecoveryExperienceProjection.returnState`.
- POSTs only `{ recoveryJourneyId, customerChoice }` to existing `/api/recovery/return`.

- [ ] **Step 1: Write RED component trust-boundary tests**

The component must never accept `destinationUrl`, `partnerId`, `environment` or readiness as props. Available state shows `Continue with [Partner]` plus non-guarantee wording. Blocked/unavailable states never expose a redirect control.

- [ ] **Step 2: Confirm RED**

- [ ] **Step 3: Implement explicit continue/decline actions**

On continue, POST:

```ts
fetch("/api/recovery/return", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ recoveryJourneyId, customerChoice: "continue" }),
});
```

Only navigate to `destinationUrl` returned by the existing server gateway after a successful response. Decline uses the same route with `customerChoice: "decline"` and leaves the customer inside Credit Quest.

- [ ] **Step 4: Confirm gateway/API trust-boundary tests remain GREEN**

- [ ] **Step 5: Commit**

---

### Task 8: Recovery experience analytics

**Files:**
- Modify: `lib/events.ts`
- Modify: `tests/unit/events.test.ts`
- Modify: `lib/recovery/events.ts`
- Modify: `tests/unit/recovery-analytics.test.ts`
- Modify: recovery client components only where exposure/action events are emitted.

**Interfaces:**
- Analytics is observational only and remains best-effort.
- No event metadata may contain partner economics, support/vulnerability detail, raw profile values or lender approval probability.

- [ ] **Step 1: Add RED taxonomy tests**

Add controlled event names:

```ts
"recovery_hero_shown"
"recovery_state_shown"
"recovery_waiting_for_evidence"
"recovery_reassessment_due"
```

Keep existing `recovery_first_action`, `recovery_reassessed`, `recovery_ready_to_check`, `recovery_return_choice`, `recovery_return_blocked` semantics rather than duplicating them.

- [ ] **Step 2: Confirm RED**

- [ ] **Step 3: Implement best-effort exposure events**

Metadata is limited to stable machine state, recovery stage and journey identifier where already allowed. Tracking failure must never block rendering, actions or return flow.

- [ ] **Step 4: Confirm GREEN and commit**

---

### Task 9: E2E, regression and release verification

**Files:**
- Modify: `tests/e2e/recovery.spec.ts`
- Modify: `tests/e2e/smoke.spec.ts` only where normal-dashboard preservation needs a stable assertion.
- Modify: `README.md` to document Recovery Experience semantics after implementation is green.

**Interfaces:**
- No activation of production partner/live/commercial/email flags.

- [ ] **Step 1: Add E2E coverage for the recovery experience contract**

At minimum retain all existing recovery security tests and add scenarios for:

```text
normal dashboard -> unchanged seven-card Quest experience
active recovery + next mission -> action_required hero
submitted electoral-roll action + future review -> waiting_for_evidence
reassessment date due -> reassessment_due
amber/no current action -> not_ready with explanation
independent green readiness -> ready_to_check
ready_to_check direct journey -> no invented original-lender route
partner return blocked -> readiness remains ready, return remains blocked
available sandbox return -> explicit continue only
customer declines return -> remains in Credit Quest
```

Where configured production data makes a scenario impractical in generic Playwright, keep the state-machine proof in unit/component tests and use Playwright for stable customer-visible contracts; do not weaken existing security assertions.

- [ ] **Step 2: Run focused recovery suites**

```bash
npm test -- tests/unit/recovery-domain.test.ts tests/unit/recovery-orchestrator.test.ts tests/unit/recovery-experience.test.ts tests/unit/recovery-evidence.test.ts tests/unit/recovery-experience-components.test.tsx tests/unit/recovery-dashboard-contract.test.ts tests/unit/return-origin-gateway.test.ts tests/unit/recovery-analytics.test.ts tests/unit/events.test.ts
```

Expected: all GREEN.

- [ ] **Step 3: Run full verification**

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npm run test:e2e
npm run build
```

Also run the same local Supabase verification used by CI:

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

- [ ] **Step 4: Architecture regression review**

Review the final diff and fail the tranche if any of these occur:

- partner/commercial fields imported by mission/safety/readiness/Passport modules;
- a second readiness or creditworthiness engine introduced;
- Quest Feed count differs from seven;
- direct customer readiness depends on a return contract;
- browser-owned arbitrary return destination introduced;
- live Return-to-Origin or commercial/email flags enabled;
- unknown evidence converted to a positive/negative fact;
- CRA/Open Banking presented as connected without a real adapter.

- [ ] **Step 5: Documentation and final implementation commit**

Update README with the recovery-first experience, explicit state vocabulary, evidence confidence boundary and normal-product preservation. Use a normal commit for the final reviewed checkpoint so Vercel can verify the exact head once, rather than consuming deployments for intermediate TDD commits.
