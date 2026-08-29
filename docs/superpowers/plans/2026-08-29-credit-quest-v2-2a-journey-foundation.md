# Credit Quest V2.2A Journey Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an auditable downstream customer lifecycle, append-only outcome history, deterministic reassessment scheduling and clear “what changed / what next / when to return” feedback without changing safety, readiness, mission ranking or Academy selection.

**Architecture:** Introduce an isolated `lib/journey` domain plus server-owned Journey Repository/Orchestrator. Existing profile/account/safety/diagnosis/readiness/mission code remains authoritative. Journey observes those outputs, stores projections/history, and invokes the existing guidance service when a reassessment is due. It never feeds back into core strategy.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind CSS 4, Supabase Auth/Postgres/RLS, Zod 3, Vitest 3, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-29-credit-quest-v2-2-journey-growth-design.md`

## Global Constraints

- Do not rename or reuse existing `JourneyStage` (`setup | stabilise | build | optimise | maintain`). The new lifecycle type is `JourneyLifecycleStage`.
- `lib/domain/safety.ts`, `diagnosis.ts`, `passport.ts`, `readiness.ts`, `mission-engine.ts`, `quest-score.ts` and `lib/academy/selector.ts` must not import Journey code.
- Do not modify the known `hasRevolvingCredit === null` readiness behaviour in this work.
- Journey writes occur only after the corresponding core state change succeeds. A Journey-write failure must not roll back a valid mission/profile/account change.
- Reassessment means re-running existing deterministic guidance from current evidence; Journey must not create alternative readiness rules.
- `journey_outcomes` is historical audit evidence: application code has no UPDATE/DELETE method; UPDATE is rejected at DB level; service-role DELETE remains available solely for deliberate data-erasure/account-deletion workflows.
- Corrections to Journey history append compensating records rather than rewriting prior evidence.
- Unknown readiness remains `unknown`; do not turn lack of evidence into improvement.
- The Quest Feed stays exactly seven cards. Journey status is outside the feed.
- Every implementation task follows observed RED -> minimal GREEN -> refactor -> focused commit.
- Migration 009 is additive and must pass `supabase/tests/rls.sql` before production application.

---

## File Map

### New Journey domain/data files
- `lib/journey/types.ts` — serialisable lifecycle/outcome contracts.
- `lib/journey/state-machine.ts` — pure lifecycle derivation only.
- `lib/server/journey-repository.ts` — owner-scoped reads and service-role writes.
- `lib/server/journey-orchestrator.ts` — best-effort downstream observation and deterministic reassessment.
- `supabase/migrations/009_journey_foundation.sql` — lifecycle projection, audit history, RLS, idempotency.

### New presentation
- `components/journey/journey-status-card.tsx` — compact “what changed / what next / when” status above Quest Feed.

### Existing files to modify
- `app/api/onboarding/route.ts`
- `app/api/missions/[slug]/route.ts`
- `app/api/actions/attempts/[id]/route.ts`
- `app/dashboard/page.tsx`
- `components/dashboard/dashboard-client.tsx`
- `supabase/tests/rls.sql`
- `tests/e2e/smoke.spec.ts`
- `README.md`

### New tests
- `tests/unit/journey-types.test.ts`
- `tests/unit/journey-state-machine.test.ts`
- `tests/unit/journey-migration.test.ts`
- `tests/unit/journey-repository.test.ts`
- `tests/unit/journey-orchestrator.test.ts`
- `tests/unit/journey-hooks.test.ts`
- `tests/unit/journey-status-card.test.tsx`
- `tests/unit/journey-boundaries.test.ts`

---

### Task 1: Add Journey contracts and pure lifecycle derivation

**Files:**
- Create: `lib/journey/types.ts`
- Create: `lib/journey/state-machine.ts`
- Test: `tests/unit/journey-types.test.ts`
- Test: `tests/unit/journey-state-machine.test.ts`

**Interfaces:**
- Produces `JourneyLifecycleStage`, `JourneyOutcomeType`, `JourneyOutcomeSource`, `JourneyState`, `JourneyOutcome`, `JourneyOutcomeInput`.
- Produces `deriveJourneyLifecycle(input): JourneyLifecycleStage`.
- Consumed by Tasks 2–7.

- [ ] **Step 1: Write the failing contract test**

Create `tests/unit/journey-types.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type {
  JourneyOutcomeInput,
  JourneyState,
} from "@/lib/journey/types";

function acceptsState(value: JourneyState) { return value; }
function acceptsOutcome(value: JourneyOutcomeInput) { return value; }

describe("Journey contracts", () => {
  it("keeps lifecycle and outcome records serialisable", () => {
    const state = acceptsState({
      userId: "00000000-0000-0000-0000-000000000001",
      stage: "reassessment_due",
      activeMissionId: null,
      nextReassessmentAt: "2026-09-01T08:00:00.000Z",
      lastReassessedAt: null,
      lastReadinessBand: "amber",
      updatedAt: "2026-08-29T08:00:00.000Z",
    });
    expect(state.stage).toBe("reassessment_due");

    const outcome = acceptsOutcome({
      userId: state.userId,
      eventType: "mission_completed",
      source: "mission",
      sourceKey: "mission:abc:completed:2026-08-29T08:00:00.000Z",
      missionInstanceId: "00000000-0000-0000-0000-000000000002",
      readinessBefore: "amber",
      readinessAfter: "amber",
      metadata: { missionSlug: "application-cooldown" },
      occurredAt: "2026-08-29T08:00:00.000Z",
    });
    expect(outcome.sourceKey).toContain("mission:");
  });
});
```

- [ ] **Step 2: Run the contract test and observe RED**

Run:

```bash
npm test -- tests/unit/journey-types.test.ts
```

Expected: FAIL because `@/lib/journey/types` does not exist.

- [ ] **Step 3: Implement the serialisable Journey contracts**

Create `lib/journey/types.ts`:

```ts
import type { ReadinessState } from "@/lib/domain/types";

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

export type JourneyOutcomeSource =
  | "onboarding"
  | "mission"
  | "action"
  | "reassessment";

export interface JourneyState {
  userId: string;
  stage: JourneyLifecycleStage;
  activeMissionId: string | null;
  nextReassessmentAt: string | null;
  lastReassessedAt: string | null;
  lastReadinessBand: ReadinessState | null;
  updatedAt: string;
}

export interface JourneyOutcome {
  id: string;
  userId: string;
  eventType: JourneyOutcomeType;
  source: JourneyOutcomeSource;
  sourceKey: string;
  missionInstanceId: string | null;
  readinessBefore: ReadinessState | null;
  readinessAfter: ReadinessState | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface JourneyOutcomeInput {
  userId: string;
  eventType: JourneyOutcomeType;
  source: JourneyOutcomeSource;
  sourceKey: string;
  missionInstanceId?: string | null;
  readinessBefore?: ReadinessState | null;
  readinessAfter?: ReadinessState | null;
  metadata?: Record<string, unknown>;
  occurredAt: string;
}
```

- [ ] **Step 4: Run the contract test and verify GREEN**

Run:

```bash
npm test -- tests/unit/journey-types.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write the lifecycle state-machine tests and observe RED**

Create `tests/unit/journey-state-machine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveJourneyLifecycle } from "@/lib/journey/state-machine";
import type { ApplicationReadiness, MissionInstance } from "@/lib/domain/types";

function readiness(state: ApplicationReadiness["state"]): ApplicationReadiness {
  return {
    state,
    headline: state,
    reasons: [],
    avoid: [],
    actions: [],
    reassessAt: null,
    daysUntilReassessment: null,
  };
}

function mission(state: MissionInstance["state"], nextReviewAt: string | null = null): MissionInstance {
  return {
    id: "m1",
    userId: "u1",
    missionSlug: "application-cooldown",
    subject: { kind: "profile" },
    state,
    startedAt: "2026-08-01T00:00:00.000Z",
    completedAt: null,
    nextReviewAt,
  };
}

const now = new Date("2026-08-29T08:00:00.000Z");

describe("deriveJourneyLifecycle", () => {
  it("prioritises a due reassessment", () => {
    expect(deriveJourneyLifecycle({
      readiness: readiness("amber"),
      activeMission: mission("cooldown", "2026-08-29T07:59:00.000Z"),
      nextReassessmentAt: "2026-08-29T07:59:00.000Z",
      hasCompletedMission: false,
      onboardingComplete: true,
      now,
    })).toBe("reassessment_due");
  });

  it("keeps an undued cooldown in cooldown", () => {
    expect(deriveJourneyLifecycle({
      readiness: readiness("red"),
      activeMission: mission("cooldown", "2026-09-29T08:00:00.000Z"),
      nextReassessmentAt: "2026-09-29T08:00:00.000Z",
      hasCompletedMission: false,
      onboardingComplete: true,
      now,
    })).toBe("cooldown");
  });

  it("uses active_mission for a started mission", () => {
    expect(deriveJourneyLifecycle({
      readiness: readiness("amber"),
      activeMission: mission("started"),
      nextReassessmentAt: null,
      hasCompletedMission: false,
      onboardingComplete: true,
      now,
    })).toBe("active_mission");
  });

  it("uses onboarding before onboarding is complete", () => {
    expect(deriveJourneyLifecycle({
      readiness: readiness("unknown"),
      activeMission: null,
      nextReassessmentAt: null,
      hasCompletedMission: false,
      onboardingComplete: false,
      now,
    })).toBe("onboarding");
  });

  it("uses ready for green with no pending work", () => {
    expect(deriveJourneyLifecycle({
      readiness: readiness("green"),
      activeMission: null,
      nextReassessmentAt: null,
      hasCompletedMission: false,
      onboardingComplete: true,
      now,
    })).toBe("ready");
  });

  it("uses optimising after completed work when still green", () => {
    expect(deriveJourneyLifecycle({
      readiness: readiness("green"),
      activeMission: null,
      nextReassessmentAt: null,
      hasCompletedMission: true,
      onboardingComplete: true,
      now,
    })).toBe("optimising");
  });

  it("uses waiting for non-green with no active work", () => {
    expect(deriveJourneyLifecycle({
      readiness: readiness("unknown"),
      activeMission: null,
      nextReassessmentAt: null,
      hasCompletedMission: false,
      onboardingComplete: true,
      now,
    })).toBe("waiting");
  });
});
```

Run:

```bash
npm test -- tests/unit/journey-state-machine.test.ts
```

Expected: FAIL because `@/lib/journey/state-machine` does not exist.

- [ ] **Step 6: Implement the pure lifecycle state machine**

Create `lib/journey/state-machine.ts`:

```ts
import type { ApplicationReadiness, MissionInstance } from "@/lib/domain/types";
import type { JourneyLifecycleStage } from "@/lib/journey/types";

export function deriveJourneyLifecycle(input: {
  readiness: ApplicationReadiness;
  activeMission: MissionInstance | null;
  nextReassessmentAt: string | null;
  hasCompletedMission: boolean;
  onboardingComplete: boolean;
  now: Date;
}): JourneyLifecycleStage {
  if (!input.onboardingComplete) return "onboarding";

  if (
    input.nextReassessmentAt &&
    new Date(input.nextReassessmentAt).getTime() <= input.now.getTime()
  ) {
    return "reassessment_due";
  }

  if (input.activeMission?.state === "cooldown") return "cooldown";
  if (input.activeMission?.state === "started") return "active_mission";

  if (input.readiness.state === "green") {
    return input.hasCompletedMission ? "optimising" : "ready";
  }

  return "waiting";
}
```

Do not add commercial, affiliate, Academy or offer imports.

- [ ] **Step 7: Run both Journey domain tests and verify GREEN**

Run:

```bash
npm test -- tests/unit/journey-types.test.ts tests/unit/journey-state-machine.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

```bash
git add lib/journey/types.ts lib/journey/state-machine.ts tests/unit/journey-types.test.ts tests/unit/journey-state-machine.test.ts
git commit -m "feat: add journey lifecycle contracts"
```

---

### Task 2: Add migration 009, RLS, idempotency and audit immutability

**Files:**
- Create: `supabase/migrations/009_journey_foundation.sql`
- Modify: `supabase/tests/rls.sql`
- Test: `tests/unit/journey-migration.test.ts`

**Interfaces:**
- Produces DB tables `journey_state`, `journey_outcomes`.
- `journey_state` is a mutable current projection.
- `journey_outcomes` is insert-only from application code, update-rejected by DB, unique by `(user_id, source_key)`.
- Consumed by Task 3 onward.

- [ ] **Step 1: Write the failing migration contract test**

Create `tests/unit/journey-migration.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "supabase/migrations/009_journey_foundation.sql");

describe("V2.2A Journey migration", () => {
  it("creates owner-readable, server-written, idempotent Journey state and history", () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("create table public.journey_state");
    expect(sql).toContain("create table public.journey_outcomes");
    expect(sql).toContain("journey_state_select_own");
    expect(sql).toContain("journey_outcomes_select_own");
    expect(sql).toContain("unique (user_id, source_key)");
    expect(sql).toContain("journey_state_mission_owner_fkey");
    expect(sql).toContain("journey_outcomes_mission_owner_fkey");
    expect(sql).toContain("reject_journey_outcome_update");
    expect(sql).toContain("revoke insert, update, delete on public.journey_state from authenticated");
    expect(sql).toContain("revoke insert, update, delete on public.journey_outcomes from authenticated");
  });
});
```

- [ ] **Step 2: Run the migration test and observe RED**

```bash
npm test -- tests/unit/journey-migration.test.ts
```

Expected: FAIL because migration 009 does not exist.

- [ ] **Step 3: Create migration 009**

Create `supabase/migrations/009_journey_foundation.sql`:

```sql
create table public.journey_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stage text not null,
  active_mission_id uuid,
  next_reassessment_at timestamptz,
  last_reassessed_at timestamptz,
  last_readiness_band text,
  updated_at timestamptz not null default now(),
  constraint journey_state_stage_check
    check (stage in ('onboarding','active_mission','waiting','cooldown','reassessment_due','ready','optimising')),
  constraint journey_state_readiness_check
    check (last_readiness_band is null or last_readiness_band in ('red','amber','green','unknown')),
  constraint journey_state_mission_owner_fkey
    foreign key (active_mission_id, user_id)
    references public.user_missions(id, user_id)
    on delete set null (active_mission_id)
);

create table public.journey_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  source text not null,
  source_key text not null,
  mission_instance_id uuid,
  readiness_before text,
  readiness_after text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint journey_outcomes_type_check
    check (event_type in ('onboarding_completed','mission_started','mission_completed','mission_deferred','action_submitted','action_verified','cooldown_started','cooldown_ended','reassessment_performed','readiness_changed')),
  constraint journey_outcomes_source_check
    check (source in ('onboarding','mission','action','reassessment')),
  constraint journey_outcomes_before_check
    check (readiness_before is null or readiness_before in ('red','amber','green','unknown')),
  constraint journey_outcomes_after_check
    check (readiness_after is null or readiness_after in ('red','amber','green','unknown')),
  constraint journey_outcomes_source_unique unique (user_id, source_key),
  constraint journey_outcomes_mission_owner_fkey
    foreign key (mission_instance_id, user_id)
    references public.user_missions(id, user_id)
    on delete set null (mission_instance_id)
);

create index journey_state_reassessment_due_idx
  on public.journey_state(next_reassessment_at)
  where next_reassessment_at is not null;

create index journey_outcomes_user_time_idx
  on public.journey_outcomes(user_id, occurred_at desc);

alter table public.journey_state enable row level security;
alter table public.journey_outcomes enable row level security;

create policy "journey_state_select_own" on public.journey_state
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "journey_outcomes_select_own" on public.journey_outcomes
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.journey_state from anon;
revoke all on public.journey_outcomes from anon;
revoke insert, update, delete on public.journey_state from authenticated;
revoke insert, update, delete on public.journey_outcomes from authenticated;
grant select on public.journey_state to authenticated;
grant select on public.journey_outcomes to authenticated;
grant all on public.journey_state to service_role;
grant all on public.journey_outcomes to service_role;

create or replace function public.reject_journey_outcome_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'journey_outcomes are append-only';
end;
$$;

revoke all on function public.reject_journey_outcome_update() from public;

create trigger journey_outcomes_reject_update
before update on public.journey_outcomes
for each row execute function public.reject_journey_outcome_update();
```

Do not add a DELETE-rejection trigger: authenticated users have no DELETE grant, repository code has no delete method, and service-role account/data erasure must remain possible.

- [ ] **Step 4: Extend the SQL verification file**

Append to the first verification `do $$ ... end $$;` block in `supabase/tests/rls.sql`:

```sql
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'journey_state'
      and policyname = 'journey_state_select_own'
      and cmd = 'SELECT'
  ) then
    raise exception 'Journey state owner-select policy missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'journey_outcomes'
      and policyname = 'journey_outcomes_select_own'
      and cmd = 'SELECT'
  ) then
    raise exception 'Journey outcomes owner-select policy missing';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('journey_state','journey_outcomes')
      and grantee in ('anon','authenticated')
      and privilege_type in ('INSERT','UPDATE','DELETE')
  ) then
    raise exception 'Journey client write grant must not exist';
  end if;
```

Add a rollback-only immutability probe after the policy block:

```sql
do $$
declare
  probe_user uuid := gen_random_uuid();
  probe_id uuid;
begin
  insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values (probe_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'journey-probe@example.com', '', now(), now(), now());

  insert into public.journey_outcomes(user_id, event_type, source, source_key)
  values (probe_user, 'onboarding_completed', 'onboarding', 'rls-probe')
  returning id into probe_id;

  begin
    update public.journey_outcomes
    set metadata = '{"changed":true}'::jsonb
    where id = probe_id;
    raise exception 'Journey outcome update unexpectedly succeeded';
  exception
    when others then
      if sqlerrm = 'Journey outcome update unexpectedly succeeded' then
        raise;
      end if;
  end;
end $$;
```

Because the file ends in `rollback;`, the probe leaves no data behind.

- [ ] **Step 5: Run source and local DB checks**

Run:

```bash
npm test -- tests/unit/journey-migration.test.ts
```

Expected: PASS.

Then run the same local database verification as CI:

```bash
supabase db start
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f supabase/tests/rls.sql
supabase stop --no-backup
```

Expected: migration chain applies and SQL verification exits 0.

- [ ] **Step 6: Commit Task 2**

```bash
git add supabase/migrations/009_journey_foundation.sql supabase/tests/rls.sql tests/unit/journey-migration.test.ts
git commit -m "feat: add journey foundation schema"
```

---

### Task 3: Add Journey Repository with owner reads and idempotent server writes

**Files:**
- Create: `lib/server/journey-repository.ts`
- Test: `tests/unit/journey-repository.test.ts`

**Interfaces:**

```ts
getJourneyState(supabase, userId): Promise<JourneyState | null>
listRecentJourneyOutcomes(supabase, userId, limit?): Promise<JourneyOutcome[]>
upsertJourneyState(admin, state): Promise<JourneyState>
appendJourneyOutcome(admin, input): Promise<JourneyOutcome>
```

- [ ] **Step 1: Write failing repository mapper tests**

Create `tests/unit/journey-repository.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  mapJourneyOutcomeRow,
  mapJourneyStateRow,
} from "@/lib/server/journey-repository";

describe("Journey Repository row mapping", () => {
  it("maps journey_state snake case safely", () => {
    expect(mapJourneyStateRow({
      user_id: "u1",
      stage: "waiting",
      active_mission_id: null,
      next_reassessment_at: null,
      last_reassessed_at: null,
      last_readiness_band: "unknown",
      updated_at: "2026-08-29T08:00:00.000Z",
    })).toEqual({
      userId: "u1",
      stage: "waiting",
      activeMissionId: null,
      nextReassessmentAt: null,
      lastReassessedAt: null,
      lastReadinessBand: "unknown",
      updatedAt: "2026-08-29T08:00:00.000Z",
    });
  });

  it("maps journey outcome history", () => {
    expect(mapJourneyOutcomeRow({
      id: "o1",
      user_id: "u1",
      event_type: "reassessment_performed",
      source: "reassessment",
      source_key: "reassessment:u1:2026-09-01T08:00:00.000Z",
      mission_instance_id: null,
      readiness_before: "amber",
      readiness_after: "green",
      metadata: {},
      occurred_at: "2026-09-01T08:00:00.000Z",
    }).readinessAfter).toBe("green");
  });
});
```

- [ ] **Step 2: Run the repository test and observe RED**

```bash
npm test -- tests/unit/journey-repository.test.ts
```

Expected: FAIL because `journey-repository.ts` does not exist.

- [ ] **Step 3: Implement row mappers and repository functions**

Create `lib/server/journey-repository.ts`:

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  JourneyOutcome,
  JourneyOutcomeInput,
  JourneyState,
} from "@/lib/journey/types";

export function mapJourneyStateRow(row: Record<string, unknown>): JourneyState {
  return {
    userId: String(row.user_id),
    stage: row.stage as JourneyState["stage"],
    activeMissionId: row.active_mission_id ? String(row.active_mission_id) : null,
    nextReassessmentAt: row.next_reassessment_at ? String(row.next_reassessment_at) : null,
    lastReassessedAt: row.last_reassessed_at ? String(row.last_reassessed_at) : null,
    lastReadinessBand: (row.last_readiness_band ?? null) as JourneyState["lastReadinessBand"],
    updatedAt: String(row.updated_at),
  };
}

export function mapJourneyOutcomeRow(row: Record<string, unknown>): JourneyOutcome {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    eventType: row.event_type as JourneyOutcome["eventType"],
    source: row.source as JourneyOutcome["source"],
    sourceKey: String(row.source_key),
    missionInstanceId: row.mission_instance_id ? String(row.mission_instance_id) : null,
    readinessBefore: (row.readiness_before ?? null) as JourneyOutcome["readinessBefore"],
    readinessAfter: (row.readiness_after ?? null) as JourneyOutcome["readinessAfter"],
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    occurredAt: String(row.occurred_at),
  };
}

export async function getJourneyState(
  supabase: SupabaseClient,
  userId: string,
): Promise<JourneyState | null> {
  const { data, error } = await supabase
    .from("journey_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapJourneyStateRow(data as Record<string, unknown>) : null;
}

export async function listRecentJourneyOutcomes(
  supabase: SupabaseClient,
  userId: string,
  limit = 20,
): Promise<JourneyOutcome[]> {
  const safeLimit = Math.max(1, Math.min(100, limit));
  const { data, error } = await supabase
    .from("journey_outcomes")
    .select("*")
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .limit(safeLimit);
  if (error) throw error;
  return (data ?? []).map((row) => mapJourneyOutcomeRow(row as Record<string, unknown>));
}

export async function upsertJourneyState(
  admin: SupabaseClient,
  state: JourneyState,
): Promise<JourneyState> {
  const { data, error } = await admin
    .from("journey_state")
    .upsert({
      user_id: state.userId,
      stage: state.stage,
      active_mission_id: state.activeMissionId,
      next_reassessment_at: state.nextReassessmentAt,
      last_reassessed_at: state.lastReassessedAt,
      last_readiness_band: state.lastReadinessBand,
      updated_at: state.updatedAt,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapJourneyStateRow(data as Record<string, unknown>);
}

export async function appendJourneyOutcome(
  admin: SupabaseClient,
  input: JourneyOutcomeInput,
): Promise<JourneyOutcome> {
  const payload = {
    user_id: input.userId,
    event_type: input.eventType,
    source: input.source,
    source_key: input.sourceKey,
    mission_instance_id: input.missionInstanceId ?? null,
    readiness_before: input.readinessBefore ?? null,
    readiness_after: input.readinessAfter ?? null,
    metadata: input.metadata ?? {},
    occurred_at: input.occurredAt,
  };

  const inserted = await admin
    .from("journey_outcomes")
    .insert(payload)
    .select("*")
    .maybeSingle();

  if (!inserted.error && inserted.data) {
    return mapJourneyOutcomeRow(inserted.data as Record<string, unknown>);
  }

  const existing = await admin
    .from("journey_outcomes")
    .select("*")
    .eq("user_id", input.userId)
    .eq("source_key", input.sourceKey)
    .maybeSingle();
  if (existing.error || !existing.data) throw inserted.error ?? existing.error;
  return mapJourneyOutcomeRow(existing.data as Record<string, unknown>);
}
```

Implementation review requirement: only treat an insert error as idempotent when the subsequent exact `(user_id, source_key)` lookup succeeds. Otherwise throw the original error.

- [ ] **Step 4: Run repository tests and verify GREEN**

```bash
npm test -- tests/unit/journey-repository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add query-behaviour tests**

Extend `journey-repository.test.ts` with a chainable fake Supabase client matching the existing repository test style. Verify:
- `getJourneyState` calls `.eq("user_id", "u1")`.
- `listRecentJourneyOutcomes(..., 1000)` caps `.limit(100)`.
- `appendJourneyOutcome` writes `user_id` only from `input.userId` and never merges arbitrary DB-shaped metadata into top-level columns.
- no exported function named `updateJourneyOutcome` or `deleteJourneyOutcome` exists.

Run:

```bash
npm test -- tests/unit/journey-repository.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add lib/server/journey-repository.ts tests/unit/journey-repository.test.ts
git commit -m "feat: add journey repository"
```

---

### Task 4: Add Journey Orchestrator and deterministic reassessment

**Files:**
- Create: `lib/server/journey-orchestrator.ts`
- Test: `tests/unit/journey-orchestrator.test.ts`

**Interfaces:**

```ts
observeJourneyEvent(input): Promise<JourneyOutcome>
reassessJourneyForUser(input): Promise<JourneyReassessmentResult | null>
```

- [ ] **Step 1: Write failing orchestrator tests for outcome idempotency**

Create `tests/unit/journey-orchestrator.test.ts` with dependency injection so tests never need a real Supabase instance:

```ts
import { describe, expect, it, vi } from "vitest";
import { createJourneyOrchestrator } from "@/lib/server/journey-orchestrator";

describe("Journey Orchestrator", () => {
  it("persists one stable mission outcome and updates the projection", async () => {
    const appendOutcome = vi.fn().mockResolvedValue({ id: "o1" });
    const upsertState = vi.fn().mockResolvedValue({ userId: "u1" });
    const orchestrator = createJourneyOrchestrator({
      appendOutcome,
      upsertState,
      getState: vi.fn().mockResolvedValue(null),
      getGuidance: vi.fn(),
      getMissionContext: vi.fn().mockResolvedValue({
        activeMission: null,
        hasCompletedMission: true,
        onboardingComplete: true,
      }),
    });

    await orchestrator.observeJourneyEvent({
      userId: "u1",
      eventType: "mission_completed",
      source: "mission",
      sourceKey: "mission:m1:completed:2026-08-29T08:00:00.000Z",
      missionInstanceId: "m1",
      nextReviewAt: "2026-09-29T08:00:00.000Z",
      now: new Date("2026-08-29T08:00:00.000Z"),
    });

    expect(appendOutcome).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: "mission:m1:completed:2026-08-29T08:00:00.000Z",
    }));
    expect(upsertState).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/journey-orchestrator.test.ts
```

Expected: FAIL because `journey-orchestrator.ts` does not exist.

- [ ] **Step 3: Implement the dependency-injected orchestrator factory**

Create `lib/server/journey-orchestrator.ts` with:

```ts
import "server-only";
import { getAgeMode } from "@/lib/domain/age-gate";
import { assessApplicationReadiness } from "@/lib/domain/readiness";
import { assessSafety } from "@/lib/domain/safety";
import { deriveJourneyLifecycle } from "@/lib/journey/state-machine";
import type {
  JourneyOutcome,
  JourneyOutcomeInput,
  JourneyOutcomeSource,
  JourneyOutcomeType,
  JourneyState,
} from "@/lib/journey/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCreditGuidanceForUser } from "@/lib/server/credit-guidance-service";
import {
  appendJourneyOutcome,
  getJourneyState,
  upsertJourneyState,
} from "@/lib/server/journey-repository";

export interface JourneyReassessmentResult {
  before: JourneyState["lastReadinessBand"];
  after: JourneyState["lastReadinessBand"];
  changed: boolean;
  state: JourneyState;
}

interface JourneyOrchestratorDeps {
  appendOutcome: typeof appendJourneyOutcome extends (...args: infer P) => infer R
    ? (input: P[1]) => R
    : never;
  upsertState: (state: JourneyState) => Promise<JourneyState>;
  getState: (userId: string) => Promise<JourneyState | null>;
  getGuidance: typeof getCreditGuidanceForUser;
  getMissionContext: (userId: string) => Promise<{
    activeMission: import("@/lib/domain/types").MissionInstance | null;
    hasCompletedMission: boolean;
    onboardingComplete: boolean;
  }>;
}

export function createJourneyOrchestrator(deps: JourneyOrchestratorDeps) {
  return {
    async observeJourneyEvent(input: {
      userId: string;
      eventType: JourneyOutcomeType;
      source: JourneyOutcomeSource;
      sourceKey: string;
      missionInstanceId?: string | null;
      nextReviewAt?: string | null;
      now?: Date;
    }): Promise<JourneyOutcome> {
      const now = input.now ?? new Date();
      const existing = await deps.getState(input.userId);
      const context = await deps.getMissionContext(input.userId);
      const currentBand = existing?.lastReadinessBand ?? null;
      const fallbackReadiness = {
        state: currentBand ?? "unknown",
        headline: "",
        reasons: [],
        avoid: [],
        actions: [],
        reassessAt: null,
        daysUntilReassessment: null,
      } as import("@/lib/domain/types").ApplicationReadiness;

      const outcome = await deps.appendOutcome({
        userId: input.userId,
        eventType: input.eventType,
        source: input.source,
        sourceKey: input.sourceKey,
        missionInstanceId: input.missionInstanceId ?? null,
        readinessBefore: currentBand,
        readinessAfter: currentBand,
        metadata: {},
        occurredAt: now.toISOString(),
      });

      const nextReassessmentAt = input.nextReviewAt ?? existing?.nextReassessmentAt ?? null;
      const stage = deriveJourneyLifecycle({
        readiness: fallbackReadiness,
        activeMission: context.activeMission,
        nextReassessmentAt,
        hasCompletedMission: context.hasCompletedMission,
        onboardingComplete: context.onboardingComplete,
        now,
      });

      await deps.upsertState({
        userId: input.userId,
        stage,
        activeMissionId: context.activeMission?.id ?? null,
        nextReassessmentAt,
        lastReassessedAt: existing?.lastReassessedAt ?? null,
        lastReadinessBand: currentBand,
        updatedAt: now.toISOString(),
      });
      return outcome;
    },

    async reassessJourneyForUser(input: {
      userId: string;
      sourceKey: string;
      now?: Date;
    }): Promise<JourneyReassessmentResult | null> {
      const now = input.now ?? new Date();
      const existing = await deps.getState(input.userId);
      if (!existing?.nextReassessmentAt) return null;
      if (new Date(existing.nextReassessmentAt).getTime() > now.getTime()) return null;

      const guidance = await deps.getGuidance(input.userId, now);
      if (!guidance) return null;
      const context = await deps.getMissionContext(input.userId);
      const before = existing.lastReadinessBand;
      const after = guidance.readiness.state;
      const changed = before !== null && before !== after;

      await deps.appendOutcome({
        userId: input.userId,
        eventType: "reassessment_performed",
        source: "reassessment",
        sourceKey: input.sourceKey,
        missionInstanceId: context.activeMission?.id ?? null,
        readinessBefore: before,
        readinessAfter: after,
        metadata: {},
        occurredAt: now.toISOString(),
      });

      if (changed) {
        await deps.appendOutcome({
          userId: input.userId,
          eventType: "readiness_changed",
          source: "reassessment",
          sourceKey: `${input.sourceKey}:readiness:${before}:${after}`,
          missionInstanceId: context.activeMission?.id ?? null,
          readinessBefore: before,
          readinessAfter: after,
          metadata: {},
          occurredAt: now.toISOString(),
        });
      }

      const stage = deriveJourneyLifecycle({
        readiness: guidance.readiness,
        activeMission: context.activeMission,
        nextReassessmentAt: null,
        hasCompletedMission: context.hasCompletedMission,
        onboardingComplete: context.onboardingComplete,
        now,
      });

      const state = await deps.upsertState({
        userId: input.userId,
        stage,
        activeMissionId: context.activeMission?.id ?? null,
        nextReassessmentAt: null,
        lastReassessedAt: now.toISOString(),
        lastReadinessBand: after,
        updatedAt: now.toISOString(),
      });

      return { before, after, changed, state };
    },
  };
}
```

The production wrapper at the bottom of the file should build `deps` from `createAdminSupabaseClient`, `createServerSupabaseClient`, Journey Repository, the existing guidance service, and a helper that reads current mission instances/profile onboarding state. Keep all that wiring in this file rather than exporting DB clients.

- [ ] **Step 4: Add reassessment tests**

Extend the test with these exact assertions:

```ts
it("records a readiness change only when the band changes", async () => {
  const appendOutcome = vi.fn().mockImplementation(async (input) => ({ id: input.sourceKey, ...input }));
  const upsertState = vi.fn().mockImplementation(async (state) => state);
  const orchestrator = createJourneyOrchestrator({
    appendOutcome,
    upsertState,
    getState: vi.fn().mockResolvedValue({
      userId: "u1",
      stage: "reassessment_due",
      activeMissionId: null,
      nextReassessmentAt: "2026-08-29T07:00:00.000Z",
      lastReassessedAt: null,
      lastReadinessBand: "amber",
      updatedAt: "2026-08-28T08:00:00.000Z",
    }),
    getGuidance: vi.fn().mockResolvedValue({ readiness: {
      state: "green", headline: "Worth checking eligibility", reasons: [], avoid: [], actions: [], reassessAt: null, daysUntilReassessment: null,
    }}),
    getMissionContext: vi.fn().mockResolvedValue({ activeMission: null, hasCompletedMission: true, onboardingComplete: true }),
  });

  const result = await orchestrator.reassessJourneyForUser({
    userId: "u1",
    sourceKey: "reassessment:u1:2026-08-29T07:00:00.000Z",
    now: new Date("2026-08-29T08:00:00.000Z"),
  });

  expect(result?.changed).toBe(true);
  expect(appendOutcome).toHaveBeenCalledTimes(2);
  expect(appendOutcome).toHaveBeenCalledWith(expect.objectContaining({ eventType: "readiness_changed" }));
});
```

Also add an unchanged `amber -> amber` case expecting only one append and an `unknown -> unknown` case expecting no invented improvement.

- [ ] **Step 5: Run the orchestrator tests and verify GREEN**

```bash
npm test -- tests/unit/journey-orchestrator.test.ts
```

Expected: PASS.

- [ ] **Step 6: Add source boundary assertion for the orchestrator**

In the same test file:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

it("has no commercial economics input", () => {
  const source = readFileSync(resolve(process.cwd(), "lib/server/journey-orchestrator.ts"), "utf8").toLowerCase();
  for (const forbidden of ["offer-matcher", "affiliate", "commission", "epc", "payout", "revenue", "campaign"]) {
    expect(source).not.toContain(forbidden);
  }
});
```

Run the focused test again; expected PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add lib/server/journey-orchestrator.ts tests/unit/journey-orchestrator.test.ts
git commit -m "feat: add journey orchestrator"
```

---

### Task 5: Hook Journey observation into successful onboarding, mission and action writes

**Files:**
- Modify: `app/api/onboarding/route.ts`
- Modify: `app/api/missions/[slug]/route.ts`
- Modify: `app/api/actions/attempts/[id]/route.ts`
- Test: `tests/unit/journey-hooks.test.ts`

**Interfaces:**
- Consumes `observeJourneyEvent` from Task 4.
- Core route success must remain authoritative; Journey observation is best-effort after the core write.

- [ ] **Step 1: Write a failing source-order test**

Create `tests/unit/journey-hooks.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Journey route hooks", () => {
  it("observes onboarding only after profile upsert succeeds", () => {
    const text = source("app/api/onboarding/route.ts");
    expect(text).toContain("observeJourneyEvent");
    expect(text.indexOf("await supabase.from(\"profiles\").upsert")).toBeLessThan(text.indexOf("await observeJourneyEvent"));
  });

  it("keeps Journey hook best-effort in mission and action routes", () => {
    for (const path of [
      "app/api/missions/[slug]/route.ts",
      "app/api/actions/attempts/[id]/route.ts",
    ]) {
      const text = source(path);
      expect(text).toContain("observeJourneyEvent");
      expect(text).toMatch(/try\s*\{[\s\S]*observeJourneyEvent[\s\S]*\}\s*catch/);
    }
  });
});
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/journey-hooks.test.ts
```

Expected: FAIL because route files do not import/call Journey observation.

- [ ] **Step 3: Add the onboarding hook after successful upsert**

In `app/api/onboarding/route.ts`, import:

```ts
import { observeJourneyEvent } from "@/lib/server/journey-orchestrator";
```

Immediately after the configured `profiles.upsert` succeeds:

```ts
try {
  await observeJourneyEvent({
    userId,
    eventType: "onboarding_completed",
    source: "onboarding",
    sourceKey: "onboarding-completed",
    now: new Date(),
  });
} catch {
  // Journey observation is downstream and must not invalidate onboarding.
}
```

No Journey call is required in demo mode because demo has no persisted server history.

- [ ] **Step 4: Add mission hooks using stable persisted transition timestamps**

In `app/api/missions/[slug]/route.ts`, import `observeJourneyEvent`. After `missionWrite.error` is checked and before the analytics event insert, derive:

```ts
const persistedTransitionAt =
  nextProgress.completedAt ??
  nextProgress.startedAt ??
  nextProgress.nextReviewAt ??
  now.toISOString();

const journeyEvent = parsed.data.action === "start"
  ? "mission_started"
  : parsed.data.action === "complete"
    ? "mission_completed"
    : parsed.data.action === "defer"
      ? "mission_deferred"
      : null;

if (journeyEvent) {
  try {
    await observeJourneyEvent({
      userId: user.id,
      eventType: journeyEvent,
      source: "mission",
      sourceKey: `mission:${missionRow?.id ?? mission.slug}:${nextProgress.state}:${persistedTransitionAt}`,
      missionInstanceId: missionRow?.id ?? null,
      nextReviewAt: nextProgress.nextReviewAt ?? null,
      now,
    });
  } catch {
    // A Journey-write failure must not invalidate the mission update.
  }
}
```

Do not map `dismiss` to a Journey outcome in V2.2A because the approved outcome vocabulary does not include dismissal.

- [ ] **Step 5: Add Action Layer hooks after all core writes and event recording**

In `app/api/actions/attempts/[id]/route.ts`, import `observeJourneyEvent`. After `recordServerEvent(...)` succeeds, map only factual persisted states:

```ts
const journeyEvent = outcome.missionState === "completed"
  ? "mission_completed"
  : outcome.missionState === "deferred"
    ? "mission_deferred"
    : outcome.missionState === "cooldown"
      ? "cooldown_started"
      : outcome.attemptStatus === "verified"
        ? "action_verified"
        : outcome.attemptStatus === "submitted"
          ? "action_submitted"
          : null;

if (journeyEvent) {
  try {
    await observeJourneyEvent({
      userId: user.id,
      eventType: journeyEvent,
      source: "action",
      sourceKey: `action:${attempt.id}:${outcome.attemptStatus}:${updatedAttempt.updatedAt ?? nowIso}`,
      missionInstanceId: instance.id,
      nextReviewAt: outcome.nextReviewAt,
      now,
    });
  } catch {
    // Journey observation is downstream of the successful action write.
  }
}
```

If `updatedAttempt` does not currently expose `updatedAt`, use the persisted factual `verifiedAt`, `selfConfirmedAt`, `returnedAt`, or `nowIso` that the route just wrote; pin that exact field in a route test rather than introducing a guessed property.

- [ ] **Step 6: Run route-hook and existing route tests**

```bash
npm test -- tests/unit/journey-hooks.test.ts tests/unit/action-api-routes.test.ts tests/unit/action-lifecycle.test.ts
```

Expected: PASS. If the source-order assertion is too brittle after formatting, replace it with a mocked route test that forces Journey to reject and asserts the already-valid core route still returns 200; do not weaken the semantic requirement.

- [ ] **Step 7: Commit Task 5**

```bash
git add app/api/onboarding/route.ts app/api/missions/[slug]/route.ts app/api/actions/attempts/[id]/route.ts tests/unit/journey-hooks.test.ts
git commit -m "feat: observe core journey outcomes"
```

---

### Task 6: Surface honest Journey status without changing the seven-card feed

**Files:**
- Create: `components/journey/journey-status-card.tsx`
- Test: `tests/unit/journey-status-card.test.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `components/dashboard/dashboard-client.tsx`

**Interfaces:**
- Consumes `JourneyState`, recent `JourneyOutcome[]`.
- Produces a compact optional status section outside Quest Feed.

- [ ] **Step 1: Write the failing component test**

Create `tests/unit/journey-status-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JourneyStatusCard } from "@/components/journey/journey-status-card";

describe("JourneyStatusCard", () => {
  it("explains a readiness improvement without promising approval", () => {
    render(<JourneyStatusCard
      state={{
        userId: "u1",
        stage: "ready",
        activeMissionId: null,
        nextReassessmentAt: null,
        lastReassessedAt: "2026-08-29T08:00:00.000Z",
        lastReadinessBand: "green",
        updatedAt: "2026-08-29T08:00:00.000Z",
      }}
      latestOutcome={{
        id: "o1",
        userId: "u1",
        eventType: "readiness_changed",
        source: "reassessment",
        sourceKey: "change-1",
        missionInstanceId: null,
        readinessBefore: "amber",
        readinessAfter: "green",
        metadata: {},
        occurredAt: "2026-08-29T08:00:00.000Z",
      }}
    />);
    expect(screen.getByText(/Amber → Green/i)).toBeInTheDocument();
    expect(screen.getByText(/what happens next/i)).toBeInTheDocument();
    expect(screen.queryByText(/guaranteed|approved|approval odds/i)).not.toBeInTheDocument();
  });
});
```

Add cases for:
- upcoming reassessment with exact calendar date;
- unchanged band (“No readiness change yet”);
- unknown band (“We still need more evidence”);
- no state -> component returns `null`.

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/journey-status-card.test.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement the compact status card**

Create `components/journey/journey-status-card.tsx`:

```tsx
import type { JourneyOutcome, JourneyState } from "@/lib/journey/types";

function dateLabel(value: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export function JourneyStatusCard({
  state,
  latestOutcome,
}: {
  state: JourneyState | null;
  latestOutcome: JourneyOutcome | null;
}) {
  if (!state) return null;

  const changed = latestOutcome?.eventType === "readiness_changed";
  const unchanged = latestOutcome?.eventType === "reassessment_performed" &&
    latestOutcome.readinessBefore === latestOutcome.readinessAfter;
  const reviewDate = dateLabel(state.nextReassessmentAt);

  const headline = changed
    ? `${latestOutcome?.readinessBefore ?? "Unknown"} → ${latestOutcome?.readinessAfter ?? "Unknown"}`
    : unchanged
      ? "No readiness change yet"
      : state.lastReadinessBand === "unknown"
        ? "We still need more evidence"
        : reviewDate
          ? `Next review: ${reviewDate}`
          : "Your Credit Quest plan is up to date";

  const detail = changed
    ? "Your latest evidence changed the Credit Quest readiness band. This is guidance, not a lender approval prediction."
    : unchanged
      ? "That can be normal. Keep following the current plan rather than making an application just to test the result."
      : state.lastReadinessBand === "unknown"
        ? "Credit Quest will keep unknown information unknown rather than guessing."
        : reviewDate
          ? `What happens next: come back on or after ${reviewDate} and Credit Quest will reassess the current evidence.`
          : "What happens next: keep your profile current and follow the next useful mission when one is available.";

  return (
    <section data-testid="journey-status" className="mb-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Your journey</p>
      <h2 className="mt-2 text-xl font-black text-slate-950">{headline}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </section>
  );
}
```

- [ ] **Step 4: Run the component test and verify GREEN**

```bash
npm test -- tests/unit/journey-status-card.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Wire the configured server dashboard fail-soft**

In `app/dashboard/page.tsx`:
- import `getJourneyState`, `listRecentJourneyOutcomes`, `reassessJourneyForUser`, and `JourneyStatusCard`;
- after user/auth/guidance are loaded, read Journey state in `try/catch`;
- if `state.nextReassessmentAt` exists and is due, call:

```ts
await reassessJourneyForUser({
  userId: user.id,
  sourceKey: `reassessment:${user.id}:${state.nextReassessmentAt}`,
  now: new Date(),
});
```

Then reload state/outcomes. If any Journey operation fails, keep both values `null` and render the existing dashboard normally.

Render:

```tsx
<JourneyStatusCard
  state={journeyState}
  latestOutcome={journeyOutcomes[0] ?? null}
/>
```

immediately before `<QuestFeed>`. Do not change feed children or total.

- [ ] **Step 6: Add a demo-only local Journey summary without claiming server persistence**

In `components/dashboard/dashboard-client.tsx`, derive a small local state from the existing `progress` map and current readiness. Render the same component before `<QuestFeed>`, but set copy/metadata so it never claims an audit history exists. The simplest safe implementation is to render only when a demo mission has a `nextReviewAt`, with `latestOutcome={null}` and `userId="demo-user"`.

Do not change:

```ts
const FEED_CARD_TOTAL = 7;
```

- [ ] **Step 7: Run component/dashboard regressions**

```bash
npm test -- tests/unit/journey-status-card.test.tsx tests/unit/quest-feed.test.tsx tests/unit/dashboard-client.test.tsx
```

If either existing test filename differs, use the actual dashboard/Quest Feed test files returned by `tests/unit/`; do not create duplicate test suites merely to satisfy the command.

Expected: all selected tests PASS.

- [ ] **Step 8: Commit Task 6**

```bash
git add components/journey/journey-status-card.tsx app/dashboard/page.tsx components/dashboard/dashboard-client.tsx tests/unit/journey-status-card.test.tsx
git commit -m "feat: surface journey status"
```

---

### Task 7: Lock architecture boundaries and verify V2.2A end-to-end

**Files:**
- Create: `tests/unit/journey-boundaries.test.ts`
- Modify: `tests/e2e/smoke.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the architecture boundary test**

Create `tests/unit/journey-boundaries.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const coreFiles = [
  "lib/domain/safety.ts",
  "lib/domain/diagnosis.ts",
  "lib/domain/passport.ts",
  "lib/domain/readiness.ts",
  "lib/domain/mission-engine.ts",
  "lib/domain/quest-score.ts",
  "lib/academy/selector.ts",
];

describe("V2.2A dependency direction", () => {
  it("keeps Journey and commercial concepts out of core strategy", () => {
    for (const file of coreFiles) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8").toLowerCase();
      for (const forbidden of [
        "@/lib/journey",
        "journey-repository",
        "journey-orchestrator",
        "@/lib/commercial",
        "revenue",
        "affiliate",
        "commission",
        "campaign",
      ]) {
        expect(source, `${file} contains ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("does not silently change the known revolving-credit-null readiness edge", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/domain/readiness.ts"), "utf8");
    expect(source).not.toContain("profile.hasRevolvingCredit === null");
  });
});
```

The second test intentionally locks the current out-of-scope behavior; it is not an endorsement of that edge case.

- [ ] **Step 2: Run the boundary test**

```bash
npm test -- tests/unit/journey-boundaries.test.ts
```

Expected: PASS. If it fails because an existing core file already contains a forbidden term in a comment unrelated to V2.2, narrow the assertion to imports/identifiers rather than deleting legitimate existing context.

- [ ] **Step 3: Extend Playwright smoke coverage without changing feed count**

Add to `tests/e2e/smoke.spec.ts`:

```ts
test("Journey status does not turn the Quest Feed into an eighth card", async ({ page }) => {
  await completeOnboarding(page, "1990-01-01", true, 0, 3);
  const feed = page.getByTestId("quest-feed");
  await expect(feed.locator("[data-quest-feed-card]")).toHaveCount(7);
  await expect(page.getByTestId("journey-status")).toBeVisible();
});
```

If the demo scenario cannot safely create a visible Journey status without fabricating a server audit record, use the deterministic cooldown/defer demo flow created in Task 6 and assert only the visible “Next review” state. Do not seed fake readiness improvements.

- [ ] **Step 4: Update README**

Add a V2.2A section documenting:
- migration 009;
- Journey is downstream and observational;
- outcome history is owner-readable/server-written/idempotent;
- reassessment reuses existing Application Readiness;
- Journey failure does not block core actions;
- seven-card feed remains unchanged.

- [ ] **Step 5: Run the complete V2.2A verification gate**

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
```

Then run local Supabase verification:

```bash
supabase db start
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f supabase/tests/rls.sql
supabase stop --no-backup
```

Expected: every command exits 0.

- [ ] **Step 6: Commit Task 7**

```bash
git add tests/unit/journey-boundaries.test.ts tests/e2e/smoke.spec.ts README.md
git commit -m "test: verify V2.2A journey foundation"
```

## V2.2A Exit Gate

V2.2A is ready for V2.2B only when migration 009 is additive/RLS-verified, core routes still succeed if Journey observation fails, duplicate route retries cannot duplicate Journey history, due reassessment uses the existing guidance engine, Journey never invents a date or readiness band, the dashboard remains seven cards, service-role erasure is not blocked by the audit controls, and architecture tests prove Journey/commercial concepts cannot enter core strategy.
