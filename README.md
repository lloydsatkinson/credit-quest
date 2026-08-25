# Credit Quest

Credit Quest is a mobile-first UK credit-building and credit-optimisation PWA. It turns a user's profile into one explainable **next best move**, then uses a staged journey — Setup → Stabilise → Build → Optimise → Maintain — to keep progress understandable and actionable.

## V1 product boundaries

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

Without Supabase environment variables the app runs in **demo mode**, using browser-local state so the V1 journey can be reviewed without a backend account.

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

The initial migration is at `supabase/migrations/001_initial_schema.sql`. RLS verification guidance is in `supabase/tests/rls.sql`.

## Verification

```bash
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
Credit Quest Score + mission eligibility/ranking
  ↓
next-best mission
  ↓
offer matching (optional, age-gated)
```

Offer data never flows back into mission ranking. This keeps user benefit separate from commercial value.

## Demo affiliate data

All provider and affiliate records committed to source control are fictional demonstration data. Replace them only with properly approved provider/network relationships and compliant disclosure copy before any public launch.

## Future extension points

The V1 data/domain boundaries are designed for later additions including Open Banking, CRA data, lender eligibility APIs, richer alerting, premium scenario analysis and an AI coach. External data should be normalised into the structured profile before the deterministic mission engine consumes it.

## Design and implementation docs

- `docs/superpowers/specs/2026-08-25-credit-quest-v1-design.md`
- `docs/superpowers/plans/2026-08-25-credit-quest-v1-implementation.md`
