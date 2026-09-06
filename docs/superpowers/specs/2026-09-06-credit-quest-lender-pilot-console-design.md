# Credit Quest Lender Pilot Console — Design

Date: 2026-09-06
Status: Approved in chat; written-spec review pending
Branch: `spec/lender-pilot-console`

## 1. Purpose

Build a lender-facing Recovery Dashboard and pilot operating layer that demonstrates Credit Quest's closed-loop decline-recovery value without introducing a second underwriting model, weakening customer protections, or exposing regulated/live controls prematurely.

The first tranche is an **internal Lender Demo + Pilot Console** operated by Credit Quest staff through the existing admin control plane. It supports lender demos and controlled pilots before Credit Quest adds external lender identity, organisation-scoped RBAC, or production partner-user access.

The commercial story is:

> Here are the customers you declined. Here is how many engaged, what stage they are at, how quickly they acted, how many became ready to check again, and how many voluntarily returned to you.

## 2. Goals

1. Show lender-specific recovery performance clearly in under five minutes.
2. Provide a pseudonymised recovery pipeline that makes the closed-loop model operationally tangible.
3. Keep readiness independent from Return-to-Origin availability.
4. Preserve Credit Quest's single customer record and deterministic strategy engines.
5. Reuse existing recovery, partner, return and analytics data rather than create a parallel lender data model.
6. Keep all live/commercial/email/regulatory gates dark by default.
7. Preserve a clean path to a later external lender portal without pretending `admin_members` is suitable for partner users.

## 3. Non-goals

This tranche does **not**:

- create external lender accounts or partner-user authentication;
- add lender-specific underwriting, creditworthiness, readiness or mission-ranking logic;
- allow lenders to alter customer missions, Passport, safety decisions or readiness;
- expose customer name, email, phone, DOB, address, raw account balances, vulnerability/support-needs detail, or free-text decline reasons;
- add CRA or Open Banking connectivity;
- enable live partner intake, live Return-to-Origin, callbacks, commercial referrals or email;
- add one-click activation of regulated/live paths;
- replace the customer Recovery Experience.

## 4. Existing architecture to reuse

The system already contains:

- `/admin/recovery` aggregate recovery reporting;
- `/admin/partners` partner configuration;
- admin-only authentication via `requireAdminUser()` and `admin_members`;
- decline intake, recovery journeys, reassessment/readiness snapshots and Return-to-Origin records;
- dark runtime gates for partner intake, return, commercial and email paths;
- customer recovery states: `action_required`, `waiting_for_evidence`, `reassessment_due`, `not_ready`, `ready_to_check`.

The lender console extends these seams. It must not import lender/commercial concepts into customer strategy engines.

## 5. Chosen approach

### Internal Lender Demo + Pilot Console

The console remains behind the existing admin boundary for the first pilot. A Credit Quest operator selects a lender/partner and views only that partner's projected aggregate and pseudonymised recovery data.

This gives a lender the experience of a dedicated portal without prematurely adding external identity/RBAC infrastructure.

A future external-access tranche will use a dedicated model such as:

`partner_user -> organisation_membership -> partner_scope`

That future model must not reuse or weaken `admin_members`.

## 6. Information architecture

The lender pilot console has four views.

### 6.1 Executive overview

Required controls:
- partner selector;
- time window: 7 / 30 / 90 days;
- visible environment/status banner: INTERNAL DEMO / SANDBOX / LIVE LOCKED as applicable.

Required counts:
- decline handoffs;
- activations;
- first recovery actions;
- reassessments;
- ready-to-check journeys;
- voluntary returns.

Required rates use these exact denominators:
- **Activation rate** = activations / handoffs.
- **First-action rate** = journeys with a first recovery action / activations.
- **Recovery rate** = ready-to-check journeys / activations.
- **Voluntary-return rate** = voluntary returns / ready-to-check journeys.

A rate is `Unavailable` when its numerator source is unavailable or its denominator is zero. Zero denominators are never displayed as 0% success or failure.

Also show:
- average time from recovery activation/start to first recovery action where action telemetry is available;
- suppression-reason distribution.

Missing reporting data must never be converted to zero.

### 6.2 Recovery pipeline

Each row represents one partner-linked recovery journey and uses a stable, non-reversible display reference such as `CQ-7F42` rather than user ID or email.

Pipeline inclusion rule for a selected window:
- include every currently active partner-linked recovery journey, even if it started before the selected window;
- also include completed/closed partner-linked recovery journeys whose final recovery or return event occurred within the selected window;
- exclude direct-recovery journeys with no selected-partner linkage.

Permitted fields:
- pseudonymous case reference;
- recovery state;
- recovery stage;
- time in recovery;
- next milestone category;
- evidence-confidence summary;
- reassessment timing/date where genuinely known;
- readiness state;
- Return-to-Origin availability: available / blocked / unavailable;
- return outcome where present;
- controlled non-sensitive source channel only when already modelled as an enumerated field.

Prohibited fields:
- name, email, phone, DOB, address;
- raw user UUID or recovery journey UUID;
- raw balances, limits, income, arrears amounts or transaction data;
- support-needs or vulnerability details;
- decline-reason narrative;
- partner economics, commission or affiliate data;
- approval probability or implied lender outcome.

The queue is read-only in this tranche.

### 6.3 Cohort analysis

Initial cohorts:
- intake week/month;
- recovery-start week/month;
- controlled partner channel where already modelled.

Metrics:
- handoff -> activation;
- activation -> first action;
- activation -> ready to check;
- ready to check -> voluntary return;
- elapsed-time summaries where data quality supports them.

Cohort rates use the same definitions as the executive overview. No segmentation by protected/sensitive characteristics. No user-level drill-through from a cohort chart.

### 6.4 Pilot control/status

Read-only status surface for:
- partner intake gate;
- Return-to-Origin gate;
- callback gate;
- commercial/referral gate;
- email reminder gate;
- live-credit-referral hard lock;
- sandbox/live partner configuration;
- disclosure/contract status where already modelled.

This tranche does not add one-click activation of live regulated paths. Consequential activation remains a separate controlled release action with auditability.

## 7. Data architecture

### 7.1 One-way projection

Data flow:

`existing customer/partner events -> existing recovery records -> server-only lender projection -> admin lender console`

The lender projection is read-only and downstream.

It may read existing recovery relations such as decline intake sessions, recovery journeys, action timestamps needed for funnel timing, return attempts, and already-modelled partner configuration/contracts/disclosures.

It must not write back into mission strategy, Passport, Safe Mode, readiness computation, customer profile, or recovery orchestration.

### 7.2 Partner scoping

Every lender-facing projection request requires an explicit allowed partner ID selected server-side.

Repository functions must filter by partner before returning journey-level data. The UI must never receive a mixed-partner case collection and filter it only in the browser.

An invalid/unknown partner selector fails closed to no selected partner or a separately resolved allowed default; it must never broaden to all partners implicitly.

### 7.3 Pseudonymous case reference

The displayed `CQ-XXXX` reference must not expose or trivially encode a user or journey UUID.

Preferred design:
- server-held keyed digest/HMAC over the recovery journey ID, or a stored opaque pilot reference;
- truncate only after cryptographic transformation;
- never expose the source identifier in page props, rendered HTML or client analytics.

The exact derivation belongs in implementation planning, but reversibility is prohibited.

## 8. Readiness and Return-to-Origin separation

Invariant:

`ready_to_check` is a Credit Quest readiness state; Return-to-Origin availability is a separate partner-routing decision.

Valid combinations include:
- ready to check + return available;
- ready to check + return blocked;
- ready to check + return unavailable;
- not ready + return blocked/unavailable.

The console must never imply that `ready_to_check` means approval, qualification, or lender acceptance.

## 9. Security and privacy boundaries

1. First tranche uses existing `requireAdminUser()` only.
2. No external lender login is claimed or exposed.
3. All journey-level queries are server-only.
4. Browser data contains only approved pseudonymised projection fields.
5. No arbitrary lender destination URL is sent to the browser.
6. No support-needs/vulnerability detail enters lender projection or analytics.
7. No partner economics enter recovery strategy or case view.
8. Missing evidence remains unknown.
9. Reporting-source failure shows `Unavailable`; never silently zero.
10. Live/commercial/email gates remain off unless separately activated through an approved release process.

## 10. Module boundaries

### Server projection
`lib/server/lender-recovery-repository.ts`

Responsibilities:
- allowed partner list;
- partner-scoped aggregate reads;
- partner-scoped journey reads;
- cohort inputs;
- controlled gate/status reads;
- explicit unavailable results.

No UI code and no strategy decisions.

### Domain projection
`lib/recovery/lender-projection.ts`

Responsibilities:
- convert recovery/admin records into stable lender-facing view models;
- calculate controlled rates and timing labels;
- enforce allowed case fields;
- keep readiness and return state separate;
- produce pure/testable projections wherever possible.

### Admin UI
Suggested route family:
- `/admin/lender-demo`
- `/admin/lender-demo/pipeline`
- `/admin/lender-demo/cohorts`
- `/admin/lender-demo/status`

A single route with tabs is acceptable if it better matches current admin patterns. Components consume lender projection types only; they do not query Supabase directly.

## 11. UX design

Visual tone: credible lender operations product, not a consumer gamification screen.

Characteristics:
- compact operational layout;
- clear funnel hierarchy;
- explicit data provenance;
- visible demo/sandbox/live-lock banners;
- restrained status colours;
- no celebratory approval language;
- no dense raw-data tables where controlled summaries are sufficient.

Five-minute demo sequence:
1. Select lender.
2. Show funnel and recovery rate.
3. Open pseudonymised pipeline.
4. Show customers in fixing/waiting/reassessment/ready states.
5. Show readiness and return availability as separate concepts.
6. Show cohort trend.
7. Show pilot gates/status.

## 12. Error handling

- Partner list unavailable -> entire lender console reports unavailable.
- Aggregate query unavailable -> metrics show unavailable, not zero.
- Pipeline query unavailable -> pipeline shows an unavailable panel while independent aggregate views may remain usable.
- Optional telemetry unavailable -> only dependent metrics are unavailable.
- Missing reassessment date -> `Not scheduled` or `Unknown` according to domain truth; never infer a date.
- Return-status lookup failure -> `Unavailable`, never `Available`.

## 13. Console analytics

Allowed internal presentation events may include:
- `lender_demo_opened`;
- `lender_demo_partner_selected`;
- `lender_demo_pipeline_viewed`;
- `lender_demo_cohorts_viewed`;
- `lender_demo_status_viewed`.

Allowed metadata:
- internal admin user ID if existing analytics policy permits;
- partner ID;
- selected window;
- view name;
- environment mode.

Prohibited metadata: customer identity, raw financial data, support/vulnerability detail, decline narrative, partner economics.

Analytics failure never blocks the console.

## 14. Testing strategy

### Unit/domain
Prove:
- exact rate denominators and zero-denominator behaviour;
- partner scoping;
- pipeline inclusion-window rules;
- pseudonymous reference does not expose source ID;
- unavailable data is not zero;
- readiness remains independent from Return-to-Origin;
- projection contains no prohibited fields;
- cohort calculations;
- gate/status projection.

### Repository
Prove:
- all journey-level reads are partner-filtered server-side;
- failed sources return explicit unavailable states;
- lender recovery repository exposes no write methods;
- no sensitive relation/columns are selected unnecessarily.

### Component
Prove:
- executive funnel renders controlled metrics;
- pipeline renders pseudonymous rows only;
- blocked/unavailable return does not look like readiness failure;
- live-lock warning is visible;
- no approval-guarantee wording.

### E2E
Prove:
- non-admin cannot access lender demo;
- admin can select an allowed partner and move through all four views;
- normal customer routes remain unchanged;
- direct-recovery records do not appear in a selected partner pipeline;
- dark production gates remain unchanged.

## 15. Release strategy

1. Build on a feature branch from verified `main`.
2. Use TDD slices and `[vercel skip]` for intermediate non-visual commits.
3. Create a deliberate Vercel preview at the first coherent lender-demo UI checkpoint.
4. UAT with demo/sandbox data only.
5. No external lender credentials in this tranche.
6. Merge only after full CI, security review and UAT.
7. Runtime live gates remain unchanged by merge.

## 16. Success criteria

A Credit Quest operator can select a lender and demonstrate:
- handoffs;
- activations;
- first recovery actions;
- ready-to-check journeys;
- voluntary returns;
- key elapsed times;
- active pseudonymised cases in the recovery lifecycle;
- return available/blocked/unavailable without conflating it with readiness;
- pilot capabilities enabled, sandboxed or locked.

A lender should understand the closed-loop proposition in under five minutes without Credit Quest exposing customer-sensitive information or granting operational control over credit strategy.

## 17. Architectural rejection criteria

Reject the implementation if any final diff:
- creates a lender-specific readiness or creditworthiness model;
- lets partner/commercial data influence mission ranking, Passport, safety or readiness;
- exposes direct identifiers or sensitive customer data in lender case projection;
- sends mixed-partner journey data to the browser for client-side filtering;
- makes Return-to-Origin availability decide readiness;
- presents `ready_to_check` as likely approval;
- reuses `admin_members` as a claimed external lender-auth model;
- adds live activation controls without a separate controlled release design;
- changes dark production gates as a side effect of merge;
- presents unavailable reporting data as zero;
- adds CRA/Open Banking claims without a real adapter.

## 18. Future tranche: external lender portal

Deferred until direct lender access is required.

That tranche should add:
- partner-user authentication;
- organisation membership;
- partner-scoped RBAC;
- least-privilege session claims;
- audit trail for lender-user access;
- partner-specific data retention/export policy;
- explicit legal/privacy review;
- optional lender-branded portal shell.

It must consume the same lender-facing projection boundary defined here so external access does not require a second recovery system.
