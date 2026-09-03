### Task 5: Secure sandbox Partner Decline Intake

**Files:**
- Create: `app/api/partner/declines/route.ts`
- Create: `lib/recovery/partner-intake-schema.ts`
- Create: `lib/server/partner-auth.ts`
- Create: `lib/server/partner-intake-repository.ts`
- Create: `lib/server/partner-intake-service.ts`
- Test: `tests/unit/partner-decline-intake.test.ts`

**Interfaces:**
- Header contract: partner credential identifier, timestamp, nonce, idempotency key, request signature.
- Body excludes raw PII, health detail, underwriting notes, arbitrary destination URLs and client-supplied trusted `partner_id`/environment.
- Service returns an opaque one-use handoff token URL; raw token is returned once and only its hash is persisted.

- [x] **Step 1: Write failing API/security tests**

Cover valid sandbox signed request, invalid signature, expired timestamp, nonce replay, duplicate idempotency, disabled partner, payload overreach, environment manipulation, and token characteristics.

- [x] **Step 2: Verify RED**

- [x] **Step 3: Implement sandbox-only service**

Use HMAC-SHA256 over a canonical request representation with timing-safe comparison, timestamp tolerance, nonce persistence, rate-limit hook, `crypto.randomBytes` token generation and SHA-256 token hashing. Require `partner_decline_intake_enabled=true`; live environment requests remain rejected.

- [x] **Step 4: Verify GREEN and commit**

Commit message: `feat: add sandbox partner decline intake`.

### Task 6: One-time handoff redemption and customer transparency

**Files:**
- Create: `app/recovery/handoff/[token]/page.tsx`
- Create: `app/api/recovery/handoff/redeem/route.ts`
- Create: `components/recovery/partner-context-review.tsx`
- Modify: `lib/server/partner-intake-service.ts`
- Test: `tests/unit/partner-handoff-redemption.test.ts`
- Test: `tests/e2e/recovery.spec.ts`

**Interfaces:**
- Token is server-redeemed, short-lived, single-use and invalid after account binding.
- Customer sees source, product category, decline date and optional structured reason with provenance; can confirm/correct/unknown/decline optional use.

- [x] **Step 1: Write failing redemption tests**

Cover expired token, reused token, disabled partner after issue, wrong environment, no raw sensitive data in URL, account binding and truthful context correction.

- [x] **Step 2: Verify RED**

- [x] **Step 3: Implement redemption/transparency flow**

Never decode sensitive context from the URL. Resolve token hash server-side and bind the resulting journey to the authenticated customer.

- [x] **Step 4: Verify GREEN and commit**

Commit message: `feat: add recovery handoff redemption`.

### Task 7: Recovery-plan orchestration

**Files:**
- Create: `lib/recovery/plan.ts`
- Create: `lib/server/recovery-orchestrator.ts`
- Create: `components/recovery/recovery-status.tsx`
- Modify: `app/dashboard/page.tsx` only to show a recovery status outside the fixed seven-card Quest Feed.
- Test: `tests/unit/recovery-orchestrator.test.ts`

**Interfaces:**
- Consumes existing `getCreditGuidanceForUser`, Journey, safety/readiness/Passport/mission outputs.
- Produces recovery stage, next safe action, evidence gaps and reassessment date only when real dated evidence supports one.

- [x] **Step 1: Write failing orchestration tests**

Cover Safe Mode -> crisis/recovery, red -> stability, amber -> rebuilding, known dated cooldown -> reassessment date, missing source date -> no fabricated 30/90/180 exact date, green -> ready-to-check.

- [x] **Step 2: Verify RED**

- [x] **Step 3: Implement downstream orchestration**

Do not import partner economics or mutate core guidance. Persist the projection only after valid core guidance has been calculated.

- [x] **Step 4: Verify GREEN and commit**

Verified GREEN head: `b6debacc8d3766fd7b6ac6fb71fe64d7981cb5a6`.
- 407/407 unit + integration tests across 97 files.
- 7/7 recovery orchestration contract tests.
- migrations 001-013 + all RLS suites.
- 17/17 Playwright.
- audit/lint/production build/Vercel green.

### Task 8: Sandbox Return-to-Origin gateway

**Files:**
- Create: `app/api/recovery/return/route.ts`
- Create: `lib/server/return-origin-repository.ts`
- Create: `lib/server/return-origin-gateway.ts`
- Create: `components/recovery/return-to-origin-card.tsx`
- Test: `tests/unit/return-origin-gateway.test.ts`

**Interfaces:**
- Server owns destination/callback configuration through `return_contracts`.
- Gateway re-fetches current guidance, maps green readiness to semantic `ready_to_check`, re-runs safety/evidence/cooldown/disclosure/customer-choice/partner/environment/expiry gates, writes an auditable attempt, then returns only an allowlisted sandbox destination.

- [ ] **Step 1: Write failing gateway tests**

Cover every domain gate plus stale/expired contract, arbitrary browser URL rejection, partner disabled after readiness, sandbox/live manipulation, minimal callback payload shape and customer decline/continue choice.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement sandbox gateway**

Require `return_to_origin_enabled=true`, sandbox pilot membership and sandbox contract. Keep live Return-to-Origin hard-locked OFF; no callback is sent in this release unless a later explicitly approved sandbox callback adapter is configured.

- [ ] **Step 4: Verify GREEN and commit**

Commit message: `feat: add sandbox return to origin gateway`.