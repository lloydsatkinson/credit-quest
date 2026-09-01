# Credit Quest

Credit Quest is a mobile-first UK credit-building and credit-optimisation PWA. It turns a user's profile into one explainable **next best move**, then uses a staged journey — Setup → Stabilise → Build → Optimise → Maintain — to keep progress understandable and actionable.

## V2.0a — Product Integrity

The first incremental V2 release strengthens the decisioning foundation before the larger Credit Passport and Quest Feed experience is introduced.

- Financial onboarding answers are explicit rather than pre-populated with plausible customer values.
- Unknown credit-file answers remain unknown instead of being converted to `0` or `false`.
- Mission **started** and mission **completed** are separate lifecycle states.
- Supported completion effects update the underlying customer profile before the mission engine and Quest Score are recalculated.
- Safe Mode can suppress credit-product offers and borrowing-oriented missions when current profile signals indicate financial pressure.
- Users aged 16–17 remain education-only and receive no credit-product referrals.
- Affiliate commission remains outside mission ranking and safety logic.

## V2.0b — Mission Action Layer Phase 1

Phase 1 makes the current mission catalogue executable without pretending Credit Quest has integrations that do not exist yet.

- Missions resolve to a secure internal, official-government, provider-configured, or controlled referral action.
- The browser supplies a mission-instance ID, never an arbitrary external destination URL; the server resolves and revalidates the destination against the configured provider allowlist.
- Manual **My accounts** supports multiple credit cards/accounts so direct-debit and utilisation missions can target the correct account.
- Account records keep only minimal user-entered data such as provider, optional nickname/last four, balance/limit where relevant, and direct-debit status. Credit Quest does not ask for or store banking passwords or full card numbers.
- When active credit cards are tracked, their account data becomes the effective source for aggregate utilisation, revolving-credit presence and direct-debit coverage. Aggregate utilisation uses total balances divided by total limits; incomplete card data remains unknown rather than being guessed.
- The official electoral-roll journey uses the GOV.UK registration service. Submitting a registration moves the mission to `in_review`; it does **not** immediately set the customer as registered.
- Direct-debit completion updates only the targeted card/account. With several tracked cards, the global direct-debit signal remains incomplete until the tracked cards are protected or their status is known.
- Utilisation actions calculate a planning target where balance and limit are known, but a click or self-confirmation alone does not complete the mission.
- Application cooldown is an internal timed state rather than an external provider action.
- Revolving-history product journeys remain age/Safe-Mode gated, lender-owned and separate from mission ranking. Clicking or applying never auto-completes the mission; a later confirmation that an account was actually opened is required in the Phase 1 fallback flow.
- Pending external actions are resumable when the customer returns to the dashboard, while deferred/review actions stay hidden until their configured review date.
- Completed mission history is retained even after the underlying gap has been resolved.
- Action analytics are best-effort and are written only after the relevant core state change succeeds.

Open Banking, CRA ingestion, payment initiation, lender eligibility APIs, provider scraping and automatic form filling are **not** part of Phase 1. The account/action model is designed so those capabilities can be added later through adapters without rebuilding mission selection.

## V2.1 — Credit Passport, Readiness, Quest Feed & Academy

V2.1 adds the customer-facing guidance layer while preserving deterministic strategy and commercial separation.

- **Credit Passport** explains identity, payment health, debt/headroom, affordability/stability and application-readiness pillars without pretending unknown signals are known.
- **Can I Apply Yet?** gives deterministic red/amber/green/unknown guidance. Green means it may be worth checking eligibility; it is never an approval prediction.
- The dashboard is a finite **7-card Quest Feed**: next move, rationale, Passport, readiness, a contextual **Learn in 20 seconds** Academy card, progress and score education.
- **Credit Quest Academy** is public at `/learn` and `/learn/[slug]`, with reviewed plain-English education powered by a canonical Supabase content store in configured environments.
- Launch Academy content contains 25+ reviewed topics. Material content changes are versioned rather than silently overwriting a live article.
- Under-18 users only receive `under18_safe` Academy content. Safe Mode users only receive `safe_mode_safe` education.
- Academy personalisation is deterministic and downstream of the existing mission/barrier/Passport/readiness outputs. Academy data never changes those upstream engines.
- Academy ranking has no affiliate commission, CPA/CPL, EPC, provider payout, campaign or sponsored-placement input.
- Learning progress and events are best-effort. Tracking failure never blocks Academy reading or the core Credit Quest journey.
- Direct browser writes to Academy content/progress are denied. Authenticated progress writes go through a server route; the Supabase service-role key remains server-only.
- Configured Supabase is the canonical production content source. The small reviewed fixture in `lib/academy/demo-content.ts` is demo/test-only and is not used as a silent fallback when a configured production content read fails.

No CRA, Open Banking or lender eligibility API was added as part of Academy.

## V2.2A — Journey Foundation

V2.2A adds a downstream, auditable customer lifecycle without changing Credit Quest's safety, readiness or mission decisions.

- `journey_state` stores the current lifecycle projection: onboarding, active mission, waiting, cooldown, reassessment due, ready or optimising.
- `journey_outcomes` is append-only application history for meaningful events such as onboarding completion, mission/action outcomes and reassessment results. Duplicate source keys are idempotent.
- Journey observes successful core writes **after** they happen. Journey persistence failure cannot invalidate a valid onboarding, mission or Action Layer result.
- Scheduled reassessment re-runs the existing deterministic guidance from current evidence; Journey does not create an alternative readiness model.
- Unknown readiness remains unknown and a lack of evidence is never presented as improvement.
- The dashboard shows a compact **Journey update** explaining what changed and what happens next. It sits outside the finite Quest Feed, which remains exactly seven cards.
- Core strategy modules cannot import Journey or commercial/revenue concepts; tests enforce the one-way dependency boundary.
- Migration `009_journey_foundation.sql` is additive and remains release-gated until compatible application code is approved for deployment.

## V2.2B — Retention & Service Email

V2.2B adds deterministic journey reminders without allowing retention or commercial logic to influence customer strategy.

- Reminder reason, timing and channel eligibility are derived from Journey outcomes by deterministic rules. In-app reminders are capped at three and sit outside the seven-card Quest Feed.
- Journey email is explicit opt-in only. `journey_email_enabled` defaults false; a missing or unreadable preference suppresses email rather than assuming consent.
- `email_reminders_enabled` is a private server-owned runtime switch seeded **OFF**. It is re-checked after jobs are claimed so disabling it suppresses unsent work immediately.
- `commercial_gateway_enabled` is also seeded **OFF** for the later V2.2C control plane; V2.2B does not activate commercial referrals.
- The protected `/api/cron/journey-reminders` job runs daily at 08:00 UTC when deployed with a scheduler, but sends nothing while the runtime flag is disabled.
- Recipient email addresses are resolved at send time from Supabase Auth Admin and are not duplicated into reminder tables.
- Email delivery is provider-adapted through `EmailTransport`; the Resend adapter returns controlled failure codes and bounded retries. Missing provider configuration fails closed.
- Static reviewed service copy is the production fallback. No AI or paid copy-generation dependency is required or activated.
- Service reminders are not marketing. Journey-email preference does not imply referral consent or marketing consent, and referral consent does not imply journey-email consent.
- Under-18 and Safe Mode wording remains protective, and reminder/email failures cannot change readiness, mission state, Journey state or customer ranking.

## V2.2C — Commercial Gateway & Admin Control Plane

V2.2C adds a deliberately dark commercial control plane downstream of existing Credit Quest guidance.

- Commercial presentation is permitted only after the existing guidance has been computed. Commercial economics never feed safety, diagnosis, Passport, readiness, Quest Score, mission ranking, Academy selection, Journey or reminder timing.
- Under-18 users, Safe Mode users, red/amber/unknown readiness and incomplete required evidence receive no commercial route. Unknown revolving-credit evidence is independently fail-closed even if another layer were to report green readiness.
- Configured product journeys go through the server-side Commercial Gateway. The browser cannot submit a destination URL, user ID, readiness state, safety state, age gate, commission or payout value.
- Listing an eligible disclosure does not imply consent. Referral creation requires explicit consent, re-fetches current guidance/route/disclosure, re-runs all current gates, inserts auditable provenance first and only then returns a server-owned destination.
- The V2.2 release ships with `commercial_gateway_enabled=false` and `LIVE_CREDIT_REFERRALS_ALLOWED=false`. The initial seeded route is sandbox-only and disabled. No lender or live credit application is contacted by the sandbox completion path.
- Demo product cards are informational and do not navigate to affiliate URLs. The Quest Feed remains exactly seven cards.
- Commercial/admin tables are private to the service role. Referral and revenue history are append-only for updates while authorised erasure remains possible through controlled service-role deletion.
- Admin mutations use audited, allowlisted RPCs. Route safety requirements remain server-owned (`min_age >= 18`, `required_readiness = green`) and cannot be overridden by the admin UI.
- Admin access requires normal authenticated identity **and** an exact matching row in `admin_members`. There is no self-promotion endpoint, role cookie/header shortcut, arbitrary SQL console, customer impersonation control, readiness-threshold editor or mission-priority editor.
- Admin membership is bootstrapped only by an authorised operator after identifying the exact existing `auth.users.id`, then inserting that ID into `admin_members` using trusted Supabase admin/SQL tooling.
- Enabling live regulated referrals requires a separate regulatory/FCA operating-model decision and a separate release; changing a database flag alone is insufficient because the independent server environment lock must also be explicitly changed.

## V2.2D — Analytics & Release Hardening

V2.2D adds observational analytics and release controls without giving analytics, experiments or revenue any authority over customer strategy.

- The V2.2 analytics taxonomy records Journey status/reassessment/readiness movement, reminder exposure and service-email outcomes, commercial-route exposure/consent, sandbox referrals and experiment exposure. Event writes remain best-effort and cannot block the customer journey.
- Operational metrics use bounded, read-only downstream queries. If a required source cannot be read, the admin view reports metrics as unavailable rather than inventing zero activity.
- Customer progress is presented before commercial reporting. **Revenue is reporting only — it does not affect customer strategy.**
- Experiments are restricted to exactly three presentation surfaces: `commercial_route_order`, `journey_status_copy` and `journey_email_opt_in_copy`. Each surface has an allowlisted set of presentation keys; arbitrary scripts, eligibility rules and free-form commercial weighting are not accepted.
- Commercial presentation experiments receive only the route set already permitted by the Commercial Gateway. They can change presentation order only and cannot add a route, bypass age/Safe Mode/readiness/evidence gates or introduce an unpermitted destination.
- Exposure telemetry carries stable IDs/keys and controlled bands/reasons only. It does not send commercial economics, lender underwriting payloads, credentials, full card data or service secrets.
- Architecture tests enforce that Journey, reminders, commercial data, experiments, metrics, affiliate/revenue concepts and feature flags do not flow upstream into safety, diagnosis, Passport, readiness, Quest Score, mission ranking or Academy selection.
- The final release remains dark-first. Compatible application code is verified before migrations `009` → `010` → `011`, and the base release defaults remain:

```text
email_reminders_enabled=false
commercial_gateway_enabled=false
LIVE_CREDIT_REFERRALS_ALLOWED=false
```

No V2.2 production migration, live referral activation or email activation is implied by passing the build. Merge/deployment and production DDL remain separate release-gated actions.

## Product boundaries

- Available from age 16.
- Ages 16–17 use education mode and receive **no credit-product referrals**.
- Ages 18+ may receive relevant partner referrals only after all applicable commercial presentation/referral gates pass; V2.2 ships those runtime paths dark.
- The **Credit Quest Score** is an internal progress indicator. It is not an Experian, Equifax or TransUnion score and does not predict lender approval.
- Credit Quest is an enhanced introducer: lenders own eligibility, underwriting and the credit application.
- Affiliate commission is never used by the mission-ranking engine or Academy selector.
- Starting an action, clicking an outbound link or submitting a third-party form is not treated as proof that a mission is complete unless the mission's verification rules support that conclusion.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Auth + Postgres + Row Level Security
- Zod validation
- Vitest + Testing Library
- Playwright
- Web app manifest + service worker for PWA behaviour

## Local setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Without Supabase environment variables the app runs in **demo mode**, using browser-local state so the journey can be reviewed without a backend account. Academy uses its small reviewed demo fixture only in this unconfigured mode.

## Environment variables

Copy `.env.example` to `.env.local` and provide the settings required by the environment:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=
CRON_SECRET=
RESEND_API_KEY=
JOURNEY_FROM_EMAIL=
LIVE_CREDIT_REFERRALS_ALLOWED=false
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. It must never be exposed with a `NEXT_PUBLIC_` prefix or imported into client components. `NEXT_PUBLIC_SITE_URL` is an optional canonical-site override used for metadata/sitemap generation.

`CRON_SECRET`, `RESEND_API_KEY` and `JOURNEY_FROM_EMAIL` are server-only V2.2B settings. Supplying them does **not** enable email by itself: the database runtime flag `email_reminders_enabled` remains the kill switch and is seeded false. Do not put these values in client code or commit real secrets.

`LIVE_CREDIT_REFERRALS_ALLOWED` is a server-only hard lock. V2.2 production default is `false`. `commercial_gateway_enabled` is separately seeded false in the database, so compatible code can be deployed without making a live regulated referral path available.

## Supabase local setup

Install the Supabase CLI, then run:

```bash
npx supabase start
npx supabase db reset
```

Migrations:

- `supabase/migrations/001_initial_schema.sql` — base schema.
- `supabase/migrations/002_v2_product_integrity.sql` — V2.0a lifecycle/product-integrity changes.
- `supabase/migrations/003_action_layer.sql` — backward-compatible additive expansion: providers, manual accounts, mission-instance IDs/subjects, action registry, action attempts and Action Layer RLS while retaining the legacy mission primary key for the then-deployed app.
- `supabase/migrations/004_action_layer_mission_key_cutover.sql` — post-deploy key cutover from `(user_id, mission_slug)` to mission-instance `id`, enabling separate account-scoped instances of the same mission.
- `supabase/migrations/005_action_layer_owner_integrity.sql` — same-owner composite foreign keys, one-open-attempt enforcement, covering indexes for new foreign keys, and optimised owner-RLS evaluation for the Action Layer tables.
- `supabase/migrations/006_v2_0b_closeout.sql` — closes the V2.0b migration sequence and integrity boundary.
- `supabase/migrations/007_academy.sql` — versioned Academy articles, private learning progress, RLS, indexes and service-role-only atomic publication.
- `supabase/migrations/008_academy_launch_content.sql` — reviewed V2.1 Academy launch curriculum.
- `supabase/migrations/009_journey_foundation.sql` — V2.2A Journey lifecycle projection, append-only outcome history, owner-readable RLS and deterministic reassessment indexing.
- `supabase/migrations/010_retention_runtime_flags.sql` — V2.2B reminder jobs, owner-readable communication preferences, private default-off runtime flags and service-role-only atomic email claiming.
- `supabase/migrations/011_commercial_admin.sql` — V2.2C private commercial/admin control plane, sandbox-only seed, append-only referral/revenue update protection, audited admin RPCs and service-role-only access.

The Action Layer rollout used staged expand/deploy/cutover migrations. Academy is additive: content can be versioned and published through the database workflow without requiring an application redeployment for ordinary editorial changes. V2.2 migrations are also additive but remain dark/release-gated until compatible application code has passed the V2.2 release checks.

RLS and owner-integrity verification guidance is in `supabase/tests/rls.sql`. V2.2B retention-specific policy, RPC and duplicate-job probes are in `supabase/tests/retention_rls.sql`; V2.2C commercial/admin probes are in `supabase/tests/commercial_rls.sql`. CI executes the applicable probes against the same disposable database.

## Verification

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
```

The repository CI workflow runs the same audit/lint/unit/E2E/build gates for `main` and pull requests. It also starts a disposable local Supabase database inside GitHub Actions, applies every migration, runs the RLS/security SQL probes, and destroys that local database. This verifies migrations/RLS without creating a Supabase preview branch or touching production.

Production includes the approved V2.1 Academy migrations `007` and `008`. V2.2 migrations `009`, `010` and `011` are verified in disposable CI on the feature branch and are **not** applied to production until compatible V2.2 application code is verified and the release gate is explicitly approved. The dark-first order is compatible application code first, then additive migrations `009` → `010` → `011`, while `email_reminders_enabled=false`, `commercial_gateway_enabled=false` and `LIVE_CREDIT_REFERRALS_ALLOWED=false` remain in force.

After applying migrations in a target Supabase project, run the project's security/performance advisors as an additional check; local database verification is not a substitute for a post-deployment advisor check.

## Core architecture

The decision flow remains intentionally one-way:

```text
profile + minimal account state
  ↓
account-derived effective signals when cards are tracked
  ↓
safety assessment
  ↓
barrier diagnosis + Credit Passport + Application Readiness
  ↓
Credit Quest Score + deterministic mission eligibility/ranking
  ↓
target-aware next-best mission instance
  ↓
Academy selector (education only, downstream)
  ↓
server-side Action Registry resolution for executable actions
  ↓
internal / official / provider / referral action
  ↓
return + verification/self-confirmation rules
  ↓
Journey observation + outcome history + scheduled reassessment (downstream only)
  ↓
deterministic reminder scheduling + static service copy (downstream only)
  ↓
Commercial Gateway presentation/referral gate (downstream only, dark by default)
```

Commercial offer, partner, experiment and revenue data never flows back into safety, diagnosis, Passport, readiness, mission ranking, Academy selection, Journey-derived customer strategy or reminder timing. Journey/reminders/commercial layers observe governed outputs; they do not feed commercial data back upstream.

## Provider and affiliate data

The provider directory contains real UK issuer/bank names solely so a user can identify the account they already hold and, where a stable official support route has been verified, be sent to that provider's own public help journey. Listing a provider does **not** imply a commercial partnership, API integration, endorsement or data connection.

Affiliate/product records committed for demonstration remain fictional unless explicitly replaced through an approved provider/network relationship. Demo interfaces do not navigate to those affiliate URLs. The GOV.UK electoral-roll destination is an intentionally configured official government route, not a partner integration.

## Future extension points

The V2 architecture is designed for later additions including Decline Recovery, Open Banking, CRA data, lender eligibility APIs, Product Fit, premium scenario analysis, richer mission coverage and an AI coach. External data should be normalised into the structured profile/account model before deterministic decision engines consume it. AI may explain or simplify approved guidance, but it must not invent lender criteria or decide creditworthiness.

## Design and implementation docs

- `docs/superpowers/specs/2026-08-25-credit-quest-v1-design.md`
- `docs/superpowers/plans/2026-08-25-credit-quest-v1-implementation.md`
- `docs/superpowers/specs/2026-08-26-credit-quest-v2-design.md`
- `docs/superpowers/plans/2026-08-26-credit-quest-v2-0a-product-integrity.md`
- `docs/superpowers/specs/2026-08-26-credit-quest-action-layer-phase-1-design.md`
- `docs/superpowers/plans/2026-08-26-credit-quest-action-layer-phase-1-implementation.md`
- `docs/superpowers/specs/2026-08-27-credit-passport-readiness-design.md`
- `docs/superpowers/plans/2026-08-27-credit-passport-readiness-implementation.md`
- `docs/superpowers/specs/2026-08-28-credit-quest-academy-design.md`
- `docs/superpowers/plans/2026-08-28-credit-quest-academy-implementation.md`
- `docs/superpowers/specs/2026-08-29-credit-quest-v2-2-journey-growth-design.md`
- `docs/superpowers/plans/2026-08-29-credit-quest-v2-2a-journey-foundation.md`
- `docs/superpowers/plans/2026-08-29-credit-quest-v2-2b-retention-email.md`
- `docs/superpowers/plans/2026-08-29-credit-quest-v2-2c-commercial-admin.md`
- `docs/superpowers/plans/2026-08-29-credit-quest-v2-2d-analytics-release.md`