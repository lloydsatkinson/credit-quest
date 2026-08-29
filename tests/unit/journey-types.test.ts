import { describe, expect, it } from "vitest";
import type {
  JourneyOutcomeInput,
  JourneyState,
} from "@/lib/journey/types";

function acceptsState(value: JourneyState) { return value; }
function acceptsOutcome(value: JourneyOutcomeInput) { return value; }

describe("Journey contracts", () => {
  it("keeps lifecycle and outcome records serialisable", () => {
    const state = acceptsState({
      userId: "00000000-0000-0000-0000-000000000001",
      stage: "reassessment_due",
      activeMissionId: null,
      nextReassessmentAt: "2026-09-01T08:00:00.000Z",
      lastReassessedAt: null,
      lastReadinessBand: "amber",
      updatedAt: "2026-08-29T08:00:00.000Z",
    });
    expect(state.stage).toBe("reassessment_due");

    const outcome = acceptsOutcome({
      userId: state.userId,
      eventType: "mission_completed",
      source: "mission",
      sourceKey: "mission:abc:completed:2026-08-29T08:00:00.000Z",
      missionInstanceId: "00000000-0000-0000-0000-000000000002",
      readinessBefore: "amber",
      readinessAfter: "amber",
      metadata: { missionSlug: "application-cooldown" },
      occurredAt: "2026-08-29T08:00:00.000Z",
    });
    expect(outcome.sourceKey).toContain("mission:");
  });
});
