import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createJourneyOrchestrator } from "@/lib/server/journey-orchestrator";

function state(overrides: Record<string, unknown> = {}) {
  return {
    userId: "u1",
    stage: "reassessment_due" as const,
    activeMissionId: null,
    nextReassessmentAt: "2026-08-29T07:00:00.000Z",
    lastReassessedAt: null,
    lastReadinessBand: "amber" as const,
    updatedAt: "2026-08-28T08:00:00.000Z",
    ...overrides,
  };
}

function readiness(value: "red" | "amber" | "green" | "unknown") {
  return {
    state: value,
    headline: value,
    reasons: [],
    avoid: [],
    actions: [],
    reassessAt: null,
    daysUntilReassessment: null,
  };
}

function deps(overrides: Record<string, unknown> = {}) {
  return {
    appendOutcome: vi.fn().mockImplementation(async (input) => ({ id: input.sourceKey, ...input })),
    upsertState: vi.fn().mockImplementation(async (input) => input),
    getState: vi.fn().mockResolvedValue(null),
    getGuidance: vi.fn().mockResolvedValue({ readiness: readiness("unknown") }),
    getMissionContext: vi.fn().mockResolvedValue({
      activeMission: null,
      hasCompletedMission: false,
      onboardingComplete: true,
    }),
    ...overrides,
  };
}

describe("Journey Orchestrator", () => {
  it("persists one stable mission outcome and updates the projection", async () => {
    const d = deps({ getState: vi.fn().mockResolvedValue(state({ lastReadinessBand: "amber" })) });
    const orchestrator = createJourneyOrchestrator(d);

    await orchestrator.observeJourneyEvent({
      userId: "u1",
      eventType: "mission_completed",
      source: "mission",
      sourceKey: "mission:m1:completed:2026-08-29T08:00:00.000Z",
      missionInstanceId: "m1",
      nextReviewAt: "2026-09-29T08:00:00.000Z",
      now: new Date("2026-08-29T08:00:00.000Z"),
    });

    expect(d.appendOutcome).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: "mission:m1:completed:2026-08-29T08:00:00.000Z",
      readinessBefore: "amber",
      readinessAfter: "amber",
    }));
    expect(d.upsertState).toHaveBeenCalledWith(expect.objectContaining({
      nextReassessmentAt: "2026-09-29T08:00:00.000Z",
    }));
  });

  it("records a readiness change only when the band changes", async () => {
    const d = deps({
      getState: vi.fn().mockResolvedValue(state()),
      getGuidance: vi.fn().mockResolvedValue({ readiness: readiness("green") }),
      getMissionContext: vi.fn().mockResolvedValue({ activeMission: null, hasCompletedMission: true, onboardingComplete: true }),
    });
    const orchestrator = createJourneyOrchestrator(d);

    const result = await orchestrator.reassessJourneyForUser({
      userId: "u1",
      sourceKey: "reassessment:u1:2026-08-29T07:00:00.000Z",
      now: new Date("2026-08-29T08:00:00.000Z"),
    });

    expect(result?.changed).toBe(true);
    expect(d.appendOutcome).toHaveBeenCalledTimes(2);
    expect(d.appendOutcome).toHaveBeenCalledWith(expect.objectContaining({ eventType: "readiness_changed" }));
  });

  it("does not invent a change when readiness is unchanged or unknown", async () => {
    for (const band of ["amber", "unknown"] as const) {
      const d = deps({
        getState: vi.fn().mockResolvedValue(state({ lastReadinessBand: band })),
        getGuidance: vi.fn().mockResolvedValue({ readiness: readiness(band) }),
      });
      const result = await createJourneyOrchestrator(d).reassessJourneyForUser({
        userId: "u1",
        sourceKey: `reassessment:u1:${band}`,
        now: new Date("2026-08-29T08:00:00.000Z"),
      });
      expect(result?.changed).toBe(false);
      expect(d.appendOutcome).toHaveBeenCalledTimes(1);
    }
  });

  it("does nothing before the deterministic reassessment time", async () => {
    const d = deps({
      getState: vi.fn().mockResolvedValue(state({ nextReassessmentAt: "2026-08-30T08:00:00.000Z" })),
    });
    const result = await createJourneyOrchestrator(d).reassessJourneyForUser({
      userId: "u1",
      sourceKey: "not-due",
      now: new Date("2026-08-29T08:00:00.000Z"),
    });
    expect(result).toBeNull();
    expect(d.getGuidance).not.toHaveBeenCalled();
  });

  it("has no commercial economics input", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/server/journey-orchestrator.ts"), "utf8").toLowerCase();
    for (const forbidden of ["offer-matcher", "affiliate", "commission", "epc", "payout", "revenue", "campaign"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
