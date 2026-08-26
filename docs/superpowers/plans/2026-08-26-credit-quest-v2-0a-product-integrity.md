# Credit Quest V2.0a Product Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first incremental V2 release by fixing mission lifecycle integrity, removing unsafe onboarding defaults, supporting explicit unknown answers, introducing deterministic Safe Mode offer suppression, and making analytics distinguish mission started from mission completed.

**Architecture:** Keep the existing Next.js/Supabase V1 application and evolve it in place. Extend `CreditProfile` to represent unknown values safely, add a pure safety engine and a pure mission-lifecycle engine, persist lifecycle/profile changes through the existing authenticated API/RLS boundary, and keep demo-mode behaviour in local storage using the same domain functions. Do not introduce Barrier Diagnosis, Credit Passport, Application Readiness, the TikTok-style Quest Feed, Decline Recovery, Open Banking, CRA data, or AI in this release; those are subsequent V2 plans.

**Tech Stack:** Next.js App Router 16.3.3, React 19, TypeScript 5.9, Tailwind CSS 4, Supabase Auth/Postgres/RLS, Zod, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-26-credit-quest-v2-design.md`

## Global Constraints

- Preserve the one-way customer-benefit flow: profile → safety → deterministic recommendation → optional offer.
- Affiliate commission, lender payout, campaign economics, or conversion rate must never alter safety, mission ranking, or whether a mission is shown.
- Users aged 16–17 receive no credit-product referrals; enforce this in domain/server logic, not only in UI.
- Do not infer financial distress from missing data.
- Unknown answers must remain unknown; never coerce them to `false` or `0`.
- No substantive onboarding defaults such as employed, £30k–£50k, or renting.
- Starting a mission must never mark it completed.
- Mission completion may change the underlying profile only through explicit, structured completion effects.
- Safe Mode must suppress credit offers and borrowing-oriented missions while preserving stability/payment-protection actions.
- Quest Score remains a secondary progress metric and must tolerate unknown profile values without inventing points or penalties.
- Preserve Supabase RLS and existing authentication boundaries.
- No live lender claims, approval probabilities, or real affiliate inventory are introduced in V2.0a.

---

## File map

### Domain files

- Modify `lib/domain/types.ts` — nullable/unknown-safe profile values, expanded mission states, mission progress/completion types.
- Modify `lib/domain/onboarding.ts` — unknown-safe validation and normalisation.
- Modify `lib/domain/quest-score.ts` — null-safe scoring.
- Modify `lib/domain/mission-engine.ts` — null-safe eligibility and mission-progress-aware ranking.
- Create `lib/domain/safety.ts` — deterministic `normal | caution | safe_mode` assessment.
- Create `lib/domain/mission-lifecycle.ts` — pure mission state transitions and structured completion effects.
- Modify `lib/domain/offer-matcher.ts` — hard Safe Mode suppression before matching.
- Modify `lib/data/missions.ts` — safe-mode metadata and completion effects for existing missions.

### UI/API files

- Modify `components/onboarding/onboarding-form.tsx` — unset defaults, required-step gating, Yes/No/I-don’t-know controls.
- Modify `components/dashboard/dashboard-client.tsx` — separate start/complete flows and recalculate from the updated profile.
- Modify `components/dashboard/next-mission-card.tsx` — render Start vs Complete state.
- Modify `components/dashboard/progress-strip.tsx` — expose an unambiguous missions-completed value for E2E coverage.
- Create `app/api/missions/[slug]/route.ts` — authenticated mission action endpoint.
- Modify `app/api/onboarding/route.ts` — persist null values without coercion.
- Modify `lib/events.ts` — lifecycle event helpers remain strictly validated.

### Database

- Create `supabase/migrations/002_v2_product_integrity.sql` — nullable unknown-safe fields, expanded lifecycle states and timestamps.
- Modify `supabase/tests/rls.sql` — cover new mission update paths without weakening RLS.

### Tests

- Modify `tests/integration/onboarding-flow.test.ts`.
- Modify `tests/unit/onboarding-form.test.tsx`.
- Modify `tests/unit/quest-score.test.ts`.
- Modify `tests/unit/mission-engine.test.ts`.
- Create `tests/unit/safety.test.ts`.
- Create `tests/unit/mission-lifecycle.test.ts`.
- Modify `tests/unit/offer-matcher.test.ts`.
- Modify `tests/unit/dashboard-components.test.tsx`.
- Modify `tests/unit/events.test.ts`.
- Modify `tests/e2e/smoke.spec.ts`.

---

### Task 1: Make the canonical profile unknown-safe

**Files:**
- Modify: `lib/domain/types.ts`
- Modify: `lib/domain/onboarding.ts`
- Modify: `lib/domain/quest-score.ts`
- Modify: `lib/domain/mission-engine.ts`
- Modify: `lib/data/missions.ts`
- Test: `tests/integration/onboarding-flow.test.ts`
- Test: `tests/unit/quest-score.test.ts`
- Test: `tests/unit/mission-engine.test.ts`

**Interfaces:**
- Produces `CreditProfile` where `electoralRoll`, `missedPaymentsLast12m`, `hardApplicationsLast6m`, `hasRevolvingCredit`, and `hasDirectDebitForCredit` may be `null` when unknown.
- Produces a broader `MissionState` union used by later lifecycle tasks.
- Keeps `utilisationPct: number | null`, where `null` means unavailable/unknown; when `hasRevolvingCredit === false`, utilisation is contextually not applicable.

- [ ] **Step 1: Write failing onboarding tests for explicit unknown values**

Add to `tests/integration/onboarding-flow.test.ts`:

```ts
it("preserves unknown credit-file answers instead of converting them to zero or false", () => {
  const result = normaliseOnboardingAnswers({
    ...answers,
    electoralRoll: null,
    utilisationPct: null,
    missedPaymentsLast12m: null,
    hardApplicationsLast6m: null,
    hasRevolvingCredit: null,
    hasDirectDebitForCredit: null,
  }, "u1", now);

  expect(result.profile.electoralRoll).toBeNull();
  expect(result.profile.missedPaymentsLast12m).toBeNull();
  expect(result.profile.hardApplicationsLast6m).toBeNull();
  expect(result.profile.hasRevolvingCredit).toBeNull();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- tests/integration/onboarding-flow.test.ts
```

Expected: TypeScript/Vitest failure because current `OnboardingAnswers` does not accept the nullable boolean/integer fields.

- [ ] **Step 3: Expand the domain types deliberately**

Change the relevant part of `CreditProfile` in `lib/domain/types.ts` to:

```ts
export type MissionState =
  | "eligible"
  | "shown"
  | "not_started"
  | "started"
  | "completed"
  | "deferred"
  | "dismissed"
  | "in_review"
  | "cooldown"
  | "no_longer_eligible";

export interface CreditProfile {
  userId: string;
  dateOfBirth: string;
  employmentStatus: "employed" | "self_employed" | "student" | "unemployed" | "other";
  incomeBand: "under_15k" | "15_30k" | "30_50k" | "50k_plus" | "not_applicable";
  housingStatus: "owner" | "mortgage" | "rent" | "family" | "other";
  electoralRoll: boolean | null;
  utilisationPct: number | null;
  missedPaymentsLast12m: number | null;
  hardApplicationsLast6m: number | null;
  hasRevolvingCredit: boolean | null;
  hasDirectDebitForCredit: boolean | null;
}
```

Add lifecycle support types:

```ts
export interface MissionProgress {
  state: MissionState;
  startedAt?: string | null;
  completedAt?: string | null;
  nextReviewAt?: string | null;
}

export type MissionProgressMap = Record<string, MissionProgress | undefined>;

export type CompletionEffect =
  | { type: "set_profile_value"; field: "electoralRoll"; value: true }
  | { type: "set_profile_value"; field: "hasDirectDebitForCredit"; value: true }
  | { type: "set_profile_value"; field: "hasRevolvingCredit"; value: true };
```

Add these fields to `MissionDefinition`:

```ts
safeModeAllowed: boolean;
reviewPeriodDays?: number;
completionEffect?: CompletionEffect;
```

- [ ] **Step 4: Update onboarding validation without turning unknown into defaults**

Change the relevant schema fields in `lib/domain/onboarding.ts` to:

```ts
electoralRoll: z.boolean().nullable(),
utilisationPct: z.number().min(0).max(100).nullable(),
missedPaymentsLast12m: z.number().int().min(0).max(24).nullable(),
hardApplicationsLast6m: z.number().int().min(0).max(30).nullable(),
hasRevolvingCredit: z.boolean().nullable(),
hasDirectDebitForCredit: z.boolean().nullable(),
```

Normalise contextual non-applicability only when it is actually known:

```ts
const hasRevolvingCredit = parsed.hasRevolvingCredit;
const utilisationPct = hasRevolvingCredit === false ? null : parsed.utilisationPct;
const hasDirectDebitForCredit = hasRevolvingCredit === false ? null : parsed.hasDirectDebitForCredit;

return {
  profile: {
    userId,
    ...parsed,
    incomeBand,
    utilisationPct,
    hasDirectDebitForCredit,
  },
  ageMode: getAgeMode(parsed.dateOfBirth, now),
};
```

- [ ] **Step 5: Make Quest Score null-safe**

Update checks in `lib/domain/quest-score.ts` so unknowns contribute neither positive nor negative points:

```ts
if ((profile.missedPaymentsLast12m ?? 0) > 0) {
  const penalty = Math.min((profile.missedPaymentsLast12m ?? 0) * 15, 30);
  score -= penalty;
  factors.push(`-${penalty} for missed payments in the last 12 months`);
}

if ((profile.hardApplicationsLast6m ?? 0) > 1) {
  const penalty = Math.min(((profile.hardApplicationsLast6m ?? 0) - 1) * 5, 15);
  score -= penalty;
  factors.push(`-${penalty} for multiple recent hard credit applications`);
}

if (profile.hasRevolvingCredit === true) {
  score += 5;
  factors.push("+5 for having revolving credit history");
}

if (profile.hasDirectDebitForCredit === true) {
  score += 5;
  factors.push("+5 for using a direct debit to reduce missed-payment risk");
}
```

Add a unit test asserting a fully unknown credit section does not receive positive points or penalties.

- [ ] **Step 6: Make the five current missions explicit about unknowns**

In `lib/data/missions.ts`, use strict comparisons so missing information does not manufacture eligibility:

```ts
isEligible: (profile) => profile.electoralRoll === false
```

```ts
isEligible: (profile) => profile.utilisationPct !== null && profile.utilisationPct > 30
```

```ts
isEligible: (profile) => profile.hasRevolvingCredit === true && profile.hasDirectDebitForCredit === false
```

```ts
isEligible: (profile) => (profile.hardApplicationsLast6m ?? 0) >= 3
```

```ts
isEligible: (profile) => profile.hasRevolvingCredit === false && profile.missedPaymentsLast12m === 0
```

Set `safeModeAllowed: true` for electoral roll, utilisation reduction, direct debit, and application cooldown. Set `safeModeAllowed: false` for `build-revolving-history`.

Add completion effects only where the user can explicitly confirm a real state change:

```ts
completionEffect: { type: "set_profile_value", field: "electoralRoll", value: true }
```

for electoral roll, and:

```ts
completionEffect: { type: "set_profile_value", field: "hasDirectDebitForCredit", value: true }
```

for direct debit. Do not attach a completion effect to utilisation reduction or application cooldown in V2.0a because simply pressing Complete does not prove a new percentage or passage of time.

- [ ] **Step 7: Run domain tests and verify GREEN**

Run:

```bash
npm test -- tests/integration/onboarding-flow.test.ts tests/unit/quest-score.test.ts tests/unit/mission-engine.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 8: Commit**

```bash
git add lib/domain/types.ts lib/domain/onboarding.ts lib/domain/quest-score.ts lib/domain/mission-engine.ts lib/data/missions.ts tests/integration/onboarding-flow.test.ts tests/unit/quest-score.test.ts tests/unit/mission-engine.test.ts
git commit -m "feat: make credit profile unknown-safe"
```

---

### Task 2: Remove substantive onboarding defaults and add explicit unknown controls

**Files:**
- Modify: `components/onboarding/onboarding-form.tsx`
- Test: `tests/unit/onboarding-form.test.tsx`
- Modify: `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes the nullable `OnboardingAnswers` fields from Task 1.
- Produces only explicit user answers; required non-technical questions cannot advance while unset.

- [ ] **Step 1: Write failing component tests for unset defaults**

Add:

```ts
it("does not preselect employment or income", () => {
  goToWorkStep();
  expect(screen.getByLabelText("Employment status")).toHaveValue("");
  expect(screen.queryByLabelText("Annual personal income band")).toBeNull();
});

it("asks for income only after an applicable employment choice", () => {
  goToWorkStep();
  fireEvent.change(screen.getByLabelText("Employment status"), { target: { value: "employed" } });
  expect(screen.getByLabelText("Annual personal income band")).toHaveValue("");
});

it("lets the user explicitly say they do not know electoral-roll status", () => {
  goToWorkStep();
  fireEvent.change(screen.getByLabelText("Employment status"), { target: { value: "employed" } });
  fireEvent.change(screen.getByLabelText("Annual personal income band"), { target: { value: "30_50k" } });
  fireEvent.click(screen.getByTestId("next"));
  fireEvent.change(screen.getByLabelText("Housing situation"), { target: { value: "rent" } });
  fireEvent.click(screen.getByTestId("next"));
  fireEvent.click(screen.getByRole("button", { name: "I don't know" }));
  expect(screen.getByRole("button", { name: "I don't know" })).toHaveAttribute("aria-pressed", "true");
});
```

- [ ] **Step 2: Run the component test and verify RED**

```bash
npm test -- tests/unit/onboarding-form.test.tsx
```

Expected: failures showing preselected `employed`, `30_50k`, or existing two-state controls.

- [ ] **Step 3: Introduce an onboarding draft instead of pretending unset values are profile values**

```ts
type OnboardingDraft = Omit<OnboardingAnswers, "employmentStatus" | "incomeBand" | "housingStatus"> & {
  employmentStatus: OnboardingAnswers["employmentStatus"] | null;
  incomeBand: OnboardingAnswers["incomeBand"] | null;
  housingStatus: OnboardingAnswers["housingStatus"] | null;
};

const initial: OnboardingDraft = {
  dateOfBirth: "",
  employmentStatus: null,
  incomeBand: null,
  housingStatus: null,
  electoralRoll: null,
  utilisationPct: null,
  missedPaymentsLast12m: null,
  hardApplicationsLast6m: null,
  hasRevolvingCredit: null,
  hasDirectDebitForCredit: null,
};

const [answered, setAnswered] = useState<Set<string>>(() => new Set());

function markAnswered(key: string) {
  setAnswered((current) => new Set(current).add(key));
}
```

- [ ] **Step 4: Render blank-select placeholders instead of financial defaults**

Update `Select` to accept `placeholder: string` and render:

```tsx
<select
  aria-label={ariaLabel}
  className="field w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
  value={value}
  onChange={(e) => onChange(e.target.value)}
>
  <option value="" disabled>{placeholder}</option>
  {options.map((option) => (
    <option key={option} value={option}>{option.replaceAll("_", " ")}</option>
  ))}
</select>
```

Employment must pass `placeholder="Choose one"` and `value={answers.employmentStatus ?? ""}`. Income renders only once an applicable employment status is known and passes `value={answers.incomeBand ?? ""}`. Housing begins blank and passes `value={answers.housingStatus ?? ""}`.

- [ ] **Step 5: Add a reusable tri-state control**

```tsx
function YesNoUnknown({
  value,
  onChange,
  label,
}: {
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  label?: string;
}) {
  const options = [
    { label: "Yes", value: true },
    { label: "No", value: false },
    { label: "I don't know", value: null },
  ] as const;

  return (
    <div>
      {label && <p className="mb-2 text-sm font-bold">{label}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={value === option.value}
            className={`rounded-2xl border px-4 py-3 font-bold ${value === option.value ? "border-violet-600 bg-violet-50 text-violet-700" : "border-slate-200"}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

Use it for electoral-roll status and revolving-credit presence. For a known revolving account, use it for direct debit. Each handler calls `markAnswered()` for its question key.

- [ ] **Step 6: Make utilisation, missed payments, and hard-search counts explicitly skippable as unknown**

For utilisation:

```ts
setAnswers((current) => ({ ...current, utilisationPct: null }));
markAnswered("utilisationPct");
```

For missed payments:

```ts
setAnswers((current) => ({ ...current, missedPaymentsLast12m: null }));
markAnswered("missedPaymentsLast12m");
```

For hard searches:

```ts
setAnswers((current) => ({ ...current, hardApplicationsLast6m: null }));
markAnswered("hardApplicationsLast6m");
```

Numeric handlers must never use `Number("")`:

```ts
const value = event.target.value;
setAnswers((current) => ({
  ...current,
  hardApplicationsLast6m: value === "" ? null : Number(value),
}));
if (value !== "") markAnswered("hardApplicationsLast6m");
```

- [ ] **Step 7: Gate progression on explicit interaction**

```ts
function canContinue(step: number, answers: OnboardingDraft, answered: Set<string>): boolean {
  switch (step) {
    case 0:
      return Boolean(answers.dateOfBirth);
    case 1:
      return Boolean(answers.employmentStatus) &&
        (answers.employmentStatus === "unemployed" || answers.incomeBand !== null);
    case 2:
      return Boolean(answers.housingStatus);
    case 3:
      return answered.has("electoralRoll");
    case 4:
      return answered.has("hasRevolvingCredit") &&
        (answers.hasRevolvingCredit !== true || answered.has("utilisationPct"));
    case 5:
      return answered.has("missedPaymentsLast12m") &&
        (answers.hasRevolvingCredit !== true || answered.has("hasDirectDebitForCredit"));
    case 6:
      return answered.has("hardApplicationsLast6m");
    default:
      return true;
  }
}
```

Set `disabled={!canContinue(step, answers, answered)}` on Next.

- [ ] **Step 8: Update Playwright onboarding helper to choose explicit values**

In `tests/e2e/smoke.spec.ts`, select `employed`, `30_50k`, and `rent`, and explicitly answer every tri-state/numeric question. Do not depend on previous defaults.

- [ ] **Step 9: Run tests and verify GREEN**

```bash
npm test -- tests/unit/onboarding-form.test.tsx
npm run test:e2e -- tests/e2e/smoke.spec.ts
```

Expected: onboarding component tests and existing journeys pass using explicit answers.

- [ ] **Step 10: Commit**

```bash
git add components/onboarding/onboarding-form.tsx tests/unit/onboarding-form.test.tsx tests/e2e/smoke.spec.ts
git commit -m "fix: remove unsafe onboarding defaults"
```

---

### Task 3: Migrate Supabase for unknown-safe profiles and real mission lifecycle

**Files:**
- Create: `supabase/migrations/002_v2_product_integrity.sql`
- Modify: `supabase/tests/rls.sql`
- Modify: `app/api/onboarding/route.ts`

**Interfaces:**
- Stores nullable unknown fields without coercion.
- Supports every V2 mission state in the database.
- Adds lifecycle timestamps used by the mission API and dashboard.

- [ ] **Step 1: Write the migration**

```sql
alter table public.profiles alter column electoral_roll drop not null;
alter table public.profiles alter column electoral_roll drop default;
alter table public.profiles alter column missed_payments_last_12m drop not null;
alter table public.profiles alter column missed_payments_last_12m drop default;
alter table public.profiles alter column hard_applications_last_6m drop not null;
alter table public.profiles alter column hard_applications_last_6m drop default;
alter table public.profiles alter column has_revolving_credit drop not null;
alter table public.profiles alter column has_revolving_credit drop default;
alter table public.profiles alter column has_direct_debit_for_credit drop not null;
alter table public.profiles alter column has_direct_debit_for_credit drop default;

alter table public.user_missions
  drop constraint if exists user_missions_valid_state;

alter table public.user_missions
  add constraint user_missions_valid_state
  check (state in (
    'eligible', 'shown', 'not_started', 'started', 'completed',
    'deferred', 'dismissed', 'in_review', 'cooldown', 'no_longer_eligible'
  ));

alter table public.user_missions
  add column if not exists started_at timestamptz,
  add column if not exists deferred_at timestamptz,
  add column if not exists dismissed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
```

Do not remove or weaken any existing RLS policy.

- [ ] **Step 2: Extend RLS verification SQL with exact policy checks**

Replace the existing `missions_update_own` check in `supabase/tests/rls.sql` with:

```sql
if not exists (
  select 1 from pg_policies
  where schemaname = 'public'
    and tablename = 'user_missions'
    and policyname = 'missions_update_own'
    and cmd = 'UPDATE'
    and qual like '%auth.uid()%user_id%'
    and with_check like '%auth.uid()%user_id%'
) then
  raise exception 'user_missions owner-update policy missing or not owner-scoped';
end if;
```

Keep the existing `profiles_select_own` and no-event-select assertions unchanged.

- [ ] **Step 3: Keep onboarding API values nullable end-to-end**

```ts
missed_payments_last_12m: profile.missedPaymentsLast12m,
hard_applications_last_6m: profile.hardApplicationsLast6m,
has_revolving_credit: profile.hasRevolvingCredit,
has_direct_debit_for_credit: profile.hasDirectDebitForCredit,
electoral_roll: profile.electoralRoll,
```

Do not use `?? 0` or `?? false`.

- [ ] **Step 4: Verify migration locally or in CI**

```bash
npx supabase db reset
```

Expected: both migrations apply cleanly and RLS policies remain enabled. If local Supabase is unavailable, do not claim this check passed; verify the live migration separately before production deployment.

- [ ] **Step 5: Run application tests**

```bash
npm test
```

Expected: no domain/UI regression from nullable persistence changes.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/002_v2_product_integrity.sql supabase/tests/rls.sql app/api/onboarding/route.ts
git commit -m "feat: migrate profile and mission lifecycle data"
```

---

### Task 4: Add deterministic Safe Mode and suppress unsafe offers

**Files:**
- Create: `lib/domain/safety.ts`
- Modify: `lib/domain/offer-matcher.ts`
- Modify: `lib/domain/mission-engine.ts`
- Create: `tests/unit/safety.test.ts`
- Modify: `tests/unit/offer-matcher.test.ts`
- Modify: `tests/unit/mission-engine.test.ts`

**Interfaces:**
- Produces `assessSafety(profile): SafetyAssessment`.
- `getOffersForMission` and `getMarketplaceOffers` return `[]` when `assessment.suppressOffers` is true.
- Mission ranking filters out `safeModeAllowed === false` missions while Safe Mode is active.

- [ ] **Step 1: Write failing Safe Mode tests**

Create `tests/unit/safety.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assessSafety } from "@/lib/domain/safety";
import type { CreditProfile } from "@/lib/domain/types";

const base: CreditProfile = {
  userId: "u1",
  dateOfBirth: "1990-01-01",
  employmentStatus: "employed",
  incomeBand: "30_50k",
  housingStatus: "rent",
  electoralRoll: true,
  utilisationPct: 30,
  missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 0,
  hasRevolvingCredit: true,
  hasDirectDebitForCredit: true,
};

describe("assessSafety", () => {
  it("does not treat unknown data as distress", () => {
    const result = assessSafety({ ...base, missedPaymentsLast12m: null, hardApplicationsLast6m: null });
    expect(result.mode).toBe("normal");
    expect(result.suppressOffers).toBe(false);
  });

  it("enters safe mode for repeated missed payments plus repeated recent applications", () => {
    const result = assessSafety({ ...base, missedPaymentsLast12m: 2, hardApplicationsLast6m: 4 });
    expect(result.mode).toBe("safe_mode");
    expect(result.suppressOffers).toBe(true);
  });

  it("uses caution for one meaningful stress signal", () => {
    expect(assessSafety({ ...base, missedPaymentsLast12m: 2 }).mode).toBe("caution");
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- tests/unit/safety.test.ts
```

Expected: fail because `lib/domain/safety.ts` does not exist.

- [ ] **Step 3: Implement the minimal auditable safety engine**

```ts
import type { CreditProfile } from "@/lib/domain/types";

export type SafetyMode = "normal" | "caution" | "safe_mode";

export interface SafetyAssessment {
  mode: SafetyMode;
  reasons: string[];
  suppressOffers: boolean;
}

export function assessSafety(profile: CreditProfile): SafetyAssessment {
  const reasons: string[] = [];
  const repeatedMissedPayments = (profile.missedPaymentsLast12m ?? 0) >= 2;
  const repeatedApplications = (profile.hardApplicationsLast6m ?? 0) >= 3;

  if (repeatedMissedPayments) reasons.push("You reported multiple missed payments in the last 12 months.");
  if (repeatedApplications) reasons.push("You reported several recent hard credit applications.");

  if (repeatedMissedPayments && repeatedApplications) {
    return { mode: "safe_mode", reasons, suppressOffers: true };
  }

  if (repeatedMissedPayments || repeatedApplications) {
    return { mode: "caution", reasons, suppressOffers: false };
  }

  return { mode: "normal", reasons: [], suppressOffers: false };
}
```

Do not infer overdraft dependency, disposable income, debt-service burden, or vulnerability until those data exist.

- [ ] **Step 4: Put safety ahead of offer matching**

In both offer functions:

```ts
const safety = assessSafety(profile);
if (safety.suppressOffers) return [];
```

- [ ] **Step 5: Put safety ahead of borrowing-oriented mission ranking**

```ts
const safety = assessSafety(profile);

return MISSION_CATALOGUE
  .filter((mission) => safety.mode !== "safe_mode" || mission.safeModeAllowed)
  .filter((mission) => mission.isEligible(profile, now))
```

- [ ] **Step 6: Add regression tests for suppressed offers and missions**

```ts
it("suppresses all offers in safe mode", () => {
  const stressed = { ...base, missedPaymentsLast12m: 2, hardApplicationsLast6m: 4 };
  expect(getOffersForMission(stressed, mission)).toEqual([]);
});
```

Add a mission-engine test asserting that a borrowing-oriented mission is filtered while `application-cooldown` remains available for the same safe-mode profile.

- [ ] **Step 7: Run and verify GREEN**

```bash
npm test -- tests/unit/safety.test.ts tests/unit/offer-matcher.test.ts tests/unit/mission-engine.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 8: Commit**

```bash
git add lib/domain/safety.ts lib/domain/offer-matcher.ts lib/domain/mission-engine.ts tests/unit/safety.test.ts tests/unit/offer-matcher.test.ts tests/unit/mission-engine.test.ts
git commit -m "feat: add safe mode offer suppression"
```

---

### Task 5: Build a pure mission lifecycle engine with explicit completion effects

**Files:**
- Create: `lib/domain/mission-lifecycle.ts`
- Modify: `lib/domain/mission-engine.ts`
- Create: `tests/unit/mission-lifecycle.test.ts`
- Modify: `tests/unit/mission-engine.test.ts`

**Interfaces:**
- Produces `startMission(progress, now)` and `completeMission(profile, mission, progress, now)`.
- Produces `applyCompletionEffect(profile, effect)`.
- Mission ranking accepts optional `MissionProgressMap` and excludes completed/deferred/dismissed/cooldown missions appropriately.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
it("starting a mission does not complete it", () => {
  const progress = startMission(undefined, new Date("2026-08-26T12:00:00Z"));
  expect(progress.state).toBe("started");
  expect(progress.completedAt).toBeNull();
});

it("completing the direct-debit mission updates the underlying profile", () => {
  const mission = MISSION_CATALOGUE.find((item) => item.slug === "set-up-direct-debit")!;
  const result = completeMission(baseProfile, mission, { state: "started" }, new Date("2026-08-26T12:00:00Z"));
  expect(result.progress.state).toBe("completed");
  expect(result.profile.hasDirectDebitForCredit).toBe(true);
});

it("completion does not fabricate a profile change when no effect exists", () => {
  const mission = MISSION_CATALOGUE.find((item) => item.slug === "reduce-utilisation")!;
  const result = completeMission(baseProfile, mission, { state: "started" }, new Date("2026-08-26T12:00:00Z"));
  expect(result.profile.utilisationPct).toBe(baseProfile.utilisationPct);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- tests/unit/mission-lifecycle.test.ts
```

Expected: fail because lifecycle functions do not exist.

- [ ] **Step 3: Implement lifecycle transitions as pure functions**

```ts
import type { CompletionEffect, CreditProfile, MissionDefinition, MissionProgress } from "@/lib/domain/types";

export function startMission(current: MissionProgress | undefined, now = new Date()): MissionProgress {
  return {
    ...current,
    state: "started",
    startedAt: current?.startedAt ?? now.toISOString(),
    completedAt: null,
    nextReviewAt: current?.nextReviewAt ?? null,
  };
}

export function applyCompletionEffect(profile: CreditProfile, effect?: CompletionEffect): CreditProfile {
  if (!effect) return profile;
  if (effect.type === "set_profile_value") return { ...profile, [effect.field]: effect.value };
  return profile;
}

export function completeMission(
  profile: CreditProfile,
  mission: MissionDefinition,
  current: MissionProgress | undefined,
  now = new Date(),
): { profile: CreditProfile; progress: MissionProgress } {
  const completedAt = now.toISOString();
  return {
    profile: applyCompletionEffect(profile, mission.completionEffect),
    progress: {
      ...current,
      state: "completed",
      startedAt: current?.startedAt ?? completedAt,
      completedAt,
      nextReviewAt: mission.reviewPeriodDays
        ? new Date(now.getTime() + mission.reviewPeriodDays * 86_400_000).toISOString()
        : null,
    },
  };
}
```

- [ ] **Step 4: Make mission ranking progress-aware**

Use exact signatures:

```ts
export function rankMissions(
  profile: CreditProfile,
  now = new Date(),
  progress: MissionProgressMap = {},
): RankedMission[]
```

```ts
export function getNextBestMission(
  profile: CreditProfile,
  now = new Date(),
  progress: MissionProgressMap = {},
): RankedMission | null
```

Add:

```ts
function isAvailableByProgress(slug: string, progress: MissionProgressMap, now: Date): boolean {
  const current = progress[slug];
  if (!current) return true;
  if (["completed", "dismissed", "no_longer_eligible"].includes(current.state)) return false;
  if (["deferred", "cooldown", "in_review"].includes(current.state) && current.nextReviewAt) {
    return new Date(current.nextReviewAt) <= now;
  }
  return true;
}
```

Filter with `isAvailableByProgress` and add:

```ts
const startedBoost = progress[mission.slug]?.state === "started" ? 1000 : 0;
priorityScore: missionPriority(profile, mission.slug, mission.priorityWeight) + startedBoost
```

- [ ] **Step 5: Add ranking regression tests**

```ts
it("does not return a completed mission even when profile eligibility still matches", () => {
  const progress = { "reduce-utilisation": { state: "completed" as const } };
  expect(rankMissions({ ...base, utilisationPct: 60 }, now, progress).some((item) => item.mission.slug === "reduce-utilisation")).toBe(false);
});

it("keeps a started mission ahead of other eligible missions", () => {
  const progress = { "set-up-direct-debit": { state: "started" as const } };
  expect(getNextBestMission({ ...base, hasRevolvingCredit: true, hasDirectDebitForCredit: false }, now, progress)?.mission.slug).toBe("set-up-direct-debit");
});
```

- [ ] **Step 6: Run focused tests and verify GREEN**

```bash
npm test -- tests/unit/mission-lifecycle.test.ts tests/unit/mission-engine.test.ts
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add lib/domain/mission-lifecycle.ts lib/domain/mission-engine.ts tests/unit/mission-lifecycle.test.ts tests/unit/mission-engine.test.ts
git commit -m "feat: add real mission lifecycle"
```

---

### Task 6: Persist mission actions and completion effects through the authenticated boundary

**Files:**
- Create: `app/api/missions/[slug]/route.ts`
- Modify: `lib/events.ts`
- Test: `tests/unit/events.test.ts`

**Interfaces:**
- `POST /api/missions/:slug` accepts `{ action: "start" | "complete" | "defer" | "dismiss" }`.
- Server derives `user_id` from Supabase auth; client never supplies a trusted user id.
- Demo mode returns a deterministic response without server persistence; client stores demo state locally.

- [ ] **Step 1: Add strict mission-action validation**

```ts
const missionActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }).strict(),
  z.object({ action: z.literal("complete") }).strict(),
  z.object({ action: z.literal("defer") }).strict(),
  z.object({ action: z.literal("dismiss") }).strict(),
]);
```

Use the Next.js 16 route signature:

```ts
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
```

- [ ] **Step 2: Resolve the mission from the server-owned catalogue**

```ts
const mission = MISSION_CATALOGUE.find((item) => item.slug === slug);
if (!mission) return NextResponse.json({ error: "Unknown mission" }, { status: 404 });
```

Never accept mission priority, completion effect, referral category, or profile patch from the client.

- [ ] **Step 3: Implement demo-mode response**

```ts
if (!env) {
  return NextResponse.json({ mode: "demo", action: parsed.data.action, missionSlug: mission.slug });
}
```

- [ ] **Step 4: Map the authenticated profile row exactly**

After `supabase.auth.getUser()`, load the user’s profile with `.single()` and map:

```ts
const profile: CreditProfile = {
  userId: row.user_id,
  dateOfBirth: row.date_of_birth,
  employmentStatus: row.employment_status,
  incomeBand: row.income_band,
  housingStatus: row.housing_status,
  electoralRoll: row.electoral_roll,
  utilisationPct: row.utilisation_pct === null ? null : Number(row.utilisation_pct),
  missedPaymentsLast12m: row.missed_payments_last_12m,
  hardApplicationsLast6m: row.hard_applications_last_6m,
  hasRevolvingCredit: row.has_revolving_credit,
  hasDirectDebitForCredit: row.has_direct_debit_for_credit,
};
```

Reject a missing profile with `404` rather than fabricating demo data.

- [ ] **Step 5: Map current mission state and perform the action**

```ts
const currentProgress: MissionProgress | undefined = missionRow
  ? {
      state: missionRow.state,
      startedAt: missionRow.started_at,
      completedAt: missionRow.completed_at,
      nextReviewAt: missionRow.next_review_at,
    }
  : undefined;

const now = new Date();
let nextProfile = profile;
let nextProgress: MissionProgress;

if (parsed.data.action === "start") {
  nextProgress = startMission(currentProgress, now);
} else if (parsed.data.action === "complete") {
  const result = completeMission(profile, mission, currentProgress, now);
  nextProfile = result.profile;
  nextProgress = result.progress;
} else if (parsed.data.action === "defer") {
  nextProgress = {
    ...currentProgress,
    state: "deferred",
    nextReviewAt: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
  };
} else {
  nextProgress = { ...currentProgress, state: "dismissed", nextReviewAt: null };
}
```

- [ ] **Step 6: Persist mission state and supported profile effects**

```ts
const missionWrite = {
  user_id: user.id,
  mission_slug: mission.slug,
  state: nextProgress.state,
  started_at: nextProgress.startedAt ?? null,
  completed_at: nextProgress.completedAt ?? null,
  next_review_at: nextProgress.nextReviewAt ?? null,
  deferred_at: nextProgress.state === "deferred" ? now.toISOString() : null,
  dismissed_at: nextProgress.state === "dismissed" ? now.toISOString() : null,
  updated_at: now.toISOString(),
};
```

If `nextProfile !== profile`, update only server-owned supported fields:

```ts
const profileWrite = {
  electoral_roll: nextProfile.electoralRoll,
  has_direct_debit_for_credit: nextProfile.hasDirectDebitForCredit,
  has_revolving_credit: nextProfile.hasRevolvingCredit,
  updated_at: now.toISOString(),
};
```

If either required write fails, return `500` and do not emit a success event. Return only after success:

```ts
return NextResponse.json({
  missionSlug: mission.slug,
  action: parsed.data.action,
  profile: nextProfile,
  progress: nextProgress,
});
```

- [ ] **Step 7: Track lifecycle events only after successful actions**

```ts
const eventNameByAction = {
  start: "mission_started",
  complete: "mission_completed",
  defer: "mission_deferred",
  dismiss: "mission_dismissed",
} as const;
```

Insert using server-derived `user_id` and metadata `{ missionSlug: mission.slug }`. Extend `tests/unit/events.test.ts` so `mission_started` and `mission_completed` validate while unsupported names still fail.

- [ ] **Step 8: Run tests**

```bash
npm test -- tests/unit/events.test.ts tests/unit/mission-lifecycle.test.ts
```

Expected: pass.

- [ ] **Step 9: Commit**

```bash
git add app/api/missions/[slug]/route.ts lib/events.ts tests/unit/events.test.ts
git commit -m "feat: persist mission lifecycle actions"
```

---

### Task 7: Make the dashboard show real Start and Complete states and recalculate from customer state

**Files:**
- Modify: `components/dashboard/dashboard-client.tsx`
- Modify: `components/dashboard/next-mission-card.tsx`
- Modify: `components/dashboard/progress-strip.tsx`
- Modify: `tests/unit/dashboard-components.test.tsx`
- Modify: `tests/e2e/smoke.spec.ts`

**Interfaces:**
- `NextMissionCard` receives current mission progress and separate callbacks for start and complete.
- Dashboard persists demo profile + mission progress in local storage using the same pure lifecycle functions.
- Completing a mission recalculates Quest Score and mission ranking from the resulting profile/progress map.

- [ ] **Step 1: Write failing component tests for separate lifecycle buttons**

```ts
it("shows Start before a mission has begun", () => {
  render(<NextMissionCard rankedMission={rankedMission} progress={{ state: "not_started" }} />);
  expect(screen.getByRole("button", { name: "Start this mission" })).not.toBeNull();
  expect(screen.queryByRole("button", { name: "Mark complete" })).toBeNull();
});

it("shows Mark complete after a mission has started", () => {
  render(<NextMissionCard rankedMission={rankedMission} progress={{ state: "started" }} />);
  expect(screen.getByRole("button", { name: "Mark complete" })).not.toBeNull();
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- tests/unit/dashboard-components.test.tsx
```

Expected: fail because the current component has only one Start button.

- [ ] **Step 3: Refactor `NextMissionCard` to exact lifecycle props**

```ts
export function NextMissionCard({
  rankedMission,
  progress,
  offer,
  reviewTiming,
  onStart,
  onComplete,
  onDefer,
}: {
  rankedMission: RankedMission;
  progress?: MissionProgress;
  offer?: OfferDefinition;
  reviewTiming?: string;
  onStart?: () => void;
  onComplete?: () => void;
  onDefer?: () => void;
})
```

Render `Start this mission` when state is absent/not-started/shown/eligible. Render `Mark complete` when state is `started`. Add `Do this later` calling `onDefer`.

- [ ] **Step 4: Replace the fake completed counter with mission progress state**

Remove the current `startMission()` counter increment.

```ts
const DEMO_PROGRESS_KEY = "creditquest-mission-progress";
```

Hydrate:

```ts
const savedProgress = localStorage.getItem(DEMO_PROGRESS_KEY);
if (savedProgress) setProgress(JSON.parse(savedProgress));
```

Rank using:

```ts
const rankedMission = getNextBestMission(profile, new Date(), progress);
```

Derive completed count:

```ts
const completed = Object.values(progress).filter((item) => item?.state === "completed").length;
```

- [ ] **Step 5: Implement Start**

Demo mode:

```ts
const nextProgress = {
  ...progress,
  [slug]: startMission(progress[slug]),
};
setProgress(nextProgress);
localStorage.setItem(DEMO_PROGRESS_KEY, JSON.stringify(nextProgress));
```

Configured mode: POST `{ action: "start" }` to `/api/missions/${slug}` and update local UI only after success.

- [ ] **Step 6: Implement explicit completion and recalculation**

Demo mode:

```ts
const result = completeMission(profile, rankedMission.mission, progress[slug]);
const nextProgress = { ...progress, [slug]: result.progress };
setProfile(result.profile);
setProgress(nextProgress);
localStorage.setItem("creditquest-profile", JSON.stringify(result.profile));
localStorage.setItem(DEMO_PROGRESS_KEY, JSON.stringify(nextProgress));
```

Configured mode: POST `{ action: "complete" }`, then assign the returned profile and progress before recomputing. Never increment score manually.

- [ ] **Step 7: Surface Safe Mode plainly**

When `assessSafety(profile).mode === "safe_mode"`, render:

```text
Protecting your finances comes first right now.

Based on the information you gave us, we’re pausing credit-product suggestions and prioritising actions that help protect payments and financial stability.
```

- [ ] **Step 8: Make missions-completed E2E-safe and prove start is not completion**

In `ProgressStrip`, add `data-testid="missions-done"` only to the value element for `Missions done`.

Update E2E:

```ts
await page.getByRole("button", { name: "Start this mission" }).click();
await expect(page.getByRole("button", { name: "Mark complete" })).toBeVisible();
await expect(page.getByTestId("missions-done")).toHaveText("0");
await page.getByRole("button", { name: "Mark complete" }).click();
await expect(page.getByTestId("missions-done")).toHaveText("1");
```

Use a profile whose first mission is `register-electoral-roll`; after completion assert that mission is no longer the next mission.

- [ ] **Step 9: Run focused component and E2E tests**

```bash
npm test -- tests/unit/dashboard-components.test.tsx
npm run test:e2e -- tests/e2e/smoke.spec.ts
```

Expected: Start leaves completed count unchanged; Complete changes progress and recalculates the next mission.

- [ ] **Step 10: Commit**

```bash
git add components/dashboard/dashboard-client.tsx components/dashboard/next-mission-card.tsx components/dashboard/progress-strip.tsx tests/unit/dashboard-components.test.tsx tests/e2e/smoke.spec.ts
git commit -m "fix: separate mission start and completion"
```

---

### Task 8: Complete V2.0a verification and release documentation

**Files:**
- Modify: `README.md`
- Modify tests only if verification exposes a real regression.

**Interfaces:**
- Documents V2.0a without claiming later V2 features are live.

- [ ] **Step 1: Update README boundaries**

Add:

```text
- financial onboarding answers are explicit rather than pre-populated
- unknown credit-file answers remain unknown
- mission started and mission completed are separate states
- supported completion effects update the actual profile before recalculation
- Safe Mode can suppress credit-product offers when current profile signals indicate financial pressure
- later V2 work will add Barrier Diagnosis, Credit Passport, Application Readiness, Quest Feed, Decline Recovery and external-data integrations
```

Do not describe the TikTok-style Quest Feed as already shipped in V2.0a.

- [ ] **Step 2: Run production dependency audit**

```bash
npm audit --omit=dev --audit-level=high
```

Expected: exit 0 with no high/critical production vulnerabilities.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 4: Run all Vitest tests**

```bash
npm test
```

Expected: all unit/integration tests pass.

- [ ] **Step 5: Run Playwright**

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

Expected: all E2E journeys pass.

- [ ] **Step 6: Run production build**

```bash
npm run build
```

Expected: Next.js production build succeeds.

- [ ] **Step 7: Verify database migration separately**

```bash
npx supabase db reset
```

Expected: `001_initial_schema.sql` and `002_v2_product_integrity.sql` apply cleanly. If this environment cannot run the database, record that limitation explicitly and do not claim live DB verification.

- [ ] **Step 8: Commit release documentation**

```bash
git add README.md
git commit -m "docs: describe V2 product integrity release"
```

- [ ] **Step 9: Open a pull request only after the exact head commit is green**

PR title:

```text
Credit Quest V2.0a — Product Integrity
```

PR body must call out:

```text
- no substantive onboarding defaults
- explicit unknown answers
- mission start no longer implies completion
- completion effects update supported profile fields
- mission ranking recalculates from actual profile/progress state
- Safe Mode suppresses inappropriate offers
- 16–17 age gate remains enforced
- affiliate commission remains outside mission/safety logic
- database migration verification status
- exact CI results
```

Do not merge until CI on the exact PR head is green.

---

## Plan self-review

### Spec coverage for V2.0a

- Mission started vs completed: Tasks 5–7.
- Completion updates actual profile where appropriate: Tasks 1, 5–7.
- Mission ranking recalculates after completion: Tasks 5 and 7.
- Remove unsafe onboarding defaults: Task 2.
- Support unknown answers: Tasks 1–3.
- Safe Mode / offer suppression: Task 4 and dashboard messaging in Task 7.
- Analytics distinguishes lifecycle actions: Task 6.
- Preserve under-18 hard gate: existing domain rule retained and regression E2E remains in Tasks 7–8.
- Preserve deterministic/auditable logic and affiliate separation: Tasks 4–5 plus Global Constraints.
- Preserve RLS: Task 3 and Global Constraints.

### Explicitly deferred to later V2 plans

The following approved V2 requirements are intentionally not part of V2.0a and must not be half-built here: Barrier Diagnosis, Credit Passport, Application Readiness / “Can I Apply Yet?”, ~25 mission expansion, TikTok-inspired Quest Feed, two-mode navigation, Decline Recovery, Open Banking, CRA integration, soft-search eligibility, Product Fit Score, AI Credit Coach, lender portal/B2B analytics.

This keeps V2.0a independently shippable and reduces the chance of building new intelligence on top of incorrect mission state or guessed customer data.
