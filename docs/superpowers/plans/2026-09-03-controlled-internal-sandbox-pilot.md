# Controlled Internal Sandbox Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the complete V2.0d decline-recovery loop with one internal sandbox identity and one sandbox-only partner while keeping every live/commercial path dark.

**Architecture:** Reuse the existing signed partner intake, atomic one-time handoff, recovery journey, plan, evidence/readiness and Return-to-Origin gateway. Add only the missing server-side contract-binding lookup: an accepted sandbox intake may bind to exactly one eligible sandbox Return-to-Origin contract for the authenticated partner and product; zero or ambiguous matches fail closed to no contract. Production pilot configuration is constrained to synthetic fixtures, no callbacks, no live contract, no live-enabled partner, and no commercial gateway.

**Tech Stack:** Next.js, TypeScript, Vitest, Playwright, Supabase/Postgres, Vercel, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-02-credit-quest-v2-0d-closed-loop-decline-recovery-design.md`

## Global Constraints

- Core diagnosis, readiness and safety logic remain unchanged.
- Quest Score and mission ranking remain unchanged.
- Quest Feed remains exactly 7 cards.
- Under-18 remains education-only.
- Support Needs must not automatically trigger Safe Mode.
- Commercial economics must never influence customer strategy or readiness.
- `commercial_gateway_enabled=false` throughout the pilot.
- `commercial_sandbox_enabled=false` throughout the pilot.
- `email_reminders_enabled=false` throughout the pilot.
- No live referrals, live Return-to-Origin, callbacks or production lender traffic.
- Partner decline context remains partner context, never Credit Quest diagnosis.
- Raw handoff tokens are never persisted; only token hashes are stored.
- Privileged atomic RPCs remain service-role-only.

---

### Task 1: Bind sandbox intake to one eligible sandbox Return-to-Origin contract

**Files:**
- Modify: `tests/unit/partner-decline-intake.test.ts`
- Modify: `lib/server/partner-intake-repository.ts`
- Modify: `lib/server/partner-intake-service.ts`

**Interfaces:**
- Produces: `findEligibleSandboxReturnContract(admin, partnerId, productCategory, now): Promise<{ id: string } | null>`.
- Consumes: existing authenticated partner identity and parsed product category; never consumes partner-supplied destination, contract id or environment.

- [ ] **Step 1: Write the failing intake test**

Add a repository mock `findEligibleSandboxReturnContract`. In the valid signed-request test, resolve it to `{ id: "44444444-4444-4444-8444-444444444444" }` and assert the intake insert receives that value as `returnContractId`. Add a second test resolving it to `null` and assert intake remains valid but persists `returnContractId: null`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run tests/unit/partner-decline-intake.test.ts`

Expected: FAIL because the service does not call `findEligibleSandboxReturnContract` and still persists `returnContractId: null`.

- [ ] **Step 3: Implement the minimal repository lookup**

Query `return_contracts` with all of these predicates: exact `partner_id`, exact `product_category`, `environment='sandbox'`, `enabled=true`, `callback_policy='none'`, `callback_url IS NULL`, `expires_at > now`. Limit to 2 rows and return an id only when exactly one row is eligible. Zero or multiple matches return `null`.

- [ ] **Step 4: Bind the result during signed intake**

After authentication/replay/rate-limit checks and before insertion, call the repository lookup using the authenticated credential partner id and parsed product category. Persist only the returned id or `null`; do not accept a contract/destination/environment field from the request.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- --run tests/unit/partner-decline-intake.test.ts`

Expected: PASS.

### Task 2: Prove fail-closed contract selection boundaries

**Files:**
- Create: `tests/unit/partner-return-contract-binding.test.ts`
- Modify only if required: `lib/server/partner-intake-repository.ts`

**Interfaces:**
- Consumes: `findEligibleSandboxReturnContract` from Task 1.
- Produces: explicit regression coverage for sandbox-only, partner/product scoped, unexpired, callback-free and unambiguous selection.

- [ ] **Step 1: Write failing repository-boundary tests**

Use the established fluent Supabase test-double pattern to assert the lookup applies exact filters for partner, product, `sandbox`, enabled, callback-free, unexpired. Add cases where no match returns `null`, exactly one match returns its id, and two matches return `null`.

- [ ] **Step 2: Run the focused test and verify RED if implementation is incomplete**

Run: `npm test -- --run tests/unit/partner-return-contract-binding.test.ts`

- [ ] **Step 3: Make only the minimum implementation correction required**

Do not add schema, public APIs or partner-controlled routing.

- [ ] **Step 4: Run both partner intake test files and verify GREEN**

Run: `npm test -- --run tests/unit/partner-decline-intake.test.ts tests/unit/partner-return-contract-binding.test.ts`

### Task 3: Preserve release invariants and security boundaries

**Files:**
- No production logic changes expected.
- Existing tests: `tests/unit/recovery-boundaries.test.ts`, `tests/unit/quest-score.test.ts`, `tests/unit/mission-engine.test.ts`, `tests/unit/safety.test.ts`, `tests/unit/sandbox-pilot-control.test.ts`, `tests/unit/return-origin-gateway.test.ts`, `tests/unit/partner-handoff-atomicity.test.ts`, `tests/unit/partner-handoff-redemption.test.tsx`, plus full suite.

- [ ] **Step 1: Run recovery/security/invariant focused tests**

Run the existing focused files above and confirm no change to scoring, mission ranking, safety, under-18, support-needs or Return-to-Origin live locks.

- [ ] **Step 2: Run full unit/integration suite**

Run: `npm test -- --run`

- [ ] **Step 3: Run production build and Playwright**

Run the repository's existing build and Playwright scripts exactly as defined in `package.json`/CI.

- [ ] **Step 4: Check dependency audit**

Run the repository's existing audit command and require zero known vulnerabilities at the configured severity threshold.

### Task 4: Configure the minimum production sandbox pilot fixtures

**Production fixtures:**
- Exactly one synthetic adult test user with server-side `app_metadata.credit_quest_sandbox_pilot=true`.
- Exactly one enabled partner with `sandbox_enabled=true`, `live_enabled=false`.
- Exactly one enabled partner credential referencing a server-only Vercel secret; raw secret never stored in Postgres or source control.
- Exactly one enabled `environment='sandbox'` Return-to-Origin contract for the pilot product with `destination_url` under `/sandbox/`, `callback_policy='none'`, `callback_url=null`, and a currently published disclosure.
- `commercial_gateway_enabled=false`.
- `commercial_sandbox_enabled=false`.
- `email_reminders_enabled=false`.
- No enabled live partner, live contract or live callback.

- [ ] **Step 1: Re-verify the exact deployed application head before mutation**

Do not configure fixtures until the merged/deployed commit is known and Vercel is serving that commit.

- [ ] **Step 2: Create/normalise only the synthetic pilot fixtures**

Reuse clearly synthetic existing pilot user/partner rows only if they meet the constraints; otherwise disable/replace them. Create the credential secret in Vercel and store only its env-var reference in Postgres.

- [ ] **Step 3: Enable only the two recovery pilot flags required for the flow**

Set `partner_decline_intake_enabled=true` and `return_to_origin_enabled=true` only after fixture constraints are verified. Keep commercial/live/email flags off.

### Task 5: Prove the complete production sandbox flow

- [ ] **Step 1: Submit a signed sandbox decline**

Use the internal credential to POST the minimum valid payload. Assert HTTP 201, one intake row, sandbox environment, token hash only, and the intake bound to the one sandbox contract.

- [ ] **Step 2: Redeem the handoff exactly once as the synthetic pilot user**

Assert atomic consumption and recovery journey creation. A second redemption must fail and must not create another journey.

- [ ] **Step 3: Exercise customer review/correction**

Correct or confirm the partner decline reason through the existing customer path. Assert the resulting journey context source is customer-reviewed context, not Credit Quest diagnosis.

- [ ] **Step 4: Generate the existing recovery plan**

Assert the existing plan derives from Credit Quest diagnosis/readiness/safety rather than commercial economics.

- [ ] **Step 5: Update synthetic evidence and perform readiness reassessment**

Use only test-user fixture evidence. Assert the existing reassessment reaches the expected sandbox-ready state without altering core readiness logic.

- [ ] **Step 6: Prove sandbox Return-to-Origin eligibility**

Assert the gateway returns an eligible sandbox destination under `/sandbox/`, records only a sandbox return attempt, emits no callback and cannot produce a live destination.

### Task 6: Exact-head CI, Vercel and post-pilot security verification

- [ ] **Step 1: Verify GitHub Actions on the exact final commit SHA**

Require all required checks green for that SHA.

- [ ] **Step 2: Verify Vercel deployment on the exact same SHA**

Require deployment READY/GREEN and production alias serving the same commit.

- [ ] **Step 3: Re-run production privilege/security probes**

Confirm anon has no recovery-table access, authenticated is owner-readable SELECT-only, privileged RPC execution remains service-role-only, live partners/contracts/referrals/callbacks remain zero, and all commercial/email flags remain off.

- [ ] **Step 4: Record the resulting pilot state**

Report exact final head, CI, Vercel, fixture counts, feature flags, one-time handoff proof, reassessment result, sandbox Return-to-Origin proof, and any fixture left enabled for continued internal testing.
