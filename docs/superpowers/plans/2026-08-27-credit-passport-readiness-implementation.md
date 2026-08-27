# Credit Passport + Application Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build deterministic Barrier Diagnosis, Credit Passport and Application Readiness engines, expose them through the V2.1 Quest Feed and dedicated detail screens, and preserve all existing safety, age, mission and commercial-separation boundaries.

**Architecture:** Add three pure domain modules with no I/O or commercial inputs, then build small presentation components that consume their serialisable outputs. The authenticated dashboard and demo dashboard must call the same pure engines. Passport/Readiness are derived from canonical profile/account signals at render time and are not persisted in this slice.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind CSS 4, Vitest 3, Testing Library, Playwright, Supabase SSR.

**Spec:** `docs/superpowers/specs/2026-08-27-credit-passport-readiness-design.md`

## Global Constraints

- Never translate Quest Score directly into readiness.
- Never claim a lender approval probability.
- Never invent lender criteria or unsupported customer facts.
- `unknown` is a valid result whenever current evidence is insufficient.
- Affiliate commission, provider payout, campaign economics and commercial priority cannot affect diagnosis, Passport or Readiness.
- Safe Mode remains authoritative over commercial surfaces.
- Users under 18 remain education-only and receive no product-readiness encouragement.
- Do not invent reassessment dates from six-month counts; `reassessAt` stays `null` until real dated evidence exists.
- Affordability & Stability stays `unknown` in this data version.
- Existing mission ranking, action routing and offer gating remain unchanged.
- Every production change follows RED -> GREEN -> refactor with an observed failing test first.

---

## File map

### New domain files
- `lib/domain/diagnosis.ts` — conservative barrier classification from current profile evidence only.
- `lib/domain/readiness.ts` — ordered deterministic readiness rules and explanation output.
- `lib/domain/passport.ts` — exactly five Passport pillars; readiness pillar mirrors readiness result.

### New presentation files
- `components/passport/passport-card.tsx` — compact five-pillar Quest Feed card.
- `components/passport/passport-detail.tsx` — full helping/hurting/unknown/next-actions view.
- `components/readiness/readiness-card.tsx` — state-first Quest Feed readiness card.
- `components/readiness/readiness-detail.tsx` — full reasons/avoid/actions/disclaimer view.
- `app/passport/page.tsx` — authenticated/server-derived Passport route, with demo fallback.
- `app/readiness/page.tsx` — authenticated/server-derived Readiness route, with demo fallback.

### Existing files to modify
- `lib/domain/types.ts` — add diagnosis/passport/readiness serialisable types.
- `app/dashboard/page.tsx` — compute and render Passport/Readiness in persisted mode.
- `components/dashboard/dashboard-client.tsx` — compute and render same outputs in demo mode.
- `components/dashboard/quest-feed.tsx` — extend finite feed from four to six cards.
- `tests/e2e/smoke.spec.ts` — exercise Passport/Readiness routes and protective states.

### New tests
- `tests/unit/diagnosis.test.ts`
- `tests/unit/readiness.test.ts`
- `tests/unit/passport.test.ts`
- `tests/unit/passport-readiness-components.test.tsx`

---

### Task 1: Add serialisable domain contracts

**Files:**
- Modify: `lib/domain/types.ts`
- Test: `tests/unit/domain-types-contract.test.ts`

**Interfaces:**
- Produces: `BarrierType`, `DiagnosisFactor`, `BarrierDiagnosis`, `PassportStatus`, `PassportPillar`, `CreditPassport`, `ReadinessState`, `ApplicationReadiness`.
- Consumed by: Tasks 2–7.

- [ ] **Step 1: Write the failing type contract test**

Create `tests/unit/domain-types-contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type {
  ApplicationReadiness,
  BarrierDiagnosis,
  CreditPassport,
} from "@/lib/domain/types";

describe("Passport and readiness domain contracts", () => {
  it("supports explainable serialisable outputs", () => {
    const diagnosis: BarrierDiagnosis = {
      primary: null,
      secondary: [],
      confidence: "low",
      factors: [],
    };
    const readiness: ApplicationReadiness = {
      state: "unknown",
      headline: "We need more information",
      reasons: [],
      avoid: [],
      actions: [],
      reassessAt: null,
      daysUntilReassessment: null,
    };
    const passport: CreditPassport = {
      pillars: [{
        id: "affordability_stability",
        title: "Affordability & Stability",
        status: "unknown",
        strength: "More evidence is needed.",
        helping: [],
        hurting: [],
        unknowns: ["Affordability is not assessed from the current profile."],
        nextActions: [],
      }],
    };

    expect(diagnosis.primary).toBeNull();
    expect(readiness.reassessAt).toBeNull();
    expect(passport.pillars[0].status).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run the test and observe RED**

Run:

```bash
npm test -- tests/unit/domain-types-contract.test.ts
```

Expected: TypeScript/Vitest compilation failure because the new exported types do not exist.

- [ ] **Step 3: Add the minimal contracts to `lib/domain/types.ts`**

Add:

```ts
export type BarrierType =
  | "credit_invisible"
  | "thin_file"
  | "new_to_uk"
  | "credit_rebuilder"
  | "affordability_constrained"
  | "optimiser";

export interface DiagnosisFactor {
  code: string;
  label: string;
  evidence: string;
}

export interface BarrierDiagnosis {
  primary: BarrierType | null;
  secondary: BarrierType[];
  confidence: "low" | "medium" | "high";
  factors: DiagnosisFactor[];
}

export type PassportStatus = "green" | "amber" | "red" | "unknown";

export interface PassportPillar {
  id: "identity" | "payment_health" | "debt_headroom" | "affordability_stability" | "application_readiness";
  title: string;
  status: PassportStatus;
  strength: string;
  helping: string[];
  hurting: string[];
  unknowns: string[];
  nextActions: string[];
}

export interface CreditPassport {
  pillars: PassportPillar[];
}

export type ReadinessState = "red" | "amber" | "green" | "unknown";

export interface ApplicationReadiness {
  state: ReadinessState;
  headline: string;
  reasons: string[];
  avoid: string[];
  actions: string[];
  reassessAt: string | null;
  daysUntilReassessment: number | null;
}
```

- [ ] **Step 4: Run the contract test and observe GREEN**

```bash
npm test -- tests/unit/domain-types-contract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/types.ts tests/unit/domain-types-contract.test.ts
git commit -m "feat: add passport readiness domain contracts"
```

---

### Task 2: Implement conservative Barrier Diagnosis

**Files:**
- Create: `lib/domain/diagnosis.ts`
- Create: `tests/unit/diagnosis.test.ts`

**Interfaces:**
- Consumes: `CreditProfile`, `BarrierDiagnosis`.
- Produces: `diagnoseBarrier(profile: CreditProfile): BarrierDiagnosis`.

- [ ] **Step 1: Write the failing diagnosis tests**

Create a `baseProfile` with known clean values, then cover these exact cases:

```ts
expect(diagnoseBarrier({ ...baseProfile, missedPaymentsLast12m: 2 }).primary)
  .toBe("credit_rebuilder");

expect(diagnoseBarrier({ ...baseProfile, hasRevolvingCredit: false }).primary)
  .toBe("thin_file");

expect(diagnoseBarrier({ ...baseProfile, utilisationPct: 62 }).primary)
  .toBe("optimiser");

expect(diagnoseBarrier({
  ...baseProfile,
  hasRevolvingCredit: null,
  utilisationPct: null,
  missedPaymentsLast12m: null,
  hardApplicationsLast6m: null,
}).primary).toBeNull();
```

Also assert that no current-data profile ever returns `new_to_uk`, `affordability_constrained`, or `credit_invisible`.

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/diagnosis.test.ts
```

Expected: FAIL because `diagnoseBarrier` does not exist.

- [ ] **Step 3: Implement `diagnoseBarrier`**

Rules in priority order:

```ts
if ((profile.missedPaymentsLast12m ?? 0) >= 2) {
  return creditRebuilderHighConfidence;
}
if (profile.hasRevolvingCredit === false) {
  return thinFileMediumConfidence;
}
if (
  profile.hasRevolvingCredit === true &&
  ((profile.utilisationPct ?? 0) > 30 || (profile.hardApplicationsLast6m ?? 0) >= 2)
) {
  return optimiserMediumConfidence;
}
return insufficientEvidenceLowConfidence;
```

Do not use employment, income or housing to infer affordability. Keep factors concrete, e.g. `"You reported two or more missed payments in the last 12 months."`.

- [ ] **Step 4: Run diagnosis tests and full unit suite**

```bash
npm test -- tests/unit/diagnosis.test.ts
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/diagnosis.ts tests/unit/diagnosis.test.ts
git commit -m "feat: add deterministic barrier diagnosis"
```

---

### Task 3: Implement Application Readiness engine

**Files:**
- Create: `lib/domain/readiness.ts`
- Create: `tests/unit/readiness.test.ts`

**Interfaces:**
- Consumes: `CreditProfile`, `SafetyAssessment`, `AgeMode`, `ApplicationReadiness`.
- Produces:

```ts
assessApplicationReadiness(
  profile: CreditProfile,
  safety: SafetyAssessment,
  ageMode: AgeMode,
): ApplicationReadiness
```

- [ ] **Step 1: Write RED tests for ordered severity**

Cover at minimum:

```ts
expect(readiness(under18Profile).state).toBe("unknown");
expect(readiness(safeModeProfile).state).toBe("red");
expect(readiness({ ...baseProfile, missedPaymentsLast12m: null }).state).toBe("unknown");
expect(readiness({ ...baseProfile, hardApplicationsLast6m: null }).state).toBe("unknown");
expect(readiness({ ...baseProfile, utilisationPct: null }).state).toBe("unknown");
expect(readiness({ ...baseProfile, missedPaymentsLast12m: 2 }).state).toBe("red");
expect(readiness({ ...baseProfile, hardApplicationsLast6m: 3 }).state).toBe("red");
expect(readiness({ ...baseProfile, missedPaymentsLast12m: 1 }).state).toBe("amber");
expect(readiness({ ...baseProfile, hardApplicationsLast6m: 2 }).state).toBe("amber");
expect(readiness({ ...baseProfile, utilisationPct: 31 }).state).toBe("amber");
expect(readiness({ ...baseProfile, hasRevolvingCredit: false, utilisationPct: null }).state).toBe("amber");
expect(readiness(baseProfile).state).toBe("green");
```

For every count-based case assert:

```ts
expect(result.reassessAt).toBeNull();
expect(result.daysUntilReassessment).toBeNull();
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/readiness.test.ts
```

Expected: FAIL because the module/function does not exist.

- [ ] **Step 3: Implement the readiness rule chain**

Use this order exactly:

```ts
if (ageMode === "education") return educationUnknown;
if (safety.mode === "safe_mode") return protectiveRed;
if (criticalEvidenceMissing(profile)) return evidenceUnknown;
if ((profile.missedPaymentsLast12m ?? 0) >= 2) return missedPaymentsRed;
if ((profile.hardApplicationsLast6m ?? 0) >= 3) return applicationsRed;
if (profile.missedPaymentsLast12m === 1) return missedPaymentAmber;
if (profile.hardApplicationsLast6m === 2) return applicationsAmber;
if (profile.hasRevolvingCredit === true && (profile.utilisationPct ?? 0) > 30) return utilisationAmber;
if (profile.hasRevolvingCredit === false) return thinFileAmber;
return green;
```

`criticalEvidenceMissing(profile)` is true when missed payments or hard applications are `null`, or when revolving credit is true and utilisation is `null`.

Green copy must include a reason equivalent to: `"The blockers Credit Quest currently checks are not present in the information you gave us."` and an action equivalent to `"Use a soft eligibility check where available before considering an application."`.

- [ ] **Step 4: Verify GREEN and regression suite**

```bash
npm test -- tests/unit/readiness.test.ts
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/readiness.ts tests/unit/readiness.test.ts
git commit -m "feat: add application readiness engine"
```

---

### Task 4: Implement the five-pillar Credit Passport

**Files:**
- Create: `lib/domain/passport.ts`
- Create: `tests/unit/passport.test.ts`

**Interfaces:**
- Consumes: `CreditProfile`, `ApplicationReadiness`.
- Produces:

```ts
buildCreditPassport(
  profile: CreditProfile,
  readiness: ApplicationReadiness,
): CreditPassport
```

- [ ] **Step 1: Write RED boundary tests**

Assert exactly five pillars and stable IDs:

```ts
expect(passport.pillars.map((pillar) => pillar.id)).toEqual([
  "identity",
  "payment_health",
  "debt_headroom",
  "affordability_stability",
  "application_readiness",
]);
```

Boundary assertions:

```ts
// Identity
true -> green
false -> amber
null -> unknown

// Payment Health
0 -> green
1 -> amber
2 -> red
null -> unknown

// Debt & Headroom
30 -> green
31 -> amber
75 -> amber
76 -> red
null utilisation with revolving credit -> unknown
no revolving credit -> unknown

// Affordability
always unknown

// Readiness
passport.pillars[4].status === readiness.state
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/passport.test.ts
```

Expected: FAIL because `buildCreditPassport` does not exist.

- [ ] **Step 3: Implement small per-pillar builders**

Keep each rule isolated:

```ts
function buildIdentityPillar(profile: CreditProfile): PassportPillar
function buildPaymentHealthPillar(profile: CreditProfile): PassportPillar
function buildDebtHeadroomPillar(profile: CreditProfile): PassportPillar
function buildAffordabilityPillar(profile: CreditProfile): PassportPillar
function buildReadinessPillar(readiness: ApplicationReadiness): PassportPillar
```

The affordability pillar must always include an `unknowns` item explaining that current employment/income/housing context is not enough for a responsible affordability assessment.

Debt/headroom copy must call 30% and 75% **Credit Quest planning bands**, not lender thresholds.

- [ ] **Step 4: Verify GREEN and regression suite**

```bash
npm test -- tests/unit/passport.test.ts
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/passport.ts tests/unit/passport.test.ts
git commit -m "feat: add five pillar credit passport"
```

---

### Task 5: Build accessible Passport and Readiness presentation components

**Files:**
- Create: `components/passport/passport-card.tsx`
- Create: `components/passport/passport-detail.tsx`
- Create: `components/readiness/readiness-card.tsx`
- Create: `components/readiness/readiness-detail.tsx`
- Create: `tests/unit/passport-readiness-components.test.tsx`

**Interfaces:**
- Consumes: `CreditPassport`, `ApplicationReadiness`.
- Produces reusable feed/detail components only; no profile rules are duplicated in UI.

- [ ] **Step 1: Write component tests first**

Tests must assert:

```ts
expect(screen.getAllByTestId("passport-pillar")).toHaveLength(5);
expect(screen.getByText("Affordability & Stability")).not.toBeNull();
expect(screen.getByText("Unknown", { exact: true })).not.toBeNull();
expect(screen.getByText(/not a lender approval prediction/i)).not.toBeNull();
```

For green readiness:

```ts
expect(screen.getByText("Worth checking eligibility")).not.toBeNull();
expect(screen.getByText(/does not mean you will be approved/i)).not.toBeNull();
```

Status text must be visible as words (`Green`, `Amber`, `Red`, `Unknown`) so meaning is not colour-only.

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/passport-readiness-components.test.tsx
```

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement the four components**

Presentation requirements:

- `PassportCard`: heading `Your Credit Passport`, five tappable/status rows, link to `/passport`.
- `PassportDetail`: sections for Helping, Holding you back, What we do not know, Next actions; omit empty subsections but never omit the pillar.
- `ReadinessCard`: eyebrow `Can I apply yet?`, large headline, top reason, first avoid/action, link to `/readiness`.
- `ReadinessDetail`: all reasons/avoid/actions; show reassessment only when non-null; always include non-approval disclaimer.

Do not accept `OfferDefinition`, commission or provider economics as component props.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- tests/unit/passport-readiness-components.test.tsx
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/passport components/readiness tests/unit/passport-readiness-components.test.tsx
git commit -m "feat: add passport and readiness UI components"
```

---

### Task 6: Integrate Passport and Readiness into the finite Quest Feed

**Files:**
- Modify: `components/dashboard/quest-feed.tsx`
- Modify: `components/dashboard/dashboard-client.tsx`
- Modify: `app/dashboard/page.tsx`
- Test: `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `diagnoseBarrier`, `assessApplicationReadiness`, `buildCreditPassport`, existing `assessSafety`, existing `getAgeMode`.
- Produces: six-card feed in normal supported states.

- [ ] **Step 1: Add failing E2E contract**

After adult demo onboarding, assert:

```ts
const feed = page.getByTestId("quest-feed");
await expect(feed.locator("[data-quest-feed-card]")).toHaveCount(6);
await expect(feed.getByText("Your Credit Passport", { exact: true })).toBeVisible();
await expect(feed.getByText("Can I apply yet?", { exact: true })).toBeVisible();
```

Keep existing mission start and commercial-separation assertions intact.

- [ ] **Step 2: Run Playwright and observe RED**

```bash
npm run test:e2e -- --grep "adult can complete onboarding"
```

Expected: FAIL because feed still has four cards.

- [ ] **Step 3: Compute outputs in demo dashboard**

In `DashboardClient` use the same chain as production:

```ts
const safety = assessSafety(profile);
const ageMode = getAgeMode(profile.dateOfBirth);
const diagnosis = diagnoseBarrier(profile);
const readiness = assessApplicationReadiness(profile, safety, ageMode);
const passport = buildCreditPassport(profile, readiness);
```

Do not derive these from `QuestScore` or offers.

- [ ] **Step 4: Compute outputs in persisted dashboard**

After `effectiveProfile` is built from canonical profile + account-derived signals:

```ts
const safety = assessSafety(effectiveProfile);
const ageMode = getAgeMode(effectiveProfile.dateOfBirth, now);
const diagnosis = diagnoseBarrier(effectiveProfile);
const readiness = assessApplicationReadiness(effectiveProfile, safety, ageMode);
const passport = buildCreditPassport(effectiveProfile, readiness);
```

`diagnosis` may be used for explanatory copy but must not mutate `rankMissionInstances()` ordering in this slice.

- [ ] **Step 5: Extend Quest Feed to six cards**

Stable sequence:

```text
1 Your next move
2 Why this matters
3 Your Credit Passport
4 Can I apply yet?
5 Your progress
6 Know what the score means
```

The feed remains finite, scroll-snapped, keyboard-scrollable and reduced-motion compatible.

- [ ] **Step 6: Run E2E + full unit suite**

```bash
npm test
npm run test:e2e
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/page.tsx components/dashboard components/passport components/readiness tests/e2e/smoke.spec.ts
git commit -m "feat: add passport and readiness to Quest Feed"
```

---

### Task 7: Add `/passport` and `/readiness` detail routes

**Files:**
- Create: `app/passport/page.tsx`
- Create: `app/readiness/page.tsx`
- Optionally create focused shared loader: `lib/server/credit-guidance-service.ts`
- Modify: `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Produces authenticated routes derived from current canonical profile/account state.
- Demo mode must use the same pure domain functions, never hand-authored fake readiness values.

- [ ] **Step 1: Write failing route smoke tests**

After demo onboarding:

```ts
await page.goto("/passport");
await expect(page.getByRole("heading", { name: "Your Credit Passport" })).toBeVisible();
await expect(page.getByTestId("passport-pillar-identity")).toBeVisible();

await page.goto("/readiness");
await expect(page.getByRole("heading", { name: /Can I apply yet/i })).toBeVisible();
await expect(page.getByText(/does not mean you will be approved/i)).toBeVisible();
```

- [ ] **Step 2: Run and observe RED**

```bash
npm run test:e2e -- --grep "Passport|readiness"
```

Expected: 404 or missing-content failure.

- [ ] **Step 3: Implement server-side guidance loader**

If duplication between the two routes and dashboard becomes material, create:

```ts
export async function getCreditGuidanceForUser(
  supabase: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<{
  profile: CreditProfile;
  diagnosis: BarrierDiagnosis;
  readiness: ApplicationReadiness;
  passport: CreditPassport;
}>;
```

It must load profile/accounts, apply `deriveAccountProfileSignals`, then call pure engines. It must not read offers or partner economics.

- [ ] **Step 4: Implement `/passport` and `/readiness`**

Authenticated mode:
- unauthenticated -> `/login?next=...`
- missing profile -> `/onboarding`
- recompute from canonical profile/account state

Demo mode:
- read `creditquest-profile` in a small client wrapper
- if unavailable/invalid, show neutral unknown guidance or link back to onboarding; never default to green.

- [ ] **Step 5: Verify route tests and full E2E**

```bash
npm run test:e2e
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/passport app/readiness lib/server/credit-guidance-service.ts tests/e2e/smoke.spec.ts
git commit -m "feat: add passport and readiness detail routes"
```

If `credit-guidance-service.ts` was not needed, omit it from `git add` rather than creating an unnecessary abstraction.

---

### Task 8: Prove protective boundaries and release quality

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`
- Modify unit tests only if a real uncovered boundary is found.

**Interfaces:**
- Verifies all acceptance criteria; no new production behaviour should be introduced here unless a failing test reveals a real defect.

- [ ] **Step 1: Add/retain under-18 protection assertion**

After 17-year-old onboarding:

```ts
await expect(page.getByText(/Products can wait/i)).toBeVisible();
await expect(page.getByRole("link", { name: /check eligibility/i })).toHaveCount(0);
```

Also visit `/readiness` and verify education-oriented unknown state, not green.

- [ ] **Step 2: Add Safe Mode protection assertion**

Create a demo profile with both repeated missed payments and repeated applications through supported UI/data setup, or use the closest existing deterministic fixture in a component/unit test. Assert readiness `red`, headline `Do not apply yet`, and no product CTA.

- [ ] **Step 3: Verify no fake countdown**

For a red/amber application-count case, assert there is no text matching a fabricated day countdown and the detail component receives `reassessAt: null`.

- [ ] **Step 4: Run the complete release gate**

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npm run test:e2e
npm run build
```

Expected: every command exits 0.

- [ ] **Step 5: Inspect PR diff for commercial contamination**

Run/review:

```bash
git diff main...HEAD -- lib/domain/diagnosis.ts lib/domain/passport.ts lib/domain/readiness.ts
```

Expected: no imports from offer matcher, affiliate data, provider economics, campaign config or referral commission fields.

- [ ] **Step 6: Commit final verification changes**

```bash
git add tests
git commit -m "test: verify passport readiness safety boundaries"
```

- [ ] **Step 7: Update PR #20 description**

Document:
- deterministic engines added
- six-card Quest Feed
- `/passport` and `/readiness`
- under-18/Safe Mode boundaries
- no lender approval probability
- no commercial inputs
- full release-gate results

Keep PR draft until the complete gate is green and the Vercel preview is successful.

---

## Self-review against the approved spec

- Spec boundaries: covered by Global Constraints and Tasks 2, 3, 8.
- Current-data limits: explicit in diagnosis/readiness/passport rules; affordability stays unknown.
- Barrier Diagnosis: Task 2.
- Five Passport pillars: Task 4.
- Readiness red/amber/green/unknown: Task 3.
- No fake reassessment date: Tasks 3 and 8.
- Six-card finite feed: Task 6.
- Passport/readiness detail screens: Task 7.
- Persisted + demo integration using same pure engines: Tasks 6 and 7.
- Under-18 and Safe Mode: Tasks 3 and 8.
- Commercial isolation: Global Constraints, Tasks 6 and 8.
- Full TDD and release gate: every task plus Task 8.
- No persistence of derived Passport/Readiness outputs: no database migration is included.

No CRA, Open Banking, lender-specific eligibility, AI decisioning, new-to-UK inference, affordability classification, commercial-ranking changes or fabricated countdowns are included in this plan.
