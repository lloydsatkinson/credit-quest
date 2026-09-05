# Credit Quest Recovery Experience Design

**Status:** CTO design approved in chat; implementation not yet authorised  
**Date:** 5 September 2026  
**Branch:** `spec/recovery-experience`  
**Depends on:** existing Credit Quest core strategy, Mission Action Layer, Credit Passport, Application Readiness, Quest Feed, Journey, Safe Mode and V2.0d Closed-Loop Decline Recovery  

## 1. Purpose

Credit Quest already has a strong deterministic core for helping customers understand where they are, identify the next best move, act, track progress and reassess readiness. V2.0d added the institutional decline-recovery foundations: direct and partner entry, recovery orchestration, support needs, aggregate analytics and Return-to-Origin.

The remaining gap is product composition. A customer in decline recovery currently sees recovery as an additive status area above the normal Credit Quest dashboard. The experience does not yet feel like one coherent recovery journey.

This tranche turns the existing capabilities into a recovery-first customer experience while preserving the main Credit Quest product.

The target experience is:

```text
Normal Credit Quest customer
  -> existing assessment
  -> next best mission
  -> Passport / readiness / Academy / progress
  -> Build -> Optimise -> Maintain

Declined customer
  -> same assessment and customer record
  -> recovery framing
  -> same authoritative mission / Passport / readiness engines
  -> explicit recovery state
  -> next safe action
  -> evidence / waiting / reassessment
  -> ready-to-check
  -> optional customer-controlled Return-to-Origin
  -> back into normal Build / Optimise / Maintain lifecycle
```

The product objective is:

> Make the current Credit Quest engine feel purpose-built for the moment after a decline without creating a second strategy engine or a decline-only product.

## 2. Non-negotiable preservation rules

### 2.1 One core strategy engine

Recovery must not fork or replace:

- Safe Mode;
- Barrier Diagnosis;
- mission eligibility or ranking;
- Credit Passport;
- Application Readiness;
- Quest Score;
- Academy selection rules;
- existing commercial separation.

Recovery consumes those outputs and presents them in a recovery context. It does not create lender-specific underwriting or a second creditworthiness model.

### 2.2 One customer record

Normal and recovery journeys use the same customer profile, accounts, mission instances, completed history, evidence, Passport, readiness and Journey history.

Entering recovery must not reset progress, create a duplicate customer record or erase prior completed work.

### 2.3 Recovery is contextual orchestration

Recovery may change:

- presentation hierarchy;
- explanatory copy;
- visible recovery stage;
- timeline / waiting state;
- recovery-specific analytics;
- Return-to-Origin availability.

Recovery must not change core customer strategy merely because a decline occurred or because a partner supplied context.

### 2.4 Return to core

When a recovery journey is no longer active, the customer continues through the normal Credit Quest lifecycle. Recovery is a state within the broader product, not a terminal destination.

## 3. Core design decision

Introduce a single server/domain projection:

`RecoveryExperienceProjection`

This projection composes already-authoritative outputs into one customer-facing recovery model. React components render the projection; they do not independently invent recovery business rules.

Conceptually:

```text
Customer profile / accounts / mission instances
              |
              +--> Safety
              +--> Barrier Diagnosis
              +--> Mission Engine
              +--> Credit Passport
              +--> Application Readiness
              +--> Journey
              +--> V2.0d Recovery Projection
              +--> Return-to-Origin Gate
                         |
                         v
              RecoveryExperienceProjection
                         |
                         v
                 Recovery-first UI
```

Commercial economics, partner value and revenue remain downstream and unavailable to the projection's strategy inputs.

## 4. RecoveryExperienceProjection contract

Initial shape:

```ts
type RecoveryExperienceState =
  | "action_required"
  | "waiting_for_evidence"
  | "reassessment_due"
  | "not_ready"
  | "ready_to_check";

type EvidenceConfidence =
  | "verified"
  | "confirmed"
  | "pending"
  | "unknown";

type RecoveryExperienceProjection = {
  mode: "recovery";
  stage:
    | "intake"
    | "crisis_recovery"
    | "stability"
    | "rebuilding"
    | "optimisation"
    | "ready_to_check";
  state: RecoveryExperienceState;
  headline: string;
  summary: string;
  nextAction: {
    missionInstanceId: string | null;
    missionSlug: string | null;
    title: string;
    rationale: string;
    actionHref: string | null;
    effortLabel: string | null;
    impactLabel: "high" | "medium" | "low" | null;
    reviewTimingLabel: string | null;
  };
  evidence: Array<{
    key: string;
    label: string;
    confidence: EvidenceConfidence;
    source: "customer" | "account" | "partner" | "government_action" | "cra" | "open_banking" | "eligibility_provider" | "unknown";
    statusText: string;
  }>;
  timeline: Array<{
    key: "declined" | "fixing" | "waiting" | "reassessment" | "ready";
    label: string;
    state: "complete" | "current" | "future";
  }>;
  readiness: {
    status: string;
    explanation: string;
  };
  reassessment: {
    dueAt: string | null;
    label: string;
  };
  returnState: {
    status: "unavailable" | "blocked" | "available";
    reason: string | null;
    partnerLabel: string | null;
    actionHref: string | null;
  };
};
```

The exact implementation type may be refined during planning, but these semantics are required.

`returnState.actionHref`, when present, is an internal Credit Quest route that invokes the existing server-owned Return-to-Origin gateway. It is never an arbitrary partner destination supplied to or by the browser.

## 5. Recovery experience states

The recovery UI must never fall through to an unexplained generic dead end.

### 5.1 `action_required`

Use when there is a currently eligible next best mission or another explicit safe action the customer should take now.

Customer-facing intent:

> Here is the single most useful thing to do next.

Primary CTA points to the existing Action Layer route where applicable.

### 5.2 `waiting_for_evidence`

Use when the required customer action is complete or in review and the next meaningful step depends on evidence maturing or a genuine review date.

Customer-facing intent:

> You have done what you need to do for now. We are waiting for this change to become visible or reviewable.

This state must be preferred over generic copy such as “You’re up to date for now” for an active recovery customer.

### 5.3 `reassessment_due`

Use when a real evidence-based reassessment date has arrived or an existing Journey/recovery rule says reassessment is due.

Customer-facing intent:

> It is time to check what changed.

No fabricated dates are allowed.

### 5.4 `not_ready`

Use when no immediate action is currently available but the customer still fails one or more independent readiness/safety/evidence gates.

Customer-facing intent:

> You are not ready to check eligibility yet, and here is what is still blocking that.

The experience must provide a reason, evidence gap or next review condition rather than a blank state.

### 5.5 `ready_to_check`

Use when the authoritative independent Credit Quest Application Readiness state says the customer is ready to check eligibility again and no upstream safety/readiness condition blocks that state.

`ready_to_check` does **not** require an original partner, an active return contract or an enabled Return-to-Origin route. Those are separate downstream conditions represented by `returnState`.

A direct Credit Quest customer can therefore be `ready_to_check` while `returnState.status` is `unavailable`. A partner-origin customer can be `ready_to_check` while Return-to-Origin remains `blocked` because a partner, contract, environment, disclosure or regulatory gate is unavailable.

Customer-facing intent:

> You have made the progress we were waiting for. Based on the information we have, you are ready to check eligibility again.

This never means guaranteed approval.

## 6. Customer UI composition

### 6.1 Normal customers

Customers without an active recovery journey continue to receive the established Credit Quest dashboard and seven-card Quest Feed. No recovery framing is injected.

### 6.2 Active recovery customers

An active recovery journey changes the hierarchy of the experience but does not remove the core Credit Quest product.

The first screen should communicate, in this order:

1. where the customer is in recovery;
2. the one dominant next action or waiting state;
3. why that action/state matters;
4. what evidence is known, pending or missing;
5. when reassessment can genuinely occur;
6. whether Return-to-Origin is blocked or available.

### 6.3 Seven-card Quest Feed preservation

The existing seven-card Quest Feed remains exactly seven cards.

For active recovery customers, the seven cards should tell one recovery story:

1. **Do this now** — existing next best mission / safe action;
2. **Why this matters** — rationale and barrier explanation;
3. **Your Credit Passport** — current pillars and improvement;
4. **Can I apply yet?** — authoritative readiness;
5. **Learn in 20 seconds** — contextual Academy content;
6. **Your recovery progress** — timeline, completed work, next review;
7. **What happens next** — waiting / reassessment / Return-to-Origin explanation.

The implementation may reuse current card components where possible. The goal is recomposition, not duplicate UI systems.

## 7. Recovery hero

Introduce a recovery hero above or within the leading recovery experience surface with:

- recovery stage;
- clear headline;
- single dominant CTA when action is required;
- impact/effort/review timing where those values are grounded;
- compact recovery timeline;
- explicit waiting or reassessment messaging when no action is required.

Example shape:

```text
Your Recovery Plan
Rebuilding

You are working towards being ready to check eligibility again.

NEXT BEST ACTION
Register on the electoral roll
Impact: High
Effort: about 5 minutes
Evidence expected: around 4–6 weeks

[ START QUEST ]

Declined ✓ -> Fixing now ● -> Evidence pending -> Reassessment -> Ready
```

Copy must stay neutral and must not imply future approval by the original lender.

## 8. Evidence model boundary

This tranche introduces the presentation/domain boundary for evidence confidence but does not require live CRA or Open Banking integration.

### 8.1 Evidence confidence

Use four customer-understandable semantic states:

- `verified` — independently verified by an approved external/trusted source;
- `confirmed` — current customer/account confirmation with an appropriate basis;
- `pending` — an action has occurred but its effect is not yet mature/verified;
- `unknown` — Credit Quest does not currently know.

Unknown must never be silently converted to false, zero or improvement.

### 8.2 Evidence provenance

The projection may expose a controlled source category:

- customer;
- account;
- partner;
- government action;
- CRA;
- Open Banking;
- eligibility provider;
- unknown.

Partner-provided decline context remains context, not unquestioned Credit Quest truth.

### 8.3 Adapter boundary

Future integrations should enter through evidence adapters rather than directly into React or mission-ranking code.

Conceptually:

```ts
interface EvidenceAdapter<T> {
  source: EvidenceSource;
  fetchEvidence(input: T): Promise<NormalisedEvidence[]>;
}
```

Initial implementation may only map evidence already available from profile, accounts, mission/action attempts, Journey and recovery records. CRA, Open Banking and lender eligibility adapters are deferred.

## 9. Return-to-Origin experience

The existing Return-to-Origin gateway remains authoritative.

The projection only translates gateway state into customer-facing status. Return availability is downstream of independent Credit Quest readiness; it must never be used to decide whether the customer is ready to check.

### 9.1 Unavailable or blocked

Example:

> Returning to your original lender is not available yet. Complete the current recovery plan and wait for the required evidence/reassessment first.

Where safe and appropriate, show the actual blocking class such as evidence incomplete, cooldown active, no return contract, partner route unavailable or regulatory/live route disabled without exposing sensitive/internal logic unnecessarily.

### 9.2 Available

Example:

> You have made the progress we were waiting for. Based on the information we have, you are ready to check eligibility again.

Primary action:

**Continue with [Original Partner]**

Required clarification:

> This is not a guarantee of acceptance. The lender will perform its own eligibility, affordability and lending checks.

The customer must explicitly choose to continue. The CTA invokes an internal Credit Quest endpoint; only the server-owned gateway can resolve the approved destination.

## 10. Main-function continuity

The implementation must preserve the original Credit Quest proposition for all users.

### 10.1 What remains unchanged

- onboarding remains the primary profile setup;
- next-best mission remains authoritative;
- Mission Action Layer remains the execution mechanism;
- Credit Passport remains the explanatory credit-health view;
- Application Readiness remains the authoritative “Can I apply yet?” logic;
- Quest Score remains an internal progress indicator, not a bureau score or approval probability;
- Academy remains contextual education;
- Safe Mode remains independent and can suppress borrowing/product actions;
- commercial economics remain unable to influence customer strategy;
- the normal Build / Optimise / Maintain journey remains available to customers who are not in recovery.

### 10.2 Recovery exit

A customer leaving active recovery retains all normal history and continues the standard Credit Quest lifecycle.

No separate recovery account, score or duplicate mission history is created.

## 11. Error and fallback behaviour

Recovery is additive and must not make the established Credit Quest experience less reliable.

Required behaviour:

- if optional recovery projection enrichment fails, do not corrupt core profile/mission/readiness state;
- if the system knows an active recovery journey exists but cannot build the full recovery projection, show a minimal safe recovery fallback explaining that current recovery detail is temporarily unavailable while preserving access to non-consequential core views; do not silently present an unexplained generic recovery dead end;
- if Return-to-Origin configuration cannot be read, fail closed and show unavailable rather than a guessed destination;
- if evidence source is unavailable, show unknown/unavailable rather than fabricated data;
- if no immediate next mission exists for an active recovery customer, resolve to waiting, reassessment, not-ready or ready-to-check — never an unexplained generic dead end;
- existing Safe Mode and under-18 protections continue to override recovery presentation where applicable.

## 12. Analytics

Reuse existing observational recovery analytics and add recovery-experience events only where needed for product measurement.

Track at minimum:

- recovery hero viewed;
- recovery state viewed;
- next recovery action started;
- waiting-for-evidence state entered;
- reassessment-due state entered;
- reassessment completed;
- ready-to-check state entered;
- Return-to-Origin offered;
- Return-to-Origin accepted/declined.

Analytics remain downstream and must not affect strategy or ranking.

Primary product metrics:

- time to first useful action;
- first-action start rate;
- first-action completion rate;
- time in waiting-for-evidence;
- reassessment completion rate;
- time to ready-to-check;
- voluntary Return-to-Origin rate;
- known downstream requalification/application outcome where lawfully available;
- unexplained/dead-end recovery states: target zero.

## 13. Testing strategy

### 13.1 Domain/projection tests

At minimum:

- normal customer receives no recovery projection;
- active recovery + ranked mission -> `action_required`;
- active recovery + in-review/pending dated action -> `waiting_for_evidence`;
- due dated reassessment -> `reassessment_due`;
- no action + readiness blocked -> `not_ready` with reason/evidence gap;
- independent Application Readiness ready -> `ready_to_check` even when no return contract exists;
- partner return gates independently control `returnState.available` and cannot alter independent readiness;
- partner decline reason cannot override diagnosis;
- unknown evidence remains unknown;
- partner economics unavailable to projection;
- Safe Mode cannot be bypassed;
- under-18 regulated return cannot be enabled;
- mission count or Passport colour alone cannot produce `ready_to_check`;
- missing return configuration fails closed without changing readiness.

### 13.2 Dashboard/component tests

- normal dashboard remains unchanged when no active recovery journey exists;
- recovery hero appears only for active recovery;
- seven-card Quest Feed remains exactly seven cards;
- one dominant recovery CTA when action is required;
- waiting state contains no misleading “up to date” dead-end copy;
- pending electoral-roll scenario renders waiting/review messaging correctly;
- ready-to-check language includes non-guarantee wording;
- ready-to-check without a partner does not invent a Return-to-Origin CTA;
- Return-to-Origin CTA targets an internal Credit Quest route only;
- recovery completion returns the user to normal lifecycle presentation.

### 13.3 E2E personas

- normal credit-building customer never declined;
- direct decline -> action required;
- partner decline -> context review -> action required;
- electoral-roll action submitted -> waiting for evidence;
- cooldown customer -> waiting/not-ready with next review;
- Safe Mode customer -> recovery support without return route;
- active recovery with missing evidence -> not ready;
- reassessment becomes due -> reassess -> new state;
- direct recovery reaches ready-to-check with no partner return route;
- partner recovery reaches ready-to-check -> customer chooses Return-to-Origin;
- customer declines Return-to-Origin and remains in Credit Quest;
- recovery ends -> standard Build/Optimise/Maintain experience continues.

## 14. Implementation slices

The implementation plan should break this design into independently reviewable slices.

Recommended order:

1. **RecoveryExperienceProjection domain contract and RED tests**
2. **State derivation using existing recovery/mission/readiness/Journey outputs**
3. **Recovery hero + timeline UI**
4. **Recovery-aware seven-card Quest Feed recomposition**
5. **Explicit waiting / reassessment / not-ready fallbacks**
6. **Evidence confidence/provenance presentation using existing evidence only**
7. **Return-to-Origin customer surface integration**
8. **Analytics + E2E regression suite**
9. **UX/accessibility/polish pass**

CRA, Open Banking and live eligibility integrations are not part of these slices. They should follow through separately reviewed adapter work after the recovery experience is proven.

## 15. Release boundaries

This design does not authorise:

- live CRA access;
- Open Banking access;
- lender eligibility API access;
- live regulated Return-to-Origin;
- partner callbacks;
- live credit referrals;
- production partner activation;
- changes to FCA operating-model gates;
- use of commercial economics in customer strategy.

Existing dark defaults and server-side release locks remain in force until separately approved.

## 16. Acceptance criteria

This tranche is complete only when:

- the main Credit Quest app remains fully functional for normal customers;
- recovery reuses the same customer record and authoritative core engines;
- active recovery customers receive one coherent recovery-first experience;
- recovery never creates a second decision engine;
- the seven-card Quest Feed remains seven cards;
- every active recovery customer resolves to action-required, waiting-for-evidence, reassessment-due, not-ready or ready-to-check;
- no active recovery path ends with an unexplained “You’re up to date for now” state;
- evidence confidence can distinguish verified, confirmed, pending and unknown;
- no unavailable evidence is fabricated;
- independent `ready_to_check` remains distinct from Return-to-Origin availability;
- Return-to-Origin remains customer-controlled, server-owned and independently gated;
- ready-to-check language never promises approval;
- ending recovery returns the customer to the normal Credit Quest lifecycle with history preserved;
- canonical unit/component/E2E/security tests pass before merge recommendation.

## 17. Product north star

Credit Quest remains the same product, but gains a much stronger contextual mode:

> **For every customer, tell me the next best move and help me make real progress. If I have just been declined, turn that moment into a clear recovery journey and bring me back to the normal Credit Quest lifecycle when I am ready.**
