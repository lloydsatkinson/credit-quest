# Credit Quest V2.2B Retention & Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic in-app journey reminders and opt-in service email reminders, with persistent suppression/preferences, runtime kill switches and a provider-independent copy boundary that can support AI wording later without allowing AI to choose triggers, timing or credit strategy.

**Architecture:** Build `lib/reminders` downstream of V2.2A Journey outcomes/state. Reminder rules produce immutable reasons/due times; server repositories persist jobs/preferences; a protected daily cron atomically claims due email jobs only when the runtime flag and user preference permit it. Static approved templates are the production default. An optional copy-writer interface can rewrite wording only after a reminder exists; no AI provider or paid API is activated by this plan.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase Postgres/RLS, native `fetch`, Zod 3, Vitest 3, Testing Library, Playwright, Vercel Cron-compatible route handler.

**Spec:** `docs/superpowers/specs/2026-08-29-credit-quest-v2-2-journey-growth-design.md`

**Dependency:** V2.2A complete and green, including migration 009 and Journey Repository/Orchestrator.

## Global Constraints

- Reminder selection, reason, due time and channel eligibility are deterministic.
- V2.2 email is service/journey email only. Do not add marketing campaign tables, marketing consent or promotional copy.
- `journey_email_enabled` defaults false until the user opts in. Missing/unreadable preference suppresses email.
- Referral consent never implies email consent; journey-email preference never implies marketing consent.
- Static approved copy is always available. Copy transformation failure falls back to static copy.
- `email_reminders_enabled` is a server-owned DB runtime flag, default false; disabling it requires no redeploy.
- Email failures never change readiness, mission state or Journey lifecycle.
- Do not duplicate the authenticated email address into reminder tables. Resolve it at send time through the service-role Auth Admin API.
- Cron delivery is idempotent and crash recoverable: jobs are atomically claimed before send and stale claims can be reclaimed.
- If the runtime email flag is switched off after jobs are claimed but before sending, mark those unsent jobs `suppressed` with `runtime_flag_disabled`; do not leave stale mail queued for a later surprise send.
- No push/SMS.
- No paid/AI dependency or external AI API is activated in V2.2B.
- The Quest Feed remains exactly seven cards; reminder settings and in-app reminders sit outside it.
- Every implementation task follows observed RED -> minimal GREEN -> refactor -> focused commit.

---

## File Map

### New reminder files
- `lib/reminders/types.ts` — controlled reason/channel/status/copy contracts.
- `lib/reminders/rules.ts` — pure deterministic timing/selection.
- `lib/reminders/templates.ts` — approved static service-reminder copy.
- `lib/reminders/copy-writer.ts` — provider-neutral post-selection wording interface.
- `lib/server/reminder-repository.ts` — service-owned scheduling/claim/status writes and owner reads.
- `lib/server/reminder-service.ts` — convert Journey outcomes to in-app/email jobs.
- `lib/server/email-transport.ts` — optional Resend adapter via native fetch.
- `lib/server/feature-flag-repository.ts` — fail-closed runtime flag reads.
- `supabase/migrations/010_retention_runtime_flags.sql` — reminders/preferences/flags + atomic claim RPC.

### New routes/presentation
- `app/api/communication-preferences/route.ts`
- `app/api/cron/journey-reminders/route.ts`
- `components/journey/email-reminder-preference.tsx`
- `components/journey/in-app-reminders.tsx`
- `vercel.json`

### Existing files to modify
- `.env.example`
- `lib/server/journey-orchestrator.ts`
- `app/dashboard/page.tsx`
- `components/dashboard/dashboard-client.tsx`
- `supabase/tests/rls.sql`
- `tests/e2e/smoke.spec.ts`
- `README.md`

### New tests
- `tests/unit/reminder-migration.test.ts`
- `tests/unit/reminder-rules.test.ts`
- `tests/unit/reminder-templates.test.ts`
- `tests/unit/reminder-repository.test.ts`
- `tests/unit/reminder-service.test.ts`
- `tests/unit/communication-preferences-route.test.ts`
- `tests/unit/email-reminder-preference.test.tsx`
- `tests/unit/email-transport.test.ts`
- `tests/unit/journey-reminders-cron.test.ts`
- `tests/unit/in-app-reminders.test.tsx`
- `tests/unit/reminder-boundaries.test.ts`

---

### Task 1: Add reminder, preference, runtime-flag and atomic-claim schema

**Files:**
- Create: `supabase/migrations/010_retention_runtime_flags.sql`
- Modify: `supabase/tests/rls.sql`
- Test: `tests/unit/reminder-migration.test.ts`

**Interfaces:**
- Produces tables `journey_reminders`, `communication_preferences`, `feature_flags`.
- Produces service-role-only RPC `claim_due_journey_reminders(integer,timestamptz)`.
- Seeds `email_reminders_enabled=false` and `commercial_gateway_enabled=false`.

- [ ] **Step 1: Write the failing migration contract test**

Create `tests/unit/reminder-migration.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "supabase/migrations/010_retention_runtime_flags.sql");

describe("V2.2B reminder migration", () => {
  it("creates private reminder state with default-off runtime switches", () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("create table public.journey_reminders");
    expect(sql).toContain("create table public.communication_preferences");
    expect(sql).toContain("create table public.feature_flags");
    expect(sql).toContain("'email_reminders_enabled', false");
    expect(sql).toContain("'commercial_gateway_enabled', false");
    expect(sql).toContain("'processing'");
    expect(sql).toContain("unique (user_id, channel, reason, source_key)");
    expect(sql).toContain("create or replace function public.claim_due_journey_reminders");
    expect(sql).toContain("for update skip locked");
    expect(sql).toContain("grant execute on function public.claim_due_journey_reminders(integer, timestamptz) to service_role");
  });
});
```

- [ ] **Step 2: Run the migration test and observe RED**

```bash
npm test -- tests/unit/reminder-migration.test.ts
```

Expected: FAIL because migration 010 does not exist.

- [ ] **Step 3: Implement migration 010**

Create `supabase/migrations/010_retention_runtime_flags.sql`:

```sql
create table public.journey_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null
    check (reason in ('mission_incomplete','cooldown_ending','reassessment_due','readiness_changed')),
  channel text not null check (channel in ('in_app','email')),
  status text not null default 'scheduled'
    check (status in ('scheduled','processing','sent','suppressed','failed','cancelled')),
  due_at timestamptz not null,
  source_outcome_id uuid references public.journey_outcomes(id) on delete set null,
  source_key text not null,
  template_key text not null,
  template_version integer not null default 1 check (template_version >= 1),
  suppression_reason text,
  sent_at timestamptz,
  provider_reference text,
  ai_assist_status text not null default 'not_used'
    check (ai_assist_status in ('not_used','used','rejected','failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  claimed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, channel, reason, source_key)
);

create table public.communication_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  journey_email_enabled boolean not null default false,
  journey_email_suppressed_at timestamptz,
  suppression_reason text,
  updated_at timestamptz not null default now()
);

create table public.feature_flags (
  flag_key text primary key,
  enabled boolean not null default false,
  description text not null,
  updated_at timestamptz not null default now()
);

insert into public.feature_flags(flag_key, enabled, description) values
  ('email_reminders_enabled', false, 'Allow due journey service emails to be sent.'),
  ('commercial_gateway_enabled', false, 'Allow commercial gateway processing after all hard gates.')
on conflict (flag_key) do nothing;

create index journey_reminders_due_idx
  on public.journey_reminders(status, due_at);

create index journey_reminders_user_due_idx
  on public.journey_reminders(user_id, due_at desc);

alter table public.journey_reminders enable row level security;
alter table public.communication_preferences enable row level security;
alter table public.feature_flags enable row level security;

create policy "journey_reminders_select_own" on public.journey_reminders
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "communication_preferences_select_own" on public.communication_preferences
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.journey_reminders from anon;
revoke all on public.communication_preferences from anon;
revoke all on public.feature_flags from anon, authenticated;

revoke insert, update, delete on public.journey_reminders from authenticated;
revoke insert, update, delete on public.communication_preferences from authenticated;
grant select on public.journey_reminders to authenticated;
grant select on public.communication_preferences to authenticated;

grant all on public.journey_reminders to service_role;
grant all on public.communication_preferences to service_role;
grant all on public.feature_flags to service_role;

create or replace function public.claim_due_journey_reminders(
  p_limit integer,
  p_now timestamptz
)
returns setof public.journey_reminders
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'p_limit must be between 1 and 100';
  end if;

  return query
  with claimable as (
    select id
    from public.journey_reminders
    where channel = 'email'
      and due_at <= p_now
      and (
        status = 'scheduled'
        or (
          status = 'processing'
          and claimed_at < p_now - interval '6 hours'
        )
      )
    order by due_at asc, id asc
    for update skip locked
    limit p_limit
  )
  update public.journey_reminders r
  set status = 'processing',
      attempt_count = r.attempt_count + 1,
      claimed_at = p_now,
      last_error = null,
      updated_at = p_now
  from claimable c
  where r.id = c.id
  returning r.*;
end;
$$;

revoke all on function public.claim_due_journey_reminders(integer, timestamptz) from public;
revoke all on function public.claim_due_journey_reminders(integer, timestamptz) from anon;
revoke all on function public.claim_due_journey_reminders(integer, timestamptz) from authenticated;
grant execute on function public.claim_due_journey_reminders(integer, timestamptz) to service_role;
```

- [ ] **Step 4: Extend RLS verification**

Add checks to `supabase/tests/rls.sql`:

```sql
  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('journey_reminders','communication_preferences')
      and grantee in ('anon','authenticated')
      and privilege_type in ('INSERT','UPDATE','DELETE')
  ) then
    raise exception 'Reminder/preference client writes must be denied';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'feature_flags'
      and grantee in ('anon','authenticated')
  ) then
    raise exception 'Feature flags must stay private';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.claim_due_journey_reminders(integer,timestamp with time zone)',
    'EXECUTE'
  ) then
    raise exception 'service_role must execute reminder claim RPC';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.claim_due_journey_reminders(integer,timestamp with time zone)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must not execute reminder claim RPC';
  end if;
```

Also add a rollback-only duplicate insert probe for `(user_id, channel, reason, source_key)` and assert the second insert raises `unique_violation`.

- [ ] **Step 5: Run migration and DB checks**

```bash
npm test -- tests/unit/reminder-migration.test.ts
supabase db start
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f supabase/tests/rls.sql
supabase stop --no-backup
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit Task 1**

```bash
git add supabase/migrations/010_retention_runtime_flags.sql supabase/tests/rls.sql tests/unit/reminder-migration.test.ts
git commit -m "feat: add reminder and runtime flag schema"
```

---

### Task 2: Add deterministic reminder rules and approved static templates

**Files:**
- Create: `lib/reminders/types.ts`
- Create: `lib/reminders/rules.ts`
- Create: `lib/reminders/templates.ts`
- Create: `lib/reminders/copy-writer.ts`
- Test: `tests/unit/reminder-rules.test.ts`
- Test: `tests/unit/reminder-templates.test.ts`

**Interfaces:**

```ts
ReminderReason
ReminderChannel
ReminderCandidate
ReminderTemplateKey
ApprovedReminderCopyInput
deriveReminderCandidates(input): ReminderCandidate[]
renderApprovedReminderTemplate(input): { subject: string; text: string; html: string }
ReminderCopyWriter.write(input)
```

- [ ] **Step 1: Write failing deterministic timing tests**

Create `tests/unit/reminder-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveReminderCandidates } from "@/lib/reminders/rules";

const start = new Date("2026-08-29T08:00:00.000Z");

describe("deriveReminderCandidates", () => {
  it("schedules an incomplete started mission exactly 72 hours later", () => {
    expect(deriveReminderCandidates({
      eventType: "mission_started",
      sourceOutcomeId: "o1",
      sourceKey: "mission:m1:started",
      occurredAt: start.toISOString(),
      nextReassessmentAt: null,
      readinessBefore: "amber",
      readinessAfter: "amber",
    })).toEqual([{
      reason: "mission_incomplete",
      dueAt: "2026-09-01T08:00:00.000Z",
      sourceKey: "mission:m1:started",
      sourceOutcomeId: "o1",
      templateKey: "mission-incomplete-v1",
    }]);
  });

  it("uses an exact cooldown review timestamp", () => {
    const due = "2026-09-15T10:30:00.000Z";
    expect(deriveReminderCandidates({
      eventType: "cooldown_started",
      sourceOutcomeId: "o2",
      sourceKey: "cooldown:m2",
      occurredAt: start.toISOString(),
      nextReassessmentAt: due,
      readinessBefore: "red",
      readinessAfter: "red",
    })[0]).toMatchObject({ reason: "cooldown_ending", dueAt: due });
  });

  it("makes a readiness-change reminder immediately due", () => {
    expect(deriveReminderCandidates({
      eventType: "readiness_changed",
      sourceOutcomeId: "o3",
      sourceKey: "readiness:o3",
      occurredAt: start.toISOString(),
      nextReassessmentAt: null,
      readinessBefore: "amber",
      readinessAfter: "green",
    })[0]).toMatchObject({ reason: "readiness_changed", dueAt: start.toISOString() });
  });
});
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/reminder-rules.test.ts
```

Expected: FAIL because reminder rules do not exist.

- [ ] **Step 3: Implement reminder types and pure rules**

Create `lib/reminders/types.ts`:

```ts
import type { ReadinessState } from "@/lib/domain/types";
import type { JourneyOutcomeType } from "@/lib/journey/types";

export type ReminderReason =
  | "mission_incomplete"
  | "cooldown_ending"
  | "reassessment_due"
  | "readiness_changed";

export type ReminderChannel = "in_app" | "email";
export type ReminderStatus = "scheduled" | "processing" | "sent" | "suppressed" | "failed" | "cancelled";
export type ReminderTemplateKey =
  | "mission-incomplete-v1"
  | "cooldown-ending-v1"
  | "reassessment-due-v1"
  | "readiness-changed-v1";

export interface ReminderCandidate {
  reason: ReminderReason;
  dueAt: string;
  sourceKey: string;
  sourceOutcomeId: string;
  templateKey: ReminderTemplateKey;
}

export interface ReminderRuleInput {
  eventType: JourneyOutcomeType;
  sourceOutcomeId: string;
  sourceKey: string;
  occurredAt: string;
  nextReassessmentAt: string | null;
  readinessBefore: ReadinessState | null;
  readinessAfter: ReadinessState | null;
}

export interface ApprovedReminderCopyInput {
  templateKey: ReminderTemplateKey;
  dueAt: string;
  missionTitle?: string | null;
  readinessBefore?: ReadinessState | null;
  readinessAfter?: ReadinessState | null;
  safeMode: boolean;
  ageMode: "adult" | "education";
}
```

Create `lib/reminders/rules.ts`:

```ts
import type { ReminderCandidate, ReminderRuleInput, ReminderTemplateKey } from "@/lib/reminders/types";

const DAY_MS = 86_400_000;

function candidate(
  input: ReminderRuleInput,
  reason: ReminderCandidate["reason"],
  dueAt: string,
  templateKey: ReminderTemplateKey,
): ReminderCandidate {
  return {
    reason,
    dueAt,
    sourceKey: input.sourceKey,
    sourceOutcomeId: input.sourceOutcomeId,
    templateKey,
  };
}

export function deriveReminderCandidates(input: ReminderRuleInput): ReminderCandidate[] {
  if (input.eventType === "mission_started") {
    return [candidate(
      input,
      "mission_incomplete",
      new Date(new Date(input.occurredAt).getTime() + 3 * DAY_MS).toISOString(),
      "mission-incomplete-v1",
    )];
  }

  if (input.eventType === "cooldown_started" && input.nextReassessmentAt) {
    return [candidate(input, "cooldown_ending", input.nextReassessmentAt, "cooldown-ending-v1")];
  }

  if (
    ["mission_deferred", "action_submitted", "action_verified"].includes(input.eventType) &&
    input.nextReassessmentAt
  ) {
    return [candidate(input, "reassessment_due", input.nextReassessmentAt, "reassessment-due-v1")];
  }

  if (input.eventType === "readiness_changed") {
    return [candidate(input, "readiness_changed", input.occurredAt, "readiness-changed-v1")];
  }

  return [];
}
```

- [ ] **Step 4: Run reminder-rule tests and verify GREEN**

```bash
npm test -- tests/unit/reminder-rules.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing copy safety tests**

Create `tests/unit/reminder-templates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderApprovedReminderTemplate } from "@/lib/reminders/templates";

describe("approved reminder templates", () => {
  it("uses service language and never promises approval", () => {
    const copy = renderApprovedReminderTemplate({
      templateKey: "readiness-changed-v1",
      dueAt: "2026-08-29T08:00:00.000Z",
      readinessBefore: "amber",
      readinessAfter: "green",
      safeMode: false,
      ageMode: "adult",
    });
    const all = `${copy.subject} ${copy.text} ${copy.html}`.toLowerCase();
    expect(all).toContain("credit quest");
    expect(all).not.toMatch(/guaranteed|approved|approval odds|apply now/);
  });

  it("does not encourage products for education mode", () => {
    const copy = renderApprovedReminderTemplate({
      templateKey: "reassessment-due-v1",
      dueAt: "2026-09-01T08:00:00.000Z",
      safeMode: false,
      ageMode: "education",
    });
    expect(copy.text.toLowerCase()).not.toMatch(/credit card|apply|eligibility/);
  });
});
```

Run:

```bash
npm test -- tests/unit/reminder-templates.test.ts
```

Expected: FAIL because templates do not exist.

- [ ] **Step 6: Implement static templates and provider-neutral copy interface**

Create `lib/reminders/templates.ts`:

```ts
import type { ApprovedReminderCopyInput } from "@/lib/reminders/types";

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export function renderApprovedReminderTemplate(input: ApprovedReminderCopyInput) {
  const reviewDate = dateLabel(input.dueAt);
  const protective = input.safeMode || input.ageMode === "education";

  const textByTemplate = {
    "mission-incomplete-v1": `Your Credit Quest action is still open. Return when you are ready to continue it.`,
    "cooldown-ending-v1": `Your planned waiting period reaches its review point on ${reviewDate}. Return to Credit Quest to reassess the information you have now.`,
    "reassessment-due-v1": `It is time to review your Credit Quest position. Return to see what the current evidence says and what to do next.`,
    "readiness-changed-v1": protective
      ? `Your Credit Quest position changed. Return to see the updated guidance and the next safe step.`
      : `Your Credit Quest readiness band changed from ${input.readinessBefore ?? "Unknown"} to ${input.readinessAfter ?? "Unknown"}. Return to see the updated guidance. This is not a lender approval prediction.`,
  } as const;

  const text = textByTemplate[input.templateKey];
  return {
    subject: "Your Credit Quest plan is ready to review",
    text,
    html: `<p>${text}</p>`,
  };
}
```

Create `lib/reminders/copy-writer.ts`:

```ts
import type { ApprovedReminderCopyInput } from "@/lib/reminders/types";
import { renderApprovedReminderTemplate } from "@/lib/reminders/templates";

export interface ReminderCopyWriter {
  write(input: ApprovedReminderCopyInput): Promise<{ subject: string; text: string; html: string }>;
}

export class StaticReminderCopyWriter implements ReminderCopyWriter {
  async write(input: ApprovedReminderCopyInput) {
    return renderApprovedReminderTemplate(input);
  }
}
```

Do not implement an AI writer in V2.2B.

- [ ] **Step 7: Run all Task 2 tests and commit**

```bash
npm test -- tests/unit/reminder-rules.test.ts tests/unit/reminder-templates.test.ts
git add lib/reminders tests/unit/reminder-rules.test.ts tests/unit/reminder-templates.test.ts
git commit -m "feat: add deterministic reminder rules"
```

---

### Task 3: Add Reminder Repository and fail-closed feature flag reads

**Files:**
- Create: `lib/server/reminder-repository.ts`
- Create: `lib/server/feature-flag-repository.ts`
- Test: `tests/unit/reminder-repository.test.ts`

**Interfaces:**

```ts
getCommunicationPreference(client, userId)
setJourneyEmailPreference(admin, userId, enabled, now)
listUserInAppReminders(client, userId, now)
scheduleReminder(admin, input)
claimDueEmailReminders(admin, now, limit)
markReminderSent(admin, id, providerReference, now)
markReminderSuppressed(admin, id, reason, now)
releaseReminderAfterFailure(admin, id, attemptCount, reason, now)
isFeatureEnabled(admin, flagKey)
```

- [ ] **Step 1: Write the failing repository tests**

Create `tests/unit/reminder-repository.test.ts` using the existing fake Supabase style. At minimum include:

```ts
import { describe, expect, it, vi } from "vitest";
import { clampReminderClaimLimit } from "@/lib/server/reminder-repository";
import { isFeatureEnabled } from "@/lib/server/feature-flag-repository";

describe("reminder repository", () => {
  it("bounds cron claim size", () => {
    expect(clampReminderClaimLimit(0)).toBe(1);
    expect(clampReminderClaimLimit(50)).toBe(50);
    expect(clampReminderClaimLimit(500)).toBe(100);
  });

  it("fails a runtime flag closed when config cannot be read", async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error("down") }) })),
        })),
      })),
    };
    await expect(isFeatureEnabled(client as never, "email_reminders_enabled")).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/reminder-repository.test.ts
```

Expected: FAIL because repositories do not exist.

- [ ] **Step 3: Implement feature flag reads**

Create `lib/server/feature-flag-repository.ts`:

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RuntimeFlagKey = "email_reminders_enabled" | "commercial_gateway_enabled";

export async function isFeatureEnabled(
  admin: SupabaseClient,
  flagKey: RuntimeFlagKey,
): Promise<boolean> {
  try {
    const { data, error } = await admin
      .from("feature_flags")
      .select("enabled")
      .eq("flag_key", flagKey)
      .maybeSingle();
    return !error && data?.enabled === true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Implement reminder repository status operations**

Create `lib/server/reminder-repository.ts` with:

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReminderCandidate, ReminderChannel, ReminderReason, ReminderStatus } from "@/lib/reminders/types";

export interface CommunicationPreference {
  userId: string;
  journeyEmailEnabled: boolean;
  journeyEmailSuppressedAt: string | null;
  suppressionReason: string | null;
  updatedAt: string;
}

export interface JourneyReminder {
  id: string;
  userId: string;
  reason: ReminderReason;
  channel: ReminderChannel;
  status: ReminderStatus;
  dueAt: string;
  sourceOutcomeId: string | null;
  sourceKey: string;
  templateKey: string;
  templateVersion: number;
  suppressionReason: string | null;
  sentAt: string | null;
  providerReference: string | null;
  attemptCount: number;
  claimedAt: string | null;
}

export function clampReminderClaimLimit(value: number): number {
  return Math.max(1, Math.min(100, Math.trunc(value)));
}

export async function getCommunicationPreference(client: SupabaseClient, userId: string): Promise<CommunicationPreference | null> {
  const { data, error } = await client.from("communication_preferences").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    userId: String(data.user_id),
    journeyEmailEnabled: data.journey_email_enabled === true,
    journeyEmailSuppressedAt: data.journey_email_suppressed_at ?? null,
    suppressionReason: data.suppression_reason ?? null,
    updatedAt: String(data.updated_at),
  };
}

export async function setJourneyEmailPreference(admin: SupabaseClient, userId: string, enabled: boolean, now = new Date()) {
  const nowIso = now.toISOString();
  const { data, error } = await admin.from("communication_preferences").upsert({
    user_id: userId,
    journey_email_enabled: enabled,
    journey_email_suppressed_at: enabled ? null : nowIso,
    suppression_reason: enabled ? null : "user_disabled",
    updated_at: nowIso,
  }).select("*").single();
  if (error) throw error;
  return data;
}

export async function scheduleReminder(admin: SupabaseClient, userId: string, channel: ReminderChannel, candidate: ReminderCandidate) {
  const payload = {
    user_id: userId,
    reason: candidate.reason,
    channel,
    status: "scheduled",
    due_at: candidate.dueAt,
    source_outcome_id: candidate.sourceOutcomeId,
    source_key: candidate.sourceKey,
    template_key: candidate.templateKey,
    template_version: 1,
  };
  const inserted = await admin.from("journey_reminders").insert(payload).select("*").maybeSingle();
  if (!inserted.error && inserted.data) return inserted.data;
  const existing = await admin.from("journey_reminders").select("*")
    .eq("user_id", userId)
    .eq("channel", channel)
    .eq("reason", candidate.reason)
    .eq("source_key", candidate.sourceKey)
    .maybeSingle();
  if (existing.error || !existing.data) throw inserted.error ?? existing.error;
  return existing.data;
}

export async function claimDueEmailReminders(admin: SupabaseClient, now: Date, limit = 50): Promise<JourneyReminder[]> {
  const { data, error } = await admin.rpc("claim_due_journey_reminders", {
    p_limit: clampReminderClaimLimit(limit),
    p_now: now.toISOString(),
  });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    userId: String(row.user_id),
    reason: row.reason as ReminderReason,
    channel: row.channel as ReminderChannel,
    status: row.status as ReminderStatus,
    dueAt: String(row.due_at),
    sourceOutcomeId: row.source_outcome_id ? String(row.source_outcome_id) : null,
    sourceKey: String(row.source_key),
    templateKey: String(row.template_key),
    templateVersion: Number(row.template_version),
    suppressionReason: row.suppression_reason ? String(row.suppression_reason) : null,
    sentAt: row.sent_at ? String(row.sent_at) : null,
    providerReference: row.provider_reference ? String(row.provider_reference) : null,
    attemptCount: Number(row.attempt_count),
    claimedAt: row.claimed_at ? String(row.claimed_at) : null,
  }));
}
```

Add `listUserInAppReminders` as an owner-filtered query for `channel='in_app'`, `status='scheduled'`, `due_at <= now`, ordered ascending, limit 3.

Add status helpers using exact updates restricted by `id` and current `status='processing'` for email rows. `releaseReminderAfterFailure` must:
- if `attemptCount < 3`: set `status='scheduled'`, `due_at=now+24h`, `claimed_at=null`, `last_error=reason`;
- else: set `status='failed'`, `claimed_at=null`, `last_error=reason`.

Do not store API keys or full provider error bodies in `last_error`; use controlled codes such as `provider_unavailable`.

- [ ] **Step 5: Add repository behavior assertions and run GREEN**

Extend the test to assert:
- `claimDueEmailReminders(..., 500)` RPC receives `p_limit:100`;
- `setJourneyEmailPreference(..., false)` stores `user_disabled` and timestamp;
- a missing preference returns `null`;
- retry 1/2 goes back to `scheduled`; attempt 3 becomes `failed`.

Run:

```bash
npm test -- tests/unit/reminder-repository.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add lib/server/reminder-repository.ts lib/server/feature-flag-repository.ts tests/unit/reminder-repository.test.ts
git commit -m "feat: add reminder repositories"
```

---

### Task 4: Schedule in-app and opt-in email jobs from Journey outcomes

**Files:**
- Create: `lib/server/reminder-service.ts`
- Modify: `lib/server/journey-orchestrator.ts`
- Test: `tests/unit/reminder-service.test.ts`

**Interfaces:**
- Consumes Journey outcome + current communication preference.
- Produces one in-app job per deterministic candidate and an email job only for currently opted-in users.

- [ ] **Step 1: Write the failing service test**

Create `tests/unit/reminder-service.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createReminderService } from "@/lib/server/reminder-service";

describe("Reminder Service", () => {
  it("always schedules in-app and only schedules email for persisted opt-in", async () => {
    const schedule = vi.fn().mockResolvedValue({ id: "r1" });
    const service = createReminderService({
      getPreference: vi.fn().mockResolvedValue({ journeyEmailEnabled: true }),
      schedule,
    });

    await service.scheduleForJourneyOutcome({
      userId: "u1",
      outcome: {
        id: "o1",
        userId: "u1",
        eventType: "mission_started",
        source: "mission",
        sourceKey: "mission:m1:started",
        missionInstanceId: "m1",
        readinessBefore: "amber",
        readinessAfter: "amber",
        metadata: {},
        occurredAt: "2026-08-29T08:00:00.000Z",
      },
      nextReassessmentAt: null,
    });

    expect(schedule).toHaveBeenCalledWith("u1", "in_app", expect.any(Object));
    expect(schedule).toHaveBeenCalledWith("u1", "email", expect.any(Object));
  });
});
```

Add a second case where preference is `null` and assert only `in_app` is scheduled.

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/reminder-service.test.ts
```

Expected: FAIL because service does not exist.

- [ ] **Step 3: Implement the Reminder Service**

Create `lib/server/reminder-service.ts`:

```ts
import "server-only";
import type { JourneyOutcome } from "@/lib/journey/types";
import { deriveReminderCandidates } from "@/lib/reminders/rules";

interface ReminderServiceDeps {
  getPreference: (userId: string) => Promise<{ journeyEmailEnabled: boolean } | null>;
  schedule: (userId: string, channel: "in_app" | "email", candidate: ReturnType<typeof deriveReminderCandidates>[number]) => Promise<unknown>;
}

export function createReminderService(deps: ReminderServiceDeps) {
  return {
    async scheduleForJourneyOutcome(input: {
      userId: string;
      outcome: JourneyOutcome;
      nextReassessmentAt: string | null;
    }) {
      const candidates = deriveReminderCandidates({
        eventType: input.outcome.eventType,
        sourceOutcomeId: input.outcome.id,
        sourceKey: input.outcome.sourceKey,
        occurredAt: input.outcome.occurredAt,
        nextReassessmentAt: input.nextReassessmentAt,
        readinessBefore: input.outcome.readinessBefore,
        readinessAfter: input.outcome.readinessAfter,
      });

      for (const candidate of candidates) {
        await deps.schedule(input.userId, "in_app", candidate);
        let preference = null;
        try {
          preference = await deps.getPreference(input.userId);
        } catch {
          preference = null;
        }
        if (preference?.journeyEmailEnabled === true) {
          await deps.schedule(input.userId, "email", candidate);
        }
      }
    },
  };
}
```

Add a production wrapper using `createAdminSupabaseClient`, `getCommunicationPreference`, and `scheduleReminder`.

- [ ] **Step 4: Hook scheduling after Journey outcome persistence, best-effort**

In `lib/server/journey-orchestrator.ts`, after an outcome has been successfully appended and projection updated:

```ts
try {
  await scheduleJourneyRemindersForOutcome({
    userId: input.userId,
    outcome,
    nextReassessmentAt,
  });
} catch {
  // Reminder scheduling cannot invalidate Journey history or core guidance.
}
```

For `readiness_changed`, call reminder scheduling after that specific outcome is appended so the source id/key is the actual change outcome.

- [ ] **Step 5: Run service + orchestrator regressions and commit**

```bash
npm test -- tests/unit/reminder-service.test.ts tests/unit/journey-orchestrator.test.ts
git add lib/server/reminder-service.ts lib/server/journey-orchestrator.ts tests/unit/reminder-service.test.ts
git commit -m "feat: schedule journey reminders"
```

Expected: PASS.

---

### Task 5: Add journey-email preference API and customer control

**Files:**
- Create: `app/api/communication-preferences/route.ts`
- Create: `components/journey/email-reminder-preference.tsx`
- Test: `tests/unit/communication-preferences-route.test.ts`
- Test: `tests/unit/email-reminder-preference.test.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `components/dashboard/dashboard-client.tsx`

- [ ] **Step 1: Write the failing strict-schema route test**

Create `tests/unit/communication-preferences-route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { journeyEmailPreferenceSchema } from "@/app/api/communication-preferences/route";

describe("journey email preference payload", () => {
  it("accepts only the journey service-email boolean", () => {
    expect(journeyEmailPreferenceSchema.safeParse({ journeyEmailEnabled: true }).success).toBe(true);
    expect(journeyEmailPreferenceSchema.safeParse({ journeyEmailEnabled: true, marketingConsent: true }).success).toBe(false);
    expect(journeyEmailPreferenceSchema.safeParse({ journeyEmailEnabled: true, userId: "someone-else" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/communication-preferences-route.test.ts
```

Expected: FAIL because route/schema does not exist.

- [ ] **Step 3: Implement authenticated GET/PATCH route**

Create `app/api/communication-preferences/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCommunicationPreference, setJourneyEmailPreference } from "@/lib/server/reminder-repository";

export const journeyEmailPreferenceSchema = z.object({
  journeyEmailEnabled: z.boolean(),
}).strict();

export async function GET() {
  if (!getSupabasePublicEnv()) {
    return NextResponse.json({ mode: "demo", journeyEmailEnabled: false, persisted: false });
  }
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const preference = await getCommunicationPreference(supabase, user.id).catch(() => null);
  return NextResponse.json({
    journeyEmailEnabled: preference?.journeyEmailEnabled === true,
    persisted: preference !== null,
  });
}

export async function PATCH(request: Request) {
  const parsed = journeyEmailPreferenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid communication preference" }, { status: 400 });
  if (!getSupabasePublicEnv()) {
    return NextResponse.json({ mode: "demo", journeyEmailEnabled: parsed.data.journeyEmailEnabled, persisted: false });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const admin = createAdminSupabaseClient();
  await setJourneyEmailPreference(admin, user.id, parsed.data.journeyEmailEnabled, new Date());
  return NextResponse.json({ journeyEmailEnabled: parsed.data.journeyEmailEnabled, persisted: true });
}
```

Add route tests that mock auth/admin and assert a body-supplied user id cannot influence writes.

- [ ] **Step 4: Write and run the failing preference component test**

Create `tests/unit/email-reminder-preference.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmailReminderPreference } from "@/components/journey/email-reminder-preference";

describe("EmailReminderPreference", () => {
  it("describes service reminders without marketing language", () => {
    render(<EmailReminderPreference initialEnabled={false} demo={true} />);
    expect(screen.getByText(/Email me when it’s time to review my Credit Quest plan/i)).toBeInTheDocument();
    expect(screen.queryByText(/deals|offers|marketing/i)).not.toBeInTheDocument();
  });
});
```

Run:

```bash
npm test -- tests/unit/email-reminder-preference.test.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 5: Implement the preference component outside Quest Feed**

Create a client component with a checkbox/button that PATCHes only `{ journeyEmailEnabled: next }`, displays success/failure, and in demo mode writes `creditquest-journey-email-demo` to localStorage rather than pretending server persistence.

Required visible copy:

```tsx
<p className="font-bold">Email me when it’s time to review my Credit Quest plan.</p>
<p className="text-sm text-slate-600">Service reminders only. This does not sign you up for marketing.</p>
```

Wire it in both dashboard modes after Journey status and outside `<QuestFeed>`.

- [ ] **Step 6: Run route/component/dashboard tests and commit**

```bash
npm test -- tests/unit/communication-preferences-route.test.ts tests/unit/email-reminder-preference.test.tsx
git add app/api/communication-preferences/route.ts components/journey/email-reminder-preference.tsx app/dashboard/page.tsx components/dashboard/dashboard-client.tsx tests/unit/communication-preferences-route.test.ts tests/unit/email-reminder-preference.test.tsx
git commit -m "feat: add journey email preference"
```

Expected: PASS.

---

### Task 6: Add provider transport and protected daily cron delivery

**Files:**
- Create: `lib/server/email-transport.ts`
- Create: `app/api/cron/journey-reminders/route.ts`
- Create: `vercel.json`
- Modify: `.env.example`
- Test: `tests/unit/email-transport.test.ts`
- Test: `tests/unit/journey-reminders-cron.test.ts`

**Interfaces:**

```ts
EmailTransport.send(message): Promise<{ ok: true; providerReference: string } | { ok: false; reason: string }>
GET /api/cron/journey-reminders
```

- [ ] **Step 1: Write failing transport tests**

Create `tests/unit/email-transport.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { ResendEmailTransport } from "@/lib/server/email-transport";

describe("ResendEmailTransport", () => {
  it("does not call the network when configuration is absent", async () => {
    const fetcher = vi.fn();
    const transport = new ResendEmailTransport({ apiKey: null, fromEmail: null, fetcher });
    await expect(transport.send({ to: "user@example.com", subject: "Review", html: "<p>Review</p>" }))
      .resolves.toEqual({ ok: false, reason: "not_configured" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("posts only to the Resend email endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "email_123" }) });
    const transport = new ResendEmailTransport({ apiKey: "secret", fromEmail: "Credit Quest <hello@example.com>", fetcher });
    await transport.send({ to: "user@example.com", subject: "Review", html: "<p>Review</p>" });
    expect(fetcher).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST" }));
  });
});
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/email-transport.test.ts
```

Expected: FAIL because transport does not exist.

- [ ] **Step 3: Implement provider adapter with native fetch**

Create `lib/server/email-transport.ts`:

```ts
import "server-only";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<
    | { ok: true; providerReference: string }
    | { ok: false; reason: "not_configured" | "provider_unavailable" }
  >;
}

export class ResendEmailTransport implements EmailTransport {
  constructor(private readonly config: {
    apiKey: string | null;
    fromEmail: string | null;
    fetcher?: typeof fetch;
  }) {}

  async send(message: EmailMessage) {
    if (!this.config.apiKey || !this.config.fromEmail) {
      return { ok: false as const, reason: "not_configured" as const };
    }
    const fetcher = this.config.fetcher ?? fetch;
    try {
      const response = await fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: this.config.fromEmail,
          to: [message.to],
          subject: message.subject,
          html: message.html,
        }),
      });
      if (!response.ok) return { ok: false as const, reason: "provider_unavailable" as const };
      const body = await response.json() as { id?: string };
      return body.id
        ? { ok: true as const, providerReference: body.id }
        : { ok: false as const, reason: "provider_unavailable" as const };
    } catch {
      return { ok: false as const, reason: "provider_unavailable" as const };
    }
  }
}
```

Never log API key, authorization header or provider response body.

- [ ] **Step 4: Write failing cron authorization/flag tests**

Create `tests/unit/journey-reminders-cron.test.ts` by exporting pure helpers from the route or a small internal `processJourneyReminderBatch` function. Pin:
- wrong/missing `Bearer ${CRON_SECRET}` -> 401;
- missing `CRON_SECRET` -> 503 rather than unprotected execution;
- `email_reminders_enabled=false` -> 204 and claim function not called;
- preference missing/off -> `markReminderSuppressed(id,"user_disabled_or_missing",now)`;
- runtime flag disabled after claim -> `markReminderSuppressed(id,"runtime_flag_disabled",now)`;
- missing auth email -> `markReminderSuppressed(id,"missing_email",now)`;
- transport success -> sent;
- transport failure -> bounded retry/failed;
- one failure does not stop later rows.

- [ ] **Step 5: Implement protected cron route**

Create `app/api/cron/journey-reminders/route.ts` with this flow:

```ts
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isFeatureEnabled } from "@/lib/server/feature-flag-repository";
import {
  claimDueEmailReminders,
  getCommunicationPreference,
  markReminderSent,
  markReminderSuppressed,
  releaseReminderAfterFailure,
} from "@/lib/server/reminder-repository";
import { ResendEmailTransport } from "@/lib/server/email-transport";
import { StaticReminderCopyWriter } from "@/lib/reminders/copy-writer";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  if (!(await isFeatureEnabled(admin, "email_reminders_enabled"))) {
    return new NextResponse(null, { status: 204 });
  }

  const now = new Date();
  const claimed = await claimDueEmailReminders(admin, now, 50);
  const transport = new ResendEmailTransport({
    apiKey: process.env.RESEND_API_KEY ?? null,
    fromEmail: process.env.JOURNEY_FROM_EMAIL ?? null,
  });
  const writer = new StaticReminderCopyWriter();

  for (const reminder of claimed) {
    if (!(await isFeatureEnabled(admin, "email_reminders_enabled"))) {
      await markReminderSuppressed(admin, reminder.id, "runtime_flag_disabled", now);
      continue;
    }

    const preference = await getCommunicationPreference(admin, reminder.userId).catch(() => null);
    if (!preference?.journeyEmailEnabled) {
      await markReminderSuppressed(admin, reminder.id, "user_disabled_or_missing", now);
      continue;
    }

    const { data, error } = await admin.auth.admin.getUserById(reminder.userId);
    const email = error ? null : data.user?.email ?? null;
    if (!email) {
      await markReminderSuppressed(admin, reminder.id, "missing_email", now);
      continue;
    }

    const copy = await writer.write({
      templateKey: reminder.templateKey as import("@/lib/reminders/types").ReminderTemplateKey,
      dueAt: reminder.dueAt,
      safeMode: true,
      ageMode: "adult",
    });
    const sent = await transport.send({ to: email, subject: copy.subject, html: copy.html });
    if (sent.ok) {
      await markReminderSent(admin, reminder.id, sent.providerReference, now);
    } else {
      await releaseReminderAfterFailure(admin, reminder.id, reminder.attemptCount, sent.reason, now);
    }
  }

  return NextResponse.json({ processed: claimed.length });
}
```

Do not ship the placeholder `safeMode:true` shown above as the final context. Before GREEN, load the user’s current effective guidance/safety/age context through the existing guidance/profile services and pass the factual `safeMode`/`ageMode` into the template. Add a test proving under-18/Safe Mode copy uses protective wording. This is a required implementation step, not optional follow-up.

- [ ] **Step 6: Add environment keys and exact daily Vercel Cron**

Append to `.env.example`:

```text
RESEND_API_KEY=
JOURNEY_FROM_EMAIL=
CRON_SECRET=
```

Create `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/journey-reminders",
      "schedule": "0 8 * * *"
    }
  ]
}
```

This is intentionally a daily service-reminder sweep; in-app Journey state remains current on visit.

- [ ] **Step 7: Run transport/cron tests and commit**

```bash
npm test -- tests/unit/email-transport.test.ts tests/unit/journey-reminders-cron.test.ts
git add lib/server/email-transport.ts app/api/cron/journey-reminders/route.ts vercel.json .env.example tests/unit/email-transport.test.ts tests/unit/journey-reminders-cron.test.ts
git commit -m "feat: deliver journey reminder emails"
```

Expected: PASS.

---

### Task 7: Add in-app reminder presentation and lock reminder boundaries

**Files:**
- Create: `components/journey/in-app-reminders.tsx`
- Create: `tests/unit/in-app-reminders.test.tsx`
- Create: `tests/unit/reminder-boundaries.test.ts`
- Modify: `app/dashboard/page.tsx`
- Modify: `tests/e2e/smoke.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the failing in-app component test**

Create `tests/unit/in-app-reminders.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InAppReminders } from "@/components/journey/in-app-reminders";

describe("InAppReminders", () => {
  it("shows factual review prompts without urgency", () => {
    render(<InAppReminders reminders={[{
      id: "r1",
      reason: "reassessment_due",
      dueAt: "2026-09-01T08:00:00.000Z",
      templateKey: "reassessment-due-v1",
    }]} />);
    expect(screen.getByText(/review your Credit Quest position/i)).toBeInTheDocument();
    expect(screen.queryByText(/act now|limited time|approved/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/in-app-reminders.test.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement at-most-three in-app reminders outside Quest Feed**

Create `components/journey/in-app-reminders.tsx` using `renderApprovedReminderTemplate` and render at most `reminders.slice(0, 3)`. The server dashboard should call `listUserInAppReminders(supabase,user.id,new Date())` in a `try/catch`; on error use `[]`. Render this section before/after Journey status but outside `<QuestFeed>`.

- [ ] **Step 4: Add reminder architecture boundary test**

Create `tests/unit/reminder-boundaries.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

for (const file of ["lib/reminders/rules.ts", "lib/reminders/templates.ts"]) {
  describe(file, () => {
    it("does not depend on commercial economics or offer matching", () => {
      const source = readFileSync(resolve(process.cwd(), file), "utf8").toLowerCase();
      for (const forbidden of ["offer-matcher", "commission", "epc", "payout", "revenue", "campaign"]) {
        expect(source).not.toContain(forbidden);
      }
    });
  });
}
```

- [ ] **Step 5: Extend E2E and README**

Add E2E assertions that:
- email opt-in copy includes “Service reminders only”;
- under-18 and Safe Mode flows still show no partner application CTA;
- Quest Feed still has 7 cards;
- no reminder copy contains `guaranteed`, `approved`, or `apply now`.

README must document migration 010, runtime flags, opt-in behavior, daily cron cadence, three env keys, static-copy fallback, and the strict service-email/not-marketing boundary.

- [ ] **Step 6: Run the full V2.2B gate**

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
supabase db start
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f supabase/tests/rls.sql
supabase stop --no-backup
```

Expected: every command exits 0.

- [ ] **Step 7: Commit Task 7**

```bash
git add components/journey/in-app-reminders.tsx app/dashboard/page.tsx tests/unit/in-app-reminders.test.tsx tests/unit/reminder-boundaries.test.ts tests/e2e/smoke.spec.ts README.md
git commit -m "test: verify V2.2B retention and email"
```

## V2.2B Exit Gate

Proceed to V2.2C only when reminder reasons/timing are deterministic, email is explicit opt-in and runtime-disableable, missing preference/email fails closed, runtime-disable after claim suppresses unsent jobs, cron claim/send/retry is concurrency-safe and crash recoverable, recipient email is resolved rather than duplicated, static copy works without AI/external cost, the seven-card feed remains intact, and no reminder/email code can affect credit strategy.
