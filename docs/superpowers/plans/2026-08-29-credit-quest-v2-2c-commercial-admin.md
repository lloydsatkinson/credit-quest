# Credit Quest V2.2C Commercial Gateway & Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete dark commercial control plane: server-side hard gates, sandbox-only referral provenance, versioned disclosures, partner/route configuration, append-only revenue/audit events and a narrow Credit Quest Admin — while production live regulated credit referrals remain technically blocked.

**Architecture:** Add an isolated `lib/commercial` pure gate/ordering domain downstream of existing safety/readiness; all persistence and redirects happen through server-only repositories/routes. Route presentation first applies all protective/configuration gates and lets the customer see the current disclosure. Referral creation re-runs those gates and then requires explicit consent. The browser supplies only stable IDs and consent, never destination URLs or eligibility facts. `feature_flags` from V2.2B controls runtime activation. A second server environment guard keeps live credit referrals impossible until a future explicitly approved regulatory release.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase Auth/Postgres/RLS, Zod 3, Vitest 3, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-29-credit-quest-v2-2-journey-growth-design.md`

**Dependency:** V2.2A and V2.2B complete, including migrations 009/010 and `feature_flags`.

## Global Constraints

- Live regulated credit referrals remain OFF. V2.2 creates sandbox referrals only until a later separately approved regulatory decision changes the explicit server guard.
- `commercial_gateway_enabled` defaults false. Turning it on is necessary but not sufficient for a live route.
- `LIVE_CREDIT_REFERRALS_ALLOWED=false` is a server-only guard. Live route presentation/creation requires both DB flag true and env value exactly `true`; V2.2 rollout never sets it true.
- Under-18, Safe Mode, red/amber/unknown readiness, incomplete required evidence, missing disclosure, disabled partner/route or unavailable config => no route presentation/referral.
- Explicit consent is required at referral creation, after the disclosure has been shown. Consent is **not** required merely to list an otherwise permitted route/disclosure.
- Commercial gating is downstream. Do not modify safety, readiness, mission ranking, Quest Score or Academy selection.
- The known `hasRevolvingCredit === null` readiness edge remains untouched. Commercial Gateway independently requires `hasRevolvingCredit !== null`.
- No lender underwriting criteria, approval odds or inferred lender eligibility.
- No commission/EPC/payout fields in `commercial_routes`; route ordering cannot see revenue economics.
- Multiple equivalent permitted routes use stable `routeKey`, then partner key ordering. Experiments may later vary presentation only within that already-permitted set.
- Browser never supplies arbitrary destination URL, user id, readiness, age, Safe Mode state or revenue amount.
- Existing `lib/domain/offer-matcher.ts` is demo-only after this stage. Configured/authenticated product referrals must go through Commercial Gateway; no production page may bypass it.
- Referral/revenue history is append-only in application semantics: DB rejects UPDATE; clients have no DELETE; service-role DELETE remains possible for deliberate user/account data erasure.
- Every task follows observed RED -> GREEN -> focused commit.

---

## File Map

**Create**
- `lib/commercial/types.ts`
- `lib/commercial/gates.ts`
- `lib/commercial/ordering.ts`
- `lib/server/commercial-repository.ts`
- `lib/server/commercial-gateway.ts`
- `lib/server/admin-auth.ts`
- `lib/server/admin-repository.ts`
- `app/api/commercial/routes/route.ts`
- `app/api/commercial/referrals/route.ts`
- `app/sandbox/referral-complete/page.tsx`
- `app/admin/layout.tsx`
- `app/admin/page.tsx`
- `app/admin/partners/page.tsx`
- `app/admin/routes/page.tsx`
- `app/admin/disclosures/page.tsx`
- `app/admin/flags/page.tsx`
- `app/admin/experiments/page.tsx`
- `app/admin/audit/page.tsx`
- `app/api/admin/partners/route.ts`
- `app/api/admin/routes/route.ts`
- `app/api/admin/disclosures/route.ts`
- `app/api/admin/flags/route.ts`
- `app/api/admin/experiments/route.ts`
- `components/commercial/commercial-gateway-card.tsx`
- narrow `components/admin/*` forms/tables
- `supabase/migrations/011_commercial_admin.sql`
- unit tests for migration/gates/repositories/routes/admin/auth/components

**Modify**
- `.env.example`
- `app/offers/page.tsx`
- `components/offers/offers-client.tsx`
- `app/dashboard/page.tsx`
- `components/dashboard/dashboard-client.tsx`
- `supabase/tests/rls.sql`
- `tests/e2e/smoke.spec.ts`
- `README.md`

---

### Task 1: Add commercial/admin schema with auditable provenance and erasure-safe immutability

**Files:** Create migration 011 and migration test; modify RLS tests.

- [ ] RED migration test asserts all tables, private grants, published disclosure uniqueness, UPDATE-rejection triggers and disabled sandbox seed exist.
- [ ] Implement:
  - `admin_members(user_id PK FK auth.users on delete cascade, role='admin', created_at)`;
  - `commercial_partners(id, partner_key unique, display_name, enabled, sandbox_enabled, live_enabled default false, notes, timestamps)`;
  - `commercial_routes(id, route_key unique, partner_id, environment sandbox/live, destination_url, enabled, min_age >=18, required_readiness='green', disclosure_key, timestamps)`;
  - `commercial_disclosures(id, disclosure_key, version, status draft/reviewed/published/superseded/archived, body, reviewed_at, published_at, unique(disclosure_key,version))`;
  - `referral_attempts(id, referral_key unique, user_id, partner_id, route_id, originating_mission_id nullable, readiness_snapshot, consented_at, disclosure_id, environment, created_at, metadata)` plus unique `(id,user_id)`;
  - `revenue_events(id, user_id, referral_attempt_id, event_type click/lead/conversion/revenue/reversal/adjustment, amount_minor nullable >=0, currency default GBP, external_reference, occurred_at, metadata)` with same-owner FK `(referral_attempt_id,user_id)`;
  - `experiments(id, experiment_key unique, status draft/active/paused/ended, surface_key, variants jsonb, created_at, updated_at)`;
  - `admin_audit_log(id, admin_user_id nullable FK auth.users on delete set null, action, entity_type, entity_id, metadata, occurred_at)`.
- [ ] Route destination DB constraint: `sandbox` destination must start `/sandbox/`; `live` destination must start `https://`. No live route seed.
- [ ] `referral_attempts` optional same-owner mission FK uses `(originating_mission_id,user_id) -> user_missions(id,user_id)` with `ON DELETE SET NULL (originating_mission_id)` so user id is preserved.
- [ ] Enforce one published disclosure per `disclosure_key` with a partial unique index.
- [ ] Add service-role-only `publish_commercial_disclosure(uuid)` which atomically supersedes prior published version; revoke from PUBLIC/anon/authenticated.
- [ ] Add BEFORE UPDATE rejection triggers to `referral_attempts` and `revenue_events`. Do not reject service-role DELETE: client DELETE is revoked and app repositories expose no deletion, while data-erasure workflows must remain possible. `admin_audit_log` is append-only by repository/API design and no client grants; do not add an UPDATE trigger that would interfere with its `admin_user_id ON DELETE SET NULL` cleanup.
- [ ] Seed only a sandbox fixture, no lender/live destination:

```sql
insert into public.commercial_partners(partner_key, display_name, enabled, sandbox_enabled, live_enabled)
values ('credit-quest-sandbox', 'Credit Quest Sandbox Partner', true, true, false)
on conflict (partner_key) do nothing;
```

Seed reviewed/published `sandbox-referral-disclosure` and an initially disabled route whose destination is `/sandbox/referral-complete`.
- [ ] RLS: no anon/auth direct reads/writes to partners/routes/disclosures/feature flags/experiments/revenue/admin data; no direct client referral writes. Admin uses service client after verified membership.
- [ ] Extend RLS tests: no client grants, publication service-only, UPDATE rejection, client DELETE denied, no enabled live route, and `commercial_gateway_enabled=false` still seeded.
- [ ] Run local DB verification GREEN and commit: `feat: add commercial control plane schema`.

### Task 2: Implement pure presentation/referral hard gates and evidence completeness

**Files:** Create commercial types/gates/ordering and tests.

```ts
export type CommercialGateReason =
  | "gateway_disabled"
  | "live_not_allowed"
  | "under_18"
  | "safe_mode"
  | "readiness_not_green"
  | "missing_evidence"
  | "partner_disabled"
  | "route_disabled"
  | "environment_not_permitted"
  | "disclosure_missing"
  | "consent_missing";

export type CommercialGateResult =
  | { permitted: true }
  | { permitted: false; reason: CommercialGateReason };
```

- [ ] RED tests cover protective precedence. First protective failure wins before partner presentation.
- [ ] Implement `hasRequiredCommercialEvidence(profile)` exactly:

```ts
if (profile.missedPaymentsLast12m === null) return false;
if (profile.hardApplicationsLast6m === null) return false;
if (profile.hasRevolvingCredit === null) return false;
if (profile.hasRevolvingCredit === true && profile.utilisationPct === null) return false;
return true;
```

- [ ] Implement two functions, not one ambiguous gate:

```ts
evaluateCommercialPresentationGate(context): CommercialGateResult

evaluateCommercialReferralGate({ ...context, consent }): CommercialGateResult
```

Presentation evaluates runtime/live, age, Safe Mode, readiness green, evidence, partner, route, environment and published disclosure. Referral calls the same presentation gate and then requires `consent === true`.
- [ ] RED ordering tests create objects with fake extra `commission`, `epc`, `payout` fields and prove ordering ignores them. Typed production route contains none.
- [ ] Implement stable order `routeKey.localeCompare` then `partnerKey.localeCompare`.
- [ ] Source boundary test forbids commission/EPC/payout/revenue/campaign in implementation code.
- [ ] Run GREEN and commit: `feat: add commercial hard gates`.

### Task 3: Build server repository and Commercial Gateway

**Files:** Create commercial repository/gateway and tests.

```ts
export async function listPermittedCommercialRoutes(input: {
  userId: string;
  environment: "sandbox" | "live";
  now?: Date;
}): Promise<PermittedCommercialRoute[]>

export async function createCommercialReferral(input: {
  userId: string;
  routeId: string;
  disclosureId: string;
  consent: true;
  originatingMissionId?: string | null;
  now?: Date;
}): Promise<CommercialReferralResult>
```

- [ ] Repository lists config, fetches current published disclosure, appends referral/revenue rows; it has no update/delete method for referral/revenue history.
- [ ] RED gateway tests prove it recomputes current guidance via `getCreditGuidanceForUser`, current age/safety/evidence, feature flag and current route/disclosure; it never accepts client-provided context.
- [ ] `listPermittedCommercialRoutes` uses **presentation** gate and therefore does not require consent. It returns display metadata + the current disclosure needed before consent.
- [ ] `createCommercialReferral` re-fetches everything, verifies submitted disclosure id is still the current published disclosure for that route key, then runs **referral** gate with explicit consent.
- [ ] Live lock:

```ts
const liveAllowed = process.env.LIVE_CREDIT_REFERRALS_ALLOWED === "true";
```

For live routes, false => `live_not_allowed` even if admin/DB says enabled.
- [ ] Sandbox still obeys age, Safe Mode, readiness, evidence, disclosure and consent protections.
- [ ] Generate `referralKey` with `crypto.randomUUID()` server-side and persist provenance before returning destination.
- [ ] Destination validation: sandbox internal `/sandbox/...`; live HTTPS server config only. Browser never sends destination.
- [ ] Config/repository failure returns no routes/fails closed while core Credit Quest guidance remains available.
- [ ] Run GREEN and commit: `feat: add sandbox commercial gateway`.

### Task 4: Add strict APIs and internal sandbox completion

**Files:** Create commercial APIs, sandbox page and tests.

- [ ] Route-list endpoint takes no eligibility body. Referral strict schema is only:

```ts
z.object({
  routeId: z.string().uuid(),
  disclosureId: z.string().uuid(),
  consent: z.literal(true),
  originatingMissionId: z.string().uuid().nullable().optional(),
}).strict()
```

Reject destination URL, userId, readiness, commission, payout, approval probability.
- [ ] APIs authenticate cookie session, use `user.id`; no configured Supabase => no persisted sandbox referral.
- [ ] `GET /api/commercial/routes` requests sandbox environment in V2.2 UI and returns route display metadata + current disclosure text/id, never revenue data.
- [ ] `POST /api/commercial/referrals` gate failure -> 409 safe reason; success -> `{ referralId, destinationUrl }` from server config.
- [ ] Sandbox page says “Sandbox journey complete — no lender/application was contacted.” It does not create a conversion/revenue event automatically.
- [ ] Run GREEN and commit: `feat: add commercial sandbox APIs`.

### Task 5: Remove configured production referral bypass and add Gateway UI

**Files:** Create gateway card; modify `/offers`, dashboard client/server, tests.

- [ ] RED tests prove configured/authenticated UI cannot render `offer.affiliateUrl` from legacy `offer-matcher`.
- [ ] Server `/offers`: when flag false/no permitted route show “No product step is available from Credit Quest right now” plus education. When sandbox route is deliberately enabled, clearly label Sandbox, show disclosure first, then require explicit consent checkbox before creating referral.
- [ ] Keep legacy OffersClient only for unconfigured demo mode; its CTA is inert/internal and visibly says “Demo only — no application is sent.” No external affiliate navigation.
- [ ] Configured dashboard optional partner area must not render direct affiliate URL. Future CTA uses Commercial Gateway only.
- [ ] Under-18, Safe Mode, non-green and unknown commercial evidence — including `hasRevolvingCredit=null` — show no gateway CTA.
- [ ] Preserve seven Quest Feed cards.
- [ ] Run GREEN and commit: `feat: route product journeys through commercial gateway`.

### Task 6: Add explicit admin membership/auth and transactional audit

**Files:** Create admin auth/repository and tests.

- [ ] RED auth tests: unauthenticated false; non-member false; admin member true; lookup failure false. Never trust header/cookie role claims.
- [ ] Implement `requireAdminUser()` by normal auth first, then service read of `admin_members` for exact user id.
- [ ] Admin mutation repository accepts verified `adminUserId`. Use service-role SQL/RPC transaction for each config mutation plus `admin_audit_log` insert so a successful admin change is always audited.
- [ ] `feature_flags` mutation is allowlisted to downstream flags; reject arbitrary safety/readiness/mission-looking keys.
- [ ] Admin audit repository exposes append/list only, no update/delete.
- [ ] Run GREEN and commit: `feat: add admin authorization and audit`.

### Task 7: Build narrow Credit Quest Admin pages/APIs

**Files:** Create admin layout/pages/API routes/components and tests.

- [ ] `/admin` layout requires verified admin server-side. Non-admin never receives admin data.
- [ ] Pages: Overview, Partners, Routes, Disclosures, Flags, Experiments, Audit. No customer impersonation, SQL editor, readiness threshold or mission priority controls.
- [ ] Strict API fields only. Routes fix `minAge >=18` and `requiredReadiness='green'`; destinations obey sandbox/live constraint.
- [ ] Any attempt to enable a live partner/route while `LIVE_CREDIT_REFERRALS_ALLOWED !== 'true'` is rejected server-side even for admin. V2.2 release keeps it false.
- [ ] Disclosure publication uses locked RPC + audit.
- [ ] Persistent warning: “Live credit referrals are locked pending regulatory clearance.”
- [ ] Run GREEN and commit: `feat: add Credit Quest admin control plane`.

### Task 8: RLS, architecture, E2E and production-dark closeout

**Files:** Create commercial boundary test; modify RLS/E2E/README/.env.

`.env.example` add:

```text
LIVE_CREDIT_REFERRALS_ALLOWED=false
```

- [ ] Architecture scan proves core strategy imports no commercial/revenue/admin/feature flag modules.
- [ ] RLS tests prove ordinary users cannot access config/revenue/admin or write referrals; disclosure RPC locked; referral/revenue UPDATE rejected; client DELETE denied; no enabled live route.
- [ ] E2E/integration: under-18 no route; Safe Mode no route; red/amber/unknown no route; flag off no route; route presentation does not require consent; referral creation does; sandbox provenance/internal destination only; seven cards remain.
- [ ] README: migration 011, two-key live lock, sandbox-only V2.2, regulatory checkpoint and admin bootstrap.
- [ ] Admin bootstrap is a deliberate operational action: after an authorised operator has an existing Supabase auth account, identify that exact auth UUID and insert it into `admin_members` through the Supabase admin/SQL console. Do not auto-promote the first user and expose no self-grant endpoint.
- [ ] Final gate:

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
```

Run local Supabase migrations/RLS as CI does.
- [ ] Commit: `test: verify V2.2C commercial admin boundaries`.

## V2.2C Exit Gate

Complete only when route presentation and referral consent are correctly separated, every configured referral goes through the server Gateway, unknown evidence blocks referral independently of readiness, no configured page has an affiliate bypass, admin cannot override hard gates, sandbox provenance is auditable, user erasure is not blocked by audit immutability controls, commercial/revenue data is absent from strategy inputs, and live referral remains impossible with `LIVE_CREDIT_REFERRALS_ALLOWED=false`.
