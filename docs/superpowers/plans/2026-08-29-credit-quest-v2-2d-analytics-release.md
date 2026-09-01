# Credit Quest V2.2D Analytics & Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete V2.2 with outcome-focused analytics, presentation-only experiments, operational dashboards, end-to-end architecture enforcement and a dark-first production rollout that leaves email/commercial live switches off.

**Architecture:** Analytics reads downstream Journey/reminder/referral/event records and never writes strategy inputs. Experiments are deterministic assignments on explicitly allowlisted presentation surfaces and may only transform an already-permitted presentation set. Release hardening verifies the complete migration chain locally, deploys compatible code dark, then applies additive production migrations 009 -> 010 -> 011 with live switches still false and records exact release evidence in the existing V2.2 roadmap issue rather than triggering an extra documentation deployment.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase Postgres/RLS, Vitest 3, Testing Library, Playwright, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-29-credit-quest-v2-2-journey-growth-design.md`

**Dependency:** V2.2A-C complete and green.

## Global Constraints

- Analytics is observational. No metric, revenue event, partner performance, experiment result or campaign concept may feed safety, diagnosis, readiness, Quest Score, mission ranking or Academy selection.
- Optimise for useful action, reassessment and readiness movement; never introduce screen-time/streak/addictive metrics as product objectives.
- Experiments may alter only allowlisted presentation. They cannot change eligibility, safety, age gates, Safe Mode, readiness, mission ranking or protective Academy filtering.
- Experiment assignment cannot introduce a route that Commercial Gateway did not already permit.
- Revenue remains an outcome metric only.
- `email_reminders_enabled=false`, `commercial_gateway_enabled=false`, and `LIVE_CREDIT_REFERRALS_ALLOWED=false` remain the V2.2 production release defaults.
- Production DDL occurs only after compatible code is verified live/dark. Never apply 009/010/011 ahead of compatible code.
- No automatic admin promotion.
- Release evidence must contain actual observed identifiers/statuses; do not write guessed deployment or migration IDs.
- The known `hasRevolvingCredit === null` readiness behaviour remains untouched; the Commercial Gateway's independent evidence gate remains the protection for that edge.
- The Quest Feed remains exactly seven cards.
- Every implementation task follows observed RED -> minimal GREEN -> refactor -> focused commit.

---

## File Map

### New experiment and analytics files
- `lib/experiments/types.ts` — controlled experiment surfaces/variants and assignment contracts.
- `lib/experiments/assignment.ts` — stable deterministic assignment and presentation-only transforms.
- `lib/server/experiment-repository.ts` — private active-experiment reads and schema validation.
- `lib/server/metrics-repository.ts` — bounded, read-only Journey/commercial aggregation.
- `components/admin/metrics-dashboard.tsx` — progress-first operational metrics presentation.

### Existing presentation/config files to modify
- `lib/events.ts` — controlled V2.2 analytics event names.
- `lib/commercial/ordering.ts` — optional post-permission experiment transform only.
- `app/admin/page.tsx` — add operational metrics.
- `app/admin/experiments/page.tsx` — constrain experiment UX to approved surfaces/variants.
- `components/commercial/commercial-gateway-card.tsx` — record route-set exposure after render.
- `components/journey/journey-status-card.tsx` — record status exposure after render.
- `components/journey/in-app-reminders.tsx` — record reminder exposure after render.
- `components/journey/email-reminder-preference.tsx` — record explicit preference changes.
- `supabase/tests/rls.sql` — final V2.2 protected-table/RPC assertions.
- `tests/e2e/smoke.spec.ts` — complete V2.2 acceptance matrix.
- `README.md` — analytics/experiment/release boundaries.
- `.github/workflows/ci.yml` — modify only if the existing gate does not already run all required checks; never weaken it.

### New tests
- `tests/unit/v2-2-events.test.ts`
- `tests/unit/experiment-assignment.test.ts`
- `tests/unit/experiment-repository.test.ts`
- `tests/unit/experiment-boundaries.test.ts`
- `tests/unit/metrics-repository.test.ts`
- `tests/unit/metrics-dashboard.test.tsx`
- `tests/unit/v2-2-architecture.test.ts`
- `tests/unit/v2-2-release-invariants.test.ts`

---

### Task 1: Finalise the V2.2 event taxonomy

**Files:**
- Modify: `lib/events.ts`
- Test: `tests/unit/v2-2-events.test.ts`

**Interfaces:**
- Consumes existing `eventNames`, `eventPayloadSchema`, `trackEvent` from `lib/events.ts`.
- Produces additional controlled event names only; no new analytics write authority.

- [ ] **Step 1: Write the failing event contract test**

Create `tests/unit/v2-2-events.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { eventNames, eventPayloadSchema } from "@/lib/events";

const v22Names = [
  "journey_status_shown",
  "journey_reassessment_completed",
  "journey_readiness_changed",
  "journey_reminder_shown",
  "journey_email_preference_changed",
  "journey_email_sent",
  "commercial_routes_shown",
  "referral_consent_accepted",
  "referral_consent_declined",
  "sandbox_referral_created",
  "experiment_exposed",
] as const;

describe("V2.2 analytics taxonomy", () => {
  it("accepts only the controlled V2.2 event names", () => {
    for (const name of v22Names) {
      expect(eventNames).toContain(name);
      expect(eventPayloadSchema.safeParse({ name, metadata: { source: "test" } }).success).toBe(true);
    }
    expect(eventPayloadSchema.safeParse({ name: "commercial_revenue_ranked", metadata: {} }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/v2-2-events.test.ts
```

Expected: FAIL because the new event names are not in `eventNames`.

- [ ] **Step 3: Add the controlled names to `lib/events.ts`**

Append exactly these entries to the existing `eventNames` tuple:

```ts
  "journey_status_shown",
  "journey_reassessment_completed",
  "journey_readiness_changed",
  "journey_reminder_shown",
  "journey_email_preference_changed",
  "journey_email_sent",
  "commercial_routes_shown",
  "referral_consent_accepted",
  "referral_consent_declined",
  "sandbox_referral_created",
  "experiment_exposed",
```

Do not change `trackEvent` failure semantics; analytics remains best effort. Metadata at call sites is limited to stable IDs/keys, readiness bands, reminder reasons and experiment variant keys. Never send full application data, credentials, full card data, lender underwriting payloads or service keys.

- [ ] **Step 4: Run focused and existing event tests GREEN**

```bash
npm test -- tests/unit/events.test.ts tests/unit/v2-2-events.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add lib/events.ts tests/unit/v2-2-events.test.ts
git commit -m "feat: extend V2.2 analytics events"
```

---

### Task 2: Add deterministic presentation-only experiment assignment

**Files:**
- Create: `lib/experiments/types.ts`
- Create: `lib/experiments/assignment.ts`
- Create: `lib/server/experiment-repository.ts`
- Modify: `lib/commercial/ordering.ts`
- Test: `tests/unit/experiment-assignment.test.ts`
- Test: `tests/unit/experiment-repository.test.ts`

**Interfaces:**

```ts
export type ExperimentSurface =
  | "commercial_route_order"
  | "journey_status_copy"
  | "journey_email_opt_in_copy";

export interface ExperimentVariant {
  key: string;
  presentationKey: string;
}

export interface ActiveExperiment {
  id: string;
  experimentKey: string;
  surface: ExperimentSurface;
  variants: ExperimentVariant[];
}

assignExperimentVariant(experiment, userId): ExperimentVariant
applyCommercialRoutePresentationVariant(routes, variantKey): routes
getActiveExperiment(admin, surface): Promise<ActiveExperiment | null>
```

- [ ] **Step 1: Write failing deterministic assignment tests**

Create `tests/unit/experiment-assignment.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  applyCommercialRoutePresentationVariant,
  assignExperimentVariant,
} from "@/lib/experiments/assignment";
import type { ActiveExperiment } from "@/lib/experiments/types";

const experiment: ActiveExperiment = {
  id: "e1",
  experimentKey: "route-order-v1",
  surface: "commercial_route_order",
  variants: [
    { key: "reverse", presentationKey: "reverse" },
    { key: "control", presentationKey: "control" },
  ],
};

describe("presentation experiment assignment", () => {
  it("is stable for the same user and experiment", () => {
    const first = assignExperimentVariant(experiment, "user-123");
    const second = assignExperimentVariant(experiment, "user-123");
    expect(second).toEqual(first);
  });

  it("preserves the exact permitted route set", () => {
    const routes = [
      { id: "r1", routeKey: "a", partnerKey: "a" },
      { id: "r2", routeKey: "b", partnerKey: "b" },
    ];
    const transformed = applyCommercialRoutePresentationVariant(routes, "reverse");
    expect(transformed.map((route) => route.id).sort()).toEqual(["r1", "r2"]);
    expect(transformed.map((route) => route.id)).toEqual(["r2", "r1"]);
  });

  it("falls back to unchanged order for an unknown variant", () => {
    const routes = [
      { id: "r1", routeKey: "a", partnerKey: "a" },
      { id: "r2", routeKey: "b", partnerKey: "b" },
    ];
    expect(applyCommercialRoutePresentationVariant(routes, "not-allowed")).toEqual(routes);
  });
});
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/experiment-assignment.test.ts
```

Expected: FAIL because `lib/experiments` does not exist.

- [ ] **Step 3: Implement the experiment contracts**

Create `lib/experiments/types.ts`:

```ts
export type ExperimentSurface =
  | "commercial_route_order"
  | "journey_status_copy"
  | "journey_email_opt_in_copy";

export interface ExperimentVariant {
  key: string;
  presentationKey: string;
}

export interface ActiveExperiment {
  id: string;
  experimentKey: string;
  surface: ExperimentSurface;
  variants: ExperimentVariant[];
}

export const experimentSurfaces: ExperimentSurface[] = [
  "commercial_route_order",
  "journey_status_copy",
  "journey_email_opt_in_copy",
];

export const approvedPresentationKeys: Record<ExperimentSurface, readonly string[]> = {
  commercial_route_order: ["control", "reverse"],
  journey_status_copy: ["control", "concise"],
  journey_email_opt_in_copy: ["control", "benefit_first"],
};
```

- [ ] **Step 4: Implement stable assignment and route transform**

Create `lib/experiments/assignment.ts`:

```ts
import type { ActiveExperiment, ExperimentVariant } from "@/lib/experiments/types";

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function assignExperimentVariant(
  experiment: ActiveExperiment,
  userId: string,
): ExperimentVariant {
  const variants = [...experiment.variants].sort((a, b) => a.key.localeCompare(b.key));
  if (variants.length === 0) throw new Error("Experiment has no approved variants");
  return variants[fnv1a(`${userId}:${experiment.experimentKey}`) % variants.length];
}

export function applyCommercialRoutePresentationVariant<T>(
  routes: readonly T[],
  variantKey: string,
): T[] {
  if (variantKey === "reverse") return [...routes].reverse();
  return [...routes];
}
```

Run:

```bash
npm test -- tests/unit/experiment-assignment.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing active-experiment repository tests**

Create `tests/unit/experiment-repository.test.ts` with a small chainable Supabase fake and pin:

```ts
it("returns only an active experiment with approved surface and variants", async () => {
  const row = {
    id: "e1",
    experiment_key: "route-order-v1",
    status: "active",
    surface_key: "commercial_route_order",
    variants: [
      { key: "control", presentationKey: "control" },
      { key: "reverse", presentationKey: "reverse" },
    ],
  };
  const result = await getActiveExperiment(fakeClient(row), "commercial_route_order");
  expect(result?.experimentKey).toBe("route-order-v1");
});

it("returns null for an unapproved variant rather than guessing", async () => {
  const row = {
    id: "e1",
    experiment_key: "bad",
    status: "active",
    surface_key: "commercial_route_order",
    variants: [{ key: "paid-first", presentationKey: "paid-first" }],
  };
  await expect(getActiveExperiment(fakeClient(row), "commercial_route_order")).resolves.toBeNull();
});
```

- [ ] **Step 6: Run repository test RED**

```bash
npm test -- tests/unit/experiment-repository.test.ts
```

Expected: FAIL because `lib/server/experiment-repository.ts` does not exist.

- [ ] **Step 7: Implement strict active-experiment reads**

Create `lib/server/experiment-repository.ts` with `server-only`. Query `experiments` by `status='active'` and exact `surface_key`, then validate:

```ts
function isExperimentSurface(value: string): value is ExperimentSurface {
  return experimentSurfaces.includes(value as ExperimentSurface);
}

function parseVariants(surface: ExperimentSurface, value: unknown): ExperimentVariant[] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const approved = approvedPresentationKeys[surface];
  const parsed: ExperimentVariant[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const key = String((item as Record<string, unknown>).key ?? "");
    const presentationKey = String((item as Record<string, unknown>).presentationKey ?? "");
    if (!key || !approved.includes(presentationKey)) return null;
    parsed.push({ key, presentationKey });
  }
  return parsed;
}
```

`getActiveExperiment` returns `null` on query/config validation failure so experiments fail to control/default presentation.

- [ ] **Step 8: Integrate experiments only after commercial permission/order**

Keep existing `orderEquivalentCommercialRoutes(routes)` unchanged as the canonical non-commercial order. Add a separate exported wrapper in `lib/commercial/ordering.ts`:

```ts
export function presentEquivalentCommercialRoutes<T extends {
  routeKey: string;
  partnerKey: string;
}>(routes: readonly T[], presentationVariant = "control"): T[] {
  const permitted = orderEquivalentCommercialRoutes(routes);
  return applyCommercialRoutePresentationVariant(permitted, presentationVariant);
}
```

The wrapper receives only the already-permitted array. It never receives commission, EPC, payout, revenue or campaign data.

- [ ] **Step 9: Run all experiment tests GREEN and commit**

```bash
npm test -- tests/unit/experiment-assignment.test.ts tests/unit/experiment-repository.test.ts tests/unit/commercial-ordering.test.ts
git add lib/experiments lib/server/experiment-repository.ts lib/commercial/ordering.ts tests/unit/experiment-assignment.test.ts tests/unit/experiment-repository.test.ts
git commit -m "feat: add presentation-only experiments"
```

---

### Task 3: Build the outcome-focused metrics repository

**Files:**
- Create: `lib/server/metrics-repository.ts`
- Test: `tests/unit/metrics-repository.test.ts`

**Interfaces:**

```ts
export interface JourneyMetrics {
  onboardingCompleted: number;
  missionStarted: number;
  missionCompleted: number;
  reassessments: number;
  readinessChanged: number;
  readinessMovement: Record<"red_to_amber" | "amber_to_green" | "other", number>;
  remindersSent: number;
}

export interface CommercialMetrics {
  sandboxReferrals: number;
  consentAccepted: number;
  revenueEvents: number;
  confirmedRevenueMinor: number;
}

export type MetricsResult =
  | { available: true; windowDays: number; journey: JourneyMetrics; commercial: CommercialMetrics }
  | { available: false; reason: "unavailable" };

getV22Metrics(admin, { now?, windowDays? }): Promise<MetricsResult>
```

- [ ] **Step 1: Write failing pure aggregation tests**

Create `tests/unit/metrics-repository.test.ts` and first pin the exported helper:

```ts
import { describe, expect, it } from "vitest";
import { aggregateV22Metrics } from "@/lib/server/metrics-repository";

describe("V2.2 metrics aggregation", () => {
  it("counts progress outcomes and signed confirmed revenue only", () => {
    const result = aggregateV22Metrics({
      outcomes: [
        { event_type: "onboarding_completed", readiness_before: null, readiness_after: null },
        { event_type: "mission_started", readiness_before: null, readiness_after: null },
        { event_type: "mission_completed", readiness_before: null, readiness_after: null },
        { event_type: "reassessment_performed", readiness_before: "amber", readiness_after: "green" },
        { event_type: "readiness_changed", readiness_before: "amber", readiness_after: "green" },
      ],
      reminders: [{ status: "sent" }],
      referrals: [{ environment: "sandbox" }],
      events: [{ event_name: "referral_consent_accepted" }],
      revenue: [
        { event_type: "revenue", amount_minor: 1200 },
        { event_type: "reversal", amount_minor: 200 },
        { event_type: "click", amount_minor: null },
      ],
    });
    expect(result.journey.missionCompleted).toBe(1);
    expect(result.journey.readinessMovement.amber_to_green).toBe(1);
    expect(result.commercial.confirmedRevenueMinor).toBe(1000);
  });
});
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/metrics-repository.test.ts
```

Expected: FAIL because metrics repository does not exist.

- [ ] **Step 3: Implement pure aggregation and controlled types**

Create `lib/server/metrics-repository.ts` as `server-only`, but export `aggregateV22Metrics` for tests. Use exact event names from A-C. Revenue rule:

```ts
function signedRevenue(eventType: string, amount: number | null): number {
  if (amount === null) return 0;
  if (eventType === "revenue" || eventType === "adjustment") return amount;
  if (eventType === "reversal") return -amount;
  return 0;
}
```

Count `readiness_changed` movement using `readiness_before`/`readiness_after`; only `red->amber` and `amber->green` receive named buckets, all other actual changes go to `other`.

- [ ] **Step 4: Write failing bounded/read-only repository tests**

Extend the same test file with a fake client. Assert:
- default lower bound is `now - 30 days`;
- `windowDays` is clamped to `1..90`;
- reads only `journey_outcomes`, `journey_reminders`, `referral_attempts`, `revenue_events`, `events`;
- no `.insert`, `.update`, `.delete`, `.upsert`, `.rpc` is invoked;
- any required read error returns `{ available:false, reason:"unavailable" }` rather than fabricated zeroes.

Example assertion:

```ts
it("does not fabricate zero metrics when a required read fails", async () => {
  const result = await getV22Metrics(failingClient, {
    now: new Date("2026-08-29T08:00:00.000Z"),
    windowDays: 30,
  });
  expect(result).toEqual({ available: false, reason: "unavailable" });
});
```

- [ ] **Step 5: Run to observe RED for repository path**

```bash
npm test -- tests/unit/metrics-repository.test.ts
```

Expected: FAIL until `getV22Metrics` performs all bounded reads correctly.

- [ ] **Step 6: Implement `getV22Metrics`**

Use a single ISO lower bound:

```ts
const clampedWindow = Math.max(1, Math.min(90, windowDays ?? 30));
const fromIso = new Date(now.getTime() - clampedWindow * 86_400_000).toISOString();
```

Queries:
- `journey_outcomes`: `event_type,readiness_before,readiness_after,occurred_at` with `occurred_at >= fromIso`;
- `journey_reminders`: `status,sent_at` with `created_at >= fromIso`;
- `referral_attempts`: `environment,created_at` with `created_at >= fromIso`;
- `revenue_events`: `event_type,amount_minor,occurred_at` with `occurred_at >= fromIso`;
- `events`: `event_name,created_at` with `created_at >= fromIso` and only controlled consent events counted.

Return unavailable on any query error.

- [ ] **Step 7: Run GREEN and commit**

```bash
npm test -- tests/unit/metrics-repository.test.ts
git add lib/server/metrics-repository.ts tests/unit/metrics-repository.test.ts
git commit -m "feat: add journey and commercial metrics"
```

---

### Task 4: Finish the Admin metrics and experiment UX

**Files:**
- Create: `components/admin/metrics-dashboard.tsx`
- Modify: `app/admin/page.tsx`
- Modify: `app/admin/experiments/page.tsx`
- Test: `tests/unit/metrics-dashboard.test.tsx`

**Interfaces:**
- Consumes `MetricsResult` from Task 3.
- Consumes controlled experiment surfaces/approved presentation keys from Task 2.
- Produces presentation only; no strategy/admin authority beyond the existing C admin APIs.

- [ ] **Step 1: Write the failing metrics component test**

Create `tests/unit/metrics-dashboard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricsDashboard } from "@/components/admin/metrics-dashboard";

const metrics = {
  available: true as const,
  windowDays: 30,
  journey: {
    onboardingCompleted: 12,
    missionStarted: 10,
    missionCompleted: 7,
    reassessments: 4,
    readinessChanged: 3,
    readinessMovement: { red_to_amber: 1, amber_to_green: 1, other: 1 },
    remindersSent: 5,
  },
  commercial: {
    sandboxReferrals: 2,
    consentAccepted: 2,
    revenueEvents: 0,
    confirmedRevenueMinor: 0,
  },
};

describe("V2.2 admin metrics", () => {
  it("puts customer progress before commercial reporting", () => {
    render(<MetricsDashboard result={metrics} />);
    const progress = screen.getByRole("heading", { name: "Customer progress" });
    const commercial = screen.getByRole("heading", { name: "Commercial readiness" });
    expect(progress.compareDocumentPosition(commercial) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/Revenue is reporting only/i)).toBeVisible();
  });

  it("shows unavailable rather than zero when reads fail", () => {
    render(<MetricsDashboard result={{ available: false, reason: "unavailable" }} />);
    expect(screen.getByText(/Metrics are temporarily unavailable/i)).toBeVisible();
    expect(screen.queryByText("£0.00")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/metrics-dashboard.test.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement `MetricsDashboard`**

Create `components/admin/metrics-dashboard.tsx` with two ordered sections. The first displays onboarding, mission completion, reassessments, readiness movement and reminder sends. The second displays sandbox referrals, consent and reporting-only revenue. Include this persistent sentence exactly:

```text
Revenue is reporting only — it does not affect customer strategy.
```

For unavailable result render only an explicit unavailable card.

- [ ] **Step 4: Run component test GREEN**

```bash
npm test -- tests/unit/metrics-dashboard.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Add server-admin metrics loading**

In `app/admin/page.tsx`, after the existing admin guard from V2.2C, create the admin Supabase client and call:

```ts
const metrics = await getV22Metrics(admin, { windowDays: 30 }).catch(
  () => ({ available: false as const, reason: "unavailable" as const }),
);
```

Render `<MetricsDashboard result={metrics} />` beneath the operational status/kill-switch summary.

- [ ] **Step 6: Constrain the experiment admin surface**

In `app/admin/experiments/page.tsx`, render options only from `experimentSurfaces` and `approvedPresentationKeys`. Do not accept arbitrary JS/HTML/free-form presentation rules. The existing C API must reject any variant whose `presentationKey` is not approved for its selected surface.

Add a component/source assertion to `metrics-dashboard.test.tsx` or the existing C admin tests that the page contains none of: `mission priority`, `readiness threshold`, `approval probability`, `commission weight`.

- [ ] **Step 7: Run admin tests GREEN and commit**

```bash
npm test -- tests/unit/metrics-dashboard.test.tsx tests/unit/admin-api.test.ts tests/unit/admin-repository.test.ts
git add components/admin/metrics-dashboard.tsx app/admin/page.tsx app/admin/experiments/page.tsx tests/unit/metrics-dashboard.test.tsx
git commit -m "feat: complete V2.2 admin metrics"
```

---

### Task 5: Wire exposure analytics without making analytics a dependency

**Files:**
- Modify: `components/commercial/commercial-gateway-card.tsx`
- Modify: `components/journey/journey-status-card.tsx`
- Modify: `components/journey/in-app-reminders.tsx`
- Modify: `components/journey/email-reminder-preference.tsx`
- Test: extend existing component tests from A-C.

**Interfaces:**
- Uses existing `trackEvent(name, metadata)` which already fails open.
- Produces no business state; exposure telemetry is observational only.

- [ ] **Step 1: Write failing customer-component analytics tests**

In the existing component test files, mock only `global.fetch` used by `trackEvent` and pin the observable payload after render/action. Examples:

```tsx
it("records journey status exposure without changing the rendered guidance", async () => {
  render(<JourneyStatusCard state={state} outcomes={outcomes} />);
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(
    "/api/events",
    expect.objectContaining({ body: expect.stringContaining("journey_status_shown") }),
  ));
  expect(screen.getByText(/what happens next/i)).toBeVisible();
});
```

```tsx
it("records the email preference change only after the user chooses it", async () => {
  render(<EmailReminderPreference initialEnabled={false} />);
  expect(JSON.stringify(fetch.mock.calls)).not.toContain("journey_email_preference_changed");
  await user.click(screen.getByRole("checkbox"));
  await waitFor(() => expect(JSON.stringify(fetch.mock.calls)).toContain("journey_email_preference_changed"));
});
```

- [ ] **Step 2: Run the focused tests and observe RED**

```bash
npm test -- tests/unit/journey-status-card.test.tsx tests/unit/in-app-reminders.test.tsx tests/unit/email-reminder-preference.test.tsx tests/unit/commercial-gateway-card.test.tsx
```

Expected: FAIL because exposure events are not emitted.

- [ ] **Step 3: Add best-effort event tracking after render/explicit action**

Use `useEffect` in client components for exposure events, with only stable metadata:

```ts
useEffect(() => {
  void trackEvent("journey_status_shown", { stage, readinessBand });
}, [stage, readinessBand]);
```

For reminders emit reason/template key only. For commercial routes emit route IDs/keys and environment only, never economics. For consent accept/decline and sandbox referral creation use the existing API success/action boundaries from C.

- [ ] **Step 4: Run focused tests GREEN and commit**

```bash
npm test -- tests/unit/journey-status-card.test.tsx tests/unit/in-app-reminders.test.tsx tests/unit/email-reminder-preference.test.tsx tests/unit/commercial-gateway-card.test.tsx
git add components/commercial/commercial-gateway-card.tsx components/journey/journey-status-card.tsx components/journey/in-app-reminders.tsx components/journey/email-reminder-preference.tsx
git commit -m "feat: add downstream V2.2 exposure analytics"
```

---

### Task 6: Add whole-system architecture enforcement

**Files:**
- Create: `tests/unit/experiment-boundaries.test.ts`
- Create: `tests/unit/v2-2-architecture.test.ts`

- [ ] **Step 1: Write the failing architecture boundary test**

Create `tests/unit/v2-2-architecture.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8").toLowerCase();
}

const core = [
  "lib/domain/safety.ts",
  "lib/domain/diagnosis.ts",
  "lib/domain/passport.ts",
  "lib/domain/readiness.ts",
  "lib/domain/quest-score.ts",
  "lib/domain/mission-engine.ts",
  "lib/academy/selector.ts",
];

describe("V2.2 architecture boundaries", () => {
  it("keeps downstream journey/commercial/analytics out of core strategy", () => {
    for (const path of core) {
      const text = source(path);
      for (const forbidden of [
        "@/lib/journey",
        "@/lib/reminders",
        "@/lib/commercial",
        "@/lib/experiments",
        "metrics-repository",
        "revenue",
        "affiliate",
        "commission",
        "campaign",
        "feature-flag",
      ]) {
        expect(text).not.toContain(forbidden);
      }
    }
  });

  it("keeps the Quest Feed finite at seven cards", () => {
    expect(source("app/dashboard/page.tsx")).toContain("feed_card_total = 7");
    expect(source("components/dashboard/dashboard-client.tsx")).toContain("feed_card_total = 7");
  });
});
```

- [ ] **Step 2: Write the failing experiment/commercial boundary test**

Create `tests/unit/experiment-boundaries.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8").toLowerCase();

describe("experiment and commercial boundaries", () => {
  it("keeps economics out of commercial gates and ordering", () => {
    const text = `${read("lib/commercial/gates.ts")}\n${read("lib/commercial/ordering.ts")}`;
    for (const forbidden of ["commission", "epc", "payout", "revenue", "campaign"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("keeps experiments from deciding safety/readiness/mission eligibility", () => {
    const text = `${read("lib/experiments/assignment.ts")}\n${read("lib/server/experiment-repository.ts")}`;
    for (const forbidden of [
      "domain/safety",
      "domain/readiness",
      "mission-engine",
      "academy/selector",
      "createcommercialreferral",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
```

- [ ] **Step 3: Run and observe RED if any boundary has leaked**

```bash
npm test -- tests/unit/v2-2-architecture.test.ts tests/unit/experiment-boundaries.test.ts
```

Expected: RED if any A-C/D implementation introduced a forbidden dependency; otherwise the newly created test itself should initially fail only on any uncorrected boundary. Do not weaken the assertion to make it pass.

- [ ] **Step 4: Fix only the downstream dependency if RED**

Move any offending read/transform into the appropriate downstream orchestrator/gateway/presentation file. Do **not** edit core strategy rules to accommodate analytics/experiments.

Also pin the known readiness edge by asserting the source still contains the current conditional shape:

```ts
expect(read("lib/domain/readiness.ts")).toContain("profile.hasrevolvingcredit === false");
```

Do not add a `hasRevolvingCredit === null` rule in this release.

- [ ] **Step 5: Run GREEN and commit**

```bash
npm test -- tests/unit/v2-2-architecture.test.ts tests/unit/experiment-boundaries.test.ts
git add tests/unit/v2-2-architecture.test.ts tests/unit/experiment-boundaries.test.ts
git commit -m "test: enforce V2.2 architecture boundaries"
```

---

### Task 7: Complete the end-to-end acceptance matrix

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`
- Modify/create targeted unit/integration tests from A-C where configured Supabase behavior cannot be represented safely in demo E2E.

**Interfaces:**
- Demo E2E validates customer-visible protective behavior.
- Configured-mode unit/integration tests validate server-owned persistence/gates without fabricating production auth.

- [ ] **Step 1: Add failing demo-mode protective E2E cases**

Append browser tests that preserve all existing Academy/Passport/Readiness/Action Layer coverage and assert:

```ts
test("V2.2 keeps the Quest Feed finite while showing journey controls", async ({ page }) => {
  await completeOnboarding(page, "1990-01-01", true);
  await expect(page.getByTestId("quest-feed").locator("[data-quest-feed-card]")).toHaveCount(7);
  await expect(page.getByText(/what happens next/i)).toBeVisible();
  await expect(page.getByText(/email me when it.?s time to review/i)).toBeVisible();
});
```

Keep the existing under-18 and Safe Mode tests and extend each with `commercial gateway`/route CTA absence.

- [ ] **Step 2: Run E2E and observe RED**

```bash
npm run test:e2e
```

Expected: FAIL on newly added V2.2 UI expectations until A-C/D integration is complete.

- [ ] **Step 3: Add/confirm configured-mode acceptance tests for all hard gates**

Across existing A-C unit/integration files, ensure one named test covers each exact case:

1. adult mission action -> Journey outcome -> exact reassessment date when evidence supplies one;
2. readiness changes -> stored before/after bands;
3. unchanged readiness -> no fake change;
4. under-18 -> no commercial route;
5. Safe Mode -> no commercial route;
6. red/amber/unknown -> WAIT/no route;
7. `hasRevolvingCredit=null` -> no commercial route even if readiness is mocked green;
8. route presentation shows current disclosure without consent;
9. referral creation without consent inserts none;
10. missing/current-mismatched disclosure inserts none;
11. commercial flag off returns no route;
12. sandbox referral records provenance then returns only internal `/sandbox/` destination;
13. email flag off sends no email and leaves in-app reminder available;
14. email preference missing/off suppresses email;
15. provider failure leaves Journey intact and retries are bounded;
16. experiment transform preserves the exact permitted route ID set;
17. live route remains blocked when `LIVE_CREDIT_REFERRALS_ALLOWED=false`.

If an item is missing, write a failing test first in the closest existing test file, run it RED, implement the smallest missing behavior, then rerun GREEN.

- [ ] **Step 4: Run complete unit + E2E matrix GREEN**

```bash
npm test
npm run test:e2e
```

Expected: PASS.

- [ ] **Step 5: Commit Task 7**

```bash
git add tests/e2e/smoke.spec.ts tests/unit tests/integration
git commit -m "test: cover V2.2 acceptance matrix"
```

Only include files actually changed by this task.

---

### Task 8: Lock final release invariants and CI gates

**Files:**
- Create: `tests/unit/v2-2-release-invariants.test.ts`
- Modify: `supabase/tests/rls.sql`
- Modify: `.github/workflows/ci.yml` only if required.
- Modify: `README.md`

- [ ] **Step 1: Write the failing release-invariant test**

Create `tests/unit/v2-2-release-invariants.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8").toLowerCase();

describe("V2.2 release invariants", () => {
  it("keeps all downstream capabilities dark by default", () => {
    for (const migration of [
      "supabase/migrations/009_journey_foundation.sql",
      "supabase/migrations/010_retention_runtime_flags.sql",
      "supabase/migrations/011_commercial_admin.sql",
    ]) expect(existsSync(resolve(process.cwd(), migration))).toBe(true);

    const flags = read("supabase/migrations/010_retention_runtime_flags.sql");
    expect(flags).toContain("'email_reminders_enabled', false");
    expect(flags).toContain("'commercial_gateway_enabled', false");

    const env = read(".env.example");
    expect(env).toContain("live_credit_referrals_allowed=false");
  });

  it("keeps every existing CI quality gate", () => {
    const ci = read(".github/workflows/ci.yml");
    for (const command of [
      "npm audit --omit=dev --audit-level=high",
      "npm run lint",
      "npm test",
      "supabase db start",
      "supabase/tests/rls.sql",
      "npm run test:e2e",
      "npm run build",
    ]) expect(ci).toContain(command);
  });
});
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/v2-2-release-invariants.test.ts
```

Expected: FAIL until A-C migrations/env/defaults and any missing final RLS coverage are present.

- [ ] **Step 3: Extend final RLS verification**

In `supabase/tests/rls.sql`, add explicit `DO $$` assertions for all V2.2 tables/RPCs:
- `journey_state`, `journey_outcomes` owner read/no client write;
- `journey_reminders`, `communication_preferences` owner read/no direct client writes;
- `feature_flags` no anon/auth read/write;
- `commercial_partners`, `commercial_routes`, `commercial_disclosures`, `experiments`, `admin_members`, `admin_audit_log` no ordinary client write;
- `referral_attempts`, `revenue_events` protected and update-immutable;
- service-only reminder-claim/publication/admin-mutation RPC execution.

Add rollback-only behavioral probes for the append-only UPDATE triggers and duplicate reminder/source-key uniqueness. Do not grant DELETE broadly simply to make a test convenient.

- [ ] **Step 4: Verify CI workflow without weakening it**

If the existing workflow already contains every command from Step 1, make no workflow edit. If one required step is absent, add only that missing step using the existing Node 22/Supabase setup pattern.

- [ ] **Step 5: Update README with the exact dark-release model**

Document migrations 009/010/011, deterministic service-reminder boundary, sandbox-only commercial gateway, three approved experiment surfaces, reporting-only revenue and these base release defaults:

```text
email_reminders_enabled=false
commercial_gateway_enabled=false
LIVE_CREDIT_REFERRALS_ALLOWED=false
```

- [ ] **Step 6: Run invariant and local DB checks GREEN**

```bash
npm test -- tests/unit/v2-2-release-invariants.test.ts
if [ ! -f supabase/config.toml ]; then supabase init; fi
supabase db start
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f supabase/tests/rls.sql
supabase stop --no-backup
```

Expected: PASS / exit 0.

- [ ] **Step 7: Commit Task 8**

```bash
git add tests/unit/v2-2-release-invariants.test.ts supabase/tests/rls.sql README.md .github/workflows/ci.yml
git commit -m "test: lock V2.2 release invariants"
```

Omit `.github/workflows/ci.yml` from `git add` if it did not change.

---

### Task 9: Pre-production exact-head verification and PR gate

**Files:** no product-code changes expected.

**Interfaces:** Produces immutable evidence for the exact feature-branch head before merge. No production DDL/write occurs in this task.

- [ ] **Step 1: Compare the exact branch against `main`**

Run:

```bash
git fetch origin
git diff --stat origin/main...HEAD
git diff --name-status origin/main...HEAD
```

Review every path. Expected: V2.2 spec/plans plus the intended A-D implementation only; no unrelated feature changes.

- [ ] **Step 2: Run the full local release gate**

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
```

Expected: every command exits 0.

- [ ] **Step 3: Reset a clean local Supabase and verify the complete migration chain**

```bash
if [ ! -f supabase/config.toml ]; then supabase init; fi
supabase db start
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f supabase/tests/rls.sql
supabase stop --no-backup
```

Expected: migrations 001-011 apply in order and RLS verification exits 0.

- [ ] **Step 4: Open/update a draft PR against `main`**

PR body must list exact head SHA, A-D scope, dark defaults, full local checks and the explicit statement:

```text
Do not merge until explicit user approval.
```

- [ ] **Step 5: Wait for exact-head GitHub CI and Vercel preview**

Require:
- GitHub Actions workflow on the exact PR head: completed `success`;
- Vercel status on the same head: `success`.

If head changes, repeat verification for the new exact head.

- [ ] **Step 6: Preview smoke**

Verify preview behavior:
- adult journey status renders;
- under-18 and Safe Mode show no commercial route;
- seven-card feed remains seven;
- email preference is service-reminder wording only;
- `/admin` denies a normal user;
- `/offers` has no direct live referral path;
- commercial/email flags unavailable/off fail closed.

- [ ] **Step 7: Stop before merge**

Do not merge or apply production V2.2 DDL without the user's explicit merge/deploy approval. The implementation approval authorises building/testing; it does not silently bypass this release gate.

---

### Task 10: Dark-first production deployment, migration verification and exact evidence

**Files:** no product-code changes expected; update GitHub roadmap issue only after actual production verification.

**Precondition:** explicit user merge/deploy approval after Task 9 exact-head evidence.

- [ ] **Step 1: Re-fetch the PR immediately before merge**

Confirm open, mergeable, exact expected head SHA and exact-head CI/Vercel success. Merge with the connector/API expected-head guard or equivalent race protection.

- [ ] **Step 2: Verify compatible `main`/production code is live before V2.2 DDL**

The deployed app must fail soft while 009-011 are absent:
- core onboarding/dashboard/Academy/Passport/Readiness/Action Layer still load;
- optional Journey reads render nothing rather than breaking core;
- feature flag read failure returns false;
- commercial route listing returns none;
- cron sends nothing.

Do not proceed to DDL if the compatible app is not live.

- [ ] **Step 3: Apply migration 009 `journey_foundation`**

Apply the exact repository SQL through Supabase migration tooling. Immediately verify:
- tables exist;
- RLS enabled;
- owner SELECT/no client write grants;
- same-owner mission FKs;
- outcome UPDATE mutation rejected while deliberate service-role/account erasure remains possible;
- core production smoke still passes.

- [ ] **Step 4: Apply migration 010 `retention_runtime_flags`**

Verify actual rows:

```sql
select flag_key, enabled
from public.feature_flags
where flag_key in ('email_reminders_enabled','commercial_gateway_enabled')
order by flag_key;
```

Expected both `false`. Verify preference/RLS, claim RPC service-only execution and zero outbound reminder sends.

- [ ] **Step 5: Apply migration 011 `commercial_admin`**

Verify:
- no enabled live route seed;
- sandbox route/disclosure exists only as specified by C;
- ordinary clients cannot mutate config/referral/revenue/admin tables;
- referral/revenue UPDATE triggers reject mutation;
- disclosure/admin RPC permissions are service/admin controlled;
- `LIVE_CREDIT_REFERRALS_ALLOWED` is not true.

- [ ] **Step 6: Run Supabase advisors and production smoke**

Security findings that expose V2.2 user data/control are blockers. Treat newly created unused-index performance findings as informational until real workload exists; do not remove required indexes solely because they are initially unused.

Production smoke must reconfirm:
- seven-card Quest Feed;
- Academy public routes;
- Passport/Readiness;
- Action Layer;
- under-18 education-only protection;
- Safe Mode protection;
- WAIT/no-route states;
- no live referral;
- no service email with flag false.

- [ ] **Step 7: Record exact release evidence in GitHub issue #7**

Add one final comment to `V2.1: Customer Journey + monetisation layer` containing actual observed values only:
- merged PR number and merge/main SHA;
- successful exact main CI run ID;
- production Vercel deployment/status;
- applied Supabase migration versions/names for 009-011;
- post-DDL RLS/security/advisor results;
- actual `email_reminders_enabled` and `commercial_gateway_enabled` values;
- confirmation `LIVE_CREDIT_REFERRALS_ALLOWED` is not true;
- production smoke results;
- deferred: FCA operating model/live partners, marketing email, push/SMS, CRA/Open Banking/lender eligibility integrations.

Reference issue #10 only if the release-foundation targets materially changed. Do not create a docs-only commit merely to record release identifiers.

- [ ] **Step 8: Finish branch workflow**

Use `superpowers:verification-before-completion` before claiming success, then `superpowers:finishing-a-development-branch`. Report exact merge SHA, production CI/Vercel state, database migration state and any non-blocking advisor warnings.

---

## V2.2 Definition of Done

V2.2 is done when customers can move from action -> outcome -> scheduled reassessment -> explainable progress, opt into deterministic service reminders, and exercise a fully auditable sandbox commercial journey; internal operators can safely manage downstream configuration; analytics prove customer progress without becoming strategy inputs; presentation experiments can alter only approved surfaces within already-permitted sets; all architectural/RLS/E2E gates pass; exact release evidence is recorded; and production remains commercially dark pending the separate FCA operating-model decision.
