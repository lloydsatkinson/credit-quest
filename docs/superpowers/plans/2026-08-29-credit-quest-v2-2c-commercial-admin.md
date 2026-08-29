# Credit Quest V2.2C Commercial Gateway & Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete dark commercial control plane: server-side hard gates, sandbox-only referral provenance, versioned disclosures, partner/route configuration, append-only revenue/audit events and a narrow Credit Quest Admin — while production live regulated credit referrals remain technically blocked.

**Architecture:** Add an isolated `lib/commercial` pure gate/ordering domain downstream of existing safety/readiness; all persistence and redirects happen through server-only repositories/routes. The browser supplies only stable IDs and explicit consent, never destination URLs or customer eligibility facts. `feature_flags` from V2.2B controls runtime activation. A second server environment guard keeps live credit referrals impossible until a future explicitly approved regulatory release.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase Auth/Postgres/RLS, Zod 3, Vitest 3, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-29-credit-quest-v2-2-journey-growth-design.md`

**Dependency:** V2.2A and V2.2B complete, including migrations 009/010 and `feature_flags`.

## Global Constraints

- Live regulated credit referrals remain OFF. This plan may create sandbox referrals only in production until a later separately approved regulatory decision changes the explicit server guard.
- `commercial_gateway_enabled` defaults false. Turning it on is necessary but not sufficient for a live route.
- Add `LIVE_CREDIT_REFERRALS_ALLOWED=false` as a server-only environment guard. Live route creation requires both DB flag true and env value exactly `true`; release procedures in V2.2 never set it true.
- Under-18, Safe Mode, red/amber/unknown readiness, incomplete required evidence, missing disclosure, disabled partner/route, missing consent or unavailable config => no referral.
- Commercial gating is downstream. Do not modify `assessApplicationReadiness`, `assessSafety`, mission ranking, Quest Score or Academy selector.
- The known `hasRevolvingCredit === null` readiness edge remains untouched. Commercial Gateway independently requires `hasRevolvingCredit !== null`, preventing that unknown from becoming a commercial route.
- No lender underwriting criteria, approval odds or inferred lender eligibility.
- No commission/EPC/payout fields in `commercial_routes`; route ordering cannot see revenue economics.
- Multiple equivalent permitted routes use stable `routeKey`, then partner key ordering. Experiments may later vary presentation only within that already-permitted set.
- Browser never supplies arbitrary destination URL, user id, readiness state, age, Safe Mode state or revenue amount.
- Existing legacy `lib/domain/offer-matcher.ts` may remain for explicit demo-only fixtures during migration, but configured/authenticated product referrals must move behind Commercial Gateway. No production page may bypass the gateway.
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
- `components/admin/*` small forms/tables used by the pages
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

### Task 1: Add commercial/admin schema with append-only provenance

**Files:** Create migration 011 and `tests/unit/commercial-migration.test.ts`; modify RLS tests.

- [ ] RED migration test asserts all tables, private grants, published disclosure uniqueness, append-only triggers and sandbox seed exist.
- [ ] Implement these tables:
  - `admin_members(user_id PK, role='admin', created_at)`;
  - `commercial_partners(id, partner_key unique, display_name, enabled, sandbox_enabled, live_enabled default false, notes, timestamps)`;
  - `commercial_routes(id, route_key unique, partner_id, environment sandbox/live, destination_url, enabled, min_age >=18, required_readiness='green', disclosure_key, timestamps)`;
  - `commercial_disclosures(id, disclosure_key, version, status draft/reviewed/published/superseded/archived, body, reviewed_at, published_at, unique(disclosure_key,version))`;
  - `referral_attempts(id, referral_key unique, user_id, partner_id, route_id, originating_mission_id nullable same-owner FK, readiness_snapshot, consented_at, disclosure_id, environment, created_at, metadata)`;
  - `revenue_events(id, referral_attempt_id, event_type click/lead/conversion/revenue/reversal/adjustment, amount_minor nullable >=0, currency default GBP, external_reference, occurred_at, metadata)`;
  - `experiments(id, experiment_key unique, status draft/active/paused/ended, surface_key, variants jsonb, created_at, updated_at)`;
  - `admin_audit_log(id, admin_user_id, action, entity_type, entity_id, metadata, occurred_at)`.
- [ ] Enforce partial unique index: one published disclosure per `disclosure_key`.
- [ ] Add service-role-only `publish_commercial_disclosure(uuid)` that supersedes previous published version atomically. Revoke execute from PUBLIC/anon/authenticated.
- [ ] Add BEFORE UPDATE OR DELETE rejection triggers for `referral_attempts`, `revenue_events`, `admin_audit_log`. Subsequent referral/revenue history is appended, not rewritten.
- [ ] RLS: enable on every table. No anon/auth direct reads/writes to partners/routes/disclosures/feature flags/experiments/revenue/admin data. No direct client referral writes. Admin UI still goes through server routes/service client after admin auth.
- [ ] Seed only a disabled sandbox fixture, never a live lender route:

```sql
insert into public.commercial_partners(partner_key, display_name, enabled, sandbox_enabled, live_enabled)
values ('credit-quest-sandbox', 'Credit Quest Sandbox Partner', true, true, false)
on conflict (partner_key) do nothing;
```

Seed a reviewed/published disclosure `sandbox-referral-disclosure` and a disabled-by-default sandbox route pointing to the internal absolute URL derived at runtime, not a hard-coded external lender URL. Store route destination as `/sandbox/referral-complete` and permit relative destinations only for `environment='sandbox'`; live routes require HTTPS.
- [ ] Extend `supabase/tests/rls.sql`: verify no ordinary client grants, service publication only, append-only mutation rejection, no enabled live route, and `commercial_gateway_enabled=false` remains seeded.
- [ ] Run local DB verification GREEN and commit: `feat: add commercial control plane schema`.

### Task 2: Implement pure commercial hard gates and evidence completeness

**Files:** Create `lib/commercial/types.ts`, `gates.ts`, `ordering.ts`; tests `commercial-gates.test.ts`, `commercial-ordering.test.ts`.

**Gate result:**

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

- [ ] RED tests cover every reason and precedence. The first protective failure wins before partner presentation.
- [ ] Implement `hasRequiredCommercialEvidence(profile)` requiring:

```ts
if (profile.missedPaymentsLast12m === null) return false;
if (profile.hardApplicationsLast6m === null) return false;
if (profile.hasRevolvingCredit === null) return false;
if (profile.hasRevolvingCredit === true && profile.utilisationPct === null) return false;
return true;
```

This is deliberately stricter than the existing readiness edge without changing readiness itself.
- [ ] Implement `evaluateCommercialGate` from already-computed `ageMode`, safety, readiness, evidence, runtime/env flags and route/partner/disclosure/consent state. Only readiness `green` is commercially permitted initially.
- [ ] RED ordering tests create routes with fake `commission`, `epc`, `payout` extra properties and prove ordering ignores them. The typed production route model contains no such properties.
- [ ] Implement stable sort `route.routeKey.localeCompare` then `partnerKey.localeCompare`. No random or highest-paying ordering.
- [ ] Add source boundary test forbidding `commission`, `epc`, `payout`, `revenue` imports/terms in `gates.ts` and `ordering.ts` except test descriptions.
- [ ] Run GREEN and commit: `feat: add commercial hard gates`.

### Task 3: Build server repository and Commercial Gateway

**Files:** Create `lib/server/commercial-repository.ts`, `commercial-gateway.ts`; tests.

**Repository responsibilities:** list enabled sandbox/config routes via service client, fetch published disclosure, append referral attempt, append revenue event, never return mutable economics to gate logic.

**Gateway API:**

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

- [ ] RED tests inject repository/guidance dependencies. Prove gateway calls existing `getCreditGuidanceForUser`, separately derives current age mode/safety from current effective profile, checks `hasRequiredCommercialEvidence`, reads flag, re-fetches route/partner/disclosure and never trusts client context.
- [ ] Live hard lock:

```ts
const liveAllowed = process.env.LIVE_CREDIT_REFERRALS_ALLOWED === "true";
```

For `environment='live'`, false => `live_not_allowed` even if DB flag/route/admin state is enabled.
- [ ] Sandbox is still subject to age, Safe Mode, readiness, evidence, disclosure and consent gates. “Sandbox” does not bypass customer protection.
- [ ] `createCommercialReferral` inserts provenance before returning destination. Generate `referralKey` with `crypto.randomUUID()` server-side.
- [ ] Destination validation: sandbox may be an internal relative `/sandbox/...` path only; live requires `https:` and must match an explicit route-owned host/URL. Browser never submits it.
- [ ] Repository/config read failure returns no routes/fail closed; core guidance is not called a failure.
- [ ] Run GREEN and commit: `feat: add sandbox commercial gateway`.

### Task 4: Add strict commercial APIs and sandbox completion route

**Files:** Create `app/api/commercial/routes/route.ts`, `app/api/commercial/referrals/route.ts`, sandbox page; tests `commercial-routes-api.test.ts`, `commercial-referrals-api.test.ts`.

- [ ] RED schema tests: route-list takes no eligibility body; referral POST strict schema is only:

```ts
z.object({
  routeId: z.string().uuid(),
  disclosureId: z.string().uuid(),
  consent: z.literal(true),
  originatingMissionId: z.string().uuid().nullable().optional(),
}).strict()
```

Reject destination URL, userId, readiness, commission, partner payout and approval probability.
- [ ] APIs authenticate with cookie session and use `user.id`; no Supabase env => demo/sandbox unavailable rather than fake persisted consent.
- [ ] `GET /api/commercial/routes` requests sandbox environment only in V2.2 production UI. Return route display metadata + current disclosure text/id, never revenue data.
- [ ] `POST /api/commercial/referrals` calls gateway; gate failure returns 409 with safe generic customer reason; success returns `{ referralId, destinationUrl }` where destination came from server config.
- [ ] Sandbox completion page accepts referral id for display only and says “Sandbox journey complete — no lender/application was contacted.” It does not mark a real conversion.
- [ ] Run GREEN and commit: `feat: add commercial sandbox APIs`.

### Task 5: Replace configured production marketplace bypass with Gateway UI

**Files:** Create `components/commercial/commercial-gateway-card.tsx`; modify offers/dashboard client/server files; component/E2E tests.

- [ ] RED tests prove authenticated/configured UI cannot render `offer.affiliateUrl` directly from `lib/domain/offer-matcher`.
- [ ] Server `/offers` becomes a gateway surface. When flag false/no permitted route: explain “No product step is available from Credit Quest right now” and preserve educational links. When sandbox route available for internal testing: clearly label `Sandbox` and require the user to view disclosure + tick explicit consent before referral creation.
- [ ] Keep `OffersClient` only for unconfigured demo mode and change its CTA destinations to inert demo behaviour (no external affiliate navigation). Add visible “Demo only — no application is sent.”
- [ ] Dashboard’s legacy optional partner block must not render direct `affiliateUrl` in configured mode. Any future CTA goes through the gateway route list/referral API.
- [ ] Under-18, Safe Mode and non-green tests assert no gateway CTA. Unknown commercial evidence (including `hasRevolvingCredit=null`) also produces no CTA even if readiness happens to be green.
- [ ] Preserve seven Quest Feed cards.
- [ ] Run GREEN and commit: `feat: route product journeys through commercial gateway`.

### Task 6: Add explicit admin membership/auth and audit repository

**Files:** Create `lib/server/admin-auth.ts`, `admin-repository.ts`, tests `admin-auth.test.ts`, `admin-repository.test.ts`.

- [ ] RED auth tests: unauthenticated false; authenticated but absent membership false; member role admin true; lookup failure false. Never trust a cookie/header claiming admin.
- [ ] Implement `requireAdminUser()` by first authenticating with standard server Supabase client, then reading `admin_members` through service client for that exact user id. Return 403/redirect on failure.
- [ ] Admin repository mutations accept `adminUserId` from verified auth, write target table then append `admin_audit_log`. If audit append fails, admin mutation should fail closed where transactional RPC is practical; implement service-role RPCs for config mutation + audit in one transaction for partner/route/flag/disclosure/experiment changes.
- [ ] `feature_flags` mutation is allowlisted to known downstream flags; reject arbitrary safety/readiness/mission-looking keys.
- [ ] Run GREEN and commit: `feat: add admin authorization and audit`.

### Task 7: Build narrow Credit Quest Admin pages/APIs

**Files:** Create admin layout/pages/API routes/components and route tests.

- [ ] `/admin` layout calls `requireAdminUser` server-side. Non-admins never receive admin data.
- [ ] Build simple pages: Overview, Partners, Routes, Disclosures, Flags, Experiments, Audit. No customer impersonation, SQL editor, readiness threshold or mission-priority controls.
- [ ] API schemas are strict. Partners: display/name/enabled/sandbox/live flags/notes. Routes: partner id, route key, environment, destination, enabled, minAge fixed >=18, requiredReadiness fixed `green`, disclosure key. Flags: only existing allowlisted keys and boolean. Experiments: metadata only; actual assignment comes V2.2D.
- [ ] Any attempt to enable a live route while `LIVE_CREDIT_REFERRALS_ALLOWED !== 'true'` is rejected server-side even for admin. In V2.2 release environment this stays false.
- [ ] Disclosure publication uses the service-only publication RPC and records admin audit.
- [ ] Add clear persistent warning banner: “Live credit referrals are locked pending regulatory clearance.”
- [ ] Run route/component tests GREEN and commit: `feat: add Credit Quest admin control plane`.

### Task 8: RLS, architecture, E2E and production-dark closeout

**Files:** Create `tests/unit/commercial-boundaries.test.ts`; modify RLS/E2E/README/.env.

`.env.example` add:

```text
LIVE_CREDIT_REFERRALS_ALLOWED=false
```

- [ ] Architecture test scans core strategy modules and asserts no imports of `lib/commercial`, commercial repository/gateway, revenue events, admin, feature flags. Scan Commercial Gateway and assert it imports core outputs downstream but no core module imports it back.
- [ ] RLS tests assert no ordinary client read/write on config/revenue/admin; publication RPC locked; append-only triggers active; no enabled live route.
- [ ] E2E: under-18 no referral; Safe Mode no referral; amber/red/unknown no referral; commercial flag off no referral; sandbox referral requires consent and disclosure; sandbox completion explicitly contacts no lender; seven cards remain.
- [ ] README: migration 011, admin bootstrap procedure, two-key live lock, sandbox-only V2.2 status, regulatory checkpoint.
- [ ] **Admin bootstrap is a deliberate operational action:** after an authorised operator has an existing Supabase auth account, identify their UUID from `auth.users`, then insert that exact UUID into `admin_members` using the Supabase SQL/admin console. Do not auto-promote the first user and do not expose a self-grant endpoint.
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

The commercial/admin stage is complete only when every referral path goes through the server Gateway, unknown evidence blocks referral independently of readiness, configured production pages have no direct affiliate bypass, admin cannot override hard gates, sandbox provenance is auditable, commercial/revenue data is absent from strategy inputs, and live referral remains impossible with `LIVE_CREDIT_REFERRALS_ALLOWED=false`.
