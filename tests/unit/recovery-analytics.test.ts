import { describe, expect, it, vi } from "vitest";
import {
  RECOVERY_EVENT_NAMES,
  emitRecoveryEventBestEffort,
} from "@/lib/recovery/events";
import {
  aggregateRecoveryAnalytics,
  type RecoveryAnalyticsInput,
} from "@/lib/server/recovery-analytics-repository";

const started = "2026-09-01T09:00:00.000Z";

function input(overrides: Partial<RecoveryAnalyticsInput> = {}): RecoveryAnalyticsInput {
  return {
    handoffs: [
      { partnerId: "p1", partnerDisplayName: "Alpha Bank", createdAt: started, consumedAt: "2026-09-01T09:05:00.000Z" },
      { partnerId: "p1", partnerDisplayName: "Alpha Bank", createdAt: "2026-09-01T10:00:00.000Z", consumedAt: null },
      { partnerId: "p2", partnerDisplayName: "Beta Finance", createdAt: "2026-09-01T11:00:00.000Z", consumedAt: "2026-09-01T11:10:00.000Z" },
    ],
    journeys: [
      { journeyId: "j1", userId: "u1", partnerId: "p1", startedAt: started, lastReassessedAt: "2026-09-02T09:00:00.000Z", readinessState: "ready_to_check" },
      { journeyId: "j2", userId: "u2", partnerId: "p1", startedAt: "2026-09-01T10:00:00.000Z", lastReassessedAt: null, readinessState: "getting_closer" },
      { journeyId: "j3", userId: "u3", partnerId: "p2", startedAt: "2026-09-01T11:00:00.000Z", lastReassessedAt: "2026-09-02T11:00:00.000Z", readinessState: "not_ready" },
    ],
    actionStarts: [
      { userId: "u1", startedAt: "2026-09-01T15:00:00.000Z" },
      { userId: "u1", startedAt: "2026-09-01T18:00:00.000Z" },
      { userId: "u3", startedAt: "2026-09-01T17:00:00.000Z" },
      { userId: "unrelated", startedAt: "2026-09-01T12:00:00.000Z" },
    ],
    returns: [
      { partnerId: "p1", customerChoice: "continue", outcome: "redirected", suppressionReason: null },
      { partnerId: "p1", customerChoice: "decline", outcome: "declined", suppressionReason: null },
      { partnerId: "p2", customerChoice: "continue", outcome: "suppressed", suppressionReason: "cooldown_active" },
      { partnerId: "p2", customerChoice: "continue", outcome: "suppressed", suppressionReason: "cooldown_active" },
      { partnerId: "p2", customerChoice: "continue", outcome: "suppressed", suppressionReason: "safe_mode" },
    ],
    ...overrides,
  };
}

describe("recovery analytics events", () => {
  it("pins a small canonical event vocabulary with no revenue or support-detail semantics", () => {
    expect(RECOVERY_EVENT_NAMES).toEqual([
      "recovery_handoff_created",
      "recovery_activated",
      "recovery_first_action",
      "recovery_reassessed",
      "recovery_ready_to_check",
      "recovery_return_choice",
      "recovery_return_blocked",
    ]);
    expect(JSON.stringify(RECOVERY_EVENT_NAMES)).not.toMatch(/revenue|commission|epc|support|vulnerab|health|diagnosis/i);
  });

  it("keeps recovery event writes best-effort so analytics cannot block a customer action", async () => {
    const failingWriter = vi.fn().mockRejectedValue(new Error("analytics unavailable"));
    await expect(emitRecoveryEventBestEffort(failingWriter, {
      name: "recovery_ready_to_check",
      metadata: { recoveryJourneyId: "j1" },
    })).resolves.toBeUndefined();
    expect(failingWriter).toHaveBeenCalledTimes(1);
  });
});

describe("aggregate recovery analytics", () => {
  it("reports the closed-loop funnel, first-action timing and suppression reasons", () => {
    const result = aggregateRecoveryAnalytics(input());

    expect(result.totals).toEqual({
      handoffs: 3,
      activations: 2,
      firstActions: 2,
      reassessments: 2,
      readyToCheck: 1,
      voluntaryReturns: 1,
    });
    expect(result.averageTimeToFirstActionHours).toBe(6);
    expect(result.suppressionReasons).toEqual({ cooldown_active: 2, safe_mode: 1 });
    expect(result.sources).toEqual({ recovery: "available", actions: "available" });
  });

  it("reports partner cohorts only as aggregate counts", () => {
    const result = aggregateRecoveryAnalytics(input());
    expect(result.partners).toEqual([
      {
        partnerId: "p1",
        partnerDisplayName: "Alpha Bank",
        handoffs: 2,
        activations: 1,
        readyToCheck: 1,
        voluntaryReturns: 1,
      },
      {
        partnerId: "p2",
        partnerDisplayName: "Beta Finance",
        handoffs: 1,
        activations: 1,
        readyToCheck: 0,
        voluntaryReturns: 0,
      },
    ]);
  });

  it("uses unavailable semantics rather than silently turning a missing action source into zero", () => {
    const result = aggregateRecoveryAnalytics(input({ actionStarts: null }));
    expect(result.totals.firstActions).toBeNull();
    expect(result.averageTimeToFirstActionHours).toBeNull();
    expect(result.sources.actions).toBe("unavailable");
    expect(result.totals.handoffs).toBe(3);
  });

  it("does not expose customer identifiers, support needs, vulnerability detail or partner economics", () => {
    const result = aggregateRecoveryAnalytics(input());
    const output = JSON.stringify(result);
    expect(output).not.toMatch(/"userId"|supportNeed|vulnerab|health|diagnosis|commission|revenue|epc|payout/i);
  });

  it("ignores action starts before the recovery journey began", () => {
    const result = aggregateRecoveryAnalytics(input({
      actionStarts: [
        { userId: "u1", startedAt: "2026-08-31T09:00:00.000Z" },
        { userId: "u1", startedAt: "2026-09-01T15:00:00.000Z" },
      ],
    }));
    expect(result.totals.firstActions).toBe(1);
    expect(result.averageTimeToFirstActionHours).toBe(6);
  });
});
