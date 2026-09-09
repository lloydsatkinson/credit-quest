# Credit Quest V2.3 — Lender Decline Recovery Platform

**Status:** Approved architecture design  
**Date:** 9 September 2026  
**Product:** Credit Quest  
**Scope:** Configurable lender decline taxonomy, Credit Risk/Affordability recovery treatment, applicant recovery journeys, pilot intelligence and controlled alternative-route orchestration.

## 1. Executive proposition

Credit Quest V2.3 turns a lender decline from a dead end into a governed, measurable customer recovery journey.

The product must answer two different questions at the same time:

- **Credit Risk / Affordability:** What actually blocked this application, what evidence could change that position, what genuinely needs time, and when is reassessment meaningful?
- **Customer / Marketing:** What happened, what can I do next, what should I avoid, what needs time, and when might it be sensible to check again?

The architecture therefore uses two layers:

1. **Canonical Credit Risk / Affordability Reason** — precise, auditable, lender-configurable risk logic.
2. **Recovery Treatment Class** — simple, constructive customer-facing treatment such as FIX, BUILD, STABILISE, CREATE HEADROOM, WAIT & REBUILD, LONGER-TERM RECOVERY or FIND A BETTER FIT.

The applicant then receives one coherent journey, even when multiple decline reasons are present.

The commercial proposition is:

> **Turn decline reasons into measurable recovery journeys.**

The customer proposition is:

> **Every decline deserves a useful next step.**

## 2. Non-negotiable architecture boundaries

V2.3 extends the existing closed-loop recovery architecture. It must not create a second creditworthiness, readiness, mission or safety engine.

The following remain authoritative and independent:

- age and under-18 protections;
- Safe Mode and resilience/safety logic;
- customer evidence and unknown-value handling;
- Credit Passport;
- Application Readiness;
- Quest Score boundaries;
- Mission ranking and the seven-card Quest Feed;
- Academy selection and safety filtering;
- existing journey/outcome history;
- Return-to-Origin server-side safety gates.

Partner or lender policy may explain the lender decline and configure when that lender/product can be reconsidered. It may **not** directly set Credit Quest readiness, bypass Safe Mode, manufacture evidence, change mission ranking, inject approval probabilities, or force a commercial route.

All live commercial/referral controls remain dark unless separately approved through the existing release/operating-model gates.

## 3. Product architecture

```text
LENDER / DIRECT DECLINE
        |
        v
STRUCTURED DECLINE CONTEXT
        |
        v
DECLINE CODE NORMALISATION
        |
        v
CANONICAL CREDIT RISK / AFFORDABILITY REASONS
        |
        v
MULTI-BARRIER RESOLVER
        |
        +------------------------+
        |                        |
        v                        v
RECOVERY TREATMENT          PRODUCT-FIT / ROUTE POLICY
        |                        |
        +-----------+------------+
                    v
          APPLICANT JOURNEY SNAPSHOT
                    |
                    v
       CREDIT QUEST CORE GUIDANCE
  Passport / Missions / Academy / Safety
                    |
                    v
 ACTION -> EVIDENCE -> WAIT -> REASSESS
                    |
                    v
 READY / NOT READY / UNKNOWN
                    |
          +---------+----------+
          |                    |
          v                    v
 ORIGINAL PRODUCT       PERMITTED ALTERNATIVE
 FRESH ELIGIBILITY      FRESH ELIGIBILITY
 CHECK                  CHECK
          \                    /
           +--------+---------+
                    v
          LENDER PILOT ANALYTICS
```

## 4. Canonical decline taxonomy

The taxonomy must be precise enough for a Credit Risk team but reusable across lenders. Lender-specific codes map to canonical Credit Quest reasons plus parameters.

Every canonical reason also carries a **solveability class** separate from severity:

- `fix_now` — information or evidence can be corrected/verified;
- `evidence_build` — more reliable history/evidence is needed;
- `time_bound` — real recency/seasoning matters;
- `affordability` — sustainable headroom must improve;
- `structural` — formal or serious state makes near-term borrowing inappropriate;
- `product_fit` — decline may be specific to product/amount/limit/policy;
- `restricted` — fraud/AML/security decision outside normal recovery;
- `unknown` — insufficient information to claim a root cause.

Severity, recovery horizon and solveability are related but not interchangeable.

### 4.1 Public adverse / insolvency

Representative canonical reasons:

- `CCJ_RECENT`
- `CCJ_ACTIVE_UNSATISFIED`
- `DEFAULT_RECENT`
- `CAIS_8_9_RECENT`
- `MORTGAGE_DEFAULT`
- `MORTGAGE_ARREARS_MATERIAL`
- `ACTIVE_IVA`
- `ACTIVE_BANKRUPTCY`
- `RECENT_BANKRUPTCY`
- `ACTIVE_DRO`
- `RECENT_INSOLVENCY`
- `ACTIVE_PROTECTED_TRUST_DEED`
- `ACTIVE_SEQUESTRATION`
- `ACTIVE_DAS`
- `ACTIVE_DMP`
- `ARRANGEMENT_TO_PAY_ACTIVE`

Risk interpretation: material adverse performance, formal insolvency or structured debt-management state. UK jurisdictional variants must be represented without pretending one legal regime applies everywhere.

Typical treatment: WAIT & REBUILD or LONGER-TERM RECOVERY. Active insolvency or serious debt-management states normally suppress new-credit alternatives unless a separately governed non-credit route exists.

### 4.2 Current / recent delinquency

Representative canonical reasons:

- `EARLY_DELINQUENCY`
- `ACTIVE_ARREARS`
- `MISSED_PAYMENT_RECENT`
- `CAIS_3_6_RECENT`
- `DETERIORATING_EXTERNAL_PERFORMANCE`
- `INTERNAL_ARREARS`
- `RETURNED_PAYMENT_RECENT`

Risk interpretation: current or emerging payment instability with heightened near-term loss risk.

Typical treatment: STABILISE, then demonstrate clean/current performance before reassessment.

### 4.3 Credit-seeking / short-term borrowing

Representative canonical reasons:

- `RECENT_STL_ACTIVITY`
- `MULTIPLE_STL_RECENT`
- `HIGH_COST_CREDIT_RECENT`
- `EXCESSIVE_RECENT_SEARCHES`
- `NEW_ACCOUNT_VELOCITY`
- `MULTIPLE_ACCOUNTS_OPENED_RECENTLY`
- `RECENT_APPLICATION_COOLDOWN`

Risk interpretation: heightened recent credit demand, possible liquidity pressure or immature recent exposures.

Typical treatment: WAIT & REBUILD. Stop unnecessary new applications, allow real dated activity to age, demonstrate stability and reassess.

### 4.4 Affordability

Representative canonical reasons:

- `DSR_HIGH`
- `NEGATIVE_DISPOSABLE_INCOME`
- `LOW_DISPOSABLE_INCOME`
- `ESSENTIAL_EXPENDITURE_FAILURE`
- `HIGH_TOTAL_COMMITMENTS`
- `OPEN_BANKING_AFFORDABILITY_FAIL`
- `INCOME_INSUFFICIENT_FOR_REQUEST`
- `INCOME_UNVERIFIED`
- `INCOME_MISMATCH`
- `INCOME_INSTABILITY`
- `EMPLOYMENT_INSTABILITY`
- `RECURRING_ACCOUNT_SHORTFALL`

Risk interpretation: insufficient sustainable headroom or insufficiently reliable affordability evidence.

Typical treatment: CREATE HEADROOM or FIX where the issue is evidence/verification rather than genuine pressure.

A negative disposable-income state is materially different from a product-limit mismatch. V2.3 must not route a genuinely unaffordable applicant to another borrowing product merely because a smaller product exists.

Where a lender passes an Open Banking-derived decline code, Credit Quest may use that structured reason as partner provenance. V2.3 does not imply that Credit Quest itself has live Open Banking access.

### 4.5 Indebtedness / exposure

Representative canonical reasons:

- `UNSECURED_DEBT_HIGH`
- `AGGREGATE_EXPOSURE_HIGH`
- `UTILISATION_HIGH`
- `REVOLVING_BALANCE_HIGH`
- `PERSISTENT_OVERDRAFT_USE`
- `UNARRANGED_OVERDRAFT_FREQUENT`
- `OVERLIMIT_BEHAVIOUR`
- `CASH_ADVANCE_BEHAVIOUR`
- `EXISTING_CUSTOMER_EXPOSURE_LIMIT`

Risk interpretation: leverage, limited headroom or behavioural evidence of financial pressure.

Typical treatment: STABILISE or CREATE HEADROOM, with account-specific actions and evidence-led reassessment.

### 4.6 Credit-file depth / evidence

Representative canonical reasons:

- `THIN_FILE`
- `NO_HIT_FILE`
- `INSUFFICIENT_CREDIT_HISTORY`
- `LIMITED_UK_FOOTPRINT`
- `NEW_TO_UK_LIMITED_HISTORY`
- `INSUFFICIENT_ESTABLISHED_ACCOUNTS`

Risk interpretation: insufficient evidence, not automatically adverse credit.

Typical treatment: BUILD. Establish identity/traceability, reliable payment history and appropriate evidence without manufacturing borrowing purely to create a file.

### 4.7 Data / bureau integrity

Representative canonical reasons:

- `CAIS_DUPLICATE`
- `NOC_DATA_ISSUE`
- `SPECIAL_INSTRUCTION_REVIEW`
- `BUREAU_DATA_DISCREPANCY`
- `ADDRESS_FILE_MISMATCH`
- `IDENTITY_FILE_MISMATCH`
- `ELECTORAL_ROLL_EVIDENCE_GAP`
- `CII_EXCLUSION_OR_FILE_SUPPRESSION`
- `BUREAU_ASSOCIATION_DATA_REVIEW`

Risk interpretation: decision input may be incomplete, inconsistent, duplicated, excluded or under dispute.

Typical treatment: FIX. Check, correct/dispute, verify and reassess. These reasons must not automatically generate debt-reduction missions.

### 4.8 Internal lender performance

Representative canonical reasons:

- `PREVIOUS_INTERNAL_DEFAULT`
- `PREVIOUS_WRITE_OFF`
- `INTERNAL_DELINQUENCY_HISTORY`
- `PRIOR_ACCOUNT_TERMINATION`
- `INTERNAL_RISK_POLICY_HISTORY`

Risk interpretation: lender-specific historic performance that another lender may not share.

Typical treatment: lender-configured WAIT & REBUILD or LONGER-TERM RECOVERY. Credit Quest must preserve provenance and must not claim this is a universal market-wide exclusion.

### 4.9 Risk / affordability score cutoffs

Representative canonical reasons:

- `RISK_SCORE_BELOW_CUTOFF`
- `INTERNAL_SCORE_BELOW_CUTOFF`
- `AFFORDABILITY_SCORE_BELOW_CUTOFF`
- `SCORE_DECLINE_UNEXPLAINED`

Risk interpretation: the lender has supplied a score/cutoff outcome, not necessarily a causal diagnosis.

A score-only decline **must not be decomposed into invented reasons**. If the lender does not supply contributing reason codes that can be safely mapped, Credit Quest preserves the lender decline as score-based/unknown and uses its own independent evidence, Passport and barrier diagnosis to determine useful next actions.

Customer treatment is therefore not “improve your score until you pass”. It is “we were not given enough detail to claim one cause; here is what your current evidence shows is useful to work on.”

### 4.10 Product / exposure / eligibility fit

Representative canonical reasons:

- `REQUESTED_LIMIT_TOO_HIGH`
- `REQUESTED_AMOUNT_TOO_HIGH`
- `TERM_MISMATCH`
- `PRODUCT_LIMIT_MISMATCH`
- `MINIMUM_LIMIT_NOT_MET`
- `TOTAL_EXPOSURE_PRODUCT_LIMIT`
- `PRODUCT_POLICY_MISMATCH`
- `LENDER_POLICY_EXCLUSION`
- `RESIDENCY_POLICY_NOT_MET`
- `PRODUCT_AGE_POLICY_NOT_MET`

Risk interpretation: failure may relate to this particular product, amount, limit or lender eligibility policy rather than a universal inability to borrow.

Typical treatment: FIND A BETTER FIT **only where independent affordability/safety and lender route policy permit a fresh eligibility check**. Pure eligibility rules that are not credit-risk problems should not be presented as damaged credit.

### 4.11 Restricted / non-recovery decisions

Representative categories:

- fraud/security decision;
- AML/financial-crime control;
- sanctions/KYC restrictions;
- CIFAS/fraud-prevention decision where the lender cannot disclose detail;
- other restricted security decisions.

These must remain separate from normal credit recovery. Credit Quest may provide a neutral message or identity-data correction route where appropriate, but must not explain how to circumvent fraud/AML/security controls and must not create a normal “recover this decline” mission chain.

### 4.12 Composite declines

An applicant may receive multiple decline reasons. V2.3 must never present them as competing independent checklists.

The resolver creates:

- one **primary blocker**;
- zero or more **secondary blockers**;
- zero or more **parallel improvements**;
- one coherent customer journey;
- one current next-best action.

## 5. Customer-facing recovery treatment classes

Internal severity and customer language are deliberately separate.

### 5.1 FIX

Use when data, verification or evidence may be wrong, inconsistent or incomplete.

Customer proposition:

> “There may be information to check before you try again.”

Typical sequence:

`CHECK -> CORRECT / VERIFY -> WAIT FOR UPDATE -> REASSESS`

Examples: CAIS duplicate, NOC/data issue, income mismatch, address/file mismatch.

### 5.2 BUILD

Use where the problem is insufficient reliable history rather than adverse behaviour.

Customer proposition:

> “Your credit history needs more evidence, not necessarily fixing.”

Typical sequence:

`ESTABLISH -> BUILD -> MATURE -> REASSESS`

Examples: thin file, no-hit, limited UK history.

### 5.3 STABILISE

Use where current account behaviour or payment performance needs to improve.

Customer proposition:

> “Strengthening financial stability now could improve your position later.”

Typical sequence:

`GET CURRENT / REDUCE RELIANCE -> MAINTAIN -> EVIDENCE -> REASSESS`

Examples: emerging arrears, persistent overdraft, cash advances, overlimit behaviour.

### 5.4 CREATE HEADROOM

Dedicated affordability treatment.

Customer proposition:

> “Let’s improve your monthly breathing room before thinking about another commitment.”

Typical sequence:

`UNDERSTAND COMMITMENTS -> IMPROVE SUSTAINABLE HEADROOM -> VERIFY -> REASSESS`

Important distinction:

- high DSR with otherwise sustainable positive disposable income may eventually permit lower exposure or a different product after fresh checks;
- negative disposable income or essential-expenditure pressure suppresses alternative credit routes until the underlying affordability state genuinely improves.

### 5.5 WAIT & REBUILD

Use where time/recency is materially part of the risk.

Customer proposition:

> “Some things improve with time as well as action.”

Typical sequence:

`FIX WHAT CAN BE FIXED NOW -> MAINTAIN CLEAN BEHAVIOUR -> ALLOW REAL DATED EVENT TO AGE -> REASSESS`

Examples: recent CCJ/default, recent STL activity, excessive searches, recent missed payments.

### 5.6 LONGER-TERM RECOVERY

Use for active or serious structural states where new credit is not a sensible near-term objective.

Customer proposition:

> “This needs more time. We’ll focus on what is useful now and reassess when the underlying position changes.”

Typical sequence:

`PROTECT STABILITY -> RESOLVE / COMPLETE UNDERLYING STATE -> BUILD POSITIVE EVIDENCE WHERE APPROPRIATE -> REASSESS`

Examples: active IVA, active bankruptcy, active DRO, protected trust deed/sequestration or serious debt-management state.

### 5.7 FIND A BETTER FIT

Use only where the original decline is primarily product/limit/exposure fit and a separately governed lender route permits another eligibility check.

Customer proposition:

> “The original product isn’t available, but there may be another option worth checking.”

This is never automatic approval or a Credit Quest suitability recommendation.

### 5.8 Score-only / insufficient-reason handling

A score cutoff without mapped causal reason codes does not become a fake recovery diagnosis.

Customer proposition:

> “We weren’t given enough detail to say there was one specific cause. We can still show what your current evidence suggests is worth working on.”

The journey then uses the normal Credit Quest barrier, Passport, Mission and readiness engines.

## 6. Lender-configurable policy model

V2.3 must not hard-code universal lender rules such as “CCJ = 24 months”.

A canonical reason accepts lender/product-specific parameters, for example:

```text
Partner: Lender A
Product: Standard Card
Lender decline code: RISK_0187
Canonical reason: CCJ_RECENT
Parameters:
  lookback_months = 24
Severity: high
Solveability: time_bound
Treatment: WAIT_AND_REBUILD
Original product: blocked until rule satisfied
Alternative credit routes: none
Customer copy version: 3
Policy version: 7
```

Another lender may map the same canonical reason with a 12-, 18- or 36-month policy window.

Parameters may include controlled values such as:

- lookback months;
- DSR threshold;
- minimum disposable income / headroom rule where contractually supplied;
- recent search count/window;
- new-account count/window;
- STL count/window;
- minimum clean-payment period;
- product-specific exposure limit;
- minimum evidence-confidence requirement;
- minimum wait/reassessment point where genuine lender policy supplies one.

The configuration system must not permit arbitrary SQL, JavaScript or executable expressions.

### 6.1 No policy-gaming design

Lender thresholds exist to evaluate policy, not to become a customer-facing recipe for getting just under a cutoff.

Unless a lender explicitly approves a transparent parameter for disclosure, Credit Quest should not display private thresholds such as:

- “get DSR below 50%”;
- “wait exactly until this lender’s score rule passes”;
- “reduce exposure by £X solely to clear rule Y”.

Customer journeys should focus on genuine improvements such as sustainable headroom, stable payments, corrected data, matured evidence and reduced unnecessary credit-seeking.

The simulator/admin view may show the exact configured policy condition to authorised operators. The customer view normally uses controlled plain-English treatment language.

## 7. Controlled condition language

Journey/reassessment conditions use an allowlisted deterministic expression model, for example:

```text
DSR > lender_parameter
months_since_CCJ >= lender_parameter
electoral_roll = confirmed
active_IVA = false
recent_STL_count < lender_parameter
evidence_confidence >= required_level
```

Supported logical composition is bounded to approved operators such as `AND` / `OR` and safe comparisons.

There are two classes of condition:

1. **Lender policy conditions** — configurable.
2. **Credit Quest integrity/safety conditions** — not lender-configurable.

The effective commercial route is always:

```text
lender policy permits route
AND Credit Quest safety permits presentation
AND required evidence is present
AND current readiness permits a check
AND disclosure/contract/runtime controls pass
AND customer explicitly chooses
```

## 8. Configurable recovery objects

V2.3 introduces six governed configuration concepts.

### 8.1 `canonical_decline_reasons`

Defines the reusable Credit Quest taxonomy.

Core properties:

- canonical code;
- risk family;
- default severity;
- default recovery horizon;
- solveability class;
- permitted treatment classes;
- whether routeable alternatives can ever be considered;
- customer-language category;
- restricted/non-recovery flag where applicable;
- jurisdiction scope where relevant.

### 8.2 `partner_decline_mappings`

Maps partner/product decline codes to canonical reasons.

Core properties:

- partner;
- product/product family;
- external decline code;
- canonical reason;
- parameters;
- lender-owned explanatory wording where permitted;
- effective dates;
- version/state.

### 8.3 `recovery_templates`

Defines the high-level treatment journey.

Core properties:

- treatment class;
- eligible canonical reasons;
- severity/horizon;
- solveability class;
- customer headline/explanation;
- step ordering policy;
- default reassessment behaviour;
- version/state.

### 8.4 `recovery_steps`

Each step contains:

- step type: action / education / wait / evidence / correction / reassessment;
- phase: NOW / NEXT / THEN / LATER;
- priority;
- customer wording;
- existing Mission/Action reference where applicable;
- completion evidence;
- entry conditions;
- exit conditions;
- minimum genuine wait where supplied;
- blocking status;
- required / recommended / informational status.

### 8.5 `reassessment_rules`

Defines the conditions that make reassessment meaningful.

Rules may be:

- evidence driven;
- event driven;
- lender-policy/date driven;
- combinations of controlled conditions.

No fabricated reassessment date is permitted.

### 8.6 `alternative_route_policies`

Defines whether a fresh eligibility check for the original or another lender-configured product may be offered.

Core properties:

- source product;
- destination product/product family;
- eligible decline families/reasons;
- blocked decline families/reasons;
- required evidence;
- minimum genuine wait;
- route priority;
- eligibility-check mechanism;
- disclosure/contract reference;
- policy version.

## 9. Configuration lifecycle and auditability

Every configurable policy follows:

`draft -> tested -> published -> retired`

A published version is immutable. Changes create a new version.

When an applicant enters recovery, Credit Quest stores an immutable **Recovery Policy Snapshot** containing at least:

- partner;
- original product/product family;
- decline codes received;
- canonical reasons resolved;
- lender parameters applied;
- mapping/template/reassessment/route versions;
- primary/secondary/parallel barrier resolution;
- effective treatment class;
- solveability class;
- original-product route state;
- alternative-route policy version.

A later policy change must not rewrite historical applicant treatment or historical lender reporting.

## 10. Multi-barrier treatment resolver

The resolver must prioritise reasons based on customer safety, affordability and material risk rather than code order.

Default precedence concept:

1. restricted/non-recovery decisions;
2. active structural insolvency / serious debt-management state;
3. affordability/safety blockers;
4. serious adverse credit / active arrears;
5. current/recent delinquency;
6. time-bound credit-seeking behaviour;
7. material indebtedness/exposure;
8. data correction where it is not the primary cause but can run in parallel;
9. thin-file/evidence building;
10. score-only/unknown reason handled through independent Credit Quest diagnosis;
11. product-fit / routeable mismatch.

This is not a simple numeric sort. Some tasks may run safely in parallel.

Example input:

```text
DSR = 56%
2 short-term lending accounts opened in last 3 months
thin file
```

Resolution:

```text
Primary blocker: affordability
Secondary blocker: recent credit-seeking
Parallel improvement: thin-file evidence

NOW: create sustainable headroom
NEXT: stop unnecessary applications / allow recent activity to age
WHILE WAITING: strengthen non-conflicting identity/payment evidence
REASSESS: only when affordability and recency conditions support it
```

The customer receives one coherent plan and one dominant next-best move.

## 11. Customer journey integration

Recovery is contextual presentation around the existing Credit Quest product.

The customer continues to use:

- Profile and Accounts;
- Credit Passport;
- Application Readiness;
- seven-card Quest Feed;
- Credit Quest Academy;
- existing Mission/Action Layer;
- Journey/Outcomes;
- reassessment.

A decline changes the context of the journey; it does not create a second customer product.

Customer-facing recovery must always answer:

- Where am I now?
- What should I do next?
- Why does it matter?
- What evidence are we waiting for?
- Is the decisive factor something I can change or something that needs time?
- When is reassessment meaningful?
- Is the original product still blocked?
- Is any alternative fresh eligibility check genuinely permitted?

## 12. Journey Builder — internal control plane

The internal Credit Quest admin surface becomes the authorised configuration control room.

Suggested navigation:

```text
Lenders
 -> Products
 -> Decline-code mappings
 -> Recovery policies
 -> Journey templates
 -> Reassessment rules
 -> Alternative routes
 -> Pilots
 -> Simulator
 -> Publishing/version history
```

The internal control plane may create/edit draft configuration, run simulations and publish/retire approved versions.

The lender-facing console remains read-only and does not expose production policy mutation.

## 13. Journey Simulator

Before a configuration can be published, an authorised operator must be able to simulate a synthetic applicant using the exact production resolver logic.

Inputs include:

- partner;
- product;
- one or more decline codes;
- relevant synthetic evidence;
- optional point-in-time/date context.

Output includes:

- canonical reasons;
- solveability class;
- primary/secondary/parallel barrier resolution;
- customer treatment class;
- NOW/NEXT/THEN/LATER journey;
- current Passport/readiness implications from the real core engine where synthetic evidence supports them;
- reassessment rule;
- original-product state;
- permitted/suppressed alternative routes;
- suppression reasons;
- exact policy versions.

The simulator must not implement a separate “preview” decision engine.

## 14. Lender Pilot Console

The lender console is a separate partner-scoped read-only surface, not an extension of unrestricted `/admin` controls.

### 14.1 Access model

A lender user authenticates normally, then server-side membership maps them to an authorised partner/pilot scope.

They must not be able to:

- modify policies;
- access another partner’s data;
- browse customer-level PII;
- see support/vulnerability detail;
- inspect Credit Quest safety/readiness thresholds;
- inspect confidential lender policy cutoffs unless separately agreed for that role;
- change return destinations or commercial controls.

### 14.2 Overview

Headline funnel:

`Handoffs -> Activated -> Started Recovery -> Reassessed -> Ready to Check -> Voluntary Return`

Headline rates:

- Activation Rate;
- Action Rate;
- Ready-to-Check / Recovery Rate;
- Return Rate;
- End-to-End Yield;
- Median Time to First Action;
- Median Time to Ready.

### 14.3 Decline Intelligence

Aggregate recovery performance by:

- canonical decline family/reason;
- solveability class;
- partner product/product family;
- pilot cohort/time period;
- single vs composite decline;
- treatment class.

This allows a lender to learn which decline populations are highly recoverable, time-bound, structurally blocked, affordability-led or primarily product-fit related.

No customer-level surveillance is required in V2.3.

### 14.4 Recovery-path analysis

For a reason/treatment cohort, show aggregate movement such as:

`activated -> first action -> evidence achieved -> reassessed -> ready -> returned`

This can identify where a recovery journey is ineffective without exposing personal sensitive data.

### 14.5 Alternative-route reporting

Original-product recovery and alternative-product checks must remain separately reported.

Never inflate “recovery” by combining a lower-product route with original-product return without clear labels.

## 15. KPI definitions and historical truth

Commercial reporting must use historical/cohort truth rather than mutable current snapshots wherever an event is intended to represent “ever achieved”.

Required KPI definitions:

- **Handoffs:** pilot-assigned partner decline sessions received.
- **Activated:** handoff redeemed/bound to the customer journey.
- **Started Recovery:** activated journey with at least one qualifying recovery action started.
- **Action Rate:** Started Recovery / Activated.
- **Reassessed:** journey with at least one genuine reassessment event.
- **Ready to Check:** journey that has genuinely reached `ready_to_check` at least once under governed Credit Quest logic.
- **Recovery Rate:** Ready to Check / Activated.
- **Voluntary Returns:** ready customer explicitly chooses to continue and the governed return completes to the point defined by the route contract.
- **Return Rate:** Voluntary Returns / Ready to Check.
- **End-to-End Yield:** Voluntary Returns / Handoffs.
- **Time to First Action:** median elapsed time from activation to first qualifying recovery action.
- **Time to Ready:** median elapsed time from activation to first genuine ready-to-check event.
- **Suppression Reasons:** controlled aggregate reasons a return/alternative route was unavailable or suppressed.

Do not label any metric **Reapproval Rate**, **Approval Probability** or **Approval Rate** unless a future authoritative lender outcome feed genuinely provides approval outcomes and a separate design approves that metric.

## 16. Data-source hierarchy

Commercial KPI truth should come from governed server-side data and historical outcomes, not browser presentation telemetry.

Use:

- intake sessions for handoff/activation context;
- recovery journeys for ownership/context;
- append-only journey/recovery outcomes for historical events;
- mission/action records for qualifying action starts/completions;
- return attempts for voluntary return outcome;
- immutable policy snapshots for historical configuration provenance.

Best-effort UI analytics remain useful for presentation/engagement diagnostics but are not the authoritative commercial funnel source.

## 17. Pilot data model

V2.3 should introduce a thin pilot/reporting layer rather than duplicate customer data.

Conceptual objects:

- `recovery_pilots` — partner, pilot identity, sandbox status, start/end dates, target cohort and lifecycle state;
- `recovery_pilot_assignments` — associates an intake/recovery journey with a pilot/cohort/batch;
- `lender_portal_members` — authorised lender identity to partner/pilot scope;
- immutable policy snapshots linked to each recovery journey;
- historical first-ready event/timestamp derived from or materialised from append-only outcomes.

No copied customer profile, Passport, mission or readiness record is required.

## 18. Alternative product / route logic

A lender may configure a product ladder, for example:

```text
Premium Card
 -> Standard Card
 -> Lower-Limit Product
 -> Credit-Building Product
 -> Recovery Only
```

But a configured ladder is merely a set of permitted eligibility-check routes.

The system must distinguish:

- **fundamentally inappropriate for further borrowing now** — e.g. negative disposable income / active insolvency;
- **time-bound risk** — e.g. recent credit-seeking;
- **insufficient evidence** — e.g. thin file;
- **product/exposure mismatch** — e.g. requested limit too high;
- **score-only unknown cause** — do not infer suitability from the score outcome alone.

A route can be shown only when all independent safety/evidence/readiness/disclosure/runtime gates pass.

Customer wording must use “check eligibility” or equivalent controlled language, never “suitable”, “approved”, “pre-approved” or “guaranteed”.

The router must never optimise a customer to the edge of a lender cutoff. It evaluates current genuine evidence against governed conditions at reassessment time.

## 19. Marketing-friendly language layer

Internal labels are not displayed verbatim when they would be unnecessarily harsh or misleading.

Examples:

| Internal concept | Customer language |
|---|---|
| structural / long-horizon decline | “This needs more time.” |
| affordability fail / negative DI | “Let’s improve your monthly breathing room first.” |
| thin file | “Let’s build a clearer picture of your credit reliability.” |
| recent adverse event | “Some things improve with time as well as action.” |
| data discrepancy | “There may be information to check before you try again.” |
| product mismatch | “The original product isn’t available, but another option may be worth checking.” |
| score cutoff without causal reason | “We weren’t given enough detail to say there was one specific cause.” |
| pure eligibility/policy mismatch | “This product’s criteria were not met; that does not automatically mean your credit is poor.” |

Marketing copy must stay constructive without hiding material blockers.

## 20. Error and fail-closed behaviour

V2.3 must fail closed where configuration or provenance is incomplete.

Examples:

- unknown lender code -> preserve as unknown / unmapped; do not invent a canonical diagnosis;
- score-only decline without causal codes -> preserve score-based/unknown provenance and use independent Credit Quest diagnosis;
- ambiguous mapping -> no route/published treatment until resolved;
- missing policy version -> do not silently use “latest” for an existing applicant snapshot;
- unsupported condition -> configuration cannot publish;
- missing required evidence -> remain unknown / blocked as appropriate;
- unavailable analytics source -> report unavailable, not zero;
- unavailable alternative route contract -> no route is shown;
- conflicting structural and product-fit reasons -> structural/safety blocker wins;
- restricted fraud/AML/security decline -> no normal recovery/alternative credit chain.

## 21. Security and privacy

Lender-facing reporting is aggregate/cohort based in V2.3.

Do not expose:

- customer names;
- email addresses;
- authentication IDs;
- raw financial balances/transactions;
- detailed CRA data;
- support/vulnerability information;
- health data;
- Credit Quest internal strategy thresholds;
- confidential lender thresholds outside authorised operational roles;
- affiliate/commercial economics;
- arbitrary customer-level browsing.

Internal admin and lender portal membership are separate trust boundaries.

## 22. Synthetic pilot demonstration

V2.3 must support a controlled synthetic 100-customer demonstration covering representative reasons such as:

- recent CCJ;
- active IVA;
- bankruptcy / Scottish insolvency equivalent;
- CAIS 8/9;
- early delinquency;
- recent STL activity;
- thin file;
- CAIS duplicate;
- NOC/data issue;
- high DSR;
- negative disposable income;
- score-cutoff-only decline;
- product/limit mismatch;
- multiple combined declines.

The demonstration should exercise:

`handoff -> mapping -> barrier resolution -> customer journey -> evidence/time progression -> reassessment -> ready/not-ready -> original/alternative route -> pilot analytics`

Synthetic metrics must always be visibly labelled as synthetic/demo data.

## 23. Delivery decomposition

This design is one integrated V2.3 architecture, but implementation should be delivered in bounded tranches so each boundary can be verified independently.

Recommended sequence:

1. **Taxonomy + versioned mapping domain**
2. **Treatment templates + controlled condition model**
3. **Multi-barrier resolver + policy snapshot**
4. **Recovery Journey integration with existing customer engines**
5. **Journey Builder + Simulator**
6. **Pilot/cohort data model + partner-scoped read-only reporting repository**
7. **Lender Pilot Console**
8. **Alternative-route configuration and sandbox-only orchestration**
9. **Synthetic 100-customer demo + end-to-end pilot verification**
10. **Release hardening, architecture regression tests and README update**

Evidence/provider integrations such as live CRA/Open Banking are not required for V2.3. They belong in a later adapter tranche once the configurable recovery operating model is proven.

## 24. Testing and release gates

Implementation plan must require TDD and explicit architecture regression coverage.

Minimum test themes:

- every canonical reason maps to an allowed risk family, solveability class and treatment set;
- lender parameters are versioned and scoped by partner/product;
- UK jurisdictional insolvency mappings remain explicit;
- unknown/unmapped reasons stay unknown;
- score-cutoff-only declines do not invent causal reasons;
- customer surfaces do not expose confidential policy thresholds by default;
- journeys improve genuine evidence rather than coach customers to game cutoffs;
- active structural/affordability blockers suppress inappropriate alternative routes;
- product-fit-only cases can expose a permitted eligibility-check route only after all gates pass;
- multiple declines resolve deterministically to primary/secondary/parallel treatment;
- data-correction reasons do not generate unrelated indebtedness missions;
- thin-file treatment does not manufacture a borrowing recommendation;
- negative DI cannot be “solved” by lower limit alone;
- restricted fraud/AML/security decisions never enter normal recovery routing;
- published versions are immutable and historical applicants retain their snapshot;
- simulator and production resolver use the same domain logic;
- lender portal is partner scoped and cannot access `/admin` mutation controls;
- lender analytics contain no prohibited customer/sensitive fields;
- commercial metrics use historical event truth and do not fall when current readiness later changes;
- missing reporting sources display unavailable rather than zero;
- existing normal seven-card Quest Feed remains unchanged for non-recovery customers;
- Safe Mode, under-18 and core readiness/Passport authority remain upstream;
- all live/referral/email dark defaults remain unchanged unless separately authorised.

Final release verification should include unit, integration, E2E, Supabase/RLS/privilege tests, lint, build and exact-head CI/Vercel verification according to the established repository workflow.

## 25. Explicit non-goals for V2.3

Do not add:

- a new CRA score;
- approval probability;
- lender underwriting decisions inside Credit Quest;
- arbitrary lender-written executable logic;
- customer-level lender surveillance;
- live CRA/Open Banking integration presented as connected;
- live credit broking merely because the sandbox system works;
- AI-generated credit treatment replacing deterministic configuration;
- a second Passport/readiness/mission engine;
- unlimited lender self-service production policy changes;
- a fraud/AML circumvention journey;
- customer-facing coaching designed to reverse-engineer or game lender cutoffs;
- dozens of new generic missions simply to make the app look larger.

## 26. Success criteria

V2.3 is successful when a completely synthetic lender can:

1. configure a product and a set of decline codes;
2. map those codes into a governed Credit Risk/Affordability taxonomy;
3. classify each reason by severity, solveability and treatment without confusing those concepts;
4. configure policy parameters, treatment and reassessment rules;
5. simulate single and multiple-decline applicants;
6. hand off synthetic declined customers to Credit Quest;
7. give each customer one coherent evidence-led recovery journey using the existing Passport, Quest Feed, Academy, Actions and readiness engines;
8. distinguish fixable, buildable, affordability, time-bound, structural, product-fit, restricted and genuinely unknown populations;
9. preserve score-only declines as non-causal unless real reason codes exist;
10. permit an alternative fresh eligibility check only where independent safety/readiness/evidence and lender route rules permit it;
11. view the aggregate recovery funnel and decline intelligence in a partner-scoped read-only lender console;
12. explain, months later, exactly why a customer received a particular recovery journey using immutable policy/version provenance.

The target sales demonstration is:

> “Give Credit Quest one of your decline rules. We can show how it is normalised, how the applicant journey is configured, what the customer sees, when reassessment becomes meaningful, and what the lender can measure — without turning Credit Quest into your underwriting engine.”
