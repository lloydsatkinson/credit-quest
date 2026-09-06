# Credit Quest Lender Pilot Console — Design

Date: 2026-09-06
Status: Approved in chat; written-spec review pending
Branch: `spec/lender-pilot-console`

## 1. Purpose

Build a lender-facing Recovery Dashboard and pilot operating layer that demonstrates Credit Quest's closed-loop decline-recovery value without introducing a second underwriting model, weakening customer protections, or exposing regulated/live controls prematurely.

The first tranche is an **internal Lender Demo + Pilot Console** operated by Credit Quest staff through the existing admin control plane. It is designed to support lender demos and controlled pilots before Credit Quest adds external lender identity, organisation-scoped RBAC, or production partner-user access.

The commercial story is:

> Here are the customers you declined. Here is how many engaged, what stage they are at, how quickly they acted, how many became ready to check again, and how many voluntarily returned to you.

## 2. Goals

1. Show lender-specific recovery performance clearly in under five minutes.
2. Provide a pseudonymised recovery pipeline that makes the closed-loop model operationally tangible.
3. Keep readiness independent from Return-to-Origin availability.
4. Preserve Credit Quest's single customer record and existing deterministic strategy engines.
5. Reuse existing recovery, partner, return and analytics data rather than creating a parallel lender data model.
6. Keep all live/commercial/email/regulatory gates dark by default.
7. Provide a credible path to a later external lender portal without pretending that the current `admin_members` model is suitable for partner users.

## 3. Non-goals

This tranche does **not**:

- create external lender accounts or partner-user authentication;
- add lender-specific underwriting, creditworthiness, readiness or mission-ranking logic;
- allow lenders to alter customer missions, Passport, safety decisions or readiness;
- expose customer name, email, DOB, address, raw account balances, vulnerability/support-needs detail, or free-text decline reasons;
- add CRA or Open Banking connectivity;
- enable live partner intake, live Return-to-Origin, callbacks, commercial referrals or email;
- let an admin casually turn regulated/live capabilities on from the dashboard;
- replace the existing customer Recovery Experience.

## 4. Existing architecture to reuse

The existing system already contains:

- `/admin/recovery` aggregate recovery reporting;
- `/admin/partners` partner configuration;
- admin-only authentication via `requireAdminUser()` and `admin_members`;
- decline intake, recovery journeys, reassessment/readiness snapshots and Return-to-Origin records;
- dark runtime gates for partner intake, return, commercial and email paths;
- a customer Recovery Experience with explicit states:
  - `action_required`
  - `waiting_for_evidence`
  - `reassessment_due`
  - `not_ready`
  - `ready_to_check`

The lender console must extend these seams. It must not import lender/commercial concepts into the customer strategy engines.

## 5. Chosen approach

### Internal Lender Demo + Pilot Console

The console remains behind the existing admin boundary for the first pilot. A Credit Quest operator selects a lender/partner and views only that partner's projected aggregate and pseudonymised recovery data.

This gives the lender the experience of a dedicated portal without prematurely adding external identity/RBAC infrastructure.

When a real lender requires direct access, that will be a separate architectural tranche using a dedicated model such as:

`partner_user -> organisation_membership -> partner_scope`

That future model must not reuse or weaken `admin_members`.

## 6. Information architecture

The lender pilot console has four views.

### 6.1 Executive overview

Purpose: answer the lender's commercial questions immediately.

Required controls:
- partner selector;
- time window selector: 7 / 30 / 90 days;
- visible environment/status banner showing INTERNAL DEMO / SANDBOX / LIVE LOCKED as applicable.

Required metrics:
- decline handoffs;
- activations;
- first recovery actions;
- reassessments;
- ready-to-check count;
- voluntary returns;
- activation rate;
- first-action rate;
- ready-to-check rate;
- voluntary-return rate;
- average time to first recovery action;
- suppression-reason distribution.

Percentages must use explicit denominators and show `Unavailable` where source data is unavailable. Missing data must never be converted to zero.

### 6.2 Recovery pipeline

Purpose: make the recovery engine operationally tangible without exposing customer identity.

Each row represents one active or recently completed recovery journey using a stable, non-reversible display reference such as `CQ-7F42` rather than user ID or email.

Permitted fields:
- pseudonymous case reference;
- recovery state;
- recovery stage;
- time in recovery;
- next milestone category;
- evidence-confidence summary;
- reassessment timing category/date where genuinely known;
- readiness state;
- Return-to-Origin availability state: available / blocked / unavailable;
- return outcome where present;
- high-level source channel if controlled and non-sensitive.

Prohibited fields:
- name, email, phone, DOB, address;
- raw user UUID;
- raw balances, limits, income, arrears amounts or transaction data;
- support-needs or vulnerability details;
- decline-reason narrative;
- partner economics, commission or affiliate data;
- approval probability or implied lender outcome.

The queue is read-only in this tranche.

### 6.3 Cohort analysis

Purpose: show whether recovery performance improves and where the funnel loses customers.

Initial cohorts:
- intake week/month;
- partner channel if already available as a controlled field;
- recovery start cohort.

Metrics:
- handoff -> activation;
- activation -> first action;
- first action -> reassessment;
- reassessment -> ready to check;
- ready to check -> voluntary return;
- median/average elapsed times where data quality supports the measure.

No segmentation by protected/sensitive characteristics. No user-level drill-through from a cohort chart.

### 6.4 Pilot control/status

Purpose: make operating boundaries explicit to Credit Quest staff and lenders during a pilot.

Read-only status surface for:
- partner intake gate;
- Return-to-Origin gate;
- callback gate;
- commercial/referral gate;
- email reminder gate;
- live-credit-referral hard lock;
- sandbox/live partner configuration;
- disclosure/contract status where already modelled.

The first tranche does not add one-click activation of live regulated paths. Any consequential runtime activation remains a separate controlled release action with auditability.

## 7. Data architecture

### 7.1 One-way projection

Data flow:

`existing customer/partner events -> existing recovery records -> server-only lender projection -> admin lender console`

The lender projection is read-only and downstream.

It may read from existing recovery-related relations such as:
- `decline_intake_sessions`;
- `decline_recovery_journeys`;
- mission/action timestamps required for recovery funnel timing;
- `return_attempts`;
- partner configuration/contracts/disclosures where already present.

It must not write back into:
- mission strategy;
- Passport;
- Safe Mode;
- readiness computation;
- customer profile;
- recovery orchestration.

### 7.2 Partner scoping

Every lender-facing projection request must require an explicit partner ID selected server-side from an allowed partner list.

Repository/query functions must filter by partner before returning journey-level data. The UI must not receive a mixed-partner case collection and filter it only in the browser.

### 7.3 Pseudonymous case reference

The displayed `CQ-XXXX` reference must not expose or trivially encode the user's UUID.

Preferred design:
- derive from a server-held keyed digest/HMAC over the recovery journey ID or use a stored opaque pilot reference;
- truncate only after cryptographic transformation;
- do not expose the source identifier in page props, rendered HTML or client analytics.

The exact derivation belongs in implementation planning, but reversibility is prohibited.

## 8. Readiness and Return-to-Origin separation

The lender console must preserve this invariant:

`ready_to_check` is a Credit Quest readiness state; Return-to-Origin availability is a separate partner-routing decision.

Therefore the following combinations are valid and must render distinctly:
- ready to check + return available;
- ready to check + return blocked;
- ready to check + return unavailable/direct journey;
- not ready + return blocked/unavailable.

The console must never imply that `ready_to_check` means approval, qualification, or lender acceptance.

## 9. Security and privacy boundaries

1. First tranche uses existing `requireAdminUser()` only.
2. No external lender login is claimed or exposed.
3. All journey-level queries are server-only.
4. Browser data contains only approved pseudonymised projection fields.
5. No arbitrary lender destination URL is sent to the browser.
6. No support-needs/vulnerability detail enters lender projection or analytics.
7. No partner economics enter the recovery strategy or case view.
8. Missing evidence remains unknown.
9. Reporting-source failure fails visibly to `Unavailable`; never silently to zero.
10. Live/commercial/email gates remain off unless separately activated through an approved release process.

## 10. Components and module boundaries

Proposed boundaries, subject to implementation-plan confirmation:

### Server projection
`lib/server/lender-recovery-repository.ts`

Responsibilities:
- partner-scoped aggregate reads;
- partner-scoped journey projection;
- cohort aggregation inputs;
- controlled status projection;
- fail-closed/unavailable results.

It must not contain UI code or strategy decisions.

### Domain projection
`lib/recovery/lender-projection.ts`

Responsibilities:
- convert raw recovery/admin records into stable lender-facing view models;
- calculate controlled percentages and timing labels;
- enforce allowed case fields;
- keep readiness and return state separate.

Pure/testable functions wherever possible.

### Admin pages/components
Suggested route family:
- `/admin/lender-demo`
- `/admin/lender-demo/pipeline`
- `/admin/lender-demo/cohorts`
- `/admin/lender-demo/status`

Alternative implementation may use one route with tabs if that better follows existing admin patterns. The architecture rule is more important than route count.

Components should consume lender projection types only; they must not query Supabase directly.

## 11. UX design

Visual tone: credible lender operations product, not a consumer gamification screen.

Characteristics:
- compact operational layout;
- clear funnel hierarchy;
- strong data provenance labels;
- explicit demo/sandbox/live-lock banners;
- restrained status colours;
- no celebratory approval language;
- no dense raw-data tables where an aggregate or controlled label is sufficient.

The key five-minute demo sequence is:

1. Select lender.
2. Show funnel and recovery rate.
3. Open pseudonymised pipeline.
4. Point out customers in fixing/waiting/reassessment/ready states.
5. Show ready-to-check versus return availability as separate concepts.
6. Show cohort trend.
7. Show pilot gates/status to demonstrate controlled rollout.

## 12. Error handling

- Partner list unavailable -> entire lender console shows a reporting-unavailable state.
- Aggregate query unavailable -> metrics show unavailable, not zero.
- Pipeline query unavailable -> pipeline is hidden behind a clear unavailable panel; aggregates may remain visible if independently available.
- One optional telemetry source unavailable -> dependent metric unavailable while unaffected metrics remain usable.
- Invalid/unknown partner selector -> reject server-side and fall back to no selected partner or an allowed default; never broaden to all partners implicitly.
- Missing reassessment date -> show `Not scheduled`/`Unknown` according to domain truth; never infer a date.
- Return status lookup failure -> `Unavailable`, never `Available`.

## 13. Analytics for the console

Internal presentation analytics may record controlled events such as:
- lender_demo_opened;
- lender_demo_partner_selected;
- lender_demo_pipeline_viewed;
- lender_demo_cohorts_viewed;
- lender_demo_status_viewed.

Allowed metadata:
- internal admin user ID if existing policy permits;
- partner ID;
- selected window;
- view name;
- environment mode.

Prohibited metadata mirrors the privacy boundary: no customer identity, raw financial data, support/vulnerability detail, decline narrative or partner economics.

Console analytics failure must never block the console.

## 14. Testing strategy

### Unit/domain tests
Prove:
- partner scoping;
- pseudonymous reference does not expose source ID;
- denominator/percentage rules;
- unavailable data is not zero;
- readiness remains independent from Return-to-Origin;
- approved projection contains no prohibited fields;
- cohort calculations;
- status/gate projection.

### Repository tests
Prove:
- all journey-level reads are partner-filtered server-side;
- failed sources return explicit unavailable states;
- no write methods exist in the lender recovery repository;
- no sensitive relation/columns are selected unnecessarily.

### Component tests
Prove:
- executive funnel renders controlled metrics;
- pipeline renders pseudonymous rows only;
- blocked/unavailable return states do not look like readiness failure;
- live-lock warning is visible;
- no approval-guarantee wording.

### E2E
Prove:
- non-admin cannot access lender demo;
- admin can select an allowed partner and move through all four views;
- normal customer routes remain unchanged;
- direct-recovery records do not appear in a selected partner's pipeline;
- dark production gates remain unchanged.

## 15. Release strategy

1. Build on a feature branch from the verified `main` recovery release.
2. TDD slices with `[vercel skip]` on intermediate non-visual commits.
3. Deliberate Vercel preview at the first coherent lender-demo UI checkpoint.
4. Internal Credit Quest UAT using demo/sandbox data only.
5. No external lender credentials in this tranche.
6. Merge only after full CI, security review and UAT.
7. Runtime live gates remain unchanged by merge.

## 16. Success criteria

The tranche is successful when a Credit Quest operator can select a lender and demonstrate, from real/sandbox recovery records where available:

- how many customers were handed off;
- how many activated;
- how many took a first recovery action;
- how many were reassessed;
- how many became ready to check;
- how many voluntarily returned;
- how long key stages took;
- where active pseudonymised cases sit in the recovery lifecycle;
- whether return is available/blocked/unavailable without conflating it with readiness;
- which pilot capabilities are enabled, sandboxed or locked.

A lender should understand the closed-loop proposition in under five minutes without Credit Quest exposing customer-sensitive information or granting operational control over credit strategy.

## 17. Architectural rejection criteria

Reject the implementation if any final diff:

- creates a lender-specific readiness or creditworthiness model;
- lets partner/commercial data influence mission ranking, Passport, safety or readiness;
- exposes direct identifiers or sensitive customer data in the lender case projection;
- sends a mixed-partner case dataset to the browser for client-side filtering;
- makes Return-to-Origin availability decide readiness;
- presents `ready_to_check` as likely approval;
- reuses `admin_members` as a claimed external lender-auth model;
- adds live activation controls without a separate controlled release design;
- changes dark production gates as a side effect of merge;
- presents unavailable reporting data as zero;
- adds CRA/Open Banking claims without a real adapter.

## 18. Future tranche: external lender portal

Deferred until a real lender requires direct access.

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
