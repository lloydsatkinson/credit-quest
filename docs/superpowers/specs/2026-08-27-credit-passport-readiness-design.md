# Credit Quest V2.1 — Credit Passport + Application Readiness Design

Date: 2026-08-27
Status: Approved design, awaiting written-spec review
Branch: `feat/v2-1-quest-feed-ui`

## 1. Purpose

Build the first real Credit Passport and Application Readiness subsystem behind the V2.1 Quest Feed.

The feature must answer, without pretending to be a lender score:

1. What is helping my credit position?
2. What is holding me back?
3. What should I avoid doing now?
4. What should I do next?
5. Am I ready to consider a soft eligibility check?

The subsystem is deterministic, explainable, testable and independent of commercial economics.

## 2. Non-negotiable boundaries

- Never translate Quest Score directly into readiness.
- Never claim a lender approval probability.
- Never invent lender criteria.
- Never infer facts from missing data.
- Affiliate commission, campaign economics and provider priority cannot affect diagnosis, Passport or Readiness.
- Safe Mode remains authoritative over commercial surfaces.
- Users under 18 remain education-only and receive no product-readiness encouragement.
- `unknown` is a valid result whenever available evidence is insufficient.

## 3. Current-data constraint

V2.1 may only use information the application actually holds today:

- date of birth
- employment status
- broad income band
- housing status
- electoral-roll answer
- revolving-credit presence
- utilisation when known
- missed payments in the last 12 months when known
- hard applications in the last 6 months when known
- direct-debit protection when known
- tracked credit-card balance/limit/direct-debit data, through the existing account-derived profile signals

The current profile does **not** contain enough evidence to make a genuine affordability assessment, new-to-UK diagnosis, address-history maturity assessment, exact application-cooldown date, or lender-specific eligibility judgement. The UI must say `unknown` rather than manufacture these outputs.

## 4. Architecture

Add three isolated deterministic modules:

```text
lib/domain/diagnosis.ts
lib/domain/passport.ts
lib/domain/readiness.ts
```

They consume `CreditProfile`, existing `SafetyAssessment`, age mode and (where relevant) `now`. They return plain serialisable domain objects. They do not fetch data, write data, call AI, or read offer/affiliate configuration.

Data flow:

```text
profile + account-derived signals
        |
        +--> age gate
        +--> safety assessment
        +--> barrier diagnosis
        +--> passport pillars
        +--> application readiness
        |
        +--> mission ranking (existing, unchanged)
        |
        +--> Quest Feed presentation
                  |
                  +--> optional offers only after existing age/safety/mission gates
```

Passport and Readiness may explain the same underlying facts as the mission engine, but they must not mutate mission ordering in this slice.

## 5. Domain types

Add the following types to `lib/domain/types.ts` or colocate them where clearer:

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
  id:
    | "identity"
    | "payment_health"
    | "debt_headroom"
    | "affordability_stability"
    | "application_readiness";
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

## 6. Barrier diagnosis V2.1 rules

The engine is conservative. It only emits a diagnosis when current evidence supports it.

### Credit rebuilder

Primary `credit_rebuilder`, high confidence when reported missed payments in the last 12 months are `>= 2`.

A single missed payment may contribute a factor but is not enough by itself for a high-confidence rebuilder label.

### Thin file

Primary `thin_file`, medium confidence when the user explicitly reports no revolving credit and there is no stronger adverse-payment signal.

This does **not** mean the person has no credit history. It means Credit Quest currently has evidence of limited revolving-credit history only.

### Optimiser

Primary `optimiser`, medium confidence when revolving credit is present, no repeated missed-payment signal exists, and one or more current optimisation factors exist, for example utilisation above the existing Credit Quest 30% planning threshold or multiple recent applications.

### Unsupported diagnoses in this data version

Do not emit `new_to_uk` or `affordability_constrained` until the profile contains direct evidence for those concepts.

Do not emit `credit_invisible` merely because revolving credit is absent; the current data cannot distinguish true credit invisibility from other forms of thin history.

If evidence is insufficient, return `primary: null`, low confidence and explicit factors/unknowns rather than guessing.

## 7. Credit Passport V2.1 rules

The Passport always returns five pillars in a stable order.

### 7.1 Identity & Traceability

Evidence currently available: electoral-roll answer.

- `green`: electoral roll = true
- `amber`: electoral roll = false
- `unknown`: electoral roll = null
- no `red` state in this version from electoral-roll evidence alone

Copy must acknowledge that electoral-roll eligibility varies and that this is only one identity/address signal.

### 7.2 Payment Health

Primary evidence: missed payments. Secondary context: direct-debit protection where revolving credit exists.

- `red`: missed payments >= 2
- `amber`: missed payments = 1
- `green`: missed payments = 0
- `unknown`: missed-payment answer is unknown

Direct debit contributes helping/hurting/unknown copy but does not by itself override the primary missed-payment status.

### 7.3 Debt & Headroom

Evidence: revolving-credit presence and utilisation.

Credit Quest internal planning bands, not lender cut-offs:

- `green`: revolving credit exists and known utilisation <= 30%
- `amber`: known utilisation > 30% and <= 75%
- `red`: known utilisation > 75%
- `unknown`: utilisation is unknown, or user reports no revolving credit

The 30% boundary matches the existing Credit Quest utilisation mission target. The 75% boundary is an internal high-utilisation warning, explicitly not a lender threshold.

### 7.4 Affordability & Stability

`unknown` in V2.1.

Employment, income band and housing status may be displayed as context but are not sufficient to produce a genuine affordability status. The pillar should say more information/data would be required before Credit Quest can assess it responsibly.

### 7.5 Application Readiness

This pillar mirrors the Application Readiness engine result exactly. It must never independently recalculate readiness with different rules.

## 8. Application Readiness V2.1 rules

Order matters. First matching higher-severity rule wins.

### 8.1 Education mode

For users under 18:

- state: `unknown`
- headline: education-oriented, e.g. `Products can wait`
- no eligibility/product CTA
- reasons explain that Credit Quest is being used for learning and preparation

### 8.2 Safe Mode

If existing `assessSafety()` returns `safe_mode`:

- state: `red`
- headline: `Do not apply yet`
- prioritise payment stability and recovery actions
- suppress product-oriented guidance through existing gates

### 8.3 Missing critical evidence

Return `unknown` if either of these is unknown:

- missed payments in the last 12 months
- hard applications in the last 6 months

Also return `unknown` when revolving credit is explicitly present but utilisation is unknown.

Unknown should tell the user what information would make the result more useful.

### 8.4 Red blockers

For adults outside Safe Mode, return `red` when any current blocker is present:

- missed payments >= 2; or
- hard applications >= 3

Do **not** invent a calendar reassessment date because the current profile stores counts, not the dates of the underlying applications or missed payments.

`reassessAt` and `daysUntilReassessment` remain `null` unless a future data source provides a defensible date.

### 8.5 Amber — getting closer

Return `amber` when no red blocker exists but one or more of these applies:

- exactly 1 missed payment
- 2 hard applications in the last 6 months
- known utilisation > 30%
- no revolving credit / thin-file signal

Headline: `Getting closer`.

The UI should favour the relevant next mission and waiting/optimisation guidance, not a hard application CTA.

### 8.6 Green — worth checking eligibility

Return `green` only when all critical evidence is known and all of these are true:

- adult
- not in Safe Mode
- missed payments = 0
- hard applications <= 1
- if revolving credit exists, utilisation is known and <= 30%
- if revolving credit is absent, do not return green in V2.1 because current history evidence is too thin

Headline: `Worth checking eligibility`.

Green means only that the blockers Credit Quest currently recognises are absent. It is not an approval prediction. Any downstream product step should use soft-search eligibility where available and retain the existing commercial/safety gates.

## 9. Readiness explanation output

Every readiness result must contain:

- `reasons`: concrete profile facts supporting the state
- `avoid`: actions that could worsen the current position
- `actions`: safe next steps
- `reassessAt`: only when defensible from real dated data
- `daysUntilReassessment`: derived only from a real `reassessAt`

Never generate a fake countdown such as “42 days” from a six-month application count alone.

## 10. UI design

### 10.1 Quest Feed

Extend the finite feed from four to six cards when Passport/Readiness data is available:

1. Your next move
2. Why this matters
3. Your Credit Passport
4. Can I apply yet?
5. Your progress
6. Learn / score explainer

Safe Mode may insert its protective explanation before commercial or readiness-oriented surfaces.

The feed stays finite and scroll-snapped. No infinite content.

### 10.2 Passport feed card

Show all five pillars as large, tappable rows with status words/icons and accessible text labels.

Do not rely on colour alone.

Example:

```text
YOUR CREDIT PASSPORT

Identity & Traceability       GREEN
Payment Health                GREEN
Debt & Headroom               AMBER
Affordability & Stability     UNKNOWN
Application Readiness         AMBER

[See what is helping and hurting]
```

### 10.3 Passport detail screen

Add `/passport`.

Each pillar expands into:

- what is helping
- what is hurting
- what we do not know
- next actions

The screen includes an explicit statement that Passport is a Credit Quest guidance framework, not a credit-reference-agency score or lender underwriting result.

### 10.4 Readiness feed card

Large state-first presentation:

```text
CAN I APPLY YET?

GETTING CLOSER

Your utilisation is above the Credit Quest planning range.

Do now: reduce utilisation
Avoid now: another unnecessary hard application

[Understand my readiness]
```

### 10.5 Readiness detail screen

Add `/readiness` with:

- state/headline
- why
- what to avoid
- what to do next
- reassessment date only when genuinely known
- disclaimer that green is not approval probability

## 11. Server/client integration

### Persisted dashboard

In `app/dashboard/page.tsx`:

1. load profile and accounts as today
2. derive account profile signals as today
3. run `assessSafety`
4. run age mode
5. compute diagnosis, Passport and Readiness
6. pass these domain objects into Quest Feed presentation
7. keep mission ranking/action routing unchanged

### Demo dashboard

`DashboardClient` uses the same pure engines against the demo/local profile so demo and persisted UI cannot drift in business rules.

### Passport/readiness routes

Persisted mode recomputes from the authenticated profile/account state on the server. Demo mode may recompute from local demo profile on the client or use a dedicated client wrapper. No separate persisted Passport score/table is required in this slice because the output is derived from current canonical data.

## 12. Error handling

- Engines are total for valid `CreditProfile` inputs; unknown values produce unknown outputs, not exceptions.
- Invalid DOB continues to use existing age-gate validation/error behaviour.
- If the UI cannot compute a Passport/Readiness result in demo mode, render a neutral unavailable/unknown state rather than a green default.
- No errors should expose raw profile data to unauthenticated users.

## 13. Testing strategy

Use TDD for each engine before UI implementation.

### Diagnosis unit tests

Cover:

- repeated missed payments -> credit rebuilder
- no revolving credit -> thin file, not credit invisible
- utilisation/application optimisation -> optimiser
- insufficient evidence -> null/low confidence
- unsupported new-to-UK/affordability labels are never inferred

### Passport unit tests

Cover all green/amber/red/unknown boundaries for each supported pillar, including:

- electoral roll true/false/unknown
- missed payment 0/1/2/unknown
- utilisation 30/31/75/76/unknown
- affordability always unknown in current-data version
- readiness pillar exactly mirrors readiness state

### Readiness unit tests

Cover:

- under-18 -> unknown education mode
- Safe Mode -> red
- unknown critical data -> unknown
- repeated missed payments -> red
- >=3 hard applications -> red
- one missed payment -> amber
- two applications -> amber
- utilisation >30 -> amber
- no revolving credit -> amber
- clean known adult profile -> green
- no fake reassessment date when event dates are unavailable

### UI/component tests

Cover:

- status labels are readable without colour
- Passport renders exactly five pillars
- green readiness contains approval disclaimer
- unknown affordability is visible, not omitted
- commercial offer data cannot be passed into domain engines

### Playwright

Extend smoke coverage to verify:

- onboarding -> six-card Quest Feed
- Passport card and `/passport`
- Readiness card and `/readiness`
- under-18 has no eligibility CTA
- Safe Mode remains protective
- existing mission start/action lifecycle still passes

## 14. Out of scope for this slice

- CRA API integration
- Open Banking affordability assessment
- lender-specific eligibility or approval odds
- AI-generated credit decisions
- exact application dates/cooldown countdowns not present in current data
- new-to-UK diagnosis without new onboarding/profile data
- affordability-constrained diagnosis without appropriate evidence
- commercial ranking changes
- new partner integrations
- persistence of derived Passport/Readiness outputs

## 15. Acceptance criteria

The slice is ready to merge when:

1. All deterministic engines have explicit tests and no commercial inputs.
2. Unknown data stays unknown.
3. Passport always exposes five understandable pillars.
4. Readiness supports red/amber/green/unknown with explainable reasons.
5. No green state claims approval probability.
6. Under-18 and Safe Mode boundaries remain intact.
7. Quest Feed exposes Passport and Readiness as first-class cards.
8. `/passport` and `/readiness` work in supported modes.
9. Existing mission/action/offer tests remain green.
10. Audit, lint, unit tests, Playwright and production build all pass before merge.
