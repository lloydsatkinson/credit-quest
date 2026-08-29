# Credit Quest V2.2B Retention & Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic in-app journey reminders and opt-in service email reminders, with persistent suppression/preferences, runtime kill switches and a provider-independent copy boundary that can support AI wording later without allowing AI to choose triggers, timing or credit strategy.

**Architecture:** Build `lib/reminders` downstream of V2.2A Journey outcomes/state. Reminder rules produce immutable reasons/due times; server repositories persist jobs/preferences; a protected daily cron atomically claims due email jobs only when the runtime flag and user preference permit it. Static approved templates are the production default. An optional copy-writer interface can rewrite wording only after a reminder exists; no AI provider or paid API is activated by this plan.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase Postgres/RLS, native `fetch`, Zod 3, Vitest 3, Playwright, Vercel Cron-compatible route handler.

**Spec:** `docs/superpowers/specs/2026-08-29-credit-quest-v2-2-journey-growth-design.md`

**Dependency:** Complete V2.2A first. Migration 009 and Journey Repository/Orchestrator are assumed present.

## Global Constraints

- Reminder selection, reason, due time and channel eligibility are deterministic.
- V2.2 email is service/journey email only. Do not add marketing campaign tables, marketing consent or promotional copy.
- `journey_email_enabled` defaults **false** until the user opts in. A missing/unreadable preference suppresses email.
- Referral consent never implies email consent; journey-email preference never implies marketing consent.
- Static approved copy is always available. Copy transformation failure falls back to static copy.
- `email_reminders_enabled` is a server-owned DB runtime flag, default false; disabling it requires no redeploy.
- Email failures never change readiness, mission state or Journey lifecycle.
- Do not duplicate the authenticated email address into reminder tables. Resolve it at send time through the service-role Auth Admin API.
- Cron delivery must be idempotent and crash recoverable: jobs are atomically claimed before send and stale claims can be reclaimed on a later run.
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

**Modify**
- `.env.example`
- `lib/server/journey-orchestrator.ts`
- `app/dashboard/page.tsx`
- `components/dashboard/dashboard-client.tsx`
- `supabase/tests/rls.sql`
- `tests/e2e/smoke.spec.ts`
- `README.md`

---

### Task 1: Add reminder, preference, runtime-flag and atomic-claim schema

**Files:** Create migration 010 and migration unit test; modify RLS tests.

- [ ] Write a RED source test asserting migration 010 creates `journey_reminders`, `communication_preferences`, `feature_flags`; seeds `email_reminders_enabled=false` and `commercial_gateway_enabled=false`; denies direct client reminder/flag writes; allows own preference read; includes `processing`, claim timestamps/attempts, dedupe uniqueness and a service-only claim RPC.
- [ ] Run `npm test -- tests/unit/reminder-migration.test.ts`; observe RED.
- [ ] Implement migration with these exact controlled fields:

```sql
create table public.journey_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('mission_incomplete','cooldown_ending','reassessment_due','readiness_changed')),
  channel text not null check (channel in ('in_app','email')),
  status text not null default 'scheduled' check (status in ('scheduled','processing','sent','suppressed','failed','cancelled')),
  due_at timestamptz not null,
  source_outcome_id uuid references public.journey_outcomes(id) on delete set null,
  source_key text not null,
  template_key text not null,
  template_version integer not null default 1 check (template_version >= 1),
  suppression_reason text,
  sent_at timestamptz,
  provider_reference text,
  ai_assist_status text not null default 'not_used' check (ai_assist_status in ('not_used','used','rejected','failed')),
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
```

Create indexes on `(status,due_at)` and `(user_id,due_at desc)`.

RLS/grants:
- authenticated own SELECT on reminders;
- no direct client reminder INSERT/UPDATE/DELETE;
- authenticated own SELECT on communication preferences;
- no direct client preference writes;
- no anon/auth access to feature flags; service-role only.

Add a service-role-only `claim_due_journey_reminders(p_limit integer, p_now timestamptz)` RPC. In one SQL statement it selects up to 100 due email rows with `FOR UPDATE SKIP LOCKED`, accepting `status='scheduled'` or stale `status='processing' AND claimed_at < p_now - interval '6 hours'`, then updates them to `processing`, increments `attempt_count`, sets `claimed_at=p_now`, and returns the claimed rows. Revoke execute from PUBLIC/anon/authenticated; grant service role only.
- [ ] Extend `supabase/tests/rls.sql` with owner/no-write/flag-private/RPC-permission checks and a duplicate reminder probe proving dedupe uniqueness.
- [ ] Run migration source test and local Supabase RLS verification GREEN.
- [ ] Commit: `feat: add reminder and runtime flag schema`.

### Task 2: Define deterministic reminder contracts, timing and templates

**Files:** Create `lib/reminders/types.ts`, `rules.ts`, `templates.ts`, `copy-writer.ts`; tests.

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
  - cooldown with `nextReviewAt`: `cooldown_ending` at exact review time;
  - deferred/in-review or Journey `nextReassessmentAt`: `reassessment_due` at exact timestamp;
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
  async write(input: ApprovedReminderCopyInput) {
    return renderApprovedReminderTemplate(input);
  }
}
```

Any future AI writer must satisfy the same interface after selection, never before.
- [ ] Run focused tests GREEN and commit: `feat: add deterministic reminder rules`.

### Task 3: Add repositories and fail-closed runtime flag reads

**Files:** Create reminder/feature flag repositories and tests.

**Repository API:**

```ts
getCommunicationPreference(adminOrServer, userId)
setJourneyEmailPreference(admin, userId, enabled, now)
listUserInAppReminders(serverClient, userId, now)
scheduleReminder(admin, input)
claimDueEmailReminders(admin, now, limit)
markReminderSent(admin, id, providerReference, now)
markReminderSuppressed(admin, id, reason, now)
releaseReminderAfterFailure(admin, id, attemptCount, reason, now)
isFeatureEnabled(admin, flagKey): Promise<boolean>
```

- [ ] RED tests enforce snake_case mapping, bounded claim limit `1..100`, owner filter for in-app reads, and fail-closed `isFeatureEnabled` returning false when row/read fails.
- [ ] `scheduleReminder` uses DB uniqueness; on duplicate, return/read existing row rather than create another.
- [ ] `claimDueEmailReminders` calls only the service RPC from Task 1, never SELECT-then-UPDATE.
- [ ] `releaseReminderAfterFailure`: if `attemptCount < 3`, return row to `scheduled`, set `due_at = now + 24 hours`, clear `claimed_at`, store a non-secret error code; otherwise set terminal `failed`. This aligns retries with the daily cron cadence.
- [ ] No repository imports from domain readiness/mission ranking.
- [ ] Run GREEN and commit: `feat: add reminder repositories`.

### Task 4: Schedule reminders from Journey outcomes

**Files:** Create `lib/server/reminder-service.ts`, tests; modify Journey Orchestrator.

- [ ] RED service tests prove in-app/email candidates share the same deterministic reason/time.
- [ ] Use the safer rule: in-app reminders may schedule for eligible Journey outcomes; email reminders schedule only when a persisted preference exists and `journey_email_enabled=true` at scheduling time.
- [ ] Missing preference/read failure => no email job. In-app remains available.
- [ ] Implement `scheduleJourneyRemindersForOutcome(...)` using Task 2 rules and Task 3 repositories.
- [ ] Hook it best-effort after `observeJourneyEvent` successfully persists Journey state/outcome. Reminder scheduling failure does not make Journey observation fail.
- [ ] Readiness-change reminder uses the actual outcome id and stable source key `readiness:${outcome.id}`.
- [ ] Run GREEN and commit: `feat: schedule journey reminders`.

### Task 5: Add email preference API and customer controls

**Files:** Create preference API/component/tests; modify dashboards.

- [ ] RED route tests: strict body `{ journeyEmailEnabled: boolean }`; reject `userId`, `marketingConsent`, referral fields; require auth; use authenticated user id only; no Supabase env returns harmless demo response without pretending persistence.
- [ ] Implement GET/PATCH with standard auth followed by server-owned write. PATCH off stores `journey_email_suppressed_at=now` and reason `user_disabled`; PATCH on clears suppression fields.
- [ ] Component copy: “Email me when it’s time to review my Credit Quest plan.” Do not use offers/deals/marketing wording.
- [ ] Add a clear off control and status feedback. Existing in-app reminders remain when email is disabled.
- [ ] Server dashboard shows preference control outside the seven-card feed. Demo stores only a labelled local demo preference.
- [ ] Run GREEN and commit: `feat: add journey email preference`.

### Task 6: Add provider transport and protected daily cron

**Files:** Create email transport/cron route/`vercel.json`; modify `.env.example`; tests.

`.env.example` additions:

```text
RESEND_API_KEY=
JOURNEY_FROM_EMAIL=
CRON_SECRET=
```

No npm dependency is required. Use native fetch only when configured.

- [ ] RED transport tests: missing API key/from email => `{ ok:false, reason:"not_configured" }` without network; configured transport posts only to `https://api.resend.com/emails`; request contains from/to/subject/html; response id captured; logs never contain the key.
- [ ] Implement `ResendEmailTransport` with injected fetch for tests.
- [ ] RED cron tests: Authorization must equal `Bearer ${CRON_SECRET}`; mismatch -> 401; feature flag false -> 204/no claim; each claimed job re-checks current preference; preference missing/disabled -> suppressed; missing Auth email -> suppressed `missing_email`; success -> sent; provider failure -> retry/failed via Task 3; one row failure does not stop later rows.
- [ ] Resolve recipient email at send time using the service client's `auth.admin.getUserById(reminder.userId)`. Do not persist the email in `journey_reminders`.
- [ ] Implement GET cron. Re-check `email_reminders_enabled` at the start and before actual transport dispatch for each batch; if it turns off, remaining claimed rows are returned/suppressed without sends.
- [ ] Use exact daily cron config:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [{ "path": "/api/cron/journey-reminders", "schedule": "0 8 * * *" }]
}
```

This intentionally trades minute-level immediacy for a low-frequency service reminder loop; in-app state remains current on every visit.
- [ ] Run focused tests GREEN and commit: `feat: deliver journey reminder emails`.

### Task 7: In-app reminders and end-to-end safety regression

**Files:** Create in-app component/tests; modify dashboard/E2E/README.

- [ ] RED component tests for due/upcoming reminders and no fake urgency.
- [ ] Server dashboard reads own in-app reminders and displays at most three, ordered due date ascending. Failure renders none and does not break Quest Feed.
- [ ] Extend E2E: email opt-in exists; under-18 and Safe Mode still show no commercial referral; seven Quest Feed cards remain; journey email copy never says guaranteed/approved.
- [ ] Add architecture test: reminder rules/templates cannot import `offer-matcher`, commercial routes, revenue or commission.
- [ ] README: migration 010, cron, env variables, default-off flag, opt-in email, daily cadence and service-email-only boundary.
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

Proceed to commercial/admin only when reminder reasons/timing are deterministic, email is opt-in and runtime-disableable, missing preference/email fails closed, cron claim/send/retry is concurrency-safe and crash recoverable, static copy works without AI/external cost, and no reminder/email code can affect credit strategy.
