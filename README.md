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

Later V2 releases will add Barrier Diagnosis, Credit Passport, Application Readiness / **Can I Apply Yet?**, the TikTok-inspired vertical Quest Feed, Decline Recovery, richer mission coverage and external-data integrations. Those features are not claimed as shipped in V2.0a.

## Product boundaries

- Available from age 16.
- Ages 16–17 use education mode and receive **no credit-product referrals**.
- Ages 18+ may receive relevant partner referrals after the mission engine has already selected the user's next-best action.
- The **Credit Quest Score** is an internal progress indicator. It is not an Experian, Equifax or TransUnion score and does not predict lender approval.
- Credit Quest is an enhanced introducer: lenders own eligibility, underwriting and the credit application.
- Affiliate commission is never used by the mission-ranking engine.

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

Copy `.env.example` to `.env.local` and provide:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

The service-role key must stay server-side and must never be exposed with a `NEXT_PUBLIC_` prefix.

## Supabase local setup

Install the Supabase CLI, then run:

```bash
npx supabase start
npx supabase db reset
```

The base migration is at `supabase/migrations/001_initial_schema.sql`. V2.0a adds `supabase/migrations/002_v2_product_integrity.sql`. RLS verification guidance is in `supabase/tests/rls.sql`.

## Verification

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
```

## Core architecture

The decision flow is intentionally one-way:

```text
profile
  ↓
safety assessment
  ↓
Credit Quest Score + mission eligibility/ranking
  ↓
next-best mission
  ↓
offer matching (optional, age-gated and safety-gated)
```

Offer data never flows back into safety or mission ranking. This keeps user benefit separate from commercial value.

## Demo affiliate data

All provider and affiliate records committed to source control are fictional demonstration data. Replace them only with properly approved provider/network relationships and compliant disclosure copy before any public launch.

## Future extension points

The V2 architecture is designed for later additions including Barrier Diagnosis, Credit Passport, Application Readiness, the vertical Quest Feed, Decline Recovery, Open Banking, CRA data, lender eligibility APIs, Product Fit, premium scenario analysis and an AI coach. External data should be normalised into the structured profile before deterministic decision engines consume it.

## Design and implementation docs

- `docs/superpowers/specs/2026-08-25-credit-quest-v1-design.md`
- `docs/superpowers/plans/2026-08-25-credit-quest-v1-implementation.md`
- `docs/superpowers/specs/2026-08-26-credit-quest-v2-design.md`
- `docs/superpowers/plans/2026-08-26-credit-quest-v2-0a-product-integrity.md`
