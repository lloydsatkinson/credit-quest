# Credit Quest — Mission Action Layer Phase 1 Design

Date: 2026-08-26
Status: Approved design, implementation not yet started
Repository: `lloydsatkinson/credit-quest`

## 1. Purpose

Credit Quest currently tells the customer what to do next. This phase makes those recommendations executable.

The Mission Action Layer connects a recommended mission to the safest useful next step: an internal Credit Quest flow, a verified provider or government destination, a controlled referral journey, or later a real API/integration adapter.

The target experience is:

```text
Mission selected
  ↓
Identify relevant customer/account context
  ↓
Resolve best available action
  ↓
Show Credit Quest Action Screen
  ↓
Start internal or external action
  ↓
Record action attempt
  ↓
Verify where possible / self-confirm otherwise
  ↓
Update mission state and underlying customer data
  ↓
Recalculate next-best mission
```

The central product rule is that **clicking a button is never the same as completing a mission**.

This work is intentionally inserted after V2.0a Product Integrity and before the previously planned V2.0b Intelligence Foundation. It does not replace the existing V2 roadmap; it adds the execution layer needed to make current missions genuinely useful before richer intelligence work begins.

## 2. Approved design decisions

The following decisions were explicitly agreed before this specification was written.

1. **Hybrid action model.** Use a genuine in-app/API integration where a supported API exists. Otherwise use an exact official/provider destination with return/resume tracking.
2. **Verification model.** Verify completion where possible; otherwise allow self-confirmation, with later review where appropriate.
3. **Provider detection.** Start with manual provider/account selection and allow Open Banking to populate the same model later.
4. **Provider coverage.** Support major UK providers first, with a generic safe fallback for unsupported providers.
5. **Configuration model.** Use a Supabase-backed Action Registry instead of hard-coded destination URLs.
6. **Multiple accounts.** Support multiple customer cards/accounts from Phase 1.
7. **Minimal account model.** Store only the fields needed to execute missions now; add richer fields only when a mission requires them.
8. **Customer Journey Workflow Visualisation.** Track this as a separate follow-up item. It must not block this build.

## 3. Non-goals

Phase 1 does not attempt to become a full personal-finance manager or banking platform.

Out of scope for this phase:

- storing banking passwords or provider credentials
- payment initiation
- scraping provider sites
- form-filling government or lender applications on behalf of the customer without an approved integration
- lender underwriting or approval probability
- CRA data ingestion
- Open Banking connectivity
- provider API callbacks unless a real supported integration is already available
- a full admin CMS
- a full customer-journey analytics visualiser

The design must be ready for these capabilities later without requiring a rewrite.

## 4. Existing foundations to preserve

The Action Layer extends the current architecture rather than replacing it.

Preserve:

- Next.js App Router and TypeScript
- Supabase authentication, Postgres and RLS
- `profiles` as the profile-level customer state
- `user_missions` as the persisted mission lifecycle
- `events` for analytics
- deterministic mission ranking
- Safe Mode and age restrictions
- separation between mission advice and commercial offer economics
- current mission states including `started`, `completed`, `in_review`, `cooldown`, and `no_longer_eligible`

The current five mission definitions remain the initial Action Layer catalogue:

- `register-electoral-roll`
- `reduce-utilisation`
- `set-up-direct-debit`
- `application-cooldown`
- `build-revolving-history`

## 5. Architecture

Use a middle-ground architecture: **Action Registry + small integration adapters**.

A static registry alone would be too weak once callbacks and APIs arrive. A general workflow engine would be unnecessary complexity for the current product. The chosen design keeps configuration in Supabase while reserving code adapters for behaviours that genuinely require logic.

Conceptual boundaries:

```text
Mission Engine
  ↓
Mission Instance / Target
  ↓
Action Resolver
  ├── Action Registry
  ├── Provider Registry
  └── Integration Adapter (optional)
  ↓
Action Screen
  ↓
Action Attempt
  ↓
Verification / Confirmation
  ↓
Mission State + Customer State
```

### 5.1 Mission definitions describe *what*

Mission definitions must not contain provider destination URLs.

A mission describes the intended customer outcome, eligibility, priority, impact and completion semantics.

### 5.2 Action Registry describes *how*

The Action Registry describes how a customer can execute a mission for a given provider/account context.

This separation allows a provider web link to be replaced by a real API later without changing the mission definition.

### 5.3 Adapters handle behaviour

Adapters are only required when a flow needs logic beyond a configured destination, for example:

- a future Open Banking connector
- a partner callback
- an API verification call
- a signed referral handoff
- an internal Credit Quest workflow

## 6. Account-aware mission instances

The approved multiple-account requirement creates one important change to the existing mission model.

Some missions are profile-scoped:

- electoral roll
- application cooldown
- building first revolving history

Other missions are naturally account-scoped:

- set up direct debit
- reduce utilisation

The current `user_missions` key of `(user_id, mission_slug)` cannot correctly represent two separate direct-debit missions for two different cards. Phase 1 must therefore introduce a target-aware mission instance model rather than pretending one global mission row covers every account.

Recommended shape:

```ts
type MissionSubject =
  | { kind: "profile" }
  | { kind: "account"; accountId: string };

interface MissionInstance {
  id: string;
  userId: string;
  missionSlug: string;
  subject: MissionSubject;
  state: MissionState;
  startedAt: string | null;
  completedAt: string | null;
  nextReviewAt: string | null;
}
```

Existing rows migrate as profile-scoped instances. Account-scoped missions use the relevant `user_accounts.id` as their subject.

This preserves deterministic mission logic while allowing the same mission type to exist once per relevant account.

## 7. Data model

Create one migration for the Action Layer, expected to be named conceptually like `003_action_layer.sql`.

### 7.1 `providers`

Purpose: trusted provider/government directory and domain allowlist.

Core fields:

- `id uuid primary key`
- `slug text unique not null`
- `display_name text not null`
- `provider_type text not null`
  - `government`
  - `bank`
  - `card_issuer`
  - `partner`
  - `generic`
- `allowed_hosts text[] not null`
- `active boolean not null default true`
- `created_at timestamptz`
- `updated_at timestamptz`

No customer credentials belong here.

### 7.2 `user_accounts`

Purpose: minimal manual account model that can later be populated from Open Banking.

Core fields:

- `id uuid primary key`
- `user_id uuid not null`
- `provider_id uuid null`
- `account_type text not null`
  - `credit_card`
  - `current_account`
  - `loan`
  - `other`
- `nickname text null`
- `last_four text null`
- `balance_minor bigint null`
- `credit_limit_minor bigint null`
- `currency text not null default 'GBP'`
- `direct_debit_status text not null default 'unknown'`
  - `yes`
  - `no`
  - `unknown`
- `source text not null default 'manual'`
  - `manual`
  - future `open_banking`
- `active boolean not null default true`
- `last_verified_at timestamptz null`
- `created_at timestamptz`
- `updated_at timestamptz`

Money is stored in minor units rather than floating-point values.

The app must never require a full card number. Last four digits are optional display context only.

### 7.3 `action_registry`

Purpose: configurable catalogue mapping mission context to an executable action.

Core fields:

- `id uuid primary key`
- `action_key text unique not null`
- `mission_slug text not null`
- `provider_id uuid null`
- `account_type text null`
- `action_mode text not null`
  - `external_link`
  - `internal_flow`
  - `referral`
  - future `api`
- `destination_url text null`
- `instructions text not null`
- `verification_mode text not null`
  - `internal_state`
  - `self_confirm`
  - `self_confirm_review`
  - future `api_verified`
  - future `partner_callback`
- `safe_mode_allowed boolean not null`
- `min_age int null`
- `priority int not null default 100`
- `active boolean not null default true`
- `created_at timestamptz`
- `updated_at timestamptz`

A provider-specific action has `provider_id` populated. A generic fallback leaves it null.

### 7.4 `action_attempts`

Purpose: auditable record of what the customer actually started and what happened afterwards.

Core fields:

- `id uuid primary key`
- `user_id uuid not null`
- `mission_instance_id uuid not null`
- `action_registry_id uuid not null`
- `account_id uuid null`
- `status text not null`
  - `started`
  - `returned`
  - `submitted`
  - `self_confirmed`
  - `verified`
  - `cancelled`
  - `failed`
- `started_at timestamptz not null`
- `returned_at timestamptz null`
- `self_confirmed_at timestamptz null`
- `verified_at timestamptz null`
- `next_review_at timestamptz null`
- `external_reference text null`
- `error_code text null`
- `metadata jsonb not null default '{}'`

`metadata` must remain deliberately small and non-sensitive. Do not persist raw provider query strings, authentication tokens, form data, National Insurance numbers, bank credentials or card details.

### 7.5 `user_missions` evolution

Add a stable mission-instance identifier and subject support while preserving existing rows.

Conceptually:

- add `id uuid`
- add `subject_type` with `profile` / `account`
- add nullable `subject_id` for account-scoped missions
- preserve profile-level uniqueness per user + mission slug
- allow account-level uniqueness per user + mission slug + account

Migration must preserve all existing progress.

## 8. Account data and profile summaries

The account model becomes the more precise source for account-specific actions, but existing profile fields remain useful for compatibility and onboarding.

Rules:

1. If no account data exists, existing profile-level values continue to drive current missions.
2. Once relevant accounts are added, account-scoped missions use those records.
3. `reduce-utilisation` should evaluate each known revolving account when balance and limit are available.
4. `set-up-direct-debit` should evaluate each known revolving account separately.
5. Profile summary fields may be recalculated from known accounts where the meaning is unambiguous.
6. Missing account data must remain unknown rather than being treated as zero or safe.

For direct debit, the profile summary should not imply full payment protection if a known active revolving account remains unprotected.

For utilisation, an individual card target may be calculated from that card's balance and limit. Aggregate utilisation should only be recalculated when sufficient relevant data is present.

## 9. Action Resolver

The Action Resolver is deterministic and server-authoritative.

Inputs:

- authenticated user
- mission instance
- target account when applicable
- current profile
- age mode
- Safe Mode result

Output:

```ts
interface ResolvedAction {
  actionId: string;
  mode: "external_link" | "internal_flow" | "referral" | "api";
  providerName: string | null;
  destinationUrl: string | null;
  instructions: string;
  verificationMode:
    | "internal_state"
    | "self_confirm"
    | "self_confirm_review"
    | "api_verified"
    | "partner_callback";
  fallbackUsed: boolean;
}
```

Resolution order:

1. exact mission + provider + account type
2. mission + provider generic action
3. mission + account-type generic fallback
4. mission-wide generic fallback
5. safe internal/manual guidance if no configured external destination exists

A missing provider integration must never produce a dead end.

Commercial payout is not an input to the resolver.

## 10. Action start security

The browser must not supply an arbitrary external URL.

Recommended server flow:

```text
Action Screen
  ↓
POST /api/actions/start
  ↓
Server checks auth + mission ownership + account ownership
  ↓
Server reruns resolver
  ↓
Server checks action active + age + Safe Mode
  ↓
Server validates destination host against provider allowlist
  ↓
Create action_attempt
  ↓
Return attempt id + approved destination
```

The server must reject:

- URLs supplied directly by the client
- unapproved hosts
- inactive actions/providers
- accounts owned by another user
- stale or ineligible mission instances
- borrowing/referral actions blocked by Safe Mode
- adult-only product actions for education-mode users

## 11. Action Screen UX

Every actionable mission should pass through a reusable Credit Quest Action Screen before leaving the app or beginning an internal flow.

Show:

- mission title
- what the customer is about to do
- why it matters
- target provider/account where relevant
- what Credit Quest can and cannot verify
- any timing/review expectation
- primary Continue button
- safe cancel/back option

For external actions, wording must make clear that the destination is operated by the provider/government body, not Credit Quest.

## 12. Return and resume behaviour

Most Phase 1 external sites will not redirect back to Credit Quest. The product therefore cannot rely on a callback.

The durable behaviour is:

1. create `action_attempt` before leaving Credit Quest
2. leave the attempt in `started`
3. when the user next returns to Credit Quest, detect the most relevant pending attempt
4. show a resume card/prompt
5. ask whether the action was completed or submitted
6. apply verification/self-confirmation rules

Example:

> Welcome back — were you able to set up the direct debit on your Barclaycard?

Possible responses:

- Yes, completed
- I started but did not finish
- I could not do it
- Do this later

Returning to Credit Quest is not itself proof of completion.

## 13. Mission-by-mission Phase 1 behaviour

### 13.1 Electoral roll

Current official route: `https://www.gov.uk/register-to-vote`.

GOV.UK currently states that customers can register from age 16 in England and Northern Ireland, and from age 14 in Scotland and Wales. Credit Quest itself supports users from age 16, so the action can be available in education mode where appropriate. Credit Quest must not independently claim that nationality/residency requirements are satisfied; the official service remains authoritative for eligibility.

Flow:

```text
Mission: Get on the electoral roll
  ↓
Action Screen
  ↓
Open GOV.UK register-to-vote journey
  ↓
User later returns
  ↓
Ask whether they submitted registration
  ↓
If submitted: mission = in_review
  ↓
Later ask whether registration has taken effect
  ↓
On confirmed/verified registration:
  electoralRoll = true
  mission = completed
```

Submitting the application must **not** immediately set `electoralRoll=true`.

### 13.2 Set up direct debit

This becomes account-scoped when known credit accounts exist.

Flow:

```text
Identify revolving account without confirmed DD
  ↓
Resolve exact issuer action if available
  ↓
Fallback to issuer sign-in/support guidance
  ↓
User completes provider journey
  ↓
Self-confirm in Phase 1
  ↓
account.direct_debit_status = yes
  ↓
recalculate remaining unprotected accounts
```

There is no assumption that a customer's current-account bank controls the card direct debit; routing should be based on the relevant credit issuer/provider.

### 13.3 Reduce utilisation

This becomes account-scoped when balance and credit limit are known.

If current balance and limit are known, Credit Quest may calculate a useful target amount such as the payment needed to move below a configured utilisation threshold.

Example calculation:

```text
target_balance = credit_limit × threshold
amount_to_reduce = max(0, current_balance - target_balance)
```

The UI must present this as a Credit Quest planning target, not a guaranteed bureau/lender score outcome.

Clicking a payment/account-management destination never completes the mission. Completion requires updated balance/limit information showing the relevant target has been reached, or an explicit profile update where account-level data is unavailable.

### 13.4 Application cooldown

This is primarily an internal Credit Quest action.

Flow:

```text
Start cooldown
  ↓
mission = cooldown
  ↓
set next_review_at
  ↓
show countdown/review date
  ↓
reassess at review date
```

If the exact last-application date is unknown, the UI may ask for it before calculating a more precise review point.

Any default review interval is a Credit Quest planning interval, not a claim that a hard search disappears or that all lenders treat the customer differently after that date.

### 13.5 Build revolving history

This remains adult-only and is blocked in Safe Mode.

Flow:

```text
Education first
  ↓
Product-fit / Offers route
  ↓
Optional lender/referral handoff
  ↓
Lender owns eligibility + underwriting + application
  ↓
Click/application does not complete mission
  ↓
Account-open confirmation or later verified data
  ↓
hasRevolvingCredit = true
  ↓
mission = completed
```

Affiliate economics must remain separate from mission ranking and action priority.

## 14. Provider coverage

Phase 1 should prioritise major UK credit-card issuers/providers and add a generic fallback.

Initial candidate coverage should include major groups such as:

- Barclaycard / Barclays
- Capital One
- Lloyds / Halifax / MBNA
- NatWest / Royal Bank of Scotland
- HSBC
- Santander
- American Express
- Nationwide
- Vanquis
- major NewDay-serviced card brands where a stable official customer journey can be verified

This is a candidate coverage set, not a permanent hard-coded list. Every production destination must be re-verified against the provider's current official site during implementation.

If a provider has no stable mission-specific destination, use a provider sign-in/support destination or the generic manual fallback rather than inventing a deep link.

## 15. Age, safety and regulatory product boundaries

The Action Layer inherits all V2 product-integrity rules.

Rules:

- 16–17 education users receive no borrowing/product referrals.
- Government/administrative actions may remain available where appropriate and lawful.
- Safe Mode suppresses new-borrowing actions and referrals.
- Credit Quest does not promise score improvement, approval or lender acceptance.
- The lender/provider owns underwriting and application decisions.
- Credit Quest does not store provider credentials.
- Advice, mission ranking and action priority must not be driven by affiliate economics.
- Product/referral flows must carry appropriate introducer/affiliate disclosure.

## 16. Error handling

The Action Layer should degrade safely.

### Provider link unavailable

Show generic official/provider guidance and record a configuration gap. Do not show a broken CTA.

### Provider URL no longer allowlisted

Block outbound navigation server-side and show a neutral fallback message.

### Action configuration missing

Show the mission with manual instructions and log a non-sensitive operational event.

### Account data incomplete

Ask only for the missing field required for that action. Do not force the customer to complete a large financial profile.

### User abandons external flow

Keep the attempt `started`; allow resume or cancellation. Do not complete the mission.

### Verification unavailable

Use the configured self-confirmation mode. Where the real-world outcome is delayed, move the mission to `in_review` and set a review date.

### Duplicate start clicks

Reuse or close the latest active attempt rather than creating uncontrolled duplicates.

## 17. Analytics

Add lifecycle events that describe execution rather than pretending completion.

Recommended events:

- `action_screen_viewed`
- `action_started`
- `action_returned`
- `action_submitted`
- `action_self_confirmed`
- `action_verified`
- `action_failed`
- `action_cancelled`
- `action_fallback_used`
- `account_added`
- `account_updated`

Metadata may include mission slug, provider slug, account type, verification mode and fallback status.

Do not include sensitive financial values, credentials or provider tokens in analytics.

## 18. RLS and privacy

RLS requirements:

- users can select/insert/update only their own `user_accounts`
- users can select only their own `action_attempts`
- action-attempt creation/update should preferably occur through server-authoritative application logic
- `providers` and active `action_registry` records may be readable as configuration if needed, but browser clients must not be trusted to approve destinations
- no anonymous write access to customer/action data

The server remains authoritative for outbound URL approval and completion effects.

## 19. Implementation surfaces

Expected implementation areas include:

```text
app/
  accounts/
  actions/[...]/
  api/actions/start/
  api/actions/confirm/
  api/accounts/

components/
  accounts/
  actions/

lib/
  domain/actions/
  domain/accounts/
  data/action-fallbacks.ts   # only non-URL fallback text if useful
  supabase/

supabase/
  migrations/003_action_layer.sql
```

Exact file names may follow existing repository patterns during implementation. The important boundary is conceptual separation between account data, action resolution, action execution and mission state.

## 20. Testing strategy

Use TDD and preserve all current passing tests.

### Domain/unit tests

Cover:

- exact provider resolution
- provider fallback resolution
- generic fallback resolution
- inactive action rejection
- Safe Mode suppression
- education-mode product suppression
- multiple account mission targeting
- utilisation target calculations
- no completion on click/start
- correct mission transition after self-confirmation/verification

### Database/RLS tests

Cover:

- one user cannot read/update another user's accounts
- one user cannot read/update another user's attempts
- mission instance migration preserves existing rows
- account-scoped uniqueness works
- invalid enum/state values are rejected

### API tests

Cover:

- arbitrary destination URLs rejected
- unapproved host rejected
- stale/ineligible mission rejected
- wrong-user account rejected
- action attempt created before destination is returned
- duplicate active starts handled safely

### End-to-end tests

Minimum journeys:

1. electoral roll → external start → return → submitted → in review
2. direct debit → choose account/provider → self-confirm → account updated
3. utilisation → calculated target → action start → updated balance → completion
4. application cooldown → start → review date/cooldown state
5. revolving history → adult/safe user → offers route → no false completion on click
6. education-mode user cannot enter borrowing/referral action
7. unsupported provider receives generic fallback rather than error

## 21. Acceptance criteria

Phase 1 is complete when all of the following are true:

1. Every one of the five current missions has a real executable action path.
2. External clicks never auto-complete missions.
3. Major provider-specific actions can be configured in Supabase without code changes.
4. Unsupported providers still have a safe generic path.
5. A user can maintain multiple accounts/cards.
6. Direct-debit and utilisation missions can target a specific account.
7. Pending external actions survive leaving and returning to the app.
8. Electoral-roll submission moves to review rather than falsely setting registration to true.
9. Product/referral actions remain age- and Safe-Mode-gated.
10. Outbound destinations are server-resolved and domain-allowlisted.
11. Existing V2.0a mission/profile integrity remains intact.
12. Unit, API, RLS and E2E tests pass.
13. Existing application tests continue to pass.

## 22. Rollout approach

Recommended implementation sequence:

1. schema + mission-instance migration
2. domain account types and account CRUD
3. provider/action registry and seed data
4. resolver + security validation
5. reusable Action Screen
6. action-attempt start/resume/confirm lifecycle
7. electoral-roll mission
8. direct-debit mission
9. utilisation mission
10. cooldown mission
11. revolving-history/referral integration
12. analytics
13. end-to-end verification and regression testing

Provider seed data should begin conservatively. A generic fallback must exist before provider-specific links are enabled.

## 23. Future extension points

The architecture is intentionally ready for:

- Open Banking account discovery and balance refresh
- CRA profile verification
- soft-search eligibility APIs
- provider callbacks
- lender programme integrations
- verified account-open outcomes
- payment/reminder integrations where appropriate
- richer provider/account attributes
- an internal admin interface for providers/actions

Future integrations become adapters behind the same resolver contract rather than new mission-specific architectures.

## 24. Separate backlog item — Customer Journey Workflow Visualisation

Create a separate product/operations visualisation after the Action Layer build is stable.

Purpose: allow the product owner to see the complete customer journey and decision tree rather than reconstructing it from code.

The visual should eventually show:

```text
Sign-up
  ↓
Onboarding
  ↓
Profile / Safety
  ↓
Mission selection
  ↓
Action Screen
  ↓
Internal / external / referral branch
  ↓
Return / verification / self-confirmation
  ↓
Completed / in review / cooldown / abandoned
  ↓
Profile update
  ↓
Next-best mission
```

It should also support visibility of branches, drop-off points, provider handoffs and later analytics volumes.

This item is explicitly **not part of Phase 1 implementation scope** and must not delay the Action Layer.

## 25. Summary

Credit Quest's Action Layer turns recommendations into controlled, trackable customer actions without overclaiming integration capability.

The chosen design is:

**deterministic mission → target-aware mission instance → Supabase Action Registry → server-side resolver → reusable Action Screen → action attempt → verification where possible / self-confirmation otherwise → underlying customer-state update → next mission.**

This provides immediate value with official/provider links today while giving Credit Quest a stable integration boundary for Open Banking, CRA and partner APIs later.
