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

Add lifecycle support types for later tasks:

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

Add `safeModeAllowed: boolean` and optional `completionEffect?: CompletionEffect` to `MissionDefinition`.

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

Add tests that verify the work and housing steps do not silently preselect customer states:

```ts
it("does not preselect employment or income", () => {
  goToWorkStep();
  expect(screen.getByLabelText("Employment status")).toHaveValue("");
  expect(screen.queryByLabelText("Annual personal income band")).toBeNull();
});
```

Add a test that chooses employment explicitly and then reveals a blank income selector:

```ts
it("asks for income only after an applicable employment choice", () => {
  goToWorkStep();
  fireEvent.change(screen.getByLabelText("Employment status"), { target: { value: "employed" } });
  expect(screen.getByLabelText("Annual personal income band")).toHaveValue("");
});
```

Add a test for an unknown tri-state question:

```ts
it("lets the user explicitly say they do not know electoral-roll status", () => {
  // navigate to Identity step using explicit required answers
  fireEvent.click(screen.getByRole("button", { name: "I don't know" }));
  expect(screen.getByRole("button", { name: "I don't know" })).toHaveAttribute("aria-pressed", "true");
});
```

- [ ] **Step 2: Run the component test and verify RED**

Run:

```bash
npm test -- tests/unit/onboarding-form.test.tsx
```

Expected: failures showing preselected `employed`, `30_50k`, or existing two-state controls.

- [ ] **Step 3: Introduce an onboarding draft instead of pretending unset values are profile values**

In `components/onboarding/onboarding-form.tsx`, replace the substantive initial defaults with a draft shape:

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
```

Do not cast this draft to `OnboardingAnswers` until submission. The server schema remains the final authority.

- [ ] **Step 4: Render blank-select placeholders instead of financial defaults**

Update `Select` to accept a placeholder and render an empty disabled option:

```tsx
<option value="" disabled>{placeholder}</option>
```

Employment example:

```tsx
<Select
  ariaLabel="Employment status"
  placeholder="Choose one"
  value={answers.employmentStatus ?? ""}
  onChange={(value) => updateEmploymentStatus(value as OnboardingAnswers["employmentStatus"])}
  options={["employed", "self_employed", "student", "unemployed", "other"]}
/>
```

Income should only render once an employment status is known and applicable. Housing must also begin blank.

- [ ] **Step 5: Add a reusable tri-state control**

Replace binary controls for questions where unknown is valid with:

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

Use it for electoral-roll status and revolving-credit presence. For a known revolving account, use it for direct debit. A null selection must be visibly different from an untouched question by gating Next until the user has interacted; store a separate local `answered` set if needed rather than encoding “unanswered” as a fake financial answer.

- [ ] **Step 6: Make utilisation and hard-search counts explicitly skippable as unknown**

For utilisation, leave the number input blank when unknown and add plain-English helper text plus an `I don't know my utilisation` button that sets `utilisationPct` to `null` and marks that question answered.

For hard searches, render an empty number input instead of `0` and add an `I don't know` action that preserves `null`.

Do not use `Number("")`, because it returns `0`. Use:

```ts
const value = event.target.value;
setAnswers((current) => ({
  ...current,
  hardApplicationsLast6m: value === "" ? null : Number(value),
}));
```

- [ ] **Step 7: Gate progression on required identity/context answers, not financial guesses**

Create a small `canContinue(step, answers, answered)` helper. Required rules for V2.0a:

```ts
switch (step) {
  case 0: return Boolean(answers.dateOfBirth);
  case 1:
    return Boolean(answers.employmentStatus) &&
      (answers.employmentStatus === "unemployed" || answers.incomeBand !== null);
  case 2: return Boolean(answers.housingStatus);
  default: return true;
}
```

For tri-state questions, use the separate `answered` set to require that the user has selected Yes, No, or I don’t know before advancing.

- [ ] **Step 8: Update Playwright onboarding helper to choose explicit values**

In `tests/e2e/smoke.spec.ts`, after reaching Work select `employed`, select a valid income band, then on Home select `rent`. Do not depend on previous defaults.

- [ ] **Step 9: Run tests and verify GREEN**

Run:

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

Create `supabase/migrations/002_v2_product_integrity.sql` with:

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

- [ ] **Step 2: Extend RLS verification SQL**

Add checks in `supabase/tests/rls.sql` documenting that an authenticated user can update only their own `user_missions` state and cannot mutate another user’s row. Keep the existing events read restrictions unchanged.

- [ ] **Step 3: Keep onboarding API values nullable end-to-end**

In `app/api/onboarding/route.ts`, persist the profile exactly as normalised:

```ts
missed_payments_last_12m: profile.missedPaymentsLast12m,
hard_applications_last_6m: profile.hardApplicationsLast6m,
has_revolving_credit: profile.hasRevolvingCredit,
has_direct_debit_for_credit: profile.hasDirectDebitForCredit,
electoral_roll: profile.electoralRoll,
```

Do not use `?? 0` or `?? false`.

- [ ] **Step 4: Verify migration locally or in CI**

Run when Supabase CLI is available:

```bash
npx supabase db reset
```

Expected: both migrations apply cleanly and RLS policies remain enabled.

If local Supabase is unavailable in the execution environment, do not claim this check passed; rely on SQL review plus the configured CI checks and verify the live migration separately before production deployment.

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
- `getOffersForMission` and `getMarketplaceOffers` must return `[]` when `assessment.suppressOffers` is true.
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
    expect(result.reasons.length).toBeGreaterThan(0);
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

Create `lib/domain/safety.ts`:

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

This is intentionally conservative: V2.0a only uses evidence currently present in the profile. Do not infer overdraft dependency, disposable income, debt-service burden, or vulnerability until those data actually exist.

- [ ] **Step 4: Put safety ahead of offer matching**

In `lib/domain/offer-matcher.ts`:

```ts
const safety = assessSafety(profile);
if (safety.suppressOffers) return [];
```

Do this before referral-category filtering for both mission-specific and marketplace matching.

- [ ] **Step 5: Put safety ahead of borrowing-oriented mission ranking**

In `lib/domain/mission-engine.ts`, compute safety once and filter:

```ts
const safety = assessSafety(profile);

return MISSION_CATALOGUE
  .filter((mission) => safety.mode !== "safe_mode" || mission.safeModeAllowed)
  .filter((mission) => mission.isEligible(profile, now))
```

Do not modify priority based on affiliate data.

- [ ] **Step 6: Add regression tests for suppressed offers and missions**

Add to `tests/unit/offer-matcher.test.ts`:

```ts
it("suppresses all offers in safe mode", () => {
  const stressed = { ...base, missedPaymentsLast12m: 2, hardApplicationsLast6m: 4 };
  expect(getOffersForMission(stressed, mission)).toEqual([]);
});
```

Add to `tests/unit/mission-engine.test.ts` an assertion that `build-revolving-history` is not returned in Safe Mode but a stability mission such as `application-cooldown` remains eligible where relevant.

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

Create `tests/unit/mission-lifecycle.test.ts` with these behaviours:

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

Create `lib/domain/mission-lifecycle.ts`:

```ts
import type { CompletionEffect, CreditProfile, MissionDefinition, MissionProgress } from "@/lib/domain/types";

export function startMission(
  current: MissionProgress | undefined,
  now = new Date(),
): MissionProgress {
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
  if (effect.type === "set_profile_value") {
    return { ...profile, [effect.field]: effect.value };
  }
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

Change signatures in `lib/domain/mission-engine.ts` to:

```ts
export function rankMissions(
  profile: CreditProfile,
  now = new Date(),
  progress: MissionProgressMap = {},
): RankedMission[]
```

and:

```ts
export function getNextBestMission(
  profile: CreditProfile,
  now = new Date(),
  progress: MissionProgressMap = {},
): RankedMission | null
```

Filter lifecycle states:

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

Keep a started mission visible and boost it only within the user-benefit engine so the user can finish what they started:

```ts
const startedBoost = progress[mission.slug]?.state === "started" ? 1000 : 0;
priorityScore: missionPriority(profile, mission.slug, mission.priorityWeight) + startedBoost
```

This boost is lifecycle continuity, not a commercial signal.

- [ ] **Step 5: Add ranking regression tests**

Verify a completed mission is no longer returned even if profile data did not change, and verify a started mission remains the next mission until completed/deferred/dismissed.

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
- Server derives `user_id` from Supabase auth; client must never supply a trusted user id.
- Demo mode returns a deterministic response without server persistence; client stores demo state locally.

- [ ] **Step 1: Add strict mission-action validation**

In the new route file define:

```ts
const missionActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("defer") }),
  z.object({ action: z.literal("dismiss") }),
]);
```

Reject unknown keys by applying `.strict()` to each object.

- [ ] **Step 2: Resolve the mission from the server-owned catalogue**

Use:

```ts
const mission = MISSION_CATALOGUE.find((item) => item.slug === slug);
if (!mission) return NextResponse.json({ error: "Unknown mission" }, { status: 404 });
```

Never accept mission priority, completion effect, referral category, or profile patch from the client.

- [ ] **Step 3: Implement demo-mode response using the pure lifecycle engine**

When Supabase public env is absent, return enough data for the client to store locally:

```ts
if (!env) {
  return NextResponse.json({ mode: "demo", action: parsed.data.action, missionSlug: mission.slug });
}
```

Do not pretend the server persisted demo state.

- [ ] **Step 4: Implement authenticated lifecycle persistence**

For configured Supabase:

1. call `supabase.auth.getUser()` and reject unauthenticated users;
2. load the user’s `profiles` row;
3. load the current `user_missions` row for the slug;
4. use `startMission` or `completeMission` for domain transitions;
5. upsert the mission row with `state`, `started_at`, `completed_at`, `next_review_at`, `updated_at`;
6. if completion changed the profile, update only the supported structured fields generated by the server-owned mission effect.

For `defer`, set state `deferred` and `next_review_at` to seven days from now in V2.0a. For `dismiss`, set state `dismissed` and `dismissed_at = now`.

If the profile update fails after mission upsert, return `500` and log no success event. Do not report completion to the UI unless both required writes succeed.

- [ ] **Step 5: Track lifecycle events only after successful actions**

Use the existing validated event names:

```ts
mission_started
mission_completed
mission_deferred
mission_dismissed
```

The event metadata may include `missionSlug`, but never a client-trusted `userId`.

Keep `eventPayloadSchema` strict. Extend `tests/unit/events.test.ts` so both `mission_started` and `mission_completed` validate while unsupported names still fail.

- [ ] **Step 6: Run tests**

```bash
npm test -- tests/unit/events.test.ts tests/unit/mission-lifecycle.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add app/api/missions/[slug]/route.ts lib/events.ts tests/unit/events.test.ts
git commit -m "feat: persist mission lifecycle actions"
```

---

### Task 7: Make the dashboard show real Start and Complete states and recalculate from customer state

**Files:**
- Modify: `components/dashboard/dashboard-client.tsx`
- Modify: `components/dashboard/next-mission-card.tsx`
- Modify: `tests/unit/dashboard-components.test.tsx`
- Modify: `tests/e2e/smoke.spec.ts`

**Interfaces:**
- `NextMissionCard` receives current mission progress and separate callbacks for start and complete.
- Dashboard persists demo profile + mission progress in local storage using the same pure lifecycle functions.
- Completing a mission recalculates Quest Score and mission ranking from the resulting profile/progress map.

- [ ] **Step 1: Write failing component tests for separate lifecycle buttons**

Add tests such as:

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

- [ ] **Step 3: Refactor `NextMissionCard` props**

Use a signature conceptually equivalent to:

```ts
{
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
}
```

Render `Start this mission` when state is absent/not-started/shown/eligible. Render `Mark complete` when state is `started`. Add a secondary `Do this later` action that defers rather than pretending completion.

- [ ] **Step 4: Replace the dashboard’s fake completed counter with mission progress state**

Remove the current `startMission()` logic that increments `creditquest-completed` immediately.

Store demo progress as one JSON map:

```ts
const DEMO_PROGRESS_KEY = "creditquest-mission-progress";
```

Hydrate:

```ts
const savedProgress = localStorage.getItem(DEMO_PROGRESS_KEY);
if (savedProgress) setProgress(JSON.parse(savedProgress));
```

Calculate mission results with:

```ts
const rankedMission = getNextBestMission(profile, new Date(), progress);
```

Derive completed count from progress entries whose state is `completed`; never keep a parallel counter.

- [ ] **Step 5: Implement Start in demo mode and configured mode**

In demo mode, use the pure function:

```ts
const nextProgress = {
  ...progress,
  [slug]: startMission(progress[slug]),
};
setProgress(nextProgress);
localStorage.setItem(DEMO_PROGRESS_KEY, JSON.stringify(nextProgress));
```

When Supabase is configured, POST `{ action: "start" }` to `/api/missions/${slug}` and update local UI only after a successful response.

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

Configured mode: POST `{ action: "complete" }`, then use the returned profile/progress or refetch the user state before recalculating.

Do not increment score manually. `calculateQuestScore(profile)` must recompute from the new profile.

- [ ] **Step 7: Surface Safe Mode plainly**

Use `assessSafety(profile)` in the dashboard. When `safe_mode`, show a prominent stability message such as:

```text
Protecting your finances comes first right now.

Based on the information you gave us, we’re pausing credit-product suggestions and prioritising actions that help protect payments and financial stability.
```

Do not call the user vulnerable or diagnose financial difficulty from missing data.

- [ ] **Step 8: Update E2E test to prove start is not completion**

Extend the adult journey:

```ts
await page.getByRole("button", { name: "Start this mission" }).click();
await expect(page.getByRole("button", { name: "Mark complete" })).toBeVisible();
await expect(page.getByText(/Missions done/)).toBeVisible();
await expect(page.getByText(/^0$/)).toBeVisible();
await page.getByRole("button", { name: "Mark complete" }).click();
await expect(page.getByText(/^1$/)).toBeVisible();
```

Choose an onboarding profile whose first mission has a structured completion effect so the test can also assert the next mission changes after completion.

- [ ] **Step 9: Run focused component and E2E tests**

```bash
npm test -- tests/unit/dashboard-components.test.tsx
npm run test:e2e -- tests/e2e/smoke.spec.ts
```

Expected: Start leaves completed count unchanged; Complete changes actual progress and recalculates the next mission.

- [ ] **Step 10: Commit**

```bash
git add components/dashboard/dashboard-client.tsx components/dashboard/next-mission-card.tsx tests/unit/dashboard-components.test.tsx tests/e2e/smoke.spec.ts
git commit -m "fix: separate mission start and completion"
```

---

### Task 8: Complete V2.0a verification and release documentation

**Files:**
- Modify: `README.md`
- Modify tests only if verification exposes a real regression.

**Interfaces:**
- Documents the V2.0a product-integrity behaviour without claiming later V2 features are already live.

- [ ] **Step 1: Update README boundaries**

Add a concise V2.0a section explaining:

```text
- financial onboarding answers are explicit rather than pre-populated
- unknown credit-file answers remain unknown
- mission started and mission completed are separate states
- supported completion effects update the actual profile before recalculation
- Safe Mode can suppress credit-product offers when current profile signals indicate financial pressure
- later V2 work will add Barrier Diagnosis, Credit Passport, Application Readiness, Quest Feed, Decline Recovery and external-data integrations
```

Do not describe the TikTok-style Quest Feed as already shipped in V2.0a.

- [ ] **Step 2: Run the production dependency audit**

```bash
npm audit --omit=dev --audit-level=high
```

Expected: exit 0 with no high/critical production vulnerabilities. If it fails, stop release work and address the dependency finding before claiming readiness.

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

Expected: all E2E journeys pass, including explicit onboarding choices and start-vs-complete lifecycle behaviour.

- [ ] **Step 6: Run the production build**

```bash
npm run build
```

Expected: Next.js production build succeeds.

- [ ] **Step 7: Verify database migration separately**

If Supabase CLI/database access is available:

```bash
npx supabase db reset
```

Expected: migrations `001_initial_schema.sql` and `002_v2_product_integrity.sql` apply cleanly.

If this environment cannot run the database, record that limitation explicitly in the PR and do not claim live DB verification.

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
- Preserve under-18 hard gate: existing domain rule retained and regression E2E remains in Task 7/8.
- Preserve deterministic/auditable logic and affiliate separation: Tasks 4–5 plus Global Constraints.
- Preserve RLS: Task 3 and Global Constraints.

### Explicitly deferred to later V2 plans

The following approved V2 requirements are intentionally not part of V2.0a and must not be half-built here: Barrier Diagnosis, Credit Passport, Application Readiness / “Can I Apply Yet?”, ~25 mission expansion, TikTok-inspired Quest Feed, two-mode navigation, Decline Recovery, Open Banking, CRA integration, soft-search eligibility, Product Fit Score, AI Credit Coach, lender portal/B2B analytics.

This keeps V2.0a independently shippable and reduces the chance of building new intelligence on top of incorrect mission state or guessed customer data.
