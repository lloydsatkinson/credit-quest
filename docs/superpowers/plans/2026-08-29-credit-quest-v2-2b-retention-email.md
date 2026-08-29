# Credit Quest V2.2B Retention & Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic in-app journey reminders and opt-in service email reminders, with persistent suppression/preferences, runtime kill switches and a provider-independent copy boundary that can support AI wording later without allowing AI to choose triggers, timing or credit strategy.

**Architecture:** Build `lib/reminders` downstream of V2.2A Journey outcomes/state. Reminder rules produce immutable reasons/due times; server repositories persist jobs/preferences; a protected cron drains due email jobs only when the runtime flag and user preference permit it. Static approved templates are the production default. An optional copy-writer interface is allowed to rewrite wording only after a reminder exists; no AI provider or paid API is activated by this plan.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase Postgres/RLS, native `fetch`, Zod 3, Vitest 3, Playwright, Vercel Cron-compatible route handler.

**Spec:** `docs/superpowers/specs/2026-08-29-credit-quest-v2-2-journey-growth-design.md`

**Dependency:** Complete V2.2A first. Migration 009 and Journey Repository/Orchestrator are assumed present.

## Global Constraints

- Reminder selection, reason, due time and channel eligibility are deterministic.
- V2.2 email is service/journey email only. Do not add marketing campaign tables, marketing consent or promotional copy.
- `journey_email_enabled` defaults **false** until the user opts in. A missing/unreadable preference suppresses email.
- Referral consent never implies email consent; journey-email preference never implies marketing consent.
- Static approved copy is always available. Copy transformation failure falls back to static copy.
- `email_reminders_enabled` is a server-owned DB runtime flag, default false; disabling it must require no redeploy.
- Email failures never change readiness, mission state or Journey lifecycle.
- Do not add push/SMS.
- Do not add a paid/AI dependency or enable an external AI API in this stage.
- Every task follows observed RED -> GREEN -> focused commit.

---

## File Map

**Create**
- `lib/reminders/types.ts`
- `lib/reminders/rules.ts`
- `lib/reminders/templates.ts`
- `lib/reminders/copy-writer.ts`
- `lib/server/reminder-repository.ts`
- `lib/server/reminder-service.ts`
- `lib/server/email-transport.ts`
- `lib/server/feature-flag-repository.ts`
- `app/api/communication-preferences/route.ts`
- `app/api/cron/journey-reminders/route.ts`
- `components/journey/email-reminder-preference.tsx`
- `components/journey/in-app-reminders.tsx`
- `supabase/migrations/010_retention_runtime_flags.sql`
- `vercel.json`
- unit tests for each new module/route

**Modify**
- `.env.example`
- `lib/server/journey-orchestrator.ts`
- `app/dashboard/page.tsx`
- `components/dashboard/dashboard-client.tsx`
- `supabase/tests/rls.sql`
- `tests/e2e/smoke.spec.ts`
- `README.md`

---

### Task 1: Add reminder, preference and runtime-flag schema

**Files:** Create `supabase/migrations/010_retention_runtime_flags.sql`, `tests/unit/reminder-migration.test.ts`; modify `supabase/tests/rls.sql`.

- [ ] Write a RED source test asserting migration 010 creates `journey_reminders`, `communication_preferences`, `feature_flags`; seeds `email_reminders_enabled=false` and `commercial_gateway_enabled=false`; denies direct client reminder/flag writes; allows own preference read; and has reminder dedupe uniqueness.
- [ ] Run `npm test -- tests/unit/reminder-migration.test.ts`; observe RED.
- [ ] Implement migration with these controlled values:

```sql
create table public.journey_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('mission_incomplete','cooldown_ending','reassessment_due','readiness_changed')),
  channel text not null check (channel in ('in_app','email')),
  status text not null default 'scheduled' check (status in ('scheduled','sent','suppressed','failed','cancelled')),
  due_at timestamptz not null,
  source_outcome_id uuid references public.journey_outcomes(id) on delete set null,
  source_key text not null,
  template_key text not null,
  template_version integer not null default 1 check (template_version >= 1),
  suppression_reason text,
  sent_at timestamptz,
  provider_reference text,
  ai_assist_status text not null default 'not_used' check (ai_assist_status in ('not_used','used','rejected','failed')),
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
```

Create indexes on `(status,due_at)` for scheduled reminders and `(user_id,due_at desc)`.

RLS/grants:
- authenticated own SELECT on reminders;
- no direct client reminder INSERT/UPDATE/DELETE;
- authenticated own SELECT on communication preferences;
- no direct client preference writes (route is server-owned);
- no anon/auth access to feature flags; service-role only.
- [ ] Extend `supabase/tests/rls.sql` with owner/no-write/flag-private checks and a duplicate reminder insert probe proving dedupe uniqueness.
- [ ] Run migration source test and local Supabase RLS verification GREEN.
- [ ] Commit: `feat: add reminder and runtime flag schema`.

### Task 2: Define deterministic reminder contracts, timing and templates

**Files:** Create `lib/reminders/types.ts`, `rules.ts`, `templates.ts`, `copy-writer.ts`; tests `reminder-rules.test.ts`, `reminder-templates.test.ts`.

**Contracts:**

```ts
export type ReminderReason = "mission_incomplete" | "cooldown_ending" | "reassessment_due" | "readiness_changed";
export type ReminderChannel = "in_app" | "email";

export interface ReminderCandidate {
  reason: ReminderReason;
  dueAt: string;
  sourceKey: string;
  templateKey: ReminderTemplateKey;
}
```

- [ ] RED tests pin exact rules:
  - mission starts and remains `started`: candidate due 72 hours after observed mission start;
  - cooldown/in-review/deferred with `nextReviewAt`: candidate at exact review time, reason `cooldown_ending` only for cooldown, otherwise `reassessment_due`;
  - Journey `nextReassessmentAt`: `reassessment_due` at exact timestamp;
  - readiness actually changes during reassessment: `readiness_changed` due immediately;
  - no candidate is created from a commercial/revenue event.
- [ ] Implement pure `deriveReminderCandidates(...)` with no Supabase/imported side effects.
- [ ] RED template tests assert approved base copy includes reason, next action and date where known; under-18/Safe Mode context cannot produce product/application encouragement.
- [ ] Implement static templates. Use factual copy such as “It’s time to review your Credit Quest position” rather than urgency/approval language.
- [ ] Define but do not externally activate:

```ts
export interface ReminderCopyWriter {
  write(input: ApprovedReminderCopyInput): Promise<string>;
}

export class StaticReminderCopyWriter implements ReminderCopyWriter {
  async write(input: ApprovedReminderCopyInput) { return renderApprovedReminderTemplate(input); }
}
```

Any future AI writer must satisfy the same interface after selection, never before.
- [ ] Run focused tests GREEN and commit: `feat: add deterministic reminder rules`.

### Task 3: Add repositories and runtime flag reads

**Files:** Create `lib/server/reminder-repository.ts`, `lib/server/feature-flag-repository.ts`, tests.

**Repository API:**

```ts
getCommunicationPreference(adminOrServer, userId)
setJourneyEmailPreference(admin, userId, enabled, now)
listUserInAppReminders(serverClient, userId, now)
scheduleReminder(admin, input)
listDueEmailReminders(admin, now, limit)
markReminderSent(admin, id, providerReference, now)
markReminderSuppressed(admin, id, reason, now)
markReminderFailed(admin, id, reason, now)
isFeatureEnabled(admin, flagKey): Promise<boolean>
```

- [ ] RED tests enforce snake_case mapping, due query only `scheduled + email + due_at <= now`, bounded `limit <= 100`, owner filter for in-app reads, and fail-closed `isFeatureEnabled` returning false when row/read fails.
- [ ] Implement. `scheduleReminder` uses DB uniqueness to make duplicate scheduling idempotent; on unique conflict, return the existing row rather than creating a second reminder.
- [ ] No repository imports from domain readiness/mission ranking.
- [ ] Run tests GREEN and commit: `feat: add reminder repositories`.

### Task 4: Schedule reminders from Journey outcomes

**Files:** Create `lib/server/reminder-service.ts`, `tests/unit/reminder-service.test.ts`; modify `lib/server/journey-orchestrator.ts`.

- [ ] RED service tests prove both in-app and email candidates derive from the same deterministic reason/time; email row may be scheduled even while user is opted out, but send-time suppression is authoritative; or, preferably, schedule only in-app universally and email only if preference is enabled. Use the safer rule: **email is scheduled only when preference currently exists and is enabled**.
- [ ] Missing preference or read failure => no email job. In-app remains available.
- [ ] Implement `scheduleJourneyRemindersForOutcome(...)` using Task 2 rules and Task 3 repositories.
- [ ] Hook it best-effort after `observeJourneyEvent` successfully persists Journey state/outcome. Reminder scheduling failure does not make Journey observation fail.
- [ ] Readiness-change reminder uses the actual `readiness_changed` outcome id and has a stable `sourceKey = readiness:${outcome.id}`.
- [ ] Run tests GREEN and commit: `feat: schedule journey reminders`.

### Task 5: Add email preference API and customer controls

**Files:** Create `app/api/communication-preferences/route.ts`, `components/journey/email-reminder-preference.tsx`; tests `communication-preferences-route.test.ts`, `email-reminder-preference.test.tsx`; modify dashboards.

- [ ] RED route tests: strict body `{ journeyEmailEnabled: boolean }`; rejects userId/marketingConsent fields; requires auth; server uses authenticated user id only; disabled stores suppression timestamp/source; no Supabase env returns a harmless demo response without pretending server persistence.
- [ ] Implement GET and PATCH. PATCH uses admin client only after cookie-auth user is known.
- [ ] Component copy: “Email me when it’s time to review my Credit Quest plan.” Do not use “offers”, “deals” or marketing wording.
- [ ] Add a clear off control and status feedback. On disable, future email sends are suppressed; existing in-app reminders remain.
- [ ] Server dashboard shows the preference component in a small settings area outside the seven-card feed. Demo dashboard stores only a demo preference locally and labels it as demo behaviour.
- [ ] Run tests GREEN and commit: `feat: add journey email preference`.

### Task 6: Add provider transport and protected cron drain

**Files:** Create `lib/server/email-transport.ts`, `app/api/cron/journey-reminders/route.ts`, `vercel.json`; modify `.env.example`; tests `email-transport.test.ts`, `journey-reminders-cron.test.ts`.

No npm dependency is required. Use native fetch to Resend only when configured.

`.env.example` additions:

```text
RESEND_API_KEY=
JOURNEY_FROM_EMAIL=
CRON_SECRET=
```

- [ ] RED transport tests: missing API key/from email returns `{ ok:false, reason:"not_configured" }` without network; configured transport posts only to `https://api.resend.com/emails`; request contains from/to/subject/html; response id is captured; logs never include the API key.
- [ ] Implement `ResendEmailTransport` with injected `fetch` for tests. Do not add tracking pixels beyond provider defaults; no marketing tags.
- [ ] RED cron tests: Authorization must equal `Bearer ${CRON_SECRET}`; missing/mismatch -> 401; `email_reminders_enabled=false` -> 204/no due query; preference missing/disabled -> mark suppressed; send success -> sent; provider failure -> failed; one failed row does not stop later rows.
- [ ] Implement `GET /api/cron/journey-reminders`. Re-check preference and runtime flag **at send time**, not only scheduling time.
- [ ] `vercel.json` exact schedule:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [{ "path": "/api/cron/journey-reminders", "schedule": "0 * * * *" }]
}
```

The handler is idempotent because rows leave `scheduled` after one attempted send; concurrent protection should update/claim a row before sending or use an atomic service RPC so two invocations cannot send the same row.
- [ ] Implement a `claim_due_journey_reminders(limit, now)` service-role-only RPC in migration 010 or a follow-up additive `010` section before release; it atomically changes claimed rows to an internal `processing` state. If using `processing`, include it in the migration status CHECK and tests from Task 1. Do not implement a SELECT-then-send race.
- [ ] Run focused tests GREEN and commit: `feat: deliver journey reminder emails`.

### Task 7: In-app reminders and end-to-end safety regression

**Files:** Create `components/journey/in-app-reminders.tsx`, tests; modify dashboard/E2E/README.

- [ ] RED component tests for due/upcoming reminders, no fake urgency, dismiss/no-email side effects kept separate.
- [ ] Server dashboard reads own in-app reminders and displays at most three, ordered due date ascending. Failure renders none and does not break Quest Feed.
- [ ] Extend E2E: email opt-in control exists; under-18 and Safe Mode still show no commercial referral; seven Quest Feed cards remain; journey email copy never says guaranteed/approved.
- [ ] Add architecture test: reminder rules/templates cannot import `offer-matcher`, commercial routes, revenue or commission.
- [ ] Update README with migration 010, cron, three env variables, default-off email flag and service-email-only boundary.
- [ ] Run final gate:

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
```

Run local Supabase migrations/RLS as CI does.
- [ ] Commit: `test: verify V2.2B retention and email`.

## V2.2B Exit Gate

Proceed to commercial/admin only when reminder reasons/timing are deterministic, email is opt-in and runtime-disableable, missing preference fails closed, cron sending is idempotent, static copy works without AI/external cost, and no reminder/email code can affect credit strategy.
