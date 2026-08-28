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

## Product boundaries

- Available from age 16.
- Ages 16–17 use education mode and receive **no credit-product referrals**.
- Ages 18+ may receive relevant partner referrals after the mission engine has already selected the user's next-best action.
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
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. It must never be exposed with a `NEXT_PUBLIC_` prefix or imported into client components. `NEXT_PUBLIC_SITE_URL` is an optional canonical-site override used for metadata/sitemap generation.

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

The Action Layer rollout used staged expand/deploy/cutover migrations. Academy is additive: apply `007` and `008`, verify RLS/content invariants, then deploy/enable the Academy surfaces. Content can subsequently be versioned and published through the database workflow without requiring an application redeployment for ordinary editorial changes.

RLS and owner-integrity verification guidance is in `supabase/tests/rls.sql`.

## Verification

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
```

The repository CI workflow runs the same audit/lint/unit/E2E/build gates for `main` and pull requests. It also starts a **disposable local Supabase database inside GitHub Actions**, applies every migration, runs `supabase/tests/rls.sql`, and then destroys that local database. This verifies Academy migration/RLS/publication behaviour without requiring a paid Supabase preview branch or touching production.

For database verification, reset a local Supabase project and run `supabase/tests/rls.sql` before applying production DDL. After applying migrations in a target Supabase project, run the project's security/performance advisors as an additional check; source-text tests are not a substitute for live RLS verification.

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
```

Commercial offer data never flows back into safety, diagnosis, Passport, readiness, mission ranking or Academy selection. This keeps user benefit separate from commercial value.

## Provider and affiliate data

The provider directory contains real UK issuer/bank names solely so a user can identify the account they already hold and, where a stable official support route has been verified, be sent to that provider's own public help journey. Listing a provider does **not** imply a commercial partnership, API integration, endorsement or data connection.

Affiliate/product records committed for demonstration remain fictional unless explicitly replaced through an approved provider/network relationship. The GOV.UK electoral-roll destination is an intentionally configured official government route, not a partner integration.

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
