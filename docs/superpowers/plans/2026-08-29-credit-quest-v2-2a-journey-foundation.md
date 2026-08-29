# Credit Quest V2.2A Journey Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an auditable downstream customer lifecycle, append-only outcome history, deterministic reassessment scheduling and clear “what changed / what next / when to return” feedback without changing safety, readiness, mission ranking or Academy selection.

**Architecture:** Introduce an isolated `lib/journey` domain plus server-owned Journey Repository/Orchestrator. Existing profile/account/safety/diagnosis/readiness/mission code remains authoritative. Journey observes those outputs, stores projections/history, and invokes the existing guidance service when a reassessment is due. It never feeds back into core strategy.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind CSS 4, Supabase Auth/Postgres/RLS, Zod 3, Vitest 3, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-29-credit-quest-v2-2-journey-growth-design.md`

## Global Constraints

- Do not rename or reuse existing `JourneyStage` (`setup | stabilise | build | optimise | maintain`). The new lifecycle type is `JourneyLifecycleStage`.
- `lib/domain/safety.ts`, `diagnosis.ts`, `passport.ts`, `readiness.ts`, `mission-engine.ts`, `quest-score.ts` and Academy selector must not import Journey code.
- Do not modify the known `hasRevolvingCredit === null` readiness behaviour in this work.
- Journey writes occur only after the corresponding core state change succeeds. A journey-write failure must not roll back a valid mission/profile/account change.
- Reassessment means re-running existing deterministic guidance from current evidence; Journey must not create alternative readiness rules.
- `journey_outcomes` is historical audit evidence: no UPDATE/DELETE path.
- Unknown readiness remains `unknown`; do not turn lack of evidence into improvement.
- All implementation tasks follow observed RED -> minimal GREEN -> refactor -> focused commit.
- Migration 009 is additive and must be verified through `supabase/tests/rls.sql` before production application.

---

## File Map

**Create**
- `lib/journey/types.ts`
- `lib/journey/state-machine.ts`
- `lib/server/journey-repository.ts`
- `lib/server/journey-orchestrator.ts`
- `components/journey/journey-status-card.tsx`
- `supabase/migrations/009_journey_foundation.sql`
- `tests/unit/journey-types.test.ts`
- `tests/unit/journey-state-machine.test.ts`
- `tests/unit/journey-repository.test.ts`
- `tests/unit/journey-orchestrator.test.ts`
- `tests/unit/journey-boundaries.test.ts`
- `tests/unit/journey-status-card.test.tsx`

**Modify**
- `supabase/tests/rls.sql`
- `app/api/onboarding/route.ts`
- `app/api/missions/[slug]/route.ts`
- `app/api/actions/attempts/[id]/route.ts`
- `app/dashboard/page.tsx`
- `components/dashboard/dashboard-client.tsx`
- `tests/e2e/smoke.spec.ts`
- `README.md`

---

### Task 1: Define lifecycle contracts and pure state derivation

**Files:** Create `lib/journey/types.ts`, `lib/journey/state-machine.ts`, tests `journey-types.test.ts`, `journey-state-machine.test.ts`.

**Interfaces:**

```ts
export type JourneyLifecycleStage =
  | "onboarding"
  | "active_mission"
  | "waiting"
  | "cooldown"
  | "reassessment_due"
  | "ready"
  | "optimising";

export type JourneyOutcomeType =
  | "onboarding_completed"
  | "mission_started"
  | "mission_completed"
  | "mission_deferred"
  | "action_submitted"
  | "action_verified"
  | "cooldown_started"
  | "cooldown_ended"
  | "reassessment_performed"
  | "readiness_changed";

export interface JourneyState {
  userId: string;
  stage: JourneyLifecycleStage;
  activeMissionId: string | null;
  nextReassessmentAt: string | null;
  lastReassessedAt: string | null;
  lastReadinessBand: ReadinessState | null;
  updatedAt: string;
}
```

- [ ] Write `journey-types.test.ts` importing the above types. Run `npm test -- tests/unit/journey-types.test.ts`; observe module-not-found RED.
- [ ] Implement `lib/journey/types.ts` exactly with serialisable contracts for `JourneyState`, `JourneyOutcome`, `JourneyOutcomeInput`, plus the controlled unions above. Re-run the test GREEN.
- [ ] Write state-machine RED tests for these deterministic cases:
  - no completed onboarding/profile -> `onboarding`;
  - active `started` mission -> `active_mission`;
  - `cooldown` mission before `nextReviewAt` -> `cooldown`;
  - any due `nextReviewAt <= now` -> `reassessment_due`;
  - no actionable mission + readiness green -> `ready`;
  - no actionable mission + non-green -> `waiting`;
  - completed work with green and no pending review -> `optimising` only when explicitly passed `hasCompletedMission: true` and no current mission.
- [ ] Implement a pure function:

```ts
export function deriveJourneyLifecycle(input: {
  readiness: ApplicationReadiness;
  activeMission: MissionInstance | null;
  nextReassessmentAt: string | null;
  hasCompletedMission: boolean;
  now: Date;
}): JourneyLifecycleStage
```

Do not import commercial/affiliate/offer code. Run `npm test -- tests/unit/journey-types.test.ts tests/unit/journey-state-machine.test.ts` GREEN.
- [ ] Commit: `feat: add journey lifecycle contracts`.

### Task 2: Add migration 009, owner RLS and append-only audit enforcement

**Files:** Create `supabase/migrations/009_journey_foundation.sql`; modify `supabase/tests/rls.sql`; create `tests/unit/journey-migration.test.ts`.

- [ ] Write a RED source-contract test asserting migration 009 exists and contains `journey_state`, `journey_outcomes`, owner SELECT policies, no authenticated writes, same-owner mission FK, due indexes and an immutable trigger.
- [ ] Run `npm test -- tests/unit/journey-migration.test.ts`; observe RED.
- [ ] Implement migration 009 with these exact invariants:

```sql
create table public.journey_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stage text not null,
  active_mission_id uuid,
  next_reassessment_at timestamptz,
  last_reassessed_at timestamptz,
  last_readiness_band text,
  updated_at timestamptz not null default now(),
  constraint journey_state_stage_check check (stage in ('onboarding','active_mission','waiting','cooldown','reassessment_due','ready','optimising')),
  constraint journey_state_readiness_check check (last_readiness_band is null or last_readiness_band in ('red','amber','green','unknown')),
  constraint journey_state_mission_owner_fkey foreign key (active_mission_id, user_id)
    references public.user_missions(id, user_id) on delete set null
);

create table public.journey_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  mission_instance_id uuid,
  source text not null,
  readiness_before text,
  readiness_after text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint journey_outcomes_type_check check (event_type in ('onboarding_completed','mission_started','mission_completed','mission_deferred','action_submitted','action_verified','cooldown_started','cooldown_ended','reassessment_performed','readiness_changed')),
  constraint journey_outcomes_source_check check (source in ('onboarding','mission','action','reassessment')),
  constraint journey_outcomes_before_check check (readiness_before is null or readiness_before in ('red','amber','green','unknown')),
  constraint journey_outcomes_after_check check (readiness_after is null or readiness_after in ('red','amber','green','unknown')),
  constraint journey_outcomes_mission_owner_fkey foreign key (mission_instance_id, user_id)
    references public.user_missions(id, user_id) on delete set null
);

create index journey_state_reassessment_due_idx on public.journey_state(next_reassessment_at) where next_reassessment_at is not null;
create index journey_outcomes_user_time_idx on public.journey_outcomes(user_id, occurred_at desc);
```

Add RLS `journey_state_select_own` and `journey_outcomes_select_own` to authenticated users. Revoke INSERT/UPDATE/DELETE from anon/authenticated on both tables. Server-owned writes use service role.

For outcomes immutability add `public.reject_journey_outcome_mutation()` trigger BEFORE UPDATE OR DELETE that always raises `journey_outcomes are append-only`; revoke execute from public/anon/authenticated and do not expose a mutation RPC.
- [ ] Extend `supabase/tests/rls.sql` to assert the policies/grants/FK/trigger and execute a rollback-only UPDATE probe that must raise the append-only exception.
- [ ] Run full local DB verification exactly as CI does (`supabase db start` then `psql ... -f supabase/tests/rls.sql`) and run the migration unit test GREEN.
- [ ] Commit: `feat: add journey foundation schema`.

### Task 3: Build Journey Repository with server-owned writes

**Files:** Create `lib/server/journey-repository.ts`, `tests/unit/journey-repository.test.ts`.

**Interfaces:**

```ts
export async function getJourneyState(supabase: SupabaseClient, userId: string): Promise<JourneyState | null>
export async function listRecentJourneyOutcomes(supabase: SupabaseClient, userId: string, limit?: number): Promise<JourneyOutcome[]>
export async function upsertJourneyState(admin: SupabaseClient, state: JourneyState): Promise<JourneyState>
export async function appendJourneyOutcome(admin: SupabaseClient, input: JourneyOutcomeInput): Promise<JourneyOutcome>
```

- [ ] Write RED mapper/query tests using a small chainable fake Supabase client; assert snake_case mapping, owner filter on reads, and no caller-supplied `user_id` override.
- [ ] Run `npm test -- tests/unit/journey-repository.test.ts`; observe missing-module RED.
- [ ] Implement mapping/select/upsert/insert only. `appendJourneyOutcome` inserts one row and never exposes update/delete.
- [ ] Ensure `lib/server/journey-repository.ts` imports `server-only` because its write helpers are intended for the admin/service client.
- [ ] Re-run focused tests GREEN and commit: `feat: add journey repository`.

### Task 4: Build Journey Orchestrator and reassessment semantics

**Files:** Create `lib/server/journey-orchestrator.ts`, `tests/unit/journey-orchestrator.test.ts`.

**Key API:**

```ts
export async function observeJourneyEvent(input: {
  userId: string;
  eventType: JourneyOutcomeType;
  source: JourneyOutcome["source"];
  missionInstanceId?: string | null;
  nextReviewAt?: string | null;
  now?: Date;
}): Promise<void>

export async function reassessJourneyForUser(input: {
  userId: string;
  now?: Date;
}): Promise<JourneyReassessmentResult | null>
```

Both functions create the service client internally only after the caller has authenticated/authorised the `userId`; never accept a browser-supplied user id directly through an API body.

- [ ] RED tests: observing a mission completion appends outcome and stores existing `nextReviewAt`; observing cooldown stores `cooldown`; duplicate observation uses deterministic dedupe metadata only if the exact state transition is repeated in one request; reassessment calls existing `getCreditGuidanceForUser`; a red->amber/amber->green/etc change appends both `reassessment_performed` and `readiness_changed`; unchanged readiness appends only reassessment; unknown remains unknown.
- [ ] Add a test that source text of the orchestrator contains no `offer-matcher`, `affiliate`, `commission`, `epc`, `payout`, `revenue` or `campaign`.
- [ ] Implement with injected internal helpers where needed for testing. Read existing journey state first, use current `getCreditGuidanceForUser`, list/sync missions through existing repositories, derive lifecycle via Task 1, then upsert the projection and append outcomes.
- [ ] Reassessment date precedence: an explicit mission/action `nextReviewAt` is stored; otherwise no date is invented. Do not add a generic “30 days” timer to readiness.
- [ ] Catch Journey persistence failures at integration call sites, not inside the repository. The orchestrator itself should throw on failed writes so callers can deliberately best-effort it.
- [ ] Run focused tests GREEN and commit: `feat: add journey orchestrator`.

### Task 5: Observe existing onboarding, mission and action outcomes without changing core success semantics

**Files:** Modify `app/api/onboarding/route.ts`, `app/api/missions/[slug]/route.ts`, `app/api/actions/attempts/[id]/route.ts`; create `tests/unit/journey-hooks.test.ts`.

- [ ] Write source/integration RED tests proving the hook happens after the core write and that each route catches Journey failure instead of returning a core failure.
- [ ] On successful configured onboarding, call `observeJourneyEvent({ eventType: "onboarding_completed", source: "onboarding" })` after profile upsert.
- [ ] On legacy mission start/complete/defer, call the matching outcome after the mission write. Do not record completion if the mission route did not actually complete.
- [ ] On Action Layer response, map `outcome.missionState`/`attemptStatus` to `action_submitted`, `action_verified`, `mission_completed`, `mission_deferred` or `cooldown_started` only after account/profile/mission/attempt writes succeed.
- [ ] Wrap each call as best effort:

```ts
try {
  await observeJourneyEvent({...});
} catch {
  // Journey observation must not invalidate a successful core action.
}
```

- [ ] Run existing action API/lifecycle tests plus `journey-hooks.test.ts` GREEN. Commit: `feat: observe core journey outcomes`.

### Task 6: Show journey feedback on the existing seven-card experience

**Files:** Create `components/journey/journey-status-card.tsx`, `tests/unit/journey-status-card.test.tsx`; modify `app/dashboard/page.tsx`, `components/dashboard/dashboard-client.tsx`.

- [ ] RED component tests for four cases: upcoming reassessment, readiness improved, readiness unchanged, unknown evidence. Copy must answer “what changed / what next / when” and never say “approved”, “approval odds”, or claim unsupported causation.
- [ ] Implement `JourneyStatusCard` as a compact section above the existing Quest Feed, not an eighth feed card. Preserve `FEED_CARD_TOTAL = 7`.
- [ ] Server dashboard: read Journey state/recent outcomes. If `nextReassessmentAt <= now`, best-effort call `reassessJourneyForUser`, then reload state/outcomes. If journey tables are unavailable during a dark deploy, catch and render no Journey status; the existing dashboard must still render.
- [ ] Demo dashboard: add a deterministic local-only journey summary derived from existing demo progress. Do not pretend it has persisted server outcomes.
- [ ] Remove no existing Safe Mode, Readiness, Passport or Academy card.
- [ ] Run component tests and existing dashboard tests GREEN. Commit: `feat: surface journey status`.

### Task 7: Architecture guardrails, E2E and close-out verification

**Files:** Create `tests/unit/journey-boundaries.test.ts`; modify `tests/e2e/smoke.spec.ts`, `README.md`.

- [ ] RED architecture test scans `lib/domain/safety.ts`, `diagnosis.ts`, `passport.ts`, `readiness.ts`, `mission-engine.ts`, `quest-score.ts` and `lib/academy/selector.ts`; assert none import `@/lib/journey`, `journey-repository`, `journey-orchestrator`, `commercial`, `revenue`, `affiliate` or `campaign`.
- [ ] Add explicit regression assertion that `lib/domain/readiness.ts` is unchanged around the known `hasRevolvingCredit === null` edge case; do not “fix” it in this plan.
- [ ] Extend E2E without changing the seven-card count. In demo mode verify a completed local mission updates the visible Journey status. Add configured-mode unit/integration coverage for persisted reassessment rather than trying to fabricate Supabase auth in demo E2E.
- [ ] Update README with migration 009 and dependency direction.
- [ ] Run final gate:

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
```

Also run local Supabase reset/RLS verification. Every command must be green before this stage is marked complete.
- [ ] Commit: `test: verify V2.2A journey foundation`.

## V2.2A Exit Gate

V2.2A is ready for the next stage only when migration 009 is additive/RLS-verified, core routes still succeed if Journey observation fails, due reassessment uses the existing guidance engine, the dashboard remains seven cards, and architecture tests prove Journey/commercial concepts cannot enter core strategy.
