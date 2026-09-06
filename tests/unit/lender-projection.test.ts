import { describe, expect, it } from "vitest";
import {
  buildLenderCohorts,
  buildLenderOverviewProjection,
  calculateLenderRate,
  deriveLenderRecoveryState,
  shouldIncludeLenderPipelineJourney,
  summariseLenderEvidenceConfidence,
} from "@/lib/recovery/lender-projection";

const now = new Date("2026-09-06T12:00:00.000Z");

describe("lender recovery projection", () => {
  it("calculates exact funnel rates and preserves unavailable semantics", () => {
    expect(calculateLenderRate(8, 10)).toEqual({
      numerator: 8,
      denominator: 10,
      percentage: 80,
    });
    expect(calculateLenderRate(null, 10)).toEqual({
      numerator: null,
      denominator: 10,
      percentage: null,
    });
    expect(calculateLenderRate(0, 0)).toEqual({
      numerator: 0,
      denominator: 0,
      percentage: null,
    });
  });

  it("uses the approved denominators in the executive overview", () => {
    const overview = buildLenderOverviewProjection({
      handoffs: 10,
      activations: 8,
      firstActions: 6,
      reassessments: 5,
      readyToCheck: 4,
      voluntaryReturns: 2,
      averageTimeToFirstActionHours: 12.5,
      suppressionReasons: { cooldown_active: 2 },
    });

    expect(overview.activationRate.percentage).toBe(80);
    expect(overview.firstActionRate.percentage).toBe(75);
    expect(overview.recoveryRate.percentage).toBe(50);
    expect(overview.voluntaryReturnRate.percentage).toBe(50);
    expect(overview.averageTimeToFirstActionHours).toBe(12.5);
    expect(overview.suppressionReasons).toEqual({ cooldown_active: 2 });
  });

  it("makes only dependent overview rates unavailable when a source is missing", () => {
    const overview = buildLenderOverviewProjection({
      handoffs: 10,
      activations: 8,
      firstActions: null,
      reassessments: null,
      readyToCheck: 4,
      voluntaryReturns: null,
      averageTimeToFirstActionHours: null,
      suppressionReasons: null,
    });

    expect(overview.activationRate.percentage).toBe(80);
    expect(overview.firstActionRate.percentage).toBeNull();
    expect(overview.recoveryRate.percentage).toBe(50);
    expect(overview.voluntaryReturnRate.percentage).toBeNull();
  });

  it("adapts persisted facts into the approved five-state recovery display", () => {
    expect(deriveLenderRecoveryState({
      recoveryStage: "ready_to_check",
      readinessState: "ready_to_check",
      journeyStage: "waiting",
      activeMissionId: null,
      openAttempt: null,
      now,
    })).toBe("ready_to_check");

    expect(deriveLenderRecoveryState({
      recoveryStage: "rebuilding",
      readinessState: "getting_closer",
      journeyStage: "reassessment_due",
      activeMissionId: null,
      openAttempt: null,
      now,
    })).toBe("reassessment_due");

    expect(deriveLenderRecoveryState({
      recoveryStage: "rebuilding",
      readinessState: "not_ready",
      journeyStage: "active_mission",
      activeMissionId: "m1",
      openAttempt: null,
      now,
    })).toBe("action_required");

    expect(deriveLenderRecoveryState({
      recoveryStage: "rebuilding",
      readinessState: "getting_closer",
      journeyStage: "waiting",
      activeMissionId: null,
      openAttempt: {
        status: "submitted",
        nextReviewAt: "2026-09-20T09:00:00.000Z",
        verifiedAt: null,
      },
      now,
    })).toBe("waiting_for_evidence");

    expect(deriveLenderRecoveryState({
      recoveryStage: "stability",
      readinessState: "not_ready",
      journeyStage: "waiting",
      activeMissionId: null,
      openAttempt: null,
      now,
    })).toBe("not_ready");
  });

  it("summarises evidence confidence without exposing evidence detail", () => {
    expect(summariseLenderEvidenceConfidence([
      { status: "verified", nextReviewAt: null, verifiedAt: "2026-09-05T09:00:00.000Z" },
      { status: "submitted", nextReviewAt: "2026-09-20T09:00:00.000Z", verifiedAt: null },
    ], now)).toBe("verified");

    expect(summariseLenderEvidenceConfidence([
      { status: "submitted", nextReviewAt: "2026-09-20T09:00:00.000Z", verifiedAt: null },
    ], now)).toBe("pending");

    expect(summariseLenderEvidenceConfidence([
      { status: "self_confirmed", nextReviewAt: null, verifiedAt: null },
    ], now)).toBe("confirmed");

    expect(summariseLenderEvidenceConfidence([], now)).toBe("unknown");
  });

  it("includes active journeys regardless of age and closed journeys only when final activity is in window", () => {
    const from = new Date("2026-08-08T00:00:00.000Z");

    expect(shouldIncludeLenderPipelineJourney({
      completedAt: null,
      finalActivityAt: "2026-06-01T09:00:00.000Z",
    }, from)).toBe(true);

    expect(shouldIncludeLenderPipelineJourney({
      completedAt: "2026-09-05T09:00:00.000Z",
      finalActivityAt: "2026-09-05T09:00:00.000Z",
    }, from)).toBe(true);

    expect(shouldIncludeLenderPipelineJourney({
      completedAt: "2026-06-01T09:00:00.000Z",
      finalActivityAt: "2026-06-01T09:00:00.000Z",
    }, from)).toBe(false);
  });

  it("builds UTC weekly cohorts with the same approved funnel denominators", () => {
    const cohorts = buildLenderCohorts([
      {
        cohortAt: "2026-08-31T08:00:00.000Z",
        activated: true,
        firstActionAt: "2026-09-01T09:00:00.000Z",
        readyToCheckAt: "2026-09-03T09:00:00.000Z",
        voluntaryReturnAt: "2026-09-04T09:00:00.000Z",
      },
      {
        cohortAt: "2026-09-02T08:00:00.000Z",
        activated: true,
        firstActionAt: null,
        readyToCheckAt: null,
        voluntaryReturnAt: null,
      },
      {
        cohortAt: "2026-09-03T08:00:00.000Z",
        activated: false,
        firstActionAt: null,
        readyToCheckAt: null,
        voluntaryReturnAt: null,
      },
    ], "week");

    expect(cohorts).toHaveLength(1);
    expect(cohorts[0]).toMatchObject({
      bucket: "2026-08-31",
      handoffs: 3,
      activations: 2,
      firstActions: 1,
      readyToCheck: 1,
      voluntaryReturns: 1,
    });
    expect(cohorts[0].activationRate.percentage).toBeCloseTo(66.7, 1);
    expect(cohorts[0].firstActionRate.percentage).toBe(50);
    expect(cohorts[0].recoveryRate.percentage).toBe(50);
    expect(cohorts[0].voluntaryReturnRate.percentage).toBe(100);
  });

  it("builds UTC monthly cohorts without any journey or user identifiers", () => {
    const cohorts = buildLenderCohorts([
      {
        cohortAt: "2026-08-31T23:59:59.000Z",
        activated: false,
        firstActionAt: null,
        readyToCheckAt: null,
        voluntaryReturnAt: null,
      },
      {
        cohortAt: "2026-09-01T00:00:00.000Z",
        activated: false,
        firstActionAt: null,
        readyToCheckAt: null,
        voluntaryReturnAt: null,
      },
    ], "month");

    expect(cohorts.map((row) => row.bucket)).toEqual(["2026-08", "2026-09"]);
    expect(JSON.stringify(cohorts)).not.toMatch(/userId|journeyId|recoveryJourneyId/i);
    expect(cohorts[0].activationRate.percentage).toBe(0);
    expect(cohorts[0].firstActionRate.percentage).toBeNull();
  });
});
