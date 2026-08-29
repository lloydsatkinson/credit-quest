# Credit Quest V2.2 — Journey & Growth Design

Date: 2026-08-29  
Status: Approved design, pre-implementation  
Branch: `feat/v2-2-journey-growth`

## 1. Purpose

V2.2 turns the V2.1 customer guidance experience into a measurable lifecycle and commercial-readiness platform without changing the core Credit Quest proposition or allowing revenue incentives to affect customer strategy.

The release combines two coordinated tracks:

1. **Journey & Outcomes** — understand where each user is in the journey, record meaningful outcomes, schedule reassessment, bring users back at the right time, and measure whether Credit Quest is improving their position.
2. **Commercial Readiness** — build the partner, consent, disclosure, attribution, referral, experiment and revenue plumbing needed for future monetisation while keeping live regulated credit referrals disabled until the operating model is formally cleared.

V2.2 is successful when Credit Quest can answer three questions with evidence:

- Did the customer take the recommended action?
- Did their position or readiness improve afterwards?
- If and only if the customer is appropriately ready, can Credit Quest route them through a compliant, auditable commercial journey without commercial economics changing the advice that got them there?

## 2. Non-negotiable product principles

The existing one-way strategy boundary remains intact:

```text
profile + account evidence
  ↓
safety assessment
  ↓
barrier diagnosis + Credit Passport + Application Readiness
  ↓
Credit Quest Score + deterministic mission eligibility/ranking
  ↓
target-aware next-best mission
  ↓
Academy / action execution
  ↓
Journey & Outcomes observation
  ↓
reassessment / retention
  ↓
Commercial Gateway only when independently permitted
```

The following rules are hard requirements:

- Customer benefit and safety remain upstream of all monetisation.
- Affiliate commission, CPA/CPL, EPC, partner payout, campaign economics and sponsored placement must never influence barrier diagnosis, readiness, mission ranking, safety, Quest Score or Academy selection.
- WAIT / do-not-apply is a valid and often desirable outcome.
- Users aged 16–17 remain education-only and cannot receive credit-product referrals or borrowing encouragement.
- Safe Mode users remain offer-suppressed.
- Quest Score remains an internal progress indicator and never maps to lender approval likelihood.
- Credit Quest must never invent lender criteria or approval odds.
- Unknown evidence remains unknown.
- AI may explain, simplify and tune tone; AI may not decide safety, readiness, suitability, referral eligibility, contact timing or product ranking.
- Live regulated credit referrals remain globally disabled until the FCA operating model is explicitly resolved and documented.

## 3. Scope

### In scope

- Canonical customer journey state.
- Append-only journey outcome history.
- Explicit reassessment scheduling and readiness-change feedback.
- Deterministic in-app and email retention triggers.
- AI-assisted wording for approved reminder content, with deterministic trigger/reason preserved.
- Commercial partner and route configuration.
- Versioned disclosure records and explicit referral consent.
- Auditable referral attribution and downstream revenue events.
- Server-side commercial and messaging kill switches.
- Sandbox referral journeys.
- Lightweight Credit Quest Admin for partners, routes, disclosures, feature flags, experiments and rollout state.
- Journey, retention and commercial analytics.
- Presentation-only experiment framework.
- Architecture, RLS, unit and E2E tests enforcing the boundaries above.

### Explicitly out of scope

- Enabling live regulated credit referrals.
- Lender underwriting or approval prediction.
- CRA ingestion, Open Banking ingestion, payment initiation or lender eligibility APIs unless separately designed and approved.
- Push notifications and SMS.
- A full CRM or enterprise back-office suite.
- AI-controlled targeting, readiness decisions or contact cadence.
- Commercially driven mission, readiness or Academy ranking.
- Changes to the existing `hasRevolvingCredit === null` readiness edge case unless separately specified.

## 4. Architecture

V2.2 adds four isolated downstream capabilities around the existing core.

### 4.1 Journey State & Outcomes

A **Journey Orchestrator** observes deterministic outputs and meaningful user/action events. It does not replace the mission engine or readiness engine.

Responsibilities:

- maintain the user's current lifecycle state;
- append meaningful journey outcomes;
- schedule deterministic reassessment points;
- trigger a fresh run of existing readiness/mission logic from current evidence when reassessment is due;
- record before/after readiness snapshots for explainable customer feedback;
- generate eligible retention events.

It must not accept commercial economics as inputs.

### 4.2 Retention & Email

A **Reminder Service** turns approved deterministic events into in-app reminders and email jobs.

Trigger examples:

- active mission remains incomplete after an approved interval;
- application cooldown is ending;
- a scheduled reassessment date has arrived;
- a pending action needs follow-up;
- readiness materially changed after reassessment.

The trigger, timing, user eligibility and reason are deterministic. AI may optionally rewrite an approved base message for tone and clarity, but the generated copy must remain constrained to the approved facts and call-to-action. If AI is unavailable or rejected by validation, the approved deterministic template is sent instead.

An independent server-side email kill switch can suppress all outbound email without affecting the core product.

### 4.3 Commercial Gateway

A **Commercial Gateway** is the only supported server-side path to create a referral attempt.

It receives an already-computed customer context and applies hard gates in this order:

1. global commercial kill switch enabled;
2. live/sandbox mode permitted for the current environment;
3. user is 18+;
4. Safe Mode is not active;
5. readiness state permits an eligibility-first commercial action;
6. required evidence is present rather than guessed;
7. partner is enabled;
8. route is enabled and permitted for the user context;
9. current disclosure version is available;
10. explicit consent exists for that referral attempt.

If any gate fails, no referral is created. The core journey continues normally.

Live credit routes remain disabled in production until the regulatory checkpoint is cleared. Sandbox routes may be exercised for end-to-end testing.

### 4.4 Credit Quest Admin

V2.2 includes a deliberately small internal admin surface. It is an operational control plane, not a strategy editor.

Admin capabilities:

- view/manage partner records;
- configure allowlisted partner routes;
- manage sandbox/live route state;
- create/version disclosures;
- manage non-core feature flags;
- create/stop presentation experiments;
- control global commercial and email kill switches;
- view basic journey/commercial operational metrics and audit history.

Admin must not expose controls that can change safety thresholds, readiness rules, barrier diagnosis, mission ranking or Academy eligibility.

## 5. Data model

V2.2 is additive. Existing profile, account, safety, readiness, mission and Academy structures remain authoritative.

### 5.1 `journey_state`

One current row per user.

Suggested fields:

- `user_id` primary/unique owner key;
- `stage` enum: `onboarding`, `active_mission`, `waiting`, `cooldown`, `reassessment_due`, `ready`, `optimising`;
- `active_mission_id` nullable reference;
- `next_reassessment_at` nullable timestamp;
- `last_reassessed_at` nullable timestamp;
- `last_readiness_band` nullable stored snapshot (`red`, `amber`, `green`, `unknown`);
- `updated_at`.

The row is a convenience projection. Historical truth lives in append-only outcome/event records.

### 5.2 `journey_outcomes`

Append-only evidence of meaningful events.

Examples:

- onboarding completed;
- mission started;
- mission completed;
- external action submitted;
- pending action resumed;
- cooldown started/ended;
- reassessment performed;
- readiness changed;
- referral consent accepted/declined;
- application outcome later reported.

Suggested fields include `id`, `user_id`, `event_type`, relevant mission/action IDs, `source`, structured non-sensitive metadata, `occurred_at`, and optional `readiness_before` / `readiness_after` snapshots where appropriate.

Journey outcomes must not be retroactively edited to rewrite history. Corrections should append compensating records where needed.

### 5.3 `journey_reminders`

Server-owned scheduled reminder jobs.

Suggested fields:

- `id`, `user_id`;
- `reason` enum;
- `due_at`;
- `channel` (`in_app`, `email`);
- `status` (`scheduled`, `sent`, `suppressed`, `failed`, `cancelled`);
- `suppression_reason` nullable;
- `source_outcome_id` / source mission reference;
- approved template/version;
- AI-assist status if wording was transformed;
- send timestamps and provider reference where applicable.

A reminder failure never changes journey strategy.

### 5.4 `commercial_partners`

Canonical partner identity and operating state.

Fields should cover partner name/key, status, regulatory/operational notes needed for configuration, sandbox/live capability and timestamps. Commercial economics must not be exposed through interfaces consumed by mission/readiness code.

### 5.5 `commercial_routes`

Allowlisted outbound/referral routes owned by the server.

Fields should cover:

- partner reference;
- route key/type;
- environment (`sandbox`, eventually `live`);
- enabled state;
- allowlisted destination or provider adapter configuration;
- permitted broad customer/readiness context;
- disclosure requirement;
- version/audit metadata.

The browser never supplies an arbitrary destination URL.

### 5.6 `commercial_disclosures`

Versioned disclosure text/state with publish history. Every referral attempt stores the disclosure version the user saw.

### 5.7 `referral_attempts`

Immutable/auditable referral provenance.

Suggested fields:

- Credit Quest referral ID;
- user ID;
- partner and route IDs;
- originating mission/action if relevant;
- readiness snapshot;
- consent timestamp;
- disclosure version;
- environment (`sandbox` or `live`);
- referral creation/result timestamps;
- external attribution reference where available;
- outcome status.

Referral creation occurs only after all server-side gates pass.

### 5.8 `revenue_events`

Append-only downstream commercial outcomes. Revenue data is logically and architecturally separated from suitability and ranking inputs.

Examples include attributed click, eligible lead, conversion, confirmed revenue, reversal and adjustment. These records may be used in reporting but never by strategy engines.

### 5.9 `feature_flags`

Server-owned, versioned runtime switches for incomplete/new downstream journeys and emergency rollback. Safety-critical protections should fail safe if flag/config reads fail.

### 5.10 `experiments`

Presentation-only experiments.

Experiments may change approved wording, layout or presentation order among already-permitted equivalent surfaces. They may not alter:

- safety;
- age gates;
- Safe Mode;
- barrier diagnosis;
- readiness calculation;
- mission ranking;
- Academy protective filtering;
- whether an otherwise ineligible user becomes commercially eligible.

## 6. Customer experience

The V2.2 experience should make the existing product feel more complete rather than more complicated.

After a meaningful action, Credit Quest should answer:

1. **What changed?**
2. **What happens next?**
3. **When should I come back?**

Example pattern:

> Direct debit confirmed. Your payment-protection position is stronger. We’ll reassess your Credit Quest position in 14 days.

Where evidence does not justify improvement, say so plainly:

> No readiness change yet. That is normal — this action needs time to show through. Your next reassessment is in 14 days.

At reassessment, show explainable movement such as Amber → Green, Red → Amber, unchanged, or Unknown where evidence remains incomplete. Do not imply causation that cannot be supported.

If commercial eligibility becomes permitted in the future, language remains eligibility-first, for example:

> You may be ready to check eligibility.

Never use wording that implies guaranteed approval.

## 7. Reminder and AI rules

Reminder selection is fully deterministic.

AI is permitted only after a reminder has already been selected by rules. AI inputs are constrained to approved facts such as reminder reason, stage, relevant mission label, approved call-to-action and communication style. AI must not receive commission, partner payout or alternative partner-ranking data for reminder generation.

Generated copy must be validated against:

- no invented lender/product facts;
- no approval odds;
- no urgency pressure inconsistent with the deterministic trigger;
- no new financial recommendation beyond the approved message intent;
- age/Safe Mode restrictions;
- no disclosure removal or weakening.

Failure falls back to the approved static template.

## 8. Analytics and success measures

V2.2 analytics should optimise for helping customers progress, not for maximising screen time or applications.

Core journey metrics:

- onboarding completion;
- first useful action reached;
- mission start/completion rate;
- time to meaningful action;
- reassessment completion;
- readiness distribution and movement;
- return rate after scheduled reassessment;
- percentage of users receiving WAIT versus eligibility-permitted outcomes;
- reminder send/open/click where available;
- reminder-to-return and reminder-to-mission-completion lift.

Commercial-readiness metrics:

- commercially eligible population after hard gates;
- consent rate;
- sandbox referral creation/completion;
- eligibility-check completion when future integrations exist;
- referral CTR/conversion when legally live;
- partner performance;
- revenue per active user once live.

Revenue is an outcome metric only. It is never fed into the strategy engines.

## 9. Failure handling

### Core rule

**Fail closed commercially; fail open for the core educational/guidance experience.**

Examples:

- partner config unavailable → no referral, normal Credit Quest journey continues;
- disclosure unavailable → no referral;
- consent write fails → no referral;
- attribution write fails → no referral;
- email provider unavailable → reminder marked failed/retriable, user journey unaffected;
- AI wording fails → deterministic approved template used;
- analytics fails → action/journey state change still succeeds if the core write is valid;
- admin unavailable → current published configuration remains in force;
- feature flag service/config read fails → safety-sensitive downstream capability defaults off.

## 10. Security and privacy

- All partner, route, disclosure, referral, revenue, feature-flag and experiment writes are server-owned.
- Ordinary clients cannot directly mutate commercial configuration.
- User-specific journey/reminder records use owner-based RLS.
- Admin access uses explicit authorised roles and server-side enforcement.
- Partner destinations are allowlisted and resolved server-side.
- Credit Quest generates referral IDs and records provenance before redirecting.
- Disclosure acceptance is versioned and timestamped.
- Revenue records are append-only/auditable.
- Service-role credentials remain server-only.
- Store only the minimum personal/commercial information needed for operation and audit.
- Avoid storing full application payloads or unnecessary lender decision data.

## 11. Regulatory control point

Engineering readiness does not constitute permission to enable live credit referrals.

Before any production live regulated referral route is enabled, Credit Quest must document and approve the operating model against current FCA requirements, including at minimum:

- whether the intended activity constitutes credit broking;
- direct authorisation versus AR/IAR route;
- financial-promotion approval requirements;
- required status disclosures;
- commission/disclosure requirements;
- Consumer Duty evidence and monitoring expectations;
- partner contractual and recordkeeping requirements.

Until that checkpoint is cleared, production `live` credit routes remain disabled by server-side control. Sandbox testing is allowed.

## 12. Admin design boundaries

The initial Credit Quest Admin is intentionally narrow.

Screens/modules:

- Partners;
- Routes;
- Disclosures;
- Feature Flags / Kill Switches;
- Experiments;
- Journey & Commercial dashboard;
- Audit history.

Not included:

- editing safety/readiness algorithms;
- mission priority editors;
- arbitrary SQL/data editing;
- bulk CRM tooling;
- customer impersonation unless separately designed with strong controls.

## 13. Testing strategy

### Unit tests

- all journey-state transitions;
- reassessment scheduling;
- deterministic reminder triggers and suppression;
- age/Safe Mode protection;
- commercial hard gates;
- disclosure/consent requirements;
- kill-switch behaviour;
- AI-copy validation/fallback;
- experiment boundaries.

### Architecture tests

CI must fail if core strategy modules begin importing commercial/revenue/affiliate/campaign modules or if commercial configuration becomes an input to mission/readiness selection.

### Database/RLS tests

- users can read only their own journey/reminder records where appropriate;
- clients cannot write protected commercial/admin tables;
- ordinary users cannot read sensitive administrative/revenue data;
- service/admin roles have only intended permissions;
- append-only/audit invariants are enforced where practical;
- required unique/idempotency constraints prevent duplicate referral/reminder creation.

### E2E scenarios

At minimum:

1. normal adult completes a mission and receives a scheduled reassessment;
2. reassessment changes readiness and the user sees an explainable update;
3. readiness remains unchanged and the user receives an honest next step;
4. under-18 user can never create a referral;
5. Safe Mode user can never create a referral;
6. non-permitted readiness returns WAIT/no referral;
7. consent refusal creates no referral;
8. missing disclosure creates no referral;
9. global commercial kill switch blocks referrals;
10. sandbox referral records provenance and routes only to an allowlisted sandbox destination;
11. email kill switch suppresses outbound email without breaking in-app journey state;
12. AI wording failure falls back to an approved template.

## 14. Rollout

V2.2 ships dark-first in controlled slices:

1. additive schema + RLS + event contracts;
2. Journey Orchestrator and outcome tracking;
3. explicit reassessment loop and customer feedback;
4. deterministic in-app reminders;
5. email reminder pipeline behind kill switch;
6. partner/route/disclosure configuration;
7. Credit Quest Admin;
8. sandbox Commercial Gateway and referral provenance;
9. experiment framework and dashboards;
10. internal/demo soak and verification.

No live commercial route is enabled as part of the engineering rollout.

Each slice must preserve a runtime rollback path that does not depend on an emergency redeploy where feasible.

## 15. Operational controls

V2.2 requires at least these independent server-side controls:

- `commercial_gateway_enabled` — defaults false for live regulated referrals;
- `email_reminders_enabled` — can stop outbound mail independently;
- per-partner enabled state;
- per-route enabled state;
- per-experiment enabled state;
- per-feature rollout state.

A disabled commercial capability must not hide or block the user's normal Credit Quest guidance.

## 16. Acceptance criteria

V2.2 is complete when:

- a customer can progress from mission action through scheduled reassessment with an auditable outcome trail;
- Credit Quest can show whether readiness improved, worsened, stayed unchanged or remains unknown;
- deterministic in-app/email retention triggers work and can be independently disabled;
- AI is limited to validated message wording and cannot choose triggers or credit strategy;
- partner, route and disclosure configuration is server-owned and manageable through the lightweight admin surface;
- sandbox referral attempts capture consent, disclosure version, partner, route, attribution ID and originating customer context;
- under-18, Safe Mode, WAIT/non-permitted readiness, missing consent and kill-switch states all block referral creation server-side;
- commercial/revenue data cannot enter mission/readiness ranking code paths;
- experiments can modify presentation only, not suitability;
- journey and commercial analytics are available without making revenue an optimisation input;
- all required unit, architecture, RLS and E2E tests pass;
- live regulated credit referrals remain disabled pending the separate FCA operating-model decision.

## 17. Relationship to existing roadmap

This design advances the open **Customer Journey + monetisation layer** work by implementing the lifecycle, attribution, consent, commercial separation and experiment framework while preserving the required regulatory checkpoint.

It also advances the **speed-to-market platform** by introducing controlled server-owned configuration, runtime kill switches, reversible downstream features, admin-managed high-change content/configuration and dark-launch capability.

The V2.1 Credit Passport, Application Readiness, Quest Feed and Academy remain the customer-facing strategic foundation. V2.2 measures and extends the journey around those capabilities rather than replacing them.
