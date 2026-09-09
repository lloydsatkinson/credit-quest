import { describe, expect, it } from "vitest";
import {
  aggregateLenderPilotAnalytics,
  type LenderPilotAnalyticsInput,
  type LenderPilotScope,
} from "@/lib/server/lender-analytics-repository";

const scope: LenderPilotScope = { partnerId: "partner-a", pilotIds: ["pilot-1"] };

function input(overrides: Partial<LenderPilotAnalyticsInput> = {}): LenderPilotAnalyticsInput {
  return {
    assignments: [
      {
        partnerId: "partner-a", pilotId: "pilot-1", journeyId: "j1",
        canonicalCodes: ["DSR_HIGH"],
        handoffAt: "2026-09-01T09:00:00.000Z", activatedAt: "2026-09-01T09:10:00.000Z",
        journeyStartedAt: "2026-09-01T09:10:00.000Z", firstActionAt: "2026-09-01T15:10:00.000Z",
        firstReassessedAt: "2026-09-02T09:10:00.000Z", firstReadyToCheckAt: "2026-09-04T09:10:00.000Z",
        currentReadiness: "not_ready",
      },
      {
        partnerId: "partner-a", pilotId: "pilot-1", journeyId: "j2",
        canonicalCodes: ["THIN_FILE", "RECENT_STL_ACTIVITY"],
        handoffAt: "2026-09-02T09:00:00.000Z", activatedAt: "2026-09-02T09:05:00.000Z",
        journeyStartedAt: "2026-09-02T09:05:00.000Z", firstActionAt: "2026-09-02T21:05:00.000Z",
        firstReassessedAt: null, firstReadyToCheckAt: null, currentReadiness: "getting_closer",
      },
      {
        partnerId: "partner-a", pilotId: "pilot-2", journeyId: "j-out-pilot",
        canonicalCodes: ["DSR_HIGH"], handoffAt: "2026-09-01T10:00:00.000Z", activatedAt: null,
        journeyStartedAt: null, firstActionAt: null, firstReassessedAt: null, firstReadyToCheckAt: null, currentReadiness: null,
      },
      {
        partnerId: "partner-b", pilotId: "pilot-b", journeyId: "j-out-partner",
        canonicalCodes: ["ACTIVE_IVA"], handoffAt: "2026-09-01T11:00:00.000Z", activatedAt: "2026-09-01T11:05:00.000Z",
        journeyStartedAt: "2026-09-01T11:05:00.000Z", firstActionAt: null, firstReassessedAt: null,
        firstReadyToCheckAt: "2026-09-03T11:05:00.000Z", currentReadiness: "ready_to_check",
      },
    ],
    returns: [
      { partnerId: "partner-a", pilotId: "pilot-1", journeyId: "j1", routeType: "original", customerChoice: "continue", outcome: "redirected" },
      { partnerId: "partner-a", pilotId: "pilot-1", journeyId: "j2", routeType: "alternative", customerChoice: "continue", outcome: "redirected" },
      { partnerId: "partner-b", pilotId: "pilot-b", journeyId: "j-out-partner", routeType: "original", customerChoice: "continue", outcome: "redirected" },
    ],
    actionSourceAvailable: true,
    ...overrides,
  };
}

describe("V2.3 lender pilot analytics", () => {
  it("uses historical first-ready truth even when current readiness later regresses", () => {
    const result = aggregateLenderPilotAnalytics(scope, input());
    expect(result.totals.readyToCheck).toBe(1);
    expect(result.medianTimeToReadyDays).toBe(3);
  });

  it("computes scoped funnel, medians and separate original/alternative return outcomes", () => {
    const result = aggregateLenderPilotAnalytics(scope, input());
    expect(result.totals).toEqual({
      handoffs: 2,
      activated: 2,
      startedRecovery: 2,
      reassessed: 1,
      readyToCheck: 1,
      voluntaryReturns: 2,
    });
    expect(result.medianTimeToFirstActionHours).toBe(9);
    expect(result.returnOutcomes).toEqual({ originalProductReturns: 1, alternativeRouteChecks: 1 });
    expect(result.rates.activation).toBe(1);
    expect(result.rates.endToEndYield).toBe(1);
  });

  it("defines Return Rate as voluntary returns divided by historical Ready-to-Check", () => {
    const base = input();
    const third = {
      ...base.assignments[1],
      journeyId: "j3",
      handoffAt: "2026-09-03T09:00:00.000Z",
      activatedAt: "2026-09-03T09:05:00.000Z",
      journeyStartedAt: "2026-09-03T09:05:00.000Z",
      firstReadyToCheckAt: "2026-09-05T09:05:00.000Z",
      currentReadiness: "ready_to_check",
    };
    const result = aggregateLenderPilotAnalytics(scope, input({
      assignments: [base.assignments[0], base.assignments[1], third],
      returns: [base.returns[0]],
    }));

    expect(result.totals.activated).toBe(3);
    expect(result.totals.readyToCheck).toBe(2);
    expect(result.totals.voluntaryReturns).toBe(1);
    expect(result.rates.return).toBe(0.5);
  });

  it("never lets another partner or unscoped pilot leak into aggregates", () => {
    const result = aggregateLenderPilotAnalytics(scope, input());
    expect(result.totals.handoffs).toBe(2);
    expect(JSON.stringify(result)).not.toContain("ACTIVE_IVA");
    expect(JSON.stringify(result)).not.toContain("partner-b");
    expect(JSON.stringify(result)).not.toContain("pilot-2");
  });

  it("returns unavailable action metrics rather than inventing zero", () => {
    const result = aggregateLenderPilotAnalytics(scope, input({ actionSourceAvailable: false }));
    expect(result.totals.startedRecovery).toBeNull();
    expect(result.medianTimeToFirstActionHours).toBeNull();
    expect(result.rates.action).toBeNull();
  });

  it("reports canonical decline reason aggregates without customer identifiers or raw financial data", () => {
    const result = aggregateLenderPilotAnalytics(scope, input());
    expect(result.declineReasons).toEqual([
      { canonicalCode: "DSR_HIGH", handoffs: 1, activated: 1, ready: 1, returned: 1 },
      { canonicalCode: "RECENT_STL_ACTIVITY", handoffs: 1, activated: 1, ready: 0, returned: 1 },
      { canonicalCode: "THIN_FILE", handoffs: 1, activated: 1, ready: 0, returned: 1 },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/userId|income|balance|support|vulnerab|health|diagnosis/i);
  });
});
