# Credit Quest V2 — Product and Architecture Design

Date: 2026-08-26
Status: Approved design, implementation not yet started
Repository: `lloydsatkinson/credit-quest`

## 1. Purpose

Credit Quest V2 evolves the existing V1 application into a differentiated UK credit-access navigation product for people who are underserved, thin-file, new-to-credit, new-to-UK, rebuilding after adverse credit events, financially constrained, or seeking to optimise an already stable profile.

The master proposition is:

> Credit Quest tells you what to do next — and when you're ready to apply.

The product should answer five questions clearly:

1. What is holding me back?
2. What should I do now?
3. What should I avoid doing?
4. When should I check again?
5. Am I ready to apply?

V2 is an evolution of the current application. Working V1 code should be preserved where it fits the new architecture. The objective is not to rebuild the product for cosmetic reasons, but to insert stronger diagnosis, safety, readiness, lifecycle, and UX layers around the existing deterministic mission engine.

## 2. Non-negotiable product principles

### 2.1 User benefit before monetisation

The decision flow remains one-way:

```text
Profile
  ↓
Safety / vulnerability check
  ↓
Barrier diagnosis
  ↓
Credit Passport
  ↓
Application Readiness
  ↓
Mission ranking
  ↓
Optional product fit / offer matching
```

Commercial data must never flow back into mission ranking, barrier classification, safety mode, or Application Readiness.

Affiliate commission, lender payout, campaign economics, conversion rate, or commercial priority must not alter the user's next-best action.

### 2.2 Deterministic, explainable decisioning

The recommendation engine remains rules-based, testable, and auditable.

AI may later explain, coach, simplify, answer questions, and personalise tone. AI must not independently decide whether a user is creditworthy, invent lender criteria, or generate untraceable lending recommendations.

### 2.3 Protect the customer from unnecessary applications

Credit Quest must be willing to recommend waiting.

A valid mission may be:

> Do not apply yet.

Application volume is not a success metric by itself. Avoiding an unnecessary hard search can be a successful customer outcome.

### 2.4 Financial vulnerability takes precedence over credit-building

The app must distinguish between an underserved customer and a financially vulnerable customer.

When signals suggest meaningful financial stress, Safe Mode suppresses inappropriate borrowing-related offers and prioritises financial stability, missed-payment prevention, cash-flow resilience, and appropriate support.

### 2.5 Under-18 separation

Users aged 16–17 remain in education mode. They receive no credit-product referrals and no encouragement to borrow. The restriction is enforced in domain/server logic, not only in presentation.

## 3. Delivery strategy

V2 will be delivered incrementally rather than as a big-bang replacement.

### Release V2.0a — Product Integrity

- Separate mission started from mission completed.
- Make mission completion update the actual customer profile where appropriate.
- Recalculate missions after completion.
- Remove unsafe substantive defaults from onboarding.
- Support unknown answers.
- Add Safe Mode / offer suppression.
- Correct analytics for mission lifecycle.

### Release V2.0b — Intelligence Foundation

- Barrier diagnosis.
- Credit Passport.
- Application Readiness.
- “Can I Apply Yet?” experience.

### Release V2.0c — Product Experience

- Expand mission catalogue to approximately 25 high-quality missions.
- Add real review/cooldown dates.
- Introduce the TikTok-inspired Quest Feed.
- Add the detailed Credit Passport experience and two-mode navigation.

### Release V2.0d — Decline Recovery

- Add “I’ve just been declined” onboarding route.
- Produce 90-day / 180-day recovery plans.
- Add partner-ready extension points for future lender programmes.

Future P2/P3 work covers Open Banking, CRA data, soft-search eligibility, Product Fit Score, AI Credit Coach, and lender-facing capabilities.

## 4. Existing V1 elements to preserve

The following V1 elements remain valuable and should be extended rather than discarded:

- Next.js App Router, TypeScript, Tailwind.
- Supabase authentication, Postgres and Row Level Security.
- Mobile-first PWA foundation.
- Existing age-gating model.
- Deterministic mission ranking concept.
- Quest Score as a secondary gamification metric.
- Separation between mission ranking and offers.
- Existing `profiles`, `user_missions`, and `events` tables as migration starting points.
- Existing tests for age gate, Quest Score, mission engine, offers, onboarding and E2E journeys.

The current mission catalogue is too small, current onboarding defaults are unsafe, and current mission state handling is not sufficient for V2. These should be changed without replacing unrelated working foundations.

## 5. Domain architecture

V2 introduces clear domain boundaries.

```text
lib/domain/
  profile/
  safety/
  diagnosis/
  passport/
  readiness/
  missions/
  offers/
  decline-recovery/
  external-data/
  analytics/
```

The exact folder structure may remain flatter if that is clearer in implementation, but conceptual boundaries must be preserved.

### 5.1 Profile

`CreditProfile` remains the canonical normalised input to deterministic engines.

The profile is expanded to distinguish:

- known value
- unknown value
- not applicable
- future externally verified value

The model should support provenance later without requiring external integrations immediately.

Important profile categories include:

- identity and address context
- employment and income context
- housing context
- electoral roll
- revolving-credit presence
- utilisation
- payment performance
- recent hard applications
- direct-debit protection
- decline context
- onboarding goal
- new-to-UK context
- affordability context as data becomes available

No substantive financial field should silently default to a plausible-looking customer answer.

### 5.2 Safety assessment

Add a deterministic safety result:

```ts
type SafetyMode = "normal" | "caution" | "safe_mode";

interface SafetyAssessment {
  mode: SafetyMode;
  reasons: string[];
  suppressedMissionCategories: string[];
  suppressOffers: boolean;
}
```

V2.0a must only use evidence actually present in the profile. It must not infer financial distress from missing data.

Potential early signals include combinations of:

- multiple recent missed payments
- repeated recent applications
- repeated declines where known
- later: persistent overdraft usage
- later: low disposable income
- later: high debt servicing
- later: deteriorating affordability

Safe Mode behaviour:

- suppress credit-product offers
- suppress missions whose primary purpose is taking new borrowing
- prioritise payment protection and financial stability
- surface suitable support/signposting when appropriate
- explicitly explain why credit-building is not the priority

### 5.3 Barrier diagnosis

Add a deterministic diagnosis engine.

```ts
type BarrierType =
  | "credit_invisible"
  | "thin_file"
  | "new_to_uk"
  | "credit_rebuilder"
  | "affordability_constrained"
  | "optimiser";

interface BarrierDiagnosis {
  primary: BarrierType;
  secondary: BarrierType[];
  confidence: "low" | "medium" | "high";
  factors: DiagnosisFactor[];
}
```

The engine must explain which profile facts created the diagnosis. Multiple barriers may coexist, but one primary barrier is always chosen when enough evidence exists.

If information is insufficient, the UI should say so instead of manufacturing precision.

### 5.4 Credit Passport

Credit Passport becomes the serious analytical representation of the customer's position.

Five initial pillars:

1. Identity & Traceability
2. Payment Health
3. Debt & Headroom
4. Affordability & Stability
5. Application Readiness

Each pillar returns:

```ts
type PassportStatus = "green" | "amber" | "red" | "unknown";

interface PassportPillar {
  id: string;
  status: PassportStatus;
  strength: string;
  helping: string[];
  hurting: string[];
  unknowns: string[];
  nextActions: string[];
}
```

The pillar system must use plain English and avoid pretending to be a lender approval probability.

The existing Quest Score remains visible as a light progress metric but is not the primary decision surface.

### 5.5 Application Readiness

Application Readiness is a first-class domain engine.

```ts
type ReadinessState = "red" | "amber" | "green" | "unknown";

interface ApplicationReadiness {
  state: ReadinessState;
  headline: string;
  reasons: string[];
  avoid: string[];
  actions: string[];
  reassessAt: string | null;
  daysUntilReassessment: number | null;
}
```

User-facing states:

- Red — Do not apply yet
- Amber — Getting closer
- Green — Worth checking eligibility
- Unknown — We need more information

Green does not mean approval is likely. It means the profile no longer contains the current deterministic blockers that Credit Quest is designed to recognise and that a soft eligibility check may be appropriate where available.

The engine should generate concrete reassessment dates when the rule is time-based.

### 5.6 Mission engine

The mission engine remains deterministic but gains richer metadata and lifecycle support.

A mission definition should support fields conceptually equivalent to:

```ts
interface MissionDefinition {
  id: string;
  slug: string;
  title: string;
  description: string;
  rationale: string;
  category: MissionCategory;
  stage: JourneyStage;
  impact: ImpactLevel;
  priorityWeight: number;
  barrierTargets: BarrierType[];
  passportPillars: string[];
  safeModeAllowed: boolean;
  referralCategory?: string;
  reviewPeriodDays?: number;
  cooldownDays?: number;
  isEligible(profile: CreditProfile, context: EngineContext): boolean;
  completionEffect?: CompletionEffect;
}
```

Commercial fields do not belong in this definition.

### 5.7 Mission lifecycle

The user's mission record is independent of the static mission definition.

Supported lifecycle states:

```ts
type MissionState =
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
```

Starting a mission must never mark it completed.

Completion is an explicit action and, when appropriate, applies a structured effect to the underlying profile.

Example:

```text
Mission: Set up a direct debit
Start → state = started
User confirms completion
→ hasDirectDebitForCredit = true
→ state = completed
→ mission engine recalculates
→ mission becomes no longer eligible
→ next mission is selected
→ Passport recalculates
→ Readiness recalculates if affected
```

No parallel progress counter should simulate success independently of actual profile state.

### 5.8 Offer matching and Product Fit boundary

V2.0a retains simple demo offer matching, but inserts hard safety gates before any offer is returned.

Order:

```text
mission selected
  ↓
customer age check
  ↓
safety / vulnerability check
  ↓
mission permits referral?
  ↓
offer matching
```

Later Product Fit Score can include user goal, eligibility, affordability, APR, fees, product purpose, likely limit, reporting behaviour, downside risk, vulnerability and existing debt position.

Affiliate commission must remain excluded from suitability scoring.

## 6. Onboarding redesign

Onboarding becomes progressive, personalised, and free from unsafe defaults.

### 6.1 First question

The first question becomes:

> What brought you to Credit Quest?

Recommended options:

- I’m new to credit
- I’ve just been declined
- I’m new to the UK
- I want to improve my credit position
- I’m rebuilding after credit problems
- I want to prepare for a mortgage
- I want to prepare for car finance
- I want better credit products
- I’m not sure — help me work it out

This answer tailors question order and explanation, but deterministic strategy remains based on actual financial circumstances rather than age or marketing segment.

### 6.2 No substantive defaults

Do not initialise users as employed, £30k–£50k, renting, or with any other plausible financial state.

Inputs should begin unset unless they are technical UI defaults with no financial meaning.

### 6.3 Unknown states

Questions should support “I don’t know” where appropriate, especially:

- utilisation
- number of recent hard searches
- electoral-roll status
- credit-file detail
- decline reason

Unknown is an explicit state, not silently converted to zero or false.

### 6.4 Adaptive question flow

Question routing should depend on earlier answers.

Examples:

- no revolving credit → do not ask utilisation percentage
- unemployed → no annual employment income band question
- just declined → ask when, what product category, and whether a reason was provided
- new to UK → ask UK residency/address/banking context
- under 18 → education-oriented route and no product-oriented questions

## 7. Mission catalogue expansion

V2.0c targets approximately 25 strong missions with a structure that can later support 30–50+.

Initial categories:

### Identity

- register on electoral roll where eligible
- correct address mismatch
- align address records
- review identity data inconsistency
- allow address history to mature

### Payment protection

- set up direct debit
- protect next payment
- bring arrears current where appropriate
- prioritise contractual minimums
- set payment reminder

### Utilisation

- reduce utilisation
- avoid maxing limits
- reduce highest-risk balance first
- avoid increasing limit dependency

### Applications

- application cooldown
- avoid multiple hard searches
- eligibility-first behaviour
- wait until review date

### Credit history

- safely establish first revolving history when appropriate
- preserve useful account history
- avoid unnecessary closures
- allow accounts to mature

### Affordability / stability

- reduce overdraft dependence
- increase monthly buffer
- reduce avoidable debt servicing
- stabilise income evidence

### Credit-file hygiene

- inspect incorrect adverse marker
- dispute incorrect data
- correct duplicate/inconsistent account information

### Product optimisation

Only where appropriate:

- consider low-limit credit-builder product
- check soft-search eligibility
- review high-cost borrowing
- review balance-transfer suitability

### Wait / no action

Waiting is a first-class mission category.

Example:

> Your recent application activity needs time to age. Applying for another product now is unlikely to improve your position.

## 8. TikTok-inspired Quest Feed

The TikTok-style interaction model is a core V2 requirement, not a decorative reskin.

The product should borrow the interaction grammar of vertical short-form feeds while avoiding manipulative engagement mechanics.

### 8.1 Default everyday experience

The default home experience is **Quest Feed**.

Characteristics:

- mobile-first
- vertical swipe / scroll-snap interaction
- one idea per card/screen
- large headlines
- minimal body copy
- strong visual hierarchy
- short expandable explanations
- meaningful motion when progress changes
- simple progress milestones
- short educational cards
- personalised content order

The initial feed may contain 4–7 cards rather than an infinite feed.

Recommended card sequence:

1. Your next move
2. Why this matters
3. What to avoid
4. When we reassess
5. Your Credit Passport change
6. Application Readiness
7. Learn in 20 seconds

Example:

```text
YOUR NEXT MOVE

Wait before applying again

You have three recent applications.

Review again in 42 days.

[Start plan]
```

Swipe/scroll:

```text
WHY THIS MATTERS

Another hard application now may make your profile harder for some lenders to assess.
```

Swipe/scroll:

```text
YOUR PASSPORT

Identity                 Green
Payment Health           Green
Debt & Headroom          Amber
Affordability            Green
Application Readiness    Red
```

### 8.2 Feed interaction rules

Use:

- CSS scroll snapping or equivalent native-feeling vertical interaction
- clear progress indicator so users know the feed is finite
- touch-friendly controls
- accessible keyboard/scroll fallback
- reduced-motion support
- expandable details for users wanting depth

Do not use:

- endless content
- streaks that encourage borrowing
- fake urgency
- autoplay advertising
- product ads disguised as education
- engagement loops optimised only for session time

The desired feel is immediate, modern, visual and personalised — not addictive.

### 8.3 Feed content generation

Feed cards are generated from structured deterministic outputs:

```text
SafetyAssessment
BarrierDiagnosis
ApplicationReadiness
RankedMission
CreditPassport
EducationLibrary
```

The feed presentation must not contain decision logic of its own.

## 9. Two-mode navigation

V2 has two clear top-level experiences.

### 9.1 Quest Feed

The everyday mode.

Focus:

- next mission
- why it matters
- what to avoid
- readiness
- progress
- changes
- short education

### 9.2 Credit Passport

The deeper analytical mode.

Focus:

- five pillar states
- helping/hurting factors
- unknown data
- profile details
- history and changes
- Application Readiness details
- reassessment dates
- future external-data provenance

Recommended mobile navigation:

```text
[ Quest ]   [ Passport ]   [ Profile ]
```

Offers should not occupy a primary navigation position. They are contextual and optional.

## 10. Decline Recovery

A user selecting “I’ve just been declined” enters a tailored recovery flow.

The app must say clearly that it cannot know the lender's exact underwriting decision unless evidence is available.

Outputs:

- likely blockers
- actions
- cooling-off periods
- reassessment dates
- progress milestones
- 90-day / 180-day plan
- eligibility recheck timing

Consumer V2 should store only enough partner context to support future extension points, for example:

```ts
interface DeclineContext {
  occurredAt?: string;
  productCategory?: string;
  lenderName?: string;
  lenderReasonCode?: string;
  userReportedReason?: string;
  referralSource?: string;
  partnerProgrammeId?: string;
}
```

No enterprise portal or lender-specific underwriting complexity is required in the consumer V2 releases.

## 11. Database evolution

Migrate the existing schema incrementally.

### 11.1 `profiles`

Add nullable/unknown-aware fields and onboarding context as required.

Potential additions include:

- onboarding_goal
- new_to_uk
- uk_residency_start
- recent_decline
- decline_context JSONB or linked table
- data_quality / provenance metadata later

Existing fields should be migrated carefully where their type must support unknown states.

### 11.2 `user_missions`

Extend lifecycle support with fields such as:

- state
- eligible_at
- first_shown_at
- last_shown_at
- started_at
- completed_at
- deferred_at
- dismissed_at
- review_started_at
- next_review_at
- cooldown_until
- completion_metadata

### 11.3 `profile_snapshots`

Store meaningful profile snapshots when customer state changes so Passport/readiness movement can later be shown over time.

Avoid unnecessary high-frequency duplication.

### 11.4 `diagnosis_snapshots`

Store primary/secondary barrier classifications and the structured factors used to derive them when a meaningful recalculation occurs.

### 11.5 `readiness_snapshots`

Store readiness state, reasons, and reassessment date on meaningful state changes.

### 11.6 `passport_snapshots`

Store five-pillar status snapshots so the product can explain improvement over time.

### 11.7 `events`

Expand analytics event vocabulary while preserving the rule that event ownership comes from the authenticated session, not a client-supplied user ID.

RLS remains mandatory across all user-owned tables.

## 12. Analytics

Engagement analytics and commercial analytics remain conceptually separate.

Core V2 events:

- onboarding_started
- onboarding_stage_completed
- onboarding_abandoned
- primary_barrier_identified
- passport_updated
- mission_shown
- mission_started
- mission_completed
- mission_deferred
- mission_dismissed
- readiness_changed
- safe_mode_activated
- eligibility_check_initiated
- offer_shown
- offer_clicked
- referral_outcome
- decline_recovery_started
- decline_recovery_milestone
- return_eligibility_reached

Important product KPIs:

- percentage receiving a meaningful first mission
- mission completion rate
- 30/60/90-day retention
- red → amber readiness progression
- amber → green readiness progression
- reduction in unnecessary applications
- decline-recovery improvement rate
- later referral conversion
- customer outcome measures

Do not optimise the product around application volume alone.

## 13. External data architecture

Open Banking and CRA integrations are future data sources, not new decision engines.

Required architecture:

```text
External provider
  ↓
adapter
  ↓
normalisation / provenance
  ↓
CreditProfile
  ↓
deterministic engines
```

Raw Open Banking or CRA data must not be sent directly into an unstructured AI model to generate credit recommendations.

Create interfaces that can later support:

- manual user input
- Open Banking provider
- CRA provider
- lender/partner decline data

V2.0a–V2.0d may use manual/demo implementations where integrations do not yet exist.

## 14. AI Credit Coach boundary

AI is intentionally deferred until deterministic V2 outputs are reliable.

Future AI inputs should be structured objects such as:

- BarrierDiagnosis
- SafetyAssessment
- CreditPassport
- ApplicationReadiness
- current mission
- previous state changes

AI may answer questions such as:

- Why am I being told to wait?
- Why does utilisation matter?
- Should I close this account?
- What changed this month?
- Explain my Credit Passport.

AI must not:

- guarantee approval
- invent lender criteria
- invent a decline reason
- override Safe Mode
- override age gates
- alter mission ranking
- rank products using commercial value

## 15. Error handling and safe degradation

All domain engines should return explicit unknown/insufficient-data states where possible rather than throw for normal customer uncertainty.

External service failure must degrade safely:

- no CRA data → continue with known profile and mark missing factors unknown
- no Open Banking data → continue with manual affordability data if present
- offer service failure → show no offers; never block core guidance
- analytics failure → never block the customer journey
- AI failure → deterministic guidance remains fully usable

## 16. Regulatory and compliance design

V2 must be designed with the UK regulatory perimeter as a real product constraint.

Before live credit-product referrals or eligibility integrations are launched, the business model needs appropriate review for matters including:

- FCA credit broking permissions and relevant AR/IAR considerations
- financial promotions
- Consumer Duty
- vulnerable-customer treatment
- affiliate disclosure
- fair value
- UK GDPR and data protection
- Open Banking permissions/provider model
- CRA data use

Product copy must not:

- guarantee score increases
- guarantee approval
- claim knowledge of lender underwriting criteria without evidence
- encourage repeated hard applications
- encourage new borrowing where meaningful financial distress is indicated
- present affiliate products as objective recommendations without disclosure

## 17. Testing strategy

### 17.1 Unit tests

Add focused tests for:

- unknown-state profile handling
- safety assessment
- Safe Mode offer suppression
- barrier diagnosis
- Credit Passport pillar calculations
- Application Readiness red/amber/green/unknown states
- reassessment-date calculations
- mission lifecycle transitions
- mission completion effects
- mission re-ranking after profile updates
- age-gate enforcement
- commercial data independence

### 17.2 Integration tests

Test flows including:

- onboarding → profile → diagnosis → passport → readiness → next mission
- mission start does not complete mission
- mission completion updates profile
- profile update removes completed mission eligibility
- next mission appears after recalculation
- Safe Mode suppresses offers
- unknown inputs do not become false/zero silently
- decline recovery generates appropriate plan structure

### 17.3 E2E tests

Maintain and expand Playwright journeys for:

- adult onboarding with no unsafe defaults
- 16–17 education mode
- Quest Feed navigation
- Passport navigation
- start/complete mission lifecycle
- “Can I Apply Yet?” red state and review date
- Safe Mode with no product referral
- adult green-readiness soft-eligibility CTA using demo data only
- decline-recovery route

### 17.4 RLS tests

Verify that a user cannot read or alter another user's:

- profile
- missions
- snapshots
- decline recovery state

Events remain write-only from the authenticated client/server path unless an explicit trusted analytics service is introduced later.

## 18. Accessibility and performance

The TikTok-inspired interaction must remain accessible.

Requirements:

- normal scroll fallback
- keyboard navigation
- screen-reader semantic headings and controls
- reduced-motion support
- sufficient contrast
- no information conveyed only by colour
- responsive mobile-first rendering
- finite feed and predictable navigation
- minimal JavaScript where CSS/native browser behaviour is sufficient

## 19. Success criteria by release

### V2.0a

- no substantive onboarding defaults
- unknown answers supported where defined
- mission start and completion are separate
- completion can update profile state
- mission ranking recalculates after completion
- Safe Mode suppresses borrowing-related offers
- analytics distinguishes start vs completion
- existing V1 safety boundaries remain intact

### V2.0b

- primary/secondary barrier diagnosis works deterministically
- all five Credit Passport pillars render
- Application Readiness returns explainable state
- time-based readiness rules return real reassessment dates
- Quest Score is secondary rather than dominant

### V2.0c

- approximately 25 strong missions exist
- waiting/no-action missions are supported
- Quest Feed is the default everyday experience
- vertical swipe/scroll-snap interaction works on mobile
- Credit Passport is the deeper analytical mode
- feed content is generated from deterministic outputs

### V2.0d

- decline-recovery onboarding route exists
- probable blockers are explained carefully
- 90/180-day recovery plan is generated
- partner extension fields exist without unnecessary enterprise complexity

## 20. Explicit non-goals for immediate V2

Do not build in the initial V2 releases:

- live lender underwriting
- approval guarantees
- fake approval probability
- direct hard-credit applications inside Credit Quest
- full CRA integration before a provider/permission model exists
- full Open Banking integration before a provider/permission model exists
- AI as a decision engine
- lender enterprise portal
- automated affiliate reconciliation
- advanced premium subscription stack
- addictive engagement mechanics

## 21. Final experience target

The target consumer experience is:

```text
Open Credit Quest

YOUR NEXT MOVE
Wait before applying again
You have three recent applications.
Review again in 42 days.

Swipe

WHY THIS MATTERS
Another application right now may make your profile harder for some lenders to assess.

Swipe

YOUR CREDIT PASSPORT
Identity                 Green
Payment Health           Green
Debt & Headroom          Amber
Affordability            Green
Application Readiness    Red

Swipe

GOOD NEWS
Your utilisation has fallen since your last review.
One previous blocker has improved.

Swipe

LEARN IN 20 SECONDS
Hard search vs soft search

Later, when appropriate:

YOU'RE READY TO CHECK
Your recent searches have aged and your profile has improved.
You can now check eligibility without a hard search where a suitable partner supports it.
```

This is the defining Credit Quest V2 experience: a modern TikTok-inspired credit-navigation feed backed by a serious, deterministic Credit Passport and readiness engine.