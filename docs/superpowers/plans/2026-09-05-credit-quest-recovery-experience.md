# Credit Quest Recovery Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing V2.0d decline-recovery foundations into a coherent recovery-first customer experience while preserving the main Credit Quest product, its strategy engines, its seven-card Quest Feed and all dark/live-routing safeguards.

**Architecture:** Add a pure `RecoveryExperienceProjection` downstream of the existing Safety, Diagnosis, Mission, Passport, Application Readiness, Journey and V2.0d Recovery outputs. Recovery changes presentation and orchestration only. The dashboard keeps the current normal Credit Quest experience for customers without an active recovery journey. Return-to-Origin remains a separate, server-owned downstream gate. Evidence confidence/provenance is introduced using current data only; CRA/Open Banking integrations remain deferred.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Supabase Auth/Postgres/RLS, Zod, Vitest/Testing Library, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-05-credit-quest-recovery-experience-design.md`

## Non-negotiable constraints

- One core strategy engine: no recovery-specific underwriting/readiness model.
- One customer record: no duplicate profile, score, mission or Passport history.
- Recovery is contextual orchestration, not a replacement product.
- When recovery ends, the user returns naturally to Build / Optimise / Maintain.
- Mission ranking, Safe Mode, Passport, Readiness, Quest Score and Academy remain authoritative.
- The Quest Feed remains exactly seven cards.
- `ready_to_check` is determined independently by Credit Quest readiness; it does not depend on a partner return contract.
- Return-to-Origin is downstream of readiness, customer-controlled, server-owned and fail-closed.
- The browser never supplies partner identity, environment, readiness or an arbitrary lender destination.
- Partner decline reason remains context, not Credit Quest diagnosis.
- Unknown evidence remains unknown; it is never converted to false, zero or improvement.
- No CRA, Open Banking, lender-eligibility integration, new database migration or new underwriting model is required in this tranche.
- Existing dark defaults remain unchanged: partner intake OFF, Return-to-Origin OFF, commercial gateway/sandbox OFF, email reminders OFF and live credit referrals OFF.
- Live Return-to-Origin remains hard-locked OFF.
- Every behaviour change follows RED -> GREEN.
- Intermediate commits use `[vercel skip]`; only deliberate customer-visible checkpoints should consume Vercel deployments.

---

## Task 1 — Recovery Experience projection and explicit state machine

**Files**
- Create: `lib/recovery/experience.ts`
- Create: `tests/unit/recovery-experience.test.ts`

**Purpose**
Create one pure projection that translates existing authoritative outputs into the customer-facing recovery experience. React must render this projection rather than invent recovery business rules.

- [ ] **1.1 Write RED tests** for all five states:
  - `action_required`
  - `waiting_for_evidence`
  - `reassessment_due`
  - `not_ready`
  - `ready_to_check`

Example contract:

```ts
expect(buildRecoveryExperienceProjection(input({ nextMission } )).state)
  .toBe("action_required");

expect(buildRecoveryExperienceProjection(input({
  nextMission: null,
  openAttempt: {
    status: "submitted",
    nextReviewAt: "2026-10-05T09:00:00.000Z",
  },
})).state).toBe("waiting_for_evidence");

expect(buildRecoveryExperienceProjection(input({
  nextMission: null,
  journeyState: { ...journeyState, stage: "reassessment_due" },
})).state).toBe("reassessment_due");

expect(buildRecoveryExperienceProjection(input({
  nextMission: null,
  readiness: { ...readiness, state: "amber" },
})).state).toBe("not_ready");

expect(buildRecoveryExperienceProjection(input({
  nextMission: null,
  plan: { ...plan, stage: "ready_to_check" },
  readiness: { ...readiness, state: "green" },
  returnState: { status: "unavailable", reason: "direct_recovery", partnerLabel: null },
})).state).toBe("ready_to_check");
```

- [ ] **1.2 Confirm RED**

```bash
npm test -- tests/unit/recovery-experience.test.ts
```

Expected: missing module / contract failure.

- [ ] **1.3 Implement** `RecoveryExperienceProjection` with at least:

```ts
type RecoveryExperienceState =
  | "action_required"
  | "waiting_for_evidence"
  | "reassessment_due"
  | "not_ready"
  | "ready_to_check";

type EvidenceConfidence = "verified" | "confirmed" | "pending" | "unknown";

type RecoveryExperienceProjection = {
  mode: "recovery";
  recoveryJourneyId: string;
  stage: RecoveryPlanProjection["stage"];
  state: RecoveryExperienceState;
  headline: string;
  summary: string;
  nextAction: {
    missionInstanceId: string | null;
    missionSlug: string | null;
    title: string;
    rationale: string;
    actionHref: string | null;
    impactLabel: "high" | "medium" | "low" | null;
    effortLabel: string | null;
    reviewTimingLabel: string | null;
  };
  evidence: RecoveryEvidenceItem[];
  timeline: RecoveryTimelineItem[];
  reassessment: { dueAt: string | null; label: string };
  readiness: { status: string; explanation: string };
  returnState: RecoveryReturnState;
};
```

- [ ] **1.4 Pin deterministic precedence**

1. independent green + recovery plan `ready_to_check` -> `ready_to_check`
2. genuine reassessment due -> `reassessment_due`
3. currently eligible next mission -> `action_required`
4. open action with future review/evidence date -> `waiting_for_evidence`
5. otherwise -> `not_ready` with an explicit reason/evidence gap

`returnState` must never determine readiness.

- [ ] **1.5 Confirm GREEN** and commit:

```bash
git add lib/recovery/experience.ts tests/unit/recovery-experience.test.ts
git commit -m "feat: add recovery experience projection [vercel skip]"
```

---

## Task 2 — Separate open actions from resumable actions

**Files**
- Modify: `lib/server/action-repository.ts`
- Modify: `tests/unit/action-repository.test.ts`

**Why this task exists**
The current `listPendingActionAttempts()` correctly hides a submitted action whose `next_review_at` is still in the future, because the user cannot resume it yet. Recovery still needs to see that same action to explain **waiting for evidence**. Do not weaken the existing resume-card behaviour.

- [ ] **2.1 Write RED repository tests** proving:
  - a future-review `submitted` attempt is returned by a new read-only `listOpenActionAttempts()` query;
  - the same attempt remains excluded by `listPendingActionAttempts()` / `isAttemptReadyToResume()`;
  - completed/cancelled/failed attempts are excluded from the new open-attempt list.

Example:

```ts
expect(open.map((a) => a.id)).toContain("submitted-future-review");
expect(resumable.map((a) => a.id)).not.toContain("submitted-future-review");
```

- [ ] **2.2 Confirm RED**

```bash
npm test -- tests/unit/action-repository.test.ts
```

- [ ] **2.3 Implement** `listOpenActionAttempts(supabase, userId)` using the existing owner-scoped action-attempt table and the existing open statuses `started`, `returned`, `submitted`, ordered deterministically by recent activity.

Do **not** modify the semantics of `listPendingActionAttempts()` or `isAttemptReadyToResume()`.

- [ ] **2.4 Confirm GREEN** and commit:

```bash
git add lib/server/action-repository.ts tests/unit/action-repository.test.ts
git commit -m "feat: expose open recovery actions without changing resume rules [vercel skip]"
```

---

## Task 3 — Read-only Return-to-Origin availability

**Files**
- Modify: `lib/server/return-origin-gateway.ts`
- Modify: `tests/unit/return-origin-gateway.test.ts`

**Purpose**
The dashboard needs to know whether a partner-origin recovery customer could be offered a return without creating a return attempt and without exposing the destination.

Direct recovery does not call the partner gateway; its projection gets `returnState = unavailable/direct_recovery`.

- [ ] **3.1 Add RED tests** for a read-only availability contract:

```ts
type ReturnOriginAvailability =
  | { status: "unavailable"; reason: "recovery_unavailable" | "contract_unavailable"; partnerDisplayName: null }
  | { status: "blocked"; reason: ReturnOriginGatewayErrorCode; partnerDisplayName: string | null }
  | { status: "available"; reason: null; partnerDisplayName: string };
```

Tests must prove:
- fully gated sandbox partner journey -> `available`;
- gateway disabled, cooldown active, missing evidence, stale disclosure, Safe Mode and live hard-lock -> `blocked`;
- no usable contract -> `unavailable`;
- availability evaluation never calls `appendReturnAttempt()`;
- availability never exposes `destinationUrl`.

- [ ] **3.2 Confirm RED**

```bash
npm test -- tests/unit/return-origin-gateway.test.ts
```

- [ ] **3.3 Factor a shared private gate-context loader/evaluator** so both read-only availability and `createReturn()` use the same current-state checks.

For read-only availability, set `customerChoseReturn: true` only as a gate-completeness placeholder. This must not write anything.

- [ ] **3.4 Preserve the existing write path**
`createReturn()` must still:
- re-fetch current guidance;
- re-run every gate;
- accept explicit `customerChoice` only;
- append an auditable return attempt only after applicable checks;
- return a destination only from server-owned contract configuration.

- [ ] **3.5 Confirm GREEN** and commit:

```bash
git add lib/server/return-origin-gateway.ts tests/unit/return-origin-gateway.test.ts
git commit -m "refactor: expose read only return availability [vercel skip]"
```

---

## Task 4 — Evidence confidence and provenance from current data

**Files**
- Create: `lib/recovery/evidence.ts`
- Create: `tests/unit/recovery-evidence.test.ts`

**Inputs**
- `CreditProfile`
- `UserAccount[]`
- `MissionInstance[]`
- the new open action-attempt list
- `CreditPassport`

- [ ] **4.1 Write RED tests** for controlled evidence semantics:

```ts
expect(byKey(result, "electoral_roll")).toMatchObject({
  confidence: "confirmed",
  source: "customer",
});

expect(byKey(pendingRoll, "electoral_roll")).toMatchObject({
  confidence: "pending",
  source: "government_action",
});

expect(byKey(manualCard, "utilisation")).toMatchObject({
  confidence: "confirmed",
  source: "account",
});

expect(byKey(missingEvidence, "application_evidence")).toMatchObject({
  confidence: "unknown",
});
```

- [ ] **4.2 Reserve `verified` for future trusted external adapters.** Current manual/profile/account evidence must not be promoted to verified.

- [ ] **4.3 Implement controlled evidence categories only**: electoral roll/identity, utilisation/headroom where known, payment protection/direct debit, application cooldown/recent applications, revolving history, and material Passport unknown gaps.

Do not expose raw partner decline codes, support/vulnerability detail or commercial metadata.

- [ ] **4.4 Confirm GREEN** and commit:

```bash
git add lib/recovery/evidence.ts tests/unit/recovery-evidence.test.ts
git commit -m "feat: add recovery evidence confidence model [vercel skip]"
```

---

## Task 5 — Recovery hero and timeline UI

**Files**
- Create: `components/recovery/recovery-hero.tsx`
- Create: `tests/unit/recovery-experience-components.test.tsx`

- [ ] **5.1 Write RED component tests** for all five machine states.

Require:
- region accessible as `Your recovery plan`;
- exactly one dominant CTA in `action_required`;
- no fake CTA in waiting/reassessment/not-ready;
- five-step timeline with current step exposed accessibly;
- no wording such as `you will be approved` or `you now qualify`.

Example:

```ts
expect(screen.getByRole("region", { name: /your recovery plan/i })).toBeTruthy();
expect(screen.getByRole("link", { name: /start quest|take action/i }))
  .toHaveAttribute("href", "/actions/mission-instance-1");
expect(screen.queryByText(/you will be approved|you now qualify/i)).toBeNull();
```

- [ ] **5.2 Implement** `RecoveryHero` as presentation only, consuming `RecoveryExperienceProjection`.

Use existing Credit Quest visual primitives/styles. Render stage, headline, summary, grounded impact/effort/review timing, timeline and real reassessment date where available.

- [ ] **5.3 Confirm GREEN** and commit:

```bash
git add components/recovery/recovery-hero.tsx tests/unit/recovery-experience-components.test.tsx
git commit -m "feat: add recovery hero experience [vercel skip]"
```

---

## Task 6 — Recovery-aware seven-card dashboard and safe fallback

**Files**
- Create: `components/recovery/recovery-progress-card.tsx`
- Create: `components/recovery/recovery-next-card.tsx`
- Create: `components/recovery/recovery-evidence.tsx`
- Create: `components/recovery/recovery-fallback.tsx`
- Modify: `app/dashboard/page.tsx`
- Create: `tests/unit/recovery-dashboard-contract.test.ts`
- Modify: `tests/unit/recovery-experience-components.test.tsx`

- [ ] **6.1 Add RED dashboard contract tests** pinning:

```ts
expect(dashboardSource).toContain("FEED_CARD_TOTAL = 7");
expect(dashboardSource).toContain("RecoveryHero");
expect(dashboardSource).toContain("listOpenActionAttempts");
expect(dashboardSource).not.toContain("<RecoveryStatus");
```

- [ ] **6.2 Build the recovery projection only when an active recovery journey exists.**

Configured dashboard flow should:
1. keep `listPendingActionAttempts()` for the resumable-action card;
2. separately call `listOpenActionAttempts()` for recovery/evidence state;
3. derive evidence;
4. evaluate read-only partner return availability only for partner-origin recovery;
5. build `RecoveryExperienceProjection`;
6. render normal dashboard unchanged when there is no active recovery journey.

- [ ] **6.3 Recompose the seven-card feed for active recovery**

Exactly:
1. **Do this now**
2. **Why this matters**
3. **Your Credit Passport**
4. **Can I apply yet?**
5. **Learn in 20 seconds**
6. **Your recovery progress**
7. **What happens next**

Reuse `NextMissionCard`, `PassportCard`, `ReadinessCard`, `AcademyCard`, `QuestFeed` and `QuestFeedCard` where possible.

- [ ] **6.4 Remove the additive recovery panel** from active-recovery dashboard composition. Do not render both `RecoveryStatus` and the new recovery-first experience.

- [ ] **6.5 Eliminate generic recovery dead ends**
For active recovery, never show `You’re up to date for now.`. Resolve to waiting, reassessment, not-ready or ready-to-check with an explanation.

- [ ] **6.6 Add evidence UI** with customer-facing `Verified`, `Confirmed`, `Pending`, `Unknown` labels. Do not claim CRA/Open Banking is connected when no adapter exists.

- [ ] **6.7 Add fail-closed recovery fallback**
If an active recovery journey exists but optional projection enrichment fails, show:

```text
Your recovery plan
We can’t load the detailed recovery view right now.
Your core Credit Quest information is still available. No lender return will be attempted from this state.
```

Do not invent a next action or return route.

- [ ] **6.8 Confirm GREEN** and commit a deliberate Vercel checkpoint:

```bash
git add app/dashboard/page.tsx components/recovery tests/unit/recovery-dashboard-contract.test.ts tests/unit/recovery-experience-components.test.tsx
git commit -m "feat: make recovery drive the quest experience"
```

---

## Task 7 — Extend the existing Return-to-Origin card

**Files**
- Modify: `components/recovery/return-to-origin-card.tsx`
- Modify: `tests/unit/return-to-origin-card.test.tsx`
- Modify: `app/dashboard/page.tsx`
- Re-run: `tests/unit/return-origin-gateway.test.ts`

**Important:** This component already exists. Reuse and harden it; do not create a duplicate return UI.

- [ ] **7.1 Write RED tests** requiring:
- available state shows `Continue with [Partner]` and non-guarantee wording;
- blocked/unavailable state exposes no redirect action;
- component props never accept partner destination/environment/readiness as browser-owned inputs;
- continue/decline POST only `{ recoveryJourneyId, customerChoice }` to `/api/recovery/return`.

- [ ] **7.2 Preserve existing trust boundary**
On continue:

```ts
fetch("/api/recovery/return", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ recoveryJourneyId, customerChoice: "continue" }),
});
```

Navigate only to `destinationUrl` returned by the existing server route after success.

On decline, POST `customerChoice: "decline"` and keep the user inside Credit Quest.

- [ ] **7.3 Confirm existing gateway/API security tests remain GREEN.**

- [ ] **7.4 Commit**

```bash
git add components/recovery/return-to-origin-card.tsx tests/unit/return-to-origin-card.test.tsx app/dashboard/page.tsx tests/unit/return-origin-gateway.test.ts
git commit -m "feat: integrate recovery return surface [vercel skip]"
```

---

## Task 8 — Recovery-experience analytics

**Files**
- Modify: `lib/events.ts`
- Modify: `tests/unit/events.test.ts`
- Modify: `lib/recovery/events.ts`
- Modify: `tests/unit/recovery-analytics.test.ts`
- Modify only the client recovery components that emit presentation/action events

- [ ] **8.1 Add RED taxonomy tests** for controlled presentation events:

```text
recovery_hero_shown
recovery_state_shown
recovery_waiting_for_evidence
recovery_reassessment_due
```

Reuse existing recovery events for first action, reassessment, ready-to-check, return choice and return blocked rather than creating duplicates.

- [ ] **8.2 Keep analytics best-effort and observational.** Tracking failure must never block rendering, actions, readiness or return flow.

- [ ] **8.3 Restrict metadata** to stable recovery journey ID, machine state/stage and approved controlled values. No partner economics, support/vulnerability detail, raw financial values or approval probability.

- [ ] **8.4 Confirm GREEN** and commit:

```bash
git add lib/events.ts lib/recovery/events.ts tests/unit/events.test.ts tests/unit/recovery-analytics.test.ts components/recovery
git commit -m "feat: measure recovery experience [vercel skip]"
```

---

## Task 9 — E2E, regression and release verification

**Files**
- Modify: `tests/e2e/recovery.spec.ts`
- Modify: `tests/e2e/smoke.spec.ts` only where normal-dashboard preservation needs a stable assertion
- Modify: `README.md`

- [ ] **9.1 Add/retain scenario coverage** for:
  - normal user -> unchanged seven-card Credit Quest experience;
  - direct decline -> `action_required`;
  - partner decline -> context review -> action required;
  - electoral-roll submission with future review -> `waiting_for_evidence`;
  - due reassessment -> `reassessment_due`;
  - no current action + blocked readiness -> `not_ready` with explanation;
  - independent green readiness -> `ready_to_check`;
  - direct ready-to-check -> no invented original-lender route;
  - partner ready-to-check + blocked return -> readiness remains ready, return remains blocked;
  - available sandbox return -> explicit customer continue only;
  - customer declines return -> remains in Credit Quest;
  - recovery exit -> normal Build / Optimise / Maintain presentation resumes.

- [ ] **9.2 Run focused recovery suites**

```bash
npm test -- \
  tests/unit/action-repository.test.ts \
  tests/unit/recovery-domain.test.ts \
  tests/unit/recovery-orchestrator.test.ts \
  tests/unit/recovery-experience.test.ts \
  tests/unit/recovery-evidence.test.ts \
  tests/unit/recovery-experience-components.test.tsx \
  tests/unit/recovery-dashboard-contract.test.ts \
  tests/unit/return-to-origin-card.test.tsx \
  tests/unit/return-origin-gateway.test.ts \
  tests/unit/recovery-analytics.test.ts \
  tests/unit/events.test.ts
```

- [ ] **9.3 Run full verification**

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npm run test:e2e
npm run build
```

Run the same local Supabase verification as CI:

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

- [ ] **9.4 Architecture regression review**
Fail the tranche if any final diff:
- imports partner/commercial economics into mission/safety/readiness/Passport strategy;
- creates a second creditworthiness/readiness model;
- changes the Quest Feed count from seven;
- makes readiness depend on a return contract;
- introduces a browser-owned arbitrary return destination;
- enables any live/commercial/email dark default;
- converts unknown evidence into a known fact;
- presents CRA/Open Banking as connected without a real adapter;
- changes existing resumable-action semantics merely to support recovery waiting states.

- [ ] **9.5 Update README** with the explicit recovery state vocabulary, evidence-confidence boundary, preserved main Credit Quest lifecycle and Return-to-Origin separation.

- [ ] **9.6 Final reviewed commit** without `[vercel skip]` so Vercel verifies the exact review head once.
