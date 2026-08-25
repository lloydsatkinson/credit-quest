# Credit Quest V1 Design

## Product goal

Credit Quest is a mobile-first UK credit-building and credit-optimisation product for users aged 16+.

The core product is a personalised credit coach underneath a gamified mission system. It should help users understand the next best action to improve their credit position without pretending to predict lender underwriting or bureau score movements.

V1 supports two primary journeys:

- 16–17: education mode only, with no credit-product referrals.
- 18+: personalised credit-building and optimisation guidance, with carefully separated affiliate/referral capabilities.

The product should feel useful first and game-like second: users should always understand what to do, why it matters, and what the likely impact is.

## V1 product principles

1. Action first: the home screen leads with a single highest-priority mission.
2. Dynamic, not rigid: users move through visible stages, but missions are ranked based on their profile.
3. Transparent scoring: Credit Quest Score is an internal progress score, never presented as a bureau score.
4. Responsible optimisation: guidance can be tactical, but must not encourage reckless application behaviour or debt misuse.
5. Commercial separation: affiliate economics never influence the mission-ranking engine.
6. Progressive onboarding: collect only the information needed to generate useful guidance quickly, then ask for more detail when it improves recommendations.
7. Integration-ready: manual data entry works in V1, while the data model remains ready for later Open Banking, CRA and AI integrations.

## User journey

### Onboarding

The onboarding flow should be progressive and short enough to reach value quickly.

Initial questions should cover high-value factors such as:

- age band
- employment status
- income band
- housing status
- electoral roll status
- existing credit products
- balances and limits where known
- utilisation estimate
- missed-payment history
- recent credit applications
- consent and disclosure flags

Users can add more detail later.

### Post-onboarding landing experience

The first screen after onboarding should show one clear primary card:

**Your next best move**

It should include:

- mission title
- what to do
- why it matters
- impact label: High / Medium / Low
- estimated Credit Quest Score movement
- expected timing or review period where relevant
- clear action button or external link

Under the primary mission, a compact progress strip should show:

- Credit Quest Score
- current journey stage
- missions completed
- next review date

### Journey stages

The visible journey is:

**Setup → Stabilise → Build → Optimise → Maintain**

The stage gives users a sense of progression, but the mission engine decides which eligible action should be shown next.

Example missions include:

- register on the electoral roll
- reduce revolving-credit utilisation
- correct address inconsistencies
- set up a direct debit
- avoid a further hard application during a cooldown period
- review existing balances
- preserve account history
- consider an appropriate credit-builder product where suitable

Every mission should clearly state whether it is primarily:

- a likely positive action
- a risk-reduction action
- educational guidance
- an action with an optional commercial referral

## Technical architecture

V1 will use:

- Next.js for the application and mobile-first UI
- PWA support for installable app behaviour
- Supabase Auth for account management
- Supabase Postgres for persisted user, mission and event data
- Supabase Row Level Security for per-user data isolation
- a standalone mission and scoring domain layer
- a separate offers/referral domain layer

The architecture should keep business logic independent of the UI so that a later native app can reuse the same backend and decision engine.

### High-level data flow

1. User signs up and completes age gate.
2. Progressive onboarding creates a profile.
3. The mission engine evaluates profile facts.
4. Eligible missions are scored and ranked.
5. The highest-priority mission is returned to the dashboard.
6. The offers layer may attach a relevant offer only after the mission has already been selected.
7. User starts, completes or updates the mission.
8. Profile and mission state are updated.
9. Credit Quest Score and mission ranking are recalculated.
10. The next best mission is shown.

Future integrations should fit this pattern:

- Open Banking → normalised account/profile data → mission engine
- CRA data → normalised credit profile → mission engine
- AI coach → explanations and conversational assistance around structured recommendations, not unrestricted decision-making

## Domain model

### User profile

The profile should support:

- age band and date-of-birth handling sufficient for age gating
- employment status
- income band
- housing status
- electoral roll status
- current credit products
- revolving balances and limits
- utilisation
- missed-payment history
- application history
- consent flags
- onboarding completeness
- data provenance for future manual/Open Banking/CRA sources

V1 should avoid storing unnecessary identity or financial data.

### Mission definition

Each mission should contain:

- id and slug
- title
- description
- user-facing rationale
- stage
- eligibility rules
- exclusion rules
- priority weight
- impact label
- estimated Quest Score movement
- cooldown or review timing
- completion conditions
- optional referral category
- enabled/disabled state

### User mission state

For each user/mission pair, track:

- eligible/not eligible
- current priority
- not started / started / completed / dismissed / deferred
- first shown timestamp
- last shown timestamp
- completion timestamp
- next review timestamp
- supporting user-entered evidence where needed

## Mission engine

The mission engine is the core decision layer.

It should:

1. evaluate mission eligibility from profile facts
2. exclude missions that are inappropriate, completed, in cooldown or age-restricted
3. calculate a priority score using transparent rule-based weights
4. select the highest-priority mission
5. return explainable reasons for selection

Mission ranking must not use affiliate payout, provider commission or commercial conversion rate.

The first implementation should be deterministic and rules-based. That makes behaviour testable, explainable and safe. AI can later improve explanation or coaching around the result without replacing the core eligibility/ranking rules.

## Credit Quest Score

Credit Quest Score is an internal progress indicator, not a bureau score and not a prediction of lender approval.

The score should:

- use explainable profile and behavioural factors
- move in bounded increments
- make every increase or decrease attributable to a clear factor
- reward useful behaviour and reduction of avoidable risk
- avoid implying guaranteed bureau-score movement

V1 should display both:

- a simple impact label: High / Medium / Low
- an estimated Quest Score movement for a mission

All user-facing score language must clearly state that this is a Credit Quest estimate.

## Affiliate and referral architecture

Credit Quest should support both:

1. mission-linked referrals, shown only when directly relevant to the selected mission
2. a separate offers marketplace for users who want to browse relevant products

The commercial layer is downstream of the mission engine.

A core rule of the system is:

**User benefit determines the mission; commercial value never changes mission ranking.**

### Offer model

Offers should support:

- provider
- product name/category
- affiliate URL
- campaign/source parameters
- disclosure copy
- broad eligibility notes
- age restriction
- active/inactive status
- valid-from and valid-to dates
- optional commission metadata for internal analytics

### Matching level in V1

V1 uses light matching only.

Credit Quest may use user profile information to identify broad suitable product categories, such as a credit-builder card, but it must not claim a user is likely to be approved unless a proper eligibility data source is integrated later.

Credit Quest acts as an enhanced introducer:

- it may collect enough user information to improve relevance
- it may pass supported referral/pre-fill parameters where a provider allows this
- lenders own eligibility, underwriting and the application journey

All affiliate links must be clearly disclosed.

## Age gating

- Users aged 16–17 can use education mode.
- Credit-product referrals are suppressed for users under 18.
- Users aged 18+ can receive relevant commercial referrals where otherwise appropriate.

Age restrictions should be enforced in the domain layer, not only hidden in the UI.

## Security and privacy

V1 should include:

- Supabase Auth
- Row Level Security on user-owned data
- server-side handling of secrets
- least-privilege data access
- explicit consent flags
- auditable consent timestamps where relevant
- minimal sensitive-data collection
- no storage of provider credentials
- separation of user data from public mission/offer catalogue data

The design should remain ready for future stronger identity verification without pretending that V1 performs regulated identity checks.

## Product and compliance boundaries

V1 must clearly distinguish between:

- education
- personalised guidance
- commercial referral

The app must not:

- present Credit Quest Score as an Experian, Equifax or TransUnion score
- promise a bureau-score increase
- promise lender approval
- imply that Credit Quest performs lender underwriting
- allow affiliate economics to determine recommendations
- show credit-product referrals to under-18 users

User-facing referral areas should clearly disclose the commercial relationship.

## Failure handling

The application should fail safely.

- If offer data is unavailable, the underlying mission still works.
- If a referral link is inactive, the mission remains visible without the offer.
- If scoring cannot complete, the user sees a safe fallback rather than a broken dashboard.
- Future external-data integrations must not block access to the user’s existing plan if they are temporarily unavailable.

## Event and analytics model

Track at minimum:

- onboarding started
- onboarding completed
- mission shown
- mission started
- mission completed
- mission deferred/dismissed
- offer shown
- offer clicked
- referral outcome where provider/network data is available

Analytics should make it possible to measure mission engagement and commercial conversion separately.

## Free vs premium model

V1 uses a free-core / paid-intelligence model.

Free users should receive genuine value including:

- onboarding
- Credit Quest Score
- journey stage
- next-best mission
- core mission explanations
- progress tracking

Premium is reserved for deeper intelligence such as:

- richer scenario testing
- personalised alerts
- deeper optimisation guidance
- progress forecasting
- advanced tracking
- future AI coach capabilities

No essential safety or credit-building guidance should be withheld purely to force an upgrade.

## Testing strategy

V1 should include:

### Unit tests

- mission eligibility rules
- age gating
- cooldown handling
- mission ranking
- Quest Score changes
- offer attachment rules
- proof that affiliate commission cannot affect mission ranking

### Integration tests

- onboarding → profile → mission selection
- mission completion → score recalculation → next mission
- 16–17 education-mode restrictions
- 18+ referral eligibility
- auth-protected user data flows

### Security tests

- Row Level Security prevents cross-user reads/writes
- secrets are never exposed to the client

### End-to-end smoke test

A new user should be able to:

1. sign up
2. complete onboarding
3. receive a next-best mission
4. understand why it was selected
5. start or complete it
6. see progress update
7. access an appropriate referral only when age and mission rules permit

## Out of scope for V1

The following are intentionally deferred:

- live CRA data
- live Open Banking connections
- lender-side underwriting
- in-app credit applications
- approval-probability claims
- AI-driven core credit decisions
- native iOS/Android codebase
- advanced KYC/identity verification
- automated affiliate-network reconciliation

The architecture should leave clean extension points for these features later.

## Success criteria for V1

V1 is successful when:

1. a user can complete onboarding quickly and receive a useful first mission
2. the next mission changes logically as profile facts or mission state change
3. all score and mission decisions are explainable
4. under-18 restrictions are enforced reliably
5. affiliate links can be configured and tracked without influencing mission ranking
6. the product works well on mobile and can be installed as a PWA
7. user data is isolated securely
8. the codebase is structured so Open Banking, CRA and AI integrations can be added without redesigning the core product
