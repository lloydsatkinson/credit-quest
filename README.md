# Credit Quest

Gamified UK credit-building and credit-optimisation platform.

## V1

Credit Quest gives users a personalised, explainable "next best move" while presenting progress as a simple mission journey: Setup → Stabilise → Build → Optimise → Maintain.

- 16–17: education mode only; no credit-product referrals.
- 18+: responsible optimisation guidance with clearly disclosed, mission-relevant partner links.
- Credit Quest Score is an internal progress indicator, not a bureau score or approval prediction.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Supabase is optional for the demo UI. Add project values to `.env.local` to enable persisted auth/data flows when configured.

## Verification

```bash
npm run lint
npm test
npm run build
```

See `docs/superpowers/specs/2026-08-25-credit-quest-v1-design.md` and `docs/superpowers/plans/2026-08-25-credit-quest-v1-implementation.md` for the approved product design and build plan.
