# V2.0d data-protection gate

## Status

V2.0d closed-loop decline recovery is approved only for the deliberately minimised data model implemented in this release. Detailed health, medical-condition, diagnosis or other special category capture is **out of scope** and must not be added to production intake, support, analytics, partner callbacks or customer-strategy logic without a separate data-protection decision.

This gate is a release boundary, not a legal conclusion that future special-category processing is permissible.

## Current V2.0d data model

Credit Quest currently captures only functional support preferences such as simpler explanations, larger text, fewer steps, more time, reduced motion, reminder support, human support or digital support. Customers do not need to tell Credit Quest why they want an adaptation.

A partner may provide only a broad `additionalSupportMayBeNeeded` signal. That signal is not a diagnosis, is not treated as health data by design, does not automatically create a Support Need, and does not automatically trigger Safe Mode, readiness changes, mission changes or commercial suppression. Any customer support preference remains customer-controlled and functional.

Partner decline context is attributed context, not Credit Quest diagnosis. Recovery analytics are aggregate/operational and exclude Support Needs, vulnerability detail and customer identifiers from partner-demo reporting.

## Gate for any future detailed health or special category processing

Before Credit Quest intentionally collects, infers, stores, uses or shares detailed health data or another special category of personal data, the following must be completed and approved:

1. **Purpose and necessity** — define the specific purpose and show why the same outcome cannot reasonably be achieved with less intrusive functional support data.
2. **Article 6** — identify and document a lawful basis under Article 6 of the UK GDPR.
3. **Article 9** — identify and document a separate Article 9 condition for processing special category data. An Article 6 basis alone is not sufficient.
4. **Data Protection Act 2018** — where the chosen Article 9 condition requires it, identify the applicable Data Protection Act 2018 Schedule 1 condition and implement any required safeguards, including an appropriate policy document where applicable.
5. **DPIA** — complete and approve a data protection impact assessment (DPIA) before processing where the proposed processing is likely to result in high risk. Given the sensitivity and potential use in profiling/decision flows, the DPIA question must be resolved explicitly rather than assumed away.
6. **Automated decision boundary** — separately assess any UK GDPR Article 22 implications before special category data could influence automated decisions or profiling with legal or similarly significant effects.
7. **Minimisation and retention** — specify the minimum fields, retention period, deletion process, access controls, audit trail and data-subject rights workflow.
8. **Transparency and consent/choice** — update privacy information and customer-facing explanations so the processing is clear, specific and not bundled into unrelated product or referral consent.
9. **Partner controls** — update contracts, schemas and callback allowlists so partners cannot send or receive unapproved special category detail.
10. **Security and release approval** — threat-model the new data path, add RLS/integration tests, complete security review and obtain an explicit production release decision.

Until every applicable item above is satisfied, detailed health and special category processing remains **out of scope**.

## Non-negotiable product boundaries

- Functional support choices do not automatically alter Safe Mode, diagnosis, Passport, readiness, Quest Score or mission ranking.
- Support or vulnerability information must never be used as a commercial-ranking signal.
- Partner economics must never influence support treatment or recovery strategy.
- No detailed health or vulnerability content is included in Return-to-Origin callbacks by default.
- The browser cannot supply trusted partner identity, return environment or return destination.
- Live Return-to-Origin and live regulated referrals remain separate release decisions.

## Reference guidance

The release gate reflects current ICO guidance that special category processing requires both an Article 6 lawful basis and an Article 9 condition, with additional Data Protection Act 2018 Schedule 1 requirements for some conditions, and that a DPIA is required for processing likely to be high risk.

- ICO, *Special category data*: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/special-category-data/
- ICO, *What are the rules on special category data?*: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-rules-on-special-category-data/
- Data Protection Act 2018, Schedule 1: https://www.legislation.gov.uk/ukpga/2018/12/schedule/1

Last reviewed for V2.0d release hardening: 2026-09-03.
