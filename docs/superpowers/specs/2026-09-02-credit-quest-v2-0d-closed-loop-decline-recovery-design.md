# Credit Quest V2.0d Closed-Loop Decline Recovery Design

**Status:** Product-owner approved architecture, ready for implementation planning after review  
**Date:** 2 September 2026  
**Base production commit:** `fb4e8dd1b45197e21e5c7f169853c6af23fe880e`  
**Depends on:** V2.0c Help + Fun Core, Credit Passport, Application Readiness, Quest Feed, Mission Action Layer, Safe Mode and existing commercial/sandbox isolation  
**Followed by:** V2.1 measurable customer lifecycle and sandbox-first monetisation; V2.2 institutional partner scale

## 1. Purpose

V2.0d turns a credit decline from a dead end into a safe, explainable recovery journey and creates a closed-loop partner proposition:

```text
Partner / direct customer decline
  -> secure Credit Quest intake
  -> customer transparency + consent
  -> independent Credit Quest assessment
  -> vulnerability/support adaptation
  -> decline recovery plan
  -> Quest missions + Passport movement
  -> reassessment
  -> ready-to-check gate
  -> customer-controlled return to origin
  -> partner/lender performs its own eligibility or lending decision
```

The customer outcome is:

> “I was declined. Credit Quest helps me understand what to work on, supports me appropriately, and lets me return to the original journey when I am genuinely in a better position to check eligibility again.”

The partner outcome is:

> “Instead of losing a declined customer, we can offer a safe recovery journey and, where appropriate, receive them back after independent readiness gates are met.”

V2.0d has four first-class capabilities:

1. **Decline Recovery**
2. **Secure Partner Decline Intake**
3. **Customer Vulnerability & Support**
4. **Return-to-Origin / Re-entry Gateway**

These capabilities share one rule: partner or commercial economics never alter Credit Quest safety, diagnosis, Passport, readiness, vulnerability support or mission ranking.

## 2. Non-negotiable product principles

### 2.1 Customer strategy remains independent

Partner identity, campaign value, commission, expected conversion, EPC, referral fee or commercial priority cannot influence:

- Safe Mode;
- Barrier Diagnosis;
- Credit Passport;
- Application Readiness;
- vulnerability/support treatment;
- mission eligibility or ranking;
- recovery-plan timing;
- Return-to-Origin readiness.

### 2.2 A decline is context, not a diagnosis

Credit Quest must never invent the lender's reason for a decline.

A partner-supplied decline reason may be stored as **partner-provided context/evidence** when it is genuinely known and permitted to be shared, but it does not automatically become a Credit Quest barrier or Passport status. Credit Quest independently evaluates the evidence it is entitled to use.

### 2.3 Ready-to-check is not approval

Return-to-Origin means only that Credit Quest's independent rules consider the customer ready to **check eligibility again**. It does not mean:

- approved;
- guaranteed;
- lender-eligible;
- likely to be accepted;
- underwriting criteria are satisfied.

The receiving lender/aggregator retains responsibility for its own eligibility, affordability and lending decision.

### 2.4 Vulnerability means support needs, not commercial classification

Credit Quest must model useful support needs rather than a crude `vulnerable = true` commercial label.

Vulnerability/support data cannot be used for:

- affiliate targeting;
- partner bidding;
- revenue optimisation;
- campaign priority;
- pricing discrimination;
- determining which partner is financially preferable.

### 2.5 Customer control and transparency

Where information originates from a partner, Credit Quest must clearly tell the customer what was supplied, by whom, and how it will be used. The customer must be able to confirm, correct or decline optional use where appropriate.

### 2.6 Closed-loop does not mean forced return

The customer chooses whether to return to the original partner when the gate is met. Credit Quest may also present other permitted eligibility-first routes later, but only behind the existing commercial/regulatory gateway.

## 3. Customer entry modes

V2.0d supports two entry modes.

### 3.1 Direct customer entry

A customer already using Credit Quest can select:

**“I’ve just been declined.”**

Credit Quest asks only for the minimum useful information, including:

- date/time or approximate date of decline;
- product category;
- whether the decline reason was actually provided;
- optional lender/marketplace name;
- whether the customer has made other recent applications;
- support needs relevant to the experience.

Credit Quest does not ask the customer to guess a decline reason.

### 3.2 Partner decline handoff

Approved lenders, aggregators, marketplaces or affiliates can hand a declined customer into Credit Quest through a secure server-to-server intake contract.

The browser URL must never contain raw personal or sensitive decline data.

The partner creates an intake session and Credit Quest returns a short-lived, opaque, single-use handoff token or redirect reference.

Conceptual flow:

```text
Partner server
  -> authenticated POST /partner/declines
  -> Credit Quest validates partner + payload
  -> create decline intake session
  -> return one-time recovery URL/token
  -> partner redirects customer
  -> Credit Quest redeems token
  -> customer sees source/context + consent screen
  -> account sign-in/create
  -> recovery journey starts
```

## 4. Secure Partner Decline Intake

### 4.1 Partner authentication

Initial production design should support strong server-to-server authentication such as signed requests and/or managed API credentials with:

- partner-specific credentials;
- rotation support;
- strict environment separation;
- replay protection;
- timestamp/nonce validation;
- request idempotency;
- rate limits;
- audit trail;
- kill switch per partner.

No partner credential is exposed to the browser.

### 4.2 Minimum intake contract

The initial intake payload should be deliberately small:

- `partner_id` determined from authenticated credentials, not trusted from arbitrary client input;
- partner-owned pseudonymous `origin_reference`;
- `product_category`;
- `declined_at`;
- optional structured `decline_reason_code` only where genuinely known;
- `decline_reason_source`;
- optional non-sensitive journey/campaign attribution;
- approved `return_contract_id` or server-owned return configuration reference;
- disclosure/consent version references where needed;
- idempotency key.

Avoid raw free-text decline notes in the first integration contract.

### 4.3 Data deliberately excluded by default

The partner decline endpoint must not become a dumping ground for underwriting data.

Default exclusions include:

- full credit bureau files;
- bank credentials;
- card/account credentials;
- unrestricted underwriting notes;
- health diagnoses;
- detailed vulnerability narratives;
- partner risk scores presented as Credit Quest truth;
- lender-specific approval probability;
- arbitrary return URLs supplied by the browser.

Additional data categories require a separately reviewed contract, purpose and lawful basis before use.

### 4.4 Token rules

Handoff tokens must be:

- random/unguessable;
- short-lived;
- one-use;
- server-redeemed;
- non-semantic;
- invalid after successful account binding;
- revocable if the partner integration is disabled.

Sensitive context is stored server-side and is never encoded directly into a query string.

## 5. Decline Recovery experience

### 5.1 Entry experience

A customer arriving from a partner should see clear, neutral language such as:

> “[Partner] could not offer you this product today. Credit Quest can help you understand what to work on next.”

The experience must not imply that the partner has promised future acceptance.

### 5.2 Truthful context review

Before strategy is generated, show the customer a concise summary of partner-provided context and allow them to:

- confirm it;
- correct relevant factual information;
- say they do not know;
- decline optional use where appropriate.

The source of each partner-provided field remains auditable.

### 5.3 Recovery-plan states

V2.0d consumes the existing deterministic hierarchy:

```text
crisis / recovery
  -> stability
  -> rebuilding
  -> optimisation
  -> ready to check eligibility
```

The recovery journey can produce:

- immediate stabilisation/support actions;
- evidence-gathering actions;
- application cooldown/waiting;
- payment-protection actions;
- utilisation/debt-headroom work;
- identity/address consistency work;
- disputed-information review/signposting;
- thin-file/history-building guidance;
- 30/90/180-day recovery milestones where evidence justifies those horizons;
- genuine reassessment conditions and dates.

The system must not fabricate a 90/180-day date where source dates are insufficient. A plan horizon is guidance; a precise reassessment date requires real dated evidence.

### 5.4 Mission completion remains evidence-based

Clicking a partner link or opening an external service never marks a recovery mission complete. Mission completion continues to require mission-specific evidence or an appropriate honest customer confirmation under existing Action Layer rules.

## 6. Customer Vulnerability & Support

### 6.1 Purpose

Vulnerability support exists to help customers receive outcomes as good as other customers and to adapt the Credit Quest experience to their needs.

The design follows the FCA's established vulnerable-customer framework and current Consumer Duty expectations, with support needs considered across four broad drivers:

1. health;
2. life events;
3. resilience;
4. capability.

Vulnerability can be temporary, permanent, situational or overlapping.

### 6.2 Support Needs Profile

Do not persist a single simplistic vulnerability boolean as the product model.

Use a structured **Support Needs Profile** containing only the minimum required information, for example:

- communication/support preference;
- accessibility requirement;
- cognitive-load preference;
- reminder preference;
- difficulty using digital journeys;
- current major life-event support need;
- financial resilience concern where relevant;
- consent/source/provenance;
- review/expiry date where appropriate.

Prefer storing the support adjustment needed rather than detailed medical information.

Example: store **“needs larger text and shorter instructions”** rather than a detailed diagnosis unless the diagnosis itself is genuinely necessary and lawfully processed.

### 6.3 Voluntary Support Check

Offer a non-stigmatising support check:

- during onboarding where appropriate;
- at the start of decline recovery;
- when Safe Mode/collections signals indicate additional support may help;
- from Profile/Settings at any time.

Example prompt:

> “Would anything make Credit Quest easier for you to use right now?”

Customers can choose needs such as:

- simpler explanations;
- larger/clearer presentation;
- fewer steps at once;
- more time to make decisions;
- reminder support;
- help after bereavement/job loss/relationship breakdown or another life event;
- difficulty managing money or essential payments;
- difficulty using online services;
- speak to / find human support.

### 6.4 Vulnerability is not automatically Safe Mode

A support need does not automatically imply financial crisis.

Examples:

- visual impairment may require an accessibility adaptation but not Safe Mode;
- low digital confidence may require more guidance but not offer suppression;
- bereavement may require compassionate pacing and potentially other protections depending on actual evidence;
- inability to meet essentials or active arrears may independently trigger Safe Mode under existing deterministic rules.

Safe Mode remains evidence-led and authoritative.

### 6.5 Adaptations

Permitted adaptations include:

- plain-English mode;
- reduced cognitive load;
- shorter task sequences;
- larger or clearer presentation;
- accessible non-swipe controls;
- reduced motion;
- flexible reminders;
- additional confirmation before consequential actions;
- slower pacing / “do this later” without penalty;
- support-directory signposting;
- human-help escape hatch;
- fewer competing calls to action.

### 6.6 Special-category data boundary

Health information may be UK GDPR special-category data. Before processing such data in production, Credit Quest must document:

- an Article 6 lawful basis;
- an applicable Article 9 condition;
- data minimisation;
- retention/deletion rules;
- access controls;
- transparency;
- any required appropriate policy document;
- DPIA where processing is likely to be high risk.

Credit Quest should avoid collecting detailed health information where a functional support preference is sufficient.

### 6.7 Partner-supplied vulnerability information

Default partner intake should use a minimal signal such as:

`additional_support_may_be_needed`

rather than detailed health/vulnerability descriptions.

If more detailed partner-to-Credit-Quest sharing is later required, it needs a separately approved data-sharing contract, purpose, lawful basis, disclosure and customer transparency design.

Partner-supplied vulnerability information must not silently become unquestioned truth. The customer should be able to understand the source and confirm/correct the relevant support need.

### 6.8 Support directory

Create a reviewed, versioned support directory for situations including:

- financial difficulty/debt support;
- bereavement;
- domestic/economic abuse support where appropriate;
- mental-health related financial support/signposting;
- accessibility/digital support;
- court/enforcement or urgent debt routes;
- fraud/identity issues;
- jurisdiction-specific support.

Credit Quest organises, explains and signposts. It does not present itself as giving regulated debt advice or legal advice where it is not authorised to do so.

## 7. Return-to-Origin / Re-entry Gateway

### 7.1 Purpose

When a decline-recovery customer reaches a genuinely improved state, Credit Quest can offer a safe, customer-controlled return to the original partner journey.

### 7.2 Return contract

The origin partner creates or references a server-owned return contract containing:

- partner ID;
- origin journey/reference;
- approved destination/callback configuration;
- environment;
- expiry;
- allowed product category/context;
- disclosure version;
- callback policy;
- attribution rules;
- kill-switch state.

The browser cannot supply or override the return destination.

### 7.3 Return readiness gate

Return-to-Origin is available only when all applicable independent gates pass.

At minimum:

- customer is an adult where the route is regulated/product-related;
- no blocking Safe Mode condition;
- no blocking collections/persistent-debt/resilience state where implemented;
- required evidence is sufficiently complete;
- Application Readiness is `ready_to_check`;
- genuine cooldown/reassessment conditions have been met;
- no unresolved suppression condition;
- required disclosures are current;
- customer explicitly chooses to continue;
- route/partner/environment kill switches permit the action;
- the applicable regulatory operating-model gate permits live handoff.

Passport improvement may be shown as evidence of progress, but a fixed number of green Passport pillars or missions completed must never substitute for the deterministic Readiness gate.

### 7.4 Customer-facing return language

Use wording such as:

> “You’ve made the progress we were waiting for. Based on the information we have, you’re ready to check eligibility again.”

Buttons may include:

- **Continue with [Original Partner]**
- later, where independently permitted: **See other eligibility options**

Never use:

- “You’ll now be approved”;
- “You now qualify”;
- “Your lender will accept you.”

### 7.5 Return modes

Support two return modes.

#### A. Customer redirect

The customer actively selects Continue. Credit Quest creates an auditable return event and redirects only to the partner's pre-approved destination.

#### B. Server-to-server callback

Where contract, transparency and lawful basis permit, Credit Quest may send the partner a narrow status event such as:

`recovery_ready_for_recheck`

The default callback should contain only the minimum necessary identifiers/status and must not include detailed Passport, mission or vulnerability information.

### 7.6 Data not returned by default

Do not return by default:

- health/support details;
- vulnerability category;
- detailed Credit Passport factors;
- individual mission history;
- internal barrier reasoning;
- raw profile evidence;
- an approval probability.

Any expanded sharing requires a separately justified data-sharing purpose, contract, transparency and consent/lawful-basis review.

## 8. Inbound and outbound gateway separation

V2.0d must introduce a separate **Partner Decline Intake** trust boundary rather than reusing the existing outbound commercial referral record as if the two were the same thing.

Conceptually:

```text
INBOUND
Partner
  -> Partner Decline Intake
  -> customer transparency/consent
  -> Credit Quest evidence/context boundary
  -> independent assessment/recovery

OUTBOUND / RETURN
Independent Credit Quest readiness
  -> Return/Re-entry Gateway
  -> regulatory + consent + disclosure + partner route gates
  -> original partner or another independently permitted route
```

Inbound commercial attribution must remain unavailable to deterministic customer-strategy code paths.

## 9. Persistence model (conceptual)

Implementation planning should define owner-scoped/RLS-protected records along these lines:

### 9.1 `decline_intake_sessions`

- id;
- partner_id;
- pseudonymous origin reference;
- product category;
- declined_at;
- partner-provided reason code/source;
- environment;
- token hash/state/expiry;
- created/consumed timestamps;
- idempotency key;
- return_contract reference;
- provenance metadata with a strict allowlist.

### 9.2 `decline_recovery_journeys`

- owner/user id derived server-side;
- intake/direct-entry origin;
- journey state;
- started/reassessed/completed timestamps;
- associated coherent assessment run;
- current recovery milestone;
- return eligibility state;
- no partner economics used as strategy input.

### 9.3 `support_needs`

- owner/user id derived server-side;
- functional support need code;
- source;
- customer confirmation state;
- consent/lawful-basis metadata where required;
- effective/review/expiry dates;
- minimal free text only if explicitly justified;
- restricted access/audit controls.

### 9.4 `return_contracts`

Server-owned partner configuration with approved destinations, callback behavior, expiry, environment and kill switches.

### 9.5 `return_attempts`

Auditable customer-controlled attempts/callbacks including readiness snapshot reference, disclosure state and outcome.

## 10. Security and abuse controls

Required controls include:

- signed/authenticated partner requests;
- one-time tokens;
- replay protection;
- strict payload schemas;
- no arbitrary browser return URLs;
- HTTPS-only live destinations;
- sandbox/live isolation;
- partner-specific kill switches;
- per-partner rate limits;
- idempotency;
- immutable provenance of partner-provided context;
- server-owned user binding;
- RLS/owner isolation;
- least-privilege service access;
- sensitive-field minimisation;
- security logging without dumping sensitive payloads;
- explicit environment gating;
- no live regulated handoff until the FCA operating-model gate is cleared.

## 11. Regulatory and privacy gates

### 11.1 FCA

V2.0d decline recovery can be built and tested without enabling live regulated lender referrals.

Before live return-to-origin or other regulated credit-product handoffs, complete the existing FCA operating-model gate covering the actual customer journey, disclosures, financial promotions, Consumer Duty, complaints/support and AR/IAR/direct-authorisation model as applicable.

### 11.2 Vulnerable customers

Design and testing must align with FCA vulnerable-customer expectations and Consumer Duty outcomes. Support adaptations should help customers with characteristics of vulnerability receive appropriate outcomes and should be monitored by cohort for worse outcomes or foreseeable harm.

### 11.3 UK GDPR / DPA 2018

Where health or other special-category data is processed, document the Article 6 basis and Article 9 condition before processing begins, plus any associated DPA 2018 requirements. Complete a DPIA where the processing is likely to be high risk.

### 11.4 Source references for compliance review

- FCA FG21/1, Guidance for firms on the fair treatment of vulnerable customers: https://www.fca.org.uk/publications/finalised-guidance/guidance-firms-fair-treatment-vulnerable-customers
- FCA Consumer Duty: https://www.fca.org.uk/firms/consumer-duty
- FCA Credit Broking perimeter / CONC / PERG sources already tracked in issue #17
- ICO special-category data guidance: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/

These sources guide product design but do not replace formal regulatory/legal advice for the live operating model.

## 12. Analytics and partner reporting

### 12.1 Customer/product events

Track at minimum:

- decline recovery started;
- partner decline intake redeemed;
- context reviewed/confirmed/corrected;
- support check offered/completed/skipped;
- support adaptation applied;
- recovery mission started/completed;
- reassessment due/completed;
- readiness changed;
- recovery ready for recheck;
- Return-to-Origin offered;
- Return-to-Origin accepted/declined;
- return attempt created;
- partner callback sent/acknowledged;
- subsequent known eligibility/application outcome where lawfully and contractually available;
- suppression reason.

### 12.2 Partner dashboard

Initial partner reporting should be aggregate/cohort-first, for example:

```text
2,400 declines handed off
1,620 Credit Quest activations
1,080 first recovery actions
620 reassessments
280 reached ready-to-check
210 chose Return-to-Origin
known downstream outcome where available
```

Also measure:

- time to first useful action;
- time to reassessment;
- time to ready-to-check;
- avoided premature/repeat application behavior where measurable;
- D30/D90 retention;
- support/vulnerability outcome differences;
- partner conversion/return rate;
- safety suppression rate;
- complaints/support indicators.

Do not optimise the product purely for Return-to-Origin conversion. A correct result can be “not ready yet” or “focus on support instead.”

## 13. Partner proposition

V2.0d enables a clear B2B2C story:

> **“Don’t lose declined applicants. Give them a safe recovery journey, help them make real progress, and let them return when they are independently ready to check eligibility again.”**

A stronger Consumer Duty/support version is:

> **“Give declined and potentially vulnerable customers a safe, personalised next step rather than leaving them at a dead end.”**

Commercial models to test later include:

- annual platform + usage fee;
- per activated decline-recovery journey;
- 6–12 week paid pilot;
- compliant outcome-linked economics where they cannot distort customer recommendations;
- enterprise implementation/support fees.

## 14. Rollout sequence

V2.0d should be delivered in dark, independently reviewable slices:

1. decline-recovery domain model and fixtures;
2. direct “I’ve just been declined” customer journey;
3. Support Needs Profile and adaptive-support rules;
4. partner intake schema + authentication in sandbox only;
5. token redemption/customer transparency flow;
6. recovery-plan orchestration using existing Quest/Passport/Readiness engines;
7. Return-to-Origin contract and gate in sandbox only;
8. aggregate partner analytics/demo dashboard;
9. security/RLS/privacy hardening and DPIA/compliance evidence;
10. controlled internal sandbox pilot;
11. partner demo/pilot integration with live regulated routing still OFF unless issue #17 is fully cleared;
12. live partner rollout only through explicit production authorization and kill-switch controls.

No production pilot membership, live credit referral, live Return-to-Origin or partner campaign is activated merely by merging this work.

## 15. Testing strategy

### 15.1 Unit/domain

- partner decline context never becomes diagnosis without independent evidence;
- direct decline without known reason remains unknown;
- recovery hierarchy respects crisis/stability/rebuilding priorities;
- support need does not automatically imply Safe Mode;
- Safe Mode overrides Return-to-Origin;
- `ready_to_check` required for product re-entry;
- mission count/Passport colour alone cannot unlock return;
- expired/cooldown evidence blocks early return;
- vulnerability data unavailable to partner/commercial ordering;
- under-18 product return suppressed;
- partner economics unavailable to assessment/ranking.

### 15.2 Partner/API

- valid signed request accepted;
- invalid signature rejected;
- replay rejected;
- duplicate idempotency key safe;
- token expires and is one-use;
- raw PII not required in redirect URL;
- partner A cannot redeem/query partner B sessions;
- arbitrary return URL rejected;
- disabled partner fails closed;
- sandbox cannot become live via payload manipulation.

### 15.3 E2E personas

- standard decline -> recovery -> ready-to-check -> voluntary return;
- decline with unknown reason;
- partner-supplied reason that conflicts with customer evidence;
- customer corrects partner context;
- recent repeated applications/cooldown;
- Safe Mode customer receives support and no return route;
- vulnerability support need without Safe Mode;
- bereavement/life-event adaptive journey;
- low digital confidence/simple mode;
- under-18 attempted partner handoff;
- return contract expired;
- partner disabled after intake;
- customer declines return and remains in Credit Quest;
- second decline after return without inventing cause.

## 16. Acceptance criteria

V2.0d is complete only when:

- direct and partner-originated decline journeys both work;
- partner intake uses authenticated server-to-server exchange and one-time opaque handoff;
- customers can see the source/context of partner-provided information;
- partner decline reason remains context rather than unquestioned Credit Quest truth;
- recovery plans are explainable and use real evidence/reassessment dates;
- vulnerability/support is represented through a structured Support Needs Profile;
- functional adaptations can be applied without automatically entering Safe Mode;
- special-category data handling has documented lawful-basis/Article 9/privacy controls where applicable;
- Credit Quest can return a customer to the original journey only after independent `ready_to_check` and all other applicable gates pass;
- the return URL/configuration is server-owned and allowlisted;
- the customer controls whether to return;
- default partner callback data is minimal and does not disclose Passport/vulnerability detail;
- inbound partner context and outbound commercial economics remain isolated from customer strategy;
- aggregate partner recovery analytics exist;
- canonical unit/API/E2E/RLS/security tests pass;
- sandbox and live partner routing remain independently kill-switchable;
- no live regulated handoff is possible until the FCA operating-model gate is explicitly cleared.

## 17. Roadmap positioning

The roadmap should now treat V2.0d as:

### **V2.0d — Closed-Loop Decline Recovery**

**Four pillars:**

1. Decline Recovery
2. Secure Partner Decline Intake
3. Customer Vulnerability & Support
4. Return-to-Origin / Re-entry Gateway

This is the main bridge between the Help + Fun Core and Credit Quest's institutional proposition.

V2.1 then measures and commercialises the complete lifecycle in sandbox-first fashion. V2.2 turns the closed-loop decline capability into partner pilots, co-branded journeys, dashboards and broader institutional distribution.

## 18. Product north star after V2.0d

Credit Quest becomes the trusted layer between a failed credit application and a safer next attempt:

> **Understand the decline without inventing reasons. Help the customer recover. Adapt support to their needs. Prove real progress. Return them only when they are ready to check again.**
