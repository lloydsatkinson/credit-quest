# Credit Quest V2.3 Lender Decline Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a configurable lender decline-recovery platform that maps lender/product decline codes into governed Credit Risk and Affordability reasons, resolves multiple barriers into one customer journey, preserves Credit Quest safety/readiness authority, and exposes aggregate pilot intelligence without customer-level lender surveillance.

**Architecture:** Extend the existing V2.0d recovery system rather than creating a second decision engine. Add a versioned decline-policy layer, a deterministic multi-barrier resolver and immutable policy snapshots upstream of the existing Recovery Experience; add internal Journey Builder/Simulator controls and a separate partner-scoped read-only lender console downstream. Existing Passport, Mission, Academy, Safe Mode, Application Readiness and Return-to-Origin remain authoritative.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Supabase Auth/Postgres/RLS, Zod, Vitest/Testing Library, Playwright, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-09-credit-quest-v2-3-lender-decline-recovery-design.md`

## Global Constraints

- Do not create a second creditworthiness, Passport, readiness, mission-ranking or safety engine.
- Existing Safe Mode, age/under-18, Passport, Application Readiness, Mission, Academy and seven-card Quest Feed remain authoritative.
- Unknown/unmapped lender reasons remain unknown; never infer a hidden scorecard root cause.
- Partner policy may describe the lender's own eligibility rule but must not directly set Credit Quest readiness.
- Do not expose lender thresholds, weights or cut-offs to customers in a way that enables gaming.
- Fraud, AML, sanctions, KYC and restricted security decisions never enter the normal credit-recovery route.
- Negative disposable income / essential-expenditure pressure suppresses alternative-credit routing; a lower limit is not an affordability cure.
- Published policy versions are immutable; historical applicants retain the exact snapshot used when they entered recovery.
- Lender-facing V2.3 reporting is aggregate/cohort based; no customer PII, Support Needs/vulnerability detail or raw financial values.
- Commercial/referral/email/live-return dark defaults remain unchanged.
- Simulator and production must call the same domain resolver; no separate preview engine.
- Intermediate commits use `[vercel skip]`; only the final reviewed production-ready commit triggers Vercel.
- TDD is mandatory: RED test, minimal implementation, GREEN verification before each commit.

---

## File Structure

### Pure domain
- Create `lib/recovery/decline-taxonomy.ts` — canonical reasons, risk families, solveability and customer treatment metadata.
- Create `lib/recovery/decline-policy.ts` — partner/product mappings and immutable published-policy shapes.
- Create `lib/recovery/condition-language.ts` — allowlisted condition AST and three-valued evaluator (`true | false | unknown`).
- Create `lib/recovery/multi-barrier-resolver.ts` — deterministic primary/secondary/parallel barrier resolution.
- Create `lib/recovery/policy-snapshot.ts` — immutable applicant policy snapshot construction and validation.
- Create `lib/recovery/alternative-route.ts` — pure policy gate for original/alternative eligibility-check routes.

### Persistence / services
- Create `supabase/migrations/017_v2_3_decline_policy.sql` — canonical/mapping/template/reassessment/route configuration plus publish immutability.
- Create `supabase/migrations/018_v2_3_multi_reason_snapshots.sql` — multi-reason intake rows and immutable recovery policy snapshots.
- Create `supabase/migrations/019_v2_3_lender_pilot_reporting.sql` — pilots, cohort assignments and lender portal membership.
- Create `lib/server/decline-policy-repository.ts` — privileged versioned policy reads/writes for admin/publishing.
- Create `lib/server/recovery-policy-service.ts` — resolve partner codes + build policy snapshot at recovery activation.
- Create `lib/server/recovery-simulator-service.ts` — synthetic scenario execution using production domain resolver.
- Create `lib/server/lender-auth.ts` — authenticated lender membership / partner-scope authorizer.
- Create `lib/server/lender-analytics-repository.ts` — partner/pilot-scoped historical aggregate reporting.

### Existing integration points
- Modify `lib/recovery/partner-intake-schema.ts` — accept bounded multi-reason payloads while preserving the legacy single reason.
- Modify `lib/recovery/types.ts` — add policy/treatment snapshot references without changing core readiness semantics.
- Modify `lib/recovery/plan.ts` — consume resolved recovery treatment as contextual guidance only.
- Modify `lib/server/partner-intake-service.ts` — persist all structured decline reasons.
- Modify `lib/server/partner-intake-repository.ts` — read/write multi-reason intake rows.
- Modify `lib/server/recovery-repository.ts` — persist/read policy snapshot association.
- Modify `lib/server/recovery-orchestrator.ts` — load policy snapshot and project recovery using existing core guidance.
- Modify `lib/server/return-origin-gateway.ts` — apply alternative-route policy as an additional downstream gate, never as readiness authority.
- Modify `lib/server/recovery-analytics-repository.ts` — migrate historical KPI truth to event/snapshot semantics where required.

### Internal admin / simulator
- Create `app/admin/recovery/policies/page.tsx`
- Create `app/admin/recovery/simulator/page.tsx`
- Create `components/admin/recovery-policy-form.tsx`
- Create `components/admin/recovery-simulator-form.tsx`
- Create `app/api/admin/recovery/policies/route.ts`
- Create `app/api/admin/recovery/policies/publish/route.ts`
- Create `app/api/admin/recovery/simulate/route.ts`

### Lender portal
- Create `app/lender/layout.tsx`
- Create `app/lender/page.tsx`
- Create `app/lender/declines/page.tsx`
- Create `app/lender/cohorts/page.tsx`
- Create `app/lender/returns/page.tsx`
- Create `components/lender/funnel-summary.tsx`
- Create `components/lender/decline-performance-table.tsx`

### Verification
- Add focused unit tests under `tests/unit/v2-3-*.test.ts` as listed per task.
- Add `supabase/tests/v2_3_decline_policy.sql` and `supabase/tests/v2_3_lender_portal.sql`.
- Add `tests/e2e/v2-3-recovery-pilot.spec.ts`.
- Modify `tests/e2e/recovery.spec.ts` only for preservation/integration coverage.
- Modify `README.md` only in the final tranche.

---

### Task 1: Canonical Credit Risk / Affordability taxonomy

**Files:**
- Create: `lib/recovery/decline-taxonomy.ts`
- Test: `tests/unit/v2-3-decline-taxonomy.test.ts`

**Interfaces:**
- Produces:
  - `type DeclineRiskFamily`
  - `type RecoveryTreatmentClass`
  - `type SolveabilityClass`
  - `interface CanonicalDeclineReasonDefinition`
  - `CANONICAL_DECLINE_REASONS: readonly CanonicalDeclineReasonDefinition[]`
  - `getCanonicalDeclineReason(code: string): CanonicalDeclineReasonDefinition | null`
- Consumed by Tasks 2, 4, 5, 6, 7 and 9.

- [ ] **Step 1: Write RED taxonomy tests**

```ts
import { describe, expect, it } from "vitest";
import {
  CANONICAL_DECLINE_REASONS,
  getCanonicalDeclineReason,
} from "@/lib/recovery/decline-taxonomy";

describe("V2.3 canonical decline taxonomy", () => {
  it("classifies negative disposable income as affordability and not product fit", () => {
    const reason = getCanonicalDeclineReason("NEGATIVE_DISPOSABLE_INCOME");
    expect(reason).toMatchObject({
      riskFamily: "affordability",
      treatment: "create_headroom",
      solveability: "stabilise_first",
      alternativeCreditPermittedByDefault: false,
    });
  });

  it("keeps score cutoff declines non-diagnostic", () => {
    const reason = getCanonicalDeclineReason("SCORE_CUTOFF");
    expect(reason).toMatchObject({
      riskFamily: "policy_or_score",
      treatment: "needs_evidence",
      inferRootCause: false,
    });
  });

  it("marks fraud and AML outcomes as restricted non-recovery", () => {
    expect(getCanonicalDeclineReason("FRAUD_SECURITY_DECISION")?.restricted).toBe(true);
    expect(getCanonicalDeclineReason("AML_RESTRICTED_DECISION")?.restricted).toBe(true);
  });

  it("has unique canonical codes", () => {
    const codes = CANONICAL_DECLINE_REASONS.map((reason) => reason.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:
```bash
npm test -- tests/unit/v2-3-decline-taxonomy.test.ts
```
Expected: FAIL because `lib/recovery/decline-taxonomy.ts` does not exist.

- [ ] **Step 3: Implement the taxonomy types and initial catalogue**

```ts
export type DeclineRiskFamily =
  | "public_adverse"
  | "delinquency"
  | "credit_seeking"
  | "affordability"
  | "indebtedness"
  | "file_depth"
  | "data_integrity"
  | "internal_performance"
  | "product_fit"
  | "policy_or_score"
  | "restricted";

export type RecoveryTreatmentClass =
  | "fix"
  | "build"
  | "stabilise"
  | "create_headroom"
  | "wait_and_rebuild"
  | "longer_term_recovery"
  | "find_a_better_fit"
  | "needs_evidence"
  | "restricted";

export type SolveabilityClass =
  | "fix_now"
  | "build_evidence"
  | "stabilise_first"
  | "time_bound"
  | "structural_long_horizon"
  | "product_routeable"
  | "unknown_or_unmapped"
  | "restricted";

export interface CanonicalDeclineReasonDefinition {
  code: string;
  riskFamily: DeclineRiskFamily;
  treatment: RecoveryTreatmentClass;
  solveability: SolveabilityClass;
  restricted: boolean;
  inferRootCause: boolean;
  alternativeCreditPermittedByDefault: boolean;
  customerLanguageKey: string;
}
```

Populate the catalogue with the approved V2.3 reasons from the spec, including at minimum recent/unsatisfied CCJs, default/CAIS 8/9, mortgage adverse, IVA/bankruptcy/DRO/DMP/ATP, Scottish insolvency equivalents, early/current delinquency, STL/high-cost activity, searches/new-account velocity, DSR/disposable-income/essential-expenditure/income verification, exposure/utilisation/overdraft/overlimit/cash advance, thin/no-hit/new-to-UK, CAIS duplicate/NOC/special instruction/CII/data mismatch, internal bad debt, product/limit/term/policy mismatch, generic score cutoff, and restricted fraud/AML/security outcomes.

- [ ] **Step 4: Run focused tests GREEN**

```bash
npm test -- tests/unit/v2-3-decline-taxonomy.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/recovery/decline-taxonomy.ts tests/unit/v2-3-decline-taxonomy.test.ts
git commit -m "feat: add governed decline taxonomy [vercel skip]"
```

---

### Task 2: Versioned policy persistence and publish boundary

**Files:**
- Create: `supabase/migrations/017_v2_3_decline_policy.sql`
- Create: `supabase/tests/v2_3_decline_policy.sql`
- Create: `lib/recovery/decline-policy.ts`
- Create: `lib/server/decline-policy-repository.ts`
- Test: `tests/unit/v2-3-decline-policy-migration.test.ts`
- Test: `tests/unit/v2-3-decline-policy-repository.test.ts`

**Interfaces:**
- Consumes: canonical codes from `getCanonicalDeclineReason`.
- Produces:
  - `type PolicyLifecycle = "draft" | "tested" | "published" | "retired"`
  - `interface PartnerDeclineMapping`
  - `interface RecoveryTemplateDefinition`
  - `interface ReassessmentRuleDefinition`
  - `interface AlternativeRoutePolicyDefinition`
  - `listPublishedMappings(admin, partnerId, productCategory, externalCodes)`
  - `publishRecoveryPolicyVersion(admin, adminUserId, draftId)`

- [ ] **Step 1: Write RED migration contract tests**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("V2.3 decline policy migration", () => {
  const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/017_v2_3_decline_policy.sql"), "utf8");

  it("creates versioned private policy tables", () => {
    for (const table of [
      "canonical_decline_reasons",
      "partner_decline_mappings",
      "recovery_templates",
      "recovery_template_steps",
      "reassessment_rules",
      "alternative_route_policies",
    ]) expect(sql).toContain(`create table public.${table}`);
  });

  it("keeps policy tables service-role only", () => {
    expect(sql).toContain("revoke all on public.partner_decline_mappings from anon, authenticated");
    expect(sql).toContain("grant all on public.partner_decline_mappings to service_role");
  });
});
```

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/unit/v2-3-decline-policy-migration.test.ts
```
Expected: FAIL because migration does not exist.

- [ ] **Step 3: Implement migration with immutable published versions**

Create tables with UUID primary keys, `version integer not null check (version >= 1)`, `lifecycle text check (...)`, effective dates, and partner/product scoping. Use a trigger that rejects `UPDATE` and `DELETE` where `old.lifecycle = 'published'`; retirement creates a new version/state rather than mutating published treatment content.

Store controlled condition AST as `jsonb` with `condition_schema_version integer not null default 1`; do not store executable SQL/JS.

- [ ] **Step 4: Implement TypeScript policy shapes**

```ts
export interface PartnerDeclineMapping {
  id: string;
  partnerId: string;
  productCategory: RecoveryProductCategory;
  externalCode: string;
  canonicalCode: string;
  parameters: Record<string, number | string | boolean>;
  version: number;
  lifecycle: PolicyLifecycle;
}
```

- [ ] **Step 5: Implement repository reads and publish RPC wrapper**

`listPublishedMappings` must query only `lifecycle='published'`, partner ID, product category and requested external codes. If zero or more than one active published mapping exists for the same `(partner, product, externalCode)` at the relevant time, return an explicit ambiguity result; do not pick one arbitrarily.

- [ ] **Step 6: Run focused tests and SQL verification**

```bash
npm test -- tests/unit/v2-3-decline-policy-migration.test.ts tests/unit/v2-3-decline-policy-repository.test.ts
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/v2_3_decline_policy.sql
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/017_v2_3_decline_policy.sql supabase/tests/v2_3_decline_policy.sql lib/recovery/decline-policy.ts lib/server/decline-policy-repository.ts tests/unit/v2-3-decline-policy-*.test.ts
git commit -m "feat: add versioned recovery policy store [vercel skip]"
```

---

### Task 3: Multi-reason partner handoff and immutable policy snapshots

**Files:**
- Create: `supabase/migrations/018_v2_3_multi_reason_snapshots.sql`
- Modify: `lib/recovery/partner-intake-schema.ts`
- Modify: `lib/server/partner-intake-service.ts`
- Modify: `lib/server/partner-intake-repository.ts`
- Create: `lib/recovery/policy-snapshot.ts`
- Create: `lib/server/recovery-policy-service.ts`
- Modify: `lib/server/recovery-repository.ts`
- Test: `tests/unit/v2-3-partner-multi-reason.test.ts`
- Test: `tests/unit/v2-3-policy-snapshot.test.ts`

**Interfaces:**
- Produces:
  - `normalisePartnerReasonCodes(input): string[]`
  - `interface RecoveryPolicySnapshot`
  - `resolveRecoveryPolicyForActivation(admin, input): Promise<RecoveryPolicySnapshot>`
- Snapshot construction occurs when the customer enters/binds the recovery journey, not by silently re-resolving against future policy versions.

- [ ] **Step 1: Write RED schema compatibility tests**

```ts
const multi = {
  ...validPayload,
  declineReasonProvided: true,
  declineReasonCode: null,
  declineReasonCodes: ["DSR_HIGH", "RECENT_STL", "THIN_FILE"],
};
expect(partnerDeclineSchema.safeParse(multi).success).toBe(true);

const tooMany = { ...multi, declineReasonCodes: Array.from({ length: 9 }, (_, i) => `R${i}`) };
expect(partnerDeclineSchema.safeParse(tooMany).success).toBe(false);
```

Also require the legacy single `declineReasonCode` payload to remain valid.

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/unit/v2-3-partner-multi-reason.test.ts
```
Expected: FAIL because `declineReasonCodes` is not accepted.

- [ ] **Step 3: Extend the Zod schema safely**

Add optional `declineReasonCodes: z.array(z.string().trim().min(1).max(160)).min(1).max(8).optional()` and a transform/helper that returns a de-duplicated ordered list. Reject a payload where `declineReasonProvided=true` but neither single nor array form contains a reason. Preserve `.strict()` so PII/underwriting-note overreach remains rejected.

- [ ] **Step 4: Add persistence tables**

Migration `018` creates:

```sql
create table public.decline_intake_reasons (
  id uuid primary key default gen_random_uuid(),
  intake_session_id uuid not null references public.decline_intake_sessions(id) on delete cascade,
  ordinal integer not null check (ordinal between 1 and 8),
  external_code text not null,
  created_at timestamptz not null default now(),
  unique (intake_session_id, ordinal),
  unique (intake_session_id, external_code)
);

create table public.recovery_policy_snapshots (
  id uuid primary key default gen_random_uuid(),
  recovery_journey_id uuid not null unique references public.decline_recovery_journeys(id) on delete cascade,
  partner_id uuid references public.decline_partners(id) on delete restrict,
  product_category text not null,
  policy_snapshot jsonb not null,
  created_at timestamptz not null default now()
);
```

Both tables are service-role-only. Add a trigger rejecting update/delete of `recovery_policy_snapshots`.

- [ ] **Step 5: Persist every supplied reason**

`partner-intake-service.ts` normalises reasons once; repository creation persists the legacy first reason into the existing `decline_reason_code` for backward-compatible screens and all reasons into `decline_intake_reasons` atomically.

- [ ] **Step 6: Build the activation snapshot**

`resolveRecoveryPolicyForActivation` must:
1. load intake reasons in ordinal order;
2. load exactly one published mapping per external code;
3. preserve unmapped codes as `canonicalCode: null`, `solveability: "unknown_or_unmapped"`;
4. resolve the published template/reassessment/alternative-route version IDs;
5. return one immutable serialisable snapshot object;
6. persist it once against the recovery journey.

- [ ] **Step 7: Verify snapshot immutability and backward compatibility**

```bash
npm test -- tests/unit/v2-3-partner-multi-reason.test.ts tests/unit/v2-3-policy-snapshot.test.ts tests/unit/partner-decline-intake.test.ts tests/unit/partner-handoff-atomicity.test.ts
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/018_v2_3_multi_reason_snapshots.sql lib/recovery/partner-intake-schema.ts lib/server/partner-intake-service.ts lib/server/partner-intake-repository.ts lib/recovery/policy-snapshot.ts lib/server/recovery-policy-service.ts lib/server/recovery-repository.ts tests/unit/v2-3-partner-multi-reason.test.ts tests/unit/v2-3-policy-snapshot.test.ts
git commit -m "feat: snapshot multi-reason recovery policy [vercel skip]"
```

---

### Task 4: Controlled condition language and multi-barrier resolver

**Files:**
- Create: `lib/recovery/condition-language.ts`
- Create: `lib/recovery/multi-barrier-resolver.ts`
- Test: `tests/unit/v2-3-condition-language.test.ts`
- Test: `tests/unit/v2-3-multi-barrier-resolver.test.ts`

**Interfaces:**
- Produces:
  - `type RecoveryFactValue = string | number | boolean | null`
  - `type ConditionResult = true | false | "unknown"`
  - `evaluateCondition(expr, facts, parameters): ConditionResult`
  - `resolveRecoveryBarriers(input): BarrierResolution`

- [ ] **Step 1: Write RED three-valued condition tests**

```ts
expect(evaluateCondition(
  { op: "gt", fact: "dsr", parameter: "threshold" },
  { dsr: 0.56 },
  { threshold: 0.5 },
)).toBe(true);

expect(evaluateCondition(
  { op: "eq", fact: "electoral_roll", value: "confirmed" },
  { electoral_roll: null },
  {},
)).toBe("unknown");
```

- [ ] **Step 2: Implement an AST, not an expression parser**

```ts
export type ConditionExpr =
  | { op: "and"; all: ConditionExpr[] }
  | { op: "or"; any: ConditionExpr[] }
  | { op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"; fact: string; value?: RecoveryFactValue; parameter?: string };
```

Reject an expression that supplies both `value` and `parameter`, neither comparison target, unknown operators, or nested depth above the configured safe maximum (use 8).

- [ ] **Step 3: Write RED resolver tests**

Require:
- active IVA outranks product mismatch;
- negative DI outranks lower-limit route;
- DSR high + recent STL + thin file => primary affordability, secondary recent credit-seeking, parallel thin-file build;
- CAIS duplicate can run as a parallel FIX task unless it is the only meaningful cause;
- restricted decision suppresses normal recovery routing.

- [ ] **Step 4: Implement deterministic resolver**

```ts
export interface BarrierResolution {
  primary: ResolvedBarrier | null;
  secondary: ResolvedBarrier[];
  parallel: ResolvedBarrier[];
  treatment: RecoveryTreatmentClass;
  alternativeCreditSuppressed: boolean;
  suppressionReason: string | null;
}
```

Use explicit precedence metadata and compatibility rules; do not sort only by arbitrary numeric score. Structural/restricted/affordability blockers can suppress routeability while parallel FIX/BUILD actions remain visible when safe.

- [ ] **Step 5: Verify GREEN**

```bash
npm test -- tests/unit/v2-3-condition-language.test.ts tests/unit/v2-3-multi-barrier-resolver.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/recovery/condition-language.ts lib/recovery/multi-barrier-resolver.ts tests/unit/v2-3-condition-language.test.ts tests/unit/v2-3-multi-barrier-resolver.test.ts
git commit -m "feat: resolve recovery barriers deterministically [vercel skip]"
```

---

### Task 5: Integrate configured treatment into the existing customer Recovery Experience

**Files:**
- Modify: `lib/recovery/types.ts`
- Modify: `lib/recovery/plan.ts`
- Modify: `lib/server/recovery-orchestrator.ts`
- Modify: `lib/recovery/experience.ts`
- Modify only recovery UI components needed to show treatment context.
- Test: `tests/unit/v2-3-recovery-plan-integration.test.ts`
- Re-run: `tests/unit/recovery-domain.test.ts`, `tests/unit/recovery-orchestrator.test.ts`, `tests/unit/recovery-experience.test.ts`, `tests/unit/recovery-dashboard-contract.test.ts`

**Interfaces:**
- Consumes immutable `RecoveryPolicySnapshot` and `BarrierResolution`.
- Existing `buildRecoveryPlan()` remains the authority for stage/readiness derived from core guidance; policy context may select explanation/eligible steps but cannot manufacture readiness.

- [ ] **Step 1: Write RED integration tests**

Require:
- `CAIS_DUPLICATE` yields FIX-oriented explanation but does not replace the core next mission with an unrelated debt mission;
- `THIN_FILE` yields BUILD context while green readiness still comes only from existing Application Readiness;
- `NEGATIVE_DISPOSABLE_INCOME` cannot expose an alternative-credit CTA even if an alternative policy exists;
- active IVA produces LONGER-TERM RECOVERY context and no fake reassessment date;
- an unmapped reason displays neutral “we need more information” context rather than guessing.

- [ ] **Step 2: Add contextual types**

Extend `RecoveryPlanProjection` with an optional downstream field only:

```ts
policyContext: {
  treatment: RecoveryTreatmentClass;
  solveability: SolveabilityClass;
  primaryReasonCode: string | null;
  customerHeadline: string;
  originalProductBlocked: boolean;
  alternativeRoutePotential: boolean;
} | null;
```

Do **not** add a policy field to `ApplicationReadiness` or `CreditPassport`.

- [ ] **Step 3: Project policy context in the orchestrator**

Load the immutable snapshot, resolve current safe steps using Task 4, then call existing `getCreditGuidanceForUser()` / mission / Passport / readiness flow exactly as today. Feed only presentation context into `buildRecoveryPlan`/Recovery Experience.

- [ ] **Step 4: Preserve the five Recovery Experience states and seven-card feed**

No new recovery state enum is added. `action_required`, `waiting_for_evidence`, `reassessment_due`, `not_ready`, `ready_to_check` remain the customer state vocabulary; treatment class is explanatory context within those states.

- [ ] **Step 5: Run focused regression suites**

```bash
npm test -- tests/unit/v2-3-recovery-plan-integration.test.ts tests/unit/recovery-domain.test.ts tests/unit/recovery-orchestrator.test.ts tests/unit/recovery-experience.test.ts tests/unit/recovery-dashboard-contract.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/recovery/types.ts lib/recovery/plan.ts lib/server/recovery-orchestrator.ts lib/recovery/experience.ts components/recovery tests/unit/v2-3-recovery-plan-integration.test.ts
git commit -m "feat: apply decline treatment to recovery journey [vercel skip]"
```

---

### Task 6: Internal Journey Builder and production-equivalent Simulator

**Files:**
- Create: `components/admin/recovery-policy-form.tsx`
- Create: `components/admin/recovery-simulator-form.tsx`
- Create: `app/admin/recovery/policies/page.tsx`
- Create: `app/admin/recovery/simulator/page.tsx`
- Create: `app/api/admin/recovery/policies/route.ts`
- Create: `app/api/admin/recovery/policies/publish/route.ts`
- Create: `app/api/admin/recovery/simulate/route.ts`
- Create: `lib/server/recovery-simulator-service.ts`
- Test: `tests/unit/v2-3-recovery-policy-admin.test.tsx`
- Test: `tests/unit/v2-3-recovery-simulator.test.ts`

**Interfaces:**
- All admin routes call existing `requireAdminUser()` first.
- Simulator calls `resolveRecoveryPolicyForActivation`-equivalent pure resolution functions and `resolveRecoveryBarriers`; it never forks business logic.

- [ ] **Step 1: Write RED admin-auth and publish tests**

Require unauthenticated/non-admin callers to receive the existing admin access failure; published records cannot be edited in place; publish fails on unknown canonical code, unsupported condition AST, ambiguous mapping or missing customer copy.

- [ ] **Step 2: Implement minimal policy APIs**

`POST /api/admin/recovery/policies` creates/updates draft-only records after Zod validation.

`POST /api/admin/recovery/policies/publish` accepts only `{ draftId: string }`, verifies admin identity server-side and calls the publish repository/RPC. Browser input must not provide partner IDs the authenticated operation is not permitted to administer.

- [ ] **Step 3: Implement simulator service**

```ts
export interface RecoverySimulationInput {
  partnerId: string;
  productCategory: RecoveryProductCategory;
  declineCodes: string[];
  facts: Record<string, RecoveryFactValue>;
  now: string;
}
```

Return canonical mapping, barrier resolution, treatment, NOW/NEXT/THEN/LATER steps, reassessment condition/result, original route state, alternative route state, suppression reason and policy versions.

- [ ] **Step 4: Implement functional admin pages**

Keep the control plane clear rather than decorative: lender/product/code mapping, treatment, parameter values, version status, simulate button, publish button and version history. Do not expose arbitrary JSON editing for condition AST in the first UI; use allowlisted controls.

- [ ] **Step 5: Verify**

```bash
npm test -- tests/unit/v2-3-recovery-policy-admin.test.tsx tests/unit/v2-3-recovery-simulator.test.ts tests/unit/admin-auth.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/admin/recovery-policy-form.tsx components/admin/recovery-simulator-form.tsx app/admin/recovery/policies app/admin/recovery/simulator app/api/admin/recovery lib/server/recovery-simulator-service.ts tests/unit/v2-3-recovery-policy-admin.test.tsx tests/unit/v2-3-recovery-simulator.test.ts
git commit -m "feat: add recovery journey builder and simulator [vercel skip]"
```

---

### Task 7: Pilot/cohort model, lender membership and historical analytics

**Files:**
- Create: `supabase/migrations/019_v2_3_lender_pilot_reporting.sql`
- Create: `supabase/tests/v2_3_lender_portal.sql`
- Create: `lib/server/lender-auth.ts`
- Create: `lib/server/lender-analytics-repository.ts`
- Modify: `lib/server/recovery-analytics-repository.ts`
- Test: `tests/unit/v2-3-lender-auth.test.ts`
- Test: `tests/unit/v2-3-lender-analytics.test.ts`

**Interfaces:**
- Produces:
  - `requireLenderUser(): Promise<{ userId: string; partnerId: string; pilotIds: string[] }>`
  - `getLenderPilotAnalytics(admin, scope, options): Promise<LenderPilotAnalyticsResult>`
- All reporting is scoped server-side by verified partner/pilot membership.

- [ ] **Step 1: Write RED migration/security tests**

Migration creates:
- `recovery_pilots`
- `recovery_pilot_assignments`
- `lender_portal_members`

Revoke direct anon/authenticated access; service-role reads only. Membership table stores exact authenticated `user_id` and partner scope; no role cookie/header shortcuts.

- [ ] **Step 2: Implement lender authorizer mirroring admin-auth fail-closed behaviour**

```ts
export interface LenderIdentity {
  userId: string;
  partnerId: string;
  pilotIds: string[];
}
```

If auth fails, membership read fails, membership is disabled, or partner does not match, throw `LenderAccessError`.

- [ ] **Step 3: Write RED historical-KPI tests**

Require:
- `Ready to Check` means ever reached ready under governed historical outcome/snapshot truth, not only current mutable snapshot;
- median time to first action / median time to ready;
- partner A cannot see partner B;
- unavailable required source returns `{ available:false }` or null metric, never synthetic zero;
- original-product return and alternative-route checks are separate metrics.

- [ ] **Step 4: Implement scoped analytics repository**

Query only rows joined back to the authorised partner/pilot cohort. Return aggregates such as:

```ts
interface LenderPilotAnalytics {
  totals: {
    handoffs: number;
    activated: number;
    startedRecovery: number | null;
    reassessed: number;
    readyToCheck: number;
    voluntaryReturns: number;
  };
  rates: {
    activation: number | null;
    action: number | null;
    recovery: number | null;
    return: number | null;
    endToEndYield: number | null;
  };
  medianTimeToFirstActionHours: number | null;
  medianTimeToReadyDays: number | null;
  declineReasons: Array<{ canonicalCode: string; handoffs: number; activated: number; ready: number; returned: number }>;
}
```

- [ ] **Step 5: Verify DB and unit security**

```bash
npm test -- tests/unit/v2-3-lender-auth.test.ts tests/unit/v2-3-lender-analytics.test.ts tests/unit/recovery-analytics.test.ts
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/v2_3_lender_portal.sql
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/019_v2_3_lender_pilot_reporting.sql supabase/tests/v2_3_lender_portal.sql lib/server/lender-auth.ts lib/server/lender-analytics-repository.ts lib/server/recovery-analytics-repository.ts tests/unit/v2-3-lender-auth.test.ts tests/unit/v2-3-lender-analytics.test.ts
git commit -m "feat: add lender pilot reporting boundary [vercel skip]"
```

---

### Task 8: Read-only Lender Pilot Console

**Files:**
- Create: `app/lender/layout.tsx`
- Create: `app/lender/page.tsx`
- Create: `app/lender/declines/page.tsx`
- Create: `app/lender/cohorts/page.tsx`
- Create: `app/lender/returns/page.tsx`
- Create: `components/lender/funnel-summary.tsx`
- Create: `components/lender/decline-performance-table.tsx`
- Test: `tests/unit/v2-3-lender-console.test.tsx`

**Interfaces:**
- Every server page calls `requireLenderUser()` before analytics reads.
- Console is read-only; there are no policy mutation endpoints under `/lender`.

- [ ] **Step 1: Write RED UI boundary tests**

Require:
- overview shows Handoffs → Activated → Started Recovery → Reassessed → Ready to Check → Voluntary Return;
- no “Approval Rate”, “Reapproval Rate” or approval-probability copy;
- decline table shows canonical reason/family aggregate only;
- no customer identifiers/support needs/raw financial data;
- console contains no publish/edit controls.

- [ ] **Step 2: Implement shared lender layout**

Provide navigation for `Overview`, `Decline Intelligence`, `Cohorts`, `Return Outcomes`; show pilot name/date range/sandbox badge from server-owned scope.

- [ ] **Step 3: Implement overview and decline intelligence**

Use server-rendered aggregate metrics. Present unavailable values as “Unavailable”, not `0`. Label synthetic demo data when pilot type is synthetic.

- [ ] **Step 4: Implement cohorts and return outcomes**

Cohorts compare batches/time periods/product families. Return Outcomes separates original-product voluntary return from alternative eligibility-check routing.

- [ ] **Step 5: Verify**

```bash
npm test -- tests/unit/v2-3-lender-console.test.tsx
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/lender components/lender tests/unit/v2-3-lender-console.test.tsx
git commit -m "feat: add read-only lender pilot console [vercel skip]"
```

---

### Task 9: Governed alternative-product routing

**Files:**
- Create: `lib/recovery/alternative-route.ts`
- Modify: `lib/server/return-origin-repository.ts`
- Modify: `lib/server/return-origin-gateway.ts`
- Modify: `app/api/recovery/return/route.ts` only if the existing payload contract needs a route-policy identifier; prefer keeping browser POST limited to journey + customer choice.
- Modify: `components/recovery/return-to-origin-card.tsx`
- Test: `tests/unit/v2-3-alternative-route.test.ts`
- Re-run: `tests/unit/return-origin-gateway.test.ts`, `tests/unit/return-origin-availability.test.ts`, `tests/unit/return-to-origin-card.test.tsx`

**Interfaces:**
- Browser never submits destination URL, partner environment, lender threshold or readiness.
- `evaluateAlternativeRoutePolicy()` is a pure additional gate downstream of core readiness.

- [ ] **Step 1: Write RED route-policy tests**

Require:
- product-limit mismatch can permit a lower-exposure *eligibility check* when policy + CQ gates pass;
- negative DI, active IVA, Safe Mode, under-18, missing evidence or readiness not ready suppresses route;
- customer must explicitly choose continue;
- expired/disabled contract suppresses route;
- restricted decline suppresses route;
- original and alternative routes report distinct route types.

- [ ] **Step 2: Implement pure policy gate**

```ts
export type AlternativeRouteDecision =
  | { permitted: true; policyId: string; destinationProductKey: string }
  | { permitted: false; reason: string };
```

The pure gate consumes resolved policy + current authoritative CQ gate facts; it never calculates Application Readiness itself.

- [ ] **Step 3: Integrate server-side repository/gateway**

Server resolves policy/contract/destination. Preserve current client POST contract if possible:

```json
{ "recoveryJourneyId": "...", "customerChoice": "continue" }
```

The response may identify `routeType: "original" | "alternative"` and a server-resolved destination only after all gates pass.

- [ ] **Step 4: Update customer copy**

Original route: “Continue with [Partner]”.
Alternative route: “Check eligibility for another option”.
Never say suitable, approved, guaranteed, pre-approved or likely to pass.

- [ ] **Step 5: Verify all return security tests**

```bash
npm test -- tests/unit/v2-3-alternative-route.test.ts tests/unit/return-origin-gateway.test.ts tests/unit/return-origin-availability.test.ts tests/unit/return-to-origin-card.test.tsx tests/unit/recovery-boundaries.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/recovery/alternative-route.ts lib/server/return-origin-repository.ts lib/server/return-origin-gateway.ts app/api/recovery/return/route.ts components/recovery/return-to-origin-card.tsx tests/unit/v2-3-alternative-route.test.ts
git commit -m "feat: gate alternative eligibility routes [vercel skip]"
```

---

### Task 10: Synthetic 100-customer pilot, end-to-end verification and release hardening

**Files:**
- Create: `scripts/v2-3-synthetic-pilot.ts`
- Create: `tests/e2e/v2-3-recovery-pilot.spec.ts`
- Modify: `tests/e2e/recovery.spec.ts` only for preservation assertions.
- Create: `tests/unit/v2-3-release-invariants.test.ts`
- Modify: `README.md`

**Interfaces:**
- Synthetic runner uses real repositories/domain functions against sandbox/test data only.
- It must visibly mark pilot/cohort records as synthetic.

- [ ] **Step 1: Write RED release-invariant tests**

Fail the tranche if final code:
- creates a second readiness/Passport/mission engine;
- allows lender configuration into Safe Mode or Quest ranking;
- exposes customer PII/support/vulnerability data in lender analytics;
- exposes lender cut-offs in customer copy;
- enables any live/email/commercial dark default;
- routes restricted fraud/AML decisions through normal recovery;
- allows negative DI to be solved by lower exposure alone;
- lets mutable current readiness reduce historical Ready-to-Check counts.

- [ ] **Step 2: Implement deterministic synthetic cohort generator**

Create exactly 100 synthetic intake scenarios distributed across representative categories: recent CCJ, active IVA/bankruptcy/DRO, CAIS 8/9, early delinquency, recent STL/search velocity, thin/no-hit, CAIS duplicate/NOC/data issue, high DSR, negative DI, product/limit mismatch and multi-decline combinations.

Do not generate fake positive outcomes randomly. Each scenario explicitly seeds the evidence/time transition needed to produce its intended governed state, or remains blocked/unknown.

- [ ] **Step 3: Add E2E pilot journey**

Cover:
1. internal admin configures/publishes synthetic partner policy;
2. simulator resolves a multi-decline applicant;
3. signed sandbox handoff carries multiple reason codes;
4. customer confirms context and receives one coherent recovery journey;
5. Passport/Quest Feed/Academy remain present;
6. evidence/time change causes genuine reassessment;
7. ready-to-check can occur independently of route availability;
8. optional original/alternative route is customer-controlled;
9. lender console shows aggregate synthetic funnel and decline intelligence;
10. lender cannot access `/admin` or another partner scope.

- [ ] **Step 4: Run focused V2.3 suite**

```bash
npm test -- \
  tests/unit/v2-3-decline-taxonomy.test.ts \
  tests/unit/v2-3-decline-policy-migration.test.ts \
  tests/unit/v2-3-decline-policy-repository.test.ts \
  tests/unit/v2-3-partner-multi-reason.test.ts \
  tests/unit/v2-3-policy-snapshot.test.ts \
  tests/unit/v2-3-condition-language.test.ts \
  tests/unit/v2-3-multi-barrier-resolver.test.ts \
  tests/unit/v2-3-recovery-plan-integration.test.ts \
  tests/unit/v2-3-recovery-policy-admin.test.tsx \
  tests/unit/v2-3-recovery-simulator.test.ts \
  tests/unit/v2-3-lender-auth.test.ts \
  tests/unit/v2-3-lender-analytics.test.ts \
  tests/unit/v2-3-lender-console.test.tsx \
  tests/unit/v2-3-alternative-route.test.ts \
  tests/unit/v2-3-release-invariants.test.ts
```
Expected: PASS.

- [ ] **Step 5: Run full verification**

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npm run test:e2e
npm run build
```

Run all existing Supabase checks plus:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f supabase/tests/rls.sql \
  -f supabase/tests/retention_rls.sql \
  -f supabase/tests/commercial_rls.sql \
  -f supabase/tests/recovery_rls.sql \
  -f supabase/tests/recovery_atomic.sql \
  -f supabase/tests/recovery_privileges.sql \
  -f supabase/tests/v2_3_decline_policy.sql \
  -f supabase/tests/v2_3_lender_portal.sql
```
Expected: all PASS with no privilege leaks.

- [ ] **Step 6: Update README**

Document:
- V2.3 canonical decline taxonomy and recovery treatments;
- lender-configurable X-month/threshold policy without customer threshold disclosure;
- multi-reason snapshots and deterministic barrier resolver;
- Journey Builder/Simulator;
- separate read-only lender console;
- historical KPI semantics;
- alternative eligibility routing boundary;
- fraud/AML restricted non-recovery class;
- all dark defaults remaining OFF.

- [ ] **Step 7: Final reviewed commit without Vercel skip**

```bash
git add README.md scripts/v2-3-synthetic-pilot.ts tests/e2e/v2-3-recovery-pilot.spec.ts tests/e2e/recovery.spec.ts tests/unit/v2-3-release-invariants.test.ts
git commit -m "feat: complete V2.3 lender decline recovery platform"
```

- [ ] **Step 8: Verify exact review head in CI/Vercel**

Confirm GitHub Actions and Vercel both report success for the exact final commit SHA. Do not call the tranche production-ready if the successful deployment references an earlier SHA.

---

## Plan Self-Review Checklist

Before implementation begins, the executor must verify:

- **Spec coverage:** taxonomy, solveability, score-cutoff truthfulness, lender parameters, multi-reason intake, policy snapshots, conditions, resolver, customer integration, Journey Builder, Simulator, lender portal, analytics, alternative routes, synthetic pilot and release gates all map to a task above.
- **Type consistency:** `RecoveryTreatmentClass`, `SolveabilityClass`, `RecoveryPolicySnapshot`, `BarrierResolution` and `AlternativeRouteDecision` are defined once and reused rather than re-declared with different literals.
- **No placeholders:** no implementation step may be replaced with “handle errors”, “add validation” or “write tests”; use the explicit cases in each task.
- **Architecture preservation:** no task imports partner economics, policy thresholds or lender outcomes into Credit Passport, Application Readiness, safety or mission ranking.
- **Scope discipline:** live CRA/Open Banking adapters, live lender approval outcomes, production self-service lender policy editing and approval-probability modelling remain outside V2.3.
