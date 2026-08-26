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
- The official electoral-roll journey uses the GOV.UK registration service. Submitting a registration moves the mission to `in_review`; it does **not** immediately set the customer as registered.
- Direct-debit completion updates only the targeted card/account.
- Utilisation actions calculate a planning target where balance and limit are known, but a click or self-confirmation alone does not complete the mission.
- Application cooldown is an internal timed state rather than an external provider action.
- Revolving-history product journeys remain age/Safe-Mode gated, lender-owned and separate from mission ranking. Clicking or applying never auto-completes the mission.
- Pending external actions are resumable when the customer returns to the dashboard.
- Action analytics are best-effort and are written only after the relevant core state change succeeds.

Open Banking, CRA ingestion, payment initiation, lender eligibility APIs, provider scraping and automatic form filling are **not** part of Phase 1. The account/action model is designed so those capabilities can be added later through adapters without rebuilding mission selection.

Later V2 releases will add Barrier Diagnosis, Credit Passport, Application Readiness / **Can I Apply Yet?**, the TikTok-inspired vertical Quest Feed, Decline Recovery, richer mission coverage and external-data integrations. Those features are not claimed as shipped here.

## Product boundaries

- Available from age 16.
- Ages 16–17 use education mode and receive **no credit-product referrals**.
- Ages 18+ may receive relevant partner referrals after the mission engine has already selected the user's next-best action.
- The **Credit Quest Score** is an internal progress indicator. It is not an Experian, Equifax or TransUnion score and does not predict lender approval.
- Credit Quest is an enhanced introducer: lenders own eligibility, underwriting and the credit application.
- Affiliate commission is never used by the mission-ranking engine.
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

Without Supabase environment variables the app runs in **demo mode**, using browser-local state so the journey can be reviewed without a backend account.

## Environment variables

Copy `.env.example` to `.env.local` and provide the public Supabase project settings used by the web application:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Any service-role or admin credential used for database administration must remain server/admin-side and must never be exposed with a `NEXT_PUBLIC_` prefix.

## Supabase local setup

Install the Supabase CLI, then run:

```bash
npx supabase start
npx supabase db reset
```

Migrations:

- `supabase/migrations/001_initial_schema.sql` — base schema.
- `supabase/migrations/002_v2_product_integrity.sql` — V2.0a lifecycle/product-integrity changes.
- `supabase/migrations/003_action_layer.sql` — providers, manual accounts, target-aware mission instances, action registry, action attempts and Action Layer RLS.

RLS verification guidance is in `supabase/tests/rls.sql`.

## Verification

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
```

The repository CI workflow runs the same audit/lint/unit/E2E/build gates for `main`, pull requests and the active Action Layer feature branch.

## Core architecture

The decision flow remains intentionally one-way:

```text
profile + minimal account state
  ↓
safety assessment
  ↓
Credit Quest Score + deterministic mission eligibility/ranking
  ↓
target-aware next-best mission instance
  ↓
server-side Action Registry resolution
  ↓
internal / official / provider / referral action
  ↓
return + verification/self-confirmation rules
```

Commercial offer data never flows back into safety, mission ranking or Action Registry priority. This keeps user benefit separate from commercial value.

## Demo and configured provider data

Commercial provider and affiliate records committed for demonstration remain fictional unless explicitly replaced through an approved provider/network relationship. The GOV.UK electoral-roll destination is an intentionally configured official government route, not a fictional partner integration.

## Future extension points

The V2 architecture is designed for later additions including Barrier Diagnosis, Credit Passport, Application Readiness, the vertical Quest Feed, Decline Recovery, Open Banking, CRA data, lender eligibility APIs, Product Fit, premium scenario analysis and an AI coach. External data should be normalised into the structured profile/account model before deterministic decision engines consume it.

## Design and implementation docs

- `docs/superpowers/specs/2026-08-25-credit-quest-v1-design.md`
- `docs/superpowers/plans/2026-08-25-credit-quest-v1-implementation.md`
- `docs/superpowers/specs/2026-08-26-credit-quest-v2-design.md`
- `docs/superpowers/plans/2026-08-26-credit-quest-v2-0a-product-integrity.md`
- `docs/superpowers/specs/2026-08-26-credit-quest-action-layer-phase-1-design.md`
- `docs/superpowers/plans/2026-08-26-credit-quest-action-layer-phase-1-implementation.md`
